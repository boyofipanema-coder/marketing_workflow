"use server";

import { revalidatePath } from "next/cache";
import { getCurrentMember } from "@/server/data/queries";
import {
  createComment,
  getComments,
  markNotificationRead,
  markTargetNotificationsRead,
  type CommentTarget,
  type CommentView,
} from "@/server/services/collaboration";
import { runAction, type ActionResult } from "./result";

export async function getCommentsAction(
  target: CommentTarget,
): Promise<ActionResult<CommentView[]>> {
  return runAction("getCommentsAction", async () => {
    const { member, db } = await getCurrentMember();
    return getComments(db, target, member.workspace_id);
  });
}

export async function createCommentAction(
  target: CommentTarget,
  body: string,
): Promise<ActionResult<CommentView>> {
  const result = await runAction("createCommentAction", async () => {
    const { member, db } = await getCurrentMember();
    return createComment(db, {
      target,
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
  targetType: CommentTarget["type"],
): Promise<ActionResult<null>> {
  return runAction("markNotificationReadAction", async () => {
    const { member, db } = await getCurrentMember();
    await markNotificationRead(
      db,
      notificationId,
      targetType,
      member.workspace_id,
      member.id,
    );
    return null;
  });
}

export async function markTargetNotificationsReadAction(
  target: CommentTarget,
): Promise<ActionResult<null>> {
  return runAction("markTargetNotificationsReadAction", async () => {
    const { member, db } = await getCurrentMember();
    await markTargetNotificationsRead(
      db,
      target,
      member.workspace_id,
      member.id,
    );
    return null;
  });
}
