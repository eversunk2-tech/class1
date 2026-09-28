-- 자유게시판을 담임교사별로 나누기 ⑧ — community_posts.board_owner(게시판 주인) + 판별 함수 + 커뮤니티 정책·관리 함수 좁히기
-- 설계: docs/community/teacher-boards/spec.md — 끝의 "개정 2"가 가장 우선, 그다음 "개정 1 — 사용자 결정 변경", "Claude 검토 메모"(R1~R4), 본문.
-- 지침: docs/community/teacher-boards/build-instructions.md · 보고: docs/community/teacher-boards/build-report.md
-- 비상 되돌리기: docs/community/teacher-boards/rollback-teacher-boards.sql
--
-- ▶ 왜(2026-09-28 사용자): 지금 자유게시판은 로그인한 사람이면 누구나 하나의 게시판을 함께 쓴다(20260926000000 은 "로그인 여부"만 막았다).
--   "학생은 해당 담임교사의 자유게시판만" 쓰게 한다. 학습게임(kind = 'game')은 지금처럼 모두 함께(바꾸지 않는다).
--
-- ▶ 게시판 = 담임 한 명마다 하나(게시판 주인 = community_posts.board_owner = 그 담임의 profiles.id)
--   · 학급의 게시판 주인 = 그 학급의 "먼저 맡은 담임"(class_teachers.created_at 이 가장 이른 지금 교사, 같으면 teacher_id 순).
--   · 학생(role 'user', 탈퇴 전, 학급 있음): 자기 학급의 먼저 맡은 담임 게시판 **하나만**(고르기 없음). 학급 없는 계정은 게시판 없음.
--   · 교사(role 'admin'): 자기가 담임(보조 담임 포함)인 학급들의 게시판(그 학급의 먼저 맡은 담임 것) — 보고·쓰고·관리.
--     교사의 "자기 게시판"은 자기가 먼저 맡은(개설한) 학급이 있을 때만 생긴다(2026-09-28 사용자 결정 — spec 개정 2):
--     보조로만 맡은 교사는 그 학급의 게시판만, 학급이 없는 교사는 게시판 없음(학급을 개설하면 생김).
--   · 총괄: 위(교사와 같게) + **관리용으로 모든 게시판**을 보고 숨기기·지우기·신고 처리(다른 담임 게시판에 글·댓글·좋아요는 못 씀).
--   · 비로그인: 게시판 없음(20260926000000 그대로).
--   · 내가 쓴 글은 어느 게시판이든 늘 보이고 고치고 지울 수 있다(반을 옮겨도 — 예전 게시판의 다른 글은 안 보임).
--   · 게시판 주인이 담임 해제되거나(role 'user') 계정이 지워지면(on delete set null) 그 게시판은 "얼어붙는다":
--     총괄(관리용)과 글쓴이만 보고, 아무도 새로 쓰지 못한다. 학급의 먼저 맡은 담임이 해제되면 다음 담임이 그 학급의 게시판 주인이 된다
--     (학생의 게시판이 바뀐다 — 예전 글은 예전 게시판에 남는다. 드문 경우라 옮기지 않는다, spec 개정 1).
--
-- ▶ 이 파일이 하는 일
--   1. community_posts.board_owner uuid → profiles(id) on delete set null(R1 — 옛 교사 계정의 완전 삭제가 막히지 않게),
--      제약 "게시판 글이 아니면 주인 없음"(check (kind = 'board' or board_owner is null)), 인덱스(board_owner, created_at desc).
--      열 권한: board_owner 는 새 글을 쓸 때만 보낸다(insert 열 권한) — 고치기(update) 열 권한에는 넣지 않는다(주인은 바뀌지 않음).
--      게시판 글에 주인이 꼭 있어야 하는 것은 쓰기 정책이 지킨다(can_use_board(board_owner) — 빈 값이면 거부).
--   2. 판별 함수 5개(모두 security definer · set search_path = ''):
--        class_board_owner(학급)   — 그 학급의 게시판 주인(먼저 맡은 지금 교사). 내부용(학생·비로그인 실행 불가).
--        my_board_owner_ids()      — 내가 참여자로 쓸 수 있는 게시판 주인 목록(학생 = 하나, 교사 = 담임(보조 포함)인 학급들의 게시판 주인들).
--        can_use_board(주인)       — 그 게시판에 참여(읽기·쓰기·댓글·좋아요)할 수 있나. 빈 값이면 false.
--                                   ⚠ "주인 = 나"만으로 통과시키지 않는다 — 목록에는 학급의 먼저 맡은 담임(지금 교사)만 들어간다
--                                   (학생 id 는 들어갈 수 없다 — spec §3.2 자기 참조 구멍): 학생이 board_owner 에 자기 id 를 넣어 쓰면 거부된다.
--        can_manage_board(주인)    — 그 게시판을 관리(숨긴 글 보기·숨기기·지우기·신고 처리)할 수 있나 = 총괄이거나,
--                                   지금 교사(is_admin())이고 그 게시판에 참여할 수 있음(R2 — 담임 해제되면 관리 권한도 끝).
--        my_boards()               — 화면용 RPC(로그인한 사용자만): [{owner_id, teacher_name, mine}] (내 게시판 먼저).
--   3. 기존 게시판 글 옮기기(이 파일을 처음 실행할 때 한 번만 — 열이 새로 생길 때. 다시 실행하면 건너뛴다):
--        ① 교사가 쓴 글 → 그 교사가 맡은 학급의 게시판(먼저 맡은 학급이 있으면 자기 게시판, 보조로만 맡았으면 그 학급 게시판)
--        ② 학생이 쓴 글 → 그 학생 학급의 먼저 맡은 담임 게시판
--        ③ 나머지(글쓴이 없음 · 학급 없는 계정(교사 포함) · 담임 없는 학급) → 총괄 게시판   ④ 못 채운 글이 있으면 멈춤(전부 되돌림)
--        옮길 때 글의 "고친 시각"(updated_at)은 바꾸지 않는다(그대로 두지 않으면 모든 글에 "(수정됨)"이 붙는다).
--   4. 신고 스냅샷 2개: community_reports.target_board_owner(→ profiles, on delete set null) · target_post_kind('board'|'game')
--        = 신고한 글(댓글 신고면 그 댓글의 글)의 게시판 주인·종류. target_kind(글·게임·댓글)의 뜻은 그대로(R4).
--        신고 스냅샷 트리거가 새 신고마다 채우고, 지금 신고는 대상 글이 남아 있으면 그 글에서, 글이 지워진 글·게임 신고는
--        target_kind 로 종류만 채운다. 대상 글이 이미 지워진 댓글 신고는 게시판인지 몰라 **총괄만** 본다(R4 · spec §8-5).
--   5. 정책 12개를 바꾼다(학습게임 쪽 조건은 글자 그대로 — 게시판 쪽만 좁힘. is_admin()으로 게시판을 보거나 고치거나 지우던 곳 전부, R3):
--        community_posts    읽기 · 쓰기 · 고치기 · 지우기
--        community_comments 읽기 · 쓰기(게시판은 참여자만) · 지우기          ("본인 수정"은 그대로)
--        community_likes    읽기 · 누르기(게시판은 참여자만)                  ("본인 취소"는 그대로)
--        community_reports  읽기(게시판 신고 = 그 게시판 관리자·총괄) · 신고 · 지우기
--      관리 함수 4개(숨기기 2 · 신고 처리 2): 게시판 것은 can_manage_board(주인)일 때만. 학습게임 것은 그대로 교사 누구나.
--   6. 맨 끝 점검: 열·외래키(set null)·제약·정책(이름·명령·대상 역할·조건)·열 권한·함수 권한·관리 함수 본문,
--      그리고 완전 삭제(20260928000000 admin_purge_oauth_member)를 막는 외래키가 없는지 — 다르면 전부 되돌린다.
--   · 재귀(42P17) 없음: community_posts 정책은 자기 표를 다시 읽지 않는다(판별 함수는 profiles · class_teachers 만 읽음).
--     댓글·좋아요·신고 정책은 community_posts 를 하위 쿼리로 읽고(다른 표 — 원래 구조와 같다), community_posts 정책은 그 표들을 읽지 않는다.
--   · 배열 비교는 `x = any (public.f())`로 쓴다(괄호를 겹치면 42883 — CLAUDE.md).
--   · 건드리지 않는 것: 학습게임 규칙 전부, 게임 파일(storage game-uploads) 정책, community_posts_guard(작성 속도·게임 개수) 트리거,
--     "본인 수정"(댓글)·"본인 취소"(좋아요) 정책, 완전 삭제 함수 admin_purge_oauth_member, Edge Function(다시 배포할 것 없음).
--
-- ▶ 실행 순서
--   이미 적용된 것: ① classes_schema · ② setup-owl-class · ③ classes_rls · ④ class_notices · ⑤ content_owner_only · ⑥ class_assignments
--                   · ⑦ 20260928000000_oauth_purge.sql
--   → 아래 "실행 전 확인"(읽기만) → 이 파일 → "실행 후 확인" → 사이트 push(화면이 board_owner 를 보낸다 — SQL 이 먼저).
--   · 이 파일을 실행한 뒤 사이트를 push 하기 전까지는 예전 화면에서 자유게시판 "새 글"이 저장되지 않는다(게시판 주인을 보내지 않아
--     쓰기 정책이 거부 — "권한이 없어요"). 읽기·댓글·좋아요는 된다. 확인 쿼리 뒤 바로 push 한다.
--     (새 화면은 이 파일 전에도 깨지지 않는다 — my_boards() 가 없으면 예전처럼 동작한다.)
--   ⚠ 이 파일을 적용한 뒤 앞선 마이그레이션(특히 20260922040000_community.sql · 20260923010000_login_required.sql ·
--     20260926000000_board_login_only.sql)을 다시 실행하지 않는다 — 옛 정책·함수(교사 누구나 모든 게시판)가 되살아나
--     허용 정책끼리 OR 로 합쳐져 소리 없이 넓어진다. 되돌리기는 rollback-teacher-boards.sql 로만.
--
-- ▶ 실행 방법
--   Supabase 대시보드 > SQL Editor > New query 에 이 파일 전체를 붙여넣고 Run.
--   SQL Editor 는 붙여 넣은 전체를 한 트랜잭션으로 실행하므로 중간에 오류가 나면 아무것도 바뀌지 않는다.
--   (psql 등 다른 도구로 실행할 때는 psql -1 -v ON_ERROR_STOP=1 -f <파일> 처럼 "한 트랜잭션 + 오류 시 멈춤"으로.)
--   · "destructive operation(drop)" 확인 창이 뜨면 Run — 정책만 지우고 곧바로 다시 만든다. 표·데이터는 지우지 않는다.
--   · 맨 앞 점검: 앞선 표·함수(학급 ① · my_student_class_id ④ · 커뮤니티)가 없거나 총괄이 없으면 오류를 내고 아무것도 바꾸지 않는다.
--   · 맨 끝 점검: 설계와 다르면 오류를 내고 전부 되돌린다. 성공하면 "✔ 자유게시판을 담임교사별로 나눴습니다 …" 알림이 나온다.
--   · 여러 번 실행해도 안전하다(열이 이미 있으면 글 옮기기는 건너뜀 · 신고 스냅샷은 빈 것만 채움 · drop policy if exists + create policy ·
--     create or replace function). 다시 실행해도 게시판 주인은 바뀌지 않는다(주인이 지워진 글도 다시 채우지 않는다 — "얼어붙음" 유지).
--
-- ▶ 실행 전 확인(그냥 Run = postgres 권한, 읽기만 — 결과를 보고 옮겨질 곳을 미리 확인한다)
--   -- A) 지금 자유게시판 글이 옮겨 갈 게시판(주인 = 학급의 먼저 맡은 담임)과 글 수. "(총괄 게시판으로)"는 ③ 규칙.
--   with first_teacher as (   -- 학급마다 먼저 맡은 지금 교사 = 그 학급의 게시판 주인
--     select distinct on (ct.class_id) ct.class_id, ct.teacher_id as owner_id
--     from public.class_teachers ct join public.profiles t on t.id = ct.teacher_id
--     where t.role = 'admin'
--     order by ct.class_id, ct.created_at, ct.teacher_id
--   ), dest as (
--     select case
--              when a.role = 'admin' then (   -- ① 맡은 학급의 게시판(자기가 먼저 맡은 학급이 있으면 자기 게시판)
--                select f.owner_id from public.class_teachers mine join first_teacher f on f.class_id = mine.class_id
--                where mine.teacher_id = a.id
--                order by (f.owner_id = a.id) desc, mine.created_at, mine.class_id limit 1)
--              when a.role = 'user' and a.class_id is not null then (   -- ② 학급의 게시판
--                select f.owner_id from first_teacher f where f.class_id = a.class_id)
--            end as owner_id
--     from public.community_posts p left join public.profiles a on a.id = p.author_id
--     where p.kind = 'board'
--   )
--   select coalesce(o.display_name, '(총괄 게시판으로)') as 옮겨_갈_게시판, count(*) as 글
--   from dest d left join public.profiles o on o.id = d.owner_id
--   group by 1 order by 2 desc;
--   -- B) 담임이 둘 이상인 학급(있으면 그 학급 학생은 먼저 맡은 담임의 게시판 하나만 쓴다 — 보조 담임은 그 게시판도 함께 본다)
--   select c.name as 학급, count(*) as 담임_수
--   from public.class_teachers ct join public.classes c on c.id = ct.class_id
--   group by c.id, c.name having count(*) > 1;
--   -- C) 신고 수 — "대상_지워진_댓글_신고"는 게시판인지 알 수 없어 실행 뒤 총괄만 본다
--   select count(*) as 전체_신고,
--          count(*) filter (where post_id is null and (target_kind = 'comment' or comment_id is not null)) as 대상_지워진_댓글_신고
--   from public.community_reports;
--   -- D) 학급이 없어 게시판이 없게 될 계정(탈퇴 전, 검토 L3) — 학생: 학급을 지정할 때까지 "아직 배정된 담임 선생님이 없어요",
--   --    교사: 학급을 개설하면 게시판이 생김(spec 개정 2). 0이 아니면 학급 지정·개설을 먼저 하거나 알고 진행한다.
--   select count(*) filter (where p.role = 'user' and p.class_id is null) as 학급_없는_학생,
--          count(*) filter (where p.role = 'admin'
--                             and not exists (select 1 from public.class_teachers ct where ct.teacher_id = p.id)) as 학급_없는_교사
--   from public.profiles p
--   where p.withdrawn_at is null;
--
-- ▶ 실행 후 확인 쿼리(앞의 "-- "를 지우고 한 덩어리씩 Run)
--   -- 0) (그냥 Run) 흉내 낼 id 와 게시판 주인별 글 수 — "(주인 없음)" 줄이 없어야 한다(처음 실행 직후)
--   select p.id, p.display_name, p.role, p.is_super_admin, c.name as 학급
--   from public.profiles p left join public.classes c on c.id = p.class_id
--   order by p.role, c.name nulls first, p.display_name limit 200;
--   select coalesce(o.display_name, '(주인 없음)') as 게시판_주인, o.id as 주인_id, count(*) as 글
--   from public.community_posts p left join public.profiles o on o.id = p.board_owner
--   where p.kind = 'board' group by 1, 2 order by 3 desc;
--
--   -- 1) 정책 — 표마다: posts 4개, comments 4개(읽기·쓰기·지우기 + 그대로인 "본인 수정"), likes 3개(읽기·누르기 + "본인 취소"),
--   --    reports 3개. 이름에 "담임별"·"참여자만"·"게시판 관리자"가 들어간 것이 이 파일의 정책이다.
--   select tablename, policyname, cmd, roles from pg_policies
--   where schemaname = 'public' and tablename like 'community\_%' order by 1, 3, 2;
--
--   -- 2) 신고 스냅샷 — 종류(board/game)·주인 채워진 수. 종류가 빈 줄 = 대상 글이 이미 지워진 옛 댓글 신고(총괄만 봄)
--   select target_post_kind as 종류, target_board_owner is not null as 주인_있음, count(*) as 신고
--   from public.community_reports group by 1, 2 order by 1, 2;
--
--   -- 3) 권한 — 앞 3개 false, 뒤 3개 true
--   select has_column_privilege('authenticated', 'public.community_posts', 'board_owner', 'UPDATE') as 주인_바꾸기,
--          has_function_privilege('anon', 'public.my_boards()', 'execute')                         as 비로그인_게시판목록,
--          has_function_privilege('authenticated', 'public.class_board_owner(uuid)', 'execute')     as 학급주인_직접호출,
--          has_column_privilege('authenticated', 'public.community_posts', 'board_owner', 'INSERT') as 새글에_주인_넣기,
--          has_function_privilege('anon', 'public.can_use_board(uuid)', 'execute')                 as 정책판별_실행,
--          has_function_privilege('authenticated', 'public.my_boards()', 'execute')                as 로그인_게시판목록;
--
--   ※ 4)~10) 흉내 내기는 ③ · ⑥ 파일과 같은 방식이다: "한 번의 Run = 한 트랜잭션"(set local role · set_config(…, true)는
--     그 Run 안에서만 적용되고 끝나면 저절로 풀린다). <…> 자리는 0)에서 찾은 id 로 바꾼다. 블록은 통째로 Run 한다.
--     결과의 "지금_역할" 칸이 anon / authenticated 여야 흉내가 된 것이다(postgres 면 숫자를 믿지 말 것).
--     do 블록은 결과와 상관없이 **아무것도 저장하지 않는다**(성공해도 일부러 오류로 끝내거나, 거부된 쓰기만 시험한다).
--     메시지 첫 글자가 ✔ 면 정상, ✖ 면 그 메시지를 알려 주세요. insert 줄의 `where current_user = 'authenticated'` 는
--     그 줄만 골라 실행해도(관리자 권한) 아무 행도 생기지 않게 하는 안전장치다.
--     (학생 흉내로 글을 쓰는 시험은 그 학생이 20초 안에 글을 썼으면 too_fast 오류가 날 수 있다 — 잠시 뒤 다시 Run.)
--
--   -- 4) 비로그인 흉내 — 게시판_글 0
--   set local role anon;
--   select current_user as 지금_역할, count(*) filter (where kind = 'board') as 게시판_글 from public.community_posts;
--
--   -- 5) 학생 흉내(읽기) — 내_게시판 = 그 학급의 먼저 맡은 담임 id 하나, 다른_게시판_글 0
--   set local role authenticated;
--   select set_config('request.jwt.claims', '{"sub":"<학생 id>","role":"authenticated"}', true);
--   select current_user as 지금_역할, public.my_board_owner_ids() as 내_게시판, public.my_boards() as 게시판_목록,
--          (select count(*) from public.community_posts where kind = 'board') as 보이는_게시판_글,
--          (select count(*) from public.community_posts
--            where kind = 'board' and (board_owner is null or not (board_owner = any (public.my_board_owner_ids())))
--              and author_id is distinct from auth.uid()) as 다른_게시판_글;
--
--   -- 6) 학생 흉내 — board_owner 에 **자기 id** 를 넣은 글은 거부(spec §3.2 구멍) → "✔ … 쓸 수 없습니다(정상)."
--   set local role authenticated;
--   select set_config('request.jwt.claims', '{"sub":"<학급이 있는 학생 id>","role":"authenticated"}', true);
--   do $$
--   begin
--     if current_user <> 'authenticated' or public.is_admin() or public.my_student_class_id() is null then
--       raise exception '✖ 학급이 있는 학생 흉내가 되지 않았습니다(지금 역할 %) — 위 두 줄과 함께 통째로 Run 해 주세요(아무것도 바뀌지 않음).', current_user;
--     end if;
--     insert into public.community_posts (kind, title, body, board_owner)
--     select 'board', '시험', '시험', auth.uid() where current_user = 'authenticated';
--     raise exception '✖ 학생이 자기 id 를 게시판 주인으로 넣어 글을 썼습니다 — 이 메시지를 알려 주세요(시험 글은 저장되지 않았습니다).';
--   exception when insufficient_privilege then
--     raise notice '✔ 학생은 자기 id 를 게시판 주인으로 넣어 글을 쓸 수 없습니다(정상).';
--   end $$;
--
--   -- 7) 학생 흉내 — 자기 게시판(먼저 맡은 담임)에는 쓸 수 있다 → "✔ … 쓸 수 있습니다(1행) …"(일부러 오류로 끝나 저장 안 됨)
--   set local role authenticated;
--   select set_config('request.jwt.claims', '{"sub":"<학급이 있는 학생 id>","role":"authenticated"}', true);
--   do $$
--   declare n int;
--   begin
--     if current_user <> 'authenticated' or cardinality(public.my_board_owner_ids()) <> 1 then
--       raise exception '✖ 게시판이 하나인 학생 흉내가 되지 않았습니다(지금 역할 %) — 위 두 줄과 함께 통째로 Run 해 주세요(아무것도 바뀌지 않음).', current_user;
--     end if;
--     insert into public.community_posts (kind, title, body, board_owner)
--     select 'board', '시험', '시험', (public.my_board_owner_ids())[1] where current_user = 'authenticated';
--     get diagnostics n = row_count;
--     raise exception '% 학생은 자기 게시판에 글을 쓸 수 있습니다(%행) — 시험이라 일부러 오류로 끝냅니다(아무것도 저장되지 않음).',
--       case when n = 1 then '✔' else '✖' end, n;
--   exception when insufficient_privilege then
--     raise exception '✖ 학생이 자기 게시판에 글을 쓰지 못했습니다(권한 거부) — 이 메시지를 알려 주세요(아무것도 바뀌지 않음).';
--   end $$;
--
--   -- 8) 학생 흉내 — 다른 담임 게시판에는 쓸 수 없다(두 번째 담임이 생긴 뒤) → "✔ … 쓸 수 없습니다(정상)."
--   set local role authenticated;
--   select set_config('request.jwt.claims', '{"sub":"<학급이 있는 학생 id>","role":"authenticated"}', true);
--   do $$
--   begin
--     insert into public.community_posts (kind, title, body, board_owner)
--     select 'board', '시험', '시험', '<그 학생의 담임이 아닌 교사 id>'::uuid where current_user = 'authenticated';
--     raise exception '✖ 학생이 다른 담임 게시판에 글을 썼습니다 — 이 메시지를 알려 주세요(시험 글은 저장되지 않았습니다).';
--   exception when insufficient_privilege then
--     raise notice '✔ 학생은 다른 담임 게시판에 글을 쓸 수 없습니다(정상).';
--   end $$;
--
--   -- 9) 총괄이 아닌 담임 흉내(두 번째 담임이 생긴 뒤) — 첫 Run: 다른_게시판_글 0 · 볼_수_있는_신고 중 다른 게시판 것 0
--   set local role authenticated;
--   select set_config('request.jwt.claims', '{"sub":"<총괄이 아닌 담임 id>","role":"authenticated"}', true);
--   select current_user as 지금_역할, public.my_board_owner_ids() as 내_게시판,
--          (select count(*) from public.community_posts
--            where kind = 'board' and (board_owner is null or not (board_owner = any (public.my_board_owner_ids())))
--              and author_id is distinct from auth.uid()) as 다른_게시판_글,
--          (select count(*) from public.community_reports
--            where target_post_kind is distinct from 'game' and reporter_id <> auth.uid()
--              and (target_board_owner is null or not (target_board_owner = any (public.my_board_owner_ids())))) as 다른_게시판_신고;
--   --    (둘째 Run) 같은 두 줄 다음에 — 다른 담임 게시판 글 숨기기는 거부 → "✔ … 숨길 수 없습니다(정상)."
--   do $$
--   begin
--     if current_user <> 'authenticated' or not public.is_admin() or public.is_super_admin() then
--       raise exception '✖ 총괄이 아닌 담임 흉내가 되지 않았습니다(지금 역할 %) — 두 줄과 함께 통째로 Run 해 주세요(아무것도 바뀌지 않음).', current_user;
--     end if;
--     perform public.set_community_post_hidden('<그 담임의 게시판이 아닌 게시판 글 id>'::uuid, true);
--     raise exception '✖ 다른 담임 게시판 글을 숨겼습니다 — 이 메시지를 알려 주세요(시험이라 저장되지 않았습니다).';
--   exception when raise_exception then
--     if sqlerrm = 'admin only' then
--       raise notice '✔ 다른 담임 게시판 글은 숨길 수 없습니다(정상).';
--     else
--       raise;
--     end if;
--   end $$;
--
--   -- 10) 총괄 흉내 — 첫 Run: 보이는_게시판_글 = 0)의 전체 게시판 글 수(관리용으로 모두) / 둘째 Run: 다른 담임 게시판에 쓰기 거부
--   set local role authenticated;
--   select set_config('request.jwt.claims', '{"sub":"<총괄 id>","role":"authenticated"}', true);
--   select current_user as 지금_역할, public.is_super_admin() as 총괄, public.my_board_owner_ids() as 내_게시판,
--          (select count(*) from public.community_posts where kind = 'board') as 보이는_게시판_글;
--   --    (둘째 Run, 두 번째 담임이 생긴 뒤) 같은 두 줄 다음에:
--   do $$
--   begin
--     if current_user <> 'authenticated' or not public.is_super_admin() then
--       raise exception '✖ 총괄 흉내가 되지 않았습니다(지금 역할 %) — 두 줄과 함께 통째로 Run 해 주세요(아무것도 바뀌지 않음).', current_user;
--     end if;
--     insert into public.community_posts (kind, title, body, board_owner)
--     select 'board', '시험', '시험', '<총괄이 담임이 아닌 학급의 담임 id>'::uuid where current_user = 'authenticated';
--     raise exception '✖ 총괄이 다른 담임 게시판에 글을 썼습니다 — 이 메시지를 알려 주세요(시험 글은 저장되지 않았습니다).';
--   exception when insufficient_privilege then
--     raise notice '✔ 총괄도 다른 담임 게시판에는 글을 쓸 수 없습니다(정상 — 관리용으로 보기·숨기기·지우기만).';
--   end $$;

