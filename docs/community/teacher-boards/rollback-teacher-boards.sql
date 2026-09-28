-- 비상용 — ⑧(supabase/migrations/20260928010000_teacher_boards.sql) 되돌리기: 자유게시판을 다시 "로그인한 사람 모두의 게시판 하나"로
-- 설계: docs/community/teacher-boards/spec.md · 만든 방법·글자 대조: docs/community/teacher-boards/build-report.md
--
-- ▶ 언제 실행하나
--   ⑧을 실행한 뒤 수업 중에 문제가 생겨(예: 학생이 자유게시판에 글을 못 씀) 원인을 찾는 동안 곧바로 ⑧ 이전 상태로 돌려야 할 때만.
--   먼저 볼 것: 학생이 글을 못 쓰는 문제는 대개 "학급이 없는 학생" 또는 "담임이 없는 학급"이다. 아래가 0이 아니면 되돌리기보다 학급 지정이 먼저다.
--     select count(*) from public.profiles where role = 'user' and class_id is null and withdrawn_at is null;
--   또 ⑧ 뒤에 사이트를 아직 push 하지 않았다면 예전 화면은 게시판 주인을 보내지 않아 새 글이 저장되지 않는다 — 되돌리기보다 push 가 먼저다.
--   ⚠ 예전 마이그레이션 파일을 통째로 다시 돌려서 되돌리지 않는다(학급 권한 등 다른 정책·함수까지 덮는다). 이 파일만 쓴다.
--
-- ▶ 실행 방법
--   Supabase 대시보드 > SQL Editor > New query 에 이 파일 전체를 붙여넣고 Run(한 번에 전체).
--   SQL Editor 는 붙여 넣은 전체를 한 트랜잭션으로 실행하므로, 맨 끝 점검에서 오류가 나면 아무것도 바뀌지 않는다.
--   (psql 등 다른 도구로 실행할 때는 psql -1 -v ON_ERROR_STOP=1 -f <파일> 처럼 "한 트랜잭션 + 오류 시 멈춤"으로.)
--   · "destructive operation(drop)" 확인 창이 뜨면 Run — 정책·함수와 ⑧이 더한 열 3개를 지운다. 글·댓글·좋아요·신고 행은 하나도 지우지 않는다.
--   · 여러 번 실행해도 안전하다(drop … if exists + create policy, create or replace function, revoke/grant).
--     ⑧을 실행하기 전에 잘못 실행해도 바뀌는 것이 없다(⑧ 이전 정의를 그대로 다시 적을 뿐, 없는 열·함수는 if exists 로 건너뜀).
--   · 긴 옛 정책 이름 1개("community_posts: 숨김 아니면 누구나, 작성자·관리자는 숨김도" — 78바이트)는 처음 만들 때처럼 긴 이름 그대로
--     drop 한다 — Postgres 가 63바이트로 똑같이 잘라 맞춘다("will be truncated" NOTICE 는 정상).
--   · 다시 나누려면: 원인을 고친 뒤 ⑧ 파일 전체를 다시 Run — 열이 없으니 "처음 실행"으로 보고 지금 학급·담임 기준으로 글을 다시 옮긴다.
--
-- ▶ 되돌린 뒤 사이트는(= ⑧ 이전과 같다)
--   · 자유게시판은 다시 로그인한 사람 모두가 함께 쓰는 게시판 하나다(학급 구분 없음). 비로그인은 여전히 못 본다(20260926000000 그대로).
--   · 교사(role 'admin') 누구나 모든 게시판 글·댓글·신고를 보고 숨기기·지우기·신고 처리를 한다.
--   · 화면(⑧과 함께 배포한 새 화면)은 저절로 예전처럼 동작한다: my_boards() 가 없으면 게시판을 고르지 않고 게시판 주인을 보내지 않는다.
--   · 학습게임은 ⑧ 전후로 같다.
--
-- ▶ 되돌리는 것 — ⑧이 바꾼 것 전부. 옛 정의는 기존 마이그레이션의 "마지막 정의"를 글자 그대로 옮겼다.
--   정책 12개(⑧의 새 정책을 지우고 옛 이름·옛 조건으로 다시 만든다):
--     community_posts    읽기(게시판은 로그인)                                   (20260926000000)
--                        로그인 사용자 작성 · 본인 또는 관리자 수정 · 본인 또는 관리자 삭제 (20260922040000)
--     community_comments 읽기(게시판은 로그인)                                   (20260926000000)
--                        로그인 사용자 작성 · 본인 또는 관리자 삭제                (20260922040000)
--     community_likes    볼 수 있는 글만 조회                                     (20260926000000)
--                        본인 추가                                                (20260922040000)
--     community_reports  신고자 본인·관리자 조회 · 로그인 사용자 신고 · 관리자 삭제 (20260922040000)
--   함수 5개(본문 + 옛 revoke/grant, 20260922040000): set_community_post_hidden · set_community_comment_hidden ·
--     set_community_report_status · resolve_community_reports_for · community_reports_guard(신고 스냅샷 트리거)
--   열 권한: community_posts 새 글 열 목록에서 board_owner 를 뺀다(20260922040000 목록 그대로).
--   ⑧이 새로 만든 것 지우기: 함수 5개(my_boards · can_manage_board · can_use_board · my_board_owner_ids · class_board_owner),
--     열 3개(community_posts.board_owner · community_reports.target_board_owner · target_post_kind — 딸린 외래키·제약·인덱스도 함께 사라진다).
--     열을 지우는 까닭: 남겨 두면 되돌린 동안 쓴 글은 주인이 비어 있는데, 나중에 ⑧을 다시 Run 할 때 "열이 이미 있음 = 다시 실행"으로 보고
--     글 옮기기를 건너뛰어 그 글들이 총괄·글쓴이에게만 보이게 된다. 열을 지우면 ⑧을 다시 Run 할 때 모든 글을 지금 기준으로 다시 옮긴다.
--     (잃는 것: 게시판 주인 값 — ⑧을 다시 Run 하면 학급·담임 기준으로 다시 계산된다. 담임 해제·계정 삭제로 "얼어붙은" 옛 게시판 글은
--      다시 옮겨질 때 글쓴이의 지금 학급 게시판으로 간다.)
--   되돌리지 않는 것: 학급 표·열·판별 함수(①·④), 학습게임 규칙(⑧도 바꾸지 않았다), 완전 삭제 함수(⑦).
--
-- ▶ 실행 후 확인 쿼리(앞의 "-- "를 지우고 한 덩어리씩 Run — 모두 읽기만 한다)
--   -- 1) 옛 이름 정책 12개 + 그대로인 2개(본인 수정 · 본인 취소) = 14행, "담임별"·"참여자만"·"게시판 관리자" 이름은 없어야 한다
--   select tablename, policyname, cmd from pg_policies
--   where schemaname = 'public' and tablename like 'community\_%' order by 1, 3, 2;
--   -- 2) ⑧의 함수·열이 없는지(모두 0 / false)
--   select (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--           where n.nspname = 'public' and p.proname in ('my_boards', 'can_manage_board', 'can_use_board', 'my_board_owner_ids', 'class_board_owner')) as 새_함수,
--          (select count(*) from information_schema.columns where table_schema = 'public'
--           and ((table_name = 'community_posts' and column_name = 'board_owner')
--             or (table_name = 'community_reports' and column_name in ('target_board_owner', 'target_post_kind')))) as 새_열;
--   -- 3) 비로그인 흉내 — 게시판 글 0(20260926000000 그대로)
--   set local role anon;
--   select current_user as 지금_역할, count(*) filter (where kind = 'board') as 게시판_글 from public.community_posts;

