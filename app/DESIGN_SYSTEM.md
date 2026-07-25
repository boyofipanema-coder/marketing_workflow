# Design System — Marketing Team Workflow

> **Read this before building any UI.** Every screen and component must use this
> system. It exists so that work from parallel agents composes into one coherent,
> Apple-quality product instead of a patchwork of ad-hoc styles.

**Aesthetic direction:** *refined minimalism, editorial calm.* A focused internal
tool that gets out of the way. System typography, Apple system colors, translucent
chrome, spring-based motion. When in doubt: **restraint**. The content is the
interface; the chrome recedes.

---

## The one rule

**Never hardcode a color, shadow, radius, blur, or font.** Every visual value is a
token. If you're typing a hex code, a `zinc-*` / `slate-*` / `gray-*` Tailwind
default, a `px` shadow, or `rounded-[…]`, stop — there is a token for it.

```
❌ bg-white  bg-zinc-50  text-gray-500  shadow-[0_2px_8px]  rounded-[12px]  #007AFF
✅ bg-surface  bg-bg  text-text-tertiary  shadow-md  rounded-xl  bg-accent
```

Tokens live in [`src/styles/globals.css`](src/styles/globals.css) and are mapped to
Tailwind utilities in [`tailwind.config.ts`](tailwind.config.ts). They adapt to
light/dark automatically — using them is how you get free dark mode.

---

## Color tokens

### Surfaces & text (semantic — always use these)

| Utility | Use |
|---|---|
| `bg-bg` | App canvas (page background) |
| `bg-surface` | Cards, panels, raised content |
| `bg-surface-2` | Insets, nested fills, secondary buttons |
| `bg-surface-3` | Hover/pressed fills |
| `text-text` | Primary label |
| `text-text-secondary` | Secondary / supporting |
| `text-text-tertiary` | Metadata, timestamps |
| `text-text-quaternary` | Placeholder / disabled |
| `border-separator` | Hairline dividers (default border) |
| `border-border` / `border-border-strong` | Control borders |
| `bg-accent` `text-accent` `bg-accent-hover` | Primary action (Apple blue) |
| `ring-ring` | Focus ring |

### Task status (use `<StatusBadge>`, don't recolor by hand)

`status-inbox` (gray) · `status-todo` (blue) · `status-inprogress` (orange) ·
`status-waiting` (purple) · `status-review` (teal) · `status-done` (green) ·
`status-cancelled` (muted gray).

### Attention flags

`flag-blocked` / `flag-overdue` (red) · `flag-followup` (orange) · `flag-ready` (green).

Opacity modifiers work on every token: `bg-accent/12`, `text-status-done`,
`border-separator/70`.

---

## Typography

Set once at the root ([`layout.tsx`](src/app/layout.tsx)) — the Apple system font
with a Korean fallback (`Pretendard`, `Apple SD Gothic Neo`). **Don't add web
fonts.** The system font ships optical sizing and tracking the design depends on.

Use the type scale — sizes already carry correct tracking + leading:

| Utility | px | Role |
|---|---|---|
| `text-2xs` | 11 | micro labels, uppercase tags |
| `text-xs` | 12 | metadata |
| `text-sm` | 13 | secondary text, dense UI |
| `text-base` | 15 | **body default** |
| `text-lg` | 17 | emphasized body, card titles |
| `text-xl` | 20 | section titles |
| `text-2xl` | 24 | page titles |
| `text-3xl`–`text-5xl` | 31–52 | display / hero (rare in-app) |

Build hierarchy with **weight + size together** (`font-medium`, `font-semibold`),
not size alone. Body stays `font-normal`.

---

## Spacing, radii, elevation

- **8pt grid.** Prefer `2 / 3 / 4 / 6 / 8 / 12 / 16` spacing steps. Generous
  negative space is on-brand — don't cram.
- **Radii:** `rounded-md` (inputs, small controls) · `rounded-lg` (buttons, chips)
  · `rounded-xl` (cards) · `rounded-2xl` (sheets, large panels).
