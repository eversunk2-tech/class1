-- 개인정보 처리방침 · 구글 가입 교사 인증 · 보호자 동의 ③ — 프로필(이름·사진)은 로그인한 회원만(학생 이름은 같은 학급·담임만) + 처리방침 시행
-- 설계: docs/privacy/spec.md 4.10(사용자 확정 — 질문 9 = B, N3) · 개정 1 · 4.11(개정 4 — 학생 이름 가리기, N1 을 바꿈)
-- 지침: docs/privacy/build-1-sql-instructions.md · build-5-sql-instructions.md(개정 4)
-- 보고: docs/privacy/build-1-report.md · build-5-report.md(개정 4)
-- 비상 되돌리기: docs/privacy/rollback-profiles-members-only.sql(정책 이름이 그대로라 개정 4 뒤에도 그대로 쓴다)
--
-- ▶ 실행 순서(spec 7절 8번)
--   ② 20261020010000_privacy_b_enforce.sql 실행·확인 → **곧바로 같은 자리에서** 이 파일 → 아래 확인 쿼리.
--   이 순간이 **처리방침 시행**이다(site_settings.policy_effective_at 기록 → /privacy/ 와 처리방침 링크가 나타난다).
--   전제: 로그아웃 화면의 작성자 이름 폴백 "회원"(src/lib/community.ts authorName · src/components/comment-section.tsx)이
--         이미 배포돼 있어야 한다(아니면 로그아웃 방문자에게 작성자가 "익명"으로 보인다 — 깨지지는 않음).
--         개정 4: 로그인한 사람에게 다른 학급 학생 이름을 가린 값(2***)으로 채우는 화면(src/lib/member-labels.ts — 묶음 6)도 먼저
--         배포돼 있어야 한다(아니면 그 이름이 "회원"·"익명"으로 보인다 — 깨지지는 않음).
--   ⚠ 이 파일 뒤로 앞선 마이그레이션(특히 20260921000000_init_blog.sql · 20260923010000 · 20260923020000)을 다시 실행하지 않는다 —
--     옛 "profiles: 누구나 조회"(using true)가 되살아나 이름이 다시 비로그인에게 보인다. 되돌리기는 rollback 파일로만.
--
-- ▶ 실행 방법
--   Supabase 대시보드 > SQL Editor > New query 에 이 파일 전체를 붙여넣고 Run.
--   SQL Editor 는 붙여 넣은 전체를 한 트랜잭션으로 실행하므로 중간에 오류가 나면 아무것도 바뀌지 않는다.
--   (psql 등 다른 도구로 실행할 때는 psql -1 -v ON_ERROR_STOP=1 -f <파일> 처럼 "한 트랜잭션 + 오류 시 멈춤"으로.)
--   · "destructive operation(drop)" 확인 창이 뜨면 Run — 정책 하나만 지우고 곧바로 다시 만든다. 행은 지우지 않는다.
--   · 맨 앞 점검: ①(개정 4의 can_see_member_name 포함)·②가 실행되지 않았거나, 다른 표의 정책 식이 profiles 를 직접 조회하면
--     오류를 내고 아무것도 바꾸지 않는다.
--   · 맨 끝 점검: profiles 의 읽기(SELECT) 허용 정책이 정확히 하나(새 정책 · 조건 can_see_member_name)가 아니거나, 비로그인 열 권한이
--     사라졌으면 전부 되돌린다.
--   · 여러 번 실행해도 안전하다. 시행 시각은 처음 실행한 때로 남는다(다시 실행해도 바꾸지 않음 — 되돌리기 파일만 지운다).
--
-- ▶ 이 파일이 하는 일 — 정책 하나 + 시행 시각
--   · "profiles: 누구나 조회"(using true — 20260923020000) → "profiles: 로그인한 회원 조회"(to authenticated,
--     using public.can_see_member_name(id) — ①의 판별 함수, 개정 4 · spec 4.11). 이름은 4.10 그대로 두었다(되돌리기 파일이 그대로 맞는다).
--       본인 행은 늘 보인다.
--       선생님(role 'admin') 행 = 로그인한 모든 회원(선생님 별명은 모두에게 — 사용자 답).
--       학생(role 'user' — 탈퇴 처리된 학생 포함) 행 = 같은 학급 학생 · 그 학급 담임(보조 포함 · 총괄이 그 학급 담임이면 총괄도)만.
--         학급 없는 학생(담임 해제된 옛 교사 · 인증 전 구글 등)은 본인 · 총괄만.
--         그 밖의 로그인 회원(다른 학급 학생 · 다른 학급 선생님 · 총괄)에게는 행이 보이지 않아 profiles(...)를 붙인 요청의 값이 null 이
--         되고, 화면이 ①의 member_name_labels 로 가린 이름(첫 글자 + '***')을 채운다(src/lib/member-labels.ts — 묶음 6).
--       인증 전 구글 계정은 **자기 행만**(그렇지 않으면 구글 계정만 있으면 코드 없이 학생의 표시 이름(아이디)을 읽는다).
--       비로그인(anon)은 정책이 없어 0행(화면의 작성자는 "회원").
--   · anon 의 열 SELECT 권한(grant select (id, display_name, …) on profiles to anon)은 **일부러 그대로 둔다**: 권한까지 거두면
--     PostgREST 가 profiles(...)를 붙인 요청(학습게임 목록·글·댓글, 블로그 댓글)을 통째로 42501 로 실패시켜 로그아웃 화면이 깨진다.
--     권한은 두고 정책만 없애면 같은 요청이 정상으로 돌아오고 profiles 값만 null 이 된다(화면은 "회원").
--   · site_settings.policy_effective_at = 처음 실행한 시각(처리방침이 말하는 것이 모두 사실이 된 순간).
--   · 재귀(42P17) 없음: 새 정책은 profiles 를 직접 다시 조회하지 않는다(can_see_member_name() 은 security definer — 그 안의
--     profiles · class_teachers · member_verification 읽기는 RLS 를 거치지 않음). 정책은 행마다 이 함수를 부른다(학급 사이트 규모라 가볍다).
--   · 로그인 잠금 스위치와 상관없이 프로필 읽기는 늘 로그인한 회원만이다(spec 3.8).
--
-- ▶ 실행 전 확인(그냥 Run = postgres 권한, 읽기만)
--   -- A) profiles 정책 — SELECT 는 "profiles: 누구나 조회" 하나, 그 밖에 UPDATE "본인만 수정" · 제한 정책 "인증 전 쓰기 제한(수정)"
--   select policyname, cmd, permissive, roles from pg_policies where schemaname = 'public' and tablename = 'profiles' order by 2, 1;
--   -- B) 다른 표의 정책 식에 profiles 를 직접 조회하는 곳(0행이어야 한다 — 있으면 그 정책이 비로그인·인증 전 계정에게 0행이 됨)
--   select schemaname, tablename, policyname from pg_policies
--   where not (schemaname = 'public' and tablename = 'profiles')
--     and (coalesce(qual, '') ~ '\mprofiles\M' or coalesce(with_check, '') ~ '\mprofiles\M');
--
-- ▶ 실행 후 확인 쿼리(앞의 "-- "를 지우고 한 덩어리씩 Run — 모두 읽기만 한다). 흉내 시험 전체는 docs/privacy/test-queries.sql.
--   -- 1) profiles 의 SELECT 정책이 "profiles: 로그인한 회원 조회" 하나 · roles {authenticated}
--   select policyname, cmd, permissive, roles, qual from pg_policies
--   where schemaname = 'public' and tablename = 'profiles' and cmd in ('SELECT', 'ALL');
--   -- 2) 시행 시각(값이 있어야 한다)과 판 번호
--   select policy_effective_at, privacy_version from public.site_settings;
--   -- 3) 비로그인 열 권한은 그대로(true — 일부러)
--   select has_column_privilege('anon', 'public.profiles', 'display_name', 'SELECT') as anon_이름열_권한;
--   -- 4) 비로그인 흉내 — 0 이고 오류가 없어야 한다("지금_역할" = anon 이어야 흉내가 된 것)
--   set local role anon;
--   select current_user as 지금_역할, count(*) as 보이는_프로필 from public.profiles;
--   -- 5) 학생 흉내 — 선생님 수 + 같은 학급 학생 수(본인 포함)와 같아야 한다(개정 4). 먼저 그냥 Run(postgres)으로 기대값:
--   --    select count(*) from public.profiles
--   --    where role <> 'user' or id = '<학생 id>' or class_id = (select class_id from public.profiles where id = '<학생 id>');
--   --    (<학생 id>는 select id, role, class_id from public.profiles; 로 찾는다 — 이름은 보지 않는다)
--   set local role authenticated;
--   select set_config('request.jwt.claims', '{"sub":"<학생 id>","role":"authenticated"}', true);
--   select current_user as 지금_역할, count(*) as 보이는_프로필 from public.profiles;
--   -- 5-2) 다른 학급 학생 이름은 가린 값으로만(member_name_labels) — masked true · 첫 글자 + *** 모양. <다른 학급 학생 id>가 없으면 건너뜀.
--   set local role authenticated;
--   select set_config('request.jwt.claims', '{"sub":"<학생 id>","role":"authenticated"}', true);
--   select current_user as 지금_역할,
--          (select count(*) from public.profiles where id = '<다른 학급 학생 id>') as 프로필_0,
--          (select (e ->> 'masked')::boolean and (e ->> 'display_name') ~ '^.?\*{3}$'
--             from jsonb_array_elements(public.member_name_labels(array['<다른 학급 학생 id>']::uuid[])) e) as 가린_이름_true;
--   -- 6) 인증 전 구글 계정 흉내 — 1(자기 행만). <인증 전 id> = select user_id from public.member_verification where verified_at is null;
--   set local role authenticated;
--   select set_config('request.jwt.claims', '{"sub":"<인증 전 id>","role":"authenticated"}', true);
--   select current_user as 지금_역할, public.is_pending_google() as 인증_전, count(*) as 보이는_프로필 from public.profiles;

