"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList } from "lucide-react";
import TaskCard, { type TaskItem } from "@/components/TaskCard";
import TaskDetailPanel from "@/components/TaskDetailPanel";
import EmptyState from "@/components/EmptyState";
import WorkflowCanvas from "@/components/workflow/WorkflowCanvas";
import type { Project, Task, Workstream, Member } from "@/server/db/schema";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ProjectWorkspaceProps {
  project: Project;
  workstreams: Workstream[];
  tasks: Task[];
  members: Record<string, Member>;
  milestones: { id: string; name: string; due_date: string }[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Convert a DB Task to a TaskItem suitable for TaskCard. The DB status enum is
 * the shared status vocabulary (lib/status.ts), so it passes through directly.
 */
function toTaskItem(task: Task, members: Record<string, Member>): TaskItem {
  const assignee = task.assignee_id ? members[task.assignee_id] : undefined;
  const today = new Date().toISOString().slice(0, 10);
  const cancelled = task.cancelled_at !== null && task.cancelled_at !== undefined;
  const isOverdue =
    task.due_date !== null &&
    task.due_date !== undefined &&
    task.due_date < today &&
    task.status !== "Done" &&
    !cancelled;

  return {
    id: task.id,
    title: task.title,
    assigneeName: assignee?.name,
    status: task.status,
    cancelled,
    dueDate: task.due_date ?? undefined,
    flags: isOverdue ? { overdue: true } : undefined,
  };
}

/** Format an ISO date to a short display string */
function fmtDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });
}

// ── Tab types ─────────────────────────────────────────────────────────────────

type Tab = "workflow" | "tasks" | "milestones";

// ── ProjectWorkspace ──────────────────────────────────────────────────────────

