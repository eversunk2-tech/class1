-- 관리자 대시보드 + 학습활동 스키마 (docs/admin/spec.md §4, §14 확정 결정 반영)
--
-- ▶ 실행 방법
--   Supabase 대시보드 > SQL Editor > New query 에 이 파일 전체를 붙여넣고 Run.
--   한 번에 실행되며, 여러 번 실행해도 안전하도록 작성했다(if not exists / create or replace / drop ... if exists).
--   앞선 마이그레이션(20260921000000_init_blog.sql, 20260921010000_fixes.sql)이 먼저 실행돼 있어야 한다.
--
-- ▶ 실행 후 확인 쿼리
--   -- 1) 기존 회원이 백필됐는지 (auth.users 수와 같아야 한다)
--   select (select count(*) from auth.users) as users, (select count(*) from public.member_directory) as directory;
--   -- 2) 새 컬럼
--   select id, role, must_change_password from public.profiles limit 5;
--   -- 3) 새 테이블 RLS가 모두 켜졌는지 (rowsecurity = true)
--   select tablename, rowsecurity from pg_tables
--   where schemaname = 'public'
--     and tablename in ('member_directory','app_results','post_reads','assignments','assignment_submissions',
--                       'feedback_threads','feedback_messages','feedback_read_marks');
--   -- 4) 트리거
--   select tgname from pg_trigger where tgrelid = 'auth.users'::regclass and not tgisinternal;
--
-- ▶ 첫 관리자 지정은 여전히 SQL로 1회 (admin_set_role은 이미 관리자인 사람만 쓸 수 있다):
--   update public.profiles set role = 'admin' where id = '<내 auth.users id>';

-- ═════════════════════════════════════════════
-- 4.1 profiles.must_change_password
--   grant update (display_name, avatar_url) 목록에 추가하지 않는다 → 학생이 직접 바꿀 수 없다.
--   켜기: Edge Function(서비스 롤) / 끄기: clear_must_change_password() RPC(본인만).
-- ═════════════════════════════════════════════
alter table public.profiles
  add column if not exists must_change_password boolean not null default false;

-- ═════════════════════════════════════════════
-- 4.2 member_directory — auth.users 동기화 테이블(관리자만 조회)
-- ═════════════════════════════════════════════
create table if not exists public.member_directory (
  id               uuid primary key references public.profiles (id) on delete cascade,
  email            text not null default '',
  provider         text,                           -- 대표 가입 방식(email/github/google)
  providers        text[] not null default '{}',   -- 연결된 모든 방식
  signed_up_at     timestamptz not null,
  last_sign_in_at  timestamptz,
  updated_at       timestamptz not null default now()
);

alter table public.member_directory enable row level security;

drop policy if exists "member_directory: 관리자만 조회" on public.member_directory;
create policy "member_directory: 관리자만 조회"
  on public.member_directory for select
  using (public.is_admin());

-- 쓰기는 트리거(security definer)만 한다.
revoke all on public.member_directory from anon, authenticated;
grant select on public.member_directory to authenticated;

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

-- 트리거 이름은 on_auth_user_created(handle_new_user) 뒤에 오도록 정했다(같은 이벤트의 트리거는 이름순 실행).
drop trigger if exists on_auth_user_created_directory on auth.users;
create trigger on_auth_user_created_directory
  after insert on auth.users
  for each row execute function public.sync_member_directory();

-- 로그인·이메일 변경·공급자 연결 때만 동기화한다(토큰 갱신 등 다른 update에는 반응하지 않음).
drop trigger if exists on_auth_user_updated_directory on auth.users;
create trigger on_auth_user_updated_directory
  after update of email, raw_app_meta_data, last_sign_in_at on auth.users
  for each row execute function public.sync_member_directory();

