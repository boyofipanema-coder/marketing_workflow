/**
 * search.ts — Pure task search/filter utilities.
 */

import type { Task, Project, Member } from "@/server/db/schema";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DueFilter =
  | { type: "exact"; date: string }
  | { type: "range"; start: string; end: string }
  | { type: "undated" };

export interface SearchOptions {
  query?: string;
  projectId?: string;
  assigneeId?: string;
  status?: Task["status"];
  due?: DueFilter;
}

// ---------------------------------------------------------------------------
// searchTasks
// ---------------------------------------------------------------------------

/**
 * Filters tasks by the given options. All filters combine with AND.
 *
 * - query: case-insensitive trimmed SUBSTRING match on title + description
 * - projectId: exact match on project_id
 * - assigneeId: exact match on assignee_id
 * - status: exact match on status
 * - due:
 *   - { type: "exact", date } — due_date === date
 *   - { type: "range", start, end } — start <= due_date <= end (inclusive)
 *   - { type: "undated" } — due_date IS NULL
 *   - (omitted) — excludes tasks with no due_date (undated tasks excluded unless Undated filter chosen)
 *
 * Undated tasks (due_date == null) are excluded unless `due` is { type: "undated" }.
 */
export function searchTasks(tasks: Task[], options: SearchOptions): Task[] {
  const { query, projectId, assigneeId, status, due } = options;

  const normalizedQuery = query ? query.trim().toLowerCase() : null;

  return tasks.filter((task) => {
    // Query filter: case-insensitive substring match on title + description
    if (normalizedQuery) {
      const inTitle = task.title.toLowerCase().includes(normalizedQuery);
      const inDescription = task.description
        ? task.description.toLowerCase().includes(normalizedQuery)
        : false;
      if (!inTitle && !inDescription) return false;
    }

    // Project filter
    if (projectId !== undefined) {
      if (task.project_id !== projectId) return false;
    }

    // Assignee filter
    if (assigneeId !== undefined) {
      if (task.assignee_id !== assigneeId) return false;
    }

    // Status filter
    if (status !== undefined) {
      if (task.status !== status) return false;
    }

    // Due date filter
    if (due !== undefined) {
      if (due.type === "undated") {
        // Include only tasks with no due date
        if (task.due_date !== null && task.due_date !== undefined) return false;
      } else if (due.type === "exact") {
        if (task.due_date !== due.date) return false;
      } else if (due.type === "range") {
        // Inclusive range: start <= due_date <= end
        if (
          task.due_date === null ||
          task.due_date === undefined ||
          task.due_date < due.start ||
          task.due_date > due.end
        ) {
          return false;
        }
      }
    } else {
      // No due filter: exclude undated tasks
      if (task.due_date === null || task.due_date === undefined) return false;
    }

    return true;
  });
}

// ---------------------------------------------------------------------------
// Workspace search
// ---------------------------------------------------------------------------

export interface WorkspaceSearchOptions {
  /** Matched against task title, project name, and assignee name. */
  query?: string;
  projectId?: string;
  assigneeId?: string;
  status?: Task["status"];
  due?: DueFilter;
  /** Cancelled tasks are hidden unless explicitly requested. */
  includeCancelled?: boolean;
}

export interface SearchIndex {
  projects: Project[];
  members: Member[];
}

export function hasActiveFilters(options: WorkspaceSearchOptions): boolean {
  return Boolean(
    options.query?.trim() ||
      options.projectId ||
      options.assigneeId ||
      options.status ||
      options.due
  );
}

/**
 * The search the nav bar drives.
 *
 * Differs from `searchTasks` in two ways that matter for a search box: the text
 * query also matches the task's project and assignee *names*, and a task with
 * no due date is a normal result rather than something to hide. Filters combine
 * with AND; an empty query matches everything so filters work on their own.
 */
export function searchWorkspaceTasks(
  tasks: Task[],
  index: SearchIndex,
  options: WorkspaceSearchOptions
): Task[] {
  const { query, projectId, assigneeId, status, due, includeCancelled } = options;

  const needle = query?.trim().toLowerCase() ?? "";
  const projectNames = new Map(
    index.projects.map((p) => [p.id, p.name.toLowerCase()])
  );
  const memberNames = new Map(
    index.members.map((m) => [m.id, m.name.toLowerCase()])
  );

  return tasks.filter((task) => {
    if (!includeCancelled && task.cancelled_at) return false;

    if (needle) {
      const haystack = [
        task.title,
        task.description ?? "",
        task.project_id ? projectNames.get(task.project_id) ?? "" : "",
        task.assignee_id ? memberNames.get(task.assignee_id) ?? "" : "",
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(needle)) return false;
    }

    if (projectId && task.project_id !== projectId) return false;
    if (assigneeId && task.assignee_id !== assigneeId) return false;
    if (status && task.status !== status) return false;

    if (due) {
      if (due.type === "undated") {
        if (task.due_date) return false;
      } else if (due.type === "exact") {
        if (task.due_date !== due.date) return false;
      } else {
        if (
          !task.due_date ||
          task.due_date < due.start ||
          task.due_date > due.end
        ) {
          return false;
        }
      }
    }

    return true;
  });
}
