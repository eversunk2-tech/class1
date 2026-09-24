# 작은 문제 3개 고치기 — Build 보고서 (2026-09-24)

지침: `docs/science/small-fix-2-instructions.md`. 범위 안 파일만 고쳤고, 문항·안내 글·측정 조건·저장 키·3D·2D 장면/그래프 색은 손대지 않았다. git commit/push, 실 DB 쓰기, 실제 Supabase·Gemini 호출 없음.

## 요약

| # | 문제 | 상태 |
|---|---|---|
| 1 | 움직임 줄이기에서 스피너가 멈춰 보임 | 합격 |
| 2 | 일부 앱 선택 표시에 남은 예전 파랑 | 합격(7곳 모두) |
| 3 | `sci-6-2-1-4` 기록하기 버튼이 아래 막대에 걸침 | 합격 |

## 1. 움직임 줄이기 스피너

**원인**: 정본 전역 규칙 `* { animation-duration: 0.01ms !important; }`(과학적 `!important`)이 되짚기 스피너 예외(`!important` 없음)를 항상 이겼다.

**고친 곳**:
* `scripts/templates/science-sim/style-common.css:524`
* `scripts/templates/science-guide/style-common.css:467`
* 전→후: `animation-duration: 2.4s;` → `animation-duration: 2.4s !important;`
* 두 정본을 실험 앱 20개(`public/apps/sci-*/science-sim/style-common.css`) · 조사 앱 3개(`sci-6-1-1-5`·`sci-6-1-1-6`·`sci-6-1-2-6`의 `science-guide/style-common.css`)에 그대로 복사. 정본의 다른 줄은 건드리지 않음.

**합격 기준 실측**(CDP `Emulation.setEmulatedMedia`로 `prefers-reduced-motion: reduce` 흉내):

| 앱 | 평소 | 움직임 줄이기 |
|---|---|---|
| sci-6-2-1-4 (science-sim) | 0.8s | **2.4s** |
| sci-6-1-1-1 (science-sim, 1학기 1단원 — 문항 그대로, 공통 틀만 갱신됨 확인용) | 0.8s | **2.4s** |
| sci-6-1-1-5 (science-guide) | 0.8s | **2.4s** |

추가로 sci-6-2-1-4에서 실제 되짚기 카드("답을 다시 확인하고 있어요…")를 로그인 상태로 직접 띄워(check-answer 응답을 3.5초 지연시켜 스피너를 붙잡음) 살아있는 DOM에서도 `getComputedStyle(...).animationDuration`이 `2.4s`임을 다시 확인했다(합성 요소가 아니라 실제 화면).
스크린숏: `fix1-live-spinner.png`.

## 2. 예전 파랑이 남은 선택 표시 7곳

`--ss-s1`(그래프 계열 색)이 마침 옛 primary 파랑과 같은 `#2f6fd6`라 자료 색과 혼동하지 않도록, 7곳 모두 CSS 변수 이름이 아니라 **정본 보라 팔레트의 계산된 값**으로 바꿨다. 두 가지 패턴으로 나뉜다.

* **A. 그 자리의 바탕이 원래도 테마를 안 타는 곳**(2D 홈판·정원판·초시계 HUD처럼 "모형"류라 밝음/어두움에도 항상 같은 색으로 고정): `var(--ss-primary...)`을 그대로 쓰면 어두움 모드에서 배경만 어두워지고 글자·주변은 그대로라 대비가 무너진다(예: `.plate2d`는 어두움에서도 `#dfe6ee` 고정, 글자 `#1f2733` 고정 — 실측 대비 약 1.05:1로 계산됨). 그래서 **정본 변수의 "밝음" 계산값을 고정 hex로** 넣어 그 자리와 마찬가지로 테마 불변으로 맞췄다.
* **B. 그 자리가 실제로 테마를 타는 곳**(계산기 "=" 키, `sci-6-2-2-2`의 2D SVG — `.d2-bg` 등이 어두움에서 실제로 바뀜을 확인함): `var(--ss-primary)`를 그대로 써서 밝음/어두움 모두 따라가게 했다.

