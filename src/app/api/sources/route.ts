import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiOk, assertSameOrigin, parseJson, withWorkspace } from "@/lib/api";
import { CONNECTORS, parseSourceConfig } from "@/lib/connectors";
import type { SourceType } from "@prisma/client";
import { prisma } from "@/lib/db";

const createSchema = z.object({
  type: z.enum(["RSS", "URL", "WEBSITE", "JOB_FEED", "WEB_SEARCH", "HN"]),
  name: z.string().trim().min(2).max(120).optional(),
  config: z.record(z.unknown()),
});

function sourceUrlFor(type: SourceType, config: Record<string, unknown>): string | null {
  if (type === "RSS" || type === "URL") return String(config.feedUrl ?? config.url ?? "") || null;
  if (type === "WEBSITE") return String(config.website ?? "") || null;
  if (type === "HN") return "https://news.ycombinator.com/";
  if (type === "JOB_FEED" && config.provider === "rss") return String(config.feedUrl ?? "") || null;
  return null;
}

export async function GET() {
  return withWorkspace(async (workspace) => {
    const sources = await prisma.source.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { createdAt: "asc" },
      include: { runs: { orderBy: { startedAt: "desc" }, take: 3 } },
    });
    return apiOk({ sources });
  });
}

export async function POST(request: NextRequest) {
  if (!assertSameOrigin(request)) return apiError("Cross-site request blocked.", 403, "FORBIDDEN");
  return withWorkspace(async (workspace) => {
    const payload = await parseJson(request, createSchema);
    const parsed = parseSourceConfig(payload.type, payload.config);
    if (!parsed.success) {
      return apiError(parsed.error.issues[0]?.message ?? "Invalid connector configuration.", 422, "VALIDATION_ERROR");
    }
    const connector = CONNECTORS[payload.type];
    if (connector.isConfigured && !connector.isConfigured()) {
      return apiError(`${connector.label} is not configured on this deployment. Add the required API key first.`, 409, "CONNECTOR_UNAVAILABLE");
    }

    const source = await prisma.source.create({
      data: {
        workspaceId: workspace.id,
        type: payload.type,
        name: payload.name ?? connector.label,
        url: sourceUrlFor(payload.type, parsed.data as Record<string, unknown>),
        config: parsed.data as object,
      },
    });
    return apiOk({ source }, 201);
  });
}
