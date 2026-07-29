# UI/UX 및 기능 업데이트 계획

**상태:** pending approval  
**대상:** Marketing Team Workflow 내부 도구  
**작성일:** 2026-07-27  
**수정:** 적층 워크플로우·컴팩트 입력안 반영

## 1. 목표와 요구사항

이 제품의 일차 목적은 세 명의 팀원이 각자 업무를 빠르게 입력하고 관리하는
것이다. 동시에 아홉 개 브랜드에서 진행되는 프로젝트와 업무를 서로 확인하여
협업, 조언, 지시가 필요한 지점을 판단할 수 있어야 한다.

운영 규모는 브랜드별 동시 프로젝트 1~2개, 프로젝트별 업무 3~4개로, 대략
9~18개 프로젝트와 27~72개의 활성 업무다.

업데이트의 목표는 다음과 같다.

1. 현재의 차분하고 모던한 시각 방향을 유지하면서 정보 밀도를 한 단계 높인다.
2. 글로벌 내비게이션과 보드 전용 제어가 섞인 상단 정보 체계를 정리한다.
3. 기존 브랜드 → 프로젝트 → 업무 → 하위 업무 워크플로우를 유지한다.
4. 브랜드 → 프로젝트 → 업무 → 하위업무를 부모 관계대로 적층해, 현재 진행 업무의 구조와 협업 지점을 한 화면에서 읽게 한다.
5. 이 적층 보드와 별도로, 현재 진행 업무를 담당자·상태 기준으로 읽는 `진행 흐름` 탭을 추가한다.
6. 각 팀원의 업무량과 압박 신호를 현재 시점 기준으로 보여준다.
7. 업무별 댓글, 멘션, 앱 내부 알림함을 추가한다.
8. 삭제/취소 의미, 동시 수정 rollback, 피드백·접근성·모바일 문제를 보완한다.

## 2. 범위에서 제외

- 자동 업무 배분과 성과 평가
- 업무량을 하나의 점수로 환산하는 기능
- 예상 소요량·난이도·가중치 입력
- 과거 업무량 추세와 분석 차트
- Slack, 이메일 등 외부 알림 연동
- 자유 배치 그래프, 확대/축소, 미니맵
- 초기 버전의 drag-and-drop 상태 변경
- 프로젝트의 `완료 n/m`과 업무 개수 기반 progress bar
- 기본 입력 화면의 오늘 마감·내일 마감·핵심 업무 빠른 선택 chip
- 별도의 관리자 권한 체계와 강제 로그인

신뢰된 사내 사용자 세 명이 하나의 workspace를 공유하므로 현재의 멤버 선택
방식은 유지한다. 로그인처럼 보이지만 실제 보호 경계가 아닌 화면은 노출 정책을
정리한다. 현재 fallback 모델은
`src/server/data/queries.ts:23-58`에 명시돼 있다.

## 3. 현재 상태 평가

### 강점

- surface, text, accent, status, flag 토큰이 의미 단위로 구성돼 있다:
  `src/styles/globals.css:24-81`.
- light/dark 및 reduced motion/transparency/high contrast 대응이 있다:
  `src/styles/globals.css:118-210`, `328-357`.
- Button, Card, Badge, StatusBadge, Input primitive가 이미 있다:
  `src/components/ui/index.ts:1-18`.
- optimistic update, 충돌 감지, 취소 복구, 검색과 필터의 기능 기반이 있다.
- 현재 기준 TypeScript 검사와 Vitest 236개가 모두 통과한다.

### 해결할 문제

- 디자인 문서의 하드코딩 금지 규칙과 실제 arbitrary type/radius/shadow 사용이
  충돌한다: `DESIGN_SYSTEM.md:14-27`,
  `src/components/workflow/WorkflowCanvas.tsx:1010-1055`.
- 문서는 웹폰트 금지를 규정하지만 Pretendard CDN을 import한다:
  `DESIGN_SYSTEM.md:65-69`, `src/styles/globals.css:1-2`.