-- 기존 회원 백필 (spec §14 Q3). 재실행해도 최신 값으로 덮어쓸 뿐이다.
insert into public.member_directory (id, email, provider, providers, signed_up_at, last_sign_in_at)
select
  u.id,
  coalesce(u.email, ''),
  u.raw_app_meta_data ->> 'provider',
  coalesce(
    (select array_agg(x) from jsonb_array_elements_text(
      case when jsonb_typeof(u.raw_app_meta_data -> 'providers') = 'array'
           then u.raw_app_meta_data -> 'providers' else '[]'::jsonb end
    ) as x),
    '{}'
  ),
  u.created_at,
  u.last_sign_in_at
from auth.users u
join public.profiles p on p.id = u.id
on conflict (id) do update set
  email = excluded.email,
  provider = excluded.provider,
  providers = excluded.providers,
  signed_up_at = excluded.signed_up_at,
  last_sign_in_at = excluded.last_sign_in_at,
  updated_at = now();

-- ═════════════════════════════════════════════
-- 4.3 app_results — 웹앱 학습 결과(append-only)
-- ═════════════════════════════════════════════
create table if not exists public.app_results (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  app_id           text not null check (char_length(app_id) between 1 and 100),
  score            numeric,
  max_score        numeric,
  completed        boolean not null default false,
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  details          jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now()
);

create index if not exists app_results_user_idx on public.app_results (user_id, created_at desc);
create index if not exists app_results_app_idx  on public.app_results (app_id, created_at desc);

alter table public.app_results enable row level security;

drop policy if exists "app_results: 본인 또는 관리자 조회" on public.app_results;
create policy "app_results: 본인 또는 관리자 조회"
  on public.app_results for select
  using (auth.uid() = user_id or public.is_admin());

drop policy if exists "app_results: 본인만 기록" on public.app_results;
create policy "app_results: 본인만 기록"
  on public.app_results for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "app_results: 관리자만 삭제" on public.app_results;
create policy "app_results: 관리자만 삭제"
  on public.app_results for delete
  to authenticated
  using (public.is_admin());
-- update 정책 없음 = 기록은 고칠 수 없다(로그 보존).
revoke update on public.app_results from anon, authenticated;

-- ═════════════════════════════════════════════
-- 4.4 post_reads — 글 읽기 기록(record_post_read RPC로만 기록)
-- ═════════════════════════════════════════════
create table if not exists public.post_reads (
  user_id       uuid not null references public.profiles (id) on delete cascade,
  post_id       uuid not null references public.posts (id) on delete cascade,
  first_read_at timestamptz not null default now(),
  last_read_at  timestamptz not null default now(),
  read_count    integer not null default 1,
  primary key (user_id, post_id)
);

create index if not exists post_reads_post_idx on public.post_reads (post_id);

alter table public.post_reads enable row level security;

drop policy if exists "post_reads: 본인 또는 관리자 조회" on public.post_reads;
create policy "post_reads: 본인 또는 관리자 조회"
  on public.post_reads for select
  using (auth.uid() = user_id or public.is_admin());

revoke insert, update, delete on public.post_reads from anon, authenticated;

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

