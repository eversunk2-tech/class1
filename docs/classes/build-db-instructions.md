# Build 지침(DB·서버 함수) — 반별로 나눠 보이게 하기 (2026-09-26)

당신은 **Build(DB)** 담당이다. `docs/classes/spec.md`(**끝의 "개정 1"이 본문보다 우선** — 권한 표 1-1, 흐름 1-2, 데이터 1-3, 이름표 1-4)를 SQL 마이그레이션과 Edge Function으로 구현한다. 화면(`src/`)은 다른 Build 담당이 **같은 이름표(1-4)**로 동시에 만든다 — 이름표를 바꾸지 말 것(꼭 바꿔야 하면 보고서 맨 위에 적는다).

## 먼저 읽기
`CLAUDE.md`(Supabase·SQL 적용 절차·42P17 재귀 금지·service_role은 Edge Function만·함수 재배포 안내), `docs/classes/spec.md` 전체(특히 개정 1), `supabase/migrations/*.sql` 전부(현재 정책·함수의 **실제 정의**를 옮겨 적어야 한다), `supabase/functions/admin-create-member|admin-reset-password|admin-delete-member/index.ts`와 README, `docs/classes/setup-owl-class.sql`(부엉이반 설정 틀 — 이 파일의 표·열 이름과 맞출 것).

## 만들 것
1. **`supabase/migrations/20260927000000_classes_schema.sql`** — 동작 변화 없음(기존 정책·함수는 건드리지 않는다):
   * 개정 1-4의 표 2개·열 3개(`profiles.class_id`·`is_super_admin`은 **공개 열 권한에 넣지 않음** — `20260922000000_admin_learning_fixes.sql`의 `grant select (…) on public.profiles` 방식 확인), RLS 켜기, 표 권한(`classes`·`class_teachers` SELECT 정책, 쓰기는 권한 없음 → RPC만).
   * 함수 `is_super_admin()`, `my_class_ids()`, `teaches_student(uuid)`(총괄 예외 없음), `can_manage_member(uuid)` — 실행 권한은 기존 `is_admin()`과 같게(anon 요청이 정책을 평가할 때 `permission denied`가 나지 않게 — `20260923010000_login_required.sql` review S1).
   * RPC `my_admin_context()`, `create_class(text)`, `rename_class(uuid, text)` — 입력 검사(이름 앞뒤 공백 제거, 1~40자), 한국어 오류 문구.
   * `member_directory.class_id` + `profiles` → `member_directory` 동기화 트리거(`after update of class_id` + 새 회원 행이 생길 때 값이 맞게 — 기존 `sync_member_directory` 흐름 확인).
   * 재귀(42P17) 없음 확인(정책이 부르는 함수가 같은 표 정책을 다시 부르지 않게 — 이유를 주석으로).
2. **`supabase/migrations/20260927010000_classes_rls.sql`** — 권한 좁히기:
   * 맨 앞 가드: 총괄(`is_super_admin`)이 한 명도 없으면 `raise exception`(부엉이반 설정 SQL을 먼저 — 관리자 잠김 방지).
   * `is_admin()`을 쓰는 **모든** 정책·함수·트리거를 grep으로 모아 표로 분류해 보고서에 적고 바꾼다: 학생 기록 접근 → `teaches_student(…)`(spec §3.4 표 + 빠진 것), 계정 관리(`member_directory`·감사 로그 3개 SELECT) → `can_manage_member(…)`, 사이트 설정 `admin_set_login_required` → 총괄만, `admin_set_role` → 개정 1-4대로, `admin_dashboard_stats()` → 내 학급 학생 기준(총괄도 자기 반), 콘텐츠(블로그 글·과제 내용·칭찬 문구·커뮤니티 숨기기·신고) → **그대로 `is_admin()`**(개정 1-5).
   * 정책은 `drop policy if exists` + `create policy`(이름은 63바이트 안 — 한글 1자 3바이트, 길면 잘려 저장됨. 기존 이름이 이미 잘려 있을 수 있으니 drop은 원래 긴 이름 그대로 써도 같은 방식으로 잘려 맞는다), 함수는 `create or replace`. 재실행 안전.
   * 파일 맨 위에 실행 방법·실행 순서(① schema → ② `docs/classes/setup-owl-class.sql`(이메일 바꿔서) → ③ 이 파일 → ④ 함수 3개 재배포 → ⑤ 화면)·확인 쿼리(anon·학생·다른 반 교사 흉내: `begin; set local role authenticated; select set_config('request.jwt.claims', '{"sub":"<id>","role":"authenticated"}', true); … rollback;`).
3. **Edge Function 3개**(개정 1-4): `admin-create-member`(요청에 `classId`, 학생 행은 호출자가 담임인 학급만 — 총괄도 자기 학급만, 교사 행 `role:"admin"`은 총괄만·학급 없음, 생성 뒤 `profiles.class_id` 설정), `admin-reset-password`·`admin-delete-member`(호출자가 총괄이거나 대상 학생의 담임일 때만 — 서비스 롤로 `profiles`·`class_teachers`를 읽어 판단, `auth.uid()` 함수는 서비스 롤에서 못 씀). 오류는 기존 형식(한국어 메시지·상태 코드)대로. 각 README 갱신. `--no-verify-jwt` 금지, CORS·로그 규칙 그대로(비밀번호·이메일을 로그에 남기지 않음).
4. `docs/classes/setup-owl-class.sql`의 표·열 이름이 실제 스키마와 맞는지 확인(틀린 곳이 있으면 이 파일만 고친다 — **실제 이메일은 절대 넣지 않는다**).

## 규칙
* SQL을 실행하거나 실 DB에 접속하지 않는다(로컬 Postgres 없음 — 꼼꼼히 읽어서 검토). Deno 도구가 없으면 설치하지 않는다(타입 점검은 읽어서). git commit/push 금지, 아무것도 내려받거나 설치하지 않는다.
* 수정 범위: `supabase/migrations/`의 새 파일 2개, `supabase/functions/admin-*/`(index.ts·README), `docs/classes/setup-owl-class.sql`, 보고서. **`src/`·`public/`·`scripts/`는 건드리지 않는다**(다른 담당·다른 작업 중).
* 이메일·비밀번호·키를 파일·로그에 쓰지 않는다.

## 보고서 `docs/classes/build-db-report.md`
만든 파일, `is_admin()` 사용처 분류 표(무엇을 무엇으로), 새 함수·RPC 목록(인자·반환·권한), 재귀 점검, Edge Function 변경 요지, 사용자가 할 일(순서대로), 확인 쿼리, 걱정되는 점. 한국어로 간결하게.
