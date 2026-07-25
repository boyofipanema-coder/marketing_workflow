import {
  getCurrentMember,
  getWorkspaceProjects,
  getArchivedProjects,
  getWorkspaceMembers,
  getWorkspaceTasks,
  getWorkspaceMilestones,
} from "@/server/data/queries";
import ProjectsContent from "./ProjectsContent";

/**
 * Projects list page — server component.
 * Reads real D1 data; creation, editing, and archiving happen in the client
 * component via server actions.
 */
export default async function ProjectsPage() {
  const { member: viewer, db } = await getCurrentMember();
  const workspaceId = viewer.workspace_id;

  const [projects, archivedProjects, tasks, members, milestones] =
    await Promise.all([
      getWorkspaceProjects(db, workspaceId),
      getArchivedProjects(db, workspaceId),
      getWorkspaceTasks(db, workspaceId),
      getWorkspaceMembers(db, workspaceId),
      getWorkspaceMilestones(db, workspaceId),
    ]);

  return (
    <ProjectsContent
      projects={projects}
      archivedProjects={archivedProjects}
      tasks={tasks}
      members={members}
      milestones={milestones}
      viewerId={viewer.id}
    />
  );
}
