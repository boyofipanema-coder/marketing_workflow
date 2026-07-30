import { cookies } from "next/headers";

/**
 * Which team member is acting in this browser after the shared password gate.
 * It controls attribution only; authentication is the D1-backed session.
 */
const ACTIVE_MEMBER_COOKIE = "mtw_active_member";
const ONE_YEAR = 60 * 60 * 24 * 365;

export async function getActiveMemberId(): Promise<string | null> {
  const store = await cookies();
  return store.get(ACTIVE_MEMBER_COOKIE)?.value ?? null;
}

export async function setActiveMember(memberId: string): Promise<void> {
  const store = await cookies();
  store.set(ACTIVE_MEMBER_COOKIE, memberId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ONE_YEAR,
  });
}

export async function clearActiveMember(): Promise<void> {
  const store = await cookies();
  store.delete(ACTIVE_MEMBER_COOKIE);
}
