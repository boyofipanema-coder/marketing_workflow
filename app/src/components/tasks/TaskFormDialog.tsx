"use client";

import { useEffect, useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Check, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { todayKST } from "@/lib/derive";
import { createDetailedProjectTaskAction } from "@/app/actions/tasks";
import type { Member, Project, Task, Workstream } from "@/server/db/schema";

interface TaskFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projects: Project[];
  workstreams: Workstream[];
  members: Member[];
  defaultProjectId: string | null;
  onCreated?: (task: Task) => void;
}

type CreateStatus = "ToDo" | "Waiting" | "Done";

const inputClass =
  "h-11 w-full rounded-xl border border-border bg-surface/80 px-3 text-sm text-text shadow-xs outline-none transition-[border-color,box-shadow,background-color] hover:border-border-strong focus:border-accent focus:bg-surface focus:ring-2 focus:ring-accent/20 disabled:opacity-45";

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

function addDays(base: string, days: number) {
  const date = new Date(`${base}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export default function TaskFormDialog({
  open,
  onOpenChange,
  projects,
  workstreams,
  members,
  defaultProjectId,
  onCreated,
}: TaskFormDialogProps) {
  const today = useMemo(() => todayKST(new Date()), []);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<CreateStatus>("ToDo");
  const [importance, setImportance] = useState<Task["importance"]>("normal");
  const [kind, setKind] = useState<Task["kind"]>("task");
  const [projectId, setProjectId] = useState("");
  const [workstreamId, setWorkstreamId] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("");
  const [waitingParty, setWaitingParty] = useState("");
  const [followUpAt, setFollowUpAt] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setDescription("");
    setStatus("ToDo");
    setImportance("normal");
    setKind("task");
    setProjectId(defaultProjectId ?? projects.find((project) => !project.archived_at)?.id ?? "");
    setWorkstreamId("");
    setAssigneeId("");
    setStartDate("");
    setDueDate("");
    setDueTime("");
    setWaitingParty("");
    setFollowUpAt("");
    setPending(false);
    setError(null);
  }, [open, defaultProjectId, projects]);

  const projectWorkstreams = useMemo(
    () => workstreams.filter((workstream) => workstream.project_id === projectId),
    [projectId, workstreams]
  );

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setError("업무명을 입력해 주세요.");
      return;
    }
    if (!projectId) {
      setError("프로젝트를 선택해 주세요.");
      return;
    }
    if (status === "Waiting" && (!waitingParty.trim() || !followUpAt)) {
      setError("대기 상태에는 기다리는 대상과 다음 확인일이 필요합니다.");
      return;
    }

    setPending(true);
    setError(null);
    const result = await createDetailedProjectTaskAction({
      projectId,
      title: cleanTitle,
      description: description.trim() || null,
      status,
      importance,
      kind,
      assigneeId: assigneeId || null,
      startDate: startDate || null,
      dueDate: dueDate || null,
      dueTime: dueTime || null,
      workstreamId: workstreamId || null,
      waitingPartyText: status === "Waiting" ? waitingParty.trim() : null,
      followUpAt: status === "Waiting" ? followUpAt : null,
    });
    setPending(false);
    if (!result.success || !result.data) {
      setError(result.error ?? "업무를 추가하지 못했습니다.");
      return;
    }
    onCreated?.(result.data);
    onOpenChange(false);
  }

  const statusOptions: Array<{ value: CreateStatus; label: string }> = [
    { value: "ToDo", label: "진행 중" },
    { value: "Waiting", label: "대기" },
    { value: "Done", label: "완료" },
  ];

  return (
    <Dialog.Root open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-[rgb(var(--material-scrim))] backdrop-blur-[3px] data-[state=open]:animate-fade-in" />
        <Dialog.Content
          aria-describedby={undefined}
          className="material-panel material-edge fixed inset-3 z-50 overflow-hidden rounded-[24px] border border-separator shadow-xl focus:outline-none sm:inset-auto sm:left-1/2 sm:top-1/2 sm:max-h-[calc(100dvh-2rem)] sm:w-[calc(100vw-2rem)] sm:max-w-5xl sm:-translate-x-1/2 sm:-translate-y-1/2"
        >
          <form onSubmit={submit} className="flex max-h-[calc(100dvh-1.5rem)] flex-col sm:max-h-[calc(100dvh-2rem)]">
            <header className="flex items-center justify-between border-b border-separator/80 px-5 py-4 sm:px-6">
              <div>
                <Dialog.Title className="text-lg font-semibold tracking-tight text-text">
                  업무 추가
                </Dialog.Title>
                <p className="mt-0.5 text-xs text-text-tertiary">
                  필요한 정보를 한 번에 입력합니다.
                </p>
              </div>
              <Dialog.Close asChild>
                <button
                  type="button"
                  aria-label="닫기"
                  className="grid size-10 place-items-center rounded-full text-text-secondary transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <X className="size-4" aria-hidden />
                </button>
              </Dialog.Close>
            </header>

            <div className="overflow-y-auto px-5 py-5 sm:px-6">
              {error && (
                <p role="alert" className="mb-4 rounded-xl border border-flag-blocked/25 bg-flag-blocked/8 px-3 py-2.5 text-xs font-medium text-flag-blocked">
                  {error}
                </p>
              )}

              <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(19rem,0.8fr)]">
                <section className="flex min-w-0 flex-col gap-4">
                  <Field label="업무명" htmlFor="create-task-title">
                    <input
                      id="create-task-title"
                      autoFocus
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                      placeholder="완료할 업무를 적어 주세요"
                      className="h-12 w-full rounded-xl border border-border bg-surface/80 px-3.5 text-base font-semibold text-text shadow-xs outline-none transition-[border-color,box-shadow] placeholder:font-normal placeholder:text-text-quaternary hover:border-border-strong focus:border-accent focus:ring-2 focus:ring-accent/20"
                    />
                  </Field>

                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => setDueDate(today)} className={cn("rounded-full border px-3 py-1.5 text-xs font-semibold transition-transform active:scale-[0.97]", dueDate === today ? "border-accent bg-accent/10 text-accent" : "border-border bg-surface text-text-secondary")}>
                      오늘 마감
                    </button>
                    <button type="button" onClick={() => setDueDate(addDays(today, 1))} className={cn("rounded-full border px-3 py-1.5 text-xs font-semibold transition-transform active:scale-[0.97]", dueDate === addDays(today, 1) ? "border-accent bg-accent/10 text-accent" : "border-border bg-surface text-text-secondary")}>
                      내일 마감
                    </button>
                    <button type="button" onClick={() => setImportance((value) => value === "key" ? "normal" : "key")} className={cn("rounded-full border px-3 py-1.5 text-xs font-semibold transition-transform active:scale-[0.97]", importance === "key" ? "border-accent bg-accent/10 text-accent" : "border-border bg-surface text-text-secondary")}>
                      핵심 업무
                    </button>
                  </div>

                  <Field label="세부 내용" htmlFor="create-task-description">
                    <textarea
                      id="create-task-description"
                      rows={7}
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      placeholder="배경, 결과물, 참고 링크를 적어 두세요."
                      className="min-h-40 w-full resize-y rounded-xl border border-border bg-surface/80 px-3.5 py-3 text-sm leading-relaxed text-text shadow-xs outline-none transition-[border-color,box-shadow] placeholder:text-text-quaternary hover:border-border-strong focus:border-accent focus:ring-2 focus:ring-accent/20"
                    />
                  </Field>

                  <Field label="진행 상태">
                    <div role="radiogroup" aria-label="진행 상태" className="grid grid-cols-3 gap-1 rounded-xl border border-border bg-surface-2/70 p-1">
                      {statusOptions.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          role="radio"
                          aria-checked={status === option.value}
                          onClick={() => setStatus(option.value)}
                          className={cn("h-10 rounded-[10px] text-sm font-semibold transition-[background-color,color,box-shadow,transform] active:scale-[0.98]", status === option.value ? "bg-surface text-text shadow-sm" : "text-text-secondary hover:text-text")}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </Field>

                  {status === "Waiting" && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="무엇을 기다리나요" htmlFor="create-task-waiting">
                        <input id="create-task-waiting" value={waitingParty} onChange={(event) => setWaitingParty(event.target.value)} placeholder="예: 본사 승인 회신" className={inputClass} />
                      </Field>
                      <Field label="다음 확인일" htmlFor="create-task-follow-up">
                        <input id="create-task-follow-up" type="date" min={today} value={followUpAt} onChange={(event) => setFollowUpAt(event.target.value)} className={inputClass} />
                      </Field>
                    </div>
                  )}
                </section>

                <section className="grid content-start gap-4 sm:grid-cols-2 lg:grid-cols-1">
                  <Field label="프로젝트" htmlFor="create-task-project">
                    <select
                      id="create-task-project"
                      value={projectId}
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

                  <Field label="업무 영역" htmlFor="create-task-workstream">
                    <select id="create-task-workstream" value={workstreamId} onChange={(event) => setWorkstreamId(event.target.value)} disabled={projectWorkstreams.length === 0} className={inputClass}>
                      <option value="">{projectWorkstreams.length ? "지정 안 함" : "등록된 업무 영역 없음"}</option>
                      {projectWorkstreams.map((workstream) => <option key={workstream.id} value={workstream.id}>{workstream.name}</option>)}
                    </select>
                  </Field>

                  <Field label="담당자" htmlFor="create-task-assignee">
                    <select id="create-task-assignee" value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)} className={inputClass}>
                      <option value="">담당자 없음</option>
                      {members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
                    </select>
                  </Field>

                  <Field label="업무 유형">
                    <div className="grid grid-cols-2 gap-1 rounded-xl border border-border bg-surface-2/70 p-1">
                      {([{ value: "task", label: "업무" }, { value: "milestone", label: "마일스톤" }] as const).map((option) => (
                        <button key={option.value} type="button" aria-pressed={kind === option.value} onClick={() => setKind(option.value)} className={cn("h-9 rounded-[9px] text-xs font-semibold transition-[background-color,color,box-shadow]", kind === option.value ? "bg-surface text-text shadow-sm" : "text-text-secondary")}>
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </Field>

                  <div className="grid gap-3 sm:col-span-2 sm:grid-cols-2 lg:col-span-1">
                    <Field label="시작일" htmlFor="create-task-start">
                      <input id="create-task-start" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className={inputClass} />
                    </Field>
                    <Field label="마감일" htmlFor="create-task-due">
                      <input id="create-task-due" type="date" value={dueDate} onChange={(event) => {
                        setDueDate(event.target.value);
                        if (!event.target.value) setDueTime("");
                      }} className={inputClass} />
                    </Field>
                  </div>

                  <Field label="마감 시간" htmlFor="create-task-due-time">
                    <input id="create-task-due-time" type="time" value={dueTime} onChange={(event) => setDueTime(event.target.value)} disabled={!dueDate} className={inputClass} />
                  </Field>
                </section>
              </div>
            </div>

            <footer className="flex items-center justify-end gap-2 border-t border-separator/80 bg-surface/55 px-5 py-3 backdrop-blur-xl sm:px-6">
              <Dialog.Close asChild>
                <button type="button" className="h-10 rounded-xl px-4 text-sm font-semibold text-text-secondary transition-colors hover:bg-surface-2">
                  취소
                </button>
              </Dialog.Close>
              <button type="submit" disabled={pending || !title.trim() || !projectId} className="inline-flex h-10 min-w-24 items-center justify-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-white shadow-sm transition-[background-color,transform] hover:bg-accent-hover active:scale-[0.98] disabled:opacity-40">
                {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Check className="size-4" aria-hidden />}
                추가
              </button>
            </footer>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
