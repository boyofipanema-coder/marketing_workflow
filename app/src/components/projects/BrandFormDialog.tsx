"use client";

import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Loader2, X } from "lucide-react";
import { Button, Input } from "@/components/ui";
import { createBrandAction } from "@/app/actions/brands";
import type { Brand } from "@/server/db/schema";

const COLORS = ["#0a84ff", "#af52de", "#ff9500", "#30b0c7", "#34c759", "#ff375f"];

export default function BrandFormDialog({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (brand: Brand) => void;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName("");
    setColor(COLORS[0]);
    setError(null);
  }, [open]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("브랜드명을 입력해 주세요.");
      return;
    }
    setBusy(true);
    setError(null);
    const result = await createBrandAction({ name: name.trim(), color });
    setBusy(false);
    if (!result.success || !result.data) {
      setError(result.error ?? "브랜드를 만들지 못했습니다.");
      return;
    }
    onSaved?.(result.data);
    onOpenChange(false);
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-[rgb(var(--material-scrim))] backdrop-blur-sm data-[state=open]:animate-fade-in" />
        <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl border border-separator bg-elevated p-5 shadow-xl data-[state=open]:animate-scale-in sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-full sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="font-serif text-lg font-semibold text-text">
                새 브랜드
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-xs text-text-secondary">
                프로젝트를 묶는 가장 상위 단위입니다.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon-sm" aria-label="닫기">
                <X className="size-4" />
              </Button>
            </Dialog.Close>
          </div>

          <form onSubmit={submit} className="flex flex-col gap-4">
            {error && (
              <p role="alert" className="rounded-lg border border-flag-blocked/30 bg-flag-blocked/10 px-3 py-2 text-xs text-flag-blocked">
                {error}
              </p>
            )}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="brand-name" className="text-2xs font-semibold uppercase tracking-wider text-text-tertiary">
                브랜드명
              </label>
              <Input
                id="brand-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="예: AURALEE"
                autoFocus
              />
            </div>
            <fieldset>
              <legend className="mb-2 text-2xs font-semibold uppercase tracking-wider text-text-tertiary">
                식별 색상
              </legend>
              <div className="flex flex-wrap gap-2">
                {COLORS.map((token) => (
                  <button
                    key={token}
                    type="button"
                    onClick={() => setColor(token)}
                    aria-label={`브랜드 색상 ${token}`}
                    aria-pressed={color === token}
                    className="grid size-9 place-items-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <span
                      className="size-6 rounded-full transition-transform active:scale-90"
                      style={{
                        background: token,
                        boxShadow: color === token ? `0 0 0 3px rgb(var(--surface)), 0 0 0 5px ${token}` : undefined,
                      }}
                    />
                  </button>
                ))}
              </div>
            </fieldset>
            <div className="mt-1 flex justify-end gap-2">
              <Dialog.Close asChild>
                <Button type="button" variant="ghost">취소</Button>
              </Dialog.Close>
              <Button type="submit" variant="primary" disabled={busy}>
                {busy && <Loader2 className="size-4 animate-spin" />}
                브랜드 만들기
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
