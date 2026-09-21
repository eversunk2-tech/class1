-- 관리자 대시보드 + 학습활동 1차 리뷰 수정 (docs/admin/review.md, docs/admin/fix-1-report.md)
--
-- ▶ 실행 방법
--   Supabase 대시보드 > SQL Editor > New query 에 이 파일 전체를 붙여넣고 Run.
--   앞선 마이그레이션(20260921000000_init_blog.sql, 20260921010000_fixes.sql, 20260921020000_admin_learning.sql)이
--   먼저 실행돼 있어야 한다. 여러 번 실행해도 안전하다(create or replace / drop ... if exists / 제약은 지우고 다시 추가).
--   ⚠ 이 SQL을 실행한 다음 Edge Function(admin-reset-password)을 다시 배포하고, 마지막으로 사이트를 배포(push)한다.
--
-- ▶ 실행 후 확인 쿼리
--   -- 1) 비밀번호 변경 트리거
--   select tgname from pg_trigger where tgrelid = 'auth.users'::regclass and not tgisinternal;
--      → on_auth_user_password_changed 가 보여야 한다.
--   -- 2) profiles 컬럼 권한: must_change_password 가 anon/authenticated 목록에 없어야 한다.
--   select grantee, column_name from information_schema.column_privileges
--   where table_schema = 'public' and table_name = 'profiles' and privilege_type = 'SELECT'
--     and grantee in ('anon', 'authenticated') order by 1, 2;
--   -- 3) 서비스 롤 전용 함수가 anon/authenticated에 열려 있지 않은지 (둘 다 false)
--   select has_function_privilege('anon', 'public.admin_finalize_password_reset(uuid, uuid)', 'execute'),
--          has_function_privilege('authenticated', 'public.admin_finalize_password_reset(uuid, uuid)', 'execute');

-- ═════════════════════════════════════════════
-- #6 / #11 강제 비밀번호 변경 해제: RPC 대신 auth.users 비밀번호 변경 트리거
--   - 학생이 콘솔에서 해제 RPC만 불러 임시 비밀번호를 계속 쓰는 경로를 없앤다.
--   - 비밀번호가 "실제로" 바뀐 경우(encrypted_password 값이 달라진 경우)에만 해제한다.
--     (GoTrue가 다른 이유로 행 전체를 update해도 값이 같으면 반응하지 않도록 WHEN 조건을 둔다.)
--   - Edge Function 순서: ① 임시 비밀번호로 변경(→ 이 트리거가 false로 만듦) ② 그다음 admin_finalize_password_reset이
--     true로 켠다. 두 단계는 별도 HTTP 요청이라 순서가 보장되므로, 초기화 직후 플래그는 항상 true다.
--   - 학생이 /reset-password/에서 새 비밀번호를 저장하면 같은 트랜잭션에서 false가 되므로,
--     "비밀번호는 바뀌었는데 플래그가 남는" 중간 상태가 없다(탭을 닫아도 안전).
-- ═════════════════════════════════════════════
create or replace function public.handle_auth_password_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
     set must_change_password = false
   where id = new.id
     and must_change_password;
  return new;
end;
$$;

revoke all on function public.handle_auth_password_changed() from public, anon, authenticated;

drop trigger if exists on_auth_user_password_changed on auth.users;
create trigger on_auth_user_password_changed
  after update of encrypted_password on auth.users
  for each row
  when (old.encrypted_password is distinct from new.encrypted_password)
  execute function public.handle_auth_password_changed();

-- 클라이언트가 부르던 해제 RPC는 없앤다(비밀번호를 바꾸지 않고도 해제할 수 있었음).
drop function if exists public.clear_must_change_password();

