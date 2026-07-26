/**
 * Server-side query functions for reading from D1 via drizzle.
 * These functions are used in server components and server actions only.
 */

import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDb } from "@/server/db/client";
import { validateSession } from "@/server/auth/session";
import { SESSION_COOKIE_NAME } from "@/server/auth/constants";
import { getActiveMemberId } from "@/server/auth/active-member";
import { task, project, workstream, member, activity_log } from "@/server/db/schema";
import type { Task, Project, Workstream, Member } from "@/server/db/schema";
import type { Database } from "@/server/db/client";
import { dependencyMap } from "@/server/services/dependency";

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

/**
 * Reads the session cookie, validates it against D1, and returns the current
 * member. Falls back to whichever member picked themselves on the entry
 * screen (server/auth/active-member.ts — no password yet). Redirects to
 * /select-member if neither is present.
 */
export async function getCurrentMember(): Promise<{
  member: Member;
  db: Database;
}> {
  const { env } = await getCloudflareContext({ async: true });
  const db = createDb(env.DB);

  // If a valid session exists, use it.
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (token) {
    const currentMember = await validateSession(db, token);
    if (currentMember) {
      return { member: currentMember, db };
    }
  }

  // No real session — fall back to whoever picked themselves on the entry
  // screen. Not authentication: anyone with the app open can switch, which is
  // fine for a small known team sharing one workspace.
  const activeMemberId = await getActiveMemberId();
  if (activeMemberId) {
    const [active] = await db
      .select()
      .from(member)
      .where(eq(member.id, activeMemberId));
    if (active) return { member: active, db };
  }

  redirect("/select-member");
}

// ---------------------------------------------------------------------------
// Task queries
// ---------------------------------------------------------------------------

/** Fetch every task for a workspace, ordered for stable list rendering. */
export async function getWorkspaceTasks(
  db: Database,
  workspaceId: string
): Promise<Task[]> {
  return db
    .select()
    .from(task)
    .where(eq(task.workspace_id, workspaceId))
    .orderBy(asc(task.sort_order), asc(task.created_at));
}

/**
 * Fetch all tasks for a single project.
 * Scoped by workspace so a project id from another workspace returns nothing.
 */
export async function getProjectTasks(
  db: Database,
  projectId: string,
  workspaceId: string
): Promise<Task[]> {
  return db
    .select()
    .from(task)
    .where(
      and(eq(task.project_id, projectId), eq(task.workspace_id, workspaceId))
    )
    .orderBy(asc(task.sort_order), asc(task.created_at));
}

/** Fetch the workspace's Inbox — tasks not yet filed under any project. */
export async function getInboxTasks(
  db: Database,
  workspaceId: string
): Promise<Task[]> {
  return db
    .select()
    .from(task)
    .where(
      and(
        eq(task.workspace_id, workspaceId),
        isNull(task.project_id),
        isNull(task.cancelled_at)
      )
    )
    .orderBy(asc(task.sort_order), asc(task.created_at));
}

// ---------------------------------------------------------------------------
// Project queries
// ---------------------------------------------------------------------------

/** Fetch all non-archived projects for a workspace. */
export async function getWorkspaceProjects(
  db: Database,
  workspaceId: string
): Promise<Project[]> {
  return db
    .select()
    .from(project)
    .where(
      and(eq(project.workspace_id, workspaceId), isNull(project.archived_at))
    )
    .orderBy(asc(project.created_at));
}

/** Fetch the workspace's archived projects, newest first. */
export async function getArchivedProjects(
  db: Database,
  workspaceId: string
): Promise<Project[]> {
  const rows = await db
    .select()
    .from(project)
    .where(eq(project.workspace_id, workspaceId));
  return rows
    .filter((p) => p.archived_at !== null && p.archived_at !== undefined)
    .sort((a, b) => (a.archived_at! < b.archived_at! ? 1 : -1));
}

/** Fetch a single project by ID, scoped to the caller's workspace. */
export async function getProjectById(
  db: Database,
  projectId: string,
  workspaceId: string
): Promise<Project | null> {
  const rows = await db
    .select()
    .from(project)
    .where(
      and(eq(project.id, projectId), eq(project.workspace_id, workspaceId))
    )
    .limit(1);
  return rows[0] ?? null;
}

