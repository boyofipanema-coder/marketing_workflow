"use client";

import { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Clock3,
  FolderPlus,
  Network,
  Plus,
} from "lucide-react";
import { Button, StatusBadge } from "@/components/ui";
import { isOverdue, todayKST } from "@/lib/derive";
import {
  FLOW_COLUMNS,
  flowColumn,
  isActiveWork,
  memberWorkload,
} from "@/lib/workload";
import type { Brand, Member, Project, Task } from "@/server/db/schema";

export type BoardFocus = "all" | "today" | "waiting" | "overdue";
type BoardView = "workflow" | "flow";
type Scope = "active" | "done";

interface StackedWorkflowBoardProps {
  tasks: Task[];
  brands: Brand[];
  projects: Project[];
  members: Record<string, Member>;
  focus: BoardFocus;
  onFocusChange: (focus: BoardFocus) => void;
  onSelect: (task: Task) => void;
  onAddProject: (brandId?: string) => void;
  onAddProjectTask: (projectId: string) => void;
  onAddSubtask: (parent: Task) => void;
  onEditProject: (project: Project) => void;
}

function taskMatchesFocus(task: Task, focus: BoardFocus, now: Date) {
  if (focus === "today") return task.due_date === todayKST(now);
  if (focus === "waiting") return task.status === "Waiting";
  if (focus === "overdue") return isOverdue(task, now);
  return true;
}

