"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Archive, ChevronRight, MoreHorizontal, Pencil, Plus, RotateCcw } from "lucide-react";
import TaskList from "@/components/tasks/TaskList";
import TaskDetailPanel from "@/components/tasks/TaskDetailPanel";
import TaskFormDialog from "@/components/tasks/TaskFormDialog";
import { CommentSidecarButton } from "@/components/tasks/CommentThread";
import { useTaskController } from "@/components/tasks/useTaskController";
import ProjectFormDialog from "@/components/projects/ProjectFormDialog";
import WorkstreamManager from "@/components/projects/WorkstreamManager";
import MilestoneManager from "@/components/projects/MilestoneManager";
import WorkflowCanvas, { type Focus } from "@/components/workflow/WorkflowCanvas";
import ProjectPulse from "@/components/projects/ProjectPulse";
import MobileFlowSpine from "@/components/workflow/MobileFlowSpine";
import { createMilestoneAction } from "@/app/actions/milestones";
import {
  archiveProjectAction,
  restoreProjectAction,
} from "@/app/actions/projects";
import { isMilestone } from "@/lib/board-graph";
import { todayKST } from "@/lib/derive";
import { summarizeProjectWorkflow } from "@/lib/workflow-summary";
import type { Brand, Project, Task, Workstream, Member } from "@/server/db/schema";

export interface ProjectWorkspaceProps {
  project: Project;
  workstreams: Workstream[];
  tasks: Task[];
  members: Record<string, Member>;
  /** Milestone-kind tasks for this project. Also present in `tasks`. */
  milestones: Task[];
  viewerId: string;
  /** Projects the task detail panel can move a task into. */
  allProjects: Project[];
  /** Workstreams across the workspace, for the detail panel's picker. */
  allWorkstreams: Workstream[];
  brands: Brand[];
  dependencies?: Record<string, string[]>;
}

type Tab = "workflow" | "tasks" | "settings";

