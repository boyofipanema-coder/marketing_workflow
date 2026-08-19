"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Check, ChevronDown, Loader2, Star, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { createDetailedProjectTaskAction } from "@/app/actions/tasks";
import type { Member, Project, Task, Workstream } from "@/server/db/schema";

interface TaskFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projects: Project[];
  workstreams: Workstream[];
  members: Member[];
  defaultProjectId: string | null;
  defaultAssigneeId?: string;
  defaultParentTask?: Task | null;
  onCreated?: (task: Task) => void;
}

const inputClass =
  "h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm text-text shadow-xs outline-none transition-[border-color,box-shadow] hover:border-border-strong focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:opacity-45";

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
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-xs font-semibold text-text-secondary">
        {label}
      </label>
      {children}
    </div>
  );
}

export default function TaskFormDialog({
  open,
  onOpenChange,
  projects,
  workstreams,
  members,
  defaultProjectId,
  defaultAssigneeId,
  defaultParentTask = null,
  onCreated,
}: TaskFormDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [kind, setKind] = useState<Task["kind"]>("task");
  const [importance, setImportance] = useState<Task["importance"]>("normal");
  const [projectId, setProjectId] = useState("");
  const [workstreamId, setWorkstreamId] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("");
  const [singleDay, setSingleDay] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (!open) {
      wasOpen.current = false;
      return;
    }
    if (wasOpen.current) return;
    wasOpen.current = true;
    setTitle("");
    setDescription("");
    setKind("task");
    setImportance("normal");
    setProjectId(
      defaultParentTask?.project_id ??
        defaultProjectId ??
        projects.find((project) => !project.archived_at)?.id ??
        "",
    );
    setWorkstreamId(defaultParentTask?.workstream_id ?? "");
    setAssigneeId(defaultParentTask?.assignee_id ?? defaultAssigneeId ?? "");
    setStartDate("");
    setDueDate("");
    setDueTime("");
    setSingleDay(false);
    setAdvancedOpen(false);
    setPending(false);
    setError(null);
  }, [open, defaultAssigneeId, defaultProjectId, defaultParentTask, projects]);

  const projectWorkstreams = useMemo(
    () => workstreams.filter((workstream) => workstream.project_id === projectId),
    [projectId, workstreams],
  );
  const defaultOwner = members.find((member) => member.id === assigneeId);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) return setError("업무명을 입력해 주세요.");
    if (!projectId) return setError("프로젝트를 선택해 주세요.");
    setPending(true);
    setError(null);
    const result = await createDetailedProjectTaskAction({
      projectId,
      parentTaskId: defaultParentTask?.id ?? null,
      title: title.trim(),
      description: description.trim() || null,
      status: "ToDo",
      importance,
      kind,
      assigneeId: assigneeId || null,
      startDate: startDate || null,
      dueDate: dueDate || null,
      dueTime: dueTime || null,
      workstreamId: workstreamId || null,
      waitingPartyText: null,
      followUpAt: null,
    });
    setPending(false);
    if (!result.success || !result.data) {
      setError(result.error ?? "업무를 추가하지 못했습니다.");
      return;
    }
    onCreated?.(result.data);
    onOpenChange(false);
  }

  return (
    <Dialog.Root open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-[rgb(var(--material-scrim))] backdrop-blur-[3px] data-[state=open]:animate-fade-in" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-3 z-50 overflow-hidden rounded-[22px] border border-border bg-surface shadow-xl focus:outline-none sm:inset-auto sm:left-1/2 sm:top-1/2 sm:max-h-[calc(100dvh-2rem)] sm:w-[calc(100vw-2rem)] sm:max-w-2xl sm:-translate-x-1/2 sm:-translate-y-1/2"
        >
          <form onSubmit={submit} className="flex max-h-[calc(100dvh-1.5rem)] flex-col sm:max-h-[calc(100dvh-2rem)]">
            <header className="flex items-center justify-between border-b border-border px-5 py-4 sm:px-6">
              <div>
                <Dialog.Title className="text-base font-semibold tracking-tight text-text">
                  {defaultParentTask ? "하위업무 추가" : "업무 추가"}
                </Dialog.Title>
                <p className="mt-0.5 text-xs text-text-tertiary">
                  {defaultParentTask ? `“${defaultParentTask.title}” 아래에 추가합니다.` : `${defaultOwner?.name ?? "현재 사용자"} 담당으로 시작합니다.`}
                </p>
              </div>
              <Dialog.Close asChild>
                <button type="button" aria-label="닫기" className="grid size-9 place-items-center rounded-full text-text-secondary hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <X className="size-4" />
                </button>
              </Dialog.Close>
            </header>

            <div className="space-y-4 overflow-y-auto px-5 py-5 sm:px-6">
              {error && (
                <p role="alert" className="rounded-xl border border-flag-blocked/25 bg-flag-blocked/8 px-3 py-2.5 text-xs font-medium text-flag-blocked">
                  {error}
                </p>
              )}

              <Field label={defaultParentTask ? "하위업무명" : "업무명"} htmlFor="create-task-title">
                <input
                  id="create-task-title"
                  autoFocus
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="완료할 업무를 적어 주세요"
                  className="h-11 w-full rounded-xl border border-border bg-surface px-3.5 text-base font-semibold text-text shadow-xs outline-none placeholder:font-normal placeholder:text-text-quaternary hover:border-border-strong focus:border-accent focus:ring-2 focus:ring-accent/20"
                />
              </Field>

              <Field label="세부 내용" htmlFor="create-task-description">
                <textarea
                  id="create-task-description"
                  rows={4}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="배경, 결과물, 참고 링크를 적어 두세요."
                  className="min-h-24 w-full resize-y rounded-xl border border-border bg-surface px-3.5 py-3 text-sm leading-relaxed text-text shadow-xs outline-none placeholder:text-text-quaternary hover:border-border-strong focus:border-accent focus:ring-2 focus:ring-accent/20"
                />
              </Field>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="프로젝트" htmlFor="create-task-project">
                  <select
                    id="create-task-project"
                    value={projectId}
                    disabled={Boolean(defaultParentTask)}
                    onChange={(event) => {
                      setProjectId(event.target.value);
                      setWorkstreamId("");
                    }}
                    className={inputClass}
                  >
                    {projects.filter((project) => !project.archived_at).map((project) => (
                      <option key={project.id} value={project.id}>{project.name}</option>
                    ))}
                  </select>
                </Field>
                <Field label={singleDay ? "일정 날짜" : "마감일"} htmlFor="create-task-due">
                  <input
                    id="create-task-due"
                    type="date"
                    value={dueDate}
                    onChange={(event) => {
                      const value = event.target.value;
                      setDueDate(value);
                      if (singleDay) setStartDate(value);
                      if (!value) {
                        setDueTime("");
                        setSingleDay(false);
                      }
                    }}
                    className={inputClass}
                  />
                </Field>
                <Field label={singleDay ? "시작 시각" : "마감 시각"} htmlFor="create-task-due-time">
                  <input id="create-task-due-time" type="time" value={dueTime} onChange={(event) => setDueTime(event.target.value)} disabled={!dueDate} className={inputClass} />
                </Field>
                <div className="flex min-w-0 flex-col gap-1.5">
                  <span className="text-xs font-semibold text-text-secondary">날짜 성격</span>
                  <div className="grid grid-cols-2 gap-1 rounded-xl border border-border bg-surface-2/70 p-1">
                    {(["deadline", "schedule"] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        disabled={!dueDate}
                        aria-pressed={(mode === "schedule") === singleDay}
                        onClick={() => {
                          const schedule = mode === "schedule";
                          setSingleDay(schedule);
                          setStartDate(schedule ? dueDate : startDate === dueDate ? "" : startDate);
                        }}
                        className={cn("h-9 rounded-[9px] text-xs font-semibold disabled:opacity-45", (mode === "schedule") === singleDay ? "bg-surface text-text shadow-sm" : "text-text-tertiary hover:text-text")}
                      >
                        {mode === "schedule" ? "일정" : "마감"}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex min-w-0 flex-col gap-1.5">
                  <span className="text-xs font-semibold text-text-secondary">중요도</span>
                  <button
                    type="button"
                    aria-pressed={importance === "key"}
                    onClick={() => setImportance((value) => value === "key" ? "normal" : "key")}
                    className={cn("inline-flex h-11 items-center justify-center gap-2 rounded-xl border text-sm font-semibold", importance === "key" ? "border-accent/30 bg-accent/10 text-accent" : "border-border bg-surface text-text-secondary")}
                  >
                    <Star className="size-4" fill={importance === "key" ? "currentColor" : "none"} />
                    {importance === "key" ? "중요 업무" : "보통 업무"}
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setAdvancedOpen((value) => !value)}
                aria-expanded={advancedOpen}
                className="flex h-9 items-center gap-2 text-xs font-semibold text-text-secondary hover:text-text"
              >
                <ChevronDown className={cn("size-4 transition-transform", advancedOpen && "rotate-180")} />
                {advancedOpen ? "추가 입력 접기" : "담당자·일정 등 추가 입력"}
              </button>

              {advancedOpen && (
                <section className="grid gap-3 rounded-xl border border-border bg-surface-2/45 p-3 sm:grid-cols-2">
                  <Field label="담당자" htmlFor="create-task-assignee">
                    <select id="create-task-assignee" value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)} className={inputClass}>
                      <option value="">담당자 없음</option>
                      {members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
                    </select>
                  </Field>
                  <Field label="업무 영역" htmlFor="create-task-workstream">
                    <select id="create-task-workstream" value={workstreamId} onChange={(event) => setWorkstreamId(event.target.value)} disabled={projectWorkstreams.length === 0} className={inputClass}>
                      <option value="">{projectWorkstreams.length ? "지정 안 함" : "등록된 영역 없음"}</option>
                      {projectWorkstreams.map((workstream) => <option key={workstream.id} value={workstream.id}>{workstream.name}</option>)}
                    </select>
                  </Field>
                  <Field label="시작일" htmlFor="create-task-start">
                    <input
                      id="create-task-start"
                      type="date"
                      value={startDate}
                      onChange={(event) => {
                        setStartDate(event.target.value);
                        setSingleDay(
                          Boolean(event.target.value) &&
                            event.target.value === dueDate,
                        );
                      }}
                      className={inputClass}
                    />
                  </Field>
                  <Field label="업무 유형" htmlFor="create-task-kind">
                    <select id="create-task-kind" value={kind} onChange={(event) => setKind(event.target.value as Task["kind"])} className={inputClass}>
                      <option value="task">업무</option>
                      <option value="milestone">마일스톤</option>
                    </select>
                  </Field>
                </section>
              )}
            </div>

            <footer className="flex items-center justify-end gap-2 border-t border-border px-5 py-3 sm:px-6">
              <Dialog.Close asChild>
                <button type="button" className="h-9 rounded-xl px-4 text-sm font-semibold text-text-secondary hover:bg-surface-2">취소</button>
              </Dialog.Close>
              <button type="submit" disabled={pending || !title.trim() || !projectId} className="inline-flex h-9 min-w-20 items-center justify-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-white shadow-sm hover:bg-accent-hover active:scale-[0.98] disabled:opacity-40">
                {pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                추가
              </button>
            </footer>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
