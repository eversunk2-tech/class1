# science-sim — 과학 차시 실험 시뮬레이션 앱 공통 틀

과학 차시 앱(`public/apps/sci-{학기}-{단원}-{탐구}/`)이 함께 쓰는 정본이다. 각 앱은 이 폴더를 통째로 `science-sim/`에 **복사**해서 쓴다(앱은 자체 완결). 정본을 고치면 쓰고 있는 모든 앱 폴더에 다시 복사한다.

단계 흐름: **예상하기 → 실험하기 → 기록·분석하기 → 정리하기 → 궁금한 점** (`CLAUDE.md`의 "과학 차시 앱 규칙").

## 1. 파일

| 파일 | 전역 이름 | 하는 일 |
|---|---|---|
| `persist.js` | `SciSim.createStore`, `SciSim.el`, `SciSim.rich`, `SciSim.josa`, `SciSim.debounce`(+`flush`, 떠날 때 자동 저장) | localStorage 임시 저장(모든 접근 try/catch), DOM 도우미, `**굵게**` 글, 받침에 맞는 조사 |
| `stage-nav.js` | `SciSim.StageNav` | 단계 진행바(앞 단계는 언제든, 뒤 단계는 조건 통과 시) |
| `lesson.js` | `SciSim.Lesson` | 앱 뼈대: 알림, 학습 시간, 단계 이동 연결·새로고침 복원, 마치기·결과 저장(실패 까닭별 문구), 처음부터 다시 |
| `predict.js` | `SciSim.Predict` | 예상하기(직접 타이핑 + 한 단계씩 열리는 힌트, 최소 글자 수 안내) |
| `experiment.js` | `SciSim.Experiment`, `SciSim.Countdown` | **실험하기 화면 틀 전체**: 3D/2D 화면 자리, 조건 고르기 버튼, 실험 단계 잠금·진행률, 실행 버튼(누르면 실험 화면이 보이게 스크롤한 뒤 실행), 관찰·기록 카드(보기 고르기 **또는 수치 입력**), 기록 한눈에 보기 표, 3D↔2D 전환(겹침 방지·렌더러 해제), **안전상 관찰하지 않는 칸(`skipCells`)** |
| `sim3d.js` | `SciSim.Sim3D` | three.js 3D 장면 도우미(카메라·조명·드래그 회전, 물체 팩토리, 트윈, `discard`, **사진(`snapshot`)·시점 저장(`cameraPose`)·`project`**, `dispose`로 WebGL 컨텍스트 반납) |
| `record-store.js` | `SciSim.RecordStore` | 기록 저장(같은 칸 덮어쓰기 / `trial` 회차별 저장, 평균) |
| `table-chart.js` | `SciSim.TableChart` | 색상 매트릭스 표, 수치 기록 표(평균 줄), **꺾은선그래프(수치 x축·여러 계열)**, **막대그래프(범주×계열)** — 축 제목에 단위, 범례, 계열마다 다른 점 모양 |
| `sorter.js` | `SciSim.Sorter` | 분류하기 활동(탭하거나 끌어다 놓기) + 맞고 틀림 피드백. **`renderRounds`: 같은 항목을 여러 기준으로 차례로 분류(라운드 탭)** |
| `quiz.js` | `SciSim.Quiz` | 보기 고르기 분석(정확 일치 또는 `grade` 함수, 고른 오답 보기별 피드백 `wrongBy`, 빠뜨린 정답 보기별 피드백 `missBy`) |
| `conclude.js` | `SciSim.Conclude` | 결론·발전 질문: 적고 제출해야 모범 답안이 나오고 나란히 비교 |
| `curiosity.js` | `SciSim.Curiosity` | 더 탐구하고 싶은 점 |
| `style-common.css` | — | 공통 스타일(태블릿 우선, 44px 이상 터치 영역, 다크모드, 실험 화면 틀·분류·그래프 스타일) |

각 파일 맨 위 주석에 자세한 사용법이 있다.

## 2. 새 차시 앱 만드는 절차

1. **지도서 분석** → 앱 `spec.md`에 실험 차시인지(시뮬레이션) 조사 차시인지와 근거 쪽수, 색·수치·용어 표를 적는다. 화면에 쓰는 값은 모두 지도서 값만.
2. 폴더 만들기: `public/apps/sci-{학기}-{단원}-{탐구}/`
   - `scripts/templates/science-sim/` → `science-sim/`로 **통째로 복사**
   - `scripts/templates/class1-record.js` → 폴더 바로 아래로 복사
   - `config.js`(SUPABASE_URL, anon key — 블로그와 같은 값)
