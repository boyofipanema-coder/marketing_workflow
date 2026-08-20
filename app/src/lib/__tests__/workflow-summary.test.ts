import { describe, expect, it } from "vitest";
import { makeTaskFixture } from "@/server/db/fixtures";
import type { Brand, Project, Workstream } from "@/server/db/schema";
import {
  matchesWorkflowFilter,
  summarizeProjectWorkflow,
  summarizeWorkspaceWorkflow,
} from "../workflow-summary";

const project: Project = {
  id: "project-1",
  workspace_id: "ws-1",
  brand_id: "brand-1",
  name: "봄 캠페인",
  one_line_objective: null,
  project_lead_id: "member-1",
  target_start_date: null,
  target_end_date: "2024-04-30",
  sort_order: 0,
  archived_at: null,
  created_at: "2024-01-01",
  updated_at: "2024-01-01",
};

const brand: Brand = {
  id: "brand-1",
  workspace_id: "ws-1",
  name: "스텔라랩스",
  color: "#0a84ff",
  sort_order: 0,
  archived_at: null,
  created_at: "2024-01-01",
  updated_at: "2024-01-01",
};

const workstreams: Workstream[] = [
  { id: "planning", project_id: project.id, name: "기획", order: 0 },
  { id: "production", project_id: project.id, name: "제작", order: 1 },
];

describe("summarizeProjectWorkflow", () => {
  it("uses top-level work for project counts and keeps children with parents", () => {
    const tasks = [
      makeTaskFixture({
        id: "moving",
        project_id: project.id,
        workstream_id: "planning",
        status: "InProgress",
        due_date: "2024-03-10",
      }),
      makeTaskFixture({
        id: "child",
        project_id: project.id,
        parent_task_id: "moving",
        workstream_id: "planning",
        status: "Done",
      }),
      makeTaskFixture({
        id: "waiting",
        project_id: project.id,
        workstream_id: "production",
        status: "Waiting",
      }),
      makeTaskFixture({
        id: "cancelled",
        project_id: project.id,
        cancelled_at: "2024-03-01",
      }),
      makeTaskFixture({
        id: "milestone",
        project_id: project.id,
        kind: "milestone",
        title: "공개",
        due_date: "2024-03-20",
      }),
    ];

    const result = summarizeProjectWorkflow(
      project,
      tasks,
      workstreams,
      "2024-03-14",
    );

    expect(result.counts).toMatchObject({
      total: 2,
      done: 0,
      open: 2,
      dueSoon: 0,
      overdue: 1,
    });
    expect(result.stages.map((stage) => stage.name)).toEqual(["기획", "제작"]);
    expect(result.childrenByParent.get("moving")?.map((task) => task.id)).toEqual([
      "child",
    ]);
    expect(result.nextMilestone?.id).toBe("milestone");
  });

  it("places orphaned and unassigned work in a readable fallback stage", () => {
    const result = summarizeProjectWorkflow(
      project,
      [
        makeTaskFixture({
          project_id: project.id,
          parent_task_id: "missing",
          workstream_id: null,
        }),
      ],
      [],
      "2024-03-14",
    );

    expect(result.stages).toHaveLength(1);
    expect(result.stages[0]?.name).toBe("전체 업무");
    expect(result.stages[0]?.tasks).toHaveLength(1);
  });
});

describe("summarizeWorkspaceWorkflow", () => {
  it("groups projects by brand and preserves unbranded projects", () => {
    const commonProject = { ...project, id: "common", brand_id: null };
    const groups = summarizeWorkspaceWorkflow(
      [brand],
      [project, commonProject],
      [],
      workstreams,
      "2024-03-14",
    );

    expect(groups.map((group) => group.brand?.name ?? "공통")).toEqual([
      "스텔라랩스",
      "공통",
    ]);
  });
});

describe("matchesWorkflowFilter", () => {
  it("matches due, completed and overdue work from observable facts", () => {
    const late = makeTaskFixture({
      status: "InProgress",
      due_date: "2024-03-10",
    });
    const done = makeTaskFixture({
      status: "Done",
      due_date: "2024-03-10",
    });

    const upcoming = makeTaskFixture({
      status: "Waiting",
      due_date: "2024-03-18",
    });
    expect(matchesWorkflowFilter(upcoming, "due", "2024-03-14")).toBe(true);
    expect(matchesWorkflowFilter(late, "overdue", "2024-03-14")).toBe(true);
    expect(matchesWorkflowFilter(done, "overdue", "2024-03-14")).toBe(false);
    expect(matchesWorkflowFilter(done, "done", "2024-03-14")).toBe(true);
  });
});
