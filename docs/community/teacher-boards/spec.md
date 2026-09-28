# 자유게시판을 담임교사별로 나누기 (spec)

> Plan 단계 산출물. **구현하지 않음** — 이 문서는 승인용이다. 코드·SQL은 Build 단계에서 이 문서를 기준으로 새 파일에 작성한다.
> 조사 범위: `CLAUDE.md`, `docs/community/spec.md`, `docs/classes/spec.md`(특히 §2.2 Q4, §3.9, 개정 1~3), `docs/classes/rollback-classes-rls.sql`,
> `supabase/migrations/20260922040000_community.sql`·`20260926000000_board_login_only.sql`·`20260927000000_classes_schema.sql`·
> `20260927010000_classes_rls.sql`·`20260927020000_class_notices.sql`·`20260927040000_class_assignments.sql`·`20260928000000_oauth_purge.sql`,
> `src/lib/community.ts`·`classes.ts`·`notices.ts`·`admin.ts`·`types.ts`, `src/hooks/use-admin-context.tsx`, `src/components/login-gate.tsx`,
> `src/components/community/*`, `src/app/board/**`, `src/app/admin/(dashboard)/community/community-moderation.tsx`,
> `src/app/admin/(dashboard)/notices/notices-view.tsx`, `src/components/dashboard/{teacher-posts,stat-tile}.tsx`, `src/app/search/search-view.tsx`,
> `src/app/page.tsx`. 모든 서술은 실제로 읽은 코드에 근거하며, 추측인 부분은 "추측"·"확인 필요"로 표시했다. **실 DB는 전혀 조회하지 않았다** —
> 지금 게시판 글·신고 실제 건수 같은 사실은 확인하지 못했다.

---

## 0. 한 쪽 요약

**문제**: 지금 자유게시판(`community_posts` `kind='board'`)은 **로그인한 사람이면 누구나 같은 하나의 게시판을 함께 쓴다**(`20260926000000_board_login_only.sql`이 막은 것은 "로그인 여부"뿐, "어느 반인지"는 전혀 구분하지 않는다). 그래서 총괄 관리자가 개설하지 않은 학급의 학생도 총괄의 게시판을 그대로 쓸 수 있다 — 사용자가 신고한 바로 그 문제다.

**핵심 방향(추천)**: 새 표를 만들지 않고, `community_posts`에 **게시판 주인 열 하나**(`board_owner uuid` — 담임교사 `profiles.id`, `kind='board'`일 때만 필수)를 추가한다. "게시판"은 실체가 아니라 `community_posts.board_owner`로 묶이는 가상의 묶음이다. 담임(총괄 포함) 판별에 이미 쓰는 `class_teachers`·`profiles.class_id`(`docs/classes/spec.md` 개정 1)를 그대로 재사용해 새 함수 2개 + RPC 1개만 추가하고, 기존 정책의 `is_admin()`을 "그 게시판을 쓸 수 있는가"로 좁힌다 — 반별 학습 기록 분리(`teaches_student()`)와 완전히 같은 패턴이다.

**중요한 발견(보안)**: `board_owner`를 "나 자신이면 통과"로만 판별하면 **학생이 자기 자신을 게시판 주인으로 지정해 신고·숨김을 피해 갈 수 있는 구멍**이 생긴다(§3.2에서 자세히). 판별 함수는 반드시 "그 사람이 교사인가"까지 함께 확인해야 한다.

**좋은 소식**: 댓글·좋아요·신고·홈 미리보기·글 수 타일·검색은 전부 `community_posts`를 다시 조회하거나 그 표의 RLS를 그대로 물려받는 구조라(§1.3), **`community_posts`의 SELECT 정책 하나만 바뀌면 대부분 코드 수정 없이 저절로 담임별로 나뉜다.** 코드를 반드시 고쳐야 하는 곳은 "글쓰기"(어느 게시판에 쓸지 고르기)와 "관리자 신고 관리"(총괄만 전체를 보게) 정도다.

**남은 열린 질문**(§8): 담임 해제된 교사의 게시판, 학생이 반을 옮긴 뒤 예전 글, 게시판 목록 화면이 "병합 보기"인지 "고른 게시판만 보기"인지, 다른(총괄 아닌) 담임의 게시판 열람·관리 범위, 지워진 대상의 신고 기록.

---

## 1. 지금 상태

### 1.1 표·정책(확인한 사실)

`community_posts`(`supabase/migrations/20260922040000_community.sql:34-45`)는 `kind`(`'board'|'game'`)만으로 자유게시판과 학습게임을 가른다. 관련 열: `id, kind, title, body, game_path, game_size, author_id, hidden, created_at, updated_at`. **"어느 반(교사)의 글인지"를 나타내는 열이 아예 없다.**

읽기(SELECT) 정책은 두 번 바뀌었다. **지금 살아 있는 버전**은 `20260926000000_board_login_only.sql:52-62`(이름 `"community_posts: 읽기(게시판은 로그인)"`):

```sql
using (
  (
    (not hidden)
    and (select public.can_browse())
    and (kind <> 'board' or (select auth.uid()) is not null) -- 자유게시판은 늘 로그인해야 읽는다
  )
  or auth.uid() = author_id
  or public.is_admin()
)
```

`or public.is_admin()`이 핵심 문제다 — **로그인한 교사라면 누구든(자기 반이든 아니든) 모든 자유게시판 글을 다 본다.** 그리고 쓰기(INSERT) 정책(`20260922040000_community.sql:125-129`)은 `to authenticated with check (auth.uid() = author_id and hidden = false)` — 로그인만 했으면 누구나 쓸 수 있고 **반·담임 조건이 전혀 없다.** 수정(UPDATE, `20260922040000_community.sql:131-136`)·삭제(DELETE, `:138-142`) 정책도 `auth.uid() = author_id or public.is_admin()`이라 여기도 모든 교사가 다른 반 글을 고치고 지울 수 있다.

작성 시 검증을 맡는 트리거 `community_posts_guard()`(`20260922040000_community.sql:72-111`)는 작성자 일치, 20초 속도 제한, 게임 글 30개 제한, 게임 파일 소유자만 확인한다 — **반·게시판 개념이 전혀 없다.**

숨김 처리는 두 개의 `security definer` RPC로만 한다(컬럼 권한으로 `hidden`을 직접 못 바꾸게 막고, RPC 안에서 `is_admin()`만 확인):

- `set_community_post_hidden(p_id, p_hidden)` — `20260922040000_community.sql:151-168`: `if not public.is_admin() then raise exception 'admin only'`
- `set_community_comment_hidden(p_id, p_hidden)` — `:253-270`: 같은 패턴
- `set_community_report_status(p_id, p_status)` — `:454-477`: 같은 패턴
- `resolve_community_reports_for(p_post_id, p_comment_id, p_include_comments)` — `:481-508`: 같은 패턴

**넷 다 "교사면 무엇이든"만 검사한다.** 게시판을 나누려면 이 넷의 본문도 함께 좁혀야 한다(§3.3).

`community_comments`·`community_likes`의 SELECT 정책(`20260926000000_board_login_only.sql:64-96`)은 자기 표를 직접 거르지 않고 **`community_posts`를 다시 조회해서** 그 글이 보이는지 확인한다(예: `community_comments`는 `exists (select 1 from public.community_posts p where p.id = post_id and (not p.hidden or public.is_admin() or auth.uid() = p.author_id) and (p.kind <> 'board' or (select auth.uid()) is not null))`). 이 하위 쿼리로 여는 `community_posts` 접근에도 **`community_posts` 자신의 RLS가 그대로 적용된다**(같은 요청자 권한으로 도는 일반 하위 쿼리라 `security definer`처럼 우회하지 않는다) — 이 파일의 머리말 주석(`:19-20`)이 정확히 이 원리를 설명한다: "댓글·좋아요 정책은 부모 글을 community_posts에서 찾고 그 조회에도 글 정책이 걸리므로 글 정책만 바꿔도 막히지만, 뜻을 분명히 하려고 조건을 직접 적는다." → **`community_posts`의 SELECT 정책만 담임별로 좁히면 댓글·좋아요는 코드를 안 바꿔도 자동으로 같이 좁혀진다**(§1.3에서 더 자세히).

`community_reports`(`20260922040000_community.sql:322-509`)는 신고 시점의 글 제목·본문·작성자를 **스냅샷**으로 저장해 대상이 지워져도 남는다(`target_kind, target_title, target_body, target_author_id`). SELECT 정책(`:405-409`)은 `auth.uid() = reporter_id or public.is_admin()` — **모든 교사가 모든 신고를 다 본다.**

