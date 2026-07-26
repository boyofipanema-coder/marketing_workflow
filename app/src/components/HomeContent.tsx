"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Briefcase, FolderPlus, Plus, Tags, ChevronDown } from "lucide-react";
import TaskSection from "@/components/tasks/TaskSection";
import TaskDetailPanel from "@/components/tasks/TaskDetailPanel";
import TaskFormDialog from "@/components/tasks/TaskFormDialog";
import WorkflowCanvas, { type Focus } from "@/components/workflow/WorkflowCanvas";
import EmptyState from "@/components/EmptyState";
import { useTaskController } from "@/components/tasks/useTaskController";
import BrandFormDialog from "@/components/projects/BrandFormDialog";
import ProjectFormDialog from "@/components/projects/ProjectFormDialog";
import { Button } from "@/components/ui";
import {
  myFocus,
  needsAttention,
  comingNext,
  teamInMotion,
  teamWaiting,
} from "@/lib/derive";
import type { Task, Brand, Project, Workstream, Member } from "@/server/db/schema";

export interface HomeContentProps {
  viewerId: string;
  tasks: Task[];
  brands: Brand[];
  projects: Project[];
  workstreams: Workstream[];
  members: Member[];
  dependencies?: Record<string, string[]>;
}

/**
 * Home — the "what needs me right now" screen.
 *
 * Sections are computed from the client-side task list rather than server-side,
 * so completing or rescheduling a task moves it between sections immediately
 * instead of waiting for a round trip.
 */
