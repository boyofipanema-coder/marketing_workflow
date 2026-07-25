-- Core Task MVP recovery: additive only.
-- No DROP / RENAME / data deletion. Safe to apply on top of existing rows.

ALTER TABLE `task` ADD `sort_order` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `task` ADD `due_time` text;--> statement-breakpoint
ALTER TABLE `task` ADD `waiting_type` text;--> statement-breakpoint
ALTER TABLE `task` ADD `waiting_on_text` text;--> statement-breakpoint
ALTER TABLE `task` ADD `waiting_party_text` text;--> statement-breakpoint
ALTER TABLE `task` ADD `waiting_owner_member_id` text REFERENCES member(id);--> statement-breakpoint
ALTER TABLE `task` ADD `follow_up_at` text;--> statement-breakpoint
ALTER TABLE `task` ADD `blocked_reason` text;--> statement-breakpoint
ALTER TABLE `task` ADD `blocked_resolution_action` text;--> statement-breakpoint

CREATE TABLE `task_dependency` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`predecessor_task_id` text NOT NULL,
	`successor_task_id` text NOT NULL,
	`dependency_type` text DEFAULT 'finish_to_start' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`predecessor_task_id`) REFERENCES `task`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`successor_task_id`) REFERENCES `task`(`id`) ON UPDATE no action ON DELETE no action,
	CHECK (`predecessor_task_id` <> `successor_task_id`)
);--> statement-breakpoint

CREATE UNIQUE INDEX `idx_task_dependency_pair` ON `task_dependency` (`predecessor_task_id`,`successor_task_id`);--> statement-breakpoint
CREATE INDEX `idx_task_dependency_successor` ON `task_dependency` (`successor_task_id`);--> statement-breakpoint

CREATE INDEX `idx_task_project_sort` ON `task` (`project_id`,`parent_task_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `idx_task_workspace_status` ON `task` (`workspace_id`,`status`);--> statement-breakpoint

-- Backfill sort_order within each (project_id, parent_task_id) group by created_at, id.
-- Existing rows all default to 0; this gives them a stable, deterministic order.
UPDATE `task`
SET `sort_order` = (
  SELECT COUNT(*)
  FROM `task` AS peer
  WHERE peer.`workspace_id` = `task`.`workspace_id`
    AND (peer.`project_id` IS `task`.`project_id`)
    AND (peer.`parent_task_id` IS `task`.`parent_task_id`)
    AND (
      peer.`created_at` < `task`.`created_at`
      OR (peer.`created_at` = `task`.`created_at` AND peer.`id` < `task`.`id`)
    )
);
