import { NextRequest } from "next/server";
import { apiError, apiOk, withWorkspace } from "@/lib/api";
import { prisma } from "@/lib/db";
import { findIntroPaths } from "@/lib/graph/paths";

export async function GET(request: NextRequest) {
  return withWorkspace(async (workspace) => {
    const companyId = request.nextUrl.searchParams.get("companyId");
    const verifiedOnly = request.nextUrl.searchParams.get("verifiedOnly") === "true";
    if (!companyId) return apiError("companyId is required.", 422, "VALIDATION_ERROR");

    const [contacts, relationships, company] = await Promise.all([
      prisma.contact.findMany({ where: { workspaceId: workspace.id } }),
      prisma.relationship.findMany({ where: { workspaceId: workspace.id } }),
      prisma.company.findFirst({ where: { id: companyId, workspaceId: workspace.id } }),
    ]);
    if (!company) return apiError("Company not found.", 404, "NOT_FOUND");

    const graph = {
      contacts: contacts.map((contact) => ({
        id: contact.id,
        name: contact.name,
        companyId: contact.companyId,
        companyName: contact.companyName,
        jobTitle: contact.jobTitle,
        verified: contact.verified,
        strength: contact.strength,
        firstDegree: contact.firstDegree,
        relationshipType: contact.relationshipType,
      })),
      relationships: relationships.map((relationship) => ({
        id: relationship.id,
        fromContactId: relationship.fromContactId,
        toContactId: relationship.toContactId,
        relationshipType: relationship.relationshipType,
        strength: relationship.strength,
        verified: relationship.verified,
      })),
      companies: [{ id: company.id, name: company.name }],
    };

    return apiOk({ paths: findIntroPaths(graph, company.id, { verifiedOnly, limit: 3 }) });
  });
}
