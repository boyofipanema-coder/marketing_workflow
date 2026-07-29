"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Bell, Inbox } from "lucide-react";
import { markNotificationReadAction } from "@/app/actions/collaboration";
import type { NotificationView } from "@/server/services/collaboration";

export default function NotificationMenu({
  initialNotifications,
}: {
  initialNotifications: NotificationView[];
}) {
  const router = useRouter();
  const [notifications, setNotifications] = useState(
    initialNotifications.filter((item) => item.kind === "comment"),
  );
  const unreadCount = notifications.filter((item) => !item.read_at).length;

  useEffect(() => {
    setNotifications(initialNotifications.filter((item) => item.kind === "comment"));
  }, [initialNotifications]);

  async function openNotification(item: NotificationView) {
    if (!item.read_at) {
      setNotifications((current) =>
        current.map((notification) =>
          notification.id === item.id
            ? { ...notification, read_at: new Date().toISOString() }
            : notification,
        ),
      );
      await markNotificationReadAction(item.id, item.target_type);
    }
    router.push(
      item.target_type === "project"
        ? `/home?project=${encodeURIComponent(item.target_id)}`
        : `/search?q=${encodeURIComponent(item.target_title)}`,
    );
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label={`알림함${unreadCount ? `, 읽지 않은 알림 ${unreadCount}개` : ""}`}
          className="relative grid size-8 place-items-center rounded-lg text-text-secondary hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Bell className="size-4" />
          {unreadCount > 0 && (
            <span className="absolute right-0.5 top-0.5 min-w-3.5 rounded-full bg-flag-blocked px-1 text-center text-[8px] font-bold leading-3.5 text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={7}
          className="z-[90] max-h-[min(70vh,30rem)] w-[min(22rem,calc(100vw-1rem))] overflow-y-auto rounded-2xl border border-border bg-elevated p-2 shadow-xl"
        >
          <p className="px-2 py-2 text-xs font-semibold text-text">알림함</p>
          {!notifications.length && (
            <p className="px-3 py-8 text-center text-xs text-text-tertiary">새 알림이 없습니다</p>
          )}
          {notifications.map((item) => (
            <DropdownMenu.Item
              key={item.id}
              onSelect={() => void openNotification(item)}
              className="relative cursor-default rounded-xl px-3 py-2.5 outline-none data-[highlighted]:bg-surface-2"
            >
              {!item.read_at && <span className="absolute left-1 top-4 size-1.5 rounded-full bg-accent" />}
              <p className="truncate text-[11px] font-semibold text-text">
                {item.actor_name}님이 댓글을 남겼습니다
              </p>
              <p className="mt-0.5 truncate text-[10px] text-text-tertiary">{item.target_title}</p>
              {item.comment_body && (
                <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-text-secondary">{item.comment_body}</p>
              )}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function workMessage(item: NotificationView): string {
  if (item.kind === "task_created") {
    return `${item.actor_name}님이 업무를 추가했습니다`;
  }
  if (item.kind === "task_scheduled") {
    return `${item.actor_name}님이 업무에 일정을 추가했습니다`;
  }
  return `${item.actor_name}님이 업무에 댓글을 남겼습니다`;
}

function shortDate(iso: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "numeric",
    day: "numeric",
  }).format(new Date(`${iso}T00:00:00+09:00`));
}

export function WorkInboxMenu({
  initialNotifications,
}: {
  initialNotifications: NotificationView[];
}) {
  const router = useRouter();
  const workNotifications = initialNotifications.filter(
    (item) => item.target_type === "task",
  );
  const [notifications, setNotifications] = useState(workNotifications);
  const [toast, setToast] = useState<NotificationView | null>(null);
  const seen = useRef(new Set(workNotifications.map((item) => item.id)));
  const unreadCount = notifications.filter((item) => !item.read_at).length;

  useEffect(() => {
    setNotifications(workNotifications);
    const fresh = workNotifications.find((item) => !seen.current.has(item.id));
    workNotifications.forEach((item) => seen.current.add(item.id));
    if (!fresh) return;
    setToast(fresh);
    const timer = window.setTimeout(() => setToast(null), 5000);
    return () => window.clearTimeout(timer);
  }, [initialNotifications]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!document.hidden) router.refresh();
    }, 5000);
    return () => window.clearInterval(timer);
  }, [router]);

  async function openNotification(item: NotificationView) {
    if (!item.read_at) {
      setNotifications((current) =>
        current.map((notification) =>
          notification.id === item.id
            ? { ...notification, read_at: new Date().toISOString() }
            : notification,
        ),
      );
      await markNotificationReadAction(item.id, item.target_type);
    }
    router.push(`/search?q=${encodeURIComponent(item.target_title)}`);
  }

  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            aria-label={`업무함${unreadCount ? `, 읽지 않은 업데이트 ${unreadCount}개` : ""}`}
            className="relative grid size-8 place-items-center rounded-lg text-text-secondary hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Inbox className="size-4" aria-hidden />
            {unreadCount > 0 && (
              <span className="absolute right-0 top-0 min-w-3.5 rounded-full bg-flag-blocked px-1 text-center text-[8px] font-bold leading-3.5 text-white">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={7}
            className="z-[90] max-h-[min(70vh,30rem)] w-[min(22rem,calc(100vw-1rem))] overflow-y-auto rounded-2xl border border-border bg-elevated p-2 shadow-xl"
          >
            <p className="px-2 py-2 text-xs font-semibold text-text">업무함</p>
            {!notifications.length && (
              <p className="px-3 py-8 text-center text-xs text-text-tertiary">
                새 업무 업데이트가 없습니다
              </p>
            )}
            {notifications.map((item) => (
              <DropdownMenu.Item
                key={item.id}
                onSelect={() => void openNotification(item)}
                className="relative cursor-default rounded-xl px-3 py-2.5 outline-none data-[highlighted]:bg-surface-2"
              >
                {!item.read_at && (
                  <span className="absolute left-1 top-4 size-1.5 rounded-full bg-accent" />
                )}
                <p className="truncate text-[11px] font-semibold text-text">
                  {workMessage(item)}
                </p>
                <p className="mt-0.5 line-clamp-2 text-[11px] text-text-secondary">
                  {item.kind === "comment" && item.comment_body
                    ? `“${item.comment_body}”`
                    : item.kind === "task_scheduled" && item.schedule_date
                      ? `“${shortDate(item.schedule_date)}”`
                      : `“${item.target_title}”`}
                </p>
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-4 right-4 z-[100] w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-border bg-elevated px-4 py-3 shadow-xl animate-scale-in"
        >
          <p className="text-xs font-semibold text-text">{workMessage(toast)}</p>
          <p className="mt-1 line-clamp-2 text-xs text-text-secondary">
            {toast.kind === "comment" && toast.comment_body
              ? toast.comment_body
              : toast.target_title}
          </p>
        </div>
      )}
    </>
  );
}
