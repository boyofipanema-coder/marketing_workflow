"use client";

import { AlertTriangle, ArrowUpRight, Clock3, Star } from "lucide-react";
import { rankedTasks } from "@/lib/priority";
import { cn } from "@/lib/utils";
import type { Project, Task } from "@/server/db/schema";

export default function PriorityBrief({
  tasks,
  projects,
  viewerId,
  today,
  onSelect,
}: {
  tasks: Task[];
  projects: Project[];
  viewerId: string;
  today: string;
  onSelect: (task: Task) => void;
}) {
  const signals = rankedTasks(tasks, viewerId, today, 4);
  const projectNames = new Map(projects.map((project) => [project.id, project.name]));

  return (
    <section
      aria-labelledby="priority-brief-title"
      className="overflow-hidden rounded-[22px] border border-border bg-surface shadow-sm"
    >
      <div className="grid gap-0 md:grid-cols-[minmax(13rem,0.8fr)_minmax(0,2.2fr)]">
        <header className="flex flex-col justify-between border-b border-separator bg-surface-2/70 p-5 md:border-b-0 md:border-r md:p-6">
          <div>
            <p className="text-2xs font-semibold uppercase tracking-[0.16em] text-accent">
              오늘의 판단
            </p>
            <h2 id="priority-brief-title" className="mt-2 break-keep text-xl font-semibold tracking-tight text-text">
              지금 먼저 볼 업무
            </h2>
            <p className="mt-2 break-keep text-xs leading-relaxed text-text-secondary">
              중요도, 마감, 일정과 팔로업을 함께 계산했습니다.
            </p>
          </div>
          <time className="mt-5 font-mono text-xs tabular-nums text-text-tertiary" dateTime={today}>
            {today.replaceAll("-", ".")}
          </time>
        </header>

        <div className="divide-y divide-separator">
          {signals.length === 0 ? (
            <div className="flex min-h-36 items-center px-5 py-8 text-sm text-text-secondary md:px-6">
              바로 확인할 업무가 없습니다. 중요한 업무에 별표를 표시해 두세요.
            </div>
          ) : (
            signals.map(({ task, reason, level }, index) => {
              const Icon = level === "now" ? AlertTriangle : level === "important" ? Star : Clock3;
              return (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => onSelect(task)}
                  className="group grid w-full grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-surface-2/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-5"
                >
                  <span
                    className={cn(
                      "grid size-8 place-items-center rounded-[10px]",
                      level === "now"
                        ? "bg-flag-overdue/12 text-flag-overdue"
                        : level === "important"
                          ? "bg-accent/12 text-accent"
                          : "bg-surface-3 text-text-secondary",
                    )}
                  >
                    <Icon className="size-3.5" aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-text">
                      {task.title}
                    </span>
                    <span className="mt-0.5 flex flex-wrap gap-x-2 text-[11px] text-text-tertiary">
                      <span className={cn(level === "now" && "font-semibold text-flag-overdue")}>{reason}</span>
                      {task.project_id && <span>{projectNames.get(task.project_id)}</span>}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="font-mono text-2xs tabular-nums text-text-quaternary">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <ArrowUpRight className="size-4 text-text-quaternary transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-text-secondary" aria-hidden />
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
}
