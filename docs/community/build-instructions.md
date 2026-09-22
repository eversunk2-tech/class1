# Build 서브에이전트 지침: 메뉴 개편 · 자유게시판 · 학습게임 업로드 · 홈 화면

## 목표
승인된 `docs/community/spec.md`(**§13 확정 결정 우선** — 신고하기 포함, 이미지 첨부 제외)의 구현 단계를 모두 구현한다.

## 먼저 읽을 것
`CLAUDE.md`, `AGENTS.md`(Next.js 16 → `node_modules/next/dist/docs/`), `docs/community/spec.md` 전체, 관련 기존 코드(메뉴·레이아웃·홈·과학·게임·수학 페이지, 글/댓글/좋아요 컴포넌트, 관리자 화면, `src/lib/markdown.ts`).

## 핵심 요구
* **업로드 게임 보안이 최우선**(spec §4): `iframe sandbox="allow-scripts"`만(allow-same-origin 등 금지) + `srcdoc`, Storage 객체 `text/plain` 강제, CSP meta 주입, 크기·형식 검사(클라이언트 + Storage 버킷 제한 + DB/RLS), 정지 버튼. 업로드 HTML을 사이트 출처에서 직접 렌더링하는 경로가 하나도 없어야 한다(`dangerouslySetInnerHTML`, blob URL same-origin, `window.open` 등 금지).
* 자유게시판·게임 본문·댓글·신고 사유 등 사용자 입력은 텍스트로 렌더링(마크다운을 쓰면 DOMPurify 필수).
* 새 SQL: `supabase/migrations/20260922040000_community.sql`(spec §5 + 신고 테이블·RLS·RPC + Storage 버킷/정책), 재실행 안전, 기존 테이블·정책 불변. **실행은 사용자가 한다** — 테이블이 없으면 화면은 "준비 중(SQL 실행 필요)" 안내로 깨지지 않게.
* 수학수업 메뉴·페이지 제거, 기존 `/math/` 접근 처리(spec대로), 자유게시판 메뉴 추가, 사이드바·드로어·홈 카드.
* 홈: 최근 소식·인기글·최근 수학 수업 제거, **최근 과학 수업(차시 앱 현황) · 최근 자유게시판 · 학습게임 미리보기** 3개만, 과학수업 카드 숫자는 차시 앱 개수 기준(spec 추천).
* 관리자: 숨기기/삭제, 신고 목록 화면.
* 작성 속도 제한·글자 수 제한 등 남용 방지.

## 수정 범위
`src/**`, `supabase/migrations/20260922040000_community.sql`(신규), `public/`의 블로그용 파일(필요 시; `public/apps/**` 제외). 기존 마이그레이션·`CLAUDE.md`·앱 폴더 수정 금지. git commit/push·**실 DB 쓰기 금지**.

## 검증
* lint·tsc·`npm run build` 통과(개발 서버 산출물 충돌 주의).
* 가짜 Supabase(fetch 가로채기/스크래치 mock, Storage 포함)로: 비로그인 읽기·로그인 작성·본인 수정/삭제·관리자 숨기기/삭제·신고 흐름·댓글·좋아요·홈 3섹션·메뉴·/math/ 처리.
* **게임 샌드박스 공격 테스트**: 업로드 HTML에서 `parent.document`, `top.location`, `localStorage`, `document.cookie`, `window.open`, 폼 제출, `sb-*-auth-token` 읽기 시도 → 모두 실패해야 함. 정상 게임(canvas 애니메이션, 키보드·터치 입력, CDN 스크립트) 실행 확인. 2MB 초과·비HTML 거부.
* 태블릿·375px·다크모드, 콘솔 오류 0. 브라우저는 자기 탭 또는 자기 전용 headless만, `localStorage.clear()` 금지. 임시 파일은 스크래치에만.

## 완료 보고
`docs/community/build-report.md`: 변경 파일, 보안 테스트 결과, 확인한 것/못 한 것, 사용자가 할 일(SQL 실행, Storage 설정 확인).
