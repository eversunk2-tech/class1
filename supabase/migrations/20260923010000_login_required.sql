-- "로그인해야만 이용" 토글 — site_settings 한 줄로 사이트 전체 읽기를 잠근다.
-- 설계: docs/admin/admin-tools/spec.md §2 (§2.2 정책 표 전체를 그대로 반영).
--
-- ▶ 실행 방법
--   Supabase 대시보드 > SQL Editor > New query 에 이 파일 전체를 붙여넣고 Run.
--   여러 번 실행해도 안전하다(if not exists / on conflict do nothing / drop policy if exists / create or replace).
--   앞선 마이그레이션(20260921000000 ~ 20260922050000)이 먼저 실행돼 있어야 한다.
--   20260923000000_member_withdrawal.sql 과는 서로 의존하지 않는다(순서 무관하지만 번호순 실행을 권한다).
--   실행해도 사이트 동작은 그대로다 — login_required 기본값이 false 라서 잠금이 꺼진 상태로 시작한다.
--
-- ▶ 자물쇠 방지(절대 규칙)
--   1. site_settings 의 SELECT 정책은 언제나 using (true) 다. 잠금 상태를 읽지 못하면 끄러 들어갈 수도 없다.
--   2. 관리자는 항상 로그인 상태이므로 아래 모든 게이트를 그냥 통과한다.
--   3. /login/ · /reset-password/ 는 Supabase Auth 엔드포인트만 쓰므로 이 정책들과 무관하게 늘 동작한다.
--   4. 잘못 켰으면 관리자 화면에서 스위치를 다시 끄면 즉시 원복된다.
--   5. 값 변경은 admin_set_login_required() RPC로만 한다(테이블 UPDATE 권한은 아무에게도 주지 않는다).
--
-- ▶ 실행 후 확인 쿼리
--   -- 1) 설정 한 줄 (login_required = false 여야 한다)
--   select * from public.site_settings;
--   -- 2) 잠금이 꺼진 상태에서 읽기가 되는지 — 시크릿 창(로그아웃 상태)으로 사이트를 열어 글 목록이 평소처럼 보이면 정상.
--   -- 3) 함수 권한 — 게이트 함수는 모든 역할이 실행할 수 있어야 한다(review S1). 앞 3개 true, 마지막 false.
--   select has_function_privilege('anon', 'public.can_browse()', 'execute')          as anon_can_browse,
--          has_function_privilege('authenticated', 'public.can_browse()', 'execute') as auth_can_browse,
--          has_function_privilege('service_role', 'public.can_browse()', 'execute')  as svc_can_browse,
--          has_function_privilege('anon', 'public.admin_set_login_required(boolean)', 'execute') as anon_set;
--   -- 4) 게이트가 붙은 정책 10개 (public 9개 + storage.objects 1개)
--   select schemaname, tablename, policyname from pg_policies
--   where qual like '%can_browse%' order by 1, 2;
--   -- ⚠ select public.admin_set_login_required(true); 를 SQL Editor에서 실행하지 않는다.
--      (SQL Editor 세션에는 auth.uid()가 없어 "관리자만" 검사에 걸리거나, 서비스 롤이면 검사를 건너뛰게 된다.
--       켜고 끄기는 반드시 관리자 화면의 스위치로 시험한다.)

-- ═════════════════════════════════════════════
-- 1. site_settings — 항상 한 줄(id = true)
-- ═════════════════════════════════════════════
create table if not exists public.site_settings (
  id             boolean primary key default true,
  login_required boolean not null default false,
  updated_at     timestamptz not null default now(),
  updated_by     uuid references public.profiles (id) on delete set null
);

-- 한 줄만 존재하도록(재실행 안전하게 이름을 붙여 지우고 다시 만든다)
alter table public.site_settings drop constraint if exists site_settings_singleton;
alter table public.site_settings add constraint site_settings_singleton check (id);

insert into public.site_settings (id, login_required)
values (true, false)
on conflict (id) do nothing;

alter table public.site_settings enable row level security;

