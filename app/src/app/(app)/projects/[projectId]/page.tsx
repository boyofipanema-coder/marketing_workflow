import { notFound } from "next/navigation";
import {
  getCurrentMember,
  getProjectById,
  getProjectTasks,
  getProjectWorkstreams,
  getWorkspaceMembers,
  getWorkspaceProjects,
  getWorkspaceWorkstreams,
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
  const workspaceId = viewer.workspace_id;

  const project = await getProjectById(db, projectId, workspaceId);
  if (!project) {
    notFound();
  }

  const [
    tasks,
    workstreams,
    milestones,
    members,
    allProjects,
    allWorkstreams,
  ] = await Promise.all([
    getProjectTasks(db, projectId, workspaceId),
    getProjectWorkstreams(db, projectId, workspaceId),
    getProjectMilestones(db, projectId, workspaceId),
    getWorkspaceMembers(db, workspaceId),
    getWorkspaceProjects(db, workspaceId),
    getWorkspaceWorkstreams(db, workspaceId),
  ]);

  const membersRecord = Object.fromEntries(memberMap(members));

  return (
    <ProjectWorkspace
      project={project}
      workstreams={workstreams}
      tasks={tasks}
      members={membersRecord}
      milestones={milestones}
      viewerId={viewer.id}
      allProjects={allProjects}
      allWorkstreams={allWorkstreams}
    />
  );
}
