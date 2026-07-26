"use client";

import { useRef, useState } from "react";
import { Plus, Loader2, ArrowUp, X } from "lucide-react";
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
          "group flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-text-tertiary",
          "transition-[transform,background-color,color] duration-fast ease-out hover:bg-surface-2/70 hover:text-text-secondary active:scale-[0.985]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          className
        )}
      >
        <span className="material-thin grid size-6 shrink-0 place-items-center rounded-lg transition-colors group-hover:text-accent">
          <Plus className="h-3.5 w-3.5" aria-hidden />
        </span>
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
        "material-panel material-edge flex items-center gap-1.5 rounded-xl border border-accent/35 p-1.5 pl-2 shadow-sm",
        className
      )}
    >
      {busy ? (
        <Loader2 className="h-3.5 w-3.5 flex-shrink-0 animate-spin text-accent" aria-hidden />
      ) : (
        <Plus className="h-3.5 w-3.5 flex-shrink-0 text-text-tertiary" aria-hidden />
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
        className="h-8 min-w-0 flex-1 bg-transparent px-1 text-base text-text placeholder:text-text-quaternary focus:outline-none"
      />
      <button
        type="button"
        aria-label="입력 취소"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          setTitle("");
          setOpen(false);
        }}
        className="grid size-8 shrink-0 place-items-center rounded-lg text-text-tertiary transition-colors hover:bg-surface-2 hover:text-text active:scale-95"
      >
        <X className="size-3.5" aria-hidden />
      </button>
      <button
        type="submit"
        aria-label="업무 저장"
        disabled={busy || !title.trim()}
        className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent text-text-on-accent shadow-xs transition-[transform,opacity,background-color] hover:bg-accent-hover active:scale-95 disabled:opacity-35"
      >
        <ArrowUp className="size-3.5" aria-hidden />
      </button>
    </form>
  );
}