export default function HomeContent({
  viewerId,
  tasks,
  brands,
  projects,
  workstreams,
  members,
  dependencies,
}: HomeContentProps) {
  const router = useRouter();
  const controller = useTaskController(tasks);
  const { store } = controller;
  const [boardFocus, setBoardFocus] = useState<Focus>("all");
  // The board is the landing view. On a phone it is unreadable, so the personal
  // lists lead there instead; server and first client render agree on the board.
  const [showBoard, setShowBoard] = useState(true);
  const [brandDialogOpen, setBrandDialogOpen] = useState(false);
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [projectBrandId, setProjectBrandId] = useState<string | undefined>();
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [brandFilterId, setBrandFilterId] = useState("all");
  const [taskProjectId, setTaskProjectId] = useState<string | null>(null);

  useEffect(() => {
    if (window.matchMedia("(max-width: 640px)").matches) setShowBoard(false);
  }, []);

  useEffect(() => {
    function onFocus() {
      router.refresh();
    }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [router]);

  const membersRecord = useMemo(
    () => Object.fromEntries(members.map((m) => [m.id, m])),
    [members]
  );

  const sections = useMemo(() => {
    const now = new Date();
    const active = controller.tasks;
    return {
      focus: myFocus(active, viewerId),
      // "Team in motion" is what other people are on — my own in-progress work
      // is already the section above it.
      motion: teamInMotion(active).filter((t) => t.assignee_id !== viewerId),
      waiting: teamWaiting(active),
      attention: needsAttention(active, now),
      next: comingNext(active, now),
    };
  }, [controller.tasks, viewerId]);

  const boardTasks = useMemo(
    () => controller.tasks.filter((t) => !t.cancelled_at),
    [controller.tasks]
  );
  const visibleProjects = useMemo(
    () =>
      brandFilterId === "all"
        ? projects
        : projects.filter((project) => project.brand_id === brandFilterId),
    [brandFilterId, projects]
  );
  const visibleBrands = useMemo(
    () =>
      brandFilterId === "all"
        ? brands
        : brands.filter((brand) => brand.id === brandFilterId),
    [brandFilterId, brands]
  );
  const visibleProjectIds = useMemo(
    () => new Set(visibleProjects.map((project) => project.id)),
    [visibleProjects]
  );
  const visibleBoardTasks = useMemo(
    () =>
      brandFilterId === "all"
        ? boardTasks
        : boardTasks.filter(
            (task) => task.project_id && visibleProjectIds.has(task.project_id)
          ),
    [boardTasks, brandFilterId, visibleProjectIds]
  );

  const shared = {
    members: membersRecord,
    store,
    selectedId: controller.selectedId,
    onSelect: controller.select,
    onToggleComplete: controller.toggleComplete,
    onCancel: controller.cancel,
    onRestore: controller.restore,
    onToggleKey: controller.toggleKey,
  };

  function startProject(brandId?: string) {
    setEditingProject(null);
    setProjectBrandId(
      brandId ?? (brandFilterId !== "all" ? brandFilterId : brands[0]?.id)
    );
    setProjectDialogOpen(true);
  }

  return (
    <>
      <div className="mx-auto max-w-5xl px-4 pb-4 sm:px-6">
        {store.error && (
          <p
            role="alert"
            className="mb-6 rounded-lg border border-flag-blocked/30 bg-flag-blocked/10 px-3 py-2 text-xs text-flag-blocked"
          >
            {store.error}
          </p>
        )}

        {/* A workspace with no projects yet has nothing for the board to
            group by — offer the one thing that unblocks it, independent of
            whether a stray quick-added task already exists in 미분류. */}
        {projects.length === 0 && (
          <div className="mb-10 rounded-xl border border-dashed border-border bg-surface-2/40">
            <EmptyState
              icon={<Briefcase className="h-5 w-5" aria-hidden />}
              title="아직 프로젝트가 없습니다"
              description="프로젝트를 만들면 업무를 갈래별로 정리하고 진행 상황을 함께 볼 수 있습니다."
              action={
                <Button variant="primary" onClick={() => startProject()}>
                  <Plus aria-hidden />
                  첫 프로젝트 만들기
                </Button>
              }
            />
          </div>
        )}

        {/* The board leads: the whole workspace at a glance. Brand is the
            default hierarchy; owner and due-date remain available as pivots. */}
        {showBoard && (brands.length > 0 || projects.length > 0 || boardTasks.length > 0) && (
          <section className="mb-10" aria-label="전체 업무 흐름">
            <WorkflowCanvas
              tasks={visibleBoardTasks}
              brands={visibleBrands}
              workstreams={workstreams}
              members={membersRecord}
              projects={visibleProjects}
              defaultGroupBy="brand"
              hierarchyMode
              onSelect={controller.select}
              onAddProject={(brandId) => startProject(brandId)}
              onAddProjectTask={setTaskProjectId}
              onEditProject={setEditingProject}
              focus={boardFocus}
              onFocusChange={setBoardFocus}
              dependencies={dependencies}
              toolbarHeader={
                <div className="flex flex-wrap items-center gap-3">
                  <div className="mr-auto min-w-0">
                    <h1 className="text-[15px] font-semibold tracking-tight text-text">
                      업무 보드
                    </h1>
                    <p className="mt-0.5 truncate text-[11px] font-medium tabular-nums text-text-tertiary">
                      브랜드 {visibleBrands.length} · 프로젝트 {visibleProjects.length} · 업무{" "}
                      {visibleBoardTasks.length}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="material-thin relative inline-flex h-9 items-center gap-2 rounded-xl pl-3 pr-8 text-xs font-semibold text-text-secondary shadow-xs">
                      <Tags className="size-3.5 text-text-tertiary" aria-hidden />
                      <span className="sr-only">브랜드별 업무 필터</span>
                      <select
                        aria-label="브랜드별 업무 필터"
                        value={brandFilterId}
                        onChange={(event) => setBrandFilterId(event.target.value)}
                        className="absolute inset-0 cursor-pointer appearance-none rounded-xl bg-transparent pl-8 pr-8 text-xs font-semibold text-text-secondary outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <option value="all">전체 브랜드</option>
                        {brands.map((brand) => (
                          <option key={brand.id} value={brand.id}>
                            {brand.name}
                          </option>
                        ))}
                      </select>
                      <span className="invisible">
                        {brandFilterId === "all"
                          ? "전체 브랜드"
                          : brands.find((brand) => brand.id === brandFilterId)?.name ??
                            "전체 브랜드"}
                      </span>
                      <ChevronDown className="pointer-events-none absolute right-2.5 size-3.5 text-text-tertiary" aria-hidden />
                    </label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setBrandDialogOpen(true)}
                      className="h-9 rounded-xl"
                    >
                      <Plus aria-hidden />
                      브랜드
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => startProject()}
                      disabled={brands.length === 0}
                      title={brands.length === 0 ? "브랜드를 먼저 만들어 주세요" : undefined}
                      className="h-9 rounded-xl"
                    >
                      <FolderPlus aria-hidden />
                      프로젝트
                    </Button>
                  </div>
                </div>
              }
            />
          </section>
        )}

        <div className="flex flex-col gap-8">
          {/* Only the first section shows an empty state — the rest disappear
              when empty so the page stays a short, scannable list. */}
          <TaskSection
            {...shared}
            title="내 우선 업무"
            tasks={sections.focus}
            emptyTitle="지금 진행 중인 내 업무가 없습니다"
            emptyDescription="진행 중이거나 검토 중인 내 업무가 여기에 표시됩니다."
          />

          <TaskSection
            {...shared}
            title="확인 필요"
            tasks={sections.attention}
            hideWhenEmpty
            emptyTitle=""
            emptyDescription=""
          />

          <TaskSection
            {...shared}
            title="대기 중"
            tasks={sections.waiting}
            hideWhenEmpty
            emptyTitle=""
            emptyDescription=""
          />

          <TaskSection
            {...shared}
            title="팀 진행 중"
            tasks={sections.motion}
            hideWhenEmpty
            emptyTitle=""
            emptyDescription=""
          />

          <TaskSection
            {...shared}
            title="다음 업무"
            tasks={sections.next}
            hideWhenEmpty
            emptyTitle=""
            emptyDescription=""
          />
        </div>
      </div>

      <TaskDetailPanel
        task={controller.selected}
        projects={projects}
        workstreams={workstreams}
        members={members}
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
        onCancelTask={controller.cancel}
        onRestoreTask={controller.restore}
      />

      <TaskFormDialog
        open={taskProjectId !== null}
        onOpenChange={(open) => {
          if (!open) setTaskProjectId(null);
        }}
        projects={projects}
        workstreams={workstreams}
        members={members}
        defaultProjectId={taskProjectId}
        onCreated={() => router.refresh()}
      />

      <BrandFormDialog
        open={brandDialogOpen}
        onOpenChange={setBrandDialogOpen}
        onSaved={() => router.refresh()}
      />

      <ProjectFormDialog
        open={projectDialogOpen || editingProject !== null}
        onOpenChange={(open) => {
          setProjectDialogOpen(open);
          if (!open) {
            setEditingProject(null);
            setProjectBrandId(undefined);
          }
        }}
        members={members}
        brands={brands}
        defaultBrandId={projectBrandId}
        project={editingProject}
        defaultLeadId={viewerId}
        onSaved={() => router.refresh()}
      />
    </>
  );
}
