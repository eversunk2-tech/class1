# Build C1 보고서 — 단계 C(1학기 1단원 간략화) `sci-6-1-1-1`·`sci-6-1-1-2` (2026-09-25)

지침: `docs/science/sim-redesign/build-C-instructions.md`(C1 줄). 고친 파일은 두 앱 폴더(공통 틀 사본 `science-sim/` 제외)와 `src/data/app-responses/sci-6-1-1-1.ts`·`sci-6-1-1-2.ts`, 이 보고서뿐이다. 공통 틀·다른 앱·`src/lib/`·관리자 화면은 고치지 않았다. git commit/push·실 DB 쓰기·`npm run build`·내려받기 없음.

## 한눈에
* 두 앱 모두 **4단계**(예상하기 → 실험하기 → 기록·분석하기 → 정리하기), '더 탐구하고 싶은 점'은 **정리하기 안 한 줄**(결론 제출 뒤 `finish-wrap`, 필수 — 비우면 마치지 못함), `lesson.finish({ stage: "conclude" })`.
* 저장 키 `sci611sim1:v1 → :v2`, `sci611sim2:v1 → :v2`. 새 detail은 최상위 `questionSet: 2`, **뺀 문항 키 없음**(빈 값·`undefined`·`null`도 없음).
* 응답 매핑: v2 "간략화 후(2026-09-25~)"를 **맨 앞**, v1은 항목 그대로(label만 "간략화 전(~2026-09-25)"). 확인 스크립트: 예전 detail → v1, **항목이 HEAD 매핑과 완전히 같음·extras 없음**; 새 detail → v2, 모든 항목에 답·extras 없음·단계 순서 = 앱 순서.
* 실험 화면 점검에서 앱 쪽 작은 문제 2개를 고쳤다(결과 시점에 남는 카메라, 휴대폰에서 안내 문장이 드래그 안내 글을 덮음). 공통 틀에서 찾은 것 2개는 아래 "Claude에게" 절.
* **시간(추정)**: 간략화로 보통 약 2:35/3:51, 느린 학생 약 4:03/5:52 줄었지만(spec §1.5 "2~3분"/"3~4분"과 맞음), 실험관찰 23칸/24칸을 모두 해야 해서 **여전히 7분을 크게 넘는다**(6-1-1-1 보통 약 12:44·느린 약 19:38, 6-1-1-2 보통 약 11:47·느린 약 18:02). 줄이는 선택지는 사용자 결정 사항으로 적었다.

---

## 1. sci-6-1-1-1 (여러 가지 용액을 분류해 볼까?)

### 문항 전 → 후
| 단계 | 전 | 후 |
|---|---|---|
| 예상하기 | q1(가게 용액 나누기), q2(기준을 정하려면 살펴볼 점) · 힌트 3개 | **q1만**(문구 그대로) · 힌트 **2개**(1번·3번 문구 그대로 — 관찰 감각을 말하는 2번은 q2용이라 뺌) |
| 기록·분석하기 | 내 분류 기준 2칸 · 분류 기준 고르기(criteria) · 분류 3기준 | **그대로**(spec §1.4) |
| 정리하기 | 결론 + 발전 질문 1·2 | **결론만** |
| 궁금한 점 | 따로 떨어진 5단계 | **정리하기 안** 한 줄: "이번 실험을 하고 나서 더 탐구하고 싶은 점이나 궁금한 점을 한 줄로 적어 보세요." |

