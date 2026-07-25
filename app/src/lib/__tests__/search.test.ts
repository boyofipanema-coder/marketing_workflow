import { describe, it, expect } from "vitest";
import {
  searchTasks,
  searchWorkspaceTasks,
  hasActiveFilters,
} from "../search";
import type { Task } from "@/server/db/schema";
import { makeTaskFixture } from "@/server/db/fixtures";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTask(overrides: Partial<Task> = {}): Task {
  return makeTaskFixture({ due_date: "2024-03-20", ...overrides });
}

// ---------------------------------------------------------------------------
// Query / substring match
// ---------------------------------------------------------------------------

describe("searchTasks — query", () => {
  const tasks = [
    makeTask({ id: "t1", title: "Fix the Bug", description: "Critical issue in auth" }),
    makeTask({ id: "t2", title: "Write tests", description: "Unit tests for API" }),
    makeTask({ id: "t3", title: "Deploy App", description: null }),
  ];

  it("matches case-insensitively in title", () => {
    const result = searchTasks(tasks, { query: "fix" });
    expect(result.map((t) => t.id)).toContain("t1");
    expect(result.map((t) => t.id)).not.toContain("t2");
  });

  it("matches case-insensitively in description", () => {
    const result = searchTasks(tasks, { query: "critical" });
    expect(result.map((t) => t.id)).toContain("t1");
  });

  it("matches mixed-case query against lowercase title", () => {
    const result = searchTasks(tasks, { query: "WRITE" });
    expect(result.map((t) => t.id)).toContain("t2");
  });

  it("matches partial substring in title", () => {
    const result = searchTasks(tasks, { query: "eplo" });
    expect(result.map((t) => t.id)).toContain("t3");
  });

  it("trims leading/trailing whitespace in query", () => {
    const result = searchTasks(tasks, { query: "  fix  " });
    expect(result.map((t) => t.id)).toContain("t1");
  });

  it("returns no results when no match", () => {
    const result = searchTasks(tasks, { query: "xyz123" });
    expect(result).toHaveLength(0);
  });

  it("returns all tasks with due_date when query is empty string", () => {
    const result = searchTasks(tasks, { query: "" });
    expect(result).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// AND filters
// ---------------------------------------------------------------------------

describe("searchTasks — AND filters", () => {
  const tasks = [
    makeTask({
      id: "t1",
      title: "Alpha",
      project_id: "p1",
      assignee_id: "u1",
      status: "InProgress",
      due_date: "2024-03-15",
    }),
    makeTask({
      id: "t2",
      title: "Alpha beta",
      project_id: "p2",
      assignee_id: "u1",
      status: "InProgress",
      due_date: "2024-03-16",
    }),
    makeTask({
      id: "t3",
      title: "Gamma",
      project_id: "p1",
      assignee_id: "u2",
      status: "ToDo",
      due_date: "2024-03-17",
    }),
  ];

  it("filters by projectId", () => {
    const result = searchTasks(tasks, { projectId: "p1" });
    expect(result.map((t) => t.id)).toEqual(expect.arrayContaining(["t1", "t3"]));
    expect(result.map((t) => t.id)).not.toContain("t2");
  });

  it("filters by assigneeId", () => {
    const result = searchTasks(tasks, { assigneeId: "u1" });
    expect(result.map((t) => t.id)).toEqual(expect.arrayContaining(["t1", "t2"]));
    expect(result.map((t) => t.id)).not.toContain("t3");
  });

  it("filters by status", () => {
    const result = searchTasks(tasks, { status: "ToDo" });
    expect(result.map((t) => t.id)).toEqual(["t3"]);
  });

  it("combines query AND projectId AND assigneeId", () => {
    const result = searchTasks(tasks, {
      query: "alpha",
      projectId: "p1",
      assigneeId: "u1",
    });
    expect(result.map((t) => t.id)).toEqual(["t1"]);
  });

  it("returns empty when no task matches all filters", () => {
    const result = searchTasks(tasks, {
      query: "gamma",
      assigneeId: "u1",
    });
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Due date filters
// ---------------------------------------------------------------------------

describe("searchTasks — due filter", () => {
  const dated = makeTask({ id: "dated", due_date: "2024-03-15" });
  const later = makeTask({ id: "later", due_date: "2024-03-20" });
  const undated = makeTask({ id: "undated", due_date: null });

  it("excludes undated tasks when no due filter is provided", () => {
    const result = searchTasks([dated, undated], {});
    expect(result.map((t) => t.id)).toContain("dated");
    expect(result.map((t) => t.id)).not.toContain("undated");
  });

  it("includes only undated tasks for Undated filter", () => {
    const result = searchTasks([dated, undated], { due: { type: "undated" } });
    expect(result.map((t) => t.id)).toEqual(["undated"]);
  });

  it("filters by exact date", () => {
    const result = searchTasks([dated, later], {
      due: { type: "exact", date: "2024-03-15" },
    });
    expect(result.map((t) => t.id)).toEqual(["dated"]);
  });

  it("filters by inclusive range — includes boundary dates", () => {
    const tasks = [dated, later, undated];
    const result = searchTasks(tasks, {
      due: { type: "range", start: "2024-03-15", end: "2024-03-20" },
    });
    expect(result.map((t) => t.id)).toContain("dated");
    expect(result.map((t) => t.id)).toContain("later");
    expect(result.map((t) => t.id)).not.toContain("undated");
  });

  it("filters by range — excludes tasks outside range", () => {
    const earlyTask = makeTask({ id: "early", due_date: "2024-03-10" });
    const lateTask = makeTask({ id: "late", due_date: "2024-03-25" });
    const result = searchTasks([earlyTask, dated, later, lateTask], {
      due: { type: "range", start: "2024-03-14", end: "2024-03-20" },
    });
    expect(result.map((t) => t.id)).toContain("dated");
    expect(result.map((t) => t.id)).toContain("later");
    expect(result.map((t) => t.id)).not.toContain("early");
    expect(result.map((t) => t.id)).not.toContain("late");
  });
});

// ---------------------------------------------------------------------------
// searchWorkspaceTasks — the nav bar's search
// ---------------------------------------------------------------------------

describe("searchWorkspaceTasks", () => {
  const projects = [
    { id: "p1", name: "Spring Campaign" },
    { id: "p2", name: "Website Refresh" },
  ] as never;
  const members = [
    { id: "m1", name: "Jamie Park" },
    { id: "m2", name: "Alex Kim" },
  ] as never;
  const index = { projects, members };

  const tasks = [
    makeTaskFixture({
      id: "t1",
      title: "Draft launch copy",
      project_id: "p1",
      assignee_id: "m1",
      due_date: "2024-03-20",
      status: "InProgress",
    }),
    makeTaskFixture({
      id: "t2",
      title: "Update pricing page",
      project_id: "p2",
      assignee_id: "m2",
      due_date: null,
      status: "ToDo",
    }),
    makeTaskFixture({
      id: "t3",
      title: "Archive old assets",
      project_id: "p2",
      assignee_id: null,
      due_date: "2024-03-25",
      cancelled_at: "2024-03-01T00:00:00Z",
    }),
  ];

  const ids = (result: { id: string }[]) => result.map((t) => t.id);

  it("matches on the project name, not just the task title", () => {
    expect(ids(searchWorkspaceTasks(tasks, index, { query: "spring" }))).toEqual([
      "t1",
    ]);
  });

  it("matches on the assignee name", () => {
    expect(ids(searchWorkspaceTasks(tasks, index, { query: "alex" }))).toEqual([
      "t2",
    ]);
  });

  // The older searchTasks hides undated rows unless you ask for them, which
  // would silently drop results from a plain text search.
  it("keeps undated tasks in the results", () => {
    expect(ids(searchWorkspaceTasks(tasks, index, { query: "pricing" }))).toEqual([
      "t2",
    ]);
  });

  it("hides cancelled tasks unless asked", () => {
    expect(ids(searchWorkspaceTasks(tasks, index, { query: "archive" }))).toEqual(
      []
    );
    expect(
      ids(
        searchWorkspaceTasks(tasks, index, {
          query: "archive",
          includeCancelled: true,
        })
      )
    ).toEqual(["t3"]);
  });

  it("returns everything when no query is given", () => {
    expect(ids(searchWorkspaceTasks(tasks, index, {}))).toEqual(["t1", "t2"]);
  });

  it("combines a query with filters using AND", () => {
    expect(
      ids(
        searchWorkspaceTasks(tasks, index, {
          query: "page",
          status: "InProgress",
        })
      )
    ).toEqual([]);
    expect(
      ids(searchWorkspaceTasks(tasks, index, { query: "page", status: "ToDo" }))
    ).toEqual(["t2"]);
  });

  it("filters undated tasks with the Undated due filter", () => {
    expect(
      ids(searchWorkspaceTasks(tasks, index, { due: { type: "undated" } }))
    ).toEqual(["t2"]);
  });

  it("filters by an inclusive due range", () => {
    expect(
      ids(
        searchWorkspaceTasks(tasks, index, {
          due: { type: "range", start: "2024-03-01", end: "2024-03-20" },
        })
      )
    ).toEqual(["t1"]);
  });
});

describe("hasActiveFilters", () => {
  it("is false for an empty or whitespace-only query", () => {
    expect(hasActiveFilters({})).toBe(false);
    expect(hasActiveFilters({ query: "   " })).toBe(false);
  });

  it("is true when any filter is set", () => {
    expect(hasActiveFilters({ query: "copy" })).toBe(true);
    expect(hasActiveFilters({ projectId: "p1" })).toBe(true);
    expect(hasActiveFilters({ due: { type: "undated" } })).toBe(true);
  });
});
