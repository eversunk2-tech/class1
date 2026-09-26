# science-guide — 과학 차시 조사 도우미 앱 공통 틀

**실험이 없는 조사하기 차시**(`CLAUDE.md` 과학 차시 앱 규칙) 앱이 함께 쓰는 정본이다. 실험 시뮬레이션 앱의 `science-sim/`과 짝을 이룬다.
각 앱은 이 폴더를 통째로 `science-guide/`에 **복사**해서 쓴다(앱은 자체 완결). 정본을 고치면 쓰고 있는 모든 앱 폴더에 다시 복사한다.

첫 사례: `public/apps/sci-6-1-1-5/`(산성 용액과 염기성 용액을 이용하는 예를 찾아라!).
3D·그래프가 없으므로 three.js를 불러오지 않는다(supabase-js만).

단계 흐름(권장): **조사 시작하기(도입 질문+힌트) → 조사하기(참고 자료·조사 팁·정리 틀) → 발표(공유) 준비하기 → 정리 질문(보기 고르기+결론·발전 질문) → 궁금한 점**.
단계 이름과 개수는 config의 `stages`로 바꿀 수 있다(진행바는 5칸 격자이므로 5단계를 권장).

## 1. 파일

### science-sim에서 가져온 것

| 파일 | science-sim과 | 하는 일 |
|---|---|---|
| `persist.js` | **같음** | localStorage 임시 저장, `SciSim.el`·`rich`·`josa`·`debounce`. 맨 위에서 글꼴 CSS를 첫 화면을 막지 않게 `<link>`로 붙인다(2026-09-24, science-sim과 같은 코드) |
| `stage-nav.js` | 조금 다름 | 단계 진행바. **잠긴 단계에는 ✓(완료)를 보이지 않는다**(앞 단계를 비워 다시 잠겼을 때 표시 어긋남 방지) |
| `predict.js` | **같음** | 도입 질문(직접 타이핑) + 한 단계씩 열리는 힌트. 조사 앱에서는 "조사 시작하기"에 쓴다 |
| `conclude.js` | 조금 다름 | 적고 제출해야 모범 답안이 나오는 결론·발전 질문. **제출한 글(`sent`)만** 비교 칸과 `values()`에 쓴다. 제출 뒤 고치면 "다시 제출해야 반영돼요" 안내 |
| `curiosity.js` | **같음** | 더 탐구하고 싶은 점 |
| `answer-check.js` | **같음** | 답 되짚기·차단(머리 주석의 파일 이름만 다름). 설계: `docs/science/answer-check/spec.md` |
| `style-common.css` | 디자인 같음 | 공통 스타일(색 변수·카드·버튼·다크모드·단계바·퀴즈·비교). **색·글꼴·버튼·카드·단계 막대 디자인은 science-sim과 같다**(2026-09-24, science-sim README "디자인" 절). 레이아웃은 조사 도우미 판 그대로다 — science-sim의 2026-09-23 공통 틀 수정 1(낮은 화면 머리말 축소, 아래 막대 높이만큼의 여백·`scroll-margin`)과 실험 전용 규칙(카운트다운·관찰 확인 줄)은 넣지 않았다 |
| `lesson.js` | 조금 다름 | `texts` 옵션 추가(마침 카드 제목·안내, 처음부터 다시 확인 문구, 너무 긴 글 문구). **기본 문구가 "조사"** |
| `quiz.js` | 조금 다름 | 마지막 인자 `{ numLabel, key }` 추가(문항 앞 말 기본 "문제", 저장 키 기본 "analysis") |

> **2026-09-23 마치기 조건**: `lesson.js`가 '학습 마치기' 직전에 정리하기 답과 '더 탐구하고 싶은 점'(필수)을 한 번 더 본다.
> 자세한 내용은 `scripts/templates/science-sim/README.md`의 "마치기 조건"과 `docs/science/answer-check/finish-gate-report.md`를 본다(동작은 실험 앱과 같다).

