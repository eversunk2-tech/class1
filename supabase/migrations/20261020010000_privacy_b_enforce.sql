-- 개인정보 처리방침 · 구글 가입 교사 인증 · 보호자 동의 ② — 켜기(기존 정책·함수·트리거를 바꾼다)
-- 설계: docs/privacy/spec.md(머리말 개정 1~4와 1.1 결정표가 본문보다 우선) — 4.3~4.6 · 4.9 · 4.11(개정 4 — 학생 아이디 가리기)
-- 지침: docs/privacy/build-1-sql-instructions.md · build-5-sql-instructions.md(개정 4)
-- 보고: docs/privacy/build-1-report.md · build-5-report.md(개정 4)
-- 비상 되돌리기: docs/privacy/rollback-privacy-enforce.sql (③을 실행했으면 docs/privacy/rollback-profiles-members-only.sql 먼저)
--
-- ▶ 실행 순서(spec 7절)
--   이미 한 것: ① 20261020000000_privacy_a_schema.sql · Edge Function 3개 배포 · 사이트 push ·
--              총괄이 '개인정보 설정'에서 교사 인증 코드와 문의 이메일을 넣음
--   → 아래 "실행 전 확인"(읽기만) → 이 파일 → "실행 후 확인" → 곧바로 같은 자리에서
--     ③ 20261020020000_privacy_c_profiles_members_only.sql → ③의 확인 쿼리.
--   ②와 ③ 사이에는 구글 로그인 시험을 하지 않는다(그사이 창의 처리방침 링크가 "준비 중"이다 — R16).
--   ⚠ 이 파일을 적용한 뒤에는 앞선 마이그레이션(20260921… ~ 20260928…)을 다시 실행하지 않는다 — 옛 정책·함수
--     (교사 누구나 학습게임 관리·블로그·칭찬 문구, 인증 전 계정 제한 없음)가 되살아나 권한이 소리 없이 넓어진다(R7).
--     되돌리기는 docs/privacy/rollback-privacy-enforce.sql 로만.
--
-- ▶ 실행 방법
--   Supabase 대시보드 > SQL Editor > New query 에 이 파일 전체를 붙여넣고 Run.
--   SQL Editor 는 붙여 넣은 전체를 한 트랜잭션으로 실행하므로 중간에 오류가 나면 아무것도 바뀌지 않는다.
--   (psql 등 다른 도구로 실행할 때는 psql -1 -v ON_ERROR_STOP=1 -f <파일> 처럼 "한 트랜잭션 + 오류 시 멈춤"으로.)
--   · "destructive operation(drop)" 확인 창이 뜨면 Run — 정책만 지우고 곧바로 다시 만든다. 표·행은 지우지 않는다.
--   · 맨 앞 점검: ①이 안 됐거나, 총괄이 없거나, 교사 인증 코드·문의 이메일이 아직 없으면(④ 화면 입력 전) 오류를 내고
--     아무것도 바꾸지 않는다(관리자 잠김 · 아무도 인증할 수 없는 창 · 빈 문의 이메일 방지).
--     고침 2(N1): 이메일 모양 아이디(@class1.local 이 아닌데 이메일·비밀번호 로그인이 있는) 계정이 있어도 멈춘다(아래 실행 전 확인 E)).
--   · 맨 끝 점검: 학급 밖 표(spec 4.6)에 is_admin() 만 쓰는 허용 정책이 남거나, 제한 정책 19개 · 좁힌 정책 20개 · 함수 본문 ·
--     가린 이메일·이름 · (개정 4) 회원 명단 · 감사 기록 3개의 읽기 정책이 설계와 다르면 오류를 내고 전부 되돌린다.
--     성공하면 "✔ ② …" 알림이 나온다.
--   · 여러 번 실행해도 안전하다(drop policy if exists + create policy, create or replace function, 백필은 빈 것·가리지 않은 것만).
--   ⚠ select public.admin_set_role(…) 같은 RPC 를 SQL Editor 에서 부르지 않는다(auth.uid()가 없다 — 화면에서 시험).
--
-- ▶ 이 파일이 하는 일
--   1-0. (고침 1) profiles 수정 권한을 별명(display_name)만으로 — 사진 주소는 아무도 직접 못 고친다(사용자 결정). ⚠ 이 파일 앞에
--      '프로필 수정' 창이 별명만 보내는 새 화면이 배포돼 있어야 한다(예전 창은 사진 주소도 보내 저장이 42501 로 실패).
--   1. 함수·트리거 다시 정의(본문은 지금 정의 그대로 + 표시한 곳만):
--      handle_new_user        — 아이디 계정(이메일이 @class1.local — 관리자가 만든 학생·교사)이 아닌 새 가입(구글 · 실제 이메일로
--                               스스로 가입 — 고침 1 M3·M4)은 프로필을 중립 값('인증 전 회원', 사진 없음)으로 만들고
--                               member_verification(origin 'new') 한 줄을 만든다(구글 실명·사진을 공개 프로필에 복사하지 않음).
--                               아이디 계정은 지금과 같다.
--      sync_member_directory  — 이메일이 @class1.local 이 아니면 member_directory.email 을 첫 글자 + '***'(k***)로만 저장.
--      can_browse             — 인증 전 구글 계정은 "비로그인처럼"(로그인 잠금이 켜지면 공개 글을 못 읽음 — spec 3.8).
--      admin_set_role         — 담임 지정·해제 때 teacher_scope 를 'full'로(spec 3.6 · 4.6 #26).
--                               (개정 4) 다른 학급 학생(학급 있음 · 내가 담임이 아님)을 교사로 지정하면 거부 — 지정하면 그 학생의
--                               이름·아이디가 모두에게 보이게 되므로.
--      record_post_read · get_or_create_feedback_thread — 인증 전 구글 계정이면 기록하지 않음 / 거부.
--      학습게임 관리 RPC 4개(set_community_post_hidden · set_community_comment_hidden · set_community_report_status ·
--        resolve_community_reports_for) — 학습게임 것은 모든 교사 권한(is_full_admin)일 때만. 게시판 것은 그대로(can_manage_board).
--   2. 기존 회원 백필: ① 구글 계정의 member_directory.email 가리기 ② 기존 구글 계정(탈퇴 처리 안 됨)에 member_verification
--      (origin 'existing') ③ 인증 전 구글 계정(role user)의 이름 → '인증 전 회원', 사진 주소 → 비움(사용자 확정, 질문 4).
--      고침 1: ④ 구글 등 계정 모두(관리자·총괄 포함)와 학생 모두의 사진 주소 → 비움(M1 · 사용자 결정) ⑤ 별명을 아직 정하지 않은
--      구글 등 관리자(총괄 포함)의 이름 → '선생님'(M1 — 확인 창에서 별명을 정하면 그 별명) ⑥ 계정 만들기 기록의 처리자 이름을
--      그 계정의 지금 표시 이름으로(L14) ⑦ 감사 기록(탈퇴·계정 만들기)에 남은 구글 등 이메일·이름 → 첫 글자 + '***'(M2).
--      "구글 등 계정" = 이메일이 @class1.local 이 아닌 계정(고침 1 M3·M4 — 총괄이 실제 이메일로 로그인하면 총괄도).
--      ⚠ 가린 이메일·이름·사진은 되돌릴 수 없다(로그인 서비스(auth)에는 남아 있음 — 결정 10·12, R10).
--   3. 인증 전 구글 계정의 쓰기 막기 — RESTRICTIVE 정책 19개(spec 4.5. 허용 정책에 AND 로 붙어 인증 전이 아닌 사람에게는 효과 없음.
--      이름은 "<표>: 인증 전 쓰기 제한(추가|수정)" — 한 표에 둘이 있을 수 있어 명령을 괄호로 붙였다. Storage 는
--      "game-uploads: 인증 전 업로드 제한"). DELETE 는 막지 않는다(인증 전 기존 회원이 자기 옛 글을 지우는 것은 허용).
--   4. "자기 학급 일만" — 학급 밖 교사 권한을 주는 정책 20개(public 18 + storage 2)의 is_admin() → is_full_admin()(spec 4.6 #1~9 · 14~24).
--      바꾸는 것은 is_admin() 뿐이고 나머지 조건·이름·대상 역할은 지금 정의와 글자 그대로다.
--      그대로 두는 것: praise_presets 조회(학급 선생님도 칭찬 보내기에 문구를 읽음), 학급 안 일(과제 · 선생님 글 · 학급 · 학생 기록 ·
--      자기 게시판 — 이미 학급 기준), community_posts_guard 트리거(INSERT 정책이 이미 글쓴이 = 나를 강제).
--   5. (개정 4 — spec 4.11) 학생 아이디 가리기 — 보는 범위만 좁히고 관리 권한(can_manage_member)은 그대로다:
--      member_directory · password_reset_log · member_withdrawal_log · member_create_log 의 읽기 정책 "…: 담임·총괄 조회"
--      (can_manage_member) → "…: 학생은 담임만 조회"(①의 can_see_member_identity — 학생 줄은 그 학생의 담임만, 총괄은 선생님 ·
--      학급 없는 계정 줄만. 총괄의 회원 명단에서 다른 학급 학생 줄은 ①의 admin_masked_member_rows 가 첫 글자 + '***'로 준다.
--      감사 기록은 그 학생의 담임만 읽는다). admin_must_change_password_ids() 도 같은 범위(can_see_member_identity)로.
--      총괄은 가린 줄에서도 비밀번호 초기화 · 탈퇴 처리 · 기록까지 삭제를 계속 한다(Edge Function — 서비스 롤, 사용자 답 ④).
--   · 재귀(42P17) 없음: 새로 부르는 함수 is_pending_google() · is_full_admin() 은 security definer 로 profiles · member_verification 만
--     읽는다. 어느 정책도 그 표들을 다시 읽지 않는다(profiles 정책은 ③에서도 is_pending_google()만 부른다 — security definer).
--
-- ▶ 실행 전 확인(그냥 Run = postgres 권한, 읽기만)
--   -- A) 구글 등 아이디 계정이 아닌(이메일이 @class1.local 이 아닌 — 고침 1) 계정 수 — 역할별 · 탈퇴 여부 · 학급 유무.
--   --    "학급있는_학생"이 0이 아니면 알려 주세요(구글 · 실제 이메일로 로그인하는 학생 — 인증 전으로 묶지 않고 그대로 둔다).
--   --    총괄이 실제 이메일(구글 또는 이메일·비밀번호)로 로그인하면 여기 admin 줄에 들어간다 — 처음 접속 때 확인 창(3-1)이 뜬다.
--   select p.role, p.withdrawn_at is not null as 탈퇴, p.class_id is not null as 학급있는_학생, count(*) as 구글_계정
--   from public.profiles p join public.member_directory d on d.id = p.id
--   where lower(coalesce(d.email, '')) not like '%@class1.local'
--     and (coalesce(d.email, '') <> '' or coalesce(d.provider, '') <> '' or cardinality(coalesce(d.providers, '{}'::text[])) > 0)
--   group by 1, 2, 3 order by 1, 2, 3;
--   -- B) 총괄 · 코드 · 문의 이메일(모두 true 여야 이 파일이 실행된다)
--   select exists (select 1 from public.profiles where is_super_admin and role = 'admin') as 총괄_있음,
--          (select code_hash is not null from public.verification_settings where id) as 코드_있음,
--          (select contact_email is not null from public.site_settings where id) as 문의_이메일_있음;
--   -- C) 가입 방식을 모르는 계정(회원 명단 줄이 없거나 방식이 비어 있음) — 보통 0. 이 계정은 백필하지 않는다.
--   select count(*) as 방식_모름
--   from public.profiles p left join public.member_directory d on d.id = p.id
--   where d.id is null
--      or (coalesce(d.email, '') = '' and coalesce(d.provider, '') = '' and cardinality(coalesce(d.providers, '{}'::text[])) = 0);
--   -- D) (고침 1 — M2) 감사 기록에 남은 아이디 계정이 아닌 이메일(구글 등) — 이 파일이 첫 글자 + *** 로 가린다(수만 본다)
--   select (select count(*) from public.member_withdrawal_log
--            where position('@' in coalesce(target_email, '')) > 0 and lower(target_email) not like '%@class1.local') as 탈퇴기록,
--          (select count(*) from public.member_create_log
--            where position('@' in coalesce(target_email, '')) > 0 and lower(target_email) not like '%@class1.local') as 생성기록;
--   -- E) (고침 2 — N1) 이메일 모양 아이디(또는 이메일로 스스로 가입한) 계정 수 — 0 이어야 이 파일이 실행된다(맨 앞 점검과 같은 셈).
--   --    결과 줄이 없으면 0. 줄이 있으면 이 파일을 Run 하지 말고 그 수를 알려 주세요(역할별 수만 — 이메일은 보지 않는다).
--   select p.role, count(*) as 이메일모양_계정
--   from auth.users u left join public.profiles p on p.id = u.id
--   where lower(coalesce(u.email, '')) not like '%@class1.local'
--     and (coalesce(u.raw_app_meta_data ->> 'provider', '') = 'email'
--          or (jsonb_typeof(u.raw_app_meta_data -> 'providers') = 'array' and (u.raw_app_meta_data -> 'providers') ? 'email')
--          or exists (select 1 from auth.identities i where i.user_id = u.id and i.provider = 'email'))
--     and not exists (select 1 from public.member_verification v where v.user_id = u.id)
--   group by 1 order by 1;
--
-- ▶ 실행 후 확인 쿼리(앞의 "-- "를 지우고 한 덩어리씩 Run — 모두 읽기만 한다). 흉내 시험은 docs/privacy/test-queries.sql.
--   -- 1) member_verification 행 = A)의 (탈퇴 아님 · 학급있는_학생 아님) 구글 계정 수 · 인증 전(role user) 수
--   select count(*) as 행, count(*) filter (where v.verified_at is null and p.role = 'user') as 인증_전,
--          count(*) filter (where p.role = 'admin') as 구글_관리자
--   from public.member_verification v join public.profiles p on p.id = v.user_id;
--   -- 2) 아이디 계정이 아닌 이메일이 모두 가려졌는지(0) — '@'가 남았는데 @class1.local 이 아닌 줄(회원 명단 · 감사 기록 2개)
--   select (select count(*) from public.member_directory d
--            where position('@' in d.email) > 0 and lower(d.email) not like '%@class1.local') as 명단_0,
--          (select count(*) from public.member_withdrawal_log
--            where position('@' in coalesce(target_email, '')) > 0 and lower(target_email) not like '%@class1.local') as 탈퇴기록_0,
--          (select count(*) from public.member_create_log
--            where position('@' in coalesce(target_email, '')) > 0 and lower(target_email) not like '%@class1.local') as 생성기록_0;
--   -- 2-2) (고침 1·2) 사진 주소가 남은 구글 등 계정 · 학생(0), 별명을 정하지 않았는데 이름이 구글이 준 이름 그대로인 구글 등 관리자(0),
--   --      아이디 계정(@class1.local)인데 인증 전 줄이 있는 계정(0 — 관리자가 만든 계정이 인증 전으로 묶이지 않았는지)
--   select (select count(*) from public.profiles p left join public.member_directory d on d.id = p.id
--            where p.avatar_url is not null and (p.role = 'user' or lower(coalesce(d.email, '')) not like '%@class1.local')) as 사진_0,
--          (select count(*) from public.profiles p join public.member_directory d on d.id = p.id join auth.users u on u.id = p.id
--            where p.role = 'admin' and p.display_name is distinct from '선생님' and lower(d.email) not like '%@class1.local'
--              and not exists (select 1 from public.member_verification v where v.user_id = p.id and v.ack_at is not null)
--              and (nullif(btrim(coalesce(p.display_name, '')), '') is null   -- 고침 2: 이름이 아직 구글이 준 이름(또는 빈 값)
--                   or btrim(p.display_name) in (btrim(left(coalesce(u.raw_user_meta_data ->> 'full_name', ''), 50)),
--                                                btrim(left(coalesce(u.raw_user_meta_data ->> 'name', ''), 50)),
--                                                btrim(left(split_part(coalesce(u.email, ''), '@', 1), 50))))) as 관리자이름_0,
--          (select count(*) from public.member_verification v join public.member_directory d on d.id = v.user_id
--            where lower(d.email) like '%@class1.local') as 아이디계정_인증행_0,
--          has_column_privilege('authenticated', 'public.profiles', 'avatar_url', 'UPDATE') as 사진수정권한_false;
--   -- 3) 인증 전 구글 계정의 이름·사진(0) — '인증 전 회원'이 아니거나 사진 주소가 남은 줄
--   select count(*) as 가리지_않은_이름_사진
--   from public.member_verification v join public.profiles p on p.id = v.user_id
--   where v.verified_at is null and p.role = 'user' and (p.display_name is distinct from '인증 전 회원' or p.avatar_url is not null);
--   -- 4) 제한 정책 19개(public 18 + storage 1)
--   select schemaname, tablename, policyname, cmd from pg_policies
--   where permissive = 'RESTRICTIVE' and (qual like '%is_pending_google%' or with_check like '%is_pending_google%')
--   order by 1, 2, 4;
--   -- 5) 학급 밖 표에 is_admin() 만 쓰는 허용 정책 — "praise_presets: 관리자만 조회" 한 줄만 나와야 한다
--   select schemaname, tablename, policyname, cmd from pg_policies
--   where permissive = 'PERMISSIVE'
--     and ((schemaname = 'public' and tablename in ('posts', 'comments', 'praise_presets', 'community_posts',
--                                                    'community_comments', 'community_likes', 'community_reports'))
--       or (schemaname = 'storage' and tablename = 'objects' and policyname like 'game-uploads%'))
--     and position('is_admin()' in coalesce(qual, '') || coalesce(with_check, '')) > 0;
--   -- 6) 함수 권한 — true, true, false(정책 평가용 판별 함수는 누구나, 인증 RPC 는 비로그인 불가)
--   select has_function_privilege('anon', 'public.can_browse()', 'execute') as 잠금게이트_anon,
--          has_function_privilege('anon', 'public.is_pending_google()', 'execute') as 인증전판별_anon,
--          has_function_privilege('anon', 'public.verify_google_teacher(text, text, integer)', 'execute') as 인증_anon;
--   -- 7) (개정 4) 회원 명단 · 감사 기록 3개의 읽기 정책 — 표마다 "…: 학생은 담임만 조회" 한 줄 · {authenticated} ·
--   --    조건 can_see_member_identity(…)(4행). 옛 "…: 담임·총괄 조회"가 보이면 안 된다.
--   select tablename, policyname, cmd, roles, qual from pg_policies
--   where schemaname = 'public'
--     and tablename in ('member_directory', 'password_reset_log', 'member_withdrawal_log', 'member_create_log')
--   order by 1;

