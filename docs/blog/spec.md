# 블로그 화면 설계 (spec)

> Plan 단계 산출물. **구현하지 않음.** Build 서브에이전트가 이 문서를 기준으로 작업한다.

## 0. 전제 요약 (근거 포함)

| 전제 | 근거 |
|---|---|
| 정적 export만 사용, Server Actions/Route Handler(동적)/middleware 불가 | `next.config.ts`에 `output: "export"` 설정됨. `node_modules/next/dist/docs/01-app/02-guides/static-exports.md` "Unsupported Features": Server Actions, Route Handlers(Request 의존), Cookies, Rewrites/Redirects/Headers, Proxy 등 모두 미지원 |
| 동적 세그먼트(`/post/[slug]`) 금지, 쿼리스트링 사용 | 정적 export는 `generateStaticParams()` 없는 동적 라우트를 지원하지 않음(위 문서 "Unsupported Features"). `trailingSlash: true`가 이미 설정되어 있어 `/post/`, `/admin/write/` 같은 폴더형 라우트가 자연스럽게 `/post/index.html`로 export됨 |
| `useSearchParams` 사용 시 `<Suspense>` 필요 | `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-search-params.md` "Prerendering": 정적 페이지에서 `useSearchParams`를 쓰는 Client Component는 `Suspense` 경계로 감싸지 않으면 프로덕션 빌드가 실패함(Missing Suspense boundary 오류) |
| basePath는 `/class1`로 확정 (배포 URL: `https://eversunk2-tech.github.io/class1/`) | 사용자 확인. `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/basePath.md`: `next/link`·`next/router`는 basePath를 자동 반영하지만, `next/image`의 `src`나 일반 `<img>`/`<iframe src>` 등은 **수동으로 basePath를 붙여야 함**. basePath는 빌드 타임에 고정되며 클라이언트 번들에 인라인됨 |
| 스크립트 CDN 로딩은 `next/script`로 | `node_modules/next/dist/docs/01-app/02-guides/scripts.md`: 특정 라우트에서만 쓰는 스크립트는 해당 페이지/레이아웃에 직접 배치 권장, `strategy`(`lazyOnload` 등)와 `onReady`/`onLoad`로 로드 완료 시점 감지 가능. 정적 export와 무관하게 동작(서버 기능 아님) |
| 404 페이지 | 위 문서 "Deploying": `next build` 시 `/out/404.html` 자동 생성됨 → `src/app/not-found.tsx` 하나만 추가하면 됨 |

관리자 가드는 UX 편의일 뿐이며, 실제 보안은 전적으로 Supabase RLS(`supabase/migrations/20260921000000_init_blog.sql`)가 담당한다.

---

## 1. 화면 목록과 URL

| # | 화면 | URL | 비고 |
|---|---|---|---|
| 1 | 메인 | `/` | 최신 글 목록 + 웹앱 카드 섹션 |
| 2 | 글 상세 | `/post/?slug={slug}` | 동적 라우트 대신 쿼리스트링 |
| 3 | 검색/태그 | `/search/?q={keyword}&tag={tag}` | 아래 "검토" 참고 |
| 4 | 로그인 | `/login/` | 이메일/비밀번호(사전 발급 계정) + GitHub OAuth + Google OAuth, 3종 |
| 5 | 관리자 글 목록 | `/admin/` | 발행/초안 전체, 발행 토글·삭제 |
| 6 | 글 작성·수정 에디터 | `/admin/write/` (신규) / `/admin/write/?slug={slug}` (수정) | 마크다운 입력 + 실시간 미리보기 |
| 7 | 404 | (자동) | `src/app/not-found.tsx` |

**검토(태그/검색 필요 여부)**: 별도 화면으로 만드는 것을 추천한다. 메인에 검색창/태그 칩을 두고 제출 시 `/search/`로 이동하는 방식. 글이 매우 적은 초기 단계에서는 메인에 인라인 필터로 합쳐도 되지만, 화면 책임을 분리해두면 이후 글이 늘어나도 메인 로직이 비대해지지 않는다. → **열린 질문 Q1**로도 남김.

---

## 2. 화면별 상세

### 2.1 메인 `/`

- **목적**: 최신 발행 글 목록, 웹앱 카드 노출
- **구성**: 헤더(로고, 검색 진입, 로그인/유저 메뉴, 다크모드 토글) · 글 목록(카드형, 제목/요약/태그/발행일/조회수) · "더 보기" 버튼(offset 기반 client 페이지네이션) · 웹앱 카드 섹션 · 푸터
- **Supabase**:
  - `supabase.from('posts').select('id,slug,title,summary,cover_url,tags,published_at').eq('published', true).order('published_at', { ascending:false }).range(offset, offset+N-1)`
  - 조회수 표시용: `supabase.from('views').select('post_id,count').in('post_id', ids)`
