-- 비상용 — ③(supabase/migrations/20261020020000_privacy_c_profiles_members_only.sql) 되돌리기:
--   프로필(이름·사진)을 다시 누구나 읽게 하고, 처리방침 시행 시각을 지운다
-- 설계: docs/privacy/spec.md 4.9 · 4.10 · 4.11(개정 4) · 보고: docs/privacy/build-1-report.md · build-5-report.md(개정 4)
--   개정 4: ③의 정책 이름("profiles: 로그인한 회원 조회")은 그대로이고 조건만 public.can_see_member_name(id)(학생 이름은 같은 학급·
--   담임만)로 바뀌었다 → 이 파일은 고칠 것 없이 그대로 맞는다. ①의 가리기 함수(member_name_labels 등)는 남는다 — 정책이 부르지
--   않으면 해가 없다(화면은 프로필을 다시 모두 읽으므로 가린 이름을 채울 일이 없다).
--
-- ▶ 언제 실행하나
--   ③ 뒤 로그아웃 방문자 화면이 깨지거나(작성자 칸 오류 등), 작성자가 모두 "회원"으로 보이는 것이 마음에 들지 않을 때(R17).
--   ②까지 되돌리려면 이 파일을 **먼저** 실행한 뒤 docs/privacy/rollback-privacy-enforce.sql 을 실행한다(spec 4.9 "③ → ② 순").
--   ⚠ 예전 마이그레이션 파일을 통째로 다시 돌려서 되돌리지 않는다. 이 파일만 쓴다.
--
-- ▶ 실행 방법
--   Supabase 대시보드 > SQL Editor > New query 에 이 파일 전체를 붙여넣고 Run(한 번에 전체).
--   SQL Editor 는 붙여 넣은 전체를 한 트랜잭션으로 실행하므로, 맨 끝 점검에서 오류가 나면 아무것도 바뀌지 않는다.
--   · "destructive operation(drop)" 확인 창이 뜨면 Run — 정책 하나만 지우고 옛 정책으로 다시 만든다.
--   · 여러 번 실행해도 안전하다. 다시 좁히려면 ③ 파일 전체를 다시 Run(그때 시행 시각이 새로 기록된다).
--
-- ▶ 되돌리는 것
--   · "profiles: 로그인한 회원 조회" → 옛 "profiles: 누구나 조회"(using (true) — 20260923020000_login_required_scope.sql §1 글자 그대로).
--   · site_settings.policy_effective_at → 비움(처리방침 화면은 다시 "개인정보 처리방침을 준비하고 있어요"만 보이고 링크가 숨는다 —
--     처리방침의 "이름은 로그인한 회원만 본다"는 문장이 더는 사실이 아니므로).
--   · 되돌리지 않는 것: 화면의 "회원" 폴백(그대로 둬도 무해), ②의 모든 것(필요하면 그다음에 ② 되돌리기).
--
-- ▶ 실행 후 확인 쿼리(앞의 "-- "를 지우고 한 덩어리씩 Run — 모두 읽기만 한다)
--   -- 1) profiles 의 SELECT 정책이 "profiles: 누구나 조회" 하나(qual = true)
--   select policyname, cmd, permissive, roles, qual from pg_policies
--   where schemaname = 'public' and tablename = 'profiles' and cmd in ('SELECT', 'ALL');
--   -- 2) 시행 시각이 비었는지(null)
--   select policy_effective_at from public.site_settings;
--   -- 3) 비로그인 흉내 — 전체 프로필 수(③ 이전처럼 누구나 읽음)
--   set local role anon;
--   select current_user as 지금_역할, count(*) as 보이는_프로필 from public.profiles;

drop policy if exists "profiles: 로그인한 회원 조회" on public.profiles;
drop policy if exists "profiles: 누구나 조회" on public.profiles;
create policy "profiles: 누구나 조회"
  on public.profiles for select
  using (true);

update public.site_settings s
   set policy_effective_at = null
 where s.id = true;

-- 맨 끝 점검 — 읽기 허용 정책이 옛 정책 하나인지
do $$
declare
  v_n    int;
  v_name text;
begin
  select count(*), string_agg(policyname::text, ', ') into v_n, v_name
  from pg_policies
  where schemaname = 'public' and tablename = 'profiles' and permissive = 'PERMISSIVE' and cmd in ('SELECT', 'ALL');
  if v_n <> 1 or v_name <> 'profiles: 누구나 조회' then
    raise exception 'profiles 의 읽기 허용 정책이 "profiles: 누구나 조회" 하나가 아닙니다(%개: %). 이 파일 전체를 되돌렸습니다 — 이 메시지를 알려 주세요.', v_n, v_name;
  end if;
  raise notice '✔ ③을 되돌렸습니다: 프로필(이름·사진)은 다시 누구나 읽고, 처리방침은 "준비 중"으로 돌아갔습니다. ②도 되돌리려면 이어서 docs/privacy/rollback-privacy-enforce.sql.';
end $$;

notify pgrst, 'reload schema';
