import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiOk, assertSameOrigin, parseJson, rateLimit, rateLimitResponse, withWorkspace } from "@/lib/api";
import { prisma } from "@/lib/db";
import { parseContactsCsv, domainFromEmail } from "@/lib/contacts/csv";
import { companyKey } from "@/lib/connectors/extraction";

const schema = z.object({ csv: z.string().min(10).max(2_000_000) });

export async function POST(request: NextRequest) {
  if (!assertSameOrigin(request)) return apiError("Cross-site request blocked.", 403, "FORBIDDEN");
  return withWorkspace(async (workspace) => {
    const limit = rateLimit(`contacts-import:${workspace.id}`, 10, 10 * 60_000);
    if (!limit.allowed) return rateLimitResponse(limit.resetAt);

    const { csv } = await parseJson(request, schema);
    const parsed = parseContactsCsv(csv);
    if (parsed.rows.length === 0) {
      return apiError("No valid contacts found in that CSV.", 422, "NO_VALID_CONTACTS", parsed.errors);
    }

    const created: { id: string; name: string; email: string | null }[] = [];
    const skipped: { row: number; message: string }[] = [...parsed.errors];
    let duplicates = 0;
    let linkedToCompanies = 0;

    for (const [index, row] of parsed.rows.entries()) {
      const existing = row.email
        ? await prisma.contact.findFirst({ where: { workspaceId: workspace.id, email: row.email } })
        : await prisma.contact.findFirst({
            where: {
              workspaceId: workspace.id,
              name: { equals: row.name, mode: "insensitive" },
              companyName: row.company || null,
            },
          });
      if (existing) {
        duplicates += 1;
        skipped.push({ row: index + 2, message: `${row.name} already exists — skipped duplicate.` });
        continue;
      }

      const domain = domainFromEmail(row.email);
      const company = row.company
        ? await prisma.company.findFirst({
            where: {
              workspaceId: workspace.id,
              OR: [{ normalizedName: companyKey(row.company) }, ...(domain ? [{ domain }] : [])],
            },
          })
        : domain
          ? await prisma.company.findFirst({ where: { workspaceId: workspace.id, domain } })
          : null;
      if (company) linkedToCompanies += 1;

      const contact = await prisma.contact.create({
        data: {
          workspaceId: workspace.id,
          name: row.name,
          email: row.email || null,
          companyName: row.company || company?.name || null,
          companyId: company?.id ?? null,
          jobTitle: row.jobTitle || null,
          relationshipType: row.relationshipType || "Imported",
          strength: row.strength,
          verified: row.verified,
          firstDegree: row.firstDegree,
          notes: row.notes || null,
          linkedinUrl: row.linkedinUrl || null,
          source: "CSV",
        },
      });
      created.push({ id: contact.id, name: contact.name, email: contact.email });
    }

    let relationshipsCreated = 0;
    const allContacts = await prisma.contact.findMany({
      where: { workspaceId: workspace.id },
      select: { id: true, name: true, email: true },
    });
    const byName = new Map(allContacts.map((contact) => [contact.name.toLowerCase(), contact.id]));
    const byEmail = new Map(allContacts.filter((contact) => contact.email).map((contact) => [contact.email!.toLowerCase(), contact.id]));

    for (const [index, row] of parsed.rows.entries()) {
      if (!row.knows) continue;
      const fromId = row.email ? byEmail.get(row.email.toLowerCase()) : byName.get(row.name.toLowerCase());
      if (!fromId) continue;
      const targets = row.knows.split(/[;|]/).map((value) => value.trim()).filter(Boolean);
      for (const target of targets) {
        const toId = byEmail.get(target.toLowerCase()) ?? byName.get(target.toLowerCase());
        if (!toId || toId === fromId) continue;
        const exists = await prisma.relationship.findFirst({
          where: {
            workspaceId: workspace.id,
            OR: [
              { fromContactId: fromId, toContactId: toId },
              { fromContactId: toId, toContactId: fromId },
            ],
          },
        });
        if (exists) continue;
        await prisma.relationship.create({
          data: {
            workspaceId: workspace.id,
            fromContactId: fromId,
            toContactId: toId,
            relationshipType: "Imported connection",
            strength: 3,
            verified: false,
            source: "CSV",
            notes: `Imported from row ${index + 2}.`,
          },
        });
        relationshipsCreated += 1;
      }
    }

    return apiOk({
      imported: created.length,
      duplicates,
      skipped: skipped.slice(0, 20),
      linkedToCompanies,
      relationshipsCreated,
      totalRows: parsed.rows.length + parsed.errors.length,
    }, 201);
  });
}
