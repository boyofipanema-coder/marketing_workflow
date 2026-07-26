"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Briefcase, Plus } from "lucide-react";
import TaskSection from "@/components/tasks/TaskSection";
import TaskDetailPanel from "@/components/tasks/TaskDetailPanel";
import WorkflowCanvas, { type Focus } from "@/components/workflow/WorkflowCanvas";
import EmptyState from "@/components/EmptyState";
import ProjectFormDialog from "@/components/projects/ProjectFormDialog";
import { Button } from "@/components/ui";
import { useTaskController } from "@/components/tasks/useTaskController";
import {
  myFocus,
  needsAttention,
  comingNext,
  teamInMotion,
  teamWaiting,
} from "@/lib/derive";
import type { Task, Project, Workstream, Member } from "@/server/db/schema";

export interface HomeContentProps {
  viewerId: string;
  tasks: Task[];
  projects: Project[];
  workstreams: Workstream[];
  members: Member[];
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
  projects,
  workstreams,
  members,
}: HomeContentProps) {
  const router = useRouter();
  const controller = useTaskController(tasks);
  const { store } = controller;
  const [boardFocus, setBoardFocus] = useState<Focus>("all");
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

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

  return (
    <>
      {/* No page title. "홈" is already the selected item in the nav, and a
          2rem serif heading plus a greeting cost ~150px of the workspace to
          repeat something the user just clicked. The board starts here. */}
      <div className="mx-auto max-w-5xl px-4 py-3 sm:px-6 sm:py-4">
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
                <Button variant="primary" onClick={() => setShowProjectForm(true)}>
                  <Plus aria-hidden />
                  첫 프로젝트 만들기
                </Button>
              }
            />
          </div>
        )}

        {/* The board leads: the whole workspace at a glance, grouped by
            project, before any personal list. Renders once there's a project
            to group by, or a task to show, even if the other count is zero. */}
        {(boardTasks.length > 0 || projects.length > 0) && (
          <section className="mb-10" aria-label="전체 업무 흐름">
            <WorkflowCanvas
              tasks={boardTasks}
              workstreams={workstreams}
              members={membersRecord}
              projects={projects}
              defaultGroupBy="project"
              onSelect={controller.select}
              onEditProject={setEditingProject}
              focus={boardFocus}
              onFocusChange={setBoardFocus}
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

      <ProjectFormDialog
        open={showProjectForm || editingProject !== null}
        onOpenChange={(o) => {
          if (!o) {
            setShowProjectForm(false);
            setEditingProject(null);
          }
        }}
        members={members}
        project={editingProject}
        defaultLeadId={viewerId}
        onSaved={() => router.refresh()}
      />
    </>
  );
}