### 바꾼 파일(요지)
* `data/lesson-config.js`: `storageKey: "sci611sim1:v2"`(주석에 까닭), `stages` 4개, 예상 q2·힌트 2번 삭제, `conclude`는 결론만, `curiosity` 새 문구 + `maxLength: 200`(minLength 삭제 — 판정은 공통 틀). 관찰 방법·결과 표·분류 기준·정답·안전 문구는 그대로.
* `index.html`: 5단계 섹션을 없애고 정리하기 안에 `finish-wrap`(더 탐구하고 싶은 점 + 마치기 카드), 그 아래 done-card·"처음부터 다시 하기"(`sci-6-2-1-4`와 같은 구조).
* `app.js`: 한 줄 입력(rows 1, Enter 막음, 200자, `one-line`), `showFinish()`(결론 제출 뒤에만 보임), `buildDetail()`(`questionSet: 2`, `extension` 없음 — `predict.values()`가 남은 q1만 돈다), `finish`(`stage: "conclude"`, `canFinish` = 결론 제출), 게이트 문구 "예상하기 질문에…", curiosity 게이트 삭제, 정리하기 완료 = 결론 + 마치기. 실험 화면 2곳(아래 "실험하기 화면 점검").
* `style.css`: `.ss-textarea.one-line`, `.finish-card .wide`, 안내 문장 자리(`--ov-bottom`).

### detail 전 → 후
* 전: `{ predict{q1,q2}, records[{solution,method,result,recordedAt}], skipped[], myCriterion{criterion,result}, analysis{criteria}, classify{color,transparent,foam}, conclusion, extension{q1,q2}, curiosity }`
* 후(가짜 로그인으로 끝까지 해서 가로챈 `app_results` POST 본문): `{ questionSet: 2, predict{q1}, records[23], skipped[1], myCriterion{criterion,result}, analysis{criteria}, classify{color,transparent,foam}, conclusion, curiosity }` — 2,697자.

### 실험하기 화면 점검(두 모드 × 1024×768·768×1024·375×812·어두움·`?no3d=1`, 실행 뒤 화면까지)
* 겹침 자동 판정(3D 칸·막대·안내 문장·초시계·토글·배지·드래그 안내·가로 스크롤)과 스크린숏으로 색깔(종이 앞 낮은 시점)·투명도(글씨 종이)·거품(초시계·거품 공)·냄새(손 부채질)·관찰하지 않는 칸을 모두 봤다. 3D 이름표는 용액·종이 이름뿐(값 없음), 크게 보기에서 초시계·손·안내 문장은 3D 칸 안(막대 위)이라 가리지 않는다. 콘솔 오류 0.
* **고친 것 ①(싱크)**: 결과를 보던 가까운 시점(종이 앞·병 옆)에서 다른 칸을 고르면 병만 제자리로 가고 카메라는 남아, 특히 묽은 염산×냄새(관찰 안 하는 칸)를 고르면 빈 종이만 크게 보였다(`shots/s111-L-c6-skip-base-BEFORE-camera-fix.png`). `highlight()`에서 결과를 거둘 때 `v.flyHome(500)`, '실험대 정리하기'도 같게(`…-AFTER-camera-fix.png`). 기록 뒤 다음 칸이 자동으로 골라질 때도 처음 시점으로 돌아와 점적병을 3D에서 다시 누를 수 있다.
* **고친 것 ②(겹침, 휴대폰)**: 375px에서 드래그 안내 글(공통 틀 `.ss-view-tip`)이 3줄이 되어 "5초 동안 거품을 지켜봐요" 등 안내 문장과 겹쳤다. 안내 글 높이를 재어 그 위에 두고, 장면이 아주 낮으면(휴대폰에서 크게 보기를 직접 켬) 왼쪽 위 토글은 덮지 않는 데까지만 올린다(그때는 드래그 안내 글이 조금 가려짐 — `s111-M-c2-after-big.png`).
* **3D 탭**(1024×768 기본 화면, 좌표 클릭): 빨랫비누 물 병 → 용액 선택, 글씨가 쓰인 흰 종이 → 투명한 정도 관찰, 식초 병, 흰 종이 → 색깔 관찰, 묽은 수산화 나트륨 용액 병 — **5번 모두 해당 버튼이 눌림**. 흔들어 보기·냄새는 3D 물체가 없어 버튼(spec §3.3 그대로). 2D는 병 버튼.
* **시점 방향**: 낮은 시점·병 옆 시점 모두 처음 시점과 같은 앞쪽(+z)에서 봐 좌우가 그대로다(종이 "가" 글자가 바로 읽히고 흰 종이 왼쪽·글씨 종이 오른쪽, 식초가 레몬즙 왼쪽 — `t111-overview.png` ↔ `s111-L-c2-after-base.png`·`s111-L-c4-after-base.png`).
* **기록 순간 글**: 관찰 카드("👀 용액 뒤에 있는 글씨가 또렷하게 비쳐 보여요.", "⏱ 거품이 금방 사라져서 5초 뒤에는 남아 있지 않아요.", "👃 냄새가 느껴져요.")·알림("📝 기록했어요: 식초 · 색깔 → 노란색")은 관찰 사실만 — 결론·관계·원인 단정 없음.
* `scenePanel`은 넘기지 않았다: 계속 바뀌는 측정값이 없고(관찰 결과는 학생이 고름), 초시계·안내는 3D 칸 안에 있다.

