# Build 서브에이전트 A 완료 보고 (단계 0~5)

## 검증 결과
- `npm run lint`: 통과(경고 0)
- `npm run build`: 통과. `out/index.html`, `out/login/index.html`, `out/post/index.html`, `out/404.html` 생성 확인
- `out/`를 `/class1/` 경로로 로컬 서빙해 브라우저 확인: 메인(로딩→오류 상태), 로그인(오류 메시지), `/post/`(slug 없음 → "존재하지 않는 글입니다"), 다크모드 새로고침 유지(FOUC 없음), 모바일 폭 375px 레이아웃
- 실제 Supabase 연결은 불가(.env.local 예시값). 글 상세는 브라우저에서 `fetch`를 모킹해 본문 렌더링·코드 하이라이트·XSS 정화(`<script>`, `onerror` 제거)·조회수 RPC·좋아요 수·댓글 목록이 동작하는지 확인함

## 만든/수정한 파일
**수정**
- `src/app/layout.tsx` — `lang="ko"`, 한국어 메타데이터(title template), FOUC 방지 인라인 스크립트, `SessionProvider`/`TooltipProvider`/`Toaster`, 헤더·푸터
- `src/app/page.tsx` — create-next-app 템플릿을 메인(최신 글 목록)으로 교체
- `src/app/globals.css` — 한국어 글꼴 폴백, `.markdown-body` 본문 스타일, highlight.js 토큰 색(라이트/다크)
- `src/lib/supabase.ts` — 환경변수가 없어도 빌드가 깨지지 않도록 자리표시 값으로 생성, `isSupabaseConfigured` 내보냄
- `package.json`/`package-lock.json` — `sonner` 추가(shadcn sonner 의존성)
- 삭제: `public/{file,globe,next,vercel,window}.svg` (템플릿 이미지)

**신규 — lib / hooks**
- `src/lib/base-path.ts` — `withBasePath(path)`, `BASE_PATH` (`NEXT_PUBLIC_BASE_PATH` 사용)
- `src/lib/types.ts` — `Profile`, `Post`, `PostSummary`, `POST_SUMMARY_COLUMNS`, `Comment`, `CommentWithAuthor`, `Like`, `ViewRow`
- `src/lib/auth.ts` — `loginIdToEmail`, `signInWithId`, `signInWithOAuth`, `isOAuthProviderEnabled`, `signOut`, `getSession`, `authErrorMessage`
- `src/lib/markdown.ts` — CDN URL 상수, `isMarkdownReady()`, `renderMarkdown(md)`(marked → highlight.js → DOMPurify)
- `src/lib/format.ts` — `formatDate`, `formatDateTime`, `formatCount` (ko-KR)
- `src/hooks/use-theme.ts` — `useTheme()`(`theme`, `setTheme`, `toggleTheme`), `THEME_INIT_SCRIPT`
- `src/hooks/use-session.tsx` — `SessionProvider`, `useSession()`(`loading`, `session`, `user`, `profile`, `isAdmin`, `refreshProfile`), `displayNameOf()`

**신규 — 컴포넌트**
- `site-header.tsx`(`SITE_NAME` 포함), `site-footer.tsx`, `theme-toggle.tsx`, `user-menu.tsx`
- `admin-guard.tsx` — `is_admin` RPC 확인 후 children 렌더, 아니면 `/login/`으로 이동 (만들어만 두고 아직 사용처 없음)
- `post-card.tsx`(`PostCard`, `PostCardSkeleton`, `postHref(slug)`), `post-list.tsx`(`PostList`, `fetchViewCounts(ids)`)
- `markdown-viewer.tsx` — `<MarkdownViewer content className />`
- `view-counter.tsx`, `like-button.tsx`, `comment-section.tsx`, `login-required.tsx`(`LoginRequiredTooltip`)
- `states.tsx`(`EmptyState`, `ErrorState`), `tag-chip.tsx`(`TagChip`, `TagList`)
- shadcn: `input textarea label card badge avatar dropdown-menu dialog alert-dialog switch tabs skeleton separator sonner tooltip`

**신규 — 라우트**
- `src/app/login/page.tsx` + `login-form.tsx`
- `src/app/post/page.tsx`(Suspense 경계) + `post-detail.tsx`
- `src/app/not-found.tsx` (단계 10 항목이지만 단순해서 미리 추가)

