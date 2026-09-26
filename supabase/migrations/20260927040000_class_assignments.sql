-- 과제도 학급별로 ⑥ — assignments.class_id(학급) + 과제 읽기·만들기 정책 (2026-09-26 사용자 결정)
-- 사용자: "1번으로 과제도 학급별로 나눠줘" — 설계: docs/classes/spec.md 끝의 "개정 3"(3-2)
-- 지침: docs/classes/build-class-assignments-instructions.md · 보고: docs/classes/build-class-assignments-report.md
--
-- ▶ 왜
--   지금은 과제 하나를 모든 학급이 함께 쓴다(학생은 모든 공개 과제를 보고 낸다). 과제를 지우면 그 과제의 제출물이
--   반과 상관없이 외래키 연쇄 삭제(assignment_submissions.assignment_id … on delete cascade)로 함께 사라진다
--   (⑤ 보고서 8절 "남은 위험"). 과제를 학급에 묶으면 학생은 자기 학급 과제만 보고 내며, 과제를 지워도 그 학급 제출물만 지워진다.
--
-- ▶ 무엇이 바뀌나 — assignments 표 하나(제출물 표의 정책·함수·트리거는 고치지 않는다)
--   1. 새 열 class_id uuid(학급, 필수) → public.classes(id).
--      · 학급을 지우려 하면 거부한다(on delete restrict). 까닭: cascade 면 과제와 그 제출물(학생 기록)까지 지워지고,
--        set null 은 not null 과 부딪힌다. 학급은 원래 지우지 않고 보관(archived_at)만 한다(①) — 이 외래키는 실수로
--        학급 행을 지울 때 학생 기록이 사라지는 것을 막는 안전장치다.
--      · 지금 과제 채우기(학급이 비어 있는 행만 — 다시 실행해도 이미 정한 학급은 바꾸지 않음):
--          (가) 만든 선생님(created_by)이 담임인 학급 — 여럿이면 가장 먼저 연결된 것(class_teachers.created_at, 같으면 id 순)
--          (나) (가)로 못 정한 과제(만든 사람 없음 · 학급이 없는 교사 · 담임에서 해제된 교사가 만든 것)
--               → 총괄이 담임인 학급(부엉이반 — 총괄의 학급 중 가장 먼저 연결된 것)
--          두 경우 모두 보관한(archived_at) 학급은 고르지 않는다 — 보관한 학급은 학생이 없는 학급이라(③ 담임 해제),
--          그리로 가면 과제가 어느 학생에게도, 어느 목록에도 보이지 않게 된다.
--        다 채운 뒤 not null. 못 채운 과제가 있으면 멈춘다(아무것도 바뀌지 않음).
--        ※ 채울 때 과제의 updated_at(수정 시각)이 실행 시각으로 바뀐다(기존 트리거) — 화면 어디에도 보이지 않는 값이다.
--      · 인덱스 (class_id, created_at desc) — 관리자 화면이 학급별 최신순으로 읽는다(외래키 확인에도 쓰인다).
--   2. 읽기(SELECT): 옛 정책 1개 "공개된 것은 누구나, 관리자는 전체 조회"(published or is_admin() — 20260923020000 원문,
--      이름 67바이트라 저장 때 "…관리자는 전체 "로 잘려 있다)를 지우고 역할별 2개로 나눈다(둘 다 to authenticated):
--        · "assignments: 학생은 자기 학급 공개 과제 조회"
--            published and (select can_browse()) and class_id = (select my_student_class_id())
--        · "assignments: 교사는 자기 학급·자기 과제 조회"
--            is_admin() and (class_id = any (my_class_ids()) or created_by = auth.uid() or is_super_admin())
--            → 담임: 자기 학급 과제 + 자기가 만든 과제(학급을 넘겨준 뒤에도 자기 과제는 읽히고 ⑤대로 고칠 수 있다 —
--               화면 목록은 학급 범위라 그런 과제는 제출 현황 주소로 연다)
--            → 총괄: 모든 과제(⑤ "총괄은 누구의 과제든 고치고 지울 수 있음"과 맞춤 — 고치려면 먼저 읽혀야 한다).
--               화면 목록은 학급 범위(내 학급)로만 읽는다. 총괄도 다른 학급 학생의 제출물은 못 본다(③ 그대로).
--        · 비로그인(anon): 정책이 없어 0행(과제는 반 학생용 — 개정 3-2 "비로그인 = 없음"). 표 권한은 그대로라 오류가 아니라 빈 목록.
--        두 정책으로 나눈 까닭: 역할마다 조건이 달라(학생은 공개 과제만·학급 1개, 교사는 비공개 포함·학급 여럿)
--        한 식으로 합치면 괄호가 깊어져 읽기·검토가 어렵다. 허용 정책끼리는 OR 로 합쳐지므로 결과는 한 정책과 같고,
--        두 식은 서로 겹치지 않는다(교사는 my_student_class_id() = null, 학생은 is_admin() = false).
--   3. 만들기(INSERT): ⑤의 "assignments: 교사 본인 이름으로 작성"을 지우고
--        · "assignments: 본인 이름으로 자기 학급에 작성" — is_admin() and created_by = auth.uid() and class_id = any (my_class_ids())
--          (총괄도 자기 학급에만. 학급 없이(class_id 빈 값) 만들면 not null 오류.)
--        이름을 바꾼 까닭: 이 파일 뒤에 ⑤를 실수로 다시 실행하면 ⑤의 맨 끝 점검이 이 정책을 "모르는 쓰기 정책"으로 보고
--        ⑤ 전체를 되돌린다 → 학급 조건 없는 옛 작성 정책이 소리 없이 되살아나지 않는다.
--   4. 그대로: ⑤의 고치기·지우기 정책(쓴 교사 또는 총괄), ⑤의 고치기 열 권한(title, description_md, due_at, published).
--      class_id 는 그 목록에 없으므로 만든 뒤에는 아무도(총괄 포함) 화면·API 로 학급을 바꿀 수 없다(SQL Editor 만).
--   5. 제출(assignment_submissions)은 고치지 않는다: "본인이 공개 과제에 제출"(20260921020000)은
--      exists (select 1 from public.assignments a where a.id = assignment_id and a.published) 로 과제를 확인하는데,
--      정책 안의 하위 쿼리에도 assignments 의 읽기 정책(2)이 걸린다 → 학생은 자기 학급 공개 과제에만 낼 수 있게 저절로 좁아진다
--      (다른 학급 과제에 내면 42501 "new row violates row-level security policy"). 학생이 자기 제출물을 지우는 조건
--      (③ "본인 또는 담임 삭제"의 과제 하위 쿼리)도 같은 방식으로 자기 학급 과제로 좁아진다. 맨 끝 점검이 이 전제를 확인한다.
--   · 재귀(42P17) 없음: 새 정책이 부르는 is_admin() · my_class_ids() · is_super_admin() · my_student_class_id() · can_browse()는
--     모두 security definer 로 profiles · class_teachers · site_settings 만 읽는다. 어느 것도 assignments 를 읽지 않고,
--     assignments 정책은 assignment_submissions 를 읽지 않는다(제출물 정책 → assignments 한 방향뿐).
--   · 배열 비교는 `class_id = any (public.my_class_ids())` 로 쓴다 — `any ((select …))` 처럼 괄호를 겹치면 42883 오류(④ 첫 실행 실패).
--   · 정책 이름(모두 63바이트 안): 학생 조회 57 · 교사 조회 58 · 작성 56바이트.
--
-- ▶ 실행 순서
--   이미 적용된 것: ① 20260927000000_classes_schema.sql · ② setup-owl-class.sql · ③ 20260927010000_classes_rls.sql
--                   · ④ 20260927020000_class_notices.sql · Edge Function 3개 재배포 · 화면 push
--   → ⑤ 20260927030000_content_owner_only.sql (먼저 — 이 파일은 ⑤가 없으면 아무것도 바꾸지 않고 멈춘다)
--   → ⑥ 이 파일 → 아래 확인 쿼리 → 사이트(관리자 과제 화면) push.
--   · 이 파일을 실행한 뒤 사이트를 push 하기 전까지는 예전 관리자 화면에서 "새 과제"가 저장되지 않는다
--     (학급 없이 만들려 해서 not null 오류 — "과제를 저장하지 못했습니다."). 확인 쿼리 뒤 바로 push 한다.
--     (새 화면은 이 파일 전에도 깨지지 않는다 — 예전처럼 동작하고 과제 관리에 "SQL 실행 필요" 안내가 나온다.)
--   · Edge Function 은 바뀌지 않는다(재배포 필요 없음). 학생 화면·과학 앱 코드도 그대로다(RLS 가 자기 학급 과제만 돌려준다).
--   ⚠ 이 파일을 적용한 뒤 앞선 마이그레이션을 다시 실행하지 않는다. 특히 20260921020000_admin_learning.sql ·
--     20260923010000_login_required.sql · 20260923020000_login_required_scope.sql 은 옛 읽기 정책(published or is_admin())을
--     되살려 모든 학생이 모든 학급의 공개 과제를 다시 보게 된다(허용 정책끼리는 OR). 되돌리기는 아래 "되돌리기"로.
--
-- ▶ 실행 방법
--   Supabase 대시보드 > SQL Editor > New query 에 이 파일 전체를 붙여넣고 Run.
--   SQL Editor 는 붙여 넣은 전체를 한 트랜잭션으로 실행하므로 중간에 오류가 나면 아무것도 바뀌지 않는다.
--   (psql 등 다른 도구로 실행할 때는 psql -1 -v ON_ERROR_STOP=1 -f <파일> 처럼 "한 트랜잭션 + 오류 시 멈춤"으로.)
--   · "destructive operation(drop)" 확인 창이 뜨면 Run — 정책만 지우고 곧바로 다시 만든다. 표·데이터는 지우지 않는다.
--   · 옛 읽기 정책 이름은 67바이트라 drop 할 때 "identifier … will be truncated" 알림이 나온다 — 정상
--     (Postgres 가 처음 만들 때와 같은 방식으로 잘라 저장된 이름과 맞춘다).
--   · 맨 앞 점검: ①(학급 표·my_class_ids()) · ④(my_student_class_id()) · ⑤(쓴 교사·총괄만 정책과 열 권한) · 총괄 중
--     하나라도 없으면 오류를 내고 아무것도 바꾸지 않는다.
--   · 맨 끝 점검: 열·외래키·정책 5개(이름·명령·대상 역할·조건)·열 권한·제출 정책 전제가 설계와 다르면 오류를 내고 전부 되돌린다.
--   · 여러 번 실행해도 안전하다(add column if not exists · 빈 학급만 채움 · drop policy if exists + create policy).
--   · 성공하면 "✔ 과제를 학급별로 나눴습니다 …" 알림이 나온다(학급별 과제 수 포함).
--
-- ▶ 실행 후 확인 쿼리(앞의 "-- "를 지우고 한 덩어리씩 Run)
--   -- 0) (그냥 Run = postgres 권한) 학급별 과제와 흉내 낼 id — 학급_id · 과제_id 는 4)~8)에 쓴다
--   select c.name as 학급, c.id as 학급_id, a.id as 과제_id, a.title as 과제, a.published as 공개,
--          coalesce(p.display_name, '(만든 사람 없음)') as 만든_선생님
--   from public.assignments a
--   join public.classes c on c.id = a.class_id
--   left join public.profiles p on p.id = a.created_by
--   order by c.name, a.created_at;
--   select p.id, p.display_name, p.role, p.is_super_admin, c.name as 학급
--   from public.profiles p left join public.classes c on c.id = p.class_id
--   order by p.role, c.name nulls first, p.display_name limit 200;
--
--   -- 1) 학급 없는 과제 0 · 전체 과제 수 · 학급별 과제 수(보관한 학급 포함)
--   select (select count(*) from public.assignments where class_id is null) as 학급없는_과제,
--          (select count(*) from public.assignments)                        as 전체_과제;
--   select c.name as 학급, c.archived_at is not null as 보관, count(a.id) as 과제,
--          count(a.id) filter (where a.published) as 공개_과제
--   from public.classes c left join public.assignments a on a.class_id = c.id
--   group by c.id, c.name, c.archived_at order by c.name;
--   -- 과제의 학급과 다른 학급 학생이 (이 파일 전에, 과제를 함께 쓰던 때) 낸 제출물 수 — 보통 0
--   -- (학생이 모두 부엉이반이고 과제도 모두 부엉이반으로 갔으면 0. 0이 아니면: 그 제출물은 그 학생의 담임에게 그대로
--   --  보이지만, 그 학생 화면에는 과제가 더 이상 보이지 않고, 과제를 지우면 함께 지워진다 — 이 수를 알려 주세요.)
--   select count(*) as 다른_학급_학생_제출물
--   from public.assignment_submissions s
--   join public.assignments a on a.id = s.assignment_id
--   join public.profiles p on p.id = s.user_id
--   where p.role = 'user' and p.class_id is distinct from a.class_id;
--
--   -- 2) 과제 정책 5개: SELECT 2(학생 · 교사, roles {authenticated}) · INSERT 1 · UPDATE 1 · DELETE 1(⑤ 그대로)
--   select policyname, cmd, roles, qual, with_check from pg_policies
--   where schemaname = 'public' and tablename = 'assignments'
--   order by cmd, policyname;
--
--   -- 3) 열 권한 — 앞 2개 false(학급 · 만든 사람은 아무도 못 바꿈), 뒤 2개 true(새 과제에 학급 넣기 · 공개 전환)
--   select has_column_privilege('authenticated', 'public.assignments', 'class_id', 'UPDATE')   as 학급_바꾸기,
--          has_column_privilege('authenticated', 'public.assignments', 'created_by', 'UPDATE') as 만든사람_바꾸기,
--          has_column_privilege('authenticated', 'public.assignments', 'class_id', 'INSERT')   as 학급_넣어_만들기,
--          has_column_privilege('authenticated', 'public.assignments', 'published', 'UPDATE')  as 공개_전환;
--
--   ※ 4)~8) 흉내 내기는 ③ · ⑤ 파일과 같은 방식이다: "한 번의 Run = 한 트랜잭션"(set local role · set_config(…, true)는
--     그 Run 안에서만 적용되고 끝나면 저절로 풀린다). <…> 자리는 0)에서 찾은 id 로 바꾼다. 블록은 통째로 Run 한다.
--     결과의 "지금_역할" 칸이 anon / authenticated 여야 흉내가 된 것이다(postgres 면 숫자를 믿지 말 것).
--     do 블록은 결과와 상관없이 **아무것도 저장하지 않는다**(성공해도 일부러 오류로 끝내거나, 거부된 쓰기만 시험한다).
--     메시지 첫 글자가 ✔ 면 정상, ✖ 면 그 메시지를 알려 주세요.
--
--   -- 4) 비로그인 흉내 — 보이는_과제 0
--   set local role anon;
--   select current_user as 지금_역할, count(*) as 보이는_과제 from public.assignments;
--
--   -- 5) 학생 흉내(읽기) — 보이는_과제 = 0)에서 그 학생 학급의 "공개 = true" 과제 수, 다른_학급_과제 0, 비공개_과제 0
--   set local role authenticated;
--   select set_config('request.jwt.claims', '{"sub":"<학생 id>","role":"authenticated"}', true);
--   select current_user as 지금_역할, auth.uid() as 나, public.my_student_class_id() as 내_학급,
--          (select count(*) from public.assignments) as 보이는_과제,
--          (select count(*) from public.assignments
--            where class_id is distinct from public.my_student_class_id()) as 다른_학급_과제,
--          (select count(*) from public.assignments where not published) as 비공개_과제;
--
--   -- 6) 학생 흉내(제출) — 자기 학급 공개 과제에는 낼 수 있다. 블록은 결과와 상관없이 오류(메시지)로 끝나 아무것도 저장되지 않는다.
--   set local role authenticated;
--   select set_config('request.jwt.claims', '{"sub":"<학생 id>","role":"authenticated"}', true);
--   do $$
--   declare n int;
--   begin
--     if current_user <> 'authenticated' or public.my_student_class_id() is null then
--       raise exception '✖ 학생 흉내가 되지 않았습니다(지금 역할 %) — 위 두 줄과 함께 통째로 Run 해 주세요(아무것도 바뀌지 않음).', current_user;
--     end if;
--     insert into public.assignment_submissions (assignment_id, body_md)
--     select '<그 학생 학급의 공개 과제_id>'::uuid, '시험' where current_user = 'authenticated';
--     get diagnostics n = row_count;
--     raise exception '% 자기 학급 공개 과제에 낼 수 있습니다(%행) — 시험이라 일부러 오류로 끝냅니다(아무것도 저장되지 않음).',
--       case when n = 1 then '✔' else '✖' end, n;
--   exception
--     when unique_violation then
--       raise exception '✔ 이미 낸 과제라 새로 낼 수는 없지만(중복) 권한은 통과했습니다 — 아무것도 바뀌지 않았습니다.';
--     when insufficient_privilege then
--       raise exception '✖ 자기 학급 공개 과제에 내지 못했습니다(권한 거부) — 이 메시지를 알려 주세요(아무것도 바뀌지 않음).';
--   end $$;
--
--   -- 7) 학생 흉내(다른 학급 과제에 제출 — 두 번째 학급이 생긴 뒤) — "✔ … 낼 수 없습니다(정상)." 알림
--   --    과제 id 는 0)에서 찾은 "다른 학급의 공개 과제" id 를 정확히(없는 id 도 같은 거부가 나서 ✔ 로 보인다).
--   set local role authenticated;
--   select set_config('request.jwt.claims', '{"sub":"<학생 id>","role":"authenticated"}', true);
--   do $$
--   begin
--     if current_user <> 'authenticated' or public.my_student_class_id() is null then
--       raise exception '✖ 학생 흉내가 되지 않았습니다(지금 역할 %) — 위 두 줄과 함께 통째로 Run 해 주세요(아무것도 바뀌지 않음).', current_user;
--     end if;
--     insert into public.assignment_submissions (assignment_id, body_md)
--     select '<다른 학급의 공개 과제_id>'::uuid, '시험' where current_user = 'authenticated';
--     raise exception '✖ 학생이 다른 학급 과제에 냈습니다 — 이 메시지를 알려 주세요(시험 제출은 저장되지 않았습니다).';
--   exception when insufficient_privilege then
--     raise notice '✔ 학생은 다른 학급 과제에 낼 수 없습니다(정상).';
--   end $$;
--
--   -- 8) 다른 학급 담임 흉내(두 번째 담임이 생긴 뒤) — 첫 Run: 남의_학급_과제 0 / 둘째 Run: "✔ … 만들 수 없습니다(정상)."
--   set local role authenticated;
--   select set_config('request.jwt.claims', '{"sub":"<다른 학급 담임 id>","role":"authenticated"}', true);
--   select current_user as 지금_역할, public.my_class_ids() as 내_학급,
--          (select count(*) from public.assignments) as 보이는_과제,
--          (select count(*) from public.assignments
--            where not (class_id = any (public.my_class_ids())) and created_by is distinct from auth.uid()) as 남의_학급_과제;
--   -- (둘째 Run) 같은 두 줄(set local role · set_config) 다음에:
--   do $$
--   begin
--     if current_user <> 'authenticated' or not public.is_admin() then
--       raise exception '✖ 교사 흉내가 되지 않았습니다(지금 역할 %) — 두 줄과 함께 통째로 Run 해 주세요(아무것도 바뀌지 않음).', current_user;
--     end if;
--     insert into public.assignments (title, class_id)
--     select '시험', '<부엉이반 학급_id>'::uuid where current_user = 'authenticated';
--     raise exception '✖ 다른 학급 담임이 부엉이반에 과제를 만들었습니다 — 이 메시지를 알려 주세요(시험 과제는 저장되지 않았습니다).';
--   exception when insufficient_privilege then
--     raise notice '✔ 다른 학급 담임은 부엉이반에 과제를 만들 수 없습니다(정상).';
--   end $$;
--   ※ 6)~8)의 insert 줄에는 `where current_user = 'authenticated'` 조건이 있어, 그 줄만 골라 실행해도(관리자 권한) 아무 행도
--     생기지 않는다(⑤ Review L1 과 같은 안전장치).
--
--   -- 9) 총괄 흉내 — 보이는_과제 = 1)의 전체_과제(총괄은 모든 과제를 읽고 ⑤대로 고칠 수 있다), 내_학급 = {부엉이반 id}
--   set local role authenticated;
--   select set_config('request.jwt.claims', '{"sub":"<총괄 id>","role":"authenticated"}', true);
--   select current_user as 지금_역할, public.is_super_admin() as 총괄, public.my_class_ids() as 내_학급,
--          (select count(*) from public.assignments) as 보이는_과제;
--
-- ▶ 되돌리기(비상용 — 이 파일 이전 상태 = 모든 학생이 모든 공개 과제를 봄, 교사는 학급 없이 과제를 만듦).
--   아래 블록의 "-- "를 지우고 통째로 Run. 옛 정의는 20260923020000_login_required_scope.sql(4절)과 ⑤(1절)를 글자 그대로 옮겼다.
--   학급 열(class_id)과 채운 값은 남기고 "필수"만 푼다(예전 화면이 학급 없이 과제를 만들 수 있게). 다시 좁히려면 이 파일 전체를 다시 Run.
--   ⚠ ⑤까지 되돌려야 하면 **이 블록 먼저, 그다음 ⑤의 되돌리기**(⑤ 머리말의 되돌리기는 이 파일 전 상태를 전제로 한다 —
--     이 파일이 적용된 채로 ⑤의 되돌리기만 쓰면 이 파일의 작성 정책이 남고, ⑤의 옛 "관리자만 작성/수정/삭제"(for all)가
--     교사 읽기까지 모든 과제로 넓힌다 — Review owner-only R4).
--   drop policy if exists "assignments: 학생은 자기 학급 공개 과제 조회" on public.assignments;
--   drop policy if exists "assignments: 교사는 자기 학급·자기 과제 조회" on public.assignments;
--   drop policy if exists "assignments: 본인 이름으로 자기 학급에 작성" on public.assignments;
--   drop policy if exists "assignments: 공개된 것은 누구나, 관리자는 전체 조회" on public.assignments;
--   create policy "assignments: 공개된 것은 누구나, 관리자는 전체 조회"
--     on public.assignments for select
--     using (published or public.is_admin());
--   drop policy if exists "assignments: 교사 본인 이름으로 작성" on public.assignments;
--   create policy "assignments: 교사 본인 이름으로 작성"
--     on public.assignments for insert
--     to authenticated
--     with check (public.is_admin() and created_by = auth.uid());
--   alter table public.assignments alter column class_id drop not null;
--   notify pgrst, 'reload schema';

