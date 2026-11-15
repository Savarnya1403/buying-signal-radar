import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiOk, assertSameOrigin, parseJson, rateLimit, rateLimitResponse, withWorkspace } from "@/lib/api";
import { resetDemoWorkspace, seedDemoWorkspace } from "@/lib/demo/seed";

const schema = z.object({ action: z.enum(["seed", "reset", "reseed"]) });

export async function POST(request: NextRequest) {
  if (!assertSameOrigin(request)) return apiError("Cross-site request blocked.", 403, "FORBIDDEN");
  return withWorkspace(async (workspace) => {
    const limit = rateLimit(`demo:${workspace.id}`, 10, 10 * 60_000);
    if (!limit.allowed) return rateLimitResponse(limit.resetAt);
    const { action } = await parseJson(request, schema);

    if (action === "reset") {
      const result = await resetDemoWorkspace(workspace.id);
      return apiOk({ action, ...result });
    }

    const result = await seedDemoWorkspace(workspace.id, { reset: action === "reseed" });
    return apiOk({ action, ...result });
  });
}
