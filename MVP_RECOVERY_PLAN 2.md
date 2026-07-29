# Marketing Team Workflow — MVP 복구 계획 v1.0

> 작성일: 2026-07-25  
> 기준: 실제 Workers 배포본 검증, PRD v0.3, 업무 목록·상세 편집 참고 이미지  
> 적용 원칙: 이 문서의 통과 조건을 충족할 때까지 `BUILD_PLAN.md`의 M3 이후 기능 확장을 중단한다.

## 1. 현재 판정

현재 앱은 프로젝트와 업무를 조회하고 Inbox 업무·하위 업무를 생성할 수 있다. 그러나 다음 행동을 배포 화면에서 수행할 수 없다.

- 프로젝트 생성·수정
- 프로젝트 안에서 최상위 업무 생성
- Inbox 업무의 프로젝트·담당자·마감 보완
- 업무 제목·세부내용 수정
- 담당자·마감·상태 변경
- 업무 완료·취소·복구
- 실제 검색과 기본 필터

따라서 현재 상태는 **P0-A 화면 프로토타입 + 일부 M2 서비스 구현**이다. 팀이 업무 원장으로 사용할 수 있는 MVP는 아니다.

## 2. 이번 복구의 제품 기준

기본 화면은 다음 순서를 따른다.

`Project → 간결한 업무 목록 → 업무 선택 → 즉시 상세 편집`

워크플로 캔버스는 기본 화면에서 제외하고 보조 보기로 둔다. 줌·팬·하위 업무 고도화는 핵심 업무 루프가 통과할 때까지 수정하지 않는다.

### 2.1 프로젝트에서 반드시 가능한 행동

- 프로젝트 안에서 최상위 업무를 즉시 추가한다.
- 미완료 업무를 한 목록에서 본다.
- 체크 한 번으로 업무를 완료한다.
- 완료 업무를 접고 펼치며 개수를 확인한다.
- 완료 업무를 다시 미완료로 복구한다.
- 드래그 핸들로 업무 순서를 바꾸고 변경된 순서를 저장한다.
- 프로젝트 메뉴에서 이름·목표·리드·기간을 수정하고 보관한다.

### 2.2 업무 하나에서 반드시 가능한 행동

- 완료 체크 및 복구
- 제목 즉시 수정
- 세부내용 입력·수정
- Project·Workstream 변경
- 담당자 변경
- 마감일을 오늘·내일·직접 선택으로 지정
- 필요한 경우 마감 시간을 추가
- `Inbox, To Do, In Progress, Waiting, Review, Done` 상태 변경
- 취소 및 복구
- 변경 즉시 저장
- 새로고침 후 변경 유지

업무 선택 시 목록의 맥락을 유지한다. 데스크톱은 우측 패널, 모바일은 전체 화면 시트 또는 목록 아래 확장 영역을 사용한다.

### 2.3 이번 복구에서 제외하는 기능

- 반복 업무
- AI Quick Add 파싱과 Next Action
- Google Calendar 연동
- 고급 Timeline/Gantt
- 고급 Team Load
- 캔버스 시각효과·줌·팬 추가 개선
- 하위 업무 기능 추가 확장

참고 이미지에 반복 아이콘이 있으나 반복 업무는 기존 PRD의 P2 범위를 유지한다.

## 3. 구현 순서

각 단계는 통과 조건을 충족한 뒤 다음 단계로 넘어간다.

### R0 — 범위 고정과 회귀 기준

구현:

- 캔버스를 `Workflow 보기`로 내리고 Project 기본 탭을 업무 목록으로 바꾼다.
- 현재 D1 스키마와 서비스 중 재사용할 항목을 확정한다.
- 기존 사용자 데이터와 마이그레이션 호환성을 확인한다.
- 아래 핵심 E2E 시나리오의 테스트 뼈대를 먼저 만든다.

통과 조건:

- 기능 확장 작업이 중단되고 R1~R5만 개발 범위에 남는다.
- 기존 Project·Task 데이터가 새 목록 화면에서 누락 없이 보인다.

### R1 — Project와 목록형 업무 관리

구현:

- Project 생성·수정·보관 서버 액션과 폼
- Project 안의 최상위 업무 인라인 추가
- 재사용 가능한 `TaskRow`
- 미완료 업무 목록
- 완료 목록 접기·펼치기와 개수 표시
- 완료 체크 및 복구
- 드래그 핸들을 이용한 업무 순서 변경

권장 구성:

- `ProjectTaskList`
- `TaskRow`
- `ProjectForm`
- `app/actions/projects.ts`
- `app/actions/tasks.ts`의 완료·복구 액션

통과 조건:

- 새 Project를 만들고 새로고침 후 다시 열 수 있다.
- Project에서 제목만 입력해 최상위 Task를 만들 수 있다.
- 체크 한 번으로 Done 처리되고 완료 목록에 들어간다.
- 완료 Task를 복구하면 미완료 목록으로 돌아온다.
- 업무 순서를 바꾸고 새로고침해도 순서가 유지된다.
- 모든 실패는 화면에 한국어 오류 메시지로 표시된다.

### R2 — 업무 상세 편집

구현:

- `TaskDetailPanel`을 읽기 전용에서 편집형으로 변경
- 제목·Description 저장
- Project·Workstream 선택
- Assignee 선택
- Status 선택
- 오늘·내일·직접 선택 마감과 선택적 시간
- 취소·복구 메뉴
- 낙관적 동시수정 충돌 안내
- Status·Assignee·Due 변경 Activity Log 기록

서버 연결:

- 기존 `editTask`, `cancelTask`, `restoreTask` 서비스를 서버 액션에 연결한다.
- 서버 액션에서 Workspace·Project·Member 소속을 검증한다.
- Validation·Stale Version·Not Found 오류를 사용자 메시지로 변환한다.