- 글로벌 헤더 아래에 보드 제목, 브랜드 필터, 생성 버튼, 그룹 기준, 계층 경로,
  상태 필터, 단계 요약이 여러 줄로 분산돼 업무 영역을 압박한다:
  `src/components/HomeContent.tsx:234-340`,
  `src/components/workflow/WorkflowCanvas.tsx:1010-1057`.
- Quick Add가 수동 overlay와 중첩 dialog role을 사용해 focus trap, Escape,
  focus return을 보장하지 못한다:
  `src/components/NavBar.tsx:234-264`, `src/components/QuickAdd.tsx:45-54`.
- `내 업무`의 비상호 배타적 섹션에 같은 업무가 중복될 수 있다:
  `src/components/MyWorkContent.tsx:52-63`.
- Canvas의 `삭제`는 실제 hard delete가 아닌 cancel 동작이다:
  `src/components/workflow/WorkflowCanvas.tsx:162-176`, `242-246`.
- optimistic update 실패가 전체 task 배열 snapshot을 복구하여 병렬 수정과
  충돌할 수 있다: `src/components/tasks/useTaskStore.ts:76-89`.
- route 단위 loading/error UI, activity retry, 생성·수정 성공 피드백이 부족하다.
- `/team`은 비기능 placeholder다: `src/app/(app)/team/page.tsx:3-22`.
- UI interaction, keyboard, mobile, dark mode를 검증하는 E2E가 없다.

## 4. 목표 정보 구조

### 4.1 글로벌 헤더

글로벌 헤더에는 앱 전체에서 항상 필요한 항목만 둔다.

- 좌측: 워드마크
- 주 내비게이션: `홈`, `내 업무`, `팀 현황`
- 우측: 검색, 통합 `추가`, 알림, 현재 멤버

알림은 bell 아이콘과 unread badge로 표시한다. 멤버 전환은 현재 avatar/name
control을 유지하되 제출 버튼이라는 내부 구현이 보이지 않도록 메뉴 형태로
정리한다.

수정 중심 파일:

- `src/components/NavBar.tsx:17-27`, `71-230`
- `src/app/(app)/layout.tsx:22-38`

### 4.2 홈의 로컬 헤더

현재 여러 줄의 제어 영역을 두 줄로 압축한다.

**첫 줄 — 화면 정체성과 범위**

- 좌측: `업무 보드`와 브랜드·프로젝트·활성 업무 수
- 우측: 브랜드 필터와 contextual create menu

**둘째 줄 — 보기 전환과 현재 보기에 필요한 필터**

- 좌측 탭: `워크플로우`, `진행 흐름`
- 우측: 상태 범위(`진행 업무` 기본값, `완료 업무` on-demand)와 현재 탭에만 필요한 focus filter

항상 노출되는 `브랜드 > 프로젝트 > 업무 > 하위 업무` 설명은 제거한다.
기본 보드에서 `완료` stage/column은 제거한다. 완료 업무는 이 상태 범위를
`완료 업무`로 전환했을 때만 별도 compact 목록으로 확인한다. 브랜드 생성과
프로젝트 생성은 `만들기` 메뉴로 합치되, 전역 `추가`의 빠른 업무 기록과
중복되지 않게 역할을 구분한다.

로컬 헤더와 두 탭을 `HomeContent` 바깥의 독립 component로 분리하여
`WorkflowCanvas` 내부 toolbar 책임을 줄인다.

수정 중심 파일:

- `src/components/HomeContent.tsx:208-343`
- `src/components/workflow/WorkflowCanvas.tsx:1010-1057`
- 신규 `src/components/workflow/BoardHeader.tsx`

## 5. 핵심 화면 계획

### 5.1 워크플로우 탭

워크플로우는 stage lane이 아니라 **부모 관계를 보존한 적층 보드**다.
브랜드 아래에 프로젝트를 세로로 쌓고, 각 프로젝트 아래에 업무를 쌓으며,
각 업무의 하위업무만 바로 오른쪽의 compact 묶음으로 둔다. 이 탭은 “누가
무엇을 하는가”보다 먼저 “어떤 일이 어디에 속하고, 어느 업무에서 협업이
필요한가”를 읽는 화면이다.

