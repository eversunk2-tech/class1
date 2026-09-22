# 커뮤니티 개편 설계 (자유게시판 · 학습게임 업로드 · 메뉴/홈 개편)

이 문서는 설계 전용이다. 구현하지 않는다(`plan-instructions.md` 수정 범위).
읽은 파일: `CLAUDE.md`/`AGENTS.md`, `src/data/menu.ts`, `src/components/layout/**`, `src/app/page.tsx`,
`src/app/games/page.tsx`, `src/app/math/page.tsx`, `src/app/science/page.tsx`, `src/components/science/science-view.tsx`,
`src/data/science-curriculum.ts`, `src/data/apps.ts`, `src/components/apps/*`, `src/components/dashboard/stat-tile.tsx`,
`src/components/class/tagged-post-list.tsx`, `src/components/dashboard/popular-posts.tsx`, `src/app/post/**`,
`src/components/comment-section.tsx`, `src/lib/markdown.ts`, `src/lib/supabase.ts`, `src/hooks/use-session.tsx`,
`src/lib/menu-colors.ts`, `src/app/globals.css`, `src/app/admin/**`, `supabase/migrations/*.sql`, `next.config.ts`.

## 1. 요약

1. **수학수업 삭제**: 메뉴·페이지·홈 섹션에서 제거. 기존 "수학" 태그 글은 검색으로만 남는다(§11).
2. **자유게시판 신설**: 로그인 사용자 누구나 작성, 비로그인도 열람. 댓글·좋아요, 작성자 수정/삭제, 교사 숨김/삭제.
3. **학습게임 개편**: `/games/`가 정적 카드 목록(`src/data/apps.ts`, 현재 빈 배열)에서 **사용자 업로드 게시판**으로 바뀐다.
   생성형 AI로 만든 `index.html`을 올리면 **절대 사이트와 같은 출처로 실행하지 않는 sandbox iframe**에서 바로 플레이(§4).
4. **홈 화면**: 과학수업 카드 집계 버그 수정(§6), "최근 소식/인기 글/최근 수학 수업" 제거, "최근 과학 수업(차시 앱 현황 포함)
   · 최근 자유게시판 · 학습게임 미리보기" 3개로 재구성.

## 2. 화면·URL 목록 (정적 export, 쿼리스트링 라우팅)

| 화면 | URL | 인증 |
|---|---|---|
| 홈 | `/` | 공개 |
| 자유게시판 목록 | `/board/` | 공개 |
| 자유게시판 글쓰기 | `/board/new/` | 로그인 |
| 자유게시판 상세 | `/board/post/?id=<uuid>` | 공개(숨김 글은 작성자·관리자만) |
| 자유게시판 수정 | `/board/post/edit/?id=<uuid>` | 작성자·관리자 |
| 학습게임 목록 | `/games/` | 공개 |
| 학습게임 올리기 | `/games/new/` | 로그인 |
| 학습게임 상세(플레이) | `/games/post/?id=<uuid>` | 공개(숨김은 작성자·관리자만) |
| 학습게임 수정 | `/games/post/edit/?id=<uuid>` | 작성자·관리자 |
| 과학수업 | `/science/?term=…` | 공개(기존 유지) |
| ~~수학수업~~ `/math/` | 삭제 | — |
| 관리자 커뮤니티 관리 | `/admin/community/` (신설) | 관리자 |

기존 관리자 블로그 글은 `/post/?slug=`를 그대로 쓰고(관리자 전용 작성이라 유지), 커뮤니티 글은 충돌을 피하려 **UUID 기반 `id` 쿼리**를 쓴다(§5에서 별도 테이블로 분리하는 이유와 연결).

## 3. 화면별 상세

- **목록(`/board/`, `/games/`)**: `TaggedPostList`(`src/components/class/tagged-post-list.tsx`) 패턴을 복제한 `CommunityPostList` —
  로딩 스켈레톤·빈 상태(`EmptyState`)·오류 재시도(`ErrorState`)·"더 보기" 페이지네이션. 목록에 "글쓰기"/"게임 올리기" 버튼(비로그인 시 `/login/`으로 유도).
  숨긴 글은 작성자 본인 로그인 시에만 "숨김" 배지와 함께 노출.
