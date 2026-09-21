# Build(수정) 서브에이전트 지침: docs/admin/review.md 1차 수정

## 목표
`docs/admin/review.md` 문제를 아래 표대로 처리한다. 기본은 각 항목의 "수정 제안"을 따르되, 더 나은 방법이면 보고서에 이유를 적는다.

| # | 처리 |
|---|---|
| 1 | 수정 (FK 힌트로 모호성 해소). 같은 패턴의 다른 임베드도 전수 점검 |
| 2 | **관리자 계정(자기 자신 포함)은 초기화 불가**로 막는다(다른 관리자를 초기화하려면 먼저 관리자 해제). UI에서도 버튼 비활성 + 안내 |
| 3 | 학생이 `needs_revision` 제출물을 수정하면 상태를 `submitted`(검토 대기)로 되돌린다. `reviewed` 제출물은 학생 수정 불가(삭제도 기존 규칙대로 불가) — UI 반영 |
| 4 | 1000행 제한: 집계는 서버 RPC(count/group by)로 옮기거나 페이지 반복 조회. 표기 문구를 사실에 맞춘다. 배지와 목록이 일치하도록 |
| 5 | 읽음 시각을 서버 `now()` 대신 **화면에 표시한 마지막 메시지의 created_at**으로 기록(RPC 인자 추가, 미래 시각·다른 스레드 방지 검증) |
| 6 | 클라이언트가 호출하는 `clear_must_change_password` 제거(또는 실행 권한 회수). 대신 `auth.users.encrypted_password` 변경 시 트리거로 `must_change_password = false`. 단 Edge Function이 임시 비밀번호로 바꿀 때 해제되지 않도록 순서/조건 설계(예: Edge Function이 비밀번호 변경 **후** 플래그를 true로 설정하므로 트리거가 먼저 false로 만든 뒤 true가 됨 — 검증해서 확실히) |
| 7 | 수정 (URL 길이: 청크 분할 또는 RPC, 연결 대상 조회 실패 시 오류 처리) |
| 8 | 수정 (context_id 소유 검사) |
| 9 | 수정 (사용자 바뀌면 `wasAllowed` 초기화) |
| 10 | 수정 (프로필 조회 실패 시 기존 값 유지 + 게이트는 판단 불가 상태로 대기/재시도) |
| 11 | #6 트리거 방식으로 대부분 해소. 남는 문구 문제 수정 |
| 12~16 | 수정 |
| 17 | `must_change_password`는 본인·관리자만 조회 가능하게(컬럼 권한 또는 별도 뷰/RPC). 기존 코드의 profiles 조회가 깨지지 않게 전부 점검 |
| 18 | 수정 |
| 19 | 유지 (로컬 개발에 필요). 보고서에 한 줄 |
| 20 | 초기화 시 대상의 기존 세션 무효화 구현(가능한 방법 조사: 서비스 롤로 호출 가능한 security definer SQL 함수로 `auth.sessions`/`auth.refresh_tokens` 정리 등, `service_role`에만 실행 권한). 감사 로그 테이블(누가 언제 누구를 초기화) 추가 |
| 21, 22, 25 | 코드 수정 없음. 21은 `scripts/templates/class1-record.js` 상단 주석과 보고서에 경고 명시(신뢰할 앱만) — 해당 파일 주석 수정 허용 |
| 23, 24 | 수정 |

## 읽을 것
`CLAUDE.md`, `AGENTS.md`, `docs/admin/spec.md`(§14 우선), `docs/admin/review.md`, `docs/admin/build-a-report.md`, `docs/admin/build-b-report.md`, 모든 마이그레이션, `supabase/functions/admin-reset-password/index.ts`.

## 수정 범위
* 수정 가능: `src/**`, `supabase/functions/admin-reset-password/**`, `scripts/templates/class1-record.js`, 새 파일 `supabase/migrations/20260922000000_admin_learning_fixes.sql`, `package.json`/`package-lock.json`(필요 시).
* 기존 마이그레이션 파일 수정 금지(이미 실 DB에 적용됨). 모든 DB 변경은 새 파일에, 재실행 안전하게.
* 수정 금지: `next.config.ts`, `CLAUDE.md`, `AGENTS.md`, `.github/**`, `.env*`, `.gitignore`, `public/apps/**`, `docs/**`(보고 파일 제외).
* git commit/push 금지.

## 환경
실 Supabase 연결. **실 DB 쓰기 금지**(읽기와 거부되는 쓰기 시도만). 새 마이그레이션·Edge Function은 파일만 만들고 사용자가 적용/재배포한다. `npm run lint`, `npm run build` 반드시 통과.

## 완료 보고
`docs/admin/fix-1-report.md`: 항목별 처리(파일:줄), 제안과 다르게 한 것, 사용자가 할 일(SQL 실행, Edge Function 재배포 — 순서 포함).
