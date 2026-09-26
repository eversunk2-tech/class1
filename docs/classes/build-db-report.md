# Build 보고서(DB·서버 함수) — 반별로 나눠 보이게 하기 (2026-09-26)

> 기준: `docs/classes/spec.md` 개정 1(1-1 권한 표 · 1-2 흐름 · 1-3 지금 데이터 · 1-4 이름표), 지침 `build-db-instructions.md`.
> **이름표(1-4)는 하나도 바꾸지 않았다** — 표 `classes`·`class_teachers`, 열 `profiles.class_id`·`profiles.is_super_admin`·`member_directory.class_id`,
> 함수 `is_super_admin()`·`my_class_ids()`·`teaches_student(uuid)`·`can_manage_member(uuid)`, RPC `my_admin_context()`·`create_class(text)`·`rename_class(uuid, text)`,
> 요청 필드 `classId` 모두 그대로. SQL 실행·실 DB 접속·설치·커밋은 하지 않았다.

## 0. 먼저 확인할 결정 1개 (1-4 문구와 세부가 다름)
`admin_set_role` 담임 **해제** 규칙: 1-4는 "담임 학급이 남은 교사는 내리기 거부", 1-2는 까닭을 "학생 기록이 아무에게도 안 보이게 되는 일을 막음", 안내는 "넘기거나 비워 주세요"라고 적었다. 까닭과 안내에 맞춰 이렇게 만들었다:
* **거부**: 그 교사가 **학생이 있는 학급의 유일한 담임**일 때(학생 = role 'user', 탈퇴한 학생 포함).
* **허용**: 맡은 학급이 모두 비어 있거나 다른 담임이 함께 있을 때 → 그 교사의 담임 연결을 지우고, 담임이 아무도 안 남은 **빈** 학급은 지우지 않고 `archived_at`으로 보관.
* 글자 그대로("학급이 하나라도 있으면 거부")를 원하면 `20260927010000_classes_rls.sql` 5-2의 `v_blocking` 조건 한 곳만 바꾸면 된다.

## 1. 만든·바꾼 파일
| 파일 | 내용 |
|---|---|
| `supabase/migrations/20260927000000_classes_schema.sql` (새) | ① 표 2·열 3·인덱스, profiles 열 권한 재확인 + 스스로 점검, 판별 함수 4, `classes`·`class_teachers` RLS(읽기만), 동기화 트리거 2, RPC 3. **기존 정책·함수는 안 건드림 → 동작 변화 없음** |
| `supabase/migrations/20260927010000_classes_rls.sql` (새) | ③ 맨 앞 가드(①·총괄 없으면 거부), 정책 18개 교체, 함수 8개 다시 씀, 맨 끝 스스로 점검(학생 기록·회원 표에 `is_admin()`이 남으면 전부 되돌림) |
| `supabase/functions/admin-create-member/index.ts`·`README.md` | `classId`, 학생 줄 = 호출자가 담임인 학급만, 교사 줄 = 총괄만, `profiles.class_id` 설정 |
| `supabase/functions/admin-reset-password/index.ts`·`README.md` | 총괄 또는 대상 학생의 담임만 |
| `supabase/functions/admin-delete-member/index.ts`·`README.md` | 총괄 또는 대상 학생의 담임만(계정 삭제 전에 확인) |
| `docs/classes/setup-owl-class.sql` | 표·열 이름은 스키마와 일치. 고친 곳: ① 실행 순서의 실제 파일명, ② 프로필이 없으면 조용히 넘어가던 것 → 오류, ③ **지금 관리자가 아닌 계정은 총괄로 지정 거부**(이메일 오타로 학생이 총괄이 되는 일 방지), ④ 오류 문구에서 이메일 제거(DB 로그에 남지 않게). 실제 이메일은 넣지 않음 |

