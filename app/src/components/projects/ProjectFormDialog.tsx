"use client";

import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, Loader2, Archive } from "lucide-react";
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
  "h-10 w-full rounded-lg border border-border bg-surface px-3 text-base text-text transition-[border-color,box-shadow] duration-fast ease-out hover:border-border-strong focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30";
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
    if (!window.confirm(`"${project.name}"을(를) 보관할까요? 보드에서 사라지지만 데이터는 남고, 나중에 복구할 수 있습니다.`)) return;
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
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-[rgb(var(--material-scrim))] backdrop-blur-sm data-[state=open]:animate-fade-in" />
        {/* Animation lives on the inner wrapper, not here: the scale-in
            keyframe sets a bare `transform: scale()`, which would otherwise
            permanently clobber the -translate-1/2 centering below once the
            animation's fill-mode holds its last frame. */}
        <Dialog.Content className="group fixed inset-x-0 bottom-0 z-50 max-h-[90vh] overflow-y-auto rounded-t-2xl border border-separator bg-elevated shadow-xl sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-full sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl">
        <div className="p-5 group-data-[state=open]:animate-scale-in">
          <div className="mb-4 flex items-start justify-between gap-4">
            <Dialog.Title className="text-lg font-semibold text-text">
              {editing ? "프로젝트 수정" : "새 프로젝트"}
            </Dialog.Title>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon-sm" aria-label="닫기">
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
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="project-brand"
                  className="text-2xs font-semibold uppercase tracking-wider text-text-tertiary"
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

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="project-name"
                className="text-2xs font-semibold uppercase tracking-wider text-text-tertiary"
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
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="project-objective"
                className="text-2xs font-semibold uppercase tracking-wider text-text-tertiary"
              >
                한 줄 목표
              </label>
              <Input
                id="project-objective"
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
                placeholder="이 프로젝트로 무엇을 이루려 하나요?"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="project-lead"
                className="text-2xs font-semibold uppercase tracking-wider text-text-tertiary"
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
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="project-start"
                  className="text-2xs font-semibold uppercase tracking-wider text-text-tertiary"
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
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="project-end"
                  className="text-2xs font-semibold uppercase tracking-wider text-text-tertiary"
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

            <div className="mt-1 flex items-center justify-between gap-2">
              {editing ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleArchive}
                  disabled={busy}
                  className="text-flag-blocked hover:bg-flag-blocked/10"
                >
                  <Archive className="h-4 w-4" aria-hidden />
                  보관
                </Button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <Dialog.Close asChild>
                  <Button type="button" variant="ghost">
                    취소
                  </Button>
                </Dialog.Close>
                <Button type="submit" variant="primary" disabled={busy}>
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
  );
}
