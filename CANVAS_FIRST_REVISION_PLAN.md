# Marketing Team Workflow: Canvas-first 간소화 수정 계획서

## 0. 문서 정보

| 항목 | 내용 |
| --- | --- |
| 버전 | 2.0 |
| 작성일 | 2026-07-26 |
| 상태 | 구현 전 제안 |
| 기준선 | `main` 브랜치, `056a586` |
| 이전 문서 | `CANVAS_FIRST_REVISION_PLAN.md` 1.0 |

이 문서는 1.0 계획과 `.omc/plans/canvas-first-resequenced.md`를 대체한다. 기존 진단에서 확인된 Waiting·인증·모바일 문제는 유지하고, 사용자의 최신 결정에 따라 상태·편집창·담당자·검토자·Dependency 범위를 다시 정한다.

애플리케이션 코드는 이 문서 확정 후 수정한다.

---

## 1. 최신 결정 요약

### 유지

- 최상위 navigation은 `홈`, `내 업무` 두 개
- Home Canvas가 제품의 중심
- Project → Workstream → Task → Subtask 구조
- 위계와 중요도의 분리
- Milestone
- 제목만으로 저장하는 빠른 기록
- Waiting 업무의 상대와 다음 확인일

### 간소화

- 업무 상태는 `진행 중`, `대기`, `완료` 세 개
- 카드 편집은 우측 sheet 대신 중앙 modal
- 신규 업무 담당자는 로그인한 사용자로 자동 지정
- 담당자 선택 UI 제거
- 검토자와 Review 흐름 제거
- 선행 업무와 Dependency 흐름 제거
- 오늘 마감·내일 마감·검토 요청·핵심 업무·완료 Quick Action 제거
- 카드에 업무 내용을 표시할 수 있도록 status column과 카드 폭 재배치

### 데이터 안전 원칙

- 기존 담당자와 reviewer 데이터는 즉시 삭제하지 않음
- 기존 Dependency row와 table은 즉시 삭제하지 않음
- 사용자가 기존 업무를 열거나 수정해도 담당자가 자동 변경되지 않음
- 신규 업무에만 현재 로그인 사용자를 기본 담당자로 지정
- 상태 migration 전 remote D1 backup과 staging 검증 수행

---

## 2. 수정된 제품 본질

사용자는 하나의 Home Canvas에서 프로젝트 구조와 업무 내용을 이해하고, 각 업무가 진행 중인지, 대기 중인지, 완료됐는지를 바로 수정한다. 대기 업무는 무엇을 기다리는지와 언제 다시 확인할지를 기록해 잊히지 않게 한다.

`내 업무`는 현재 로그인 사용자에게 지정된 업무를 실행 순서로 보여준다.

제품이 매일 답할 질문:

1. 지금 진행 중인 업무는 무엇인가?
2. 어떤 업무가 대기 중인가?
3. 대기 업무를 언제 다시 확인해야 하는가?
4. 완료된 업무는 무엇인가?
5. 이 업무는 어느 Project와 Workstream에 속하는가?
6. 업무의 배경과 결과물은 무엇인가?
7. 중요한 업무와 Milestone은 무엇인가?

### 제품 trade-off

`완료 후 무엇이 이어지는가`를 표현하던 Dependency 약속은 2.0 범위에서 제거한다. 제품의 차별점은 프로젝트 위계, 중요 업무와 Milestone, Waiting 재확인, 충분한 업무 내용에 집중한다.

담당자 선택과 reviewer를 제거하면 위임·승인 workflow를 표현할 수 없다. 2.0은 현재 사용자 중심의 간결한 운영에 맞춘다. 여러 팀원이 서로 업무를 배정해야 한다는 Pilot 결과가 나오면 담당자 변경 기능을 다시 검토한다.

---

## 3. 목표 정보 구조

### 3.1 Navigation

| 메뉴 | 역할 |
| --- | --- |
| 홈 | 전체 프로젝트를 보고 생성·편집하는 Canvas |
| 내 업무 | 로그인 사용자에게 지정된 진행·대기·완료 업무 |

기존 데이터 관점:

| 개념 | 변경 후 표현 |
| --- | --- |
| Inbox | Home의 `미분류` Project 구획 |
| Project | Home Canvas의 접이식 container |
| Workstream | Project 내부 band |
| Team | 2.0 최상위 UI에서 제외 |
| Search | 상단 검색에서 Canvas 카드 focus |

### 3.2 기존 URL

- `/inbox` → `/home?view=unclassified`
- `/projects` → `/home?group=project`
- `/projects/:id` → `/home?project=:id`
- `/team` → `/home`
- `/search?q=` → `/home?q=`

route redirect는 Home의 생성·편집 기능이 준비된 뒤 적용한다. 첫 Project 생성 동선이 없는 상태에서 Project navigation을 먼저 제거하지 않는다.

---

## 4. 세 가지 업무 상태

### 4.1 상태 정의

| DB 값 | UI label | 의미 |
| --- | --- | --- |
| `InProgress` | 진행 중 | 현재 관리하고 있는 모든 미완료 업무 |
| `Waiting` | 대기 | 외부·내부 응답이나 특정 시점을 기다리는 업무 |
| `Done` | 완료 | 더 이상 행동이 필요하지 않은 업무 |

UI label은 `대기`로 통일한다. `Pending`은 도움말이나 설명 문구에서만 사용할 수 있다.