## 2. `is_admin()` 사용처 분류 (지금 유효한 정의 기준, 마이그레이션 13개 grep)
| 무엇(현재 정의 파일) | 분류 | 바뀐 뒤 |
|---|---|---|
| `app_results` 조회 "본인 또는 관리자 조회"(0921020000) | 학생 기록 | "본인 또는 담임 조회": `auth.uid()=user_id or teaches_student(user_id)` |
| `app_results` 삭제 "관리자만 삭제" | 학생 기록 | "담임만 삭제": `teaches_student(user_id)` (1-1: 총괄도 다른 반 ❌ — §3.4 초안의 총괄 예외는 뺌) |
| `app_progress` "관리자 조회"(0922010000) | 학생 기록 | "담임 조회": `teaches_student(user_id)` |
| `post_reads` "본인 또는 관리자 조회" | 학생 기록 | "본인 또는 담임 조회" |
| `assignment_submissions` 조회·수정·삭제 3개 | 학생 기록 | "본인 또는 담임 조회/수정/삭제"(삭제의 학생 조건 — 마감 전·검토 전 — 그대로) |
| 트리거 `assignment_submission_guard()`(0922000000, 3곳) | 학생 기록 | `teaches_student(new/old.user_id)` |
| `feedback_threads` 조회·삭제 | 학생 기록 | "본인 또는 담임 조회", "담임만 삭제" |
| `feedback_messages` 조회·보내기 | 학생 기록 | 스레드의 학생 본인 또는 `teaches_student(t.student_id)` (이름: "본인·담임 스레드만 조회", "본인 발신, 본인·담임 스레드만") |
| `feedback_read_marks` "본인만 조회/기록"의 with check | 학생 기록 — **§3.4 표에 빠져 있던 것** | 같은 이름, `teaches_student(t.student_id)` |
| `get_or_create_feedback_thread`, `mark_thread_read(uuid,timestamptz)`, `unread_feedback_count()` | 학생 기록 | `teaches_student(…)` |
| `member_directory` "관리자만 조회"(0921020000) | 계정 관리 | "담임·총괄 조회": `can_manage_member(id)` |
| `password_reset_log`·`member_withdrawal_log`·`member_create_log` "관리자만 조회" | 계정 관리 | "담임·총괄 조회": `can_manage_member(target_id)` |
| `admin_must_change_password_ids()`(0922000000) | 계정 관리 — **§3.4 표에 빠져 있던 것** | `can_manage_member(p.id)` (명단과 같은 범위) |
| `admin_set_login_required`(0923010000) | 사이트 설정 | `is_super_admin()`만 |
| `admin_set_role`(0921020000) | 역할 | 총괄만 + 개정 1-2·1-4(§0) |
| `admin_dashboard_stats()`(0921020000) | 개요 숫자 | 내 학급 학생 기준(총괄도) — 반환 모양 그대로 |
| `posts` 4개, `comments` 조회·삭제(0923010000·0921000000) | 콘텐츠 | **그대로 `is_admin()`** (개정 1-5) |
| `assignments` 조회·"작성/수정/삭제" | 콘텐츠(과제 내용) | 그대로 |
| `praise_presets` 4개 | 콘텐츠(칭찬 문구) | 그대로 |
| `community_posts`·`community_comments`·`community_likes` 읽기(0926000000)·수정·삭제, `community_reports` 조회·신고·삭제, 함수 `set_community_post_hidden`·`set_community_comment_hidden`·`set_community_report_status`·`resolve_community_reports_for`, 트리거 `community_posts_guard` | 콘텐츠·신고 | 그대로 (5단계에서 정리) |
| storage `game-uploads` 조회·삭제 | 콘텐츠 | 그대로 |
| `is_admin()` 자체, 클라이언트 `admin-guard.tsx`의 `rpc("is_admin")` | — | 그대로(교사 = 관리자) |

* `is_admin()`이 아닌 `role = 'admin'` 직접 검사(서비스 롤 전용 `admin_finalize_password_reset`·`admin_finalize_withdrawal`·`admin_log_member_create`)는 **그대로** — Edge Function이 먼저 담임·총괄을 확인한다. (SQL에도 반 검사를 넣으면 예전 함수가 돌 때 "비밀번호는 바뀌었는데 마무리 실패" 같은 반쪽 상태가 생길 수 있어 넣지 않음.)
* 코드 그대로 자동으로 좁혀지는 것(security invoker): `app_result_stats()`, `feedback_thread_summaries()`.
* `feedback_threads: 본인 또는 관리자 생성`(0922000000에서 이미 삭제)은 혹시 남아 있을까 봐 한 번 더 `drop`.
* spec §3.3의 학생용 `my_class_id()`는 **만들지 않음**(개정 1: 학생에게 소속 정보를 보이지 않음).

