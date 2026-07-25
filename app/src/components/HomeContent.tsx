"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Inbox, AlertTriangle, ArrowRight, Plus } from "lucide-react";
import SectionList from "@/components/SectionList";
import TaskDetailPanel from "@/components/TaskDetailPanel";
import QuickAdd from "@/components/QuickAdd";
import { type TaskItem } from "@/components/TaskCard";
import { createTaskAction } from "@/app/actions/tasks";

// ── Props ─────────────────────────────────────────────────────────────────────

export interface HomeContentProps {
  viewerName: string;
  myFocus: TaskItem[];
  needsAttention: TaskItem[];
  comingNext: TaskItem[];
  /** Task ID → project name, for the detail panel */
  taskProjects: Record<string, { id: string; name: string }>;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function HomeContent({
  viewerName,
  myFocus,
  needsAttention,
  comingNext,
  taskProjects,
}: HomeContentProps) {
  const router = useRouter();
  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickAddError, setQuickAddError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Poll for updates every 30 seconds
  useEffect(() => {
    const id = setInterval(() => router.refresh(), 30_000);
    return () => clearInterval(id);
  }, [router]);

  // Refetch on tab focus
  useEffect(() => {
    function onFocus() {
      router.refresh();
    }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [router]);

  function handleTaskClick(item: TaskItem) {
    setSelectedTask(item);
    setPanelOpen(true);
  }

  async function handleCreate(title: string) {
    setQuickAddError(null);
    startTransition(async () => {
      const result = await createTaskAction(title);
      if (result.success) {
        setShowQuickAdd(false);
        router.refresh();
      } else {
        setQuickAddError(result.error ?? "업무를 추가하지 못했습니다. 다시 시도해 주세요.");
      }
    });
  }

  const selectedProject = selectedTask
    ? taskProjects[selectedTask.id]
    : undefined;

  return (
    <>
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        {/* Page header */}
        <header className="mb-10 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-text-tertiary mb-1.5">
              개요
            </p>
            <h1 className="font-serif text-2xl font-semibold text-text leading-tight">
              홈
            </h1>
            <p className="mt-1.5 text-sm text-text-secondary">
              {viewerName ? `${viewerName}님으로 로그인했습니다. ` : ""}
              진행 중인 모든 프로젝트에서 오늘 집중할 업무입니다.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowQuickAdd(true)}
            className="flex-shrink-0 flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-text-on-accent hover:bg-accent-hover transition-colors"
            aria-label="업무 빠른 추가"
          >
            <Plus className="h-3.5 w-3.5" />
            업무 추가
          </button>
        </header>

        {/* Quick add */}
        {showQuickAdd && (
          <div className="mb-8">
            <QuickAdd
              onCreate={handleCreate}
              onCancel={() => {
                setShowQuickAdd(false);
                setQuickAddError(null);
              }}
              placeholder="해야 할 업무를 입력하세요"
            />
            {quickAddError && (
              <p className="mt-2 text-xs text-flag-blocked">{quickAddError}</p>
            )}
          </div>
        )}

        {/* Sections */}
        <div className="flex flex-col gap-10">
          {/* My Focus */}
          <SectionList
            title="내 우선 업무"
            tasks={myFocus}
            onTaskClick={handleTaskClick}
            emptyTitle="오늘의 우선 업무가 없습니다"
            emptyDescription="진행 중이거나 검토 중인 업무가 여기에 표시됩니다."
            emptyIcon={<Inbox className="h-5 w-5" />}
          />

          {/* Needs Attention */}
          <SectionList
            title="확인 필요"
            tasks={needsAttention}
            onTaskClick={handleTaskClick}
            emptyTitle="확인이 필요한 업무가 없습니다"
            emptyDescription="기한이 지났거나 팔로업이 필요한 업무가 없습니다."
            emptyIcon={<AlertTriangle className="h-5 w-5" />}
          />

          {/* Coming Next */}
          <SectionList
            title="다음 업무"
            tasks={comingNext}
            onTaskClick={handleTaskClick}
            emptyTitle="예정된 다음 업무가 없습니다"
            emptyDescription="앞으로 7일 안에 시작할 업무가 여기에 표시됩니다."
            emptyIcon={<ArrowRight className="h-5 w-5" />}
          />
        </div>
      </div>

      {/* Detail panel */}
      <TaskDetailPanel
        task={selectedTask}
        project={selectedProject}
        open={panelOpen}
        onOpenChange={setPanelOpen}
      />
    </>
  );
}