-- ═════════════════════════════════════════════
-- 1. 정책 — ⑧의 새 이름을 지우고 옛 정의로 다시 만든다(옛 이름도 먼저 지워 재실행 안전)
-- ═════════════════════════════════════════════

-- 1-1. community_posts 읽기 — 20260926000000_board_login_only.sql 52~62행
drop policy if exists "community_posts: 읽기(게시판은 담임별)" on public.community_posts;
drop policy if exists "community_posts: 숨김 아니면 누구나, 작성자·관리자는 숨김도" on public.community_posts;
drop policy if exists "community_posts: 읽기(게시판은 로그인)" on public.community_posts;
create policy "community_posts: 읽기(게시판은 로그인)"
  on public.community_posts for select
  using (
    (
      (not hidden)
      and (select public.can_browse())
      and (kind <> 'board' or (select auth.uid()) is not null) -- 자유게시판은 늘 로그인해야 읽는다
    )
    or auth.uid() = author_id
    or public.is_admin()
  );

-- 1-2. community_posts 쓰기 · 고치기 · 지우기 — 20260922040000_community.sql 125~142행
drop policy if exists "community_posts: 쓰기(게시판은 참여자만)" on public.community_posts;
drop policy if exists "community_posts: 로그인 사용자 작성" on public.community_posts;
create policy "community_posts: 로그인 사용자 작성"
  on public.community_posts for insert
  to authenticated
  with check (auth.uid() = author_id and hidden = false);