-- ═════════════════════════════════════════════
-- #17 must_change_password 는 본인·관리자만 조회
--   profiles 는 "누구나 조회" 정책이라 컬럼 권한으로 막는다.
--   테이블 SELECT 권한을 회수하고 공개해도 되는 컬럼만 다시 준다.
--   → 클라이언트는 profiles 를 select("*") 로 읽으면 안 된다(권한 오류). 컬럼을 명시한다.
--   → 나중에 profiles 에 공개 컬럼을 추가하면 아래 grant 목록에도 추가해야 한다.
--   본인 값: my_must_change_password(), 관리자: admin_must_change_password_ids()
-- ═════════════════════════════════════════════
revoke select on public.profiles from anon, authenticated;
grant select (id, display_name, avatar_url, role, created_at, updated_at) on public.profiles to anon, authenticated;

create or replace function public.my_must_change_password()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select p.must_change_password from public.profiles p where p.id = auth.uid()), false);
$$;

revoke all on function public.my_must_change_password() from public, anon;
grant execute on function public.my_must_change_password() to authenticated;

-- 배열 1개로 돌려준다(집합 반환이면 PostgREST max-rows 제한을 받는다). 관리자가 아니면 빈 배열.
create or replace function public.admin_must_change_password_ids()
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(p.id), '{}'::uuid[])
  from public.profiles p
  where p.must_change_password and public.is_admin();
$$;

revoke all on function public.admin_must_change_password_ids() from public, anon;
grant execute on function public.admin_must_change_password_ids() to authenticated;

