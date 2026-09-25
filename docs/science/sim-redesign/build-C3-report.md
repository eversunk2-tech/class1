# 단계 C Build 보고서 — C3: `sci-6-1-1-5`·`sci-6-1-1-6`(조사 도우미) 간략화 (2026-09-25)

지침: `build-C-instructions.md`(C3 줄, 포트 Chrome 9354·정적 서버 8786). 두 앱 모두 조사 도우미라 §4(실험 화면 점검)는 해당 없음.

## 요약
* 두 앱 모두 **5단계 → 4단계**. 따로 떨어져 있던 '궁금한 점' 단계를 없애고, 마지막 정리 단계(`wrapup`) 안에서 **결론을 제출한 뒤** `#finish-wrap`에 **'더 탐구하고 싶은 점'(필수 한 줄) + 🎉 학습 마치기**가 나오게 했다(새 기준 앱 `sci-6-2-1-4`와 같은 모양, `lesson.finish({ stage: "wrapup" })`).
* 문항: 6-1-1-5 도입 2→1·정리 문제 4→2·발전 질문 2→0 / 6-1-1-6 조사 준비 2→1·빈칸 채우기·서술형·발전 질문 삭제(정리는 보기 2 + 결론). 조사·공유 활동, 참고 자료, 남긴 질문 문구·보기·피드백, 과학 내용은 **HEAD와 글자까지 같음**(비교 스크립트로 확인).
* 저장 키 `sci6115guide:v1→v2`, `sci611guide6:v1→v2`. `detail`에 **`questionSet: 2`**, 뺀 키는 아예 생기지 않음(가로챈 `app_results` 본문으로 확인).
* 응답 매핑: 맨 앞에 **v2 "간략화 후(2026-09-25~)"**, 예전 v1은 그대로(이름만 "간략화 전(~2026-09-25)"). 확인 스크립트 **41/41 통과**.
* 브라우저 확인(체험·가짜 로그인·예전 진행 기록·휴대폰·어두움): 6-1-1-5 **79/79**, 6-1-1-6 **85/85**, 예전 진행 기록 따로 각 **8/8**. 콘솔 오류 0, 실제 Supabase·Gemini 요청 0.
* **시간(추정)**: 간략화로 보통 약 2분 20초~2분 50초, 느린 학생 약 3분 30초~4분 15초 줄었지만 **두 앱 모두 여전히 7분을 넘는다**(보통 약 7분 50초, 느린 학생 약 12분 15초 — 자료 검색 시간 제외). 남은 시간의 대부분은 이번에 바꾸지 않기로 한 조사·공유 활동(정리 틀 직접 입력, 발표 대본·새롭게 알게 된 점)이다 → 사용자 결정 필요(아래 §3).

## 1. sci-6-1-1-5 (산성 용액과 염기성 용액을 이용하는 예)

### 남긴·뺀 문항
| 단계 | 전 | 후 |
|---|---|---|
| 1 조사 시작하기 | 질문 1 `answer`(레몬·생선), 질문 2 `experience`(본 경험) | `answer`만. 힌트 3개는 모두 질문 1용이라 그대로 |
| 2 조사하기 | 참고 자료·조사 팁·정리 틀·참고 예시 비교 | 그대로 |
| 3 발표 준비하기 | 대본 + 새롭게 알게 된 점 | 그대로 |
| 4 정리 질문 | 문제 q1~q4 + 결론 + 발전 ext1·ext2 | 문제 **q1**(성질이 다른 하나)·**q3**(도마 비린내) + 결론 → 더 탐구하고 싶은 점 + 마치기 |
| 5 궁금한 점 | 따로 떨어진 단계 | 없앰 |

