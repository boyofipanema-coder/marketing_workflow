import { eq } from "drizzle-orm";
import {
  project,
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
  name: string;
  projectLeadId: string;
  oneLineObjective?: string | null;
  targetStartDate?: string | null;
  targetEndDate?: string | null;
}

export interface ProjectPatch {
  name?: string;
  oneLineObjective?: string | null;
  projectLeadId?: string;
  targetStartDate?: string | null;
  targetEndDate?: string | null;
  archivedAt?: string | null;
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

// ---------------------------------------------------------------------------
// Service functions
// ---------------------------------------------------------------------------

export async function createProject(
  db: Database,
  params: CreateProjectParams
): Promise<Project> {
  const name = validateProjectName(params.name);
  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  const newProject: NewProject = {
    id,
    workspace_id: params.workspaceId,
    name,
    one_line_objective: params.oneLineObjective ?? null,
    project_lead_id: params.projectLeadId,
    target_start_date: params.targetStartDate ?? null,
    target_end_date: params.targetEndDate ?? null,
    archived_at: null,
    created_at: now,
    updated_at: now,
  };

  await db.insert(project).values(newProject);
  return newProject as Project;
}

export async function editProject(
  db: Database,
  projectId: string,
  patch: ProjectPatch
): Promise<Project> {
  const rows = await db
    .select()
    .from(project)
    .where(eq(project.id, projectId));
  const current = rows[0];
  if (!current) throw new NotFoundError(`Project ${projectId} not found`);

  const updates: Partial<Project> & { updated_at: string } = {
    updated_at: new Date().toISOString(),
  };

  if (patch.name !== undefined) {
    updates.name = validateProjectName(patch.name);
  }
  if (patch.oneLineObjective !== undefined) {
    updates.one_line_objective = patch.oneLineObjective;
  }
  if (patch.projectLeadId !== undefined) {
    updates.project_lead_id = patch.projectLeadId;
  }
  if (patch.targetStartDate !== undefined) {
    updates.target_start_date = patch.targetStartDate;
  }
  if (patch.targetEndDate !== undefined) {
    updates.target_end_date = patch.targetEndDate;
  }
  if (patch.archivedAt !== undefined) {
    updates.archived_at = patch.archivedAt;
  }

  await db.update(project).set(updates).where(eq(project.id, projectId));
  return { ...current, ...updates } as Project;
}
