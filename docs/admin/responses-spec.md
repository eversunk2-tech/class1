# 관리자 대시보드 — 학생 입력 모아 보기 · 피드백 · 일괄 칭찬 (spec)

> Plan 단계 산출물. **구현하지 않음.** `docs/admin/responses-plan-instructions.md`의 지침에 따라 12개 과학 앱의 실제 코드(`data/lesson-config.js`, `app.js`, `scripts/templates/science-sim|science-guide/*.js`)를 전부 읽고 조사했다.
> `docs/admin/spec.md`(특히 §14 확정 결정, §3.5~3.9 화면, §4 DB, §6 웹앱 기록 헬퍼)를 전제로 하며 그 위에 기능을 얹는다. 전제가 바뀌면 이 문서도 다시 검토해야 한다.

---

## 1. 요약

- 지금 관리자 화면은 `app_results.details`(jsonb — 학생이 실제로 적고 고른 내용)를 **어디서도 렌더링하지 않는다**(코드 전체를 검색해 확인함). 관리자는 점수·완료 여부·소요 시간만 본다.
- 12개 과학 앱을 실제로 조사한 결과, `details`의 모양은 **앱마다 전부 다르다**(§2). 질문 문구는 저장되지 않고, 필드 이름·선택지 id→라벨 해석 여부·정답 판정 방식까지 앱마다 제각각이다. 심지어 같은 "정리하기" 모듈(`conclude.js`)의 동작이 science-sim과 science-guide에서 다르다(§2.13, §10).
- 2026-09-22부터 과학 차시 앱 제작 기준이 "7분 이내·질문 최소화"로 바뀌었고(`CLAUDE.md` 과학 차시 앱 규칙), 1단원 6개와 2단원 탐구 1·2·6(총 9개)은 **이전(긴) 기준**, 2단원 탐구 3·4·5(3개)는 **새(짧은) 기준**으로 만들어졌다. 두 기준은 `detail` 모양도 구조적으로 다르다(발전 질문 유무, 궁금한 점 필수 여부 등) — 이 사실이 매핑 설계 전체의 축이다.
- 그래서 매핑은 두 갈래로 간다: **(a) 이미 만든 12개 앱**은 앱마다 손으로 조사해 만든 "응답 매핑" 데이터(`src/data/app-responses/`)로 표시하고, **(b) 앞으로 만들 앱**(특히 새 기준 이후)은 공통 틀(`scripts/templates/science-*/*.js`)에 `qa()`를 추가해 `detail.qa = [{ stage, id, question, kind, answer }]`를 자동으로 함께 저장하게 해, 매핑 파일 없이도 표시되게 한다(하위 호환, 기존 필드는 그대로 둠).
- 화면은 `/admin/learning/`에 새 탭 **"학생 응답"**(`?tab=responses&app=`)을 추가한다. ① 앱 선택 → 학생별 응답 모아 보기(완료/진행 중 구분) ② 질문별로 반 전체 답 비교 ③ 회원 상세(`/admin/members/`)의 "웹앱 결과" 탭에서도 결과 행마다 같은 패널을 펼쳐 볼 수 있다.
- 개별 피드백은 기존 `feedback_threads`(`context_type='app_result'`)를 그대로 재사용한다 — **새 테이블이 필요 없다.**
- 일괄 칭찬도 놀랍게도 **새 RPC가 필요 없다** — 기존 `get_or_create_feedback_thread` + `feedback_messages` insert(둘 다 관리자가 이미 임의 학생에게 쓸 수 있음)를 클라이언트에서 학생별로 반복 호출하면 된다. 새로 필요한 DB 객체는 **딱 하나, 칭찬 문구를 담는 작은 테이블(`praise_presets`)**뿐이다(§5).
- 진행 중(미완료) 학생의 입력은 `app_progress.state`에서 가져올 수 있지만, 그 안의 키 이름이 `detail`보다 훨씬 더 앱마다 들쭉날쭉하다(예: 퀴즈 저장 키가 어떤 앱은 `"analysis"`, 어떤 앱은 `"quiz"`). 1차 범위에서는 필드별 표시 대신 **진행률 + 마지막 저장 시각**만 보여주고, 원한다면 원본 JSON을 펼쳐 보는 안전망만 둔다(§11 Q3).

---

## 2. 앱별 `detail`·`app_progress` 구조 조사표 (12개, 실제 코드 확인)

### 2.0 공통 구조

모든 앱은 같은 저장 경로를 탄다: `app.js`의 `buildDetail()`(또는 동등 함수) → `lesson.finish({ detail: buildDetail, ... })`(`scripts/templates/science-sim|science-guide/lesson.js`) → `Class1Record.save({ completed, durationSec, detail, expectedUserId })`(`class1-record.js`) → `app_results` 테이블 `insert`. **`app_results.details`는 정확히 `buildDetail()`이 반환한 객체**다(16,000자를 넘으면 `shrinkDetail()`이 가장 긴 문자열부터 줄여서 저장 — 학생 글이 잘릴 수 있음).

공통 스테이지 모듈(6개 다 같은 소스, `scripts/templates/science-sim/*.js`)이 반환하는 값 모양(정본 확인):

| 모듈 | 화면 | `values()`/`result()` 반환 | 저장 키(기본값) | 비고 |
|---|---|---|---|---|
| `Predict` | 예상하기 | `{ [qid]: "trim된 답" }` | `predict` | `hints`(연 힌트 수)는 별도 키 |
| `Quiz` | 보기 고르기 분석 | `{ [qid]: { choice: [옵션id,...], correct, tries } }` | **science-sim: `analysis`(고정)** / **science-guide: `options.key`(기본 `"analysis"`, 앱마다 `"quiz"`로 덮어쓰기도 함)** | `choice`는 원래 **옵션 id 배열** — 대부분 앱이 `buildDetail()`에서 `LessonConfig.quiz[].options[].label`로 사람이 읽을 라벨로 바꿔서 저장한다(모든 조사 대상 앱이 이렇게 함, 그러나 강제되는 규칙은 아니다) |
| `Conclude` | 정리하기(결론/발전 질문) | `{ [id]: "text" }` | `conclude` | **science-sim과 science-guide의 동작이 다르다.** sim은 "제출" 여부와 무관하게 **현재 입력창 내용**을 돌려주고(`state[id].text`), guide는 **명시적으로 "제출"을 누른 마지막 텍스트만**(`state[id].sent`, 제출 안 했으면 `""`) 돌려준다. 즉 sim 계열 앱의 `detail.conclusion`은 학생이 "모범 답안 보기"를 누르지 않고 마친 경우에도 초안이 그대로 담길 수 있다 |
| `Curiosity` | 궁금한 점 | `"trim된 한 줄"` | `curiosity` | 앱마다 필수/선택·글자수 제한이 다르다(§2.14) |
| `Sorter`(단일/`renderRounds`) | 분류하기 | `{ groups: {binId:[itemId,...]}, correct, tries }` (여러 라운드면 라운드id로 감쌈) | 앱이 정하는 `cfg.id`(보통 `classify`) | 그룹 멤버는 **원본 item id**(대개 원본 용액/물체 이름과 같음) |
| `RecordStore` | 기록(측정/관찰) | `list()` → 레코드 배열, 필드는 앱이 `upsert()`에 넣은 그대로 | 앱이 정하는 `key`(보통 `records`) | **필드 이름이 앱마다 완전히 다르다**(§2 표) — 가장 재사용이 어려운 부분 |
| `Worksheet`(science-guide 전용) | 조사 결과 정리 | `rows()`(다 채운 줄만), `mismatches()`, `compareOpened()` | 앱이 정하는 `key`(보통 `worksheet`) | 칸(`fields`) 구성 자체가 앱마다 다름(자유 정의) |
| `SharePrep`(science-guide 전용) | 발표 준비 | `values()` → `{ script, reflect, checked }` | `share` | `checked`는 체크리스트 미설정이면 `undefined` |

