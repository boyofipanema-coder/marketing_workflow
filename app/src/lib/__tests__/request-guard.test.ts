import { describe, it, expect } from "vitest";
import { createRequestGuard } from "../request-guard";

// Regression test for Finding 5 (CANVAS_FIRST_REVISION_PLAN.md §16.5): a
// slower, earlier request must not be able to overwrite state set by a newer
// one that started after it.

describe("createRequestGuard", () => {
  it("treats the most recently issued token as current", () => {
    const guard = createRequestGuard();
    const a = guard.next();
    const b = guard.next();
    expect(guard.isCurrent(a)).toBe(false);
    expect(guard.isCurrent(b)).toBe(true);
  });

  it("rejects a token from before the latest next() call", () => {
    const guard = createRequestGuard();
    const stale = guard.next();
    guard.next();
    guard.next();
    expect(guard.isCurrent(stale)).toBe(false);
  });
});
