# 디자인 개편 3단계 Build 보고서 — 과학 앱 공통 틀 겉모양 (2026-09-24)

지침: `build-3-instructions.md` / 설계: `spec.md` §6 + 끝 "개정 1"(과학 앱 글꼴은 CDN, 앱 23개 전부) / 규칙: `CLAUDE.md` 과학 차시 앱 규칙.

> **개정 1(이 문서 끝)이 §5·§10-1보다 우선한다**: 글꼴 CSS를 `@import` 대신 `persist.js`가 `<link>`로 붙이게 바꿨고(첫 화면을 막지 않음, 유일한 JS 변경), `sci-6-1-2-5` 계산기 "÷" 키 대비를 고쳤다.

* **CSS만 바꿨다**(+ 두 README의 디자인 설명). JS·HTML·앱 고유 파일(`app.js`, `index.html`, `style.css`, `data/`), 저장 키(`:vN`)·저장 구조·측정값·문구는 하나도 바꾸지 않았다(체크섬으로 확인, §6).
* git으로 아무것도 바꾸지 않았다(커밋·스테이징 없음). 바뀐 파일 목록을 보려고 읽기 전용 `git status --short`를 한 번 실행한 것이 전부다.
* 실 DB 쓰기 없음: Supabase 요청은 모두 내 브라우저 안에서 가짜 응답(가짜 학생 세션, 가짜 `app_progress`·`app_results`·`check-answer`)으로 처리했다. 조작용 창이 가로채기 없이 남아 있던 시간이 있어(§10-7) 그 뒤로는 내 Chrome이 실제 Supabase 주소에 아예 접속하지 못하게 막고(`--host-resolver-rules`, 막힘 확인) 검증을 다시 돌렸다.
* 내 전용 headless Chrome(CDP 9633, 새 프로필) + 내 정적 서버(8633) + 조작용 로컬 제어(8634)만 썼고 끝나고 모두 종료했다. `localStorage.clear()`는 쓰지 않았다(`sci6…` 키와 가짜 세션 키만 지움). 이미지는 새로 받지 않았다.

---

## 1. 결과 요약

사이트(1·2단계)와 같은 인상으로 23개 과학 앱의 **색·글꼴·버튼·카드·단계 막대 모양**을 바꿨다.

* **주색 보라**(사이트 `--primary`와 같은 값), 페이지 위쪽 **연보라 그라데이션 + 가장자리 흐린 보라 빛**, 머리말·아래 막대는 **반투명 유리**.
* **알약 버튼**: 주 버튼(다음 단계·실행·기록하기·학습 마치기·확인하기·제출)은 보라 그라데이션 + 색 그림자, 보조 버튼은 흰 알약. 촘촘한 선택 격자(보기·조건 고르기·기록 칸)는 둥근 사각형 그대로.
* **단계 막대**: 지금 단계 = 보라 그라데이션 + 굵은 글자 + 아래 작은 막대 표시(색만으로 구분하지 않음). 완료 = 초록 ✓, 잠김 = 점선.
* **카드 톤 통일**: 카드(20px 모서리·옅은 보라 그림자), 관찰·기록 카드(보라 테두리), 되짚기 카드, 제출 안내, 마치기·완료 카드, 로그인 안내 가림막.
* **글꼴**: 본문 Pretendard, 제목 Jua(CDN). 측정값·표·입력칸은 Pretendard(`tabular-nums`). CDN을 못 쓰면 기기 기본 글꼴로 정상 동작.
* **바꾸지 않은 것**: 그래프·표 자료 계열 색(전/후 실제 색 비교로 확인), 3D·2D 실험 화면(바탕·모서리, 장식 없음), 빨강·노랑·주황 의미색, 크기·여백·레이아웃.
* **대비**: 전에 AA에 못 미치던 초록 글자(3.9:1)·흰 ✓(4.4:1, 어두움 1.9:1)·조사 앱 링크(4.3:1)를 AA로 올렸다. 새 조합 계산·화면 실측 모두 미달 0(앱 고유 계산기 "÷" 키 1곳은 기존 문제, §8).
* **검증**: 앱 6개를 **끝까지** 36번(6개 × 태블릿 가로·세로·375·812×375·어두움 2가지) 진행 — 36번 모두 완료, 콘솔 오류 0, 실패 요청 0, 가로 스크롤 0, '기록하기' 가림 0/252. 23개 앱 모두 두 번째 단계(실험하기·조사하기)까지 4가지 화면에서 점검.

## 2. 바꾼 파일

| 파일 | 내용 |
|---|---|
| `scripts/templates/science-sim/style-common.css` | 새 디자인(정본) |
| `scripts/templates/science-guide/style-common.css` | 같은 디자인. 레이아웃은 조사 도우미 판 그대로(공통 틀 수정 1의 낮은 화면·아래 여백 규칙과 실험 전용 규칙은 넣지 않음 — 전과 같음) |
| `scripts/templates/science-sim/README.md` | "디자인" 절 추가(변수·버튼·단계 막대·글꼴 CDN·바꾸지 않는 것·새 앱 style.css 규칙), 파일 표 한 줄, 외부 라이브러리 규칙에 글꼴 CSS 예외 |
| `scripts/templates/science-guide/README.md` | `style-common.css`를 "같음"→"디자인 같음(레이아웃 차이)"로 바로잡음(전부터 실제로는 달랐다), 통째 복사하지 말라는 안내, 디자인 한 줄, 글꼴 CSS 예외 |
| `public/apps/sci-*/science-sim/{style-common.css, README.md}` (20개 앱) | 정본 사본 |
| `public/apps/sci-*/science-guide/{style-common.css, README.md}` (3개 앱) | 정본 사본 |