-- ═════════════════════════════════════════════
-- 0. 맨 앞 점검 — 앞 단계가 안 됐거나 지금 상태가 예상과 다르면 아무것도 바꾸지 않는다
-- ═════════════════════════════════════════════
do $$
declare
  v_type text;
begin
  if to_regclass('public.assignments') is null or to_regclass('public.assignment_submissions') is null then
    raise exception '과제(assignments · assignment_submissions) 표가 없습니다 — 앞선 마이그레이션(20260921020000)을 먼저 실행해 주세요. 이 파일은 아무것도 바꾸지 않았습니다.';
  end if;

  if to_regclass('public.classes') is null
     or to_regclass('public.class_teachers') is null
     or to_regprocedure('public.is_admin()') is null
     or to_regprocedure('public.is_super_admin()') is null
     or to_regprocedure('public.my_class_ids()') is null
     or to_regprocedure('public.can_browse()') is null then
    raise exception '먼저 ① 20260927000000_classes_schema.sql 을 실행해 주세요(학급 표 · my_class_ids() 가 없습니다). 이 파일은 아무것도 바꾸지 않았습니다.';
  end if;

  if to_regprocedure('public.my_student_class_id()') is null then
    raise exception '먼저 ④ 20260927020000_class_notices.sql 을 실행해 주세요(my_student_class_id() 가 없습니다). 이 파일은 아무것도 바꾸지 않았습니다.';
  end if;

  -- ⑤(쓴 교사 · 총괄만 고치고 지우기 + 만든 사람 열 고정)가 먼저 적용돼 있어야 한다. 작성 정책은 ⑤의 이름 또는
  -- (이 파일을 다시 실행하는 경우) 이 파일의 이름이다.
  if not exists (
       select 1 from pg_policies
       where schemaname = 'public' and tablename = 'assignments' and cmd = 'UPDATE'
         and policyname = 'assignments: 쓴 교사·총괄만 수정'
     )
     or not exists (
       select 1 from pg_policies
       where schemaname = 'public' and tablename = 'assignments' and cmd = 'DELETE'
         and policyname = 'assignments: 쓴 교사·총괄만 삭제'
     )
     or not exists (
       select 1 from pg_policies
       where schemaname = 'public' and tablename = 'assignments' and cmd = 'INSERT'
         and policyname in ('assignments: 교사 본인 이름으로 작성', 'assignments: 본인 이름으로 자기 학급에 작성')
     )
     or has_column_privilege('authenticated', 'public.assignments', 'created_by', 'UPDATE') then
    raise exception '먼저 ⑤ 20260927030000_content_owner_only.sql 을 실행해 주세요(과제를 쓴 선생님과 총괄만 고치게 하는 정책 · 열 권한이 없습니다). 이 파일은 아무것도 바꾸지 않았습니다.';
  end if;

  -- 학급을 정하지 못한 과제는 총괄의 학급으로 보낸다(아래 2절) → 총괄이 있어야 한다(②).
  if not exists (select 1 from public.profiles where is_super_admin and role = 'admin') then
    raise exception '총괄 관리자가 아직 없습니다(② docs/classes/setup-owl-class.sql). 이 파일은 아무것도 바꾸지 않았습니다.';
  end if;

  -- 같은 이름의 열이 다른 형으로 이미 있으면(손으로 만든 열 등) 채우기가 엉뚱하게 되므로 멈춘다.
  select c.data_type into v_type
  from information_schema.columns c
  where c.table_schema = 'public' and c.table_name = 'assignments' and c.column_name = 'class_id';
  if v_type is not null and v_type <> 'uuid' then
    raise exception 'assignments.class_id 열이 이미 있는데 형이 uuid 가 아닙니다(%). 이 파일은 아무것도 바꾸지 않았습니다 — 이 메시지를 알려 주세요.', v_type;
  end if;
