# 모바일 홈·프로젝트 플로우 개편 계획

**상태:** implemented  
**작성일:** 2026-07-27  
**대상:** Marketing Team Workflow의 `/home`, `/projects/[projectId]`  
**계획 모드:** omc-plan interview  

## 1. 요구사항 요약

모바일 사용자가 개인 업무보다 먼저 팀과 프로젝트의 **전체 업무 현황과
흐름**을 읽을 수 있게 홈과 프로젝트 화면을 개편한다. 데스크톱 캔버스를
작게 축소하거나 숨기는 방식이 아니라, 동일한 도메인 계층을 모바일에 맞는
세로형 정보 구조로 다시 표현한다.

핵심 계층은 다음과 같다.

`브랜드 → 프로젝트 → 업무 영역/단계 → 업무/하위 업무 → 상태`

현재 Home은 서버와 첫 클라이언트 렌더에서 보드를 출력한 뒤 `matchMedia`로
모바일에서 숨기고 개인 업무 목록을 앞세운다:
`app/src/components/HomeContent.tsx:60-75`, `:223-225`, `:368-414`.
Project도 workflow를 먼저 렌더한 뒤 모바일에서 tasks 탭으로 전환한다:
`app/src/app/(app)/projects/[projectId]/ProjectWorkspace.tsx:73-90`.
두 방식 모두 사용자가 원하는 전체 플로우를 제공하지 못하고 hydration 이후
화면 전환 가능성을 만든다.

### 범위

- 모바일 Home의 팀·프로젝트 전체 현황과 세로형 플로우
- 모바일 Project의 상세 세로형 플로우
- Home과 Project가 공유하는 집계 규칙과 표현 컴포넌트
- 모바일 터치 영역, 긴 한글 텍스트, 확대, safe area, 접근성
- 기존 상세 패널·업무 생성·필터 동작과의 연결
- 필요한 단위·컴포넌트·브라우저 검증

### 범위 제외

- `/my-work`, `/team`, `/inbox`, `/search`의 전면 개편
- 데스크톱 보드/캔버스의 구조 변경
- DB schema, query, task mutation, 권한 모델 변경
- 임의 퍼센트 기반 프로젝트 진척률
- drag-and-drop, pan/zoom 등 모바일 캔버스 조작
- 앱 전체 아이콘·폰트·색상 체계 교체
- Supanova의 독립 HTML/Tailwind CDN 아키텍처 적용

## 2. 설계 원칙

1. **전체에서 세부로:** 전체 규모 → 브랜드/프로젝트 → 단계 흐름 → 대표
   업무 → 상세 순으로 점진 노출한다.
2. **도메인 계층 보존:** 데스크톱과 모바일이 같은 데이터와 집계 정의를
   사용하고 표현만 달리한다.
3. **읽기 우선:** 첫 화면의 주인공은 경고 수치가 아니라 전체 현황과
   프로젝트 흐름이다. 예외 상태는 맥락 안에서 강조한다.
4. **한 화면 한 수준:** 브랜드는 섹션, 프로젝트는 주 인터랙티브 표면,
   업무 영역은 divider 기반 행으로 표현해 중첩 카드 남발을 피한다.
5. **모바일을 초기 렌더부터 확정:** JS viewport 감지 후 화면을 바꾸지 않고
   CSS breakpoint로 처음부터 올바른 뷰를 제공한다.

## 3. 디자인 방향

### 3.1 제품·대상·화면의 한 가지 임무

- **제품:** 소규모 마케팅팀의 브랜드·프로젝트 업무 흐름 관리 도구
- **대상:** 여러 브랜드와 프로젝트를 함께 운영하는 팀원
- **한 가지 임무:** 휴대폰에서 현재 어떤 프로젝트가 어느 단계에 있고
  업무가 어떻게 흐르는지 빠르게 파악한다.

### 3.2 토큰