-- ═════════════════════════════════════════════
-- 0. 맨 앞 점검 — 앞 단계가 안 됐으면 아무것도 바꾸지 않는다
-- ═════════════════════════════════════════════
do $$
declare
  v_multi int;
begin
  if to_regclass('public.community_posts') is null
     or to_regclass('public.community_comments') is null
     or to_regclass('public.community_likes') is null
     or to_regclass('public.community_reports') is null
     or not exists (
       select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'community_reports' and column_name = 'target_author_id'
     ) then
    raise exception '커뮤니티 표(20260922040000_community.sql)가 없습니다. 이 파일은 아무것도 바꾸지 않았습니다.';
  end if;

  if to_regclass('public.classes') is null
     or to_regclass('public.class_teachers') is null
     or to_regprocedure('public.is_admin()') is null
     or to_regprocedure('public.is_super_admin()') is null
     or to_regprocedure('public.can_browse()') is null
     or not exists (
       select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'profiles' and column_name = 'class_id'
     )
     or not exists (
       select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'profiles' and column_name = 'withdrawn_at'
     ) then
    raise exception '먼저 ① 20260927000000_classes_schema.sql 을 실행해 주세요(학급 표 · is_super_admin() 이 없습니다). 이 파일은 아무것도 바꾸지 않았습니다.';
  end if;

  if to_regprocedure('public.my_student_class_id()') is null then
    raise exception '먼저 ④ 20260927020000_class_notices.sql 을 실행해 주세요(my_student_class_id() 가 없습니다). 이 파일은 아무것도 바꾸지 않았습니다.';
  end if;

  -- 주인을 정하지 못한 글은 총괄 게시판으로 보내고(3절), 주인이 지워진 게시판은 총괄만 관리한다 → 총괄이 있어야 한다.
  if not exists (select 1 from public.profiles where is_super_admin and role = 'admin') then
    raise exception '총괄 관리자가 아직 없습니다(② docs/classes/setup-owl-class.sql). 이 파일은 아무것도 바꾸지 않았습니다.';
  end if;

  -- 알림만(멈추지 않음): 지금 게시판 읽기 정책이 예상한 이름이 아니면 알려 준다(20260926000000 이 실행됐는지).
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'community_posts' and cmd = 'SELECT'
      and policyname in ('community_posts: 읽기(게시판은 로그인)', 'community_posts: 읽기(게시판은 담임별)')
  ) then
    raise notice '⚠ 자유게시판 읽기 정책이 예상한 이름이 아닙니다(20260926000000_board_login_only.sql 이 적용됐는지 확인해 주세요). 이 파일은 그대로 적용됩니다 — 옛 정책은 이름으로 지웁니다.';
  end if;

  select count(*) into v_multi
  from (select ct.class_id from public.class_teachers ct group by ct.class_id having count(*) > 1) x;
  if v_multi > 0 then
    raise notice '담임이 둘 이상인 학급 %개 — 그 학급 학생은 먼저 맡은 담임의 게시판 하나만 쓰고, 보조 담임은 그 게시판도 함께 봅니다(spec 개정 1).', v_multi;
  end if;
