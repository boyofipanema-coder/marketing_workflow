CREATE TABLE `personal_note` (
	`member_id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `member`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_personal_note_workspace` ON `personal_note` (`workspace_id`);
