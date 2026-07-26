# Canvas-first 수정 계획 — 재정렬 실행안

기준선: `main` / `0127d00` (프로덕션 배포 완료, D1 0004까지 적용)
원본: `CANVAS_FIRST_REVISION_PLAN.md` v1.0
작성: 2026-07-26

원본 계획서의 **범위와 방향은 그대로 채택**한다. 이 문서는 순서와 일부
필수 조건만 조정한다. 조정 근거는 각 항목에 명시한다.

---

## 0. 원본 대비 변경 요약

| 항목 | 원본 | 이 문서 | 근거 |
|---|---|---|---|
| 인증 복구 | Gate C (WP7) | **S0으로 이동** | 공개 URL + 무인증이 현재 라이브 |
| Waiting 필수 필드 | 4개 전부 | **2개 필수 + 2개 선택** | "zero usage hurdles" 원칙, 멤버 1명 |
| WP1 | 공간회수 + 라우트통합 묶음 | **분리** (S1 / S6) | 비용 10배 차이, 회귀 위험 |
| 팀 관점·인계 | Gate B 필수 | **S6으로 이동** | 멤버 1명 환경에서 검증 불가 |
| WP4/WP5 마이그레이션 | "확인 후 결정" | **불필요 (확인 완료)** | 0002가 프로덕션에 적용됨 |

원본의 Gate A/B/C 판정 질문과 §16 검수 시나리오, §18 Pilot 차단 조건은
그대로 유지한다.

---

## S0 — 거짓 정보 제거 + 인증 복구 (MVP 차단, 최우선)

두 가지 모두 "지금 프로덕션에 나가 있는 잘못된 것"이고, 둘 다 코드 추가가
아니라 제거/복원이라 비용이 낮다.

### S0-1. 의미 정확성 (원본 WP0)

제거 대상 — 전부 검증된 실제 코드:

| 대상 | 위치 | 문제 |
|---|---|---|
| 임의 진척률 | `WorkflowCanvas.tsx:56` | `{ToDo:0.06, InProgress:0.55, Review:0.85}` 근거 없음 |
| 역산된 실질 상태 | `WorkflowCanvas.tsx:88` | 위 가짜 값으로 부모 상태를 바꿔 표시 |
| 자동 flow line | `WorkflowCanvas.tsx:392` | 상태별 첫 카드끼리 실선 연결, 관계 없음 |
| Project 완료율 bar | `ProjectPulse.tsx` | 작업량으로 오해 |

대체 표현 (원본 §10 준수):
- 상태별 개수, `완료 2/6` 형태의 분자/분모 명시 count
- 하위 업무는 이미 `1/3` 사실 기반 — 유지
- parent tether(dashed)는 실제 관계이므로 유지

완료 기준: 저장된 `task_dependency` 없이 그려지는 실선이 0개.
UI와 파생 로직에 임의 percentage 없음. 기존 195 테스트 통과.

### S0-2. 인증 복구 (원본 WP7 중 auth 부분만)

현황: `queries.ts:54` `getCurrentMember`가 세션 없으면 admin으로 자동 진입.
공개 URL이므로 URL을 아는 누구나 읽기/쓰기 가능.

**선행 조건 (사용자 직접 수행):** 프로덕션 `auth_account` 행 생성.
비밀번호는 사용자가 직접 설정한다. 이 단계 없이 bypass를 제거하면 본인이
잠긴다.

작업: auto-enter 제거 → middleware 실제 세션 검증 → workspace 간 접근 차단.

완료 기준: 미로그인 사용자가 업무 데이터에 접근 불가. 동률 계정 정상 로그인.

---

## S1 — 캔버스 중심 확보 (싼 부분만, 원본 WP1 분할)

원본 §4.2의 공간 기준 중 **라우트 변경 없이 가능한 것만** 수행한다.

- 전역 nav 56px → 44~48px
- Home 제목·설명·`업무 흐름` 중복 title 제거
- Canvas container `max-w-5xl` 제거
- Canvas 높이 `72vh` → `100dvh` - topbar
- toolbar를 Canvas 내부 chrome으로

**하지 않는 것:** `/inbox` `/projects` `/team` 삭제, redirect, 통합 쿼리
→ S6으로 이월.

완료 기준: Desktop 첫 화면의 85% 이상이 Canvas. 기존 라우트 전부 정상 동작.

---

## S2 — Waiting (핵심 워크플로 루프, 원본 WP4)

제품이 칸반과 구별되는 지점. 마케팅 실무에서 "본사 회신 대기 / 에이전시
견적 대기"가 업무의 절반이다.

