import { Suspense } from "react";
import {
  getCurrentMember,
  getWorkspaceTasks,
  getWorkspaceProjects,
  getWorkspaceWorkstreams,
  getWorkspaceMembers,
} from "@/server/data/queries";
import SearchContent from "./SearchContent";

/**
 * Search page — server component.
 *
 * The workspace's tasks are small enough to filter client-side, which keeps
 * typing instant and lets results share the same optimistic edit path as every
 * other list.
 */
export default async function SearchPage() {
  const { member: viewer, db } = await getCurrentMember();
  const workspaceId = viewer.workspace_id;

  const [tasks, projects, workstreams, members] = await Promise.all([
    getWorkspaceTasks(db, workspaceId),
    getWorkspaceProjects(db, workspaceId),
    getWorkspaceWorkstreams(db, workspaceId),
    getWorkspaceMembers(db, workspaceId),
  ]);

  return (
    // useSearchParams needs a Suspense boundary to keep the route statically
    // renderable.
    <Suspense fallback={null}>
      <SearchContent
        tasks={tasks}
        projects={projects}
        workstreams={workstreams}
        members={members}
      />
    </Suspense>
  );
}
