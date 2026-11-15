import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiOk, assertSameOrigin, parseJson, rateLimit, rateLimitResponse, withWorkspace } from "@/lib/api";
import { interpretProductDescription } from "@/lib/icp/interpreter";

const schema = z.object({
  description: z.string().trim().min(20, "Describe your product in at least 20 characters.").max(6000),
});

export async function POST(request: NextRequest) {
  if (!assertSameOrigin(request)) return apiError("Cross-site request blocked.", 403, "FORBIDDEN");
  return withWorkspace(async (workspace) => {
    const limit = rateLimit(`interpret:${workspace.id}`, 30, 60_000);
    if (!limit.allowed) return rateLimitResponse(limit.resetAt);
    const { description } = await parseJson(request, schema);
    const interpretation = interpretProductDescription(description);
    return apiOk({
      interpretation,
      mode: "rules",
      note: "This interpretation is produced by a transparent rules-based interpreter. No external LLM is called and no prospect data is invented.",
    });
  });
}
