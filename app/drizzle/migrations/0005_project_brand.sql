-- Brand is the new top-level grouping above project — a fixed, closed list
-- (see lib/brand.ts), so a plain enum column rather than a lookup table.
-- Additive only; existing rows default to '공통' (shared/unassigned).
ALTER TABLE `project` ADD `brand` text DEFAULT '공통' NOT NULL;
