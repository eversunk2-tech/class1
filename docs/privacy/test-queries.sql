-- 개인정보 ①·②·③ 확인 · 흉내 시험 모음 — 사용자가 Supabase SQL Editor 에서 돌린다(읽기만 — 아무것도 저장하지 않는다)
-- 설계: docs/privacy/spec.md 4.9 · 8절(DB 항목) · 4.7-3(개정 3 — 보유 기한 2월 28일) · 4.11(개정 4 — 학생 아이디·이름 가리기)
-- 보고: docs/privacy/build-1-report.md · build-5-report.md(개정 3·4) · fix-1-sql-report.md(고침 1 — 19-2) · 19-3) · 27))
--
-- ▶ 쓰는 방법(꼭 읽기)
--   · 아래 블록을 **한 덩어리씩** 골라 붙여넣고 Run 한다(앞의 "-- " 는 없다 — 이 파일 전체를 한 번에 Run 하지 않는다).
--   · "한 번의 Run = 한 트랜잭션"이다: set local role · set_config(…, true)는 그 Run 안에서만 적용되고 끝나면 저절로 풀린다
--     (begin … rollback 과 같은 효과 — SQL Editor 는 마지막 문장의 결과만 보여 주므로 끝에 rollback 을 두지 않았다).
--     psql 로 할 때는 각 블록 앞뒤에 begin; / rollback; 을 붙인다.
--   · **쓰기 시험은 모두 do 블록 안에서 하고, 결과와 상관없이 마지막에 일부러 오류(메시지)로 끝낸다** → 그 Run 의 모든 변경
--     (시도 기록 · 잠금 포함)이 되돌려진다(= rollback). 메시지 첫 글자가 ✔ 면 정상, ✖ 면 그 메시지를 알려 주세요.
--     insert · update 줄에는 `current_user = 'authenticated'` 조건이 있어 그 줄만 골라 실행해도(관리자 권한) 아무것도 바뀌지 않는다.
--   · 결과는 개수 · 참거짓 · 이유 코드만 보인다(이름 · 이메일 · 코드 값은 보이지 않는다). 교사 인증 코드의 실제 값은 쓰지 않는다
--     (틀린 코드 시험은 숫자가 아닌 'abcdef' 를 넣는다 — 서버는 비교하지 않고 틀린 시도로 센다).
--   · 흉내 결과의 "지금_역할" 칸이 anon / authenticated 여야 흉내가 된 것이다(postgres 면 숫자를 믿지 말 것).
--   · <…> 자리는 0) 블록에서 찾은 id 로 바꾼다. 그런 계정이 아직 없으면 그 블록은 건너뛴다(예: 구글 선생님이 아직 없음).
--
--   · (개정 4) 학생 이름·아이디는 결과에 찍지 않는다 — 가린 값도 "첫 글자 + *** 모양인가"(참/거짓)로만 본다.
--
-- ▶ 순서: ① 뒤 → 1) · 2) · 17) · 18) / ② 전 → 2-2)(줄이 없어야 함) / ② 뒤 → 3) ~ 12) · 19) · 19-2) · (새 계정을 하나 만든 뒤) 19-3) / ③ 뒤 → 13) ~ 16) · 20) ~ 26)
--   (개정 4 시험 20) ~ 23)은 학급이 둘 이상이고 학생이 있어야 한다 — 다른 학급 학생 C 가 아직 없으면 건너뛰거나, 시험용 학급 ·
--    시험용 학생을 화면에서 만든 뒤 한다. id 는 0-2)에서 찾는다.)

-- ═════════════════════════════════════════════
-- 0) (그냥 Run = postgres 권한) 흉내 낼 id 찾기 — 이름·이메일 없이 역할 · 권한 범위 · 상태만
-- ═════════════════════════════════════════════
select p.id, p.role, p.teacher_scope, p.is_super_admin as 총괄, p.class_id is not null as 학급_있음,
       p.withdrawn_at is not null as 탈퇴, v.origin as 구글, (v.user_id is not null and v.verified_at is null and p.role = 'user') as 인증_전
from public.profiles p
left join public.member_verification v on v.user_id = p.id
order by p.role, p.teacher_scope, (v.user_id is not null), p.created_at
limit 200;

-- ═════════════════════════════════════════════
-- 0-2) (개정 4, 그냥 Run) 학급별로 흉내 낼 id 찾기 — 이름·아이디 없이 역할 · 학급 id · 담임인 학급 id 만
--      <학생A id>·<학생B id> = 같은 학급(학급 칸이 같음) 학생, <학생C id> = 다른 학급 학생, <담임T1 id> = 담임_학급에 A 의 학급이 있는 교사,
--      <총괄 id> = 총괄 true 인 교사(담임_학급에 C 의 학급이 없어야 C 가 "다른 학급 학생"이다).
-- ═════════════════════════════════════════════
select p.id, p.role, p.is_super_admin as 총괄, p.class_id as 학급,
       (select array_agg(ct.class_id order by ct.class_id) from public.class_teachers ct where ct.teacher_id = p.id) as 담임_학급,
       p.withdrawn_at is not null as 탈퇴
from public.profiles p
order by p.role desc, p.class_id nulls first, p.created_at
limit 300;

-- ═════════════════════════════════════════════
-- 1) ① 뒤: 새 표 RLS · 정책 0 · 권한 없음 / 새 열 / profiles 공개 열 그대로 / pgcrypto 위치 / 함수 권한
-- ═════════════════════════════════════════════
select c.relname as 표, c.relrowsecurity as rls,
       (select count(*) from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname) as 정책,
       has_table_privilege('anon', c.oid, 'SELECT') as anon_읽기,
       has_table_privilege('authenticated', c.oid, 'SELECT') as 로그인_읽기
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('member_verification', 'member_verification_attempts', 'verification_settings', 'class_cleanup_log')
order by 1;
-- 기대: rls true · 정책 0 · 두 읽기 false (4행)

