"use client";

import { useState } from "react";
import { Check, Loader2, Pencil, Plus, X } from "lucide-react";
import {
  createWorkstreamAction,
  editWorkstreamAction,
  reorderWorkstreamsAction,
} from "@/app/actions/workstreams";
import { Button, Input } from "@/components/ui";
import type { Workstream } from "@/server/db/schema";

interface WorkstreamManagerProps {
  projectId: string;
  workstreams: Workstream[];
}

/**
 * Inline create/rename/reorder for a project's workstreams. Order is changed
 * with explicit up/down controls rather than drag — the list is short and this
 * stays operable by keyboard and on touch.
 */
export default function WorkstreamManager({
  projectId,
  workstreams,
}: WorkstreamManagerProps) {
  const [items, setItems] = useState(workstreams);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Resync when the server sends a different set.
  const signature = workstreams.map((w) => `${w.id}:${w.name}:${w.order}`).join(",");
  const [lastSignature, setLastSignature] = useState(signature);
  if (signature !== lastSignature) {
    setLastSignature(signature);
    setItems(workstreams);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) return;
    setBusy(true);
    const result = await createWorkstreamAction(projectId, trimmed);
    setBusy(false);
    if (!result.success) {
      setError(result.error ?? "업무 영역을 추가하지 못했습니다.");
      return;
    }
    setError(null);
    setNewName("");
    if (result.data) setItems((prev) => [...prev, result.data!]);
  }

  async function handleRename(id: string) {
    const trimmed = editingName.trim();
    if (!trimmed) {
      setEditingId(null);
      return;
    }
    const previous = items;
    setItems((prev) =>
      prev.map((w) => (w.id === id ? { ...w, name: trimmed } : w))
    );
    setEditingId(null);

    const result = await editWorkstreamAction(id, { name: trimmed });
    if (!result.success) {
      setItems(previous);
      setError(result.error ?? "이름을 저장하지 못했습니다.");
    } else {
      setError(null);
    }
  }

  async function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    const previous = items;
    const next = [...items];
    [next[index], next[target]] = [next[target]!, next[index]!];
    setItems(next);

    const result = await reorderWorkstreamsAction(
      projectId,
      next.map((w) => w.id)
    );
    if (!result.success) {
      setItems(previous);
      setError(result.error ?? "순서를 저장하지 못했습니다.");
    } else {
      setError(null);
    }
  }

  return (
    <section aria-label="업무 영역" className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
        업무 영역
      </h3>

      {error && (
        <p role="alert" className="text-xs text-flag-blocked">
          {error}
        </p>
      )}

      {items.length === 0 && !adding && (
        <p className="text-xs text-text-tertiary">
          업무 영역을 만들면 프로젝트 안에서 업무를 갈래별로 묶을 수 있습니다.
        </p>
      )}

      <ul className="flex flex-col gap-1" role="list">
        {items.map((ws, index) => (
          <li
            key={ws.id}
            className="flex items-center gap-2 rounded-lg border border-separator bg-surface px-3 py-2"
          >
            {editingId === ws.id ? (
              <>
                <Input
                  value={editingName}
                  autoFocus
                  onChange={(e) => setEditingName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void handleRename(ws.id);
                    }
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  onBlur={() => void handleRename(ws.id)}
                  aria-label="업무 영역 이름"
                  className="h-8"
                />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="이름 저장"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => void handleRename(ws.id)}
                >
                  <Check className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <>
                <span className="flex-1 truncate text-sm text-text">
                  {ws.name}
                </span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`${ws.name} 위로 이동`}
                  disabled={index === 0}
                  onClick={() => void move(index, -1)}
                >
                  <span aria-hidden>↑</span>
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`${ws.name} 아래로 이동`}
                  disabled={index === items.length - 1}
                  onClick={() => void move(index, 1)}
                >
                  <span aria-hidden>↓</span>
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`${ws.name} 이름 수정`}
                  onClick={() => {
                    setEditingId(ws.id);
                    setEditingName(ws.name);
                  }}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
          </li>
        ))}
      </ul>

      {adding ? (
        <form onSubmit={handleCreate} className="flex items-center gap-2">
          <Input
            value={newName}
            autoFocus
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setAdding(false);
                setNewName("");
              }
            }}
            placeholder="업무 영역 이름"
            aria-label="새 업무 영역 이름"
            className="h-9"
          />
          <Button type="submit" variant="primary" size="sm" disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "추가"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="취소"
            onClick={() => {
              setAdding(false);
              setNewName("");
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex items-center gap-2 self-start rounded-lg px-2 py-1.5 text-sm text-text-tertiary transition-colors hover:bg-surface-2 hover:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Plus className="h-4 w-4" aria-hidden />
          업무 영역 추가
        </button>
      )}
    </section>
  );
}