### 1.2 화면 진입점(확인한 사실)

| 화면 | 파일 | 지금 동작 |
|---|---|---|
| 목록 | `src/app/board/page.tsx` → `CommunityPostList kind="board"`(`src/components/community/community-post-list.tsx:42-165`) | `fetchCommunityPosts("board", offset, size)`(`src/lib/community.ts:158-168`) — `kind` 조건만, 게시판 구분 없음 |
| 글쓰기 | `src/app/board/new/page.tsx` → `CommunityNewPost`(`src/components/community/community-post-form.tsx:38-43,108-172`) | `insert({ kind, title, body })` — 어느 게시판인지 고르는 화면 자체가 없음 |
| 상세 | `src/app/board/post/page.tsx` → `CommunityPostDetail`(`src/components/community/community-post-detail.tsx:61-114`) | `fetchCommunityPost(id)`, RLS가 안 보이면 자동으로 `NotFound`(이미 있음 — §4.3) |
| 수정 | `src/app/board/post/edit/page.tsx` → `CommunityEditPost`(`community-post-form.tsx:54-106`) | 작성자 본인·관리자만(화면 검사, 실 권한은 RLS) |
| 댓글 | `community-comment-section.tsx:42-50` | `community_comments` 조회·작성 — 게시판 구분 없음(§1.1의 자동 상속에 기댐) |
| 좋아요 | `community-like-button.tsx:16-95` | `community_likes` 조회·작성 — 게시판 구분 없음 |
| 신고 | `report-dialog.tsx:73-104` | `community_reports` insert — `post_id`만으로 참조 |
| 홈 미리보기 | `src/app/page.tsx:147` `CommunityPostList kind="board" limit={3} loginOnly` | 위 목록과 같은 함수 |
| 홈 글 수 타일 | `src/components/dashboard/stat-tile.tsx:232-240` `CountTile source="board" loginOnly` → `countCommunityPosts("board")`(`community.ts:176-186`) | `kind`+`hidden=false` 개수만 |
| 검색 | `src/app/search/search-view.tsx:78-87,262-368` `searchCommunity("board", q, offset)` | `kind` 조건 + 제목/본문 `ilike` — 게시판 구분 없음 |
| 관리자 신고 관리 | `src/app/admin/(dashboard)/community/community-moderation.tsx:101-124,130-303,309-456` | `ReportsPanel`·`PostsPanel` 모두 `community_reports`/`community_posts`를 조건 없이 전체 조회(`REPORT_COLUMNS`·`ADMIN_POST_COLUMNS`, `:70-75,88-90`) — **로그인한 교사 아무나 열면 전체가 다 보인다** |
| 잠금 안내 | `src/components/login-gate.tsx:27,41-64` `ALWAYS_LOGIN_PREFIXES = ["/board/"]` | "로그인했는지"만 검사 — 어느 반인지는 모름(그대로 둬도 됨, §4.6) |

### 1.3 학습게임과 공유하는 부분(중요 — 안 건드릴 곳)

`community_posts`·`community_comments`·`community_likes`·`community_reports`는 **`kind`로만 나뉜 하나의 표 집합**을 학습게임과 같이 쓴다(`docs/community/spec.md` §5.1의 원래 설계 의도: "통합(kind 판별 컬럼)을 권장"). 이번 변경은 **`kind='board'`일 때만** 조건을 추가하고 `kind='game'` 경로는 정확히 그대로 둬야 한다(사용자 결정 4). RLS를 고칠 때마다 `kind <> 'board'`(게임) 분기와 `kind = 'board'`(게시판) 분기를 나란히 남겨야 실수로 학습게임까지 좁히는 일을 막을 수 있다.

---

## 2. 데이터 설계

### 2.1 새 열: `community_posts.board_owner`

```sql
alter table public.community_posts add column if not exists board_owner uuid references public.profiles (id) on delete restrict;
```

- **`kind='board'`일 때만 필수, `kind='game'`이면 반드시 null**(사용자 결정 4 — 게임은 안 건드림):
  ```sql
  alter table public.community_posts drop constraint if exists community_posts_board_owner_chk;
  alter table public.community_posts add constraint community_posts_board_owner_chk
    check ((kind = 'board') = (board_owner is not null));
  ```
  기존 `community_posts_game_fields_chk`(`20260922040000_community.sql:49-58`)는 그대로 두고 이 제약만 나란히 추가한다(제약을 합치면 읽기 어려워진다).
- **`on delete restrict`**(`on delete set null`이 아니다): 교사(담임) 계정은 완전 탈퇴·완전 삭제 둘 다 대상이 될 수 없다(§5.4에서 근거). `board_owner`가 가리키는 `profiles` 행이 SQL Editor에서 실수로 지워지는 것까지 막는 안전장치로, `assignments.class_id`가 같은 이유로 `on delete restrict`를 쓴 것(`20260927040000_class_assignments.sql:12-14,289-290`)과 같은 논리다. `author_id`(작성자, 탈퇴하면 null로 바뀌어 "탈퇴한 학생"으로 표시)와는 성격이 달라 FK 동작을 다르게 둔다.
- **열 권한**: `board_owner`는 **쓸 때만**(INSERT) 클라이언트가 보내고, 수정(UPDATE)은 못 하게 한다(주인은 한 번 정해지면 안 바뀐다 — §8-2):
  ```sql
  grant insert (kind, title, body, game_path, game_size, board_owner) on public.community_posts to authenticated; -- 기존 목록 + board_owner
  -- update grant는 기존 그대로(title, body, game_path, game_size) — board_owner를 넣지 않는다
  ```
- 인덱스: 기존 `community_posts_kind_idx (kind, hidden, created_at desc)`(`:60`)는 그대로 두고, 게시판별 조회(§4.1의 "게시판 고르기")를 위해 하나 추가하는 것을 추천한다: `create index if not exists community_posts_board_owner_idx on public.community_posts (board_owner, hidden, created_at desc) where board_owner is not null;`

### 2.2 판별 함수 2개 + RPC 1개(`docs/classes/spec.md`의 `teaches_student()`·`my_class_ids()`와 같은 패턴)

```sql
-- 지금 로그인한 학생이 다닐 수 있는 게시판 주인(담임) id 목록. 학생이 아니거나 학급이 없으면 빈 배열.
-- my_class_ids()(교사→자기 학급)의 반대 방향: 학생→그 학급의 담임들.
create or replace function public.my_board_owner_ids()
returns uuid[] language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(ct.teacher_id order by ct.teacher_id), '{}'::uuid[])
  from public.class_teachers ct
  where ct.class_id = public.my_student_class_id();  -- 20260927020000_class_notices.sql:199-211에 이미 있음, null이면 매치 없음(빈 배열)
$$;

-- 지금 로그인한 사람이 게시판 p_owner를 "참여자로" 읽고 쓸 수 있는가.
-- ⚠ p_owner = auth.uid() 만으로 통과시키면 학생이 자기 자신을 board_owner로 넣어 통과할 수 있다 — 반드시 is_admin()도 같이 본다.
create or replace function public.can_use_board(p_owner uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_owner is not null and (
    (p_owner = auth.uid() and public.is_admin())   -- 그 게시판의 담임 본인
    or p_owner = any (public.my_board_owner_ids())  -- 그 담임이 가르치는 학급의 학생
  );
$$;

grant execute on function public.my_board_owner_ids() to public;   -- is_admin()·my_class_ids()와 같은 이유(정책 평가용, 값 자체는 "나"에 대한 것뿐)
grant execute on function public.can_use_board(uuid) to public;
```

