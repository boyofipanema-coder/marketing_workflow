"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus, Maximize2, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { statusMeta, type TaskStatus } from "@/lib/status";
import { createSubtaskAction } from "@/app/actions/tasks";
import InlineAdd from "@/components/tasks/InlineAdd";
import type { Task, Workstream, Member } from "@/server/db/schema";

/**
 * WorkflowCanvas — a pannable/zoomable swimlane Kanban.
 *
 * Rows = a group-by dimension (Workstream / Owner / Due), columns = the status
 * stage flow (To Do → In Progress → Review → Done). Only TOP-LEVEL tasks
 * (parent_task_id === null) are placed on the board; a task's subtasks expand
 * INLINE inside its card (arbitrary depth) and roll their progress up into the
 * parent. Dense cells cap at CAP cards with a "+N more" expander (decision B).
 *
 * Two orthogonal axes, kept strictly separate: hierarchy expands *down* (inside
 * a card), grouping pivots *sideways* (the lane axis). Card heights are computed
 * analytically from the visible subtree so positioning never overlaps.
 */

// ── stage flow ────────────────────────────────────────────────────────────────
// Waiting is its own column rather than being folded into "in progress": the
// board's main job on entry is to show what is moving and what is stuck, and a
// blocked task hidden inside the in-progress column reads as healthy work.
const STAGE_LABELS = ["예정", "진행 중", "대기", "검토 중", "완료"] as const;
const STAGE_TOKENS = [
  "status-todo",
  "status-inprogress",
  "status-waiting",
  "status-review",
  "status-done",
] as const;
const STAGE_COUNT = STAGE_LABELS.length;

