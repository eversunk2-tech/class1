# Build(수정) 서브에이전트 지침: 커뮤니티 review 1차 수정

## 목표
`docs/community/review.md`의 **중간·낮음 문제를 모두** 수정한다(참고는 판단). 기준: `docs/community/spec.md`(§13 우선), `CLAUDE.md`.

## 특히
* **M1**: `game-uploads` 버킷을 **비공개**로 바꾸고, Storage `select` 정책을 "연결된 게임 글이 숨겨지지 않았거나, 요청자가 작성자·관리자"일 때만 허용(비로그인 읽기 허용 여부는 게시판 읽기 원칙과 맞출 것). 파일 목록 조회로 다른 사람 파일이 드러나지 않게. 클라이언트는 공개 URL 대신 `download()`(또는 서명 URL)로 텍스트를 받아 srcdoc에 넣는다. SQL은 아직 사용자가 실행하지 않았으므로 **같은 마이그레이션 파일(`20260922040000_community.sql`)을 수정**해도 된다(재실행 안전 유지).
* **L1 (CSP 무력화)**: 업로드 HTML 앞에 CSP meta를 붙이는 방식이 주석 파싱 차이로 우회되지 않게 설계를 바꾼다(예: 부모가 만든 고정 래퍼 문서에 CSP를 먼저 두고, 게임 HTML은 파싱 차이가 생기지 않는 방식으로 넣기 — 중첩 sandbox iframe의 srcdoc 등). 샌드박스(`allow-scripts`만, same-origin 없음)는 그대로 유지. 우회 재현 파일로 다시 시험.
* **L2 (iPad 무한 루프)**: 가능한 완화책(예: 게임을 처음엔 멈춘 상태로 두고 "게임 시작" 버튼, 탭이 멈추면 새로고침 안내, 업로드 안내문에 주의) 적용. 실제 기기 확인이 불가하면 한계로 명시.
* L3~L6 전부.

## 수정 범위
`src/**`, `supabase/migrations/20260922040000_community.sql`. 그 외 금지. git commit/push·실 DB/Storage 쓰기 금지.

## 검증
lint·tsc·`npm run build`. 가짜 Supabase/Storage로: 숨긴 게임 파일 비로그인·다른 학생 조회 거부, 작성자·관리자 조회 가능, 게임 실행(다운로드 → srcdoc), 샌드박스 공격 테스트 재실행(L1 우회 파일 포함), 정상 게임 실행, 좋아요·신고 수정 사항. 태블릿·375px·다크모드, 콘솔 오류 0. 브라우저는 자기 탭 또는 자기 전용 headless만, `localStorage.clear()` 금지. 임시 파일은 스크래치에만.

## 완료 보고
`docs/community/fix-1-report.md`: 항목별 처리(파일:줄), 보안 재시험 결과, 사용자가 할 일(SQL 실행, 버킷 설정 확인 방법).
