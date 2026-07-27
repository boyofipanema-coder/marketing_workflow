import { currentISOWeekKST, isOverdue } from "@/lib/derive";
import type { Task } from "@/server/db/schema";

export type FlowColumn = "planned" | "moving" | "waiting" | "review";

export const FLOW_COLUMNS: Array<{ id: FlowColumn; label: string }> = [
  { id: "planned", label: "예정" },
  { id: "moving", label: "진행 중" },
  { id: "waiting", label: "대기" },
  { id: "review", label: "검토" },
];

export function isActiveWork(task: Task): boolean {
  return !task.cancelled_at && task.status !== "Done" && task.kind !== "milestone";
}

export function flowColumn(task: Task): FlowColumn {
  if (task.status === "Waiting") return "waiting";
  if (task.status === "Review") return "review";
  if (task.status === "InProgress") return "moving";
  return "planned";
}

export function memberWorkload(tasks: Task[], memberId: string, now = new Date()) {
  const active = tasks.filter(
    (task) => isActiveWork(task) && task.assignee_id === memberId,
  );
  const { weekStart, weekEnd } = currentISOWeekKST(now);

  return {
    active,
    activeCount: active.length,
    dueThisWeekCount: active.filter(
      (task) =>
        task.due_date &&
        task.due_date >= weekStart &&
        task.due_date <= weekEnd,
    ).length,
    overdueCount: active.filter((task) => isOverdue(task, now)).length,
    waitingCount: active.filter((task) => task.status === "Waiting").length,
  };
}
