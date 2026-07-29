"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Briefcase, Check, ChevronDown, FolderPlus, Plus, Tags } from "lucide-react";
import TaskSection from "@/components/tasks/TaskSection";
import TaskDetailPanel from "@/components/tasks/TaskDetailPanel";
import TaskFormDialog from "@/components/tasks/TaskFormDialog";
import StackedWorkflowBoard, {
  type BoardFocus,
} from "@/components/workflow/StackedWorkflowBoard";
import MobileWorkflowOverview from "@/components/workflow/MobileWorkflowOverview";
import EmptyState from "@/components/EmptyState";
import { useTaskController } from "@/components/tasks/useTaskController";
import BrandFormDialog from "@/components/projects/BrandFormDialog";
import ProjectFormDialog from "@/components/projects/ProjectFormDialog";
import { Button } from "@/components/ui";
import { summarizeWorkspaceWorkflow } from "@/lib/workflow-summary";
import type { Task, Brand, Project, Workstream, Member } from "@/server/db/schema";
import type { NotificationView } from "@/server/services/collaboration";

export interface HomeContentProps {
  viewerId: string;
  tasks: Task[];
  brands: Brand[];
  projects: Project[];
  workstreams: Workstream[];
  members: Member[];
  notifications: NotificationView[];
  dependencies?: Record<string, string[]>;
  today: string;
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
  notifications,
  dependencies,
  today,
}: HomeContentProps) {
  const router = useRouter();
  const controller = useTaskController(tasks);
  const { store } = controller;
  const [boardFocus, setBoardFocus] = useState<BoardFocus>("all");
  const [brandDialogOpen, setBrandDialogOpen] = useState(false);
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [projectBrandId, setProjectBrandId] = useState<string | undefined>();
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  // An empty selection means "all brands". This gives the filter a safe,
  // useful fallback when the final checked brand is cleared.
  const [brandFilterIds, setBrandFilterIds] = useState<string[]>([]);
  const [taskProjectId, setTaskProjectId] = useState<string | null>(null);
  const [taskParent, setTaskParent] = useState<Task | null>(null);

  useEffect(() => {
    function onFocus() {
      router.refresh();
    }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [router]);

  useEffect(() => {
    setBrandFilterIds((current) => {
      const availableIds = new Set(brands.map((brand) => brand.id));
      const next = current.filter((id) => availableIds.has(id));
      return next.length === current.length ? current : next;
    });
  }, [brands]);

  const membersRecord = useMemo(
    () => Object.fromEntries(members.map((m) => [m.id, m])),
    [members]
  );
  const unreadComments = useMemo(
    () =>
      notifications.reduce<Record<string, number>>((counts, item) => {
        if (item.read_at) return counts;
        const key = `${item.target_type}:${item.target_id}`;
        counts[key] = (counts[key] ?? 0) + 1;
        return counts;
      }, {}),
    [notifications],
  );

  const personalTasks = useMemo(
    () =>
      controller.tasks
        .filter(
          (task) =>
            task.assignee_id === viewerId &&
            task.kind !== "milestone" &&
            !task.cancelled_at,
        )
        .sort((a, b) => {
          if (!a.due_date) return 1;
          if (!b.due_date) return -1;
          return a.due_date.localeCompare(b.due_date);
        }),
    [controller.tasks, viewerId],
  );

  const boardTasks = useMemo(
    () => controller.tasks.filter((t) => !t.cancelled_at),
    [controller.tasks]
  );
  const visibleProjects = useMemo(
    () =>
      brandFilterIds.length === 0
        ? projects
        : projects.filter(
            (project) => project.brand_id && brandFilterIds.includes(project.brand_id)
          ),
    [brandFilterIds, projects]
  );
  const visibleBrands = useMemo(
    () =>
      brandFilterIds.length === 0
        ? brands
        : brands.filter((brand) => brandFilterIds.includes(brand.id)),
    [brandFilterIds, brands]
  );
  const visibleProjectIds = useMemo(
    () => new Set(visibleProjects.map((project) => project.id)),
    [visibleProjects]
  );
  const visibleBoardTasks = useMemo(
    () =>
      brandFilterIds.length === 0
        ? boardTasks
        : boardTasks.filter(
            (task) => task.project_id && visibleProjectIds.has(task.project_id)
          ),
    [boardTasks, brandFilterIds, visibleProjectIds]
  );
  const brandFilterLabel = useMemo(() => {
    if (brandFilterIds.length === 0) return "전체 브랜드";
    if (brandFilterIds.length === 1) {
      return brands.find((brand) => brand.id === brandFilterIds[0])?.name ?? "전체 브랜드";
    }
    return `브랜드 ${brandFilterIds.length}개`;
  }, [brandFilterIds, brands]);
  const mobileWorkflowGroups = useMemo(
    () =>
      summarizeWorkspaceWorkflow(
        visibleBrands,
        visibleProjects,
        visibleBoardTasks,
        workstreams,
        today,
      ),
    [
      today,
      visibleBoardTasks,
      visibleBrands,
      visibleProjects,
      workstreams,
    ],
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
    unreadComments,
  };

  function startProject(brandId?: string) {
    setEditingProject(null);
    setProjectBrandId(
      brandId ?? (brandFilterIds.length === 1 ? brandFilterIds[0] : brands[0]?.id)
    );
    setProjectDialogOpen(true);
  }

  function toggleBrandFilter(brandId: string, checked: boolean) {
    setBrandFilterIds((current) => {
      if (checked) {
        return current.includes(brandId) ? current : [...current, brandId];
      }
      const next = current.filter((id) => id !== brandId);
      return next.length === 0 ? [] : next;
    });
  }

  return (
    <>
      <div className="mx-auto max-w-5xl px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:px-6 sm:pb-4">
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

        {mobileWorkflowGroups.length > 0 && (
          <MobileWorkflowOverview
            groups={mobileWorkflowGroups}
            members={membersRecord}
            today={today}
            onSelect={controller.select}
            unreadComments={unreadComments}
            onAddTask={(projectId) => {
              setTaskParent(null);
              setTaskProjectId(projectId);
            }}
          />
        )}

        {/* Desktop retains the spatial board. Mobile gets the same hierarchy
            as a readable vertical flow from the first render. */}
        {(brands.length > 0 || projects.length > 0 || boardTasks.length > 0) && (
          <section
            className="relative left-1/2 mb-10 hidden w-[min(1400px,calc(100vw-2rem))] -translate-x-1/2 md:block"
            aria-label="전체 업무 흐름"
          >
            <div className="mb-[18px] flex flex-wrap items-center gap-3 px-6">
              <div className="mr-auto min-w-0">
                <h1 className="text-xl font-semibold tracking-tight text-text">
                  업무 보드
                </h1>
                <p className="mt-0.5 truncate text-xs font-medium tabular-nums text-text-secondary">
                  브랜드 {visibleBrands.length} · 프로젝트 {visibleProjects.length} · 업무{" "}
                  {visibleBoardTasks.filter((task) => task.status !== "Done").length}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                    <DropdownMenu.Root>
                      <DropdownMenu.Trigger asChild>
                        <button
                          type="button"
                          aria-label="브랜드별 업무 필터"
                          className="material-thin inline-flex h-9 min-w-32 items-center gap-2 rounded-xl px-3 text-xs font-semibold text-text-secondary shadow-xs outline-none transition-[background-color,box-shadow,transform] duration-150 hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98]"
                        >
                          <Tags className="size-3.5 shrink-0 text-text-tertiary" aria-hidden />
                          <span className="max-w-32 truncate">{brandFilterLabel}</span>
                          <ChevronDown className="ml-auto size-3.5 shrink-0 text-text-tertiary" aria-hidden />
                        </button>
                      </DropdownMenu.Trigger>
                      <DropdownMenu.Portal>
                        <DropdownMenu.Content
                          align="end"
                          sideOffset={6}
                          collisionPadding={12}
                          className="z-[80] max-h-[min(70vh,28rem)] min-w-56 overflow-y-auto rounded-2xl border border-border/80 bg-elevated/95 p-1.5 shadow-xl backdrop-blur-xl data-[state=open]:animate-scale-in"
                        >
                          <DropdownMenu.CheckboxItem
                            checked={brandFilterIds.length === 0}
                            onCheckedChange={() => setBrandFilterIds([])}
                            onSelect={(event) => event.preventDefault()}
                            className="flex cursor-default select-none items-center gap-2.5 rounded-xl px-2.5 py-2 text-[13px] font-semibold text-text outline-none transition-colors data-[highlighted]:bg-accent data-[highlighted]:text-white"
                          >
                            <span
                              aria-hidden
                              className={`grid size-4 shrink-0 place-items-center rounded-[5px] border transition-colors ${
                                brandFilterIds.length === 0
                                  ? "border-accent bg-accent text-white"
                                  : "border-border bg-surface"
                              }`}
                            >
                              {brandFilterIds.length === 0 && <Check className="size-3" strokeWidth={3} />}
                            </span>
                            전체 브랜드
                          </DropdownMenu.CheckboxItem>
                          <DropdownMenu.Separator className="my-1 h-px bg-border/70" />
                          {brands.map((brand) => {
                            const checked = brandFilterIds.includes(brand.id);
                            return (
                              <DropdownMenu.CheckboxItem
                                key={brand.id}
                                checked={checked}
                                onCheckedChange={(nextChecked) =>
                                  toggleBrandFilter(brand.id, nextChecked === true)
                                }
                                onSelect={(event) => event.preventDefault()}
                                className="flex cursor-default select-none items-center gap-2.5 rounded-xl px-2.5 py-2 text-[13px] font-medium text-text outline-none transition-colors data-[highlighted]:bg-accent data-[highlighted]:text-white"
                              >
                                <span
                                  aria-hidden
                                  className={`grid size-4 shrink-0 place-items-center rounded-[5px] border transition-colors ${
                                    checked
                                      ? "border-accent bg-accent text-white"
                                      : "border-border bg-surface"
                                  }`}
                                >
                                  {checked && <Check className="size-3" strokeWidth={3} />}
                                </span>
                                <span
                                  className="size-2 shrink-0 rounded-full"
                                  style={{ backgroundColor: brand.color }}
                                  aria-hidden
                                />
                                <span className="truncate">{brand.name}</span>
                              </DropdownMenu.CheckboxItem>
                            );
                          })}
                        </DropdownMenu.Content>
                      </DropdownMenu.Portal>
                    </DropdownMenu.Root>
                    <DropdownMenu.Root>
                      <DropdownMenu.Trigger asChild>
                        <Button variant="primary" size="sm" className="h-9 rounded-xl">
                          <Plus aria-hidden />
                          만들기
                          <ChevronDown aria-hidden />
                        </Button>
                      </DropdownMenu.Trigger>
                      <DropdownMenu.Portal>
                        <DropdownMenu.Content
                          align="end"
                          sideOffset={6}
                          className="z-[80] min-w-44 rounded-xl border border-border bg-elevated p-1.5 shadow-xl"
                        >
                          <DropdownMenu.Item
                            onSelect={() => setBrandDialogOpen(true)}
                            className="flex cursor-default items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-text outline-none data-[highlighted]:bg-surface-2"
                          >
                            <Tags className="size-3.5" /> 브랜드
                          </DropdownMenu.Item>
                          <DropdownMenu.Item
                            disabled={brands.length === 0}
                            onSelect={() => startProject()}
                            className="flex cursor-default items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-text outline-none data-[disabled]:opacity-40 data-[highlighted]:bg-surface-2"
                          >
                            <FolderPlus className="size-3.5" /> 프로젝트
                          </DropdownMenu.Item>
                        </DropdownMenu.Content>
                      </DropdownMenu.Portal>
                    </DropdownMenu.Root>
              </div>
            </div>
            <StackedWorkflowBoard
              tasks={visibleBoardTasks}
              brands={visibleBrands}
              members={membersRecord}
              projects={visibleProjects}
              unreadComments={unreadComments}
              onSelect={controller.select}
              onToggleComplete={controller.toggleComplete}
              onAddProject={(brandId) => startProject(brandId)}
              onAddProjectTask={(projectId) => {
                setTaskParent(null);
                setTaskProjectId(projectId);
              }}
              onAddSubtask={(parent) => {
                setTaskParent(parent);
                setTaskProjectId(parent.project_id);
              }}
              onEditProject={setEditingProject}
              focus={boardFocus}
              onFocusChange={setBoardFocus}
            />
          </section>
        )}

        <div className="flex flex-col gap-8">
          <TaskSection
            {...shared}
            title="내 업무"
            tasks={personalTasks}
            emptyTitle="담당 업무가 없습니다"
            emptyDescription="나에게 배정된 업무가 여기에 표시됩니다."
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
        onToggleComplete={controller.toggleComplete}
        onCancelTask={controller.cancel}
        onRestoreTask={controller.restore}
      />

      <TaskFormDialog
        open={taskProjectId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setTaskProjectId(null);
            setTaskParent(null);
          }
        }}
        projects={projects}
        workstreams={workstreams}
        members={members}
        defaultAssigneeId={viewerId}
        defaultProjectId={taskProjectId}
        defaultParentTask={taskParent}
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
