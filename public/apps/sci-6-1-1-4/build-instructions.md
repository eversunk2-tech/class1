# Build 서브에이전트 지침: sci-6-1-1-4

## 목표
승인된 `public/apps/sci-6-1-1-4/spec.md`(확정 결정 절 우선)대로 실험 시뮬레이션 앱을 만든다.

## 공통 틀
공통 틀은 **수정하지 않는다**(다른 에이전트가 동시에 확장 중). 현재 틀을 복사해 쓰고, 틀에 필요한 기능이 있으면 앱 전용 코드로 처리하거나 보고서에 적는다.

## 반드시 먼저 읽을 것
* `CLAUDE.md` — 웹앱 규칙, **과학 차시 앱 규칙** 전체.
* `public/apps/sci-6-1-1-4/spec.md`
* 본보기: 시범 앱 `public/apps/sci-6-1-1-2/`(코드, `review.md`, `fix-1-report.md` — 지적된 문제를 반복하지 말 것: 세로 화면에서 3D가 화면 밖, WebGL 해제, 용어 소개 순서, 색만으로 정보 전달, innerHTML에 학생 입력 삽입 등)
* 공통 틀 README (`scripts/templates/science-sim/README.md`)
* `scripts/templates/class1-record.js` — 앱 폴더로 복사해 결과 저장 연결. `config.js`는 시범 앱 것과 같은 형식(anon key만).

## 핵심
* 과학적 사실은 spec의 정확성 체크리스트 값만 사용. 지도서 확인이 필요하면: `~/Library/CloudStorage/GoogleDrive-sunkyboy@pen.go.kr/내 드라이브/오션초2026/수업/교과서 usb자료/과학 지도서 산과염기.pdf` (인쇄 쪽 = PDF 쪽 + 103), `python3`의 `fitz`.
* 이 단원에서 pH·중성·중화 용어 금지(지도서 106쪽).
* 블로그로 돌아가기 링크: 시범 앱과 같은 방식(`../../science/?term=6-1&unit=1&lesson=<lesson id>`; lesson id는 `src/data/science-curriculum.ts` 참고).
* 모든 참조 상대경로, 외부 라이브러리는 three.js·supabase-js CDN(시범 앱과 같은 버전+SRI)만.

## 수정 범위
* 수정 가능: `public/apps/sci-6-1-1-4/**`(단 `spec.md`, `*-instructions.md` 수정 금지).
* 그 외 수정 금지(`src/**`, `CLAUDE.md` 등). git commit/push 금지. 실 DB 쓰기 금지.
* 임시 파일은 스크래치 디렉터리에만 두고 끝나면 삭제, 띄운 서버는 끝나면 종료.

## 검증
브라우저로 전체 흐름을 끝까지: 태블릿 가로(1024×768)·세로(768×1024), 휴대폰 375px(가로 스크롤 없음), 다크모드, 새로고침 복원, 앞 단계 이동·다시 하기, `?no3d=1` 2D 대체, 3D↔2D 반복 전환, 콘솔 오류 0. (`next dev`에서는 폴더 URL이 404일 수 있으니 `.../index.html`로 연다.) 비로그인 흐름 + 저장 호출은 가짜 응답으로 확인.

## 완료 보고
`public/apps/sci-6-1-1-4/build-report.md`: 파일 목록, spec과 다른 점, 확인한 것/못 한 것.
