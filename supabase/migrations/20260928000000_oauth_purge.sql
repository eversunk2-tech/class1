-- 구글·깃허브(OAuth) 전용 계정 '완전 삭제' ⑦ — 서비스 롤 전용 함수 1개(admin_purge_oauth_member)
-- 설계: docs/admin/oauth-delete/spec.md(끝 "개정 1 — 사용자 결정"이 본문보다 우선)
-- 지침: docs/admin/oauth-delete/build-instructions.md · 보고: docs/admin/oauth-delete/build-report.md
-- 사용자(2026-09-28): 구글·깃허브로 로그인한 계정은 관리자가 탈퇴시키면 완전히 삭제되어 대시보드에 정보가 남지 않게,
--   원하면 같은 구글·깃허브 계정으로 다시 가입할 수 있게. 결정: 게시판 글 모두 지우기 · 교사는 담임 해제 뒤 삭제 ·
--   관리 기록 모두 지우기(삭제 사실 로그도 남기지 않음) · 메뉴를 '완전 삭제'로 교체 · 총괄만 · 예전 탈퇴 계정 자동 삭제 없음.
--
-- ▶ 이 파일이 하는 일 — 새 함수 하나만 만든다. 기존 표·정책·함수·트리거는 하나도 고치지 않는다.
--   · public.admin_purge_oauth_member(p_target uuid, p_actor uuid) — security definer, search_path '', 서비스 롤만 실행.
--   · Edge Function admin-purge-oauth-member 가 ⑤ 게임 파일(Storage API) → ⑥ 로그인 계정(auth.users) 을 지운 "다음"에 부른다.
--     이 함수는 그 뒤에 남은 기록을 한 트랜잭션으로 지운다(중간에 오류가 나면 아무것도 지워지지 않는다).
--   · 아이디 계정의 '탈퇴 처리'(admin-delete-member · admin_finalize_withdrawal — 기록 보존)는 그대로다.
--   · 다시 가입: 새 SQL 이 필요 없다. 로그인 계정이 지워지면 같은 구글·깃허브 계정으로 다시 로그인할 때 Supabase Auth 가
--     새 id 로 계정을 만들고, handle_new_user()·sync_member_directory() 가 새 profiles·member_directory 행을 만든다
--     (옛 행은 이 함수가 지워 부딪힐 것이 없다 — profiles.id 는 PK 뿐, 이메일 유일 제약 없음).
--
-- ▶ 누구를 · 누가
--   · 대상: role 'user' 이고 아이디(이메일·비밀번호) 로그인이 없는 계정 = member_directory.provider/providers 에 'email' 이 없고
--     가입 방식이 하나 이상 기록된 계정(화면 src/lib/admin.ts isOAuthOnlyMember()와 같은 규칙). Edge Function 이 Auth 계정의
--     identities·app_metadata 로 한 번 더 확인한다(이중 확인). 예전에 '탈퇴 처리'한 OAuth 계정(Auth 계정은 이미 없음)도 대상이다.
--   · 교사(role 'admin')는 거부 — 총괄이 먼저 '담임 해제'(admin_set_role: 학생 있는 학급을 혼자 맡으면 거부)를 한다(개정 1 Q2).
--   · 부른 사람(p_actor): 총괄(role 'admin' + is_super_admin — is_super_admin()과 같은 판단)만. 자기 자신은 불가.
--     서비스 롤 요청에는 auth.uid() 가 없어 id 로 직접 확인한다(admin_finalize_withdrawal 과 같은 방식).
--
-- ▶ 지우는 것 — 순서(외래키 제약에 걸리지 않게 이 순서로)
--   0) 확인: 인자 · 총괄 · 자기 자신 아님 · 대상 행 잠금(없으면 조용히 끝 — 재시도 멱등) · 교사 아님 · OAuth 전용 ·
--      로그인 계정(auth.users)이 이미 지워졌는지(Edge Function 이 먼저 지운다 — 기록만 지우고 로그인이 남는 일을 막는다)
--   1) community_reports: 그 계정의 글·댓글을 신고한 기록 — 신고는 대상의 제목·내용·작성자를 스냅샷으로 저장해 글이 지워져도
--      관리자 '신고 관리'에 남는다(20260922040000 319~343행). target_author_id = 대상, 또는 대상이 쓴 글(글 신고)·댓글을 가리키는 행.
--      (대상의 글에 달린 "다른 사람 댓글"에 대한 신고는 남긴다 — 그 사람에 대한 기록이다. 관리자가 글을 지울 때와 같다.)
--   2) community_posts: 그 계정이 쓴 자유게시판·학습게임 글(개정 1 Q4 = 모두 지움). 그 글에 달린 **다른 사람의 댓글·좋아요도
--      함께 지워진다**(community_comments/community_likes.post_id cascade). 남은 신고의 post_id·comment_id 는 set null(스냅샷 유지).
--      게임 파일은 여기서 지우지 않는다 — Edge Function 이 Storage API 로 먼저 지운다(SQL 로 storage.objects 를 지우지 않음).
--   3) 관리 기록 3곳(개정 1 Q1·Q3 = 모두 지움, 삭제 사실 로그도 남기지 않음): member_withdrawal_log · member_create_log ·
--      password_reset_log 에서 target_id = 대상. 외래키가 없어(탈퇴해도 남기려고 일부러 뺌) 저절로 지워지지 않는다.
--      교사였던 계정이 "처리한 사람"으로 남은 흔적도 지운다: member_create_log.actor_name(이름 스냅샷) → null,
--      password_reset_log.actor_id → null. (그 행 자체는 다른 회원의 기록이라 남긴다. 두 로그의 actor_id 외래키 열은
--      4)에서 set null 이 된다.)
--   4) profiles 한 줄 — 나머지는 이미 걸린 외래키가 정리한다(모두 public.profiles 를 가리킨다, 실제 SQL 로 다시 확인함):
--      cascade(행이 함께 지워짐): comments · likes · member_directory · app_results · post_reads · assignment_submissions ·
--        feedback_threads(→ 그 스레드의 feedback_messages · feedback_read_marks) · feedback_messages.sender_id ·
--        feedback_read_marks.user_id · app_progress · class_teachers · community_comments · community_likes ·
--        community_reports.reporter_id(그 계정이 한 신고)
--        ⚠ feedback_messages.sender_id: 교사였던 계정이면 학생들에게 보낸 피드백·칭찬도 함께 지워진다(화면 경고에 적음).
--      set null(행은 남고 쓴 사람만 비워짐 → 총괄만 고칠 수 있음): posts.author_id · assignments.created_by ·
--        class_notices.author_id · praise_presets.created_by · classes.created_by · site_settings.updated_by ·
--        member_create_log.actor_id · member_withdrawal_log.actor_id · community_reports.target_author_id(1)에서 이미 지움) ·
--        community_posts.author_id(2)에서 이미 지움)
--      views 는 글 id 만 가진다(사용자 열 없음). 사용자 id 를 외래키 없이 가진 표는 위 3)의 로그 3곳뿐이다.
--   · 트리거: profiles 에는 삭제 트리거가 없다(profiles_updated_at·on_profiles_class_changed 는 update 전용).
--     set null 은 그 표의 update 트리거를 부른다 — posts·assignments·class_notices 의 set_updated_at()(수정 시각이 실행 시각으로
--     바뀜, 화면에 거의 안 보임)뿐이고 오류를 내는 가드는 없다. community_posts_guard 는 2)에서 글을 먼저 지워 불리지 않는다.
--   · RLS: 이 함수는 표 주인(postgres) 권한으로 돌아 RLS 를 거치지 않는다(admin_finalize_withdrawal·admin_set_role 과 같다).
--     RLS 정책은 하나도 만들거나 고치지 않는다(42P17 재귀와 무관).
--
-- ▶ 실행 순서(개정 1 · spec §5)
--   ① 이 파일을 SQL Editor 에서 실행 → ② 아래 확인 쿼리 1)·2) → ③ Edge Function 배포:
--        npx supabase functions deploy admin-purge-oauth-member      (--no-verify-jwt 금지)
--   → ④ 사이트(관리자 화면) push → ⑤ 시험용 구글(또는 깃허브) 계정으로 가입 → 완전 삭제 → 확인 쿼리 3) → 같은 계정으로 다시 로그인
--      → 확인 쿼리 4).
--   · 이 파일 전에 함수·화면이 먼저 배포돼도 안전하다: Edge Function 이 이 함수가 있는지 먼저 확인하고, 없으면
--     "완전 삭제 기능용 DB 설정이 아직 적용되지 않았습니다"로 거부한다(파일·계정·기록 모두 그대로).
--   · 반별 권한 SQL(20260927010000) 뒤이므로 앞선 마이그레이션을 다시 실행하지 않는다(CLAUDE.md). 이 파일은 앞선 파일을 고치지 않는다.
--
-- ▶ 실행 방법
--   Supabase 대시보드 > SQL Editor > New query 에 이 파일 전체를 붙여넣고 Run.
--   SQL Editor 는 붙여 넣은 전체를 한 트랜잭션으로 실행하므로 중간에 오류가 나면 아무것도 바뀌지 않는다.
--   (psql 등 다른 도구로 실행할 때는 psql -1 -v ON_ERROR_STOP=1 -f <파일> 처럼 "한 트랜잭션 + 오류 시 멈춤"으로.)
--   · 여러 번 실행해도 안전하다(create or replace function, revoke/grant).
--   · 맨 앞 점검: 앞선 표·열(학급 ①의 is_super_admin, 커뮤니티 표, 로그 표 3개)이 없으면 오류를 내고 아무것도 바꾸지 않는다.
--   · 맨 끝 점검: 학생·비로그인이 이 함수를 부를 수 있거나, 서비스 롤이 못 부르거나, 지울 행을 가리키는 외래키 중
--     삭제를 막는 것(restrict / no action)이 있으면 오류를 내고 전부 되돌린다(완전 삭제가 중간에 막혀 반쯤 지워지는 일을 막는다).
--   · 성공하면 "✔ 구글·깃허브 계정 완전 삭제 함수를 만들었습니다 …" 알림이 나온다.
--   ⚠ select public.admin_purge_oauth_member(…) 를 SQL Editor 에서 부르지 않는다 — 서비스 롤 전용이다.
--     Edge Function 이 게임 파일(Storage)과 로그인 계정을 먼저 지운 뒤에 부르는 함수라, 여기서 부르면 로그인 계정이 남은
--     회원은 0 단계 확인에 걸려 거부되고, 로그인 계정이 이미 없는 회원(예전에 탈퇴 처리한 계정)은 올린 게임 파일이 Storage 에
--     남은 채 기록만 지워진다(그 뒤로는 화면에서 다시 지울 수 없다). 완전 삭제는 반드시 관리자 화면으로 한다.
--
-- ▶ 실행 후 확인 쿼리(앞의 "-- "를 지우고 한 덩어리씩 Run)
--   -- 1) 함수 권한 — false, false, true 여야 한다(학생·비로그인은 못 부르고 서비스 롤만)
--   select has_function_privilege('anon', 'public.admin_purge_oauth_member(uuid, uuid)', 'execute')          as 비로그인_실행,
--          has_function_privilege('authenticated', 'public.admin_purge_oauth_member(uuid, uuid)', 'execute') as 로그인_실행,
--          has_function_privilege('service_role', 'public.admin_purge_oauth_member(uuid, uuid)', 'execute')  as 서비스롤_실행;
--
--   -- 2) profiles 를 가리키는 외래키의 on delete — c(cascade) 또는 n(set null)만 있어야 한다(r·a 가 있으면 삭제가 막힌다)
--   select c.relname as 표, con.conname as 제약, con.confdeltype as on_delete
--   from pg_constraint con join pg_class c on c.oid = con.conrelid
--   where con.contype = 'f' and con.confrelid = 'public.profiles'::regclass
--   order by 1, 2;
--
--   -- 3) (시험 뒤) 완전 삭제한 회원 id 로 남은 행 — 모두 0 이어야 한다.
--   --    맨 윗줄의 <지운 id> 한 곳만 바꾼다(완전 삭제 전에 회원 상세 주소 /admin/members/?id=… 의 id 값을 적어 두었다가).
--   with t as (select '<지운 id>'::uuid as id)
--   select
--     (select count(*) from public.profiles x, t              where x.id = t.id)                                  as 프로필,
--     (select count(*) from public.member_directory x, t      where x.id = t.id)                                  as 회원명단,
--     (select count(*) from public.member_withdrawal_log x, t where x.target_id = t.id or x.actor_id = t.id)      as 탈퇴기록,
--     (select count(*) from public.member_create_log x, t     where x.target_id = t.id or x.actor_id = t.id)      as 생성기록,
--     (select count(*) from public.password_reset_log x, t    where x.target_id = t.id or x.actor_id = t.id)      as 초기화기록,
--     (select count(*) from public.community_posts x, t       where x.author_id = t.id)                           as 게시판글,
--     (select count(*) from public.community_comments x, t    where x.user_id = t.id)                             as 게시판댓글,
--     (select count(*) from public.community_likes x, t       where x.user_id = t.id)                             as 게시판좋아요,
--     (select count(*) from public.community_reports x, t     where x.reporter_id = t.id or x.target_author_id = t.id) as 신고,
--     (select count(*) from public.comments x, t              where x.user_id = t.id)                             as 블로그댓글,
--     (select count(*) from public.app_results x, t           where x.user_id = t.id)                             as 앱결과,
--     (select count(*) from public.app_progress x, t          where x.user_id = t.id)                             as 앱진행,
--     (select count(*) from public.feedback_threads x, t      where x.student_id = t.id)                          as 피드백대화,
--     (select count(*) from storage.objects x, t where x.bucket_id = 'game-uploads' and x.name like t.id::text || '/%') as 게임파일,
--     (select count(*) from auth.users x, t                   where x.id = t.id)                                  as 로그인계정;
--
--   -- 4) (같은 구글·깃허브 계정으로 다시 로그인한 뒤) 새 id 로 새 계정이 만들어졌는지 — 맨 위 줄이 방금 가입한 계정.
--   --    id 가 <지운 id> 와 달라야 하고, 역할 user · 학급 없음 · 탈퇴 표시 없음이면 정상(이름·이메일은 보이지 않게 뺐다).
--   select p.id, p.role, p.class_id, p.withdrawn_at, d.provider, d.signed_up_at
--   from public.member_directory d join public.profiles p on p.id = d.id
--   order by d.signed_up_at desc
--   limit 5;
--
-- ▶ 되돌리기 — 새 함수 하나만 있으므로 기능을 끄려면 함수만 지운다:
--   drop function if exists public.admin_purge_oauth_member(uuid, uuid);
--   그 뒤 Edge Function 은 "DB 설정 필요"로 거부한다(아무것도 지우지 않음). 이미 완전 삭제한 계정·기록은 되돌릴 수 없다.

