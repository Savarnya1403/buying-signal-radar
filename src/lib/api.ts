import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import { ensureWorkspace } from "@/lib/workspace";

export type ApiErrorBody = { error: { message: string; code: string; details?: unknown } };

export function apiError(message: string, status = 400, code = "BAD_REQUEST", details?: unknown) {
  return NextResponse.json<ApiErrorBody>({ error: { message, code, details } }, { status });
}

export function apiOk<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export async function withWorkspace<T>(handler: (workspace: Awaited<ReturnType<typeof ensureWorkspace>>) => Promise<T>) {
  try {
    const workspace = await ensureWorkspace();
    return await handler(workspace);
  } catch (error) {
    if (error instanceof ZodError) {
      return apiError(error.issues[0]?.message ?? "Invalid input.", 422, "VALIDATION_ERROR", error.issues);
    }
    console.error("[api]", error);
    const message = error instanceof Error ? error.message : "Something went wrong.";
    return apiError(message, 500, "INTERNAL_ERROR");
  }
}

export function assertSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite === "cross-site") return false;
  if (!origin) return true;
  try {
    return new URL(origin).host === request.nextUrl.host;
  } catch {
    return false;
  }
}

export async function parseJson<T>(request: NextRequest, schema: ZodType<T>): Promise<T> {
  let data: unknown;
  try {
    data = await request.json();
  } catch {
    throw new ZodError([{ code: "custom", path: [], message: "Request body must be valid JSON." }]);
  }
  return schema.parse(data);
}

const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs };
  }
  if (bucket.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: bucket.resetAt };
  }
  bucket.count += 1;
  return { allowed: true, remaining: limit - bucket.count, resetAt: bucket.resetAt };
}

export function rateLimitResponse(resetAt: number) {
  const seconds = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
  return NextResponse.json(
    { error: { message: `Rate limit reached. Try again in ${seconds}s.`, code: "RATE_LIMITED" } },
    { status: 429, headers: { "retry-after": String(seconds) } },
  );
}
