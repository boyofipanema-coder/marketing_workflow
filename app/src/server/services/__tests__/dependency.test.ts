import { describe, it, expect } from "vitest";
import { _reachesForTest as reaches } from "../dependency";

/**
 * The one rule that keeps the graph drawable: a new edge must not close a loop.
 * `reaches(map, from, to)` walks predecessor edges, so adding pred → succ is
 * illegal exactly when pred already reaches succ.
 */
describe("dependency cycle detection", () => {
  const map = (o: Record<string, string[]>) => new Map(Object.entries(o));

  it("finds a direct back-edge", () => {
    // b waits on a. Adding "b before a" (pred=b, succ=a) would close the loop,
    // and the guard catches it because b already reaches a.
    expect(reaches(map({ b: ["a"] }), "b", "a")).toBe(true);
    // The other direction is just the edge that already exists, not a loop.
    expect(reaches(map({ b: ["a"] }), "a", "b")).toBe(false);
  });

  it("finds a transitive loop", () => {
    // a ← b ← c : adding c → a would close it.
    expect(reaches(map({ a: ["b"], b: ["c"] }), "a", "c")).toBe(true);
  });

  it("returns false for unrelated tasks", () => {
    expect(reaches(map({ a: ["b"] }), "x", "y")).toBe(false);
  });

  it("terminates on an already-cyclic map", () => {
    expect(reaches(map({ a: ["b"], b: ["a"] }), "a", "z")).toBe(false);
  });
});
