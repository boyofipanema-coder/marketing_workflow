# Designer review — round 1

**Date:** 2026-07-27T20:00:18+09:00  
**Design spec read:** 2026-07-27T20:00:18+09:00  
**Artifact:** `app/src/components/workflow/StackedWorkflowBoard.tsx`  
**DESIGN.md:** `app/DESIGN_SYSTEM.md` (프로젝트의 동등 기준 문서. 루트 `DESIGN.md`는 없음)  
**Viewport:** both  
**Visual evidence:** `/var/folders/5p/dvprm8b11zs6p3y9_wvplks80000gn/T/codex-clipboard-da591716-945f-4714-b176-bb5318b4a866.png`

## Summary

- BLOCK: 4
- WARN: 7
- FYI: 2

가장 먼저 고칠 데스크톱 시각 문제는 프로젝트 dot과 첫 텍스트 행의 수직 정렬이다. 현재 dot, 여러 줄이 가능한 제목, 숫자, 추가 버튼이 모두 하나의 `items-start` 행에 있으나 각 요소의 높이와 line-height가 다르다. 따라서 첫 줄의 광학 중심이 맞지 않는다.

## Issues

### [WARN] 프로젝트 dot이 제목 첫 줄의 광학 중심보다 위에 놓임
- **Location:** `app/src/components/workflow/StackedWorkflowBoard.tsx:447-480`
- **Rule:** § Spacing / layout — 한 행의 아이콘·텍스트 정렬 일관성
- **Evidence:** 컨테이너는 `items-start`, dot은 `size-2`, 제목은 `leading-5`다. 동일한 top에서 시작하므로 dot 중심은 4px, 텍스트 첫 줄 중심은 10px 지점이 된다.
- **Fix suggestion:** 제목 영역과 우측 제어 영역을 분리한다. dot에 `mt-1.5`, 제목에 `text-base leading-5`, 숫자·추가 버튼을 별도 `flex items-center` 행으로 두어 첫 줄 기준을 고정한다.

### [BLOCK] 아이콘 추가 버튼의 hit target이 디자인 시스템 최소값보다 작음
- **Location:** `app/src/components/workflow/StackedWorkflowBoard.tsx:104-112, 174-181, 475-482`
- **Rule:** DESIGN_SYSTEM § Accessibility — hit target ≥32px; mobile audit — 44px 권장
- **Evidence:** 프로젝트 추가 버튼은 `size-6`(24px), 주요·하위업무 추가 버튼은 `size-7`(28px)다.
- **Fix suggestion:** 데스크톱 밀도는 유지하되 모두 최소 `size-8`로 통일한다. 모바일 대응 시 `size-11` 또는 투명 padding으로 44px target을 제공한다.

### [BLOCK] 모바일에서 1040px 고정 캔버스가 가로 스크롤을 강제함
- **Location:** `app/src/components/workflow/StackedWorkflowBoard.tsx:377-385`
- **Rule:** § Mobile responsiveness — horizontal scroll
- **Evidence:** `overflow-x-auto` 내부에 `min-w-[1040px]`가 있어 작은 viewport에서 전체 업무를 선형 탐색해야 한다.
- **Fix suggestion:** 모바일 지원이 범위라면 브랜드→프로젝트→업무 accordion 목록으로 전환한다. 데스크톱 전용 제품이라면 지원 viewport를 DESIGN_SYSTEM에 명시하고 이번 BLOCK을 범위 밖으로 닫는다.

### [BLOCK] 한 viewport에서 saturated brand color 사용 횟수가 4회를 넘음
- **Location:** `app/src/components/workflow/StackedWorkflowBoard.tsx:140-154, 184-187, 400-456, 459-462`
- **Rule:** § Color budget — viewport당 saturated brand element 최대 2, 4회 초과 BLOCK
- **Evidence:** 브랜드 rail, header dash, 프로젝트 border/dot/connector, 주요업무 border/bar/connector, 하위업무 border에 같은 색이 반복된다.
- **Fix suggestion:** 브랜드색은 좌측 rail과 프로젝트 dot 두 신호에 집중한다. connector와 중첩 border는 `border-separator`/`border-border`로 중립화한다.