- **상태**: 로딩(스켈레톤 카드) · 빈("아직 작성된 글이 없습니다") · 오류(재시도 버튼)
- **권한**: 공개. 관리자도 동일 화면(초안은 목록에 노출하지 않음 — 초안 관리는 `/admin/`에서)

### 2.2 글 상세 `/post/?slug=`

- **목적**: 본문 렌더링, 좋아요/댓글/조회수
- **구성**: 제목/요약/커버/태그/작성일 · 마크다운 렌더 영역(`MarkdownViewer`) · 좋아요 버튼+수 · 조회수 · 댓글 목록/작성 폼 · (관리자에게만) 수정/삭제 버튼
- **Supabase**:
  - 본문: `supabase.from('posts').select('*').eq('slug', slug).single()` (RLS가 비공개 글은 관리자에게만 반환)
  - 조회수 증가(세션당 1회, `sessionStorage['viewed:'+slug]` 확인 후): `supabase.rpc('increment_post_view', { p_slug: slug })` — RPC가 최신 카운트를 반환하므로 재조회 불필요
  - 조회수 표시(이미 증가시켰거나 비공개 글일 때): `supabase.from('views').select('count').eq('post_id', postId).maybeSingle()`
  - 좋아요 수: `supabase.from('likes').select('*', { count: 'exact', head: true }).eq('post_id', postId)`
  - 내 좋아요 여부(로그인 시): `supabase.from('likes').select('post_id').eq('post_id', postId).eq('user_id', userId).maybeSingle()`
  - 좋아요 토글: `insert`/`delete` on `likes`
  - 댓글 목록: `supabase.from('comments').select('id,body,created_at,user_id,profiles(display_name,avatar_url)').eq('post_id', postId).order('created_at')`
  - 댓글 작성: `insert` on `comments` (인증 필요)
  - 댓글 삭제: `delete` on `comments` (본인 또는 관리자)
- **상태**: 로딩(스켈레톤) · slug 없음/글 없음("존재하지 않는 글입니다" + 메인 링크) · 댓글 빈("첫 댓글을 남겨보세요") · 오류
- **권한**: 비공개 글은 비로그인/일반 사용자에게 404 취급으로 표시(관리자만 실제로 조회 가능). 댓글 작성·좋아요는 로그인 필요(버튼에 로그인 유도 툴팁). 관리자는 수정/삭제 버튼 노출
- **구현 메모**: `useSearchParams`로 `slug` 읽는 컴포넌트는 `<Suspense>`로 감싼다(§0 참고)

### 2.3 검색/태그 `/search/?q=&tag=`

- **목적**: 제목/요약 키워드 검색, 태그 필터
- **구성**: 검색 입력, 태그 칩 목록, 결과 카드 리스트(메인과 동일한 `PostCard` 재사용)
- **Supabase**:
  - 키워드: `supabase.from('posts').select(...).eq('published', true).or('title.ilike.%q%,summary.ilike.%q%')`
  - 태그: `.contains('tags', [tag])`
  - 태그 칩 목록: 초기 단계엔 별도 쿼리 없이 최근 글 로드분에서 태그를 클라이언트에서 중복 제거해 구성(글이 적을 때 충분). 글이 많아지면 §10 스키마 제안 참고
- **상태**: 로딩 · 빈("검색 결과가 없습니다") · 오류
- **권한**: 공개
- **구현 메모**: `useSearchParams` 사용 → `<Suspense>` 필요

### 2.4 로그인 `/login/`

- **목적**: **공개 회원가입 없이**, 사전 발급된 계정으로만 로그인. 세 가지 방법을 한 화면에 제공
- **구성**:
  1. 이메일/비밀번호 폼(아이디·비밀번호 입력 + "로그인" 버튼) — 상단에 "계정은 관리자가 미리 발급합니다" 같은 안내 문구. 회원가입 링크/폼 없음
  2. "GitHub로 로그인" 버튼
  3. "Google로 로그인" 버튼
  - 세 방법을 구분선(`Separator`)으로 나눠 세로 배치
