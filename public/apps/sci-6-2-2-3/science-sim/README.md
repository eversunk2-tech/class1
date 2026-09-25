# science-sim — 과학 차시 실험 시뮬레이션 앱 공통 틀

과학 차시 앱(`public/apps/sci-{학기}-{단원}-{탐구}/`)이 함께 쓰는 정본이다. 각 앱은 이 폴더를 통째로 `science-sim/`에 **복사**해서 쓴다(앱은 자체 완결). 정본을 고치면 쓰고 있는 모든 앱 폴더에 다시 복사한다.

단계 흐름: **예상하기 → 실험하기 → 기록·분석하기 → 정리하기 → 궁금한 점** (`CLAUDE.md`의 "과학 차시 앱 규칙").

## 1. 파일

| 파일 | 전역 이름 | 하는 일 |
|---|---|---|
| `persist.js` | `SciSim.createStore`, `SciSim.el`, `SciSim.rich`, `SciSim.josa`, `SciSim.debounce`(+`flush`, 떠날 때 자동 저장) | localStorage 임시 저장(모든 접근 try/catch), DOM 도우미, `**굵게**` 글, 받침에 맞는 조사(숫자로 끝나는 말도 숫자 읽기의 받침을 따른다 — "실험 1을", "실험 2를"). 맨 위에서 글꼴 CSS(Pretendard·G마켓 산스)를 첫 화면을 막지 않게 `<link>`로 붙인다(디자인 절) |
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
| `answer-check.js` | `SciSim.AnswerCheck` | **답 되짚기·차단**(예상하기·정리하기). 로컬 규칙으로 확실한 무의미만 막고, 나머지는 `check-answer` Edge Function(Gemini)이 ok/rethink/block을 정한다. 설계: `docs/science/answer-check/spec.md` |
| `style-common.css` | — | 공통 스타일(태블릿 우선, 44px 이상 터치 영역, 다크모드, 실험 화면 틀·분류·그래프 스타일). 2026-09-24부터 사이트와 같은 보라 톤·알약 버튼·Pretendard(CDN)/제목 G마켓 산스(사이트 글꼴 파일) — 아래 "디자인" 절 |

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
   스크립트 순서: importmap(three, SRI) → supabase-js(SRI) → `config.js` → `class1-record.js` → `science-sim/persist.js, answer-check.js, stage-nav.js, lesson.js, predict.js, record-store.js, table-chart.js, sorter.js, quiz.js, conclude.js, curiosity.js, sim3d.js, experiment.js` → `data/lesson-config.js` → `app.js`.
   (`answer-check.js`는 `persist.js` 바로 뒤, 반드시 `lesson.js`·`predict.js`·`conclude.js`보다 먼저 불러온다. 빼면 되짚기·차단만 꺼지고 나머지는 그대로 동작한다.)
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

### 추가 기능(2026-09-25 Phase A: 전체 화면 보기 토글 + 머리말 접기 + 끌기 도우미, 기존 차시 앱과 하위 호환)

**전체 화면 보기·머리말 접기는 옵트인이 아니다 — 템플릿을 쓰는 모든 앱에 자동으로 적용되고, 학생이 화면에서 직접 켜고 끈다.** 앱 코드는 하나도 고칠 필요가 없다(`scenePanel`만 선택 사항). 알림(토스트) 위치, 끌기 도우미는 그대로 아래에.