### 4.2 제거 상태

- `Inbox`
- `ToDo`
- `Review`

Inbox는 status가 아니라 `project_id=null`인 미분류 소속으로 표현한다.

### 4.3 기존 데이터 mapping

| 기존 상태 | 새 상태 | 추가 처리 |
| --- | --- | --- |
| Inbox | InProgress | `project_id=null` 유지 |
| ToDo | InProgress | 없음 |
| InProgress | InProgress | 없음 |
| Waiting | Waiting | 기존 Waiting 정보 유지 |
| Review | InProgress | reviewer 값은 DB에 보존 |
| Done | Done | 완료일 유지 |

### 4.4 Migration 순서

1. remote D1 export 또는 backup 생성
2. staging DB에서 status update migration 실행
3. query·derive·service가 세 상태만 사용하는지 검증
4. 기존 Review·Inbox fixture가 새 화면에 나타나는지 확인
5. production migration
6. production smoke test

기존 enum literal은 애플리케이션 코드와 fixture에서 함께 정리한다. migration 적용 전 새 코드를 production에 배포하지 않는다.

### 4.5 상태 변경 UI

카드 편집창 상단에 세 칸 segmented control을 제공한다.

```text
┌────────────┬──────────┬──────────┐
│  진행 중   │   대기   │   완료   │
└────────────┴──────────┴──────────┘
```

- 상태 변경은 한 번의 선택으로 처리
- 대기로 처음 변경하면 상대와 다음 확인일 입력 영역 표시
- 완료 선택 시 별도 Quick Action을 요구하지 않음
- 완료에서 진행 중으로 되돌릴 수 있음
- Review 요청과 reviewer 지정 흐름 없음

---

## 5. Canvas 공간 재배치

### 5.1 목표

다섯 개 status column을 세 개로 줄여 확보한 폭을 카드 내용에 사용한다.

```text
┌──────── Project / Workstream ────────┐
│                                      │
│   진행 중          대기        완료  │
│ ┌───────────┐  ┌───────────┐  ┌───┐ │
│ │ 제목       │  │ 제목       │  │   │ │
│ │ 내용 미리보기│  │ 대기 상대   │  │   │ │
│ │ 기한·계층   │  │ 확인일      │  │   │ │
│ └───────────┘  └───────────┘  └───┘ │
└──────────────────────────────────────┘
```

### 5.2 Geometry

- status column: 5개 → 3개
- Desktop card 목표 폭: 300~360px
- lane label 폭을 포함한 세 column이 일반 Desktop에서 한 화면에 들어오도록 계산
- 고정 `COLW=252` 대신 viewport 기반 column 폭 사용
- Project·Workstream container는 full-width
- Canvas stage는 viewport의 최소 85% 높이
- card 간 최소 gap 유지
- 많은 카드가 있으면 세로 확장과 cell overflow 사용

### 5.3 카드에 표시할 내용

기본 카드:

- Key 표시 또는 일반 업무 구분
- 업무 제목, 최대 2줄
- 세부 내용 미리보기, 최대 3줄
- Project·Workstream 계층 context
- 마감일
- Subtask 완료 개수
- Milestone 여부

대기 카드:

- 업무 제목
- 무엇을 기다리는가
- 다음 확인일
- 기한
- Subtask 개수

완료 카드:

- 제목
- 완료일
- 세부 내용 한 줄
- 과한 opacity 저하 없이 완료 표시

표시하지 않을 내용:

- 담당자
- reviewer
- predecessor
- successor
- 임의 진척률
- 자동 연결선

### 5.4 색상 역할

| 정보 | 표현 |
| --- | --- |
| 진행 중 | blue 계열 status accent |
| 대기 | amber 계열 status accent |
| 완료 | green 또는 neutral-green status accent |
| Key Task | border weight와 typography |
| 위계 | container, band, 들여쓰기 |
| Milestone | diamond shape |

중요도 색과 상태 색을 섞지 않는다. 카드 전체를 강한 색으로 채우지 않고 top accent, 얇은 border, 4~6% background tint를 사용한다.

---

## 6. 중앙 카드 편집창

### 6.1 변경

현재 우측에서 나오는 `TaskDetailPanel`을 화면 가운데 놓이는 `TaskEditorDialog`로 교체한다.

Desktop:

- 화면 중앙 배치
- 목표 폭 640~720px
- 최대 높이 82dvh
- 내부 세로 scroll
- 주변 Canvas가 보이는 반투명 overlay
- 선택한 카드의 status accent를 dialog 상단과 border에 적용

Tablet:

- viewport 좌우 24px 여백
- 최대 높이 88dvh

Mobile:

- 좌우 12~16px 여백을 둔 large dialog
- 화면이 작은 경우 full-screen
- 우측 sheet를 사용하지 않음

### 6.2 카드에서 이어지는 공간 전환

카드를 클릭할 때 해당 카드의 화면 위치를 기록한다.

Opening:

1. overlay opacity와 blur 적용
2. dialog의 transform origin을 선택 카드 방향으로 설정
3. `opacity: 0`, `scale(0.96)`, 카드 방향의 짧은 translate에서 시작
4. 180~220ms strong ease-out으로 중앙에 정착

Closing:

- 120~160ms
- 선택 카드 방향으로 짧게 이동하며 fade
- 선택 카드가 화면 밖이면 중앙 fade만 사용