end $$;

-- ═════════════════════════════════════════════
-- 1. 새 열 class_id + 외래키(학급 삭제 거부) + 인덱스
--    이미 있으면(다시 실행) 열 정의 전체(외래키 포함)를 건너뛴다 — 맨 끝 점검이 외래키가 설계대로인지 확인한다.
-- ═════════════════════════════════════════════
alter table public.assignments
  add column if not exists class_id uuid references public.classes (id) on delete restrict;

create index if not exists assignments_class_created_idx on public.assignments (class_id, created_at desc);

-- ═════════════════════════════════════════════
-- 2. 지금 과제의 학급 채우기(학급이 비어 있는 행만) → 필수(not null)
--    postgres 권한(SQL Editor)으로 돌므로 RLS 와 무관하게 모든 행을 본다.
-- ═════════════════════════════════════════════

-- 2-1. (가) 만든 선생님이 담임인 학급(보관하지 않은 학급) — 여럿이면 가장 먼저 연결된 것(같으면 id 순)
update public.assignments a
   set class_id = (
         select ct.class_id
           from public.class_teachers ct
           join public.classes c on c.id = ct.class_id
          where ct.teacher_id = a.created_by
            and c.archived_at is null
          order by ct.created_at, ct.class_id
          limit 1
       )
 where a.class_id is null
   and a.created_by is not null
   and exists (
         select 1
           from public.class_teachers ct
           join public.classes c on c.id = ct.class_id
          where ct.teacher_id = a.created_by
            and c.archived_at is null
       );

