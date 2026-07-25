import { eq } from "drizzle-orm";
import {
  milestone,
  type Milestone,
  type NewMilestone,
} from "@/server/db/schema";
import { type Database } from "@/server/db/client";
import { NotFoundError, ValidationError } from "./errors";
import { loadScopedProject } from "./project";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreateMilestoneParams {
  projectId: string;
  workspaceId: string;
  name: string;
  dueDate: string;
}

export interface MilestonePatch {
  name?: string;
  dueDate?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function validateName(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) throw new ValidationError("마일스톤 이름을 입력해 주세요.");
  if (trimmed.length > 200)
    throw new ValidationError("마일스톤 이름은 200자 이하로 입력해 주세요.");
  return trimmed;
}

function validateDueDate(raw: string): string {
  if (!raw || !raw.trim())
    throw new ValidationError("마일스톤 마감일을 선택해 주세요.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw new ValidationError("마감일은 YYYY-MM-DD 형식이어야 합니다.");
  }
  return raw;
}

/** Loads a milestone, verifying its project belongs to the caller's workspace. */
async function loadScopedMilestone(
  db: Database,
  milestoneId: string,
  workspaceId: string
): Promise<Milestone> {
  const rows = await db
    .select()
    .from(milestone)
    .where(eq(milestone.id, milestoneId));
  const current = rows[0];
  if (!current) throw new NotFoundError(`Milestone ${milestoneId} not found`);

  await loadScopedProject(db, current.project_id, workspaceId);
  return current;
}

// ---------------------------------------------------------------------------
// Service functions
// ---------------------------------------------------------------------------

export async function createMilestone(
  db: Database,
  params: CreateMilestoneParams
): Promise<Milestone> {
  const name = validateName(params.name);
  const dueDate = validateDueDate(params.dueDate);
  await loadScopedProject(db, params.projectId, params.workspaceId);

  const newMilestone: NewMilestone = {
    id: crypto.randomUUID(),
    project_id: params.projectId,
    name,
    due_date: dueDate,
  };

  await db.insert(milestone).values(newMilestone);
  return newMilestone as Milestone;
}

export async function editMilestone(
  db: Database,
  milestoneId: string,
  workspaceId: string,
  patch: MilestonePatch
): Promise<Milestone> {
  const current = await loadScopedMilestone(db, milestoneId, workspaceId);

  const updates: Partial<Milestone> = {};

  if (patch.name !== undefined) {
    updates.name = validateName(patch.name);
  }
  if (patch.dueDate !== undefined) {
    updates.due_date = validateDueDate(patch.dueDate);
  }

  await db.update(milestone).set(updates).where(eq(milestone.id, milestoneId));
  return { ...current, ...updates } as Milestone;
}
