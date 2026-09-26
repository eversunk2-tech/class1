-- 과제·블로그 글은 쓴 선생님과 총괄만 고치고 지우기 (2026-09-26 사용자 결정 — docs/classes/review.md M1)
-- 사용자: "과제·글 수정은 쓴 선생님과 총괄만 하게 해줘"
-- 지침: docs/classes/build-owner-only-instructions.md · 보고: docs/classes/build-owner-only-report.md
--
-- ▶ 왜
--   지금은 교사 누구나(is_admin()) 모든 과제·블로그 글을 고치고 지울 수 있다. 과제를 지우면 그 과제의 학생 제출물이
--   외래키 연쇄 삭제(assignment_submissions.assignment_id … on delete cascade — RLS 를 거치지 않음)로 함께 사라지므로,
--   다른 반 담임이 과제를 지우면 부엉이반 학생 제출물까지 지워진다. 블로그 글을 지우면 글 읽음 기록(post_reads)·댓글·
--   좋아요·조회수가 같은 식으로 지워진다.
--
-- ▶ 무엇이 바뀌나 — assignments · posts 두 표의 "쓰기" 정책과 고치기 열 권한만(읽기(SELECT) 정책은 그대로)
--   · 새로 만들기(INSERT): 교사(is_admin())가 자기 이름으로만 — created_by / author_id = 나.
--     두 열 모두 기본값이 auth.uid()라 화면은 이 열을 보내지 않는다(남의 이름·빈 이름으로는 만들 수 없다).
--   · 고치기(공개 전환 포함, UPDATE)·지우기(DELETE): 교사이면서 (쓴 사람 = 나  또는  총괄). using · with check 모두 같은 조건.
--   · 쓴 사람이 비어 있는(null) 과제·글(SQL Editor 로 만든 것 등)은 총괄만 고치고 지울 수 있다(아래 확인 쿼리 2).
--   · 고치기 열 권한을 화면이 실제로 보내는 열로 좁힌다 → 쓴 사람(created_by · author_id)·id·만든 시각은 아무도(총괄 포함)
--     화면·API 로 바꿀 수 없다(SQL Editor 만). 새로 만들기(INSERT)·지우기·읽기 권한은 그대로.
--       assignments: title, description_md, due_at, published                                  (src/lib/learning.ts)
--       posts      : slug, title, summary, content_md, cover_url, tags, published, published_at (src/app/admin/write · posts)
--     ⚠ 나중에 화면에서 다른 열을 고치게 되면 3절 grant 목록에도 더해야 한다(안 더하면 저장 때 "permission denied").
--     (updated_at 은 트리거가 채우므로 권한이 필요 없다.)
--   · 정책 이름(모두 63바이트 안 — 가장 긴 것 46바이트):
--       assignments "관리자만 작성/수정/삭제"(for all 1개) → "교사 본인 이름으로 작성" · "쓴 교사·총괄만 수정" · "쓴 교사·총괄만 삭제"
--       posts       "관리자만 작성" · "관리자만 수정" · "관리자만 삭제"  → 같은 이름 3개
--     대상 역할(to …)은 원래 정의 그대로(assignments = authenticated, posts = 지정 없음). 바뀌는 것은 조건뿐.
--   · 옛 assignments 정책(for all)은 읽기에도 걸려 있었지만 조건이 is_admin() 이라, 남는 읽기 정책
--     "공개된 것은 누구나, 관리자는 전체 조회"(published or is_admin())와 같은 범위다 → 교사는 지금처럼 비공개 과제도 모두 본다.
--     (맨 앞 점검이 그 읽기 정책이 있는지 먼저 확인한다.)
--   · 재귀(42P17) 없음: 새 정책이 부르는 is_admin() · is_super_admin() 은 security definer 로 profiles 만 읽는다.
--   · 바꾸지 않는 것: 두 표의 읽기 정책, 과제 제출물 · 글 읽음 기록 정책(③ — 그 학생의 담임만), 댓글 · 좋아요 · 조회수,
--     칭찬 문구, 자유게시판 · 학습게임(개정 1-5 — 그대로 교사 누구나). 자세한 목록은 보고서.
--
-- ▶ 실행 순서
--   이미 적용된 것: ① 20260927000000_classes_schema.sql · ② setup-owl-class.sql · ③ 20260927010000_classes_rls.sql
--                   · ④ 20260927020000_class_notices.sql · Edge Function 3개 재배포 · 화면 push
--   → 이 파일(20260927030000_content_owner_only.sql) → 아래 확인 쿼리 → 사이트(관리자 화면) push.
--     화면은 이 파일 없이도 안전하다(남의 과제·글 버튼을 끄는 쪽이라 더 좁을 뿐). Edge Function 은 바뀌지 않는다.
--   ⚠ 이 파일을 적용한 뒤 20260921000000_init_blog.sql · 20260921020000_admin_learning.sql 을 다시 실행하지 않는다 —
--     옛 정책(교사 누구나)이 되살아나 소리 없이 다시 넓어진다(허용 정책끼리는 OR 로 합쳐진다). 되돌리기는 아래 "되돌리기"로.
--
-- ▶ 실행 방법
--   Supabase 대시보드 > SQL Editor > New query 에 이 파일 전체를 붙여넣고 Run.
--   SQL Editor 는 붙여 넣은 전체를 한 트랜잭션으로 실행하므로 중간에 오류가 나면 아무것도 바뀌지 않는다.
--   (psql 등 다른 도구로 실행할 때는 psql -1 -v ON_ERROR_STOP=1 -f <파일> 처럼 "한 트랜잭션 + 오류 시 멈춤"으로.)
--   · "destructive operation(drop)" 확인 창이 뜨면 Run — 정책만 지우고 곧바로 다시 만든다. 표·데이터는 하나도 지우지 않는다.
--   · 맨 앞 점검: ①(is_super_admin())이 없거나, 총괄이 없거나, 교사가 두 표를 모두 읽는 읽기 정책이 없으면
--     오류를 내고 아무것도 바꾸지 않는다.
--   · 맨 끝 점검: 이 파일이 만든 쓰기 정책 6개 말고 다른 허용 쓰기 정책이 남아 있거나(옛 정책 등), 쓴 사람 열을 바꿀 수 있거나,
--     화면이 고치는 열의 권한이 빠졌으면 오류를 내고 전부 되돌린다.
--   · 여러 번 실행해도 안전하다(drop policy if exists + create policy, revoke/grant).
--   · 성공하면 "✔ 과제·블로그 글은 쓴 선생님과 총괄만 …" 알림이 나온다.
--
-- ▶ 실행 후 확인 쿼리(앞의 "-- "를 지우고 한 덩어리씩 Run)
--   -- 1) 두 표의 정책 — 표마다 4개: 읽기 1개(그대로) + 이 파일의 작성 · 수정 · 삭제 3개.
--   --    수정 · 삭제의 qual(과 수정의 with_check)에 is_super_admin() 과 auth.uid() 가 함께 보여야 한다.
--   --    (과제 읽기 정책 이름은 처음 만들 때 67바이트라 63바이트로 잘려 "…관리자는 전체 " 처럼 보인다 — 정상, 이 파일은 건드리지 않는다.)
--   select tablename, policyname, cmd, roles, qual, with_check from pg_policies
--   where schemaname = 'public' and tablename in ('assignments', 'posts')
--   order by tablename, cmd, policyname;
--
--   -- 2) 쓴 사람이 비어 있는(null) 행 수 — 이 행들은 이제 총괄만 고치고 지울 수 있다(0이면 해당 없음)
--   select (select count(*) from public.assignments where created_by is null) as 과제_쓴사람없음,
--          (select count(*) from public.assignments)                          as 과제_전체,
--          (select count(*) from public.posts where author_id is null)        as 글_쓴사람없음,
--          (select count(*) from public.posts)                                as 글_전체;
--
--   -- 3) 쓴 사람별 과제 · 글 수(누가 어느 것을 고칠 수 있는지 — 총괄은 모두). 쓴_사람_id 는 5) · 6) 흉내에 쓴다.
--   select '과제'::text as 종류, coalesce(p.display_name, '(쓴 사람 없음)') as 쓴_사람, p.id as 쓴_사람_id,
--          p.role, p.is_super_admin as 총괄, count(*) as 수
--   from public.assignments a left join public.profiles p on p.id = a.created_by
--   group by p.id, p.display_name, p.role, p.is_super_admin
--   union all
--   select '글'::text, coalesce(p.display_name, '(쓴 사람 없음)'), p.id, p.role, p.is_super_admin, count(*)
--   from public.posts b left join public.profiles p on p.id = b.author_id
--   group by p.id, p.display_name, p.role, p.is_super_admin
--   order by 1, 2;
--
--   -- 4) 열 권한 — 앞 2개 false(쓴 사람은 아무도 못 바꿈), 뒤 3개 true(화면이 고치는 열 · 새로 만들기)
--   select has_column_privilege('authenticated', 'public.assignments', 'created_by', 'UPDATE') as 과제_쓴사람_바꾸기,
--          has_column_privilege('authenticated', 'public.posts', 'author_id', 'UPDATE')       as 글_쓴사람_바꾸기,
--          has_column_privilege('authenticated', 'public.assignments', 'published', 'UPDATE') as 과제_공개전환,
--          has_column_privilege('authenticated', 'public.posts', 'content_md', 'UPDATE')      as 글_본문_고치기,
--          has_table_privilege('authenticated', 'public.assignments', 'INSERT')               as 과제_새로_만들기;
--
--   ※ 5) · 6) 흉내 내기는 ③ 파일과 같은 방식이다: "한 번의 Run = 한 트랜잭션"(set local role · set_config(…, true)는 그 Run 안에서만).
--     <…> 자리는 교사 id 로 바꾼다(select id, display_name, role, is_super_admin from public.profiles where role = 'admin'; — 그냥 Run).
--     ⚠ 두 블록은 결과와 상관없이 **언제나 오류(메시지)로 끝나** 고친 것 · 지운 것이 하나도 저장되지 않는다(시험용).
--       메시지 첫 글자가 ✔ 면 정상, ✖ 면 이 메시지를 알려 주세요. 블록은 반드시 **통째로** Run 한다(일부 줄만 실행하지 않는다).
--
--   -- 5) 총괄 흉내(지금 바로 가능) — 총괄은 모든 과제 · 글을 고칠 수 있어야 한다(고칠 수 있는 수 = 전체 수)
--   set local role authenticated;
--   select set_config('request.jwt.claims', '{"sub":"<총괄 id>","role":"authenticated"}', true);
--   do $$
--   declare a_all int; a_upd int; p_all int; p_upd int;
--   begin
--     select count(*) into a_all from public.assignments;
--     select count(*) into p_all from public.posts;
--     update public.assignments set title = title where current_user = 'authenticated';
--     get diagnostics a_upd = row_count;
--     update public.posts set title = title where current_user = 'authenticated';
--     get diagnostics p_upd = row_count;
--     raise exception '% 총괄이 고칠 수 있는 과제 %/%개 · 글 %/%개(앞뒤가 같으면 정상, 총괄=%) — 시험이라 일부러 오류로 끝냅니다(아무것도 바뀌지 않음).',
--       case when a_upd = a_all and p_upd = p_all and public.is_super_admin() then '✔' else '✖' end,
--       a_upd, a_all, p_upd, p_all, public.is_super_admin();
--   end $$;
--
--   -- 6) 다른 교사 흉내(두 번째 교사가 생긴 뒤) — 남의 과제 · 글은 고치기 · 지우기 모두 0행, 내 것은 모두 고칠 수 있어야 한다
--   ※ 5)·6)의 update·delete 줄에는 `current_user = 'authenticated'` 조건이 있어, 그 줄만 골라 실행해도(관리자 권한) 아무 행도 바뀌지 않는다(Review owner-only L1).
--   set local role authenticated;
--   select set_config('request.jwt.claims', '{"sub":"<총괄이 아닌 교사 id>","role":"authenticated"}', true);
--   do $$
--   declare a_upd int; a_del int; p_upd int; p_del int; mine int; mine_upd int;
--   begin
--     if not public.is_admin() or public.is_super_admin() then
--       raise exception '✖ 흉내 낸 계정이 "총괄이 아닌 교사"가 아닙니다 — id 를 확인해 주세요(아무것도 바뀌지 않음).';
--     end if;
--     update public.assignments set title = title where created_by is distinct from auth.uid() and current_user = 'authenticated';
--     get diagnostics a_upd = row_count;
--     delete from public.assignments where created_by is distinct from auth.uid() and current_user = 'authenticated';
--     get diagnostics a_del = row_count;
--     update public.posts set title = title where author_id is distinct from auth.uid() and current_user = 'authenticated';
--     get diagnostics p_upd = row_count;
--     delete from public.posts where author_id is distinct from auth.uid() and current_user = 'authenticated';
--     get diagnostics p_del = row_count;
--     select count(*) into mine from public.assignments where created_by = auth.uid();
--     update public.assignments set title = title where created_by = auth.uid() and current_user = 'authenticated';
--     get diagnostics mine_upd = row_count;
--     raise exception '% 남의 과제 수정 %행 · 삭제 %행, 남의 글 수정 %행 · 삭제 %행(모두 0이면 정상) / 내 과제 고치기 %/%개 — 시험이라 일부러 오류로 끝냅니다(아무것도 바뀌지 않음).',
--       case when a_upd + a_del + p_upd + p_del = 0 and mine_upd = mine then '✔' else '✖' end,
--       a_upd, a_del, p_upd, p_del, mine_upd, mine;
--   end $$;
--
-- ▶ 되돌리기(비상용 — 이 파일 이전 상태 = 교사 누구나 모든 과제 · 글을 고치고 지움). 아래 블록의 "-- "를 지우고 통째로 Run.
--   ⚠ ⑥(20260927040000_class_assignments.sql)을 이미 적용했다면 **⑥의 되돌리기를 먼저** 실행한 뒤 이 되돌리기를 한다(Review class-assignments L4).
--   옛 정의는 20260921020000_admin_learning.sql(244~249행) · 20260921000000_init_blog.sql(117~128행)을 글자 그대로 옮겼다.
--   표 권한은 Supabase 기본값(표 전체 UPDATE — 이 파일 전과 같음)으로. 되돌린 뒤 다시 좁히려면 이 파일 전체를 다시 Run.
--   drop policy if exists "assignments: 교사 본인 이름으로 작성" on public.assignments;
--   drop policy if exists "assignments: 쓴 교사·총괄만 수정" on public.assignments;
--   drop policy if exists "assignments: 쓴 교사·총괄만 삭제" on public.assignments;
--   drop policy if exists "assignments: 관리자만 작성/수정/삭제" on public.assignments;
--   create policy "assignments: 관리자만 작성/수정/삭제"
--     on public.assignments for all
--     to authenticated
--     using (public.is_admin())
--     with check (public.is_admin());
--   drop policy if exists "posts: 교사 본인 이름으로 작성" on public.posts;
--   drop policy if exists "posts: 쓴 교사·총괄만 수정" on public.posts;
--   drop policy if exists "posts: 쓴 교사·총괄만 삭제" on public.posts;
--   drop policy if exists "posts: 관리자만 작성" on public.posts;
--   drop policy if exists "posts: 관리자만 수정" on public.posts;
--   drop policy if exists "posts: 관리자만 삭제" on public.posts;
--   create policy "posts: 관리자만 작성"
--     on public.posts for insert
--     with check (public.is_admin());
--   create policy "posts: 관리자만 수정"
--     on public.posts for update
--     using (public.is_admin())
--     with check (public.is_admin());
--   create policy "posts: 관리자만 삭제"
--     on public.posts for delete
--     using (public.is_admin());
--   grant update on public.assignments to anon, authenticated;
--   grant update on public.posts to anon, authenticated;
--   notify pgrst, 'reload schema';

