CREATE TABLE `project_comment` (
  `id` text PRIMARY KEY NOT NULL,
  `workspace_id` text NOT NULL,
  `project_id` text NOT NULL,
  `author_id` text NOT NULL,
  `body` text NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`),
  FOREIGN KEY (`project_id`) REFERENCES `project`(`id`),
  FOREIGN KEY (`author_id`) REFERENCES `member`(`id`)
);
--> statement-breakpoint
CREATE INDEX `project_comment_project_created_idx` ON `project_comment` (`project_id`, `created_at`);
--> statement-breakpoint
CREATE TABLE `project_notification` (
  `id` text PRIMARY KEY NOT NULL,
  `workspace_id` text NOT NULL,
  `recipient_id` text NOT NULL,
  `actor_id` text NOT NULL,
  `project_id` text NOT NULL,
  `comment_id` text,
  `read_at` text,
  `created_at` text NOT NULL,
  FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`),
  FOREIGN KEY (`recipient_id`) REFERENCES `member`(`id`),
  FOREIGN KEY (`actor_id`) REFERENCES `member`(`id`),
  FOREIGN KEY (`project_id`) REFERENCES `project`(`id`),
  FOREIGN KEY (`comment_id`) REFERENCES `project_comment`(`id`)
);
--> statement-breakpoint
CREATE INDEX `project_notification_recipient_read_idx` ON `project_notification` (`recipient_id`, `read_at`, `created_at`);
