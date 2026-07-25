# 한국어 전환 계획 — 바꿔야 할 언어 체계

> 대상: `app/` (마케팅팀 워크플로우 Next.js 앱)
> 현재 상태: UI는 대부분 영어, 시드 데이터에만 한국 이름 혼재. `html lang="ko"`는 이미 설정됨.
> 목적: 어시스턴트와 논의해 결정할 사항을 층별로 정리.

---

## 바꿔야 할 언어 체계 8층

### 1. 상태·플래그 어휘 체계 ⭐ (최우선 — 단일 원천)
- **위치**: `app/src/lib/status.ts`
- **설명**: 전 앱의 상태 명칭·툴팁의 유일한 출처. TaskCard, 배지, 필터, 상세패널이 모두 여기서 읽음. 여기만 바꾸면 6개 상태 + Cancelled + 4개 플래그가 한 번에 한글화됨.
  - 상태: Inbox / To Do / In Progress / Waiting / Review / Done
  - 종료: Cancelled
  - 플래그: Blocked / Overdue / Follow up / Ready
- **논의점**: 완전 번역(대기중/진행중/검토) vs 굳은 외래어("리뷰", "인박스") 허용 범위. 팀 문화 문제라 어시스턴트 의견 특히 필요.

### 2. UI 마이크로카피 (버튼·네비·라벨·placeholder·빈 상태)
- **위치**: `NavBar.tsx`, `QuickAdd.tsx`, `EmptyState.tsx`, 각 페이지(`home`, `my-work`, `projects`, `team`, `login`) 등
- **설명**: "Quick Add", "No lead assigned" 등 흩어진 문구. 양은 많지만 난이도 낮음.
- **논의점**: 존댓말/반말 톤, 문장형("추가하기") vs 명사형("추가") 통일 규칙.

### 3. 유효성 검증 / 에러 메시지
- **위치**: `app/src/lib/validate.ts`, `app/src/server/services/errors.ts`
- **설명**: "Must not be empty", "Start date must be on or before end date" 등.
- **논의점**: 사용자용 메시지(한글화 대상) vs 개발자용 내부 에러명(`ValidationError` 등, 코드라 유지) 구분.

### 4. 날짜·시간·숫자 로케일
- **위치**: `TaskCard.tsx:77`, `TaskDetailPanel.tsx:44`, `ProjectWorkspace.tsx:66`, `derive.ts`
- **설명**: `toLocaleDateString("en-US")` → `ko-KR`. "Jul 25" → "7월 25일".
- **논의점**: 날짜 형식(2026. 7. 25. vs 7월 25일), 요일 표기 여부.

### 5. 상대시간·자연어 표현
- **위치**: `app/src/lib/derive.ts`
- **설명**: "3 days ago", "Due today", "Overdue" 등 계산된 표현. 단순 치환이 아니라 한국어 어순(예: "3일 전", "오늘 마감", "기한 초과")으로 로직 손질 필요.

### 6. 시드/데모 데이터 (콘텐츠)
- **위치**: `app/src/server/db/seed.ts`, `app/src/lib/mock/seed-projects.ts` (합 ~1,400줄)
- **설명**: 사람 이름은 이미 한국식이나 프로젝트명·태스크 제목·설명은 영어("AURALEE Marketing" 등). 데모/스크린샷 인상을 좌우.
- **논의점**: 가상 마케팅 프로젝트 시나리오를 한국 실무 톤으로 새로 쓸지. 업무 스타일 아는 어시스턴트가 가장 값어치 있게 기여할 부분.

### 7. 앱 메타데이터 / 제품명
- **위치**: `app/src/app/layout.tsx:5` — `title: "Marketing Team Workflow"`, description
- **설명**: 브라우저 탭 제목, 제품명.
- **논의점**: 제품명 번역 vs 영문 유지.

### 8. 문서 / 기획서 (앱 밖)
- **위치**: `CLAUDE.md`, `BUILD_PLAN.md`, `marketing-team-workflow-prd-v0.3 (1).md`
- **설명**: 사용자에게 안 보이는 개발/기획 문서.
- **논의점**: 한글화 포함 여부(보통 UI만 하고 문서는 유지).

---

## 논의 시 정해야 할 핵심 결정 3가지

1. **톤**: 존댓말 vs 반말/간결체, 명사형 vs 문장형 통일
2. **외래어 정책**: 완전 번역("Review→검토") vs 굳은 외래어("리뷰") 허용 범위 — 특히 1번 상태 어휘
3. **범위**: UI만(1~7) vs 시드 콘텐츠(6) 새로 쓰기 vs 문서(8)까지

---

## 안 바꾸는 것 (참고)

- 코드 식별자: `ValidationError`, `InProgress` 등 enum 값·변수명·DB 컬럼
- CSS 토큰 이름
- → 화면에 보이는 `label` / `hint` / 메시지만 변경

---

## 작업 순서 (결정 후)

1. 상태 어휘(`status.ts`) → 2. UI 마이크로카피 → 3. 검증/에러 → 4. 로케일 → 5. 상대시간 → 6. 시드 데이터 → 7. 메타데이터 → (선택) 8. 문서
