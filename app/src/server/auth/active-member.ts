import { cookies } from "next/headers";

/**
 * Which team member is "acting" this browser session — a plain, unsigned
 * cookie, not authentication. There's no password yet (see queries.ts); this
 * just remembers who picked themselves on the entry screen so tasks get
 * attributed to the right person instead of always defaulting to one member.
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
    sameSite: "lax",
    path: "/",
    maxAge: ONE_YEAR,
  });
}

export async function clearActiveMember(): Promise<void> {
  const store = await cookies();
  store.delete(ACTIVE_MEMBER_COOKIE);
}
