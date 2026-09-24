# 작은 문제 3개 고치기 — Build 지침 (2026-09-24)

사용자가 `docs/STATUS.md` "낮은 지적" 3개를 고치라고 했다. 근거 문서: `docs/design/redesign/review-34.md` §2 표(스피너·`sci-6-2-1-4` 두 줄), `docs/design/redesign/build-3-report.md` §8(예전 파랑 목록). 먼저 `CLAUDE.md`(특히 "과학 차시 앱 규칙", "서브에이전트 규칙")를 읽는다.

## 고쳐도 되는 파일(이 범위만)
* 정본 `scripts/templates/science-sim/style-common.css`, `scripts/templates/science-guide/style-common.css` — **스피너 규칙 줄만**. 고친 뒤 정본을 모든 앱 사본에 그대로 복사한다(실험 앱 20개 `public/apps/sci-*/science-sim/style-common.css`, 조사 앱 3개 `sci-6-1-1-5`·`sci-6-1-1-6`·`sci-6-1-2-6`의 `science-guide/style-common.css`). 정본의 다른 줄은 건드리지 않는다.
* 앱 고유 `style.css` 7개: `sci-6-1-1-2`, `sci-6-1-1-3`, `sci-6-1-1-4`, `sci-6-1-2-2`, `sci-6-1-2-4`, `sci-6-1-2-5`, `sci-6-2-2-2` — 아래 2번의 선택자만.
* `public/apps/sci-6-2-1-4/`의 `style.css`·`index.html`·`app.js` — 아래 3번만(되도록 `style.css`만으로).
* 보고서 `docs/science/small-fix-2-report.md`(새로 작성).

## 절대 하지 않는 것
* 문항·안내 글·과학 내용·측정 조건·저장 키(`:vN`)·저장 구조 변경. 1학기 1단원 앱과 2단원 탐구 1·2·6은 **겉모양만** 바꾼다.
* 3D·2D 장면·그래프·자료의 색 변경. 특히 이 파랑들은 **그대로 둔다**: `sci-6-1-2-4` `--tape-start`, `sci-6-2-1-4` `--ang`, `sci-6-2-1-5` `.o2-arrow`·`.o2-tag`, `sci-6-2-3-1` `.d2-battery`, `app.js` 안 3D 이름표 색.
* git commit/push, 실제 DB 쓰기, 실제 Supabase·Gemini 호출.

## 1. 움직임 줄이기에서 스피너가 멈춰 보임
* 원인: 정본 `style-common.css`의 전역 규칙 `@media (prefers-reduced-motion: reduce) { * { … animation-duration: 0.01ms !important; } }`가 되짚기 카드 스피너 예외 `@media (prefers-reduced-motion: reduce) { .ss-ac-spin { animation-duration: 2.4s; } }`(science-sim 524행, science-guide 467행)를 항상 이긴다(`!important`).
* 고치기: 예외 쪽에 `!important`를 붙여 "천천히 돌기(2.4초)"가 실제로 적용되게 한다(선택자 특이도가 `*`보다 높아 이긴다). 전역 규칙은 그대로 둔다.
* 합격: 움직임 줄이기를 흉내 낸 상태(CDP `Emulation.setEmulatedMedia`의 `prefers-reduced-motion: reduce`)에서 실험 앱 1개·조사 앱 1개의 `.ss-ac-spin` 계산값 `animation-duration`이 `2.4s`. 평소(흉내 없음)에는 `0.8s` 그대로.

## 2. 일부 앱 선택 표시에 남은 예전 파랑
공통 틀 부분은 보라인데 아래 앱 고유 규칙만 예전 파랑(`#2f6fd6`, `#d6e4fb`, `#6ea0ff`)을 직접 적어 두었다. 공통 틀 변수로 바꾼다.

| 앱 | 선택자 | 지금 |
|---|---|---|
| sci-6-1-1-2 | `.p2-col.is-sel, .p2-row.is-sel` | 테두리 `#2f6fd6`, 바탕 `#d6e4fb` |
| sci-6-1-1-4 | 같음 | 같음 |
| sci-6-1-1-3 | `.p3-dish.is-sel`, `.p3-plate-head.is-sel` | 같음 |
| sci-6-1-2-2 | `.g2-flower.is-from` | `box-shadow: inset 0 0 0 3px #2f6fd6` |
| sci-6-1-2-5 | `.calc-key.is-eq`(계산기 "=" 키) | 바탕 `#2f6fd6` |
| sci-6-1-2-4 | `.sw-hud.is-run` | 테두리 `#6ea0ff` |
| sci-6-2-2-2 | `.d2-sel`(2D 선택 점선) | `stroke: #2f6fd6` |