- **상세**: `src/app/post/post-detail.tsx` 구조 재사용 — 제목/본문(게시판) 또는 제목/설명+플레이어(게임), `LikeButton`, `CommentSection`을
  `community_likes`/`community_comments` 대상으로 바꾼 버전, 작성자 수정/삭제 버튼, 관리자 숨김/삭제 버튼.
- **작성/수정**: `admin/write/post-editor.tsx`를 단순화 — 게시판은 제목(≤100자)+본문(마크다운, ≤5000자, `renderMarkdown`+DOMPurify로 렌더),
  게임은 제목+설명(≤1000자)+`index.html` 업로드(수정 시 파일 재업로드는 선택, 안 하면 기존 파일 유지). 제출 전 로그인 확인(`useSession`), 실패 시 `toast.error`.
- **게임 플레이어**(§4 핵심): `AppCard`(`src/components/apps/app-card.tsx`)의 모달·iframe·"새 탭" 패턴을 참고하되 **"새 탭으로 열기"는 제공하지 않는다**
  (새 탭은 sandbox 밖 최상위 문서가 되어 §4 위협모델이 무력화됨). 대신 "전체 화면"(iframe 자체를 Fullscreen API로 확대) 버튼과 "정지"(iframe 언마운트) 버튼 제공.

## 4. 업로드 게임 보안 설계 (최우선)

**원칙**: 사이트는 같은 출처 `localStorage`에 Supabase 세션 토큰을 둔다(`@supabase/supabase-js` 기본 동작). 업로드 HTML은
**절대 사이트 출처(GitHub Pages `https://eversunk2-tech.github.io/class1`)로도, Storage의 공개 URL(직접 열람 가능한 문서)로도 실행하지 않는다.**

### 4.1 렌더링 방식
1. 업로드된 HTML 원문을 **Supabase Storage에서 텍스트로 fetch**(공개 URL을 `<iframe src>`에 직접 쓰지 않는다).
2. `<iframe sandbox="allow-scripts" srcdoc={html}>`로 렌더링.
   - **`allow-same-origin`은 절대 넣지 않는다** — 이게 없으면 브라우저가 `srcdoc` 문서에 매번 새 **불투명(opaque) 출처**를 부여해
     사이트 쿠키·`localStorage`·부모 `window`/DOM에 어떤 경로로도 접근할 수 없다(같은 오리진 정책 자체가 성립하지 않음).
   - `allow-top-navigation`, `allow-popups`, `allow-modals`, `allow-forms`, `allow-pointer-lock` **모두 제외**.
   - 전체화면이 필요하면 `sandbox="allow-scripts allow-fullscreen"` + iframe `allow="fullscreen"` + `allowFullScreen`만 추가 허용(그 외는 그대로 차단).
3. 업로드 파일의 Storage 객체 `Content-Type`은 업로드 시 클라이언트가 **강제로 `text/plain`**으로 지정한다(실제 내용은 HTML이어도).
   그래야 위 fetch+srcdoc 경로를 우회해 누군가 Storage 공개 URL을 **직접 새 탭에서 열어도** 브라우저가 문서로 렌더링(=스크립트 실행)하지 않고
   텍스트로 표시하거나 다운로드한다. `Content-Disposition: attachment`도 함께 지정 권장.
4. `srcdoc`에 넣기 전, 우리 쪽에서 문서 맨 앞에 방어적 CSP `<meta http-equiv="Content-Security-Policy">`를 주입한다(생성형 AI 게임이
   흔히 쓰는 CDN 스크립트·인라인 스크립트·인라인 이벤트 핸들러는 허용하되, 중첩 프레임/플러그인은 차단):
   `default-src * data: blob: 'unsafe-inline'; script-src * 'unsafe-inline' 'unsafe-eval' blob: data:; frame-src 'none'; object-src 'none'`.
   이미 sandbox가 핵심 방어선이므로 CSP는 심층 방어(중복 방어)다. 업로드 HTML이 이미 `<meta http-equiv="Content-Security-Policy">`를
   가지고 있으면 더 엄격한 쪽만 남기지 않고 **우리 것을 항상 앞에 삽입**해 최소 기준을 보장한다(사용자 CSP가 더 느슨해도 sandbox가 상한선).