3. `index.html`: 시범 앱(`public/apps/sci-6-1-1-2/index.html`)을 복사해 제목·설명·"← 차시로" 주소만 바꾼다. 필요한 칸은 아래뿐이다.
   ```html
   <header class="ss-header"> … <nav id="stage-nav"></nav></header>
   <main class="ss-main">
     <section data-stage="predict"><div id="predict-root"></div></section>
     <section data-stage="experiment" hidden><div id="experiment-root"></div></section>
     <section data-stage="analyze" hidden><div id="result-root"></div><div id="quiz-root"></div></section>
     <section data-stage="conclude" hidden><div id="conclude-root"></div></section>
     <section data-stage="curiosity" hidden><div id="curiosity-root"></div> 마치기 버튼·메시지·done-card·다시 하기 버튼</section>
   </main>
   <nav class="ss-footer-nav"><button id="btn-prev">…</button><button id="btn-next">…</button></nav>
   <div class="ss-toast" id="toast" role="status" hidden></div>
   ```
   스크립트 순서: importmap(three, SRI) → supabase-js(SRI) → `config.js` → `class1-record.js` → `science-sim/persist.js, stage-nav.js, lesson.js, predict.js, record-store.js, table-chart.js, sorter.js, quiz.js, conclude.js, curiosity.js, sim3d.js, experiment.js` → `data/lesson-config.js` → `app.js`.
   3D를 쓰지 않는 차시는 importmap과 `sim3d.js`를 빼도 된다(2D만 씀).
4. `data/lesson-config.js`: 아래 3절 예시 중 알맞은 형(색 관찰형 / 수치 측정형)을 골라 채운다.
5. `app.js`: 아래 순서로 연결한다(시범 앱 `app.js`가 실제 예).
   ```js
   var store = SciSim.createStore(C.storageKey);
   var lesson = SciSim.Lesson.create({ appId: C.appId, store: store, toastEl: $("toast") });
   var records = SciSim.RecordStore(store, { key: "records", keyOf: …, onChange: lesson.refresh });
   var predict = SciSim.Predict.render($("predict-root"), C.predict, store, lesson.refresh);
   var exp = SciSim.Experiment.create({ root: $("experiment-root"), store, records, toast: lesson.toast,
                                        factors, phases, cellKey, runLabel, view: { build3D, build2D }, observe, makeRecord, … });
   var quiz = SciSim.Quiz.render($("quiz-root"), C.quiz, store, lesson.refresh);
   var conclude = SciSim.Conclude.render($("conclude-root"), C.conclude, store, lesson.refresh);
   var curiosity = SciSim.Curiosity.render($("curiosity-root"), C.curiosity, store, lesson.refresh);
   lesson.finish({ button, msgEl, loginHintEl, doneEl, canFinish, detail, summary });   // nav보다 먼저
   lesson.restart($("btn-restart"));
   lesson.nav({ el: $("stage-nav"), stages: C.stages, prevBtn, nextBtn,
                gates: { experiment: …, analyze: () => exp.allDone() || "…", conclude: …, curiosity: … },
                done: { … }, onEnter: { experiment: exp.activate, analyze: drawResults } });
   ```
   차시 앱이 직접 만드는 것은 **실험 장면**(`build3D`, `build2D` — 같은 인터페이스), **관찰 카드 내용**(`observe`), **분석 표/그래프 그리기**뿐이다.
6. 확인: 태블릿 가로·세로, 휴대폰 375px, 다크모드, 새로고침 복원, `?no3d=1`(2D 대체), 3D↔2D 여러 번 전환, 콘솔 오류 0, `npm run build`.
7. 공통 틀을 고칠 때는 **정본을 먼저 고치고** 앱 폴더에 다시 복사한다(`cp scripts/templates/science-sim/* public/apps/{앱}/science-sim/`). CDN 버전을 바꾸면 SRI를 다시 계산한다: `curl -s <src> | openssl dgst -sha384 -binary | openssl base64 -A`.

### 실험 화면(view) 인터페이스

