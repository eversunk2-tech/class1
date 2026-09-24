# 디자인 개편 5단계 — Build 보고서 (2026-09-24)

지침: `docs/design/redesign/build-5-instructions.md`. 기준: `docs/design/redesign/spec.md` 개정 2.

## 요약

제목 글꼴을 Jua → G마켓 산스 Bold(공식 파일, `public/fonts/gmarket-sans/`, 수정 없음)로 바꾸고, 제목에 "A 부드러운" 그림자(흰/검 윤곽 + 보라 은은한 빛, em 단위)를 넣었다. 대상은 사이트 전체(Next.js)와 과학 차시 앱 23개 공통 틀. 관리자 화면은 글꼴만 바뀌고 그림자는 없다. git commit/push, 실 DB 쓰기, 실제 Supabase·Gemini 호출은 하지 않았다.

다른 에이전트(공통 틀 정본의 되짚기 스피너 `!important` 수정, 앱별 `style.css` 8개)와 작업이 겹치지 않게 지침대로 1번(사이트)을 먼저 끝내고 "공통 틀 시작" 신호를 받은 뒤 2번(과학 앱)을 진행했다.

## 1. 바꾼 파일

### 사이트(Next.js)
| 파일 | 내용 |
|---|---|
| `src/app/layout.tsx` | `next/font/google`의 `Jua`·`--font-heading-kr` 제거. `<head>`에 `withBasePath("/fonts/gmarket-sans/gmarket-sans.css")` `<link rel="stylesheet">` 추가. |
| `src/app/globals.css` | `--font-heading`을 `"Gmarket Sans" → Pretendard(--font-body-kr) → 기기 한글 글꼴`로 교체. `--heading-shadow`/`--heading-shadow-sm`/`--heading-grad-shadow` 토큰을 `:root`(밝음)·`.dark`(어두움)에 추가. `.font-heading`에 `font-weight:700`과 `text-shadow` 추가(레이어 밖 일반 CSS라 Tailwind 유틸리티 `font-normal` 등을 항상 덮음 — 실측으로 확인, 34개 파일 중 어느 것도 개별 수정 불필요). 18px 이하(`.text-xs/.text-sm/.text-base`) 제목은 약한 그림자로. `.markdown-reading h1~h3`(글 본문 제목) 굵기 400→700, 그림자 추가. `text-grad-primary`(그라데이션 글자)는 `text-shadow:none`+`filter:drop-shadow(...)` 2겹으로 대체. `forced-colors:active`에서 전부 그림자 없음. |
| `src/app/admin/admin-theme.css` | `.admin-area`(및 포털 대화상자)에 `--heading-shadow:none`, `--heading-shadow-sm:none` 추가. 글꼴은 전역 변수를 그대로 물려받아 바뀐다. |
| `src/app/page.tsx`, `src/components/layout/page-hero.tsx`, `src/components/layout/highlight.tsx`, `src/components/admin/admin-shell.tsx`, `src/components/dashboard/stat-tile.tsx` | 주석의 "Jua"를 "제목 글꼴(G마켓 산스)"로 고침(기능·문구·색 변경 없음). |

`grep -rln "font-heading" src`로 나온 34개 파일을 모두 검토했지만, `.font-heading` 규칙 하나로 굵기·그림자가 일괄 적용되어(레이어 밖 CSS 우선순위) **개별 파일 수정이 필요 없었다**. 좁은 화면(320~375px) 넘침·어색한 줄바꿈·알약 속 세로 치우침도 실측 결과 전혀 없었다(§4 참고).