- **Supabase**:
  - 이메일/비밀번호: `supabase.auth.signInWithPassword({ email, password })`
  - GitHub: `supabase.auth.signInWithOAuth({ provider: 'github', options: { redirectTo } })`
  - Google: `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } })`
  - `redirectTo`는 하드코딩하지 않고 `withBasePath()`(§7)로 런타임에 조합: `window.location.origin + '/class1' + '/login/'` (basePath가 `/class1`로 확정되었으므로 실제 값은 `https://eversunk2-tech.github.io/class1/login/`)
- **OAuth 콜백 처리(정적 export)**: 서버 콜백 라우트가 없으므로, Supabase JS 기본 옵션(`detectSessionInUrl: true`)이 리다이렉트된 URL의 해시(`#access_token=...`)를 브라우저에서 직접 파싱해 세션을 저장한다. `/login/` 페이지가 마운트될 때 `supabase.auth.getSession()` 및 `onAuthStateChange`로 세션 생성을 감지해 `/`로 클라이언트 라우팅(`router.replace`)한다. 이 흐름은 서버 없이 100% 브라우저에서 처리되므로 정적 export와 호환된다
- **회원가입/계정 발급**: 공개 가입 폼을 두지 않는다(§5, §11 참고). Supabase Auth 설정에서 이메일 공개 가입(Enable email signups)을 꺼두는 것을 추천. 계정은 관리자가 로컬에서 1회성 스크립트로 미리 생성한다(§3, §5)
- **상태**: 입력 전 · 로그인 중 · 오류(아이디/비밀번호 불일치, OAuth 실패·취소) · 이미 로그인 시 자동으로 `/`로 리다이렉트
- **권한**: 이미 로그인된 사용자가 접근하면 `/`로 리다이렉트

### 2.5 관리자 글 목록 `/admin/`

- **목적**: 발행/초안 전체 글 관리
- **구성**: 글 테이블(제목, 상태 배지, 발행일, 수정일) · 발행/비공개 토글 · 삭제(확인 다이얼로그) · "새 글 작성" 버튼
- **Supabase**:
  - 가드: `supabase.rpc('is_admin')` (마이그레이션에 정의된 파라미터 없는 SQL 함수, `security definer`) → false/오류면 `/login/`으로 리다이렉트
  - 목록: `supabase.from('posts').select('id,slug,title,published,published_at,updated_at').order('updated_at', { ascending:false })` (RLS: 관리자는 전체 조회)
  - 발행 토글: `update` on `posts` (`published`, 필요 시 `published_at`)
  - 삭제: `delete` on `posts`
- **상태**: 가드 확인 중(스피너) · 빈("작성된 글이 없습니다") · 오류
- **권한**: 관리자만. 비로그인/일반 사용자는 `/login/`으로 리다이렉트(또는 접근 불가 안내 후 이동)

### 2.6 글 작성·수정 에디터 `/admin/write/?slug=`

- **목적**: 마크다운 작성 + 실시간 미리보기, 발행 관리
- **구성**: 제목/요약/커버 URL/태그(콤마 입력→배열) 입력 필드 · 마크다운 textarea + 탭 또는 좌우 분할 미리보기(`MarkdownViewer` 재사용) · 발행 스위치 · 저장/삭제 버튼
- **Supabase**:
  - 가드: 2.5와 동일(`is_admin` RPC)
  - 수정 진입 시 프리필: `supabase.from('posts').select('*').eq('slug', slug).single()`
  - slug 자동 생성(제목 기반) + 중복 체크: `supabase.from('posts').select('id', { count:'exact', head:true }).eq('slug', candidate)`
  - 신규 저장: `insert` on `posts`
  - 기존 저장: `update` on `posts` (`updated_at`은 트리거가 자동 갱신)
  - 삭제: `delete` on `posts` (성공 시 `/admin/`으로 이동)
- **상태**: 로딩(수정 모드 프리필) · 저장 중 · slug 중복 오류 · 저장 성공(토스트) · 네트워크 오류
- **권한**: 관리자만
- **구현 메모**: `useSearchParams`(`slug`) 사용 → `<Suspense>` 필요

### 2.7 404

- **구성**: 안내 문구 + 메인으로 이동 버튼
- **파일**: `src/app/not-found.tsx` — 정적 export 시 `next build`가 자동으로 `out/404.html`을 생성하므로 별도 빌드 설정 불필요(§0 근거)

---

## 3. 파일 구조 (신규/수정)

