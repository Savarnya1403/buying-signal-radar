import "server-only";
import { createHash } from "node:crypto";
import type { Prisma, SignalType, SourceType } from "@prisma/client";
import dataset from "../../../data/demo/dataset.json";
import { prisma } from "@/lib/db";
import { companyKey } from "@/lib/connectors/extraction";
import { rescoreWorkspace } from "@/lib/scoring/service";

type DemoCompany = (typeof dataset.companies)[number];
type DemoSignal = (typeof dataset.signals)[number];
type DemoContact = (typeof dataset.contacts)[number];
type DemoRelationship = (typeof dataset.relationships)[number];

export const DEMO_DATASET_VERSION = "2026-11-v1";

function demoDedupeKey(signal: DemoSignal, index: number) {
  return createHash("sha256").update(`demo|${DEMO_DATASET_VERSION}|${signal.company}|${signal.type}|${signal.title}|${index}`).digest("hex");
}

function signalSourceType(type: string): SourceType {
  if (type === "HIRING") return "JOB_FEED";
  if (type === "PRODUCT_LAUNCH") return "WEBSITE";
  return "RSS";
}

export async function seedDemoWorkspace(workspaceId: string, options: { reset?: boolean } = {}) {
  const workspace = await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } });
  if (workspace.demoSeededAt && !options.reset) {
    return {
      seeded: false,
      alreadySeeded: true,
      companies: dataset.companies.length,
      signals: dataset.signals.length,
      contacts: dataset.contacts.length,
    };
  }

  if (options.reset) {
    await resetDemoWorkspace(workspaceId);
  }

  const confirmed = await prisma.icpProfile.findFirst({
    where: { workspaceId, isConfirmed: true },
    orderBy: { createdAt: "desc" },
  });

  let icpId = confirmed?.id;
  if (!icpId) {
    const icp = await prisma.icpProfile.create({
      data: {
        workspaceId,
        productDescription: dataset.icp.productDescription,
        productCategory: dataset.icp.productCategory,
        targetIndustries: dataset.icp.targetIndustries,
        companySizeMin: dataset.icp.companySizeMin,
        companySizeMax: dataset.icp.companySizeMax,
        geographies: dataset.icp.geographies,
        buyerRoles: dataset.icp.buyerRoles,
        painPoints: dataset.icp.painPoints,
        buyingTriggers: dataset.icp.buyingTriggers,
        exclusions: dataset.icp.exclusions,
        selectedSignalTypes: dataset.icp.selectedSignalTypes,
        discoveryPeriodDays: 30,
        confidence: dataset.icp.confidence,
        isConfirmed: true,
        isDemo: true,
        rationale: {
          note: "Synthetic demo ICP used to score the demo dataset. Edit it or describe your own product to replace it.",
          fields: [],
        },
      },
    });
    icpId = icp.id;
  }

  const now = new Date();
  const companyIds = new Map<string, string>();

  for (const company of dataset.companies as DemoCompany[]) {
    const normalizedName = companyKey(company.name);
    const existing = await prisma.company.findFirst({
      where: { workspaceId, OR: [{ normalizedName }, { domain: company.domain }] },
    });
    const record = existing ?? (await prisma.company.create({
      data: {
        workspaceId,
        name: company.name,
        normalizedName,
        domain: company.domain,
        website: `https://${company.domain}`,
        industry: company.industry,
        industryConfidence: 0.9,
        location: company.location,
        employeeCount: company.employeeCount,
        employeeRange: `${company.employeeCount.toLocaleString()} employees`,
        sizeSource: "Synthetic demo dataset",
        description: company.description,
        isDemo: true,
      },
    }));
    companyIds.set(company.slug, record.id);
  }

  let signalsCreated = 0;
  let signalsSkipped = 0;
  for (const [index, signal] of (dataset.signals as DemoSignal[]).entries()) {
    const companyId = companyIds.get(signal.company);
    if (!companyId) continue;
    const key = demoDedupeKey(signal, index);
    const exists = await prisma.signal.findUnique({
      where: { workspaceId_dedupeKey: { workspaceId, dedupeKey: key } },
      select: { id: true },
    });
    if (exists) {
      signalsSkipped += 1;
      continue;
    }
    const publishedAt = new Date(now.getTime() - signal.daysAgo * 86_400_000);
    await prisma.signal.create({
      data: {
        workspaceId,
        companyId,
        type: signal.type as SignalType,
        title: signal.title,
        summary: signal.summary,
        evidence: signal.evidence,
        sourceUrl: `https://example.com/demo/${signal.company}/${signal.type.toLowerCase()}-${index + 1}`,
        sourceName: signal.sourceName,
        sourceType: signalSourceType(signal.type),
        publishedAt,
        discoveredAt: now,
        confidence: signal.confidence,
        dataMode: "DEMO",
        dedupeKey: key,
        raw: { demo: true, datasetVersion: DEMO_DATASET_VERSION } as Prisma.InputJsonValue,
      },
    });
    signalsCreated += 1;
  }

  const contactIds = new Map<string, string>();
  for (const contact of dataset.contacts as DemoContact[]) {
    const existing = await prisma.contact.findFirst({
      where: { workspaceId, email: contact.email },
    });
    const companyName = contact.company;
    const matchedCompany = await prisma.company.findFirst({
      where: { workspaceId, normalizedName: companyKey(companyName) },
    });
    const record = existing ?? (await prisma.contact.create({
      data: {
        workspaceId,
        name: contact.name,
        email: contact.email,
        companyName,
        companyId: matchedCompany?.id ?? null,
        jobTitle: contact.jobTitle,
        relationshipType: contact.relationshipType,
        strength: contact.strength,
        verified: contact.verified,
        firstDegree: (contact as { firstDegree?: boolean }).firstDegree ?? true,
        notes: contact.notes,
        source: "MANUAL",
        isDemo: true,
      },
    }));
    contactIds.set(contact.name, record.id);
  }

  let relationshipsCreated = 0;
  for (const relationship of dataset.relationships as DemoRelationship[]) {
    const fromContactId = contactIds.get(relationship.from);
    const toContactId = contactIds.get(relationship.to);
    if (!fromContactId || !toContactId) continue;
    const exists = await prisma.relationship.findUnique({
      where: { workspaceId_fromContactId_toContactId: { workspaceId, fromContactId, toContactId } },
    });
    if (exists) continue;
    await prisma.relationship.create({
      data: {
        workspaceId,
        fromContactId,
        toContactId,
        relationshipType: relationship.type,
        strength: relationship.strength,
        verified: relationship.verified,
        notes: relationship.notes,
        source: relationship.verified ? "VERIFIED" : "MANUAL",
        isDemo: true,
      },
    });
    relationshipsCreated += 1;
  }

  await prisma.workspace.update({ where: { id: workspaceId }, data: { demoSeededAt: new Date() } });
  const scoring = await rescoreWorkspace(workspaceId, icpId);

  return {
    seeded: true,
    alreadySeeded: false,
    icpId,
    companies: dataset.companies.length,
    signals: signalsCreated,
    signalsSkipped,
    contacts: dataset.contacts.length,
    relationships: relationshipsCreated,
    prospectsScored: scoring.scored,
  };
}

