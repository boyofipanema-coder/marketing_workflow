import { describe, it, expect } from "vitest";
import { applyTaskEdit } from "../task";
import { StaleVersionError, ValidationError } from "../errors";
import type { Task } from "@/server/db/schema";
import { makeTaskFixture } from "@/server/db/fixtures";

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function makeTask(overrides: Partial<Task> = {}): Task {
  return makeTaskFixture({
    project_id: "proj-1",
    status: "Inbox",
    created_by: "member-1",
    ...overrides,
  });
}

const ACTOR = "member-1";
const NOW = "2024-06-01T12:00:00.000Z";

// ---------------------------------------------------------------------------
// Optimistic concurrency — version conflict path
// ---------------------------------------------------------------------------

describe("applyTaskEdit — version conflict", () => {
  it("throws StaleVersionError when baseVersion is lower than stored version", () => {
    const current = makeTask({ version: 3 });
    expect(() => applyTaskEdit(current, {}, 2, ACTOR, NOW)).toThrow(
      StaleVersionError
    );
  });

  it("throws StaleVersionError when baseVersion is higher than stored version", () => {
    const current = makeTask({ version: 3 });
    expect(() => applyTaskEdit(current, {}, 4, ACTOR, NOW)).toThrow(
      StaleVersionError
    );
  });

  it("throws StaleVersionError when baseVersion is a non-integer", () => {
    const current = makeTask({ version: 1 });
    expect(() => applyTaskEdit(current, {}, 1.5, ACTOR, NOW)).toThrow(
      StaleVersionError
    );
  });

  it("succeeds when baseVersion matches stored version", () => {
    const current = makeTask({ version: 5 });
    const result = applyTaskEdit(current, { title: "New title" }, 5, ACTOR, NOW);
    expect(result.updates.version).toBe(6);
    expect(result.updates.title).toBe("New title");
  });
});

// ---------------------------------------------------------------------------
// Done / cancel / restore transition logic
// ---------------------------------------------------------------------------

describe("applyTaskEdit — Done transition", () => {
  it("sets completed_at when status moves to Done", () => {
    const current = makeTask({ status: "InProgress" });
    const { updates, activityRows } = applyTaskEdit(
      current,
      { status: "Done" },
      1,
      ACTOR,
      NOW
    );
    expect(updates.status).toBe("Done");
    expect(updates.completed_at).toBe(NOW);
    expect(activityRows.some((r) => r.change_type === "status")).toBe(true);
  });

  it("clears completed_at when status leaves Done", () => {
    const current = makeTask({
      status: "Done",
      completed_at: "2024-05-01T00:00:00.000Z",
    });
    const { updates } = applyTaskEdit(
      current,
      { status: "InProgress" },
      1,
      ACTOR,
      NOW
    );
    expect(updates.status).toBe("InProgress");
    expect(updates.completed_at).toBeNull();
  });

  it("does not touch completed_at when status stays Done", () => {
    const current = makeTask({
      status: "Done",
      completed_at: "2024-05-01T00:00:00.000Z",
    });
    const { updates } = applyTaskEdit(
      current,
      { title: "Rename done task" },
      1,
      ACTOR,
      NOW
    );
    // completed_at should not be in updates (unchanged)
    expect(updates.completed_at).toBeUndefined();
  });

  it("increments version on success", () => {
    const current = makeTask({ version: 7 });
    const { updates } = applyTaskEdit(current, {}, 7, ACTOR, NOW);
    expect(updates.version).toBe(8);
  });
});

describe("applyTaskEdit — cancelled task guard", () => {
  it("throws ValidationError when trying to edit a cancelled task", () => {
    const current = makeTask({
      cancelled_at: "2024-05-01T00:00:00.000Z",
    });
    expect(() => applyTaskEdit(current, { title: "New" }, 1, ACTOR, NOW)).toThrow(
      ValidationError
    );
  });

  it("throws ValidationError when trying to mark a cancelled task as Done", () => {
    const current = makeTask({
      cancelled_at: "2024-05-01T00:00:00.000Z",
    });
    expect(() =>
      applyTaskEdit(current, { status: "Done" }, 1, ACTOR, NOW)
    ).toThrow(ValidationError);
  });
});

