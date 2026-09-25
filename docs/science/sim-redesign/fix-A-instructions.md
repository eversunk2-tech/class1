# 단계 A 수정 지침(fix-A) — Review A 발견 고치기 (2026-09-25)

먼저 읽기: `CLAUDE.md`(과학 차시 앱 규칙·서브에이전트 규칙), `docs/science/sim-redesign/spec.md` 끝의 **개정 4**, `build-A-report.md`, **`review-A.md`(이 지침의 근거 — 발견 번호 H1…L11)**, 공통 틀 정본 `scripts/templates/science-sim/`(experiment.js, sim3d.js, lesson.js, style-common.css, README.md). Build 뒤 Claude가 `fitSceneHeight()`를 "창 높이 − 머리말 − 아래 막대 − 16px"로 바꿨다(review-A.md §0) — 그 방향은 유지한다.

## 고칠 파일
* 정본 `scripts/templates/science-sim/`(주로 experiment.js·style-common.css·sim3d.js·README.md) → 끝나면 **실험 앱 20개 사본에 복사**하고 `diff -r`로 확인. `science-guide` 정본은 README의 작은 오류 말고는 건드리지 않는다(알림 위치도 조사 앱은 그대로).
* 앱 파일은 아래에 적힌 곳만: `sci-6-1-2-4/app.js`, `sci-6-2-2-1/app.js`, `sci-6-2-2-2/app.js`, `sci-6-2-2-3/app.js`, `sci-6-2-2-4/app.js`(선택자·문구 수준). 저장 키·`detail`·문항·측정값·과학 내용·3D 색은 바꾸지 않는다.

## 고칠 것
### F1 (H1) 표준 실행·기록을 안 쓰는 앱에서 막대에 가짜 버튼
* `R.record`는 처음부터 `disabled`(진행 중인 관찰이 없으므로).
* 새 옵션 `sceneBar`(기본 `true`). **`o.factors.length === 0`이거나 `o.sceneBar === false`이면** 크게 보기에서 R.run·R.record를 막대로 옮기지 않는다(원래 자리 그대로 — 앱이 숨겼으면 숨은 채). 이때 막대에는 `scenePanel`만(있으면) 넣고, 넣을 것이 없으면 **막대 자체를 숨긴다**(빈 유리 막대 금지).
* 확인: `sci-6-2-1-2`(factors:[]) 768×1024 기본 켬·1024×768 켬에서 막대에 실행·기록 버튼이 없고 가짜 기록을 만들 방법이 없음, 앱 자체 기록(시간 바 7곳)은 두 모드에서 정상.

### F2 (H2) 앱이 기록 버튼을 찾는 고정 방법
* R.run에 클래스 `ss-run-btn`, R.record에 `ss-record-btn`(기존 클래스 유지). `create()`가 돌려주는 객체에 `runButton`, `recordButton`(같은 엘리먼트)을 더한다. README에 "관찰 카드 안 선택자로 찾지 말 것 — 크게 보기에서는 막대에 있다".
* `sci-6-1-2-4/app.js:258`의 `document.querySelector("#experiment-root .ss-observe .ss-btn-primary")` → 기록 버튼 고정 훅으로. 크게 보기에서 초시계와 다른 값이면 기록되지 않아야 한다(review-A H2 재현으로 확인).
* 같은 선택자를 쓰는 '가리면 스크롤' 도우미 `sci-6-2-2-1/app.js:214`, `sci-6-2-2-2/app.js:1275`, `sci-6-2-2-3/app.js:1428-1431`, `sci-6-2-2-4/app.js:258-262`도 `.ss-record-btn`으로 바꾸되, **기록 버튼이 꺼져 있으면 스크롤하지 않고**, 크게 보기에서는 아래 F4의 규칙(막대와 관찰 카드를 함께 보이게, 이미 보이면 가만히)을 따르게 한다 — 가능하면 앱 도우미가 공통 틀의 공개 함수(예: `exp.revealRecord()`)를 부르도록 해 규칙을 한 곳에 둔다.
* `sci-6-2-2-3`(L8 일부): 관찰 카드의 실제 상태 글(`chip-reveal`)은 **맞는 보기로 확인했을 때만** 드러낸다(틀린 답으로 확인하면 계속 숨김).

### F3 (M1) 알림이 장면을 가리지 않게
* `.ss-toast`를 **머리말 위에 겹치게**: `top: calc(env(safe-area-inset-top, 0px) + 8px)`(제목 줄 자리, `pointer-events:none` 유지). 주석·README 갱신.
* 확인: review-A 항목 6 표의 경우(기본 가로·세로, 크게 가로·세로, 머리말 펼침·접힘)에서 알림과 장면의 겹침 넓이. 목표 0 — 머리말을 접은 상태에서 두 줄 알림이 머리말보다 길어 조금 겹치면 넓이를 보고.