## 2. sci-6-1-1-2 (지시약으로 여러 가지 용액을 분류해 볼까?)

### 문항 전 → 후
| 단계 | 전 | 후 |
|---|---|---|
| 예상하기 | q1(색깔 없고 투명한 두 용액 구별), q2(지시약 색이 용액마다 같게/다르게) · 힌트 3개 | **q1만**(문구 그대로) · 힌트 3개 그대로(셋 다 q1을 돕는 생각거리) |
| 기록·분석하기 | 분류하기 + 분석 q1~q5 | 분류하기 그대로 + **q1(분류 근거)·q4(색이 달라도 결과가 같은 까닭)만**(문구·보기·피드백 그대로, 화면 "분석 1·2", 저장 id q1·q4) |
| 정리하기 | 결론 + 발전 질문 1·2 | **결론만** |
| 궁금한 점 | 따로 떨어진 5단계 | **정리하기 안** 한 줄(6-1-1-1과 같은 문구) |

### 바꾼 파일(요지)
* `data/lesson-config.js`: `storageKey: "sci611sim2:v2"`, `stages` 4개, 예상 q2·분석 q2·q3·q5·발전 질문 삭제, `curiosity` 새 문구 + `maxLength: 200`. 용액·지시약·색·결과 표·분류 정답·실험 A/B는 그대로.
* `index.html`·`app.js`·`style.css`: 6-1-1-1과 같은 모양(`finish-wrap`, 한 줄 입력, `showFinish()`, `buildDetail()`에 `questionSet: 2`·`extension` 없음 — `analysis`는 남은 q1·q4만, `finish({ stage: "conclude" })`, 게이트). 분석 게이트·요약은 `C.quiz.length`라 "분석 질문 2개", "분석 질문: 2/2 맞힘"으로 저절로 맞다. 실험 화면 1곳(아래 "실험하기 화면 점검").

### detail 전 → 후
* 전: `{ predict{q1,q2}, records[{phase,solution,indicator,result,recordedAt}], classify{groups{acid,base},correct,tries}, analysis{q1..q5}, conclusion, extension{q1,q2}, curiosity }`
* 후(가로챈 POST 본문): `{ questionSet: 2, predict{q1}, records[24], classify{…}, analysis{q1,q4}, conclusion, curiosity }` — 2,930자.

