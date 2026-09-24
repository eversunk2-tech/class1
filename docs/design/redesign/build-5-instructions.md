# 디자인 개편 5단계 — 제목 글꼴(G마켓 산스 Bold) + 제목 부드러운 그림자 · Build 지침 (2026-09-24)

먼저 읽기: `CLAUDE.md`(특히 "디자인 규칙", "과학 차시 앱 규칙", "서브에이전트 규칙"), `docs/design/redesign/spec.md` **맨 끝 "개정 2"**(이번 작업의 기준 — 다른 절과 다르면 개정 2가 우선), `AGENTS.md`(이 Next.js는 버전이 달라 필요하면 `node_modules/next/dist/docs/`를 확인).

## 목표
사이트와 과학 앱 23개에서 **제목 글꼴 Jua → G마켓 산스 Bold**로 바꾸고, 제목에 **A. 부드러운 그림자**를 넣는다. 본문 글꼴(Pretendard)·색·배치는 바꾸지 않는다.

## 이미 준비된 것(바꾸지 말 것, 새로 받지 말 것)
* `public/fonts/gmarket-sans/GmarketSansBold.otf`(공식 원본, 수정 금지), `gmarket-sans.css`(@font-face `"Gmarket Sans"`, weight 700, swap), `LICENSE-gmarket-sans-OFL.txt`.
* 글꼴 파일을 변환·서브셋·이름 변경하지 않는다(OFL Reserved Font Name 조건). 다른 글꼴을 내려받지 않는다.

## 1. 사이트 (Next.js)
* `src/app/layout.tsx`: `next/font/google`의 `Jua`와 `--font-heading-kr`를 뺀다. `<head>`에 `<link rel="stylesheet" href={withBasePath("/fonts/gmarket-sans/gmarket-sans.css")} />`(`@/lib/base-path`)를 넣는다. 다른 글꼴(Geist 등)·스크립트는 그대로.
* `src/app/globals.css`:
  * `--font-heading`을 `"Gmarket Sans"` → Pretendard(본문 글꼴 변수) → 기기 한글 글꼴 순으로. 주석의 Jua 설명을 고친다.
  * 제목 글꼴은 **굵기 700**으로 그리게 한다(파일이 Bold 하나뿐 — 글꼴을 못 받았을 때도 대체 글꼴이 굵게). `font-synthesis: none`은 유지. 제목 요소에 붙은 `font-normal` 같은 클래스가 700을 덮지 않는지 확인하고 필요한 곳만 고친다.
  * **제목 그림자 변수** 하나(예: `--heading-shadow`)를 밝음/어두움(`.dark`)으로 정의하고, 제목 글꼴을 쓰는 곳(`.font-heading` 및 `var(--font-heading)`를 쓰는 규칙)에 `text-shadow`로 적용한다. 값은 개정 2(밝음: `0 0.05em 0` 흰 90% + `0 0.16em 0.4em` 보라 약 28% / 어두움: `0 0.08em 0.3em` 검정 70% + `0 0 0.5em` 보라 약 25%, em 단위)를 출발점으로, 화면에서 보고 조금 조정해도 된다(조정했으면 값과 까닭을 보고).
  * 작은 제목(대략 18px 이하)에서 흐림이 번져 보이면 약하게.
  * 그라데이션 글자(`text-grad-primary` 등 `background-clip:text` + 투명 글자)는 `text-shadow: none` + `filter: drop-shadow(...)`로.
  * `@media (forced-colors: active)`에서는 그림자 없음.
* `src/app/admin/admin-theme.css`: 관리자 화면 영역에서는 **그림자 없음**(변수를 `none`으로). 글꼴은 바뀐다.
* 제목 글꼴을 쓰는 컴포넌트(아래 검색으로 34개 파일): `grep -rln "font-heading" src`. **필요한 곳만** 고친다 — G마켓 산스는 주아보다 글자 폭이 넓어 좁은 화면(375px, 320px)에서 제목이 넘치거나 한 글자만 다음 줄로 떨어지는 곳, 알약·칩·아이콘 옆 제목에서 글자가 위아래로 치우쳐 보이는 곳(필요하면 여백·`leading` 조정). 주석에 적힌 "Jua"는 "제목 글꼴(G마켓 산스)"로 고친다. 기능·문구·색은 바꾸지 않는다.
* 홈 히어로(`home-hero.tsx`) 핵심 낱말 "배움터"(그라데이션 글자+형광펜)와 사이트 이름(`topbar.tsx`)을 특히 확인.

