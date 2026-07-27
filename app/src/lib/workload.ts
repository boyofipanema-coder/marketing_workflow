import { currentISOWeekKST, isOverdue } from "@/lib/derive";
import type { Task } from "@/server/db/schema";

export function isActiveWork(task: Task): boolean {
  return !task.cancelled_at && task.status !== "Done" && task.kind !== "milestone";
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
    completedCount: tasks.filter(
      (task) =>
        !task.cancelled_at &&
        task.kind !== "milestone" &&
        task.assignee_id === memberId &&
        task.status === "Done",
    ).length,
  };
}
