# Marketing Team Workflow: 독립형 MVP 복구 계획 v2.0

> 문서 성격: 기존 애플리케이션을 제자리에서 수정하기 위한 단독 실행 명세  
> 적용 범위: 이 문서의 Core Task MVP와 Workflow MVP 복구  
> 기준일: 2026-07-25

## 0. 실행 계약

### 0.1 기존 저장소 수정 원칙

이 작업은 신규 구축이 아니다. 현재 저장소의 코드·설정·데이터를 유지하면서 빠진 기능을 연결하고 보완한다.

반드시 지킬 사항:

- 저장소 루트의 `AGENTS.md`와 현재 작업 디렉터리에 추가 지침이 있는지 먼저 확인한다.
- 작업 전에 `git status --short`로 수정·추가 파일을 확인한다.
- 기존 변경사항은 사용자의 작업으로 간주하고 덮어쓰거나 되돌리지 않는다.
- 새 Next.js 앱, 새 저장소, 새 패키지 구성을 만들지 않는다.
- `app/package.json`, Cloudflare 설정, Drizzle 설정, Tailwind 설정을 새 파일로 교체하지 않는다.
- 기존 페이지와 컴포넌트를 삭제한 뒤 다시 만드는 방식은 피한다. 필요한 부분만 수정한다.
- 기존 Drizzle migration을 수정하거나 번호를 재사용하지 않는다.
- D1 데이터베이스를 reset하거나 운영 테이블·사용자 데이터를 삭제하지 않는다.
- 기존 로컬·스테이징·운영 데이터를 seed 데이터로 덮어쓰지 않는다.
- 관련 없는 사용자 변경사항을 stage·commit·배포하지 않는다.

구현 중 기존 코드와 이 문서가 충돌하면 기존 데이터를 보존하는 쪽을 선택한다. 데이터 손실이나 운영 배포가 필요한 선택은 사용자 확인 전까지 진행하지 않는다.

### 0.2 유지할 기술 기준

현재 앱의 기술 구성을 그대로 사용한다.

- 애플리케이션: `app/` 디렉터리의 Next.js App Router + TypeScript + React
- 배포: Cloudflare Workers + OpenNext
- 데이터베이스: Cloudflare D1
- ORM과 migration: Drizzle
- UI: 기존 Tailwind 토큰과 Radix 기반 컴포넌트
- 테스트: Vitest 서비스·통합 테스트와 브라우저 E2E

다른 프레임워크, 데이터베이스, 인증 제품, 상태관리 라이브러리로 교체하지 않는다. 새 의존성은 기존 구성으로 구현할 수 없는 경우에만 추가한다.

### 0.3 현재 자산과 수정 위치

다음 코드는 이미 있으므로 재작성보다 연결·보완을 우선한다.

| 자산 | 현재 위치 | 복구 작업 |
|---|---|---|
| DB schema | `app/src/server/db/schema.ts` | additive migration에 맞춰 필드·테이블 추가 |
| DB migration | `app/drizzle/migrations/` | 다음 순번 migration 추가 |
| Task 서비스 | `app/src/server/services/task.ts` | 기존 edit/cancel/restore 재사용, 원자적 version 검사 보완 |
| Project 서비스 | `app/src/server/services/project.ts` | 기존 create/edit 재사용, archive/restore와 권한 보완 |
| Workstream 서비스 | `app/src/server/services/workstream.ts` | 기존 create/edit를 서버 액션과 UI에 연결 |
| Milestone 서비스 | `app/src/server/services/milestone.ts` | 기존 create/edit를 서버 액션과 UI에 연결 |
| Task 서버 액션 | `app/src/app/actions/tasks.ts` | edit/complete/reopen/cancel/restore/reorder 액션 추가 |
| 조회 함수 | `app/src/server/data/queries.ts` | 모든 직접 조회에 Workspace 경계 적용 |
| 업무 상세 | `app/src/components/TaskDetailPanel.tsx` | 읽기 전용 패널을 편집형으로 전환 |
| 프로젝트 화면 | `app/src/app/(app)/projects/` | Project 폼과 목록형 업무 관리 연결 |
| Home | `app/src/app/(app)/home/page.tsx` 및 `app/src/components/HomeContent.tsx` | 목록 중심 실행 화면으로 복구 |
| My Work | `app/src/app/(app)/my-work/` 및 `app/src/components/MyWorkContent.tsx` | 빠른 변경과 편집 패널 연결 |
| 검색 입력 | `app/src/components/NavBar.tsx` | 준비 중 입력을 실제 검색으로 연결 |
| Team | `app/src/app/(app)/team/page.tsx` | 준비 중 화면을 팀 업무 가시성 화면으로 교체 |
| Workflow Canvas | `app/src/components/workflow/WorkflowCanvas.tsx` | 삭제하지 않고 보조 보기로 유지 |
| 인증 | `app/src/middleware.ts`, `app/src/server/auth/`, `getCurrentMember` | 자동 admin 진입 제거, 보호 경로 복구 |