- **`can_use_board`는 "글쓰기·읽기 참여자"인지만 본다.** 총괄의 "관리용 전체 보기"는 이 함수가 아니라 `is_super_admin()`(이미 있음, `20260927000000_classes_schema.sql:145-156`)을 정책에서 따로 더한다(§3.1).
- **화면용 RPC** — "글쓰기" 폼의 게시판 고르기, `/board/` 목록의 게시판 스위처(§4.1)에 쓴다. `my_admin_context()`(`20260927000000_classes_schema.sql:316-357`)와 같은 모양(jsonb):
  ```sql
  -- 참여자로서 쓸 수 있는 게시판 목록. 교사(담임·총괄)면 자기 게시판 하나, 학생이면 자기 학급 담임(들)의 게시판.
  create or replace function public.my_boards()
  returns jsonb language plpgsql stable security definer set search_path = '' as $$
  begin
    if auth.uid() is null then
      return '[]'::jsonb;
    end if;
    if public.is_admin() then
      return jsonb_build_array(jsonb_build_object(
        'owner_id', auth.uid(),
        'teacher_name', (select p.display_name from public.profiles p where p.id = auth.uid())
      ));
    end if;
    return coalesce(
      (select jsonb_agg(jsonb_build_object('owner_id', p.id, 'teacher_name', p.display_name) order by p.display_name)
       from public.class_teachers ct
       join public.profiles p on p.id = ct.teacher_id
       where ct.class_id = public.my_student_class_id()),
      '[]'::jsonb
    );
  end;
  $$;
  revoke all on function public.my_boards() from public, anon;
  grant execute on function public.my_boards() to authenticated;
  ```
  `teacher_name`은 `profiles.display_name`을 그대로 쓴다 — 이 열은 이미 `using (true)`로 전체 공개이고(`profiles` SELECT 정책, 여러 마이그레이션에서 그대로 유지) 학급 이름과 달리 "학급 소속 정보"가 아니라 **이미 댓글·글 작성자로 곳곳에 보이는 교사 이름**이라 새로 여는 정보가 없다. `docs/classes/spec.md` 개정 1의 "학생 화면에는 소속 정보를 전혀 보이지 않음" 규칙은 `class_id`·학급 **이름**에 대한 것이지 교사 **이름**이 아니다(§7에서 다시 확인).

### 2.3 기존 글 이관 (사용자 결정 5)

`20260927040000_class_assignments.sql:285-347`의 "학급 채우기" 2단계 패턴을 그대로 따른다(같은 파일에 함께 담는 것을 추천 — 이 SQL 문서 전체가 한 마이그레이션이라, Build 단계에서 파일을 쪼갤지는 판단하되 기본은 한 파일).

```sql
-- ① 글쓴이가 교사(담임)면 자기 자신의 게시판으로
update public.community_posts p
   set board_owner = p.author_id
 where p.kind = 'board' and p.board_owner is null
   and p.author_id is not null
   and exists (select 1 from public.profiles a where a.id = p.author_id and a.role = 'admin');

-- ② 글쓴이가 학생이면 지금 학급의 담임(들) 중 가장 먼저 연결된 담임에게(20260927040000_class_assignments.sql:299-318과 같은 순서 규칙)
update public.community_posts p
   set board_owner = (
         select ct.teacher_id
           from public.profiles s
           join public.class_teachers ct on ct.class_id = s.class_id
           join public.classes c on c.id = ct.class_id
          where s.id = p.author_id and s.role = 'user' and c.archived_at is null
          order by ct.created_at, ct.teacher_id
          limit 1
       )
 where p.kind = 'board' and p.board_owner is null and p.author_id is not null;

-- ③ 나머지(글쓴이 없음 · 학급 없는 계정 · 위 두 단계로 못 정한 것) → 총괄의 학급 담임(부엉이반)
update public.community_posts p
   set board_owner = (
         select ct.teacher_id
           from public.class_teachers ct
           join public.classes c on c.id = ct.class_id
           join public.profiles t on t.id = ct.teacher_id
          where t.is_super_admin and t.role = 'admin' and c.archived_at is null
          order by ct.created_at, ct.teacher_id
          limit 1
       )
 where p.kind = 'board' and p.board_owner is null;

-- ④ 못 채운 글이 있으면 멈춘다(총괄이 담임인 학급이 없는 경우 — class_assignments.sql:336-345와 같은 안전장치)
do $$
declare v_left int;
begin
  select count(*) into v_left from public.community_posts where kind = 'board' and board_owner is null;
  if v_left > 0 then
    raise exception '게시판 주인을 정하지 못한 글이 %개 있습니다. 이 파일 전체를 되돌렸습니다.', v_left;
  end if;
end $$;
```

이관 순서는 **사용자 결정 5의 "담임이 둘 이상인 학급이면 규칙을 정해 적는다"에 대한 추천안**이다 — "가장 먼저 연결된 담임"(`class_teachers.created_at` 오름차순)은 `class_assignments.sql`이 이미 쓴 규칙과 똑같아 새로 설명할 개념이 없다. **확인 필요**: 지금 실제로 게시판 글이 몇 건 있는지, 담임이 둘 이상인 학급이 실제로 있는지는 실 DB를 조회하지 않아 모른다(`docs/STATUS.md`의 2026-09-26 기록은 "게시판 글 0건"이었지만 그 뒤 학생이 썼을 수 있다 — Build 단계에서 사용자가 SQL Editor로 먼저 건수를 확인하는 것을 추천).

### 2.4 `community_reports`에 스냅샷 열 1개 추가

신고 대상 글이 지워지면(`post_id`가 `null`로 바뀜, `20260922040000_community.sql:324-336`의 `on delete set null`) 그 신고가 어느 게시판 것이었는지 알 길이 없어져 §3.3의 신고 조회 범위를 정할 수 없다. 기존 스냅샷 열(`target_kind, target_title, target_body, target_author_id`)과 같은 방식으로 하나 더 남긴다:

```sql
alter table public.community_reports add column if not exists target_board_owner uuid references public.profiles (id) on delete set null;
```

`community_reports_guard()` 트리거(`20260922040000_community.sql:368-397`)가 이미 `post_id`로 `community_posts`를 조회해 스냅샷을 채우므로, 그 select 목록에 `p.board_owner`(글 신고)와 댓글 신고의 경우 `post_id`로 이어지는 글의 `board_owner`를 함께 읽어 채운다(댓글 신고도 `post_id`를 항상 갖고 있다 — `community_reports: 로그인 사용자 신고` 정책, `:411-441`, `community_reports.post_id is not null` 조건).

**이관**: 이 열도 §2.3처럼 채운다 — `post_id`가 아직 살아 있는 신고는 그 글의(이관된) `board_owner`를 그대로 복사하면 되고, 이미 대상이 지워진 옛 신고는 `target_board_owner`가 계속 `null`로 남는다(§8에서 "복구 불가능한 옛 신고"로 다룬다).

---

## 3. 권한(RLS)

### 3.1 `community_posts`

**SELECT** — 이름을 `"community_posts: 읽기(게시판은 로그인+담임별)"`로 바꾼다(63바이트 확인 필요 — 넘으면 `20260926000000_board_login_only.sql:21`처럼 짧게 줄인다):

```sql
using (
  (
    (not hidden)
    and (select public.can_browse())
    and (
      kind <> 'board'
      or ((select auth.uid()) is not null and public.can_use_board(board_owner))
    )
  )
  or auth.uid() = author_id                                              -- 내 글은 어느 게시판이든 항상 보인다(§8-2)
  or (kind <> 'board' and public.is_admin())                             -- 학습게임: 교사 누구나(그대로, 사용자 결정 4)
  or (kind = 'board' and (board_owner = auth.uid() or public.is_super_admin()))  -- 게시판: 그 담임 본인 또는 총괄(사용자 결정 3)
)
```

`kind<>'board' and is_admin()` 줄과 `kind='board' and (...)` 줄을 나란히 둬서 학습게임 쪽을 실수로 건드리지 않았다는 걸 코드로도 보이게 한다(§1.3).

**INSERT**(`community_posts: 로그인 사용자 작성`):

```sql
with check (
  auth.uid() = author_id and hidden = false
  and (
    kind = 'game'
    or (kind = 'board' and board_owner is not null and public.can_use_board(board_owner))
  )
)
```

총괄도 이 조건을 그대로 탄다 — `can_use_board`는 "그 게시판의 담임 본인"일 때만 통과시키므로 **총괄도 자기 게시판에만 쓸 수 있고 다른 담임 게시판에는 못 쓴다**(사용자 결정 3 "다른 담임 게시판에 글은 쓰지 않음"을 RLS로 강제).

**UPDATE**·**DELETE**(지금은 `auth.uid() = author_id or public.is_admin()` 하나씩) — 같은 구조로 좁힌다:

```sql
using (
  auth.uid() = author_id
  or (kind <> 'board' and public.is_admin())
  or (kind = 'board' and (board_owner = auth.uid() or public.is_super_admin()))
)
```