-- ═════════════════════════════════════════════
-- 0. 맨 앞 점검 — 하나라도 안 되면 아무것도 바꾸지 않는다
-- ═════════════════════════════════════════════
do $$
declare
  v_class_oauth int;
  v_unknown     int;
  v_email_like  int;
begin
  if to_regclass('public.member_verification') is null
     or to_regclass('public.member_verification_attempts') is null
     or to_regclass('public.verification_settings') is null
     or to_regclass('public.class_cleanup_log') is null
     or to_regprocedure('public.is_pending_google()') is null
     or to_regprocedure('public.is_full_admin()') is null
     or to_regprocedure('public.verify_google_teacher(text, text, integer)') is null
     or to_regprocedure('public.purge_member_records(uuid)') is null
     -- 개정 4: ①에 더한 가리기 함수(이 파일의 회원 명단 · 감사 기록 정책이 부른다)
     or to_regprocedure('public.can_see_member_identity(uuid)') is null
     or to_regprocedure('public.admin_masked_member_rows(uuid)') is null
     -- 고침 1: 감사 기록 가리기(2-7)가 부르는 ①의 가린 글자 함수
     or to_regprocedure('public.mask_label(text)') is null
     or not exists (
       select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'profiles' and column_name = 'teacher_scope'
     )
     or not exists (
       select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'site_settings' and column_name = 'contact_email'
     ) then
    raise exception '먼저 ① 20261020000000_privacy_a_schema.sql 을 실행해 주세요. 이 파일은 아무것도 바꾸지 않았습니다.';
  end if;

  -- 이 파일이 다시 쓰는 정책·함수의 "지금 정의"가 있는지(반별 권한 ③ · 과제·글 ⑤ · 게시판 ⑧이 적용된 상태가 전제)
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'community_posts'
                   and policyname = 'community_posts: 읽기(게시판은 담임별)')
     or not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'posts'
                   and policyname = 'posts: 쓴 교사·총괄만 수정')
     or not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'app_results'
                   and policyname = 'app_results: 본인 또는 담임 조회')
     or to_regprocedure('public.can_manage_board(uuid)') is null then
    raise exception '앞선 마이그레이션(③ classes_rls · ⑤ content_owner_only · ⑧ teacher_boards)이 적용된 상태가 아닙니다. 이 파일은 아무것도 바꾸지 않았습니다 — 이 메시지를 알려 주세요.';
  end if;

  if not exists (select 1 from public.profiles where is_super_admin and role = 'admin') then
    raise exception '총괄 관리자가 없습니다(docs/classes/setup-owl-class.sql). 이 파일은 아무것도 바꾸지 않았습니다 — 총괄 없이 켜면 코드·이메일을 관리할 사람이 없습니다.';
  end if;

  if not exists (select 1 from public.verification_settings where id = true and code_hash is not null) then
    raise exception '교사 인증 코드가 아직 없습니다. 총괄 선생님이 관리자 화면 ''개인정보 설정''에서 코드(숫자 6자리)를 먼저 정해 주세요. 이 파일은 아무것도 바꾸지 않았습니다(코드 없이 켜면 아무도 인증할 수 없습니다).';
  end if;

  if not exists (select 1 from public.site_settings where id = true and nullif(btrim(coalesce(contact_email, '')), '') is not null) then
    raise exception '문의 이메일이 아직 없습니다. 총괄 선생님이 관리자 화면 ''개인정보 설정''에서 문의 이메일을 먼저 넣어 주세요. 이 파일은 아무것도 바꾸지 않았습니다.';
  end if;

  -- 고침 2(검토 R1 N1): 이메일 모양 아이디 계정 — 이메일이 @class1.local 로 끝나지 않는데 이메일·비밀번호 로그인(가입 방식 ·
  -- 연결된 방식 · 로그인 수단(auth.identities)에 'email')이 있는 계정. 이 파일의 판정(아이디 계정 = @class1.local)으로는 구글처럼
  -- '인증 전'으로 묶여 기록 저장이 막히므로, 하나라도 있으면 멈춘다(그때 따로 고친다). 이미 member_verification 줄이 있는 계정
  -- (② 뒤 스스로 가입한 실제 이메일 계정 — 이미 '인증 전'으로 다룸)은 세지 않아 ②를 다시 실행해도 막히지 않는다.
  -- 총괄이 실제 이메일 + 비밀번호로 로그인하는 계정이어도 여기서 센다.
  select count(*) into v_email_like
  from auth.users u
  where lower(coalesce(u.email, '')) not like '%@class1.local'
    and (
      coalesce(u.raw_app_meta_data ->> 'provider', '') = 'email'
      or (jsonb_typeof(u.raw_app_meta_data -> 'providers') = 'array' and (u.raw_app_meta_data -> 'providers') ? 'email')
      or exists (select 1 from auth.identities i where i.user_id = u.id and i.provider = 'email')
    )
    and not exists (select 1 from public.member_verification v where v.user_id = u.id);
  if v_email_like > 0 then
    raise exception '이메일 모양 아이디(또는 이메일로 스스로 가입한) 계정이 %개 있어 멈췄습니다. 이대로 ②를 실행하면 이 계정이 구글처럼 ''인증 전''으로 묶여 기록 저장이 막힙니다. 이 메시지를 알려 주세요(아무것도 바뀌지 않았습니다).', v_email_like;
  end if;

  -- 알림만: 학급이 있는 구글 등 계정(구글 · 실제 이메일로 로그인하는 학생 — 설계에 없는 경우)은 인증 전으로 묶지 않고 그대로 둔다.
  select count(*) into v_class_oauth
  from public.profiles p join public.member_directory d on d.id = p.id
  where p.role = 'user' and p.class_id is not null
    and lower(coalesce(d.email, '')) not like '%@class1.local'
    and (coalesce(d.email, '') <> '' or coalesce(d.provider, '') <> '' or cardinality(coalesce(d.providers, '{}'::text[])) > 0);
  if v_class_oauth > 0 then
    raise notice '⚠ 학급이 있는 구글 등 계정(이메일이 @class1.local 이 아님) %개 — 구글 · 실제 이메일로 로그인하는 학생으로 보여 인증 전으로 묶지 않았습니다(이름은 그대로, 사진 주소는 비움). 이 수를 알려 주세요.', v_class_oauth;
  end if;

  select count(*) into v_unknown
  from public.profiles p left join public.member_directory d on d.id = p.id
  where d.id is null
     or (coalesce(d.email, '') = '' and coalesce(d.provider, '') = '' and cardinality(coalesce(d.providers, '{}'::text[])) = 0);
  if v_unknown > 0 then
    raise notice '⚠ 가입 방식을 모르는 계정 %개(회원 명단 줄이 없거나 방식이 빔) — 백필하지 않았습니다. 이 수를 알려 주세요.', v_unknown;
  end if;
