import { describe, it, expect } from "vitest";
import {
  parseNewTask,
  parseNewProject,
  validateDateRange,
  checkFkExists,
  nameSchema,
  isoDateSchema,
} from "../validate";

// ---------------------------------------------------------------------------
// nameSchema — 200 vs 201 boundary
// ---------------------------------------------------------------------------

describe("nameSchema", () => {
  it("accepts a string of exactly 200 characters", () => {
    const s = "a".repeat(200);
    const result = nameSchema.safeParse(s);
    expect(result.success).toBe(true);
  });

  it("rejects a string of 201 characters", () => {
    const s = "a".repeat(201);
    const result = nameSchema.safeParse(s);
    expect(result.success).toBe(false);
  });

  it("accepts a string that trims to 200 chars", () => {
    const s = "  " + "a".repeat(200) + "  ";
    const result = nameSchema.safeParse(s);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe("a".repeat(200));
  });

  it("rejects empty string", () => {
    const result = nameSchema.safeParse("   ");
    expect(result.success).toBe(false);
  });

  it("rejects empty string after trim", () => {
    const result = nameSchema.safeParse("");
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isoDateSchema
// ---------------------------------------------------------------------------

describe("isoDateSchema", () => {
  it("accepts a valid ISO date", () => {
    expect(isoDateSchema.safeParse("2024-03-15").success).toBe(true);
  });

  it("rejects an invalid format", () => {
    expect(isoDateSchema.safeParse("03/15/2024").success).toBe(false);
  });

  it("rejects an invalid date", () => {
    expect(isoDateSchema.safeParse("2024-02-30").success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// validateDateRange
// ---------------------------------------------------------------------------

describe("validateDateRange", () => {
  it("returns valid when start == end", () => {
    expect(validateDateRange("2024-03-15", "2024-03-15")).toEqual({ valid: true });
  });

  it("returns valid when start < end", () => {
    expect(validateDateRange("2024-03-01", "2024-03-31")).toEqual({ valid: true });
  });

  it("returns error when start > end", () => {
    const result = validateDateRange("2024-03-31", "2024-03-01");
    expect(result.valid).toBe(false);
  });

  it("returns valid when either is null/undefined", () => {
    expect(validateDateRange(null, "2024-03-15")).toEqual({ valid: true });
    expect(validateDateRange("2024-03-15", null)).toEqual({ valid: true });
    expect(validateDateRange(undefined, undefined)).toEqual({ valid: true });
  });
});

// ---------------------------------------------------------------------------
// parseNewTask
// ---------------------------------------------------------------------------

describe("parseNewTask", () => {
  it("parses a valid task", () => {
    const result = parseNewTask({ title: "My Task" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe("My Task");
      expect(result.data.status).toBe("Inbox");
    }
  });

  it("trims title whitespace", () => {
    const result = parseNewTask({ title: "  Hello  " });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.title).toBe("Hello");
  });

  it("rejects empty title", () => {
    const result = parseNewTask({ title: "" });
    expect(result.success).toBe(false);
  });

  it("rejects title over 200 chars", () => {
    const result = parseNewTask({ title: "x".repeat(201) });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.errors["title"]).toBeDefined();
  });

  it("accepts title of exactly 200 chars", () => {
    const result = parseNewTask({ title: "x".repeat(200) });
    expect(result.success).toBe(true);
  });

  it("rejects invalid status enum", () => {
    const result = parseNewTask({ title: "Task", status: "Wip" });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.errors["status"]).toBeDefined();
  });

  it("accepts all valid status values", () => {
    for (const s of ["Inbox", "ToDo", "InProgress", "Waiting", "Review", "Done"]) {
      const result = parseNewTask({ title: "T", status: s });
      expect(result.success).toBe(true);
    }
  });

  it("rejects reversed date range (start > due)", () => {
    const result = parseNewTask({
      title: "Task",
      start_date: "2024-03-20",
      due_date: "2024-03-10",
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.errors["start_date"]).toBeDefined();
  });

  it("accepts equal start and due date", () => {
    const result = parseNewTask({
      title: "Task",
      start_date: "2024-03-15",
      due_date: "2024-03-15",
    });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// parseNewProject
// ---------------------------------------------------------------------------

describe("parseNewProject", () => {
  it("parses a valid project", () => {
    const result = parseNewProject({
      name: "My Project",
      project_lead_id: "user-1",
    });
    expect(result.success).toBe(true);
  });

  it("rejects project with targetStart > targetEnd", () => {
    const result = parseNewProject({
      name: "Proj",
      project_lead_id: "u1",
      target_start_date: "2024-06-01",
      target_end_date: "2024-05-01",
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.errors["target_start_date"]).toBeDefined();
  });

  it("accepts project with targetStart === targetEnd", () => {
    const result = parseNewProject({
      name: "Proj",
      project_lead_id: "u1",
      target_start_date: "2024-06-01",
      target_end_date: "2024-06-01",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = parseNewProject({
      name: "",
      project_lead_id: "u1",
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// checkFkExists
// ---------------------------------------------------------------------------

describe("checkFkExists", () => {
  it("returns valid when id is null", async () => {
    const result = await checkFkExists("user", null, () => false);
    expect(result.valid).toBe(true);
  });

  it("returns valid when lookup returns true", async () => {
    const result = await checkFkExists("user", "u1", () => true);
    expect(result.valid).toBe(true);
  });

  it("returns error when lookup returns false", async () => {
    const result = await checkFkExists("user", "u1", () => false);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.field).toBe("user");
      expect(result.error).toContain("u1");
    }
  });

  it("supports async lookup function", async () => {
    const result = await checkFkExists("project", "p1", async (id) => {
      return id === "p1";
    });
    expect(result.valid).toBe(true);
  });
});
