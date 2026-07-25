import {
  getCurrentMember,
  getWorkspaceTasks,
  getWorkspaceProjects,
  getWorkspaceMembers,
  memberMap,
  toTaskItem,
} from "@/server/data/queries";
import {
  myFocus,
  needsAttention,
  comingNext,
} from "@/lib/derive";
import HomeContent from "@/components/HomeContent";

/**
 * Home page — server component.
 * Fetches real D1 data and passes pre-computed sections to the client component.
 */
export default async function HomePage() {
  const { member: viewer, db } = await getCurrentMember();

  const [tasks, projects, members] = await Promise.all([
    getWorkspaceTasks(db, viewer.workspace_id),
    getWorkspaceProjects(db, viewer.workspace_id),
    getWorkspaceMembers(db, viewer.workspace_id),
  ]);

  const members_map = memberMap(members);
  const now = new Date();

  // Compute sections using derive.ts predicates
  const myFocusTasks = myFocus(tasks, viewer.id).map((t) =>
    toTaskItem(t, members_map, now)
  );
  const needsAttentionTasks = needsAttention(tasks, now).map((t) =>
    toTaskItem(t, members_map, now)
  );
  const comingNextTasks = comingNext(tasks, now).map((t) =>
    toTaskItem(t, members_map, now)
  );

  // Build task → project name lookup for the detail panel
  const projectLookup = Object.fromEntries(
    projects.map((p) => [p.id, { id: p.id, name: p.name }])
  );
  const taskProjects: Record<string, { id: string; name: string }> = {};
  for (const t of tasks) {
    if (t.project_id && projectLookup[t.project_id]) {
      taskProjects[t.id] = projectLookup[t.project_id]!;
    }
  }

  return (
    <HomeContent
      viewerName={viewer.name}
      myFocus={myFocusTasks}
      needsAttention={needsAttentionTasks}
      comingNext={comingNextTasks}
      taskProjects={taskProjects}
    />
  );
}
