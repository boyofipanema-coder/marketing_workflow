import {
  getCurrentMember,
  getWorkspaceTasks,
  getWorkspaceBrands,
  getWorkspaceProjects,
  getWorkspaceWorkstreams,
  getWorkspaceMembers,
} from "@/server/data/queries";
import HomeContent from "@/components/HomeContent";
import { todayKST } from "@/lib/derive";

/**
 * Home page — server component.
 *
 * Hands the raw task set to the client, which derives each section itself so
 * an edit re-sorts the page without a round trip.
 */
export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string; task?: string }>;
}) {
  const {
    project: initialOpenProjectId,
    task: initialOpenTaskId,
  } = await searchParams;
  const { member: viewer, db } = await getCurrentMember();
  const workspaceId = viewer.workspace_id;

  const [tasks, brands, projects, workstreams, members] = await Promise.all([
    getWorkspaceTasks(db, workspaceId),
    getWorkspaceBrands(db, workspaceId),
    getWorkspaceProjects(db, workspaceId),
    getWorkspaceWorkstreams(db, workspaceId),
    getWorkspaceMembers(db, workspaceId),
  ]);

  return (
    <HomeContent
      viewerId={viewer.id}
      tasks={tasks}
      brands={brands}
      projects={projects}
      workstreams={workstreams}
      members={members}
      today={todayKST(new Date())}
      initialOpenProjectId={initialOpenProjectId}
      initialOpenTaskId={initialOpenTaskId}
    />
  );
}