| 경로 | 종류 | 역할 |
|---|---|---|
| `next.config.ts` | 수정 | `basePath: process.env.NEXT_PUBLIC_BASE_PATH ?? ""`, `assetPrefix`도 동일 값 기반. 배포 빌드(GitHub Actions 등)에서 `NEXT_PUBLIC_BASE_PATH=/class1`을 주입, 로컬 `next dev`/`next build`는 기본값(빈 문자열)로 basePath 없이 동작하게 해 로컬 개발 편의를 유지(§0) |
| `.env.local.example` | 수정 | `NEXT_PUBLIC_BASE_PATH` 항목 추가(로컬은 비워둠, 배포 시 `/class1`) |
| `scripts/import-users.mjs` | 신규(계획만, 이번 Plan 단계에서 작성하지 않음) | 관리자가 로컬에서 1회 수동 실행하는 Node 스크립트. Google Sheet를 CSV로 내보낸 파일을 읽어(`aliases`/`id`, 비밀번호 컬럼 등) `.env.local`의 `SUPABASE_SERVICE_ROLE_KEY` + `SUPABASE_URL`로 만든 관리자 클라이언트의 `supabase.auth.admin.createUser({ email, password, email_confirm: true })`를 각 행마다 호출해 계정을 일괄 생성. 클라이언트 번들에 포함되지 않고 Node에서만 실행되며, service role key가 브라우저로 유출되지 않도록 `src/`와 완전히 분리된 `scripts/` 아래에 둔다 |
| `src/lib/base-path.ts` | 신규 | `withBasePath(path)` — `next/link` 밖(이미지 `src`, iframe `src`, fetch 경로)에서 basePath 수동 결합 |
| `src/lib/types.ts` | 신규 | `Post`, `Comment`, `Profile`, `ViewRow` 등 Supabase 테이블 타입 |
| `src/lib/markdown.ts` | 신규 | marked/DOMPurify CDN 로드 상태 관리 + `renderMarkdown(md)` 유틸(§6) |
| `src/lib/auth.ts` | 신규 | 로그인/로그아웃/세션 조회 래퍼 |
| `src/hooks/use-session.ts` | 신규 | `supabase.auth.onAuthStateChange` 구독 훅 |
| `src/hooks/use-theme.ts` | 신규 | 다크모드 토글/영속화 훅(§8) |
| `src/app/layout.tsx` | 수정 | `SiteHeader`/`SiteFooter` 삽입, 메타데이터 한국어화, 테마 초기화 스크립트 |
| `src/app/page.tsx` | 수정 | 메인 화면(2.1) |
| `src/app/post/page.tsx` | 신규 | 글 상세(2.2), 내부에서 `<Suspense>`로 감싼 클라이언트 컴포넌트 사용 |
| `src/app/search/page.tsx` | 신규 | 검색/태그(2.3) |
| `src/app/login/page.tsx` | 신규 | 로그인(2.4) |
| `src/app/admin/page.tsx` | 신규 | 관리자 목록(2.5) |
| `src/app/admin/write/page.tsx` | 신규 | 에디터(2.6) |
| `src/app/not-found.tsx` | 신규 | 404 |
| `src/components/site-header.tsx` | 신규 | 로고, 내비게이션, 검색 진입, 유저 메뉴, 다크모드 토글 |
| `src/components/site-footer.tsx` | 신규 | 푸터 |
| `src/components/theme-toggle.tsx` | 신규 | 다크모드 스위치 |
| `src/components/post-card.tsx` | 신규 | 목록용 카드 |
| `src/components/post-list.tsx` | 신규 | 카드 목록 + 더보기/로딩/빈 상태 |
| `src/components/markdown-viewer.tsx` | 신규 | CDN 스크립트 로드(`next/script`) + sanitize된 HTML 렌더 |
| `src/components/comment-section.tsx` | 신규 | 댓글 목록 + 작성 폼 |
| `src/components/like-button.tsx` | 신규 | 좋아요 토글 |
| `src/components/view-counter.tsx` | 신규 | 조회수 표시/증가 트리거 |
| `src/components/admin-guard.tsx` | 신규 | `is_admin` RPC 확인 후 children 렌더 또는 리다이렉트 |
| `src/components/apps/app-card.tsx` | 신규 | 웹앱 카드(§9) |
| `src/components/apps/app-grid.tsx` | 신규 | 웹앱 카드 섹션(빈 상태 포함) |
| `src/data/apps.ts` | 신규 | 웹앱 카드 정적 데이터(§9) |
| `src/components/ui/*.tsx` | 신규(다수) | shadcn 컴포넌트 추가분(§4) |

---

## 4. 공통 컴포넌트 & 필요한 shadcn 컴포넌트

현재 `src/components/ui/`에는 `button.tsx`만 존재(`components.json` 기준 `shadcn` CLI, style `base-nova`, baseColor `neutral` 사용 중).

