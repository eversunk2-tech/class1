# Build(수정) 서브에이전트 지침: 조사 도우미 공통 틀 + sci-6-1-1-5 + sci-6-1-1-6 review 1차 수정

## 목표
1. 공통 틀 `scripts/templates/science-guide/`의 버그를 고친다: `topic-picker`의 375px 가로 스크롤, `worksheet` 고정 모드 안내 문구(두 리뷰의 D2/D3 등). 틀 README도 갱신.
2. 고친 틀을 두 앱의 `science-guide/` 사본에 다시 복사하고, sci-6-1-1-6에 있던 앱 전용 임시 패치(같은 버그 우회 CSS/코드)는 제거한다.
3. `public/apps/sci-6-1-1-5/review.md`, `public/apps/sci-6-1-1-6/review.md`의 **치명·주요·중간·경미 문제를 모두** 수정한다(참고 항목은 판단). 특히 5의 잘못된 분류에 "✔ 있어요"가 뜨는 문제(주요), 6의 산호 백화 원인(수온 상승이 주원인, 지도서 159쪽 원문 확인).

## 수정 범위
`scripts/templates/science-guide/**`, `public/apps/sci-6-1-1-5/**`, `public/apps/sci-6-1-1-6/**`. `science-sim` 틀은 수정 금지.

## 공통 원칙 (이번 리뷰에서 반복된 문제)
* **힌트는 답을 말하지 않는다.** 생각할 방향만 준다. 모든 힌트를 다시 점검한다.
* 발전 질문은 분석 질문·피드백에서 이미 답이 나온 내용을 반복하지 않는다.
* 단순화·빨리 감기 연출은 화면에 "모형"/"빨리 감기"로 명시한다.
* 수업 목표 활동(지도서 차시 목표)이 빠지지 않게 한다.
* 과학적 사실은 지도서 원문으로 다시 확인한다: `~/Library/CloudStorage/GoogleDrive-sunkyboy@pen.go.kr/내 드라이브/오션초2026/수업/교과서 usb자료/과학 지도서 산과염기.pdf` (인쇄 쪽 ≈ PDF 쪽 + 103~104, 앞뒤 확인), `python3`의 `fitz`.

## 규칙
* `CLAUDE.md` 과학 차시 앱 규칙 준수. pH·중성·중화 금지.
* 브라우저 창은 공유된다. **자기 탭을 새로 열어(tabs_create) 그 tabId만 사용.** 개발 서버 `http://localhost:3000/class1/apps/<앱>/index.html` 사용 가능. 탭을 못 쓰면 headless 브라우저 사용 가능하나 띄운 프로세스는 끝날 때 종료.
* 임시 파일은 스크래치 디렉터리에만, 끝나면 삭제. 테스트용 localStorage 키 삭제.
* git commit/push·실 DB 쓰기 금지. `spec.md`, `*-instructions.md`, `review.md`, `build-report.md` 수정 금지.

## 검증
브라우저로 전체 흐름 끝까지: 태블릿 가로·세로, 375px(가로 스크롤 없음), 다크모드, 새로고침 복원, 콘솔 오류 0.

## 완료 보고
각 앱 폴더에 `fix-1-report.md`: 항목별 처리(파일:줄), 제안과 다르게 한 것.
