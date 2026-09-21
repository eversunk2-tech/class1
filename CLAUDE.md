@AGENTS.md

## 프로젝트 개요

* 마크다운 기반 블로그 + 미니 웹앱 포트폴리오
* 블로그 본체: Next.js 16 (App Router) + Tailwind + shadcn/ui, 정적 export
* 웹앱: HTML, CSS, JavaScript로 만든 독립 정적 앱 (`/public/apps/{앱이름}/`)
* Supabase 기반 백엔드 데이터 서버 (글, 댓글, 좋아요, 조회수, 로그인, 웹앱 데이터)
* 배포: GitHub Pages 프로젝트 사이트 (`https://eversunk2-tech.github.io/class1/`, 저장소 `eversunk2-tech/class1`, basePath `/class1`)
* 언어/디자인: 한국어 UI, 미니멀 스타일, 다크모드 지원


## 기술 결정 사항

### 정적 export 제약 (GitHub Pages)
* `next.config.ts`에 `output: 'export'`, `basePath: '/class1'`, `images: { unoptimized: true }`를 유지한다.
* 내부 링크는 `next/link`를 쓴다. `next/image` src, iframe, `/apps/...` 링크, OAuth redirectTo 등 basePath가 자동으로 붙지 않는 곳은 `process.env.NEXT_PUBLIC_BASE_PATH`를 앞에 붙인다. 절대경로를 하드코딩하지 않는다.
* 서버 기능을 쓰지 않는다: Server Actions, Route Handlers, middleware/proxy, 동적 SSR, `@supabase/ssr` 서버 쿠키 세션 금지.
* Supabase 호출은 모두 브라우저(Client Component)에서 `@supabase/supabase-js`로 한다.
* 동적 경로(예: 글 상세)는 쿼리스트링(`/post?slug=...`)이나 클라이언트 라우팅으로 처리한다. `generateStaticParams`로 DB 글을 빌드 타임에 고정하지 않는다.
* 배포는 GitHub Actions로 `next build` → `out/` 폴더를 Pages에 올린다.

### 블로그 글
* 글 원본은 Supabase `posts` 테이블에 마크다운 텍스트로 저장한다.
* 브라우저에서 불러와 marked.js(CDN)로 렌더링한다. 렌더링 결과는 DOMPurify(CDN)로 정리한 후 삽입한다.
* 글 작성/수정은 사이트 내 관리자 화면에서 한다.

### Supabase
* 환경 변수: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (`.env.local`, 커밋 금지).
* anon key만 클라이언트에 노출한다. service_role key는 절대 코드/저장소에 넣지 않는다.
* 모든 테이블에 RLS를 켜고 정책을 작성한다. 보안은 클라이언트 가드가 아니라 RLS로 보장한다.
* 블로그 공용 테이블: `profiles`(role: admin/user), `posts`, `comments`, `likes`, `views`.
* 웹앱 전용 테이블은 `app_{앱이름}_` 접두사를 붙인다.
* 스키마 변경은 `supabase/migrations/`에 SQL 파일로 남긴다.

### 로그인 (Auth)
* 관리자(나): 글 작성·수정·삭제 권한. `profiles.role = 'admin'`으로 판별한다.
* 방문자: 가입/로그인 후 댓글 작성, 웹앱 데이터 저장 가능. 읽기와 조회수는 비로그인도 가능.
* 로그인 방식: 이메일/비밀번호(사전 생성 계정, 사이트에 가입 폼 없음), GitHub OAuth, Google OAuth.
* 가입 정책: Supabase 가입 허용 유지(OAuth 방문자는 첫 로그인 시 일반 사용자로 자동 가입), Confirm email 켬.
* 사전 계정은 관리자가 로컬 스크립트(service_role key 사용, 클라이언트에 포함 금지)로 생성한다.
* redirect URL은 `https://eversunk2-tech.github.io/class1/**`와 `http://localhost:3000/class1/**`를 등록한다.


## 작업 사이클

* 사용자가 웹앱 주제를 요청하면 다음 순서로 진행한다.
* Plan — 서브에이전트(sonnet, haiku 모델 사용)를 만들어 계획을 작성한다. 어떤 웹앱을 만들지, 파일 구조는 어떻게 할지, Supabase 테이블/RLS가 필요한지 정리한다. 작성한 계획은 `spec.md`로 저장하며, 사용자 승인을 받는다.
* Build — 서브에이전트를 만들어 구현한다. 웹앱은 `/public/apps/{앱이름}/` 폴더에 독립적으로 만든다. 블로그의 다른 파일을 건드리지 않는다.
* Review — 별도 서브에이전트를 만들어 검증한다. 브라우저에서 정상 동작하는지(모바일 뷰포트 포함), 코드에 문제가 없는지, RLS 정책이 적절한지 확인하고 `review.md`를 작성한다. 문제가 있으면 수정한다.
* Embed — 블로그 메인 페이지(`src/app/page.tsx`)에 웹앱 카드를 추가한다. 카드에는 제목, 설명, 미리보기 이미지 또는 iframe을 넣는다. 깃 커밋한다.


## 서브에이전트 규칙

* 서브에이전트에게 작업을 넘길 때 전용 지침 파일(.md)을 만들어 전달한다.
* Build 서브에이전트와 Review 서브에이전트는 반드시 분리한다.
* 서브에이전트는 지침 파일에 명시된 범위만 수정한다.


## 웹앱 규칙

* 모든 웹앱은 `/public/apps/{앱이름}/` 폴더 안에 자체 완결된다. (배포 URL: `/class1/apps/{앱이름}/`)
* 웹앱 내부의 파일 참조는 상대경로만 사용한다(`./style.css`). `/`로 시작하는 절대경로 금지.
* `spec.md`, `review.md`, 서브에이전트 지침 파일도 해당 앱 폴더에 둔다.
* 순수 HTML, CSS, JavaScript로 만든다. React/Next.js/빌드 도구를 쓰지 않는다.
* 외부 라이브러리 사용을 최소화한다. CDN은 허용한다.
* Supabase가 필요하면 CDN의 supabase-js를 쓰고, URL과 anon key는 앱 폴더 안 `config.js`에 둔다.
* 모바일에서도 사용할 수 있어야 한다.


## 규칙

* 승인 없이 구현을 시작하지 않는다.
* 막히면 사용자에게 알린다.
