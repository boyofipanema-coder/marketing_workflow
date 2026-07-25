# Marketing Team Workflow — Cloudflare 배포용 빌드 & 구현 계획 v1.1

> 기준 문서: `marketing-team-workflow-prd-v0.3 (1).md`
> 개정: `feedback_v1` 반영 (로그인 확정 · 설비 지연 도입 · 동시수정 · Calendar 사전검증 · M8 분리 · 비용/AI 표현 수정 · P1~P3 로드맵)
> 원칙: **Task와 Workflow가 먼저 실제로 작동한 뒤, 필요한 기능을 올바른 순서로 붙인다.**
> 설비 원칙(신규): **기술 설비는 제품 기능이 실제로 요구할 때 도입한다. 미리 깔지 않는다.**

---

## 1. PRD 권장 스택 → Cloudflare 스택 매핑

| PRD 권장 | Cloudflare 채택 | 도입 시점 | 사유 |
|---|---|---|---|
| Next.js + TS | **Next.js(App Router) + `@opennextjs/cloudflare`** | M0 | Workers에서 공식 지원 경로 |
| PostgreSQL | **Cloudflare D1 (SQLite)** | M0 | 2~6명 팀 규모에 충분(무료 500MB/유료 10GB). 다중팀(P3)에서 Hyperdrive+Postgres 이관 |
| Prisma/Drizzle | **Drizzle ORM** | M0 | D1 1급 지원, 경량 마이그레이션 |
| Authentication | **Better Auth + Drizzle + D1** | M2 | 아래 2절 확정. 세션도 **D1에 저장**(KV 아님) |
| Background Jobs | **Cron Triggers + Queues** | **M6/M7에서만** | 지연 도입. P0 대부분은 화면 열 때 계산으로 충분 |
| AI Adapter | **서버사이드 Adapter (외부 LLM 또는 Workers AI)** | M6 | AI는 Entity가 아닌 `AISuggestion`만 생성 |
| 세션/캐시 | ~~KV~~ → **D1** | M2 | KV는 최대 60초+ 전파 지연 → 로그아웃/권한변경 즉시반영에 부적합 |

### 확정 스택 요약 (v1.1)
- **런타임**: Cloudflare Workers (OpenNext) — Next.js 서버기능 포함이므로 **Workers Paid($5/월) 권장**(무료는 CPU 10ms·앱 3MB 제한)
- **DB / 세션**: D1 + Drizzle (세션도 D1)
- **Auth**: **Better Auth + Drizzle + D1, 관리자 생성 계정 방식, 공개 회원가입 없음** (매직링크·외부 이메일 서비스 불필요)
- **Jobs**: Cron/Queues는 **M6(AI 비동기), M7(Calendar) 시점에만** 도입
- **AI**: Adapter 인터페이스 + 모킹 선구현, 실제 연동은 정책 확인 후
- **UI**: Tailwind + 접근성 컴포넌트(Radix), 차분한 에디토리얼 톤(PRD 21.4)