작업 전/후 체크섬(`public/apps` + `scripts/templates`의 파일 711개): **바뀐 파일은 위 50개뿐**(`style-common.css` 25개, `README.md` 25개).

## 3. 바꾼 변수 (밝음 / 어두움)

| 변수 | 전 | 후 |
|---|---|---|
| `--ss-primary` | `#2f6fd6` / `#6ea0ff` | **`#6c4dd6` / `#aa9dff`** = 사이트 `--primary`(oklch 0.53 0.2 288 / 0.75 0.15 288) |
| `--ss-primary-2` (신규) | — | `#9033bd` / `#d698f1` = 사이트 `--primary-grad-to` |
| `--ss-grad-primary` (신규) | — | `linear-gradient(120deg, primary → primary-2)` |
| `--ss-primary-strong` | `#1f56b0` / `#8fb5ff` | `#5935be` / `#c0b8ff` |
| `--ss-on-primary` | `#ffffff` / `#0d1422` | `#ffffff` / `#110d26` (사이트 `--primary-foreground`) |
| `--ss-primary-tint` · `--ss-primary-line` · `--ss-hint-line` (신규) | — | `#f5f3fc` · `#9e8ddf` · `#e5c59b` / `#232131` · `#7870ac` · `#8d6b42` (주색 7%·55%, 주황 45%를 미리 계산) |
| `--ss-focus` (신규) | (초점은 `--ss-accent` 주황) | `#6c4dd6` / `#c0b8ff` |
| `--ss-bg` | `#f6f8fb` / `#11161f` | `#f6f6fc` / `#0f0e15` |
| `--ss-bg-top` · `--ss-bg-blob` (신규) | — | `#efedff` · 보라 10% / `#1a172e` · 보라 8% |
| `--ss-surface` | `#ffffff` / `#19202c` | `#ffffff` / `#191821` |
| `--ss-surface-2` | `#eef2f7` / `#222b3a` | `#efeff9` / `#262530` |
| `--ss-text` | `#1f2733` / `#e8edf4` | `#1e1d2d` / `#eaeaf2` |
| `--ss-muted` | `#5b6676` / `#a6b1c2` | `#5b5c6e` / `#b0afc1` |
| `--ss-border` | `#d7dee8` / `#313c4f` | `#dbdbe9` / `#3a3947` |
| `--ss-good` | `#1d8a52` / `#5fd394` | **`#17784a`** / `#5fd394` (밝음만 AA 맞춤, 같은 초록) |
| `--ss-radius` | `16px` | `20px` |
| `--ss-shadow` | 무채 그림자 | 옅은 보라 그림자(어두움은 무채) |
| `--ss-shadow-sm` · `--ss-shadow-brand` · `--ss-glass` (신규) | — | 작은 그림자 · 주 버튼 보라 빛 · 머리말/막대 반투명(`rgba`) |
| `--ss-font` | `system-ui, …` | `"Pretendard Variable", Pretendard, system-ui, -apple-system, "Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", sans-serif` |
| `--ss-font-heading` (신규) | — | `"Jua", var(--ss-font)` |
| **그대로** | `--ss-accent`, `--ss-bad`, `--ss-bad-bg`, `--ss-good-bg`, `--ss-warn-bg`, `--ss-s1~s4`(그래프 계열), `--ss-scene-bg`(실험 화면 바탕), `--ss-header-h`, `--ss-footer-h` | |

* 새로 넣은 핵심 모양(제출 안내·관찰 카드·마치기 카드·힌트 카드의 테두리와 바탕, 머리말·아래 막대 바탕)은 `color-mix()` 없이 미리 계산한 색을 쓴다 → `color-mix()`를 모르는 옛 Safari(16.2 전)에서도 테두리·바탕이 사라지지 않는다. hover·초점 둘레·선택 틴트 같은 보조 효과(원래 파일도 쓰던 것)만 `color-mix()`.

## 4. 바꾼 규칙