"같음" 파일은 science-sim 정본을 고치면 여기에도 그대로 복사한다(`cp scripts/templates/science-sim/{persist,predict,curiosity}.js scripts/templates/science-guide/`. 머리 주석의 파일 이름만 `science-guide/`로 바꿨다).
`style-common.css`는 통째로 복사하지 않는다(위 표의 레이아웃 차이가 사라진다). science-sim에서 **디자인(색·글꼴·버튼·카드)** 규칙을 바꾸면 같은 규칙만 이 파일에 옮기고 `diff`로 차이가 위 표에 적은 것뿐인지 확인한다.
`stage-nav.js`·`conclude.js`는 2026-09 수정 1차에서 위 동작을 더해 달라졌으니 **덮어쓰지 말고** 차이를 옮긴다.
"조금 다름" 파일은 덧붙인 옵션이 모두 선택(기본값 있음)이라 나중에 science-sim 쪽으로 합쳐도 실험 앱이 깨지지 않는다.

### 조사 도우미 전용

| 파일 | 전역 이름 | 하는 일 |
|---|---|---|
| `ref-cards.js` | `SciSim.RefCards` | 지도서 근거 **조사 참고 자료 카드**(접기/펼치기, 무리별 목록·글, 출처 표시, 펼침 상태 저장). `locked`로 "먼저 적은 뒤에 공개"도 된다 |
| `tips-panel.js` | `SciSim.TipsPanel`, `SciSim.copyText` | **조사 팁**: 검색어 칩(누르면 **복사만**, 외부 검색으로 이동하지 않음), 지도서에 나온 누리집(새 창)·참고 도서, 출처 확인·인터넷 윤리·기기 안전 같은 팁 카드 |
| `worksheet.js` | `SciSim.Worksheet` | **조사 결과 정리 틀**: 칸(fields)을 config로 정함(글·긴 글·보기 고르기), 줄 더하기/지우기 또는 `fixed` 한 벌, 최소 줄 수·무리별 최소 개수(`requireEach`) 검사, 다 채운 뒤에만 열리는 **"지도서 예시와 비교"** 표. 이름이 같고 `mineField`(예: 성질)도 같으면 "✔ 있어요", **`mineField`가 다르면 "⚠ 성질이 달라요"**(초록 ✔ 없음, 표 아래 경고, 조사 이/가 자동). 이름 맞추기 규칙·별칭·`match: "exact"`는 파일 머리 주석 참고. 같은 내용 줄 막기 `unique`. `ws.mismatches()`로 불일치 목록을 받아 요약·detail에 쓸 수 있다. `fixed` 틀은 완료 문구가 "✔ 정리 틀의 칸을 모두 채웠어요."(`doneText`로 바꿈) |
| `share-prep.js` | `SciSim.SharePrep` | **발표(공유) 준비**: 내 조사 기록 요약, 발표 대본(선택: 템플릿으로 초안 만들기·복사하기), 확인할 점 체크리스트, 다른 모둠 예시 발표 → 새롭게 알게 된 점 적고 제출 → 예시 답 비교, 발표 태도 안내. 알게 된 점은 **제출한 글만** 비교·`values()`에 쓴다 |
| `topic-picker.js` | `SciSim.TopicPicker` | 조사 **주제 하나 고르기**(바꿀 때 확인, `onChange(새, 이전)`로 앱이 딸린 입력을 지울지 정함) |
| `style-guide.css` | — | 위 모듈 스타일. `style-common.css` **다음에** 불러온다. 로그인 안내 링크(`#login-hint a`) 터치 영역 44px도 여기서 준다 |

### 고친 기록