-- ═════════════════════════════════════════════
-- 2) ① 뒤: 권한 · 위치 한눈에 — 모두 true 여야 한다
-- ═════════════════════════════════════════════
select
  (select count(*) from information_schema.column_privileges
    where table_schema = 'public' and table_name = 'profiles' and privilege_type = 'SELECT' and grantee = 'anon') = 7 as anon_공개열_7개,
  not has_column_privilege('authenticated', 'public.profiles', 'teacher_scope', 'SELECT') as 권한범위_비공개,
  exists (select 1 from pg_extension e join pg_namespace n on n.oid = e.extnamespace
           where e.extname = 'pgcrypto' and n.nspname = 'extensions') as pgcrypto_extensions,
  has_function_privilege('anon', 'public.is_pending_google()', 'execute') as 판별함수_누구나,
  not has_function_privilege('anon', 'public.verify_google_teacher(text, text, integer)', 'execute') as 인증_비로그인불가,
  not has_function_privilege('authenticated', 'public.purge_member_records(uuid)', 'execute') as 삭제함수_로그인불가,
  not has_function_privilege('authenticated', 'public.self_purge_member(uuid, text)', 'execute') as 자기삭제_로그인불가,
  has_function_privilege('service_role', 'public.admin_purge_class_member(uuid, uuid)', 'execute') as 학급정리_서비스롤,
  to_regprocedure('public.admin_log_member_create(uuid, uuid, text, text)') is null as 옛_생성기록함수_없음,
  public.withdrawal_blocking_fks() = '{}'::text[] as 탈퇴안전장치_그대로;

-- ═════════════════════════════════════════════
-- 2-2) (고침 2 — N1, 고침 3) ② 전, 그냥 Run: 이메일 모양 아이디(또는 이메일로 스스로 가입한) 계정 수 — role 이 admin 이 아닌 줄(학생 등)이
--      없어야 ②를 실행한다. admin 줄(실제 이메일로 로그인하는 총괄·교사)은 ②가 멈추지 않고 구글 관리자처럼 다룬다(확인 창 한 번).
--      이메일이 @class1.local 로 끝나지 않는데 이메일·비밀번호 로그인이 있는 계정(②의 맨 앞 점검과 같은 셈). 역할별 수만 — 이메일은 보지 않는다.
-- ═════════════════════════════════════════════
select p.role, count(*) as 이메일모양_계정
from auth.users u left join public.profiles p on p.id = u.id
where lower(coalesce(u.email, '')) not like '%@class1.local'
  and (coalesce(u.raw_app_meta_data ->> 'provider', '') = 'email'
       or (jsonb_typeof(u.raw_app_meta_data -> 'providers') = 'array' and (u.raw_app_meta_data -> 'providers') ? 'email')
       or exists (select 1 from auth.identities i where i.user_id = u.id and i.provider = 'email'))
  and not exists (select 1 from public.member_verification v where v.user_id = u.id)
group by 1 order by 1;

-- ═════════════════════════════════════════════
-- 3) ② 뒤: 백필 · 가리기 · 제한 정책 · 좁힌 정책 — 숫자를 확인한다
-- ═════════════════════════════════════════════
select
  (select count(*) from public.member_verification) as 구글_행,
  (select count(*) from public.member_verification v join public.profiles p on p.id = v.user_id
    where v.verified_at is null and p.role = 'user') as 인증_전,
  (select count(*) from public.member_directory d
    where position('@' in d.email) > 0
      and lower(d.email) not like '%@class1.local') as 가리지_않은_구글_이메일_0,   -- 고침 1: 아이디 계정 = @class1.local
  (select count(*) from public.member_verification v join public.profiles p on p.id = v.user_id
    where v.verified_at is null and p.role = 'user'
      and (p.display_name is distinct from '인증 전 회원' or p.avatar_url is not null)) as 가리지_않은_이름사진_0,
  (select count(*) from pg_policies where permissive = 'RESTRICTIVE'
    and position('is_pending_google()' in coalesce(qual, '') || coalesce(with_check, '')) > 0) as 제한정책_19,
  (select count(*) from pg_policies where position('is_full_admin()' in coalesce(qual, '') || coalesce(with_check, '')) > 0) as 좁힌정책_20,
  (select count(*) from pg_policies
    where permissive = 'PERMISSIVE'
      and ((schemaname = 'public' and tablename in ('posts', 'comments', 'praise_presets', 'community_posts',
                                                     'community_comments', 'community_likes', 'community_reports'))
        or (schemaname = 'storage' and tablename = 'objects' and policyname like 'game-uploads%'))
      and position('is_admin()' in coalesce(qual, '') || coalesce(with_check, '')) > 0) as 학급밖_is_admin_정책_1;
-- 기대: 가리지_않은_… 0 · 제한정책 19 · 좁힌정책 20 · 학급밖_is_admin 1("praise_presets: 관리자만 조회" — 일부러 그대로)

-- ═════════════════════════════════════════════
-- 4) ② 뒤: 비로그인 흉내 — 새 함수는 못 부르고(권한 오류가 정상), 판별 함수는 false
-- ═════════════════════════════════════════════
set local role anon;
select current_user as 지금_역할,
       public.is_pending_google() as 인증_전_false,
       public.is_full_admin() as 모든권한_false,
       has_function_privilege('anon', 'public.my_member_gate()', 'execute') as 창상태함수_false,
       has_function_privilege('anon', 'public.admin_set_teacher_code(text)', 'execute') as 코드함수_false;

-- ═════════════════════════════════════════════
-- 5) ② 뒤: 학생 흉내 — 창 없음(ok) · 판별 false · 읽기 가능
-- ═════════════════════════════════════════════
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"<학생 id>","role":"authenticated"}', true);
select current_user as 지금_역할,
       public.my_member_gate() ->> 'state' as 창_ok,
       public.is_pending_google() as 인증_전_false,
       public.is_full_admin() as 모든권한_false,
       public.can_browse() as 읽기_true;