### 4.2 저장 방식
- Supabase Storage 버킷 `game-uploads`(공개 버킷, 단 4.1처럼 Content-Type 강제로 직접 렌더링 방지). 경로 `{user_id}/{post_id}.html`.
- DB 텍스트 컬럼 저장은 배제: Storage가 크기 제한·Content-Type 제어·CDN 캐시에 유리하고, 대용량 텍스트로 `community_posts` 행이 비대해지는 것도 피한다.
- **파일 형식 검사**(클라이언트, 서버 측 강제는 불가 — 정적 export라 Storage RLS와 크기 제한이 사실상의 서버 검증 전부):
  - 확장자 `.html` 1개, UTF-8 디코딩 성공 여부 확인, 최대 **2MB**(Storage 버킷 `file_size_limit`으로도 강제).
  - **여러 파일 게임(상대경로 이미지/JS/CSS 등)은 지원하지 않는다** — 업로드 폼에 "인라인 코드 또는 CDN 절대경로만 지원"을 명시.
- 재업로드(수정): 같은 경로에 `upsert: true`로 덮어쓰기, 또는 새 경로 발급 후 이전 파일 삭제(권장: 새 경로 — 캐시된 옛 버전이 남지 않게).

### 4.3 남은 위협과 대응(위협모델)

| 위협 | 대응 | 잔여 위험 |
|---|---|---|
| 사이트 세션·쿠키·localStorage 탈취 | `allow-same-origin` 미부여 → 불투명 출처, 접근 불가 | 없음 |
| 부모 탭 피싱 리다이렉트(top-navigation) | `allow-top-navigation` 미부여 | 없음 |
| 팝업/새 창 남용 | `allow-popups` 미부여 | 없음 |
| 폼으로 조용한 외부 전송 | `allow-forms` 미부여 | `fetch()`는 `allow-scripts`만으로도 동작 — 게임이 자체 서버로 데이터를 보내는 것 자체는 막을 수 없음(임베드 콘텐츠 공통 한계). 개인정보 입력 금지 안내 문구 필요 |
| Storage 공개 URL을 새 탭에서 직접 열어 무방비 실행 | Content-Type을 `text/plain`으로 강제, 목록/상세 어디서도 공개 URL을 직접 노출하지 않고 항상 fetch+srcdoc 경유 | 사용자가 Storage REST API를 직접 조작해 파일 자체는 받아볼 수 있으나(공개 버킷이므로) 실행 불가 |
| 무한 루프·CPU/메모리 과부하 | "정지" 버튼으로 iframe 언마운트(리마운트로 재시작), 브라우저 탭 자체는 전체가 죽지 않도록 iframe 스코프에 한정 | 극단적 경우 탭 강제 종료가 필요할 수 있음(안내 문구) |
| 소리 자동재생/과다 | 자동재생은 브라우저 정책상 사용자 상호작용 필요 — 별도 대응 불요, "정지" 버튼이 음소거 겸함 |  |
| 태블릿 터치 미대응 게임 | sandbox와 무관, UX 이슈로 별도 안내("터치가 안 되면 선생님께 알려주세요") |  |
| 저장공간 남용(대량 업로드) | 로그인 필수, 2MB 제한, 계정당 업로드 속도 제한(§5 rate limit), 관리자 삭제 |  |
| 악성 콘텐츠 신고 | (제안) `community_reports` 테이블 — §12 열린 질문 |  |

## 5. DB·Storage 설계

### 5.1 테이블 구조 비교와 결정
- 기존 `posts`(관리자 전용 작성 RLS)에 커뮤니티 글을 얹으면 "관리자만 작성" 정책과 "누구나 작성" 정책이 충돌해 재작성이 필요하다 → **재사용하지 않는다.**
- `board_posts`/`game_posts` 완전 분리 vs `community_posts(kind)` 통합을 비교하면, 두 종류가 제목·작성자·숨김·댓글·좋아요 등
  **공통 필드가 대부분**이고 목록/카운트 쿼리를 한 테이블로 묶어 처리할 수 있어 **통합(`kind` 판별 컬럼)을 권장**한다. 게임 전용 컬럼만 nullable로 추가.
- 댓글·좋아요는 기존 `comments`/`likes`가 `posts` FK와 "발행된 글만" 정책을 전제해 재사용이 어렵다 → **신규 `community_comments`/`community_likes`**로
  동일 패턴을 복제한다(정책만 "숨김 아님"으로 교체).

### 5.2 SQL 초안 (재실행 안전 — `if not exists` / `drop policy if exists`)