### [BLOCK] 직접 구현한 버튼들의 press/active 상태가 일관되지 않음
- **Location:** `app/src/components/workflow/StackedWorkflowBoard.tsx:96-112, 157-181, 281-318, 421-428, 464-482`
- **Rule:** DESIGN_SYSTEM § Motion / Components; § Component states — active state required
- **Evidence:** 일부 제목 버튼만 `active:scale`을 사용하고 필터, 프로젝트 제목, 추가 버튼은 hover만 있다. 동일한 `+` 동작도 깊이에 따라 피드백이 다르다.
- **Fix suggestion:** 가능한 제어는 `<Button size="icon">` primitive로 교체한다. 텍스트 버튼에는 공통 `.press` 또는 동일한 `active:scale-[0.97] duration-fast ease-out`을 적용한다.

### [WARN] 핵심 식별 텍스트가 metadata 크기에 가까움
- **Location:** `app/src/components/workflow/StackedWorkflowBoard.tsx:99-103, 161-170, 386-390, 468-474`
- **Rule:** DESIGN_SYSTEM § Typography; mobile audit — 14px 미만 텍스트
- **Evidence:** 프로젝트·주요업무는 `text-sm`(13px), 하위업무·담당자·열 제목은 `text-xs`(12px)다. 프로젝트와 업무명이 데이터의 핵심인데 보조 텍스트와 계층 차이가 작다.
- **Fix suggestion:** 프로젝트와 주요업무 제목은 `text-base`(15px), 하위업무는 `text-sm`(13px), 담당자·개수만 `text-xs`로 제한한다.

### [WARN] header와 본문이 서로 다른 nested grid 기준을 사용함
- **Location:** `app/src/components/workflow/StackedWorkflowBoard.tsx:385-400, 431-447`
- **Rule:** § Spacing / layout — column alignment consistency
- **Evidence:** header는 하나의 4열 grid지만 본문은 2열 brand grid 안에 `p-3`, 다시 2열 project grid, 다시 2열 task grid를 중첩한다. 열 시작점에 padding과 gap 오차가 누적된다.
- **Fix suggestion:** 열 폭을 한 상수/semantic layout token에서 파생한다. 최소한 header의 padding을 본문 `p-3` 기준으로 보정하고, 장기적으로 CSS grid/subgrid로 header와 content track을 공유한다.

### [WARN] 중첩된 세 단계 박스가 모두 border와 shadow를 가져 계층이 평평해짐
- **Location:** `app/src/components/workflow/StackedWorkflowBoard.tsx:140, 184, 400, 447`
- **Rule:** DESIGN_SYSTEM § Elevation — content is the interface, chrome recedes
- **Evidence:** 브랜드, 프로젝트, 주요업무, 하위업무 표면에 border가 있고 세 내부 표면에도 `shadow-xs`가 있다. 실제 중요도보다 박스 경계가 먼저 보인다.
- **Fix suggestion:** shadow는 브랜드 outer panel 또는 주요업무 interactive card 한 단계에만 남긴다. 하위업무 그룹은 neutral border만 사용하고 프로젝트는 border + flat surface로 둔다.

### [WARN] 토큰 밖 arbitrary radius와 10px indentation을 사용함
- **Location:** `app/src/components/workflow/StackedWorkflowBoard.tsx:89-93, 459-462`
- **Rule:** DESIGN_SYSTEM § One rule / § Spacing / Radius
- **Evidence:** `rounded-[3px]`, depth당 `10px`, `w-[calc(...)]`는 정해진 radius/8pt spacing token에서 벗어난다.
- **Fix suggestion:** 프로젝트 표식은 `rounded-full` 또는 `rounded-sm`; depth indentation은 8px(`depth * 8`) 단위로 맞춘다.

