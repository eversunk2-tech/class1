# Review 서브에이전트 지침: 자유게시판 · 학습게임 업로드 · 신고 · 메뉴/홈 개편

## 목표
`docs/community/spec.md`(§13 우선)대로 구현됐는지 독립적으로 검증하고 `docs/community/review.md`를 작성한다. **코드는 수정하지 않는다.**

## 읽을 것
`CLAUDE.md`, `docs/community/spec.md`, `build-instructions.md`, `build-report.md`, `git diff HEAD`와 새 파일 전부(특히 `supabase/migrations/20260922040000_community.sql`, 게임 플레이어·업로드 코드, 게시판·댓글·신고 코드, 관리자 커뮤니티 화면, 메뉴·홈).

## 검증 항목 (보안 최우선)
1. **업로드 게임 샌드박스**: 업로드 HTML이 사이트 출처로 실행되는 경로가 있는지 코드 전수 확인(srcdoc 외 경로, blob/data URL, `dangerouslySetInnerHTML`, `window.open`, 미리보기·썸네일·관리자 화면·신고 화면 등 모든 곳). sandbox 속성 값, CSP meta 주입이 우회되는지(업로드 HTML이 `<head>` 앞에 무엇을 둘 수 있는지), 공격 테스트를 직접 재실행(부모 DOM·top.location·localStorage·cookie·세션 토큰·팝업·폼·중첩 iframe·`postMessage`로 부모 조작·무한 루프/메모리 폭주 시 정지 버튼 동작). Storage 공개 URL이 브라우저에서 HTML로 렌더링되지 않는지(Content-Type 강제가 업로드 경로에서 실제로 적용되는지, 클라이언트가 content-type을 바꿔 올릴 수 있는지 — 버킷 `allowed_mime_types`·RLS로 막히는지).
2. **SQL/RLS (로컬 Postgres 없음 — 코드로 꼼꼼히)**: 문법 오류 가능성, 재실행 안전성, 기존 객체와 이름 충돌, 로그인 사용자 작성·본인 수정/삭제·`hidden` 변경 불가(관리자 RPC만), 숨긴 글 노출 범위, 신고 조회 범위(관리자·신고자 본인), 속도 제한 우회, Storage 정책(업로드 경로에 본인 id 강제, 남의 파일 덮어쓰기·삭제 불가, 크기 제한), `security definer` 함수의 `search_path`·권한 검사, anon 권한. 실 DB에는 anon key로 읽기와 거부되어야 할 요청만.
3. **XSS**: 게시판 본문(마크다운이면 DOMPurify 설정), 제목, 댓글, 신고 사유, 작성자 이름, 게임 제목·설명.
4. **기능**: 메뉴(수학 제거·자유게시판 추가, 사이드바·드로어), `/math/` 처리, 홈 3섹션과 과학 앱 개수·차시 앱 현황, 게시판·게임 CRUD·댓글·좋아요·신고·관리자 숨기기/삭제/처리, SQL 실행 전 "준비 중" 안내, 기존 기능 회귀(블로그 글·과학 앱·관리자 다른 화면).
5. 빌드·lint·tsc, 태블릿·375px·다크모드, 콘솔 오류.

## 작업 환경
브라우저는 자기 탭 또는 자기 전용 headless만, 다른 탭·프로세스 건드리지 않기, `localStorage.clear()` 금지. 임시 파일은 스크래치에만. `docs/community/review.md`만 작성. git 조작·실 DB/Storage 쓰기 금지.

## 형식
요약(심각도별 개수) / 보안 테스트 표(공격, 방법, 결과) / 문제 표(심각도, 위치 파일:줄, 현상, 재현, 수정 제안) / 확인한 것 vs 못 한 것.