### F4 (M2) 크게 보기의 스크롤 왕복 없애기
* 크게 보기에서는 **관찰 카드(R.observe)를 장면 바로 아래**(패널의 맨 앞 — 좁은 화면용 scenePanel 카드가 있으면 그 다음, 조건 카드들보다 앞)로 옮기고, 끄면 **원래 자리**로 되돌린다(`scenePanelHome`처럼 원래 다음 형제를 기억). 관찰 카드 번호(①②…)도 두 모드에서 맞게.
* `revealRecord()`: 기록 버튼이 **꺼져 있으면 아무것도 안 한다**. 켜져 있고 안 보이면 최소로(`nearest`) 스크롤해 **막대와 관찰 카드가 함께** 보이게(함께 안 들어가면 막대 우선). 이미 보이면 가만히.
* `showObserve()`의 스크롤: 크게 보기에서는 관찰 카드가 막대 바로 아래라, 막대가 화면에 남도록 `nearest`로 최소 이동.
* `afterSelect()`가 크게 보기에서 관찰 카드를 숨길 때 **조건 버튼이 화면에서 튀지 않게**: 숨기기 전·후 조건 카드(첫 조건 카드 또는 방금 누른 버튼) 위치를 재서 차이만큼 `scrollBy`(브라우저 스크롤 앵커링이 이미 맞췄으면 차이가 0이라 두 번 보정되지 않음 — iPad Safari는 앵커링이 없을 수 있다).
* 확인: review-A 항목 2의 스크롤 표를 같은 5개 앱 × 1024×768·768×1024 × 끔·켬으로 다시 재서 전·후 비교. 목표 — 크게 보기가 기본 화면보다 자동·손 스크롤이 많지 않고, **보기를 고른 뒤 눌러야 할 '확인하기'가 화면 밖으로 밀려나지 않음**.

### F5 (M3·L10) 머리말 접기·창 크기 변경 뒤에도 장면 맞춤 유지
* `fitSceneHeight()`가 머리말·아래 막대 크기 변화나 창 크기 변화로 다시 잴 때, 크게 보기(가로)이고 **장면이 화면 띠의 절반 이상 보이고 있었으면** `scrollIntoViewSafe(R.viewBox)`로 다시 맞춘다(학생이 조건 카드 쪽을 보고 있으면 끌어올리지 않음). 움직임 줄이기면 즉시 이동.
* 확인: review-A 항목 3 표(5개 가로 크기)에서 "접은 직후"와 "1024→1280 창 변경 직후"에 막대가 아래 이동 막대 위에 다 보이는지.

### F6 (M4·L6) 막대가 장면 아래쪽을 가리지 않게
* 크게 보기 + 3D(`.is-2d` 아님)에서 `.ss-view3d`의 아래를 막대 높이만큼 올린다(`bottom: var(--ss-exp-overlay-h, 64px)`) — 앱이 3D 컨테이너 안에 붙이는 안내 글(`ov-text`, `hud-ff` 등)·3D 이름표·카메라 맞춤(`ResizeObserver`)이 모두 막대 위에서 끝나게. 막대 바탕은 거의 불투명하게(글자 대비 유지). 막대가 없을 때(F1)는 올리지 않는다. 드래그 안내 문구는 막대 위 캔버스 안.
* 확인: review-A M4의 앱(`sci-6-2-3-1`·`sci-6-2-2-1`·`sci-6-2-3-2` `ov-text`, `sci-6-2-1-5`·`sci-6-2-2-4` `hud-ff`, `sci-6-2-2-3`·`sci-6-2-3-3` 아래 이름표, `sci-6-1-1-3` 드래그 안내 ↔ 이름표) 실행 중 스크린숏으로 가림 0.

### F7 (M6·L3·L5) 토글 접근성
* 켜진 토글 글자색 `var(--ss-on-primary)`(어두움에서도 AA 4.5:1 이상 — 대비 수치 보고), `border: 1px solid transparent`(forced-colors에서 버튼 모양).
* 글자("⛶ 전체 화면 보기" ↔ "↙ 기본 화면")가 할 일을 말하므로 **`aria-pressed`는 빼고**(켜짐 모양은 클래스 `is-on`으로), 토글을 DOM에서 막대보다 **앞**에 두어 Tab 순서 = 보이는 순서.

### F8 (M7) 막대 안 측정값 칸
* 막대에 scenePanel이 있으면 **윗줄 전체 폭**(값), **아랫줄**(실행·기록 버튼)로. 글자 0.9rem 이상, 값 4칸이 1024×768·768×1024에서 잘리지 않게(review-A의 `sci-6-2-1-2` 사본 시험처럼 스크래치 사본으로만 확인 — 저장소 앱에 scenePanel을 켜지 않는다).

