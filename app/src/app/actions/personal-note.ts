"use server";

import { getCurrentMember } from "@/server/data/queries";
import { savePersonalNote } from "@/server/services/personal-note";
import { runAction, type ActionResult } from "./result";

export async function savePersonalNoteAction(
  body: string,
): Promise<ActionResult<string>> {
  return runAction("savePersonalNoteAction", async () => {
    const { member, db } = await getCurrentMember();
    return savePersonalNote(db, member.workspace_id, member.id, body);
  });
}
