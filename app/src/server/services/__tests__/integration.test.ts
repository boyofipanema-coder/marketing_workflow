/**
 * Integration tests for the core task lifecycle.
 *
 * Uses better-sqlite3 + drizzle's SQLite adapter so tests run in-process
 * without needing a real D1 or wrangler connection.
 */

import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "@/server/db/schema";
import {
  createByTitle,
  editTask,
  cancelTask,
  restoreTask,
} from "@/server/services/task";
import {
  StaleVersionError,
  ValidationError,
  NotFoundError,
} from "@/server/services/errors";
import { searchTasks } from "@/lib/search";
import { myFocus, needsAttention, inProgress, waiting } from "@/lib/derive";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/** Create a fresh in-memory SQLite DB with the full schema. */
function makeDb() {
  const sqlite = new Database(":memory:");

  // Run schema DDL directly (same tables as D1 migration)
  sqlite.exec(`
    PRAGMA foreign_keys = OFF;
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS workspace (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      timezone TEXT NOT NULL DEFAULT 'Asia/Seoul',
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS member (
      id TEXT PRIMARY KEY NOT NULL,
      workspace_id TEXT NOT NULL,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member',
      FOREIGN KEY (workspace_id) REFERENCES workspace(id)
    );
    CREATE TABLE IF NOT EXISTS project (
      id TEXT PRIMARY KEY NOT NULL,
      workspace_id TEXT NOT NULL,
      name TEXT NOT NULL,
      one_line_objective TEXT,
      project_lead_id TEXT NOT NULL,
      target_start_date TEXT,
      target_end_date TEXT,
      archived_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (workspace_id) REFERENCES workspace(id),
      FOREIGN KEY (project_lead_id) REFERENCES member(id)
    );
    CREATE TABLE IF NOT EXISTS workstream (
      id TEXT PRIMARY KEY NOT NULL,
      project_id TEXT NOT NULL,
      name TEXT NOT NULL,
      "order" INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (project_id) REFERENCES project(id)
    );
    CREATE TABLE IF NOT EXISTS task (
      id TEXT PRIMARY KEY NOT NULL,
      workspace_id TEXT NOT NULL,
      project_id TEXT,
      workstream_id TEXT,
      parent_task_id TEXT REFERENCES task(id),
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'Inbox',
      assignee_id TEXT,
      reviewer_id TEXT,
      start_date TEXT,
      due_date TEXT,
      version INTEGER NOT NULL DEFAULT 1,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      completed_at TEXT,
      cancelled_at TEXT,
      FOREIGN KEY (workspace_id) REFERENCES workspace(id)
    );
    CREATE TABLE IF NOT EXISTS session (
      id TEXT PRIMARY KEY NOT NULL,
      member_id TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      FOREIGN KEY (member_id) REFERENCES member(id)
    );
    CREATE TABLE IF NOT EXISTS auth_account (
      id TEXT PRIMARY KEY NOT NULL,
      member_id TEXT NOT NULL,
      email TEXT NOT NULL,
      credential_hash TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (member_id) REFERENCES member(id)
    );
    CREATE TABLE IF NOT EXISTS milestone (
      id TEXT PRIMARY KEY NOT NULL,
      project_id TEXT NOT NULL,
      name TEXT NOT NULL,
      due_date TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES project(id)
    );
    CREATE TABLE IF NOT EXISTS activity_log (
      id TEXT PRIMARY KEY NOT NULL,
      workspace_id TEXT NOT NULL,
      task_id TEXT NOT NULL,
      actor_id TEXT NOT NULL,
      change_type TEXT NOT NULL,
      from_value TEXT,
      to_value TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (workspace_id) REFERENCES workspace(id),
      FOREIGN KEY (task_id) REFERENCES task(id),
      FOREIGN KEY (actor_id) REFERENCES member(id)
    );
  `);

  const db = drizzle(sqlite, { schema });

  // Polyfill db.batch for better-sqlite3 (D1-only API).
  // Runs each drizzle statement sequentially (not atomic, but sufficient for tests).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (db as any).batch = async (stmts: any[]) => {
    const results = [];
    for (const stmt of stmts) {
      results.push(await stmt);
    }
    return results;
  };

  return db;
}

type TestDb = ReturnType<typeof makeDb>;

const WS_ID = "ws_test";
const MEMBER_ID = "m_test";
const PROJECT_ID = "proj_test";
const NOW = new Date().toISOString();