`build3D(container, ctx)`는 `Promise<view | null>`(null이면 자동으로 2D), `build2D(container, ctx)`는 `view`를 돌려준다.

| view 메서드 | 할 일 |
|---|---|
| `highlight(sel)` | 고른 조건을 표시(고리·테두리 등) |
| `run(sel)` → Promise | 실험 애니메이션. 끝나면 결과가 보이는 상태여야 한다 |
| `showInstant(sel)` | 애니메이션 없이 결과만(새로고침·화면 전환 뒤 복원) |
| `clear()` / `resetView()` / `dispose()` | 비우기 / 처음 시점 / 해제(3D는 `v.dispose` 그대로) |
| `whenVisible(ms)` (선택) | 3D에서는 `v.whenVisible`을 그대로 넘긴다 |

물체를 누르면 `ctx.onPick({ 조건id: 값, … })`을 부른다(일부 조건만 줘도 된다). 3D 컨텍스트를 잃으면 `ctx.onLost`가 2D로 바꾼다. 잠깐 쓰는 물체(방울·스포이트)는 `v.discard(obj)`로 빼야 GPU 메모리가 쌓이지 않는다.

### 추가 기능(6-1-1-1에서 확장, 기존 차시 앱과 하위 호환)

모두 **선택 옵션**이다. 넘기지 않으면 예전과 똑같이 동작한다(시범 앱 6-1-1-2는 코드 변경 없이 새 틀로 동작 확인).

1. **관찰하지 않는 칸** — `SciSim.Experiment.create({ …, skipCells: [...] })`
   ```js
   skipCells: [{
     cell: { sol: "묽은 염산", method: "냄새" },            // 조건 id → 값(일부 조건만 줘도 된다)
     title: "⚠️ 묽은 염산은 냄새를 맡지 않아요",
     text: "묽은 염산은 **자극성이 강해** 냄새를 맡지 않아요.",  // **굵게** 가능
     why: "🤔 왜 그럴까요? …",                              // 선택: 한 번 더 생각해 볼 질문
     runLabel: "🚫 안전을 위해 냄새를 맡지 않아요",           // 선택: 실행 버튼 글자(버튼은 비활성)
     short: "관찰하지 않음(안전)",                           // 선택: 미니 표 aria-label·분석 표 문구
   }]
   ```
   - `phases[].cells`에 그 조합이 있어도 **자동으로 빠진다**(진행률·단계 잠금·`allDone`은 나머지 칸만 센다. 예: 24칸 → 23칸).
   - 그 조합을 고르면 실행 버튼 대신 빨간 안내 카드가 뜨고, 애니메이션·기록은 없다. 미니 표 칸은 🚫.
   - `exp.skipInfo(sel)`로 그 칸인지 알 수 있다. 분석 표에서는 `renderMatrix`의 `cell`이 `{ text: "관찰하지 않음(안전)", icon: "🚫", muted: true }`를 돌려주면 흐리게 표시된다.
   - 값이 없는 칸이므로 **config의 결과 표에도 값을 만들지 않는다**(지도서가 "-"로 둔 칸).

2. **여러 기준으로 분류하기(다중 라운드)** — `SciSim.Sorter.renderRounds(el, cfg, store, onChange)`
   ```js
   var rounds = SciSim.Sorter.renderRounds($("classify-root"), {
     id: "classify", title: "기준에 따라 용액 분류하기", intro: ["…"],
     sequential: true,                         // 기본 true: 앞 라운드를 맞혀야 다음 라운드 탭이 열림(false면 자유)
     rounds: [                                 // 각 라운드 = Sorter.render의 cfg와 같은 모양
       { id: "transparent", tab: "투명한가?", title: "기준 1: 투명한가?", items, bins: [{ id: "yes", label: "그렇다" }, { id: "no", label: "그렇지 않다" }],
         answer: { yes: [...], no: [...] }, correct: "…", wrong: "…", hintAfter: { tries: 2, text: "…" } },
       { id: "foam", tab: "거품이 유지되는가?", … },
     ],
     allDone: ["모든 라운드를 맞혔을 때 보여 줄 문단(**굵게** 가능)"],   // 선택
   }, store, lesson.refresh);
   rounds.isDone() / rounds.roundDone("foam") / rounds.result() / rounds.show("foam")
   ```
   - 저장 키: 라운드마다 `classify.<라운드 id>`, 지금 보는 탭 `classify.tab`. 라운드를 맞히면 "다음 기준으로 분류하기 →" 버튼이 나온다. 탭은 방향키로도 옮길 수 있다.
   - `result()` → `{ transparent: { groups, correct, tries }, foam: { … } }` (저장 detail에 그대로 넣는다).