function stageIndex(s: TaskStatus): number {
  switch (s) {
    case "InProgress":
      return 1;
    case "Waiting":
      return 2;
    case "Review":
      return 3;
    case "Done":
      return 4;
    default:
      return 0;
  }
}
function baseProgress(s: TaskStatus): number {
  return { Inbox: 0, ToDo: 0.06, InProgress: 0.55, Waiting: 0.5, Review: 0.85, Done: 1 }[s];
}
const todayStr = () => new Date().toISOString().slice(0, 10);
function overdue(t: Task, eff: TaskStatus): boolean {
  return !!t.due_date && eff !== "Done" && !t.cancelled_at && t.due_date < todayStr();
}
function initials(name?: string): string {
  return (name ?? "").split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
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

// ── hierarchy helpers (operate over a parent→children map) ──────────────────────
type ChildMap = Map<string, Task[]>;
const kids = (cm: ChildMap, id: string): Task[] => cm.get(id) ?? [];
function rollupProgress(t: Task, cm: ChildMap): number {
  const c = kids(cm, t.id);
  return c.length ? c.reduce((s, x) => s + rollupProgress(x, cm), 0) / c.length : baseProgress(t.status);
}
function effStatus(t: Task, cm: ChildMap): TaskStatus {
  const c = kids(cm, t.id);
  if (!c.length) return t.status;
  const p = rollupProgress(t, cm);
  if (p >= 1) return "Done";
  if (p <= 0.06) return "ToDo";
  if (p >= 0.85) return "Review";
  return "InProgress";
}
function subCount(t: Task, cm: ChildMap): [number, number] {
  const c = kids(cm, t.id);
  return [c.filter((x) => effStatus(x, cm) === "Done").length, c.length];
}
/** number of visible subtask rows given which nodes are open */
function visibleRows(t: Task, cm: ChildMap, open: Set<string>): number {
  return kids(cm, t.id).reduce((s, c) => s + 1 + (open.has(c.id) ? visibleRows(c, cm, open) : 0), 0);
}

// ── group-by ──────────────────────────────────────────────────────────────────
type GroupBy = "workstream" | "owner" | "due";
const GROUP_OPTS: { id: GroupBy; label: string }[] = [
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
}

// ── geometry ──────────────────────────────────────────────────────────────────
const TOP = 50;
const LANEPAD = 190;
const COLW = 252;
const COLGAP = 18;
const NODEW = COLW - COLGAP - 6;
const CARD_BASE = 108; // header block: title + meta + progress
const METER_H = 34; // the "⤷ n/m subtasks" row (present when a card has children)
const SUB_PAD = 8;
const ROW_H = 28; // one inline subtask row
const ADDBTN_H = 28; // persistent "+ Add subtask" footer
const VGAP = 12;
const CHIP_H = 34;
const LANE_PAD = 12;
const LANE_GAP = 18;
const CAP = 4;
const ADD_H = 42; // inline "add subtask" input row

function cardHeight(t: Task, cm: ChildMap, open: Set<string>, addingId: string | null): number {
  const hasKids = kids(cm, t.id).length > 0;
  let h = CARD_BASE;
  if (hasKids) {
    h += METER_H;
    if (open.has(t.id)) h += SUB_PAD + visibleRows(t, cm, open) * ROW_H;
  }
  h += addingId === t.id ? ADD_H : ADDBTN_H; // input while composing, else the add footer
  return h;
}

interface Positioned {
  task: Task;
  x: number;
  y: number;
  h: number;
}
interface Layout {
  lanes: (Lane & { y: number; done: number; total: number })[];
  columns: { i: number; x: number; count: number }[];
  nodes: Positioned[];
  overflow: { cellKey: string; x: number; y: number; count: number; open: boolean }[];
  edges: { d: string; laneKey: string }[];
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
const OWNER_COLORS = ["#0a84ff", "#af52de", "#30b0c7", "#ff9500", "#34c759", "#ff375f"];
function ownerColor(id: string): string {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return OWNER_COLORS[h % OWNER_COLORS.length];
}

function computeLayout(
  roots: Task[],
  cm: ChildMap,
  workstreams: Workstream[],
  members: Record<string, Member>,
  groupBy: GroupBy,
  cellsOpen: Set<string>,
  subsOpen: Set<string>,
  addingId: string | null,
): Layout {
  const laneKeyOf = (t: Task): string =>
    groupBy === "owner"
      ? t.assignee_id ?? "_un"
      : groupBy === "due"
        ? dueBucket(t.due_date).key
        : t.workstream_id ?? "_other";

  let lanes: Lane[] = [];
  if (groupBy === "workstream") {
    lanes = [...workstreams]
      .sort((a, b) => a.order - b.order)
      .filter((ws) => roots.some((t) => t.workstream_id === ws.id))
      .map((ws) => ({ key: ws.id, name: ws.name, color: "var(--accent)" }));
    if (roots.some((t) => !t.workstream_id))
      lanes.push({ key: "_other", name: "미지정", color: "rgb(var(--text-quaternary))" });
  } else if (groupBy === "owner") {
    const seen = new Map<string, Lane>();
    for (const t of roots) {
      const key = t.assignee_id ?? "_un";
      if (!seen.has(key)) {
        const nm = t.assignee_id ? members[t.assignee_id]?.name ?? "—" : "미지정";
        seen.set(key, { key, name: nm, color: t.assignee_id ? ownerColor(t.assignee_id) : "rgb(var(--text-quaternary))", avatar: t.assignee_id ? initials(nm) : undefined });
      }
    }
    lanes = [...seen.values()];
  } else {
    const seen = new Map<string, Lane & { order: number }>();
    for (const t of roots) {
      const b = dueBucket(t.due_date);
      if (!seen.has(b.key)) seen.set(b.key, { key: b.key, name: b.name, color: b.color, order: b.order });
    }
    lanes = [...seen.values()].sort((a, b) => a.order - b.order);
  }

  // bucket roots into (lane × stage) by rolled-up status
  const cell = new Map<string, Task[]>();
  for (const t of roots) {
    const k = `${laneKeyOf(t)}|${stageIndex(effStatus(t, cm))}`;
    (cell.get(k) ?? cell.set(k, []).get(k)!).push(t);
  }
  for (const arr of cell.values()) arr.sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"));

  const nodes: Positioned[] = [];
  const overflow: Layout["overflow"] = [];
  const laneOut: Layout["lanes"] = [];
  let y = TOP;
  for (const lane of lanes) {
    const laneTasks = roots.filter((t) => laneKeyOf(t) === lane.key);
    const done = laneTasks.filter((t) => effStatus(t, cm) === "Done").length;
    const laneTop = y;
    let laneMaxBottom = laneTop + CARD_BASE;
    for (let s = 0; s < STAGE_COUNT; s++) {
      const arr = cell.get(`${lane.key}|${s}`) ?? [];
      const isOpen = cellsOpen.has(`${lane.key}|${s}`);
      const shown = isOpen ? arr : arr.slice(0, CAP);
      let cy = laneTop + 10;
      for (const t of shown) {
        const h = cardHeight(t, cm, subsOpen, addingId);
        nodes.push({ task: t, x: LANEPAD + s * COLW, y: cy, h });
        cy += h + VGAP;
      }
      if (arr.length > CAP) {
        overflow.push({ cellKey: `${lane.key}|${s}`, x: LANEPAD + s * COLW, y: cy, count: isOpen ? arr.length : arr.length - CAP, open: isOpen });
        cy += CHIP_H;
      }
      laneMaxBottom = Math.max(laneMaxBottom, cy);
    }
    laneOut.push({ ...lane, y: laneTop, done, total: laneTasks.length });
    y = laneMaxBottom + LANE_PAD + LANE_GAP;
  }
  const contentBottom = y - LANE_GAP;

  const columns = STAGE_LABELS.map((_, i) => ({
    i,
    x: LANEPAD + i * COLW,
    count: roots.filter((t) => stageIndex(effStatus(t, cm)) === i).length,
  }));

  const edges: Layout["edges"] = [];
  for (const lane of laneOut) {
    const firsts: Positioned[] = [];
    for (let s = 0; s < STAGE_COUNT; s++) {
      const n = nodes.find((p) => stageIndex(effStatus(p.task, cm)) === s && laneKeyOf(p.task) === lane.key);
      if (n) firsts.push(n);
    }
    for (let i = 0; i < firsts.length - 1; i++) {
      const a = firsts[i]!, b = firsts[i + 1]!;
      const ax = a.x + NODEW, ay = a.y + 30, bx = b.x, by = b.y + 30, mx = (ax + bx) / 2;
      edges.push({ d: `M ${ax} ${ay} C ${mx} ${ay}, ${mx} ${by}, ${bx} ${by}`, laneKey: lane.key });
    }
  }

  return { lanes: laneOut, columns, nodes, overflow, edges, worldW: LANEPAD + STAGE_COUNT * COLW + 40, worldH: contentBottom + 40 };
}

// ── component ─────────────────────────────────────────────────────────────────
export interface WorkflowCanvasProps {
  tasks: Task[];
  workstreams: Workstream[];
  members: Record<string, Member>;
  onSelect: (task: Task) => void;
  /** Creates a top-level task in this project. Omit to hide the add affordance. */
  onAddTask?: (title: string) => Promise<boolean>;
  /** Controls the focus filter from outside (e.g. the project summary strip). */
  focus?: Focus;
  onFocusChange?: (focus: Focus) => void;
}

export default function WorkflowCanvas({
  tasks,
  workstreams,
  members,
  onSelect,
  onAddTask,
  focus: focusProp,
  onFocusChange,
}: WorkflowCanvasProps) {
  const [groupBy, setGroupBy] = useState<GroupBy>("workstream");
  const [focusState, setFocusState] = useState<Focus>("all");
  const focus = focusProp ?? focusState;
  const setFocus = (next: Focus) => {
    setFocusState(next);
    onFocusChange?.(next);
  };
  const [cellsOpen, setCellsOpen] = useState<Set<string>>(new Set());
  const [subsOpen, setSubsOpen] = useState<Set<string>>(new Set());
  const [zoomPct, setZoomPct] = useState(100);
  const [hotLane, setHotLane] = useState<string | null>(null);
  const [addingFor, setAddingFor] = useState<string | null>(null);
  const [addValue, setAddValue] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const addInputRef = useRef<HTMLInputElement>(null);

  const stageRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const view = useRef({ x: 0, y: 8, scale: 1 });

  // parent→children map + top-level roots (drop cancelled)
  const { childMap, roots } = useMemo(() => {
    const live = tasks.filter((t) => !t.cancelled_at);
    const cm: ChildMap = new Map();
    for (const t of live) {
      if (t.parent_task_id) (cm.get(t.parent_task_id) ?? cm.set(t.parent_task_id, []).get(t.parent_task_id)!).push(t);
    }
    for (const arr of cm.values()) arr.sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"));
    return { childMap: cm, roots: live.filter((t) => !t.parent_task_id) };
  }, [tasks]);

  const layout = useMemo(
    () => computeLayout(roots, childMap, workstreams, members, groupBy, cellsOpen, subsOpen, addingFor),
    [roots, childMap, workstreams, members, groupBy, cellsOpen, subsOpen, addingFor],
  );

  // open the inline subtask composer under a card
  function startAdd(taskId: string) {
    setAddValue("");
    setAddError(null);
    setAddingFor(taskId);
    if (kids(childMap, taskId).length > 0) setSubsOpen((p) => new Set(p).add(taskId));
    requestAnimationFrame(() => addInputRef.current?.focus());
  }
  function cancelAdd() {
    setAddingFor(null);
    setAddValue("");
    setAddError(null);
  }
  function submitAdd(parentId: string) {
    const title = addValue.trim();
    if (!title) return;
    setAddError(null);
    startTransition(async () => {
      const res = await createSubtaskAction(parentId, title);
      if (res.success) {
        setAddValue("");
        setAddingFor(null);
        setSubsOpen((p) => new Set(p).add(parentId)); // reveal the new child
        router.refresh();
      } else {
        setAddError(res.error ?? "세부 업무를 추가하지 못했습니다");
      }
    });
  }

  const laneKeyOf = (t: Task) =>
    groupBy === "owner" ? t.assignee_id ?? "_un" : groupBy === "due" ? dueBucket(t.due_date).key : t.workstream_id ?? "_other";
  const matchesFocus = (t: Task) => {
    const eff = effStatus(t, childMap);
    return focus === "all" ? true : focus === "do" ? eff === "InProgress" || eff === "Review" : focus === "wait" ? t.status === "Waiting" : overdue(t, eff);
  };

  // ── pan / zoom (imperative) ─────────────────────────────────────────────────
  function applyView() {
    const { x, y, scale } = view.current;
    if (worldRef.current) worldRef.current.style.transform = `translate(${x}px,${y}px) scale(${scale})`;
  }
  function bounds() {
    const st = stageRef.current;
    if (!st) return { minX: -1e5, maxX: 40, minY: -1e5, maxY: 50 };
    const ww = layout.worldW * view.current.scale, wh = layout.worldH * view.current.scale;
    return { minX: Math.min(0, st.clientWidth - ww - 40), maxX: 40, minY: Math.min(0, st.clientHeight - wh - 40), maxY: 50 };
  }
  function fit() {
    const st = stageRef.current;
    if (!st) return;
    let scale = Math.min(1, (st.clientWidth - 40) / layout.worldW);
    if (scale < 0.5) scale = 0.5;
    view.current = { x: Math.max(0, Math.min(40, (st.clientWidth - layout.worldW * scale) / 2)), y: 8, scale };
    setZoomPct(Math.round(scale * 100));
    applyView();
  }
  function zoomAt(cx: number, cy: number, f: number) {
    const st = stageRef.current;
    if (!st) return;
    const r = st.getBoundingClientRect();
    const ox = cx - r.left, oy = cy - r.top;
    const ns = Math.max(0.5, Math.min(1.6, view.current.scale * f)), k = ns / view.current.scale;
    view.current.x = ox - (ox - view.current.x) * k;
    view.current.y = oy - (oy - view.current.y) * k;
    view.current.scale = ns;
    const b = bounds();
    view.current.x = Math.max(b.minX, Math.min(b.maxX, view.current.x));
    view.current.y = Math.max(b.minY, Math.min(b.maxY, view.current.y));
    setZoomPct(Math.round(ns * 100));
    applyView();
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => fit(), [groupBy, tasks.length, workstreams.length]);
  useEffect(() => {
    const onResize = () => fit();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout.worldW]);
  useEffect(() => {
    const st = stageRef.current;
    if (!st) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) return zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.08 : 0.926);
      const b = bounds();
      view.current.x = Math.max(b.minX, Math.min(b.maxX, view.current.x - e.deltaX));
      view.current.y = Math.max(b.minY, Math.min(b.maxY, view.current.y - e.deltaY));
      applyView();
    };
    st.addEventListener("wheel", onWheel, { passive: false });
    return () => st.removeEventListener("wheel", onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout.worldW, layout.worldH]);

  const drag = useRef({ on: false, px: 0, py: 0, vx: 0, vy: 0, raf: 0, hist: [] as number[][] });
  function onPointerDown(e: React.PointerEvent) {
    if ((e.target as HTMLElement).closest("[data-card],[data-ui]")) return;
    const d = drag.current;
    d.on = true; d.px = e.clientX; d.py = e.clientY; d.vx = d.vy = 0;
    d.hist = [[e.clientX, e.clientY, performance.now()]];
    cancelAnimationFrame(d.raf);
    stageRef.current?.setPointerCapture(e.pointerId);
    stageRef.current?.classList.add("cursor-grabbing");
  }
  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d.on) return;
    const dx = e.clientX - d.px, dy = e.clientY - d.py;
    d.px = e.clientX; d.py = e.clientY;
    const b = bounds();
    const rub = (v: number, mn: number, mx: number) => (v < mn ? mn - (mn - v) * 0.5 : v > mx ? mx + (v - mx) * 0.5 : v);
    view.current.x = rub(view.current.x + dx, b.minX, b.maxX);
    view.current.y = rub(view.current.y + dy, b.minY, b.maxY);
    d.hist.push([e.clientX, e.clientY, performance.now()]);
    if (d.hist.length > 6) d.hist.shift();
    applyView();
  }
  function onPointerUp() {
    const d = drag.current;
    if (!d.on) return;
    d.on = false;
    stageRef.current?.classList.remove("cursor-grabbing");
    if (d.hist.length > 1) {
      const a = d.hist[0]!, z = d.hist[d.hist.length - 1]!;
      const dt = z[2]! - a[2]! || 16;
      d.vx = ((z[0]! - a[0]!) / dt) * 16;
      d.vy = ((z[1]! - a[1]!) / dt) * 16;
    }
    const b = bounds();
    const step = () => {
      d.vx *= 0.93; d.vy *= 0.93;
      view.current.x += d.vx; view.current.y += d.vy;
      if (view.current.x < b.minX) (view.current.x += (b.minX - view.current.x) * 0.18), (d.vx *= 0.6);
      if (view.current.x > b.maxX) (view.current.x += (b.maxX - view.current.x) * 0.18), (d.vx *= 0.6);
      if (view.current.y < b.minY) (view.current.y += (b.minY - view.current.y) * 0.18), (d.vy *= 0.6);
      if (view.current.y > b.maxY) (view.current.y += (b.maxY - view.current.y) * 0.18), (d.vy *= 0.6);
      applyView();
      if (Math.abs(d.vx) > 0.1 || Math.abs(d.vy) > 0.1) d.raf = requestAnimationFrame(step);
    };
    d.raf = requestAnimationFrame(step);
  }

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
      {/* toolbar */}
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-3 px-4 pb-3 sm:px-6" data-ui>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">기준</span>
          <div className="flex gap-0.5 rounded-lg bg-surface-2 p-0.5">
            {GROUP_OPTS.map((o) => (
              <button key={o.id} type="button" aria-pressed={groupBy === o.id}
                onClick={() => { setGroupBy(o.id); setCellsOpen(new Set()); }}
                className={cn("rounded-md px-2.5 py-1 text-xs font-medium transition-colors", groupBy === o.id ? "bg-surface text-text shadow-xs" : "text-text-secondary hover:text-text")}>
                {o.label}
              </button>
            ))}
          </div>
        </div>
        {onAddTask && (
          <div className="min-w-[9rem] max-w-xs flex-1">
            <InlineAdd onAdd={onAddTask} label="업무 추가" placeholder="업무명 입력 후 Enter" />
          </div>
        )}

        <div className="ml-auto flex gap-1.5">
          {([["all", "전체", ""], ["do", "지금 할 일", "bg-status-inprogress"], ["wait", "대기", "bg-status-waiting"], ["over", "기한 초과", "bg-flag-overdue"]] as [Focus, string, string][]).map(([f, label, dot]) => (
            <button key={f} type="button" aria-pressed={focus === f} onClick={() => setFocus(f)}
              className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors", focus === f ? "border-text bg-text text-bg" : "border-border bg-surface text-text-secondary hover:text-text")}>
              {dot && <span className={cn("size-1.5 rounded-full", focus === f ? "bg-bg" : dot)} />}
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* viewport */}
      <div ref={stageRef} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerLeave={onPointerUp}
        className="relative h-[72vh] min-h-[440px] w-full cursor-grab touch-none select-none overflow-hidden border-y border-separator bg-surface-2/40"
        style={{ backgroundImage: "radial-gradient(rgb(var(--text-quaternary)/0.28) 1px, transparent 1.4px)", backgroundSize: "24px 24px" }}>
        <div ref={worldRef} className="absolute left-0 top-0 origin-top-left will-change-transform">
          {/* columns */}
          {layout.columns.map((c) => (
            <div key={c.i} className="absolute top-0" style={{ left: c.x, top: TOP - 40 }}>
              <div className="absolute rounded-2xl" style={{ top: 40, width: COLW - COLGAP, height: layout.worldH - TOP - 8, background: `color-mix(in srgb, rgb(var(--${STAGE_TOKENS[c.i]})) 5%, transparent)` }} />
              <div className="absolute inline-flex h-7 items-center gap-2 rounded-full px-3 text-xs font-semibold"
                style={{ color: `rgb(var(--${STAGE_TOKENS[c.i]}))`, background: `color-mix(in srgb, rgb(var(--${STAGE_TOKENS[c.i]})) 13%, rgb(var(--surface)))` }}>
                <span className="size-2 rounded-full" style={{ background: `rgb(var(--${STAGE_TOKENS[c.i]}))` }} />
                {STAGE_LABELS[c.i]}<span className="font-mono tabular-nums text-text-tertiary">{c.count}</span>
              </div>
            </div>
          ))}

          {/* lanes */}
          {layout.lanes.map((l, i) => (
            <div key={l.key}>
              {i > 0 && <div className="absolute h-px bg-separator/70" style={{ top: l.y - LANE_GAP / 2, left: 0, width: LANEPAD + STAGE_COUNT * COLW }} />}
              <div className="absolute flex flex-col gap-1.5 rounded-xl border border-separator bg-surface/75 p-3 backdrop-blur" style={{ top: l.y + 8, left: 0, width: LANEPAD - 16 }}>
                <div className="flex items-center gap-2 text-[13px] font-semibold text-text">
                  {l.avatar ? <span className="grid size-5 place-items-center rounded-full text-[9px] font-bold text-white" style={{ background: l.color }}>{l.avatar}</span> : <span className="size-2.5 rounded" style={{ background: l.color }} />}
                  <span className="truncate">{l.name}</span>
                </div>
                <div className="text-[10.5px] font-medium tabular-nums text-text-tertiary">완료 {l.done}/{l.total}</div>
                <div className="h-1.5 overflow-hidden rounded-full bg-surface-3"><div className="h-full rounded-full bg-status-done transition-[width] duration-500 ease-out" style={{ width: `${l.total ? (l.done / l.total) * 100 : 0}%` }} /></div>
              </div>
            </div>
          ))}

          {/* edges */}
          <svg className="pointer-events-none absolute left-0 top-0 overflow-visible" width={layout.worldW} height={layout.worldH}>
            {layout.edges.map((e, i) => (
              <path key={i} d={e.d} fill="none" strokeLinecap="round" strokeWidth={hotLane === e.laneKey ? 2.6 : 2}
                stroke={hotLane === e.laneKey ? "rgb(var(--accent))" : "rgb(var(--text-quaternary)/0.5)"} className="transition-[stroke,stroke-width] duration-200" />
            ))}
          </svg>

          {/* cards */}
          {layout.nodes.map(({ task, x, y, h }) => {
            const eff = effStatus(task, childMap);
            const meta = statusMeta(eff);
            const over = overdue(task, eff);
            const dim = !matchesFocus(task);
            const assignee = task.assignee_id ? members[task.assignee_id] : undefined;
            const p = rollupProgress(task, childMap);
            const laneKey = laneKeyOf(task);
            const [sd, sn] = subCount(task, childMap);
            const hasKids = sn > 0;
            const open = subsOpen.has(task.id);
            const rows = hasKids && open ? subRows(task, 0) : [];
            return (
              <div key={task.id} data-card onPointerEnter={() => setHotLane(laneKey)} onPointerLeave={() => setHotLane((hh) => (hh === laneKey ? null : hh))}
                className={cn("group absolute flex flex-col overflow-hidden rounded-[14px] border bg-surface shadow-sm transition-[opacity,box-shadow] duration-200",
                  task.status === "Waiting" && !hasKids ? "border-dashed border-status-waiting/50" : "border-separator", dim && "opacity-30 saturate-50")}
                style={{ left: x, top: y, width: NODEW, height: h }}>
                <div className={cn("h-1 shrink-0", meta.dot)} />
                <div className="flex flex-1 flex-col gap-2 overflow-hidden p-3">
                  {/* clickable header opens the detail panel */}
                  <button type="button" onClick={() => onSelect(task)}
                    className="text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg rounded">
                    {over && <span className="absolute right-2 top-2 size-2.5 rounded-full border-2 border-surface bg-flag-overdue" />}
                    <div className={cn("mb-2 line-clamp-2 text-[13px] font-medium leading-snug", eff === "Done" && "text-text-secondary")}>{task.title}</div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10.5px] font-semibold", meta.fill, meta.text)}>
                        <span className={cn("size-1.5 rounded-full", meta.dot)} />{task.status === "Waiting" && !hasKids ? "대기 중" : meta.label}
                      </span>
                      {task.due_date && <span className={cn("inline-flex items-center gap-1 text-[10.5px] tabular-nums", over ? "font-semibold text-flag-overdue" : "text-text-tertiary")}>{over ? "⚠" : "📅"} {fmtDue(task.due_date)}</span>}
                      <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] font-medium text-text-secondary">
                        {assignee ? <><span className="grid size-[18px] place-items-center rounded-full text-[9px] font-bold text-white" style={{ background: ownerColor(assignee.id) }}>{initials(assignee.name)}</span>{assignee.name.split(" ")[0]}</> : "미지정"}
                      </span>
                    </div>
                    <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface-3"><div className={cn("h-full rounded-full", meta.dot)} style={{ width: `${p * 100}%` }} /></div>
                  </button>

                  {/* subtask meter — the inline-expand toggle */}
                  {hasKids && (
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
                        const ce = effStatus(c, childMap);
                        const cm2 = statusMeta(ce);
                        const [cd, cn2] = subCount(c, childMap);
                        const cav = c.assignee_id ? members[c.assignee_id] : undefined;
                        return (
                          <div key={c.id} className="flex items-center gap-2 rounded-md py-1 pr-1 hover:bg-surface-2" style={{ height: ROW_H, paddingLeft: 6 + depth * 14 }}>
                            {ck ? (
                              <button type="button" data-ui aria-label="세부 업무 펼치기" onClick={() => toggleSub(c.id)} className="grid size-4 shrink-0 place-items-center rounded text-text-tertiary hover:bg-surface-3">
                                <ChevronRight className={cn("size-3 transition-transform", co && "rotate-90")} />
                              </button>
                            ) : <span className="size-4 shrink-0" />}
                            <span className={cn("size-2 shrink-0 rounded-full", cm2.dot)} />
                            <button type="button" onClick={() => onSelect(c)} className={cn("flex-1 truncate text-left text-[12px] font-medium hover:underline", ce === "Done" && "text-text-tertiary line-through")}>{c.title}</button>
                            {ck && <span className="shrink-0 font-mono text-[9.5px] tabular-nums text-text-tertiary">{cd}/{cn2}</span>}
                            {cav && <span className="grid size-4 shrink-0 place-items-center rounded-full text-[8px] font-bold text-white" style={{ background: ownerColor(cav.id) }}>{initials(cav.name)}</span>}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* footer: inline subtask composer, or the add affordance */}
                  {addingFor === task.id ? (
                    <div data-ui className="mt-auto flex flex-col gap-1" style={{ height: ADD_H - 8 }} onPointerDown={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1.5">
                        <input
                          ref={addInputRef}
                          value={addValue}
                          disabled={pending}
                          onChange={(e) => setAddValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") { e.preventDefault(); submitAdd(task.id); }
                            else if (e.key === "Escape") { e.preventDefault(); cancelAdd(); }
                          }}
                          onBlur={() => { if (!addValue.trim() && !pending) cancelAdd(); }}
                          placeholder="세부 업무를 입력하세요"
                          className="h-7 w-full rounded-md border border-accent bg-surface px-2 text-[12px] text-text placeholder:text-text-quaternary focus:outline-none focus:ring-2 focus:ring-accent/30"
                        />
                        <button type="button" disabled={pending || !addValue.trim()} onClick={() => submitAdd(task.id)}
                          className="grid size-7 shrink-0 place-items-center rounded-md bg-accent text-white transition-colors hover:bg-accent-hover disabled:opacity-40">
                          <Plus className="size-4" />
                        </button>
                      </div>
                      {addError && <span className="text-[10px] text-flag-blocked">{addError}</span>}
                    </div>
                  ) : (
                    <button type="button" data-ui onClick={() => startAdd(task.id)}
                      className="mt-auto flex items-center gap-1 self-start rounded-md px-1.5 py-1 text-[11px] font-medium text-text-tertiary opacity-0 transition-opacity hover:text-accent group-hover:opacity-100 focus-visible:opacity-100"
                      style={{ height: ADDBTN_H - 8 }}>
                      <Plus className="size-3.5" /> 세부 업무 추가
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {/* "+N more" expanders */}
          {layout.overflow.map((o) => (
            <button key={o.cellKey} type="button" data-ui onClick={() => toggleCell(o.cellKey)}
              className="absolute inline-flex items-center justify-center rounded-lg border border-separator bg-surface px-3 text-xs font-medium text-text-secondary shadow-xs transition-colors hover:bg-surface-2 active:scale-[0.98]"
              style={{ left: o.x, top: o.y, width: NODEW, height: CHIP_H - 6 }}>
              {o.open ? "간략히" : `+${o.count}개 더보기`}
            </button>
          ))}
        </div>

        {/* zoom */}
        <div className="absolute bottom-4 right-4 z-10 flex items-center gap-0.5 rounded-xl border border-separator bg-surface/90 p-1 shadow-md backdrop-blur" data-ui>
          <button type="button" aria-label="축소" onClick={() => zoomAt((stageRef.current?.clientWidth ?? 0) / 2, (stageRef.current?.clientHeight ?? 0) / 2, 0.89)} className="grid size-7 place-items-center rounded-lg text-text-secondary hover:bg-surface-2"><Minus className="size-4" /></button>
          <span className="min-w-[42px] text-center text-xs font-semibold tabular-nums text-text-secondary">{zoomPct}%</span>
          <button type="button" aria-label="확대" onClick={() => zoomAt((stageRef.current?.clientWidth ?? 0) / 2, (stageRef.current?.clientHeight ?? 0) / 2, 1.12)} className="grid size-7 place-items-center rounded-lg text-text-secondary hover:bg-surface-2"><Plus className="size-4" /></button>
          <button type="button" aria-label="화면 맞춤" onClick={() => fit()} className="grid size-7 place-items-center rounded-lg text-text-secondary hover:bg-surface-2"><Maximize2 className="size-4" /></button>
        </div>
      </div>
    </div>
  );
}