1. **전체 화면 보기 토글** — 장면 **왼쪽 위**(모형 배지 바로 아래)에 "⛶ 전체 화면 보기" 버튼이 **모든 앱에 항상** 있다. 앱은 아무것도 하지 않아도 된다(선택적으로 `scenePanel: node`만 넘길 수 있다).
   - **꺼짐(기본 배치)**: 지금까지와 같다 — 가로 900px 이상은 장면·조작 패널 좌우 분할(sticky), 세로·좁은 화면은 위아래. **픽셀 단위로 그대로**(하위 호환의 핵심 기준).
   - **켜짐**: 장면이 **1열 전체 폭**으로 커지고(`.ss-exp-layout.is-full`), **장면 아래쪽 막대**(`.ss-exp-overlay`, 거의 불투명한 바탕)에 `scenePanel`(있으면 **윗줄 전체 폭**)·**실행 버튼**(`R.run`)·**기록하기 버튼**(`R.record`, "값이 들어간 라벨" 그대로)이 들어간다(보이는 순서 = DOM·Tab 순서: 측정값 → 실행 → 기록하기). 막대가 보이는 3D 장면은 **3D 칸(`.ss-view3d`)이 막대 위에서 끝난다**(`.ss-exp-view.has-bar`, `bottom: var(--ss-exp-overlay-h)`) — 3D 칸 안에 붙인 앱의 안내 글(`ov-text`, `hud-ff` 등)·3D 이름표·카메라 맞춤이 막대에 가리지 않는다(fix-A F6). 단 앱이 3D 칸이 아니라 장면 칸(`.ss-exp-view`)에 직접 붙이고 아래에서 잰 요소는 막대와 겹친다 — 3D 칸에 붙이거나(2D에서도 보여야 하면 안 됨), 앱 CSS에서 `.ss-exp-view.has-bar:not(.is-2d) .그요소 { bottom: calc(원래값 + var(--ss-exp-overlay-h, 0px)); }`로 막대 위로 올린다(알려진 곳: sci-6-2-2-3 `.hud-ff` "⏩ 빨리 감기(모형)" — 단계 D). **관찰 카드는 장면 바로 아래(패널 맨 앞 — 좁은 화면용 scenePanel 카드가 있으면 그 다음)**, 조건 고르기 카드는 그 아래에 둔다(촘촘한 버튼 격자를 막대 위에 올리면 인식률이 떨어지므로). 끄면 모두 원래 자리로.
   - **버튼은 복제가 아니라 이동이다** — 켜질 때 막대로, 꺼질 때 원래 자리(실행 카드 / 관찰 카드의 안내 글 앞)로 **같은 엘리먼트**를 옮긴다. 이벤트·`disabled` 상태가 하나로 유지된다. 기록 버튼은 처음부터 꺼져 있고, 진행 중인 관찰이 없으면(조건을 바꾸거나, 실험 중이거나, 막 기록한 뒤) 자동으로 `disabled`가 된다(`afterSelect`/`run`/`btnClear`에서 관리).
   - **앱이 공통 실행·기록 버튼을 찾을 때는 고정 훅을 쓴다**: `exp.runButton`·`exp.recordButton`(같은 엘리먼트, 클래스 `ss-run-btn`·`ss-record-btn`). **`.ss-observe .ss-btn-primary`처럼 관찰 카드 안 선택자로 찾지 말 것 — 크게 보기에서는 막대에 있다**(sci-6-1-2-4가 이 선택자로 기록 버튼을 끄다가 크게 보기에서 초시계와 다른 값이 기록되던 문제, review-A H2). '가리면 스크롤' 도우미는 `exp.revealRecord()`를 부른다(아래).
   - **조건이 없는 앱(`factors: []`)이나 `sceneBar: false`**: 크게 보기에서도 실행·기록 버튼과 관찰 카드를 옮기지 않는다(원래 자리 그대로 — 앱이 숨겼으면 숨은 채). 막대에는 `scenePanel`만(있으면) 넣고, 넣을 것이 없으면 **막대 자체를 숨긴다**(빈 막대 없음). 앱이 자기 버튼으로 측정·기록하는 경우(sci-6-2-1-2)에 막대에 가짜 실행·기록 버튼이 나와 빈 기록을 만들던 문제(review-A H1) 때문.
   - **스크롤(크게 보기)**: 실행하면 장면이 보이게 맞추고, 관찰 카드가 뜨면 막대가 화면에 남는 데까지만 최소로 내려 관찰 카드를 보인다. `revealRecord()`는 **기록 버튼이 꺼져 있으면 아무것도 안 하고**, 켜져 있고 막대가 안 보이면 막대와 관찰 카드가 함께 보이게 최소로(함께 안 들어가면 막대 우선), 이미 보이면 가만히. 기록 버튼이 꺼져 있고 '확인하기'가 필요하면 '확인하기' 줄과 그 아래 피드백이 가릴 때만 최소로 보이게 한다. 크게 보기에서 조건을 바꿔 관찰 카드가 숨을 때는 방금 누른 카드의 자리가 튀지 않게 스크롤을 되돌린다(브라우저 스크롤 앵커링과 두 번 겹치지 않게 숨기기 전·후를 재서 차이만). 기본 화면의 스크롤은 예전과 같다(단 꺼진 기록 버튼으로는 스크롤하지 않고, 대신 '확인하기' 줄·피드백이 가릴 때 그것만 보이게 한다).
   - **기본값은 화면 방향에 따라 다르다**: 세로(portrait) + 폭 600px 이상(태블릿 세로)이면 **켜짐**, 그 밖(가로 태블릿·PC·휴대폰)은 **꺼짐**. 학생이 버튼을 직접 누르면 그 선택을 **방향별로** 기억한다(`SciSim.uiPref`, localStorage 키 `ssUiPref:sceneMode:portrait`/`ssUiPref:sceneMode:landscape` — `sci6` 접두사가 아니라 로그아웃 때 안 지워지는 기기 설정이다). 방향이 바뀌면(회전) 그 방향에서 **아직 고른 적이 없을 때만** 기본값을 다시 적용한다.
   - `scenePanel`(선택, 지금 값을 보여 주는 노드 — 시각·측정값 패널 등)을 주면 **같은 노드를 그대로 옮긴다**(복제 아님 — `matchMedia` 감시 + `appendChild`): 켜짐 + 넓은 화면은 막대 **윗줄 전체 폭**(`.ss-exp-overlay-panel`, 막대의 **첫 칸**, 글자 0.95rem — 실행·기록 버튼은 아랫줄. DOM 순서·Tab 순서가 늘 측정값 → 실행 → 기록하기), 켜짐 + **좁은/낮은 화면**(대략 폭 480px 또는 높이 420px 미만)은 **장면 바로 아래 카드**(`.ss-scene-panel-card`, 조건 고르기보다 먼저)로 옮긴다. **꺼짐(기본 화면)으로 돌아가면**: 앱이 `scenePanel` 노드를 넘기기 **전에 이미 자기 DOM에 붙여 뒀다면**(예: 스스로 만든 카드 안) 그 원래 자리(부모·다음 형제 기준)로 **정확히 되돌린다** — 아직 어디에도 안 붙인 채로 넘겼다면 기본 화면에서도 `.ss-scene-panel-card`(장면 바로 아래 카드)를 그대로 쓴다(사라지지 않는다). 안 주면 막대에는 실행·기록 버튼만 나온다. 앱이 **자기 style.css에서 `.ss-exp-view` 높이를 따로 정의**해 두었어도(예: `sci-6-2-2-2`의 가로 화면 전용 높이 규칙) **앱 코드를 고치지 않아도** 켜짐 모드가 이긴다 — 템플릿 규칙 앞에 `#experiment-root`를 붙여 특이도를 높였다.
   - **2D 대체 화면**(`.is-2d`, 높이 `auto`)에서는 막대가 장면 안에 겹치지 않고 **장면 바로 아래**(보통 문서 흐름)에 온다.
   - 켜짐일 때 장면 높이: 세로 태블릿 ~52vh(최대 620px) · 휴대폰 세로 35vh(최소 240px) · 휴대폰 가로(낮은 화면, `max-height:480px`) 최소 200px는 vh 어림값을 쓰고, **가로 태블릿·PC(폭 901px 이상 + 가로 방향)는 창 높이 − 머리말 − 아래 이동 막대 − 위아래 틈(8px씩)으로 계산한다**(`fit()`, 최소 240px) — 장면을 머리말 바로 아래에 맞추면 장면 전체(안의 막대 포함)가 아래 막대 위까지 꽉 찬다. 켜고 끌 때 장면이 화면에 다 보이게 스크롤을 맞춘다. **조건 고르기 줄은 장면 아래로 스크롤해서 본다**(2026-09-25 Claude 수정: 처음 구현은 조건 줄까지 한 화면에 넣으려고 장면을 160px 띠로 줄였다 — 크게 보기의 뜻과 반대). 머리말을 접으면 장면이 그만큼 더 커진다 — **학생이 머리말을 접거나 펴거나 창 크기(방향)를 바꿔 다시 잴 때 장면이 화면 띠의 절반 이상 보이고 있었으면 장면을 다시 머리말 아래에 맞춘다**(접은 직후 막대가 아래 이동 막대 뒤로 숨던 문제, fix-A F5. 움직임 줄이기면 즉시 이동). 조건 카드 쪽을 보고 있었으면 끌어올리지 않고, 장면 높이가 바뀌어도 보던 카드가 튀지 않게 스크롤을 되돌린다. 불러오는 중 머리말 높이가 바뀌는 것(계정 줄·글꼴)으로는 장면으로 맞춤 이동을 하지 않는다(실험하기에 들어올 때 한 번 맞추기는 review-A L1 — 아직 안 함). 앱이 다른 높이가 필요하면 `--ss-scene-h` 변수 하나로 덮어쓸 수 있다.
   - 드래그 안내 문구(`.ss-view-tip`)는 막대 위 캔버스 안에 붙는다(`--ss-exp-overlay-h`를 `ResizeObserver`로 실제 막대 높이에 맞춘다).
   - 실행·관찰 카드의 번호(①②…)는 꺼짐일 때 그대로, 켜짐일 때는 관찰 카드가 장면 바로 아래(조건 카드 ①② 위)로 옮겨 가므로 **번호 대신 👀**로 보인다(`enlarge()`의 `onChange`가 그때그때 바꾼다, Review A2 N6).
   - 2D 대체 화면에서는 토글이 2D 내용 윗줄을 덮지 않게 2D 위 여백이 토글 아래까지다(`.has-toggle`, 98px — 앱의 2D 위 여백 규칙보다 우선).
   - 접근성: 토글 버튼·막대 안 버튼 모두 44px 이상. 토글은 **글자로 할 일을 말한다**("⛶ 전체 화면 보기" ↔ "↙ 기본 화면", 기호는 `aria-hidden`) — `aria-pressed`는 쓰지 않는다(글자와 눌림 상태를 둘 다 바꾸면 "기본 화면, 눌림"처럼 헷갈리게 읽혀서). 켜짐 모양은 클래스 `.is-on`(글자색 `--ss-on-primary` — 어두움에서도 AA), 테두리는 투명 1px(강제 색 모드에서 버튼 모양). DOM에서 막대보다 앞이라 Tab 순서 = 보이는 순서(토글 → 막대). 키보드 초점은 전역 규칙 그대로. 등장 애니메이션은 만들지 않았다.
   - **공통 `create()`를 안 쓰는 앱**(같은 `.ss-exp-layout`·`.ss-exp-view` 구조를 앱이 직접 만드는 sci-6-2-1-3·sci-6-2-1-4 — 단계 B에서 연결): `SciSim.Experiment.enlarge(opts)`가 토글·기본값·방향별 기억·장면 높이·막대·scenePanel·관찰 카드 옮기기를 똑같이 해 준다(`create()`도 이것을 쓴다). 그 앱의 `index.html`에 `science-sim/experiment.js`를 넣고(sim3d.js 뒤) 실험 화면을 만든 뒤 한 번 부른다.
     ```js
     var layoutEl = el("div", { class: "ss-exp-layout" }, [viewCol, panel]);   // #experiment-root 안
     root.appendChild(layoutEl);
     var enl = SciSim.Experiment.enlarge({
       layout: layoutEl, viewBox: R.viewBox, panel: panel,
       record: R.record,               // 선택: 켜면 막대로 옮길 기록 버튼(끄면 원래 자리로), run·runCard·observe도 같은 방식
       scenePanel: valuesNode,          // 선택: 지금 값(각도·빛의 세기 등) — 막대 윗줄 / 좁은 화면은 장면 아래 카드
       onChange: function (on) {},      // 선택: 켜고 끌 때
     });
     // enl.isOn() / enl.set(on)(학생 선택으로 기억하지 않음) / enl.refresh()(자리·높이 다시) / enl.fit()(3D↔2D 뒤 높이) / enl.bar / enl.toggle
     ```
     3D↔2D를 바꿀 때는 장면 칸에 `is-2d`를 붙이고 떼는 것(공통 틀과 같은 규칙) 뒤에 `enl.fit()`을 부른다.
   - **원칙(§4.6 확장)**: 바뀌는 값(측정값 등)은 3D 이름표 대신 `scenePanel`(DOM 값 패널)로 보여 준다. 3D 안에는 값이 안 바뀌는 이름표만 남긴다 — 3D 스프라이트 이름표는 겹침을 피하는 로직이 없어(`sim3d.js`의 `label()`), 값이 바뀔 때마다 자리도 바뀌어 다른 요소를 가리기 쉽다.
   - **원칙(§3.2)**: 실험하기 단계·기록하는 순간(토스트, 관찰 카드 안내, 이름표)에는 결론·관계("~할수록 ~해요")를 말하지 않는다. 측정값·관찰 사실만. 분석·정리하기의 정답/오답 피드백은 원래처럼 허용된다.
   - **기본값 예외**(Review A2 N1): 막대에 넣을 것(실행·기록 버튼이나 `scenePanel`)이 없는 앱(`factors: []`·`sceneBar:false`이고 `scenePanel`도 없음, 예: `sci-6-2-1-2`)은 태블릿 세로에서도 **끔**이 기본이다(크게 보기가 장면만 키워 앱 자신의 기록 버튼을 화면 밖으로 밀어내지 않게). `scenePanel`을 넘기면 다른 앱처럼 켬이 기본.
   - **창 크기 변화**(Review A2 N2): 폭이나 방향이 바뀌었을 때만 장면을 다시 머리말 아래로 맞춘다. 높이만 바뀐 것(휴대기기 주소 막대가 스크롤 중에 숨고 나타남, 화면 키보드)은 장면 높이만 다시 재고 보던 곳을 지킨다.
   - **단계 메뉴 칸 수**: `stage-nav.js`가 `--ss-steps`(단계 수)를 넣어 단계 수만큼 칸을 나눈다(4단계 앱 오른쪽에 빈 칸이 남지 않게, 5단계 앱은 그대로).
