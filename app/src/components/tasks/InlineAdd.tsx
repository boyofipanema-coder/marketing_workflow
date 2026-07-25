"use client";

import { useRef, useState } from "react";
import { Plus, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface InlineAddProps {
  /** Returns true when the task was created, so the field can reset and stay open. */
  onAdd: (title: string) => Promise<boolean>;
  placeholder?: string;
  label?: string;
  className?: string;
}

/**
 * The "add task" affordance that sits at the bottom of a list: one click turns
 * the button into a field, Enter commits and keeps the field open for the next
 * one, Escape closes it.
 */
export default function InlineAdd({
  onAdd,
  placeholder = "업무명을 입력하고 Enter",
  label = "업무 추가",
  className,
}: InlineAddProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function submit() {
    const trimmed = title.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    const ok = await onAdd(trimmed);
    setBusy(false);
    if (ok) {
      setTitle("");
      inputRef.current?.focus();
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-text-tertiary",
          "transition-colors hover:bg-surface-2/60 hover:text-text-secondary",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          className
        )}
      >
        <Plus className="h-4 w-4" aria-hidden />
        {label}
      </button>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className={cn(
        "flex items-center gap-2.5 rounded-lg border border-accent/40 bg-surface px-3 py-1.5",
        className
      )}
    >
      {busy ? (
        <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin text-text-tertiary" aria-hidden />
      ) : (
        <Plus className="h-4 w-4 flex-shrink-0 text-text-tertiary" aria-hidden />
      )}
      <input
        ref={inputRef}
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            setTitle("");
            setOpen(false);
          }
        }}
        onBlur={() => {
          if (!title.trim()) setOpen(false);
        }}
        placeholder={placeholder}
        aria-label={label}
        className="h-9 flex-1 bg-transparent text-base text-text placeholder:text-text-quaternary focus:outline-none"
      />
    </form>
  );
}
