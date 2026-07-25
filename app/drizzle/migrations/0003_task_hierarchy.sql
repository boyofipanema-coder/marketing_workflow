-- Task hierarchy: separate "how important" from "where it sits in the tree".
-- Additive only; every existing row keeps its current behaviour via defaults.

-- 'key' marks a task the project is actually steered by. Deliberately two
-- values, not a 1-5 scale: a scale invites everyone to pick the middle.
ALTER TABLE `task` ADD `importance` text DEFAULT 'normal' NOT NULL;--> statement-breakpoint

-- A milestone is a task-shaped thing: it belongs to a workstream, has a date,
-- an owner, and can depend on other work. Modelling it as a task kind avoids
-- duplicating all of that alongside the separate `milestone` table.
ALTER TABLE `task` ADD `kind` text DEFAULT 'task' NOT NULL;--> statement-breakpoint

CREATE INDEX `idx_task_project_importance` ON `task` (`project_id`,`importance`);