(UPDATE는 `with check`도 같은 식.) 이렇게 하면 "다른 담임 게시판 글을 고치거나 지우는" 것도 함께 막힌다 — 사용자 결정 3의 "관리용으로 볼 수 있다(신고 처리·숨기기·삭제)"는 총괄에게 여전히 열려 있고, 글쓴이 본인 권리도 그대로다.

### 3.2 ⚠ 주의(보안) — `can_use_board`의 자기 참조 구멍

`can_use_board(p_owner)`를 단순히 `p_owner = auth.uid() or p_owner = any(my_board_owner_ids())`로만 짜면, **학생이 새 글을 쓸 때 `board_owner`에 자기 자신의 id를 넣어 보내는 것만으로 `p_owner = auth.uid()`가 참이 되어 통과한다** — 자기 자신을 "담임"으로 자처하는 가짜 게시판을 만들 수 있게 된다(신고·숨김 권한도 함께 생겨 더 위험). §2.2의 정의처럼 **반드시 `public.is_admin()`을 같이 확인**해야 한다(`p_owner = auth.uid() and public.is_admin()`). Build·Review 단계에서 이 부분을 특히 꼼꼼히 봐야 한다 — 실제 계정 2개(학생 하나, 그 학생의 담임 하나)로 "학생이 자기 id를 `board_owner`로 넣어 글을 쓰면 거부되는지"를 반드시 시험한다(§7).

### 3.3 `community_comments` · `community_likes` — **코드 변경 불필요(추천)**

§1.1에서 확인했듯 두 표의 SELECT·INSERT 정책은 전부 `community_posts`를 하위 쿼리로 다시 확인하고, 그 하위 쿼리도 `community_posts`의 RLS를 그대로 통과해야 한다. §3.1에서 `community_posts`의 SELECT 정책을 좁히면 **댓글·좋아요는 정책을 한 글자도 안 고쳐도 자동으로 같은 범위로 좁혀진다.** `20260926000000_board_login_only.sql`이 이미 같은 논리로 "글 정책만 바꿔도 막히지만 뜻을 분명히 하려고 조건을 직접 적는다"(`:19-20`)고 했으므로, Build 단계에서 **명확성을 위해** 댓글·좋아요 SELECT 정책에도 같은 조건을 그대로 옮겨 적는 것을 추천하되(그 파일과 같은 스타일 유지), **기능적으로는 손 안 대도 이미 안전하다**는 점을 Review에서 실제로 확인해야 한다(§7).

숨김·삭제 RPC는 다르다 — `community_comments`의 숨김(`set_community_comment_hidden`)·댓글 삭제(RLS DELETE `auth.uid()=user_id or is_admin()`)는 **글이 아니라 댓글 표 자신의 권한**이라 자동 상속이 안 된다. §3.4에서 다룬다.

### 3.4 관리자 전용 RPC 4개 — 본문에 게시판 조건 추가

넷 다 지금은 `if not public.is_admin() then raise exception 'admin only'` 한 줄이다. 대상 글(또는 그 글이 딸린 댓글의 부모 글)의 `kind`·`board_owner`를 먼저 조회해 아래처럼 바꾼다(패턴은 동일, 서명은 그대로):

```sql
-- set_community_post_hidden(p_id, p_hidden) 예시 — 나머지 셋도 같은 판정 함수를 재사용
declare v_kind text; v_owner uuid;
begin
  select kind, board_owner into v_kind, v_owner from public.community_posts where id = p_id;
  if v_kind is null then raise exception 'not_found'; end if;
  if not (
    (v_kind <> 'board' and public.is_admin())
    or (v_kind = 'board' and (v_owner = auth.uid() or public.is_super_admin()))
  ) then
    raise exception 'admin only';
  end if;
  update public.community_posts set hidden = p_hidden where id = p_id;
end;
```

- `set_community_comment_hidden` — 댓글의 `post_id`로 부모 글의 `kind`·`board_owner`를 먼저 찾은 뒤 같은 판정.
- `resolve_community_reports_for` — 이미 인자로 `p_post_id`를 받으므로 같은 조회 + 판정.
- `set_community_report_status` — 인자가 `p_id`(신고 id)뿐이라 **§2.4의 스냅샷 열(`target_board_owner`)로 판정**한다:
  ```sql
  select target_kind, target_board_owner into v_kind, v_owner from public.community_reports where id = p_id;
  if not (
    (v_kind <> 'board' and public.is_admin())
    or (v_kind = 'board' and (v_owner = auth.uid() or public.is_super_admin()))
  ) then raise exception 'admin only'; end if;
  ```
  `v_kind`가 `'comment'`인 경우(댓글 신고)도 `target_board_owner`가 채워져 있으면(§2.4) 같은 식으로 판정된다 — `target_kind = 'comment'`는 `<> 'board'`라 위 식 그대로 쓰면 game 취급돼 버리므로, **판정 조건을 `v_kind = 'game' and is_admin()` / `v_kind in ('board','comment') and target_board_owner is not null and (...)` 식으로 손봐야 한다** — Build 단계에서 `target_kind`가 댓글 신고일 때는 `target_board_owner`의 null 여부로 board/game을 가른다(§2.4 이관에서 게임 댓글 신고는 `target_board_owner`가 계속 null이므로 자연히 구분된다).

### 3.5 `community_reports` SELECT — 총괄·게시판 주인만(게임은 그대로)

```sql
using (
  auth.uid() = reporter_id
  or public.is_super_admin()
  or (target_kind = 'game' and public.is_admin())
  or (target_kind in ('board', 'comment') and target_board_owner is not null and target_board_owner = auth.uid())
)
```

`target_kind = 'comment'`인데 `target_board_owner`가 null인 경우(게임 글에 달린 댓글 신고, 또는 §2.4 이관에서 못 채운 옛 신고)는 이 식으로 전혀 안 걸린다 — 게임 댓글 신고는 위 `target_kind='game'` 조건이 아니라 놓치게 된다. **정확히 하려면 트리거가 댓글 신고일 때도 `target_kind`를 `'board'|'game'`으로 남기고(지금은 항상 `'comment'`로 고정) 실제 댓글 종류는 별도 표시가 필요하다** — 이건 `20260922040000_community.sql:368-397`의 기존 트리거 설계(글/댓글 구분을 `target_kind`로, board/game 구분을 대상 글의 `kind`로 각각 남기려던 원래 의도가 댓글 신고에서는 글의 kind를 안 남겨 생기는 기존 한계다). **Build 단계에서 `target_kind`를 댓글 신고에도 부모 글의 실제 kind(`'board'|'game'`)로 남기고, "댓글이냐 글이냐"는 이미 있는 `comment_id is not null` 여부로 판단하도록 트리거를 함께 정리하는 것을 추천한다**(§5의 바꿀 것 목록에 포함). 이렇게 하면 위 SELECT 식이 `target_kind='game' and is_admin()` / `target_kind='board' and (target_board_owner=auth.uid() or is_super_admin())` 두 줄로 깔끔해진다.

### 3.6 확인: 학습게임 관련 정책은 전부 그대로

§3.1·§3.4의 모든 식에서 `kind<>'board'`(또는 `target_kind='game'`) 분기는 지금 조건(`is_admin()`)을 글자 그대로 남긴다 — 학습게임의 열람·신고·숨김·삭제 권한은 **교사 누구나**로 하나도 안 바뀐다(사용자 결정 4). `community_likes`·`community_comments`의 정책도 §3.3처럼 자동 상속이라 game 경로는 손댈 필요가 없다.

---

## 4. 화면

### 4.1 `/board/` 목록 — "게시판 고르기"

사용자 결정 2의 문구("게시판이 둘 이상이면 위에서 '○○ 선생님 게시판'을 고르고, 하나면(지금처럼) 고를 것 없이 바로 그 게시판")는 **"내가 참여할 수 있는 게시판이 여러 개면 먼저 하나를 고르고, 고른 게시판의 글만 본다"**는 뜻으로 읽힌다(전체를 한 목록에 섞어 보여주는 "병합 보기"가 아니라, `NoticesView`(`notices-view.tsx:349-385`)의 학급 고르기 `NativeSelect`와 같은 **전환형 스위처**). 이 해석을 추천안으로 삼는다(§8-3에서 다른 해석과 함께 다시 짚는다).