-- ═════════════════════════════════════════════
-- 0. 맨 앞 점검 — ①·②가 먼저, 다른 표 정책이 profiles 를 직접 읽지 않아야 한다
-- ═════════════════════════════════════════════
do $$
declare
  v_direct text;
begin
  if to_regprocedure('public.is_pending_google()') is null
     -- 개정 4: 새 정책이 부르는 ①의 판별 함수(그리고 화면이 가린 이름을 채울 때 쓰는 RPC)
     or to_regprocedure('public.can_see_member_name(uuid)') is null
     or to_regprocedure('public.member_name_labels(uuid[])') is null
     or not exists (
       select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'site_settings' and column_name = 'policy_effective_at'
     ) then
    raise exception '먼저 ① 20261020000000_privacy_a_schema.sql 을 실행해 주세요. 이 파일은 아무것도 바꾸지 않았습니다.';
  end if;

  if not exists (
       select 1 from pg_policies
       where schemaname = 'public' and tablename = 'profiles'
         and policyname = 'profiles: 인증 전 쓰기 제한(수정)' and permissive = 'RESTRICTIVE'
     )
     or position('is_pending_google()' in (select p.prosrc from pg_proc p where p.oid = 'public.can_browse()'::regprocedure)) = 0 then
    raise exception '먼저 ② 20261020010000_privacy_b_enforce.sql 을 실행해 주세요(③은 ② 바로 뒤에 실행합니다). 이 파일은 아무것도 바꾸지 않았습니다.';
  end if;

  -- 다른 표의 정책 식이 profiles 를 직접 조회하면, 그 정책이 비로그인 · 인증 전 계정에게 소리 없이 0행이 된다(spec 4.10 DB 쪽 점검).
  select string_agg(format('%s.%s / %s', schemaname, tablename, policyname), ', ') into v_direct
  from pg_policies
  where not (schemaname = 'public' and tablename = 'profiles')
    and (coalesce(qual, '') ~ '\mprofiles\M' or coalesce(with_check, '') ~ '\mprofiles\M');
  if v_direct is not null then
    raise exception 'profiles 를 직접 조회하는 다른 정책이 있습니다: %. 이 파일은 아무것도 바꾸지 않았습니다 — 이 메시지를 알려 주세요.', v_direct;
  end if;
