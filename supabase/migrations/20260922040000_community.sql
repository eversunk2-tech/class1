-- community — 자유게시판 + 학습게임 업로드 + 신고 (docs/community/spec.md §4·§5·§13)
--
-- ▶ 실행 방법
--   Supabase 대시보드 > SQL Editor > New query 에 이 파일 전체를 붙여넣고 Run.
--   여러 번 실행해도 안전하다(if not exists / create or replace / drop ... if exists / on conflict).
--   앞선 마이그레이션(20260921000000_init_blog.sql — profiles, set_updated_at(), is_admin())이 먼저 실행돼 있어야 한다.
--   기존 테이블(posts·comments·likes 등)과 그 정책은 건드리지 않는다.
--   실행 전에는 사이트의 자유게시판·학습게임 화면이 "준비 중(SQL 실행 필요)" 안내를 보여 준다.
--
-- ▶ 실행 후 확인 쿼리
--   -- 1) 테이블과 RLS (rowsecurity = true 4행)
--   select tablename, rowsecurity from pg_tables where schemaname = 'public'
--     and tablename in ('community_posts','community_comments','community_likes','community_reports');
--   -- 2) 정책
--   select tablename, policyname, cmd from pg_policies where schemaname = 'public' and tablename like 'community_%' order by 1, 2;
--   -- 3) Storage 버킷(public = false(비공개), file_size_limit = 2097152, allowed_mime_types = text/plain 계열만)
--   select id, public, file_size_limit, allowed_mime_types from storage.buckets where id = 'game-uploads';
--   -- 4) Storage 정책
--   select policyname, cmd from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname like 'game-uploads%';
--   -- 5) 대시보드에서 따로 만든 넓은 Storage 정책이 없는지(bucket_id 조건이 없는 정책이 있으면 위 제한이 무력화된다)
--   select policyname, cmd, roles, qual, with_check from pg_policies where schemaname = 'storage' and tablename = 'objects';
--
-- ▶ 보안 요약(spec §4)
--   · 업로드 게임 HTML은 비공개 버킷에 text/plain으로만 저장된다(버킷 allowed_mime_types로 서버에서 강제).
--     파일은 "연결된 게임 글을 볼 수 있는 사람"(숨김이 아니면 누구나, 숨김이면 작성자·관리자)과 본인만 내려받을 수 있다.
--     사이트는 원문을 인증된 download()로 텍스트로 받아 <iframe sandbox="allow-scripts" srcdoc>에서만 실행한다.
--   · 작성자는 hidden을 바꿀 수 없다(컬럼 권한). 숨김/해제·신고 처리는 관리자 전용 SECURITY DEFINER RPC로만.
--   · 남용 방지: 글 20초·댓글 5초·신고 1시간 20건 간격 제한, 사용자당 게임 글 30개(Storage 파일은 여유분 포함 35개), 파일 2MB.
--   · 신고 기록은 대상 글·댓글이 지워져도 남는다(post_id/comment_id → null, 신고 시점 스냅샷 보관).