```sql
-- ─────────────────────────────────────────────
-- community_posts (자유게시판 + 학습게임 통합)
-- ─────────────────────────────────────────────
create table if not exists public.community_posts (
  id            uuid primary key default gen_random_uuid(),
  kind          text not null check (kind in ('board', 'game')),
  title         text not null check (char_length(title) between 1 and 100),
  body          text check (char_length(body) <= 5000), -- board: 본문, game: 설명(≤1000 권장, 폼에서 제한)
  game_path     text,            -- kind='game'일 때 game-uploads 버킷 경로
  game_size     integer,         -- 업로드 파일 크기(byte)
  author_id     uuid references public.profiles (id) on delete set null default auth.uid(),
  hidden        boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint community_posts_game_path_chk
    check (kind <> 'game' or game_path is not null)
);

create index if not exists community_posts_kind_idx on public.community_posts (kind, hidden, created_at desc);

drop trigger if exists community_posts_updated_at on public.community_posts;
create trigger community_posts_updated_at
  before update on public.community_posts
  for each row execute function public.set_updated_at();

alter table public.community_posts enable row level security;

drop policy if exists "community_posts: 숨김 아니면 누구나, 작성자·관리자는 숨김도" on public.community_posts;
create policy "community_posts: 숨김 아니면 누구나, 작성자·관리자는 숨김도"
  on public.community_posts for select
  using (not hidden or auth.uid() = author_id or public.is_admin());

drop policy if exists "community_posts: 로그인 사용자 작성" on public.community_posts;
create policy "community_posts: 로그인 사용자 작성"
  on public.community_posts for insert
  to authenticated
  with check (auth.uid() = author_id);

drop policy if exists "community_posts: 본인 수정" on public.community_posts;
create policy "community_posts: 본인 수정"
  on public.community_posts for update
  to authenticated
  using (auth.uid() = author_id)
  with check (auth.uid() = author_id);

drop policy if exists "community_posts: 관리자 숨김 처리" on public.community_posts;
create policy "community_posts: 관리자 숨김 처리"
  on public.community_posts for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "community_posts: 본인 또는 관리자 삭제" on public.community_posts;
create policy "community_posts: 본인 또는 관리자 삭제"
  on public.community_posts for delete
  to authenticated
  using (auth.uid() = author_id or public.is_admin());

-- 작성자는 hidden을 스스로 바꿀 수 없다(컬럼 권한 분리, profiles.role과 동일한 기법)
revoke update on public.community_posts from anon, authenticated;
grant update (title, body, game_path, game_size) on public.community_posts to authenticated;
-- 관리자 update 정책은 RLS의 using()으로 행 단위 판단이라 컬럼 권한과 별개로 hidden도 바꿀 수 있어야 하므로,
-- is_admin() 사용자에게는 별도 grant가 필요: 관리자 UPDATE는 SECURITY DEFINER RPC(public.set_community_post_hidden)로 우회 권장(아래).

create or replace function public.set_community_post_hidden(p_id uuid, p_hidden boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;
  update public.community_posts set hidden = p_hidden where id = p_id;
end;
$$;
revoke all on function public.set_community_post_hidden(uuid, boolean) from public;
grant execute on function public.set_community_post_hidden(uuid, boolean) to authenticated;

-- 남용 방지: 같은 사용자가 20초 안에 다시 글을 쓰지 못하게(soft rate limit)
create or replace function public.community_posts_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.community_posts
    where author_id = new.author_id and created_at > now() - interval '20 seconds'
  ) then
    raise exception 'too_fast';
  end if;
  return new;
end;
$$;
drop trigger if exists community_posts_rate_limit on public.community_posts;
create trigger community_posts_rate_limit
  before insert on public.community_posts
  for each row execute function public.community_posts_rate_limit();

-- ─────────────────────────────────────────────
-- community_comments / community_likes (comments/likes와 동일 패턴, 대상만 community_posts)
-- ─────────────────────────────────────────────
create table if not exists public.community_comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.community_posts (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  body       text not null check (char_length(body) between 1 and 2000),
  hidden     boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists community_comments_post_idx on public.community_comments (post_id, created_at);
drop trigger if exists community_comments_updated_at on public.community_comments;
create trigger community_comments_updated_at
  before update on public.community_comments
  for each row execute function public.set_updated_at();
alter table public.community_comments enable row level security;

drop policy if exists "community_comments: 숨김 아니면 누구나" on public.community_comments;
create policy "community_comments: 숨김 아니면 누구나"
  on public.community_comments for select
  using (
    (not hidden or auth.uid() = user_id or public.is_admin())
    and exists (select 1 from public.community_posts p where p.id = post_id and (not p.hidden or public.is_admin() or auth.uid() = p.author_id))
  );

drop policy if exists "community_comments: 로그인 사용자 작성" on public.community_comments;
create policy "community_comments: 로그인 사용자 작성"
  on public.community_comments for insert
  to authenticated
  with check (auth.uid() = user_id and exists (select 1 from public.community_posts p where p.id = post_id and not p.hidden));

drop policy if exists "community_comments: 본인 수정" on public.community_comments;
create policy "community_comments: 본인 수정"
  on public.community_comments for update
  to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
revoke update on public.community_comments from anon, authenticated;
grant update (body) on public.community_comments to authenticated;

drop policy if exists "community_comments: 본인 또는 관리자 삭제" on public.community_comments;
create policy "community_comments: 본인 또는 관리자 삭제"
  on public.community_comments for delete
  to authenticated
  using (auth.uid() = user_id or public.is_admin());

-- (관리자 댓글 숨김도 community_posts와 동일하게 SECURITY DEFINER RPC 권장: set_community_comment_hidden)

create table if not exists public.community_likes (
  post_id    uuid not null references public.community_posts (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
alter table public.community_likes enable row level security;
drop policy if exists "community_likes: 누구나 조회" on public.community_likes;
create policy "community_likes: 누구나 조회" on public.community_likes for select using (true);
drop policy if exists "community_likes: 본인 추가" on public.community_likes;
create policy "community_likes: 본인 추가"
  on public.community_likes for insert to authenticated
  with check (auth.uid() = user_id and exists (select 1 from public.community_posts p where p.id = post_id and not p.hidden));
drop policy if exists "community_likes: 본인 취소" on public.community_likes;
create policy "community_likes: 본인 취소"
  on public.community_likes for delete to authenticated using (auth.uid() = user_id);

-- ─────────────────────────────────────────────
-- Storage: game-uploads 버킷 (대시보드 또는 SQL로 생성, public 버킷 + 크기 제한)
-- ─────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit)
values ('game-uploads', 'game-uploads', true, 2097152)
on conflict (id) do update set public = true, file_size_limit = 2097152;

drop policy if exists "game-uploads: 누구나 조회(콘텐츠는 text/plain으로 강제)" on storage.objects;
create policy "game-uploads: 누구나 조회(콘텐츠는 text/plain으로 강제)"
  on storage.objects for select
  using (bucket_id = 'game-uploads');

drop policy if exists "game-uploads: 본인 폴더에만 업로드" on storage.objects;
create policy "game-uploads: 본인 폴더에만 업로드"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'game-uploads' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "game-uploads: 본인 또는 관리자 삭제" on storage.objects;
create policy "game-uploads: 본인 또는 관리자 삭제"
  on storage.objects for delete to authenticated
  using (bucket_id = 'game-uploads' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
```

