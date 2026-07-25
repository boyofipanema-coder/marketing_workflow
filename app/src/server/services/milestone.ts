import { eq } from "drizzle-orm";
import {
  milestone,
  type Milestone,
  type NewMilestone,
} from "@/server/db/schema";
import { type Database } from "@/server/db/client";
import { NotFoundError, ValidationError } from "./errors";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreateMilestoneParams {
  projectId: string;
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

function validateDueDate(raw: string): void {
  if (!raw || !raw.trim())
    throw new ValidationError("마일스톤 마감일을 선택해 주세요.");
}

// ---------------------------------------------------------------------------
// Service functions
// ---------------------------------------------------------------------------

export async function createMilestone(
  db: Database,
  params: CreateMilestoneParams
): Promise<Milestone> {
  const name = validateName(params.name);
  validateDueDate(params.dueDate);

  const id = crypto.randomUUID();

  const newMilestone: NewMilestone = {
    id,
    project_id: params.projectId,
    name,
    due_date: params.dueDate,
  };

  await db.insert(milestone).values(newMilestone);
  return newMilestone as Milestone;
}

export async function editMilestone(
  db: Database,
  milestoneId: string,
  patch: MilestonePatch
): Promise<Milestone> {
  const rows = await db
    .select()
    .from(milestone)
    .where(eq(milestone.id, milestoneId));
  const current = rows[0];
  if (!current) throw new NotFoundError(`Milestone ${milestoneId} not found`);

  const updates: Partial<Milestone> = {};

  if (patch.name !== undefined) {
    updates.name = validateName(patch.name);
  }
  if (patch.dueDate !== undefined) {
    validateDueDate(patch.dueDate);
    updates.due_date = patch.dueDate;
  }

  await db.update(milestone).set(updates).where(eq(milestone.id, milestoneId));
  return { ...current, ...updates } as Milestone;
}