2. **머리말 접기 토글** — 제목 줄(`.ss-topline`)의 제목 뒤에(저장 상태 배지 `.ss-sync`는 persist.js가 나중에 붙여 이 버튼 뒤, 줄 맨 끝에 온다) "▲ 접기"/"▼ 펼치기" 버튼이 **모든 앱에 항상** 있다(`aria-expanded`, 44px). 누르면 계정 줄(`.ss-who`/`.ss-trial` — persist.js가 나중에 넣어도 CSS(`.ss-header.is-collapsed > .ss-who`)로 잡히므로 순서와 무관하게 적용된다)와 단계 이동 막대(`#stage-nav`)가 감춰지고, **제목 줄(뒤로 가기·제목·저장 상태 배지)만 남는다.** 아래 이동 막대(이전/다음 단계)는 그대로 있어 계속 단계를 옮길 수 있다. `--ss-header-h`는 기존 `ResizeObserver`가 자동으로 다시 재서 sticky·scroll-margin·토스트 위치가 항상 맞는다. 선택을 기억한다(`SciSim.uiPref`, 키 `headerCollapsed`, 방향과 무관). 애니메이션 없음(모든 사용자에게 즉시 전환 — `prefers-reduced-motion` 분기가 따로 필요 없다).
3. **끌기 도우미** — `Sim3D.create()`가 돌려주는 `v.draggable(obj, opts)`(순수 추가, 안 쓰는 앱에 영향 없음). `sim3d.js` 머리 주석에 전체 사용법이 있다. 예:
   ```js
   // 손전등을 평면 위로 끌어 각도 조절(기존 setAngle(deg)을 그대로 재사용)
   v.draggable(torch, {
     plane: { normal: [0, 0, 1], point: [0, 0, 0] },   // 손전등이 움직이는 평면
     onDrag: function (info) {
       if (!info.point) return;
       var deg = clamp(Math.atan2(info.point.x, info.point.y) * 180 / Math.PI, 10, 90);
       setAngle(deg, true);   // 슬라이더와 같은 함수를 불러 값이 하나로 유지된다
     },
   });
   // 태양을 하늘 반구 위로 끌어 가장 가까운 시각으로 스냅(평면 대신 info.ray로 구면 교차를 직접 계산)
   v.draggable(sunMesh, { onDrag: function (info) { var dir = sphereHit(info.ray); if (dir) goTo(nearestTime(dir)); } });
   ```
   물체를 잡으면 카메라 회전(OrbitControls)이 잠시 멈추고, 끝나면 **끌기 전 값으로** 되돌린다(앱이 카메라를 잠가 두었으면 잠긴 채). 레이가 물체에 맞지 않아도 **물체(보이는 부분)를 화면에 그린 경계 상자에서 30px 안쪽**이면 잡힌다(작은 물체도 터치로 잡기 쉽게 — 여러 개면 경계 상자에 가장 가까운 것). **끌기를 시작한 손가락(pointerId)만** 끌고 끝낼 수 있다(다른 손가락·손바닥이 떼어져도 안 끝남). 마우스는 **왼쪽(주) 버튼만**. 숨긴 물체(자신이나 조상의 `visible === false`)는 잡히지 않는다. 마우스 기기에서는 끌 수 있는 물체 위에 커서가 `grab`으로 바뀐다. `v.discard(obj)`가 끌기 등록도 함께 떼고, 끌던 중이면 `onEnd`를 마지막 `point`로 한 번 부른다(`v.dispose()`도 같다, `info.cancelled: true`). 포인터취소(pointercancel)도 `onEnd`로 끝난다.
