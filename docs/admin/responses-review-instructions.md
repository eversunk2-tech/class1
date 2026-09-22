# Review 서브에이전트 지침: 관리자 "학생 응답" · 개별 피드백 · 일괄 칭찬

## 목표
`docs/admin/responses-spec.md`(§12 우선)대로 구현됐는지 독립적으로 검증하고 `docs/admin/responses-review.md`를 작성한다. **코드는 수정하지 않는다.**

## 읽을 것
`CLAUDE.md`, `docs/admin/responses-spec.md`, `docs/admin/responses-build-instructions.md`, `docs/admin/responses-build-report.md`, `git diff HEAD`와 새 파일 전부(`src/**`, `src/data/app-responses/**`, `supabase/migrations/20260922020000_praise_presets.sql`, `scripts/templates/**`, 앱 틀 사본, `public/apps/sci-6-1-2-{3,4,5}/app.js`).

## 검증 항목
1. **매핑 정확성 (최우선)**: 12개 앱 각각, 앱 코드의 `buildDetail`(및 과거 버전 — `git log -p`로 2단원 탐구 3·4·5의 v1~v4 구조 확인)이 실제로 만드는 detail을 기준으로, 매핑이 **질문 문구·값·정답 여부**를 정확히 보여주는지. 빠지거나 다른 질문에 잘못 붙는 답이 없는지. 1단원 앱(학생이 이미 사용)은 특히 꼼꼼히 — 가능하면 앱을 가짜 로그인으로 끝까지 진행해 실제 detail을 만들어 표시해 본다.
2. **보안**: 관리자만 학생 응답·진행 조회(클라이언트 가드 + RLS), 학생 입력·이름 XSS(텍스트 렌더링만), `praise_presets` RLS(관리자만), SQL 재실행 안전·시드 중복 없음, 일괄 전송 남용 방지(최대 인원, 중복 전송, 연타), 다른 학생 스레드 오발송 여부.
3. **일괄 칭찬 정확성**: "완료한 학생" 판정(같은 앱 여러 결과·다시 하기), 이미 보냄 판정, `{이름}` 치환(이름 없음·특수문자), 부분 실패 후 재전송 시 중복, 확인 대화상자.
4. **회귀**: 탐구 3·4·5 앱이 `detail.qa` 추가 후에도 정상(가짜 로그인 전체 흐름), 다른 9개 앱이 새 틀로 정상(최소 실험·조사 단계 진입), 기존 관리자·학생 화면(학습 현황 다른 탭, 회원 상세, 내 학습 활동 피드백) 정상.
5. 빌드·lint·tsc, 틀 사본 일치, 태블릿·375px·다크모드, 콘솔 오류.

## 작업 환경
실 DB 쓰기 금지(anon key로 읽기·거부되어야 할 요청만). 브라우저는 자기 탭 또는 자기 전용 headless만, 다른 탭·프로세스 건드리지 않기, `localStorage.clear()` 금지. 임시 파일은 스크래치에만. `docs/admin/responses-review.md`만 작성. git 조작 금지.

## 형식
요약(심각도별 개수) / 앱별 매핑 검증 표(앱, 확인 방법, 결과) / 문제 표(심각도, 위치 파일:줄, 현상, 재현, 수정 제안) / 확인한 것 vs 못 한 것.