* **바탕**: `html`·`body`에 `--ss-bg`, `body`에 위쪽 연보라 그라데이션(26rem) + 가장자리 흐린 보라 빛 2개(움직임·이미지 없음).
* **머리말**(`.ss-header`)·**아래 막대**(`.ss-footer-nav`): 반투명 유리(`--ss-glass` + blur) + 옅은 보라 그림자. 높이·여백·낮은 화면 규칙 그대로.
* **돌아가기**(`.ss-back`): 흰 알약 + 얇은 테두리 + 작은 그림자.
* **제목 글꼴(Jua)**: `.ss-title`, `.ss-stage-title`, `.ss-step-h`, `.ss-sorter-title`, `.ss-rounds-title`, `.ss-skip-title`, `.ss-ac-title`, `.ss-q-num`, `.ss-submit-note-tag`, `.done-card h3`, `.ss-gate-card h2`, `h3.sub-h`(+ 조사 도우미 `.sg-card-h`). `font-synthesis: none` + 굵기 700 유지(Jua를 못 불러오면 대체 글꼴이 굵게 그림). 차시 제목 위 학년·단원 줄(`.ss-title small`)은 Pretendard.
* **단계 제목**(`.ss-stage-title`): 1.35→1.45rem + 앞에 보라 그라데이션 세로 막대(장식). 낮은 화면은 전과 같은 1.15rem.
* **단계 막대**(`.ss-step`): 연보라 알약(좁은 화면 16px), 번호는 흰 원. 지금 단계 = 보라 그라데이션 + 글자 800 + 아래 막대(`::after`, 낮은 화면 3px). 완료 번호 = 초록 원 + `--ss-on-primary` ✓(어두움에서 흰 ✓ 1.9:1 → 10.1:1). 잠김 = 투명 + 점선 + 전과 같은 0.55. 크기(48/54/36px) 그대로.
* **버튼**(`.ss-btn`): 모서리 28px(높이 56px까지 완전한 알약, 두 줄이면 둥근 사각형), 흰 바탕 + 작은 그림자, 테두리 2px 그대로. 주 버튼은 보라 그라데이션(`background-origin: border-box`) + 보라 빛. `a.ss-btn`도 같은 모양. 비활성은 전처럼 0.5 + 그림자 없음. hover는 `(hover: hover)` 기기에서만(주 버튼 1px 떠오름), 누르면 0.98배, 움직임 줄이기면 transform 없음.
* **카드**: `.ss-card` 20px + 옅은 보라 그림자. `.ss-observe`(관찰·기록 카드) 보라 테두리 + 위쪽 옅은 보라. `.ss-hints` 주황 테두리. `.ss-card.finish-card` 위쪽 옅은 보라, `.ss-card.done-card` 초록 테두리 + 초록→흰 그라데이션 + Jua 제목(모든 앱 index.html에 있는 공통 클래스라 모양만 맞춤).
* **되짚기 카드**(`.ss-ac-*`): 18px + 작은 그림자, 기다림 줄은 알약. 노랑(되짚기)·빨강(차단) 그대로.
* **제출 안내**(`.ss-submit-note`): 옅은 보라 바탕 + 보라 테두리, 앞머리표는 보라 그라데이션 알약(완료 초록·안 됨 빨강 그대로).
* **입력칸**: 초점 때 보라 테두리 + 옅은 보라 둘레 4px. 글 입력칸 모서리 12→14px.
* **키보드 초점**: `:focus-visible` 3px `--ss-focus` + 2px 띄움(전: 주황, 흰 바탕 대비 2.0:1 → 보라 5.3:1 / 어두움 10.6:1).
* **알림**(`.ss-toast`): 짙은 남보라 + 18px. `pointer-events: none` 그대로.
* **로그인 안내·불러오는 중 가림막**(persist.js가 넣는 `.ss-gate`): 바탕만 연보라 그라데이션(`body > .ss-gate`), 제목 Jua. 카드·버튼은 변수로 자동.
* **그래프**: 계열 표시가 없는 `.ss-bar/.ss-line/.ss-dot` 기본색을 `--ss-primary` → `--ss-s1`(전과 같은 파랑)로 — 주색이 보라가 되어도 자료 색이 따라 바뀌지 않게. 실제로는 표·그래프 모듈이 늘 `ss-sN`을 붙이므로 화면 변화 없음.
* **실험 화면 칸**(`.ss-exp-view`): 모서리 16px 고정, 무채 1px 그림자(색 그림자·그라데이션 없음), 바탕 `--ss-scene-bg` 그대로. 모형 배지·도움말·카운트다운 그대로.
* 기타: 선택 격자(`.ss-choice`·`.ss-option` 12px, `.ss-mini-cell` 8px) 그대로, 라운드 탭 14px, 분류 칸 16px, 비교 칸 14px, 진행 막대 채움은 보라 그라데이션.

## 5. 글꼴(CDN)

* `style-common.css` 맨 위 `@import` 두 줄(앱 index.html은 그대로):
  * Pretendard: `https://cdn.jsdelivr.net/npm/pretendard@1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.css` — **버전 고정**. 사이트가 쓰는 npm 패키지(`pretendard@1.3.9`)와 같은 파일(`font-display: swap`, 글자 범위별 조각만 받음).
  * Jua: `https://fonts.googleapis.com/css2?family=Jua&display=swap` — Google Fonts는 버전을 고정하는 주소가 없다(응답 속 글꼴 파일은 `v18`).
* **실제로 그려진 글꼴**(CDP `CSS.getPlatformFontsForNode`, 사본 그대로): 차시 제목·단계 제목·질문 번호 = `Jua(web)`, 질문·도움말·버튼·단계 이름 = `Pretendard Variable(web)` — 실험 앱(`sci-6-2-2-3`)·조사 앱(`sci-6-1-1-5`) 모두.
* **처음 받는 양**(캐시 없음, 첫 화면): Pretendard CSS 13KB + 글꼴 조각 약 281KB, Jua CSS 12KB + 조각 약 102~121KB. 같은 사이트 안에서는 앱을 바꿔도 캐시를 다시 쓴다.
* **첫 화면이 그려지는 때**(FCP, 캐시 없음, 이 사무실 회선): 전 44~48ms → 후 232~248ms(개발 중 측정 128~440ms). `@import`한 CSS 2개를 받은 뒤에 그린다.
* **CDN을 막았을 때**(요청 즉시 실패 흉내): FCP 40~56ms, 글꼴은 `Apple SD Gothic Neo` + `.SF NS`(맥 기본 글꼴)로 대체, JS 오류 0. **끝까지 흐름 3번**(`sci-6-2-3-2` 태블릿, `sci-6-1-1-5` 태블릿, `sci-6-2-1-2` 375)이 모두 완료·저장됐다(콘솔에는 막힌 글꼴 CSS 2건의 "Failed to load resource"만).
* **CDN이 응답 없이 걸려 있을 때**(6초 뒤 실패 흉내): **FCP 6,068ms** — `@import`는 첫 화면을 막는다. §10-1 참고.

