-- 비상용 — ②(supabase/migrations/20261020010000_privacy_b_enforce.sql) 되돌리기: 개인정보 ② 이전의 권한·함수로
-- 설계: docs/privacy/spec.md 4.9 · 4.11(개정 4) · 보고: docs/privacy/build-1-report.md · build-5-report.md(개정 4)
--
-- ▶ 언제 실행하나
--   ②를 실행한 뒤 수업 중에 문제가 생겨(예: 교사가 학습게임을 관리하지 못함, 학생 기록이 저장되지 않음) 원인을 찾는 동안
--   곧바로 ② 이전 상태로 돌려야 할 때만. ⚠ 예전 마이그레이션 파일을 통째로 다시 돌려서 되돌리지 않는다(다른 정책까지 덮는다).
--   ③(20261020020000_privacy_c_profiles_members_only.sql)도 실행했다면 **docs/privacy/rollback-profiles-members-only.sql 을 먼저**
--   실행하기를 권한다(spec 4.9 "③ → ② 순"). ③을 남겨 둬도 동작은 한다(아래 "되돌린 뒤" 참고) — 이 파일은 알림만 낸다.
--
-- ▶ 실행 방법
--   Supabase 대시보드 > SQL Editor > New query 에 이 파일 전체를 붙여넣고 Run(한 번에 전체).
--   SQL Editor 는 붙여 넣은 전체를 한 트랜잭션으로 실행하므로, 맨 끝 점검에서 오류가 나면 아무것도 바뀌지 않는다.
--   (psql 등 다른 도구로 실행할 때는 psql -1 -v ON_ERROR_STOP=1 -f <파일> 처럼 "한 트랜잭션 + 오류 시 멈춤"으로.)
--   · "destructive operation(drop)" 확인 창이 뜨면 Run — 정책을 지우고 옛 정의로 다시 만든다.
--   · 여러 번 실행해도 안전하다(drop … if exists + create policy, create or replace function).
--   · 다시 켜려면: 원인을 고친 뒤 ② 파일 전체를 다시 Run(맨 앞 점검 — 코드·문의 이메일이 그대로 있어야 한다).
--
-- ▶ 되돌리는 것 — ②가 바꾼 것 전부. 옛 정의는 기존 마이그레이션의 "마지막 정의"를 글자 그대로 옮겼다.
--   · 제한 정책 19개(인증 전 쓰기 제한) 지우기.
--   · 함수 10개: can_browse · handle_new_user · sync_member_directory(20260923010000 · 20260923000000 · 20260921020000),
--     admin_set_role · get_or_create_feedback_thread(20260927010000), record_post_read(20260921020000),
--     학습게임 관리 RPC 4개(20260928010000 §5).
--   · 정책 20개: is_full_admin() → is_admin()(교사 누구나 — 20260928010000 · 20260923010000 · 20260927030000 · 20260921000000 ·
--     20260922040000 · 20260922020000 의 마지막 정의).
--   · (개정 4) 회원 명단 · 감사 기록 3개의 읽기 정책 "…: 학생은 담임만 조회"(can_see_member_identity) → 옛 "…: 담임·총괄 조회"
--     (can_manage_member — 총괄은 모든 줄), admin_must_change_password_ids() → 옛 정의(20260927010000 §3-1~3-5 글자 그대로).
--     admin_set_role 의 "다른 학급 학생은 교사로 지정할 수 없어요." 거부도 위 함수 10개 되돌리기(옛 정의)로 함께 빠진다.
--   · member_verification 의 **인증 전 줄**(verified_at 없음 — 인증 전 구글 계정과 아직 확인하지 않은 구글 관리자)을 지운다.
--     까닭: 남겨 두면 ①의 화면 RPC 가 계속 창을 띄우고, 인증 코드를 넣으면 교사(role admin)가 되는데 되돌린 뒤에는 정책이
--     is_admin() 이라 **모든 교사 권한**이 된다(② 이전에는 구글 계정이 스스로 교사가 될 수 없었다). 지우면 verify_google_teacher 는
--     not_applicable, my_member_gate 는 ok — 창이 뜨지 않는다. 시도 기록·잠금도 함께 사라진다(②를 다시 켜면 백필이 다시 만든다 —
--     그때 모든 구글 계정의 origin 은 'existing').
--
-- ▶ 되돌리지 않는 것(되돌릴 수 없음 · 필요 없음)
--   · 가린 구글 이메일(member_directory.email = k***)과 '인증 전 회원'으로 바꾼 이름 · 비운 사진 주소(결정 10·12 — 원래 값은 auth 에만).
--   · (고침 1) ②가 비운 학생 · 구글 등 계정의 사진 주소, '선생님'으로 바꾼 구글 관리자 이름, 계정 만들기 기록의 처리자 이름,
--     감사 기록(탈퇴 · 계정 만들기)에서 가린 이메일 · 이름 — 원래 값이 남아 있지 않아 되돌릴 수 없다. 수정 권한(별명 · 사진 주소)만
--     ② 전으로 되돌린다(3-19). 아이디 계정 판정(@class1.local)은 함수 옛 정의(가입 방식 기준)로 돌아간다.
--   · 인증을 마친 구글 선생님: role admin(교사)으로 남는다. 되돌린 동안에는 정책이 is_admin() 이라 학급 밖 일(학습게임 관리 ·
--     블로그 · 칭찬 문구)도 할 수 있다 — 원하지 않으면 총괄이 '담임 해제'한다. teacher_scope 열 값('class')은 남지만 쓰이지 않는다.
--   · ①의 표·열·함수(쓰이지 않을 뿐 해가 없다). 처리방침 시행 시각은 ③ 되돌리기가 지운다.
--     (개정 4) ①의 가리기 함수(can_see_member_name · can_see_member_identity · member_name_labels · admin_masked_member_rows ·
--     mask_label 등)도 남는다 — ②·③ 정책이 부르지 않으면 판별 함수는 "지금 로그인한 나"에 대한 참/거짓만, 화면 RPC 는 첫 글자 + '***'만
--     돌려주므로 해가 없다(가리기를 다시 켜려면 ②를 다시 Run).
--
-- ▶ 되돌린 뒤 사이트는(= ② 이전과 같다)
--   · 구글 새 가입은 다시 일반 회원(role user)으로 시작하고 구글 이름·사진이 프로필에 복사된다(창 없음).
--   · 교사(role admin) 누구나 학습게임 숨기기·삭제·신고 처리 · 블로그 글 · 칭찬 문구를 고친다.
--   · ③을 남겨 둔 경우: 프로필은 여전히 로그인한 회원만 읽고, 학생 이름은 같은 학급·담임만 온전히 본다(개정 4 — ③의 정책이
--     ①의 can_see_member_name 을 부름). 총괄은 회원 명단 표에서 다른 학급 학생 줄(아이디)은 다시 읽지만 그 줄의 이름(profiles)은
--     비어 보인다 — 그래서 ③ 되돌리기를 **먼저** 하기를 권한다.
--
-- ▶ 실행 후 확인 쿼리(앞의 "-- "를 지우고 한 덩어리씩 Run — 모두 읽기만 한다)
--   -- 1) 제한 정책 0 · is_full_admin() 을 부르는 정책 0
--   select (select count(*) from pg_policies where permissive = 'RESTRICTIVE'
--            and (qual like '%is_pending_google%' or with_check like '%is_pending_google%')) as 제한_정책,
--          (select count(*) from pg_policies where qual like '%is_full_admin%' or with_check like '%is_full_admin%') as 좁힌_정책;
--   -- 2) 인증 전 줄 0 · 남은 줄(인증 마친 구글 선생님)
--   select count(*) filter (where verified_at is null) as 인증_전_줄, count(*) as 남은_줄 from public.member_verification;
--   -- 3) 함수 본문에 is_pending_google · is_full_admin · (개정 4) can_see_member_identity 가 남지 않았는지(0)
--   select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public'
--     and p.proname in ('can_browse', 'handle_new_user', 'sync_member_directory', 'admin_set_role', 'record_post_read',
--                       'get_or_create_feedback_thread', 'set_community_post_hidden', 'set_community_comment_hidden',
--                       'set_community_report_status', 'resolve_community_reports_for', 'admin_must_change_password_ids')
--     and (position('is_pending_google' in p.prosrc) > 0 or position('is_full_admin' in p.prosrc) > 0
--          or position('member_verification' in p.prosrc) > 0 or position('can_see_member_identity' in p.prosrc) > 0);
--   -- 4) (개정 4) 회원 명단 · 감사 기록 3개의 읽기 정책이 옛 "…: 담임·총괄 조회"(can_manage_member) 하나씩(4행)
--   select tablename, policyname, roles, qual from pg_policies
--   where schemaname = 'public'
--     and tablename in ('member_directory', 'password_reset_log', 'member_withdrawal_log', 'member_create_log')
--   order by 1;