- 기본 상태 범위는 진행 업무다. `완료` stage/column, `완료 n/m`, progress
  bar는 렌더하지 않는다. 상단 상태 범위에서 `완료 업무`를 선택한 경우에만
  완료 항목을 brand/project/task 한 줄 목록으로 전환한다.
- `WorkflowCanvas.tsx:48-71`의 완료 stage 정의와 `:608-614`의 완료 cell
  배치를 제거하고, `:916-927`의 원본 배열 순회 대신 `parentTaskId`로
  하위업무를 parent task에 연결한다. 하위업무는 입력순서가 아닌 parent
  업무 바로 아래에서만 한 번 렌더한다.
- 각 업무 카드의 기본 높이는 내용 기반으로 계산한다. 제목과 `상태 · 담당자`
  metadata만 한 줄에 두며, 고정된 빈 footer와 96px 이상 최소 card height는
  없앤다. 관련 geometry는 `WorkflowCanvas.tsx:348-374`, `:420-439`,
  `:672-703`, `:757-820`, `:1063-1092`다.
- 하위업무는 제목만 보이는 compact button/pill로 표현하고, hover/focus에는
  세부 내용을 tooltip으로, click에는 기존 `TaskDetailPanel`을 연다. child card에
  parent title을 반복 출력하는 `WorkflowCanvas.tsx:1343-1344`, `:1380-1387`는
  제거한다.
- 프로젝트 card의 `완료 n/m`과 progress bar(`WorkflowCanvas.tsx:1200-1234`)는
  제거한다. 업무 수는 진척률의 대리 지표가 아니므로 프로젝트 명과 필요 시
  마감일만 남긴다.
- 중복된 제목, 생성, 상태 필터 UI는 외부 `BoardHeader`로 이동한다.
- 데스크톱에서는 적층 board, 모바일에서는 같은 parent grouping을 유지하는
  list 대체 보기를 초기 CSS breakpoint부터 결정하여 hydration 후 전환 flash를
  없앤다.
- Canvas의 `삭제`를 `업무 취소`로 변경하고 복구 가능함을 명시한다.
- action 실패는 공통 live region에 표시한다.

수정 중심 파일:

- `src/components/workflow/WorkflowCanvas.tsx`
- `src/components/HomeContent.tsx:54-69`, `208-343`
- `src/components/tasks/useTaskStore.ts:76-107`

### 5.1a 업무 입력

업무 입력은 빠른 기록을 방해하지 않는 작은 solid panel로 정리한다. 기본 담당자는
현재 입력자이며, 기본 화면에는 업무명·세부 내용·마감일·프로젝트 맥락만 둔다.

- `TaskFormDialog.tsx:70`, `:79-96`의 빈 assignee 초기화를 현재 멤버 id로
  바꾸고, `HomeContent.tsx:414-428`, `ProjectWorkspace.tsx:377-391`에서
  caller가 동일한 current member를 전달한다.
- 오늘 마감·내일 마감·핵심 업무 chips(`TaskFormDialog.tsx:203-213`)를
  삭제한다. 이들은 현재 업무의 중요도나 일정의 사실을 정확히 표현하지 못한다.
- 담당자 변경, 업무 영역, 상태, 시작일, 업무 유형 등은 `추가 입력 펼치기`
  disclosure 안으로 옮긴다. 기본 폼은 큰 gray overlay가 아닌 좁은 white/solid
  surface, 한 column 우선 layout, 명확한 primary action을 사용한다.
- project/workstream parent에서 새 업무를 만들면 기존처럼 그 맥락을 상속하되,
  최종 저장 전 project만 변경 가능하게 둔다.

수정 중심 파일:

- `src/components/tasks/TaskFormDialog.tsx:70-135`, `:190-312`
- `src/components/HomeContent.tsx:414-428`
- `src/components/projects/ProjectWorkspace.tsx:377-391`

### 5.2 진행 흐름 탭

새 탭은 자유 배치 그래프가 아니라 **담당자 swimlane × 진행 상태 pipeline**으로
구성한다.

