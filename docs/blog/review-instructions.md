# Review 서브에이전트 지침: 블로그 1차 구현 검증

## 목표
Build A/B가 만든 블로그를 독립적으로 검증하고 `docs/blog/review.md`를 작성한다. **코드는 수정하지 않는다.** 수정은 별도 Build 에이전트가 review.md를 보고 한다.

## 읽을 것
* `CLAUDE.md`, `AGENTS.md`, `docs/blog/spec.md`(§12 우선), `docs/blog/build-a-report.md`, `docs/blog/build-b-report.md`
* `supabase/migrations/20260921000000_init_blog.sql`
* 변경된 코드 전체: `src/**`, `scripts/import-users.mjs`

## 수정 범위
* 작성 가능: `docs/blog/review.md`, 그리고 스크래치 디렉터리의 임시 파일(가짜 서버 등).
* 그 외 파일은 읽기만 한다. 임시로 바꾼 것이 있으면 반드시 원상복구하고 `git status`로 확인한다. git commit/push 금지.

## 검증 항목
1. **빌드**: `npm run lint`, `npm run build` 통과. `out/`에 모든 라우트 존재. 모든 에셋/링크가 `/class1` 기준으로 동작(하드코딩된 `/`-절대경로 탐색: `href="/`, `src="/`, `fetch('/` 등).
2. **브라우저 동작**: `out/`을 `/class1/` 경로로 서빙(예: 임시 디렉터리에 `class1/`로 복사 후 `python3 -m http.server`)해서 각 화면을 확인. 실 Supabase는 연결 불가(`.env.local` 예시값)이므로 필요하면 스크래치 디렉터리에 Supabase REST/Auth를 흉내내는 가짜 서버를 만들고 임시 env로 별도 빌드해 확인한다(원래 `out/`은 마지막에 일반 env로 다시 빌드).
   * 데스크톱 + 모바일 뷰포트(375px), 라이트/다크
   * 콘솔 오류, 404 네트워크 요청
   * 로그인 폼(아이디 → `@class1.local` 변환), 비로그인/사용자/관리자 권한별 UI
   * 글 상세 마크다운 XSS(`<script>`, `onerror`, `javascript:` 링크), 코드 하이라이트
   * 에디터 저장/미리보기/slug, 관리자 목록 토글/삭제, 검색/태그, 웹앱 카드 빈 상태, 프로필 다이얼로그
3. **코드 리뷰**: 버그, 경쟁 상태(조회수 중복, 좋아요 연타), 에러 처리 누락, 세션 만료 처리, 메모리 누수(이벤트/구독 해제), 접근성 기본(레이블, 포커스), 불필요한 중복.
4. **보안/RLS**: 클라이언트 쿼리가 RLS 정책과 맞는지(예: 비관리자에게 초안 노출 불가, 댓글 user_id 위조 불가), service_role key가 클라이언트 번들/저장소에 없는지(`out/`과 `src/` grep), `import-users.mjs`가 비밀번호·키를 출력하지 않는지. 마이그레이션 자체의 문제도 발견하면 기록.
5. **CLAUDE.md 규칙 준수**: 서버 기능 미사용, basePath 규칙, 한국어 UI, 모바일 대응.

## review.md 형식
* 요약(통과/문제 개수)
* 문제 목록 표: 심각도(치명/높음/중간/낮음), 위치(파일:줄), 현상, 재현 방법, 수정 제안
* 확인한 항목과 방법(무엇을 실제로 돌려봤고, 무엇은 가짜 서버라서 확인 못 했는지 명확히)
* 실 Supabase 연결 후 사용자가 직접 확인해야 할 체크리스트