기준:

- `scale(0)` 사용 금지
- bounce 사용 금지
- width·height animation 사용 금지
- transform과 opacity 중심
- keyboard로 연 dialog는 이동 animation 없이 빠른 fade
- `prefers-reduced-motion`에서는 translate와 scale 제거

첫 구현은 동적 transform origin과 짧은 translate를 사용한다. 실제 shared-element morph는 사용성 검증 후 필요할 때만 추가한다.

### 6.3 색상 연결

카드와 dialog가 같은 CSS variable을 사용한다.

```text
--task-status-accent
--task-status-tint
--task-border-weight
```

- 진행 중 카드 → 진행 중 editor accent
- 대기 카드 → 대기 editor accent
- 완료 카드 → 완료 editor accent
- Key Task → editor title과 border weight 강화

overlay 전체에 status color를 입히지 않는다.

### 6.4 접근성

- accessible dialog title
- focus trap
- open 시 title input 또는 dialog heading으로 focus
- `Esc` 닫기
- 닫힌 후 선택 카드로 focus 복귀
- overlay click 닫기
- 저장 중 닫아도 입력 유실 없음
- 200% zoom에서 필드와 action 접근 가능

---

## 7. 편집창 내용 간소화

### 7.1 기본 배치

```text
┌──────────────────────────────────────────────┐
│ 업무 제목                              닫기 │
│ Project › Workstream › Parent Task           │
│                                              │
│ [ 진행 중 | 대기 | 완료 ]                   │
│                                              │
│ 세부 내용                                    │
│ ┌──────────────────────────────────────────┐ │
│ │ 배경, 결과물, 메모, 링크                 │ │
│ │                                          │ │
│ └──────────────────────────────────────────┘ │
│                                              │
│ 마감일              업무 위치               │
│                                              │
│ 세부 업무                                    │
│ 변경 이력 ▸                                  │
└──────────────────────────────────────────────┘
```

### 7.2 기본 필드

- 제목
- 상태 3개
- 세부 내용
- Project
- Workstream
- parent Task
- 마감일과 선택 시간
- Subtask

조건부 필드:

- Waiting 상대
- 다음 확인일
- Key로 표시
- Milestone 정보

`Key로 표시`는 Quick Action에서 제거하고 `더보기` 또는 간단한 metadata control로 둔다. 중요도 개념은 hierarchy 표현을 위해 유지한다.

### 7.3 제거 UI

- 담당자 select
- reviewer select
- 선행 업무 section
- Dependency error
- 오늘 마감 chip
- 내일 마감 chip
- 검토 요청 chip
- 핵심 업무 chip
- 완료 chip

완료는 상태 control에서 처리한다. 오늘과 내일은 date picker에서 직접 선택한다.

### 7.4 저장

- 제목: Enter 또는 blur
- 설명: debounce와 blur flush
- 상태: 선택 즉시 저장
- Project·Workstream: 선택 즉시 저장
- 날짜: 선택 즉시 저장
- 저장 상태는 dialog header에 작은 text로 표시
- 충돌과 실패는 해당 필드 가까이에 표시
- activity fetch와 저장 요청은 현재 task ID를 검증

---

## 8. 담당자와 reviewer

### 8.1 신규 업무

모든 신규 Task는 생성 action을 실행한 로그인 사용자에게 자동 배정한다.

적용 범위:

- 빠른 업무 기록
- Project 안의 Task
- Workstream 안의 Task
- Subtask
- Milestone을 Task로 관리하는 경우

### 8.2 기존 업무

- 기존 `assignee_id` 유지
- 업무를 열거나 수정해도 현재 사용자로 변경하지 않음
- 담당자 select는 숨김
- 기존에 다른 사용자가 담당자인 업무는 My Work 소속을 그대로 유지
- 담당자가 없는 기존 row는 migration 또는 별도 backfill에서 처리

### 8.3 Reviewer

- reviewer UI 제거
- Review 상태 제거
- 기존 `reviewer_id` 데이터 유지
- 신규 업무에는 reviewer를 지정하지 않음
- Review였던 기존 업무는 InProgress로 migration

향후 승인 흐름이 필요하면 별도의 단순 `확인 필요` flag로 검토한다. 2.0에는 포함하지 않는다.

---

## 9. Dependency 제거

### 9.1 Runtime 제거

- Task editor의 선행 업무 section 제거
- dependency add·remove action의 UI 호출 제거
- Home과 Project page의 dependency map query 제거
- Canvas dependency edge 제거
- `선행 업무 대기` badge 제거
- successor와 Ready derive 계획 제거

### 9.2 데이터 보존

- `task_dependency` table 유지
- 기존 row 유지
- migration에서 table drop 금지
- service와 action은 사용처가 완전히 제거된 뒤 archive 또는 삭제 결정

보존 이유:

- 기존 데이터 손실 방지
- 방향 변경 시 복구 가능
- production migration 위험 축소

### 9.3 화면 연결선

2.0 Canvas에는 다음 선만 허용한다.

- Key descendant와 parent의 실제 소속을 보여주는 dashed tether

업무 흐름을 암시하는 실선과 화살표는 표시하지 않는다.

---

## 10. Waiting

### 10.1 필수 정보

대기로 변경할 때 두 가지만 요구한다.

