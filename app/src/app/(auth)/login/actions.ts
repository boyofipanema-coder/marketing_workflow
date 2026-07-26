"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDb } from "@/server/db/client";
import { member } from "@/server/db/schema";
import { createSession } from "@/server/auth/session";
import {
  SESSION_COOKIE_NAME,
  SESSION_DURATION_DAYS,
} from "@/server/auth/constants";
import { workspacePassword } from "@/server/auth/workspace-password";

export interface LoginState {
  error?: string;
}

/** Length-independent comparison so a wrong guess leaks no timing signal. */
function constantTimeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const x = enc.encode(a);
  const y = enc.encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  }
  return diff === 0;
}

/**
 * One shared workspace password, then pick who you are.
 *
 * Deliberately not a credential per person: this is a team that already shares
 * one board, and per-user passwords would drag in reset and recovery flows
 * nobody wants to own. The member choice is what the session records, so
 * "assigned to me" still means something.
 */
export async function enterAction(
  _prevState: LoginState | null,
  formData: FormData
): Promise<LoginState> {
  const password = formData.get("password") as string | null;
  const memberId = formData.get("memberId") as string | null;

  if (!password || !memberId) {
    return { error: "비밀번호를 입력하고 사용자를 선택해 주세요." };
  }

  const { env } = await getCloudflareContext({ async: true });
  const expected = workspacePassword(env);
  if (!expected) {
    return { error: "WORKSPACE_PASSWORD가 설정되지 않았습니다." };
  }
  if (!constantTimeEqual(password, expected)) {
    return { error: "비밀번호를 확인해 주세요." };
  }

  const db = createDb(env.DB);
  const rows = await db
    .select()
    .from(member)
    .where(eq(member.id, memberId))
    .limit(1);
  if (rows.length === 0) {
    return { error: "사용자를 찾을 수 없습니다." };
  }

  const token = await createSession(db, memberId);
  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_DAYS * 24 * 60 * 60,
  });

  redirect("/home");
}

/** Clears the session cookie and returns to the entry screen. */
export async function logoutAction(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE_NAME);
  redirect("/login");
}
