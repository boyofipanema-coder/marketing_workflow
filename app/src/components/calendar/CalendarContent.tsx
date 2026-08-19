"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
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
const CLIENT_CACHE_KEY = "mtw:google-calendar:v2";
const CLIENT_CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

type GoogleStatus = "loading" | "ready" | "stale" | "error";

interface CachedGoogleCalendar {
  savedAt: number;
  events: GoogleCalendarEvent[];
}

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

const KIND_META: Record<CalendarKind, { label: string }> = {
  schedule: { label: "일정" },
  deadline: { label: "마감" },
  followup: { label: "팔로업" },
  milestone: { label: "마일스톤" },
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

function readCalendarCache(): CachedGoogleCalendar | null {
  try {
    const value = localStorage.getItem(CLIENT_CACHE_KEY);
    if (!value) return null;
    const cached = JSON.parse(value) as CachedGoogleCalendar;
    if (
      !Number.isFinite(cached.savedAt) ||
      Date.now() - cached.savedAt > CLIENT_CACHE_MAX_AGE_MS ||
      !Array.isArray(cached.events)
    ) {
      localStorage.removeItem(CLIENT_CACHE_KEY);
      return null;
    }
    return cached;
  } catch {
    return null;
  }
}

function writeCalendarCache(events: GoogleCalendarEvent[], savedAt: number) {
  try {
    localStorage.setItem(CLIENT_CACHE_KEY, JSON.stringify({ events, savedAt }));
  } catch {
    // The calendar remains usable when browser storage is unavailable.
  }
}

function calendarItemTone(item: CalendarItem): string {
  if (item.source === "google") {
    return "border-[#4285f4]/35 bg-[#4285f4]/8 text-[#245ea9] dark:text-[#9bc0ff]";
  }
  if (item.kind === "deadline") {
    return "border-flag-overdue/40 bg-flag-overdue/8 text-flag-overdue";
  }
  if (item.kind === "followup") {
    return "border-status-waiting/40 bg-status-waiting/8 text-status-waiting";
  }
  return "border-accent/35 bg-accent/8 text-accent";
}

function syncLabel(status: GoogleStatus, savedAt: number | null): string {
  if (status === "loading") return "Google 일정 불러오는 중";
  if (status === "stale") return "저장된 일정 표시 중";
  if (status === "error") return "Google 일정 연결 지연";
  if (!savedAt) return "Google 일정 동기화됨";
  const minutes = Math.floor((Date.now() - savedAt) / 60_000);
  return minutes < 1 ? "방금 동기화됨" : `${minutes}분 전 동기화`;
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
  const googleEventsRef = useRef<GoogleCalendarEvent[]>([]);
  const [googleStatus, setGoogleStatus] = useState<GoogleStatus>("loading");
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [refreshPending, setRefreshPending] = useState(false);
  const requestRef = useRef<AbortController | null>(null);
  const lastRefresh = useRef(Date.now());
  const [month, setMonth] = useState(today.slice(0, 7));
  const [selectedDate, setSelectedDate] = useState(today);
  const [showWorkspace, setShowWorkspace] = useState(true);
  const [showGoogle, setShowGoogle] = useState(true);
  const days = useMemo(() => monthGrid(month), [month]);
  const workspaceCalendarItems = useMemo(
    () => workspaceItems(controller.tasks),
    [controller.tasks],
  );
  const googleCalendarItems = useMemo(() => googleItems(googleEvents), [googleEvents]);
  const items = useMemo(
    () => [
      ...(showWorkspace ? workspaceCalendarItems : []),
      ...(showGoogle ? googleCalendarItems : []),
    ],
    [googleCalendarItems, showGoogle, showWorkspace, workspaceCalendarItems],
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
  const monthWorkspaceCount = workspaceCalendarItems.filter((item) => item.date.startsWith(month)).length;
  const monthGoogleCount = googleCalendarItems.filter((item) => item.date.startsWith(month)).length;
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
      const events = parseGoogleCalendarIcs(
        ics,
        `${year - 1}-01-01`,
        `${year + 2}-12-31`,
      );
      const savedAt = Date.now();
      googleEventsRef.current = events;
      setGoogleEvents(events);
      setLastSyncedAt(savedAt);
      writeCalendarCache(events, savedAt);
      setGoogleStatus("ready");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setGoogleStatus(googleEventsRef.current.length ? "stale" : "error");
    } finally {
      if (requestRef.current === request) {
        requestRef.current = null;
        setRefreshPending(false);
      }
    }
  }, [today]);

  useEffect(() => {
    const cached = readCalendarCache();
    if (cached) {
      googleEventsRef.current = cached.events;
      setGoogleEvents(cached.events);
      setLastSyncedAt(cached.savedAt);
      setGoogleStatus("ready");
    }
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
      <div className="mx-auto max-w-[1440px] px-3 py-5 sm:px-6 sm:py-7">
        <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight text-text">캘린더</h1>
              <span
                role="status"
                aria-live="polite"
                className={cn(
                  "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[10px] font-medium",
                  googleStatus === "error"
                    ? "border-flag-overdue/25 bg-flag-overdue/8 text-flag-overdue"
                    : googleStatus === "stale"
                      ? "border-status-waiting/25 bg-status-waiting/8 text-status-waiting"
                      : "border-border bg-surface text-text-tertiary",
                )}
              >
                <span className={cn("size-1.5 rounded-full", googleStatus === "error" ? "bg-flag-overdue" : googleStatus === "stale" ? "bg-status-waiting" : "bg-[#4285f4]", (googleStatus === "loading" || refreshPending) && "animate-pulse")} />
                {syncLabel(googleStatus, lastSyncedAt)}
              </span>
            </div>
            <p className="mt-1 text-xs text-text-tertiary">업무와 외부 일정을 한 화면에서 확인합니다.</p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={refreshCalendar}
              disabled={refreshPending}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-surface px-3 text-xs font-semibold text-text-secondary shadow-xs hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-55"
              aria-label="일정 새로고침"
              title="일정 새로고침"
            >
              <RefreshCw className={cn("size-4", refreshPending && "animate-spin")} aria-hidden />
              <span className="hidden sm:inline">새로고침</span>
            </button>
            <a
              href={TEAM_CALENDAR_LINK}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-surface px-3 text-xs font-semibold text-text-secondary shadow-xs hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Google Calendar에서 열기"
              title="Google Calendar에서 열기"
            >
              <ExternalLink className="size-4" aria-hidden />
              <span className="hidden sm:inline">Google에서 열기</span>
            </a>
            <button
              type="button"
              onClick={() => {
                setMonth(today.slice(0, 7));
                setSelectedDate(today);
              }}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-text px-3 text-xs font-semibold text-bg shadow-xs transition-[transform,opacity] hover:opacity-90 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <LocateFixed className="size-4" aria-hidden />오늘
            </button>
          </div>
        </header>

        {store.error && (
          <p role="alert" className="mb-4 rounded-xl border border-flag-blocked/30 bg-flag-blocked/10 px-4 py-3 text-xs text-flag-blocked">
            {store.error}
          </p>
        )}
        {(googleStatus === "error" || googleStatus === "stale") && (
          <p role="status" className="mb-4 rounded-xl border border-status-waiting/25 bg-status-waiting/8 px-4 py-3 text-xs text-text-secondary">
            {googleStatus === "stale"
              ? "Google 연결이 늦어 저장된 일정을 먼저 보여주고 있습니다. 업무 일정은 최신 상태입니다."
              : "Google 일정을 불러오지 못했습니다. 업무 일정은 계속 사용할 수 있습니다."}
          </p>
        )}

        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_21rem]">
          <section aria-label="통합 달력" className="overflow-hidden rounded-[20px] border border-border bg-surface shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-separator px-3 py-3 sm:px-4">
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => setMonth((value) => moveMonth(value, -1))} aria-label="이전 달" className="grid size-9 place-items-center rounded-lg text-text-secondary hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><ChevronLeft className="size-4" aria-hidden /></button>
                <h2 className="min-w-32 text-center text-base font-semibold tracking-tight text-text sm:text-lg">{monthTitle}</h2>
                <button type="button" onClick={() => setMonth((value) => moveMonth(value, 1))} aria-label="다음 달" className="grid size-9 place-items-center rounded-lg text-text-secondary hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><ChevronRight className="size-4" aria-hidden /></button>
              </div>
              <div className="flex items-center gap-1.5" aria-label="일정 출처 필터">
                <button
                  type="button"
                  aria-pressed={showWorkspace}
                  onClick={() => setShowWorkspace((value) => !value)}
                  className={cn(
                    "inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    showWorkspace ? "border-accent/25 bg-accent/8 text-accent" : "border-border bg-surface text-text-tertiary",
                  )}
                >
                  {showWorkspace ? <Check className="size-3" aria-hidden /> : <span className="size-2 rounded-full border border-current" />}
                  업무 <span className="tabular-nums opacity-70">{monthWorkspaceCount}</span>
                </button>
                <button
                  type="button"
                  aria-pressed={showGoogle}
                  onClick={() => setShowGoogle((value) => !value)}
                  className={cn(
                    "inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    showGoogle ? "border-[#4285f4]/25 bg-[#4285f4]/8 text-[#2f6fce] dark:text-[#9bc0ff]" : "border-border bg-surface text-text-tertiary",
                  )}
                >
                  {showGoogle ? <Check className="size-3" aria-hidden /> : <span className="size-2 rounded-full border border-current" />}
                  Google <span className="tabular-nums opacity-70">{googleStatus === "loading" ? "…" : monthGoogleCount}</span>
                </button>
              </div>
            </div>
            <div className="grid grid-cols-7 border-b border-separator bg-surface-2/55">
              {["월", "화", "수", "목", "금", "토", "일"].map((weekday, index) => (
                <div key={weekday} className={cn("py-2 text-center text-[10px] font-semibold", index >= 5 ? "text-text-secondary" : "text-text-tertiary")}>{weekday}</div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {days.map((date, dayIndex) => {
                const dayItems = itemsByDate.get(date) ?? [];
                const inMonth = date.startsWith(month);
                const selected = date === selectedDate;
                const isToday = date === today;
                const isWeekend = dayIndex % 7 >= 5;
                return (
                  <div
                    key={date}
                    className={cn(
                      "min-h-[4.5rem] border-b border-r border-separator p-1 sm:min-h-28 sm:p-1.5 lg:min-h-32 lg:p-2",
                      !inMonth && "bg-surface-2/35",
                      inMonth && isWeekend && "bg-surface-2/20",
                      selected && "bg-accent/[0.055] ring-1 ring-inset ring-accent/20",
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
                    <div className="flex min-h-5 items-center gap-1 px-0.5 sm:hidden" aria-hidden>
                      {dayItems.slice(0, 3).map((item) => (
                        <span
                          key={item.id}
                          className={cn(
                            "size-1.5 rounded-full",
                            item.source === "google"
                              ? "bg-[#4285f4]"
                              : item.kind === "deadline"
                                ? "bg-flag-overdue"
                                : "bg-accent",
                          )}
                        />
                      ))}
                      {dayItems.length > 3 && <span className="text-[8px] font-semibold text-text-tertiary">+{dayItems.length - 3}</span>}
                    </div>
                    <div className="hidden space-y-1 sm:block">
                      {dayItems.slice(0, 3).map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => openItem(item)}
                          className={cn(
                            "flex w-full items-center gap-1.5 truncate rounded-md border-l-2 px-1.5 py-1 text-left text-[10px] font-medium leading-tight hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:text-[11px]",
                            calendarItemTone(item),
                          )}
                          title={`${item.source === "google" ? "Google" : "업무"} · ${item.label}`}
                        >
                          {item.time && <span className="shrink-0 font-mono text-[9px] opacity-70">{item.time}</span>}
                          <span className="truncate">{item.label}</span>
                        </button>
                      ))}
                      {dayItems.length > 3 && (
                        <button type="button" onClick={() => setSelectedDate(date)} className="w-full rounded px-1.5 py-0.5 text-left text-[9px] font-semibold text-text-tertiary hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                          +{dayItems.length - 3}개 더 보기
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <aside aria-labelledby="selected-day-title" className="rounded-[20px] border border-border bg-surface p-4 shadow-sm sm:p-5 xl:sticky xl:top-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold tracking-[0.14em] text-accent">{selectedDate === today ? "오늘의 일정" : "선택한 날"}</p>
                <h2 id="selected-day-title" className="mt-1 break-keep text-xl font-semibold tracking-tight text-text">{dateLabel(selectedDate)}</h2>
              </div>
              <span className="rounded-full bg-surface-2 px-2.5 py-1 text-[10px] font-semibold tabular-nums text-text-secondary">일정 {selectedItems.length}</span>
            </div>
            <div className="mt-4 space-y-1.5">
              {selectedItems.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border bg-surface-2/35 px-4 py-8 text-center">
                  <CalendarDays className="mx-auto size-5 text-text-quaternary" aria-hidden />
                  <p className="mt-2 text-xs font-medium text-text-tertiary">등록된 일정이 없습니다.</p>
                  <p className="mt-1 text-[10px] text-text-quaternary">다른 날짜를 선택하거나 Google에서 일정을 추가하세요.</p>
                </div>
              ) : selectedItems.map((item) => {
                const meta = item.source === "workspace" ? KIND_META[item.kind] : null;
                const content = (
                  <>
                    <span className="w-12 shrink-0 pt-0.5 text-right font-mono text-[10px] font-semibold tabular-nums text-text-tertiary">{itemTime(item)}</span>
                    <span className={cn("mt-1 h-9 w-0.5 shrink-0 rounded-full", item.source === "google" ? "bg-[#4285f4]" : item.kind === "deadline" ? "bg-flag-overdue" : item.kind === "followup" ? "bg-status-waiting" : "bg-accent")} aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block break-keep text-sm font-semibold leading-snug text-text">{item.label}</span>
                      <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-text-tertiary">
                        <SourceMark source={item.source} />
                        {meta && <span>{meta.label}</span>}
                      </span>
                    </span>
                  </>
                );
                return item.source === "workspace" ? (
                  <button key={item.id} type="button" onClick={() => controller.select(item.task)} className="group flex w-full items-start gap-3 rounded-xl px-2 py-3 text-left hover:bg-surface-2/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    {content}
                  </button>
                ) : (
                  <div key={item.id} className="flex w-full items-start gap-3 rounded-xl px-2 py-3">
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