drop policy if exists "community_posts: 본인·게시판 관리자 수정" on public.community_posts;
drop policy if exists "community_posts: 본인 또는 관리자 수정" on public.community_posts;
create policy "community_posts: 본인 또는 관리자 수정"
  on public.community_posts for update
  to authenticated
  using (auth.uid() = author_id or public.is_admin())
  with check (auth.uid() = author_id or public.is_admin());

drop policy if exists "community_posts: 본인·게시판 관리자 삭제" on public.community_posts;
drop policy if exists "community_posts: 본인 또는 관리자 삭제" on public.community_posts;
create policy "community_posts: 본인 또는 관리자 삭제"
  on public.community_posts for delete
  to authenticated
  using (auth.uid() = author_id or public.is_admin());

-- 1-3. community_comments 읽기 — 20260926000000_board_login_only.sql 67~80행
drop policy if exists "community_comments: 읽기(게시판은 담임별)" on public.community_comments;
drop policy if exists "community_comments: 숨김 아니면 누구나" on public.community_comments;
drop policy if exists "community_comments: 읽기(게시판은 로그인)" on public.community_comments;
create policy "community_comments: 읽기(게시판은 로그인)"
  on public.community_comments for select
  using (
    (select public.can_browse())
    and (not hidden or auth.uid() = user_id or public.is_admin())
    and exists (
      select 1 from public.community_posts p
      where p.id = post_id
        and (not p.hidden or public.is_admin() or auth.uid() = p.author_id)
        and (p.kind <> 'board' or (select auth.uid()) is not null) -- 자유게시판 댓글은 로그인해야 읽는다
    )
  );

-- 1-4. community_comments 쓰기 · 지우기 — 20260922040000_community.sql 224~245행("본인 수정"은 ⑧도 그대로 두었다)
drop policy if exists "community_comments: 쓰기(게시판은 참여자만)" on public.community_comments;
drop policy if exists "community_comments: 로그인 사용자 작성" on public.community_comments;
create policy "community_comments: 로그인 사용자 작성"
  on public.community_comments for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and hidden = false
    and exists (select 1 from public.community_posts p where p.id = post_id and not p.hidden)
  );

drop policy if exists "community_comments: 본인·게시판 관리자 삭제" on public.community_comments;
drop policy if exists "community_comments: 본인 또는 관리자 삭제" on public.community_comments;
create policy "community_comments: 본인 또는 관리자 삭제"
  on public.community_comments for delete
  to authenticated
  using (auth.uid() = user_id or public.is_admin());

