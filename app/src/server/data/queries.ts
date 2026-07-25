/**
 * Server-side query functions for reading from D1 via drizzle.
 * These functions are used in server components and server actions only.
 */

import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDb } from "@/server/db/client";
import { validateSession } from "@/server/auth/session";
import { SESSION_COOKIE_NAME } from "@/server/auth/constants";
import {
  task,
  project,
  workstream,
  member,
  milestone,
} from "@/server/db/schema";
import type {
  Task,
  Project,
  Workstream,
  Member,
  Milestone,
} from "@/server/db/schema";
import type { Database } from "@/server/db/client";

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

/**
 * Reads the session cookie, validates it against D1, and returns the current
 * member. Redirects to /login if the session is missing or expired.
 */
export async function getCurrentMember(): Promise<{
  member: Member;
  db: Database;
}> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    redirect("/login");
  }

  const { env } = await getCloudflareContext({ async: true });
  const db = createDb(env.DB);
  const currentMember = await validateSession(db, token);

  if (!currentMember) {
    redirect("/login");
  }

  return { member: currentMember, db };
}

// ---------------------------------------------------------------------------
// Task queries
// ---------------------------------------------------------------------------

/** Fetch all non-cancelled tasks for a workspace. */
export async function getWorkspaceTasks(
  db: Database,
  workspaceId: string
): Promise<Task[]> {
  return db
    .select()
    .from(task)
    .where(eq(task.workspace_id, workspaceId));
}

/** Fetch all tasks for a single project. */
export async function getProjectTasks(
  db: Database,
  projectId: string
): Promise<Task[]> {
  return db
    .select()
    .from(task)
    .where(eq(task.project_id, projectId));
}

// ---------------------------------------------------------------------------
// Project queries
// ---------------------------------------------------------------------------

/** Fetch all non-archived projects for a workspace. */
export async function getWorkspaceProjects(
  db: Database,
  workspaceId: string
): Promise<Project[]> {
  const rows = await db
    .select()
    .from(project)
    .where(eq(project.workspace_id, workspaceId));
  return rows.filter((p) => p.archived_at === null || p.archived_at === undefined);
}

/** Fetch a single project by ID. */
export async function getProjectById(
  db: Database,
  projectId: string
): Promise<Project | null> {
  const rows = await db
    .select()
    .from(project)
    .where(eq(project.id, projectId))
    .limit(1);
  return rows[0] ?? null;
}

// ---------------------------------------------------------------------------
// Workstream queries
// ---------------------------------------------------------------------------

/** Fetch all workstreams for a project, sorted by order. */
export async function getProjectWorkstreams(
  db: Database,
  projectId: string
): Promise<Workstream[]> {
  const rows = await db
    .select()
    .from(workstream)
    .where(eq(workstream.project_id, projectId));
  return rows.sort((a, b) => a.order - b.order);
}

// ---------------------------------------------------------------------------
// Member queries
// ---------------------------------------------------------------------------

/** Fetch all members of a workspace. */
export async function getWorkspaceMembers(
  db: Database,
  workspaceId: string
): Promise<Member[]> {
  return db
    .select()
    .from(member)
    .where(eq(member.workspace_id, workspaceId));
}

/** Build a Map<memberId, Member> from a member array for fast lookups. */
export function memberMap(members: Member[]): Map<string, Member> {
  return new Map(members.map((m) => [m.id, m]));
}

// ---------------------------------------------------------------------------
// Milestone queries
// ---------------------------------------------------------------------------

/** Fetch all milestones for a project. */
export async function getProjectMilestones(
  db: Database,
  projectId: string
): Promise<Milestone[]> {
  return db
    .select()
    .from(milestone)
    .where(eq(milestone.project_id, projectId));
}

// ---------------------------------------------------------------------------
// TaskItem mapping (DB Task → UI TaskItem)
// ---------------------------------------------------------------------------

import type { TaskItem } from "@/components/TaskCard";

export type DbTaskStatus = Task["status"];

/**
 * Converts a DB Task to a TaskItem suitable for TaskCard/SectionList.
 * Resolves assignee name from the provided member map. The DB status enum IS
 * the shared status vocabulary (lib/status.ts), so it is passed through
 * directly — no collapsing map, so Inbox and Waiting stay distinct.
 */
export function toTaskItem(
  t: Task,
  members: Map<string, Member>,
  now: Date = new Date()
): TaskItem {
  const assignee = t.assignee_id ? members.get(t.assignee_id) : undefined;
  const cancelled = t.cancelled_at !== null && t.cancelled_at !== undefined;
  const isOverdue =
    t.due_date !== null &&
    t.due_date !== undefined &&
    t.due_date < now.toISOString().slice(0, 10) &&
    t.status !== "Done" &&
    !cancelled;

  return {
    id: t.id,
    title: t.title,
    assigneeName: assignee?.name,
    status: t.status,
    cancelled,
    dueDate: t.due_date ?? undefined,
    flags: isOverdue ? { overdue: true } : undefined,
  };
}