## 6. 홈 화면 구성

- **집계 버그**: `StatTiles`(`src/components/dashboard/stat-tile.tsx`)가 학습게임 수를 `webApps.length`(항상 0)로 센다.
  과학 카드는 "과학" 태그 글 수만 세고 차시 앱은 집계하지 않는다 → 사용자가 본 "0개"는 이 두 지점 중 하나(요청 문맥상 과학 카드 쪽).
  **추천 집계 기준**: 과학 카드 = `scienceTerms`의 모든 `lesson.app` 존재 개수 총합(현재 12, `src/data/science-curriculum.ts` 순회로 로컬 계산, DB 호출 불필요)
  **+** "과학" 태그 글 수(둘을 합산해 라벨을 "차시 앱 12 · 글 N"처럼 병기하거나, 카드 자체는 앱 개수를 대표값으로 쓰고 부제로 글 수 표기). 학습게임 카드는
  `community_posts`에서 `kind='game' and not hidden`의 `count(head:true)`로 교체.
- **섹션 재구성**(2열 그리드 유지, `DashboardSection` 재사용):
  1. **최근 과학 수업**: 기존 `TaggedPostList tag="과학"`에 더해 "차시별 앱 현황" 서브 블록 — 단원별 앱 등록 수(예: "1. 산과 염기 6/6")와
     최근에 연결된 차시 앱 3~5개를 실험(`sim`)/조사(`guide`) 배지와 함께 바로가기 링크로 표시하는 신규 컴포넌트(`ScienceAppStatus`, 로컬 데이터라 즉시 렌더).
  2. **최근 자유게시판**: `CommunityPostList kind="board" limit=3`.
  3. **학습게임 미리보기**: `CommunityPostList kind="game" limit=3`(카드에 썸네일 대신 게임 아이콘 + 제목, 플레이는 상세에서만).
