"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { CommentSidecarButton } from "@/components/tasks/CommentThread";
import MobileFlowSpine from "@/components/workflow/MobileFlowSpine";
import type { BrandWorkflowSummary } from "@/lib/workflow-summary";
import type { Member, Task } from "@/server/db/schema";

export interface MobileWorkflowOverviewProps {
  groups: BrandWorkflowSummary[];
  members: Record<string, Member>;
  today: string;
  onSelect: (task: Task) => void;
  unreadComments: Record<string, number>;
  initialOpenProjectId?: string;
  onAddTask: (projectId: string) => void;
  onAddSubtask: (task: Task) => void;
  onToggleComplete: (task: Task) => void;
}

export default function MobileWorkflowOverview({
  groups,
  members,
  today,
  onSelect,
  unreadComments,
  initialOpenProjectId,
  onAddTask,
  onAddSubtask,
  onToggleComplete,
}: MobileWorkflowOverviewProps) {
  const [openProjectId, setOpenProjectId] = useState<string | null>(
    initialOpenProjectId ?? null,
  );
  const projects = groups.flatMap((group) => group.projects);

  useEffect(() => {
    if (initialOpenProjectId) setOpenProjectId(initialOpenProjectId);
  }, [initialOpenProjectId]);
  const total = projects.reduce(
    (sum, summary) => sum + summary.counts.total,
    0,
  );
  const done = projects.reduce(
    (sum, summary) => sum + summary.counts.done,
    0,
  );

  return (
    <section className="mb-10 md:hidden" aria-labelledby="mobile-workflow-title">
      <header className="mb-5">
        <p className="text-xs font-semibold text-text-tertiary">팀 워크스페이스</p>
        <h1
          id="mobile-workflow-title"
          className="mt-1 text-2xl font-semibold leading-snug tracking-tight text-text [word-break:keep-all]"
        >
          전체 업무 흐름
        </h1>
        <p className="mt-2 text-sm tabular-nums text-text-secondary">
          브랜드 {groups.filter((group) => group.brand).length} · 프로젝트{" "}
          {projects.length} · 미완료 업무 {total - done}
        </p>
      </header>

      <div className="space-y-7">
        {groups.map((group) => (
          <section
            key={group.brand?.id ?? "_common"}
            aria-labelledby={`mobile-brand-${group.brand?.id ?? "common"}`}
          >
            <div className="mb-2.5 flex min-w-0 items-center gap-2 px-1">
              <span
                aria-hidden
                className="size-2.5 shrink-0 rounded-[4px]"
                style={{
                  backgroundColor: group.brand?.color ?? "rgb(var(--gray-500))",
                }}
              />
              <h2
                id={`mobile-brand-${group.brand?.id ?? "common"}`}
                className="min-w-0 text-sm font-semibold text-text [word-break:keep-all]"
              >
                {group.brand?.name ?? "공통 프로젝트"}
              </h2>
              <span className="ml-auto shrink-0 text-xs tabular-nums text-text-tertiary">
                {group.projects.length}개
              </span>
            </div>

            <div className="overflow-hidden rounded-xl border border-separator bg-surface shadow-xs">
              {group.projects.map((summary, index) => {
                const open = openProjectId === summary.project.id;
                const schedule =
                  summary.nextMilestone?.due_date ??
                  summary.project.target_end_date;
                return (
                  <article
                    key={summary.project.id}
                    className={index > 0 ? "border-t border-separator" : ""}
                  >
                    <div className="flex min-w-0 items-start gap-1 px-4 py-4">
                    <button
                      type="button"
                      aria-expanded={open}
                      aria-controls={`mobile-flow-${summary.project.id}`}
                      onClick={() =>
                        setOpenProjectId(open ? null : summary.project.id)
                      }
                      className="flex min-h-12 min-w-0 flex-1 items-start gap-3 text-left transition-colors duration-base ease-out hover:bg-surface-2 focus-visible:relative focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-2 text-base font-semibold leading-snug text-text [word-break:keep-all]">
                          {summary.project.name}
                        </span>
                        <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-secondary">
                          <span className="font-semibold tabular-nums text-text">
                            열린 업무 {summary.counts.open}
                          </span>
                          {summary.counts.overdue > 0 && (
                            <span className="font-semibold tabular-nums text-flag-overdue">
                              기한 초과 {summary.counts.overdue}
                            </span>
                          )}
                          {!!unreadComments[`project:${summary.project.id}`] && (
                            <span className="font-semibold text-accent">
                              💬 {unreadComments[`project:${summary.project.id}`]}
                            </span>
                          )}
                        </span>
                        {schedule && (
                          <span className="mt-1 block text-xs tabular-nums text-text-tertiary">
                            {summary.nextMilestone
                              ? `다음 마일스톤 · ${summary.nextMilestone.title}`
                              : "목표 종료"}{" "}
                            {schedule}
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 pt-0.5 text-xs font-semibold text-accent">
                        {open ? "접기" : "펼치기"}
                      </span>
                    </button>
                    <CommentSidecarButton
                      target={{ type: "project", id: summary.project.id }}
                      title={summary.project.name}
                      members={Object.values(members)}
                      unreadCount={unreadComments[`project:${summary.project.id}`] ?? 0}
                    />
                    </div>

                    {open && (
                      <div
                        id={`mobile-flow-${summary.project.id}`}
                        className="border-t border-separator bg-surface-2/35 px-4 py-5"
                      >
                        {summary.counts.total > 0 ? (
                          <MobileFlowSpine
                            summary={summary}
                            members={members}
                            today={today}
                            onSelect={onSelect}
                            onToggleComplete={onToggleComplete}
                            onAddSubtask={onAddSubtask}
                            unreadComments={unreadComments}
                          />
                        ) : (
                          <p className="py-4 text-center text-sm text-text-secondary">
                            아직 등록된 업무가 없습니다
                          </p>
                        )}
                        <button
                          type="button"
                          onClick={() => onAddTask(summary.project.id)}
                          className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-1.5 rounded-xl border border-border bg-surface px-4 text-sm font-semibold text-text transition-[background-color,transform] hover:bg-surface-3 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <Plus className="size-4" aria-hidden />
                          업무 추가
                        </button>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}
