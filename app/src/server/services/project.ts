import { and, eq, isNull, max } from "drizzle-orm";
import {
  project,
  brand,
  member as memberTable,
  type Project,
  type NewProject,
} from "@/server/db/schema";
import { type Database } from "@/server/db/client";
import { NotFoundError, ValidationError } from "./errors";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreateProjectParams {
  workspaceId: string;
  brandId?: string | null;
  name: string;
  projectLeadId: string;
  oneLineObjective?: string | null;
  targetStartDate?: string | null;
  targetEndDate?: string | null;
}

export interface ProjectPatch {
  brandId?: string | null;
  name?: string;
  oneLineObjective?: string | null;
  projectLeadId?: string;
  targetStartDate?: string | null;
  targetEndDate?: string | null;
}

async function assertBrandInWorkspace(
  db: Database,
  workspaceId: string,
  brandId: string
): Promise<void> {
  const [row] = await db
    .select({ id: brand.id })
    .from(brand)
    .where(and(eq(brand.id, brandId), eq(brand.workspace_id, workspaceId)));
  if (!row) throw new ValidationError("브랜드를 찾을 수 없습니다.");
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function validateProjectName(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) throw new ValidationError("프로젝트명을 입력해 주세요.");
  if (trimmed.length > 200)
    throw new ValidationError("프로젝트명은 200자 이하로 입력해 주세요.");
  return trimmed;
}

function validateDate(raw: string, field: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw new ValidationError(`${field}은(는) YYYY-MM-DD 형식이어야 합니다.`);
  }
  return raw;
}

/** The lead must be a member of the same workspace as the project. */
async function assertLeadInWorkspace(
  db: Database,
  workspaceId: string,
  leadId: string
): Promise<void> {
  const [lead] = await db
    .select()
    .from(memberTable)
    .where(
      and(eq(memberTable.id, leadId), eq(memberTable.workspace_id, workspaceId))
    );
  if (!lead) {
    throw new ValidationError("프로젝트 리드를 팀에서 찾을 수 없습니다.");
  }
}

/** Loads a project scoped to the caller's workspace. Cross-workspace ids 404. */
export async function loadScopedProject(
  db: Database,
  projectId: string,
  workspaceId: string
): Promise<Project> {
  const rows = await db
    .select()
    .from(project)
    .where(
      and(eq(project.id, projectId), eq(project.workspace_id, workspaceId))
    );
  const current = rows[0];
  if (!current) throw new NotFoundError(`Project ${projectId} not found`);
  return current;
}

// ---------------------------------------------------------------------------
// Service functions
// ---------------------------------------------------------------------------

export async function createProject(
  db: Database,
  params: CreateProjectParams
): Promise<Project> {
  const name = validateProjectName(params.name);
  await assertLeadInWorkspace(db, params.workspaceId, params.projectLeadId);
  if (params.brandId)
    await assertBrandInWorkspace(db, params.workspaceId, params.brandId);

  const start = params.targetStartDate
    ? validateDate(params.targetStartDate, "시작일")
    : null;
  const end = params.targetEndDate
    ? validateDate(params.targetEndDate, "종료일")
    : null;
  if (start && end && start > end) {
    throw new ValidationError("시작일은 종료일보다 늦을 수 없습니다.");
  }

  const scope = params.brandId
    ? and(
        eq(project.workspace_id, params.workspaceId),
        eq(project.brand_id, params.brandId),
      )
    : and(eq(project.workspace_id, params.workspaceId), isNull(project.brand_id));
  const [lastProject] = await db
    .select({ value: max(project.sort_order) })
    .from(project)
    .where(scope);

  const now = new Date().toISOString();
  const newProject: NewProject = {
    id: crypto.randomUUID(),
    workspace_id: params.workspaceId,
    brand_id: params.brandId ?? null,
    name,
    one_line_objective: params.oneLineObjective ?? null,
    project_lead_id: params.projectLeadId,
    target_start_date: start,
    target_end_date: end,
    sort_order: (lastProject?.value ?? -1) + 1,
    archived_at: null,
    created_at: now,
    updated_at: now,
  };

  await db.insert(project).values(newProject);
  return newProject as Project;
}

