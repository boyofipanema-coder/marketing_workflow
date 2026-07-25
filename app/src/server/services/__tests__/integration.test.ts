/**
 * Integration tests for the core task lifecycle.
 *
 * The database is built by applying the real Drizzle migrations to an in-memory
 * SQLite file (see server/db/testing.ts), so the schema under test is always the
 * schema that ships.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import * as schema from "@/server/db/schema";
import { makeTestDb, type TestDb } from "@/server/db/testing";
import { makeTaskFixture } from "@/server/db/fixtures";
import {
  createByTitle,
  createProjectTask,
  createSubtask,
  editTask,
  completeTask,
  reopenTask,
  cancelTask,
  restoreTask,
  reorderTasks,
} from "@/server/services/task";
import {
  createProject,
  editProject,
  archiveProject,
  restoreProject,
} from "@/server/services/project";
import { createWorkstream } from "@/server/services/workstream";
import { createMilestone, editMilestone } from "@/server/services/milestone";
import {
  StaleVersionError,
  ValidationError,
  NotFoundError,
} from "@/server/services/errors";
import { searchTasks } from "@/lib/search";
import { myFocus, needsAttention } from "@/lib/derive";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const WS_ID = "ws_test";
const OTHER_WS_ID = "ws_other";
const MEMBER_ID = "m_test";
const OTHER_MEMBER_ID = "m_other";
const PROJECT_ID = "proj_test";
const OTHER_PROJECT_ID = "proj_other";
const NOW = new Date().toISOString();

/**
 * Seeds two independent workspaces so every boundary test has a real
 * "someone else's row" to aim at rather than just a missing id.
 */
function seedFixtures(db: TestDb) {
  for (const [wsId, memberId, projectId] of [
    [WS_ID, MEMBER_ID, PROJECT_ID],
    [OTHER_WS_ID, OTHER_MEMBER_ID, OTHER_PROJECT_ID],
  ] as const) {
    db.insert(schema.workspace)
      .values({
        id: wsId,
        name: `Workspace ${wsId}`,
        timezone: "Asia/Seoul",
        created_at: NOW,
      })
      .run();

    db.insert(schema.member)
      .values({
        id: memberId,
        workspace_id: wsId,
        name: `User ${memberId}`,
        email: `${memberId}@example.com`,
        role: "admin",
      })
      .run();

    db.insert(schema.project)
      .values({
        id: projectId,
        workspace_id: wsId,
        name: `Project ${projectId}`,
        one_line_objective: null,
        project_lead_id: memberId,
        target_start_date: null,
        target_end_date: null,
        archived_at: null,
        created_at: NOW,
        updated_at: NOW,
      })
      .run();
  }
}

function freshDb(): TestDb {
  const db = makeTestDb();
  seedFixtures(db);
  return db;
}

// ---------------------------------------------------------------------------
// Core lifecycle: create → edit → Done → cancel → restore
// ---------------------------------------------------------------------------

