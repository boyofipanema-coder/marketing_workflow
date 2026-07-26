import { and, eq, desc, inArray, isNull, sql } from "drizzle-orm";
import {
  task,
  activity_log,
  project as projectTable,
  workstream as workstreamTable,
  member as memberTable,
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

/** Statuses a task can be reopened into — everything except the terminal Done. */
const NON_TERMINAL_STATUSES: TaskStatus[] = [
  "Inbox",
  "ToDo",
  "InProgress",
  "Waiting",
  "Review",
];

export interface CreateByTitleParams {
  title: string;
  memberId: string;
  workspaceId: string;
}

export interface CreateProjectTaskParams {
  workspaceId: string;
  projectId: string;
  title: string;
  memberId: string;
  workstreamId?: string | null;
  description?: string | null;
  status?: Exclude<TaskStatus, "Inbox">;
  importance?: TaskImportance;
  kind?: TaskKind;
  assigneeId?: string | null;
  reviewerId?: string | null;
  startDate?: string | null;
  dueDate?: string | null;
  dueTime?: string | null;
  waitingPartyText?: string | null;
  followUpAt?: string | null;
}

export interface CreateSubtaskParams {
  parentId: string;
  title: string;
  memberId: string;
  workspaceId: string;
}

/** Fields that can be patched via editTask.
 *  actor_id is required so we can write the activity_log row. */
export type TaskImportance = Task["importance"];
export type TaskKind = Task["kind"];

export interface TaskPatch {
  title?: string;
  description?: string | null;
  status?: TaskStatus;
  importance?: TaskImportance;
  kind?: TaskKind;
  assignee_id?: string | null;
  reviewer_id?: string | null;
  start_date?: string | null;
  due_date?: string | null;
  due_time?: string | null;
  project_id?: string | null;
  workstream_id?: string | null;
  /** Who/what the task is blocked on. Required to sit in Waiting. */
  waiting_party_text?: string | null;
  /** When to look at it again. Required to sit in Waiting. */
  follow_up_at?: string | null;
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

/** Accepts "YYYY-MM-DD" only. */
function validateDate(raw: string, field: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw new ValidationError(`${field}은(는) YYYY-MM-DD 형식이어야 합니다.`);
  }
  const [y, m, d] = raw.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== m! - 1 ||
    dt.getUTCDate() !== d
  ) {
    throw new ValidationError(`${field}이(가) 올바른 날짜가 아닙니다.`);
  }
  return raw;
}

