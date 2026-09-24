# Build 지침: 디자인 개편 3단계 — 과학 앱 공통 틀 겉모양 (2026-09-24 사용자 승인)

설계: `docs/design/redesign/spec.md` §6(+ 끝 "개정 1": 과학 앱 글꼴은 **CDN**, 앱 23개 **전부** 포함). 사이트(1·2단계, 이미 배포됨)와 같은 인상으로 과학 앱의 **색·글꼴·버튼·카드·단계 막대 모양만** 바꾼다.

## 수정 범위
* 정본: `scripts/templates/science-sim/style-common.css`, `scripts/templates/science-guide/style-common.css` (+ 두 README의 디자인 설명).
* 그 뒤 **23개 앱 사본에 복사**: `public/apps/sci-*/science-sim/style-common.css`, `public/apps/sci-*/science-guide/style-common.css`. `diff -r`로 정본과 일치 확인.
* **JS·HTML·앱 고유 파일(app.js, index.html, style.css, data/)은 고치지 않는다.** 글꼴은 `style-common.css` 맨 위의 `@import`로 CDN을 불러온다(23개 index.html을 건드리지 않기 위해):
  * Pretendard: jsDelivr의 `pretendard` 가변 글꼴 dynamic-subset CSS(정확한 URL·버전을 확인해 고정 버전으로).
  * Jua: Google Fonts CSS(`display=swap`).
  * 불러오지 못하면 기기 기본 글꼴로 자연스럽게 대체되게 `font-family` 목록을 둔다.
* 앱 고유 `style.css`가 공통 틀 변수를 덮어쓰는 곳이 있으면(색이 안 바뀌는 앱) 목록만 보고서에 적는다(고치지 않음).

## 디자인
* 사이트 토큰과 맞춘다: 주색 보라(사이트 `--primary`와 같은 값, 밝은/어두운), 연보라 배경 그라데이션, 큰 둥근 모서리, 부드러운 색 그림자, 알약 버튼(주 버튼 보라 그라데이션, 보조 버튼 흰 알약), 단계 막대(현재 단계 강조를 색 + 글자 굵기 + 표시로), 카드·관찰 카드·되짚기 카드(`answer-check`)·제출 안내·완료 카드 톤 통일.
* 과학 앱은 **수업 중 태블릿**에서 쓴다: 3D 장면·표·그래프 가독성이 최우선. 장식(그라데이션·그림자)은 버튼·카드 테두리까지만, 3D 캔버스·그래프 영역에는 넣지 않는다.
* 그래프·표 색(자료 계열 색)은 **바꾸지 않는다**(과학적 의미·범례와 연결됨).

## 반드시 지킬 것
* 앱 동작·저장 키·저장 구조·측정값·문구는 그대로. CSS만.
* 대비 AA(밝음·어두움), 44px 이상 터치 영역 유지, `prefers-reduced-motion`, 키보드 초점.
* 앞서 고친 레이아웃(기록하기 버튼이 아래 막대에 가리지 않음, 휴대폰 가로 머리말 축소, 알림 `pointer-events:none`)이 깨지지 않게.
* git 금지, 실 DB 쓰기 금지(가짜 세션), 자기 전용 headless 브라우저·자기 포트만, `localStorage.clear()` 금지. 이미지 새로 받지 않기.

## 검증
* 앱 최소 6개를 **끝까지** 진행: `sci-6-1-1-1`(이전 기준), `sci-6-1-2-5`, `sci-6-2-1-2`(시간 바), `sci-6-2-2-3`, `sci-6-2-3-2`(소리·팝업), 조사 앱 `sci-6-1-1-5`. 태블릿 가로·세로, 375, 812×375, 다크. 콘솔 오류 0, 가로 스크롤 0.
* 글꼴이 실제로 Pretendard/Jua로 그려지는지, CDN을 막았을 때(오프라인 흉내) 앱이 정상 동작하고 기본 글꼴로 보이는지.
* 스크린숏(전/후 비교)을 `…/scratchpad/redesign-3/`에 저장.

## 보고
`docs/design/redesign/build-3-report.md`: 바꾼 변수·규칙, CDN URL(고정 버전), 동기화 확인, 덮어쓰는 앱 목록, 스크린숏 경로, 확인 못 한 것.
