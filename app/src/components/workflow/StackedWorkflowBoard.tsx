"use client";

import { useMemo, useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  Check,
  Circle,
  CircleAlert,
  CornerDownRight,
  FolderPlus,
  Network,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui";
import { CommentSidecarButton } from "@/components/tasks/CommentThread";
import { ownerColor } from "@/lib/colors";
import { isOverdue, todayKST } from "@/lib/derive";
import { isActiveWork } from "@/lib/workload";
import type { Brand, Member, Project, Task } from "@/server/db/schema";

export type BoardFocus = "all" | "today" | "overdue";
type Scope = "active" | "done";

interface StackedWorkflowBoardProps {
  tasks: Task[];
  brands: Brand[];
  projects: Project[];
  members: Record<string, Member>;
  unreadComments: Record<string, number>;
  focus: BoardFocus;
  onFocusChange: (focus: BoardFocus) => void;
  onSelect: (task: Task) => void;
  onToggleComplete: (task: Task) => void;
  onAddProject: (brandId?: string) => void;
  onAddProjectTask: (projectId: string) => void;
  onAddSubtask: (parent: Task) => void;
  onEditProject: (project: Project) => void;
}

function CompletionButton({
  task,
  onToggleComplete,
  compact = false,
}: {
  task: Task;
  onToggleComplete: (task: Task) => void;
  compact?: boolean;
}) {
  const done = task.status === "Done";
  return (
    <button
      type="button"
      onClick={() => onToggleComplete(task)}
      disabled={Boolean(task.cancelled_at)}
      aria-pressed={done}
      aria-label={done ? `${task.title} 완료 해제` : `${task.title} 완료`}
      className={`grid shrink-0 place-items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40 ${
        compact ? "size-8" : "size-9"
      }`}
    >
      {done ? (
        <span className="grid size-5 place-items-center rounded-full bg-status-done text-text-on-accent">
          <Check className="size-3" strokeWidth={3} aria-hidden />
        </span>
      ) : (
        <Circle className="size-5 text-text-quaternary transition-colors hover:text-text-secondary" aria-hidden />
      )}
    </button>
  );
}

function taskMatchesFocus(task: Task, focus: BoardFocus, now: Date) {
  if (focus === "today") return task.due_date === todayKST(now);
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

function OwnerBadge({ owner }: { owner: Member | null }) {
  return (
    <span className="inline-flex min-w-16 shrink-0 items-center justify-center gap-1.5 rounded-full bg-surface-2 px-2 py-1 text-xs font-semibold text-text-secondary">
      {owner && (
        <span
          className="size-2 rounded-full"
          style={{ backgroundColor: ownerColor(owner.id) }}
          aria-hidden
        />
      )}
      <span className="max-w-16 truncate">{owner?.name ?? "미지정"}</span>
    </span>
  );
}

function ChildTaskRow({
  task,
  depth,
  owner,
  members,
  unreadComments,
  onSelect,
  onToggleComplete,
  onAddSubtask,
}: {
  task: Task;
  depth: number;
  owner: Member | null;
  members: Member[];
  unreadComments: Record<string, number>;
  onSelect: (task: Task) => void;
  onToggleComplete: (task: Task) => void;
  onAddSubtask: (parent: Task) => void;
}) {
  return (
    <div
      title={task.description ?? `${task.title} · ${owner?.name ?? "담당자 미지정"}`}
      className="group/child flex h-10 w-[calc(100%-var(--indent))] items-center gap-2 border-b border-border/60 px-1.5 text-left transition-colors duration-fast ease-out last:border-b-0 hover:bg-surface-2/70"
      style={{
        marginLeft: `${depth * 8}px`,
        ["--indent" as string]: `${depth * 8}px`,
      }}
    >
      {depth > 0 && (
        <CornerDownRight
          className="size-3.5 shrink-0 text-text-quaternary"
          aria-hidden
        />
      )}
      <CompletionButton task={task} onToggleComplete={onToggleComplete} compact />
      <button
        type="button"
        onClick={() => onSelect(task)}
        className="min-w-0 flex-1 truncate text-left text-sm font-medium text-text transition-transform duration-fast ease-out active:scale-[0.99]"
      >
        {task.title}
      </button>
      <OwnerBadge owner={owner} />
      <CommentSidecarButton
        target={{ type: "task", id: task.id }}
        title={task.title}
        description={task.description}
        members={members}
        unreadCount={unreadComments[`task:${task.id}`]}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={() => onAddSubtask(task)}
        aria-label={`${task.title}에 하위업무 추가`}
        title="하위업무 추가"
        className="shrink-0 text-text-tertiary opacity-60 hover:opacity-100 group-hover/child:opacity-100 focus-visible:opacity-100"
      >
        <Plus className="size-3.5" />
      </Button>
    </div>
  );
}

function FlowTask({
  task,
  childrenByParent,
  members,
  memberList,
  unreadComments,
  onSelect,
  onToggleComplete,
  onAddSubtask,
  brandColor,
}: {
  task: Task;
  childrenByParent: Map<string, Task[]>;
  members: Record<string, Member>;
  memberList: Member[];
  unreadComments: Record<string, number>;
  onSelect: (task: Task) => void;
  onToggleComplete: (task: Task) => void;
  onAddSubtask: (parent: Task) => void;
  brandColor: string;
}) {
  const descendants = descendantsOf(task.id, childrenByParent);
  const [showAllDescendants, setShowAllDescendants] = useState(false);
  const remainingDescendants = descendants.slice(3);
  const visibleDescendants = showAllDescendants ? descendants : descendants.slice(0, 3);
  const owner = task.assignee_id ? members[task.assignee_id] : null;

  return (
    <div className="relative grid grid-cols-[minmax(14rem,.8fr)_minmax(16rem,.9fr)] items-start gap-5">
      <div
        className="group relative z-10 flex min-h-14 items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 shadow-xs transition-[border-color,box-shadow,transform] duration-fast ease-out hover:-translate-y-px hover:border-border-strong hover:shadow-sm active:scale-[0.995]"
      >
        <span
          aria-hidden
          className="pointer-events-none absolute left-full top-1/2 h-px w-5 bg-border"
        />
        <span
          className="h-7 w-1 shrink-0 rounded-full"
          style={{ backgroundColor: brandColor }}
          aria-hidden
        />
        <button
          type="button"
          onClick={() => onSelect(task)}
          title={task.description ?? task.title}
          className="line-clamp-2 min-w-0 flex-1 text-left text-base font-semibold leading-5 tracking-[-0.01em] text-text transition-transform duration-fast ease-out active:scale-[0.99]"
        >
          {task.title}
        </button>
        <span className="flex shrink-0 items-center gap-2">
          <OwnerBadge owner={owner} />
          {task.due_date && (
            <span className="text-xs tabular-nums text-text-tertiary">
              {task.due_date.slice(5)}
              {task.start_date === task.due_date ? " 일정" : " 마감"}
            </span>
          )}
        </span>
        <CommentSidecarButton
          target={{ type: "task", id: task.id }}
          title={task.title}
          description={task.description}
          members={memberList}
          unreadCount={unreadComments[`task:${task.id}`]}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => onAddSubtask(task)}
          aria-label={`${task.title}에 하위업무 추가`}
          className="shrink-0 text-text-tertiary opacity-60 group-hover:opacity-100 focus-visible:opacity-100"
        >
          <Plus className="size-3.5" />
        </Button>
      </div>
      <div className="relative z-10 min-h-14 overflow-hidden rounded-xl border border-border bg-surface px-2 py-1">
        {visibleDescendants.map(({ task: child, depth }) => {
          const childOwner = child.assignee_id ? members[child.assignee_id] : null;
          return (
            <ChildTaskRow
              key={child.id}
              task={child}
              depth={depth}
              owner={childOwner}
              members={memberList}
              unreadComments={unreadComments}
              onSelect={onSelect}
              onToggleComplete={onToggleComplete}
              onAddSubtask={onAddSubtask}
            />
          );
        })}
        {remainingDescendants.length > 0 && (
          <button
            type="button"
            onClick={() => setShowAllDescendants((value) => !value)}
            aria-expanded={showAllDescendants}
            className="flex h-8 w-full items-center px-2 text-left text-xs font-semibold text-accent transition-colors hover:text-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {showAllDescendants
              ? "간략히 보기"
              : `+ ${remainingDescendants.length}개 더 보기`}
          </button>
        )}
        {!descendants.length && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onAddSubtask(task)}
            className="px-2 text-xs text-text-tertiary hover:text-text-secondary"
          >
            <Plus className="size-3" />
            하위업무 추가
          </Button>
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
  unreadComments,
  focus,
  onFocusChange,
  onSelect,
  onToggleComplete,
  onAddProject,
  onAddProjectTask,
  onAddSubtask,
  onEditProject,
}: StackedWorkflowBoardProps) {
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
  const memberList = useMemo(() => Object.values(members), [members]);

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface-2/35 shadow-xs">
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface px-3 py-2.5 sm:px-4">
        <p className="px-1 text-xs font-semibold text-text-secondary">워크플로우</p>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {([
            ["all", "전체"],
            ["today", "지금 할 일"],
            ["overdue", "기한 초과"],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setScope("active");
                onFocusChange(id);
              }}
              className={`h-8 rounded-full px-3 text-xs font-semibold transition-transform duration-fast ease-out active:scale-[0.97] ${scope === "active" && focus === id ? "bg-text text-bg" : "border border-border bg-surface text-text-secondary hover:border-border-strong"}`}
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setScope(scope === "done" ? "active" : "done")}
            className={`h-8 rounded-full px-3 text-xs font-semibold transition-transform duration-fast ease-out active:scale-[0.97] ${scope === "done" ? "bg-status-done text-white" : "border border-border bg-surface text-text-secondary"}`}
          >
            완료 업무
          </button>
        </div>
      </div>

      <div
          className="overflow-x-auto bg-bg p-3 sm:p-4"
          style={{
            backgroundImage:
              "radial-gradient(rgb(var(--text-quaternary)/0.18) 1px, transparent 1.2px)",
            backgroundSize: "22px 22px",
          }}
        >
          <div className="min-w-[1056px] space-y-3">
            <div className="grid grid-cols-[10rem_minmax(0,1fr)] border-b border-border/80 pb-2 text-xs font-semibold text-text-tertiary">
              <span className="pl-5">브랜드</span>
              <div className="grid grid-cols-[18rem_minmax(0,1fr)] gap-5 px-3">
                <span>프로젝트</span>
                <div className="grid grid-cols-[minmax(14rem,.8fr)_minmax(16rem,.9fr)] gap-5">
                  <span>주요업무</span>
                  <span>하위업무</span>
                </div>
              </div>
            </div>
            {brands.map((brand) => {
              const brandProjects = projects.filter(
                (project) => project.brand_id === brand.id,
              );
              if (!brandProjects.length) return null;
              return (
                <section
                  key={brand.id}
                  className="relative grid grid-cols-[10rem_minmax(0,1fr)] overflow-hidden rounded-2xl border border-border bg-surface shadow-xs"
                >
                  <div
                    aria-hidden
                    className="absolute inset-y-0 left-0 w-1.5"
                    style={{ backgroundColor: brand.color }}
                  />
                  <header className="flex min-h-24 flex-col justify-between border-r border-border/80 px-4 py-3 pl-5">
                    <div>
                      <span
                        className="mb-2 block h-1 w-7 rounded-full bg-border-strong"
                        aria-hidden
                      />
                      <h2 className="break-keep text-base font-semibold tracking-tight text-text">
                        {brand.name}
                      </h2>
                      <p className="mt-1 text-xs tabular-nums text-text-tertiary">
                        프로젝트 {brandProjects.length}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => onAddProject(brand.id)}
                      className="mt-3 w-max px-2 text-xs font-semibold text-text-secondary"
                    >
                      <FolderPlus className="size-3" />
                      프로젝트 추가
                    </Button>
                  </header>

                  <div className="space-y-2.5 p-3">
                    {brandProjects.map((project) => {
                      const projectTasks = scopedTasks.filter(
                        (task) => task.project_id === project.id,
                      );
                      const projectAllTasks = tasks.filter(
                        (task) =>
                          task.project_id === project.id &&
                          !task.cancelled_at &&
                          task.kind !== "milestone",
                      );
                      const projectDoneTasks = projectAllTasks
                        .filter((task) => task.status === "Done")
                        .sort((a, b) =>
                          (b.completed_at ?? b.updated_at).localeCompare(
                            a.completed_at ?? a.updated_at,
                          ),
                        );
                      const completionPercent = projectAllTasks.length
                        ? (projectDoneTasks.length / projectAllTasks.length) * 100
                        : 0;
                      const roots = projectTasks.filter(
                        (task) =>
                          !task.parent_task_id || !taskIds.has(task.parent_task_id),
                      );
                      if (!roots.length && scope === "done") return null;
                      return (
                        <article
                          key={project.id}
                          className="relative grid grid-cols-[18rem_minmax(0,1fr)] items-stretch gap-5 border-b border-border/70 py-3 last:border-b-0"
                        >
                          <div
                            className="relative z-10 flex min-h-[72px] flex-col rounded-2xl border border-border bg-surface p-3"
                          >
                            <span
                              aria-hidden
                              className="pointer-events-none absolute left-full top-7 h-px w-5 bg-border"
                            />
                            <div className="flex h-8 min-w-0 items-center gap-2">
                              <span
                                className="size-2 shrink-0 rounded-full"
                                style={{ backgroundColor: brand.color }}
                                aria-hidden
                              />
                              <button
                                type="button"
                                onClick={() => onEditProject(project)}
                                title={project.name}
                                className="min-w-0 flex-1 truncate whitespace-nowrap text-left text-base font-semibold leading-5 tracking-[-0.01em] text-text transition-[color,transform] duration-fast ease-out hover:text-accent active:scale-[0.99]"
                              >
                                {project.name}
                              </button>
                            </div>
                            <div className="mt-auto flex min-h-8 items-end justify-between gap-2 pl-4">
                              {projectDoneTasks.length > 0 ? (
                                <DropdownMenu.Root>
                                  <DropdownMenu.Trigger asChild>
                                    <button
                                      type="button"
                                      aria-label={`${project.name} 최근 완료 업무 ${projectDoneTasks.length}개`}
                                      className="flex w-20 flex-col gap-1 rounded-md py-1 text-left text-[10px] font-semibold tabular-nums text-text-tertiary transition-colors hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    >
                                      <span className="inline-flex items-center gap-1">
                                        <Check
                                          className="size-3 text-status-done"
                                          strokeWidth={2.5}
                                          aria-hidden
                                        />
                                        완료 {projectDoneTasks.length}/{projectAllTasks.length}
                                      </span>
                                      <span
                                        className="h-1 w-full overflow-hidden rounded-full bg-surface-3"
                                        aria-hidden
                                      >
                                        <span
                                          className="block h-full rounded-full bg-status-done"
                                          style={{ width: `${completionPercent}%` }}
                                        />
                                      </span>
                                    </button>
                                  </DropdownMenu.Trigger>
                                  <DropdownMenu.Portal>
                                    <DropdownMenu.Content
                                      align="end"
                                      sideOffset={6}
                                      collisionPadding={12}
                                      className="z-[80] w-64 rounded-xl border border-separator bg-elevated/95 p-1.5 shadow-xl backdrop-blur-xl data-[state=open]:animate-scale-in"
                                    >
                                      <p className="px-2.5 py-1.5 text-[10px] font-semibold text-text-tertiary">
                                        최근 완료
                                      </p>
                                      {projectDoneTasks.slice(0, 3).map((doneTask) => (
                                        <DropdownMenu.Item
                                          key={doneTask.id}
                                          onSelect={() => onSelect(doneTask)}
                                          className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-text-secondary outline-none data-[highlighted]:bg-surface-2 data-[highlighted]:text-text"
                                        >
                                          <Check
                                            className="size-3.5 shrink-0 text-status-done"
                                            aria-hidden
                                          />
                                          <span className="truncate line-through">
                                            {doneTask.title}
                                          </span>
                                        </DropdownMenu.Item>
                                      ))}
                                    </DropdownMenu.Content>
                                  </DropdownMenu.Portal>
                                </DropdownMenu.Root>
                              ) : (
                                <span className="inline-flex h-8 items-center text-[10px] font-semibold tabular-nums text-text-quaternary">
                                  완료 0/{projectAllTasks.length}
                                </span>
                              )}
                              <span className="flex shrink-0 items-center gap-0.5">
                                <CommentSidecarButton
                                  target={{ type: "project", id: project.id }}
                                  title={project.name}
                                  members={memberList}
                                  unreadCount={unreadComments[`project:${project.id}`]}
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  onClick={() => onAddProjectTask(project.id)}
                                  aria-label={`${project.name}에 업무 추가`}
                                  className="shrink-0 text-text-tertiary"
                                >
                                  <Plus className="size-3.5" />
                                </Button>
                              </span>
                            </div>
                          </div>

                          <div className="relative z-10 space-y-2">
                            {roots.map((task) => (
                              <FlowTask
                                key={task.id}
                                task={task}
                                childrenByParent={childrenByParent}
                                members={members}
                                memberList={memberList}
                                unreadComments={unreadComments}
                              onSelect={onSelect}
                              onToggleComplete={onToggleComplete}
                              onAddSubtask={onAddSubtask}
                                brandColor={brand.color}
                              />
                            ))}
                            {!roots.length && (
                              <button
                                type="button"
                                onClick={() => onAddProjectTask(project.id)}
                                className="flex h-12 w-full items-center justify-center gap-1.5 border-y border-dashed border-border text-xs font-medium text-text-tertiary transition-[border-color,color,transform] duration-fast ease-out hover:border-border-strong hover:text-text-secondary active:scale-[0.99]"
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
                  {focus === "overdue" ? <CircleAlert className="mx-auto mb-2 size-5 text-text-tertiary" /> : <Network className="mx-auto mb-2 size-5 text-text-tertiary" />}
                  <p className="text-xs font-semibold text-text-secondary">
                    {scope === "done" ? "완료된 업무가 없습니다" : "조건에 맞는 업무가 없습니다"}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
    </div>
  );
}
