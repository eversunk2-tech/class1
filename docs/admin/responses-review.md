# Review: 관리자 "학생 응답" · 개별 피드백 · 일괄 칭찬

지침: `docs/admin/responses-review-instructions.md` · 기준: `docs/admin/responses-spec.md`(§12 우선) · 대상: `git diff HEAD` + 새 파일 전부.
코드 수정·커밋·실 DB 쓰기 없음. 임시 스크립트는 세션 스크래치에만 둠.

## 1. 요약

| 심각도 | 개수 |
|---|---|
| Critical | 0 |
| High | 1 |
| Medium | 3 |
| Low | 12 |

- **1단원 앱 6개 매핑은 정확함.** 각 앱의 실제 `lesson-config.js`로 `buildDetail`과 똑같은 detail을 만들고, 실제 `extractResponses`·`groupByStage`에 넣어 확인했다. 모든 답이 맞는 질문(문구가 config와 글자 그대로 같음) 아래에 나오고, 빠지는 값도 없다. git 이력 전체에서 이 앱들의 detail 모양은 바뀐 적이 없다.
- **High 1건:** 질문별 보기가 `stage:id`로만 묶는다. 그래서 2단원 탐구 3·4·5에서 예전 버전(v1) 결과와 새 결과가 **서로 다른 질문인데 한 질문 아래 섞인다**. 선택 분포와 정답 수도 합쳐진다. 학생별 보기(버전별 매핑)는 정확하다.
- 보안: 관리자 가드와 RLS, 텍스트로만 렌더링하는 방식, `praise_presets` RLS와 재실행 안전성, 스레드 주인 검증(RPC가 결과 주인 = 학생인지 확인)은 모두 적절하다.
- 일괄 칭찬은 대체로 정확하다. 연타 방지, 최대 50명, 확인 단계, 부분 실패 후 실패한 학생만 재전송이 모두 동작한다. 남은 것은 이름 폴백 문구와 "이미 보냄" 판정 범위 같은 경계 사례뿐이다.

## 2. 앱별 매핑 검증

| 앱 | 확인 방법 | 결과 |
|---|---|---|
| sci-6-1-1-1 | config를 vm으로 불러와 buildDetail 모양 그대로 detail 생성 → 실제 `extractResponses` 실행(jiti). 질문·보기 문구를 config와 대조. git 이력 확인(변경 없음) | OK. 기록 23행 방법 id→이름, 분류 3라운드, 내 기준 2문항, `skipped`는 의도대로 숨김. Low: 방법 이름 "흔들어 보기(5초 이상 거품 유지)"가 config("흔들어 보기")보다 길다(의도된 보충) |
| sci-6-1-1-2 | 같음 | OK. `indicator` 원본 id→지시약 이름, 단계 A/B, 분석 q1~q5 문구·보기 일치. Low: 분류 질문 문구가 config와 글자 그대로는 아님(`sci-6-1-1-2.ts:56`) |
| sci-6-1-1-3 | 같음 | OK. 기록 8행(이미 라벨), 분석 q1~q4 일치 |
| sci-6-1-1-4 | 같음 | OK. `readA/inferA/q1~q3` 문구·보기 일치, 기록(방울 수·색 계열) 정확 |
| sci-6-1-1-5 (guide) | 같음 | OK. Low: notes 문구 두 곳이 부정확함(§3 L4) |
| sci-6-1-1-6 (guide) | 같음 | 매핑은 OK(topic, 고친 생각, research 1줄, fill, `quiz` 키, why, extension 문자열). Medium: `openedFacts` 값 자체를 믿을 수 없음(§3 M2). Low: 발표 대본 질문이 첫 문장만 나옴 |
| sci-6-1-2-1 | 변형 1개. transpile한 매핑 × 설정 대조 | OK |
| sci-6-1-2-2 | 같음 | OK. 동적 키 `directions`/`countRetries`는 2열 표 |
| sci-6-1-2-3 | 6c4dafb·988083d·fac38d9 버전별 config·buildDetail 추출 → 버전 감지·문구 대조, 새 `qa` 모듈 실행(가짜 DOM) | 학생별 보기 OK(v1/v2·v3/v4 감지 정확, v3 `photo:null` 포함). 질문별 보기는 H1. Low: 기록이 빈 v3는 v4로 판정됨(마침 조건상 불가) |
| sci-6-1-2-4 | 같음 | 학생별 보기 OK(`times`/`averages`/v1). 질문별 보기는 H1 |
| sci-6-1-2-5 | 같음 | 학생별 보기 OK(v1 교통수단). 질문별 보기는 H1(`analyze:units`). Low: v3 결과가 "20.0 km/h" 문구로 보임(학생이 본 것은 "20 km/h") |
| sci-6-1-2-6 (guide) | 변형 1개 | OK. `quiz` 키, 수칙·장치·위치 차이 표 |

