import { eq } from "drizzle-orm";
import {
  task,
  activity_log,
  workstream as workstreamTable,
  type Task,
  type NewTask,
  type NewActivityLog,
} from "@/server/db/schema";
import { type Database } from "@/server/db/client";
import { StaleVersionError, ValidationError, NotFoundError } from "./errors";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TaskStatus = Task["status"];

export interface CreateByTitleParams {
  title: string;
  memberId: string;
  workspaceId: string;
}

export interface CreateSubtaskParams {
  parentId: string;
  title: string;
  memberId: string;
}

/** Fields that can be patched via editTask.
 *  actor_id is required so we can write the activity_log row. */
export interface TaskPatch {
  title?: string;
  description?: string | null;
  status?: TaskStatus;
  assignee_id?: string | null;
  reviewer_id?: string | null;
  start_date?: string | null;
  due_date?: string | null;
  project_id?: string | null;
  workstream_id?: string | null;
  actor_id: string;
}

/** Result of applyTaskEdit — pure, no DB side-effects. */
export interface TaskEditResult {
  updates: Partial<Task> & { version: number; updated_at: string };
  activityRows: Omit<NewActivityLog, "id">[];
}

// ---------------------------------------------------------------------------
// Pure helpers (exported so tests can call them without a DB)
// ---------------------------------------------------------------------------

function validateTitle(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) throw new ValidationError("업무명을 입력해 주세요.");
  if (trimmed.length > 200)
    throw new ValidationError("업무명은 200자 이하로 입력해 주세요.");
  return trimmed;
}

/**
 * Pure business-logic function: validates the patch against the current task
 * state and computes the DB-level field updates plus activity log rows.
 *
 * Throws StaleVersionError / ValidationError without any DB mutation.
 */
export function applyTaskEdit(
  current: Task,
  patch: Omit<TaskPatch, "actor_id">,
  baseVersion: number,
  actorId: string,
  now: string = new Date().toISOString()
): TaskEditResult {
  // ---- Optimistic concurrency ------------------------------------------
  if (!Number.isInteger(baseVersion)) {
    throw new StaleVersionError("baseVersion must be an integer");
  }
  if (baseVersion !== current.version) {
    throw new StaleVersionError(
      `Expected version ${current.version}, got ${baseVersion}`
    );
  }

  // ---- Freeze on cancelled -----------------------------------------------
  if (current.cancelled_at !== null) {
    throw new ValidationError(
      "Cannot edit a cancelled task; call restoreTask first"
    );
  }

  const updates: Partial<Task> & { version: number; updated_at: string } = {
    version: current.version + 1,
    updated_at: now,
  };

  const activityRows: Omit<NewActivityLog, "id">[] = [];

  // ---- Title -------------------------------------------------------------
  if (patch.title !== undefined) {
    updates.title = validateTitle(patch.title);
  }

  // ---- Description -------------------------------------------------------
  if (patch.description !== undefined) {
    updates.description = patch.description;
  }

  // ---- Status ------------------------------------------------------------
  const prevStatus = current.status;
  const nextStatus = patch.status ?? prevStatus;

  if (patch.status !== undefined && patch.status !== prevStatus) {
    // Entering Done
    if (patch.status === "Done") {
      if (current.cancelled_at !== null) {
        throw new ValidationError("취소된 업무는 완료 처리할 수 없습니다.");
      }
      updates.completed_at = now;
    }

    // Leaving Done
    if (prevStatus === "Done" && patch.status !== "Done") {
      updates.completed_at = null;
    }

    updates.status = patch.status;

    activityRows.push({
      workspace_id: current.workspace_id,
      task_id: current.id,
      actor_id: actorId,
      change_type: "status",
      from_value: prevStatus,
      to_value: patch.status,
      created_at: now,
    });
  }

  // ---- Project / non-Inbox enforcement -----------------------------------
  const nextProjectId =
    patch.project_id !== undefined ? patch.project_id : current.project_id;
  if (nextStatus !== "Inbox" && !nextProjectId) {
    throw new ValidationError(
      "Tasks outside Inbox must belong to a project"
    );
  }
  if (patch.project_id !== undefined) {
    updates.project_id = patch.project_id;
  }

  // ---- Workstream (projectId match enforced at DB level in editTask) ------
  if (patch.workstream_id !== undefined) {
    updates.workstream_id = patch.workstream_id;
  }

  // ---- Assignee ----------------------------------------------------------
  if (patch.assignee_id !== undefined) {
    activityRows.push({
      workspace_id: current.workspace_id,
      task_id: current.id,
      actor_id: actorId,
      change_type: "assignee",
      from_value: current.assignee_id ?? null,
      to_value: patch.assignee_id ?? null,
      created_at: now,
    });
    updates.assignee_id = patch.assignee_id;
  }

  // ---- Reviewer ----------------------------------------------------------
  if (patch.reviewer_id !== undefined) {
    updates.reviewer_id = patch.reviewer_id;
  }

  // ---- Dates -------------------------------------------------------------
  if (patch.start_date !== undefined) {
    updates.start_date = patch.start_date;
  }

  if (patch.due_date !== undefined) {
    activityRows.push({
      workspace_id: current.workspace_id,
      task_id: current.id,
      actor_id: actorId,
      change_type: "due_date",
      from_value: current.due_date ?? null,
      to_value: patch.due_date ?? null,
      created_at: now,
    });
    updates.due_date = patch.due_date;
  }

  return { updates, activityRows };
}

// ---------------------------------------------------------------------------
// Service functions
// ---------------------------------------------------------------------------

/**
 * Create a new Inbox task.
 * The workspaceId is taken from the caller (derived from the member's workspace).
 */