-- ═════════════════════════════════════════════
-- 0. 맨 앞 점검 — 앞 단계가 안 됐으면 아무것도 바꾸지 않는다
-- ═════════════════════════════════════════════
do $$
begin
  if not exists (
       select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'profiles' and column_name = 'is_super_admin'
     )
     or to_regclass('public.member_directory') is null
     or to_regclass('public.member_withdrawal_log') is null
     or to_regclass('public.member_create_log') is null
     or to_regclass('public.password_reset_log') is null
     or to_regclass('public.community_posts') is null
     or to_regclass('public.community_comments') is null
     or to_regclass('public.community_reports') is null
     or not exists (
       select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'community_reports' and column_name = 'target_author_id'
     ) then
    raise exception '앞선 마이그레이션(20260921000000 ~ 20260927040000 — 특히 20260927000000_classes_schema.sql 의 is_super_admin, 커뮤니티 표, 관리 기록 표 3개)이 먼저 실행돼 있어야 합니다. 이 파일은 아무것도 바꾸지 않았습니다.';
  end if;

  -- 경고만(멈추지 않음): 완전 삭제는 총괄만 할 수 있다.
  if not exists (select 1 from public.profiles where is_super_admin and role = 'admin') then
    raise notice '⚠ 총괄 관리자가 없습니다(docs/classes/setup-owl-class.sql). 완전 삭제는 총괄만 할 수 있어 지금은 아무도 쓸 수 없습니다.';
  end if;