현재 Task 수정 서비스는 version을 읽어 비교한 뒤 `id`만으로 UPDATE한다. 실제 동시 저장에서도 충돌을 막도록 `task.id + baseVersion` 조건부 UPDATE로 변경하고, 갱신 행이 없으면 Stale Version 오류를 반환한다.

### 0.4 환경과 배포 경계

- 현재 운영 기준 URL: `https://marketing-team-workflow.boyofipanema.workers.dev`
- 운영 URL은 기존 동작을 읽기 전용으로 확인하는 기준으로 사용한다.
- 생성·수정·취소·migration E2E는 별도 staging D1 또는 전용 test Workspace에서 수행한다.
- E2E 데이터에는 테스트 전용 이름을 사용하고 테스트 후 앱의 archive/restore 흐름으로 정리한다.
- 운영 D1에 직접 SQL로 테스트 데이터를 넣거나 삭제하지 않는다.
- staging 검증, 백업, rollback 준비가 끝나기 전에는 운영 migration과 배포를 실행하지 않는다.
- 운영 배포는 사용자 요청 또는 명시적 승인 후 진행한다.

## 1. 현재 상태와 복구 목표

현재 앱에서 확인된 기능:

- Project·Task 조회
- Quick Add를 통한 Inbox Task 생성
- 하위 업무 생성
- D1 기반 데이터 유지
- 일부 Project·Workstream·Milestone·Task 서비스
- 목록·보드·상세 패널의 UI 골격

배포 UI에서 빠진 기능:

- Project 생성·수정·보관·복구
- Workstream 생성·수정
- Milestone 최소 생성·수정
- Project 안에서 최상위 Task 생성
- Inbox Task 정리
- 업무 제목·세부내용 수정
- Project·Workstream·담당자·Reviewer·마감 변경
- 6개 상태 변경과 Review 요청
- 완료·완료 해제·취소·복구
- 실제 검색과 기본 필터
- Waiting·Follow-up·Dependency
- Team 가시성
- 인증과 Workspace 접근 경계
- 읽고 조작할 수 있는 모바일 업무 화면

복구 목표는 다음 흐름을 끊김 없이 만드는 것이다.

`Quick Add 또는 Project 내 추가 → 업무 정리 → 실행 → Waiting/Review → Done → 후속 업무`

기본 화면은 다음 정보 구조를 사용한다.

`Project → 간결한 업무 목록 → 업무 선택 → 즉시 상세 편집`

## 2. 제품 동작 기준

### 2.1 Project와 Workstream

모든 Team Member:

- Project를 생성하고 이름·목표·리드·시작일·종료일을 수정한다.
- Project 안에서 Workstream을 생성하고 이름·순서를 수정한다.
- Project 안에서 최상위 Task를 즉시 추가한다.
- 활성 Project와 Task를 조회·생성·수정한다.

Team Admin:

- Project를 보관하고 복구한다.
- 팀원과 Workspace 설정을 관리한다.

Project는 hard delete하지 않는다. `archived_at`을 사용해 보관하고 Admin이 복구할 수 있게 한다.

### 2.2 목록형 업무 관리

Project 기본 화면은 업무 목록이다.

- Project 제목과 더보기 메뉴
- `업무 추가` 인라인 입력
- 미완료 업무 목록
- 업무별 완료 원형 컨트롤
- 업무별 제목·상태·담당자·마감
- 업무 선택 시 상세 편집
- 업무별 더보기 메뉴
- 드래그 핸들을 이용한 같은 Project 내 순서 변경
- 접고 펼칠 수 있는 완료 목록과 완료 개수

기존 Workflow Canvas는 `Workflow 보기`에서만 제공한다. 캔버스 줌·팬·하위 업무 기능을 추가로 확장하지 않는다.

### 2.3 완료·완료 해제·취소

완료와 취소는 다른 동작이다.

