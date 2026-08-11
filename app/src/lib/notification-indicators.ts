import type { NotificationView } from "@/server/services/collaboration";

export interface NotificationIndicators {
  unreadComments: Record<string, number>;
  newTasks: Record<string, boolean>;
}

/**
 * Keeps card indicators semantically separate: comment counts belong to the
 * comment button, while a newly created task gets its own N marker.
 */
export function notificationIndicators(
  notifications: NotificationView[],
): NotificationIndicators {
  return notifications.reduce<NotificationIndicators>(
    (indicators, item) => {
      if (item.read_at) return indicators;
      const key = `${item.target_type}:${item.target_id}`;

      if (item.kind === "comment" || item.kind === "mention") {
        indicators.unreadComments[key] =
          (indicators.unreadComments[key] ?? 0) + 1;
      } else if (item.kind === "task_created" && item.target_type === "task") {
        indicators.newTasks[key] = true;
      }

      return indicators;
    },
    { unreadComments: {}, newTasks: {} },
  );
}