| 필드 | 필수 여부 |
| --- | --- |
| 무엇을 기다리는가 | 필수 |
| 다음 확인일 | 필수 |

담당자는 현재 Task의 기존 담당자를 사용한다. 신규 Task는 로그인 사용자다.

### 10.2 동작

- 상태 control에서 대기 선택
- 같은 dialog 안에서 Waiting 입력 영역이 자연스럽게 나타남
- 상대와 확인일 입력 후 대기 확정
- 다음 확인일이 되면 내 업무 상단에 표시
- 카드에 상대와 확인일 표시
- 진행 중 또는 완료로 변경하면 active Waiting 값 정리
- Waiting 해제 전 상대·확인일을 activity history에 기록

### 10.3 즉시 수정할 회귀

현재 `applyTaskEdit`는 기존 Waiting 업무에서 status가 없는 patch에도 Waiting 값을 지운다.

수정 조건:

```text
prevStatus === Waiting && nextStatus !== Waiting
```

필수 테스트:

1. Waiting 업무 제목 수정 후 상대·확인일 유지
2. Waiting 업무 설명 수정 후 유지
3. Waiting 상대 수정 가능
4. Waiting 확인일 수정 가능
5. Waiting → 진행 중에서 값 정리와 history 기록
6. Waiting → 완료에서 값 정리와 history 기록

---

## 11. 생성 문법

### 11.1 전역 `+ 추가`

선택 메뉴:

1. 빠른 업무 기록
2. 프로젝트 만들기
3. 마일스톤 만들기

빠른 기록:

- 제목만 입력
- `status=InProgress`
- `assignee_id=currentMember.id`
- `project_id=null`
- Home의 미분류 구획에 즉시 표시
- 별도 Inbox로 이동하지 않음

### 11.2 위치별 생성

| 위치 | 생성 |
| --- | --- |
| 빈 Canvas | Project |
| Project header | Workstream |
| Workstream | Task |
| Task card | Subtask |
| Milestone rail | Milestone |

Project navigation을 숨기기 전에 전역 Project 생성과 빈 Canvas 생성 동선을 먼저 구현한다.

---

## 12. 위계와 정보 밀도

### 12.1 계층

- Project: 접이식 container
- Workstream: Project 내부 band
- Key Task: border weight와 typography
- Subtask: parent 안의 outline
- Key Subtask: 독립 카드와 dashed parent tether
- Milestone: Project rail과 diamond

고정된 4단계 입력을 강제하지 않는다. 단순 Project는 Workstream과 Subtask 없이 사용할 수 있다.

### 12.2 Zoom LOD

| 단계 | 표시 |
| --- | --- |
| Far | Project, Workstream, Key Task, Milestone, Waiting·overdue 신호 |
| Medium | 상위 Task, 제목, 상태, 내용 한 줄 |
| Near | 내용 3줄, 기한, Subtask, inline add |
| Selected | 중앙 editor 전체 내용 |

현재 compact LOD 회귀 수정:

- compact에서 펼친 Subtask row 숨김
- compact 진입 시 cardHeight도 함께 줄임
- 일반 Task를 모두 50%로 축소해 보여주지 않음
- Far 단계에서 Key·Waiting·overdue 중심으로 density 축소
- 읽을 수 없는 6~7px title 생성 금지

---

## 13. 내 업무

### 13.1 구조

세 상태를 그대로 사용한다.

```text
확인 필요
- Follow-up 날짜가 된 대기 업무
- 기한이 지난 진행 중 업무

진행 중
- 현재 사용자에게 지정된 업무

대기
- 아직 확인일이 되지 않은 대기 업무

완료
- 최근 완료 업무, 기본 접힘
```

### 13.2 제거

- Review section
- reviewer 기준 업무
- Dependency successor
- Ready badge
- 팀 전체 진행 중 section
- 담당자 변경

내 업무는 개인 실행 화면으로 제한한다. Project와 Workstream은 작은 context label로 표시한다.

---

## 14. 모바일

Home Canvas의 데이터는 structured outline으로 표시한다.

```text
▼ AURALEE 국내 론칭
  ▼ 본사 협의
      ◆ 마케팅 가이드 검토 · 진행 중
          ├ 금지 표현 대조
          └ 수정 조항 작성
      ◇ 본사 회신 · 대기 · 8/12 확인

  ▶ PR
  ▶ 이벤트 · 대기 2
```

기준:

- Project·Workstream accordion
- 세 status filter
- Key Task와 Milestone 유지
- Subtask 들여쓰기
- 카드 tap 시 중앙 large dialog
- 작은 화면에서는 editor full-screen
- 담당자·reviewer·Dependency UI 없음
- touch target 최소 44px

---

## 15. 서비스·데이터 변경

### 15.1 상태

- `TaskStatus`를 세 literal로 축소
- status validation과 status metadata 정리
- Inbox derive는 `project_id=null` 기준
- Review 관련 derive·fixture·UI 제거
- 완료·재개 service의 대상 상태를 InProgress로 통일

### 15.2 생성

- `createByTitle`: 현재 사용자 자동 배정, InProgress
- `createProjectTask`: 현재 사용자 자동 배정, InProgress
- `createSubtask`: 현재 사용자 자동 배정, InProgress
- milestone 생성 시 현재 사용자 자동 배정 여부 확인

### 15.3 편집