- **2026-09 수정 1차**(sci-6-1-1-5·6 review): ① `topic-picker` 375px 가로 스크롤 — 숨긴 잠김 안내가 legend 바로 뒤에 있어 `legend + * { clear: both }`가 목록에 닿지 않던 것을 `.sg-topic .sg-lock-note, .sg-topic-grid { clear: both }`로 고침(격자 최소 폭도 `min(200px, 100%)`). ② `worksheet` `fixed` 틀 완료 문구가 "줄을 더해 적어도 좋아요"로 나오던 것 → `doneText`. ③ 비교 표가 성질을 잘못 고른 기록에도 "✔ 있어요"를 붙이던 것 → "⚠ ○○이 달라요". ④ 제출 뒤 고친 글이 다시 제출하지 않아도 결과에 들어가던 것(`share-prep`·`conclude`). ⑤ 잠긴 단계의 ✓ 표시. 앱에서 따로 막던 임시 보완은 지울 것.
- **2026-09 수정 2차**(sci-6-1-2-6 review, 기존 앱과 하위 호환): ① `worksheet` 비교 표 이름 맞추기 — 예전에는 지도서 예시 줄마다 "한쪽이 다른 쪽을 품는" 첫 기록을 골라 "장치"가 두 장치에 ⚠를, "계단"이 "자동계단"에 ✔를 붙였다. 이제 **내 기록 한 줄마다 가장 잘 맞는 예시 한 줄**을 고른다(정확히 같음 > 별칭과 같음 > 더 길게 겹침). 가장 잘 맞는 예시가 둘 이상으로 비기면 어디에도 맞추지 않고 "어느 예시인지 알기 어려운 것"으로 따로 알린다 → 틀린 ⚠가 `mismatches()`(저장 detail)에 들어가지 않는다. 새 옵션 `compare.match: "exact"`(정확 일치만), `compare.aliases`·`rows[i].aliases`(별칭), `compare.genericNames`(뜻이 넓어 부분 일치로 쓰지 않을 말), `compare.minPartialLength`. 이름 비교는 띄어쓰기에 더해 문장 부호·괄호도 무시한다. 옵션을 넘기지 않으면 예전처럼 부분 일치(`contains`)로 맞춘다. ② "⚠ ○○이 달라요"의 조사를 받침에 따라 이/가로 고른다("설치 위치가 달라요"). ③ 행 중복 검사 `unique: "칸 id" | ["칸", …] | true`(+`uniqueMessage`) — 같은 내용을 적은 줄이 있으면 넘어가지 못하고 "같은 상황을 적은 줄이 있어요: 계단. …"으로 안내한다. ④ `persist.js`: 미뤄 둔 입력 저장(250ms)을 `pagehide`·`beforeunload`·`visibilitychange(hidden)` 때 바로 실행한다(science-sim과 같은 파일). ⑤ 비교 표의 기본 글자에서 '지도서'를 뺐다(학생 화면에 교사용 자료 이름을 쓰지 않음): 기본 버튼 "📘 예시 답안과 비교해 보기", 안내 "예시 답안에 없는 것을 …" 등. 이름은 `compare.refName`으로 바꾼다. (1단원 앱처럼 `buttonLabel`·`title`·`source`에 '지도서'를 직접 넘긴 앱은 그 글자가 그대로 나오므로 앱 config에서 고쳐야 한다.)
- **2026-09-25 실험 앱 개편 단계 A**(science-sim과 같은 코드, 기존 앱과 하위 호환): ① **머리말 접기** — `lesson.js`가 제목 줄(`.ss-topline`)의 제목 뒤에 "▲ 접기 / ▼ 펼치기"(`aria-expanded`, 44px)를 붙인다(저장 상태 배지 `.ss-sync`는 persist.js가 나중에 붙여 이 버튼 뒤, 줄 맨 끝에 온다). 접으면 계정 줄(`.ss-who`·`.ss-trial`)과 단계 메뉴(`#stage-nav`)가 감춰지고 제목 줄만 남는다(아래 이전/다음 버튼으로 계속 이동). 선택은 `persist.js`의 `SciSim.uiPref`(localStorage `ssUiPref:headerCollapsed` — `sci6` 접두사가 아닌 기기 UI 설정이라 로그아웃 때 안 지운다)에 기억, 애니메이션 없음. ② **단계 메뉴 칸 수** — `stage-nav.js`가 `--ss-steps`(단계 수)를 넣어 단계 수만큼 칸을 나눈다(4단계 앱에 빈 칸이 남지 않게, 5단계 앱은 그대로). 전체 화면 보기·끌기 도우미는 3D 실험 화면이 있는 science-sim에만 있다.
- **2026-09-26 `persist.js` 다시 맞춤**(review-dock R3, 사용자 허락): science-sim판에만 들어가 있던 **가짜 충돌 거르기**(떠날 때 보낸 내용의 지문 `sentFp`, 서버 기록이 이 기기 기록 안에 그대로 들어 있으면 충돌 창 없이 이 기기 기록을 올림 — `docs/science/template-fix-1-report.md`)와 **숫자로 끝나는 말의 조사**("실험 1을")를 옮겨 science-sim과 같은 파일로 되돌렸다(머리 주석 한 줄만 다름). 저장 키·저장 구조는 그대로. 앞으로 science-sim `persist.js`를 고치면 위 "같음" 규칙대로 여기에도 복사한다.

