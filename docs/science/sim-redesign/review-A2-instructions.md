# 재검토 지침(Review A2) — 단계 A 수정(fix-A) 확인 (2026-09-25)

당신은 **Review** 담당이다. **코드를 고치지 않는다**(발견만 기록). 먼저 읽기: `CLAUDE.md`, `docs/science/sim-redesign/spec.md` 끝의 개정 4, **`review-A.md`**(지난 검토의 발견 H1·H2·M1~M7·L1~L11과 측정 방법), **`fix-A-instructions.md`**(F1~F11), **`fix-A-report.md`**(고친 내용·전후 수치·지침과 다르게 판단한 곳), `git diff -- scripts/templates/science-sim/ public/apps/sci-6-1-2-4/app.js public/apps/sci-6-2-2-1/app.js public/apps/sci-6-2-2-2/app.js public/apps/sci-6-2-2-3/app.js public/apps/sci-6-2-2-4/app.js`.

## 확인할 것
1. **지난 발견이 정말 고쳐졌는지 — 같은 재현 방법으로**: H1(`sci-6-2-1-2` 막대 가짜 버튼·가짜 기록), H2(`sci-6-1-2-4` 크게 보기에서 초시계와 다른 값), M1(알림 겹침 넓이 — review-A 항목 6 표의 모든 경우를 다시 재기), M2(항목 2 스크롤 표 5개 앱 × 1024×768·768×1024 × 끔·켬 — **보기를 고른 뒤 '확인하기'가 화면 안에 있는지**, 확인 뒤 기록하기가 화면 안에 있는지), M3(가로 5크기에서 머리말 접은 직후·펴고 난 직후 막대가 다 보이는지), M4(막대가 장면 아래 글·이름표를 가리는지 — review-A M4의 앱들 실행 중), M6(어두움 토글 대비), M7(scenePanel 4칸 — 스크래치 사본으로만), L2(2D 토글 겹침), L3(forced-colors), L5(Tab 순서·토글 이름), L7(끌기 도우미: 둘째 손가락·잠긴 카메라·오른쪽 버튼·discard/dispose 중 끝냄·숨긴 물체).
2. **회귀(새로 망가진 것)**:
   * 끔(기본 화면) 상태 하위 호환 — review-A 항목 1의 5개 앱 × 3크기, 바꾸기 전 사본(`git archive HEAD`, 자기 정적 서버 포트 8781)과 `getBoundingClientRect` 비교. 끔 상태 기록 흐름(보기형·보기+확인형·측정하기형·값만·숫자 입력형)의 기록 버튼 켜짐/꺼짐 순서와 **자동 스크롤**이 예전과 같은지(fix-A가 `revealRecord`를 바꿨다 — 기본 화면의 스크롤이 늘었거나 줄었으면 수치로).
   * 크게 보기: 관찰 카드가 장면 바로 아래로 옮겨졌다가 끄면 원래 자리로 돌아오는지, 번호(①②…)가 두 모드에서 맞는지, 조건을 바꿀 때 누른 버튼이 튀지 않는지(자동 스크롤 보정이 두 번 걸리거나 반대로 튀지 않는지 — 위아래로 여러 번), 3D 칸이 막대 위에서 끝나도 카메라·이름표·앱 안내 글이 어색하지 않은지(20개 앱 1024×768 켬·768×1024 기본 켬 스크린숏), 3D↔2D·토글 반복 시 캔버스·수신기가 쌓이지 않는지.
   * 새 공개 기능 `SciSim.Experiment.enlarge()`(create()가 쓰도록 떼어 냄): 코드 읽기로 create()의 동작이 fix 전(F1~F8 제외)과 같은지, 그리고 **스크래치 사본의 `sci-6-2-1-3`·`sci-6-2-1-4`에 연결**해(저장소 앱은 고치지 않는다) 토글·기본값·방향별 기억·막대·되돌리기가 되는지 — 단계 B에서 이 두 앱이 쓸 수 있는 API인지(README 예시가 실제와 맞는지).
   * fix-A가 지침과 다르게 판단한 두 곳(기록 버튼이 꺼져 있을 때 확인 줄만 보이게 하는 스크롤, 장면 다시 맞추기는 학생이 접기·창 크기를 바꿀 때만)이 타당한지.
   * 20개 실험 앱 × {1024×768 켬, 768×1024 기본 켬, 1024×768 끔} 실험하기까지 콘솔 오류 0. 조사 앱 3개는 머리말 접기·단계 메뉴만.