### 실험하기 화면 점검(같은 조건)
* 리트머스 시험지(핀셋)·페놀프탈레인·붉은 양배추(스포이트) 실행 뒤 홈 색, 크게 보기 막대, 2D 홈판까지 겹침 판정·스크린숏. 3D 이름표는 용액·지시약·홈판 이름뿐. 다가간 시점에서 가장자리 이름표가 화면 끝에 잘리거나 드래그 안내 글·토글 뒤에 조금 걸리는 경우가 있다(값이 아닌 고정 이름표라 그대로 둠 — `s112-L-c4-after-big.png`). 콘솔 오류 0.
* **고친 것(싱크)**: 실행하면 카메라가 그 홈으로 다가가는데(`v.focus`), 기록하고 다음 칸이 자동으로 골라져도 머물러 다음 홈 고리·병·지시약이 화면 밖일 때가 있었다. `highlight()`에서 다른 칸을 고르면 `v.flyHome(500)`, '홈판 비우기'도 같게.
* **3D 탭**: 레몬즙 병 → 용액, 붉은색 리트머스 시험지 통 → 지시약, 붉은 양배추 용액 병 → 지시약, 묽은 수산화 나트륨 용액 병 → 용액, 홈(2줄 3칸) → 빨랫비누 물 × 붉은색 리트머스, 홈(4줄 6칸) → 묽은 수산화 나트륨 용액 × 붉은 양배추 — **6번 모두 맞게 골라짐**.
* **시점 방향**: `v.focus`는 `flyHome` 뒤 처음 시점과 같은 방향으로 다가가 좌우가 그대로다(지시약 이름표 왼쪽·지시약 병 오른쪽·점적병 뒤 — `t112-overview.png` ↔ `s112-L-c1-after-base.png`·`s112-L-c3-after-big.png`).
* **기록 순간 글**: 관찰 카드는 색 견본("넣기 전 시험지 → 용액에 젖은 시험지", "떨어뜨린 … + 넣기 전 홈 안 용액 → 넣은 뒤 홈 안 용액")과 질문만, 알림은 "📝 기록했어요: 식초 + 푸른색 리트머스 → 붉은색으로 변함", "🎉 실험 A를 모두 기록했어요! 이제 실험 B가 열렸어요." — 결론·관계 없음.
* `scenePanel` 안 넘김(바뀌는 측정값 없음).

