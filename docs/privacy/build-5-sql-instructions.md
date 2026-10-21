# 묶음 5 지침 — SQL·함수: 학생 아이디·이름 가리기 + 보유 기한 맞추기 (구현 담당 E, 2026-10-20)

먼저 `docs/privacy/build-common.md`를 읽는다. 스크래치 `privacy-b5/`. 브라우저·개발 서버는 쓰지 않는다.

## 기준
- `docs/privacy/spec.md` **4.11(개정 4)** — 이름표(함수 이름·인자·돌려주는 모양)가 계약이다. 화면 담당(묶음 6)이 같은 이름으로 동시에 작업한다. 바꿔야 하면 바꾸지 말고 보고서에 적는다.
- `docs/privacy/spec.md` 4.7-3(개정 3 — 보유 기한 "종업식 뒤 그 학년도의 2월 28일까지"), `docs/privacy/build-4-report.md` 3절·7절(화면이 읽는 `admin_class_retention_status` 필드 이름).
- 세 SQL은 **아직 사용자가 실행하지 않았다** → 같은 파일을 고친다(새 파일 만들지 않음). `admin-clear-students`도 아직 배포 전이라 같은 파일을 고친다.

## 고칠 파일(이것만)
- `supabase/migrations/20261020000000_privacy_a_schema.sql` (①)
- `supabase/migrations/20261020010000_privacy_b_enforce.sql` (②)
- `supabase/migrations/20261020020000_privacy_c_profiles_members_only.sql` (③)
- `docs/privacy/rollback-privacy-enforce.sql`, `docs/privacy/rollback-profiles-members-only.sql`, `docs/privacy/test-queries.sql`
- `supabase/functions/admin-clear-students/index.ts`, `supabase/functions/admin-clear-students/README.md`
- 보고서 `docs/privacy/build-5-report.md`

## 할 일

### 1. 보유 기한 2월 28일 (①의 `admin_class_retention_status`와 주석)
- 지금 함수는 옛 기한(3월 31일, 4월 1일부터 지남)이다. spec 4.7-3 개정 3대로 고친다(한국 시간 날짜 기준):
  - 학년도 시작 S = 오늘이 지난 가장 최근 3월 1일(1·2월이면 지난해 3월 1일).
  - **기한 지남(overdue)** = S 해의 2월 1일 전에 만든 학생 계정(탈퇴 처리된 학생 포함) — 그 학년도는 이미 끝났고 기한(2월 28일)이 지났다. **오늘이 윤년 2월 29일이면** 올해 2월 1일 전에 만든 학생도 기한 지남으로 센다.
  - **2월 알림(february)** = 오늘이 2월 1~28일이면, S 해의 2월 1일 ~ 올해 2월 1일 사이에 만든 학생(이번 학년도 학생 — 2월 28일까지 정리할 학생). 올해 2월에 만든 계정(겨울방학 미리 등록)은 새 학년도라 세지 않는다.
- 돌려주는 모양: 지금 키(`today`·`school_year_start`·`cutoff`·`deadline`·`past_deadline`·`due_total`·`overdue_total`, 학급마다 `class_id`·`class_name`·`old_students`·`students`)를 **그대로 두고**, 학급마다 `overdue_students`·`february_students`, 위에 `in_february`(bool)·`february_total`을 더한다. `deadline`은 그 학년도의 2월 28일. `past_deadline` = 기한 지남 학생이 생길 수 있는 날(3월 1일 ~ 다음 해 1월 말, 그리고 2월 29일)인지. `old_students` = 그 학급의 `overdue_students + february_students`(옛 화면 호환). 학급 줄은 둘 중 하나라도 0보다 클 때만. 화면(묶음 4)은 `overdue_students`·`february_students`가 있으면 그것을 먼저 읽는다(보고서 3절) — 맞는지 대조해 보고서에 적는다.
- 파일 머리 주석·함수 주석의 3월 31일 설명, 확인 쿼리, `test-queries.sql`의 해당 부분을 새 규칙으로. 날짜 계산은 손으로 예를 몇 개 들어 확인(3월 1일, 1월 15일, 2월 10일, 2월 28일, 윤년 2월 29일, 12월 31일)하고 보고서에 표로.

