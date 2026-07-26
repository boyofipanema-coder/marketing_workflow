"use client";

import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import TaskList from "./TaskList";
import type { TaskStore } from "./useTaskStore";
import type { Task, Member } from "@/server/db/schema";

export interface TaskSectionProps {
  title: string;
  description?: string;
  tasks: Task[];
  members: Record<string, Member>;
  store: TaskStore;
  selectedId?: string | null;
  onSelect: (task: Task) => void;
  onToggleComplete: (task: Task) => void;
  onCancel: (task: Task) => void;
  onRestore: (task: Task) => void;
  onToggleKey?: (task: Task) => void;
  emptyTitle: string;
  emptyDescription: string;
  /** Sections whose contents are derived stay hidden when empty. */
  hideWhenEmpty?: boolean;
  footer?: ReactNode;
}

/** A titled, counted group of tasks — the building block of Home and My Work. */
export default function TaskSection({
  title,
  description,
  tasks,
  members,
  store,
  selectedId,
  onSelect,
  onToggleComplete,
  onCancel,
  onRestore,
  onToggleKey,
  emptyTitle,
  emptyDescription,
  hideWhenEmpty,
  footer,
}: TaskSectionProps) {
  if (hideWhenEmpty && tasks.length === 0) return null;

  return (
    // Collapsible via the native <details> disclosure — no JS state, and a
    // section you've already triaged can be closed to bring the next one
    // into view without scrolling past it.
    <details className="group flex flex-col gap-2" aria-label={title} open>
      <summary className="flex cursor-pointer list-none items-baseline gap-2 [&::-webkit-details-marker]:hidden">
        <ChevronRight className="h-3 w-3 flex-shrink-0 text-text-tertiary transition-transform group-open:rotate-90" />
        <h2 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
          {title}
        </h2>
        {tasks.length > 0 && (
          <span className="flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-surface-2 px-1.5 text-2xs font-semibold text-text-secondary">
            {tasks.length}
          </span>
        )}
      </summary>

      {description && (
        <p className="-mt-1 text-xs text-text-tertiary">{description}</p>
      )}

      <TaskList
        tasks={tasks}
        members={members}
        store={store}
        selectedId={selectedId}
        onSelect={onSelect}
        onToggleComplete={onToggleComplete}
        onCancel={onCancel}
        onRestore={onRestore}
        onToggleKey={onToggleKey}
        emptyTitle={emptyTitle}
        emptyDescription={emptyDescription}
        footer={footer}
      />
    </details>
  );
}
