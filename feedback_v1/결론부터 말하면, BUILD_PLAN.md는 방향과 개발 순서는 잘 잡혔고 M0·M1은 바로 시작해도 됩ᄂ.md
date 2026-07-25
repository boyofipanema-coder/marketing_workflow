결론부터 말하면, ++[BUILD_PLAN.md](sandbox:/workspace/scratch/5d19c836b734/upload/BUILD_PLAN.md)++는 **방향과 개발 순서는 잘 잡혔고 M0·M1은 바로 시작해도 됩니다.** 다만 전체 개발 지시서로 확정하기 전에는 v1.1 수준의 보완이 필요합니다.  
핵심 평가는 이렇습니다.  

| 평가 항목               | 판단                         |
| ------------------- | -------------------------- |
| PRD v0.3 반영         | 매우 잘 됨                     |
| Task·Workflow 뼈대 우선 | 잘 지켜짐                      |
| 기능 과잉 여부            | 제품 기능은 과하지 않음              |
| 기술 복잡도              | 기반 설비를 조금 일찍 많이 깔고 있음      |
| 바로 개발 착수 가능성        | M0·M1 가능, M2 이후 일부 결정 필요   |
| 후속 기능 보존            | PRD에는 있으나 빌드플랜에는 로드맵 보강 필요 |
  
****개발 단계를 쉽게 설명하면****  

| 단계 | 비개발자 관점의 의미                   | 판단               |
| -- | ----------------------------- | ---------------- |
| M0 | 앱이 올라갈 서버·데이터 저장소를 준비         | 적절               |
| M1 | 실제 데이터 없이 클릭해보는 모형 제작         | 적절               |
| M2 | 팀원이 입력한 업무가 저장·공유되는 진짜 앱으로 전환 | 핵심               |
| M3 | 각각의 할 일을 선행·후속 업무로 연결         | 제품의 핵심 차별점       |
| M4 | 회신·승인 대기 업무가 잊히지 않게 관리        | 실제 마케팅 업무에 매우 중요 |
| M5 | 누가 무엇을 하고 어디서 멈췄는지 팀 전체가 확인   | 적절               |
| M6 | AI가 다음 업무를 제안하되 사람이 최종 선택     | 적절한 순서           |
| M7 | Google Calendar 조회·일정 등록      | 핵심 뼈대 이후라 적절     |
| M8 | 실제 팀이 써보고 고장·불편을 수정           | 필요               |
  
