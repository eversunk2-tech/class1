-- 학급별 '선생님 글' ④ — class_notices 표 + 판별 함수 2개 + RLS
-- 설계: docs/classes/spec.md 끝의 "개정 2"(2-1 무엇을 · 2-2 화면 · 2-3 순서)
--       + 2026-09-26 사용자 추가 결정 "로그인 안 했을 때는 총괄 관리자가 작성한 선생님 글이 보이게"
-- 보고: docs/classes/build-notices-report.md
--
-- ▶ 실행 순서(반드시 이 순서 — 개정 1-3, 개정 2-3)
--   ① supabase/migrations/20260927000000_classes_schema.sql
--   ② docs/classes/setup-owl-class.sql — 부엉이반 만들기 + 총괄 지정(이메일을 바꿔서)
--   ③ supabase/migrations/20260927010000_classes_rls.sql
--   ④ 이 파일(20260927020000_class_notices.sql)                                  ← 지금
--   ⑤ Edge Function 3개 다시 배포(admin-create-member · admin-reset-password · admin-delete-member, --no-verify-jwt 금지)
--   ⑥ 사이트(화면) push. 화면은 이 표를 읽으므로 ④ 다음에 push 한다.
--
-- ▶ 실행 방법
--   Supabase 대시보드 > SQL Editor > New query 에 이 파일 전체를 붙여넣고 Run.
--   SQL Editor 는 붙여 넣은 전체를 한 트랜잭션으로 실행하므로 중간에 오류가 나면 아무것도 바뀌지 않는다.
--   (psql 등 다른 도구로 실행할 때는 psql -1 -v ON_ERROR_STOP=1 -f <파일> 처럼 "한 트랜잭션 + 오류 시 멈춤"으로.)
--   여러 번 실행해도 안전하다(if not exists / create or replace / drop … if exists / 제약은 이름으로 지우고 다시 추가).
--   · 맨 앞 점검: ①(classes 표 · my_class_ids() 등)이 없으면 오류를 내고 아무것도 바꾸지 않는다.
--   · 맨 끝 점검: RLS·정책·권한이 아래 설계와 다르면(모르는 정책이 붙어 있는 등) 오류를 내고 전부 되돌린다.
--   · 성공하면 "✔ 선생님 글(class_notices)을 만들었습니다…" 알림이 나온다.
--
-- ▶ 이 파일이 하는 일 — 기존 표·정책·함수는 하나도 고치지 않는다(새 표·새 함수만)
--   · 새 표 class_notices(학급 공지): 제목·본문만(태그·주소·요약·공개 여부 없음 — 쓰면 바로 보인다).
--     읽음 기록·조회수·댓글·좋아요 없음(개정 2-1). updated_at 은 기존 set_updated_at() 트리거로 갱신.
--   · 새 판별 함수 2개(security definer, set search_path = '', 실행 권한은 is_admin()·my_class_ids()처럼 PUBLIC):
--       my_student_class_id()   — 지금 로그인한 학생의 학급 id. 학생(role 'user', 탈퇴 전)이 아니면 null.
--                                 profiles.class_id 는 공개 열이 아니라서(①) 정책 안에서 직접 읽으면 permission denied 가 난다
--                                 → 반드시 이 함수로 읽는다. 돌려주는 값은 "나의 학급 id" 하나뿐이다(학급 이름은 여전히 못 읽음).
--       is_super_admin_id(uuid) — 그 회원이 총괄인가(role 'admin' + is_super_admin — is_super_admin()과 같은 판단).
--                                 비로그인 방문자에게 "총괄 선생님이 쓴 글"만 보여 줄 때 쓴다.
--   · RLS(행):
--       읽기  로그인 — 학생: 자기 학급 글만(my_student_class_id()) / 담임(총괄 포함): 자기 학급 글만(my_class_ids()).
--                      다른 반 글은 누구도 못 본다(총괄도 자기 반만 — 개정 1과 같은 원칙).
--             비로그인 — 총괄 선생님이 쓴 글만(2026-09-26 추가 결정). 단 '로그인해야만 이용' 스위치가 켜져 있으면 없음
--                      (can_browse() — 블로그 글·게시판 등 다른 공개 글과 같은 잠금 규칙).
--       쓰기  쓰기·고치기·지우기 = 그 학급의 담임만(class_id = any(my_class_ids())). 쓰기는 author_id = 나(기본값 auth.uid()).
--             학생·비로그인은 쓸 수 없다.
--   · 표 권한(열): anon          = 읽기만(id, title, body, created_at, updated_at — 작성자·학급 열은 못 읽음)
--                 authenticated = 읽기(모든 열) + 쓰기(class_id, title, body) + 고치기(title, body) + 지우기
--                 → 작성자·학급·시각은 클라이언트가 바꿀 수 없다. 어느 행인지는 RLS 가 정한다.
--   · 재귀(42P17) 없음: 정책이 부르는 함수(my_student_class_id · my_class_ids · is_super_admin_id · can_browse)는 모두
--     security definer 로 profiles · class_teachers · site_settings 만 읽는다. 어느 것도 class_notices 를 읽지 않는다.
--
-- ▶ 실행 후 확인 쿼리(앞의 "-- "를 지우고 한 덩어리씩 Run)
--   ※ 흉내 내기(3~6)는 ③ 파일과 같은 방식이다: "한 번의 Run = 한 트랜잭션"(set local role · set_config(…, true)는
--     그 Run 안에서만 적용되고 끝나면 저절로 풀린다). psql 에서는 앞뒤에 begin; / rollback; 을 붙인다.
--     각 결과의 "지금_역할" 칸이 anon / authenticated 여야 흉내가 된 것이다(postgres 면 숫자를 믿지 말 것).
--     <…> 자리는 0)에서 찾은 id 로 바꾼다. 5)·6)의 시험 글은 어떤 경우에도 저장되지 않는다(성공하면 일부러 오류를 내 되돌림).
--
--   -- 0) (그냥 Run = postgres 권한) 흉내 낼 id 와 학급별·작성자별 글 수
--   select p.id, p.display_name, p.role, p.is_super_admin, c.id as 학급_id, c.name as 학급
--   from public.profiles p left join public.classes c on c.id = p.class_id
--   order by p.role, c.name nulls first, p.display_name limit 200;
--   select c.name as 학급, coalesce(a.display_name, '(작성자 없음)') as 작성자,
--          public.is_super_admin_id(n.author_id) as 총괄_글, count(*) as 글
--   from public.class_notices n
--   join public.classes c on c.id = n.class_id
--   left join public.profiles a on a.id = n.author_id
--   group by 1, 2, 3 order by 1, 2;
--
--   -- 1) RLS 켜짐(true) · 정책 5개(방문자 조회 1 · 학생·담임 조회 1 · 담임 쓰기·고치기·지우기 3)
--   select relrowsecurity from pg_class where oid = 'public.class_notices'::regclass;
--   select policyname, cmd, roles from pg_policies
--   where schemaname = 'public' and tablename = 'class_notices' order by 1;
--
--   -- 2) 권한 — 앞 4개 false(비로그인은 쓰기·작성자/학급 열 없음, 로그인해도 작성자·학급은 못 바꿈), 뒤 3개 true
--   select has_any_column_privilege('anon', 'public.class_notices', 'insert')                   as anon_쓰기,
--          has_column_privilege('anon', 'public.class_notices', 'author_id', 'select')          as anon_작성자열,
--          has_column_privilege('authenticated', 'public.class_notices', 'author_id', 'insert') as 작성자_직접지정,
--          has_column_privilege('authenticated', 'public.class_notices', 'class_id', 'update')  as 학급_옮기기,
--          has_column_privilege('anon', 'public.class_notices', 'title', 'select')              as anon_제목읽기,
--          has_function_privilege('anon', 'public.my_student_class_id()', 'execute')            as anon_함수1,
--          has_function_privilege('anon', 'public.is_super_admin_id(uuid)', 'execute')          as anon_함수2;
--
--   -- 3) 비로그인 흉내 — 보이는_글 = 0)의 "총괄_글 = true" 글 수의 합(로그인 잠금이 켜져 있으면 0)
--   set local role anon;
--   select current_user as 지금_역할, public.login_required() as 잠금, count(*) as 보이는_글
--   from public.class_notices;
--
--   -- 4) 학생 흉내 — 보이는_글 = 0)의 그 학급 글 수, 다른_학급_글 = 0
--   set local role authenticated;
--   select set_config('request.jwt.claims', '{"sub":"<학생 id>","role":"authenticated"}', true);
--   select current_user as 지금_역할, auth.uid() as 나, public.my_student_class_id() as 내_학급,
--          (select count(*) from public.class_notices) as 보이는_글,
--          (select count(*) from public.class_notices
--            where class_id is distinct from public.my_student_class_id()) as 다른_학급_글;
--
--   -- 5) 학생은 쓸 수 없다 — "✔ 학생은 선생님 글을 쓸 수 없습니다(정상)." 알림이 나오면 된다(학급이 있는 학생 id 로)
--   set local role authenticated;
--   select set_config('request.jwt.claims', '{"sub":"<학생 id>","role":"authenticated"}', true);
--   do $$
--   begin
--     insert into public.class_notices (class_id, title, body) values (public.my_student_class_id(), '시험', '시험');
--     raise exception '✖ 학생이 선생님 글을 썼습니다 — 이 메시지를 알려 주세요(시험 글은 저장되지 않았습니다).';
--   exception when insufficient_privilege then
--     raise notice '✔ 학생은 선생님 글을 쓸 수 없습니다(정상).';
--   end $$;
--
--   -- 6) 다른 반 담임 흉내(두 번째 담임이 생긴 뒤) — 부엉이반_글 0, 그리고 "✔ … 쓸 수 없습니다(정상)." 알림
--   set local role authenticated;
--   select set_config('request.jwt.claims', '{"sub":"<다른 반 담임 id>","role":"authenticated"}', true);
--   select current_user as 지금_역할,
--          (select count(*) from public.class_notices where class_id = '<부엉이반 학급_id>') as 부엉이반_글;
--   do $$
--   begin
--     insert into public.class_notices (class_id, title, body) values ('<부엉이반 학급_id>', '시험', '시험');
--     raise exception '✖ 다른 반 담임이 부엉이반에 글을 썼습니다 — 이 메시지를 알려 주세요(시험 글은 저장되지 않았습니다).';
--   exception when insufficient_privilege then
--     raise notice '✔ 다른 반 담임은 부엉이반에 선생님 글을 쓸 수 없습니다(정상).';
--   end $$;