`app_progress.state`(진행 중 스냅샷, `class1-record.js` `saveProgress`/`science-sim|guide/persist.js`)는 위 표의 "저장 키"들을 **`{ v:1, prefix, keys: { <저장 키>: <값>, ... }, savedAt }`** 형태로 그대로 평면 덤프한 것이다. **`detail`과 달리 id→라벨 변환을 거치지 않은 원본**이 들어 있다(예: 퀴즈의 `choice`가 옵션 id 그대로). 따라서 `detail`용으로 짠 매핑을 `app_progress.state`에 그대로 쓸 수 없다(§3.4, §11).

### 2.1 sci-6-1-1-1 — 여러 가지 용액을 분류해 볼까? (sim · 구 기준)

stages: 예상하기 → 실험하기 → 기록·분석하기 → 정리하기 → 궁금한 점

`buildDetail()`(`app.js:827-857`):

| `detail` 경로 | 타입 | 매핑(LessonConfig) |
|---|---|---|
| `predict.q1`/`q2` | string | `predict.questions[0/1].text` |
| `records[]` = `{solution, method, result, recordedAt}` | array | `solutions[].name` × `methods[].name`, `result`는 `results[solution][method]`와 비교 가능 |
| `skipped[]` = `{solution, method, reason}` | array(고정 1건) | 안전상 관찰 안 함(묽은 염산·냄새) — 질문·답이 아니라 **안내문 기록**, Q&A로 취급하지 않는다 |
| `myCriterion` = `{criterion, result}` | object | **공통 모듈이 아니라 이 앱 전용 인라인 코드**(`renderMyCriterion`, `app.js:80`). `LessonConfig.myCriterion.questions[]`(id: `criterion`,`result`) |
| `analysis.criteria` = `{choice[], correct, tries}` | object | `quiz[0]`(`id:"criteria"`), 다중 선택, `choice`는 이미 라벨 |
| `classify.{color,transparent,foam}` = `{groups,correct,tries}` (3라운드) | object | `classify.rounds[]`(`Sorter.renderRounds`), 그룹 멤버는 원본 용액 이름 |
| `conclusion` | string | `conclude[0]` |
| `extension.q1`/`q2` | string | `conclude[1]`/`[2]` |
| `curiosity` | string | `curiosity.prompt` |

`app_progress` 추가 키: `predict`,`hints`,`records`,`mycrit`(추정, 앱 전용),`analysis`,`classify`,`conclude`,`curiosity`.

### 2.2 sci-6-1-1-2 — 지시약으로 여러 가지 용액을 분류해 볼까? (sim · 구 기준)

`buildDetail()`(`app.js:729-757`): `predict{q1,q2}`, `records[]={phase,solution,indicator,result,recordedAt}`, `classify={groups:{acid,base},correct,tries}`(단일 라운드), `analysis.q1..q5`, `conclusion`, `extension{q1,q2}`, `curiosity`.

- **주의**: `records[].indicator`는 **원본 id 그대로**(`"리트머스파랑"` 등) 저장되며 화면 표시 이름(`"푸른색 리트머스 시험지"`)과 다르다 — `LessonConfig.indicators[].name`으로 한 번 더 풀어야 한다(이 앱은 예외적으로 id 미해석).
- `analysis.qN.choice`는 이미 라벨 문자열.

### 2.3 sci-6-1-1-3 — 산성 용액과 염기성 용액의 성질을 비교해 볼까? (sim · 구 기준)

`buildDetail()`(`app.js:796-828`): `predict{q1,q2}`, `records[]={solution,material,result,recordedAt}`(**solution/material은 사람이 읽는 이름으로 미리 변환해서 저장**, `SOL[r.solution].name` 식), `analysis.q1..q4`, `conclusion`, `extension{q1,q2}`, `curiosity`. **`classify` 없음**(분류 활동이 아예 없는 차시).

### 2.4 sci-6-1-1-4 — 산성 용액과 염기성 용액을 섞으면 어떻게 될까? (sim · 구 기준)

`buildDetail()`(`app.js:931-958`): `predict{q1,q2}`, `records[]={phase,drops,colorFamily,recordedAt}`(`drops`는 숫자, `colorFamily`는 이미 라벨), `analysis`는 **키가 `q1..qN`이 아니라 `{readA, inferA, q1, q2, q3}`**(질문마다 의미 있는 id를 씀 — 일반화된 "q1..qN 가정" 코드는 여기서 깨진다), `conclusion`, `extension{q1,q2}`, `curiosity`. `classify` 없음.

### 2.5 sci-6-1-1-5 — 산성 용액과 염기성 용액을 이용하는 예를 찾아라! (guide · 구 기준)

`buildDetail()`(`app.js:161-191`): `kind:"guide"`, `intro={answer,experience,hintsOpened}`(예상하기 질문 이름이 `q1/q2`가 아니라 `answer/experience`), `worksheet[]={name,property,use}`, `propertyDiffers[]={name,mine,guide}`(참고 예시와 다른 줄 — 보조 정보, Q&A 아님), `comparedWithModel`(bool), `share={script,reflect}`, `quiz.q1..q4`, `conclusion`, `extension{q1,q2}`, `curiosity`.

### 2.6 sci-6-1-1-6 — 산성화가 환경에 미치는 영향을 알아볼까? (guide · 구 기준)

가장 구조가 복잡한 앱. `buildDetail()`(`app.js:292-331`): `kind:"guide"`, `topic`(주제 선택, **이미 라벨로 변환**: "산성비"/"해양 산성화"/"토양 산성화"), `intro={q1,q2,hintsOpened,revised?}`(주제를 바꾸면 이전 조사 내용이 지워짐), `research`(worksheet가 **줄 1개 고정**이라 배열이 아니라 객체 `{cause,damage,solution,source}`), `openedFacts`(bool), `share={script,checked[],reflect}`, `fill`(빈칸 채우기, **별도 하위 store**(`fillStore`)에서 옴), `quiz.q1,q2`, `why`(발전 질문과 별개인 서술형), `extension`(**다른 앱과 달리 객체가 아니라 문자열 하나**), `conclusion`, `curiosity`.

### 2.7 sci-6-1-2-1 — 운동하는 물체의 특징을 찾아라! (sim · 구 기준)