-- ═════════════════════════════════════════════
-- 0. 맨 앞 점검 — 앞 단계가 안 됐거나 지금 상태가 예상과 다르면 아무것도 바꾸지 않는다
-- ═════════════════════════════════════════════
do $$
begin
  if to_regprocedure('public.is_admin()') is null
     or to_regprocedure('public.is_super_admin()') is null
     or not exists (
       select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'profiles' and column_name = 'is_super_admin'
     ) then
    raise exception '먼저 ① 20260927000000_classes_schema.sql 을 실행해 주세요(is_super_admin() 이 없습니다). 이 파일은 아무것도 바꾸지 않았습니다.';
  end if;

  if to_regclass('public.assignments') is null or to_regclass('public.posts') is null then
    raise exception '과제(assignments) · 블로그 글(posts) 표가 없습니다 — 앞선 마이그레이션(20260921000000 · 20260921020000)을 먼저 실행해 주세요. 이 파일은 아무것도 바꾸지 않았습니다.';
  end if;

  -- 총괄이 없으면 남의 과제 · 글과 쓴 사람이 비어 있는 과제 · 글을 아무도 고치거나 지울 수 없게 된다(③과 같은 잠김 방지).
  if not exists (select 1 from public.profiles where is_super_admin and role = 'admin') then
    raise exception '총괄 관리자가 아직 없습니다(② docs/classes/setup-owl-class.sql). 총괄 없이 적용하면 쓴 사람이 비어 있는 과제 · 글을 아무도 고칠 수 없게 됩니다. 이 파일은 아무것도 바꾸지 않았습니다.';
  end if;

  -- 교사가 비공개 과제 · 초안 글을 계속 찾아 고치려면(고치기 · 지우기도 먼저 행을 읽는다) 관리자 전체 조회 읽기 정책이 있어야 한다.
  -- 과제는 지금 "관리자만 작성/수정/삭제"(for all)도 읽기를 허용하므로, 그것을 지우기 전에 남는 읽기 정책을 확인한다.
  -- (이름이 아니라 내용으로 찾는다 — 과제 읽기 정책 이름은 67바이트라 저장 때 잘려 있다.)
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'assignments' and cmd = 'SELECT' and permissive = 'PERMISSIVE'
      and position('is_admin()' in coalesce(qual, '')) > 0
  ) then
    raise exception 'assignments 에 "관리자는 전체 조회" 읽기 정책이 없습니다(교사가 비공개 과제를 못 보게 됨). 이 파일은 아무것도 바꾸지 않았습니다 — 이 메시지를 알려 주세요.';
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'posts' and cmd = 'SELECT' and permissive = 'PERMISSIVE'
      and position('is_admin()' in coalesce(qual, '')) > 0
  ) then
    raise exception 'posts 에 "관리자는 전체 조회" 읽기 정책이 없습니다(교사가 초안 글을 못 보게 됨). 이 파일은 아무것도 바꾸지 않았습니다 — 이 메시지를 알려 주세요.';
  end if;
