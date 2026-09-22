# Build 보고: 메뉴 개편 · 자유게시판 · 학습게임 업로드 · 홈 화면

spec.md §13 확정 결정 기준(신고하기 포함, 이미지 첨부 제외, 나머지 열린 질문은 추천안). 커밋/푸시·실 DB 쓰기 없음.

## 변경 파일

**신규**
- `supabase/migrations/20260922040000_community.sql`: `community_posts`/`_comments`/`_likes`/`_reports`, RLS, 컬럼 권한, 트리거(속도 제한·게임 경로 소유 검사), 관리자 RPC(`set_community_post_hidden`, `set_community_comment_hidden`, `set_community_report_status`, `resolve_community_reports_for`), Storage 버킷 `game-uploads`(public, 2MB, **text/plain만 허용**)와 정책(본인 폴더·경로 형식·사용자당 30개). 다시 실행해도 안전함.
- `src/lib/community.ts`: 쿼리, 오류 문구, 파일 검사(.html·2MB·UTF-8·HTML 여부), text/plain 업로드, 텍스트 다운로드, CSP 주입(`buildSandboxDocument`)
- `src/components/community/*`: 목록, 상세, 작성/수정 폼, 게임 업로드 필드, **game-player**(sandbox 실행기), 댓글, 좋아요, 신고 대화상자, 준비 중 안내
- `src/app/board/**`, `src/app/games/{new,post,post/edit}/`, `src/app/admin/(dashboard)/community/`(신고 목록과 글·게임 관리)
- `src/components/dashboard/science-app-status.tsx`, `src/components/illustrations/board-illustration.tsx`

**수정**
- 메뉴: `data/menu.ts`에서 수학 항목을 빼고 자유게시판 추가. 색 토큰 `math`는 `board`로 이름만 바꿈(`globals.css`, `menu-colors.ts`, 기존 사용처 전체).
- 홈 `app/page.tsx`: 섹션을 최근 과학 수업(차시 앱 현황과 과학 글) · 최근 자유게시판 · 학습게임 미리보기 3개로 바꿈.
- 홈 통계 `stat-tile.tsx`: 과학 = 차시 앱 개수(12), 자유게시판·학습게임 = DB 개수, 선생님 글.
- `app/games/page.tsx`: 업로드 게시판으로 바꿈.
- `markdown.ts`/`markdown-viewer.tsx`: 학생 글용 `ugc` 정화 추가(img·미디어·iframe 제거, 링크 rel=noopener nofollow).
- `admin-shell.tsx`: "커뮤니티" 메뉴 추가.

**삭제**: `app/math/`(spec §12-2 추천안: 완전 삭제 → `/math/`는 404), `math-illustration.tsx`, 쓰이지 않게 된 `apps/app-card`·`app-grid`·`popular-posts`

## 업로드 게임 보안
- 업로드 HTML이 렌더링되는 곳은 `GamePlayer` 하나뿐입니다: `<iframe sandbox="allow-scripts" srcdoc>`. `allow-same-origin`, popups, top-navigation, forms, modals는 넣지 않았습니다. Storage 공개 URL, blob URL, `window.open`, "새 탭으로 열기"는 쓰지 않습니다. 업로드 폼의 "미리 해보기"도 같은 실행기를 씁니다.
- CSP meta를 doctype 바로 뒤에 넣습니다(`frame-src 'none'; object-src 'none'; form-action 'none'; base-uri 'none'`). 업로드 HTML에 느슨한 CSP가 있어도 우리 CSP가 함께 적용됩니다.
- 파일은 `text/plain` Blob으로 업로드합니다. 버킷의 `allowed_mime_types`로 서버에서도 강제합니다.

### 공격 테스트 결과
가짜 Supabase를 쓴 실제 Chromium에서 로그인한 상태로 확인했습니다. 결과는 `postMessage`로 수집했습니다.

