# 묶음 1 지침 — SQL (구현 담당 A)

먼저 `docs/privacy/build-common.md`를 읽는다.

## 만들 파일(이것만)
- `supabase/migrations/20261020000000_privacy_a_schema.sql` — ① 추가만(spec 4.0~4.2·4.7·4.8: 새 표 4개·새 열·판별 함수·화면용 RPC·서비스 롤 전용 함수). **기존 정책·함수·트리거를 바꾸지 않는다** — 실행해도 사이트 동작이 그대로여야 한다.
- `supabase/migrations/20261020010000_privacy_b_enforce.sql` — ② 켜기(spec 4.3~4.6: `handle_new_user`·`sync_member_directory`·`can_browse`·`admin_set_role`·게임 관리 RPC·`record_post_read`·`get_or_create_feedback_thread` 다시 정의, RESTRICTIVE 정책, 학급 밖 정책 24곳 좁히기, 기존 구글 회원 백필·이메일 가리기·인증 전 이름·사진 가리기). 맨 앞 점검(코드·문의 이메일·① 실행·총괄 존재)과 맨 끝 점검(학급 밖 표에 `is_admin()`만 쓰는 허용 정책이 남으면 전부 되돌림).
- `supabase/migrations/20261020020000_privacy_c_profiles_members_only.sql` — ③ spec 4.10(`profiles` SELECT 정책 하나 — 로그인한 회원은 전체, 인증 전 구글 계정은 본인 행만, anon 열 권한은 그대로 둠). ③ 실행 때 `site_settings.policy_effective_at` 기록(spec 개정 1).
- `docs/privacy/rollback-privacy-enforce.sql`(② 되돌리기), `docs/privacy/rollback-profiles-members-only.sql`(③ 되돌리기).
- `docs/privacy/test-queries.sql` — 사용자가 SQL Editor에서 돌릴 **읽기 전용** 확인·흉내 시험(spec 4.9·8절 DB 항목: `set local role authenticated` + `request.jwt.claims` 흉내, 결과는 개수·참거짓만, 끝은 `rollback`).
- 보고서 `docs/privacy/build-1-report.md`.

## 반드시
- CLAUDE.md "SQL 적용 절차": 재실행 안전(`if not exists`/`create or replace`/`drop … if exists`), 파일 위에 실행 방법·확인 쿼리, 배열 함수는 `x = any (public.f())`(괄호 겹치기 금지 — 42883), 정책 안에서 같은 표 재조회 금지(42P17 — `security definer` 함수로), 정책 이름 63바이트 이내.
- 모든 `security definer` 함수에 `set search_path = ''` + 스키마 붙인 이름(`public.`·`extensions.crypt`·`extensions.gen_salt('bf')`·`auth.uid()`). 실행 권한은 spec 4.2 표대로(`revoke all … from public, anon, authenticated` 뒤 필요한 역할만 `grant`). 서비스 롤 전용 함수는 `service_role`만.
- 코드 검증 RPC는 **예외를 던지지 않고 결과(jsonb)를 돌려준다**(틀린 횟수 기록이 롤백되지 않게 — spec 4.3). 계정당·전체 한도 수치는 spec 4.3.
- **4.6 표를 최신 마이그레이션에서 다시 전수 조사**한다(`grep`으로 `is_admin()`이 들어 있는 살아 있는 정책·함수 정의를 모두 찾고, spec 표와 맞춘다 — 표에 없는 곳을 찾으면 보고서에 적고, "학급 안 일"인지 "학급 밖 일"인지 판단 근거를 적는다).
- `purge_member_records`의 삭제 목록을 기존 `admin_purge_oauth_member`(`20260928000000_oauth_purge.sql`)와 대조해 빠짐이 없게(외래키 cascade·set null 표 — `docs/admin/oauth-delete/spec.md` §3.1).
- 실 DB가 없으므로 **문법·이름·권한을 눈으로 끝까지 대조**한다(같은 이름의 정책이 이미 있으면 drop 후 create, 함수 인자 형식이 바뀌면 옛 함수 drop). 확인 쿼리로 사용자가 결과를 알 수 있게.
- 교사 인증 코드 처음 값은 SQL에 없다(총괄이 관리자 화면에서 `admin_set_teacher_code`로 넣는다).
