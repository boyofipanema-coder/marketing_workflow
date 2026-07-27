# Main-based post-audit UI plan

Status: **approved and implemented locally**

Baseline: `main@2eaf848d28e05ab7997ec18e97cbc82d8d1dd940`

## 1. Scope and evidence boundary

This plan supersedes the earlier mixed-baseline version.

- Canonical source is the committed `main` snapshot above.
- The desktop Home hierarchy is already implemented in
  `app/src/components/workflow/StackedWorkflowBoard.tsx:318-455`.
- Current uncommitted mobile files are user-owned drafts, not evidence of
  completed main behavior. Execution must inspect and preserve them, but may
  reuse only the parts that match this plan.
- The current Cloudflare deployment was used for route validation because its
  visible behavior matches main. Cloudflare records its source as `Unknown`, so
  committed code remains the source of truth.
- Source implementation and one local commit were authorized. Deployment and
  push remain outside this execution.

## 2. Approved requirements

### Apply

1. Remove visible `진행/예정/대기/검토` classification from the remaining
   project-detail and Team surfaces.
2. Keep the desktop project detail as a horizontal spatial canvas, but organize
   its columns by work hierarchy rather than task status.
3. Keep mobile project detail on the committed task-list experience.
4. Make mobile Home organization-first, followed by the existing personal-work
   section.
5. Normalize the visible typography, border, elevation, color, focus, and press
   hierarchy using the committed design-system tokens.

### Keep current

1. Desktop Home keeps its existing
   `brand → project → primary task → subtask` board.
2. Desktop Home keeps all current empty projects, ordering, density, and
   expanded presentation.
3. My Work keeps its current sorting, rows, and copy, including the previously
   accepted mismatch between “긴급도 순” and the final `sort_order` rendering.
4. Team keeps its three member cards, four metric tiles, and nested task rows.
   Only status-dependent content inside that structure changes.
5. Task detail keeps the committed fixed desktop height:
   `sm:h-[min(720px,calc(100dvh-2rem))]`.
6. Comment sidecar keeps its 360px non-modal interaction, quick input, mention
   buttons, notification-read behavior, and author-only deletion.

## 3. Product rules

- Visible work structure is
  `brand → project → workstream → task → subtask`.
- `Done`, cancellation, due date, overdue, milestone, dependency, assignee, and
  unread-comment count remain valid operational facts.
- Persisted `Inbox`, `Todo`, `InProgress`, `Waiting`, and `Review` values remain
  for compatibility but are presented uniformly as open work.
- No database schema or data migration is required.
- Color is reserved for brand identity, overdue attention, selection/focus,
  completion, and unread comments. Legacy status colors are not used on changed
  user-facing surfaces.

## 4. Implementation plan

### Phase 0 — Protect the baseline and user drafts

1. Record `git status`, `git diff --stat`, and the current branch before edits.
2. Compare each touched file with `main@2eaf848`; do not reset, checkout, or
   overwrite unrelated uncommitted work.
3. Treat these current local files as optional drafts, not canonical
   implementations:
   - `app/src/components/workflow/MobileFlowSpine.tsx`
   - `app/src/components/workflow/MobileWorkflowOverview.tsx`
   - `app/src/lib/workflow-summary.ts`
   - `app/src/lib/__tests__/workflow-summary.test.ts`
4. Preserve only draft code that satisfies the acceptance criteria below.
   Prefer adapting an existing draft over creating a second component.

### Phase 1 — Remove status ontology from project summary

Files:

- `app/src/components/projects/ProjectPulse.tsx:41-125`
- `app/src/app/(app)/projects/[projectId]/ProjectWorkspace.tsx:226-282`

Changes:

1. Replace `진행 중`, `대기`, and `검토 중` counts with:
   - open work;
   - completed work;
   - overdue work;
   - next milestone when present.
2. Define open work as non-cancelled and not `Done`; do not enumerate legacy
   open statuses.
3. Change the summary `aria-label` from progression wording to neutral project
   work wording.
4. Replace `do/wait` focus callbacks with status-neutral filters:
   - all;
   - due soon;
   - overdue;
   - completed-work visibility.
5. Define due soon as an incomplete, non-overdue task due from today through
   seven KST calendar days from today.
6. Remove empty-state copy that promises “진행 단계”.

### Phase 2 — Reuse the horizontal project canvas with hierarchy columns

Files:

- `app/src/components/workflow/WorkflowCanvas.tsx:45-80`
- `app/src/components/workflow/WorkflowCanvas.tsx:520-550`
- `app/src/components/workflow/WorkflowCanvas.tsx:950-1075`
- `app/src/components/workflow/WorkflowCanvas.tsx:1165-1207`
- `app/src/components/workflow/WorkflowCanvas.tsx:1330-1405`
- `app/src/components/workflow/__tests__/WorkflowCanvas.geometry.test.ts`

Changes:

1. Keep the existing horizontal internal-scroll viewport, workstream bands,
   task cards, task/subtask connectors, dependency connectors, and milestone
   rails.
