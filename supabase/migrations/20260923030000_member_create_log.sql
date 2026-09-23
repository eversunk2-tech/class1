-- 계정 생성 감사 로그 — 관리자가 "회원 추가"로 만든 계정을 누가·언제·어떤 역할로 만들었는지 남긴다.
-- 설계: docs/admin/create-members/build-instructions.md + review.md M1
-- password_reset_log(20260922000000) · member_withdrawal_log(20260923000000)와 같은 모양이다.
--
-- ▶ 실행 방법
--   Supabase 대시보드 > SQL Editor > New query 에 이 파일 전체를 붙여넣고 Run.
--   여러 번 실행해도 안전하다(if not exists / create or replace / drop ... if exists).
--   앞선 마이그레이션(20260921000000 ~ 20260923020000)이 먼저 실행돼 있어야 한다.
--   ⚠ 이 SQL을 먼저 실행한 다음 Edge Function(admin-create-member)을 배포하고, 마지막으로 사이트를 배포(push)한다.
--     (순서가 바뀌어도 계정 생성은 그대로 동작한다. 로그만 남지 않고 화면에 경고가 뜬다.)
--
-- ▶ 기록하는 것 / 기록하지 않는 것
--   기록한다: 만든 계정의 id·아이디(이메일)·부여한 역할, 만든 관리자의 id와 그때의 이름(스냅샷),
--             단건/일괄 구분(source), 시각.
--   기록하지 않는다: **비밀번호는 어떤 형태로도 남기지 않는다.**
--             실패한 행(이미 있음·형식 오류·생성 실패)도 남기지 않는다 — "실제로 만들어진 계정"만 기록한다.
--             (실패는 그 자리에서 화면에 사유가 표시되고, 계정이 생기지 않았으므로 감사 대상이 아니다.)
--
-- ▶ 실행 후 확인 쿼리
--   -- 1) 표가 생겼는지 (관리자 계정으로 실행하면 행이 보인다. 아직 비어 있어도 정상)
--   select * from public.member_create_log order by created_at desc limit 5;
--   -- 2) 서비스 롤 전용 함수가 anon/authenticated에 열려 있지 않은지 (둘 다 false여야 한다)
--   select has_function_privilege('anon', 'public.admin_log_member_create(uuid, uuid, text, text)', 'execute'),
--          has_function_privilege('authenticated', 'public.admin_log_member_create(uuid, uuid, text, text)', 'execute');
--   -- 3) 쓰기 권한이 회수됐는지 (insert/update/delete 행이 없어야 한다)
--   select grantee, privilege_type from information_schema.table_privileges
--   where table_schema = 'public' and table_name = 'member_create_log'
--     and grantee in ('anon', 'authenticated') order by 1, 2;

-- ═════════════════════════════════════════════
-- 1. member_create_log — 만들어진 계정 1개당 1행
--    target_id 에는 외래키를 걸지 않는다(password_reset_log·member_withdrawal_log 와 같은 이유:
--    나중에 그 계정을 탈퇴 처리해 지워도 "누가 만들었는지" 기록은 끝까지 남아야 한다).
--    actor_id 는 관리자 이름을 화면에서 조인해 보여 주려고 profiles 를 참조한다(on delete set null).
--    actor_name 은 그때의 이름 스냅샷 — 관리자가 이름을 바꾸거나 계정이 사라져도 기록이 읽힌다.
-- ═════════════════════════════════════════════
create table if not exists public.member_create_log (
  id           bigint generated always as identity primary key,
  target_id    uuid not null,
  target_email text,                      -- {아이디}@class1.local (아이디 확인용). 비밀번호는 절대 넣지 않는다.
  target_role  text not null check (target_role in ('admin', 'user')),
  actor_id     uuid references public.profiles (id) on delete set null,
  actor_name   text,
  source       text not null default 'single' check (source in ('single', 'bulk')),
  created_at   timestamptz not null default now()
);

create index if not exists member_create_log_target_idx
  on public.member_create_log (target_id, created_at desc);
create index if not exists member_create_log_created_idx
  on public.member_create_log (created_at desc);

alter table public.member_create_log enable row level security;

drop policy if exists "member_create_log: 관리자만 조회" on public.member_create_log;
create policy "member_create_log: 관리자만 조회"
  on public.member_create_log for select
  to authenticated
  using (public.is_admin());

-- 쓰기는 admin_log_member_create(서비스 롤)만 한다. 읽기는 위 정책(관리자)만 통과한다.
revoke all on public.member_create_log from anon, authenticated;
grant select on public.member_create_log to authenticated;

-- ═════════════════════════════════════════════
-- 2. admin_log_member_create — 기록 남기기(서비스 롤 전용)
--    Edge Function(admin-create-member)이 계정을 실제로 만든 "다음"에 행마다 한 번 호출한다.
--    · 호출자가 관리자인지 한 번 더 확인한다(서비스 롤만 실행할 수 있지만 이중으로 막는다).
--    · 같은 계정을 여러 번 기록해도 막지 않는다 — 감사 로그는 "일어난 일"을 그대로 쌓는다.
--    · 비밀번호는 인자로도 받지 않는다.
-- ═════════════════════════════════════════════
create or replace function public.admin_log_member_create(
  p_target uuid,
  p_actor  uuid,
  p_role   text,
  p_source text
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id     bigint;
  v_name   text;
  v_email  text;
  v_source text := coalesce(p_source, 'single');
begin
  if p_target is null or p_actor is null then
    raise exception 'missing arguments';
  end if;
  if p_role not in ('admin', 'user') then
    raise exception 'invalid role';
  end if;
  if v_source not in ('single', 'bulk') then
    v_source := 'single';
  end if;
  if not exists (select 1 from public.profiles where id = p_actor and role = 'admin') then
    raise exception 'actor is not an admin';
  end if;

  select p.display_name into v_name from public.profiles p where p.id = p_actor;
  select d.email into v_email from public.member_directory d where d.id = p_target;

  insert into public.member_create_log (target_id, target_email, target_role, actor_id, actor_name, source)
  values (p_target, v_email, p_role, p_actor, v_name, v_source)
  returning id into v_id;

  return v_id;
end;
$$;

-- Supabase 는 public 스키마 함수에 anon/authenticated 실행 권한을 기본으로 주므로 명시적으로 회수한다.
revoke all on function public.admin_log_member_create(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.admin_log_member_create(uuid, uuid, text, text) to service_role;
