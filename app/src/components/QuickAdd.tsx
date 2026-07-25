"use client";

import { useState, useRef, useEffect } from "react";
import { Button, Input } from "@/components/ui";
import { cn } from "@/lib/utils";

interface QuickAddProps {
  /** Called with the trimmed title when the user submits */
  onCreate: (title: string) => void;
  /** Optional cancel handler */
  onCancel?: () => void;
  placeholder?: string;
  className?: string;
}

export default function QuickAdd({
  onCreate,
  onCancel,
  placeholder = "해야 할 업무를 입력하세요",
  className = "",
}: QuickAddProps) {
  const [title, setTitle] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus when mounted
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    onCreate(trimmed);
    setTitle("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onCancel?.();
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-separator bg-elevated p-4 shadow-xl",
        className,
      )}
      role="dialog"
      aria-label="업무 빠른 추가"
    >
      <p className="text-2xs font-semibold uppercase tracking-wider text-text-tertiary">업무 추가</p>

      <Input
        ref={inputRef}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        aria-label="업무명"
      />

      <div className="flex items-center justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>취소</Button>
        )}
        <Button type="submit" variant="primary" size="sm" disabled={!title.trim()}>업무 추가</Button>
      </div>

      <p className="text-2xs text-text-tertiary">
        <kbd className="rounded bg-surface-2 px-1 py-0.5 font-mono text-2xs text-text-secondary">
          Esc
        </kbd>{" "}
        키를 누르면 닫힙니다
      </p>
    </form>
  );
}
