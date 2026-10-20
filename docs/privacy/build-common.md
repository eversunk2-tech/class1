# 구현 공통 지침 — 개인정보 처리방침 · 구글 교사 인증 · 보호자 동의 (2026-10-20)

> 모든 구현 담당(묶음 1~4)이 먼저 읽는다. 묶음별 지침: `build-1-sql-instructions.md`, `build-2-functions-instructions.md`, `build-3-public-ui-instructions.md`, `build-4-admin-ui-instructions.md`.

## 기준 문서(이 순서로 우선)
1. `docs/privacy/spec.md` — 설계(머리말의 개정 1·2와 1.1 결정표가 본문보다 우선). **함수·RPC·표·열 이름은 spec 4.1·4.2·10.2의 이름표가 계약이다** — 다른 묶음이 같은 이름을 쓰므로 바꾸지 않는다. 바꿔야 하면 바꾸지 말고 보고서에 적는다.
2. `docs/privacy/privacy-policy.md` — 화면 글의 **원문**. 1~8절의 문장은 **글자 그대로** 옮긴다(사용자가 2026-10-20 "글은 이대로" 승인). `>` 메모 줄과 9절 이후는 화면에 넣지 않는다. 원문에 없는 새 문장이 꼭 필요하면 넣되, 보고서에 **문장 그대로 전부** 적는다(사용자가 확인한다).
3. `CLAUDE.md`(프로젝트 규칙 — 정적 export 제약, Supabase·SQL 절차, 디자인·접근성, 서브에이전트 규칙)와 `AGENTS.md`(이 Next.js는 학습 데이터와 다르다 — 쓰기 전에 `node_modules/next/dist/docs/`의 해당 안내를 읽는다).

## 사용자 결정(바꾸지 않음) — 요약
spec 1.1 표(결정 1~13)와 1.1-2(2026-10-20 추가 결정)를 따른다. 특히: AI(Gemini) 되짚기는 이미 끔(`52b5b7c` 배포) · 학생 확인 창 없음 · 구글 계정만 확인 창과 코드 · 인증한 구글 선생님 = 교사(role admin) + **자기 학급 일만**(`teacher_scope='class'`) · 프로필은 로그인한 회원만(SQL ③) · Supabase 무료 요금제.

## 절대 원칙
- **교사 인증 코드의 실제 값은 어디에도 쓰지 않는다**(공개 저장소). 시험·예시는 `000000`. 개인 이메일 주소도 쓰지 않는다(문의 이메일은 화면이 서버에서 받는다).
- 범위 밖 파일을 고치지 않는다(묶음 지침의 "고칠 파일"만). 다른 묶음의 파일이 필요하면 고치지 말고 보고서에 적는다.
- git commit/push 금지. 실제 Supabase DB에 쓰기 금지(실 DB를 읽지도 않는다 — 공개 키 읽기도 하지 않음). 실제 Gemini 금지.
- 아무것도 내려받거나 설치하지 않는다(npm 패키지·브라우저·CDN 파일 저장 금지). 이미 있는 `node_modules`와 시스템 도구만.
- 비밀값(서비스 롤 키 등)을 코드·로그·응답에 넣지 않는다. 로그에는 실패 단계와 오류 문구만(이메일·이름·id 없음).
- 이미 실행한 마이그레이션 파일은 고치지 않는다(새 파일로만).
- 임시 파일은 자기 스크래치 폴더에만: `/private/tmp/claude-501/-Users-sungchul-Desktop-classroom/7bf3a39e-3017-4189-b337-1b82aace66bb/scratchpad/privacy-b<묶음 번호>/`. 끝나면 띄운 Chrome·서버를 끈다.
- **한 명령이 10분 넘게 조용하면 끊긴다** — 시험은 짧게 나눠서 돌린다.

## 화면 시험(묶음 3·4)
- 개발 서버는 메인 에이전트가 띄워 둔다: `http://localhost:3000/class1/` (두 화면 담당이 함께 쓴다 — **`next dev`·`next build`를 직접 돌리지 않는다**. 서버가 응답하지 않으면 보고서에 적고 메인 에이전트에게 알린다). 다른 담당이 같은 작업 트리를 고치는 중이라 잠깐 컴파일 오류가 날 수 있다 — 기다렸다 다시 본다. **파일은 한 번에 완성된 모양으로 쓴다**(반쯤 쓴 파일로 남의 시험을 깨지 않게).
- 자기 전용 headless Chrome(묶음 3 = 포트 9481, 묶음 4 = 9482), 실제 Supabase는 첫 로드부터 막는다: `--host-resolver-rules="MAP *.supabase.co 127.0.0.1:9, MAP supabase.co 127.0.0.1:9"` + CDP `Fetch.enable`(`*supabase.co*`)로 가짜 응답(가짜 세션·가짜 RPC 결과). `Network.setCacheDisabled`. CDP는 Node 24 내장 `WebSocket`. `localStorage.clear()` 금지(자기 키만 지움).
- 검사: `npx tsc --noEmit -p tsconfig.json`, `npm run lint`(경고 0을 목표 — 새 경고를 만들지 않는다).
- 사용자에게 보일 사진을 `.../privacy-b<번호>/showcase/`에 남긴다(ASCII 파일 이름, 1024×768과 390×844).

## 보고서
`docs/privacy/build-<번호>-report.md`(한국어, 간결): 만든 것·고친 파일, 계약(이름표)과 다르게 한 곳, 원문에 없던 새 문장(전부), 시험 결과(명령·숫자), 확인하지 못한 것, 다른 묶음·메인 에이전트에게 넘길 것.
