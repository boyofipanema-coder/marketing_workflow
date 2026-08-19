import { describe, expect, it } from "vitest";
import { makeTestDb } from "@/server/db/testing";
import { member, workspace } from "@/server/db/schema";
import { getPersonalNote, savePersonalNote } from "../personal-note";

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
});
