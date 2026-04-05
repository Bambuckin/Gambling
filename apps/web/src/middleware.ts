import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ACCESS_ROLE_HINT_COOKIE_NAME, ACCESS_SESSION_COOKIE_NAME } from "./lib/access/cookie-names";
import { evaluateMiddlewareGuard } from "./lib/access/role-guard";

export function middleware(request: NextRequest): NextResponse {
  const decision = evaluateMiddlewareGuard({
    pathname: request.nextUrl.pathname,
    sessionId: request.cookies.get(ACCESS_SESSION_COOKIE_NAME)?.value,
    roleHint: request.cookies.get(ACCESS_ROLE_HINT_COOKIE_NAME)?.value
  });

  if (decision.allowed) {
    return NextResponse.next();
  }

  const redirectPath = decision.redirectPath ?? "/login";
  const targetUrl = new URL(redirectPath, request.url);
  return NextResponse.redirect(targetUrl);
}

export const config = {
  matcher: ["/lottery/:path*", "/admin/:path*"]
};
