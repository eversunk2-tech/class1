-- 개인정보 처리방침 · 구글 가입 교사 인증 · 보호자 동의 ① — 표·열·함수·RPC만 더한다(지금 사이트 동작은 그대로)
-- 설계: docs/privacy/spec.md(머리말 개정 1~4와 1.1 결정표가 본문보다 우선) — 4.0~4.2·4.3·4.7·4.8 · 4.7-3(개정 3 — 보유 기한
--       "종업식 뒤 그 학년도의 2월 28일까지") · 4.11(개정 4 — 학생 아이디·이름 가리기)
-- 지침: docs/privacy/build-1-sql-instructions.md · build-5-sql-instructions.md(개정 3·4)
-- 보고: docs/privacy/build-1-report.md · build-5-report.md(개정 3·4 — 날짜 계산 표 · 가리기 규칙 · 전수 조사)
--
-- ▶ 실행 순서(spec 7절 — 반드시 이 순서)
--   ① 이 파일(20261020000000_privacy_a_schema.sql)                                      ← 지금
--   ② Edge Function 3개 배포: npx supabase functions deploy member-self-delete
--                             npx supabase functions deploy admin-clear-students
--                             npx supabase functions deploy admin-create-member      (--no-verify-jwt 금지)
--   ③ 사이트(화면) push — 사이트 동작은 그대로이고 '개인정보 설정' 화면만 생긴다(처리방침은 "준비 중").
--   ④ 총괄이 관리자 화면 '개인정보 설정'에서 교사 인증 코드(숫자 6자리)와 문의 이메일을 넣는다
--      (값은 채팅·저장소에 적지 않는다 — 이 파일에도 코드 값이 없다).
--   ⑤ 20261020010000_privacy_b_enforce.sql(켜기) → 확인 → 곧바로 같은 자리에서
--      20261020020000_privacy_c_profiles_members_only.sql(프로필 읽기 좁히기 + 처리방침 시행) → 확인.
--
-- ▶ 실행 방법
--   Supabase 대시보드 > SQL Editor > New query 에 이 파일 전체를 붙여넣고 Run.
--   SQL Editor 는 붙여 넣은 전체를 한 트랜잭션으로 실행하므로 중간에 오류가 나면 아무것도 바뀌지 않는다.
--   (psql 등 다른 도구로 실행할 때는 psql -1 -v ON_ERROR_STOP=1 -f <파일> 처럼 "한 트랜잭션 + 오류 시 멈춤"으로.)
--   · 여러 번 실행해도 안전하다(if not exists / create or replace / drop … if exists / 제약은 이름으로 지우고 다시 추가).
--   · 맨 앞 점검: 앞선 마이그레이션(특히 ⑧ 20260928010000_teacher_boards.sql · ⑦ 20260928000000_oauth_purge.sql)이 없으면
--     오류를 내고 아무것도 바꾸지 않는다.
--   · 맨 끝 점검: 새 표 RLS · 표 권한 · profiles 공개 열 · 함수 실행 권한 · pgcrypto 위치 · 정책 수(이 파일은 정책을 하나도
--     만들거나 바꾸지 않는다) · 가린 글자 규칙 자체 시험(개정 4) · 학급 정리 기한 날짜 계산 자체 시험(개정 3 — 날짜 11개)이
--     설계와 다르면 오류를 내고 전부 되돌린다. 성공하면 "✔ ① …" 알림이 나온다.
--   ⚠ 이 파일의 RPC 를 SQL Editor 에서 직접 부르지 않는다(SQL Editor 에는 auth.uid()가 없다). 코드·이메일은 화면에서 넣는다.
--
-- ▶ 이 파일이 하는 일 — 기존 정책·트리거는 하나도 고치지 않는다. 기존 함수는 2개만 "같은 동작 + 추가"로 다시 정의한다.
--   · 확장: pgcrypto(extensions 스키마 — 함수 안에서는 extensions.crypt · extensions.gen_salt 처럼 스키마를 붙인다).
--   · 새 표 4개(모두 RLS 켬, 정책 없음, anon·authenticated 권한 없음 → security definer 함수·서비스 롤로만 읽고 쓴다):
--       member_verification(구글 계정만 한 줄) · member_verification_attempts(틀린/맞은 시도 — 계정 번호·성공 여부·시각만)
--       verification_settings(교사 인증 코드의 bcrypt 해시 한 줄) · class_cleanup_log(학급 정리 — 지운 인원수만)
--   · 새 열 7개: profiles.teacher_scope('full'|'class', 기본 'full' — 공개 열이 아님) · site_settings.contact_email ·
--       site_settings.privacy_version · site_settings.policy_effective_at(③을 실행할 때 기록) ·
--       member_directory.guardian_consent_at · member_directory.guardian_consent_by · member_create_log.guardian_consent
--   · 판별 함수 2개(PUBLIC 실행 — is_admin()과 같음): is_full_admin() · is_pending_google()
--     → ①에서는 어떤 정책도 부르지 않는다(②가 쓴다). ① 직후에는 member_verification 이 비어 있어 is_pending_google() 은 모두 false.
--   · 화면용 RPC(로그인한 사용자만): my_member_gate · verify_google_teacher · acknowledge_privacy · admin_set_teacher_code ·
--       admin_set_contact_email · admin_privacy_overview · admin_member_privacy_flags · admin_set_teacher_scope ·
--       admin_class_cleanup_preview · admin_class_retention_status · admin_set_guardian_consent · admin_set_guardian_consent_class
--   · 서비스 롤 전용 함수: purge_member_records · admin_purge_class_member · self_purge_member · admin_finish_class_cleanup ·
--       admin_log_member_create(옛 4-인자 함수를 지우고 5-인자로 — p_guardian 기본값 null 이라 지금 배포된 Edge Function 의
--       4-인자 호출도 그대로 된다)
--   · 다시 정의하는 기존 함수(같은 동작 + 추가): my_admin_context()(반환에 teacher_scope — ② 전에는 모두 'full'),
--       admin_log_member_create(위). 사이트 동작은 그대로다.
--   · 학생 아이디·이름 가리기(개정 4 — spec 4.11, 11절): 함수만 더한다 — ② · ③의 정책이 부르기 전에는 아무 동작도 바꾸지 않는다.
--       판별(PUBLIC 실행 — 정책 안에서 불림): can_see_member_name(uuid) · can_see_member_identity(uuid)
--       화면 RPC(로그인한 사용자만): member_name_labels(uuid[]) · admin_masked_member_rows(uuid default null)
--       가린 글자: mask_label(text)(immutable — 앞뒤 공백을 뺀 첫 글자 + '***', 비었으면 '***')
--   · 내부 도우미(누구도 직접 부를 수 없음 — 함수 안과 SQL Editor(postgres)에서만):
--       privacy_nickname_error(text) — 별명 검사(spec 4.3-6)
--       privacy_retention_window(date) — 학급 정리 기한 날짜 계산(개정 3 — 8-2a, 맨 끝 점검이 날짜 11개로 스스로 시험한다)
--       privacy_btrim(text) — JS String.prototype.trim() 과 같은 글자(공백·탭·줄바꿈·NBSP·전각 공백 등 25자)를 앞뒤에서 뺀다(개정 4)
--       privacy_name_source(text, text) — 가린 이름의 원래 값 = 표시 이름(앞뒤 공백 뺌), 비었으면 로그인 아이디(이메일의 @ 앞)(개정 4)
--   · 고침 1(검토 R1 · 2026-10-20): admin_set_contact_email 은 처리방침 시행 뒤 빈 값을 거부한다(L3). profiles 수정 권한은 처음 실행 때
--     지금 목록 (display_name, avatar_url) 그대로 — 사진 주소를 막는 것은 ②(1-0), ② 뒤 다시 실행하면 display_name 만 다시 준다(3-1).
--   · 재귀(42P17) 없음: 정책을 만들지 않는다. 새 함수는 모두 security definer(소유자 postgres)라 표의 RLS 를 거치지 않는다.
--
-- ▶ 결과 모양(화면·Edge Function 이 쓰는 계약 — spec 4.2 이름표)
--   my_member_gate() → {"state": "ok"|"need_code"|"need_ack", "origin": "new"|"existing"|null, "first_time": bool,
--                       "locked_seconds": int|null, "policy_version": int}
--       · 행이 없으면(아이디 계정 · ② 전) "ok". need_code = 인증 전 구글(role user). need_ack = 구글 관리자 · 인증 마친 계정이
--         아직 확인하지 않았거나(ack 없음) 처리방침 판 번호가 올랐을 때.
--       · first_time = 처리방침 확인을 한 번도 하지 않음(ack_at 없음) → 화면은 별명 칸을 보인다(need_ack 이면 3-1 창, 아니면 3-2 창).
--   verify_google_teacher(p_nickname, p_code, p_policy_version) → 예외를 던지지 않고(틀린 횟수 기록이 되돌려지지 않게) 결과를 돌려준다:
--       {"ok": true}
--       {"ok": false, "reason": "not_applicable"}           행 없음 · 이미 role admin(→ 화면은 acknowledge_privacy)
--       {"ok": false, "reason": "already"}                  이미 인증함(다른 탭에서 마침)
--       {"ok": false, "reason": "policy_changed", "policy_version": n}
--       {"ok": false, "reason": "not_configured"}           코드를 아직 정하지 않음
--       {"ok": false, "reason": "locked", "locked_seconds": n}
--       {"ok": false, "reason": "busy"}                     최근 10분 모든 계정의 틀린 시도 30번 이상(맞는 코드도 10분 거부)
--       {"ok": false, "reason": "bad_nickname", "nickname_error": "empty"|"length"|"chars"|"reserved", "message": "…"}
--       {"ok": false, "reason": "wrong_code", "attempts_left": n, "locked_seconds": n|null}  ← 이번에 잠기면 attempts_left 0 + locked_seconds
--       {"ok": false, "reason": "not_signed_in"}
--   acknowledge_privacy(p_nickname default null, p_policy_version default null) →
--       {"ok": true} | {"ok": false, "reason": "not_applicable"|"need_code"|"policy_changed"|"bad_nickname"|"not_signed_in", …}
--       (p_policy_version 에도 기본값을 둔 까닭: Postgres 는 기본값이 있는 인자 뒤의 인자에도 기본값을 요구한다. 빈 값이면 policy_changed.)
--   admin_privacy_overview() → {"code_set", "code_set_at", "contact_email", "privacy_version", "pending_count",
--                               "pending_over_30d", "wrong_last_hour", "locked_accounts"}
--   admin_member_privacy_flags() → [{"id", "pending", "origin", "teacher_scope", "verified_at", "signed_up_days"}]
--       (구글 계정(member_verification 행이 있는 회원)과 모든 교사(role admin) — 그 밖의 회원은 줄이 없다)
--   admin_class_cleanup_preview(p_class_id) → {"class_name", "students", "withdrawn", "oauth_only"}
--       students = 그 학급 학생 계정 전부(탈퇴 처리된 학생 포함), withdrawn = 그중 탈퇴 처리된 학생,
--       oauth_only = 그중 아이디 로그인이 없는 계정(학급 정리로 지울 수 없음 — 보통 0)
--   admin_class_retention_status() → (개정 3 — 보유 기한 "종업식 뒤 그 학년도의 2월 28일까지", 한국 시간 날짜 기준)
--       {"today", "school_year_start", "cutoff", "deadline", "past_deadline", "in_february", "due_total", "overdue_total",
--        "february_total", "scope": "all"|"mine",
--        "classes": [{"class_id", "class_name", "old_students", "overdue_students", "february_students", "students"}]}
--       학생 계정 = 그 학급의 role 'user'(탈퇴 처리된 학생 포함). 학년도 시작 S = 오늘이 지난 가장 최근 3월 1일.
--       overdue_students(기한 지남) = cutoff 전에 만든 학생. cutoff = S 해의 2월 1일(그 전 학년도는 끝났고 2월 28일이 지났다).
--                                     오늘이 윤년 2월 29일이면 cutoff = 올해 2월 1일(이번 학년도 학생도 2월 28일이 지났다).
--       february_students(2월 알림) = 오늘이 2월 1~28일일 때만 — S 해의 2월 1일 ~ 올해 2월 1일 전에 만든 학생(이번 학년도 학생,
--                                     2월 28일까지 정리). 올해 2월에 만든 계정(겨울방학에 미리 등록)은 새 학년도라 세지 않는다. 그 밖의 날은 0.
--       old_students = overdue_students + february_students(옛 화면 호환). students = 그 학급 학생 계정 전체.
--       deadline = 기한 지남·2월 알림이 가리키는 학년도의 2월 28일(3월~1월: S 해의 2월 28일 — 이미 지남 / 2월: 올해 2월 28일).
--       past_deadline = today > deadline(3월 1일 ~ 다음 해 1월 31일, 그리고 2월 29일에 true). in_february = 오늘이 2월 1~28일.
--       due_total = overdue_total + february_total. classes 에는 둘 중 하나라도 1 이상인 학급만. 총괄 = 모든 학급, 담임 = 자기 학급.
--   member_name_labels(p_ids uuid[]) → (개정 4) [{"id", "display_name", "avatar_url", "withdrawn_at", "masked"}] — 앞 1000개만.
--       로그인하지 않았거나 인증 전 구글이면 []. can_see_member_name 이 참이면 원래 값(masked false),
--       거짓이면 display_name = mask_label(privacy_name_source(이름, 아이디)) · avatar_url = null · masked true. 없는 id 는 빠진다.
--   admin_masked_member_rows(p_id uuid default null) → (개정 4) 총괄이 아니면 []. 다른 학급 학생(role 'user' · 학급 있음 ·
--       내가 담임이 아님)의 회원 명단 줄을 가린 값으로: [{"id", "email": "2***", "provider", "providers", "signed_up_at",
--       "last_sign_in_at", "updated_at", "class_id", "guardian_consent_at", "guardian_consent_by", "masked": true,
--       "profiles": {"display_name": "2***", "avatar_url": null, "role", "withdrawn_at", "must_change_password"}}] — signed_up_at 최신순, id 순.
--   admin_set_guardian_consent_class(p_class_id) → 새로 표시한 학생 수(int)
--   self_purge_member(p_target, p_mode) → {"ok": true, "mode", "deleted_classes", "archived_classes"} | {"ok": true, "already": true}
--       ⚠ 조건이 맞지 않으면 예외. 회원 탈퇴가 막힌 경우(그 교사가 담임인 학급에 학생 — 탈퇴 처리된 학생 포함 — 이 남음)는
--         message = 'blocked', detail = 학급 이름들(", "로 이음)인 예외다. Edge Function 은 로그인 계정을 지우기 **전에** 같은 조건을
--         먼저 확인해야 한다(이 함수는 로그인 계정이 이미 지워진 뒤에 부르는 마지막 단계다).
--   admin_purge_class_member(p_target, p_actor) → void(이미 지워졌으면 조용히 끝 — 재시도 멱등)
--   admin_finish_class_cleanup(p_class_id, p_actor, p_count) → 기록 줄 id(bigint) | null(p_count 가 0 이하라 기록하지 않음)
--       같은 학급 · 같은 선생님의 1시간 안 기록은 한 줄로 합친다(20명씩 여러 번 불러도 "한 번의 정리 = 한 줄").
--   서비스 롤 전용 함수는 모두 인자가 비면(null) 'missing arguments' 로 곧바로 끝난다(Edge Function 의 "함수 있음" 확인용 — ⑦과 같은 방식).
--
-- ▶ 실행 후 확인 쿼리(앞의 "-- "를 지우고 한 덩어리씩 Run — 모두 읽기만 한다)
--   -- 1) 새 표 4개: RLS 켜짐(true) · 정책 0
--   select c.relname as 표, c.relrowsecurity as rls,
--          (select count(*) from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname) as 정책
--   from pg_class c join pg_namespace n on n.oid = c.relnamespace
--   where n.nspname = 'public'
--     and c.relname in ('member_verification', 'member_verification_attempts', 'verification_settings', 'class_cleanup_log')
--   order by 1;
--   -- 2) 새 열 7개(7행)
--   select table_name, column_name, data_type from information_schema.columns
--   where table_schema = 'public'
--     and ((table_name = 'profiles' and column_name = 'teacher_scope')
--       or (table_name = 'site_settings' and column_name in ('contact_email', 'privacy_version', 'policy_effective_at'))
--       or (table_name = 'member_directory' and column_name in ('guardian_consent_at', 'guardian_consent_by'))
--       or (table_name = 'member_create_log' and column_name = 'guardian_consent'))
--   order by 1, 2;
--   -- 3) profiles 공개 열이 그대로 7개씩(id, display_name, avatar_url, role, created_at, updated_at, withdrawn_at — teacher_scope 없음)
--   select grantee, count(*) as 열, bool_or(column_name = 'teacher_scope') as teacher_scope_보임
--   from information_schema.column_privileges
--   where table_schema = 'public' and table_name = 'profiles' and privilege_type = 'SELECT'
--     and grantee in ('anon', 'authenticated')
--   group by grantee order by 1;
--   -- 4) pgcrypto 가 extensions 스키마에 있는지(extensions 1행)
--   select extname, extnamespace::regnamespace as 스키마 from pg_extension where extname = 'pgcrypto';
--   -- 5) 함수 권한 — 앞 2개 true(정책 평가용 PUBLIC), 가운데 3개 false(비로그인은 화면 RPC 못 부름), 뒤 3개 false(서비스 롤 전용)
--   select has_function_privilege('anon', 'public.is_full_admin()', 'execute')                                  as 판별1_anon,
--          has_function_privilege('anon', 'public.is_pending_google()', 'execute')                              as 판별2_anon,
--          has_function_privilege('anon', 'public.verify_google_teacher(text, text, integer)', 'execute')        as 인증_anon,
--          has_function_privilege('anon', 'public.my_member_gate()', 'execute')                                 as 창상태_anon,
--          has_function_privilege('anon', 'public.admin_set_teacher_code(text)', 'execute')                     as 코드정하기_anon,
--          has_function_privilege('authenticated', 'public.purge_member_records(uuid)', 'execute')              as 삭제_로그인,
--          has_function_privilege('authenticated', 'public.self_purge_member(uuid, text)', 'execute')           as 자기삭제_로그인,
--          has_function_privilege('authenticated', 'public.admin_log_member_create(uuid, uuid, text, text, boolean)', 'execute') as 생성기록_로그인;
--   -- 5-2) (개정 4) 가리기 함수 권한 — 앞 2개 true(정책 평가용 PUBLIC), 가운데 2개 false · 2개 true(화면 RPC 는 로그인만), 뒤 2개 false(내부)
--   select has_function_privilege('anon', 'public.can_see_member_name(uuid)', 'execute')                         as 이름판별_anon,
--          has_function_privilege('anon', 'public.can_see_member_identity(uuid)', 'execute')                     as 아이디판별_anon,
--          has_function_privilege('anon', 'public.member_name_labels(uuid[])', 'execute')                        as 이름라벨_anon,
--          has_function_privilege('anon', 'public.admin_masked_member_rows(uuid)', 'execute')                    as 가린줄_anon,
--          has_function_privilege('authenticated', 'public.member_name_labels(uuid[])', 'execute')               as 이름라벨_로그인,
--          has_function_privilege('authenticated', 'public.admin_masked_member_rows(uuid)', 'execute')           as 가린줄_로그인,
--          has_function_privilege('authenticated', 'public.mask_label(text)', 'execute')                         as 가린글자_로그인,
--          has_function_privilege('authenticated', 'public.privacy_retention_window(date)', 'execute')           as 기한계산_로그인;
--   -- 5-3) (개정 3) 기한 날짜 계산 — 맨 끝 점검이 이미 날짜 11개로 시험했다. 오늘 기준 값만 본다(학생 수·이름 없음).
--   select public.privacy_retention_window((now() at time zone 'Asia/Seoul')::date);
--   -- 6) 탈퇴 안전장치 그대로(빈 배열 {})
--   select public.withdrawal_blocking_fks();
--   -- 7) 동작 변화 없음: 아직 아무 행도 없다(구글 계정 0 · 코드 없음 · 문의 이메일 없음 · 판 번호 1 · 시행 전) — ④ 화면 입력 전
--   select (select count(*) from public.member_verification) as 구글_행,
--          (select code_hash is not null from public.verification_settings) as 코드_있음,
--          (select contact_email is not null from public.site_settings) as 이메일_있음,
--          (select privacy_version from public.site_settings) as 판_번호,
--          (select policy_effective_at from public.site_settings) as 시행;
--   -- 8) 옛 4-인자 계정 생성 기록 함수가 없어졌는지(0) · 새 5-인자가 있는지(1)
--   select count(*) filter (where pg_get_function_identity_arguments(p.oid) = 'p_target uuid, p_actor uuid, p_role text, p_source text') as 옛것,
--          count(*) filter (where pg_get_function_identity_arguments(p.oid) like '%p_guardian boolean') as 새것
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public' and p.proname = 'admin_log_member_create';

