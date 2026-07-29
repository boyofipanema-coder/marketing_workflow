# Marketing Team Workflow: Canvas-first 수정 계획서

## 0. 문서 정보

| 항목 | 내용 |
| --- | --- |
| 버전 | 1.0 |
| 작성일 | 2026-07-26 |
| 상태 | 구현 전 제안 |
| 대상 기준선 | `main` 브랜치, `0127d00` |
| 목적 | 현재 구현 진단과 사용자의 최신 UX 결정을 하나의 수정 계획으로 통합 |

이 문서는 기존 `BUILD_PLAN.md`의 제품 본질과 Workflow 기준을 유지한다. `MVP_RECOVERY_PLAN.md`의 List-first 정보 구조, Canvas 확장 보류, 전용 Inbox·Project·Team 페이지 전제는 이 문서가 대체한다.

코드 구현은 이 문서의 범위와 검수 기준이 확정된 뒤 시작한다.

---

## 1. 제품의 본질

팀원이 하나의 Home Canvas에서 프로젝트 구조를 이해하고 업무를 바로 수정하며, 업무가 왜 멈췄는지, 언제 다시 확인해야 하는지, 완료 후 무엇이 이어지는지를 함께 관리한다.

`내 업무`는 같은 데이터를 개인 실행 순서로 보여준다.

제품이 매일 답해야 하는 질문은 다음과 같다.

1. 지금 내가 움직여야 하는 업무는 무엇인가?
2. 어떤 업무가 누구를 기다리고 있는가?
3. 언제 다시 확인해야 하는가?
4. 프로젝트의 중요한 결정과 일정은 무엇인가?
5. 현재 업무가 끝나면 무엇이 이어지는가?
6. 프로젝트 안에서 이 업무는 어디에 속하는가?

---

## 2. 현재 구현 진단

### 2.1 유지할 기반

- 제목만으로 저장하는 Quick Add
- Task 생성·수정·완료·취소·복원
- Inbox triage에 사용된 프로젝트·담당자·기한 수정 기능
- Project, Workstream, Task, Subtask 계층 데이터
- `importance`와 계층의 분리
- Task와 Milestone의 `kind` 분리
- Workstream band, Key Task 강조, Subtask 펼치기
- Milestone rail과 다이아몬드 표현
- workspace 범위 쿼리
- version 기반 동시 수정 방어
- 한국어 UI와 모바일 상세 편집

### 2.2 수정할 문제

#### 정보 구조

- 홈·내 업무·인박스·프로젝트·팀이 데이터 범주별 페이지로 분리되어 있다.
- 프로젝트 구조를 이해하고 수정하려면 여러 화면을 이동해야 한다.
- Team 페이지는 실제 업무 관점이 없는 placeholder다.
- Home과 Project가 각각 Canvas를 제공하여 중심 화면이 중복된다.

#### 생성 문법

- 전역 `업무 추가`가 프로젝트 생성과 Task 생성을 구분하지 못한다.
- Home의 `업무 추가`는 생성 위치와 소속이 보이지 않는다.
- Canvas 내부 생성도 Project, Workstream, parent Task 문맥을 충분히 사용하지 않는다.
- 빠르게 기록한 업무를 확인하기 위해 별도 Inbox 페이지로 이동한다.

#### 화면 공간

- 56px 고정 Nav, Home 제목, 설명, `업무 흐름` 제목, Canvas toolbar가 수직 공간을 연속해서 차지한다.
- Canvas 높이가 `72vh`로 제한되어 있다.
- Home 콘텐츠의 `max-w-5xl`과 Canvas의 full-width 처리 방식이 서로 충돌한다.
- 사용자가 가장 오래 보는 작업 공간보다 페이지 제목과 navigation chrome이 먼저 보인다.

#### 업무 위계

- 데이터와 일부 시각 표현은 계층을 지원한다.
- Project·Workstream 자체를 Canvas에서 직접 생성하고 수정할 수 없다.
- 모바일 목록에서 Workstream, Subtask, Milestone 구조가 사라진다.
- 축소 화면에서 Key Task와 Milestone만 남기는 정보 밀도 조절이 없다.