## 3. 새 함수·RPC (모두 `security definer`, `set search_path = ''`)
| 이름 | 인자 → 반환 | 실행 권한 | 내용 |
|---|---|---|---|
| `is_super_admin()` | → boolean | PUBLIC(= `is_admin()`) | 내 `is_super_admin` **그리고** `role='admin'` |
| `my_class_ids()` | → uuid[] | PUBLIC | 내가 담임인 학급(보관 포함). 관리자가 아니면 `{}` |
| `teaches_student(p_student uuid)` | → boolean | PUBLIC | `is_admin()` 이고 그 학생(role 'user')의 `class_id`가 내 학급. **총괄 예외 없음** |
| `can_manage_member(p_target uuid)` | → boolean | PUBLIC | `is_super_admin() or teaches_student(p_target)` |
| `my_admin_context()` | → jsonb `{"is_super_admin", "classes":[{"id","name","student_count"}]}` | authenticated | 관리자가 아니면 오류. classes = **내가 담임인 학급, 보관 제외**, `created_at` 순. student_count = 탈퇴 제외 학생 수 |
| `create_class(p_name text)` | → uuid | authenticated | 관리자 누구나, 만든 사람이 담임. 앞뒤 공백 제거·1~40자·제어 문자 불가·**내 학급끼리 같은 이름 불가**(두 번 누름 방지, advisory lock) |
| `rename_class(p_class_id uuid, p_name text)` | → void | authenticated | 그 학급 담임만(총괄도 남의 학급 ❌). 이름 규칙 같음 |
| `sync_member_directory_class()` / `member_directory_fill_class()` | 트리거 | 실행 권한 회수 | profiles.class_id 변경 → member_directory 복사 / member_directory 새 행 → profiles에서 채움(기존 `sync_member_directory()`는 안 고침) |

* 표 권한: `classes` SELECT = `id = any(my_class_ids()) or is_super_admin()`, `class_teachers` SELECT = `teacher_id = auth.uid() or is_super_admin()`(authenticated만, anon은 표 권한 없음), 쓰기는 아무에게도 없음 → RPC·`admin_set_role`·SQL로만. 서비스 롤에 SELECT를 명시.
* `profiles.class_id`·`is_super_admin`은 공개 열 목록에 없음(① 3-1에서 지금 목록 그대로 다시 적고, 새 열이 anon/authenticated에 열려 있거나 profiles에 INSERT 정책이 있으면 ①이 멈춤).
* 오류 문구는 모두 한국어(기존 서버 문구처럼 합니다체) — 화면은 한글이 든 메시지를 그대로 보여 준다.

## 4. 재귀(42P17) 점검
* 정책이 부르는 함수(`teaches_student`·`can_manage_member`·`is_super_admin`·`my_class_ids`)는 security definer(소유자 postgres)로 `profiles`·`class_teachers`만 읽는다 → 그 표들의 RLS를 거치지 않는다. 거친다 해도 `profiles` 정책은 `true`, `class_teachers` 정책은 `is_super_admin()`(→ profiles)뿐 → 어느 경로도 처음 표로 돌아오지 않음.
* `feedback_messages`·`feedback_read_marks` 정책 → `feedback_threads` 조회 → 그 정책은 `teaches_student`만 → 순환 없음. `classes` 정책 → `my_class_ids`(class_teachers)·`is_super_admin`(profiles) → 순환 없음.
* 정책 안에서 `profiles.class_id`를 직접 조회하지 않는다 — 열 권한 때문에 authenticated로는 permission denied가 난다. 그래서 학급 판단은 반드시 definer 함수로.
* 판별 함수는 PUBLIC 실행(review S1) → anon 요청이 정책을 평가해도 permission denied 없음.

