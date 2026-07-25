"use client";

import { useState } from "react";
import { Loader2, Plus, X } from "lucide-react";
import {
  createMilestoneAction,
  editMilestoneAction,
} from "@/app/actions/milestones";
import { Button, Input } from "@/components/ui";
import EmptyState from "@/components/EmptyState";
import type { Milestone } from "@/server/db/schema";

interface MilestoneManagerProps {
  projectId: string;
  milestones: Milestone[];
}

const dateClass =
  "h-9 rounded-lg border border-border bg-surface px-3 text-base text-text focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30";

function fmt(iso: string): string {
  return new Date(iso).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/** Create and edit a project's milestones. Names and dates are edited in place. */
export default function MilestoneManager({
  projectId,
  milestones,
}: MilestoneManagerProps) {
  const [items, setItems] = useState(milestones);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const signature = milestones
    .map((m) => `${m.id}:${m.name}:${m.due_date}`)
    .join(",");
  const [lastSignature, setLastSignature] = useState(signature);
  if (signature !== lastSignature) {
    setLastSignature(signature);
    setItems(milestones);
  }

  const sorted = [...items].sort((a, b) =>
    a.due_date < b.due_date ? -1 : a.due_date > b.due_date ? 1 : 0
  );

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || !dueDate) {
      setError("이름과 마감일을 모두 입력해 주세요.");
      return;
    }
    setBusy(true);
    const result = await createMilestoneAction(projectId, trimmed, dueDate);
    setBusy(false);
    if (!result.success) {
      setError(result.error ?? "마일스톤을 추가하지 못했습니다.");
      return;
    }
    setError(null);
    setName("");
    setDueDate("");
    setAdding(false);
    if (result.data) setItems((prev) => [...prev, result.data!]);
  }

  async function patch(id: string, next: { name?: string; dueDate?: string }) {
    const previous = items;
    setItems((prev) =>
      prev.map((m) =>
        m.id === id
          ? {
              ...m,
              name: next.name ?? m.name,
              due_date: next.dueDate ?? m.due_date,
            }
          : m
      )
    );

    const result = await editMilestoneAction(id, next);
    if (!result.success) {
      setItems(previous);
      setError(result.error ?? "마일스톤을 저장하지 못했습니다.");
    } else {
      setError(null);
    }
  }

  return (
    <section aria-label="마일스톤" className="flex flex-col gap-3">
      {error && (
        <p role="alert" className="text-xs text-flag-blocked">
          {error}
        </p>
      )}

      {sorted.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-surface-2/40">
          <EmptyState
            title="등록된 마일스톤이 없습니다"
            description="주요 일정을 마일스톤으로 등록하면 홈의 다음 업무에 표시됩니다."
          />
        </div>
      ) : (
        <ul className="flex flex-col gap-2" role="list">
          {sorted.map((ms) => (
            <li
              key={ms.id}
              className="flex flex-wrap items-center gap-2 rounded-lg border border-separator bg-surface px-3 py-2"
            >
              <Input
                defaultValue={ms.name}
                aria-label={`${ms.name} 이름`}
                className="h-9 flex-1 min-w-[8rem]"
                onBlur={(e) => {
                  const value = e.target.value.trim();
                  if (value && value !== ms.name) void patch(ms.id, { name: value });
                  else e.target.value = ms.name;
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                }}
              />
              <input
                type="date"
                value={ms.due_date}
                aria-label={`${ms.name} 마감일`}
                className={dateClass}
                onChange={(e) => {
                  if (e.target.value) void patch(ms.id, { dueDate: e.target.value });
                }}
              />
              <span className="text-xs tabular-nums text-text-tertiary">
                {fmt(ms.due_date)}
              </span>
            </li>
          ))}
        </ul>
      )}

      {adding ? (
        <form onSubmit={handleCreate} className="flex flex-wrap items-center gap-2">
          <Input
            value={name}
            autoFocus
            onChange={(e) => setName(e.target.value)}
            placeholder="마일스톤 이름"
            aria-label="새 마일스톤 이름"
            className="h-9 flex-1 min-w-[8rem]"
          />
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            aria-label="새 마일스톤 마감일"
            className={dateClass}
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
              setError(null);
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
          마일스톤 추가
        </button>
      )}
    </section>
  );
}
