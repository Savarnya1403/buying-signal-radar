import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiOk, assertSameOrigin, parseJson, withWorkspace } from "@/lib/api";
import { prisma } from "@/lib/db";

const schema = z.object({
  fromContactId: z.string().min(1).max(64),
  toContactId: z.string().min(1).max(64),
  relationshipType: z.string().trim().min(1).max(60).default("Knows"),
  strength: z.number().int().min(1).max(5).default(3),
  verified: z.boolean().default(false),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
});

export async function POST(request: NextRequest) {
  if (!assertSameOrigin(request)) return apiError("Cross-site request blocked.", 403, "FORBIDDEN");
  return withWorkspace(async (workspace) => {
    const payload = await parseJson(request, schema);
    if (payload.fromContactId === payload.toContactId) {
      return apiError("A contact cannot be related to themselves.", 422, "VALIDATION_ERROR");
    }
    const contacts = await prisma.contact.findMany({
      where: { workspaceId: workspace.id, id: { in: [payload.fromContactId, payload.toContactId] } },
      select: { id: true },
    });
    if (contacts.length !== 2) return apiError("Both contacts must exist in this workspace.", 404, "NOT_FOUND");

    const exists = await prisma.relationship.findFirst({
      where: {
        workspaceId: workspace.id,
        OR: [
          { fromContactId: payload.fromContactId, toContactId: payload.toContactId },
          { fromContactId: payload.toContactId, toContactId: payload.fromContactId },
        ],
      },
    });
    if (exists) return apiError("That relationship already exists.", 409, "DUPLICATE");

    const relationship = await prisma.relationship.create({
      data: {
        workspaceId: workspace.id,
        fromContactId: payload.fromContactId,
        toContactId: payload.toContactId,
        relationshipType: payload.relationshipType,
        strength: payload.strength,
        verified: payload.verified,
        notes: payload.notes || null,
        source: payload.verified ? "VERIFIED" : "MANUAL",
      },
    });
    return apiOk({ relationship }, 201);
  });
}

export async function DELETE(request: NextRequest) {
  if (!assertSameOrigin(request)) return apiError("Cross-site request blocked.", 403, "FORBIDDEN");
  return withWorkspace(async (workspace) => {
    const id = request.nextUrl.searchParams.get("id");
    if (!id) return apiError("Relationship id is required.", 422, "VALIDATION_ERROR");
    const relationship = await prisma.relationship.findFirst({ where: { id, workspaceId: workspace.id } });
    if (!relationship) return apiError("Relationship not found.", 404, "NOT_FOUND");
    await prisma.relationship.delete({ where: { id: relationship.id } });
    return apiOk({ deleted: true });
  });
}