## 3. 응답 매핑 확인(스크래치 `jiti` 스크립트, `extractResponses`·`groupByStage`·`progressInfo`)
입력: ① **예전 detail** = HEAD(`9d2dc16`) 앱을 고치기 **전에** 가짜 로그인으로 끝까지 해서 가로챈 `app_results` 본문, ② ①에서 `predict.q2`·`extension.q1`·`curiosity`를 빈 문자열로 바꾼 것, ③ **새 detail** = 고친 앱을 끝까지 해서 가로챈 본문. 기준선: 같은 ①·②를 **고치기 전 매핑**에 넣은 결과(`jiti-before`).
```
■ sci-6-1-1-1 standard=slim stages=predict>experiment>analyze>conclude variants=v2:간략화 후(2026-09-25~) | v1:간략화 전(~2026-09-25)
  [old] source=mapping variant="간략화 전(~2026-09-25)" versions=v1 items=13 extras=[] empty=[]
     keys: predict:q1, predict:q2, experiment:records, analyze:criterion, analyze:criterionResult, analyze:criteria, analyze:classify.color, analyze:classify.transparent, analyze:classify.foam, conclude:conclusion, conclude:ext1, conclude:ext2, curiosity:curiosity
     groups: 예상하기(2) > 실험하기(1) > 기록·분석하기(6) > 정리하기(3) > 궁금한 점(1)
  [oldBlank] variant="간략화 전(~2026-09-25)" versions=v1 items=13 extras=[] empty=["predict:q2","conclude:ext1","curiosity:curiosity"]
  [new] source=mapping variant="간략화 후(2026-09-25~)" versions=v2 items=10 extras=[] empty=[]
     keys: predict:q1, experiment:records, analyze:criterion, analyze:criterionResult, analyze:criteria, analyze:classify.color, analyze:classify.transparent, analyze:classify.foam, conclude:conclusion, conclude:curiosity
     groups: 예상하기(1) > 실험하기(1) > 기록·분석하기(6) > 정리하기(2)
  progress: curiosity→{"stageLabel":"궁금한 점","index":null,"total":4,"finished":false} experiment→{"stageLabel":"실험하기","index":2,"total":4,"finished":false}
■ sci-6-1-1-2 standard=slim stages=predict>experiment>analyze>conclude variants=v2:간략화 후(2026-09-25~) | v1:간략화 전(~2026-09-25)
  [old] source=mapping variant="간략화 전(~2026-09-25)" versions=v1 items=13 extras=[] empty=[]
     keys: predict:q1, predict:q2, experiment:records, analyze:classify, analyze:q1, analyze:q2, analyze:q3, analyze:q4, analyze:q5, conclude:conclusion, conclude:ext1, conclude:ext2, curiosity:curiosity
     groups: 예상하기(2) > 실험하기(1) > 기록·분석하기(6) > 정리하기(3) > 궁금한 점(1)
  [oldBlank] variant="간략화 전(~2026-09-25)" versions=v1 items=13 extras=[] empty=["predict:q2","conclude:ext1","curiosity:curiosity"]
  [new] source=mapping variant="간략화 후(2026-09-25~)" versions=v2 items=7 extras=[] empty=[]
     keys: predict:q1, experiment:records, analyze:classify, analyze:q1, analyze:q4, conclude:conclusion, conclude:curiosity
     groups: 예상하기(1) > 실험하기(1) > 기록·분석하기(3) > 정리하기(2)
  progress: curiosity→{"stageLabel":"궁금한 점","index":null,"total":4,"finished":false} experiment→{"stageLabel":"실험하기","index":2,"total":4,"finished":false}
sci-6-1-1-1 old      HEAD 매핑 대비 항목(key·stage·label·질문·답·version) 같음: true | extras 전/후: [] [] | 변형: 현재 버전 → 간략화 전(~2026-09-25)
sci-6-1-1-1 oldBlank HEAD 매핑 대비 항목 같음: true | extras 전/후: [] []
sci-6-1-1-2 old      HEAD 매핑 대비 항목 같음: true | extras 전/후: [] [] | 변형: 현재 버전 → 간략화 전(~2026-09-25)
sci-6-1-1-2 oldBlank HEAD 매핑 대비 항목 같음: true | extras 전/후: [] []
```
* v1 항목 목록은 HEAD와 **바이트 단위로 같다**(두 파일 모두 `diff` 확인). v2 질문 문구 = 앱 `lesson-config.js` 문구(예상·분석·결론·더 탐구하고 싶은 점·분류 라운드 제목 모두 "같음"), v2 `stages` = 앱 `stages`.
* 예전 진행 중 행의 step이 `curiosity`면 `progressInfo`는 "궁금한 점"(번호 없음, 4단계 중)으로 보인다 — 오류 없음. 예전 완료 기록의 '궁금한 점' 항목은 기본 이름으로 맨 뒤에 묶인다.

## 4. 공통 확인(두 앱 모두 통과)
* **처음부터 끝까지**: 체험 모드(요청은 `site_settings` GET 1번뿐 — `app_progress`·`app_results`·`check-answer` 0번, 완료 카드 "체험 모드라서 결과는 저장되지 않았어요") + 가짜 로그인(마지막 확인은 앱을 고친 뒤 다시 돌린 `final…` 판). 실험관찰 조건 전부(23칸/24칸) 기록.
* **결론 제출 전에는 `finish-wrap` 숨김, 제출 뒤 보임**. '더 탐구하고 싶은 점'을 비우고 마치기 → "'더 탐구하고 싶은 점'을 한 줄이라도 적어야 마칠 수 있어요."로 막힘. 입력은 rows 1·200자·Enter로 줄바꿈 안 됨. "(선택)"·"비워도" 문구 없음.
* **예전 진행 기록**: 가짜 `app_progress` GET이 예전 prefix(`…:v1`, 실험 중 3칸 기록) 스냅샷을 돌려주고 localStorage에도 예전 `…:v1:*` 키 8개(주인 표시 포함)를 넣어 둔 상태 → 앱은 **예상하기 빈 칸, 기록 0**으로 시작, 입력하면 첫 저장이 `POST ?on_conflict=user_id,app_id`(강제 덮어쓰기)로 **prefix `…:v2`**, 스냅샷 키는 `step·predict·intro·meta`뿐(예전 records 등 섞이지 않음), 예전 로컬 키는 읽지도 고치지도 않음(로그아웃 때 `sci6` 접두사로 함께 지워짐).
* **새로 고침 뒤 이어 하기**(예상 답, 실험하기 기록 1칸), 다른 기기에서 마친 기록 복원(정리하기·`finish-wrap`·완료 카드·"제출 완료"), **처음부터 다시 하기**(확인 창 → `DELETE app_progress` → 빈 예상하기).
* **머리말 접기**(계정 줄·단계 메뉴 숨김, 아래 이전/다음 막대로 단계 이동, 다시 펼치기), 단계 메뉴 **4칸**, 잠긴 단계를 누르면 까닭 안내, 태블릿 세로(768×1024)는 크게 보기가 기본.
* `diff -r scripts/templates/science-sim public/apps/sci-6-1-1-{1,2}/science-sim` — **같음**(class1-record.js도 정본과 같음). `npm run lint` 통과, `node_modules/.bin/tsc --noEmit -p tsconfig.json` 통과.

