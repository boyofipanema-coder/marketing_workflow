# Compact Brand Column and Color Spine

Status: pending approval

## Requirements Summary

The integrated home canvas must preserve the current hierarchy
`브랜드 → 프로젝트 → 업무 → 하위업무 → 완료`, while making the brand tier
visually compact and resolving the collisions at the left edge.

1. Reduce the **brand column itself** to 60% of its current equal-column width.
   Do not merely shrink the card inside an unchanged column.
2. Add a calm left canvas inset so the first visual object no longer touches the
   viewport edge.
3. Separate the brand card from the brand-group boundary/color accent.
4. Replace the ambiguous floating color rail with a clipped, rounded color
   spine that follows the brand-group container's outer radius.
5. Preserve all existing task/project actions, hierarchy behavior, filters,
   colors, typography, dark mode, and non-hierarchy project boards.

## Codebase Findings

- The hierarchy currently derives all five slots from one equal `colW`, then
  reserves two of those slots with `lanePad = colW * 2`
  (`app/src/components/workflow/WorkflowCanvas.tsx:856-866`).
- `computeLayout` repeats the equal-width assumption for node placement and
  status-column origins (`WorkflowCanvas.tsx:494-498`,
  `WorkflowCanvas.tsx:599-600`, `WorkflowCanvas.tsx:640-656`,
  `WorkflowCanvas.tsx:718-724`).
- Brand and project headers are positioned as `index * colW`
  (`WorkflowCanvas.tsx:1066-1085`).
- The brand-group container begins at 10px, its color rail also begins at 10px,
  and the brand card begins at 12px. This 2px overlap is the source of the
  collision in the supplied screenshot
  (`WorkflowCanvas.tsx:1091-1109`).
- Project-group geometry also assumes that the first two columns have the same
  width (`WorkflowCanvas.tsx:1160-1179`).
- The project already defines authoritative Apple graphite colors, semantic
  surfaces, material fills, shadows, radii, and focus treatment
  (`app/src/styles/globals.css:23-113`, `globals.css:232-235`,
  `globals.css:270-292`). There is no separate `DESIGN.md`.
- The existing geometry regression suite is the correct home for pure layout
  invariants (`app/src/components/workflow/__tests__/WorkflowCanvas.geometry.test.ts:1-66`).

## Design Direction

### Subject, audience, and job

- **Subject:** a multi-brand marketing operations map.
- **Audience:** three collaborators scanning many brands and projects at once.
- **Single job:** reveal where every unit of work belongs without spending equal
  visual weight on metadata and actionable work.

### Compact token system

No new palette or typeface is introduced. The implementation must reuse:

- Canvas graphite: `--bg` / `#FAFAFC`
- Panel white: `--surface` / `#FFFFFF`
- Inset graphite: `--surface-2` / `#F4F4F7`
- Separator: `--separator` / `#E3E3E8`
- Primary text: `--text` / `#141418`
- Accent/focus: `--accent`, `--ring` / `#007AFF`
- Type roles: existing `--font-sans` for labels and titles; existing mono
  utility only for changing counts, with `tabular-nums`.
- Spacing: 8px base/4px half-step. Use a 24px canvas inset, an 8px color spine,
  and an 8px clear gap between spine and brand card.
- Radius: use the existing 20px `radius-xl` visual band and 14px
  `radius-lg`-scale inner card rather than adding another radius value.

### Layout concept

The brand tier becomes a narrow index, not a fifth equal work column. Its saved
width is redistributed equally across Project, Work, Subtask, and Done so the
board still fills its available width.

```text
24px inset
   ↓
┌─8px color spine─┬──── 60% BRAND ────┬──── PROJECT ────┬──── WORK ────┬── SUBTASK ──┬──── DONE ────┐
│                 │ compact brand card │ project card(s) │ task card(s) │ child cards │ done cards  │
└─────────────────┴────────────────────┴─────────────────┴──────────────┴─────────────┴──────────────┘
```

### Signature

The one distinctive device is the **rounded brand spine**: a solid band clipped
by the brand container's top-left and bottom-left corners. It turns brand color
into structural indexing rather than a detached decorative pill. Everything
else remains quiet.

### Self-critique and revision

An initial idea to add a separate fully rounded rail repeats the current
problem: its top and bottom caps do not describe the container boundary and can
look detached. The revised choice clips a rectangular 8px spine inside the
rounded group shell. This directly encodes brand ownership, eliminates the
overlap, and is specific to this hierarchy rather than a generic dashboard
decoration.

## Acceptance Criteria

1. In hierarchy mode, the rendered brand slot equals `0.60 ×` the former equal
   five-column slot, within 1px after integer rounding.
2. The Project, Work, Subtask, and Done slots share the remaining board width
   equally, within 1px, and the hierarchy board continues to fill the measured
   viewport without creating a new right-side dead zone.
3. The hierarchy board has 24px left and right insets at widths that do not
   require minimum-width horizontal scrolling.
4. The brand-group shell, color spine, and brand card do not overlap:
   the 8px spine is clipped inside the shell, and there is at least 8px of clear
   space between the spine's inner edge and the brand card.
5. The color spine follows the shell's rounded top-left and bottom-left
   silhouette with no detached round caps and no square protrusion.
6. Brand titles, counts, and “프로젝트 추가” remain contained within the narrow
   brand card. Long names/counts truncate or wrap intentionally and never enter
   the Project column.
7. The Project header, project cards, task columns, nodes, overflow controls,
   rails, SVG edges, lane bands, and world width all use the same asymmetric
   geometry source; no element retains the old `index * colW` assumption for
   Brand/Project positioning.
8. Non-hierarchy WorkflowCanvas instances retain their existing
   `진행 중 → 대기 → 완료` geometry and widths.