/** Persist a complete project order inside one brand. */
export async function reorderProjects(
  db: Database,
  workspaceId: string,
  orderedIds: string[],
): Promise<void> {
  if (orderedIds.length === 0 || new Set(orderedIds).size !== orderedIds.length) {
    throw new ValidationError("프로젝트 순서를 다시 확인해 주세요.");
  }

  const rows = await db
    .select({ id: project.id, brandId: project.brand_id })
    .from(project)
    .where(
      and(eq(project.workspace_id, workspaceId), isNull(project.archived_at)),
    );
  const byId = new Map(rows.map((row) => [row.id, row]));
  const selected = orderedIds.map((id) => byId.get(id));
  if (selected.some((row) => !row)) {
    throw new ValidationError("순서를 바꿀 프로젝트를 찾을 수 없습니다.");
  }
  const brandId = selected[0]!.brandId;
  if (selected.some((row) => row!.brandId !== brandId)) {
    throw new ValidationError("같은 브랜드의 프로젝트끼리만 순서를 바꿀 수 있습니다.");
  }

  const scopeIds = rows
    .filter((row) => row.brandId === brandId)
    .map((row) => row.id);
  if (
    scopeIds.length !== orderedIds.length ||
    scopeIds.some((id) => !orderedIds.includes(id))
  ) {
    throw new ValidationError("브랜드의 모든 프로젝트를 포함해 순서를 바꿔 주세요.");
  }

  const updatedAt = new Date().toISOString();
  const statements = orderedIds.map((id, index) =>
    db
      .update(project)
      .set({ sort_order: index, updated_at: updatedAt })
      .where(and(eq(project.id, id), eq(project.workspace_id, workspaceId))),
  );
  await db.batch(statements as never);
}

export async function editProject(
  db: Database,
  projectId: string,
  workspaceId: string,
  patch: ProjectPatch
): Promise<Project> {
  const current = await loadScopedProject(db, projectId, workspaceId);
  if (current.archived_at !== null) {
    throw new ValidationError("보관된 프로젝트는 수정할 수 없습니다.");
  }

  const updates: Partial<Project> & { updated_at: string } = {
    updated_at: new Date().toISOString(),
  };

  if (patch.name !== undefined) {
    updates.name = validateProjectName(patch.name);
  }
  if (patch.brandId !== undefined) {
    if (patch.brandId)
      await assertBrandInWorkspace(db, workspaceId, patch.brandId);
    updates.brand_id = patch.brandId;
  }
  if (patch.oneLineObjective !== undefined) {
    updates.one_line_objective = patch.oneLineObjective;
  }
  if (patch.projectLeadId !== undefined) {
    await assertLeadInWorkspace(db, workspaceId, patch.projectLeadId);
    updates.project_lead_id = patch.projectLeadId;
  }
  if (patch.targetStartDate !== undefined) {
    updates.target_start_date = patch.targetStartDate
      ? validateDate(patch.targetStartDate, "시작일")
      : null;
  }
  if (patch.targetEndDate !== undefined) {
    updates.target_end_date = patch.targetEndDate
      ? validateDate(patch.targetEndDate, "종료일")
      : null;
  }

  const start =
    updates.target_start_date !== undefined
      ? updates.target_start_date
      : current.target_start_date;
  const end =
    updates.target_end_date !== undefined
      ? updates.target_end_date
      : current.target_end_date;
  if (start && end && start > end) {
    throw new ValidationError("시작일은 종료일보다 늦을 수 없습니다.");
  }

  await db
    .update(project)
    .set(updates)
    .where(
      and(eq(project.id, projectId), eq(project.workspace_id, workspaceId))
    );
  return { ...current, ...updates } as Project;
}

/**
 * Archive a project. Projects are never hard-deleted (plan §2.1) — archiving
 * hides them from the active list while leaving every task intact.
 */
export async function archiveProject(
  db: Database,
  projectId: string,
  workspaceId: string
): Promise<Project> {
  const current = await loadScopedProject(db, projectId, workspaceId);
  if (current.archived_at !== null) {
    throw new ValidationError("이미 보관된 프로젝트입니다.");
  }

  const now = new Date().toISOString();
  const updates = { archived_at: now, updated_at: now };

  await db
    .update(project)
    .set(updates)
    .where(
      and(eq(project.id, projectId), eq(project.workspace_id, workspaceId))
    );
  return { ...current, ...updates } as Project;
}

export async function restoreProject(
  db: Database,
  projectId: string,
  workspaceId: string
): Promise<Project> {
  const current = await loadScopedProject(db, projectId, workspaceId);
  if (current.archived_at === null) {
    throw new ValidationError("보관된 프로젝트가 아닙니다.");
  }

  const updates = {
    archived_at: null,
    updated_at: new Date().toISOString(),
  };

  await db
    .update(project)
    .set(updates)
    .where(
      and(eq(project.id, projectId), eq(project.workspace_id, workspaceId))
    );
  return { ...current, ...updates } as Project;
}