기존의 `refined minimalism, editorial calm`을 유지한다
(`app/src/styles/globals.css:8-17`). 새 하드코딩 색상은 만들지 않고 아래
시맨틱 역할을 기존 CSS 변수에 매핑한다.

| 역할 | 값 | 용도 |
|---|---:|---|
| Canvas | `rgb(var(--bg))` | 화면 배경 |
| Project Surface | `rgb(var(--surface))` | 프로젝트 주 표면 |
| Nested Surface | `rgb(var(--surface-2))` | 펼친 단계 영역 |
| Primary Text | `rgb(var(--text))` | 제목·핵심 수치 |
| Secondary Text | `rgb(var(--text-secondary))` | 설명·메타데이터 |
| Accent | `rgb(var(--accent))` | 선택·포커스·주 행동 하나 |

브랜드 색은 프로젝트 정체성에만, `--status-*`는 업무 상태에만 사용한다
(`app/src/styles/globals.css:59-81`). 색만으로 의미를 전달하지 않고 한글
라벨과 건수를 항상 함께 표시한다.

### 3.3 타입

- **본문·한글 제목:** 기존 Pretendard를 유지한다
  (`app/src/styles/globals.css:1-2`).
- **데이터·건수·날짜:** Pretendard의 tabular numerals와 기존 utility
  scale을 사용한다.
- **프로젝트 디스플레이 역할:** 현재 의미 없이 사용된 Tailwind 기본
  `font-serif`를 제거하고, Pretendard 20–24px/semibold와 넉넉한 한글
  행간으로 일관성을 확보한다
  (`ProjectWorkspace.tsx:146-152`).
- 모든 한글 제목은 `word-break: keep-all`, 긴 동적 제목은 2줄까지 읽게
  하고 메타데이터보다 우선한다.

새 디스플레이 웹폰트는 추가하지 않는다. 내부 업무 도구에서 다운로드 비용과
한글 혼용 불일치보다 프로젝트명 자체의 계층과 리듬이 더 중요하기 때문이다.

### 3.4 시그니처: Vertical Flow Spine

펼친 프로젝트 안에서 업무 영역/단계를 가는 세로선으로 연결한다. 각 노드는
단계명, 완료 `n/전체 n`, 현재 존재하는 상태 라벨을 제공하고 대표 업무를
점진 노출한다. 이는 장식이 아니라 실제 업무 순서와 소속을 인코딩한다.

과감함은 이 요소 하나에만 사용한다. gradient mesh, floating orb, liquid
glass 중첩, 무한 marquee는 업무 가독성을 방해하므로 사용하지 않는다.

### 3.5 모바일 와이어프레임

#### Home — 기본

```text
┌──────────────────────────────┐
│ 전체 업무 흐름               │
│ 브랜드 9 · 프로젝트 14 · 업무 47 │
├──────────────────────────────┤
│ ● 스텔라랩스                 │
│ ┌──────────────────────────┐ │
│ │ 봄 캠페인            8/13 │ │
│ │ 진행 3 · 대기 1 · 검토 2 │ │
│ │ 다음 마일스톤 · 7월 30일  │ │
│ │                  [펼치기] │ │
│ └──────────────────────────┘ │
│ ┌──────────────────────────┐ │
│ │ 리브랜딩             4/9 │ │
│ └──────────────────────────┘ │
├──────────────────────────────┤
│ ● 베리파이                   │
│ ...                          │
└──────────────────────────────┘
```

#### Home — 프로젝트 펼침

```text
┌──────────────────────────────┐
│ 봄 캠페인              [접기] │
│ 완료 8/13 · 목표 8월 12일     │
│                              │
│ ● 기획          완료 3/3     │
│ │                            │
│ ● 제작    진행 2 · 대기 1    │
│ │  메인 비주얼 제작          │
│ │  카피 검토                 │
│ │                            │
│ ● 검수           검토 2      │
│    대표 업무 2개 더 보기      │
└──────────────────────────────┘
```

#### Project