- `my_boards()`(§2.2)를 불러 `owner_id`·`teacher_name` 목록을 얻는다.
- **0개**(학급 없는 계정, 사용자 결정 1 "학급이 없는 계정은 자유게시판을 쓸 수 없다"): `EmptyState`로 "아직 배정된 담임 선생님이 없어요" 안내(§4.5).
- **1개**: 지금처럼 고르는 화면 없이 바로 그 게시판(코드상 `NoticesView`가 학급 1개일 때 고르기 UI를 감추는 것, `notices-view.tsx:354`의 `classes.length > 1 ? (...) : null`과 같은 패턴).
- **2개 이상**: `NoticesView`의 학급 `NativeSelect`(`:360-373`)와 같은 자리에 "게시판" 고르기(라벨 "○○ 선생님 게시판")를 두고, 고른 `owner_id`로 `fetchCommunityPosts`를 필터한다.
- `src/lib/community.ts`의 `fetchCommunityPosts(kind, offset, size)`에 `boardOwner?: string` 인자를 추가해 `.eq("board_owner", boardOwner)`를 더한다(`kind='board'`일 때만 의미 있음). `countCommunityPosts`도 같은 인자를 받게 확장(§4.2).

### 4.2 홈 미리보기·글 수 타일 — **추천: 코드 변경 없이 "내 게시판 전부 합친" 미리보기로 둔다**

홈 `CommunityPostList kind="board" limit={3} loginOnly`(`page.tsx:147`)와 `CountTile source="board"`(`stat-tile.tsx:232-240`)는 `boardOwner`를 넘기지 않으면 지금 그대로 동작한다 — §3.1의 RLS가 이미 "내가 참여할 수 있는 글만" 돌려주므로, **담임이 둘인 학생에게는 두 게시판 글이 섞여 최근 3개·전체 개수로 보인다.** 이건 §4.1의 "게시판 고르기"(들어가서 보는 화면)와는 다른, **더 작은 미리보기 영역이라 병합이 자연스럽다**고 보고 이렇게 추천한다 — 홈 화면에 고르기 UI를 또 두면 복잡해진다. **열린 질문**(§8-3)으로 남기되 이 문서의 추천은 "홈은 병합, `/board/` 목록은 고르기".

### 4.3 글 상세(`/board/post/?id=`) — 대부분 자동 해결

다른 게시판 글 id로 직접 들어오면 `fetchCommunityPost(id)`가 RLS에 걸려 빈 결과를 받고, 이미 있는 `NotFound` 분기(`community-post-detail.tsx:93,316-331`, "글을 찾을 수 없어요")가 그대로 뜬다 — **코드 변경이 필요 없다**(숨긴 글에 대해 지금도 같은 방식으로 동작하는 것과 똑같다).

추천(선택): 담임이 둘 이상인 학생에게는 상세 화면에 "○○ 선생님 게시판"이라는 작은 표시를 더하면 지금 보는 글이 어느 게시판 것인지 알 수 있다 — `POST_COLUMNS`(`community.ts:51-52`)에 `board_owner`와 그 프로필을 조인해야 한다(`profiles!community_posts_board_owner_fkey(display_name)`처럼 관계 이름을 명시해야 한다 — 이미 `author_id`·`target_author_id`에 이렇게 쓰고 있다, `community.ts:48-49`·`community-moderation.tsx:72-74`). 필수는 아니고 없어도 동작은 맞다.

### 4.4 글쓰기(`/board/new/`) — 게시판 고르기 필요

`CommunityPostForm`(`community-post-form.tsx:108-172`)의 `insert` payload에 `board_owner`를 추가해야 한다.

- `my_boards()`로 목록을 얻어 **0개면 폼 대신 안내**(§4.5), **1개면 자동으로 그 `owner_id`를 넣고 고르는 UI 없음**(§4.1과 같은 규칙), **2개 이상이면 폼 위쪽에 고르기**(드롭다운 — `NoticesView`의 학급 고르기와 같은 자리·같은 느낌으로 통일하는 것을 추천).
- 수정 화면(`CommunityEditPost`)은 `board_owner`를 다시 고르지 않는다 — 주인은 한 번 정해지면 안 바뀐다(§2.1의 열 권한이 이미 막는다).

### 4.5 학급 없는 계정 안내 문구

`my_boards()`가 빈 배열이면(구글·깃허브로 들어와 아직 학급 배정이 안 된 계정 등) `/board/` 목록·글쓰기 모두 같은 안내를 쓰는 것을 추천한다: "아직 배정된 담임 선생님이 없어요. 선생님께 학급 등록을 부탁해 주세요." — `NoticesView`가 "학급이 없는 담임"에게 보여주는 "먼저 학급을 개설해 주세요"(`notices-view.tsx:337-347`)와 짝이 되는 문구다.

### 4.6 `LoginGate` — 변경 불필요

`ALWAYS_LOGIN_PREFIXES = ["/board/"]`(`login-gate.tsx:27`)는 "로그인했는지"만 검사하고 실제 데이터 범위는 RLS가 정한다(파일 자체의 설명, `:33`) — 이 원칙이 이번에도 그대로 적용된다. 로그인한 학급 없는 계정은 이 게이트를 통과해 들어온 뒤 §4.5의 안내를 보게 된다(로그인 게이트 문제가 아니라 "빈 게시판" 문제).

### 4.7 검색(`/search/`) — 코드 변경 없이 자동 상속

`searchCommunity("board", q, offset)`(`search-view.tsx:78-87`)도 `community_posts`를 직접 쿼리하므로 §3.1 RLS만 바뀌면 검색 결과도 자동으로 내가 참여할 수 있는 게시판으로 좁혀진다. 다만 §4.2와 같은 이유로 "여러 게시판이 섞여 나온다"는 점은 검색에서는 자연스럽다(검색은 원래 여러 출처를 한 화면에 묶는 기능) — 변경 불필요.

### 4.8 관리자 신고 관리(`/admin/community/`) — 총괄은 전체, 담임은 자기 게시판만

`CommunityModeration`(`community-moderation.tsx:101-124`)의 `ReportsPanel`·`PostsPanel`은 지금 `is_admin()`이면 전체를 조회한다(§1.1). §3.1·§3.5의 RLS가 바뀌면 **총괄이 아닌 담임 계정**은 서버가 자기 게시판(+학습게임 전체, 그대로) 글·신고만 돌려준다 — 화면 코드는 그대로 둬도 "안전하게는" 동작하지만, 두 가지는 추천 변경이다:

1. `ADMIN_POST_COLUMNS`(`community-moderation.tsx:88-90`)·`REPORT_COLUMNS`(`:70-75`)에 `board_owner`/`target_board_owner`(+ 그 프로필 `display_name`)를 추가해, 총괄이 볼 때 각 글·신고가 "어느 선생님 게시판" 것인지 표시한다(사용자 결정 3 "관리용으로 모든 게시판을 볼 수 있다"를 실제로 쓸 수 있게).
2. 총괄에게는 `PostsPanel`의 종류 필터(`전체 / 자유게시판 / 학습게임`, `:369-383`)에 더해 "게시판(선생님)" 필터를 추가하는 것을 추천한다 — 그렇지 않으면 게시판이 여러 개가 됐을 때 총괄 화면에 모든 반 글이 한 목록에 섞여 실질적으로 찾기 어렵다. **필수는 아니고, Build 단계에서 범위를 조정할 수 있는 선택 항목이다.**

`useAdminContext()`(`use-admin-context.tsx`)의 `ctx.isSuperAdmin`으로 총괄 여부를 화면에서도 미리 알 수 있어(§4.1의 `NoticesView`가 `superAdmin` 변수로 문구를 바꾸는 것과 같은 방식, `notices-view.tsx:92,382`), "이 글은 내 게시판이 아니라 관리용으로만 보여요" 같은 구분 표시를 다는 것도 추천(선택).

---

## 5. 바꿀 것 목록

### 5.1 새 마이그레이션 SQL

**파일 제안**: `supabase/migrations/20260928010000_teacher_boards.sql`(마지막 파일 `20260928000000_oauth_purge.sql` 다음 순번). §2·§3의 내용을 한 파일에 담는 것을 추천(같은 성격의 열+함수+RLS+이관을 한 번에 담은 `20260927040000_class_assignments.sql`과 같은 규모·구성). 파일 위에 실행 방법·실행 순서(이 파일은 ①schema~③rls~④notices 이후 아무 때나 실행 가능 — `class_teachers`·`my_student_class_id()`만 있으면 되므로 특정 순번 의존 낮음, 다만 관례대로 최신 뒤에 둔다)와 확인 쿼리(§7)를 적는다. 맨 끝에 "설계와 다르면 전부 되돌리는" 점검 블록을 두는 이 저장소의 관례(`20260927010000_classes_rls.sql:680-712`, `20260927040000_class_assignments.sql:402-569`)를 그대로 따른다.

