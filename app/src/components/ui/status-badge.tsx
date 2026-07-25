import * as React from "react";
import { cn } from "@/lib/utils";
import {
  statusMeta,
  FLAG_META,
  type TaskStatus,
  type AttentionFlag,
} from "@/lib/status";

/**
 * StatusBadge — the canonical way to render a task's status. A colored pip +
 * label using the shared status vocabulary (lib/status.ts), so a status reads
 * identically on a card, in the detail panel, and in a filter.
 *
 *   <StatusBadge status="InProgress" />
 *   <StatusBadge status="Done" cancelled />   // shows Cancelled styling
 *   <StatusBadge status="ToDo" variant="dot" /> // just the pip (dense rows)
 */
export interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: TaskStatus;
  cancelled?: boolean;
  /** "soft" = tinted pill (default); "dot" = pip + label; "pip" = pip only. */
  variant?: "soft" | "dot" | "pip";
}

export function StatusBadge({
  status,
  cancelled = false,
  variant = "soft",
  className,
  ...props
}: StatusBadgeProps) {
  const meta = statusMeta(status, cancelled);

  if (variant === "pip") {
    return (
      <span
        role="img"
        aria-label={meta.label}
        title={meta.label}
        className={cn("inline-block size-2 rounded-full", meta.dot, className)}
        {...props}
      />
    );
  }

  if (variant === "dot") {
    return (
      <span
        className={cn("inline-flex items-center gap-1.5 text-sm font-medium", meta.text, className)}
        {...props}
      >
        <span className={cn("size-2 rounded-full", meta.dot)} />
        {meta.label}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 h-6 pl-1.5 pr-2.5 rounded-full text-xs font-semibold",
        meta.fill,
        meta.text,
        className,
      )}
      {...props}
    >
      <span className={cn("size-1.5 rounded-full", meta.dot)} />
      {meta.label}
    </span>
  );
}

/**
 * FlagBadge — attention flags (Blocked / Overdue / Follow up / Ready) computed
 * at read time. Small, urgent, never more than a couple per task.
 */
export function FlagBadge({
  flag,
  className,
  ...props
}: { flag: AttentionFlag } & React.HTMLAttributes<HTMLSpanElement>) {
  const meta = FLAG_META[flag];
  return (
    <span
      className={cn(
        "inline-flex items-center h-5 px-2 rounded-full text-2xs font-semibold uppercase tracking-wide",
        meta.fill,
        meta.text,
        className,
      )}
      {...props}
    >
      {meta.label}
    </span>
  );
}
