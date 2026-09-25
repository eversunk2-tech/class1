# 단계 C Build 지침 — 1학기 1단원 6개 앱 간략화 (2026-09-25 작성, 단계 B 사용자 확인 뒤 시작)

> 담당 나누기(각자 **자기 앱 2개만** 고친다 — 서로 다른 파일이라 동시에 해도 겹치지 않는다):
> * **C1**: `sci-6-1-1-1`, `sci-6-1-1-2`(실험) — 테스트 Chrome 포트 **9352**, 보고서 `build-C1-report.md`
> * **C2**: `sci-6-1-1-3`, `sci-6-1-1-4`(실험) — 포트 **9353**, 보고서 `build-C2-report.md`
> * **C3**: `sci-6-1-1-5`, `sci-6-1-1-6`(조사) — 포트 **9354**, 보고서 `build-C3-report.md`
> (보고서는 모두 `docs/science/sim-redesign/`에)

먼저 읽기: `CLAUDE.md`(과학 차시 앱 규칙 전부 — 특히 예상 1·분석 1~2·정리 1, '더 탐구하고 싶은 점' 필수 한 줄, 답을 먼저 알려 주지 않기, 장면 속 글자, 시점 방향, 저장 키 버전), `docs/science/sim-redesign/spec.md`의 **§1 전체(1.1~1.5), §6, §7.4~7.5**와 끝의 **개정 2(4~6번 — 5·6번이 4번보다 우선), 개정 3, 개정 4**, `audit.md`의 1학기 1단원 절, 자기 앱의 `spec.md`(끝 개정 절 우선)·`app.js`·`data/lesson-config.js`·`index.html`·`style.css`, 응답 매핑 `src/data/app-responses/{types,helpers}.ts`와 자기 앱 매핑, `src/lib/app-responses.ts`(`extractResponses`, `groupByStage`, `progressInfo`). 본보기(새 기준 앱): `public/apps/sci-6-2-1-4/`(정리하기 안의 '더 탐구하고 싶은 점' + `finish-wrap` + `lesson.finish({ stage: "conclude" })`).

## 1. 문항 줄이기 (사용자 결정 — 무엇을 남기고 뺄지는 spec §1.4 표 그대로)
| 앱 | 저장 키 | 예상(도입) | 분석 | 정리하기 |
|---|---|---|---|---|
| sci-6-1-1-1 | `sci611sim1:v1`→`:v2` | q1만(q2 삭제) | quiz `criteria` 그대로, `myCriterion`(내 분류 기준)·분류 3기준 그대로 | 결론만(ext1·ext2 삭제) |
| sci-6-1-1-2 | `sci611sim2:v1`→`:v2` | q1만 | quiz **q1 + q4**만(q2·q3·q5 삭제) | 결론만 |
| sci-6-1-1-3 | `sci611sim3:v1`→`:v2` | **q2**만(q1 삭제) | quiz **q3 + q4**만(q1·q2 삭제) | 결론만 |
| sci-6-1-1-4 | `sci6114sim:v2`→`:v3` | **q2**만(q1 삭제) | **inferA + q1**만(readA·q2·q3 삭제) | 결론만 |
| sci-6-1-1-5 | `sci6115guide:v1`→`:v2` | `answer`만(`experience` 삭제) | 정리 퀴즈 **q1 + q3**만(q2·q4 삭제), worksheet·share 그대로 | 결론만(ext1·ext2 삭제) |
| sci-6-1-1-6 | `sci611guide6:v1`→`:v2` | **q2**만(q1과 `revised.q1` 삭제, `revised.q2`는 남김) | research·share 그대로 | 퀴즈 q1·q2 + 결론만(**fill·why·extension 삭제**) |

* **관찰·측정·분류 활동과 값(기록 칸, 관찰 보기, 분류 기준·정답, 측정값), 과학 내용은 바꾸지 않는다.** 남긴 질문의 문구도 원칙적으로 그대로(뜻을 바꾸지 않는 선에서 너무 긴 문장만 다듬을 수 있음 — 바꾸면 보고서에 전·후).
* 힌트는 남긴 질문에 맞는 것만 남긴다(문구는 그대로 고르기만). 뺀 질문을 참조하는 코드(채점 함수, 안내 문구의 "질문 2", 진행 안내 "분석 질문 5개" 같은 개수, 요약 카드, `done-card` 요약, 예상과 비교하는 곳 등)를 **모두** 찾아 맞춘다.
* 단계 안내 문구(`ss-lead`)의 질문 개수·흐름 설명이 새 구성과 맞게.