-- ⚠ 절대 조건부로 잠그지 않는다. 비로그인 방문자도 "지금 로그인이 필요한 상태"임을 읽을 수 있어야
--   로그인 안내 화면을 띄울 수 있고, 관리자도 잠긴 상태를 확인하고 끌 수 있다.
drop policy if exists "site_settings: 누구나 조회" on public.site_settings;
create policy "site_settings: 누구나 조회"
  on public.site_settings for select
  using (true);

-- 쓰기 권한은 아무에게도 주지 않는다 → 값 변경은 admin_set_login_required() RPC(security definer)만 할 수 있다.
revoke all on public.site_settings from anon, authenticated;
grant select on public.site_settings to anon, authenticated;

-- ═════════════════════════════════════════════
-- 2. 게이트 함수
--    login_required(): 지금 잠금이 켜져 있는지. 값을 못 읽으면 false(= 잠그지 않음)로 안전하게 떨어진다.
--    can_browse():     이 요청이 공개 데이터를 읽어도 되는지 = 로그인했거나 잠금이 꺼져 있음.
--    둘 다 security definer 라 site_settings 의 RLS와 무관하게 값을 읽는다.
--    재귀(42P17) 없음: site_settings 의 정책은 true / is_admin() 뿐이라 이 함수들을 부르지 않는다.
-- ═════════════════════════════════════════════
create or replace function public.login_required()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select s.login_required from public.site_settings s where s.id = true limit 1), false);
$$;

-- ⚠ 실행 권한을 PUBLIC에서 회수하지 않는다(review S1).
--    이 함수는 아래 RLS 정책들이 부르는데, 정책은 "요청을 보낸 역할"로 평가된다.
--    anon/authenticated 가 아닌 역할(스토리지 내부 역할 등)로 평가될 때 권한이 없으면
--    "permission denied for function public.login_required" 가 나 게임 파일 내려받기가 통째로 막힌다.
--    site_settings 는 어차피 전체 공개 읽기라 PUBLIC 실행으로 새는 정보가 없다(is_admin()과 같은 취급).
grant execute on function public.login_required() to public;

create or replace function public.can_browse()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null or not public.login_required();
$$;

-- login_required()와 같은 이유로 PUBLIC 실행을 유지한다(review S1).
grant execute on function public.can_browse() to public;