end $$;

-- ═════════════════════════════════════════════
-- 1. 판별 함수 5개 — 기존 is_admin() / my_class_ids() 와 같은 모양:
--    language sql · stable · security definer · set search_path = ''
--    · profiles · class_teachers 만 읽는다(security definer 라 그 표들의 RLS 를 거치지 않음). community_* 표는 읽지 않는다
--      → 커뮤니티 정책이 이 함수를 불러도 재귀(42P17)가 생기지 않는다.
--    · 정책이 부르는 3개(my_board_owner_ids · can_use_board · can_manage_board)는 is_admin() 처럼 PUBLIC 실행
--      (정책은 "요청한 역할"로 평가된다 — 20260923010000 review S1). 돌려주는 값은 "지금 로그인한 나"에 대한 것뿐이다.
--    · 같은 이름 함수가 이미 있으면(다시 실행) 새 정의로 바꾼다. 만드는 순서 = 부르는 순서(본문을 만들 때 검사한다).
-- ═════════════════════════════════════════════

-- 1-1. 그 학급의 게시판 주인 = 먼저 맡은 담임(class_teachers.created_at 이 가장 이른 "지금 교사", 같으면 teacher_id 순).
--      학급·지금 교사가 없으면 null. 담임 해제(admin_set_role)는 그 교사의 class_teachers 줄을 지우므로 다음 담임이 주인이 된다.
--      교사 확인(role 'admin')은 SQL Editor 에서 역할만 바꾼 경우까지 막는 안전장치다. 내부용이라 학생·비로그인은 부를 수 없다.
create or replace function public.class_board_owner(p_class_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select ct.teacher_id
  from public.class_teachers ct
  join public.profiles t on t.id = ct.teacher_id
  where ct.class_id = p_class_id
    and t.role = 'admin'
  order by ct.created_at, ct.teacher_id
  limit 1;
$$;

revoke all on function public.class_board_owner(uuid) from public, anon, authenticated;

-- 1-2. 내가 참여자로 쓸 수 있는 게시판 주인 목록(중복 없이, id 순).
--      · 교사(role 'admin'): 자기가 담임(보조 담임 포함)인 학급들의 게시판 주인(spec 개정 1). 자기가 먼저 맡은(개설한) 학급이
--        있으면 그 학급의 게시판 주인이 자기 자신이라 "자기 게시판"이 들어간다. 학급이 없는 교사 = 빈 배열(spec 개정 2 — 학생이
--        아무도 안 보는 "자기 게시판"을 따로 두지 않는다).
--      · 학생(role 'user', 탈퇴 전 — my_student_class_id()): 자기 학급의 게시판 주인 하나. 학급이 없으면 빈 배열.
--      · 그 밖(비로그인 · 탈퇴 · 담임 해제된 옛 교사처럼 학급 없는 user): 빈 배열.
--      ⚠ 목록에는 class_board_owner(학급의 먼저 맡은 지금 교사)만 들어간다 — 학생 id 는 들어갈 수 없어, board_owner 에
--        자기 id 를 넣은 학생 글은 can_use_board 가 거부한다(spec §3.2).
create or replace function public.my_board_owner_ids()
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(x.owner_id order by x.owner_id), '{}'::uuid[])
  from (
    select public.class_board_owner(ct.class_id) as owner_id
      from public.class_teachers ct
     where ct.teacher_id = auth.uid()
       and public.is_admin()
    union
    select public.class_board_owner(public.my_student_class_id())
  ) x
  where x.owner_id is not null;
