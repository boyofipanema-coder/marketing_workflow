/**
 * Mock seed data for the Marketing Team Workflow app.
 * Field names match the planned Drizzle schema.
 * Do NOT import from src/server/db — this module is intentionally decoupled.
 */

// ---------------------------------------------------------------------------
// Interfaces (mirror planned Drizzle schema field names)
// ---------------------------------------------------------------------------

export interface Member {
  id: string;
  workspaceId: string;
  name: string;
  email: string;
  role: "admin" | "member" | "viewer";
}

export interface Project {
  id: string;
  workspaceId: string;
  name: string;
  oneLineObjective: string | null;
  projectLeadId: string;
  targetStartDate: string | null;
  targetEndDate: string | null;
}

export interface Workstream {
  id: string;
  projectId: string;
  name: string;
  order: number;
}

export type TaskStatus =
  | "Inbox"
  | "ToDo"
  | "InProgress"
  | "Waiting"
  | "Review"
  | "Done";

export interface Task {
  id: string;
  workspaceId: string;
  projectId: string | null;
  workstreamId: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  assigneeId: string | null;
  reviewerId: string | null;
  startDate: string | null;
  dueDate: string | null;
  version: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  cancelledAt: string | null;
}

// ---------------------------------------------------------------------------
// Date helpers — relative to "now" so overdue / upcoming tasks stay realistic
// ---------------------------------------------------------------------------

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

function daysFromNow(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString();
}

const NOW = new Date().toISOString();
const WORKSPACE_ID = "ws_marketing_01";

// ---------------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------------

export const members: Member[] = [
  {
    id: "mem_alice",
    workspaceId: WORKSPACE_ID,
    name: "Alice Park",
    email: "alice@brand.co",
    role: "admin",
  },
  {
    id: "mem_ben",
    workspaceId: WORKSPACE_ID,
    name: "Ben Torres",
    email: "ben@brand.co",
    role: "member",
  },
  {
    id: "mem_cara",
    workspaceId: WORKSPACE_ID,
    name: "Cara Nishi",
    email: "cara@brand.co",
    role: "member",
  },
  {
    id: "mem_dan",
    workspaceId: WORKSPACE_ID,
    name: "Dan Wu",
    email: "dan@brand.co",
    role: "member",
  },
  {
    id: "mem_eva",
    workspaceId: WORKSPACE_ID,
    name: "Eva Moren",
    email: "eva@brand.co",
    role: "viewer",
  },
];

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export const projects: Project[] = [
  {
    id: "proj_auralee",
    workspaceId: WORKSPACE_ID,
    name: "AURALEE Launch Alignment",
    oneLineObjective:
      "Coordinate cross-functional readiness for the AURALEE SS25 campaign launch.",
    projectLeadId: "mem_alice",
    targetStartDate: daysAgo(30),
    targetEndDate: daysFromNow(14),
  },
  {
    id: "proj_collab",
    workspaceId: WORKSPACE_ID,
    name: "Cultural Collaboration",
    oneLineObjective:
      "Build and activate partnerships with cultural tastemakers to extend brand reach.",
    projectLeadId: "mem_ben",
    targetStartDate: daysAgo(14),
    targetEndDate: daysFromNow(45),
  },
  {
    id: "proj_brand",
    workspaceId: WORKSPACE_ID,
    name: "Brand Strategy Presentation",
    oneLineObjective:
      "Deliver a comprehensive brand strategy deck for Q3 leadership review.",
    projectLeadId: "mem_cara",
    targetStartDate: daysAgo(7),
    targetEndDate: daysFromNow(7),
  },
];

// ---------------------------------------------------------------------------
// Workstreams
// ---------------------------------------------------------------------------

export const workstreams: Workstream[] = [
  // AURALEE Launch Alignment
  { id: "ws_auralee_creative", projectId: "proj_auralee", name: "Creative Assets", order: 1 },
  { id: "ws_auralee_media",    projectId: "proj_auralee", name: "Media & PR",       order: 2 },
  { id: "ws_auralee_digital",  projectId: "proj_auralee", name: "Digital Channels", order: 3 },

  // Cultural Collaboration
  { id: "ws_collab_id",        projectId: "proj_collab",  name: "Partner Identification", order: 1 },
  { id: "ws_collab_ops",       projectId: "proj_collab",  name: "Collaboration Ops",      order: 2 },

  // Brand Strategy Presentation
  { id: "ws_brand_research",   projectId: "proj_brand",   name: "Research & Insights",    order: 1 },
  { id: "ws_brand_deck",       projectId: "proj_brand",   name: "Deck Production",        order: 2 },
  { id: "ws_brand_review",     projectId: "proj_brand",   name: "Review & Sign-off",      order: 3 },
];

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

