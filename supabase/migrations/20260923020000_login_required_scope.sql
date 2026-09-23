-- "로그인해야만 이용" 잠금 범위 좁히기 (2026-09-23 사용자 결정)
-- 앞 파일 20260923010000_login_required.sql 은 잠금을 켜면 사이트 전체가 가려졌다.
-- 사용자가 원한 범위는 "블로그 글 · 자유게시판 · 학습게임 · 과학 앱"만 막고,
-- 홈·메뉴·이름 표시는 잠금과 상관없이 그대로 보이는 것이다.
--
-- ▶ 실행 방법
--   Supabase 대시보드 > SQL Editor > New query 에 이 파일 전체를 붙여넣고 Run.
--   여러 번 실행해도 안전하다(drop policy if exists + create policy 만 쓴다).
--   20260923010000_login_required.sql 이 먼저 실행돼 있어야 한다(can_browse() 함수가 필요).
--   실행해도 login_required 값은 건드리지 않는다(켜져 있으면 켜진 채, 꺼져 있으면 꺼진 채).
--
-- ▶ 무엇이 바뀌나
--   게이트 유지(계속 잠긴다): posts, comments, community_posts, community_comments,
--                             community_likes, storage.objects(game-uploads)
--   게이트 제거(원래대로 되돌림): profiles, likes, views, assignments
--     · profiles — 작성자 이름·내 프로필을 못 읽으면 메뉴·머리말이 깨진다. 이름은 원래도 공개였다.
--     · likes·views — 글이 이미 막히므로 숫자만 따로 막을 이유가 없다(홈 통계가 오류로 보이지 않게).
--     · assignments — 과제 목록은 잠금 대상이 아니다.
--   되돌리는 4개 정책은 20260921000000_init_blog.sql(profiles·likes·views)과
--   20260921020000_admin_learning.sql(assignments)의 원문과 글자 그대로 같다.
--
-- ▶ 건드리지 않는 것
--   · site_settings 의 SELECT 정책 — 언제나 using (true). 잠금 상태를 못 읽으면 끄러 들어갈 수도 없다.
--   · can_browse() / login_required() / admin_set_login_required() — 그대로 둔다.
--   · increment_post_view() — 20260923010000 에서 넣은 can_browse() 검사를 그대로 둔다.
--     (잠금 중 비로그인은 글 자체를 못 읽으므로 조회수를 올릴 일도 없다. views 조회는 다시 공개다.)
--   · 관리자는 항상 로그인 상태라 어떤 게이트도 관리자를 막지 않는다(자물쇠 없음).
--
-- ▶ 실행 후 확인 쿼리
--   -- 1) 게이트가 남은 정책은 6개여야 한다
--   --    public: posts / comments / community_posts / community_comments / community_likes
--   --    storage: game-uploads
--   select schemaname, tablename, policyname from pg_policies
--   where qual like '%can_browse%' order by 1, 2;
--   -- 2) 되돌린 4개는 게이트가 없어야 한다(profiles·likes·views 는 qual = true, assignments 는 published or is_admin())
--   select tablename, policyname, qual from pg_policies
--   where schemaname = 'public'
--     and policyname in ('profiles: 누구나 조회', 'likes: 누구나 조회', 'views: 누구나 조회',
--                        'assignments: 공개된 것은 누구나, 관리자는 전체 조회')
--   order by tablename;
--   -- 3) 설정 값은 그대로인지(이 파일은 값을 바꾸지 않는다)
--   select * from public.site_settings;
--   -- 4) 화면 확인: 잠금을 켠 뒤 시크릿 창으로 홈을 열면 메뉴·과학 차시 목록은 보이고
--   --    글·게시판·게임 자리에는 "로그인하면 볼 수 있어요" 안내가 나와야 한다.

-- ═════════════════════════════════════════════
-- 1. profiles — 원래대로 누구나 조회 (20260921000000_init_blog.sql 원문)
-- ═════════════════════════════════════════════
drop policy if exists "profiles: 누구나 조회" on public.profiles;
create policy "profiles: 누구나 조회"
  on public.profiles for select
  using (true);

-- ═════════════════════════════════════════════
-- 2. likes — 원래대로 누구나 조회 (20260921000000_init_blog.sql 원문)
-- ═════════════════════════════════════════════
drop policy if exists "likes: 누구나 조회" on public.likes;
create policy "likes: 누구나 조회"
  on public.likes for select
  using (true);

-- ═════════════════════════════════════════════
-- 3. views — 원래대로 누구나 조회 (20260921000000_init_blog.sql 원문)
-- ═════════════════════════════════════════════
drop policy if exists "views: 누구나 조회" on public.views;
create policy "views: 누구나 조회"
  on public.views for select
  using (true);

-- ═════════════════════════════════════════════
-- 4. assignments — 원래대로 (20260921020000_admin_learning.sql 원문)
-- ═════════════════════════════════════════════
drop policy if exists "assignments: 공개된 것은 누구나, 관리자는 전체 조회" on public.assignments;
create policy "assignments: 공개된 것은 누구나, 관리자는 전체 조회"
  on public.assignments for select
  using (published or public.is_admin());