export default function ProjectWorkspace({
  project,
  workstreams,
  tasks,
  members,
  milestones,
}: ProjectWorkspaceProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("workflow");
  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  // Poll every 30 seconds
  useEffect(() => {
    const id = setInterval(() => router.refresh(), 30_000);
    return () => clearInterval(id);
  }, [router]);

  // Refetch on tab focus
  useEffect(() => {
    function onFocus() {
      router.refresh();
    }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [router]);

  const lead = project.project_lead_id ? members[project.project_lead_id] : undefined;

  // All tasks for the Tasks tab (exclude Done and Inbox for primary list)
  const allActiveTaskItems = useMemo(
    () =>
      tasks
        .filter(
          (t) =>
            (t.cancelled_at === null || t.cancelled_at === undefined) &&
            t.status !== "Done" &&
            t.status !== "Inbox"
        )
        .map((t) => toTaskItem(t, members)),
    [tasks, members],
  );
  const doneTaskItems = useMemo(
    () =>
      tasks
        .filter((t) => t.status === "Done")
        .map((t) => toTaskItem(t, members)),
    [tasks, members],
  );

  // Event handlers
  function handleTaskClick(task: TaskItem) {
    setSelectedTask(task);
    setPanelOpen(true);
  }

  // Project summary for the detail panel
  const projectSummary = { id: project.id, name: project.name };

  // Lead initials
  const leadInitials = lead
    ? lead.name
        .split(" ")
        .slice(0, 2)
        .map((w) => w[0])
        .join("")
        .toUpperCase()
    : null;

  return (
    <>
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        {/* ── Project header ──────────────────────────────────────────────── */}
        <header className="mb-8">
          <h1 className="font-serif text-2xl font-semibold text-text leading-tight">
            {project.name}
          </h1>

          {project.one_line_objective && (
            <p className="mt-1.5 text-sm text-text-secondary leading-relaxed max-w-2xl">
              {project.one_line_objective}
            </p>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-text-secondary">
            {lead && (
              <div className="flex items-center gap-1.5">
                <span
                  className="flex h-5 w-5 items-center justify-center rounded-full bg-surface-3 text-[9px] font-semibold text-text-secondary"
                  aria-hidden
                >
                  {leadInitials}
                </span>
                <span>
                  <span className="font-medium text-text-tertiary">리드 · </span>
                  {lead.name}
                </span>
              </div>
            )}

            {project.target_start_date && project.target_end_date && (
              <span className="text-text-tertiary">
                {fmtDate(project.target_start_date)} –{" "}
                {fmtDate(project.target_end_date)}
              </span>
            )}
          </div>
        </header>

        {/* ── Tab bar ─────────────────────────────────────────────────────── */}
        <nav
          className="mb-6 flex gap-1 border-b border-separator"
          aria-label="프로젝트 탭"
        >
          {(
            [
              { id: "workflow", label: "업무 흐름" },
              { id: "tasks", label: "업무" },
              { id: "milestones", label: "마일스톤" },
            ] as { id: Tab; label: string }[]
          ).map(({ id, label }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={activeTab === id}
              onClick={() => setActiveTab(id)}
              className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                activeTab === id
                  ? "border-accent text-text"
                  : "border-transparent text-text-secondary hover:text-text hover:border-border-strong"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>

        {/* ── Workflow tab — swimlane Kanban canvas ────────────────────────── */}
        {activeTab === "workflow" &&
          (tasks.some((t) => !t.cancelled_at) ? (
            <WorkflowCanvas
              tasks={tasks}
              workstreams={workstreams}
              members={members}
              onSelect={(t) => handleTaskClick(toTaskItem(t, members))}
            />
          ) : (
            <EmptyState
              icon={<ClipboardList className="h-5 w-5" aria-hidden />}
              title="등록된 업무가 없습니다"
              description="이 프로젝트에 추가된 업무가 업무 흐름 보드에 표시됩니다."
            />
          ))}

        {/* ── Tasks tab ────────────────────────────────────────────────────── */}
        {activeTab === "tasks" && (
          <div className="flex flex-col gap-6">
            {allActiveTaskItems.length > 0 ? (
              <>
                <section aria-label="진행 중인 업무">
                  <div className="mb-3 flex items-center gap-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">진행 중</h3>
                    <span className="flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-surface-2 px-1.5 text-[10px] font-semibold text-text-secondary">
                      {allActiveTaskItems.length}
                    </span>
                  </div>
                  <ul className="flex flex-col gap-2" role="list">
                    {allActiveTaskItems.map((task) => (
                      <li key={task.id}>
                        <TaskCard task={task} onClick={handleTaskClick} />
                      </li>
                    ))}
                  </ul>
                </section>

                {doneTaskItems.length > 0 && (
                  <section aria-label="완료한 업무">
                    <div className="mb-3 flex items-center gap-2">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">완료</h3>
                      <span className="flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-surface-2 px-1.5 text-[10px] font-semibold text-text-tertiary">
                        {doneTaskItems.length}
                      </span>
                    </div>
                    <ul className="flex flex-col gap-2 opacity-60" role="list">
                      {doneTaskItems.map((task) => (
                        <li key={task.id}>
                          <TaskCard task={task} onClick={handleTaskClick} />
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </>
            ) : (
              <EmptyState
                icon={<ClipboardList className="h-5 w-5" aria-hidden />}
                title="등록된 업무가 없습니다"
                description="이 프로젝트에 추가된 업무가 여기에 표시됩니다."
              />
            )}
          </div>
        )}

        {/* ── Milestones tab ───────────────────────────────────────────────── */}
        {activeTab === "milestones" && (
          <div>
            {milestones.length > 0 ? (
              <section aria-label="마일스톤">
                <div className="mb-3 flex items-center gap-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">마일스톤</h3>
                  <span className="flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-surface-2 px-1.5 text-[10px] font-semibold text-text-secondary">
                    {milestones.length}
                  </span>
                </div>
                <ul className="flex flex-col gap-2" role="list">
                  {milestones.map((ms) => (
                    <li
                      key={ms.id}
                      className="flex items-center justify-between rounded-lg border border-separator bg-surface px-4 py-3 text-sm shadow-sm"
                    >
                      <span className="font-medium text-text">{ms.name}</span>
                      <span className="text-xs text-text-secondary">
                        {fmtDate(ms.due_date)}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : (
              <EmptyState
                title="등록된 마일스톤이 없습니다"
                description="이 프로젝트의 마일스톤이 여기에 표시됩니다."
              />
            )}
          </div>
        )}
      </div>

      {/* ── Task detail panel ────────────────────────────────────────────── */}
      <TaskDetailPanel
        task={selectedTask}
        project={projectSummary}
        open={panelOpen}
        onOpenChange={setPanelOpen}
      />
    </>
  );
}
