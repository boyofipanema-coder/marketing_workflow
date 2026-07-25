import {
  getCurrentMember,
  getInboxTasks,
  getWorkspaceProjects,
  getWorkspaceWorkstreams,
  getWorkspaceMembers,
} from "@/server/data/queries";
import InboxContent from "./InboxContent";

/** Team Inbox — tasks captured via Quick Add that have no project yet. */
export default async function InboxPage() {
  const { member: viewer, db } = await getCurrentMember();
  const workspaceId = viewer.workspace_id;

  const [tasks, projects, workstreams, members] = await Promise.all([
    getInboxTasks(db, workspaceId),
    getWorkspaceProjects(db, workspaceId),
    getWorkspaceWorkstreams(db, workspaceId),
    getWorkspaceMembers(db, workspaceId),
  ]);

  return (
    <InboxContent
      tasks={tasks}
      projects={projects}
      workstreams={workstreams}
      members={members}
    />
  );
}
