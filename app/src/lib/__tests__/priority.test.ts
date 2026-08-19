import { describe, expect, it } from "vitest";
import { makeTaskFixture } from "@/server/db/fixtures";
import { prioritySignal, rankedTasks } from "../priority";

describe("priority", () => {
  it("puts overdue work ahead of important undated work", () => {
    const overdue = makeTaskFixture({
      id: "overdue",
      assignee_id: "me",
      due_date: "2026-08-18",
    });
    const important = makeTaskFixture({
      id: "important",
      assignee_id: "me",
      importance: "key",
    });
    expect(rankedTasks([important, overdue], "me", "2026-08-19").map((x) => x.task.id))
      .toEqual(["overdue", "important"]);
  });

  it("explains a same-day task as a schedule", () => {
    const task = makeTaskFixture({
      start_date: "2026-08-19",
      due_date: "2026-08-19",
      due_time: "14:00",
    });
    expect(prioritySignal(task, "2026-08-19")?.reason).toBe("오늘 14:00 일정");
  });

  it("excludes completed work", () => {
    const task = makeTaskFixture({ status: "Done", importance: "key" });
    expect(prioritySignal(task, "2026-08-19")).toBeNull();
  });
});