- `TaskPatch`에서 reviewer 사용처 제거
- assignee patch는 2.0 client input에서 제거
- server-side workspace validation 유지
- Waiting transition 수정
- Waiting activity history 추가
- current task ID를 확인하는 async guard

### 15.4 보존 필드

다음 DB column과 table은 유지한다.

- `assignee_id`
- `reviewer_id`
- Waiting 관련 기존 field
- `task_dependency`
- `activity_log`
- `importance`
- `kind`
- `parent_task_id`

UI에서 제거한 필드를 production DB에서 바로 drop하지 않는다.

---

## 16. 기존 Diff Findings 해결안

1차 build diff 리뷰에서 확인한 다섯 Findings를 구현 항목과 회귀 테스트에 직접 연결한다. WP에 이름만 넣고 끝내지 않고 아래 해결 방식을 기준으로 수정한다.

### 16.1 Finding 1: Waiting 일반 수정이 대기 정보를 삭제

#### 원인

`applyTaskEdit`의 Waiting 정리 분기가 `patch.status`가 없는 경우에도 실행된다.

현재 조건:

```text
patch.status !== "Waiting" && prevStatus === "Waiting"
```

제목·설명·기한처럼 status를 보내지 않는 patch에서도 `waiting_party_text`와 `follow_up_at`이 `null`로 바뀐다.

#### 해결

Waiting 값을 지우는 조건을 실제 상태 전환으로 제한한다.

```text
prevStatus === "Waiting" && nextStatus !== "Waiting"
```

추가 규칙:

- 현재 상태와 patch를 합친 최종 상태가 Waiting이면 기존 Waiting 값 유지
- Waiting 상대만 변경하면 확인일 유지
- 확인일만 변경하면 상대 유지
- 제목·설명·Project·Workstream·기한 수정은 Waiting field를 updates에 포함하지 않음
- 새로 Waiting에 진입할 때만 상대와 확인일 필수 validation
- 필드가 없던 legacy Waiting row의 일반 수정은 허용하고 `대기 정보 없음` 경고 표시

#### 코드 변경점

- `app/src/server/services/task.ts`
- `applyTaskEdit`
- Waiting transition validation
- `TaskEditorDialog` Waiting field patch

#### 회귀 테스트

1. Waiting 업무 제목 수정 후 상대·확인일 유지
2. 설명 debounce 저장 후 유지
3. 마감일 수정 후 유지
4. Waiting 상대만 수정 가능
5. Waiting 확인일만 수정 가능
6. Waiting → 진행 중에서만 active Waiting 값 정리
7. Waiting → 완료에서만 active Waiting 값 정리

연결 WP: WP0, WP1, WP2

### 16.2 Finding 2: 첫 Project 생성 동선 소실

#### 원인

Project navigation을 제거했지만 전역 생성 버튼은 미분류 Task만 만든다. 기존 Project가 없는 Workspace에는 Project detail로 들어갈 lane도 없다.

#### 해결

navigation 제거와 route redirect보다 먼저 전역 `+ 추가` menu를 구현한다.

필수 entry:

- 상단 `+ 추가 → 프로젝트 만들기`
- 빈 Canvas의 `첫 프로젝트 만들기`
- Project가 하나도 없을 때 설명과 Project 생성 button

생성 성공 후:

- 새 Project container를 Home에 즉시 추가
- 생성된 Project에 focus
- 첫 Workstream 또는 Task를 이어서 추가할 수 있는 context action 표시
- `/projects`로 이동하지 않음

전환 안전장치:

- `+ 추가` 구현 전에는 기존 Project route의 visible 임시 link 유지
- Project 생성 E2E 통과 후 Project navigation과 route를 redirect

#### 코드 변경점

- `app/src/components/NavBar.tsx`
- `app/src/components/HomeContent.tsx`
- 전역 create menu
- Project create action
- Home empty state

#### 회귀 테스트

1. Project가 없는 Workspace에서 첫 Project 생성
2. 빠른 업무 기록과 Project 생성 유형 구분
3. Project 생성 후 Home 유지
4. 새 Project container focus
5. keyboard와 mobile에서 Project 생성

연결 WP: WP0, WP4

### 16.3 Finding 3: Waiting 해제 시 운영 이력 삭제

#### 원인

Waiting 해제 시 active field를 `null`로 만들지만 activity log에는 status 변경만 남긴다. 이후 무엇을 기다렸고 언제 확인하려 했는지 알 수 없다.

#### 해결

Waiting field 변경과 해제 전에 activity row를 기록한다.

권장 change type:

| change type | from value | to value |
| --- | --- | --- |
| `waiting_party` | 기존 상대 | 새 상대 |
| `follow_up_at` | 기존 확인일 | 새 확인일 |
| `waiting_closed` | 기존 상대와 확인일 summary | 종료 상태 |

규칙:

- Waiting 진입 시 상대와 확인일 기록
- Waiting 중 상대·확인일 수정 기록
- Waiting 해제 시 field를 지우기 전에 기존 값을 activity row에 복사
- activity insert와 Task update를 같은 batch 또는 transaction 단위로 실행
- 변경 이력 UI에서 Korean label과 날짜 표시
- 설명 본문은 기존 정책대로 activity에 복사하지 않음

#### 코드 변경점

- `app/src/server/services/task.ts`
- activity row 생성
- `app/src/server/data/queries.ts`
- `TaskEditorDialog` 변경 이력

