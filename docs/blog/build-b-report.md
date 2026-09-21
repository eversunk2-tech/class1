# Build 서브에이전트 B 완료 보고 (단계 6~10 + §12 추가 기능)

## 검증 결과
- `npm run lint`: 통과(경고 0)
- `npm run build`: 통과. `out/search/index.html`, `out/admin/index.html`, `out/admin/write/index.html`, `out/404.html` 생성 확인
- `scripts/import-users.mjs`: 임시 CSV로 확인. BOM·CRLF·따옴표 안 쉼표·`""` 이스케이프 처리, 짧은 비밀번호/CSV 안 중복/빈 아이디 검출, `--dry-run`, 열 이름 옵션, env 누락과 연결 실패 메시지 확인. 비밀번호와 키는 출력되지 않음. 실제 Supabase 대상 실행은 하지 않음
- 브라우저 확인: `.env.local`이 예시값이라, **테스트할 때만** `NEXT_PUBLIC_SUPABASE_URL`을 로컬 가짜 서버(scratchpad의 PostgREST/Auth 흉내 서버)로 바꿔 빌드하고 `/class1/`로 서빙해 확인함. 확인 후 원래 env로 다시 빌드함(`out/`에 테스트 주소 없음). 가짜 로그인은 비밀번호 입력 대신 localStorage에 세션을 넣는 방식으로 함
  - 메인: 글 목록 + 웹앱 섹션. 확인용 임시 앱 항목을 넣은 빌드에서 카드 클릭 → 모달 iframe(`/class1/apps/demo/`), "새 탭으로 열기" 링크 확인. 임시 항목은 되돌렸음(`webApps = []`)
  - 태그 칩 → `/search/?tag=`, 검색어 + 태그 함께 쓰기, 결과 없음, `"`·`,`·`)`가 들어간 검색어(PostgREST `or` 문법이 깨지지 않음)
  - `/admin/`: 목록, 발행 토글(초안 → 발행 시 `published_at` 채움), 삭제 확인 다이얼로그
  - `/admin/write/`: 한글 제목 → 날짜 기반 slug 자동 생성, 태그 파싱, 실시간 미리보기(XSS 정화 유지: `onerror` 제거됨), 저장 후 `?slug=` 수정 모드로 전환, slug 중복 오류 표시, Ctrl/Cmd+S 저장, slug 변경 후 URL 갱신
  - 글 상세의 관리자 "수정" 버튼, 유저 메뉴(프로필 수정 / 글 관리 / 새 글 작성), 프로필 다이얼로그(URL 검증, 저장 후 헤더 반영)
  - 로그인 안 한 상태로 `/admin/write/` 접속 → `/login/`으로 이동
  - 모바일 375px + 다크모드: 에디터·관리자·검색 화면에서 가로 스크롤 없음
  - 404 페이지(제목: "페이지를 찾을 수 없습니다")

## 만든/수정한 파일
**신규**
- `src/app/search/page.tsx`, `search-view.tsx` — 검색어(제목/요약 `ilike`) + 태그(`contains`) 필터, 태그 칩 목록(최근 발행 글 100개의 태그를 많이 쓰인 순서로), "더 보기", 조회수 표시
- `src/app/admin/page.tsx`, `admin-post-list.tsx` — 전체 글 목록(`updated_at` 최신순), 발행 스위치, 수정·삭제
- `src/app/admin/write/page.tsx`, `post-editor.tsx` — 작성/수정 에디터, 미리보기(`MarkdownViewer` 재사용), slug 처리, 삭제
- `src/lib/slug.ts` — `SLUG_PATTERN`/`isValidSlug`(DB check와 같은 규칙), `slugifyTitle`, `fallbackSlug`, `parseTags`, `isHttpUrl`
- `src/data/apps.ts` — `WebApp` 타입, `webApps`(빈 배열), `appHref`, `appThumbnailSrc`(basePath 반영)
- `src/components/apps/app-card.tsx`, `app-grid.tsx` — 카드 + 모달 iframe + 새 탭 링크, 앱이 없을 때 안내 문구
- `src/components/profile-dialog.tsx` — `display_name`(최대 50자, DB 제약과 같음), `avatar_url`(http/https만) 수정
- `scripts/import-users.mjs` — 계정 일괄 생성(상단 주석에 한국어 사용법)
- `docs/blog/build-b-report.md` (이 문서)