-- ─────────────────────────────────────────────
-- community_posts (자유게시판 + 학습게임 통합, kind로 구분)
-- ─────────────────────────────────────────────
create table if not exists public.community_posts (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null check (kind in ('board', 'game')),
  title       text not null check (char_length(btrim(title)) between 1 and 100),
  body        text not null default '' check (char_length(body) <= 5000),
  game_path   text,
  game_size   integer,
  author_id   uuid default auth.uid() references public.profiles (id) on delete set null,
  hidden      boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 제약(재실행 안전: 이름을 붙여 지우고 다시 만든다)
alter table public.community_posts drop constraint if exists community_posts_game_fields_chk;
alter table public.community_posts
  add constraint community_posts_game_fields_chk check (
    (kind = 'board' and game_path is null and game_size is null)
    or (
      kind = 'game'
      and game_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.html$'
      and game_size between 1 and 2097152
      and char_length(body) <= 1000
    )
  );

create index if not exists community_posts_kind_idx on public.community_posts (kind, hidden, created_at desc);
create index if not exists community_posts_author_idx on public.community_posts (author_id, created_at desc);
-- Storage 조회 정책이 game_path로 글을 찾는다
create index if not exists community_posts_game_path_idx on public.community_posts (game_path) where game_path is not null;

drop trigger if exists community_posts_updated_at on public.community_posts;
create trigger community_posts_updated_at
  before update on public.community_posts
  for each row execute function public.set_updated_at();

-- 게임 파일 경로는 "지금 로그인한 사용자 폴더"의 파일만 연결할 수 있다(남의 파일 가로채기 방지).
-- 남용 방지: 같은 사용자가 20초 안에 다시 글을 쓰지 못하게(soft rate limit).
create or replace function public.community_posts_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.author_id is distinct from auth.uid() and not public.is_admin() then
      raise exception 'author_mismatch';
    end if;
    if exists (
      select 1 from public.community_posts
      where author_id = new.author_id and created_at > now() - interval '20 seconds'
    ) then
      raise exception 'too_fast';
    end if;
    -- 게임 글은 사용자당 30개까지(Storage 파일 수가 아니라 "연결된 게임 글" 수로 센다)
    if new.kind = 'game' and (
      select count(*) from public.community_posts
      where author_id = new.author_id and kind = 'game'
    ) >= 30 then
      raise exception 'game_limit';
    end if;
  end if;
  -- 게임 파일은 "지금 로그인한 사용자 = 글 작성자"의 폴더에 있는 파일만 연결할 수 있다.
  --   · 남의 파일 가로채기 방지
  --   · 관리자가 학생 게임 파일을 자기 폴더 파일로 바꾸는 것도 막는다(작성자가 나중에 지울 수 없는 파일이 생기지 않게).
  -- INSERT이거나, UPDATE에서 게임 파일 경로가 바뀐 경우에만 검사한다(OLD는 UPDATE에서만 읽는다).
  if new.game_path is not null and (tg_op = 'INSERT' or new.game_path is distinct from old.game_path) then
    if split_part(new.game_path, '/', 1) is distinct from auth.uid()::text
       or split_part(new.game_path, '/', 1) is distinct from new.author_id::text then
      raise exception 'game_path_owner';
    end if;
  end if;
  -- kind·author_id·created_at·hidden은 컬럼 권한으로 클라이언트가 바꿀 수 없다(아래 grant).
  -- (author_id를 여기서 되돌리면 profiles 삭제 시 on delete set null이 막히므로 트리거에서는 건드리지 않는다.)
  return new;
end;
$$;

drop trigger if exists community_posts_guard on public.community_posts;
create trigger community_posts_guard
  before insert or update on public.community_posts
  for each row execute function public.community_posts_guard();

alter table public.community_posts enable row level security;

drop policy if exists "community_posts: 숨김 아니면 누구나, 작성자·관리자는 숨김도" on public.community_posts;
create policy "community_posts: 숨김 아니면 누구나, 작성자·관리자는 숨김도"
  on public.community_posts for select
  using (not hidden or auth.uid() = author_id or public.is_admin());

drop policy if exists "community_posts: 로그인 사용자 작성" on public.community_posts;
create policy "community_posts: 로그인 사용자 작성"
  on public.community_posts for insert
  to authenticated
  with check (auth.uid() = author_id and hidden = false);

drop policy if exists "community_posts: 본인 또는 관리자 수정" on public.community_posts;
create policy "community_posts: 본인 또는 관리자 수정"
  on public.community_posts for update
  to authenticated
  using (auth.uid() = author_id or public.is_admin())
  with check (auth.uid() = author_id or public.is_admin());

drop policy if exists "community_posts: 본인 또는 관리자 삭제" on public.community_posts;
create policy "community_posts: 본인 또는 관리자 삭제"
  on public.community_posts for delete
  to authenticated
  using (auth.uid() = author_id or public.is_admin());

-- 컬럼 권한: 클라이언트는 제목·본문·게임 파일만 고칠 수 있다(hidden은 아래 관리자 RPC로만).
revoke all on public.community_posts from anon, authenticated;
grant select on public.community_posts to anon, authenticated;
grant insert (kind, title, body, game_path, game_size) on public.community_posts to authenticated;
grant update (title, body, game_path, game_size) on public.community_posts to authenticated;
grant delete on public.community_posts to authenticated;

create or replace function public.set_community_post_hidden(p_id uuid, p_hidden boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
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

-- ─────────────────────────────────────────────
-- community_comments
-- ─────────────────────────────────────────────
create table if not exists public.community_comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.community_posts (id) on delete cascade,
  user_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body       text not null check (char_length(btrim(body)) between 1 and 1000),
  hidden     boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists community_comments_post_idx on public.community_comments (post_id, created_at);
create index if not exists community_comments_user_idx on public.community_comments (user_id, created_at desc);

drop trigger if exists community_comments_updated_at on public.community_comments;
create trigger community_comments_updated_at
  before update on public.community_comments
  for each row execute function public.set_updated_at();

create or replace function public.community_comments_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.community_comments
    where user_id = new.user_id and created_at > now() - interval '5 seconds'
  ) then
    raise exception 'too_fast';
  end if;
  return new;
end;
$$;
drop trigger if exists community_comments_rate_limit on public.community_comments;
create trigger community_comments_rate_limit
  before insert on public.community_comments
  for each row execute function public.community_comments_rate_limit();

alter table public.community_comments enable row level security;

drop policy if exists "community_comments: 숨김 아니면 누구나" on public.community_comments;
create policy "community_comments: 숨김 아니면 누구나"
  on public.community_comments for select
  using (
    (not hidden or auth.uid() = user_id or public.is_admin())
    and exists (
      select 1 from public.community_posts p
      where p.id = post_id and (not p.hidden or public.is_admin() or auth.uid() = p.author_id)
    )
  );

drop policy if exists "community_comments: 로그인 사용자 작성" on public.community_comments;
create policy "community_comments: 로그인 사용자 작성"
  on public.community_comments for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and hidden = false
    and exists (select 1 from public.community_posts p where p.id = post_id and not p.hidden)
  );

