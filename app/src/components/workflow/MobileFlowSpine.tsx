"use client";

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
  depth = 0,
  showChildren = true,
  unreadComments,
}: {
  task: Task;
  childrenByParent: Map<string, Task[]>;
  members: Record<string, Member>;
  onSelect: (task: Task) => void;
  depth?: number;
  showChildren?: boolean;
  unreadComments?: Record<string, number>;
}) {
  const children = childrenByParent.get(task.id) ?? [];
  const doneChildren = children.filter((child) => child.status === "Done").length;
  const assignee = task.assignee_id ? members[task.assignee_id] : undefined;

  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(task)}
        className={cn(
          "group flex min-h-12 w-full min-w-0 items-start gap-3 border-t border-separator/80 py-3 text-left",
          "focus-visible:relative focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          depth > 0 && "pl-4",
        )}
      >
        <span aria-hidden className="mt-1.5 size-2 shrink-0 rounded-full bg-text-quaternary" />
        <span className="min-w-0 flex-1">
          <span className="line-clamp-2 text-sm font-medium leading-snug text-text [word-break:keep-all]">
            {task.title}
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-text-tertiary">
            {assignee && <span>{assignee.name}</span>}
            {task.due_date && (
              <span className="tabular-nums">{shortDate(task.due_date)} 마감</span>
            )}
            {children.length > 0 && (
              <span className="tabular-nums">
                세부 업무 {doneChildren}/{children.length}
              </span>
            )}
            {!!unreadComments?.[`task:${task.id}`] && (
              <span className="font-semibold text-accent">
                💬 {unreadComments[`task:${task.id}`]}
              </span>
            )}
          </span>
        </span>
      </button>

      {showChildren && children.length > 0 && (
        <ul className="ml-3 border-l border-separator pl-2">
          {children.map((child) => (
            <TaskBranch
              key={child.id}
              task={child}
              childrenByParent={childrenByParent}
              members={members}
              onSelect={onSelect}
              depth={depth + 1}
              showChildren
              unreadComments={unreadComments}
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
  filter?: WorkflowFilter;
  onFilterChange?: (filter: WorkflowFilter) => void;
  compact?: boolean;
  unreadComments?: Record<string, number>;
}

export default function MobileFlowSpine({
  summary,
  members,
  today,
  onSelect,
  filter = "all",
  onFilterChange,
  compact = false,
  unreadComments,
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
            const tasks = compact ? stage.tasks.slice(0, 2) : stage.tasks;
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

                {tasks.length > 0 ? (
                  <ul className="min-w-0">
                    {tasks.map((task) => (
                      <TaskBranch
                        key={task.id}
                        task={task}
                        childrenByParent={summary.childrenByParent}
                        members={members}
                        onSelect={onSelect}
                        showChildren={!compact}
                        unreadComments={unreadComments}
                      />
                    ))}
                  </ul>
                ) : (
                  <p className="border-t border-separator/80 py-3 text-xs text-text-tertiary">
                    등록된 업무가 없습니다
                  </p>
                )}

                {compact && stage.tasks.length > tasks.length && (
                  <p className="border-t border-separator/80 pt-2 text-xs font-medium text-text-secondary">
                    업무 {stage.tasks.length - tasks.length}개 더 있음
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
