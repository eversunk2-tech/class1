-- praise_presets — 관리자 대시보드 "학생 응답" 일괄 칭찬에 쓰는 미리 만든 칭찬 문구(관리자만).
-- 설계: docs/admin/responses-spec.md §5, §6, §12. 앱 쪽 코드: src/lib/praise.ts, src/components/admin/praise-*.tsx
--
-- ▶ 실행 방법
--   Supabase 대시보드 > SQL Editor > New query 에 이 파일 전체를 붙여넣고 Run.
--   여러 번 실행해도 안전하다(if not exists / drop policy if exists / 시드는 테이블이 비어 있을 때만).
--   앞선 마이그레이션(20260921000000_init_blog.sql — profiles, is_admin())이 먼저 실행돼 있어야 한다.
--   실행 전에도 화면은 동작한다: "SQL 실행 필요" 안내와 함께 코드에 들어 있는 기본 문구 6개로 칭찬을 보낼 수 있다(문구 편집만 안 됨).
--   칭찬 메시지 자체는 기존 feedback_threads/feedback_messages(get_or_create_feedback_thread)로 보낸다 — 새 RPC·새 컬럼 없음.
--
-- ▶ 실행 후 확인 쿼리
--   -- 1) 테이블과 RLS (rowsecurity = true)
--   select tablename, rowsecurity from pg_tables where schemaname = 'public' and tablename = 'praise_presets';
--   -- 2) 정책 4개(관리자만 select/insert/update/delete)
--   select policyname, cmd, roles from pg_policies where schemaname = 'public' and tablename = 'praise_presets';
--   -- 3) anon 권한이 없는지 (결과 0행이어야 한다)
--   select privilege_type from information_schema.role_table_grants
--   where table_schema = 'public' and table_name = 'praise_presets' and grantee = 'anon';
--   -- 4) 기본 문구 6개
--   select sort_order, body from public.praise_presets order by sort_order;

create table if not exists public.praise_presets (
  id         uuid primary key default gen_random_uuid(),
  body       text not null,
  sort_order integer not null default 0,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

-- 글자 수 제한(재실행 안전하게 이름을 붙여 다시 만든다). {이름}을 바꾼 뒤 피드백 메시지 한도(2000자)를 넘지 않게 넉넉히 500자.
alter table public.praise_presets drop constraint if exists praise_presets_body_length;
alter table public.praise_presets
  add constraint praise_presets_body_length check (char_length(btrim(body)) between 1 and 500);

alter table public.praise_presets enable row level security;

drop policy if exists "praise_presets: 관리자만 조회" on public.praise_presets;
create policy "praise_presets: 관리자만 조회"
  on public.praise_presets for select
  to authenticated
  using (public.is_admin());

drop policy if exists "praise_presets: 관리자만 추가" on public.praise_presets;
create policy "praise_presets: 관리자만 추가"
  on public.praise_presets for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "praise_presets: 관리자만 수정" on public.praise_presets;
create policy "praise_presets: 관리자만 수정"
  on public.praise_presets for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "praise_presets: 관리자만 삭제" on public.praise_presets;
create policy "praise_presets: 관리자만 삭제"
  on public.praise_presets for delete
  to authenticated
  using (public.is_admin());

-- anon은 아무 권한도 없다. 로그인한 사용자도 행 단위 권한은 위 RLS가 정한다(관리자만).
revoke all on public.praise_presets from anon;
revoke all on public.praise_presets from authenticated;
grant select, insert, update, delete on public.praise_presets to authenticated;

-- 기본 문구 6개(spec §6). 테이블이 완전히 비어 있을 때만 넣는다 → 다시 실행해도 중복되지 않고,
-- 교사가 고치거나 지운 문구가 되살아나지 않는다. (src/lib/praise.ts의 DEFAULT_PRAISE_PRESETS와 같은 문구)
insert into public.praise_presets (body, sort_order)
select v.body, v.sort_order
from (values
  ('{이름} 학생, 오늘 활동을 끝까지 잘 마쳤어요! 실험 기록을 꼼꼼하게 남긴 점이 멋져요. 👏', 1),
  ('{이름} 학생, 예상한 내용과 실험 결과를 잘 비교해서 정리했어요. 계속 이렇게 해봐요!', 2),
  ('{이름} 학생, 분석 문제를 스스로 다시 생각해서 풀어낸 점이 훌륭해요. 최고예요! 🌟', 3),
  ('{이름} 학생, 궁금한 점을 적어낸 게 인상 깊어요. 다음 시간에 함께 알아볼까요?', 4),
  ('{이름} 학생, 오늘도 성실하게 끝까지 참여했어요. 수고 많았어요!', 5),
  ('{이름} 학생, 결론을 자신의 말로 잘 정리했어요. 과학자처럼 생각하고 있어요! 🔬', 6)
) as v(body, sort_order)
where not exists (select 1 from public.praise_presets);
