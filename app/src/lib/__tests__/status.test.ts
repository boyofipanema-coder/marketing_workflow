import { describe, it, expect } from "vitest";
import { displayGroup } from "../status";

describe("displayGroup", () => {
  it("groups Inbox, ToDo, InProgress, and Review as InProgress", () => {
    for (const s of ["Inbox", "ToDo", "InProgress", "Review"] as const) {
      expect(displayGroup(s)).toBe("InProgress");
    }
  });

  it("keeps Waiting and Done as their own group", () => {
    expect(displayGroup("Waiting")).toBe("Waiting");
    expect(displayGroup("Done")).toBe("Done");
  });
});
