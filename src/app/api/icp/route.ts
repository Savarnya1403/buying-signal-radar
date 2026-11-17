import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiError, apiOk, assertSameOrigin, parseJson, withWorkspace } from "@/lib/api";
import type { Prisma } from "@prisma/client";
import { SIGNAL_TYPES } from "@/lib/signals";
import { buildDefaultSources } from "@/lib/connectors";
import { rescoreWorkspace } from "@/lib/scoring/service";

const schema = z.object({
  productDescription: z.string().trim().min(20).max(6000),
  productCategory: z.string().trim().min(2).max(160),
  targetIndustries: z.array(z.string().trim().min(1).max(80)).min(1).max(20),
  companySizeMin: z.number().int().min(0).max(1_000_000).nullable(),
  companySizeMax: z.number().int().min(1).max(1_000_000).nullable(),
  geographies: z.array(z.string().trim().min(1).max(80)).max(30),
  buyerRoles: z.array(z.string().trim().min(1).max(80)).max(20),
  painPoints: z.array(z.string().trim().min(1).max(160)).max(20),
  buyingTriggers: z.array(z.string().trim().min(1).max(80)).max(20),
  exclusions: z.array(z.string().trim().min(1).max(240)).max(20),
  selectedSignalTypes: z.array(z.enum(SIGNAL_TYPES)).min(1).max(SIGNAL_TYPES.length),
  discoveryPeriodDays: z.number().int().min(1).max(365),
  confidence: z.number().min(0).max(1).optional(),
  rationale: z.unknown().optional(),
});

export async function GET() {
  return withWorkspace(async (workspace) => {
    const icp = await prisma.icpProfile.findFirst({
      where: { workspaceId: workspace.id, isConfirmed: true },
      orderBy: { createdAt: "desc" },
    });
    return apiOk({ icp });
  });
}

export async function POST(request: NextRequest) {
  if (!assertSameOrigin(request)) return apiError("Cross-site request blocked.", 403, "FORBIDDEN");
  return withWorkspace(async (workspace) => {
    const payload = await parseJson(request, schema);
    if (payload.companySizeMin != null && payload.companySizeMax != null && payload.companySizeMin > payload.companySizeMax) {
      return apiError("Minimum company size cannot be greater than maximum.", 422, "VALIDATION_ERROR");
    }

    const existingIcp = await prisma.icpProfile.findFirst({
      where: { workspaceId: workspace.id },
      orderBy: { createdAt: "desc" },
      select: { version: true },
    });

    const icp = await prisma.icpProfile.create({
      data: {
        workspaceId: workspace.id,
        productDescription: payload.productDescription,
        productCategory: payload.productCategory,
        targetIndustries: payload.targetIndustries,
        companySizeMin: payload.companySizeMin,
        companySizeMax: payload.companySizeMax,
        geographies: payload.geographies,
        buyerRoles: payload.buyerRoles,
        painPoints: payload.painPoints,
        buyingTriggers: payload.buyingTriggers,
        exclusions: payload.exclusions,
        selectedSignalTypes: payload.selectedSignalTypes,
        discoveryPeriodDays: payload.discoveryPeriodDays,
        confidence: payload.confidence ?? 0.5,
        rationale: (payload.rationale ?? {}) as Prisma.InputJsonValue,
        isConfirmed: true,
        version: (existingIcp?.version ?? 0) + 1,
      },
    });

    const existingSources = await prisma.source.count({ where: { workspaceId: workspace.id } });
    let sourcesCreated = 0;
    if (existingSources === 0) {
      const defaults = buildDefaultSources({
        productCategory: icp.productCategory,
        targetIndustries: icp.targetIndustries,
        buyerRoles: icp.buyerRoles,
        geographies: icp.geographies,
        selectedSignalTypes: icp.selectedSignalTypes,
      });
      for (const source of defaults) {
        await prisma.source.create({
          data: {
            workspaceId: workspace.id,
            type: source.type,
            name: source.name,
            url: source.url,
            config: source.config as Prisma.InputJsonValue,
          },
        });
        sourcesCreated += 1;
      }
    }

    const scoring = await rescoreWorkspace(workspace.id, icp.id);
    return apiOk({ icp, sourcesCreated, prospectsScored: scoring.scored }, 201);
  });
}