-- ═════════════════════════════════════════════
-- 0. 맨 앞 점검 — 앞 단계가 안 됐으면 아무것도 바꾸지 않는다. 정책 수를 적어 두고 맨 끝에서 그대로인지 본다.
-- ═════════════════════════════════════════════
do $$
begin
  if to_regclass('public.profiles') is null
     or to_regclass('public.site_settings') is null
     or to_regclass('public.member_directory') is null
     or to_regclass('public.member_create_log') is null
     or to_regclass('public.classes') is null
     or to_regclass('public.class_teachers') is null
     or to_regprocedure('public.is_super_admin()') is null
     or to_regprocedure('public.my_class_ids()') is null
     or to_regprocedure('public.teaches_student(uuid)') is null
     or to_regprocedure('public.can_browse()') is null
     or to_regprocedure('public.admin_purge_oauth_member(uuid, uuid)') is null
     or to_regprocedure('public.can_manage_board(uuid)') is null
     or not exists (
       select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'community_posts' and column_name = 'board_owner'
     )
     or not exists (
       select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'profiles' and column_name = 'withdrawn_at'
     ) then
    raise exception '앞선 마이그레이션(20260921000000 ~ 20260928010000 — 특히 ⑦ oauth_purge · ⑧ teacher_boards)이 먼저 실행돼 있어야 합니다. 이 파일은 아무것도 바꾸지 않았습니다.';
  end if;

  -- 이 파일은 정책을 하나도 만들거나 지우지 않는다 → 지금 정책 수를 적어 두고 맨 끝 점검에서 같은지 본다(이 Run 안에서만 유효).
  perform set_config('privacy_a.policy_count', (select count(*)::text from pg_policies), true);

  if not exists (select 1 from public.profiles where is_super_admin and role = 'admin') then
    raise notice '⚠ 총괄 관리자가 없습니다(docs/classes/setup-owl-class.sql). ①은 그대로 적용되지만, 코드·문의 이메일은 총괄만 넣을 수 있어 ②를 실행할 수 없습니다.';
  end if;
end $$;

-- ═════════════════════════════════════════════
-- 1. pgcrypto — 교사 인증 코드를 bcrypt 해시로만 저장·비교한다(extensions 스키마, spec 4.0)
--    이미 다른 스키마에 깔려 있으면 with schema 가 무시되므로 맨 끝 점검이 위치를 확인한다(함수는 extensions.crypt 를 부른다).
-- ═════════════════════════════════════════════
create extension if not exists pgcrypto with schema extensions;

-- ═════════════════════════════════════════════
-- 2. 새 표 4개 (spec 4.1) — RLS 켬 · 정책 없음 · anon/authenticated 권한 없음
-- ═════════════════════════════════════════════

-- 2-1. member_verification — 구글(아이디 로그인이 없는) 계정만 한 줄. verified_at 이 비어 있으면 "인증 전".
--      origin: 'existing' = ②에서 백필한 기존 구글 회원, 'new' = ② 뒤 새로 가입한 구글 계정(handle_new_user 가 만든다).
--      wrong_count = 지금 이어서 센 틀린 횟수(맞으면 0), total_wrong = 지금까지 틀린 횟수 전체, locked_until = 잠금이 풀리는 때.
--      프로필이 지워지면 함께 사라진다(cascade).
create table if not exists public.member_verification (
  user_id        uuid primary key references public.profiles (id) on delete cascade,
  origin         text not null,
  verified_at    timestamptz,
  ack_at         timestamptz,
  policy_version int,
  wrong_count    int not null default 0,
  total_wrong    int not null default 0,
  locked_until   timestamptz,
  created_at     timestamptz not null default now()
);

alter table public.member_verification drop constraint if exists member_verification_origin_check;
alter table public.member_verification
  add constraint member_verification_origin_check check (origin in ('existing', 'new'));
alter table public.member_verification drop constraint if exists member_verification_counts_check;
alter table public.member_verification
  add constraint member_verification_counts_check check (wrong_count >= 0 and total_wrong >= 0);

-- 2-2. member_verification_attempts — 교사 인증 시도 기록(전체 한도 계산용). 계정 번호 · 맞았는지 · 시각만(이메일·코드 없음).
--      ⚠ user_id 는 on delete **set null**(spec 4.1 표의 cascade 와 다름 — 보고서 참고): 계정을 지워도(가입하지 않기 · 완전 삭제)
--        시도 줄은 계정 번호만 비운 채 남아 "최근 10분 틀린 시도 30번" 전체 한도에 계속 들어간다. cascade 면 "가입 → 틀림 → 가입하지 않기"
--        반복으로 전체 한도까지 초기화된다(spec 3.4가 막으려던 구멍). 30일 지난 줄은 verify_google_teacher · admin_privacy_overview 가 지운다.
create table if not exists public.member_verification_attempts (
  id         bigint generated always as identity primary key,
  user_id    uuid references public.profiles (id) on delete set null,
  ok         boolean not null,
  created_at timestamptz not null default now()
);

create index if not exists member_verification_attempts_created_idx
  on public.member_verification_attempts (created_at);
create index if not exists member_verification_attempts_user_idx
  on public.member_verification_attempts (user_id);

-- 2-3. verification_settings — 교사 인증 코드 한 줄(bcrypt 해시). site_settings(누구나 읽음)에 두지 않는다.
--      처음 값은 비어 있다 — 총괄이 관리자 화면에서 admin_set_teacher_code 로 넣는다(이 파일·저장소에 코드 값 없음).
create table if not exists public.verification_settings (
  id          boolean primary key default true,
  code_hash   text,
  code_set_at timestamptz,
  code_set_by uuid references public.profiles (id) on delete set null
);

alter table public.verification_settings drop constraint if exists verification_settings_singleton;
alter table public.verification_settings add constraint verification_settings_singleton check (id);

insert into public.verification_settings (id) values (true) on conflict (id) do nothing;

-- 2-4. class_cleanup_log — '학급 정리'를 했다는 기록. 지운 인원수만(학생 이름·아이디 없음 — 사용자 확정, 질문 11).
--      class_id 는 외래키 없음(학급을 나중에 지워도 기록은 남는다). actor_id 는 처리한 선생님(계정이 지워지면 빈 값).
create table if not exists public.class_cleanup_log (
  id            bigint generated always as identity primary key,
  class_id      uuid,
  class_name    text,
  actor_id      uuid references public.profiles (id) on delete set null,
  student_count int not null default 0,
  created_at    timestamptz not null default now()
);

alter table public.class_cleanup_log drop constraint if exists class_cleanup_log_count_check;
alter table public.class_cleanup_log add constraint class_cleanup_log_count_check check (student_count >= 0);

create index if not exists class_cleanup_log_class_idx on public.class_cleanup_log (class_id, created_at desc);
create index if not exists class_cleanup_log_actor_idx on public.class_cleanup_log (actor_id);

