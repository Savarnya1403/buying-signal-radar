import "server-only";
import { createHash, randomUUID } from "node:crypto";
import type { Prisma, SignalType, SourceType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { classifySignal } from "@/lib/connectors/classify";
import { canonicalizeUrl, companyKey, inferIndustry, normalizeCompanyName, truncateEvidence } from "@/lib/connectors/extraction";
import { runConnector } from "@/lib/connectors";
import { rescoreWorkspace } from "@/lib/scoring/service";
import type { ConnectorIcp, RawDocument } from "@/lib/connectors/types";

export type SourceRunSummary = {
  sourceId: string;
  name: string;
  type: SourceType;
  status: "SUCCESS" | "PARTIAL" | "FAILED";
  fetched: number;
  kept: number;
  companiesCreated: number;
  signalsCreated: number;
  duplicates: number;
  warnings: string[];
  error?: string;
  runId: string;
};

export type DiscoverySummary = {
  sources: SourceRunSummary[];
  totals: {
    fetched: number;
    kept: number;
    companiesCreated: number;
    signalsCreated: number;
    duplicates: number;
    prospectsScored: number;
  };
  startedAt: string;
  finishedAt: string;
  warnings: string[];
};

function dedupeKey(company: string, type: SignalType, url: string): string {
  return createHash("sha256").update(`${company}|${type}|${canonicalizeUrl(url)}`).digest("hex");
}

function isWithinPeriod(date: Date | null, cutoff: Date): boolean {
  if (!date) return true;
  return date >= cutoff;
}

function cleanDomain(value: string | null | undefined): string | null {
  if (!value) return null;
  return value
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "")
    .toLowerCase()
    .trim() || null;
}

type CompanyIndexEntry = {
  id: string;
  domain: string | null;
  website: string | null;
  industry: string | null;
  location: string | null;
  employeeCount: number | null;
  description: string | null;
};

type CompanyIndex = {
  byName: Map<string, CompanyIndexEntry>;
  byDomain: Map<string, CompanyIndexEntry>;
  created: Prisma.CompanyCreateManyInput[];
  updates: Map<string, Prisma.CompanyUpdateInput>;
};

/**
 * Loads the workspace's companies once so discovery can dedupe in memory and
 * write companies/signals in batches. On a serverless database with a small
 * connection pool, per-document round-trips are what blow the time budget.
 */
async function loadCompanyIndex(workspaceId: string): Promise<CompanyIndex> {
  const rows = await prisma.company.findMany({
    where: { workspaceId },
    select: {
      id: true,
      normalizedName: true,
      domain: true,
      website: true,
      industry: true,
      location: true,
      employeeCount: true,
      description: true,
    },
  });

  const byName = new Map<string, CompanyIndexEntry>();
  const byDomain = new Map<string, CompanyIndexEntry>();
  for (const row of rows) {
    const entry: CompanyIndexEntry = {
      id: row.id,
      domain: row.domain,
      website: row.website,
      industry: row.industry,
      location: row.location,
      employeeCount: row.employeeCount,
      description: row.description,
    };
    byName.set(row.normalizedName, entry);
    if (row.domain) byDomain.set(row.domain, entry);
  }

  return { byName, byDomain, created: [], updates: new Map() };
}