9. Existing pointer, keyboard focus, project-add tooltip, project editing,
   task selection, task completion, and filtering behavior is unchanged.
10. Light and dark modes use existing semantic/material tokens; no hardcoded
    component hex color, shadow, blur, or font is added.
11. `npm test`, `npm run build`, and `git diff --check` pass.
12. Visual verification at desktop width confirms all four supplied issues;
    a narrow viewport confirms horizontal scrolling remains usable and no
    content is clipped.

## Implementation Steps

### 1. Introduce one hierarchy geometry source

File: `app/src/components/workflow/WorkflowCanvas.tsx`

- Add a small exported pure helper/type near the geometry constants that
  computes:
  `canvasInset`, `brandSlotW`, `contentSlotW`, `brandX`, `projectX`,
  `stageX`, `boardW`, and `worldW`.
- Derive the former equal slot from the measured usable board width, set
  `brandSlotW` to exactly 60% of it, and divide the released 40% equally among
  the other four slots.
- Apply minimum widths as a coordinated board constraint, not independent
  `Math.max` calls that could silently break the 60% relationship.
- Keep the regular three-status board path on its current `COLW`, `LANEPAD`,
  `boardW`, and node-width calculations.

### 2. Pass asymmetric widths through layout computation

File: `app/src/components/workflow/WorkflowCanvas.tsx`

- Replace hierarchy-only uses of `colW * 2` with the computed `stageX`.
- Use `contentSlotW` for Project, Work, Subtask, and Done card/background
  widths; use `brandSlotW` only for the brand column.
- Update node x positions, overflow x positions, rail origin/width, column x
  positions, edge anchor widths, `boardW`, and `worldW` from the geometry
  object.
- Keep `computeLayout` deterministic and free of viewport reads; the component
  continues to supply the measured width.

### 3. Align all rendered hierarchy layers

File: `app/src/components/workflow/WorkflowCanvas.tsx`

- Position Brand and Project column backgrounds/labels from `brandX` and
  `projectX`, not `index * colW`.
- Position the three work columns from layout-provided x coordinates and
  `contentSlotW`.
- Start each brand shell at the 24px canvas inset and size it to the computed
  board width.
- Start hierarchy project lane bands at `projectX`; position project cards
  inside that slot with existing material/radius tokens.
- Ensure the top glass strip, SVG, and world container share the same origin
  and full geometry.

### 4. Replace the floating rail with a clipped rounded spine

File: `app/src/components/workflow/WorkflowCanvas.tsx`

- Make the brand-group shell the clipping context with the existing
  20px-equivalent radius and `overflow-hidden`.
- Add one 8px-wide, full-height, pointer-events-none child at the shell's left
  edge using `brand.color`.
- Remove the current separate 4px `rounded-full` rail.
- Place the brand card after the spine plus an 8px clear gap; constrain its
  width to the compact brand slot.
- Preserve semantic surface/border/shadow classes and do not add animation for
  this static structural element.

### 5. Harden compact brand content

File: `app/src/components/workflow/WorkflowCanvas.tsx`

- Keep the brand title single-line truncated.
- Keep counts `tabular-nums`; permit a deliberate two-line metadata layout if
  the exact 60% slot cannot contain all three values at minimum width.
- Keep “프로젝트 추가” inside the card with its current tooltip and callback.
  The visual control may be compact, but its interactive hit region must remain
  at least the existing WCAG AA minimum and retain the global focus ring.

### 6. Add geometry regression coverage

File:
`app/src/components/workflow/__tests__/WorkflowCanvas.geometry.test.ts`

- Unit-test the pure hierarchy geometry helper for:
  - exact 60% brand ratio;
  - equal redistribution across the remaining four slots;
  - 24px outer insets;
  - monotonic x origins with no overlap;
  - world/board width consistency;
  - coordinated minimum-width overflow behavior.
- Keep the existing `cardHeight` and `hierarchyStageIndex` tests unchanged.
- Add a test proving regular-board constants/calculation are unaffected if the
  helper is shared.

## Risks and Mitigations

- **Risk: narrow brand content becomes unusable.**
  Mitigation: test long Korean/Latin brand names and maximum counts; constrain
  text and allow metadata to wrap without crossing the slot boundary.
- **Risk: only visible cards move while rails/edges remain on old coordinates.**
  Mitigation: one geometry object drives computeLayout and rendering; include
  x-origin and world-width unit assertions plus filtered-brand visual review.
- **Risk: minimum width breaks the exact 60% requirement.**
  Mitigation: enforce minimums on the total hierarchy board, then calculate all
  slots from that common width.
- **Risk: rounded spine aliases or protrudes at corners.**
  Mitigation: clip the solid spine inside the shell; do not approximate the
  silhouette with independent rounded caps.
- **Risk: non-hierarchy project workspace regresses.**
  Mitigation: branch asymmetric geometry behind `hierarchyView` and visually
  inspect one project workspace in addition to the home hierarchy.

## Verification Steps

1. Run focused geometry tests:
   `npm test -- WorkflowCanvas.geometry.test.ts`
2. Run the complete test suite:
   `npm test`
3. Run lint/type/build verification:
   `npm run build`
4. Run whitespace/conflict validation:
   `git diff --check`
5. In the running app, capture and inspect:
   - all-brands home canvas at desktop width;
   - one filtered brand with multiple projects/tasks;
   - one long brand name and a zero-project brand;
   - dark mode;
   - a narrow viewport with horizontal scrolling;
   - a non-hierarchy project workspace.
6. Confirm Project add, Work add, project edit, task edit, completion controls,
   focus filter, and multi-brand filter still work.
7. After explicit execution approval, commit only the intended tracked source
   and test files, then push `main` immediately per the user's standing
   preference.