열:

1. 할 일
2. 진행 중
3. 대기
4. 검토

행:

- 팀원 세 명
- 미배정

각 업무는 정확히 하나의 cell에만 표시한다. 카드에는 브랜드 색상, 프로젝트,
업무명, 마감일, 핵심 여부만 표시하고 클릭하면 기존 `TaskDetailPanel`을 연다.
완료·취소 업무는 기본 화면과 workload count에서 제외한다. `완료 n/m`처럼
업무 개수를 프로젝트 진척률로 해석하는 표시는 어느 탭에도 추가하지 않는다.

업무량을 허위 정밀도의 단일 점수로 만들지 않고 각 담당자 행 앞에 다음 현재
신호를 병렬 표시한다.

- 활성 업무
- 이번 주 마감
- 기한 초과
- 대기/막힘
- 핵심 업무

브랜드 필터와 `전체/지금 할 일/대기/기한 초과` focus는 두 탭에서 공유한다.
브랜드 9개 전체를 선택한 경우에도 viewport 안에서 담당자와 상태의 관계를
먼저 읽을 수 있게 compact card를 사용하며, overflow는 가로 스크롤로
처리한다. 초기 버전에는 zoom, pan, drag 상태 변경을 넣지 않는다.

기존 `Task`, status metadata, member map, brand/project 데이터를 그대로
사용하므로 신규 그래프 라이브러리는 추가하지 않는다.

신규/수정 중심 파일:

- 신규 `src/components/workflow/ProgressFlow.tsx`
- 신규 `src/lib/workload.ts`
- `src/components/HomeContent.tsx`
- `src/lib/status.ts:11-78`
- `src/server/db/schema.ts:111-179`

### 5.3 내 업무

개인의 빠른 실행 화면이라는 역할을 유지한다.

- 한 업무가 여러 섹션에 반복되지 않도록 canonical section 우선순위를 둔다.
- 다른 성격은 badge로 표현한다. 예: `진행 중` section의 업무에
  `오늘 마감`, `핵심` badge를 부착한다.
- 빠른 완료, 상세 열기, 저장 상태와 오류 rollback은 유지한다.

수정 중심 파일:

- `src/components/MyWorkContent.tsx:52-63`, `100-151`
- `src/lib/derive.ts:170-221`
- `src/components/tasks/TaskRow.tsx`

### 5.4 팀 현황

placeholder `/team`을 세 명 모두가 쓰는 현재 상황판으로 바꾼다.

- 각 팀원별 활성 업무, 이번 주 마감, 기한 초과, 대기/막힘, 핵심 업무를 표시한다.
- 팀원 카드를 선택하면 해당 팀원의 활성 업무를 상태별로 보여준다.
- 업무를 클릭하면 동일한 `TaskDetailPanel`을 연다.
- 자동 배정, 상대 순위, 성과 점수, 과거 추세는 표시하지 않는다.
- 화면의 언어는 `업무량`, `마감 집중`, `확인 필요`처럼 관찰 가능한 사실에
  한정하고 `과부하`, `성과 저조` 같은 평가 표현을 피한다.

수정 중심 파일:

- `src/app/(app)/team/page.tsx:3-22`
- 신규 `src/components/team/TeamOverview.tsx`
- 신규 `src/lib/workload.ts`
- `src/server/data/queries.ts:65-75`

## 6. 댓글·멘션·내부 알림

### 데이터 모델

신규 migration에 다음 세 테이블을 추가한다.

1. `task_comment`
   - id, workspace_id, task_id, author_id, body, created_at, edited_at
2. `comment_mention`
   - id, comment_id, mentioned_member_id
3. `notification`
   - id, workspace_id, recipient_id, actor_id, task_id, comment_id,
     type, read_at, created_at

댓글 삭제는 초기 범위에서 제외한다. 오입력 수정이 필요하므로 작성자 본인의
댓글 편집만 허용하고 edited 상태를 표시한다. mention parsing은 멤버 id를
기준으로 저장하며, 댓글 본문 문자열만을 권한·알림의 원천으로 사용하지 않는다.

