# Plan 서브에이전트 지침: 블로그 화면 계획

## 목표
블로그 본체(Next.js) 화면 계획을 세워 `docs/blog/spec.md`에 작성한다. **구현하지 않는다.**

## 수정 범위
* 작성 가능: `docs/blog/spec.md` 하나만.
* 그 외 모든 파일은 읽기만 한다.

## 먼저 읽을 것
* `CLAUDE.md` (프로젝트 규칙, 기술 결정 사항)
* `AGENTS.md` — 이 Next.js(16.x)는 학습 데이터와 다를 수 있다. 라우팅, `next/link`, `next/script`, Client Component, 정적 export 관련 내용은 `node_modules/next/dist/docs/`에서 확인하고 근거를 spec에 반영한다. 특히 `01-app/02-guides/static-exports.md`.
* `supabase/migrations/20260921000000_init_blog.sql` (테이블, RLS, RPC)
* `next.config.ts`, `src/app/`, `src/components/ui/`, `src/lib/`, `components.json`, `package.json`

## 확정된 전제
* 정적 export, GitHub Pages 배포. 서버 기능(Server Actions, Route Handlers, middleware, 동적 SSR) 사용 불가.
* 동적 경로 금지 → 글 상세 등은 쿼리스트링(`/post/?slug=...`). `useSearchParams` 사용 시 정적 export에서 Suspense 경계가 필요한지 문서로 확인해 적는다.
* 배포 경로에 basePath(`/class1`)가 붙을 수도 있다. 경로/에셋 참조가 basePath 유무와 무관하게 동작하도록 설계한다(`next/link` 사용, 하드코딩 절대경로 금지, `/apps/...` iframe·링크는 basePath 반영 방법 명시).
* Supabase는 브라우저에서 `src/lib/supabase.ts` 클라이언트로만 호출.
* 글 원본은 `posts.content_md`. marked.js + DOMPurify를 **CDN**으로 불러와 브라우저에서 렌더링.
* 관리자: `profiles.role = 'admin'`. 방문자: 로그인 후 댓글·좋아요. 조회수는 `increment_post_view(slug)` RPC + sessionStorage 중복 방지.
* 한국어 UI, 미니멀, 다크모드, 모바일 대응. 기존 shadcn/ui + Tailwind 활용.
* 웹앱은 `/public/apps/{앱이름}/`의 정적 앱. 메인 페이지에 웹앱 카드 섹션이 필요(아직 앱은 없음 → 데이터 구조와 빈 상태만 설계).

## spec.md에 담을 내용
1. 화면 목록과 URL (최소: 메인, 글 상세, 태그/검색 필요 여부 판단, 로그인, 관리자 글 목록, 글 작성·수정 에디터(미리보기 포함), 404)
2. 화면별: 목적, 구성 요소, 사용하는 Supabase 쿼리/RPC, 로딩·빈·오류 상태, 권한(비로그인/사용자/관리자)
3. 파일 구조 (새로 만들/수정할 파일 경로 목록과 역할)
4. 공통 컴포넌트와 필요한 shadcn 컴포넌트 목록
5. 인증 흐름 (로그인 방식 후보와 추천, 세션 유지, 관리자 가드는 UX용이고 보안은 RLS라는 점)
6. 마크다운 렌더링 방식 (CDN 로딩 방법, XSS 처리, 코드 하이라이트 여부)
7. 웹앱 카드 데이터 구조 (예: `src/data/apps.ts`) 와 iframe/미리보기 방식
8. 다크모드 구현 방식
9. 구현 단계 분할 (Build 서브에이전트에게 나눠 줄 수 있는 단위)
10. 스키마 변경이 필요하면 제안(직접 SQL 파일을 만들지 말 것)
11. 사용자 결정이 필요한 열린 질문 (추천안 포함)

간결하게, 표와 목록 위주로 작성한다.
