-- 블로그 공용 스키마: profiles, posts, comments, likes, views
-- 모든 테이블은 RLS로 보호한다. 클라이언트는 anon key만 사용한다.
--
-- 최초 관리자 지정 (가입 후 SQL Editor에서 1회 실행):
--   update public.profiles set role = 'admin' where id = '<내 auth.users id>';

-- ─────────────────────────────────────────────
-- 공통: updated_at 자동 갱신
-- ─────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ─────────────────────────────────────────────
-- profiles
-- ─────────────────────────────────────────────
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 50),
  avatar_url   text,
  role         text not null default 'user' check (role in ('admin', 'user')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- 가입 시 프로필 자동 생성
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
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 관리자 여부 (RLS 정책에서 사용)
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

alter table public.profiles enable row level security;

create policy "profiles: 누구나 조회"
  on public.profiles for select
  using (true);

create policy "profiles: 본인만 수정"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- role 컬럼은 클라이언트에서 수정 불가 (이름/아바타만 허용)
revoke update on public.profiles from anon, authenticated;
grant update (display_name, avatar_url) on public.profiles to authenticated;

-- ─────────────────────────────────────────────
-- posts (마크다운 원본 저장)
-- ─────────────────────────────────────────────
create table public.posts (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title        text not null check (char_length(title) between 1 and 200),
  summary      text,
  content_md   text not null default '',
  cover_url    text,
  tags         text[] not null default '{}',
  published    boolean not null default false,
  published_at timestamptz,
  author_id    uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index posts_published_idx on public.posts (published, published_at desc);

create trigger posts_updated_at
  before update on public.posts
  for each row execute function public.set_updated_at();

alter table public.posts enable row level security;

create policy "posts: 공개 글은 누구나, 관리자는 전체 조회"
  on public.posts for select
  using (published or public.is_admin());

create policy "posts: 관리자만 작성"
  on public.posts for insert
  with check (public.is_admin());

create policy "posts: 관리자만 수정"
  on public.posts for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "posts: 관리자만 삭제"
  on public.posts for delete
  using (public.is_admin());

-- ─────────────────────────────────────────────
-- comments (로그인 사용자)
-- ─────────────────────────────────────────────
create table public.comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  body       text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index comments_post_idx on public.comments (post_id, created_at);

create trigger comments_updated_at
  before update on public.comments
  for each row execute function public.set_updated_at();

alter table public.comments enable row level security;

create policy "comments: 공개 글의 댓글은 누구나 조회"
  on public.comments for select
  using (
    public.is_admin()
    or exists (select 1 from public.posts p where p.id = post_id and p.published)
  );

create policy "comments: 로그인 사용자가 공개 글에 작성"
  on public.comments for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.posts p where p.id = post_id and p.published)
  );

create policy "comments: 본인만 수정"
  on public.comments for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "comments: 본인 또는 관리자 삭제"
  on public.comments for delete
  to authenticated
  using (auth.uid() = user_id or public.is_admin());

-- ─────────────────────────────────────────────
-- likes (로그인 사용자, 글당 1회)
-- ─────────────────────────────────────────────
create table public.likes (
  post_id    uuid not null references public.posts (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

alter table public.likes enable row level security;

create policy "likes: 누구나 조회"
  on public.likes for select
  using (true);

create policy "likes: 본인 좋아요 추가"
  on public.likes for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.posts p where p.id = post_id and p.published)
  );

create policy "likes: 본인 좋아요 취소"
  on public.likes for delete
  to authenticated
  using (auth.uid() = user_id);

-- ─────────────────────────────────────────────
-- views (조회수, 비로그인 포함)
-- 테이블 직접 쓰기는 막고 increment_post_view() RPC로만 증가시킨다.
-- 중복 방지는 클라이언트 sessionStorage로 한다.
-- ─────────────────────────────────────────────
create table public.views (
  post_id    uuid primary key references public.posts (id) on delete cascade,
  count      bigint not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.views enable row level security;

create policy "views: 누구나 조회"
  on public.views for select
  using (true);

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
