-- 회원 완전 탈퇴 — 계정(auth.users)은 실제로 지우고, 학습 기록은 모두 남긴다.
-- 설계: docs/admin/admin-tools/spec.md §1 + "개정 1"(개정 1이 본문 추천안보다 우선).
--
-- ▶ 실행 방법
--   Supabase 대시보드 > SQL Editor > New query 에 이 파일 전체를 붙여넣고 Run.
--   여러 번 실행해도 안전하다(if not exists / create or replace / drop ... if exists / 제약은 이름으로 지우고 다시 추가).
--   앞선 마이그레이션 8개(20260921000000 ~ 20260922050000)가 먼저 실행돼 있어야 한다.
--   ⚠ 이 SQL을 실행한 다음 Edge Function(admin-delete-member)을 배포하고, 마지막으로 사이트를 배포(push)한다.
--
-- ▶ 이 파일이 바꾸는 외래키 (왜 바꾸는지)
--   ┌ 표 ──────────────┬ 컬럼 ─────┬ 지금 ────────────────────────┬ 바꾼 뒤 ───────────────────────────┐
--   │ public.profiles    │ id        │ → auth.users(id) on delete cascade │ 외래키 제거                         │
--   │                    │           │ (계정을 지우면 프로필까지 사라짐)   │ → 계정을 지워도 프로필 행이 남는다   │
--   │ public.app_progress│ user_id   │ → auth.users(id) on delete cascade │ → public.profiles(id) on delete cascade │
--   │                    │           │ (계정을 지우면 진행 기록이 사라짐)  │ → profiles 행은 지우지 않으므로 남는다 │
--   │ storage.objects    │ owner     │ → auth.users(id)                   │ on delete set null (파일 행 보존)    │
--   │ storage.buckets    │ owner     │   (삭제 차단 또는 cascade)          │ on delete set null                  │
--   └────────────────────┴───────────┴──────────────────────────────┴──────────────────────────────────┘
--   storage 쪽은 Supabase가 관리하는 스키마라 권한 때문에 수정이 실패할 수 있다. 실패해도 마이그레이션은 계속되고,
--   대신 §5의 public.withdrawal_blocking_fks() 안전장치가 **탈퇴 자체를 거부**해 파일 행이 사라지는 일을 막는다.
--   그 밖의 학습·커뮤니티 표(comments, likes, app_results, post_reads, assignment_submissions,
--   feedback_threads/messages/read_marks, member_directory, community_posts/comments/likes/reports,
--   posts.author_id, assignments.created_by, praise_presets.created_by)는 모두 **public.profiles**를 참조한다.
--   profiles 행은 지우지 않으므로 cascade가 걸려 있어도 그대로 남는다 → 바꿀 것이 없다.
--
-- ▶ 실행 후 확인 쿼리
--   -- 1) 새 컬럼(오류 없이 실행되면 성공)
--   select id, role, withdrawn_at from public.profiles limit 5;
--   -- 2) auth.users를 참조하는 외래키가 auth 스키마 밖에 남아 있는지 (profiles/app_progress는 없어야 한다)
--   select n.nspname as schema, c.relname as "table", con.conname, con.confdeltype as on_delete
--   from pg_constraint con
--   join pg_class c on c.oid = con.conrelid
--   join pg_namespace n on n.oid = c.relnamespace
--   where con.contype = 'f' and con.confrelid = 'auth.users'::regclass and n.nspname <> 'auth'
--   order by 1, 2;
--      → on_delete 값: c = cascade(행이 사라짐, 남아 있으면 안 됨), n = set null, a/r = 삭제를 막음.
--   -- 3) app_progress가 이제 profiles를 참조하는지 (confdeltype = 'c', convalidated = false는 정상 — not valid로 추가)
--   select conname, confrelid::regclass, confdeltype, convalidated from pg_constraint
--   where conrelid = 'public.app_progress'::regclass and contype = 'f';
--   -- 3-1) 탈퇴 안전장치: 빈 배열 {} 이어야 한다. 비어 있지 않으면 탈퇴가 거부된다(목록을 알려 주세요).
--   select public.withdrawal_blocking_fks();
--   -- 4) 탈퇴 기록 표(빈 결과가 정상)
--   select * from public.member_withdrawal_log limit 5;
--   -- 5) 서비스 롤 전용 함수가 anon/authenticated에 열려 있지 않은지 (둘 다 false)
--   select has_function_privilege('anon', 'public.admin_finalize_withdrawal(uuid, uuid)', 'execute'),
--          has_function_privilege('authenticated', 'public.admin_finalize_withdrawal(uuid, uuid)', 'execute');

