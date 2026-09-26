-- 반(학급)별로 나눠 보이게 하기 ① — 표·열·함수·RPC만 더한다(지금 사이트 동작은 그대로)
-- 설계: docs/classes/spec.md 끝의 "개정 1"(1-1 권한 표 · 1-2 흐름 · 1-3 지금 데이터 · 1-4 이름표). 보고: docs/classes/build-db-report.md
--
-- ▶ 실행 순서(반드시 이 순서 — 개정 1-3)
--   ① 이 파일(20260927000000_classes_schema.sql)                         ← 지금
--   ② docs/classes/setup-owl-class.sql — 부엉이반 만들기 + 총괄 지정(이메일을 바꿔서 실행. 저장소에는 이메일을 적지 않는다)
--   ③ supabase/migrations/20260927010000_classes_rls.sql — 권한 좁히기(총괄이 없으면 실행을 거부한다)
--   ④ supabase/migrations/20260927020000_class_notices.sql — 학급별 '선생님 글'
--   ⑤ Edge Function 3개 다시 배포: admin-create-member, admin-reset-password, admin-delete-member
--   ⑥ 사이트(관리자 화면) push
--
-- ▶ 실행 방법
--   Supabase 대시보드 > SQL Editor > New query 에 이 파일 전체를 붙여넣고 Run.
--   SQL Editor 는 붙여 넣은 전체를 한 트랜잭션으로 실행하므로 중간에 오류가 나면 아무것도 바뀌지 않는다.
--   (psql 등 다른 도구로 실행할 때는 psql -1 -v ON_ERROR_STOP=1 -f <파일> 처럼 "한 트랜잭션 + 오류 시 멈춤"으로.)
--   여러 번 실행해도 안전하다(if not exists / create or replace / drop … if exists / 제약은 이름으로 지우고 다시 추가).
--   앞선 마이그레이션 13개(20260921000000 ~ 20260926000000)가 먼저 실행돼 있어야 한다.
--
-- ▶ 이 파일이 하는 일 — 기존 정책·함수는 하나도 고치지 않는다
--   · 새 표 2개: classes(학급), class_teachers(담임 ↔ 학급, 다대다). RLS 켬. 읽기 정책만 두고 쓰기는 RPC·SQL로만.
--   · 새 열 3개: profiles.class_id(학생의 학급), profiles.is_super_admin(총괄 표시), member_directory.class_id(복사본).
--     profiles 의 두 열은 공개 열 권한(grant select (…) on profiles)에 넣지 않는다 → 학생·비로그인은 읽지도 고치지도 못한다.
--   · 판별 함수 4개: is_super_admin(), my_class_ids(), teaches_student(uuid), can_manage_member(uuid)
--     — 아직 어떤 기존 정책도 이 함수들을 부르지 않는다(③에서 바꾼다). 새 열은 모두 null / false 로 시작한다.
--   · 화면용 RPC 3개: my_admin_context(), create_class(text), rename_class(uuid, text) — 새 기능이라 기존 화면과 무관.
--   · profiles.class_id → member_directory.class_id 동기화 트리거 2개(학급이 바뀔 때 / 새 회원 행이 생길 때).
--
-- ▶ 실행 후 확인 쿼리(앞의 "-- "를 지우고 따로 실행)
--   -- 1) 새 표 2개의 RLS 가 켜졌는지 (rowsecurity = true 2행)
--   select tablename, rowsecurity from pg_tables where schemaname = 'public' and tablename in ('classes', 'class_teachers');
--   -- 2) 새 열 3개 (3행)
--   select table_name, column_name, data_type from information_schema.columns
--   where table_schema = 'public'
--     and ((table_name = 'profiles' and column_name in ('class_id', 'is_super_admin'))
--       or (table_name = 'member_directory' and column_name = 'class_id'));
--   -- 3) profiles 공개 열: anon·authenticated 각각 7개(id, display_name, avatar_url, role, created_at, updated_at, withdrawn_at).
--   --    class_id · is_super_admin · must_change_password 는 없어야 한다.
--   select grantee, column_name from information_schema.column_privileges
--   where table_schema = 'public' and table_name = 'profiles' and privilege_type = 'SELECT'
--     and grantee in ('anon', 'authenticated') order by 1, 2;
--   -- 4) 함수 실행 권한: 판별 함수는 anon 도 true(정책 평가용 — is_admin()과 같음), RPC 는 anon false
--   select has_function_privilege('anon', 'public.teaches_student(uuid)', 'execute')   as anon_teaches,
--          has_function_privilege('anon', 'public.can_manage_member(uuid)', 'execute') as anon_manage,
--          has_function_privilege('anon', 'public.create_class(text)', 'execute')      as anon_create_class,
--          has_function_privilege('anon', 'public.my_admin_context()', 'execute')      as anon_context;
--   -- 5) 탈퇴 안전장치가 그대로 빈 배열인지 (새 외래키는 모두 public.profiles / public.classes 를 가리킨다)
--   select public.withdrawal_blocking_fks();
--   -- 6) 동작 변화 없음: ②를 실행하기 전에는 학급 0개, 총괄 0명
--   select (select count(*) from public.classes) as 학급, (select count(*) from public.profiles where is_super_admin) as 총괄;