**공통 컴포넌트**: `SiteHeader`, `SiteFooter`, `ThemeToggle`, `PostCard`, `PostList`, `MarkdownViewer`, `CommentSection`, `LikeButton`, `ViewCounter`, `AdminGuard`, `AppCard`, `AppGrid`, `TagChip`, `EmptyState`, `ErrorState`

**추가 필요 shadcn 컴포넌트** (`npx shadcn add ...`):

| 컴포넌트 | 용도 |
|---|---|
| `input`, `textarea`, `label` | 로그인 아이디/비밀번호, 검색창, 에디터 필드 |
| `card` | 글 카드, 웹앱 카드 |
| `badge` | 태그, 발행 상태 |
| `avatar` | 댓글 작성자, 유저 메뉴 |
| `dropdown-menu` | 헤더 유저 메뉴 |
| `dialog` / `alert-dialog` | 글 삭제·댓글 삭제 확인 |
| `switch` | 발행 여부, 다크모드 |
| `tabs` | 에디터의 작성/미리보기 전환(좁은 화면) |
| `skeleton` | 로딩 상태 |
| `separator` | 레이아웃 구분선 |
| `sonner` (toast) | 저장/오류 알림 |
| `tooltip` | 로그인 필요 안내 |

---

## 5. 인증 흐름

**로그인 방식: 이메일/비밀번호(사전 발급 계정) + GitHub OAuth + Google OAuth, 세 가지 모두 지원.** 공개 회원가입 폼은 없다(사용자 결정).

### 5.1 이메일/비밀번호 (사전 발급 계정)

- 사용자는 Google Sheet에 정리된 아이디/비밀번호로만 로그인한다. 사이트에 가입 폼을 두지 않는다.
- **계정 생성(운영 절차, 코드는 이 Plan 단계에서 작성하지 않음)**:
  1. 관리자가 Google Sheet를 CSV로 내보낸다
  2. 관리자가 로컬에서 `scripts/import-users.mjs`(§3)를 1회 실행 — `.env.local`의 `SUPABASE_SERVICE_ROLE_KEY`(현재 `.env.local.example`에 주석 처리되어 있음, 로컬 전용으로 주석 해제)를 사용해 `supabase.auth.admin.createUser()`로 계정을 일괄 생성한다
  3. `handle_new_user` 트리거(마이그레이션에 이미 정의됨)가 각 계정에 대해 `profiles` 행을 자동 생성한다
  4. 관리자로 지정할 계정은 SQL Editor에서 `update public.profiles set role='admin' where id=...` 1회 실행(마이그레이션 파일 상단 주석에 이미 안내됨)
- **주의(열린 질문 Q_이메일매핑)**: Supabase 비밀번호 로그인은 이메일 형식 아이디가 필요하다. Google Sheet의 아이디가 이메일이 아니면(예: 학번) `{아이디}@class1.local` 같은 가짜 도메인으로 매핑해 `createUser`에 전달해야 한다. 실제 아이디 형식 확인이 필요하다(§11).
- Supabase 대시보드에서 **이메일 공개 가입(Enable email signups) 비활성화**를 추천 — 비활성화해도 관리자 스크립트의 `auth.admin.createUser`(service role 권한)는 계속 동작한다.
- 로그인 화면 호출: `supabase.auth.signInWithPassword({ email, password })`

### 5.2 GitHub / Google OAuth

- 로그인 화면 호출: `supabase.auth.signInWithOAuth({ provider: 'github' | 'google', options: { redirectTo } })`
- `redirectTo`는 `withBasePath('/login/')`를 `window.location.origin`과 조합해 런타임에 만든다: `https://eversunk2-tech.github.io/class1/login/`
- **정적 export에서의 콜백 처리**: 서버 콜백 라우트(Route Handler)가 없으므로, Supabase JS SDK의 기본 옵션(`detectSessionInUrl: true`, PKCE 플로우)이 리다이렉트 후 URL에 담긴 인증 정보를 **브라우저에서** 파싱해 세션을 저장한다. `/login/` 페이지가 이 세션 생성을 `onAuthStateChange`로 감지해 `/`로 이동시키면 되므로, 별도 서버 코드 없이 정적 사이트에서 정상 동작한다
- **운영 설정(사용자가 Supabase/GitHub/Google 콘솔에서 처리)**: 각 OAuth 앱의 Authorized redirect URI에 Supabase 프로젝트의 콜백 URL(`https://<project>.supabase.co/auth/v1/callback`)을 등록하고, Supabase Auth의 Site URL/Redirect URLs 허용 목록에 `https://eversunk2-tech.github.io/class1/login/`(및 필요 시 `https://eversunk2-tech.github.io/class1/*`)을 등록해야 한다. 이 콘솔 설정은 코드 변경이 아니라 사용자가 직접 수행해야 하는 운영 작업이다(§11)

