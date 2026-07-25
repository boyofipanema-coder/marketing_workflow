"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Briefcase, Plus, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui";
import EmptyState from "@/components/EmptyState";
import ProjectFormDialog from "@/components/projects/ProjectFormDialog";
import { restoreProjectAction } from "@/app/actions/projects";
import type { Project, Member, Task, Milestone } from "@/server/db/schema";

export interface ProjectsContentProps {
  projects: Project[];
  archivedProjects: Project[];
  tasks: Task[];
  members: Member[];
  milestones: Milestone[];
  viewerId: string;
}

function initials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

function fmt(iso: string): string {
  return new Date(iso).toLocaleDateString("ko-KR", {
    month: "long",
    day: "numeric",
  });
}

export default function ProjectsContent({
  projects,
  archivedProjects,
  tasks,
  members,
  milestones,
  viewerId,
}: ProjectsContentProps) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const membersById = new Map(members.map((m) => [m.id, m]));

  async function restore(projectId: string) {
    const result = await restoreProjectAction(projectId);
    if (!result.success) {
      setError(result.error ?? "복구하지 못했습니다.");
      return;
    }
    setError(null);
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-text">
            프로젝트
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            진행 중인 프로젝트 {projects.length}개
          </p>
        </div>

        <Button
          variant="primary"
          onClick={() => setCreateOpen(true)}
          className="flex-shrink-0"
        >
          <Plus aria-hidden />
          새 프로젝트
        </Button>
      </div>

      {error && (
        <p
          role="alert"
          className="mb-4 rounded-lg border border-flag-blocked/30 bg-flag-blocked/10 px-3 py-2 text-xs text-flag-blocked"
        >
          {error}
        </p>
      )}

      {projects.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface-2/40">
          <EmptyState
            icon={<Briefcase className="h-5 w-5" aria-hidden />}
            title="아직 프로젝트가 없습니다"
            description="프로젝트를 만들면 업무를 갈래별로 정리하고 진행 상황을 함께 볼 수 있습니다."
            action={
              <Button variant="primary" onClick={() => setCreateOpen(true)}>
                <Plus aria-hidden />
                새 프로젝트
              </Button>
            }
          />
        </div>
      ) : (
        <ul
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          role="list"
          aria-label="프로젝트 목록"
        >
          {projects.map((project) => {
            const lead = project.project_lead_id
              ? membersById.get(project.project_lead_id)
              : undefined;
            const projectTasks = tasks.filter(
              (t) => t.project_id === project.id && t.cancelled_at === null
            );
            const openCount = projectTasks.filter(
              (t) => t.status !== "Done"
            ).length;
            const nextMilestone = milestones
              .filter((m) => m.project_id === project.id)
              .sort((a, b) => (a.due_date < b.due_date ? -1 : 1))[0];

            return (
              <li key={project.id}>
                <Link
                  href={`/projects/${project.id}`}
                  className="group flex h-full flex-col gap-4 rounded-xl border border-separator bg-surface p-5 shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  aria-label={`프로젝트 열기: ${project.name}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-surface-2 text-text-secondary">
                      <Briefcase className="h-4 w-4" aria-hidden />
                    </div>
                    {openCount > 0 && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-2.5 py-0.5 text-xs font-medium text-accent">
                        <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                        남은 업무 {openCount}건
                      </span>
                    )}
                  </div>

                  <div className="flex-1">
                    <h2 className="font-serif text-base font-semibold leading-snug text-text transition-colors group-hover:text-text-secondary">
                      {project.name}
                    </h2>
                    {project.one_line_objective && (
                      <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-text-secondary">
                        {project.one_line_objective}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 border-t border-separator pt-3">
                    {lead ? (
                      <div className="flex items-center gap-1.5">
                        <span
                          className="flex h-5 w-5 items-center justify-center rounded-full bg-surface-3 text-[9px] font-semibold text-text-secondary"
                          aria-hidden
                        >
                          {initials(lead.name)}
                        </span>
                        <span className="text-xs text-text-secondary">
                          {lead.name}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-text-tertiary">
                        프로젝트 리드 미지정
                      </span>
                    )}

                    {nextMilestone && (
                      <span className="text-xs text-text-tertiary">
                        다음 마일스톤 · {nextMilestone.name}{" "}
                        <span className="tabular-nums">
                          {fmt(nextMilestone.due_date)}
                        </span>
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {archivedProjects.length > 0 && (
        <section className="mt-10" aria-label="보관된 프로젝트">
          <button
            type="button"
            onClick={() => setShowArchived((v) => !v)}
            aria-expanded={showArchived}
            className="text-xs font-semibold uppercase tracking-wider text-text-tertiary transition-colors hover:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            보관됨 {archivedProjects.length}
          </button>

          {showArchived && (
            <ul className="mt-3 flex flex-col gap-2" role="list">
              {archivedProjects.map((project) => (
                <li
                  key={project.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-separator bg-surface-2/50 px-4 py-3"
                >
                  <span className="truncate text-sm text-text-secondary">
                    {project.name}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void restore(project.id)}
                  >
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                    복구
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <ProjectFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        members={members}
        defaultLeadId={viewerId}
        onSaved={(created) => router.push(`/projects/${created.id}`)}
      />
    </div>
  );
}