/** Accepts 24-hour "HH:mm" only. */
function validateTime(raw: string): string {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(raw)) {
    throw new ValidationError("시간은 HH:mm 형식이어야 합니다.");
  }
  return raw;
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
    const nextTitle = validateTitle(patch.title);
    if (nextTitle !== current.title) {
      activityRows.push({
        workspace_id: current.workspace_id,
        task_id: current.id,
        actor_id: actorId,
        change_type: "title",
        from_value: current.title,
        to_value: nextTitle,
        created_at: now,
      });
    }
    updates.title = nextTitle;
  }

  // ---- Description -------------------------------------------------------
  // The body itself is never copied into the activity log (plan §4.4) — only
  // the fact that it changed.
  if (patch.description !== undefined) {
    if ((patch.description ?? null) !== (current.description ?? null)) {
      activityRows.push({
        workspace_id: current.workspace_id,
        task_id: current.id,
        actor_id: actorId,
        change_type: "description",
        from_value: null,
        to_value: null,
        created_at: now,
      });
    }
    updates.description = patch.description;
  }

  // ---- Importance / kind -------------------------------------------------
  // Both are one-click promotions from the board, so they are logged: "who
  // decided this was a key task" is exactly the kind of thing teams re-litigate.
  if (patch.importance !== undefined && patch.importance !== current.importance) {
    activityRows.push({
      workspace_id: current.workspace_id,
      task_id: current.id,
      actor_id: actorId,
      change_type: "importance",
      from_value: current.importance,
      to_value: patch.importance,
      created_at: now,
    });
    updates.importance = patch.importance;
  }

  if (patch.kind !== undefined && patch.kind !== current.kind) {
    activityRows.push({
      workspace_id: current.workspace_id,
      task_id: current.id,
      actor_id: actorId,
      change_type: "kind",
      from_value: current.kind,
      to_value: patch.kind,
      created_at: now,
    });
    updates.kind = patch.kind;
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

  // ---- Waiting -----------------------------------------------------------
  // "Waiting" without a who and a when is just a task nobody is looking at.
  // Both are required to sit in the state; leaving it clears them so a task
  // that comes back later cannot resurface someone else's stale follow-up.
  if (patch.waiting_party_text !== undefined) {
    const nextParty = patch.waiting_party_text?.trim() || null;
    if (nextParty !== (current.waiting_party_text ?? null)) {
      activityRows.push({
        workspace_id: current.workspace_id,
        task_id: current.id,
        actor_id: actorId,
        change_type: "waiting_party",
        from_value: current.waiting_party_text ?? null,
        to_value: nextParty,
        created_at: now,
      });
    }
    updates.waiting_party_text = nextParty;
  }
  if (patch.follow_up_at !== undefined) {
    const nextFollowUp = patch.follow_up_at
      ? validateDate(patch.follow_up_at, "다음 확인일")
      : null;
    if (nextFollowUp !== (current.follow_up_at ?? null)) {
      activityRows.push({
        workspace_id: current.workspace_id,
        task_id: current.id,
        actor_id: actorId,
        change_type: "follow_up_at",
        from_value: current.follow_up_at ?? null,
        to_value: nextFollowUp,
        created_at: now,
      });
    }
    updates.follow_up_at = nextFollowUp;
  }

  // Enforced only on the way *in*. Checking it on every write to a Waiting task
  // deadlocks the pair: the party cannot be saved without the date and the date
  // cannot be saved without the party, so neither can ever be filled one at a
  // time. It also made rows predating this feature uneditable.
  if (patch.status === "Waiting") {
    const party =
      updates.waiting_party_text !== undefined
        ? updates.waiting_party_text
        : current.waiting_party_text;
    const followUp =
      updates.follow_up_at !== undefined
        ? updates.follow_up_at
        : current.follow_up_at;
    if (!party) throw new ValidationError("무엇을 기다리는지 입력해 주세요.");
    if (!followUp)
      throw new ValidationError("다음 확인일을 선택해 주세요.");
  } else if (prevStatus === "Waiting" && nextStatus !== "Waiting") {
    // Only an actual transition *out* of Waiting clears the pair — a patch
    // that never mentions status (title/description/date edits) must leave
    // it alone. Log what's being cleared before clearing it (Finding 3) so
    // "what were we waiting on" survives past the transition.
    if (current.waiting_party_text || current.follow_up_at) {
      activityRows.push({
        workspace_id: current.workspace_id,
        task_id: current.id,
        actor_id: actorId,
        change_type: "waiting_closed",
        from_value: JSON.stringify({
          party: current.waiting_party_text,
          follow_up_at: current.follow_up_at,
        }),
        to_value: null,
        created_at: now,
      });
    }
    updates.waiting_party_text = null;
    updates.follow_up_at = null;
  }

  // ---- Project / non-Inbox enforcement -----------------------------------
  const nextProjectId =
    patch.project_id !== undefined ? patch.project_id : current.project_id;
  if (nextStatus !== "Inbox" && !nextProjectId) {
    throw new ValidationError(
      "Inbox 밖의 업무는 프로젝트가 있어야 합니다."
    );
  }
  if (patch.project_id !== undefined) {
    if ((patch.project_id ?? null) !== (current.project_id ?? null)) {
      activityRows.push({
        workspace_id: current.workspace_id,
        task_id: current.id,
        actor_id: actorId,
        change_type: "project",
        from_value: current.project_id ?? null,
        to_value: patch.project_id ?? null,
        created_at: now,
      });
      // Moving to a different project invalidates the old project's workstream
      // unless the caller is explicitly setting one in the same patch.
      if (patch.workstream_id === undefined) {
        updates.workstream_id = null;
      }
    }
    updates.project_id = patch.project_id;
  }

  // ---- Workstream (projectId match enforced at DB level in editTask) ------
  if (patch.workstream_id !== undefined) {
    if ((patch.workstream_id ?? null) !== (current.workstream_id ?? null)) {
      activityRows.push({
        workspace_id: current.workspace_id,
        task_id: current.id,
        actor_id: actorId,
        change_type: "workstream",
        from_value: current.workstream_id ?? null,
        to_value: patch.workstream_id ?? null,
        created_at: now,
      });
    }
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
    if ((patch.reviewer_id ?? null) !== (current.reviewer_id ?? null)) {
      activityRows.push({
        workspace_id: current.workspace_id,
        task_id: current.id,
        actor_id: actorId,
        change_type: "reviewer",
        from_value: current.reviewer_id ?? null,
        to_value: patch.reviewer_id ?? null,
        created_at: now,
      });
    }
    updates.reviewer_id = patch.reviewer_id;
  }

  // ---- Dates -------------------------------------------------------------
  if (patch.start_date !== undefined) {
    updates.start_date = patch.start_date
      ? validateDate(patch.start_date, "시작일")
      : null;
  }

  if (patch.due_date !== undefined) {
    const nextDue = patch.due_date ? validateDate(patch.due_date, "마감일") : null;
    activityRows.push({
      workspace_id: current.workspace_id,
      task_id: current.id,
      actor_id: actorId,
      change_type: "due_date",
      from_value: current.due_date ?? null,
      to_value: nextDue,
      created_at: now,
    });
    updates.due_date = nextDue;
  }

  if (patch.due_time !== undefined) {
    const nextTime = patch.due_time ? validateTime(patch.due_time) : null;
    const effectiveDue =
      patch.due_date !== undefined ? updates.due_date : current.due_date;
    if (nextTime && !effectiveDue) {
      throw new ValidationError("시간을 지정하려면 마감일이 필요합니다.");
    }
    if (nextTime !== (current.due_time ?? null)) {
      activityRows.push({
        workspace_id: current.workspace_id,
        task_id: current.id,
        actor_id: actorId,
        change_type: "due_time",
        from_value: current.due_time ?? null,
        to_value: nextTime,
        created_at: now,
      });
    }
    updates.due_time = nextTime;
  }

  // Start must not fall after Due.
  const effectiveStart =
    updates.start_date !== undefined ? updates.start_date : current.start_date;
  const effectiveDue =
    updates.due_date !== undefined ? updates.due_date : current.due_date;
  if (effectiveStart && effectiveDue && effectiveStart > effectiveDue) {
    throw new ValidationError("시작일은 마감일보다 늦을 수 없습니다.");
  }

  return { updates, activityRows };
}

