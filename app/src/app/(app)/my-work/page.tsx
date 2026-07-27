import {
  getCurrentMember,
  getWorkspaceTasks,
  getWorkspaceProjects,
  getWorkspaceWorkstreams,
  getWorkspaceMembers,
} from "@/server/data/queries";
import MyWorkContent from "@/components/MyWorkContent";
import { getMemberNotifications } from "@/server/services/collaboration";

/**
 * My Work page — server component.
 *
 * Sections are derived client-side so changing a due date or status moves the
 * task between sections immediately.
 */
export default async function MyWorkPage() {
  const { member: viewer, db } = await getCurrentMember();
  const workspaceId = viewer.workspace_id;

  const [tasks, projects, workstreams, members, notifications] = await Promise.all([
    getWorkspaceTasks(db, workspaceId),
    getWorkspaceProjects(db, workspaceId),
    getWorkspaceWorkstreams(db, workspaceId),
    getWorkspaceMembers(db, workspaceId),
    getMemberNotifications(db, workspaceId, viewer.id),
  ]);

  return (
    <MyWorkContent
      viewerId={viewer.id}
      viewerName={viewer.name}
      tasks={tasks}
      projects={projects}
      workstreams={workstreams}
      members={members}
      notifications={notifications}
    />
  );
}
