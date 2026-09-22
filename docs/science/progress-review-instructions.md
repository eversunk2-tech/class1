# Review 서브에이전트 지침: 로그인 필수 · 진행 상황 DB 저장 · 로그아웃 시 삭제

## 목표
`docs/science/progress-build-instructions.md`의 요구가 제대로 구현됐는지 독립적으로 검증하고 `docs/science/progress-review.md`를 작성한다. **코드는 수정하지 않는다.**

## 읽을 것
`CLAUDE.md`(과학 차시 앱 규칙의 로그인 필수/진행 상황 DB 저장/로그아웃 시 삭제), `docs/science/progress-build-instructions.md`, `docs/science/progress-build-report.md`, `git diff HEAD`와 새 파일 전부(`supabase/migrations/20260922010000_app_progress.sql`, `scripts/templates/**`, `src/**` 변경, 앱 12개의 틀 사본·`class1-record.js`).

## 검증 항목 (보안·데이터 보존 최우선)
1. **개인정보·교차 노출**: 공용 태블릿에서 학생 A의 입력이 학생 B에게 보이는 경로가 남아 있는지(로그아웃 없이 넘겨줌, 세션 만료, 다른 탭 로그아웃, 앱을 연 채 로그아웃, 뒤로 가기 캐시(bfcache), 메모리에 남은 화면). 로그아웃 후 `sci6` 키가 정말 모두 사라지는지, 앱이 틀을 거치지 않고 쓰는 키가 없는지 전수 `grep`.
2. **RLS/SQL**: 본인만 읽기·쓰기, 관리자 읽기, anon 불가, `user_id` 위조 불가(insert/update with check), app_id 검증, 크기 제한, 재실행 안전, 기존 테이블·정책에 영향 없음. 실 DB에는 anon key로 **읽기와 거부되어야 하는 요청만** 보낼 수 있다(테이블이 아직 없을 수 있음).
3. **데이터 보존**: 동기화 충돌 규칙이 학생 입력을 잃는 경우(두 기기 동시 사용, 오프라인 후 복귀, 저장 실패 중 로그아웃 → 로컬 삭제로 미전송분 손실, 디바운스 중 페이지 이동), 스냅샷 크기, 저장 실패 표시와 재시도.
4. **로그인 리다이렉트**: `?next=` 오픈 리다이렉트 방지(`//evil`, `/\evil`, `https:`, 인코딩 우회, basePath 중복), OAuth 후 복귀.
5. **기존 기능 회귀**: 앱 12개가 로그인 상태에서 기존처럼 동작(가짜 세션/가짜 응답으로), 완료 결과 `app_results` 저장 유지, 블로그 로그인/로그아웃/관리자 에디터 초안 동작, 테마 유지.
6. 빌드·lint, 틀 사본 일치(`diff -r`), 콘솔 오류.

## 작업 환경
* 브라우저: 자기 탭(tabs_create) 또는 자기 전용 headless(겹치지 않는 포트)만, 끝나면 종료. 다른 탭·프로세스 건드리지 않기. `localStorage.clear()` 금지.
* 개발 서버 `http://localhost:3000/class1/`. 임시 파일은 스크래치에만.
* `docs/science/progress-review.md`만 작성. git 조작·실 DB 쓰기 금지.

## progress-review.md 형식
요약(심각도별 개수) / 문제 표(심각도, 위치 파일:줄, 현상, 재현, 수정 제안) / 시나리오별 확인 결과 / 확인한 것 vs 못 한 것.
