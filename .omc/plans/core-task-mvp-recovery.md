# Core Task MVP 복구 실행 계획 (R1–R4)

기준: `MVP_RECOVERY_PLAN.md` v2.0 / 브랜치 `claude/mvp-recovery-plan-c8934c`
확정일: 2026-07-25

## 0. 사용자 확정 사항

| 항목 | 결정 |
|---|---|
| 인증 | **현재 무로그인 유지.** `middleware.ts` 패스스루와 `getCurrentMember`의 auto-enter를 그대로 둔다. R1은 Workspace 경계·원자적 쓰기 안전성만 이행한다. |
| 범위 | **R1 ~ R4 = Core Task MVP.** R5(Waiting/Dependency), R6(Team/모바일/릴리스)는 이번 세션 제외. |
| 배포 | **로컬만.** 로컬 D1 migration + 브랜치 커밋까지. 운영 D1 migration·배포는 별도 승인 후. |

## 1. R0 기준선 (완료)

- 작업 트리 clean, 사용자 미커밋 변경 없음
- `npm test` → 110 tests / 5 files 통과
- `npm run typecheck` → exit 0
- 기존 migration: `0000_absent_harry_osborn`, `0001_add_parent_task_id` (수정 금지)

## 2. 현재 결손 진단 (코드 근거)

| 증상 | 근거 |
|---|---|
| Quick Add가 NavBar에서 무동작 | [NavBar.tsx:28-32](app/src/components/NavBar.tsx:28) — `console.log` 스텁 |
| 검색이 죽은 입력 | [NavBar.tsx:81-86](app/src/components/NavBar.tsx:81) — `aria-label="검색 (준비 중)"`, 핸들러 없음 |
| 상세 패널이 읽기 전용 | [TaskDetailPanel.tsx:188-192](app/src/components/TaskDetailPanel.tsx:188) — "추가 기능은 이후 마일스톤에서" |
| Project/Workstream/Milestone 생성 UI 없음 | 서비스는 존재([project.ts](app/src/server/services/project.ts), [workstream.ts](app/src/server/services/workstream.ts), [milestone.ts](app/src/server/services/milestone.ts))하나 서버 액션·UI 미연결 |
| 서버 액션이 생성 2종뿐 | [actions/tasks.ts](app/src/app/actions/tasks.ts) — `createTaskAction`, `createSubtaskAction`만 존재 |
| Stale Version이 실제로 덮어씀 | [task.ts:331-334](app/src/server/services/task.ts:331) — version 비교 후 `WHERE id` 만으로 UPDATE |
| Workspace 경계 없음 | [queries.ts:98-105,125-135](app/src/server/data/queries.ts:98) — `getProjectTasks`/`getProjectById`가 workspace 미검증 |
| Project 화면에 업무 추가·완료 없음 | [ProjectWorkspace.tsx](app/src/app/(app)/projects/[projectId]/ProjectWorkspace.tsx) — 읽기 전용 탭 3개 |
| Team/Calendar 준비 중 | [team/page.tsx](app/src/app/(app)/team/page.tsx), [calendar/page.tsx](app/src/app/(app)/calendar/page.tsx) |
| Inbox 화면 없음 | 라우트 자체가 없음 |

## 3. 단계별 실행

### R1 — 데이터·쓰기 안전성

**R1-1. additive migration `0002_recovery_fields.sql`**
- `task`: `sort_order integer not null default 0`, `due_time text`, `waiting_type text`, `waiting_on_text text`, `waiting_party_text text`, `waiting_owner_member_id text`, `follow_up_at text`, `blocked_reason text`, `blocked_resolution_action text`
- 신규 `task_dependency`: `id`, `workspace_id`, `predecessor_task_id`, `successor_task_id`, `dependency_type`, `created_at` + unique(predecessor, successor)
- index: `idx_task_project_sort (project_id, parent_task_id, sort_order)`, `idx_task_workspace_status (workspace_id, status)`
- backfill: `sort_order`를 project+parent 범위에서 `created_at, id` 순으로 채움
- 기존 0000/0001은 손대지 않음. Waiting/Dependency 컬럼은 R5용이지만 migration 1회로 끝내기 위해 지금 추가(순수 additive, 무해).

**R1-2. 원자적 version UPDATE**
- `editTask`의 UPDATE를 `WHERE id = ? AND workspace_id = ? AND version = baseVersion`로 변경
- drizzle d1/better-sqlite3 결과의 변경 행 수가 0이면 `StaleVersionError`
- `version` 증가·`activity_log` 삽입을 같은 `db.batch`로 유지

**R1-3. Workspace 경계**
- 모든 서비스 시그니처에 `workspaceId` 추가: `editTask`, `cancelTask`, `restoreTask`, `createSubtask`, `editProject`, `createWorkstream`, `editWorkstream`, `createMilestone`, `editMilestone`
- `queries.ts`의 `getProjectTasks`, `getProjectById`, `getProjectWorkstreams`, `getProjectMilestones`에 workspace join/조건 추가
- workstream→project→workspace, milestone→project→workspace 소속 검증

