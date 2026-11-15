import { NextRequest } from "next/server";
import { apiError, apiOk, assertSameOrigin, rateLimit, rateLimitResponse, withWorkspace } from "@/lib/api";
import { prisma } from "@/lib/db";
import { testSourceConnection } from "@/lib/discovery/pipeline";
import type { SourceType } from "@prisma/client";

export const maxDuration = 30;

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!assertSameOrigin(request)) return apiError("Cross-site request blocked.", 403, "FORBIDDEN");
  return withWorkspace(async (workspace) => {
    const limit = rateLimit(`source-test:${workspace.id}`, 20, 60_000);
    if (!limit.allowed) return rateLimitResponse(limit.resetAt);

    const { id } = await params;
    const source = await prisma.source.findFirst({ where: { id, workspaceId: workspace.id } });
    if (!source) return apiError("Source not found.", 404, "NOT_FOUND");
    const icp = await prisma.icpProfile.findFirst({
      where: { workspaceId: workspace.id, isConfirmed: true },
      orderBy: { createdAt: "desc" },
    });

    try {
      const result = await testSourceConnection(source.type as SourceType, source.config, {
        productCategory: icp?.productCategory ?? "B2B software",
        targetIndustries: icp?.targetIndustries ?? [],
        buyerRoles: icp?.buyerRoles ?? [],
        geographies: icp?.geographies ?? [],
        selectedSignalTypes: icp?.selectedSignalTypes ?? [],
      });
      return apiOk({ result });
    } catch (error) {
      return apiError(error instanceof Error ? error.message : "Connection test failed.", 502, "CONNECTOR_ERROR");
    }
  });
}
