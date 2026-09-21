# Build 서브에이전트 A 지침: 관리자 대시보드 기반 ~ 비밀번호 초기화

## 목표
`docs/admin/spec.md` §10의 **단계 0~4**를 구현한다.
* 0: 마이그레이션 `supabase/migrations/20260921020000_admin_learning.sql`(spec §4 전체 스키마 — 이후 단계에서 쓸 테이블 포함) + Edge Function `supabase/functions/admin-reset-password/index.ts`(§5)
* 1: `/admin/` 대시보드 레이아웃 재구성, 글 목록 `/admin/posts/`로 이동, 관련 링크 전부 수정
* 2: 강제 비밀번호 변경 (`must_change_password`, 게이트, `/reset-password/`)
* 3: `/admin/members/` 목록·검색·정렬 + 상세(`?id=`) — 프로필 영역과 관리자 지정/해제. 학습활동·피드백 영역은 자리만(빈 상태 문구 없이 섹션 생략도 가능, 단계 B가 채움)
* 4: 비밀번호 초기화 버튼 → Edge Function 호출 → 임시 비밀번호 1회 표시 다이얼로그(복사 버튼). Edge Function 미배포 시 친절한 오류

## 반드시 먼저 읽을 것
* `CLAUDE.md`, `AGENTS.md` (Next.js 16 API는 `node_modules/next/dist/docs/`에서 확인 — route group, layout 등)
* `docs/admin/spec.md` 전체 (**§14가 본문보다 우선**)
* 기존 구현: `src/**`, `supabase/migrations/*.sql`, `docs/blog/*-report.md`. 최근 커밋 `1907fb6`(프론트 리디자인: 사이드바, 대시보드 홈)의 스타일·컴포넌트를 따른다.

## SQL 요구사항 (spec 초안 보완)
* `member_directory` **기존 회원 백필** 포함 (`insert ... select from auth.users ... on conflict (id) do update`).
* §14 Q8: 학생 제출 삭제 정책(마감 전 + 검토 완료 전, 본인만) 반영. 관리자 삭제 허용.
* §14 Q1: 마감 후 제출·수정 허용(차단 조건 넣지 않음).
* `admin_set_role`: 자기 자신 해제 불가, 마지막 관리자 해제 불가.
* 한 번에 실행 가능하고, 가능한 한 재실행 안전(`if not exists`, `create or replace`, `drop policy if exists`).
* 모든 새 테이블 RLS 활성화. security definer 함수는 `set search_path = ''`, 내부에서 권한 검사.
* 실행은 하지 않는다(사용자가 SQL Editor에서 실행). 파일 상단에 실행 방법·확인 쿼리 주석.

## Edge Function 요구사항
* Deno, `@supabase/supabase-js` (npm: 또는 jsr: 지정자). 호출자 JWT로 사용자 확인 → `profiles.role = 'admin'` 검증 → 대상이 이메일 비밀번호 계정인지 확인 → 강력한 임시 비밀번호 생성(`crypto.getRandomValues`, 혼동 문자 제외, 12자 이상) → `auth.admin.updateUserById` → 대상 `must_change_password = true`.
* CORS: `https://eversunk2-tech.github.io`, `http://localhost:3000`만. OPTIONS 처리.
* 임시 비밀번호는 응답에만 포함, 로그 출력 금지.
* `supabase/functions/admin-reset-password/README.md`에 사용자용 배포 방법 A(CLI) / B(대시보드 에디터) 단계를 한국어로. JWT 검증 설정 포함.

## 수정 범위
* 수정 가능: `src/**`, `supabase/migrations/20260921020000_admin_learning.sql`(신규), `supabase/functions/**`(신규), `package.json`/`package-lock.json`(필요 시).
* 수정 금지: 기존 마이그레이션, `next.config.ts`, `CLAUDE.md`, `AGENTS.md`, `.github/**`, `.env*`, `.gitignore`, `public/apps/**`, `scripts/**`, `docs/**`(보고 파일 제외).
* 단계 5~10(웹앱 기록, 글 읽기, 참여 집계, 과제, 피드백, 개요 통계, `/me/learning/`)은 만들지 않는다. 단 사용자 메뉴의 링크 등은 존재하는 페이지만.
* `tsconfig`/eslint 설정에서 `supabase/functions/**`가 Next 빌드·lint에 포함돼 오류가 나면 제외 설정이 필요할 수 있다 → 그 경우 `tsconfig.json`/`eslint.config.mjs`의 exclude 추가는 허용.
* git commit/push 금지.

## 환경
* `.env.local`은 실제 Supabase에 연결돼 있다. **실 DB에 쓰기 금지**(읽기만). 새 테이블은 아직 없으므로 해당 쿼리는 실패할 수 있음 — 오류 상태 UI로 처리.
* `npm run lint`, `npm run build` 반드시 통과. `out/`에 새 라우트 생성 확인.

## 완료 보고
`docs/admin/build-a-report.md`: 파일 목록, spec과 다른 점, 사용자가 할 일(SQL 실행, Edge Function 배포), 단계 B가 재사용할 것.
