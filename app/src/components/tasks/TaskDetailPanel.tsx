"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import {
  DISPLAY_STATUS_GROUPS,
  DISPLAY_GROUP_META,
  displayGroup,
} from "@/lib/status";
import { todayKST } from "@/lib/derive";
import { createRequestGuard } from "@/lib/request-guard";
import type { Task, Project, Workstream, Member } from "@/server/db/schema";
import { getTaskActivityAction } from "@/app/actions/tasks";
import type { ActivityEntry } from "@/server/data/queries";
import type { TaskPatchInput } from "@/app/actions/tasks";
import type { SaveState } from "./useTaskStore";

const DESCRIPTION_DEBOUNCE_MS = 600;

export interface TaskDetailPanelProps {
  task: Task | null;
  projects: Project[];
  /** Every workstream the viewer can see; filtered to the task's project here. */
  workstreams: Workstream[];
  members: Member[];
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
  className,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <label
        htmlFor={htmlFor}
        className="text-xs font-semibold text-text-secondary"
      >
        {label}
      </label>
      {children}
    </div>
  );
}

/** activity_log change_type → Korean. Unknown types fall through as-is. */
const CHANGE_LABEL: Record<string, string> = {
  title: "제목",
  description: "설명",
  status: "상태",
  importance: "중요도",
  kind: "종류",
  assignee: "담당자",
  reviewer: "검토자",
  project: "프로젝트",
  workstream: "업무 영역",
  start_date: "시작일",
  due_date: "마감일",
};