3. **남은 것 평가**: fix-A가 안 고친 것(L1, L9, L4 머리말 높이, `sci-6-2-2-3` "빨리 감기" 배지 겹침, 머리말 접었을 때 두 줄 알림 겹침, L8 나머지) — 사용자에게 보여 주기 전에 꼭 고쳐야 하는 것이 있는지 판단.
4. `diff -r` 정본↔20개 사본(+조사 3개 `science-guide`), `npm run lint`, 임시 코드(`fullScene`, 시험용 `draggable`, `console.log`, `debugger`) 없음, `localStorage.clear()` 없음.

## 사용자에게 보여 줄 대표 스크린숏(fix 뒤 최신, 8~10장) — `review-A2/showcase/`
768×1024 태블릿 세로 기본(크게 보기 켬) — 실행 뒤 관찰 카드가 장면 바로 아래에 뜬 모습 포함 1장, 1024×768 태블릿 가로 기본(끔), 1024×768 크게 보기 켬, 1024×768 크게 보기 + 머리말 접음, 1920×1080 크게 보기, 375×812 휴대폰, 어두움 1장, 알림이 머리말 위에 뜬 모습 1장. 파일 이름에 크기·모드를 한국어로.

## 테스트 규칙(반드시)
* 자기 전용 headless Chrome만(포트 **9351**, 프로필은 스크래치 `/private/tmp/claude-501/-Users-sungchul-Desktop-classroom/7bf3a39e-3017-4189-b337-1b82aace66bb/scratchpad/review-A2/` 안), `--headless=new --use-angle=swiftshader --enable-unsafe-swiftshader --disable-web-security --host-resolver-rules="MAP *.supabase.co 127.0.0.1:9, MAP supabase.co 127.0.0.1:9"`, Node 24 전역 WebSocket으로 CDP(설치 금지), CDP `Fetch.enable`(`*supabase.co*`) 가짜 응답만. 실제 Supabase·Gemini로 요청이 나가면 안 된다. 지난 검토의 도구가 스크래치 `review-A/lib/`에 남아 있으면 복사해 써도 된다(원본은 고치지 않음).
* 개발 서버 `http://localhost:3000/class1/apps/<앱>/index.html`를 끄거나 재시작하지 않는다(꺼져 있으면 지난번처럼 작업 트리의 읽기 전용 사본을 자기 정적 서버 8782로 띄워 쓰고 보고서에 적는다). 자기 정적 서버는 8781(바꾸기 전)·8782만.
* `localStorage.clear()` 금지(그 앱 `sci6…`·`ssUiPref:` 키만), 다른 탭·프로세스·다른 Chrome 건드리지 않기, git commit/push·실 DB 쓰기·내려받기·`npm run build` 금지. 끝나면 자기 Chrome·서버 종료, 스크린숏만 남기고 정리(지우기가 거부되면 보고).

## 보고서 `docs/science/sim-redesign/review-A2.md`
지난 발견별 "고쳐짐/덜 고쳐짐/안 고쳐짐"(재현 결과·수치), 새로 찾은 문제(심각도·파일:행·재현·제안), 항목 2~4 판정, showcase 목록, Supabase 차단 기록, 확인하지 못한 것 — 한국어로 간결하게. 마지막 줄에 "사용자에게 보여 주고 커밋해도 되는지"에 대한 판단.
