/**
 * Decides which tasks get a card on the board, and how a card that was pulled
 * out of its parent still points back at it.
 *
 * Kept free of React and of any particular kind of work: promotion is driven
 * only by `importance`, so it applies at any depth, in any status, to any
 * number of siblings. Nothing here knows what a task is *about*.
 */

import type { Task } from "@/server/db/schema";

export type GroupBy = "project" | "workstream" | "owner" | "due" | "brand";

export type ChildMap = Map<string, Task[]>;

export interface BoardGraph {
  childMap: ChildMap;
  /** Top-level tasks — the structural owners of each tree. */
  roots: Task[];
  /** Everything that gets a card: roots plus every key descendant. */
  placed: Task[];
  /** taskId → lane key, always inherited from the root of its tree. */
  laneOf: Map<string, string>;
  /** taskId → nearest ancestor that also has a card (only for promoted nodes). */
  parentOf: Map<string, string>;
  /**
   * Milestones, earliest first. Kept out of `roots`/`placed` entirely: shape
   * encodes kind on this board, so a milestone is a diamond on a rail and never
   * a rectangle in the grid.
   */
  milestones: Task[];
}

export function isKey(t: Task): boolean {
  return t.importance === "key";
}

export function isMilestone(t: Task): boolean {
  return t.kind === "milestone";
}

/** Bucket boundaries for the "마감" lane axis, in days from today. */
export function dueBucketKey(due: string | null, now: Date = new Date()): string {
  if (!due) return "_none";
  const diff = Math.round((+new Date(due) - +new Date(now.toDateString())) / 864e5);
  if (diff < 0) return "over";
  if (diff <= 1) return "today";
  if (diff <= 7) return "week";
  return "later";
}

export function laneKeyFor(
  t: Task,
  groupBy: GroupBy,
  now?: Date,
  /** project_id → brand, needed only for groupBy === "brand" (lives on `project`, not `task`). */
  projectBrand?: Map<string, string>
): string {
  switch (groupBy) {
    case "project":
      return t.project_id ?? "_inbox";
    case "owner":
      return t.assignee_id ?? "_un";
    case "due":
      return dueBucketKey(t.due_date, now);
    case "brand":
      return (t.project_id && projectBrand?.get(t.project_id)) || "공통";
    default:
      return t.workstream_id ?? "_other";
  }
}

export function buildBoardGraph(
  tasks: Task[],
  groupBy: GroupBy,
  now?: Date,
  projectBrand?: Map<string, string>
): BoardGraph {
  const alive = tasks.filter((t) => !t.cancelled_at);
  const milestones = alive
    .filter(isMilestone)
    .sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"));

  // Milestones are removed before the tree is built, so a task filed under one
  // is treated as top-level rather than orphaned into an invisible parent.
  const live = alive.filter((t) => !isMilestone(t));
  const byId = new Map(live.map((t) => [t.id, t]));

  const childMap: ChildMap = new Map();
  for (const t of live) {
    if (!t.parent_task_id || !byId.has(t.parent_task_id)) continue;
    const siblings = childMap.get(t.parent_task_id);
    if (siblings) siblings.push(t);
    else childMap.set(t.parent_task_id, [t]);
  }
  for (const arr of childMap.values()) {
    arr.sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"));
  }

  const isRoot = (t: Task) =>
    !t.parent_task_id || !byId.has(t.parent_task_id);
  const roots = live.filter(isRoot);
  const placed = live.filter((t) => isRoot(t) || isKey(t));
  const placedIds = new Set(placed.map((t) => t.id));

  // Cycles cannot occur through the UI, but a corrupt row must not hang the
  // board, so every walk upward is bounded by a seen-set.
  const rootOf = (t: Task): Task => {
    let cur = t;
    const seen = new Set<string>([t.id]);
    while (cur.parent_task_id) {
      const up = byId.get(cur.parent_task_id);
      if (!up || seen.has(up.id)) break;
      seen.add(up.id);
      cur = up;
    }
    return cur;
  };

  const laneOf = new Map<string, string>();
  for (const t of placed) laneOf.set(t.id, laneKeyFor(rootOf(t), groupBy, now, projectBrand));

  const parentOf = new Map<string, string>();
  for (const t of placed) {
    if (!t.parent_task_id) continue;
    let up = byId.get(t.parent_task_id);
    const seen = new Set<string>([t.id]);
    // Skip over ancestors that did not earn a card of their own.
    while (up && !placedIds.has(up.id)) {
      if (seen.has(up.id)) break;
      seen.add(up.id);
      up = up.parent_task_id ? byId.get(up.parent_task_id) : undefined;
    }
    if (up && up.id !== t.id) parentOf.set(t.id, up.id);
  }

  return { childMap, roots, placed, laneOf, parentOf, milestones };
}