end $$;

-- ═════════════════════════════════════════════
-- 1. admin_purge_oauth_member — 구글·깃허브 전용 계정의 남은 기록을 모두 지운다(서비스 롤 전용)
--    Edge Function(admin-purge-oauth-member)이 게임 파일과 로그인 계정(auth.users)을 지운 "다음"에 부른다.
--    · 같은 회원을 다시 불러도 안전하다: 이미 지워졌으면 아무것도 하지 않고 끝난다(재시도 멱등).
--    · 오류는 영어 짧은 문구로 낸다 — Edge Function 이 한국어 안내로 바꾸고, 화면에는 이 문구를 그대로 보이지 않는다.
-- ═════════════════════════════════════════════
create or replace function public.admin_purge_oauth_member(p_target uuid, p_actor uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role      text;
  v_provider  text;
  v_providers text[];
begin
  -- 0-1) 인자
  if p_target is null or p_actor is null then
    raise exception 'missing arguments';
  end if;

  -- 0-2) 부른 사람 = 총괄(role 'admin' + is_super_admin). 서비스 롤만 실행할 수 있지만(아래 grant) 한 번 더 확인한다.
  if not exists (
    select 1 from public.profiles a
    where a.id = p_actor and a.role = 'admin' and a.is_super_admin
  ) then
    raise exception 'actor is not a super admin';
  end if;
  if p_target = p_actor then
    raise exception 'cannot purge yourself';
  end if;

  -- 0-3) 대상 — 행을 잠가 같은 회원을 동시에 두 번 지우거나 그사이 역할이 바뀌지 않게 한다(트랜잭션이 끝나면 풀린다).
  select p.role into v_role
  from public.profiles p
  where p.id = p_target
  for update;
  if not found then
    return; -- 이미 지워짐(재시도) — 조용히 끝낸다
  end if;
  if v_role = 'admin' then
    raise exception 'admin accounts cannot be purged'; -- 먼저 담임 해제(admin_set_role)
  end if;

  -- 0-4) OAuth 전용인가: 가입 방식이 하나 이상 기록돼 있고 그중 아이디(email)가 없어야 한다.
  --      (Edge Function 도 같은 규칙 + Auth 계정의 identities 로 먼저 거른다 — 이중 확인)
  select d.provider, d.providers into v_provider, v_providers
  from public.member_directory d
  where d.id = p_target;
  if not found then
    raise exception 'member directory row not found';
  end if;
  if coalesce(v_provider, '') = 'email' or 'email' = any (coalesce(v_providers, '{}'::text[])) then
    raise exception 'target can sign in with id and password';
  end if;
  if coalesce(v_provider, '') = '' and cardinality(coalesce(v_providers, '{}'::text[])) = 0 then
    raise exception 'target sign-in method is unknown';
  end if;

  -- 0-5) 로그인 계정(auth.users)이 먼저 지워졌어야 한다 — 기록만 지우고 로그인이 남으면(프로필 없는 로그인) 화면이 깨진다.
  --      auth 스키마를 읽을 권한이 없는 환경이면 이 확인만 건너뛴다(Edge Function 이 계정을 먼저 지우므로 순서는 지켜진다).
  begin
    if exists (select 1 from auth.users u where u.id = p_target) then
      raise exception 'auth account still exists';
    end if;
  exception when insufficient_privilege then
    null;
  end;

  -- 1) 그 계정의 글·댓글을 신고한 기록(스냅샷에 제목·내용·작성자가 남는다).
  --    글 신고 = 댓글 신고가 아닌 행(comment_id 없음 + target_kind 가 'comment' 아님 — 신고 중복 방지 인덱스와 같은 구분).
  delete from public.community_reports r
  where r.target_author_id = p_target
     or (
       r.comment_id is null
       and r.target_kind is distinct from 'comment'
       and r.post_id in (select cp.id from public.community_posts cp where cp.author_id = p_target)
     )
     or r.comment_id in (select cc.id from public.community_comments cc where cc.user_id = p_target);

  -- 2) 그 계정이 쓴 자유게시판·학습게임 글(그 글의 다른 사람 댓글·좋아요도 cascade 로 함께 지워진다).
  delete from public.community_posts cp
  where cp.author_id = p_target;

  -- 3) 관리 기록 3곳 — 대상에 대한 기록은 행째로, 대상이 "처리한 사람"으로 남은 이름·id 는 비운다.
  delete from public.member_withdrawal_log l where l.target_id = p_target;
  delete from public.member_create_log     l where l.target_id = p_target;
  delete from public.password_reset_log    l where l.target_id = p_target;
  update public.member_create_log l
     set actor_name = null
   where l.actor_id = p_target
     and l.actor_name is not null;
  update public.password_reset_log l
     set actor_id = null
   where l.actor_id = p_target;

  -- 4) 프로필 — 나머지 기록은 외래키(cascade / set null)가 정리한다(파일 맨 위 표).
  delete from public.profiles p
  where p.id = p_target;