describe("applyTaskEdit — non-Inbox must have project", () => {
  it("throws ValidationError when moving out of Inbox without a project", () => {
    const current = makeTask({ status: "Inbox", project_id: null });
    expect(() =>
      applyTaskEdit(current, { status: "ToDo" }, 1, ACTOR, NOW)
    ).toThrow(ValidationError);
  });

  it("allows moving out of Inbox when patch supplies project_id", () => {
    const current = makeTask({ status: "Inbox", project_id: null });
    const { updates } = applyTaskEdit(
      current,
      { status: "ToDo", project_id: "proj-1" },
      1,
      ACTOR,
      NOW
    );
    expect(updates.status).toBe("ToDo");
    expect(updates.project_id).toBe("proj-1");
  });
});

describe("applyTaskEdit — activity log rows", () => {
  it("emits a status activity row on status change", () => {
    const current = makeTask({ status: "Inbox" });
    const { activityRows } = applyTaskEdit(
      current,
      { status: "InProgress", project_id: "proj-1" },
      1,
      ACTOR,
      NOW
    );
    const statusRow = activityRows.find((r) => r.change_type === "status");
    expect(statusRow).toBeDefined();
    expect(statusRow?.from_value).toBe("Inbox");
    expect(statusRow?.to_value).toBe("InProgress");
    expect(statusRow?.actor_id).toBe(ACTOR);
  });

  it("emits an assignee activity row on assignee change", () => {
    const current = makeTask({ assignee_id: null });
    const { activityRows } = applyTaskEdit(
      current,
      { assignee_id: "member-2" },
      1,
      ACTOR,
      NOW
    );
    const assigneeRow = activityRows.find((r) => r.change_type === "assignee");
    expect(assigneeRow).toBeDefined();
    expect(assigneeRow?.to_value).toBe("member-2");
  });

  it("emits a due_date activity row on due_date change", () => {
    const current = makeTask({ due_date: null });
    const { activityRows } = applyTaskEdit(
      current,
      { due_date: "2024-12-31" },
      1,
      ACTOR,
      NOW
    );
    const dateRow = activityRows.find((r) => r.change_type === "due_date");
    expect(dateRow).toBeDefined();
    expect(dateRow?.to_value).toBe("2024-12-31");
  });

  it("emits a title activity row on title change", () => {
    const current = makeTask();
    const { activityRows } = applyTaskEdit(
      current,
      { title: "New title" },
      1,
      ACTOR,
      NOW
    );
    expect(activityRows).toHaveLength(1);
    expect(activityRows[0]!.change_type).toBe("title");
    expect(activityRows[0]!.to_value).toBe("New title");
  });

  it("emits no activity rows when a field is re-set to its current value", () => {
    const current = makeTask({ title: "Same" });
    const { activityRows } = applyTaskEdit(
      current,
      { title: "Same" },
      1,
      ACTOR,
      NOW
    );
    expect(activityRows).toHaveLength(0);
  });

  // The description body is deliberately never copied into the log (plan §4.4).
  it("logs that the description changed without recording its contents", () => {
    const current = makeTask({ description: "old secret" });
    const { activityRows } = applyTaskEdit(
      current,
      { description: "new secret" },
      1,
      ACTOR,
      NOW
    );
    const row = activityRows.find((r) => r.change_type === "description");
    expect(row).toBeDefined();
    expect(row!.from_value).toBeNull();
    expect(row!.to_value).toBeNull();
  });
});

describe("applyTaskEdit — title validation", () => {
  it("throws ValidationError for an empty title", () => {
    const current = makeTask();
    expect(() =>
      applyTaskEdit(current, { title: "   " }, 1, ACTOR, NOW)
    ).toThrow(ValidationError);
  });

  it("throws ValidationError for a title exceeding 200 chars", () => {
    const current = makeTask();
    expect(() =>
      applyTaskEdit(current, { title: "a".repeat(201) }, 1, ACTOR, NOW)
    ).toThrow(ValidationError);
  });
});