즉, 업무 저장 → 업무 연결 → Waiting 관리 → 팀 공유 → AI → Calendar라는 순서는 정확합니다. AI나 Calendar부터 만들지 않은 것도 좋습니다.  
## 특히 잘된 부분  
* Task → Workflow → Waiting → Next Action의 우선순위가 흔들리지 않습니다.  
* AI가 바로 Task를 만들지 않고 제안 → 사용자 승인 구조를 유지합니다.  
* Calendar나 AI가 고장 나도 기본 업무관리는 작동하도록 분리했습니다.  
* D1은 2~6명 팀에는 충분합니다. 무료 플랜도 DB당 500MB, 유료는 10GB까지 지원하므로 현재 규모에서 용량은 사실상 문제가 되지 않습니다. ++[Cloudflare D1 limits](https://developers.cloudflare.com/d1/platform/limits/)++  
* Next.js를 Cloudflare Workers에서 운영하는 OpenNext 방식도 현재 공식 지원되는 경로입니다. ++[Cloudflare Next.js 가이드](https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/)++  
* Ready, Blocked, Overdue를 상태로 계속 추가하지 않고 자동 신호로 계산한 것도 사용 부담을 줄이는 좋은 결정입니다.  
## 착수 전 반드시 고칠 부분  
## 1. 로그인 기술을 하나로 확정해야 합니다  
현재 Lucia 패턴 or Auth.js라고 되어 있는데, 개발계획에서 “A 또는 B”는 실제 코딩 시 흔들림을 만듭니다. 게다가 Lucia v3는 공식적으로 폐기된 라이브러리입니다. ++[Lucia 공식 안내](https://lucia-auth.com/lucia-v3/migrate)++  
신규 개발이라면 다음처럼 한 줄로 확정하는 편이 좋습니다.  
Better Auth + Drizzle + D1, 관리자 초대 방식, 공개 회원가입 없음  
또한 ‘이메일 매직링크’는 링크를 발송할 이메일 서비스가 추가로 필요합니다. 회사 정책과 외부 이메일 서비스 문제를 피하려면 초기 2~6명 파일럿에서는 관리자 생성 계정 방식이 더 단순할 수 있습니다.  
## 2. M0에서 KV·Queues·Cron까지 모두 만들 필요는 없습니다  
현재 기능은 과하지 않지만, 기술 설비는 조금 과하게 선구축되어 있습니다.  
* M0: Workers + Next.js + D1 + Drizzle만  
* M2: 로그인과 세션  
* M6: 정말 필요할 때 AI Queue  
* M7: Calendar 관련 설비  
정도로 늦추는 것이 적절합니다.  
특히 로그인 세션을 KV에 둘 필요도 거의 없습니다. KV는 지역에 따라 변경 내용이 최대 60초 이상 늦게 보일 수 있어 로그인 해제나 권한 변경처럼 즉시 반영돼야 하는 정보에는 D1이 더 단순합니다. ++[Cloudflare KV 일관성 설명](https://developers.cloudflare.com/kv/concepts/how-kv-works/)++  
M4의 Needs Attention도 Cron이 매번 찾아서 표시할 필요 없이, 화면을 열 때 Follow-up 날짜가 지났는가를 계산하면 됩니다. Cron은 나중에 외부 알림을 보낼 때만 필요합니다.  
## 3. 두 사람이 동시에 수정하는 상황이 빠져 있습니다  
현재 계획대로라면 두 팀원이 같은 Task를 열고 수정했을 때, 나중에 저장한 사람이 앞사람의 변경을 덮어쓸 수 있습니다.  
P0에서 복잡한 실시간 시스템까지 만들 필요는 없지만 다음은 필요합니다.  
* Task에 수정 버전 또는 최종 수정 시각 기록  
* 오래된 화면에서 저장하려 하면 “다른 팀원이 먼저 수정했습니다” 안내  
* 화면 재진입·탭 복귀 시 자동 갱신  
* 필요하면 20~30초 주기 갱신  
WebSocket 같은 고급 실시간 기술은 아직 필요 없습니다.  
## 4. Calendar 기능은 늦게 만들되, 가능 여부는 초기에 시험해야 합니다  
실제 Calendar 개발은 M7이 맞습니다. 하지만 회사 정책 때문에 OAuth가 막힐 가능성을 M7에서 처음 확인하면, 거의 다 만든 뒤 핵심 연동이 불가능하다는 사실을 알게 될 수 있습니다.  
따라서 M0에 기능 개발이 아닌 짧은 사전 시험을 추가해야 합니다.  
* 회사 PC에서 배포 도메인 접속  
* Google 로그인 화면 접근  
* Calendar 권한 요청 가능 여부  
* googleapis.com 호출 가능 여부  
그리고 P0에서는 Calendar 일정을 매번 동기화·저장하기보다, 앱을 열 때 오늘·이번 주 일정만 Google에서 읽어오는 방식이 더 가볍습니다. 현재 계획처럼 증분 동기화를 하려면 별도의 일정 캐시, 동기화 토큰 저장, 삭제된 일정 처리, 토큰 만료 시 전체 재동기화까지 필요합니다. ++[Google Calendar 증분 동기화](https://developers.google.com/workspace/calendar/api/guides/sync)++  
## 5. M8의 ‘개발 완료’와 ‘제품 검증’을 분리해야 합니다  
현재 M8에는 두 종류의 일이 섞여 있습니다.  
* 개발자가 완료할 수 있는 것: 오류 처리, 모바일, 백업, 온보딩  
* 실제 팀이 2주 써야만 알 수 있는 것: 주 3일 사용, 상태 최신율 80%, 회의 감소  
따라서 다음처럼 나누는 편이 명확합니다.  
* M8-A Release Hardening: 기술적 배포 완료  
* M8-B Two-week Pilot: 실제 사용성 검증  
* P1 진입 결정: 파일럿 결과를 보고 다음 기능 개발 여부 결정  
## 6. 비용 관련 문장은 수정해야 합니다  
“Cron/Queues가 유료 플랜을 요구할 수 있다”는 현재 기준으로 정확하지 않습니다. Queues는 무료 플랜에서도 하루 10,000회 작업이 포함되고, Cron도 무료 계정에서 사용할 수 있습니다. ++[Cloudflare Queues 요금](https://developers.cloudflare.com/queues/platform/pricing/)++  
대신 실제 유료 전환 가능성은 Next.js 서버 기능입니다. 무료 Workers는 실행당 CPU 10ms, 앱 크기 3MB 제한이 있어 로그인·서버 렌더링이 포함된 앱은 월 최소 5달러의 Paid 플랜이 현실적으로 안전합니다. ++[Cloudflare Workers 한도](https://developers.cloudflare.com/workers/platform/limits/)++, ++[Workers 요금](https://developers.cloudflare.com/workers/platform/pricing/)++  
## 7. Workers AI를 ‘자체 인프라’라고 표현하면 안 됩니다  
Workers AI도 Cloudflare라는 외부 사업자의 AI 서비스입니다. Cloudflare는 고객 콘텐츠를 모델 학습이나 서비스 개선에 사용하지 않는다고 명시하지만, 회사 정보가 외부 클라우드로 전송되는 것은 동일합니다. 따라서 외부 LLM이 금지되면 Workers AI가 자동으로 허용되는 것은 아닙니다. ++[Cloudflare Workers AI 데이터 정책](https://developers.cloudflare.com/workers-ai/platform/data-usage/)++  
## 추가로 보완할 작은 누락  
* Milestone은 데이터 모델에 있지만 M2 구현 항목에는 없습니다. M2에서 최소 생성·수정 기능을 만들거나, P0 Calendar 등록 대상을 Task로만 제한해야 합니다.  
* M8의 ‘핵심 알림’은 우선 앱 내부 배지와 Needs Attention 표시로 한정해야 합니다. 이메일·브라우저 알림은 후순위가 적절합니다.  
* 백업은 막연히 적지 말고 D1의 자동 Time Travel 복구와 정기 export를 명시하면 됩니다. D1은 무료 7일, 유료 30일 동안 시점 복구를 제공합니다. ++[D1 백업과 복구](https://developers.cloudflare.com/d1/reference/time-travel/)++  
* M1에서는 5개 화면을 모두 정교하게 디자인하지 말고, Home / Project Workflow / Task Panel / Quick Add에 대부분의 시간을 써야 합니다. Team과 Calendar는 자리만 확인하는 정도면 충분합니다.  
* 현재 빌드플랜은 사실상 P0 계획입니다. 문서 끝에 짧게라도 P1 실행 맥락 → P2 학습·운영 → P3 조직 확장을 넣어야, 이전에 합의한 후속 기능이 삭제되지 않고 대기 중이라는 점이 보존됩니다.  
*   
## 최종 판단  
이 계획은 폐기하거나 크게 다시 짤 문서가 아닙니다. **제품 구조는 약 90% 맞고, 구현 구조를 10% 정도 다듬으면 됩니다.**  
가장 중요한 수정 방향은 한 문장으로 정리됩니다.  
M0·M1은 그대로 진행하되, 로그인은 하나로 확정하고, KV·Queue·Cron은 실제로 필요해질 때 도입하며, 동시 수정·Calendar 사전 검증·M8 분리·P1 이후 로드맵을 보완한다.  
이 수정 후에는 바이브 코딩 에이전트에 단계별로 전달해도 될 정도의 빌드플랜이 됩니다.  
