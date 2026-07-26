"use client";

import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, Loader2, Archive, AlertTriangle } from "lucide-react";
import { Button, Input } from "@/components/ui";
import {
  createProjectAction,
  editProjectAction,
  archiveProjectAction,
} from "@/app/actions/projects";
import type { Brand, Project, Member } from "@/server/db/schema";

export interface ProjectFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: Member[];
  brands?: Brand[];
  /** Brand preselected when creating inside an integrated brand section. */
  defaultBrandId?: string;
  /** Omit to create; pass a project to edit it in place. */
  project?: Project | null;
  /** Fallback lead for a new project — normally the current member. */
  defaultLeadId: string;
  onSaved?: (project: Project) => void;
}

const fieldClass =
  "h-11 w-full rounded-xl border border-separator bg-surface-2/[0.55] px-3.5 text-base text-text shadow-[inset_0_1px_0_rgb(var(--material-edge))] transition-[background-color,border-color,box-shadow] duration-fast ease-out hover:border-border-strong hover:bg-surface-2/75 focus:border-accent focus:bg-surface focus:outline-none focus:ring-2 focus:ring-accent/25";
const inputClass = `${fieldClass} h-11`;
const EMPTY_BRANDS: Brand[] = [];

/**
 * Create/edit form for a project. Field-level errors render next to the field
 * they belong to; anything else lands in the form-level alert.
 */