| 앱 | 파일:행 | 전 | 후 | 패턴 |
|---|---|---|---|---|
| sci-6-1-1-2 | `style.css:44` | `border-color:#2f6fd6; background:#d6e4fb` | `border-color:#6c4dd6; background:#f5f3fc` | A(고정, `.plate2d` 항상 밝은 2D판) |
| sci-6-1-1-4 | `style.css:66` | 〃 | 〃 | A |
| sci-6-1-1-3 | `style.css:44`(`.p3-dish.is-sel`)·`51`(`.p3-plate-head.is-sel`) | 〃 | 〃 | A |
| sci-6-1-2-2 | `style.css:98`(`.g2-flower.is-from`) | `box-shadow: inset 0 0 0 3px #2f6fd6` | `#6c4dd6` | A(정원판 `.g2-board`도 테마 불변) |
| sci-6-1-2-5 | `style.css:22`(`.calc-key.is-eq`) | `background:#2f6fd6`(글자는 상속된 흰색 고정) | `background:var(--ss-primary); color:var(--ss-on-primary)` | B(계산기 몸체는 고정 어두움이지만 "=" 키만 정본 주색을 새로 씀 — 글자색도 함께 바꿔야 어두움에서 대비가 유지됨) |
| sci-6-1-2-4 | `style.css:35`(`.sw-hud.is-run`) | `border-color:#6ea0ff` | `border-color:#aa9dff`(정본 어두움 모드 `--ss-primary` 값) | A(초시계 HUD는 밝음/어두움 모두 반투명 짙은 남색 바탕 고정이라, 그 바탕과 대비가 큰 "밝은" 보라를 고정으로 씀) |
| sci-6-2-2-2 | `style.css:109`(`.d2-sel`) | `stroke:#2f6fd6` | `stroke:var(--ss-primary)` | B(`.d2-bg` 등 이 앱 2D 장면은 실제로 어두움 모드를 탐) |

`sci-6-1-2-4`의 `--tape-start:#2f6fd6`(줄자 눈금, `style.css:5`)는 지침대로 그대로 두었다(그대로 남아 있음을 재확인).

**합격 기준 실측**(밝음·어두움 모두, 계산):
* 선택 칸 글자 대비 — 예) sci-6-1-1-2 `#1f2733` on `#f5f3fc`: **13.7:1**(밝음·어두움 동일, 고정 팔레트라 두 모드 값이 같음)
* 선택 테두리 vs 주변 바탕(3:1 이상) — `#6c4dd6` vs `.plate2d` 계열 밝은 회청색들: **4.55~5.33:1**. `.sw-hud.is-run` 보라(`#aa9dff`) vs HUD 반투명 남색 바탕: 약 **4~7:1**(정확한 합성색은 장면마다 달라 범위로 추정, "확인하지 못한 것" 참고).
* 계산기 "=" 키: 밝음 `bg #6c4dd6`+흰 글자(정본 주석 "5.7:1"), 어두움 `bg #aa9dff`+글자 `#110d26`(정본 주석 "8.1:1") — CDP로 실제 `getComputedStyle` 찍어 확인함(아래).
* 가로 스크롤 없음, 산·염기 앱 선택 표시가 용액·지시약 색과 안 헷갈림(스크린숏으로 확인) — 선택 표시는 테두리·연한 바탕이고 용액·지시약 원 색은 그대로라 구별됨.
* 색만으로 구별하지 않음: 7곳 모두 테두리 두께(2~4px)·모양은 그대로, 색만 보라로 바뀜.