3. **그 밖의 작은 추가**
   - `Quiz` 문항 `missBy: { 보기id: "그 정답 보기를 빠뜨렸을 때 피드백" }` (고른 오답의 `wrongBy`가 먼저).
   - `TableChart.renderMatrix`의 칸 `icon`(글자 앞 아이콘 — 색 없이 모양으로도 구분), `muted`(흐린 칸).
   - `Sim3D.create({ minDistance })`: 카메라가 다가갈 수 있는 가장 가까운 거리. 종이 앞 낮은 시점처럼 가까이에서 보는 연출이 화면 크기 변화 때 뒤로 밀려나지 않게 할 때 쓴다(기본은 예전처럼 화면 맞춤 거리의 45%).

### 추가 기능(6-1-2-1 "운동하는 물체의 특징"에서 확장, 기존 차시 앱과 하위 호환)

모두 **선택 옵션**이다. 넘기지 않으면 예전과 똑같이 동작한다(6-1-1-1·6-1-1-4를 새 틀로 바꿔 실행해 확인).

1. **장면 사진(스냅샷) — 전/후 비교** (`sim3d.js`)
   ```js
   var pose = v.cameraPose();                                   // { position, target } 지금 시점
   var p1 = v.snapshot({ pose: pose, width: 560,                 // 사진 1
                         marks: [{ at: [x, y, z], radius: 0.06, label: "시곗바늘" }],   // 점선 표시 원(반지름은 사진 가로 대비)
                         hide: [선택표시물체] });                  // 찍는 순간에만 숨길 물체
   // … 시간이 흐른 뒤 …
   var p2 = v.snapshot({ pose: pose, … });                      // 같은 시점(삼각대처럼)에서 사진 2 — 학생이 그사이 화면을 돌려도 된다
   // 반환 { url(dataURL), canvas, width, height, marks: [{ x, y, r, inView }] } — 해제된 뒤면 null
   v.project([x, y, z], pose?)   // 화면 위 자리 { x, y (0~1), inView }
   v.setCameraPose(pose)         // 시점 되돌리기
   ```
   - `Sim3D.create({ viewDir: [0, 0.62, 0.79] })`: 처음 시점 방향(기본 `[0, 0.78, 0.62]`). 야외처럼 조금 낮게 볼 때.
   - `v.discard(group)`이 그 안에 `pickable`로 등록한 자식도 함께 뺀다(장면을 통째로 바꿔도 떼어 낸 물체가 탭에 걸리지 않음).

2. **실제 시간 카운트다운(초시계)** (`experiment.js`, 스타일 `.ss-countdown`)
   ```js
   await SciSim.Countdown.run(container, 5, { label: "초 뒤에 사진 2를 찍어요", note: "실제 시간 5초 (초시계)", onTick: function (remain) {} });
   ```
   - ⏱ 아이콘 + 큰 숫자(5·4·3·2·1) + 진행 고리. 벽시계(`Date.now`) 기준이라 빨리 감기가 아니고, 탭이 숨겨져도 제시간에 끝난다. 시작·끝을 화면 읽기 프로그램에 알린다.
   - `view.run(sel)` 안에서 3D `v.tween(ms, …)`(움직임)과 함께 쓴다. 반환 Promise에 `.cancel()`이 있다.

3. **조건 보기 숨기기 · 그 밖**
   - `factors[].visible: function (optionId, sel) { return bool; }` — 다른 조건에 따라 보기를 숨긴다(예: 고른 장면의 물체만). 숨겨진 보기가 골라져 있으면 선택이 풀린다. 장면마다 물체가 다른 차시에서 `factors: [장면, 물체]`로 쓴다.
   - `factors[].phaseTag: false` — 보기 아래에 단계 이름(예: "실험 A")을 쓰지 않는다(잠김 안내는 그대로).
   - `Experiment.create({ busyLabel })` — 실행 중 버튼 글자(문자열 또는 `function (sel)`).
   - 잠김 안내 조사 고침: "교실 안(7칸)을 모두 기록하면 …"(예전: "칸)를").
   - 공통 CSS `.ss-sr-only`(화면 읽기 전용 글자).