### 5.2 화면 파일

| 파일 | 바꿀 내용 |
|---|---|
| `src/lib/community.ts` | `fetchCommunityPosts`·`countCommunityPosts`에 `boardOwner?` 인자, `POST_COLUMNS`·`POST_SUMMARY_COLUMNS`·`ADMIN_POST_COLUMNS`에 `board_owner`(+조인) 추가, `insert` payload에 `board_owner` |
| `src/lib/classes.ts` 또는 신규 `src/lib/boards.ts` | `my_boards()` RPC 래퍼(패턴은 `fetchAdminContext`와 같음, `classes.ts:83-87`) |
| `src/components/community/community-post-list.tsx` | 목록에 게시판 고르기(§4.1), `CommunityPostCard`에 게시판 표시(선택) |
| `src/components/community/community-post-form.tsx` | 글쓰기에 게시판 고르기(§4.4), insert에 `board_owner` |
| `src/components/community/community-post-detail.tsx` | (선택) 상세에 게시판 표시(§4.3) |
| `src/app/admin/(dashboard)/community/community-moderation.tsx` | 컬럼 목록에 `board_owner` 추가(§4.8), (선택) 총괄용 게시판 필터 |
| 신규 공용 컴포넌트(선택) | 게시판 고르기 UI를 목록·글쓰기가 같이 쓰게 분리(`notices-view.tsx`의 학급 고르기처럼 인라인으로 둬도 무방) |

`community-comment-section.tsx`·`community-like-button.tsx`·`report-dialog.tsx`·`search-view.tsx`·`stat-tile.tsx`·`login-gate.tsx`는 §3.3·§4.2·§4.6·§4.7에서 확인했듯 **코드 변경이 필요 없다**(RLS만으로 자동 상속).

### 5.3 `CLAUDE.md` 개정 문구(제안)

커뮤니티 규칙 절의 "로그인한 사용자 누구나 글·댓글·좋아요·신고, 글은 바로 공개"를 아래로 바꾸는 것을 제안한다:

> * **자유게시판은 담임교사별로 나뉜다**(2026-09-28 사용자 결정): 게시판은 담임 한 명마다 하나이고, 그 교사가 담임인 학급(`class_teachers`)의 학생들이 함께 쓴다. 담임이 둘 이상인 학급의 학생은 두 게시판을 모두 본다(2개 이상이면 게시판을 고른다). 학급 없는 계정은 못 쓴다. 총괄은 자기 게시판을 쓰고, 관리용으로 모든 게시판을 신고 처리·숨기기·삭제할 수 있다(다른 담임 게시판에 글은 안 씀). 학습게임(`kind='game'`)은 지금처럼 모두 함께다.
> * 로그인한 사용자 누구나 자기 게시판에 글·댓글·좋아요·신고, 글은 바로 공개. 관리자(교사)는 자기 게시판(총괄은 전체)에서 숨기기·삭제·신고 처리.

`docs/STATUS.md`도 배포 뒤 갱신 대상이지만 이건 Build/배포 단계 몫이라 이 문서에서는 문구만 제안한다.

### 5.4 완전 삭제·완전 탈퇴와의 관계

- **교사(담임) 계정은 두 삭제 경로 모두에서 원천적으로 제외된다**: 완전 탈퇴는 `role='admin'`이면 애초에 대상이 아니고(`CLAUDE.md` "관리자 대상은 불가"), 완전 삭제(`admin_purge_oauth_member`, `20260928000000_oauth_purge.sql:192-193`)도 `if v_role = 'admin' then raise exception 'admin accounts cannot be purged'`로 거부한다. **`board_owner`가 가리키는 `profiles` 행이 이 두 경로로 사라지는 일은 없다** — §2.1에서 `on delete restrict`를 추천한 것과 같은 결론이다. 담임 해제(`admin_set_role`)로 교사가 아니게 되는 경우는 삭제가 아니라 §8-1에서 별도로 다룬다.
- **학생의 완전 삭제**(`admin_purge_oauth_member`)는 그 학생이 쓴 `community_posts`를 통째로 지운다(`20260928000000_oauth_purge.sql:232-234`, "그 계정이 쓴 자유게시판·학습게임 글") — `board_owner` 열 유무와 무관하게 지금 동작 그대로다(행 자체가 없어지므로 FK 문제가 생기지 않는다).
- **학생의 완전 탈퇴**(`auth.users`만 삭제, `profiles`는 "탈퇴한 학생"으로 보존)는 `community_posts`를 전혀 건드리지 않는다(지금과 동일) — `author_id`는 그대로 남고 `profileDisplayName()`이 "탈퇴한 학생"으로 표시하는 지금 동작이 그대로 적용된다.

### 5.5 배포 확인(§6·§7과 연결)

- 새 SQL이 없을 때 화면이 안전하게 동작하는지: `board_owner`가 없는 상태에서 화면이 `insert`에 그 필드를 보내면 PostgREST가 `PGRST204`(모르는 컬럼)를 돌려준다 — 다른 화면들이 `isMissingSchemaError()`(`src/lib/admin.ts:16` 근방)로 "SQL 실행 필요" 안내로 바꾸는 것과 같은 처리를 게시판 화면에도 적용해야 한다(§6에서 "SQL 먼저" 순서로 이 문제 자체를 피하는 게 우선이지만, 방어적으로 갖춰 두는 것을 추천).

---

## 6. 배포 순서

1. **SQL 먼저**: `20260928010000_teacher_boards.sql`을 사용자가 Supabase SQL Editor에서 실행(§5.1) → §7의 확인 쿼리로 검증. **화면이 `board_owner`에 의존하므로 반드시 SQL이 화면보다 먼저 배포돼야 한다**(`CLAUDE.md` "앱·사이트 코드가 새 SQL에 의존하면 SQL 실행 → 확인 → push 순서로 배포한다").
2. 화면 커밋(§5.2) → Review(브라우저 확인, §7) → 사용자 확인 → push.
3. push 뒤 GitHub Actions + 두 배포 사이트(GitHub Pages·Vercel) 새 코드 확인(`CLAUDE.md` 관례).
4. Edge Function 변경 없음(§1에서 확인 — `admin-create-member`·`admin-reset-password`·`admin-delete-member`·`check-answer` 무엇도 `community_posts`를 건드리지 않는다, 재배포 불필요).

---

## 7. 시험 계획

### 7.1 화면(가짜 세션·가짜 응답) — Review 서브에이전트가 확인

| 계정 | 확인할 것 |
|---|---|
| 학생 A(총괄의 부엉이반) | `/board/` = 총괄 게시판만(고르기 없음), 글쓰기 → `board_owner`=총괄 id로 저장, 다른 담임 글 id로 상세 접근 시 `NotFound` |
| 학생 B(다른 담임 반) | `/board/`가 A와 다른 게시판, A의 글 id로 직접 들어가면 `NotFound`, 검색해도 안 나옴, 홈 글 수 타일이 A와 다른 값 |
| 담임이 둘인 학급 학생 | `/board/`에 게시판 고르기 2개, 둘 다 읽기·쓰기 가능, 글쓰기 폼에도 고르기 2개 |
| 학급 없는 계정(OAuth 첫 로그인 등) | `/board/`·글쓰기 모두 "담임 선생님이 없어요" 안내, 폼이 아예 안 보임 |
| 담임(총괄 아님) | 자기 게시판 읽기·쓰기·숨기기·삭제 가능, `/admin/community/`에서 다른 반 글·신고가 안 보임, `set_community_post_hidden`을 다른 반 글 id로 호출하면 거부 |
| 총괄 | 자기 게시판 쓰기 가능, 다른 담임 게시판에는 못 씀(§3.2 확인 포함 — **자기 id를 `board_owner`로 넣어 다른 학급에 억지로 쓰는 시도도 거부되는지**), `/admin/community/`에서는 모든 게시판 글·신고가 보이고 숨기기·삭제·신고 처리 가능 |
| **§3.2 보안 시험(필수)** | 학생 계정으로 `insert`할 때 `board_owner`에 **자기 자신의 id**를 직접 넣어 보내면 RLS가 거부하는지(가짜 응답이 아니라 실제 요청 형태로 — Supabase 호출을 가로채 응답만 흉내 내는 지금 방식으로는 "요청이 거부됐는지" 자체는 못 보므로, 이 항목은 §7.2의 실 DB 흉내 시험에서 **반드시** 함께 확인) |

