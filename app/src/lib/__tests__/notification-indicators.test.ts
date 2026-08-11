import { describe, expect, it } from "vitest";
import { notificationIndicators } from "../notification-indicators";
import type { NotificationView } from "@/server/services/collaboration";

function notification(
  kind: NotificationView["kind"],
  overrides: Partial<NotificationView> = {},
): NotificationView {
  return {
    id: crypto.randomUUID(),
    target_type: "task",
    target_id: "task-1",
    kind,
    actor_name: "지수",
    target_title: "새 업무",
    comment_body: null,
    schedule_date: null,
    read_at: null,
    created_at: "2026-08-11T00:00:00.000Z",
    ...overrides,
  };
}

describe("notificationIndicators", () => {
  it("counts only comment notifications beside the comment button", () => {
    const result = notificationIndicators([
      notification("comment"),
      notification("mention"),
      notification("task_created"),
      notification("task_scheduled"),
    ]);

    expect(result.unreadComments["task:task-1"]).toBe(2);
  });

  it("marks an unread created task with N and ignores read notifications", () => {
    const result = notificationIndicators([
      notification("task_created"),
      notification("task_created", {
        target_id: "task-2",
        read_at: "2026-08-11T01:00:00.000Z",
      }),
    ]);

    expect(result.newTasks).toEqual({ "task:task-1": true });
  });
});
