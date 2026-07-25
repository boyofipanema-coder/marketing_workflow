"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Archive, MoreHorizontal, Pencil, RotateCcw } from "lucide-react";
import TaskList from "@/components/tasks/TaskList";
import InlineAdd from "@/components/tasks/InlineAdd";
import TaskDetailPanel from "@/components/tasks/TaskDetailPanel";
import { useTaskController } from "@/components/tasks/useTaskController";
import ProjectFormDialog from "@/components/projects/ProjectFormDialog";
import WorkstreamManager from "@/components/projects/WorkstreamManager";
import MilestoneManager from "@/components/projects/MilestoneManager";
import WorkflowCanvas from "@/components/workflow/WorkflowCanvas";
import EmptyState from "@/components/EmptyState";
import { createProjectTaskAction } from "@/app/actions/tasks";
import {
  archiveProjectAction,
  restoreProjectAction,
} from "@/app/actions/projects";
import type {
  Project,
  Task,
  Workstream,
  Member,
  Milestone,
} from "@/server/db/schema";

export interface ProjectWorkspaceProps {
  project: Project;
  workstreams: Workstream[];
  tasks: Task[];
  members: Record<string, Member>;
  milestones: Milestone[];
  viewerId: string;
  /** Projects the task detail panel can move a task into. */
  allProjects: Project[];
  /** Workstreams across the workspace, for the detail panel's picker. */
  allWorkstreams: Workstream[];
}

type Tab = "tasks" | "workflow" | "settings";

const TABS: { id: Tab; label: string }[] = [
  { id: "tasks", label: "업무" },
  { id: "workflow", label: "업무 흐름" },
  { id: "settings", label: "영역·마일스톤" },
];

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });
}