-- 2-5. RLS 켬 + 권한: 정책은 하나도 두지 않는다 → anon·authenticated 는 표를 직접 읽지도 쓰지도 못한다.
--      Supabase 는 새 표에 anon·authenticated 전체 권한을 기본으로 주므로 먼저 모두 거둔다.
--      서비스 롤(Edge Function): member_verification 만 읽는다(spec 5절 — 본인 조건 재확인). 쓰기는 함수가 한다.
--      verification_settings(코드 해시)는 서비스 롤에서도 거둔다 — 해시는 security definer 함수(소유자)만 읽는다.
alter table public.member_verification enable row level security;
alter table public.member_verification_attempts enable row level security;
alter table public.verification_settings enable row level security;
alter table public.class_cleanup_log enable row level security;

revoke all on public.member_verification from public, anon, authenticated;
revoke all on public.member_verification_attempts from public, anon, authenticated;
revoke all on public.verification_settings from public, anon, authenticated, service_role;
revoke all on public.class_cleanup_log from public, anon, authenticated;
grant select on public.member_verification to service_role;

-- ═════════════════════════════════════════════
-- 3. 새 열 7개 (spec 4.1)
-- ═════════════════════════════════════════════

-- 3-1. profiles.teacher_scope — 'full' = 모든 교사 권한(지금 교사 모두), 'class' = 자기 학급 일만(②의 인증한 구글 선생님).
--      공개 열 목록(grant select (…) on profiles)에 넣지 않는다(class_id · is_super_admin 과 같은 방식) → 학생·비로그인은
--      읽지도 고치지도 못한다. 화면은 my_admin_context().teacher_scope 로 본다.
alter table public.profiles
  add column if not exists teacher_scope text not null default 'full';
alter table public.profiles drop constraint if exists profiles_teacher_scope_check;
alter table public.profiles
  add constraint profiles_teacher_scope_check check (teacher_scope in ('full', 'class'));

-- profiles 열 권한을 지금 상태 그대로 다시 적는다(20260927000000 §3-1 과 글자 그대로 같은 목록 — teacher_scope 는 넣지 않는다).
-- 표 단위 revoke 는 열 단위 권한도 함께 거둔다 → 아래 grant 목록이 정확히 남는다(재실행해도 같은 결과).
revoke select on public.profiles from anon, authenticated;
grant select (id, display_name, avatar_url, role, created_at, updated_at, withdrawn_at)
  on public.profiles to anon, authenticated;
-- 수정 권한(고침 1 — 사용자 결정 "프로필 사진 주소를 받지 않음"): ①에서는 지금 목록 (display_name, avatar_url)을 그대로 둔다.
--   ① 뒤 · 새 화면 배포 전에는 예전 '프로필 수정' 창이 사진 주소까지 함께 보내므로, 여기서 avatar_url 을 빼면 그 창의 저장이
--   통째로 42501 로 깨진다. 사진 주소를 막는 것(display_name 만)은 ②가 한다(② 1-0).
--   단, ②를 이미 실행한 뒤 ①을 다시 Run 하면 사진 주소 권한이 되살아나지 않게 ② 상태면 display_name 만 다시 준다.
revoke update on public.profiles from anon, authenticated;
do $$
begin
  if exists (select 1 from pg_policies
              where schemaname = 'public' and tablename = 'profiles'
                and policyname = 'profiles: 인증 전 쓰기 제한(수정)') then
    grant update (display_name) on public.profiles to authenticated;          -- ② 뒤 다시 실행
  else
    grant update (display_name, avatar_url) on public.profiles to authenticated;  -- 처음 실행(지금 목록 그대로)
  end if;
end $$;

-- 3-2. site_settings — 문의 이메일(공개 읽기 — 결정 8), 처리방침 판 번호(처음 1), 처리방침 시행 시각(③이 기록).
--      site_settings 는 표 단위로 누구나 읽는다(20260923010000) → 새 열도 그대로 공개. 쓰기는 RPC 로만(표 쓰기 권한 없음).
--      keep-supabase-awake 예약 작업은 login_required 열만 읽으므로 영향이 없다.
alter table public.site_settings add column if not exists contact_email text;
alter table public.site_settings add column if not exists privacy_version int not null default 1;
alter table public.site_settings add column if not exists policy_effective_at timestamptz;

alter table public.site_settings drop constraint if exists site_settings_contact_email_length;
alter table public.site_settings
  add constraint site_settings_contact_email_length check (contact_email is null or char_length(contact_email) <= 254);
alter table public.site_settings drop constraint if exists site_settings_privacy_version_check;
alter table public.site_settings
  add constraint site_settings_privacy_version_check check (privacy_version >= 1);

-- 3-3. member_directory — 보호자 동의서를 받았다고 표시한 때·선생님(관리자 표 — 지금은 담임(자기 반)·총괄만 읽음, can_manage_member.
--      ② 뒤(개정 4): 학생 줄은 그 학생의 담임만 · 총괄은 선생님·학급 없는 계정 줄만 — can_see_member_identity, 11절).
alter table public.member_directory add column if not exists guardian_consent_at timestamptz;
alter table public.member_directory
  add column if not exists guardian_consent_by uuid references public.profiles (id) on delete set null;
create index if not exists member_directory_guardian_consent_by_idx on public.member_directory (guardian_consent_by);

-- 3-4. member_create_log — 계정을 만들 때 보호자 동의 표시(true) · null = 해당 없음(교사 계정)/기록 이전.
alter table public.member_create_log add column if not exists guardian_consent boolean;

-- ═════════════════════════════════════════════
-- 4. 판별 함수 2개 (spec 4.2) — is_admin() 과 같은 모양: sql · stable · security definer · search_path '' · PUBLIC 실행
--    (②의 정책이 부른다 — 정책은 "요청한 역할"로 평가되므로 실행 권한이 없으면 permission denied 가 난다. review S1)
--    돌려주는 값은 "지금 로그인한 나"에 대한 참/거짓뿐이라 새는 정보가 없다.
-- ═════════════════════════════════════════════

-- 모든 교사 권한 = role 'admin' 이고 teacher_scope 'full'(지금 교사 모두 · 총괄 · 총괄이 지정한 교사). 'class' = 자기 학급 일만.
create or replace function public.is_full_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.role = 'admin' and p.teacher_scope = 'full' from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

-- 인증 전 구글 계정 = member_verification 행이 있고, role 'user' 이고, verified_at 이 비어 있음(spec 3.1).
create or replace function public.is_pending_google()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select v.verified_at is null and p.role = 'user'
       from public.member_verification v
       join public.profiles p on p.id = v.user_id
      where v.user_id = auth.uid()),
    false
  );
$$;

grant execute on function public.is_full_admin() to public;
grant execute on function public.is_pending_google() to public;

-- ═════════════════════════════════════════════
-- 5. 내부 도우미 — 별명 검사(spec 4.3-6). 화면(src/lib/privacy.ts)도 같은 규칙으로 먼저 거른다.
--    앞뒤 공백을 뺀 2~20자 · 제어 문자(줄바꿈·탭) · '@' · 'http' · 'www.' 불가 · 예약어(정확히 같은 말, 대소문자 무시) 불가.
--    돌려주는 값: null = 통과, 'empty' | 'length' | 'chars' | 'reserved'. 누구도 직접 부를 수 없다(함수 안에서만).
-- ═════════════════════════════════════════════
create or replace function public.privacy_nickname_error(p_nickname text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v text := btrim(coalesce(p_nickname, ''));
begin
  if v = '' then
    return 'empty';
  end if;
  if v ~ '[[:cntrl:]]' or position('@' in v) > 0 or position('http' in lower(v)) > 0 or position('www.' in lower(v)) > 0 then
    return 'chars';
  end if;
  if char_length(v) < 2 or char_length(v) > 20 then
    return 'length';
  end if;
  -- 고침 2(검토 R1 N3): '선생님' = 별명을 정하기 전 구글 관리자의 이름(② 2-5) — 스스로 정한 별명과 구별되게 예약어에 더함
  --   (화면 src/lib/privacy.ts RESERVED_NICKNAMES 와 같은 15개).
  if lower(v) in ('관리자', '총괄', '총괄 관리자', '총괄관리자', '운영자', '사이트 운영자', 'psc', 'admin', 'administrator',
                  '인증 전 회원', '탈퇴한 학생', '탈퇴한 회원', '회원', '익명', '선생님') then
    return 'reserved';
  end if;
  return null;
end;
$$;

revoke all on function public.privacy_nickname_error(text) from public, anon, authenticated;

-- ═════════════════════════════════════════════
-- 6. 화면용 RPC — 구글 계정 확인 창(src/lib/privacy.ts). 로그인한 사용자만 실행.
-- ═════════════════════════════════════════════

-- 6-1. my_member_gate() — 지금 로그인한 나에게 창을 띄울지(spec 3절). 행이 없으면 'ok'(아이디 계정 · ② 전).
create or replace function public.my_member_gate()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := auth.uid();
  v_version int;
  v_origin  text;
  v_verified timestamptz;
  v_ack     timestamptz;
  v_ackver  int;
  v_locked  timestamptz;
  v_role    text;
begin
  select coalesce((select s.privacy_version from public.site_settings s where s.id = true limit 1), 1) into v_version;

  if v_uid is null then
    return jsonb_build_object('state', 'ok', 'origin', null, 'first_time', false, 'locked_seconds', null,
                              'policy_version', v_version);
  end if;

  select v.origin, v.verified_at, v.ack_at, v.policy_version, v.locked_until, p.role
    into v_origin, v_verified, v_ack, v_ackver, v_locked, v_role
    from public.member_verification v
    join public.profiles p on p.id = v.user_id
   where v.user_id = v_uid;
  if not found then
    return jsonb_build_object('state', 'ok', 'origin', null, 'first_time', false, 'locked_seconds', null,
                              'policy_version', v_version);
  end if;

  -- 인증 전 구글 계정(role user) → 코드가 필요한 창(새 가입 = 1절, 기존 회원 = 2절)
  if v_role = 'user' and v_verified is null then
    return jsonb_build_object(
      'state', 'need_code',
      'origin', v_origin,
      'first_time', v_ack is null,
      'locked_seconds', case when v_locked is not null and v_locked > now()
                             then ceil(extract(epoch from (v_locked - now())))::int end,
      'policy_version', v_version
    );
  end if;

  -- 구글 관리자(코드 없이) · 인증 마친 계정 → 처음 확인(3-1) 또는 판 번호가 올랐을 때 다시 확인(3-2)
  if v_ack is null or v_ackver is distinct from v_version then
    return jsonb_build_object('state', 'need_ack', 'origin', v_origin, 'first_time', v_ack is null,
                              'locked_seconds', null, 'policy_version', v_version);
  end if;

  return jsonb_build_object('state', 'ok', 'origin', v_origin, 'first_time', false, 'locked_seconds', null,
                            'policy_version', v_version);
end;
$$;

-- 6-2. verify_google_teacher(p_nickname, p_code, p_policy_version) — 교사 인증(spec 4.3).
--      ⚠ 예외를 던지지 않고 결과(jsonb)를 돌려준다 — 예외를 던지면 틀린 횟수·시도 기록이 함께 되돌려진다.
--      한도(사용자 확정, 질문 10): 계정당 5번 틀리면 15분, 10번 60분, 15번부터 5번마다 24시간 잠금(잠금이 걸려도 wrong_count 는
--      그대로 — 풀린 뒤 이어서 센다) · 전체: 최근 10분 동안 모든 계정의 틀린 시도가 30번 이상이면 'busy'(맞는 코드도 거부).
--      순서: 로그인 → 같은 계정의 동시 호출을 한 줄로(advisory lock) → 30일 지난 시도 정리 → 행 없음 → 이미 인증(already) →
--            이미 role admin(not_applicable) → 판 번호 → 코드 미설정 → 잠금 → 전체 한도 → 별명(시도로 세지 않음) → 코드 비교.
--      (spec 4.3 은 role admin 확인이 already 보다 앞이지만, 다른 탭에서 인증을 마친 계정(role admin 이 됨)이 다시 누르면
--       4절 "이미 확인을 마쳤어요" 가 보이도록 already 를 먼저 본다 — 보고서 참고.)
create or replace function public.verify_google_teacher(p_nickname text, p_code text, p_policy_version int)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid      uuid := auth.uid();
  v_verified timestamptz;
  v_locked   timestamptz;
  v_wrong    int;
  v_role     text;
  v_version  int;
  v_hash     text;
  v_recent   int;
  v_nick     text;
  v_nick_err text;
  v_ok       boolean;
  v_count    int;
  v_lock     interval;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'not_signed_in');
  end if;

  -- 같은 계정의 동시 호출을 한 줄로 세운다(트랜잭션이 끝나면 풀린다).
  perform pg_advisory_xact_lock(hashtext('public.member_verification'), hashtext(v_uid::text));

  -- 30일 지난 시도 기록 정리(이 함수와 admin_privacy_overview 가 불릴 때만 — 처리방침 제3조에 그대로 적음).
  delete from public.member_verification_attempts a where a.created_at < now() - interval '30 days';

  select v.verified_at, v.locked_until, v.wrong_count
    into v_verified, v_locked, v_wrong
    from public.member_verification v
   where v.user_id = v_uid
     for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_applicable');
  end if;
  if v_verified is not null then
    return jsonb_build_object('ok', false, 'reason', 'already');
  end if;

  select p.role into v_role from public.profiles p where p.id = v_uid;
  if v_role is distinct from 'user' then
    return jsonb_build_object('ok', false, 'reason', 'not_applicable');
  end if;

  select coalesce((select s.privacy_version from public.site_settings s where s.id = true limit 1), 1) into v_version;
  if p_policy_version is null or p_policy_version <> v_version then
    return jsonb_build_object('ok', false, 'reason', 'policy_changed', 'policy_version', v_version);
  end if;

  select vs.code_hash into v_hash from public.verification_settings vs where vs.id = true;
  if v_hash is null then
    return jsonb_build_object('ok', false, 'reason', 'not_configured');
  end if;

  if v_locked is not null and v_locked > now() then
    return jsonb_build_object('ok', false, 'reason', 'locked',
                              'locked_seconds', ceil(extract(epoch from (v_locked - now())))::int);
  end if;

  select count(*) into v_recent
    from public.member_verification_attempts a
   where not a.ok and a.created_at > now() - interval '10 minutes';
  if v_recent >= 30 then
    return jsonb_build_object('ok', false, 'reason', 'busy');
  end if;

  -- 별명 검사(틀려도 시도로 세지 않는다)
  v_nick_err := public.privacy_nickname_error(p_nickname);
  if v_nick_err is not null then
    return jsonb_build_object(
      'ok', false, 'reason', 'bad_nickname', 'nickname_error', v_nick_err,
      'message', case v_nick_err
                   when 'empty'  then '별명을 적어 주세요.'
                   when 'length' then '별명은 2자 이상 20자 이하로 적어 주세요.'
                   when 'chars'  then '별명에는 이메일·인터넷 주소·줄바꿈을 쓸 수 없어요.'
                   else '이 이름은 쓸 수 없어요. 다른 별명을 적어 주세요.'
                 end
    );
  end if;
  v_nick := btrim(p_nickname);

  -- 코드 비교 — 숫자 6자리가 아니면 비교하지 않고 틀린 것으로 센다.
  if p_code is null or p_code !~ '^[0-9]{6}$' then
    v_ok := false;
  else
    v_ok := (v_hash = extensions.crypt(p_code, v_hash));
  end if;

  if not coalesce(v_ok, false) then
    v_count := v_wrong + 1;
    v_lock := case
                when v_count % 5 <> 0 then null
                when v_count = 5  then interval '15 minutes'
                when v_count = 10 then interval '60 minutes'
                else interval '24 hours'
              end;
    update public.member_verification v
       set wrong_count  = v_count,
           total_wrong  = v.total_wrong + 1,
           locked_until = case when v_lock is null then v.locked_until else now() + v_lock end
     where v.user_id = v_uid;
    insert into public.member_verification_attempts (user_id, ok) values (v_uid, false);
    return jsonb_build_object(
      'ok', false, 'reason', 'wrong_code',
      'attempts_left', case when v_lock is null then 5 - (v_count % 5) else 0 end,
      'locked_seconds', case when v_lock is null then null else ceil(extract(epoch from v_lock))::int end
    );
  end if;

  -- 맞음 — 한 트랜잭션에서 별명 · 사진 비우기 · 교사(자기 학급 일만) · 확인 기록.
  -- (member_directory.email 은 ②부터 이미 가린 값이라 여기서 따로 가리지 않는다 — spec 4.4)
  update public.profiles p
     set display_name  = v_nick,
         avatar_url    = null,
         role          = 'admin',
         teacher_scope = 'class',
         class_id      = null
   where p.id = v_uid;
  update public.member_verification v
     set verified_at    = now(),
         ack_at         = now(),
         policy_version = p_policy_version,
         wrong_count    = 0,
         locked_until   = null
   where v.user_id = v_uid;
  insert into public.member_verification_attempts (user_id, ok) values (v_uid, true);
  return jsonb_build_object('ok', true);
