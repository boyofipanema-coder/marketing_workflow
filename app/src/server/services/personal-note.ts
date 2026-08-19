import { and, eq } from "drizzle-orm";
import type { Database } from "@/server/db/client";
import { personal_note } from "@/server/db/schema";
import { ValidationError } from "./errors";

const MAX_NOTE_LENGTH = 20_000;

export async function getPersonalNote(
  db: Database,
  workspaceId: string,
  memberId: string,
): Promise<string> {
  const [note] = await db
    .select({ body: personal_note.body })
    .from(personal_note)
    .where(
      and(
        eq(personal_note.workspace_id, workspaceId),
        eq(personal_note.member_id, memberId),
      ),
    )
    .limit(1);
  return note?.body ?? "";
}

export async function savePersonalNote(
  db: Database,
  workspaceId: string,
  memberId: string,
  body: string,
): Promise<string> {
  if (body.length > MAX_NOTE_LENGTH) {
    throw new ValidationError("메모는 20,000자 이하로 적어 주세요.");
  }
  await db
    .insert(personal_note)
    .values({
      member_id: memberId,
      workspace_id: workspaceId,
      body,
      updated_at: new Date().toISOString(),
    })
    .onConflictDoUpdate({
      target: personal_note.member_id,
      set: { body, updated_at: new Date().toISOString() },
    });
  return body;
}
