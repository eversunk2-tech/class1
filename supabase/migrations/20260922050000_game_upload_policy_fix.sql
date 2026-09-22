-- 게임 업로드 오류 수정: "DatabaseInvalidObjectDefinition — The database schema is invalid or incompatible"
--
-- 원인: storage.objects의 업로드(insert) 정책이 파일 개수를 세려고 storage.objects를 다시 조회했다.
--       정책 안에서 같은 표를 조회하면 그 표의 정책이 다시 적용되며 Postgres가 정책 정의 오류(42P17)로 거부한다.
-- 해결: 개수 세기를 SECURITY DEFINER 함수로 옮겨 정책 밖에서 계산한다(자기 폴더 파일만 센다).
--
-- ▶ 실행 방법: Supabase 대시보드 > SQL Editor > New query 에 이 파일 전체를 붙여넣고 Run. 여러 번 실행해도 안전하다.
--   20260922040000_community.sql 을 먼저 실행해 둔 상태여야 한다.
-- ▶ 확인: 학습게임에서 index.html 을 다시 올려 본다.
--   select policyname, cmd from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname like 'game-uploads%';

create or replace function public.my_game_upload_count()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from storage.objects o
  where o.bucket_id = 'game-uploads'
    and (storage.foldername(o.name))[1] = auth.uid()::text;
$$;

revoke all on function public.my_game_upload_count() from public, anon;
grant execute on function public.my_game_upload_count() to authenticated;

drop policy if exists "game-uploads: 본인 폴더에만 업로드" on storage.objects;
create policy "game-uploads: 본인 폴더에만 업로드"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'game-uploads'
    and (storage.foldername(name))[1] = auth.uid()::text
    and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.html$'
    and public.my_game_upload_count() < 35
  );