function resolveCompany(
  index: CompanyIndex,
  workspaceId: string,
  document: RawDocument,
  icp: ConnectorIcp,
  now: Date,
): { id: string; created: boolean } | null {
  const name = normalizeCompanyName(document.company.name);
  const normalizedName = companyKey(name);
  if (!name || normalizedName.length < 2) return null;

  const domain = cleanDomain(document.company.domain);
  const website = document.company.website ?? (domain ? `https://${domain}` : null);
  // Job listings describe the role, not the employer's industry.
  const inferred =
    document.sourceType === "JOB_FEED"
      ? { industry: null, confidence: 0 }
      : inferIndustry(`${document.title} ${document.summary}`, icp.targetIndustries);
  const industry = document.company.industry ?? inferred.industry;
  const industryConfidence = industry ? (document.company.industry ? 0.7 : inferred.confidence) : null;
  const employeeCount =
    document.company.employeeCount && document.company.employeeCount > 0 ? document.company.employeeCount : null;
  const description = document.company.description ? truncateEvidence(document.company.description, 1000) : null;

  const existing = index.byName.get(normalizedName) ?? (domain ? index.byDomain.get(domain) : undefined);

  if (existing) {
    const update = index.updates.get(existing.id) ?? {};
    if (!existing.website && website) {
      update.website = website;
      existing.website = website;
    }
    if (!existing.domain && domain) {
      update.domain = domain;
      existing.domain = domain;
      index.byDomain.set(domain, existing);
    }
    if (!existing.industry && industry) {
      update.industry = industry;
      update.industryConfidence = industryConfidence;
      existing.industry = industry;
    }
    if (!existing.location && document.company.location) {
      update.location = document.company.location;
      existing.location = document.company.location;
    }
    if (!existing.employeeCount && employeeCount) {
      update.employeeCount = employeeCount;
      update.employeeRange = `${employeeCount.toLocaleString()} employees`;
      update.sizeSource = "Self-reported on a public page";
      existing.employeeCount = employeeCount;
    }
    if (!existing.description && description) {
      update.description = description;
      existing.description = description;
    }
    if (Object.keys(update).length > 0) index.updates.set(existing.id, update);
    return { id: existing.id, created: false };
  }

  const id = randomUUID();
  index.created.push({
    id,
    workspaceId,
    name,
    normalizedName,
    domain,
    website,
    industry,
    industryConfidence,
    location: document.company.location ?? null,
    employeeCount,
    employeeRange: employeeCount ? `${employeeCount.toLocaleString()} employees` : null,
    sizeSource: employeeCount ? "Self-reported on a public page" : null,
    description,
    createdAt: now,
    updatedAt: now,
  });
  const entry: CompanyIndexEntry = {
    id,
    domain,
    website,
    industry,
    location: document.company.location ?? null,
    employeeCount,
    description,
  };
  index.byName.set(normalizedName, entry);
  if (domain) index.byDomain.set(domain, entry);
  return { id, created: true };
}