각 파일 맨 위 주석에 자세한 사용법(옵션 전체, 돌려주는 함수, 저장 키)이 있다.
학생 입력은 모두 `textContent`로만 넣는다(`innerHTML` 없음). `**굵게**`는 config 문구에서만 `SciSim.rich`로 처리한다.

## 2. 새 조사 차시 앱 만드는 절차

1. **지도서 분석** → 앱 `spec.md`에 조사 차시라는 판단과 근거 쪽수, 화면에 쓸 사실(참고 자료·예시·모범 답안) 표를 적는다. 화면의 사실은 **지도서 값만**.
2. 폴더 만들기: `public/apps/sci-{학기}-{단원}-{탐구}/`
   - `scripts/templates/science-guide/` → `science-guide/`로 **통째로 복사**
   - `scripts/templates/class1-record.js` → 폴더 바로 아래로 복사
   - `config.js`(SUPABASE_URL, anon key — 블로그와 같은 값. 시범 앱 것을 복사)
3. `index.html`: `public/apps/sci-6-1-1-5/index.html`을 복사해 제목·설명·"← 차시로" 주소(`../../science/?term=…&unit=…&lesson=<science-curriculum.ts의 lesson id>`)와 단계 `section`만 바꾼다.
   스크립트 순서: supabase-js(SRI) → `config.js` → `class1-record.js` → `science-guide/persist.js, stage-nav.js, lesson.js, predict.js, ref-cards.js, tips-panel.js, worksheet.js, share-prep.js, (topic-picker.js), quiz.js, conclude.js, curiosity.js` → `data/lesson-config.js` → `app.js`.
   스타일: `science-guide/style-common.css` → `science-guide/style-guide.css` → `style.css`.