## 6. 동기화 확인

* 정본 → 23개 앱 사본 복사(최종본은 같은 폴더에 임시 파일로 쓴 뒤 이름 바꾸기로 교체 — 남은 임시 파일 0).
* `diff -r scripts/templates/science-sim public/apps/<앱>/science-sim`(20개), `diff -r scripts/templates/science-guide public/apps/<앱>/science-guide`(3개) → **23개 모두 차이 없음**.
* 작업 전/후 체크섬: 바뀐 파일 50개가 모두 §2 목록(그 밖의 661개 파일은 그대로).
* CSS 문법: `lightningcss`(오류 복구 끔)·`postcss`로 두 파일 모두 오류·경고 0. 선택자 비교: 원래 선택자는 하나도 빠지지 않았다(추가만).
* `science-sim`과 `science-guide`의 `style-common.css` 차이는 머리 주석, `--ss-footer-h`, 조사 앱 `.sg-card-h`, 그리고 원래부터 달랐던 레이아웃 규칙(낮은 화면 블록·아래 여백·실험 전용 규칙)뿐이다.

## 7. 검증

모두 내 headless Chrome에서, 사본(`public/apps/…`)을 그대로 띄워 확인했다(전/후 비교용 "전"은 원래 `style-common.css`만 바꿔 끼운 같은 앱). 화면: 태블릿 가로 1024×768(tl)·세로 768×1024(tp), 휴대폰 375×812(m, 2배 해상도), 휴대폰 가로 812×375(ml), 어두움(tl·m). 태블릿·휴대폰은 터치 기기로 흉내(hover 없음).

### 7.1 앱 6개 끝까지 (36번, 모두 완료)

| 앱 | 지나간 단계(실제 버튼·입력) | 6가지 화면 |
|---|---|---|
| `sci-6-1-1-1` (이전 기준) | 예상 2문항 → 관찰 23칸(묽은 염산 냄새 "안전" 칸 확인) → 내 분류 기준 2칸·분류 기준 고르기·3기준 분류(칩→칸) → 결론+발전 2 → 궁금한 점 → 마치기 | 6/6 완료(147~163초) |
| `sci-6-1-2-5` | 파랑·초록 자동차 출발 → 눈금 읽기 → 계산기 → 기록 → 분석 2문항(오답 포함) → 결론 → 마치기 | 6/6 |
| `sci-6-2-1-2` (시간 바) | 9:30~15:30 눈금 7개 기록 + 시간 바 키보드 → 표·그래프 3개 → 분석 2문항 → 마치기 | 6/6 |
| `sci-6-2-2-3` | ㉠·㉡ 촛불(시간 바 끝까지) → 오답·정답 확인 → 성냥 머리·나무 → 분석 → 마치기 | 6/6 |
| `sci-6-2-3-2` (소리·팝업) | 전구·전동기·버저 × 전지 1·2개 6칸(오답 포함) → '더 탐구해 보고 싶어요' 팝업 열기·Esc로 닫기, '소리 끄기' 버튼 확인 → 분석 → 정리 → 궁금한 점 → 마치기 | 6/6 |
| `sci-6-1-1-5` (조사) | 도입 2문항·힌트 → 정리 틀 3줄(산성·염기성) → 예시 비교 → 발표 대본·알게 된 점 → 정리 질문 4(오답 포함) + 결론·발전 2 → 궁금한 점 → 마치기 | 6/6 |

* 36번 모두: 완료 결과 1건 저장(가짜 응답, `completed: true`, 새 기준 앱은 `detail.qa` 6항목 — 전과 같음), **콘솔 오류 0, 실패 요청 0, 가로 스크롤 0, 화면 밖으로 튀어나온 요소 0**.
* **'기록하기'가 아래 막대에 가림 0/252**(기록 252번). `sci-6-2-2-3` ㉡ 칸은 휴대폰에서 확인 직후 0.1초쯤 막대 밑에 있다가 앱의 자동 스크롤(공통 틀 수정 1)로 막대 위로 올라온다(전과 같은 동작).
* 되짚기 카드(차단·되짚기), 로그인 안내 가림막, 체험 모드 안내 줄도 밝음·어두움에서 확인(스크린숏 §9).
* 움직임 줄이기 켜고 `sci-6-2-1-2` 끝까지: 완료, 오류 0.
* 뒤 두 앱(`sci-6-2-2-3`, `sci-6-2-3-2`)은 최종 CSS(§3의 미리 계산한 색)로 6가지 화면을 한 번 더 돌렸다 — 같은 결과.

### 7.2 23개 앱 두 번째 단계까지

tl·m·tl 어두움·ml 네 가지에서 23개 앱 모두 첫 단계를 채우고 **실험하기(실험 앱 20개, 3D 캔버스 있음) / 조사하기(조사 앱 3개)**로 넘어갔다. 가로 스크롤 0, 튀어나온 요소 0, 대비 미달 0, 콘솔 오류 0. 머리말 높이: 태블릿 165px, 휴대폰 223~258px(제목 길이), 휴대폰 가로 116px(조사 앱은 전과 같이 165px).
(`sci-6-1-1-6`은 앱 규칙상 '생각 다 적었어요'와 주제 고르기를 해야 넘어가서 시험 스크립트에 그 두 동작을 넣고 확인했다.)

### 7.3 앞서 고친 레이아웃·접근성