-- ═════════════════════════════════════════════
-- 1. classes — 학급(담임교사가 개설하고 이름을 직접 정한다. 개정 1-2)
--    이름에 유일 제약을 걸지 않는다(해마다·교사마다 같은 이름이 나올 수 있다 — spec §3.2).
--    "같은 선생님의 같은 이름"은 create_class()/rename_class()가 막는다.
--    지우지 않고 archived_at 으로 "더 이상 안 씀"만 표시한다(③의 담임 해제가 담임이 아무도 안 남은 빈 학급을 이렇게 둔다).
-- ═════════════════════════════════════════════
create table if not exists public.classes (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  archived_at timestamptz
);

alter table public.classes drop constraint if exists classes_name_length;
alter table public.classes
  add constraint classes_name_length check (char_length(btrim(name)) between 1 and 40);

-- ═════════════════════════════════════════════
-- 2. class_teachers — 담임 ↔ 학급 (다대다: 한 교사가 여러 학급, 한 학급에 담임 여럿 — spec §2.1)
--    teacher_id 는 profiles 를 가리킨다(auth.users 가 아님 → 완전 탈퇴 안전장치 withdrawal_blocking_fks()와 무관).
-- ═════════════════════════════════════════════
create table if not exists public.class_teachers (
  class_id   uuid not null references public.classes (id) on delete cascade,
  teacher_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (class_id, teacher_id)
);

create index if not exists class_teachers_teacher_idx on public.class_teachers (teacher_id);

-- ═════════════════════════════════════════════
-- 3. 새 열 3개 (개정 1-4)
--    profiles.class_id       : 학생의 지금 학급("지금 반" 기준 — spec §2.5 방식 A). 교사·총괄은 null.
--    profiles.is_super_admin : 총괄 표시. role = 'admin' 과 함께일 때만 총괄로 본다(is_super_admin()).
--    member_directory.class_id: profiles.class_id 의 복사본(§6 트리거). 관리자 화면은 이 열로 학급을 본다.
-- ═════════════════════════════════════════════
alter table public.profiles
  add column if not exists class_id uuid references public.classes (id) on delete set null;
alter table public.profiles
  add column if not exists is_super_admin boolean not null default false;
alter table public.member_directory
  add column if not exists class_id uuid references public.classes (id) on delete set null;

create index if not exists profiles_class_id_idx on public.profiles (class_id);
create index if not exists member_directory_class_id_idx on public.member_directory (class_id);

-- 3-1. profiles 열 권한을 지금 상태 그대로 다시 적는다(20260922000000 · 20260923000000 과 글자 그대로 같은 목록).
--      새 열 2개는 넣지 않는다 → 학생·비로그인은 class_id·is_super_admin 을 읽지도(select·필터·정렬) 고치지도 못한다.
--      (profiles 의 SELECT 정책은 using (true)라 열 권한으로 막아야 한다 — spec §3.3.)
--      테이블 단위 revoke 는 열 단위 권한도 함께 거둔다 → 아래 grant 목록이 정확히 남는다.
revoke select on public.profiles from anon, authenticated;
grant select (id, display_name, avatar_url, role, created_at, updated_at, withdrawn_at)
  on public.profiles to anon, authenticated;
revoke update on public.profiles from anon, authenticated;
grant update (display_name, avatar_url) on public.profiles to authenticated;

-- 3-2. 스스로 점검: 새 열이 학생·비로그인에게 열려 있으면(PUBLIC 권한 등) 여기서 멈춘다(전부 되돌림).
do $$
begin
  if has_column_privilege('anon', 'public.profiles', 'class_id', 'SELECT')
     or has_column_privilege('authenticated', 'public.profiles', 'class_id', 'SELECT')
     or has_column_privilege('anon', 'public.profiles', 'is_super_admin', 'SELECT')
     or has_column_privilege('authenticated', 'public.profiles', 'is_super_admin', 'SELECT')
     or has_column_privilege('anon', 'public.profiles', 'class_id', 'UPDATE')
     or has_column_privilege('authenticated', 'public.profiles', 'class_id', 'UPDATE')
     or has_column_privilege('anon', 'public.profiles', 'is_super_admin', 'UPDATE')
     or has_column_privilege('authenticated', 'public.profiles', 'is_super_admin', 'UPDATE') then
    raise exception 'profiles.class_id / is_super_admin 이 학생·비로그인에게 열려 있습니다(PUBLIC 권한 등). 이 파일은 적용되지 않았습니다 — 이 메시지를 알려 주세요.';
  end if;
  -- 클라이언트가 profiles 행을 직접 넣을 수 있으면 is_super_admin 을 스스로 켤 수 있다 → INSERT 정책이 없어야 한다.
  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles' and cmd in ('INSERT', 'ALL')
  ) then
    raise exception 'profiles 에 INSERT 정책이 있습니다(클라이언트가 총괄 표시를 넣을 수 있음). 이 파일은 적용되지 않았습니다 — 이 메시지를 알려 주세요.';
  end if;
end $$;

-- ═════════════════════════════════════════════
-- 4. 판별 함수 4개 (개정 1-4) — 기존 is_admin()/can_browse()와 같은 모양:
--    language sql · stable · security definer · set search_path = ''
--
--    ▸ 재귀(42P17) 없음: 이 함수들은 profiles · class_teachers 만 읽는다. security definer(소유자 postgres)라
--      그 표들의 RLS 를 거치지 않는다. 설령 거치더라도 profiles 의 SELECT 정책은 using (true),
--      class_teachers 의 SELECT 정책은 is_super_admin()(→ profiles)뿐이라, 어느 정책도 자기 표로 되돌아오지 않는다.
--      또 정책 안에서 profiles.class_id 를 직접 조회하면 열 권한(3-1)에 막히므로(정책은 요청한 역할의 권한으로 돈다)
--      학급 판단은 반드시 이 security definer 함수들로 한다.
--    ▸ 실행 권한은 is_admin()처럼 PUBLIC 에 열어 둔다(20260923010000_login_required.sql review S1 — 정책은
--      "요청한 역할"로 평가되므로 권한이 없으면 anon 등의 요청이 그 표에 닿을 때 permission denied 가 난다).
--      돌려주는 값은 "지금 로그인한 나"에 대한 것뿐이라 새는 정보가 없다: 비로그인·학생은 늘 false / 빈 배열.
-- ═════════════════════════════════════════════

