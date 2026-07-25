"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui";
import TaskSection from "@/components/tasks/TaskSection";
import TaskDetailPanel from "@/components/tasks/TaskDetailPanel";
import InlineAdd from "@/components/tasks/InlineAdd";
import WorkflowCanvas, { type Focus } from "@/components/workflow/WorkflowCanvas";
import { useTaskController } from "@/components/tasks/useTaskController";
import { createTaskAction } from "@/app/actions/tasks";
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
  viewerName: string;
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
  viewerName,
  tasks,
  projects,
  workstreams,
  members,
}: HomeContentProps) {
  const router = useRouter();
  const controller = useTaskController(tasks);
  const { store } = controller;
  const [addOpen, setAddOpen] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [boardFocus, setBoardFocus] = useState<Focus>("all");
  // The board is the landing view. On a phone it is unreadable, so the personal
  // lists lead there instead; server and first client render agree on the board.
  const [showBoard, setShowBoard] = useState(true);

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

  async function quickAdd(title: string) {
    const result = await createTaskAction(title);
    if (!result.success) {
      setAddError(result.error ?? "업무를 추가하지 못했습니다.");
      return false;
    }
    setAddError(null);
    router.refresh();
    return true;
  }

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
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
        <header className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="font-serif text-2xl font-semibold leading-tight text-text">
              홈
            </h1>
            <p className="mt-1.5 text-sm text-text-secondary">
              {viewerName ? `${viewerName}님, ` : ""}
              지금 챙겨야 할 업무입니다.
            </p>
          </div>

          <Button
            variant="primary"
            onClick={() => setAddOpen((v) => !v)}
            className="flex-shrink-0"
          >
            <Plus aria-hidden />
            업무 추가
          </Button>
        </header>

        {addOpen && (
          <div className="mb-8">
            <InlineAdd
              onAdd={quickAdd}
              label="업무 추가"
              placeholder="해야 할 업무를 입력하고 Enter"
            />
            {addError && (
              <p role="alert" className="mt-2 text-xs text-flag-blocked">
                {addError}
              </p>
            )}
          </div>
        )}

        {store.error && (
          <p
            role="alert"
            className="mb-6 rounded-lg border border-flag-blocked/30 bg-flag-blocked/10 px-3 py-2 text-xs text-flag-blocked"
          >
            {store.error}
          </p>
        )}

        {/* The board leads: the whole workspace at a glance, grouped by
            project, before any personal list. */}
        {showBoard && boardTasks.length > 0 && (
          <section className="mb-10" aria-label="전체 업무 흐름">
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                업무 흐름
              </h2>
              <span className="text-xs text-text-tertiary">
                진행 중인 프로젝트 {projects.length}개 · 업무 {boardTasks.length}건
              </span>
            </div>
            <WorkflowCanvas
              tasks={boardTasks}
              workstreams={workstreams}
              members={membersRecord}
              projects={projects}
              defaultGroupBy="project"
              onSelect={controller.select}
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
        members={members}
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
    </>
  );
}