export async function resetDemoWorkspace(workspaceId: string) {
  const demoCompanies = await prisma.company.findMany({ where: { workspaceId, isDemo: true }, select: { id: true } });
  const demoContacts = await prisma.contact.findMany({ where: { workspaceId, isDemo: true }, select: { id: true } });
  const demoReports = await prisma.report.findMany({ where: { workspaceId, dataMode: "DEMO" }, select: { id: true } });
  const demoIcp = await prisma.icpProfile.findMany({ where: { workspaceId, isDemo: true }, select: { id: true } });

  await prisma.report.deleteMany({ where: { id: { in: demoReports.map((report) => report.id) } } });
  await prisma.relationship.deleteMany({
    where: {
      workspaceId,
      OR: [
        { fromContactId: { in: demoContacts.map((contact) => contact.id) } },
        { toContactId: { in: demoContacts.map((contact) => contact.id) } },
        { isDemo: true },
      ],
    },
  });
  await prisma.contact.deleteMany({ where: { workspaceId, isDemo: true } });
  await prisma.prospect.deleteMany({ where: { workspaceId, companyId: { in: demoCompanies.map((company) => company.id) } } });
  await prisma.signal.deleteMany({ where: { workspaceId, dataMode: "DEMO" } });
  await prisma.company.deleteMany({ where: { workspaceId, isDemo: true } });
  await prisma.icpProfile.deleteMany({ where: { id: { in: demoIcp.map((icp) => icp.id) } } });
  await prisma.workspace.update({ where: { id: workspaceId }, data: { demoSeededAt: null } }).catch(() => undefined);

  return {
    removedCompanies: demoCompanies.length,
    removedContacts: demoContacts.length,
    removedReports: demoReports.length,
  };
}
