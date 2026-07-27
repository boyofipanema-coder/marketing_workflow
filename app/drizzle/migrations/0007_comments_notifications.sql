CREATE TABLE `task_comment` (
  `id` text PRIMARY KEY NOT NULL,
  `workspace_id` text NOT NULL,
  `task_id` text NOT NULL,
  `author_id` text NOT NULL,
  `body` text NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`),
  FOREIGN KEY (`task_id`) REFERENCES `task`(`id`),
  FOREIGN KEY (`author_id`) REFERENCES `member`(`id`)
);
--> statement-breakpoint
CREATE INDEX `task_comment_task_created_idx` ON `task_comment` (`task_id`, `created_at`);
--> statement-breakpoint
CREATE TABLE `notification` (
  `id` text PRIMARY KEY NOT NULL,
  `workspace_id` text NOT NULL,
  `recipient_id` text NOT NULL,
  `actor_id` text NOT NULL,
  `task_id` text NOT NULL,
  `comment_id` text,
  `kind` text DEFAULT 'mention' NOT NULL,
  `read_at` text,
  `created_at` text NOT NULL,
  FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`),
  FOREIGN KEY (`recipient_id`) REFERENCES `member`(`id`),
  FOREIGN KEY (`actor_id`) REFERENCES `member`(`id`),
  FOREIGN KEY (`task_id`) REFERENCES `task`(`id`),
  FOREIGN KEY (`comment_id`) REFERENCES `task_comment`(`id`)
);
--> statement-breakpoint
CREATE INDEX `notification_recipient_read_idx` ON `notification` (`recipient_id`, `read_at`, `created_at`);
