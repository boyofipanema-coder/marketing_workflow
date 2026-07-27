import { describe, expect, it } from "vitest";
import { makeTaskFixture } from "@/server/db/fixtures";
import { memberWorkload } from "../workload";

const NOW = new Date("2024-03-14T15:00:00Z");

describe("memberWorkload", () => {
  it("reports observable counts without inventing a workload score", () => {
    const tasks = [
      makeTaskFixture({
        assignee_id: "member-1",
        status: "InProgress",
        due_date: "2024-03-14",
      }),
      makeTaskFixture({
        id: "waiting",
        assignee_id: "member-1",
        status: "Waiting",
        due_date: "2024-03-16",
      }),
      makeTaskFixture({
        id: "done",
        assignee_id: "member-1",
        status: "Done",
      }),
    ];

    const result = memberWorkload(tasks, "member-1", NOW);
    expect(result.activeCount).toBe(2);
    expect(result.overdueCount).toBe(1);
    expect(result.completedCount).toBe(1);
    expect(result.dueThisWeekCount).toBe(2);
    expect("score" in result).toBe(false);
  });
});
