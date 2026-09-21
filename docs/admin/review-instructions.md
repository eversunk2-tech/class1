# Review 서브에이전트 지침: 관리자 대시보드 + 학습활동 검증

## 목표
Build A/B 결과를 독립적으로 검증하고 `docs/admin/review.md`를 작성한다. **소스 코드는 수정하지 않는다.**

## 읽을 것
* `CLAUDE.md`, `AGENTS.md`, `docs/admin/spec.md`(§14 우선), `docs/admin/build-a-report.md`, `docs/admin/build-b-report.md`
* `supabase/migrations/*.sql`(특히 `20260921020000_admin_learning.sql`), `supabase/functions/admin-reset-password/index.ts`
* 변경된 코드: `git diff HEAD --stat`와 신규 파일 전부, `scripts/templates/class1-record.js`

## 수정 범위
* 작성 가능: `docs/admin/review.md`, 스크래치 디렉터리 임시 파일(정리할 것).
* 그 외 읽기만. 임시 변경은 원상복구 후 `git status`로 확인. git commit/push 금지.

## 환경
* 실 Supabase에 이 마이그레이션과 Edge Function이 **이미 적용·배포**되어 있다(`.env.local`).
* **실 DB 쓰기 금지.** 허용: anon key로 하는 읽기 요청과, 거부되어야 할 쓰기 시도(RLS 검증 목적, 예: anon으로 insert → 거부 확인). 거부되지 않고 실제로 쓰기가 성공하면 즉시 중단하고 review.md에 **치명**으로 기록(생성된 행 식별 정보 포함).
* 로그인 사용자 시나리오는 가짜 Supabase 서버 또는 정적 분석으로 검증하고, 실제로 확인 못 한 것은 명확히 구분.

## 검증 항목
1. **빌드**: `npm run lint`, `npm run build`, `out/`의 모든 라우트, basePath `/class1` 경로 규칙.
2. **보안/RLS (최우선)**:
   * 학생이 다른 학생의 app_results/post_reads/제출물/피드백을 읽거나 쓸 수 있는가
   * 학생이 `must_change_password`를 비밀번호 변경 없이 해제할 수 있는가(`clear_must_change_password` 우회) — 위험도 평가
   * 학생이 `role`, 과제 제출 `status`, 다른 사람 스레드 메시지 작성 등 권한 상승 가능한가
   * security definer 함수들의 `search_path`, 내부 권한 검사, anon 실행 권한(`revoke ... from public`)
   * `member_directory`가 관리자 외에 노출되는가, 백필·동기화 트리거 정확성
   * Edge Function: 관리자 검증, 대상 계정 검증(OAuth 전용·관리자 자신 등), 임시 비밀번호 강도, 로그 유출, CORS, 에러 메시지 정보 노출
   * `class1-record.js`: 세션 공유 방식이 안전한지, 키/토큰 노출, 학생 조작 한계가 문서화됐는지
3. **기능 동작(브라우저)**: `out/`을 `/class1/`로 서빙(또는 개발 서버 `http://localhost:3000/class1/`)해 데스크톱/모바일(375px), 라이트/다크에서 각 화면 확인. 관리자 대시보드, 회원 목록/상세, 비밀번호 초기화 다이얼로그, 강제 변경 게이트, `/me/learning/` 탭, 과제 제출/삭제 조건, 지각 배지, 피드백 대화·읽음 배지, 기존 블로그 화면 회귀(메인, 글 상세, 로그인, 글 관리/에디터 경로 이동).
4. **코드 리뷰**: 버그, 경쟁 상태, 에러 처리, 이벤트/구독 해제, 시간대 처리, 접근성, 중복 코드.
5. **CLAUDE.md 규칙 준수**.

## review.md 형식
요약(심각도별 개수) / 문제 표(심각도, 위치 파일:줄, 현상, 재현, 수정 제안) / 실제로 확인한 것 vs 확인 못 한 것 / 사용자가 실계정으로 확인할 체크리스트.