#### 회귀 테스트

1. Waiting 진입 activity
2. 상대 변경 activity
3. 확인일 변경 activity
4. Waiting → 진행 중 종료 이력
5. Waiting → 완료 종료 이력
6. Task update 실패 시 activity만 남지 않음
7. activity insert 실패 시 Waiting field만 지워지지 않음

연결 WP: WP0, WP2

### 16.4 Finding 4: Compact LOD가 펼친 Subtask와 일반 카드를 유지

#### 원인

LOD는 metadata 일부만 숨긴다. `rows` 계산과 card geometry가 `lod`를 사용하지 않아 이미 펼친 Subtask가 compact에서도 렌더링된다. 일반 카드도 모두 남아 최소 zoom에서 title이 6~7px까지 작아진다.

#### 해결

LOD가 content visibility와 geometry를 함께 결정하게 한다.

Compact:

- `rows=[]`
- Subtask meter와 inline add 숨김
- `cardHeight`에서 Subtask row·meter·add 높이 제외
- title과 상태 신호만 유지

Far:

- Key Task
- Waiting
- overdue
- Milestone
- Project와 Workstream header

일반 Task:

- Far에서 개별 카드를 숨기고 status별 count로 대체
- Medium 이상에서 다시 표시

추가 규칙:

- zoom이 full로 돌아오면 기존 펼침 state 복원 가능
- keyboard focus가 숨겨질 카드에 있으면 Project 또는 Workstream header로 focus 이동
- column count는 숨겨진 업무를 포함한 실제 전체 count 유지

#### 코드 변경점

- `WorkflowCanvas.computeLayout`
- `cardHeight`
- `subRows`
- LOD별 placed task filter
- focus 관리

#### 회귀 테스트

1. 펼친 Subtask가 compact에서 렌더링되지 않음
2. compact cardHeight 감소
3. Far에서 일반 Task가 count로 대체
4. Key·Waiting·overdue·Milestone 유지
5. full 복귀 시 펼침 state 복원
6. 50% zoom에서 최소 title 크기 기준 충족

연결 WP: WP3, WP6

### 16.5 Finding 5: Task 전환 중 Activity 응답 혼합

#### 원인

Task A의 activity 요청이 끝나기 전에 B를 선택하면, 늦게 도착한 A 응답이 B의 activity state를 덮어쓸 수 있다.

#### 해결

activity 요청마다 request token과 Task ID를 기록한다.

```text
requestToken += 1
currentToken = requestToken
requestedTaskId = task.id

response 적용 조건:
currentToken === requestToken
&& requestedTaskId === selectedTaskId
```

추가 규칙:

- Task 변경 시 activity state와 task-local error 초기화
- dialog가 닫히면 이후 응답 무시
- 같은 Task의 version 변경 요청은 최신 token만 적용
- server action 실패가 다른 Task의 error로 이동하지 않음

#### 코드 변경점

- 기존 `TaskDetailPanel` effect
- 신규 `TaskEditorDialog` activity hook
- task-local async state

#### 회귀 테스트

1. A → B 빠른 선택에서 B 이력 유지
2. A의 느린 응답 무시
3. dialog close 후 state update 없음
4. 같은 Task 연속 저장에서 최신 activity 유지
5. Task 변경 시 이전 error 제거

연결 WP: WP0, WP2

### 16.6 Findings 완료 Gate

다섯 항목은 다음 조건을 모두 만족해야 완료로 판정한다.

- 해결 코드와 회귀 테스트가 같은 commit 또는 연속된 review 단위에 포함
- unit·component test 통과
- staging browser E2E 통과
- Waiting data를 직접 확인하는 smoke test 통과
- 빈 Workspace의 첫 Project 생성 통과
- compact·Far LOD visual QA 통과
- 빠른 Task 전환 activity test 통과

---

## 17. 구현 Work Package

### WP0. 1차 build 회귀 수정

범위:

- Waiting 일반 수정 시 정보 삭제 수정
- Waiting history 기록
- 첫 Project 생성 entry 복구
- activity fetch race 수정
- dependency remove 실패 UI는 Dependency section 제거와 함께 해소

완료 기준:

- Waiting 업무의 제목·설명·날짜 수정 후 대기 정보 유지
- 빈 Workspace에서 첫 Project 생성 가능
- Task를 빠르게 전환해도 activity가 섞이지 않음
- unit·typecheck·build 통과

### WP1. 세 상태 전환

범위:

- status code·metadata·derive 축소
- status data migration
- 세 column Canvas
- 세 상태 segmented control
- Review·Inbox status 제거

완료 기준:

- UI 전체에 세 status만 표시
- 미분류 Task도 InProgress 상태
- Review였던 업무가 누락되지 않음
- 완료 해제 시 InProgress로 복귀

### WP2. 중앙 Editor

범위:

- 우측 TaskDetailPanel 제거
- TaskEditorDialog
- 카드 origin 위치 기록
- overlay·spatial transition
- status color variable 공유
- Quick Action과 불필요 field 제거

완료 기준:

- 카드 클릭 후 중앙에서 editor가 열림
- 카드와 editor의 상태 accent가 일치
- 담당자·reviewer·선행 업무·Quick Action이 없음
- focus 복귀와 reduced motion 통과

### WP3. 카드 내용과 Canvas Geometry

범위:

- responsive 세 column
- 카드 폭 확대
- description preview
- Waiting 정보
- hierarchy context
- 완료일과 Subtask count

완료 기준:

- 일반 Desktop에서 세 status를 한 화면에 비교 가능
- 기본 카드에서 제목 외 업무 맥락을 읽을 수 있음
- 임의 progress bar 없음

### WP4. 생성 문법과 Home 완결

범위:

- `+ 추가` 객체 menu
- Project·Workstream·Task·Subtask·Milestone 위치별 생성
- 미분류 빠른 기록
- Canvas inline rename
- Project·Workstream collapse

완료 기준:

- Home을 떠나지 않고 기본 구조 생성·수정
- 생성 객체와 위치를 실행 전에 예측 가능
- 전용 Project·Inbox navigation 없이 첫 Project와 Task 생성 가능

### WP5. Dependency·reviewer·담당자 선택 제거

범위:

- dependency section·edge·badge·query 제거
- Review workflow 제거
- reviewer UI 제거
- assignee selector 제거
- 신규 업무 current user 배정

완료 기준:

- 관련 UI와 runtime query가 없음
- 기존 DB 데이터는 보존
- 기존 업무 담당자가 편집만으로 변경되지 않음

### WP6. LOD와 모바일

범위:

- Far·Medium·Near LOD
- compact subtree 회귀 수정
- mobile structured outline
- mobile central/full-screen editor

완료 기준:

- Far 단계에서 Key·Milestone·Waiting 중심 구조 유지
- 모바일에서 Project부터 Subtask까지 이해 가능
- 200% zoom과 keyboard navigation 통과

### WP7. 인증과 Pilot

범위:

- Cloudflare build와 호환되는 session 복구
- 기본 멤버 자동 진입 제거
- workspace 접근 차단
- staging browser E2E
- 실제 사용자 Pilot

완료 기준:

- 미로그인 사용자의 읽기·쓰기 차단
- 다른 workspace mutation 차단
- 필수 E2E 통과
- production build와 Workers deploy 통과

---

## 18. 구현 순서와 Gate

### Gate A. 상태와 편집 경험

필수:

- WP0
- WP1
- WP2
- WP5

판정:

- 세 상태가 데이터와 화면에서 일치하는가?
- 카드 편집창이 부담 없이 열리고 닫히는가?
- 불필요한 담당자·reviewer·Dependency·Quick Action이 사라졌는가?
- Waiting 정보가 일반 편집으로 삭제되지 않는가?

### Gate B. Home Canvas 완결

필수:

- WP3
- WP4
- WP6 LOD

판정:

- 세 column이 확보한 공간을 실제 업무 내용에 사용하고 있는가?
- Project부터 Subtask까지 Home에서 생성·수정 가능한가?
- 축소 상태에서 중요한 구조가 남는가?

### Gate C. Pilot Ready

필수:

- WP6 모바일
- WP7

판정:

- 내 업무와 Home의 역할이 명확한가?
- 대기 업무가 확인일에 다시 나타나는가?
- 모바일에서도 구조와 내용을 이해할 수 있는가?
- 인증과 workspace 경계가 작동하는가?
- staging E2E가 통과했는가?

---

## 19. 검수 시나리오

| 번호 | 시나리오 | 기대 결과 |
| --- | --- | --- |
| 1 | 빈 Workspace에서 `+ 추가` | Project와 빠른 업무 기록을 선택 가능 |
| 2 | 빠른 업무 기록 | 현재 사용자, InProgress, 미분류로 생성 |
| 3 | Workstream에서 Task 생성 | 현재 사용자와 위치가 자동 지정 |
| 4 | 진행 중 → 대기 | 상대와 확인일 입력 후 상태 변경 |
| 5 | Waiting 제목·설명 수정 | 대기 상대와 확인일 유지 |
| 6 | Waiting 확인일 도래 | 내 업무 확인 필요에 노출 |
| 7 | Waiting → 완료 | Waiting history 기록 후 active 값 정리 |
| 8 | 완료 → 진행 중 | 완료일 제거 후 InProgress |
| 9 | 기존 Review 데이터 | InProgress로 표시되고 누락 없음 |
| 10 | 카드 클릭 | 카드 방향에서 중앙 editor로 연결 |
| 11 | editor 확인 | 담당자·reviewer·선행 업무·Quick Action 없음 |
| 12 | 카드 내용 | 설명·계층·기한 또는 Waiting 정보를 읽을 수 있음 |
| 13 | Canvas 축소 | Key·Milestone·Waiting 중심 구조 유지 |
| 14 | 모바일 | structured outline과 large editor |
| 15 | 다른 사용자의 기존 업무 편집 | 담당자가 자동 변경되지 않음 |
| 16 | 미로그인 접근 | 읽기·쓰기 차단 |
| 17 | 다른 workspace mutation | 차단 |
| 18 | 빠른 Task 전환 | 변경 이력이 다른 Task에 섞이지 않음 |

---

## 20. 테스트 계획

### Unit·Service

- 세 status validation
- status migration fixture
- Inbox → InProgress mapping
- Review → InProgress mapping
- 완료·재개
- 신규 업무 current user 배정
- 기존 업무 assignee 보존
- Waiting 진입 validation
- Waiting 일반 수정 시 값 보존
- Waiting 해제 history
- follow-up 도래
- stale version
- workspace validation

