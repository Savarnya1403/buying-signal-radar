import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiOk, assertSameOrigin, parseJson, withWorkspace } from "@/lib/api";
import { prisma } from "@/lib/db";
import { rescoreWorkspace } from "@/lib/scoring/service";

const schema = z.object({
  status: z.enum(["NEW", "SAVED", "CONTACTED", "DISQUALIFIED"]).optional(),
  notes: z.string().max(4000).optional().nullable(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!assertSameOrigin(request)) return apiError("Cross-site request blocked.", 403, "FORBIDDEN");
  return withWorkspace(async (workspace) => {
    const { id } = await params;
    const prospect = await prisma.prospect.findFirst({ where: { id, workspaceId: workspace.id } });
    if (!prospect) return apiError("Prospect not found.", 404, "NOT_FOUND");
    const payload = await parseJson(request, schema);

    const now = new Date();
    const updated = await prisma.prospect.update({
      where: { id: prospect.id },
      data: {
        status: payload.status ?? prospect.status,
        notes: payload.notes === undefined ? prospect.notes : payload.notes,
        savedAt:
          payload.status === "SAVED" && !prospect.savedAt
            ? now
            : payload.status && payload.status !== "SAVED"
              ? prospect.savedAt
              : prospect.savedAt,
        contactedAt:
          payload.status === "CONTACTED" && !prospect.contactedAt
            ? now
            : payload.status && payload.status !== "CONTACTED"
              ? prospect.contactedAt
              : prospect.contactedAt,
      },
    });

    if (payload.status === "DISQUALIFIED") {
      await rescoreWorkspace(workspace.id, prospect.icpProfileId);
    }

    return apiOk({ prospect: updated });
  });
}