// ---------------------------------------------------------------------------
// DB helpers
// ---------------------------------------------------------------------------

/** Loads a task, scoped to the caller's workspace. Cross-workspace ids 404. */
async function loadScoped(
  db: Database,
  taskId: string,
  workspaceId: string
): Promise<Task> {
  const rows = await db
    .select()
    .from(task)
    .where(and(eq(task.id, taskId), eq(task.workspace_id, workspaceId)));
  const current = rows[0];
  if (!current) throw new NotFoundError(`Task ${taskId} not found`);
  return current;
}

async function nextSortOrder(
  db: Database,
  workspaceId: string,
  projectId: string | null,
  parentTaskId: string | null
): Promise<number> {
  const rows = await db
    .select({ value: sql<number>`coalesce(max(${task.sort_order}), -1)` })
    .from(task)
    .where(
      and(
        eq(task.workspace_id, workspaceId),
        projectId === null
          ? isNull(task.project_id)
          : eq(task.project_id, projectId),
        parentTaskId === null
          ? isNull(task.parent_task_id)
          : eq(task.parent_task_id, parentTaskId)
      )
    );
  return (rows[0]?.value ?? -1) + 1;
}

function logRows(rows: Omit<NewActivityLog, "id">[]) {
  return rows.map((row) => ({ id: crypto.randomUUID(), ...row }));
}

/** Small fixed backoff before retrying a transient write failure. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Writes the activity_log batch, retrying transient failures a couple of
 * times before giving up. The version guard in commitVersionedUpdate already
 * ensures we only reach this after a real, committed task update, so the only
 * remaining failure mode is this follow-up write itself hitting a transient
 * D1 error — worth a couple of quick retries rather than silently losing the
 * task's history. If every attempt fails, the error propagates: the task
 * update already landed, but the caller sees a failure and the client will
 * reload the task rather than trust a log that never wrote.
 */
async function writeActivityRowsWithRetry(
  db: Database,
  rows: NewActivityLog[],
  attempts = 3
): Promise<void> {
  if (rows.length === 0) return;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      await db.batch(
        rows.map((row) => db.insert(activity_log).values(row)) as never
      );
      return;
    } catch (err) {
      if (attempt === attempts) throw err;
      await sleep(25 * attempt);
    }
  }
}