-- 5-2) 학생은 교사 인증 대상이 아니다(not_applicable) · 확인 창 대상도 아니다. 통째로 Run(인증 함수가 오래된 시도 기록을
--      정리하는 쓰기를 하므로 do 블록 안에서 부르고 오류로 끝내 되돌린다).
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"<학생 id>","role":"authenticated"}', true);
do $$
declare
  r1 text;
  r2 text;
begin
  if current_user <> 'authenticated' or public.is_admin() then
    raise exception '✖ 학생 흉내가 되지 않았습니다(지금 역할 %) — 통째로 Run 해 주세요(아무것도 바뀌지 않음).', current_user;
  end if;
  r1 := public.verify_google_teacher('시험별명', 'abcdef', coalesce((select privacy_version from public.site_settings where id), 1)) ->> 'reason';
  r2 := public.acknowledge_privacy('시험별명', coalesce((select privacy_version from public.site_settings where id), 1)) ->> 'reason';
  raise exception '% 학생: 교사 인증 % · 확인 % (둘 다 not_applicable 이어야 함) — 시험이라 일부러 오류로 끝냅니다(아무것도 바뀌지 않음).',
    case when r1 = 'not_applicable' and r2 = 'not_applicable' then '✔' else '✖' end, r1, r2;
end $$;

-- ═════════════════════════════════════════════
-- 6) ② 뒤: 인증 전 구글 계정 흉내(읽기) — 창 need_code · 잠금 스위치가 켜져 있으면 can_browse false
-- ═════════════════════════════════════════════
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"<인증 전 id>","role":"authenticated"}', true);
select current_user as 지금_역할,
       public.my_member_gate() ->> 'state' as 창_need_code,
       public.my_member_gate() ->> 'origin' as 가입_종류,
       public.is_pending_google() as 인증_전_true,
       public.login_required() as 잠금_스위치,
       public.can_browse() as 읽기_가능,   -- 잠금 스위치가 true 면 false, false 면 true
       (select count(*) from public.community_posts where kind = 'board') as 게시판_글_0,
       (select count(*) from public.member_directory) as 회원명단_0;

-- ═════════════════════════════════════════════
-- 7) ② 뒤: 인증 전 구글 계정 흉내(쓰기) — 프로필 고치기 0행 · 앱 결과 · 진행 · 학습게임 글이 모두 거부(row-level security)
--    통째로 Run. 결과와 상관없이 오류로 끝나 아무것도 저장되지 않는다.
-- ═════════════════════════════════════════════
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"<인증 전 id>","role":"authenticated"}', true);
do $$
declare
  n_profile int;
  r_results text := '통과(✖)';
  r_progress text := '통과(✖)';
  r_game text := '통과(✖)';
begin
  if current_user <> 'authenticated' or not public.is_pending_google() then
    raise exception '✖ 인증 전 구글 계정 흉내가 되지 않았습니다(지금 역할 %) — 위 두 줄과 함께 통째로 Run 해 주세요(아무것도 바뀌지 않음).', current_user;
  end if;

  update public.profiles set display_name = '시험' where id = auth.uid() and current_user = 'authenticated';
  get diagnostics n_profile = row_count;

  begin
    insert into public.app_results (app_id, completed) select 'sci-test', false where current_user = 'authenticated';
  exception when insufficient_privilege then r_results := '거부(✔)';
  end;

  begin
    insert into public.app_progress (app_id, state) select 'sci-6-1-1-1', '{}'::jsonb where current_user = 'authenticated';
  exception when insufficient_privilege then r_progress := '거부(✔)';
  end;

  begin
    insert into public.community_posts (kind, title, body, game_path, game_size)
    select 'game', '시험', '', auth.uid()::text || '/' || gen_random_uuid()::text || '.html', 1
    where current_user = 'authenticated';
  exception when insufficient_privilege then r_game := '거부(✔)';
  end;

  raise exception '% 인증 전 계정: 프로필 고치기 %행(0이어야 함) · 앱 결과 % · 앱 진행 % · 학습게임 글 % — 시험이라 일부러 오류로 끝냅니다(아무것도 저장되지 않음).',
    case when n_profile = 0 and r_results like '거부%' and r_progress like '거부%' and r_game like '거부%' then '✔' else '✖' end,
    n_profile, r_results, r_progress, r_game;
end $$;

-- ═════════════════════════════════════════════
-- 8) ② 뒤: 계정당 시도 한도 — 인증 전 계정이 틀린 코드 5번 → 5번째에 잠금(15분), 6번째는 'locked'
--    (숫자가 아닌 'abcdef' 는 서버가 비교하지 않고 틀린 시도로 센다). 통째로 Run — 시도 기록·잠금은 모두 되돌려진다.
--    이미 잠긴 계정이거나 최근 10분 전체 틀린 시도가 30번 이상이면 결과가 다르게 나온다(그때는 메시지를 알려 주세요).
-- ═════════════════════════════════════════════
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"<인증 전 id>","role":"authenticated"}', true);
do $$
declare
  r jsonb;
  v_log text := '';
  i int;
begin
  if current_user <> 'authenticated' or not public.is_pending_google() then
    raise exception '✖ 인증 전 구글 계정 흉내가 되지 않았습니다(지금 역할 %) — 통째로 Run 해 주세요(아무것도 바뀌지 않음).', current_user;
  end if;
  for i in 1..6 loop
    r := public.verify_google_teacher('시험별명', 'abcdef', coalesce((select privacy_version from public.site_settings where id), 1));
    v_log := v_log || format(' %s:%s(%s)', i, r ->> 'reason', coalesce(r ->> 'attempts_left', r ->> 'locked_seconds', '-'));
  end loop;
  raise exception '% 시도 결과:% — 기대: 1~4 wrong_code(남은 4→1) · 5 wrong_code(0, 잠금 900초) · 6 locked. 시험이라 일부러 오류로 끝냅니다(아무것도 저장되지 않음).',
    case when r ->> 'reason' = 'locked' then '✔' else '✖' end, v_log;