drop policy if exists "community_comments: 본인 수정" on public.community_comments;
create policy "community_comments: 본인 수정"
  on public.community_comments for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "community_comments: 본인 또는 관리자 삭제" on public.community_comments;
create policy "community_comments: 본인 또는 관리자 삭제"
  on public.community_comments for delete
  to authenticated
  using (auth.uid() = user_id or public.is_admin());

revoke all on public.community_comments from anon, authenticated;
grant select on public.community_comments to anon, authenticated;
grant insert (post_id, body) on public.community_comments to authenticated;
grant update (body) on public.community_comments to authenticated;
grant delete on public.community_comments to authenticated;

create or replace function public.set_community_comment_hidden(p_id uuid, p_hidden boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
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

-- ─────────────────────────────────────────────
-- community_likes
-- ─────────────────────────────────────────────
create table if not exists public.community_likes (
  post_id    uuid not null references public.community_posts (id) on delete cascade,
  user_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
alter table public.community_likes enable row level security;

-- 볼 수 있는 글(숨김이 아니거나 작성자·관리자)의 좋아요만 보인다. community_posts의 RLS가 숨김을 걸러 준다.
drop policy if exists "community_likes: 누구나 조회" on public.community_likes;
drop policy if exists "community_likes: 볼 수 있는 글만 조회" on public.community_likes;
create policy "community_likes: 볼 수 있는 글만 조회"
  on public.community_likes for select
  using (
    exists (
      select 1 from public.community_posts p
      where p.id = community_likes.post_id and (not p.hidden or auth.uid() = p.author_id or public.is_admin())
    )
  );

drop policy if exists "community_likes: 본인 추가" on public.community_likes;
create policy "community_likes: 본인 추가"
  on public.community_likes for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.community_posts p where p.id = post_id and not p.hidden)
  );

drop policy if exists "community_likes: 본인 취소" on public.community_likes;
create policy "community_likes: 본인 취소"
  on public.community_likes for delete
  to authenticated
  using (auth.uid() = user_id);

revoke all on public.community_likes from anon, authenticated;
grant select on public.community_likes to anon, authenticated;
grant insert (post_id) on public.community_likes to authenticated;
grant delete on public.community_likes to authenticated;

-- ─────────────────────────────────────────────
-- community_reports (신고 — spec §13)
--   · 로그인 사용자가 글·게임·댓글을 신고. 같은 사람의 같은 대상 중복 신고 불가.
--   · 조회는 관리자와 신고자 본인만. 처리(완료/다시 열기)는 관리자 RPC로만.
--   · 대상이 지워져도 신고는 남는다(post_id/comment_id → null). 신고 시점의 대상 제목·내용·작성자를 스냅샷으로 저장한다.
--   · 볼 수 없는 대상(숨긴 글·댓글)과 내 글·댓글은 신고할 수 없다(INSERT 정책, 호출자 RLS 기준).
-- ─────────────────────────────────────────────
create table if not exists public.community_reports (
  id               uuid primary key default gen_random_uuid(),
  post_id          uuid references public.community_posts (id) on delete set null,
  comment_id       uuid references public.community_comments (id) on delete set null,
  reporter_id      uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  reason           text not null check (reason in ('spam', 'abuse', 'inappropriate', 'privacy', 'broken', 'other')),
  detail           text not null default '' check (char_length(detail) <= 500),
  status           text not null default 'open' check (status in ('open', 'resolved')),
  target_kind      text check (target_kind in ('board', 'game', 'comment')),
  target_title     text,
  target_body      text,
  target_author_id uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  resolved_at      timestamptz
);