4. `data/lesson-config.js`: 아래 3절 예시 중 알맞은 형을 골라 채운다.
5. `app.js`: 아래처럼 연결한다(`sci-6-1-1-5/app.js`가 실제 예, 약 250줄).
   ```js
   var store = SciSim.createStore(C.storageKey);
   var lesson = SciSim.Lesson.create({ appId: C.appId, store, toastEl: $("toast") });   // texts 기본값이 조사 문구
   var predict = SciSim.Predict.render($("predict-root"), { questions: [...], hints: C.intro.hints, minLength: 5 }, store, lesson.refresh);
   SciSim.RefCards.render($("ref-root"), C.research.referenceCards, store, { key: "refOpen" });
   SciSim.TipsPanel.render($("tips-root"), { keywords, sources, book, items: [...] }, { toast: lesson.toast });
   var ws = SciSim.Worksheet.render($("worksheet-root"), { fields, minRows, requireEach, compare: { columns, rows: C.research.modelExamples, matchField: "name" } }, store, lesson.refresh);
   var share = SciSim.SharePrep.render($("share-root"), { script, samples, reflect, etiquette }, store, lesson.refresh, { summary: () => ws.rows().map(…), toast: lesson.toast });
   var quiz = SciSim.Quiz.render($("quiz-root"), quizItems, store, onQuiz, { numLabel: "문제", key: "quiz" });
   var conclude = SciSim.Conclude.render($("conclude-root"), C.conclude, store, lesson.refresh, { minLength: 10 });
   var curiosity = SciSim.Curiosity.render($("curiosity-root"), C.curiosity, store, lesson.refresh);
   lesson.finish({ button, msgEl, loginHintEl, doneEl, canFinish, detail, summary });   // nav보다 먼저
   lesson.restart($("btn-restart"));
   lesson.nav({ el: $("stage-nav"), stages: C.stages, prevBtn, nextBtn,
                gates: { research: () => predict.isDone() || "…", share: () => ws.status() === true || ws.status(), … },
                done: { … }, onEnter: { share: share.refresh } });
   ```
   `ws.status()`·`share.status()`는 `true` 또는 "못 넘어가는 까닭" 문자열을 돌려주므로 단계 조건(gates)에 그대로 쓸 수 있다.
6. 저장 detail(`class1-record.js`, 16,000자 이하): 도입 답·열어 본 힌트 수, 정리 틀(`ws.rows()`), 비교 표를 열어 봤는지, 발표 대본·알게 된 점, 퀴즈 선택(보기 글자)·정답 여부·시도 횟수, 결론·발전 질문, 궁금한 점. 정리 틀은 `maxRows`와 칸별 `maxlength`로 크기를 제한한다.
7. 확인: 태블릿 가로(1024×768)·세로(768×1024), 휴대폰 375px(가로 스크롤 없음), 다크모드, 새로고침 복원, 앞 단계로 돌아가 정리 틀 고치기(고쳐서 조건이 깨지면 뒤 단계가 다시 잠김), 처음부터 다시, 비로그인 흐름·저장 호출(가짜 응답), 콘솔 오류 0.

## 3. config 예시

### (1) 여러 예를 모아 적는 형 — 예: 6-1-1-5 산·염기 이용 예 (`public/apps/sci-6-1-1-5/`)

정리 틀: 한 줄에 하나(용액 이름 / 성질 고르기 / 이용하는 예), 3줄 이상 + 산성·염기성 각 1개 이상. 다 적은 뒤 지도서 예시 8개와 비교.

```js
window.LessonConfig = {
  appId: "sci-6-1-1-5", kind: "guide", storageKey: "sci6115guide:v1",
  stages: [{ id: "intro", label: "조사 시작하기" }, { id: "research", label: "조사하기" }, { id: "share", label: "발표 준비하기" },
           { id: "wrapup", label: "정리 질문" }, { id: "curiosity", label: "궁금한 점" }],
  intro: { question: "생선 요리에 레몬이 같이 나오는 까닭은 무엇일까요? …", hints: ["답이 아닌 생각거리", "…"], minLength: 5 },
  research: {
    referenceCards: { title: "📚 조사 참고 자료", source: "지도서 149쪽",
      groups: [{ id: "acid", label: "산성 용액", icon: "🍋", tone: "a", items: ["식초", …] },
               { id: "base", label: "염기성 용액", icon: "🧼", tone: "b", items: ["손 세정제", …] }] },
    tips: { keywords: ["산성 용액의 이용", …], sources: [{ label: "에듀넷", url: "https://www.edunet.net", note: "…" }], book: "…", … },
    worksheet: { minRows: 3, maxRows: 10,
      fields: [{ id: "name", label: "용액 이름", type: "text", maxlength: 40 },
               { id: "property", label: "성질", type: "choice", options: ["산성", "염기성"] },
               { id: "use", label: "이용하는 예", type: "textarea", maxlength: 200 }],
      requireEach: [{ field: "property", value: "산성", message: "…" }, { field: "property", value: "염기성", message: "…" }] },
    modelExamples: [{ name: "레몬즙", property: "산성", use: "…" }, …],   // 지도서 표 값만
  },
  share: { scriptPrompt: "…", minLength: 10, sampleTalks: [{ group: "1모둠", text: "…" }], reflectQuestion: "…", reflectModel: "…", etiquette: "…" },
  quiz: [{ id: "q1", text: "…", options: ["…", "…"], answer: "…", correct: "…", wrong: "…" }],   // app.js에서 quiz.js 형식({id,label}, answer 배열)으로 바꾼다
  conclude: [{ id: "conclusion", kind: "결론", prompt: "…", model: "…" }, { id: "ext1", kind: "발전 질문 1", … }],
  curiosity: { prompt: "…", minLength: 5 },
};
```

