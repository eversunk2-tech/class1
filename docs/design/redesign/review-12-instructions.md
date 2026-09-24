# Review 지침: 디자인 개편 1·2단계 (2026-09-24)

Build와 **독립적으로** 검증한다. **코드는 고치지 않는다.** 결과는 `docs/design/redesign/review-12.md` 하나.

## 읽을 것
`CLAUDE.md`, `docs/design/redesign/spec.md`(끝 "개정 1"), `build-1-instructions.md`, `build-1b-instructions.md`, `build-2-instructions.md`, `build-1-report.md`, `build-2-report.md`, 그리고 커밋 `a33c9cf`, `5cc6cf4`의 변경(`git show --stat`, `git diff a33c9cf~1..HEAD` — 읽기만).

## 검증 항목
1. **기능 회귀(최우선)**: 겉모양만 바뀌고 동작은 그대로인지. 로그인·로그아웃·잠금 안내, 글·댓글·좋아요·신고, 게임 업로드·실행(**샌드박스 iframe·CSP 래퍼·"게임 시작" 구조가 전과 동일한지 diff로 확인**), 과학수업 차시→앱 열기 링크(basePath 포함), 내 학습 활동·피드백, 검색, 관리자 화면(공용 컴포넌트 변경 영향), 404.
2. **저작권·출처**: 참고 사이트(똑똑! 수학탐험대)의 그림·로고·문구가 들어가지 않았는지. 3D 아이콘 MIT 고지(`public/illustrations/3d/LICENSE-fluent-emoji.txt`), Pretendard OFL 고지(`public/fonts/LICENSE-pretendard-OFL.txt`)가 있는지.
3. **정적 export·basePath**: `npm run build` 결과 `out/`에서 이미지·글꼴 경로가 `/class1/...`로 맞는지(배포와 같은 조건으로 정적 서버에 `/class1` 경로로 띄워 확인). 절대경로 하드코딩 여부.
4. **접근성**: 대비 AA(밝음·어두움), 색만으로 정보 전달 여부, 키보드 초점, `prefers-reduced-motion`, 이미지 `alt`/`aria-hidden`.
5. **반응형·성능**: 1440·1024×768·768×1024·375, 가로 스크롤, 레이아웃 밀림(CLS), 첫 화면 이미지 용량·개수, 글꼴 요청 수.
6. **학생 화면 규칙**: "지도서"라는 말이 학생 화면에 없는지, 내 학습 활동에서 앱 이름이 "삭제된 앱"이 아니라 차시 제목으로 나오는지.

## 작업 환경
자기 전용 headless 브라우저·자기 포트 정적 서버만. 로그인 상태는 가짜 세션·가짜 Supabase 응답(실 DB 쓰기 금지). git은 읽기만(`log/show/diff`), 커밋·체크아웃 금지. `localStorage.clear()` 금지. 끝나면 서버·브라우저 종료.

## 형식
요약(심각도별 개수) / 문제 표(심각도, 위치 파일:줄, 현상, 재현, 수정 제안) / 확인한 것 vs 못 한 것. 최종 응답 10줄 이내 한국어.