end $$;

-- ═════════════════════════════════════════════
-- 1. assignments(과제) — 20260921020000_admin_learning.sql 244~249행의 for all 정책 1개를 명령별 3개로
--    옛 정의: to authenticated · using (public.is_admin()) · with check (public.is_admin())
--    새 정의: 대상 역할 그대로, 조건만 "교사이면서 (쓴 사람 = 나 또는 총괄)" — 새로 만들기는 "교사이면서 쓴 사람 = 나"
-- ═════════════════════════════════════════════
drop policy if exists "assignments: 관리자만 작성/수정/삭제" on public.assignments;

drop policy if exists "assignments: 교사 본인 이름으로 작성" on public.assignments;
create policy "assignments: 교사 본인 이름으로 작성"
  on public.assignments for insert
  to authenticated
  with check (public.is_admin() and created_by = auth.uid());

drop policy if exists "assignments: 쓴 교사·총괄만 수정" on public.assignments;
create policy "assignments: 쓴 교사·총괄만 수정"
  on public.assignments for update
  to authenticated
  using (public.is_admin() and (created_by = auth.uid() or public.is_super_admin()))
  with check (public.is_admin() and (created_by = auth.uid() or public.is_super_admin()));

drop policy if exists "assignments: 쓴 교사·총괄만 삭제" on public.assignments;
create policy "assignments: 쓴 교사·총괄만 삭제"
  on public.assignments for delete
  to authenticated
  using (public.is_admin() and (created_by = auth.uid() or public.is_super_admin()));

