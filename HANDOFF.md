# 세션 인계 — Workflow Canvas 위계 작업

작성: 2026-07-26 · 커밋 `39975ec` 시점

---

## 0. 가장 먼저 — 작업 위치

```
/Users/dongryoolkim/Desktop/Vibe/Todo/.claude/worktrees/heuristic-diffie-9aab88
브랜치: claude/heuristic-diffie-9aab88
```

**다른 워크트리 `mvp-recovery-plan-c8934c`는 절대 건드리지 말 것.**
별도 Claude 세션이 살아 있고, 이전 세션이 실수로 그쪽에서 작업하다 그 세션의
미커밋 변경을 자기 커밋에 쓸어담은 사고가 있었다. 지금 브랜치에는 그 내용까지
정리되어 들어와 있으므로, 그 워크트리를 reset·clean하면 남의 작업이 날아간다.

작업 시작 전 `pwd`와 `git branch --show-current`로 위치를 반드시 확인할 것.

---

## 1. 지금까지 한 일 (커밋 6개)

| 커밋 | 내용 |
|---|---|
| `f778607` | R1 — workspace 경계, 원자적 version UPDATE, migration 0002 |
| `0f4097f` | R2–R4 — 생성·편집·Inbox·검색 (Core Task MVP) |
| `6a1baf4` | 프로젝트 화면을 업무 흐름 보드 우선으로 |
| `a1e1dd9` | 홈을 워크스페이스 전체 보드로 (프로젝트별 레인) |
| `350e687` | P0+P1 — `importance`/`kind` 추가, 업무영역 밴드, 핵심 카드 2단 |
| `39975ec` | P2 — 핵심 하위 업무를 독립 카드로 승격 + tether |

현재 상태: typecheck 통과, **테스트 179개 통과**, production build 정상.

---

## 2. 남은 계획 (P3~P5)

이 계획은 이전 세션 대화에만 있었으므로 여기에 옮겨 둔다.

### 원칙 — 채널 분리
한 차원당 하나의 시각 채널만 쓰고 절대 겹치지 않는다.

| 차원 | 전용 채널 | 금지 |
|---|---|---|
| 위계 | containment · 들여쓰기 · 연결선 | 크기 사용 금지 |
| 중요도 | 카드 크기 · 테두리 굵기 | 색 사용 금지 |
| 진행 상태 | 컬럼 위치 · 상태 색 | 크기 사용 금지 |

### P3 — 마일스톤 보드 진입 (다음 단계)
- `task.kind` 컬럼은 **이미 존재**하나 UI에서 미사용. migration 0003에 포함됨
- 각 밴드 상단에 다이아몬드 마커 스트립. **사각형 카드와 절대 같은 모양이면 안 됨** (모양이 종류를 인코딩)
- 기존 `milestone` 테이블(id/project_id/name/due_date) 행을 task로 backfill
- 유일하게 데이터 이관이 있는 단계 → 로컬 검증 필수
- `ProjectPulse`와 `MilestoneManager`가 기존 테이블을 참조 중이므로 함께 이관

### P4 — 줌 LOD
현재는 축소해도 카드가 균일하게 작아져 50%에서 색 덩어리만 남는다.
- 80%+ : 전체 카드
- 50~80% : 제목 + 상태점 + 핵심 배지, 세부는 `n/m` 미터로 축약
- 50% 미만 : 카드는 상태색 막대. **밴드 제목·마일스톤·핵심 업무만 라벨 유지**
- `view.current.scale`에서 `lod` 파생해 카드 렌더에 전달

### P5 — 모바일 구조화 목록
390px에서 보드는 답이 아니다. 접히는 업무영역 섹션 → 핵심 업무(굵게) →
세부 업무(한 단 들여쓰기), 마일스톤은 다이아몬드 달린 전폭 구분선.
기존 `TaskList` 확장이지 새 화면이 아님.

### R5 — Dependency (P2 완료로 이제 착수 가능)
선행·후속 연결선은 "승격된 카드"가 있어야 그릴 대상이 생긴다. P2가 끝났으므로
지금 착수 가능. `task_dependency` 테이블은 migration 0002에 이미 있음.

