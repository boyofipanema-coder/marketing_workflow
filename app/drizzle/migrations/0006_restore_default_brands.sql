-- Restore the closed brand set used by the original canvas. The brand rows
-- remain real workspace data, so projects keep a proper Brand → Project FK.
ALTER TABLE brand ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 999;

WITH default_brand(name, color, position) AS (
  VALUES
    ('BEAKER 공통', '#0a84ff', 1),
    ('BEAKER 바잉', '#5e5ce6', 2),
    ('BEAKER OG', '#af52de', 3),
    ('Maison Kitsune', '#ff375f', 4),
    ('GANNI', '#ff9500', 5),
    ('Studio Nicholson', '#30b0c7', 6),
    ('Kaptain Sunshine', '#34c759', 7),
    ('Margaret Howell', '#8e8e93', 8),
    ('Auralee', '#bf5af2', 9),
    ('공통', '#64d2ff', 10)
)
INSERT INTO brand (
  id, workspace_id, name, color, sort_order, archived_at, created_at, updated_at
)
SELECT
  'brand-default-' || printf('%02d', default_brand.position) || '-' || workspace.id,
  workspace.id,
  default_brand.name,
  default_brand.color,
  default_brand.position,
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM workspace
CROSS JOIN default_brand
WHERE NOT EXISTS (
  SELECT 1
  FROM brand existing
  WHERE existing.workspace_id = workspace.id
    AND lower(existing.name) = lower(default_brand.name)
);

-- Recover obvious assignments from project-name prefixes first.
UPDATE project
SET brand_id = (
  SELECT candidate.id
  FROM brand candidate
  JOIN brand placeholder ON placeholder.id = project.brand_id
  WHERE candidate.workspace_id = project.workspace_id
    AND placeholder.name = '브랜드 미지정'
    AND lower(project.name) LIKE lower(candidate.name) || '%'
    AND candidate.name <> '공통'
  ORDER BY length(candidate.name) DESC
  LIMIT 1
)
WHERE EXISTS (
  SELECT 1
  FROM brand placeholder
  JOIN brand candidate ON candidate.workspace_id = project.workspace_id
  WHERE placeholder.id = project.brand_id
    AND placeholder.name = '브랜드 미지정'
    AND lower(project.name) LIKE lower(candidate.name) || '%'
    AND candidate.name <> '공통'
);

-- Anything that cannot be inferred keeps the former default semantics: 공통.
UPDATE project
SET brand_id = (
  SELECT common.id
  FROM brand common
  WHERE common.workspace_id = project.workspace_id
    AND common.name = '공통'
  LIMIT 1
)
WHERE brand_id IS NULL
   OR brand_id IN (
     SELECT placeholder.id
     FROM brand placeholder
     WHERE placeholder.workspace_id = project.workspace_id
       AND placeholder.name = '브랜드 미지정'
   );

-- Keep the generated placeholder recoverable, but remove it from active UI.
UPDATE brand
SET archived_at = CURRENT_TIMESTAMP,
    updated_at = CURRENT_TIMESTAMP
WHERE name = '브랜드 미지정'
  AND NOT EXISTS (
    SELECT 1 FROM project WHERE project.brand_id = brand.id
  );
