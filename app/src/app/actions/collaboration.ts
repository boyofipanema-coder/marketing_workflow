"use server";

import { revalidatePath } from "next/cache";
import { getCurrentMember } from "@/server/data/queries";
import {
  createTaskComment,
  getTaskComments,
  markNotificationRead,
  type CommentView,
} from "@/server/services/collaboration";
import { runAction, type ActionResult } from "./result";

export async function getTaskCommentsAction(
  taskId: string,
): Promise<ActionResult<CommentView[]>> {
  return runAction("getTaskCommentsAction", async () => {
    const { member, db } = await getCurrentMember();
    return getTaskComments(db, taskId, member.workspace_id);
  });
}

export async function createTaskCommentAction(
  taskId: string,
  body: string,
): Promise<ActionResult<CommentView>> {
  const result = await runAction("createTaskCommentAction", async () => {
    const { member, db } = await getCurrentMember();
    return createTaskComment(db, {
      taskId,
      body,
      workspaceId: member.workspace_id,
      authorId: member.id,
    });
  });
  if (result.success) revalidatePath("/", "layout");
  return result;
}

export async function markNotificationReadAction(
  notificationId: string,
): Promise<ActionResult<null>> {
  return runAction("markNotificationReadAction", async () => {
    const { member, db } = await getCurrentMember();
    await markNotificationRead(
      db,
      notificationId,
      member.workspace_id,
      member.id,
    );
    return null;
  });
}
