import { and, desc, eq } from "drizzle-orm";
import type { Database } from "@/server/db/client";
import { memo_document, personal_note } from "@/server/db/schema";
import { ValidationError } from "./errors";

const MAX_NOTE_LENGTH = 20_000;
const MAX_DEEP_NOTE_LENGTH = 100_000;
const MAX_TITLE_LENGTH = 120;

export type MemoMode = "simple" | "deep";

export interface MemoDocumentView {
  id: string;
  title: string;
  body: string;
  mode: MemoMode;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SaveMemoDocumentInput {
  id: string;
  title: string;
  body: string;
  mode: MemoMode;
}

const ALLOWED_DEEP_TAGS = new Set([
  "b", "blockquote", "br", "div", "em", "h1", "h2", "i", "li",
  "ol", "p", "strong", "u", "ul",
]);

function sanitizeDeepBody(value: string): string {
  return value
    .replace(/<!--[^]*?-->/g, "")
    .replace(/<(script|style)\b[^>]*>[^]*?<\/\1\s*>/gi, "")
    .replace(/<\/?([a-z][a-z0-9]*)\b[^>]*>/gi, (tag, name: string) => {
      const normalized = name.toLowerCase();
      if (!ALLOWED_DEEP_TAGS.has(normalized)) return "";
      return tag.startsWith("</") ? `</${normalized}>` : `<${normalized}>`;
    });
}

function toView(row: typeof memo_document.$inferSelect): MemoDocumentView {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    mode: row.mode,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listMemoDocuments(
  db: Database,
  workspaceId: string,
  memberId: string,
): Promise<MemoDocumentView[]> {
  const rows = await db
    .select()
    .from(memo_document)
    .where(
      and(
        eq(memo_document.workspace_id, workspaceId),
        eq(memo_document.member_id, memberId),
      ),
    )
    .orderBy(desc(memo_document.updated_at));
  return rows.map(toView);
}

export async function saveMemoDocument(
  db: Database,
  workspaceId: string,
  memberId: string,
  input: SaveMemoDocumentInput,
): Promise<MemoDocumentView> {
  if (!/^[a-zA-Z0-9-]{1,80}$/.test(input.id)) {
    throw new ValidationError("메모 식별자가 올바르지 않습니다.");
  }
  if (input.mode !== "simple" && input.mode !== "deep") {
    throw new ValidationError("지원하지 않는 편집 모드입니다.");
  }

  const title = input.title.trim() || "제목 없는 메모";
  if (title.length > MAX_TITLE_LENGTH) {
    throw new ValidationError("메모 제목은 120자 이하로 적어 주세요.");
  }

  const body = input.mode === "deep" ? sanitizeDeepBody(input.body) : input.body;
  const limit = input.mode === "deep" ? MAX_DEEP_NOTE_LENGTH : MAX_NOTE_LENGTH;
  if (body.length > limit) {
    throw new ValidationError(
      input.mode === "deep"
        ? "Deep 문서는 100,000자 이하로 적어 주세요."
        : "Simple 메모는 20,000자 이하로 적어 주세요.",
    );
  }

  const [existing] = await db
    .select({
      id: memo_document.id,
      workspaceId: memo_document.workspace_id,
      memberId: memo_document.member_id,
      createdAt: memo_document.created_at,
      archivedAt: memo_document.archived_at,
    })
    .from(memo_document)
    .where(eq(memo_document.id, input.id))
    .limit(1);

  if (
    existing &&
    (existing.workspaceId !== workspaceId || existing.memberId !== memberId)
  ) {
    throw new ValidationError("이 메모를 수정할 권한이 없습니다.");
  }

  const now = new Date().toISOString();
  if (existing) {
    await db
      .update(memo_document)
      .set({ title, body, mode: input.mode, updated_at: now })
      .where(
        and(
          eq(memo_document.id, input.id),
          eq(memo_document.workspace_id, workspaceId),
          eq(memo_document.member_id, memberId),
        ),
      );
  } else {
    await db.insert(memo_document).values({
      id: input.id,
      workspace_id: workspaceId,
      member_id: memberId,
      title,
      body,
      mode: input.mode,
      archived_at: null,
      created_at: now,
      updated_at: now,
    });
  }

  return {
    id: input.id,
    title,
    body,
    mode: input.mode,
    archivedAt: existing?.archivedAt ?? null,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
}

export async function setMemoDocumentArchived(
  db: Database,
  workspaceId: string,
  memberId: string,
  id: string,
  archived: boolean,
): Promise<string> {
  const [owned] = await db
    .select({ id: memo_document.id })
    .from(memo_document)
    .where(
      and(
        eq(memo_document.id, id),
        eq(memo_document.workspace_id, workspaceId),
        eq(memo_document.member_id, memberId),
      ),
    )
    .limit(1);
  if (!owned) throw new ValidationError("메모를 찾을 수 없습니다.");

  await db
    .update(memo_document)
    .set({
      archived_at: archived ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .where(
      and(
        eq(memo_document.id, id),
        eq(memo_document.workspace_id, workspaceId),
        eq(memo_document.member_id, memberId),
      ),
    );

  return id;
}

// Kept for callers/tests that still exercise the legacy scratchpad directly.

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