const selectClass =
  "h-11 w-full rounded-xl border border-border bg-surface/80 px-3 text-sm text-text shadow-xs transition-[border-color,box-shadow,background-color] duration-fast ease-out hover:border-border-strong focus:border-accent focus:bg-surface focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:opacity-50";

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
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const descriptionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingDescription = useRef<string | null>(null);
  const activityGuard = useRef(createRequestGuard()).current;

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
    setActivity([]);
    const id = task.id;
    const token = activityGuard.next();
    void getTaskActivityAction(id).then((r) => {
      // A slower fetch for a task we've since navigated away from must not
      // overwrite whatever the current task's own fetch already set.
      if (!activityGuard.isCurrent(token)) return;
      if (r.success && r.data) setActivity(r.data);
    });
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
      : DISPLAY_GROUP_META[displayGroup(task.status)].label
    : "";

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-[rgb(var(--material-scrim))] backdrop-blur-[2px] data-[state=open]:animate-fade-in" />

        {/* Full-screen sheet on mobile; a centered dialog from sm up — plain
            fade/scale from its own center, no card-origin transform tracking.
            Positioning (incl. the centering translate) lives on this element;
            the scale-in keyframe sets a bare `transform: scale()`, which would
            otherwise permanently clobber that translate once the animation's
            fill-mode holds its last frame — so the animation goes on the inner
            wrapper below instead, each element owning its own transform. */}
        <Dialog.Content
          aria-describedby={undefined}
          className="
            material-panel material-edge
            group fixed inset-0 z-50 overflow-hidden
            sm:inset-auto sm:left-1/2 sm:top-1/2 sm:h-auto sm:max-h-[calc(100dvh-2rem)] sm:w-[calc(100vw-2rem)] sm:max-w-5xl
            sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[24px]
            sm:border sm:border-separator sm:shadow-xl
            focus:outline-none
          "
        >
        <div className="flex h-full flex-col group-data-[state=open]:animate-scale-in">
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
            <div className="grid flex-1 grid-cols-1 content-start gap-5 overflow-y-auto px-5 py-5 sm:px-6 lg:grid-cols-2">
              {error && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-xl border border-flag-blocked/30 bg-flag-blocked/10 px-3 py-2.5 text-xs text-flag-blocked lg:col-span-2"
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
                <div className="flex items-center justify-between gap-2 rounded-xl border border-separator bg-surface-2 px-3 py-2.5 text-xs text-text-secondary lg:col-span-2">
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
              <Field label="업무명" htmlFor="task-title" className="lg:col-span-2">
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
                  className="w-full rounded-xl border border-transparent bg-transparent px-0 py-1 text-xl font-semibold leading-snug tracking-tight text-text transition-[border-color,padding,box-shadow] hover:border-border focus:border-accent focus:px-3 focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:opacity-60"
                />
              </Field>

              {/* Quick actions */}
              <div className="flex flex-wrap gap-1.5 lg:col-span-2">
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
              </div>

              <div className="grid gap-5 lg:col-span-2 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
                <section className="flex min-w-0 flex-col gap-4">
                {/* Description — debounced */}
                <Field label="세부 내용" htmlFor="task-description">
                <textarea
                  id="task-description"
                  rows={7}
                  value={description}
                  disabled={readOnly}
                  onChange={(e) => handleDescriptionChange(e.target.value)}
                  onBlur={flushDescription}
                  placeholder="배경, 결과물, 참고 링크를 적어 두세요."
                  className="min-h-40 w-full resize-y rounded-xl border border-border bg-surface/80 px-3.5 py-3 text-sm leading-relaxed text-text shadow-xs placeholder:text-text-quaternary transition-[border-color,box-shadow] duration-fast ease-out hover:border-border-strong focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:opacity-60"
                />
                </Field>

                <Field label="진행 상태" htmlFor="task-status">
                <div
                  id="task-status"
                  role="radiogroup"
                  aria-label="진행 상태"
                  className="grid grid-cols-3 gap-1 rounded-xl border border-border bg-surface-2/70 p-1"
                >
                  {DISPLAY_STATUS_GROUPS.map((group) => {
                    const current = waitDraft ? "Waiting" : displayGroup(task.status);
                    const active = current === group;
                    return (
                      <button
                        key={group}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        disabled={readOnly}
                        onClick={() => {
                          if (group === "Waiting") {
                            // Entering Waiting needs a party and a date, and the
                            // service rejects the move without them — so collect
                            // them first and send all three together instead of
                            // failing on the way in.
                            if (task.status !== "Waiting") {
                              setWaitDraft({ party: "", date: "" });
                            }
                            return;
                          }
                          setWaitDraft(null);
                          if (active) return; // already in this group
                          void patch({ status: group });
                        }}
                        className={cn(
                          "h-10 rounded-[10px] text-sm font-semibold transition-colors duration-fast ease-out disabled:opacity-50",
                          active
                            ? "bg-surface text-text shadow-sm"
                            : "text-text-secondary hover:text-text"
                        )}
                      >
                        {DISPLAY_GROUP_META[group].label}
                      </button>
                    );
                  })}
                </div>
                </Field>

              {/* A Waiting task without a who and a when is one nobody ever
                  comes back to, so both are required to enter the state. */}
                {(waitDraft || task.status === "Waiting") && (
                  <div className="grid gap-3 sm:grid-cols-2">
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
                      className="h-11 rounded-xl bg-accent text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-40"
                    >
                      대기로 변경
                    </button>
                    )}
                  </div>
                )}
                </section>

                <section className="grid min-w-0 content-start gap-3 sm:grid-cols-2">
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
                  <option value="">담당자 없음</option>
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name}
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
                  <option value="">검토자 없음</option>
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="업무 유형">
                <div className="grid grid-cols-2 gap-1 rounded-xl border border-border bg-surface-2/70 p-1">
                  {([
                    ["task", "업무"],
                    ["milestone", "마일스톤"],
                  ] as const).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      disabled={readOnly}
                      aria-pressed={task.kind === value}
                      onClick={() => void patch({ kind: value })}
                      className={cn(
                        "h-9 rounded-[9px] text-xs font-semibold transition-[background-color,color,box-shadow] disabled:opacity-50",
                        task.kind === value
                          ? "bg-surface text-text shadow-sm"
                          : "text-text-secondary hover:text-text"
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </Field>

              <div className="grid grid-cols-1 gap-3 sm:col-span-2 sm:grid-cols-2">
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
                </section>
              </div>

              {activity.length > 0 && (
                <Field label="변경 이력" className="lg:col-span-2">
                  <ul className="flex flex-col gap-1.5">
                    {activity.map((a) => (
                      <li key={a.id} className="flex items-baseline gap-2 text-xs text-text-secondary">
                        <span className="shrink-0 tabular-nums text-text-quaternary">
                          {a.created_at.slice(5, 10).replace("-", "/")}
                        </span>
                        <span className="flex-1">
                          {a.actor_name} · {CHANGE_LABEL[a.change_type] ?? a.change_type}
                          {a.to_value ? ` → ${a.to_value}` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                </Field>
              )}
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
        </div>
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
