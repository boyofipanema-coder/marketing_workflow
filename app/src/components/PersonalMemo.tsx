"use client";

import { useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Check, CheckSquare2, Clock3, Loader2, Maximize2, Minimize2, NotebookPen, X } from "lucide-react";
import { savePersonalNoteAction } from "@/app/actions/personal-note";
import { cn } from "@/lib/utils";

const SAVE_DELAY = 700;
const SIZE_KEY = "mtw:personal-memo-size";

export default function PersonalMemo({ initialBody }: { initialBody: string }) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState(initialBody);
  const [size, setSize] = useState<"small" | "large">("small");
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(initialBody);
  const editor = useRef<HTMLTextAreaElement>(null);

  async function save(value: string) {
    setState("saving");
    const result = await savePersonalNoteAction(value);
    setState(result.success ? "saved" : "error");
  }

  function schedule(value: string) {
    setBody(value);
    latest.current = value;
    setState("idle");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      void save(value);
    }, SAVE_DELAY);
  }

  function insertText(value: string) {
    const textarea = editor.current;
    const start = textarea?.selectionStart ?? body.length;
    const end = textarea?.selectionEnd ?? body.length;
    const prefix = start > 0 && body[start - 1] !== "\n" ? "\n" : "";
    const next = `${body.slice(0, start)}${prefix}${value}${body.slice(end)}`;
    schedule(next);
    requestAnimationFrame(() => {
      const cursor = start + prefix.length + value.length;
      editor.current?.focus();
      editor.current?.setSelectionRange(cursor, cursor);
    });
  }

  function toggleSize() {
    setSize((current) => {
      const next = current === "small" ? "large" : "small";
      try {
        localStorage.setItem(SIZE_KEY, next);
      } catch {
        // The size preference is optional when storage is unavailable.
      }
      return next;
    });
  }

  useEffect(() => {
    try {
      if (localStorage.getItem(SIZE_KEY) === "large") setSize("large");
    } catch {
      // Keep the compact default.
    }
    function onShortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === "m") {
        event.preventDefault();
        setOpen((current) => !current);
      }
    }
    window.addEventListener("keydown", onShortcut);
    return () => window.removeEventListener("keydown", onShortcut);
  }, []);

  useEffect(() => () => {
    if (timer.current) {
      clearTimeout(timer.current);
      void savePersonalNoteAction(latest.current);
    }
  }, []);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button type="button" aria-label="메모 열기" title="메모 · ⌘⇧M" className="grid size-8 place-items-center rounded-lg text-text-secondary transition-[transform,background-color,color] duration-fast ease-out hover:bg-surface-2 hover:text-text active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg">
          <NotebookPen className="size-4" aria-hidden />
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-black/15 backdrop-blur-[2px] data-[state=open]:animate-fade-in" />
        <Dialog.Content
          aria-describedby="personal-memo-description"
          className={cn(
            "fixed inset-x-3 top-[4.25rem] z-[70] flex max-h-[calc(100dvh-5rem)] flex-col overflow-hidden rounded-[22px] border border-border/80 bg-elevated/95 shadow-[0_28px_90px_rgba(15,23,42,0.22),0_8px_24px_rgba(15,23,42,0.1)] outline-none backdrop-blur-xl data-[state=open]:animate-scale-in sm:left-auto sm:right-5",
            size === "large" ? "sm:w-[min(46rem,calc(100vw-2.5rem))]" : "sm:w-[25rem]",
          )}
        >
          <header className="relative flex min-h-14 items-center gap-3 border-b border-separator px-4">
            <span className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-accent via-accent/55 to-transparent" aria-hidden />
            <span className="grid size-8 place-items-center rounded-xl bg-accent-soft text-accent"><NotebookPen className="size-4" aria-hidden /></span>
            <div className="min-w-0 flex-1">
              <Dialog.Title className="text-sm font-semibold tracking-tight text-text">빠른 메모</Dialog.Title>
              <p className="mt-0.5 text-[10px] text-text-tertiary">생각을 적고, 필요한 항목만 업무로 옮기세요.</p>
            </div>
            <button type="button" onClick={toggleSize} aria-label={size === "small" ? "메모 크게 보기" : "메모 작게 보기"} title={size === "small" ? "크게" : "작게"} className="grid size-8 place-items-center rounded-lg text-text-tertiary transition-colors hover:bg-surface-2 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {size === "small" ? <Maximize2 className="size-4" aria-hidden /> : <Minimize2 className="size-4" aria-hidden />}
            </button>
            <Dialog.Close asChild>
              <button type="button" aria-label="메모 닫기" className="grid size-8 place-items-center rounded-lg text-text-tertiary transition-colors hover:bg-surface-2 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><X className="size-4" aria-hidden /></button>
            </Dialog.Close>
          </header>

          <div className="flex items-center gap-1.5 border-b border-separator bg-surface-2/55 px-3 py-2">
            <button type="button" onClick={() => insertText("☐ ")} className="inline-flex h-7 items-center gap-1.5 rounded-lg px-2 text-[10px] font-semibold text-text-secondary transition-colors hover:bg-surface hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><CheckSquare2 className="size-3.5" aria-hidden /> 체크 항목</button>
            <button
              type="button"
              onClick={() => {
                const now = new Date();
                insertText(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")} `);
              }}
              className="inline-flex h-7 items-center gap-1.5 rounded-lg px-2 text-[10px] font-semibold text-text-secondary transition-colors hover:bg-surface hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            ><Clock3 className="size-3.5" aria-hidden /> 날짜·시각</button>
            <span className="ml-auto font-mono text-[9px] tabular-nums text-text-quaternary">{body.length.toLocaleString()} / 20,000</span>
          </div>

          <div className="relative flex-1 bg-surface">
            <div className="pointer-events-none absolute bottom-4 left-4 top-4 w-px bg-accent/25" aria-hidden />
            <textarea
              ref={editor}
              value={body}
              onChange={(event) => schedule(event.target.value)}
              onBlur={() => {
                if (!timer.current) return;
                clearTimeout(timer.current);
                timer.current = null;
                void save(body);
              }}
              maxLength={20_000}
              aria-label="개인 메모"
              placeholder="회의 중 나온 생각, 확인할 링크, 아직 업무로 만들지 않은 아이디어를 자유롭게 적어보세요."
              className={cn(
                "w-full resize-none bg-transparent pb-6 pl-8 pr-5 pt-5 text-[14px] leading-7 text-text outline-none placeholder:text-text-quaternary",
                size === "large" ? "h-[min(66dvh,42rem)] min-h-80" : "h-[min(23rem,calc(100dvh-12rem))] min-h-60",
              )}
            />
          </div>

          <footer className="flex min-h-10 items-center justify-between border-t border-separator bg-surface-2/70 px-4 text-[10px] text-text-tertiary">
            <Dialog.Description id="personal-memo-description">입력한 내용은 자동 저장됩니다. <span className="hidden sm:inline">⌘⇧M으로 어디서든 열 수 있습니다.</span></Dialog.Description>
            <span role="status" className="flex min-h-5 items-center gap-1 font-semibold">
              {state === "saving" && <><Loader2 className="size-3 animate-spin" aria-hidden />저장 중</>}
              {state === "saved" && <><Check className="size-3 text-status-done" aria-hidden />저장됨</>}
              {state === "error" && <span className="text-flag-blocked">저장 실패</span>}
            </span>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
