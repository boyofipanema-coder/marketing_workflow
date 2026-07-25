import {
  StaleVersionError,
  ValidationError,
  NotFoundError,
} from "@/server/services/errors";

/**
 * Every mutating server action returns this shape so the client can always
 * distinguish "saved", "your input was wrong", and "someone else got there
 * first" — and roll an optimistic update back with the server's own value.
 */
export interface ActionResult<T = undefined> {
  success: boolean;
  /** Korean, user-facing. Safe to render next to the offending field. */
  error?: string;
  /** Set when the write lost a version race; the client should refetch. */
  conflict?: boolean;
  data?: T;
}

/**
 * Wraps a server action body, mapping domain errors onto ActionResult.
 * Unexpected errors are logged server-side and reported generically so we never
 * leak internals into the UI.
 */
export async function runAction<T>(
  label: string,
  fn: () => Promise<T>
): Promise<ActionResult<T>> {
  try {
    return { success: true, data: await fn() };
  } catch (err) {
    if (err instanceof StaleVersionError) {
      return { success: false, conflict: true, error: err.message };
    }
    if (err instanceof ValidationError) {
      return { success: false, error: err.message };
    }
    if (err instanceof NotFoundError) {
      return { success: false, error: "대상을 찾을 수 없습니다." };
    }
    console.error(`${label} error:`, err);
    return {
      success: false,
      error: "저장하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    };
  }
}
