import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiOk, assertSameOrigin, parseJson, withWorkspace } from "@/lib/api";
import { prisma } from "@/lib/db";
import { companyKey } from "@/lib/connectors/extraction";
import { domainFromEmail } from "@/lib/contacts/csv";

const contactSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(254).optional().or(z.literal("")),
  companyName: z.string().trim().max(160).optional().or(z.literal("")),
  jobTitle: z.string().trim().max(160).optional().or(z.literal("")),
  relationshipType: z.string().trim().min(1).max(60).default("Professional"),
  strength: z.number().int().min(1).max(5).default(3),
  verified: z.boolean().default(false),
  firstDegree: z.boolean().default(true),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
  linkedinUrl: z.string().trim().max(500).optional().or(z.literal("")),
});

export async function GET() {
  return withWorkspace(async (workspace) => {
    const contacts = await prisma.contact.findMany({
      where: { workspaceId: workspace.id },
      include: { company: { select: { id: true, name: true, website: true, industry: true } } },
      orderBy: { createdAt: "desc" },
    });
    return apiOk({ contacts });
  });
}

export async function POST(request: NextRequest) {
  if (!assertSameOrigin(request)) return apiError("Cross-site request blocked.", 403, "FORBIDDEN");
  return withWorkspace(async (workspace) => {
    const payload = await parseJson(request, contactSchema);
    const domain = domainFromEmail(payload.email);
    const company = payload.companyName
      ? await prisma.company.findFirst({
          where: {
            workspaceId: workspace.id,
            OR: [
              { normalizedName: companyKey(payload.companyName) },
              ...(domain ? [{ domain }] : []),
            ],
          },
        })
      : domain
        ? await prisma.company.findFirst({ where: { workspaceId: workspace.id, domain } })
        : null;

    if (payload.linkedinUrl && !/^https?:\/\/(www\.)?linkedin\.com\//i.test(payload.linkedinUrl)) {
      return apiError("Only manual LinkedIn profile URLs are accepted.", 422, "VALIDATION_ERROR");
    }

    const contact = await prisma.contact.create({
      data: {
        workspaceId: workspace.id,
        name: payload.name,
        email: payload.email || null,
        companyName: payload.companyName || company?.name || null,
        companyId: company?.id ?? null,
        jobTitle: payload.jobTitle || null,
        relationshipType: payload.relationshipType,
        strength: payload.strength,
        verified: payload.verified,
        firstDegree: payload.firstDegree,
        notes: payload.notes || null,
        linkedinUrl: payload.linkedinUrl || null,
        source: "MANUAL",
      },
    });
    return apiOk({ contact }, 201);
  });
}
