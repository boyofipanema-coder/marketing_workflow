# M0–M2 Implementation Work Plan — Marketing Team Workflow (Cloudflare)

Source spec: Ouroboros Seed M0-M2 (QA 0.87, accepted) + `BUILD_PLAN.md` v1.1
Scope: Bootstrap → UX Skeleton → Persistent Task Core. **Excludes** AI, Google Calendar, dependencies, Waiting/Follow-up (M3+).
Mode: Direct. Greenfield — all file paths below are to be created under a new app root `app/`.

---

## 1. Requirements Summary

Deploy a persistent, multi-member task core on Cloudflare Workers (OpenNext + Next.js App Router + TypeScript), with D1 (SQLite) via Drizzle as the sole datastore, Better Auth (admin-created accounts, sessions in D1), and a navigable UX skeleton. Tasks created by title alone survive refresh/re-login and are shared across members. Optimistic concurrency (version field) prevents silent overwrites. No KV/Queues/Cron in this increment.

## 2. Acceptance Criteria (from Seed — testable)

| ID | Criterion | Test |
|---|---|---|
| AC1 | Title-only Inbox Task creation persists across refresh + re-login, visible to other members | Create via title; reload; re-login; second member sees it |
| AC2 | assignee/status/due each change in ≤2 interactions; visible to others after refresh; Done sets `completed_at`, leaving Done clears it; cancel freezes + excludes from views; restore re-enables | Unit + integration on transitions; UI interaction count |
| AC3 | Project/Workstream/Task/Milestone create+edit; non-Inbox Task belongs to Project; Workstream shares Project; Project context stays in detail panel | Integration CRUD; FK constraint tests |
| AC4 | Home (My Focus/Needs Attention/Coming Next), My Work (Today/This Week/In Progress/Waiting/Review/Later), Projects (3 seed Projects + lead + In-Progress count); Team/Calendar placeholders; groupings locatable ≤10s | Render tests + manual timing |
| AC5 | Search = case-insensitive trimmed substring on title+description; filters Project/Assignee/Status/Due (exact or range; undated excluded unless Undated filter) combine AND | Unit tests on query builder |
| AC6 | Stale `base_version` write rejected with "modified by another member", no mutation | Concurrency integration test |
| AC7 | Invalid input rejected with visible validation, no partial persist (empty/whitespace name, len 201, bad/reversed dates, unknown status, missing FK, start>end) | Validation unit tests |
| Exit | Deployed to Cloudflare, auth-gated; unauthenticated cannot read/modify | Deploy smoke + auth guard test |

## 3. Implementation Steps

### Phase M0 — Bootstrap (infra only; no KV/Queues/Cron)
1. `npm create cloudflare` → Next.js + OpenNext; add TypeScript, Tailwind, Radix primitives. Files: `app/`, `app/next.config.ts`, `app/open-next.config.ts`, `app/wrangler.toml` (only `d1_databases` binding).
2. Drizzle setup: `app/src/server/db/schema.ts`, `app/drizzle.config.ts`, `app/src/server/db/client.ts` (D1 binding). Wire `wrangler d1 create` + migration script in `package.json`.
3. CI: build + `tsc --noEmit`. Health route `app/src/app/api/health/route.ts`.
4. **Preflight (non-code, record results)**: company PC reaches deploy domain; Google sign-in screen reachable; Calendar consent possible; `googleapis.com` reachable. Log to `BUILD_PLAN.md` notes (gates M7 later; no build impact now).

### Phase M1 — UX Skeleton (mock data; focus Home/Workflow/Task Panel/Quick Add)
5. App shell + nav: `app/src/app/(app)/layout.tsx` with Home/My Work/Projects/Team/Calendar; `+ Quick Add` + search in header.
6. Mock data module `app/src/lib/mock/seed-projects.ts` — 3 Projects (AURALEE Launch Alignment, Cultural Collaboration, Brand Strategy Presentation) with leads + tasks.
7. Screens (mock-backed): `home/page.tsx` (My Focus / Needs Attention / Coming Next), `my-work/page.tsx` (6 sections), `projects/page.tsx` + `projects/[projectId]/page.tsx` (Workflow tab). Team/Calendar = labeled placeholders.
8. Components: `TaskCard`, `TaskDetailPanel` (right panel, keeps Project context), `QuickAdd`, `SectionList`, `EmptyState`. Path: `app/src/components/`.

### Phase M2 — Persistent Task Core (replace mock with D1)
9. Schema (Drizzle) in `schema.ts`: workspace, auth_account, member, session, project, workstream, task (with `version`, nullable fields, `completed_at`/`cancelled_at`), milestone, activity_log. Enforce: task.project_id null only while Inbox; workstream.project_id = task.project_id.
10. Auth: Better Auth + Drizzle + D1 sessions. `app/src/server/auth/`. Admin-create-account flow; no public signup route. Middleware guards all `(app)` routes.
11. Services `app/src/server/services/`: `task.ts` (create-by-title, edit, status transitions incl. Done/cancel/restore, optimistic version write), `project.ts`, `workstream.ts`, `milestone.ts`, `search.ts` (case-insensitive substring + AND filters + Undated predicate).
12. Read-time computation `app/src/lib/derive.ts`: Overdue + Backlog only; presentation-query predicates (Asia/Seoul tz, inclusive boundaries) for the 9 view groupings, excluding cancelled.
13. Validation `app/src/lib/validate.ts` (zod): name/title trim non-empty ≤200, ISO dates, start≤end, status enum, FK existence checks → surfaced as form errors, no partial persist.
14. Concurrency: version-check write path returns 409 → UI "modified by another member"; tab-refocus + 20–30s optional poll refetch.
15. Activity log: atomic write of task update + log record in one D1 transaction.
16. Wire screens to services; seed the 3 Projects into D1 via a seed script.
17. Deploy to Cloudflare (`wrangler deploy`), run auth-gated smoke test.

## 4. Risks & Mitigations
- **OpenNext/Next version drift on Workers** → pin versions from Cloudflare Next.js guide; health route smoke on every deploy.
- **D1 transaction semantics for activity-log atomicity** → use Drizzle `batch`/transaction; test rollback on log failure (AC-linked).
- **Better Auth + D1 session adapter maturity** → confirm adapter in M2 step 10 before building screens on it; fallback: minimal custom session table (still D1).
- **Workers Paid needed for SSR+auth app** → confirm $5/mo plan before deploy step 17 (per BUILD_PLAN §9).
- **Timezone edge cases (Asia/Seoul)** → centralize in `derive.ts`; unit-test boundary dates.

## 5. Verification Steps
- `tsc --noEmit` + lint clean; `vitest` unit suite (derive, validate, search, version-conflict) green.
- Integration: task lifecycle (create→edit→Done→cancel→restore), CRUD + FK, stale-version 409.
- Manual: 10-second discoverability of My Focus/Waiting/Coming Next; 2-interaction edits.
- Deploy smoke: unauthenticated request to `(app)` route redirects to login; authenticated reads D1 data.

## 6. Out of Scope (guardrails)
No AI, Google Calendar, Task dependencies, Waiting subtypes, follow-up dates, KV, Queues, Cron. These are M3–M8 per BUILD_PLAN.md and get their own plans/seeds.