- "최근 소식"·"인기 글"·"최근 수학 수업" 섹션과 `PopularPosts`/`TaggedPostList tag="수학"` 호출 제거.

## 7. 메뉴 변경

- `src/data/menu.ts`에서 `math` 항목 삭제, `MenuColor`에서 `"math"` 제거(또는 하위호환을 위해 타입에는 남기고 배열에서만 제외 — 마이그레이션 리스크 적은 쪽은 완전 제거).
- 신규 `board` 항목 추가: 아이콘 `MessageSquareIcon`(lucide), 일러스트 신규 제작(`board-illustration.tsx`, 기존 4종과 같은 톤).
  **색 토큰**: 수학 제거로 비는 `--math-soft`/`--math-strong`(oklch 80° hue, 광고 없는 온기 있는 색)을 **`board`로 이름만 교체**해 재사용 —
  `globals.css`의 `@theme inline` 매핑과 라이트/다크 값 그대로, 변수명만 `--board-*`로 바꾸고 `menu-colors.ts`에 `board` 엔트리 추가(`math` 항목 제거).
  새 hue를 만들지 않아 CSS 변경 범위가 최소화된다.
- `games` 항목의 `description`을 "직접 만든 게임을 해봐요" → "게임을 올리고 해봐요"로 갱신(선택).
- 사이드바(`sidebar.tsx`)·모바일 드로어(`mobile-nav-drawer.tsx`)·홈 바로가기 카드는 모두 `menuItems`를 순회하므로 코드 수정 불필요.
- `/math/` 접근 시 기존 방문자를 위해 `src/app/math/page.tsx`를 완전 삭제하는 대신 "이동됨" 안내 + `/` 링크만 남기는 안(§11 참고, 정적 export라 서버 redirect 불가 — 302는 `next.config`로 불가능하고 클라이언트 `<meta refresh>`나 JS redirect만 가능).

## 8. 파일 구조 (신규/변경, 구현 시 참고용)

```
src/app/board/page.tsx                 (목록)
src/app/board/new/page.tsx             (작성)
src/app/board/post/page.tsx            (상세, board-post-detail.tsx)
src/app/board/post/edit/page.tsx       (수정)
src/app/games/page.tsx                 (기존 파일 교체: 업로드 게시판 목록)
src/app/games/new/page.tsx             (게임 올리기)
src/app/games/post/page.tsx            (상세/플레이, game-post-detail.tsx)
src/app/games/post/edit/page.tsx       (수정)
src/app/math/                          (삭제)
src/components/community/community-post-list.tsx   (TaggedPostList 변형)
src/components/community/community-post-form.tsx   (게시판 작성/수정 공용)
src/components/community/game-upload-field.tsx      (파일 검증 + 업로드)
src/components/community/game-player.tsx             (sandbox iframe, 정지/전체화면)
src/components/community/community-comment-section.tsx
src/components/community/community-like-button.tsx
src/components/dashboard/science-app-status.tsx      (§6 차시 앱 현황)
src/components/illustrations/board-illustration.tsx
src/data/menu.ts, src/lib/menu-colors.ts, src/app/globals.css   (수정)
src/app/admin/(dashboard)/community/page.tsx, community-moderation.tsx  (숨김/삭제 관리)
supabase/migrations/20260923000000_community.sql
```

## 9. 구현 단계

1. DB: `20260923000000_community.sql` 적용(§5), Storage 버킷 생성.
2. 메뉴/홈: `menu.ts` 수정, `globals.css`/`menu-colors.ts` 색 교체, `/math/` 삭제.
3. 자유게시판: 목록·작성·상세·수정·댓글·좋아요(리스크 낮음, 기존 패턴 재사용 多).
4. 학습게임 업로드: 파일 검증 → Storage 업로드 → `game_path` 저장(§4.2).
5. 게임 플레이어(`game-player.tsx`): sandbox+srcdoc+CSP 주입, 정지/전체화면(§4.1) — **가장 신중하게, 별도로 보안 검토 후 병합**.
6. 홈 섹션 교체 + 과학 카드 집계 수정 + 차시 앱 현황 컴포넌트.
7. 관리자: 숨김/삭제 화면(신고 기능은 §12 결정 후).
8. 정적 빌드(`next build`) 확인, 모바일/다크모드/한국어 문구 점검.

