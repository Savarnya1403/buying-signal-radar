import { NextRequest } from "next/server";
import { randomBytes } from "node:crypto";
import { apiError, apiOk, assertSameOrigin, withWorkspace } from "@/lib/api";
import { prisma } from "@/lib/db";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!assertSameOrigin(request)) return apiError("Cross-site request blocked.", 403, "FORBIDDEN");
  return withWorkspace(async (workspace) => {
    const { id } = await params;
    const report = await prisma.report.findFirst({ where: { id, workspaceId: workspace.id } });
    if (!report) return apiError("Report not found.", 404, "NOT_FOUND");
    await prisma.report.delete({ where: { id: report.id } });
    return apiOk({ deleted: true });
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!assertSameOrigin(request)) return apiError("Cross-site request blocked.", 403, "FORBIDDEN");
  return withWorkspace(async (workspace) => {
    const { id } = await params;
    const report = await prisma.report.findFirst({ where: { id, workspaceId: workspace.id } });
    if (!report) return apiError("Report not found.", 404, "NOT_FOUND");

    const rotated = await prisma.report.update({
      where: { id: report.id },
      data: { token: randomBytes(18).toString("base64url") },
    });
    return apiOk({ report: rotated, path: `/r/${rotated.token}` });
  });
}