end $$;

-- ═════════════════════════════════════════════
-- 9) ② 뒤: 전체 한도 — 최근 10분 틀린 시도 30번이면 맞는 코드도 'busy'. 통째로 Run — 넣은 시도 30줄은 되돌려진다.
--    (처음에 postgres 권한으로 가짜 틀린 시도 30줄을 넣고, 같은 Run 안에서 인증 전 계정으로 바꿔 부른다)
-- ═════════════════════════════════════════════
do $$
declare
  r jsonb;
begin
  if current_user = 'authenticated' then
    raise exception '✖ 이 블록은 그냥 Run(postgres 권한)으로 시작해야 합니다 — set local role 줄 없이 이 블록만 Run 해 주세요.';
  end if;
  insert into public.member_verification_attempts (user_id, ok)
  select null, false from generate_series(1, 30);
  set local role authenticated;
  perform set_config('request.jwt.claims', '{"sub":"<인증 전 id>","role":"authenticated"}', true);
  if not public.is_pending_google() then
    raise exception '✖ <인증 전 id> 를 인증 전 구글 계정 id 로 바꿔 주세요(아무것도 바뀌지 않음).';
  end if;
  r := public.verify_google_teacher('시험별명', 'abcdef', coalesce((select privacy_version from public.site_settings where id), 1));
  raise exception '% 전체 한도: % — 기대 busy(이 계정이 이미 잠겨 있으면 locked). 시험이라 일부러 오류로 끝냅니다(넣은 시도 30줄도 되돌림).',
    case when r ->> 'reason' in ('busy', 'locked') then '✔' else '✖' end, r ->> 'reason';
end $$;

-- ═════════════════════════════════════════════
-- 10) ② 뒤: 구글 선생님(teacher_scope 'class') 흉내 — 학급 밖 일은 거부, 학급 안 일은 그대로.
--     <구글 선생님 id> = 0)에서 role admin · teacher_scope class 인 id(아직 없으면 건너뜀). 통째로 Run — 아무것도 저장되지 않는다.
-- ═════════════════════════════════════════════
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"<구글 선생님 id>","role":"authenticated"}', true);
do $$
declare
  r_post   text := '통과(✖)';
  r_praise text := '통과(✖)';
  r_game   text := '거부 대상 없음(-)';
  r_scope  text := '통과(✖)';
  r_class  text := '거부(✖)';
  v_game   uuid;
begin
  if current_user <> 'authenticated' or not public.is_admin() or public.is_full_admin() then
    raise exception '✖ "자기 학급 일만" 선생님 흉내가 되지 않았습니다(지금 역할 %) — id 를 확인해 주세요(아무것도 바뀌지 않음).', current_user;
  end if;

  begin
    insert into public.posts (slug, title) select 'privacy-test-' || floor(random() * 1000000)::text, '시험' where current_user = 'authenticated';
  exception when insufficient_privilege then r_post := '거부(✔)';
  end;

  begin
    insert into public.praise_presets (body) select '시험' where current_user = 'authenticated';
  exception when insufficient_privilege then r_praise := '거부(✔)';
  end;

  select p.id into v_game from public.community_posts p where p.kind = 'game' and not p.hidden limit 1;
  if v_game is not null then
    begin
      perform public.set_community_post_hidden(v_game, true);
      r_game := '숨김(✖)';
    exception when raise_exception then
      r_game := case when sqlerrm = 'admin only' then '거부(✔)' else '다른 오류: ' || sqlerrm end;
    end;
  end if;

  begin
    perform public.admin_set_teacher_scope(auth.uid(), 'full');
  exception when raise_exception then r_scope := '거부(✔)';
  end;

  begin
    perform public.create_class('개인정보 시험 학급');
    r_class := '가능(✔)';
  exception when others then r_class := '거부(✖): ' || sqlerrm;
  end;

  raise exception '% 자기 학급 일만 선생님: 블로그 글 % · 칭찬 문구 % · 학습게임 숨기기 % · 권한 넓히기 % · 학급 만들기 % — 시험이라 일부러 오류로 끝냅니다(아무것도 저장되지 않음).',
    case when r_post like '거부%' and r_praise like '거부%' and r_game not like '숨김%' and r_game not like '다른%'
              and r_scope like '거부%' and r_class like '가능%' then '✔' else '✖' end,
    r_post, r_praise, r_game, r_scope, r_class;
end $$;

-- ═════════════════════════════════════════════
-- 11) ② 뒤: 총괄이 아닌 교사(teacher_scope full — 아이디 교사 등) 흉내 — 권한 범위 바꾸기 · 코드 정하기는 총괄만(거부)
--     <총괄이 아닌 교사 id>(아직 없으면 건너뜀). 통째로 Run.
-- ═════════════════════════════════════════════
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"<총괄이 아닌 교사 id>","role":"authenticated"}', true);
do $$
declare
  r_scope text := '통과(✖)';
  r_code  text := '통과(✖)';
  r_over  text := '통과(✖)';
begin
  if current_user <> 'authenticated' or not public.is_admin() or public.is_super_admin() then
    raise exception '✖ 총괄이 아닌 교사 흉내가 되지 않았습니다(지금 역할 %) — id 를 확인해 주세요(아무것도 바뀌지 않음).', current_user;
  end if;
  begin
    perform public.admin_set_teacher_scope(gen_random_uuid(), 'class');
  exception when raise_exception then r_scope := '거부(✔)';
  end;
  begin
    perform public.admin_set_teacher_code('abcdef');
  exception when raise_exception then r_code := '거부(✔)';
  end;
  begin
    perform public.admin_privacy_overview();
  exception when raise_exception then r_over := '거부(✔)';
  end;
  raise exception '% 총괄이 아닌 교사: 권한 범위 % · 코드 정하기 % · 현황 보기 % — 시험이라 일부러 오류로 끝냅니다(아무것도 저장되지 않음).',
    case when r_scope like '거부%' and r_code like '거부%' and r_over like '거부%' then '✔' else '✖' end, r_scope, r_code, r_over;