-- ═════════════════════════════════════════════
-- 1. profiles.withdrawn_at — 탈퇴 처리된 시각(null = 정상 회원)
--    must_change_password와 같은 이유로 update 권한 목록에 넣지 않는다(학생이 스스로 끌 수 없게).
--    select 권한에는 넣는다 — 게시판·댓글 등 어디서나 "탈퇴한 학생"으로 바꿔 보여 주려면 읽을 수 있어야 한다.
--    (20260922000000_admin_learning_fixes.sql 이 profiles의 테이블 SELECT 권한을 컬럼 단위로 바꿔 두었다.)
-- ═════════════════════════════════════════════
alter table public.profiles
  add column if not exists withdrawn_at timestamptz;

grant select (id, display_name, avatar_url, role, created_at, updated_at, withdrawn_at)
  on public.profiles to anon, authenticated;

-- 쓰기 가능한 컬럼은 이름·아바타뿐이라는 규칙을 다시 확인한다(재실행 안전).
revoke update on public.profiles from anon, authenticated;
grant update (display_name, avatar_url) on public.profiles to authenticated;

-- ═════════════════════════════════════════════
-- 2. profiles ↛ auth.users : 외래키 제거
--    지금은 profiles.id 가 auth.users(id)를 on delete cascade 로 참조한다.
--    계정을 지우면 프로필까지 사라지고, 프로필을 참조하던 모든 학습 기록이 연쇄로 사라진다.
--    "계정은 지우고 기록은 남긴다"는 요구사항을 지키려면 이 고리를 끊어야 한다.
--    PK와 컬럼 타입은 그대로라서 기존 조인(profiles(...) embed)은 모두 그대로 동작한다.
--    이름을 찍어 넣지 않고 실제로 걸려 있는 제약을 찾아 지운다(이름이 다를 수 있고, 재실행해도 안전하다).
-- ═════════════════════════════════════════════
do $$
declare
  r record;
  n integer := 0;
begin
  for r in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'public.profiles'::regclass
      and con.contype = 'f'
      and con.confrelid = 'auth.users'::regclass
  loop
    execute format('alter table public.profiles drop constraint %I', r.conname);
    raise notice 'profiles: auth.users 외래키 %(을)를 제거했습니다 — 계정을 지워도 프로필이 남습니다.', r.conname;
    n := n + 1;
  end loop;
  if n = 0 then
    raise notice 'profiles: auth.users 외래키가 이미 없습니다(이 파일을 이미 실행함).';
  end if;
end $$;

-- ═════════════════════════════════════════════
-- 3. app_progress.user_id : auth.users → public.profiles 로 옮긴다
--    auth.users 를 직접 참조하는 유일한 학습 표였다(on delete cascade → 계정 삭제 시 진행 기록이 사라짐).
--    profiles 는 지우지 않으므로, profiles 를 참조하게 바꾸면 기록이 보존된다.
--    not valid: 기존 행은 검사하지 않는다(프로필이 없는 예전 행이 있어도 실행이 실패하지 않게).
--               on delete 동작은 not valid 여부와 상관없이 정상 적용된다.
-- ═════════════════════════════════════════════
do $$
declare
  r record;
begin
  for r in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'public.app_progress'::regclass
      and con.contype = 'f'
      and con.confrelid = 'auth.users'::regclass
  loop
    execute format('alter table public.app_progress drop constraint %I', r.conname);
    raise notice 'app_progress: auth.users 외래키 %(을)를 제거했습니다.', r.conname;
  end loop;
end $$;

alter table public.app_progress drop constraint if exists app_progress_user_id_profiles_fkey;
alter table public.app_progress
  add constraint app_progress_user_id_profiles_fkey
  foreign key (user_id) references public.profiles (id) on delete cascade not valid;