### Component

- 세 상태 segmented control
- 중앙 dialog
- 카드 status color 연결
- Quick Action 제거
- hidden assignee·reviewer·Dependency
- dialog focus return
- reduced motion
- responsive card content
- LOD
- 모바일 outline

### Browser E2E

1. 로그인
2. Project → Workstream → Task → Subtask 생성
3. 빠른 기록 → 미분류 → Project 정리
4. 세 상태 변경
5. Waiting 생성·수정·해제
6. Follow-up 도래
7. 중앙 editor open·edit·close
8. 기존 업무 assignee 보존
9. mobile hierarchy
10. workspace 접근 차단
11. stale update
12. 기존 route redirect

### Visual QA

- 1440×900
- 1024×768
- 768px tablet
- 390×844
- 320px mobile
- browser zoom 200%
- reduced motion
- keyboard-only

---

## 21. Pilot 차단 조건

다음 항목이 남으면 Pilot을 시작하지 않는다.

- UI에 네 개 이상의 status가 표시됨
- 미분류가 status로 표현됨
- Waiting 정보가 일반 수정으로 삭제됨
- follow-up 도래 업무가 내 업무에 나타나지 않음
- 우측 TaskDetailPanel이 남아 있음
- 담당자·reviewer·선행 업무·Quick Action이 editor에 남아 있음
- 새 Project를 visible UI에서 생성할 수 없음
- status column 축소 후에도 카드 폭과 내용이 늘지 않음
- Far zoom에서 일반 카드와 펼친 Subtask가 작은 글자로 남음
- 모바일에서 위계가 사라짐
- 기본 멤버 자동 진입이 남아 있음
- browser E2E가 없음

---

## 22. 범위 제외

- Dependency
- successor와 Ready
- reviewer workflow
- 담당자 수동 배정
- AI 자동 업무 생성
- AI 상태 요약
- Calendar 연동
- Gantt
- workload와 생산성 점수
- 댓글과 고급 파일 관리
- 자동 진척률
- 자동 연결선
- 고정 hierarchy 단계
- shared-element morph의 고급 구현

---

## 23. 위험과 대응

| 위험 | 대응 |
| --- | --- |
| ToDo가 InProgress로 합쳐져 실제 착수 여부가 사라짐 | InProgress를 모든 미완료 업무로 정의하고 필요하면 시작일 사용 |
| Review 제거로 승인 상태를 알 수 없음 | 2.0 범위에서 승인 흐름 제거, Pilot 결과로 재검토 |
| 담당자 선택 제거로 위임 불가 | 신규 작성자 자동 배정, 다인 Pilot에서 재검토 |
| Dependency 제거로 다음 업무가 보이지 않음 | 제품 약속과 UI에서 successor 개념 제거 |
| 넓어진 카드로 세로 밀도 감소 | description line clamp와 cell overflow |
| 색이 편집창을 지배함 | accent와 낮은 tint만 사용 |
| 공간 animation이 반복 편집을 느리게 함 | 220ms 이내, keyboard·reduced motion에서 이동 제거 |
| 기존 status migration 회귀 | staging fixture와 D1 backup |
| 기존 다른 담당자가 조용히 변경됨 | creation에서만 current user 지정 |
| DB와 schema의 미사용 필드 증가 | Pilot 후 별도 cleanup migration 검토 |

---

## 24. 예상 영향 파일

- `app/src/components/NavBar.tsx`
- `app/src/components/HomeContent.tsx`
- `app/src/components/MyWorkContent.tsx`
- `app/src/components/tasks/TaskDetailPanel.tsx`
- 신규 `TaskEditorDialog`
- `app/src/components/workflow/WorkflowCanvas.tsx`
- `app/src/components/tasks/useTaskController.ts`
- `app/src/components/tasks/useTaskStore.ts`
- `app/src/lib/status.ts`
- `app/src/lib/derive.ts`
- `app/src/lib/board-graph.ts`
- `app/src/server/services/task.ts`
- `app/src/server/data/queries.ts`
- `app/src/app/actions/tasks.ts`
- Home·Project·Inbox·Team·Search route
- status data migration
- unit·component·browser test

Dependency service와 DB table은 runtime 사용처 제거 후 별도 cleanup 대상으로 기록한다.

---

## 25. 완료 정의

1. 업무 상태가 진행 중·대기·완료 세 개다.
2. 미분류 업무는 진행 중 상태와 `project_id=null` 소속을 가진다.
3. 세 column이 한 화면에 들어오며 카드에서 업무 내용을 읽을 수 있다.
4. 카드 클릭 시 상태 색을 이어받은 중앙 editor가 자연스럽게 열린다.
5. editor에 담당자·reviewer·선행 업무·Quick Action이 없다.
6. 신규 업무는 로그인 사용자에게 자동 지정된다.
7. 기존 업무 담당자는 일반 편집으로 변경되지 않는다.
8. Waiting 업무는 상대와 다음 확인일을 가지며 확인일에 다시 나타난다.
9. Waiting 정보가 제목·설명 수정으로 삭제되지 않는다.
10. Home에서 Project부터 Subtask와 Milestone까지 생성·수정할 수 있다.
11. Far zoom과 모바일에서도 Project 위계와 핵심 업무가 남는다.
12. 인증·workspace 경계·stale update를 staging E2E로 검증한다.