## 5. Edge Function 변경 요지 (오류는 기존처럼 `{ "error": "한국어" }` + 상태 코드, CORS·로그 규칙 그대로, 비밀번호·이메일 로그 없음)
* 공통: 호출자 `profiles.role, is_super_admin`을 서비스 롤로 읽음(총괄 = 둘 다). 학급 SQL이 없으면(열·표 없음) "학급 기능용 DB 설정이 아직 적용되지 않았습니다…"로 거부(아무것도 안 바꿈).
* `admin-create-member`: 교사 줄 + 총괄 아님 → **그 줄만 `invalid`**("교사 계정은 총괄 관리자만…" — spec 초안의 `failed` 대신, 다시 시도해도 같아서). 학생 줄이 있으면 **계정을 만들기 전에** `class_teachers`·`classes`로 학급 확인: `classId` 없음 → 학급 1개면 자동, 0개 400 "먼저 학급을 개설해 주세요…", 여럿 400 "학생을 등록할 학급을 골라 주세요." / 형식 오류 400 / 내 학급 아님(없는 학급 포함) **403** "선생님이 담임인 학급에만…" / 보관 학급 403. 만든 뒤 `profiles.update({ role, must_change_password: true, class_id })`(학생 = 그 학급, 교사 = null), 실패하면 1회 재시도. (화면 `member-import.ts`는 403의 한국어 본문도 보여 주도록 이미 바뀌어 있음을 확인.)
* `admin-reset-password`·`admin-delete-member`: 관리자 대상 거부(그대로) 뒤, 총괄이 아니면 대상 `class_id`가 호출자의 `class_teachers`에 있어야 함 → 아니면 **403** "이 학생의 담임 선생님이나 총괄 관리자만 …". 탈퇴는 이 확인이 계정 삭제 **전**. 탈퇴 함수는 컬럼 없음 오류를 `class_id`/`withdrawn_at`으로 구분해 알맞은 SQL 파일을 안내.
* 타입 점검: Deno가 없어 설치하지 않고, 스크래치에 사본을 만들어(`npm:` import만 바꿈 + Deno 전역 선언) 프로젝트의 `tsc 5.9.3`(strict) + `@supabase/supabase-js 2.116.0` 타입으로 3개 모두 통과(일부러 넣은 오류는 잡힘 확인). 실제 배포 런타임(Deno, `npm:@supabase/supabase-js@2` 최신)과 버전이 조금 다를 수 있다.

## 6. 사용자가 할 일 (순서대로)
1. Supabase SQL Editor에서 **`supabase/migrations/20260927000000_classes_schema.sql`** 전체 Run → 파일 맨 위 확인 쿼리 1~6(특히 3: profiles 공개 열에 `class_id`·`is_super_admin` 없음, 5: `withdrawal_blocking_fks()` = `{}`). 이 단계까지는 사이트가 그대로다.
2. **`docs/classes/setup-owl-class.sql`**: SQL Editor에 붙여 넣고 `'총괄_이메일'`을 Claude가 대화로 알려 준 총괄 계정 이메일로 바꿔 Run(저장소 파일에는 적지 않는다) → 파일 끝 확인 쿼리(학급없는학생 0, 총괄 1명).
3. **`supabase/migrations/20260927010000_classes_rls.sql`** 전체 Run → 결과 메시지에 "✔ 학생 기록은 그 학생의 담임만…"이 보이면 성공. 오류("총괄 관리자가 아직 없습니다" 등)면 아무것도 바뀌지 않았으니 2번부터 다시.
4. 터미널에서 함수 3개 다시 배포(`--no-verify-jwt` 붙이지 않기):
   `npx supabase functions deploy admin-create-member` · `npx supabase functions deploy admin-reset-password` · `npx supabase functions deploy admin-delete-member`
5. 화면 push(Claude가 Review 뒤).
* 3번과 5번 사이(예전 화면)도 동작한다: 관리자가 총괄 1명뿐이고, 학급이 하나면 새 함수가 학급을 자동으로 고른다.

