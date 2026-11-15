import { NextRequest, NextResponse } from "next/server";

const COOKIE = "bsr_workspace";
const VALID = /^[a-zA-Z0-9_-]{16,64}$/;

export function middleware(request: NextRequest) {
  const existing = request.cookies.get(COOKIE)?.value;
  const workspaceId = existing && VALID.test(existing) ? existing : crypto.randomUUID();

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-bsr-workspace", workspaceId);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  if (!existing || existing !== workspaceId) {
    response.cookies.set(COOKIE, workspaceId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  response.headers.set("x-bsr-workspace", workspaceId);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
