import { readFileSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";

const MIGRATIONS_DIR = join(process.cwd(), "drizzle", "migrations");

function apply(sqlite: Database.Database, tag: string) {
  const sql = readFileSync(join(MIGRATIONS_DIR, `${tag}.sql`), "utf8");
  for (const statement of sql.split("--> statement-breakpoint")) {
    const trimmed = statement.trim();
    if (trimmed) sqlite.exec(trimmed);
  }
}

describe("0011 — memo documents", () => {
  it("preserves the existing scratchpad as a Simple document", () => {
    const sqlite = new Database(":memory:");
    sqlite.exec("PRAGMA foreign_keys = OFF;");
    const tags = [
      "0000_absent_harry_osborn",
      "0001_add_parent_task_id",
      "0002_recovery_fields",
      "0003_task_hierarchy",
      "0004_milestone_as_task",
      "0005_brand_project_hierarchy",
      "0006_restore_default_brands",
      "0007_comments_notifications",
      "0008_project_comments",
      "0009_personal_note",
      "0010_project_sort_order",
    ];
    for (const tag of tags) apply(sqlite, tag);

    sqlite.prepare(
      `INSERT INTO personal_note (member_id, workspace_id, body, updated_at)
       VALUES ('m1', 'ws1', '기존 메모 내용', '2026-08-20T09:00:00Z')`,
    ).run();

    apply(sqlite, "0011_memo_documents");
    const migrated = sqlite.prepare(
      "SELECT title, body, mode, updated_at FROM memo_document WHERE member_id = 'm1'",
    ).get();

    expect(migrated).toEqual({
      title: "빠른 메모",
      body: "기존 메모 내용",
      mode: "simple",
      updated_at: "2026-08-20T09:00:00Z",
    });
  });
});
