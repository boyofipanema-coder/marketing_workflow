"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import {
  X,
  Check,
  Loader2,
  AlertTriangle,
  RotateCcw,
  XCircle,
  CalendarClock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TASK_STATUSES, STATUS_META } from "@/lib/status";
import { todayKST } from "@/lib/derive";
import type { Task, Project, Workstream, Member } from "@/server/db/schema";
import { addDependencyAction, removeDependencyAction } from "@/app/actions/tasks";
import type { TaskPatchInput } from "@/app/actions/tasks";
import type { SaveState } from "./useTaskStore";

const DESCRIPTION_DEBOUNCE_MS = 600;

export interface TaskDetailPanelProps {
  task: Task | null;
  projects: Project[];
  /** Every workstream the viewer can see; filtered to the task's project here. */
  workstreams: Workstream[];
  members: Member[];
  /** All tasks, so a predecessor can be picked. Omit to hide the section. */
  allTasks?: Task[];
  /** successorId → predecessorId[]. */
  dependencies?: Record<string, string[]>;
  open: boolean;
  saveState: SaveState;
  /** Present when the last write lost a version race. */
  error: string | null;
  conflict: boolean;
  onOpenChange: (open: boolean) => void;
  onPatch: (task: Task, patch: TaskPatchInput) => Promise<boolean>;
  onCancelTask: (task: Task) => void;
  onRestoreTask: (task: Task) => void;
}

// ── Small building blocks ────────────────────────────────────────────────────

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={htmlFor}
        className="text-2xs font-semibold uppercase tracking-wider text-text-tertiary"
      >
        {label}
      </label>
      {children}
    </div>
  );
}

const selectClass =
  "h-10 w-full rounded-lg border border-border bg-surface px-3 text-base text-text transition-[border-color,box-shadow] duration-fast ease-out hover:border-border-strong focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30 disabled:opacity-50";

