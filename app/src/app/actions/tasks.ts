"use server";

import { revalidatePath } from "next/cache";
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
  type TaskPatch,
} from "@/server/services/task";
import { getCurrentMember, getTaskActivity, type ActivityEntry } from "@/server/data/queries";
import { addDependency, removeDependency } from "@/server/services/dependency";
import { runAction, type ActionResult } from "./result";
import type { Task } from "@/server/db/schema";

/** Client-supplied patch. actor_id is filled server-side from the session. */
export type TaskPatchInput = Omit<TaskPatch, "actor_id">;

export interface CreateProjectTaskInput {
  projectId: string;
  parentTaskId?: string | null;
  title: string;
  description?: string | null;
  status?: Exclude<Task["status"], "Inbox">;
  importance?: Task["importance"];
  kind?: Task["kind"];
  assigneeId?: string | null;
  startDate?: string | null;
  dueDate?: string | null;
  dueTime?: string | null;
  workstreamId?: string | null;
  waitingPartyText?: string | null;
  followUpAt?: string | null;
}

/** All app routes render from the same task set, so revalidate the layout. */
function revalidateAll() {
  revalidatePath("/", "layout");
}

/** Create a new Inbox task for the current member. */
export async function createTaskAction(
  title: string
): Promise<ActionResult<Task>> {
  const result = await runAction("createTaskAction", async () => {
    const { member, db } = await getCurrentMember();
    return createByTitle(db, {
      title,
      memberId: member.id,
      workspaceId: member.workspace_id,
    });
  });
  if (result.success) revalidateAll();
  return result;
}

/** Create a top-level task inside a project from the inline "add task" row. */
export async function createProjectTaskAction(
  projectId: string,
  title: string,
  workstreamId?: string | null
): Promise<ActionResult<Task>> {
  const result = await runAction("createProjectTaskAction", async () => {
    const { member, db } = await getCurrentMember();
    return createProjectTask(db, {
      workspaceId: member.workspace_id,
      projectId,
      title,
      memberId: member.id,
      workstreamId: workstreamId ?? null,
    });
  });
  if (result.success) revalidateAll();
  return result;
}

/** Create a project task with every field collected by the detailed dialog. */
export async function createDetailedProjectTaskAction(
  input: CreateProjectTaskInput
): Promise<ActionResult<Task>> {
  const result = await runAction("createDetailedProjectTaskAction", async () => {
    const { member, db } = await getCurrentMember();
    return createProjectTask(db, {
      workspaceId: member.workspace_id,
      memberId: member.id,
      projectId: input.projectId,
      parentTaskId: input.parentTaskId,
      title: input.title,
      description: input.description,
      status: input.status,
      importance: input.importance,
      kind: input.kind,
      assigneeId: input.assigneeId,
      startDate: input.startDate,
      dueDate: input.dueDate,
      dueTime: input.dueTime,
      workstreamId: input.workstreamId,
      waitingPartyText: input.waitingPartyText,
      followUpAt: input.followUpAt,
    });
  });
  if (result.success) revalidateAll();
  return result;
}

/** Create a subtask under an existing task. */
export async function createSubtaskAction(
  parentTaskId: string,
  title: string
): Promise<ActionResult<Task>> {
  const result = await runAction("createSubtaskAction", async () => {
    const { member, db } = await getCurrentMember();
    return createSubtask(db, {
      parentId: parentTaskId,
      title,
      memberId: member.id,
      workspaceId: member.workspace_id,
    });
  });
  if (result.success) revalidateAll();
  return result;
}

/** Patch any editable field on a task, guarded by baseVersion. */
export async function editTaskAction(
  taskId: string,
  baseVersion: number,
  patch: TaskPatchInput
): Promise<ActionResult<Task>> {
  const result = await runAction("editTaskAction", async () => {
    const { member, db } = await getCurrentMember();
    return editTask(
      db,
      taskId,
      member.workspace_id,
      { ...patch, actor_id: member.id },
      baseVersion
    );
  });
  if (result.success) revalidateAll();
  return result;
}

/** Mark a task Done from the list's completion control. */
export async function completeTaskAction(
  taskId: string,
  baseVersion: number
): Promise<ActionResult<Task>> {
  const result = await runAction("completeTaskAction", async () => {
    const { member, db } = await getCurrentMember();
    return completeTask(db, taskId, member.workspace_id, member.id, baseVersion);
  });
  if (result.success) revalidateAll();
  return result;
}

/** Un-complete a task, returning it to its pre-Done status. */
export async function reopenTaskAction(
  taskId: string,
  baseVersion: number
): Promise<ActionResult<Task>> {
  const result = await runAction("reopenTaskAction", async () => {
    const { member, db } = await getCurrentMember();
    return reopenTask(db, taskId, member.workspace_id, member.id, baseVersion);
  });
  if (result.success) revalidateAll();
  return result;
}

/** Cancel a task — a separate action from completing it. */
export async function cancelTaskAction(
  taskId: string,
  baseVersion?: number
): Promise<ActionResult<Task>> {
  const result = await runAction("cancelTaskAction", async () => {
    const { member, db } = await getCurrentMember();
    return cancelTask(db, taskId, member.workspace_id, member.id, baseVersion);
  });
  if (result.success) revalidateAll();
  return result;
}

/** Restore a cancelled task from the archive. */
export async function restoreTaskAction(
  taskId: string,
  baseVersion?: number
): Promise<ActionResult<Task>> {
  const result = await runAction("restoreTaskAction", async () => {
    const { member, db } = await getCurrentMember();
    return restoreTask(db, taskId, member.workspace_id, member.id, baseVersion);
  });
  if (result.success) revalidateAll();
  return result;
}

/** Persist a drag-and-drop ordering for a list of sibling tasks. */
export async function reorderTasksAction(
  orderedIds: string[]
): Promise<ActionResult<undefined>> {
  const result = await runAction("reorderTasksAction", async () => {
    const { member, db } = await getCurrentMember();
    await reorderTasks(db, member.workspace_id, orderedIds, member.id);
    return undefined;
  });
  if (result.success) revalidateAll();
  return result;
}

/** Record that `predecessorId` must finish before `successorId` starts. */
export async function addDependencyAction(
  predecessorId: string,
  successorId: string
): Promise<ActionResult<undefined>> {
  const result = await runAction("addDependencyAction", async () => {
    const { member, db } = await getCurrentMember();
    await addDependency(db, member.workspace_id, predecessorId, successorId);
    return undefined;
  });
  if (result.success) revalidateAll();
  return result;
}

export async function removeDependencyAction(
  predecessorId: string,
  successorId: string
): Promise<ActionResult<undefined>> {
  const result = await runAction("removeDependencyAction", async () => {
    const { member, db } = await getCurrentMember();
    await removeDependency(db, member.workspace_id, predecessorId, successorId);
    return undefined;
  });
  if (result.success) revalidateAll();
  return result;
}

/** Recent changes to a task, for the detail panel's history. */
export async function getTaskActivityAction(
  taskId: string
): Promise<ActionResult<ActivityEntry[]>> {
  return runAction("getTaskActivityAction", async () => {
    const { member, db } = await getCurrentMember();
    return getTaskActivity(db, taskId, member.workspace_id);
  });
}
