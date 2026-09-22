# Build 서브에이전트 지침: sci-6-1-2-6

## 목표
승인된 `public/apps/sci-6-1-2-6/spec.md`(**확정 결정 절 우선**)대로 조사 도우미 앱을 만든다.

## 공통 틀
공통 틀 `scripts/templates/science-guide/`를 복사해 쓴다. 틀은 수정하지 않는다.

## 반드시 먼저 읽을 것
* `CLAUDE.md` — 웹앱 규칙, **과학 차시 앱 규칙** 전체.
* `public/apps/sci-6-1-2-6/spec.md`
* 공통 틀 README `scripts/templates/science-guide/README.md`
* 본보기: 1단원 완성 앱(`public/apps/sci-6-1-1-3/`, `sci-6-1-1-6/`)의 코드와 `review.md`, `fix-1-report.md` — 리뷰에서 반복된 문제를 처음부터 피한다: **힌트가 답을 말함, 발전 질문이 분석 질문과 겹침, 빨리 감기·단순화 미표시, 수업 목표 활동 누락, 세로 화면에서 3D가 화면 밖, WebGL 미해제, 학생 입력 innerHTML 삽입, 색만으로 정보 전달**.
* `scripts/templates/class1-record.js` — 앱 폴더로 복사해 결과 저장 연결. `config.js`는 1단원 앱과 같은 형식(anon key만).

## 핵심
* 과학적 사실·수치는 spec의 정확성 체크리스트와 확정 결정 값만 사용. 지도서 확인이 필요하면 `~/Library/CloudStorage/GoogleDrive-sunkyboy@pen.go.kr/내 드라이브/오션초2026/수업/교과서 usb자료/과학 지도서 물체의 운동.pdf` (`python3`의 `fitz`, 인쇄 쪽 ↔ PDF 쪽 오프셋은 직접 확인).
* 다음 차시 용어·내용 스포일러 금지(spec 참고, 예: 탐구 3·4에서 "속력" 금지).
* 블로그로 돌아가기 링크: `../../science/?term=6-1&unit=2&lesson=7`.
* 모든 참조 상대경로, 외부 라이브러리는 1단원 앱과 같은 three.js·supabase-js CDN(같은 버전+SRI)만.

## 수정 범위
* 수정 가능: `public/apps/sci-6-1-2-6/**`(단 `spec.md`, `*-instructions.md` 수정 금지).
* 그 외 수정 금지. git commit/push·실 DB 쓰기 금지.

## 작업 환경
* 브라우저 창은 다른 에이전트와 공유한다. **자기 탭을 새로 열어(tabs_create) 그 tabId만** 쓰고 다른 탭은 건드리지 않는다. `localStorage.clear()` 금지(자기 앱 키만 삭제). 탭을 쓸 수 없으면 headless 브라우저를 쓰고 끝날 때 프로세스 종료.
* 개발 서버 `http://localhost:3000/class1/apps/sci-6-1-2-6/index.html` (이미 실행 중일 수 있음).
* 임시 파일은 스크래치 디렉터리에만, 끝나면 삭제.

## 검증
전체 흐름 끝까지: 태블릿 가로(1024×768)·세로(768×1024), 휴대폰 375px(가로 스크롤 없음), 다크모드, 새로고침 복원, 앞 단계 이동·다시 하기, 콘솔 오류 0. 저장 호출은 가짜 응답으로.

## 완료 보고
`public/apps/sci-6-1-2-6/build-report.md`: 파일 목록, spec과 다른 점, 확인한 것/못 한 것.