4. **알림(토스트) 위치** — `.ss-toast`가 화면 아래(실험 장면과 겹치기 쉬운 자리)에서 **머리말 위(제목 줄 자리)에 겹쳐** 뜬다(`top: calc(env(safe-area-inset-top, 0px) + 8px)`, fix-A F3 — 단계 A 첫 구현의 "머리말 바로 아래"는 장면 윗부분을 덮었다). 이 변경은 **실험 앱 모두에 자동 적용**된다(조사 도우미 science-guide는 예전처럼 화면 아래) — `sci-6-2-1-2`의 완료 토스트가 각도기·그림자·라벨을 덮던 문제(`docs/science/sim-redesign/audit.md`) 때문. 머리말을 접으면 두 줄 알림은 머리말보다 조금 길 수 있다. `pointer-events:none`은 그대로라 알림이 떠 있어도 버튼(제목 줄의 뒤로 가기·접기 포함)을 누를 수 있다.



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
- 상대경로만(`./science-sim/…`), 외부 라이브러리는 버전 고정 + SRI. 글꼴 CSS는 `persist.js` 맨 위가 `<link>`로 붙인다(본문 Pretendard는 jsDelivr, 버전 고정 + SRI / 제목 G마켓 산스는 사이트와 같은 파일을 상대경로 `../../fonts/…`로 — 아래 "디자인" 절).
- **화면 여백(2026-09-23)**: 아래쪽 이동 막대(`.ss-footer-nav`)와 머리말(`.ss-header`)은 고정이라 본문을 가린다. `lesson.js`가 두 높이를 `--ss-header-h`·`--ss-footer-h`에 넣고, `style-common.css`가 `.ss-main`의 아래 여백과 `scroll-margin-top/bottom`에 쓴다. 앱 `style.css`에서 `.ss-main`의 `padding-bottom`을 작은 고정값으로 덮어쓰지 않는다. `experiment.js`는 '확인하기' 뒤에 '기록하기' 버튼이 막대에 가리면 그만큼 스크롤한다.
- **낮은 화면(2026-09-23)**: `@media (max-height: 480px)`(휴대폰 가로 812×375 등)에서 머리말·단계 진행바·이동 막대를 낮게 한다. 앱 `style.css`에서 머리말 요소 크기를 고정값으로 다시 키우지 않는다.
- 저장 detail은 16,000자 이하(`class1-record.js`). 입력칸은 `maxlength`로 제한한다.
- **질문-답 표준 목록 `detail.qa`**(2026-09-22, `docs/admin/responses-spec.md` §3.3): 관리자 대시보드 "학생 응답"이 질문과 답을 정리해 보여 준다. 모듈마다 `qa(stage)`가 있다(기존 `values()`/`result()`는 그대로 — 하위 호환). `buildDetail()`에 한 줄을 더한다:
  `qa: [].concat(predict.qa("predict"), quiz.qa("analyze"), conclude.qa("conclude"), curiosity.qa("curiosity"))` (+ 분류가 있으면 `sorter.qa("analyze")`).
  항목 모양은 `{ stage, id, label, question, kind, answer }` — `kind: "text"`(answer: 글), `"choice"`(answer: `{ chosen: [보기 라벨…], correct, tries }`), `"groups"`(분류), `"table"`(answer: `{ columns: [{ key, label }], rows: [{…}] }`). 기록 표처럼 모듈이 없는 값은 앱이 같은 모양으로 직접 넣는다(예: `{ stage: "experiment", id: "records", label: "내 기록", question: "…", kind: "table", answer: { columns, rows } }`).