end $$;

-- ═════════════════════════════════════════════
-- 12) ② 뒤: 로그인한 사용자는 서비스 롤 전용 함수를 부를 수 없다(권한 오류가 정상). <학생 id> 로. 통째로 Run.
-- ═════════════════════════════════════════════
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"<학생 id>","role":"authenticated"}', true);
do $$
declare
  r1 text := '통과(✖)';
  r2 text := '통과(✖)';
  r3 text := '통과(✖)';
begin
  if current_user <> 'authenticated' then
    raise exception '✖ 흉내가 되지 않았습니다(지금 역할 %) — 통째로 Run 해 주세요.', current_user;
  end if;
  begin
    perform public.purge_member_records(auth.uid());
  exception when insufficient_privilege then r1 := '거부(✔)';
  end;
  begin
    perform public.self_purge_member(auth.uid(), 'cancel');
  exception when insufficient_privilege then r2 := '거부(✔)';
  end;
  begin
    perform public.admin_purge_class_member(auth.uid(), auth.uid());
  exception when insufficient_privilege then r3 := '거부(✔)';
  end;
  raise exception '% 서비스 롤 전용 함수: 기록 지우기 % · 자기 삭제 % · 학급 정리 % — 시험이라 일부러 오류로 끝냅니다(아무것도 바뀌지 않음).',
    case when r1 like '거부%' and r2 like '거부%' and r3 like '거부%' then '✔' else '✖' end, r1, r2, r3;
end $$;

-- ═════════════════════════════════════════════
-- 13) ③ 뒤: 정책 · 시행 시각 · 비로그인 열 권한
-- ═════════════════════════════════════════════
select
  (select string_agg(policyname::text, ', ') from pg_policies
    where schemaname = 'public' and tablename = 'profiles' and permissive = 'PERMISSIVE' and cmd in ('SELECT', 'ALL')) as 읽기정책,
  (select policy_effective_at is not null from public.site_settings where id) as 시행됨,
  has_column_privilege('anon', 'public.profiles', 'display_name', 'SELECT') as anon_열권한_그대로;
-- 기대: 읽기정책 = "profiles: 로그인한 회원 조회" · 시행됨 true · anon_열권한_그대로 true(일부러)

-- ═════════════════════════════════════════════
-- 14) ③ 뒤: 비로그인 흉내 — 프로필 0행(오류 없음) · 학습게임 글은 그대로 보이고 글쓴이 이름만 빈 값(화면은 "회원")
-- ═════════════════════════════════════════════
set local role anon;
select current_user as 지금_역할,
       (select count(*) from public.profiles) as 보이는_프로필_0,
       (select count(*) from public.community_posts where kind = 'game') as 보이는_학습게임_글,
       (select count(*) from public.community_posts g
         where g.kind = 'game'
           and (select pr.display_name from public.profiles pr where pr.id = g.author_id) is not null) as 이름이_보이는_글_0;
-- 보이는_학습게임_글은 로그인 잠금이 꺼져 있으면 숨기지 않은 학습게임 글 수, 켜져 있으면 0.

-- ═════════════════════════════════════════════
-- 15) ③ 뒤: 학생 흉내 — (개정 4) 선생님 + 같은 학급 학생(본인 포함)만. 먼저 그냥 Run(postgres)으로 기대값을 센다:
--       select count(*) from public.profiles
--       where role <> 'user' or id = '<학생 id>' or class_id = (select class_id from public.profiles where id = '<학생 id>');
--     그다음 아래 세 줄을 함께 Run — 보이는_프로필이 위 기대값과 같아야 한다(다른 학급 학생 행은 보이지 않는다).
-- ═════════════════════════════════════════════
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"<학생 id>","role":"authenticated"}', true);
select current_user as 지금_역할, (select count(*) from public.profiles) as 보이는_프로필_선생님과_같은반;

-- ═════════════════════════════════════════════
-- 16) ③ 뒤: 인증 전 구글 계정 흉내 — 자기 프로필 1행만
-- ═════════════════════════════════════════════
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"<인증 전 id>","role":"authenticated"}', true);
select current_user as 지금_역할, public.is_pending_google() as 인증_전,
       (select count(*) from public.profiles) as 보이는_프로필_1,
       (select count(*) from public.profiles where id = auth.uid()) as 내_프로필_1;

-- ═════════════════════════════════════════════
-- 17) (개정 3·4) ① 뒤, 그냥 Run(postgres): 학급 정리 기한 날짜 계산 · 가린 글자 — ①의 맨 끝 점검이 이미 같은 예로 시험했다.
--     눈으로 한 번 더 본다(학생 수·이름 없음 — 날짜와 만든 예시 글자만). build-5-report.md 의 날짜 표와 같아야 한다.
-- ═════════════════════════════════════════════
select v.d as 오늘,
       x.w ->> 'school_year_start' as 학년도_시작,
       x.w ->> 'overdue_before'    as 이날_전_가입_기한지남,
       x.w ->> 'february_from'     as 이월알림_가입_부터,
       x.w ->> 'february_before'   as 이월알림_가입_이날_전까지,
       x.w ->> 'deadline'          as 기한,
       x.w ->> 'past_deadline'     as 기한_지난_날,
       x.w ->> 'in_february'       as 이월알림_날
from (values (date '2026-03-01'), (date '2026-12-31'), (date '2027-01-15'), (date '2027-02-10'), (date '2027-02-28'),
             (date '2027-03-01'), (date '2028-02-29'), ((now() at time zone 'Asia/Seoul')::date)) as v(d),
     lateral (select public.privacy_retention_window(v.d) as w) x;

