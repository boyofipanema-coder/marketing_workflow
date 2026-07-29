import { describe, it, expect } from "vitest";
import {
  todayKST,
  isOverdue,
  isBacklog,
  comingNext,
  needsAttention,
  myFocus,
  todayTasks,
  thisWeek,
  inProgress,
  waiting,
  review,
  later,
  teamInMotion,
  teamWaiting,
} from "../derive";
import type { Task } from "@/server/db/schema";
import { makeTaskFixture } from "@/server/db/fixtures";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeTask(overrides: Partial<Task> = {}): Task {
  return makeTaskFixture(overrides);
}

// A fixed "now" in UTC that corresponds to 2024-03-15 in KST
// KST = UTC+9, so 2024-03-15T00:00:00 KST = 2024-03-14T15:00:00 UTC
const NOW_KST_2024_03_15 = new Date("2024-03-14T15:00:00Z");

// ---------------------------------------------------------------------------
// todayKST
// ---------------------------------------------------------------------------

describe("todayKST", () => {
  it("returns today in KST from a UTC Date", () => {
    expect(todayKST(NOW_KST_2024_03_15)).toBe("2024-03-15");
  });

  it("returns KST date not UTC date when they differ", () => {
    // 2024-03-14T23:30:00 UTC = 2024-03-15T08:30:00 KST
    const utcLate = new Date("2024-03-14T23:30:00Z");
    expect(todayKST(utcLate)).toBe("2024-03-15");
  });
});

// ---------------------------------------------------------------------------
// isOverdue
// ---------------------------------------------------------------------------