### 서버 기능

- workspace와 현재 멤버를 검증한 댓글 생성/수정 action
- task별 댓글 조회
- 현재 멤버의 최근 알림 조회
- 단일 및 전체 읽음 처리
- 자기 자신을 멘션한 경우 알림 생성 제외
- 같은 댓글에서 같은 사용자를 여러 번 멘션해도 알림은 하나만 생성

기존 action/service 구조와 Zod validation을 재사용한다.

신규/수정 중심 파일:

- 신규 `drizzle/migrations/0007_comments_notifications.sql`
- `src/server/db/schema.ts:218-236` 이후
- 신규 `src/server/services/comment.ts`
- 신규 `src/server/services/notification.ts`
- 신규 `src/app/actions/comments.ts`
- 신규 `src/app/actions/notifications.ts`
- `src/server/data/queries.ts`

### UI

- `TaskDetailPanel`의 변경 이력 위에 `댓글` section을 추가한다.
- composer에서 `@` 입력 시 workspace 멤버 세 명을 제안한다.
- 댓글 작성, 실패, 재시도 상태를 inline으로 표시한다.
- 글로벌 헤더 bell에서 unread 알림 목록을 연다.
- 알림 선택 시 해당 task detail과 댓글 위치를 연다.
- 새 댓글과 mention을 `aria-live`로 알리되 자기 작성 성공은 과도한 toast 대신
  composer 상태로 확인한다.

수정 중심 파일:

- `src/components/tasks/TaskDetailPanel.tsx:650-666`
- 신규 `src/components/comments/CommentThread.tsx`
- 신규 `src/components/notifications/NotificationMenu.tsx`
- `src/components/NavBar.tsx`

## 7. 디자인 시스템 정리

시각적 재설계가 아니라 현재 토큰 시스템과 구현을 다시 맞춘다.

1. arbitrary radius, shadow, blur, 반복 type size를 기존 token으로 교체한다.
2. Select, DialogField, Textarea primitive를 실제 반복이 확인되는 범위에서만
   추가한다.
3. `font-serif` 사용은 제거하거나 명시적 display token을 정의한다.
4. 폰트 정책을 하나로 통일한다.
   - 권장: system font 우선, Pretendard는 local/system fallback으로 사용
   - CDN 유지 시 문서의 `웹폰트 금지` 규칙을 수정하고 network failure를
     허용 가능한 fallback으로 명시
5. tab, segmented control, filter chip의 height와 pressed/focus/disabled
   상태를 공통화한다.
6. 숫자·업무량은 tabular numerals를 사용한다.
7. 한국어 heading에는 balance/keep-all을 적용하고 body line-height를 유지한다.

Supanova의 landing-page용 과장된 bento, marquee, parallax는 내부 업무 도구에
적용하지 않는다. Apple식 즉시 press feedback, 공간적 일관성, restraint,
reduced-motion 대응만 제품 맥락에 맞게 유지한다.

수정 중심 파일:

- `src/styles/globals.css`
- `tailwind.config.ts`
- `DESIGN_SYSTEM.md`
- `src/components/ui/*`
- `src/components/workflow/WorkflowCanvas.tsx`
- `src/components/tasks/TaskDetailPanel.tsx`
- `src/components/projects/ProjectFormDialog.tsx`

## 8. 상태·접근성·신뢰성

### 상태

- route별 `loading.tsx`, `error.tsx`와 retry를 추가한다.
- activity와 댓글에는 loading, empty, error, retry를 모두 제공한다.
- 저장 debounce를 닫을 때 flush하고 실패 맥락을 유지한다.
- 생성·취소·복구 성공은 짧은 공통 status/live-region으로 확인한다.

### 접근성

- Quick Add를 설치된 Radix Dialog로 교체한다.
- focus trap, Escape dismiss, trigger focus return을 검증한다.
- 프로젝트 tab에 `tablist`, `aria-controls`, `tabpanel` 연결을 추가한다.
- icon-only control은 accessible name과 32px 이상의 hit target을 갖는다.
- 진행 흐름은 시각적 grid 외에 screen reader용 row/column heading과 업무
  목록 의미를 제공한다.