### 바꾼 파일
* `data/lesson-config.js`: `storageKey` v2(주석에 까닭), `stages` 4개, `question2`·`placeholder2` 삭제, `quiz` q2·q4 삭제(남긴 q1·q3 id 그대로), `conclude` ext1·ext2 삭제, `curiosity` 문구 한 줄로 + `maxLength: 200`(`minLength` 삭제).
* `app.js`: 도입 질문 1개, 결론 제출·문제 확인 때 `showFinish()`, 한 줄 입력(rows 1·Enter 막기·200자 — `sci-6-2-1-4`와 같은 코드), `buildDetail()`(아래), `lesson.finish({ stage: "wrapup", canFinish: 문제 확인·결론 제출 })`, `curiosity` gate·done 삭제, `wrapup` 완료 표시는 마친 뒤, 막힘 안내 "질문 2개에" → "질문에".
* `index.html`: 5단계 section 삭제, 4단계 안에 `#finish-wrap`(curiosity-root + 마치기 카드) → `done-card` → "처음부터 다시 하기". 4단계 안내 끝에 "끝으로 더 탐구하고 싶은 점을 한 줄 적고 학습을 마쳐요." 덧붙임.
* `style.css`: `.ss-textarea.one-line`, `.finish-card .wide`(마치기 버튼 넓게, 새 기준 앱과 같게).
* `spec.md` 끝에 "개정 (2026-09-25) 간략화" 절, `src/data/app-responses/sci-6-1-1-5.ts`.
* 문구 전→후: 궁금한 점 "…더 탐구하고 싶은 점(또는 궁금한 점)을 적어 보세요." → "…더 탐구하고 싶은 점이나 궁금한 점을 한 줄로 적어 보세요.", 칸 안내 "조사하며 더 알고 싶어진 점이나 궁금한 점을 적어 보세요." → "예: 우리 집에는 어떤 산성 용액이 있을까?"(한 줄 칸에 맞게). 남긴 질문 문구는 그대로.

### detail(가로챈 `app_results` 본문의 최상위 키)
* 전: `kind, intro{answer,experience,hintsOpened}, worksheet, propertyDiffers, comparedWithModel, share{script,reflect}, quiz{q1..q4}, conclusion, extension{q1,q2}, curiosity`
* 후(실측): `kind, questionSet(2), intro{answer,hintsOpened}, worksheet, propertyDiffers, comparedWithModel, share{script,reflect}, quiz{q1,q3}, conclusion, curiosity` — 806자, null·빈 값 없음.

## 2. sci-6-1-1-6 (산성화가 환경에 미치는 영향)

### 남긴·뺀 문항
| 단계 | 전 | 후 |
|---|---|---|
| 1 조사 준비 | q1(산성비가 계속 내린다면) + q2(호수·바다·흙과 생물), 고친 생각 `revised.q1·q2` | **q2만**(id `q2` 그대로, 화면 번호 질문 1), `revised.q2`만. 힌트 3개 모두 q2에 맞아 그대로. 개념 카드·주제 고르기 그대로 |
| 2 조사하기 | 조사 팁·정리 틀 4칸·참고 자료 속 사실 | 그대로 |
| 3 공유 준비하기 | 초안·체크리스트·예시 → 알게 된 점 | 그대로 |
| 4 정리하기 | 빈칸 채우기 → 문제 q1·q2 → 서술형 why → 발전 ext1 → 결론 | 문제 **q1·q2**(보기별 피드백 그대로) + 결론 → 더 탐구하고 싶은 점 + 마치기 |
| 5 궁금한 점 | 따로 떨어진 단계 | 없앰 |

### 바꾼 파일
* `data/lesson-config.js`: `storageKey` v2, `stages` 4개, `intro.questions`에서 q1 삭제, `fill` 삭제, `conclude` why·ext1 삭제, `curiosity` 한 줄 문구 + `maxLength: 200`.
* `app.js`: **`fillStore`(`storageKey + ":fill"`)와 빈칸 채우기 Conclude 삭제** — 새 저장 키 아래 `:fill` 키가 생기지 않음을 로컬 키·`app_progress` 스냅샷에서 확인. 처음 생각·고친 생각은 config 질문 id(`["q2"]`)로만 비교·저장, 정리하기 잠금은 문제 2개만, `showFinish()`, 한 줄 입력, `buildDetail()`, `lesson.finish({ stage: "wrapup" })`, curiosity gate·done 삭제, "두 질문" 안내 6곳 → "질문".
* `index.html`: `fill-root`·`quiz-area` 삭제, 4단계 안내·결론 잠김 문구에서 빈칸 채우기 삭제, 5단계 section → 4단계 안 `#finish-wrap`. `style.css`: 빈칸 전용 CSS 삭제, one-line·wide 추가.
* `spec.md` 끝 개정 절, `src/data/app-responses/sci-6-1-1-6.ts`.
* 문구 전→후: 궁금한 점 "…궁금한 점을 적어 보세요." → "…궁금한 점을 한 줄로 적어 보세요.", 칸 안내 "…산성화되고 있는지 궁금해요." → "…산성화되고 있을까?". 4단계 안내 "빈칸을 채우고 보기를 골라 확인한 뒤, …" → "보기를 골라 확인하고, 이어서 … 끝으로 더 탐구하고 싶은 점을 한 줄 적고 학습을 마쳐요.", 결론 잠김 "🔒 빈칸 채우기와 위의 문제 2개를…" → "🔒 위의 문제 2개를…".

