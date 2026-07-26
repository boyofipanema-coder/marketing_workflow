"use client";

import { useLayoutEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  ArrowUpRight,
  Check,
  ChevronRight,
  Circle,
  CircleCheck,
  Clock3,
  CornerDownRight,
  FolderPlus,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { statusMeta, displayGroup, type TaskStatus } from "@/lib/status";
import {
  cancelTaskAction,
  completeTaskAction,
  editTaskAction,
  reopenTaskAction,
} from "@/app/actions/tasks";
import type { Task, Brand, Workstream, Member, Project } from "@/server/db/schema";
import { buildBoardGraph, isKey, laneKeyFor, type ChildMap, type GroupBy } from "@/lib/board-graph";
import { ownerColor } from "@/lib/colors";

/**
 * WorkflowCanvas — a fixed, document-scrolling swimlane Kanban.
 *
 * Rows = a group-by dimension (Workstream / Owner / Due). Regular boards use
 * status columns; the integrated Home hierarchy maps columns directly to
 * Brand → Project → Task → Subtask → Done. Dense cells cap at CAP cards with
 * a "+N more" expander (decision B).
 *
 * Two orthogonal axes, kept strictly separate: hierarchy expands *down* (inside
 * a card), grouping pivots *sideways* (the lane axis). Card heights are computed
 * analytically from the visible subtree so positioning never overlaps.
 */

// ── stage flow ────────────────────────────────────────────────────────────────
const STATUS_STAGE_LABELS = ["진행 중", "대기", "완료"] as const;
const STATUS_STAGE_TOKENS = ["status-inprogress", "status-waiting", "status-done"] as const;
const HIERARCHY_STAGE_LABELS = ["업무", "하위업무", "완료"] as const;
const HIERARCHY_STAGE_TOKENS = ["status-todo", "status-review", "status-done"] as const;
const STAGE_COUNT = 3;

function statusStageIndex(s: TaskStatus): number {
  switch (displayGroup(s)) {
    case "Waiting":
      return 1;
    case "Done":
      return 2;
    default:
      return 0;
  }
}

export function hierarchyStageIndex(
  task: Pick<Task, "status" | "parent_task_id">
): number {
  if (task.status === "Done") return 2;
  return task.parent_task_id ? 1 : 0;
}
const todayStr = () => new Date().toISOString().slice(0, 10);
function overdue(t: Task): boolean {
  return !!t.due_date && t.status !== "Done" && !t.cancelled_at && t.due_date < todayStr();
}
function fmtDue(iso: string): string {
  const x = new Date(iso);
  const diff = Math.round((+x - +new Date(new Date().toDateString())) / 864e5);
  if (diff === 0) return "오늘";
  if (diff === 1) return "내일";
  if (diff === -1) return "어제";
  if (diff < 0) return `${Math.abs(diff)}일 전`;
  if (diff <= 7) return `${diff}일 후`;
  return x.toLocaleDateString("ko-KR", { month: "long", day: "numeric" });
}

function TaskCompleteButton({
  task,
  compact = false,
  onChanged,
}: {
  task: Task;
  compact?: boolean;
  onChanged: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const done = task.status === "Done";

  async function toggle() {
    if (pending || task.cancelled_at) return;
    setPending(true);
    setFailed(false);
    const result = done
      ? await reopenTaskAction(task.id, task.version)
      : await completeTaskAction(task.id, task.version);
    setPending(false);
    if (!result.success) {
      setFailed(true);
      return;
    }
    onChanged();
  }

  return (
    <button
      type="button"
      data-ui
      onClick={toggle}
      disabled={pending || Boolean(task.cancelled_at)}
      aria-label={done ? `${task.title} 완료 해제` : `${task.title} 완료`}
      aria-pressed={done}
      title={failed ? "상태를 변경하지 못했습니다." : undefined}
      className={cn(
        "grid shrink-0 place-items-center rounded-full transition-[transform,color,background-color] active:scale-[0.9] disabled:opacity-45",
        compact ? "size-6" : "size-8",
        failed && "text-flag-blocked"
      )}
    >
      {pending ? (
        <Loader2 className={cn("animate-spin", compact ? "size-4" : "size-5")} aria-hidden />
      ) : done ? (
        <span className={cn("grid place-items-center rounded-full bg-status-done text-white", compact ? "size-4" : "size-5")}>
          <Check className={compact ? "size-2.5" : "size-3"} strokeWidth={3} aria-hidden />
        </span>
      ) : (
        <Circle className={cn("text-text-tertiary", compact ? "size-4" : "size-5")} strokeWidth={1.8} aria-hidden />
      )}
    </button>
  );
}

function TaskActionMenu({
  task,
  compact = false,
  onEdit,
  onChanged,
}: {
  task: Task;
  compact?: boolean;
  onEdit: () => void;
  onChanged: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [waitOpen, setWaitOpen] = useState(false);
  const [waitingParty, setWaitingParty] = useState("");
  const [followUpAt, setFollowUpAt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const done = task.status === "Done";

  async function finish() {
    setPending(true);
    const result = done
      ? await reopenTaskAction(task.id, task.version)
      : await completeTaskAction(task.id, task.version);
    setPending(false);
    if (result.success) onChanged();
  }

  async function remove() {
    setPending(true);
    const result = await cancelTaskAction(task.id, task.version);
    setPending(false);
    if (result.success) onChanged();
  }

  async function moveToWaiting(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!waitingParty.trim() || !followUpAt) return;
    setPending(true);
    setError(null);
    const result = await editTaskAction(task.id, task.version, {
      status: "Waiting",
      waiting_party_text: waitingParty.trim(),
      follow_up_at: followUpAt,
    });
    setPending(false);
    if (!result.success) {
      setError(result.error ?? "대기 상태로 이동하지 못했습니다.");
      return;
    }
    setWaitOpen(false);
    onChanged();
  }

  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            data-ui
            aria-label={`${task.title} 빠른 작업`}
            disabled={pending}
            className={cn(
              "grid shrink-0 place-items-center rounded-full text-text-tertiary transition-[opacity,background-color,color,transform] hover:bg-surface-2 hover:text-text active:scale-[0.92] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              compact ? "size-6" : "size-8"
            )}
          >
            {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <MoreHorizontal className="size-4" aria-hidden />}
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={5}
            className="z-[70] min-w-44 origin-[var(--radix-dropdown-menu-content-transform-origin)] rounded-xl border border-separator bg-elevated/95 p-1.5 shadow-xl backdrop-blur-xl data-[state=open]:animate-scale-in"
          >
            <DropdownMenu.Item onSelect={onEdit} className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-text outline-none data-[highlighted]:bg-surface-2">
              <Pencil className="size-3.5" aria-hidden />
              수정
            </DropdownMenu.Item>
            <DropdownMenu.Item onSelect={() => void finish()} className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-text outline-none data-[highlighted]:bg-surface-2">
              <CircleCheck className="size-3.5" aria-hidden />
              {done ? "완료 해제" : "완료로 이동"}
            </DropdownMenu.Item>
            {!done && task.status !== "Waiting" && (
              <DropdownMenu.Item
                onSelect={() => {
                  setWaitingParty("");
                  setFollowUpAt("");
                  setError(null);
                  setWaitOpen(true);
                }}
                className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-text outline-none data-[highlighted]:bg-surface-2"
              >
                <Clock3 className="size-3.5" aria-hidden />
                대기로 이동
              </DropdownMenu.Item>
            )}
            <DropdownMenu.Separator className="my-1 h-px bg-separator" />
            <DropdownMenu.Item onSelect={() => void remove()} className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-flag-blocked outline-none data-[highlighted]:bg-flag-blocked/10">
              <Trash2 className="size-3.5" aria-hidden />
              삭제
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      <Dialog.Root open={waitOpen} onOpenChange={(open) => !pending && setWaitOpen(open)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[80] bg-[rgb(var(--material-scrim))] backdrop-blur-[2px] data-[state=open]:animate-fade-in" />
          <Dialog.Content
            aria-describedby={undefined}
            className="material-panel material-edge fixed left-1/2 top-1/2 z-[90] w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-[22px] border border-separator p-5 shadow-xl focus:outline-none"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <Dialog.Title className="text-base font-semibold tracking-tight text-text">
                  대기로 이동
                </Dialog.Title>
                <p className="mt-1 line-clamp-1 text-xs text-text-tertiary">{task.title}</p>
              </div>
              <Dialog.Close asChild>
                <button type="button" aria-label="닫기" className="grid size-9 place-items-center rounded-full text-text-secondary hover:bg-surface-2">
                  <X className="size-4" aria-hidden />
                </button>
              </Dialog.Close>
            </div>
            <form onSubmit={moveToWaiting} className="mt-5 flex flex-col gap-4">
              {error && <p role="alert" className="rounded-xl bg-flag-blocked/10 px-3 py-2 text-xs text-flag-blocked">{error}</p>}
              <label className="flex flex-col gap-1.5 text-xs font-semibold text-text-secondary">
                무엇을 기다리나요
                <input
                  autoFocus
                  value={waitingParty}
                  onChange={(event) => setWaitingParty(event.target.value)}
                  placeholder="예: 본사 승인 회신"
                  className="h-11 rounded-xl border border-border bg-surface px-3 text-sm font-normal text-text outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                />
              </label>
              <label className="flex flex-col gap-1.5 text-xs font-semibold text-text-secondary">
                다음 확인일
                <input
                  type="date"
                  value={followUpAt}
                  onChange={(event) => setFollowUpAt(event.target.value)}
                  className="h-11 rounded-xl border border-border bg-surface px-3 text-sm font-normal text-text outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                />
              </label>
              <div className="flex justify-end gap-2">
                <Dialog.Close asChild>
                  <button type="button" className="h-10 rounded-xl px-4 text-sm font-semibold text-text-secondary hover:bg-surface-2">취소</button>
                </Dialog.Close>
                <button type="submit" disabled={pending || !waitingParty.trim() || !followUpAt} className="inline-flex h-10 items-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-white disabled:opacity-40">
                  {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
                  이동
                </button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}

// ── hierarchy helpers (operate over a parent→children map) ──────────────────────
//
// A task's status is whatever someone set it to — the board never infers a
// different one. Rolling children up into a synthetic "effective status", or
// assigning a status a percentage so it can be averaged, invents a fact the
// data does not contain: a parent whose subtasks are all done is not itself
// done until a person says so. Counts below are literal counts.
const kids = (cm: ChildMap, id: string): Task[] => cm.get(id) ?? [];
/** [완료된 직속 하위 업무 수, 전체 직속 하위 업무 수] — 실제 개수. */
function subCount(t: Task, cm: ChildMap): [number, number] {
  const c = kids(cm, t.id);
  return [c.filter((x) => x.status === "Done").length, c.length];
}
/** number of visible subtask rows given which nodes are open */
function visibleRows(t: Task, cm: ChildMap, open: Set<string>): number {
  return kids(cm, t.id).reduce((s, c) => s + 1 + (open.has(c.id) ? visibleRows(c, cm, open) : 0), 0);
}

// ── group-by ──────────────────────────────────────────────────────────────────
const GROUP_OPTS: { id: GroupBy; label: string }[] = [
  { id: "brand", label: "브랜드" },
  { id: "project", label: "프로젝트" },
  { id: "workstream", label: "업무 영역" },
  { id: "owner", label: "담당자" },
  { id: "due", label: "마감" },
];
export type Focus = "all" | "do" | "wait" | "over";

interface Lane {
  key: string;
  name: string;
  color: string;
  avatar?: string;
  /** Present only in the fixed Brand → Project hierarchy. */
  brandKey?: string;
  objective?: string | null;
}

// ── geometry ──────────────────────────────────────────────────────────────────
const TOP = 42;
// Regular boards keep their established label gutter. The hierarchy board
// replaces it with real Brand and Project columns.
const LANEPAD = 220;
const COLW = 340;
const HIERARCHY_COLW = 240;
const COLGAP = 18;
const HIERARCHY_INSET = 24;
const BRAND_SLOT_RATIO = 0.6;
const CARD_BASE = 96; // header block: title + meta (no progress bar — see card render)
const METER_H = 34; // the "⤷ n/m subtasks" row (present when a card has children)
const SUB_PAD = 8;
const ROW_H = 28; // one inline subtask row
const ADDBTN_H = 28; // persistent "+ Add subtask" footer
const VGAP = 12;
const CHIP_H = 34;
const LANE_PAD = 12;
const LANE_GAP = 18;
const BRAND_HEAD_H = 0;
const BRAND_EMPTY_H = 100;
const BRAND_GAP = 28;
const CAP = 4;
// A key task earns its extra height from importance alone — never from how many
// subtasks it happens to carry (see cardHeight).
const KEY_EXTRA = 14;
// milestone rail
const RAIL_H = 58;
const RAIL_LABEL_W = 76; // left inset holding the "마일스톤" caption
const RAIL_GAP = 8;

export type Lod = "full" | "compact";

export interface HierarchyGeometry {
  inset: number;
  brandW: number;
  colW: number;
  brandX: number;
  projectX: number;
  stageX: number;
  boardW: number;
  worldW: number;
}

export function computeHierarchyGeometry(stageWidth: number): HierarchyGeometry {
  // Preserve the old five-column minimum as one coordinated constraint: the
  // brand remains exactly 60% of its former equal slot even while scrolling.
  const slotsW = Math.max(
    HIERARCHY_COLW * (STAGE_COUNT + 2),
    stageWidth ? stageWidth - HIERARCHY_INSET * 2 + COLGAP : 0,
  );
  const equalW = slotsW / (STAGE_COUNT + 2);
  const brandW = equalW * BRAND_SLOT_RATIO;
  const colW = (slotsW - brandW) / (STAGE_COUNT + 1);
  const boardW = slotsW - COLGAP;
  const brandX = HIERARCHY_INSET;
  const projectX = brandX + brandW;
  const stageX = projectX + colW;

  return {
    inset: HIERARCHY_INSET,
    brandW,
    colW,
    brandX,
    projectX,
    stageX,
    boardW,
    worldW: HIERARCHY_INSET + boardW + HIERARCHY_INSET,
  };
}

export function cardHeight(
  t: Task,
  cm: ChildMap,
  open: Set<string>,
  _addingId: string | null,
  lod: Lod = "full",
  showInlineSubtasks = true
): number {
  const hasKids = kids(cm, t.id).length > 0;
  let h = CARD_BASE + (isKey(t) ? KEY_EXTRA : 0);
  if (hasKids && showInlineSubtasks) {
    h += METER_H;
    // Subtree size only affects height while the user has it expanded, so a
    // card's resting size reads as importance rather than as child count.
    // Compact never renders the expanded rows (there's no toggle to collapse
    // them there), so it must not reserve height for them either.
    if (lod === "full" && open.has(t.id)) h += SUB_PAD + visibleRows(t, cm, open) * ROW_H;
  }
  h += ADDBTN_H;
  return h;
}

interface Positioned {
  task: Task;
  x: number;
  y: number;
  h: number;
}
/** One diamond on a milestone rail. */
interface Mark {
  task: Task;
  x: number;
  w: number;
}
/**
 * A chronological strip of milestone markers. Its x axis is due-date order,
 * NOT the stage grid, so it is drawn opaque: the column tints stop at its edge,
 * which is what tells you the position means something else in here.
 */
interface Rail {
  key: string;
  y: number;
  x: number;
  w: number;
  marks: Mark[];
}
interface Layout {
  lanes: (Lane & { y: number; h: number; done: number; total: number })[];
  brands: {
    key: string;
    name: string;
    color: string;
    y: number;
    h: number;
    projectCount: number;
    done: number;
    total: number;
  }[];
  columns: { i: number; x: number; count: number; label: string; token: string }[];
  nodes: Positioned[];
  rails: Rail[];
  overflow: { cellKey: string; x: number; y: number; count: number; open: boolean }[];
  /** Project sub-headers inside a brand lane's column — the middle tier of
   * 브랜드-프로젝트-업무 that a flattened brand lane would otherwise lose. */
  projectHeaders: { key: string; name: string; x: number; y: number }[];
  /** A dashed tether from a promoted (key) descendant back to its real parent. */
  edges: { d: string; laneKey: string; kind: "parent" | "dep" }[];
  worldW: number;
  worldH: number;
}

function dueBucket(due: string | null): { key: string; name: string; color: string; order: number } {
  if (!due) return { key: "_none", name: "날짜 미정", color: "rgb(var(--text-quaternary))", order: 4 };
  const diff = Math.round((+new Date(due) - +new Date(new Date().toDateString())) / 864e5);
  if (diff < 0) return { key: "over", name: "기한 초과", color: "rgb(var(--flag-overdue))", order: 0 };
  if (diff <= 1) return { key: "today", name: "오늘·내일", color: "rgb(var(--status-inprogress))", order: 1 };
  if (diff <= 7) return { key: "week", name: "이번 주", color: "rgb(var(--accent))", order: 2 };
  return { key: "later", name: "나중에", color: "rgb(var(--status-inbox))", order: 3 };
}
const EMPTY_BRANDS: Brand[] = [];
/**
 * Which band a milestone belongs to, or null for "no band on this axis".
 *
 * Grouping by 업무 영역, a milestone that has not been filed under one is a
 * project-level marker: it belongs to every band and therefore to none. Those
 * go on the board rail above all the bands rather than inventing a 미분류 band
 * that holds nothing but markers.
 */
function milestoneLaneKey(m: Task, groupBy: GroupBy, projectBrand?: Map<string, string>): string | null {
  if (groupBy === "workstream") return m.workstream_id;
  return laneKeyFor(m, groupBy, undefined, projectBrand);
}

function computeLayout(
  placed: Task[],
  roots: Task[],
  milestones: Task[],
  cm: ChildMap,
  laneOf: Map<string, string>,
  parentOf: Map<string, string>,
  workstreams: Workstream[],
  members: Record<string, Member>,
  brands: Brand[],
  projects: Project[],
  groupBy: GroupBy,
  hierarchyMode: boolean,
  hierarchyGeometry: HierarchyGeometry | null,
  cellsOpen: Set<string>,
  subsOpen: Set<string>,
  lod: Lod,
  projectBrand: Map<string, string>,
  colW: number,
  nodeW: number,
  dependencies?: Record<string, string[]>,
): Layout {
  const lanePad = hierarchyGeometry?.stageX ?? LANEPAD;
  const stageLabels = hierarchyMode ? HIERARCHY_STAGE_LABELS : STATUS_STAGE_LABELS;
  const stageTokens = hierarchyMode ? HIERARCHY_STAGE_TOKENS : STATUS_STAGE_TOKENS;
  const columnIndexOf = (task: Task) =>
    hierarchyMode ? hierarchyStageIndex(task) : statusStageIndex(task.status);
  // Lane membership is decided by the root of a task's tree, so a promoted
  // descendant always appears in the same band as the work it belongs to.
  const laneKeyOf = (t: Task): string => laneOf.get(t.id) ?? laneKeyFor(t, groupBy, undefined, projectBrand);
  // A band earns its place from milestones too — a project whose only content
  // this quarter is a deadline still has to appear.
  const msIn = (key: string) =>
    milestones.some((m) => milestoneLaneKey(m, groupBy, projectBrand) === key);

  let lanes: Lane[] = [];
  if (groupBy === "project") {
    const brandById = new Map(brands.map((b) => [b.id, b]));
    const brandOrder = new Map(brands.map((b, i) => [b.id, i]));
    lanes = projects
      .filter((p) => hierarchyMode || roots.some((t) => t.project_id === p.id) || msIn(p.id))
      .sort(
        (a, b) =>
          (brandOrder.get(a.brand_id ?? "") ?? 9999) -
            (brandOrder.get(b.brand_id ?? "") ?? 9999) ||
          a.created_at.localeCompare(b.created_at),
      )
      .map((p) => ({
        key: p.id,
        name: p.name,
        objective: p.one_line_objective,
        color: brandById.get(p.brand_id ?? "")?.color ?? "rgb(var(--accent))",
        brandKey: p.brand_id ?? "_unfiled",
      }));
    if (roots.some((t) => !t.project_id))
      lanes.push({
        key: "_inbox",
        name: "인박스",
        color: "rgb(var(--status-inbox))",
        brandKey: "_inbox",
      });
  } else if (groupBy === "workstream") {
    lanes = [...workstreams]
      .sort((a, b) => a.order - b.order)
      .filter((ws) => roots.some((t) => t.workstream_id === ws.id) || msIn(ws.id))
      // --accent is a bare RGB triplet, so it has to be wrapped; passing it raw
      // yields an invalid colour and the lane rail silently disappears.
      .map((ws) => ({ key: ws.id, name: ws.name, color: "rgb(var(--accent))" }));
    if (roots.some((t) => !t.workstream_id))
      lanes.push({ key: "_other", name: "미분류", color: "rgb(var(--text-quaternary))" });
  } else if (groupBy === "owner") {
    lanes = Object.values(members)
      .sort((a, b) => a.name.localeCompare(b.name, "ko"))
      .map((person) => ({
        key: person.id,
        name: person.name,
        color: ownerColor(person.id),
        avatar: person.name,
      }));
    if (roots.some((task) => !task.assignee_id)) {
      lanes.push({
        key: "_un",
        name: "미지정",
        color: "rgb(var(--text-quaternary))",
      });
    }
  } else {
    const seen = new Map<string, Lane & { order: number }>();
    for (const t of roots) {
      const b = dueBucket(t.due_date);
      if (!seen.has(b.key)) seen.set(b.key, { key: b.key, name: b.name, color: b.color, order: b.order });
    }
    lanes = [...seen.values()].sort((a, b) => a.order - b.order);
  }

  // Bucket every placed node into (lane × column). The hierarchy board uses
  // task depth instead of spending a column on the rarely-used Waiting state.
  const cell = new Map<string, Task[]>();
  for (const t of placed) {
    const k = `${laneKeyOf(t)}|${columnIndexOf(t)}`;
    (cell.get(k) ?? cell.set(k, []).get(k)!).push(t);
  }
  // Key work sits at the top of its cell so scanning a column top-to-bottom is
  // scanning by consequence, then by urgency.
  for (const arr of cell.values())
    arr.sort(
      (a, b) =>
        Number(isKey(b)) - Number(isKey(a)) ||
        (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"),
    );

  // Bucket the milestones. Anything whose band does not exist on this axis
  // falls through to the board-wide rail.
  const laneKeys = new Set(lanes.map((l) => l.key));
  const msByLane = new Map<string, Task[]>();
  const boardMs: Task[] = [];
  for (const m of milestones) {
    const key = milestoneLaneKey(m, groupBy, projectBrand);
    if (key && laneKeys.has(key)) {
      const arr = msByLane.get(key);
      if (arr) arr.push(m);
      else msByLane.set(key, [m]);
    } else {
      boardMs.push(m);
    }
  }

  const railX = lanePad;
  const railW = STAGE_COUNT * colW - COLGAP;
  const buildRail = (key: string, list: Task[], y: number): Rail => {
    // Position carries due-date ORDER only; the exact date is on every label,
    // so a crowded rail degrades into a readable list rather than a lie about
    // how far apart two deadlines are.
    const inner = railW - RAIL_LABEL_W - 16;
    const slot = inner / list.length;
    return {
      key,
      y,
      x: railX,
      w: railW,
      marks: list.map((t, i) => ({
        task: t,
        x: railX + RAIL_LABEL_W + slot * i,
        w: Math.max(34, slot - 10),
      })),
    };
  };

  const nodes: Positioned[] = [];
  const rails: Rail[] = [];
  const overflow: Layout["overflow"] = [];
  const projectHeaders: Layout["projectHeaders"] = [];
  const laneOut: Layout["lanes"] = [];
  const brandOut: Layout["brands"] = [];
  let y = TOP;
  if (boardMs.length) {
    rails.push(buildRail("_board", boardMs, y));
    y += RAIL_H + RAIL_GAP + LANE_GAP;
  }
  const placeLane = (lane: Lane) => {
    const laneTasks = placed.filter((t) => laneKeyOf(t) === lane.key);
    const done = laneTasks.filter((t) => t.status === "Done").length;
    const laneTop = y;
    const laneMs = msByLane.get(lane.key);
    // The band's own rail sits above its cards, inside the band, so the
    // deadlines read as belonging to that stream of work.
    const railH = laneMs ? RAIL_H + RAIL_GAP : 0;
    if (laneMs) rails.push(buildRail(lane.key, laneMs, laneTop + RAIL_GAP));
    // In hierarchy mode the project column is a full row, not a tiny caption.
    // Its objective, progress and creation control all fit without colliding
    // with the first task card.
    let laneMaxBottom = laneTop + railH + (hierarchyMode ? 166 : CARD_BASE);
    for (let s = 0; s < STAGE_COUNT; s++) {
      const arr = cell.get(`${lane.key}|${s}`) ?? [];
      const ordered = arr;
      const isOpen = cellsOpen.has(`${lane.key}|${s}`);
      const shown = isOpen ? ordered : ordered.slice(0, CAP);
      let cy = laneTop + 10 + railH;
      for (const t of shown) {
        const h = cardHeight(t, cm, subsOpen, null, lod, !hierarchyMode);
        nodes.push({ task: t, x: lanePad + s * colW, y: cy, h });
        cy += h + VGAP;
      }
      if (arr.length > CAP) {
        overflow.push({ cellKey: `${lane.key}|${s}`, x: lanePad + s * colW, y: cy, count: isOpen ? arr.length : arr.length - CAP, open: isOpen });
        cy += CHIP_H;
      }
      laneMaxBottom = Math.max(laneMaxBottom, cy);
    }
    laneOut.push({ ...lane, y: laneTop, h: laneMaxBottom - laneTop + LANE_PAD, done, total: laneTasks.length });
    y = laneMaxBottom + LANE_PAD + LANE_GAP;
  };

  if (hierarchyMode && groupBy === "project") {
    const brandById = new Map(brands.map((b) => [b.id, b]));
    const groups = brands.map((b) => ({
      key: b.id,
      name: b.name,
      color: b.color,
      lanes: lanes.filter((l) => l.brandKey === b.id),
    }));
    const unfiled = lanes.filter(
      (l) => l.brandKey === "_unfiled" || (l.brandKey && !brandById.has(l.brandKey) && l.brandKey !== "_inbox")
    );
    if (unfiled.length)
      groups.push({
        key: "_unfiled",
        name: "브랜드 미지정",
        color: "#8e8e93",
        lanes: unfiled,
      });
    const inbox = lanes.filter((l) => l.brandKey === "_inbox");
    if (inbox.length)
      groups.push({
        key: "_inbox",
        name: "분류 전 업무",
        color: "rgb(var(--status-inbox))",
        lanes: inbox,
      });

    for (const group of groups) {
      const brandTop = y;
      y += BRAND_HEAD_H;
      for (const lane of group.lanes) placeLane(lane);
      if (group.lanes.length === 0) y += BRAND_EMPTY_H;
      const groupLaneKeys = new Set(group.lanes.map((l) => l.key));
      const projectLanes = laneOut.filter((l) => groupLaneKeys.has(l.key));
      const total = projectLanes.reduce((sum, l) => sum + l.total, 0);
      const done = projectLanes.reduce((sum, l) => sum + l.done, 0);
      brandOut.push({
        key: group.key,
        name: group.name,
        color: group.color,
        y: brandTop,
        h: y - brandTop - LANE_GAP + 10,
        projectCount: group.lanes.length,
        done,
        total,
      });
      y += BRAND_GAP - LANE_GAP;
    }
  } else {
    for (const lane of lanes) placeLane(lane);
  }
  const contentBottom = y - LANE_GAP;

  const columns = stageLabels.map((label, i) => ({
    i,
    x: lanePad + i * colW,
    count: placed.filter((t) => columnIndexOf(t) === i).length,
    label,
    token: stageTokens[i],
  }));

  // Only relationships that exist in the data get a line. There is deliberately
  // no "stage flow" line: connecting the first card of each column implied that
  // one task feeds the next, which was never true — those cards had nothing to
  // do with each other. Real predecessor/successor edges come from
  // `task_dependency` and are drawn once that lands.
  const edges: Layout["edges"] = [];
  const posOf = new Map(nodes.map((n) => [n.task.id, n]));

  // a promoted node keeps a visible tether to the card it belongs under, so
  // pulling it out of its parent never costs the structural reading
  for (const n of nodes) {
    const parentId = parentOf.get(n.task.id);
    if (!parentId) continue;
    const p = posOf.get(parentId);
    if (!p) continue;
    const ax = p.x + nodeW / 2, ay = p.y + p.h;
    const bx = n.x + nodeW / 2, by = n.y;
    const my = (ay + by) / 2;
    edges.push({
      d: `M ${ax} ${ay} C ${ax} ${my}, ${bx} ${my}, ${bx} ${by}`,
      laneKey: laneKeyOf(n.task),
      kind: "parent",
    });
  }

  // Real finish-to-start edges. Drawn solid because unlike the old stage line
  // these correspond to a row someone created.
  for (const [succId, preds] of Object.entries(dependencies ?? {})) {
    const b = posOf.get(succId);
    if (!b) continue;
    for (const predId of preds) {
      const a = posOf.get(predId);
      if (!a) continue;
      const ax = a.x + nodeW, ay = a.y + 30, bx = b.x, by = b.y + 30;
      const mx = (ax + bx) / 2;
      edges.push({
        d: `M ${ax} ${ay} C ${mx} ${ay}, ${mx} ${by}, ${bx} ${by}`,
        laneKey: laneKeyOf(b.task),
        kind: "dep",
      });
    }
  }

  return {
    lanes: laneOut,
    brands: brandOut,
    columns,
    nodes,
    rails,
    overflow,
    projectHeaders,
    edges,
    worldW: hierarchyGeometry?.worldW ?? lanePad + STAGE_COUNT * colW - COLGAP + 16,
    worldH: contentBottom + 40,
  };
}

// ── component ─────────────────────────────────────────────────────────────────
export interface WorkflowCanvasProps {
  tasks: Task[];
  workstreams: Workstream[];
  members: Record<string, Member>;
  /** Top-level containers for the integrated workspace hierarchy. */
  brands?: Brand[];
  /** Needed to name project lanes. Pass on workspace-wide boards. */
  projects?: Project[];
  /** Lane axis to open on. Home groups by project, a project by workstream. */
  defaultGroupBy?: GroupBy;
  /** Locks Home to Brand → Project → Task instead of offering competing pivots. */
  hierarchyMode?: boolean;
  onSelect: (task: Task) => void;
  /** Opens project creation anchored to a brand section. */
  onAddProject?: (brandId: string) => void;
  /** Opens detailed task creation anchored to a project row. */
  onAddProjectTask?: (projectId: string) => void;
  /** Opens detailed task creation anchored beneath a parent task. */
  onAddSubtask?: (parent: Task) => void;
  /** Opens detailed task creation in this project. Omit to hide the affordance. */
  onAddTask?: () => void;
  /** Controls the focus filter from outside (e.g. the project summary strip). */
  focus?: Focus;
  onFocusChange?: (focus: Focus) => void;
  /** Optional first row in the unified workspace toolbar. */
  toolbarHeader?: ReactNode;
  /** Creates a milestone in the given project. Omit to hide the rail's +. */
  onAddMilestone?: (projectId: string, name: string, dueDate: string) => Promise<boolean>;
  /** Project every rail belongs to, when the board shows exactly one. */
  projectId?: string;
  /** Opens the project edit dialog. Omit to fall back to a plain label. */
  onEditProject?: (project: Project) => void;
  /** Successor task id → predecessor task ids. */
  dependencies?: Record<string, string[]>;
}

export default function WorkflowCanvas({
  tasks,
  workstreams,
  members,
  brands = EMPTY_BRANDS,
  projects,
  defaultGroupBy = "workstream",
  hierarchyMode = false,
  onSelect,
  onAddProject,
  onAddProjectTask,
  onAddSubtask,
  onAddTask,
  focus: focusProp,
  onFocusChange,
  toolbarHeader,
  onAddMilestone,
  projectId,
  onEditProject,
  dependencies,
}: WorkflowCanvasProps) {
  const [groupBy, setGroupBy] = useState<GroupBy>(defaultGroupBy);
  const [focusState, setFocusState] = useState<Focus>("all");
  const focus = focusProp ?? focusState;
  const setFocus = (next: Focus) => {
    setFocusState(next);
    onFocusChange?.(next);
  };
  const [cellsOpen, setCellsOpen] = useState<Set<string>>(new Set());
  const [subsOpen, setSubsOpen] = useState<Set<string>>(new Set());
  const [stageWidth, setStageWidth] = useState(0);
  const [, startTransition] = useTransition();
  const router = useRouter();

  const stageRef = useRef<HTMLDivElement>(null);
  const hierarchyView = hierarchyMode && groupBy === "brand";
  const effectiveGroupBy: GroupBy = hierarchyView ? "project" : groupBy;
  const hierarchyGeometry = useMemo(
    () => hierarchyView ? computeHierarchyGeometry(stageWidth) : null,
    [hierarchyView, stageWidth],
  );
  const colW = hierarchyGeometry?.colW ?? Math.max(
    COLW,
    stageWidth ? (stageWidth + COLGAP - 32) / STAGE_COUNT : COLW,
  );
  const lanePad = hierarchyGeometry?.stageX ?? LANEPAD;
  const nodeW = colW - COLGAP - 6;
  const boardW = hierarchyGeometry?.boardW ?? lanePad + STAGE_COUNT * colW - COLGAP;

  // project_id → brand id, used by the optional Brand axis.
  const projectBrand = useMemo(
    () => new Map((projects ?? []).map((p) => [p.id, p.brand_id ?? "_unfiled"])),
    [projects],
  );

  // Which nodes get a card, and how a promoted one points back at its parent.
  const { childMap, roots, placed, laneOf, parentOf, milestones } = useMemo(
    () => buildBoardGraph(tasks, effectiveGroupBy, undefined, projectBrand),
    [tasks, effectiveGroupBy, projectBrand],
  );
  const canvasPlaced = useMemo(
    () =>
      hierarchyView
        ? tasks.filter((task) => !task.cancelled_at && task.kind !== "milestone")
        : placed,
    [hierarchyView, tasks, placed]
  );
  const canvasParentOf = useMemo(
    () =>
      hierarchyView
        ? new Map(
            canvasPlaced.flatMap((task) =>
              task.parent_task_id ? [[task.id, task.parent_task_id] as const] : []
            )
          )
        : parentOf,
    [hierarchyView, canvasPlaced, parentOf]
  );

  // Level of detail. Below 70% the small type is unreadable anyway, so it is
  // dropped rather than rendered as noise — title, status and the key badge are
  // what survive, plus the rails, which is the structure you zoom out to see.
  // Computed ahead of layout so card geometry (not just what's drawn on top of
  // it) can shrink to match — see cardHeight's lod parameter.
  const lod = "full" as Lod;

  const layout = useMemo(
    () => computeLayout(canvasPlaced, roots, milestones, childMap, laneOf, canvasParentOf, workstreams, members, brands, projects ?? [], effectiveGroupBy, hierarchyView, hierarchyGeometry, cellsOpen, subsOpen, lod, projectBrand, colW, nodeW, dependencies),
    [canvasPlaced, roots, milestones, childMap, laneOf, canvasParentOf, workstreams, members, brands, projects, effectiveGroupBy, hierarchyView, hierarchyGeometry, cellsOpen, subsOpen, lod, projectBrand, colW, nodeW, dependencies],
  );

  // A task is blocked while any predecessor is unfinished. Derived, not stored.
  const blockedBy = useMemo(() => {
    const byId = new Map(tasks.map((t) => [t.id, t]));
    const out = new Set<string>();
    for (const [succId, preds] of Object.entries(dependencies ?? {})) {
      if (preds.some((p) => byId.get(p)?.status !== "Done")) out.add(succId);
    }
    return out;
  }, [tasks, dependencies]);

  const laneKeyOf = (t: Task) => laneOf.get(t.id) ?? laneKeyFor(t, effectiveGroupBy);
  const matchesFocus = (t: Task) => {
    return focus === "all"
      ? true
      : focus === "do"
        ? displayGroup(t.status) === "InProgress"
        : focus === "wait"
          ? t.status === "Waiting"
          : overdue(t);
  };

  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const measure = () => setStageWidth(Math.round(stage.clientWidth));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  const toggleSet = (setter: typeof setSubsOpen) => (k: string) =>
    setter((prev) => {
      const n = new Set(prev);
      n.has(k) ? n.delete(k) : n.add(k);
      return n;
    });
  const toggleCell = toggleSet(setCellsOpen);
  const toggleSub = toggleSet(setSubsOpen);

  // flatten a task's open subtree into rows for inline rendering
  function subRows(t: Task, depth: number): { task: Task; depth: number; hasKids: boolean; open: boolean }[] {
    const out: { task: Task; depth: number; hasKids: boolean; open: boolean }[] = [];
    for (const c of kids(childMap, t.id)) {
      const hasKids = kids(childMap, c.id).length > 0;
      const open = subsOpen.has(c.id);
      out.push({ task: c, depth, hasKids, open });
      if (open) out.push(...subRows(c, depth + 1));
    }
    return out;
  }

  return (
    <div className="relative left-1/2 -ml-[50vw] w-screen">
      {/* One workspace header: summary/actions first, board controls second.
          Shared edges and alignment make the controls read as one system. */}
      <div className="border-y border-separator/70 bg-surface/[0.38]">
        <div className="mx-auto max-w-[1400px] px-4 py-3 sm:px-6" data-ui>
          {toolbarHeader}
          <div className={cn("flex flex-wrap items-center gap-3", toolbarHeader && "mt-3 border-t border-separator/60 pt-3")}>
            <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">기준</span>
              <div className="flex gap-0.5 rounded-xl bg-surface-2/80 p-0.5">
            {GROUP_OPTS.filter((option) =>
              hierarchyMode
                ? option.id !== "project" && (option.id !== "brand" || Boolean(projects))
                : option.id !== "brand" && (option.id !== "project" || Boolean(projects))
            ).map((o) => (
              <button key={o.id} type="button" aria-pressed={groupBy === o.id}
                onClick={() => { setGroupBy(o.id); setCellsOpen(new Set()); }}
                    className={cn("rounded-[10px] px-3 py-1.5 text-xs font-semibold transition-[transform,background-color,color,box-shadow] active:scale-[0.97]", groupBy === o.id ? "bg-surface text-text shadow-xs" : "text-text-secondary hover:text-text")}>
                {o.label}
              </button>
            ))}
              </div>
          </div>
            {hierarchyView && (
              <div className="flex items-center gap-1 text-[11px] font-semibold text-text-tertiary" aria-label="업무 구조">
                브랜드
                <ChevronRight className="size-3" aria-hidden />
                프로젝트
                <ChevronRight className="size-3" aria-hidden />
                업무
                <ChevronRight className="size-3" aria-hidden />
                하위업무
              </div>
            )}
            {onAddTask && (
              <button
                type="button"
                onClick={onAddTask}
                className="material-thin inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold text-text-secondary shadow-xs transition-[transform,color,box-shadow] hover:text-text hover:shadow-sm active:scale-[0.97]"
              >
                <Plus className="size-3.5" aria-hidden />
                업무 추가
              </button>
            )}

            <div className="ml-auto flex flex-wrap gap-1.5">
          {([["all", "전체", ""], ["do", "지금 할 일", "bg-status-inprogress"], ["wait", "대기", "bg-status-waiting"], ["over", "기한 초과", "bg-flag-overdue"]] as [Focus, string, string][]).map(([f, label, dot]) => (
            <button key={f} type="button" aria-pressed={focus === f} onClick={() => setFocus(f)}
                  className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-[transform,background-color,color,border-color] active:scale-[0.97]", focus === f ? "border-text bg-text text-bg" : "border-border bg-surface/80 text-text-secondary hover:border-border-strong hover:text-text")}>
              {dot && <span className={cn("size-1.5 rounded-full", focus === f ? "bg-bg" : dot)} />}
              {label}
            </button>
          ))}
            </div>
          </div>
        </div>
      </div>

      {/* viewport */}
      <div
        ref={stageRef}
        className="material-panel material-edge relative w-full select-none overflow-x-auto overflow-y-hidden border-b border-separator"
        style={{
          height: Math.max(440, layout.worldH),
          backgroundImage: "radial-gradient(rgb(var(--text-quaternary)/0.22) 1px, transparent 1.4px), linear-gradient(rgb(var(--surface-2)/0.16), rgb(var(--surface)/0.08))",
          backgroundSize: "24px 24px, 100% 100%",
        }}
      >
        <div className="absolute left-0 top-0" style={{ width: layout.worldW, height: layout.worldH }}>
          <div
            className="pointer-events-none absolute top-0 rounded-b-2xl border-b border-separator/60 bg-surface/[0.22] backdrop-blur-sm"
            style={{ left: hierarchyGeometry?.inset ?? 0, width: boardW, height: TOP - 6 }}
          />
          {hierarchyView && hierarchyGeometry && (
            <>
              {[
                { label: "브랜드", x: hierarchyGeometry.brandX, width: hierarchyGeometry.brandW },
                { label: "프로젝트", x: hierarchyGeometry.projectX, width: hierarchyGeometry.colW },
              ].map((column) => (
                <div key={column.label}>
                  <div
                    className="pointer-events-none absolute rounded-2xl border border-white/20 bg-surface/[0.18] backdrop-blur-[2px]"
                    style={{
                      left: column.x,
                      top: TOP,
                      width: column.width - COLGAP,
                      height: layout.worldH - TOP - 8,
                    }}
                  />
                  <div
                    className="absolute inline-flex h-7 w-max items-center rounded-full bg-surface-2 px-3 text-xs font-semibold text-text-secondary"
                    style={{ left: column.x, top: TOP - 40 }}
                  >
                    {column.label}
                  </div>
                </div>
              ))}
            </>
          )}
          {/* Brand containers sit behind their project rows. The dedicated
              column keeps the hierarchy visible without reserving a header row. */}
          {layout.brands.map((brand) => (
            <div key={`brand-${brand.key}`}>
              <div
                className="pointer-events-none absolute overflow-hidden rounded-xl border border-separator/80 bg-surface/30 shadow-xs backdrop-blur-sm"
                style={{
                  top: brand.y,
                  left: hierarchyGeometry?.brandX ?? 10,
                  width: boardW,
                  height: brand.h,
                }}
              >
                <div className="absolute inset-y-0 -left-px w-2" style={{ background: brand.color }} />
              </div>
              <div
                className="material-panel material-edge absolute z-20 flex min-w-0 flex-col gap-1 rounded-lg border border-separator p-2.5 shadow-sm"
                style={{
                  top: brand.y + 10,
                  left: (hierarchyGeometry?.brandX ?? 0) + 16,
                  width: (hierarchyGeometry?.brandW ?? colW) - 24,
                }}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span className="size-3 shrink-0 rounded-[4px]" style={{ background: brand.color }} aria-hidden />
                  <div className="truncate text-[15px] font-semibold leading-5 tracking-tight text-text">
                    {brand.name}
                  </div>
                </div>
                <div className="truncate text-[10px] font-medium leading-3.5 tabular-nums text-text-tertiary">
                  프로젝트 {brand.projectCount} · 업무 {brand.total} · 완료 {brand.done}
                </div>
                {onAddProject && !brand.key.startsWith("_") && (
                  <div className="group/project-add relative mt-0.5 w-max">
                    <button
                      type="button"
                      data-ui
                      onClick={() => onAddProject(brand.key)}
                      aria-describedby={`project-add-help-${brand.key}`}
                      className="inline-flex h-6 items-center gap-1.5 rounded-lg px-2 text-[10px] font-semibold text-text-secondary transition-[transform,background-color,color] hover:bg-surface-2 hover:text-text active:scale-[0.97]"
                    >
                      <FolderPlus className="size-3" aria-hidden />
                      프로젝트 추가
                    </button>
                    <span
                      id={`project-add-help-${brand.key}`}
                      role="tooltip"
                      className="pointer-events-none absolute left-0 top-full z-40 mt-2 w-56 translate-y-1 origin-top-left rounded-xl border border-separator bg-elevated/95 px-3 py-2 text-[11px] font-medium leading-relaxed text-text-secondary opacity-0 shadow-lg backdrop-blur-xl transition-[opacity,transform] group-hover/project-add:translate-y-0 group-hover/project-add:opacity-100 group-focus-within/project-add:translate-y-0 group-focus-within/project-add:opacity-100"
                    >
                      프로젝트를 추가하면 이 아래에 업무 흐름이 만들어집니다.
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* columns */}
          {layout.columns.map((c) => (
            <div key={c.i} className="pointer-events-none absolute top-0" style={{ left: c.x, top: TOP - 40 }}>
              <div className="absolute rounded-2xl border border-white/20 backdrop-blur-[2px]" style={{ top: 40, width: colW - COLGAP, height: layout.worldH - TOP - 8, background: `color-mix(in srgb, rgb(var(--${c.token})) 5%, rgb(var(--material-thin)))` }} />
              {/* nowrap: the wrapper is a zero-width absolute box, so without it
                  the label collapses to one character per line. */}
              <div className="absolute inline-flex h-7 w-max items-center gap-2 whitespace-nowrap rounded-full px-3 text-xs font-semibold"
                style={{ color: `rgb(var(--${c.token}))`, background: `color-mix(in srgb, rgb(var(--${c.token})) 13%, rgb(var(--surface)))` }}>
                <span className="size-2 rounded-full" style={{ background: `rgb(var(--${c.token}))` }} />
                {c.label}<span className="font-mono tabular-nums text-text-tertiary">{c.count}</span>
              </div>
            </div>
          ))}

          {/* lanes — drawn as enclosed bands so a workstream reads as a
              container the cards live inside, not just a row they sit near. */}
          {layout.lanes.map((l) => (
            <div key={l.key}>
              <div
                className="pointer-events-none absolute rounded-2xl border border-separator/70 bg-surface/[0.32] backdrop-blur-[2px]"
                style={{
                  top: l.y,
                  left: hierarchyGeometry?.projectX ?? 0,
                  width: boardW - (hierarchyGeometry?.brandW ?? 0),
                  height: l.h,
                }}
              />
              {/* the band's colour rail — the only place the lane colour lives,
                  so it never competes with the status colours on the cards */}
              {!hierarchyView && (
                <div
                  className="pointer-events-none absolute rounded-full"
                  style={{ top: l.y + 10, left: 0, width: 3, height: Math.max(18, l.h - 20), background: l.color }}
                />
              )}
              <div className="material-panel material-edge absolute z-10 flex flex-col gap-1.5 rounded-[16px] border border-separator p-3 shadow-sm" style={{ top: l.y + 10, left: hierarchyGeometry ? hierarchyGeometry.projectX + 12 : 10, width: hierarchyView ? colW - 24 : LANEPAD - 28 }}>
                {hierarchyView && (
                  <div className="text-[9px] font-semibold uppercase tracking-wider text-text-tertiary">
                    프로젝트
                  </div>
                )}
                <div className="flex items-center gap-2 text-[13px] font-semibold text-text">
                  {l.avatar ? <span className="grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[8px] font-bold tracking-tight text-white" style={{ background: l.color }}>{l.avatar}</span> : <span className="size-2.5 rounded" style={{ background: l.color }} />}
                  {/* The band label opens the project's own edit/archive
                      dialog now, not a page — same lightweight window a task
                      opens. */}
                  {hierarchyView && !l.key.startsWith("_") && onEditProject ? (
                    <button
                      type="button"
                      data-ui
                      onClick={() => {
                        const p = projects?.find((pr) => pr.id === l.key);
                        if (p) onEditProject(p);
                      }}
                      className="truncate text-left hover:text-accent hover:underline"
                    >
                      {l.name}
                    </button>
                  ) : (
                    <span className="truncate">{l.name}</span>
                  )}
                </div>
                {hierarchyView && l.objective && (
                  <div className="line-clamp-2 text-[10px] leading-relaxed text-text-tertiary">
                    {l.objective}
                  </div>
                )}
                <div className="text-[10.5px] font-medium tabular-nums text-text-tertiary">완료 {l.done}/{l.total}</div>
                <div className="h-1.5 overflow-hidden rounded-full bg-surface-3"><div className="h-full rounded-full bg-status-done transition-[width] duration-500 ease-out" style={{ width: `${l.total ? (l.done / l.total) * 100 : 0}%` }} /></div>
                {hierarchyView && onAddProjectTask && !l.key.startsWith("_") && (
                  <button
                    type="button"
                    data-ui
                    onClick={() => onAddProjectTask(l.key)}
                    className="mt-0.5 inline-flex min-h-8 items-center gap-1.5 self-start rounded-lg px-2 text-[10.5px] font-semibold text-text-secondary transition-[transform,background-color,color] hover:bg-surface-2 hover:text-text active:scale-[0.97]"
                  >
                    <Plus className="size-3" aria-hidden />
                    업무 추가
                  </button>
                )}
              </div>
            </div>
          ))}

          {/* milestone rails — diamonds, never rectangles. Shape is what says
              "this is a date the project turns on", not a piece of work, and it
              has to be unmistakable at any zoom. */}
          {layout.rails.map((rail) => (
            <div key={`rail-${rail.key}`}>
              {/* Opaque on purpose: the stage-column tints stop at the rail's
                  edge, which is the cue that x means due-date order in here and
                  not the stage grid. */}
              <div className="absolute rounded-xl border border-separator bg-surface shadow-xs"
                style={{ left: rail.x, top: rail.y, width: rail.w, height: RAIL_H }} />
              <div className="absolute inline-flex items-center gap-1.5 whitespace-nowrap text-[10px] font-semibold uppercase tracking-wider text-text-tertiary"
                style={{ left: rail.x + 12, top: rail.y + 9 }}>
                <span className="size-2 rotate-45 border border-text-tertiary" aria-hidden />
                마일스톤
              </div>
              <div className="absolute bg-separator"
                style={{ left: rail.x + RAIL_LABEL_W, top: rail.y + 13, width: rail.w - RAIL_LABEL_W - 16, height: 1 }} />
              {onAddMilestone && (projectId || rail.key.startsWith("proj")) && (
                <button
                  type="button"
                  data-ui
                  onClick={() => {
                    const name = window.prompt("마일스톤 이름");
                    if (!name?.trim()) return;
                    const due = window.prompt("마감일 (YYYY-MM-DD)");
                    if (!due?.trim()) return;
                    startTransition(async () => {
                      const ok = await onAddMilestone(projectId ?? rail.key, name, due);
                      if (ok) router.refresh();
                    });
                  }}
                  className="absolute grid size-5 place-items-center rounded-md border border-separator bg-surface text-text-tertiary hover:text-accent"
                  style={{ left: rail.x + rail.w - 26, top: rail.y + 6 }}
                  aria-label="마일스톤 추가"
                >
                  <Plus className="size-3" />
                </button>
              )}
              {rail.marks.map((mk) => {
                const met = mk.task.status === "Done";
                const late = overdue(mk.task);
                // Colour still means status and nothing else; the diamond's fill
                // means met/unmet.
                const tone = met
                  ? "rgb(var(--status-done))"
                  : late
                    ? "rgb(var(--flag-overdue))"
                    : "rgb(var(--text-secondary))";
                return (
                  <button key={mk.task.id} type="button" data-card onClick={() => onSelect(mk.task)}
                    className="absolute flex flex-col items-start gap-0.5 rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    style={{ left: mk.x, top: rail.y + 8, width: mk.w }}>
                    <span className="size-[11px] shrink-0 rotate-45 rounded-[2px] border-2"
                      style={{ borderColor: tone, background: met ? tone : "rgb(var(--surface))" }} aria-hidden />
                    <span className={cn("w-full truncate text-[10.5px] font-semibold text-text", met && "text-text-secondary line-through")}>{mk.task.title}</span>
                    <span className="w-full truncate text-[9.5px] font-medium tabular-nums" style={{ color: tone }}>
                      {mk.task.due_date ? fmtDue(mk.task.due_date) : "날짜 미정"}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}

          {/* edges — dashed tethers from a promoted (key) descendant back to
              its real parent. No other line implies a workflow relationship. */}
          <svg className="pointer-events-none absolute left-0 top-0 overflow-visible" width={layout.worldW} height={layout.worldH}>
            {layout.edges.map((e, i) => (
              <path
                key={i}
                d={e.d}
                fill="none"
                strokeLinecap="round"
                strokeWidth={1.5}
                strokeDasharray="3 4"
                stroke="rgb(var(--text-quaternary)/0.5)"
                className="transition-[stroke,stroke-width] duration-200"
              />
            ))}
          </svg>

          {/* cards */}
          {layout.nodes.map(({ task, x, y, h }) => {
            // Card color/label reflect the 3-status group, not the 6 stored
            // values — a Review or ToDo task must read as "진행 중" everywhere,
            // not just in which column it lands in.
            const meta = statusMeta(displayGroup(task.status));
            const over = overdue(task);
            const dim = !matchesFocus(task);
            const assignee = task.assignee_id ? members[task.assignee_id] : undefined;
            const [sd, sn] = subCount(task, childMap);
            const hasKids = sn > 0;
            const open = subsOpen.has(task.id);
            const key_ = isKey(task);
            const parentId = canvasParentOf.get(task.id);
            const parentTitle = parentId ? tasks.find((x) => x.id === parentId)?.title : undefined;
            // Compact has no toggle to collapse an already-expanded subtree
            // (the meter button below is itself lod-gated), so it must not
            // render the rows in the first place — matches cardHeight's guard.
            const rows = !hierarchyView && hasKids && open && lod === "full" ? subRows(task, 0) : [];
            return (
              <div key={task.id} data-card
                className={cn("group absolute flex flex-col overflow-hidden rounded-[14px] bg-surface transition-[opacity,box-shadow] duration-200",
                  // Importance is carried by weight and elevation only — never by
                  // colour, which belongs exclusively to status.
                  key_ ? "border-2 border-text/25 shadow-md" : "border shadow-sm",
                  !key_ && (task.status === "Waiting" && !hasKids ? "border-dashed border-status-waiting/50" : "border-separator"),
                  dim && "opacity-30 saturate-50")}
                style={{ left: x, top: y, width: nodeW, height: h }}>
                <div className={cn("shrink-0", meta.dot, key_ ? "h-1.5" : "h-1")} />
                <div className="absolute left-2 top-3 z-20">
                  <TaskCompleteButton task={task} onChanged={() => router.refresh()} />
                </div>
                <div className="absolute right-2 top-3 z-30">
                  <TaskActionMenu
                    task={task}
                    onEdit={() => onSelect(task)}
                    onChanged={() => router.refresh()}
                  />
                </div>
                <div className="flex flex-1 flex-col gap-2 overflow-hidden p-3">
                  {/* clickable header opens the detail panel */}
                  <button type="button" onClick={() => onSelect(task)}
                    className="rounded pl-7 pr-7 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg">
                    {over && <span className="absolute right-11 top-3 size-2.5 rounded-full border-2 border-surface bg-flag-overdue" />}
                    <div className="mb-1.5 flex flex-wrap items-center gap-1">
                      {key_ && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-text/20 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-text-secondary">
                          핵심
                        </span>
                      )}
                      {/* Pulled out of a parent card — say what it sits under,
                          or the hierarchy is lost the moment it moves. */}
                      {parentTitle && (
                        <span className="inline-flex min-w-0 items-center gap-0.5 text-[9.5px] font-medium text-text-tertiary">
                          <CornerDownRight className="size-2.5 shrink-0" aria-hidden />
                          <span className="truncate">{parentTitle}</span>
                        </span>
                      )}
                    </div>
                    <div className={cn("mb-2 line-clamp-2 leading-snug", key_ ? "text-[14.5px] font-semibold" : "text-[13px] font-medium", task.status === "Done" && "text-text-secondary")}>{task.title}</div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10.5px] font-semibold", meta.fill, meta.text)}>
                        <span className={cn("size-1.5 rounded-full", meta.dot)} />{task.status === "Waiting" && !hasKids ? "대기 중" : meta.label}
                      </span>
                      {lod === "full" && task.due_date && <span className={cn("inline-flex items-center gap-1 text-[10.5px] tabular-nums", over ? "font-semibold text-flag-overdue" : "text-text-tertiary")}>{over ? "⚠" : "📅"} {fmtDue(task.due_date)}</span>}
                      <span className={cn("inline-flex items-center text-[11px] font-medium text-text-secondary", lod === "compact" && "hidden")}>
                        {assignee ? <span className="grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[9px] font-bold tracking-tight text-white" style={{ background: ownerColor(assignee.id) }}>{assignee.name}</span> : "미지정"}
                      </span>
                      {/* The two facts that make a Waiting task actionable. */}
                      {lod === "full" && task.status === "Waiting" && task.waiting_party_text && (
                        <span className="w-full truncate text-[10px] text-text-tertiary">
                          {task.waiting_party_text}
                          {task.follow_up_at && ` · ${fmtDue(task.follow_up_at)} 확인`}
                        </span>
                      )}
                    </div>
                    {/* No progress bar. A leaf task has no measurable percentage
                        — it is in a status, and the status pill above already
                        says which. Cards with subtasks show a real n/m count in
                        the meter below instead. */}
                  </button>

                  {/* subtask meter — the inline-expand toggle */}
                  {!hierarchyView && hasKids && lod === "full" && (
                    <button type="button" data-ui onClick={() => toggleSub(task.id)}
                      className="flex shrink-0 items-center gap-2 rounded-lg bg-surface-2 px-2.5 py-1.5 transition-colors hover:bg-surface-3">
                      <span className="whitespace-nowrap text-[10.5px] font-semibold tabular-nums text-text-secondary">⤷ 세부 업무 {sd}/{sn}</span>
                      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3"><span className={cn("block h-full rounded-full", meta.dot)} style={{ width: `${sn ? (sd / sn) * 100 : 0}%` }} /></span>
                      <ChevronRight className={cn("size-3.5 text-text-tertiary transition-transform", open && "rotate-90")} />
                    </button>
                  )}

                  {/* inline subtask rows (arbitrary depth) */}
                  {rows.length > 0 && (
                    <div className="flex flex-col overflow-hidden border-t border-separator pt-1">
                      {rows.map(({ task: c, depth, hasKids: ck, open: co }) => {
                        const [cd, cn2] = subCount(c, childMap);
                        const cav = c.assignee_id ? members[c.assignee_id] : undefined;
                        return (
                          <div key={c.id} className="flex items-center gap-2 rounded-md py-1 pr-1 hover:bg-surface-2" style={{ height: ROW_H, paddingLeft: 6 + depth * 14 }}>
                            {ck ? (
                              <button type="button" data-ui aria-label="세부 업무 펼치기" onClick={() => toggleSub(c.id)} className="grid size-4 shrink-0 place-items-center rounded text-text-tertiary hover:bg-surface-3">
                                <ChevronRight className={cn("size-3 transition-transform", co && "rotate-90")} />
                              </button>
                            ) : <span className="size-4 shrink-0" />}
                            <TaskCompleteButton task={c} compact onChanged={() => router.refresh()} />
                            <button type="button" onClick={() => onSelect(c)} className={cn("flex-1 truncate text-left text-[12px] font-medium hover:underline", isKey(c) && "font-semibold", c.status === "Done" && "text-text-tertiary line-through")}>{c.title}</button>
                            {/* still counted here, but it also has its own card */}
                            {isKey(c) && <ArrowUpRight className="size-3 shrink-0 text-text-tertiary" aria-label="핵심 업무 — 보드에 별도 카드로 표시됨" />}
                            {ck && <span className="shrink-0 font-mono text-[9.5px] tabular-nums text-text-tertiary">{cd}/{cn2}</span>}
                            {cav && <span className="grid h-4 min-w-4 shrink-0 place-items-center rounded-full px-1 text-[7px] font-bold tracking-tight text-white" style={{ background: ownerColor(cav.id) }}>{cav.name}</span>}
                            <TaskActionMenu task={c} compact onEdit={() => onSelect(c)} onChanged={() => router.refresh()} />
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* footer: detailed subtask creation uses the same dialog as a
                      main task, with this task fixed as its parent. */}
                  {onAddSubtask && task.project_id && (
                    <button type="button" data-ui onClick={() => onAddSubtask(task)}
                      className="mt-auto flex items-center gap-1 self-start rounded-md px-1.5 py-1 text-[11px] font-medium text-text-tertiary opacity-0 transition-opacity hover:text-accent group-hover:opacity-100 focus-visible:opacity-100"
                      style={{ height: ADDBTN_H - 8 }}>
                      <Plus className="size-3.5" /> 세부 업무 추가
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {/* project sub-headers — the middle tier of 브랜드-프로젝트-업무,
              shown only in brand groupBy since that's the one axis that
              otherwise flattens every project's tasks into one lane. */}
          {layout.projectHeaders.map((h) => (
            <div key={h.key} className="absolute flex items-center gap-1 truncate text-[10.5px] font-semibold uppercase tracking-wide text-text-tertiary"
              style={{ left: h.x, top: h.y, width: nodeW }}>
              <span className="size-1 shrink-0 rounded-full bg-text-tertiary" />
              {h.name}
            </div>
          ))}

          {/* "+N more" expanders */}
          {layout.overflow.map((o) => (
            <button key={o.cellKey} type="button" data-ui onClick={() => toggleCell(o.cellKey)}
              className="absolute inline-flex items-center justify-center rounded-lg border border-separator bg-surface px-3 text-xs font-medium text-text-secondary shadow-xs transition-colors hover:bg-surface-2 active:scale-[0.98]"
              style={{ left: o.x, top: o.y, width: nodeW, height: CHIP_H - 6 }}>
              {o.open ? "간략히" : `+${o.count}개 더보기`}
            </button>
          ))}
        </div>

      </div>
    </div>
  );
}
