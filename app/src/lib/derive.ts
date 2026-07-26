/**
 * derive.ts — read-time computation helpers in Asia/Seoul timezone.
 * All functions are pure (no DB access).
 */

import type { Task } from "@/server/db/schema";

// ---------------------------------------------------------------------------
// KST date helper
// ---------------------------------------------------------------------------

/**
 * Returns today's date string in YYYY-MM-DD format in Asia/Seoul timezone.
 */
export function todayKST(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/**
 * Returns the ISO week boundaries (Mon–Sun) for the given date in KST.
 * Returns { weekStart: "YYYY-MM-DD", weekEnd: "YYYY-MM-DD" }.
 */
export function currentISOWeekKST(now: Date): { weekStart: string; weekEnd: string } {
  const todayStr = todayKST(now);
  const [y, m, d] = todayStr.split("-").map(Number);
  const localDate = new Date(y!, m! - 1, d!);
  // ISO week: Mon=1 ... Sun=7; JS: Sun=0, Mon=1, ... Sat=6
  const dow = localDate.getDay(); // 0=Sun..6=Sat
  const diffToMon = dow === 0 ? -6 : 1 - dow;
  const monDate = new Date(localDate);
  monDate.setDate(localDate.getDate() + diffToMon);
  const sunDate = new Date(monDate);
  sunDate.setDate(monDate.getDate() + 6);

  const fmt = (dt: Date) =>
    `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;

  return { weekStart: fmt(monDate), weekEnd: fmt(sunDate) };
}

// ---------------------------------------------------------------------------
// Named derived states
// ---------------------------------------------------------------------------

/**
 * A task is overdue when:
 *   - dueDate < today (KST), AND
 *   - status !== "Done", AND
 *   - cancelledAt is null
 */
export function isOverdue(task: Task, now: Date): boolean {
  if (!task.due_date) return false;
  if (task.cancelled_at !== null && task.cancelled_at !== undefined) return false;
  if (task.status === "Done") return false;
  const today = todayKST(now);
  return task.due_date < today;
}

/**
 * A task is backlog when:
 *   - status === "ToDo", AND
 *   - startDate is null
 */
export function isBacklog(task: Task): boolean {
  return task.status === "ToDo" && (task.start_date === null || task.start_date === undefined);
}

// ---------------------------------------------------------------------------
// Presentation query predicates
// All exclude cancelled tasks and sort by dueDate asc, nulls last.
// ---------------------------------------------------------------------------

type ViewFilter = (task: Task) => boolean;

function notCancelled(task: Task): boolean {
  return task.cancelled_at === null || task.cancelled_at === undefined;
}

/**
 * Milestones are tasks (migration 0004), but they are markers rather than work:
 * "진행 중 3건" must not count a deadline. Every derived section funnels through
 * applyFilter, so excluding them here covers all of them at once.
 */
function isWork(task: Task): boolean {
  return task.kind !== "milestone";
}

function sortByDueDateAscNullsLast(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    if (a.due_date === null || a.due_date === undefined) return 1;
    if (b.due_date === null || b.due_date === undefined) return -1;
    return a.due_date < b.due_date ? -1 : a.due_date > b.due_date ? 1 : 0;
  });
}

function applyFilter(tasks: Task[], filter: ViewFilter): Task[] {
  return sortByDueDateAscNullsLast(
    tasks.filter(notCancelled).filter(isWork).filter(filter)
  );
}

/** assignee=viewer AND status in {InProgress, Review} */
export function myFocus(tasks: Task[], viewerId: string): Task[] {
  return applyFilter(
    tasks,
    (t) =>
      t.assignee_id === viewerId &&
      (t.status === "InProgress" || t.status === "Review"),
  );
}

/**
 * A Waiting task whose next-check date has arrived. This is the whole point of
 * recording one: the task comes back on its own instead of being remembered.
 */
export function isFollowUpDue(task: Task, now: Date): boolean {
  return (
    task.status === "Waiting" &&
    !!task.follow_up_at &&
    task.follow_up_at <= todayKST(now)
  );
}

/** What the workspace has to look at today: overdue, or a follow-up come due. */
export function needsAttention(tasks: Task[], now: Date): Task[] {
  return applyFilter(tasks, (t) => isOverdue(t, now) || isFollowUpDue(t, now));
}

/** status=InProgress across the whole team — what the workspace is working on now */
export function teamInMotion(tasks: Task[]): Task[] {
  return applyFilter(tasks, (t) => t.status === "InProgress");
}

/** status=Waiting across the whole team — what the workspace is blocked on */
export function teamWaiting(tasks: Task[]): Task[] {
  return applyFilter(tasks, (t) => t.status === "Waiting");
}

/** Tasks with no project yet — the workspace Inbox. */
export function inbox(tasks: Task[]): Task[] {
  return applyFilter(tasks, (t) => t.project_id === null);
}

/** status=ToDo AND today <= startDate <= today+7 (KST) */
export function comingNext(tasks: Task[], now: Date): Task[] {
  const today = todayKST(now);
  const plusSevenDate = new Date();
  // compute today+7 in KST
  const [y, m, d] = today.split("-").map(Number);
  const base = new Date(y!, m! - 1, d!);
  base.setDate(base.getDate() + 7);
  const todayPlus7 = `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, "0")}-${String(base.getDate()).padStart(2, "0")}`;

  return applyFilter(
    tasks,
    (t) =>
      t.status === "ToDo" &&
      t.start_date !== null &&
      t.start_date !== undefined &&
      t.start_date >= today &&
      t.start_date <= todayPlus7,
  );
}

/** assignee=viewer AND dueDate === today (KST) */
export function todayTasks(tasks: Task[], viewerId: string, now: Date): Task[] {
  const today = todayKST(now);
  return applyFilter(
    tasks,
    (t) => t.assignee_id === viewerId && t.due_date === today,
  );
}

/** assignee=viewer AND dueDate within current ISO week Mon–Sun (KST) */
export function thisWeek(tasks: Task[], viewerId: string, now: Date): Task[] {
  const { weekStart, weekEnd } = currentISOWeekKST(now);
  return applyFilter(
    tasks,
    (t) =>
      t.assignee_id === viewerId &&
      t.due_date !== null &&
      t.due_date !== undefined &&
      t.due_date >= weekStart &&
      t.due_date <= weekEnd,
  );
}

/** assignee=viewer AND status=InProgress */
export function inProgress(tasks: Task[], viewerId: string): Task[] {
  return applyFilter(
    tasks,
    (t) => t.assignee_id === viewerId && t.status === "InProgress",
  );
}

/** assignee=viewer AND status=Waiting */
export function waiting(tasks: Task[], viewerId: string): Task[] {
  return applyFilter(
    tasks,
    (t) => t.assignee_id === viewerId && t.status === "Waiting",
  );
}

/** status=Review AND (reviewer=viewer OR assignee=viewer) */
export function review(tasks: Task[], viewerId: string): Task[] {
  return applyFilter(
    tasks,
    (t) =>
      t.status === "Review" &&
      (t.reviewer_id === viewerId || t.assignee_id === viewerId),
  );
}

/** assignee=viewer AND isBacklog */
export function later(tasks: Task[], viewerId: string): Task[] {
  return applyFilter(
    tasks,
    (t) => t.assignee_id === viewerId && isBacklog(t),
  );
}
