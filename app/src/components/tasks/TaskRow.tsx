"use client";

import { useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  Check,
  Circle,
  GripVertical,
  MoreHorizontal,
  Loader2,
  RotateCcw,
  Star,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { STATUS_META, CANCELLED_META } from "@/lib/status";
import type { Task, Member } from "@/server/db/schema";
import type { SaveState } from "./useTaskStore";

export interface TaskRowProps {
  task: Task;
  members: Record<string, Member>;
  saveState: SaveState;
  selected?: boolean;
  /** Today in KST, "YYYY-MM-DD" — passed in so every row agrees on "overdue". */
  today: string;
  onSelect: (task: Task) => void;
  onToggleComplete: (task: Task) => void;
  onCancel: (task: Task) => void;
  onRestore: (task: Task) => void;
  /** Promote/demote a key task. Omit to hide the control. */
  onToggleKey?: (task: Task) => void;
  /** Omitted when the list is not reorderable (e.g. search results). */
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>;
}

function initials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

function formatDue(iso: string, time: string | null): string {
  const label = new Date(iso).toLocaleDateString("ko-KR", {
    month: "long",
    day: "numeric",
  });
  return time ? `${label} ${time}` : label;
}

export default function TaskRow({
  task,
  members,
  saveState,
  selected,
  today,
  onSelect,
  onToggleComplete,
  onCancel,
  onRestore,
  onToggleKey,
  dragHandleProps,
}: TaskRowProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  const cancelled = task.cancelled_at !== null;
  const done = task.status === "Done";
  const assignee = task.assignee_id ? members[task.assignee_id] : undefined;
  const overdue =
    !done && !cancelled && task.due_date !== null && task.due_date < today;
  const meta = cancelled ? CANCELLED_META : STATUS_META[task.status];

  return (
    <div
      className={cn(
        "group relative flex items-center gap-2.5 rounded-lg border px-2 py-2 sm:px-3",
        "transition-[background-color,border-color] duration-fast ease-out",
        selected
          ? "border-accent/50 bg-accent/[0.06]"
          : "border-transparent hover:border-separator hover:bg-surface-2/60",
        cancelled && "opacity-55"
      )}
      data-task-id={task.id}
    >
      {/* Drag handle — hidden until hover on pointer devices, always reachable
          by keyboard. */}
      {dragHandleProps && (
        <button
          type="button"
          aria-label={`${task.title} 순서 변경 핸들`}
          className="hidden h-8 w-4 flex-shrink-0 cursor-grab items-center justify-center text-text-quaternary opacity-0 transition-opacity hover:text-text-tertiary focus-visible:opacity-100 group-hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex"
          {...dragHandleProps}
        >
          <GripVertical className="h-3.5 w-3.5" aria-hidden />
        </button>
      )}

      {/* Completion control */}
      <button
        type="button"
        onClick={() => onToggleComplete(task)}
        disabled={cancelled || saveState === "saving"}
        aria-pressed={done}
        aria-label={done ? `${task.title} 완료 해제` : `${task.title} 완료`}
        className={cn(
          "flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full",
          "transition-colors duration-fast ease-out",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "disabled:cursor-not-allowed disabled:opacity-40"
        )}
      >
        {saveState === "saving" ? (
          <Loader2
            className="h-5 w-5 animate-spin text-text-tertiary"
            aria-hidden
          />
        ) : done ? (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-status-done text-text-on-accent">
            <Check className="h-3 w-3" strokeWidth={3} aria-hidden />
          </span>
        ) : (
          <Circle
            className="h-5 w-5 text-text-quaternary transition-colors group-hover:text-text-tertiary"
            aria-hidden
          />
        )}
      </button>

      {/* Title + meta — the whole block opens the detail panel */}
      <button
        type="button"
        onClick={() => onSelect(task)}
        className="flex min-w-0 flex-1 flex-col items-start gap-1 py-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-bg rounded"
      >
        <span
          className={cn(
            "line-clamp-2 text-sm leading-snug text-text",
            task.importance === "key" && "font-semibold",
            (done || cancelled) && "text-text-tertiary line-through"
          )}
        >
          {task.importance === "key" && (
            <Star
              className="mr-1 inline-block h-3 w-3 -translate-y-px fill-current text-text-secondary"
              aria-label="핵심 업무"
            />
          )}
          {task.title}
        </span>

        <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs">
          {/* Status is conveyed by dot + text, never colour alone. */}
          <span className="inline-flex items-center gap-1.5 text-text-tertiary">
            <span
              className={cn("h-1.5 w-1.5 rounded-full", meta.dot)}
              aria-hidden
            />
            {meta.label}
          </span>

          {task.due_date && (
            <span
              className={cn(
                "tabular-nums",
                overdue ? "font-medium text-flag-overdue" : "text-text-tertiary"
              )}
            >
              {overdue
                ? `기한 초과 · ${formatDue(task.due_date, task.due_time)}`
                : `${formatDue(task.due_date, task.due_time)} 마감`}
            </span>
          )}

          {assignee && (
            <span className="inline-flex items-center gap-1 text-text-tertiary">
              <span
                className="flex h-4 w-4 items-center justify-center rounded-full bg-surface-3 text-[9px] font-semibold text-text-secondary"
                aria-hidden
              >
                {initials(assignee.name)}
              </span>
              {assignee.name}
            </span>
          )}
        </span>
      </button>

      {saveState === "error" && (
        <span className="flex-shrink-0 text-xs text-flag-blocked">저장 실패</span>
      )}

      {/* Overflow menu — cancel and restore live here, deliberately apart from
          the completion control (plan §2.3). */}
      <DropdownMenu.Root open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            aria-label={`${task.title} 추가 작업`}
            className={cn(
              "flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-md text-text-tertiary",
              "transition-opacity hover:bg-surface-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              "sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100",
              menuOpen && "sm:opacity-100"
            )}
          >
            <MoreHorizontal className="h-4 w-4" aria-hidden />
          </button>
        </DropdownMenu.Trigger>

        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={4}
            className="z-50 min-w-[10rem] rounded-lg border border-separator bg-elevated p-1 shadow-xl"
          >
            {!cancelled && onToggleKey && (
              <>
                <DropdownMenu.Item
                  onSelect={() => onToggleKey(task)}
                  className="flex cursor-pointer items-center gap-2 rounded px-2 py-2 text-sm text-text outline-none data-[highlighted]:bg-surface-2"
                >
                  <Star
                    className={cn("h-3.5 w-3.5", task.importance === "key" && "fill-current")}
                    aria-hidden
                  />
                  {task.importance === "key" ? "핵심 업무 해제" : "핵심 업무로 표시"}
                </DropdownMenu.Item>
                <DropdownMenu.Separator className="my-1 h-px bg-separator" />
              </>
            )}

            {cancelled ? (
              <DropdownMenu.Item
                onSelect={() => onRestore(task)}
                className="flex cursor-pointer items-center gap-2 rounded px-2 py-2 text-sm text-text outline-none data-[highlighted]:bg-surface-2"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                취소 복구
              </DropdownMenu.Item>
            ) : (
              <DropdownMenu.Item
                onSelect={() => onCancel(task)}
                className="flex cursor-pointer items-center gap-2 rounded px-2 py-2 text-sm text-flag-blocked outline-none data-[highlighted]:bg-surface-2"
              >
                <XCircle className="h-3.5 w-3.5" aria-hidden />
                업무 취소
              </DropdownMenu.Item>
            )}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  );
}
