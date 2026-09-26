# Build 지침(class-assignments) — 과제도 학급별로 (2026-09-26, spec 개정 3-2)

당신은 **Build** 담당이다. SQL 하나와 관리자 과제 화면을 고치고 검증해 보고서를 쓴다(검토는 다른 에이전트). **실 DB에 실행하지 않는다**(SQL은 사용자가 실행).

## 사용자 결정(그대로 — 합격 기준)
"1번으로 과제도 학급별로 나눠줘" — 설계는 `docs/classes/spec.md` 끝의 **개정 3**(3-2가 이번 일, 3-1은 바로 앞 단계 ⑤ `20260927030000_content_owner_only.sql` — 커밋 `b3d7ee1`, 아직 실행 전·검토 중).

## 먼저 읽기
`CLAUDE.md`(Supabase·**SQL 적용 절차** — 특히 "배열 반환 함수와 비교할 때 `x = any (public.f())`로 쓴다(`any ((select …))` 금지)", 재실행 안전, 42P17, 정책 이름 63바이트, 저장소 공개), `docs/classes/spec.md` 개정 1·2·3, **`supabase/migrations/20260927030000_content_owner_only.sql`**(⑤ — 과제 작성·수정·삭제 정책과 열 권한, 이 파일이 먼저 실행된다), 과제 표·정책의 지금 정의(`20260921020000_admin_learning.sql` assignments·assignment_submissions, `20260923010000_login_required.sql` 3.6 "assignments: 공개된 것은 누구나, 관리자는 전체 조회"(67바이트 → 저장 때 잘림)), 판별 함수(`20260927000000_classes_schema.sql`의 `my_class_ids()`·`is_super_admin()`, `20260927020000_class_notices.sql`의 `my_student_class_id()`), 화면 `src/app/admin/(dashboard)/learning/assignment-manager.tsx`·`submission-review.tsx`·`src/lib/learning.ts`·`src/hooks/use-admin-context.tsx`(학습 현황 학급 범위 `scopeClassIds`)·`src/components/admin/class-controls.tsx`(학급 고르기)·학생 `src/app/me/learning/my-assignments.tsx`, 보고 `docs/classes/build-owner-only-report.md`.

## 만들 것
1. **SQL ⑥ `supabase/migrations/20260927040000_class_assignments.sql`**(재실행 안전, 맨 위 실행 방법·순서(⑤ 다음)·확인 쿼리, 맨 앞 가드: ①·④ 함수와 **⑤의 정책이 없으면 멈춤**("⑤를 먼저"), 맨 끝 스스로 점검 — 어긋나면 전부 되돌림, 되돌리는 방법 주석):
   * `assignments.class_id uuid references public.classes(id)`(지우기 동작은 까닭과 함께 정함) + 인덱스. 지금 행 채우기: 만든 선생님(`created_by`)이 담임인 학급(여럿이면 가장 먼저 연결된 것) → 없으면 총괄이 담임인 학급(부엉이반). 채운 뒤 **not null**.
   * 보기(SELECT) 정책: 옛 "공개된 것은 누구나, 관리자는 전체 조회"를 지우고 → 학생 = `published and (select public.can_browse()) and class_id = (select public.my_student_class_id())`, 교사 = `is_admin() and (class_id = any (public.my_class_ids()) or created_by = auth.uid() or is_super_admin())`. 비로그인은 없음. (역할별 두 정책 또는 하나로 — 까닭과 함께)
   * 만들기(INSERT) 정책(⑤의 "교사 본인 이름으로 작성")을 바꿔 **자기 학급에만**: `... and class_id = any (public.my_class_ids())`.
   * 고치기·지우기(⑤) 그대로. 열 권한: 과제의 학급(`class_id`)은 고칠 수 없게(⑤의 update 열 목록에 넣지 않음 — 확인).
   * 제출(`assignment_submissions` "본인이 공개 과제에 제출")은 과제 조회를 거치므로 보기 규칙을 따라 자동으로 좁아지는지 확인(필요하면 명시적 조건 추가 — 42P17 재귀 주의).
   * 정책 이름 63바이트 안, 42P17 없음, 확인 쿼리(학급 없는 과제 0, 반별 과제 수, 정책 목록), 흉내 확인(학생 = 자기 반만, 다른 반 과제에 제출 불가 — 저장되지 않게).
2. **화면**:
   * `src/lib/learning.ts`: 과제 만들기에 `class_id`, 관리자 과제 목록을 학급 범위(`class_id=in.(…)`)로 읽기, 과제에 학급 이름(관리자 화면에서만).
   * `assignment-manager.tsx`: 새 과제 대화 상자에 학급 고르기(학급 1개면 자동·숨김, 여럿이면 필수, 없으면 "먼저 학급을 개설해 주세요"), 목록은 학습 현황의 학급 범위(학급 고르기와 같이 움직임), 학급이 여럿이면 과제마다 학급 이름. ⑤의 "쓴 선생님과 총괄만" 표시·버튼 끄기는 그대로.
   * 학생 화면(`my-assignments.tsx`)은 원칙적으로 그대로(RLS) — 학생에게 학급 이름·id를 보이지 않는다.
   * ⑥ 전(열 없음)에도 화면이 깨지지 않게(예전 동작 + 필요한 곳에 "SQL 실행 필요" 안내 — 기존 "학급 기능 준비 전" 방식 참고).
3. 보고서 `docs/classes/build-class-assignments-report.md`(바꾼 것, 정책 표, 행위자별 결과 표, 시험 수치, 한계, 사용자 실행 순서 ⑤ → ⑥ → push).

## 규칙
* 수정 범위: 새 SQL 파일, 위 화면·lib·hook 파일, 보고서. `public/`·`scripts/`·`supabase/functions/`·홈(`teacher-posts.tsx`·`page.tsx`)은 건드리지 않는다. ⑤ 파일(`20260927030000_…`)은 **고치지 않는다**(다른 검토 중 — ⑤와 어긋나는 점이 있으면 보고서에).
* SQL 실행·실 DB 접근 금지(로컬 Postgres 없음 — 기존 정의와 **한 줄씩 대조**, 특히 실행 때 오류가 날 곳), git commit/push 금지, 내려받기·설치 금지, `localStorage.clear()` 금지.
* 검증: `npm run lint`·`npx tsc --noEmit`. 빌드는 **저장소 `out/`에 하지 않는다**(다른 담당이 동시에 쓴다): `git archive HEAD`를 스크래치에 풀고 작업 파일을 덮어쓴 사본에서 `node_modules` 링크 + 가짜 Supabase 주소·키로 빌드(`docs/classes/review-links.md` 방식). 자기 정적 서버(포트 **8791**) + 자기 전용 headless Chrome(포트 **9362**, 프로필은 `/private/tmp/claude-501/-Users-sungchul-Desktop-classroom/7bf3a39e-3017-4189-b337-1b82aace66bb/scratchpad/class-assignments/`) + Supabase 차단 + 첫 로드부터 CDP `Fetch` 가짜 응답(학급 2개·교사 2명·학생 반별, 가짜 RLS) + 캐시 끄기. 시험 도구는 `…/scratchpad/owner-only/`를 **자기 폴더로 복사해서** 쓴다. 다른 포트(8784·8786·8788·8789·9353·9355·9360) 건드리지 않기. 끝나면 서버·Chrome 종료.