#### Workflow 본질

- Waiting 필드가 DB에 있으나 서비스·상세 화면·알림 파생 로직에 연결되지 않았다.
- 실제 Dependency 입력과 조회가 없다.
- 업무 완료 후 successor를 보여주지 않는다.
- Team 관점과 인계 흐름이 없다.
- 인증이 우회되어 기본 멤버로 자동 진입한다.

#### 의미가 부정확한 표현

- Canvas 실선이 저장된 Dependency 없이 상태별 업무를 임의로 연결한다.
- 상태마다 임의의 진행률을 부여한다.
- Project Pulse의 완료율이 실제 작업량이나 프로젝트 위험을 설명하지 못한다.

---

## 3. 확정할 제품 방향

### 3.1 최상위 navigation

주요 navigation은 두 개만 제공한다.

| 메뉴 | 역할 |
| --- | --- |
| 홈 | 전체 프로젝트 구조를 보고 편집하는 Workspace Canvas |
| 내 업무 | 현재 사용자 기준의 실행·Waiting·Review·Follow-up 목록 |

Project, Inbox, Team은 데이터 개념과 Canvas 관점으로 유지한다.

| 기존 페이지 | 변경 후 표현 |
| --- | --- |
| Inbox | Home의 `미분류 업무` 구획 또는 필터 |
| Projects | Canvas의 접을 수 있는 Project container |
| Project detail | Home에서 해당 Project에 focus한 상태 |
| Team | 담당자 기준 그룹·필터와 내 업무의 인계 정보 |
| Search | 상단 검색 결과에서 카드 또는 Project로 focus |

### 3.2 기존 URL 처리

기존 링크와 bookmark를 깨지 않도록 route alias를 유지한다.

| 기존 URL | 처리 |
| --- | --- |
| `/inbox` | `/home?view=unclassified`로 이동 |
| `/projects` | `/home?group=project`로 이동 |
| `/projects/:id` | `/home?project=:id`로 이동 |
| `/team` | `/home?group=assignee`로 이동 |
| `/search?q=` | 검색 overlay 또는 `/home?q=`로 연결 |

redirect 적용 전 기존 server page의 데이터 호출과 권한 확인을 Home query로 옮긴다.

---

## 4. 목표 화면 구조

### 4.1 Desktop