- motion은 transform/opacity 중심으로 유지하고 reduced-motion에서는
  cross-fade/static 상태로 대체한다.

### 동시 수정

`useTaskStore`의 rollback을 전체 배열이 아니라 해당 task id/version 단위로
격리한다. 서버 성공 응답의 version이 최신 optimistic write보다 오래된 경우
덮어쓰지 않는다. 댓글 작성과 notification 읽음도 중복 요청에 안전하게 만든다.

## 9. 구현 단계

### Phase 0 — 의미와 상태 안정화

1. Canvas `삭제`를 `업무 취소`로 통일한다.
2. task 단위 optimistic rollback과 동시 write 검증을 추가한다.
3. 저장·action 실패를 공통 live region에 노출한다.
4. 내부 도구의 멤버 선택 정책과 login 노출 정책을 문서화한다.

### Phase 1 — 상단 정보 체계와 디자인 시스템

1. 글로벌 헤더에 `팀 현황`과 알림 위치를 확보한다.
2. `BoardHeader`를 만들고 로컬 제어를 두 줄로 압축한다.
3. `워크플로우/진행 흐름` 탭 구조를 추가한다.
4. 진행 업무 기본 범위와 on-demand 완료 업무 범위를 `BoardHeader`에 추가한다.
5. arbitrary style과 font 정책 불일치를 정리한다.
6. Quick Add와 tab 접근성을 수정한다.

### Phase 1a — 적층 보드와 입력 밀도

1. `WorkflowCanvas`의 완료 stage/column, project completion ratio, progress bar를 제거한다.
2. brand → project → task → child task의 parent-grouped layout과 compact geometry를 구현한다.
3. 하위업무 tooltip/focus와 기존 detail panel opening을 연결한다.
4. `TaskFormDialog` 기본 담당자·기본 필드·추가 입력 disclosure를 구현한다.
5. 9 brand/72 active task fixture로 적층 보드의 높이와 parent grouping을 확인한다.

### Phase 2 — 진행 흐름과 팀 현황

1. workload derivation을 pure function으로 구현하고 단위 검증한다.
2. `ProgressFlow` 담당자 swimlane을 구현한다.
3. 모바일 compact list 대체 보기를 제공한다.
4. `/team` current snapshot 화면을 구현한다.
5. 기존 상세 panel을 두 화면에서 재사용한다.

### Phase 3 — 댓글·멘션·알림

1. migration과 schema를 추가한다.
2. comment/mention/notification service와 action을 구현한다.
3. task detail 댓글 thread를 구현한다.
4. 글로벌 notification menu와 읽음 처리를 구현한다.
5. loading/error/retry와 keyboard flow를 검증한다.

### Phase 4 — 개인 업무와 품질 게이트

1. `내 업무` canonical section 규칙으로 중복을 제거한다.
2. route loading/error boundary를 추가한다.
3. 핵심 E2E, axe, responsive/dark-mode screenshot 검사를 추가한다.
4. 문서와 코드의 디자인 시스템 준수를 최종 점검한다.

## 10. 승인 기준

### 정보 구조와 디자인

- 1440px 화면에서 글로벌 헤더와 홈 제어 영역이 합계 152px 이하이며,
  그 아래부터 업무 콘텐츠가 시작된다.
- 글로벌 헤더에는 전역 기능만, `BoardHeader`에는 보드 전용 기능만 존재한다.
- `워크플로우`와 `진행 흐름` 탭 전환 시 브랜드/focus 필터가 유지된다.
- 기본 워크플로우에 `완료` column/stage, `완료 n/m`, project progress bar가
  존재하지 않는다. 완료 업무는 상단 상태 범위를 바꾼 뒤 두 번 이내의 상호작용으로
  열리고, 다시 진행 업무로 복귀할 수 있다.
- fixture의 모든 하위업무는 `parentTaskId`가 가리키는 parent 업무 아래에 정확히
  한 번만 렌더되며, 하위업무 표면에는 parent 업무명이 반복되지 않는다.