-- 2-2. (나) 아직 비어 있는 과제(만든 사람 없음 · 학급이 없는 교사 · 담임에서 해제된 교사가 만든 것)
--      → 총괄이 담임인 학급(보관하지 않은 학급 중 가장 먼저 연결된 것 = 부엉이반)
update public.assignments a
   set class_id = (
         select ct.class_id
           from public.class_teachers ct
           join public.classes c on c.id = ct.class_id
           join public.profiles p on p.id = ct.teacher_id
          where p.is_super_admin
            and p.role = 'admin'
            and c.archived_at is null
          order by ct.created_at, ct.class_id
          limit 1
       )
 where a.class_id is null;

-- 2-3. 못 채운 과제가 있으면 멈춘다(총괄이 담임인 학급이 없는 경우) — 전부 되돌림
do $$
declare
  v_left int;
begin
  select count(*) into v_left from public.assignments where class_id is null;
  if v_left > 0 then
    raise exception '학급을 정하지 못한 과제가 %개 있습니다(총괄 선생님이 담임인, 보관하지 않은 학급이 없음 — ② setup-owl-class.sql 의 부엉이반 확인). 이 파일 전체를 되돌렸습니다(아무것도 바뀌지 않음) — 이 메시지를 알려 주세요.', v_left;
  end if;