```text
┌──────────────────────────────────────────────────────────────────┐
│ Workflow   홈   내 업무                    검색      + 추가      │
├──────────────────────────────────────────────────────────────────┤
│ 전체 프로젝트 ▾  그룹 ▾  전체 · 지금 할 일 · 대기 · 기한 초과 │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│                         HOME CANVAS                              │
│                                                                  │
│  ▼ AURALEE 국내 론칭                                            │
│     본사 협의  [Key Task] [Subtask]                 ◇ Milestone │
│     PR          [Task]     [Task]                                │
│     이벤트      [Key Task] [Waiting]                             │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### 4.2 공간 기준

- 전역 top bar: 44~48px
- Canvas toolbar: 36~40px
- 큰 Home 제목과 설명 제거
- `업무 흐름` 중복 제목 제거
- Canvas container의 `max-w` 제거
- Canvas 높이: `100dvh`에서 top bar만 제외
- toolbar는 Canvas 내부 chrome으로 취급
- Desktop 첫 화면에서 Canvas가 viewport 높이의 최소 85%를 차지
- browser resize 시 Canvas가 즉시 남은 공간을 채움

### 4.3 반복 조작의 반응

- 상태·필터·그룹 전환은 즉시 반영
- 자주 쓰는 keyboard action에는 이동 animation을 사용하지 않음
- popover와 menu는 150~200ms 이내
- Project·Workstream 접기 전환은 200ms 이내
- `prefers-reduced-motion`에서 위치 이동 제거

---

## 5. 생성 문법

### 5.1 전역 `+ 추가`

상단 버튼 label은 `업무 추가`에서 `+ 추가`로 변경한다.

선택 메뉴:

1. 빠른 업무 기록
2. 프로젝트 만들기
3. 마일스톤 만들기

Project가 선택되지 않은 상태에서 마일스톤을 선택하면 Project를 먼저 고르게 한다. 마지막으로 사용한 생성 유형을 자동 실행하지 않는다.

### 5.2 위치별 생성

| 생성 위치 | 표시 label | 생성 객체 | 자동 지정 |
| --- | --- | --- | --- |
| 빈 Canvas | 프로젝트 추가 | Project | 없음 |
| Project header | 업무 영역 추가 | Workstream | 해당 Project |
| Workstream band | 업무 추가 | Task | Project, Workstream |
| Task card | 세부 업무 추가 | Task | Project, Workstream, parent Task |
| Milestone rail | 마일스톤 추가 | milestone-kind Task | 해당 Project |
| 내 업무 | 빠른 업무 기록 | Task | 현재 사용자, 미분류 |

### 5.3 Quick Capture

- 제목만 입력하면 저장
- modal 또는 compact popover에서 Enter로 저장
- 생성 후 Inbox 페이지로 이동하지 않음
- Home의 `미분류 업무`에 즉시 나타남
- Project와 Workstream은 이후 drag 또는 Inspector에서 지정
- 생성 시 중요도, 상세 설명, 기한을 요구하지 않음

### 5.4 명칭 원칙

- 객체가 정해진 위치에서는 구체적인 명칭 사용
- `업무 추가`, `세부 업무 추가`, `마일스톤 추가`, `프로젝트 만들기` 구분
- `Key Task 추가`를 별도 생성 유형으로 두지 않음
- 일반 Task 생성 후 `핵심 업무로 지정` 가능

---

## 6. Canvas 직접 편집

### 6.1 편집 범위

| 객체 | Canvas 직접 편집 | Inspector 또는 menu |
| --- | --- | --- |
| Project | 이름, 접기·펼치기 | 목적, 리드, 기간, 보관 |
| Workstream | 이름, 순서, 접기·펼치기 | 설명, 색상, 보관 |
| Task | 제목, 상태, 중요도 | 설명, 담당자, reviewer, 날짜, Waiting |
| Subtask | 제목, 완료, 펼치기 | parent 변경, 담당자, 날짜 |
| Milestone | 제목, 날짜 | 담당자, Dependency, 설명 |

### 6.2 기본 interaction

- Project와 Workstream 이름 클릭: inline rename
- 카드 제목 클릭: inline rename
- 카드 본문 클릭: 우측 Inspector
- 상태 열 사이 이동: status 변경
- Workstream 사이 이동: workstream 변경
- Task 카드의 `+`: Subtask 입력
- Project·Workstream의 `⋯`: 상세 설정
- `Esc`: 편집 취소
- `Enter`: 변경 저장
- 저장 중 다른 카드 편집을 막지 않음

### 6.3 계층 변경

첫 구현에서는 `상위 업무 변경` command로 parent를 바꾼다.

drag 기반 nesting은 다음 조건을 충족한 뒤 추가한다.

- drop target이 상위 업무와 Workstream을 명확히 구분
- 순환 parent 검증
- 다른 Project의 Task를 parent로 지정하지 못함
- 이동 결과를 취소할 수 있는 toast 제공
- touch 환경에서 accidental drag 방지

---

## 7. 위계·중요도·상태의 시각 규칙

세 축이 서로의 표현을 사용하지 않도록 한다.

| 정보 축 | 의미 | 표현 |
| --- | --- | --- |
| 위계 | 어디에 속하는가 | container, band, 들여쓰기, parent connector |
| 중요도 | 프로젝트 영향이 큰가 | 글자 굵기, 카드 크기, border weight |
| 상태 | 현재 어느 단계인가 | column 위치, status label, 제한된 상태 색상 |
| Milestone | 프로젝트 전체에 영향을 주는 사건 | rail, 다이아몬드 shape |
| Dependency | 실제 선후 관계 | 저장된 edge를 사용한 연결선 |

### 7.1 Project

- 가장 큰 접이식 container
- 이름, 기간, 중요 신호를 header에 표시
- 접힌 상태에서도 Key Task, Waiting 개수, 가까운 Milestone 표시

### 7.2 Workstream

- Project 안의 band
- band header에 이름, 업무 수, Waiting 신호, `+ 업무` 제공
- 접힌 상태에서도 Key Task와 Milestone 관련 신호 유지

### 7.3 Key Task

- 데이터상 `importance=key`
- 일반 Task보다 높은 border weight와 typography 사용
- 상태 색으로 중요도를 표현하지 않음
- Subtask라도 key이면 독립 카드로 승격 가능
- 원래 parent와 dashed tether로 소속 표시

### 7.4 Subtask

- parent 카드 안에서 들여쓰기 row로 표시
- 여러 단계가 있으면 depth connector 제공
- 완료 개수는 `1/3`처럼 사실 기반으로 표시
- 임의의 percentage로 환산하지 않음

### 7.5 Milestone

- 일반 Task card와 다른 shape 사용
- Project rail에서 날짜와 함께 표시
- 중요도와 별개로 `kind=milestone`
- Dependency의 predecessor 또는 successor가 될 수 있음

---

## 8. Zoom과 정보 밀도

Home에 여러 Project가 있어도 구조를 잃지 않도록 단계별 표시를 적용한다.

| 단계 | 표시 정보 |
| --- | --- |
| Far | Project, Workstream, Key Task, Milestone, Waiting·overdue 신호 |
| Medium | 상위 Task, status, 담당자 또는 기한의 핵심 정보 |
| Near | Subtask, 세부 날짜, reviewer, inline add |
| Selected | Inspector에서 전체 정보 |

기준:

- Far 단계에서 일반 Subtask label 숨김
- Key Task와 Milestone은 모든 단계에서 유지
- 카드가 읽을 수 없는 크기로 축소되기 전에 정보 종류를 줄임
- Project focus 시 해당 Project를 자동 fit
- 전체 fit과 현재 Project fit을 toolbar에서 제공

---

## 9. Workflow 본질 복구

### 9.1 Waiting

Task를 Waiting으로 변경할 때 다음 필드를 짧은 panel에서 입력한다.

| 필드 | 필수 여부 |
| --- | --- |
| 대기 상대·대기처 | 필수 |
| 대기 사유 | 필수 |
| Follow-up 담당자 | 필수 |
| 다음 확인 시각 | 필수 |
| Blocked 여부와 사유 | 선택 |

동작:

- Waiting 선택 직후 입력 panel 표시
- 네 필드가 없으면 Waiting 확정 저장 불가
- `follow_up_at` 도래 시 `확인 필요`에 노출
- Home 카드에 상대와 다음 확인일을 한 줄로 표시
- 내 업무에는 Follow-up 담당자 기준으로 표시
- Waiting 해제 시 기존 정보는 activity history에 보존

### 9.2 Dependency

필수 구현:

- predecessor 추가·삭제
- successor 조회
- 동일 workspace 검증
- self dependency 금지
- cycle 금지
- 완료 시 successor 노출
- predecessor가 끝나지 않은 Task에 `선행 업무 대기` 표시

Canvas 규칙:

- 저장된 `task_dependency`만 실선으로 표시
- parent 관계는 dashed tether 사용
- 자동 추정 연결선 제거
- edge 선택 시 predecessor와 successor title 표시
- 선이 많으면 선택된 카드와 관련된 edge를 우선 강조

### 9.3 완료 후 다음 업무

- Task 완료 toast 또는 Inspector에 successor 표시
- 현재 사용자에게 배정된 successor이면 `내 업무` 상단에 노출
- successor의 모든 predecessor가 끝나면 `Ready` 표시
- `다음 업무`는 시작일 추정 대신 Dependency를 우선 사용
- Dependency가 없는 경우에만 start date를 보조 기준으로 사용

### 9.4 Team 가시성과 인계

별도 Team 페이지를 만들지 않는다.

Home 담당자 관점:

- 담당자별 진행 중
- Waiting
- Review
- Follow-up 도래
- overdue

인계:

- 완료 업무의 successor 담당자가 다르면 인계 신호 표시
- reviewer가 지정된 Review Task를 reviewer의 내 업무에 노출
- 생산성 점수와 개인별 완료율은 제공하지 않음

---

## 10. 부정확한 표현 제거

구현 초기에 다음 항목을 제거한다.

1. 상태별 첫 Task를 자동 연결하는 Canvas flow line
2. Inbox 0%, To Do 6%, In Progress 55%, Waiting 50%, Review 85% 같은 임의 진척률
3. 임의 값으로 계산한 effective status
4. 작업량으로 오해할 수 있는 Project 완료율 progress bar

대체 표현:

- 상태별 Task 개수
- 완료된 Subtask 개수
- Waiting과 overdue 개수
- 다음 Milestone 날짜
- 실제 Dependency blocker
- `완료 2/6`처럼 분모와 분자가 명확한 count

---

## 11. 내 업무

내 업무는 Canvas의 복사본이 아니라 개인 실행 화면이다.

표시 순서:

1. Follow-up 도래
2. Review 요청
3. 진행 중
4. Ready successor
5. 오늘까지
6. Waiting
7. 이후 예정

기능:

- title·status·due date 빠른 변경
- Waiting 정보 확인과 Follow-up 완료
- reviewer action
- Project 또는 Canvas 카드로 이동
- 미분류 업무 빠른 기록

내 업무에서 구조가 필요할 때 Project와 Workstream을 작은 context label로 표시한다.

---

## 12. 모바일과 작은 화면

2차원 Canvas를 축소하지 않고 같은 데이터를 structured outline으로 변환한다.

```text
▼ AURALEE 국내 론칭
  ▼ 본사 협의
      ◆ 마케팅 가이드 검토
          ├ 금지 표현 대조
          └ 수정 조항 작성
      ◇ 본사 회신 완료 · 8/12

  ▶ PR
  ▶ 이벤트 · Waiting 2