end $$;

-- ═════════════════════════════════════════════
-- 1. 함수·트리거 다시 정의 (+ 1-0 프로필 수정 권한)
-- ═════════════════════════════════════════════

-- 1-0. (고침 1 — 사용자 결정 "프로필 사진 주소를 받지 않음") profiles 수정 권한을 별명(display_name)만으로.
--      사진 주소(avatar_url)는 아무도 직접 고치지 못한다(security definer 함수가 비우는 것은 그대로). 표 단위 revoke 는 열 단위 권한도
--      함께 거둔다 → 아래 grant 하나만 남는다(재실행해도 같은 결과). ①은 첫 실행 때 (display_name, avatar_url)을 그대로 둔다
--      (① 뒤 · 새 화면 배포 전 예전 '프로필 수정' 창이 깨지지 않게) — 이 파일 앞에 새 화면(별명만 보내는 창)이 배포돼 있어야 한다.
--      되돌리기: docs/privacy/rollback-privacy-enforce.sql 3-19(권한만 — 비운 사진 주소는 되살리지 않음).
revoke update on public.profiles from anon, authenticated;
grant update (display_name) on public.profiles to authenticated;

-- 1-1. handle_new_user (지금 정의: 20260923000000 §6) — 구글 새 가입은 중립 프로필 + member_verification(origin 'new').
--      고침 1(검토 R1 M3·M4): 아이디 계정 = **이메일이 '@class1.local'로 끝나는 계정**(대소문자 무시 — 관리자가 만든 학생·교사,
--      src/lib/auth.ts LOGIN_EMAIL_DOMAIN). 가입 순간(INSERT)의 app_metadata(provider)에 기대지 않는다(M3 — 채워지는 때를 확인하지 못함).
--      그 밖(구글 · 실제 이메일로 스스로 가입한 이메일·비밀번호 계정(M4 — Supabase 가입 허용) · 방식을 모름)은 모두 인증 전 계정으로
--      시작한다 — 안전한 쪽. 이 판정은 sync_member_directory(1-2) · 백필(2절) · 맨 끝 점검(6절)이 함께 쓴다.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id_login boolean;
begin
  v_id_login := lower(coalesce(new.email, '')) like '%@class1.local';

  if v_id_login then
    -- 아이디 계정(관리자가 만든 학생·교사): 지금과 같다. 단 사진 주소는 받지 않는다(고침 1 — 사용자 결정 — 늘 null).
    insert into public.profiles (id, display_name, avatar_url)
    values (
      new.id,
      left(coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)), 50),
      null
    )
    on conflict (id) do nothing;
  else
    -- 구글 새 가입: 구글 이름·사진을 복사하지 않는다(결정 10) → 인증 창에서 별명을 정한다
    insert into public.profiles (id, display_name, avatar_url)
    values (new.id, '인증 전 회원', null)
    on conflict (id) do nothing;
    insert into public.member_verification (user_id, origin)
    select new.id, 'new'
    where exists (select 1 from public.profiles p where p.id = new.id)
    on conflict (user_id) do nothing;
  end if;
  return new;
end;
$$;

-- 1-2. sync_member_directory (지금 정의: 20260921020000 §4.2) — 구글 계정 이메일은 첫 글자 + '***'만(결정 12).
--      로그인할 때마다 다시 돌아도 가린 값만 들어간다. 아이디 계정(아이디@class1.local)은 그대로.
--      고침 1(M3·M4): 가릴지는 이메일 도메인으로 본다 — '@class1.local'이 아니면 구글이든 스스로 가입한 실제 이메일이든 가린다.
create or replace function public.sync_member_directory()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_provider  text := new.raw_app_meta_data ->> 'provider';
  v_providers text[];
  v_email     text := coalesce(new.email, '');
begin
  -- profiles 행이 아직 없으면(트리거 순서 이상 등) 가입 자체를 막지 않도록 건너뛴다.
  -- on_auth_user_created(handle_new_user)가 이름순으로 먼저 실행되므로 정상적으로는 항상 존재한다.
  if not exists (select 1 from public.profiles where id = new.id) then
    return new;
  end if;

  v_providers := coalesce(
    (select array_agg(x) from jsonb_array_elements_text(
      case when jsonb_typeof(new.raw_app_meta_data -> 'providers') = 'array'
           then new.raw_app_meta_data -> 'providers' else '[]'::jsonb end
    ) as x),
    '{}'
  );

  -- 아이디 계정(@class1.local)이 아닌 계정(구글 · 실제 이메일 가입 등)의 이메일은 가린다(k***) — 고침 1(M3·M4)
  if v_email <> '' and lower(v_email) not like '%@class1.local' then
    v_email := left(split_part(v_email, '@', 1), 1) || '***';
  end if;

  insert into public.member_directory (id, email, provider, providers, signed_up_at, last_sign_in_at)
  values (
    new.id,
    v_email,
    v_provider,
    v_providers,
    new.created_at,
    new.last_sign_in_at
  )
  on conflict (id) do update set
    email = excluded.email,
    provider = excluded.provider,
    providers = excluded.providers,
    last_sign_in_at = excluded.last_sign_in_at,
    updated_at = now();
  return new;
end;
$$;

revoke all on function public.sync_member_directory() from public, anon, authenticated;

-- 1-3. can_browse (지금 정의: 20260923010000 §2) — 인증 전 구글 계정은 비로그인처럼(spec 3.8).
--      잠금이 꺼져 있으면 지금과 같다(누구나 읽음). PUBLIC 실행 유지(review S1).
create or replace function public.can_browse()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (auth.uid() is not null and not public.is_pending_google()) or not public.login_required();
$$;

grant execute on function public.can_browse() to public;