`LessonConfig`에 `title`/`subtitle`/`kind` 자체가 없음(제목은 `science-curriculum.ts`에서 가져와야 함). `buildDetail()`(`app.js:1773-1801`): `predict{q1,q2}`, `records[]={scene,object,result,recordedAt}`(`object`는 이미 라벨), `analysis.q0..q4`, `conclusion`, `extension{q1,q2}`, `curiosity`, `safetyChecked`(**체크한 안전수칙 개수만** 저장, 어떤 항목인지는 저장 안 함).

### 2.8 sci-6-1-2-2 — 물체의 운동을 표현해 볼까? (sim · 구 기준)

가장 앱 전용 필드가 많은 예. `buildDetail()`(`app.js:1294-1334`, 직접 확인): `predict{q1,q2}`, `records[]={from,to,seconds,sentence|null,recordedAt}`(from/to는 꽃 이름으로 변환됨), `positions`(꽃마다 `{ok,wrongTries}` — 위치 나타내기 연습의 결과, 질문 텍스트는 화면 안내문이지 `LessonConfig` 질문 배열이 아님), `directions`(`"제비꽃→유채꽃": 초`처럼 **키 자체가 동적 문자열**), `countRetries`(`"제비꽃~유채꽃": 틀린 횟수`, 역시 동적 키), `analysis.q1..q4`(q4는 다중 선택), `conclusion`, `extension{q1,q2}`, `curiosity`.

- `directions`/`countRetries`처럼 **키 이름 자체가 데이터인** 필드는 범용 "질문-답" 테이블로 못 넣는다 — 앱 전용 렌더러가 필요하다(§3.2).

### 2.9 sci-6-1-2-3 — 같은 시간 동안 이동한 물체의 빠르기를 비교해 보자! (sim · **신 기준**, 직접 확인)

새 기준(질문 축소·7분) 적용 1호. `buildDetail()`(`app.js:807-833`): `predict{q1}`(질문 1개뿐), `hintsOpened`(다른 앱과 달리 **최상위 키**), `records[]`가 배열이지만 **항상 원소 1개**: `{time, red, blue}`(두 자동차의 이동 거리를 한 행에 같이 기록), `analysis.q1,q2`, `conclusion`(발전 질문 없음), `curiosity`(선택, `minLength` 지정 없음 → 기본 2자). `classify` 없음.

- **`analysis.q1`의 정답은 고정값이 아니라 학생 자신의 기록으로 채점한다**(`app.js`의 `q.grade`가 `farther(myRecord())`로 그때그때 정함, `dataGraded` 패턴은 없지만 동일 원리). 관리자 화면에서 "정답"을 보여주려면 `LessonConfig.quiz[].answer`만 보면 안 되고, 그 학생의 `records`를 함께 봐야 한다.

### 2.10 sci-6-1-2-4 — 같은 거리를 이동한 물체의 빠르기를 비교해 보자! (sim · **신 기준**, 직접 확인)

`buildDetail()`(`app.js:792-822`): `predict{q1}`, `records[]={car,distanceCm,time,stopwatch}`(car는 이미 라벨), `times[]`가 **길이 1의 배열**로 `{distanceCm, 초록색 자동차: t, 노란색 자동차: t}` 형태(자동차 이름이 동적 키), `analysis.q1,q2`, `conclusion`, `curiosity`. `classify`/`extension` 없음.

- `analysis.q1`은 `dataGraded: "shorterAt100"`로 **명시적으로 표시된** 자기 기록 채점 문항(`q.grade = function(choice){ var ans = fasterAt(D) || q.answer[0]; ... }`) — §2.9와 같은 패턴이지만 이 앱은 config에 `dataGraded` 필드로 신호를 남겨 둬서 감지하기 더 쉽다. 다른 앱은 이 표시가 없다(즉 `dataGraded` 필드 유무에 의존하면 §2.9를 놓친다 — 문항별로 `grade` 함수 존재 여부를 봐야 확실하지만, 그건 `app.js`를 읽어야 알 수 있고 관리자 화면에서는 알 방법이 없다 → §11 위험).

### 2.11 sci-6-1-2-5 — 물체의 빠르기를 속력으로 비교해 보자! (sim · **신 기준**)

`LessonConfig`에 `title`/`subtitle` 없음(과학수업 메뉴 쪽 `science-curriculum.ts`에서 가져와야 함). `curiosity` 단계가 내비게이션에 없고 "정리하기" 화면 안에 인라인으로 들어 있다(다른 앱과 스테이지 구성이 다름 — `stages`가 4개뿐: 예상/실험/분석/정리). `buildDetail()`(`app.js:926-954`): `predict{q1}`, `records[]={car,distance,time,speed,recordedAt}`(**`speed`는 저장 전에 이미 소수 첫째 자리로 반올림됨** — 화면 표시용 반올림이 아니라 저장값 자체가 반올림값), `examples[]`(학생이 직접 측정하지 않고 표에 미리 채워진 자동차 id 목록 — 질문-답이 아니라 메타정보), `analysis.order,units`, `conclusion`, `curiosity`(선택, 한 줄).

### 2.12 sci-6-1-2-6 — 속력과 관련된 안전 수칙과 안전장치를 조사해 볼까? (guide · **구 기준**, `CLAUDE.md`가 예외로 명시)

`buildDetail()`(`app.js:184-216`): `kind:"guide"`, `intro={zigzag,danger,hintsOpened}`(질문 이름이 또 다르다), `rules[]={situation,rule}`, `devices[]={name,place,func}`, `placeDiffers[]={name,mine,guide}`, `comparedWithModel={rules,devices}`, `share={script,reflect,checked}`, `quiz.q1,q2,q3`(퀴즈 저장 키를 `"quiz"`로 명시적으로 덮어씀 — 기본값 `"analysis"`가 아님), `conclusion`, `extension{q1,q2}`, `curiosity`(**필수**, `minLength:5`로 마침을 막음 — §2.9~2.11의 "선택"과 대비됨).

### 2.13 구조 조사에서 확인한 핵심 불일치 (표준 설계에 반드시 반영)