---

## 3. 환경 함정 — 이걸 모르면 몇 시간 날린다

### 3.1 Bash 샌드박스가 `.wrangler` 쓰기를 가로챈다
샌드박스 상태에서 `wrangler`/`npm run build`를 돌리면 파일이 섀도 FS에 쓰여
dev 서버가 다른 상태를 본다. `SQLITE_READONLY` / `SQLITE_BUSY`의 진짜 원인.

→ **wrangler·build·sqlite3 명령은 `dangerouslyDisableSandbox: true`로 실행할 것.**

### 3.2 로컬 D1 복구 레시피 (이 순서를 지킬 것)
```
1. preview_stop
2. pkill -f "heuristic-diffie-9aab88.*workerd"
3. rm -rf app/.wrangler/state
4. preview_start   ← dev 서버가 직접 state를 만들게 한다
5. sqlite3 <D1파일> < schema.sql && sqlite3 <D1파일> < seed.sql
6. sqlite3 <D1파일> "PRAGMA wal_checkpoint(TRUNCATE);"
```
D1 파일 경로:
`app/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/*.sqlite` (metadata 제외)

schema.sql 생성:
```bash
for tag in 0000_absent_harry_osborn 0001_add_parent_task_id 0002_recovery_fields 0003_task_hierarchy; do
  sed 's|--> statement-breakpoint||' "drizzle/migrations/$tag.sql"; echo ";"
done > schema.sql
npx tsx scripts/seed-db.ts > seed.sql
```

### 3.3 dev 서버 켜진 채로 `wrangler d1` 금지
락 충돌로 miniflare가 죽는다. 반드시 서버를 내리고 실행.

### 3.4 build 병렬 워커
`(app)/layout.tsx`에 `export const dynamic = "force-dynamic"`이 들어가 있다.
이걸 지우면 병렬 build 워커들이 로컬 D1을 서로 뺏으며 build가 깨진다.

### 3.5 자동화로 Enter 입력이 React 폼에 안 먹는다
브라우저 자동화의 `key Return`이 React input에 전달되지 않는다. 검증할 때는
`form.requestSubmit()`을 쓸 것. 실제 사용자는 정상 동작(단일 input 폼).

---

## 4. 로컬 DB의 테스트 데이터 (실데이터 아님)

검증용으로 직접 넣은 것들이라 언제든 지워도 된다.
- `importance='key'`: 룩북 에디토리얼 카피 작성, 인스타그램 릴스 히어로 영상 제작,
  확정 파트너 2팀 계약 마무리, 발표 자료 뼈대 구성 (20장)
- 하위 업무: 촬영 콘티 확정, 모델 캐스팅 확정(key), 편집본 1차 리뷰,
  에이전시 견적 승인(key, 손자 depth)

migration 0003은 로컬 D1에 `sqlite3`로 직접 적용해 둔 상태.

---

## 5. 문서 충돌 — 정리 필요

세션 중 사용자 지시로 `MVP_RECOVERY_PLAN.md`를 두 번 뒤집었으나 **문서는 갱신하지 않았다.**
다시 읽으면 충돌하므로 정리를 권함.

- **§2.2** "Project 기본 화면은 업무 목록이다" → 실제로는 **업무 흐름 보드가 기본**,
  홈도 보드 우선
- **§3** "캔버스 고도화·하위 업무 확장은 Pilot Ready 전까지 금지" → P0~P2에서 이미 진행

`BUILD_PLAN.md` M1 게이트의 **"계층 자명"** 요건은 P0~P2로 이제 충족된다.

---

## 6. 새 세션 시작 프롬프트 (복사해서 사용)

```
worktree /Users/dongryoolkim/Desktop/Vibe/Todo/.claude/worktrees/heuristic-diffie-9aab88
에서 이어서 작업한다. 먼저 HANDOFF.md를 읽고 시작할 것.
다른 워크트리(mvp-recovery-plan-c8934c)는 절대 건드리지 말 것.

다음 작업: P3 (마일스톤 보드 진입)
```