function CompactTask({
  task,
  childrenByParent,
  members,
  onSelect,
  onAddSubtask,
  depth = 0,
}: {
  task: Task;
  childrenByParent: Map<string, Task[]>;
  members: Record<string, Member>;
  onSelect: (task: Task) => void;
  onAddSubtask: (parent: Task) => void;
  depth?: number;
}) {
  const children = childrenByParent.get(task.id) ?? [];
  const [expanded, setExpanded] = useState(true);
  const owner = task.assignee_id ? members[task.assignee_id] : null;

  return (
    <div className={depth ? "border-l border-border pl-3" : ""}>
      <div className="group flex min-h-11 items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 shadow-xs transition-colors hover:border-border-strong">
        {children.length ? (
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            aria-label={expanded ? "하위업무 접기" : "하위업무 펼치기"}
            className="grid size-6 shrink-0 place-items-center rounded-md text-text-tertiary hover:bg-surface-2"
          >
            {expanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
          </button>
        ) : (
          <span className="size-6 shrink-0" />
        )}
        <button
          type="button"
          onClick={() => onSelect(task)}
          title={task.description ?? task.title}
          className="min-w-0 flex-1 truncate text-left text-[13px] font-semibold text-text"
        >
          {task.title}
        </button>
        <StatusBadge status={task.status} variant="dot" className="shrink-0 text-[11px]" />
        <span className="max-w-20 shrink-0 truncate text-[11px] text-text-tertiary">
          {owner?.name ?? "미지정"}
        </span>
        {task.due_date && (
          <span className="hidden shrink-0 text-[11px] tabular-nums text-text-tertiary sm:inline">
            {task.due_date.slice(5)}
          </span>
        )}
        <button
          type="button"
          onClick={() => onAddSubtask(task)}
          aria-label={`${task.title}에 하위업무 추가`}
          className="grid size-7 shrink-0 place-items-center rounded-lg text-text-tertiary opacity-0 hover:bg-surface-2 hover:text-text group-hover:opacity-100 focus-visible:opacity-100"
        >
          <Plus className="size-3.5" />
        </button>
      </div>
      {expanded && children.length > 0 && (
        <div className="mt-1.5 space-y-1.5 pl-4">
          {children.map((child) => (
            <CompactTask
              key={child.id}
              task={child}
              childrenByParent={childrenByParent}
              members={members}
              onSelect={onSelect}
              onAddSubtask={onAddSubtask}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function StackedWorkflowBoard({
  tasks,
  brands,
  projects,
  members,
  focus,
  onFocusChange,
  onSelect,
  onAddProject,
  onAddProjectTask,
  onAddSubtask,
  onEditProject,
}: StackedWorkflowBoardProps) {
  const [view, setView] = useState<BoardView>("workflow");
  const [scope, setScope] = useState<Scope>("active");
  const now = useMemo(() => new Date(), []);
  const scopedTasks = useMemo(
    () =>
      tasks.filter((task) => {
        if (task.cancelled_at || task.kind === "milestone") return false;
        if (scope === "done") return task.status === "Done";
        return isActiveWork(task) && taskMatchesFocus(task, focus, now);
      }),
    [focus, now, scope, tasks],
  );
  const taskIds = useMemo(() => new Set(scopedTasks.map((task) => task.id)), [scopedTasks]);
  const childrenByParent = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const task of scopedTasks) {
      if (!task.parent_task_id || !taskIds.has(task.parent_task_id)) continue;
      map.set(task.parent_task_id, [...(map.get(task.parent_task_id) ?? []), task]);
    }
    return map;
  }, [scopedTasks, taskIds]);

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface-2/35 shadow-xs">
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface px-3 py-2.5 sm:px-4">
        <div className="flex rounded-xl bg-surface-2 p-1">
          <button
            type="button"
            onClick={() => setView("workflow")}
            className={`h-8 rounded-lg px-3 text-xs font-semibold ${view === "workflow" ? "bg-surface text-text shadow-xs" : "text-text-secondary"}`}
          >
            워크플로우
          </button>
          <button
            type="button"
            onClick={() => setView("flow")}
            className={`h-8 rounded-lg px-3 text-xs font-semibold ${view === "flow" ? "bg-surface text-text shadow-xs" : "text-text-secondary"}`}
          >
            진행 흐름
          </button>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {([
            ["all", "전체"],
            ["today", "지금 할 일"],
            ["waiting", "대기"],
            ["overdue", "기한 초과"],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setScope("active");
                onFocusChange(id);
              }}
              className={`h-8 rounded-full px-3 text-[11px] font-semibold ${scope === "active" && focus === id ? "bg-text text-bg" : "border border-border bg-surface text-text-secondary hover:border-border-strong"}`}
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setScope(scope === "done" ? "active" : "done")}
            className={`h-8 rounded-full px-3 text-[11px] font-semibold ${scope === "done" ? "bg-status-done text-white" : "border border-border bg-surface text-text-secondary"}`}
          >
            완료 업무
          </button>
        </div>
      </div>

      {view === "flow" ? (
        <div className="overflow-x-auto p-3 sm:p-4">
          <div className="min-w-[820px] space-y-3">
            <div className="grid grid-cols-[9rem_repeat(4,minmax(9rem,1fr))] gap-2 px-2 text-[11px] font-semibold text-text-tertiary">
              <span>담당자 · 현재 업무량</span>
              {FLOW_COLUMNS.map((column) => <span key={column.id}>{column.label}</span>)}
            </div>
            {Object.values(members).map((member) => {
              const workload = memberWorkload(tasks, member.id, now);
              return (
                <div key={member.id} className="grid grid-cols-[9rem_repeat(4,minmax(9rem,1fr))] gap-2 rounded-xl border border-border bg-surface p-2">
                  <div className="px-2 py-1">
                    <p className="truncate text-xs font-semibold text-text">{member.name}</p>
                    <p className="mt-1 text-[10px] tabular-nums text-text-tertiary">
                      활성 {workload.activeCount} · 이번 주 {workload.dueThisWeekCount}
                    </p>
                  </div>
                  {FLOW_COLUMNS.map((column) => (
                    <div key={column.id} className="min-h-14 rounded-lg bg-surface-2/70 p-1.5">
                      {workload.active
                        .filter((task) => flowColumn(task) === column.id)
                        .map((task) => (
                          <button
                            key={task.id}
                            type="button"
                            onClick={() => onSelect(task)}
                            className="mb-1 w-full truncate rounded-md bg-surface px-2 py-1.5 text-left text-[11px] font-medium text-text shadow-xs hover:text-accent"
                          >
                            {task.title}
                          </button>
                        ))}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="space-y-3 p-3 sm:p-4">
          {brands.map((brand) => {
            const brandProjects = projects.filter((project) => project.brand_id === brand.id);
            if (!brandProjects.length && !scopedTasks.some((task) => !task.project_id)) return null;
            return (
              <section key={brand.id} className="rounded-2xl border border-border bg-surface p-3">
                <header className="mb-3 flex items-center gap-2">
                  <span className="size-2.5 rounded-full" style={{ backgroundColor: brand.color }} />
                  <h2 className="text-sm font-semibold text-text">{brand.name}</h2>
                  <span className="text-[10px] tabular-nums text-text-tertiary">{brandProjects.length}개 프로젝트</span>
                  <Button variant="ghost" size="icon-sm" className="ml-auto" onClick={() => onAddProject(brand.id)} aria-label={`${brand.name}에 프로젝트 추가`}>
                    <FolderPlus />
                  </Button>
                </header>
                <div className="grid gap-3 lg:grid-cols-2">
                  {brandProjects.map((project) => {
                    const projectTasks = scopedTasks.filter((task) => task.project_id === project.id);
                    const roots = projectTasks.filter(
                      (task) => !task.parent_task_id || !taskIds.has(task.parent_task_id),
                    );
                    if (!roots.length && scope === "done") return null;
                    return (
                      <article key={project.id} className="rounded-xl border border-border bg-surface-2/45 p-2.5">
                        <div className="mb-2 flex items-center gap-2 px-1">
                          <button type="button" onClick={() => onEditProject(project)} className="min-w-0 truncate text-left text-xs font-semibold text-text hover:text-accent">
                            {project.name}
                          </button>
                          <span className="ml-auto text-[10px] tabular-nums text-text-tertiary">{projectTasks.length}개 업무</span>
                          <Button variant="ghost" size="icon-sm" onClick={() => onAddProjectTask(project.id)} aria-label={`${project.name}에 업무 추가`}>
                            <Plus />
                          </Button>
                        </div>
                        <div className="space-y-1.5">
                          {roots.map((task) => (
                            <CompactTask
                              key={task.id}
                              task={task}
                              childrenByParent={childrenByParent}
                              members={members}
                              onSelect={onSelect}
                              onAddSubtask={onAddSubtask}
                            />
                          ))}
                          {!roots.length && (
                            <button type="button" onClick={() => onAddProjectTask(project.id)} className="flex h-10 w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border text-[11px] font-medium text-text-tertiary hover:border-border-strong hover:text-text-secondary">
                              <Plus className="size-3.5" /> 업무 추가
                            </button>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            );
          })}
          {scopedTasks.length === 0 && (
            <div className="grid min-h-36 place-items-center rounded-xl border border-dashed border-border bg-surface text-center">
              <div>
                {focus === "overdue" ? <CircleAlert className="mx-auto mb-2 size-5 text-text-tertiary" /> : focus === "waiting" ? <Clock3 className="mx-auto mb-2 size-5 text-text-tertiary" /> : <Network className="mx-auto mb-2 size-5 text-text-tertiary" />}
                <p className="text-xs font-semibold text-text-secondary">
                  {scope === "done" ? "완료된 업무가 없습니다" : "조건에 맞는 업무가 없습니다"}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