1. **퀴즈 저장 키가 앱마다 다르다**: science-sim은 항상 `"analysis"`(고정), science-guide는 기본 `"analysis"`이지만 앱이 `"quiz"`로 자유롭게 바꿀 수 있다(2.5는 `analysis`, 2.6/2.12는 `quiz`). → `app_progress.state`를 범용으로 읽는 코드는 이 키를 하드코딩하면 안 된다.
2. **`Conclude` 모듈이 science-sim/guide에서 동작이 다르다**: sim은 제출 여부와 무관하게 현재 입력을, guide는 "제출"을 누른 마지막 값만 돌려준다. 즉 **같은 `detail.conclusion` 필드라도 sim 계열 앱은 미완성 초안이 섞일 수 있다.** (§10 위험)
3. **id→라벨 변환이 일관되지 않는다**: 퀴즈 선택지는 거의 모든 앱이 라벨로 바꿔 저장하지만, 기록표(`records`)는 앱마다 다르다(1-1-2의 `indicator`는 원본 id, 1-1-3의 `solution`/`material`은 라벨, 1-2-1/1-2-4의 대상 이름은 라벨). 표준을 정하지 않으면 매핑 파일마다 각자 판단해야 한다.
4. **"발전 질문"(extension)의 모양이 3가지**: `{q1,q2}` 객체(대부분), 단일 문자열(1-1-6), 아예 없음(신 기준 3개 앱). 같은 이름의 필드를 가정하고 범용 렌더러를 짜면 깨진다.
5. **분석 문항 id가 `q1..qN`이 아닌 경우가 있다**(1-1-4의 `readA/inferA/q1/q2/q3`, 1-1-5/6·1-2-6의 `intro`/`topic` 쪽 id들) — 문항 순회는 항상 그 앱의 `LessonConfig.quiz[].id` 목록을 따라야 하고 "q1부터 순서대로"라고 가정하면 안 된다.
6. **일부 문항은 정답이 고정돼 있지 않고 학생 자신의 측정 기록으로 채점된다**(2.9, 2.10) — 관리자 화면에 "정답"을 함께 보여주려면 그 학생의 `records`도 같이 참조해야 하며, 이 사실을 코드에서 감지할 표준 신호(`dataGraded` 등)가 모든 앱에 있는 것도 아니다.
7. **구 기준 vs 신 기준으로 전체 구조가 다르다**(§1 요약) — 신 기준 3개 앱은 발전 질문 없음, 예상/분석 문항이 1~2개뿐, 궁금한 점이 선택(짧고 `minLength` 없음)인 반면, 구 기준 9개는 발전 질문 2개, 궁금한 점 필수(`minLength:5` 등)인 경우가 많다.
8. **일부 앱은 `LessonConfig`에 `title`/`subtitle`이 아예 없다**(1-2-1, 1-2-5) — 앱 제목의 신뢰할 수 있는 출처는 `LessonConfig`가 아니라 `src/data/science-curriculum.ts`(학기→단원→차시, `app: {id, kind}` 포함)다. **참고로 `src/data/apps.ts`의 `webApps` 배열은 현재 완전히 비어 있어서(`export const webApps: WebApp[] = []`) 관리자 화면의 `appLabelAdmin()`이 지금 이 12개 앱 전부를 "목록에 없는 앱"(raw app_id)으로 보여주고 있다** — 이 기능과 별개로 이미 존재하는 문제이지만, 이번에 만드는 앱 선택 드롭다운·제목 표시는 `science-curriculum.ts`를 기준으로 삼아야 한다(§11 Q9).

### 2.14 12개 앱 요약표

| app_id | 종류 | 기준 | classify | extension | curiosity | 퀴즈 저장키 | 비고 |
|---|---|---|---|---|---|---|---|
| sci-6-1-1-1 | sim | 구 | O(3라운드) | O | 필수 | analysis | `myCriterion` 전용 필드 |
| sci-6-1-1-2 | sim | 구 | O(1라운드) | O | 필수 | analysis | `records.indicator` 원본 id |
| sci-6-1-1-3 | sim | 구 | — | O | 필수 | analysis | records id→라벨 기 변환 |
| sci-6-1-1-4 | sim | 구 | — | O | 필수 | analysis | 분석 id가 q1..N 아님 |
| sci-6-1-1-5 | guide | 구 | — | O | 필수 | analysis | |
| sci-6-1-1-6 | guide | 구 | — | 문자열 1개 | 필수 | quiz | 별도 하위 store(`fill`) |
| sci-6-1-2-1 | sim | 구 | — | O | 필수 | analysis | title 없음, safetyChecked=개수만 |
| sci-6-1-2-2 | sim | 구 | — | O | 필수 | analysis | 동적 키(`directions`,`countRetries`) |
| sci-6-1-2-3 | sim | **신** | — | 없음 | 선택 | analysis | 자기 기록으로 채점(q1) |
| sci-6-1-2-4 | sim | **신** | — | 없음 | 선택 | analysis | `dataGraded` 표시 있음 |
| sci-6-1-2-5 | sim | **신** | — | 없음 | 선택 | analysis | title 없음, speed 저장 전 반올림 |
| sci-6-1-2-6 | guide | 구 | — | O | 필수 | quiz | |

---

## 3. 질문-답 표준 형식과 매핑 방식

### 3.1 (a) 이미 만든 12개 앱 — 앱별 매핑 데이터

§2에서 조사한 그대로, 앱마다 **손으로 작성한 매핑 파일**을 둔다.

```
src/data/app-responses/
  types.ts                 // ResponseSchema, QuestionSpec 등 공통 타입
  sci-6-1-1-1.ts           // ... 12개, appId별 1파일
  ...
  sci-6-1-2-6.ts
  index.ts                 // appId → ResponseSchema 레지스트리
```

`ResponseSchema`(스케치, Build 단계에서 확정):

```ts
type QuestionSpec = {
  stage: string;                 // "predict" 등 — 화면에서 스테이지별로 묶어 보여줌
  path: string;                  // detail 안의 dot-path, 예: "predict.q1", "analysis.q1"
  question: string;               // §2 조사로 이미 확보한 실제 질문/프롬프트 문구(한국어)
  kind: "text" | "choice" | "table" | "note";
  // choice: options에서 어떻게 correct/정답 라벨을 뽑을지(대부분 이미 라벨이라 그대로 표시하면 됨)
  // table: 배열 필드(records/worksheet 등)의 컬럼 라벨 매핑
  columns?: { key: string; label: string }[];
  // 값 해석이 더 필요하면(예: sci-6-1-1-2의 records.indicator) 여기서 조회 테이블을 붙인다
  resolve?: Record<string, string>;
};
type ResponseSchema = { appId: string; kind: "sim" | "guide"; standard: "legacy" | "slim"; questions: QuestionSpec[] };
```

이 문서의 §2 표가 12개 파일의 1차 초안 그 자체다(Build 단계에서 옮겨 적으면 된다 — 새로 조사할 필요 없음).

### 3.2 앱 전용 필드(동적 키, 자기 기록 채점) 처리

§2.13에서 확인했듯 일부 필드(1-1-1의 `myCriterion`, 1-2-2의 `directions`/`countRetries`, 1-2-3/1-2-4의 자기-기록 채점 문항)는 범용 규칙으로 못 담는다. `QuestionSpec`에 `kind:"table"`(동적 키 객체는 `Object.entries()`로 그냥 나열) 하나만 더 두고, 나머지는 **각 앱 매핑 파일 안에서 자유롭게 처리**하게 한다(작은 변환 함수를 파일별로 둬도 됨) — 12개뿐이라 완전 자동화보다 손으로 맞는 게 더 안전하고 빠르다.

### 3.3 (b) 앞으로 만들 앱 — 표준 `detail.qa[]`

공통 틀 각 모듈에 **`qa()`** 메서드를 추가한다(기존 `values()`/`result()`는 그대로 두고 추가만 함 — 하위 호환):

```js
// 예: Predict.render()가 돌려주는 객체에 추가
qa: function () {
  return cfg.questions.map(function (q) {
    return { stage: <lesson이 넘겨준 stage id>, id: q.id, question: q.text, kind: "text", answer: values()[q.id] };
  });
}
```

