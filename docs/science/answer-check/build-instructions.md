# Build 서브에이전트 지침: 학생 답 되짚기·차단 (2026-09-23 사용자 승인)

설계: `docs/science/answer-check/spec.md` — **끝의 "개정 1"이 열린 질문보다 우선**. `CLAUDE.md`(과학 차시 앱 규칙, SQL 절차)도 읽는다.

## 만들 것
1. **공통 틀**: `scripts/templates/science-sim/`에 `answer-check.js`(설계 §5.3·§1)를 더하고 `predict.js`·`conclude.js`·`index.html` 스크립트 순서·`style-common.css`·`README.md`를 맞춘다. 조사용 틀 `scripts/templates/science-guide/`도 같은 방식으로(그 틀의 predict/conclude에 맞게).
2. **Edge Function** `supabase/functions/check-answer/`(설계 §2.3): Verify JWT 전제, `Deno.env.get("GEMINI_API_KEY")`, 3단계 판정(ok/rethink/block), 6학년 눈높이 두 문장 이내 피드백, 답 누설 금지, 프롬프트에 off-topic 예시 포함, 시간 제한·오류 시 안전 응답. **키를 코드·저장소·로그에 절대 남기지 않는다.** 학생 식별 정보를 받지도 보내지도 않는다.
3. **앱 사본 동기화**: 고친 틀을 `public/apps/sci-*/science-sim/`, `public/apps/sci-*/science-guide/`, `class1-record.js`에 복사하고 `diff -r`로 확인(23개 앱 전부).

## 반드시 지킬 것
* 저장 키(`:vN`)·저장 구조(`app_progress.state`, `app_results.detail`/`detail.qa`)를 **바꾸지 않는다**. `blockCount`·`teacherOverride`는 설계 §3대로 **기존 구조를 깨지 않는 추가 필드**로만.
* **차단은 좁게**: 로컬은 확실한 무의미만, off-topic은 Gemini만. Gemini가 응답하지 못하면 차단하지 않는다(강등). 틀렸지만 주제에 맞는 답은 차단 금지.
* 되짚기(rethink)는 질문당 1번, 그 뒤 통과. 같은 질문 3번째 차단부터 "🙋 선생님과 확인했어요" 버튼.
* 7분 기준: Gemini 대기 시간 제한(설계값)과 "기다리는 중" 표시, 지나면 통과.
* 앱 고유 파일(`app.js`, `data/lesson-config.js`, `index.html` 본문)은 되도록 건드리지 않는다. 스크립트 태그 추가처럼 꼭 필요한 변경만 23개 앱에 **동일한 방식**으로 적용하고 목록을 보고서에 적는다. 문항 내용·수치·저장 키는 그대로.
* git 명령 금지, 실 DB·Storage 쓰기 금지, 실제 Gemini 호출 금지(가짜 응답으로 시험). 브라우저는 자기 전용 headless만, `localStorage.clear()` 금지.

## 검증
* 가짜 세션 + 가짜 함수 응답으로: ok/rethink/block 각 경로, 3번째 차단 후 교사 확인 버튼, Gemini 실패(오프라인·시간 초과·오류·한도)에서 **차단되지 않음**, 로컬 무의미 입력 차단, 되짚기 1회 규칙, 새로고침 후 복원, 완료 저장(`detail.qa` 모양 유지 + 추가 필드).
* 앱 최소 5개(`sci-6-1-1-1`, `sci-6-1-2-3`, `sci-6-2-1-5`, `sci-6-2-2-2`, `sci-6-2-3-2`)와 조사 앱 1개(`sci-6-1-1-5`)를 끝까지 진행. 태블릿 가로·세로, 375px, 다크모드, 콘솔 오류 0.
* Edge Function은 로컬에서 함수 코드를 단위 수준으로 점검(프롬프트 생성, 응답 파싱, 오류 처리). 실제 배포는 사용자가 한다.

## 보고
`docs/science/answer-check/build-report.md`: 바꾼 파일, 동기화 확인, 판정 경로별 시험 결과, 앱별 변경 목록, 사용자가 할 일(키 발급·secrets·배포 명령), 확인 못 한 것.
