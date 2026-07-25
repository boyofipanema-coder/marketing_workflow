import {
  getCurrentMember,
  getWorkspaceTasks,
  getWorkspaceProjects,
  getWorkspaceMembers,
  memberMap,
  toTaskItem,
} from "@/server/data/queries";
import {
  todayTasks,
  thisWeek,
  inProgress,
  waiting,
  review,
  later,
} from "@/lib/derive";
import MyWorkContent from "@/components/MyWorkContent";

/**
 * My Work page — server component.
 * Fetches real D1 data and passes pre-computed sections to the client component.
 */
export default async function MyWorkPage() {
  const { member: viewer, db } = await getCurrentMember();

  const [tasks, projects, members] = await Promise.all([
    getWorkspaceTasks(db, viewer.workspace_id),
    getWorkspaceProjects(db, viewer.workspace_id),
    getWorkspaceMembers(db, viewer.workspace_id),
  ]);

  const members_map = memberMap(members);
  const now = new Date();

  // Compute sections using derive.ts predicates for the current viewer
  const todayItems = todayTasks(tasks, viewer.id, now).map((t) =>
    toTaskItem(t, members_map, now)
  );
  const thisWeekItems = thisWeek(tasks, viewer.id, now).map((t) =>
    toTaskItem(t, members_map, now)
  );
  const inProgressItems = inProgress(tasks, viewer.id).map((t) =>
    toTaskItem(t, members_map, now)
  );
  const waitingItems = waiting(tasks, viewer.id).map((t) =>
    toTaskItem(t, members_map, now)
  );
  const reviewItems = review(tasks, viewer.id).map((t) =>
    toTaskItem(t, members_map, now)
  );
  const laterItems = later(tasks, viewer.id).map((t) =>
    toTaskItem(t, members_map, now)
  );

  // Build task → project lookup for detail panel
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
    <MyWorkContent
      viewerName={viewer.name}
      today={todayItems}
      thisWeek={thisWeekItems}
      inProgress={inProgressItems}
      waiting={waitingItems}
      review={reviewItems}
      later={laterItems}
      taskProjects={taskProjects}
    />
  );
}
