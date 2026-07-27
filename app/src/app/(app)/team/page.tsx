import TeamOverview from "@/components/team/TeamOverview";
import {
  getCurrentMember,
  getWorkspaceBrands,
  getWorkspaceMembers,
  getWorkspaceProjects,
  getWorkspaceTasks,
  getWorkspaceWorkstreams,
} from "@/server/data/queries";

export default async function TeamPage() {
  const { member: viewer, db } = await getCurrentMember();
  const [tasks, members, brands, projects, workstreams] = await Promise.all([
    getWorkspaceTasks(db, viewer.workspace_id),
    getWorkspaceMembers(db, viewer.workspace_id),
    getWorkspaceBrands(db, viewer.workspace_id),
    getWorkspaceProjects(db, viewer.workspace_id),
    getWorkspaceWorkstreams(db, viewer.workspace_id),
  ]);
  return (
    <TeamOverview
      tasks={tasks}
      members={members}
      brands={brands}
      projects={projects}
      workstreams={workstreams}
    />
  );
}
