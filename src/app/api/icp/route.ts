import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiError, apiOk, assertSameOrigin, parseJson, withWorkspace } from "@/lib/api";
import type { Prisma } from "@prisma/client";
import { SIGNAL_TYPES } from "@/lib/signals";
import { buildDefaultSources, isManagedDefaultSourceName } from "@/lib/connectors";
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

    // Defaults are refreshed on every confirmation, not only for brand-new
    // workspaces. Otherwise switching an ICP to India never adds Indian sources.
    const defaults = buildDefaultSources({
      productCategory: icp.productCategory,
      targetIndustries: icp.targetIndustries,
      buyerRoles: icp.buyerRoles,
      geographies: icp.geographies,
      selectedSignalTypes: icp.selectedSignalTypes,
    });
    const existingSources = await prisma.source.findMany({
      where: { workspaceId: workspace.id },
      select: { id: true, name: true },
    });
    const existingByName = new Map(existingSources.map((source) => [source.name, source.id]));
    const missing = defaults.filter((source) => !existingByName.has(source.name));

    if (missing.length > 0) {
      await prisma.source.createMany({
        data: missing.map((source) => ({
          workspaceId: workspace.id,
          type: source.type,
          name: source.name,
          url: source.url,
          config: source.config as Prisma.InputJsonValue,
        })),
      });
    }

    // Managed defaults keep their config in step with the current ICP (industry
    // tag, hiring watchlist) without touching sources the user added.
    await Promise.all(
      defaults
        .filter((source) => existingByName.has(source.name))
        .map((source) =>
          prisma.source.update({
            where: { id: existingByName.get(source.name) as string },
            data: { url: source.url, config: source.config as Prisma.InputJsonValue },
          }),
        ),
    );

    // Disable managed defaults that no longer fit the selected geography or
    // industry. They stay in the workspace so the user can re-enable them.
    const keep = new Set(defaults.map((source) => source.name));
    const stale = existingSources.filter((source) => isManagedDefaultSourceName(source.name) && !keep.has(source.name));
    if (stale.length > 0) {
      await prisma.source.updateMany({
        where: { id: { in: stale.map((source) => source.id) } },
        data: { enabled: false },
      });
    }

    const sourcesCreated = missing.length;

    const scoring = await rescoreWorkspace(workspace.id, icp.id);
    return apiOk({ icp, sourcesCreated, prospectsScored: scoring.scored }, 201);
  });
}