select public.mask_label('  2026a ') as "앞뒤 공백 → 2***",
       public.mask_label('김철수') as "김***",
       public.mask_label('') as "빈 값 → ***",
       public.mask_label(public.privacy_name_source('  ', '2026a@class1.local')) as "이름 빔 → 아이디 → 2***",
       public.mask_label(split_part('2026a@class1.local', '@', 1)) as "아이디 칸 → 2***";

-- ═════════════════════════════════════════════
-- 18) (개정 4) ① 뒤: 가리기 함수 권한 — 앞 4개 true, 뒤 6개 false
-- ═════════════════════════════════════════════
select has_function_privilege('anon', 'public.can_see_member_name(uuid)', 'execute')                 as 이름판별_누구나,
       has_function_privilege('anon', 'public.can_see_member_identity(uuid)', 'execute')             as 아이디판별_누구나,
       has_function_privilege('authenticated', 'public.member_name_labels(uuid[])', 'execute')       as 이름라벨_로그인,
       has_function_privilege('authenticated', 'public.admin_masked_member_rows(uuid)', 'execute')   as 가린줄_로그인,
       has_function_privilege('anon', 'public.member_name_labels(uuid[])', 'execute')                as 이름라벨_비로그인_false,
       has_function_privilege('anon', 'public.admin_masked_member_rows(uuid)', 'execute')            as 가린줄_비로그인_false,
       has_function_privilege('authenticated', 'public.mask_label(text)', 'execute')                 as 가린글자_직접_false,
       has_function_privilege('authenticated', 'public.privacy_btrim(text)', 'execute')              as 공백도우미_직접_false,
       has_function_privilege('authenticated', 'public.privacy_name_source(text, text)', 'execute')  as 원래값도우미_직접_false,
       has_function_privilege('authenticated', 'public.privacy_retention_window(date)', 'execute')   as 기한계산_직접_false;

-- ═════════════════════════════════════════════
-- 19) (개정 4) ② 뒤, 그냥 Run: 회원 명단 · 감사 기록 3개의 읽기 정책(표마다 "…: 학생은 담임만 조회" 한 줄 — 4행 모두 true)과
--     함수 두 개(비밀번호 변경 필요 표시 범위 · 다른 학급 학생 교사 지정 거부)
-- ═════════════════════════════════════════════
select tablename, policyname, roles,
       position('can_see_member_identity(' in coalesce(qual, '')) > 0 as 담임만_조건_true
from pg_policies
where schemaname = 'public'
  and tablename in ('member_directory', 'password_reset_log', 'member_withdrawal_log', 'member_create_log')
order by 1;

select position('can_see_member_identity(' in (select prosrc from pg_proc where oid = 'public.admin_must_change_password_ids()'::regprocedure)) > 0
         as 비번변경표시_범위_true,
       position('다른 학급 학생은 교사로 지정할 수 없어요.' in (select prosrc from pg_proc where oid = 'public.admin_set_role(uuid, text)'::regprocedure)) > 0
         as 교사지정_거부_true;

-- ═════════════════════════════════════════════
-- 19-2) (고침 1·2) ② 뒤, 그냥 Run: 사진 주소 · 구글 관리자 이름 · 감사 기록 이메일 · 수정 권한 — 0 · 0 · 0 · 0 · false · true
--       (구글 등 계정 = 이메일이 @class1.local 이 아닌 계정. 이름·이메일은 찍지 않는다)
-- ═════════════════════════════════════════════
select
  (select count(*) from public.profiles p left join public.member_directory d on d.id = p.id
    where p.avatar_url is not null
      and (p.role = 'user' or (d.id is not null and lower(d.email) not like '%@class1.local'))) as 사진주소_남은_학생_구글_0,
  (select count(*) from public.profiles p join public.member_directory d on d.id = p.id join auth.users u on u.id = p.id
    where p.role = 'admin' and lower(d.email) not like '%@class1.local'
      and p.display_name is distinct from '선생님'
      and not exists (select 1 from public.member_verification v where v.user_id = p.id and v.ack_at is not null)
      and (nullif(btrim(coalesce(p.display_name, '')), '') is null    -- 고침 2: 이름이 아직 구글이 준 이름(또는 빈 값)
           or btrim(p.display_name) in (btrim(left(coalesce(u.raw_user_meta_data ->> 'full_name', ''), 50)),
                                        btrim(left(coalesce(u.raw_user_meta_data ->> 'name', ''), 50)),
                                        btrim(left(split_part(coalesce(u.email, ''), '@', 1), 50))))) as 구글이름_그대로인_관리자_0,
  (select count(*) from public.member_withdrawal_log
    where position('@' in coalesce(target_email, '')) > 0 and lower(target_email) not like '%@class1.local')
  + (select count(*) from public.member_create_log
    where position('@' in coalesce(target_email, '')) > 0 and lower(target_email) not like '%@class1.local') as 감사기록_구글이메일_0,
  (select count(*) from public.member_create_log l join public.profiles p on p.id = l.actor_id
     join public.member_directory d on d.id = p.id
    where lower(d.email) not like '%@class1.local' and l.actor_name is distinct from p.display_name) as 처리자_예전이름_0,
  has_column_privilege('authenticated', 'public.profiles', 'avatar_url', 'UPDATE') as 사진수정권한_false,
  has_column_privilege('authenticated', 'public.profiles', 'display_name', 'UPDATE') as 별명수정권한_true;