-- 1-5. community_likes 읽기 — 20260926000000_board_login_only.sql 85~96행
drop policy if exists "community_likes: 읽기(게시판은 담임별)" on public.community_likes;
drop policy if exists "community_likes: 볼 수 있는 글만 조회" on public.community_likes;
create policy "community_likes: 볼 수 있는 글만 조회"
  on public.community_likes for select
  using (
    (select public.can_browse())
    and exists (
      select 1 from public.community_posts p
      where p.id = community_likes.post_id
        and (not p.hidden or auth.uid() = p.author_id or public.is_admin())
        and (p.kind <> 'board' or (select auth.uid()) is not null) -- 자유게시판 좋아요는 로그인해야 읽는다
    )
  );

-- 1-6. community_likes 누르기 — 20260922040000_community.sql 295~302행("본인 취소"는 ⑧도 그대로 두었다)
drop policy if exists "community_likes: 본인 추가(게시판은 참여자만)" on public.community_likes;
drop policy if exists "community_likes: 본인 추가" on public.community_likes;
create policy "community_likes: 본인 추가"
  on public.community_likes for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.community_posts p where p.id = post_id and not p.hidden)
  );

-- 1-7. community_reports 읽기 · 신고 · 지우기 — 20260922040000_community.sql 405~447행
drop policy if exists "community_reports: 신고자·게시판 관리자 조회" on public.community_reports;
drop policy if exists "community_reports: 신고자 본인·관리자 조회" on public.community_reports;
create policy "community_reports: 신고자 본인·관리자 조회"
  on public.community_reports for select
  to authenticated
  using (auth.uid() = reporter_id or public.is_admin());

drop policy if exists "community_reports: 신고(볼 수 있는 글·댓글만)" on public.community_reports;
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

drop policy if exists "community_reports: 게시판 관리자 삭제" on public.community_reports;
drop policy if exists "community_reports: 관리자 삭제" on public.community_reports;
create policy "community_reports: 관리자 삭제"
  on public.community_reports for delete
  to authenticated
  using (public.is_admin());

-- ═════════════════════════════════════════════
-- 2. 함수 5개 — 20260922040000_community.sql 의 정의 그대로(본문 + revoke/grant)
-- ═════════════════════════════════════════════

-- 2-1. 151~168행
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

-- 2-2. 253~270행
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

-- 2-3. 368~401행(신고 스냅샷 트리거 — 게시판 주인 · 글 종류 스냅샷 없음)
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

-- 2-4. 454~477행
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

-- 2-5. 482~508행
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

-- ═════════════════════════════════════════════
-- 3. 열 권한 — 20260922040000_community.sql 147~148행 목록 그대로(새 글 열에서 board_owner 를 뺀다)
--    board_owner 열이 아직 있으면 그 열의 권한도 함께 거둬진다(표 단위 revoke). 열은 4절에서 지운다.
-- ═════════════════════════════════════════════
revoke insert on public.community_posts from anon, authenticated;
grant insert (kind, title, body, game_path, game_size) on public.community_posts to authenticated;
revoke update on public.community_posts from anon, authenticated;
grant update (title, body, game_path, game_size) on public.community_posts to authenticated;

-- ═════════════════════════════════════════════
-- 4. ⑧이 새로 만든 함수 5개 · 열 3개 지우기(정책·함수가 더는 쓰지 않는다 — 1·2절에서 바꿨다)
--    부르는 쪽부터 지운다(my_boards → can_manage_board → can_use_board → my_board_owner_ids → class_board_owner).
--    열을 지우면 딸린 외래키 · 제약(community_posts_board_owner_chk · community_reports_target_post_kind_check) · 인덱스도 함께 사라진다.
-- ═════════════════════════════════════════════
drop function if exists public.my_boards();
drop function if exists public.can_manage_board(uuid);
drop function if exists public.can_use_board(uuid);
drop function if exists public.my_board_owner_ids();
drop function if exists public.class_board_owner(uuid);

alter table public.community_posts drop column if exists board_owner;
alter table public.community_reports drop column if exists target_board_owner;
alter table public.community_reports drop column if exists target_post_kind;

