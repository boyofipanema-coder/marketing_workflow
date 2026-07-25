import { NextResponse } from "next/server";

/**
 * Login is intentionally bypassed at this stage — the app auto-enters as the
 * default workspace member (see getCurrentMember). This middleware is a
 * passthrough. To re-enable the route guard, restore the session-cookie check
 * and the matcher config from git history.
 */
export function middleware(): NextResponse {
  return NextResponse.next();
}

export const config = {
  matcher: [],
};