/** Adds `days` to a KST YYYY-MM-DD string. */
function shiftDate(base: string, days: number): string {
  const [y, m, d] = base.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

// ── Panel ────────────────────────────────────────────────────────────────────

export default function TaskDetailPanel({
  task,
  projects,
  workstreams,
  members,
  allTasks,
  dependencies,
  open,
  saveState,
  error,
  conflict,
  onOpenChange,
  onPatch,
  onCancelTask,
  onRestoreTask,
}: TaskDetailPanelProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  /** Set while composing a move into Waiting; null once it is saved. */
  const [waitDraft, setWaitDraft] = useState<{
    party: string;
    date: string;
  } | null>(null);
  const [depError, setDepError] = useState<string | null>(null);
  const router = useRouter();
  const descriptionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingDescription = useRef<string | null>(null);

  const today = useMemo(() => todayKST(new Date()), []);
  const cancelled = task?.cancelled_at !== null && task?.cancelled_at !== undefined;
  const readOnly = !task || cancelled;

  // Reset the local drafts whenever a different task — or a newer version of
  // the same task — arrives, so a server value never sits behind a stale draft.
  useEffect(() => {
    if (!task) return;
    setTitle(task.title);
    setDescription(task.description ?? "");
    setWaitDraft(null);
  }, [task?.id, task?.version]); // eslint-disable-line react-hooks/exhaustive-deps

  const projectWorkstreams = useMemo(
    () => workstreams.filter((w) => w.project_id === task?.project_id),
    [workstreams, task?.project_id]
  );

  function patch(next: TaskPatchInput) {
    if (!task) return Promise.resolve(false);
    return onPatch(task, next);
  }

  /** Commits any debounced description edit that has not fired yet. */
  function flushDescription() {
    if (descriptionTimer.current) {
      clearTimeout(descriptionTimer.current);
      descriptionTimer.current = null;
    }
    if (pendingDescription.current !== null) {
      const value = pendingDescription.current;
      pendingDescription.current = null;
      void patch({ description: value || null });
    }
  }

  function handleDescriptionChange(value: string) {
    setDescription(value);
    pendingDescription.current = value;
    if (descriptionTimer.current) clearTimeout(descriptionTimer.current);
    descriptionTimer.current = setTimeout(() => {
      descriptionTimer.current = null;
      pendingDescription.current = null;
      void patch({ description: value || null });
    }, DESCRIPTION_DEBOUNCE_MS);
  }

  // Closing the panel must not silently drop an in-flight description edit.
  function handleOpenChange(next: boolean) {
    if (!next) flushDescription();
    onOpenChange(next);
  }

  useEffect(() => {
    return () => {
      if (descriptionTimer.current) clearTimeout(descriptionTimer.current);
    };
  }, []);

  const statusLabel = task
    ? cancelled
      ? "취소됨"
      : STATUS_META[task.status].label
    : "";

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-[rgb(var(--material-scrim))] backdrop-blur-[2px] data-[state=open]:animate-fade-in" />

        {/* Full-screen sheet on mobile, right-hand panel from sm up. */}
        <Dialog.Content
          aria-describedby={undefined}
          className="
            material-panel material-edge
            fixed inset-0 z-50 flex flex-col
            sm:left-auto sm:right-0 sm:top-0 sm:h-full sm:w-full sm:max-w-md
            sm:border-l sm:border-separator sm:shadow-xl
            focus:outline-none
            data-[state=open]:animate-slide-in-right
          "
        >
          {/* Header */}
          <header className="flex items-start justify-between gap-3 border-b border-separator px-5 py-4">
            <div className="min-w-0 flex-1">
              <Dialog.Title className="sr-only">
                {task?.title ?? "업무 상세"}
              </Dialog.Title>
              <p className="text-2xs font-semibold uppercase tracking-wider text-text-tertiary">
                {statusLabel}
              </p>
              {/* Save state lives next to the title so it is visible wherever
                  the user is editing. */}
              <p className="mt-0.5 flex items-center gap-1.5 text-xs text-text-tertiary">
                {saveState === "saving" && (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                    저장 중
                  </>
                )}
                {saveState === "saved" && (
                  <>
                    <Check className="h-3 w-3 text-status-done" aria-hidden />
                    저장됨
                  </>
                )}
                {saveState === "error" && (
                  <span className="text-flag-blocked">저장 실패</span>
                )}
              </p>
            </div>

            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="닫기"
                className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </Dialog.Close>
          </header>

          {!task ? (
            <div className="flex flex-1 items-center justify-center text-sm text-text-tertiary">
              선택된 업무가 없습니다
            </div>
          ) : (
            <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-5 py-4">
              {error && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-lg border border-flag-blocked/30 bg-flag-blocked/10 px-3 py-2.5 text-xs text-flag-blocked"
                >
                  <AlertTriangle className="mt-px h-3.5 w-3.5 flex-shrink-0" aria-hidden />
                  <span>
                    {error}
                    {conflict &&
                      " 최신 내용을 다시 불러왔습니다. 변경 사항을 확인한 뒤 다시 적용해 주세요."}
                  </span>
                </div>
              )}

              {cancelled && (
                <div className="flex items-center justify-between gap-2 rounded-lg border border-separator bg-surface-2 px-3 py-2.5 text-xs text-text-secondary">
                  <span>취소된 업무입니다. 복구해야 수정할 수 있습니다.</span>
                  <button
                    type="button"
                    onClick={() => onRestoreTask(task)}
                    className="inline-flex flex-shrink-0 items-center gap-1 rounded px-2 py-1 font-medium text-accent hover:bg-surface-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <RotateCcw className="h-3 w-3" aria-hidden />
                    복구
                  </button>
                </div>
              )}

              {/* Title — commits on Enter or blur */}
              <Field label="업무명" htmlFor="task-title">
                <input
                  id="task-title"
                  value={title}
                  disabled={readOnly}
                  onChange={(e) => setTitle(e.target.value)}
                  onBlur={() => {
                    const trimmed = title.trim();
                    if (trimmed && trimmed !== task.title) {
                      void patch({ title: trimmed });
                    } else if (!trimmed) {
                      setTitle(task.title);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      e.currentTarget.blur();
                    }
                    if (e.key === "Escape") {
                      e.preventDefault();
                      setTitle(task.title);
                    }
                  }}
                  className="w-full rounded-lg border border-transparent bg-transparent px-0 py-1 text-lg font-semibold leading-snug text-text transition-colors hover:border-border focus:border-accent focus:px-3 focus:outline-none focus:ring-2 focus:ring-accent/30 disabled:opacity-60"
                />
              </Field>

              {/* Quick actions */}
              <div className="flex flex-wrap gap-1.5">
                <QuickChip
                  disabled={readOnly}
                  active={task.due_date === today}
                  onClick={() => void patch({ due_date: today })}
                >
                  오늘 마감
                </QuickChip>
                <QuickChip
                  disabled={readOnly}
                  active={task.due_date === shiftDate(today, 1)}
                  onClick={() => void patch({ due_date: shiftDate(today, 1) })}
                >
                  내일 마감
                </QuickChip>
                <QuickChip
                  disabled={readOnly || task.status === "Review"}
                  onClick={() => {
                    // Review needs someone to review it — default to the
                    // reviewer already on the task, else the first teammate
                    // who is not the assignee.
                    const fallback = members.find(
                      (m) => m.id !== task.assignee_id
                    );
                    const reviewerId = task.reviewer_id ?? fallback?.id ?? null;
                    if (!reviewerId) return;
                    void patch({ status: "Review", reviewer_id: reviewerId });
                  }}
                >
                  검토 요청
                </QuickChip>
                {/* Importance, not status — a subtask can be the most
                    consequential thing in the project. */}
                <QuickChip
                  disabled={readOnly}
                  active={task.importance === "key"}
                  onClick={() =>
                    void patch({
                      importance: task.importance === "key" ? "normal" : "key",
                    })
                  }
                >
                  핵심 업무
                </QuickChip>
                <QuickChip
                  disabled={readOnly}
                  active={task.status === "Done"}
                  onClick={() =>
                    void patch({
                      status: task.status === "Done" ? "ToDo" : "Done",
                    })
                  }
                >
                  {task.status === "Done" ? "완료 해제" : "완료"}
                </QuickChip>
              </div>

              {/* Description — debounced */}
              <Field label="세부 내용" htmlFor="task-description">
                <textarea
                  id="task-description"
                  rows={5}
                  value={description}
                  disabled={readOnly}
                  onChange={(e) => handleDescriptionChange(e.target.value)}
                  onBlur={flushDescription}
                  placeholder="배경, 결과물, 참고 링크를 적어 두세요."
                  className="w-full resize-y rounded-lg border border-border bg-surface px-3 py-2 text-base leading-relaxed text-text placeholder:text-text-quaternary transition-[border-color,box-shadow] duration-fast ease-out hover:border-border-strong focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30 disabled:opacity-60"
                />
              </Field>

              <Field label="진행 상태" htmlFor="task-status">
                <select
                  id="task-status"
                  value={waitDraft ? "Waiting" : task.status}
                  disabled={readOnly}
                  onChange={(e) => {
                    const next = e.target.value as Task["status"];
                    // Entering Waiting needs a party and a date, and the service
                    // rejects the move without them — so collect them first and
                    // send all three together instead of failing on the way in.
                    if (next === "Waiting" && task.status !== "Waiting") {
                      setWaitDraft({ party: "", date: "" });
                      return;
                    }
                    setWaitDraft(null);
                    void patch({ status: next });
                  }}
                  className={selectClass}
                >
                  {TASK_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_META[s].label}
                    </option>
                  ))}
                </select>
              </Field>

              {/* A Waiting task without a who and a when is one nobody ever
                  comes back to, so both are required to enter the state. */}
              {(waitDraft || task.status === "Waiting") && (
                <>
                  <Field label="무엇을 기다리나요" htmlFor="task-waiting-party">
                    <input
                      id="task-waiting-party"
                      type="text"
                      value={waitDraft ? waitDraft.party : undefined}
                      defaultValue={
                        waitDraft ? undefined : task.waiting_party_text ?? ""
                      }
                      disabled={readOnly}
                      placeholder="예: 본사 엠바고 회신"
                      className={selectClass}
                      onChange={(e) =>
                        waitDraft &&
                        setWaitDraft({ ...waitDraft, party: e.target.value })
                      }
                      onBlur={(e) => {
                        if (waitDraft) return;
                        const v = e.target.value.trim();
                        if (v !== (task.waiting_party_text ?? ""))
                          void patch({ waiting_party_text: v });
                      }}
                    />
                  </Field>

                  <Field label="다음 확인일" htmlFor="task-follow-up">
                    <input
                      id="task-follow-up"
                      type="date"
                      value={
                        waitDraft ? waitDraft.date : task.follow_up_at ?? ""
                      }
                      min={today}
                      disabled={readOnly}
                      className={selectClass}
                      onChange={(e) => {
                        if (!waitDraft) {
                          void patch({ follow_up_at: e.target.value || null });
                          return;
                        }
                        setWaitDraft({ ...waitDraft, date: e.target.value });
                      }}
                    />
                  </Field>

                  {waitDraft && (
                    <button
                      type="button"
                      disabled={!waitDraft.party.trim() || !waitDraft.date}
                      onClick={async () => {
                        const ok = await patch({
                          status: "Waiting",
                          waiting_party_text: waitDraft.party,
                          follow_up_at: waitDraft.date,
                        });
                        if (ok) setWaitDraft(null);
                      }}
                      className="h-10 rounded-lg bg-accent text-base font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-40"
                    >
                      대기로 변경
                    </button>
                  )}
                </>
              )}

              {allTasks && (
                <Field label="선행 업무" htmlFor="task-predecessor">
                  <div className="flex flex-col gap-1.5">
                    {(dependencies?.[task.id] ?? []).map((pid) => {
                      const p = allTasks.find((t) => t.id === pid);
                      if (!p) return null;
                      return (
                        <div key={pid} className="flex items-center gap-2 rounded-lg border border-separator px-2.5 py-1.5">
                          <span className={cn("size-2 shrink-0 rounded-full", p.status === "Done" ? "bg-status-done" : "bg-status-todo")} />
                          <span className="flex-1 truncate text-sm">{p.title}</span>
                          <button
                            type="button"
                            aria-label="선행 업무 해제"
                            disabled={readOnly}
                            onClick={async () => {
                              await removeDependencyAction(pid, task.id);
                              router.refresh();
                            }}
                            className="text-text-tertiary hover:text-flag-blocked"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      );
                    })}
                    <select
                      id="task-predecessor"
                      value=""
                      disabled={readOnly}
                      className={selectClass}
                      onChange={async (e) => {
                        if (!e.target.value) return;
                        const res = await addDependencyAction(e.target.value, task.id);
                        if (!res.success) setDepError(res.error ?? "연결하지 못했습니다.");
                        else { setDepError(null); router.refresh(); }
                      }}
                    >
                      <option value="">선행 업무 추가…</option>
                      {allTasks
                        .filter(
                          (t) =>
                            t.id !== task.id &&
                            t.project_id === task.project_id &&
                            !t.cancelled_at &&
                            !(dependencies?.[task.id] ?? []).includes(t.id)
                        )
                        .map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.title}
                          </option>
                        ))}
                    </select>
                    {depError && (
                      <p role="alert" className="text-xs text-flag-blocked">{depError}</p>
                    )}
                  </div>
                </Field>
              )}

              <Field label="프로젝트" htmlFor="task-project">
                <select
                  id="task-project"
                  value={task.project_id ?? ""}
                  disabled={readOnly}
                  onChange={(e) =>
                    void patch({ project_id: e.target.value || null })
                  }
                  className={selectClass}
                >
                  <option value="">프로젝트 없음 (Inbox)</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="업무 영역" htmlFor="task-workstream">
                <select
                  id="task-workstream"
                  value={task.workstream_id ?? ""}
                  disabled={readOnly || projectWorkstreams.length === 0}
                  onChange={(e) =>
                    void patch({ workstream_id: e.target.value || null })
                  }
                  className={selectClass}
                >
                  <option value="">
                    {projectWorkstreams.length === 0
                      ? "등록된 업무 영역 없음"
                      : "지정 안 함"}
                  </option>
                  {projectWorkstreams.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </Field>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="담당자" htmlFor="task-assignee">
                  <select
                    id="task-assignee"
                    value={task.assignee_id ?? ""}
                    disabled={readOnly}
                    onChange={(e) =>
                      void patch({ assignee_id: e.target.value || null })
                    }
                    className={selectClass}
                  >
                    <option value="">미지정</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="검토자" htmlFor="task-reviewer">
                  <select
                    id="task-reviewer"
                    value={task.reviewer_id ?? ""}
                    disabled={readOnly}
                    onChange={(e) =>
                      void patch({ reviewer_id: e.target.value || null })
                    }
                    className={selectClass}
                  >
                    <option value="">미지정</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="시작일" htmlFor="task-start">
                  <input
                    id="task-start"
                    type="date"
                    value={task.start_date ?? ""}
                    disabled={readOnly}
                    onChange={(e) =>
                      void patch({ start_date: e.target.value || null })
                    }
                    className={selectClass}
                  />
                </Field>

                <Field label="마감일" htmlFor="task-due">
                  <input
                    id="task-due"
                    type="date"
                    value={task.due_date ?? ""}
                    disabled={readOnly}
                    onChange={(e) => {
                      const value = e.target.value || null;
                      // Clearing the date must clear the time with it, or the
                      // server rejects the orphaned time.
                      void patch(
                        value
                          ? { due_date: value }
                          : { due_date: null, due_time: null }
                      );
                    }}
                    className={selectClass}
                  />
                </Field>
              </div>

              <Field label="마감 시간 (선택)" htmlFor="task-due-time">
                <div className="flex items-center gap-2">
                  <CalendarClock
                    className="h-4 w-4 flex-shrink-0 text-text-tertiary"
                    aria-hidden
                  />
                  <input
                    id="task-due-time"
                    type="time"
                    value={task.due_time ?? ""}
                    disabled={readOnly || !task.due_date}
                    onChange={(e) =>
                      void patch({ due_time: e.target.value || null })
                    }
                    className={selectClass}
                  />
                  {task.due_time && (
                    <button
                      type="button"
                      onClick={() => void patch({ due_time: null })}
                      disabled={readOnly}
                      className="flex-shrink-0 rounded px-2 py-2 text-xs text-text-secondary hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      시간 제거
                    </button>
                  )}
                </div>
                {!task.due_date && (
                  <p className="text-2xs text-text-tertiary">
                    마감일을 먼저 지정해 주세요.
                  </p>
                )}
              </Field>
            </div>
          )}

          {/* Footer — cancel / restore */}
          {task && (
            <footer className="border-t border-separator px-5 py-3">
              {cancelled ? (
                <button
                  type="button"
                  onClick={() => onRestoreTask(task)}
                  className="inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-medium text-accent transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <RotateCcw className="h-4 w-4" aria-hidden />
                  취소 복구
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onCancelTask(task)}
                  className="inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-medium text-flag-blocked transition-colors hover:bg-flag-blocked/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <XCircle className="h-4 w-4" aria-hidden />
                  업무 취소
                </button>
              )}
            </footer>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function QuickChip({
  children,
  active,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={cn(
        "inline-flex h-8 items-center rounded-full border px-3 text-xs font-medium",
        "transition-[background-color,border-color,transform] duration-fast ease-out active:scale-[0.97]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "disabled:cursor-not-allowed disabled:opacity-40",
        active
          ? "border-accent bg-accent/10 text-accent"
          : "border-border bg-surface text-text-secondary hover:border-border-strong hover:text-text"
      )}
    >
      {children}
    </button>
  );
}