`Quiz`/`Conclude`/`Curiosity`/`Sorter`/`Worksheet`/`SharePrep`도 같은 방식으로(퀴즈는 `answer: {chosen:[라벨...], correct, tries}`, 분류는 `answer: {groups, correct, tries}`). 앱의 `buildDetail()`은 기존 필드에 한 줄만 추가한다:

```js
qa: [].concat(predict.qa(), quiz.qa(), classify ? classify.qa() : [], conclude.qa(), curiosity.qa())
```

수정 대상: `scripts/templates/science-sim/{predict,quiz,conclude,curiosity,sorter}.js`, `scripts/templates/science-guide/{predict,quiz,conclude,curiosity,worksheet,share-prep}.js`(7~8개 정본 파일). **기존 12개 앱을 소급 수정할지는 §11 Q1의 열린 질문**으로 남긴다 — 추천은 "소급하지 않음"이다.

### 3.4 화면에서의 우선순위(폴백 3단계)

1. `src/data/app-responses/{appId}.ts`가 있으면 그걸로 렌더링(12개 전부 여기 해당).
2. 없지만 `detail.qa`가 배열로 있으면(§3.3, 앞으로 만들 앱) 그걸로 범용 렌더링.
3. 둘 다 없으면 **원본 JSON을 보기 좋게 접어서 보여주는 안전망**(빈 화면보다 낫다 — 새 앱을 배포하고 매핑을 깜빡해도 데이터가 묻히지 않는다).

진행 중(미완료) 학생은 `app_progress.state.keys`가 있지만 §2.13-①처럼 저장 키 이름이 `detail`과 다를 수 있어 1·2단계 매핑을 그대로 쓸 수 없다 — §4.2/§11 Q3에서 범위를 줄인다(진행률만 표시).

---

## 4. 화면 목록·상세

### 4.1 목록

| # | 화면 | URL | 비고 |
|---|---|---|---|
| 1 | 학습 현황 › 학생 응답(앱별) | `/admin/learning/?tab=responses&app=<id>&view=student` | 신규 탭. 기본 view |
| 2 | 학습 현황 › 학생 응답(질문별) | `/admin/learning/?tab=responses&app=<id>&view=question&q=<path>` | 같은 탭, 세그먼트 전환 |
| 3 | 회원 상세 › 웹앱 결과 확장 | `/admin/members/?id=<uuid>&tab=apps` (기존 화면에 펼치기 추가) | 새 URL 없음, 기존 행에 붙임 |
| 4 | 일괄 칭찬 다이얼로그 | (1의 화면 위 다이얼로그, URL 없음) | §4.5 |

`?tab=responses`는 기존 `LearningView`의 `TABS` 배열에 추가한다(§9.3). `app`/`view`/`q`는 기존 `assignment` 파라미터와 같은 방식으로 `useSearchParams`로 읽는다(이미 `<Suspense>` 경계 있음).

### 4.2 학생 응답 — 학생별 보기(기본)

- **상단**: 앱 선택 드롭다운. 옵션 소스는 `science-curriculum.ts`를 순회해 `app` 필드가 있는 차시만 모은 목록(§2.13-⑧의 이유로 `webApps`가 아니라 이걸 1차 소스로 쓴다 — `webApps`를 채우는 건 이 기능의 범위 밖). 검색창(이름), 정렬(이름순/완료·진행중/의심 표시).
- **본문**: 학생별 카드 목록. 카드 헤더 = 학생 이름·아바타(`StudentLink` 재사용) + 상태 배지(완료/진행 중) + 마지막 활동 시각.
  - **완료 학생**: 그 학생의 **가장 최근 완료된 `app_results`** 행 하나를 골라(여러 번 다시 했으면 최신 것) `ResponsePanel`(§4.4)로 스테이지별 질문-답을 펼쳐 보여준다. 카드 안에 "피드백" 버튼(`FeedbackDialogButton`, context `app_result`+그 결과 id).
  - **진행 중 학생**(완료 기록 없이 `app_progress` 행만 있는 경우): "진행 중 — N/M 단계, 마지막 저장 HH:MM" + "원본 데이터 보기"(접힌 JSON, 관리자만) — 필드별 표시는 하지 않는다(§3.4, §11 Q3).
  - **아무 기록도 없는 학생**: 흐리게 "아직 시작하지 않음".
- **상태**: 로딩/빈("이 앱을 완료하거나 시작한 학생이 없습니다")/오류. 앱을 등록된 게 없으면 안내.
- **권한**: 관리자만.

### 4.3 학생 응답 — 질문별 비교

- 상단에 같은 앱 선택 유지 + "질문" 드롭다운(그 앱의 `ResponseSchema.questions`를 스테이지 순서대로, `table`/`note` 종류는 목록에서 제외하거나 별도 표시).
- 본문: 그 질문 하나에 대해 **전체 학생의 답을 표로** — 학생, 답(텍스트 전체 또는 고른 선택지), 정답 여부(있으면), 일시. 선택형 문항은 위에 간단한 분포(보기별 선택 인원)도 보여준다.
- 서술형은 줄이지 않고 전체 표시(요약 X) — 교사가 한눈에 비교하려는 목적이므로 잘리면 의미가 없다. 대신 표 폭보다 길면 줄바꿈.
- 각 행에도 "피드백" 버튼.

### 4.4 공통 컴포넌트 `ResponsePanel`

- 입력: 하나의 `AppResult`(`details` 포함) + 그 앱의 `ResponseSchema | null`.
- 스키마 있으면 스테이지별 섹션(예상하기/실험하기/…)으로 나눠 질문(회색 작은 글씨) + 답(본문)을 카드로. 선택형은 "학생 답: … / 정답: … (○/×, N번째 시도)". 표(`records` 등)는 작은 데이터 표로.
- 스키마 없고 `details.qa` 있으면 그 배열을 스테이지로 묶어 같은 방식으로.
- 둘 다 없으면 `<pre>`로 JSON pretty-print(접기 기본, 관리자만, **`dangerouslySetInnerHTML` 금지 — 텍스트 노드로만 렌더링**해 XSS를 막는다. 기존 `FeedbackThread`가 이미 이 원칙을 따른다).
- 3곳(§4.2/§4.3/§4.6)에서 재사용.

### 4.5 일괄 칭찬 다이얼로그

- 진입: §4.2 화면 상단 "칭찬 보내기" 버튼(앱을 고른 상태에서만 활성).
- **대상 목록**: 그 앱을 완료한 학생 전체(체크박스 목록, 기본 전체 선택). 각 행에 "이미 보냄" 표시(그 학생의 최신 완료 결과에 연결된 `feedback_threads`(context `app_result`)에 **관리자가 보낸 메시지가 이미 있으면** 회색 처리 + 기본 체크 해제, 그래도 원하면 다시 체크해 보낼 수 있음 — 강제 차단 아님, 실수 방지용 표시만).
- **문구**: 미리 정의된 칭찬 문구 5~8개를 버튼처럼 나열(클릭하면 아래 미리보기 textarea에 채워짐) + 직접 입력 가능(같은 textarea, 자유 수정). `{이름}` 자리표시자 지원 — 전송 직전 학생별로 실제 이름으로 치환.
- **미리보기**: 선택한 학생 중 1명 이름으로 치환한 예시 문장을 보여준다("○○ 학생에게: …").
- **전송**: 확인 다이얼로그(대상 인원 수 표시, 60명 넘으면 "정말 맞나요?" 경고) → 학생별로 `getOrCreateFeedbackThread(studentId, {type:'app_result', id: 그 학생의 최신 완료 결과 id})` + `sendFeedbackMessage(threadId, 치환된 문구)`를 **동시성 제한(예: 5개씩)** 걸어 반복 호출(기존 `chunk()` 헬퍼 재사용). 진행 중 프로그레스("12/28 전송함"), 실패한 학생은 따로 모아 "재시도" 버튼.
- **결과**: 성공/실패 인원 요약 토스트.