// ---------------------------------------------------------------------------
// Workstream queries
// ---------------------------------------------------------------------------

/**
 * Fetch all workstreams for a project, sorted by order.
 * Joined through project so another workspace's project id yields nothing.
 */
export async function getProjectWorkstreams(
  db: Database,
  projectId: string,
  workspaceId: string
): Promise<Workstream[]> {
  const rows = await db
    .select({ ws: workstream })
    .from(workstream)
    .innerJoin(project, eq(workstream.project_id, project.id))
    .where(
      and(
        eq(workstream.project_id, projectId),
        eq(project.workspace_id, workspaceId)
      )
    )
    .orderBy(asc(workstream.order));
  return rows.map((r) => r.ws);
}

/**
 * Fetch every workstream in the workspace's active projects — the detail
 * panel needs these to offer a picker after a task moves between projects.
 */
export async function getWorkspaceWorkstreams(
  db: Database,
  workspaceId: string
): Promise<Workstream[]> {
  const rows = await db
    .select({ ws: workstream })
    .from(workstream)
    .innerJoin(project, eq(workstream.project_id, project.id))
    .where(
      and(eq(project.workspace_id, workspaceId), isNull(project.archived_at))
    )
    .orderBy(asc(workstream.order));
  return rows.map((r) => r.ws);
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

// A milestone is a task with kind = "milestone" (migration 0004). These read
// from `task`, not the legacy `milestone` table, and return Task rows.

/** Fetch all milestones for a project, scoped by workspace, earliest due first. */
export async function getProjectMilestones(
  db: Database,
  projectId: string,
  workspaceId: string
): Promise<Task[]> {
  return db
    .select()
    .from(task)
    .where(
      and(
        eq(task.project_id, projectId),
        eq(task.workspace_id, workspaceId),
        eq(task.kind, "milestone"),
        isNull(task.cancelled_at)
      )
    )
    .orderBy(asc(task.due_date));
}

/** Fetch every milestone in the workspace's active projects, earliest due first. */
export async function getWorkspaceMilestones(
  db: Database,
  workspaceId: string
): Promise<Task[]> {
  const rows = await db
    .select({ t: task })
    .from(task)
    .innerJoin(project, eq(task.project_id, project.id))
    .where(
      and(
        eq(task.workspace_id, workspaceId),
        eq(task.kind, "milestone"),
        isNull(task.cancelled_at),
        isNull(project.archived_at)
      )
    )
    .orderBy(asc(task.due_date));
  return rows.map((r) => r.t);
}

// ---------------------------------------------------------------------------
// Dependencies
// ---------------------------------------------------------------------------

/** successorId → predecessorId[] for the whole workspace. */
export async function getDependencyMap(
  db: Database,
  workspaceId: string
): Promise<Record<string, string[]>> {
  const map = await dependencyMap(db, workspaceId);
  return Object.fromEntries(map);
}

// ---------------------------------------------------------------------------
// Activity
// ---------------------------------------------------------------------------

export interface ActivityEntry {
  id: string;
  change_type: string;
  from_value: string | null;
  to_value: string | null;
  created_at: string;
  actor_name: string;
}

/** Recent changes to one task, newest first. Scoped by workspace. */
export async function getTaskActivity(
  db: Database,
  taskId: string,
  workspaceId: string,
  limit = 20
): Promise<ActivityEntry[]> {
  const rows = await db
    .select({ log: activity_log, actor: member })
    .from(activity_log)
    .innerJoin(member, eq(activity_log.actor_id, member.id))
    .where(
      and(
        eq(activity_log.task_id, taskId),
        eq(activity_log.workspace_id, workspaceId)
      )
    )
    .orderBy(desc(activity_log.created_at))
    .limit(limit);
  return rows.map((r) => ({
    id: r.log.id,
    change_type: r.log.change_type,
    from_value: r.log.from_value,
    to_value: r.log.to_value,
    created_at: r.log.created_at,
    actor_name: r.actor.name,
  }));
}