### [WARN] 제목 말줄임 정책이 계층마다 다르고 주요업무 폭 축소와 충돌함
- **Location:** `app/src/components/workflow/StackedWorkflowBoard.tsx:99-103, 157-164, 464-471`
- **Rule:** § Typography / content visibility
- **Evidence:** 프로젝트는 여러 줄 허용, 주요업무와 하위업무는 `truncate`다. 주요업무 열을 줄인 뒤 긴 제목은 상세 패널을 열기 전까지 식별이 어렵다.
- **Fix suggestion:** 주요업무는 최대 2줄 `line-clamp-2`와 일정한 min-height를 사용하고, 하위업무만 1줄 truncate를 유지한다.

### [WARN] 재귀 하위업무의 depth가 작은 들여쓰기 하나로만 표현됨
- **Location:** `app/src/components/workflow/StackedWorkflowBoard.tsx:47-55, 89-95`
- **Rule:** frontend-design — structure is information
- **Evidence:** 모든 descendant를 평탄화한 뒤 depth당 10px만 이동한다. 2단계 이상에서 부모-자식 관계를 빠르게 읽기 어렵다.
- **Fix suggestion:** 2단계 이상에는 짧은 branch rule 또는 depth marker를 추가하고, hover/focus 시 직계 부모 제목을 tooltip에 포함한다.

### [FYI] 프로젝트 박스의 큰 빈 면은 최근 요구를 정확히 반영하지만 정보 밀도는 낮음
- **Location:** `app/src/components/workflow/StackedWorkflowBoard.tsx:442-483`
- **Rule:** frontend-design — structure must encode true grouping
- **Evidence:** `items-stretch`로 프로젝트 박스가 모든 주요업무 높이를 감싼다. 그룹 의미는 명확하지만 제목/제어는 상단에만 있어 긴 프로젝트에서 빈 면이 커진다.
- **Fix suggestion:** 현 구조를 유지하되 프로젝트 제어 행은 sticky가 아니라 상단 고정, 하단에는 `업무 추가` 같은 실제 동작만 배치하는 옵션을 검토한다.

### [FYI] 기준 문서 이름이 reviewer 계약과 다름
- **Location:** `app/DESIGN_SYSTEM.md:1`
- **Rule:** omd:designer-review § Required input
- **Evidence:** 프로젝트 기준 문서는 존재하지만 파일명이 `DESIGN.md`가 아니라 `DESIGN_SYSTEM.md`다.
- **Fix suggestion:** OMD 자동화 호환이 필요하면 루트 `DESIGN.md`에서 이 문서를 링크하거나 canonical 이름을 통일한다.

## Recommended revision

### Pass 1 — optical precision

1. 프로젝트 title row를 `dot + title`과 `count + add` 두 그룹으로 나누고 첫 line center를 맞춘다.
2. 모든 icon-only add control을 32px로 통일한다.
3. 프로젝트·주요업무를 15px, 하위업무를 13px로 올린다.
4. arbitrary 3px radius와 10px depth spacing을 토큰으로 교체한다.

### Pass 2 — hierarchy cleanup

1. 브랜드색은 rail + project dot에만 남긴다.
2. 중첩 shadow를 제거하고 하위업무 그룹은 neutral border로 정리한다.
3. header/content column track을 공유해 열 시작점을 일치시킨다.
4. 주요업무 제목은 2줄까지 허용한다.

### Pass 3 — product scope

1. 모바일 지원 여부를 결정한다.
2. 지원한다면 workflow canvas 대신 accordion/list fallback을 제공한다.
3. 2-depth 이상 하위업무의 branch 표현과 parent context를 보강한다.

## Verdict

**BLOCK** — desktop visual polish 자체는 작은 revision으로 해결 가능하지만, 현재 audit contract의 hit target·mobile horizontal scroll·color budget·component state hard rule을 충족하지 못한다.
