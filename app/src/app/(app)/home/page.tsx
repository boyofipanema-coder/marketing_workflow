import {
  getCurrentMember,
  getWorkspaceTasks,
  getDependencyMap,
  getWorkspaceProjects,
  getWorkspaceWorkstreams,
  getWorkspaceMembers,
} from "@/server/data/queries";
import HomeContent from "@/components/HomeContent";

/**
 * Home page — server component.
 *
 * Hands the raw task set to the client, which derives each section itself so
 * an edit re-sorts the page without a round trip.
 */
export default async function HomePage() {
  const { member: viewer, db } = await getCurrentMember();
  const workspaceId = viewer.workspace_id;

  const [tasks, dependencies, projects, workstreams, members] = await Promise.all([
    getWorkspaceTasks(db, workspaceId),
    getDependencyMap(db, workspaceId),
    getWorkspaceProjects(db, workspaceId),
    getWorkspaceWorkstreams(db, workspaceId),
    getWorkspaceMembers(db, workspaceId),
  ]);

  return (
    <HomeContent
      viewerId={viewer.id}
      tasks={tasks}
      dependencies={dependencies}
      projects={projects}
      workstreams={workstreams}
      members={members}
    />
  );
}
