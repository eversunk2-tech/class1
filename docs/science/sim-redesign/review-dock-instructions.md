# 검토 지침(Review dock) — 크게 보기 "장면 + 옆 조작 칸" 한 화면 실험실 (2026-09-26, spec 개정 6)

당신은 **Review** 담당이다. **코드를 고치지 않는다**(발견만 기록). 이 검토가 끝나면 Claude가 사용자 확인 없이 **커밋·배포**한다(사용자 결정) — 학생에게 바로 보일 문제(기록 안 됨·버튼 가려져 못 누름·페이지가 움직여 헷갈림·콘솔 오류)를 가장 먼저 찾고, 배포를 막아야 하면 "높음"으로 분명히.

먼저 읽기: `CLAUDE.md`("실험 화면 배치" 줄 — 개정 6), `docs/science/sim-redesign/spec.md` 끝의 **개정 6**, `dock-instructions.md`, **`dock-report.md`**(바꾼 것·측정표·걷어 낸 것), 공통 틀 README("추가 기능" 절)와 `git diff -- scripts/templates/science-sim/ public/apps/sci-6-2-1-2 public/apps/sci-6-2-1-3 public/apps/sci-6-2-1-4 public/apps/sci-6-2-1-5 public/apps/sci-6-2-2-2 public/apps/sci-6-2-2-3`(커밋 `ce3c80b` 이후 — 공통 틀 사본 `science-sim/`은 정본과 같아야 한다).

## 사용자 요청(합격 기준)
크게 보기(⛶ 전체 화면 보기)에서 조작 메뉴가 장면 아래로 내려가 위아래로 스크롤하던 것을 없애고, **실험 화면 안의 한쪽 부분에(장면을 가리지 않으며) 조작 메뉴가 나타나** 한 화면에서 스크롤 없이 조작. 가로 화면 = 조작 칸 오른쪽, 세로 = 아래. 기본 화면(끔)은 그대로.

## 확인할 것
1. **새 크게 보기**: 20개 실험 앱 × {1024×768, 1180×820, 1366×768, 1920×1080, 768×1024, 810×1080, 375×812, 812×375} — 실험 영역이 머리말~아래 이동 막대 사이를 채우고, 장면과 조작 칸이 겹치지 않고(가로=오른쪽, 세로=아래), **페이지 스크롤 0**(조작 칸 스크롤·실행·기록·관찰 카드 등장·토글·방향 전환 중에도), 조작 칸 안에서만 스크롤, 장면 안 막대(실행·기록하기·측정값)가 보이고 눌림, 토글·HUD·이름표 겹침 없음, 콘솔 오류 0, 가로 스크롤 0. 머리말 펼침·접힘, 어두움, 2D(`?no3d=1`)도.
2. **흐름**: 앱 최소 10개(보기형·보기+확인형·숫자형(`sci-6-1-2-4` 초시계 확인 포함)·측정하기형·`sci-6-2-1-2`~`-5`·`sci-6-2-2-2`·`-3`·`sci-6-1-1-1`)에서 크게 보기로 고르기 → 실행 → 관찰 카드가 **조작 칸 안에서** 보임 → 기록 → 표에 들어감, 켠 채 새로 고침·방향 바꾸기·토글 3번·Esc, 버튼 복제·유실 0, 끄면 모든 것(알아 두기·안내 줄·안전 카드·시간 바 카드·보기 도구·관찰 카드·scenePanel) **원래 자리**.
3. **기본 화면 회귀 없음**: 앱 6개 이상 × 1024×768·768×1024(끔)에서 커밋 `ce3c80b`의 사본(`git archive ce3c80b public`을 자기 정적 서버 8781로)과 `getBoundingClientRect`·스크린숏 비교 — 차이 0이어야 한다.
4. **앱별 변경 6곳**(`sci-6-2-1-2` 시간 바·출처 카드가 조작 칸으로 + 옆에서 본 모습 칸이 보이는지, `sci-6-2-2-2`·`-3` 시간 바 카드, `sci-6-2-2-3` 빨리 감기 배지, `sci-6-2-1-5` 관찰 카드 숨김 규칙 제거, 2-1-2~5 2D 높이 규칙)이 두 모드에서 맞는지.
5. **태블릿 실제 환경 걱정거리(코드 읽기로)**: `position: fixed` + 화면 키보드(숫자·글 입력칸이 조작 칸 안에 있을 때 가려지지 않는지 — 최소한 입력칸에 초점이 가면 조작 칸 안에서 보이게 스크롤되는지), `html:has(...)` 스크롤 잠금이 안 되는 옛 브라우저에서 어떻게 되는지(쓸 수는 있는지), 회전.
6. **되짚기 수정(`answer-check.js`, 커밋 `3a45060`)**: 가짜 로그인 + CDP로 `functions/v1/check-answer`를 가짜로 — (a) 5초 늦게 `{ok:true, verdict:"block", message:"…"}` → "답을 다시 확인하고 있어요…" 뒤 막는 카드(9초 안), (b) `{ok:false, reason:"timeout"}` → 되짚기 카드가 뜨고, 다른 글로 고쳐 쓰면 **다시 서버에 묻는지**(되짚음으로 기록되지 않음), 같은 글로 "그대로 제출"한 뒤 같은 글은 다시 안 묻는지.
7. `diff -r` 정본↔23개 사본, `npm run lint`, 임시 코드·`console.log`·`debugger`·`localStorage.clear()` 없음, README가 새 크게 보기를 맞게 설명.

