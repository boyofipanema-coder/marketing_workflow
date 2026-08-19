"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ExternalLink,
  Flag,
  LocateFixed,
  RefreshCw,
} from "lucide-react";
import TaskDetailPanel from "@/components/tasks/TaskDetailPanel";
import { useTaskController } from "@/components/tasks/useTaskController";
import { cn } from "@/lib/utils";
import type { Member, Project, Task, Workstream } from "@/server/db/schema";
import {
  parseGoogleCalendarIcs,
  type GoogleCalendarEvent,
} from "@/server/services/google-calendar";

const TEAM_CALENDAR_ID = "gpvjgso7avdc7npu6ln7qf2qgk@group.calendar.google.com";
const TEAM_CALENDAR_LINK = `https://calendar.google.com/calendar/u/0/r?cid=${encodeURIComponent(TEAM_CALENDAR_ID)}`;
const REFRESH_INTERVAL_MS = 2 * 60 * 1000;

type CalendarKind = "schedule" | "deadline" | "followup" | "milestone";

interface WorkspaceCalendarItem {
  id: string;
  source: "workspace";
  task: Task;
  date: string;
  kind: CalendarKind;
  label: string;
  time: string | null;
  endTime: null;
  allDay: boolean;
}

interface GoogleCalendarItem {
  id: string;
  source: "google";
  date: string;
  kind: "google";
  label: string;
  time: string | null;
  endTime: string | null;
  allDay: boolean;
}

type CalendarItem = WorkspaceCalendarItem | GoogleCalendarItem;

const KIND_META: Record<CalendarKind, { label: string; text: string }> = {
  schedule: { label: "일정", text: "text-accent" },
  deadline: { label: "마감", text: "text-flag-overdue" },
  followup: { label: "팔로업", text: "text-status-waiting" },
  milestone: { label: "마일스톤", text: "text-text-secondary" },
};

function isoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function monthGrid(month: string): string[] {
  const [year, monthNumber] = month.split("-").map(Number);
  const first = new Date(year!, monthNumber! - 1, 1);
  const mondayOffset = (first.getDay() + 6) % 7;
  const start = new Date(year!, monthNumber! - 1, 1 - mondayOffset);
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return isoDate(date);
  });
}

function moveMonth(month: string, delta: number): string {
  const [year, monthNumber] = month.split("-").map(Number);
  return isoDate(new Date(year!, monthNumber! - 1 + delta, 1)).slice(0, 7);
}

function workspaceItems(tasks: Task[]): WorkspaceCalendarItem[] {
  return tasks.flatMap((task) => {
    if (task.cancelled_at || task.status === "Done") return [];
    const items: WorkspaceCalendarItem[] = [];
    if (task.due_date) {
      const kind: CalendarKind = task.kind === "milestone"
        ? "milestone"
        : task.start_date === task.due_date
          ? "schedule"
          : "deadline";
      items.push({
        id: `${task.id}:${kind}`,
        source: "workspace",
        task,
        date: task.due_date,
        kind,
        label: task.title,
        time: task.due_time,
        endTime: null,
        allDay: !task.due_time,
      });
    }
    if (task.follow_up_at && task.follow_up_at !== task.due_date) {
      items.push({
        id: `${task.id}:followup`,
        source: "workspace",
        task,
        date: task.follow_up_at,
        kind: "followup",
        label: task.waiting_party_text
          ? `${task.waiting_party_text} 확인 · ${task.title}`
          : task.title,
        time: null,
        endTime: null,
        allDay: true,
      });
    }
    return items;
  });
}

function googleItems(events: GoogleCalendarEvent[]): GoogleCalendarItem[] {
  return events.map((event) => ({
    id: `google:${event.id}`,
    source: "google",
    date: event.date,
    kind: "google",
    label: event.title,
    time: event.startTime,
    endTime: event.endTime,
    allDay: event.allDay,
  }));
}

function dateLabel(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(new Date(year!, month! - 1, day!));
}

function itemTime(item: CalendarItem): string {
  if (item.allDay || !item.time) return "종일";
  return item.endTime ? `${item.time}–${item.endTime}` : item.time;
}

