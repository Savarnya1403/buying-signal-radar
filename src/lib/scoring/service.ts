import "server-only";
import type { SignalType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { scoreProspect, type ScoringSignal } from "@/lib/scoring/score";
import { getScoringConfig } from "@/lib/workspace";

export async function rescoreWorkspace(workspaceId: string, icpId?: string) {
  const icp = icpId
    ? await prisma.icpProfile.findFirst({ where: { id: icpId, workspaceId } })
    : await prisma.icpProfile.findFirst({
        where: { workspaceId, isConfirmed: true },
        orderBy: { createdAt: "desc" },
      });

  if (!icp) return { scored: 0, reason: "no-icp" as const };

  const config = await getScoringConfig(workspaceId);
  const companies = await prisma.company.findMany({
    where: { workspaceId },
    include: {
      signals: { orderBy: [{ publishedAt: "desc" }, { discoveredAt: "desc" }] },
      prospects: { where: { icpProfileId: icp.id } },
    },
  });

  let scored = 0;
  for (const company of companies) {
    if (company.signals.length === 0) continue;
    const signals: ScoringSignal[] = company.signals.map((signal) => ({
      id: signal.id,
      type: signal.type,
      title: signal.title,
      summary: signal.summary,
      evidence: signal.evidence,
      confidence: signal.confidence,
      publishedAt: signal.publishedAt,
      discoveredAt: signal.discoveredAt,
      sourceUrl: signal.sourceUrl,
      sourceName: signal.sourceName,
    }));

    const result = scoreProspect(
      {
        targetIndustries: icp.targetIndustries,
        geographies: icp.geographies,
        companySizeMin: icp.companySizeMin,
        companySizeMax: icp.companySizeMax,
        buyerRoles: icp.buyerRoles,
        painPoints: icp.painPoints,
        buyingTriggers: icp.buyingTriggers,
        exclusions: icp.exclusions,
        selectedSignalTypes: icp.selectedSignalTypes as SignalType[],
      },
      {
        name: company.name,
        industry: company.industry,
        location: company.location,
        employeeCount: company.employeeCount,
        employeeRange: company.employeeRange,
        description: company.description,
      },
      signals,
      config,
    );

    const lastSignalAt = company.signals.reduce<Date | null>((latest, signal) => {
      const date = signal.publishedAt ?? signal.discoveredAt;
      return !latest || date > latest ? date : latest;
    }, null);

    await prisma.prospect.upsert({
      where: {
        workspaceId_companyId_icpProfileId: {
          workspaceId,
          companyId: company.id,
          icpProfileId: icp.id,
        },
      },
      update: {
        icpScore: result.icpScore,
        signalScore: result.signalScore,
        priorityScore: result.priorityScore,
        scoreBreakdown: result.breakdown as object,
        lastSignalAt,
        lastScoredAt: new Date(),
      },
      create: {
        workspaceId,
        companyId: company.id,
        icpProfileId: icp.id,
        icpScore: result.icpScore,
        signalScore: result.signalScore,
        priorityScore: result.priorityScore,
        scoreBreakdown: result.breakdown as object,
        lastSignalAt,
      },
    });
    scored += 1;
  }

  return { scored, reason: "ok" as const };
}
