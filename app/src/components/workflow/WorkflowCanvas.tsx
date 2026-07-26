"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus, Maximize2, ChevronRight, CornerDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { statusMeta, displayGroup, type TaskStatus } from "@/lib/status";
import { createSubtaskAction, createProjectTaskAction } from "@/app/actions/tasks";
import InlineAdd from "@/components/tasks/InlineAdd";
import type { Task, Workstream, Member, Project } from "@/server/db/schema";
import { buildBoardGraph, isKey, laneKeyFor, type ChildMap, type GroupBy } from "@/lib/board-graph";
import { BRANDS } from "@/lib/brand";
import { ownerColor, initials } from "@/lib/colors";

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
// Three columns, matching the three statuses the product shows everywhere else
// (lib/status.ts's displayGroup) — Waiting is its own column rather than being
// folded into "in progress": the board's main job on entry is to show what is
// moving and what is stuck, and a blocked task hidden inside the in-progress
// column reads as healthy work.
const STAGE_LABELS = ["진행 중", "대기", "완료"] as const;
const STAGE_TOKENS = ["status-inprogress", "status-waiting", "status-done"] as const;
const STAGE_COUNT = STAGE_LABELS.length;

function stageIndex(s: TaskStatus): number {
  switch (displayGroup(s)) {
    case "Waiting":
      return 1;
    case "Done":
      return 2;
    default:
      return 0;
  }
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
}

// ── geometry ──────────────────────────────────────────────────────────────────
const TOP = 50;
const LANEPAD = 190;
// 5 columns → 3 frees up real width; cards use it instead of leaving it empty.
const COLW = 340;
const COLGAP = 18;
const NODEW = COLW - COLGAP - 6;
const CARD_BASE = 96; // header block: title + meta (no progress bar — see card render)
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
const PROJ_HEADER_H = 22; // project sub-header inside a brand lane's column
// A key task earns its extra height from importance alone — never from how many
// subtasks it happens to carry (see cardHeight).
const KEY_EXTRA = 14;
// milestone rail
const RAIL_H = 58;
const RAIL_LABEL_W = 76; // left inset holding the "마일스톤" caption
const RAIL_GAP = 8;

export type Lod = "full" | "compact";

