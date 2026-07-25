"use server";

import { revalidatePath } from "next/cache";
import { createByTitle, createSubtask } from "@/server/services/task";
import { getCurrentMember } from "@/server/data/queries";
import { ValidationError } from "@/server/services/errors";

export interface CreateTaskResult {
  success: boolean;
  error?: string;
}

/**
 * Server action: create a new Inbox task for the currently authenticated member.
 * Called from client-side QuickAdd component.
 */
export async function createTaskAction(
  title: string
): Promise<CreateTaskResult> {
  try {
    const { member, db } = await getCurrentMember();

    await createByTitle(db, {
      title,
      memberId: member.id,
      workspaceId: member.workspace_id,
    });

    // Revalidate all app pages so newly created tasks appear immediately
    revalidatePath("/", "layout");

    return { success: true };
  } catch (err) {
    if (err instanceof ValidationError) {
      return { success: false, error: err.message };
    }
    console.error("createTaskAction error:", err);
    return { success: false, error: "업무를 추가하지 못했습니다. 다시 시도해 주세요." };
  }
}

/**
 * Server action: create a subtask under an existing task, for the current member.
 * Called from the workflow board's inline "Add subtask" affordance.
 */
export async function createSubtaskAction(
  parentTaskId: string,
  title: string
): Promise<CreateTaskResult> {
  try {
    const { member, db } = await getCurrentMember();

    await createSubtask(db, {
      parentId: parentTaskId,
      title,
      memberId: member.id,
    });

    revalidatePath("/", "layout");
    return { success: true };
  } catch (err) {
    if (err instanceof ValidationError) {
      return { success: false, error: err.message };
    }
    console.error("createSubtaskAction error:", err);
    return { success: false, error: "세부 업무를 추가하지 못했습니다. 다시 시도해 주세요." };
  }
}