- 미완료 Task의 원형 컨트롤을 선택하면 Status를 `Done`으로 바꾸고 `completed_at`을 기록한다.
- 완료 Task의 컨트롤을 다시 선택하면 가장 최근의 비종료 Status로 복구한다.
- 복구할 이전 Status를 찾을 수 없으면 `ToDo`로 전환한다.
- 완료 전 Status는 Activity Log의 Status 변경 기록에서 확인한다.
- 취소는 더보기 메뉴의 별도 액션으로 제공하고 `cancelled_at`을 기록한다.
- 취소된 Task는 일반 목록에서 제외하고 Archive에서 복구한다.
- 취소된 Task는 복구 전까지 수정·완료할 수 없다.

완료, 완료 해제, 취소, 복구는 각각 Activity Log에 기록한다.

### 2.4 업무 상세 편집

업무 선택 시 목록의 맥락을 유지한다.

- 데스크톱: 우측 편집 패널
- 모바일: 전체 화면 시트

편집 필드:

- Title
- Description
- Project
- Workstream
- Assignee
- Reviewer
- Start date
- Due date
- 선택적 Due time
- Status: `Inbox, ToDo, InProgress, Waiting, Review, Done`
- Waiting 전용 필드
- 직접 Predecessor·Successor
- 취소·복구

빠른 동작:

- 오늘 마감
- 내일 마감
- 날짜 직접 선택
- 시간 추가·변경·제거
- Review 요청
- 완료
- 더보기 메뉴에서 취소

Review 요청 시 Reviewer를 지정하고 Status를 `Review`로 변경한다.

### 2.5 저장 상태와 오류

- 체크박스·선택형 필드·날짜 칩은 선택 즉시 저장한다.
- 제목은 Enter 또는 포커스 이탈 시 저장한다.
- Description은 입력 중 600ms debounce 후 저장하고 패널을 닫기 전 미저장 변경을 처리한다.
- 저장 중, 저장 완료, 저장 실패 상태를 패널 안에 표시한다.
- 저장 실패 시 낙관적 UI를 서버 값으로 되돌리고 입력값을 다시 시도할 수 있게 유지한다.
- Validation 오류는 해당 필드 가까이에 한국어로 표시한다.
- Stale Version 오류는 다른 사용자의 최신 값을 다시 불러온 뒤 사용자가 재적용하도록 안내한다.
- 저장·취소·복구 실패를 console 로그로만 처리하지 않는다.

### 2.6 Inbox, Home, My Work

Team Inbox:

- Project가 없는 Inbox Task를 한 목록에 표시한다.
- Inbox에서 Project·Workstream·Assignee·Due·Status를 보완한다.
- `Inbox` 밖의 Status로 전환하려면 Project가 필요하다.

Home:

- My Focus
- Team in Motion
- Waiting
- Needs Attention
- Coming Next

My Work:

- Today
- This Week
- In Progress
- Waiting
- Review Requested
- Later

Home과 My Work에서 Status·Due·Waiting·Review 요청을 1~2번의 조작으로 변경한다.

### 2.7 검색과 필터

통합 검색:

- Title
- Project 이름
- Assignee 이름

기본 필터:

- Project
- Assignee
- Status
- Due: 오늘, 이번 주, 기한 초과, 날짜 없음

검색어와 필터를 조합할 수 있어야 한다. 결과 없음, 필터 초기화, 로딩, 조회 실패 상태를 제공한다.

### 2.8 Waiting과 Dependency

Waiting 유형:

- External Reply
- Internal Approval
- Material / Asset
- Predecessor Task
- Decision
- Blocked
- Other

Status를 `Waiting`으로 바꿀 때 다음 값을 입력한다.

- 기다리는 내용
- 기다리는 상대
- 내부 Owner
- Follow-up 날짜와 선택적 시간
- Blocked인 경우 사유와 해결 행동

Dependency:

- 이번 복구 범위는 Finish-to-Start만 지원한다.
- 자기참조·순환·다른 Workspace 연결을 차단한다.
- 다른 Project 연결 시 경고한다.
- 선행 Task가 남아 있는 후속 Task 시작 시 경고한다.
- 선행 Task 완료 시 후속 Task를 실행 가능으로 표시한다.
- 상세 패널에 `Predecessor → Current → Successor`를 표시한다.

Follow-up이 지난 Waiting Task는 Home의 Needs Attention에 자동 노출한다.

### 2.9 Milestone

- Project 안에서 Milestone 이름과 Due date를 생성·수정한다.
- Project 목록과 Workspace에 다음 Milestone을 표시한다.
- 7일 안에 도래하는 Milestone을 Coming Next에 표시한다.
- Milestone 삭제가 필요하면 hard delete 대신 보관 또는 명시적 확인이 가능한 방식을 사용한다.