## 2. '더 탐구하고 싶은 점'을 정리하기 안으로 (개정 2-6, "다른 앱들처럼")
* 지금은 따로 떨어진 5번째 단계(`data-stage="curiosity"`)다. **새 기준 앱과 같은 모양**으로: 실험 앱은 **정리하기(`conclude`) 섹션 안**, 조사 앱은 **마지막 정리 단계(`wrapup`) 섹션 안** — 결론을 제출한 뒤 보이는 `finish-wrap` 안에 [더 탐구하고 싶은 점 한 줄 입력] + [🎉 학습 마치기 카드] 순서, 그 아래 `done-card`와 "↺ 처음부터 다시 하기"(`sci-6-2-1-4/index.html`의 `data-stage="conclude"` 섹션과 `app.js`의 `showFinish()`·`finish-wrap` 부분과 같게 — `finish-wrap`으로 찾기).
* `stages`에서 `curiosity`를 빼고(4단계), `gates`·`isDone`·단계 번호("5. …" 제목)·`lesson.finish({ stage: "conclude" | "wrapup", … })`를 맞춘다(공통 틀 `lesson.js`는 `stage`를 안 주면 `"curiosity"` 단계에서 마치기 화면을 그린다 — 꼭 넘길 것). `canFinish`는 결론 제출 여부만 보면 된다('더 탐구하고 싶은 점'이 비었는지·무의미한지는 공통 틀이 마칠 때 본다 — 필수, 느슨 판정).
* 입력은 새 기준 앱처럼 **한 줄**(rows 1, Enter로 줄바꿈 안 함, 최대 200자). 문구: 실험 앱 "이번 실험을 하고 나서 더 탐구하고 싶은 점이나 궁금한 점을 한 줄로 적어 보세요.", 조사 앱은 지금 문구의 뜻을 살려 한 줄로. "(선택)", "비워도 돼요" 같은 말은 쓰지 않는다(필수). 저장 키 `curiosity`와 `detail.curiosity`는 그대로.
* 공통 틀 파일(`science-sim/`, `science-guide/` 사본)은 **고치지 않는다**. 필요한 게 있으면 보고서에 적고 멈추지 말고 앱 쪽에서 해결하거나 Claude에게 넘긴다.

## 3. 저장·기록(DB 영향 없음을 지키는 부분 — 가장 중요)
* 저장 키 버전을 위 표대로 올린다(`data/lesson-config.js` `storageKey`, 주석에 까닭). 예전 진행 중 기록은 `persist.js`의 `usable()`(prefix 비교)로 버려지고 새로 시작된다 — 코드로 다시 확인.
* `app.js` `buildDetail()`: **뺀 문항의 키가 아예 생기지 않게**(빈 값·`undefined`로 남기지 않기) 고친다. 새 모양 표시로 최상위에 **`questionSet: 2`**를 넣는다(예전 기록에는 없는 키 — 매핑이 이것으로 버전을 가른다). 나머지 키 이름·모양은 그대로(예: `records`, `classify`, `conclusion`, `curiosity`). `detail.qa`는 이번에 넣지 않는다(spec §1.3).
* 응답 매핑 `src/data/app-responses/sci-6-1-1-N.ts`:
  * `variants` **맨 앞**에 새 변형 `{ id: "v2", label: "간략화 후(2026-09-25~)", match: (d) => d.questionSet === 2, ignore: [기존 ignore…, "questionSet"], items: [...] }` — items는 기존 v1 항목에서 뺀 문항을 지우고, '더 탐구하고 싶은 점' 항목은 **stage `"conclude"`(조사 앱은 `"wrapup"`)**, label "더 탐구하고 싶은 점", 질문은 새 문구로.
  * 기존 v1은 **그대로 두고** label만 "간략화 전(~2026-09-25)"으로(match `() => true` 유지, 맨 뒤).
  * `stages`는 앱의 새 4단계와 같게(`curiosity` 제거 — 예전 기록의 `curiosity` 항목은 `DEFAULT_STAGE_LABELS`로 "궁금한 점" 제목을 받아 맨 뒤에 모인다: `groupByStage`로 확인). `standard`는 `"slim"`으로 바꾸고 파일 머리 주석의 detail 설명을 v1·v2 둘 다 적는다. `notes`에서 없어진 문항을 말하는 문장은 "간략화 전 기록만 해당"으로.
