import Link from "next/link";
import { Briefcase } from "lucide-react";
import {
  getCurrentMember,
  getWorkspaceProjects,
  getWorkspaceMembers,
  getWorkspaceTasks,
  memberMap,
} from "@/server/data/queries";

/**
 * Projects list page — server component.
 * Reads real D1 data and displays projects with lead and in-progress task count.
 */
export default async function ProjectsPage() {
  const { member: viewer, db } = await getCurrentMember();

  const [projects, tasks, members] = await Promise.all([
    getWorkspaceProjects(db, viewer.workspace_id),
    getWorkspaceTasks(db, viewer.workspace_id),
    getWorkspaceMembers(db, viewer.workspace_id),
  ]);

  const members_map = memberMap(members);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="font-serif text-2xl font-semibold text-text">
          프로젝트
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          진행 중인 프로젝트 {projects.length}개
        </p>
      </div>

      {/* Project cards */}
      <ul
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        role="list"
        aria-label="프로젝트 목록"
      >
        {projects.map((project) => {
          const lead = project.project_lead_id
            ? members_map.get(project.project_lead_id)
            : undefined;
          const inProgressCount = tasks.filter(
            (t) => t.project_id === project.id && t.status === "InProgress"
          ).length;

          const leadInitials = lead
            ? lead.name
                .split(" ")
                .slice(0, 2)
                .map((w) => w[0])
                .join("")
                .toUpperCase()
            : "?";

          return (
            <li key={project.id}>
              <Link
                href={`/projects/${project.id}`}
                className="group flex flex-col gap-4 rounded-xl border border-separator bg-surface p-5 shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                aria-label={`프로젝트 열기: ${project.name}`}
              >
                {/* Icon + in-progress badge */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-surface-2 text-text-secondary">
                    <Briefcase className="h-4 w-4" aria-hidden />
                  </div>

                  {inProgressCount > 0 && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-2.5 py-0.5 text-xs font-medium text-accent">
                      <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                      진행 중 {inProgressCount}건
                    </span>
                  )}
                </div>

                {/* Project name + objective */}
                <div className="flex-1">
                  <h2 className="font-serif text-base font-semibold text-text leading-snug transition-colors group-hover:text-text-secondary">
                    {project.name}
                  </h2>
                  {project.one_line_objective && (
                    <p className="mt-1.5 line-clamp-2 text-xs text-text-secondary leading-relaxed">
                      {project.one_line_objective}
                    </p>
                  )}
                </div>

                {/* Lead */}
                <div className="flex items-center gap-2 border-t border-separator pt-3">
                  {lead ? (
                    <div className="flex items-center gap-1.5">
                      <span
                        className="flex h-5 w-5 items-center justify-center rounded-full bg-surface-3 text-[9px] font-semibold text-text-secondary"
                        aria-hidden
                      >
                        {leadInitials}
                      </span>
                      <span className="text-xs text-text-secondary">{lead.name}</span>
                    </div>
                  ) : (
                    <span className="text-xs text-text-tertiary">프로젝트 리드 미지정</span>
                  )}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
