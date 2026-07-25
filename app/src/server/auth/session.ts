import { eq } from "drizzle-orm";
import type { Database } from "../db/client";
import { session, member } from "../db/schema";
import type { Member } from "../db/schema";
import { SESSION_DURATION_DAYS } from "./constants";

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  // URL-safe base64
  return btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join(""))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

/**
 * Creates a new session for the given member and returns the session token.
 * The token is the session's primary key stored in D1.
 */
export async function createSession(
  db: Database,
  memberId: string
): Promise<string> {
  const token = generateToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_DURATION_DAYS);

  await db.insert(session).values({
    id: token,
    member_id: memberId,
    expires_at: expiresAt.toISOString(),
  });

  return token;
}

/**
 * Validates a session token against D1.
 * Returns the associated Member on success, or null if the session is missing/expired.
 */
export async function validateSession(
  db: Database,
  token: string
): Promise<Member | null> {
  const rows = await db
    .select({ sess: session, mem: member })
    .from(session)
    .innerJoin(member, eq(session.member_id, member.id))
    .where(eq(session.id, token))
    .limit(1);

  if (rows.length === 0) return null;

  const { sess, mem } = rows[0]!;

  if (new Date(sess.expires_at) < new Date()) {
    // Expired — clean up and reject
    await db.delete(session).where(eq(session.id, token));
    return null;
  }

  return mem;
}

/**
 * Deletes a session token from D1 (logout).
 */
export async function deleteSession(
  db: Database,
  token: string
): Promise<void> {
  await db.delete(session).where(eq(session.id, token));
}