## 10. 사용자가 할 일

- Supabase 대시보드 SQL Editor에서 `20260923000000_community.sql` 1회 실행.
- Storage에서 `game-uploads` 버킷이 `public`으로 잘 생성됐는지, 대시보드 Storage 설정에서 **"Transform"·CDN 캐시**가 `Content-Type` 오버라이드를 방해하지 않는지 확인(직접 URL 접근 테스트 권장).
- 배포 후 실제로 AI가 만든 게임 HTML 1~2개를 올려 sandbox에서 정상 동작(스크립트 실행, localStorage 미동작 확인)·정지 버튼 동작을 육안 확인.

## 11. 위험과 한계

- 게임 내부 `localStorage`/`sessionStorage` 사용 불가(불투명 출처) → 진행 상황 저장 기능이 있는 게임은 매번 초기화. UI에 고지 필요.
- `alert`/`confirm`/`prompt` 차단(`allow-modals` 미부여) → 이를 쓰는 생성형 AI 게임은 해당 호출이 조용히 무시되거나 예외 발생 가능. 업로드 가이드에 "alert 대신 화면 안 메시지 사용" 안내 권장.
- 클라이언트 검증(확장자·크기·UTF-8)은 우회 가능 — 실질적 보안 경계는 Storage RLS·크기 제한·iframe sandbox이며, 파일 내용 자체의 안전성은 검증하지 않는다(= sandbox가 유일한 방어선).
- 정적 export라 실제 HTTP 응답 헤더(CSP, X-Content-Type-Options 등)를 못 붙인다 — GitHub Pages가 제공하는 헤더에 의존하며, Storage 응답 헤더는 Supabase 설정에 의존.
- 속도 제한(20초)은 Postgres 트리거 기반의 약한 방어로, 다계정 남용은 못 막는다.
- `/math/` 삭제로 과거 "수학" 태그 글은 메뉴에서 사라지고 검색(`/search/`)에서만 발견 가능 — 완전 삭제를 원하면 별도 결정 필요(§12).

## 12. 열린 질문 (추천안 포함)

1. **신고 기능**: MVP에 포함할지. **추천**: 1차 배포에서는 제외(교사 숨김만으로 충분), 사용량 보고 후 `community_reports(post_id, reporter_id, reason)` + 관리자 알림으로 2차 추가.
2. **`/math/` 완전 삭제 vs 안내 페이지**: **추천**: 완전 삭제(메뉴에 없던 라우트를 남겨두면 혼란) + 과거 "수학" 태그 글은 검색으로 유지.
3. **게임/게시판 이미지 첨부**: **추천**: 게시판은 1차에 텍스트만(이미지 스토리지·삭제 정책 추가 범위), 필요성 확인 후 `cover_url` 방식(기존 posts와 동일 패턴)으로 확장.
4. **댓글/글 숨김을 RLS `update` 정책 대신 RPC로 처리(§5 SQL)**: 컬럼 권한만으로는 "작성자는 본문만, 관리자는 hidden만" 구분이 어려워 RPC를 제안했다 — **추천**: RPC 방식 채택(기존 `increment_post_view`, `my_must_change_password`와 같은 기존 컨벤션).
5. **게임 카테고리/태그**: **추천**: 1차 생략, 목록이 늘어나면 추가.

---

## 13. 확정 결정 (2026-09-22 사용자 승인)

이 절이 본문보다 우선한다.

| 항목 | 결정 |
|---|---|
| 승인 | spec 승인, 구현 진행 |
| 신고하기 | **1차에 포함.** 로그인 사용자가 글·게임·댓글을 신고(사유 선택 + 선택 입력), 같은 사람의 같은 대상 중복 신고 불가, 관리자 대시보드에 신고 목록(대상 바로가기, 숨기기/삭제/처리 완료). 신고 내용은 관리자와 신고자 본인만 조회 |
| 이미지 첨부 | 1차 제외 |
| 그 밖의 열린 질문 | 모두 추천안 적용 |
