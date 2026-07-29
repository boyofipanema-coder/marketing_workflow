import { and, desc, eq, inArray } from "drizzle-orm";
import type { Database } from "@/server/db/client";
import {
  member,
  notification,
  project,
  project_comment,
  project_notification,
  task,
  task_comment,
  type Notification,
  type ProjectNotification,
} from "@/server/db/schema";
import { NotFoundError, ValidationError } from "./errors";

export type CommentTarget = {
  type: "task" | "project";
  id: string;
};

export interface CommentView {
  id: string;
  workspace_id: string;
  author_id: string;
  body: string;
  created_at: string;
  updated_at: string;
  author_name: string;
  can_delete?: boolean;
}

export interface NotificationView {
  id: string;
  target_type: CommentTarget["type"];
  target_id: string;
  kind: "mention" | "comment" | "task_created" | "task_scheduled";
  actor_name: string;
  target_title: string;
  comment_body: string | null;
  schedule_date: string | null;
  read_at: string | null;
  created_at: string;
}

function isMissingCollaborationTable(error: unknown): boolean {
  const message =
    error instanceof Error ? error.message : typeof error === "string" ? error : "";
  return (
    message.includes("no such table: notification") ||
    message.includes("no such table: task_comment") ||
    message.includes("no such table: project_notification") ||
    message.includes("no such table: project_comment")
  );
}

export async function getComments(
  db: Database,
  target: CommentTarget,
  workspaceId: string,
): Promise<CommentView[]> {
  try {
    if (target.type === "task") {
      const rows = await db
        .select({ comment: task_comment, author_name: member.name })
        .from(task_comment)
        .innerJoin(member, eq(member.id, task_comment.author_id))
        .where(
          and(
            eq(task_comment.task_id, target.id),
            eq(task_comment.workspace_id, workspaceId),
          ),
        )
        .orderBy(task_comment.created_at);
      return rows.map(({ comment, author_name }) => ({
        ...comment,
        author_name,
      }));
    }

    const rows = await db
      .select({ comment: project_comment, author_name: member.name })
      .from(project_comment)
      .innerJoin(member, eq(member.id, project_comment.author_id))
      .where(
        and(
          eq(project_comment.project_id, target.id),
          eq(project_comment.workspace_id, workspaceId),
        ),
      )
      .orderBy(project_comment.created_at);
    return rows.map(({ comment, author_name }) => ({
      ...comment,
      author_name,
    }));
  } catch (error) {
    if (isMissingCollaborationTable(error)) return [];
    throw error;
  }
}

export async function createComment(
  db: Database,
  input: {
    target: CommentTarget;
    workspaceId: string;
    authorId: string;
    body: string;
  },
): Promise<CommentView> {
  const body = input.body.trim();
  if (!body) throw new ValidationError("댓글 내용을 입력해 주세요.");
  if (body.length > 2000) {
    throw new ValidationError("댓글은 2,000자 이하로 입력해 주세요.");
  }

  const targetQuery =
    input.target.type === "task"
      ? db
          .select({ id: task.id })
          .from(task)
          .where(
            and(
              eq(task.id, input.target.id),
              eq(task.workspace_id, input.workspaceId),
            ),
          )
      : db
          .select({ id: project.id })
          .from(project)
          .where(
            and(
              eq(project.id, input.target.id),
              eq(project.workspace_id, input.workspaceId),
            ),
          );
  const [[targetRow], [author], members] = await Promise.all([
    targetQuery,
    db
      .select()
      .from(member)
      .where(
        and(
          eq(member.id, input.authorId),
          eq(member.workspace_id, input.workspaceId),
        ),
      ),
    db.select().from(member).where(eq(member.workspace_id, input.workspaceId)),
  ]);
  if (!targetRow || !author) {
    throw new NotFoundError("댓글 대상 또는 사용자를 찾지 못했습니다.");
  }

  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  if (input.target.type === "task") {
    await db.insert(task_comment).values({
      id,
      workspace_id: input.workspaceId,
      task_id: input.target.id,
      author_id: input.authorId,
      body,
      created_at: now,
      updated_at: now,
    });
    const recipients = members.filter((candidate) => candidate.id !== input.authorId);
    if (recipients.length) {
      await db.insert(notification).values(
        recipients.map((candidate) => ({
          id: crypto.randomUUID(),
          workspace_id: input.workspaceId,
          recipient_id: candidate.id,
          actor_id: input.authorId,
          task_id: input.target.id,
          comment_id: id,
          kind: "comment" as const,
          read_at: null,
          created_at: now,
        })),
      );
    }
  } else {
    await db.insert(project_comment).values({
      id,
      workspace_id: input.workspaceId,
      project_id: input.target.id,
      author_id: input.authorId,
      body,
      created_at: now,
      updated_at: now,
    });
    const recipients = members.filter((candidate) => candidate.id !== input.authorId);
    if (recipients.length) {
      await db.insert(project_notification).values(
        recipients.map((candidate) => ({
          id: crypto.randomUUID(),
          workspace_id: input.workspaceId,
          recipient_id: candidate.id,
          actor_id: input.authorId,
          project_id: input.target.id,
          comment_id: id,
          read_at: null,
          created_at: now,
        })),
      );
    }
  }

  return {
    id,
    workspace_id: input.workspaceId,
    author_id: input.authorId,
    body,
    created_at: now,
    updated_at: now,
    author_name: author.name,
  };
}

export async function deleteComment(
  db: Database,
  input: {
    target: CommentTarget;
    workspaceId: string;
    requesterId: string;
    commentId: string;
  },
): Promise<void> {
  const table = input.target.type === "task" ? task_comment : project_comment;
  const targetColumn =
    input.target.type === "task" ? task_comment.task_id : project_comment.project_id;
  const [comment] = await db
    .select({ author_id: table.author_id })
    .from(table)
    .where(
      and(
        eq(table.id, input.commentId),
        eq(table.workspace_id, input.workspaceId),
        eq(targetColumn, input.target.id),
      ),
    );

  if (!comment) throw new NotFoundError("댓글을 찾지 못했습니다.");
  if (comment.author_id !== input.requesterId) {
    throw new ValidationError("작성한 댓글만 삭제할 수 있습니다.");
  }

  if (input.target.type === "task") {
    await db
      .delete(notification)
      .where(
        and(
          eq(notification.workspace_id, input.workspaceId),
          eq(notification.comment_id, input.commentId),
        ),
      );
    await db
      .delete(task_comment)
      .where(
        and(
          eq(task_comment.id, input.commentId),
          eq(task_comment.workspace_id, input.workspaceId),
          eq(task_comment.author_id, input.requesterId),
        ),
      );
    return;
  }

  await db
    .delete(project_notification)
    .where(
      and(
        eq(project_notification.workspace_id, input.workspaceId),
        eq(project_notification.comment_id, input.commentId),
      ),
    );
  await db
    .delete(project_comment)
    .where(
      and(
        eq(project_comment.id, input.commentId),
        eq(project_comment.workspace_id, input.workspaceId),
        eq(project_comment.author_id, input.requesterId),
      ),
    );
}

export async function getMemberNotifications(
  db: Database,
  workspaceId: string,
  recipientId: string,
): Promise<NotificationView[]> {
  let taskRows: Notification[] = [];
  let projectRows: ProjectNotification[] = [];
  try {
    taskRows = await db
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
  } catch (error) {
    if (!isMissingCollaborationTable(error)) throw error;
  }
  try {
    projectRows = await db
      .select()
      .from(project_notification)
      .where(
        and(
          eq(project_notification.workspace_id, workspaceId),
          eq(project_notification.recipient_id, recipientId),
        ),
      )
      .orderBy(desc(project_notification.created_at))
      .limit(40);
  } catch (error) {
    if (!isMissingCollaborationTable(error)) throw error;
  }
  if (!taskRows.length && !projectRows.length) return [];

  const [members, tasks, projects, taskComments, projectComments] =
    await Promise.all([
      db.select().from(member).where(eq(member.workspace_id, workspaceId)),
      db.select().from(task).where(eq(task.workspace_id, workspaceId)),
      db.select().from(project).where(eq(project.workspace_id, workspaceId)),
      db.select().from(task_comment).where(eq(task_comment.workspace_id, workspaceId)),
      db
        .select()
        .from(project_comment)
        .where(eq(project_comment.workspace_id, workspaceId))
        .catch((error) => {
          if (isMissingCollaborationTable(error)) return [];
          throw error;
        }),
    ]);
  const memberById = new Map(members.map((item) => [item.id, item.name]));
  const taskById = new Map(tasks.map((item) => [item.id, item]));
  const projectById = new Map(projects.map((item) => [item.id, item.name]));
  const taskCommentById = new Map(taskComments.map((item) => [item.id, item.body]));
  const projectCommentById = new Map(
    projectComments.map((item) => [item.id, item.body]),
  );

  return [
    ...taskRows.map((row): NotificationView => ({
      id: row.id,
      target_type: "task",
      target_id: row.task_id,
      kind: row.kind,
      actor_name: memberById.get(row.actor_id) ?? "알 수 없음",
      target_title: taskById.get(row.task_id)?.title ?? "업무",
      comment_body: row.comment_id
        ? taskCommentById.get(row.comment_id) ?? null
        : null,
      schedule_date: taskById.get(row.task_id)?.due_date ?? null,
      read_at: row.read_at,
      created_at: row.created_at,
    })),
    ...projectRows.map((row): NotificationView => ({
      id: row.id,
      target_type: "project",
      target_id: row.project_id,
      kind: "comment",
      actor_name: memberById.get(row.actor_id) ?? "알 수 없음",
      target_title: projectById.get(row.project_id) ?? "프로젝트",
      comment_body: row.comment_id
        ? projectCommentById.get(row.comment_id) ?? null
        : null,
      schedule_date: null,
      read_at: row.read_at,
      created_at: row.created_at,
    })),
  ]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 40);
}

export async function markNotificationRead(
  db: Database,
  notificationId: string,
  targetType: CommentTarget["type"],
  workspaceId: string,
  recipientId: string,
) {
  const table = targetType === "task" ? notification : project_notification;
  await db
    .update(table)
    .set({ read_at: new Date().toISOString() })
    .where(
      and(
        eq(table.id, notificationId),
        eq(table.workspace_id, workspaceId),
        eq(table.recipient_id, recipientId),
      ),
    );
}

export async function markTargetNotificationsRead(
  db: Database,
  target: CommentTarget,
  workspaceId: string,
  recipientId: string,
) {
  const now = new Date().toISOString();
  if (target.type === "task") {
    await db
      .update(notification)
      .set({ read_at: now })
      .where(
        and(
          eq(notification.task_id, target.id),
          eq(notification.workspace_id, workspaceId),
          eq(notification.recipient_id, recipientId),
          inArray(notification.kind, ["mention", "comment"]),
        ),
      );
    return;
  }
  await db
    .update(project_notification)
    .set({ read_at: now })
    .where(
      and(
        eq(project_notification.project_id, target.id),
        eq(project_notification.workspace_id, workspaceId),
        eq(project_notification.recipient_id, recipientId),
      ),
    );
}
