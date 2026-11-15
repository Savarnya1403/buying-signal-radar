import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiError, apiOk, assertSameOrigin, parseJson, rateLimit, rateLimitResponse, withWorkspace } from "@/lib/api";
import { runDiscovery } from "@/lib/discovery/pipeline";

export const maxDuration = 60;

const schema = z.object({
  icpId: z.string().min(1).max(64).optional(),
  sourceIds: z.array(z.string().min(1).max(64)).max(10).optional(),
  periodDays: z.number().int().min(1).max(365).optional(),
});

export async function POST(request: NextRequest) {
  if (!assertSameOrigin(request)) return apiError("Cross-site request blocked.", 403, "FORBIDDEN");
  return withWorkspace(async (workspace) => {
    const limit = rateLimit(`discovery:${workspace.id}`, 6, 10 * 60_000);
    if (!limit.allowed) return rateLimitResponse(limit.resetAt);

    const payload = await parseJson(request, schema);
    const icp = payload.icpId
      ? await prisma.icpProfile.findFirst({ where: { id: payload.icpId, workspaceId: workspace.id, isConfirmed: true } })
      : await prisma.icpProfile.findFirst({
          where: { workspaceId: workspace.id, isConfirmed: true },
          orderBy: { createdAt: "desc" },
        });
    if (!icp) return apiError("Confirm an ICP before running discovery.", 409, "NO_ICP");

    const enabledSources = await prisma.source.count({
      where: { workspaceId: workspace.id, enabled: true },
    });
    if (enabledSources === 0) {
      return apiError("Add at least one enabled source before running discovery.", 409, "NO_SOURCES");
    }

    try {
      const summary = await runDiscovery({
        workspaceId: workspace.id,
        icpId: icp.id,
        sourceIds: payload.sourceIds,
        periodDays: payload.periodDays ?? icp.discoveryPeriodDays,
        trigger: "manual",
      });
      return apiOk({ summary });
    } catch (error) {
      return apiError(
        error instanceof Error ? error.message : "Discovery failed unexpectedly.",
        502,
        "DISCOVERY_FAILED",
      );
    }
  });
}