* 확인 스크립트(스크래치에, 저장소에 넣지 않음): `node_modules/jiti`로 TS를 그대로 불러 `extractResponses`를 돌린다 — 예:
  ```js
  import { createJiti } from "<repo>/node_modules/jiti/lib/jiti.mjs";
  const jiti = createJiti(import.meta.url, { alias: { "@": "<repo>/src" } });
  const { extractResponses, groupByStage } = await jiti.import("<repo>/src/lib/app-responses.ts");
  ```
  (1) **예전 모양 detail**(HEAD의 `buildDetail()`이 만드는 모양 그대로, 모든 키 채움) → 변형 v1, 항목이 전과 같게 나오고 `extras` 없음, (2) **새 앱을 실제로 끝까지 해서 얻은 detail**(아래 테스트에서 `app_results` POST 본문을 가로채 저장) → 변형 v2, 모든 항목에 답이 있고 `extras`가 비어 있음, `groupByStage` 순서가 앱 단계 순서. 결과 출력을 보고서에 붙인다.
* `npm run lint`와 `node_modules/.bin/tsc --noEmit -p tsconfig.json`(매핑 타입) 통과.

## 4. 실험 앱(C1·C2)만 — 실험하기 화면 점검(단계 D에서 이 4개는 다시 보지 않는다)
* 단계 A·B에서 바뀐 공통 틀(README "추가 기능 2026-09-25" 절): 크게 보기에서 실행·기록 버튼은 장면 안 막대, 관찰 카드는 장면 바로 아래(번호 👀), 3D 칸은 막대 위에서 끝남. 앱이 기록 버튼을 찾을 때는 `exp.recordButton`/`.ss-record-btn`, 가려질 때 보이게 하는 것은 `exp.revealRecord()`(관찰 카드 안 선택자 금지 — 크게 보기에서 못 찾는다). 끌기를 쓰면 `v.draggable`의 `opts.pad`·움직임 문턱·상대 변화량(README). 실험하기에 들어올 때 앱이 따로 스크롤하지 않는다(spec 개정 5-2).
* 공통 틀(단계 A)의 **두 모드**(기본 / "⛶ 전체 화면 보기")에서 실험하기가 잘 보이고 동작하는지 — 1024×768·768×1024·375×812, 어두움, `?no3d=1`. 장면에 지금 값을 보여 주는 요소가 있으면 크게 보기용 `scenePanel`을 넘길지 판단(필요 없으면 안 넘김 — 까닭을 보고서에).
* 점검(audit)이 자동화로 못 본 **실행 뒤 화면**(용액 관찰·지시약 색 변화·달걀 껍데기 반응·방울 수 늘리기)을 끝까지 열어 이름표 겹침·싱크·말 줄임을 본다. 바뀌는 값을 3D 이름표로 띄우고 있으면 값 패널/관찰 카드로(CLAUDE.md "장면 속 글자").
* **직접 조작**: 조건(용액·지시약·물질·홈판 칸·방울 수)이 3D에서 탭으로 골라지는지 확인하고, 빠진 것만 기존 `v.pickable` 패턴으로 더한다(버튼은 그대로 — 조작 단계·시간 늘리지 않기). spec §3.3 해당 줄 참고(이미 된 것이 많다).
* **시점 방향**: `v.focus(...)` 등 카메라가 홈판·병으로 다가갈 때 전체 화면의 좌우가 뒤집히지 않는지(스크린숏 전·후 비교).
* 실험하기·기록 순간의 문구(알림·관찰 카드 안내·이름표)에 결론·관계·원인 단정이 없는지(spec §3.2) — 있으면 사실만 말하도록 고친다(과학 내용은 그대로).