- 이미 만든 앱의 `detail` 모양을 바꾸면 `src/data/app-responses/{앱}.ts` 응답 매핑도 같이 고친다.

## 디자인 (2026-09-24, 디자인 개편 3단계 — `docs/design/redesign/spec.md` §6·개정 1)

사이트(`src/app/globals.css`)와 같은 인상으로 **색·글꼴·버튼·카드·단계 막대 모양만** 바꿨다. 동작·저장 키·저장 구조·측정값·문구는 그대로이고 CSS만 다르다(`science-guide/style-common.css`도 같은 디자인).

- **주색 = 사이트 `--primary`**: 밝음 `#6c4dd6`(oklch 0.53 0.2 288) · 어두움 `#aa9dff`(oklch 0.75 0.15 288). 그라데이션 끝색 `--ss-primary-2`(= 사이트 `--primary-grad-to`) `#9033bd` / `#d698f1`, `--ss-grad-primary`로 쓴다. 주색 위 글자 `--ss-on-primary`는 밝음 흰색(5.7:1 이상) · 어두움 `#110d26`(8.1:1 이상).
- **바탕**: `--ss-bg`(아주 옅은 보라) + 페이지 위쪽 연보라 그라데이션(`--ss-bg-top`) + 가장자리 흐린 보라 빛(`--ss-bg-blob`). 머리말·아래 막대는 반투명 유리(`--ss-glass` + 흐림).
- **카드** `.ss-card`: 모서리 `--ss-radius` 20px + 옅은 보라 그림자(`--ss-shadow`). 관찰·기록 카드(`.ss-observe`)는 보라 테두리 + 위쪽 옅은 보라, 되짚기 카드(`.ss-ac-*`)·제출 안내(`.ss-submit-note`)·마치기 카드(`.finish-card`)·완료 카드(`.done-card`, 모든 앱 index.html의 공통 클래스)도 같은 톤으로 맞췄다.
- **버튼**: `.ss-btn` = 흰 알약(모서리 28px — 높이 56px까지는 완전한 알약, 두 줄로 높아지면 둥근 사각형), `.ss-btn-primary` = 보라 그라데이션 알약 + 색 그림자, `.ss-btn-ghost` = 투명 알약. 선택 격자(`.ss-choice`·`.ss-option` 12px, `.ss-mini-cell` 8px, `.ss-round-tab` 14px)는 알약으로 바꾸지 않고 둥근 사각형으로 둔다(촘촘한 곳이 어수선해지지 않게). 올림(hover) 효과는 `(hover: hover)`인 기기에서만, 움직임 줄이기(`prefers-reduced-motion`)면 떠오르지 않는다.
- **단계 막대**: 지금 단계는 보라 그라데이션 + 굵은 글자(800) + 아래 작은 막대 표시(`.ss-step.is-current::after`) — 색만으로 구분하지 않는다(`aria-current="step"`). 완료는 초록 ✓, 잠김은 점선 테두리.
- **키보드 초점**: `:focus-visible` 3px 보라 테두리(`--ss-focus`, 밝음 `#6c4dd6` · 어두움 `#c0b8ff`). 입력칸은 보라 테두리 + 옅은 보라 둘레.
- **미리 계산한 틴트**: 제출 안내·관찰 카드·마치기 카드·힌트 카드의 테두리와 바탕은 `color-mix()` 대신 `--ss-primary-tint`(주색 7%)·`--ss-primary-line`(주색 55%)·`--ss-hint-line`(주황 45%)을 쓴다 — `color-mix()`를 모르는 옛 Safari(16.2 전)에서도 테두리·바탕이 남는다. 주색을 바꾸면 이 셋도 다시 계산한다.
- **초록(`--ss-good`)**: 밝음 `#1d8a52` → `#17784a`(옅은 초록 바탕 위 4.9:1, 흰 글자 5.5:1 — 전에는 3.9:1로 AA 미달). 빨강·노랑·주황(`--ss-bad`·`--ss-warn-bg`·`--ss-accent`)은 그대로.
- **바꾸지 않는 것**: 그래프·표 자료 계열 색 `--ss-s1`~`--ss-s4`(범례·과학적 의미와 연결), 3D·2D 실험 화면 바탕 `--ss-scene-bg`, 실험 화면 칸 `.ss-exp-view`(모서리 16px, 색 그림자·그라데이션 없음). 계열 표시가 없는 `.ss-bar`·`.ss-line`·`.ss-dot`은 주색이 아니라 `--ss-s1`(전과 같은 파랑)을 쓴다.
- **글꼴**: `persist.js` 맨 위의 작은 코드가 글꼴 CSS 두 개를 `<link rel="stylesheet">`로 `<head>`에 붙인다(개정 1 — 앱 index.html은 그대로, 한 번만, 오류를 던지지 않음). 스크립트가 붙인 스타일시트는 첫 화면을 막지 않으므로 먼저 기기 글꼴로 그리고 글꼴이 오면 바뀐다. **`style-common.css`에 `@import`를 다시 넣지 않는다**(CDN이 응답 없이 걸리면 그 시간만큼 빈 화면이 된다).
  - 본문 Pretendard(가변, SIL OFL 1.1): `https://cdn.jsdelivr.net/npm/pretendard@1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.css` — 사이트가 쓰는 npm 패키지와 같은 버전·같은 파일, `integrity="sha384-uR1wgObmx89ZQ4VVXHdzjbDJZ1PvBK01K+E3GebmaBKdZ87qRJvBWPoPbzWeEd5T"` + `crossorigin="anonymous"`. 버전을 바꾸면 SRI를 다시 계산한다.
  - 제목 G마켓 산스 Bold(SIL OFL 1.1, 디자인 개편 5단계 — `docs/design/redesign/spec.md` 개정 2): 사이트와 같은 파일 `../../fonts/gmarket-sans/gmarket-sans.css`(상대경로, 같은 출처 — 앱이 `public/apps/{앱}/`에서 열리므로 두 단계 위가 `public/`). 원본 OTF를 수정 없이 쓰므로 SRI·preconnect 없음, 사이트와 브라우저 캐시를 함께 쓴다.
  - `--ss-font`: `"Pretendard Variable", Pretendard, system-ui, -apple-system, "Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", sans-serif` / `--ss-font-heading`: `"Gmarket Sans", var(--ss-font)`.
  - 제목 글꼴은 제목류(`.ss-title`, `.ss-stage-title`, `.ss-step-h`, `.ss-q-num`, 분류·되짚기·완료 카드 제목, `h3.sub-h` 등)에만 쓴다. **측정값 입력·표·그래프 숫자에는 쓰지 않는다**(Pretendard `tabular-nums`). 파일이 Bold 하나라 제목은 `font-weight: 700` + `font-synthesis: none` — 못 불러오면 대체 글꼴(Pretendard)도 굵게 그린다.
  - 제목 그림자("A 부드러운"): `--ss-heading-shadow`(작은 배지는 `--ss-heading-shadow-sm`), 밝음은 흰 윤곽+보라 빛, 어두움은 검은 그림자+보라 빛, em 단위. 고대비 모드에서는 없음.
  - CDN을 못 쓰거나 응답 없이 걸려 있어도 첫 화면은 기기 기본 글꼴로 곧바로 그린다(build-3 보고서 개정 1의 측정 참고).
