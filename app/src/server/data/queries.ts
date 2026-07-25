/**
 * Server-side query functions for reading from D1 via drizzle.
 * These functions are used in server components and server actions only.
 */

import { and, asc, eq, isNull } from "drizzle-orm";
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

  // No/invalid session — auto-enter as the default workspace member.
  // (Login is intentionally bypassed at this stage; see getDefaultMember.)
  const currentMember = await getDefaultMember(db);
  if (!currentMember) {
    // No members seeded at all — nothing we can do but send to login.
    redirect("/login");
  }

  return { member: currentMember, db };
}

/**
 * Returns the member to auto-authenticate as when no real session is present.
 * Prefers an admin; falls back to any member. Returns null if the workspace
 * has no members yet. Remove this (and its callers) to re-enable real login.
 */
async function getDefaultMember(db: Database): Promise<Member | null> {
  const admins = await db
    .select()
    .from(member)
    .where(eq(member.role, "admin"))
    .limit(1);
  if (admins.length > 0) return admins[0]!;

  const any = await db.select().from(member).limit(1);
  return any[0] ?? null;
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

/** Fetch all milestones for a project, scoped by workspace, earliest due first. */
export async function getProjectMilestones(
  db: Database,
  projectId: string,
  workspaceId: string
): Promise<Milestone[]> {
  const rows = await db
    .select({ ms: milestone })
    .from(milestone)
    .innerJoin(project, eq(milestone.project_id, project.id))
    .where(
      and(
        eq(milestone.project_id, projectId),
        eq(project.workspace_id, workspaceId)
      )
    )
    .orderBy(asc(milestone.due_date));
  return rows.map((r) => r.ms);
}

/** Fetch every milestone in the workspace, earliest due first. */
export async function getWorkspaceMilestones(
  db: Database,
  workspaceId: string
): Promise<Milestone[]> {
  const rows = await db
    .select({ ms: milestone })
    .from(milestone)
    .innerJoin(project, eq(milestone.project_id, project.id))
    .where(
      and(eq(project.workspace_id, workspaceId), isNull(project.archived_at))
    )
    .orderBy(asc(milestone.due_date));
  return rows.map((r) => r.ms);
}
