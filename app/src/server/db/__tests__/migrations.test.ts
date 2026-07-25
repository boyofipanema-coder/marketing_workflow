/**
 * Migration tests.
 *
 * Migration 0002 is the only one that rewrites existing rows (the sort_order
 * backfill). These tests apply the earlier migrations, insert rows the way a
 * live database would already hold them, and only then apply 0002 — so a
 * regression in the backfill shows up here rather than in production ordering.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";

const MIGRATIONS_DIR = join(process.cwd(), "drizzle", "migrations");

function apply(sqlite: Database.Database, tag: string) {
  const sql = readFileSync(join(MIGRATIONS_DIR, `${tag}.sql`), "utf8");
  for (const statement of sql.split("--> statement-breakpoint")) {
    const trimmed = statement.trim();
    if (trimmed) sqlite.exec(trimmed);
  }
}

/** A database migrated only as far as 0001 — i.e. the pre-recovery schema. */
function legacyDb() {
  const sqlite = new Database(":memory:");
  sqlite.exec("PRAGMA foreign_keys = OFF;");
  apply(sqlite, "0000_absent_harry_osborn");
  apply(sqlite, "0001_add_parent_task_id");
  return sqlite;
}

interface SeedTask {
  id: string;
  project_id: string | null;
  parent_task_id?: string | null;
  created_at: string;
}

function insertTasks(sqlite: Database.Database, tasks: SeedTask[]) {
  const stmt = sqlite.prepare(
    `INSERT INTO task (id, workspace_id, project_id, parent_task_id, title, status,
       version, created_by, created_at, updated_at)
     VALUES (?, 'ws1', ?, ?, ?, 'ToDo', 1, 'm1', ?, ?)`
  );
  for (const t of tasks) {
    stmt.run(
      t.id,
      t.project_id,
      t.parent_task_id ?? null,
      `Task ${t.id}`,
      t.created_at,
      t.created_at
    );
  }
}

function sortOrders(sqlite: Database.Database): Record<string, number> {
  const rows = sqlite
    .prepare("SELECT id, sort_order FROM task")
    .all() as { id: string; sort_order: number }[];
  return Object.fromEntries(rows.map((r) => [r.id, r.sort_order]));
}

describe("0002 — sort_order backfill", () => {
  it("orders existing rows by created_at within a project", () => {
    const sqlite = legacyDb();
    insertTasks(sqlite, [
      { id: "c", project_id: "p1", created_at: "2024-03-03T00:00:00Z" },
      { id: "a", project_id: "p1", created_at: "2024-03-01T00:00:00Z" },
      { id: "b", project_id: "p1", created_at: "2024-03-02T00:00:00Z" },
    ]);

    apply(sqlite, "0002_recovery_fields");

    expect(sortOrders(sqlite)).toEqual({ a: 0, b: 1, c: 2 });
  });

  it("numbers each project independently, starting from zero", () => {
    const sqlite = legacyDb();
    insertTasks(sqlite, [
      { id: "p1a", project_id: "p1", created_at: "2024-03-01T00:00:00Z" },
      { id: "p1b", project_id: "p1", created_at: "2024-03-02T00:00:00Z" },
      { id: "p2a", project_id: "p2", created_at: "2024-03-05T00:00:00Z" },
    ]);

    apply(sqlite, "0002_recovery_fields");

    expect(sortOrders(sqlite)).toEqual({ p1a: 0, p1b: 1, p2a: 0 });
  });

  it("numbers Inbox tasks (no project) as their own group", () => {
    const sqlite = legacyDb();
    insertTasks(sqlite, [
      { id: "inbox1", project_id: null, created_at: "2024-03-01T00:00:00Z" },
      { id: "inbox2", project_id: null, created_at: "2024-03-02T00:00:00Z" },
      { id: "filed", project_id: "p1", created_at: "2024-03-03T00:00:00Z" },
    ]);

    apply(sqlite, "0002_recovery_fields");

    expect(sortOrders(sqlite)).toEqual({ inbox1: 0, inbox2: 1, filed: 0 });
  });

  it("numbers subtasks within their parent, not alongside it", () => {
    const sqlite = legacyDb();
    insertTasks(sqlite, [
      { id: "parent", project_id: "p1", created_at: "2024-03-01T00:00:00Z" },
      {
        id: "child1",
        project_id: "p1",
        parent_task_id: "parent",
        created_at: "2024-03-02T00:00:00Z",
      },
      {
        id: "child2",
        project_id: "p1",
        parent_task_id: "parent",
        created_at: "2024-03-03T00:00:00Z",
      },
    ]);

    apply(sqlite, "0002_recovery_fields");

    expect(sortOrders(sqlite)).toEqual({ parent: 0, child1: 0, child2: 1 });
  });

  // Identical timestamps are realistic — a bulk import writes many rows with
  // the same created_at — and must still produce a stable, gap-free sequence.
  it("breaks created_at ties by id so the order stays deterministic", () => {
    const sqlite = legacyDb();
    const same = "2024-03-01T00:00:00Z";
    insertTasks(sqlite, [
      { id: "t3", project_id: "p1", created_at: same },
      { id: "t1", project_id: "p1", created_at: same },
      { id: "t2", project_id: "p1", created_at: same },
    ]);

    apply(sqlite, "0002_recovery_fields");

    expect(sortOrders(sqlite)).toEqual({ t1: 0, t2: 1, t3: 2 });
  });

  it("preserves every existing row and its data", () => {
    const sqlite = legacyDb();
    insertTasks(sqlite, [
      { id: "keep", project_id: "p1", created_at: "2024-03-01T00:00:00Z" },
    ]);

    apply(sqlite, "0002_recovery_fields");

    const row = sqlite
      .prepare("SELECT id, title, status, version FROM task WHERE id = 'keep'")
      .get();
    expect(row).toEqual({
      id: "keep",
      title: "Task keep",
      status: "ToDo",
      version: 1,
    });
  });

  it("rejects a dependency that points a task at itself", () => {
    const sqlite = legacyDb();
    apply(sqlite, "0002_recovery_fields");

    expect(() =>
      sqlite
        .prepare(
          `INSERT INTO task_dependency
             (id, workspace_id, predecessor_task_id, successor_task_id, dependency_type, created_at)
           VALUES ('d1', 'ws1', 't1', 't1', 'finish_to_start', '2024-03-01T00:00:00Z')`
        )
        .run()
    ).toThrow();
  });

  it("rejects a duplicate predecessor/successor pair", () => {
    const sqlite = legacyDb();
    apply(sqlite, "0002_recovery_fields");

    const insert = (id: string) =>
      sqlite
        .prepare(
          `INSERT INTO task_dependency
             (id, workspace_id, predecessor_task_id, successor_task_id, dependency_type, created_at)
           VALUES (?, 'ws1', 't1', 't2', 'finish_to_start', '2024-03-01T00:00:00Z')`
        )
        .run(id);

    insert("d1");
    expect(() => insert("d2")).toThrow();
  });
});