## 5. 시간표(추정 — 두 앱 spec.md 끝 "개정 (2026-09-25) 간략화" 절에 자세히)
방식은 sci-6-1-2-5 "slim-review"와 같다(새로 보이는 글 음절 실측 × 70%, 보통 450음절·60자/분, 느린 300음절·40자/분, 실험 1칸 = 실행 + 실측 연출 + 고르기 4/7초 + 기록).

| 앱 | 예상 | 실험 | 분석 | 정리 | 합계(보통 / 느린) | 줄어든 시간 | 간략화 전 |
|---|---|---|---|---|---|---|---|
| sci-6-1-1-1 | 1:04 / 1:46 | 5:52 / 8:34 (23칸) | 3:52 / 6:24 | 1:56 / 2:54 | **12:44 / 19:38** | 2:35 / 4:03 | 15:19 / 23:41 |
| sci-6-1-1-2 | 1:05 / 1:55 | 6:43 / 9:47 (24칸) | 2:01 / 3:22 | 1:58 / 2:58 | **11:47 / 18:02** | 3:51 / 5:52 | 15:38 / 23:54 |

* 7분을 넘는 까닭: 실험관찰 23칸/24칸을 모두 해야 한다(칸마다 보통 약 13~14초, 느린 약 19~20초 — 측정 규칙이라 줄이지 않음). 6-1-1-1은 분석 활동(내 분류 기준 2칸 입력, 기준 고르기, 3기준 분류 = 칸 옮기기 36번)도 spec §1.4대로 그대로다.
* **사용자 결정이 필요한 선택지(구현 안 함)**: 6-1-1-1 내 분류 기준 2칸 → 1칸(spec §8 Q2 대안), 거품 관찰의 실제 5초 기다림(6칸)을 "빨리 감기(모형)"로, 분류 3기준 중 하나 빼기(내용 변경). 실제 학생 시간은 수업에서 확인해야 한다.

## 6. Supabase 차단 기록
* 자기 정적 서버(127.0.0.1:8784, `public/` 직접 서빙) + 자기 headless Chrome(포트 9352, 프로필 스크래치 `build-C1/profile`), `--host-resolver-rules="MAP *.supabase.co 127.0.0.1:9, …"` + `--disable-web-security` + 모든 탭 첫 로드 전 CDP `Fetch.enable(*supabase.co*)`.
* 가로챈 요청은 전부 가짜 응답: `site_settings` GET, `app_progress` GET/POST/PATCH/DELETE, `functions/v1/check-answer` POST(`{ok:true, verdict:"ok"}`), `app_results` POST(본문 기록). 알 수 없는 요청 0건, 실제 Supabase·Gemini 요청 0건(전 실행 로그 집계). 가짜 세션은 127.0.0.1 출처 localStorage에만 넣고 실행마다 지웠다(ref 값은 문서에 적지 않음). 페이지 오류·콘솔 오류 0건(모든 실행).
* `localStorage.clear()`는 쓰지 않았다(그 앱 `sci611sim…`·`ssUiPref:`·가짜 세션 키만 지움). 다른 탭·프로세스·다른 Chrome은 건드리지 않았다. 끝나고 Chrome·서버를 끄고 스크린숏만 남겼다.