-- ═════════════════════════════════════════════
-- 2. posts(블로그 글) — 20260921000000_init_blog.sql 117~128행의 정책 3개
--    옛 정의: 대상 역할 지정 없음 · insert with check (public.is_admin()) · update using/with check (public.is_admin())
--             · delete using (public.is_admin())
--    새 정의: 대상 역할 그대로(지정 없음), 조건만 assignments 와 같게(쓴 사람 열 = author_id)
-- ═════════════════════════════════════════════
drop policy if exists "posts: 관리자만 작성" on public.posts;
drop policy if exists "posts: 관리자만 수정" on public.posts;
drop policy if exists "posts: 관리자만 삭제" on public.posts;

drop policy if exists "posts: 교사 본인 이름으로 작성" on public.posts;
create policy "posts: 교사 본인 이름으로 작성"
  on public.posts for insert
  with check (public.is_admin() and author_id = auth.uid());

drop policy if exists "posts: 쓴 교사·총괄만 수정" on public.posts;
create policy "posts: 쓴 교사·총괄만 수정"
  on public.posts for update
  using (public.is_admin() and (author_id = auth.uid() or public.is_super_admin()))
  with check (public.is_admin() and (author_id = auth.uid() or public.is_super_admin()));

drop policy if exists "posts: 쓴 교사·총괄만 삭제" on public.posts;
create policy "posts: 쓴 교사·총괄만 삭제"
  on public.posts for delete
  using (public.is_admin() and (author_id = auth.uid() or public.is_super_admin()));

