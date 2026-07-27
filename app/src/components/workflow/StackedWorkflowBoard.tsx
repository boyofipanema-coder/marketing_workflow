"use client";

import { useMemo, useState } from "react";
import {
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

function descendantsOf(
  taskId: string,
  childrenByParent: Map<string, Task[]>,
  depth = 0,
): Array<{ task: Task; depth: number }> {
  return (childrenByParent.get(taskId) ?? []).flatMap((task) => [
    { task, depth },
    ...descendantsOf(task.id, childrenByParent, depth + 1),
  ]);
}

function FlowTask({
  task,
  childrenByParent,
  members,
  onSelect,
  onAddSubtask,
  brandColor,
}: {
  task: Task;
  childrenByParent: Map<string, Task[]>;
  members: Record<string, Member>;
  onSelect: (task: Task) => void;
  onAddSubtask: (parent: Task) => void;
  brandColor: string;
}) {
  const descendants = descendantsOf(task.id, childrenByParent);
  const owner = task.assignee_id ? members[task.assignee_id] : null;

  return (
    <div className="relative grid grid-cols-[minmax(17rem,1fr)_minmax(15rem,.85fr)] items-start gap-5">
      <div
        aria-hidden
        className="pointer-events-none absolute left-0 right-0 top-6 h-px"
        style={{
          background: `color-mix(in srgb, ${brandColor} 42%, rgb(var(--border)))`,
        }}
      />
      <div
        className="group relative z-10 flex min-h-12 items-center gap-2 rounded-xl border bg-surface px-3 py-2 shadow-xs transition-[border-color,box-shadow,transform] duration-300 ease-out hover:-translate-y-px hover:shadow-sm"
        style={{
          borderColor: `color-mix(in srgb, ${brandColor} 28%, rgb(var(--border)))`,
        }}
      >
        <span
          className="h-7 w-1 shrink-0 rounded-full"
          style={{ backgroundColor: brandColor }}
          aria-hidden
        />
        <button
          type="button"
          onClick={() => onSelect(task)}
          title={task.description ?? task.title}
          className="min-w-0 flex-1 truncate text-left text-[13px] font-semibold text-text"
        >
          {task.title}
        </button>
        <span className="flex shrink-0 items-center gap-2 text-[10px] text-text-tertiary">
          <StatusBadge status={task.status} variant="pip" />
          <span className="max-w-16 truncate">{owner?.name ?? "미지정"}</span>
          {task.due_date && <span className="tabular-nums">{task.due_date.slice(5)}</span>}
        </span>
        <button
          type="button"
          onClick={() => onAddSubtask(task)}
          aria-label={`${task.title}에 하위업무 추가`}
          className="grid size-7 shrink-0 place-items-center rounded-lg text-text-tertiary opacity-0 hover:bg-surface-2 hover:text-text group-hover:opacity-100 focus-visible:opacity-100"
        >
          <Plus className="size-3.5" />
        </button>
      </div>
      <div
        className="relative z-10 min-h-12 space-y-1.5 rounded-xl border px-2 py-2"
        style={{
          borderColor: `color-mix(in srgb, ${brandColor} 20%, rgb(var(--border)))`,
          background: `color-mix(in srgb, ${brandColor} 4%, rgb(var(--surface)))`,
        }}
      >
        {descendants.map(({ task: child, depth }) => {
          const childOwner = child.assignee_id ? members[child.assignee_id] : null;
          return (
            <button
              key={child.id}
              type="button"
              onClick={() => onSelect(child)}
              title={child.description ?? `${child.title} · ${childOwner?.name ?? "담당자 미지정"}`}
              className="flex h-7 w-[calc(100%-var(--indent))] items-center gap-2 rounded-lg border border-border/80 bg-surface px-2 text-left shadow-xs transition-[border-color,transform] duration-300 ease-out hover:-translate-y-px hover:border-border-strong"
              style={{
                marginLeft: `${depth * 10}px`,
                ["--indent" as string]: `${depth * 10}px`,
              }}
            >
              <StatusBadge status={child.status} variant="pip" className="shrink-0" />
              <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-text">
                {child.title}
              </span>
              <span className="max-w-14 truncate text-[9px] text-text-tertiary">
                {childOwner?.name ?? "미지정"}
              </span>
            </button>
          );
        })}
        {!descendants.length && (
          <button
            type="button"
            onClick={() => onAddSubtask(task)}
            className="flex h-7 w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border bg-surface/70 text-[10px] font-medium text-text-tertiary hover:border-border-strong hover:text-text-secondary"
          >
            <Plus className="size-3" />
            하위업무 추가
          </button>
        )}
      </div>
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
  const projectById = useMemo(
    () => new Map(projects.map((project) => [project.id, project])),
    [projects],
  );
  const brandById = useMemo(
    () => new Map(brands.map((brand) => [brand.id, brand])),
    [brands],
  );

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
                        .map((task) => {
                          const project = task.project_id
                            ? projectById.get(task.project_id)
                            : null;
                          const brand = project?.brand_id
                            ? brandById.get(project.brand_id)
                            : null;
                          return (
                            <button
                              key={task.id}
                              type="button"
                              onClick={() => onSelect(task)}
                              title={[brand?.name, project?.name, task.title].filter(Boolean).join(" · ")}
                              className="mb-1 flex w-full items-center gap-1.5 truncate rounded-md border border-border bg-surface px-2 py-1.5 text-left text-[11px] font-medium text-text shadow-xs hover:text-accent"
                              style={{
                                borderLeftWidth: 3,
                                borderLeftColor: brand?.color ?? "rgb(var(--border))",
                              }}
                            >
                              <span className="min-w-0 flex-1 truncate">{task.title}</span>
                            </button>
                          );
                        })}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div
          className="overflow-x-auto p-3 sm:p-4"
          style={{
            backgroundImage:
              "radial-gradient(rgb(var(--text-quaternary)/0.18) 1px, transparent 1.2px)",
            backgroundSize: "22px 22px",
          }}
        >
          <div className="min-w-[1040px] space-y-3">
            {brands.map((brand) => {
              const brandProjects = projects.filter(
                (project) => project.brand_id === brand.id,
              );
              if (!brandProjects.length) return null;
              return (
                <section
                  key={brand.id}
                  className="relative grid grid-cols-[10rem_minmax(0,1fr)] overflow-hidden rounded-2xl border shadow-xs"
                  style={{
                    borderColor: `color-mix(in srgb, ${brand.color} 24%, rgb(var(--border)))`,
                    background: `color-mix(in srgb, ${brand.color} 5%, rgb(var(--surface)))`,
                  }}
                >
                  <div
                    aria-hidden
                    className="absolute inset-y-0 left-0 w-1.5"
                    style={{ backgroundColor: brand.color }}
                  />
                  <header className="flex min-h-24 flex-col justify-between border-r border-border/80 px-4 py-3 pl-5">
                    <div>
                      <span
                        className="mb-2 block h-1 w-7 rounded-full"
                        style={{ backgroundColor: brand.color }}
                        aria-hidden
                      />
                      <h2 className="break-keep text-sm font-semibold tracking-tight text-text">
                        {brand.name}
                      </h2>
                      <p className="mt-1 text-[10px] tabular-nums text-text-tertiary">
                        프로젝트 {brandProjects.length}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onAddProject(brand.id)}
                      className="mt-3 flex h-7 w-max items-center gap-1.5 rounded-lg px-2 text-[10px] font-semibold text-text-secondary hover:bg-surface hover:text-text"
                    >
                      <FolderPlus className="size-3" />
                      프로젝트 추가
                    </button>
                  </header>

                  <div className="space-y-2.5 p-3">
                    {brandProjects.map((project) => {
                      const projectTasks = scopedTasks.filter(
                        (task) => task.project_id === project.id,
                      );
                      const roots = projectTasks.filter(
                        (task) =>
                          !task.parent_task_id || !taskIds.has(task.parent_task_id),
                      );
                      if (!roots.length && scope === "done") return null;
                      return (
                        <article
                          key={project.id}
                          className="relative grid grid-cols-[12rem_minmax(0,1fr)] items-start gap-5 rounded-xl border border-border/80 bg-surface/75 p-2.5"
                        >
                          <div
                            aria-hidden
                            className="pointer-events-none absolute left-8 right-5 top-8 h-px"
                            style={{
                              background: `color-mix(in srgb, ${brand.color} 38%, rgb(var(--border)))`,
                            }}
                          />
                          <div
                            className="relative z-10 flex min-h-12 items-center gap-2 rounded-xl border bg-surface px-3 py-2 shadow-xs"
                            style={{
                              borderColor: `color-mix(in srgb, ${brand.color} 32%, rgb(var(--border)))`,
                              boxShadow: `0 6px 18px color-mix(in srgb, ${brand.color} 9%, transparent)`,
                            }}
                          >
                            <span
                              className="size-2 shrink-0 rounded-[3px]"
                              style={{ backgroundColor: brand.color }}
                              aria-hidden
                            />
                            <button
                              type="button"
                              onClick={() => onEditProject(project)}
                              title={project.one_line_objective ?? project.name}
                              className="min-w-0 flex-1 truncate text-left text-xs font-semibold text-text hover:text-accent"
                            >
                              {project.name}
                            </button>
                            <span className="shrink-0 text-[9px] tabular-nums text-text-tertiary">
                              {projectTasks.length}
                            </span>
                            <button
                              type="button"
                              onClick={() => onAddProjectTask(project.id)}
                              aria-label={`${project.name}에 업무 추가`}
                              className="grid size-6 shrink-0 place-items-center rounded-md text-text-tertiary hover:bg-surface-2 hover:text-text"
                            >
                              <Plus className="size-3.5" />
                            </button>
                          </div>

                          <div className="relative z-10 space-y-2">
                            {roots.map((task) => (
                              <FlowTask
                                key={task.id}
                                task={task}
                                childrenByParent={childrenByParent}
                                members={members}
                                onSelect={onSelect}
                                onAddSubtask={onAddSubtask}
                                brandColor={brand.color}
                              />
                            ))}
                            {!roots.length && (
                              <button
                                type="button"
                                onClick={() => onAddProjectTask(project.id)}
                                className="flex h-12 w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border bg-surface text-[11px] font-medium text-text-tertiary hover:border-border-strong hover:text-text-secondary"
                              >
                                <Plus className="size-3.5" />
                                이 프로젝트의 첫 업무 추가
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
        </div>
      )}
    </div>
  );
}