-- ═════════════════════════════════════════════
-- 0. 맨 앞 점검(알림만)
-- ═════════════════════════════════════════════
do $$
begin
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles'
               and policyname = 'profiles: 로그인한 회원 조회') then
    raise notice '⚠ ③(프로필은 로그인한 회원만)이 아직 적용돼 있습니다. 순서는 ③ 되돌리기 → 이 파일을 권합니다(③을 남겨 둬도 동작합니다 — 머리말 참고).';
  end if;
  if to_regprocedure('public.can_manage_board(uuid)') is null then
    raise exception '⑧ 20260928010000_teacher_boards.sql 의 함수(can_manage_board)가 없습니다 — 이 파일은 ⑧ 이후 상태로 되돌립니다. 아무것도 바꾸지 않았습니다.';
  end if;
end $$;

-- ═════════════════════════════════════════════
-- 1. 제한 정책 19개 지우기
-- ═════════════════════════════════════════════
drop policy if exists "profiles: 인증 전 쓰기 제한(수정)" on public.profiles;
drop policy if exists "comments: 인증 전 쓰기 제한(추가)" on public.comments;
drop policy if exists "comments: 인증 전 쓰기 제한(수정)" on public.comments;
drop policy if exists "likes: 인증 전 쓰기 제한(추가)" on public.likes;
drop policy if exists "community_posts: 인증 전 쓰기 제한(추가)" on public.community_posts;
drop policy if exists "community_posts: 인증 전 쓰기 제한(수정)" on public.community_posts;
drop policy if exists "community_comments: 인증 전 쓰기 제한(추가)" on public.community_comments;
drop policy if exists "community_comments: 인증 전 쓰기 제한(수정)" on public.community_comments;
drop policy if exists "community_likes: 인증 전 쓰기 제한(추가)" on public.community_likes;
drop policy if exists "community_reports: 인증 전 쓰기 제한(추가)" on public.community_reports;
drop policy if exists "app_results: 인증 전 쓰기 제한(추가)" on public.app_results;
drop policy if exists "app_progress: 인증 전 쓰기 제한(추가)" on public.app_progress;
drop policy if exists "app_progress: 인증 전 쓰기 제한(수정)" on public.app_progress;
drop policy if exists "assignment_submissions: 인증 전 쓰기 제한(추가)" on public.assignment_submissions;
drop policy if exists "assignment_submissions: 인증 전 쓰기 제한(수정)" on public.assignment_submissions;
drop policy if exists "feedback_messages: 인증 전 쓰기 제한(추가)" on public.feedback_messages;
drop policy if exists "feedback_read_marks: 인증 전 쓰기 제한(추가)" on public.feedback_read_marks;
drop policy if exists "feedback_read_marks: 인증 전 쓰기 제한(수정)" on public.feedback_read_marks;
drop policy if exists "game-uploads: 인증 전 업로드 제한" on storage.objects;

