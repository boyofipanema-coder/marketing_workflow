import {
  sqliteTable,
  text,
  integer,
  type AnySQLiteColumn,
} from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import { BRANDS } from "@/lib/brand";

// ---------------------------------------------------------------------------
// workspace
// ---------------------------------------------------------------------------
export const workspace = sqliteTable("workspace", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  timezone: text("timezone").notNull().default("Asia/Seoul"),
  created_at: text("created_at").notNull(),
});

// ---------------------------------------------------------------------------
// member
// ---------------------------------------------------------------------------
export const member = sqliteTable("member", {
  id: text("id").primaryKey(),
  workspace_id: text("workspace_id")
    .notNull()
    .references(() => workspace.id),
  name: text("name").notNull(),
  email: text("email").notNull(),
  role: text("role", { enum: ["admin", "member"] })
    .notNull()
    .default("member"),
});

// ---------------------------------------------------------------------------
// auth_account  (app-side auth link)
// ---------------------------------------------------------------------------
export const auth_account = sqliteTable("auth_account", {
  id: text("id").primaryKey(),
  member_id: text("member_id")
    .notNull()
    .references(() => member.id),
  email: text("email").notNull(),
  credential_hash: text("credential_hash").notNull(),
  created_at: text("created_at").notNull(),
});

// ---------------------------------------------------------------------------
// session
// ---------------------------------------------------------------------------
export const session = sqliteTable("session", {
  id: text("id").primaryKey(),
  member_id: text("member_id")
    .notNull()
    .references(() => member.id),
  expires_at: text("expires_at").notNull(),
});

// ---------------------------------------------------------------------------
// project
// ---------------------------------------------------------------------------
export const project = sqliteTable("project", {
  id: text("id").primaryKey(),
  workspace_id: text("workspace_id")
    .notNull()
    .references(() => workspace.id),
  name: text("name").notNull(),
  one_line_objective: text("one_line_objective"),
  /** Top-level grouping above project — fixed list, see lib/brand.ts. */
  brand: text("brand", { enum: BRANDS }).notNull().default("공통"),
  project_lead_id: text("project_lead_id")
    .notNull()
    .references(() => member.id),
  target_start_date: text("target_start_date"),
  target_end_date: text("target_end_date"),
  archived_at: text("archived_at"),
  created_at: text("created_at").notNull(),
  updated_at: text("updated_at").notNull(),
});

// ---------------------------------------------------------------------------
// workstream
// ---------------------------------------------------------------------------
export const workstream = sqliteTable("workstream", {
  id: text("id").primaryKey(),
  project_id: text("project_id")
    .notNull()
    .references(() => project.id),
  name: text("name").notNull(),
  order: integer("order").notNull().default(0),
});

// ---------------------------------------------------------------------------
// task
// ---------------------------------------------------------------------------
export const task = sqliteTable("task", {
  id: text("id").primaryKey(),
  workspace_id: text("workspace_id")
    .notNull()
    .references(() => workspace.id),
  project_id: text("project_id").references(() => project.id),
  workstream_id: text("workstream_id").references(() => workstream.id),
  // Self-referential hierarchy: a subtask points at its parent task. Top-level
  // tasks have parent_task_id = null. Enables the workflow board's inline
  // subtask expansion + progress rollup.
  parent_task_id: text("parent_task_id").references(
    (): AnySQLiteColumn => task.id,
  ),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status", {
    enum: ["Inbox", "ToDo", "InProgress", "Waiting", "Review", "Done"],
  })
    .notNull()
    .default("Inbox"),
  /**
   * How much the project turns on this task — deliberately independent of where
   * it sits in the tree. A subtask can be the most consequential thing in the
   * project, and the board has to be able to say so.
   */
  importance: text("importance", { enum: ["normal", "key"] })
    .notNull()
    .default("normal"),
  /** A milestone is a task-shaped marker, not a separate species. */
  kind: text("kind", { enum: ["task", "milestone"] })
    .notNull()
    .default("task"),
  assignee_id: text("assignee_id").references(() => member.id),
  reviewer_id: text("reviewer_id").references(() => member.id),
  start_date: text("start_date"),
  due_date: text("due_date"),
  /** Optional wall-clock time for due_date, "HH:mm" in the workspace timezone. */
  due_time: text("due_time"),
  /** Manual ordering within a (project_id, parent_task_id) group. */
  sort_order: integer("sort_order").notNull().default(0),
  // Waiting-state detail. Populated when status = "Waiting"; see MVP plan §2.8.
  waiting_type: text("waiting_type", {
    enum: [
      "ExternalReply",
      "InternalApproval",
      "Material",
      "PredecessorTask",
      "Decision",
      "Blocked",
      "Other",
    ],
  }),
  waiting_on_text: text("waiting_on_text"),
  waiting_party_text: text("waiting_party_text"),
  waiting_owner_member_id: text("waiting_owner_member_id").references(
    () => member.id,
  ),
  follow_up_at: text("follow_up_at"),
  blocked_reason: text("blocked_reason"),
  blocked_resolution_action: text("blocked_resolution_action"),
  version: integer("version").notNull().default(1),
  created_by: text("created_by")
    .notNull()
    .references(() => member.id),
  created_at: text("created_at").notNull(),
  updated_at: text("updated_at").notNull(),
  completed_at: text("completed_at"),
  cancelled_at: text("cancelled_at"),
});

// ---------------------------------------------------------------------------
// milestone — LEGACY, no longer read or written.
//
// Migration 0004 moved every row into `task` with kind = "milestone"; a
// milestone is now a task, so it inherits owners, dates, dependencies and the
// activity log for free. The table is kept only as the record of that move.
// Read milestones through the milestone service or getProjectMilestones().
// ---------------------------------------------------------------------------
export const milestone = sqliteTable("milestone", {
  id: text("id").primaryKey(),
  project_id: text("project_id")
    .notNull()
    .references(() => project.id),
  name: text("name").notNull(),
  due_date: text("due_date").notNull(),
});