export const tasks: Task[] = [
  // ── AURALEE Launch Alignment ─────────────────────────────────────────────

  // InProgress — My Focus (assigned to alice)
  {
    id: "task_001",
    workspaceId: WORKSPACE_ID,
    projectId: "proj_auralee",
    workstreamId: "ws_auralee_creative",
    title: "Finalise campaign hero imagery selection",
    description: "Narrow shortlist from studio shoot to 3 hero images for final approval.",
    status: "InProgress",
    assigneeId: "mem_alice",
    reviewerId: "mem_ben",
    startDate: daysAgo(2),
    dueDate: daysFromNow(2),
    version: 1,
    createdBy: "mem_alice",
    createdAt: daysAgo(10),
    updatedAt: daysAgo(1),
    completedAt: null,
    cancelledAt: null,
  },
  {
    id: "task_002",
    workspaceId: WORKSPACE_ID,
    projectId: "proj_auralee",
    workstreamId: "ws_auralee_media",
    title: "Brief PR agency on launch narrative",
    description: "Share brand story framework and key messages for the AURALEE SS25 story.",
    status: "InProgress",
    assigneeId: "mem_alice",
    reviewerId: null,
    startDate: daysAgo(1),
    dueDate: daysFromNow(3),
    version: 2,
    createdBy: "mem_alice",
    createdAt: daysAgo(8),
    updatedAt: daysAgo(1),
    completedAt: null,
    cancelledAt: null,
  },

  // Review — My Focus (assigned to alice)
  {
    id: "task_003",
    workspaceId: WORKSPACE_ID,
    projectId: "proj_auralee",
    workstreamId: "ws_auralee_digital",
    title: "Review paid social ad copy v2",
    description: "Second-pass review of Instagram and TikTok ad copy variations.",
    status: "Review",
    assigneeId: "mem_alice",
    reviewerId: "mem_cara",
    startDate: daysAgo(4),
    dueDate: daysFromNow(1),
    version: 2,
    createdBy: "mem_ben",
    createdAt: daysAgo(6),
    updatedAt: daysAgo(1),
    completedAt: null,
    cancelledAt: null,
  },

  // Waiting
  {
    id: "task_004",
    workspaceId: WORKSPACE_ID,
    projectId: "proj_auralee",
    workstreamId: "ws_auralee_media",
    title: "Await press embargo confirmation from AURALEE HQ",
    description: "Hold outreach until embargo date confirmed by the brand.",
    status: "Waiting",
    assigneeId: "mem_ben",
    reviewerId: null,
    startDate: null,
    dueDate: daysFromNow(5),
    version: 1,
    createdBy: "mem_alice",
    createdAt: daysAgo(5),
    updatedAt: daysAgo(2),
    completedAt: null,
    cancelledAt: null,
  },

  // ToDo with startDate within 7 days — Coming Next
  {
    id: "task_005",
    workspaceId: WORKSPACE_ID,
    projectId: "proj_auralee",
    workstreamId: "ws_auralee_digital",
    title: "Schedule launch-day Instagram grid posts",
    description: "Upload approved assets to Later and schedule for drop day.",
    status: "ToDo",
    assigneeId: "mem_dan",
    reviewerId: "mem_alice",
    startDate: daysFromNow(3),
    dueDate: daysFromNow(6),
    version: 1,
    createdBy: "mem_alice",
    createdAt: daysAgo(3),
    updatedAt: daysAgo(1),
    completedAt: null,
    cancelledAt: null,
  },

  // Overdue (past dueDate, not Done)
  {
    id: "task_006",
    workspaceId: WORKSPACE_ID,
    projectId: "proj_auralee",
    workstreamId: "ws_auralee_creative",
    title: "Submit retouching brief to studio",
    description: "Provide precise retouching notes so studio can deliver finals.",
    status: "InProgress",
    assigneeId: "mem_cara",
    reviewerId: null,
    startDate: daysAgo(10),
    dueDate: daysAgo(3),
    version: 3,
    createdBy: "mem_alice",
    createdAt: daysAgo(14),
    updatedAt: daysAgo(1),
    completedAt: null,
    cancelledAt: null,
  },

  // Backlog — ToDo, no startDate
  {
    id: "task_007",
    workspaceId: WORKSPACE_ID,
    projectId: "proj_auralee",
    workstreamId: "ws_auralee_media",
    title: "Draft journalist gifting list for launch",
    description: "Curate top-tier fashion and lifestyle journalists for product gifting.",
    status: "ToDo",
    assigneeId: "mem_ben",
    reviewerId: null,
    startDate: null,
    dueDate: null,
    version: 1,
    createdBy: "mem_alice",
    createdAt: daysAgo(7),
    updatedAt: daysAgo(7),
    completedAt: null,
    cancelledAt: null,
  },

  // Done
  {
    id: "task_008",
    workspaceId: WORKSPACE_ID,
    projectId: "proj_auralee",
    workstreamId: "ws_auralee_creative",
    title: "Produce campaign mood board",
    description: "Reference mood board for studio shoot art direction.",
    status: "Done",
    assigneeId: "mem_alice",
    reviewerId: "mem_ben",
    startDate: daysAgo(20),
    dueDate: daysAgo(15),
    version: 4,
    createdBy: "mem_alice",
    createdAt: daysAgo(25),
    updatedAt: daysAgo(15),
    completedAt: daysAgo(15),
    cancelledAt: null,
  },

  // Inbox
  {
    id: "task_009",
    workspaceId: WORKSPACE_ID,
    projectId: "proj_auralee",
    workstreamId: null,
    title: "Clarify launch timeline with AURALEE EU team",
    description: null,
    status: "Inbox",
    assigneeId: null,
    reviewerId: null,
    startDate: null,
    dueDate: null,
    version: 1,
    createdBy: "mem_eva",
    createdAt: NOW,
    updatedAt: NOW,
    completedAt: null,
    cancelledAt: null,
  },

  // ── Cultural Collaboration ────────────────────────────────────────────────

  // InProgress — My Focus (assigned to ben)
  {
    id: "task_010",
    workspaceId: WORKSPACE_ID,
    projectId: "proj_collab",
    workstreamId: "ws_collab_id",
    title: "Research Tokyo micro-influencer landscape",
    description: "Identify 20 potential cultural partners in the Tokyo fashion scene.",
    status: "InProgress",
    assigneeId: "mem_ben",
    reviewerId: "mem_alice",
    startDate: daysAgo(3),
    dueDate: daysFromNow(4),
    version: 1,
    createdBy: "mem_ben",
    createdAt: daysAgo(7),
    updatedAt: daysAgo(1),
    completedAt: null,
    cancelledAt: null,
  },

  // Review
  {
    id: "task_011",
    workspaceId: WORKSPACE_ID,
    projectId: "proj_collab",
    workstreamId: "ws_collab_ops",
    title: "Review collab agreement template v1",
    description: "Legal and brand alignment check on the collaboration contract template.",
    status: "Review",
    assigneeId: "mem_ben",
    reviewerId: "mem_alice",
    startDate: daysAgo(2),
    dueDate: daysFromNow(2),
    version: 1,
    createdBy: "mem_alice",
    createdAt: daysAgo(5),
    updatedAt: daysAgo(1),
    completedAt: null,
    cancelledAt: null,
  },

  // Waiting
  {
    id: "task_012",
    workspaceId: WORKSPACE_ID,
    projectId: "proj_collab",
    workstreamId: "ws_collab_ops",
    title: "Await counter-signature from Studio Abroad",
    description: "Partnership agreement sent, pending their counter-signature.",
    status: "Waiting",
    assigneeId: "mem_cara",
    reviewerId: null,
    startDate: null,
    dueDate: daysFromNow(10),
    version: 1,
    createdBy: "mem_ben",
    createdAt: daysAgo(4),
    updatedAt: daysAgo(2),
    completedAt: null,
    cancelledAt: null,
  },

  // Overdue (past dueDate, not Done)
  {
    id: "task_013",
    workspaceId: WORKSPACE_ID,
    projectId: "proj_collab",
    workstreamId: "ws_collab_id",
    title: "Compile shortlist of Seoul creatives for SS26",
    description: "Build a ranked shortlist with audience data and fit notes.",
    status: "ToDo",
    assigneeId: "mem_dan",
    reviewerId: null,
    startDate: daysAgo(14),
    dueDate: daysAgo(2),
    version: 1,
    createdBy: "mem_ben",
    createdAt: daysAgo(14),
    updatedAt: daysAgo(14),
    completedAt: null,
    cancelledAt: null,
  },

  // Coming Next (ToDo, startDate within 7 days)
  {
    id: "task_014",
    workspaceId: WORKSPACE_ID,
    projectId: "proj_collab",
    workstreamId: "ws_collab_ops",
    title: "Send welcome packs to confirmed partners",
    description: "Dispatch brand welcome kits and briefing docs to confirmed collaborators.",
    status: "ToDo",
    assigneeId: "mem_cara",
    reviewerId: "mem_ben",
    startDate: daysFromNow(2),
    dueDate: daysFromNow(5),
    version: 1,
    createdBy: "mem_ben",
    createdAt: daysAgo(3),
    updatedAt: daysAgo(1),
    completedAt: null,
    cancelledAt: null,
  },

  // Backlog
  {
    id: "task_015",
    workspaceId: WORKSPACE_ID,
    projectId: "proj_collab",
    workstreamId: "ws_collab_id",
    title: "Map cultural event calendar for H2",
    description: "Identify fashion weeks, art fairs, and cultural moments for activation.",
    status: "ToDo",
    assigneeId: null,
    reviewerId: null,
    startDate: null,
    dueDate: null,
    version: 1,
    createdBy: "mem_ben",
    createdAt: daysAgo(6),
    updatedAt: daysAgo(6),
    completedAt: null,
    cancelledAt: null,
  },

  // Done
  {
    id: "task_016",
    workspaceId: WORKSPACE_ID,
    projectId: "proj_collab",
    workstreamId: "ws_collab_id",
    title: "Define cultural partner criteria",
    description: "Establish minimum reach, aesthetic fit, and exclusivity criteria.",
    status: "Done",
    assigneeId: "mem_ben",
    reviewerId: "mem_alice",
    startDate: daysAgo(20),
    dueDate: daysAgo(14),
    version: 2,
    createdBy: "mem_alice",
    createdAt: daysAgo(22),
    updatedAt: daysAgo(14),
    completedAt: daysAgo(14),
    cancelledAt: null,
  },

  // Inbox
  {
    id: "task_017",
    workspaceId: WORKSPACE_ID,
    projectId: "proj_collab",
    workstreamId: null,
    title: "Follow up on inbound collab inquiry from Comme Archive",
    description: null,
    status: "Inbox",
    assigneeId: null,
    reviewerId: null,
    startDate: null,
    dueDate: null,
    version: 1,
    createdBy: "mem_eva",
    createdAt: NOW,
    updatedAt: NOW,
    completedAt: null,
    cancelledAt: null,
  },

  // ── Brand Strategy Presentation ──────────────────────────────────────────

  // InProgress — My Focus (assigned to cara)
  {
    id: "task_018",
    workspaceId: WORKSPACE_ID,
    projectId: "proj_brand",
    workstreamId: "ws_brand_deck",
    title: "Build brand positioning slide chapter",
    description: "Translate research insights into a compelling 5-slide positioning story.",
    status: "InProgress",
    assigneeId: "mem_cara",
    reviewerId: "mem_alice",
    startDate: daysAgo(1),
    dueDate: daysFromNow(3),
    version: 2,
    createdBy: "mem_cara",
    createdAt: daysAgo(4),
    updatedAt: daysAgo(1),
    completedAt: null,
    cancelledAt: null,
  },

  // Review — My Focus
  {
    id: "task_019",
    workspaceId: WORKSPACE_ID,
    projectId: "proj_brand",
    workstreamId: "ws_brand_research",
    title: "Review competitor audit findings",
    description: "Validate methodology and key takeaways in the competitor landscape audit.",
    status: "Review",
    assigneeId: "mem_cara",
    reviewerId: "mem_alice",
    startDate: daysAgo(3),
    dueDate: daysFromNow(1),
    version: 1,
    createdBy: "mem_alice",
    createdAt: daysAgo(5),
    updatedAt: daysAgo(1),
    completedAt: null,
    cancelledAt: null,
  },

  // Waiting
  {
    id: "task_020",
    workspaceId: WORKSPACE_ID,
    projectId: "proj_brand",
    workstreamId: "ws_brand_review",
    title: "Await CMO feedback on deck structure",
    description: "Deck outline shared with CMO; blocked on structural feedback before full build.",
    status: "Waiting",
    assigneeId: "mem_alice",
    reviewerId: null,
    startDate: null,
    dueDate: daysFromNow(2),
    version: 1,
    createdBy: "mem_cara",
    createdAt: daysAgo(2),
    updatedAt: daysAgo(1),
    completedAt: null,
    cancelledAt: null,
  },

  // Overdue
  {
    id: "task_021",
    workspaceId: WORKSPACE_ID,
    projectId: "proj_brand",
    workstreamId: "ws_brand_research",
    title: "Synthesise consumer survey responses",
    description: "Distil 800 survey responses into 5 actionable consumer insights.",
    status: "InProgress",
    assigneeId: "mem_dan",
    reviewerId: "mem_cara",
    startDate: daysAgo(10),
    dueDate: daysAgo(4),
    version: 2,
    createdBy: "mem_cara",
    createdAt: daysAgo(12),
    updatedAt: daysAgo(3),
    completedAt: null,
    cancelledAt: null,
  },

  // Coming Next
  {
    id: "task_022",
    workspaceId: WORKSPACE_ID,
    projectId: "proj_brand",
    workstreamId: "ws_brand_deck",
    title: "Apply brand system to all deck slides",
    description: "Ensure typography, colour, and grid consistency across every slide.",
    status: "ToDo",
    assigneeId: "mem_dan",
    reviewerId: "mem_cara",
    startDate: daysFromNow(1),
    dueDate: daysFromNow(5),
    version: 1,
    createdBy: "mem_cara",
    createdAt: daysAgo(2),
    updatedAt: daysAgo(1),
    completedAt: null,
    cancelledAt: null,
  },

  // Backlog
  {
    id: "task_023",
    workspaceId: WORKSPACE_ID,
    projectId: "proj_brand",
    workstreamId: "ws_brand_deck",
    title: "Create appendix slide set for detailed data",
    description: "Supporting appendix with raw data tables and methodology for exec questions.",
    status: "ToDo",
    assigneeId: null,
    reviewerId: null,
    startDate: null,
    dueDate: null,
    version: 1,
    createdBy: "mem_cara",
    createdAt: daysAgo(1),
    updatedAt: daysAgo(1),
    completedAt: null,
    cancelledAt: null,
  },

  // Done
  {
    id: "task_024",
    workspaceId: WORKSPACE_ID,
    projectId: "proj_brand",
    workstreamId: "ws_brand_research",
    title: "Complete brand perception desk research",
    description: "Secondary research summary covering category trends and brand sentiment.",
    status: "Done",
    assigneeId: "mem_dan",
    reviewerId: "mem_cara",
    startDate: daysAgo(14),
    dueDate: daysAgo(8),
    version: 3,
    createdBy: "mem_cara",
    createdAt: daysAgo(16),
    updatedAt: daysAgo(8),
    completedAt: daysAgo(8),
    cancelledAt: null,
  },

  // Inbox
  {
    id: "task_025",
    workspaceId: WORKSPACE_ID,
    projectId: "proj_brand",
    workstreamId: null,
    title: "Add FY25 revenue context slide to deck",
    description: null,
    status: "Inbox",
    assigneeId: null,
    reviewerId: null,
    startDate: null,
    dueDate: null,
    version: 1,
    createdBy: "mem_eva",
    createdAt: NOW,
    updatedAt: NOW,
    completedAt: null,
    cancelledAt: null,
  },
];