### detail
* 전: `kind, topic, intro{q1,q2,hintsOpened,revised?{q1,q2}}, research, openedFacts, share{script,checked,reflect}, fill, quiz{q1,q2}, why, extension, conclusion, curiosity`
* 후(실측): `kind, questionSet(2), topic, intro{q2,hintsOpened,revised?{q2}}, research, openedFacts, share{script,checked,reflect}, quiz{q1,q2}, conclusion, curiosity` — 822자.

## 3. 시간표(추정 — 두 앱 spec.md 끝 개정 절에 자세히)
가정은 다른 새 기준 앱 spec과 같다(새로 보이는 글 음절의 70% 읽기, 보통 450음절/분·60자/분, 느린 학생 300음절/분·40자/분). 음절 수는 앱을 끝까지 진행하며 화면에서 잰 값(학생이 적은 글 제외), 자료 검색 시간 제외.

| 앱 | 1단계 | 2 조사하기 | 3 발표·공유 준비 | 4 정리(+마치기) | 합계 보통 / 느림 | 간략화 전 추정 | 줄어든 시간 |
|---|---|---|---|---|---|---|---|
| 6-1-1-5 | 0:48 / 1:43 | 2:37 / 4:11 | 1:55 / 2:51 | 2:25 / 3:36 | **7:46 / 12:22** | 10:37 / 16:37 | 2:51 / 4:16 |
| 6-1-1-6 | 1:03 / 2:00 | 2:12 / 3:18 | 1:56 / 2:52 | 2:42 / 4:03 | **7:53 / 12:13** | 10:17 / 15:46 | 2:23 / 3:33 |

* 개편 spec §1.5 추정(6-1-1-5 약 3분, 6-1-1-6 약 3~4분 절감)과 맞다.
* **7분을 넘는 까닭**: 조사하기(정리 틀 직접 입력 + 참고 자료·팁·비교 표 읽기)와 발표·공유 준비(대본 + 새롭게 알게 된 점)가 합계의 절반 이상이다. spec §1.3이 "조사 활동(worksheet·share)은 건드리지 않는다"로 정해 이번에 줄이지 않았다. 7분에 맞추려면 예: 6-1-1-5 정리 틀 최소 3줄 → 2줄(산성·염기성 각 1), 발표 준비의 '새롭게 알게 된 점'을 선택으로, 조사 팁 카드 줄이기 — **사용자 결정 필요**(이번에는 하지 않음).

## 4. 브라우저 확인(자기 정적 서버 8786 + 자기 headless Chrome 9354, 가짜 응답만)
| 확인 | 6-1-1-5 | 6-1-1-6 |
|---|---|---|
| 단계 메뉴 4칸(`--ss-steps` 4)·이름·제목 번호 1~4, `curiosity` section 없음 | ✅ | ✅ |
| 도입 질문 1개·힌트 3개 / "두 질문" 문구 없음 | ✅ | ✅(잠김·막힘 안내 모두) |
| 체험 모드 끝까지(1024×768): 서버 호출은 `site_settings`뿐(app_progress·app_results·check-answer 0), 로컬 키 모두 새 키 | ✅ | ✅(`:fill` 키 없음) |
| 퀴즈 전·결론 제출 전에는 `#finish-wrap` 숨김, 제출 뒤 보임 | ✅ | ✅ |
| '더 탐구하고 싶은 점': rows 1·200자·Enter 줄바꿈 없음·"(선택)/비워도" 없음·필수 안내, **비우면 "'더 탐구하고 싶은 점'을 한 줄이라도 적어야 마칠 수 있어요."로 거부** | ✅ | ✅ |
| 마친 뒤 4단계 ✓·완료 카드("정리 문제 2개") | ✅ | ✅ |
| 머리말 접기(단계 메뉴 숨김)·접은 채 이전/다음 이동 | ✅ | ✅ |
| 새로 고침 뒤 이어서(체험·로그인), 처음부터 다시 하기(로그인은 `app_progress` DELETE) | ✅ | ✅ |
| 가짜 로그인 끝까지(768×1024): `app_results` 1건, `questionSet: 2`, 뺀 키 없음, 키 순서·모양, 크기 < 16,000 | ✅ | ✅(고친 생각 `revised.q2`만) |
| `app_progress` 저장 본문 prefix = 새 키 | ✅ `sci6115guide:v2` | ✅ `sci611guide6:v2` |
| 예전 진행 기록(가짜 GET이 v1 prefix 스냅샷 + 이 기기에 v1 로컬 키): 1단계 빈칸으로 시작, 첫 저장이 **덮어쓰기(upsert)** + 새 prefix, 새 스냅샷에 예전 값·`fill:` 키 없음, v1 로컬 키는 읽지 않음, 새로 고침 뒤 새 판 이어서 | ✅ 8/8 | ✅ 8/8 |
| 휴대폰 375×812·어두움: 가로 스크롤 없음(1·4단계) | ✅ | ✅ |
| check-answer(가짜) 본문에 user id·이메일 없음(stage predict·curiosity만) | ✅ | ✅ |
| 콘솔 오류 | 0 | 0 |

