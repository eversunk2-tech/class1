-- 비상용 — ③(supabase/migrations/20260927010000_classes_rls.sql) 되돌리기: 학생 기록·회원 표 정책 16개와 함수 8개를 ③ 이전 정의로
-- 근거: docs/classes/review.md §4 제안 (3). 만든 방법·글자 대조 결과: docs/classes/build-rollback-report.md
--
-- ▶ 언제 실행하나
--   ③을 실행한 뒤 수업 중에 문제가 생겨(예: 담임에게 학생 기록이 안 보임) 원인을 찾는 동안 곧바로 ③ 이전 상태로 돌려야 할 때만.
--   먼저 볼 것: 교사 화면에서 학생이 안 보이는 문제는 대개 "학급이 없는 학생"이다. 아래가 0이 아니면 되돌리기보다 학급 지정이 먼저다.
--     select count(*) from public.profiles where role = 'user' and class_id is null;
--   ⚠ 예전 마이그레이션 파일을 통째로 다시 돌려서 되돌리지 않는다(다른 정책·함수까지 덮는다). 이 파일만 쓴다.
--
-- ▶ 실행 방법
--   Supabase 대시보드 > SQL Editor > New query 에 이 파일 전체를 붙여넣고 Run(한 번에 전체).
--   SQL Editor 는 붙여 넣은 전체를 한 트랜잭션으로 실행하므로, 맨 끝 점검에서 오류가 나면 아무것도 바뀌지 않는다.
--   (psql 등 다른 도구로 실행할 때는 psql -1 -v ON_ERROR_STOP=1 -f <파일> 처럼 "한 트랜잭션 + 오류 시 멈춤"으로.)
--   · "destructive operation(drop)" 확인 창이 뜨면 Run — 정책만 지우고 곧바로 다시 만든다. 표·데이터는 하나도 지우지 않는다.
--   · 수업 중에 실행해도 된다: 정책을 바꾸는 짧은 동안 그 표들의 읽기·저장이 잠깐 기다릴 뿐, 기록은 그대로다.
--   · 여러 번 실행해도 안전하다(drop policy if exists + create policy, create or replace function, revoke/grant).
--     ③을 실행하기 전에 잘못 실행해도 바뀌는 것이 없다(③ 이전 정의를 그대로 다시 적을 뿐).
--   · 긴 옛 정책 이름 2개(아래 표시)는 처음 만들 때처럼 긴 이름 그대로 쓴다 — Postgres 가 63바이트로 똑같이 잘라 맞춘다
--     ("will be truncated" NOTICE 는 정상).
--   · 다시 좁히려면: 원인을 고친 뒤 ③ 파일 전체를 다시 Run(재실행 안전 — 옛 이름 정책을 지우고 ③의 정책·함수로 바꾼다).
--
-- ▶ 되돌린 뒤 사이트는(= ③ 이전과 같다)
--   · 학생·비로그인 화면, 과학 앱: 그대로(학생 본인 기록 정책은 ③도 바꾸지 않았다).
--   · 교사(role 'admin') 누구나 모든 학생의 학습 기록(결과·진행·제출·피드백)·회원 명단·감사 로그를 읽을 수 있다.
--   · 관리자 화면은 그대로 동작한다. 학생 명단을 학급으로 거르는 목록은 계속 내 학급만 보이고, 거르지 않는 곳(앱별 결과 등)과
--     개요 카드 숫자는 ③ 이전처럼 전체 기준이 된다. 지금처럼 교사가 총괄 한 명·학생이 모두 부엉이반이면 달라 보이는 것이 거의 없다.
--   · 로그인 잠금 스위치·담임 지정/해제 RPC 는 교사 누구나 부를 수 있게 된다(화면은 여전히 총괄에게만 버튼을 보인다).
--     ⚠ 되돌린 동안에는 담임 지정·해제를 하지 않는다 — 옛 admin_set_role 은 학생 소속 비우기·빈 학급 보관·총괄 표시 끄기를 하지 않는다.
--   · 회원 추가·비밀번호 초기화·탈퇴(Edge Function 3개)는 ①의 표를 직접 읽으므로 학급 규칙(총괄 = 모든 학생, 담임 = 자기 반) 그대로.
--   · 학급·담임·학생 소속(①·②), 학급별 선생님 글(④ class_notices)은 그대로 남는다.
--
-- ▶ 되돌리는 것 — ③이 바꾼 것 전부. 옛 정의는 기존 마이그레이션의 "마지막 정의"를 글자 그대로 옮겼다.
--   정책 16개(③의 새 정책을 지우고 옛 이름·옛 조건 public.is_admin() 으로 다시 만든다):
--     app_results             본인 또는 관리자 조회 · 관리자만 삭제                           (20260921020000)
--     app_progress            관리자 조회                                                     (20260922010000)
--     post_reads              본인 또는 관리자 조회                                           (20260921020000)
--     assignment_submissions  본인 또는 관리자 조회 · 수정 · 본인(마감 전·검토 전) 또는 관리자 삭제 (20260921020000)
--     feedback_threads        본인 또는 관리자 조회 · 관리자만 삭제                           (20260921020000)
--     feedback_messages       스레드 접근 가능자만 조회 · 본인 발신, 스레드 접근 가능해야 함   (20260921020000)
--     feedback_read_marks     본인만 조회/기록(이름은 ③과 같고 조건만 다르다)                 (20260921020000)
--     member_directory · password_reset_log · member_withdrawal_log · member_create_log   관리자만 조회
--                             (20260921020000 · 20260922000000 · 20260923000000 · 20260923030000)
--   함수 8개(본문 + 옛 revoke/grant):
--     admin_must_change_password_ids · assignment_submission_guard · mark_thread_read · get_or_create_feedback_thread (20260922000000)
--     unread_feedback_count · admin_set_role · admin_dashboard_stats (20260921020000) · admin_set_login_required (20260923010000)
--   되돌리지 않는 것:
--     · ①의 표·열·판별 함수(is_super_admin · my_class_ids · teaches_student · can_manage_member)·RPC·트리거 — 지워도 이득이 없고 학급 정보가 사라진다.
--     · ③ 1절의 member_directory.class_id 맞추기 — ①이 만든 복사본 열을 profiles 에 맞춘 것뿐이라 되돌릴 것이 없다.
--     · ③이 "혹시 남아 있으면" 지우던 옛 이름 2개(feedback_threads "본인 또는 관리자 생성", assignment_submissions "관리자만 삭제")는
--       ③ 이전에도 없었다(20260922000000 · 20260921020000 이 이미 지움) → 다시 만들지 않는다.
--
-- ▶ 실행 후 확인 쿼리(앞의 "-- "를 지우고 한 덩어리씩 Run — 모두 읽기만 한다)
--   -- 1) 학생 기록·회원 표 11개에 is_admin() 정책이 다시 16개 있는지(16행)
--   select tablename, policyname, cmd from pg_policies
--   where schemaname = 'public'
--     and tablename in ('member_directory', 'app_results', 'app_progress', 'post_reads', 'assignment_submissions',
--                       'feedback_threads', 'feedback_messages', 'feedback_read_marks',
--                       'password_reset_log', 'member_withdrawal_log', 'member_create_log')
--     and position('is_admin()' in coalesce(qual, '') || coalesce(with_check, '')) > 0
--   order by 1, 2;
--
--   -- 2) 같은 11개 표에 ③의 학급 판별 정책(teaches_student / can_manage_member)이 남지 않았는지(0행)
--   select tablename, policyname from pg_policies
--   where schemaname = 'public'
--     and tablename in ('member_directory', 'app_results', 'app_progress', 'post_reads', 'assignment_submissions',
--                       'feedback_threads', 'feedback_messages', 'feedback_read_marks',
--                       'password_reset_log', 'member_withdrawal_log', 'member_create_log')
--     and (position('teaches_student(' in coalesce(qual, '') || coalesce(with_check, '')) > 0
--          or position('can_manage_member(' in coalesce(qual, '') || coalesce(with_check, '')) > 0);
--
--   -- 3) 함수 8개가 옛 판단으로 돌아왔는지(8행 — 옛_판단 true, 학급_판단 false)
--   select p.oid::regprocedure as 함수,
--          position('is_admin()' in p.prosrc) > 0 as 옛_판단,
--          (position('teaches_student(' in p.prosrc) > 0 or position('can_manage_member(' in p.prosrc) > 0
--           or position('is_super_admin(' in p.prosrc) > 0 or position('my_class_ids(' in p.prosrc) > 0) as 학급_판단
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public'
--     and p.proname in ('admin_must_change_password_ids', 'assignment_submission_guard', 'get_or_create_feedback_thread',
--                       'mark_thread_read', 'unread_feedback_count', 'admin_set_login_required', 'admin_set_role',
--                       'admin_dashboard_stats')
--   order by p.proname;
--
--   -- 4) 함수 실행 권한이 그대로인지(앞 2개 false, 뒤 2개 true)
--   select has_function_privilege('anon', 'public.admin_set_role(uuid, text)', 'execute')                           as anon_역할,
--          has_function_privilege('anon', 'public.admin_set_login_required(boolean)', 'execute')                  as anon_잠금,
--          has_function_privilege('authenticated', 'public.admin_dashboard_stats()', 'execute')                   as 로그인_개요,
--          has_function_privilege('authenticated', 'public.get_or_create_feedback_thread(uuid, text, uuid)', 'execute') as 로그인_대화;
--
--   -- 5) 학급 정보는 그대로인지(되돌리기 전에 같은 쿼리로 센 숫자와 같아야 한다)
--   select (select count(*) from public.classes) as 학급,
--          (select count(*) from public.class_teachers) as 담임_연결,
--          (select count(*) from public.profiles where role = 'user' and class_id is not null) as 학급_있는_학생,
--          (select count(*) from public.profiles where is_super_admin) as 총괄;

-- ═════════════════════════════════════════════
-- 0. 알림만(멈추지 않음) — ③이 적용된 흔적이 있는지
-- ═════════════════════════════════════════════
do $$
declare
  v_found int;
begin
  select count(*) into v_found
  from pg_policies
  where schemaname = 'public'
    and tablename in ('member_directory', 'app_results', 'app_progress', 'post_reads', 'assignment_submissions',
                      'feedback_threads', 'feedback_messages', 'feedback_read_marks',
                      'password_reset_log', 'member_withdrawal_log', 'member_create_log')
    and (position('teaches_student(' in coalesce(qual, '') || coalesce(with_check, '')) > 0
         or position('can_manage_member(' in coalesce(qual, '') || coalesce(with_check, '')) > 0);
  if v_found = 0 then
    raise notice '③(20260927010000_classes_rls.sql)을 적용한 흔적(학급 판별 정책)이 없습니다. 이 파일은 ③ 이전 정의를 다시 적을 뿐이라 그대로 실행해도 안전합니다.';
  else
    raise notice '③의 학급 판별 정책 %개를 ③ 이전 정의로 되돌립니다.', v_found;
  end if;
end $$;

-- ═════════════════════════════════════════════
-- 2. (가) 학생 기록 정책 12개 — ③의 정책을 지우고 ③ 이전 정의를 글자 그대로 다시 만든다(번호는 ③과 같게.
--    ③ 1절 member_directory.class_id 맞추기는 ①의 복사본 열을 profiles 에 맞춘 데이터라 되돌릴 것이 없다)
--    재귀(42P17) 없음: 옛 정의 그대로다. feedback_messages · feedback_read_marks 정책은 feedback_threads 를 조회하고,
--    그 표의 정책은 is_admin()(security definer → profiles)만 부른다 — ③ 이전에 쓰던 모양 그대로.
-- ═════════════════════════════════════════════

-- 2-1. app_results (20260921020000_admin_learning.sql)
drop policy if exists "app_results: 본인 또는 담임 조회" on public.app_results;
drop policy if exists "app_results: 본인 또는 관리자 조회" on public.app_results;
create policy "app_results: 본인 또는 관리자 조회"
  on public.app_results for select
  using (auth.uid() = user_id or public.is_admin());

drop policy if exists "app_results: 담임만 삭제" on public.app_results;
drop policy if exists "app_results: 관리자만 삭제" on public.app_results;
create policy "app_results: 관리자만 삭제"
  on public.app_results for delete
  to authenticated
  using (public.is_admin());

-- 2-2. app_progress (20260922010000_app_progress.sql)
drop policy if exists "app_progress: 담임 조회" on public.app_progress;
drop policy if exists "app_progress: 관리자 조회" on public.app_progress;
create policy "app_progress: 관리자 조회"
  on public.app_progress for select
  to authenticated
  using (public.is_admin());

-- 2-3. post_reads (20260921020000)
drop policy if exists "post_reads: 본인 또는 담임 조회" on public.post_reads;
drop policy if exists "post_reads: 본인 또는 관리자 조회" on public.post_reads;
create policy "post_reads: 본인 또는 관리자 조회"
  on public.post_reads for select
  using (auth.uid() = user_id or public.is_admin());

-- 2-4. assignment_submissions (20260921020000)
drop policy if exists "assignment_submissions: 본인 또는 담임 조회" on public.assignment_submissions;
drop policy if exists "assignment_submissions: 본인 또는 관리자 조회" on public.assignment_submissions;
create policy "assignment_submissions: 본인 또는 관리자 조회"
  on public.assignment_submissions for select
  using (auth.uid() = user_id or public.is_admin());

drop policy if exists "assignment_submissions: 본인 또는 담임 수정" on public.assignment_submissions;
drop policy if exists "assignment_submissions: 본인 또는 관리자 수정" on public.assignment_submissions;
create policy "assignment_submissions: 본인 또는 관리자 수정"
  on public.assignment_submissions for update
  to authenticated
  using (auth.uid() = user_id or public.is_admin())
  with check (auth.uid() = user_id or public.is_admin());

-- 옛 이름이 78바이트라 처음 만들 때 63바이트로 잘려 저장됐다. 긴 이름 그대로 쓰면 drop · create 모두 똑같이 잘려 맞는다.
drop policy if exists "assignment_submissions: 본인 또는 담임 삭제" on public.assignment_submissions;
drop policy if exists "assignment_submissions: 본인(마감 전·검토 전) 또는 관리자 삭제" on public.assignment_submissions;
create policy "assignment_submissions: 본인(마감 전·검토 전) 또는 관리자 삭제"
  on public.assignment_submissions for delete
  to authenticated
  using (
    public.is_admin()
    or (
      auth.uid() = user_id
      and status <> 'reviewed'
      and exists (
        select 1 from public.assignments a
        where a.id = assignment_id and (a.due_at is null or now() < a.due_at)
      )
    )
  );

-- 2-5. feedback_threads (20260921020000)
--      insert 정책("본인 또는 관리자 생성")은 20260922000000 이 지웠다(RPC 로만 생성) → ③ 이전에도 없었으므로 다시 만들지 않는다.
drop policy if exists "feedback_threads: 본인 또는 담임 조회" on public.feedback_threads;
drop policy if exists "feedback_threads: 본인 또는 관리자 조회" on public.feedback_threads;
create policy "feedback_threads: 본인 또는 관리자 조회"
  on public.feedback_threads for select
  using (auth.uid() = student_id or public.is_admin());

drop policy if exists "feedback_threads: 담임만 삭제" on public.feedback_threads;
drop policy if exists "feedback_threads: 관리자만 삭제" on public.feedback_threads;
create policy "feedback_threads: 관리자만 삭제"
  on public.feedback_threads for delete
  to authenticated
  using (public.is_admin());

-- 2-6. feedback_messages (20260921020000)
drop policy if exists "feedback_messages: 본인·담임 스레드만 조회" on public.feedback_messages;
drop policy if exists "feedback_messages: 스레드 접근 가능자만 조회" on public.feedback_messages;
create policy "feedback_messages: 스레드 접근 가능자만 조회"
  on public.feedback_messages for select
  using (
    public.is_admin()
    or exists (select 1 from public.feedback_threads t where t.id = thread_id and t.student_id = auth.uid())
  );

-- 옛 이름이 67바이트라 처음 만들 때 63바이트로 잘려 저장됐다(위와 같이 똑같이 잘려 맞는다).
drop policy if exists "feedback_messages: 본인 발신, 본인·담임 스레드만" on public.feedback_messages;
drop policy if exists "feedback_messages: 본인 발신, 스레드 접근 가능해야 함" on public.feedback_messages;
create policy "feedback_messages: 본인 발신, 스레드 접근 가능해야 함"
  on public.feedback_messages for insert
  to authenticated
  with check (
    auth.uid() = sender_id
    and (
      public.is_admin()
      or exists (select 1 from public.feedback_threads t where t.id = thread_id and t.student_id = auth.uid())
    )
  );

-- 2-7. feedback_read_marks (20260921020000) — ③과 이름이 같다(조건만 되돌린다)
drop policy if exists "feedback_read_marks: 본인만 조회/기록" on public.feedback_read_marks;
create policy "feedback_read_marks: 본인만 조회/기록"
  on public.feedback_read_marks for all
  to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (
      public.is_admin()
      or exists (select 1 from public.feedback_threads t where t.id = thread_id and t.student_id = auth.uid())
    )
  );

-- ═════════════════════════════════════════════
-- 3. (나) 회원 표 정책 4개 + 함수 1개 — ③ 이전 정의(관리자 누구나)
-- ═════════════════════════════════════════════

-- 3-1. member_directory (20260921020000 — 대상 역할 지정 없음)
drop policy if exists "member_directory: 담임·총괄 조회" on public.member_directory;
drop policy if exists "member_directory: 관리자만 조회" on public.member_directory;
create policy "member_directory: 관리자만 조회"
  on public.member_directory for select
  using (public.is_admin());

-- 3-2. password_reset_log (20260922000000_admin_learning_fixes.sql)
drop policy if exists "password_reset_log: 담임·총괄 조회" on public.password_reset_log;
drop policy if exists "password_reset_log: 관리자만 조회" on public.password_reset_log;
create policy "password_reset_log: 관리자만 조회"
  on public.password_reset_log for select
  to authenticated
  using (public.is_admin());

-- 3-3. member_withdrawal_log (20260923000000_member_withdrawal.sql)
drop policy if exists "member_withdrawal_log: 담임·총괄 조회" on public.member_withdrawal_log;
drop policy if exists "member_withdrawal_log: 관리자만 조회" on public.member_withdrawal_log;
create policy "member_withdrawal_log: 관리자만 조회"
  on public.member_withdrawal_log for select
  to authenticated
  using (public.is_admin());

-- 3-4. member_create_log (20260923030000_member_create_log.sql)
drop policy if exists "member_create_log: 담임·총괄 조회" on public.member_create_log;
drop policy if exists "member_create_log: 관리자만 조회" on public.member_create_log;
create policy "member_create_log: 관리자만 조회"
  on public.member_create_log for select
  to authenticated
  using (public.is_admin());

-- 3-5. admin_must_change_password_ids() (20260922000000)
create or replace function public.admin_must_change_password_ids()
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(p.id), '{}'::uuid[])
  from public.profiles p
  where p.must_change_password and public.is_admin();
$$;

revoke all on function public.admin_must_change_password_ids() from public, anon;
grant execute on function public.admin_must_change_password_ids() to authenticated;

-- ═════════════════════════════════════════════
-- 4. (가) 학생 기록 함수 4개 — ③ 이전 본문(is_admin()) 글자 그대로
-- ═════════════════════════════════════════════

-- 4-1. 제출물 가드 트리거 (20260922000000 #3). 옛 파일에도 revoke/grant 가 없다(트리거 전용, security invoker).
create or replace function public.assignment_submission_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_content_changed boolean;
begin
  if tg_op = 'INSERT' then
    if not public.is_admin() then
      new.status := 'submitted';
      new.submitted_at := now();
    end if;
    return new;
  end if;

  if new.user_id is distinct from old.user_id or new.assignment_id is distinct from old.assignment_id then
    raise exception '제출 대상은 바꿀 수 없습니다.';
  end if;

  v_content_changed := new.body_md is distinct from old.body_md or new.link_url is distinct from old.link_url;

  if public.is_admin() and auth.uid() is distinct from old.user_id then
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
      if old.status = 'reviewed' and not public.is_admin() then
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

-- 4-2. 피드백 스레드 찾기/만들기 (20260922000000 #8)
create or replace function public.get_or_create_feedback_thread(p_student_id uuid, p_context_type text, p_context_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null or not (auth.uid() = p_student_id or public.is_admin()) then
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

-- 4-3. 읽음 표시 (20260922000000 #5)
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
    where t.id = p_thread_id and (t.student_id = auth.uid() or public.is_admin())
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

-- 4-4. 안 읽은 피드백 수 (20260921020000)
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
    and (public.is_admin() or t.student_id = auth.uid())
    and m.created_at > coalesce(r.last_read_at, '-infinity'::timestamptz);
$$;

revoke all on function public.unread_feedback_count() from public, anon;
grant execute on function public.unread_feedback_count() to authenticated;

-- ═════════════════════════════════════════════
-- 5. (다)(라) 함수 3개 — ③ 이전 본문 글자 그대로(관리자 누구나 · 전체 기준 숫자)
-- ═════════════════════════════════════════════

-- 5-1. 로그인 잠금 스위치 (20260923010000_login_required.sql)
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

-- 5-2. 관리자 지정/해제 (20260921020000)
create or replace function public.admin_set_role(p_user uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current text;
begin
  if not public.is_admin() then
    raise exception '관리자만 사용할 수 있습니다.';
  end if;
  if p_role not in ('admin', 'user') then
    raise exception '잘못된 역할입니다.';
  end if;

  -- 동시에 두 관리자가 서로를 해제하는 경쟁을 막기 위해 관리자 행을 잠근다.
  perform 1 from public.profiles where role = 'admin' for update;

  select role into v_current from public.profiles where id = p_user;
  if v_current is null then
    raise exception '대상 회원을 찾을 수 없습니다.';
  end if;
  if v_current = p_role then
    return;
  end if;

  if p_role = 'user' then
    if p_user = auth.uid() then
      raise exception '자기 자신의 관리자 권한은 해제할 수 없습니다.';
    end if;
    if (select count(*) from public.profiles where role = 'admin') <= 1 then
      raise exception '마지막 관리자는 해제할 수 없습니다.';
    end if;
  end if;

  update public.profiles set role = p_role where id = p_user;
end;
$$;

revoke all on function public.admin_set_role(uuid, text) from public, anon;
grant execute on function public.admin_set_role(uuid, text) to authenticated;

-- 5-3. 개요 카드 숫자 (20260921020000) — 반환 모양은 ③과 같다(화면 코드 그대로)
create or replace function public.admin_dashboard_stats()
returns table (total_members int, results_today int, pending_submissions int, unread_feedback int)
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select count(*)::int from public.member_directory),
    (select count(*)::int from public.app_results where created_at >= date_trunc('day', now())),
    (select count(*)::int from public.assignment_submissions where status = 'submitted'),
    public.unread_feedback_count()
  where public.is_admin();
$$;

revoke all on function public.admin_dashboard_stats() from public, anon;
grant execute on function public.admin_dashboard_stats() to authenticated;

-- ═════════════════════════════════════════════
-- 6. 맨 끝 점검 — 하나라도 어긋나면 오류를 내고 이 파일 전체를 되돌린다(아무것도 바뀌지 않음).
--    이름 비교는 ::name 으로 바꿔서 한다 → 긴 이름 2개도 Postgres 가 저장할 때와 똑같이 63바이트로 잘려 비교된다.
-- ═════════════════════════════════════════════
do $$
declare
  v_missing  text;
  v_leftover text;
  v_class    text;
  v_funcs    text;
begin
  -- (1) ③ 이전 정책 16개가 모두 있고, 조건에 is_admin() 이 들어 있는지(이름이 같은 feedback_read_marks 도 옛 조건인지 확인된다)
  select string_agg(format('%s / %s', e.tbl, e.pol), ', ' order by e.tbl, e.pol)
    into v_missing
  from (values
    ('app_results',            'app_results: 본인 또는 관리자 조회'),
    ('app_results',            'app_results: 관리자만 삭제'),
    ('app_progress',           'app_progress: 관리자 조회'),
    ('post_reads',             'post_reads: 본인 또는 관리자 조회'),
    ('assignment_submissions', 'assignment_submissions: 본인 또는 관리자 조회'),
    ('assignment_submissions', 'assignment_submissions: 본인 또는 관리자 수정'),
    ('assignment_submissions', 'assignment_submissions: 본인(마감 전·검토 전) 또는 관리자 삭제'),
    ('feedback_threads',       'feedback_threads: 본인 또는 관리자 조회'),
    ('feedback_threads',       'feedback_threads: 관리자만 삭제'),
    ('feedback_messages',      'feedback_messages: 스레드 접근 가능자만 조회'),
    ('feedback_messages',      'feedback_messages: 본인 발신, 스레드 접근 가능해야 함'),
    ('feedback_read_marks',    'feedback_read_marks: 본인만 조회/기록'),
    ('member_directory',       'member_directory: 관리자만 조회'),
    ('password_reset_log',     'password_reset_log: 관리자만 조회'),
    ('member_withdrawal_log',  'member_withdrawal_log: 관리자만 조회'),
    ('member_create_log',      'member_create_log: 관리자만 조회')
  ) as e(tbl, pol)
  where not exists (
    select 1 from pg_policies p
    where p.schemaname = 'public'
      and p.tablename = e.tbl::name
      and p.policyname = e.pol::name
      and position('is_admin()' in coalesce(p.qual, '') || coalesce(p.with_check, '')) > 0
  );
  if v_missing is not null then
    raise exception '③ 이전 정책이 다시 만들어지지 않았습니다: %. 이 파일 전체를 되돌렸습니다(아무것도 바뀌지 않음) — 이 메시지를 알려 주세요.', v_missing;
  end if;

  -- (2) ③이 만든 새 이름 정책 15개가 남지 않았는지
  select string_agg(format('%s / %s', e.tbl, e.pol), ', ' order by e.tbl, e.pol)
    into v_leftover
  from (values
    ('app_results',            'app_results: 본인 또는 담임 조회'),
    ('app_results',            'app_results: 담임만 삭제'),
    ('app_progress',           'app_progress: 담임 조회'),
    ('post_reads',             'post_reads: 본인 또는 담임 조회'),
    ('assignment_submissions', 'assignment_submissions: 본인 또는 담임 조회'),
    ('assignment_submissions', 'assignment_submissions: 본인 또는 담임 수정'),
    ('assignment_submissions', 'assignment_submissions: 본인 또는 담임 삭제'),
    ('feedback_threads',       'feedback_threads: 본인 또는 담임 조회'),
    ('feedback_threads',       'feedback_threads: 담임만 삭제'),
    ('feedback_messages',      'feedback_messages: 본인·담임 스레드만 조회'),
    ('feedback_messages',      'feedback_messages: 본인 발신, 본인·담임 스레드만'),
    ('member_directory',       'member_directory: 담임·총괄 조회'),
    ('password_reset_log',     'password_reset_log: 담임·총괄 조회'),
    ('member_withdrawal_log',  'member_withdrawal_log: 담임·총괄 조회'),
    ('member_create_log',      'member_create_log: 담임·총괄 조회')
  ) as e(tbl, pol)
  where exists (
    select 1 from pg_policies p
    where p.schemaname = 'public'
      and p.tablename = e.tbl::name
      and p.policyname = e.pol::name
  );
  if v_leftover is not null then
    raise exception '③의 새 정책이 아직 남아 있습니다: %. 이 파일 전체를 되돌렸습니다(아무것도 바뀌지 않음) — 이 메시지를 알려 주세요.', v_leftover;
  end if;

  -- (3) 11개 표의 어떤 정책도 학급 판별 함수(teaches_student / can_manage_member)를 쓰지 않는지
  select string_agg(format('%s / %s', tablename, policyname), ', ' order by tablename, policyname)
    into v_class
  from pg_policies
  where schemaname = 'public'
    and tablename in ('member_directory', 'app_results', 'app_progress', 'post_reads', 'assignment_submissions',
                      'feedback_threads', 'feedback_messages', 'feedback_read_marks',
                      'password_reset_log', 'member_withdrawal_log', 'member_create_log')
    and (position('teaches_student(' in coalesce(qual, '') || coalesce(with_check, '')) > 0
         or position('can_manage_member(' in coalesce(qual, '') || coalesce(with_check, '')) > 0);
  if v_class is not null then
    raise exception '학생 기록·회원 표에 학급 판별 정책이 남아 있습니다: %. 이 파일 전체를 되돌렸습니다(아무것도 바뀌지 않음) — 이 메시지를 알려 주세요.', v_class;
  end if;

  -- (4) 함수 8개가 있고, 옛 판단(is_admin())으로 돌아왔고, 학급 판별 함수를 부르지 않는지
  select string_agg(f.sig, ', ' order by f.sig)
    into v_funcs
  from (values
    ('admin_must_change_password_ids()',                   to_regprocedure('public.admin_must_change_password_ids()')),
    ('assignment_submission_guard()',                      to_regprocedure('public.assignment_submission_guard()')),
    ('get_or_create_feedback_thread(uuid, text, uuid)',    to_regprocedure('public.get_or_create_feedback_thread(uuid, text, uuid)')),
    ('mark_thread_read(uuid, timestamptz)',                to_regprocedure('public.mark_thread_read(uuid, timestamptz)')),
    ('unread_feedback_count()',                            to_regprocedure('public.unread_feedback_count()')),
    ('admin_set_login_required(boolean)',                  to_regprocedure('public.admin_set_login_required(boolean)')),
    ('admin_set_role(uuid, text)',                         to_regprocedure('public.admin_set_role(uuid, text)')),
    ('admin_dashboard_stats()',                            to_regprocedure('public.admin_dashboard_stats()'))
  ) as f(sig, fn)
  left join pg_proc p on p.oid = f.fn::oid
  where p.oid is null
     or position('is_admin()' in p.prosrc) = 0
     or position('teaches_student(' in p.prosrc) > 0
     or position('can_manage_member(' in p.prosrc) > 0
     or position('is_super_admin(' in p.prosrc) > 0
     or position('my_class_ids(' in p.prosrc) > 0;
  if v_funcs is not null then
    raise exception '③ 이전 본문으로 돌아오지 않은 함수가 있습니다: %. 이 파일 전체를 되돌렸습니다(아무것도 바뀌지 않음) — 이 메시지를 알려 주세요.', v_funcs;
  end if;

  raise notice '✔ ③ 이전 상태로 되돌렸습니다: 학생 기록·회원 표 정책 16개와 함수 8개가 다시 "관리자 누구나(is_admin())" 기준입니다. 학급·담임·학생 소속과 선생님 글은 그대로입니다. 다시 좁히려면 원인을 고친 뒤 ③ 파일을 다시 실행하세요.';
end $$;

notify pgrst, 'reload schema';