export async function runDiscovery(options: {
  workspaceId: string;
  icpId?: string;
  sourceIds?: string[];
  periodDays?: number;
  now?: Date;
  trigger?: string;
}): Promise<DiscoverySummary> {
  const startedAt = new Date();
  const deadline = startedAt.getTime() + 45_000;
  const now = options.now ?? startedAt;

  const workspace = await prisma.workspace.findUniqueOrThrow({ where: { id: options.workspaceId } });
  const icp = options.icpId
    ? await prisma.icpProfile.findFirst({ where: { id: options.icpId, workspaceId: options.workspaceId } })
    : await prisma.icpProfile.findFirst({
        where: { workspaceId: options.workspaceId, isConfirmed: true },
        orderBy: { createdAt: "desc" },
      });

  if (!icp) throw new Error("Confirm an ICP before running discovery.");

  const periodDays = Math.min(365, Math.max(1, options.periodDays ?? icp.discoveryPeriodDays ?? 30));
  const cutoff = new Date(now.getTime() - periodDays * 86_400_000);
  const selectedTypes = new Set<SignalType>((icp.selectedSignalTypes.length > 0 ? icp.selectedSignalTypes : []) as SignalType[]);

  const connectorIcp: ConnectorIcp = {
    productCategory: icp.productCategory,
    targetIndustries: icp.targetIndustries,
    buyerRoles: icp.buyerRoles,
    geographies: icp.geographies,
    selectedSignalTypes: icp.selectedSignalTypes,
  };

  const sources = await prisma.source.findMany({
    where: {
      workspaceId: options.workspaceId,
      enabled: true,
      ...(options.sourceIds?.length ? { id: { in: options.sourceIds } } : {}),
    },
    orderBy: { createdAt: "asc" },
    take: 12,
  });

  const summaries: SourceRunSummary[] = [];
  const globalWarnings: string[] = [];

  if (sources.length === 0) {
    throw new Error("No enabled sources. Add an RSS feed, job feed or URL on the Signal sources page first.");
  }

  const [companyIndex, knownSignals] = await Promise.all([
    loadCompanyIndex(workspace.id),
    prisma.signal.findMany({ where: { workspaceId: workspace.id }, select: { dedupeKey: true } }),
  ]);
  const signalKeys = new Set(knownSignals.map((signal) => signal.dedupeKey));

  // Fetch every connector in parallel; writes stay serialised so a single slow
  // feed cannot consume the whole serverless time budget.
  const attempts = await Promise.all(
    sources.map(async (source) => {
      try {
        const result = await runConnector(source.type, source.config, connectorIcp, now);
        return { source, result };
      } catch (error) {
        return { source, error: error instanceof Error ? error : new Error("Unknown connector error") };
      }
    }),
  );

  for (const attempt of attempts) {
    const { source } = attempt;
    if (Date.now() > deadline) {
      globalWarnings.push(`Stopped before “${source.name}” to stay inside the 45-second run budget. Run it again to continue.`);
      break;
    }

    const run = await prisma.ingestionRun.create({
      data: {
        workspaceId: workspace.id,
        sourceId: source.id,
        status: "RUNNING",
        trigger: options.trigger ?? "manual",
      },
    });

    const signalRows: Prisma.SignalCreateManyInput[] = [];

    const summary: SourceRunSummary = {
      sourceId: source.id,
      name: source.name,
      type: source.type,
      status: "PARTIAL",
      fetched: 0,
      kept: 0,
      companiesCreated: 0,
      signalsCreated: 0,
      duplicates: 0,
      warnings: [],
      runId: run.id,
    };

    try {
      if ("error" in attempt && attempt.error) throw attempt.error;
      const result = attempt.result;
      if (!result) throw new Error("Connector returned no result.");
      summary.fetched = result.documents.length;
      summary.warnings.push(...result.warnings.slice(0, 8));

      for (const document of result.documents) {
        if (Date.now() > deadline) {
          summary.warnings.push("Run budget reached; remaining documents were skipped.");
          break;
        }
        if (document.publishedAt && !isWithinPeriod(document.publishedAt, cutoff)) {
          summary.warnings.push(`Skipped “${document.title.slice(0, 70)}” — outside the ${periodDays}-day window.`);
          continue;
        }
        if (document.publishedAt && document.publishedAt.getTime() > now.getTime() + 86_400_000) {
          continue;
        }

        const candidates = classifySignal({
          title: document.title,
          summary: document.summary,
          content: document.content,
          sourceType: document.sourceType,
          signalHints: document.signalHints,
          companyConfidence: document.company.confidence,
        }).filter((candidate) => selectedTypes.size === 0 || selectedTypes.has(candidate.type));

        if (candidates.length === 0) {
          summary.warnings.push(`No selected signal matched “${document.title.slice(0, 80)}”.`);
          continue;
        }

        const company = resolveCompany(companyIndex, workspace.id, document, connectorIcp, now);
        if (!company) {
          summary.warnings.push(`Skipped “${document.title.slice(0, 80)}” — company name could not be normalised.`);
          continue;
        }
        if (company.created) summary.companiesCreated += 1;

        let keptOne = false;
        for (const candidate of candidates.slice(0, 2)) {
          const key = dedupeKey(companyKey(document.company.name), candidate.type, document.url);
          if (signalKeys.has(key)) {
            summary.duplicates += 1;
            continue;
          }
          signalKeys.add(key);
          signalRows.push({
            id: randomUUID(),
            workspaceId: workspace.id,
            companyId: company.id,
            type: candidate.type,
            title: document.title.slice(0, 400),
            summary: truncateEvidence(document.summary || document.title, 1000),
            evidence: candidate.evidence.slice(0, 1200),
            sourceUrl: document.url,
            sourceName: document.sourceName,
            sourceType: document.sourceType,
            publishedAt: document.publishedAt,
            discoveredAt: now,
            confidence: Math.round(Math.min(0.99, Math.max(0.05, candidate.confidence)) * 100) / 100,
            dedupeKey: key,
            raw: JSON.parse(
              JSON.stringify({
                connector: document.sourceType,
                signalLabel: candidate.label,
                tags: document.tags?.slice(0, 12) ?? [],
                ...(document.metadata ?? {}),
              }),
            ) as Prisma.InputJsonValue,
          });
          summary.signalsCreated += 1;
          keptOne = true;
        }

        if (keptOne) summary.kept += 1;
      }

      summary.status = summary.signalsCreated > 0 ? "SUCCESS" : "PARTIAL";
      if (summary.signalsCreated === 0 && summary.warnings.length === 0) {
        summary.warnings.push("No new signals in this window.");
      }
    } catch (error) {
      summary.status = "FAILED";
      summary.error = error instanceof Error ? error.message : "Unknown connector error";
    }

    summary.warnings = [...new Set(summary.warnings)].slice(0, 10);

    // Batch writes: one insert per entity type instead of several queries per document.
    if (companyIndex.created.length > 0) {
      await prisma.company.createMany({ data: companyIndex.created, skipDuplicates: true });
      companyIndex.created = [];
    }
    if (signalRows.length > 0) {
      await prisma.signal.createMany({ data: signalRows, skipDuplicates: true });
    }
    if (companyIndex.updates.size > 0) {
      const updates = [...companyIndex.updates.entries()];
      companyIndex.updates.clear();
      await prisma.$transaction(
        updates.map(([id, data]) => prisma.company.update({ where: { id }, data })),
      );
    }

    await prisma.ingestionRun.update({
      where: { id: run.id },
      data: {
        status: summary.status,
        itemsFetched: summary.fetched,
        documentsKept: summary.kept,
        companiesCreated: summary.companiesCreated,
        signalsCreated: summary.signalsCreated,
        duplicates: summary.duplicates,
        error: summary.error,
        finishedAt: new Date(),
        log: summary.warnings as unknown as Prisma.InputJsonValue,
      },
    });
    await prisma.source.update({
      where: { id: source.id },
      data: {
        lastRunAt: new Date(),
        lastStatus: summary.status,
        lastError: summary.error ?? null,
        lastFetched: summary.fetched,
      },
    });

    summaries.push(summary);
  }

  const scoring = await rescoreWorkspace(workspace.id, icp.id);
  const finishedAt = new Date();

  return {
    sources: summaries,
    totals: {
      fetched: summaries.reduce((sum, item) => sum + item.fetched, 0),
      kept: summaries.reduce((sum, item) => sum + item.kept, 0),
      companiesCreated: summaries.reduce((sum, item) => sum + item.companiesCreated, 0),
      signalsCreated: summaries.reduce((sum, item) => sum + item.signalsCreated, 0),
      duplicates: summaries.reduce((sum, item) => sum + item.duplicates, 0),
      prospectsScored: scoring.scored,
    },
    warnings: globalWarnings,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
  };
}

export async function testSourceConnection(kind: SourceType, config: unknown, icp: ConnectorIcp) {
  const result = await runConnector(kind, config, icp, new Date());
  return {
    fetched: result.documents.length,
    warnings: result.warnings.slice(0, 8),
    sample: result.documents.slice(0, 3).map((document) => ({
      title: document.title,
      url: document.url,
      company: document.company.name,
      publishedAt: document.publishedAt?.toISOString() ?? null,
      signalHints: document.signalHints ?? [],
    })),
    attribution: result.attribution ?? null,
  };
}
