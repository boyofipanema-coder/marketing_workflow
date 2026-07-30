"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDb } from "@/server/db/client";
import { SESSION_COOKIE_NAME } from "@/server/auth/constants";
import { deleteSession } from "@/server/auth/session";
import { clearActiveMember, setActiveMember } from "@/server/auth/active-member";

/** Selects the team member credited for work in this browser. */
export async function selectMemberAction(memberId: string): Promise<void> {
  await setActiveMember(memberId);
  redirect("/home");
}

/** Lets a shared-device user choose a different member without re-entering the password. */
export async function switchMemberAction(): Promise<void> {
  await clearActiveMember();
  redirect("/select-member");
}

/** Ends this browser's session. */
export async function logoutAction(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (token) {
    const { env } = await getCloudflareContext({ async: true });
    await deleteSession(createDb(env.DB), token);
  }
  cookieStore.delete(SESSION_COOKIE_NAME);
  await clearActiveMember();
  redirect("/login");
}