// ---------------------------------------------------------------------------
// mockDb — convenience helper for component-level queries
// ---------------------------------------------------------------------------

export const mockDb = {
  members,
  projects,
  workstreams,
  tasks,

  getMemberById: (id: string): Member | undefined =>
    members.find((m) => m.id === id),

  getProjectById: (id: string): Project | undefined =>
    projects.find((p) => p.id === id),

  getWorkstreamsByProject: (projectId: string): Workstream[] =>
    workstreams.filter((ws) => ws.projectId === projectId),

  getTasksByProject: (projectId: string): Task[] =>
    tasks.filter((t) => t.projectId === projectId),

  getTasksByStatus: (status: TaskStatus): Task[] =>
    tasks.filter((t) => t.status === status),

  getTasksByAssignee: (assigneeId: string): Task[] =>
    tasks.filter((t) => t.assigneeId === assigneeId),

  /** My Focus: InProgress or Review tasks assigned to a given member */
  getMyFocusTasks: (assigneeId: string): Task[] =>
    tasks.filter(
      (t) =>
        t.assigneeId === assigneeId &&
        (t.status === "InProgress" || t.status === "Review"),
    ),

  /** Coming Next: ToDo tasks with a startDate in the next 7 days */
  getComingNextTasks: (): Task[] => {
    const now = Date.now();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    return tasks.filter(
      (t) =>
        t.status === "ToDo" &&
        t.startDate !== null &&
        new Date(t.startDate).getTime() > now &&
        new Date(t.startDate).getTime() <= now + sevenDays,
    );
  },

  /** Overdue: any non-Done task with a dueDate in the past */
  getOverdueTasks: (): Task[] => {
    const now = Date.now();
    return tasks.filter(
      (t) =>
        t.status !== "Done" &&
        t.status !== "Inbox" &&
        t.dueDate !== null &&
        new Date(t.dueDate).getTime() < now,
    );
  },

  /** Backlog: ToDo tasks with no startDate */
  getBacklogTasks: (): Task[] =>
    tasks.filter((t) => t.status === "ToDo" && t.startDate === null),
};