2. Remove regular status-stage placement and use hierarchy placement for the
   project-detail canvas:
   - `주요업무`;
   - `하위업무`.
3. Do not introduce a vertical project flow or a second canvas component.
4. Keep workstreams as the row/band axis.
5. Replace `Focus = all/do/wait/over` with the status-neutral focus contract
   from Phase 1.
6. Remove from task cards:
   - status-colored top stripe;
   - waiting dashed border;
   - status pill and dot;
   - waiting-party status copy.
7. Keep on task cards:
   - title;
   - hierarchy/parent context;
   - assignee;
   - due date and overdue warning;
   - completion control;
   - key-work importance;
   - action menu;
   - comment trigger and unread count where already available.
8. Completed work remains reachable through a completed-work control and must
   not become a colored lane.
9. Reuse the existing graph and geometry functions. Add only the minimum mode
   switch required to make project detail use hierarchy columns.

### Phase 3 — Preserve the committed mobile project list

File:

- `app/src/app/(app)/projects/[projectId]/ProjectWorkspace.tsx:83-90`
- `app/src/app/(app)/projects/[projectId]/ProjectWorkspace.tsx:309-330`

Changes:

1. Retain the committed narrow-screen behavior that selects the `tasks` tab.
2. Do not mount `MobileFlowSpine` on a project-detail route.
3. Keep existing TaskList ordering, completion, task detail, comment sidecar,
   and quick-add behavior.
4. Remove project-detail-only imports, props, local filters, and summary logic
   introduced by the uncommitted mobile draft.

### Phase 4 — Add the organization-first mobile Home

Files:

- `app/src/app/(app)/home/page.tsx`
- `app/src/components/HomeContent.tsx:189-370`
- optional reuse:
  `app/src/components/workflow/MobileWorkflowOverview.tsx`
- optional reuse:
  `app/src/lib/workflow-summary.ts`

Composition:

```text
전체 업무 흐름
브랜드 N · 프로젝트 N · 열린 업무 N

브랜드
└ 프로젝트 · 열린 업무 · 기한 초과 · 새 댓글 · 다음 일정

내 업무
└ 기존 개인 업무 목록
```

Changes:

1. Desktop Home continues mounting the committed `StackedWorkflowBoard`
   unchanged.
2. Mobile Home shows a compact organization overview before personal work.
3. Derive it from brands, projects, tasks, workstreams, notifications, and KST
   date data already available to Home. Add no backend endpoint or dependency.
4. Project rows show:
   - project name;
   - open-work count;
   - overdue count only when greater than zero;
   - next milestone or target date when available;
   - unread project-comment count when greater than zero.
5. Do not show `진행/예정/대기/검토` counts, filters, badges, or colors.
6. Allow at most one expanded project at a time.
7. Expanded work uses title, nesting, assignee, due date, completion, and
   unread-comment count only.
8. Keep the personal TaskSection below the overview without changing its
   sorting, rows, or copy.
9. If the current uncommitted `MobileWorkflowOverview` already covers this,
   simplify and reuse it rather than building another component.

### Phase 5 — Keep Team layout and remove status-dependent content

Files:

- `app/src/components/team/TeamOverview.tsx:35-101`
- `app/src/lib/workload.ts:24`
- `app/src/lib/__tests__/workload.test.ts`

Changes:

1. Preserve the three-column member cards, four metric tiles, member order,
   card heights, and task-row shell.
2. Replace the `대기` tile with `완료`.
3. Add a completed count to the existing `memberWorkload` result; do not add a
   new workload service.
4. Remove task `StatusBadge`/pip from Team rows.
5. Keep brand, project, task title, and due date.
6. Update the Team introduction so it names the retained metrics and no longer
   promises waiting counts.

### Phase 6 — Apply the restrained design-system compliance pass

References:

- `app/DESIGN_SYSTEM.md:14-27`
- `app/DESIGN_SYSTEM.md:65-97`
- `app/DESIGN_SYSTEM.md:162-182`
- `app/src/styles/globals.css`

Files with known drift:

- `app/src/components/HomeContent.tsx:227-235`
- `app/src/components/team/TeamOverview.tsx:52-90`
- `app/src/components/tasks/CommentThread.tsx:95-155`
- changed sections of `WorkflowCanvas.tsx`

Changes:

1. Raise desktop Home’s page heading from arbitrary 15px to `text-xl` while
   keeping its controls and board position unchanged.
2. Replace essential 9/10px metadata on changed surfaces with existing
   `text-2xs` or `text-xs`.
3. Use `text-text-secondary` rather than low-contrast tertiary/quaternary color
   for essential 11px information.
4. Use the documented radius and shadow scale on changed elements. Do not run a
   repository-wide mechanical class rewrite.
5. Static groups use separators and surface contrast; elevation remains for
   menus, sidecars, dialogs, and genuinely floating UI.
