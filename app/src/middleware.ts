import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/server/auth/constants";

/**
 * Reject requests that do not have a session cookie before rendering the app.
 * The app layout checks that the token is valid and not expired in D1.
 */
export function middleware(request: NextRequest): NextResponse {
  if (!request.cookies.get(SESSION_COOKIE_NAME)?.value) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!login|api|_next/static|_next/image|favicon\\.ico).*)"],
};