### 추가 기능(6-1-2-2 "물체의 운동을 표현해 볼까?" review 1차 수정에서 확장, 기존 차시 앱과 하위 호환)

모두 **선택 옵션**이다. 넘기지 않으면 예전과 똑같이 동작한다(6-1-1-1·6-1-1-5를 새 틀로 바꿔 실행해 확인).

1. **기록 전 확인하기 — 공식 훅** (`experiment.js`) — 앱이 틀의 DOM(선택자·리스너 순서)에 기대지 않고 학생 입력을 검사한다.
   ```js
   observe: function (sel) {
     return {
       question: "…", body: node, type: "numeric",
       fields: [
         { id: "seconds", label: "걸린 시간", unit: "초", step: 1, min: 1, max: 20 },
         { id: "sentence", kind: "text", label: "문장으로 써 보기", placeholder: "…", minLength: 8, maxLength: 120 },  // 글 칸(새로 추가)
       ],
       check: function (observed, ctx) {           // observed = { seconds: 5, sentence: "…" } (보기형이면 고른 보기 문자열)
         // ctx = { sel, tries }  tries: 이 카드에서 틀린 횟수(같은 답을 다시 누른 것은 세지 않음)
         return true | "틀렸을 때 피드백" | { ok: true, message: "⭕ …", node: 덧붙일노드 };
       },
       checkLabel: "✔️ 확인하기",                  // 선택
       okMessage: "⭕ 맞아요! …",                    // 선택: check가 true만 돌려줄 때의 문구
       retryLabel: "🔁 다시 움직여 보기",            // 선택: 틀렸을 때 '같은 조건으로 다시 실행' 버튼
     };
   },
   check: function (observed, ctx) { … },           // 선택: 모든 관찰 카드 공통(observe의 check가 먼저)
   beforeRecord: function (sel, observed) { return true | "막는 까닭"; },   // 선택: 기록 직전 마지막 검사
   canRun: function (sel) { return true | "먼저 할 일 안내"; },               // 선택: 실행 전 검사(막으면 토스트)
   onRunBlocked: function (sel, message) {},                                  // 선택: canRun이 막았을 때
   ```
   - `check`가 있으면 관찰 카드에 '확인하기' 버튼이 생기고, **확인을 통과해야 '기록하기'가 켜진다.** 입력을 바꾸면 다시 확인해야 한다.
   - 같은 답으로 다시 '확인하기'를 누르면 `check`를 부르지 않고 앞 피드백에 "(고친 곳이 없어요.)"를 붙여 다시 보여 준다(오답 횟수가 부풀지 않음).
   - `check`·`beforeRecord`·`canRun`이 오류를 던지면 **통과시키지 않는다**(fail-closed, 콘솔 경고).
   - 수치 칸·글 칸에서 Enter = 확인하기. 글 칸 값은 공백을 한 칸으로 줄이고 앞뒤를 뺀 문자열이다.
   - 아직 비어 있는 칸은 빨간 테두리로 보이지 않는다(예전: 처음부터 빨간 테두리). 기록은 여전히 막힌다.
   - 스타일: `.ss-check-row`, `.ss-check-node`, `.ss-text-input`, `.ss-num-field.is-text`(한 줄 전체).

2. **입력 저장 즉시 반영** (`persist.js`)
   - `SciSim.debounce(fn, ms)`로 미뤄 둔 저장은 `pagehide`·`beforeunload`·`visibilitychange(hidden)` 때 **바로 실행**된다. 새로고침·탭 닫기 직전 250ms 안에 적은 글자도 남는다.
   - `save.flush()`(그 저장만 지금 실행), `SciSim.flushPendingSaves()`(기다리는 저장 모두 실행).
   - `persist.js`는 science-guide 틀과 **같은 파일**이다(머리 주석 한 줄만 다름). 한쪽을 고치면 다른 쪽도 똑같이 고친다.

## 3. config 예시

### (1) 색 관찰형 — 예: 6-1-1-2 지시약 (시범 앱 `public/apps/sci-6-1-1-2/`)

조건 두 개(용액 × 지시약), 결과는 보기 고르기, 분석은 색상 매트릭스 표 + 분류하기 + 보기 고르기.