틀 사본: 12개 앱의 `science-sim`/`science-guide`가 모두 `scripts/templates/*`와 같다. 바뀐 JS는 모두 `node --check`를 통과했다.

## 3. 문제 목록

| # | 심각도 | 위치 | 현상 | 재현 | 수정 제안 |
|---|---|---|---|---|---|
| H1 | High | `src/app/admin/(dashboard)/learning/responses-view.tsx:280-295` | 질문별 보기가 `item.key`(`stage:id`)로만 질문을 묶고, 문구는 처음 나온 학생 것을 쓴다. 예전 버전과 새 버전이 같은 id를 다른 질문에 쓴다: 탐구 3의 `predict:q1`, `analyze:q1`, `analyze:q2`; 탐구 4의 같은 세 개; 탐구 5의 `analyze:units`. 그래서 **다른 질문의 답이 한 질문 아래 표시되고**, 보기별 인원(서로 다른 보기 목록이 합쳐짐)과 정답 수가 섞인다. Build 보고서 §4도 이를 인정한다 | 2-3에 v1 결과 1개와 v4 결과 1개가 있는 상태에서 질문별 보기 › 분석 2를 연다 | 매핑 key에 변형 id를 넣는다(예: `analyze:v1.q1`). 또는 key + question 문구로 묶는다. 최소한 섞일 때 경고를 표시한다 |
| M1 | Medium | `responses-view.tsx:100`, `praise.ts:86` | 이름 폴백이 `display_name` → **이메일 앞부분** → "이름 없음"이다. 일괄 칭찬 `{이름}` 치환에 그대로 쓰여 "이름 없음 학생, …"이나 "s2024xxxx 학생, …"(학번 같은 이메일 아이디)이 학생에게 실제로 보내질 수 있다. 명단을 못 불러오면(`rosterMissing`) 표시 이름이 없는 학생은 모두 "이름 없음"이 된다 | 표시 이름이 없는 학생이 완료 → 칭찬 보내기 | 이름이 없는 대상은 확인 단계에서 따로 경고한다. 또는 `{이름}` 자리를 빈칸 대신 "우리 반"처럼 자연스러운 말로 바꾸거나, 그 학생을 기본 선택에서 뺀다 |
| M2 | Medium | `public/apps/sci-6-1-1-6/app.js:322`, `science-guide/ref-cards.js:29-31,68-71,92` + 매핑의 `openedFacts` 항목 | 관리자 화면은 "참고 자료를 열어 보았나요?"라고 묻는데, 저장값 `refOpen`은 카드를 **접었다 폈다 토글할 때만** 기록된다. 잠금이 풀리면 카드가 저절로 열리므로, 자료를 본 학생도 대부분 "아니요"로 나온다(코드 분석 기준, 브라우저로 재현하지는 않음). 이미 수업에 쓴 앱이라 교사가 잘못 판단할 수 있다 | 조사 4칸 채우기 → 저절로 열린 자료 읽기 → 마침 → `openedFacts:false` | 앱은 소급하지 않는 원칙이므로 매핑에서 이 항목을 숨기거나 "참고용(부정확할 수 있음)" 주석을 단다 |
| M3 | Medium | 검증 범위(Build 보고서 §4) | 1단원 앱을 실제 브라우저로 끝까지 진행해 detail을 만든 확인이 없다(Build도, 이 리뷰도). 코드로 재구성한 detail로만 확인했다 | — | 배포 전에 관리자 계정으로 실제 1단원 결과 몇 건을 학생 응답 탭에서 원본 JSON과 대조한다(보고서 "사용자가 할 일 2") |
| L1 | Low | `src/lib/app-responses.ts:143-144` | `detail.qa`가 있으면 매핑을 아예 쓰지 않아 `extras: []`가 되고 매핑 notes도 사라진다. 그래서 탐구 3의 `hintsOpened`와 "분석 1은 자기 기록으로 채점" 주석이 새 결과에서는 보이지 않는다 | 새 2-3 결과 보기 | qa가 다루지 않은 최상위 키는 extras로 보여 주고, 매핑 notes는 유지한다 |
| L2 | Low | `scripts/templates/science-sim/quiz.js` `qa()` | 확인하지 않은 문항이 `correct:false`로 저장돼 "오답"으로 보인다 | — | `!s.checked`이면 `correct:null` |
| L3 | Low | `scripts/templates/science-guide/conclude.js` `qa()` | 제출하지 않은 항목이 answer `""` + `submitted:false`로 저장된다. 화면에 "(비어 있음)"과 "제출하기 전 입력 중이던 글"이 함께 떠서 서로 모순된다(아직 qa를 내는 guide 앱은 없음) | — | guide 쪽은 `submitted`를 빼거나 안내 문구를 구분한다 |
| L4 | Low | `src/data/app-responses/sci-6-1-1-5.ts:23-26` | notes에 `share.reflect`도 제출 후에만 저장된다는 내용이 없다. 또 "이름이 같을 때만 비교"라는 설명이 실제 부분 일치 규칙과 다르다 | — | 주석 문구를 고친다 |
| L5 | Low | `src/data/app-responses/sci-6-1-2-5.ts`(units) | v3 결과인데 "20.0 km/h" 문구로 보인다(v3와 v4는 모양이 같아 구분할 수 없음) | — | 문구를 "20(.0) km/h"로 바꾸거나 주석을 단다 |
| L6 | Low | `responses-view.tsx:111` · `praise-dialog.tsx:86` | "이미 보냄"을 **최신 완료 결과**의 스레드로만 판정한다. 칭찬을 받은 뒤 앱을 다시 완료한 학생은 "안 보냄"으로 보여 기본 선택에 들어가고, 중복 칭찬을 받는다. 반대로 칭찬이 아닌 다른 피드백을 받은 학생도 "이미 보냄"이 된다(보고서가 인정한 부분) | 칭찬 → 학생이 다시 완료 → 칭찬 보내기 | 학생의 모든 결과 스레드에서 선생님 메시지를 센다(표시만) |
| L7 | Low | `src/lib/praise.ts:120-121` | 메시지 insert는 성공했는데 응답이 유실되면(네트워크) 실패로 집계된다. "다시 보내기"를 누르면 중복 전송된다. 관리자 탭 두 개에서 동시에 보내도 중복된다 | 드묾 | 재전송 전에 그 스레드의 최근 선생님 메시지를 확인하거나, 보낸 뒤 목록을 다시 불러와 확인한다 |
| L8 | Low | `responses-view.tsx:93` | 명단은 `role=user`로 거르지만, 결과·진행 행은 역할과 상관없이 합친다. 관리자가 시험 삼아 완료한 기록이 "학생"으로 나오고 칭찬 대상에도 들어간다 | 관리자 계정으로 앱 완료 | 명단이 있으면 명단에 없는 id는 칭찬 대상에서 뺀다 |
| L9 | Low | `praise-dialog.tsx:87-99` | 완료 학생이 50명을 넘으면 기본 전체 선택 상태에서 곧바로 "50명까지" 오류가 난다. "앞 50명만 고르기" 같은 도움 기능이 없다 | 완료 51명 이상 | 기본 선택을 50명으로 자르거나 안내 버튼을 둔다 |
| L10 | Low | `public/apps/sci-6-1-2-{3,4,5}/app.js` buildDetail · `science-sim/lesson.js:209-215` | `qa` 생성 중 예외가 나면 `saving`이 true로 남아 마침 버튼이 잠긴다(기존 구조와 같음, 지금 코드에서 예외 경로는 발견되지 않음). qa 때문에 detail 크기가 약 2배가 된다(16,000자 한도보다는 한참 아래) | — | qa 생성을 try/catch로 감싸 실패해도 기존 필드는 저장되게 한다 |
| L11 | Low | `src/data/app-responses/sci-6-1-1-6.ts:69`, `sci-6-1-1-2.ts:56` | 질문 문구가 config와 글자 그대로 같지 않다(첫 문장만 있거나 다른 말로 바꿔 씀). 답은 맞는 질문에 붙어 있다 | — | config 문구를 그대로 쓴다 |
| L12 | Low | `sci-6-1-2-3.ts` 신 기준 변형 판정 | `records`가 빈 v3 결과가 v4로 판정된다(마침 조건상 실제로는 생기지 않음) | — | 판정 조건에 버전 표지를 추가한다 |

