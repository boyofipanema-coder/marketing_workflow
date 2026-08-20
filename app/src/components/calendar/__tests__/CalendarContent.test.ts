import { describe, expect, it } from "vitest";
import { makeTaskFixture } from "@/server/db/fixtures";
import { workspaceItems } from "../CalendarContent";

describe("workspaceItems", () => {
  it("shows a subtask with only a start date on the calendar", () => {
    const parent = makeTaskFixture({ id: "parent", title: "캠페인 준비" });
    const child = makeTaskFixture({
      id: "child",
      title: "촬영 장소 확인",
      parent_task_id: parent.id,
      start_date: "2026-08-21",
      due_date: null,
    });

    const items = workspaceItems([parent, child]);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: "child:schedule",
      date: "2026-08-21",
      kind: "schedule",
      parentLabel: "캠페인 준비",
    });
  });

  it("shows both ends of a subtask date range", () => {
    const child = makeTaskFixture({
      id: "child",
      parent_task_id: "parent",
      start_date: "2026-08-21",
      due_date: "2026-08-24",
    });

    expect(workspaceItems([child]).map((item) => [item.date, item.kind])).toEqual([
      ["2026-08-21", "schedule"],
      ["2026-08-24", "deadline"],
    ]);
  });
});
