-- Brand → Project → Task hierarchy.
--
-- Existing projects are kept intact and filed under one reversible
-- "브랜드 미지정" container per workspace. People can then create real brands
-- and move projects without losing any work.

CREATE TABLE `brand` (
  `id` text PRIMARY KEY NOT NULL,
  `workspace_id` text NOT NULL,
  `name` text NOT NULL,
  `color` text DEFAULT '#0a84ff' NOT NULL,
  `archived_at` text,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE no action
);--> statement-breakpoint

CREATE INDEX `idx_brand_workspace` ON `brand` (`workspace_id`,`archived_at`);--> statement-breakpoint

ALTER TABLE `project` ADD `brand_id` text REFERENCES brand(id);--> statement-breakpoint

INSERT INTO `brand` (
  `id`, `workspace_id`, `name`, `color`, `archived_at`, `created_at`, `updated_at`
)
SELECT
  'brand-unfiled-' || `id`,
  `id`,
  '브랜드 미지정',
  '#8e8e93',
  NULL,
  `created_at`,
  `created_at`
FROM `workspace`
WHERE EXISTS (
  SELECT 1 FROM `project` p WHERE p.`workspace_id` = `workspace`.`id`
);--> statement-breakpoint

UPDATE `project`
SET `brand_id` = 'brand-unfiled-' || `workspace_id`
WHERE `brand_id` IS NULL;--> statement-breakpoint

CREATE INDEX `idx_project_brand` ON `project` (`brand_id`,`archived_at`);