```

필수 기준:

- Project와 Workstream accordion
- Key Task는 접힌 Workstream에서도 표시 가능
- Subtask 들여쓰기와 depth connector
- Milestone divider 또는 diamond
- Waiting 상대와 다음 확인일 표시
- touch target 최소 44px
- Task 선택 시 full-screen Inspector
- 상단 navigation은 홈·내 업무와 `+`만 표시
- mobile menu에 제거된 전용 페이지를 다시 넣지 않음

---

## 13. 데이터·서비스 변경

### 13.1 유지할 모델

- `task.project_id`
- `task.workstream_id`
- `task.parent_task_id`
- `task.importance`
- `task.kind`
- `task.status`
- Waiting 관련 기존 필드
- `task_dependency`
- `task.version`

별도의 Key Task table과 고정 4단계 hierarchy enum을 추가하지 않는다.

### 13.2 필요한 서비스 작업

- `TaskPatch`에 Waiting 필드 추가
- Waiting transition validation
- `follow_up_at` 기반 attention query·derive
- dependency CRUD service
- cycle detection
- successor·predecessor query
- parent 변경 service와 cycle 검증
- Project·Workstream inline rename action
- Home 통합 query의 workspace 검증
- route redirect 전 권한 확인

### 13.3 View state

다음 값은 Task 데이터와 분리한다.

- Canvas zoom과 pan
- Project·Workstream collapse
- 선택한 group과 focus
- 마지막으로 연 Project

초기에는 URL query와 local storage를 사용한다. 팀 공통 구조에 영향을 주는 Project·Workstream 순서는 DB에 저장한다.

---

## 14. 구현 Work Package

### WP0. 의미 정확성 확보

범위:

- 자동 flow line 제거
- 임의 progress 제거
- 기존 테스트 기준선 확인
- staging fixture 준비

완료 기준:

- 실제 Dependency가 없는 카드 사이에 실선이 없음
- 임의 percentage가 UI와 파생 로직에 없음
- 기존 unit test, typecheck, build 통과

### WP1. App Shell과 route 통합

범위:

- navigation을 홈·내 업무로 축소
- 전역 bar를 44~48px로 축소
- Home 제목·설명·중복 section title 제거
- Home Canvas full-width·full-height
- 기존 route alias와 redirect
- 검색을 Home focus로 연결

완료 기준:

- Desktop 첫 화면의 최소 85%가 Canvas
- Inbox·Project·Team으로 이동하지 않고 Home에서 관점 변경
- 기존 deep link가 유효한 Home 상태로 연결

### WP2. 생성 문법

범위:

- 전역 `+ 추가` menu
- 빠른 업무 기록과 미분류 구획
- Project·Workstream·Task·Subtask·Milestone 위치별 생성
- 생성 후 redirect 제거

완료 기준:

- 사용자가 생성 전 객체 종류와 생성 위치를 알 수 있음
- Workstream에서 만든 Task의 Project와 Workstream이 자동 지정
- Task에서 만든 Subtask의 parent가 자동 지정
- 빠른 기록은 제목만 요구

### WP3. Canvas 직접 편집과 hierarchy

범위:

- Project·Workstream inline rename
- Project·Workstream 접기
- 카드 inline title edit
- 우측 Inspector
- parent 변경 command
- Key descendant와 tether 보완
- Zoom LOD

완료 기준:

- 구조와 기본 속성 편집을 위해 별도 Project settings page를 열지 않음
- 축소 상태에서도 Project, Workstream, Key Task, Milestone 식별 가능
- 단순 Project는 Workstream과 Subtask 없이 사용 가능

### WP4. Waiting

범위:

- Waiting 필드의 service·action·UI 연결
- 필수 validation
- Follow-up attention
- Home·내 업무 표현
- activity history

완료 기준:

- 본사 회신 대기 업무에서 상대·사유·담당자·확인일 확인 가능
- 확인일이 지난 Waiting이 담당자의 확인 필요에 나타남
- Waiting 정보 없이 상태 확정 불가

### WP5. 실제 Dependency와 successor

범위:

- dependency CRUD
- workspace·self·cycle validation
- 실제 edge 렌더링
- Ready와 successor 노출
- 완료 후 인계

완료 기준:

- 저장된 관계와 Canvas 선이 일치
- predecessor가 끝나면 successor가 내 업무에 노출
- cycle 생성 시 저장되지 않고 원인을 안내

### WP6. 내 업무와 모바일 구조

범위:

- 개인 실행 우선순위 재정렬
- reviewer와 Follow-up 관점
- structured outline
- Project·Workstream accordion
- 모바일 생성·편집

완료 기준:

- 모바일에서도 Project·Workstream·Key Task·Subtask·Milestone 구분
- 내 업무에서 Waiting과 Ready successor를 찾을 수 있음
- 핵심 편집이 touch 환경에서 가능

### WP7. 인증과 Pilot 검수

범위:

- 기본 멤버 자동 진입 제거
- 실제 session과 middleware
- workspace 간 접근 차단
- browser E2E
- staging Pilot

완료 기준:

- 로그인하지 않은 사용자는 업무 데이터에 접근하지 못함
- 다른 workspace URL과 action 접근이 차단됨
- Pilot 필수 시나리오가 staging에서 통과

---

## 15. 구현 순서와 Release Gate

### Gate A. 통합 편집 Workspace

필수 Work Package:

- WP0
- WP1
- WP2
- WP3의 inline edit·collapse·Inspector

판정 질문:

- 사용자가 Home을 벗어나지 않고 Project와 업무를 만들고 정리할 수 있는가?
- 추가 버튼의 결과를 누르기 전에 예측할 수 있는가?
- Canvas가 첫 화면의 중심인가?

### Gate B. Workflow Loop

필수 Work Package:

- WP4
- WP5
- WP6의 내 업무 우선순위

판정 질문:

- 멈춘 업무의 상대·이유·다음 확인일이 보이는가?
- 확인할 시점이 되면 담당자에게 돌아오는가?
- 완료 후 실제 successor와 인계 대상이 보이는가?

### Gate C. Pilot Ready

필수 Work Package:

- WP6 모바일
- WP7
- staging E2E

판정 질문:

- 팀원이 매일 갱신할 수 있는가?
- 리더가 별도 상태 질문 없이 멈춘 지점을 찾을 수 있는가?
- 모바일과 Desktop에서 같은 구조를 이해할 수 있는가?
- 데이터 접근과 동시 수정 결과를 신뢰할 수 있는가?

Gate를 순서대로 통과한다. Gate A 완료만으로 Pilot을 시작하지 않는다.

---

## 16. 검수 시나리오

| 번호 | 시나리오 | 기대 결과 |
| --- | --- | --- |
| 1 | 전역 `+ 추가`에서 빠른 업무 기록 | 제목만 입력하고 미분류에 즉시 나타남 |
| 2 | 새 Project 생성 | Home Canvas에 새 container가 생김 |
| 3 | Project 안에 Workstream 생성 | 해당 Project 내부 band로 표시 |
| 4 | Workstream 안에 Task 생성 | 소속이 자동 지정되고 현재 status 열에 표시 |
| 5 | Task 안에 Subtask 생성 | parent 관계와 들여쓰기가 즉시 표시 |
| 6 | Subtask를 Key로 지정 | 독립 카드 승격과 parent tether 표시 |
| 7 | 본사 회신 대기를 Waiting으로 변경 | 네 필수 필드를 입력하고 다음 확인일 표시 |
| 8 | Follow-up 시각 경과 | 담당자의 내 업무 `확인 필요`에 노출 |
| 9 | A를 B의 predecessor로 지정 | 실제 edge가 표시되고 B에 blocker 표시 |
| 10 | A 완료 | B가 Ready 또는 다음 업무로 노출 |
| 11 | Dependency cycle 시도 | 저장 차단과 설명 제공 |
| 12 | Canvas 축소 | Key Task, Milestone, Waiting 신호 유지 |
| 13 | Project 접기 | 핵심 신호만 남고 다른 Project 작업 가능 |
| 14 | 모바일 Home 진입 | structured outline으로 동일한 위계 표시 |
| 15 | 다른 workspace 접근 | page와 mutation 모두 차단 |
| 16 | 두 사용자가 같은 Task 수정 | stale write 감지와 최신 데이터 안내 |

---

## 17. 테스트 계획

### Unit·Service

- Waiting 필수 필드 validation
- Waiting 해제와 history
- follow-up 도래 계산
- dependency self·cycle·workspace validation
- successor Ready 계산
- parent 변경 cycle 검증
- version 기반 stale update
- route query parsing

### Component

- 전역 추가 menu label
- 위치별 add의 자동 context
- Project·Workstream inline edit
- collapse
- Zoom LOD
- Waiting panel
- 실제 dependency edge
- 모바일 outline depth

### Browser E2E

최소 E2E:

1. 로그인
2. Project → Workstream → Task → Subtask 생성
3. 빠른 기록 → 미분류 → Project 정리
4. Waiting 생성 → Follow-up 도래 → 해제
5. Dependency 생성 → predecessor 완료 → successor 시작
6. reviewer 인계
7. mobile hierarchy
8. workspace 접근 차단
9. stale update
10. 기존 route redirect

### Visual QA

- 1440×900 Desktop
- 1024px 작은 Desktop
- 768px tablet
- 390×844 mobile
- 320px 최소 mobile
- 200% browser zoom
- reduced motion
- keyboard-only navigation

---

## 18. Pilot 차단 조건

다음 중 하나라도 남아 있으면 Pilot Ready로 판정하지 않는다.

- Waiting 필수 정보가 UI에 없음
- follow-up 도래 업무가 담당자에게 돌아오지 않음
- 저장되지 않은 자동 flow line이 표시됨
- Dependency의 cycle·workspace 검증이 없음
- 기본 멤버 자동 진입이 남아 있음
- Team 관점에서 Waiting·Review·확인 필요를 볼 수 없음
- 모바일에서 위계와 Milestone이 사라짐
- browser E2E가 없음
- 전역 추가 버튼이 객체 종류를 구분하지 못함
- Home에서 기본 구조 편집을 위해 전용 관리 페이지로 이동해야 함

---

## 19. 범위 제외

Pilot 전에는 다음을 구현하지 않는다.

- AI 자동 업무 생성
- AI 상태 요약
- Calendar 양방향 연동
- 고급 Gantt
- workload 점수
- 개인 생산성 점수
- gameification
- 고급 파일 관리
- 범용 댓글 시스템
- 자동으로 추정한 Dependency
- 고정된 4단계 hierarchy 강제

---

## 20. 주요 위험과 대응

| 위험 | 대응 |
| --- | --- |
| 모든 Project를 한 Canvas에 표시해 복잡해짐 | Project·Workstream collapse, focus, Zoom LOD |
| 단순 Project에도 분류를 요구함 | Workstream과 Subtask를 선택 기능으로 유지 |
| hierarchy drag에서 실수 발생 | 첫 버전은 명시적 parent 변경 command 사용 |
| 기존 URL과 bookmark 손실 | route alias와 query redirect |
| 많은 카드로 렌더링 성능 저하 | LOD 적용 후 실제 데이터로 profiling, 필요 시 virtualization |
| Home과 내 업무의 역할 중복 | Home은 구조 편집, 내 업무는 개인 실행 순서로 제한 |
| Canvas 편집 확장이 Waiting 개발을 지연 | Gate A 범위를 inline edit·collapse·Inspector로 제한 |
| 상태 색과 중요도 표현이 섞임 | 중요도는 weight, 상태는 위치와 status token으로 고정 |

---

## 21. 구현 영향 파일

초기 예상 범위:

- `app/src/components/NavBar.tsx`
- `app/src/components/HomeContent.tsx`
- `app/src/components/MyWorkContent.tsx`
- `app/src/components/QuickAdd.tsx`
- `app/src/components/workflow/WorkflowCanvas.tsx`
- `app/src/components/tasks/TaskDetailPanel.tsx`
- `app/src/components/tasks/useTaskController.ts`
- `app/src/app/(app)/layout.tsx`
- 기존 Inbox·Project·Team route
- `app/src/app/actions/tasks.ts`
- Project·Workstream action
- `app/src/server/services/task.ts`
- dependency service
- `app/src/server/data/queries.ts`
- `app/src/lib/derive.ts`
- `app/src/lib/board-graph.ts`
- service·component·browser test

DB migration은 기존 Waiting 필드와 `task_dependency`가 실제 환경에 적용되어 있는지 확인한 뒤 결정한다. hierarchy를 위한 새 table은 계획하지 않는다.

---

## 22. 완료 정의

수정 작업은 다음 상태에서 완료된다.

1. 최상위 navigation이 홈과 내 업무로 정리된다.
2. Home Canvas에서 Project부터 Subtask와 Milestone까지 생성·수정할 수 있다.
3. 추가 버튼이 생성 객체와 위치를 명확히 보여준다.
4. Canvas가 Desktop 작업 공간의 중심을 차지한다.
5. 축소 화면과 모바일에서도 Project 구조와 핵심 사안이 남는다.
6. Waiting 업무가 상대·이유·담당자·다음 확인일을 가진다.
7. 실제 Dependency만 연결선으로 표시된다.
8. 업무 완료 후 successor와 인계 대상이 드러난다.
9. 인증과 workspace 접근 통제가 실제 사용자 기준으로 작동한다.
10. staging browser E2E가 Pilot 필수 시나리오를 통과한다.