| 항목 | 결과 |
|---|---|
| 휴대폰 가로(812×375) 머리말/아래 막대/단계 버튼 높이 | 전 116/63/36px = 후 116/63/36px (실험 앱 3개), 조사 앱 165/69/48 = 같음 |
| 태블릿·휴대폰 머리말/막대 높이 | 1024×768·768×1024: 165/69 = 같음, 375×812: 223/69 = 같음 |
| 알림 `pointer-events` | `none` 그대로. 알림 한가운데 아래 요소 = 본문 질문(알림이 누르기를 막지 않음) |
| 44px 터치 영역 | 전/후 "44px 미만" 목록이 같다(낮은 화면의 기존 맞바꿈 — 돌아가기 36px·로그아웃 30~40px·기록 칸 40px — 만 있고 새로 생긴 것 0). 폭만 ±1~2px(돌아가기 테두리 1px) |
| 움직임 줄이기 | 보통: 주 버튼 hover 1px 떠오름, 0.15초 / 줄이기: transform 없음, 전환 0.01ms |
| 키보드 초점 | Tab 39번(실험하기 화면까지) 모두 초점 표시 있음(밝음·어두움). '다음 단계' 3px `rgb(108,77,214)` / 어두움 `rgb(192,184,255)`, 2px 띄움 |
| 그래프 자료 색 | `sci-6-2-1-2`(꺾은선 3개)·`sci-6-1-2-5`(막대) 분석 화면의 모든 선·점·막대 실제 색(fill/stroke)이 전/후 **같다**(밝음·어두움). 격자·축·눈금 글자만 새 무채색으로 아주 조금 바뀜(예: 격자 `#d7dee8`→`#dbdbe9`), 어두움의 점 테두리는 카드 바탕색을 따라 `#19202c`→`#191821` |

### 7.4 대비(WCAG AA)

**새 색 조합(계산)**

| 조합 | 밝음 | 어두움 |
|---|---|---|
| 본문 글자 / 바탕·위쪽 연보라·카드·연보라 칸 | 15.4 · 14.4 · 16.6 · 14.5 | 16.0 · 14.6 · 14.7 · 12.6 |
| 흐린 글자 / 같은 바탕들 | 6.1 · 5.7 · 6.6 · 5.7 | 8.9 · 8.1 · 8.2 · 7.0 |
| 주 버튼·지금 단계 글자 / 그라데이션 양 끝 | 5.7 · 6.2 | 8.1 · 8.7 |
| 보라 글자(링크·①②·번호) / 카드(연보라 칸) | 5.7 (5.0) | 7.5 (6.5) |
| 제출 안내·관찰 카드 위쪽 / 선택한 보기 틴트 위 글자 | 15.1 / 13.5 | 13.2 / 11.5 |
| 초록 글자 / 옅은 초록(맞았어요·저장됨·기록한 칸) | **4.9** (전 3.9) | 7.4 |
| 완료 ✓·"제출 완료" / 초록 | **5.5** (전 4.4) | **10.1** (전 흰 ✓ 1.9) |
| 빨강 글자 / 옅은 빨강 | 4.6 | 6.7 |
| 본문 / 노랑(힌트·되짚기) | 15.4 | 10.8 |
| 초점 테두리 / 바탕(3:1 이상) | 5.3 | 10.6 |
| 알림 | 16.6 | 16.0 |

**화면 실측(DOM 계산)**: 체크포인트마다 화면에 보이는 모든 글자의 실제 글자색과 그 뒤 바탕(조상 배경 합성, 그라데이션이면 양 끝 색 모두)을 비교했다.
* 후: 36번 흐름, 글자 12,402개 확인 → 미달 5건, **모두 앱 고유 계산기 "÷" 키**(`sci-6-1-2-5` `style.css`의 흰 글자 on `#d9822b` 2.93:1, 큰 글자 기준 3.0 — 전에도 같음, §8). 23개 앱 두 번째 단계·되짚기 카드·체험 줄·로그인 가림막: 미달 0.
* 전(같은 방식, 24번): 미달 781건(같은 요소가 체크포인트마다 반복) — 종류는 초록 글자 3.89(맞았어요·저장됨·기록한 칸), 흰 ✓·"제출 완료" 4.37, 어두움 흰 ✓ 1.87, 조사 앱 "에듀넷 ↗(새 창)" 링크 4.28, 계산기 "÷" 2.93. 계산기 말고는 모두 이번에 해결.

## 8. 앱 고유 파일이 공통 틀 색을 덮거나 직접 쓰는 곳 (고치지 않음, 목록만)

**공통 틀 변수를 앱에서 다시 정의하는 곳 — 그래프 계열 색만**(이번에 계열 색을 바꾸지 않았으므로 영향 없음, 색 그대로):
* `sci-6-1-2-3` `.chart-card { --ss-s1, --ss-s2 }`, `sci-6-1-2-4` `.chart-card`, `sci-6-2-1-2` `.chart-solar/.chart-shadow/.chart-temp { --ss-s1 }`, `sci-6-2-1-4` `.chart-card { --ss-s1 }`, `sci-6-2-1-5` `.chart-card` (+ 각 다크 값).
* 주색·바탕·글자·글꼴 변수(`--ss-primary`, `--ss-bg`, `--ss-font` …)를 다시 정의하는 앱은 **없다** → 23개 앱 모두 새 색·글꼴이 적용된다.