$$;

-- 1-3. 그 게시판에 참여(읽기·글·댓글·좋아요)할 수 있나. 주인이 빈 값(지워진 주인)이면 false.
create or replace function public.can_use_board(p_owner uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_owner is not null and p_owner = any (public.my_board_owner_ids());
$$;

-- 1-4. 그 게시판을 관리(숨긴 글·댓글 보기, 숨기기, 지우기, 신고 보기·처리)할 수 있나.
--      총괄 = 모든 게시판(주인이 지워진 게시판 포함 — R1). 교사 = 지금 교사이고 그 게시판에 참여할 수 있을 때(R2 — 자기 게시판,
--      보조 담임은 그 학급의 게시판도). 학생·비로그인 = false.
create or replace function public.can_manage_board(p_owner uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_super_admin()
      or (public.is_admin() and p_owner is not null and p_owner = any (public.my_board_owner_ids()));
$$;

grant execute on function public.my_board_owner_ids() to public;
grant execute on function public.can_use_board(uuid) to public;
grant execute on function public.can_manage_board(uuid) to public;

-- 1-5. 화면용 RPC: 내가 쓸 수 있는 게시판 목록 [{"owner_id": uuid, "teacher_name": text|null, "mine": bool}] — 내 게시판 먼저, 이름순.
--      학생 = 하나(또는 빈 배열 — 화면은 "아직 배정된 담임 선생님이 없어요"). 교사 = 담임(보조 포함)인 학급들의 게시판 주인
--      (또는 빈 배열 — 화면은 "아직 맡은 학급이 없어요", spec 개정 2).
--      teacher_name 은 profiles.display_name(이미 공개 열 — 글·댓글 작성자로 곳곳에 보이는 이름. 학급 이름·소속은 주지 않는다).
--      로그인한 사용자만 부른다(비로그인은 실행 권한 없음 — 게시판은 로그인 전용).
create or replace function public.my_boards()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object('owner_id', p.id, 'teacher_name', p.display_name, 'mine', p.id = auth.uid())
      order by (p.id = auth.uid()) desc, p.display_name, p.id
    ),
    '[]'::jsonb
  )
  from public.profiles p
  where p.id = any (public.my_board_owner_ids());
$$;

revoke all on function public.my_boards() from public, anon;
grant execute on function public.my_boards() to authenticated;

-- ═════════════════════════════════════════════
-- 2. community_posts.board_owner + 기존 글 옮기기(열이 새로 생길 때 한 번만)
--    한 블록(do)으로 묶는다: 열 추가 → "고친 시각" 트리거를 잠시 끄고 옮기기 → 트리거 다시 켜기 → 못 채운 글 점검.
--    블록 하나는 psql 자동 커밋에서도 한 문장이라, 중간에 실패해도 트리거가 꺼진 채 남지 않는다(전부 되돌림).
--    열이 이미 있으면(다시 실행) 옮기기를 건너뛴다 — 주인이 지워져 비어 있는 글(얼어붙은 게시판)을 다른 게시판으로 옮기지 않기 위해.
-- ═════════════════════════════════════════════
do $$
declare
  v_first boolean;
  v_super uuid;
  v_teacher int;
  v_student int;
  v_rest int;
  v_left int;