-- ═════════════════════════════════════════════
-- 4. storage(업로드 게임 파일) — 계정 삭제가 파일 행을 지우거나 삭제를 막지 않게
--    Supabase 버전에 따라 storage.objects.owner / storage.buckets.owner 가 auth.users(id)를 참조한다.
--    · on delete 지정 없음(a/r) → 게임을 올린 학생의 계정 삭제가 **거부**된다.
--    · on delete cascade(c)     → 계정을 지우면 **업로드 파일 행이 함께 사라진다**(review S3).
--    둘 다 위험하므로 **cascade 도 포함해** on delete set null 로 바꾼다.
--    파일 행은 남고 소유자 표시(owner)만 비며, 파일 접근 권한은 community_posts.game_path 기준
--    정책이 정하므로 화면 동작에는 영향이 없다.
--    storage 스키마 권한이 없어 실패할 수 있으므로 예외를 잡고 안내만 남긴다(마이그레이션 전체는 계속 실행된다).
--    고치지 못한 경우에도 §5의 withdrawal_blocking_fks() 가 실제 탈퇴를 막아 준다.
-- ═════════════════════════════════════════════
do $$
declare
  r record;
  v_col text;
begin
  for r in
    select ns.nspname as sch, c.relname as tbl, con.conname, con.conkey, con.conrelid, con.confdeltype as del
    from pg_constraint con
    join pg_class c on c.oid = con.conrelid
    join pg_namespace ns on ns.oid = c.relnamespace
    where ns.nspname = 'storage'
      and c.relname in ('objects', 'buckets')
      and con.contype = 'f'
      and con.confrelid = 'auth.users'::regclass
      and con.confdeltype <> 'n'   -- 이미 set null 이면 건드릴 것이 없다
  loop
    select a.attname into v_col
    from pg_attribute a
    where a.attrelid = r.conrelid and a.attnum = r.conkey[1];
    begin
      execute format('alter table storage.%I drop constraint %I', r.tbl, r.conname);
      execute format(
        'alter table storage.%I add constraint %I foreign key (%I) references auth.users (id) on delete set null',
        r.tbl, r.conname, v_col);
      raise notice 'storage.%.%(제약 %, 기존 on delete "%")를 set null 로 바꿨습니다 — 파일 행이 보존됩니다.',
        r.tbl, v_col, r.conname, r.del;
    exception when others then
      raise notice '⚠ storage.%.%(제약 %)를 고치지 못했습니다: %. 이 상태에서는 탈퇴가 거부됩니다(§5 안전장치).',
        r.tbl, v_col, r.conname, sqlerrm;
    end;
  end loop;
end $$;

-- ═════════════════════════════════════════════
-- 5. 안전장치: 탈퇴를 막아야 하는 외래키 목록 (review S3)
--    NOTICE는 사용자가 놓칠 수 있으므로, **탈퇴할 때마다 실제로 검사**하는 함수를 둔다.
--    Edge Function(admin-delete-member)이 계정을 지우기 전에 이 함수를 부르고,
--    결과가 비어 있지 않으면 삭제를 거부한다 → 첫 탈퇴에서 파일 행이 사라지는 일이 생길 수 없다.
--    대상: auth 스키마 밖에서 auth.users 를 참조하면서
--          c(cascade, 행이 사라짐) 또는 a/r(삭제를 막음)인 외래키.
--          n(set null)·d(set default)는 안전하므로 목록에 넣지 않는다.
-- ═════════════════════════════════════════════
create or replace function public.withdrawal_blocking_fks()
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    array_agg(
      ns.nspname || '.' || c.relname || ' (' || con.conname || ', on delete ' ||
      case con.confdeltype when 'c' then 'cascade — 행이 함께 삭제됨'
                           when 'r' then 'restrict — 삭제가 거부됨'
                           else 'no action — 삭제가 거부됨' end || ')'
      order by ns.nspname, c.relname
    ),
    '{}'::text[]
  )
  from pg_constraint con
  join pg_class c on c.oid = con.conrelid
  join pg_namespace ns on ns.oid = c.relnamespace
  where con.contype = 'f'
    and con.confrelid = 'auth.users'::regclass
    and ns.nspname <> 'auth'
    and con.confdeltype in ('c', 'a', 'r');
$$;

revoke all on function public.withdrawal_blocking_fks() from public, anon, authenticated;
grant execute on function public.withdrawal_blocking_fks() to service_role;

-- 실행 직후에도 한 번 알려 준다(자동 수정이 실패했거나 예상 못 한 외래키가 남은 경우).
do $$
declare
  v text[];