**예전 파랑을 직접 적어 두어 보라로 바뀌지 않는 UI 강조**(선택 표시 등, 같은 화면의 공통 틀 부분은 보라):
* `sci-6-1-1-2` `.p2-col/.p2-row.is-sel`, `sci-6-1-1-3` `.p3-dish.is-sel`·`.p3-plate-head.is-sel`, `sci-6-1-1-4` `.p2-col/.p2-row.is-sel` (`#2f6fd6` 테두리 + `#d6e4fb` 바탕)
* `sci-6-1-2-2` `.g2-flower.is-from`, `sci-6-1-2-5` `.calc-key.is-eq`(계산기 "=" 키), `sci-6-2-2-2` `.d2-sel`(2D 선택 점선), `sci-6-1-2-4` `.sw-hud.is-run`(`#6ea0ff`)

**3D·2D 장면·자료 색으로 쓰는 파랑(바꾸지 않는 것이 맞음)**: `sci-6-1-2-4` `--tape-start`, `sci-6-2-1-4` `--ang`(각도), `sci-6-2-1-5` `.o2-arrow/.o2-tag`, `sci-6-2-3-1` `.d2-battery`, 3D 이름표 테두리(`app.js`: `sci-6-1-2-4`, `sci-6-2-1-5`, `sci-6-2-2-3`).

**`var(--ss-primary)`를 써서 이제 보라로 보이는 앱 고유 요소**(의도대로 따라옴): 선택 표시·안내 테두리 다수(`.b2-pick.is-sel`, `.month-btn.is-next`, `.tb-tick.is-next`, `.know-card`, `.concept-card` 등)와 2D 대체 화면의 `sci-6-2-2-1` `.d2-focus`, `sci-6-2-3-3` `.s2-comp.is-on`, `sci-6-2-3-2` `.d2-wave`·`.d2-bar.is-on`·`.ob-chip`.

**초점 테두리를 `var(--ss-accent)`(주황)로 직접 준 곳**(공통 틀은 보라로 바뀌었고 이곳들은 주황 그대로): `sci-6-1-2-5` `.calc-key`, `sci-6-2-1-2`·`sci-6-2-2-2`·`sci-6-2-2-3` `.tb-track`, `sci-6-2-1-4` `.ang-range`, `sci-6-2-2-1`·`sci-6-2-3-2` `.d2-pick`, `sci-6-2-3-2` `.px-title`, 조사 틀 `style-guide.css`의 `.sg-seg-opt`(이번 수정 범위 밖 파일).

**글꼴을 직접 적은 곳**(시스템 글꼴 그대로): 2D 그림 속 SVG 글자 `system-ui`(`sci-6-1-2-3`, `sci-6-2-1-2`, `sci-6-2-1-3`, `sci-6-2-1-5`, `sci-6-2-2-2`, `sci-6-2-2-3`), 초시계 숫자 `ui-monospace`(`sci-6-1-2-4`, `sci-6-2-1-4`, `sci-6-2-1-5`).

**기존 대비 문제(앱 고유)**: `sci-6-1-2-5` 계산기 "÷"(`.calc-key.is-op`, 흰 글자 on `#d9822b`) 2.93:1 — 큰 굵은 글자 기준 3.0에 조금 못 미친다. 바탕을 `#c4701d`쯤으로 조금 진하게 하면 되지만 앱 고유 파일이라 고치지 않았다.

## 9. 스크린숏

폴더: `/private/tmp/claude-501/-Users-sungchul-Desktop-classroom/7bf3a39e-3017-4189-b337-1b82aace66bb/scratchpad/redesign-3/`
* `compare/` — **전(왼쪽)·후(오른쪽) 나란히 197장**. 이름 `<앱>__<화면>__<단계>.png` (화면: `tl`, `m`, `ml`, `tl-dark`).
  * 대표: `compare/sci-6-2-2-3__tl__exp-obs-ok.png`, `compare/sci-6-2-2-3__tl-dark__exp-obs-ok.png`, `compare/sci-6-2-3-2__tl__exp-obs-0.png`, `compare/sci-6-2-3-2__ml__exp-obs-0.png`, `compare/sci-6-1-1-5__m__intro.png`, `compare/sci-6-1-1-1__tl__analyze-done.png`, `compare/sci-6-1-2-5__tl-dark__exp-obs.png`, `compare/sci-6-2-2-3__tl__done.png`
  * 그래프 전체 화면: `compare/chart-sci-6-2-1-2__tl__analyze-fullpage.png`, `compare/chart-sci-6-2-1-2__tl-dark__analyze-fullpage.png`, `compare/chart-sci-6-1-2-5__tl__analyze-fullpage.png`
  * 키보드 초점: `compare/focus__tl__step.png`, `compare/focus__tl-dark__next.png`
* `shots/` — 낱장 873장.
  * 흐름: `<앱>__live__<화면>__NN-<단계>.png`(후), `<앱>__before__…`(전), 글꼴 막힘 `<앱>__live__tl-block__…`, 움직임 줄이기 `sci-6-2-1-2__live__tl-reduce__…`
  * 23개 앱 두 번째 단계: `all-<앱>__live__<tl|m|tl-dark|ml>__2.png`
  * 되짚기 카드 `final-ac-rethink-tl(-dark).png`, 차단 카드(선생님 버튼까지) `final-ac-block-tl(-dark).png`, 로그인 가림막 `final-gate-login-tl(-dark).png`, 체험 모드 `trial(-dark).png`, 알림 `toast-ml.png`, 초점 `live-focus-*.png`·`before-focus-*.png`
* `reports/` — 흐름별 JSON(체크포인트마다 가로 스크롤·튀어나옴·대비·44px 목록), 묶음 로그, 추가 점검 결과.
* `tools/`·`orig/` — 재현용 시험 도구(가짜 Supabase·흐름·대비 계산)와 원래 CSS·체크섬. Review 단계에서 다시 쓸 수 있게 남겨 두었다(끝나면 지워도 된다).