-- ═════════════════════════════════════════════
-- 3. 고치기 열 권한 — 쓴 사람(created_by · author_id)을 아무도 바꾸지 못하게
--    with check 만으로도 총괄이 아닌 교사는 쓴 사람을 남 · 빈 값으로 바꿀 수 없지만(새 행의 쓴 사람 = 나여야 통과),
--    총괄은 조건을 통과하므로 열 권한으로 막는다 → "쓴 사람"은 만들 때(기본값 auth.uid()) 정해지고 그 뒤로 바뀌지 않는다.
--    표 단위 revoke 는 열 단위 권한도 함께 거둔다 → 아래 grant 목록이 정확히 남는다(재실행해도 같은 결과).
--    열 목록 = 화면이 실제로 보내는 열(src/lib/learning.ts updateAssignment, src/app/admin/write/post-editor.tsx,
--    src/app/admin/(dashboard)/posts/admin-post-list.tsx). updated_at 은 트리거(set_updated_at)가 채운다(권한 불필요).
--    service_role(Edge Function · 대시보드)은 건드리지 않는다.
-- ═════════════════════════════════════════════
revoke update on public.assignments from anon, authenticated;
grant update (title, description_md, due_at, published) on public.assignments to authenticated;

revoke update on public.posts from anon, authenticated;
grant update (slug, title, summary, content_md, cover_url, tags, published, published_at) on public.posts to authenticated;

