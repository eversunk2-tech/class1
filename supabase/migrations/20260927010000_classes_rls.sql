-- 반(학급)별로 나눠 보이게 하기 ③ — 권한 좁히기(RLS 정책·함수)
-- 설계: docs/classes/spec.md 끝의 "개정 1"(1-1 권한 표가 기준). 분류표·확인 방법: docs/classes/build-db-report.md
--
-- ▶ 실행 순서(반드시 이 순서 — 개정 1-3)
--   ① supabase/migrations/20260927000000_classes_schema.sql
--   ② docs/classes/setup-owl-class.sql — 부엉이반 + 총괄 지정(이메일을 바꿔서)
--   ③ 이 파일(20260927010000_classes_rls.sql)                                ← 지금
--   ④ supabase/migrations/20260927020000_class_notices.sql — 학급별 '선생님 글'
--   ⑤ Edge Function 3개 다시 배포: npx supabase functions deploy admin-create-member
--                                  npx supabase functions deploy admin-reset-password
--                                  npx supabase functions deploy admin-delete-member   (--no-verify-jwt 금지)
--   ⑥ 사이트(관리자 화면) push
--   ⚠ 이 파일을 적용한 뒤에는 그보다 앞선 마이그레이션(20260921… ~ 20260926…)을 다시 실행하지 않는다 —
--     옛 정책·함수가 되살아나 권한이 소리 없이 넓어진다(Review L10). 되돌려야 하면 docs/classes/rollback-classes-rls.sql.
--
-- ▶ 실행 방법
--   Supabase 대시보드 > SQL Editor > New query 에 이 파일 전체를 붙여넣고 Run.
--   SQL Editor 는 붙여 넣은 전체를 한 트랜잭션으로 실행하므로, 아래 점검에서 오류가 나면 아무것도 바뀌지 않는다.
--   (psql 등 다른 도구로 실행할 때는 psql -1 -v ON_ERROR_STOP=1 -f <파일> 처럼 "한 트랜잭션 + 오류 시 멈춤"으로.)
--   · 맨 앞 점검: ①이 안 됐거나 총괄(role 'admin' + is_super_admin)이 한 명도 없으면(②를 안 했으면) 오류를 내고
--     아무것도 바꾸지 않는다 — 그대로 적용하면 관리자 화면이 잠기기 때문이다.
--   · 맨 끝 점검: 학생 기록·회원 표에 is_admin() 정책·함수가 남아 있으면 오류를 내고 전부 되돌린다.
--   · 여러 번 실행해도 안전하다(drop policy if exists + create policy, create or replace function).
--   · 긴 정책 이름 2개(아래 표시)는 처음 만들 때 63바이트로 잘려 저장됐다. drop 에 원래 긴 이름을 그대로 써도
--     Postgres 가 같은 방식으로 잘라 맞춘다("will be truncated" NOTICE 는 정상). 새 이름은 모두 63바이트 안이다.
--   ⚠ select public.admin_set_role(…) / admin_set_login_required(…) 를 SQL Editor 에서 부르지 않는다
--     (SQL Editor 에는 auth.uid()가 없어 "총괄만" 검사에 걸린다. 화면에서 시험한다).
--
-- ▶ 무엇이 바뀌나 — is_admin() 을 쓰던 곳 전부를 개정 1-1 권한 표대로 나눴다(자세한 분류표는 보고서)
--   (가) 학생 기록 → teaches_student(학생 열): 그 학생의 담임만. 총괄도 자기 반만(개정 1-1 "총괄도 보기 불가능").
--        app_results 조회·삭제, app_progress 조회, post_reads 조회, assignment_submissions 조회·수정·삭제 + 가드 트리거,
--        feedback_threads 조회·삭제, feedback_messages 조회·보내기, feedback_read_marks 기록,
--        함수 get_or_create_feedback_thread · mark_thread_read · unread_feedback_count
--   (나) 계정 관리 → can_manage_member(대상): 총괄은 모든 회원, 담임은 자기 반 학생
--        member_directory 조회, password_reset_log · member_withdrawal_log · member_create_log 조회,
--        함수 admin_must_change_password_ids
--   (다) 총괄만: admin_set_login_required(로그인 잠금 스위치), admin_set_role(담임 지정·해제)
--   (라) 내 학급 기준 숫자: admin_dashboard_stats()(총괄도 자기 반 기준)
--   (마) 그대로 is_admin()(개정 1-5 — 교사 누구나, 이번에 안 바꿈): 블로그 글·댓글 관리, 과제 내용, 칭찬 문구,
--        자유게시판·학습게임 숨기기·삭제·신고 처리(정책·함수·트리거), 게임 파일(storage)
--   과학 앱은 코드 변경 없음(학생 본인 기록 정책 — 본인 추가·조회·수정·삭제 — 은 그대로).
--   자동으로 좁혀지는 것(코드 그대로, security invoker 라 위 정책을 따른다): app_result_stats(), feedback_thread_summaries().
--
-- ▶ 실행 후 확인 쿼리(앞의 "-- "를 지우고 한 덩어리씩 Run)
--   ※ 흉내 내기(2~5)는 begin; … rollback; 대신 "한 번의 Run = 한 트랜잭션"을 쓴다: set local role · set_config(…, true)는
--     그 Run 안에서만 적용되고 끝나면 저절로 풀린다(begin … rollback 과 같은 효과). SQL Editor 가 마지막 문장의 결과만
--     보여 주고, begin 안에서 오류가 나면 연결이 "중단된 트랜잭션"으로 남을 수 있어서다. psql 에서는 앞뒤에 begin; / rollback; 을 붙인다.
--     각 결과의 "지금_역할" 칸이 anon / authenticated 여야 흉내가 된 것이다(postgres 면 흉내가 안 된 것 — 숫자를 믿지 말 것).
--     모두 읽기만 한다. "permission denied" 오류도 "못 읽는다"는 뜻이라 정상이다.
--
--   -- 0) 흉내 낼 계정 id 찾기(그냥 Run = postgres 권한)
--   select p.id, p.display_name, p.role, p.is_super_admin, c.name as 학급
--   from public.profiles p left join public.classes c on c.id = p.class_id
--   order by p.role, c.name nulls first, p.display_name limit 200;
--
--   -- 1) 학생 기록·회원 표에 is_admin() 정책이 남지 않았는지(0행)
--   select tablename, policyname from pg_policies
--   where schemaname = 'public'
--     and tablename in ('member_directory', 'app_results', 'app_progress', 'post_reads', 'assignment_submissions',
--                       'feedback_threads', 'feedback_messages', 'feedback_read_marks',
--                       'password_reset_log', 'member_withdrawal_log', 'member_create_log')
--     and position('is_admin()' in coalesce(qual, '') || coalesce(with_check, '')) > 0;
--
--   -- 2) 비로그인(anon) 흉내 — 모두 0 / false / {}
--   --    (member_directory · app_progress · classes · 감사 로그는 anon 에게 표 권한이 없어 permission denied 가 정상이라 뺐다)
--   set local role anon;
--   select current_user as 지금_역할,
--          (select count(*) from public.app_results)            as 결과,
--          (select count(*) from public.post_reads)             as 읽음,
--          (select count(*) from public.assignment_submissions) as 제출,
--          (select count(*) from public.feedback_threads)       as 대화,
--          public.is_super_admin() as 총괄, public.my_class_ids() as 내학급;
--
--   -- 3) 학생 흉내 — 남의 기록 0, 명단·학급·감사 로그 0, 총괄 false, 내학급 {}
--   set local role authenticated;
--   select set_config('request.jwt.claims', '{"sub":"<학생 id>","role":"authenticated"}', true);
--   select current_user as 지금_역할, auth.uid() as 나,
--          (select count(*) from public.app_results      where user_id    <> '<학생 id>') as 남의_결과,
--          (select count(*) from public.app_progress     where user_id    <> '<학생 id>') as 남의_진행,
--          (select count(*) from public.feedback_threads where student_id <> '<학생 id>') as 남의_대화,
--          (select count(*) from public.member_directory)   as 명단,
--          (select count(*) from public.classes)            as 학급,
--          (select count(*) from public.class_teachers)     as 담임표,
--          (select count(*) from public.password_reset_log) as 초기화기록,
--          public.is_super_admin() as 총괄, public.my_class_ids() as 내학급;
--   --    학생이 학급 열을 못 읽는지: 위 두 줄(set local · set_config) 다음에  select class_id from public.profiles limit 1;
--   --    → "permission denied for table profiles"(열 권한)가 정상.
--
--   -- 4) 다른 반 교사 흉내(두 번째 교사가 생긴 뒤) — 부엉이반 학생 것은 모두 0 / false
--   set local role authenticated;
--   select set_config('request.jwt.claims', '{"sub":"<다른 반 교사 id>","role":"authenticated"}', true);
--   select current_user as 지금_역할, auth.uid() as 나,
--          (select count(*) from public.app_results            where user_id    = '<부엉이반 학생 id>') as 결과,
--          (select count(*) from public.app_progress           where user_id    = '<부엉이반 학생 id>') as 진행,
--          (select count(*) from public.assignment_submissions where user_id    = '<부엉이반 학생 id>') as 제출,
--          (select count(*) from public.feedback_threads       where student_id = '<부엉이반 학생 id>') as 대화,
--          (select count(*) from public.member_directory       where id         = '<부엉이반 학생 id>') as 명단,
--          (select count(*) from public.password_reset_log     where target_id  = '<부엉이반 학생 id>') as 초기화기록,
--          public.teaches_student('<부엉이반 학생 id>') as 담임인가, public.is_super_admin() as 총괄;
--
--   -- 5) 총괄 흉내 — 명단은 전체, 학습 기록은 자기 반(부엉이반)만
--   set local role authenticated;
--   select set_config('request.jwt.claims', '{"sub":"<총괄 id>","role":"authenticated"}', true);
--   select current_user as 지금_역할, auth.uid() as 나,
--          (select count(*) from public.member_directory) as 명단_전체,                                   -- 전체 회원 수와 같아야
--          (select count(*) from public.app_results where user_id = '<부엉이반 학생 id>') as 우리반_결과, -- postgres 로 센 수와 같아야
--          (select count(*) from public.app_results where user_id = '<다른 반 학생 id>') as 다른반_결과,  -- 0 (다른 반이 생긴 뒤)
--          public.is_super_admin() as 총괄, public.my_class_ids() as 내학급;                            -- true, {부엉이반 id}
--
--   -- 6) 함수 권한 그대로인지(앞 2개 true — 정책 평가용, 뒤 2개 false)
--   select has_function_privilege('anon', 'public.teaches_student(uuid)', 'execute'),
--          has_function_privilege('anon', 'public.can_manage_member(uuid)', 'execute'),
--          has_function_privilege('anon', 'public.admin_set_role(uuid, text)', 'execute'),
--          has_function_privilege('anon', 'public.admin_set_login_required(boolean)', 'execute');

-- ═════════════════════════════════════════════
-- 0. 맨 앞 점검 — 관리자 잠김 방지(개정 1-3 "총괄이 없으면 실행을 거부")
-- ═════════════════════════════════════════════
do $$
declare
  v_unassigned    int;
  v_super_classes int;
begin
  if to_regclass('public.classes') is null
     or to_regclass('public.class_teachers') is null
     or to_regprocedure('public.teaches_student(uuid)') is null
     or to_regprocedure('public.can_manage_member(uuid)') is null
     or not exists (
       select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'profiles' and column_name = 'is_super_admin'
     ) then
    raise exception '먼저 20260927000000_classes_schema.sql 을 실행해 주세요. (이 파일은 아무것도 바꾸지 않았습니다.)';
  end if;

  if not exists (select 1 from public.profiles where is_super_admin and role = 'admin') then
    raise exception '총괄 관리자가 아직 없습니다. docs/classes/setup-owl-class.sql(부엉이반 만들기 + 총괄 지정)을 먼저 실행해 주세요. (이 파일은 아무것도 바꾸지 않았습니다 — 총괄 없이 적용하면 관리자 화면이 잠깁니다.)';
  end if;

  select count(*) into v_super_classes
  from public.class_teachers ct
  join public.profiles p on p.id = ct.teacher_id
  where p.is_super_admin and p.role = 'admin';
  if v_super_classes = 0 then
    raise notice '⚠ 총괄 계정이 담임인 학급이 없습니다. 총괄도 자기 학급 학생 기록만 보므로(개정 1-1), setup-owl-class.sql 로 부엉이반을 만들었는지 확인해 주세요.';
  end if;

  select count(*) into v_unassigned from public.profiles where role = 'user' and class_id is null;
  if v_unassigned > 0 then
    raise notice '⚠ 학급이 없는 회원(role = user) %명 — 이 회원들의 학습 기록은 어느 담임에게도 보이지 않습니다(총괄의 회원 명단에는 보임). 학생이라면 이 메시지를 알려 주세요(학급을 정하는 SQL을 드립니다).', v_unassigned;
  end if;
end $$;

-- ═════════════════════════════════════════════
-- 1. member_directory.class_id 를 profiles 에 다시 맞춘다(①의 트리거가 이미 맞추지만, 재실행해도 안전한 확인)
-- ═════════════════════════════════════════════
update public.member_directory d
   set class_id = p.class_id, updated_at = now()
  from public.profiles p
 where p.id = d.id
   and d.class_id is distinct from p.class_id;

-- ═════════════════════════════════════════════
-- 2. (가) 학생 기록 정책 — is_admin() → teaches_student(학생 열)
--    각 정책의 나머지 조건·대상 역할(to …)은 지금 정의(파일명 표시)와 글자 그대로 같다. 바뀌는 것은 관리자 조건뿐.
--    정책 이름은 뜻에 맞게 "관리자" → "담임"으로 바꾼다(옛 이름·새 이름 모두 drop 해서 재실행 안전).
--    재귀(42P17) 없음: teaches_student()는 security definer 로 profiles · class_teachers 만 읽는다.
--    feedback_messages · feedback_read_marks 정책은 feedback_threads 를 조회하고, 그 표의 정책은 다시 teaches_student()
--    (→ profiles · class_teachers)만 부른다 → 어느 경로도 처음 표로 되돌아오지 않는다.
-- ═════════════════════════════════════════════

-- 2-1. app_results (20260921020000_admin_learning.sql)
drop policy if exists "app_results: 본인 또는 관리자 조회" on public.app_results;
drop policy if exists "app_results: 본인 또는 담임 조회" on public.app_results;
create policy "app_results: 본인 또는 담임 조회"
  on public.app_results for select
  using (auth.uid() = user_id or public.teaches_student(user_id));

-- 결과 지우기도 담임만(개정 1-1 — 총괄도 다른 반 결과는 못 지운다). 본인 기록 추가 정책("본인만 기록")은 그대로.
drop policy if exists "app_results: 관리자만 삭제" on public.app_results;
drop policy if exists "app_results: 담임만 삭제" on public.app_results;
create policy "app_results: 담임만 삭제"
  on public.app_results for delete
  to authenticated
  using (public.teaches_student(user_id));

-- 2-2. app_progress (20260922010000_app_progress.sql) — 본인 조회·추가·수정·삭제 정책 4개는 그대로
drop policy if exists "app_progress: 관리자 조회" on public.app_progress;
drop policy if exists "app_progress: 담임 조회" on public.app_progress;
create policy "app_progress: 담임 조회"
  on public.app_progress for select
  to authenticated
  using (public.teaches_student(user_id));

-- 2-3. post_reads (20260921020000)
drop policy if exists "post_reads: 본인 또는 관리자 조회" on public.post_reads;
drop policy if exists "post_reads: 본인 또는 담임 조회" on public.post_reads;
create policy "post_reads: 본인 또는 담임 조회"
  on public.post_reads for select
  using (auth.uid() = user_id or public.teaches_student(user_id));

-- 2-4. assignment_submissions (20260921020000) — "본인이 공개 과제에 제출"(insert) 정책은 그대로
drop policy if exists "assignment_submissions: 본인 또는 관리자 조회" on public.assignment_submissions;
drop policy if exists "assignment_submissions: 본인 또는 담임 조회" on public.assignment_submissions;
create policy "assignment_submissions: 본인 또는 담임 조회"
  on public.assignment_submissions for select
  using (auth.uid() = user_id or public.teaches_student(user_id));

drop policy if exists "assignment_submissions: 본인 또는 관리자 수정" on public.assignment_submissions;
drop policy if exists "assignment_submissions: 본인 또는 담임 수정" on public.assignment_submissions;
create policy "assignment_submissions: 본인 또는 담임 수정"
  on public.assignment_submissions for update
  to authenticated
  using (auth.uid() = user_id or public.teaches_student(user_id))
  with check (auth.uid() = user_id or public.teaches_student(user_id));

-- 학생은 (마감 전 또는 마감 없음) + (검토 완료 전)일 때만, 담임은 언제나(§14 Q8 규칙 그대로).
drop policy if exists "assignment_submissions: 관리자만 삭제" on public.assignment_submissions;
drop policy if exists "assignment_submissions: 본인(마감 전·검토 전) 또는 관리자 삭제" on public.assignment_submissions; -- 78바이트 → 저장 때 잘림(같게 잘려 맞음)
drop policy if exists "assignment_submissions: 본인 또는 담임 삭제" on public.assignment_submissions;
create policy "assignment_submissions: 본인 또는 담임 삭제"
  on public.assignment_submissions for delete
  to authenticated
  using (
    public.teaches_student(user_id)
    or (
      auth.uid() = user_id
      and status <> 'reviewed'
      and exists (
        select 1 from public.assignments a
        where a.id = assignment_submissions.assignment_id and (a.due_at is null or now() < a.due_at)
      )
    )
  );

-- 2-5. feedback_threads (20260921020000) — insert 정책은 20260922000000 에서 없앴다(RPC 로만 생성, insert 권한도 회수).
--      혹시 남아 있으면(그 파일 재실행 누락 등) 관리자 전체 허용이 되므로 한 번 더 지운다(없으면 아무 일 없음).
drop policy if exists "feedback_threads: 본인 또는 관리자 생성" on public.feedback_threads;
drop policy if exists "feedback_threads: 본인 또는 관리자 조회" on public.feedback_threads;
drop policy if exists "feedback_threads: 본인 또는 담임 조회" on public.feedback_threads;
create policy "feedback_threads: 본인 또는 담임 조회"
  on public.feedback_threads for select
  using (auth.uid() = student_id or public.teaches_student(student_id));

drop policy if exists "feedback_threads: 관리자만 삭제" on public.feedback_threads;
drop policy if exists "feedback_threads: 담임만 삭제" on public.feedback_threads;
create policy "feedback_threads: 담임만 삭제"
  on public.feedback_threads for delete
  to authenticated
  using (public.teaches_student(student_id));

-- 2-6. feedback_messages (20260921020000) — 그 학생 본인 또는 그 학생의 담임만 읽고 보낸다
--      (개정 1-1: 담당 교사만 그 학생 스레드에 답장·칭찬 — 총괄도 다른 반 학생에게는 못 보낸다).
drop policy if exists "feedback_messages: 스레드 접근 가능자만 조회" on public.feedback_messages;
drop policy if exists "feedback_messages: 본인·담임 스레드만 조회" on public.feedback_messages;
create policy "feedback_messages: 본인·담임 스레드만 조회"
  on public.feedback_messages for select
  using (
    exists (
      select 1 from public.feedback_threads t
      where t.id = feedback_messages.thread_id
        and (t.student_id = auth.uid() or public.teaches_student(t.student_id))
    )
  );

drop policy if exists "feedback_messages: 본인 발신, 스레드 접근 가능해야 함" on public.feedback_messages; -- 67바이트 → 저장 때 잘림(같게 잘려 맞음)
drop policy if exists "feedback_messages: 본인 발신, 본인·담임 스레드만" on public.feedback_messages;
create policy "feedback_messages: 본인 발신, 본인·담임 스레드만"
  on public.feedback_messages for insert
  to authenticated
  with check (
    auth.uid() = sender_id
    and exists (
      select 1 from public.feedback_threads t
      where t.id = feedback_messages.thread_id
        and (t.student_id = auth.uid() or public.teaches_student(t.student_id))
    )
  );

-- 2-7. feedback_read_marks (20260921020000) — spec §3.4 표에 빠져 있던 곳(with check 의 is_admin()). 이름 그대로.
drop policy if exists "feedback_read_marks: 본인만 조회/기록" on public.feedback_read_marks;
create policy "feedback_read_marks: 본인만 조회/기록"
  on public.feedback_read_marks for all
  to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.feedback_threads t
      where t.id = feedback_read_marks.thread_id
        and (t.student_id = auth.uid() or public.teaches_student(t.student_id))
    )
  );

-- ═════════════════════════════════════════════
-- 3. (나) 계정 관리 정책 — is_admin() → can_manage_member(대상)
--    총괄: 모든 회원(비밀번호 초기화·탈퇴·담임 지정을 하려면 찾아야 함), 담임: 자기 반 학생만(개정 1-1).
--    감사 로그의 target_id 는 외래키가 없지만 profiles 행은 탈퇴 뒤에도 남으므로 학급으로 판단할 수 있다.
-- ═════════════════════════════════════════════

-- 3-1. member_directory (20260921020000 — 대상 역할 지정 없음, 그대로)
drop policy if exists "member_directory: 관리자만 조회" on public.member_directory;
drop policy if exists "member_directory: 담임·총괄 조회" on public.member_directory;
create policy "member_directory: 담임·총괄 조회"
  on public.member_directory for select
  using (public.can_manage_member(id));

-- 3-2. password_reset_log (20260922000000_admin_learning_fixes.sql)
drop policy if exists "password_reset_log: 관리자만 조회" on public.password_reset_log;
drop policy if exists "password_reset_log: 담임·총괄 조회" on public.password_reset_log;
create policy "password_reset_log: 담임·총괄 조회"
  on public.password_reset_log for select
  to authenticated
  using (public.can_manage_member(target_id));

-- 3-3. member_withdrawal_log (20260923000000_member_withdrawal.sql)
drop policy if exists "member_withdrawal_log: 관리자만 조회" on public.member_withdrawal_log;
drop policy if exists "member_withdrawal_log: 담임·총괄 조회" on public.member_withdrawal_log;
create policy "member_withdrawal_log: 담임·총괄 조회"
  on public.member_withdrawal_log for select
  to authenticated
  using (public.can_manage_member(target_id));

-- 3-4. member_create_log (20260923030000_member_create_log.sql)
drop policy if exists "member_create_log: 관리자만 조회" on public.member_create_log;
drop policy if exists "member_create_log: 담임·총괄 조회" on public.member_create_log;
create policy "member_create_log: 담임·총괄 조회"
  on public.member_create_log for select
  to authenticated
  using (public.can_manage_member(target_id));

-- 3-5. admin_must_change_password_ids() (20260922000000) — 회원 명단의 "비밀번호 변경 필요" 표시.
--      spec §3.4 표에 빠져 있던 곳. 명단과 같은 범위(can_manage_member)로 좁힌다. 나머지는 원문 그대로.
create or replace function public.admin_must_change_password_ids()
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(p.id), '{}'::uuid[])
  from public.profiles p
  where p.must_change_password and public.can_manage_member(p.id);
$$;

revoke all on function public.admin_must_change_password_ids() from public, anon;
grant execute on function public.admin_must_change_password_ids() to authenticated;

-- ═════════════════════════════════════════════
-- 4. (가) 학생 기록 함수 — is_admin() → teaches_student(…). 나머지 본문은 지금 정의와 글자 그대로 같다.
-- ═════════════════════════════════════════════

-- 4-1. 제출물 가드 트리거 (20260922000000 #3 정의). RLS 와 앞뒤가 맞게 "그 학생의 담임"만 상태를 바꾼다.
--      security invoker(원래대로) — teaches_student()는 PUBLIC 실행이라 누가 불러도 된다.
--      INSERT 는 RLS 가 본인만 허용하므로 사실상 늘 'submitted' 로 고정된다(관리자 본인 제출도 마찬가지).
create or replace function public.assignment_submission_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_content_changed boolean;
begin
  if tg_op = 'INSERT' then
    if not public.teaches_student(new.user_id) then
      new.status := 'submitted';
      new.submitted_at := now();
    end if;
    return new;
  end if;

  if new.user_id is distinct from old.user_id or new.assignment_id is distinct from old.assignment_id then
    raise exception '제출 대상은 바꿀 수 없습니다.';
  end if;

  v_content_changed := new.body_md is distinct from old.body_md or new.link_url is distinct from old.link_url;

  if public.teaches_student(old.user_id) and auth.uid() is distinct from old.user_id then
    if v_content_changed or new.submitted_at is distinct from old.submitted_at then
      raise exception '관리자는 상태만 변경할 수 있습니다.';
    end if;
  else
    if new.status is distinct from old.status then
      raise exception '상태는 관리자만 변경할 수 있습니다.';
    end if;
    if new.submitted_at is distinct from old.submitted_at then
      raise exception '제출 시각은 바꿀 수 없습니다.';
    end if;
    if v_content_changed then
      if old.status = 'reviewed' and not public.teaches_student(old.user_id) then
        raise exception '검토 완료된 제출물은 수정할 수 없습니다.';
      end if;
      if old.status = 'needs_revision' then
        new.status := 'submitted';
      end if;
    end if;
  end if;
  return new;
end;
$$;

-- 4-2. 피드백 스레드 찾기/만들기 (20260922000000 #8 정의) — 학생 본인 또는 그 학생의 담임만(칭찬 보내기 포함).
create or replace function public.get_or_create_feedback_thread(p_student_id uuid, p_context_type text, p_context_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null or not (auth.uid() = p_student_id or public.teaches_student(p_student_id)) then
    raise exception '권한이 없습니다.';
  end if;
  if p_context_type not in ('general', 'app_result', 'assignment_submission') then
    raise exception '잘못된 대화 종류입니다.';
  end if;
  if p_context_type = 'general' then
    p_context_id := null;
  end if;

  select id into v_id from public.feedback_threads
  where student_id = p_student_id
    and context_key = p_context_type || ':' || coalesce(p_context_id::text, '');
  if v_id is not null then
    return v_id;
  end if;

  if p_context_type = 'app_result' and not exists (
    select 1 from public.app_results r where r.id = p_context_id and r.user_id = p_student_id
  ) then
    raise exception '대화를 연결할 웹앱 기록을 찾을 수 없습니다.';
  end if;
  if p_context_type = 'assignment_submission' and not exists (
    select 1 from public.assignment_submissions s where s.id = p_context_id and s.user_id = p_student_id
  ) then
    raise exception '대화를 연결할 제출물을 찾을 수 없습니다.';
  end if;

  insert into public.feedback_threads (student_id, context_type, context_id)
  values (p_student_id, p_context_type, p_context_id)
  on conflict (student_id, context_key) do nothing
  returning id into v_id;
  if v_id is null then
    select id into v_id from public.feedback_threads
    where student_id = p_student_id
      and context_key = p_context_type || ':' || coalesce(p_context_id::text, '');
  end if;
  return v_id;
end;
$$;

revoke all on function public.get_or_create_feedback_thread(uuid, text, uuid) from public, anon;
grant execute on function public.get_or_create_feedback_thread(uuid, text, uuid) to authenticated;

-- 4-3. 읽음 표시 (20260922000000 #5 정의)
create or replace function public.mark_thread_read(p_thread_id uuid, p_until timestamptz)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_until timestamptz;
begin
  if auth.uid() is null or p_thread_id is null or p_until is null then
    return;
  end if;
  if not exists (
    select 1 from public.feedback_threads t
    where t.id = p_thread_id and (t.student_id = auth.uid() or public.teaches_student(t.student_id))
  ) then
    return;
  end if;

  select max(m.created_at) into v_until
  from public.feedback_messages m
  where m.thread_id = p_thread_id
    and m.created_at <= least(p_until, now());
  if v_until is null then
    return;
  end if;

  insert into public.feedback_read_marks (thread_id, user_id, last_read_at)
  values (p_thread_id, auth.uid(), v_until)
  on conflict (thread_id, user_id)
  do update set last_read_at = greatest(public.feedback_read_marks.last_read_at, excluded.last_read_at);
end;
$$;

revoke all on function public.mark_thread_read(uuid, timestamptz) from public, anon;
grant execute on function public.mark_thread_read(uuid, timestamptz) to authenticated;

-- 4-4. 안 읽은 피드백 수 (20260921020000 정의) — 담임의 배지가 자기 반 기준으로 줄어든다(의도된 동작).
create or replace function public.unread_feedback_count()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::int
  from public.feedback_messages m
  join public.feedback_threads t on t.id = m.thread_id
  left join public.feedback_read_marks r on r.thread_id = t.id and r.user_id = auth.uid()
  where auth.uid() is not null
    and m.sender_id <> auth.uid()
    and (t.student_id = auth.uid() or public.teaches_student(t.student_id))
    and m.created_at > coalesce(r.last_read_at, '-infinity'::timestamptz);
$$;

revoke all on function public.unread_feedback_count() from public, anon;
grant execute on function public.unread_feedback_count() to authenticated;

-- ═════════════════════════════════════════════
-- 5. (다) 총괄만 · (라) 내 학급 기준
-- ═════════════════════════════════════════════

-- 5-1. 로그인 잠금 스위치 (20260923010000 정의) — 총괄만 켜고 끈다(개정 1-1). 담임은 읽기만(site_settings 는 누구나 읽음).
--      자물쇠 방지 규칙은 그대로: site_settings 의 SELECT 정책(using true)·can_browse()/login_required()는 건드리지 않는다.
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
  if not public.is_super_admin() then
    raise exception '로그인 잠금 스위치는 총괄 관리자만 바꿀 수 있습니다.';
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

-- 5-2. 담임 지정·해제 (20260921020000 정의를 개정 1-2·1-4 대로 다시 씀)
--      · 총괄만(지금까지는 관리자 누구나).
--      · 지정(user → admin): 학생 소속(class_id)을 비운다. 탈퇴한 회원은 지정할 수 없다(로그인 수단이 없음).
--      · 해제(admin → user): 자기 자신 불가 · 마지막 관리자 불가(원래 규칙 그대로).
--        학생이 있는 학급을 혼자 맡고 있으면 거부한다 — 그 학생들의 기록이 아무에게도 안 보이게 되는 일을 막는다(개정 1-2).
--        거부되지 않으면 남은 담임 연결을 정리한다: 다른 담임이 있는 학급은 연결만 빠지고,
--        담임이 아무도 남지 않은 학급(= 학생이 없는 빈 학급)은 지우지 않고 보관(archived_at)으로 표시한다.
--        총괄 표시도 함께 끈다.
create or replace function public.admin_set_role(p_user uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current   text;
  v_withdrawn timestamptz;
  v_blocking  text;
  v_classes   uuid[];
begin
  if not public.is_super_admin() then
    raise exception '담임교사 지정·해제는 총괄 관리자만 할 수 있습니다.';
  end if;
  if p_user is null then
    raise exception '대상 회원을 찾을 수 없습니다.';
  end if;
  if p_role is null or p_role not in ('admin', 'user') then
    raise exception '잘못된 역할입니다.';
  end if;

  -- 동시에 두 관리자가 서로를 해제하는 경쟁을 막기 위해 관리자 행을 잠근다(원래 코드 그대로).
  perform 1 from public.profiles where role = 'admin' for update;

  select p.role, p.withdrawn_at into v_current, v_withdrawn
  from public.profiles p
  where p.id = p_user;
  if v_current is null then
    raise exception '대상 회원을 찾을 수 없습니다.';
  end if;
  if v_current = p_role then
    return;
  end if;

  -- ── 담임교사로 지정(user → admin) ──
  if p_role = 'admin' then
    if v_withdrawn is not null then
      raise exception '탈퇴한 회원은 담임교사로 지정할 수 없습니다.';
    end if;
    -- 개정 1-2: 담임으로 지정되면 학생 소속은 비운다(트리거가 member_directory 에도 반영).
    update public.profiles set role = 'admin', class_id = null where id = p_user;
    return;
  end if;

  -- ── 담임 해제(admin → user) ──
  if p_user = auth.uid() then
    raise exception '자기 자신의 관리자 권한은 해제할 수 없습니다.';
  end if;
  if (select count(*) from public.profiles where role = 'admin') <= 1 then
    raise exception '마지막 관리자는 해제할 수 없습니다.';
  end if;

  select string_agg(c.name, ', ' order by c.name) into v_blocking
  from public.class_teachers ct
  join public.classes c on c.id = ct.class_id
  where ct.teacher_id = p_user
    and exists (select 1 from public.profiles s where s.class_id = c.id and s.role = 'user')
    and not exists (
      select 1
      from public.class_teachers o
      join public.profiles op on op.id = o.teacher_id
      where o.class_id = c.id
        and o.teacher_id <> p_user
        and op.role = 'admin'
    );
  if v_blocking is not null then
    raise exception '이 선생님이 담임인 학급(%)에 학생이 있어 해제할 수 없습니다. 학급을 먼저 다른 담임에게 넘기거나 학생을 옮겨 학급을 비워 주세요.', v_blocking;
  end if;

  select coalesce(array_agg(ct.class_id), '{}'::uuid[]) into v_classes
  from public.class_teachers ct
  where ct.teacher_id = p_user;

  delete from public.class_teachers where teacher_id = p_user;

  update public.classes c
     set archived_at = coalesce(c.archived_at, now())
   where c.id = any (v_classes)
     and not exists (select 1 from public.class_teachers o where o.class_id = c.id);

  update public.profiles set role = 'user', is_super_admin = false where id = p_user;
end;
$$;

revoke all on function public.admin_set_role(uuid, text) from public, anon;
grant execute on function public.admin_set_role(uuid, text) to authenticated;

-- 5-3. 개요 카드 숫자 (20260921020000 정의를 다시 씀) — 내 학급 학생 기준(총괄도 자기 반 기준, 개정 1-4).
--      반환 모양(열 이름·순서·타입)은 그대로라 화면 코드는 바꾸지 않아도 된다. 관리자가 아니면 빈 결과(원래대로).
--      total_members      = 내 학급 학생 수(탈퇴한 학생 제외 — my_admin_context 의 student_count 합과 같다)
--      results_today      = 오늘(DB 시간대 자정 기준) 내 학급 학생의 웹앱 결과 수
--      pending_submissions = 내 학급 학생의 검토 대기('submitted') 제출물 수
--      unread_feedback    = unread_feedback_count()(4-4 — 자기 반 기준으로 이미 좁혀짐)
create or replace function public.admin_dashboard_stats()
returns table (total_members int, results_today int, pending_submissions int, unread_feedback int)
language sql
stable
security definer
set search_path = ''
as $$
  with my_students as (
    select s.id, s.withdrawn_at
    from public.profiles s
    where s.role = 'user'
      and s.class_id = any (public.my_class_ids())
  )
  select
    (select count(*)::int from my_students ms where ms.withdrawn_at is null),
    (select count(*)::int from public.app_results r
      where r.created_at >= date_trunc('day', now())
        and r.user_id in (select ms.id from my_students ms)),
    (select count(*)::int from public.assignment_submissions a
      where a.status = 'submitted'
        and a.user_id in (select ms.id from my_students ms)),
    public.unread_feedback_count()
  where public.is_admin();
$$;

revoke all on function public.admin_dashboard_stats() from public, anon;
grant execute on function public.admin_dashboard_stats() to authenticated;

-- ═════════════════════════════════════════════
-- 6. 맨 끝 점검 — 학생 기록·회원 표에 관리자 전체 허용(is_admin())이 남아 있으면 전부 되돌린다.
--    (정책은 "허용" 정책끼리 OR 로 합쳐지므로, 옛 정책이 하나라도 남으면 좁히기가 소리 없이 무효가 된다.)
-- ═════════════════════════════════════════════
do $$
declare
  v_policies  text;
  v_functions text;
begin
  select string_agg(format('%s / %s', tablename, policyname), ', ' order by tablename, policyname)
    into v_policies
  from pg_policies
  where schemaname = 'public'
    and tablename in ('member_directory', 'app_results', 'app_progress', 'post_reads', 'assignment_submissions',
                      'feedback_threads', 'feedback_messages', 'feedback_read_marks',
                      'password_reset_log', 'member_withdrawal_log', 'member_create_log')
    and (position('is_admin()' in coalesce(qual, '')) > 0
         or position('is_admin()' in coalesce(with_check, '')) > 0);
  if v_policies is not null then
    raise exception '학생 기록·회원 표에 아직 is_admin() 정책이 남아 있습니다: %. 이 파일 전체를 되돌렸습니다(아무것도 바뀌지 않음) — 이 메시지를 알려 주세요.', v_policies;
  end if;

  select string_agg(p.oid::regprocedure::text, ', ' order by p.oid::regprocedure::text)
    into v_functions
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in ('assignment_submission_guard', 'get_or_create_feedback_thread', 'mark_thread_read',
                      'unread_feedback_count', 'admin_must_change_password_ids', 'admin_set_role',
                      'admin_set_login_required')
    and position('is_admin()' in p.prosrc) > 0;
  if v_functions is not null then
    raise exception '아직 is_admin()으로 판단하는 함수가 남아 있습니다: %. 이 파일 전체를 되돌렸습니다(아무것도 바뀌지 않음) — 이 메시지를 알려 주세요.', v_functions;
  end if;

  raise notice '✔ 학생 기록은 그 학생의 담임만, 회원 명단·감사 로그는 담임(자기 반)·총괄만, 잠금 스위치·담임 지정은 총괄만 쓰도록 바뀌었습니다. 다음: Edge Function 3개 다시 배포.';
end $$;

notify pgrst, 'reload schema';
