"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { todayKST } from "@/lib/derive";
import { isMilestone } from "@/lib/board-graph";
import type { Task } from "@/server/db/schema";

export interface ProjectPulseProps {
  tasks: Task[];
  /** Milestone-kind tasks for this project. */
  milestones: Task[];
  /** Clicking a stat jumps the board to that subset. */
  onFocus?: (focus: "due" | "over" | "done") => void;
}

interface Stat {
  key: "due" | "over" | "done" | null;
  label: string;
  value: number;
  tone: string;
}

function fmt(iso: string): string {
  return new Date(iso).toLocaleDateString("ko-KR", {
    month: "long",
    day: "numeric",
  });
}

/**
 * A status-neutral one-glance read on the project. Stored workflow states stay
 * intact, but the summary only exposes observable facts: open, completed and
 * overdue work, plus the next milestone.
 */
export default function ProjectPulse({
  tasks,
  milestones,
  onFocus,
}: ProjectPulseProps) {
  const summary = useMemo(() => {
    const today = todayKST(new Date());
    // Milestones are markers, not work: counting them here would inflate the
    // completion percentage with dates nobody has to do.
    const live = tasks.filter(
      (t) => !t.cancelled_at && !t.parent_task_id && !isMilestone(t)
    );
    const done = live.filter((t) => t.status === "Done");

    const stats: Stat[] = [
      {
        key: null,
        label: "열린 업무",
        value: live.filter((t) => t.status !== "Done").length,
        tone: "text-text",
      },
      {
        key: "done",
        label: "완료 업무",
        value: done.length,
        tone: "text-text-secondary",
      },
      {
        key: "over",
        label: "기한 초과",
        value: live.filter(
          (t) => t.status !== "Done" && t.due_date !== null && t.due_date < today
        ).length,
        tone: "text-flag-overdue",
      },
    ];

    const upcoming = [...milestones]
      .filter((m) => m.status !== "Done" && !!m.due_date && m.due_date >= today)
      .sort((a, b) => (a.due_date! < b.due_date! ? -1 : 1))[0];

    return {
      total: live.length,
      done: done.length,
      stats,
      upcoming,
    };
  }, [tasks, milestones]);

  return (
    <section
      aria-label="프로젝트 업무 요약"
      className="mb-4 flex flex-col gap-3 rounded-xl border border-separator bg-surface p-4"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        {/* A count, not a percentage. Tasks are not equal in size, so "22%
            complete" claimed a precision about remaining work that the data
            cannot support. "완료 2/9" says exactly what is known. */}
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-semibold tabular-nums text-text">
            {summary.done}
            <span className="text-text-quaternary">/</span>
            {summary.total}
          </span>
          <span className="text-xs text-text-secondary">업무 완료</span>
        </div>

        {summary.upcoming && (
          <span className="text-xs text-text-secondary">
            다음 마일스톤 · {summary.upcoming.title}{" "}
            <span className="tabular-nums text-text-tertiary">
              {fmt(summary.upcoming.due_date!)}
            </span>
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-2">
        {summary.stats.map((stat) => {
          const interactive = Boolean(onFocus && stat.key && stat.value > 0);
          const content = (
            <>
              <span
                className={cn(
                  "text-base font-semibold tabular-nums",
                  stat.value > 0 ? stat.tone : "text-text-quaternary"
                )}
              >
                {stat.value}
              </span>
              <span className="text-xs text-text-secondary">{stat.label}</span>
            </>
          );

          return interactive ? (
            <button
              key={stat.label}
              type="button"
              onClick={() => onFocus!(stat.key!)}
              className="flex items-baseline gap-1.5 rounded px-1 -mx-1 transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {content}
            </button>
          ) : (
            <span key={stat.label} className="flex items-baseline gap-1.5 px-1">
              {content}
            </span>
          );
        })}
      </div>
    </section>
  );
}
