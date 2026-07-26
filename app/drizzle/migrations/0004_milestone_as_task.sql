-- Milestones become tasks.
--
-- A milestone was already a project-scoped, dated thing that other work depends
-- on and that someone owns — a task with a different shape on the board, not a
-- different species. Keeping a second table meant every capability (owners,
-- dependencies, activity log, workspace scoping) had to be built twice.
-- `task.kind` was added in 0003 for exactly this; this migration moves the rows.
--
-- The `milestone` table is deliberately left in place and no longer read.
-- Dropping it would make this migration irreversible, and keeping it costs
-- nothing while it serves as the record of what was moved.
--
-- Ids are derived ('ms-' || milestone.id) rather than generated, so re-running
-- this migration against a partly-migrated database is a no-op instead of a
-- duplicate.

INSERT INTO `task` (
  `id`, `workspace_id`, `project_id`, `workstream_id`, `parent_task_id`,
  `title`, `description`, `status`, `importance`, `kind`,
  `assignee_id`, `reviewer_id`, `start_date`, `due_date`, `due_time`,
  `sort_order`, `version`, `created_by`, `created_at`, `updated_at`,
  `completed_at`, `cancelled_at`
)
SELECT
  'ms-' || m.`id`,
  p.`workspace_id`,
  m.`project_id`,
  NULL,
  NULL,
  m.`name`,
  NULL,
  'ToDo',
  'normal',
  'milestone',
  NULL,
  NULL,
  NULL,
  m.`due_date`,
  NULL,
  -- Land after the project's existing top-level tasks, ordered by due date, so
  -- the group keeps a deterministic gap-free sequence.
  (SELECT COUNT(*) FROM `task` t2
     WHERE t2.`project_id` = m.`project_id` AND t2.`parent_task_id` IS NULL)
  + (SELECT COUNT(*) FROM `milestone` m2
       WHERE m2.`project_id` = m.`project_id`
         AND (m2.`due_date` < m.`due_date`
              OR (m2.`due_date` = m.`due_date` AND m2.`id` < m.`id`))),
  1,
  p.`project_lead_id`,
  p.`created_at`,
  p.`created_at`,
  NULL,
  NULL
FROM `milestone` m
JOIN `project` p ON p.`id` = m.`project_id`
WHERE NOT EXISTS (
  SELECT 1 FROM `task` t WHERE t.`id` = 'ms-' || m.`id`
);--> statement-breakpoint

CREATE INDEX `idx_task_project_kind` ON `task` (`project_id`,`kind`);