```js
window.LessonConfig = {
  appId: "sci-6-1-1-2", storageKey: "sci611sim2:v1",
  stages: [{ id: "predict", label: "예상하기" }, { id: "experiment", label: "실험하기" },
           { id: "analyze", label: "기록·분석하기" }, { id: "conclude", label: "정리하기" }, { id: "curiosity", label: "궁금한 점" }],
  predict: { minLength: 5, questions: [{ id: "q1", text: "…" }], hints: ["답이 아닌 생각거리", "…"] },
  solutions: [{ id: "식초", name: "식초", look: { color: "#e9cf6a", opacity: 0.55, name: "노란색, 투명" } }, …],
  indicators: [{ id: "리트머스파랑", name: "푸른색 리트머스 시험지", phase: "A", kind: "paper", color: "#3b6fd1" }, …],
  results: { 식초: { 리트머스파랑: { text: "붉은색으로 변함", color: "#d8434f", colorName: "붉은색" }, … }, … },  // 지도서 표 값만
  observeChoices: { A: ["붉은색으로 변함", "푸른색으로 변함", "변화 없음"], B: ["붉은색", "푸른색", "노란색"] },
  phases: { A: { name: "실험 A", lead: "…" }, B: { name: "실험 B", lead: "…" } },
  classify: { items: [...], bins: [{ id: "acid", label: "산성 용액" }, …], answer: { acid: [...], base: [...] }, correct: "…", wrong: "…" },
  quiz: [{ id: "q1", text: "…", multi: true, options: [...], answer: [...], correct: "…", wrong: "…", wrongBy: { look: "…" } }],
  conclude: [{ id: "conclusion", kind: "결론", prompt: "…", model: "…" }, { id: "ext1", kind: "발전 질문 1", … }],
  curiosity: { prompt: "…", minLength: 5 },
};
```

`app.js`에서 실험 화면 틀에 넘기는 부분:

```js
SciSim.Experiment.create({
  root: $("experiment-root"), store, records, toast: lesson.toast,
  factors: [
    { id: "sol", title: "용액 고르기", short: "용액", columns: 3, options: C.solutions.map(s => ({ id: s.id, label: s.name })) },
    { id: "ind", title: "지시약 고르기", short: "지시약", options: C.indicators.map(d => ({ id: d.id, label: d.name })) },
  ],
  phases: [
    { id: "A", name: "실험 A", lead: "…", cells: /* 6 용액 × 지시약 3 */ [{ sol: "식초", ind: "리트머스파랑" }, …] },
    { id: "B", name: "실험 B", lead: "…", cells: [{ sol: "식초", ind: "붉은양배추" }, …] },   // A를 다 기록해야 열림
  ],
  cellKey: sel => sel.sol + "|" + sel.ind,
  runLabel: sel => "▶ " + sel.sol + "에 … 넣기",
  view: { build3D, build2D },
  observe: sel => ({ question: "…색깔은 어떻게 되었나요?", body: 색견본노드, type: "choice", choices: C.observeChoices[phaseOf(sel)] }),
  makeRecord: (sel, observed) => ({ solution: sel.sol, indicator: sel.ind, result: observed }),
  miniTable: { rows: 용액들, cols: 지시약들, sel: (r, c) => ({ sol: r.id, ind: c.id }) },
});
```

### (1-2) 관찰 방법형 — 예: 6-1-1-1 여러 가지 용액 분류 (`public/apps/sci-6-1-1-1/`)

조건 두 개(용액 × **관찰 방법**: 색깔/투명한 정도/흔들어 보기/냄새), 결과는 보기 고르기. 안전상 관찰하지 않는 칸(`skipCells`)이 있고,
분석은 관찰 결과 표(색깔 칸만 색 칩, 나머지는 아이콘+글자) + 분류 기준 고르기(`Quiz`) + 두 기준으로 분류하기(`Sorter.renderRounds`).