**검증 완료:** `waiting_type`, `waiting_on_text`, `waiting_party_text`,
`waiting_owner_member_id`, `follow_up_at`, `blocked_*` 필드가 migration
0002에 있고 **프로덕션에 적용되어 있다.** 서비스/액션/UI/derive 어디에도
연결되지 않았을 뿐이다 (grep 결과 0건). **마이그레이션 불필요.**

### 필수 필드 조정 (원본 §9.1 대비)

| 필드 | 원본 | 이 문서 |
|---|---|---|
| 대기 상대·대기처 | 필수 | **필수** |
| 다음 확인 시각 | 필수 | **필수** |
| 대기 사유 | 필수 | 선택 |
| Follow-up 담당자 | 필수 | 선택 (기본값: 현재 사용자) |
| Blocked 사유 | 선택 | 선택 |

근거: 필수 2개만으로 원본 §9.1의 목적(follow_up_at 도래 시 담당자에게
회귀)이 완전히 달성된다. 멤버 1명 환경에서 Follow-up 담당자 입력은 항상
자기 자신이라 순수한 마찰이다. 멤버가 늘면 필수로 승격 검토.

작업: `TaskPatch`에 waiting 필드 → transition validation → `follow_up_at`
기반 `확인 필요` derive → Home 카드 한 줄 표시 → 내 업무 노출 →
해제 시 activity history 보존.

완료 기준: 원본 §16 시나리오 7, 8 통과.

---

## S3 — 생성 문법 + Canvas 인라인 편집 (원본 WP2 + WP3 일부)

**이 단계가 필요한 직접적 근거:** 2026-07-26 사용자가 프로덕션에서
"하이어라키가 전혀 안 보인다"고 지적. 원인 조사 결과 기능은 정상 작동했고,
`importance='key'` 0건 / `kind='milestone'` 0건 — **아무도 해당 기능을 켤
방법을 찾지 못한 것**이었다. 기능 부재가 아니라 발견가능성 문제.

- 전역 `업무 추가` → `+ 추가` 메뉴 (빠른 기록 / 프로젝트 / 마일스톤)
- 위치별 생성 label (원본 §5.2 표 그대로)
- Project·Workstream inline rename
- 카드 제목 inline edit
- 우측 Inspector
- `상위 업무 변경` command (drag nesting은 원본 §6.3 조건 충족 후)

완료 기준: 원본 §16 시나리오 1~6 통과.

---

## S4 — Zoom LOD + 모바일 아웃라인 (원본 WP3 LOD + WP6 구조)

기존 HANDOFF의 P4·P5와 동일. 원본 §8 단계 기준, §12 outline 구조 채택.

완료 기준: 원본 §16 시나리오 12, 13, 14 통과.

---

## S5 — 실제 Dependency (원본 WP5)

**마이그레이션 불필요** — `task_dependency` 테이블은 0002에 있고 프로덕션에
적용됨 (self-reference CHECK, unique pair index 포함).

dependency CRUD → workspace·self·cycle validation → 실제 edge 렌더링 →
Ready·successor 노출.

S0에서 가짜 flow line을 이미 제거했으므로, 여기서 그리는 선은 전부 저장된
관계다.

완료 기준: 원본 §16 시나리오 9, 10, 11 통과.

---

## S6 — 라우트 통합 + 팀 관점 (원본 WP1 나머지 + WP6 팀)

- `/inbox` `/projects` `/team` → Home query 통합 + redirect (원본 §3.2)
- 담당자 관점 그룹, 인계 신호, reviewer 노출

**후순위 근거:** 라우트 통합은 회귀 위험이 크고 사용자 가치는 간접적이다.
팀 관점은 워크스페이스 멤버가 1명인 현재 검증 자체가 불가능하다. 멤버가
2명 이상 되는 시점에 착수한다.

---

## Gate 재매핑

| Gate | 원본 | 이 문서 |
|---|---|---|
| A. 통합 편집 Workspace | WP0,1,2,3부분 | **S0, S1, S3** |
| B. Workflow Loop | WP4,5,6부분 | **S2, S5** |
| C. Pilot Ready | WP6모바일, WP7 | **S4, S6** (인증은 S0에서 선행 완료) |

원본 Gate 판정 질문과 §18 Pilot 차단 조건은 변경 없이 적용한다.

---

## 즉시 실행 후보

S0-1(거짓 정보 제거)은 의존성이 없고, 코드 삭제 위주이며, 기존 테스트로
검증 가능하다. 승인 시 바로 착수 가능.

S0-2(인증)는 사용자가 `auth_account`를 먼저 생성해야 하므로 그 이후.