**계산기 실측**(표준 CSS 변수 값 검증용 별도 테스트 페이지 — 실제 `style-common.css`+`style.css`를 그대로 불러와 계산기 마크업만 재현, 앱 내용·동작은 바꾸지 않음, 스크래치에만 존재):
```
light: {"bg":"rgb(108, 77, 214)","color":"rgb(255, 255, 255)"}   // #6c4dd6 + 흰 글자
dark : {"bg":"rgb(170, 157, 255)","color":"rgb(17, 13, 38)"}      // #aa9dff + 짙은 보라 글자
```

**스크린숏**(모두 밝음·어두움 한 쌍씩, 실제 앱에서 예상하기 답을 적고 실험하기로 진입 → "2D로 보기"(있는 앱) → 실제 칸을 클릭/터치해 선택 상태를 만든 화면):
* `fix2-sci-6-1-1-2-light.png` / `-dark.png` — 2D 홈판 "푸른색 리트머스" 줄 선택
* `fix2-sci-6-1-1-3-light.png` / `-dark.png` — 접시 "달걀 껍데기" + 판 머리 "묽은 염산" 선택
* `fix2-sci-6-1-1-4-light.png` / `-dark.png` — 2D 홈판 줄 선택
* `fix2-sci-6-1-2-2-light.png` / `-dark.png` — 정원판 "유채꽃" 출발 표시
* `fix2-sci-6-1-2-4-light.png` / `-dark.png` — 초시계 HUD "재는 중" 테두리(자동차 출발! 버튼을 눌러 "재는 중" 순간을 직접 붙잡음)
* `fix2-sci-6-1-2-5-light.png` / `-dark.png` — 계산기 "=" 키(위 별도 테스트 페이지)
* `fix2-sci-6-2-2-2-light.png` / `-dark.png` — 2D 장면 보라 점선 선택 표시(양초 선택)

## 3. `sci-6-2-1-4` 기록하기 버튼이 아래 막대에 걸림

**원인 분석**: `.ss-exp-layout`은 1024×768(가로, 901px 이상)에서 2단 그리드다. 왼쪽 열(3D 무대)과 오른쪽 열(① 각도 카드 + ② 내 기록 카드 + 안전 수칙)은 서로 독립적으로 쌓이며, 기록하기 버튼의 세로 위치는 **오른쪽 열 안의 내용**(실험 방법 카드 열림 상태, 안내 줄, 카드 안 여백, 각도 슬라이더 줄 높이, 값 패널)만으로 정해진다. 실측 결과 오른쪽 열이 왼쪽 3D 무대보다 항상 더 길어서(예: 747.5px vs 534.2px) **3D 무대 높이를 줄여도 버튼 위치는 바뀌지 않는다** — 그래서 무대 높이(`.ss-exp-view`)는 그대로 두었다(지나치게 줄이지 않기 위해서이기도 함). 대신 오른쪽 열 안 여백·슬라이더 줄만 좁혔다.

**고친 곳**: `public/apps/sci-6-2-1-4/style.css:195-208`(새 미디어 쿼리, 이 앱 고유 파일에만 추가, 정본 불변)
```css
@media (min-width: 901px) and (orientation: landscape) and (max-height: 850px) {
  .ss-intro { padding-top: 5px; padding-bottom: 5px; margin-bottom: 5px; }   /* 전: 16/16/14 */
  .ss-lead { margin-bottom: 5px; }                                          /* 전: 14 */
  .ang-card { padding-top: 4px; }                                           /* 전: 14 */
  .ang-card .ss-step-h { margin-bottom: 2px; }
  .ang-how { margin-bottom: 3px; }
  .ang-track { padding-top: 46px; }                                        /* 전: 58 */
  .ang-snap { min-height: 44px; padding: 1px 6px; }                        /* 전: min-height 50 */
  .ang-snap-note { font-size: 0.64rem; }
  .ang-step { margin-top: 46px; }                                          /* 전: 58 */
  .ang-scale { margin-top: 0; }                                            /* 전: 2 */
  .val-grid { margin: 3px 0; }                                             /* 전: 10 */
  .val-tile { padding: 4px 4px; }                                          /* 전: 8px 4px */
}
```
`901px` 이상 + 가로 + 높이 `850px` 이하일 때만 적용 — 휴대폰(640 이하)·태블릿 세로(900 이하 또는 세로)·기존 큰 화면은 그대로다. 각도 눈금 버튼(`.ang-snap`)은 44px 터치 영역을 지켰다(그 아래로 줄이지 않음).

**합격 기준 실측**(기록하기 버튼 bottom, 아래 막대 top, 여유 = 막대 top − 버튼 bottom ≥ 8px):

| 화면 | 상태 | 버튼 bottom | 막대 top | 여유 | 판정 |
|---|---|---|---|---|---|
| 1024×768 | 체험 모드 | 640.6 | 699.0 | **12.4px → (여백 더 줄인 뒤) 30.4px** | 합격 |
| 1024×768 | 로그인 | — | 699.0 | **26.4px** | 합격 |
| 1180×820 | 체험 모드 | — | 751.0 | **82.4px** | 합격(여유 큼, 문제 없음) |
| 1180×820 | 로그인 | — | 751.0 | **78.4px** | 합격 |

*(표의 첫 줄은 1차 여백 조정 직후 값 12.4px였다가 실제 기기 렌더링 오차에 대비해 여백을 더 줄여 30.4px까지 올린 최종 값이다. 최종 CSS는 위 코드 블록과 같다.)*

3D 무대 높이: 조정 전후 모두 **476.2px**(`min(62vh,560px)`, 그대로 둠 — 위 원인 분석 참고).

**다른 화면 크기**(겹침·가로 스크롤·버튼 가림 없음 확인, `hasHScroll` 모두 false):

| 화면 | 스크롤 안 함(정상 동작: 기록하기가 화면 밖일 수 있음) | 기록하기로 스크롤한 뒤 여유 |
|---|---|---|
| 768×1024(세로, 1단) | 화면 밖(정상) | **+371.4px** |
| 375×812(휴대폰 세로) | 화면 밖(정상) | **+223.8px** |
| 812×375(휴대폰 가로, 한 화면에 다 안 들어가는 크기) | 화면 밖(정상, 지침상 허용) | **+69.4px** |

터치 영역 재확인(1024×768, 조정 후): `.ang-snap` 44×44, `.ang-step`(◀▶) 48×48, `.ang-range`(슬라이더) 48px 높이, 기록하기 버튼 385×56, 실험 방법 펼치기 44px — 모두 44px 이상 유지.

**스크린숏**(모두 `sci-6-2-1-4`, 예상하기 답을 적고 실험하기 진입 직후, 스크롤 안 한 상태 = "-noscroll", 기록하기로 스크롤한 뒤 = "-scrolled"):
* `fix3-1024x768-exp-noscroll.png` / `-scrolled.png` — 체험 모드
* `fix3-1024x768-login-noscroll.png` / `-scrolled.png` — 로그인 상태(가짜 세션)
* `fix3-1180x820-exp-noscroll.png` / `-scrolled.png`, `fix3-1180x820-login-noscroll.png` / `-scrolled.png`
* `fix3-768x1024-exp-noscroll.png` / `-scrolled.png`
* `fix3-375x812-exp-noscroll.png` / `-scrolled.png`
* `fix3-812x375-exp-noscroll.png` / `-scrolled.png`
* `fix3-slider-zoom.png` — 각도 눈금 버튼(30°·80°)과 슬라이더 사이 간격이 좁아졌지만 겹치지 않음을 확대로 확인

## 정본·앱 사본 일치 확인

`diff -r`(파일 내용 전체, style-common.css뿐 아니라 `science-sim/`·`science-guide/` 폴더 전체)로 정본과 23개 앱 사본을 비교 — **완전히 일치**(과학 실험 앱 20개 `science-sim/`, 조사 앱 3개 `science-guide/`). 명령과 결과는 이 세션에서 직접 실행해 확인했다(`diff -rq` 출력 0줄).