- **Elevation:** `shadow-sm` (resting card) → `shadow-md` (hover / popover) →
  `shadow-lg` (menus) → `shadow-xl` (modals). Shadows are soft and diffuse; never
  a hard drop shadow.

---

## Materials (translucent chrome)

Nav bars, headers, and side panels are **translucent layers content scrolls
under**, not opaque strips. Use the utility classes from globals.css:

- `.material-chrome` — top nav / headers
- `.material-panel` — the task detail side panel
- `.material-thin` — floating glass chips
- `.material-edge` — adds the bright top edge (light catching glass)

Rules: never stack one translucent surface on another (legibility collapses).
Bigger surfaces read as thicker (more blur, deeper shadow). Reduced-transparency
and reduced-motion fallbacks are already handled in CSS.

---

## Motion — make it feel alive

Motion should feel like physics: **respond instantly, start from the current
value, carry momentum, stay interruptible.** See
[`src/lib/motion.ts`](src/lib/motion.ts) and the `apple-design` skill.

- **Respond on press, not release.** Feedback is instant (`active:scale-[0.97]`,
  already in `<Button>` and the `.press` utility).
- **Default transitions:** `transition-… duration-base ease-out`. The `ease-out`
  curve (`cubic-bezier(0.32,0.72,0,1)`) is the house glide.
- **Springs for anything gesture-driven** (sheets, the detail panel, drag). Pull
  values from `SPRING` in `motion.ts` — don't invent stiffness numbers. Default
  springs are critically damped (no bounce); add bounce *only* after a
  momentum gesture (a flick, a drag release).
- **Page load:** wrap a list/grid in `.reveal` for a staggered fade-up.
- **Enter and exit along the same path** (a panel in from the right dismisses to
  the right). Anchor popovers/menus to their trigger (`transform-origin`).

Named animations available: `animate-fade-in`, `animate-scale-in`,
`animate-reveal-up`, `animate-sheet-up`, `animate-slide-in-right`.

---

## Components — use the primitives

Import from `@/components/ui`. Extend these instead of hand-rolling markup:

| Primitive | Notes |
|---|---|
| `<Button>` | variants: `primary` `secondary` `ghost` `outline` `link` `destructive`; sizes `sm` `md` `lg` `icon`. `asChild` to wrap a `<Link>`. |
| `<Card>` + `CardHeader/Title/Description/Content/Footer` | `interactive` prop adds hover-lift + press for clickable cards. |
| `<StatusBadge status=…>` | canonical task status. Variants `soft` / `dot` / `pip`. |
| `<FlagBadge flag=…>` | Blocked / Overdue / Follow up / Ready. |
| `<Badge>` | neutral metadata pills, counts, tags. |
| `<Input>` | text fields — accent focus ring built in. |

Task/status naming and colors come from
[`src/lib/status.ts`](src/lib/status.ts) — the single source of truth. Don't
duplicate status labels or colors anywhere else.

Utilities: `cn(...)` from [`src/lib/utils.ts`](src/lib/utils.ts) for class merging
(use it in every component with a `className` prop).

---

## Accessibility (non-negotiable)

- Every interactive element has a visible `focus-visible` ring (primitives do this
  already). Don't remove outlines without replacing them.
- Color is never the only signal — status badges pair color with a **label**.
- Respect `prefers-reduced-motion`, `prefers-reduced-transparency`,
  `prefers-contrast` — all handled in globals.css; don't override them away.
- Hit targets ≥ 32px (`size-8`+). Icon-only buttons need `aria-label`.
- Contrast: body text on `bg`/`surface` meets AA. If you tint text, check it.

---

## Quick checklist before you ship a component

- [ ] No raw hex, no `zinc/slate/gray-*` defaults, no arbitrary `[…]` visual values
- [ ] Colors, spacing, radii, shadows all from tokens/utilities
- [ ] Uses `@/components/ui` primitives where one fits
- [ ] Status rendered via `<StatusBadge>` / `lib/status.ts`
- [ ] Press feedback on interactive elements; transitions use `ease-out`
- [ ] `focus-visible` ring intact; icon buttons have `aria-label`
- [ ] Looks right in **both** light and dark (toggle system appearance)
- [ ] `cn()` used for conditional classes