* 쓸 변수(정본에 이미 있음, 밝음/어두움 값이 자동으로 바뀜): `--ss-primary`, `--ss-primary-strong`, `--ss-primary-tint`, `--ss-primary-line`, 주색 바탕 위 글자는 `--ss-on-primary`(어두움에서는 짙은 색이다 — 흰 글자를 직접 쓰지 말 것). 그 앱의 다른 보라 선택 표시(예: 공통 틀 `.ss-` 선택 상태)와 같은 느낌으로 맞춘다.
* 계산기 "=" 키는 글자색도 함께 확인(어두움 모드에서 `--ss-primary` 바탕 + 흰 글자는 대비 부족).
* 산·염기 앱(`sci-6-1-1-2~4`)은 선택 바탕이 용액·지시약 색과 헷갈리지 않는지 본다(선택 표시는 머리칸·접시 테두리 쪽, 용액 색 자체는 바꾸지 않음).
* 합격: 밝음·어두움 모두 — 선택 칸 안 글자 대비 4.5:1 이상, 선택 테두리/점선과 주변 바탕 3:1 이상(색만으로 구별하지 않게 테두리 두께·모양은 유지), 가로 스크롤 없음. 바뀐 7곳 전후 스크린숏.

## 3. `sci-6-2-1-4` 실험하기 첫 화면에서 기록하기 버튼이 아래 막대에 걸침
* 재현(review-34.md): 태블릿 가로 1024×768, 로그인 상태로 열기 → 예상하기 답 작성 → 실험하기 진입 직후(스크롤 안 함) — 주 버튼 "📝 45° 기록하기"의 아래쪽 약 65px가 고정 아래 막대(`.ss-footer-nav`)에 가린다(버튼 bottom 763.6 > 막대 top 699). 스크롤하면 정상.
* 고치기: 이 앱 고유 파일에서, 태블릿 가로처럼 높이가 낮은 가로 화면일 때 실험하기 첫 화면에 기록하기 버튼까지 다 들어오게 한다. 예) 이 앱의 3D 무대 높이나 관찰 카드 안 여백·간격을 가로 화면에서만 조금 줄이기, 각도 슬라이더 줄을 더 촘촘히 배치하기. 3D 장면은 여전히 편하게 보이고 드래그할 수 있어야 한다(무대를 지나치게 줄이지 말 것 — 전후 높이를 보고서에 적기). 정본(공통 틀) JS/CSS는 이 문제로 바꾸지 않는다.
* 합격: 1024×768(로그인·체험 모드 둘 다)에서 실험하기 진입 직후 기록하기 버튼 bottom ≤ 아래 막대 top − 8px. 768×1024·375×812·812×375·1180×820에서 새 문제(겹침·가로 스크롤·버튼 가림) 없음. 휴대폰 가로(812×375)처럼 원래 한 화면에 다 안 들어가는 크기는 스크롤로 버튼이 다 보이면 된다.

## 테스트 방법(반드시)
* 개발 서버가 이미 `http://localhost:3000/class1/`에서 돌고 있다(`blog-dev`). 앱 주소 `http://localhost:3000/class1/apps/<앱>/`. 이 서버를 끄거나 새로 띄우지 않는다.
* **자기 전용 headless Chrome**(`/Applications/Google Chrome.app/Contents/MacOS/Google Chrome --headless=new`, 원격 디버깅 포트 **9341**, 사용자 데이터 폴더는 스크래치 안)만 쓴다. Node 24라 전역 `WebSocket`으로 CDP를 직접 쓸 수 있다(puppeteer 없음, 설치 금지).
* **실제 Supabase는 첫 로드부터 막는다**: Chrome 실행 인자 `--host-resolver-rules="MAP *.supabase.co 127.0.0.1:9, MAP supabase.co 127.0.0.1:9"`(새는 요청은 이 컴퓨터에서 실패) + `--disable-web-security` + CDP `Fetch.enable`(패턴 `*supabase.co*`)로 모든 요청에 가짜 응답: `site_settings` → `login_required:false`, `functions/v1/check-answer` → `{"verdict":"ok"}`, 나머지 GET → `[]`(Accept에 `vnd.pgrst.object`면 `null`), POST/PATCH → 201 빈 배열, OPTIONS → 204. `Network.loadingFailed`로 supabase 요청이 새지 않았는지 기록해 보고한다.
* 로그인 상태가 필요하면 `Page.addScriptToEvaluateOnNewDocument`로 localhost 출처에서만 localStorage `sb-<프로젝트ref>-auth-token`에 가짜 세션(만료 1시간 뒤, 서명 없는 JWT)을 넣는다. 프로젝트 ref는 `.env.local`의 `NEXT_PUBLIC_SUPABASE_URL` 호스트 첫 부분(값을 보고서·로그에 적지 않는다).
* `localStorage.clear()` 금지(필요하면 그 앱 `sci6…` 키만 지운다). 다른 탭·프로세스를 건드리지 않는다. 끝나면 Chrome을 종료하고 사용자 데이터 폴더·임시 파일을 지운다(스크린숏은 스크래치 `small-fix-2/` 폴더에 남겨 경로를 보고).
* 마지막에 `diff -r`로 정본과 23개 앱 사본이 같은지(`science-sim`, `science-guide`) 확인하고 결과를 보고한다. `npm run lint`도 돌린다.

## 보고서 `docs/science/small-fix-2-report.md`
바꾼 곳(파일:행, 전→후), 합격 기준별 실측값, 스크린숏 경로, supabase 요청 차단 기록, 확인하지 못한 것(실제 iPad 등)을 한국어로 짧게 적는다.