### 2.10 Team 가시성

Team 화면:

- 팀원별 In Progress
- 이번 주 Due
- Overdue
- Waiting
- Review
- 활성 Task 수
- 담당 Project 수
- Project별 Attention

성과 순위와 생산성 점수는 만들지 않는다.

### 2.11 모바일과 접근성

390px 화면에서 데스크톱 4열 캔버스를 축소하지 않는다.

- 기본 화면은 단일 열 업무 목록이다.
- 업무 제목과 본문은 확대 없이 읽을 수 있다.
- 업무 추가·상세 편집·완료·완료 해제·취소가 가능하다.
- 터치 대상은 최소 44×44px을 권장하고 32×32px 아래로 만들지 않는다.
- 키보드 포커스가 보이고 아이콘 버튼에 accessible name이 있다.
- 상태는 색상과 텍스트를 함께 사용한다.
- reduced motion과 시스템 명암 모드를 유지한다.

## 3. 이번 복구에서 제외할 기능

- 반복 업무
- AI Quick Add 파싱
- AI Task 분해와 Next Action 제안
- Google Calendar 읽기·쓰기
- Timeline/Gantt
- 정밀 Team Load와 자동 재배분
- Comment·Mention·Attachment
- 캔버스 시각효과·줌·팬 고도화
- 하위 업무 기능 추가 확장

이 기능들은 Pilot Ready 게이트 통과 전까지 구현하지 않는다.

## 4. 데이터·API 복구

### 4.1 기존 필드 재사용

현재 Task의 다음 필드는 유지한다.

- `id`
- `workspace_id`
- `project_id`
- `workstream_id`
- `parent_task_id`
- `title`
- `description`
- `status`
- `assignee_id`
- `reviewer_id`
- `start_date`
- `due_date`
- `version`
- `created_by`
- `created_at`
- `updated_at`
- `completed_at`
- `cancelled_at`

### 4.2 additive migration

기존 migration을 변경하지 않고 다음 순번 migration으로 추가한다.

Task 추가 필드:

- `sort_order integer not null default 0`
- `due_time text nullable`: Workspace timezone 기준 `HH:mm`
- `waiting_type text nullable`
- `waiting_on_text text nullable`
- `waiting_party_text text nullable`
- `waiting_owner_member_id text nullable`
- `follow_up_at text nullable`: ISO datetime
- `blocked_reason text nullable`
- `blocked_resolution_action text nullable`

TaskDependency:

- `id`
- `workspace_id`
- `predecessor_task_id`
- `successor_task_id`
- `dependency_type = finish_to_start`
- `created_at`

필수 제약:

- 같은 Project의 `sort_order` 조회를 위한 index
- predecessor와 successor의 중복 연결 방지
- 자기참조 방지
- Member·Project·Task의 Workspace 소속 검증

기존 행의 `sort_order`는 Project와 parent 범위에서 `created_at`, `id` 순으로 backfill한다. 기존 Due 계산은 `due_date`를 계속 사용하며 `due_time`은 선택 정보로 취급한다.

### 4.3 원자적 동시수정

Task 변경은 다음 절차를 따른다.

1. 클라이언트가 `baseVersion`을 전송한다.
2. 서버가 입력과 Workspace 소속을 검증한다.
3. `WHERE id = taskId AND workspace_id = currentWorkspace AND version = baseVersion` 조건으로 UPDATE한다.
4. 갱신 행이 없으면 Stale Version 오류를 반환한다.
5. 성공 시 version을 1 증가시키고 Task 변경과 Activity Log를 같은 원자적 작업으로 처리한다.

Project·Workstream·Milestone 변경도 현재 Workspace·Project 소속을 조건에 포함한다.

### 4.4 Activity Log

다음 변경을 기록한다.

- Title·Description
- Project·Workstream
- Assignee·Reviewer
- Status·Review 요청
- Start·Due·Due time
- Waiting·Follow-up·Blocked
- Dependency 추가·제거
- 완료·완료 해제
- 취소·복구
- 업무 순서
- Project 보관·복구

민감한 Description 전문을 Activity Log에 복제하지 않는다. 변경 종류와 필요한 최소 값만 기록한다.

## 5. 데이터 보호와 rollback

모든 migration은 다음 순서로 검증한다.