```text
┌──────────────────────────────┐
│ 스텔라랩스 › 프로젝트         │
│ 봄 캠페인                     │
│ 캠페인 공개까지 필요한 흐름    │
│ 완료 8/13 · 진행 3 · 대기 1   │
├──────────────────────────────┤
│ [전체] [진행] [대기] [검토]   │
├──────────────────────────────┤
│ ● 기획 ........................│
│ │ 업무 행                     │
│ ● 제작 ........................│
│ │ 업무 행 / 하위 업무 펼침    │
│ ● 검수 ........................│
└──────────────────────────────┘
```

## 4. 대안 검토와 자기 비평

### 채택안: 세로 Flow Spine

- 작은 폭에서 계층과 단계 순서를 동시에 보존한다.
- 가로 스크롤·축소·pan/zoom 없이 읽을 수 있다.
- Home 요약과 Project 상세가 같은 시각 문법을 공유한다.

### 기각안 A: 가로 캔버스 축소 또는 가로 스크롤

현재 캔버스는 `w-screen`, 최소 440px 높이와 수평 공간을 전제로 한다:
`app/src/components/workflow/WorkflowCanvas.tsx:1004-1006`, `:1063`.
작은 글자와 잘린 맥락을 만들고 visibility 목표를 충족하지 못하므로 모바일
기본 뷰에서 제외한다.

### 기각안 B: 숫자 중심 대시보드

빠른 상태 요약에는 유리하지만 브랜드·프로젝트·단계 사이의 관계를 지워
사용자가 요구한 “전체적인 업무 현황과 플로우”를 다시 부차화한다.

### 고유성 검토 후 수정

초기 아이디어의 “프로젝트 카드 안에 상태 칩과 진행 막대”는 일반적인 SaaS
대시보드와 구별되지 않고 업무 수를 진척률로 오해하게 했다. 이를 실제
업무 영역을 잇는 Flow Spine과 `완료 n/전체 n` 사실값으로 수정한다.
0건 상태 칩은 요약에서 숨기고, 중첩 카드는 프로젝트 한 수준으로 제한한다.

## 5. 구현 단계

### 5.1 공통 모바일 집계 모델

신규 `app/src/lib/workflow-summary.ts`에 순수 selector를 만든다.

- 브랜드별 활성 프로젝트 그룹
- 프로젝트별 전체/완료 업무 수
- 진행·대기·검토·기한 초과 수
- workstream별 업무와 하위 업무 그룹
- 다음 미완료 마일스톤 또는 프로젝트 목표 종료일
- 취소 업무, 하위 업무, 마일스톤을 분모와 대표 목록에 포함하는 규칙

기존 `ProjectPulse`의 집계 규칙을 확인해 Home과 Project가 서로 다른 수치를
표시하지 않게 공통 selector로 통합한다. 현재 `ProjectPulse`는 취소,
하위 업무, milestone을 집계에서 제외한다:
`app/src/components/projects/ProjectPulse.tsx:41-56`.

집계 정의:

- 프로젝트 `전체`: 취소되지 않은 최상위 일반 업무
- 프로젝트 `완료`: 위 집합 중 `Done`
- 상태 건수: 위 집합 중 각 활성 상태
- 하위 업무: 부모 업무를 펼쳤을 때만 별도 `완료 n/전체 n`
- 마일스톤: 업무 분모에서 제외하고 일정 정보로만 표시

### 5.2 공유 모바일 표현 컴포넌트

신규 디렉터리 `app/src/components/workflow/mobile/`에 다음을 둔다.

- `MobileWorkflowOverview.tsx`: 전체 수치와 브랜드 섹션
- `MobileProjectSummary.tsx`: 프로젝트 요약·펼침 제어
- `MobileFlowSpine.tsx`: workstream 단계와 대표 업무
- `MobileWorkflowTaskRow.tsx`: 제목 우선의 모바일 업무 행

요구사항:

- 모바일 컨트롤의 실제 hit area는 최소 48×48px
- 프로젝트 펼침은 native button과 `aria-expanded`,
  `aria-controls`를 사용
- 상태 필터는 `aria-pressed` 또는 tab semantics 제공
- 제목은 2줄, 보조 메타는 다음 줄로 내려 제목 폭을 침범하지 않음
- 한 번에 한 프로젝트만 펼치는 accordion을 기본으로 하되, route 이동
  전후에는 query/state 계약을 정해 현재 맥락을 보존
- 기존 `TaskDetailPanel`, `useTaskController`, 생성 dialog를 재사용
- 장식용 아이콘은 만들지 않고 텍스트와 CSS primitive로 구조를 표현

Supanova의 Solar-only 아이콘 규칙은 랜딩페이지용 Iconify/CDN 전제를 갖고
있어 현재 React 앱의 `lucide-react` 체계
(`app/package.json:34`)와 충돌한다. 이번 범위에서는 새 아이콘 의존성을
추가하거나 혼용하지 않고, 신규 모바일 플로우에서 아이콘 사용 자체를
최소화한다. 앱 전체 아이콘 전환은 별도 작업으로 분리한다.

### 5.3 Home 반응형 구성

`app/src/components/HomeContent.tsx`를 다음처럼 변경한다.

- `showBoard`와 mount 후 `matchMedia` 전환을 제거한다 (`:62-75`).
- 동일 데이터로 `md:hidden` 모바일 overview와 `hidden md:block`
  데스크톱 `StackedWorkflowBoard`를 병렬 구성해 SSR과 hydration 결과를
  안정화한다.
- 모바일 Home에서 `MobileWorkflowOverview`를 개인 TaskSection보다 먼저
  배치한다 (`:223-365`, `:368-414`).
- 브랜드 필터와 focus 정의를 모바일 overview에서도 재사용하되, 필터
  제어는 48px hit area와 읽을 수 있는 라벨을 제공한다.
- 프로젝트 요약을 탭하면 inline Flow Spine을 펼치고, 프로젝트명/별도
  “프로젝트 열기” 행동으로 상세 route에 진입한다. 펼침과 이동을 한
  tap target에 중복 배정하지 않는다.
- 개인 TaskSection은 제거하지 않고 전체 overview 아래의 보조 영역으로
  유지한다.
- 프로젝트/업무가 없는 상태에서는 다음 행동을 하나만 제시한다.

### 5.4 Project 반응형 구성

`app/src/app/(app)/projects/[projectId]/ProjectWorkspace.tsx`를 변경한다.

- mount 후 `activeTab`을 바꾸는 `matchMedia` effect를 제거한다 (`:73-90`).
- 모바일에는 workflow/tasks 탭 대신 `MobileFlowSpine`을 기본으로
  렌더링하고, 데스크톱 탭과 `WorkflowCanvas`는 `md` 이상에서 유지한다
  (`:239-270`).
- 헤더의 기본 serif를 제거하고 긴 프로젝트명·목표·날짜가 320px에서
  자연스럽게 stack되도록 한다 (`:133-214`).
- `ProjectPulse`의 집계 selector를 공유하고, 모바일 상태 수치를 누르면
  캔버스로 전환하지 않고 Flow Spine 내부를 해당 상태로 필터링한다
  (`:226-236`).
- 보관된 프로젝트는 읽기 전용 상태를 명시하고 생성/수정 행동을 감춘다.
- 기존 Task 상세·생성·수정 흐름은 그대로 연결한다.

### 5.5 모바일 기반과 safe area

`app/src/app/layout.tsx`, `app/src/app/(app)/layout.tsx`,
`app/src/styles/globals.css`에서 다음을 범위 내 보완한다.

- `min-h-screen`을 동적 viewport에 안전한 `min-h-[100dvh]`로 교체
- 앱 main과 전체 화면 panel의 하단에
  `env(safe-area-inset-bottom)`을 반영