-- ═════════════════════════════════════════════
-- 2. 함수 10개 — 옛 정의 그대로
-- ═════════════════════════════════════════════

-- 2-1. can_browse — 20260923010000_login_required.sql §2
create or replace function public.can_browse()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null or not public.login_required();
$$;

grant execute on function public.can_browse() to public;

-- 2-2. handle_new_user — 20260923000000_member_withdrawal.sql §6
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)), 50),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- 2-3. sync_member_directory — 20260921020000_admin_learning.sql §4.2
--      (이미 가린 이메일은 되살리지 않는다. 가린 계정은 다음 로그인 때 이 함수가 원래 이메일로 다시 채운다 — ② 이전 동작.)
create or replace function public.sync_member_directory()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- profiles 행이 아직 없으면(트리거 순서 이상 등) 가입 자체를 막지 않도록 건너뛴다.
  -- on_auth_user_created(handle_new_user)가 이름순으로 먼저 실행되므로 정상적으로는 항상 존재한다.
  if not exists (select 1 from public.profiles where id = new.id) then
    return new;
  end if;

  insert into public.member_directory (id, email, provider, providers, signed_up_at, last_sign_in_at)
  values (
    new.id,
    coalesce(new.email, ''),
    new.raw_app_meta_data ->> 'provider',
    coalesce(
      (select array_agg(x) from jsonb_array_elements_text(
        case when jsonb_typeof(new.raw_app_meta_data -> 'providers') = 'array'
             then new.raw_app_meta_data -> 'providers' else '[]'::jsonb end
      ) as x),
      '{}'
    ),
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

-- 2-4. admin_set_role — 20260927010000_classes_rls.sql §5-2
create or replace function public.admin_set_role(p_user uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current   text;
  v_withdrawn timestamptz;
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

  select p.role, p.withdrawn_at into v_current, v_withdrawn
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
    -- 개정 1-2: 담임으로 지정되면 학생 소속은 비운다(트리거가 member_directory 에도 반영).
    update public.profiles set role = 'admin', class_id = null where id = p_user;
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

  update public.profiles set role = 'user', is_super_admin = false where id = p_user;
end;
$$;

revoke all on function public.admin_set_role(uuid, text) from public, anon;
grant execute on function public.admin_set_role(uuid, text) to authenticated;

-- 2-5. record_post_read — 20260921020000_admin_learning.sql §4.4
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

-- 2-6. get_or_create_feedback_thread — 20260927010000_classes_rls.sql §4-2
create or replace function public.get_or_create_feedback_thread(p_student_id uuid, p_context_type text, p_context_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null or not (auth.uid() = p_student_id or public.teaches_student(p_student_id)) then
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

-- 2-7. 학습게임 관리 RPC 4개 — 20260928010000_teacher_boards.sql §5-1~5-4
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
-- 3. 정책 20개 — 옛 정의 그대로(is_admin() — 교사 누구나)
-- ═════════════════════════════════════════════

-- 3-1. community_posts 읽기 — 20260928010000 §4-1
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
    or (kind <> 'board' and public.is_admin())                         -- 학습게임: 교사 누구나(그대로)
    or (kind = 'board' and public.can_manage_board(board_owner))       -- 자유게시판: 그 게시판 관리자(담임·보조 담임)·총괄
  );

-- 3-2. community_posts 고치기 — 20260928010000 §4-3
drop policy if exists "community_posts: 본인·게시판 관리자 수정" on public.community_posts;
create policy "community_posts: 본인·게시판 관리자 수정"
  on public.community_posts for update
  to authenticated
  using (
    auth.uid() = author_id
    or (kind <> 'board' and public.is_admin())
    or (kind = 'board' and public.can_manage_board(board_owner))
  )
  with check (
    auth.uid() = author_id
    or (kind <> 'board' and public.is_admin())
    or (kind = 'board' and public.can_manage_board(board_owner))
  );

-- 3-3. community_posts 지우기 — 20260928010000 §4-4
drop policy if exists "community_posts: 본인·게시판 관리자 삭제" on public.community_posts;
create policy "community_posts: 본인·게시판 관리자 삭제"
  on public.community_posts for delete
  to authenticated
  using (
    auth.uid() = author_id
    or (kind <> 'board' and public.is_admin())
    or (kind = 'board' and public.can_manage_board(board_owner))
  );

-- 3-4. community_comments 읽기 — 20260928010000 §4-5
drop policy if exists "community_comments: 읽기(게시판은 담임별)" on public.community_comments;
create policy "community_comments: 읽기(게시판은 담임별)"
  on public.community_comments for select
  using (
    (select public.can_browse())
    and exists (
      select 1 from public.community_posts p
      where p.id = community_comments.post_id
        and (
          -- 학습게임: 그대로
          (
            p.kind <> 'board'
            and (not p.hidden or public.is_admin() or auth.uid() = p.author_id)
            and (not community_comments.hidden or auth.uid() = community_comments.user_id or public.is_admin())
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

-- 3-5. community_comments 지우기 — 20260928010000 §4-7
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
          (p.kind <> 'board' and public.is_admin())                          -- 학습게임: 교사 누구나(그대로)
          or (p.kind = 'board' and public.can_manage_board(p.board_owner))   -- 자유게시판: 그 게시판 관리자·총괄
        )
    )
  );

-- 3-6. community_likes 읽기 — 20260928010000 §4-8
drop policy if exists "community_likes: 읽기(게시판은 담임별)" on public.community_likes;
create policy "community_likes: 읽기(게시판은 담임별)"
  on public.community_likes for select
  using (
    (select public.can_browse())
    and exists (
      select 1 from public.community_posts p
      where p.id = community_likes.post_id
        and (
          (p.kind <> 'board' and (not p.hidden or auth.uid() = p.author_id or public.is_admin()))   -- 학습게임: 그대로
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

-- 3-7. community_reports 읽기 — 20260928010000 §4-10
drop policy if exists "community_reports: 신고자·게시판 관리자 조회" on public.community_reports;
create policy "community_reports: 신고자·게시판 관리자 조회"
  on public.community_reports for select
  to authenticated
  using (
    auth.uid() = reporter_id
    or (target_post_kind = 'game' and public.is_admin())
    or (target_post_kind is distinct from 'game' and public.can_manage_board(target_board_owner))
  );

-- 3-8. community_reports 신고 — 20260928010000 §4-11
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
          (p.kind <> 'board' and (not p.hidden or auth.uid() = p.author_id or public.is_admin()))
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

-- 3-9. community_reports 지우기 — 20260928010000 §4-12
drop policy if exists "community_reports: 게시판 관리자 삭제" on public.community_reports;
create policy "community_reports: 게시판 관리자 삭제"
  on public.community_reports for delete
  to authenticated
  using (
    (target_post_kind = 'game' and public.is_admin())
    or (target_post_kind is distinct from 'game' and public.can_manage_board(target_board_owner))
  );

-- 3-10. game-uploads 조회(storage) — 20260923010000 §3.10
drop policy if exists "game-uploads: 볼 수 있는 게임·본인·관리자 조회" on storage.objects;
create policy "game-uploads: 볼 수 있는 게임·본인·관리자 조회"
  on storage.objects for select
  using (
    bucket_id = 'game-uploads'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
      or (
        (select public.can_browse())
        and exists (
          select 1 from public.community_posts p
          where p.game_path = objects.name
            and (not p.hidden or auth.uid() = p.author_id or public.is_admin())
        )
      )
    )
  );

-- 3-11. game-uploads 지우기(storage) — 20260922040000
drop policy if exists "game-uploads: 본인 또는 관리자 삭제" on storage.objects;
create policy "game-uploads: 본인 또는 관리자 삭제"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'game-uploads'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );

-- 3-12. posts 읽기 — 20260923010000 §3.2
drop policy if exists "posts: 공개 글은 누구나, 관리자는 전체 조회" on public.posts;
create policy "posts: 공개 글은 누구나, 관리자는 전체 조회"
  on public.posts for select
  using ((published and (select public.can_browse())) or public.is_admin());

-- 3-13. posts 쓰기·고치기·지우기 — 20260927030000 §2
drop policy if exists "posts: 교사 본인 이름으로 작성" on public.posts;
create policy "posts: 교사 본인 이름으로 작성"
  on public.posts for insert
  with check (public.is_admin() and author_id = auth.uid());

drop policy if exists "posts: 쓴 교사·총괄만 수정" on public.posts;
create policy "posts: 쓴 교사·총괄만 수정"
  on public.posts for update
  using (public.is_admin() and (author_id = auth.uid() or public.is_super_admin()))
  with check (public.is_admin() and (author_id = auth.uid() or public.is_super_admin()));

drop policy if exists "posts: 쓴 교사·총괄만 삭제" on public.posts;
create policy "posts: 쓴 교사·총괄만 삭제"
  on public.posts for delete
  using (public.is_admin() and (author_id = auth.uid() or public.is_super_admin()));

-- 3-14. comments 읽기 — 20260923010000 §3.3
drop policy if exists "comments: 공개 글의 댓글은 누구나 조회" on public.comments;
create policy "comments: 공개 글의 댓글은 누구나 조회"
  on public.comments for select
  using (
    public.is_admin()
    or (
      (select public.can_browse())
      and exists (select 1 from public.posts p where p.id = post_id and p.published)
    )
  );

-- 3-15. comments 지우기 — 20260921000000
drop policy if exists "comments: 본인 또는 관리자 삭제" on public.comments;
create policy "comments: 본인 또는 관리자 삭제"
  on public.comments for delete
  to authenticated
  using (auth.uid() = user_id or public.is_admin());

-- 3-16. praise_presets 추가·수정·삭제 — 20260922020000
drop policy if exists "praise_presets: 관리자만 추가" on public.praise_presets;
create policy "praise_presets: 관리자만 추가"
  on public.praise_presets for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "praise_presets: 관리자만 수정" on public.praise_presets;
create policy "praise_presets: 관리자만 수정"
  on public.praise_presets for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "praise_presets: 관리자만 삭제" on public.praise_presets;
create policy "praise_presets: 관리자만 삭제"
  on public.praise_presets for delete
  to authenticated
  using (public.is_admin());

-- 3-17. (개정 4) 회원 명단 · 감사 기록 3개 읽기 — 20260927010000_classes_rls.sql §3-1~3-4 글자 그대로("…: 담임·총괄 조회" =
--       can_manage_member — 총괄은 모든 줄). ②의 "…: 학생은 담임만 조회"(can_see_member_identity)를 지운다.
drop policy if exists "member_directory: 학생은 담임만 조회" on public.member_directory;
drop policy if exists "member_directory: 담임·총괄 조회" on public.member_directory;
create policy "member_directory: 담임·총괄 조회"
  on public.member_directory for select
  using (public.can_manage_member(id));

drop policy if exists "password_reset_log: 학생은 담임만 조회" on public.password_reset_log;
drop policy if exists "password_reset_log: 담임·총괄 조회" on public.password_reset_log;
create policy "password_reset_log: 담임·총괄 조회"
  on public.password_reset_log for select
  to authenticated
  using (public.can_manage_member(target_id));

drop policy if exists "member_withdrawal_log: 학생은 담임만 조회" on public.member_withdrawal_log;
drop policy if exists "member_withdrawal_log: 담임·총괄 조회" on public.member_withdrawal_log;
create policy "member_withdrawal_log: 담임·총괄 조회"
  on public.member_withdrawal_log for select
  to authenticated
  using (public.can_manage_member(target_id));

drop policy if exists "member_create_log: 학생은 담임만 조회" on public.member_create_log;
drop policy if exists "member_create_log: 담임·총괄 조회" on public.member_create_log;
create policy "member_create_log: 담임·총괄 조회"
  on public.member_create_log for select
  to authenticated
  using (public.can_manage_member(target_id));

-- 3-18. (개정 4) admin_must_change_password_ids() — 20260927010000_classes_rls.sql §3-5 글자 그대로(can_manage_member).
create or replace function public.admin_must_change_password_ids()
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(p.id), '{}'::uuid[])
  from public.profiles p
  where p.must_change_password and public.can_manage_member(p.id);
$$;

revoke all on function public.admin_must_change_password_ids() from public, anon;
grant execute on function public.admin_must_change_password_ids() to authenticated;

-- 3-19. (고침 1) profiles 수정 권한 — ② 전 목록(20260927000000 §3-1 · ① 첫 실행과 같은 (display_name, avatar_url)).
--       권한만 되돌린다 — ②가 비운 사진 주소(학생 · 구글 등 계정)와 '선생님'으로 바꾼 이름은 되살리지 않는다(원래 값이 없음).
revoke update on public.profiles from anon, authenticated;
grant update (display_name, avatar_url) on public.profiles to authenticated;

-- ═════════════════════════════════════════════
-- 4. 인증 전 줄 지우기 — 창이 다시 뜨지 않고, 되돌린 동안 구글 계정이 코드로 교사가 되지 않게(머리말)
-- ═════════════════════════════════════════════
delete from public.member_verification v where v.verified_at is null;

-- ═════════════════════════════════════════════
-- 5. 맨 끝 점검 — ② 흔적이 남으면 전부 되돌린다(아무것도 바뀌지 않음)
-- ═════════════════════════════════════════════
do $$
declare
  v_n  int;
  v_fn text;
begin
  select count(*) into v_n from pg_policies
  where permissive = 'RESTRICTIVE'
    and position('is_pending_google()' in coalesce(qual, '') || coalesce(with_check, '')) > 0;
  if v_n > 0 then
    raise exception '인증 전 쓰기 제한 정책이 %개 남았습니다. 이 파일 전체를 되돌렸습니다 — 이 메시지를 알려 주세요.', v_n;
  end if;

  select count(*) into v_n from pg_policies
  where position('is_full_admin()' in coalesce(qual, '') || coalesce(with_check, '')) > 0;
  if v_n > 0 then
    raise exception 'is_full_admin() 을 부르는 정책이 %개 남았습니다. 이 파일 전체를 되돌렸습니다 — 이 메시지를 알려 주세요.', v_n;
  end if;

  select string_agg(p.oid::regprocedure::text, ', ') into v_fn
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in ('can_browse', 'handle_new_user', 'sync_member_directory', 'admin_set_role', 'record_post_read',
                      'get_or_create_feedback_thread', 'set_community_post_hidden', 'set_community_comment_hidden',
                      'set_community_report_status', 'resolve_community_reports_for', 'admin_must_change_password_ids')
    and (position('is_pending_google' in p.prosrc) > 0 or position('is_full_admin' in p.prosrc) > 0
         or position('member_verification' in p.prosrc) > 0 or position('teacher_scope' in p.prosrc) > 0
         or position('can_see_member_identity' in p.prosrc) > 0 or position('다른 학급 학생은' in p.prosrc) > 0);
  if v_fn is not null then
    raise exception '옛 정의로 돌아가지 않은 함수가 있습니다: %. 이 파일 전체를 되돌렸습니다 — 이 메시지를 알려 주세요.', v_fn;
  end if;

  -- (개정 4) 회원 명단 · 감사 기록 3개: 읽기 허용 정책이 표마다 옛 "…: 담임·총괄 조회"(can_manage_member) 하나
  select count(*) into v_n
  from (values ('member_directory'), ('password_reset_log'), ('member_withdrawal_log'), ('member_create_log')) as e(t)
  where (select count(*) from pg_policies pp
          where pp.schemaname = 'public' and pp.tablename = e.t and pp.permissive = 'PERMISSIVE' and pp.cmd in ('SELECT', 'ALL')) <> 1
     or not exists (select 1 from pg_policies pp
                     where pp.schemaname = 'public' and pp.tablename = e.t
                       and pp.policyname = e.t || ': 담임·총괄 조회'
                       and position('can_manage_member(' in coalesce(pp.qual, '')) > 0);
  if v_n > 0 then
    raise exception '회원 명단 · 감사 기록의 읽기 정책이 옛 정의("…: 담임·총괄 조회" 하나)로 돌아가지 않은 표가 %개 있습니다. 이 파일 전체를 되돌렸습니다 — 이 메시지를 알려 주세요.', v_n;
  end if;

  -- (고침 1) profiles 수정 권한이 ② 전처럼 별명 · 사진 주소
  if not has_column_privilege('authenticated', 'public.profiles', 'avatar_url', 'UPDATE')
     or not has_column_privilege('authenticated', 'public.profiles', 'display_name', 'UPDATE') then
    raise exception 'profiles 수정 권한이 ② 전(별명 · 사진 주소)으로 돌아가지 않았습니다. 이 파일 전체를 되돌렸습니다 — 이 메시지를 알려 주세요.';
  end if;

  raise notice '✔ ②를 되돌렸습니다: 인증 전 계정 제한 · 학급 밖 권한 좁히기 · 학생 아이디 가리기(개정 4)가 풀리고(교사 누구나 · 총괄은 모든 회원 명단), 구글 새 가입은 ② 이전처럼 일반 회원으로 시작합니다. 가린 이메일·이름은 되돌리지 않았습니다. 인증을 마친 구글 선생님은 교사로 남습니다.';
end $$;

notify pgrst, 'reload schema';