export async function createByTitle(
  db: Database,
  params: CreateByTitleParams
): Promise<Task> {
  const title = validateTitle(params.title);
  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  const newTask: NewTask = {
    id,
    workspace_id: params.workspaceId,
    project_id: null,
    workstream_id: null,
    title,
    description: null,
    status: "Inbox",
    assignee_id: null,
    reviewer_id: null,
    start_date: null,
    due_date: null,
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
 * Create a subtask under an existing task. The child inherits the parent's
 * workspace, project, and workstream so it lives in the same context, and
 * defaults to ToDo. Rejects a missing or cancelled parent.
 */
export async function createSubtask(
  db: Database,
  params: CreateSubtaskParams
): Promise<Task> {
  const title = validateTitle(params.title);

  const [parent] = await db
    .select()
    .from(task)
    .where(eq(task.id, params.parentId));
  if (!parent) throw new NotFoundError(`Task ${params.parentId} not found`);
  if (parent.cancelled_at)
    throw new ValidationError("취소된 업무에는 세부 업무를 추가할 수 없습니다.");

  const now = new Date().toISOString();
  const newTask: NewTask = {
    id: crypto.randomUUID(),
    workspace_id: parent.workspace_id,
    project_id: parent.project_id,
    workstream_id: parent.workstream_id,
    parent_task_id: parent.id,
    title,
    description: null,
    status: "ToDo",
    assignee_id: null,
    reviewer_id: null,
    start_date: null,
    due_date: null,
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
 * Edit a task with optimistic concurrency control.
 *
 * baseVersion must equal the task's stored version exactly.
 * Status/assignee/dueDate changes are logged atomically in the same batch.
 * If workstream_id is set, validates that workstream.project_id === task.project_id.
 */
export async function editTask(
  db: Database,
  taskId: string,
  patch: TaskPatch,
  baseVersion: number
): Promise<Task> {
  // 1. Fetch current task
  const rows = await db
    .select()
    .from(task)
    .where(eq(task.id, taskId));
  const current = rows[0];
  if (!current) throw new NotFoundError(`Task ${taskId} not found`);

  // 2. Validate workstream project alignment (DB-level check)
  if (patch.workstream_id !== undefined && patch.workstream_id !== null) {
    const wsRows = await db
      .select()
      .from(workstreamTable)
      .where(eq(workstreamTable.id, patch.workstream_id));
    const ws = wsRows[0];
    if (!ws) throw new NotFoundError(`Workstream ${patch.workstream_id} not found`);
    const effectiveProjectId = patch.project_id ?? current.project_id;
    if (ws.project_id !== effectiveProjectId) {
      throw new ValidationError(
        "Workstream does not belong to the task's project"
      );
    }
  }

  // 3. Pure computation (throws StaleVersionError / ValidationError on conflict)
  const { actor_id: actorId, ...patchFields } = patch;
  const { updates, activityRows } = applyTaskEdit(
    current,
    patchFields,
    baseVersion,
    actorId
  );

  // 4. Atomic batch: update task + insert all activity log rows
  const updateStmt = db
    .update(task)
    .set(updates)
    .where(eq(task.id, taskId));

  if (activityRows.length === 0) {
    await updateStmt;
  } else {
    const logStmts = activityRows.map((row) =>
      db.insert(activity_log).values({
        id: crypto.randomUUID(),
        ...row,
      })
    );
    await db.batch([updateStmt, ...logStmts]);
  }

  return { ...current, ...updates } as Task;
}

/**
 * Cancel a task: set cancelled_at to now and freeze further edits.
 * completedAt and cancelledAt are mutually exclusive.
 */
export async function cancelTask(
  db: Database,
  taskId: string,
  actorId: string
): Promise<Task> {
  const rows = await db.select().from(task).where(eq(task.id, taskId));
  const current = rows[0];
  if (!current) throw new NotFoundError(`Task ${taskId} not found`);
  if (current.cancelled_at !== null) {
    throw new ValidationError("이미 취소된 업무입니다.");
  }
  if (current.completed_at !== null) {
    throw new ValidationError("완료된 업무는 취소할 수 없습니다.");
  }

  const now = new Date().toISOString();
  const updates = {
    cancelled_at: now,
    updated_at: now,
    version: current.version + 1,
  };

  const updateStmt = db.update(task).set(updates).where(eq(task.id, taskId));
  const logStmt = db.insert(activity_log).values({
    id: crypto.randomUUID(),
    workspace_id: current.workspace_id,
    task_id: current.id,
    actor_id: actorId,
    change_type: "cancelled",
    from_value: null,
    to_value: now,
    created_at: now,
  });

  await db.batch([updateStmt, logStmt]);

  return { ...current, ...updates } as Task;
}

/**
 * Restore a cancelled task: clear cancelled_at and re-enable edits.
 */
export async function restoreTask(
  db: Database,
  taskId: string,
  actorId: string
): Promise<Task> {
  const rows = await db.select().from(task).where(eq(task.id, taskId));
  const current = rows[0];
  if (!current) throw new NotFoundError(`Task ${taskId} not found`);
  if (current.cancelled_at === null) {
    throw new ValidationError("취소된 업무가 아닙니다.");
  }

  const now = new Date().toISOString();
  const updates = {
    cancelled_at: null,
    updated_at: now,
    version: current.version + 1,
  };

  const updateStmt = db.update(task).set(updates).where(eq(task.id, taskId));
  const logStmt = db.insert(activity_log).values({
    id: crypto.randomUUID(),
    workspace_id: current.workspace_id,
    task_id: current.id,
    actor_id: actorId,
    change_type: "restored",
    from_value: current.cancelled_at,
    to_value: null,
    created_at: now,
  });

  await db.batch([updateStmt, logStmt]);

  return { ...current, ...updates } as Task;
}
