"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import TaskSection from "@/components/tasks/TaskSection";
import TaskDetailPanel from "@/components/tasks/TaskDetailPanel";
import { useTaskController } from "@/components/tasks/useTaskController";
import {
  todayTasks,
  thisWeek,
  inProgress,
  waiting,
  review,
  later,
} from "@/lib/derive";
import type { Task, Project, Workstream, Member } from "@/server/db/schema";

export interface MyWorkContentProps {
  viewerId: string;
  viewerName: string;
  tasks: Task[];
  projects: Project[];
  workstreams: Workstream[];
  members: Member[];
}

export default function MyWorkContent({
  viewerId,
  viewerName,
  tasks,
  projects,
  workstreams,
  members,
}: MyWorkContentProps) {
  const router = useRouter();
  const controller = useTaskController(tasks);
  const { store } = controller;

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
      today: todayTasks(active, viewerId, now),
      week: thisWeek(active, viewerId, now),
      progress: inProgress(active, viewerId),
      waiting: waiting(active, viewerId),
      review: review(active, viewerId),
      later: later(active, viewerId),
    };
  }, [controller.tasks, viewerId]);

  const shared = {
    members: membersRecord,
    store,
    selectedId: controller.selectedId,
    onSelect: controller.select,
    onToggleComplete: controller.toggleComplete,
    onCancel: controller.cancel,
    onRestore: controller.restore,
  };

  const hasAny = Object.values(sections).some((s) => s.length > 0);

  return (
    <>
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
        <header className="mb-8">
          <h1 className="font-serif text-2xl font-semibold leading-tight text-text">
            내 업무
          </h1>
          <p className="mt-1.5 text-sm text-text-secondary">
            <span className="font-medium">{viewerName}</span>님의 담당 업무를
            긴급도 순으로 보여줍니다.
          </p>
        </header>

        {store.error && (
          <p
            role="alert"
            className="mb-6 rounded-lg border border-flag-blocked/30 bg-flag-blocked/10 px-3 py-2 text-xs text-flag-blocked"
          >
            {store.error}
          </p>
        )}

        <div className="flex flex-col gap-8">
          {/* With nothing assigned at all, six stacked empty states say nothing
              useful — show one, on the section that matters most. */}
          <TaskSection
            {...shared}
            title="오늘"
            tasks={sections.today}
            hideWhenEmpty={hasAny}
            emptyTitle="담당 중인 업무가 없습니다"
            emptyDescription="나에게 배정된 업무가 여기에 표시됩니다."
          />
          <TaskSection
            {...shared}
            title="이번 주"
            tasks={sections.week}
            hideWhenEmpty
            emptyTitle=""
            emptyDescription=""
          />
          <TaskSection
            {...shared}
            title="진행 중"
            tasks={sections.progress}
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
            title="검토 요청"
            tasks={sections.review}
            hideWhenEmpty
            emptyTitle=""
            emptyDescription=""
          />
          <TaskSection
            {...shared}
            title="나중에"
            tasks={sections.later}
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