/**
 * Applies the computed updates under a conditional UPDATE that also carries the
 * version check, so two concurrent writers holding the same baseVersion cannot
 * both win. Returns the updated row, or throws StaleVersionError when the guard
 * matched nothing.
 *
 * The activity rows are written in a follow-up step rather than alongside the
 * UPDATE: bundling them into the same batch would insert log rows even when
 * the version guard rejects the write, since a batch that matches zero rows on
 * one statement doesn't stop its sibling statements from running. Writing them
 * only after confirming the UPDATE matched keeps a rejected write from ever
 * gaining a log entry; writeActivityRowsWithRetry keeps a *successful* write
 * from silently losing its log entry to a transient failure in this second step.
 */
async function commitVersionedUpdate(
  db: Database,
  taskId: string,
  workspaceId: string,
  baseVersion: number,
  current: Task,
  updates: Partial<Task> & { version: number; updated_at: string },
  activityRows: Omit<NewActivityLog, "id">[]
): Promise<Task> {
  const updated = await db
    .update(task)
    .set(updates)
    .where(
      and(
        eq(task.id, taskId),
        eq(task.workspace_id, workspaceId),
        eq(task.version, baseVersion)
      )
    )
    .returning();

  if (updated.length === 0) {
    throw new StaleVersionError();
  }

  await writeActivityRowsWithRetry(db, logRows(activityRows));

  return (updated[0] ?? { ...current, ...updates }) as Task;
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

  const newTask: NewTask = {
    id: crypto.randomUUID(),
    workspace_id: params.workspaceId,
    project_id: null,
    workstream_id: null,
    title,
    description: null,
    status: "Inbox",
    importance: "normal",
    kind: "task",
    assignee_id: null,
    reviewer_id: null,
    start_date: null,
    due_date: null,
    due_time: null,
    sort_order: await nextSortOrder(db, params.workspaceId, null, null),
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
 * Create a top-level task directly inside a project. Inline callers can still
 * provide only a title; the detailed task dialog supplies the remaining fields
 * in the same atomic insert.
 */
export async function createProjectTask(
  db: Database,
  params: CreateProjectTaskParams
): Promise<Task> {
  const title = validateTitle(params.title);

  const [proj] = await db
    .select()
    .from(projectTable)
    .where(
      and(
        eq(projectTable.id, params.projectId),
        eq(projectTable.workspace_id, params.workspaceId)
      )
    );
  if (!proj) throw new NotFoundError(`Project ${params.projectId} not found`);
  if (proj.archived_at !== null) {
    throw new ValidationError("보관된 프로젝트에는 업무를 추가할 수 없습니다.");
  }

  if (params.workstreamId) {
    const [ws] = await db
      .select()
      .from(workstreamTable)
      .where(
        and(
          eq(workstreamTable.id, params.workstreamId),
          eq(workstreamTable.project_id, params.projectId)
        )
      );
    if (!ws) {
      throw new ValidationError("해당 프로젝트의 업무 영역이 아닙니다.");
    }
  }

  const status = params.status ?? "ToDo";
  const importance = params.importance ?? "normal";
  const kind = params.kind ?? "task";
  const startDate = params.startDate
    ? validateDate(params.startDate, "시작일")
    : null;
  const dueDate = params.dueDate
    ? validateDate(params.dueDate, "마감일")
    : null;
  const dueTime = params.dueTime ? validateTime(params.dueTime) : null;
  if (startDate && dueDate && startDate > dueDate) {
    throw new ValidationError("시작일은 마감일보다 늦을 수 없습니다.");
  }
  if (dueTime && !dueDate) {
    throw new ValidationError("시간을 지정하려면 마감일이 필요합니다.");
  }

  const waitingPartyText = params.waitingPartyText?.trim() || null;
  const followUpAt = params.followUpAt
    ? validateDate(params.followUpAt, "다음 확인일")
    : null;
  if (status === "Waiting" && !waitingPartyText) {
    throw new ValidationError("무엇을 기다리는지 입력해 주세요.");
  }
  if (status === "Waiting" && !followUpAt) {
    throw new ValidationError("다음 확인일을 선택해 주세요.");
  }

  const memberIds = [
    params.assigneeId ?? null,
    params.reviewerId ?? null,
  ].filter((id): id is string => Boolean(id));
  if (memberIds.length > 0) {
    const scopedMembers = await db
      .select({ id: memberTable.id })
      .from(memberTable)
      .where(
        and(
          eq(memberTable.workspace_id, params.workspaceId),
          inArray(memberTable.id, [...new Set(memberIds)])
        )
      );
    if (scopedMembers.length !== new Set(memberIds).size) {
      throw new ValidationError("워크스페이스에 없는 담당자 또는 검토자입니다.");
    }
  }

  const now = new Date().toISOString();
  const newTask: NewTask = {
    id: crypto.randomUUID(),
    workspace_id: params.workspaceId,
    project_id: params.projectId,
    workstream_id: params.workstreamId ?? null,
    title,
    description: params.description?.trim() || null,
    status,
    importance,
    kind,
    assignee_id: params.assigneeId ?? null,
    reviewer_id: params.reviewerId ?? null,
    start_date: startDate,
    due_date: dueDate,
    due_time: dueTime,
    waiting_party_text: status === "Waiting" ? waitingPartyText : null,
    follow_up_at: status === "Waiting" ? followUpAt : null,
    sort_order: await nextSortOrder(
      db,
      params.workspaceId,
      params.projectId,
      null
    ),
    version: 1,
    created_by: params.memberId,
    created_at: now,
    updated_at: now,
    completed_at: status === "Done" ? now : null,
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

  const parent = await loadScoped(db, params.parentId, params.workspaceId);
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
    importance: "normal",
    kind: "task",
    assignee_id: null,
    reviewer_id: null,
    start_date: null,
    due_date: null,
    due_time: null,
    sort_order: await nextSortOrder(
      db,
      parent.workspace_id,
      parent.project_id,
      parent.id
    ),
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
 * baseVersion must equal the task's stored version exactly, and the write is
 * guarded on that version at the SQL level so a concurrent save cannot clobber
 * a newer value. Field changes are recorded in activity_log.
 */
export async function editTask(
  db: Database,
  taskId: string,
  workspaceId: string,
  patch: TaskPatch,
  baseVersion: number
): Promise<Task> {
  const current = await loadScoped(db, taskId, workspaceId);

  // Target project must live in the same workspace.
  if (patch.project_id !== undefined && patch.project_id !== null) {
    const [proj] = await db
      .select()
      .from(projectTable)
      .where(
        and(
          eq(projectTable.id, patch.project_id),
          eq(projectTable.workspace_id, workspaceId)
        )
      );
    if (!proj) throw new NotFoundError(`Project ${patch.project_id} not found`);
  }

  // Workstream must belong to the task's (possibly new) project.
  if (patch.workstream_id !== undefined && patch.workstream_id !== null) {
    const [ws] = await db
      .select()
      .from(workstreamTable)
      .where(eq(workstreamTable.id, patch.workstream_id));
    if (!ws)
      throw new NotFoundError(`Workstream ${patch.workstream_id} not found`);
    const effectiveProjectId = patch.project_id ?? current.project_id;
    if (ws.project_id !== effectiveProjectId) {
      throw new ValidationError(
        "해당 프로젝트의 업무 영역이 아닙니다."
      );
    }
  }

  const { actor_id: actorId, ...patchFields } = patch;
  const { updates, activityRows } = applyTaskEdit(
    current,
    patchFields,
    baseVersion,
    actorId
  );

  return commitVersionedUpdate(
    db,
    taskId,
    workspaceId,
    baseVersion,
    current,
    updates,
    activityRows
  );
}

/** Mark a task Done, recording completed_at. */
export async function completeTask(
  db: Database,
  taskId: string,
  workspaceId: string,
  actorId: string,
  baseVersion: number
): Promise<Task> {
  return editTask(
    db,
    taskId,
    workspaceId,
    { status: "Done", actor_id: actorId },
    baseVersion
  );
}

/**
 * Un-complete a task, returning it to the status it held before it was closed.
 *
 * The previous status is read back from the activity log — the most recent
 * status change whose to_value was "Done". Falls back to ToDo when no such
 * record exists (e.g. a task completed before logging, or one created as Done).
 */
export async function reopenTask(
  db: Database,
  taskId: string,
  workspaceId: string,
  actorId: string,
  baseVersion: number
): Promise<Task> {
  const current = await loadScoped(db, taskId, workspaceId);
  if (current.status !== "Done") {
    throw new ValidationError("완료된 업무가 아닙니다.");
  }

  const history = await db
    .select()
    .from(activity_log)
    .where(
      and(
        eq(activity_log.task_id, taskId),
        eq(activity_log.workspace_id, workspaceId),
        eq(activity_log.change_type, "status"),
        eq(activity_log.to_value, "Done")
      )
    )
    .orderBy(desc(activity_log.created_at))
    .limit(1);

  const previous = history[0]?.from_value as TaskStatus | undefined;
  const restored =
    previous && NON_TERMINAL_STATUSES.includes(previous) ? previous : "ToDo";

  // A task with no project cannot sit outside Inbox.
  const target = !current.project_id ? "Inbox" : restored;

  return editTask(
    db,
    taskId,
    workspaceId,
    { status: target, actor_id: actorId },
    baseVersion
  );
}

/**
 * Cancel a task: set cancelled_at to now and freeze further edits.
 * completedAt and cancelledAt are mutually exclusive.
 */
export async function cancelTask(
  db: Database,
  taskId: string,
  workspaceId: string,
  actorId: string,
  baseVersion?: number
): Promise<Task> {
  const current = await loadScoped(db, taskId, workspaceId);
  if (current.cancelled_at !== null) {
    throw new ValidationError("이미 취소된 업무입니다.");
  }
  if (current.completed_at !== null) {
    throw new ValidationError("완료된 업무는 취소할 수 없습니다.");
  }

  const expected = baseVersion ?? current.version;
  if (expected !== current.version) throw new StaleVersionError();

  const now = new Date().toISOString();
  return commitVersionedUpdate(
    db,
    taskId,
    workspaceId,
    expected,
    current,
    { cancelled_at: now, updated_at: now, version: current.version + 1 },
    [
      {
        workspace_id: current.workspace_id,
        task_id: current.id,
        actor_id: actorId,
        change_type: "cancelled",
        from_value: null,
        to_value: now,
        created_at: now,
      },
    ]
  );
}

/**
 * Restore a cancelled task: clear cancelled_at and re-enable edits.
 */
export async function restoreTask(
  db: Database,
  taskId: string,
  workspaceId: string,
  actorId: string,
  baseVersion?: number
): Promise<Task> {
  const current = await loadScoped(db, taskId, workspaceId);
  if (current.cancelled_at === null) {
    throw new ValidationError("취소된 업무가 아닙니다.");
  }

  const expected = baseVersion ?? current.version;
  if (expected !== current.version) throw new StaleVersionError();

  const now = new Date().toISOString();
  return commitVersionedUpdate(
    db,
    taskId,
    workspaceId,
    expected,
    current,
    { cancelled_at: null, updated_at: now, version: current.version + 1 },
    [
      {
        workspace_id: current.workspace_id,
        task_id: current.id,
        actor_id: actorId,
        change_type: "restored",
        from_value: current.cancelled_at,
        to_value: null,
        created_at: now,
      },
    ]
  );
}

/**
 * Persist a manual ordering for a set of sibling tasks.
 *
 * orderedIds must name every task the caller intends to position; each is
 * assigned its index. Ids outside the workspace are rejected so a reorder
 * cannot be used to probe or touch another workspace's rows.
 */
export async function reorderTasks(
  db: Database,
  workspaceId: string,
  orderedIds: string[],
  actorId: string
): Promise<void> {
  if (orderedIds.length === 0) return;

  const unique = new Set(orderedIds);
  if (unique.size !== orderedIds.length) {
    throw new ValidationError("업무 순서 목록에 중복이 있습니다.");
  }

  const rows = await db
    .select()
    .from(task)
    .where(
      and(eq(task.workspace_id, workspaceId), inArray(task.id, orderedIds))
    );
  if (rows.length !== orderedIds.length) {
    throw new NotFoundError("일부 업무를 찾을 수 없습니다.");
  }

  // All siblings must share the same parent scope, otherwise the indices are
  // meaningless across groups.
  const scope = (t: Task) => `${t.project_id ?? ""}|${t.parent_task_id ?? ""}`;
  const scopes = new Set(rows.map(scope));
  if (scopes.size > 1) {
    throw new ValidationError("서로 다른 목록의 업무는 함께 정렬할 수 없습니다.");
  }

  const now = new Date().toISOString();
  const statements = orderedIds.map((id, index) =>
    db
      .update(task)
      .set({ sort_order: index, updated_at: now })
      .where(and(eq(task.id, id), eq(task.workspace_id, workspaceId)))
  );

  statements.push(
    db.insert(activity_log).values({
      id: crypto.randomUUID(),
      workspace_id: workspaceId,
      task_id: orderedIds[0]!,
      actor_id: actorId,
      change_type: "reorder",
      from_value: null,
      to_value: String(orderedIds.length),
      created_at: now,
    }) as never
  );

  await db.batch(statements as never);
}