### 5.3 공통

- **세션 유지**: `@supabase/supabase-js`는 기본값으로 세션을 `localStorage`에 저장하고 자동 갱신(`autoRefreshToken`)한다. `src/hooks/use-session.ts`에서 `supabase.auth.onAuthStateChange`를 구독해 전역 상태(React Context 또는 훅)로 노출한다.
- **관리자 가드**: `/admin/*` 진입 시 `AdminGuard`가 `supabase.rpc('is_admin')` 결과를 확인해 `true`가 아니면 `/login/`으로 리다이렉트하고 화면을 렌더링하지 않는다. **이는 UX 편의 장치일 뿐이며, 실제 데이터 보호는 전적으로 `supabase/migrations/20260921000000_init_blog.sql`의 RLS 정책(`is_admin()` 사용)이 담당한다.** 클라이언트 가드를 우회해도 서버(Postgres)가 쓰기를 거부한다.
- 로그인/로그아웃/OAuth 호출은 `src/lib/auth.ts`에 얇은 래퍼로 모아 화면 컴포넌트가 Supabase API를 직접 호출하지 않게 한다.

---

## 6. 마크다운 렌더링 방식

- **CDN 로딩**: `marked`, `DOMPurify`를 `next/script`로 해당 화면(글 상세, 에디터 미리보기)에서만 로드한다. 루트 레이아웃이 아니라 `MarkdownViewer` 컴포넌트 내부에 배치해 다른 페이지의 번들/네트워크에 영향이 없도록 한다.
  ```tsx
  <Script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js" strategy="lazyOnload" onReady={...} />
  <Script src="https://cdn.jsdelivr.net/npm/dompurify@3/dist/purify.min.js" strategy="lazyOnload" onReady={...} />
  ```
  두 스크립트가 모두 로드된 뒤(`window.marked`, `window.DOMPurify` 존재 확인) 렌더링하며, 로드 전에는 스켈레톤/원문 텍스트를 임시로 보여준다. (`node_modules/next/dist/docs/01-app/02-guides/scripts.md` 참고: 같은 레이아웃/페이지에 여러 번 배치돼도 Next가 중복 로드를 방지)
- **XSS 처리**: `content_md`는 사용자(관리자) 입력이므로 `marked.parse(md)` 결과를 반드시 `DOMPurify.sanitize(html)`로 정화한 뒤에만 `dangerouslySetInnerHTML`에 사용한다. sanitize 이전 HTML은 절대 렌더링하지 않는다.
- **코드 하이라이트**: 1차 범위에서는 제외(추가 CDN 의존성·번들 증가). 필요해지면 `highlight.js`를 동일한 CDN + `next/script` lazyOnload 패턴으로 추가하는 것을 추천(§11 Q5, 열린 질문).

---

## 7. 웹앱 카드 데이터 구조

`public/apps/{앱이름}/`에 정적 앱이 위치하는 구조를 전제로, 아직 앱이 없으므로 **데이터 구조와 빈 상태만** 설계한다.

```ts
// src/data/apps.ts
export type WebApp = {
  id: string;            // public/apps/{id}/ 디렉터리명과 일치
  title: string;
  description: string;
  thumbnailUrl?: string;  // public/apps/{id}/thumbnail.png 등, withBasePath로 감싸서 사용
  href: string;           // `/apps/${id}/` — withBasePath 필요(§0, next/link 밖 경로이므로 자동 적용 안 됨)
  tags?: string[];
};

export const webApps: WebApp[] = []; // 현재 비어 있음 → AppGrid가 빈 상태 UI 표시
```

- **렌더링 방식**: `AppCard`는 새 탭에서 여는 링크(`<a target="_blank">`, basePath 반영된 href)로 시작. 카드 내 iframe 미리보기는 1차 범위에서 제외(성능/스크롤 이슈) — 필요 시 카드 클릭 시 모달에서 `<iframe src={withBasePath('/apps/'+id+'/')}>` 형태로 여는 것을 추천(§11 Q6)
- **basePath 반영**: `href`/`thumbnailUrl`는 `next/link`가 자동 처리하지 않는 순수 경로이므로 `withBasePath()`로 감싼다
- **빈 상태**: 앱이 없을 때 "곧 공개될 웹앱들을 위한 공간입니다" 같은 안내 카드 표시

