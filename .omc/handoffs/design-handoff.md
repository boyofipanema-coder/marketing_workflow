# Design Handoff → build session

> These changes are **already on disk in this same working directory**
> (`app/…`). This is not a branch to merge — the files are shared. Your job is
> to (1) re-read the files below before editing any of them so you don't clobber
> them with a stale in-memory version, and (2) follow the design system for all
> new UI. Everything here typechecks (`tsc` 0 errors) and passes tests (110/110).

## How to pick this up (in the build session)
1. Read **`app/DESIGN_SYSTEM.md`** — the constitution. All UI must use it.
2. Before touching any file in the manifest, **Read it first** (it may already
   contain this work). Never regenerate a listed file from memory.
3. Run the new DB migration when you next apply migrations (see below).
4. Keep the rules at the bottom. They prevent the build from drifting back into
   generic/ad-hoc styling and from breaking on the new schema column.

## Manifest — what changed / was added (all under `app/`)

### 1. Apple design-system foundation
- `src/styles/globals.css` — token layer (light+dark, Apple status colors, materials, motion, a11y).
- `tailwind.config.ts` — maps tokens → utilities; adds opacity steps 8/12/15/18; **`content` includes `./src/lib/**`** (status.ts holds class strings).
- `src/lib/utils.ts` — `cn()` class-merge helper.
- `src/lib/motion.ts` — Apple spring constants + `project()`/`rubberband()`.
- `src/lib/status.ts` — task status/flag vocabulary (single source of truth; matches the DB enum).
- `src/components/ui/{button,card,badge,status-badge,input,index}.tsx` — primitives; import from `@/components/ui`.
- `src/app/layout.tsx` — SF + Korean font stack, theme-color, dark support.
- `DESIGN_SYSTEM.md` — the rulebook.

### 2. Existing UI migrated to tokens (no default palettes remain)
- `src/components/{NavBar,QuickAdd,TaskCard,SectionList,EmptyState,TaskDetailPanel}.tsx`
- `src/app/(app)/layout.tsx` + all screens: `(auth)/login`, `(app)/{home,my-work,projects,team,calendar}`, `projects/[projectId]/ProjectWorkspace.tsx`
- NavBar is now translucent `.material-chrome`; TaskDetailPanel is `.material-panel`.

### 3. Workflow board (Project → Workflow tab)
- `src/components/workflow/WorkflowCanvas.tsx` — pannable/zoomable swimlane Kanban: Group-by (Workstream/Owner/Due), status-stage columns, "+N more" per cell, **inline subtask expand (arbitrary depth) + progress rollup**, inline "+ Add subtask" composer.
- `ProjectWorkspace.tsx` — the `workflow` tab renders `<WorkflowCanvas>`; old Do-Now/Waiting/Coming-Next card lists were removed. Tasks/Milestones tabs unchanged.

### 4. Task hierarchy (schema + services)
- `src/server/db/schema.ts` — nullable self-ref **`parent_task_id`** on `task` + `parent`/`subtasks` relations.
- `drizzle/migrations/0001_add_parent_task_id.sql` — `ALTER TABLE task ADD parent_task_id text REFERENCES task(id)`. **Apply it** (`npm run db:migrate` / your D1 apply step).
- **`scripts/seed-db.ts` — the canonical seed** (`npm run db:seed` runs this). Its `taskInsert` now has an optional trailing `parentTaskId` and emits `parent_task_id`; demo subtasks added under `task_p1_03` (one nested level). Already applied to local D1 (5 subtask rows live). Note: task inserts already use `ON CONFLICT (id) DO NOTHING`, so re-seeding is safe (no PK crash) — no reset needed.
- `src/server/db/seed.ts` — ALSO has the demo subtasks, but it is **not imported anywhere** (dead/duplicate of the SQL-gen script). ⚠️ Two seed sources diverge — someone should consolidate to one. I kept both in sync (both have the subtasks) meanwhile.
- `src/server/services/task.ts` — `createSubtask(db,{parentId,title,memberId})`.
- `src/app/actions/tasks.ts` — `createSubtaskAction(parentTaskId, title)`.
- Test DDL/fixtures updated: `services/__tests__/integration.test.ts` (inline `task` DDL got `parent_task_id`), and `parent_task_id: null` added to `makeTask` in derive/search/task/integration tests.

## Rules to keep (do not undo)
- **No default palettes** (`zinc/slate/gray/sky/amber/emerald/red-*`), no raw hex, no arbitrary `[…]` visual values. Use semantic utilities (`bg-surface`, `text-text-secondary`, `bg-accent`, `text-status-*`, `bg-flag-*`, `shadow-sm/md/lg`, `rounded-xl`).
- **Task status** only via `<StatusBadge>` / `lib/status.ts`.
- **`Task` now has `parent_task_id: string | null`** — every full `Task` object literal must include it. New task-create paths should accept an optional `parent_task_id`.
- Don't reintroduce the removed Do-Now/Waiting/Coming-Next lists for the workflow tab.
- Keep `tailwind.config.ts`'s `content: ./src/lib/**` and the `opacity` 8/12/15/18 steps.

## Cleanup task for the build session (please do)
There are **two divergent seed sources** — consolidate to one:
- `app/scripts/seed-db.ts` — **canonical** (what `npm run db:seed` runs). Now has `parent_task_id` support + demo subtasks under `task_p1_03`. Emits SQL for `wrangler d1 execute`.
- `app/src/server/db/seed.ts` — Drizzle-based, **imported nowhere** (dead). Also has the subtasks (kept in sync for now).

Pick ONE and remove the drift:
- If you keep the SQL-gen approach → **delete `src/server/db/seed.ts`** (or repurpose it as a programmatic seeder used only by tests, importing shared data).
- If you prefer a programmatic seeder → make `scripts/seed-db.ts` import the task list from `src/server/db/seed.ts` so there's a single data source.
- Either way: a `Task` seed row must set `parent_task_id`; task inserts already use `ON CONFLICT (id) DO NOTHING` (idempotent, no reset needed).

## Still open (future, safe to build on top)
- Finish-to-start dependency edges (M3) — the canvas draws in-lane pipeline connectors now and is built to accept real edges.
- Cross-project "All work" portfolio view (separate screen; brand/owner grouping). Interactive prototype of both: Artifact "Workflow Canvas".
