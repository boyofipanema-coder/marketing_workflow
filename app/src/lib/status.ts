/**
 * Task status + attention-flag vocabulary — the single source of truth for how
 * state is named and colored across the whole app. TaskCard, StatusBadge,
 * filters, and the detail panel all read from here so a status looks and reads
 * identically everywhere (apple-design: familiarity + spatial consistency).
 *
 * The six statuses mirror the DB enum in server/db/schema.ts. Colors map to the
 * --status-* tokens (Apple system colors) in globals.css.
 */

export const TASK_STATUSES = [
  "Inbox",
  "ToDo",
  "InProgress",
  "Waiting",
  "Review",
  "Done",
] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];

export interface StatusMeta {
  /** Human label shown in UI. */
  label: string;
  /** Tailwind text color utility (maps to a --status-* token). */
  text: string;
  /** Tailwind background for the color dot / solid pip. */
  dot: string;
  /** Tailwind tinted-fill background for soft badges. */
  fill: string;
  /** One-line meaning, for tooltips / empty states. */
  hint: string;
}

export const STATUS_META: Record<TaskStatus, StatusMeta> = {
  Inbox: {
    label: "미분류",
    text: "text-status-inbox",
    dot: "bg-status-inbox",
    fill: "bg-status-inbox/12",
    hint: "세부 내용을 아직 정리하지 않은 업무입니다.",
  },
  ToDo: {
    label: "예정",
    text: "text-status-todo",
    dot: "bg-status-todo",
    fill: "bg-status-todo/12",
    hint: "진행 준비가 완료된 업무입니다.",
  },
  InProgress: {
    label: "진행 중",
    text: "text-status-inprogress",
    dot: "bg-status-inprogress",
    fill: "bg-status-inprogress/12",
    hint: "현재 실행 중인 업무입니다.",
  },
  Waiting: {
    label: "대기 중",
    text: "text-status-waiting",
    dot: "bg-status-waiting",
    fill: "bg-status-waiting/12",
    hint: "회신, 승인 또는 협의 결과를 기다리고 있습니다.",
  },
  Review: {
    label: "검토 중",
    text: "text-status-review",
    dot: "bg-status-review",
    fill: "bg-status-review/12",
    hint: "제출된 결과물을 검토하고 있습니다.",
  },
  Done: {
    label: "완료",
    text: "text-status-done",
    dot: "bg-status-done",
    fill: "bg-status-done/12",
    hint: "필요한 업무가 모두 끝났습니다.",
  },
};

/** Cancelled is a terminal action, not a step in the flow — kept separate. */
export const CANCELLED_META: StatusMeta = {
  label: "취소",
  text: "text-status-cancelled",
  dot: "bg-status-cancelled",
  fill: "bg-status-cancelled/12",
  hint: "더 이상 진행하지 않는 업무입니다.",
};

/** Read-time attention flags computed in lib/derive.ts (not DB columns). */
export type AttentionFlag = "Blocked" | "Overdue" | "NeedsFollowup" | "Ready";

export const FLAG_META: Record<AttentionFlag, { label: string; text: string; fill: string }> = {
  Blocked: { label: "진행 차질", text: "text-flag-blocked", fill: "bg-flag-blocked/12" },
  Overdue: { label: "기한 초과", text: "text-flag-overdue", fill: "bg-flag-overdue/12" },
  NeedsFollowup: { label: "팔로업 필요", text: "text-flag-followup", fill: "bg-flag-followup/12" },
  Ready: { label: "시작 가능", text: "text-flag-ready", fill: "bg-flag-ready/12" },
};

export function statusMeta(status: TaskStatus, cancelled = false): StatusMeta {
  return cancelled ? CANCELLED_META : STATUS_META[status];
}
