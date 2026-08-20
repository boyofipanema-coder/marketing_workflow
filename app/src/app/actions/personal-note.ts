"use server";

import { getCurrentMember } from "@/server/data/queries";
import {
  saveMemoDocument,
  savePersonalNote,
  setMemoDocumentArchived,
  type MemoDocumentView,
  type SaveMemoDocumentInput,
} from "@/server/services/personal-note";
import { runAction, type ActionResult } from "./result";

export async function savePersonalNoteAction(
  body: string,
): Promise<ActionResult<string>> {
  return runAction("savePersonalNoteAction", async () => {
    const { member, db } = await getCurrentMember();
    return savePersonalNote(db, member.workspace_id, member.id, body);
  });
}

export async function saveMemoDocumentAction(
  input: SaveMemoDocumentInput,
): Promise<ActionResult<MemoDocumentView>> {
  return runAction("saveMemoDocumentAction", async () => {
    const { member, db } = await getCurrentMember();
    return saveMemoDocument(db, member.workspace_id, member.id, input);
  });
}

export async function setMemoDocumentArchivedAction(
  id: string,
  archived: boolean,
): Promise<ActionResult<string>> {
  return runAction("setMemoDocumentArchivedAction", async () => {
    const { member, db } = await getCurrentMember();
    return setMemoDocumentArchived(
      db,
      member.workspace_id,
      member.id,
      id,
      archived,
    );
  });
}
