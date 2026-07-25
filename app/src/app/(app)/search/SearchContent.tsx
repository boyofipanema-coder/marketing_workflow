"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search as SearchIcon, X } from "lucide-react";
import { Button, Input } from "@/components/ui";
import EmptyState from "@/components/EmptyState";
import TaskList from "@/components/tasks/TaskList";
import TaskDetailPanel from "@/components/tasks/TaskDetailPanel";
import { useTaskController } from "@/components/tasks/useTaskController";
import {
  searchWorkspaceTasks,
  hasActiveFilters,
  type DueFilter,
  type WorkspaceSearchOptions,
} from "@/lib/search";
import { TASK_STATUSES, STATUS_META } from "@/lib/status";
import { todayKST, currentISOWeekKST } from "@/lib/derive";
import type { Task, Project, Workstream, Member } from "@/server/db/schema";

export interface SearchContentProps {
  tasks: Task[];
  projects: Project[];
  workstreams: Workstream[];
  members: Member[];
}

type DueKey = "" | "today" | "week" | "overdue" | "undated";

const DUE_OPTIONS: { key: DueKey; label: string }[] = [
  { key: "", label: "전체" },
  { key: "today", label: "오늘" },
  { key: "week", label: "이번 주" },
  { key: "overdue", label: "기한 초과" },
  { key: "undated", label: "날짜 없음" },
];

const selectClass =
  "h-9 rounded-lg border border-border bg-surface px-2.5 text-sm text-text focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30";

/** Turns the Due chip selection into the filter shape searchWorkspaceTasks wants. */
function dueFilterFor(key: DueKey, now: Date): DueFilter | undefined {
  const today = todayKST(now);
  switch (key) {
    case "today":
      return { type: "exact", date: today };
    case "week": {
      const { weekStart, weekEnd } = currentISOWeekKST(now);
      return { type: "range", start: weekStart, end: weekEnd };
    }
    case "overdue":
      // Everything strictly before today; 1970 is safely below any real date.
      return { type: "range", start: "1970-01-01", end: shiftBack(today) };
    case "undated":
      return { type: "undated" };
    default:
      return undefined;
  }
}

function shiftBack(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  dt.setUTCDate(dt.getUTCDate() - 1);
  return dt.toISOString().slice(0, 10);
}

export default function SearchContent({
  tasks,
  projects,
  workstreams,
  members,
}: SearchContentProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const controller = useTaskController(tasks);
  const { store } = controller;

  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [projectId, setProjectId] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [status, setStatus] = useState("");
  const [due, setDue] = useState<DueKey>("");

  // Keep the field in step with the URL when the nav bar navigates here.
  const urlQuery = searchParams.get("q") ?? "";
  useEffect(() => {
    setQuery(urlQuery);
  }, [urlQuery]);

  const membersRecord = useMemo(
    () => Object.fromEntries(members.map((m) => [m.id, m])),
    [members]
  );

  const options: WorkspaceSearchOptions = useMemo(
    () => ({
      query,
      projectId: projectId || undefined,
      assigneeId: assigneeId || undefined,
      status: (status || undefined) as Task["status"] | undefined,
      due: dueFilterFor(due, new Date()),
    }),
    [query, projectId, assigneeId, status, due]
  );

  const results = useMemo(
    () => searchWorkspaceTasks(controller.tasks, { projects, members }, options),
    [controller.tasks, projects, members, options]
  );

  const active = hasActiveFilters(options);

  function reset() {
    setQuery("");
    setProjectId("");
    setAssigneeId("");
    setStatus("");
    setDue("");
    router.replace("/search");
  }

  return (
    <>
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
        <header className="mb-5">
          <h1 className="font-serif text-2xl font-semibold leading-tight text-text">
            검색
          </h1>
        </header>

        <div className="relative mb-4">
          <SearchIcon
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary"
            aria-hidden
          />
          <Input
            value={query}
            autoFocus
            onChange={(e) => setQuery(e.target.value)}
            placeholder="업무명, 프로젝트, 담당자로 검색"
            aria-label="업무 검색"
            className="h-11 pl-9"
          />
        </div>

        {/* Filters */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            aria-label="프로젝트 필터"
            className={selectClass}
          >
            <option value="">모든 프로젝트</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          <select
            value={assigneeId}
            onChange={(e) => setAssigneeId(e.target.value)}
            aria-label="담당자 필터"
            className={selectClass}
          >
            <option value="">모든 담당자</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            aria-label="상태 필터"
            className={selectClass}
          >
            <option value="">모든 상태</option>
            {TASK_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_META[s].label}
              </option>
            ))}
          </select>
        </div>

        <div
          className="mb-5 flex flex-wrap items-center gap-1.5"
          role="group"
          aria-label="마감일 필터"
        >
          {DUE_OPTIONS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setDue(key)}
              aria-pressed={due === key}
              className={`inline-flex h-8 items-center rounded-full border px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                due === key
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-border bg-surface text-text-secondary hover:border-border-strong hover:text-text"
              }`}
            >
              {label}
            </button>
          ))}

          {active && (
            <Button variant="ghost" size="sm" onClick={reset} className="ml-1">
              <X className="h-3.5 w-3.5" aria-hidden />
              필터 초기화
            </Button>
          )}
        </div>

        {store.error && (
          <p
            role="alert"
            className="mb-4 rounded-lg border border-flag-blocked/30 bg-flag-blocked/10 px-3 py-2 text-xs text-flag-blocked"
          >
            {store.error}
          </p>
        )}

        {!active ? (
          <EmptyState
            icon={<SearchIcon className="h-5 w-5" aria-hidden />}
            title="검색어나 필터를 선택해 주세요"
            description="업무명, 프로젝트 이름, 담당자 이름으로 찾을 수 있습니다."
          />
        ) : results.length === 0 ? (
          <EmptyState
            icon={<SearchIcon className="h-5 w-5" aria-hidden />}
            title="검색 결과가 없습니다"
            description="다른 검색어를 쓰거나 필터를 줄여 보세요."
            action={
              <Button variant="secondary" size="sm" onClick={reset}>
                필터 초기화
              </Button>
            }
          />
        ) : (
          <>
            <p className="mb-2 text-xs text-text-tertiary">
              결과 {results.length}건
            </p>
            {/* Search results have no manual order — omitting onReorder hides
                the drag handles. */}
            <TaskList
              tasks={results}
              members={membersRecord}
              store={store}
              selectedId={controller.selectedId}
              onSelect={controller.select}
              onToggleComplete={controller.toggleComplete}
              onCancel={controller.cancel}
              onRestore={controller.restore}
            onToggleKey={controller.toggleKey}
            />
          </>
        )}
      </div>

      <TaskDetailPanel
        task={controller.selected}
        projects={projects}
        workstreams={workstreams}
        members={members}
        open={controller.panelOpen}
        saveState={
          controller.selected ? store.stateOf(controller.selected.id) : "idle"
        }
        error={store.error}
        conflict={store.conflict}
        onOpenChange={(open) => {
          controller.setPanelOpen(open);
          if (!open) store.dismissError();
        }}
        onPatch={controller.patch}
        onCancelTask={controller.cancel}
        onRestoreTask={controller.restore}
      />
    </>
  );
}