* 처음 한 번은 "예전 진행 기록"의 첫 저장이 upsert가 아닌 insert로 잡혔다 → 앞 시험의 앱 페이지를 띄운 채 키를 지운 **시험 순서 탓**(그 페이지의 pagehide 저장이 섞임)으로 확인하고, 빈 페이지로 떠난 뒤 준비하도록 고쳐 다시 돌려 통과했다(앱 문제 아님).

## 5. 응답 매핑 확인 스크립트(`node_modules/jiti`, 스크래치 — 저장소에 넣지 않음) 출력 요약
HEAD 매핑(`git show 9d2dc16:…`)과 지금 매핑에 같은 detail을 넣어 비교(변형 고르기·항목·extras 규칙은 `src/lib/app-responses.ts`와 같게), 지금 매핑은 실제 `extractResponses`·`groupByStage`·`progressInfo`로.
```
[sci-6-1-1-5] 변형 순서 v2 → v1, stages 4단계, standard slim
 (1) 예전 detail(모든 키) → 간략화 전(~2026-09-25), items 16, extras [] , HEAD 매핑과 항목 같음(버전 이름만 "현재 버전"→"간략화 전")
     groupByStage: intro(조사 시작하기):3 → research:3 → share:2 → wrapup(정리 질문):7 → curiosity(궁금한 점):1
 (1) 예전 detail(빈 값 섞임) → 간략화 전, items 16, extras [], HEAD와 같음
 (2) 가로챈 새 detail → 간략화 후(2026-09-25~), items 11(v2 항목 전부), extras [], 빈 글 없음
     intro:answer, intro:hintsOpened, research:worksheet·comparedWithModel·propertyDiffers, share:script·reflect, wrapup:q1·q3·conclusion·curiosity
     groupByStage: intro:2 → research:3 → share:2 → wrapup:4, 질문 문구 = 앱 config 문구
 progressInfo: 예전 step=curiosity → {"궁금한 점", index null, total 4} / 새 step=wrapup → 4/4
[sci-6-1-1-6] 변형 순서 v2 → v1, stages 4단계, standard slim
 (1) 예전 detail(고친 생각 있음) → 간략화 전, items 18, extras [], HEAD와 같음
     groupByStage: intro(조사 준비):6 → research:2 → share:3 → wrapup(정리하기):6 → curiosity(궁금한 점):1
 (1) 예전 detail(고친 생각 없음·빈 값) → 간략화 전, items 16, extras [], HEAD와 같음
 (2) 가로챈 새 detail → 간략화 후, items 13(v2 항목 전부), extras [], 빈 글 없음
     intro:q2·revised.q2·hintsOpened·topic, research:research·openedFacts, share:script·checked·reflect, wrapup:quiz.q1·quiz.q2·conclusion·curiosity
 (2') 새 detail에 고친 생각 없음 → 간략화 후, revised 항목 없음, extras []
 progressInfo: 예전 step=curiosity → {"궁금한 점", index null, total 4} / 새 step=wrapup → 4/4
41/41 passed
```
* 매핑 결정: v2의 6-1-1-5 `quiz.q3` 항목 이름은 화면과 같게 "문제 2"(키 `wrapup:q3`는 예전과 같음). 관리자 질문별 보기는 (버전+키+문구)로 묶으므로 예전·새 기록은 "이전 버전 질문 · 간략화 전"으로 따로 보인다(설계대로). 예전 진행 중 행은 관리자 화면에 "궁금한 점 · 마지막 저장 …"(단계 번호 없이)으로 보인다 — 오류 없음.