-- 총괄인가 = role 'admin' + is_super_admin (개정 1-1). 역할이 user 로 내려가면 표시가 남아 있어도 총괄이 아니다.
create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.is_super_admin and p.role = 'admin' from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

-- 내가 담임인 학급 id 목록(보관한 학급 포함 — 그 학급 학생 기록은 계속 보여야 한다). 관리자가 아니면 빈 배열.
create or replace function public.my_class_ids()
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(ct.class_id order by ct.class_id), '{}'::uuid[])
  from public.class_teachers ct
  where ct.teacher_id = auth.uid()
    and public.is_admin();
$$;

-- 지금 로그인한 사람이 이 학생의 담임인가 = 관리자이고, 그 학생(role 'user')의 학급이 내 학급.
-- 총괄 예외 없음(개정 1-1 — 총괄도 자기 반 학생 기록만 본다). 학생 기록 정책은 모두 이 함수로 판단한다(③).
create or replace function public.teaches_student(p_student uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    p_student is not null
    and public.is_admin()
    and exists (
      select 1
      from public.profiles s
      join public.class_teachers ct on ct.class_id = s.class_id
      where s.id = p_student
        and s.role = 'user'
        and ct.teacher_id = auth.uid()
    ),
    false
  );
$$;

-- 계정 관리(회원 명단 · 감사 로그 보기)를 해도 되는가 = 총괄이거나 그 학생의 담임(개정 1-1).
create or replace function public.can_manage_member(p_target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_super_admin() or public.teaches_student(p_target);
$$;

-- is_admin() 과 같게 PUBLIC 실행(위 설명). 재실행해도 같은 결과.
grant execute on function public.is_super_admin() to public;
grant execute on function public.my_class_ids() to public;
grant execute on function public.teaches_student(uuid) to public;
grant execute on function public.can_manage_member(uuid) to public;

-- ═════════════════════════════════════════════
-- 5. classes · class_teachers 권한 (개정 1-4 "표 권한")
--    읽기: classes = 내 학급 또는 총괄 / class_teachers = 내 줄 또는 총괄. 학생·비로그인은 못 읽는다
--          (anon 은 표 권한 자체가 없고, 학생은 정책이 0행을 돌려준다).
--    쓰기: 아무에게도 주지 않는다 → create_class()·rename_class()(§7)·admin_set_role()(③)·SQL Editor 로만.
--    재귀 없음: 두 정책이 부르는 my_class_ids()/is_super_admin()은 security definer 라 이 표들의 정책을 다시 거치지 않는다.
-- ═════════════════════════════════════════════
alter table public.classes enable row level security;
alter table public.class_teachers enable row level security;

revoke all on public.classes from anon, authenticated;
revoke all on public.class_teachers from anon, authenticated;
grant select on public.classes to authenticated;
grant select on public.class_teachers to authenticated;
-- Edge Function(서비스 롤 — RLS 를 거치지 않음)이 담임 학급을 확인한다. 기본 권한에 기대지 않고 적어 둔다.
grant select on public.classes to service_role;
grant select on public.class_teachers to service_role;

drop policy if exists "classes: 담임·총괄 조회" on public.classes;
create policy "classes: 담임·총괄 조회"
  on public.classes for select
  to authenticated
  using (id = any (public.my_class_ids()) or public.is_super_admin());

drop policy if exists "class_teachers: 본인·총괄 조회" on public.class_teachers;
create policy "class_teachers: 본인·총괄 조회"
  on public.class_teachers for select
  to authenticated
  using (teacher_id = auth.uid() or public.is_super_admin());

-- ═════════════════════════════════════════════
-- 6. profiles.class_id → member_directory.class_id 동기화 (spec §3.3)
--    member_directory 는 관리자 전용 표라(③에서 can_manage_member 로 좁힘) 관리자 화면은 여기서 학급을 읽는다
--    — profiles.class_id 를 공개 열로 열지 않기 위한 복사본이다.
--    (a) 학급이 바뀔 때: profiles 의 after update of class_id 트리거가 복사한다.
--    (b) 새 회원 행이 생길 때: 기존 sync_member_directory()(auth.users 트리거)는 고치지 않고,
--        member_directory 의 before insert 트리거가 profiles 에서 class_id 를 채운다.
--    회원 추가 흐름: 계정 생성 → handle_new_user(profiles 행, class_id null) → sync_member_directory(member_directory 행)
--      → Edge Function 이 profiles.class_id 를 설정 → (a)가 복사. 순서가 어긋나 member_directory 행이 나중에 생겨도 (b)가 맞춘다.
-- ═════════════════════════════════════════════
create or replace function public.sync_member_directory_class()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.member_directory
     set class_id = new.class_id, updated_at = now()
   where id = new.id
     and class_id is distinct from new.class_id;
  return new;
end;
$$;

-- 트리거 전용(직접 부를 일 없음). 트리거는 실행 권한과 상관없이 돈다.
revoke all on function public.sync_member_directory_class() from public, anon, authenticated;

drop trigger if exists on_profiles_class_changed on public.profiles;
create trigger on_profiles_class_changed
  after update of class_id on public.profiles
  for each row
  when (old.class_id is distinct from new.class_id)
  execute function public.sync_member_directory_class();

create or replace function public.member_directory_fill_class()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.class_id is null then
    new.class_id := (select p.class_id from public.profiles p where p.id = new.id);
  end if;
  return new;
end;
$$;

revoke all on function public.member_directory_fill_class() from public, anon, authenticated;

drop trigger if exists member_directory_fill_class on public.member_directory;
create trigger member_directory_fill_class
  before insert on public.member_directory
  for each row execute function public.member_directory_fill_class();

-- 지금 값 맞추기(처음 실행 때는 모두 null 이라 바뀌는 행이 없다. 재실행해도 안전)
update public.member_directory d
   set class_id = p.class_id, updated_at = now()
  from public.profiles p
 where p.id = d.id
   and d.class_id is distinct from p.class_id;

-- ═════════════════════════════════════════════
-- 7. 화면용 RPC 3개 (개정 1-4) — 관리자 화면(src/lib/classes.ts)이 부른다.
--    오류는 한국어 문구로 raise 한다 → 화면이 그대로 보여 준다. 실행은 로그인한 사용자만(관리자 검사는 함수 안에서).
-- ═════════════════════════════════════════════

-- 7-1. my_admin_context() → {"is_super_admin": bool, "classes": [{"id": uuid, "name": text, "student_count": int}]}
--      classes = 내가 담임인 학급(보관한 학급 제외 — 학생 등록 학급 고르기에 쓰인다). 총괄도 "내가 담임인 학급"만 담긴다
--      (다른 담임의 학급 이름은 classes 표에서 읽는다 — 총괄은 모두 읽힌다).
--      student_count = 그 학급 학생(role 'user') 수, 탈퇴한 학생 제외.
--      관리자가 아니면 오류.
create or replace function public.my_admin_context()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception '관리자만 사용할 수 있습니다.';
  end if;
  return jsonb_build_object(
    'is_super_admin', public.is_super_admin(),
    'classes', coalesce(
      (
        select jsonb_agg(
                 jsonb_build_object(
                   'id', c.id,
                   'name', c.name,
                   'student_count', (
                     select count(*)::int
                     from public.profiles s
                     where s.class_id = c.id
                       and s.role = 'user'
                       and s.withdrawn_at is null
                   )
                 )
                 order by c.created_at, c.id
               )
        from public.classes c
        join public.class_teachers ct on ct.class_id = c.id
        where ct.teacher_id = auth.uid()
          and c.archived_at is null
      ),
      '[]'::jsonb
    )
  );
end;
$$;

revoke all on function public.my_admin_context() from public, anon;
grant execute on function public.my_admin_context() to authenticated;

-- 7-2. create_class(p_name) → 새 학급 id
--      관리자(담임교사·총괄) 누구나. 만든 사람이 그 학급의 담임이 된다(개정 1-2).
--      이름: 앞뒤 공백을 빼고 1~40자, 줄바꿈·탭 같은 제어 문자 불가, 내 학급끼리 같은 이름 불가(두 번 누름 방지 포함).
create or replace function public.create_class(p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_id   uuid;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception '담임교사(관리자)만 학급을 개설할 수 있습니다.';
  end if;
  if char_length(v_name) < 1 then
    raise exception '학급 이름을 적어 주세요.';
  end if;
  if char_length(v_name) > 40 then
    raise exception '학급 이름은 40자까지 적을 수 있습니다.';
  end if;
  if v_name ~ '[[:cntrl:]]' then
    raise exception '학급 이름에는 줄바꿈이나 탭을 쓸 수 없습니다.';
  end if;

  -- 같은 선생님의 학급 만들기·이름 바꾸기를 한 줄로 세운다(두 번 눌러 같은 학급이 둘 생기지 않게). 트랜잭션이 끝나면 풀린다.
  perform pg_advisory_xact_lock(hashtext('public.classes'), hashtext(auth.uid()::text));

  if exists (
    select 1
    from public.classes c
    join public.class_teachers ct on ct.class_id = c.id
    where ct.teacher_id = auth.uid()
      and c.archived_at is null
      and c.name = v_name
  ) then
    raise exception '이미 같은 이름의 학급이 있습니다. 다른 이름을 적어 주세요.';
  end if;

  insert into public.classes (name, created_by) values (v_name, auth.uid()) returning id into v_id;
  insert into public.class_teachers (class_id, teacher_id) values (v_id, auth.uid());
  return v_id;
end;
$$;

revoke all on function public.create_class(text) from public, anon;
grant execute on function public.create_class(text) to authenticated;

-- 7-3. rename_class(p_class_id, p_name) — 그 학급의 담임만(총괄도 다른 담임의 학급은 못 바꾼다 — 개정 1-1). 이름 규칙은 7-2 와 같다.
create or replace function public.rename_class(p_class_id uuid, p_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception '담임교사(관리자)만 사용할 수 있습니다.';
  end if;
  if p_class_id is null or not exists (
    select 1 from public.class_teachers ct
    where ct.class_id = p_class_id and ct.teacher_id = auth.uid()
  ) then
    raise exception '이 학급의 담임 선생님만 이름을 바꿀 수 있습니다.';
  end if;
  if char_length(v_name) < 1 then
    raise exception '학급 이름을 적어 주세요.';
  end if;
  if char_length(v_name) > 40 then
    raise exception '학급 이름은 40자까지 적을 수 있습니다.';
  end if;
  if v_name ~ '[[:cntrl:]]' then
    raise exception '학급 이름에는 줄바꿈이나 탭을 쓸 수 없습니다.';
  end if;

  perform pg_advisory_xact_lock(hashtext('public.classes'), hashtext(auth.uid()::text));

  if exists (
    select 1
    from public.classes c
    join public.class_teachers ct on ct.class_id = c.id
    where ct.teacher_id = auth.uid()
      and c.id <> p_class_id
      and c.archived_at is null
      and c.name = v_name
  ) then
    raise exception '이미 같은 이름의 학급이 있습니다. 다른 이름을 적어 주세요.';
  end if;

  update public.classes set name = v_name where id = p_class_id;
end;
$$;

revoke all on function public.rename_class(uuid, text) from public, anon;
grant execute on function public.rename_class(uuid, text) to authenticated;

-- PostgREST 가 새 표·열·함수를 바로 알도록(대시보드도 대개 자동으로 하지만 한 번 더)
notify pgrst, 'reload schema';