-- 재실행 안전: 예전 정의(on delete cascade, not null)로 이미 만들어졌어도 새 정의로 맞춘다.
alter table public.community_reports add column if not exists target_kind text;
alter table public.community_reports add column if not exists target_title text;
alter table public.community_reports add column if not exists target_body text;
alter table public.community_reports add column if not exists target_author_id uuid;
alter table public.community_reports alter column post_id drop not null;
alter table public.community_reports drop constraint if exists community_reports_post_id_fkey;
alter table public.community_reports
  add constraint community_reports_post_id_fkey foreign key (post_id) references public.community_posts (id) on delete set null;
alter table public.community_reports drop constraint if exists community_reports_comment_id_fkey;
alter table public.community_reports
  add constraint community_reports_comment_id_fkey foreign key (comment_id) references public.community_comments (id) on delete set null;
alter table public.community_reports drop constraint if exists community_reports_target_author_id_fkey;
alter table public.community_reports
  add constraint community_reports_target_author_id_fkey foreign key (target_author_id) references public.profiles (id) on delete set null;
alter table public.community_reports drop constraint if exists community_reports_target_kind_check;
alter table public.community_reports
  add constraint community_reports_target_kind_check check (target_kind in ('board', 'game', 'comment'));

-- 같은 사람의 같은 대상 중복 신고 방지. 대상이 지워져 id가 null이 된 신고는 검사 대상에서 빠진다
-- (on delete set null이 unique 충돌로 막히지 않게 글 신고·댓글 신고를 나눈 부분 인덱스로 둔다).
drop index if exists public.community_reports_once_idx;
create unique index if not exists community_reports_once_post_idx
  on public.community_reports (reporter_id, post_id)
  where comment_id is null and target_kind is distinct from 'comment' and post_id is not null;
create unique index if not exists community_reports_once_comment_idx
  on public.community_reports (reporter_id, comment_id)
  where comment_id is not null;
create index if not exists community_reports_status_idx on public.community_reports (status, created_at desc);

create or replace function public.community_reports_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (
    select count(*) from public.community_reports
    where reporter_id = new.reporter_id and created_at > now() - interval '1 hour'
  ) >= 20 then
    raise exception 'too_fast';
  end if;
  -- 대상 존재·가시성 검사는 INSERT 정책(호출자 RLS)이 한다. 여기서는 신고 시점 스냅샷만 남긴다
  -- (INSERT 정책을 통과한 = 신고자가 볼 수 있는 대상이므로 스냅샷으로 새는 정보가 없다).
  -- BEFORE 트리거는 RLS 검사보다 먼저 돌므로, 대상이 없거나 볼 수 없으면 스냅샷이 비고 정책이 거부한다.
  if new.comment_id is not null then
    select 'comment', null, left(c.body, 1000), c.user_id
      into new.target_kind, new.target_title, new.target_body, new.target_author_id
      from public.community_comments c
      where c.id = new.comment_id and c.post_id = new.post_id;
  else
    select p.kind, p.title, left(p.body, 1000), p.author_id
      into new.target_kind, new.target_title, new.target_body, new.target_author_id
      from public.community_posts p
      where p.id = new.post_id;
  end if;
  return new;
end;
$$;
drop trigger if exists community_reports_guard on public.community_reports;
create trigger community_reports_guard
  before insert on public.community_reports
  for each row execute function public.community_reports_guard();

alter table public.community_reports enable row level security;

drop policy if exists "community_reports: 신고자 본인·관리자 조회" on public.community_reports;
create policy "community_reports: 신고자 본인·관리자 조회"
  on public.community_reports for select
  to authenticated
  using (auth.uid() = reporter_id or public.is_admin());