| 시도 | 결과 |
|---|---|
| `parent.document`, `top.document.cookie`, `parent.localStorage`, `parent.location.href` | SecurityError, 차단 |
| `localStorage` / `sessionStorage` / `indexedDB` / `document.cookie` / `sb-*-auth-token` 읽기 | SecurityError, 차단(origin = "null") |
| `window.open` | null 반환, 차단 |
| `top.location` 변경 | SecurityError, 부모 URL 그대로 |
| `form.submit()`(target=_top) | 이동 없음(about:srcdoc 유지) |
| 중첩 iframe(업로드 CSP로 `frame-src *` 시도) | 우리 CSP의 frame-src 위반으로 차단 |
| `fetch`로 사이트 HTML 읽기 | 실패(불투명 출처라 CORS 차단) |
| `alert` | 대화상자 안 뜸(allow-modals 없음) |
| 부모 쪽 `iframe.contentDocument` | null |

- 정상 게임: canvas 애니메이션(rAF 323프레임), 키보드(방향키 5회), 포인터 입력, CDN 스크립트(jsdelivr canvas-confetti)가 모두 동작했습니다. 정지(iframe 언마운트), 다시 시작, 전체 화면(API가 안 되면 화면 가득 채우기로 대체)도 동작했습니다.
- 거부 확인: 2MB 초과, .txt, 바이너리(UTF-8 아님), .html 이름의 일반 텍스트. mock Storage 기준으로 text/html MIME 업로드는 415, 다른 사람 폴더 업로드는 거부됐습니다.
- 가짜 Storage의 저장 객체 Content-Type은 `text/plain`이었습니다.

## 확인한 것(가짜 Supabase + 정적 빌드 + 브라우저)
- `npm run lint` 통과, `tsc` 통과(스크래치 빌드 기준), `next build` 통과(스크래치 복사본에서 빌드해 개발 서버 `.next`와 충돌하지 않게 함).
- 비로그인 읽기. 로그인 후 글쓰기(마크다운 XSS·javascript: 링크·외부 이미지가 제거됨)와 게임 올리기.
- 본인 수정: 게임 파일을 바꾸면 새 경로에 올리고 옛 파일을 삭제. 본인 삭제.
- 댓글(텍스트로 렌더링), 좋아요, 20초 속도 제한 안내.
- 다른 학생에게는 수정/삭제 버튼이 안 보임. API를 직접 호출해도 차단됨(mock RLS 기준).
- 신고: 글·댓글 신고, 중복 신고 안내. 관리자 신고 목록에서 대상 숨기기(관련 신고 자동 처리 완료), 대상 삭제, 처리 완료.
- 숨긴 글: 다른 학생에게는 "찾을 수 없어요", 작성자에게는 숨김 배지.
- 관리자가 게임을 삭제하면 Storage 파일도 삭제.
- 홈 3개 섹션, 과학 카드 12. 메뉴(사이드바·드로어). `/math/` → 404.
- SQL 실행 전 상태에서 목록·홈·통계 카드가 "준비 중(SQL 실행 필요)"으로 표시됨.
- 375px·768px에서 가로 스크롤 없음(홈 과학 섹션 넘침은 고침), 다크 모드. 정상 흐름에서 새 콘솔 오류 0(일부러 실행한 거부 테스트의 4xx만 있음).

## 못 한 것
- **SQL을 실제 Postgres에서 실행해 보지 못했습니다**(로컬 Postgres 없음). RLS는 mock에서 같은 규칙으로 흉내 냈을 뿐입니다.
- 실제 Supabase Storage의 `allowed_mime_types` 비교 방식(charset이 붙은 경우)과 응답 헤더는 확인하지 못했습니다.
- 실기기 터치(태블릿/iOS 전체 화면)는 에뮬레이션으로만 확인했습니다.

## 사용자가 할 일
1. Supabase SQL Editor에서 `supabase/migrations/20260922040000_community.sql`을 한 번 실행하고, 파일 머리말의 확인 쿼리를 실행합니다.
2. Storage > `game-uploads`에서 public, 2MB, 허용 MIME `text/plain`인지 확인합니다.
3. 게임을 하나 올린 뒤 그 객체의 공개 URL(`…/storage/v1/object/public/game-uploads/…`)을 새 탭에서 직접 열어, **HTML로 실행되지 않고 텍스트로 보이는지** 확인합니다.
4. 배포 후 실제 AI 게임 1~2개로 플레이, 정지, 전체 화면을 눈으로 확인합니다.
