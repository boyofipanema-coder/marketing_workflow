"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Inbox as InboxIcon } from "lucide-react";
import TaskDetailPanel from "@/components/tasks/TaskDetailPanel";
import TaskRow from "@/components/tasks/TaskRow";
import InlineAdd from "@/components/tasks/InlineAdd";
import EmptyState from "@/components/EmptyState";
import { useTaskController } from "@/components/tasks/useTaskController";
import { createTaskAction } from "@/app/actions/tasks";
import { todayKST } from "@/lib/derive";
import type { Task, Project, Workstream, Member } from "@/server/db/schema";

export interface InboxContentProps {
  tasks: Task[];
  projects: Project[];
  workstreams: Workstream[];
  members: Member[];
}

const selectClass =
  "h-9 rounded-lg border border-border bg-surface px-2 text-sm text-text focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30";

/**
 * Team Inbox — everything captured but not yet filed under a project.
 *
 * Each row carries the two fields that get a task out of the Inbox (project and
 * owner) so triage happens in place, without opening the detail panel.
 */
export default function InboxContent({
  tasks,
  projects,
  workstreams,
  members,
}: InboxContentProps) {
  const router = useRouter();
  const controller = useTaskController(tasks);
  const { store } = controller;
  const [addError, setAddError] = useState<string | null>(null);

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
  const today = useMemo(() => todayKST(new Date()), []);

  // A task leaves this screen the moment it gets a project, which is exactly
  // what "clearing the inbox" should feel like.
  const inboxTasks = controller.tasks.filter(
    (t) => t.project_id === null && t.cancelled_at === null
  );

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

  return (
    <>
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold leading-tight text-text">
            팀 인박스
          </h1>
          <p className="mt-1.5 text-sm text-text-secondary">
            아직 프로젝트에 배정되지 않은 업무 {inboxTasks.length}건입니다.
            프로젝트와 담당자를 지정하면 실행 업무로 넘어갑니다.
          </p>
        </header>

        {(store.error || addError) && (
          <p
            role="alert"
            className="mb-4 rounded-lg border border-flag-blocked/30 bg-flag-blocked/10 px-3 py-2 text-xs text-flag-blocked"
          >
            {addError ?? store.error}
          </p>
        )}

        {inboxTasks.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-surface-2/40">
            <EmptyState
              icon={<InboxIcon className="h-5 w-5" aria-hidden />}
              title="인박스가 비었습니다"
              description="빠르게 적어 둔 업무가 여기에 모입니다."
            />
          </div>
        ) : (
          <ul className="flex flex-col gap-1" role="list">
            {inboxTasks.map((task) => (
              <li
                key={task.id}
                className="rounded-lg border border-separator bg-surface"
              >
                <TaskRow
                  task={task}
                  members={membersRecord}
                  today={today}
                  saveState={store.stateOf(task.id)}
                  selected={controller.selectedId === task.id}
                  onSelect={controller.select}
                  onToggleComplete={controller.toggleComplete}
                  onCancel={controller.cancel}
                  onRestore={controller.restore}
                />

                {/* Triage row — the minimum needed to file the task. */}
                <div className="flex flex-wrap items-center gap-2 border-t border-separator px-3 py-2">
                  <select
                    value=""
                    aria-label={`${task.title} 프로젝트 지정`}
                    className={selectClass}
                    onChange={(e) => {
                      if (!e.target.value) return;
                      void controller.patch(task, {
                        project_id: e.target.value,
                        status: "ToDo",
                      });
                    }}
                  >
                    <option value="">프로젝트 지정…</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>

                  <select
                    value={task.assignee_id ?? ""}
                    aria-label={`${task.title} 담당자`}
                    className={selectClass}
                    onChange={(e) =>
                      void controller.patch(task, {
                        assignee_id: e.target.value || null,
                      })
                    }
                  >
                    <option value="">담당자 미지정</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>

                  <input
                    type="date"
                    value={task.due_date ?? ""}
                    aria-label={`${task.title} 마감일`}
                    className={selectClass}
                    onChange={(e) =>
                      void controller.patch(task, {
                        due_date: e.target.value || null,
                      })
                    }
                  />
                </div>
              </li>
            ))}
          </ul>
        )}

        {projects.length === 0 && inboxTasks.length > 0 && (
          <p className="mt-3 text-xs text-text-tertiary">
            먼저 프로젝트를 하나 만들면 인박스 업무를 옮길 수 있습니다.
          </p>
        )}

        <div className="mt-3">
          <InlineAdd onAdd={quickAdd} label="인박스에 업무 추가" />
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
    </>
  );
}
