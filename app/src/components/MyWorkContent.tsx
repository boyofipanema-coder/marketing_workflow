"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import TaskSection from "@/components/tasks/TaskSection";
import TaskDetailPanel from "@/components/tasks/TaskDetailPanel";
import { useTaskController } from "@/components/tasks/useTaskController";
import type { NotificationView } from "@/server/services/collaboration";
import type { Task, Project, Workstream, Member } from "@/server/db/schema";

export interface MyWorkContentProps {
  viewerId: string;
  viewerName: string;
  tasks: Task[];
  projects: Project[];
  workstreams: Workstream[];
  members: Member[];
  notifications: NotificationView[];
}

export default function MyWorkContent({
  viewerId,
  viewerName,
  tasks,
  projects,
  workstreams,
  members,
  notifications,
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

  const assignedTasks = useMemo(
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

  return (
    <>
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
        <header className="mb-8">
          <h1 className="text-2xl font-semibold leading-tight text-text">
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
          <TaskSection
            {...shared}
            title="내 업무"
            tasks={assignedTasks}
            emptyTitle="담당 중인 업무가 없습니다"
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
    </>
  );
}