- **앱 `style.css`를 새로 쓸 때**: 강조(선택·초점)에는 `var(--ss-primary)`를 쓰고 예전 파랑(`#2f6fd6`)을 직접 쓰지 않는다. 자료·그래프 색은 `--ss-s1`~`--ss-s4`를 쓴다. 주색·바탕·글자·글꼴 같은 공통 틀 변수는 앱에서 다시 정의하지 않는다(그래프 칸 안에서 계열 색 `--ss-s1`~`--ss-s4`만 바꾸는 것은 괜찮다 — 예: `sci-6-2-1-2`의 `.chart-solar`).

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
- **가짜 충돌은 묻지 않는다 (2026-09-23).** 탭을 숨기거나 새로고침할 때 보낸 저장(keepalive)은 응답을 못 받아 `dirty`로 남는데, 그 뒤 앱이 기록을 더 쓰면 로컬과 서버가 달라져 예전에는 충돌 창이 떴다. 이제 두 경우는 창 없이 로컬을 올린다(잃는 내용 없음).
  - 서버 내용이 이 기기가 **마지막으로 보낸 내용**과 같을 때(`<storageKey>:__meta`의 `sentFp` 지문으로 확인).
  - 서버 내용이 **로컬 안에 그대로 들어 있을 때**(키 단위 `canon` 비교로 로컬이 서버의 확장일 때).
  - 다른 기기에서 다르게 진행한 진짜 충돌은 지금처럼 학생이 고른다.

