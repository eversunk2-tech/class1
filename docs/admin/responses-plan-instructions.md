# Plan 서브에이전트 지침: 관리자 대시보드 — 학생 입력 내용 모아 보기 · 피드백 · 일괄 칭찬

## 사용자 요청 (2026-09-22)
* 지금 관리자 대시보드는 학생의 활동 완료 여부·학습 시간 등 결과만 보인다.
* **학생들이 시뮬레이션 실험 과정에서 입력한 내용을 관리자가 모두 확인**할 수 있게 한다. 앱 화면을 그대로 보여주는 것이 아니라 **주요 입력 내용만 질문과 함께 모아 정리**해서 보여준다.
* 관리자가 확인 후 필요하면 **개별 피드백**을 줄 수 있게 한다.
* **활동을 마무리한 학생 전체에게 일괄 칭찬 피드백**을 보낼 수 있게 한다. 칭찬 문구를 **미리 몇 가지** 만들어 클릭만으로 쓰게 하고, **직접 입력**도 가능하게 한다.

## 목표
설계를 `docs/admin/responses-spec.md`에 작성한다. **구현하지 않는다.**

## 먼저 읽을 것
* `CLAUDE.md`, `AGENTS.md`(Next.js 16 → `node_modules/next/dist/docs/`)
* 관리자 대시보드: `docs/admin/spec.md`(§14 우선), `src/app/admin/**`, `src/lib/learning.ts`, `src/lib/admin.ts`, `src/components/feedback/**`, `src/app/me/learning/**`
* DB: `supabase/migrations/*.sql` — 특히 `app_results`, `app_progress`, `feedback_threads`(context 종류)·`feedback_messages`·`feedback_read_marks`, `get_or_create_feedback_thread`, `feedback_thread_summaries`
* 앱: `public/apps/sci-*/`(12개)의 `data/lesson-config.js`, `app.js`에서 **`Class1Record.save`로 저장하는 `detail` 구조**와 `app_progress`에 저장되는 상태(공통 틀 `scripts/templates/science-sim|science-guide/persist.js`, `lesson.js`)
* `scripts/templates/class1-record.js`

## 반드시 다룰 설계 이슈
1. **질문-답 짝짓기**: 앱마다 detail 형식이 다르고 질문 문구가 저장되지 않는다.
   * (a) **이미 사용한 앱(1단원 6개 등)의 기존 기록**을 보여주는 방법 — 예: 앱별 "응답 매핑" 데이터(`src/data/app-responses/` 등, 질문 문구·단계·detail 경로·표시 형식)를 앱의 lesson-config에서 뽑아 만든다. 12개 앱 각각의 detail 구조를 **실제 코드에서 조사**해 매핑 가능 여부를 표로 정리.
   * (b) **앞으로**: 공통 틀이 완료 시 `detail.qa = [{ stage, id, question, answer, kind }]` 같은 **표준 형식**을 함께 저장하게 해 매핑 없이 표시(하위 호환). 기존 앱에 적용할지, 새 앱부터인지 제안.
   * 진행 중(미완료) 학생의 입력도 `app_progress`에서 보여줄지, 어떻게 매핑할지.
   * 기록 표(측정값)·분석 선택(정답 여부)·서술형(예상·결론·궁금한 점)을 어떻게 요약 표시할지.
2. **화면 설계**: `/admin/learning/` 또는 새 경로(예: `/admin/learning/responses/?app=...`)에서 ① 앱(차시) 선택 → 학생별 응답 모아 보기(질문별 열/카드, 완료·진행 중 구분, 검색·정렬) ② 질문별로 반 전체 답 비교 보기 ③ 학생 한 명 상세. 모바일/태블릿 대응. 기존 회원 상세·학습 현황 화면과의 연결.
3. **개별 피드백**: 기존 `feedback_threads`(context: app_result 등) 재사용. 응답 카드에서 바로 피드백 작성, 학생은 "내 학습 활동"에서 확인·답글(기존 흐름).
4. **일괄 칭찬**: 특정 앱을 **완료한 학생 전체**(또는 선택한 학생)에게 한 번에 메시지. 미리 만든 칭찬 문구 5~8개(초등 6학년 눈높이, 따뜻하고 구체적, `{이름}` 같은 치환 여부 제안) + 직접 입력. 이미 칭찬을 보낸 학생 중복 방지/표시. 서버 쪽 처리(예: `admin_bulk_feedback(app_id, body, student_ids[])` security definer RPC, is_admin 검사, 1회 최대 인원)와 RLS. 문구 목록을 코드에 둘지 DB(교사가 편집 가능)에 둘지 추천.
5. **보안**: 관리자만 학생 입력 열람, 학생 입력 XSS 방지(텍스트로만 표시), 대량 전송 남용 방지.
6. 정적 export·basePath·한국어·기존 코드 영향.

## spec.md 구성
1. 요약 / 2. 앱별 detail·progress 구조 조사표(12개) / 3. 질문-답 표준 형식과 매핑 방식 / 4. 화면 목록·상세 / 5. DB 변경(SQL 초안, 재실행 안전) / 6. 칭찬 문구 초안 / 7. 파일 구조(신규/수정) / 8. 구현 단계 분할 / 9. 사용자가 할 일 / 10. 위험과 한계 / 11. 열린 질문(추천안 포함)

## 수정 범위
`docs/admin/responses-spec.md`만 작성. 그 외 읽기만. git 조작·DB 쓰기 금지.