---

## 8. 다크모드 구현 방식

- `src/app/globals.css`가 이미 `.dark` 클래스 기반 테마(`@custom-variant dark (&:is(.dark *))`, `:root`/`.dark` 토큰)를 갖추고 있음 → 별도 라이브러리(next-themes 등) 추가 없이 `<html>` 요소에 `dark` 클래스를 토글하는 방식으로 충분
- `src/hooks/use-theme.ts`: `localStorage`에 사용자가 선택한 테마 저장, 없으면 `window.matchMedia('(prefers-color-scheme: dark)')`로 초기값 결정
- **FOUC 방지**: 정적 export는 서버 렌더링 시점에 사용자의 `localStorage`를 알 수 없으므로, `src/app/layout.tsx`의 `<head>`에 hydration 전에 실행되는 작은 인라인 스크립트(`next/script strategy="beforeInteractive"`, 또는 `dangerouslySetInnerHTML`)를 두어 저장된 테마를 즉시 `<html>`에 적용
- `ThemeToggle` 컴포넌트: 헤더에 아이콘 버튼(라이트/다크 전환)

---

## 9. 구현 단계 분할 (Build 서브에이전트용)

| 단계 | 범위 | 산출물 |
|---|---|---|
| 0 | 기반 정비 | `next.config.ts` basePath화, `withBasePath`, `types.ts`, `supabase.ts` 점검, shadcn 컴포넌트 일괄 추가 |
| 1 | 레이아웃/테마 | `SiteHeader`, `SiteFooter`, `ThemeToggle`, `use-theme`, FOUC 방지 스크립트, `layout.tsx` 수정 |
| 2 | 인증 | `use-session`, `auth.ts`, `/login/`(이메일·GitHub·Google), `AdminGuard`. 이 단계 착수 전 사용자가 OAuth 콘솔 등록(§11 Q4)과 `scripts/import-users.mjs` 실행(§5.1, 로컬 1회성 수동 작업이며 Build 단계 코드 범위 밖)을 완료해두어야 로그인 테스트가 가능 |
| 3 | 메인 + 글 목록 | `post-card`, `post-list`, `/` 페이지, posts 조회 |
| 4 | 마크다운 렌더러 | `markdown.ts`, `MarkdownViewer` (CDN + sanitize) |
| 5 | 글 상세 | `/post/`, 조회수 RPC, 좋아요, 댓글 |
| 6 | 검색/태그 | `/search/` |
| 7 | 관리자 | `/admin/` 목록, 발행 토글, 삭제 |
| 8 | 에디터 | `/admin/write/` 작성/수정/미리보기/slug 처리 |
| 9 | 웹앱 카드 | `src/data/apps.ts`, `AppCard`, `AppGrid`, 메인에 삽입 |
| 10 | 마무리 | 404, 빈/오류 상태 점검, 반응형·다크모드 QA, `next build`로 정적 export 검증 |

각 단계는 이전 단계의 컴포넌트/훅을 재사용하도록 순서를 잡았다. 단계 3~9는 병렬화 가능성이 있으나(예: 4·6·9는 독립적) 인증(2)과 렌더러(4)가 여러 화면의 선행 조건이므로 먼저 끝내는 것을 권장한다.

---

## 10. 스키마 변경 제안 (직접 SQL 작성하지 않음)

| 제안 | 이유 |
|---|---|
| `posts.tags`에 GIN 인덱스 추가 (`create index on posts using gin (tags)`) | `.contains('tags', ...)` 검색이 글이 많아지면 느려짐 |
| `posts.title`/`summary`에 `pg_trgm` 기반 인덱스 또는 `tsvector` 컬럼 추가 | 현재 `ilike` 검색은 인덱스를 못 타 풀스캔됨. 글 수십~수백 개 이상이면 검색 성능 이슈 |
| (선택) `posts`에 `like_count`/`comment_count` 캐시 컬럼 + 트리거 | 현재는 상세 화면에서 `count: 'exact'` 쿼리로 매번 집계 — 목록에서도 좋아요/댓글 수를 보여주려면 매 글마다 별도 쿼리가 필요해져 N+1이 됨 |

지금 단계(글 소량)에서는 필수는 아니며, Build 단계에서 바로 반영하기보다 **사용자 확인 후 별도 마이그레이션 파일로 추가**할 것을 제안한다.

---

## 11. 열린 질문 (사용자 결정 필요)