### (2) 주제 하나를 골라 깊게 조사하는 형 — 예: 6-1-1-6 산성화 피해(원인/피해/대책/출처)

주제 고르기 → 주제별 참고 자료(적은 뒤 공개) → 칸이 정해진 정리 틀 한 벌 → 템플릿으로 발표 초안 → 체크리스트.

```js
// app.js 연결 예(모양만. 값은 그 차시 spec의 지도서 값을 쓴다)
var topic = SciSim.TopicPicker.render($("topic-root"),
  { title: "조사할 주제를 하나 골라요", choices: C.intro.topicChoices,
    confirmChange: "주제를 바꾸면 조사하기에 적은 내용이 지워져요. 바꿀까요?",
    locked: () => predict.isDone() || "먼저 도입 질문에 내 생각을 적어요." },
  store, (id, prev) => { if (prev) { store.remove("research"); location.reload(); } });   // 주제에 딸린 입력 초기화 예

var ws = SciSim.Worksheet.render($("worksheet-root"), {
  title: "📝 조사 결과 정리하기", fixed: true, startRows: 1, incompleteText: "원인·피해·대책·출처를 모두 적어 주세요.",
  fields: [{ id: "cause", label: "원인", type: "textarea" }, { id: "damage", label: "피해(현황)", type: "textarea" },
           { id: "solution", label: "대책", type: "textarea" }, { id: "source", label: "어디서 찾았나요?(출처)", type: "text", maxlength: 100 }],
}, store, onWs, { key: "research" });

// 주제별 참고 자료: 정리 틀을 다 적은 뒤에 열린다(답 먼저 보기 방지). 주제가 바뀌면 다시 render 한다.
var ref = SciSim.RefCards.render($("ref-root"), {
  title: "📚 지도서 속 사실과 비교해 보기", source: "지도서 157쪽",
  groups: [{ id: "cause", label: "원인", text: T.facts.cause }, { id: "damage", label: "피해", text: T.facts.damage }, { id: "solution", label: "대책", text: T.facts.solution }],
  locked: () => ws.isDone() || "정리 틀을 먼저 채우면 열려요.",
}, store, { key: "refOpen" });
function onWs() { ref.refresh(); lesson.refresh(); }

SciSim.TipsPanel.render($("tips-root"), { keywords: T.searchTerms, sources: C.tips.sources, items: [{ icon: "✅", title: "출처 확인", text: C.tips.checkSource }] }, { toast: lesson.toast });

var share = SciSim.SharePrep.render($("share-root"), {
  script: { template: "{topic|은|는} {cause} 때문에 생기고, {damage} 같은 피해를 줍니다. 이를 줄이려면 {solution}", minLength: 10, copy: true,
            platformNote: "선생님이 안내한 모둠 공유 플랫폼에 옮겨 붙여 넣어요." },
  checklist: { title: "✅ 발표할 때 확인할 점", items: ["…", "…", "…"] },
}, store, lesson.refresh, { fill: () => Object.assign({ topic: topic.label() }, ws.allRows()[0] || {}), toast: lesson.toast });
```

