# Build 지침(rollback) — ③ 권한 좁히기를 되돌리는 비상용 SQL (2026-09-26, Review 제안)

당신은 **Build** 담당이다. SQL 파일 하나를 만들고 검증해 보고서를 쓴다. **실 DB에 실행하지 않는다.**

## 왜
사용자가 곧 `supabase/migrations/20260927010000_classes_rls.sql`(③)을 실행한다. 실행 뒤 수업 중에 문제가 생기면(예: 담임에게 학생 기록이 안 보임) 원인을 찾는 동안 **③ 이전 상태로 바로 되돌릴** 수 있게 비상용 SQL을 미리 준비해 둔다(Review `docs/classes/review.md` §4 제안).

## 먼저 읽기
`CLAUDE.md`(Supabase·SQL 적용 절차), `docs/classes/review.md`, ③ 파일 전체, ① `20260927000000_classes_schema.sql`, 그리고 ③이 바꾸는 정책·함수의 **지금 정의**가 있는 기존 마이그레이션 13개(`supabase/migrations/2026092[1-6]*.sql` — 같은 이름이 여러 번 나오면 **파일 순서상 마지막 정의가 지금 상태**).

## 만들 것: `docs/classes/rollback-classes-rls.sql`
* ③이 바꾼 것 **전부**를 ③ 이전 정의로 되돌린다:
  * 정책(대략 16개): ③이 만든 새 이름 정책을 `drop policy if exists`로 지우고, ③이 지운 옛 이름 정책을 **옛 정의 그대로**(이름·`for`·`to`·`using`·`with check` 글자 그대로) 다시 만든다. 63바이트가 넘는 옛 이름 2개는 처음 만들 때처럼 긴 이름 그대로 써도 된다(Postgres가 똑같이 자른다).
  * 함수(8개 — `admin_must_change_password_ids`, `assignment_submission_guard`, `get_or_create_feedback_thread`, `mark_thread_read`, `unread_feedback_count`, `admin_set_login_required`, `admin_set_role`, `admin_dashboard_stats`): 옛 본문 **글자 그대로** + 옛 권한(`revoke`/`grant`) 그대로.
  * ①이 만든 표·열·도우미 함수·RPC·트리거는 **그대로 둔다**(지워도 이득이 없고, 학급 정보가 사라진다). ④ `class_notices`도 건드리지 않는다.
* 재실행 안전(`drop … if exists` + `create policy`, `create or replace function`), 파일 맨 위에 "언제·어떻게 실행하는지"(SQL Editor 전체 Run, 한 트랜잭션), 되돌린 뒤 사이트가 어떻게 되는지(교사 누구나 전체 기록 보기 — ③ 이전과 같음, 관리자 화면은 그대로 동작), 확인 쿼리(학생 기록·회원 표 11개에 `is_admin()` 정책이 다시 있는지 등), 맨 끝 스스로 점검(옛 정책 이름이 모두 있고 새 이름 정책이 없는지 — 아니면 `raise exception`으로 전부 되돌림).
* 이메일·개인정보를 쓰지 않는다.

## 검증(보고서에 결과)
1. 옛 정의와 **글자 대조**: 되돌리는 정책·함수 각각을 원래 마이그레이션의 그 정의와 스크립트로 비교(공백만 정규화) — 모두 같아야 한다. 어느 파일의 몇째 줄 정의를 가져왔는지 표로.
2. ③이 바꾼 것 목록(③을 읽어 뽑은 것)과 되돌리는 목록이 하나도 빠짐없이 짝이 맞는지.
3. 정책 이름 바이트 수, 재실행 안전, 42P17 재귀 없음(옛 정의 그대로이므로 예전과 같음).
* 로컬 Postgres가 없으니 읽어서 검토한다. 실 DB 접속·SQL 실행·설치·내려받기·git commit/push 금지. 수정 범위는 이 SQL 파일과 보고서뿐.

## 보고서 `docs/classes/build-rollback-report.md`
만든 것, 대조 표, 빠진 것 없음 확인, 실행 방법 요약, 한계 — 한국어로 간결하게.
