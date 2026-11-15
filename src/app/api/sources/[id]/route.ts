import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiOk, assertSameOrigin, parseJson, withWorkspace } from "@/lib/api";
import { parseSourceConfig } from "@/lib/connectors";
import { prisma } from "@/lib/db";
import type { Prisma, SourceType } from "@prisma/client";

const patchSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  enabled: z.boolean().optional(),
  config: z.record(z.unknown()).optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!assertSameOrigin(request)) return apiError("Cross-site request blocked.", 403, "FORBIDDEN");
  return withWorkspace(async (workspace) => {
    const { id } = await params;
    const source = await prisma.source.findFirst({ where: { id, workspaceId: workspace.id } });
    if (!source) return apiError("Source not found.", 404, "NOT_FOUND");
    const payload = await parseJson(request, patchSchema);

    let config: Prisma.InputJsonValue = (source.config ?? {}) as Prisma.InputJsonValue;
    if (payload.config) {
      const parsed = parseSourceConfig(source.type as SourceType, payload.config);
      if (!parsed.success) {
        return apiError(parsed.error.issues[0]?.message ?? "Invalid connector configuration.", 422, "VALIDATION_ERROR");
      }
      config = parsed.data as Prisma.InputJsonValue;
    }

    const updated = await prisma.source.update({
      where: { id: source.id },
      data: {
        name: payload.name ?? source.name,
        enabled: payload.enabled ?? source.enabled,
        config,
      },
    });
    return apiOk({ source: updated });
  });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!assertSameOrigin(request)) return apiError("Cross-site request blocked.", 403, "FORBIDDEN");
  return withWorkspace(async (workspace) => {
    const { id } = await params;
    const source = await prisma.source.findFirst({ where: { id, workspaceId: workspace.id } });
    if (!source) return apiError("Source not found.", 404, "NOT_FOUND");
    await prisma.source.delete({ where: { id: source.id } });
    return apiOk({ deleted: true });
  });
}
