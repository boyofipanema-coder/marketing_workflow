import { describe, it, expect } from "vitest";
import { buildBoardGraph } from "../board-graph";
import { makeTaskFixture } from "@/server/db/fixtures";
import type { Task } from "@/server/db/schema";

/** A tree helper: `t(id, parent, extras)`. */
function t(id: string, parent: string | null = null, extra: Partial<Task> = {}) {
  return makeTaskFixture({
    id,
    parent_task_id: parent,
    project_id: "p1",
    workstream_id: "ws1",
    ...extra,
  });
}

const key = { importance: "key" } as const;

describe("buildBoardGraph — which tasks get a card", () => {
  it("places every top-level task", () => {
    const g = buildBoardGraph([t("a"), t("b")], "workstream");
    expect(g.placed.map((x) => x.id).sort()).toEqual(["a", "b"]);
  });

  it("leaves ordinary subtasks inside their parent", () => {
    const g = buildBoardGraph([t("a"), t("a1", "a")], "workstream");
    expect(g.placed.map((x) => x.id)).toEqual(["a"]);
  });

  it("promotes a key subtask to its own card", () => {
    const g = buildBoardGraph([t("a"), t("a1", "a", key)], "workstream");
    expect(g.placed.map((x) => x.id).sort()).toEqual(["a", "a1"]);
    expect(g.parentOf.get("a1")).toBe("a");
  });

  // Promotion is a property of the task, not of its depth — the rule has to
  // hold the same way three levels down as it does one.
  it("promotes a key task at any depth", () => {
    const g = buildBoardGraph(
      [t("a"), t("a1", "a"), t("a1x", "a1"), t("deep", "a1x", key)],
      "workstream"
    );
    expect(g.placed.map((x) => x.id).sort()).toEqual(["a", "deep"]);
  });

  it("tethers a promoted node to the nearest ancestor that also has a card", () => {
    const g = buildBoardGraph(
      [t("a"), t("a1", "a", key), t("a1x", "a1"), t("deep", "a1x", key)],
      "workstream"
    );
    // not "a" — a1 is closer and is itself placed
    expect(g.parentOf.get("deep")).toBe("a1");
    expect(g.parentOf.get("a1")).toBe("a");
  });

  it("skips over unplaced ancestors when tethering", () => {
    const g = buildBoardGraph(
      [t("a"), t("mid", "a"), t("leaf", "mid", key)],
      "workstream"
    );
    expect(g.parentOf.get("leaf")).toBe("a");
  });

  it("promotes any number of siblings independently", () => {
    const g = buildBoardGraph(
      [t("a"), t("a1", "a", key), t("a2", "a", key), t("a3", "a")],
      "workstream"
    );
    expect(g.placed.map((x) => x.id).sort()).toEqual(["a", "a1", "a2"]);
  });

  it("promotes regardless of status", () => {
    const statuses: Task["status"][] = ["ToDo", "InProgress", "Waiting", "Review", "Done"];
    for (const status of statuses) {
      const g = buildBoardGraph([t("a"), t("a1", "a", { ...key, status })], "workstream");
      expect(g.placed.map((x) => x.id)).toContain("a1");
    }
  });

  it("gives a root no parent link", () => {
    const g = buildBoardGraph([t("a", null, key)], "workstream");
    expect(g.parentOf.has("a")).toBe(false);
  });

  it("drops cancelled tasks entirely", () => {
    const g = buildBoardGraph(
      [t("a"), t("a1", "a", { ...key, cancelled_at: "2026-01-01T00:00:00Z" })],
      "workstream"
    );
    expect(g.placed.map((x) => x.id)).toEqual(["a"]);
  });
});

describe("buildBoardGraph — lane inheritance", () => {
  // A promoted child must not drift into another band just because its own
  // workstream column happens to differ from its root's.
  it("puts a promoted node in its root's lane, not its own", () => {
    const g = buildBoardGraph(
      [t("a", null, { workstream_id: "ws1" }), t("a1", "a", { ...key, workstream_id: "ws2" })],
      "workstream"
    );
    expect(g.laneOf.get("a1")).toBe("ws1");
  });

  it("inherits the root's project when grouping by project", () => {
    const g = buildBoardGraph(
      [t("a", null, { project_id: "p1" }), t("a1", "a", { ...key, project_id: "p2" })],
      "project"
    );
    expect(g.laneOf.get("a1")).toBe("p1");
  });

  it("files a task with no workstream under the triage lane", () => {
    const g = buildBoardGraph([t("a", null, { workstream_id: null })], "workstream");
    expect(g.laneOf.get("a")).toBe("_other");
  });
});

describe("buildBoardGraph — malformed data", () => {
  // Not reachable through the UI, but a bad row must not hang the board.
  it("survives a parent cycle", () => {
    const a = t("a", "b", key);
    const b = t("b", "a", key);
    const g = buildBoardGraph([a, b], "workstream");
    expect(g.placed).toHaveLength(2);
  });

  it("treats a task whose parent is missing as its own root", () => {
    const g = buildBoardGraph([t("orphan", "ghost", key)], "workstream");
    expect(g.placed.map((x) => x.id)).toEqual(["orphan"]);
    expect(g.parentOf.has("orphan")).toBe(false);
  });
});
