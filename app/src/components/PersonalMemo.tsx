"use client";

import { useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Check, Loader2, NotebookPen, X } from "lucide-react";
import { savePersonalNoteAction } from "@/app/actions/personal-note";

const SAVE_DELAY = 700;

export default function PersonalMemo({ initialBody }: { initialBody: string }) {
  const [body, setBody] = useState(initialBody);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(initialBody);

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

  useEffect(() => {
    return () => {
      if (timer.current) {
        clearTimeout(timer.current);
        void savePersonalNoteAction(latest.current);
      }
    };
  }, []);

  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <button
          type="button"
          aria-label="메모 열기"
          title="메모"
          className="grid size-8 place-items-center rounded-lg text-text-secondary transition-[transform,background-color,color] duration-fast ease-out hover:bg-surface-2 hover:text-text active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        >
          <NotebookPen className="size-4" aria-hidden />
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-black/10 backdrop-blur-[1px] data-[state=open]:animate-fade-in" />
        <Dialog.Content
          aria-describedby="personal-memo-description"
          className="fixed inset-x-3 top-[4.25rem] z-[70] max-h-[calc(100dvh-5rem)] overflow-hidden rounded-[5px] border border-[#d8cb91] bg-[#fff8d6] shadow-[0_24px_70px_rgba(53,47,24,0.28),0_3px_10px_rgba(53,47,24,0.14)] outline-none data-[state=open]:animate-scale-in sm:left-auto sm:right-5 sm:w-[24rem]"
        >
          <div className="relative flex h-9 items-center justify-center border-b border-[#d8cb91] bg-[#eadfa9] px-12">
            <div className="absolute inset-x-5 top-[-5px] flex justify-between" aria-hidden>
              {Array.from({ length: 9 }).map((_, index) => (
                <span
                  key={index}
                  className="size-3 rounded-full border border-[#a99e6d] bg-[#746e55] shadow-[inset_0_1px_2px_rgba(0,0,0,0.35)]"
                />
              ))}
            </div>
            <Dialog.Title className="font-serif text-sm font-bold tracking-[0.08em] text-[#37362f]">
              내 메모
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="메모 닫기"
                className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-[#6e6956] hover:bg-black/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6e6956]"
              >
                <X className="size-4" aria-hidden />
              </button>
            </Dialog.Close>
          </div>

          <div className="relative">
            <div
              className="pointer-events-none absolute bottom-0 left-[3.25rem] top-0 z-10 w-px bg-[#de9285]/75"
              aria-hidden
            />
            <textarea
              value={body}
              onChange={(event) => schedule(event.target.value)}
              onBlur={() => {
                if (!timer.current) return;
                clearTimeout(timer.current);
                timer.current = null;
                void save(body);
              }}
              rows={12}
              maxLength={20_000}
              aria-label="개인 메모"
              placeholder={"회의 중 나온 생각\n확인할 링크\n아직 업무로 만들지 않은 아이디어"}
              className="h-[min(25rem,calc(100dvh-10rem))] min-h-56 w-full resize-none bg-[#fff8d6] px-5 pb-6 pl-[4.25rem] pt-[18px] font-serif text-[15px] leading-8 text-[#292b2a] outline-none placeholder:text-[#8b876f]"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(to bottom, transparent 0, transparent 31px, rgba(126, 161, 179, 0.38) 31px, rgba(126, 161, 179, 0.38) 32px)",
                backgroundPosition: "0 17px",
              }}
            />
          </div>

          <footer className="flex min-h-10 items-center justify-between border-t border-[#d8cb91] bg-[#f3e9b9] px-4 text-[10px] text-[#756f59]">
            <Dialog.Description id="personal-memo-description">
              입력한 내용은 자동으로 저장됩니다.
            </Dialog.Description>
            <span role="status" className="flex min-h-5 items-center gap-1 font-semibold">
              {state === "saving" && <><Loader2 className="size-3 animate-spin" aria-hidden />저장 중</>}
              {state === "saved" && <><Check className="size-3 text-[#47735b]" aria-hidden />저장됨</>}
              {state === "error" && <span className="text-[#a33c32]">저장 실패</span>}
            </span>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