### F9 (M5) 공통 `Experiment.create()`를 안 쓰는 앱용 도우미
* 토글·기본값·방향별 기억·장면 높이·막대·scenePanel·관찰 카드 옮기기를 **`SciSim.Experiment.enlarge(opts)`**로 떼어 내고 `create()`도 이것을 쓰게 한다(`create()`의 동작은 그대로 — 위 F1~F8 포함). opts 예: `{ layout, viewBox, panel, run?, runCard?, record?, observe?, scenePanel?, onChange? }`, 돌려주는 값 `{ isOn(), set(on), refresh() }`. `sci-6-2-1-3`·`sci-6-2-1-4`(같은 `.ss-exp-layout`·`.ss-exp-view` 구조를 앱이 직접 만든다)가 단계 B에서 부를 수 있게 README에 사용 예. **이 두 앱은 지금 고치지 않는다** — 스크래치 사본(`sci-6-2-1-4`)에 연결해 동작만 확인.

### F10 (L7) 끌기 도우미 다듬기(단계 B에서 바로 씀)
* 끌기를 시작한 `pointerId`만 움직이고 끝낸다(다른 손가락·손바닥의 pointerup 무시), 마우스는 주 버튼만, 끌기 전 `controls.enabled` 값을 기억해 **그 값으로** 되돌림, 끄는 중 `discard`·`dispose`면 `onEnd`(마지막 point)를 부름, 보이지 않는 물체(자신·조상 `visible === false`)는 안 잡힘, 30px 보정의 기준을 README에 정확히(물체 중심인지 화면상 경계인지 — 가능하면 화면상 경계 상자).

### F11 (L2·L11·L4) 작은 것
* 2D(`.is-2d`)에서 토글이 2D 내용 윗줄을 덮지 않게(2D 위 여백을 토글 아래까지).
* 주석·README 오류 고치기: "장면 오른쪽 위"→"왼쪽 위", 머리말 접기 버튼 위치 설명(저장 배지와의 순서), 30px 기준.
* (L1·L9는 이번에 안 고침 — 보고서에 "안 고친 것"으로.)

## 확인(반드시)
* **끔 상태 하위 호환 재확인**: review-A 항목 1의 5개 앱 × 3크기 전·후 `getBoundingClientRect` 비교(바꾸기 전 = `git archive HEAD`로 꺼낸 사본, 자기 정적 서버 포트 **8781**). 허용 차이: 토글·접기 버튼·알림 위치·단계 메뉴 칸 수.
* 크게 보기 기록 흐름(review-A 항목 2의 8개 앱 × 4경우)을 다시 돌려 모두 기록·복제/유실 0, 높음 2건 재현이 더는 안 됨.
* 20개 실험 앱을 1024×768(켬)·768×1024(기본 켬)에서 실험하기까지 열어 콘솔 오류 0(토글 없는 `sci-6-2-1-3`·`-4`는 기본 화면만).
* `node --check`(바꾼 JS 전부), 정본↔20개 사본 `diff -r`, `npm run lint`.
* 테스트 규칙: 개발 서버 `http://localhost:3000/class1/apps/<앱>/index.html`(이미 돌고 있음 — 끄거나 재시작 금지. 꺼져 있으면 멈추고 보고), **자기 전용 headless Chrome 포트 9346**(프로필은 스크래치 `…/scratchpad/fix-A/`), `--use-angle=swiftshader --enable-unsafe-swiftshader`, **실제 Supabase는 첫 로드부터 차단**(`--host-resolver-rules="MAP *.supabase.co 127.0.0.1:9, MAP supabase.co 127.0.0.1:9"` + `--disable-web-security` + CDP `Fetch.enable` 가짜 응답), 실제 Gemini 금지, `localStorage.clear()` 금지(그 앱 `sci6…`·`ssUiPref:` 키만), 다른 탭·프로세스·다른 Chrome 건드리지 않기, git commit/push·실 DB 쓰기·내려받기 금지. 끝나면 자기 Chrome·서버 종료, 스크린숏만 `…/scratchpad/fix-A/shots/`에 남기고 나머지 정리(지우기가 거부되면 보고).

## 보고서 `docs/science/sim-redesign/fix-A-report.md`
발견 번호별(F1~F11) 바꾼 것(파일:행)과 확인 결과(전·후 수치 — 특히 F3 겹침 넓이, F4 스크롤 표, F5 접은 직후, F6 가림), 끔 상태 하위 호환 결과, `diff -r`·lint, Supabase 차단 기록, 안 고친 것(L1·L9 등)과 까닭, 확인하지 못한 것 — 한국어로 간결하게.