- 펼치지 않은 desktop task card는 제목 및 status/assignee metadata 한 줄만
  사용하고 64px 이하이며, subtask item은 36px 이하이다. 고정 `worldH` 하단
  여백은 24px 이하이고, 기존 fixture 대비 board content 높이는 40% 이상 줄어든다.
- 프로젝트에는 업무 개수 기반 완료율이나 progress bar가 없고, 진행 흐름·팀 현황의
  count도 완료 업무를 제외한다.
- 새 업무 dialog의 최초 화면에는 업무명, 세부 내용, 마감일, 프로젝트 맥락만
  보이며 현재 입력자가 담당자로 설정된다. 오늘/내일/핵심 chips는 없다. 추가
  필드는 한 개의 keyboard-accessible disclosure에서 열고 닫힌다.
- 390px, 768px, 1440px에서 가로 page overflow가 발생하지 않는다.
  진행 흐름 내부의 의도된 horizontal scroller는 예외다.
- light/dark/system theme에서 primary/secondary text와 control이 WCAG AA를
  만족한다.
- `prefers-reduced-motion`에서 slide, spring, stagger 없이 의미 있는 상태
  변화가 유지된다.

### 진행 흐름과 팀 현황

- 활성 업무는 진행 흐름의 담당자 × 상태 cell에 정확히 한 번만 표시된다.
- 완료·취소 업무는 기본 진행 흐름과 workload count에서 제외된다.
- 미배정 업무는 별도 row에 표시된다.
- 팀원별 활성/이번 주 마감/기한 초과/대기·막힘/핵심 count가 fixture 데이터와
  일치한다.
- 브랜드와 focus filter 적용 결과가 기존 workspace board와 동일하다.
- 업무 카드를 선택하면 기존 상세 panel이 열리고 수정 결과가 두 탭과
  팀 현황에 즉시 반영된다.
- 72개 활성 업무 fixture에서도 1440px 기준 첫 화면에 네 개 상태 column과
  세 명의 row heading이 식별 가능하다.

### 댓글·멘션·알림

- workspace 멤버만 해당 workspace task의 댓글을 조회·작성할 수 있다.
- `@멤버`가 포함된 댓글을 작성하면 해당 멤버에게 unread 알림 하나가 생성된다.
- 자기 멘션과 같은 댓글의 중복 멘션은 추가 알림을 만들지 않는다.
- 알림을 선택하면 관련 task와 댓글 위치를 열고 읽음 처리한다.
- 댓글 조회/작성 실패 시 기존 댓글이 사라지지 않고 retry가 제공된다.
- keyboard만으로 댓글 작성, 멘션 선택, 알림 열기와 읽음 처리가 가능하다.

### 안정성·접근성

- 서로 다른 두 task의 optimistic update를 동시에 실행하고 하나를 실패시켜도
  성공한 task의 최신 상태가 되돌아가지 않는다.
- Quick Add와 task detail은 Escape로 닫히고 trigger로 focus가 복귀한다.
- 진행 흐름의 각 row/column과 업무명이 screen reader에서 의미 있게 읽힌다.
- route loading/error, 댓글 loading/error, activity loading/error 상태가
  각각 자동 검증된다.
- 기존 236개 테스트, TypeScript 검사, production build가 모두 통과한다.
- 홈 → task 확인/수정, 내 업무 → 완료, 팀 현황 → 다른 팀원 업무 확인,
  댓글 → mention → 알림 확인의 네 가지 Playwright 흐름이 통과한다.
- axe 검사에 critical/serious violation이 없다.

## 11. 위험과 완화

