# Build 공통 지침: 6학년 2학기 1단원 시뮬레이션 앱 (2026-09-22, 사용자 승인)

앱 4개(sci-6-2-1-2 ~ 5)를 **서로 다른 Build 서브에이전트가 동시에** 만든다. 자기 앱 폴더만 다룬다.

## 반드시 먼저 읽을 것
* `CLAUDE.md` — 웹앱 규칙, **과학 차시 앱 규칙** 전체(측정 규칙 2026-09-22 개정 포함).
* 자기 앱 `spec.md` — **맨 끝 "개정 1" 절이 본문보다 우선**, 그다음 "Claude 검토 메모".
* 공통 틀 `scripts/templates/science-sim/README.md`와 각 파일 맨 위 주석(특히 "로그인 필수 · 진행 상황 DB 저장" 절).
* 본보기(새 기준으로 만든 앱): `public/apps/sci-6-1-2-3/`, `sci-6-1-2-4/`, `sci-6-1-2-5/` — `index.html`, `app.js`, `data/lesson-config.js`, `slim-review.md`, `slim-fix-report.md`. 리뷰에서 반복된 문제를 처음부터 피한다: 힌트가 답을 말함, 빨리 감기·단순화("모형") 미표시, 수업 목표 활동 누락, 세로 화면에서 3D가 화면 밖, WebGL 미해제, 학생 입력 innerHTML 삽입, 색만으로 정보 전달, 다음 차시 스포일러.

## 공통 틀
* `scripts/templates/science-sim/` → 앱의 `science-sim/`로 통째 복사, `scripts/templates/class1-record.js` → 앱 폴더로 복사, `config.js`는 본보기 앱과 같은 내용(anon key만).
* **공통 틀(정본과 사본)은 수정하지 않는다**(4개 에이전트가 동시에 작업). 시간 바·각도 슬라이더·달 바·값 패널 등 새 UI는 **앱 전용 코드**(app.js, 앱 style.css, view 안)로 만든다. 공통 틀 변경이 꼭 필요하면 만들지 말고 보고서에 적는다.
* three.js 0.169.0·supabase-js 2.116.0 CDN은 본보기 앱과 같은 URL+SRI만.
* 저장 키: spec의 `sci621simN:v1`.

## 핵심 요구
* 측정값은 spec 값만(개정 1의 표). 학생이 값을 타이핑하지 않고 값 패널/관찰 카드에 바로 보이며 **기록하기**로 저장. 소수 첫째 자리 표시(탐구 3 낮의 길이는 "○시간 ○분", 탐구 4 빛의 세기는 정수).
* 슬라이더류 조작: 터치 드래그·마우스·키보드(←/→) 모두, 44px 이상 손잡이, `aria-valuetext`로 현재 값 읽기. 드래그 중 3D 갱신은 requestAnimationFrame으로 묶어 버벅이지 않게.
* 3D 장면 드래그 회전과 슬라이더 드래그가 서로 간섭하지 않게.
* 로그인 필수·진행 저장·로그아웃 삭제·완료 저장(`detail.qa` 포함)은 공통 틀 그대로 연결.
* 학생 화면에 "지도서" 금지(출처: "교과서·실험관찰"). 단순화·추정값은 "모형"/"모형(추정)" 표시.
* 블로그로 돌아가기 링크: `../../science/?term=6-2&unit=1&lesson={lesson id}`.

## 수정 범위
* 자기 앱 폴더 `public/apps/{앱}/**`만(단 `spec.md`, `*-instructions.md` 수정 금지). 그 외 모든 파일 수정 금지. git commit/push·실 DB 쓰기 금지.

## 작업 환경
* 개발 서버: `http://localhost:3000/class1/apps/{앱}/index.html`(이미 실행 중. 없으면 알리고 멈춤 — 직접 띄우지 않는다).
* 브라우저는 공유된다: **자기 탭을 새로 열어(tabs_create) 그 tabId만** 쓰거나, 자기 전용 headless 브라우저(겹치지 않는 포트)만 쓴다. 다른 탭·프로세스를 건드리지 않고, `localStorage.clear()` 금지(자기 앱 키만 삭제). 끝나면 자기 탭을 닫는다.
* 로그인 상태 테스트는 가짜 세션/가짜 Supabase 응답(fetch 가로채기 등)으로. 실 DB에 쓰지 않는다.
* 임시 파일은 스크래치 디렉터리(`/private/tmp/claude-501/-Users-sungchul-Desktop-classroom/f1b62131-752e-439d-a427-f0c4876f6afe/scratchpad/build-{앱}/`)에만, 끝나면 삭제.

## 검증
전체 흐름 끝까지: 태블릿 가로(1024×768)·세로(768×1024), 휴대폰 375px(가로 스크롤 없음), 다크모드, 새로고침 복원, 앞 단계 이동·다시 하기, `?no3d=1` 2D 대체, 3D↔2D 반복 전환, 슬라이더 끝값·중간값, 기록 값이 spec 표와 정확히 같은지, 콘솔 오류 0. 흐름을 실제로 진행하며 **소요 시간을 재서** 보고.

## 완료 보고
`public/apps/{앱}/build-report.md`: 파일 목록, spec과 다른 점, 측정 소요 시간, 확인한 것/못 한 것. 최종 응답은 10줄 이내 요약.
