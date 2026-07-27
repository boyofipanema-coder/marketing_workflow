import { and, desc, eq } from "drizzle-orm";
import type { Database } from "@/server/db/client";
import {
  member,
  notification,
  task,
  task_comment,
  type Notification,
  type TaskComment,
} from "@/server/db/schema";
import { NotFoundError, ValidationError } from "./errors";

export interface CommentView extends TaskComment {
  author_name: string;
}

export interface NotificationView extends Notification {
  actor_name: string;
  task_title: string;
  comment_body: string | null;
}

export async function getTaskComments(
  db: Database,
  taskId: string,
  workspaceId: string,
): Promise<CommentView[]> {
  const rows = await db
    .select({ comment: task_comment, author_name: member.name })
    .from(task_comment)
    .innerJoin(member, eq(member.id, task_comment.author_id))
    .where(
      and(
        eq(task_comment.task_id, taskId),
        eq(task_comment.workspace_id, workspaceId),
      ),
    )
    .orderBy(task_comment.created_at);
  return rows.map(({ comment, author_name }) => ({ ...comment, author_name }));
}

export async function createTaskComment(
  db: Database,
  input: {
    taskId: string;
    workspaceId: string;
    authorId: string;
    body: string;
  },
): Promise<CommentView> {
  const body = input.body.trim();
  if (!body) throw new ValidationError("댓글 내용을 입력해 주세요.");
  if (body.length > 2000) throw new ValidationError("댓글은 2,000자 이하로 입력해 주세요.");

  const [[target], [author], members] = await Promise.all([
    db.select().from(task).where(and(eq(task.id, input.taskId), eq(task.workspace_id, input.workspaceId))),
    db.select().from(member).where(and(eq(member.id, input.authorId), eq(member.workspace_id, input.workspaceId))),
    db.select().from(member).where(eq(member.workspace_id, input.workspaceId)),
  ]);
  if (!target || !author) throw new NotFoundError("업무 또는 사용자를 찾지 못했습니다.");

  const now = new Date().toISOString();
  const row: TaskComment = {
    id: crypto.randomUUID(),
    workspace_id: input.workspaceId,
    task_id: input.taskId,
    author_id: input.authorId,
    body,
    created_at: now,
    updated_at: now,
  };
  await db.insert(task_comment).values(row);

  const mentioned = members.filter(
    (candidate) =>
      candidate.id !== input.authorId && body.includes(`@${candidate.name}`),
  );
  if (mentioned.length) {
    await db.insert(notification).values(
      mentioned.map((candidate) => ({
        id: crypto.randomUUID(),
        workspace_id: input.workspaceId,
        recipient_id: candidate.id,
        actor_id: input.authorId,
        task_id: input.taskId,
        comment_id: row.id,
        kind: "mention" as const,
        read_at: null,
        created_at: now,
      })),
    );
  }
  return { ...row, author_name: author.name };
}

export async function getMemberNotifications(
  db: Database,
  workspaceId: string,
  recipientId: string,
): Promise<NotificationView[]> {
  const rows = await db
    .select()
    .from(notification)
    .where(
      and(
        eq(notification.workspace_id, workspaceId),
        eq(notification.recipient_id, recipientId),
      ),
    )
    .orderBy(desc(notification.created_at))
    .limit(40);
  if (!rows.length) return [];

  const [members, tasks, comments] = await Promise.all([
    db.select().from(member).where(eq(member.workspace_id, workspaceId)),
    db.select().from(task).where(eq(task.workspace_id, workspaceId)),
    db.select().from(task_comment).where(eq(task_comment.workspace_id, workspaceId)),
  ]);
  const memberById = new Map(members.map((item) => [item.id, item]));
  const taskById = new Map(tasks.map((item) => [item.id, item]));
  const commentById = new Map(comments.map((item) => [item.id, item]));
  return rows.map((row) => ({
    ...row,
    actor_name: memberById.get(row.actor_id)?.name ?? "알 수 없음",
    task_title: taskById.get(row.task_id)?.title ?? "업무",
    comment_body: row.comment_id ? commentById.get(row.comment_id)?.body ?? null : null,
  }));
}

export async function markNotificationRead(
  db: Database,
  notificationId: string,
  workspaceId: string,
  recipientId: string,
) {
  await db
    .update(notification)
    .set({ read_at: new Date().toISOString() })
    .where(
      and(
        eq(notification.id, notificationId),
        eq(notification.workspace_id, workspaceId),
        eq(notification.recipient_id, recipientId),
      ),
    );
}
