# Review 서브에이전트 지침: 프론트엔드 디자인 개편

## 목표
Build 결과가 `docs/design/spec.md`(§12 확정 결정 포함)대로 동작하는지 검증하고 `docs/design/review.md`를 작성한다. 문제가 있으면 직접 고친다.

## 먼저 읽을 것
* `CLAUDE.md`, `AGENTS.md`, `docs/design/spec.md`, `docs/design/build-instructions.md`, `docs/design/build-report.md`
* `git status` / `git diff`로 변경 전체

## 수정 범위
* 작성: `docs/design/review.md`
* 버그 수정은 Build 범위(`build-instructions.md`의 수정 범위)의 파일만. `supabase/`, `public/apps/`, `next.config.ts`, `package.json`은 건드리지 않는다. git commit 하지 않는다.

## 검증 항목
1. **코드 리뷰**: 정적 export 제약 위반(서버 기능, 동적 세그먼트, basePath 하드코딩), hydration mismatch 가능성, `use client` 경계, Tailwind 동적 클래스, 접근성(aria-current/expanded/label, 포커스), 미사용 코드, 기존 기능(글 상세·검색·로그인·관리자) 회귀.
2. `npm run lint`, `npm run build` 통과. `out/`에 `index.html`, `games/`, `science/`, `math/` 존재.
3. **브라우저 검증** — 브라우저 도구(`mcp__Claude_Browser__*`)를 쓸 수 있으면 `preview_start {name: "blog-dev"}`로 dev 서버를 띄워 `http://localhost:3000/class1/`에서 확인한다(Bash로 서버를 띄우지 않는다). 도구를 쓸 수 없으면 그 사실을 review.md에 적고 코드 리뷰에 집중한다(메인 에이전트가 브라우저 검증을 이어서 한다).
   * build-report.md의 "Review가 확인할 점" 9개 항목 전부
   * spec §10의 체크리스트: 데스크톱(1280), 태블릿(768), 모바일(375), 라이트/다크
   * 콘솔 오류·경고(hydration 포함), 네트워크 실패 요청
   * 모바일에서 가로 스크롤이 생기지 않는지
4. **디자인 품질**: "초등 6학년 대상, 깔끔하고 귀여운" 느낌이 나는지. 일러스트가 어색하거나 깨져 보이는 곳, 색 대비가 부족한 곳, 여백이 어색한 곳을 스크린샷으로 확인하고 고친다.
5. RLS: 스키마 변경이 없으므로 새 쿼리(`posts` count, `views` 조회)가 기존 공개 읽기 정책 안에서만 동작하는지 마이그레이션과 대조해 확인한다.

## review.md 형식
* 요약(통과/조건부/실패)
* 발견한 문제 표: 심각도(상/중/하), 위치(`파일:줄`), 설명, 조치(수정함/미수정+이유)
* 검증 결과(lint/build/브라우저 항목별)
* 남은 제안(선택)
