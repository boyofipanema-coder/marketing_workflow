import CalendarContent from "@/components/calendar/CalendarContent";
import { todayKST } from "@/lib/derive";
import {
  getCurrentMember,
  getWorkspaceMembers,
  getWorkspaceProjects,
  getWorkspaceTasks,
  getWorkspaceWorkstreams,
} from "@/server/data/queries";

export default async function CalendarPage() {
  const { member, db } = await getCurrentMember();
  const today = todayKST(new Date());
  const [tasks, projects, workstreams, members] = await Promise.all([
    getWorkspaceTasks(db, member.workspace_id),
    getWorkspaceProjects(db, member.workspace_id),
    getWorkspaceWorkstreams(db, member.workspace_id),
    getWorkspaceMembers(db, member.workspace_id),
  ]);

  return (
    <CalendarContent
      tasks={tasks}
      projects={projects}
      workstreams={workstreams}
      members={members}
      today={today}
    />
  );
}