export default function ProjectFormDialog({
  open,
  onOpenChange,
  members,
  brands = EMPTY_BRANDS,
  defaultBrandId,
  project,
  defaultLeadId,
  onSaved,
}: ProjectFormDialogProps) {
  const editing = Boolean(project);

  const [name, setName] = useState("");
  const [brandId, setBrandId] = useState(defaultBrandId ?? "");
  const [objective, setObjective] = useState("");
  const [leadId, setLeadId] = useState(defaultLeadId);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false);

  // Reload the form whenever it opens, so a cancelled edit leaves no residue.
  useEffect(() => {
    if (!open) return;
    setName(project?.name ?? "");
    setBrandId(project?.brand_id ?? defaultBrandId ?? brands[0]?.id ?? "");
    setObjective(project?.one_line_objective ?? "");
    setLeadId(project?.project_lead_id ?? defaultLeadId);
    setStartDate(project?.target_start_date ?? "");
    setEndDate(project?.target_end_date ?? "");
    setError(null);
    setArchiveConfirmOpen(false);
  }, [open, project, defaultLeadId, defaultBrandId, brands]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("프로젝트명을 입력해 주세요.");
      return;
    }

    setBusy(true);
    setError(null);

    const payload = {
      brandId: brandId || null,
      name: trimmed,
      projectLeadId: leadId,
      oneLineObjective: objective.trim() || null,
      targetStartDate: startDate || null,
      targetEndDate: endDate || null,
    };

    const result = project
      ? await editProjectAction(project.id, {
          brandId: payload.brandId,
          name: payload.name,
          projectLeadId: payload.projectLeadId,
          oneLineObjective: payload.oneLineObjective,
          targetStartDate: payload.targetStartDate,
          targetEndDate: payload.targetEndDate,
        })
      : await createProjectAction(payload);

    setBusy(false);

    if (!result.success) {
      setError(result.error ?? "저장하지 못했습니다.");
      return;
    }
    if (result.data) onSaved?.(result.data);
    onOpenChange(false);
  }

  async function handleArchive() {
    if (!project) return;
    setArchiveConfirmOpen(false);
    setBusy(true);
    setError(null);
    const result = await archiveProjectAction(project.id);
    setBusy(false);
    if (!result.success) {
      setError(result.error ?? "보관하지 못했습니다.");
      return;
    }
    if (result.data) onSaved?.(result.data);
    onOpenChange(false);
  }

  return (
    <>
      <Dialog.Root open={open} onOpenChange={onOpenChange}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-[rgb(var(--material-scrim))] backdrop-blur-sm data-[state=open]:animate-fade-in" />
        {/* Animation lives on the inner wrapper, not here: the scale-in
            keyframe sets a bare `transform: scale()`, which would otherwise
            permanently clobber the -translate-1/2 centering below once the
            animation's fill-mode holds its last frame. */}
          <Dialog.Content className="material-panel material-edge group fixed inset-x-0 bottom-0 z-50 max-h-[92vh] overflow-y-auto rounded-t-[24px] border border-separator shadow-xl sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-[min(36rem,calc(100vw-2rem))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[24px]">
          <div className="p-5 group-data-[state=open]:animate-scale-in sm:p-6">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <Dialog.Title className="text-xl font-semibold tracking-tight text-text">
                  {editing ? "프로젝트 수정" : "새 프로젝트"}
                </Dialog.Title>
                <Dialog.Description className="mt-1 text-sm leading-relaxed text-text-tertiary">
                  브랜드 아래 프로젝트의 목표와 담당 기간을 정합니다.
                </Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <Button variant="ghost" size="icon-sm" aria-label="닫기" className="rounded-full">
                  <X className="h-4 w-4" />
                </Button>
              </Dialog.Close>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {error && (
              <p
                role="alert"
                className="rounded-lg border border-flag-blocked/30 bg-flag-blocked/10 px-3 py-2 text-xs text-flag-blocked"
              >
                {error}
              </p>
            )}

            {brands.length > 0 && (
              <div className="flex flex-col gap-2">
                <label
                  htmlFor="project-brand"
                  className="px-0.5 text-xs font-semibold text-text-secondary"
                >
                  브랜드
                </label>
                <select
                  id="project-brand"
                  value={brandId}
                  onChange={(e) => setBrandId(e.target.value)}
                  className={fieldClass}
                  required
                >
                  {brands.map((brand) => (
                    <option key={brand.id} value={brand.id}>
                      {brand.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <label
                htmlFor="project-name"
                className="px-0.5 text-xs font-semibold text-text-secondary"
              >
                프로젝트명
              </label>
              <Input
                id="project-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="예: 3분기 브랜드 캠페인"
                autoFocus
                required
                className={inputClass}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label
                htmlFor="project-objective"
                className="px-0.5 text-xs font-semibold text-text-secondary"
              >
                한 줄 목표
              </label>
              <Input
                id="project-objective"
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
                placeholder="이 프로젝트로 무엇을 이루려 하나요?"
                className={inputClass}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label
                htmlFor="project-lead"
                className="px-0.5 text-xs font-semibold text-text-secondary"
              >
                프로젝트 리드
              </label>
              <select
                id="project-lead"
                value={leadId}
                onChange={(e) => setLeadId(e.target.value)}
                className={fieldClass}
              >
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <label
                  htmlFor="project-start"
                  className="px-0.5 text-xs font-semibold text-text-secondary"
                >
                  시작일
                </label>
                <input
                  id="project-start"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className={fieldClass}
                />
              </div>
              <div className="flex flex-col gap-2">
                <label
                  htmlFor="project-end"
                  className="px-0.5 text-xs font-semibold text-text-secondary"
                >
                  종료일
                </label>
                <input
                  id="project-end"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className={fieldClass}
                />
              </div>
            </div>

            <div className="mt-2 flex items-center justify-between gap-2 border-t border-separator pt-4">
              {editing ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setArchiveConfirmOpen(true)}
                  disabled={busy}
                  className="rounded-xl text-flag-blocked hover:bg-flag-blocked/10"
                >
                  <Archive className="h-4 w-4" aria-hidden />
                  보관
                </Button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <Dialog.Close asChild>
                  <Button type="button" variant="ghost" className="rounded-xl">
                    취소
                  </Button>
                </Dialog.Close>
                <Button type="submit" variant="primary" disabled={busy} className="rounded-xl px-5">
                  {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                  {editing ? "저장" : "프로젝트 만들기"}
                </Button>
              </div>
            </div>
            </form>
          </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root open={archiveConfirmOpen} onOpenChange={setArchiveConfirmOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[60] bg-[rgb(var(--material-scrim))] backdrop-blur-md data-[state=open]:animate-fade-in" />
          <Dialog.Content className="material-panel material-edge group fixed left-1/2 top-1/2 z-[70] w-[min(23rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-[22px] border border-separator p-5 text-center shadow-xl">
            <div className="group-data-[state=open]:animate-scale-in">
              <div className="mx-auto mb-3 grid size-11 place-items-center rounded-full bg-flag-blocked/10 text-flag-blocked">
                <AlertTriangle className="size-5" aria-hidden />
              </div>
              <Dialog.Title className="text-[17px] font-semibold tracking-tight text-text">
                프로젝트를 보관할까요?
              </Dialog.Title>
              <Dialog.Description className="mx-auto mt-2 max-w-[18rem] text-sm leading-relaxed text-text-secondary">
                “{project?.name}”은 보드에서 사라지지만 데이터는 남아 나중에 복구할 수 있습니다.
              </Dialog.Description>
              <div className="mt-5 grid grid-cols-2 gap-2">
                <Dialog.Close asChild>
                  <Button type="button" variant="secondary" className="h-10 rounded-xl">
                    취소
                  </Button>
                </Dialog.Close>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => void handleArchive()}
                  disabled={busy}
                  className="h-10 rounded-xl"
                >
                  {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
                  보관
                </Button>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