begin
  v_first := not exists (
    select 1 from pg_attribute
    where attrelid = 'public.community_posts'::regclass and attname = 'board_owner' and not attisdropped
  );

  if not v_first then
    select count(*) into v_left from public.community_posts where kind = 'board' and board_owner is null;
    raise notice '게시판 주인 열이 이미 있어 기존 글 옮기기는 건너뜁니다(다시 실행). 주인이 없는 게시판 글 %개(주인 계정이 지워진 글 — 총괄·글쓴이만 봄).', v_left;
    return;
  end if;

  alter table public.community_posts
    add column board_owner uuid references public.profiles (id) on delete set null;

  -- 총괄 게시판(③): 총괄 중 먼저 맡은(개설한) 학급이 있는 사람(= 학생과 함께 쓰는 자기 게시판이 있음 — spec 개정 2)을 먼저,
  -- 그다음 보관하지 않은 학급의 담임인 사람, 그다음 먼저 만든 계정(총괄은 보통 한 명)
  select t.id into v_super
  from public.profiles t
  where t.is_super_admin and t.role = 'admin'
  order by exists (
             select 1 from public.class_teachers ct
             where ct.teacher_id = t.id and public.class_board_owner(ct.class_id) = t.id
           ) desc,
           exists (
             select 1 from public.class_teachers ct
             join public.classes c on c.id = ct.class_id
             where ct.teacher_id = t.id and c.archived_at is null
           ) desc,
           t.created_at, t.id
  limit 1;

  -- 옮기기만 하는 갱신이 글의 "고친 시각"을 바꾸지 않게 set_updated_at 트리거를 잠시 끈다(이 블록 안에서만).
  alter table public.community_posts disable trigger community_posts_updated_at;

  -- ① 교사가 쓴 글 → 그 교사가 담임(보조 포함)인 학급의 게시판: 자기가 먼저 맡은 학급이 있으면 자기 게시판, 보조로만 맡았으면
  --    맡은 학급(먼저 맡은 순)의 게시판(spec 개정 2 — 학생이 없는 "자기 게시판"으로 보내지 않는다). 학급이 없는 교사의 글은 ③.
  update public.community_posts p
     set board_owner = d.owner_id
    from (
      select a.id as author_id,
             (select o.owner_id
                from (select public.class_board_owner(ct.class_id) as owner_id, ct.created_at, ct.class_id
                        from public.class_teachers ct
                       where ct.teacher_id = a.id) o
               where o.owner_id is not null
               order by (o.owner_id = a.id) desc, o.created_at, o.class_id
               limit 1) as owner_id
        from public.profiles a
       where a.role = 'admin'
    ) d
   where p.kind = 'board'
     and p.board_owner is null
     and p.author_id = d.author_id
     and d.owner_id is not null;
  get diagnostics v_teacher = row_count;

  -- ② 학생이 쓴 글(탈퇴한 학생 포함) → 그 학생 학급의 먼저 맡은 담임 게시판
  update public.community_posts p
     set board_owner = public.class_board_owner(s.class_id)
    from public.profiles s
   where p.kind = 'board'
     and p.board_owner is null
     and s.id = p.author_id
     and s.role = 'user'
     and s.class_id is not null
     and public.class_board_owner(s.class_id) is not null;
  get diagnostics v_student = row_count;

  -- ③ 나머지(글쓴이 없음 · 학급 없는 계정 · 지금 교사가 없는 학급) → 총괄 게시판
  update public.community_posts p
     set board_owner = v_super
   where p.kind = 'board'
     and p.board_owner is null;
  get diagnostics v_rest = row_count;

  alter table public.community_posts enable trigger community_posts_updated_at;

  -- ④ 못 채운 글이 있으면 멈춘다(전부 되돌림)
  select count(*) into v_left from public.community_posts where kind = 'board' and board_owner is null;
  if v_left > 0 then
    raise exception '게시판 주인을 정하지 못한 글이 %개 있습니다(총괄을 찾지 못함). 이 파일 전체를 되돌렸습니다(아무것도 바뀌지 않음) — 이 메시지를 알려 주세요.', v_left;
  end if;

  raise notice '기존 자유게시판 글을 옮겼습니다: 교사 글 %개(그 교사가 맡은 학급의 게시판) · 학생 글 %개(먼저 맡은 담임 게시판) · 나머지 %개(총괄 게시판).',
    v_teacher, v_student, v_rest;
end $$;

-- 2-1. 제약: 게시판 글이 아니면(학습게임) 주인 없음. 게시판 글의 주인은 비어 있을 수 있다(주인 계정이 지워지면 set null — R1).
alter table public.community_posts drop constraint if exists community_posts_board_owner_chk;
alter table public.community_posts
  add constraint community_posts_board_owner_chk check (kind = 'board' or board_owner is null);

-- 2-2. 게시판별 최신순 목록(화면: board_owner 로 거름) + 외래키 set null 에도 쓰인다
create index if not exists community_posts_board_owner_idx on public.community_posts (board_owner, created_at desc);

-- 2-3. 열 권한: 새 글에는 게시판 주인을 넣을 수 있고, 고치기로는 바꿀 수 없다(주인은 쓴 시점에 고정 — spec §8-2).
--      표 단위 revoke 는 열 단위 권한도 함께 거둔다 → 아래 grant 목록이 정확히 남는다(재실행해도 같은 결과).
--      목록 = 20260922040000 의 목록 그대로 + insert 에만 board_owner.
revoke insert on public.community_posts from anon, authenticated;
grant insert (kind, title, body, game_path, game_size, board_owner) on public.community_posts to authenticated;
revoke update on public.community_posts from anon, authenticated;
grant update (title, body, game_path, game_size) on public.community_posts to authenticated;

-- ═════════════════════════════════════════════
-- 3. 신고 스냅샷 2개 + 트리거 + 지금 신고 채우기(R4 — target_kind 의 뜻은 그대로)
--    target_post_kind   : 신고한 글의 종류, 댓글 신고면 그 댓글이 달린 글의 종류('board' | 'game'). 빈 값 = 모름(대상이 이미 지워진 옛 댓글 신고).
--    target_board_owner : 그 글의 게시판 주인(학습게임은 빈 값). 주인 계정이 지워지면 빈 값(set null) — 종류는 남아 총괄만 본다.
--    클라이언트는 두 열을 보내지 못한다(신고 insert 열 권한은 post_id · comment_id · reason · detail 그대로) — 트리거가 채운다.
-- ═════════════════════════════════════════════
alter table public.community_reports
  add column if not exists target_board_owner uuid references public.profiles (id) on delete set null;
alter table public.community_reports
  add column if not exists target_post_kind text;

alter table public.community_reports drop constraint if exists community_reports_target_post_kind_check;
alter table public.community_reports
  add constraint community_reports_target_post_kind_check check (target_post_kind in ('board', 'game'));

create index if not exists community_reports_target_board_owner_idx on public.community_reports (target_board_owner);

-- 3-1. 신고 스냅샷 트리거(20260922040000 정의 + 두 열). 나머지는 글자 그대로다.
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
  -- target_post_kind · target_board_owner: 신고한 글(댓글 신고면 그 댓글이 달린 글)의 종류·게시판 주인(담임교사별 게시판, 20260928010000).
  if new.comment_id is not null then
    select 'comment', null, left(c.body, 1000), c.user_id, p.kind, p.board_owner
      into new.target_kind, new.target_title, new.target_body, new.target_author_id, new.target_post_kind, new.target_board_owner
      from public.community_comments c
      join public.community_posts p on p.id = c.post_id
      where c.id = new.comment_id and c.post_id = new.post_id;
  else
    select p.kind, p.title, left(p.body, 1000), p.author_id, p.kind, p.board_owner
      into new.target_kind, new.target_title, new.target_body, new.target_author_id, new.target_post_kind, new.target_board_owner
      from public.community_posts p
      where p.id = new.post_id;
  end if;
  return new;
end;
$$;

-- 트리거 연결은 20260922040000 그대로(before insert). 다시 만들어 둔다(재실행 안전).
drop trigger if exists community_reports_guard on public.community_reports;
create trigger community_reports_guard
  before insert on public.community_reports
  for each row execute function public.community_reports_guard();

-- 3-2. 지금 신고 채우기 — 아직 종류가 빈 신고만(다시 실행해도 채운 값은 바꾸지 않는다).
--      (가) 대상 글이 남아 있으면 그 글에서(옮긴 뒤의 게시판 주인) — 글 신고·댓글 신고 모두 post_id 가 그 글이다.
update public.community_reports r
   set target_post_kind = p.kind,
       target_board_owner = p.board_owner
  from public.community_posts p
 where r.target_post_kind is null
   and r.post_id = p.id;

--      (나) 대상 글이 지워진 글·게임 신고: 종류는 target_kind 로 안다(게시판 신고는 주인을 몰라 총괄만 본다).
--           대상 글이 지워진 댓글 신고는 종류를 몰라 빈 값으로 남는다 → 총괄만 본다(R4).
update public.community_reports r
   set target_post_kind = r.target_kind
 where r.target_post_kind is null
   and r.target_kind in ('board', 'game');