-- ═════════════════════════════════════════════
-- 0. 맨 앞 점검 — 앞 단계가 안 됐으면 아무것도 바꾸지 않는다
-- ═════════════════════════════════════════════
do $$
begin
  if to_regclass('public.classes') is null
     or to_regclass('public.class_teachers') is null
     or to_regprocedure('public.my_class_ids()') is null
     or to_regprocedure('public.is_super_admin()') is null
     or not exists (
       select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'profiles' and column_name = 'class_id'
     )
     or not exists (
       select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'profiles' and column_name = 'is_super_admin'
     ) then
    raise exception '먼저 ① 20260927000000_classes_schema.sql 을 실행해 주세요(학급 표·my_class_ids() 가 없습니다). 이 파일은 아무것도 바꾸지 않았습니다.';
  end if;

  if to_regprocedure('public.can_browse()') is null
     or to_regprocedure('public.set_updated_at()') is null
     or not exists (
       select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'profiles' and column_name = 'withdrawn_at'
     ) then
    raise exception '앞선 마이그레이션(20260921000000 ~ 20260926000000)이 모두 실행돼 있어야 합니다(can_browse() · set_updated_at() · profiles.withdrawn_at 이 없음). 이 파일은 아무것도 바꾸지 않았습니다.';
  end if;

  -- 경고만(멈추지 않음): 이 파일은 ③ 없이도 안전하지만, 정해진 순서(①→②→③→④)를 권한다.
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'app_results' and policyname = 'app_results: 본인 또는 담임 조회'
  ) then
    raise notice '⚠ ③ 20260927010000_classes_rls.sql 이 아직 적용되지 않은 것 같습니다. 이 파일은 그대로 적용되지만, ③도 실행해 주세요.';
  end if;
  if not exists (select 1 from public.profiles where is_super_admin and role = 'admin') then
    raise notice '⚠ 총괄 관리자가 아직 없습니다(② setup-owl-class.sql). 그동안 비로그인 방문자에게는 선생님 글이 하나도 보이지 않습니다.';
  end if;
end $$;

-- ═════════════════════════════════════════════
-- 1. class_notices — 학급 공지(개정 2-1). 제목·본문만.
--    · class_id  : 어느 학급의 글인가. 학급을 지우면 글도 지워진다(학급은 지우지 않고 보관만 하므로 실제로는 일어나지 않음).
--    · author_id : 쓴 선생님. 기본값 auth.uid()(클라이언트는 이 열을 보내지도 바꾸지도 못한다 — 3절 열 권한).
--                  profiles 를 가리킨다(auth.users 가 아님 → 완전 탈퇴 안전장치 withdrawal_blocking_fks()와 무관).
--    · title     : 앞뒤 공백을 뺀 1~100자, 줄바꿈·탭 같은 제어 문자 불가(한 줄 제목).
--    · body      : 1~5000자, 빈 칸(공백·줄바꿈)만으로는 불가. 화면은 글자 그대로 보여 준다(마크다운·HTML 해석 안 함).
-- ═════════════════════════════════════════════
create table if not exists public.class_notices (
  id         uuid primary key default gen_random_uuid(),
  class_id   uuid not null references public.classes (id) on delete cascade,
  author_id  uuid default auth.uid() references public.profiles (id) on delete set null,
  title      text not null,
  body       text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.class_notices drop constraint if exists class_notices_title_length;
alter table public.class_notices
  add constraint class_notices_title_length
  check (char_length(title) <= 100 and char_length(btrim(title)) >= 1 and title !~ '[[:cntrl:]]');

alter table public.class_notices drop constraint if exists class_notices_body_length;
alter table public.class_notices
  add constraint class_notices_body_length
  check (char_length(body) <= 5000 and char_length(btrim(body, E' \t\r\n')) >= 1);

-- 목록: 학급별 최신순(학생·담임 화면), 작성자(비로그인 방문자 = 총괄 글 · 외래키)
create index if not exists class_notices_class_created_idx on public.class_notices (class_id, created_at desc, id desc);
create index if not exists class_notices_author_idx on public.class_notices (author_id);

drop trigger if exists class_notices_updated_at on public.class_notices;
create trigger class_notices_updated_at
  before update on public.class_notices
  for each row execute function public.set_updated_at();

-- ═════════════════════════════════════════════
-- 2. 판별 함수 2개 — 기존 is_admin()/my_class_ids()와 같은 모양:
--    language sql · stable · security definer · set search_path = '' · PUBLIC 실행
--    (정책은 "요청한 역할"로 평가되므로 실행 권한이 없으면 anon 요청이 이 표에 닿을 때 permission denied 가 난다 — review S1)
-- ═════════════════════════════════════════════

-- 지금 로그인한 학생의 학급 id. 학생(role 'user')이 아니거나, 탈퇴 처리됐거나, 비로그인이면 null.
-- (탈퇴 조건: 계정을 지운 직후에도 이미 받은 접근 토큰은 만료 전까지 남을 수 있어서 한 번 더 막는다.)
create or replace function public.my_student_class_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.class_id
  from public.profiles p
  where p.id = auth.uid()
    and p.role = 'user'
    and p.withdrawn_at is null;
$$;

-- 그 회원이 총괄인가 = role 'admin' + is_super_admin(is_super_admin()과 같은 판단, 대상만 인자로 받는다).
-- 총괄에서 내려가면(admin_set_role 이 is_super_admin 도 끈다) 그 사람이 쓴 글은 더 이상 비로그인 방문자에게 보이지 않는다.
create or replace function public.is_super_admin_id(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.is_super_admin and p.role = 'admin' from public.profiles p where p.id = p_user),
    false
  );
$$;

grant execute on function public.my_student_class_id() to public;
grant execute on function public.is_super_admin_id(uuid) to public;

-- ═════════════════════════════════════════════
-- 3. RLS 켜기 + 표 권한(열 단위)
--    Supabase 는 새 표에 anon·authenticated 전체 권한(TRUNCATE 포함 — RLS 를 거치지 않음)을 기본으로 준다 → 먼저 모두 거둔다.
--    테이블 단위 revoke 는 열 단위 권한도 함께 거둔다 → 아래 grant 목록이 정확히 남는다(재실행해도 같은 결과).
-- ═════════════════════════════════════════════
alter table public.class_notices enable row level security;

revoke all on public.class_notices from anon, authenticated;
grant select (id, title, body, created_at, updated_at) on public.class_notices to anon;
grant select on public.class_notices to authenticated;
grant insert (class_id, title, body) on public.class_notices to authenticated;
grant update (title, body) on public.class_notices to authenticated;
grant delete on public.class_notices to authenticated;
grant select, insert, update, delete on public.class_notices to service_role;

-- ═════════════════════════════════════════════
-- 4. 정책 5개(이름은 모두 63바이트 안)
--    (select …)로 감싼 함수는 요청마다 한 번만 계산된다(행마다 다시 부르지 않음). is_super_admin_id(author_id)는 행마다.
--    배열을 돌려주는 my_class_ids()는 `= any (public.my_class_ids())`로 쓴다(①의 classes 정책과 같게, 작은 표라 행마다 불러도 된다).
--    ⚠ `= any ((select public.my_class_ids()))`처럼 괄호를 겹치면 Postgres 가 "하위 쿼리의 각 줄과 비교"로 읽어
--      uuid = uuid[] 오류(42883)가 난다 — 2026-09-26 첫 실행 때 이 오류로 이 파일 전체가 되돌려졌다(아무것도 바뀌지 않음).
-- ═════════════════════════════════════════════

-- 4-1. 로그인한 사람의 읽기: 학생 = 자기 학급, 담임(총괄 포함) = 자기 학급. 둘 다 아니면 0행.
drop policy if exists "class_notices: 학생·담임 조회" on public.class_notices;
create policy "class_notices: 학생·담임 조회"
  on public.class_notices for select
  to authenticated
  using (
    class_id = (select public.my_student_class_id())
    or class_id = any (public.my_class_ids())
  );

-- 4-2. 비로그인 방문자의 읽기: 총괄 선생님이 쓴 글만(2026-09-26 추가 결정). 로그인 잠금이 켜져 있으면 0행(can_browse()).
--      로그인한 학생에게는 이 정책이 걸리지 않는다(to anon) → 로그인하면 자기 담임 선생님 글만 본다(개정 2 "자기 담임 선생님 글만").
drop policy if exists "class_notices: 방문자는 총괄 글만 조회" on public.class_notices;
create policy "class_notices: 방문자는 총괄 글만 조회"
  on public.class_notices for select
  to anon
  using ((select public.can_browse()) and public.is_super_admin_id(author_id));

-- 4-3. 쓰기: 그 학급의 담임만, 작성자는 나(author_id 는 기본값 auth.uid() — 클라이언트는 보낼 수 없다).
drop policy if exists "class_notices: 담임만 쓰기" on public.class_notices;
create policy "class_notices: 담임만 쓰기"
  on public.class_notices for insert
  to authenticated
  with check (
    author_id = (select auth.uid())
    and class_id = any (public.my_class_ids())
  );

-- 4-4. 고치기: 그 학급의 담임만(같은 학급을 맡은 다른 담임의 글도 — 학급 단위 게시판). 제목·본문만 고칠 수 있다(열 권한).
drop policy if exists "class_notices: 담임만 고치기" on public.class_notices;
create policy "class_notices: 담임만 고치기"
  on public.class_notices for update
  to authenticated
  using (class_id = any (public.my_class_ids()))
  with check (class_id = any (public.my_class_ids()));

-- 4-5. 지우기: 그 학급의 담임만.
drop policy if exists "class_notices: 담임만 지우기" on public.class_notices;
create policy "class_notices: 담임만 지우기"
  on public.class_notices for delete
  to authenticated
  using (class_id = any (public.my_class_ids()));

-- ═════════════════════════════════════════════
-- 5. 맨 끝 점검 — 설계와 다르면 전부 되돌린다(아무것도 바뀌지 않음)
--    정책은 "허용" 정책끼리 OR 로 합쳐지므로, 모르는 정책이 하나라도 붙어 있으면 좁히기가 소리 없이 무효가 된다.
-- ═════════════════════════════════════════════
do $$
declare
  v_extra text;
  v_count int;
begin
  if not (select c.relrowsecurity from pg_class c where c.oid = 'public.class_notices'::regclass) then
    raise exception 'class_notices 의 RLS 가 꺼져 있습니다. 이 파일 전체를 되돌렸습니다(아무것도 바뀌지 않음) — 이 메시지를 알려 주세요.';
  end if;

  select string_agg(policyname::text, ', ' order by policyname) into v_extra
  from pg_policies
  where schemaname = 'public' and tablename = 'class_notices'
    and policyname not in (
      'class_notices: 학생·담임 조회',
      'class_notices: 방문자는 총괄 글만 조회',
      'class_notices: 담임만 쓰기',
      'class_notices: 담임만 고치기',
      'class_notices: 담임만 지우기'
    );
  if v_extra is not null then
    raise exception 'class_notices 에 이 파일이 모르는 정책이 있습니다: %. 이 파일 전체를 되돌렸습니다(아무것도 바뀌지 않음) — 이 메시지를 알려 주세요.', v_extra;
  end if;

  select count(*) into v_count from pg_policies where schemaname = 'public' and tablename = 'class_notices';
  if v_count <> 5 then
    raise exception 'class_notices 정책이 5개가 아닙니다(%개). 이 파일 전체를 되돌렸습니다(아무것도 바뀌지 않음) — 이 메시지를 알려 주세요.', v_count;
  end if;

  if has_any_column_privilege('anon', 'public.class_notices', 'INSERT')
     or has_any_column_privilege('anon', 'public.class_notices', 'UPDATE')
     or has_table_privilege('anon', 'public.class_notices', 'DELETE')
     or has_table_privilege('anon', 'public.class_notices', 'TRUNCATE')
     or has_table_privilege('authenticated', 'public.class_notices', 'TRUNCATE')
     or has_column_privilege('anon', 'public.class_notices', 'author_id', 'SELECT')
     or has_column_privilege('anon', 'public.class_notices', 'class_id', 'SELECT')
     or has_column_privilege('authenticated', 'public.class_notices', 'author_id', 'INSERT')
     or has_column_privilege('authenticated', 'public.class_notices', 'author_id', 'UPDATE')
     or has_column_privilege('authenticated', 'public.class_notices', 'class_id', 'UPDATE')
     or has_column_privilege('authenticated', 'public.class_notices', 'created_at', 'INSERT')
     or has_column_privilege('authenticated', 'public.class_notices', 'created_at', 'UPDATE')
     or has_column_privilege('authenticated', 'public.class_notices', 'id', 'INSERT') then
    raise exception 'class_notices 표 권한이 설계보다 넓습니다(PUBLIC 권한 등). 이 파일 전체를 되돌렸습니다(아무것도 바뀌지 않음) — 이 메시지를 알려 주세요.';
  end if;

  -- 방문자 정책이 부르는 함수(can_browse · is_super_admin_id) + 도우미 함수는 is_admin()처럼 누구나 실행(review S1)
  if not has_function_privilege('anon', 'public.my_student_class_id()', 'EXECUTE')
     or not has_function_privilege('anon', 'public.is_super_admin_id(uuid)', 'EXECUTE')
     or not has_function_privilege('anon', 'public.can_browse()', 'EXECUTE') then
    raise exception '정책이 부르는 함수를 비로그인(anon)이 실행할 수 없습니다(평가 때 permission denied 가 남). 이 파일 전체를 되돌렸습니다 — 이 메시지를 알려 주세요.';
  end if;

  raise notice '✔ 선생님 글(class_notices)을 만들었습니다: 학생은 자기 학급 글, 담임은 자기 학급 글만 읽고 쓰며, 비로그인 방문자는 총괄 선생님 글만 봅니다(로그인 잠금이 켜져 있으면 없음). 다음: Edge Function 3개 다시 배포 → 사이트 push.';
end $$;

-- PostgREST 가 새 표·함수를 바로 알도록(대시보드도 대개 자동으로 하지만 한 번 더)
notify pgrst, 'reload schema';
