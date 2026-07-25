import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/server/auth/constants";

/**
 * Lightweight route guard.
 * Redirects to /login when the session cookie is absent.
 * Full D1 token validation is performed in the (app) layout server component.
 */
export function middleware(request: NextRequest): NextResponse {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Protect all routes except:
     * - /login           (auth page)
     * - /api/*           (API routes)
     * - /_next/static    (Next.js static assets)
     * - /_next/image     (Next.js image optimisation)
     * - /favicon.ico
     */
    "/((?!login|api|_next/static|_next/image|favicon\\.ico).*)",
  ],
};