describe("Task lifecycle — create → edit → Done → cancel → restore", () => {
  let db: TestDb;

  beforeEach(() => {
    db = freshDb();
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
      WS_ID,
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

    const inProg = await editTask(
      db as never,
      task.id,
      WS_ID,
      { status: "InProgress", project_id: PROJECT_ID, actor_id: MEMBER_ID },
      1
    );
    expect(inProg.status).toBe("InProgress");

    const done = await completeTask(
      db as never,
      inProg.id,
      WS_ID,
      MEMBER_ID,
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

    const cancelled = await cancelTask(db as never, task.id, WS_ID, MEMBER_ID);
    expect(cancelled.cancelled_at).toBeTruthy();

    await expect(
      editTask(
        db as never,
        task.id,
        WS_ID,
        { title: "New title", actor_id: MEMBER_ID },
        cancelled.version
      )
    ).rejects.toThrow(ValidationError);
  });

  it("refuses to complete a cancelled task", async () => {
    const task = await createProjectTask(db as never, {
      workspaceId: WS_ID,
      projectId: PROJECT_ID,
      title: "Cancelled then completed",
      memberId: MEMBER_ID,
    });
    const cancelled = await cancelTask(db as never, task.id, WS_ID, MEMBER_ID);

    await expect(
      completeTask(db as never, task.id, WS_ID, MEMBER_ID, cancelled.version)
    ).rejects.toThrow(ValidationError);
  });

  it("restores a cancelled task and allows edits again", async () => {
    const task = await createByTitle(db as never, {
      title: "Restore me",
      memberId: MEMBER_ID,
      workspaceId: WS_ID,
    });

    await cancelTask(db as never, task.id, WS_ID, MEMBER_ID);
    const restored = await restoreTask(db as never, task.id, WS_ID, MEMBER_ID);

    expect(restored.cancelled_at).toBeNull();

    const edited = await editTask(
      db as never,
      restored.id,
      WS_ID,
      { title: "Restored and edited", actor_id: MEMBER_ID },
      restored.version
    );
    expect(edited.title).toBe("Restored and edited");
  });
});

// ---------------------------------------------------------------------------
// Complete / reopen
// ---------------------------------------------------------------------------

describe("Complete and reopen", () => {
  let db: TestDb;

  beforeEach(() => {
    db = freshDb();
  });

  it("reopen restores the status held before completion", async () => {
    const task = await createProjectTask(db as never, {
      workspaceId: WS_ID,
      projectId: PROJECT_ID,
      title: "Reopen me",
      memberId: MEMBER_ID,
    });

    const inProg = await editTask(
      db as never,
      task.id,
      WS_ID,
      { status: "InProgress", actor_id: MEMBER_ID },
      task.version
    );
    const done = await completeTask(
      db as never,
      task.id,
      WS_ID,
      MEMBER_ID,
      inProg.version
    );

    const reopened = await reopenTask(
      db as never,
      task.id,
      WS_ID,
      MEMBER_ID,
      done.version
    );

    expect(reopened.status).toBe("InProgress");
    expect(reopened.completed_at).toBeNull();
  });

  it("reopen falls back to ToDo when no prior status was logged", async () => {
    const task = await createProjectTask(db as never, {
      workspaceId: WS_ID,
      projectId: PROJECT_ID,
      title: "No history",
      memberId: MEMBER_ID,
    });

    // Complete straight from ToDo, then wipe the status history so the lookup
    // finds nothing — mirrors a task completed before logging existed.
    const done = await completeTask(
      db as never,
      task.id,
      WS_ID,
      MEMBER_ID,
      task.version
    );
    db.delete(schema.activity_log).run();

    const reopened = await reopenTask(
      db as never,
      task.id,
      WS_ID,
      MEMBER_ID,
      done.version
    );
    expect(reopened.status).toBe("ToDo");
  });

  it("reopen rejects a task that is not Done", async () => {
    const task = await createProjectTask(db as never, {
      workspaceId: WS_ID,
      projectId: PROJECT_ID,
      title: "Still open",
      memberId: MEMBER_ID,
    });

    await expect(
      reopenTask(db as never, task.id, WS_ID, MEMBER_ID, task.version)
    ).rejects.toThrow(ValidationError);
  });
});

// ---------------------------------------------------------------------------
// Stale version (409) path
// ---------------------------------------------------------------------------

describe("Optimistic concurrency — stale version", () => {
  let db: TestDb;

  beforeEach(() => {
    db = freshDb();
  });

  it("throws StaleVersionError when baseVersion is stale", async () => {
    const task = await createByTitle(db as never, {
      title: "Concurrency test",
      memberId: MEMBER_ID,
      workspaceId: WS_ID,
    });

    await editTask(
      db as never,
      task.id,
      WS_ID,
      { title: "First edit", actor_id: MEMBER_ID },
      1
    );

    await expect(
      editTask(
        db as never,
        task.id,
        WS_ID,
        { title: "Stale edit", actor_id: MEMBER_ID },
        1
      )
    ).rejects.toThrow(StaleVersionError);
  });

  it("a rejected stale write leaves the winner's value intact", async () => {
    const task = await createByTitle(db as never, {
      title: "Original",
      memberId: MEMBER_ID,
      workspaceId: WS_ID,
    });

    await editTask(
      db as never,
      task.id,
      WS_ID,
      { title: "Winner", actor_id: MEMBER_ID },
      1
    );
    await expect(
      editTask(
        db as never,
        task.id,
        WS_ID,
        { title: "Loser", actor_id: MEMBER_ID },
        1
      )
    ).rejects.toThrow(StaleVersionError);

    const [stored] = db
      .select()
      .from(schema.task)
      .where(eqId(task.id))
      .all() as schema.Task[];
    expect(stored!.title).toBe("Winner");
    expect(stored!.version).toBe(2);
  });

  /**
   * The version guard must live in the UPDATE's WHERE clause, not only in the
   * read-then-compare step — otherwise two writers that both read version N
   * would both pass the check and the second would clobber the first.
   */
  it("the SQL guard itself rejects a write whose version moved underneath it", async () => {
    const task = await createByTitle(db as never, {
      title: "Guarded",
      memberId: MEMBER_ID,
      workspaceId: WS_ID,
    });

    // Simulate a concurrent writer landing between our read and our write.
    db.update(schema.task)
      .set({ version: 2, title: "Snuck in" })
      .where(eqId(task.id))
      .run();

    await expect(
      editTask(
        db as never,
        task.id,
        WS_ID,
        { title: "Should not land", actor_id: MEMBER_ID },
        1
      )
    ).rejects.toThrow(StaleVersionError);

    const [stored] = db
      .select()
      .from(schema.task)
      .where(eqId(task.id))
      .all() as schema.Task[];
    expect(stored!.title).toBe("Snuck in");
  });

  it("edit succeeds with correct version after a prior edit", async () => {
    const task = await createByTitle(db as never, {
      title: "Versioned task",
      memberId: MEMBER_ID,
      workspaceId: WS_ID,
    });

    const v2 = await editTask(
      db as never,
      task.id,
      WS_ID,
      { title: "Edit 1", actor_id: MEMBER_ID },
      1
    );
    expect(v2.version).toBe(2);

    const v3 = await editTask(
      db as never,
      v2.id,
      WS_ID,
      { title: "Edit 2", actor_id: MEMBER_ID },
      2
    );
    expect(v3.version).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Workspace boundary
// ---------------------------------------------------------------------------

describe("Workspace boundary", () => {
  let db: TestDb;

  beforeEach(() => {
    db = freshDb();
  });

  it("cannot edit a task belonging to another workspace", async () => {
    const task = await createByTitle(db as never, {
      title: "Private",
      memberId: MEMBER_ID,
      workspaceId: WS_ID,
    });

    await expect(
      editTask(
        db as never,
        task.id,
        OTHER_WS_ID,
        { title: "Stolen", actor_id: OTHER_MEMBER_ID },
        1
      )
    ).rejects.toThrow(NotFoundError);
  });

  it("cannot cancel or restore a task in another workspace", async () => {
    const task = await createByTitle(db as never, {
      title: "Private",
      memberId: MEMBER_ID,
      workspaceId: WS_ID,
    });

    await expect(
      cancelTask(db as never, task.id, OTHER_WS_ID, OTHER_MEMBER_ID)
    ).rejects.toThrow(NotFoundError);
  });

  it("cannot move a task into another workspace's project", async () => {
    const task = await createByTitle(db as never, {
      title: "Cross-workspace move",
      memberId: MEMBER_ID,
      workspaceId: WS_ID,
    });

    await expect(
      editTask(
        db as never,
        task.id,
        WS_ID,
        { project_id: OTHER_PROJECT_ID, actor_id: MEMBER_ID },
        1
      )
    ).rejects.toThrow(NotFoundError);
  });

  it("cannot create a task inside another workspace's project", async () => {
    await expect(
      createProjectTask(db as never, {
        workspaceId: WS_ID,
        projectId: OTHER_PROJECT_ID,
        title: "Trespassing",
        memberId: MEMBER_ID,
      })
    ).rejects.toThrow(NotFoundError);
  });

  it("cannot edit or archive another workspace's project", async () => {
    await expect(
      editProject(db as never, OTHER_PROJECT_ID, WS_ID, { name: "Renamed" })
    ).rejects.toThrow(NotFoundError);

    await expect(
      archiveProject(db as never, OTHER_PROJECT_ID, WS_ID)
    ).rejects.toThrow(NotFoundError);
  });

  it("cannot attach a workstream from another project", async () => {
    const foreignWs = await createWorkstream(db as never, {
      projectId: OTHER_PROJECT_ID,
      workspaceId: OTHER_WS_ID,
      name: "Foreign stream",
    });
    const task = await createProjectTask(db as never, {
      workspaceId: WS_ID,
      projectId: PROJECT_ID,
      title: "Mine",
      memberId: MEMBER_ID,
    });

    await expect(
      editTask(
        db as never,
        task.id,
        WS_ID,
        { workstream_id: foreignWs.id, actor_id: MEMBER_ID },
        task.version
      )
    ).rejects.toThrow(ValidationError);
  });

  it("cannot reorder tasks from another workspace", async () => {
    const mine = await createProjectTask(db as never, {
      workspaceId: WS_ID,
      projectId: PROJECT_ID,
      title: "Mine",
      memberId: MEMBER_ID,
    });
    const theirs = await createProjectTask(db as never, {
      workspaceId: OTHER_WS_ID,
      projectId: OTHER_PROJECT_ID,
      title: "Theirs",
      memberId: OTHER_MEMBER_ID,
    });

    await expect(
      reorderTasks(db as never, WS_ID, [mine.id, theirs.id], MEMBER_ID)
    ).rejects.toThrow(NotFoundError);
  });
});

// ---------------------------------------------------------------------------
// Project / workstream / milestone
// ---------------------------------------------------------------------------

describe("Project, workstream, milestone", () => {
  let db: TestDb;

  beforeEach(() => {
    db = freshDb();
  });

  it("creates and edits a project", async () => {
    const created = await createProject(db as never, {
      workspaceId: WS_ID,
      name: "New campaign",
      projectLeadId: MEMBER_ID,
      oneLineObjective: "Ship it",
    });
    expect(created.name).toBe("New campaign");

    const edited = await editProject(db as never, created.id, WS_ID, {
      name: "Renamed campaign",
    });
    expect(edited.name).toBe("Renamed campaign");
  });

  it("rejects a project lead from another workspace", async () => {
    await expect(
      createProject(db as never, {
        workspaceId: WS_ID,
        name: "Bad lead",
        projectLeadId: OTHER_MEMBER_ID,
      })
    ).rejects.toThrow(ValidationError);
  });

  it("rejects a start date after the end date", async () => {
    await expect(
      createProject(db as never, {
        workspaceId: WS_ID,
        name: "Backwards",
        projectLeadId: MEMBER_ID,
        targetStartDate: "2026-09-01",
        targetEndDate: "2026-08-01",
      })
    ).rejects.toThrow(ValidationError);
  });

  it("archives and restores a project instead of deleting it", async () => {
    const created = await createProject(db as never, {
      workspaceId: WS_ID,
      name: "Archivable",
      projectLeadId: MEMBER_ID,
    });

    const archived = await archiveProject(db as never, created.id, WS_ID);
    expect(archived.archived_at).toBeTruthy();

    // An archived project rejects further edits and new tasks.
    await expect(
      editProject(db as never, created.id, WS_ID, { name: "Nope" })
    ).rejects.toThrow(ValidationError);
    await expect(
      createProjectTask(db as never, {
        workspaceId: WS_ID,
        projectId: created.id,
        title: "Nope",
        memberId: MEMBER_ID,
      })
    ).rejects.toThrow(ValidationError);

    const restored = await restoreProject(db as never, created.id, WS_ID);
    expect(restored.archived_at).toBeNull();
  });

  it("appends new workstreams to the end of the project's order", async () => {
    const first = await createWorkstream(db as never, {
      projectId: PROJECT_ID,
      workspaceId: WS_ID,
      name: "First",
    });
    const second = await createWorkstream(db as never, {
      projectId: PROJECT_ID,
      workspaceId: WS_ID,
      name: "Second",
    });

    expect(first.order).toBe(0);
    expect(second.order).toBe(1);
  });

  it("creates and edits a milestone", async () => {
    const created = await createMilestone(db as never, {
      projectId: PROJECT_ID,
      workspaceId: WS_ID,
      name: "Launch",
      dueDate: "2026-09-01",
    });
    const edited = await editMilestone(db as never, created.id, WS_ID, {
      dueDate: "2026-09-15",
    });
    expect(edited.due_date).toBe("2026-09-15");
  });

  it("rejects a malformed milestone due date", async () => {
    await expect(
      createMilestone(db as never, {
        projectId: PROJECT_ID,
        workspaceId: WS_ID,
        name: "Bad date",
        dueDate: "2026/09/01",
      })
    ).rejects.toThrow(ValidationError);
  });
});

// ---------------------------------------------------------------------------
// Ordering
// ---------------------------------------------------------------------------

describe("Task ordering", () => {
  let db: TestDb;

  beforeEach(() => {
    db = freshDb();
  });

  it("assigns increasing sort_order to new project tasks", async () => {
    const a = await createProjectTask(db as never, {
      workspaceId: WS_ID,
      projectId: PROJECT_ID,
      title: "A",
      memberId: MEMBER_ID,
    });
    const b = await createProjectTask(db as never, {
      workspaceId: WS_ID,
      projectId: PROJECT_ID,
      title: "B",
      memberId: MEMBER_ID,
    });
    expect(b.sort_order).toBe(a.sort_order + 1);
  });

  it("persists a manual reorder", async () => {
    const a = await createProjectTask(db as never, {
      workspaceId: WS_ID,
      projectId: PROJECT_ID,
      title: "A",
      memberId: MEMBER_ID,
    });
    const b = await createProjectTask(db as never, {
      workspaceId: WS_ID,
      projectId: PROJECT_ID,
      title: "B",
      memberId: MEMBER_ID,
    });

    await reorderTasks(db as never, WS_ID, [b.id, a.id], MEMBER_ID);

    const rows = db.select().from(schema.task).all() as schema.Task[];
    const byId = new Map(rows.map((r) => [r.id, r]));
    expect(byId.get(b.id)!.sort_order).toBe(0);
    expect(byId.get(a.id)!.sort_order).toBe(1);
  });

  it("refuses to reorder tasks that live in different lists", async () => {
    const inProject = await createProjectTask(db as never, {
      workspaceId: WS_ID,
      projectId: PROJECT_ID,
      title: "In project",
      memberId: MEMBER_ID,
    });
    const inInbox = await createByTitle(db as never, {
      title: "In inbox",
      memberId: MEMBER_ID,
      workspaceId: WS_ID,
    });

    await expect(
      reorderTasks(db as never, WS_ID, [inProject.id, inInbox.id], MEMBER_ID)
    ).rejects.toThrow(ValidationError);
  });

  it("subtasks are ordered within their parent", async () => {
    const parent = await createProjectTask(db as never, {
      workspaceId: WS_ID,
      projectId: PROJECT_ID,
      title: "Parent",
      memberId: MEMBER_ID,
    });
    const first = await createSubtask(db as never, {
      parentId: parent.id,
      workspaceId: WS_ID,
      title: "Child 1",
      memberId: MEMBER_ID,
    });
    const second = await createSubtask(db as never, {
      parentId: parent.id,
      workspaceId: WS_ID,
      title: "Child 2",
      memberId: MEMBER_ID,
    });

    expect(first.sort_order).toBe(0);
    expect(second.sort_order).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Validation errors
// ---------------------------------------------------------------------------

describe("Validation errors", () => {
  let db: TestDb;

  beforeEach(() => {
    db = freshDb();
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

  it("throws ValidationError for a title over 200 characters", async () => {
    await expect(
      createByTitle(db as never, {
        title: "a".repeat(201),
        memberId: MEMBER_ID,
        workspaceId: WS_ID,
      })
    ).rejects.toThrow(ValidationError);
  });

  it("throws NotFoundError for a missing task id", async () => {
    await expect(
      editTask(
        db as never,
        "nonexistent-task",
        WS_ID,
        { actor_id: MEMBER_ID },
        1
      )
    ).rejects.toThrow(NotFoundError);
  });

  it("throws ValidationError moving Inbox to ToDo without project_id", async () => {
    const task = await createByTitle(db as never, {
      title: "Needs project",
      memberId: MEMBER_ID,
      workspaceId: WS_ID,
    });

    await expect(
      editTask(
        db as never,
        task.id,
        WS_ID,
        { status: "ToDo", actor_id: MEMBER_ID },
        1
      )
    ).rejects.toThrow(ValidationError);
  });

  it("rejects a malformed due date", async () => {
    const task = await createByTitle(db as never, {
      title: "Bad date",
      memberId: MEMBER_ID,
      workspaceId: WS_ID,
    });

    await expect(
      editTask(
        db as never,
        task.id,
        WS_ID,
        { due_date: "07/25/2026", actor_id: MEMBER_ID },
        1
      )
    ).rejects.toThrow(ValidationError);
  });

  it("rejects a due time with no due date", async () => {
    const task = await createByTitle(db as never, {
      title: "Time without date",
      memberId: MEMBER_ID,
      workspaceId: WS_ID,
    });

    await expect(
      editTask(
        db as never,
        task.id,
        WS_ID,
        { due_time: "14:00", actor_id: MEMBER_ID },
        1
      )
    ).rejects.toThrow(ValidationError);
  });

  it("rejects a malformed due time", async () => {
    const task = await createByTitle(db as never, {
      title: "Bad time",
      memberId: MEMBER_ID,
      workspaceId: WS_ID,
    });

    await expect(
      editTask(
        db as never,
        task.id,
        WS_ID,
        { due_date: "2026-08-01", due_time: "25:99", actor_id: MEMBER_ID },
        1
      )
    ).rejects.toThrow(ValidationError);
  });

  it("rejects a start date later than the due date", async () => {
    const task = await createByTitle(db as never, {
      title: "Backwards dates",
      memberId: MEMBER_ID,
      workspaceId: WS_ID,
    });

    await expect(
      editTask(
        db as never,
        task.id,
        WS_ID,
        {
          start_date: "2026-09-01",
          due_date: "2026-08-01",
          actor_id: MEMBER_ID,
        },
        1
      )
    ).rejects.toThrow(ValidationError);
  });
});

// ---------------------------------------------------------------------------
// Filter / search semantics
// ---------------------------------------------------------------------------

describe("Filter semantics — derive.ts predicates", () => {
  it("myFocus returns InProgress + Review tasks for the viewer", () => {
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
// Fixture helpers
// ---------------------------------------------------------------------------

function eqId(id: string) {
  return eq(schema.task.id, id);
}

function makeTask(overrides: Partial<schema.Task> = {}): schema.Task {
  return makeTaskFixture({
    id: crypto.randomUUID(),
    workspace_id: WS_ID,
    project_id: PROJECT_ID,
    status: "Inbox",
    created_by: MEMBER_ID,
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  });
}