## 2. 과학 앱 공통 틀(정본) → 23개 앱 사본
* **순서 주의**: 지금 다른 에이전트가 같은 정본 CSS와 앱 사본을 고치고 있다. `scripts/templates/`와 `public/apps/`는 Claude가 SendMessage로 "공통 틀 시작"을 보낼 때까지 **읽기만** 하고 고치지 않는다. 1번(사이트)을 먼저 끝내고, 신호가 아직 없으면 1번 결과를 짧게 보고하고 기다린다(보고서는 전부 끝난 뒤 한 번에).
* 정본만 고친 뒤 **모든 앱 사본에 복사**하고 `diff -r`로 일치 확인: 실험 앱 20개 `public/apps/sci-*/science-sim/`, 조사 앱 3개(`sci-6-1-1-5`, `sci-6-1-1-6`, `sci-6-1-2-6`) `science-guide/`.
* `scripts/templates/science-sim/persist.js`, `scripts/templates/science-guide/persist.js`: 글꼴 붙이는 코드에서 Jua(`fonts.googleapis.com`)와 `fonts.gstatic.com` preconnect를 빼고 `../../fonts/gmarket-sans/gmarket-sans.css`(상대경로, 같은 사이트)를 **비차단 `<link>`**로 붙인다(id 예: `ss-font-heading`). Pretendard(jsDelivr+SRI)는 그대로. 주석도 고친다. 어떤 오류도 밖으로 던지지 않는 구조 유지.
* `scripts/templates/science-sim/style-common.css`, `scripts/templates/science-guide/style-common.css`: `--ss-font-heading`을 `"Gmarket Sans", var(--ss-font)`로, 제목 굵기 700, 제목 그림자 변수(밝음/어두움 — 이 파일의 기존 어두움 규칙 방식을 따른다)와 적용, 그라데이션 글자·`forced-colors` 처리는 사이트와 같게. 파일 머리 주석의 Jua 설명을 고친다. **3D 장면·그래프·SVG 글자·측정값·표·입력칸 글꼴과 색은 바꾸지 않는다.**
* 앱 고유 파일(`public/apps/*/style.css`, `app.js` 등)에 Jua를 직접 쓴 곳이 있으면 보고만 한다(고치지 말 것 — 없을 것으로 예상).
* 이 정본 두 CSS에는 방금 끝난 다른 작업(되짚기 스피너 `!important`)이 들어 있다 — 그 줄을 되돌리지 않는다.

## 절대 하지 않는 것
* 문항·안내 문구·과학 내용·저장 키·저장 구조·본문 글꼴·색 체계 변경. 글꼴 파일 변경·추가 다운로드. git commit/push. 실제 DB 쓰기. 실제 Supabase·Gemini 호출.

## 확인(반드시)
* `npm run lint`, `npm run build` 통과. `out/fonts/gmarket-sans/`에 세 파일이 있는지.
* 개발 서버는 이미 `http://localhost:3000/class1/`에서 돌고 있다(`blog-dev`) — 끄거나 새로 띄우지 않는다. 필요하면 빌드 결과(`out/`)를 자기 전용 정적 서버(포트 **4015**, basePath `/class1`에 맞게)로 따로 확인해도 되고, 끝나면 반드시 종료.
* **자기 전용 headless Chrome만**(원격 디버깅 포트 **9342**, 사용자 데이터 폴더는 스크래치 안). Node 24 전역 `WebSocket`으로 CDP 직접 사용(puppeteer 설치 금지).
* **실제 Supabase는 첫 로드부터 차단**: Chrome 인자 `--host-resolver-rules="MAP *.supabase.co 127.0.0.1:9, MAP supabase.co 127.0.0.1:9"` + `--disable-web-security` + CDP `Fetch.enable`(패턴 `*supabase.co*`)로 가짜 응답(`site_settings` → `login_required:false`, `profiles` → 가짜 프로필(학생은 `role:"user"`, 관리자 화면 확인 때는 `role:"admin"`), `rpc/my_must_change_password` → `false`, `functions/v1/check-answer` → `{"verdict":"ok"}`, 나머지 GET → `[]`(Accept에 `vnd.pgrst.object`면 `null`), POST/PATCH → 201 `[]`, OPTIONS → 204). 로그인 상태는 `Page.addScriptToEvaluateOnNewDocument`로 localhost 출처에서만 localStorage `sb-<ref>-auth-token`에 가짜 세션(서명 없는 JWT, 만료 1시간 뒤). ref는 `.env.local`의 URL 호스트 첫 부분(값을 보고서에 적지 않는다). `Network.loadingFailed`로 supabase 요청이 새지 않았는지 기록.
* 화면 확인(스크린숏): 홈, 과학수업(학기→단원→차시), 자유게시판·학습게임 목록과 글쓰기, 글 보기, 검색, 로그인, 내 학습 활동, 404, 관리자(대시보드·회원 관리) — 1280×800, 1024×768, 768×1024, 375×812, 320×640(홈·과학수업만), 밝음·어두움(사이트 테마 토글 방식대로). 확인: 제목이 G마켓 산스로 보임(`document.fonts` 확인), 넘침·가로 스크롤 없음, 어색한 줄바꿈, 알약 속 글자 세로 치우침, 그림자가 번져 흐려 보이지 않는지, 글자 대비 AA(그림자 제외 글자색↔바탕).
* 글꼴을 못 받는 경우: 글꼴 파일 요청을 막고 열어 제목이 대체 글꼴 굵게로 바로 보이는지.
* 과학 앱: 실험 앱 2개(`sci-6-1-1-2`, `sci-6-2-3-2`)와 조사 앱 1개(`sci-6-1-1-5`)를 실험(조사) 단계까지 — 제목 글꼴 적용, 콘솔 오류 0, 첫 화면이 글꼴 때문에 늦지 않음(글꼴 CSS·파일 요청을 5초 붙잡아 둬도 첫 화면이 바로 그려지는지), `../../fonts/...` 경로가 200인지.
* `localStorage.clear()` 금지, 다른 탭·프로세스 건드리지 않기, 띄운 서버·Chrome 종료, 임시 파일 정리(스크린숏은 스크래치 `redesign-5/`에 남기고 경로 보고).

## 보고서 `docs/design/redesign/build-5-report.md`
바꾼 파일과 요지, 그림자 최종 값, 화면별 확인 결과(문제 → 조치), 대비 실측, `diff -r`·lint·build 결과, supabase 차단 기록, 확인하지 못한 것(실제 iPad·실제 로그인 등)을 한국어로 간결하게.
