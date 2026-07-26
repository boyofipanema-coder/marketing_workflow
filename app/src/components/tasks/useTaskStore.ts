"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Task } from "@/server/db/schema";
import type { ActionResult } from "@/app/actions/result";

export type SaveState = "idle" | "saving" | "saved" | "error";

export interface TaskStore {
  tasks: Task[];
  /** Per-task save state, for showing progress next to the row being edited. */
  stateOf: (taskId: string) => SaveState;
  /** Last failure message, cleared on the next successful write. */
  error: string | null;
  /** True when the last failure was a lost version race. */
  conflict: boolean;
  /**
   * Same as `error`/`conflict`, but scoped to one task — returns nulled-out
   * values unless the most recent failure actually belongs to `taskId`. Use
   * this (not the bare `error`/`conflict` fields) wherever the message is
   * attached to a specific task's UI (e.g. its detail dialog), so a failure
   * from editing task A can't surface against task B just because B is what's
   * open when A's response lands.
   */
  errorFor: (taskId: string) => { error: string | null; conflict: boolean };
  dismissError: () => void;
  /**
   * Applies `optimistic` immediately, runs `action`, then reconciles with the
   * server's row. On failure the previous rows are restored so the UI never
   * keeps a value the server rejected.
   */
  mutate: (
    taskId: string,
    optimistic: (task: Task) => Task,
    action: () => Promise<ActionResult<Task>>
  ) => Promise<boolean>;
  /** Reorder helper — moves rows locally, then persists the whole sequence. */
  reorder: (
    orderedIds: string[],
    action: () => Promise<ActionResult<undefined>>
  ) => Promise<boolean>;
}

/**
 * Client-side mirror of the server's task rows with optimistic writes.
 *
 * Server components re-render this with a fresh array on every refresh, so the
 * local copy resyncs only when the *content* changed — resyncing on array
 * identity would wipe an in-flight optimistic edit on every unrelated re-render.
 */
export function useTaskStore(initial: Task[]): TaskStore {
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>(initial);
  const [states, setStates] = useState<Record<string, SaveState>>({});
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  /** Which task the current error/conflict belongs to (null once dismissed). */
  const [errorTaskId, setErrorTaskId] = useState<string | null>(null);

  const signature = useMemo(
    () => initial.map((t) => `${t.id}:${t.version}`).join(","),
    [initial]
  );
  const latest = useRef(initial);
  latest.current = initial;

  useEffect(() => {
    setTasks(latest.current);
  }, [signature]);

  const setState = useCallback((taskId: string, next: SaveState) => {
    setStates((prev) => ({ ...prev, [taskId]: next }));
  }, []);

  const mutate = useCallback<TaskStore["mutate"]>(
    async (taskId, optimistic, action) => {
      let rollback: Task[] = [];
      setTasks((prev) => {
        rollback = prev;
        return prev.map((t) => (t.id === taskId ? optimistic(t) : t));
      });
      setState(taskId, "saving");

      const result = await action();

      if (!result.success) {
        setTasks(rollback);
        setError(result.error ?? "저장하지 못했습니다.");
        setConflict(Boolean(result.conflict));
        setErrorTaskId(taskId);
        setState(taskId, "error");
        // A conflict means our snapshot is stale; pull the current rows so the
        // user is re-applying their change on top of the winning value.
        if (result.conflict) router.refresh();
        return false;
      }

      if (result.data) {
        const saved = result.data;
        setTasks((prev) => prev.map((t) => (t.id === taskId ? saved : t)));
      }
      setError(null);
      setConflict(false);
      setErrorTaskId(null);
      setState(taskId, "saved");
      return true;
    },
    [router, setState]
  );

  const reorder = useCallback<TaskStore["reorder"]>(
    async (orderedIds, action) => {
      let rollback: Task[] = [];
      setTasks((prev) => {
        rollback = prev;
        const rank = new Map(orderedIds.map((id, i) => [id, i]));
        return prev
          .map((t) => (rank.has(t.id) ? { ...t, sort_order: rank.get(t.id)! } : t))
          .sort((a, b) => a.sort_order - b.sort_order);
      });

      const result = await action();
      if (!result.success) {
        setTasks(rollback);
        setError(result.error ?? "순서를 저장하지 못했습니다.");
        return false;
      }
      setError(null);
      return true;
    },
    []
  );

  const dismissError = useCallback(() => {
    setError(null);
    setConflict(false);
    setErrorTaskId(null);
  }, []);

  const stateOf = useCallback(
    (taskId: string) => states[taskId] ?? "idle",
    [states]
  );

  const errorFor = useCallback(
    (taskId: string) =>
      errorTaskId === taskId ? { error, conflict } : { error: null, conflict: false },
    [errorTaskId, error, conflict]
  );

  return { tasks, stateOf, error, conflict, errorFor, dismissError, mutate, reorder };
}
