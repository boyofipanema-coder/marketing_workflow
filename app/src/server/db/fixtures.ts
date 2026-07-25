/**
 * Shared test fixtures.
 *
 * Every suite that needs a Task literal builds it from here, so adding a column
 * to the schema breaks in one place instead of four.
 *
 * Not imported by any runtime code — vitest only.
 */

import type { Task } from "./schema";

export function makeTaskFixture(overrides: Partial<Task> = {}): Task {
  return {
    id: "task-1",
    workspace_id: "ws-1",
    project_id: null,
    workstream_id: null,
    parent_task_id: null,
    title: "Test Task",
    description: null,
    status: "ToDo",
    assignee_id: null,
    reviewer_id: null,
    start_date: null,
    due_date: null,
    due_time: null,
    sort_order: 0,
    waiting_type: null,
    waiting_on_text: null,
    waiting_party_text: null,
    waiting_owner_member_id: null,
    follow_up_at: null,
    blocked_reason: null,
    blocked_resolution_action: null,
    version: 1,
    created_by: "user-1",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    completed_at: null,
    cancelled_at: null,
    ...overrides,
  };
}