## 4. 보안 점검 결과

- **관리자 전용:** `/admin/**`는 `src/app/admin/layout.tsx`의 `AdminGuard` 아래에 있다. 회원 상세의 "응답 보기"는 `audience==="admin"`일 때만 보인다(학생 `/me/learning/`에는 없음). 데이터는 기존 RLS(관리자만 전체 `app_results`·`app_progress`·`feedback_*`)로 보호된다. 새 조회는 모두 anon/authenticated 클라이언트 쿼리이고 서버 권한 우회가 없다.
- **XSS:** 새 코드 전체에 `dangerouslySetInnerHTML`·`innerHTML`이 없다(grep 확인). 원본 JSON은 `JSON.stringify`한 결과를 텍스트 노드로 넣는다. 칭찬 미리보기와 이름도 텍스트로만 들어간다. `{이름}` 치환은 split/join이라 `$` 같은 특수문자도 안전하다.
- **`praise_presets` SQL:** `if not exists`, 이름 붙은 제약을 drop 후 다시 add, 정책 drop/create, anon 권한 없음, select/insert/update/delete 모두 `is_admin()`. 시드는 `where not exists`라 다시 실행해도 중복되거나 되살아나지 않는다. 문제 없음.
- **오발송:** `studentId`와 `resultId`는 같은 학생의 결과 목록에서 나온다. `get_or_create_feedback_thread`는 `app_results.user_id = p_student_id`를 서버에서 확인하므로, 다른 학생의 스레드로 갈 수 없다.
- **남용 방지:** 1회 최대 50명(UI와 `sendPraise` 둘 다 검사), `firing` ref로 연타 방지, 보내는 중에는 다이얼로그를 닫을 수 없음, 확인 단계에서 인원·미리보기·재전송 경고, 동시 5개씩 전송. 보낸 학생은 선택에서 빠지고 실패한 학생만 남는다.
- 참고(정보): 학생은 자기 `app_results.details.qa`를 직접 API로 넣을 수 있다. 그러면 관리자 화면에 임의의 "질문" 문구가 보이지만, 텍스트로만 표시되고 본인 데이터라 위험은 낮다.

## 5. 확인한 것 vs 못 한 것

**확인함**
- `tsc --noEmit` 통과, `npm run lint` 경고 0.
- 12개 앱의 매핑을 실제 config와 buildDetail 모양으로 실행 검증했다. 2단원 3·4·5는 git 이력의 모든 버전을 확인했다. 새 `qa()` 모듈은 가짜 DOM에서 실행했다(빈 상태와 채운 상태 모두 예외 없음, 기존 `values()`/`result()` 결과는 그대로).
- 틀 사본 일치, 바뀐 JS `node --check`.
- 보안·일괄 칭찬 로직은 코드 리뷰로 확인했다(§4).

**못 함**
- `npm run build`: 실행 중인 dev 서버의 `.next`/`out`과 부딪히지 않게 하려고 실행하지 않았다. Build 보고서에서는 통과로 나와 있다.
- 브라우저 확인: 가짜 로그인으로 탐구 3·4·5를 끝까지 진행하는 흐름, 나머지 9개 앱의 단계 진입, 관리자 화면 렌더링(태블릿·375px·다크모드·콘솔 오류), 기존 탭·회원 상세·내 학습 피드백의 회귀. 모두 직접 실행하지 않았고 Build 보고서의 결과에 의존한다.
- 실제 DB의 RLS 동작과 실제 학생 데이터(실 DB 쓰기 금지).
