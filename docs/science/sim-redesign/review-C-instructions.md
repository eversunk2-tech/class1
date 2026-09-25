# 검토 지침(Review C) — 단계 C: 1학기 1단원 6개 앱 간략화 (2026-09-25)

당신은 **Review** 담당이다. **코드를 고치지 않는다**(발견만 기록). 이 단계는 **학생 기록(`app_progress`·`app_results`)과 선생님 화면("학생 응답")에 영향**이 있으므로 그 부분을 가장 먼저, 가장 꼼꼼히 본다.

먼저 읽기: `CLAUDE.md`(과학 차시 앱 규칙 — 예상 1·분석 1~2·정리 1, '더 탐구하고 싶은 점' 필수 한 줄, 저장 키 버전·응답 매핑 규칙), `docs/science/sim-redesign/spec.md` §1(1.1~1.5)·§6·§7.4~7.5와 끝의 개정 2(5·6번 우선)·개정 5, `build-C-instructions.md`, Build 보고서 `build-C1-report.md`·`build-C2-report.md`·`build-C3-report.md`, 각 앱 spec.md 끝 개정 절, `docs/admin/responses-spec.md`, `src/data/app-responses/{types,helpers,index}.ts`·`sci-6-1-1-{1..6}.ts`, `src/lib/app-responses.ts`, `git diff -- public/apps/sci-6-1-1-1 public/apps/sci-6-1-1-2 public/apps/sci-6-1-1-3 public/apps/sci-6-1-1-4 public/apps/sci-6-1-1-5 public/apps/sci-6-1-1-6 src/data/app-responses`(마지막 커밋 `9d2dc16` 이후).

## 먼저 알아 둘 것(2026-09-26)
* **검토는 Claude가 만든 스냅샷으로 한다**: `npm run build` 결과를 복사한 `/private/tmp/claude-501/-Users-sungchul-Desktop-classroom/7bf3a39e-3017-4189-b337-1b82aace66bb/scratchpad/review-C-site/class1/`(앱 `…/class1/apps/<앱>/index.html`과 관리자 화면이 모두 들어 있음). 검토하는 동안 다른 에이전트가 저장소의 공통 틀("전체 화면 보기" 배치, spec 개정 6)을 바꾸므로 **저장소 `public/`을 직접 서빙하지 말고 이 스냅샷만 쓴다.** 공통 틀 사본 `diff -r`은 Claude가 따로 확인한다(항목 9에서 뺀다).
* "⛶ 전체 화면 보기"(크게 보기)는 곧 새 배치로 바뀐다(개정 6: 조작 메뉴가 장면 옆 칸에). 크게 보기의 **모양**(겹침·스크롤) 문제는 적지 않아도 되고, 크게 보기에서 **기록 흐름이 되는지**만 본다. 기본 화면은 꼼꼼히.
* Build 보고서가 알린 공통 틀 쪽 문제(체험 모드에서 정리하기로 바로 새로 고침하면 "로그인이 풀렸어요" 안내, '더 탐구하고 싶은 점' 차단 안내가 다음 클릭까지 남음, 예전 버전 진행 기록이 남은 태블릿에서 로그아웃할 때 충돌 창)은 재현해 심각도만 매긴다.