export default function ProjectWorkspace({
  project,
  workstreams,
  tasks,
  members,
  milestones,
  viewerId,
  allProjects,
  allWorkstreams,
}: ProjectWorkspaceProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("tasks");
  const [editOpen, setEditOpen] = useState(false);
  const [projectError, setProjectError] = useState<string | null>(null);

  const controller = useTaskController(tasks);
  const { store } = controller;

  // Refresh on focus so a change made in another tab shows up on return.
  useEffect(() => {
    function onFocus() {
      router.refresh();
    }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [router]);

  const memberList = Object.values(members);
  const lead = project.project_lead_id
    ? members[project.project_lead_id]
    : undefined;
  const archived = project.archived_at !== null;

  async function addTask(title: string) {
    const result = await createProjectTaskAction(project.id, title);
    if (!result.success) {
      setProjectError(result.error ?? "업무를 추가하지 못했습니다.");
      return false;
    }
    setProjectError(null);
    router.refresh();
    return true;
  }

  async function toggleArchive() {
    const result = archived
      ? await restoreProjectAction(project.id)
      : await archiveProjectAction(project.id);
    if (!result.success) {
      setProjectError(result.error ?? "처리하지 못했습니다.");
      return;
    }
    setProjectError(null);
    router.refresh();
  }

  const visibleTasks = controller.tasks.filter(
    (t) => t.parent_task_id === null
  );

  return (
    <>
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
        {/* Header */}
        <header className="mb-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h1 className="font-serif text-2xl font-semibold leading-tight text-text">
                {project.name}
              </h1>
              {project.one_line_objective && (
                <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-text-secondary">
                  {project.one_line_objective}
                </p>
              )}
            </div>

            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button
                  type="button"
                  aria-label="프로젝트 추가 작업"
                  className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <MoreHorizontal className="h-4 w-4" aria-hidden />
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  align="end"
                  sideOffset={4}
                  className="z-50 min-w-[11rem] rounded-lg border border-separator bg-elevated p-1 shadow-xl"
                >
                  <DropdownMenu.Item
                    onSelect={() => setEditOpen(true)}
                    disabled={archived}
                    className="flex cursor-pointer items-center gap-2 rounded px-2 py-2 text-sm text-text outline-none data-[disabled]:opacity-40 data-[highlighted]:bg-surface-2"
                  >
                    <Pencil className="h-3.5 w-3.5" aria-hidden />
                    프로젝트 수정
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    onSelect={() => void toggleArchive()}
                    className="flex cursor-pointer items-center gap-2 rounded px-2 py-2 text-sm text-text outline-none data-[highlighted]:bg-surface-2"
                  >
                    {archived ? (
                      <>
                        <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                        보관 해제
                      </>
                    ) : (
                      <>
                        <Archive className="h-3.5 w-3.5" aria-hidden />
                        프로젝트 보관
                      </>
                    )}
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-text-secondary">
            {archived && (
              <span className="rounded-full border border-separator bg-surface-2 px-2.5 py-0.5 font-medium text-text-tertiary">
                보관됨
              </span>
            )}
            {lead && <span>리드 · {lead.name}</span>}
            {project.target_start_date && project.target_end_date && (
              <span className="tabular-nums text-text-tertiary">
                {fmtDate(project.target_start_date)} –{" "}
                {fmtDate(project.target_end_date)}
              </span>
            )}
          </div>

          {(projectError || store.error) && (
            <p
              role="alert"
              className="mt-3 rounded-lg border border-flag-blocked/30 bg-flag-blocked/10 px-3 py-2 text-xs text-flag-blocked"
            >
              {projectError ?? store.error}
            </p>
          )}
        </header>

        {/* Tabs */}
        <nav
          className="mb-4 flex gap-1 border-b border-separator"
          aria-label="프로젝트 탭"
        >
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={activeTab === id}
              onClick={() => setActiveTab(id)}
              className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                activeTab === id
                  ? "border-accent text-text"
                  : "border-transparent text-text-secondary hover:border-border-strong hover:text-text"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>

        {activeTab === "tasks" && (
          <TaskList
            tasks={visibleTasks}
            members={members}
            store={store}
            selectedId={controller.selectedId}
            onSelect={controller.select}
            onToggleComplete={controller.toggleComplete}
            onCancel={controller.cancel}
            onRestore={controller.restore}
            onReorder={controller.reorder}
            emptyTitle="아직 업무가 없습니다"
            emptyDescription="아래 입력란에 제목만 적어도 업무가 만들어집니다."
            footer={
              archived ? undefined : (
                <InlineAdd onAdd={addTask} label="업무 추가" />
              )
            }
          />
        )}

        {activeTab === "workflow" &&
          (visibleTasks.some((t) => !t.cancelled_at) ? (
            <WorkflowCanvas
              tasks={controller.tasks}
              workstreams={workstreams}
              members={members}
              onSelect={controller.select}
            />
          ) : (
            <EmptyState
              title="표시할 업무가 없습니다"
              description="업무 탭에서 업무를 추가하면 흐름 보드에 나타납니다."
            />
          ))}

        {activeTab === "settings" && (
          <div className="flex flex-col gap-8">
            <WorkstreamManager
              projectId={project.id}
              workstreams={workstreams}
            />
            <div className="flex flex-col gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                마일스톤
              </h3>
              <MilestoneManager
                projectId={project.id}
                milestones={milestones}
              />
            </div>
          </div>
        )}
      </div>

      <TaskDetailPanel
        task={controller.selected}
        projects={allProjects}
        workstreams={allWorkstreams}
        members={memberList}
        open={controller.panelOpen}
        saveState={
          controller.selected ? store.stateOf(controller.selected.id) : "idle"
        }
        error={store.error}
        conflict={store.conflict}
        onOpenChange={(open) => {
          controller.setPanelOpen(open);
          if (!open) store.dismissError();
        }}
        onPatch={controller.patch}
        onCancelTask={controller.cancel}
        onRestoreTask={controller.restore}
      />

      <ProjectFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        members={memberList}
        project={project}
        defaultLeadId={viewerId}
        onSaved={() => router.refresh()}
      />
    </>
  );
}