### 4.6 회원 상세 연동

- `src/components/learning/activity-panels.tsx`의 `UserAppResults` 각 행에 "응답 보기" 토글 버튼을 추가해, 누르면 그 행 아래에 `ResponsePanel`을 펼친다(그 학생 화면·관리자 화면 공용 컴포넌트라 `audience==="admin"`일 때만 노출 — 학생 본인 화면(`/me/learning/`)에는 이 기능을 넣지 않는다, §11 Q6).

---

## 5. DB 변경 (재실행 안전)

### 5.1 결론 — 새 테이블 1개만 필요하다

`app_results.details`·`app_progress`는 이미 있다. 개별 피드백은 기존 `feedback_threads`/`feedback_messages`(§4.6 `20260921020000_admin_learning.sql`, `20260922000000_admin_learning_fixes.sql`)를 그대로 쓴다. 일괄 칭찬도 **기존 RPC(`get_or_create_feedback_thread`)와 기존 insert 정책만으로 충분**하다(관리자는 이미 어떤 학생의 스레드에도 메시지를 보낼 수 있음, §4.5). 새로 필요한 건 **칭찬 문구를 담는 작은 테이블**뿐이다.

### 5.2 `praise_presets`

```sql
-- supabase/migrations/20260923000000_praise_presets.sql (Build 단계에서 파일명 확정)
create table if not exists public.praise_presets (
  id         uuid primary key default gen_random_uuid(),
  body       text not null check (char_length(body) between 1 and 500),
  sort_order integer not null default 0,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

alter table public.praise_presets enable row level security;

drop policy if exists "praise_presets: 관리자만 조회" on public.praise_presets;
create policy "praise_presets: 관리자만 조회"
  on public.praise_presets for select
  to authenticated
  using (public.is_admin());

drop policy if exists "praise_presets: 관리자만 추가" on public.praise_presets;
create policy "praise_presets: 관리자만 추가"
  on public.praise_presets for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "praise_presets: 관리자만 수정" on public.praise_presets;
create policy "praise_presets: 관리자만 수정"
  on public.praise_presets for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "praise_presets: 관리자만 삭제" on public.praise_presets;
create policy "praise_presets: 관리자만 삭제"
  on public.praise_presets for delete
  to authenticated
  using (public.is_admin());

revoke all on public.praise_presets from anon, authenticated;
grant select, insert, update, delete on public.praise_presets to authenticated; -- RLS가 관리자만 걸러줌(member_directory와 같은 패턴)

-- 기본 문구 6개 시드. 테이블이 완전히 비어 있을 때만 넣는다(재실행 안전 — 교사가 이미 고쳤거나 지운 뒤
-- 다시 이 마이그레이션을 실행해도 중복/부활하지 않음). 문구는 §6 참고.
insert into public.praise_presets (body, sort_order)
select v.body, v.sort_order
from (values
  ('{이름} 학생, 오늘 활동을 끝까지 잘 마쳤어요! 실험 기록을 꼼꼼하게 남긴 점이 멋져요. 👏', 1),
  ('{이름} 학생, 예상한 내용과 실험 결과를 잘 비교해서 정리했어요. 계속 이렇게 해봐요!', 2),
  ('{이름} 학생, 분석 문제를 스스로 다시 생각해서 풀어낸 점이 훌륭해요. 최고예요! 🌟', 3),
  ('{이름} 학생, 궁금한 점을 적어낸 게 인상 깊어요. 다음 시간에 함께 알아볼까요?', 4),
  ('{이름} 학생, 오늘도 성실하게 끝까지 참여했어요. 수고 많았어요!', 5),
  ('{이름} 학생, 결론을 자신의 말로 잘 정리했어요. 과학자처럼 생각하고 있어요! 🔬', 6)
) as v(body, sort_order)
where not exists (select 1 from public.praise_presets);
```

- 새 RPC 없음. 새 컬럼 없음. 기존 테이블 변경 없음.
- 인덱스: 행 수가 몇 개뿐이라 불필요(`sort_order`로 클라이언트 정렬).
- **선택적(§11 Q7 참고)**: "이미 보낸 학생" 표시를 서버 집계로 하고 싶으면 아래 조회 전용 함수를 추가할 수 있다(없어도 §4.5는 클라이언트 쿼리로 동작함 — 필수 아님).

```sql
-- 선택: 앱별로 학생마다 (최신 완료 결과 id, 관리자가 이미 답한 적 있는지)를 한 번에 계산.
-- 없어도 되는 이유: 클라이언트에서 app_results + feedback_threads + feedback_messages를 조합 조회해도 학급 규모에서는 충분히 빠르다.
create or replace function public.app_result_feedback_status(p_app_id text)
returns table (user_id uuid, result_id uuid, admin_replied boolean)
language sql
stable
set search_path = ''
as $$
  select distinct on (r.user_id)
    r.user_id, r.id,
    exists (
      select 1 from public.feedback_threads t
      join public.feedback_messages m on m.thread_id = t.id
      where t.context_type = 'app_result' and t.context_id = r.id and m.sender_id <> r.user_id
    )
  from public.app_results r
  where r.app_id = p_app_id and r.completed and public.is_admin()
  order by r.user_id, r.created_at desc;
$$;

revoke all on function public.app_result_feedback_status(text) from public, anon;
grant execute on function public.app_result_feedback_status(text) to authenticated;
```

### 5.3 RLS 요약

| 테이블 | select | insert | update | delete |
|---|---|---|---|---|
| `praise_presets`(신규) | 관리자만 | 관리자만 | 관리자만 | 관리자만 |

기존 `app_results`/`app_progress`/`feedback_*`는 변경 없음(§docs/admin/spec.md §4/§8 그대로).

---

## 6. 칭찬 문구 초안

6학년 눈높이, 따뜻하고 구체적, 너무 길지 않게(1~2문장). `{이름}` 치환 지원(전송 직전 클라이언트에서 학생 표시 이름으로 바꿈, 치환 안 쓰면 그대로 둬도 됨). 기본 6개(§5.2 시드와 동일, 교사가 이후 대시보드에서 자유롭게 추가·수정·삭제):