6. Preserve or add visible `focus-visible` treatment and pressed feedback on
   changed controls.
7. Preserve current 32px minimum design-system hit targets and existing larger
   mobile completion/detail targets.
8. Do not add a font, icon dependency, Bento layout, texture overlay, marquee,
   parallax, gradient headline, or scroll-reveal system.
9. Do not change the task-detail height or comment-sidecar dimensions and
   interaction.

### Phase 7 — Remove dead draft paths and confirm compatibility

1. Remove only draft imports, props, filters, or helper fields made unused by
   the approved composition.
2. Keep persisted status types, migrations, server actions, and
   `app/src/lib/status.ts` for compatibility.
3. Search user-visible copy on changed project, Team, and mobile Home surfaces
   for `진행 중`, `예정`, `대기`, and `검토`.
4. Do not mechanically delete compatibility code solely because it contains a
   legacy status string.

## 5. Acceptance criteria

1. Desktop Home still displays the committed
   `브랜드 / 프로젝트 / 주요업무 / 하위업무` board with the same project
   ordering, empty-project presentation, and density.
2. Desktop project detail remains a horizontal internally scrollable canvas.
3. Project-detail columns are work hierarchy, not
   `진행/예정/대기/검토/완료` status lanes.
4. Workstream bands, task relationships, dependencies, milestones, completion,
   task detail, actions, and comments remain functional.
5. Every non-cancelled legacy open status is displayed uniformly as open work.
6. `Done` work is reachable through completion visibility but is not a colored
   canvas lane.
7. Project summary and filters contain no visible `진행/예정/대기/검토`
   classification.
8. Mobile project detail opens the existing TaskList and does not mount
   `MobileFlowSpine`.
9. Mobile Home begins with an H1 organization overview and places the existing
   personal-work section below it.
10. Mobile Home project rows use only open work, overdue, schedule, and unread
    comment facts.
11. Team retains the approved member-card and metric-tile layout, replaces
    waiting with completed count, and removes task status pips.
12. My Work ordering, row contents, and copy remain unchanged.
13. Task detail retains its committed 720px desktop maximum behavior.
14. Comment sidecar remains 360px wide where the viewport permits, supports
    quick comment entry, and retains unread/read and author-only deletion
    behavior.
15. Essential changed metadata is at least 11px and uses sufficient semantic
    text contrast.
16. At 1440×1000 and 390×844, changed routes have no document-level horizontal
    overflow. The desktop project canvas may scroll inside its own viewport.
17. Changed controls are keyboard reachable, have visible focus indication,
    and retain at least 32×32px hit targets.
18. Light and dark modes render without missing text, illegible state, or
    console error.
19. No database migration or new runtime dependency is added.
20. `npm run typecheck`, `npm test`, and `npm run build` pass from `app/`.

## 6. Verification

### Automated

1. Extend `WorkflowCanvas.geometry.test.ts` for:
   - root-task hierarchy placement;
   - nested-task placement;
   - empty workstreams;
   - completed-work visibility.
2. Extend `workload.test.ts` for completed count and legacy open statuses.
3. If a workflow-summary helper remains, keep one focused test proving all
   legacy non-done statuses receive identical visible treatment.
4. Run:

```sh
npm run typecheck
npm test
npm run build
```

### Route checks

At desktop 1440×1000 and mobile 390×844, verify:

- `/home`
- `/my-work`
- `/team`
- `/projects/<active-project-id>`

For Home, Team, and project detail, repeat in light and dark modes.

### Interaction checks

1. Open, edit, save, close, and reopen a task.
2. Complete and restore a task.
3. Open a task and project comment sidecar.
4. Add a comment, observe unread count, open as another member, and confirm
   read clearance.
5. Confirm only the author can see and complete comment deletion.
6. Validate one fixture for each legacy open status.
7. Compare screenshots against main for:
   - unchanged desktop Home structure and density;
   - unchanged Team shell;
   - unchanged task-detail size;
   - unchanged comment-sidecar size;
   - preserved horizontal project-canvas behavior.

## 7. Risks and mitigations

### Hierarchy conversion disturbs canvas geometry

Reuse the existing graph/geometry path and gate the change with focused geometry
tests before visual cleanup.

### Legacy statuses disappear unintentionally

Define open work as non-`Done` and non-cancelled instead of listing accepted
open statuses. Keep schema and service compatibility unchanged.

### Dirty-worktree drafts are overwritten

Make narrow patches against inspected diffs. Never reset or checkout user-owned
files.

### Visual polish expands into another redesign

Limit Phase 6 to existing tokens, typography, contrast, radius, elevation,
focus, and press feedback on touched surfaces.

### Mobile Home becomes too long

Keep only one expanded project and place the existing personal list after the
organization overview, as approved.

## 8. Handoff

This plan is **pending approval**. Execution must stop if it would alter an item
under **Keep current** or require a database migration, new dependency, vertical
project redesign, Home desktop restructure, Team shell redesign, or task-detail
size change.