export function cardHeight(
  t: Task,
  cm: ChildMap,
  open: Set<string>,
  addingId: string | null,
  lod: Lod = "full"
): number {
  const hasKids = kids(cm, t.id).length > 0;
  let h = CARD_BASE + (isKey(t) ? KEY_EXTRA : 0);
  if (hasKids) {
    h += METER_H;
    // Subtree size only affects height while the user has it expanded, so a
    // card's resting size reads as importance rather than as child count.
    // Compact never renders the expanded rows (there's no toggle to collapse
    // them there), so it must not reserve height for them either.
    if (lod === "full" && open.has(t.id)) h += SUB_PAD + visibleRows(t, cm, open) * ROW_H;
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
  columns: { i: number; x: number; count: number }[];
  nodes: Positioned[];
  rails: Rail[];
  overflow: { cellKey: string; x: number; y: number; count: number; open: boolean }[];
  /** Project sub-headers inside a brand lane's column — the middle tier of
   * 브랜드-프로젝트-업무 that a flattened brand lane would otherwise lose. */
  projectHeaders: { key: string; name: string; x: number; y: number }[];
  /** A dashed tether from a promoted (key) descendant back to its real parent. */
  edges: { d: string; laneKey: string; kind: "parent" }[];
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
  projects: Project[],
  groupBy: GroupBy,
  cellsOpen: Set<string>,
  subsOpen: Set<string>,
  addingId: string | null,
  lod: Lod,
  projectBrand: Map<string, string>,
): Layout {
  // Lane membership is decided by the root of a task's tree, so a promoted
  // descendant always appears in the same band as the work it belongs to.
  const laneKeyOf = (t: Task): string => laneOf.get(t.id) ?? laneKeyFor(t, groupBy, undefined, projectBrand);
  // A band earns its place from milestones too — a project whose only content
  // this quarter is a deadline still has to appear.
  const msIn = (key: string) =>
    milestones.some((m) => milestoneLaneKey(m, groupBy, projectBrand) === key);

  let lanes: Lane[] = [];
  if (groupBy === "brand") {
    // Fixed, closed list — every brand gets a lane even with zero current
    // work, so "nothing here yet" is legible instead of the lane vanishing.
    lanes = BRANDS.map((b) => ({ key: b, name: b, color: "rgb(var(--accent))" }));
  } else if (groupBy === "project") {
    // Every active project gets a lane, even with zero tasks yet — otherwise
    // a freshly created project has nowhere to show its own "+업무 추가"
    // button and can never receive its first task.
    lanes = projects.map((p) => ({ key: p.id, name: p.name, color: "rgb(var(--accent))" }));
    if (roots.some((t) => !t.project_id))
      lanes.push({ key: "_inbox", name: "인박스", color: "rgb(var(--status-inbox))" });
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

  // bucket every placed node into (lane × stage) by its own status
  const cell = new Map<string, Task[]>();
  for (const t of placed) {
    const k = `${laneKeyOf(t)}|${stageIndex(t.status)}`;
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

  const railX = LANEPAD;
  const railW = STAGE_COUNT * COLW - COLGAP;
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
  const projectNameOf = new Map(projects.map((p) => [p.id, p.name]));
  const laneOut: Layout["lanes"] = [];
  let y = TOP;
  if (boardMs.length) {
    rails.push(buildRail("_board", boardMs, y));
    y += RAIL_H + RAIL_GAP + LANE_GAP;
  }
  for (const lane of lanes) {
    const laneTasks = placed.filter((t) => laneKeyOf(t) === lane.key);
    const done = laneTasks.filter((t) => t.status === "Done").length;
    const laneTop = y;
    const laneMs = msByLane.get(lane.key);
    // The band's own rail sits above its cards, inside the band, so the
    // deadlines read as belonging to that stream of work.
    const railH = laneMs ? RAIL_H + RAIL_GAP : 0;
    if (laneMs) rails.push(buildRail(lane.key, laneMs, laneTop + RAIL_GAP));
    let laneMaxBottom = laneTop + railH + CARD_BASE;
    for (let s = 0; s < STAGE_COUNT; s++) {
      const arr = cell.get(`${lane.key}|${s}`) ?? [];
      // A brand lane flattens every project's tasks together, so without this
      // grouping the middle tier of 브랜드-프로젝트-업무 is lost entirely —
      // group (stably, so the existing key/due ordering holds within a group)
      // before the cap/overflow slicing below.
      const ordered = groupBy === "brand"
        ? [...arr].sort((a, b) => (projectNameOf.get(a.project_id ?? "") ?? "").localeCompare(projectNameOf.get(b.project_id ?? "") ?? ""))
        : arr;
      const isOpen = cellsOpen.has(`${lane.key}|${s}`);
      const shown = isOpen ? ordered : ordered.slice(0, CAP);
      let cy = laneTop + 10 + railH;
      let lastProject: string | null | undefined;
      for (const t of shown) {
        if (groupBy === "brand" && t.project_id !== lastProject) {
          lastProject = t.project_id;
          projectHeaders.push({
            key: `${lane.key}|${s}|${t.project_id ?? "_none"}`,
            name: t.project_id ? (projectNameOf.get(t.project_id) ?? "") : "미분류",
            x: LANEPAD + s * COLW,
            y: cy,
          });
          cy += PROJ_HEADER_H;
        }
        const h = cardHeight(t, cm, subsOpen, addingId, lod);
        nodes.push({ task: t, x: LANEPAD + s * COLW, y: cy, h });
        cy += h + VGAP;
      }
      if (arr.length > CAP) {
        overflow.push({ cellKey: `${lane.key}|${s}`, x: LANEPAD + s * COLW, y: cy, count: isOpen ? arr.length : arr.length - CAP, open: isOpen });
        cy += CHIP_H;
      }
      laneMaxBottom = Math.max(laneMaxBottom, cy);
    }
    // A project with zero tasks yet never appears in any stage cell above, so
    // without this it's invisible under its brand the moment it's created —
    // same "show it even empty" rule the brand/project lanes themselves use.
    if (groupBy === "brand") {
      const projectIdsWithTasks = new Set(laneTasks.map((t) => t.project_id).filter(Boolean));
      const emptyProjects = projects.filter((p) => p.brand === lane.key && !projectIdsWithTasks.has(p.id));
      for (const p of emptyProjects) {
        projectHeaders.push({ key: `${lane.key}|empty|${p.id}`, name: p.name, x: LANEPAD, y: laneMaxBottom });
        laneMaxBottom += PROJ_HEADER_H;
      }
    }
    laneOut.push({ ...lane, y: laneTop, h: laneMaxBottom - laneTop + LANE_PAD, done, total: laneTasks.length });
    y = laneMaxBottom + LANE_PAD + LANE_GAP;
  }
  const contentBottom = y - LANE_GAP;

  const columns = STAGE_LABELS.map((_, i) => ({
    i,
    x: LANEPAD + i * COLW,
    count: placed.filter((t) => stageIndex(t.status) === i).length,
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
    const ax = p.x + NODEW / 2, ay = p.y + p.h;
    const bx = n.x + NODEW / 2, by = n.y;
    const my = (ay + by) / 2;
    edges.push({
      d: `M ${ax} ${ay} C ${ax} ${my}, ${bx} ${my}, ${bx} ${by}`,
      laneKey: laneKeyOf(n.task),
      kind: "parent",
    });
  }

  return { lanes: laneOut, columns, nodes, rails, overflow, projectHeaders, edges, worldW: LANEPAD + STAGE_COUNT * COLW + 40, worldH: contentBottom + 40 };
}

// ── component ─────────────────────────────────────────────────────────────────
export interface WorkflowCanvasProps {
  tasks: Task[];
  workstreams: Workstream[];
  members: Record<string, Member>;
  /** Needed to name project lanes. Pass on workspace-wide boards. */
  projects?: Project[];
  /** Lane axis to open on. Home groups by project, a project by workstream. */
  defaultGroupBy?: GroupBy;
  onSelect: (task: Task) => void;
  /** Creates a top-level task in this project. Omit to hide the add affordance. */
  onAddTask?: (title: string) => Promise<boolean>;
  /** Controls the focus filter from outside (e.g. the project summary strip). */
  focus?: Focus;
  onFocusChange?: (focus: Focus) => void;
  /**
   * Height of the pan/zoom stage. Defaults to "everything the viewport has left
   * under the page chrome" — the board is the workspace, so it should claim the
   * screen rather than sit in a fixed-height window. Callers with more chrome
   * above them (a project header, tabs) pass a larger subtrahend.
   */
  stageHeightClass?: string;
  /** Creates a milestone in the given project. Omit to hide the rail's +. */
  onAddMilestone?: (projectId: string, name: string, dueDate: string) => Promise<boolean>;
  /** Project every rail belongs to, when the board shows exactly one. */
  projectId?: string;
  /** Opens the project edit dialog. Omit to fall back to a plain label. */
  onEditProject?: (project: Project) => void;
}

export default function WorkflowCanvas({
  tasks,
  workstreams,
  members,
  projects,
  defaultGroupBy = "workstream",
  onSelect,
  onAddTask,
  focus: focusProp,
  onFocusChange,
  // 8.5rem = nav 3rem + page padding + the count row + this component's own
  // toolbar. Measured, not guessed: leaves the stage ~85% of the viewport.
  stageHeightClass = "h-[calc(100dvh-8.5rem)]",
  onAddMilestone,
  projectId,
  onEditProject,
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
  const [zoomPct, setZoomPct] = useState(100);
  const [addingFor, setAddingFor] = useState<string | null>(null);
  const [addValue, setAddValue] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const addInputRef = useRef<HTMLInputElement>(null);

  const stageRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const view = useRef({ x: 0, y: 8, scale: 1 });

  // project_id → brand, for the "brand" lane axis (brand lives on project, not task).
  const projectBrand = useMemo(
    () => new Map((projects ?? []).map((p) => [p.id, p.brand])),
    [projects],
  );

  // Which nodes get a card, and how a promoted one points back at its parent.
  const { childMap, roots, placed, laneOf, parentOf, milestones } = useMemo(
    () => buildBoardGraph(tasks, groupBy, undefined, projectBrand),
    [tasks, groupBy, projectBrand],
  );

  // Level of detail. Below 70% the small type is unreadable anyway, so it is
  // dropped rather than rendered as noise — title, status and the key badge are
  // what survive, plus the rails, which is the structure you zoom out to see.
  // Computed ahead of layout so card geometry (not just what's drawn on top of
  // it) can shrink to match — see cardHeight's lod parameter.
  const lod: Lod = zoomPct >= 70 ? "full" : "compact";

  const layout = useMemo(
    () => computeLayout(placed, roots, milestones, childMap, laneOf, parentOf, workstreams, members, projects ?? [], groupBy, cellsOpen, subsOpen, addingFor, lod, projectBrand),
    [placed, roots, milestones, childMap, laneOf, parentOf, workstreams, members, projects, groupBy, cellsOpen, subsOpen, addingFor, lod, projectBrand],
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

  const laneKeyOf = (t: Task) => laneOf.get(t.id) ?? laneKeyFor(t, groupBy);
  const matchesFocus = (t: Task) => {
    return focus === "all"
      ? true
      : focus === "do"
        ? displayGroup(t.status) === "InProgress"
        : focus === "wait"
          ? t.status === "Waiting"
          : overdue(t);
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
    // Center the board when it's narrower than the viewport; flush left
    // (clamped to 0, not capped at some small max) when it's wider and the
    // user needs to pan to see the rest.
    view.current = { x: Math.max(0, (st.clientWidth - layout.worldW * scale) / 2), y: 8, scale };
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

  /**
   * Keeps a keyboard-focused card inside the viewport. Cards are real buttons,
   * so Tab already reaches them — but the stage is pan/zoom, so focus could
   * land on something scrolled out of sight and the user would be typing at a
   * card they cannot see.
   */
  function revealNode(x: number, y: number, h: number) {
    const st = stageRef.current;
    if (!st) return;
    const s = view.current.scale;
    const left = x * s + view.current.x;
    const top = y * s + view.current.y;
    const right = left + NODEW * s;
    const bottom = top + h * s;
    let dx = 0;
    let dy = 0;
    if (left < 8) dx = 8 - left;
    else if (right > st.clientWidth - 8) dx = st.clientWidth - 8 - right;
    if (top < 8) dy = 8 - top;
    else if (bottom > st.clientHeight - 8) dy = st.clientHeight - 8 - bottom;
    if (!dx && !dy) return;
    const b = bounds();
    view.current.x = Math.max(b.minX, Math.min(b.maxX, view.current.x + dx));
    view.current.y = Math.max(b.minY, Math.min(b.maxY, view.current.y + dy));
    applyView();
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
            {GROUP_OPTS.filter((o) => (o.id !== "project" && o.id !== "brand") || projects).map((o) => (
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
        className={cn("relative min-h-[440px] w-full cursor-grab touch-none select-none overflow-hidden border-y border-separator bg-surface-2/40", stageHeightClass)}
        style={{ backgroundImage: "radial-gradient(rgb(var(--text-quaternary)/0.28) 1px, transparent 1.4px)", backgroundSize: "24px 24px" }}>
        <div ref={worldRef} className="absolute left-0 top-0 origin-top-left will-change-transform">
          {/* columns */}
          {layout.columns.map((c) => (
            <div key={c.i} className="absolute top-0" style={{ left: c.x, top: TOP - 40 }}>
              <div className="absolute rounded-2xl" style={{ top: 40, width: COLW - COLGAP, height: layout.worldH - TOP - 8, background: `color-mix(in srgb, rgb(var(--${STAGE_TOKENS[c.i]})) 5%, transparent)` }} />
              {/* nowrap: the wrapper is a zero-width absolute box, so without it
                  the label collapses to one character per line. */}
              <div className="absolute inline-flex h-7 w-max items-center gap-2 whitespace-nowrap rounded-full px-3 text-xs font-semibold"
                style={{ color: `rgb(var(--${STAGE_TOKENS[c.i]}))`, background: `color-mix(in srgb, rgb(var(--${STAGE_TOKENS[c.i]})) 13%, rgb(var(--surface)))` }}>
                <span className="size-2 rounded-full" style={{ background: `rgb(var(--${STAGE_TOKENS[c.i]}))` }} />
                {STAGE_LABELS[c.i]}<span className="font-mono tabular-nums text-text-tertiary">{c.count}</span>
              </div>
            </div>
          ))}

          {/* lanes — drawn as enclosed bands so a workstream reads as a
              container the cards live inside, not just a row they sit near. */}
          {layout.lanes.map((l) => (
            <div key={l.key}>
              <div
                className="absolute rounded-2xl border border-separator/70 bg-surface/40"
                style={{ top: l.y, left: 0, width: LANEPAD + STAGE_COUNT * COLW - COLGAP, height: l.h }}
              />
              {/* the band's colour rail — the only place the lane colour lives,
                  so it never competes with the status colours on the cards */}
              <div
                className="absolute rounded-l-2xl"
                style={{ top: l.y, left: 0, width: 3, height: l.h, background: l.color }}
              />
              <div className="absolute flex flex-col gap-1.5 rounded-xl border border-separator bg-surface/90 p-3 backdrop-blur" style={{ top: l.y + 10, left: 10, width: LANEPAD - 28 }}>
                <div className="flex items-center gap-2 text-[13px] font-semibold text-text">
                  {l.avatar ? <span className="grid size-5 place-items-center rounded-full text-[9px] font-bold text-white" style={{ background: l.color }}>{l.avatar}</span> : <span className="size-2.5 rounded" style={{ background: l.color }} />}
                  {/* The band label opens the project's own edit/archive
                      dialog now, not a page — same lightweight window a task
                      opens. */}
                  {groupBy === "project" && !l.key.startsWith("_") && onEditProject ? (
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
                <div className="text-[10.5px] font-medium tabular-nums text-text-tertiary">완료 {l.done}/{l.total}</div>
                <div className="h-1.5 overflow-hidden rounded-full bg-surface-3"><div className="h-full rounded-full bg-status-done transition-[width] duration-500 ease-out" style={{ width: `${l.total ? (l.done / l.total) * 100 : 0}%` }} /></div>
                {groupBy === "project" && !l.key.startsWith("_") && (
                  <div data-ui>
                    <InlineAdd
                      onAdd={async (title) => {
                        const res = await createProjectTaskAction(l.key, title);
                        if (res.success) router.refresh();
                        return res.success;
                      }}
                      className="px-1.5 py-1 text-[11px]"
                    />
                  </div>
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
            const parentId = parentOf.get(task.id);
            const parentTitle = parentId ? tasks.find((x) => x.id === parentId)?.title : undefined;
            // Compact has no toggle to collapse an already-expanded subtree
            // (the meter button below is itself lod-gated), so it must not
            // render the rows in the first place — matches cardHeight's guard.
            const rows = hasKids && open && lod === "full" ? subRows(task, 0) : [];
            return (
              <div key={task.id} data-card onFocusCapture={() => revealNode(x, y, h)}
                className={cn("group absolute flex flex-col overflow-hidden rounded-[14px] bg-surface transition-[opacity,box-shadow] duration-200",
                  // Importance is carried by weight and elevation only — never by
                  // colour, which belongs exclusively to status.
                  key_ ? "border-2 border-text/25 shadow-md" : "border shadow-sm",
                  !key_ && (task.status === "Waiting" && !hasKids ? "border-dashed border-status-waiting/50" : "border-separator"),
                  dim && "opacity-30 saturate-50")}
                style={{ left: x, top: y, width: NODEW, height: h }}>
                <div className={cn("shrink-0", meta.dot, key_ ? "h-1.5" : "h-1")} />
                <div className="flex flex-1 flex-col gap-2 overflow-hidden p-3">
                  {/* clickable header opens the detail panel */}
                  <button type="button" onClick={() => onSelect(task)}
                    className="text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg rounded">
                    {over && <span className="absolute right-2 top-2 size-2.5 rounded-full border-2 border-surface bg-flag-overdue" />}
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
                      {/* The two facts that make a Waiting task actionable. */}
                      {lod === "full" && task.status === "Waiting" && task.waiting_party_text && (
                        <span className="w-full truncate text-[10px] text-text-tertiary">
                          {task.waiting_party_text}
                          {task.follow_up_at && ` · ${fmtDue(task.follow_up_at)} 확인`}
                        </span>
                      )}
                      <span className={cn("ml-auto inline-flex items-center gap-1.5 text-[11px] font-medium text-text-secondary", lod === "compact" && "hidden")}>
                        {assignee ? <><span className="grid size-[18px] place-items-center rounded-full text-[9px] font-bold text-white" style={{ background: ownerColor(assignee.id) }}>{initials(assignee.name)}</span>{assignee.name.split(" ")[0]}</> : "미지정"}
                      </span>
                    </div>
                    {/* No progress bar. A leaf task has no measurable percentage
                        — it is in a status, and the status pill above already
                        says which. Cards with subtasks show a real n/m count in
                        the meter below instead. */}
                  </button>

                  {/* subtask meter — the inline-expand toggle */}
                  {hasKids && lod === "full" && (
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
                        const cm2 = statusMeta(c.status);
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
                            <button type="button" onClick={() => onSelect(c)} className={cn("flex-1 truncate text-left text-[12px] font-medium hover:underline", isKey(c) && "font-semibold", c.status === "Done" && "text-text-tertiary line-through")}>{c.title}</button>
                            {/* still counted here, but it also has its own card */}
                            {isKey(c) && <ArrowUpRight className="size-3 shrink-0 text-text-tertiary" aria-label="핵심 업무 — 보드에 별도 카드로 표시됨" />}
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

          {/* project sub-headers — the middle tier of 브랜드-프로젝트-업무,
              shown only in brand groupBy since that's the one axis that
              otherwise flattens every project's tasks into one lane. */}
          {layout.projectHeaders.map((h) => (
            <div key={h.key} className="absolute flex items-center gap-1 truncate text-[10.5px] font-semibold uppercase tracking-wide text-text-tertiary"
              style={{ left: h.x, top: h.y, width: NODEW }}>
              <span className="size-1 shrink-0 rounded-full bg-text-tertiary" />
              {h.name}
            </div>
          ))}

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
