"use server";

import { redirect } from "next/navigation";
import { setActiveMember, clearActiveMember } from "@/server/auth/active-member";

/** Picking yourself on the entry screen — no password. */
export async function selectMemberAction(memberId: string): Promise<void> {
  await setActiveMember(memberId);
  redirect("/home");
}

/** "다른 사람으로 전환" — back to the entry screen. */
export async function switchMemberAction(): Promise<void> {
  await clearActiveMember();
  redirect("/select-member");
}