| # | 질문 | 추천안 |
|---|---|---|
| Q1 | 검색/태그를 별도 화면(`/search/`)으로 분리할지, 메인에 인라인으로 둘지 | 별도 화면 분리 추천(§1 검토 참고). 글이 매우 적다면 메인 인라인도 가능 |
| Q2 | Google Sheet의 로그인 아이디가 이메일 형식인지, 아니라면 어떤 가짜 도메인(예: `@class1.local`)으로 매핑할지 | 이메일이 아니라면 `{아이디}@class1.local` 같은 고정 규칙으로 매핑해 `import-users.mjs`(§5.1)에서 일괄 변환 추천. 실제 시트의 아이디 형식 확인 필요 |
| Q3 | Supabase Auth에서 이메일 공개 가입(Enable email signups)을 지금 비활성화할지 | 비활성화 추천(§5.1) — 관리자 스크립트(service role)는 영향받지 않고, 계정은 사전 발급 방식만 허용됨 |
| Q4 | GitHub/Google OAuth 앱을 아직 등록하지 않았다면 각 콘솔의 Authorized redirect URI와 Supabase Auth Redirect URL 허용 목록에 `https://eversunk2-tech.github.io/class1/login/`을 등록하는 작업(§5.2)을 언제 진행할지 | 코드 작업과 별개로 사용자가 직접 각 콘솔에서 처리해야 함. Build 단계 착수 전 완료 권장 |
| Q5 | 코드 블록 하이라이트(`highlight.js` 등 CDN 추가)가 필요한지 | 1차 범위 제외 추천. 개발/기술 글이 많다면 추가 |
| Q6 | 웹앱 카드에서 iframe 미리보기를 즉시 지원할지 | 앱이 아직 없으므로 1차는 새 탭 링크만, 앱 등록 후 모달 iframe 추가 추천 |
| Q7 | 프로필 수정(닉네임/아바타, `profiles.display_name`/`avatar_url`) 화면이 필요한지 | 1차 범위에는 없음(§1 화면 목록에도 미포함). 필요하면 헤더 유저 메뉴에 간단한 다이얼로그로 추가 추천 |
| Q8 | 페이지네이션 UX: "더 보기" 버튼(무한 로드) vs 페이지 번호 | "더 보기" 버튼 추천 — 정적 export에서 페이지 번호 방식은 전체 개수 쿼리와 URL 상태 관리가 추가로 필요함 |

---

## 12. 확정 결정 (2026-09-21 사용자 승인)

이 절은 위 본문보다 우선한다.

| 항목 | 결정 |
|---|---|
| 승인 | spec 승인. 열린 질문은 아래 외에는 추천안 적용 |
| basePath | **항상 `/class1` 고정** (로컬 `http://localhost:3000/class1/` 포함). §3의 "환경변수 기반 basePath / 로컬은 빈 문자열" 안은 **폐기**. 현재 `next.config.ts`(basePath 상수 + `env.NEXT_PUBLIC_BASE_PATH`)를 그대로 쓰고, `withBasePath()`는 `process.env.NEXT_PUBLIC_BASE_PATH`를 사용. `.env.local.example`에 BASE_PATH 항목 추가하지 않음. `assetPrefix` 추가하지 않음 |
| Q1 검색/태그 | `/search/` 별도 화면으로 구현 |
| Q2 시트 아이디 | 이메일이 아님 → `{아이디}@class1.local`로 매핑. 로그인 화면은 "아이디" 입력칸(이메일 아님)을 받고 내부에서 `@class1.local`을 붙인다. 입력에 `@`가 있으면 그대로 이메일로 취급 |
| Q3 공개 가입 | ~~비활성화~~ → **가입 허용 유지** (review #2 결정, 2026-09-21). 가입 차단은 OAuth 첫 로그인까지 막기 때문. OAuth 방문자는 누구나 일반 사용자로 가입. 사이트에 가입 폼은 두지 않고 Confirm email은 켠다 |
| Q4 OAuth 콘솔 | 사용자가 직접 처리. 코드는 OAuth 설정이 없어도 이메일 로그인과 나머지 화면이 동작해야 함 |
| Q5 코드 하이라이트 | 포함 (highlight.js CDN, 라이트/다크 테마 대응) |
| Q6 iframe 미리보기 | 포함 (카드 클릭 → 모달 iframe, "새 탭으로 열기" 링크 병행) |
| Q7 프로필 수정 | 포함 (헤더 유저 메뉴 → 다이얼로그, `display_name`/`avatar_url`) |
| Q8 페이지네이션 | "더 보기" 버튼 |
| §10 스키마 제안 | 보류 |