-- ═════════════════════════════════════════════
-- 5. 맨 끝 점검 — ⑧ 이전 모습이 아니면 전부 되돌린다(아무것도 바뀌지 않음)
-- ═════════════════════════════════════════════
do $$
declare
  v_missing text;
  v_extra   text;
  v_fn      text;
begin
  select string_agg(format('%s / %s (%s)', e.t, e.p, e.c), ', ') into v_missing
  from (values
    ('community_posts', 'community_posts: 읽기(게시판은 로그인)', 'SELECT'),
    ('community_posts', 'community_posts: 로그인 사용자 작성', 'INSERT'),
    ('community_posts', 'community_posts: 본인 또는 관리자 수정', 'UPDATE'),
    ('community_posts', 'community_posts: 본인 또는 관리자 삭제', 'DELETE'),
    ('community_comments', 'community_comments: 읽기(게시판은 로그인)', 'SELECT'),
    ('community_comments', 'community_comments: 로그인 사용자 작성', 'INSERT'),
    ('community_comments', 'community_comments: 본인 또는 관리자 삭제', 'DELETE'),
    ('community_likes', 'community_likes: 볼 수 있는 글만 조회', 'SELECT'),
    ('community_likes', 'community_likes: 본인 추가', 'INSERT'),
    ('community_reports', 'community_reports: 신고자 본인·관리자 조회', 'SELECT'),
    ('community_reports', 'community_reports: 로그인 사용자 신고', 'INSERT'),
    ('community_reports', 'community_reports: 관리자 삭제', 'DELETE')
  ) as e(t, p, c)
  where not exists (
    select 1 from pg_policies pp
    where pp.schemaname = 'public' and pp.tablename = e.t and pp.policyname = e.p and pp.cmd = e.c
  );
  if v_missing is not null then
    raise exception '되돌린 정책이 없습니다: %. 아무것도 바뀌지 않았습니다 — 이 메시지를 알려 주세요.', v_missing;
  end if;

  select string_agg(format('%s / %s', pp.tablename, pp.policyname), ', ') into v_extra
  from pg_policies pp
  where pp.schemaname = 'public'
    and pp.tablename in ('community_posts', 'community_comments', 'community_likes', 'community_reports')
    and (position('can_use_board(' in coalesce(pp.qual, '') || coalesce(pp.with_check, '')) > 0
         or position('can_manage_board(' in coalesce(pp.qual, '') || coalesce(pp.with_check, '')) > 0);
  if v_extra is not null then
    raise exception '⑧의 정책이 남아 있습니다: %. 아무것도 바뀌지 않았습니다 — 이 메시지를 알려 주세요.', v_extra;
  end if;

  select string_agg(p.oid::regprocedure::text, ', ') into v_fn
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and (
      p.proname in ('my_boards', 'can_manage_board', 'can_use_board', 'my_board_owner_ids', 'class_board_owner')
      or (p.proname in ('set_community_post_hidden', 'set_community_comment_hidden', 'set_community_report_status',
                        'resolve_community_reports_for', 'community_reports_guard')
          and (position('board_owner' in p.prosrc) > 0 or position('target_post_kind' in p.prosrc) > 0))
    );
  if v_fn is not null then
    raise exception '⑧의 함수가 남아 있습니다: %. 아무것도 바뀌지 않았습니다 — 이 메시지를 알려 주세요.', v_fn;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and ((table_name = 'community_posts' and column_name = 'board_owner')
        or (table_name = 'community_reports' and column_name in ('target_board_owner', 'target_post_kind')))
  ) then
    raise exception '⑧의 열이 남아 있습니다. 아무것도 바뀌지 않았습니다 — 이 메시지를 알려 주세요.';
  end if;

  raise notice '✔ 자유게시판을 ⑧ 이전(로그인한 사람 모두의 게시판 하나, 교사 누구나 관리)으로 되돌렸습니다. 다시 나누려면 원인을 고친 뒤 20260928010000_teacher_boards.sql 전체를 다시 Run 하세요.';
end $$;

notify pgrst, 'reload schema';