### 7.2 실 DB에서 사용자가 확인할 것(SQL Editor, `set local role` 흉내 — `20260927010000_classes_rls.sql`·`20260927040000_class_assignments.sql`이 쓰는 방식 그대로)

- anon·타 학급 로그인 계정으로 다른 게시판 글이 하나도 안 보이는지(`count(*)`가 0)
- §3.2의 자기 참조 구멍이 실제로 막히는지: 학생 계정을 흉내 내 `insert into community_posts (kind, title, body, board_owner) values ('board','시험','시험', '<자기 자신의 id>')`를 시도해 거부되는지(`do $$ ... exception when insufficient_privilege ...$$` 패턴, `20260927040000_class_assignments.sql:143-159`와 같은 방식)
- 이관 뒤(§2.3) `select count(*) from community_posts where kind='board' and board_owner is null` = 0
- §2.4 신고 스냅샷 이관 뒤 `target_board_owner`가 채워진 신고 수 vs 전체 신고 수(못 채운 옛 신고가 있으면 몇 건인지 사용자에게 보고)

### 7.3 되돌리기

`docs/classes/rollback-classes-rls.sql`과 같은 성격의 "이 파일이 바꾼 정책·함수만 옛 정의로" 되돌리는 비상용 SQL을 Build 단계에서 같은 폴더(`docs/community/teacher-boards/`)에 준비해 두는 것을 추천한다(옛 정의: `20260926000000_board_login_only.sql`의 정책 3개 + `20260922040000_community.sql`의 관리자 RPC 4개 본문 + `20260922040000_community.sql`의 UPDATE/DELETE 정책 2개).

---

## 8. 열린 질문(추천안 포함)

이미 정한 1~5(지침 문서)는 제외하고, 이 문서를 쓰며 새로 발견한 것만 정리한다.

1. **담임 해제된 교사의 게시판**: `admin_set_role`이 담임을 해제하면(`20260927010000_classes_rls.sql:599-636`) 그 교사의 `class_teachers` 행이 지워지고 학급은 `archived_at`으로 보관된다(학생이 남아 있으면애초에 해제 자체가 거부됨, `:607-622`). 이 시점 이후 `my_board_owner_ids()`는 그 교사를 더는 포함하지 않으므로, **그 게시판은 아무도 새로 못 쓰고 못 보는 상태로 얼어붙는다**(글쓴이 본인의 "내 글은 항상 보임" 예외만 살아 있고, 총괄은 관리용으로 계속 봄). **추천**: 이 "얼어붙음"을 그대로 최종 동작으로 삼는다(학급이 `archived_at`으로 보관되는 것과 같은 철학 — 지우지 않고 접근만 막음). 별도 이관·삭제 로직을 추가하지 않는다.
2. **글쓴이가 학급을 옮긴 뒤 예전 글**: `board_owner`는 **쓴 시점에 고정**되고(§2.1, 수정 불가) 이후 학생이 다른 반으로 옮겨도(`profiles.class_id` 변경) 예전 글은 예전 담임 게시판에 그대로 남는다. 그 학생은 §3.1의 "내 글은 항상 보임" 예외로 자기 예전 글은 계속 보되, 예전 게시판의 다른 글·새 댓글은 더 이상 못 본다(새 반의 게시판만 보임). **추천**: 이 스냅샷 방식을 그대로 쓴다(`docs/classes/spec.md` §2.5가 학습 기록에는 "지금 반 기준"을 추천했지만, 게시판 글은 "그 순간 그 교실에서 나눈 대화"라는 성격이 강해 학습 기록과 다르게 "쓴 시점 기준"이 더 자연스럽다 — 구현 비용도 이쪽이 훨씬 낮다: 학생이 반을 옮길 때 아무 마이그레이션도 필요 없다).
3. **`/board/` 목록이 "병합"인지 "전환"인지**: §4.1에서 "전환형 스위처"를 추천안으로 정했지만, 사용자 문구("두 담임의 게시판을 모두 본다")는 "한 목록에 섞여서 다 보인다"로도 읽을 수 있다. 두 해석의 구현 차이는 크다(스위처는 고르기 UI + 쿼리 필터 필요, 병합은 §3.1 RLS만으로 이미 됨 — 코드가 훨씬 적다). **추천**: 지침 문구의 "위에서 … 고르고 … 그 게시판"이라는 표현이 "들어가서 보는 게시판 자체가 바뀐다"에 더 가깝다고 보고 전환형을 최종 추천으로 유지하되, **사용자가 승인 단계에서 명확히 답해 주길 요청**한다(병합이면 §4.1·§4.4의 "고르기 UI"가 글쓰기 한 곳에만 필요해지고 목록은 그대로 두면 돼 Build 범위가 크게 준다).
4. **총괄이 아닌 다른 담임의 게시판 열람·관리 범위**: 지침은 총괄의 "관리용 전체 보기"만 명시했고, **총괄이 아닌 일반 담임이 자기 반이 아닌 다른 담임의 게시판을 볼 수 있는지는 언급이 없다.** 이 문서의 §3.1·§3.5·§4.8은 "일반 담임은 자기 게시판만, 총괄만 전체"로 설계했다(추천 근거: 사용자 결정 3의 "다른 담임 게시판에 글은 쓰지 않음"이 쓰기뿐 아니라 전반적인 "게시판은 담임 책임 단위"라는 원칙을 보여주고, `docs/classes/spec.md` §2.2의 원래 추천("게시판 신고=그 반 담임+총괄")과도 맞는다). **확인 필요**: 이 추천을 그대로 승인할지, 아니면 지금처럼 "교사면 누구나 모든 게시판을 관리"로 둘지.
5. **지워진 대상의 옛 신고(§2.4)**: `post_id`가 이미 `null`인 신고는 `target_board_owner`를 채울 방법이 없어 §3.5 조건으로는 **총괄만** 보게 된다(일반 담임에게는 안 보임 — 자기 반 신고였어도). 실제로 몇 건이나 있는지는 확인하지 못했다(§2.3의 "확인 필요"와 같음). **추천**: 그대로 두고(드문 경우로 보임, 총괄이 대신 처리 가능), 건수가 많다고 확인되면 그때 별도 대응을 논의한다.
6. **게시판 신고 사유 목록**: `report-dialog.tsx:60`은 `isGame`으로만 "게임이 이상하게 동작해요" 사유를 더하거나 뺀다 — 게시판이 여러 개가 돼도 이 목록 자체는 그대로면 된다(교사 구분과 무관). 변경 불필요, 확인만.
7. **`community_posts_kind_idx`에 `board_owner`를 포함할지**(§2.1의 새 인덱스 추천과 별개로, 기존 인덱스를 `(kind, board_owner, hidden, created_at desc)`로 확장할지 새로 하나 더 둘지): 성능에 큰 영향은 없어 보이지만(게시판 수·글 수가 작음) Build 단계에서 판단.

---

**사용자 승인 전**