## 10. 알릴 것 · 확인하지 못한 것

1. **글꼴 `@import`는 첫 화면을 막는다**: CDN 요청이 곧바로 실패하면(차단·오프라인) 40~56ms에 기본 글꼴로 그려지지만, 응답 없이 **걸려 있으면 그 시간만큼 빈 화면**이다(6초 걸림 → 첫 화면 6.07초). 학교 망이 jsDelivr·Google Fonts를 "조용히 버리는" 방식으로 막는다면 문제가 된다(앱은 이미 jsDelivr의 supabase-js·three.js가 있어야 동작하므로 새로 늘어난 위험은 주로 `fonts.googleapis.com`). 걱정되면: 글꼴 파일을 앱 폴더에 두는 자체 호스팅(spec §2.2 원안, 개정 1에서 CDN으로 바뀜)이나 index.html에 비차단 링크를 넣는 방법이 있다(둘 다 이번 범위 밖).
2. **Google Fonts** 요청으로 학생 기기의 IP 주소가 Google에 전달된다(개정 1의 결정 사항이라 그대로 둠). Jua는 버전 고정 주소가 없다.
3. **초록(`--ss-good`) 밝음 값을 `#1d8a52`→`#17784a`로 조금 진하게** 했다(AA). 초록 의미·그래프 계열 색(`--ss-s3`)은 그대로.
4. **`science-guide/README.md`가 `style-common.css`를 "같음"이라고 적고 통째 복사를 권하고 있었는데**, 실제로는 공통 틀 수정 1 이후 레이아웃이 달랐다. 통째로 복사하면 조사 앱 레이아웃이 바뀌므로 README를 바로잡았다.
5. **키보드로 실험 패널을 Tab할 때 보기 버튼(`.ss-choice`)이 머리말 밑에 가려질 수 있다** — 전에도 같다(`.ss-choice`가 `scroll-margin-top` 목록에 없음). 레이아웃 변경이라 고치지 않았다(목록에 `.ss-choice`를 더하면 된다).
6. 사이트 쪽 파일(`src/**`)은 건드리지 않았다(같은 시간에 관리자 화면 작업이 진행 중).
7. **가로채기 없이 남아 있던 창**: 조작용 제어 프로그램을 두 번 다시 켜는 동안, 그때 열려 있던 시험 창 2~3개가 가짜 응답 없이 약 40분 남아 있었다(발견 즉시 닫음). 그 사이 이 창들이 실제 Supabase로 요청을 보냈는지는 확인할 수 없었다. 보냈더라도 서명이 가짜인 토큰이라 쓰기(진행 상황 저장 등)는 서버가 거부하고, 공개 설정 읽기 정도였을 것이다. 이후 모든 검증은 Chrome이 실제 Supabase 주소에 접속하지 못하게 막은 상태에서 다시 했다.
8. **확인하지 못한 것**:
   * 실제 iPad/Safari·갤럭시 탭 — 반투명 유리(`backdrop-filter`), `@import` 글꼴 받기, `font-synthesis`, 옛 Safari(16.2 전)에서 `color-mix()`를 쓰는 보조 효과(hover·선택 틴트 — 원래 파일도 쓰던 것), 실제 터치.
   * Windows·Android의 대체 글꼴 모양(맥 기본 글꼴로만 확인), 실제 학교 망의 CDN 속도·차단 방식.
   * 진짜 로그인·실제 DB(모두 가짜 응답), 버저 소리 실제 재생(headless는 음소거 — '소리 끄기' 버튼만 확인), 인쇄·고대비 모드.
   * 6개 말고 17개 앱은 두 번째 단계까지만 열었다(끝까지는 진행하지 않음).

---

## 개정 1 (2026-09-24, Claude 결정 — 글꼴이 첫 화면을 막지 않게)

학교 망이 느리거나 글꼴 서버가 응답 없이 걸려도 **첫 화면이 절대 늦어지지 않게** 글꼴을 불러오는 방식만 바꿨다. 동작·저장 키·저장 구조·문구는 그대로다. git 명령은 하나도 쓰지 않았고(status도 안 함), 실 DB 요청 0 — 이번 검증은 처음부터 끝까지 내 Chrome이 실제 Supabase 주소에 접속하지 못하게 막은 상태(`--host-resolver-rules`, 막힘 확인)에서 했다.

### 바꾼 것
| 파일 | 변경 |
|---|---|
| `scripts/templates/{science-sim,science-guide}/style-common.css` | 맨 위 `@import` 두 줄을 **지웠다**(머리 주석에 까닭 한 줄). 글꼴 이름 목록(`--ss-font`, `--ss-font-heading`)은 그대로라 기기 글꼴로 먼저 그린다 |
| `scripts/templates/{science-sim,science-guide}/persist.js` | **유일한 JS 변경**: 맨 위(기존 코드 앞)에 작은 즉시 실행 함수를 더했다. `<head>`에 `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>` + Pretendard CSS + Jua CSS를 `<link rel="stylesheet">`로 붙인다. 같은 id(`ss-font-pretendard`)가 있으면 건너뛰어 한 번만, 전체를 `try/catch`로 감싸 어떤 오류도 던지지 않는다. 그 아래 persist.js 코드는 한 글자도 바뀌지 않았다 |
| 두 README | "디자인" 절·외부 라이브러리 규칙·파일 표를 새 방식으로 고침(`style-common.css`에 `@import`를 다시 넣지 말 것) |
| `public/apps/sci-6-1-2-5/style.css` | `.calc-key.is-op` 바탕 `#d9822b` → **`#ad5f17`** 한 값만(흰 "÷" 2.93:1 → **4.74:1**. 같은 계산기의 "=" 4.81·"C/⌫" 4.65와 같은 수준). 그 앱의 다른 것은 그대로 |

