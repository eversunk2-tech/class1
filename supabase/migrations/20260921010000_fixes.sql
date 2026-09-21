-- 1차 리뷰 수정 (docs/blog/review.md #6, #12)
-- Supabase 대시보드 > SQL Editor에서 이 파일 전체를 한 번 실행한다. 여러 번 실행해도 안전하다.

-- ─────────────────────────────────────────────
-- #6 handle_new_user: display_name을 50자로 자른다
--   profiles.display_name 은 char_length <= 50 제약이 있어, 긴 이름(OAuth full_name, CSV name)이
--   들어오면 트리거가 실패하고 auth 계정 생성 자체가 롤백되던 문제를 막는다.
-- ─────────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)), 50),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

-- ─────────────────────────────────────────────
-- #12 comments: 작성자는 body 컬럼만 수정할 수 있다
--   기존 정책("comments: 본인만 수정")은 행 단위라 post_id·created_at 등도 바꿀 수 있었다.
--   컬럼 권한으로 update 가능한 컬럼을 body로 제한한다(updated_at은 트리거가 채우므로 권한이 필요 없다).
-- ─────────────────────────────────────────────
revoke update on public.comments from anon, authenticated;
grant update (body) on public.comments to authenticated;
