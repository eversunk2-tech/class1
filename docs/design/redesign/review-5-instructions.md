# 검토 지침 — 디자인 개편 5단계(제목 글꼴·그림자) + 작은 문제 3개 (2026-09-24)

당신은 **Review** 담당이다. 코드를 고치지 않는다(발견만 기록). 먼저 `CLAUDE.md`, `AGENTS.md`, `docs/design/redesign/spec.md` 맨 끝 "개정 2", 그리고 두 Build 문서를 읽는다:
* `docs/design/redesign/build-5-instructions.md` / `build-5-report.md` — 제목 글꼴 Jua → G마켓 산스 Bold(공식 OTF 원본, `public/fonts/gmarket-sans/`), 제목 부드러운 그림자, 관리자 화면은 그림자 없음, 과학 앱 23개 공통 틀.
* `docs/science/small-fix-2-instructions.md` / `small-fix-2-report.md` — 스피너(움직임 줄이기), 예전 파랑 7곳, `sci-6-2-1-4` 기록하기 버튼.
* 변경 전체: `git diff`와 `git status`(새 파일: `public/fonts/gmarket-sans/`, 문서들). 템플릿 README 두 개는 Claude가 고치고 23개 사본에 동기화했다.

## 확인할 것
1. **과학적·내용 무변경**: 앱의 문항·안내 문구·측정 조건·저장 키(`:vN`)·저장 구조, 3D·2D 장면·그래프·자료 색이 바뀌지 않았는지(diff로). 1학기 1단원·2단원 탐구 1·2·6 앱은 겉모양만 바뀌었는지.
2. **글꼴 파일·라이선스**: `public/fonts/gmarket-sans/GmarketSansBold.otf`의 sha256 앞 16자리가 `0773544f5de7f45b`(공식 원본 그대로)인지, `LICENSE-gmarket-sans-OFL.txt`가 있고 OFL 조건(저작권 고지·라이선스 포함, 수정본 이름 금지)과 맞게 쓰였는지, 글꼴이 변환·서브셋되지 않았는지.
3. **사이트 화면**(개발 서버 `http://localhost:3000/class1/`은 이미 돌고 있음 — 끄지 말 것): 홈, 과학수업(학기→단원→차시 상세), 자유게시판·학습게임(목록·글쓰기·글 보기), 블로그 글 보기(`/post?slug=`, 가짜 글 마크다운에 h1~h3 포함), 검색, 로그인, 비밀번호 변경, 내 학습 활동, 404, 관리자(대시보드·회원 관리·학생 응답) — 1280×800, 1024×768, 768×1024, 375×812, 320×640(홈·과학수업), 밝음·어두움. 볼 것: 제목이 G마켓 산스(굵게)로 그려지는지(`document.fonts`/계산된 글꼴), 그림자가 부드럽고 번지거나 탁하지 않은지(특히 작은 제목·그라데이션 글자 "배움터"), 관리자 영역에는 그림자가 없는지, 넘침·가로 스크롤·어색한 한 글자 줄바꿈, 알약·칩·아이콘 옆 제목의 세로 치우침, 글자 대비 AA(그림자 제외 글자색↔바탕), 고대비 모드(`forced-colors`)에서 그림자 없음.
4. **과학 앱**: Build가 연 3개(`sci-6-1-1-2`, `sci-6-2-3-2`, `sci-6-1-1-5`) **말고** 다른 앱 최소 4개 — `sci-6-1-1-6`(조사), `sci-6-1-2-3`, `sci-6-2-1-2`, `sci-6-2-1-4` — 를 실험(조사) 단계, 기록·분석, 정리하기 화면까지(가능한 만큼) 열어 제목 글꼴·그림자·배치(태블릿 가로 1024×768, 세로 768×1024, 휴대폰 375×812, 어두움 1개). `sci-6-2-1-4`는 1024×768에서 실험하기 진입 직후 기록하기 버튼이 아래 막대 위로 다 보이는지 다시 실측(로그인·체험 모드). 되짚기 카드 스피너가 움직임 줄이기에서 2.4s인지 1개 앱에서.
5. **예전 파랑 7곳**: 7곳 선택 표시가 보라로 보이고 대비 기준을 넘는지 최소 3곳 직접 확인(산·염기 1곳, `sci-6-1-2-5` 계산기 "=" 밝음·어두움, `sci-6-2-2-2` 2D 점선).
6. **배포 형태 확인**: `npm run build` 뒤 `out/`을 자기 전용 정적 서버(포트 **4016**)에서 `/class1/` 경로로 띄워(예: 임시 폴더에 `class1/` 링크 또는 복사 후 그 상위를 서빙) 홈과 과학 앱 1개를 열고, 사이트 `/class1/fonts/gmarket-sans/gmarket-sans.css`와 앱의 `../../fonts/gmarket-sans/gmarket-sans.css`가 **같은 URL의 같은 OTF**를 요청하며 둘 다 200인지, 한 번 받은 뒤 다른 쪽에서 캐시를 쓰는지(가능하면). 글꼴 파일을 막았을 때 제목이 대체 글꼴 굵게로 바로 보이는지.
7. **첫 화면 막힘 없음**: 글꼴 CSS·OTF 응답을 5초 붙잡아 둔 상태에서 사이트 홈과 앱 1개의 첫 그리기 시점이 늦어지지 않는지.
8. `npm run lint`, `npm run build` 통과, 템플릿 정본과 23개 앱 사본 `diff -r` 일치.

## 테스트 규칙(반드시)
* **자기 전용 headless Chrome만**(원격 디버깅 포트 **9343**, 사용자 데이터 폴더는 스크래치 안). Node 24 전역 `WebSocket`으로 CDP 직접 사용(설치 금지).
* **실제 Supabase는 첫 로드부터 차단**: Chrome 인자 `--host-resolver-rules="MAP *.supabase.co 127.0.0.1:9, MAP supabase.co 127.0.0.1:9"` + `--disable-web-security` + CDP `Fetch.enable`(패턴 `*supabase.co*`)로 가짜 응답만(`site_settings`, `profiles`(학생 `role:"user"` / 관리자 화면은 `role:"admin"`), `rpc/my_must_change_password`→`false`, `rpc/is_admin`→불리언, `functions/v1/check-answer`→앱이 기대하는 모양, 나머지 GET→`[]`/`null`, POST/PATCH→201 `[]`, OPTIONS→204). 로그인은 localhost 출처에서만 localStorage `sb-<ref>-auth-token` 가짜 세션(ref는 `.env.local` URL 호스트 첫 부분, 값을 문서에 적지 않음). `Network.loadingFailed`로 새는 요청이 없는지 기록. 실제 Gemini 호출 금지.
* 개발 서버를 끄거나 재시작하지 않는다. 띄운 정적 서버·Chrome은 끝날 때 반드시 종료. `localStorage.clear()` 금지. 다른 탭·프로세스를 건드리지 않는다. git commit/push·실 DB 쓰기 금지. 아무것도 내려받지 않는다.
* 임시 파일·스크린숏은 `/private/tmp/claude-501/-Users-sungchul-Desktop-classroom/7bf3a39e-3017-4189-b337-1b82aace66bb/scratchpad/review-5/`에(스크린숏만 남기고 나머지는 지운다).

## 보고서 `docs/design/redesign/review-5.md`
심각도(높음·중간·낮음)별 발견 표(위치, 무엇, 재현, 제안), 항목 1~8의 합격/불합격과 실측값, 스크린숏 경로, supabase 차단 기록, 확인하지 못한 것 — 한국어로 간결하게. 문제가 없으면 없다고 분명히 적는다.