-- ═════════════════════════════════════════════
-- 4. 정책 — 게시판 쪽만 좁히고 학습게임 쪽은 지금 조건을 글자 그대로 남긴다(각 식에 두 갈래를 나란히 적었다).
--    옛 이름·새 이름을 모두 drop 한 뒤 만든다(재실행 안전). 대상 역할(to …)은 옛 정의 그대로다.
--    정책 이름은 모두 63바이트 안이다(가장 긴 것 "community_likes: 본인 추가(게시판은 참여자만)" 57바이트).
-- ═════════════════════════════════════════════

-- 4-1. community_posts 읽기 — 옛 정의: 20260926000000 "community_posts: 읽기(게시판은 로그인)"
drop policy if exists "community_posts: 숨김 아니면 누구나, 작성자·관리자는 숨김도" on public.community_posts;
drop policy if exists "community_posts: 읽기(게시판은 로그인)" on public.community_posts;
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

-- 4-2. community_posts 쓰기 — 옛 정의: 20260922040000 "community_posts: 로그인 사용자 작성"
--      게시판 글은 참여할 수 있는 게시판에만(주인이 빈 값이면 거부 — R1). 총괄도 다른 담임 게시판에는 못 쓴다.
drop policy if exists "community_posts: 로그인 사용자 작성" on public.community_posts;
drop policy if exists "community_posts: 쓰기(게시판은 참여자만)" on public.community_posts;
create policy "community_posts: 쓰기(게시판은 참여자만)"
  on public.community_posts for insert
  to authenticated
  with check (
    auth.uid() = author_id
    and hidden = false
    and (
      kind <> 'board'                                   -- 학습게임: 그대로(주인은 제약으로 늘 빈 값)
      or public.can_use_board(board_owner)              -- 자유게시판: 그 게시판 참여자만
    )
  );

-- 4-3. community_posts 고치기 — 옛 정의: 20260922040000 "community_posts: 본인 또는 관리자 수정"
drop policy if exists "community_posts: 본인 또는 관리자 수정" on public.community_posts;
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

-- 4-4. community_posts 지우기 — 옛 정의: 20260922040000 "community_posts: 본인 또는 관리자 삭제"
drop policy if exists "community_posts: 본인 또는 관리자 삭제" on public.community_posts;
drop policy if exists "community_posts: 본인·게시판 관리자 삭제" on public.community_posts;
create policy "community_posts: 본인·게시판 관리자 삭제"
  on public.community_posts for delete
  to authenticated
  using (
    auth.uid() = author_id
    or (kind <> 'board' and public.is_admin())
    or (kind = 'board' and public.can_manage_board(board_owner))
  );

-- 4-5. community_comments 읽기 — 옛 정의: 20260926000000 "community_comments: 읽기(게시판은 로그인)"
--      부모 글을 community_posts 에서 찾는다(다른 표 — 그 조회에도 글 정책이 걸린다). 뜻을 분명히 하려고 조건을 직접 적는다.
--      댓글 자신의 숨김 조건도 글의 종류·게시판에 따라 나뉘므로 하위 쿼리 안으로 옮겼다(학습게임 쪽 식은 그대로).
drop policy if exists "community_comments: 숨김 아니면 누구나" on public.community_comments;
drop policy if exists "community_comments: 읽기(게시판은 로그인)" on public.community_comments;
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

-- 4-6. community_comments 쓰기 — 옛 정의: 20260922040000 "community_comments: 로그인 사용자 작성"
--      게시판 글에는 그 게시판 참여자만 댓글을 단다(총괄도 다른 담임 게시판에는 못 씀, 주인이 지워진 게시판은 아무도).
drop policy if exists "community_comments: 로그인 사용자 작성" on public.community_comments;
drop policy if exists "community_comments: 쓰기(게시판은 참여자만)" on public.community_comments;
create policy "community_comments: 쓰기(게시판은 참여자만)"
  on public.community_comments for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and hidden = false
    and exists (
      select 1 from public.community_posts p
      where p.id = community_comments.post_id
        and not p.hidden
        and (p.kind <> 'board' or public.can_use_board(p.board_owner))
    )
  );

-- 4-7. community_comments 지우기 — 옛 정의: 20260922040000 "community_comments: 본인 또는 관리자 삭제"
--      "본인 수정"(auth.uid() = user_id)은 관리자 조건이 없어 그대로 둔다.
drop policy if exists "community_comments: 본인 또는 관리자 삭제" on public.community_comments;
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

-- 4-8. community_likes 읽기 — 옛 정의: 20260926000000 "community_likes: 볼 수 있는 글만 조회"
drop policy if exists "community_likes: 누구나 조회" on public.community_likes;
drop policy if exists "community_likes: 볼 수 있는 글만 조회" on public.community_likes;
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

-- 4-9. community_likes 누르기 — 옛 정의: 20260922040000 "community_likes: 본인 추가". "본인 취소"는 그대로 둔다.
drop policy if exists "community_likes: 본인 추가" on public.community_likes;
drop policy if exists "community_likes: 본인 추가(게시판은 참여자만)" on public.community_likes;
create policy "community_likes: 본인 추가(게시판은 참여자만)"
  on public.community_likes for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.community_posts p
      where p.id = community_likes.post_id
        and not p.hidden
        and (p.kind <> 'board' or public.can_use_board(p.board_owner))
    )
  );

-- 4-10. community_reports 읽기 — 옛 정의: 20260922040000 "community_reports: 신고자 본인·관리자 조회"
--       학습게임 신고 = 교사 누구나(그대로). 게시판 신고·종류를 모르는 옛 신고 = 그 게시판 관리자·총괄(주인을 모르면 총괄만).
drop policy if exists "community_reports: 신고자 본인·관리자 조회" on public.community_reports;
drop policy if exists "community_reports: 신고자·게시판 관리자 조회" on public.community_reports;
create policy "community_reports: 신고자·게시판 관리자 조회"
  on public.community_reports for select
  to authenticated
  using (
    auth.uid() = reporter_id
    or (target_post_kind = 'game' and public.is_admin())
    or (target_post_kind is distinct from 'game' and public.can_manage_board(target_board_owner))
  );

-- 4-11. community_reports 신고 — 옛 정의: 20260922040000 "community_reports: 로그인 사용자 신고"
--       "볼 수 있는 글"의 관리자 조건만 종류별로 나눴다(글 읽기 정책과 같은 뜻). 나머지(내 글·내 댓글 신고 불가)는 그대로.
drop policy if exists "community_reports: 로그인 사용자 신고" on public.community_reports;
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

-- 4-12. community_reports 지우기 — 옛 정의: 20260922040000 "community_reports: 관리자 삭제"(화면은 신고를 지우지 않는다 — 좁혀만 둔다)
drop policy if exists "community_reports: 관리자 삭제" on public.community_reports;
drop policy if exists "community_reports: 게시판 관리자 삭제" on public.community_reports;
create policy "community_reports: 게시판 관리자 삭제"
  on public.community_reports for delete
  to authenticated
  using (
    (target_post_kind = 'game' and public.is_admin())
    or (target_post_kind is distinct from 'game' and public.can_manage_board(target_board_owner))
  );

-- ═════════════════════════════════════════════
-- 5. 관리 함수 4개(20260922040000 정의) — 서명·권한은 그대로, 판단만: 학습게임 = 교사 누구나(그대로),
--    자유게시판 = can_manage_board(그 게시판 주인)(그 게시판 담임·보조 담임·총괄). 학생이 부르면 지금처럼 'admin only'.
-- ═════════════════════════════════════════════

-- 5-1. 글 숨기기·다시 보이기
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

-- 5-2. 댓글 숨기기·다시 보이기 — 댓글이 달린 글의 종류·게시판으로 판단한다
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

-- 5-3. 신고 처리 완료·다시 열기 — 신고 스냅샷(target_post_kind · target_board_owner)으로 판단한다(대상이 지워져도 판단 가능).
--      종류를 모르는 옛 신고·주인이 지워진 게시판 신고는 총괄만(can_manage_board(빈 값) = 총괄).
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

-- 5-4. 같은 대상의 열린 신고를 한꺼번에 처리 완료(숨기기·지우기 때). 글의 종류·게시판으로 판단한다.
--      글이 이미 없으면 0을 돌려준다(그 글을 가리키던 신고는 post_id 가 비워져 원래도 0건이다).
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
-- 6. 맨 끝 점검 — 설계와 다르면 전부 되돌린다(아무것도 바뀌지 않음)
--    허용(PERMISSIVE) 정책끼리는 OR 로 합쳐지므로, 모르는 허용 정책이 하나라도 남아 있으면 좁히기가 소리 없이 무효가 된다.
--    조건은 Postgres 가 다시 그린 식에서 함수 이름으로 찾는다(public. 은 표시 방식에 따라 빠질 수 있다 — ⑤ · ⑥ 과 같은 방식).
-- ═════════════════════════════════════════════
do $$
declare
  v_missing  text;
  v_extra    text;
  v_roles    text;
  v_cond     text;
  v_unguard  text;
  v_fn       text;
  v_blocking text;
  v_left     int;
  v_unknown  int;