end;
$$;

-- 6-3. acknowledge_privacy(p_nickname, p_policy_version) — 코드가 필요 없는 확인(spec 3.6 · 3.7).
--      대상: member_verification 행이 있고 (role admin 이거나 인증을 마친) 계정. 처음 확인(ack 없음)이면 별명이 필수.
--      별명(처음 한 번) · 구글 사진 주소 비우기 · ack_at · policy_version 을 기록한다.
create or replace function public.acknowledge_privacy(p_nickname text default null, p_policy_version int default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid      uuid := auth.uid();
  v_verified timestamptz;
  v_ack      timestamptz;
  v_role     text;
  v_version  int;
  v_nick_err text;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'not_signed_in');
  end if;

  perform pg_advisory_xact_lock(hashtext('public.member_verification'), hashtext(v_uid::text));

  select v.verified_at, v.ack_at into v_verified, v_ack
    from public.member_verification v
   where v.user_id = v_uid
     for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_applicable');
  end if;

  select p.role into v_role from public.profiles p where p.id = v_uid;
  if v_role = 'user' and v_verified is null then
    return jsonb_build_object('ok', false, 'reason', 'need_code');
  end if;

  select coalesce((select s.privacy_version from public.site_settings s where s.id = true limit 1), 1) into v_version;
  if p_policy_version is null or p_policy_version <> v_version then
    return jsonb_build_object('ok', false, 'reason', 'policy_changed', 'policy_version', v_version);
  end if;

  if v_ack is null then
    v_nick_err := public.privacy_nickname_error(p_nickname);
    if v_nick_err is not null then
      return jsonb_build_object(
        'ok', false, 'reason', 'bad_nickname', 'nickname_error', v_nick_err,
        'message', case v_nick_err
                     when 'empty'  then '별명을 적어 주세요.'
                     when 'length' then '별명은 2자 이상 20자 이하로 적어 주세요.'
                     when 'chars'  then '별명에는 이메일·인터넷 주소·줄바꿈을 쓸 수 없어요.'
                     else '이 이름은 쓸 수 없어요. 다른 별명을 적어 주세요.'
                   end
      );
    end if;
    update public.profiles p
       set display_name = btrim(p_nickname), avatar_url = null
     where p.id = v_uid;
  else
    -- 다시 확인(3-2)에는 별명 칸이 없다. 구글 사진 주소는 늘 비워 둔다(결정 10).
    update public.profiles p
       set avatar_url = null
     where p.id = v_uid and p.avatar_url is not null;
  end if;

  update public.member_verification v
     set ack_at = now(), policy_version = p_policy_version
   where v.user_id = v_uid;
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.my_member_gate() from public, anon, authenticated;
grant execute on function public.my_member_gate() to authenticated;
revoke all on function public.verify_google_teacher(text, text, int) from public, anon, authenticated;
grant execute on function public.verify_google_teacher(text, text, int) to authenticated;
revoke all on function public.acknowledge_privacy(text, int) from public, anon, authenticated;
grant execute on function public.acknowledge_privacy(text, int) to authenticated;

-- ═════════════════════════════════════════════
-- 7. 화면용 RPC — 총괄 '개인정보 설정'(src/lib/admin-privacy.ts). 총괄만(함수 안에서 확인). 오류는 한국어 문구로 raise.
-- ═════════════════════════════════════════════