```js
// data/lesson-config.js (요약)
methods: [{ id: "색깔", name: "색깔 관찰", choices: ["노란색", "연한 노란색", "흰색", "무색"] }, { id: "투명도", … }, { id: "거품", … }, { id: "냄새", … }],
results: { 식초: { 색깔: "노란색", 투명도: "투명하다", 거품: "유지되지 않는다", 냄새: "난다" }, …, "묽은 염산": { 색깔: "무색", 투명도: "투명하다", 거품: "유지되지 않는다" } },  // 냄새 값 없음
skip: { cell: { sol: "묽은 염산", method: "냄새" }, title: "…", text: "…", why: "…", short: "관찰하지 않음(안전)" },
classify: { id: "classify", rounds: [{ id: "transparent", … }, { id: "foam", … }], allDone: ["…"] },

// app.js
SciSim.Experiment.create({ …, factors: [{ id: "sol", … }, { id: "method", … }],
  phases: [{ id: "M", name: "관찰", lead: "…", cells: /* 6 × 4 = 24 */ }], skipCells: [C.skip], … });   // 진행률 23칸
var sorter = SciSim.Sorter.renderRounds($("classify-root"), C.classify, store, lesson.refresh);
```

### (2) 수치 측정형 — 예: 물체의 운동(이동 거리·걸린 시간·속력)

조건 두 개(물체 × 이동 거리), 같은 조건을 **3번** 재고(`trials: 3`), 결과는 **숫자 입력**. 분석은 수치 표(평균 줄) + 꺾은선그래프 + 막대그래프.
(아래 수치는 틀 사용법을 보이기 위한 모양일 뿐이다. 실제 차시에서는 지도서의 조건·값을 쓴다.)

```js
window.LessonConfig = {
  appId: "sci-x-x-x-x", storageKey: "scixxxsimx:v1",
  objects: [{ id: "car", name: "장난감 자동차" }, { id: "ball", name: "공" }],
  distances: [1, 2, 3],                       // m
  measure: { field: "time", label: "걸린 시간", unit: "초", step: 0.01, min: 0, max: 60 },
  chart: {
    line: { caption: "이동 거리에 따른 걸린 시간(평균)", xLabel: "이동 거리", xUnit: "m", yLabel: "걸린 시간", yUnit: "초" },
    bar:  { caption: "물체별 평균 속력", xLabel: "물체", yLabel: "속력", yUnit: "m/s", digits: 2 },
  },
  // stages, predict, quiz, conclude, curiosity는 (1)과 같은 모양
};
```

```js
var records = SciSim.RecordStore(store, { key: "records", keyOf: r => r.object + "|" + r.distance });
var exp = SciSim.Experiment.create({
  root: $("experiment-root"), store, records, toast: lesson.toast,
  factors: [
    { id: "obj", title: "물체 고르기", short: "물체", options: C.objects.map(o => ({ id: o.id, label: o.name })) },
    { id: "dist", title: "이동 거리 고르기", short: "이동 거리", options: C.distances.map(d => ({ id: String(d), label: d + " m" })) },
  ],
  phases: [{ id: "M", name: "측정", lead: "물체와 이동 거리를 바꿔 가며 걸린 시간을 3번씩 재어 기록해요.", trials: 3,
             cells: /* 물체 × 거리 */ [{ obj: "car", dist: "1" }, …] }],
  cellKey: sel => sel.obj + "|" + sel.dist,
  runLabel: sel => "▶ 출발! (" + sel.dist + " m)",
  view: { build3D, build2D },                              // run(sel)에서 물체를 움직이고 스톱워치 값을 view.lastTime에 남긴다
  observe: sel => ({
    question: "스톱워치에 나온 걸린 시간을 확인하고 기록해요.",
    type: "numeric",
    fields: [{ id: "time", label: "걸린 시간", unit: "초", step: 0.01, min: 0, max: 60, value: view.lastTime }],  // 값을 미리 넣거나 비워 두고 학생이 입력
  }),
  makeRecord: (sel, v) => ({ object: sel.obj, distance: Number(sel.dist), time: v.time }),   // trial은 틀이 자동으로 붙인다(1~3)
  miniTable: { rows: 물체들, cols: 거리들, sel: (r, c) => ({ obj: r.id, dist: c.id }) },   // 칸에 "2/3"처럼 회차 수가 보인다
});

// 기록·분석하기: 표 + 그래프
var T = SciSim.TableChart, mean = (o, d) => records.mean(o + "|" + d, "time");
T.renderTable($("table-root"), {
  caption: "걸린 시간 기록",
  columns: [{ id: "object", label: "물체" }, { id: "distance", label: "이동 거리", unit: "m" },
            { id: "t1", label: "1회", unit: "초", digits: 2 }, { id: "t2", label: "2회", unit: "초", digits: 2 },
            { id: "t3", label: "3회", unit: "초", digits: 2 }, { id: "avg", label: "평균", unit: "초", digits: 2 }],
  rows: /* 물체×거리마다 */ [{ object: "장난감 자동차", distance: 1, t1: 1.02, t2: 0.98, t3: 1.01, avg: mean("car", 1) }, …],
});
T.renderLine($("line-root"), Object.assign({}, C.chart.line, {
  series: C.objects.map(o => ({ name: o.name, points: C.distances.map(d => ({ x: d, y: mean(o.id, d) })) })),
}));
T.renderBar($("bar-root"), Object.assign({}, C.chart.bar, {
  categories: C.objects.map(o => o.name),
  series: [{ name: "평균 속력", values: C.objects.map(o => /* 거리 ÷ 평균 시간 */ 3 / mean(o.id, 3)) }],
}));
```