1. "{이름} 학생, 오늘 활동을 끝까지 잘 마쳤어요! 실험 기록을 꼼꼼하게 남긴 점이 멋져요. 👏"
2. "{이름} 학생, 예상한 내용과 실험 결과를 잘 비교해서 정리했어요. 계속 이렇게 해봐요!"
3. "{이름} 학생, 분석 문제를 스스로 다시 생각해서 풀어낸 점이 훌륭해요. 최고예요! 🌟"
4. "{이름} 학생, 궁금한 점을 적어낸 게 인상 깊어요. 다음 시간에 함께 알아볼까요?"
5. "{이름} 학생, 오늘도 성실하게 끝까지 참여했어요. 수고 많았어요!"
6. "{이름} 학생, 결론을 자신의 말로 잘 정리했어요. 과학자처럼 생각하고 있어요! 🔬"

---

## 7. 파일 구조 (신규/수정)

### 7.1 신규

| 경로 | 역할 |
|---|---|
| `supabase/migrations/20260923000000_praise_presets.sql` | §5.2 |
| `src/data/app-responses/types.ts` | `ResponseSchema`/`QuestionSpec` 타입 |
| `src/data/app-responses/sci-6-1-*.ts` (12개) | §2 조사 결과를 옮긴 앱별 매핑 |
| `src/data/app-responses/index.ts` | appId → schema 레지스트리, `science-curriculum.ts` 기반 앱 목록 헬퍼 |
| `src/lib/app-responses.ts` | `extractQA(schema\|null, details)`(§3.4 폴백 3단계), 앱 progress 진행률 계산 헬퍼 |
| `src/components/learning/response-panel.tsx` | §4.4 `ResponsePanel` |
| `src/app/admin/(dashboard)/learning/responses-view.tsx` | §4.2/§4.3 화면 |
| `src/components/admin/praise-dialog.tsx` | §4.5 일괄 칭찬 다이얼로그 |
| `src/components/admin/praise-preset-manager.tsx` | 칭찬 문구 추가/수정/삭제(작은 목록, `assignment-manager.tsx`의 CRUD 패턴 재사용) |
| `src/lib/praise.ts` | `praise_presets` CRUD 쿼리 헬퍼(`learning.ts`와 같은 자리에 둬도 됨, 성격이 달라 분리 추천) |

### 7.2 수정

| 경로 | 변경 |
|---|---|
| `src/app/admin/(dashboard)/learning/learning-view.tsx` | `TABS`에 `responses`("학생 응답") 추가 |
| `src/app/admin/(dashboard)/learning/app-results-view.tsx` | 행마다 "응답 보기" 딥링크(`?tab=responses&app=&student=`) 추가(선택) |
| `src/components/learning/activity-panels.tsx`(`UserAppResults`) | 행 펼치기로 `ResponsePanel` 연결(§4.6) |
| `scripts/templates/science-sim/{predict,quiz,conclude,curiosity,sorter}.js` | §3.3 `qa()` 추가(앞으로 앱용, 기존 앱엔 영향 없음 — 정본만 수정, 이미 복사된 12개 앱 폴더는 그대로 둠) |
| `scripts/templates/science-guide/{predict,quiz,conclude,curiosity,worksheet,share-prep}.js` | 위와 동일(guide 계열) |
| `docs/admin/spec.md` | §2 "학습 현황" 화면 목록에 `responses` 탭 존재를 반영(선택, 기록용) |

### 7.3 영향 없음(확인함)

`app_results`/`app_progress`/`feedback_*` 테이블·RLS·기존 웹앱 12개 폴더(정본만 고치고 이미 배포된 앱은 그대로 둠, §3.3) · `class1-record.js`(변경 없음, `detail`을 그대로 저장할 뿐 내용을 검사하지 않음).

---

## 8. 구현 단계 분할 (Build 서브에이전트용)

| 단계 | 범위 | 의존 |
|---|---|---|
| 0 | `praise_presets` 마이그레이션 파일 작성(§5.2). 실행은 사용자가 함 | — |
| 1 | `src/data/app-responses/`(타입 + 12개 매핑 파일 + 레지스트리) — 이 문서 §2를 그대로 옮겨 적는 작업, 새 조사 불필요 | — |
| 2 | `src/lib/app-responses.ts`(폴백 로직) + `ResponsePanel` 컴포넌트(스키마 있는 경우만 우선 구현) | 1 |
| 3 | `ResponsePanel`에 `detail.qa` 폴백 + 원본 JSON 폴백 추가 | 2 |
| 4 | `/admin/learning/?tab=responses` 학생별 보기(§4.2), 앱 목록은 `science-curriculum.ts` 기반 | 2, 3 |
| 5 | 질문별 비교 보기(§4.3) | 4 |
| 6 | 회원 상세 연동(§4.6) | 2, 3 |
| 7 | 일괄 칭찬: `praise_presets` CRUD(§7.1 `praise-preset-manager.tsx`) + 다이얼로그(§4.5, 기존 `get_or_create_feedback_thread`/`sendFeedbackMessage` 재사용) | 0(배포됨), 4 |
| 8 | (선택) `scripts/templates/science-*/*.js`에 `qa()` 추가 + 신 기준 3개 앱(1-2-3/1-2-4/1-2-5) `buildDetail()`에 한 줄씩 반영(§11 Q2) | 1 |
| 9 | 전체 QA(반응형/다크모드/`next build`), 12개 앱 각각 실제로 완료해 관리자 화면에서 확인 | 1~7 |

4·5·6은 §2 데이터만 있으면 병렬 가능. 7은 4가 끝나야 앱 선택 UI를 재사용할 수 있다. 8은 완전히 독립적이라 아무 때나 해도 된다.

---

## 9. 사용자가 할 일

1. **마이그레이션 실행**: Supabase 대시보드 SQL Editor에서 `20260923000000_praise_presets.sql` 실행 후 `select * from public.praise_presets;`로 기본 문구 6개가 들어갔는지 확인.
2. **칭찬 문구 검토**: §6 초안이 학급 분위기·학생 수준에 맞는지 훑어보고, 관리자 화면에서 자유롭게 고치거나 추가.
3. **`webApps`/앱 제목 출처 확인**: 이 기능은 앱 목록·제목을 `science-curriculum.ts`에서 가져온다(§2.13-⑧). `src/data/apps.ts`의 `webApps`가 계속 비어 있어도 이 기능엔 문제없지만, 다른 화면(메인 카드 등)에 영향이 있다면 별도로 채울지 결정.
4. **12개 앱을 실제로 한 번씩 완료**해 봐서(테스트 계정) 관리자 화면에서 §2 매핑이 실제 저장값과 맞는지 확인 — 조사는 코드 기준으로 했지만 실제 저장은 브라우저에서 한 번 더 확인하는 게 안전.
5. **§11 열린 질문**(특히 Q1·Q2·Q3·Q7) 검토 후 추천안 그대로 갈지 결정.

---

## 10. 위험과 한계

