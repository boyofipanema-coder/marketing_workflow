/**
 * validate.ts — Zod schemas and pure validation helpers.
 * No DB access; FK checks are provided via lookup functions.
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const TASK_STATUSES = [
  "Inbox",
  "ToDo",
  "InProgress",
  "Waiting",
  "Review",
  "Done",
] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

/** Non-empty trimmed string, max 200 chars (200 is valid, 201 is rejected). */
export const nameSchema = z
  .string()
  .transform((s) => s.trim())
  .pipe(
    z
      .string()
      .min(1, "내용을 입력해 주세요.")
      .max(200, "200자 이하로 입력해 주세요."),
  );

/** ISO-8601 date string in YYYY-MM-DD format. */
export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "올바른 날짜 형식(YYYY-MM-DD)이 아닙니다.")
  .refine((s) => {
    const [y, m, d] = s.split("-").map(Number);
    // Construct date and verify components match — prevents JS date normalization (e.g. Feb 30 → Mar 1)
    const dt = new Date(y!, m! - 1, d!);
    return (
      !isNaN(dt.getTime()) &&
      dt.getFullYear() === y &&
      dt.getMonth() + 1 === m &&
      dt.getDate() === d
    );
  }, "존재하지 않는 날짜입니다.");

/** Optional ISO-8601 date. */
export const optionalIsoDateSchema = isoDateSchema.nullish();

/** Task status enum. */
export const taskStatusSchema = z.enum(TASK_STATUSES);

// ---------------------------------------------------------------------------
// Date range validation
// ---------------------------------------------------------------------------

/**
 * Validates that start <= end when both are provided.
 * Returns a structured error if invalid.
 */
export function validateDateRange(
  start: string | null | undefined,
  end: string | null | undefined,
): { valid: true } | { valid: false; error: string } {
  if (!start || !end) return { valid: true };
  if (start > end) {
    return { valid: false, error: "시작일은 종료일보다 늦을 수 없습니다." };
  }
  return { valid: true };
}

// ---------------------------------------------------------------------------
// Task schema
// ---------------------------------------------------------------------------

export const newTaskSchema = z
  .object({
    title: nameSchema,
    description: z.string().nullish(),
    status: taskStatusSchema.default("Inbox"),
    assignee_id: z.string().nullish(),
    reviewer_id: z.string().nullish(),
    start_date: optionalIsoDateSchema,
    due_date: optionalIsoDateSchema,
    project_id: z.string().nullish(),
    workstream_id: z.string().nullish(),
  })
  .refine(
    (data) => {
      if (!data.start_date || !data.due_date) return true;
      return data.start_date <= data.due_date;
    },
    {
      message: "시작일은 마감일보다 늦을 수 없습니다.",
      path: ["start_date"],
    },
  );

export type NewTaskInput = z.input<typeof newTaskSchema>;
export type NewTaskParsed = z.output<typeof newTaskSchema>;

// ---------------------------------------------------------------------------
// Project schema
// ---------------------------------------------------------------------------

export const newProjectSchema = z
  .object({
    name: nameSchema,
    one_line_objective: z.string().nullish(),
    project_lead_id: z.string().min(1, "프로젝트 리드를 선택해 주세요."),
    target_start_date: optionalIsoDateSchema,
    target_end_date: optionalIsoDateSchema,
  })
  .refine(
    (data) => {
      if (!data.target_start_date || !data.target_end_date) return true;
      return data.target_start_date <= data.target_end_date;
    },
    {
      message: "목표 시작일은 목표 종료일보다 늦을 수 없습니다.",
      path: ["target_start_date"],
    },
  );

export type NewProjectInput = z.input<typeof newProjectSchema>;
export type NewProjectParsed = z.output<typeof newProjectSchema>;

// ---------------------------------------------------------------------------
// Structured field error helpers
// ---------------------------------------------------------------------------

export type FieldErrors = Record<string, string[]>;

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; errors: FieldErrors };

/**
 * Parses a value against a Zod schema and returns a structured ValidationResult.
 */
export function parseSchema<T>(
  schema: z.ZodType<T>,
  input: unknown,
): ValidationResult<T> {
  const result = schema.safeParse(input);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const errors: FieldErrors = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join(".") || "_root";
    if (!errors[key]) errors[key] = [];
    errors[key]!.push(issue.message);
  }
  return { success: false, errors };
}

export function parseNewTask(input: unknown): ValidationResult<NewTaskParsed> {
  return parseSchema(newTaskSchema, input);
}

export function parseNewProject(
  input: unknown,
): ValidationResult<NewProjectParsed> {
  return parseSchema(newProjectSchema, input);
}

// ---------------------------------------------------------------------------
// FK-existence check helpers
// ---------------------------------------------------------------------------

export type LookupFn = (id: string) => boolean | Promise<boolean>;

/**
 * Checks that an ID exists via a lookup function.
 * Returns a structured error if not found.
 */
export async function checkFkExists(
  fieldName: string,
  id: string | null | undefined,
  lookup: LookupFn,
): Promise<{ valid: true } | { valid: false; field: string; error: string }> {
  if (id === null || id === undefined) return { valid: true };
  const exists = await lookup(id);
  if (!exists) {
    return {
      valid: false,
      field: fieldName,
      error: `참조한 ${fieldName}(id "${id}")를 찾을 수 없습니다`,
    };
  }
  return { valid: true };
}