### 과학 앱 정본 → 23개 사본
| 파일 | 내용 |
|---|---|
| `scripts/templates/science-sim/persist.js`, `scripts/templates/science-guide/persist.js` | `fonts.gstatic.com` preconnect와 Jua Google Fonts `<link>` 제거. `../../fonts/gmarket-sans/gmarket-sans.css`(상대경로, id `ss-font-heading`)를 Pretendard 링크 뒤에 비차단으로 추가. 주석을 새 글꼴로 고침. try/catch 구조 유지. |
| `scripts/templates/science-sim/style-common.css`, `scripts/templates/science-guide/style-common.css` | `--ss-font-heading`을 `"Gmarket Sans", var(--ss-font)`로. 제목 그룹 선택자(`.ss-title` 등, science-guide는 `.sg-card-h` 포함)에 `font-weight:700`+`text-shadow:var(--ss-heading-shadow)` 추가. 작은 라벨(`.ss-q-num`, `.ss-submit-note-tag`, `.ss-skip-title` — 13~17px 배지·부제목)은 `--ss-heading-shadow-sm`로 약하게. `--ss-heading-shadow`/`-sm`를 `:root`(밝음)과 기존 `@media (prefers-color-scheme: dark)` 블록(어두움)에 추가(파일의 기존 다크모드 방식 그대로). `forced-colors:active`에서 그림자 없음. 되짚기 스피너 `!important`(다른 에이전트 작업, `.ss-ac-spin`)는 그대로 유지. 3D 장면·그래프·측정값·표는 손대지 않음. |

정본만 고친 뒤 실험 앱 20개(`sci-6-1-1-1~4, 6-1-2-1~5, 6-2-1-2~5, 6-2-2-1~4, 6-2-3-1~3`)와 조사 앱 3개(`sci-6-1-1-5, sci-6-1-1-6, sci-6-1-2-6`) 폴더의 `science-sim/`·`science-guide/`에 `persist.js`·`style-common.css`를 다시 복사했다. **`diff -r`로 23개 전부 정본과 100% 일치 확인**(차이 0건, 재확인 완료). 앱 고유 파일(`style.css`, `app.js` 등, 다른 에이전트가 고친 8개 포함)에는 Jua를 직접 쓴 곳이 없어 보고할 내용이 없다(예상대로).

문서 파일(`scripts/templates/science-{sim,guide}/README.md`)에는 옛 Jua/Google Fonts 설명이 남아 있다 — 지침이 지정한 수정 대상(`persist.js`, `style-common.css` 2개 파일)이 아니라 손대지 않았고, 후속 정리를 별도 작업으로 제안해 두었다(백그라운드 작업 큐에 추가).

## 2. 최종 그림자 값

**사이트**(`globals.css`, em 단위, `color-mix(in oklch, var(--primary) N%, transparent)`):
- 밝음: `0 0.05em 0 흰(90%), 0 0.16em 0.4em 보라(28%)`
- 어두움: `0 0.08em 0.3em 검정(70%), 0 0 0.5em 보라(25%)`
- 작은 제목(18px 이하 — 카드/대화상자 제목, 사이드바 응원 카드 등): 밝음 `0 0.04em 0 흰(85%), 0 0.08em 0.18em 보라(18%)` / 어두움 `0 0.05em 0.18em 검정(55%), 0 0 0.3em 보라(16%)`
- 그라데이션 글자(`text-grad-primary`): `drop-shadow` 2겹, 밝음 `흰(90%)+보라(32%)` / 어두움 `검정(55%)+보라(30%)`

**과학 앱**(`style-common.css`, 같은 비율을 `color-mix(in srgb, var(--ss-primary) N%, transparent)`로):
- 밝음: `0 0.05em 0 rgba(255,255,255,.9), 0 0.16em 0.4em 보라(28%)`
- 어두움: `0 0.08em 0.3em rgba(0,0,0,.7), 0 0 0.5em 보라(25%)`
- 작은 라벨(질문 번호·제출 배지 등): 밝음 28%→18%, 어두움 25%→16%(사이트와 같은 축소 비율)

지침이 준 출발값을 그대로 썼고, 화면에서 보고 추가로 조정하지 않았다(실측 결과 번짐·가독성 문제가 없었음, §4).

## 3. 확인 방법