**수정 (A가 만든 파일)**
- `src/app/page.tsx` — 웹앱 섹션(`AppGrid`) 추가
- `src/components/tag-chip.tsx` — 기본값을 `/search/?tag=` 링크로 변경, `linked={false}`면 표시만(에디터 태그 미리보기, 앱 카드). `tagSearchHref()` 내보냄
- `src/components/post-card.tsx` — `editPostHref(slug)` 추가
- `src/app/post/post-detail.tsx` — 관리자 "수정" 버튼
- `src/components/site-header.tsx` — 검색 아이콘 링크
- `src/components/user-menu.tsx` — "프로필 수정", 관리자에게 "글 관리"·"새 글 작성"
- `src/app/not-found.tsx` — 페이지 제목(metadata) 추가

`package.json`은 바꾸지 않음(새 패키지 없음).

## spec과 달라진 점과 이유
1. **검색어 없이 `/search/`에 들어오면 전체 목록 대신 안내 문구를 표시** — 전체 목록은 메인과 같으므로, 필요 없는 쿼리를 줄임
2. **검색어 이스케이프** — `or()` 값을 큰따옴표로 감싸고 `"`와 `\`는 공백으로 바꿈. `%`·`_`는 LIKE 와일드카드로 남지만 결과가 넓어질 뿐 안전함. 검색어는 100자로 제한
3. **에디터 레이아웃** — 탭 3개: "작성 / 미리보기 / 나란히"("나란히"는 1024px 이상에서만 보임). 넓은 화면에서는 에디터만 본문 폭(`max-w-3xl`)을 벗어나 최대 72rem까지 넓어짐(`layout.tsx`는 수정하지 않음). 미리보기는 `useDeferredValue`로 입력을 방해하지 않게 함
4. **slug 규칙** — 신규 글은 사용자가 slug를 직접 고치기 전까지 제목에서 자동으로 만듦. 제목에 영문/숫자가 없으면(한글 제목) `post-YYYYMMDD-xxxx`. 자동 slug가 겹치면 `-2`, `-3` …을 붙임. 직접 입력한 slug가 겹치면 오류를 표시함. 기존 글의 slug는 자동으로 바뀌지 않고, 직접 바꾸면 "기존 주소로는 접속할 수 없다"는 안내를 보여줌. 중복 확인은 `count head` 대신 `select('id').limit(1)`로 함(수정 중인 글 자신을 빼야 해서). 저장할 때 DB 유니크 오류(23505)도 같은 메시지로 처리함
5. **published_at 정책** — 처음 발행할 때만 현재 시각으로 채움. 비공개로 돌려도 기존 발행일은 유지함(관리자 목록 토글과 에디터에서 같음)
6. **쓰기 결과 확인** — update/delete에 `.select()`를 붙여 영향받은 행이 0개인 경우(RLS가 조용히 막은 경우)도 실패 토스트를 띄움
7. **웹앱 데이터** — spec의 `href`/`thumbnailUrl` 필드 대신 `id`만 저장하고 경로는 `appHref()`/`appThumbnailSrc()`로 계산함(basePath 누락을 막기 위해). `thumbnail`은 `public/apps/{id}/` 기준 상대 경로 또는 http(s) URL
8. **추가 편의 기능** — 에디터에 Ctrl/Cmd+S 저장, 저장하지 않은 변경이 있으면 새로고침/탭 닫기 전에 확인(`beforeunload`), 관리자 화면에 `robots: noindex`
9. **import 스크립트의 기존 계정 확인** — 먼저 `auth.admin.listUsers`(페이지 단위)로 기존 이메일을 모아 건너뛰고, 그 사이에 생긴 계정은 `email_exists` 오류로 한 번 더 건너뜀. `--dry-run`은 네트워크를 쓰지 않으므로 "이미 있는 계정" 여부는 실제 실행 때 알 수 있음. 이메일은 소문자로 바꿔 비교함(Supabase가 이메일을 소문자로 저장함)

## 알려진 한계
- 실제 Supabase로는 테스트하지 않음. 가짜 서버는 PostgREST 필터 일부만 흉내 내므로, 특히 `or(title.ilike."%…%",…)` 따옴표 문법과 `contains('tags', [한글태그])`가 실제로 동작하는지 확인이 필요함
- 태그 칩 목록은 최근 발행 글 100개만 보고 만듦(spec §2.3 방식). 글이 많아지면 오래된 태그가 빠질 수 있음(§10 스키마 제안 보류 중)
- 검색은 제목/요약만 대상이고 본문은 제외(spec 그대로). 인덱스가 없어 글이 많아지면 느려짐(§10)
- 목록 "더 보기"는 offset 방식(A와 같음)
- 에디터에서 Next `Link`로 다른 페이지로 이동할 때는 저장 안 한 변경 경고가 뜨지 않음(`beforeunload`는 새로고침/탭 닫기만 막음)
- 두 관리자가 같은 글을 동시에 고치면 나중에 저장한 쪽이 덮어씀(버전 확인 없음)
- **웹앱 iframe은 같은 출처(origin)** — `public/apps/*`의 앱은 블로그와 같은 출처라서 localStorage의 Supabase 세션에 접근할 수 있음. 새 탭으로 열어도 같음. 믿을 수 있는 앱만 올려야 함. 믿을 수 없는 앱을 올려야 한다면 다른 도메인에서 호스팅하는 것을 검토해야 함
- 모달 안 iframe에 포커스가 있으면 Esc로 닫히지 않음(브라우저 기본 동작). 닫기(X) 버튼은 동작함
- 프로필 사진은 URL 입력만 지원함(업로드 없음)

## Review 담당자가 중점 확인할 것
1. `src/app/search/search-view.tsx`의 `ilikeValue()` — PostgREST 필터 문법 주입 가능성
2. `src/app/admin/write/post-editor.tsx`의 `save()` — slug 중복 처리 흐름, `published_at` 정책, 저장 후 URL 전환(`PostEditorLoader`가 방금 저장한 글을 보관해 다시 조회하지 않음)
3. `src/components/tag-chip.tsx` — 기본값이 링크로 바뀜. `PostCard` 안에서 제목 링크의 `after:inset-0` 오버레이 위에 있는지(`relative z-10` 컨테이너 안에 있음)
4. `scripts/import-users.mjs` — 비밀번호/키가 어떤 경로로도 출력되지 않는지, CSV 파서
5. `AdminGuard`는 UX용일 뿐이고, 모든 쓰기는 RLS(`is_admin()`)에 의존함. 클라이언트 코드에 service role 키가 쓰이지 않음(`scripts/`에서만 사용)

## 사용자가 해야 할 일
1. **계정 일괄 생성**
   ```bash
   # .env.local 에 SUPABASE_SERVICE_ROLE_KEY 주석 해제 후 실제 값 입력
   node scripts/import-users.mjs scripts/users.csv --dry-run   # 확인
   node scripts/import-users.mjs scripts/users.csv             # 실행
   # 열 이름이 다르면: --id-column 학번 --password-column 비밀번호 --name-column 이름
   ```
   관리자 지정은 SQL Editor에서 `update public.profiles set role='admin' where id='…';`
2. **`.gitignore`에 추가 제안**(이번 작업에서는 수정 금지라 제안만): `scripts/*.csv` (또는 `*.csv`). 실행 후 CSV 파일은 지우는 것을 권장
3. **웹앱 등록**: `public/apps/{id}/index.html`을 넣고 `src/data/apps.ts`의 `webApps`에 `{ id, title, description, thumbnail?, tags? }` 추가
4. 실제 Supabase 연결 후 확인: 한글 태그 검색, 특수문자가 들어간 검색어, 발행 토글/삭제, 프로필 수정이 RLS에서 허용되는지