end $$;

-- ═════════════════════════════════════════════
-- 1. profiles 읽기 — 로그인한 회원만(개정 4: 학생 행은 본인 · 같은 학급 학생 · 그 학급 담임만, 학급 없는 학생은 본인 · 총괄만,
--    인증 전 구글 계정은 자기 행만 — 모두 can_see_member_name 안에서). 옛 이름·새 이름 모두 지운 뒤 만든다(재실행 안전).
-- ═════════════════════════════════════════════
drop policy if exists "profiles: 누구나 조회" on public.profiles;
drop policy if exists "profiles: 로그인한 회원 조회" on public.profiles;
create policy "profiles: 로그인한 회원 조회"
  on public.profiles for select
  to authenticated
  using (public.can_see_member_name(id));

-- ═════════════════════════════════════════════
-- 2. 처리방침 시행 시각 — 처음 실행한 때(다시 실행해도 바꾸지 않는다)
-- ═════════════════════════════════════════════
update public.site_settings s
   set policy_effective_at = coalesce(s.policy_effective_at, now())
 where s.id = true;

-- ═════════════════════════════════════════════
-- 3. 맨 끝 점검 — 설계와 다르면 전부 되돌린다(아무것도 바뀌지 않음)
-- ═════════════════════════════════════════════
do $$
declare
  v_select text;
  v_n      int;
  v_at     timestamptz;