## 7. Claude에게(공통 틀에서 찾은 것 — 고치지 않음)
1. **(낮음) 체험 모드에서 정리하기로 곧바로 다시 열면 "로그인이 풀렸어요…" 안내가 뜬다**: `lesson.js` `finish()`의 `onStage`가 마치기 단계에 들어올 때 `SciSim.Sync.isTrial()`을 **바로** 읽는데, 새로 고침으로 복원될 때는 아직 `site_settings`를 기다리는 중(`checking`)이라 체험 모드가 아닌 것으로 보고 "로그인이 풀렸어요. 다시 로그인하면…"을 그린다(`shots/conclude111-1024-finish-wrap.png` 아래쪽). 이 앱들만의 일이 아니라 마치기 단계에서 새로 고침하는 모든 앱에 같다. 제안: `getUser().then` 안에서 `isTrial()`을 다시 읽거나 `checking`이 끝난 뒤 그리기.
2. **(낮음) 휴대폰(375×812)에서 크게 보기를 직접 켜면 장면이 매우 낮다**: 막대의 실행 버튼 글자("▶ 빨랫비누 물을 흔들고 5초 기다리기")가 3줄로 접혀 막대가 높아지고 3D 칸이 약 180px만 남는다. 휴대폰 기본값은 꺼짐이라 드물다. 앱 쪽은 안내 문장이 토글을 덮지 않게만 맞췄다.

## 8. 확인하지 못한 것
* 실제 iPad·안드로이드 태블릿의 손가락 탭·드래그(합성 마우스 이벤트로만 확인), 실제 학생 소요 시간(글자 수 추정), 실제 로그인·실 DB·실제 Gemini 판정(모두 가짜 응답), 관리자 "학생 응답" 화면 렌더링(매핑 로직만 jiti로 확인 — 화면은 Review C 범위).

## 9. 스크린숏(스크래치 `…/scratchpad/build-C1/shots/`, 181장)
* 정리하기 안 '더 탐구하고 싶은 점' + 마치기: `conclude111-1024-finish-wrap.png`, `conclude112-768-finish-wrap.png`, 비우고 눌렀을 때 `conclude112-768-empty-curiosity-blocked.png`, 마친 뒤 복원 `resume111-conclude-finish-wrap.png`·`resume112-conclude-finish-wrap.png`, 예전(5단계) 모습 `old111-login-06-before-finish.png`.
* 예전 진행 기록 → 처음부터: `chk111-01-old-progress-fresh-start.png`, 머리말 접기 `chk112-03-header-collapsed.png`, 처음부터 다시 `chk111-04-after-restart.png`.
* 실험하기(실행 뒤, 두 모드): `s111-L-c2-after-base.png`(투명도, 기본)·`s111-P-c3-after-big.png`(거품, 세로 크게 보기)·`s111-D-c2-running-big.png`(어두움)·`s111-2D-c3-after-big.png`(2D)·`s111-M-c2-running-base.png`(휴대폰, 고친 뒤), `s112-P-a-start-big.png`·`s112-L-c3-after-big.png`·`s112-D-c2-after-base.png`·`s112-2D-c3-after-big.png`·`s112-M-c2-after-base.png`.
* 카메라 고침 전·후: `s111-L-c6-skip-base-BEFORE-camera-fix.png` → `s111-L2-c2-skip-base-AFTER-camera-fix.png`. 3D 탭 전·후: `t111-overview.png`·`t111-after-taps.png`, `t112-overview.png`·`t112-after-taps.png`.
* 끝까지(가짜 로그인): `final111-login-05-analyze.png`·`final111-login-07-done.png`, `final112-login-05-analyze.png`·`final112-login-07-done.png`.