-- ═════════════════════════════════════════════
-- 4.5 assignments / assignment_submissions — 과제
-- ═════════════════════════════════════════════
create table if not exists public.assignments (
  id             uuid primary key default gen_random_uuid(),
  title          text not null check (char_length(title) between 1 and 200),
  description_md text not null default '',
  due_at         timestamptz,
  published      boolean not null default false,
  created_by     uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

drop trigger if exists assignments_updated_at on public.assignments;
create trigger assignments_updated_at
  before update on public.assignments
  for each row execute function public.set_updated_at();

alter table public.assignments enable row level security;

drop policy if exists "assignments: 공개된 것은 누구나, 관리자는 전체 조회" on public.assignments;
create policy "assignments: 공개된 것은 누구나, 관리자는 전체 조회"
  on public.assignments for select
  using (published or public.is_admin());

drop policy if exists "assignments: 관리자만 작성/수정/삭제" on public.assignments;
create policy "assignments: 관리자만 작성/수정/삭제"
  on public.assignments for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create table if not exists public.assignment_submissions (
  id            uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments (id) on delete cascade,
  user_id       uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body_md       text not null default '' check (char_length(body_md) <= 20000),
  link_url      text check (link_url is null or char_length(link_url) <= 2000),
  status        text not null default 'submitted' check (status in ('submitted', 'reviewed', 'needs_revision')),
  submitted_at  timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (assignment_id, user_id)
);

create index if not exists assignment_submissions_assignment_idx on public.assignment_submissions (assignment_id);
create index if not exists assignment_submissions_user_idx on public.assignment_submissions (user_id);

drop trigger if exists assignment_submissions_updated_at on public.assignment_submissions;
create trigger assignment_submissions_updated_at
  before update on public.assignment_submissions
  for each row execute function public.set_updated_at();

alter table public.assignment_submissions enable row level security;

drop policy if exists "assignment_submissions: 본인 또는 관리자 조회" on public.assignment_submissions;
create policy "assignment_submissions: 본인 또는 관리자 조회"
  on public.assignment_submissions for select
  using (auth.uid() = user_id or public.is_admin());

-- §14 Q1: 마감 후에도 제출·수정 허용(마감 조건 없음). 화면에서 "지각" 배지만 붙인다.
drop policy if exists "assignment_submissions: 본인이 공개 과제에 제출" on public.assignment_submissions;
create policy "assignment_submissions: 본인이 공개 과제에 제출"
  on public.assignment_submissions for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.assignments a where a.id = assignment_id and a.published)
  );

drop policy if exists "assignment_submissions: 본인 또는 관리자 수정" on public.assignment_submissions;
create policy "assignment_submissions: 본인 또는 관리자 수정"
  on public.assignment_submissions for update
  to authenticated
  using (auth.uid() = user_id or public.is_admin())
  with check (auth.uid() = user_id or public.is_admin());

-- §14 Q8: 학생은 본인 제출물을 (마감 전 또는 마감 없음) + (검토 완료 전)일 때만 삭제 가능. 관리자는 언제나.
--   "검토 완료" = status 'reviewed'. 'submitted'·'needs_revision'(수정 요청) 상태는 삭제 후 재제출할 수 있다.
drop policy if exists "assignment_submissions: 관리자만 삭제" on public.assignment_submissions;
drop policy if exists "assignment_submissions: 본인(마감 전·검토 전) 또는 관리자 삭제" on public.assignment_submissions;
create policy "assignment_submissions: 본인(마감 전·검토 전) 또는 관리자 삭제"
  on public.assignment_submissions for delete
  to authenticated
  using (
    public.is_admin()
    or (
      auth.uid() = user_id
      and status <> 'reviewed'
      and exists (
        select 1 from public.assignments a
        where a.id = assignment_id and (a.due_at is null or now() < a.due_at)
      )
    )
  );

-- 학생은 body_md/link_url만, 관리자는 status만 바꿀 수 있게 트리거로 제한한다.
-- (관리자와 학생이 모두 authenticated 롤이라 컬럼 GRANT로는 구분할 수 없다.)
-- insert 시 학생이 status를 임의로 넣지 못하게 'submitted'로 고정한다.
create or replace function public.assignment_submission_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
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
  if public.is_admin() and auth.uid() is distinct from old.user_id then
    if new.body_md is distinct from old.body_md or new.link_url is distinct from old.link_url
       or new.submitted_at is distinct from old.submitted_at then
      raise exception '관리자는 상태만 변경할 수 있습니다.';
    end if;
  else
    if new.status is distinct from old.status then
      raise exception '상태는 관리자만 변경할 수 있습니다.';
    end if;
    if new.submitted_at is distinct from old.submitted_at then
      raise exception '제출 시각은 바꿀 수 없습니다.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists assignment_submissions_guard on public.assignment_submissions;