- 200% text zoom에서 고정 높이가 콘텐츠를 자르지 않게 mobile flow의
  컨테이너는 내용 기반 높이 사용
- 기존 reduced motion/transparency/high contrast 대응
  (`globals.css:328-355`) 유지

공용 Button의 전역 크기는 변경하지 않는다. Home/Project의 신규 모바일
variant에만 48px hit area를 적용해 다른 route의 회귀를 피한다.

### 5.6 상태·빈 화면·오류

다음 상태를 서로 다른 문장과 한 가지 다음 행동으로 정의한다.

- 브랜드 없음 → `첫 브랜드 만들기`
- 브랜드는 있으나 프로젝트 없음 → 해당 브랜드에 `프로젝트 만들기`
- 프로젝트는 있으나 업무 없음 → `첫 업무 추가`
- 모든 업무 완료 → 완료 사실과 다음 프로젝트 이동
- 보관된 프로젝트 → 읽기 전용 표시
- 집계/저장 오류 → 무엇이 실패했는지와 `다시 시도`

상태 색상만 사용하지 않고 반드시 텍스트 라벨을 병기한다. motion은 펼침
맥락 보존에 필요한 opacity/transform만 사용하고
`prefers-reduced-motion`에서는 즉시 완료한다.

## 6. 테스트 가능한 수용 기준

1. 320, 375, 390, 430px viewport에서 Home과 Project 모두
   `document.documentElement.scrollWidth ===
   document.documentElement.clientWidth`다.
2. 모바일 Home 첫 콘텐츠 영역에 개인 업무 목록보다 먼저 활성 브랜드 수,
   프로젝트 수, 미완료 업무 수와 프로젝트별 요약이 표시된다.
3. 프로젝트 요약에는 프로젝트명, 완료 `n/전체 n`, 1건 이상인 활성 상태,
   존재할 경우 다음 마일스톤 또는 목표 종료일이 보인다.
4. 프로젝트를 펼치면 workstream 순서대로 Vertical Flow Spine이 나타나며
   각 단계에 상태 건수와 대표 업무가 표시된다.
5. 모든 프로젝트 펼침/접기, 필터, 추가 작업의 hit area는 최소 48×48px이며
   키보드 focus가 보인다.
6. Home과 Project의 첫 SSR markup과 hydration 후 기본 뷰가 같고,
   mount 후 보드/탭 전환이 없다.
7. 모바일 기본 뷰에 최소 폭 1040px인 데스크톱 보드가 가시적으로 나타나지
   않고, WorkflowCanvas를 조작하기 위한 수평 스크롤이 없다.
8. 모바일 Project의 상태 수치를 선택하면 해당 상태로 Flow Spine이
   필터링되고 데스크톱 캔버스를 열지 않는다.
9. 320px 폭의 긴 한글 브랜드명·프로젝트명·업무명과 3단계 하위 업무가
   가로 overflow를 만들지 않으며 제목은 최소 2줄까지 읽을 수 있다.
10. 200% 텍스트 확대에서 핵심 제목·수치·상태 라벨이 겹치거나 잘리지 않는다.
11. status는 색과 한국어 라벨/건수를 함께 제공하고 본문 및 상태 텍스트는
    WCAG 2.2 AA 대비를 만족한다.
12. 프로젝트 disclosure는 screen reader에서 이름, 펼침 상태, 연결된
    콘텐츠를 전달한다.
13. `prefers-reduced-motion: reduce`에서 disclosure와 필터 전환 후 콘텐츠가
    숨은 opacity 상태로 남지 않는다.
14. 브랜드 없음, 프로젝트 없음, 업무 없음, 모두 완료, 보관됨 상태가
    구분되고 각 상태의 주 행동은 하나다.
15. Home과 Project에서 표시하는 동일 프로젝트의 집계 수치가 일치한다.
16. `/my-work`, `/team`, `/inbox`, `/search`와 데스크톱 Home/Project의
    기능·다크 모드·기존 디자인 토큰이 회귀하지 않는다.
