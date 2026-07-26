import { describe, it, expect } from "vitest";
import { cardHeight, hierarchyStageIndex } from "../WorkflowCanvas";
import { makeTaskFixture } from "@/server/db/fixtures";
import type { ChildMap } from "@/lib/board-graph";

// Regression test for Finding 4 (CANVAS_FIRST_REVISION_PLAN.md §16.4): compact
// mode must not reserve card height for an expanded subtask list it no longer
// renders — there's no toggle to collapse it from that view, so a card stuck
// at full height in compact would have no way back.

describe("cardHeight — LOD", () => {
  const parent = makeTaskFixture({ id: "parent", project_id: "p1" });
  const children = [
    makeTaskFixture({ id: "c1", parent_task_id: "parent", project_id: "p1" }),
    makeTaskFixture({ id: "c2", parent_task_id: "parent", project_id: "p1" }),
  ];
  const cm: ChildMap = new Map([["parent", children]]);
  const open = new Set(["parent"]);
  const closed = new Set<string>();

  it("adds subtree height for an expanded parent in full", () => {
    const expandedHeight = cardHeight(parent, cm, open, null, "full");
    const collapsedHeight = cardHeight(parent, cm, closed, null, "full");
    expect(expandedHeight).toBeGreaterThan(collapsedHeight);
  });

  it("does not add subtree height for an expanded parent in compact", () => {
    const compactExpanded = cardHeight(parent, cm, open, null, "compact");
    const compactCollapsed = cardHeight(parent, cm, closed, null, "compact");
    expect(compactExpanded).toBe(compactCollapsed);
  });

  it("compact height is never taller than full height for the same open set", () => {
    expect(cardHeight(parent, cm, open, null, "compact")).toBeLessThanOrEqual(
      cardHeight(parent, cm, open, null, "full")
    );
  });

  it("defaults to full when lod is omitted", () => {
    expect(cardHeight(parent, cm, open, null)).toBe(
      cardHeight(parent, cm, open, null, "full")
    );
  });

  it("does not reserve inline subtree height when subtasks have their own column", () => {
    expect(cardHeight(parent, cm, open, null, "full", false)).toBe(
      cardHeight(parent, cm, closed, null, "full", false)
    );
  });
});

describe("hierarchyStageIndex", () => {
  it("maps active roots, active children and completed work to their columns", () => {
    expect(hierarchyStageIndex(makeTaskFixture({ status: "InProgress" }))).toBe(0);
    expect(
      hierarchyStageIndex(
        makeTaskFixture({ status: "Waiting", parent_task_id: "parent" })
      )
    ).toBe(1);
    expect(
      hierarchyStageIndex(
        makeTaskFixture({ status: "Done", parent_task_id: "parent" })
      )
    ).toBe(2);
  });
});