begin
  -- 6-1. RLS 켜짐(4개 표)
  if exists (
    select 1 from pg_class c
    where c.oid in ('public.community_posts'::regclass, 'public.community_comments'::regclass,
                    'public.community_likes'::regclass, 'public.community_reports'::regclass)
      and not c.relrowsecurity
  ) then
    raise exception '커뮤니티 표의 RLS 가 꺼져 있습니다. 이 파일 전체를 되돌렸습니다(아무것도 바뀌지 않음) — 이 메시지를 알려 주세요.';
  end if;

  -- 6-2. 열 · 외래키(profiles, on delete set null) · 제약
  if not exists (
       select 1 from pg_constraint con
       where con.conrelid = 'public.community_posts'::regclass and con.contype = 'f'
         and con.confrelid = 'public.profiles'::regclass and con.confdeltype = 'n'
         and con.conkey = array[(select att.attnum from pg_attribute att
                                 where att.attrelid = 'public.community_posts'::regclass and att.attname = 'board_owner' and not att.attisdropped)]
     )
     or not exists (
       select 1 from pg_constraint con
       where con.conrelid = 'public.community_reports'::regclass and con.contype = 'f'
         and con.confrelid = 'public.profiles'::regclass and con.confdeltype = 'n'
         and con.conkey = array[(select att.attnum from pg_attribute att
                                 where att.attrelid = 'public.community_reports'::regclass and att.attname = 'target_board_owner' and not att.attisdropped)]
     )
     or not exists (
       select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'community_reports' and column_name = 'target_post_kind' and data_type = 'text'
     )
     or not exists (
       select 1 from pg_constraint con
       where con.conrelid = 'public.community_posts'::regclass and con.conname = 'community_posts_board_owner_chk' and con.convalidated
     ) then
    raise exception '게시판 주인 열(board_owner · target_board_owner → profiles, on delete set null) · target_post_kind · 제약이 설계와 다릅니다(열이 먼저 다른 방식으로 만들어졌을 수 있음). 이 파일 전체를 되돌렸습니다(아무것도 바뀌지 않음) — 이 메시지를 알려 주세요.';
  end if;

  -- 6-3. 이 파일의 정책 12개 + 그대로 둔 2개가 이름 · 명령 그대로 있는지
  select string_agg(format('%s / %s (%s)', e.t, e.p, e.c), ', ') into v_missing
  from (values
    ('community_posts', 'community_posts: 읽기(게시판은 담임별)', 'SELECT'),
    ('community_posts', 'community_posts: 쓰기(게시판은 참여자만)', 'INSERT'),
    ('community_posts', 'community_posts: 본인·게시판 관리자 수정', 'UPDATE'),
    ('community_posts', 'community_posts: 본인·게시판 관리자 삭제', 'DELETE'),
    ('community_comments', 'community_comments: 읽기(게시판은 담임별)', 'SELECT'),
    ('community_comments', 'community_comments: 쓰기(게시판은 참여자만)', 'INSERT'),
    ('community_comments', 'community_comments: 본인 수정', 'UPDATE'),
    ('community_comments', 'community_comments: 본인·게시판 관리자 삭제', 'DELETE'),
    ('community_likes', 'community_likes: 읽기(게시판은 담임별)', 'SELECT'),
    ('community_likes', 'community_likes: 본인 추가(게시판은 참여자만)', 'INSERT'),
    ('community_likes', 'community_likes: 본인 취소', 'DELETE'),
    ('community_reports', 'community_reports: 신고자·게시판 관리자 조회', 'SELECT'),
    ('community_reports', 'community_reports: 신고(볼 수 있는 글·댓글만)', 'INSERT'),
    ('community_reports', 'community_reports: 게시판 관리자 삭제', 'DELETE')
  ) as e(t, p, c)
  where not exists (
    select 1 from pg_policies pp
    where pp.schemaname = 'public' and pp.tablename = e.t and pp.policyname = e.p and pp.cmd = e.c
      and pp.permissive = 'PERMISSIVE'
  );
  if v_missing is not null then
    raise exception '있어야 할 커뮤니티 정책이 없습니다: %. 이 파일 전체를 되돌렸습니다(아무것도 바뀌지 않음) — 이 메시지를 알려 주세요.', v_missing;
  end if;

  -- 6-4. 그 밖의 허용 정책이 남아 있지 않은지(옛 이름 · 대시보드에서 만든 정책 등)
  select string_agg(format('%s / %s (%s)', pp.tablename, pp.policyname, pp.cmd), ', ' order by pp.tablename, pp.policyname)
    into v_extra
  from pg_policies pp
  where pp.schemaname = 'public'
    and pp.tablename in ('community_posts', 'community_comments', 'community_likes', 'community_reports')
    and pp.permissive = 'PERMISSIVE'
    and pp.policyname not in (
      'community_posts: 읽기(게시판은 담임별)', 'community_posts: 쓰기(게시판은 참여자만)',
      'community_posts: 본인·게시판 관리자 수정', 'community_posts: 본인·게시판 관리자 삭제',
      'community_comments: 읽기(게시판은 담임별)', 'community_comments: 쓰기(게시판은 참여자만)',
      'community_comments: 본인 수정', 'community_comments: 본인·게시판 관리자 삭제',
      'community_likes: 읽기(게시판은 담임별)', 'community_likes: 본인 추가(게시판은 참여자만)', 'community_likes: 본인 취소',
      'community_reports: 신고자·게시판 관리자 조회', 'community_reports: 신고(볼 수 있는 글·댓글만)',
      'community_reports: 게시판 관리자 삭제'
    );
  if v_extra is not null then
    raise exception '커뮤니티 표에 이 파일이 모르는 정책이 남아 있습니다: %. 이 파일 전체를 되돌렸습니다(아무것도 바뀌지 않음) — 이 메시지를 알려 주세요.', v_extra;
  end if;

  -- 6-5. 대상 역할: 읽기 3개(글·댓글·좋아요)는 모두(옛 정의처럼 지정 없음 = public), 나머지는 로그인한 사용자
  select string_agg(format('%s (%s)', pp.policyname, pp.roles::text), ', ') into v_roles
  from pg_policies pp
  where pp.schemaname = 'public'
    and pp.tablename in ('community_posts', 'community_comments', 'community_likes', 'community_reports')
    and pp.permissive = 'PERMISSIVE'
    and pp.roles <> case
                      when pp.cmd = 'SELECT' and pp.tablename <> 'community_reports' then '{public}'::name[]
                      else '{authenticated}'::name[]
                    end;
  if v_roles is not null then
    raise exception '커뮤니티 정책의 대상 역할이 설계와 다릅니다: %. 이 파일 전체를 되돌렸습니다(아무것도 바뀌지 않음) — 이 메시지를 알려 주세요.', v_roles;
  end if;

  -- 6-6. 조건 글자 점검(6-4 뒤라 남은 허용 정책 = 위 14개)
  select string_agg(format('%s / %s', pp.tablename, pp.policyname), ', ') into v_cond
  from pg_policies pp
  where pp.schemaname = 'public'
    and pp.tablename in ('community_posts', 'community_comments', 'community_likes', 'community_reports')
    and pp.permissive = 'PERMISSIVE'
    and not (
      case pp.policyname::text
        when 'community_posts: 읽기(게시판은 담임별)' then
          position('can_use_board(' in coalesce(pp.qual, '')) > 0
          and position('can_manage_board(' in coalesce(pp.qual, '')) > 0
          and position('can_browse()' in coalesce(pp.qual, '')) > 0
        when 'community_posts: 쓰기(게시판은 참여자만)' then
          position('can_use_board(' in coalesce(pp.with_check, '')) > 0
          and position('uid()' in coalesce(pp.with_check, '')) > 0
        when 'community_posts: 본인·게시판 관리자 수정' then
          position('can_manage_board(' in coalesce(pp.qual, '')) > 0
          and position('can_manage_board(' in coalesce(pp.with_check, '')) > 0
        when 'community_posts: 본인·게시판 관리자 삭제' then
          position('can_manage_board(' in coalesce(pp.qual, '')) > 0
        when 'community_comments: 읽기(게시판은 담임별)' then
          position('can_use_board(' in coalesce(pp.qual, '')) > 0
          and position('can_manage_board(' in coalesce(pp.qual, '')) > 0
        when 'community_comments: 쓰기(게시판은 참여자만)' then
          position('can_use_board(' in coalesce(pp.with_check, '')) > 0
        when 'community_comments: 본인·게시판 관리자 삭제' then
          position('can_manage_board(' in coalesce(pp.qual, '')) > 0
        when 'community_likes: 읽기(게시판은 담임별)' then
          position('can_use_board(' in coalesce(pp.qual, '')) > 0
          and position('can_manage_board(' in coalesce(pp.qual, '')) > 0
        when 'community_likes: 본인 추가(게시판은 참여자만)' then
          position('can_use_board(' in coalesce(pp.with_check, '')) > 0
        when 'community_reports: 신고자·게시판 관리자 조회' then
          position('can_manage_board(' in coalesce(pp.qual, '')) > 0
        when 'community_reports: 신고(볼 수 있는 글·댓글만)' then
          position('can_use_board(' in coalesce(pp.with_check, '')) > 0
          and position('can_manage_board(' in coalesce(pp.with_check, '')) > 0
        when 'community_reports: 게시판 관리자 삭제' then
          position('can_manage_board(' in coalesce(pp.qual, '')) > 0
        else  -- 그대로 둔 "본인 수정" · "본인 취소": 본인 것만(auth.uid() = user_id) · 관리자 조건 없음(검토 L5 — 넓게 바뀐 것도 잡는다)
          position('is_admin()' in coalesce(pp.qual, '') || coalesce(pp.with_check, '')) = 0
          and position('uid()' in coalesce(pp.qual, '')) > 0
          and position('user_id' in coalesce(pp.qual, '')) > 0
          and (pp.with_check is null
               or (position('uid()' in pp.with_check) > 0 and position('user_id' in pp.with_check) > 0))
      end
    );
  if v_cond is not null then
    raise exception '커뮤니티 정책 조건이 설계와 다릅니다: %. 이 파일 전체를 되돌렸습니다(아무것도 바뀌지 않음) — 이 메시지를 알려 주세요.', v_cond;
  end if;

  -- 6-7. is_admin()(교사 누구나)은 학습게임 갈래에만 — is_admin() 이 들어간 정책은 종류('game' 또는 'board')로 나뉘어 있어야 한다
  select string_agg(format('%s / %s', pp.tablename, pp.policyname), ', ') into v_unguard
  from pg_policies pp
  where pp.schemaname = 'public'
    and pp.tablename in ('community_posts', 'community_comments', 'community_likes', 'community_reports')
    and position('is_admin()' in coalesce(pp.qual, '') || coalesce(pp.with_check, '')) > 0
    and position('''board''' in coalesce(pp.qual, '') || coalesce(pp.with_check, '')) = 0
    and position('''game''' in coalesce(pp.qual, '') || coalesce(pp.with_check, '')) = 0;
  if v_unguard is not null then
    raise exception '종류(게시판/학습게임)를 가리지 않고 교사 누구나 허용하는 정책이 있습니다: %. 이 파일 전체를 되돌렸습니다(아무것도 바뀌지 않음) — 이 메시지를 알려 주세요.', v_unguard;
  end if;

  -- 6-8. 관리 함수 4개가 게시판 판단(can_manage_board)을 하고, 신고 트리거가 두 스냅샷을 채우는지
  select string_agg(p.oid::regprocedure::text, ', ' order by p.oid::regprocedure::text) into v_fn
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and (
      (p.proname in ('set_community_post_hidden', 'set_community_comment_hidden', 'set_community_report_status',
                     'resolve_community_reports_for')
       and position('can_manage_board(' in p.prosrc) = 0)
      or (p.proname = 'community_reports_guard'
          and (position('target_board_owner' in p.prosrc) = 0 or position('target_post_kind' in p.prosrc) = 0))
    );
  if v_fn is not null then
    raise exception '게시판 판단이 빠진 관리 함수가 있습니다: %. 이 파일 전체를 되돌렸습니다(아무것도 바뀌지 않음) — 이 메시지를 알려 주세요.', v_fn;
  end if;

  -- 6-9. 열 권한: 게시판 주인은 새 글에만 넣고(로그인한 사용자) 아무도 바꾸지 못한다. 비로그인은 글을 쓰지 못한다.
  --      신고 스냅샷 열은 클라이언트가 보내지도 바꾸지도 못한다.
  if not has_column_privilege('authenticated', 'public.community_posts', 'board_owner', 'INSERT')
     or has_column_privilege('authenticated', 'public.community_posts', 'board_owner', 'UPDATE')
     or has_column_privilege('anon', 'public.community_posts', 'board_owner', 'UPDATE')
     or has_any_column_privilege('anon', 'public.community_posts', 'INSERT')
     or has_column_privilege('authenticated', 'public.community_reports', 'target_board_owner', 'INSERT')
     or has_column_privilege('authenticated', 'public.community_reports', 'target_board_owner', 'UPDATE')
     or has_column_privilege('authenticated', 'public.community_reports', 'target_post_kind', 'INSERT')
     or has_column_privilege('authenticated', 'public.community_reports', 'target_post_kind', 'UPDATE') then
    raise exception '게시판 주인 · 신고 스냅샷 열 권한이 설계와 다릅니다(PUBLIC 권한 등). 이 파일 전체를 되돌렸습니다(아무것도 바뀌지 않음) — 이 메시지를 알려 주세요.';
  end if;
  if not (
    has_column_privilege('authenticated', 'public.community_posts', 'title', 'UPDATE')
    and has_column_privilege('authenticated', 'public.community_posts', 'body', 'UPDATE')
    and has_column_privilege('authenticated', 'public.community_posts', 'game_path', 'UPDATE')
    and has_column_privilege('authenticated', 'public.community_posts', 'kind', 'INSERT')
    and has_column_privilege('authenticated', 'public.community_posts', 'game_size', 'INSERT')
  ) then
    raise exception '글 쓰기 · 고치기 열 권한이 빠졌습니다(글 저장이 막힘). 이 파일 전체를 되돌렸습니다(아무것도 바뀌지 않음) — 이 메시지를 알려 주세요.';
  end if;

  -- 6-10. 함수 권한: 정책이 부르는 판별 함수는 누구나(비로그인 포함 — 없으면 읽을 때 permission denied),
  --       게시판 목록 RPC 는 로그인한 사용자만, 학급 주인 함수는 내부용
  if not (
    has_function_privilege('anon', 'public.my_board_owner_ids()', 'EXECUTE')
    and has_function_privilege('anon', 'public.can_use_board(uuid)', 'EXECUTE')
    and has_function_privilege('anon', 'public.can_manage_board(uuid)', 'EXECUTE')
    and has_function_privilege('authenticated', 'public.can_use_board(uuid)', 'EXECUTE')
    and has_function_privilege('authenticated', 'public.can_manage_board(uuid)', 'EXECUTE')
    and has_function_privilege('authenticated', 'public.my_boards()', 'EXECUTE')
    and has_function_privilege('anon', 'public.can_browse()', 'EXECUTE')
  )
     or has_function_privilege('anon', 'public.my_boards()', 'EXECUTE')
     or has_function_privilege('anon', 'public.class_board_owner(uuid)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.class_board_owner(uuid)', 'EXECUTE')
     or has_function_privilege('anon', 'public.set_community_post_hidden(uuid, boolean)', 'EXECUTE')
     or has_function_privilege('anon', 'public.set_community_report_status(uuid, text)', 'EXECUTE') then
    raise exception '게시판 함수 실행 권한이 설계와 다릅니다. 이 파일 전체를 되돌렸습니다(아무것도 바뀌지 않음) — 이 메시지를 알려 주세요.';
  end if;

  -- 6-11. 완전 삭제(20260928000000 admin_purge_oauth_member)를 막는 외래키가 없는지 — 그 함수의 맨 끝 점검과 같은 조건.
  --       게시판 주인이던 옛 교사(담임 해제 뒤 role 'user')를 지워도 게시판 글은 남고 주인만 비워진다(set null — R1).
  select string_agg(format('%s.%s (%s → %s)', n.nspname, c.relname, con.conname, con.confrelid::regclass),
                    ', ' order by n.nspname, c.relname, con.conname)
    into v_blocking
  from pg_constraint con
  join pg_class c on c.oid = con.conrelid
  join pg_namespace n on n.oid = c.relnamespace
  where con.contype = 'f'
    and con.confrelid in ('public.profiles'::regclass, 'public.community_posts'::regclass, 'public.community_comments'::regclass)
    and con.confdeltype in ('r', 'a');
  if v_blocking is not null then
    raise exception '완전 삭제를 막는 외래키가 있습니다: %. 이 파일 전체를 되돌렸습니다(아무것도 바뀌지 않음) — 이 메시지를 알려 주세요.', v_blocking;
  end if;

  select count(*) into v_left from public.community_posts where kind = 'board' and board_owner is null;
  select count(*) into v_unknown from public.community_reports where target_post_kind is null;

  raise notice '✔ 자유게시판을 담임교사별로 나눴습니다: 학생은 자기 학급의 먼저 맡은 담임 게시판 하나, 교사는 담임(보조 포함)인 학급의 게시판을 보고 쓰며(개설한 학급이 없는 교사는 게시판 없음), 총괄은 관리용으로 모든 게시판을 봅니다(쓰기는 자기가 쓸 수 있는 게시판만). 학습게임은 그대로입니다. 주인 없는 게시판 글 %개 · 종류를 모르는 옛 신고 %개(총괄만 봄). 다음: 확인 쿼리 → 사이트 push.',
    v_left, v_unknown;
end $$;

-- PostgREST 가 새 열·함수를 바로 알도록(대시보드도 대개 자동으로 하지만 한 번 더 — 모르면 새 글 저장 때 PGRST204)
notify pgrst, 'reload schema';
