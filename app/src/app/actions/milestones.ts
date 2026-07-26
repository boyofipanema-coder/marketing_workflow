"use server";

import { revalidatePath } from "next/cache";
import {
  createMilestone,
  editMilestone,
  type MilestonePatch,
} from "@/server/services/milestone";
import { getCurrentMember } from "@/server/data/queries";
import { runAction, type ActionResult } from "./result";
import type { Task } from "@/server/db/schema";

function revalidateAll() {
  revalidatePath("/", "layout");
}

export async function createMilestoneAction(
  projectId: string,
  name: string,
  dueDate: string
): Promise<ActionResult<Task>> {
  const result = await runAction("createMilestoneAction", async () => {
    const { member, db } = await getCurrentMember();
    return createMilestone(db, {
      projectId,
      workspaceId: member.workspace_id,
      memberId: member.id,
      name,
      dueDate,
    });
  });
  if (result.success) revalidateAll();
  return result;
}

export async function editMilestoneAction(
  milestoneId: string,
  patch: MilestonePatch
): Promise<ActionResult<Task>> {
  const result = await runAction("editMilestoneAction", async () => {
    const { member, db } = await getCurrentMember();
    return editMilestone(db, milestoneId, member.workspace_id, patch);
  });
  if (result.success) revalidateAll();
  return result;
}
