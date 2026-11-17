import { NextRequest } from "next/server";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiError, apiOk, assertSameOrigin, parseJson, withWorkspace } from "@/lib/api";
import { SIGNAL_META } from "@/lib/signals";

const schema = z.object({
  title: z.string().trim().min(3).max(140).optional(),
});

export async function GET() {
  return withWorkspace(async (workspace) => {
    const reports = await prisma.report.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { createdAt: "desc" },
    });
    return apiOk({ reports });
  });
}

export async function POST(request: NextRequest) {
  if (!assertSameOrigin(request)) return apiError("Cross-site request blocked.", 403, "FORBIDDEN");
  return withWorkspace(async (workspace) => {
    const payload = await parseJson(request, schema);
    const icp = await prisma.icpProfile.findFirst({
      where: { workspaceId: workspace.id, isConfirmed: true },
      orderBy: { createdAt: "desc" },
    });
    if (!icp) return apiError("Confirm an ICP before publishing a report.", 409, "NO_ICP");

    const prospects = await prisma.prospect.findMany({
      where: {
        workspaceId: workspace.id,
        icpProfileId: icp.id,
        status: { not: "DISQUALIFIED" },
      },
      include: {
        company: {
          include: {
            signals: { orderBy: [{ publishedAt: "desc" }, { discoveredAt: "desc" }] },
          },
        },
      },
      orderBy: { priorityScore: "desc" },
      take: 50,
    });

    // Reports never contain contact, note or graph data either way.
    const included = prospects;
    if (included.length === 0) {
      return apiError("No prospects to include. Run discovery first.", 409, "NO_PROSPECTS");
    }

    const signalCounts = new Map<string, number>();
    for (const prospect of included) {
      for (const signal of prospect.company.signals) {
        const label = SIGNAL_META[signal.type].label;
        signalCounts.set(label, (signalCounts.get(label) ?? 0) + 1);
      }
    }

    const allDates = included
      .flatMap((prospect) => prospect.company.signals.map((signal) => signal.publishedAt ?? signal.discoveredAt))
      .filter((date): date is Date => Boolean(date));
    const dateRangeStart = allDates.length > 0 ? new Date(Math.min(...allDates.map((date) => date.getTime()))) : new Date(Date.now() - 30 * 86_400_000);
    const dateRangeEnd = allDates.length > 0 ? new Date(Math.max(...allDates.map((date) => date.getTime()))) : new Date();

    const rankings = included.map((prospect, index) => ({
      rank: index + 1,
      company: prospect.company.name,
      website: prospect.company.website,
      industry: prospect.company.industry ?? "Unverified",
      location: prospect.company.location ?? "Unverified",
      employeeCount: prospect.company.employeeCount,
      employeeRange: prospect.company.employeeRange,
      sizeSource: prospect.company.sizeSource,
      icpScore: prospect.icpScore,
      signalScore: prospect.signalScore,
      priorityScore: prospect.priorityScore,
      buyerRoleHypotheses: [
        ...new Set(
          prospect.company.signals.flatMap((signal) =>
            signal.title.match(/\b(VP|Head of|Chief|Director of)\s+[A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)?/g) ?? [],
          ),
        ),
      ].slice(0, 4),
      signals: prospect.company.signals.slice(0, 8).map((signal) => ({
        type: signal.type,
        label: SIGNAL_META[signal.type].label,
        title: signal.title,
        summary: signal.summary,
        sourceUrl: signal.sourceUrl,
        sourceName: signal.sourceName,
        publishedAt: signal.publishedAt?.toISOString() ?? null,
        discoveredAt: signal.discoveredAt.toISOString(),
        confidence: signal.confidence,
      })),
    }));

    const industry = icp.targetIndustries.slice(0, 3).join(" · ") || icp.productCategory;
    const title = payload.title ?? `${industry} buying-signal radar`;
    const token = randomBytes(18).toString("base64url");
    const payloadSnapshot = {
      generatedAt: new Date().toISOString(),
      productCategory: icp.productCategory,
      icp: {
        targetIndustries: icp.targetIndustries,
        geographies: icp.geographies,
        companySizeMin: icp.companySizeMin,
        companySizeMax: icp.companySizeMax,
        buyerRoles: icp.buyerRoles,
        selectedSignalTypes: icp.selectedSignalTypes,
      },
      signalBreakdown: Object.fromEntries(signalCounts),
      disclaimer:
        "Scores are ICP-fit and buying-signal indices, not probabilities of purchase. Estimates and unverified fields are labelled. This report contains no contacts, notes or referral-graph data.",
    };

    const report = await prisma.report.create({
      data: {
        workspaceId: workspace.id,
        token,
        title,
        industry,
        companyCount: included.length,
        signalBreakdown: Object.fromEntries(signalCounts),
        rankings,
        payload: payloadSnapshot,
        dateRangeStart,
        dateRangeEnd,
      },
    });

    return apiOk({ report, path: `/r/${token}` }, 201);
  });
}
