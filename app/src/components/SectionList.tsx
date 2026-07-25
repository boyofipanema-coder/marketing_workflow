import { type ReactNode } from "react";
import TaskCard, { type TaskItem } from "./TaskCard";
import EmptyState from "./EmptyState";

interface SectionListProps {
  title: string;
  tasks: TaskItem[];
  /** Called when a task card is clicked */
  onTaskClick?: (task: TaskItem) => void;
  /** Empty state title */
  emptyTitle?: string;
  /** Empty state description */
  emptyDescription?: string;
  /** Optional icon for the empty state */
  emptyIcon?: ReactNode;
  /** Trailing element in the section header (e.g. a count badge or action) */
  headerAction?: ReactNode;
  className?: string;
}

export default function SectionList({
  title,
  tasks,
  onTaskClick,
  emptyTitle = "등록된 업무가 없습니다",
  emptyDescription = "이 섹션에 추가된 업무가 여기에 표시됩니다.",
  emptyIcon,
  headerAction,
  className = "",
}: SectionListProps) {
  return (
    <section className={`flex flex-col gap-3 ${className}`} aria-label={title}>
      {/* Section header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
            {title}
          </h2>
          {tasks.length > 0 && (
            <span className="flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-surface-2 px-1.5 text-2xs font-semibold text-text-secondary">
              {tasks.length}
            </span>
          )}
        </div>
        {headerAction && (
          <div className="flex items-center">{headerAction}</div>
        )}
      </div>

      {/* Task list or empty state */}
      {tasks.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-surface-2/50">
          <EmptyState
            icon={emptyIcon}
            title={emptyTitle}
            description={emptyDescription}
          />
        </div>
      ) : (
        <ul className="flex flex-col gap-2" role="list">
          {tasks.map((task) => (
            <li key={task.id}>
              <TaskCard task={task} onClick={onTaskClick} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