end;
$$;

-- Supabase 는 public 스키마 함수에 anon/authenticated 실행 권한을 기본으로 주므로 명시적으로 회수한다.
revoke all on function public.admin_purge_oauth_member(uuid, uuid) from public, anon, authenticated;
grant execute on function public.admin_purge_oauth_member(uuid, uuid) to service_role;

-- ═════════════════════════════════════════════
-- 2. 맨 끝 점검 — 설계와 다르면 전부 되돌린다(아무것도 바뀌지 않음)
-- ═════════════════════════════════════════════
do $$
declare
  v_blocking text;
begin
  if has_function_privilege('anon', 'public.admin_purge_oauth_member(uuid, uuid)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.admin_purge_oauth_member(uuid, uuid)', 'EXECUTE') then
    raise exception '완전 삭제 함수를 학생·비로그인(anon/authenticated)이 부를 수 있습니다(PUBLIC 권한 등). 이 파일 전체를 되돌렸습니다(아무것도 바뀌지 않음) — 이 메시지를 알려 주세요.';
  end if;
  if not has_function_privilege('service_role', 'public.admin_purge_oauth_member(uuid, uuid)', 'EXECUTE') then
    raise exception '서비스 롤이 완전 삭제 함수를 부를 수 없습니다(Edge Function 이 쓸 수 없음). 이 파일 전체를 되돌렸습니다(아무것도 바뀌지 않음) — 이 메시지를 알려 주세요.';
  end if;

  -- 이 함수가 지우는 행(profiles · community_posts · community_comments)을 가리키는 외래키 중 삭제를 막는 것
  -- (r = restrict, a = no action). 있으면 로그인 계정·게임 파일은 지워졌는데 기록 정리(이 함수)가 늘 실패하게 된다.
  select string_agg(format('%s.%s (%s → %s)', n.nspname, c.relname, con.conname, con.confrelid::regclass),
                    ', ' order by n.nspname, c.relname, con.conname)
    into v_blocking
  from pg_constraint con
  join pg_class c on c.oid = con.conrelid
  join pg_namespace n on n.oid = c.relnamespace
  where con.contype = 'f'
    and con.confrelid in ('public.profiles'::regclass, 'public.community_posts'::regclass, 'public.community_comments'::regclass)
    and con.confdeltype in ('r', 'a');
  if v_blocking is not null then
    raise exception '완전 삭제를 막는 외래키가 있습니다: %. 이 파일 전체를 되돌렸습니다(아무것도 바뀌지 않음) — 이 메시지를 알려 주세요.', v_blocking;
  end if;

  raise notice '✔ 구글·깃허브 계정 완전 삭제 함수(admin_purge_oauth_member)를 만들었습니다 — 서비스 롤 전용. 다음: 확인 쿼리 → npx supabase functions deploy admin-purge-oauth-member → 사이트 push.';
end $$;

-- PostgREST 가 새 함수를 바로 알도록(대시보드도 대개 자동으로 하지만 한 번 더)
notify pgrst, 'reload schema';
