/**
 * Migration tests.
 *
 * 0002 (the sort_order backfill) and 0004 (moving milestones into `task`) are
 * the only migrations that touch existing rows. These tests apply the earlier
 * migrations, insert rows the way a live database would already hold them, and
 * only then apply the one under test — so a regression shows up here rather
 * than in someone's data.
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

// ---------------------------------------------------------------------------
// 0004 — milestone → task
// ---------------------------------------------------------------------------

interface MilestoneRow {
  id: string;
  project_id: string;
  name: string;
  due_date: string;
}

/** A database migrated as far as 0003, with a project the milestones hang off. */
function preMilestoneDb() {
  const sqlite = legacyDb();
  apply(sqlite, "0002_recovery_fields");
  apply(sqlite, "0003_task_hierarchy");
  sqlite
    .prepare(
      `INSERT INTO project
         (id, workspace_id, name, project_lead_id, created_at, updated_at)
       VALUES ('p1', 'ws1', 'Project One', 'lead1', '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z')`
    )
    .run();
  return sqlite;
}

function insertMilestones(sqlite: Database.Database, rows: MilestoneRow[]) {
  const stmt = sqlite.prepare(
    "INSERT INTO milestone (id, project_id, name, due_date) VALUES (?, ?, ?, ?)"
  );
  for (const r of rows) stmt.run(r.id, r.project_id, r.name, r.due_date);
}

function milestoneTasks(sqlite: Database.Database) {
  return sqlite
    .prepare(
      `SELECT id, title, due_date, kind, status, workspace_id, project_id,
              created_by, sort_order
       FROM task WHERE kind = 'milestone' ORDER BY due_date, id`
    )
    .all() as Record<string, unknown>[];
}

describe("0004 — milestones become tasks", () => {
  it("carries every milestone across with its name and date", () => {
    const sqlite = preMilestoneDb();
    insertMilestones(sqlite, [
      { id: "m1", project_id: "p1", name: "Kickoff", due_date: "2024-04-01" },
      { id: "m2", project_id: "p1", name: "Launch", due_date: "2024-06-01" },
    ]);

    apply(sqlite, "0004_milestone_as_task");

    const rows = milestoneTasks(sqlite);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      id: "ms-m1",
      title: "Kickoff",
      due_date: "2024-04-01",
      kind: "milestone",
      status: "ToDo",
      workspace_id: "ws1",
      project_id: "p1",
      created_by: "lead1",
    });
    expect(rows[1]).toMatchObject({ id: "ms-m2", title: "Launch" });
  });

  // Ids are derived rather than generated precisely so a half-applied migration
  // can be re-run without doubling every deadline on the board.
  it("is a no-op when applied twice", () => {
    const sqlite = preMilestoneDb();
    insertMilestones(sqlite, [
      { id: "m1", project_id: "p1", name: "Kickoff", due_date: "2024-04-01" },
    ]);

    apply(sqlite, "0004_milestone_as_task");
    // The index is created once; re-running only the data half is what matters.
    sqlite.exec("DROP INDEX idx_task_project_kind");
    apply(sqlite, "0004_milestone_as_task");

    expect(milestoneTasks(sqlite)).toHaveLength(1);
  });

  it("orders milestones after the project's existing top-level tasks", () => {
    const sqlite = preMilestoneDb();
    insertTasks(sqlite, [
      { id: "t1", project_id: "p1", created_at: "2024-03-01T00:00:00Z" },
      { id: "t2", project_id: "p1", created_at: "2024-03-02T00:00:00Z" },
    ]);
    insertMilestones(sqlite, [
      { id: "m2", project_id: "p1", name: "Launch", due_date: "2024-06-01" },
      { id: "m1", project_id: "p1", name: "Kickoff", due_date: "2024-04-01" },
    ]);

    apply(sqlite, "0004_milestone_as_task");

    const orders = Object.fromEntries(
      milestoneTasks(sqlite).map((r) => [r.id, r.sort_order])
    );
    expect(orders).toEqual({ "ms-m1": 2, "ms-m2": 3 });
  });

  it("leaves the source rows in place", () => {
    const sqlite = preMilestoneDb();
    insertMilestones(sqlite, [
      { id: "m1", project_id: "p1", name: "Kickoff", due_date: "2024-04-01" },
    ]);

    apply(sqlite, "0004_milestone_as_task");

    const count = sqlite
      .prepare("SELECT COUNT(*) AS n FROM milestone")
      .get() as { n: number };
    expect(count.n).toBe(1);
  });

  it("does not disturb ordinary tasks", () => {
    const sqlite = preMilestoneDb();
    insertTasks(sqlite, [
      { id: "keep", project_id: "p1", created_at: "2024-03-01T00:00:00Z" },
    ]);
    insertMilestones(sqlite, [
      { id: "m1", project_id: "p1", name: "Kickoff", due_date: "2024-04-01" },
    ]);

    apply(sqlite, "0004_milestone_as_task");

    const row = sqlite
      .prepare("SELECT id, title, kind, sort_order FROM task WHERE id = 'keep'")
      .get();
    expect(row).toEqual({
      id: "keep",
      title: "Task keep",
      kind: "task",
      sort_order: 0,
    });
  });
});

// ---------------------------------------------------------------------------
// 0005 — Brand → Project hierarchy
// ---------------------------------------------------------------------------

describe("0005 — brands contain projects", () => {
  it("preserves existing projects and files them under one safe default brand", () => {
    const sqlite = legacyDb();
    apply(sqlite, "0002_recovery_fields");
    apply(sqlite, "0003_task_hierarchy");
    apply(sqlite, "0004_milestone_as_task");
    sqlite
      .prepare(
        `INSERT INTO workspace (id, name, timezone, created_at)
         VALUES ('ws1', 'Workspace One', 'Asia/Seoul', '2024-01-01T00:00:00Z')`
      )
      .run();
    sqlite
      .prepare(
        `INSERT INTO project
           (id, workspace_id, name, project_lead_id, created_at, updated_at)
         VALUES
           ('p1', 'ws1', 'Project One', 'lead1', '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z'),
           ('p2', 'ws1', 'Project Two', 'lead1', '2024-01-02T00:00:00Z', '2024-01-02T00:00:00Z')`
      )
      .run();

    apply(sqlite, "0005_brand_project_hierarchy");

    const brands = sqlite
      .prepare("SELECT id, workspace_id, name FROM brand")
      .all();
    expect(brands).toEqual([
      {
        id: "brand-unfiled-ws1",
        workspace_id: "ws1",
        name: "브랜드 미지정",
      },
    ]);
    const projects = sqlite
      .prepare("SELECT id, name, brand_id FROM project ORDER BY id")
      .all();
    expect(projects).toEqual([
      { id: "p1", name: "Project One", brand_id: "brand-unfiled-ws1" },
      { id: "p2", name: "Project Two", brand_id: "brand-unfiled-ws1" },
    ]);
  });

  it("does not invent an empty default brand in a workspace with no projects", () => {
    const sqlite = legacyDb();
    apply(sqlite, "0002_recovery_fields");
    apply(sqlite, "0003_task_hierarchy");
    apply(sqlite, "0004_milestone_as_task");
    sqlite
      .prepare(
        `INSERT INTO workspace (id, name, timezone, created_at)
         VALUES ('empty', 'Empty', 'Asia/Seoul', '2024-01-01T00:00:00Z')`
      )
      .run();

    apply(sqlite, "0005_brand_project_hierarchy");

    const count = sqlite
      .prepare("SELECT COUNT(*) AS n FROM brand")
      .get() as { n: number };
    expect(count.n).toBe(0);
  });
});
