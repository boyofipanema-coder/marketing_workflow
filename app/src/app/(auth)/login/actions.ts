"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDb } from "@/server/db/client";
import { auth_account } from "@/server/db/schema";
import { verifyPassword } from "@/server/auth/crypto";
import { createSession } from "@/server/auth/session";
import { SESSION_COOKIE_NAME, SESSION_DURATION_DAYS } from "@/server/auth/constants";

export interface LoginState {
  error?: string;
}

export async function loginAction(
  _prevState: LoginState | null,
  formData: FormData
): Promise<LoginState> {
  const password = formData.get("password") as string | null;

  if (!password) {
    return { error: "비밀번호를 입력해 주세요." };
  }

  const { env } = await getCloudflareContext({ async: true });
  const db = createDb(env.DB);

  // One shared access password protects the workspace. Member choice follows.
  const accounts = await db
    .select()
    .from(auth_account)
    .limit(1);

  if (accounts.length === 0) {
    return { error: "접속 비밀번호가 아직 설정되지 않았습니다." };
  }

  const account = accounts[0]!;
  const valid = await verifyPassword(password, account.credential_hash);

  if (!valid) {
    return { error: "비밀번호를 확인해 주세요." };
  }

  // Create session in D1
  const token = await createSession(db, account.member_id);

  // Set httpOnly session cookie
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_DURATION_DAYS * 24 * 60 * 60,
    path: "/",
  });

  redirect("/select-member");
}
