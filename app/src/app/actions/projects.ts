"use server";

import { revalidatePath } from "next/cache";
import {
  createProject,
  editProject,
  archiveProject,
  restoreProject,
  type ProjectPatch,
} from "@/server/services/project";
import { getCurrentMember } from "@/server/data/queries";
import { runAction, type ActionResult } from "./result";
import type { Project } from "@/server/db/schema";

export interface CreateProjectInput {
  name: string;
  projectLeadId: string;
  oneLineObjective?: string | null;
  targetStartDate?: string | null;
  targetEndDate?: string | null;
}

function revalidateAll() {
  revalidatePath("/", "layout");
}

export async function createProjectAction(
  input: CreateProjectInput
): Promise<ActionResult<Project>> {
  const result = await runAction("createProjectAction", async () => {
    const { member, db } = await getCurrentMember();
    return createProject(db, { ...input, workspaceId: member.workspace_id });
  });
  if (result.success) revalidateAll();
  return result;
}

export async function editProjectAction(
  projectId: string,
  patch: ProjectPatch
): Promise<ActionResult<Project>> {
  const result = await runAction("editProjectAction", async () => {
    const { member, db } = await getCurrentMember();
    return editProject(db, projectId, member.workspace_id, patch);
  });
  if (result.success) revalidateAll();
  return result;
}

/**
 * Archive a project. Archiving is reversible and never removes tasks — the
 * app has no hard-delete path for projects (plan §2.1).
 */
export async function archiveProjectAction(
  projectId: string
): Promise<ActionResult<Project>> {
  const result = await runAction("archiveProjectAction", async () => {
    const { member, db } = await getCurrentMember();
    return archiveProject(db, projectId, member.workspace_id);
  });
  if (result.success) revalidateAll();
  return result;
}

export async function restoreProjectAction(
  projectId: string
): Promise<ActionResult<Project>> {
  const result = await runAction("restoreProjectAction", async () => {
    const { member, db } = await getCurrentMember();
    return restoreProject(db, projectId, member.workspace_id);
  });
  if (result.success) revalidateAll();
  return result;
}
