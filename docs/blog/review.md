# Review: 블로그 1차 구현 검증

작성: Review 서브에이전트 (2026-09-21). 코드는 수정하지 않았다. 검증용 임시 파일(가짜 Supabase 서버, 임시 빌드 복사본, 테스트 CSV)은 스크래치 디렉터리에만 만들었고 모두 삭제했다. `out/`은 마지막에 일반 env로 다시 빌드했다(가짜 서버 주소 없음 확인).

## 요약

| 구분 | 결과 |
|---|---|
| `npm run lint` | 통과 (경고 0) |
| `npm run build` | 통과, 모든 라우트 생성 (`/`, `/post/`, `/search/`, `/login/`, `/admin/`, `/admin/write/`, `404.html`) |
| basePath(`/class1`) | 통과. `out/*.html`에 `/class1` 밖 절대경로 없음. 소스의 `/`-절대경로는 모두 `next/link`·`router`(자동 반영) |
| 브라우저 동작 | 대부분 통과 (가짜 Supabase 기준) |
| service_role key | 번들(`out/`)·`src/`·`scripts/`·git 이력에는 없음. **단, 작업 트리의 `.env.local.example`에 실제 키가 들어 있음 (치명)** |

**문제 개수: 치명 1 / 높음 1 / 중간 5 / 낮음 9 (총 16)**

가장 먼저 처리할 것:
1. `.env.local.example`의 실제 service_role key를 자리표시 값으로 되돌리기 (커밋 전에)
2. OAuth 로그인과 "공개 가입 없음" 정책이 서로 맞지 않는 문제 결정
3. 마크다운 정화 설정(`<style>`/`<form>` 허용)과 CDN 무결성(SRI) 보강

## 문제 목록