// ---------------------------------------------------------------------------
// Importance is orthogonal to hierarchy and to status
// ---------------------------------------------------------------------------

describe("applyTaskEdit — importance", () => {
  it("promotes a task to key and logs who decided it", () => {
    const current = makeTask({ importance: "normal" });
    const { updates, activityRows } = applyTaskEdit(
      current,
      { importance: "key" },
      1,
      ACTOR,
      NOW
    );
    expect(updates.importance).toBe("key");
    const row = activityRows.find((r) => r.change_type === "importance");
    expect(row?.from_value).toBe("normal");
    expect(row?.to_value).toBe("key");
  });

  it("leaves status untouched when importance changes", () => {
    const current = makeTask({ status: "Waiting", importance: "normal" });
    const { updates } = applyTaskEdit(
      current,
      { importance: "key" },
      1,
      ACTOR,
      NOW
    );
    expect(updates.status).toBeUndefined();
    expect(updates.completed_at).toBeUndefined();
  });

  // A subtask being important is the whole point — depth must not constrain it.
  it("allows a subtask to be key", () => {
    const current = makeTask({ parent_task_id: "parent-1", importance: "normal" });
    const { updates } = applyTaskEdit(
      current,
      { importance: "key" },
      1,
      ACTOR,
      NOW
    );
    expect(updates.importance).toBe("key");
  });

  it("emits nothing when importance is re-set to its current value", () => {
    const current = makeTask({ importance: "key" });
    const { activityRows } = applyTaskEdit(
      current,
      { importance: "key" },
      1,
      ACTOR,
      NOW
    );
    expect(activityRows).toHaveLength(0);
  });

  // Waiting exists to make a stalled task come back on its own. Without both
  // facts it cannot, so the state must not be reachable without them.
  it("refuses Waiting without a party or a follow-up date", () => {
    const current = makeTask({ status: "ToDo", project_id: "p1" });
    expect(() =>
      applyTaskEdit(current, { status: "Waiting" }, 1, ACTOR, NOW)
    ).toThrow(ValidationError);
    expect(() =>
      applyTaskEdit(
        current,
        { status: "Waiting", waiting_party_text: "본사 회신" },
        1,
        ACTOR,
        NOW
      )
    ).toThrow(ValidationError);
  });

  it("accepts Waiting once both are given", () => {
    const current = makeTask({ status: "ToDo", project_id: "p1" });
    const { updates } = applyTaskEdit(
      current,
      {
        status: "Waiting",
        waiting_party_text: "본사 회신",
        follow_up_at: "2026-08-01",
      },
      1,
      ACTOR,
      NOW
    );
    expect(updates.status).toBe("Waiting");
    expect(updates.waiting_party_text).toBe("본사 회신");
    expect(updates.follow_up_at).toBe("2026-08-01");
  });

  // Rows that were Waiting before the fields existed must stay editable.
  it("does not block an unrelated edit to a task already Waiting", () => {
    const current = makeTask({ status: "Waiting", project_id: "p1" });
    const { updates } = applyTaskEdit(
      current,
      { title: "새 제목" },
      1,
      ACTOR,
      NOW
    );
    expect(updates.title).toBe("새 제목");
  });

  it("clears the follow-up when the task leaves Waiting", () => {
    const current = makeTask({
      status: "Waiting",
      project_id: "p1",
      waiting_party_text: "본사 회신",
      follow_up_at: "2026-08-01",
    });
    const { updates } = applyTaskEdit(
      current,
      { status: "InProgress" },
      1,
      ACTOR,
      NOW
    );
    expect(updates.waiting_party_text).toBeNull();
    expect(updates.follow_up_at).toBeNull();
  });

  it("converts a task to a milestone and logs the change", () => {
    const current = makeTask({ kind: "task" });
    const { updates, activityRows } = applyTaskEdit(
      current,
      { kind: "milestone" },
      1,
      ACTOR,
      NOW
    );
    expect(updates.kind).toBe("milestone");
    expect(activityRows.some((r) => r.change_type === "kind")).toBe(true);
  });
});
