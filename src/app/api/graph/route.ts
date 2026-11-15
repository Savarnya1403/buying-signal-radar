import { apiOk, withWorkspace } from "@/lib/api";
import { prisma } from "@/lib/db";

export async function GET() {
  return withWorkspace(async (workspace) => {
    const [contacts, relationships, companies] = await Promise.all([
      prisma.contact.findMany({ where: { workspaceId: workspace.id }, orderBy: { name: "asc" } }),
      prisma.relationship.findMany({ where: { workspaceId: workspace.id } }),
      prisma.company.findMany({
        where: { workspaceId: workspace.id },
        select: { id: true, name: true, domain: true, industry: true },
        orderBy: { name: "asc" },
      }),
    ]);

    const linkedCompanyIds = new Set(contacts.map((contact) => contact.companyId).filter(Boolean));
    return apiOk({
      contacts,
      relationships,
      companies: companies.filter((company) => linkedCompanyIds.has(company.id)),
      stats: {
        contacts: contacts.length,
        relationships: relationships.length,
        verified: relationships.filter((relationship) => relationship.verified).length,
        linkedCompanies: linkedCompanyIds.size,
      },
    });
  });
}