// ---------------------------------------------------------------------------
// task_dependency  — Finish-to-Start only for this recovery scope
// ---------------------------------------------------------------------------
export const task_dependency = sqliteTable("task_dependency", {
  id: text("id").primaryKey(),
  workspace_id: text("workspace_id")
    .notNull()
    .references(() => workspace.id),
  predecessor_task_id: text("predecessor_task_id")
    .notNull()
    .references((): AnySQLiteColumn => task.id),
  successor_task_id: text("successor_task_id")
    .notNull()
    .references((): AnySQLiteColumn => task.id),
  dependency_type: text("dependency_type", { enum: ["finish_to_start"] })
    .notNull()
    .default("finish_to_start"),
  created_at: text("created_at").notNull(),
});

// ---------------------------------------------------------------------------
// activity_log
// ---------------------------------------------------------------------------
export const activity_log = sqliteTable("activity_log", {
  id: text("id").primaryKey(),
  workspace_id: text("workspace_id")
    .notNull()
    .references(() => workspace.id),
  task_id: text("task_id")
    .notNull()
    .references(() => task.id),
  actor_id: text("actor_id")
    .notNull()
    .references(() => member.id),
  change_type: text("change_type").notNull(),
  from_value: text("from_value"),
  to_value: text("to_value"),
  created_at: text("created_at").notNull(),
});

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------
export const workspaceRelations = relations(workspace, ({ many }) => ({
  members: many(member),
  projects: many(project),
  tasks: many(task),
  activity_logs: many(activity_log),
}));

export const memberRelations = relations(member, ({ one, many }) => ({
  workspace: one(workspace, {
    fields: [member.workspace_id],
    references: [workspace.id],
  }),
  auth_accounts: many(auth_account),
  sessions: many(session),
  assigned_tasks: many(task, { relationName: "assignee" }),
  reviewed_tasks: many(task, { relationName: "reviewer" }),
  created_tasks: many(task, { relationName: "creator" }),
  led_projects: many(project),
}));

export const auth_accountRelations = relations(auth_account, ({ one }) => ({
  member: one(member, {
    fields: [auth_account.member_id],
    references: [member.id],
  }),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  member: one(member, {
    fields: [session.member_id],
    references: [member.id],
  }),
}));

export const projectRelations = relations(project, ({ one, many }) => ({
  workspace: one(workspace, {
    fields: [project.workspace_id],
    references: [workspace.id],
  }),
  project_lead: one(member, {
    fields: [project.project_lead_id],
    references: [member.id],
  }),
  workstreams: many(workstream),
  tasks: many(task),
  milestones: many(milestone),
}));

export const workstreamRelations = relations(workstream, ({ one, many }) => ({
  project: one(project, {
    fields: [workstream.project_id],
    references: [project.id],
  }),
  tasks: many(task),
}));

export const taskRelations = relations(task, ({ one, many }) => ({
  workspace: one(workspace, {
    fields: [task.workspace_id],
    references: [workspace.id],
  }),
  project: one(project, {
    fields: [task.project_id],
    references: [project.id],
  }),
  workstream: one(workstream, {
    fields: [task.workstream_id],
    references: [workstream.id],
  }),
  assignee: one(member, {
    fields: [task.assignee_id],
    references: [member.id],
    relationName: "assignee",
  }),
  reviewer: one(member, {
    fields: [task.reviewer_id],
    references: [member.id],
    relationName: "reviewer",
  }),
  created_by_member: one(member, {
    fields: [task.created_by],
    references: [member.id],
    relationName: "creator",
  }),
  parent: one(task, {
    fields: [task.parent_task_id],
    references: [task.id],
    relationName: "subtasks",
  }),
  subtasks: many(task, { relationName: "subtasks" }),
  activity_logs: many(activity_log),
}));

export const milestoneRelations = relations(milestone, ({ one }) => ({
  project: one(project, {
    fields: [milestone.project_id],
    references: [project.id],
  }),
}));

export const activity_logRelations = relations(activity_log, ({ one }) => ({
  workspace: one(workspace, {
    fields: [activity_log.workspace_id],
    references: [workspace.id],
  }),
  task: one(task, {
    fields: [activity_log.task_id],
    references: [task.id],
  }),
  actor: one(member, {
    fields: [activity_log.actor_id],
    references: [member.id],
  }),
}));

// ---------------------------------------------------------------------------
// Inferred Types
// ---------------------------------------------------------------------------
export type Workspace = typeof workspace.$inferSelect;
export type NewWorkspace = typeof workspace.$inferInsert;

export type Member = typeof member.$inferSelect;
export type NewMember = typeof member.$inferInsert;

export type AuthAccount = typeof auth_account.$inferSelect;
export type NewAuthAccount = typeof auth_account.$inferInsert;

export type Session = typeof session.$inferSelect;
export type NewSession = typeof session.$inferInsert;

export type Project = typeof project.$inferSelect;
export type NewProject = typeof project.$inferInsert;

export type Workstream = typeof workstream.$inferSelect;
export type NewWorkstream = typeof workstream.$inferInsert;

export type Task = typeof task.$inferSelect;
export type NewTask = typeof task.$inferInsert;

export type Milestone = typeof milestone.$inferSelect;
export type NewMilestone = typeof milestone.$inferInsert;

export type ActivityLog = typeof activity_log.$inferSelect;
export type NewActivityLog = typeof activity_log.$inferInsert;

export type TaskDependency = typeof task_dependency.$inferSelect;
export type NewTaskDependency = typeof task_dependency.$inferInsert;