// The board leads: opening a project should answer "what is moving, what is
// stuck" before it offers a list to edit. The list stays one click away for the
// times you actually want to work through items in order.
const TABS: { id: Tab; label: string }[] = [
  { id: "workflow", label: "업무 흐름" },
  { id: "tasks", label: "목록" },
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
  brands,
  dependencies,
}: ProjectWorkspaceProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("workflow");
  const [boardFocus, setBoardFocus] = useState<Focus>("all");
  const [editOpen, setEditOpen] = useState(false);
  const [taskCreateOpen, setTaskCreateOpen] = useState(false);
  const [taskParent, setTaskParent] = useState<Task | null>(null);
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
  const projectBrand = brands.find((brand) => brand.id === project.brand_id);
  const archived = project.archived_at !== null;

  function startTask(parent: Task | null = null) {
    setTaskParent(parent);
    setTaskCreateOpen(true);
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

  // The list is a list of work. Milestones live on the board's rail and in the
  // 영역·마일스톤 tab, so they never show up here as ordinary rows.
  const visibleTasks = controller.tasks.filter(
    (t) => t.parent_task_id === null && !isMilestone(t)
  );
  const mobileSummary = useMemo(
    () => summarizeProjectWorkflow(project, controller.tasks, workstreams, todayKST(new Date())),
    [controller.tasks, project, workstreams],
  );

  return (
    <>
      <div className="mx-auto max-w-5xl px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-6 sm:px-6 sm:py-8">
        {/* Header */}
        <header className="mb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              {projectBrand && (
                <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-text-tertiary">
                  <span className="size-2 rounded-[3px]" style={{ background: projectBrand.color }} />
                  {projectBrand.name}
                  <ChevronRight className="size-3" aria-hidden />
                  프로젝트
                </div>
              )}
              <h1 className="text-2xl font-semibold leading-snug text-text [word-break:keep-all]">
                {project.name}
              </h1>
              {project.one_line_objective && (
                <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-text-secondary [word-break:keep-all]">
                  {project.one_line_objective}
                </p>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-1">
              <CommentSidecarButton
                target={{ type: "project", id: project.id }}
                title={project.name}
                members={memberList}
              />
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

        {/* The one-glance read, above the tabs so it frames whichever view is
            open. Its counts double as entry points into the board. */}
        {activeTab !== "settings" && (
          <ProjectPulse
            tasks={controller.tasks}
            milestones={milestones}
            onFocus={(next) => {
              setActiveTab("workflow");
              setBoardFocus(next);
            }}
          />
        )}

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
              className={`-mb-px min-h-12 flex-1 border-b-2 px-2 py-2.5 text-sm font-medium transition-colors sm:flex-none sm:px-4 ${
                activeTab === id
                  ? "border-accent text-text"
                  : "border-transparent text-text-secondary hover:border-border-strong hover:text-text"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>

        {activeTab === "workflow" && (
          <>
          <div className="sm:hidden">
            {mobileSummary.counts.total > 0 ? (
              <MobileFlowSpine
                summary={mobileSummary}
                members={members}
                today={todayKST(new Date())}
                onSelect={controller.select}
              />
            ) : (
              <p className="rounded-xl bg-surface-2 px-4 py-6 text-center text-sm text-text-secondary">
                아직 등록된 업무가 없습니다
              </p>
            )}
            {!archived && (
              <button
                type="button"
                onClick={() => startTask()}
                className="mt-5 inline-flex min-h-12 items-center gap-2 rounded-xl bg-text px-4 text-sm font-semibold text-bg transition-transform active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Plus className="size-4" aria-hidden />
                업무 추가
              </button>
            )}
          </div>
          <div className="hidden sm:block">
              {visibleTasks.length > 0 ? (
                <WorkflowCanvas
                  tasks={controller.tasks}
                  workstreams={workstreams}
                  members={members}
                  onSelect={controller.select}
                  onAddTask={archived ? undefined : () => startTask()}
                  onAddSubtask={archived ? undefined : startTask}
                  focus={boardFocus}
                  onFocusChange={setBoardFocus}
                  projectId={project.id}
                  dependencies={dependencies}
                  onAddMilestone={async (pid, name, due) => {
                    const r = await createMilestoneAction(pid, name, due);
                    if (!r.success) setProjectError(r.error ?? "마일스톤을 추가하지 못했습니다.");
                    return r.success;
                  }}
                />
              ) : (
                <div className="rounded-xl border border-dashed border-border bg-surface-2/40 px-6 py-12">
                  <div className="mx-auto flex max-w-sm flex-col items-center gap-4 text-center">
                    <h3 className="text-sm font-medium text-text-secondary">
                      아직 업무가 없습니다
                    </h3>
                    <p className="text-xs leading-relaxed text-text-tertiary">
                      업무를 추가하면 업무 영역별 진행 단계가 한눈에 보이는
                      흐름 보드가 만들어집니다.
                    </p>
                    {!archived && (
                      <button
                        type="button"
                        onClick={() => startTask()}
                        className="inline-flex h-10 items-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-white shadow-sm transition-[background-color,transform] hover:bg-accent-hover active:scale-[0.98]"
                      >
                        <Plus className="size-4" aria-hidden />
                        첫 업무 추가
                      </button>
                    )}
                  </div>
                </div>
              )}
          </div>
          </>
        )}

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
            onToggleKey={controller.toggleKey}
            onReorder={controller.reorder}
            emptyTitle="아직 업무가 없습니다"
            emptyDescription="아래 입력란에 제목만 적어도 업무가 만들어집니다."
            footer={
              archived ? undefined : (
                <button
                  type="button"
                  onClick={() => startTask()}
                  className="material-thin inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-text-secondary shadow-xs transition-[transform,color,box-shadow] hover:text-text hover:shadow-sm active:scale-[0.98]"
                >
                  <Plus className="size-4" aria-hidden />
                  업무 추가
                </button>
              )
            }
          />
        )}

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

      <TaskFormDialog
        open={taskCreateOpen}
        onOpenChange={(open) => {
          setTaskCreateOpen(open);
          if (!open) setTaskParent(null);
        }}
        projects={allProjects}
        workstreams={allWorkstreams}
        members={memberList}
        defaultAssigneeId={viewerId}
        defaultProjectId={project.id}
        defaultParentTask={taskParent}
        onCreated={() => {
          setProjectError(null);
          router.refresh();
        }}
      />

      <ProjectFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        members={memberList}
        brands={brands}
        project={project}
        defaultLeadId={viewerId}
        onSaved={() => router.refresh()}
      />
    </>
  );
}
