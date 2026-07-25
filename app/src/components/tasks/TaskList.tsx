"use client";

import { useMemo, useState } from "react";
import { ChevronRight, ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";
import { todayKST } from "@/lib/derive";
import EmptyState from "@/components/EmptyState";
import TaskRow from "./TaskRow";
import type { TaskStore } from "./useTaskStore";
import type { Task, Member } from "@/server/db/schema";

export interface TaskListProps {
  tasks: Task[];
  members: Record<string, Member>;
  store: TaskStore;
  selectedId?: string | null;
  onSelect: (task: Task) => void;
  onToggleComplete: (task: Task) => void;
  onCancel: (task: Task) => void;
  onRestore: (task: Task) => void;
  onToggleKey?: (task: Task) => void;
  /** Enables drag-to-reorder. Omit for lists whose order is derived, not manual. */
  onReorder?: (orderedIds: string[]) => void;
  emptyTitle?: string;
  emptyDescription?: string;
  /** Rendered under the open list — normally the inline add row. */
  footer?: React.ReactNode;
}

/**
 * The list-based task view: open tasks first, completed ones tucked into a
 * collapsible section beneath with a count.
 */
export default function TaskList({
  tasks,
  members,
  store,
  selectedId,
  onSelect,
  onToggleComplete,
  onCancel,
  onRestore,
  onToggleKey,
  onReorder,
  emptyTitle = "등록된 업무가 없습니다",
  emptyDescription = "아래에서 업무를 추가해 보세요.",
  footer,
}: TaskListProps) {
  const [showDone, setShowDone] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const today = useMemo(() => todayKST(new Date()), []);

  const { open, done } = useMemo(() => {
    const sorted = [...tasks].sort((a, b) => a.sort_order - b.sort_order);
    return {
      open: sorted.filter((t) => t.status !== "Done"),
      done: sorted.filter((t) => t.status === "Done"),
    };
  }, [tasks]);

  function handleDrop(targetId: string) {
    if (!onReorder || !draggingId || draggingId === targetId) return;
    const ids = open.map((t) => t.id);
    const from = ids.indexOf(draggingId);
    const to = ids.indexOf(targetId);
    if (from === -1 || to === -1) return;
    ids.splice(to, 0, ids.splice(from, 1)[0]!);
    onReorder(ids);
    setDraggingId(null);
  }

  const rowProps = (task: Task) => ({
    task,
    members,
    today,
    saveState: store.stateOf(task.id),
    selected: selectedId === task.id,
    onSelect,
    onToggleComplete,
    onCancel,
    onRestore,
    onToggleKey,
  });

  return (
    <div className="flex flex-col">
      {open.length === 0 && done.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-surface-2/40">
          <EmptyState
            icon={<ClipboardList className="h-5 w-5" aria-hidden />}
            title={emptyTitle}
            description={emptyDescription}
          />
        </div>
      ) : (
        <ul className="flex flex-col" role="list">
          {open.map((task) => (
            <li
              key={task.id}
              draggable={Boolean(onReorder && draggingId === task.id)}
              onDragOver={(e) => {
                if (onReorder && draggingId) e.preventDefault();
              }}
              onDrop={() => handleDrop(task.id)}
              onDragEnd={() => setDraggingId(null)}
              className={cn(draggingId === task.id && "opacity-40")}
            >
              <TaskRow
                {...rowProps(task)}
                dragHandleProps={
                  onReorder
                    ? {
                        draggable: true,
                        onDragStart: () => setDraggingId(task.id),
                        onPointerDown: () => setDraggingId(task.id),
                      }
                    : undefined
                }
              />
            </li>
          ))}
        </ul>
      )}

      {footer && <div className="mt-1">{footer}</div>}

      {done.length > 0 && (
        <div className="mt-4 border-t border-separator pt-3">
          <button
            type="button"
            onClick={() => setShowDone((v) => !v)}
            aria-expanded={showDone}
            className="flex items-center gap-1.5 rounded px-1 py-1 text-xs font-semibold uppercase tracking-wider text-text-tertiary transition-colors hover:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronRight
              className={cn(
                "h-3.5 w-3.5 transition-transform duration-fast ease-out",
                showDone && "rotate-90"
              )}
              aria-hidden
            />
            완료 {done.length}
          </button>

          {showDone && (
            <ul className="mt-1 flex flex-col" role="list">
              {done.map((task) => (
                <li key={task.id}>
                  <TaskRow {...rowProps(task)} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
