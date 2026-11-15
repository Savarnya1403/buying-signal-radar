import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiOk, assertSameOrigin, parseJson, withWorkspace } from "@/lib/api";
import { prisma } from "@/lib/db";

const schema = z.object({ name: z.string().trim().min(1).max(120) });

export async function PATCH(request: NextRequest) {
  if (!assertSameOrigin(request)) return apiError("Cross-site request blocked.", 403, "FORBIDDEN");
  return withWorkspace(async (workspace) => {
    const payload = await parseJson(request, schema);
    const updated = await prisma.workspace.update({
      where: { id: workspace.id },
      data: { name: payload.name },
    });
    return apiOk({ workspace: { id: updated.id, name: updated.name } });
  });
}