17. `npm run typecheck`, `npm test`, `npm run build`가 모두 통과한다.

## 7. 검증 계획

### 단위 테스트

신규 `app/src/lib/__tests__/workflow-summary.test.ts`:

- 취소/완료/하위 업무/마일스톤 포함 규칙
- 브랜드·프로젝트·workstream 순서
- 미지정 workstream/담당자/마감일
- 다음 milestone/target date 선택
- 모두 완료·업무 없음·보관됨

### 컴포넌트 테스트

현재 컴포넌트 DOM 테스트 기반이 없다면 Vitest + jsdom/Testing Library
도입 비용을 확인한 뒤 최소 범위로 추가한다.

- project disclosure의 `aria-expanded`
- 상태 필터 선택과 visible task 집합
- empty/complete/archive 상태 카피와 단일 행동
- 긴 제목 DOM 순서와 필수 라벨

### 브라우저/E2E 검증

Playwright 또는 현재 제공되는 브라우저 자동화로 다음 matrix를 검증한다.

- viewport: 320×568, 375×667, 390×844, 430×932, 768 이상
- theme: light/dark
- preference: reduced motion, increased contrast
- Home: 기본 → 프로젝트 펼침 → 대표 업무 상세 → 닫기
- Project: 기본 → 상태 필터 → 업무 상세 → 하위 업무 disclosure
- SSR/hydration console warning과 초기 layout shift 확인
- 수평 overflow와 200% text zoom 확인

### 회귀 검증

`app` 디렉터리에서:

```bash
npm run typecheck
npm test
npm run build
```

명령 정의: `app/package.json:5-17`.

## 8. 위험과 완화

| 위험 | 완화 |
|---|---|
| 모바일/데스크톱 DOM을 모두 렌더해 비용 증가 | 집계를 순수 selector로 공유하고, 무거운 Canvas 내부는 desktop breakpoint에서 lazy boundary 적용 가능성을 검증한다. 초기 모바일 성능 프로파일로 확정한다. |
| Home과 Project 집계 불일치 | 공통 `workflow-summary.ts`와 fixture 기반 계약 테스트를 사용한다. |
| 모든 프로젝트를 펼쳐 정보 과밀 | 기본 collapsed, 한 번에 한 프로젝트, 대표 업무 수 제한, “더 보기” 제공 |
| 카드 중첩으로 작은 화면이 답답해짐 | 브랜드=section, 프로젝트=한 표면, 단계=divider 행 원칙을 컴포넌트 구조에 고정 |
| 상태 칩이 제목을 압박 | 0건 상태 숨김, 메타데이터 다음 줄 배치, 제목 2줄 우선 |
| CSS로 숨긴 desktop canvas의 모바일 DOM 비용 | 실제 device 성능과 React profiling 후 dynamic import/client boundary를 적용하되 hydration 안정성을 깨는 viewport JS는 사용하지 않음 |
| safe area 변경이 다른 route에 영향 | 앱 shell의 additive padding과 Home/Project 전용 class를 분리하고 route 회귀 확인 |
| 새 모바일 UI가 기존 calm 방향과 분리돼 보임 | 기존 시맨틱 토큰·radius·motion만 사용하고 Flow Spine 한 곳에만 시각적 개성을 집중 |

## 9. 구현 완료 순서

1. 공통 집계 selector와 단위 테스트
2. 모바일 공유 컴포넌트와 상태 계약
3. Home의 초기 렌더 안정화와 overview 우선 배치
4. Project의 모바일 기본 Flow Spine과 상태 필터 연결
5. safe area·긴 텍스트·터치 영역·접근성 보완
6. empty/error/archive 상태
7. viewport/theme/preference matrix 검증
8. typecheck/test/build와 범위 밖 route 회귀 확인

각 단계는 테스트가 통과한 뒤 다음 단계로 진행한다. 구현은 이 계획에 대한
명시적 승인 전에는 시작하지 않는다.
