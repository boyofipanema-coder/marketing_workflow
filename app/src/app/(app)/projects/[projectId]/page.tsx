import { notFound } from "next/navigation";
import {
  getCurrentMember,
  getProjectById,
  getProjectTasks,
  getProjectWorkstreams,
  getWorkspaceMembers,
  getProjectMilestones,
  memberMap,
} from "@/server/data/queries";
import ProjectWorkspace from "./ProjectWorkspace";

interface ProjectPageProps {
  params: Promise<{ projectId: string }>;
}

/**
 * Project workspace page — server component.
 * Validates the projectId against D1 and renders ProjectWorkspace with real data.
 */
export default async function ProjectPage({ params }: ProjectPageProps) {
  const { projectId } = await params;
  const { member: viewer, db } = await getCurrentMember();

  const project = await getProjectById(db, projectId);
  if (!project) {
    notFound();
  }

  const [tasks, workstreams, milestones, members] = await Promise.all([
    getProjectTasks(db, projectId),
    getProjectWorkstreams(db, projectId),
    getProjectMilestones(db, projectId),
    getWorkspaceMembers(db, viewer.workspace_id),
  ]);

  const members_map = memberMap(members);
  const membersRecord = Object.fromEntries(members_map);

  return (
    <ProjectWorkspace
      project={project}
      workstreams={workstreams}
      tasks={tasks}
      members={membersRecord}
      milestones={milestones}
    />
  );
}
