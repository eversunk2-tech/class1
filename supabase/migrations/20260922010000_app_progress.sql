-- app_progress — 과학 차시 앱의 "진행 중" 상태(학생 × 앱 1행). 다시 로그인하면 이어서 하기(다른 기기 포함).
-- 설계: docs/science/progress-build-instructions.md, 앱 쪽 코드: scripts/templates/class1-record.js · science-sim|science-guide/persist.js
--
-- ▶ 실행 방법
--   Supabase 대시보드 > SQL Editor > New query 에 이 파일 전체를 붙여넣고 Run.
--   여러 번 실행해도 안전하다(if not exists / create or replace / drop ... if exists).
--   앞선 마이그레이션(20260921000000_init_blog.sql — set_updated_at(), is_admin())이 먼저 실행돼 있어야 한다.
--   실행 전에도 앱은 동작한다(로컬 사본으로 계속 쓰고 화면에 "저장 안 됨"을 표시). 실행 후에는 자동으로 DB에 저장된다.
--
-- ▶ 실행 후 확인 쿼리
--   -- 1) 테이블과 RLS (rowsecurity = true)
--   select tablename, rowsecurity from pg_tables where schemaname = 'public' and tablename = 'app_progress';
--   -- 2) 정책 5개(본인 select/insert/update/delete + 관리자 select)
--   select policyname, cmd, roles from pg_policies where schemaname = 'public' and tablename = 'app_progress';
--   -- 3) anon 권한이 없는지 (결과 0행이어야 한다)
--   select privilege_type from information_schema.role_table_grants
--   where table_schema = 'public' and table_name = 'app_progress' and grantee = 'anon';
--   -- 4) 트리거(app_progress_updated_at, app_progress_row_limit)
--   select tgname from pg_trigger where tgrelid = 'public.app_progress'::regclass and not tgisinternal;
--   -- 5) 저장된 진행 상황 훑어보기(관리자)
--   select user_id, app_id, updated_at, octet_length(state::text) as bytes from public.app_progress order by updated_at desc limit 20;

create table if not exists public.app_progress (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  app_id     text not null,
  state      jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, app_id)
);

-- 제약(재실행 안전하게 이름을 붙여 다시 만든다)
-- app_id는 실제 과학 차시 앱 형식만(sci-학년-학기-단원-차시, 예: sci-6-1-2-3). 아무 이름으로나 행을 만들지 못하게 한다.
-- not valid: 이미 실행한 적이 있어 예전 형식의 행이 있더라도 재실행이 실패하지 않게(새로 쓰는 행에만 검사).
alter table public.app_progress drop constraint if exists app_progress_app_id_format;
alter table public.app_progress
  add constraint app_progress_app_id_format
  check (app_id ~ '^sci-[0-9]{1,2}-[0-9]-[0-9]{1,2}-[0-9]{1,2}$') not valid;

alter table public.app_progress drop constraint if exists app_progress_state_object;
alter table public.app_progress
  add constraint app_progress_state_object check (jsonb_typeof(state) = 'object');

alter table public.app_progress drop constraint if exists app_progress_state_size;
alter table public.app_progress
  add constraint app_progress_state_size check (octet_length(state::text) <= 262144);

create index if not exists app_progress_app_idx on public.app_progress (app_id, updated_at desc);

-- updated_at은 서버 시각으로만 정한다(클라이언트가 보낸 값은 무시). 앱은 이 값을 "마지막으로 맞춘 DB 시각"으로 기억한다.
drop trigger if exists app_progress_updated_at on public.app_progress;
create trigger app_progress_updated_at
  before insert or update on public.app_progress
  for each row execute function public.set_updated_at();

-- 사용자당 행 수 제한(저장 공간 남용 방지). 앱 수보다 넉넉하게 200행.
create or replace function public.app_progress_row_limit()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- upsert(insert ... on conflict do update)도 before insert를 거친다 → 이미 있는 행을 고치는 것이면 통과
  if exists (select 1 from public.app_progress where user_id = new.user_id and app_id = new.app_id) then
    return new;
  end if;
  if (select count(*) from public.app_progress where user_id = new.user_id) >= 200 then
    raise exception 'app_progress: 사용자당 행 수 한도(200)를 넘었습니다.';
  end if;
  return new;
end;
$$;

drop trigger if exists app_progress_row_limit on public.app_progress;
create trigger app_progress_row_limit
  before insert on public.app_progress
  for each row execute function public.app_progress_row_limit();

alter table public.app_progress enable row level security;

drop policy if exists "app_progress: 본인 조회" on public.app_progress;
create policy "app_progress: 본인 조회"
  on public.app_progress for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "app_progress: 관리자 조회" on public.app_progress;
create policy "app_progress: 관리자 조회"
  on public.app_progress for select
  to authenticated
  using (public.is_admin());

drop policy if exists "app_progress: 본인 추가" on public.app_progress;
create policy "app_progress: 본인 추가"
  on public.app_progress for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "app_progress: 본인 수정" on public.app_progress;
create policy "app_progress: 본인 수정"
  on public.app_progress for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "app_progress: 본인 삭제" on public.app_progress;
create policy "app_progress: 본인 삭제"
  on public.app_progress for delete
  to authenticated
  using (auth.uid() = user_id);

-- anon은 아무 권한도 없다. 로그인한 사용자도 행 단위 권한은 위 RLS가 정한다.
revoke all on public.app_progress from anon;
revoke all on public.app_progress from authenticated;
grant select, insert, update, delete on public.app_progress to authenticated;