## 5. 확인(반드시)
* 새 앱을 **처음부터 끝까지**(예상 → 실험(실험관찰 조건 전부 기록) → 분석 → 정리 → 더 탐구하고 싶은 점 → 학습 마치기) 체험 모드와 가짜 로그인 둘 다로 진행. 로그인 상태에서 `app_results` POST 본문(가로채기)에 `questionSet: 2`가 있고 뺀 키가 없는지, `app_progress` 저장 본문의 `prefix`가 새 키인지.
* **예전 진행 기록**: 가짜 `app_progress` GET이 예전 prefix(예: `sci611sim1:v1`)의 스냅샷을 돌려줄 때 앱이 처음부터 시작하고, 이어서 저장하면 새 prefix로 덮어쓰는지. localStorage에 예전 키가 있어도 섞이지 않는지.
* '더 탐구하고 싶은 점'을 비우면 마치지 못하고 안내가 나오는지, 결론을 제출하기 전에는 마치기 칸이 안 보이는지, 새로 고침 뒤 이어서 하기, "처음부터 다시 하기".
* 머리말 접기(단계 A)와 단계 메뉴 4칸 표시, 이전/다음 단계 이동.
* **시간**: 간략화 뒤 예상 소요 시간표(단계별, 느린 학생 기준 글자 수 추정 — 다른 새 기준 앱 spec의 방식)를 앱 `spec.md` 끝에 "개정 (2026-09-25) 간략화" 절로 적고 spec §1.5 추정과 비교. 7분을 넘으면 넘는 까닭(실험관찰 조건 전부 측정 등)을 적는다.
* 앱 `spec.md`에 개정 절(남긴·뺀 문항, 저장 키, detail 변화, 매핑 변형, 시간표)을 **덧붙인다**(앞 내용은 지우지 않음).
* 공통 틀 사본이 정본과 같은지 `diff -r scripts/templates/science-sim public/apps/<앱>/science-sim`(조사 앱은 `science-guide`) — 고치지 않았으니 같아야 한다.

## 6. 하지 않는 것
* 다른 앱·공통 틀 정본·사본 수정, `src/data/app-responses/` 중 자기 앱 두 파일 밖 수정, `src/lib/`·관리자 화면 수정.
* git commit/push, 실제 DB 쓰기, 실제 Supabase·Gemini 호출, **내려받기(CDN 파일을 읽으려고 받는 것도 금지)**, `npm run build`.

## 7. 테스트 규칙
* **개발 서버 대신 자기 정적 서버로 저장소 `public/`을 직접 서빙**한다(개발 서버는 데스크톱 앱이 꺼 버리는 일이 있다): `python3 -m http.server <포트> --bind 127.0.0.1 --directory /Users/sungchul/Desktop/classroom/public` → `http://127.0.0.1:<포트>/apps/<앱>/index.html` (포트: C1 8784, C2 8785, C3 8786 — 끝나면 종료). **자기 전용 headless Chrome**(위 포트, 프로필은 스크래치 `…/scratchpad/build-C{n}/`), WebGL은 `--use-angle=swiftshader --enable-unsafe-swiftshader`, Node 24 전역 `WebSocket`으로 CDP(설치 금지).
* **실제 Supabase는 첫 로드부터 차단**: `--host-resolver-rules="MAP *.supabase.co 127.0.0.1:9, MAP supabase.co 127.0.0.1:9"` + `--disable-web-security` + CDP `Fetch.enable`(`*supabase.co*`) 가짜 응답(`site_settings`→`login_required:false`, `profiles`→`role:"user"`, `app_progress` GET→`[]` 또는 시험용 예전 스냅샷, POST/PATCH→201(본문은 기록해 둠), OPTIONS→204, `functions/v1/check-answer`→통과 모양). 가짜 로그인은 로컬 출처(127.0.0.1·localhost)에서만 localStorage `sb-<ref>-auth-token`(만료 먼 미래, ref 값은 문서에 적지 않음). 새는 요청이 없는지 기록.
* `localStorage.clear()` 금지(그 앱 `sci6…` 키와 `ssUiPref:` 키만 지움), 다른 탭·프로세스 건드리지 않기, 끝나면 Chrome 종료·임시 파일 정리(스크린숏만 남김 — `…/scratchpad/build-C{n}/shots/`).

## 8. 보고서 `docs/science/sim-redesign/build-C{n}-report.md`
앱마다: 남긴·뺀 문항(전→후 목록), 바꾼 파일과 요지, 저장 키, detail 전·후 모양, 매핑 변형(확인 스크립트 출력), 정리하기 안으로 옮긴 모습(스크린숏), 실험 화면 점검 결과(두 모드·실행 뒤 화면·탭·방향, 고친 것), 시간표, `diff -r`·lint·tsc, Supabase 차단 기록, 확인하지 못한 것 — 한국어로 간결하게.
