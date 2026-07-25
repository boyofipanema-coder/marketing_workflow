"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Sun,
  CalendarDays,
  Loader2,
  Clock,
  Eye,
  Archive,
} from "lucide-react";
import SectionList from "@/components/SectionList";
import TaskDetailPanel from "@/components/TaskDetailPanel";
import { type TaskItem } from "@/components/TaskCard";

// ── Props ─────────────────────────────────────────────────────────────────────

export interface MyWorkContentProps {
  viewerName: string;
  today: TaskItem[];
  thisWeek: TaskItem[];
  inProgress: TaskItem[];
  waiting: TaskItem[];
  review: TaskItem[];
  later: TaskItem[];
  /** Task ID → project info for detail panel */
  taskProjects: Record<string, { id: string; name: string }>;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function MyWorkContent({
  viewerName,
  today,
  thisWeek,
  inProgress,
  waiting,
  review,
  later,
  taskProjects,
}: MyWorkContentProps) {
  const router = useRouter();
  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  // Poll every 30 seconds
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

  const selectedProject = selectedTask
    ? taskProjects[selectedTask.id]
    : undefined;

  return (
    <>
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        {/* Page header */}
        <header className="mb-10">
          <p className="text-xs font-semibold uppercase tracking-widest text-text-tertiary mb-1.5">
            개인
          </p>
          <h1 className="font-serif text-2xl font-semibold text-text leading-tight">
            내 업무
          </h1>
          <p className="mt-1.5 text-sm text-text-secondary">
            <span className="font-medium text-text-secondary">{viewerName}</span>
            님의 담당 업무를 긴급도 순으로 보여줍니다.
          </p>
        </header>

        {/* Sections */}
        <div className="flex flex-col gap-10">
          {/* Today */}
          <SectionList
            title="오늘"
            tasks={today}
            onTaskClick={handleTaskClick}
            emptyTitle="오늘 마감할 업무가 없습니다"
            emptyDescription="오늘 마감인 업무가 여기에 표시됩니다."
            emptyIcon={<Sun className="h-5 w-5" />}
          />

          {/* This Week */}
          <SectionList
            title="이번 주"
            tasks={thisWeek}
            onTaskClick={handleTaskClick}
            emptyTitle="이번 주 마감할 업무가 없습니다"
            emptyDescription="앞으로 7일 안에 마감인 업무가 여기에 표시됩니다."
            emptyIcon={<CalendarDays className="h-5 w-5" />}
          />

          {/* In Progress */}
          <SectionList
            title="진행 중"
            tasks={inProgress}
            onTaskClick={handleTaskClick}
            emptyTitle="진행 중인 업무가 없습니다"
            emptyDescription="현재 진행 중인 업무가 여기에 표시됩니다."
            emptyIcon={<Loader2 className="h-5 w-5" />}
          />

          {/* Waiting */}
          <SectionList
            title="대기 중"
            tasks={waiting}
            onTaskClick={handleTaskClick}
            emptyTitle="대기 중인 업무가 없습니다"
            emptyDescription="회신이나 승인을 기다리는 업무가 여기에 표시됩니다."
            emptyIcon={<Clock className="h-5 w-5" />}
          />

          {/* Review */}
          <SectionList
            title="검토 중"
            tasks={review}
            onTaskClick={handleTaskClick}
            emptyTitle="검토할 업무가 없습니다"
            emptyDescription="검토가 필요한 업무가 여기에 표시됩니다."
            emptyIcon={<Eye className="h-5 w-5" />}
          />

          {/* Later */}
          <SectionList
            title="나중에"
            tasks={later}
            onTaskClick={handleTaskClick}
            emptyTitle="예정된 업무가 없습니다"
            emptyDescription="일정이 정해지지 않은 업무가 여기에 표시됩니다."
            emptyIcon={<Archive className="h-5 w-5" />}
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