drop policy if exists "community_reports: 로그인 사용자 신고" on public.community_reports;
create policy "community_reports: 로그인 사용자 신고"
  on public.community_reports for insert
  to authenticated
  with check (
    auth.uid() = reporter_id
    and status = 'open'
    and community_reports.post_id is not null
    -- 볼 수 있는 글(community_posts RLS)
    and exists (
      select 1 from public.community_posts p
      where p.id = community_reports.post_id and (not p.hidden or auth.uid() = p.author_id or public.is_admin())
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

drop policy if exists "community_reports: 관리자 삭제" on public.community_reports;
create policy "community_reports: 관리자 삭제"
  on public.community_reports for delete
  to authenticated
  using (public.is_admin());

revoke all on public.community_reports from anon, authenticated;
grant select on public.community_reports to authenticated;
grant insert (post_id, comment_id, reason, detail) on public.community_reports to authenticated;
grant delete on public.community_reports to authenticated;

create or replace function public.set_community_report_status(p_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;
  if p_status not in ('open', 'resolved') then
    raise exception 'bad_status';
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

-- 같은 대상의 열린 신고를 한 번에 처리 완료(관리자가 숨김/삭제할 때).
-- p_include_comments = true면 그 글에 달린 댓글 신고까지 함께 처리한다(글을 삭제할 때).
drop function if exists public.resolve_community_reports_for(uuid, uuid);
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
  n integer;
begin
  if not public.is_admin() then
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

-- ─────────────────────────────────────────────
-- Storage: game-uploads 버킷 (비공개)
--   · 비공개 버킷: 공개 URL(/object/public/...)로는 열리지 않는다. 인증된 download()(anon 키 포함)만 RLS를 거쳐 허용.
--   · 조회(내려받기·목록): 본인 폴더, 관리자, 또는 "연결된 게임 글을 볼 수 있을 때"(숨김이 아니거나 작성자·관리자).
--     → 숨긴 게임의 파일은 비로그인·다른 학생이 내려받거나 목록으로 찾을 수 없다.
--     → 비로그인 읽기는 게시판 읽기 원칙(비로그인도 열람)과 같게, 숨기지 않은 게임 파일만 허용한다.
--   · text/plain만 허용, 파일 크기 2MB, 경로는 {본인 user id}/{uuid}.html 만.
--   · 덮어쓰기(update) 정책 없음: 파일을 바꿀 때는 새 경로에 올리고 옛 파일을 지운다.
--   · 파일 수: 게임 글은 30개(community_posts_guard), Storage 파일은 교체·정리 여유분을 두고 35개까지.
--     연결되지 않은 파일(업로드 뒤 글 저장 실패 등)은 다음 업로드 때 사이트가 자동으로 정리한다.
-- ─────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('game-uploads', 'game-uploads', false, 2097152, array['text/plain', 'text/plain;charset=utf-8', 'text/plain;charset=UTF-8'])
on conflict (id) do update
  set public = false,
      file_size_limit = 2097152,
      allowed_mime_types = array['text/plain', 'text/plain;charset=utf-8', 'text/plain;charset=UTF-8'];

drop policy if exists "game-uploads: 누구나 조회" on storage.objects;
drop policy if exists "game-uploads: 볼 수 있는 게임·본인·관리자 조회" on storage.objects;
create policy "game-uploads: 볼 수 있는 게임·본인·관리자 조회"
  on storage.objects for select
  using (
    bucket_id = 'game-uploads'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
      or exists (
        select 1 from public.community_posts p
        where p.game_path = objects.name
          and (not p.hidden or auth.uid() = p.author_id or public.is_admin())
      )
    )
  );

drop policy if exists "game-uploads: 본인 폴더에만 업로드" on storage.objects;
create policy "game-uploads: 본인 폴더에만 업로드"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'game-uploads'
    and (storage.foldername(name))[1] = auth.uid()::text
    and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.html$'
    -- 파일 개수 제한은 20260922050000_game_upload_policy_fix.sql 의 public.my_game_upload_count()로 센다.
    -- (정책 안에서 storage.objects를 다시 조회하면 42P17 정책 정의 오류가 난다 — 업로드 실패의 원인이었다.)
  );

drop policy if exists "game-uploads: 본인 또는 관리자 삭제" on storage.objects;
create policy "game-uploads: 본인 또는 관리자 삭제"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'game-uploads'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );
