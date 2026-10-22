-- 학급 삭제 — 화면용 RPC 2개(admin_class_delete_preview · admin_delete_class)만 더한다
-- 설계: docs/classes/delete-class/spec.md(2026-10-22 사용자 승인 — 권한 = 그 학급 담임과 총괄, 과제·선생님 글은 학급과 함께 지우기)
-- 화면 글 원문: docs/privacy/privacy-policy.md 8-9(아래 오류 문구는 원문 글자 그대로)
-- 지침: docs/classes/delete-class/build-instructions.md · 보고: docs/classes/delete-class/build-report.md
--
-- ▶ 이 파일이 하는 일 — 새 함수 2개만 만든다. 기존 표·열·정책·함수·트리거·외래키는 하나도 고치지 않는다(새 외래키도 없음).
--   · admin_class_delete_preview(p_class_id uuid) → {"class_name", "students", "assignments", "notices"}
--       students    = 그 학급(profiles.class_id)의 학생 계정(role 'user') 전부 — 탈퇴 처리된 학생 포함(학급 정리 미리보기와 같은 기준)
--       assignments = 그 학급의 과제 수, notices = 그 학급의 선생님 글 수
--   · admin_delete_class(p_class_id uuid, p_confirm_name text) → {"ok": true, "assignments", "notices"}(지운 과제·선생님 글 수)
--       1) 로그인한 교사(is_admin) — 아니면 권한 문구
--       2) 학급 줄을 잠근다(for update) — 같은 학급을 두 번 지우거나, 지우는 동안 학생·과제·선생님 글이 이 학급에 새로 붙지 않게
--          (학생 등록·과제·선생님 글을 넣을 때의 외래키 확인이 이 잠금을 기다리고, 학급이 지워졌으면 그쪽이 실패한다).
--          학급이 없으면 '학급을 찾을 수 없습니다.'(다른 창에서 이미 지운 경우 — 권한 문구보다 먼저 알린다)
--       3) 그 학급의 담임(class_teachers — my_class_ids()) 또는 총괄(is_super_admin()) — 아니면 권한 문구
--       4) 학급 이름 = 입력한 이름(둘 다 앞뒤 공백을 뺀 값 — privacy_btrim, 화면의 String.trim()과 같은 글자) — 아니면 이름 문구
--       5) 학생 계정이 1명이라도 있으면(탈퇴 처리된 학생 포함) 거부 — 먼저 [학급 정리]
--       6) 그 학급의 과제 삭제(→ 제출물 assignment_submissions 는 cascade) → 학급 삭제(→ 담임 연결 class_teachers ·
--          선생님 글 class_notices 는 cascade, profiles.class_id · member_directory.class_id 는 set null — 학생이 0명이라 보통 없음)
--       · 남는 것: 선생님 계정(담임 연결만 사라짐), 학급 정리 기록 class_cleanup_log(외래키 없음 — 지운 인원수·학급 이름 글자),
--         학습게임·블로그 글(학급과 상관없음). 선생님이 먼저 맡은 다른 학급이 없으면 그 선생님의 자유게시판은 더 이상 보이지
--         않는다(글은 남음 — 다시 학급을 개설하면 다시 보인다, 09-28 담임교사별 게시판 설계).
--       · 피드백 대화(feedback_threads)는 제출물을 외래키 없이 가리키므로 남는다(과제를 하나씩 지울 때와 같음 — "삭제된 제출물").
--   · 권한: 두 함수 모두 security definer · search_path '' · 로그인한 사용자(authenticated)만 실행(비로그인·PUBLIC 회수).
--     학급 정리 미리보기(admin_class_cleanup_preview — 20261020000000_privacy_a_schema.sql 8-1)와 같은 판단(is_admin · my_class_ids ·
--     is_super_admin)을 쓴다. 담임(teacher_scope 'class' 선생님 포함 — 자기 학급 일)과 총괄만 된다.
--   · 오류 문구(화면이 그대로 보인다 — privacy-policy.md 8-9 원문 글자 그대로):
--       권한이 없을 때: 이 학급의 담임 선생님이나 총괄 선생님만 학급을 삭제할 수 있어요.
--       이름이 다를 때: 학급 이름이 맞지 않아요. 학급 이름을 그대로 입력해 주세요.
--       학생이 남아 있을 때: 학생 계정이 {n}명 남아 있어요. 먼저 [학급 정리]로 학생 계정과 기록을 지운 뒤 학급을 삭제해 주세요.
--       학급이 없을 때(기존 문구): 학급을 찾을 수 없습니다.
--   · 재귀(42P17) 없음: 정책을 만들지 않는다. 함수는 security definer(소유자 postgres)라 표의 RLS 를 거치지 않는다.
--
-- ▶ 실행 순서(spec "배포 순서")
--   ① 이 파일(SQL Editor) → ② 아래 확인 쿼리 1)·2) → ③ 사이트(화면) push → ④ 빈 연습용 학급으로 [학급 삭제] 확인 → 확인 쿼리 3).
--   · 화면이 먼저 배포돼도 안전하다: 함수가 없으면 화면은 [학급 삭제] 단추를 숨긴다(오류 화면 없음).
--   · 개인정보 SQL ②(20261020010000) 뒤이므로 앞선 마이그레이션을 다시 실행하지 않는다(CLAUDE.md). 이 파일은 앞선 파일을 고치지 않는다.
--
-- ▶ 실행 방법
--   Supabase 대시보드 > SQL Editor > New query 에 이 파일 전체를 붙여넣고 Run.
--   SQL Editor 는 붙여 넣은 전체를 한 트랜잭션으로 실행하므로 중간에 오류가 나면 아무것도 바뀌지 않는다.
--   (psql 등 다른 도구로 실행할 때는 psql -1 -v ON_ERROR_STOP=1 -f <파일> 처럼 "한 트랜잭션 + 오류 시 멈춤"으로.)
--   · 여러 번 실행해도 안전하다(create or replace function, revoke/grant).
--   · 맨 앞 점검: 앞선 표·열·함수(학급 ①·④·⑥, 개인정보 ①의 privacy_btrim)가 없으면 오류를 내고 아무것도 바꾸지 않는다.
--   · 맨 끝 점검: 두 함수가 없거나, 비로그인(anon)이 부를 수 있거나, 로그인한 사용자가 못 부르거나, 학급 삭제를 막는 외래키
--     (restrict / no action — 과제의 학급 열은 이 함수가 먼저 과제를 지우므로 빼고)가 있으면 오류를 내고 전부 되돌린다.
--   · 성공하면 "✔ 학급 삭제 함수 2개를 만들었습니다 …" 알림이 나온다.
--   ⚠ 이 파일의 함수를 SQL Editor 에서 직접 부르지 않는다(SQL Editor 에는 auth.uid()가 없어 늘 권한 문구로 거부된다). 화면으로 한다.
--
-- ▶ 실행 후 확인 쿼리(앞의 "-- "를 지우고 한 덩어리씩 Run — 모두 읽기만 한다)
--   -- 1) 함수 권한 — 비로그인 false · 로그인 true 가 두 줄
--   select f as 함수,
--          has_function_privilege('anon', f, 'execute')          as 비로그인_실행,
--          has_function_privilege('authenticated', f, 'execute') as 로그인_실행
--   from unnest(array['public.admin_class_delete_preview(uuid)', 'public.admin_delete_class(uuid, text)']) as t(f);
--
--   -- 2) 학급(classes)을 가리키는 외래키의 on delete — assignments 만 r(restrict), 나머지는 c(cascade) 또는 n(set null)
--   --    (class_teachers c · class_notices c · profiles n · member_directory n · assignments r)
--   select c.relname as 표, con.conname as 제약, con.confdeltype as on_delete
--   from pg_constraint con join pg_class c on c.oid = con.conrelid
--   where con.contype = 'f' and con.confrelid = 'public.classes'::regclass
--   order by 1, 2;
--
--   -- 3) (화면으로 지운 뒤) 학급 목록 — 지운 학급이 없어야 한다. 학급 정리 기록(지운 인원수)은 그대로 남는다.
--   select c.name as 학급, c.archived_at as 보관, c.created_at as 만든날,
--          (select count(*) from public.class_teachers t where t.class_id = c.id) as 담임수
--   from public.classes c
--   order by c.created_at;
--   select l.class_name as 정리한_학급, l.student_count as 지운_인원, l.created_at as 정리한_때
--   from public.class_cleanup_log l
--   order by l.created_at desc
--   limit 5;
--
--   -- 4) (화면으로 지운 뒤) 학급 없는 과제·선생님 글이 생기지 않았는지 — 둘 다 0
--   select (select count(*) from public.assignments a where a.class_id is not null
--             and not exists (select 1 from public.classes c where c.id = a.class_id))  as 주인없는_과제,
--          (select count(*) from public.class_notices n
--             where not exists (select 1 from public.classes c where c.id = n.class_id)) as 주인없는_선생님글;
--
-- ▶ 되돌리기 — 새 함수 둘만 있으므로 기능을 끄려면 함수만 지운다(화면은 [학급 삭제] 단추를 숨긴다):
--   drop function if exists public.admin_delete_class(uuid, text);
--   drop function if exists public.admin_class_delete_preview(uuid);
--   이미 지운 학급·과제·선생님 글은 되돌릴 수 없다(무료 요금제 — 자동 백업 없음).

-- ═════════════════════════════════════════════
-- 0. 맨 앞 점검 — 앞 단계가 안 됐으면 아무것도 바꾸지 않는다
-- ═════════════════════════════════════════════
do $$
begin
  if to_regclass('public.classes') is null
     or to_regclass('public.class_teachers') is null
     or to_regclass('public.class_notices') is null
     or to_regclass('public.assignments') is null
     or not exists (
       select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'assignments' and column_name = 'class_id'
     )
     or not exists (
       select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'profiles' and column_name = 'class_id'
     )
     or to_regprocedure('public.is_admin()') is null
     or to_regprocedure('public.is_super_admin()') is null
     or to_regprocedure('public.my_class_ids()') is null
     or to_regprocedure('public.privacy_btrim(text)') is null then
    raise exception '앞선 마이그레이션(학급 20260927000000·20260927020000·20260927040000, 개인정보 ① 20261020000000_privacy_a_schema.sql)이 먼저 실행돼 있어야 합니다. 이 파일은 아무것도 바꾸지 않았습니다.';
  end if;
end $$;

-- ═════════════════════════════════════════════
-- 1. admin_class_delete_preview — 확인 창이 열릴 때 학생·과제·선생님 글 수를 보여 준다(읽기만)
-- ═════════════════════════════════════════════
create or replace function public.admin_class_delete_preview(p_class_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_name text;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception '이 학급의 담임 선생님이나 총괄 선생님만 학급을 삭제할 수 있어요.';
  end if;
  select c.name into v_name from public.classes c where c.id = p_class_id;
  if not found then
    raise exception '학급을 찾을 수 없습니다.';
  end if;
  if not (p_class_id = any (public.my_class_ids()) or public.is_super_admin()) then
    raise exception '이 학급의 담임 선생님이나 총괄 선생님만 학급을 삭제할 수 있어요.';
  end if;

  return jsonb_build_object(
    'class_name', v_name,
    'students', (select count(*)::int from public.profiles s where s.class_id = p_class_id and s.role = 'user'),
    'assignments', (select count(*)::int from public.assignments a where a.class_id = p_class_id),
    'notices', (select count(*)::int from public.class_notices n where n.class_id = p_class_id)
  );
end;
$$;

-- ═════════════════════════════════════════════
-- 2. admin_delete_class — 학생이 없는 학급을 과제·선생님 글과 함께 지운다(되돌릴 수 없음)
-- ═════════════════════════════════════════════
create or replace function public.admin_delete_class(p_class_id uuid, p_confirm_name text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name        text;
  v_students    int;
  v_assignments int;
  v_notices     int;
begin
  -- 1) 로그인한 교사
  if auth.uid() is null or not public.is_admin() then
    raise exception '이 학급의 담임 선생님이나 총괄 선생님만 학급을 삭제할 수 있어요.';
  end if;

  -- 2) 학급 줄 잠금(트랜잭션이 끝나면 풀린다) — 동시에 두 번 지우기 · 지우는 동안 학생 등록/과제/선생님 글 붙기를 한 줄로 세운다.
  select c.name into v_name
  from public.classes c
  where c.id = p_class_id
  for update;
  if not found then
    raise exception '학급을 찾을 수 없습니다.';
  end if;

  -- 3) 그 학급의 담임 또는 총괄
  if not (p_class_id = any (public.my_class_ids()) or public.is_super_admin()) then
    raise exception '이 학급의 담임 선생님이나 총괄 선생님만 학급을 삭제할 수 있어요.';
  end if;

  -- 4) 학급 이름(앞뒤 공백을 뺀 값)이 같아야 한다
  if p_confirm_name is null
     or public.privacy_btrim(p_confirm_name) = ''
     or public.privacy_btrim(p_confirm_name) is distinct from public.privacy_btrim(v_name) then
    raise exception '학급 이름이 맞지 않아요. 학급 이름을 그대로 입력해 주세요.';
  end if;

  -- 5) 학생 계정이 남아 있으면 거부(탈퇴 처리된 학생 포함 — 학급 정리 미리보기와 같은 기준)
  select count(*)::int into v_students
  from public.profiles s
  where s.class_id = p_class_id
    and s.role = 'user';
  if v_students > 0 then
    raise exception '학생 계정이 %명 남아 있어요. 먼저 [학급 정리]로 학생 계정과 기록을 지운 뒤 학급을 삭제해 주세요.', v_students;
  end if;

  -- 6) 과제(→ 제출물 cascade) → 학급(→ 담임 연결 · 선생님 글 cascade)
  delete from public.assignments a
  where a.class_id = p_class_id;
  get diagnostics v_assignments = row_count;

  select count(*)::int into v_notices
  from public.class_notices n
  where n.class_id = p_class_id;

  delete from public.classes c
  where c.id = p_class_id;

  return jsonb_build_object('ok', true, 'assignments', v_assignments, 'notices', v_notices);
end;
$$;

-- Supabase 는 public 스키마 함수에 anon/authenticated 실행 권한을 기본으로 주므로 모두 회수한 뒤 로그인한 사용자에게만 준다.
revoke all on function public.admin_class_delete_preview(uuid) from public, anon, authenticated;
grant execute on function public.admin_class_delete_preview(uuid) to authenticated;
revoke all on function public.admin_delete_class(uuid, text) from public, anon, authenticated;
grant execute on function public.admin_delete_class(uuid, text) to authenticated;

-- ═════════════════════════════════════════════
-- 3. 맨 끝 점검 — 설계와 다르면 전부 되돌린다(아무것도 바뀌지 않음)
-- ═════════════════════════════════════════════
do $$
declare
  v_bad      text;
  v_blocking text;
begin
  -- 3-1. 두 함수가 있고 security definer 인지
  if to_regprocedure('public.admin_class_delete_preview(uuid)') is null
     or to_regprocedure('public.admin_delete_class(uuid, text)') is null then
    raise exception '학급 삭제 함수 2개가 만들어지지 않았습니다. 이 파일 전체를 되돌렸습니다(아무것도 바뀌지 않음) — 이 메시지를 알려 주세요.';
  end if;
  if not (select bool_and(p.prosecdef)
            from pg_proc p
           where p.oid in ('public.admin_class_delete_preview(uuid)'::regprocedure,
                           'public.admin_delete_class(uuid, text)'::regprocedure)) then
    raise exception '학급 삭제 함수가 security definer 가 아닙니다. 이 파일 전체를 되돌렸습니다(아무것도 바뀌지 않음) — 이 메시지를 알려 주세요.';
  end if;

  -- 3-2. 실행 권한: 비로그인(anon — PUBLIC 포함)은 못 부르고, 로그인한 사용자는 부른다
  select string_agg(x.f || ' ' || x.r, ', ') into v_bad
    from (values
      ('public.admin_class_delete_preview(uuid)', 'anon', false),
      ('public.admin_class_delete_preview(uuid)', 'authenticated', true),
      ('public.admin_delete_class(uuid, text)', 'anon', false),
      ('public.admin_delete_class(uuid, text)', 'authenticated', true)
    ) as x(f, r, want)
   where has_function_privilege(x.r, x.f, 'EXECUTE') <> x.want;
  if v_bad is not null then
    raise exception '학급 삭제 함수의 실행 권한이 설계와 다릅니다: %. 이 파일 전체를 되돌렸습니다(아무것도 바뀌지 않음) — 이 메시지를 알려 주세요.', v_bad;
  end if;

  -- 3-3. 이 함수가 지우는 행(classes · assignments · 그 cascade 로 지워지는 class_teachers · class_notices ·
  --      assignment_submissions)을 가리키는 외래키 중 삭제를 막는 것(r = restrict, a = no action).
  --      assignments.class_id → classes 는 restrict 지만 함수가 과제를 먼저 지우므로 뺀다.
  select string_agg(format('%s.%s (%s → %s)', n.nspname, c.relname, con.conname, con.confrelid::regclass),
                    ', ' order by n.nspname, c.relname, con.conname)
    into v_blocking
  from pg_constraint con
  join pg_class c on c.oid = con.conrelid
  join pg_namespace n on n.oid = c.relnamespace
  where con.contype = 'f'
    and con.confrelid in ('public.classes'::regclass, 'public.assignments'::regclass, 'public.class_teachers'::regclass,
                          'public.class_notices'::regclass, 'public.assignment_submissions'::regclass)
    and con.confdeltype in ('r', 'a')
    and not (con.conrelid = 'public.assignments'::regclass and con.confrelid = 'public.classes'::regclass);
  if v_blocking is not null then
    raise exception '학급 삭제를 막는 외래키가 있습니다: %. 이 파일 전체를 되돌렸습니다(아무것도 바뀌지 않음) — 이 메시지를 알려 주세요.', v_blocking;
  end if;

  raise notice '✔ 학급 삭제 함수 2개(admin_class_delete_preview · admin_delete_class)를 만들었습니다 — 로그인한 선생님만, 그 학급 담임 또는 총괄. 다음: 확인 쿼리 1)·2) → 사이트 push.';
end $$;

-- PostgREST 가 새 함수를 바로 알도록(대시보드도 대개 자동으로 하지만 한 번 더)
notify pgrst, 'reload schema';