- **`Conclude` 모듈의 sim/guide 동작 차이(§2.13-②)**: science-sim 앱들의 `detail.conclusion`/`extension.*`은 학생이 "제출하고 모범 답안 보기"를 누르지 않고 마쳐도(다른 단계 조건만 채우면 마칠 수 있는 앱이 있다면) 미완성 초안이 담길 수 있다. 관리자 화면에 "제출 여부" 표시가 없어 겉보기엔 정상 답처럼 보일 수 있음 — 매핑 파일에서 이 점을 문서화하는 것 외에 근본 해결은 이번 범위 밖(앱 코드 수정 필요).
- **자기 기록으로 채점되는 문항(§2.9/§2.10)**: "정답"을 `LessonConfig.quiz[].answer`만 보고 표시하면 틀릴 수 있다. 두 앱은 매핑 파일에서 `records`를 함께 참조하는 특수 처리가 필요(§3.2) — 확장성 없는 임시방편이지만 대상이 2개뿐이라 감수.
- **진행 중 학생의 `app_progress.state` 키 불일치(§2.13-①)**: 필드별 표시를 시도하면 앱마다 다른 로직이 또 필요해진다. 1차 범위에서 진행률만 보여주기로 좁힌 것 자체가 이 위험의 완화책.
- **`app_results.details` 크기 제한(16,000자 클라이언트, 65,536바이트 DB 제약, `docs/admin/spec.md`/마이그레이션 확인)**: 아주 긴 서술형 답은 `shrinkDetail()`이 잘라서 저장했을 수 있다 — 관리자 화면에 "이 답은 길어서 줄었을 수 있음" 같은 표시는 하지 않는다(원본 어디에도 "잘림" 플래그가 없어 감지 불가, 한계로만 기록).
- **12개 매핑 파일의 유지보수 비용**: 어떤 앱의 `lesson-config.js`/`app.js`가 나중에 수정되면(문구 변경 등) 매핑 파일이 옛 질문 문구를 계속 보여줄 수 있다. 자동 동기화가 없으므로, 앱을 고칠 때 매핑 파일도 같이 고쳐야 한다는 관례를 `CLAUDE.md`나 앱별 `spec.md`에 남기는 걸 추천(§11 Q8).
- **일괄 칭찬의 "이미 보냄" 판정 오탐**: 관리자가 그 스레드에 이미 보낸 메시지가 "칭찬"이 아니라 다른 피드백이었어도 "이미 보냄"으로 표시된다(피드백과 칭찬을 구분하는 별도 표시가 없음) — §4.5에서 강제 차단이 아니라 표시만 하는 이유.
- **학생 입력 텍스트는 신뢰할 수 없는 값**: 관리자 화면 전체가 텍스트 노드로만 렌더링해야 한다(마크다운 렌더링 금지, `dangerouslySetInnerHTML` 금지) — 기존 `FeedbackThread`와 같은 원칙이라 새 위험은 아니지만, `ResponsePanel`을 새로 만들 때 반드시 지켜야 한다.

---

## 11. 열린 질문 (추천안 포함)

| # | 질문 | 추천안 |
|---|---|---|
| Q1 | 기존 9개(구 기준) 앱도 `detail.qa` 표준 형식으로 소급 적용할지 | **하지 않음.** 이미 학생들이 써서 데이터가 쌓여 있고, `buildDetail()`을 건드리면 회귀 위험이 있다. §2/§3.1의 손으로 만든 매핑 파일로 충분히 커버된다 |
| Q2 | 신 기준 3개(1-2-3/1-2-4/1-2-5)에 지금이라도 `qa()`를 반영할지 | **반영 추천.** 구조가 단순하고(문항 1~2개) 만든 지 얼마 안 돼 회귀 위험이 작다. 반영하면 "앞으로 앱" 예시가 바로 3개 생겨 표준의 실효성도 검증된다(§8 단계 8) |
| Q3 | 진행 중(미완료) 학생의 입력을 필드별로 보여줄지 | **1차는 진행률 + 마지막 저장 시각만.** §2.13-①의 키 불일치 때문에 필드별 표시는 앱마다 또 예외 처리가 필요해 범위가 커진다. 관리자가 꼭 봐야 하면 원본 JSON 펼치기로 대체 |
| Q4 | 칭찬 문구를 코드에 둘지 DB에 둘지 | **DB(`praise_presets`) 추천.** 이미 과제(`assignments`)도 DB 기반 CRUD라 일관되고, 교사가 재배포 없이 문구를 고칠 수 있다. 코드 상수보다 DB 테이블 하나 늘리는 비용이 작다 |
| Q5 | `{이름}` 치환을 언제 할지(전송 시점 vs 표시 시점) | **전송 직전 클라이언트에서 치환해 최종 문장을 저장.** `feedback_messages.body`는 이미 "그대로 보여주는" 원칙이라(마크다운도 아님) 저장 후에는 다시 해석하지 않는 편이 단순하고 나중에 학생 이름이 바뀌어도 그때 보낸 문구 그대로 남는다 |
| Q6 | 학생 본인 화면(`/me/learning/`)에도 자기 답을 정리해서 보여줄지 | **이번 범위 제외.** 요청은 "관리자가 확인"이 목적이라 학생 화면은 건드리지 않는다. 원한다면 같은 `ResponsePanel`을 나중에 `/me/learning/` 웹앱 결과 탭에도 재사용할 수 있게 컴포넌트를 설계해 뒀다(§4.4) |
| Q7 | "일괄 칭찬 대상"과 "이미 보냄" 판정을 서버 RPC로 집계할지, 클라이언트 조합 쿼리로 할지 | **클라이언트 조합 쿼리로 시작, 느리면 §5.2의 선택 RPC(`app_result_feedback_status`)로 전환.** 학급 규모(수십 명)에서는 몇 번의 쿼리로 충분하고, RPC를 처음부터 만들면 유지보수 대상이 하나 더 늘어난다 |
| Q8 | 앱 코드와 매핑 파일이 어긋나지 않게 하는 절차 | **앱별 `spec.md`/`build-*-instructions.md` 관례에 "detail 모양을 바꾸면 `src/data/app-responses/{appId}.ts`도 같이 고친다" 한 줄 추가를 추천**(이번 Plan은 `docs/admin/`만 수정 가능해 직접 반영하지 않음 — Build 또는 사용자가 반영) |
| Q9 | `src/data/apps.ts`의 `webApps`가 비어 있는 문제를 이번에 같이 고칠지 | **고치지 않음(범위 밖).** 이 기능은 `science-curriculum.ts`를 앱 목록 소스로 쓰므로 영향받지 않는다. 다만 발견한 사실이라 §2.13-⑧과 §9.3에 남겨 둔다 — 필요하면 별도 작업으로 분리 추천 |


---

## 12. 확정 결정 (2026-09-22 사용자 승인)

이 절이 본문보다 우선한다.

| 항목 | 결정 |
|---|---|
| 승인 | spec 승인, 구현 진행 |
| 진행 중 학생(Q3) | 진행률(단계)·마지막 저장 시각만 표시. 필드별 입력은 표시하지 않음 |
| 칭찬 문구(Q4) | DB `praise_presets`에 저장, 관리자 대시보드에서 추가·수정·삭제. 기본 6개 시드(§6) |
| 그 밖의 열린 질문 | 모두 추천안 적용 (Q1 기존 9개 앱 소급 안 함, Q2 2단원 탐구 3·4·5에는 `detail.qa` 반영, Q5 전송 직전 `{이름}` 치환, Q6 학생 화면 제외, Q7 클라이언트 조합 쿼리로 시작, Q8 CLAUDE.md 규칙 추가, Q9 범위 밖) |