`.supabase-ref` 첫 부분(값은 여기 적지 않음)으로 가짜 세션(서명 없는 JWT, 만료 1시간 뒤)을 만들어 `Page.addScriptToEvaluateOnNewDocument`로 localhost 출처에서만 `localStorage`에 심었다. 원격 디버깅 포트 **9342**의 나만의 headless Chrome(Node 24 전역 `WebSocket`으로 CDP 직접 사용, puppeteer 없음, 사용자 데이터 폴더는 스크래치 안)에서 `--host-resolver-rules="MAP *.supabase.co 127.0.0.1:9, MAP supabase.co 127.0.0.1:9"` + `--disable-web-security` + CDP `Fetch.enable`(`*supabase.co*` 패턴)로 실제 Supabase를 첫 로드부터 막고, `site_settings`(`login_required:false`), `profiles`(학생 `role:"user"`/관리자 확인 때 `role:"admin"`), `rpc/my_must_change_password`(`false`), `rpc/is_admin`(모드에 따라 `true`/`false` — 실측 중 필요성 발견, 아래 참고), `functions/v1/check-answer`(`{"ok":true,"verdict":"ok"}` — 형태도 실측 중 발견해 고침), `posts`/`community_posts`(가짜 글 1건, 제목을 일부러 길게 써서 줄바꿈도 같이 확인), 나머지는 지침대로 `GET→[]`(단일 응답이면 `null`)/`POST·PATCH→201 []`/`OPTIONS→204`로 응답했다. 실제 Gemini는 `check-answer` Edge Function 경유로만 호출되므로 위 차단에 포함된다.

**테스트 하네스에서 발견해 고친 것(사이트·과학 앱 코드 문제 아님, 전부 제 가짜 서버 로직 버그)**:
- `rpc/is_admin`이 boolean을 그대로 기대하는데(`data===true`) 지침 기본값(`POST→201 []`)만 쓰면 관리자 화면이 항상 "관리자만 접근할 수 있습니다"로 막혔다 → `is_admin` 전용 응답 추가.
- `check-answer` 응답이 `{"verdict":"ok"}`만으로는 클라이언트가 `res.data.ok===true`를 먼저 확인해 "응답 못 받음"으로 보고, "예상하기" 같은 엄격 단계에서 "다시 생각해 보기"로 낮춰 버려 다음 단계로 못 넘어갔다 → `{"ok":true,"verdict":"ok","message":""}`로 수정.
- `community_posts` 가짜 응답의 kind(board/game) 판별을 URL 문자열에 "game"이 포함되는지로 짰더니, 상세 조회 select절에 항상 들어가는 컬럼명 `game_path`/`game_size` 때문에 오탐해 자유게시판 글도 "글을 찾을 수 없어요"로 나왔다 → `kind=eq.xxx` 필터 유무로만 판별하도록 수정.

세 가지 모두 코드가 아니라 **내 확인 스크립트**의 문제였고, 고친 뒤에는 정상 동작을 직접 확인했다(아래 §4).

## 4. 화면별 확인 결과

### 사이트 — 52개 조합(경로 × 뷰포트 × 테마)
홈(전체 5뷰포트×2테마=10), 과학수업(학기→단원→차시, 320px 포함), 자유게시판·학습게임(목록·글쓰기), 글 보기(마크다운 제목 포함), 검색, 로그인(비로그인 모드), 내 학습 활동, 404, 관리자(대시보드·회원 관리, `role:admin`)를 1280×800/1024×768/768×1024/375×812/320×640, 밝음·어두움 조합으로 확인했다(320은 홈·과학수업). 페이지 안에서 `document.fonts`, `getComputedStyle` 기반 자동 확인(글꼴·굵기·그림자·대비·가로 넘침·아이콘-글자 수직정렬)과 스크린숏을 모두 남겼다.

**결과**: 52개 케이스 전부 오류 없음. `document.fonts`에 `Gmarket Sans`(weight 700, status loaded) 확인. 페이지 가로 스크롤 0건, 제목 요소 화면 밖 넘침 0건, 아이콘-글자 수직 어긋남(3px 초과) 0건. 관리자 화면 헤딩 12개 전부 `text-shadow:none` 확인(어두움 포함), 나머지 화면은 전부 그림자 있음(단, 관리자 화면에서도 상단바·사이드바는 전역 요소라 그림자가 남는데 — 이는 `.admin-area`가 관리자 콘텐츠 영역에만 걸리는 기존 구조 그대로이고 기존 `--primary`/`--ring` 관리자 톤도 상단바·사이드바에는 안 걸려 있어 일관된 동작이다, 버그 아님).