end $$;

alter table public.assignments alter column class_id set not null;

-- ═════════════════════════════════════════════
-- 3. 읽기 정책 — 옛 1개(published or is_admin()) → 학생 · 교사 2개(둘 다 to authenticated — 비로그인은 0행)
--    옛 이름은 67바이트라 처음 만들 때 63바이트 안으로 잘려 저장됐다. drop 에 원래 이름을 그대로 쓰면 Postgres 가
--    같은 방식으로 잘라 맞춘다("will be truncated" 알림은 정상 — ③ 파일의 긴 이름 2개와 같은 방식).
-- ═════════════════════════════════════════════
drop policy if exists "assignments: 공개된 것은 누구나, 관리자는 전체 조회" on public.assignments;

-- 3-1. 학생: 자기 학급의 공개 과제만. 로그인 잠금 게이트(can_browse())도 다른 공개 글과 같게 둔다(로그인한 학생은 늘 통과).
--      my_student_class_id()는 학생(role 'user', 탈퇴 전)이 아니면 null → 교사 · 탈퇴한 학생은 이 정책으로 0행.
drop policy if exists "assignments: 학생은 자기 학급 공개 과제 조회" on public.assignments;
create policy "assignments: 학생은 자기 학급 공개 과제 조회"
  on public.assignments for select
  to authenticated
  using (
    published
    and (select public.can_browse())
    and class_id = (select public.my_student_class_id())
  );

-- 3-2. 교사: 자기 학급 과제(비공개 포함) + 자기가 만든 과제, 총괄은 모든 과제(⑤의 "총괄은 고칠 수 있음"과 맞춤).
drop policy if exists "assignments: 교사는 자기 학급·자기 과제 조회" on public.assignments;
create policy "assignments: 교사는 자기 학급·자기 과제 조회"
  on public.assignments for select
  to authenticated
  using (
    public.is_admin()
    and (
      class_id = any (public.my_class_ids())
      or created_by = auth.uid()
      or public.is_super_admin()
    )
  );

-- ═════════════════════════════════════════════
-- 4. 만들기 정책 — ⑤의 "교사 본인 이름으로 작성" → 자기 학급에만(작성자 = 나는 그대로)
--    고치기 · 지우기 정책(⑤ "쓴 교사·총괄만 수정" · "쓴 교사·총괄만 삭제")과 고치기 열 권한은 그대로 둔다.
-- ═════════════════════════════════════════════
drop policy if exists "assignments: 교사 본인 이름으로 작성" on public.assignments;

drop policy if exists "assignments: 본인 이름으로 자기 학급에 작성" on public.assignments;
create policy "assignments: 본인 이름으로 자기 학급에 작성"
  on public.assignments for insert
  to authenticated
  with check (
    public.is_admin()
    and created_by = auth.uid()
    and class_id = any (public.my_class_ids())
  );

-- ═════════════════════════════════════════════
-- 5. 맨 끝 점검 — 설계와 다르면 전부 되돌린다(아무것도 바뀌지 않음)
--    허용(PERMISSIVE) 정책끼리는 OR 로 합쳐지므로, 모르는 허용 정책이 하나라도 붙어 있으면 좁히기가 소리 없이 무효가 된다.
-- ═════════════════════════════════════════════
do $$
declare
  v_nullable text;
  v_type     text;
  v_missing  text;
  v_extra    text;
  v_roles    text;
  v_cond     text;
  v_sub      text;
  v_summary  text;
  v_total    int;