-- ═════════════════════════════════════════════
-- 19-3) (고침 1 — M3) ② 뒤 관리자 화면에서 학생(또는 교사) 계정을 처음 하나 만든 다음, 그냥 Run: 관리자가 만든 아이디 계정
--       (@class1.local)이 '인증 전'으로 묶이지 않았는지 — 0 · 0 · 0 이어야 한다(아니면 그 계정은 과학 앱 기록·글이 막힌다 — 알려 주세요).
--       <새 계정 id> = 0-2)에서 가장 최근에 만든 계정(created_at 순). 이름·아이디는 찍지 않는다.
-- ═════════════════════════════════════════════
select
  (select count(*) from public.member_verification v join public.member_directory d on d.id = v.user_id
    where lower(d.email) like '%@class1.local') as 아이디계정_인증행_0,
  (select count(*) from public.profiles p join public.member_directory d on d.id = p.id
    where lower(d.email) like '%@class1.local' and p.display_name = '인증 전 회원') as 아이디계정_중립이름_0,
  (select count(*) from public.member_verification where user_id = '<새 계정 id>') as 새계정_인증행_0,
  (select count(*) from public.member_verification v
    where v.user_id in (select l.target_id from public.member_create_log l)) as 관리자가_만든_계정_인증행_0,
  (select position('@' in email) > 0 and lower(email) like '%@class1.local'
     from public.member_directory where id = '<새 계정 id>') as 새계정_아이디_그대로_true;

-- ═════════════════════════════════════════════
-- 20) (개정 4) ②·③ 뒤: 학생 A 흉내 — 같은 학급 B 이름은 온전히, 다른 학급 C 이름은 가린 값으로만, 선생님 이름은 온전히,
--     회원 명단은 0(학생은 원래 못 읽음). 세 줄을 함께 Run. 이름은 찍지 않는다(참/거짓 · 개수만).
-- ═════════════════════════════════════════════
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"<학생A id>","role":"authenticated"}', true);
select current_user as 지금_역할,
       public.can_see_member_name('<학생B id>') as 같은반_B_이름_true,
       public.can_see_member_name('<학생C id>') as 다른반_C_이름_false,
       public.can_see_member_name('<담임T1 id>') as 선생님_이름_true,
       (select count(*) from public.profiles where id = '<학생B id>') as B_프로필_1,
       (select count(*) from public.profiles where id = '<학생C id>') as C_프로필_0,
       (select count(*) from public.profiles where id = '<담임T1 id>') as 선생님_프로필_1,
       (select bool_and(case when e ->> 'id' = '<학생C id>'
                             then (e ->> 'masked')::boolean
                                  and (e ->> 'display_name') ~ '^.?\*{3}$'
                                  and jsonb_typeof(e -> 'avatar_url') = 'null'
                             else not (e ->> 'masked')::boolean end)
          from jsonb_array_elements(public.member_name_labels(array['<학생B id>', '<학생C id>']::uuid[])) e) as 라벨_B온전_C가림_true,
       jsonb_array_length(public.member_name_labels(array['<학생B id>', '<학생C id>']::uuid[])) as 라벨_2,
       (select count(*) from public.member_directory) as 회원명단_0,
       public.admin_masked_member_rows() = '[]'::jsonb as 가린줄_없음_true;

-- ═════════════════════════════════════════════
-- 21) (개정 4) ②·③ 뒤: 담임 T1 흉내(총괄이 아닌 담임 — 없으면 건너뛰고 22)로) — 자기 반 A·B 는 이름·아이디 모두 온전히,
--     다른 반 C 는 이름은 가린 값으로만 · 아이디(회원 명단 줄)와 감사 기록은 못 읽음. 세 줄을 함께 Run.
-- ═════════════════════════════════════════════
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"<담임T1 id>","role":"authenticated"}', true);
select current_user as 지금_역할,
       public.can_see_member_name('<학생A id>') as A_이름_true,
       public.can_see_member_name('<학생C id>') as C_이름_false,
       public.can_see_member_identity('<학생A id>') as A_아이디_true,
       public.can_see_member_identity('<학생C id>') as C_아이디_false,
       (select count(*) from public.member_directory where id in ('<학생A id>', '<학생B id>')) as 명단_AB_2,
       (select count(*) from public.member_directory where id = '<학생C id>') as 명단_C_0,
       (select count(*) from public.member_create_log where target_id = '<학생C id>')
         + (select count(*) from public.password_reset_log where target_id = '<학생C id>')
         + (select count(*) from public.member_withdrawal_log where target_id = '<학생C id>') as C_감사기록_0,
       (select bool_and((e ->> 'masked')::boolean and (e ->> 'display_name') ~ '^.?\*{3}$')
          from jsonb_array_elements(public.member_name_labels(array['<학생C id>']::uuid[])) e) as C_가린이름_true,
       public.admin_masked_member_rows() = '[]'::jsonb as 가린줄_없음_true;

-- ═════════════════════════════════════════════
-- 22) (개정 4) ②·③ 뒤: 총괄 S 흉내 — 학생마다 "표 줄 + 가린 줄 = 1". 총괄이 그 학생의 담임이면 표 1 · 가린 줄 0(이름·아이디 온전히),
--     아니면 표 0 · 가린 줄 1(첫 글자 + *** · 사진 없음). 감사 기록은 담임일 때만. 관리 권한(비밀번호 초기화 · 탈퇴 · 기록까지 삭제)은
--     어느 학생이든 그대로(can_manage_member true). 세 줄을 함께 Run.
-- ═════════════════════════════════════════════
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"<총괄 id>","role":"authenticated"}', true);
select current_user as 지금_역할,
       public.is_super_admin() as 총괄_true,
       public.teaches_student('<학생A id>') as A_담임인가,
       (select count(*) from public.member_directory where id = '<학생A id>') as A_표줄,
       jsonb_array_length(public.admin_masked_member_rows('<학생A id>')) as A_가린줄,
       public.teaches_student('<학생C id>') as C_담임인가_false,
       (select count(*) from public.member_directory where id = '<학생C id>') as C_표줄_0,
       jsonb_array_length(public.admin_masked_member_rows('<학생C id>')) as C_가린줄_1,
       (select bool_and((r ->> 'masked')::boolean
                        and (r ->> 'email') ~ '^.?\*{3}$'
                        and (r -> 'profiles' ->> 'display_name') ~ '^.?\*{3}$'
                        and jsonb_typeof(r -> 'profiles' -> 'avatar_url') = 'null')
          from jsonb_array_elements(public.admin_masked_member_rows('<학생C id>')) r) as C_가린모양_true,
       (select count(*) from public.profiles where id = '<학생C id>') as C_프로필_0,
       (select count(*) from public.member_create_log where target_id = '<학생C id>') as C_생성기록_0,
       public.can_manage_member('<학생C id>') as C_관리권한_그대로_true,
       public.can_see_member_identity('<담임T1 id>') as 선생님_명단_true;