## 답 되짚기·차단 (2026-09-23, `answer-check.js`)

설계: `docs/science/answer-check/spec.md`. 서버: `supabase/functions/check-answer/`(시크릿 `GEMINI_API_KEY` 하나).

- **앱 코드(app.js·lesson-config.js)는 바꾸지 않는다.** `index.html`에 `<script src="./science-sim/answer-check.js"></script>` 한 줄만 있으면 켜진다.
  `predict.js`가 자기 화면의 `<section data-stage="…">`를 찾아 스스로 등록하고, `lesson.js`가 그 단계를 떠나기 직전에 불러 준다.
  `conclude.js`는 '제출하고 모범 답안 보기'를 누를 때 스스로 확인한다. 이 파일을 빼면 예전과 똑같이 동작한다.
- 판정 3단계: **ok**(아무것도 안 보임) · **rethink**(노란 카드, "그대로 제출할게요"로 언제나 넘어갈 수 있음, 질문당 평생 1번) ·
  **block**(빨간 카드, 다시 써야 넘어감. 같은 질문에서 3번째부터 "🙋 선생님과 확인했어요 · 계속하기").
- **차단은 좁게**: 로컬 규칙(`SciSim.AnswerCheck._rules.block`)은 자모만·같은 글자 반복·숫자만·질문 그대로 복사(90% 이상)·자판 뭉개기만 막는다.
  "질문과 관련 없음(off-topic)"은 오직 Gemini가 정하고, **Gemini가 응답하지 못하면(오프라인·시간 초과·오류·429) 절대 막지 않는다**(rethink로 강등).
