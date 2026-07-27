import { isMilestone } from "@/lib/board-graph";
import type { Brand, Project, Task, Workstream } from "@/server/db/schema";

export type WorkflowFilter =
  | "all"
  | "due"
  | "overdue"
  | "done";

export interface WorkflowCounts {
  total: number;
  done: number;
  open: number;
  dueSoon: number;
  overdue: number;
}

export interface WorkflowStageSummary {
  id: string;
  name: string;
  tasks: Task[];
}

export interface ProjectWorkflowSummary {
  project: Project;
  counts: WorkflowCounts;
  stages: WorkflowStageSummary[];
  childrenByParent: Map<string, Task[]>;
  nextMilestone: Task | null;
}

export interface BrandWorkflowSummary {
  brand: Brand | null;
  projects: ProjectWorkflowSummary[];
}

function byTaskOrder(a: Task, b: Task): number {
  return (
    a.sort_order - b.sort_order ||
    (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999") ||
    a.created_at.localeCompare(b.created_at)
  );
}

export function matchesWorkflowFilter(
  task: Task,
  filter: WorkflowFilter,
  today: string,
): boolean {
  if (filter === "all") return true;
  if (filter === "overdue") {
    return task.status !== "Done" && !!task.due_date && task.due_date < today;
  }
  if (filter === "done") return task.status === "Done";
  const dueLimit = new Date(`${today}T00:00:00+09:00`);
  dueLimit.setDate(dueLimit.getDate() + 7);
  const limit = dueLimit.toLocaleDateString("en-CA", {
    timeZone: "Asia/Seoul",
  });
  return (
    task.status !== "Done" &&
    !!task.due_date &&
    task.due_date >= today &&
    task.due_date <= limit
  );
}

export function summarizeProjectWorkflow(
  project: Project,
  tasks: Task[],
  workstreams: Workstream[],
  today: string,
): ProjectWorkflowSummary {
  const projectTasks = tasks.filter(
    (task) => task.project_id === project.id && !task.cancelled_at,
  );
  const work = projectTasks.filter((task) => !isMilestone(task));
  const workIds = new Set(work.map((task) => task.id));
  const roots = work
    .filter(
      (task) =>
        !task.parent_task_id || !workIds.has(task.parent_task_id),
    )
    .sort(byTaskOrder);

  const childrenByParent = new Map<string, Task[]>();
  for (const task of work) {
    if (!task.parent_task_id || !workIds.has(task.parent_task_id)) continue;
    const siblings = childrenByParent.get(task.parent_task_id) ?? [];
    siblings.push(task);
    childrenByParent.set(task.parent_task_id, siblings);
  }
  for (const children of childrenByParent.values()) children.sort(byTaskOrder);

  const projectWorkstreams = workstreams
    .filter((workstream) => workstream.project_id === project.id)
    .sort((a, b) => a.order - b.order);
  const stages = projectWorkstreams.map((workstream) => ({
    id: workstream.id,
    name: workstream.name,
    tasks: roots.filter((task) => task.workstream_id === workstream.id),
  }));
  const unassigned = roots.filter(
    (task) =>
      !task.workstream_id ||
      !projectWorkstreams.some(
        (workstream) => workstream.id === task.workstream_id,
      ),
  );
  if (unassigned.length > 0 || stages.length === 0) {
    stages.push({
      id: "_unassigned",
      name: stages.length === 0 ? "전체 업무" : "영역 미지정",
      tasks: unassigned,
    });
  }

  const nextMilestone =
    projectTasks
      .filter(
        (task) =>
          isMilestone(task) &&
          task.status !== "Done" &&
          !!task.due_date &&
          task.due_date >= today,
      )
      .sort((a, b) => a.due_date!.localeCompare(b.due_date!))[0] ?? null;

  return {
    project,
    counts: {
      total: roots.length,
      done: roots.filter((task) => task.status === "Done").length,
      open: roots.filter((task) => task.status !== "Done").length,
      dueSoon: roots.filter((task) =>
        matchesWorkflowFilter(task, "due", today),
      ).length,
      overdue: roots.filter(
        (task) =>
          task.status !== "Done" && !!task.due_date && task.due_date < today,
      ).length,
    },
    stages,
    childrenByParent,
    nextMilestone,
  };
}

export function summarizeWorkspaceWorkflow(
  brands: Brand[],
  projects: Project[],
  tasks: Task[],
  workstreams: Workstream[],
  today: string,
): BrandWorkflowSummary[] {
  const summaries = projects.map((project) =>
    summarizeProjectWorkflow(project, tasks, workstreams, today),
  );

  const groups: BrandWorkflowSummary[] = brands.map((brand) => ({
    brand,
    projects: summaries.filter(
      (summary) => summary.project.brand_id === brand.id,
    ),
  }));
  const unbranded = summaries.filter((summary) => !summary.project.brand_id);
  if (unbranded.length > 0) groups.push({ brand: null, projects: unbranded });

  return groups.filter((group) => group.projects.length > 0);
}