-- 화면에서 직접 update 하지 않고 이 RPC로만 바꾼다(updated_by 자동 기록 + 관리자 검사).
create or replace function public.admin_set_login_required(p_value boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_value is null then
    raise exception '값이 없습니다.';
  end if;
  if not public.is_admin() then
    raise exception '관리자만 사용할 수 있습니다.';
  end if;
  update public.site_settings
     set login_required = p_value, updated_at = now(), updated_by = auth.uid()
   where id = true;
  if not found then
    insert into public.site_settings (id, login_required, updated_by)
    values (true, p_value, auth.uid());
  end if;
end;
$$;

revoke all on function public.admin_set_login_required(boolean) from public, anon;
grant execute on function public.admin_set_login_required(boolean) to authenticated;

-- ═════════════════════════════════════════════
-- 3. 기존 "누구나 조회" 정책에 게이트를 더한다 (spec §2.2 표 그대로, 10개)
--    Postgres 는 정책을 제자리에서 고칠 수 없으므로 drop + create 한다.
--    · 이미 "본인 또는 관리자만"이던 정책(app_results, post_reads, assignment_submissions,
--      feedback_*, app_progress, member_directory, praise_presets, community_reports,
--      password_reset_log, member_withdrawal_log)은 원래 비로그인이 못 읽으므로 손대지 않는다.
--    · 과학 차시 앱은 앱 자체가 로그인 필수라 이 토글과 무관하다.
-- ═════════════════════════════════════════════

-- 3.1 profiles (작성자 이름·아바타)
drop policy if exists "profiles: 누구나 조회" on public.profiles;
create policy "profiles: 누구나 조회"
  on public.profiles for select
  using ((select public.can_browse()));

-- 3.2 posts (블로그 글)
drop policy if exists "posts: 공개 글은 누구나, 관리자는 전체 조회" on public.posts;
create policy "posts: 공개 글은 누구나, 관리자는 전체 조회"
  on public.posts for select
  using ((published and (select public.can_browse())) or public.is_admin());

-- 3.3 comments (블로그 댓글)
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

-- 3.4 likes
drop policy if exists "likes: 누구나 조회" on public.likes;
create policy "likes: 누구나 조회"
  on public.likes for select
  using ((select public.can_browse()));

-- 3.5 views (조회수)
drop policy if exists "views: 누구나 조회" on public.views;
create policy "views: 누구나 조회"
  on public.views for select
  using ((select public.can_browse()));

-- 3.6 assignments (과제)
drop policy if exists "assignments: 공개된 것은 누구나, 관리자는 전체 조회" on public.assignments;
create policy "assignments: 공개된 것은 누구나, 관리자는 전체 조회"
  on public.assignments for select
  using ((published and (select public.can_browse())) or public.is_admin());

-- 3.7 community_posts (자유게시판 + 학습게임)
drop policy if exists "community_posts: 숨김 아니면 누구나, 작성자·관리자는 숨김도" on public.community_posts;
create policy "community_posts: 숨김 아니면 누구나, 작성자·관리자는 숨김도"
  on public.community_posts for select
  using (
    ((not hidden) and (select public.can_browse()))
    or auth.uid() = author_id
    or public.is_admin()
  );

-- 3.8 community_comments
drop policy if exists "community_comments: 숨김 아니면 누구나" on public.community_comments;
create policy "community_comments: 숨김 아니면 누구나"
  on public.community_comments for select
  using (
    (select public.can_browse())
    and (not hidden or auth.uid() = user_id or public.is_admin())
    and exists (
      select 1 from public.community_posts p
      where p.id = post_id and (not p.hidden or public.is_admin() or auth.uid() = p.author_id)
    )
  );

-- 3.9 community_likes
--     글 쪽 정책과 별개 정책이라 여기에도 따로 게이트를 넣어야 한다(빠뜨리기 쉬운 지점).
drop policy if exists "community_likes: 누구나 조회" on public.community_likes;
drop policy if exists "community_likes: 볼 수 있는 글만 조회" on public.community_likes;
create policy "community_likes: 볼 수 있는 글만 조회"
  on public.community_likes for select
  using (
    (select public.can_browse())
    and exists (
      select 1 from public.community_posts p
      where p.id = community_likes.post_id and (not p.hidden or auth.uid() = p.author_id or public.is_admin())
    )
  );

-- 3.10 storage.objects (game-uploads 버킷의 업로드 게임 파일)
--      스토리지 정책은 테이블 정책과 독립적이라 반드시 따로 넣어야 한다.
--      본인 파일·관리자는 원래 로그인 상태라 게이트 영향이 없고, 비로그인 열람만 막힌다.
drop policy if exists "game-uploads: 누구나 조회" on storage.objects;
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

-- ═════════════════════════════════════════════
-- 4. 조회수 RPC도 잠금을 따른다 (review S7)
--    increment_post_view()는 security definer라 RLS를 지나쳐 비로그인에서도 조회수를 올렸다.
--    글 내용이 새는 것은 아니지만 잠금 중에는 세지 않는 편이 일관된다.
--    null을 돌려주면 화면은 조용히 "조회수 표시 없음"으로 떨어진다(src/components/view-counter.tsx).
--    본문 나머지는 20260921000000_init_blog.sql의 정의 그대로다.
-- ═════════════════════════════════════════════
create or replace function public.increment_post_view(p_slug text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_post_id uuid;
  v_count   bigint;
begin
  if not public.can_browse() then
    return null;
  end if;

  select id into v_post_id
  from public.posts
  where slug = p_slug and published;

  if v_post_id is null then
    return null;
  end if;

  insert into public.views (post_id, count)
  values (v_post_id, 1)
  on conflict (post_id)
  do update set count = public.views.count + 1, updated_at = now()
  returning count into v_count;

  return v_count;
end;
$$;

revoke all on function public.increment_post_view(text) from public;
grant execute on function public.increment_post_view(text) to anon, authenticated;