## 7. 확인 쿼리
`20260927010000_classes_rls.sql` 맨 위에 있다: 0) 흉내 낼 id 찾기, 1) 학생 기록·회원 표에 `is_admin()` 정책 0행, 2) 비로그인, 3) 학생, 4) 다른 반 교사(두 번째 교사가 생긴 뒤), 5) 총괄(명단 전체·기록은 자기 반만), 6) 함수 권한.
* 지침의 `begin; set local role …; … rollback;` 대신 **"한 번의 Run = 한 트랜잭션"** 형태로 적었다(같은 효과: `set local`·`set_config(…, true)`는 그 Run 안에서만 적용). SQL Editor는 마지막 문장(rollback)의 빈 결과만 보여 줄 수 있고, begin 안에서 오류가 나면 연결이 "중단된 트랜잭션"으로 남을 수 있어서다. 각 결과에 `current_user`(지금_역할)를 넣어 흉내가 실제로 됐는지 보이게 했다(postgres면 숫자를 믿지 말 것). psql에서는 begin/rollback을 붙인다.
* 같은 까닭으로 두 마이그레이션도 명시적 `begin/commit` 없이 SQL Editor의 한 트랜잭션에 기댄다(기존 파일들과 같은 방식). psql이면 `psql -1 -v ON_ERROR_STOP=1 -f`.

## 8. 걱정되는 점·화면 담당에게
1. **총괄 화면**: `member_directory`로 모든 회원이 보이지만 다른 반 학생의 학습 기록은 0건이다(의도). 회원 상세의 학습 탭·"미제출" 목록 등은 내 학급 id(`my_admin_context().classes`)로 걸러야 헷갈리지 않는다(`fetchStudents(classIds)`는 이미 그렇게 됨).
2. `admin_dashboard_stats().total_members` 뜻이 "전체 회원"에서 **"내 학급 학생 수(탈퇴 제외)"**로 바뀜 → 카드 문구 확인. 화면이 따로 세는 "오늘 결과"(app_results RLS)는 교사 본인의 시험 결과도 포함한다(작은 차이).
3. `my_admin_context().classes`는 보관 학급을 뺀다. `classes` 표(총괄은 전부·보관 포함, 담임은 자기 것)는 `archived_at`으로 거르면 된다. 보관은 지금 담임 해제(§0)나 SQL로만 생긴다.
4. 새로 가입한 OAuth 방문자·학급 없는 학생은 어느 담임에게도 안 보이고 총괄 명단에만 보인다. setup SQL은 지금 **모든** role 'user'(탈퇴한 학생, 혹시 있는 OAuth 방문자 포함)를 부엉이반에 넣는다(개정 1-3 그대로).
5. 성능: 학생 기록 정책이 행마다 `teaches_student()`(인덱스 조회 2~3번)를 부른다. 한 반 30~100명·앱 23개 규모면 문제없음. 여러 반·수만 행이 되면 `user_id = any((select my_student_ids()))` 같은 한 번 계산 방식으로 바꿀 수 있다.
6. ①은 profiles 열 권한을 **저장소에 적힌 지금 상태 그대로** 다시 적는다. 대시보드에서 따로 열 권한을 바꾼 적이 있다면 그 변경은 되돌려진다(문서상 그런 적 없음).
7. 콘텐츠(블로그 글·과제·칭찬 문구·게시판 숨기기·신고)는 개정 1-5대로 여전히 **교사 누구나 전체**를 고칠 수 있다.
8. 학생 아이디 충돌(spec §2.3)은 이번 범위 밖(운영 규칙) — 다른 반이 같은 아이디를 쓰면 "이미 있는 아이디"로 거부된다.
9. 확인하지 못한 것: 실제 SQL 실행(문법·권한은 읽어서만 검토 — 로컬 Postgres 없음), Supabase SQL Editor가 여러 문장을 한 트랜잭션으로 보내는지(Supabase에서 알려진 동작이지만 이 프로젝트에서 직접 보지는 못함), 실제 Edge Function 배포·호출, 두 교사 계정으로 교차 확인(spec §5 단계 2·3 Review 항목).
