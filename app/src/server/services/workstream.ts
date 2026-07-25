import { eq } from "drizzle-orm";
import {
  workstream,
  type Workstream,
  type NewWorkstream,
} from "@/server/db/schema";
import { type Database } from "@/server/db/client";
import { NotFoundError, ValidationError } from "./errors";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreateWorkstreamParams {
  projectId: string;
  name: string;
  /** Non-negative integer display order. Defaults to 0. */
  order?: number;
}

export interface WorkstreamPatch {
  name?: string;
  /** Non-negative integer display order. */
  order?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function validateName(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) throw new ValidationError("업무 영역 이름을 입력해 주세요.");
  if (trimmed.length > 200)
    throw new ValidationError("업무 영역 이름은 200자 이하로 입력해 주세요.");
  return trimmed;
}

function validateOrder(order: number): void {
  if (!Number.isInteger(order) || order < 0) {
    throw new ValidationError("업무 영역 순서는 0 이상의 정수여야 합니다.");
  }
}

// ---------------------------------------------------------------------------
// Service functions
// ---------------------------------------------------------------------------

export async function createWorkstream(
  db: Database,
  params: CreateWorkstreamParams
): Promise<Workstream> {
  const name = validateName(params.name);
  const order = params.order ?? 0;
  validateOrder(order);

  const id = crypto.randomUUID();

  const newWorkstream: NewWorkstream = {
    id,
    project_id: params.projectId,
    name,
    order,
  };

  await db.insert(workstream).values(newWorkstream);
  return newWorkstream as Workstream;
}

export async function editWorkstream(
  db: Database,
  workstreamId: string,
  patch: WorkstreamPatch
): Promise<Workstream> {
  const rows = await db
    .select()
    .from(workstream)
    .where(eq(workstream.id, workstreamId));
  const current = rows[0];
  if (!current) throw new NotFoundError(`Workstream ${workstreamId} not found`);

  const updates: Partial<Workstream> = {};

  if (patch.name !== undefined) {
    updates.name = validateName(patch.name);
  }
  if (patch.order !== undefined) {
    validateOrder(patch.order);
    updates.order = patch.order;
  }

  await db.update(workstream).set(updates).where(eq(workstream.id, workstreamId));
  return { ...current, ...updates } as Workstream;
}