1. 기존 migration과 작업 트리 상태 확인
2. 로컬 D1 복사본에 migration 적용
3. 기존 데이터 조회·정렬·상태 계산 회귀 테스트
4. staging D1 백업 또는 export
5. staging migration과 E2E
6. 운영 D1 Time Travel 가능 상태와 export 확인
7. 사용자 승인 후 운영 migration
8. 운영 health check와 읽기 검증

rollback 준비:

- migration 전 D1 export 보관
- 배포 전 Worker 버전 식별
- 이전 Worker 버전으로 되돌리는 절차 확인
- 새 schema가 적용된 뒤에도 이전 데이터가 유지되는지 확인
- 실패 시 hard delete나 reset 대신 Worker rollback 또는 D1 Time Travel 사용

## 6. 구현 순서와 게이트

각 단계는 정상 흐름·오류 흐름·빈 상태·로딩 상태·권한 오류·모바일 기본 동작을 포함한다. 통과 조건을 충족하기 전에는 다음 단계로 넘어가지 않는다.

### R0: 기준선 고정

구현:

- 지침과 dirty worktree 확인
- 기존 앱 실행
- 현재 unit·integration test, typecheck, production build 결과 기록
- 기존 Project·Task가 새 migration 전 정상 조회되는지 확인
- staging 또는 test Workspace 준비
- 핵심 E2E 테스트 구조 준비

통과 조건:

- 신규 앱 생성 없이 현재 `app/`이 실행된다.
- 관련 없는 사용자 변경사항이 보존된다.
- 기존 데이터와 테스트 기준선이 기록된다.

### R1: 인증·Workspace·쓰기 안전성

구현:

- 자동 admin 진입 제거
- 실제 세션 검증과 보호 경로 복구
- Team Member와 Team Admin 권한 적용
- 모든 조회·서버 액션·서비스에 Workspace 경계 적용
- additive migration
- 원자적 version UPDATE

통과 조건:

- 미인증 접근을 차단한다.
- 다른 Workspace ID를 이용한 직접 읽기·쓰기를 차단한다.
- Member는 활성 Project·Task를 생성·수정할 수 있다.
- Project 보관·복구와 팀 관리는 Admin만 수행한다.
- Stale Version 저장이 기존 값을 덮어쓰지 않는다.

### R2: Project와 목록형 업무 관리

구현:

- Project 생성·수정·보관·복구
- Workstream 생성·수정·순서 변경
- Milestone 생성·수정
- Project 안의 최상위 Task 인라인 추가
- `ProjectTaskList`, `TaskRow`, 완료 목록
- 완료·완료 해제
- 업무 순서 변경

통과 조건:

- Project·Workstream·Milestone을 만들고 수정한 뒤 새로고침해도 값이 유지된다.
- Project에서 제목만 입력해 최상위 Task를 생성한다.
- 완료와 완료 해제가 한 번의 조작으로 끝난다.
- 완료 개수와 목록이 즉시 갱신된다.
- 업무 순서를 바꾸고 새로고침해도 순서가 유지된다.

### R3: 업무 상세 편집

구현:

- 편집형 `TaskDetailPanel`
- Title·Description
- Project·Workstream
- Assignee·Reviewer
- Start·Due·Due time
- 6개 Status
- Review 요청
- 취소·복구
- 저장 상태·오류·충돌 UI

통과 조건:

- 제목·상태·담당자·마감 변경이 각각 1~2번의 조작으로 끝난다.
- 세부내용과 선택적 시간을 저장하고 다시 열어 확인한다.
- Review 요청 시 Reviewer와 Review 상태가 함께 저장된다.
- 취소된 Task는 일반 목록에서 제외되고 Archive에서 복구된다.
- 저장 실패와 충돌 시 기존 서버 데이터를 잃지 않는다.

### R4: Inbox·Home·My Work·검색

구현:

- Team Inbox 전용 목록과 정리 동선
- Home의 My Focus·Team in Motion·Waiting·Needs Attention·Coming Next
- My Work 빠른 변경
- 실제 통합 검색
- Project·Assignee·Status·Due 필터

통과 조건:

- Quick Add Task가 Team Inbox에 즉시 보인다.
- Inbox Task에 Project·담당자·마감·Status를 지정해 실행 Task로 전환한다.
- 앱을 연 뒤 10초 안에 지금 할 일과 대기·확인 필요 업무를 구분한다.
- 검색어와 필터를 조합하고 초기화할 수 있다.

**Core Task MVP 게이트:** R0~R4 통과

### R5: Waiting과 직접 Workflow

구현:

- Waiting 전용 필드
- Follow-up과 Needs Attention
- TaskDependency
- 선행조건 경고
- Successor 활성화
- Flow Strip
- Workflow Canvas를 보조 보기로 연결

통과 조건:

- 모든 Waiting Task에 대기 내용·상대·Owner·Follow-up이 존재한다.
- Follow-up 초과 Task가 Needs Attention에 보인다.
- 자기참조·순환·다른 Workspace Dependency를 차단한다.
- 선행 완료 전 시작 경고와 완료 후 Successor 활성화가 작동한다.

**Workflow MVP 게이트:** R0~R5 통과

### R6: Team·모바일·릴리스 강화

구현:

- Team 가시성 화면
- Project별 Attention
- 390px 단일 열 목록과 모바일 상세 시트
- 빈·로딩·저장 실패·권한 오류 상태
- 키보드·스크린리더 기본 접근성
- staging 전체 E2E
- 운영 backup·rollback·배포 준비

통과 조건:

- 팀 리드가 누가 무엇을 진행하고 기다리는지 한 화면에서 확인한다.
- 모바일에서 Task 추가·편집·완료·완료 해제·취소가 가능하다.
- 운영 데이터 변경 없이 staging E2E가 모두 통과한다.
- 배포 전 D1 backup과 Worker rollback 경로를 확인한다.

**Pilot Ready 게이트:** R0~R6 통과

## 7. 필수 테스트

### 7.1 기능 E2E

1. Project 생성·수정 → 새로고침 → 값 유지
2. Workstream 생성·수정·순서 변경 → 값 유지
3. Milestone 생성·수정 → Project의 다음 Milestone 반영
4. Project 내 최상위 Task 생성 → 목록 즉시 반영
5. 완료 → 완료 목록 이동 → 완료 해제 → 직전 상태 복구
6. Task 드래그 순서 변경 → 새로고침 → 순서 유지
7. Title·Description·Project·Workstream·Assignee·Due time 수정 → 재진입 → 값 유지
8. Review 요청 → Reviewer·Review 상태 저장
9. Task 취소 → 일반 목록 제외 → Archive 복구
10. Quick Add → Team Inbox → Project·담당자·마감 지정 → ToDo 전환
11. 통합 검색과 필터 조합 → 정확한 결과·결과 없음·초기화
12. Waiting 입력 → Follow-up 초과 → Needs Attention 노출
13. Dependency 추가 → 시작 경고 → 선행 완료 → Successor 활성화
14. Team 화면에 팀원·Project별 상태 반영
15. 모바일 Project 열기 → Task 추가 → 상세 수정 → 완료·완료 해제

### 7.2 오류·보안 E2E

1. 빈 제목·공백 제목·200자 초과 제목 거부
2. 잘못된 Status·날짜·시간 형식 거부
3. Inbox 밖의 상태에서 Project 누락 거부
4. 다른 Project의 Workstream 연결 거부
5. 취소된 Task 수정·완료 거부
6. 두 탭 동시수정에서 오래된 저장 거부
7. 저장 실패 시 UI rollback과 재시도
8. 미인증 접근 거부
9. 다른 Workspace Project·Task 직접 접근 거부
10. Member의 Admin 전용 Project 보관·복구 거부

### 7.3 코드 검증

- 기존 unit·integration test
- 새 schema·validation·service 테스트
- Dependency 순환 검증 테스트
- Waiting·Follow-up·Needs Attention 계산 테스트
- 완료 해제와 직전 Status 복구 테스트
- 원자적 Stale Version 통합 테스트
- Workspace 경계와 role 권한 테스트
- `npm run typecheck`
- `npm run build`

## 8. 최종 완료 정의

Core Task MVP:

- R0~R4 통과
- Project·Workstream·Milestone·Task의 필수 생성·수정 흐름 동작
- 목록형 완료·복구·순서 변경 동작
- 상세 편집·Inbox·검색·필터 동작

Workflow MVP:

- Core Task MVP 통과
- R5 통과
- Waiting·Follow-up·Dependency·Successor 동작

Pilot Ready:

- Workflow MVP 통과
- R6 통과
- 기능 E2E 15개와 오류·보안 E2E 10개가 staging에서 통과
- unit·integration test, typecheck, production build 통과
- 운영 backup·rollback 준비
- 사용자 승인 후 운영 배포
- 배포 후 health check와 읽기 검증
- QA 재검증 점수 0.80 이상

반복 업무, AI, Google Calendar, 고급 Timeline과 Team Load는 Pilot Ready 이후 별도 계획으로 진행한다.