begin
  -- 5-1. RLS 켜짐
  if not (select c.relrowsecurity from pg_class c where c.oid = 'public.assignments'::regclass) then
    raise exception 'assignments 의 RLS 가 꺼져 있습니다. 이 파일 전체를 되돌렸습니다(아무것도 바뀌지 않음) — 이 메시지를 알려 주세요.';
  end if;

  -- 5-2. 열: uuid · not null
  select c.data_type, c.is_nullable into v_type, v_nullable
  from information_schema.columns c
  where c.table_schema = 'public' and c.table_name = 'assignments' and c.column_name = 'class_id';
  if v_type is distinct from 'uuid' or v_nullable is distinct from 'NO' then
    raise exception 'assignments.class_id 열이 설계(uuid · 필수)와 다릅니다(형 %, 빈 값 허용 %). 이 파일 전체를 되돌렸습니다(아무것도 바뀌지 않음) — 이 메시지를 알려 주세요.', v_type, v_nullable;
  end if;

  -- 5-3. 외래키: class_id → classes(id), 학급 삭제 거부(restrict)
  if not exists (
    select 1
    from pg_constraint con
    where con.conrelid = 'public.assignments'::regclass
      and con.contype = 'f'
      and con.confrelid = 'public.classes'::regclass
      and con.confdeltype = 'r'
      and con.conkey = array[(
        select att.attnum from pg_attribute att
        where att.attrelid = 'public.assignments'::regclass and att.attname = 'class_id' and not att.attisdropped
      )]
  ) then
    raise exception 'assignments.class_id → classes(id) 외래키(on delete restrict)가 없습니다(열이 먼저 다른 방식으로 만들어졌을 수 있음). 이 파일 전체를 되돌렸습니다(아무것도 바뀌지 않음) — 이 메시지를 알려 주세요.';
  end if;

  -- 5-4. 과제 정책 5개가 이름 · 명령 그대로 있는지(읽기 2 · 작성 1 = 이 파일, 수정 · 삭제 = ⑤)
  select string_agg(format('%s (%s)', e.p, e.c), ', ') into v_missing
  from (values
    ('assignments: 학생은 자기 학급 공개 과제 조회', 'SELECT'),
    ('assignments: 교사는 자기 학급·자기 과제 조회', 'SELECT'),
    ('assignments: 본인 이름으로 자기 학급에 작성', 'INSERT'),
    ('assignments: 쓴 교사·총괄만 수정', 'UPDATE'),
    ('assignments: 쓴 교사·총괄만 삭제', 'DELETE')
  ) as e(p, c)
  where not exists (
    select 1 from pg_policies pp
    where pp.schemaname = 'public' and pp.tablename = 'assignments'
      and pp.policyname = e.p and pp.cmd = e.c and pp.permissive = 'PERMISSIVE'
  );
  if v_missing is not null then
    raise exception '있어야 할 과제 정책이 없습니다: %. 이 파일 전체를 되돌렸습니다(아무것도 바뀌지 않음) — 이 메시지를 알려 주세요.', v_missing;
  end if;

  -- 5-5. 그 밖의 허용 정책이 남아 있지 않은지(옛 읽기 정책 "…관리자는 전체 " · ⑤의 옛 작성 정책 · 대시보드에서 만든 정책 등)
  select string_agg(format('%s (%s)', pp.policyname, pp.cmd), ', ' order by pp.policyname) into v_extra
  from pg_policies pp
  where pp.schemaname = 'public' and pp.tablename = 'assignments' and pp.permissive = 'PERMISSIVE'
    and pp.policyname not in (
      'assignments: 학생은 자기 학급 공개 과제 조회',
      'assignments: 교사는 자기 학급·자기 과제 조회',
      'assignments: 본인 이름으로 자기 학급에 작성',
      'assignments: 쓴 교사·총괄만 수정',
      'assignments: 쓴 교사·총괄만 삭제'
    );
  if v_extra is not null then
    raise exception '과제(assignments)에 이 파일이 모르는 정책이 남아 있습니다: %. 이 파일 전체를 되돌렸습니다(아무것도 바뀌지 않음) — 이 메시지를 알려 주세요.', v_extra;
  end if;

  -- 5-6. 대상 역할: 과제 정책은 모두 로그인한 사용자(authenticated)에게만 → 비로그인(anon)은 과제를 한 줄도 못 읽는다
  select string_agg(format('%s (%s)', pp.policyname, pp.roles::text), ', ') into v_roles
  from pg_policies pp
  where pp.schemaname = 'public' and pp.tablename = 'assignments' and pp.permissive = 'PERMISSIVE'
    and pp.roles <> '{authenticated}'::name[];
  if v_roles is not null then
    raise exception '과제 정책의 대상 역할이 설계(authenticated)와 다릅니다: %. 이 파일 전체를 되돌렸습니다(아무것도 바뀌지 않음) — 이 메시지를 알려 주세요.', v_roles;
  end if;

  -- 5-7. 조건 글자 점검(5-5 뒤라 남은 정책 = 위 5개). Postgres 가 다시 그린 식에서 이름 뒷부분으로 찾는다
  --      (public. · auth. 스키마 이름은 표시 방식에 따라 빠질 수 있다 — ⑤의 끝 점검과 같은 방식).
  select string_agg(pp.policyname::text, ', ') into v_cond
  from pg_policies pp
  where pp.schemaname = 'public' and pp.tablename = 'assignments' and pp.permissive = 'PERMISSIVE'
    and not (
      case pp.policyname::text
        when 'assignments: 학생은 자기 학급 공개 과제 조회' then
          position('published' in coalesce(pp.qual, '')) > 0
          and position('can_browse()' in coalesce(pp.qual, '')) > 0
          and position('my_student_class_id()' in coalesce(pp.qual, '')) > 0
          and position('is_admin()' in coalesce(pp.qual, '')) = 0
        when 'assignments: 교사는 자기 학급·자기 과제 조회' then
          position('is_admin()' in coalesce(pp.qual, '')) > 0
          and position('my_class_ids()' in coalesce(pp.qual, '')) > 0
          and position('uid()' in coalesce(pp.qual, '')) > 0
          and position('is_super_admin()' in coalesce(pp.qual, '')) > 0
        when 'assignments: 본인 이름으로 자기 학급에 작성' then
          position('is_admin()' in coalesce(pp.with_check, '')) > 0
          and position('uid()' in coalesce(pp.with_check, '')) > 0
          and position('my_class_ids()' in coalesce(pp.with_check, '')) > 0
        else true  -- ⑤의 수정 · 삭제 정책은 ⑤의 끝 점검이 이미 확인했다
      end
    );
  if v_cond is not null then
    raise exception '과제 정책 조건이 설계와 다릅니다: %. 이 파일 전체를 되돌렸습니다(아무것도 바뀌지 않음) — 이 메시지를 알려 주세요.', v_cond;
  end if;

  -- 5-8. 열 권한: 학급 · 만든 사람은 아무도 못 바꾸고(PUBLIC 권한 포함), 새 과제에 학급을 넣을 수 있고,
  --      화면이 고치는 4개 열(⑤)은 그대로 고칠 수 있어야 한다
  if has_column_privilege('anon', 'public.assignments', 'class_id', 'UPDATE')
     or has_column_privilege('authenticated', 'public.assignments', 'class_id', 'UPDATE')
     or has_column_privilege('anon', 'public.assignments', 'created_by', 'UPDATE')
     or has_column_privilege('authenticated', 'public.assignments', 'created_by', 'UPDATE') then
    raise exception '과제의 학급 · 만든 사람 열을 바꿀 수 있는 권한이 남아 있습니다(PUBLIC 권한 등). 이 파일 전체를 되돌렸습니다(아무것도 바뀌지 않음) — 이 메시지를 알려 주세요.';
  end if;
  if not (
    has_column_privilege('authenticated', 'public.assignments', 'class_id', 'INSERT')
    and has_column_privilege('authenticated', 'public.assignments', 'title', 'UPDATE')
    and has_column_privilege('authenticated', 'public.assignments', 'description_md', 'UPDATE')
    and has_column_privilege('authenticated', 'public.assignments', 'due_at', 'UPDATE')
    and has_column_privilege('authenticated', 'public.assignments', 'published', 'UPDATE')
  ) then
    raise exception '과제 만들기(학급 넣기) · 고치기 열 권한이 빠졌습니다(새 과제 저장 · 공개 전환이 막힘). 이 파일 전체를 되돌렸습니다(아무것도 바뀌지 않음) — 이 메시지를 알려 주세요.';
  end if;

  -- 5-9. 정책이 부르는 함수를 로그인한 사용자가 실행할 수 있는지(없으면 과제를 읽을 때 permission denied)
  if not (
    has_function_privilege('authenticated', 'public.is_admin()', 'EXECUTE')
    and has_function_privilege('authenticated', 'public.is_super_admin()', 'EXECUTE')
    and has_function_privilege('authenticated', 'public.my_class_ids()', 'EXECUTE')
    and has_function_privilege('authenticated', 'public.my_student_class_id()', 'EXECUTE')
    and has_function_privilege('authenticated', 'public.can_browse()', 'EXECUTE')
  ) then
    raise exception '과제 정책이 부르는 함수를 로그인한 사용자가 실행할 수 없습니다(과제를 읽을 때 permission denied 가 남). 이 파일 전체를 되돌렸습니다 — 이 메시지를 알려 주세요.';
  end if;

  -- 5-10. 제출 정책 전제: 제출물 작성(INSERT · ALL) 허용 정책은 모두 과제(assignments)를 하위 쿼리로 확인해야
  --       과제 읽기 정책(3절)을 따라 "자기 학급 공개 과제에만 제출"로 좁아진다. 과제를 보지 않는 작성 정책이 있으면 멈춘다.
  --       ('assignment_submissions' 라는 이름 안에는 'assignments' 글자가 없다 — 하위 쿼리의 표 이름만 걸린다.)
  select string_agg(pp.policyname::text, ', ' order by pp.policyname) into v_sub
  from pg_policies pp
  where pp.schemaname = 'public' and pp.tablename = 'assignment_submissions' and pp.permissive = 'PERMISSIVE'
    and pp.cmd in ('INSERT', 'ALL')
    and position('assignments' in coalesce(pp.with_check, pp.qual, '')) = 0;
  if v_sub is not null then
    raise exception '과제를 확인하지 않는 제출물 작성 정책이 있습니다: %(다른 학급 과제에도 낼 수 있게 됨). 이 파일 전체를 되돌렸습니다(아무것도 바뀌지 않음) — 이 메시지를 알려 주세요.', v_sub;
  end if;
  if not exists (
    select 1 from pg_policies pp
    where pp.schemaname = 'public' and pp.tablename = 'assignment_submissions' and pp.cmd = 'INSERT'
      and pp.policyname = 'assignment_submissions: 본인이 공개 과제에 제출'
  ) then
    raise notice '⚠ 제출물 작성 정책 "assignment_submissions: 본인이 공개 과제에 제출"이 없습니다 — 학생이 과제를 낼 수 없을 수 있어요. 이 메시지를 알려 주세요(이 파일은 그대로 적용됨).';
  end if;

  -- 학급별 과제 수(알림용 — SQL Editor 에만 보인다)
  select count(*) into v_total from public.assignments;
  select string_agg(format('%s %s개', c.name, x.n), ', ' order by c.name) into v_summary
  from (select a.class_id, count(*) as n from public.assignments a group by a.class_id) x
  join public.classes c on c.id = x.class_id;

  raise notice '✔ 과제를 학급별로 나눴습니다(과제 %개 — %). 학생은 자기 학급의 공개 과제만 보고 내고, 교사는 자기 학급 과제와 자기가 만든 과제(총괄은 모든 과제)를 봅니다. 새 과제는 자기 학급에만 만들 수 있고, 과제의 학급은 바꿀 수 없습니다. 다음: 확인 쿼리 → 사이트 push.',
    v_total, coalesce(v_summary, '과제 없음');
end $$;

-- PostgREST 가 새 열을 바로 알도록(대시보드도 대개 자동으로 하지만 한 번 더 — 모르면 새 과제 저장 때 PGRST204)
notify pgrst, 'reload schema';