## 사용자에게 보여 줄 대표 스크린숏(8장) — `review-dock/showcase/`
1024×768 크게 보기(2개 앱, 하나는 실행 뒤 조작 칸 안 관찰 카드), 768×1024 크게 보기(2개 앱), 1920×1080, 크게 보기 + 머리말 접음, 휴대폰 가로, 어두움 1장. 파일 이름에 크기·앱을 한국어로.

## 테스트 규칙(반드시)
* **자기 정적 서버로 저장소 `public/`을 직접 서빙**: `python3 -m http.server 8795 --bind 127.0.0.1 --directory /Users/sungchul/Desktop/classroom/public` → `http://127.0.0.1:8795/apps/<앱>/index.html`. 비교용 사본은 8781. 끝나면 종료.
* 자기 전용 headless Chrome만(포트 **9351**, 프로필은 스크래치 `/private/tmp/claude-501/-Users-sungchul-Desktop-classroom/7bf3a39e-3017-4189-b337-1b82aace66bb/scratchpad/review-dock/` 안), `--headless=new --use-angle=swiftshader --enable-unsafe-swiftshader --disable-web-security --host-resolver-rules="MAP *.supabase.co 127.0.0.1:9, MAP supabase.co 127.0.0.1:9"`, Node 24 전역 WebSocket으로 CDP(설치 금지), CDP `Fetch.enable`(`*supabase.co*`) 가짜 응답만. 가짜 세션은 로컬 출처의 localStorage `sb-<ref>-auth-token`에만(ref 값은 문서에 적지 않음). 실제 Supabase·Gemini 요청 금지, **아무것도 내려받지 않기**.
* `localStorage.clear()` 금지(그 앱 `sci6…`·`ssUiPref:`·가짜 세션 키만), 다른 탭·프로세스·다른 Chrome 건드리지 않기, git commit/push·실 DB 쓰기·`npm run build` 금지. 저장소 파일은 보고서 하나만 새로 쓴다. 끝나면 자기 Chrome·서버 종료, 스크린숏만 남기고 정리(지우기가 거부되면 보고).

## 보고서 `docs/science/sim-redesign/review-dock.md`
심각도별 발견 표(앱·파일:행, 무엇, 재현, 제안), 항목 1~7 판정과 수치, showcase 목록, Supabase 차단 기록, 확인하지 못한 것 — 한국어로 간결하게. 마지막 줄에 **"배포해도 됨 / 고친 뒤 배포"** 판단과 까닭.