## Claude 검토 메모 (2026-09-28, 사용자 승인 전 — Build는 이 절을 본문보다 우선한다)
* **R1(필수) — `board_owner`는 `on delete set null`**(본문 §2.1의 `restrict`가 아니라): 본문 §5.4는 "교사 계정은 완전 삭제 대상이 아니다"라고 했지만, 사용자 결정(구글·깃허브 계정 완전 삭제 개정 1 Q2)은 **"먼저 담임 해제 뒤 삭제"** — 담임 해제로 `role='user'`가 된 옛 교사는 `admin_purge_oauth_member`의 대상이 된다. `restrict`면 그 교사의 게시판에 글이 있을 때 `profiles` 삭제가 막혀 완전 삭제가 끝내 실패한다(로그인 계정·게임 파일은 이미 지운 뒤 — warning만 반복). → `on delete set null` + 제약은 `check (kind = 'board' or board_owner is null)`(게임은 늘 null)로 바꾸고, **게시판 글에 주인이 꼭 있어야 하는 것은 INSERT 정책**(`board_owner is not null and can_use_board(board_owner)`)으로 지킨다. 주인이 지워진 게시판 글은 **총괄(관리용)과 글쓴이 본인만** 본다(담임 해제 때의 "얼어붙음"과 같은 결과). 기존 `admin_purge_oauth_member`는 고치지 않는다.
* **R2(필수) — "게시판 주인" 권한은 지금 교사일 때만**: SELECT·UPDATE·DELETE 정책과 관리 RPC의 `board_owner = auth.uid()` 줄을 모두 `(board_owner = auth.uid() and public.is_admin())`로 — 담임 해제(`role='user'`)된 옛 교사가 옛 게시판의 숨긴 글을 보거나 학생 글을 숨기기·지우지 못하게(본문 §8-1 "얼어붙음"과 맞춤). `can_use_board`(§2.2)는 이미 그렇게 되어 있다.
* **R3(필수) — 게시판 관리 권한이 도는 곳을 모두 좁힌다**: 본문은 관리 RPC 4개만 다뤘지만, `community_comments`의 UPDATE·DELETE 정책(`auth.uid() = user_id or is_admin()`)처럼 **`is_admin()`으로 게시판 글·댓글·좋아요·신고를 고치거나 지울 수 있는 정책·함수 전부**를 찾아(마이그레이션 전체 `grep`) 게시판 쪽은 "그 게시판 담임(지금 교사) 또는 총괄"로 좁힌다(학습게임 쪽은 그대로). 댓글 정책이 글 표를 볼 때는 다른 표이므로 하위 쿼리(`exists (select 1 from public.community_posts p where p.id = post_id and …)`)로 써도 재귀가 아니다 — 같은 표를 다시 보는 정책만 `security definer` 함수로.
* **R4(추천) — 신고의 `target_kind` 뜻은 바꾸지 않는다**(본문 §3.5의 "댓글 신고도 부모 글 kind로" 제안 대신): 댓글 신고는 지금처럼 `'comment'`로 두고, 게시판 것인지는 새 스냅샷 `target_board_owner`(글 신고 = 그 글의, 댓글 신고 = 부모 글의 `board_owner`)와 부모 글의 kind로 가린다 — 관리자 화면 표시·중복 방지 인덱스·완전 삭제 함수가 `target_kind`를 이미 쓰고 있어 뜻을 바꾸면 고칠 곳이 늘어난다. 게시판 신고인지 모르는 옛 신고(대상이 이미 지워짐)는 **총괄만** 본다(본문 §8-5 추천).
* **정해진 것(사용자 답에서)**: §8-3 = **고르기(전환형)** — 사용자가 고른 안의 문구가 "게시판이 둘 이상이면 위에서 '○○ 선생님 게시판'을 고르고, 하나면 바로 그 게시판"이다. 홈 미리보기·글 수·검색은 본문 추천대로 합쳐서. §8-4 = **일반 담임은 자기 게시판만, 총괄만 전체**(사용자 결정 3). §8-1·§8-2·§8-5 = 본문 추천(얼어붙음, 쓴 시점 고정, 옛 신고는 총괄만).
* SQL 작성 규칙 재확인: 정책 안에서 같은 표 다시 조회 금지(42P17), `x = any (public.f())`(괄호 겹치지 않기 — 42883), 재실행 안전, 맨 끝 점검(설계와 다르면 전부 되돌림), 되돌리기 SQL(`docs/community/teacher-boards/rollback-teacher-boards.sql`), 파일 위 확인 쿼리(학생 흉내로 `board_owner`에 자기 id를 넣은 insert가 거부되는지 포함).

## 개정 1 — 사용자 결정 변경 (2026-09-28, Build 중) **이 절이 본문·검토 메모보다 우선한다.**
* 사용자: "학생이 '어느 담임의 게시판인지' 적는 칸을 하지마. 학생은 무조건 소속된 담임교사 게시판만 쓰도록 해" → 담임 두 명인 학급을 다시 물음 → **"한 게시판으로 자동"**.
* **학생에게는 게시판이 늘 하나(또는 없음)** — 그 학생 학급의 **먼저 맡은 담임**(`class_teachers.created_at`가 가장 이른 행, 같으면 `teacher_id` 순 — 기존 글 이관 §2.3과 같은 규칙)의 게시판. 학생 화면에는 **게시판 고르기가 없다**(목록·글쓰기 모두). 학생이 글을 쓸 때 `board_owner`는 화면이 그 담임 id를 자동으로 넣고, DB는 그 값만 받는다(다른 값·자기 id는 거부 — §3.2 구멍 막기 그대로). 입력칸·고르기 UI를 학생에게 보이지 않는다.
* **보조 담임**(그 학급의 먼저 맡은 담임이 아닌 담임): 자기 게시판(자기가 먼저 맡은 학급들의 게시판) + **보조로 맡은 학급의 먼저 맡은 담임 게시판**을 함께 보고·쓰고·관리한다. 교사에게 게시판이 둘 이상이면 교사 화면에만 고르기를 둔다.
* 판별 함수(§2.2)를 이에 맞춘다: `my_board_owner_ids()`(학생 = 먼저 맡은 담임 하나), `can_use_board(p_owner)`(학생 = 그 하나 / 교사(`is_admin()`) = 자기 자신 또는 자기가 담임인 학급의 먼저 맡은 담임), 관리 판정 `can_manage_board(p_owner)`(교사 = 위와 같음 + `is_admin()`, 총괄 = 전부), `my_boards()`(학생 = 하나, 교사 = 자기 + 보조로 맡은 학급의 먼저 맡은 담임, 중복 없이).
* 먼저 맡은 담임이 담임 해제되면 다음으로 이른 담임이 그 학급의 게시판 주인이 된다(학생의 게시판이 바뀜 — 예전 글은 예전 게시판에 남아 총괄·글쓴이만 봄, 본문 §8-1과 같은 "얼어붙음"). 드문 경우라 따로 옮기지 않는다(보고서에 적음).

## 개정 2 — 사용자 결정 (2026-09-28, 검토 L1 뒤) **이 절이 개정 1·검토 메모·본문보다 우선한다.**
* 검토 L1: 개정 1대로면 **보조로만 맡은 교사**(먼저 맡은 학급이 없는 교사)와 **학급이 없는 교사**에게도 "내 게시판"이 생기는데, 그 게시판은 학생이 아무도 보지 않는다. 그런데도 목록·글쓰기의 기본값이 그 게시판이고, 도움말은 "학생들에게 보여요"라고 한다.
* 사용자: **"개설한 학급 있을 때만"**. 교사의 "자기 게시판"은 **자기가 먼저 맡은(개설한) 학급이 있을 때만** 생긴다.
  * 보조로만 맡은 교사는 맡은 학급의 게시판(그 학급의 먼저 맡은 담임 것)만 보고·쓰고·관리한다.
  * 학급이 없는 교사는 게시판이 없다. 화면은 "아직 맡은 학급이 없어요 / 관리자 개요나 회원 관리 맨 위의 '내 학급'에서 학급을 개설하면 그 학급 학생들과 함께 쓰는 게시판이 생겨요."
* **판별 함수**: `my_board_owner_ids()`에서 "교사면 자기 id" 갈래를 뺐다. 교사 = 자기가 담임(보조 포함)인 학급들의 `class_board_owner`, 학생 = 자기 학급의 `class_board_owner`.
  * 목록에는 늘 "학급의 먼저 맡은 지금 교사"만 들어간다. 그래서 학생 id가 들어갈 길이 원래부터 없다(§3.2 구멍이 더 단단히 막힘).
  * `can_use_board`·`can_manage_board`·`my_boards` 본문은 그대로다(목록 함수만 바뀜).
* **기존 글 옮기기 ①**: 교사 글 → 그 교사가 담임(보조 포함)인 학급의 게시판. 순서는 자기가 먼저 맡은 학급이 있으면 자기 게시판, 없으면 맡은 학급 중 먼저 맡은 순이다. 학급이 없는 교사의 글은 ③(총괄 게시판)으로 간다.
* **③의 총괄**: 먼저 맡은 학급이 있는 총괄을 먼저 고른다. 그 총괄의 게시판은 학생과 함께 쓰는 게시판이다.
* **실행 전 확인**: A를 같은 규칙으로 고쳤다. **D(학급 없는 학생·교사 수, 검토 L3)**를 더했다.
* **맨 끝 점검 6-6(검토 L5)**: 그대로 둔 "본인 수정"·"본인 취소"도 `auth.uid()`와 `user_id` 조건이 있는지 확인한다. 넓게 바뀐 정책도 잡는다.
* 지금은 교사가 총괄 한 명(부엉이반의 먼저 맡은 담임)뿐이라 지금 계정의 결과는 개정 1과 같다.