## 6. 규칙·정리
* `diff -r scripts/templates/science-guide public/apps/sci-6-1-1-{5,6}/science-guide` 같음, `class1-record.js` 정본과 같음(공통 틀 수정 없음).
* `npm run lint` 통과, `node_modules/.bin/tsc --noEmit -p tsconfig.json` 통과. 앱 JS `node --check` 통과. 학생 화면 문자열에 "지도서" 없음.
* 고친 파일은 두 앱 폴더(공통 틀 사본 제외), `src/data/app-responses/sci-6-1-1-5.ts`·`sci-6-1-1-6.ts`, 이 보고서뿐. (`git status`의 `sci-6-1-1-1~4.ts` 변경은 C1·C2 것.)
* Supabase 차단: `--host-resolver-rules`(supabase.co → 127.0.0.1:9) + CDP `Fetch.enable(*supabase.co*)`로 **모든** supabase 요청을 가짜로 응답(가로채지 못한 요청 0, 예상 밖 경로 0). 가짜 세션은 127.0.0.1 출처 localStorage에만. check-answer도 가짜(실제 Gemini 0). 내려받은 파일 없음(CDN은 페이지가 스스로 부름). `localStorage.clear()` 쓰지 않음(이 앱 키·`ssUiPref:`·가짜 세션 키만 지움).
* 끝난 뒤: 내 Chrome(9354)·정적 서버(8786) 종료 확인. **스크래치 정리(삭제)는 권한 요청이 거부되어 하지 못했다** — `build-C3/` 안에 스크린숏(`shots/`) 말고도 시험 스크립트(`lib.mjs`, `common.mjs`, `flow115.mjs`, `flow116.mjs`, `oldprog.mjs`, `measure.mjs`, `removed.mjs`, `timecalc.mjs`, `mapcheck.mjs`), `profile/`(내 Chrome 프로필 — 시험이 끝날 때마다 앱 키·가짜 세션 키는 지움), `out/`(가로챈 시험 detail·결과 JSON), `head/`(HEAD 매핑·config 사본), `chrome.pid`, `server.log`가 남아 있다. service_role 같은 비밀값은 없다(프로필 캐시에는 이미 공개된 앱 `config.js`의 주소·anon key가 있을 수 있다). 모두 지워도 된다.

## 7. 스크린숏(`/private/tmp/claude-501/-Users-sungchul-Desktop-classroom/7bf3a39e-3017-4189-b337-1b82aace66bb/scratchpad/build-C3/shots/`)
* 정리 단계 안으로 옮긴 모습: `115-04-체험-정리질문-더탐구·마치기-1024x768.png`, `115-08b-로그인-더탐구·마치기-768x1024.png`, `115-09-로그인-마침-768x1024.png`, `116-04-체험-정리하기-더탐구·마치기-1024x768.png`, `116-05-로그인-정리하기-더탐구·마치기-768x1024.png`, `116-06-로그인-마침-768x1024.png`
* 휴대폰·어두움: `115-11-휴대폰-어두움-더탐구·마치기-375x812.png`, `116-08-…`, `115-10-…조사시작…`, `116-07-…주제고르기…`
* 기타: `115-01-체험-조사시작-1024x768.png`(질문 1개·단계 4칸), `115-03`·`116-03`(정리 문제 2개), `116-01`·`116-02`(조사 준비 질문 1개·개념 카드), `115-06-머리말접기-1024x768.png`, `115-02`(정리 틀), `115-05`·`115-07`·`115-08a`

## 8. 확인하지 못한 것·참고
* 실제 태블릿·실제 로그인·실제 DB·실제 Gemini, 실제 학생 소요 시간(시간표는 추정).
* (공통 틀, 이번에 고치지 않음) '더 탐구하고 싶은 점'을 비워 한 번 거부된 뒤 한 줄을 적어도 "…한 줄이라도 적어야 마칠 수 있어요." 안내가 다음 클릭 때까지 남아 있다(`lesson.js`의 `finish-msg` — 새 기준 앱도 같음). 입력하면 지우도록 공통 틀에서 고치면 좋겠다.
* (공통 틀, 저장 키를 올리는 모든 앱에 해당) 배포 전에 **올리지 못한(dirty) v1 로컬 사본**이 남은 태블릿에서 로그아웃하면, 블로그 로그아웃의 올리기(`flushLocalProgress`)가 v1 스냅샷을 같은 `app_progress` 행에 올리려다 충돌 창("이 기기의 기록 / 저장된 기록")을 띄울 수 있다. 학생이 "이 기기의 기록"을 고르면 v2 진행 기록이 v1으로 덮이고 다음에 열 때 처음부터 시작한다(완료 기록은 영향 없음). 드문 경우라 알림만 남긴다.
* 6-1-1-6 `openedFacts` 값의 알려진 한계(review M2, 대시보드 "알 수 없음")는 범위 밖이라 그대로.