통과 조건:

- 제목·상태·담당자·마감 변경이 각각 1~2번의 조작으로 끝난다.
- 세부내용을 입력하고 닫은 뒤 다시 열어도 내용이 유지된다.
- 오늘·내일은 한 번의 선택으로 지정되고 직접 선택에서는 날짜와 시간을 저장할 수 있다.
- `Inbox` 밖의 상태를 선택하면 Project가 반드시 지정된다.
- 취소된 Task는 일반 목록에서 제외되고 복구할 수 있다.
- 다른 탭의 오래된 version으로 저장하면 기존 데이터를 덮어쓰지 않는다.

### R3 — Team Inbox, Home, 검색·필터

구현:

- Project가 없는 Inbox 업무의 전용 목록
- Inbox에서 Project·담당자·마감·상태를 지정하는 정리 동선
- Home 기본 화면을 `My Focus / Waiting / Coming Next` 목록으로 복구
- 제목·Project·담당자 통합 검색
- Project·Assignee·Status·Due 기본 필터
- 결과 없음과 필터 초기화

통과 조건:

- Quick Add 업무가 사라지지 않고 Team Inbox 첫 화면에 보인다.
- Inbox Task를 Project에 배치하고 To Do 또는 In Progress로 전환할 수 있다.
- 사용자가 앱을 연 뒤 10초 안에 지금 할 일과 대기 업무를 구분한다.
- 검색어와 필터 조합 결과가 새로고침 전후 동일하다.

### R4 — Waiting과 직접 Workflow

구현:

- Finish-to-Start Dependency 모델과 마이그레이션
- 선행·현재·후속 Task 연결
- 자기참조·순환 차단
- Waiting 유형
- 기다리는 내용·상대·내부 Owner
- Follow-up 날짜
- Blocked 사유와 해결 행동
- Follow-up 초과 Needs Attention 계산
- `Predecessor → Current → Successor` Flow Strip

통과 조건:

- 선행 Task가 끝나기 전 후속 Task 시작 시 경고한다.
- 선행 Task 완료 시 후속 Task를 실행 가능으로 표시한다.
- 모든 Waiting Task에 대기 내용과 Follow-up 날짜가 존재한다.
- Follow-up이 지난 Task가 Home의 확인 필요 목록에 노출된다.

### R5 — 팀 사용·보안·모바일·배포 검증

구현:

- Team 화면에 팀원별 In Progress·Due·Waiting·Review 표시
- 인증 우회 제거
- 보호 경로와 실제 세션 검증 복구
- Workspace 단위 읽기·쓰기 접근 통제
- 390px 모바일에서 단일 열 업무 목록
- 모바일 업무 상세 전체 화면 시트
- 로딩·빈 상태·권한 오류·저장 오류 처리
- 배포본 대상 E2E

통과 조건:

- 미인증 사용자는 앱 데이터에 접근할 수 없다.
- 다른 Workspace의 Project·Task ID로 직접 접근할 수 없다.
- 모바일에서 본문과 업무 제목을 확대 없이 읽을 수 있다.
- 모바일에서 Task 추가·편집·완료가 가능하다.
- 아래 필수 E2E가 Workers 배포본에서 모두 통과한다.

## 4. 필수 E2E 시나리오

1. Project 생성 → Project 안에서 Task 생성 → 새로고침 → 데이터 유지
2. Quick Add → Team Inbox 확인 → Project·담당자·마감 지정 → To Do 전환
3. Task 제목·세부내용 수정 → 패널 닫기 → 재진입 → 값 유지
4. To Do → In Progress → Waiting → Review → Done 상태 전환
5. Done 체크 → 완료 목록 이동 → 복구 → 미완료 목록 이동
6. 업무 순서 변경 → 새로고침 → 변경된 순서 유지
7. Task 취소 → 일반 목록 제외 → 복구
8. 두 탭에서 같은 Task 수정 → 오래된 저장 거부
9. 검색·필터 적용 → 정확한 결과와 결과 없음 상태 확인
10. Waiting + Follow-up 지정 → 날짜 초과 → Needs Attention 노출
11. 모바일에서 Project 열기 → Task 추가 → 상세 수정 → 완료
12. 미인증 접근 거부 및 타 Workspace 직접 접근 거부

## 5. 데이터·API 변경

기존 Task 필드 중 Title, Description, Project, Workstream, Assignee, Reviewer, Start, Due, Status, Version은 재사용한다.

추가가 필요한 항목:

- TaskDependency
- Waiting 유형
- 기다리는 내용
- 기다리는 상대
- 내부 Owner
- Follow-up 날짜
- Blocked 사유
- 해결 행동
- Project 내 업무 정렬 순서
- 선택적 마감 시간

Project·Workstream·Milestone 서비스는 이미 있으므로 새로 작성하지 않고 서버 액션과 UI에 연결한다. 서비스 로직과 UI 사이에서 Workspace 소속 검증을 추가한다.

## 6. 개발 게이트

다음 조건을 모두 충족하면 Task 관리 MVP로 판정한다.

- R1~R3 필수 행동이 배포 UI에서 작동한다.
- Project·Task 변경이 새로고침과 재로그인 후 유지된다.
- 핵심 변경이 Activity Log에 기록된다.
- 인증과 Workspace 경계가 작동한다.
- 데스크톱과 390px 모바일에서 동일한 핵심 행동을 수행할 수 있다.
- 필수 E2E 12개가 Workers 배포본에서 통과한다.
- QA 재검증 점수가 0.80 이상이다.

R4까지 통과하면 Marketing Team Workflow의 핵심 차별점인 Waiting·Dependency 흐름을 검증할 수 있다. R5까지 통과한 뒤에만 AI와 Calendar 구현을 재개한다.