- 저장: store의 새 키 `answerCheck` = `{ "predict:q1": { nudged, blockCount, teacherOverride, okFp } }`.
  **저장 키 버전(`:vN`)과 기존 저장 구조는 그대로**다. `predict.qa()`·`conclude.qa()`가 값이 있을 때만 `nudged`·`blockCount`·`teacherOverride`를 항목에 덧붙인다(관리자 화면은 모르는 필드를 무시한다).
- 대기 한도: 클라이언트 3.5초, 함수 안 Gemini 호출 3초. 기다리는 동안 "🔎 답을 다시 확인하고 있어요…" 표시.
- `StageNav`에 `beforeLeave(targetId, currentId)` 옵션이 생겼다(Promise를 돌려주면 기다렸다가 이동). `go(id, { silent: true })`는 이 확인을 건너뛴다(새로고침 복원).
- 문항별로 오개념 힌트를 주고 싶으면(선택) `predict.questions[i].checkHint` 또는 `conclude` 항목의 `checkHint`를 넣는다(없으면 `compareTip`을 쓴다).

### 마치기 조건 (2026-09-23 추가, `docs/science/answer-check/finish-gate-report.md`)

- **'학습 마치기'를 누르면 답을 한 번 더 본다.** `canFinish()`를 통과한 뒤 ① 정리하기 답(`conclude.js`가 `AnswerCheck.registerFinish`로 등록) → ② '더 탐구하고 싶은 점'(`lesson.js`가 `#ss-curiosity`를 직접 본다) 차례로 확인한다. **앱 코드는 그대로다.**
  - 정리하기 답이 **block**이면 마치지 못한다(카드가 정리하기 화면에서 뜨도록 `lesson.js`가 그 단계를 열어 주고, 통과하면 원래 단계로 되돌아온다). rethink는 지금까지와 같다.
  - 통과할 답이면 화면이 움직이지 않고 서버도 부르지 않는다(`AnswerCheck.settled`).
- **'더 탐구하고 싶은 점'은 필수**다. 비워 두면 마치지 못하고, 내용은 **느슨하게만**(stage `"curiosity"`) 본다 — 무의미·완전히 딴 이야기만 막고 되짚기(rethink)는 없다. 서버(`check-answer`)도 같은 기준을 쓴다(**함수를 다시 배포해야 한다**).
  화면 문구("(비워 두어도 마칠 수 있어요)" 등)는 `lesson.js`가 보여 줄 때만 다듬는다 — `lesson-config.js`와 `detail.qa`는 그대로다.
- **체험 모드**(비로그인·사이트 잠금 꺼짐)에서는 서버를 부르지 않고, 로컬 규칙만으로 판단해 **그대로 통과**시킨다(전에는 좋은 답에도 되짚기 카드가 한 번 떴다 — scope-fix review M1).
- `'🎉 학습 마치기'를 눌러야 선생님에게 제출돼요` 안내가 버튼 바로 위에 늘 보이고(`.ss-submit-note`), 마친 뒤에는 `제출 완료`/`제출 안 됨`으로 바뀐다.