| # | 심각도 | 위치 | 현상 | 재현 방법 | 수정 제안 |
|---|---|---|---|---|---|
| 1 | **치명** | `.env.local.example:2-3, 7` | 추적되는 파일(`.gitignore`의 `!.env.local.example`로 커밋 대상)에 실제 프로젝트 URL, anon key, **service_role key**(주석 처리됨)가 들어 있음. 이 리뷰를 시작할 때의 git status에는 없던 변경이라 세션 중에 바뀐 것으로 보임(Review가 한 변경 아님). 커밋·푸시하면 RLS를 완전히 우회하는 키가 공개 저장소에 올라감 | `git diff .env.local.example` → JWT payload의 `role`이 `service_role` | 파일을 자리표시 값(`your-project-ref`, `your-anon-key`, `your-service-role-key`)으로 되돌림. 실제 값은 `.env.local`(무시되는 파일)에만 둠. 이 파일이 어디든 공유·업로드된 적이 있으면 Supabase 대시보드에서 service_role key를 재발급(rotate)함. 추가 방어로 pre-commit에서 `service_role` 문자열 검사를 권장 |
| 2 | 높음 | `src/lib/auth.ts:36-54`, `src/app/login/login-form.tsx:138-159` (spec §5.2와 §12 Q3 사이의 충돌) | 사전 발급 계정은 `{아이디}@class1.local`이라 GitHub/Google 계정 이메일과 절대 일치하지 않음. (a) 공개 가입을 끄면(Q3) 처음 쓰는 OAuth 사용자는 새 계정으로 취급되어 "Signups not allowed" 오류로 로그인할 수 없음 → OAuth 버튼이 사실상 쓸모없음. (b) OAuth 때문에 가입을 켜면 GitHub/Google 계정만 있으면 누구나 계정을 만들어 댓글·좋아요를 쓸 수 있고, anon key로 `/auth/v1/signup`(이메일 가입) API도 직접 호출 가능해짐 → "공개 가입 없음" 정책이 깨짐 | 코드와 Supabase Auth 동작 분석(가짜 서버라 실제 확인 못 함). 실 Supabase에서 가입 비활성 상태로 새 GitHub 계정 로그인 시도 | 사용자 결정 필요. ① OAuth 버튼 제거(사전 발급 계정만), ② 가입은 끄고 관리자가 대상자의 OAuth 이메일로 계정을 미리 만들어 연결(자동 identity linking은 이메일이 같아야 함), ③ 가입을 켜되 Supabase "Before User Created" Auth Hook으로 허용 목록 이메일만 통과. 어느 쪽이든 spec §12에 기록 |
| 3 | 중간 | `src/lib/markdown.ts:58` | `DOMPurify.sanitize(html, { USE_PROFILES: { html: true } })`가 `<style>`과 `<form>/<input>/<button>`을 허용함. 본문의 `<style>`이 페이지 전체에 적용됨(글 상세, 에디터 미리보기 모두). 외부 action을 가진 폼도 그대로 렌더링됨. `<script>`, `onerror`, `javascript:` 링크, `<iframe>`, `<svg><script>`는 제거됨(확인) | 가짜 서버 글 본문에 `<style>body{background:red !important}</style>` → 글 상세 전체 배경이 빨갛게 바뀜. `<form action="https://evil.example">…` → 폼 렌더링됨 | `FORBID_TAGS: ['style','form','input','button','textarea','select','option']`, `FORBID_ATTR: ['style']`(필요 시) 추가. 작성자는 관리자뿐이라 위험도는 중간이지만, 복사·붙여넣기한 콘텐츠로 사이트 전체가 깨지거나 피싱 폼이 들어갈 수 있음 |
| 4 | 중간 | `src/lib/markdown.ts:4-8`, `src/components/markdown-viewer.tsx:44-46` | 정화기(DOMPurify)와 파서를 CDN에서 메이저 버전만 고정(`marked@15`, `dompurify@3`, `cdn-assets@11`)하고 SRI(`integrity`) 없이 로드함. CDN·패키지가 오염되면 XSS가 되고, Supabase 세션이 localStorage에 있어 계정 탈취로 이어짐 | 코드 확인 | 정확한 버전으로 고정(`marked@15.0.x` 등)하고 `integrity`+`crossOrigin="anonymous"`를 `next/script`에 지정. 또는 npm 패키지로 번들(spec §6의 "CDN" 결정을 바꿔야 하므로 사용자 확인) |
| 5 | 중간 | `src/components/admin-guard.tsx:20-37` | effect 의존성이 `user` 객체라, 세션 객체가 바뀔 때마다(TOKEN_REFRESHED 약 1시간마다, SIGNED_OUT 등) `is_admin` RPC를 다시 호출함. 이때 네트워크 오류가 나거나 세션이 만료되면 바로 `router.replace('/login/')` → 에디터의 저장하지 않은 글이 경고 없이 사라짐(`beforeunload`는 클라이언트 라우팅에서 동작하지 않음). 로그인된 상태에서는 `/login/`이 다시 `/`로 보내서 원인도 알 수 없음 | 코드 분석. 비관리자 로그인 상태로 `/class1/admin/` 접속 → `/login/`을 거쳐 `/`로 이동하는 것은 브라우저로 확인 | 의존성을 `user?.id`로 바꾸고, 이미 `allowed`인 상태에서 RPC가 **오류**로 실패하면 리다이렉트하지 말고 토스트만 표시. 세션이 사라진 경우에는 에디터 내용을 `sessionStorage`에 임시 저장하거나 "로그인이 만료되었습니다" 안내를 보여줌 |
| 6 | 중간 | `supabase/migrations/20260921000000_init_blog.sql:47` | `handle_new_user`가 `full_name`을 그대로 `display_name`에 넣는데 컬럼 제약은 50자 이하(25행). 50자를 넘으면 트리거가 실패해 **auth 계정 생성 자체가 롤백됨**(OAuth 사용자, CSV `name` 열이 긴 경우) | 코드 분석. `scripts/import-users.mjs:183`도 이름 길이를 검사하지 않음 | 트리거에서 `left(coalesce(...), 50)` 사용(새 마이그레이션으로). 스크립트에도 50자 검사 추가 |
| 7 | 중간 | `src/app/post/post-detail.tsx:151`, `src/components/comment-section.tsx:103` | 글 삭제(상세 화면)와 댓글 삭제가 `.select()` 없이 `delete()`만 호출함. RLS가 0건으로 조용히 막으면(관리자 권한 해제, 세션 만료 후 anon 전환 등) 오류가 없어서 "삭제했습니다" 토스트가 뜨고 목록/화면에서 사라지지만 실제로는 남아 있음. Build B가 관리자 목록·에디터에는 `.select()`를 붙였지만 이 두 곳은 빠짐 | 코드 비교(`admin-post-list.tsx:93`, `post-editor.tsx:294`는 처리됨) | `.delete().eq(...).select('id')` 후 `!data?.length`면 실패 처리 |
| 8 | 낮음 | `src/components/like-button.tsx:41-61` | 중복 방지가 `busy` state라 같은 틱의 연속 클릭은 모두 통과함. 추가 insert는 실 DB에서 PK 충돌(23505)로 실패 → 롤백 코드가 `liked=false`로 되돌려, 실제로는 좋아요가 저장됐는데 화면은 "안 누름" + 오류 토스트가 뜸. 다른 탭에서 이미 누른 경우도 같음 | JS로 `button.click()` 3번 연속 → `POST /rest/v1/likes` 3번 전송 확인. 일반 사용자의 더블클릭은 이벤트 사이에 리렌더되어 대부분 막힘 | `useRef`로 진행 중 플래그 관리. insert가 23505면 성공(이미 좋아요)으로 간주, delete는 0건이어도 성공으로 간주하고 끝나면 count를 다시 조회 |
| 9 | 낮음 | `src/app/search/search-view.tsx:43`, `src/lib/slug.ts:31-38` | supabase-js `contains(col, [tag])`는 배열 요소를 따옴표로 감싸지 않고 `cs.{tag}`로 보냄. 태그에 `"`, `\`, `{`, `}`가 있으면 PostgreSQL 배열 리터럴 오류로 검색이 실패하고, URL로 `?tag=a,b`를 주면 "a와 b를 모두 포함" 조건이 됨. `parseTags`는 이런 문자를 막지 않음. 태그 `NULL`(대소문자 무관)도 null 요소로 해석됨 | `/class1/search/?tag=a%22b` → "검색 결과를 불러오지 못했습니다"(가짜 서버가 PostgreSQL 오류를 흉내 냄) | `.filter('tags', 'cs', JSON.stringify([tag]).replace(/^\[/, '{').replace(/\]$/, '}'))`처럼 요소를 큰따옴표로 감싸서 보내거나, `parseTags`에서 `"\{}` 문자를 제거 |
| 10 | 낮음 | `src/components/admin-guard.tsx:31`, spec §2.5 | 로그인한 일반 사용자가 `/admin/`에 오면 안내 없이 `/login/` → `/`로 튕김 | 앨리스로 로그인 후 `/class1/admin/` 접속(확인) | 로그인 상태면 "관리자만 접근할 수 있습니다" 안내 + 메인 링크 표시, 비로그인일 때만 `/login/` |
| 11 | 낮음 | `src/app/admin/admin-post-list.tsx:43, 76-80` | `busyId`가 하나라서 두 행을 빠르게 연달아 토글하면 첫 요청이 끝날 때 `setBusyId(null)`이 두 번째 행의 비활성 상태를 풀어버림 | 코드 분석 | `Set<string>`으로 관리 |
| 12 | 낮음 | `supabase/migrations/20260921000000_init_blog.sql:165-169` | 댓글 update 정책이 `user_id`만 검사해, 작성자가 API로 `post_id`를 비공개 글로 바꾸거나 `created_at`을 조작할 수 있음(UI에는 수정 기능 없음) | 정책 분석 | `revoke update on comments` 후 `grant update (body)` 또는 with check에 공개 글 조건 추가 |
| 13 | 낮음 | 마이그레이션 74-76, 188-190행 | `profiles`는 누구나 전체 컬럼 조회(모든 사용자의 `role` 노출), `likes`는 누구나 `user_id` 조회(누가 어떤 글에 좋아요했는지) | 정책 분석 | 수업용이면 허용 가능. 원하면 `role`은 컬럼 권한으로 숨기고 `is_admin()`만 사용 |
| 14 | 낮음 | `src/components/site-footer.tsx:5` | `new Date().getFullYear()`가 빌드 시점에 고정됨(정적 export) | 코드 확인 | 문제 없으면 그대로 두거나 고정 연도 문자열로 명시 |
| 15 | 낮음 | `src/components/post-card.tsx:38` | 메타 줄(날짜·조회수·태그) 컨테이너가 `relative z-10`이라 카드 전체 링크 오버레이 위에 있음. 태그가 아닌 날짜/조회수 글자 부분을 눌러도 글로 이동하지 않음 | 카드의 날짜 텍스트 클릭 | `z-10`을 `TagList`에만 적용 |
| 16 | 낮음 | `scripts/import-users.mjs:152-155` ↔ `src/lib/auth.ts:7-10` | 스크립트는 이메일을 소문자로 만들고 로그인 화면은 입력을 그대로 보냄(`STU1` 입력 → `STU1@class1.local`). Supabase가 로그인 시 이메일을 소문자로 정규화하면 문제없음 | 가짜 서버로는 확인 불가 | `loginIdToEmail`에서도 `.toLowerCase()` 적용해 규칙을 맞춤 |