begin
  v := public.withdrawal_blocking_fks();
  if array_length(v, 1) is null then
    raise notice '✔ 계정을 지워도 기록을 잃거나 삭제가 막힐 외래키가 없습니다.';
  else
    raise notice '⚠ 아직 위험한 외래키가 남아 있어 탈퇴가 거부됩니다(안전장치 작동): %', array_to_string(v, ' / ');
    raise notice '   → 위 목록을 알려 주세요. 고치기 전에는 admin-delete-member 가 계정을 지우지 않습니다.';
  end if;
end $$;

-- ═════════════════════════════════════════════
-- 6. handle_new_user: 같은 id의 프로필이 이미 있으면 건너뛴다
--    계정을 지워도 프로필이 남게 되었으므로, 혹시 같은 id로 계정이 다시 만들어져도
--    트리거가 실패해 가입 자체가 막히지 않게 한다(기존 동작은 그대로).
-- ═════════════════════════════════════════════
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

-- ═════════════════════════════════════════════
-- 7. member_withdrawal_log — 누가·언제·누구를 탈퇴시켰는지
--    target_id 에는 외래키를 걸지 않는다(password_reset_log 와 같은 이유: 기록은 끝까지 남긴다).
--    actor_id 는 관리자 이름을 화면에서 조인해 보여 주려고 profiles 를 참조한다(on delete set null).
--    이름·아이디는 탈퇴 시점 값을 스냅샷으로 함께 저장한다.
-- ═════════════════════════════════════════════
create table if not exists public.member_withdrawal_log (
  id           bigint generated always as identity primary key,
  target_id    uuid not null,
  target_name  text,
  target_email text,
  actor_id     uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now()
);

create index if not exists member_withdrawal_log_target_idx
  on public.member_withdrawal_log (target_id, created_at desc);

alter table public.member_withdrawal_log enable row level security;

drop policy if exists "member_withdrawal_log: 관리자만 조회" on public.member_withdrawal_log;
create policy "member_withdrawal_log: 관리자만 조회"
  on public.member_withdrawal_log for select
  to authenticated
  using (public.is_admin());

-- 쓰기는 admin_finalize_withdrawal(서비스 롤)만 한다.
revoke all on public.member_withdrawal_log from anon, authenticated;
grant select on public.member_withdrawal_log to authenticated;

-- ═════════════════════════════════════════════
-- 8. admin_finalize_withdrawal — 탈퇴 마무리(서비스 롤 전용)
--    Edge Function(admin-delete-member)이 auth.users 행을 지운 "다음"에 호출한다.
--    · 같은 회원을 다시 호출해도 안전하다(이미 탈퇴면 시각을 그대로 돌려주고 로그를 덧붙이지 않는다).
--    · 관리자 자신·다른 관리자는 거부한다(Edge Function에서도 한 번 더 막는다).
--    · display_name 은 지우지 않는다 — 관리자가 기록의 주인을 알아볼 수 있어야 한다.
--      "탈퇴한 학생" 표시는 화면에서 withdrawn_at 을 보고 바꾼다.
-- ═════════════════════════════════════════════
create or replace function public.admin_finalize_withdrawal(p_target uuid, p_actor uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_at    timestamptz;
  v_name  text;
  v_email text;
begin
  if p_target is null or p_actor is null then
    raise exception 'missing arguments';
  end if;
  -- 서비스 롤만 실행할 수 있지만(아래 grant), 한 번 더 확인한다.
  if not exists (select 1 from public.profiles where id = p_actor and role = 'admin') then
    raise exception 'actor is not an admin';
  end if;
  if p_target = p_actor then
    raise exception 'cannot withdraw yourself';
  end if;
  if exists (select 1 from public.profiles where id = p_target and role = 'admin') then
    raise exception 'admin accounts cannot be withdrawn';
  end if;

  select p.display_name, p.withdrawn_at into v_name, v_at
  from public.profiles p where p.id = p_target;
  if not found then
    raise exception 'target profile not found';
  end if;

  if v_at is null then
    v_at := now();
    update public.profiles set withdrawn_at = v_at where id = p_target;

    select d.email into v_email from public.member_directory d where d.id = p_target;

    insert into public.member_withdrawal_log (target_id, target_name, target_email, actor_id)
    values (p_target, v_name, v_email, p_actor);
  end if;

  return v_at;
end;
$$;

-- Supabase 는 public 스키마 함수에 anon/authenticated 실행 권한을 기본으로 주므로 명시적으로 회수한다.
revoke all on function public.admin_finalize_withdrawal(uuid, uuid) from public, anon, authenticated;
grant execute on function public.admin_finalize_withdrawal(uuid, uuid) to service_role;