## 4. 지켜야 할 것

- 화면의 값·색·용어는 **지도서 값만** 쓴다. 단순화한 곳은 화면에 "모형"이라고 밝힌다(`modelNote`, 3D 화면 "모형" 배지).
- 예상하기에서는 답을 알려 주지 않는다. 힌트도 생각거리만. 새 용어·개념 설명은 예상하기 **뒤**(실험하기 `intro` 또는 분석 단계)에 둔다.
- 색만으로 구분하지 않는다: 색 칩 옆에 항상 글자, 그래프는 점 모양·선 무늬·범례.
- 상대경로만(`./science-sim/…`), 외부 라이브러리는 버전 고정 + SRI.
- 저장 detail은 16,000자 이하(`class1-record.js`). 입력칸은 `maxlength`로 제한한다.

## 로그인 필수 · 진행 상황 DB 저장 (2026-09-22)

- `persist.js`의 `SciSim.Sync`가 맡는다(설계·충돌 규칙은 `persist.js` 맨 위 주석). **앱 코드(app.js)는 바꿀 필요 없다** — `SciSim.createStore(C.storageKey)`와 `SciSim.Lesson.create(...)`만 부르면 된다.
- 로그인하지 않았으면 활동 화면 위에 로그인 안내(가림막)가 뜨고 `sci6…` 로컬 키를 지운다. 링크는 `../../login/?next=<돌아올 경로>`.
- 로그인하면 `app_progress`(학생 × 앱 1행, `supabase/migrations/20260922010000_app_progress.sql`)에 이 앱의 모든 로컬 키 스냅샷을 자동 저장하고, 다른 기기·다시 로그인 때 이어서 한다. 기록 주인이 다르면 로컬을 즉시 지운다.
- `storageKey`는 반드시 `sci6`으로 시작한다(블로그 로그아웃 때 이 머리로 지운다). 버전을 올리면(`:v2`) 예전 DB 기록은 쓰지 않는다.
- 앱에서 localStorage를 직접 쓰지 말고 store(`createStore`)만 쓴다(직접 쓴 값은 저장·주인 확인에서 빠진다).
- "처음부터 다시 하기"(`lesson.restart`)는 로컬과 DB 진행 상황을 함께 지운다.
- 머리말 `.ss-topline`에 저장 상태(저장 중… / 저장됨 / 저장 실패 · 다시 시도 중 / 저장 안 됨)가 나온다.
- 모든 DB 요청은 페이지의 기록 주인(`owner`)을 `expectedUserId`로 넘긴다. 실제 요청 토큰의 사용자가 다르면 요청하지 않고(`user_changed`) 앞 사람 로컬을 지운 뒤 새 사용자로 다시 연다. 화면을 떠날 때 "확인 중" 가림막을 씌우고 돌아올 때(`pageshow`·`visibilitychange`·`focus`) 세션을 다시 확인한다.
- 머리말에 "○○ 계정으로 로그인 중 · 내가 아니면 [로그아웃]"이 나온다(`.ss-who`). 로그아웃은 블로그와 같은 절차: 못 올린 기록(`<storageKey>:__meta`의 `dirty`)을 올리고, 실패하면 확인을 받은 뒤 로그아웃·로컬 삭제.
- 두 기기에서 모두 바뀌었으면(서버 `updated_at`이 마지막으로 맞춘 값과 다르고 로컬도 안 올린 변경이 있으면) 학생에게 "이 기기의 기록 / 저장된 기록"을 고르게 한다. 기기 시계는 비교에 쓰지 않는다.