create trigger assignment_submissions_guard
  before insert or update on public.assignment_submissions
  for each row execute function public.assignment_submission_guard();

-- ═════════════════════════════════════════════
-- 4.6 피드백 스레드
--   context_id는 app_results/assignment_submissions를 가리키는 다형 참조라 FK가 없다.
--   §14 Q8 제출 삭제 시: 연결된 스레드와 메시지는 대화 기록 보존을 위해 그대로 남긴다(context_id는 끊긴 참조가 됨).
--   화면에서는 원본을 찾지 못하면 "삭제된 제출물"로 표시한다. 재제출하면 새 제출 id로 새 스레드가 생긴다.
-- ═════════════════════════════════════════════
create table if not exists public.feedback_threads (
  id           uuid primary key default gen_random_uuid(),
  student_id   uuid not null references public.profiles (id) on delete cascade,
  context_type text not null default 'general' check (context_type in ('general', 'app_result', 'assignment_submission')),
  context_id   uuid,
  context_key  text generated always as (context_type || ':' || coalesce(context_id::text, '')) stored,
  created_at   timestamptz not null default now(),
  unique (student_id, context_key)
);

alter table public.feedback_threads enable row level security;

drop policy if exists "feedback_threads: 본인 또는 관리자 조회" on public.feedback_threads;
create policy "feedback_threads: 본인 또는 관리자 조회"
  on public.feedback_threads for select
  using (auth.uid() = student_id or public.is_admin());

drop policy if exists "feedback_threads: 본인 또는 관리자 생성" on public.feedback_threads;
create policy "feedback_threads: 본인 또는 관리자 생성"
  on public.feedback_threads for insert
  to authenticated
  with check (auth.uid() = student_id or public.is_admin());

drop policy if exists "feedback_threads: 관리자만 삭제" on public.feedback_threads;
create policy "feedback_threads: 관리자만 삭제"
  on public.feedback_threads for delete
  to authenticated
  using (public.is_admin());

revoke update on public.feedback_threads from anon, authenticated;

create table if not exists public.feedback_messages (
  id         uuid primary key default gen_random_uuid(),
  thread_id  uuid not null references public.feedback_threads (id) on delete cascade,
  sender_id  uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists feedback_messages_thread_idx on public.feedback_messages (thread_id, created_at);

alter table public.feedback_messages enable row level security;

drop policy if exists "feedback_messages: 스레드 접근 가능자만 조회" on public.feedback_messages;
create policy "feedback_messages: 스레드 접근 가능자만 조회"
  on public.feedback_messages for select
  using (
    public.is_admin()
    or exists (select 1 from public.feedback_threads t where t.id = thread_id and t.student_id = auth.uid())
  );

drop policy if exists "feedback_messages: 본인 발신, 스레드 접근 가능해야 함" on public.feedback_messages;
create policy "feedback_messages: 본인 발신, 스레드 접근 가능해야 함"
  on public.feedback_messages for insert
  to authenticated
  with check (
    auth.uid() = sender_id
    and (
      public.is_admin()
      or exists (select 1 from public.feedback_threads t where t.id = thread_id and t.student_id = auth.uid())
    )
  );

revoke update on public.feedback_messages from anon, authenticated;

create table if not exists public.feedback_read_marks (
  thread_id     uuid not null references public.feedback_threads (id) on delete cascade,
  user_id       uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  last_read_at  timestamptz not null default now(),
  primary key (thread_id, user_id)
);

alter table public.feedback_read_marks enable row level security;

drop policy if exists "feedback_read_marks: 본인만 조회/기록" on public.feedback_read_marks;
create policy "feedback_read_marks: 본인만 조회/기록"
  on public.feedback_read_marks for all
  to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (
      public.is_admin()
      or exists (select 1 from public.feedback_threads t where t.id = thread_id and t.student_id = auth.uid())
    )
  );

