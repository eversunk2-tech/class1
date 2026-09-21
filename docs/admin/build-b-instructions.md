# Build 서브에이전트 B 지침: 학습활동 · 과제 · 피드백 · 내 학습 활동

## 목표
`docs/admin/spec.md` §10의 **단계 5~10**을 구현한다.
* 5: 웹앱 기록 — `scripts/templates/class1-record.js`(정본, spec §6) + 사용 예시 주석, `/me/learning/` 웹앱 결과 탭, 회원 상세의 웹앱 결과 영역, `/admin/learning/` 개요·앱별 탭
* 6: 글 읽기 기록 — 글 상세에서 로그인 사용자일 때 `record_post_read` 호출(실패해도 화면에 영향 없음), `/me/learning/` 읽은 글 탭, 회원 상세 영역
* 7: 참여 집계 — 댓글·좋아요 (`/me/learning/`, 회원 상세, `/admin/learning/` 참여 탭)
* 8: 과제 — 관리자 생성·수정·삭제·공개 전환·제출 검토(상태 변경), 학생 제출·수정·삭제(§14 Q8 조건을 UI에도 반영), 지각 배지(§14 Q1)
* 9: 피드백 양방향 대화 — `FeedbackThread` 컴포넌트, 학생 전체 스레드 + 결과/제출 연결 스레드, 읽음 표시, 안 읽음 배지(헤더 사용자 메뉴·관리자 메뉴), 포커스 시 재조회(실시간 제외)
* 10: 개요 대시보드 통계 연결 + 전체 QA(반응형, 다크모드, `next build`)
* 헤더 사용자(프로필) 메뉴에 "내 학습 활동"(`/me/learning/`) 추가

## 반드시 먼저 읽을 것
* `CLAUDE.md`, `AGENTS.md` (Next.js 16 API는 `node_modules/next/dist/docs/`)
* `docs/admin/spec.md` 전체 (**§14 우선**), `docs/admin/build-a-report.md` — A의 컴포넌트/훅/타입을 재사용, 중복 구현 금지
* `supabase/migrations/20260921020000_admin_learning.sql` — **실제 스키마는 이 파일이 기준**. spec 초안과 다르면 이 파일을 따른다.

## 수정 범위
* 수정 가능: `src/**`, `scripts/templates/class1-record.js`(신규), `package.json`/`package-lock.json`(필요 시).
* 스키마/함수 수정이 꼭 필요하면 **새 파일** `supabase/migrations/20260921030000_admin_learning_fixes.sql`로만(기존 파일 수정 금지), 보고서에 이유 명시.
* 수정 금지: 기존 마이그레이션, `supabase/functions/**`, `next.config.ts`, `CLAUDE.md`, `AGENTS.md`, `.github/**`, `.env*`, `.gitignore`, `public/apps/**`, `docs/**`(보고 파일 제외).
* git commit/push 금지.

## class1-record.js 요구사항
* 의존: 앱 페이지에서 CDN supabase-js(v2, 정확한 버전 + SRI 예시)를 먼저 로드. 블로그와 같은 origin이라 localStorage 세션 공유(블로그 `src/lib/supabase.ts`의 storage key 설정과 일치해야 함 — 확인해서 맞출 것).
* API 예: `Class1Record.init({ url, anonKey, appId })`, `await Class1Record.save({ score, maxScore, completed, durationSec, detail })`, `Class1Record.getUser()`. 비로그인 시 저장하지 않고 `{ ok:false, reason:'not_logged_in' }`, 블로그 로그인 링크 제공 헬퍼(상대경로 `../../login/`).
* 외부 라이브러리 추가 금지, 파일 상단 한국어 사용법.

## 환경
* `.env.local`은 실 Supabase 연결. **실 DB 쓰기 금지**. 새 마이그레이션은 사용자가 아직 실행하지 않았을 수 있으므로 테이블 없음 오류를 오류 상태 UI로 처리.
* 필요하면 스크래치 디렉터리의 가짜 서버/임시 env 빌드로 화면을 확인하고, 마지막에 일반 env로 다시 빌드.
* `npm run lint`, `npm run build` 반드시 통과. `/me/learning/`, `/admin/learning/` 라우트 생성 확인.

## 완료 보고
`docs/admin/build-b-report.md`: 파일 목록, spec과 다른 점, 알려진 한계, Review 중점 확인 항목, 사용자가 할 일.