보기 고르기와 서술형이 섞인 정리 질문은 `quiz.js`(보기)와 `conclude.js`(서술형)를 **같은 단계에 나란히** 두고, 퀴즈를 다 확인하면 서술형이 열리게 한다(`sci-6-1-1-5`의 `drawConcludeGate`). 빈칸 채우기도 `conclude.js` 한 문항(짧은 모범 답안)으로 처리할 수 있다.

## 4. 지켜야 할 것

- 화면의 사실(참고 자료·예시·모범 답안)은 **지도서 값만** 쓴다. 누리집·도서도 지도서에 나온 것만. 출처(쪽수)를 카드 아래에 적는다.
- 학생이 조사해 적은 내용은 **채점하지 않는다**(자유 기록). 지도서 예시 비교는 "내 기록에도 있는지"와 "내가 고른 값"을 보여 주고, 고른 값이 지도서와 **다르면 긍정 표시 대신 다시 보라고 알린다**(오개념을 그대로 두지 않음).
- 도입 질문에서는 답을 알려 주지 않는다. **힌트도 생각할 방향만** 준다(힌트 안에 성질 이름·정답 문장을 넣지 않는다). 발전 질문은 분석 질문·피드백에서 이미 답이 나온 내용을 되풀이하지 않는다. 지도서 예시(모범 답안이 되는 표)는 정리 틀을 채운 **뒤에만** 연다.
- 검색어는 복사만 하고 외부 검색 결과로 자동 이동하지 않는다. 외부 링크는 새 창 + `rel="noopener noreferrer"` + "선생님과 함께" 안내.
- 이 앱은 글을 올리거나 보내지 않는다(모둠 공유는 교실의 공유 플랫폼에서). 저장은 로그인했을 때 `class1-record.js`로만.
- 색만으로 구분하지 않는다: 무리 카드는 이름·기호 + 테두리 색, 성질 고르기는 글자 버튼.
- 디자인(2026-09-24): `scripts/templates/science-sim/README.md`의 "디자인" 절과 같다(주색 보라, 알약 버튼, 본문 Pretendard CDN, 제목 G마켓 산스 Bold + 부드러운 그림자 — 개편 5단계). 조사 도우미 카드 제목 `.sg-card-h`도 제목 글꼴로 그린다. `style-guide.css`의 무리 테두리 색(`--sg-tone-a/b/c`)은 자료를 나누는 색이라 바꾸지 않았다.
- 상대경로만(`./science-guide/…`), 외부 라이브러리는 supabase-js(버전 고정 + SRI)만. 글꼴 CSS만 예외로 `persist.js` 맨 위가 `<link>`로 붙인다(Pretendard는 jsDelivr, 버전 고정 + SRI / 제목 G마켓 산스는 사이트와 같은 파일 `../../fonts/gmarket-sans/gmarket-sans.css` — science-sim README 디자인 절). `style-common.css`에 `@import`를 넣지 않는다(첫 화면을 막는다).
- 저장 detail은 16,000자 이하(`class1-record.js`). 입력칸은 `maxlength`로 제한한다.
- **질문-답 표준 목록 `detail.qa`**(2026-09-22, `docs/admin/responses-spec.md` §3.3): `predict`·`quiz`·`conclude`·`curiosity`·`worksheet`·`share-prep`에 `qa(stage)`가 있다(science-sim과 같은 항목 모양, 기존 값은 그대로). 새 조사 도우미 앱은 `buildDetail()`에 `qa: [].concat(predict.qa("intro"), ws.qa("research"), share.qa("share"), quiz.qa("quiz"), conclude.qa("conclude"), cur.qa("curiosity"))`처럼 넣는다(단계 id는 그 앱의 `stages`에 맞춘다). 이미 만든 조사 도우미 앱 3개(sci-6-1-1-5·6, sci-6-1-2-6)는 소급하지 않고 `src/data/app-responses/` 매핑으로 보여 준다.

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