-- 스레드 찾기/만들기 (경쟁 상태 없이)
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

create or replace function public.mark_thread_read(p_thread_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    return;
  end if;
  if not exists (
    select 1 from public.feedback_threads t
    where t.id = p_thread_id and (t.student_id = auth.uid() or public.is_admin())
  ) then
    return;
  end if;
  insert into public.feedback_read_marks (thread_id, user_id, last_read_at)
  values (p_thread_id, auth.uid(), now())
  on conflict (thread_id, user_id) do update set last_read_at = now();
end;
$$;

create or replace function public.unread_feedback_count()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::int
  from public.feedback_messages m
  join public.feedback_threads t on t.id = m.thread_id
  left join public.feedback_read_marks r on r.thread_id = t.id and r.user_id = auth.uid()
  where auth.uid() is not null
    and m.sender_id <> auth.uid()
    and (public.is_admin() or t.student_id = auth.uid())
    and m.created_at > coalesce(r.last_read_at, '-infinity'::timestamptz);
$$;

revoke all on function public.get_or_create_feedback_thread(uuid, text, uuid) from public, anon;
grant execute on function public.get_or_create_feedback_thread(uuid, text, uuid) to authenticated;
revoke all on function public.mark_thread_read(uuid) from public, anon;
grant execute on function public.mark_thread_read(uuid) to authenticated;
revoke all on function public.unread_feedback_count() from public, anon;
grant execute on function public.unread_feedback_count() to authenticated;

-- ═════════════════════════════════════════════
-- 4.7 관리자 편의 RPC
-- ═════════════════════════════════════════════

-- 강제 비밀번호 변경 플래그 해제(본인만, 새 비밀번호 설정 성공 후 호출)
create or replace function public.clear_must_change_password()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;
  update public.profiles set must_change_password = false where id = auth.uid();
end;
$$;

-- 관리자 지정/해제 (§14 Q2: 자기 자신 해제 불가, 마지막 관리자 해제 불가)
create or replace function public.admin_set_role(p_user uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current text;
begin
  if not public.is_admin() then
    raise exception '관리자만 사용할 수 있습니다.';
  end if;
  if p_role not in ('admin', 'user') then
    raise exception '잘못된 역할입니다.';
  end if;

  -- 동시에 두 관리자가 서로를 해제하는 경쟁을 막기 위해 관리자 행을 잠근다.
  perform 1 from public.profiles where role = 'admin' for update;

  select role into v_current from public.profiles where id = p_user;
  if v_current is null then
    raise exception '대상 회원을 찾을 수 없습니다.';
  end if;
  if v_current = p_role then
    return;
  end if;

  if p_role = 'user' then
    if p_user = auth.uid() then
      raise exception '자기 자신의 관리자 권한은 해제할 수 없습니다.';
    end if;
    if (select count(*) from public.profiles where role = 'admin') <= 1 then
      raise exception '마지막 관리자는 해제할 수 없습니다.';
    end if;
  end if;

  update public.profiles set role = p_role where id = p_user;
end;
$$;

-- 개요 화면 통계(단일 호출로 4개 숫자). 관리자가 아니면 빈 결과.
create or replace function public.admin_dashboard_stats()
returns table (total_members int, results_today int, pending_submissions int, unread_feedback int)
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select count(*)::int from public.member_directory),
    (select count(*)::int from public.app_results where created_at >= date_trunc('day', now())),
    (select count(*)::int from public.assignment_submissions where status = 'submitted'),
    public.unread_feedback_count()
  where public.is_admin();
$$;

revoke all on function public.clear_must_change_password() from public, anon;
grant execute on function public.clear_must_change_password() to authenticated;
revoke all on function public.admin_set_role(uuid, text) from public, anon;
grant execute on function public.admin_set_role(uuid, text) to authenticated;
revoke all on function public.admin_dashboard_stats() from public, anon;
grant execute on function public.admin_dashboard_stats() to authenticated;