-- 1-4. admin_set_role (지금 정의: 20260927010000 §5-2) — 담임 지정·해제 때 teacher_scope = 'full'(spec 3.6 · 4.6 #26).
--      총괄이 지정한 교사는 모든 교사 권한(코드 없이). 나머지는 글자 그대로.
--      개정 4(spec 4.11): 다른 학급 학생(학급 있음 · 내가 그 학생의 담임이 아님 — 총괄에게 이름·아이디가 가려진 학생)을 교사로 지정하면
--      거부한다. 교사가 되면 별명이 모두에게, 아이디가 총괄에게 보이게 되기 때문이다(그 학급 담임 겸 총괄이면 지정할 수 있다).
create or replace function public.admin_set_role(p_user uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current   text;
  v_withdrawn timestamptz;
  v_class     uuid;
  v_blocking  text;
  v_classes   uuid[];
begin
  if not public.is_super_admin() then
    raise exception '담임교사 지정·해제는 총괄 관리자만 할 수 있습니다.';
  end if;
  if p_user is null then
    raise exception '대상 회원을 찾을 수 없습니다.';
  end if;
  if p_role is null or p_role not in ('admin', 'user') then
    raise exception '잘못된 역할입니다.';
  end if;

  -- 동시에 두 관리자가 서로를 해제하는 경쟁을 막기 위해 관리자 행을 잠근다(원래 코드 그대로).
  perform 1 from public.profiles where role = 'admin' for update;

  select p.role, p.withdrawn_at, p.class_id into v_current, v_withdrawn, v_class
  from public.profiles p
  where p.id = p_user;
  if v_current is null then
    raise exception '대상 회원을 찾을 수 없습니다.';
  end if;
  if v_current = p_role then
    return;
  end if;

  -- ── 담임교사로 지정(user → admin) ──
  if p_role = 'admin' then
    if v_withdrawn is not null then
      raise exception '탈퇴한 회원은 담임교사로 지정할 수 없습니다.';
    end if;
    -- 개정 4(spec 4.11): 다른 학급 학생은 교사로 지정할 수 없다(학급 없는 계정 · 내가 담임인 학생은 그대로 지정 가능).
    if v_class is not null and not public.teaches_student(p_user) then
      raise exception '다른 학급 학생은 교사로 지정할 수 없어요.';
    end if;
    -- 개정 1-2: 담임으로 지정되면 학생 소속은 비운다(트리거가 member_directory 에도 반영).
    -- 개인정보 ②: 총괄이 지정한 교사는 모든 교사 권한(teacher_scope 'full').
    update public.profiles set role = 'admin', class_id = null, teacher_scope = 'full' where id = p_user;
    return;
  end if;

  -- ── 담임 해제(admin → user) ──
  if p_user = auth.uid() then
    raise exception '자기 자신의 관리자 권한은 해제할 수 없습니다.';
  end if;
  if (select count(*) from public.profiles where role = 'admin') <= 1 then
    raise exception '마지막 관리자는 해제할 수 없습니다.';
  end if;

  select string_agg(c.name, ', ' order by c.name) into v_blocking
  from public.class_teachers ct
  join public.classes c on c.id = ct.class_id
  where ct.teacher_id = p_user
    and exists (select 1 from public.profiles s where s.class_id = c.id and s.role = 'user')
    and not exists (
      select 1
      from public.class_teachers o
      join public.profiles op on op.id = o.teacher_id
      where o.class_id = c.id
        and o.teacher_id <> p_user
        and op.role = 'admin'
    );
  if v_blocking is not null then
    raise exception '이 선생님이 담임인 학급(%)에 학생이 있어 해제할 수 없습니다. 학급을 먼저 다른 담임에게 넘기거나 학생을 옮겨 학급을 비워 주세요.', v_blocking;
  end if;

  select coalesce(array_agg(ct.class_id), '{}'::uuid[]) into v_classes
  from public.class_teachers ct
  where ct.teacher_id = p_user;

  delete from public.class_teachers where teacher_id = p_user;

  update public.classes c
     set archived_at = coalesce(c.archived_at, now())
   where c.id = any (v_classes)
     and not exists (select 1 from public.class_teachers o where o.class_id = c.id);

  -- 개인정보 ②: 해제 때도 teacher_scope 를 'full'(기본값)로 되돌린다.
  update public.profiles set role = 'user', is_super_admin = false, teacher_scope = 'full' where id = p_user;
end;
$$;

revoke all on function public.admin_set_role(uuid, text) from public, anon;
grant execute on function public.admin_set_role(uuid, text) to authenticated;

-- 1-5. record_post_read (지금 정의: 20260921020000 §4.4) — 인증 전 구글 계정이면 기록하지 않는다(조용히 끝).
create or replace function public.record_post_read(p_post_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    return;
  end if;
  if public.is_pending_google() then
    return;
  end if;
  if not exists (select 1 from public.posts where id = p_post_id and published) then
    return;
  end if;
  insert into public.post_reads (user_id, post_id)
  values (auth.uid(), p_post_id)
  on conflict (user_id, post_id)
  do update set last_read_at = now(), read_count = public.post_reads.read_count + 1;
end;
$$;

revoke all on function public.record_post_read(uuid) from public, anon;
grant execute on function public.record_post_read(uuid) to authenticated;

-- 1-6. get_or_create_feedback_thread (지금 정의: 20260927010000 §4-2) — 인증 전 구글 계정이면 거부.
create or replace function public.get_or_create_feedback_thread(p_student_id uuid, p_context_type text, p_context_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null or public.is_pending_google()
     or not (auth.uid() = p_student_id or public.teaches_student(p_student_id)) then
    raise exception '권한이 없습니다.';
  end if;
  if p_context_type not in ('general', 'app_result', 'assignment_submission') then
    raise exception '잘못된 대화 종류입니다.';
  end if;
  if p_context_type = 'general' then
    p_context_id := null;
  end if;

  select id into v_id from public.feedback_threads
  where student_id = p_student_id
    and context_key = p_context_type || ':' || coalesce(p_context_id::text, '');
  if v_id is not null then
    return v_id;
  end if;

  if p_context_type = 'app_result' and not exists (
    select 1 from public.app_results r where r.id = p_context_id and r.user_id = p_student_id
  ) then
    raise exception '대화를 연결할 웹앱 기록을 찾을 수 없습니다.';
  end if;
  if p_context_type = 'assignment_submission' and not exists (
    select 1 from public.assignment_submissions s where s.id = p_context_id and s.user_id = p_student_id
  ) then
    raise exception '대화를 연결할 제출물을 찾을 수 없습니다.';
  end if;

  insert into public.feedback_threads (student_id, context_type, context_id)
  values (p_student_id, p_context_type, p_context_id)
  on conflict (student_id, context_key) do nothing
  returning id into v_id;
  if v_id is null then
    select id into v_id from public.feedback_threads
    where student_id = p_student_id
      and context_key = p_context_type || ':' || coalesce(p_context_id::text, '');
  end if;
  return v_id;
end;
$$;

revoke all on function public.get_or_create_feedback_thread(uuid, text, uuid) from public, anon;
grant execute on function public.get_or_create_feedback_thread(uuid, text, uuid) to authenticated;

-- 1-7. 학습게임 관리 RPC 4개 (지금 정의: 20260928010000 §5-1~5-4) — spec 4.6 #10~13.
--      맨 앞 is_admin()(교사 확인)은 그대로, 학습게임 것이면 모든 교사 권한(is_full_admin)이 아닐 때 'admin only' 를 더했다.
--      게시판 갈래(can_manage_board — 자기 게시판)는 그대로.
create or replace function public.set_community_post_hidden(p_id uuid, p_hidden boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kind  text;
  v_owner uuid;
begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;
  select p.kind, p.board_owner into v_kind, v_owner
  from public.community_posts p
  where p.id = p_id;
  if not found then
    raise exception 'not_found';
  end if;
  if v_kind = 'board' and not public.can_manage_board(v_owner) then
    raise exception 'admin only';
  end if;
  if v_kind <> 'board' and not public.is_full_admin() then
    raise exception 'admin only'; -- 학습게임 관리는 모든 교사 권한(총괄 · 총괄이 지정한 교사)만
  end if;
  update public.community_posts set hidden = p_hidden where id = p_id;
  if not found then
    raise exception 'not_found';
  end if;
end;
$$;
revoke all on function public.set_community_post_hidden(uuid, boolean) from public, anon;
grant execute on function public.set_community_post_hidden(uuid, boolean) to authenticated;

create or replace function public.set_community_comment_hidden(p_id uuid, p_hidden boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kind  text;
  v_owner uuid;
begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;
  select p.kind, p.board_owner into v_kind, v_owner
  from public.community_comments c
  join public.community_posts p on p.id = c.post_id
  where c.id = p_id;
  if not found then
    raise exception 'not_found';
  end if;
  if v_kind = 'board' and not public.can_manage_board(v_owner) then
    raise exception 'admin only';
  end if;
  if v_kind <> 'board' and not public.is_full_admin() then
    raise exception 'admin only'; -- 학습게임 댓글 관리는 모든 교사 권한만
  end if;
  update public.community_comments set hidden = p_hidden where id = p_id;
  if not found then
    raise exception 'not_found';
  end if;
end;
$$;
revoke all on function public.set_community_comment_hidden(uuid, boolean) from public, anon;
grant execute on function public.set_community_comment_hidden(uuid, boolean) to authenticated;

create or replace function public.set_community_report_status(p_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_post_kind text;
  v_owner     uuid;
begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;
  if p_status not in ('open', 'resolved') then
    raise exception 'bad_status';
  end if;
  select r.target_post_kind, r.target_board_owner into v_post_kind, v_owner
  from public.community_reports r
  where r.id = p_id;
  if not found then
    raise exception 'not_found';
  end if;
  if v_post_kind is distinct from 'game' and not public.can_manage_board(v_owner) then
    raise exception 'admin only';
  end if;
  if v_post_kind = 'game' and not public.is_full_admin() then
    raise exception 'admin only'; -- 학습게임 신고 처리는 모든 교사 권한만
  end if;
  update public.community_reports
    set status = p_status,
        resolved_at = case when p_status = 'resolved' then now() else null end
    where id = p_id;
  if not found then
    raise exception 'not_found';
  end if;
end;
$$;
revoke all on function public.set_community_report_status(uuid, text) from public, anon;
grant execute on function public.set_community_report_status(uuid, text) to authenticated;

create or replace function public.resolve_community_reports_for(
  p_post_id uuid,
  p_comment_id uuid default null,
  p_include_comments boolean default false
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n       integer;
  v_kind  text;
  v_owner uuid;
begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;
  select p.kind, p.board_owner into v_kind, v_owner
  from public.community_posts p
  where p.id = p_post_id;
  if not found then
    return 0;
  end if;
  if v_kind = 'board' and not public.can_manage_board(v_owner) then
    raise exception 'admin only';
  end if;
  if v_kind <> 'board' and not public.is_full_admin() then
    raise exception 'admin only'; -- 학습게임 신고 처리는 모든 교사 권한만
  end if;
  update public.community_reports
    set status = 'resolved', resolved_at = now()
    where status = 'open'
      and post_id = p_post_id
      and (p_include_comments or comment_id is not distinct from p_comment_id);
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function public.resolve_community_reports_for(uuid, uuid, boolean) from public, anon;
grant execute on function public.resolve_community_reports_for(uuid, uuid, boolean) to authenticated;

-- ═════════════════════════════════════════════
-- 2. 기존 회원 백필 (spec 4.4 · 질문 4 · 고침 1) — 다시 실행해도 안전(가리지 않은 것 · 빈 것만)
--    고침 1(M3·M4): "구글 계정" = 아이디 계정이 아닌 계정 = 회원 명단 이메일이 '@class1.local'로 끝나지 않고(가린 'k***'도 여기),
--    이메일이나 가입 방식이 하나라도 기록된 계정(handle_new_user · sync_member_directory 와 같은 판정). 실제 이메일로 스스로 가입한
--    이메일·비밀번호 계정과, 총괄이 실제 이메일로 로그인하는 계정도 여기에 든다(총괄은 role admin 이라 인증 전이 아니다).
-- ═════════════════════════════════════════════

-- 2-1. 구글 등(아이디 계정이 아닌) 계정의 회원 명단 이메일 → 첫 글자 + '***'. 이미 가린 줄('@' 없음)은 건너뛴다.
update public.member_directory d
   set email = left(split_part(d.email, '@', 1), 1) || '***'
 where position('@' in d.email) > 0
   and lower(d.email) not like '%@class1.local';

-- 2-2. 기존 구글 등 계정 → member_verification(origin 'existing'). 탈퇴 처리된 계정(로그인 계정이 이미 없음)과
--      학급이 있는 계정(구글 · 실제 이메일로 로그인하는 학생 — 맨 앞 점검 알림)은 넣지 않는다. 구글 관리자(총괄 포함)도 넣는다
--      → 그 계정은 인증 전이 아니다(role admin) — 처음 접속 때 코드 없는 확인 창(3-1)이 뜬다.
insert into public.member_verification (user_id, origin)
select p.id, 'existing'
  from public.profiles p
  join public.member_directory d on d.id = p.id
 where p.withdrawn_at is null
   and not (p.role = 'user' and p.class_id is not null)
   and lower(coalesce(d.email, '')) not like '%@class1.local'
   and (coalesce(d.email, '') <> '' or coalesce(d.provider, '') <> '' or cardinality(coalesce(d.providers, '{}'::text[])) > 0)
on conflict (user_id) do nothing;

-- 2-3. 인증 전 구글 계정(role user)과 탈퇴 처리된 구글 계정의 이름 → '인증 전 회원', 사진 주소 → 비움(구글 실명·사진 가리기).
--      인증을 마친 뒤 담임 해제된 계정(스스로 정한 별명)과 학급이 있는 계정은 건드리지 않는다.
update public.profiles p
   set display_name = '인증 전 회원', avatar_url = null
  from public.member_directory d
 where d.id = p.id
   and p.role = 'user'
   and p.class_id is null
   and (p.display_name is distinct from '인증 전 회원' or p.avatar_url is not null)
   and lower(coalesce(d.email, '')) not like '%@class1.local'
   and (coalesce(d.email, '') <> '' or coalesce(d.provider, '') <> '' or cardinality(coalesce(d.providers, '{}'::text[])) > 0)
   and not exists (
     select 1 from public.member_verification v where v.user_id = p.id and v.verified_at is not null
   );

-- 2-4. (고침 1 — M1 · 사용자 결정 "프로필 사진 주소를 받지 않음") 사진 주소 비우기:
--      구글 등 계정 모두(관리자 · 총괄 포함 — 구글 프로필 사진 주소를 저장하지 않는다)와 학생(role 'user') 모두.
--      비운 값은 되돌리지 않는다(되돌리기 파일도 되살리지 않음). 아이디로 만든 선생님 계정의 사진 주소는 그대로 둔다.
update public.profiles p
   set avatar_url = null
 where p.avatar_url is not null
   and (
     p.role = 'user'
     or exists (
       select 1 from public.member_directory d
        where d.id = p.id
          and lower(coalesce(d.email, '')) not like '%@class1.local'
          and (coalesce(d.email, '') <> '' or coalesce(d.provider, '') <> '' or cardinality(coalesce(d.providers, '{}'::text[])) > 0)
     )
   );

-- 2-5. (고침 1 — M1) 구글 등 관리자(총괄 포함) 중 처리방침 확인에서 별명을 아직 정하지 않은 계정(확인 창의 first_time 과 같은 판단 —
--      member_verification.ack_at 이 없음)의 이름 → '선생님'(구글 실명을 공개 프로필에 두지 않는다). 확인 창(3-1)에서 별명을 정하면
--      그 별명으로 바뀐다(acknowledge_privacy). 이미 별명을 정한 계정은 건드리지 않는다.
--      고침 2(검토 R1 N3): **지금 이름이 구글이 준 이름이거나 비었을 때만** 바꾼다 — 구글 로그인 정보(auth.users.raw_user_meta_data)의
--      full_name · name, 그리고 예전 handle_new_user 가 full_name 이 없을 때 넣던 이메일 앞부분(앞 50자, 앞뒤 공백 뺌)과 같으면.
--      [나중에]로 확인 창을 닫고 '프로필 수정'으로 스스로 고친 별명은 ②를 다시 실행해도 덮어쓰지 않는다('선생님'은 ①에서 예약어).
update public.profiles p
   set display_name = '선생님'
  from public.member_directory d, auth.users u
 where d.id = p.id
   and u.id = p.id
   and p.role = 'admin'
   and p.display_name is distinct from '선생님'
   and lower(coalesce(d.email, '')) not like '%@class1.local'
   and (coalesce(d.email, '') <> '' or coalesce(d.provider, '') <> '' or cardinality(coalesce(d.providers, '{}'::text[])) > 0)
   and not exists (
     select 1 from public.member_verification v where v.user_id = p.id and v.ack_at is not null
   )
   and (
     nullif(btrim(coalesce(p.display_name, '')), '') is null
     or btrim(p.display_name) in (
       btrim(left(coalesce(u.raw_user_meta_data ->> 'full_name', ''), 50)),
       btrim(left(coalesce(u.raw_user_meta_data ->> 'name', ''), 50)),
       btrim(left(split_part(coalesce(u.email, ''), '@', 1), 50))
     )
   );

-- 2-6. (고침 1 — L14) 계정 만들기 기록의 처리자 이름(actor_name — 만든 때의 표시 이름 스냅샷)에 남은 구글 등 계정의 실명 →
--      그 계정의 지금 표시 이름(2-3 · 2-5 뒤 — 별명 · '선생님' · '인증 전 회원'). 처리자가 지워진 줄(actor_id 없음)은 알 수 없어 그대로.
update public.member_create_log l
   set actor_name = p.display_name
  from public.profiles p
  join public.member_directory d on d.id = p.id
 where l.actor_id = p.id
   and l.actor_name is distinct from p.display_name
   and lower(coalesce(d.email, '')) not like '%@class1.local'
   and (coalesce(d.email, '') <> '' or coalesce(d.provider, '') <> '' or cardinality(coalesce(d.providers, '{}'::text[])) > 0);

-- 2-7. (고침 1 — M2) 감사 기록에 남은 구글 등 이메일 · 실명(예전에 '탈퇴 처리'된 구글 계정 등) → 첫 글자 + '***'.
--      대상 = target_email 에 '@'가 있고 '@class1.local'로 끝나지 않는 줄(가린 줄은 '@'가 없어 다시 실행해도 건너뜀).
--      password_reset_log 에는 이메일 · 이름 칸이 없다(target_id · actor_id 만 — 고칠 것 없음).
update public.member_withdrawal_log l
   set target_email = public.mask_label(split_part(l.target_email, '@', 1)),
       target_name  = case when l.target_name is null then null else public.mask_label(l.target_name) end
 where position('@' in coalesce(l.target_email, '')) > 0
   and lower(l.target_email) not like '%@class1.local';

update public.member_create_log l
   set target_email = public.mask_label(split_part(l.target_email, '@', 1))
 where position('@' in coalesce(l.target_email, '')) > 0
   and lower(l.target_email) not like '%@class1.local';

-- ═════════════════════════════════════════════
-- 3. 인증 전 구글 계정의 쓰기 막기 — RESTRICTIVE 정책 19개 (spec 4.5)
--    as restrictive · to authenticated · not (select public.is_pending_google())(요청마다 한 번 계산).
--    허용 정책에 AND 로 붙으므로 인증 전이 아닌 사람(학생 · 교사 · 인증 마친 구글 선생님 · 비로그인 읽기)에게는 효과가 없다.
-- ═════════════════════════════════════════════

-- 3-1. profiles — 수정(인증 전에는 이름·사진을 직접 못 고침. 별명은 인증 RPC 로만)
drop policy if exists "profiles: 인증 전 쓰기 제한(수정)" on public.profiles;
create policy "profiles: 인증 전 쓰기 제한(수정)"
  on public.profiles as restrictive for update
  to authenticated
  using (not (select public.is_pending_google()))
  with check (not (select public.is_pending_google()));

-- 3-2. comments(블로그 댓글) — 추가 · 수정
drop policy if exists "comments: 인증 전 쓰기 제한(추가)" on public.comments;
create policy "comments: 인증 전 쓰기 제한(추가)"
  on public.comments as restrictive for insert
  to authenticated
  with check (not (select public.is_pending_google()));

drop policy if exists "comments: 인증 전 쓰기 제한(수정)" on public.comments;
create policy "comments: 인증 전 쓰기 제한(수정)"
  on public.comments as restrictive for update
  to authenticated
  using (not (select public.is_pending_google()))
  with check (not (select public.is_pending_google()));

-- 3-3. likes(블로그 좋아요) — 추가
drop policy if exists "likes: 인증 전 쓰기 제한(추가)" on public.likes;
create policy "likes: 인증 전 쓰기 제한(추가)"
  on public.likes as restrictive for insert
  to authenticated
  with check (not (select public.is_pending_google()));

-- 3-4. community_posts — 추가 · 수정
drop policy if exists "community_posts: 인증 전 쓰기 제한(추가)" on public.community_posts;
create policy "community_posts: 인증 전 쓰기 제한(추가)"
  on public.community_posts as restrictive for insert
  to authenticated
  with check (not (select public.is_pending_google()));

drop policy if exists "community_posts: 인증 전 쓰기 제한(수정)" on public.community_posts;
create policy "community_posts: 인증 전 쓰기 제한(수정)"
  on public.community_posts as restrictive for update
  to authenticated
  using (not (select public.is_pending_google()))
  with check (not (select public.is_pending_google()));

-- 3-5. community_comments — 추가 · 수정
drop policy if exists "community_comments: 인증 전 쓰기 제한(추가)" on public.community_comments;
create policy "community_comments: 인증 전 쓰기 제한(추가)"
  on public.community_comments as restrictive for insert
  to authenticated
  with check (not (select public.is_pending_google()));

drop policy if exists "community_comments: 인증 전 쓰기 제한(수정)" on public.community_comments;
create policy "community_comments: 인증 전 쓰기 제한(수정)"
  on public.community_comments as restrictive for update
  to authenticated
  using (not (select public.is_pending_google()))
  with check (not (select public.is_pending_google()));

-- 3-6. community_likes · community_reports — 추가
drop policy if exists "community_likes: 인증 전 쓰기 제한(추가)" on public.community_likes;
create policy "community_likes: 인증 전 쓰기 제한(추가)"
  on public.community_likes as restrictive for insert
  to authenticated
  with check (not (select public.is_pending_google()));

drop policy if exists "community_reports: 인증 전 쓰기 제한(추가)" on public.community_reports;
create policy "community_reports: 인증 전 쓰기 제한(추가)"
  on public.community_reports as restrictive for insert
  to authenticated
  with check (not (select public.is_pending_google()));

-- 3-7. app_results — 추가(과학 앱 결과)
drop policy if exists "app_results: 인증 전 쓰기 제한(추가)" on public.app_results;
create policy "app_results: 인증 전 쓰기 제한(추가)"
  on public.app_results as restrictive for insert
  to authenticated
  with check (not (select public.is_pending_google()));

-- 3-8. app_progress — 추가 · 수정(과학 앱 진행 — upsert 는 두 정책을 모두 거친다)
drop policy if exists "app_progress: 인증 전 쓰기 제한(추가)" on public.app_progress;
create policy "app_progress: 인증 전 쓰기 제한(추가)"
  on public.app_progress as restrictive for insert
  to authenticated
  with check (not (select public.is_pending_google()));

drop policy if exists "app_progress: 인증 전 쓰기 제한(수정)" on public.app_progress;
create policy "app_progress: 인증 전 쓰기 제한(수정)"
  on public.app_progress as restrictive for update
  to authenticated
  using (not (select public.is_pending_google()))
  with check (not (select public.is_pending_google()));

-- 3-9. assignment_submissions — 추가 · 수정
drop policy if exists "assignment_submissions: 인증 전 쓰기 제한(추가)" on public.assignment_submissions;
create policy "assignment_submissions: 인증 전 쓰기 제한(추가)"
  on public.assignment_submissions as restrictive for insert
  to authenticated
  with check (not (select public.is_pending_google()));

drop policy if exists "assignment_submissions: 인증 전 쓰기 제한(수정)" on public.assignment_submissions;
create policy "assignment_submissions: 인증 전 쓰기 제한(수정)"
  on public.assignment_submissions as restrictive for update
  to authenticated
  using (not (select public.is_pending_google()))
  with check (not (select public.is_pending_google()));

-- 3-10. feedback_messages — 추가
drop policy if exists "feedback_messages: 인증 전 쓰기 제한(추가)" on public.feedback_messages;
create policy "feedback_messages: 인증 전 쓰기 제한(추가)"
  on public.feedback_messages as restrictive for insert
  to authenticated
  with check (not (select public.is_pending_google()));

-- 3-11. feedback_read_marks — 추가 · 수정(허용 정책은 for all 하나 — "본인만 조회/기록")
drop policy if exists "feedback_read_marks: 인증 전 쓰기 제한(추가)" on public.feedback_read_marks;
create policy "feedback_read_marks: 인증 전 쓰기 제한(추가)"
  on public.feedback_read_marks as restrictive for insert
  to authenticated
  with check (not (select public.is_pending_google()));

drop policy if exists "feedback_read_marks: 인증 전 쓰기 제한(수정)" on public.feedback_read_marks;
create policy "feedback_read_marks: 인증 전 쓰기 제한(수정)"
  on public.feedback_read_marks as restrictive for update
  to authenticated
  using (not (select public.is_pending_google()))
  with check (not (select public.is_pending_google()));

-- 3-12. storage.objects — game-uploads 업로드만(다른 버킷에는 영향 없음)
drop policy if exists "game-uploads: 인증 전 업로드 제한" on storage.objects;
create policy "game-uploads: 인증 전 업로드 제한"
  on storage.objects as restrictive for insert
  to authenticated
  with check (bucket_id <> 'game-uploads' or not (select public.is_pending_google()));

-- ═════════════════════════════════════════════
-- 4. "자기 학급 일만" — 학급 밖 교사 권한 정책 20개: is_admin() → is_full_admin() (spec 4.6)
--    각 정책은 지금 정의(파일 표시)와 글자 그대로 같고 is_admin() 만 is_full_admin() 으로 바꿨다. 이름·대상 역할도 그대로.
-- ═════════════════════════════════════════════

-- 4-1. (#1) community_posts 읽기 — 20260928010000 §4-1. 숨긴 학습게임 보기 = 모든 교사 권한만.
drop policy if exists "community_posts: 읽기(게시판은 담임별)" on public.community_posts;
create policy "community_posts: 읽기(게시판은 담임별)"
  on public.community_posts for select
  using (
    (
      (not hidden)
      and (select public.can_browse())
      and (
        kind <> 'board'                                                              -- 학습게임: 그대로
        or ((select auth.uid()) is not null and public.can_use_board(board_owner))  -- 자유게시판: 로그인 + 그 게시판 참여자
      )
    )
    or auth.uid() = author_id                                          -- 내 글은 어느 게시판이든(숨김 포함) 늘 보인다
    or (kind <> 'board' and public.is_full_admin())                    -- 학습게임: 모든 교사 권한(개인정보 ②)
    or (kind = 'board' and public.can_manage_board(board_owner))       -- 자유게시판: 그 게시판 관리자(담임·보조 담임)·총괄
  );

-- 4-2. (#2) community_posts 고치기 — 20260928010000 §4-3
drop policy if exists "community_posts: 본인·게시판 관리자 수정" on public.community_posts;
create policy "community_posts: 본인·게시판 관리자 수정"
  on public.community_posts for update
  to authenticated
  using (
    auth.uid() = author_id
    or (kind <> 'board' and public.is_full_admin())
    or (kind = 'board' and public.can_manage_board(board_owner))
  )
  with check (
    auth.uid() = author_id
    or (kind <> 'board' and public.is_full_admin())
    or (kind = 'board' and public.can_manage_board(board_owner))
  );

-- 4-3. (#3) community_posts 지우기 — 20260928010000 §4-4
drop policy if exists "community_posts: 본인·게시판 관리자 삭제" on public.community_posts;
create policy "community_posts: 본인·게시판 관리자 삭제"
  on public.community_posts for delete
  to authenticated
  using (
    auth.uid() = author_id
    or (kind <> 'board' and public.is_full_admin())
    or (kind = 'board' and public.can_manage_board(board_owner))
  );

-- 4-4. (#4) community_comments 읽기 — 20260928010000 §4-5(학습게임 갈래 두 군데)
drop policy if exists "community_comments: 읽기(게시판은 담임별)" on public.community_comments;
create policy "community_comments: 읽기(게시판은 담임별)"
  on public.community_comments for select
  using (
    (select public.can_browse())
    and exists (
      select 1 from public.community_posts p
      where p.id = community_comments.post_id
        and (
          -- 학습게임: 숨긴 글·댓글은 글쓴이·모든 교사 권한만(개인정보 ②)
          (
            p.kind <> 'board'
            and (not p.hidden or public.is_full_admin() or auth.uid() = p.author_id)
            and (not community_comments.hidden or auth.uid() = community_comments.user_id or public.is_full_admin())
          )
          -- 자유게시판: 로그인 + 그 글을 볼 수 있음(참여자 · 글쓴이 · 관리자) + 숨긴 댓글은 쓴 사람·그 게시판 관리자·총괄만
          or (
            p.kind = 'board'
            and (select auth.uid()) is not null
            and (
              (not p.hidden and public.can_use_board(p.board_owner))
              or auth.uid() = p.author_id
              or public.can_manage_board(p.board_owner)
            )
            and (
              not community_comments.hidden
              or auth.uid() = community_comments.user_id
              or public.can_manage_board(p.board_owner)
            )
          )
        )
    )
  );

-- 4-5. (#5) community_comments 지우기 — 20260928010000 §4-7
drop policy if exists "community_comments: 본인·게시판 관리자 삭제" on public.community_comments;
create policy "community_comments: 본인·게시판 관리자 삭제"
  on public.community_comments for delete
  to authenticated
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.community_posts p
      where p.id = community_comments.post_id
        and (
          (p.kind <> 'board' and public.is_full_admin())                     -- 학습게임: 모든 교사 권한(개인정보 ②)
          or (p.kind = 'board' and public.can_manage_board(p.board_owner))   -- 자유게시판: 그 게시판 관리자·총괄
        )
    )
  );

-- 4-6. (#6) community_likes 읽기 — 20260928010000 §4-8
drop policy if exists "community_likes: 읽기(게시판은 담임별)" on public.community_likes;
create policy "community_likes: 읽기(게시판은 담임별)"
  on public.community_likes for select
  using (
    (select public.can_browse())
    and exists (
      select 1 from public.community_posts p
      where p.id = community_likes.post_id
        and (
          (p.kind <> 'board' and (not p.hidden or auth.uid() = p.author_id or public.is_full_admin()))   -- 학습게임
          or (
            p.kind = 'board'
            and (select auth.uid()) is not null
            and (
              (not p.hidden and public.can_use_board(p.board_owner))
              or auth.uid() = p.author_id
              or public.can_manage_board(p.board_owner)
            )
          )
        )
    )
  );

-- 4-7. (#7) community_reports 읽기 — 20260928010000 §4-10. 학습게임 신고 = 모든 교사 권한만.
drop policy if exists "community_reports: 신고자·게시판 관리자 조회" on public.community_reports;
create policy "community_reports: 신고자·게시판 관리자 조회"
  on public.community_reports for select
  to authenticated
  using (
    auth.uid() = reporter_id
    or (target_post_kind = 'game' and public.is_full_admin())
    or (target_post_kind is distinct from 'game' and public.can_manage_board(target_board_owner))
  );

-- 4-8. (#8) community_reports 신고 — 20260928010000 §4-11(학습게임 갈래의 "숨긴 글을 볼 수 있음")
drop policy if exists "community_reports: 신고(볼 수 있는 글·댓글만)" on public.community_reports;
create policy "community_reports: 신고(볼 수 있는 글·댓글만)"
  on public.community_reports for insert
  to authenticated
  with check (
    auth.uid() = reporter_id
    and status = 'open'
    and community_reports.post_id is not null
    -- 볼 수 있는 글(community_posts RLS): 학습게임은 그대로, 게시판은 참여자·글쓴이·그 게시판 관리자
    and exists (
      select 1 from public.community_posts p
      where p.id = community_reports.post_id
        and (
          (p.kind <> 'board' and (not p.hidden or auth.uid() = p.author_id or public.is_full_admin()))
          or (
            p.kind = 'board'
            and (
              (not p.hidden and public.can_use_board(p.board_owner))
              or auth.uid() = p.author_id
              or public.can_manage_board(p.board_owner)
            )
          )
        )
    )
    and (
      -- 글·게임 신고: 내 글은 신고할 수 없다
      (
        community_reports.comment_id is null
        and not exists (
          select 1 from public.community_posts p
          where p.id = community_reports.post_id and p.author_id = auth.uid()
        )
      )
      -- 댓글 신고: 그 글의 댓글이고, 내가 볼 수 있고(community_comments RLS: 숨긴 댓글 제외), 내 댓글이 아니어야 한다
      or exists (
        select 1 from public.community_comments c
        where c.id = community_reports.comment_id
          and c.post_id = community_reports.post_id
          and c.user_id is distinct from auth.uid()
      )
    )
  );

-- 4-9. (#9) community_reports 지우기 — 20260928010000 §4-12
drop policy if exists "community_reports: 게시판 관리자 삭제" on public.community_reports;
create policy "community_reports: 게시판 관리자 삭제"
  on public.community_reports for delete
  to authenticated
  using (
    (target_post_kind = 'game' and public.is_full_admin())
    or (target_post_kind is distinct from 'game' and public.can_manage_board(target_board_owner))
  );

-- 4-10. (#14) game-uploads 조회(storage) — 20260923010000 §3.10. 숨긴 게임 파일 = 글쓴이·모든 교사 권한만.
drop policy if exists "game-uploads: 볼 수 있는 게임·본인·관리자 조회" on storage.objects;
create policy "game-uploads: 볼 수 있는 게임·본인·관리자 조회"
  on storage.objects for select
  using (
    bucket_id = 'game-uploads'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_full_admin()
      or (
        (select public.can_browse())
        and exists (
          select 1 from public.community_posts p
          where p.game_path = objects.name
            and (not p.hidden or auth.uid() = p.author_id or public.is_full_admin())
        )
      )
    )
  );

-- 4-11. (#15) game-uploads 지우기(storage) — 20260922040000
drop policy if exists "game-uploads: 본인 또는 관리자 삭제" on storage.objects;
create policy "game-uploads: 본인 또는 관리자 삭제"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'game-uploads'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_full_admin())
  );

-- 4-12. (#16) posts 읽기 — 20260923010000 §3.2. 남의 비공개(초안) 글 = 모든 교사 권한만.
drop policy if exists "posts: 공개 글은 누구나, 관리자는 전체 조회" on public.posts;
create policy "posts: 공개 글은 누구나, 관리자는 전체 조회"
  on public.posts for select
  using ((published and (select public.can_browse())) or public.is_full_admin());

-- 4-13. (#17~19) posts 쓰기·고치기·지우기 — 20260927030000 §2(대상 역할 지정 없음 그대로). 블로그 글 = 모든 교사 권한만.
drop policy if exists "posts: 교사 본인 이름으로 작성" on public.posts;
create policy "posts: 교사 본인 이름으로 작성"
  on public.posts for insert
  with check (public.is_full_admin() and author_id = auth.uid());

drop policy if exists "posts: 쓴 교사·총괄만 수정" on public.posts;
create policy "posts: 쓴 교사·총괄만 수정"
  on public.posts for update
  using (public.is_full_admin() and (author_id = auth.uid() or public.is_super_admin()))
  with check (public.is_full_admin() and (author_id = auth.uid() or public.is_super_admin()));

drop policy if exists "posts: 쓴 교사·총괄만 삭제" on public.posts;
create policy "posts: 쓴 교사·총괄만 삭제"
  on public.posts for delete
  using (public.is_full_admin() and (author_id = auth.uid() or public.is_super_admin()));

-- 4-14. (#20) comments(블로그 댓글) 읽기 — 20260923010000 §3.3. 비공개 글의 댓글 = 모든 교사 권한만.
drop policy if exists "comments: 공개 글의 댓글은 누구나 조회" on public.comments;
create policy "comments: 공개 글의 댓글은 누구나 조회"
  on public.comments for select
  using (
    public.is_full_admin()
    or (
      (select public.can_browse())
      and exists (select 1 from public.posts p where p.id = post_id and p.published)
    )
  );

-- 4-15. (#21) comments(블로그 댓글) 지우기 — 20260921000000
drop policy if exists "comments: 본인 또는 관리자 삭제" on public.comments;
create policy "comments: 본인 또는 관리자 삭제"
  on public.comments for delete
  to authenticated
  using (auth.uid() = user_id or public.is_full_admin());

-- 4-16. (#22~24) praise_presets 추가·수정·삭제 — 20260922020000. 함께 쓰는 칭찬 문구 고치기 = 모든 교사 권한만.
--       "praise_presets: 관리자만 조회"는 그대로 is_admin()(학급 선생님도 칭찬 보내기에 문구를 읽는다).
drop policy if exists "praise_presets: 관리자만 추가" on public.praise_presets;
create policy "praise_presets: 관리자만 추가"
  on public.praise_presets for insert
  to authenticated
  with check (public.is_full_admin());

drop policy if exists "praise_presets: 관리자만 수정" on public.praise_presets;
create policy "praise_presets: 관리자만 수정"
  on public.praise_presets for update
  to authenticated
  using (public.is_full_admin())
  with check (public.is_full_admin());

drop policy if exists "praise_presets: 관리자만 삭제" on public.praise_presets;
create policy "praise_presets: 관리자만 삭제"
  on public.praise_presets for delete
  to authenticated
  using (public.is_full_admin());

-- ═════════════════════════════════════════════
-- 5. (개정 4 — spec 4.11) 학생 아이디 가리기 — 회원 명단 · 감사 기록 3개의 읽기 범위를 can_see_member_identity(①)로.
--    지금 정의: 20260927010000 §3-1~3-5("…: 담임·총괄 조회" = can_manage_member — 총괄은 모든 줄). 바뀐 뒤:
--    학생 줄은 그 학생의 담임만, 총괄은 선생님 · 학급 없는 계정 줄만(다른 학급 학생 줄은 ①의 admin_masked_member_rows 가 가린 값으로).
--    관리 권한(can_manage_member — Edge Function 이 서비스 롤로 판단)은 바꾸지 않는다. 대상 역할은 authenticated 로 적는다
--    (anon 은 이 표들에 표 권한이 없다 — 20260927010000 머리말). 옛 이름 · 새 이름 모두 지운 뒤 만든다(재실행 안전).
--    되돌리기: docs/privacy/rollback-privacy-enforce.sql 3-17 · 3-18.
-- ═════════════════════════════════════════════

-- 5-1. member_directory(회원 명단 — 아이디 · 가입 방식 · 접속 시각 · 보호자 동의 표시)
drop policy if exists "member_directory: 관리자만 조회" on public.member_directory;
drop policy if exists "member_directory: 담임·총괄 조회" on public.member_directory;
drop policy if exists "member_directory: 학생은 담임만 조회" on public.member_directory;
create policy "member_directory: 학생은 담임만 조회"
  on public.member_directory for select
  to authenticated
  using (public.can_see_member_identity(id));

-- 5-2. password_reset_log(비밀번호 초기화 기록)
drop policy if exists "password_reset_log: 관리자만 조회" on public.password_reset_log;
drop policy if exists "password_reset_log: 담임·총괄 조회" on public.password_reset_log;
drop policy if exists "password_reset_log: 학생은 담임만 조회" on public.password_reset_log;
create policy "password_reset_log: 학생은 담임만 조회"
  on public.password_reset_log for select
  to authenticated
  using (public.can_see_member_identity(target_id));

-- 5-3. member_withdrawal_log(탈퇴 처리 기록 — 대상 이름 · 아이디 스냅샷)
drop policy if exists "member_withdrawal_log: 관리자만 조회" on public.member_withdrawal_log;
drop policy if exists "member_withdrawal_log: 담임·총괄 조회" on public.member_withdrawal_log;
drop policy if exists "member_withdrawal_log: 학생은 담임만 조회" on public.member_withdrawal_log;
create policy "member_withdrawal_log: 학생은 담임만 조회"
  on public.member_withdrawal_log for select
  to authenticated
  using (public.can_see_member_identity(target_id));

-- 5-4. member_create_log(계정 만들기 기록 — 대상 아이디 스냅샷 · 보호자 동의 표시)
drop policy if exists "member_create_log: 관리자만 조회" on public.member_create_log;
drop policy if exists "member_create_log: 담임·총괄 조회" on public.member_create_log;
drop policy if exists "member_create_log: 학생은 담임만 조회" on public.member_create_log;
create policy "member_create_log: 학생은 담임만 조회"
  on public.member_create_log for select
  to authenticated
  using (public.can_see_member_identity(target_id));

-- 5-5. admin_must_change_password_ids() (지금 정의: 20260927010000 §3-5) — 회원 명단의 "비밀번호 변경 필요" 표시.
--      명단과 같은 범위로(가린 줄의 표시는 admin_masked_member_rows 의 profiles.must_change_password 가 준다). 나머지는 글자 그대로.
create or replace function public.admin_must_change_password_ids()
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(p.id), '{}'::uuid[])
  from public.profiles p
  where p.must_change_password and public.can_see_member_identity(p.id);
$$;

revoke all on function public.admin_must_change_password_ids() from public, anon;
grant execute on function public.admin_must_change_password_ids() to authenticated;

-- ═════════════════════════════════════════════
-- 6. 맨 끝 점검 — 설계와 다르면 전부 되돌린다(아무것도 바뀌지 않음)
--    허용(PERMISSIVE) 정책끼리는 OR 로 합쳐지므로, 옛 정책이 하나라도 남으면 좁히기가 소리 없이 무효가 된다.
--    조건은 Postgres 가 다시 그린 식에서 함수 이름으로 찾는다(public. 은 표시 방식에 따라 빠질 수 있다 — ⑤ · ⑥ · ⑧과 같은 방식).
--    'is_full_admin()' 안에는 'is_admin()' 글자가 없다(… _full_admin()) → 아래 검색이 서로 섞이지 않는다.
-- ═════════════════════════════════════════════
do $$
declare
  v_missing  text;
  v_extra    text;
  v_left     text;
  v_cond     text;
  v_fn       text;
  v_unguard  text;
  v_n        int;
  v_mv       int;
  v_pending  int;
begin
  -- 6-1. 제한 정책 19개가 이름 · 명령 · 대상 역할 · 조건 그대로 있는지
  select string_agg(format('%s.%s / %s (%s)', e.s, e.t, e.p, e.c), ', ') into v_missing
  from (values
    ('public', 'profiles', 'profiles: 인증 전 쓰기 제한(수정)', 'UPDATE'),
    ('public', 'comments', 'comments: 인증 전 쓰기 제한(추가)', 'INSERT'),
    ('public', 'comments', 'comments: 인증 전 쓰기 제한(수정)', 'UPDATE'),
    ('public', 'likes', 'likes: 인증 전 쓰기 제한(추가)', 'INSERT'),
    ('public', 'community_posts', 'community_posts: 인증 전 쓰기 제한(추가)', 'INSERT'),
    ('public', 'community_posts', 'community_posts: 인증 전 쓰기 제한(수정)', 'UPDATE'),
    ('public', 'community_comments', 'community_comments: 인증 전 쓰기 제한(추가)', 'INSERT'),
    ('public', 'community_comments', 'community_comments: 인증 전 쓰기 제한(수정)', 'UPDATE'),
    ('public', 'community_likes', 'community_likes: 인증 전 쓰기 제한(추가)', 'INSERT'),
    ('public', 'community_reports', 'community_reports: 인증 전 쓰기 제한(추가)', 'INSERT'),
    ('public', 'app_results', 'app_results: 인증 전 쓰기 제한(추가)', 'INSERT'),
    ('public', 'app_progress', 'app_progress: 인증 전 쓰기 제한(추가)', 'INSERT'),
    ('public', 'app_progress', 'app_progress: 인증 전 쓰기 제한(수정)', 'UPDATE'),
    ('public', 'assignment_submissions', 'assignment_submissions: 인증 전 쓰기 제한(추가)', 'INSERT'),
    ('public', 'assignment_submissions', 'assignment_submissions: 인증 전 쓰기 제한(수정)', 'UPDATE'),
    ('public', 'feedback_messages', 'feedback_messages: 인증 전 쓰기 제한(추가)', 'INSERT'),
    ('public', 'feedback_read_marks', 'feedback_read_marks: 인증 전 쓰기 제한(추가)', 'INSERT'),
    ('public', 'feedback_read_marks', 'feedback_read_marks: 인증 전 쓰기 제한(수정)', 'UPDATE'),
    ('storage', 'objects', 'game-uploads: 인증 전 업로드 제한', 'INSERT')
  ) as e(s, t, p, c)
  where not exists (
    select 1 from pg_policies pp
    where pp.schemaname = e.s and pp.tablename = e.t and pp.policyname = e.p and pp.cmd = e.c
      and pp.permissive = 'RESTRICTIVE'
      and pp.roles = '{authenticated}'::name[]
      and position('is_pending_google()' in coalesce(pp.with_check, '')) > 0
      and (e.c <> 'UPDATE' or position('is_pending_google()' in coalesce(pp.qual, '')) > 0)
  );
  if v_missing is not null then
    raise exception '인증 전 쓰기 제한 정책이 설계와 다릅니다: %. 이 파일 전체를 되돌렸습니다(아무것도 바뀌지 않음) — 이 메시지를 알려 주세요.', v_missing;
  end if;

  select count(*) into v_n from pg_policies
  where permissive = 'RESTRICTIVE'
    and position('is_pending_google()' in coalesce(qual, '') || coalesce(with_check, '')) > 0;
  if v_n <> 19 then
    raise exception '인증 전 쓰기 제한 정책이 19개가 아닙니다(%개). 이 파일 전체를 되돌렸습니다 — 이 메시지를 알려 주세요.', v_n;
  end if;

  -- 6-2. 좁힌 정책 20개가 이름 그대로 있고 is_full_admin() 을 부르는지
  select string_agg(format('%s.%s / %s', e.s, e.t, e.p), ', ') into v_cond
  from (values
    ('public', 'community_posts', 'community_posts: 읽기(게시판은 담임별)'),
    ('public', 'community_posts', 'community_posts: 본인·게시판 관리자 수정'),
    ('public', 'community_posts', 'community_posts: 본인·게시판 관리자 삭제'),
    ('public', 'community_comments', 'community_comments: 읽기(게시판은 담임별)'),
    ('public', 'community_comments', 'community_comments: 본인·게시판 관리자 삭제'),
    ('public', 'community_likes', 'community_likes: 읽기(게시판은 담임별)'),
    ('public', 'community_reports', 'community_reports: 신고자·게시판 관리자 조회'),
    ('public', 'community_reports', 'community_reports: 신고(볼 수 있는 글·댓글만)'),
    ('public', 'community_reports', 'community_reports: 게시판 관리자 삭제'),
    ('storage', 'objects', 'game-uploads: 볼 수 있는 게임·본인·관리자 조회'),
    ('storage', 'objects', 'game-uploads: 본인 또는 관리자 삭제'),
    ('public', 'posts', 'posts: 공개 글은 누구나, 관리자는 전체 조회'),
    ('public', 'posts', 'posts: 교사 본인 이름으로 작성'),
    ('public', 'posts', 'posts: 쓴 교사·총괄만 수정'),
    ('public', 'posts', 'posts: 쓴 교사·총괄만 삭제'),
    ('public', 'comments', 'comments: 공개 글의 댓글은 누구나 조회'),
    ('public', 'comments', 'comments: 본인 또는 관리자 삭제'),
    ('public', 'praise_presets', 'praise_presets: 관리자만 추가'),
    ('public', 'praise_presets', 'praise_presets: 관리자만 수정'),
    ('public', 'praise_presets', 'praise_presets: 관리자만 삭제')
  ) as e(s, t, p)
  where not exists (
    select 1 from pg_policies pp
    where pp.schemaname = e.s and pp.tablename = e.t and pp.policyname = e.p
      and pp.permissive = 'PERMISSIVE'
      and position('is_full_admin()' in coalesce(pp.qual, '') || coalesce(pp.with_check, '')) > 0
  );
  if v_cond is not null then
    raise exception '좁혀야 할 정책이 없거나 is_full_admin() 을 부르지 않습니다: %. 이 파일 전체를 되돌렸습니다 — 이 메시지를 알려 주세요.', v_cond;
  end if;

  -- 6-3. 학급 밖 표(spec 4.6)에 is_admin() 만 쓰는 허용 정책이 남아 있지 않은지(classes_rls 끝 점검과 같은 방식)
  --      예외: praise_presets 조회(학급 선생님도 문구를 읽음 — 그대로 is_admin()).
  select string_agg(format('%s.%s / %s (%s)', pp.schemaname, pp.tablename, pp.policyname, pp.cmd), ', '
                    order by pp.schemaname, pp.tablename, pp.policyname)
    into v_left
  from pg_policies pp
  where pp.permissive = 'PERMISSIVE'
    and (
      (pp.schemaname = 'public' and pp.tablename in ('posts', 'comments', 'praise_presets', 'community_posts',
                                                     'community_comments', 'community_likes', 'community_reports'))
      or (pp.schemaname = 'storage' and pp.tablename = 'objects' and pp.policyname like 'game-uploads%')
    )
    and position('is_admin()' in coalesce(pp.qual, '') || coalesce(pp.with_check, '')) > 0
    and pp.policyname <> 'praise_presets: 관리자만 조회';
  if v_left is not null then
    raise exception '학급 밖 표에 아직 is_admin()(교사 누구나) 정책이 남아 있습니다: %. 이 파일 전체를 되돌렸습니다(아무것도 바뀌지 않음) — 이 메시지를 알려 주세요.', v_left;
  end if;

  -- 6-4. 학급 밖 표의 허용 정책 수가 그대로인지(옛 이름이 남거나 모르는 정책이 붙지 않았는지)
  --      posts 4 · comments 4 · praise_presets 4 · community_posts 4 · community_comments 4 · community_likes 3 ·
  --      community_reports 3 · storage game-uploads 3 = 29
  select string_agg(format('%s.%s %s개', x.s, x.t, x.n), ', ') into v_extra
  from (
    select pp.schemaname as s, pp.tablename as t, count(*) as n
    from pg_policies pp
    where pp.permissive = 'PERMISSIVE'
      and (
        (pp.schemaname = 'public' and pp.tablename in ('posts', 'comments', 'praise_presets', 'community_posts',
                                                       'community_comments', 'community_likes', 'community_reports'))
        or (pp.schemaname = 'storage' and pp.tablename = 'objects' and pp.policyname like 'game-uploads%')
      )
    group by 1, 2
  ) x
  where x.n <> case x.t
                 when 'posts' then 4 when 'comments' then 4 when 'praise_presets' then 4
                 when 'community_posts' then 4 when 'community_comments' then 4
                 when 'community_likes' then 3 when 'community_reports' then 3
                 when 'objects' then 3
               end;
  if v_extra is not null then
    raise exception '학급 밖 표의 허용 정책 수가 설계와 다릅니다: %. 이 파일 전체를 되돌렸습니다 — 이 메시지를 알려 주세요.', v_extra;
  end if;

  -- 6-5. is_full_admin()(모든 교사 권한)은 커뮤니티 표에서 학습게임 갈래에만 — 종류('board' / 'game')로 나뉘어 있어야 한다(⑧ 6-7과 같은 뜻)
  select string_agg(format('%s / %s', pp.tablename, pp.policyname), ', ') into v_unguard
  from pg_policies pp
  where pp.schemaname = 'public'
    and pp.tablename in ('community_posts', 'community_comments', 'community_likes', 'community_reports')
    and position('is_full_admin()' in coalesce(pp.qual, '') || coalesce(pp.with_check, '')) > 0
    and position('''board''' in coalesce(pp.qual, '') || coalesce(pp.with_check, '')) = 0
    and position('''game''' in coalesce(pp.qual, '') || coalesce(pp.with_check, '')) = 0;
  if v_unguard is not null then
    raise exception '종류(게시판/학습게임)를 가리지 않는 교사 정책이 있습니다: %. 이 파일 전체를 되돌렸습니다 — 이 메시지를 알려 주세요.', v_unguard;
  end if;

  -- 6-6. 함수 본문 — 학습게임 관리 RPC 4개는 게시판 판단(can_manage_board)과 학습게임 판단(is_full_admin)을 모두,
  --      can_browse · record_post_read · get_or_create_feedback_thread 는 is_pending_google, handle_new_user 는 member_verification,
  --      sync_member_directory 는 '***', admin_set_role 은 teacher_scope 와 (개정 4) 다른 학급 학생 거부를,
  --      admin_must_change_password_ids 는 (개정 4) can_see_member_identity 를 담고 있어야 한다(can_manage_member 는 없어야 한다).
  select string_agg(p.oid::regprocedure::text, ', ' order by p.oid::regprocedure::text) into v_fn
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and (
      (p.proname in ('set_community_post_hidden', 'set_community_comment_hidden', 'set_community_report_status',
                     'resolve_community_reports_for')
       and (position('can_manage_board(' in p.prosrc) = 0 or position('is_full_admin()' in p.prosrc) = 0))
      or (p.proname in ('can_browse', 'record_post_read', 'get_or_create_feedback_thread')
          and position('is_pending_google()' in p.prosrc) = 0)
      or (p.proname = 'handle_new_user'
          and (position('member_verification' in p.prosrc) = 0 or position('@class1.local' in p.prosrc) = 0))
      or (p.proname = 'sync_member_directory'
          and (position('***' in p.prosrc) = 0 or position('@class1.local' in p.prosrc) = 0))
      or (p.proname = 'admin_set_role'
          and (position('teacher_scope' in p.prosrc) = 0
               or position('다른 학급 학생은 교사로 지정할 수 없어요.' in p.prosrc) = 0
               or position('teaches_student(' in p.prosrc) = 0))
      or (p.proname = 'admin_must_change_password_ids'
          and (position('can_see_member_identity(' in p.prosrc) = 0 or position('can_manage_member(' in p.prosrc) > 0))
    );
  if v_fn is not null then
    raise exception '다시 정의해야 할 함수가 설계와 다릅니다: %. 이 파일 전체를 되돌렸습니다 — 이 메시지를 알려 주세요.', v_fn;
  end if;

  -- 6-7. 정책이 부르는 판별 함수는 누구나 실행(없으면 읽을 때 permission denied — review S1)
  if not (
    has_function_privilege('anon', 'public.can_browse()', 'EXECUTE')
    and has_function_privilege('anon', 'public.is_pending_google()', 'EXECUTE')
    and has_function_privilege('anon', 'public.is_full_admin()', 'EXECUTE')
    and has_function_privilege('authenticated', 'public.is_pending_google()', 'EXECUTE')
    and has_function_privilege('authenticated', 'public.is_full_admin()', 'EXECUTE')
    and has_function_privilege('authenticated', 'public.can_see_member_identity(uuid)', 'EXECUTE')
  ) then
    raise exception '정책이 부르는 판별 함수를 실행할 수 없는 역할이 있습니다. 이 파일 전체를 되돌렸습니다 — 이 메시지를 알려 주세요.';
  end if;

  -- 6-8. (개정 4) 회원 명단 · 감사 기록 3개: 읽기(SELECT · ALL) 허용 정책이 표마다 정확히 하나 = "…: 학생은 담임만 조회" ·
  --      대상 authenticated · 조건 can_see_member_identity(…). 옛 can_manage_member · is_admin() 정책이 하나라도 남으면
  --      (허용 정책은 OR 로 합쳐져) 총괄이 다른 학급 학생 아이디를 다시 읽게 되므로 전부 되돌린다.
  select string_agg(format('%s(%s개)', e.t, coalesce(x.n, 0)), ', ') into v_cond
  from (values ('member_directory'), ('password_reset_log'), ('member_withdrawal_log'), ('member_create_log')) as e(t)
  left join (
    select pp.tablename, count(*) as n,
           bool_and(pp.policyname = pp.tablename || ': 학생은 담임만 조회'
                    and pp.roles = '{authenticated}'::name[]
                    and position('can_see_member_identity(' in coalesce(pp.qual, '')) > 0) as ok
    from pg_policies pp
    where pp.schemaname = 'public'
      and pp.tablename in ('member_directory', 'password_reset_log', 'member_withdrawal_log', 'member_create_log')
      and pp.permissive = 'PERMISSIVE'
      and pp.cmd in ('SELECT', 'ALL')
    group by pp.tablename
  ) x on x.tablename = e.t
  where coalesce(x.n, 0) <> 1 or not coalesce(x.ok, false);
  if v_cond is not null then
    raise exception '회원 명단 · 감사 기록의 읽기 정책이 설계(개정 4 — "…: 학생은 담임만 조회" 하나)와 다릅니다: %. 이 파일 전체를 되돌렸습니다 — 이 메시지를 알려 주세요.', v_cond;
  end if;

  select string_agg(format('%s / %s', pp.tablename, pp.policyname), ', ') into v_left
  from pg_policies pp
  where pp.schemaname = 'public'
    and pp.tablename in ('member_directory', 'password_reset_log', 'member_withdrawal_log', 'member_create_log')
    and (position('can_manage_member(' in coalesce(pp.qual, '') || coalesce(pp.with_check, '')) > 0
         or position('is_admin()' in coalesce(pp.qual, '') || coalesce(pp.with_check, '')) > 0);
  if v_left is not null then
    raise exception '회원 명단 · 감사 기록에 옛 정책(can_manage_member · is_admin())이 남아 있습니다: %. 이 파일 전체를 되돌렸습니다 — 이 메시지를 알려 주세요.', v_left;
  end if;

  -- 6-9. 백필 결과 — 구글 등 계정 이메일은 모두 가려지고(회원 명단 · 감사 기록 2개 — 고침 1 M2), 인증 전 구글 계정의 이름·사진이
  --      가려졌는지
  select (select count(*) from public.member_directory d
           where position('@' in d.email) > 0 and lower(d.email) not like '%@class1.local')
       + (select count(*) from public.member_withdrawal_log l
           where position('@' in coalesce(l.target_email, '')) > 0 and lower(l.target_email) not like '%@class1.local')
       + (select count(*) from public.member_create_log l
           where position('@' in coalesce(l.target_email, '')) > 0 and lower(l.target_email) not like '%@class1.local')
    into v_n;
  if v_n > 0 then
    raise exception '가리지 못한 구글 이메일이 %개 있습니다(회원 명단 · 감사 기록). 이 파일 전체를 되돌렸습니다 — 이 메시지를 알려 주세요.', v_n;
  end if;

  select count(*) into v_n
  from public.member_verification v join public.profiles p on p.id = v.user_id
  where v.verified_at is null and p.role = 'user'
    and (p.display_name is distinct from '인증 전 회원' or p.avatar_url is not null);
  if v_n > 0 then
    raise exception '이름·사진을 가리지 못한 인증 전 구글 계정이 %개 있습니다. 이 파일 전체를 되돌렸습니다 — 이 메시지를 알려 주세요.', v_n;
  end if;

  -- 6-10. (고침 1 — M1 · 사진 주소 받지 않기) 사진 주소: 구글 등 계정 · 학생 0 / 별명을 아직 정하지 않은 구글 등 관리자의 이름 = '선생님' /
  --       계정 만들기 기록의 처리자 이름이 구글 등 계정의 지금 표시 이름과 같음 / profiles 의 사진 주소 수정 권한 없음(별명만)
  select count(*) into v_n
  from public.profiles p
  left join public.member_directory d on d.id = p.id
  where p.avatar_url is not null
    and (p.role = 'user'
         or (lower(coalesce(d.email, '')) not like '%@class1.local'
             and (coalesce(d.email, '') <> '' or coalesce(d.provider, '') <> ''
                  or cardinality(coalesce(d.providers, '{}'::text[])) > 0)));
  if v_n > 0 then
    raise exception '사진 주소가 남은 구글 등 계정 · 학생이 %개 있습니다. 이 파일 전체를 되돌렸습니다 — 이 메시지를 알려 주세요.', v_n;
  end if;

  -- 고침 2(N3): 별명을 정하지 않은 구글 등 관리자 중 이름이 아직 구글이 준 이름(또는 빈 값)인 계정 = 0
  select count(*) into v_n
  from public.profiles p
  join public.member_directory d on d.id = p.id
  join auth.users u on u.id = p.id
  where p.role = 'admin'
    and p.display_name is distinct from '선생님'
    and lower(coalesce(d.email, '')) not like '%@class1.local'
    and (coalesce(d.email, '') <> '' or coalesce(d.provider, '') <> '' or cardinality(coalesce(d.providers, '{}'::text[])) > 0)
    and not exists (select 1 from public.member_verification v where v.user_id = p.id and v.ack_at is not null)
    and (
      nullif(btrim(coalesce(p.display_name, '')), '') is null
      or btrim(p.display_name) in (
        btrim(left(coalesce(u.raw_user_meta_data ->> 'full_name', ''), 50)),
        btrim(left(coalesce(u.raw_user_meta_data ->> 'name', ''), 50)),
        btrim(left(split_part(coalesce(u.email, ''), '@', 1), 50))
      )
    );
  if v_n > 0 then
    raise exception '별명을 정하지 않았는데 이름이 구글이 준 이름 그대로인 구글 등 관리자가 %개 있습니다. 이 파일 전체를 되돌렸습니다 — 이 메시지를 알려 주세요.', v_n;
  end if;

  select count(*) into v_n
  from public.member_create_log l
  join public.profiles p on p.id = l.actor_id
  join public.member_directory d on d.id = p.id
  where l.actor_name is distinct from p.display_name
    and lower(coalesce(d.email, '')) not like '%@class1.local'
    and (coalesce(d.email, '') <> '' or coalesce(d.provider, '') <> '' or cardinality(coalesce(d.providers, '{}'::text[])) > 0);
  if v_n > 0 then
    raise exception '계정 만들기 기록에 구글 등 처리자의 예전 이름이 %줄 남아 있습니다. 이 파일 전체를 되돌렸습니다 — 이 메시지를 알려 주세요.', v_n;
  end if;

  if has_column_privilege('authenticated', 'public.profiles', 'avatar_url', 'UPDATE')
     or has_column_privilege('anon', 'public.profiles', 'avatar_url', 'UPDATE')
     or has_column_privilege('anon', 'public.profiles', 'display_name', 'UPDATE')
     or not has_column_privilege('authenticated', 'public.profiles', 'display_name', 'UPDATE') then
    raise exception 'profiles 수정 권한이 설계(별명만 — 사진 주소는 아무도 직접 못 고침)와 다릅니다. 이 파일 전체를 되돌렸습니다 — 이 메시지를 알려 주세요.';
  end if;

  select count(*), count(*) filter (where v.verified_at is null and p.role = 'user')
    into v_mv, v_pending
  from public.member_verification v join public.profiles p on p.id = v.user_id;

  raise notice '✔ ② 켰습니다: 인증 전 구글 계정 % 개(구글 계정 전체 %개)는 글·댓글·기록을 남길 수 없고(제한 정책 19개), 구글 이메일은 첫 글자만, 학습게임 관리·신고 처리·블로그·함께 쓰는 칭찬 문구는 모든 교사 권한(teacher_scope ''full'')만 합니다. 회원 명단·감사 기록의 학생 줄은 그 학생의 담임만 읽습니다(총괄은 다른 학급 학생을 첫 글자 + ***로 — 개정 4). 프로필 사진 주소는 받지 않고(학생·구글 계정의 사진 주소를 비움), 별명을 정하지 않은 구글 관리자의 이름은 ''선생님''입니다. 다음: 확인 쿼리 → 곧바로 ③ 20261020020000_privacy_c_profiles_members_only.sql.',
    v_pending, v_mv;
end $$;

-- PostgREST 가 바로 알도록(정책 · 권한은 캐시하지 않지만 다른 파일들과 같게 한 번 더)
notify pgrst, 'reload schema';