## lint

`npm run lint` — 통과(오류·경고 없음).

## Supabase 요청 차단 기록

* 첫 로드부터 `--host-resolver-rules="MAP *.supabase.co 127.0.0.1:9, MAP supabase.co 127.0.0.1:9"` + CDP `Fetch.enable`(패턴 `*supabase.co*`)로 모든 supabase 요청을 가짜 응답으로 처리했다(`site_settings`→`login_required:false`, `check-answer`→`{"ok":true,"verdict":"ok"}`, 나머지 GET→`[]`, POST/PATCH→201 `[]`, OPTIONS→204).
* 이번 작업 전체(23개 앱 로드, fix1·2·3 각 시나리오 40여 회 실행)에서 `Network.requestWillBeSent`로 잡은 supabase.co 요청은 모두 위 Fetch 인터셉터가 가로채 가짜 응답을 준 것이었고, `Network.loadingFailed`(실제 네트워크 요청 실패, 즉 호스트 차단이 실제로 작동한 경우를 재확인하려던 이벤트)는 최종 테스트 스위트(`test-fix3.js`, 7개 시나리오) 기준 **0건**이었다. 즉 가짜 응답으로 전부 처리됐고 실제 네트워크로 나간 뒤 막힌 요청은 관찰되지 않았다.
* 실제 Gemini(`check-answer`가 내부에서 부르는 것)는 애초에 `check-answer` 자체가 가짜 응답으로 가로채져 호출되지 않았다.
* 브라우저 콘솔 오류/예외: 이번에 고친 8개 앱(fix2 7개 + fix3 1개) 로드 시 0건.

## 확인하지 못한 것

* **실제 iPad/태블릿 렌더링**: 모두 헤드리스 Chrome(자기 전용, 포트 9341)로 확인했다. Pretendard·Jua 웹폰트는 실제로 CDN에서 불러와졌음을 확인했지만(둘 다 `document.fonts.check()` true), 실제 태블릿 브라우저·실제 터치 드래그·실제 화면 밀도에서 최종 여유(예: 1024×768 체험 모드 30.4px)가 그대로인지는 못 봤다. 여유를 처음 12.4px에서 30.4px로 더 늘려 놓은 것은 이 오차를 감안한 안전 마진이다.
* **`.sw-hud.is-run` 테두리 대비**: HUD 바탕이 3D 장면 위에 얹힌 반투명(`rgba(20,30,45,0.88)`) 색이라 실제 합성 배경색이 카메라 각도·장면 내용에 따라 조금씩 달라진다. 대비는 여러 배경 가정으로 계산해 3:1을 넉넉히 넘는 것을 확인했지만, 실제 렌더링 픽셀을 직접 찍어 재지는 못했다(스크린숏으로 육안 확인은 함 — `fix2-sci-6-1-2-4-*.png`).
* **1024×768 로그인 상태의 실제 헤더 높이**: 체험 모드보다 로그인 배너 줄("이메일로 로그인 중 · 로그아웃")이 길어 여유가 약간(4px 안팎) 더 빠듯하게 나왔다(그래도 26.4px로 충분). 실제 계정 이메일 길이에 따라 배너가 두 줄이 될 수 있는지는 확인하지 않았다.
* 위 세 가지 외에는 이번 세션에서 직접 실행·측정해 확인했다.

## 스크린숏·임시 파일 경로

스크린숏 30장: `/private/tmp/claude-501/-Users-sungchul-Desktop-classroom/7bf3a39e-3017-4189-b337-1b82aace66bb/scratchpad/small-fix-2/`(파일명은 위 각 절 참고). 테스트 스크립트(`cdp.js`·`page.js`·`test-*.js`·`calc-harness.html`)와 Chrome 사용자 데이터 폴더는 작업을 마치며 지웠고, 전용 headless Chrome(포트 9341) 프로세스도 종료했다(스크린숏 폴더만 남음).
