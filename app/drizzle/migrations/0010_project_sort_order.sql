ALTER TABLE `project` ADD `sort_order` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
UPDATE `project`
SET `sort_order` = (
  SELECT COUNT(*)
  FROM `project` AS `peer`
  WHERE `peer`.`workspace_id` = `project`.`workspace_id`
    AND (`peer`.`brand_id` = `project`.`brand_id` OR (`peer`.`brand_id` IS NULL AND `project`.`brand_id` IS NULL))
    AND (`peer`.`created_at` < `project`.`created_at` OR (`peer`.`created_at` = `project`.`created_at` AND `peer`.`id` < `project`.`id`))
);
--> statement-breakpoint
CREATE INDEX `idx_project_workspace_brand_sort` ON `project` (`workspace_id`,`brand_id`,`sort_order`);