**통과 조건**
- 다른 workspace id로 읽기/쓰기 시도 시 `NotFoundError`
- 두 클라이언트가 같은 baseVersion으로 저장 시 두 번째가 `StaleVersionError`, 첫 번째 값 보존
- 기존 110개 테스트 + 신규 경계/동시성 테스트 통과

### R2 — Project와 목록형 업무 관리

**서버 액션 (신규)**
- `app/src/app/actions/projects.ts`: create / edit / archive / restore
- `app/src/app/actions/workstreams.ts`: create / edit / reorder
- `app/src/app/actions/milestones.ts`: create / edit
- `app/src/app/actions/tasks.ts` 확장: `editTaskAction`, `completeTaskAction`, `reopenTaskAction`, `cancelTaskAction`, `restoreTaskAction`, `reorderTasksAction`, `createProjectTaskAction`

**완료 해제 규칙** — `activity_log`에서 해당 task의 마지막 `change_type='status'` 중 `to_value='Done'`인 행의 `from_value`로 복구. 없으면 `ToDo`.

**UI**
- `ProjectTaskList` + `TaskRow`: 완료 원형 컨트롤, 제목·상태·담당자·마감, 더보기 메뉴, 드래그 핸들
- 접히는 완료 목록 + 완료 개수
- `업무 추가` 인라인 입력 (제목만으로 최상위 Task 생성, status=ToDo)
- Project 생성/수정 폼(다이얼로그), 보관/복구
- Workstream·Milestone 인라인 편집
- 기존 `WorkflowCanvas`는 `업무 흐름` 탭으로 유지(삭제 금지, 확장 금지)

**통과 조건** — 계획서 §6 R2와 동일

### R3 — 편집형 상세 패널

- `TaskDetailPanel`을 편집형으로 전환: Title / Description / Project / Workstream / Assignee / Reviewer / Start / Due / Due time / Status 6종 / Review 요청 / 취소·복구
- 저장 규칙: 선택형·칩은 즉시 저장, 제목은 Enter·blur, Description은 600ms debounce
- 저장 중/완료/실패 표시, 실패 시 낙관적 UI 롤백 + 입력값 유지
- Stale Version 시 서버 최신값 재로드 안내
- 데스크톱 우측 패널 / 모바일 전체 화면 시트

### R4 — Inbox·Home·My Work·검색

- `/inbox` 라우트: `project_id IS NULL` Task 목록 + 인라인 정리(Project·담당자·마감·Status)
- Home: My Focus / Team in Motion / Waiting / Needs Attention / Coming Next (Team in Motion·Waiting 신규)
- My Work: 각 행에서 Status·Due·Review 요청을 1~2조작으로 변경
- NavBar 검색을 `/search`로 연결. Title + Project명 + Assignee명 통합 검색
- 필터: Project / Assignee / Status / Due(오늘·이번주·기한초과·날짜없음), 조합·초기화 가능
- 결과 없음·로딩·오류 상태 제공

## 4. 리스크와 완화

| 리스크 | 완화 |
|---|---|
| migration이 기존 D1 데이터 파손 | 순수 additive only. `ALTER TABLE ADD COLUMN` + `CREATE TABLE` + `CREATE INDEX`만 사용. drop/rename 금지. 로컬에서만 적용 후 기존 행 조회 회귀 확인 |
| 서비스 시그니처 변경으로 기존 테스트 붕괴 | `workspaceId`를 필수 파라미터로 추가하고 기존 테스트를 같은 커밋에서 갱신. 테스트 전량 통과를 각 단계 게이트로 삼음 |
| 원자적 UPDATE의 변경 행 수 확인이 d1과 better-sqlite3에서 다름 | 서비스는 `.run()` 결과 대신 UPDATE 후 재조회로 version 검증하는 방식도 병행 검토. 통합 테스트로 양쪽 확인 |
| 낙관적 UI 롤백 누락 | 모든 mutation 액션이 `{ success, error?, task? }` 형태를 반환하도록 통일하고 클라이언트에서 실패 시 서버 값으로 되돌림 |
| 범위 팽창 | R5·R6 기능(Waiting 입력 UI, Dependency, Team 화면, 캔버스 확장)은 이번 세션에서 구현하지 않음 |

## 5. 검증

각 단계 종료마다:
1. `npm test` 전량 통과
2. `npm run typecheck` exit 0
3. `npm run build` 성공 (R2·R4 종료 시)
4. 로컬 dev 서버에서 해당 단계 통과 조건 수동 확인

최종:
- 계획서 §7.1 기능 E2E 1~11번에 해당하는 흐름을 로컬에서 확인
- §7.2 오류·보안 E2E 1~7번을 서비스 단위 테스트로 커버