## 확인한 항목과 방법

### 실제로 돌려본 것
- **빌드/린트**: `npm run lint`, `npm run build` (Next 16.3.5, Turbopack). `out/` 라우트 목록, `out/index.html`·`404.html`의 href/src가 모두 `/class1/...`인지 grep. 소스에서 `href="/`, `src="/`, `fetch('/` 검색 → 모두 `next/link`/`router` 경로(자동 basePath)라 문제없음. `withBasePath`는 iframe/썸네일/OAuth redirectTo에 사용됨
- **비밀키**: `out/`, `src/`, `scripts/`에서 `service_role`/`c2VydmljZV9yb2xl`(base64) grep → 없음. `git log -S`로 이력 확인 → 없음. `.env.local.example` 작업 트리 변경은 위 #1
- **가짜 Supabase**: 스크래치에 Node로 Auth(`/token` password/refresh, `/user`, `/settings`, `/logout`)와 PostgREST 일부(eq/in/cs/ilike/or, order, offset/limit, count=exact, single/maybeSingle, return=representation), RPC(`is_admin`, `increment_post_view`), RLS 흉내(공개/초안, 관리자 쓰기, 댓글/좋아요 본인)를 구현. 임시 env로 빌드해 스크래치의 `class1/` 폴더로 복사 후 `python3 -m http.server`로 서빙
- **브라우저(데스크톱 1024px, 모바일 375px, 라이트/다크)**
  - 메인: 목록 10개 → "더 보기" → 13개(초안 제외), 더 보기 버튼 사라짐, 조회수 표시, 웹앱 빈 상태 문구
  - 글 상세 XSS: `<script>`, `<img onerror>`, `[x](javascript:)`, `<a href="javascript:">`, `<iframe src=javascript:>`, `<svg><script>` 모두 실행 안 됨(전역 플래그 미설정, href 제거). `<style>`/`<form>`은 통과(#3). 코드 하이라이트(hljs 토큰) 적용, 표 렌더링, 댓글 `<b>`는 텍스트로 표시
  - 로그인: 틀린 비밀번호 → "아이디 또는 비밀번호가 올바르지 않습니다." 표시. 아이디 `alice`, ` admin `(앞뒤 공백) → `@class1.local` 붙여 로그인 성공 후 `/class1/`로 이동
  - 일반 사용자: 좋아요(연타 #8), 댓글 등록(HTML 이스케이프), 초안 글 → "존재하지 않는 글입니다", `/admin/` 접근 → 메인으로 튕김(#10), 프로필 다이얼로그(`javascript:` URL 거부, 이름/URL 저장 후 토스트, 다이얼로그 닫힘)
  - 관리자: 목록에 초안 포함, 발행 토글(초안→발행 시 `published_at` 채움, 비공개로 돌려도 유지), 초안 상세에 "비공개 글" 배지·수정/삭제 버튼, 조회수 미증가, 비공개 글 댓글 폼 비활성
  - 에디터: 한글 제목 → `post-YYYYMMDD-xxxx` slug, 태그 `#태그, a, a , b` → `["태그","a","b"]`, 나란히 미리보기(정화·하이라이트 유지), 저장 후 URL이 `?slug=`로 바뀜, 기존 slug(`post-1`)로 변경 시 중복 오류, `Bad Slug!` → 형식 오류, slug 변경+발행 후 Cmd+S 저장 → URL 갱신
  - 조회수: 같은 탭에서 새로고침해도 증가 1회(sessionStorage), 초안은 증가 안 함
  - 모바일 375px + 다크: 메인/상세/관리자/에디터/검색 모두 `scrollWidth == 375`(가로 스크롤 없음), 다크 테마 적용, 에디터 하단 저장 바 고정
  - 검색: 특수문자 검색어(`"`, `,`, `)`) + 태그 조합 정상 동작(가짜 서버 기준), 따옴표가 든 태그는 오류(#9)
  - 404: `/class1/404.html` 제목·문구·메인 링크 확인
  - 콘솔: 앱 코드로 인한 JS 오류 없음. 보인 오류는 자리표시 env 빌드의 `ERR_NAME_NOT_RESOLVED`, 의도적인 잘못된 태그 요청의 400, 테스트 본문의 `<img src=x>` 404, python 서버의 `/favicon.ico` 404(실제 페이지는 `/class1/favicon.ico` 링크 사용)
- **import 스크립트**: 임시 CSV(BOM, CRLF, 따옴표 안 쉼표, 짧은 비밀번호, 대소문자 중복, 빈 아이디)로 `--dry-run` 실행 → 검사 결과 정확, 비밀번호 미출력. 연결 실패 시에도 비밀번호·키 미출력 확인
- **코드 리뷰**: `src/**` 전체, `scripts/import-users.mjs`, 마이그레이션을 읽고 RLS와 클라이언트 쿼리를 대조
  - 초안 비노출: 목록/검색은 `published=eq.true`, 상세는 RLS 의존 → 비관리자에게 초안 없음(가짜 RLS로 확인)
  - 댓글/좋아요 `user_id` 위조: 클라이언트가 `user_id`를 보내지 않고 DB 기본값 `auth.uid()` + RLS `with check (auth.uid() = user_id)` 사용 → 위조 불가
  - 구독 해제: `onAuthStateChange` unsubscribe, 테마 `matchMedia` 리스너, 에디터 `keydown`/`beforeunload` 리스너 모두 cleanup 있음. 비동기 effect에 `active` 플래그 있음
  - 서버 기능 미사용(Server Actions/Route Handler/middleware 없음), 모든 동적 페이지 `useSearchParams`는 `Suspense` 안, UI 문구 한국어, `lang="ko"`

### 가짜 서버라서 확인하지 못한 것
- 실제 PostgREST의 `or(title.ilike."%…%",…)` 따옴표 문법과 한글 태그 `contains`
- 실제 RLS 거부 시 응답 모양(0건 vs 오류), `profiles(display_name,avatar_url)` 임베드 모양, insert 후 `select` 반환 권한
- 토큰 자동 갱신(TOKEN_REFRESHED)과 만료 시 동작(#5는 코드 분석 결과)
- OAuth 왕복(GitHub/Google), 비활성 공급자 안내 문구(가짜 서버는 둘 다 비활성으로 응답)
- 실제 좋아요 PK 충돌 시 UI(#8은 코드 분석, 가짜 서버는 중복 검사에 경쟁 상태가 있었음)
- GitHub Pages에서의 404 처리(`/class1/없는경로` → `404.html`)와 실제 배포 경로
- 실제 브라우저에서 로그인 폼 Enter 제출(자동화 도구의 Enter는 제출을 일으키지 않았음. 일반 `<form>` + submit 버튼 구조라 정상일 것으로 봄)
- `import-users.mjs`의 실제 계정 생성

## 실 Supabase 연결 후 사용자가 직접 확인할 체크리스트

- [ ] `.env.local.example`을 자리표시 값으로 되돌렸는지, `git diff --cached`에 키가 없는지 (필요하면 service_role key 재발급)
- [ ] GitHub Actions secrets에 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`만 있고 service_role key는 없는지
- [ ] Auth 설정: 이메일 가입 비활성 상태에서 `curl -X POST <URL>/auth/v1/signup -H "apikey: <anon>" -d '{"email":"x@x.com","password":"123456"}'`가 거부되는지
- [ ] OAuth 정책 결정(#2) 후, GitHub/Google 로그인이 의도대로 되는지(새 계정 생성 여부 포함). Redirect URLs에 `https://eversunk2-tech.github.io/class1/login/` 등록
- [ ] `import-users.mjs --dry-run` → 실제 실행 → 사전 발급 아이디로 로그인(대문자 섞인 아이디도)
- [ ] 관리자 지정 SQL 실행 후 유저 메뉴에 "글 관리/새 글 작성" 표시, `/admin/` 접근
- [ ] 비로그인 상태에서 초안 slug로 `/post/?slug=` 접근 → "존재하지 않는 글입니다", REST로 `posts?published=eq.false` 조회 시 빈 배열
- [ ] 일반 사용자 토큰으로 `posts` insert/update/delete, 다른 사람 댓글 delete, `profiles.role` update가 모두 거부되는지
- [ ] 댓글 등록 직후 작성자 이름/아바타가 보이는지(임베드 조인)
- [ ] 좋아요 두 탭에서 동시에 누르기 → 표시와 DB 일치 여부(#8)
- [ ] 한글 태그 클릭 → 검색 결과, `"`·`,`·`)`가 든 검색어 → 오류 없이 결과
- [ ] 글 발행 토글/삭제/에디터 저장이 RLS에서 허용되고 `updated_at`이 트리거로 갱신되는지
- [ ] 1시간 이상 에디터를 열어 둔 뒤(토큰 갱신) 저장이 되는지, 편집 중 화면이 튕기지 않는지(#5)
- [ ] 배포 후 `https://eversunk2-tech.github.io/class1/없는경로` → 404 페이지, 새로고침 시 다크모드 유지(FOUC 없음), 모바일 실기기 확인