### 2. 학생 아이디·이름 가리기 (spec 4.11)
- ①에 함수 5개: `mask_label`, `can_see_member_name`, `can_see_member_identity`, `member_name_labels`, `admin_masked_member_rows` — spec 4.11 표대로(권한: 판별 함수 2개는 PUBLIC 실행 — `is_admin()`과 같은 방식, RPC 2개는 `authenticated`만, `mask_label`은 `immutable`).
  - **가린 이름의 원래 값** = `display_name`(앞뒤 공백 뺌), 비었으면 아이디(`member_directory.email`의 `@` 앞). `member_name_labels`·`admin_masked_member_rows`·`admin-clear-students`가 **모두 이 같은 규칙**으로 가려야 화면의 확인 입력(보이는 대로 `2***`)과 함수의 비교가 맞는다.
  - `can_see_member_name`: "같은 학급 학생" 판단은 호출자 프로필이 role user이고 `class_id`가 대상과 같을 때. "그 학급 담임"은 `class_teachers` + `is_admin()`(= `teaches_student`와 같은 뜻 — 재사용 가능). 인증 전 구글(`is_pending_google()`)은 본인만.
  - ① 머리의 함수 목록·확인 쿼리(함수 존재·권한 점검 표 — 1600줄 근처)에 새 함수를 넣는다.
- ②: `member_directory`·`password_reset_log`·`member_withdrawal_log`·`member_create_log`의 읽기 정책을 `can_see_member_identity(…)`로(옛 `…: 담임·총괄 조회` drop), `admin_must_change_password_ids()` 범위, `admin_set_role` 거부 문구 "다른 학급 학생은 교사로 지정할 수 없어요."(②가 이미 다시 정의하는 함수 — 거기에 더함). ② 맨 끝 점검이 이 표들을 다루면 맞춘다.
- ③: `profiles` 새 읽기 정책 식을 `public.can_see_member_name(id)`로. 맨 앞 점검에 ①의 이 함수가 있는지 더한다. 머리 설명(로그인한 회원 전체 → 학생은 같은 학급·담임만)을 고친다.
- **전수 조사**: 모든 마이그레이션에서 지금 살아 있는 `security definer` 함수·뷰 가운데 학생의 `display_name`·`email`·`target_email`·`target_name`을 돌려주는 것을 찾아, 총괄(또는 다른 학급 교사)에게 다른 학급 학생 값을 주는 곳이 있으면 같은 규칙으로 가리고(②에서 다시 정의) 보고서에 표로 적는다. 정책 안에서 `profiles`를 함수 없이 직접 조회하는 곳이 있으면(③ 뒤 결과가 바뀜) 보고서에.
- 되돌리기: `rollback-privacy-enforce.sql`은 ②에서 바꾼 4개 정책·`admin_must_change_password_ids`·`admin_set_role`을 ② 전 정의로. `rollback-profiles-members-only.sql`은 그대로인지 확인. ①의 새 함수는 ① 되돌리기가 없으므로 남아도 해가 없는지 적는다.
- `test-queries.sql`: spec 4.11 '시험'의 경우를 읽기 전용 흉내로(`set local role authenticated` + `request.jwt.claims`, 자리표시 `'<학생A id>'` 등, 결과는 개수·참거짓·가린 값 모양만, 끝은 `rollback`). 실제 이름·아이디를 결과로 찍지 않는다.

### 3. `admin-clear-students` (학생 한 명 경로)
- 총괄이 그 학생의 담임이 아니면 `confirmName`을 **가린 이름**(위 규칙: 원래 이름의 첫 글자 + `***`, 비었으면 `***` — SQL `mask_label`과 같은 결과: 앞뒤 공백 뺀 뒤 첫 **글자**(코드 포인트, `Array.from`))과 비교, 담임이면 지금처럼 원래 이름과 비교. 응답·로그·오류 문구에 이름·아이디를 넣지 않는다(지금 그런지도 확인). README에 규칙 한 줄.
- 타입 검사: Deno가 없으므로 묶음 2 보고서(`build-2-report.md`)가 한 방법(로컬 `tsc` 흉내·가짜 서버)을 따른다. 시험: 담임/총괄 × 맞는 이름/가린 이름/틀린 이름.

## 반드시
- `build-1-sql-instructions.md`의 "반드시" 절 전부(재실행 안전, `set search_path = ''`, 스키마 붙인 이름, 63바이트, `any (public.f())`, 정책 안 재조회 금지, 권한 revoke/grant).
- 바꾼 곳마다 주석에 "개정 4" 또는 "개정 3"을 적는다.
- 실 DB 없음 — 문법·이름·권한을 눈으로 끝까지 대조. 묶음 6(화면)이 부를 RPC 두 개의 **돌려주는 JSON 키 이름**을 보고서에 그대로 적는다.

## 보고서 `docs/privacy/build-5-report.md`
만든 것·고친 곳(파일·함수·정책), 날짜 계산 표, 전수 조사 표, 계약과 다른 곳, 새 문장(오류 문구 등 글자 그대로), 확인하지 못한 것, 묶음 6·메인에게 넘길 것.
