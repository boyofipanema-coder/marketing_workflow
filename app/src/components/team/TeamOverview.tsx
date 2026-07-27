"use client";

import { useMemo } from "react";
import { AlertTriangle, CalendarDays, CheckCircle2, Layers3 } from "lucide-react";
import TaskDetailPanel from "@/components/tasks/TaskDetailPanel";
import { useTaskController } from "@/components/tasks/useTaskController";
import { memberWorkload } from "@/lib/workload";
import type { Brand, Member, Project, Task, Workstream } from "@/server/db/schema";

export default function TeamOverview({
  tasks,
  members,
  brands,
  projects,
  workstreams,
}: {
  tasks: Task[];
  members: Member[];
  brands: Brand[];
  projects: Project[];
  workstreams: Workstream[];
}) {
  const controller = useTaskController(tasks);
  const { store } = controller;
  const projectById = useMemo(
    () => Object.fromEntries(projects.map((project) => [project.id, project])),
    [projects],
  );
  const brandById = useMemo(
    () => Object.fromEntries(brands.map((brand) => [brand.id, brand])),
    [brands],
  );

  return (
    <>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <header className="mb-5">
          <h1 className="text-xl font-semibold tracking-tight text-text">팀 업무 현황</h1>
          <p className="mt-1 text-sm text-text-secondary">
            현재 맡은 업무와 일정, 완료 건수를 구성원별로 보여줍니다.
          </p>
        </header>
        <div className="grid gap-4 lg:grid-cols-3">
          {members.map((member) => {
            const workload = memberWorkload(controller.tasks, member.id);
            return (
              <section key={member.id} className="overflow-hidden rounded-2xl border border-border bg-surface shadow-xs">
                <header className="border-b border-border px-4 py-3">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold text-text">{member.name}</h2>
                    <span className="text-[10px] text-text-tertiary">{member.role === "admin" ? "관리자" : "멤버"}</span>
                  </div>
                  <div className="mt-3 grid grid-cols-4 gap-1.5">
                    {[
                      [Layers3, "활성", workload.activeCount],
                      [CalendarDays, "이번 주", workload.dueThisWeekCount],
                      [AlertTriangle, "기한 초과", workload.overdueCount],
                      [CheckCircle2, "완료", workload.completedCount],
                    ].map(([Icon, label, value]) => {
                      const MetricIcon = Icon as typeof Layers3;
                      return (
                        <div key={String(label)} className="rounded-lg bg-surface-2 px-2 py-2">
                          <MetricIcon className="mb-1 size-3 text-text-tertiary" />
                          <p className="text-sm font-semibold tabular-nums text-text">{String(value)}</p>
                          <p className="truncate text-[9px] text-text-tertiary">{String(label)}</p>
                        </div>
                      );
                    })}
                  </div>
                </header>
                <div className="max-h-[32rem] space-y-1.5 overflow-y-auto p-3">
                  {workload.active.map((task) => {
                    const project = task.project_id ? projectById[task.project_id] : null;
                    const brand = project?.brand_id ? brandById[project.brand_id] : null;
                    return (
                      <button
                        key={task.id}
                        type="button"
                        onClick={() => controller.select(task)}
                        className="flex w-full items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-left hover:border-border-strong"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-semibold text-text">{task.title}</span>
                          <span className="block truncate text-[10px] text-text-tertiary">
                            {[brand?.name, project?.name].filter(Boolean).join(" · ") || "미분류"}
                          </span>
                        </span>
                        {task.due_date && <span className="text-[10px] tabular-nums text-text-tertiary">{task.due_date.slice(5)}</span>}
                      </button>
                    );
                  })}
                  {!workload.active.length && (
                    <p className="py-10 text-center text-xs text-text-tertiary">현재 맡은 업무가 없습니다</p>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </div>
      <TaskDetailPanel
        task={controller.selected}
        projects={projects}
        workstreams={workstreams}
        members={members}
        open={controller.panelOpen}
        saveState={controller.selected ? store.stateOf(controller.selected.id) : "idle"}
        error={controller.selected ? store.errorFor(controller.selected.id).error : null}
        conflict={controller.selected ? store.errorFor(controller.selected.id).conflict : false}
        onOpenChange={(open) => {
          controller.setPanelOpen(open);
          if (!open) store.dismissError();
        }}
        onPatch={controller.patch}
        onToggleComplete={controller.toggleComplete}
        onCancelTask={controller.cancel}
        onRestoreTask={controller.restore}
      />
    </>
  );
}
