"use client";

import { type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/ui";
import { type TaskStatus } from "@/lib/status";

// ── Types ────────────────────────────────────────────────────────────────────
// Status uses the shared vocabulary from lib/status.ts (the single source of
// truth) so a status reads identically on a card, in the detail panel, and in
// filters, and adapts to light/dark via the --status-* tokens.

export type { TaskStatus };

export interface TaskFlags {
  /** Task has been stalled for more than the expected duration */
  stalled?: boolean;
  /** Task requires immediate attention */
  attention?: boolean;
  /** Task is overdue */
  overdue?: boolean;
}

export interface TaskItem {
  id: string;
  title: string;
  assigneeName?: string;
  status: TaskStatus;
  /** True when the task was cancelled (StatusBadge renders Cancelled styling). */
  cancelled?: boolean;
  dueDate?: string; // ISO date string e.g. "2025-08-01"
  flags?: TaskFlags;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("ko-KR", { month: "long", day: "numeric" });
}

function isDateOverdue(iso: string): boolean {
  return new Date(iso) < new Date(new Date().toDateString());
}

function initials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

// ── Sub-components ───────────────────────────────────────────────────────────

function FlagPip({
  type,
}: {
  type: "stalled" | "attention" | "overdue";
}): ReactNode {
  const config = {
    stalled: { label: "지연", className: "bg-flag-followup/15 text-flag-followup" },
    attention: { label: "확인 필요", className: "bg-flag-blocked/15 text-flag-blocked" },
    overdue: { label: "기한 초과", className: "bg-flag-overdue/12 text-flag-overdue" },
  };
  const { label, className } = config[type];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-1.5 py-0.5 text-2xs font-semibold uppercase tracking-wide",
        className,
      )}
    >
      {label}
    </span>
  );
}

// ── TaskCard ─────────────────────────────────────────────────────────────────

interface TaskCardProps {
  task: TaskItem;
  onClick?: (task: TaskItem) => void;
  className?: string;
}

export default function TaskCard({
  task,
  onClick,
  className = "",
}: TaskCardProps) {
  const { id, title, assigneeName, status, cancelled, dueDate, flags } = task;
  const hasFlags = flags?.stalled || flags?.attention || flags?.overdue;
  const dateOverdue =
    dueDate && isDateOverdue(dueDate) && status !== "Done";

  const combinedFlags = {
    ...flags,
    overdue: flags?.overdue ?? dateOverdue,
  };

  return (
    <article
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick(task);
              }
            }
          : undefined
      }
      onClick={onClick ? () => onClick(task) : undefined}
      className={cn(
        "group flex flex-col gap-2.5 rounded-lg border border-separator bg-surface px-4 py-3.5 text-left shadow-sm",
        "transition-[transform,box-shadow,border-color] duration-base ease-out",
        onClick &&
          "cursor-pointer hover:shadow-md hover:border-border active:scale-[0.99] active:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
        className,
      )}
      aria-label={`업무: ${title}`}
    >
      {/* Title row */}
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-medium text-text leading-snug line-clamp-2 flex-1">
          {title}
        </h3>
        {/* Assignee avatar */}
        {assigneeName && (
          <span
            className="h-6 w-6 flex-shrink-0 rounded-full bg-surface-3 text-2xs font-semibold text-text-secondary flex items-center justify-center"
            title={assigneeName}
            aria-label={`담당자: ${assigneeName}`}
          >
            {initials(assigneeName)}
          </span>
        )}
      </div>

      {/* Meta row */}
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={status} cancelled={cancelled} />

        {dueDate && (
          <span
            className={cn(
              "text-xs tabular-nums",
              combinedFlags.overdue
                ? "text-flag-overdue font-medium"
                : "text-text-tertiary",
            )}
          >
            {combinedFlags.overdue
              ? `기한 초과 · ${formatDate(dueDate)}`
              : `${formatDate(dueDate)} 마감`}
          </span>
        )}

        {/* Flags */}
        {hasFlags && (
          <div className="flex flex-wrap gap-1 ml-auto">
            {combinedFlags.stalled && <FlagPip type="stalled" />}
            {combinedFlags.attention && <FlagPip type="attention" />}
            {!combinedFlags.stalled && combinedFlags.overdue && (
              <FlagPip type="overdue" />
            )}
          </div>
        )}
      </div>

      {/* ID */}
      <p className="text-2xs font-mono text-text-quaternary group-hover:text-text-tertiary transition-colors">
        #{id}
      </p>
    </article>
  );
}