describe("isOverdue", () => {
  const now = NOW_KST_2024_03_15; // today KST = 2024-03-15

  it("returns true when dueDate < today and status != Done and not cancelled", () => {
    const t = makeTask({ due_date: "2024-03-14", status: "InProgress" });
    expect(isOverdue(t, now)).toBe(true);
  });

  it("returns false when dueDate === today (not strictly overdue)", () => {
    const t = makeTask({ due_date: "2024-03-15", status: "InProgress" });
    expect(isOverdue(t, now)).toBe(false);
  });

  it("returns false when dueDate > today", () => {
    const t = makeTask({ due_date: "2024-03-16", status: "InProgress" });
    expect(isOverdue(t, now)).toBe(false);
  });

  it("returns false when status === Done", () => {
    const t = makeTask({ due_date: "2024-03-14", status: "Done" });
    expect(isOverdue(t, now)).toBe(false);
  });

  it("returns false when cancelled_at is set", () => {
    const t = makeTask({
      due_date: "2024-03-14",
      status: "InProgress",
      cancelled_at: "2024-03-10T00:00:00Z",
    });
    expect(isOverdue(t, now)).toBe(false);
  });

  it("returns false when due_date is null", () => {
    const t = makeTask({ due_date: null, status: "InProgress" });
    expect(isOverdue(t, now)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isBacklog
// ---------------------------------------------------------------------------

describe("isBacklog", () => {
  it("returns true when status=ToDo and start_date=null", () => {
    const t = makeTask({ status: "ToDo", start_date: null });
    expect(isBacklog(t)).toBe(true);
  });

  it("returns false when status=ToDo but start_date is set", () => {
    const t = makeTask({ status: "ToDo", start_date: "2024-03-20" });
    expect(isBacklog(t)).toBe(false);
  });

  it("returns false when status=InProgress", () => {
    const t = makeTask({ status: "InProgress", start_date: null });
    expect(isBacklog(t)).toBe(false);
  });

  it("returns false when status=Inbox", () => {
    const t = makeTask({ status: "Inbox", start_date: null });
    expect(isBacklog(t)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// comingNext
// ---------------------------------------------------------------------------

describe("comingNext", () => {
  const now = NOW_KST_2024_03_15; // today KST = 2024-03-15

  it("includes tasks with startDate === today", () => {
    const t = makeTask({ status: "ToDo", start_date: "2024-03-15" });
    expect(comingNext([t], now)).toContain(t);
  });

  it("includes tasks with startDate === today+7", () => {
    const t = makeTask({ status: "ToDo", start_date: "2024-03-22" });
    expect(comingNext([t], now)).toContain(t);
  });

  it("excludes tasks with startDate === today+8", () => {
    const t = makeTask({ status: "ToDo", start_date: "2024-03-23" });
    expect(comingNext([t], now)).not.toContain(t);
  });

  it("excludes tasks with startDate < today", () => {
    const t = makeTask({ status: "ToDo", start_date: "2024-03-14" });
    expect(comingNext([t], now)).not.toContain(t);
  });

  it("excludes tasks with status != ToDo", () => {
    const t = makeTask({ status: "InProgress", start_date: "2024-03-15" });
    expect(comingNext([t], now)).not.toContain(t);
  });

  it("excludes tasks with null start_date", () => {
    const t = makeTask({ status: "ToDo", start_date: null });
    expect(comingNext([t], now)).not.toContain(t);
  });

  it("excludes cancelled tasks", () => {
    const t = makeTask({
      status: "ToDo",
      start_date: "2024-03-15",
      cancelled_at: "2024-03-10T00:00:00Z",
    });
    expect(comingNext([t], now)).not.toContain(t);
  });
});

// ---------------------------------------------------------------------------
// needsAttention (overdue in workspace)
// ---------------------------------------------------------------------------

describe("needsAttention", () => {
  const now = NOW_KST_2024_03_15;

  it("includes overdue tasks from any assignee", () => {
    const t1 = makeTask({
      id: "t1",
      due_date: "2024-03-14",
      status: "InProgress",
      assignee_id: "user-a",
    });
    const t2 = makeTask({
      id: "t2",
      due_date: "2024-03-14",
      status: "ToDo",
      assignee_id: "user-b",
    });
    const result = needsAttention([t1, t2], now);
    expect(result).toContain(t1);
    expect(result).toContain(t2);
  });

  it("excludes cancelled tasks", () => {
    const t = makeTask({
      due_date: "2024-03-14",
      status: "InProgress",
      cancelled_at: "2024-03-10T00:00:00Z",
    });
    expect(needsAttention([t], now)).not.toContain(t);
  });
});

// ---------------------------------------------------------------------------
// myFocus
// ---------------------------------------------------------------------------

describe("myFocus", () => {
  it("returns tasks assigned to viewer with InProgress or Review status", () => {
    const t1 = makeTask({ id: "t1", assignee_id: "v", status: "InProgress" });
    const t2 = makeTask({ id: "t2", assignee_id: "v", status: "Review" });
    const t3 = makeTask({ id: "t3", assignee_id: "v", status: "ToDo" });
    const t4 = makeTask({ id: "t4", assignee_id: "other", status: "InProgress" });
    const result = myFocus([t1, t2, t3, t4], "v");
    expect(result).toContain(t1);
    expect(result).toContain(t2);
    expect(result).not.toContain(t3);
    expect(result).not.toContain(t4);
  });
});

// ---------------------------------------------------------------------------
// todayTasks
// ---------------------------------------------------------------------------

describe("todayTasks", () => {
  const now = NOW_KST_2024_03_15;

  it("returns tasks assigned to viewer with dueDate === today", () => {
    const t1 = makeTask({
      id: "t1",
      assignee_id: "v",
      due_date: "2024-03-15",
    });
    const t2 = makeTask({
      id: "t2",
      assignee_id: "v",
      due_date: "2024-03-16",
    });
    const result = todayTasks([t1, t2], "v", now);
    expect(result).toContain(t1);
    expect(result).not.toContain(t2);
  });
});

// ---------------------------------------------------------------------------
// thisWeek
// ---------------------------------------------------------------------------

describe("thisWeek", () => {
  // 2024-03-15 is a Friday. ISO week Mon=2024-03-11, Sun=2024-03-17
  const now = NOW_KST_2024_03_15;

  it("returns tasks assigned to viewer with dueDate within current ISO week", () => {
    const mon = makeTask({ id: "mon", assignee_id: "v", due_date: "2024-03-11" });
    const fri = makeTask({ id: "fri", assignee_id: "v", due_date: "2024-03-15" });
    const sun = makeTask({ id: "sun", assignee_id: "v", due_date: "2024-03-17" });
    const nextMon = makeTask({ id: "nmon", assignee_id: "v", due_date: "2024-03-18" });
    const result = thisWeek([mon, fri, sun, nextMon], "v", now);
    expect(result).toContain(mon);
    expect(result).toContain(fri);
    expect(result).toContain(sun);
    expect(result).not.toContain(nextMon);
  });
});

// ---------------------------------------------------------------------------
// inProgress
// ---------------------------------------------------------------------------

describe("inProgress", () => {
  it("returns tasks assigned to viewer with status InProgress", () => {
    const t = makeTask({ assignee_id: "v", status: "InProgress" });
    const other = makeTask({ id: "t2", assignee_id: "v", status: "Waiting" });
    const result = inProgress([t, other], "v");
    expect(result).toContain(t);
    expect(result).not.toContain(other);
  });
});

// ---------------------------------------------------------------------------
// waiting
// ---------------------------------------------------------------------------

describe("waiting", () => {
  it("returns tasks assigned to viewer with status Waiting", () => {
    const t = makeTask({ assignee_id: "v", status: "Waiting" });
    const other = makeTask({ id: "t2", assignee_id: "v", status: "InProgress" });
    const result = waiting([t, other], "v");
    expect(result).toContain(t);
    expect(result).not.toContain(other);
  });
});

// ---------------------------------------------------------------------------
// review
// ---------------------------------------------------------------------------

describe("review", () => {
  it("does not use the retired reviewer field", () => {
    const t = makeTask({ status: "Review", reviewer_id: "v", assignee_id: "other" });
    expect(review([t], "v")).not.toContain(t);
  });

  it("includes tasks where viewer is assignee", () => {
    const t = makeTask({ status: "Review", reviewer_id: "other", assignee_id: "v" });
    expect(review([t], "v")).toContain(t);
  });

  it("excludes tasks not in Review status", () => {
    const t = makeTask({ status: "InProgress", reviewer_id: "v" });
    expect(review([t], "v")).not.toContain(t);
  });
});

// ---------------------------------------------------------------------------
// later
// ---------------------------------------------------------------------------

describe("later", () => {
  it("returns backlog tasks for viewer", () => {
    const t = makeTask({ assignee_id: "v", status: "ToDo", start_date: null });
    const t2 = makeTask({
      id: "t2",
      assignee_id: "v",
      status: "ToDo",
      start_date: "2024-03-20",
    });
    const result = later([t, t2], "v");
    expect(result).toContain(t);
    expect(result).not.toContain(t2);
  });
});

// ---------------------------------------------------------------------------
// Follow-up
// ---------------------------------------------------------------------------

// The point of recording a next-check date is that the task returns on its own.
describe("needsAttention — follow-up", () => {
  const waiting = (followUp: string | null) =>
    makeTask({
      status: "Waiting",
      due_date: null,
      waiting_party_text: "본사 회신",
      follow_up_at: followUp,
    });

  it("surfaces a Waiting task once its follow-up date arrives", () => {
    const t = waiting("2024-03-15"); // today in KST
    expect(needsAttention([t], NOW_KST_2024_03_15)).toContain(t);
  });

  it("surfaces one whose follow-up date has passed", () => {
    const t = waiting("2024-03-10");
    expect(needsAttention([t], NOW_KST_2024_03_15)).toContain(t);
  });

  it("leaves a follow-up still in the future alone", () => {
    const t = waiting("2024-03-20");
    expect(needsAttention([t], NOW_KST_2024_03_15)).not.toContain(t);
  });

  it("ignores a Waiting task with no follow-up date", () => {
    const t = waiting(null);
    expect(needsAttention([t], NOW_KST_2024_03_15)).not.toContain(t);
  });
});

// ---------------------------------------------------------------------------
// Milestones are markers, not work
// ---------------------------------------------------------------------------

// A milestone is a task with kind = "milestone" (migration 0004). Every one of
// these sections is a count of what someone has to DO, so a deadline showing
// up in "진행 중" or "지금 할 일" would be a lie about workload.
describe("milestones are excluded from every derived section", () => {
  it("does not count a milestone in teamInMotion even when its status is InProgress", () => {
    const ms = makeTask({ kind: "milestone", status: "InProgress" });
    expect(teamInMotion([ms])).not.toContain(ms);
  });

  it("does not count a milestone in myFocus even when assigned and InProgress", () => {
    const ms = makeTask({
      kind: "milestone",
      assignee_id: "v",
      status: "InProgress",
    });
    expect(myFocus([ms], "v")).not.toContain(ms);
  });

  it("does not count an overdue milestone in needsAttention", () => {
    const ms = makeTask({
      kind: "milestone",
      status: "ToDo",
      due_date: "2024-01-01",
    });
    expect(needsAttention([ms], NOW_KST_2024_03_15)).not.toContain(ms);
  });

  it("does not count a milestone in teamWaiting", () => {
    const ms = makeTask({ kind: "milestone", status: "Waiting" });
    expect(teamWaiting([ms])).not.toContain(ms);
  });
});

// ---------------------------------------------------------------------------
// Sort order
// ---------------------------------------------------------------------------

describe("sort order", () => {
  it("sorts by dueDate asc, nulls last", () => {
    const t1 = makeTask({ id: "t1", assignee_id: "v", status: "InProgress", due_date: "2024-03-20" });
    const t2 = makeTask({ id: "t2", assignee_id: "v", status: "InProgress", due_date: null });
    const t3 = makeTask({ id: "t3", assignee_id: "v", status: "InProgress", due_date: "2024-03-18" });
    const result = inProgress([t1, t2, t3], "v");
    expect(result[0]).toBe(t3);
    expect(result[1]).toBe(t1);
    expect(result[2]).toBe(t2);
  });
});