| 위험 | 완화 |
|---|---|
| 진행 흐름에 72개 업무가 들어가면 카드가 과밀해짐 | compact card, 브랜드 filter, cell count+overflow, 완료/취소 제외 |
| 업무량이 성과 평가처럼 오해됨 | 단일 score·순위 제외, 관찰 가능한 count만 표시 |
| 자유로운 diagram 요구가 커져 canvas가 복잡해짐 | 초기 버전은 고정 swimlane, 실제 사용 후 zoom/drag 필요성 평가 |
| 댓글과 변경 이력이 상세 panel을 길게 만듦 | 댓글 우선, 변경 이력은 접을 수 있는 보조 section으로 이동 |
| notification이 과도해짐 | mention과 참여 task의 새 댓글만 알림, 자기 action 제외 |
| 폰트 변경으로 layout metrics가 달라짐 | font policy 확정 후 390/768/1440 visual baseline 갱신 |
| 새 기능이 기존 빠른 업무 입력을 방해함 | 전역 Quick Add 위치와 클릭 수 유지, 댓글/알림은 후순위 phase로 분리 |

## 12. 검증 절차

1. `npm run typecheck`
2. `npm test`
3. `npm run build`
4. parentTaskId grouping, active/done scope, workload exclusion, canonical section,
   mention parsing, notification dedupe 단위 테스트
5. comment/notification service의 workspace isolation 통합 테스트
6. Playwright로 active/done scope 전환, compact subtask hover/focus/detail open,
   current-member default form, advanced disclosure를 포함한 핵심 사용자 흐름 검증
7. axe keyboard/focus 검사
8. 390px, 768px, 1440px 및 light/dark screenshot 비교
9. 실제 세 명의 fixture와 9개 브랜드·72개 업무 fixture로 content height와
   parent grouping을 정보 밀도 기준에 맞춰 점검
10. 팀원 세 명이 각자 `업무 입력 → 수정 → 다른 사람 업무 확인 → 댓글 mention
    → 알림 확인`을 수행하는 짧은 사용성 검증

## 13. 권장 첫 릴리스

첫 릴리스는 Phase 0~2까지만 진행한다. 상단 정보 체계, 기존 워크플로우 유지,
진행 흐름, 팀 현황과 상태 안정화만으로 핵심 가치가 성립하는지 먼저 확인한다.
댓글·멘션·알림은 Phase 3으로 분리하여 화면 구조가 검증된 뒤 추가한다.

더 작은 대안은 Phase 0~1만 적용하고 기존 Canvas의 `담당자` grouping을
활용하는 것이다. 구현량은 적지만 담당자와 진행 상태를 동시에 읽기 어려워
“현재 업무를 한눈에 파악”하는 요구를 충분히 만족하지 못하므로 권장하지 않는다.

## 14. 목업 캔버스

수정 목업은 완료 업무를 기본 보드에서 분리하고, 브랜드 → 프로젝트 → 업무 →
하위업무의 적층 구조와 compact 입력 form을 함께 검증한다.

수정 디자인 목업:
`/Users/dongryoolkim/.codex/visualizations/2026/07/26/019fa090-598f-7401-8be9-82efb2721d25/workflow-density-revision.html`

적용한 시각 철학:
`/Users/dongryoolkim/.codex/visualizations/2026/07/26/019fa090-598f-7401-8be9-82efb2721d25/operational-calm.md`

목업은 다음 결정을 시각적으로 검증한다.

- 글로벌 헤더에 `홈/내 업무/팀 현황`, 검색, 추가, 알림, 멤버를 배치한다.
- 홈의 로컬 제어를 화면 제목 한 줄과 view/filter 한 줄로 제한한다.
- 기본 보드는 완료 업무를 제외하고 parent-grouped 적층 구조를 사용한다.
- 완료 업무는 상태 범위를 통해 필요할 때만 열며, 프로젝트 완료율은 표시하지 않는다.
- 업무 metadata는 제목과 같은 한 줄에 두고, 하위업무는 parent 아래에서 compact하게 표시한다.
- 입력 panel은 현재 입력자를 기본 담당자로 하며 필수 내용만 먼저 보여준다.
- 진행 흐름은 담당자 행 × 상태 열 swimlane으로 표현한다.
- 팀 현황은 단일 workload score 없이 다섯 가지 현재 신호를 병렬 표시한다.
- 댓글 mention과 앱 내부 알림의 위치를 글로벌 헤더와 업무 맥락에 연결한다.
