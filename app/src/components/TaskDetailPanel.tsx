"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X, Calendar, User, Tag } from "lucide-react";
import { type TaskItem } from "./TaskCard";
import { Button, StatusBadge } from "@/components/ui";

// ── Local types ──────────────────────────────────────────────────────────────

export interface ProjectSummary {
  id: string;
  name: string;
  /** Hex or Tailwind color name for the project accent */
  color?: string;
}

interface TaskDetailPanelProps {
  task: TaskItem | null;
  project?: ProjectSummary;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  });
}

function initials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

// ── Detail row helper ─────────────────────────────────────────────────────────

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-separator last:border-0">
      <span className="mt-0.5 flex-shrink-0 text-text-tertiary">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-2xs font-semibold uppercase tracking-wider text-text-tertiary mb-0.5">
          {label}
        </p>
        <div className="text-sm text-text">{value}</div>
      </div>
    </div>
  );
}

// ── TaskDetailPanel ──────────────────────────────────────────────────────────

export default function TaskDetailPanel({
  task,
  project,
  open,
  onOpenChange,
}: TaskDetailPanelProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        {/* Scrim — dims the background to focus the task (apple-design §12). */}
        <Dialog.Overlay className="fixed inset-0 z-40 bg-[rgb(var(--material-scrim))] backdrop-blur-[2px] data-[state=open]:animate-fade-in" />

        {/* Panel — translucent material, slides in from the right. Enter and
            exit share the same path (right ⇄ right) per apple-design §7. */}
        <Dialog.Content
          aria-describedby="task-detail-desc"
          className="
            material-panel material-edge
            fixed right-0 top-0 z-50
            flex h-full w-full max-w-md flex-col
            border-l border-separator shadow-xl
            focus:outline-none
            data-[state=open]:animate-slide-in-right
          "
        >
          {/* Header */}
          <header className="flex items-start justify-between gap-4 border-b border-separator px-6 py-5">
            <div className="flex-1 min-w-0">
              {project && (
                <p className="mb-1 text-2xs font-semibold uppercase tracking-wider text-text-tertiary">
                  {project.name}
                </p>
              )}
              <Dialog.Title className="text-lg font-semibold text-text leading-snug">
                {task?.title ?? "업무 상세"}
              </Dialog.Title>
            </div>

            <Dialog.Close asChild>
              <Button variant="ghost" size="icon-sm" aria-label="닫기">
                <X className="h-4 w-4" />
              </Button>
            </Dialog.Close>
          </header>

          {/* Body */}
          <div
            id="task-detail-desc"
            className="flex-1 overflow-y-auto px-6 py-4"
          >
            {task ? (
              <>
                {/* Status */}
                <div className="mb-6">
                  <p className="mb-1 text-2xs font-semibold uppercase tracking-wider text-text-tertiary">진행 상태</p>
                  <StatusBadge status={task.status} cancelled={task.cancelled} variant="dot" />
                </div>

                {/* Details */}
                <div className="rounded-lg border border-separator divide-y divide-separator bg-surface-2/50 px-3">
                  {task.assigneeName && (
                    <DetailRow
                      icon={<User className="h-3.5 w-3.5" />}
                      label="담당자"
                      value={
                        <div className="flex items-center gap-2">
                          <span className="h-6 w-6 rounded-full bg-surface-3 text-2xs font-semibold text-text-secondary flex items-center justify-center flex-shrink-0">
                            {initials(task.assigneeName)}
                          </span>
                          {task.assigneeName}
                        </div>
                      }
                    />
                  )}

                  {task.dueDate && (
                    <DetailRow
                      icon={<Calendar className="h-3.5 w-3.5" />}
                      label="마감일"
                      value={formatDate(task.dueDate)}
                    />
                  )}

                  {task.flags &&
                    (task.flags.stalled ||
                      task.flags.attention ||
                      task.flags.overdue) && (
                      <DetailRow
                        icon={<Tag className="h-3.5 w-3.5" />}
                        label="상태 표시"
                        value={
                          <div className="flex flex-wrap gap-1">
                            {task.flags.stalled && (
                              <span className="rounded bg-flag-followup/15 px-2 py-0.5 text-xs font-medium text-flag-followup">지연</span>
                            )}
                            {task.flags.attention && (
                              <span className="rounded bg-flag-blocked/15 px-2 py-0.5 text-xs font-medium text-flag-blocked">확인 필요</span>
                            )}
                            {task.flags.overdue && (
                              <span className="rounded bg-flag-overdue/12 px-2 py-0.5 text-xs font-medium text-flag-overdue">기한 초과</span>
                            )}
                          </div>
                        }
                      />
                    )}
                </div>

                {/* ID */}
                <p className="mt-6 font-mono text-2xs text-text-quaternary">
                  업무 #{task.id}
                </p>
              </>
            ) : (
              <div className="flex items-center justify-center h-32 text-sm text-text-tertiary">선택된 업무가 없습니다</div>
            )}
          </div>

          {/* Footer — placeholder for future actions */}
          <footer className="border-t border-separator px-6 py-4">
            <p className="text-xs text-text-tertiary">
              추가 기능은 이후 마일스톤에서 제공될 예정입니다.
            </p>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