홈 히어로 제목("안녕하세요! 우리 반 배움터예요")은 화면 폭에 따라 2~3줄로 자연스럽게 접히고(예: 1280px 3줄, 768px 2줄, 375px 3줄) 어색한 한 글자 낙오·넘침은 없었다. 스크린숏: `home-d1280-light.png`, `home-d1280-dark.png`, `home-t768-light.png`, `home-m320-light.png` 등.

### 과학 앱
**sci-6-1-1-2**(실험, 지시약 분류), **sci-6-2-3-2**(실험, 전지 직렬연결·버저), **sci-6-1-1-5**(조사, 산·염기 이용 사례)를 예상하기 → 실험하기/조사하기 단계까지 진행했다. 세 앱 모두: 콘솔 오류 0건, `../../fonts/gmarket-sans/gmarket-sans.css`와 `GmarketSansBold.otf` 모두 200, 제목 요소(`.ss-stage-title` 등) `font-weight:700`·그림자 적용 확인. 스크린숏: `sci-sci-6-1-1-2-stage2.png`, `sci-sci-6-2-3-2-stage2.png`, `sci-sci-6-1-1-5-stage2.png`(밝음), `sci-sci-6-1-1-2-dark.png`(어두움), `sci-q-num-zoom.png`·`sci-title-zoom.png`(6배·3배 확대, 그림자 번짐 없음 확인).

**첫 화면이 글꼴 때문에 늦지 않는지**(sci-6-1-1-2, 캐시 끔): 글꼴 CSS·OTF 파일 요청을 각각 5초 붙잡아 둔 채로 열어도 첫 페인트 72~145ms, 화면 제목이 900ms 안에 이미 보임(그 시점엔 `document.fonts`가 아직 "loading" 상태 — 대체 글꼴로 먼저 그려짐). `window.load` 이벤트만 글꼴 로드를 기다려 늦게 뜨는데(동적으로 붙인 `<link>`의 정상적인 특성), 화면 렌더링에는 영향이 없다. 스크린숏: `sci-sci-6-1-1-2-fonthold-mid.png`(글꼴이 아직 로딩 중일 때 화면).

**글꼴을 아예 못 받는 경우**(사이트, 홈): `gmarket-sans.css` 요청 자체를 실패시켜도 첫 페인트 141ms, 모든 제목이 Pretendard 굵게(700)로 즉시 표시됨(`fontFaces:[]`로 Gmarket Sans가 아예 등록되지 않았음을 확인). 스크린숏: `font-blocked-home.png`.

## 5. 대비 실측(그림자 제외, 글자색↔바탕)

사이트: 52개 화면에서 `.font-heading`·마크다운 제목 311개 샘플을 canvas 기반 sRGB 변환(브라우저가 `getComputedStyle().color`를 `lab()`/`oklch()`로 돌려줘 정규식 파싱이 안 먹혀 canvas `fillStyle`→`getImageData`로 항상 sRGB로 구웠다) + 조상 배경 알파 합성(반투명 배경을 그대로 불투명으로 오인하는 첫 버전 버그를 고쳤다 — 예: `bg-primary/8` 카드를 "진보라 불투명"으로 잘못 읽어 대비 2~3:1로 나오던 것을 올바르게 합성해 7.76:1 이상으로 재확인)으로 측정: **최소 7.76:1, 최대 19.8:1, AA(4.5:1) 미달 0건.**

과학 앱(sci-6-1-1-2): 제목류(`.ss-title`, `.ss-stage-title`) 15.37~16.36:1(밝음), 16.04:1(어두움). 작은 라벨(`.ss-q-num`) 자동 측정은 배경이 `background-image` 그라데이션이라 도구가 배경을 못 읽어 낮게(약 1:1) 나왔는데, 이는 측정 한계이지 실제 문제가 아니다 — 파일 자체 주석에 이미 문서화된 값(흰 글자 대비 5.7:1/6.2:1, `--ss-primary`/`-primary-2`)과 확대 스크린숏(`sci-q-num-zoom.png`, 흰 글자가 선명하게 보임)으로 대신 확인했다. 색·배경은 이번에 손대지 않았으므로 이 값은 그대로 유효하다.

