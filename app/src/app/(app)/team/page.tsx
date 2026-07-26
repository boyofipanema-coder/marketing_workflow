import { Users } from "lucide-react";

/**
 * Team page — non-functional placeholder.
 * Full team directory, roles, and workload view are planned for a later milestone.
 */
export default function TeamPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
      <div className="flex flex-col items-center justify-center gap-6 rounded-2xl border border-dashed border-separator bg-surface py-24 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-2">
          <Users className="h-7 w-7 text-text-tertiary" aria-hidden />
        </div>

        <div className="flex flex-col gap-1.5">
          <h1 className="text-xl font-semibold text-text">팀</h1>
          <p className="text-sm text-text-secondary max-w-xs leading-relaxed">
            팀 디렉터리, 업무량 현황, 담당 배정 기능은 이후 마일스톤에서 제공될 예정입니다.
          </p>
        </div>

        <span className="inline-flex items-center rounded-full border border-separator bg-surface-2 px-3 py-1 text-xs font-medium text-text-tertiary">준비 중</span>
      </div>
    </div>
  );
}