function SourceMark({ source, compact = false }: { source: CalendarItem["source"]; compact?: boolean }) {
  return (
    <span
      className={cn(
        "inline-grid shrink-0 place-items-center font-bold",
        compact ? "size-3.5 rounded-[4px] text-[7px]" : "h-5 rounded-md px-1.5 text-[9px]",
        source === "google"
          ? "bg-[#4285f4]/12 text-[#2f6fce] dark:bg-[#8ab4f8]/15 dark:text-[#8ab4f8]"
          : "bg-accent/12 text-accent",
      )}
      aria-label={source === "google" ? "Google에서 가져온 일정" : "업무에서 등록한 일정"}
    >
      {compact ? (source === "google" ? "G" : "업") : source === "google" ? "Google" : "업무"}
    </span>
  );
}

export default function CalendarContent({
  tasks,
  projects,
  workstreams,
  members,
  today,
}: {
  tasks: Task[];
  projects: Project[];
  workstreams: Workstream[];
  members: Member[];
  today: string;
}) {
  const controller = useTaskController(tasks);
  const { store } = controller;
  const [googleEvents, setGoogleEvents] = useState<GoogleCalendarEvent[]>([]);
  const [googleStatus, setGoogleStatus] = useState<"loading" | "ready" | "error">("loading");
  const [refreshPending, setRefreshPending] = useState(false);
  const requestRef = useRef<AbortController | null>(null);
  const lastRefresh = useRef(Date.now());
  const [month, setMonth] = useState(today.slice(0, 7));
  const [selectedDate, setSelectedDate] = useState(today);
  const days = useMemo(() => monthGrid(month), [month]);
  const items = useMemo(
    () => [...workspaceItems(controller.tasks), ...googleItems(googleEvents)],
    [controller.tasks, googleEvents],
  );
  const itemsByDate = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    for (const item of items) {
      const current = map.get(item.date) ?? [];
      current.push(item);
      current.sort(
        (a, b) =>
          Number(b.allDay) - Number(a.allDay) ||
          (a.time ?? "").localeCompare(b.time ?? "") ||
          a.label.localeCompare(b.label, "ko"),
      );
      map.set(item.date, current);
    }
    return map;
  }, [items]);
  const selectedItems = itemsByDate.get(selectedDate) ?? [];
  const monthTitle = new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long" })
    .format(new Date(`${month}-01T00:00:00`));

  const refreshCalendar = useCallback(async () => {
    if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
    requestRef.current?.abort();
    const request = new AbortController();
    requestRef.current = request;
    setRefreshPending(true);
    lastRefresh.current = Date.now();
    try {
      const response = await fetch("/api/google-calendar", {
        cache: "no-store",
        signal: request.signal,
      });
      if (!response.ok) throw new Error("Google Calendar request failed");
      const ics = await response.text();
      const year = Number(today.slice(0, 4));
      setGoogleEvents(
        parseGoogleCalendarIcs(ics, `${year - 1}-01-01`, `${year + 2}-12-31`),
      );
      setGoogleStatus("ready");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setGoogleStatus("error");
    } finally {
      if (requestRef.current === request) {
        requestRef.current = null;
        setRefreshPending(false);
      }
    }
  }, [today]);

  useEffect(() => {
    void refreshCalendar();
    const interval = window.setInterval(refreshCalendar, REFRESH_INTERVAL_MS);
    function refreshWhenVisible() {
      if (
        document.visibilityState === "visible" &&
        Date.now() - lastRefresh.current >= REFRESH_INTERVAL_MS
      ) {
        refreshCalendar();
      }
    }
    document.addEventListener("visibilitychange", refreshWhenVisible);
    window.addEventListener("focus", refreshWhenVisible);
    return () => {
      requestRef.current?.abort();
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      window.removeEventListener("focus", refreshWhenVisible);
    };
  }, [refreshCalendar]);

  function openItem(item: CalendarItem) {
    setSelectedDate(item.date);
    if (item.source === "workspace") controller.select(item.task);
  }

  return (
    <>
      <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6 sm:py-10">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-2xs font-semibold tracking-[0.16em] text-accent">통합 캘린더</p>
            <h1 className="mt-1 break-keep text-3xl font-semibold tracking-tight text-text">모든 일정을 하나의 시간표로</h1>
            <p className="mt-2 break-keep text-sm leading-relaxed text-text-secondary">
              업무 일정과 Google 일정을 출처만 구분해 함께 보여줍니다.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={refreshCalendar}
              disabled={refreshPending}
              className="grid size-11 place-items-center rounded-xl border border-border bg-surface text-text-secondary shadow-xs hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-55"
              aria-label="일정 새로고침"
              title="일정 새로고침"
            >
              <RefreshCw className={cn("size-4", refreshPending && "animate-spin")} aria-hidden />
            </button>
            <a
              href={TEAM_CALENDAR_LINK}
              target="_blank"
              rel="noreferrer"
              className="grid size-11 place-items-center rounded-xl border border-border bg-surface text-text-secondary shadow-xs hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Google Calendar에서 열기"
              title="Google Calendar에서 열기"
            >
              <ExternalLink className="size-4" aria-hidden />
            </a>
            <button
              type="button"
              onClick={() => {
                setMonth(today.slice(0, 7));
                setSelectedDate(today);
              }}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-border bg-surface px-4 text-sm font-semibold text-text-secondary shadow-xs transition-[transform,background-color] hover:bg-surface-2 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <LocateFixed className="size-4" aria-hidden />오늘로 이동
            </button>
          </div>
        </header>

        {store.error && (
          <p role="alert" className="mb-4 rounded-xl border border-flag-blocked/30 bg-flag-blocked/10 px-4 py-3 text-xs text-flag-blocked">
            {store.error}
          </p>
        )}
        {googleStatus === "error" && (
          <p role="status" className="mb-4 rounded-xl border border-status-waiting/25 bg-status-waiting/8 px-4 py-3 text-xs text-text-secondary">
            Google 일정을 불러오지 못했습니다. 업무 일정만 표시하고 있습니다.
          </p>
        )}

        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(19rem,0.65fr)]">
          <section aria-label="통합 달력" className="overflow-hidden rounded-[24px] border border-border bg-surface shadow-sm">
            <div className="flex items-center justify-between border-b border-separator px-4 py-4 sm:px-5">
              <button type="button" onClick={() => setMonth((value) => moveMonth(value, -1))} aria-label="이전 달" className="grid size-11 place-items-center rounded-xl text-text-secondary hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><ChevronLeft className="size-4" aria-hidden /></button>
              <div className="text-center">
                <h2 className="text-lg font-semibold tracking-tight text-text">{monthTitle}</h2>
                <div className="mt-1 flex items-center justify-center gap-2">
                  <SourceMark source="workspace" />
                  <SourceMark source="google" />
                </div>
              </div>
              <button type="button" onClick={() => setMonth((value) => moveMonth(value, 1))} aria-label="다음 달" className="grid size-11 place-items-center rounded-xl text-text-secondary hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><ChevronRight className="size-4" aria-hidden /></button>
            </div>
            <div className="grid grid-cols-7 border-b border-separator bg-surface-2/55">
              {["월", "화", "수", "목", "금", "토", "일"].map((weekday) => (
                <div key={weekday} className="py-2 text-center text-2xs font-semibold text-text-tertiary">{weekday}</div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {days.map((date) => {
                const dayItems = itemsByDate.get(date) ?? [];
                const inMonth = date.startsWith(month);
                const selected = date === selectedDate;
                const isToday = date === today;
                return (
                  <div
                    key={date}
                    className={cn(
                      "min-h-24 border-b border-r border-separator p-1.5 sm:min-h-32 sm:p-2",
                      !inMonth && "bg-surface-2/35",
                      selected && "bg-accent/[0.035]",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedDate(date)}
                      aria-label={`${date}${dayItems.length ? `, 일정 ${dayItems.length}개` : ""}`}
                      className={cn(
                        "mb-1 grid size-7 place-items-center rounded-full text-xs font-semibold tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        isToday ? "bg-accent text-white" : selected ? "bg-surface-3 text-text" : inMonth ? "text-text-secondary hover:bg-surface-2" : "text-text-quaternary",
                      )}
                    >
                      {Number(date.slice(-2))}
                    </button>
                    <div className="space-y-1">
                      {dayItems.slice(0, 3).map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => openItem(item)}
                          className="flex w-full items-center gap-1 rounded-md px-1 py-0.5 text-left text-[9px] text-text-secondary hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-[10px]"
                          title={`${item.source === "google" ? "Google" : "업무"} · ${item.label}`}
                        >
                          <SourceMark source={item.source} compact />
                          <span className="truncate">{item.time ? `${item.time} ` : ""}{item.label}</span>
                        </button>
                      ))}
                      {dayItems.length > 3 && <p className="pl-1 text-[9px] font-medium text-text-tertiary">+{dayItems.length - 3}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <aside aria-labelledby="selected-day-title" className="rounded-[22px] border border-border bg-surface p-5 shadow-sm xl:sticky xl:top-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-2xs font-semibold tracking-[0.16em] text-accent">선택한 날</p>
                <h2 id="selected-day-title" className="mt-1 break-keep text-xl font-semibold tracking-tight text-text">{dateLabel(selectedDate)}</h2>
              </div>
              <span className="rounded-full bg-surface-2 px-2.5 py-1 text-[10px] font-semibold tabular-nums text-text-secondary">{selectedItems.length}개</span>
            </div>
            <div className="mt-4 space-y-2">
              {selectedItems.length === 0 ? (
                <p className="rounded-xl bg-surface-2/60 px-4 py-7 text-center text-xs leading-relaxed text-text-tertiary">등록된 일정이 없습니다.</p>
              ) : selectedItems.map((item) => {
                const meta = item.source === "workspace" ? KIND_META[item.kind] : null;
                const Icon = item.source === "google"
                  ? CalendarDays
                  : item.kind === "deadline"
                    ? Flag
                    : item.kind === "schedule"
                      ? Clock3
                      : CalendarDays;
                const content = (
                  <>
                    <span className={cn("grid size-9 shrink-0 place-items-center rounded-[11px] bg-surface-2", meta?.text ?? "text-[#2f6fce] dark:text-[#8ab4f8]")}><Icon className="size-4" aria-hidden /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-text">{item.label}</span>
                      <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-text-tertiary">
                        <SourceMark source={item.source} />
                        <span>{itemTime(item)}</span>
                        {meta && <span>· {meta.label}</span>}
                      </span>
                    </span>
                  </>
                );
                return item.source === "workspace" ? (
                  <button key={item.id} type="button" onClick={() => controller.select(item.task)} className="group flex w-full items-start gap-3 rounded-xl border border-separator px-3 py-3 text-left hover:border-border-strong hover:bg-surface-2/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    {content}
                  </button>
                ) : (
                  <div key={item.id} className="flex w-full items-start gap-3 rounded-xl border border-separator px-3 py-3">
                    {content}
                  </div>
                );
              })}
            </div>
            {googleStatus === "ready" && (
              <p className="mt-4 border-t border-separator pt-4 text-[10px] leading-relaxed text-text-tertiary">
                Google 일정은 공개 캘린더에서 2분마다 자동 동기화됩니다.
              </p>
            )}
          </aside>
        </div>
      </div>

      <TaskDetailPanel
        task={controller.selected}
        projects={projects}
        workstreams={workstreams}
        members={members}
        open={controller.panelOpen}
        saveState={controller.selected ? store.stateOf(controller.selected.id) : "idle"}
        error={controller.selected ? store.errorFor(controller.selected.id).error : null}
        conflict={controller.selected ? store.errorFor(controller.selected.id).conflict : false}
        onOpenChange={(open) => {
          controller.setPanelOpen(open);
          if (!open) store.dismissError();
        }}
        onPatch={controller.patch}
        onToggleComplete={controller.toggleComplete}
        onCancelTask={controller.cancel}
        onRestoreTask={controller.restore}
      />
    </>
  );
}