* 글꼴 주소는 그대로: Pretendard `https://cdn.jsdelivr.net/npm/pretendard@1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.css`(버전 고정 + **SRI** `sha384-uR1wgObmx89ZQ4VVXHdzjbDJZ1PvBK01K+E3GebmaBKdZ87qRJvBWPoPbzWeEd5T`, `crossorigin="anonymous"` — jsDelivr 파일과 npm 패키지 파일의 해시가 같음을 확인, 응답은 `immutable`·`ACAO: *`), Jua `https://fonts.googleapis.com/css2?family=Jua&display=swap`(응답이 브라우저마다 달라 SRI 없음).
* 스크립트가 붙인 스타일시트는 **화면 그리기와 뒤 스크립트를 막지 않는다** → 기기 글꼴로 먼저 그리고, 글꼴 CSS·파일이 오면 Pretendard/Jua로 바뀐다(두 CSS 모두 `font-display: swap`). 앱 코드는 `load` 이벤트나 `document.fonts`를 기다리지 않는다(검색으로 확인).
* 동기화: 정본 → 23개 앱 사본(`persist.js`·`style-common.css`·`README.md`, 임시 파일 후 이름 바꾸기) → **`diff -r` 23개 모두 차이 없음**, 23개 사본 모두 글꼴 코드 있음·`@import` 0. 작업 전 대비 바뀐 파일은 `style-common.css` 25·`README.md` 25·`persist.js` 25·`sci-6-1-2-5/style.css` 1개뿐(파일 711개 체크섬).

### 다시 확인한 것(사본 그대로, 캐시 끔)
| 경우 | 첫 화면(FCP) | 앱 준비(단계 화면·버튼) | 글꼴 |
|---|---|---|---|
| 보통 | **36~60ms** (`@import` 때 232~248ms) | 57~124ms | CDP로 확인: 제목·단계 제목 `Jua(web)`, 본문·버튼 `Pretendard Variable(web)`. Pretendard CSS 92규칙 로드(SRI 통과), `<link>` 각 1개 |
| 글꼴 서버 **6초 걸림** | **40~48ms** (`@import` 때 **6,068ms**) | 110~111ms | 걸린 동안 기기 글꼴(Apple SD Gothic Neo·SF), 6초 뒤 실패해도 그대로. 0.5초 시점 화면이 이미 다 그려져 있음 |
| 글꼴 서버 막힘(오프라인 흉내) | 36ms | 55~108ms | 기기 글꼴, JS 오류 0 |

* **끝까지 흐름 14번 모두 완료**(완료 결과 저장, 가로 스크롤 0, '기록하기' 가림 0, 대비 미달 0):
  * `sci-6-2-1-2`·`sci-6-2-3-2`·`sci-6-1-1-5` × 태블릿 가로·375·태블릿 어두움 = 9번 — **콘솔 오류 0, 실패 요청 0**, 글꼴 `Pretendard Variable`·`Jua` 로드.
  * 글꼴 6초 걸림 `sci-6-2-1-2`(태블릿), 글꼴 막힘 `sci-6-2-3-2`(태블릿)·`sci-6-1-1-5`(375) — 모두 완료. 콘솔에는 막힌/걸린 글꼴 CSS 2건의 "Failed to load resource"만(JS 오류 0). 걸림 흐름이 6초 길었던 것은 시험 도구가 시작 전에 `document.fonts.ready`를 기다려서다(앱은 0.1초에 준비됨).
  * `sci-6-1-2-5`(태블릿 밝음·어두움): 계산기가 보이는 관찰 단계 포함 대비 미달 **0**(전에는 "÷" 1건).
* 23개 앱 두 번째 단계까지(태블릿 가로·375): 23개 모두 넘어감(3D 캔버스 20개), 가로 스크롤·튀어나옴·대비 미달·콘솔 오류 0.

### 스크린숏(개정 1)
`/private/tmp/claude-501/-Users-sungchul-Desktop-classroom/7bf3a39e-3017-4189-b337-1b82aace66bb/scratchpad/redesign-3/shots/`
* 글꼴 서버가 걸린 동안 0.5초 시점: `rev1-hang-0.5s-sci-6-2-3-2.png`, `rev1-hang-0.5s-sci-6-1-1-5.png` (8초 뒤: `rev1-hang-8s-*.png`)
* 흐름: `sci-6-2-1-2__live__tl-hang__*`, `sci-6-2-3-2__live__tl-block__*`, `sci-6-1-1-5__live__m-block__*`, 계산기 `sci-6-1-2-5__live__tl__03-exp-obs.png`(밝음)·`sci-6-1-2-5__live__tl-dark__03-exp-obs.png`
* 측정 기록: `reports/batch3.log`, `reports/rev1-smoke-{tl,m}.out`

### 남는 것
* 글꼴이 늦게 오면 잠깐 기기 글꼴로 보였다가 바뀐다(글자 모양·줄바꿈이 한 번 달라질 수 있음) — 의도한 맞바꿈. 머리말 높이는 `lesson.js`가 다시 잰다.
* Google Fonts 요청으로 기기 IP가 Google에 전달되는 점, Jua에 SRI를 못 붙이는 점은 그대로(§10-2).
* 실제 기기·학교 망에서의 글꼴 도착 시간, 진짜 로그인·DB는 여전히 확인하지 못했다.
