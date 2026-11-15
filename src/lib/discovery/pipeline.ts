import "server-only";
import { createHash } from "node:crypto";
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

async function upsertCompany(
  workspaceId: string,
  document: RawDocument,
  icp: ConnectorIcp,
  now: Date,
): Promise<{ id: string; created: boolean } | null> {
  const name = normalizeCompanyName(document.company.name);
  const normalizedName = companyKey(name);
  if (!name || normalizedName.length < 2) return null;
  const domain = cleanDomain(document.company.domain);
  const website = document.company.website ?? (domain ? `https://${domain}` : null);
  const inferred = inferIndustry(
    `${document.title} ${document.summary} ${document.content ?? ""}`,
    icp.targetIndustries,
  );
  const industry = document.company.industry ?? inferred.industry;
  const employeeCount = document.company.employeeCount && document.company.employeeCount > 0 ? document.company.employeeCount : null;

  const existing = await prisma.company.findFirst({
    where: {
      workspaceId,
      OR: [{ normalizedName }, ...(domain ? [{ domain }] : [])],
    },
  });

  if (existing) {
    const update: Prisma.CompanyUpdateInput = {};
    if (!existing.website && website) update.website = website;
    if (!existing.domain && domain) update.domain = domain;
    if (!existing.industry && industry) {
      update.industry = industry;
      update.industryConfidence = document.company.industry ? 0.7 : inferred.confidence;
    }
    if (!existing.location && document.company.location) update.location = document.company.location;
    if (!existing.employeeCount && employeeCount) {
      update.employeeCount = employeeCount;
      update.employeeRange = `${employeeCount.toLocaleString()} employees`;
      update.sizeSource = "Self-reported on a public page";
    }
    if (!existing.description && document.company.description) update.description = truncateEvidence(document.company.description, 1000);
    if (Object.keys(update).length > 0) {
      await prisma.company.update({ where: { id: existing.id }, data: update }).catch(() => undefined);
    }
    return { id: existing.id, created: false };
  }

  try {
    const created = await prisma.company.create({
      data: {
        workspaceId,
        name,
        normalizedName,
        domain,
        website,
        industry,
        industryConfidence: industry ? (document.company.industry ? 0.7 : inferred.confidence) : null,
        location: document.company.location ?? null,
        employeeCount,
        employeeRange: employeeCount ? `${employeeCount.toLocaleString()} employees` : null,
        sizeSource: employeeCount ? "Self-reported on a public page" : null,
        description: document.company.description ? truncateEvidence(document.company.description, 1000) : null,
        isDemo: false,
        createdAt: now,
      },
    });
    return { id: created.id, created: true };
  } catch {
    const fallback = await prisma.company.findFirst({ where: { workspaceId, normalizedName } });
    if (fallback) return { id: fallback.id, created: false };
    throw new Error(`Could not persist company “${name}”.`);
  }
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
    take: 6,
  });

  const summaries: SourceRunSummary[] = [];
  const globalWarnings: string[] = [];

  if (sources.length === 0) {
    throw new Error("No enabled sources. Add an RSS feed, job feed or URL on the Signal sources page first.");
  }

  for (const source of sources) {
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
      const result = await runConnector(source.type, source.config, connectorIcp, now);
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

        const company = await upsertCompany(workspace.id, document, connectorIcp, now);
        if (!company) {
          summary.warnings.push(`Skipped “${document.title.slice(0, 80)}” — company name could not be normalised.`);
          continue;
        }
        if (company.created) summary.companiesCreated += 1;

        let keptOne = false;
        for (const candidate of candidates.slice(0, 2)) {
          const key = dedupeKey(companyKey(document.company.name), candidate.type, document.url);
          const existing = await prisma.signal.findUnique({
            where: { workspaceId_dedupeKey: { workspaceId: workspace.id, dedupeKey: key } },
            select: { id: true },
          });
          if (existing) {
            summary.duplicates += 1;
            continue;
          }
          await prisma.signal.create({
            data: {
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
              dataMode: "LIVE",
              dedupeKey: key,
              raw: JSON.parse(
                JSON.stringify({
                  connector: document.sourceType,
                  signalLabel: candidate.label,
                  tags: document.tags?.slice(0, 12) ?? [],
                  ...(document.metadata ?? {}),
                }),
              ) as Prisma.InputJsonValue,
            },
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
