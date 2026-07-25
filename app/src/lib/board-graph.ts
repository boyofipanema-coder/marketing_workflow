/**
 * Decides which tasks get a card on the board, and how a card that was pulled
 * out of its parent still points back at it.
 *
 * Kept free of React and of any particular kind of work: promotion is driven
 * only by `importance`, so it applies at any depth, in any status, to any
 * number of siblings. Nothing here knows what a task is *about*.
 */

import type { Task } from "@/server/db/schema";

export type GroupBy = "project" | "workstream" | "owner" | "due";

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
}

export function isKey(t: Task): boolean {
  return t.importance === "key";
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

export function laneKeyFor(t: Task, groupBy: GroupBy, now?: Date): string {
  switch (groupBy) {
    case "project":
      return t.project_id ?? "_inbox";
    case "owner":
      return t.assignee_id ?? "_un";
    case "due":
      return dueBucketKey(t.due_date, now);
    default:
      return t.workstream_id ?? "_other";
  }
}

export function buildBoardGraph(
  tasks: Task[],
  groupBy: GroupBy,
  now?: Date
): BoardGraph {
  const live = tasks.filter((t) => !t.cancelled_at);
  const byId = new Map(live.map((t) => [t.id, t]));

  const childMap: ChildMap = new Map();
  for (const t of live) {
    if (!t.parent_task_id) continue;
    const siblings = childMap.get(t.parent_task_id);
    if (siblings) siblings.push(t);
    else childMap.set(t.parent_task_id, [t]);
  }
  for (const arr of childMap.values()) {
    arr.sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"));
  }

  const roots = live.filter((t) => !t.parent_task_id);
  const placed = live.filter((t) => !t.parent_task_id || isKey(t));
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
  for (const t of placed) laneOf.set(t.id, laneKeyFor(rootOf(t), groupBy, now));

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

  return { childMap, roots, placed, laneOf, parentOf };
}
