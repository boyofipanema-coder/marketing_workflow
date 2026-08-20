import { describe, expect, it } from "vitest";
import { makeTestDb } from "@/server/db/testing";
import { member, workspace } from "@/server/db/schema";
import {
  getPersonalNote,
  listMemoDocuments,
  saveMemoDocument,
  savePersonalNote,
  setMemoDocumentArchived,
} from "../personal-note";

describe("personal note", () => {
  it("creates and updates one note for a member", async () => {
    const db = makeTestDb();
    await db.insert(workspace).values({
      id: "ws1",
      name: "Workspace",
      timezone: "Asia/Seoul",
      created_at: "2026-08-19T00:00:00Z",
    });
    await db.insert(member).values({
      id: "m1",
      workspace_id: "ws1",
      name: "지수",
      email: "jisu@example.com",
      role: "member",
    });

    expect(await getPersonalNote(db as never, "ws1", "m1")).toBe("");
    await savePersonalNote(db as never, "ws1", "m1", "첫 메모");
    await savePersonalNote(db as never, "ws1", "m1", "수정한 메모");
    expect(await getPersonalNote(db as never, "ws1", "m1")).toBe("수정한 메모");
  });

  it("saves multiple Simple and Deep documents and lists recent first", async () => {
    const db = makeTestDb();
    await db.insert(workspace).values({
      id: "ws1",
      name: "Workspace",
      timezone: "Asia/Seoul",
      created_at: "2026-08-19T00:00:00Z",
    });
    await db.insert(member).values({
      id: "m1",
      workspace_id: "ws1",
      name: "지수",
      email: "jisu@example.com",
      role: "member",
    });

    await saveMemoDocument(db as never, "ws1", "m1", {
      id: "simple-1",
      title: "회의 메모",
      body: "결정 사항",
      mode: "simple",
    });
    await saveMemoDocument(db as never, "ws1", "m1", {
      id: "deep-1",
      title: "캠페인 초안",
      body: '<h1 class="unsafe">전략</h1><script>alert(1)</script><p>본문</p>',
      mode: "deep",
    });

    const documents = await listMemoDocuments(db as never, "ws1", "m1");
    expect(documents).toHaveLength(2);
    expect(documents.find((document) => document.id === "deep-1")?.body).toBe(
      "<h1>전략</h1><p>본문</p>",
    );
  });

  it("moves a document to the archive without deleting its content", async () => {
    const db = makeTestDb();
    await db.insert(workspace).values({
      id: "ws1",
      name: "Workspace",
      timezone: "Asia/Seoul",
      created_at: "2026-08-19T00:00:00Z",
    });
    await db.insert(member).values({
      id: "m1",
      workspace_id: "ws1",
      name: "지수",
      email: "jisu@example.com",
      role: "member",
    });
    await saveMemoDocument(db as never, "ws1", "m1", {
      id: "memo-1",
      title: "보관할 메모",
      body: "나중에 다시 확인",
      mode: "simple",
    });

    await setMemoDocumentArchived(db as never, "ws1", "m1", "memo-1", true);
    const [document] = await listMemoDocuments(db as never, "ws1", "m1");
    expect(document.archivedAt).not.toBeNull();
    expect(document.body).toBe("나중에 다시 확인");
  });
});
