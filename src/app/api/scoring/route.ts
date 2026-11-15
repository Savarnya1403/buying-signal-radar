import { NextRequest } from "next/server";
import { apiError, apiOk, assertSameOrigin, parseJson, withWorkspace } from "@/lib/api";
import { saveScoringConfig } from "@/lib/workspace";
import { scoringConfigSchema } from "@/lib/scoring/config";
import { rescoreWorkspace } from "@/lib/scoring/service";
import { prisma } from "@/lib/db";

export async function PUT(request: NextRequest) {
  if (!assertSameOrigin(request)) return apiError("Cross-site request blocked.", 403, "FORBIDDEN");
  return withWorkspace(async (workspace) => {
    const config = await parseJson(request, scoringConfigSchema);
    if (config.priorityIcpWeight + config.prioritySignalWeight === 0) {
      return apiError("Priority weights cannot both be zero.", 422, "VALIDATION_ERROR");
    }
    const saved = await saveScoringConfig(workspace.id, config);
    const icp = await prisma.icpProfile.findFirst({
      where: { workspaceId: workspace.id, isConfirmed: true },
      orderBy: { createdAt: "desc" },
    });
    const scoring = icp ? await rescoreWorkspace(workspace.id, icp.id) : { scored: 0 };
    return apiOk({ profile: saved, rescored: scoring.scored });
  });
}