-- 7-1. 교사 인증 코드 정하기 — 숫자 6자리만, bcrypt 해시로만 저장(되돌릴 수 없음).
--      시도 기록(member_verification_attempts)은 그대로 둔다(spec 4.3 — 전체 한도·"최근 1시간 틀린 시도"가 계속 맞게).
--      계정별 틀린 횟수·잠금은 초기화한다(spec 4.2 "시도 기록 초기화" — 옛 코드 때문에 잠긴 선생님이 새 코드로 바로 할 수 있게).
create or replace function public.admin_set_teacher_code(p_code text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_super_admin() then
    raise exception '총괄 관리자만 사용할 수 있습니다.';
  end if;
  if p_code is null or p_code !~ '^[0-9]{6}$' then
    raise exception '숫자 6자리로 적어 주세요.';
  end if;

  insert into public.verification_settings (id, code_hash, code_set_at, code_set_by)
  values (true, extensions.crypt(p_code, extensions.gen_salt('bf')), now(), auth.uid())
  on conflict (id) do update
    set code_hash = excluded.code_hash, code_set_at = excluded.code_set_at, code_set_by = excluded.code_set_by;

  update public.member_verification v
     set wrong_count = 0, locked_until = null
   where v.wrong_count <> 0 or v.locked_until is not null;
end;
$$;

-- 7-2. 문의 이메일 — 이메일 모양 검사(254자 안). 빈 값(null · 공백)이면 지운다. 처리방침 화면에 공개로 보인다(결정 8).
--      고침 1(검토 R1 L3): 처리방침이 시행된 뒤(site_settings.policy_effective_at 있음)에는 빈 값으로 지우지 못한다
--      (처리방침 제10조의 연락처가 비지 않게 — 다른 주소로 바꾸기만 된다).
create or replace function public.admin_set_contact_email(p_email text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v text := nullif(btrim(coalesce(p_email, '')), '');
begin
  if not public.is_super_admin() then
    raise exception '총괄 관리자만 사용할 수 있습니다.';
  end if;
  if v is null and exists (select 1 from public.site_settings s where s.id = true and s.policy_effective_at is not null) then
    raise exception '처리방침이 시행된 뒤에는 문의 이메일을 비울 수 없어요. 다른 주소로 바꿔 주세요.';
  end if;
  if v is not null and (
       char_length(v) > 254
       or v ~ '[[:cntrl:][:space:]]'
       or v !~ '^[^@]+@[^@]+\.[^@.]+$'
     ) then
    raise exception '이메일 주소 모양이 아니에요.';
  end if;

  update public.site_settings s
     set contact_email = v, updated_at = now(), updated_by = auth.uid()
   where s.id = true;
  if not found then
    insert into public.site_settings (id, login_required, contact_email, updated_by)
    values (true, false, v, auth.uid());
  end if;
end;
$$;

-- 7-3. 현황 — 30일 지난 시도 기록도 함께 정리한다(그래서 stable 이 아니다).
create or replace function public.admin_privacy_overview()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if not public.is_super_admin() then
    raise exception '총괄 관리자만 사용할 수 있습니다.';
  end if;

  delete from public.member_verification_attempts a where a.created_at < now() - interval '30 days';

  select jsonb_build_object(
    'code_set', coalesce((select vs.code_hash is not null from public.verification_settings vs where vs.id = true), false),
    'code_set_at', (select vs.code_set_at from public.verification_settings vs where vs.id = true),
    'contact_email', (select s.contact_email from public.site_settings s where s.id = true),
    'privacy_version', coalesce((select s.privacy_version from public.site_settings s where s.id = true), 1),
    'pending_count', (
      select count(*)::int
        from public.member_verification v
        join public.profiles p on p.id = v.user_id
       where v.verified_at is null and p.role = 'user'
    ),
    'pending_over_30d', (
      select count(*)::int
        from public.member_verification v
        join public.profiles p on p.id = v.user_id
        left join public.member_directory d on d.id = v.user_id
       where v.verified_at is null and p.role = 'user'
         and coalesce(d.signed_up_at, p.created_at) < now() - interval '30 days'
    ),
    'wrong_last_hour', (
      select count(*)::int from public.member_verification_attempts a
       where not a.ok and a.created_at > now() - interval '1 hour'
    ),
    'locked_accounts', (
      select count(*)::int from public.member_verification v where v.locked_until > now()
    )
  ) into v_result;
  return v_result;
end;
$$;

-- 7-4. 회원 목록 표시용 — 구글 계정(member_verification 행이 있는 회원)과 모든 교사(role admin).
create or replace function public.admin_member_privacy_flags()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_super_admin() then
    raise exception '총괄 관리자만 사용할 수 있습니다.';
  end if;
  return coalesce((
    select jsonb_agg(
             jsonb_build_object(
               'id', p.id,
               'pending', (v.user_id is not null and v.verified_at is null and p.role = 'user'),
               'origin', v.origin,
               'teacher_scope', p.teacher_scope,
               'verified_at', v.verified_at,
               'signed_up_days', floor(extract(epoch from (now() - coalesce(d.signed_up_at, p.created_at))) / 86400)::int
             )
             order by p.created_at, p.id
           )
      from public.profiles p
      left join public.member_verification v on v.user_id = p.id
      left join public.member_directory d on d.id = p.id
     where v.user_id is not null or p.role = 'admin'
  ), '[]'::jsonb);
end;
$$;

-- 7-5. 교사 권한 넓히기·줄이기 — 총괄만. 대상은 role admin 교사(구글·아이디). 자기 자신 · 총괄 대상('class'로 줄이기)은 불가.
create or replace function public.admin_set_teacher_scope(p_user uuid, p_scope text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role  text;
  v_super boolean;
begin
  if not public.is_super_admin() then
    raise exception '총괄 관리자만 사용할 수 있습니다.';
  end if;
  if p_user is null then
    raise exception '대상 회원을 찾을 수 없습니다.';
  end if;
  if p_scope is null or p_scope not in ('full', 'class') then
    raise exception '잘못된 권한 범위입니다.';
  end if;
  if p_user = auth.uid() then
    raise exception '자기 자신의 권한 범위는 바꿀 수 없습니다.';
  end if;

  select p.role, p.is_super_admin into v_role, v_super
    from public.profiles p
   where p.id = p_user
     for update;
  if not found then
    raise exception '대상 회원을 찾을 수 없습니다.';
  end if;
  if v_role is distinct from 'admin' then
    raise exception '교사 계정만 권한 범위를 바꿀 수 있습니다.';
  end if;
  if coalesce(v_super, false) and p_scope = 'class' then
    raise exception '총괄 관리자의 권한은 줄일 수 없습니다.';
  end if;

  update public.profiles p set teacher_scope = p_scope where p.id = p_user and p.teacher_scope is distinct from p_scope;
end;
$$;

revoke all on function public.admin_set_teacher_code(text) from public, anon, authenticated;
grant execute on function public.admin_set_teacher_code(text) to authenticated;
revoke all on function public.admin_set_contact_email(text) from public, anon, authenticated;
grant execute on function public.admin_set_contact_email(text) to authenticated;
revoke all on function public.admin_privacy_overview() from public, anon, authenticated;
grant execute on function public.admin_privacy_overview() to authenticated;
revoke all on function public.admin_member_privacy_flags() from public, anon, authenticated;
grant execute on function public.admin_member_privacy_flags() to authenticated;
revoke all on function public.admin_set_teacher_scope(uuid, text) from public, anon, authenticated;
grant execute on function public.admin_set_teacher_scope(uuid, text) to authenticated;

-- ═════════════════════════════════════════════
-- 8. 화면용 RPC — 학급 정리 · 보호자 동의(담임·총괄). 오류는 한국어 문구로 raise.
-- ═════════════════════════════════════════════

-- 8-1. 학급 정리 미리보기 — 그 학급의 담임 또는 총괄.
create or replace function public.admin_class_cleanup_preview(p_class_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_name text;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception '관리자만 사용할 수 있습니다.';
  end if;
  if p_class_id is null or not (p_class_id = any (public.my_class_ids()) or public.is_super_admin()) then
    raise exception '이 학급의 담임 선생님(또는 총괄)만 볼 수 있습니다.';
  end if;
  select c.name into v_name from public.classes c where c.id = p_class_id;
  if not found then
    raise exception '학급을 찾을 수 없습니다.';
  end if;

  return jsonb_build_object(
    'class_name', v_name,
    'students', (select count(*)::int from public.profiles s where s.class_id = p_class_id and s.role = 'user'),
    'withdrawn', (select count(*)::int from public.profiles s
                   where s.class_id = p_class_id and s.role = 'user' and s.withdrawn_at is not null),
    'oauth_only', (select count(*)::int
                     from public.profiles s
                     join public.member_directory d on d.id = s.id
                    where s.class_id = p_class_id and s.role = 'user'
                      and coalesce(d.provider, '') <> 'email'
                      and not ('email' = any (coalesce(d.providers, '{}'::text[])))
                      and (coalesce(d.provider, '') <> '' or cardinality(coalesce(d.providers, '{}'::text[])) > 0))
  );
end;
$$;

-- 8-2. 학급 정리 기한(spec 4.7-3 개정 3 — "종업식 뒤 그 학년도의 2월 28일까지") — 담임은 자기 학급, 총괄은 모든 학급.
--      자동 삭제는 없다(결정 9 — 표시만). 학년도 Y = Y년 3월 1일 ~ Y+1년 2월 말. 학년도 Y 의 학생 = Y년 2월 1일(겨울방학에 미리 등록)부터
--      Y+1년 2월 1일 전까지 만든 계정. 그 학생들의 기한 = Y+1년 2월 28일. 날짜는 한국 시간.

-- 8-2a. (개정 3) 날짜 계산만 하는 내부 도우미 — 오늘 날짜를 받아 경계 날짜를 돌려준다(학생 수와 상관없음 → 맨 끝 점검 12-8이 날짜 11개로 시험).
--       {"today", "school_year_start"(S = 오늘이 지난 가장 최근 3월 1일),
--        "overdue_before"(이 날 한국 시간 0시 전에 만든 학생 = 기한 지남: S 해의 2월 1일 · 윤년 2월 29일이면 올해 2월 1일),
--        "february_from" · "february_before"(2월 1~28일에만: S 해의 2월 1일 ~ 올해 2월 1일 전 = 이번 학년도 학생, 2월 알림. 그 밖의 날은 null),
--        "deadline"(3월~1월: S 해의 2월 28일 · 2월: 올해 2월 28일), "past_deadline"(today > deadline), "in_february"(2월 1~28일)}
--       누구도 직접 부를 수 없다(함수 안 · SQL Editor(postgres)에서만).
create or replace function public.privacy_retention_window(p_today date)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_ty       int;
  v_month    int;
  v_day      int;
  v_sy       int;      -- 학년도(그 해 3월 1일에 시작)
  v_feb      boolean;  -- 2월 1~28일 = 2월 알림
  v_over     date;
  v_deadline date;
begin
  if p_today is null then
    return null;
  end if;
  v_ty    := extract(year from p_today)::int;
  v_month := extract(month from p_today)::int;
  v_day   := extract(day from p_today)::int;
  v_sy    := case when p_today < make_date(v_ty, 3, 1) then v_ty - 1 else v_ty end;
  v_feb   := v_month = 2 and v_day <= 28;
  -- 윤년 2월 29일: 이번 학년도의 기한(2월 28일)도 지났다 → 올해 2월 1일 전에 만든 학생 모두 기한 지남
  v_over  := case when v_month = 2 and v_day = 29 then make_date(v_ty, 2, 1) else make_date(v_sy, 2, 1) end;
  v_deadline := case when v_month = 2 then make_date(v_ty, 2, 28) else make_date(v_sy, 2, 28) end;

  return jsonb_build_object(
    'today', p_today,
    'school_year_start', make_date(v_sy, 3, 1),
    'overdue_before', v_over,
    'february_from', case when v_feb then make_date(v_sy, 2, 1) end,
    'february_before', case when v_feb then make_date(v_ty, 2, 1) end,
    'deadline', v_deadline,
    'past_deadline', p_today > v_deadline,
    'in_february', v_feb
  );
end;
$$;

revoke all on function public.privacy_retention_window(date) from public, anon, authenticated;

-- 8-2b. 기한 현황(개정 3) — 옛 키(today · school_year_start · cutoff · deadline · past_deadline · due_total · overdue_total · scope ·
--       classes[class_id · class_name · old_students · students])는 그대로 두고 in_february · february_total ·
--       classes[overdue_students · february_students]를 더했다(화면 묶음 4는 새 키를 먼저 읽는다 — build-4-report.md 3절).
create or replace function public.admin_class_retention_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_today    date := (now() at time zone 'Asia/Seoul')::date;
  v_win      jsonb;
  v_over_ts  timestamptz;
  v_febf_ts  timestamptz;
  v_febb_ts  timestamptz;
  v_super    boolean := public.is_super_admin();
  v_classes  jsonb;
  v_over     int;
  v_feb      int;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception '관리자만 사용할 수 있습니다.';
  end if;

  v_win     := public.privacy_retention_window(v_today);
  -- 경계 날짜의 한국 시간 0시(2월이 아니면 2월 알림 경계는 null → 2월 알림 0)
  v_over_ts := ((v_win ->> 'overdue_before')::date::timestamp at time zone 'Asia/Seoul');
  v_febf_ts := ((v_win ->> 'february_from')::date::timestamp at time zone 'Asia/Seoul');
  v_febb_ts := ((v_win ->> 'february_before')::date::timestamp at time zone 'Asia/Seoul');

  select coalesce(jsonb_agg(jsonb_build_object(
                    'class_id', x.id,
                    'class_name', x.name,
                    'old_students', x.over_n + x.feb_n,
                    'overdue_students', x.over_n,
                    'february_students', x.feb_n,
                    'students', x.all_n)
                  order by x.name, x.id), '[]'::jsonb),
         coalesce(sum(x.over_n), 0)::int,
         coalesce(sum(x.feb_n), 0)::int
    into v_classes, v_over, v_feb
    from (
      select c.id, c.name,
             count(s.id) filter (where s.created_at < v_over_ts) as over_n,
             count(s.id) filter (where v_febf_ts is not null
                                   and s.created_at >= v_febf_ts
                                   and s.created_at < v_febb_ts) as feb_n,
             count(s.id) as all_n
        from public.classes c
        join public.profiles s on s.class_id = c.id and s.role = 'user'
       where v_super or c.id = any (public.my_class_ids())
       group by c.id, c.name
    ) x
   where x.over_n > 0 or x.feb_n > 0;

  return jsonb_build_object(
    'today', v_today,
    'school_year_start', v_win -> 'school_year_start',
    'cutoff', v_win -> 'overdue_before',
    'deadline', v_win -> 'deadline',
    'past_deadline', (v_win ->> 'past_deadline')::boolean,
    'in_february', (v_win ->> 'in_february')::boolean,
    'due_total', v_over + v_feb,
    'overdue_total', v_over,
    'february_total', v_feb,
    'scope', case when v_super then 'all' else 'mine' end,
    'classes', v_classes
  );
end;
$$;

-- 8-3. 보호자 동의 표시(한 명) — 그 학생의 담임만(teaches_student — 총괄도 다른 학급 학생은 못 함, 결정 5·spec 4.8).
--      p_value true: 처음 표시한 때·선생님을 남긴다(이미 표시돼 있으면 그대로) / false: 표시를 지운다.
create or replace function public.admin_set_guardian_consent(p_student uuid, p_value boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_student is null or p_value is null then
    raise exception '대상 학생을 찾을 수 없습니다.';
  end if;
  if not public.teaches_student(p_student) then
    raise exception '이 학생의 담임 선생님만 기록할 수 있습니다.';
  end if;
  if exists (select 1 from public.profiles s where s.id = p_student and s.withdrawn_at is not null) then
    raise exception '탈퇴 처리된 학생은 기록할 수 없습니다.';
  end if;

  if p_value then
    update public.member_directory d
       set guardian_consent_at = now(), guardian_consent_by = auth.uid()
     where d.id = p_student and d.guardian_consent_at is null;
  else
    update public.member_directory d
       set guardian_consent_at = null, guardian_consent_by = null
     where d.id = p_student;
  end if;
  if not exists (select 1 from public.member_directory d where d.id = p_student) then
    raise exception '회원 명단에서 이 학생을 찾을 수 없습니다.';
  end if;
end;
$$;

-- 8-4. 보호자 동의 표시(학급 전체) — 그 학급의 담임만. 기록 없는 학생(탈퇴 처리된 학생 제외)을 모두 표시하고 바뀐 수를 돌려준다.
create or replace function public.admin_set_guardian_consent_class(p_class_id uuid)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  n int;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception '관리자만 사용할 수 있습니다.';
  end if;
  if p_class_id is null or not (p_class_id = any (public.my_class_ids())) then
    raise exception '이 학급의 담임 선생님만 기록할 수 있습니다.';
  end if;

  update public.member_directory d
     set guardian_consent_at = now(), guardian_consent_by = auth.uid()
    from public.profiles s
   where s.id = d.id
     and s.class_id = p_class_id
     and s.role = 'user'
     and s.withdrawn_at is null
     and d.guardian_consent_at is null;
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.admin_class_cleanup_preview(uuid) from public, anon, authenticated;
grant execute on function public.admin_class_cleanup_preview(uuid) to authenticated;
revoke all on function public.admin_class_retention_status() from public, anon, authenticated;
grant execute on function public.admin_class_retention_status() to authenticated;
revoke all on function public.admin_set_guardian_consent(uuid, boolean) from public, anon, authenticated;
grant execute on function public.admin_set_guardian_consent(uuid, boolean) to authenticated;
revoke all on function public.admin_set_guardian_consent_class(uuid) from public, anon, authenticated;
grant execute on function public.admin_set_guardian_consent_class(uuid) to authenticated;

-- ═════════════════════════════════════════════
-- 9. my_admin_context() 다시 정의 — 20260927000000 §7-1 본문 그대로 + 'teacher_scope'(spec 4.2 · 4.6 #25).
--    ② 전에는 모든 교사가 'full' 이라 화면 동작은 그대로다.
-- ═════════════════════════════════════════════
create or replace function public.my_admin_context()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception '관리자만 사용할 수 있습니다.';
  end if;
  return jsonb_build_object(
    'is_super_admin', public.is_super_admin(),
    'teacher_scope', coalesce((select p.teacher_scope from public.profiles p where p.id = auth.uid()), 'full'),
    'classes', coalesce(
      (
        select jsonb_agg(
                 jsonb_build_object(
                   'id', c.id,
                   'name', c.name,
                   'student_count', (
                     select count(*)::int
                     from public.profiles s
                     where s.class_id = c.id
                       and s.role = 'user'
                       and s.withdrawn_at is null
                   )
                 )
                 order by c.created_at, c.id
               )
        from public.classes c
        join public.class_teachers ct on ct.class_id = c.id
        where ct.teacher_id = auth.uid()
          and c.archived_at is null
      ),
      '[]'::jsonb
    )
  );
end;
$$;

revoke all on function public.my_admin_context() from public, anon;
grant execute on function public.my_admin_context() to authenticated;

-- ═════════════════════════════════════════════
-- 10. 서비스 롤 전용 함수 — Edge Function(member-self-delete · admin-clear-students · admin-create-member)이 부른다.
--     revoke all … from public, anon, authenticated → grant execute … to service_role.
--     오류는 영어 짧은 문구(⑦ admin_purge_oauth_member 와 같은 방식 — Edge Function 이 한국어 안내로 바꾼다).
-- ═════════════════════════════════════════════

-- 10-1. purge_member_records(p_target) — 한 계정의 모든 기록을 지우는 공통 내부 함수(spec 4.7-1).
--       ⑦ admin_purge_oauth_member(20260928000000)와 같은 순서·같은 주의(그 함수는 고치지 않는다 — 이미 실행됨).
--       ⚠ 두 곳의 목록이 어긋나지 않게: profiles 를 가리키는 새 표·열이 생기면 이 함수와 admin_purge_oauth_member 를 함께 살핀다.
--       부르기 전에 Edge Function 이 게임 파일(Storage)을 지우고 로그인 계정(auth.users)을 하드 삭제한다(oauth-delete spec §3.8).
--       ① 그 계정의 글·댓글을 신고한 기록(스냅샷에 제목·내용·작성자) ② 그 계정의 자유게시판·학습게임 글(다른 사람의 댓글·좋아요도
--       cascade) ③ 관리 기록 3곳(대상 행 삭제, 처리자로 남은 이름·id 는 비움) ④ 교사였던 계정이면 그 교사가 쓴 선생님 글·과제·블로그 글
--       ⑤ profiles 한 줄 — 나머지는 외래키가 정리한다:
--         cascade: comments · likes · member_directory · app_results · post_reads · assignment_submissions · feedback_threads(→ 메시지·읽음) ·
--                  feedback_messages.sender_id · feedback_read_marks.user_id · app_progress · class_teachers · community_comments ·
--                  community_likes · community_reports.reporter_id · member_verification
--         set null: posts.author_id · assignments.created_by · class_notices.author_id · praise_presets.created_by · classes.created_by ·
--                  site_settings.updated_by · member_create_log.actor_id · member_withdrawal_log.actor_id · community_posts.author_id ·
--                  community_posts.board_owner · community_reports.target_author_id · community_reports.target_board_owner ·
--                  member_directory.guardian_consent_by · member_verification_attempts.user_id · verification_settings.code_set_by ·
--                  class_cleanup_log.actor_id
--       ⚠ ④의 과제: 다른 학생의 제출물이 달린 과제는 지우지 않는다(지우면 그 학생들의 제출물이 cascade 로 사라진다 — 학생 기록 보호,
--         spec 4.7-1 과 다른 점, 보고서 참고). 그런 과제는 남고 쓴 사람만 비워진다(총괄만 고칠 수 있음).
--       총괄 계정은 지우지 않는다(방어).
create or replace function public.purge_member_records(p_target uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role  text;
  v_super boolean;
begin
  if p_target is null then
    raise exception 'missing arguments';
  end if;

  select p.role, p.is_super_admin into v_role, v_super
    from public.profiles p
   where p.id = p_target
     for update;
  if not found then
    return; -- 이미 지워짐(재시도) — 조용히 끝낸다
  end if;
  if v_role = 'admin' and coalesce(v_super, false) then
    raise exception 'super admin cannot be purged';
  end if;

  -- ① 그 계정의 글·댓글을 신고한 기록(글 신고 = 댓글 신고가 아닌 행 — 신고 중복 방지 인덱스와 같은 구분)
  delete from public.community_reports r
   where r.target_author_id = p_target
      or (
        r.comment_id is null
        and r.target_kind is distinct from 'comment'
        and r.post_id in (select cp.id from public.community_posts cp where cp.author_id = p_target)
      )
      or r.comment_id in (select cc.id from public.community_comments cc where cc.user_id = p_target);

  -- ② 그 계정이 쓴 자유게시판·학습게임 글(그 글의 다른 사람 댓글·좋아요도 cascade 로 함께)
  delete from public.community_posts cp where cp.author_id = p_target;

  -- ③ 관리 기록 3곳 — 대상에 대한 기록은 행째로, 대상이 "처리한 사람"으로 남은 이름·id 는 비운다
  delete from public.member_withdrawal_log l where l.target_id = p_target;
  delete from public.member_create_log     l where l.target_id = p_target;
  delete from public.password_reset_log    l where l.target_id = p_target;
  update public.member_create_log l
     set actor_name = null
   where l.actor_id = p_target
     and l.actor_name is not null;
  update public.password_reset_log l
     set actor_id = null
   where l.actor_id = p_target;

  -- ④ 교사였던 계정이 쓴 선생님 글 · 과제(다른 학생 제출물이 없는 것만) · 블로그 글
  delete from public.class_notices n where n.author_id = p_target;
  delete from public.assignments a
   where a.created_by = p_target
     and not exists (select 1 from public.assignment_submissions s where s.assignment_id = a.id);
  delete from public.posts b where b.author_id = p_target;

  -- ⑤ 프로필 — 나머지는 외래키(cascade / set null)가 정리한다
  delete from public.profiles p where p.id = p_target;
end;
$$;

-- 10-2. admin_purge_class_member(p_target, p_actor) — 학급 정리 · 학생 한 명 '기록까지 삭제'(spec 4.7-3).
--       대상: role 'user' · 아이디 로그인이 있는 계정(구글 전용이면 거부 — 총괄의 '완전 삭제'로). 탈퇴 처리된 학생도 대상.
--       부른 사람: 교사(role admin)이고 그 학생 학급의 담임이거나 총괄(서비스 롤 요청에는 auth.uid() 가 없어 id 로 확인).
--       Edge Function 이 게임 파일 → 로그인 계정(이미 없으면 통과)을 지운 "다음"에 부른다. 이미 지워졌으면 조용히 끝(멱등).
create or replace function public.admin_purge_class_member(p_target uuid, p_actor uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_role  text;
  v_actor_super boolean;
  v_role        text;
  v_class       uuid;
  v_provider    text;
  v_providers   text[];
begin
  if p_target is null or p_actor is null then
    raise exception 'missing arguments';
  end if;

  select a.role, a.is_super_admin into v_actor_role, v_actor_super
    from public.profiles a
   where a.id = p_actor;
  if v_actor_role is distinct from 'admin' then
    raise exception 'actor is not an admin';
  end if;
  if p_target = p_actor then
    raise exception 'cannot purge yourself';
  end if;

  select p.role, p.class_id into v_role, v_class
    from public.profiles p
   where p.id = p_target
     for update;
  if not found then
    return; -- 이미 지워짐(재시도)
  end if;
  if v_role is distinct from 'user' then
    raise exception 'admin accounts cannot be purged';
  end if;
  if not (
       coalesce(v_actor_super, false)
       or (v_class is not null and exists (
             select 1 from public.class_teachers ct
              where ct.class_id = v_class and ct.teacher_id = p_actor
           ))
     ) then
    raise exception 'actor does not teach this student';
  end if;

  -- 구글 전용(아이디 로그인 없음)이면 거부 — 회원 명단의 가입 방식(⑦ · 화면 isOAuthOnlyMember 와 같은 규칙).
  -- 명단 줄이 없으면(드묾) 학급 학생으로 보고 진행한다(학급 정리가 영영 끝나지 않는 일을 막는다).
  select d.provider, d.providers into v_provider, v_providers
    from public.member_directory d
   where d.id = p_target;
  if found
     and coalesce(v_provider, '') <> 'email'
     and not ('email' = any (coalesce(v_providers, '{}'::text[])))
     and (coalesce(v_provider, '') <> '' or cardinality(coalesce(v_providers, '{}'::text[])) > 0) then
    raise exception 'oauth-only account';
  end if;

  -- 로그인 계정(auth.users)이 먼저 지워졌어야 한다(⑦과 같은 순서 보장). auth 를 읽을 권한이 없는 환경이면 이 확인만 건너뛴다.
  begin
    if exists (select 1 from auth.users u where u.id = p_target) then
      raise exception 'auth account still exists';
    end if;
  exception when insufficient_privilege then
    null;
  end;

  perform public.purge_member_records(p_target);
end;
$$;

-- 10-3. self_purge_member(p_target, p_mode) — 구글 계정 스스로 '가입하지 않기'(cancel) · '회원 탈퇴'(withdraw)(spec 4.7-2).
--       p_target = Edge Function(member-self-delete)이 JWT 로 확인한 본인. 공통: 구글 전용(아이디 로그인 없음) · 총괄 불가.
--       cancel  : 인증 전(member_verification 행 있음 · verified_at 없음) · role user · 학급 없음. 새 가입·기존 회원 모두(origin 안 봄).
--       withdraw: 인증을 마쳤거나 role admin 인 구글 계정. 마지막 관리자 불가. 그 교사가 담임인 학급 어디에든 학생(role user —
--                 탈퇴 처리된 학생 포함)이 남아 있으면 예외(message 'blocked', detail = 학급 이름들) → 화면은 "먼저 학급 정리".
--                 통과하면: 함께 맡은 학급(다른 지금 교사가 있음)은 담임 연결만 빠지고(프로필 삭제 cascade),
--                 혼자 맡은 빈 학급은 과제를 먼저 지우고(assignments.class_id 가 on delete restrict) 학급째 지운다
--                 (class_notices · class_teachers 는 cascade). 단 그 학급 과제에 다른 학생 제출물이 있으면 지우지 않고 보관(archived_at)한다.
--       그다음 purge_member_records. Edge Function 이 같은 조건을 먼저 확인하고 게임 파일 → 로그인 계정을 지운 "다음"에 부른다.
create or replace function public.self_purge_member(p_target uuid, p_mode text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role      text;
  v_super     boolean;
  v_class     uuid;
  v_provider  text;
  v_providers text[];
  v_has_row   boolean;
  v_verified  timestamptz;
  v_blocking  text;
  v_deleted   int := 0;
  v_archived  int := 0;
  r           record;
begin
  if p_target is null or p_mode is null then
    raise exception 'missing arguments';
  end if;
  if p_mode not in ('cancel', 'withdraw') then
    raise exception 'invalid mode';
  end if;

  select p.role, p.is_super_admin, p.class_id into v_role, v_super, v_class
    from public.profiles p
   where p.id = p_target
     for update;
  if not found then
    return jsonb_build_object('ok', true, 'already', true); -- 이미 지워짐(재시도)
  end if;
  if v_role = 'admin' and coalesce(v_super, false) then
    raise exception 'super admin cannot leave';
  end if;

  -- 구글 전용(아이디 로그인 없음)인가 — ⑦과 같은 규칙
  select d.provider, d.providers into v_provider, v_providers
    from public.member_directory d
   where d.id = p_target;
  if not found then
    raise exception 'member directory row not found';
  end if;
  if coalesce(v_provider, '') = 'email' or 'email' = any (coalesce(v_providers, '{}'::text[])) then
    raise exception 'target can sign in with id and password';
  end if;
  if coalesce(v_provider, '') = '' and cardinality(coalesce(v_providers, '{}'::text[])) = 0 then
    raise exception 'target sign-in method is unknown';
  end if;

  select true, v.verified_at into v_has_row, v_verified
    from public.member_verification v
   where v.user_id = p_target;
  v_has_row := coalesce(v_has_row, false);

  if p_mode = 'cancel' then
    if not v_has_row or v_verified is not null or v_role is distinct from 'user' or v_class is not null then
      raise exception 'not a pending account';
    end if;
  else
    if not (v_role = 'admin' or (v_has_row and v_verified is not null)) then
      raise exception 'not a verified teacher account';
    end if;
    if v_role = 'admin' then
      -- 동시에 두 관리자가 빠지는 경쟁을 막는다(admin_set_role 과 같은 방식).
      perform 1 from public.profiles where role = 'admin' for update;
      if (select count(*) from public.profiles where role = 'admin') <= 1 then
        raise exception 'last admin';
      end if;
    end if;

    select string_agg(distinct c.name, ', ') into v_blocking
      from public.class_teachers ct
      join public.classes c on c.id = ct.class_id
     where ct.teacher_id = p_target
       and exists (select 1 from public.profiles s where s.class_id = c.id and s.role = 'user');
    if v_blocking is not null then
      raise exception using message = 'blocked', detail = v_blocking;
    end if;
  end if;

  -- 로그인 계정(auth.users)이 먼저 지워졌어야 한다(⑦과 같은 순서 보장).
  begin
    if exists (select 1 from auth.users u where u.id = p_target) then
      raise exception 'auth account still exists';
    end if;
  exception when insufficient_privilege then
    null;
  end;

  if p_mode = 'withdraw' then
    for r in
      select ct.class_id
        from public.class_teachers ct
       where ct.teacher_id = p_target
    loop
      if exists (
           select 1
             from public.class_teachers o
             join public.profiles op on op.id = o.teacher_id
            where o.class_id = r.class_id
              and o.teacher_id <> p_target
              and op.role = 'admin'
         ) then
        continue; -- 함께 맡은 학급: 담임 연결만 빠진다(프로필 삭제 cascade)
      end if;
      if exists (
           select 1
             from public.assignments a
             join public.assignment_submissions s on s.assignment_id = a.id
            where a.class_id = r.class_id
         ) then
        update public.classes c set archived_at = coalesce(c.archived_at, now()) where c.id = r.class_id;
        v_archived := v_archived + 1;
      else
        delete from public.assignments a where a.class_id = r.class_id;
        delete from public.classes c where c.id = r.class_id;
        v_deleted := v_deleted + 1;
      end if;
    end loop;
  end if;

  perform public.purge_member_records(p_target);
  return jsonb_build_object('ok', true, 'mode', p_mode, 'deleted_classes', v_deleted, 'archived_classes', v_archived);
end;
$$;

-- 10-4. admin_finish_class_cleanup(p_class_id, p_actor, p_count) — 학급 정리 기록 한 줄(지운 인원수만, 이름·아이디 없음).
--       부른 사람: 교사이고 그 학급의 담임이거나 총괄. p_count 가 0 이하면 기록하지 않는다(null).
--       같은 학급 · 같은 선생님의 1시간 안 기록이 있으면 그 줄에 더한다(20명씩 여러 번 불러도 "한 번의 정리 = 한 줄").
create or replace function public.admin_finish_class_cleanup(p_class_id uuid, p_actor uuid, p_count int)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_role  text;
  v_actor_super boolean;
  v_name        text;
  v_id          bigint;
begin
  if p_class_id is null or p_actor is null or p_count is null then
    raise exception 'missing arguments';
  end if;

  select a.role, a.is_super_admin into v_actor_role, v_actor_super
    from public.profiles a
   where a.id = p_actor;
  if v_actor_role is distinct from 'admin' then
    raise exception 'actor is not an admin';
  end if;
  if not (
       coalesce(v_actor_super, false)
       or exists (select 1 from public.class_teachers ct where ct.class_id = p_class_id and ct.teacher_id = p_actor)
     ) then
    raise exception 'actor does not teach this class';
  end if;
  if p_count <= 0 then
    return null;
  end if;

  select c.name into v_name from public.classes c where c.id = p_class_id;

  perform pg_advisory_xact_lock(hashtext('public.class_cleanup_log'), hashtext(p_class_id::text));

  select l.id into v_id
    from public.class_cleanup_log l
   where l.class_id = p_class_id
     and l.actor_id = p_actor
     and l.created_at > now() - interval '1 hour'
   order by l.created_at desc
   limit 1;
  if v_id is not null then
    update public.class_cleanup_log l
       set student_count = l.student_count + p_count,
           class_name = coalesce(v_name, l.class_name)
     where l.id = v_id;
    return v_id;
  end if;

  insert into public.class_cleanup_log (class_id, class_name, actor_id, student_count)
  values (p_class_id, v_name, p_actor, p_count)
  returning id into v_id;
  return v_id;
end;
$$;

-- 10-5. admin_log_member_create — 옛 4-인자(20260923030000)를 지우고 5-인자로(둘이 있으면 호출이 모호해진다 — spec 4.2).
--       본문은 옛 정의 그대로 + p_guardian. 학생 계정(p_role 'user')이고 p_guardian = true 이면
--       member_create_log.guardian_consent = true(누가 = actor_id, 언제 = created_at) + member_directory.guardian_consent_at/by(처음 표시만).
--       교사 계정이면 guardian_consent 는 null(해당 없음). p_guardian 기본값 null → 지금 배포된 Edge Function 의 4-인자 호출도 그대로 된다.
drop function if exists public.admin_log_member_create(uuid, uuid, text, text);

create or replace function public.admin_log_member_create(
  p_target   uuid,
  p_actor    uuid,
  p_role     text,
  p_source   text,
  p_guardian boolean default null
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id       bigint;
  v_name     text;
  v_email    text;
  v_source   text := coalesce(p_source, 'single');
  v_guardian boolean;
begin
  if p_target is null or p_actor is null then
    raise exception 'missing arguments';
  end if;
  if p_role not in ('admin', 'user') then
    raise exception 'invalid role';
  end if;
  if v_source not in ('single', 'bulk') then
    v_source := 'single';
  end if;
  if not exists (select 1 from public.profiles where id = p_actor and role = 'admin') then
    raise exception 'actor is not an admin';
  end if;

  v_guardian := case when p_role = 'user' then p_guardian else null end;

  select p.display_name into v_name from public.profiles p where p.id = p_actor;
  select d.email into v_email from public.member_directory d where d.id = p_target;

  insert into public.member_create_log (target_id, target_email, target_role, actor_id, actor_name, source, guardian_consent)
  values (p_target, v_email, p_role, p_actor, v_name, v_source, v_guardian)
  returning id into v_id;

  if v_guardian is true then
    update public.member_directory d
       set guardian_consent_at = now(), guardian_consent_by = p_actor
     where d.id = p_target and d.guardian_consent_at is null;
  end if;

  return v_id;
end;
$$;

revoke all on function public.purge_member_records(uuid) from public, anon, authenticated;
grant execute on function public.purge_member_records(uuid) to service_role;
revoke all on function public.admin_purge_class_member(uuid, uuid) from public, anon, authenticated;
grant execute on function public.admin_purge_class_member(uuid, uuid) to service_role;
revoke all on function public.self_purge_member(uuid, text) from public, anon, authenticated;
grant execute on function public.self_purge_member(uuid, text) to service_role;
revoke all on function public.admin_finish_class_cleanup(uuid, uuid, int) from public, anon, authenticated;
grant execute on function public.admin_finish_class_cleanup(uuid, uuid, int) to service_role;
revoke all on function public.admin_log_member_create(uuid, uuid, text, text, boolean) from public, anon, authenticated;
grant execute on function public.admin_log_member_create(uuid, uuid, text, text, boolean) to service_role;

-- ═════════════════════════════════════════════
-- 11. 학생 아이디·이름 가리기 (개정 4 — spec 4.11) — 함수만 더한다. 정책은 ②(회원 명단 · 감사 기록 3개)와 ③(profiles)이 바꾼다
--     → ① 직후에는 아무도 이 함수들을 정책에서 부르지 않아 사이트 동작이 그대로다.
--     규칙:
--       · 학생(role 'user' — 탈퇴 처리된 학생 포함)의 이름(별명 display_name)·사진 = 본인 · 같은 학급 학생 · 그 학급 담임(보조 포함 —
--         총괄이 그 학급 담임이면 총괄도)만 온전히. 학급 없는 학생(담임 해제된 옛 교사 · 인증 전 구글 등)은 본인 · 총괄만.
--         그 밖의 로그인 회원에게는 첫 글자 + '***'(member_name_labels), 로그아웃 방문자에게는 '회원'(③ — 화면).
--       · 학생 아이디(member_directory.email 의 @ 앞 · 감사 기록의 target_email · target_name) = 그 학생의 담임만(teaches_student).
--         총괄은 회원 명단에서 첫 글자 + '***'(admin_masked_member_rows), 감사 기록은 읽지 못한다(②).
--       · 선생님(role 'admin') 별명 = 로그인한 모든 회원(인증 전 구글 제외).
--       · 관리 권한(can_manage_member — 비밀번호 초기화 · 탈퇴 처리 · 기록까지 삭제, 총괄은 모든 반)은 바꾸지 않는다(사용자 답 ④).
--     가린 글자 규칙(화면 · admin-clear-students 와 같아야 한다 — 확인 입력에 보이는 대로 "2***"를 적기 때문):
--       원래 값 = 표시 이름(앞뒤 공백 뺌), 비었으면 로그인 아이디(이메일의 @ 앞) → 그 첫 글자(코드 포인트 하나) + '***', 비었으면 '***'.
--       "공백" = JS String.prototype.trim() 이 빼는 글자 25개(privacy_btrim) — Edge Function 의 .trim() · Array.from(…)[0] 과 같은 결과.
--     재귀(42P17) 없음: 모두 security definer(소유자 postgres)라 profiles · member_directory · class_teachers 의 RLS 를 거치지 않는다.
-- ═════════════════════════════════════════════

-- 11-1. privacy_btrim(p_text) — 앞뒤에서 JS trim() 과 같은 글자를 뺀다(공백 · 탭 · 줄바꿈 · 세로 탭 · 폼 피드 · NBSP · U+1680 ·
--       U+2000~U+200A · 줄/문단 구분 U+2028 · U+2029 · U+202F · U+205F · 전각 공백 U+3000 · BOM U+FEFF). 내부 도우미.
create or replace function public.privacy_btrim(p_text text)
returns text
language sql
immutable
set search_path = ''
as $$
  select btrim(
    p_text,
    chr(9) || chr(10) || chr(11) || chr(12) || chr(13) || chr(32) || chr(160) || chr(5760)
      || chr(8192) || chr(8193) || chr(8194) || chr(8195) || chr(8196) || chr(8197) || chr(8198) || chr(8199)
      || chr(8200) || chr(8201) || chr(8202) || chr(8232) || chr(8233) || chr(8239) || chr(8287) || chr(12288)
      || chr(65279)
  );
$$;

-- 11-2. mask_label(p_text) — spec 4.11 이름표: 앞뒤 공백을 뺀 뒤 비었으면 '***', 아니면 첫 글자 + '***'(left(…, 1) = 코드 포인트 하나).
create or replace function public.mask_label(p_text text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when coalesce(public.privacy_btrim(p_text), '') = '' then '***'
    else left(public.privacy_btrim(p_text), 1) || '***'
  end;
$$;

-- 11-3. privacy_name_source(이름, 이메일) — 가린 이름의 원래 값: 표시 이름(앞뒤 공백 뺌), 비었으면 로그인 아이디(이메일의 @ 앞).
--       member_name_labels · admin_masked_member_rows 가 같은 규칙을 쓰도록 한 곳에 둔다(Edge Function admin-clear-students 도 같은 규칙).
create or replace function public.privacy_name_source(p_display_name text, p_email text)
returns text
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    nullif(public.privacy_btrim(p_display_name), ''),
    public.privacy_btrim(split_part(coalesce(p_email, ''), '@', 1)),
    ''
  );
$$;

-- 11-4. can_see_member_name(p_target) — 이 회원의 이름(별명)·사진을 온전히 볼 수 있나(③ profiles 읽기 정책이 부른다 — PUBLIC 실행).
--       참 = 본인, 또는 (로그인했고 인증 전 구글이 아니고) 대상이 [선생님(role ≠ 'user')] · [학급 없는 학생이고 내가 총괄] ·
--       [같은 학급 학생인 나(role 'user' · class_id 같음)] · [내가 그 학생의 담임(teaches_student — class_teachers + is_admin())].
--       없는 대상 · 비로그인은 거짓.
create or replace function public.can_see_member_name(p_target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    p_target is not null
    and auth.uid() is not null
    and (
      p_target = auth.uid()
      or (
        not public.is_pending_google()
        and exists (
          select 1
            from public.profiles t
           where t.id = p_target
             and (
               t.role <> 'user'
               or (t.class_id is null and public.is_super_admin())
               or (t.class_id is not null
                   and exists (
                     select 1
                       from public.profiles me
                      where me.id = auth.uid()
                        and me.role = 'user'
                        and me.class_id = t.class_id
                   ))
               or public.teaches_student(t.id)
             )
        )
      )
    ),
    false
  );
$$;

-- 11-5. can_see_member_identity(p_target) — 이 회원의 아이디(회원 명단 줄 · 감사 기록)를 볼 수 있나(② 정책이 부른다 — PUBLIC 실행).
--       참 = 그 학생의 담임(teaches_student), 또는 총괄이고 대상 프로필이 있으며 [선생님 또는 학급 없는 계정].
--       프로필이 없는 대상(고아 기록)은 총괄에게도 거짓. 관리 권한(can_manage_member)과는 따로다(보는 범위만 나눈다).
create or replace function public.can_see_member_identity(p_target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    p_target is not null
    and (
      public.teaches_student(p_target)
      or (
        public.is_super_admin()
        and exists (
          select 1
            from public.profiles t
           where t.id = p_target
             and (t.role <> 'user' or t.class_id is null)
        )
      )
    ),
    false
  );
$$;

-- 11-6. member_name_labels(p_ids) — 화면이 작성자 이름을 채울 때(embed profiles 가 null 인 작성자). 로그인한 사용자만.
--       [{"id", "display_name", "avatar_url", "withdrawn_at", "masked"}] — 앞 1000개만, 있는 프로필만, id 순.
--       로그인하지 않았거나 인증 전 구글 계정이면 [](인증 전 계정은 가린 이름도 받지 않는다 — spec 4.10).
create or replace function public.member_name_labels(p_ids uuid[])
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when auth.uid() is null or p_ids is null or public.is_pending_google() then '[]'::jsonb
    else coalesce(
      (
        select jsonb_agg(
                 case
                   when public.can_see_member_name(p.id) then
                     jsonb_build_object(
                       'id', p.id,
                       'display_name', p.display_name,
                       'avatar_url', p.avatar_url,
                       'withdrawn_at', p.withdrawn_at,
                       'masked', false
                     )
                   else
                     jsonb_build_object(
                       'id', p.id,
                       'display_name', public.mask_label(public.privacy_name_source(p.display_name, d.email)),
                       'avatar_url', null::text,
                       'withdrawn_at', p.withdrawn_at,
                       'masked', true
                     )
                 end
                 order by p.id
               )
          from public.profiles p
          left join public.member_directory d on d.id = p.id
         where p.id = any (p_ids[1:1000])
      ),
      '[]'::jsonb
    )
  end;
$$;

-- 11-7. admin_masked_member_rows(p_id) — 총괄의 회원 명단에 다른 학급 학생 줄을 가린 값으로(② 뒤 총괄은 그 줄을 표에서 읽지 못한다).
--       총괄이 아니면 []. 대상 = 회원 명단 × 프로필에서 role 'user' · 학급 있음 · 내가 그 학생의 담임이 아님(p_id 가 있으면 그 한 줄).
--       줄 모양은 회원 명단 표(src/lib/types.ts MemberRow)와 같게 + "masked": true. 아이디 · 이름은 첫 글자 + '***', 사진 없음.
--       ② 전에는 같은 줄이 표에도 있다 — 화면은 같은 id 면 표 줄을 쓴다(spec 4.11).
create or replace function public.admin_masked_member_rows(p_id uuid default null)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when not public.is_super_admin() then '[]'::jsonb
    else coalesce(
      (
        select jsonb_agg(
                 jsonb_build_object(
                   'id', d.id,
                   'email', public.mask_label(split_part(d.email, '@', 1)),
                   'provider', d.provider,
                   'providers', d.providers,
                   'signed_up_at', d.signed_up_at,
                   'last_sign_in_at', d.last_sign_in_at,
                   'updated_at', d.updated_at,
                   'class_id', p.class_id,
                   'guardian_consent_at', d.guardian_consent_at,
                   'guardian_consent_by', d.guardian_consent_by,
                   'masked', true,
                   'profiles', jsonb_build_object(
                     'display_name', public.mask_label(public.privacy_name_source(p.display_name, d.email)),
                     'avatar_url', null::text,
                     'role', p.role,
                     'withdrawn_at', p.withdrawn_at,
                     'must_change_password', p.must_change_password
                   )
                 )
                 order by d.signed_up_at desc, d.id
               )
          from public.member_directory d
          join public.profiles p on p.id = d.id
         where p.role = 'user'
           and p.class_id is not null
           and not public.teaches_student(p.id)
           and (p_id is null or d.id = p_id)
      ),
      '[]'::jsonb
    )
  end;
$$;

-- 11-8. 권한 — 판별 2개는 PUBLIC(정책이 "요청한 역할"로 부르므로 — is_admin()과 같은 방식), 화면 RPC 2개는 로그인한 사용자만,
--       글자 도우미 3개(mask_label · privacy_btrim · privacy_name_source)는 누구도 직접 부르지 않는다(위 함수 안에서만 — 소유자 권한).
revoke all on function public.privacy_btrim(text) from public, anon, authenticated;
revoke all on function public.mask_label(text) from public, anon, authenticated;
revoke all on function public.privacy_name_source(text, text) from public, anon, authenticated;
grant execute on function public.can_see_member_name(uuid) to public;
grant execute on function public.can_see_member_identity(uuid) to public;
revoke all on function public.member_name_labels(uuid[]) from public, anon, authenticated;
grant execute on function public.member_name_labels(uuid[]) to authenticated;
revoke all on function public.admin_masked_member_rows(uuid) from public, anon, authenticated;
grant execute on function public.admin_masked_member_rows(uuid) to authenticated;

-- ═════════════════════════════════════════════
-- 12. 맨 끝 점검 — 설계와 다르면 전부 되돌린다(아무것도 바뀌지 않음)
-- ═════════════════════════════════════════════
do $$
declare
  v_tables  text;
  v_before  int := nullif(current_setting('privacy_a.policy_count', true), '')::int;
  v_after   int;
  v_bad_fn  text;
  v_block   text;
  v_bad     text;
begin
  -- 12-1. pgcrypto 가 extensions 스키마에 있고 bcrypt 가 동작하는지(값은 저장하지 않는다)
  if not exists (
    select 1 from pg_extension e join pg_namespace n on n.oid = e.extnamespace
    where e.extname = 'pgcrypto' and n.nspname = 'extensions'
  ) then
    raise exception 'pgcrypto 확장이 extensions 스키마에 없습니다(다른 스키마에 깔려 있을 수 있음). 이 파일 전체를 되돌렸습니다(아무것도 바뀌지 않음) — 이 메시지를 알려 주세요.';
  end if;
  if extensions.crypt('000000', extensions.gen_salt('bf')) is null then
    raise exception 'bcrypt(extensions.crypt)가 동작하지 않습니다. 이 파일 전체를 되돌렸습니다 — 이 메시지를 알려 주세요.';
  end if;

  -- 12-2. 새 표 4개: RLS 켜짐 · 정책 0 · anon/authenticated 표 권한 없음
  select string_agg(t.n, ', ') into v_tables
    from unnest(array['member_verification', 'member_verification_attempts', 'verification_settings', 'class_cleanup_log']) as t(n)
   where not (select c.relrowsecurity from pg_class c where c.oid = ('public.' || t.n)::regclass)
      or exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = t.n)
      or has_table_privilege('anon', 'public.' || t.n, 'SELECT')
      or has_table_privilege('anon', 'public.' || t.n, 'INSERT')
      or has_table_privilege('anon', 'public.' || t.n, 'UPDATE')
      or has_table_privilege('anon', 'public.' || t.n, 'DELETE')
      or has_table_privilege('authenticated', 'public.' || t.n, 'SELECT')
      or has_table_privilege('authenticated', 'public.' || t.n, 'INSERT')
      or has_table_privilege('authenticated', 'public.' || t.n, 'UPDATE')
      or has_table_privilege('authenticated', 'public.' || t.n, 'DELETE')
      or has_table_privilege('authenticated', 'public.' || t.n, 'TRUNCATE');
  if v_tables is not null then
    raise exception '새 표의 RLS·정책·권한이 설계와 다릅니다: %. 이 파일 전체를 되돌렸습니다(아무것도 바뀌지 않음) — 이 메시지를 알려 주세요.', v_tables;
  end if;
  if has_table_privilege('service_role', 'public.verification_settings', 'SELECT') then
    raise notice '⚠ 서비스 롤이 verification_settings(코드 해시)를 읽을 수 있습니다(기본 권한) — 동작에는 문제없습니다.';
  end if;

  -- 12-3. profiles.teacher_scope 는 학생·비로그인이 읽지도 고치지도 못한다(공개 열 7개 그대로)
  if has_column_privilege('anon', 'public.profiles', 'teacher_scope', 'SELECT')
     or has_column_privilege('authenticated', 'public.profiles', 'teacher_scope', 'SELECT')
     or has_column_privilege('anon', 'public.profiles', 'teacher_scope', 'UPDATE')
     or has_column_privilege('authenticated', 'public.profiles', 'teacher_scope', 'UPDATE')
     or not has_column_privilege('anon', 'public.profiles', 'display_name', 'SELECT')
     or not has_column_privilege('authenticated', 'public.profiles', 'withdrawn_at', 'SELECT')
     or not has_column_privilege('authenticated', 'public.profiles', 'display_name', 'UPDATE') then
    raise exception 'profiles 열 권한이 설계와 다릅니다(teacher_scope 가 열려 있거나 공개 열이 빠짐). 이 파일 전체를 되돌렸습니다 — 이 메시지를 알려 주세요.';
  end if;

  -- 12-4. 이 파일은 정책을 하나도 만들거나 지우지 않는다
  select count(*)::int into v_after from pg_policies;
  if v_before is not null and v_after <> v_before then
    raise exception '정책 수가 바뀌었습니다(% → %). ①은 정책을 바꾸지 않아야 합니다. 이 파일 전체를 되돌렸습니다 — 이 메시지를 알려 주세요.', v_before, v_after;
  end if;

  -- 12-5. 함수 실행 권한
  select string_agg(x.f, ', ') into v_bad_fn
    from (values
      -- 판별 함수: 누구나(정책 평가용)
      ('public.is_full_admin()', 'anon', true),
      ('public.is_pending_google()', 'anon', true),
      ('public.is_full_admin()', 'authenticated', true),
      ('public.is_pending_google()', 'authenticated', true),
      -- 화면용 RPC: 로그인한 사용자만
      ('public.my_member_gate()', 'anon', false),
      ('public.my_member_gate()', 'authenticated', true),
      ('public.verify_google_teacher(text, text, integer)', 'anon', false),
      ('public.verify_google_teacher(text, text, integer)', 'authenticated', true),
      ('public.acknowledge_privacy(text, integer)', 'anon', false),
      ('public.acknowledge_privacy(text, integer)', 'authenticated', true),
      ('public.admin_set_teacher_code(text)', 'anon', false),
      ('public.admin_set_teacher_code(text)', 'authenticated', true),
      ('public.admin_set_contact_email(text)', 'anon', false),
      ('public.admin_privacy_overview()', 'anon', false),
      ('public.admin_member_privacy_flags()', 'anon', false),
      ('public.admin_set_teacher_scope(uuid, text)', 'anon', false),
      ('public.admin_class_cleanup_preview(uuid)', 'anon', false),
      ('public.admin_class_retention_status()', 'anon', false),
      ('public.admin_set_guardian_consent(uuid, boolean)', 'anon', false),
      ('public.admin_set_guardian_consent_class(uuid)', 'anon', false),
      ('public.admin_set_guardian_consent_class(uuid)', 'authenticated', true),
      ('public.my_admin_context()', 'anon', false),
      ('public.my_admin_context()', 'authenticated', true),
      -- 내부 도우미: 아무도
      ('public.privacy_nickname_error(text)', 'anon', false),
      ('public.privacy_nickname_error(text)', 'authenticated', false),
      -- 서비스 롤 전용
      ('public.purge_member_records(uuid)', 'anon', false),
      ('public.purge_member_records(uuid)', 'authenticated', false),
      ('public.purge_member_records(uuid)', 'service_role', true),
      ('public.admin_purge_class_member(uuid, uuid)', 'authenticated', false),
      ('public.admin_purge_class_member(uuid, uuid)', 'service_role', true),
      ('public.self_purge_member(uuid, text)', 'authenticated', false),
      ('public.self_purge_member(uuid, text)', 'service_role', true),
      ('public.admin_finish_class_cleanup(uuid, uuid, integer)', 'authenticated', false),
      ('public.admin_finish_class_cleanup(uuid, uuid, integer)', 'service_role', true),
      ('public.admin_log_member_create(uuid, uuid, text, text, boolean)', 'anon', false),
      ('public.admin_log_member_create(uuid, uuid, text, text, boolean)', 'authenticated', false),
      ('public.admin_log_member_create(uuid, uuid, text, text, boolean)', 'service_role', true),
      -- (개정 3) 기한 날짜 계산 — 내부
      ('public.privacy_retention_window(date)', 'anon', false),
      ('public.privacy_retention_window(date)', 'authenticated', false),
      -- (개정 4) 가리기: 판별 2개는 누구나(정책 평가용), 화면 RPC 2개는 로그인한 사용자만, 글자 도우미 3개는 아무도
      ('public.can_see_member_name(uuid)', 'anon', true),
      ('public.can_see_member_name(uuid)', 'authenticated', true),
      ('public.can_see_member_identity(uuid)', 'anon', true),
      ('public.can_see_member_identity(uuid)', 'authenticated', true),
      ('public.member_name_labels(uuid[])', 'anon', false),
      ('public.member_name_labels(uuid[])', 'authenticated', true),
      ('public.admin_masked_member_rows(uuid)', 'anon', false),
      ('public.admin_masked_member_rows(uuid)', 'authenticated', true),
      ('public.mask_label(text)', 'anon', false),
      ('public.mask_label(text)', 'authenticated', false),
      ('public.privacy_btrim(text)', 'anon', false),
      ('public.privacy_btrim(text)', 'authenticated', false),
      ('public.privacy_name_source(text, text)', 'anon', false),
      ('public.privacy_name_source(text, text)', 'authenticated', false)
    ) as x(f, r, want)
   where has_function_privilege(x.r, x.f, 'EXECUTE') <> x.want;
  if v_bad_fn is not null then
    raise exception '함수 실행 권한이 설계와 다릅니다: %. 이 파일 전체를 되돌렸습니다(아무것도 바뀌지 않음) — 이 메시지를 알려 주세요.', v_bad_fn;
  end if;
  if to_regprocedure('public.admin_log_member_create(uuid, uuid, text, text)') is not null then
    raise exception '옛 4-인자 admin_log_member_create 가 남아 있습니다(호출이 모호해짐). 이 파일 전체를 되돌렸습니다 — 이 메시지를 알려 주세요.';
  end if;

  -- 12-6. 완전 삭제·학급 정리를 막는 외래키(profiles 를 가리키는 restrict / no action)가 없는지 — ⑦ · ⑧ 끝 점검과 같은 조건
  select string_agg(format('%s.%s (%s)', n.nspname, c.relname, con.conname), ', ')
    into v_block
    from pg_constraint con
    join pg_class c on c.oid = con.conrelid
    join pg_namespace n on n.oid = c.relnamespace
   where con.contype = 'f'
     and con.confrelid in ('public.profiles'::regclass, 'public.community_posts'::regclass, 'public.community_comments'::regclass)
     and con.confdeltype in ('r', 'a');
  if v_block is not null then
    raise exception '계정 삭제를 막는 외래키가 있습니다: %. 이 파일 전체를 되돌렸습니다 — 이 메시지를 알려 주세요.', v_block;
  end if;

  -- 12-7. (개정 4) 가린 글자 규칙 자체 시험 — 값만 계산한다(표를 읽거나 쓰지 않음). Edge Function admin-clear-students 의
  --       maskLabel(nameSource(…)) 와 같은 결과여야 한다(build-5-report.md 시험 표와 같은 예).
  select string_agg(x.label, ', ') into v_bad
    from (values
      ('null',         public.mask_label(null),                                         '***'),
      ('빈 값',        public.mask_label(''),                                           '***'),
      ('공백만',       public.mask_label('   '),                                        '***'),
      ('앞뒤 공백',    public.mask_label('  2026a '),                                   '2***'),
      ('한글',         public.mask_label('김철수'),                                     '김***'),
      ('전각 공백·탭', public.mask_label(chr(12288) || '홍길동' || chr(9)),             '홍***'),
      ('이모지',       public.mask_label(chr(128512) || 'ab'),                          chr(128512) || '***'),
      ('별표',         public.mask_label('*'),                                          '****'),
      ('이름 빔→아이디', public.privacy_name_source('  ', '2026a@class1.local'),        '2026a'),
      ('이름 있음',    public.privacy_name_source(' 별명 ', '2026a@class1.local'),      '별명'),
      ('둘 다 없음',   public.privacy_name_source(null, null),                          ''),
      ('가린 아이디',  public.mask_label(split_part('2026a@class1.local', '@', 1)),      '2***'),
      ('가린 이름',    public.mask_label(public.privacy_name_source(null, 'k***')),     'k***')
    ) as x(label, got, want)
   where x.got is distinct from x.want;
  if v_bad is not null then
    raise exception '가린 글자 규칙(mask_label · privacy_name_source) 자체 시험이 설계와 다릅니다: %. 이 파일 전체를 되돌렸습니다 — 이 메시지를 알려 주세요.', v_bad;
  end if;

  -- 12-8. (개정 3) 학급 정리 기한 날짜 계산 자체 시험 — 날짜 11개(3월 1일 · 1월 · 2월 1·10·28일 · 윤년 2월 1·29일 · 12월 31일 등)
  select string_agg(x.d::text, ', ') into v_bad
    from (values
      (date '2026-03-01', date '2026-03-01', date '2026-02-01', null::date,        null::date,        date '2026-02-28', true,  false),
      (date '2026-10-20', date '2026-03-01', date '2026-02-01', null,              null,              date '2026-02-28', true,  false),
      (date '2026-12-31', date '2026-03-01', date '2026-02-01', null,              null,              date '2026-02-28', true,  false),
      (date '2027-01-15', date '2026-03-01', date '2026-02-01', null,              null,              date '2026-02-28', true,  false),
      (date '2027-02-01', date '2026-03-01', date '2026-02-01', date '2026-02-01', date '2027-02-01', date '2027-02-28', false, true),
      (date '2027-02-10', date '2026-03-01', date '2026-02-01', date '2026-02-01', date '2027-02-01', date '2027-02-28', false, true),
      (date '2027-02-28', date '2026-03-01', date '2026-02-01', date '2026-02-01', date '2027-02-01', date '2027-02-28', false, true),
      (date '2027-03-01', date '2027-03-01', date '2027-02-01', null,              null,              date '2027-02-28', true,  false),
      (date '2028-02-01', date '2027-03-01', date '2027-02-01', date '2027-02-01', date '2028-02-01', date '2028-02-28', false, true),
      (date '2028-02-29', date '2027-03-01', date '2028-02-01', null,              null,              date '2028-02-28', true,  false),
      (date '2028-03-01', date '2028-03-01', date '2028-02-01', null,              null,              date '2028-02-28', true,  false)
    ) as x(d, sy, over_before, feb_from, feb_before, deadline, past, in_feb)
   where (public.privacy_retention_window(x.d) ->> 'school_year_start')::date is distinct from x.sy
      or (public.privacy_retention_window(x.d) ->> 'overdue_before')::date is distinct from x.over_before
      or (public.privacy_retention_window(x.d) ->> 'february_from')::date is distinct from x.feb_from
      or (public.privacy_retention_window(x.d) ->> 'february_before')::date is distinct from x.feb_before
      or (public.privacy_retention_window(x.d) ->> 'deadline')::date is distinct from x.deadline
      or (public.privacy_retention_window(x.d) ->> 'past_deadline')::boolean is distinct from x.past
      or (public.privacy_retention_window(x.d) ->> 'in_february')::boolean is distinct from x.in_feb;
  if v_bad is not null then
    raise exception '학급 정리 기한 날짜 계산(privacy_retention_window) 자체 시험이 설계와 다릅니다: %. 이 파일 전체를 되돌렸습니다 — 이 메시지를 알려 주세요.', v_bad;
  end if;

  raise notice '✔ ① 개인정보 표·열·함수를 더했습니다(사이트 동작은 그대로). 다음: Edge Function 3개 배포 → 사이트 push → 총괄이 ''개인정보 설정''에서 코드·문의 이메일 입력 → ② → ③.';
end $$;

-- PostgREST 가 새 표·열·함수를 바로 알도록(대시보드도 대개 자동으로 하지만 한 번 더)
notify pgrst, 'reload schema';
