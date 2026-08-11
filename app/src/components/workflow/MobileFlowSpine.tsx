"use client";

import { Check, Circle, CornerDownRight, Plus } from "lucide-react";
import { CommentSidecarButton } from "@/components/tasks/CommentThread";
import NewTaskBadge from "@/components/tasks/NewTaskBadge";
import {
  matchesWorkflowFilter,
  type ProjectWorkflowSummary,
  type WorkflowFilter,
} from "@/lib/workflow-summary";
import { cn } from "@/lib/utils";
import type { Member, Task } from "@/server/db/schema";

const FILTERS: { id: WorkflowFilter; label: string }[] = [
  { id: "all", label: "전체" },
  { id: "due", label: "7일 내 마감" },
  { id: "overdue", label: "기한 초과" },
  { id: "done", label: "완료 업무" },
];

function shortDate(iso: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "numeric",
    day: "numeric",
  }).format(new Date(`${iso}T00:00:00+09:00`));
}

function TaskBranch({
  task,
  childrenByParent,
  members,
  onSelect,
  onToggleComplete,
  onAddSubtask,
  depth = 0,
  unreadComments,
  newTasks,
}: {
  task: Task;
  childrenByParent: Map<string, Task[]>;
  members: Record<string, Member>;
  onSelect: (task: Task) => void;
  onToggleComplete?: (task: Task) => void;
  onAddSubtask?: (task: Task) => void;
  depth?: number;
  unreadComments?: Record<string, number>;
  newTasks?: Record<string, boolean>;
}) {
  const children = childrenByParent.get(task.id) ?? [];
  const doneChildren = children.filter((child) => child.status === "Done").length;
  const assignee = task.assignee_id ? members[task.assignee_id] : undefined;

  return (
    <li>
      <div className={cn("flex min-w-0 items-start gap-1 border-t border-separator/80", depth > 0 && "pl-4")}>
        {onToggleComplete ? (
          <button
            type="button"
            onClick={() => onToggleComplete(task)}
            aria-label={task.status === "Done" ? `${task.title} 완료 해제` : `${task.title} 완료`}
            aria-pressed={task.status === "Done"}
            className="grid size-11 shrink-0 place-items-center rounded-full text-text-quaternary transition-colors hover:text-text-tertiary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {task.status === "Done" ? (
              <span className="grid size-5 place-items-center rounded-full bg-status-done text-text-on-accent">
                <Check className="size-3" strokeWidth={3} aria-hidden />
              </span>
            ) : (
              <Circle className="size-5" aria-hidden />
            )}
          </button>
        ) : (
          <span aria-hidden className="ml-1 mt-5 size-2 shrink-0 rounded-full bg-text-quaternary" />
        )}
        <button
          type="button"
          onClick={() => onSelect(task)}
          className="group flex min-h-12 min-w-0 flex-1 items-start gap-3 py-3 text-left focus-visible:relative focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {depth > 0 && (
            <CornerDownRight
              aria-hidden
              className="mt-0.5 size-3.5 shrink-0 text-text-quaternary"
            />
          )}
          <span className="min-w-0 flex-1">
            <span className="flex items-start gap-1.5">
              {newTasks?.[`task:${task.id}`] && <NewTaskBadge className="mt-0.5" />}
              <span className="line-clamp-2 text-sm font-medium leading-snug text-text [word-break:keep-all]">
                {task.title}
              </span>
            </span>
            <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-text-tertiary">
              {assignee && <span>{assignee.name}</span>}
              {task.due_date && (
                <span className="tabular-nums">
                  {shortDate(task.due_date)}{" "}
                  {task.start_date === task.due_date ? "일정" : "마감"}
                </span>
              )}
              {children.length > 0 && (
                <span className="tabular-nums">
                  세부 업무 {doneChildren}/{children.length}
                </span>
              )}
            </span>
          </span>
        </button>
        <CommentSidecarButton
          target={{ type: "task", id: task.id }}
          title={task.title}
          description={task.description}
          members={Object.values(members)}
          unreadCount={unreadComments?.[`task:${task.id}`] ?? 0}
        />
        {onAddSubtask && task.status !== "Done" && (
          <button
            type="button"
            onClick={() => onAddSubtask(task)}
            aria-label={`${task.title}에 세부업무 추가`}
            className="grid size-10 shrink-0 place-items-center rounded-lg text-text-quaternary transition-[color,transform] hover:text-text active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Plus className="size-4" aria-hidden />
          </button>
        )}
      </div>

      {children.length > 0 && (
        <ul className="ml-3 border-l border-separator pl-2">
          {children.map((child) => (
            <TaskBranch
              key={child.id}
              task={child}
              childrenByParent={childrenByParent}
              members={members}
              onSelect={onSelect}
              onToggleComplete={onToggleComplete}
              onAddSubtask={onAddSubtask}
              depth={depth + 1}
              unreadComments={unreadComments}
              newTasks={newTasks}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export interface MobileFlowSpineProps {
  summary: ProjectWorkflowSummary;
  members: Record<string, Member>;
  today: string;
  onSelect: (task: Task) => void;
  onToggleComplete?: (task: Task) => void;
  onAddSubtask?: (task: Task) => void;
  filter?: WorkflowFilter;
  onFilterChange?: (filter: WorkflowFilter) => void;
  unreadComments?: Record<string, number>;
  newTasks?: Record<string, boolean>;
}

export default function MobileFlowSpine({
  summary,
  members,
  today,
  onSelect,
  onToggleComplete,
  onAddSubtask,
  filter = "all",
  onFilterChange,
  unreadComments,
  newTasks,
}: MobileFlowSpineProps) {
  const visibleStages = summary.stages
    .map((stage) => ({
      ...stage,
      tasks: stage.tasks.filter((task) =>
        matchesWorkflowFilter(task, filter, today),
      ),
    }))
    .filter((stage) => filter === "all" || stage.tasks.length > 0);

  return (
    <div>
      {onFilterChange && (
        <div
          className="-mx-1 mb-5 flex gap-1 overflow-x-auto px-1 pb-1"
          aria-label="업무 필터"
        >
          {FILTERS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              aria-pressed={filter === id}
              onClick={() => onFilterChange(id)}
              className={cn(
                "min-h-12 shrink-0 rounded-full px-4 text-sm font-semibold transition-[background-color,color,transform] duration-base ease-out",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98]",
                filter === id
                  ? "bg-text text-bg"
                  : "bg-surface-2 text-text-secondary hover:text-text",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {visibleStages.length > 0 ? (
        <ol aria-label={`${summary.project.name} 업무 흐름`}>
          {visibleStages.map((stage, index) => {
            const done = stage.tasks.filter(
              (task) => task.status === "Done",
            ).length;
            return (
              <li
                key={stage.id}
                className="relative min-w-0 pb-7 pl-8 last:pb-0"
              >
                {index < visibleStages.length - 1 && (
                  <span
                    aria-hidden
                    className="absolute bottom-0 left-[7px] top-4 w-px bg-separator"
                  />
                )}
                <span
                  aria-hidden
                  className="absolute left-0 top-1.5 grid size-[15px] place-items-center rounded-full border border-border bg-surface shadow-xs"
                >
                  <span className="size-1.5 rounded-full bg-accent" />
                </span>

                <div className="mb-2 flex min-w-0 items-baseline justify-between gap-3">
                  <h3 className="min-w-0 text-sm font-semibold text-text [word-break:keep-all]">
                    {stage.name}
                  </h3>
                  <span className="shrink-0 text-xs tabular-nums text-text-tertiary">
                    완료 {done}/{stage.tasks.length}
                  </span>
                </div>

                {stage.tasks.length > 0 ? (
                  <ul className="min-w-0">
                    {stage.tasks.map((task) => (
                      <TaskBranch
                        key={task.id}
                        task={task}
                        childrenByParent={summary.childrenByParent}
                        members={members}
                        onSelect={onSelect}
                        onToggleComplete={onToggleComplete}
                        onAddSubtask={onAddSubtask}
                        unreadComments={unreadComments}
                        newTasks={newTasks}
                      />
                    ))}
                  </ul>
                ) : (
                  <p className="border-t border-separator/80 py-3 text-xs text-text-tertiary">
                    등록된 업무가 없습니다
                  </p>
                )}

              </li>
            );
          })}
        </ol>
      ) : (
        <p className="rounded-xl bg-surface-2 px-4 py-6 text-center text-sm text-text-secondary">
          이 조건에 해당하는 업무가 없습니다
        </p>
      )}
    </div>
  );
}
