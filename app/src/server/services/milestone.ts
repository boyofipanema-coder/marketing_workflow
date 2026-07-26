/**
 * Milestones, stored as tasks with kind = "milestone" (see migration 0004).
 *
 * The functions here exist because a milestone is *created* differently from a
 * task — a name and a date, no title-only shortcut — not because it is stored
 * differently. Everything after creation (owner, status, dependencies) goes
 * through the ordinary task service.
 */

import { and, eq, isNull, sql } from "drizzle-orm";
import { task, type Task, type NewTask } from "@/server/db/schema";
import { type Database } from "@/server/db/client";
import { NotFoundError, ValidationError } from "./errors";
import { loadScopedProject } from "./project";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreateMilestoneParams {
  projectId: string;
  workspaceId: string;
  /** Recorded as created_by, like any other task. */
  memberId: string;
  name: string;
  dueDate: string;
}

export interface MilestonePatch {
  name?: string;
  dueDate?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function validateName(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) throw new ValidationError("마일스톤 이름을 입력해 주세요.");
  if (trimmed.length > 200)
    throw new ValidationError("마일스톤 이름은 200자 이하로 입력해 주세요.");
  return trimmed;
}

function validateDueDate(raw: string): string {
  if (!raw || !raw.trim())
    throw new ValidationError("마일스톤 마감일을 선택해 주세요.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw new ValidationError("마감일은 YYYY-MM-DD 형식이어야 합니다.");
  }
  return raw;
}

/** Loads a milestone task, scoped to the caller's workspace. */
async function loadScopedMilestone(
  db: Database,
  milestoneId: string,
  workspaceId: string
): Promise<Task> {
  const rows = await db
    .select()
    .from(task)
    .where(
      and(
        eq(task.id, milestoneId),
        eq(task.workspace_id, workspaceId),
        eq(task.kind, "milestone")
      )
    );
  const current = rows[0];
  if (!current) throw new NotFoundError(`Milestone ${milestoneId} not found`);
  return current;
}

/** Next sort_order among the project's top-level rows. */
async function nextSortOrder(
  db: Database,
  workspaceId: string,
  projectId: string
): Promise<number> {
  const rows = await db
    .select({ value: sql<number>`coalesce(max(${task.sort_order}), -1)` })
    .from(task)
    .where(
      and(
        eq(task.workspace_id, workspaceId),
        eq(task.project_id, projectId),
        isNull(task.parent_task_id)
      )
    );
  return (rows[0]?.value ?? -1) + 1;
}

// ---------------------------------------------------------------------------
// Service functions
// ---------------------------------------------------------------------------

export async function createMilestone(
  db: Database,
  params: CreateMilestoneParams
): Promise<Task> {
  const title = validateName(params.name);
  const dueDate = validateDueDate(params.dueDate);
  await loadScopedProject(db, params.projectId, params.workspaceId);

  const now = new Date().toISOString();
  const newTask: NewTask = {
    id: crypto.randomUUID(),
    workspace_id: params.workspaceId,
    project_id: params.projectId,
    workstream_id: null,
    parent_task_id: null,
    title,
    description: null,
    status: "ToDo",
    importance: "normal",
    kind: "milestone",
    assignee_id: null,
    reviewer_id: null,
    start_date: null,
    due_date: dueDate,
    due_time: null,
    sort_order: await nextSortOrder(db, params.workspaceId, params.projectId),
    version: 1,
    created_by: params.memberId,
    created_at: now,
    updated_at: now,
    completed_at: null,
    cancelled_at: null,
  };

  await db.insert(task).values(newTask);
  return newTask as Task;
}

/**
 * Rename or re-date a milestone.
 *
 * Deliberately not version-guarded: the milestone list edits one field at a
 * time with no version in hand, and two people renaming the same milestone in
 * the same second is not a conflict worth a stale-write error. Anything that
 * needs optimistic concurrency (status, owner) goes through editTask.
 */
export async function editMilestone(
  db: Database,
  milestoneId: string,
  workspaceId: string,
  patch: MilestonePatch
): Promise<Task> {
  const current = await loadScopedMilestone(db, milestoneId, workspaceId);

  const updates: Partial<Task> = {};
  if (patch.name !== undefined) updates.title = validateName(patch.name);
  if (patch.dueDate !== undefined)
    updates.due_date = validateDueDate(patch.dueDate);

  if (Object.keys(updates).length === 0) return current;

  updates.updated_at = new Date().toISOString();
  updates.version = current.version + 1;

  await db.update(task).set(updates).where(eq(task.id, milestoneId));
  return { ...current, ...updates } as Task;
}
