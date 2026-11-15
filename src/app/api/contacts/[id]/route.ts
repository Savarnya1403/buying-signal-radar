import { NextRequest } from "next/server";
import { apiError, apiOk, assertSameOrigin, withWorkspace } from "@/lib/api";
import { prisma } from "@/lib/db";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!assertSameOrigin(request)) return apiError("Cross-site request blocked.", 403, "FORBIDDEN");
  return withWorkspace(async (workspace) => {
    const { id } = await params;
    const contact = await prisma.contact.findFirst({ where: { id, workspaceId: workspace.id } });
    if (!contact) return apiError("Contact not found.", 404, "NOT_FOUND");
    await prisma.contact.delete({ where: { id: contact.id } });
    return apiOk({ deleted: true });
  });
}
