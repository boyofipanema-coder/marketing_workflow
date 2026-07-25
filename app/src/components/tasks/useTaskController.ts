"use client";

import { useCallback, useMemo, useState } from "react";
import {
  completeTaskAction,
  reopenTaskAction,
  cancelTaskAction,
  restoreTaskAction,
  editTaskAction,
  reorderTasksAction,
  type TaskPatchInput,
} from "@/app/actions/tasks";
import { useTaskStore } from "./useTaskStore";
import type { Task } from "@/server/db/schema";

/**
 * Wires the optimistic task store to the handlers TaskList and TaskDetailPanel
 * expect, plus panel open/close state. Every screen that shows tasks uses this,
 * so completing a task behaves the same on Home as it does inside a project.
 */
export function useTaskController(initialTasks: Task[]) {
  const store = useTaskStore(initialTasks);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  const selected = useMemo(
    () => store.tasks.find((t) => t.id === selectedId) ?? null,
    [store.tasks, selectedId]
  );

  const select = useCallback((task: Task) => {
    setSelectedId(task.id);
    setPanelOpen(true);
  }, []);

  const patch = useCallback(
    (task: Task, next: TaskPatchInput) =>
      store.mutate(
        task.id,
        (t) => ({ ...t, ...next, version: t.version + 1 } as Task),
        () => editTaskAction(task.id, task.version, next)
      ),
    [store]
  );

  /**
   * One control handles both directions: an open task completes, a completed
   * one returns to whichever status it held before (resolved server-side).
   */
  const toggleComplete = useCallback(
    (task: Task) => {
      if (task.status === "Done") {
        return store.mutate(
          task.id,
          (t) => ({ ...t, status: "ToDo", completed_at: null } as Task),
          () => reopenTaskAction(task.id, task.version)
        );
      }
      return store.mutate(
        task.id,
        (t) =>
          ({
            ...t,
            status: "Done",
            completed_at: new Date().toISOString(),
          } as Task),
        () => completeTaskAction(task.id, task.version)
      );
    },
    [store]
  );

  const cancel = useCallback(
    (task: Task) =>
      store.mutate(
        task.id,
        (t) => ({ ...t, cancelled_at: new Date().toISOString() } as Task),
        () => cancelTaskAction(task.id, task.version)
      ),
    [store]
  );

  const restore = useCallback(
    (task: Task) =>
      store.mutate(
        task.id,
        (t) => ({ ...t, cancelled_at: null } as Task),
        () => restoreTaskAction(task.id, task.version)
      ),
    [store]
  );

  const reorder = useCallback(
    (orderedIds: string[]) =>
      store.reorder(orderedIds, () => reorderTasksAction(orderedIds)),
    [store]
  );

  return {
    store,
    tasks: store.tasks,
    selected,
    selectedId,
    panelOpen,
    setPanelOpen,
    select,
    patch,
    toggleComplete,
    cancel,
    restore,
    reorder,
  };
}
