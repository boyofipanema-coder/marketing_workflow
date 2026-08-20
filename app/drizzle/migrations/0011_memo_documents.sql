CREATE TABLE `memo_document` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`member_id` text NOT NULL,
	`title` text DEFAULT '제목 없는 메모' NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`mode` text DEFAULT 'simple' NOT NULL,
	`archived_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`member_id`) REFERENCES `member`(`id`) ON UPDATE no action ON DELETE no action,
	CHECK (`mode` IN ('simple', 'deep'))
);
--> statement-breakpoint
CREATE INDEX `idx_memo_document_member_updated` ON `memo_document` (`member_id`, `updated_at`);
--> statement-breakpoint
CREATE INDEX `idx_memo_document_workspace` ON `memo_document` (`workspace_id`);
--> statement-breakpoint
INSERT INTO `memo_document` (`id`, `workspace_id`, `member_id`, `title`, `body`, `mode`, `archived_at`, `created_at`, `updated_at`)
SELECT 'legacy-' || `member_id`, `workspace_id`, `member_id`, '빠른 메모', `body`, 'simple', NULL, `updated_at`, `updated_at`
FROM `personal_note`
WHERE length(trim(`body`)) > 0;
