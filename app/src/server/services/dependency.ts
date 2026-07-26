/**
 * Finish-to-start dependencies between tasks.
 *
 * The board draws a line for every row here and for nothing else, so the rules
 * that keep the graph sane live at the write, not the render.
 */

import { and, eq, inArray } from "drizzle-orm";
import { task, task_dependency } from "@/server/db/schema";
import type { Database } from "@/server/db/client";
import { NotFoundError, ValidationError } from "./errors";

/** Every edge in the workspace: successorId → predecessorId[]. */
export async function dependencyMap(
  db: Database,
  workspaceId: string
): Promise<Map<string, string[]>> {
  const rows = await db
    .select()
    .from(task_dependency)
    .where(eq(task_dependency.workspace_id, workspaceId));
  const map = new Map<string, string[]>();
  for (const r of rows) {
    const list = map.get(r.successor_task_id);
    if (list) list.push(r.predecessor_task_id);
    else map.set(r.successor_task_id, [r.predecessor_task_id]);
  }
  return map;
}

/**
 * True if `from` can already reach `to` by following predecessor edges.
 * Used to reject a new edge that would close a loop.
 *
 * ponytail: loads the workspace's edges and walks them in memory. Fine for a
 * workspace with hundreds of tasks; push into a recursive CTE if it grows.
 */
function reaches(
  map: Map<string, string[]>,
  from: string,
  to: string
): boolean {
  const seen = new Set<string>();
  const stack = [from];
  while (stack.length) {
    const id = stack.pop()!;
    if (id === to) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    stack.push(...(map.get(id) ?? []));
  }
  return false;
}

export async function addDependency(
  db: Database,
  workspaceId: string,
  predecessorId: string,
  successorId: string
): Promise<void> {
  if (predecessorId === successorId) {
    throw new ValidationError("업무는 자기 자신을 기다릴 수 없습니다.");
  }

  // Both ends must exist inside the caller's workspace, or an id from another
  // workspace could be linked in and leak through the board.
  const ends = await db
    .select({ id: task.id })
    .from(task)
    .where(
      and(
        eq(task.workspace_id, workspaceId),
        inArray(task.id, [predecessorId, successorId])
      )
    );
  if (ends.length !== 2) throw new NotFoundError("업무를 찾을 수 없습니다.");

  const map = await dependencyMap(db, workspaceId);
  if (map.get(successorId)?.includes(predecessorId)) return; // already linked
  // Adding pred → succ closes a loop if pred already depends on succ.
  if (reaches(map, predecessorId, successorId)) {
    throw new ValidationError(
      "이미 이 업무를 기다리고 있어서 서로 순환하게 됩니다."
    );
  }

  await db.insert(task_dependency).values({
    id: crypto.randomUUID(),
    workspace_id: workspaceId,
    predecessor_task_id: predecessorId,
    successor_task_id: successorId,
    dependency_type: "finish_to_start",
    created_at: new Date().toISOString(),
  });
}

export async function removeDependency(
  db: Database,
  workspaceId: string,
  predecessorId: string,
  successorId: string
): Promise<void> {
  await db
    .delete(task_dependency)
    .where(
      and(
        eq(task_dependency.workspace_id, workspaceId),
        eq(task_dependency.predecessor_task_id, predecessorId),
        eq(task_dependency.successor_task_id, successorId)
      )
    );
}

export { reaches as _reachesForTest };