-- ═════════════════════════════════════════════
-- 4. 맨 끝 점검 — 설계와 다르면 전부 되돌린다(아무것도 바뀌지 않음)
--    허용(PERMISSIVE) 정책끼리는 OR 로 합쳐지므로, 모르는 허용 쓰기 정책이 하나라도 붙어 있으면 좁히기가 소리 없이 무효가 된다.
-- ═════════════════════════════════════════════
do $$
declare
  v_missing text;
  v_extra   text;
  v_cond    text;
begin
  if not (select c.relrowsecurity from pg_class c where c.oid = 'public.assignments'::regclass)
     or not (select c.relrowsecurity from pg_class c where c.oid = 'public.posts'::regclass) then
    raise exception 'assignments 또는 posts 의 RLS 가 꺼져 있습니다. 이 파일 전체를 되돌렸습니다(아무것도 바뀌지 않음) — 이 메시지를 알려 주세요.';
  end if;

  -- 4-1. 이 파일의 쓰기 정책 6개가 이름 · 명령 그대로 있는지
  select string_agg(format('%s (%s)', e.p, e.c), ', ') into v_missing
  from (values
    ('assignments', 'assignments: 교사 본인 이름으로 작성', 'INSERT'),
    ('assignments', 'assignments: 쓴 교사·총괄만 수정', 'UPDATE'),
    ('assignments', 'assignments: 쓴 교사·총괄만 삭제', 'DELETE'),
    ('posts', 'posts: 교사 본인 이름으로 작성', 'INSERT'),
    ('posts', 'posts: 쓴 교사·총괄만 수정', 'UPDATE'),
    ('posts', 'posts: 쓴 교사·총괄만 삭제', 'DELETE')
  ) as e(t, p, c)
  where not exists (
    select 1 from pg_policies pp
    where pp.schemaname = 'public' and pp.tablename = e.t and pp.policyname = e.p and pp.cmd = e.c
      and pp.permissive = 'PERMISSIVE'
  );
  if v_missing is not null then
    raise exception '만들어야 할 정책이 없습니다: %. 이 파일 전체를 되돌렸습니다(아무것도 바뀌지 않음) — 이 메시지를 알려 주세요.', v_missing;
  end if;

  -- 4-2. 그 밖의 허용 쓰기 정책(INSERT · UPDATE · DELETE · ALL)이 남아 있지 않은지(옛 이름 · 대시보드에서 만든 정책 등)
  select string_agg(format('%s / %s (%s)', pp.tablename, pp.policyname, pp.cmd), ', ' order by pp.tablename, pp.policyname)
    into v_extra
  from pg_policies pp
  where pp.schemaname = 'public'
    and pp.tablename in ('assignments', 'posts')
    and pp.cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
    and pp.permissive = 'PERMISSIVE'
    and pp.policyname not in (
      'assignments: 교사 본인 이름으로 작성', 'assignments: 쓴 교사·총괄만 수정', 'assignments: 쓴 교사·총괄만 삭제',
      'posts: 교사 본인 이름으로 작성', 'posts: 쓴 교사·총괄만 수정', 'posts: 쓴 교사·총괄만 삭제'
    );
  if v_extra is not null then
    raise exception '과제 · 블로그 글에 이 파일이 모르는 쓰기 정책이 남아 있습니다: %. 이 파일 전체를 되돌렸습니다(아무것도 바뀌지 않음) — 이 메시지를 알려 주세요.', v_extra;
  end if;

  -- 4-3. 조건 글자 점검(4-2 뒤라 남은 허용 쓰기 정책 = 이 파일의 6개): 모두 is_admin() 과 쓴 사람 = auth.uid(),
  --      수정 · 삭제는 is_super_admin() 도(수정은 using · with check 둘 다). 'uid()' 로 찾는다 — 표시 방식에 따라
  --      auth.uid() 앞의 스키마 이름이 빠질 수 있다(is_admin() 도 public. 이 붙거나 빠질 수 있어 이름 뒷부분으로 찾는다).
  select string_agg(format('%s / %s', pp.tablename, pp.policyname), ', ') into v_cond
  from pg_policies pp
  where pp.schemaname = 'public'
    and pp.tablename in ('assignments', 'posts')
    and pp.cmd in ('INSERT', 'UPDATE', 'DELETE')
    and pp.permissive = 'PERMISSIVE'
    and not (
      position('is_admin()' in coalesce(pp.qual, '') || coalesce(pp.with_check, '')) > 0
      and position('uid()' in coalesce(pp.qual, '') || coalesce(pp.with_check, '')) > 0
      and (pp.cmd = 'INSERT' or position('is_super_admin()' in coalesce(pp.qual, '')) > 0)
      and (pp.cmd <> 'UPDATE' or position('is_super_admin()' in coalesce(pp.with_check, '')) > 0)
    );
  if v_cond is not null then
    raise exception '정책 조건이 설계와 다릅니다: %. 이 파일 전체를 되돌렸습니다(아무것도 바뀌지 않음) — 이 메시지를 알려 주세요.', v_cond;
  end if;

  -- 4-4. 열 권한: 쓴 사람은 아무도 못 바꾸고(PUBLIC 권한 포함), 화면이 고치는 열은 그대로 고칠 수 있어야 한다
  if has_column_privilege('anon', 'public.assignments', 'created_by', 'UPDATE')
     or has_column_privilege('authenticated', 'public.assignments', 'created_by', 'UPDATE')
     or has_column_privilege('anon', 'public.posts', 'author_id', 'UPDATE')
     or has_column_privilege('authenticated', 'public.posts', 'author_id', 'UPDATE') then
    raise exception '쓴 사람 열(created_by · author_id)을 바꿀 수 있는 권한이 남아 있습니다(PUBLIC 권한 등). 이 파일 전체를 되돌렸습니다(아무것도 바뀌지 않음) — 이 메시지를 알려 주세요.';
  end if;
  if not (
    has_column_privilege('authenticated', 'public.assignments', 'title', 'UPDATE')
    and has_column_privilege('authenticated', 'public.assignments', 'description_md', 'UPDATE')
    and has_column_privilege('authenticated', 'public.assignments', 'due_at', 'UPDATE')
    and has_column_privilege('authenticated', 'public.assignments', 'published', 'UPDATE')
    and has_column_privilege('authenticated', 'public.posts', 'slug', 'UPDATE')
    and has_column_privilege('authenticated', 'public.posts', 'title', 'UPDATE')
    and has_column_privilege('authenticated', 'public.posts', 'summary', 'UPDATE')
    and has_column_privilege('authenticated', 'public.posts', 'content_md', 'UPDATE')
    and has_column_privilege('authenticated', 'public.posts', 'cover_url', 'UPDATE')
    and has_column_privilege('authenticated', 'public.posts', 'tags', 'UPDATE')
    and has_column_privilege('authenticated', 'public.posts', 'published', 'UPDATE')
    and has_column_privilege('authenticated', 'public.posts', 'published_at', 'UPDATE')
  ) then
    raise exception '화면이 고치는 열의 권한이 빠졌습니다(과제 저장 · 공개 전환이 막힘). 이 파일 전체를 되돌렸습니다(아무것도 바뀌지 않음) — 이 메시지를 알려 주세요.';
  end if;

  raise notice '✔ 과제 · 블로그 글은 이제 쓴 선생님과 총괄만 고치고(공개 전환 포함) 지울 수 있습니다. 새로 만들기는 교사 누구나(자기 이름으로), 읽기는 그대로입니다. 쓴 사람은 바뀌지 않습니다. 다음: 확인 쿼리 → 사이트 push.';
end $$;

-- PostgREST 가 바로 알도록(정책 · 권한은 캐시하지 않지만 다른 파일들과 같게 한 번 더)
notify pgrst, 'reload schema';