begin
  -- 3-1. SELECT(또는 ALL) 허용 정책이 정확히 하나 = 새 정책 · 대상 authenticated · 조건 can_see_member_name(id)(개정 4)
  select count(*), string_agg(policyname::text, ', ') into v_n, v_select
  from pg_policies
  where schemaname = 'public' and tablename = 'profiles' and permissive = 'PERMISSIVE' and cmd in ('SELECT', 'ALL');
  if v_n <> 1 or v_select <> 'profiles: 로그인한 회원 조회' then
    raise exception 'profiles 의 읽기 허용 정책이 "profiles: 로그인한 회원 조회" 하나가 아닙니다(%개: %). 이 파일 전체를 되돌렸습니다(아무것도 바뀌지 않음) — 이 메시지를 알려 주세요.', v_n, v_select;
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles: 로그인한 회원 조회'
      and roles = '{authenticated}'::name[]
      and position('can_see_member_name(' in coalesce(qual, '')) > 0
  ) then
    raise exception '"profiles: 로그인한 회원 조회" 정책의 대상·조건이 설계와 다릅니다. 이 파일 전체를 되돌렸습니다 — 이 메시지를 알려 주세요.';
  end if;

  -- 3-2. 비로그인 열 권한은 그대로(일부러 — 없으면 profiles(...)를 붙인 로그아웃 화면 요청이 42501 로 깨진다),
  --      정책이 부르는 판별 함수(can_see_member_name — 개정 4)는 누구나 실행(정책 평가용), 가린 이름 RPC 는 로그인한 사용자가 실행
  if not has_column_privilege('anon', 'public.profiles', 'display_name', 'SELECT')
     or not has_column_privilege('anon', 'public.profiles', 'avatar_url', 'SELECT')
     or not has_column_privilege('anon', 'public.profiles', 'withdrawn_at', 'SELECT')
     or not has_function_privilege('authenticated', 'public.is_pending_google()', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.can_see_member_name(uuid)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.member_name_labels(uuid[])', 'EXECUTE') then
    raise exception 'profiles 의 비로그인 열 권한 또는 판별 함수 권한이 설계와 다릅니다(로그아웃 화면이 깨질 수 있음). 이 파일 전체를 되돌렸습니다 — 이 메시지를 알려 주세요.';
  end if;

  -- 3-3. 시행 시각
  select s.policy_effective_at into v_at from public.site_settings s where s.id = true;
  if v_at is null then
    raise exception '처리방침 시행 시각(site_settings.policy_effective_at)을 기록하지 못했습니다. 이 파일 전체를 되돌렸습니다 — 이 메시지를 알려 주세요.';
  end if;

  raise notice '✔ ③ 프로필(이름·사진)은 이제 로그인한 회원만 읽습니다(학생 이름은 같은 학급·담임만 — 그 밖에는 첫 글자 + *** 로, 인증 전 구글 계정은 자기 것만, 비로그인 화면의 작성자는 "회원"). 처리방침 시행: % (한국 시간 %). 다음: 확인 쿼리 → 총괄이 먼저 로그인해 확인 창 마치기.',
    v_at, to_char(v_at at time zone 'Asia/Seoul', 'YYYY-MM-DD HH24:MI');
end $$;

notify pgrst, 'reload schema';