-- ═════════════════════════════════════════════
-- 23) (개정 4) ② 뒤: 총괄 S 가 다른 학급 학생 C 를 교사로 지정하면 거부("다른 학급 학생은 교사로 지정할 수 없어요.").
--     통째로 Run — 결과와 상관없이 오류로 끝나 아무것도 바뀌지 않는다. do 블록 안의 <학생C id> 도 바꾼다.
-- ═════════════════════════════════════════════
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"<총괄 id>","role":"authenticated"}', true);
do $$
declare
  r text := '통과(✖)';
begin
  if current_user <> 'authenticated' or not public.is_super_admin() then
    raise exception '✖ 총괄 흉내가 되지 않았습니다(지금 역할 %) — 통째로 Run 해 주세요(아무것도 바뀌지 않음).', current_user;
  end if;
  if public.teaches_student('<학생C id>') then
    raise exception '✖ <학생C id> 는 총괄이 담임인 학생입니다 — 다른 학급 학생 id 로 바꿔 주세요(아무것도 바뀌지 않음).';
  end if;
  begin
    perform public.admin_set_role('<학생C id>', 'admin');
  exception when raise_exception then
    r := case when sqlerrm = '다른 학급 학생은 교사로 지정할 수 없어요.' then '거부(✔)' else '다른 오류: ' || sqlerrm end;
  end;
  raise exception '% 다른 학급 학생 교사 지정: % — 시험이라 일부러 오류로 끝냅니다(아무것도 바뀌지 않음).',
    case when r like '거부%' then '✔' else '✖' end, r;
end $$;

-- ═════════════════════════════════════════════
-- 24) (개정 4) ③ 뒤: 비로그인 흉내 — 판별은 모두 false, 가린 이름 RPC 는 실행 권한 없음, 프로필 0행
-- ═════════════════════════════════════════════
set local role anon;
select current_user as 지금_역할,
       public.can_see_member_name('<학생A id>') as 이름_false,
       public.can_see_member_identity('<학생A id>') as 아이디_false,
       has_function_privilege('anon', 'public.member_name_labels(uuid[])', 'execute') as 라벨함수_false,
       (select count(*) from public.profiles) as 프로필_0;

-- ═════════════════════════════════════════════
-- 25) (개정 4) ②·③ 뒤: 인증 전 구글 계정 흉내 — 가린 이름도 받지 않는다(빈 배열), 선생님 이름도 못 봄, 자기 프로필만
-- ═════════════════════════════════════════════
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"<인증 전 id>","role":"authenticated"}', true);
select current_user as 지금_역할,
       public.member_name_labels(array['<학생A id>', '<담임T1 id>']::uuid[]) = '[]'::jsonb as 라벨_빈배열_true,
       public.can_see_member_name('<담임T1 id>') as 선생님_이름_false,
       (select count(*) from public.profiles) as 프로필_1;

-- ═════════════════════════════════════════════
-- 26) (개정 3) ① 뒤: 학급 정리 기한 현황 흉내(총괄 또는 담임) — 학급 이름은 찍지 않는다. 학급줄_모양_true 는 학급마다
--     overdue_students · february_students 가 있고 old_students = 둘의 합인지(기한 대상 학급이 없으면 빈 값).
-- ═════════════════════════════════════════════
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"<총괄 id>","role":"authenticated"}', true);
select current_user as 지금_역할,
       x.r ->> 'today' as 오늘,
       x.r ->> 'deadline' as 기한,
       x.r ->> 'cutoff' as 이날_전_가입_기한지남,
       x.r ->> 'past_deadline' as 기한_지난_날,
       x.r ->> 'in_february' as 이월알림_날,
       x.r ->> 'overdue_total' as 기한지남_학생,
       x.r ->> 'february_total' as 이월알림_학생,
       x.r ->> 'due_total' as 합계,
       jsonb_array_length(x.r -> 'classes') as 학급_수,
       (select bool_and(c ? 'overdue_students' and c ? 'february_students'
                        and (c ->> 'old_students')::int = (c ->> 'overdue_students')::int + (c ->> 'february_students')::int)
          from jsonb_array_elements(x.r -> 'classes') c) as 학급줄_모양_true
from (select public.admin_class_retention_status() as r) x;

-- ═════════════════════════════════════════════
-- 27) (고침 1 — L3) ③ 뒤: 처리방침이 시행된 뒤에는 총괄도 문의 이메일을 비우지 못한다. 통째로 Run — 결과와 상관없이 오류로 끝나
--     아무것도 바뀌지 않는다(문의 이메일 값은 찍지 않는다).
-- ═════════════════════════════════════════════
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"<총괄 id>","role":"authenticated"}', true);
do $$
declare
  r text := '지워짐(✖)';
begin
  if current_user <> 'authenticated' or not public.is_super_admin() then
    raise exception '✖ 총괄 흉내가 되지 않았습니다(지금 역할 %) — 통째로 Run 해 주세요(아무것도 바뀌지 않음).', current_user;
  end if;
  begin
    perform public.admin_set_contact_email(null);
  exception when raise_exception then
    r := case when sqlerrm = '처리방침이 시행된 뒤에는 문의 이메일을 비울 수 없어요. 다른 주소로 바꿔 주세요.' then '거부(✔)'
              else '다른 오류: ' || sqlerrm end;
  end;
  raise exception '% 시행 뒤 문의 이메일 비우기: % — 시험이라 일부러 오류로 끝냅니다(아무것도 바뀌지 않음).',
    case when r like '거부%' then '✔' else '✖' end, r;
end $$;
