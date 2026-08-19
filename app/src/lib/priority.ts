import type { Task } from "@/server/db/schema";

export interface PrioritySignal {
  task: Task;
  score: number;
  reason: string;
  level: "now" | "soon" | "important";
}

function dayDistance(from: string, to: string): number {
  return Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
      86_400_000,
  );
}

export function prioritySignal(
  task: Task,
  today: string,
): PrioritySignal | null {
  if (task.cancelled_at || task.status === "Done" || task.kind === "milestone") {
    return null;
  }

  let score = task.importance === "key" ? 35 : 0;
  let reason = task.importance === "key" ? "중요 업무" : "진행할 업무";
  let level: PrioritySignal["level"] = task.importance === "key" ? "important" : "soon";

  if (task.status === "InProgress") score += 28;
  if (task.status === "Review") {
    score += 48;
    reason = "검토가 필요합니다";
    level = "now";
  }

  if (task.follow_up_at) {
    const followUpDays = dayDistance(today, task.follow_up_at);
    if (followUpDays <= 0) {
      score += 95 + Math.min(20, Math.abs(followUpDays));
      reason = followUpDays < 0 ? `${Math.abs(followUpDays)}일 지난 팔로업` : "오늘 팔로업";
      level = "now";
    }
  }

  if (task.due_date) {
    const dueDays = dayDistance(today, task.due_date);
    const isSchedule = task.start_date === task.due_date;
    if (dueDays < 0) {
      score += 110 + Math.min(20, Math.abs(dueDays));
      reason = `${Math.abs(dueDays)}일 기한 초과`;
      level = "now";
    } else if (dueDays === 0) {
      score += 90;
      reason = isSchedule
        ? `오늘${task.due_time ? ` ${task.due_time}` : ""} 일정`
        : `오늘${task.due_time ? ` ${task.due_time}` : ""} 마감`;
      level = "now";
    } else if (dueDays === 1) {
      score += 58;
      reason = isSchedule ? "내일 일정" : "내일 마감";
      level = "soon";
    } else if (dueDays <= 3) {
      score += 38;
      reason = `${dueDays}일 뒤 ${isSchedule ? "일정" : "마감"}`;
      level = "soon";
    } else if (dueDays <= 7) {
      score += 18;
    }
  }

  return { task, score, reason, level };
}

export function rankedTasks(
  tasks: Task[],
  viewerId: string,
  today: string,
  limit = 5,
): PrioritySignal[] {
  return tasks
    .filter(
      (task) =>
        task.assignee_id === viewerId ||
        (task.status === "Review" && task.reviewer_id === viewerId),
    )
    .map((task) => prioritySignal(task, today))
    .filter((signal): signal is PrioritySignal => signal !== null)
    .sort(
      (a, b) =>
        b.score - a.score ||
        (a.task.due_date ?? "9999").localeCompare(b.task.due_date ?? "9999") ||
        a.task.title.localeCompare(b.task.title, "ko"),
    )
    .slice(0, limit);
}