> ⚠️ **표현 정정(feedback #7)**: Workers AI도 Cloudflare라는 **외부 사업자**의 AI 서비스다. 회사 정보가 외부 클라우드로 전송되는 점은 외부 LLM과 동일하므로, "자체 인프라"로 취급하지 않는다. 외부 LLM이 금지되면 Workers AI가 자동 허용되는 것은 아니다.

---

## 2. 로그인 확정 (feedback #1)

- **Better Auth + Drizzle + D1**
- **관리자 생성/초대 계정 방식, 공개 회원가입 없음** — 초기 2~6명 파일럿에 가장 단순
- 앱 로그인과 **Google Calendar OAuth는 완전히 분리**(PRD 20.1). Calendar 토큰은 별도 저장·암호화
- 매직링크·이메일 발송 서비스는 초기에 도입하지 않음(회사 외부 이메일 정책 리스크 회피)

---

## 3. 리포지토리 구조

```
todo-workflow/
├─ src/
│  ├─ app/
│  │  ├─ (auth)/            # 로그인/온보딩
│  │  ├─ (app)/home/ my-work/ projects/[projectId]/ team/ calendar/
│  │  └─ api/               # route handlers / server actions
│  ├─ components/           # TaskCard, RightPanel, FlowStrip, QuickAdd …
│  ├─ server/
│  │  ├─ db/                # Drizzle schema, migrations, queries
│  │  ├─ auth/              # Better Auth (세션 D1)
│  │  ├─ services/          # task/workflow/waiting/nextaction/team/calendar
│  │  ├─ ai/                # Adapter (parse/decompose/next-action) + mock
│  │  └─ jobs/              # (M6/M7에서 추가) cron/queue 핸들러
│  └─ lib/                  # 상태 계산(Do Now/Waiting/Coming Next), Attention 계산
├─ drizzle/                 # 마이그레이션
├─ wrangler.toml            # M0: d1 만. KV/Queues/Cron은 필요 시점에 추가
└─ open-next.config.ts
```

**wrangler 바인딩 도입 순서**: M0=`d1_databases`만 → M6=Queue(AI_JOBS) → M7=Queue/Cron(Calendar 동기화·외부 알림).

---

## 4. 데이터 모델 (P0, Drizzle)

PRD 13절 반영. P0 엔티티만 생성, P1/P2 테이블 선제작 금지(연결 여지는 유지).

- **Workspace / Member(role: admin|member) / Project / Workstream**
- **Task**: PRD 13.2 전체 필드. `project_id`는 status=Inbox일 때만 null. **`updated_at` + `version`(정수) 필드로 동시수정 감지**(feedback #3)
- **TaskDependency**: finish_to_start. 자기참조/순환/타 워크스페이스 차단, 타 프로젝트 경고
- **Milestone**: id, project_id, name, due_date (P0 최소형 — **M2에서 최소 생성·수정 포함**, feedback 누락항목)
- **AISuggestion**: payload_json, reason, confidence?, status(Pending/Accepted/EditedAndAccepted/Deferred/Dismissed)
- **CalendarConnection / CalendarEventLink**: 암호화 토큰, Entity↔Google Event 매핑
- **ActivityLog**: 상태/담당자/마감/의존관계 등 핵심 변경 기록
- **Session**: Better Auth 세션(D1)

상태 enum(6): `Inbox, ToDo, InProgress, Waiting, Review, Done` + Cancelled(종료 액션). Backlog/Ready/Blocked/Overdue/NeedsFollowup은 **화면 열 때 계산되는 필터·플래그**.

---

## 5. 동시 수정 처리 (feedback #3, P0 필수 · 실시간 아님)

- 저장 시 클라이언트가 보유한 `version`과 서버 값 비교 → 불일치면 저장 거부 + **"다른 팀원이 먼저 수정했습니다"** 안내(현재 값 다시 로드)
- 화면 재진입·브라우저 탭 복귀 시 자동 갱신(refetch)
- 필요 시 목록 화면 20~30초 주기 폴링
- WebSocket 등 실시간 기술은 P0에서 도입하지 않음

---

## 6. 구현 순서 (PRD 14절 게이트 = 마일스톤)

### M0 — 부트스트랩 + 사전검증 (feedback #2, #4)
- **설비 최소화**: Workers + Next.js(OpenNext) + D1 + Drizzle **만**. KV/Queues/Cron 미도입
- CI(빌드+타입체크), `wrangler dev`/`deploy` 스테이징 확인
- **Calendar/네트워크 사전 시험(개발 아님, 짧은 확인)**: 회사 PC에서 ①배포 도메인 접속 ②Google 로그인 화면 접근 ③Calendar 권한 요청 가능 여부 ④`googleapis.com` 호출 가능 여부
- **게이트**: 빈 앱 배포·헬스체크 통과 + 위 사전시험 결과 기록(막히면 M7 범위 조정 근거)

### M1 = P0-A — UX Skeleton (Mock Data) (feedback 누락항목)
- **시간 배분**: Home / Project Workflow / Task Detail Panel / Quick Add에 집중. **Team·Calendar는 자리 확인 수준**
- 5개 내비 + Quick Add + 검색 UI, Do Now/Waiting/Coming Next, Flow Strip
- Mock 3개 Project(AURALEE / Cultural Collab / Brand Strategy)
- **게이트**: 10초 내 My Focus·Waiting·Coming Next 식별, 계층 자명, 상세 패널 맥락 유지

### M2 = P0-B — Persistent Task Core
- **Better Auth(관리자 생성 계정) + 세션(D1)** + Workspace/Member
- Project/Workstream/Task CRUD, 6개 상태, Assignee/Due, **Milestone 최소 생성·수정**, Team Inbox, 검색·기본 필터
- 동시수정 감지(5절), Activity Log 최소 기록 시작
- **게이트**: 제목만으로 Task 생성, 변경 2조작 이내, 새로고침·재로그인 후 유지, 팀원 변경 반영

### M3 = P0-C — Workflow Core
- Finish-to-Start Dependency, 순환 방지, 선행조건 경고, Flow Strip, Do Now/Waiting/Coming Next 계산
- **게이트**: 선행 완료 시 후속 실행가능 전환, 차단 원인 확인, 전체 Flow Map 없이 이해

### M4 = P0-D — Waiting & Follow-up (feedback #2)
- Waiting 유형 7종, 기다리는 내용·상대·내부 Owner, Follow-up 날짜, Blocked 유형·해결행동
- **Needs Attention은 화면 열 때 계산**(Follow-up 초과 판정). **Cron 미사용** — Cron은 나중에 외부 알림 보낼 때만
- **게이트**: 모든 Waiting에 다음 확인 시점, Follow-up 초과 자동 노출, 대기 vs Blocked 구분

### M5 = P0-E — Team Visibility
- Team in Motion, 팀원별 In Progress/Due/Waiting/Review, Project별 Attention, 활성 Task·동시 Project 수, 기본 Activity Log
- **게이트**: 한 화면에서 현황 파악, 2주 집중도 확인, 성과 순위처럼 보이지 않음

### M6 = P0-F — AI Next Action (여기서 Queue 첫 도입)
- AI Adapter: Quick Add 파싱, 큰 Task 분해, Done 후 Next Action(2~4개), 중복 경고
- Suggestion Review UI, **모든 결과 승인 전 Pending**, 기존 Successor 우선
- 비동기 파싱에 **Queue 도입**, AI 장애 시 수동 Workflow 완전 동작
- **게이트**: Successor 우선, 없을 때만 후보, 승인 전 Pending, AI 장애 격리

### M7 = P0-G — Google Calendar (feedback #4)
- Google OAuth(별도 토큰, refresh token 암호화, 최소 scope)
- **P0는 경량 읽기**: 앱 열 때 오늘·이번 주 일정만 Google에서 읽기. **증분 동기화·일정 캐시·동기화 토큰·삭제일정 처리·토큰만료 전체재동기화는 P0에서 하지 않음**
- Task/Milestone 등록(사용자 승인) + Event 매핑, OAuth 미승인/정책차단/일반오류 구분
- **게이트**: 선택 Calendar 표시, 승인 없이 이벤트 미생성, 연결 해제 후 Task 보존, 정책차단 구분 안내

### M8 분리 (feedback #5)
**M8-A — Release Hardening (개발자 완료 가능)**
- 오류 처리, 성능, 모바일 기본 동작, 온보딩
- **핵심 알림 = 앱 내부 배지 + Needs Attention 표시로 한정**(이메일·브라우저 알림 후순위, feedback 누락항목)
- **백업 = D1 Time Travel 시점복구(무료 7일/유료 30일) + 정기 export 명시**(feedback 누락항목)
- **게이트**: 기술적 배포 완료, 위 항목 동작 확인

**M8-B — Two-week Pilot (실제 팀 사용으로만 검증)**
- 활성 Project 3~5개, 2주 사용, 입력부담·상태혼동·누락·AI품질·Calendar 연결 기록
- **게이트(PRD 완료 조건)**: 주 3일+ 자발 사용, 2주 후 상태 최신율 80%+, 공유 준비시간 감소, Follow-up 없는 Waiting 비율 감소

**P1 진입 결정**: M8-B 파일럿 결과를 근거로 다음 기능 개발 여부 결정

---

## 7. 횡단 규칙 (PRD 23 완료 정의)
- 요구사항 ID 연결, 정상+오류 흐름, 빈/로딩/권한오류 상태, 모바일 기본 동작, 핵심 테스트
- 팀원 변경 일관 반영, 필요한 변경 Activity Log 기록
- **AI·Calendar 장애가 핵심 Task 흐름을 절대 막지 않음**

## 8. 테스트 전략
- 단위: 상태 계산, 의존관계 검증(순환/자기참조), Follow-up 초과 판정, **version 충돌 감지**
- 통합: Task 라이프사이클, Waiting→Follow-up→Attention, Done→Successor 활성화
- E2E: Quick Add→정리→Do Now→Waiting→Done→Next Action
- AI/Calendar는 Adapter 모킹으로 장애 격리 검증

## 9. 비용 (feedback #6, 정정)
- **Queues/Cron은 무료 플랜 포함**(Queues 일 10,000작업, Cron 무료 사용 가능) — 유료 요구 아님
- **실제 유료 전환 요인은 Next.js 서버기능**: 무료 Workers는 실행당 CPU 10ms·앱 3MB 제한 → 로그인·SSR 포함 앱은 **Workers Paid($5/월)가 현실적으로 안전**
- D1 용량은 현 규모에서 사실상 무제한 수준(무료 500MB)

## 10. 리스크 & 선행 확인 (사용자 결정 필요)
1. **회사 Google Workspace OAuth 허용 / 배포 도메인·googleapis.com 접근** → **M0 사전시험에서 조기 확인**(막히면 M7 축소)
2. **외부 LLM 전송 가능 정보 범위** → M6 착수 전 확정. Workers AI도 외부 전송임에 유의
3. ~~로그인 방식~~ → **확정: Better Auth + 관리자 생성 계정**
4. Workers Paid($5/월) 승인 여부

## 11. 부재 중 안전 착수 범위
차단 요소 없이 진행 가능: **M0 부트스트랩 + M1 UX Skeleton(Mock)**, 그리고 **M2~M5 로컬/스테이징 구현**. AI(M6)·Calendar(M7)는 정책 확인 전까지 **Adapter 인터페이스 + 모킹까지만**.

---

## 12. 후속 로드맵 보존 (P1 → P2 → P3, PRD 15~18)
빌드플랜은 P0 계획이며, 아래 후속 기능은 삭제가 아니라 **대기 상태**다.

- **P1 — 실행 맥락 강화**: Project Context, Decision(Task 게이트형), Stakeholder/Communication(Follow-up 보조), AI 파싱 확장(회의록·이메일), 협업(Comment/@mention, Digest, Private Draft, 첨부), Template 초안, Task Board, Subtask, Priority/Effort
- **P2 — 운영 최적화·학습**: Advanced Team Load, Project Learning, 전체 Flow Map·Timeline/Gantt, 반복 Task, Calendar 증분 동기화·가용시간 분석, 예산·비용, Export
- **P3 — 조직·채널 확장**: 다중 팀/전사 Workspace, 복잡 권한, 외부 파트너 계정, 이메일 직접 연동, Slack/Teams, 네이티브 모바일, Hyperdrive+Postgres 이관

---

## 부록 — 요구사항 ID ↔ 마일스톤
- TASK-01~08 → M1/M2 · FLOW-01~06 → M3(FLOW-07 → P2)
- WAIT-01~07 → M4 · NEXT-01~07 → M6
- TEAM-01~06 → M5(TEAM-07 → P2) · CAL-01~06 → M7(CAL-07 → P2)