## spec과 달라진 점과 이유
1. **`use-session`은 `.tsx`** — Context Provider(JSX)를 포함하므로. import 경로(`@/hooks/use-session`)는 spec과 같음.
2. **OAuth 사전 확인** — 공급자가 비활성인 상태로 `signInWithOAuth`가 바로 리다이렉트하면 Supabase의 JSON 오류 페이지로 이동해 버린다. 그래서 `/auth/v1/settings`(공개, anon key 사용)로 활성화 여부를 먼저 확인하고, 활성일 때만 `skipBrowserRedirect: true`로 URL을 받아 이동한다. 비활성·연결 실패면 로그인 화면에 오류 메시지만 표시.
3. **highlight.js 테마 CSS는 CDN이 아니라 `globals.css`에 직접 정의** — 다크모드가 `prefers-color-scheme`가 아닌 `.dark` 클래스 기반이라, CDN 테마 CSS 두 개를 바꿔 끼우는 대신 CSS 변수(`--hl-*`)로 라이트/다크를 처리.
4. **sonner가 `next-themes` 대신 `useTheme`(자체 훅)을 사용** — shadcn이 `next-themes`를 함께 설치했지만 spec §8(추가 라이브러리 없음)에 맞춰 `src/components/ui/sonner.tsx`의 import를 바꾸고 `next-themes`는 제거함.
5. **CDN 스크립트는 `lazyOnload`가 아니라 `afterInteractive`** — 본문이 첫 화면의 핵심이라 빨리 불러옴. 10초 안에 marked/DOMPurify가 준비되지 않거나 로드 오류가 나면 원문 텍스트로 폴백. highlight.js만 실패하면 하이라이트 없이 렌더링.
6. **태그는 링크 아님** — `/search/`가 아직 없어서(없는 페이지로 가는 링크 금지) 표시만 함.
7. **글 상세의 관리자 "수정" 버튼 없음** — `/admin/write/`가 없어서. "삭제"는 확인 다이얼로그와 함께 구현함(성공 시 `/`로 이동).
8. **헤더 내비게이션** — 검색·관리자 링크는 아직 넣지 않음(자리 주석만). 유저 메뉴에는 이름/관리자 표시와 로그아웃만 있음.

## 알려진 한계
- 실제 Supabase 연동은 테스트하지 못함(예시 env). 특히 OAuth 왕복, `profiles(display_name,avatar_url)` 조인 모양, RLS 거부 시 메시지는 실제 데이터로 확인이 필요함.
- 관리자가 비공개 글을 열면 조회수는 증가시키지 않고 `views`만 읽음(RPC가 비공개 글에 null을 반환하므로).
- `sessionStorage`를 쓸 수 없는 환경에서는 중복 방지를 할 수 없어 조회수를 증가시키지 않음.
- 목록 페이지네이션은 offset 방식이라, "더 보기" 사이에 새 글이 발행되면 중복이 생길 수 있음(id로 중복 제거는 함).
- 좋아요/댓글 수를 목록에는 표시하지 않음(spec §10의 N+1 이슈, 스키마 제안 보류).
- 헤더 로그인 상태는 클라이언트에서 판단하므로 첫 페인트 때 잠깐 스켈레톤이 보임.
- 브라우저 자동화 도구의 Enter 키가 폼 제출을 일으키지 않아, 로그인 제출은 버튼 클릭으로만 확인함(일반 `<form onSubmit>`이라 실제 브라우저에서는 Enter로 제출됨).

## 단계 6~10 담당자 참고
- **Supabase 호출**: `import { supabase } from "@/lib/supabase"` — Client Component에서만 사용.
- **세션/권한**: `useSession()` → `user`, `profile`, `isAdmin`, `loading`. 프로필 수정(Q7) 후에는 `refreshProfile()`을 호출해 헤더에 반영. 관리자 화면은 `<AdminGuard>`로 감싸면 됨.
- **유저 메뉴 확장**: `src/components/user-menu.tsx`의 주석 자리에 "관리자", "프로필 수정" 항목을 추가.
- **헤더 링크**: `src/components/site-header.tsx`의 `<nav>` 주석 자리에 검색 진입 등을 추가.
- **목록 재사용(검색)**: `PostCard`, `PostCardSkeleton`, `fetchViewCounts(ids)`, `POST_SUMMARY_COLUMNS`, `EmptyState`/`ErrorState`. `/search/`가 생기면 `TagChip`을 `/search/?tag=` 링크로 바꾸면 됨.
- **에디터 미리보기**: `<MarkdownViewer content={md} />`를 그대로 쓰면 됨(스크립트 중복 로드는 next/script가 막음). 직접 HTML이 필요하면 `renderMarkdown(md)`(라이브러리 준비 전에는 null).
- **글 상세 수정 버튼**: `src/app/post/post-detail.tsx`의 `AdminActions` 주석 자리에 `/admin/write/?slug=` 링크를 추가.
- **웹앱 카드(단계 9)**: `src/app/page.tsx`의 주석 자리에 `AppGrid`를 넣고, 이미지/iframe 경로는 `withBasePath()`로 감쌀 것.
- **알림**: `import { toast } from "sonner"` (`Toaster`는 layout에 이미 있음).
- **확인 다이얼로그**: shadcn `AlertDialogAction`은 눌러도 자동으로 닫히지 않으므로 `open`/`onOpenChange`로 제어해서 사용(`comment-section.tsx`, `post-detail.tsx` 참고).
- **Base UI 주의**: `Button`에 `render={<Link href=… />}`를 쓸 때는 `nativeButton={false}`가 필요함.
- **`useSearchParams`**: page.tsx에서 `<Suspense>`로 감싼 클라이언트 컴포넌트에서만 사용(`src/app/post/page.tsx` 패턴).
- **날짜 표시**: `formatDate`/`formatDateTime`은 클라이언트에서 가져온 데이터에만 사용(프리렌더와 불일치 방지).
