-- 자유게시판은 로그인해야만 볼 수 있게 (2026-09-26 사용자 결정)
-- 사용자: "자유게시판은 로그인 하지 않으면 완전히 안 보여야해. 메뉴 선택해도 글이 보이지 않도록 수정해줘"
-- 지금까지 자유게시판(community_posts.kind = 'board')은 "로그인해야만 이용" 스위치(can_browse())를 따라,
-- 스위치가 꺼져 있으면 로그인하지 않은 방문자도 글·댓글·좋아요를 읽을 수 있었다.
-- 이제 자유게시판은 스위치와 상관없이 **로그인한 사람만** 읽는다. 학습게임(kind = 'game')은 지금처럼 스위치를 따른다.
-- (화면도 함께 막는다: src/components/login-gate.tsx 의 ALWAYS_LOGIN_PREFIXES, 홈 미리보기·글 수 칸 loginOnly)
--
-- ▶ 실행 방법
--   Supabase 대시보드 > SQL Editor > New query 에 이 파일 전체를 붙여넣고 Run.
--   여러 번 실행해도 안전하다(drop policy if exists + create policy 만 쓴다).
--   20260923010000_login_required.sql(can_browse() 함수)이 먼저 실행돼 있어야 한다(이미 실행됨).
--   실행해도 login_required 값은 건드리지 않는다.
--
-- ▶ 무엇이 바뀌나(SELECT 정책 3개 — 쓰기·관리자 정책은 그대로)
--   · community_posts   : 공개 조건에 "자유게시판이면 로그인해야 함"을 더한다. 작성자 본인·관리자 조건은 그대로.
--                         이름을 뜻에 맞게 바꾼다 → "community_posts: 읽기(게시판은 로그인)".
--   · community_comments: 부모 글이 자유게시판이면 로그인해야 댓글을 읽는다 → "community_comments: 읽기(게시판은 로그인)".
--   · community_likes   : 부모 글이 자유게시판이면 로그인해야 좋아요를 읽는다(이름 그대로).
--   댓글·좋아요 정책은 부모 글을 community_posts 에서 찾고 그 조회에도 글 정책이 걸리므로 글 정책만 바꿔도 막히지만,
--   뜻을 분명히 하려고 조건을 직접 적는다.
--   정책 이름은 63바이트 안(한글 1자 = 3바이트 — 더 길면 Postgres가 잘라 저장한다. 예전 글 정책 이름도 잘려 있다).
--   재귀(42P17) 없음: 글 정책은 다른 표를 보지 않고, 댓글·좋아요 정책은 글 표만 본다(원래 구조와 같음).
--
-- ▶ 건드리지 않는 것
--   · 학습게임 글·댓글·좋아요·게임 파일(storage game-uploads) — 지금처럼 스위치(can_browse())대로.
--   · 쓰기(글·댓글·좋아요·신고)는 원래 로그인해야만 된다. 관리자 숨기기·신고 처리 함수, site_settings,
--     can_browse()/login_required()는 그대로. 관리자는 늘 로그인 상태라 막히지 않는다.
--
-- ▶ 실행 후 확인 쿼리(앞의 "-- "를 지우고 따로 실행)
--   -- 1) 새 조건이 들어간 SELECT 정책이 3개여야 한다(community_comments · community_likes · community_posts)
--   select tablename, policyname from pg_policies
--   where schemaname = 'public'
--     and tablename in ('community_posts', 'community_comments', 'community_likes')
--     and cmd = 'SELECT' and qual like '%board%'
--   order by tablename;
--   -- 2) 세 표 모두 읽기(SELECT) 정책이 하나씩만 있어야 한다(예전 이름이 남으면 2가 된다)
--   select tablename, count(*) from pg_policies
--   where schemaname = 'public'
--     and tablename in ('community_posts', 'community_comments', 'community_likes') and cmd = 'SELECT'
--   group by tablename order by tablename;
--   -- 3) 로그인하지 않은 방문자(anon)로 흉내 — 'board' 줄이 없어야 한다('game' 줄은 스위치가 꺼져 있으면 보임)
--   begin;
--   set local role anon;
--   select kind, count(*) from public.community_posts group by kind;
--   rollback;

-- ═════════════════════════════════════════════
-- 1. community_posts (자유게시판 + 학습게임)
-- ═════════════════════════════════════════════
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

-- ═════════════════════════════════════════════
-- 2. community_comments
-- ═════════════════════════════════════════════
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

-- ═════════════════════════════════════════════
-- 3. community_likes
-- ═════════════════════════════════════════════
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
