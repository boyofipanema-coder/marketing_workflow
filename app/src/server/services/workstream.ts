import { and, eq, sql } from "drizzle-orm";
import {
  workstream,
  type Workstream,
  type NewWorkstream,
} from "@/server/db/schema";
import { type Database } from "@/server/db/client";
import { NotFoundError, ValidationError } from "./errors";
import { loadScopedProject } from "./project";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreateWorkstreamParams {
  projectId: string;
  workspaceId: string;
  name: string;
  /** Non-negative integer display order. Defaults to the end of the list. */
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

/**
 * Loads a workstream and verifies its project belongs to the caller's
 * workspace, so a workstream id from another workspace reads as missing.
 */
async function loadScopedWorkstream(
  db: Database,
  workstreamId: string,
  workspaceId: string
): Promise<Workstream> {
  const rows = await db
    .select()
    .from(workstream)
    .where(eq(workstream.id, workstreamId));
  const current = rows[0];
  if (!current) throw new NotFoundError(`Workstream ${workstreamId} not found`);

  // Throws NotFoundError when the project is outside this workspace.
  await loadScopedProject(db, current.project_id, workspaceId);
  return current;
}

// ---------------------------------------------------------------------------
// Service functions
// ---------------------------------------------------------------------------

export async function createWorkstream(
  db: Database,
  params: CreateWorkstreamParams
): Promise<Workstream> {
  const name = validateName(params.name);
  await loadScopedProject(db, params.projectId, params.workspaceId);

  let order = params.order;
  if (order === undefined) {
    const [row] = await db
      .select({ value: sql<number>`coalesce(max(${workstream.order}), -1)` })
      .from(workstream)
      .where(eq(workstream.project_id, params.projectId));
    order = (row?.value ?? -1) + 1;
  }
  validateOrder(order);

  const newWorkstream: NewWorkstream = {
    id: crypto.randomUUID(),
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
  workspaceId: string,
  patch: WorkstreamPatch
): Promise<Workstream> {
  const current = await loadScopedWorkstream(db, workstreamId, workspaceId);

  const updates: Partial<Workstream> = {};

  if (patch.name !== undefined) {
    updates.name = validateName(patch.name);
  }
  if (patch.order !== undefined) {
    validateOrder(patch.order);
    updates.order = patch.order;
  }

  await db
    .update(workstream)
    .set(updates)
    .where(eq(workstream.id, workstreamId));
  return { ...current, ...updates } as Workstream;
}

/**
 * Persist a manual ordering for a project's workstreams. Every id must belong
 * to the project; each is assigned its index in the list.
 */
export async function reorderWorkstreams(
  db: Database,
  projectId: string,
  workspaceId: string,
  orderedIds: string[]
): Promise<void> {
  if (orderedIds.length === 0) return;
  await loadScopedProject(db, projectId, workspaceId);

  const rows = await db
    .select()
    .from(workstream)
    .where(eq(workstream.project_id, projectId));
  const belongs = new Set(rows.map((r) => r.id));
  for (const id of orderedIds) {
    if (!belongs.has(id)) {
      throw new ValidationError("해당 프로젝트의 업무 영역이 아닙니다.");
    }
  }

  await db.batch(
    orderedIds.map((id, index) =>
      db
        .update(workstream)
        .set({ order: index })
        .where(
          and(eq(workstream.id, id), eq(workstream.project_id, projectId))
        )
    ) as never
  );
}