function seedFixtures(db: TestDb) {
  db.insert(schema.workspace).values({
    id: WS_ID,
    name: "Test Workspace",
    timezone: "Asia/Seoul",
    created_at: NOW,
  }).run();

  db.insert(schema.member).values({
    id: MEMBER_ID,
    workspace_id: WS_ID,
    name: "Test User",
    email: "test@example.com",
    role: "admin",
  }).run();

  db.insert(schema.project).values({
    id: PROJECT_ID,
    workspace_id: WS_ID,
    name: "Test Project",
    one_line_objective: null,
    project_lead_id: MEMBER_ID,
    target_start_date: null,
    target_end_date: null,
    archived_at: null,
    created_at: NOW,
    updated_at: NOW,
  }).run();
}

// ---------------------------------------------------------------------------
// Core lifecycle: create → edit → Done → cancel → restore
// ---------------------------------------------------------------------------

describe("Task lifecycle — create → edit → Done → cancel → restore", () => {
  let db: TestDb;

  beforeEach(() => {
    db = makeDb();
    seedFixtures(db);
  });

  it("creates an Inbox task and returns it", async () => {
    const task = await createByTitle(db as never, {
      title: "My new task",
      memberId: MEMBER_ID,
      workspaceId: WS_ID,
    });

    expect(task.title).toBe("My new task");
    expect(task.status).toBe("Inbox");
    expect(task.version).toBe(1);
    expect(task.created_by).toBe(MEMBER_ID);
    expect(task.cancelled_at).toBeNull();
  });

  it("edits a task title", async () => {
    const task = await createByTitle(db as never, {
      title: "Original",
      memberId: MEMBER_ID,
      workspaceId: WS_ID,
    });

    const updated = await editTask(
      db as never,
      task.id,
      { title: "Updated", actor_id: MEMBER_ID },
      1
    );

    expect(updated.title).toBe("Updated");
    expect(updated.version).toBe(2);
  });

  it("marks a task Done and records completed_at", async () => {
    const task = await createByTitle(db as never, {
      title: "Task to complete",
      memberId: MEMBER_ID,
      workspaceId: WS_ID,
    });

    // Move to InProgress first (needs project)
    const inProg = await editTask(
      db as never,
      task.id,
      { status: "InProgress", project_id: PROJECT_ID, actor_id: MEMBER_ID },
      1
    );
    expect(inProg.status).toBe("InProgress");

    // Mark Done
    const done = await editTask(
      db as never,
      inProg.id,
      { status: "Done", actor_id: MEMBER_ID },
      2
    );
    expect(done.status).toBe("Done");
    expect(done.completed_at).toBeTruthy();
  });

  it("cancels a task and freezes edits", async () => {
    const task = await createByTitle(db as never, {
      title: "Task to cancel",
      memberId: MEMBER_ID,
      workspaceId: WS_ID,
    });

    const cancelled = await cancelTask(db as never, task.id, MEMBER_ID);
    expect(cancelled.cancelled_at).toBeTruthy();

    // Editing should throw
    await expect(
      editTask(db as never, task.id, { title: "New title", actor_id: MEMBER_ID }, cancelled.version)
    ).rejects.toThrow(ValidationError);
  });

  it("restores a cancelled task and allows edits again", async () => {
    const task = await createByTitle(db as never, {
      title: "Restore me",
      memberId: MEMBER_ID,
      workspaceId: WS_ID,
    });

    const cancelled = await cancelTask(db as never, task.id, MEMBER_ID);
    const restored = await restoreTask(db as never, task.id, MEMBER_ID);

    expect(restored.cancelled_at).toBeNull();

    // Should be editable again
    const edited = await editTask(
      db as never,
      restored.id,
      { title: "Restored and edited", actor_id: MEMBER_ID },
      restored.version
    );
    expect(edited.title).toBe("Restored and edited");
  });
});

// ---------------------------------------------------------------------------
// Stale version (409) path
// ---------------------------------------------------------------------------