-- ═════════════════════════════════════════════
-- #20 / #2 비밀번호 초기화 마무리(서비스 롤 전용): 플래그 켜기 + 기존 세션 무효화 + 감사 로그
--   Edge Function 이 비밀번호를 바꾼 "다음"에 호출한다(#6 순서 설명 참고).
-- ═════════════════════════════════════════════
create table if not exists public.password_reset_log (
  id               bigint generated always as identity primary key,
  target_id        uuid not null,           -- 회원이 삭제돼도 기록은 남긴다(FK 없음)
  actor_id         uuid,                    -- 초기화한 관리자
  sessions_revoked integer not null default 0, -- 지운 세션 수. -1 = 세션 정리 실패(권한 등)
  created_at       timestamptz not null default now()
);

create index if not exists password_reset_log_target_idx on public.password_reset_log (target_id, created_at desc);

alter table public.password_reset_log enable row level security;

drop policy if exists "password_reset_log: 관리자만 조회" on public.password_reset_log;
create policy "password_reset_log: 관리자만 조회"
  on public.password_reset_log for select
  to authenticated
  using (public.is_admin());

-- 쓰기는 admin_finalize_password_reset(서비스 롤)만.
revoke all on public.password_reset_log from anon, authenticated;
grant select on public.password_reset_log to authenticated;

create or replace function public.admin_finalize_password_reset(p_target uuid, p_actor uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sessions integer := 0;
begin
  -- 서비스 롤만 실행할 수 있지만(아래 grant), 한 번 더 확인한다.
  if not exists (select 1 from public.profiles where id = p_actor and role = 'admin') then
    raise exception 'actor is not an admin';
  end if;
  if p_target = p_actor or exists (select 1 from public.profiles where id = p_target and role = 'admin') then
    raise exception 'admin accounts cannot be reset';
  end if;

  update public.profiles set must_change_password = true where id = p_target;
  if not found then
    raise exception 'target profile not found';
  end if;

  -- 기존 로그인 세션(리프레시 토큰) 무효화. 이미 발급된 access token(JWT)은 만료(기본 1시간)까지 유효하다.
  -- auth 스키마 권한 문제 등으로 실패해도 초기화 자체는 유지하고 로그에 -1로 남긴다.
  begin
    delete from auth.sessions where user_id = p_target;
    get diagnostics v_sessions = row_count;
    delete from auth.refresh_tokens where user_id = p_target::text;
  exception when others then
    v_sessions := -1;
  end;

  insert into public.password_reset_log (target_id, actor_id, sessions_revoked)
  values (p_target, p_actor, v_sessions);

  return v_sessions;
end;
$$;

-- Supabase 는 public 스키마 함수에 anon/authenticated 실행 권한을 기본으로 주므로 명시적으로 회수한다.
revoke all on function public.admin_finalize_password_reset(uuid, uuid) from public, anon, authenticated;
grant execute on function public.admin_finalize_password_reset(uuid, uuid) to service_role;

-- ═════════════════════════════════════════════
-- #3 제출물 가드
--   - 학생이 "수정 요청(needs_revision)" 제출물의 내용을 고치면 다시 "제출(submitted = 검토 대기)"로 되돌린다.
--   - "검토 완료(reviewed)" 제출물은 학생이 고칠 수 없다(삭제도 기존 RLS 규칙대로 불가).
-- ═════════════════════════════════════════════
create or replace function public.assignment_submission_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_content_changed boolean;
begin
  if tg_op = 'INSERT' then
    if not public.is_admin() then
      new.status := 'submitted';
      new.submitted_at := now();
    end if;
    return new;
  end if;

  if new.user_id is distinct from old.user_id or new.assignment_id is distinct from old.assignment_id then
    raise exception '제출 대상은 바꿀 수 없습니다.';
  end if;

  v_content_changed := new.body_md is distinct from old.body_md or new.link_url is distinct from old.link_url;

  if public.is_admin() and auth.uid() is distinct from old.user_id then
    if v_content_changed or new.submitted_at is distinct from old.submitted_at then
      raise exception '관리자는 상태만 변경할 수 있습니다.';
    end if;
  else
    if new.status is distinct from old.status then
      raise exception '상태는 관리자만 변경할 수 있습니다.';
    end if;
    if new.submitted_at is distinct from old.submitted_at then
      raise exception '제출 시각은 바꿀 수 없습니다.';
    end if;
    if v_content_changed then
      if old.status = 'reviewed' and not public.is_admin() then
        raise exception '검토 완료된 제출물은 수정할 수 없습니다.';
      end if;
      if old.status = 'needs_revision' then
        new.status := 'submitted';
      end if;
    end if;
  end if;
  return new;
end;
$$;

-- ═════════════════════════════════════════════
-- #5 읽음 표시: 서버 now() 대신 "화면에 보여 준 마지막 메시지 시각"까지만 읽음 처리
--   p_until 을 그대로 쓰지 않고, 이 스레드에 실제로 있는 메시지 중 p_until(및 now()) 이하의 가장 늦은 시각으로 맞춘다
--   → 미래 시각이나 다른 스레드의 시각을 넣어도 보지 않은 메시지가 읽음 처리되지 않는다.
--   기존 값보다 뒤로 가지 않는다(greatest).
-- ═════════════════════════════════════════════
drop function if exists public.mark_thread_read(uuid);

create or replace function public.mark_thread_read(p_thread_id uuid, p_until timestamptz)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_until timestamptz;
begin
  if auth.uid() is null or p_thread_id is null or p_until is null then
    return;
  end if;
  if not exists (
    select 1 from public.feedback_threads t
    where t.id = p_thread_id and (t.student_id = auth.uid() or public.is_admin())
  ) then
    return;
  end if;

  select max(m.created_at) into v_until
  from public.feedback_messages m
  where m.thread_id = p_thread_id
    and m.created_at <= least(p_until, now());
  if v_until is null then
    return;
  end if;

  insert into public.feedback_read_marks (thread_id, user_id, last_read_at)
  values (p_thread_id, auth.uid(), v_until)
  on conflict (thread_id, user_id)
  do update set last_read_at = greatest(public.feedback_read_marks.last_read_at, excluded.last_read_at);
end;
$$;

revoke all on function public.mark_thread_read(uuid, timestamptz) from public, anon;
grant execute on function public.mark_thread_read(uuid, timestamptz) to authenticated;

-- ═════════════════════════════════════════════
-- #8 스레드 생성: context_id 가 그 학생의 결과·제출물인지 확인. 테이블 직접 insert 는 막고 RPC 로만 만든다.
--   이미 있는 스레드(원본이 삭제된 대화 포함)는 검사 없이 그대로 돌려준다.
-- ═════════════════════════════════════════════
create or replace function public.get_or_create_feedback_thread(p_student_id uuid, p_context_type text, p_context_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null or not (auth.uid() = p_student_id or public.is_admin()) then
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

drop policy if exists "feedback_threads: 본인 또는 관리자 생성" on public.feedback_threads;
revoke insert on public.feedback_threads from anon, authenticated;

-- ═════════════════════════════════════════════
-- #4 1000행 제한(PostgREST max-rows) 없이 서버에서 집계
--   security invoker(기본) → RLS 가 그대로 적용된다(학생은 본인 것만, 관리자는 전체).
-- ═════════════════════════════════════════════

-- 앱별 집계(학습 현황 개요)
create or replace function public.app_result_stats()
returns table (
  app_id      text,
  attempts    integer,
  students    integer,
  completed   integer,
  avg_ratio   double precision,
  last_at     timestamptz
)
language sql
stable
set search_path = ''
as $$
  select
    r.app_id,
    count(*)::int,
    count(distinct r.user_id)::int,
    (count(*) filter (where r.completed))::int,
    avg(case when r.score is not null and r.max_score > 0 then (r.score / r.max_score)::double precision end),
    max(r.created_at)
  from public.app_results r
  group by r.app_id
  order by r.app_id;
$$;

revoke all on function public.app_result_stats() from public, anon;
grant execute on function public.app_result_stats() to authenticated;

-- 스레드별 메시지 수 · 마지막 메시지 · 안 읽은 수(unread_feedback_count 와 같은 기준)
create or replace function public.feedback_thread_summaries(p_student_id uuid default null)
returns table (
  thread_id       uuid,
  message_count   integer,
  last_message_at timestamptz,
  last_message    text,
  last_sender_id  uuid,
  unread          integer
)
language sql
stable
set search_path = ''
as $$
  select
    t.id,
    (select count(*)::int from public.feedback_messages m where m.thread_id = t.id),
    lm.created_at,
    lm.body,
    lm.sender_id,
    (select count(*)::int
       from public.feedback_messages m
      where m.thread_id = t.id
        and m.sender_id <> auth.uid()
        and m.created_at > coalesce(rm.last_read_at, '-infinity'::timestamptz))
  from public.feedback_threads t
  left join lateral (
    select m.created_at, m.body, m.sender_id
    from public.feedback_messages m
    where m.thread_id = t.id
    order by m.created_at desc
    limit 1
  ) lm on true
  left join public.feedback_read_marks rm on rm.thread_id = t.id and rm.user_id = auth.uid()
  where auth.uid() is not null
    and (p_student_id is null or t.student_id = p_student_id)
  order by t.created_at desc, t.id;
$$;

revoke all on function public.feedback_thread_summaries(uuid) from public, anon;
grant execute on function public.feedback_thread_summaries(uuid) to authenticated;

-- ═════════════════════════════════════════════
-- #16 app_results 크기·범위 제약
--   details: class1-record.js 가 JSON 16,000자까지 허용하므로(한글 3바이트 + jsonb 출력 공백 고려) 64KB로 둔다.
--   not valid: 기존 행은 검사하지 않고 새로 들어오는 행부터 적용한다(기존 데이터 때문에 실행이 실패하지 않게).
-- ═════════════════════════════════════════════
alter table public.app_results drop constraint if exists app_results_details_size;
alter table public.app_results
  add constraint app_results_details_size check (octet_length(details::text) <= 65536) not valid;

alter table public.app_results drop constraint if exists app_results_score_range;
alter table public.app_results
  add constraint app_results_score_range check (score is null or (score >= -1000000000 and score <= 1000000000)) not valid;

alter table public.app_results drop constraint if exists app_results_max_score_range;
alter table public.app_results
  add constraint app_results_max_score_range check (max_score is null or (max_score >= 0 and max_score <= 1000000000)) not valid;