## 6. diff -r · lint · build

- `npm run lint`: 통과(경고 없음, 최종 수정 후 재확인).
- `npm run build`: 통과. `out/fonts/gmarket-sans/`에 `GmarketSansBold.otf`·`gmarket-sans.css`·`LICENSE-gmarket-sans-OFL.txt` 3개 확인, `.otf`는 `public/`의 원본과 md5 동일(무수정 확인). `out/index.html`에 `<link rel="stylesheet" href="/class1/fonts/gmarket-sans/gmarket-sans.css">` 확인.
- 과학 앱 `diff -r scripts/templates/science-sim ↔ public/apps/{20개 앱}/science-sim`, `diff -r scripts/templates/science-guide ↔ public/apps/{3개 앱}/science-guide`: **23개 전부 차이 0.**

## 7. Supabase 차단 기록

세션 전체(사이트 52케이스 + 과학 앱 확인)에서 가로챈 Supabase 요청 **777건**, 전부 프로젝트의 실제 ref 호스트로 나간 요청을 Fetch 도메인이 가로채 가짜로 응답한 것이며 실제 네트워크에는 도달하지 않았다. `Network.loadingFailed`(가로채지 못하고 실제로 실패한 요청) **0건** — 새어나간 시도가 없었다. `--host-resolver-rules`는 예비 방어선으로 계속 켜 두었지만 실제로 걸린 적은 없다(Fetch 패턴이 전부 잡음). 실제 Gemini API도 별도로 부른 적 없음(check-answer Edge Function 경유만 있고 전부 위 차단에 포함).

## 8. 확인하지 못한 것

- 실제 iPad·태블릿(터치, 실제 렌더링 엔진) — 전부 데스크톱 Chrome 헤드리스 에뮬레이션(뷰포트 크기만 바꿈).
- 실제 로그인 흐름(이메일/비밀번호, GitHub·Google OAuth) — 가짜 세션 토큰만 사용.
- 실제 느린 학교망 — 5초 지연은 CDP로 인위적으로 흉내 낸 것.
- 실험 앱 20개·조사 앱 3개 중 개별로 직접 열어본 것은 3개(sci-6-1-1-2, sci-6-2-3-2, sci-6-1-1-5)뿐이고, 나머지 20개는 "정본과 파일이 100% 동일"이라는 `diff -r` 결과로만 확인했다(공통 틀 CSS 변경이라 파일이 같으면 동작도 같다고 보는 것이 합리적이지만, 브라우저로 직접 본 것은 아니다).
- Chrome 외 다른 브라우저(Safari, Firefox 등).
- 그라데이션(`background-image`) 배경 위 흰 글자의 자동 대비 측정(도구 한계 — 육안·문서화된 값으로 대신 확인, §5).

## 스크린숏

스크래치 `redesign-5/shots/`에 64장 남겨 두었다(임시 스크립트·Chrome 프로필·로그는 정리함). 주요 파일: `home-{d1280,d1024,t768,m375,m320}-{light,dark}.png`, `sci-{home,term,unit,lesson}-*.png`, `board-*`, `login-*`, `admin-*`, `notfound-*`, `search-*`, `my-learning-*`, `post-view-*`, `games-list-*`, `font-blocked-home.png`, `sci-sci-6-1-1-2-fonthold-mid.png`, `sci-q-num-zoom.png`, `sci-title-zoom.png`.

## 절대 하지 않은 것(확인)

문항·안내 문구·과학 내용·저장 키·저장 구조·본문 글꼴(Pretendard)·색 체계는 바꾸지 않았다. 글꼴 파일은 `public/fonts/gmarket-sans/GmarketSansBold.otf`를 그대로 두고 새로 받거나 변환하지 않았다(md5 확인). git commit/push 없음. 실 DB 쓰기 없음. 실제 Supabase·Gemini 호출 없음(§7).