describe("Optimistic concurrency — stale version", () => {
  let db: TestDb;

  beforeEach(() => {
    db = makeDb();
    seedFixtures(db);
  });

  it("throws StaleVersionError when baseVersion is stale", async () => {
    const task = await createByTitle(db as never, {
      title: "Concurrency test",
      memberId: MEMBER_ID,
      workspaceId: WS_ID,
    });

    // First edit succeeds → version is now 2
    await editTask(db as never, task.id, { title: "First edit", actor_id: MEMBER_ID }, 1);

    // Second edit with old baseVersion should fail
    await expect(
      editTask(db as never, task.id, { title: "Stale edit", actor_id: MEMBER_ID }, 1)
    ).rejects.toThrow(StaleVersionError);
  });

  it("edit succeeds with correct version after a prior edit", async () => {
    const task = await createByTitle(db as never, {
      title: "Versioned task",
      memberId: MEMBER_ID,
      workspaceId: WS_ID,
    });

    const v2 = await editTask(db as never, task.id, { title: "Edit 1", actor_id: MEMBER_ID }, 1);
    expect(v2.version).toBe(2);

    const v3 = await editTask(db as never, v2.id, { title: "Edit 2", actor_id: MEMBER_ID }, 2);
    expect(v3.version).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Validation errors
// ---------------------------------------------------------------------------

describe("Validation errors", () => {
  let db: TestDb;

  beforeEach(() => {
    db = makeDb();
    seedFixtures(db);
  });

  it("throws ValidationError for empty title", async () => {
    await expect(
      createByTitle(db as never, {
        title: "   ",
        memberId: MEMBER_ID,
        workspaceId: WS_ID,
      })
    ).rejects.toThrow(ValidationError);
  });

  it("throws NotFoundError for a missing task id", async () => {
    await expect(
      editTask(db as never, "nonexistent-task", { actor_id: MEMBER_ID }, 1)
    ).rejects.toThrow(NotFoundError);
  });

  it("throws ValidationError moving Inbox to ToDo without project_id", async () => {
    const task = await createByTitle(db as never, {
      title: "Needs project",
      memberId: MEMBER_ID,
      workspaceId: WS_ID,
    });

    await expect(
      editTask(db as never, task.id, { status: "ToDo", actor_id: MEMBER_ID }, 1)
    ).rejects.toThrow(ValidationError);
  });
});

// ---------------------------------------------------------------------------
// Filter / search semantics
// ---------------------------------------------------------------------------

describe("Filter semantics — derive.ts predicates", () => {
  it("myFocus returns InProgress + Review tasks for the viewer", () => {
    const now = new Date();
    const tasks: schema.Task[] = [
      makeTask({ id: "t1", assignee_id: "user1", status: "InProgress" }),
      makeTask({ id: "t2", assignee_id: "user1", status: "Review" }),
      makeTask({ id: "t3", assignee_id: "user1", status: "ToDo" }),
      makeTask({ id: "t4", assignee_id: "user2", status: "InProgress" }),
    ];

    const result = myFocus(tasks, "user1");
    const ids = result.map((t) => t.id);
    expect(ids).toContain("t1");
    expect(ids).toContain("t2");
    expect(ids).not.toContain("t3");
    expect(ids).not.toContain("t4");
  });

  it("needsAttention returns overdue non-Done tasks", () => {
    const now = new Date();
    const past = new Date();
    past.setDate(past.getDate() - 5);
    const future = new Date();
    future.setDate(future.getDate() + 5);

    const tasks: schema.Task[] = [
      makeTask({
        id: "overdue",
        status: "InProgress",
        due_date: past.toISOString().slice(0, 10),
      }),
      makeTask({
        id: "future",
        status: "InProgress",
        due_date: future.toISOString().slice(0, 10),
      }),
      makeTask({
        id: "done-overdue",
        status: "Done",
        due_date: past.toISOString().slice(0, 10),
      }),
    ];

    const result = needsAttention(tasks, now);
    const ids = result.map((t) => t.id);
    expect(ids).toContain("overdue");
    expect(ids).not.toContain("future");
    expect(ids).not.toContain("done-overdue");
  });

  it("searchTasks finds tasks by title keyword", () => {
    const tasks: schema.Task[] = [
      makeTask({ id: "t1", title: "Write editorial copy", due_date: "2099-01-01" }),
      makeTask({ id: "t2", title: "Review campaign assets", due_date: "2099-01-01" }),
      makeTask({ id: "t3", title: "Research competitors", due_date: "2099-01-01" }),
    ];

    const result = searchTasks(tasks, { query: "editorial" });
    expect(result.map((t) => t.id)).toEqual(["t1"]);
  });

  it("searchTasks is case-insensitive", () => {
    const tasks: schema.Task[] = [
      makeTask({ id: "t1", title: "Campaign Launch", due_date: "2099-01-01" }),
    ];
    const result = searchTasks(tasks, { query: "launch" });
    expect(result.length).toBe(1);
  });

  it("searchTasks returns empty for no match", () => {
    const tasks: schema.Task[] = [
      makeTask({ id: "t1", title: "Unrelated task", due_date: "2099-01-01" }),
    ];
    const result = searchTasks(tasks, { query: "xyz123" });
    expect(result.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Fixture helper
// ---------------------------------------------------------------------------

function makeTask(overrides: Partial<schema.Task> = {}): schema.Task {
  return {
    id: crypto.randomUUID(),
    workspace_id: WS_ID,
    project_id: PROJECT_ID,
    workstream_id: null,
    parent_task_id: null,
    title: "Default task",
    description: null,
    status: "Inbox",
    assignee_id: null,
    reviewer_id: null,
    start_date: null,
    due_date: null,
    version: 1,
    created_by: MEMBER_ID,
    created_at: NOW,
    updated_at: NOW,
    completed_at: null,
    cancelled_at: null,
    ...overrides,
  };
}
