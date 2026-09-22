# Build(수정) 서브에이전트 지침: 공통 틀 2종 + sci-6-1-2-2 + sci-6-1-2-6 review 1차 수정

## 순서
1. **`scripts/templates/science-sim/` 수정** (하위 호환 필수 — 1·2단원 실험 앱 9개가 그대로 동작해야 함):
   * `experiment.js`: 기록 전에 학생 입력을 검증하는 **공식 훅**(예: config의 `validateRecord(values, ctx)` 또는 `beforeRecord`)과 확인 버튼 UI를 추가해, 앱이 틀의 DOM 구조에 의존하지 않게 한다.
   * `persist.js`: 입력 저장 디바운스(250ms) 중 새로고침·탭 닫기 시 마지막 입력이 사라지지 않게 `pagehide`/`visibilitychange`에서 즉시 저장.
   * README 갱신.
2. **`scripts/templates/science-guide/` 수정**:
   * `worksheet.js`: 비교표 매칭이 부분 문자열로 오판하는 문제(sci-6-1-2-6 review: '장치', '계단'↔'자동계단') — 정규화한 이름의 정확 일치 또는 config에 별칭(aliases) 목록을 두는 방식으로. 오판 결과가 저장 기록에 들어가지 않게.
   * 필드 이름 뒤 조사 자동 부착('이')을 받침 유무에 따라 이/가로 고르게.
   * 행 중복(같은 내용 반복) 검사 옵션.
   * `persist.js`는 science-sim과 같은 수정(두 틀의 공통 파일은 동일 유지).
   * README 갱신.
3. **sci-6-1-2-2**: 새 공통 틀을 앱 폴더 `science-sim/`에 복사하고, 틀 DOM 의존 코드를 새 훅으로 교체. `review.md`의 치명·주요·중간·경미 문제 전부 수정 — 특히 A1(발전 질문 본문에 모범 답안 포함), **A2(학생이 "N초 동안 A에서 B로 이동했습니다" 문장을 직접 쓰게, 앱은 검증만)**, A3(도착 칸 발자국이 꽃에 가림).
4. **sci-6-1-2-6**: 새 science-guide 틀을 앱 폴더에 복사하고(필드명 우회 복원 가능하면 원래 '설치 위치'로), `review.md`의 문제 전부 수정 — 정답 위치 쏠림, 발전 질문 1 모범 답안이 2의 답을 누설, 같은 내용 4행 통과 등.
5. 다른 앱 폴더의 틀 사본은 **건드리지 않는다**(코디네이터가 동기화 후 전체 점검). 대신 1단원 앱 1개 이상(sci-6-1-1-1, sci-6-1-1-5)을 스크래치에 복사해 새 틀로 동작하는지 확인하고 보고.

## 수정 범위
`scripts/templates/science-sim/**`, `scripts/templates/science-guide/**`, `public/apps/sci-6-1-2-2/**`, `public/apps/sci-6-1-2-6/**`.

## 공통 원칙
* 힌트는 답을 말하지 않는다. 발전 질문은 앞의 분석 질문·피드백·질문 본문에서 답이 나온 내용을 반복하지 않는다. 보기 순서는 정답 위치가 한쪽으로 쏠리지 않게.
* 학생 화면에 "지도서"라는 말을 쓰지 않는다(교사용 자료).
* 수업 목표 활동(지도서 차시 목표·실험관찰 활동)이 빠지지 않게 한다. 학생이 직접 표현·작성해야 하는 활동을 앱이 대신 하지 않는다.
* 과학적 사실은 지도서 원문으로 재확인: `~/Library/CloudStorage/GoogleDrive-sunkyboy@pen.go.kr/내 드라이브/오션초2026/수업/교과서 usb자료/과학 지도서 물체의 운동.pdf` (인쇄 쪽 ≈ PDF 쪽 + 179~180, 앞뒤 확인), `python3`의 `fitz`.

## 작업 환경
* 브라우저는 공유된다. **자기 탭(tabs_create)** 또는 **자기 전용 headless 브라우저(겹치지 않는 포트)**만 사용, 다른 탭·프로세스 건드리지 않기, 끝나면 종료. `localStorage.clear()` 금지.
* 개발 서버 `http://localhost:3000/class1/apps/<앱>/index.html`.
* 임시 파일은 스크래치에만. git commit/push·실 DB 쓰기 금지. `spec.md`, `*-instructions.md`, `review.md`, `build-report.md` 수정 금지.

## 검증
전체 흐름 끝까지: 태블릿 가로·세로, 375px(가로 스크롤 없음), 다크모드, 새로고침 복원, 콘솔 오류 0, `?no3d=1`, 세로 화면에서 애니메이션 보임 (sci-6-1-2-2).

## 완료 보고
앱 폴더마다 `fix-1-report.md`: 항목별 처리(파일:줄), 제안과 다르게 한 것.
