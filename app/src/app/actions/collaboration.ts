"use server";

import { revalidatePath } from "next/cache";
import { getCurrentMember } from "@/server/data/queries";
import {
  createComment,
  deleteComment,
  getComments,
  getMemberNotifications,
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
    const comments = await getComments(db, target, member.workspace_id);
    return comments.map((comment) => ({
      ...comment,
      can_delete: comment.author_id === member.id,
    }));
  });
}

export async function getNotificationsAction() {
  return runAction("getNotificationsAction", async () => {
    const { member, db } = await getCurrentMember();
    return getMemberNotifications(db, member.workspace_id, member.id);
  });
}

export async function createCommentAction(
  target: CommentTarget,
  body: string,
): Promise<ActionResult<CommentView>> {
  const result = await runAction("createCommentAction", async () => {
    const { member, db } = await getCurrentMember();
    const comment = await createComment(db, {
      target,
      body,
      workspaceId: member.workspace_id,
      authorId: member.id,
    });
    return { ...comment, can_delete: true };
  });
  if (result.success) revalidatePath("/", "layout");
  return result;
}

export async function deleteCommentAction(
  target: CommentTarget,
  commentId: string,
): Promise<ActionResult<null>> {
  const result = await runAction("deleteCommentAction", async () => {
    const { member, db } = await getCurrentMember();
    await deleteComment(db, {
      target,
      commentId,
      workspaceId: member.workspace_id,
      requesterId: member.id,
    });
    return null;
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