## 확인할 것
1. **예전 완료 기록이 그대로 보이는지(가장 중요)**: 앱마다 HEAD(`9d2dc16`)의 `buildDetail()`이 만드는 모양 그대로의 **예전 detail**(모든 키 채움 + 일부 키가 빈 문자열인 것 + 오래된 변형이 있으면 그 모양)을 만들어, `node_modules/jiti`로 **HEAD의 매핑**(`git show 9d2dc16:<파일>`을 스크래치에 꺼내 같은 구조로)과 **지금 매핑**에 각각 `extractResponses`를 돌려 결과(항목 key·질문·답·stage·extras)가 **label 말고 같은지** 비교. `groupByStage` 순서(예전 `curiosity` 항목이 "궁금한 점"으로 맨 뒤), `progressInfo`(예전 진행 중 행의 step이 `curiosity`일 때 이상 없음).
2. **새 완료 기록이 올바르게 보이는지**: 6개 앱을 가짜 로그인으로 **끝까지** 진행해 `app_results` POST 본문을 가로채 — `questionSet: 2`, 뺀 문항의 키가 없음(빈 값·`undefined`도 없음), 남긴 키 이름·모양은 예전과 같음, 크기 제한 안. 그 detail을 지금 매핑에 넣어 변형 v2가 잡히고 모든 항목에 답, `extras` 없음, 질문 문구가 앱 화면과 같음.
3. **선생님 화면으로 확인**: 위 스냅샷(`review-C-site/class1/`, `npm run build` 결과)의 관리자 화면을 자기 정적 서버로 띄워, 가짜 **관리자** 세션 + 가짜 응답(`profiles`→`role:"admin"`, `rpc/is_admin`→`true`, 학생 목록, `app_results`에 앱마다 예전 1개·새 1개)으로 관리자 "학생 응답" 화면(학생별·질문별 보기)을 열어 두 기록이 모두 알맞은 질문과 함께 보이는지, 변형 이름("간략화 전/후")이 보이는지 스크린숏. (화면이 어떤 테이블·rpc를 부르는지는 `src/app/admin/`·`src/lib/`를 읽어 맞춘다.)
4. **진행 중 기록**: 가짜 `app_progress` GET이 **예전 저장 키 prefix**의 스냅샷을 돌려줄 때 앱이 처음부터 시작하고 새 prefix로 저장하는지(`persist.js` `usable()`), localStorage에 예전 키가 있어도 섞이지 않는지, 새로 고침 뒤 새 버전 이어 하기.
5. **문항 규칙**: 앱마다 예상(도입) 1개·분석 보기 고르기 1~2개(+ 바꾸지 않은 관찰·분류·조사 활동)·정리 1개, 발전 질문 없음, '더 탐구하고 싶은 점'이 정리하기(조사 앱은 wrapup) 안 한 줄 입력이고 **비우면 마치지 못함**, "(선택)"·"비워도 돼요" 문구 없음. 뺀 문항을 가리키던 글(힌트, "질문 2", "분석 질문 5개" 같은 개수, 요약·done-card, 예상과 비교)이 남지 않음. 단계 메뉴 4칸, 단계 제목 번호, 이전/다음 이동, 결론 제출 전에는 마치기 칸 안 보임, "처음부터 다시 하기".
6. **내용 불변**: 관찰·분류·측정 활동과 값(기록 칸, 관찰 보기, 분류 기준·정답, 지시약 색, 참고 자료), 남긴 질문의 뜻, 과학 내용이 바뀌지 않았는지(diff로). 바뀐 문구가 있으면 전·후와 타당성.
7. **실험 앱 4개(6-1-1-1~4) 실험 화면**: 두 모드(기본·크게 보기) × 768×1024·1024×768·375×812·어두움·`?no3d=1`에서 실행 뒤 화면까지(용액 관찰·지시약 색 변화·달걀 껍데기 반응·방울 수 늘리기) 겹침·잘림·말 줄임, 3D 탭 고르기, `v.focus` 시점 이동에서 좌우 뒤집힘 없음, 실험·기록 순간 글에 결론·관계 단정 없음. 콘솔 오류 0.
8. **시간**: 각 앱 spec.md 끝 시간표가 타당한지(느린 학생 글자 수 추정), 7분을 넘으면 까닭.
9. **규칙·정리**: (공통 틀 사본 `diff -r`은 Claude가 확인) `npm run lint`, `node_modules/.bin/tsc --noEmit -p tsconfig.json`, 임시 코드·`console.log`·`debugger` 없음, `localStorage.clear()` 없음, 자기 앱 두 파일 밖의 `src/` 변경 없음.

## 사용자에게 보여 줄 대표 스크린숏(8~10장) — `review-C/showcase/`
앱마다 정리하기 화면(결론 + '더 탐구하고 싶은 점' + 학습 마치기) 1장씩(6장), 관리자 "학생 응답"에서 예전·새 기록이 함께 보이는 화면 1~2장, 실험 앱 크게 보기 1~2장. 파일 이름에 앱·화면을 한국어로.

## 테스트 규칙(반드시)
* **앱·관리자 화면 모두 스냅샷으로**: `python3 -m http.server 8791 --bind 127.0.0.1 --directory /private/tmp/claude-501/-Users-sungchul-Desktop-classroom/7bf3a39e-3017-4189-b337-1b82aace66bb/scratchpad/review-C-site` → 앱 `http://127.0.0.1:8791/class1/apps/<앱>/index.html`, 관리자 `http://127.0.0.1:8791/class1/admin/…`(스냅샷은 읽기만, 고치지 않음). 예전 앱과 비교가 필요하면 `git archive 9d2dc16 public`으로 꺼낸 사본을 포트 8781로. 끝나면 모두 종료.
* 자기 전용 headless Chrome만(포트 **9355**, 프로필은 스크래치 `/private/tmp/claude-501/-Users-sungchul-Desktop-classroom/7bf3a39e-3017-4189-b337-1b82aace66bb/scratchpad/review-C/` 안), `--headless=new --use-angle=swiftshader --enable-unsafe-swiftshader --disable-web-security --host-resolver-rules="MAP *.supabase.co 127.0.0.1:9, MAP supabase.co 127.0.0.1:9"`, Node 24 전역 WebSocket으로 CDP(설치 금지), CDP `Fetch.enable`(`*supabase.co*`) 가짜 응답만. 가짜 세션은 로컬 출처(127.0.0.1)의 localStorage `sb-<ref>-auth-token`에만(ref 값은 문서에 적지 않음). 실제 Supabase·Gemini 요청 금지, **아무것도 내려받지 않기**.
* `localStorage.clear()` 금지(그 앱 `sci6…`·`ssUiPref:` 키와 가짜 세션 키만), 다른 탭·프로세스·다른 Chrome 건드리지 않기, git commit/push·실 DB 쓰기·`npm run build` 금지(빌드는 Claude가 해 둠). 저장소 파일은 보고서 하나만 새로 쓴다. 끝나면 자기 Chrome·서버 종료, 스크린숏만 남기고 정리(지우기가 거부되면 보고).

## 보고서 `docs/science/sim-redesign/review-C.md`
심각도(높음·중간·낮음)별 발견 표(앱·파일:행, 무엇, 재현, 제안), 항목 1~9 판정과 수치(특히 1·2의 매핑 비교 결과를 앱마다 표로), showcase 목록, Supabase 차단 기록, 확인하지 못한 것 — 한국어로 간결하게. 마지막 줄에 "커밋·배포해도 됨 / 고친 뒤 배포" 판단(사용자가 검토 뒤 바로 커밋·배포를 허락함 — 학생 기록·선생님 화면을 망가뜨릴 문제는 반드시 "높음"으로).
