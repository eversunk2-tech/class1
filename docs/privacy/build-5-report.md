# 묶음 5 보고 — SQL·함수: 학생 아이디·이름 가리기(개정 4) + 보유 기한 2월 28일(개정 3) (구현 담당 E, 2026-10-20)

> 지침: `build-common.md` → `build-5-sql-instructions.md`. 기준: `spec.md` 4.7-3(개정 3)·4.11(개정 4), `build-4-report.md` 3·7절.
> 세 SQL은 아직 실행 전이라 **같은 파일을 고쳤다**(새 파일 없음). 실 DB는 읽지도 쓰지도 않았다(공개 키 포함). 커밋·내려받기·설치 없음.
> 교사 인증 코드 값·개인 이메일·실제 학생 이름은 어느 파일에도 없다(시험 예시는 `2026a`·`김철수` 같은 만든 값).

## 1. 고친 곳

| 파일 | 바꾼 것 |
|---|---|
| `supabase/migrations/20261020000000_privacy_a_schema.sql` (①) | **개정 3**: 8-2a 새 내부 도우미 `privacy_retention_window(date)`(날짜 계산만) + 8-2b `admin_class_retention_status()` 다시 씀(옛 키 그대로 + `in_february`·`february_total`·학급별 `overdue_students`·`february_students`). **개정 4**: 11절 새 함수 7개 — 이름표 5개(`mask_label`·`can_see_member_name`·`can_see_member_identity`·`member_name_labels`·`admin_masked_member_rows`) + 내부 도우미 2개(`privacy_btrim`·`privacy_name_source`). 머리말(함수 목록·결과 모양·확인 쿼리 5-2·5-3), 맨 끝 점검 11→12절로 번호만 옮기고 12-5 권한 표에 18줄, **12-7 가린 글자 자체 시험 13개 · 12-8 기한 날짜 자체 시험 11개**(틀리면 ① 전체 되돌림). 정책은 여전히 하나도 만들지 않는다. |
| `…010000_privacy_b_enforce.sql` (②) | 1-4 `admin_set_role`: 다른 학급 학생을 교사로 지정하면 거부(`v_class` 열 하나 더 읽음). **새 5절**: `member_directory`·`password_reset_log`·`member_withdrawal_log`·`member_create_log` 읽기 정책 `"…: 담임·총괄 조회"`(can_manage_member) → `"…: 학생은 담임만 조회"`(`to authenticated`, `can_see_member_identity(id / target_id)`), `admin_must_change_password_ids()` 범위 같게. 맨 앞 점검에 ①의 새 함수 2개, 맨 끝 점검(5→6절) 6-6 함수 본문(거부 문구·`teaches_student(`·must_change 범위), 6-7 권한, **6-8 네 표의 읽기 정책이 정확히 하나·옛 정책 0**. 머리말·확인 쿼리 7)·끝 알림. |
| `…020000_privacy_c_profiles_members_only.sql` (③) | `profiles` 읽기 정책 식 → `using (public.can_see_member_name(id))`(**이름 "profiles: 로그인한 회원 조회"는 그대로** — 되돌리기 파일이 그대로 맞음). 맨 앞 점검에 `can_see_member_name`·`member_name_labels`, 맨 끝 점검 조건·권한, 머리말(설명·전제에 묶음 6 화면 먼저)·확인 쿼리 5)·5-2)·끝 알림. |
| `docs/privacy/rollback-privacy-enforce.sql` | 3-17 네 정책을 옛 정의로(20260927010000 §3-1~3-4 글자 그대로), 3-18 `admin_must_change_password_ids` 옛 정의. `admin_set_role` 거부 문구는 기존 "함수 10개 옛 정의"로 함께 빠짐. 맨 끝 점검에 네 표·함수 검사, 머리말. |
| `docs/privacy/rollback-profiles-members-only.sql` | **동작 그대로**(정책 이름이 같아서). 머리말 설명 4줄만 더함. |
| `docs/privacy/test-queries.sql` | 머리말 순서, 0-2)(학급 id로 흉내 id 찾기), 15) 기대값(선생님 + 같은 반), 새 17)~26)(아래 8절). |
| `supabase/functions/admin-clear-students/index.ts`·`README.md` | 학생 한 명 경로: 담임이 아닌 총괄이 **학급 있는** 학생을 지울 때 `confirmName`을 **가린 이름**과 비교(새 `maskedStudentName`). 총괄도 학급 있는 학생이면 담임 여부를 읽는다. README에 규칙. |

## 2. 화면(묶음 6)이 읽는 JSON 키 — 그대로

**`member_name_labels(p_ids uuid[])`** → 배열(id 순, 있는 프로필만, 앞 1000개만). 로그인 안 함·인증 전 구글·`p_ids` null이면 `[]`.
```
[{ "id", "display_name", "avatar_url", "withdrawn_at", "masked" }]
```
온전히 볼 수 있으면 원래 값·`"masked": false`. 아니면 `"display_name": "2***"`, `"avatar_url": null`, `"masked": true`(`withdrawn_at`은 그대로 — "탈퇴한 학생(2***)"용).

**`admin_masked_member_rows(p_id uuid default null)`** → 총괄이 아니면 `[]`. 대상 = role `user` · 학급 있음 · 내가 담임 아님(`p_id`면 그 한 줄). `signed_up_at` 최신순, `id` 순.
```
[{ "id", "email", "provider", "providers", "signed_up_at", "last_sign_in_at", "updated_at", "class_id",
   "guardian_consent_at", "guardian_consent_by", "masked": true,
   "profiles": { "display_name", "avatar_url": null, "role", "withdrawn_at", "must_change_password" } }]
```
`email` = 아이디(`@` 앞)의 가린 값(도메인 없음, 예 `2***`), `profiles.display_name` = 가린 이름, `class_id` = `profiles.class_id`(명단의 `class_id`와 트리거로 같음).

**`admin_class_retention_status()`**(개정 3 — 묶음 4 `parseRetention`과 대조: 새 키를 먼저 읽고, 2월 29일에도 `february_students: 0`이라 2월 알림 0 → 맞음)
```
{ "today", "school_year_start", "cutoff", "deadline", "past_deadline", "in_february",
  "due_total", "overdue_total", "february_total", "scope": "all"|"mine",
  "classes": [{ "class_id", "class_name", "old_students", "overdue_students", "february_students", "students" }] }
```
`cutoff` = 이 날(한국 시간 0시) 전에 만든 학생이 기한 지남, `old_students` = `overdue_students + february_students`(옛 화면 호환), `due_total` = `overdue_total + february_total`, 학급 줄은 둘 중 하나라도 1 이상일 때만.

## 3. 날짜 계산 표(개정 3 — 한국 시간 날짜, ① 12-8이 같은 표로 스스로 시험)

학년도 Y = Y년 3월 1일 ~ Y+1년 2월 말, 그 학생 = Y년 2월 1일(겨울방학 미리 등록) ~ Y+1년 2월 1일 전에 만든 계정, 기한 = Y+1년 2월 28일.

| 오늘 | 학년도 시작 S | 기한 지남 = 이 날 전에 만든 학생 | 2월 알림 = 만든 날 범위 | deadline | past_deadline | in_february |
|---|---|---|---|---|---|---|
| 2026-03-01 | 2026-03-01 | 2026-02-01 | — | 2026-02-28 | true | false |
| 2026-12-31 | 2026-03-01 | 2026-02-01 | — | 2026-02-28 | true | false |
| 2027-01-15 | 2026-03-01 | 2026-02-01 | — | 2026-02-28 | true | false |
| 2027-02-01 | 2026-03-01 | 2026-02-01 | 2026-02-01 ~ 2027-02-01 전 | 2027-02-28 | false | true |
| 2027-02-10 | 2026-03-01 | 2026-02-01 | 2026-02-01 ~ 2027-02-01 전 | 2027-02-28 | false | true |
| 2027-02-28 | 2026-03-01 | 2026-02-01 | 2026-02-01 ~ 2027-02-01 전 | 2027-02-28 | false | true |
| 2027-03-01 | 2027-03-01 | 2027-02-01 | — | 2027-02-28 | true | false |
| 2028-02-01(윤년) | 2027-03-01 | 2027-02-01 | 2027-02-01 ~ 2028-02-01 전 | 2028-02-28 | false | true |
| **2028-02-29**(윤년) | 2027-03-01 | **2028-02-01** | — | 2028-02-28 | true | false |
| 2028-03-01 | 2028-03-01 | 2028-02-01 | — | 2028-02-28 | true | false |

(①의 점검에는 2026-10-20도 있다 — 2026-03-01과 같은 값.) 2월에 만든 계정(미리 등록)은 2월 알림에서 빠지고 다음 해 기한에 들어간다. 1월에는 이번 학년도 학생을 세지 않는다. `deadline`은 "기한 지남·2월 알림이 가리키는 학년도의 2월 28일"(3~1월은 지난 2월 28일, 2월은 올해 2월 28일)이라 `past_deadline = today > deadline` = 지침의 "3월 1일 ~ 다음 해 1월 말, 그리고 2월 29일".

## 4. 가린 글자 규칙(SQL·Edge Function 같음)

- 원래 값 = 표시 이름(앞뒤 공백 뺌), 비었으면 로그인 아이디(`member_directory.email`의 `@` 앞) — `privacy_name_source`. 아이디 칸은 `@` 앞 그대로.
- 가린 값 = 앞뒤 공백을 뺀 첫 글자(코드 포인트 하나 — SQL `left(…,1)`, JS `Array.from(…)[0]`) + `***`, 비었으면 `***` — `mask_label`.
- "공백" = **JS `String.prototype.trim()`이 빼는 글자 25개 그대로**(U+0009~000D, U+0020, U+00A0, U+1680, U+2000~200A, U+2028, U+2029, U+202F, U+205F, U+3000, U+FEFF — `privacy_btrim`). Node 24로 0~U+10FFFF 전부를 돌려 JS 집합이 이 25자와 같음을 확인. 그래서 함수·화면은 `.trim()`을 그대로 써도 SQL과 같다.
- 예: `'  2026a '`→`2***`, `'김철수'`→`김***`, `''`·공백만·null→`***`, `chr(12288)||'홍길동'||tab`→`홍***`, `'😀ab'`→`😀***`, 이름 빔 + `2026a@class1.local`→`2***`, 가린 구글 이메일 `k***`→`k***`.

## 5. 전수 조사 — 지금 살아 있는 security definer 함수(마이그레이션 23개를 차례로 읽어 이름별 마지막 정의, 64개) 중 이름·아이디를 다루는 것

| 함수 | 이름·아이디를 돌려주나 | 판단 |
|---|---|---|
| `member_name_labels`·`admin_masked_member_rows` (새) | 가린 값만(볼 수 있는 사람에겐 원래 이름) | 규칙대로 |
| `my_boards` | `teacher_name` = 게시판 주인의 `display_name` | 주인은 `class_board_owner`가 role `admin`만 골라 늘 **선생님** → "선생님 별명은 모두에게" — 그대로 |
| `verify_google_teacher`·`acknowledge_privacy` | 아니요(본인 별명을 쓰기만, 결과는 이유 코드) | 그대로 |
| `admin_class_cleanup_preview`·`admin_class_retention_status`·`my_admin_context`·`create_class`·`rename_class`·`admin_finish_class_cleanup` | 학급 이름·수만 | 그대로 |
| `admin_member_privacy_flags` | id·상태만 | 그대로 |
| `handle_new_user`·`sync_member_directory`·`member_directory_fill_class`·`sync_member_directory_class` | 트리거(돌려주지 않음) | 그대로 |
| `admin_finalize_withdrawal`·`admin_log_member_create`·`admin_purge_oauth_member`·`admin_purge_class_member`·`self_purge_member`·`purge_member_records` | 서비스 롤 전용 — 스냅샷 쓰기·삭제만 | 그대로 |
| 그 밖 판별·카운트 함수(`is_*`, `teaches_student`, `can_*`, `my_*_ids`, `unread_feedback_count`, `admin_dashboard_stats` …) | 참거짓·id·수만 | 그대로 |

**다시 정의해 가린 함수: 없음**(총괄·다른 학급 교사에게 다른 학급 학생의 `display_name`·`email`·`target_email`·`target_name`을 돌려주는 security definer 함수가 없었다). 뷰는 0개. security invoker 함수 6개(`app_result_stats`·`feedback_thread_summaries` 등)는 이름을 돌려주지 않고 RLS를 거친다.
**표에서 직접 읽히는 곳**: `profiles`(③이 가림), `member_directory`·감사 기록 3개(②가 가림), `community_reports`(스냅샷은 제목·본문·`target_author_id`뿐 — 이름은 `profiles` embed라 ③으로 가려짐), `member_create_log.actor_name`(선생님 이름 — 공개 규칙). **정책 안에서 `profiles`를 함수 없이 직접 읽는 곳: 0**(살아 있는 정책 89개를 다시 훑음 — ③ 맨 앞 점검도 실 DB에서 다시 본다).

## 6. 계약·지침과 다르게 한 곳 · 정한 곳(이름표 5개의 이름·인자·키는 그대로)

1. **내부 도우미 3개 추가**(계약표에 없음, 누구도 직접 못 부름): `privacy_btrim(text)`, `privacy_name_source(text, text)`, `privacy_retention_window(date)`. 날짜 계산을 따로 둔 까닭: `now()`와 떼어 ① 점검이 날짜 11개로 스스로 시험할 수 있게.
2. **`mask_label` 실행 권한을 anon·authenticated에서 거뒀다**(spec은 `immutable`만 정함). 화면은 `mask_label`을 RPC로 부르지 말고 두 RPC의 결과를 쓴다.
3. `mask_label`의 `btrim`은 공백 하나가 아니라 **JS `trim()`과 같은 25자**(Edge Function·화면 `.trim()`과 어긋나지 않게).
4. `member_name_labels`·`admin_masked_member_rows`의 가린 이름은 spec 표의 `mask_label(display_name)`이 아니라 **지침대로 `mask_label(privacy_name_source(display_name, 아이디))`**(이름이 비면 아이디 첫 글자).
5. 새 정책 이름 `"<표>: 학생은 담임만 조회"`(spec이 이름을 정하지 않음, 최대 49바이트). `member_directory`는 옛 정책이 대상 역할 없이(public)였는데 새 정책은 `to authenticated`(anon은 원래 표 권한이 없음). 되돌리기는 옛 모양 그대로.
6. ③ 정책 이름 `"profiles: 로그인한 회원 조회"`를 바꾸지 않았다(뜻은 개정 4로 좁아짐).
7. `can_see_member_name`: 없는 대상·비로그인은 거짓, 본인은 인증 전 구글이어도 참(spec 4.10 "자기 행만"). 학급 없는 대상은 총괄만.
8. `admin_set_role` 거부 조건 = 대상이 학급 있음 **and** `not teaches_student(대상)`(총괄이 그 학급 담임이면 지정 가능, 학급 없는 계정도 가능). 탈퇴 확인 뒤에 검사.
9. `admin-clear-students`: 담임 판정을 총괄에게도 한다(학급 있는 학생만 — `class_teachers` 읽기 한 번 더). 그 읽기가 실패하면 기존과 같은 500 "담임 여부를 확인하지 못했습니다…".

## 7. 새 문장(글자 그대로)

사용자 화면에 나올 수 있는 것: **`다른 학급 학생은 교사로 지정할 수 없어요.`**(spec 4.11 그대로 — `admin_set_role` 오류, 화면이 서버 문구를 그대로 보임). Edge Function은 새 문장 없음(가린 이름이 틀려도 기존 "이름이 맞지 않습니다. 학생 이름을 그대로 입력해 주세요.").

SQL Editor에서 사용자가 보는 것(새로 쓰거나 바꾼 것 — `%`는 값):
- ① `가린 글자 규칙(mask_label · privacy_name_source) 자체 시험이 설계와 다릅니다: %. 이 파일 전체를 되돌렸습니다 — 이 메시지를 알려 주세요.`
- ① `학급 정리 기한 날짜 계산(privacy_retention_window) 자체 시험이 설계와 다릅니다: %. 이 파일 전체를 되돌렸습니다 — 이 메시지를 알려 주세요.`
- ② `회원 명단 · 감사 기록의 읽기 정책이 설계(개정 4 — "…: 학생은 담임만 조회" 하나)와 다릅니다: %. 이 파일 전체를 되돌렸습니다 — 이 메시지를 알려 주세요.`
- ② `회원 명단 · 감사 기록에 옛 정책(can_manage_member · is_admin())이 남아 있습니다: %. 이 파일 전체를 되돌렸습니다 — 이 메시지를 알려 주세요.`
- ② 끝 알림에 더한 문장: `회원 명단·감사 기록의 학생 줄은 그 학생의 담임만 읽습니다(총괄은 다른 학급 학생을 첫 글자 + ***로 — 개정 4).`
- ③ 끝 알림 앞부분: `✔ ③ 프로필(이름·사진)은 이제 로그인한 회원만 읽습니다(학생 이름은 같은 학급·담임만 — 그 밖에는 첫 글자 + *** 로, 인증 전 구글 계정은 자기 것만, 비로그인 화면의 작성자는 "회원").`
- ② 되돌리기 `회원 명단 · 감사 기록의 읽기 정책이 옛 정의("…: 담임·총괄 조회" 하나)로 돌아가지 않은 표가 %개 있습니다. 이 파일 전체를 되돌렸습니다 — 이 메시지를 알려 주세요.` · 끝 알림 `✔ ②를 되돌렸습니다: 인증 전 계정 제한 · 학급 밖 권한 좁히기 · 학생 아이디 가리기(개정 4)가 풀리고(교사 누구나 · 총괄은 모든 회원 명단), 구글 새 가입은 ② 이전처럼 일반 회원으로 시작합니다. 가린 이메일·이름은 되돌리지 않았습니다. 인증을 마친 구글 선생님은 교사로 남습니다.`
- `test-queries.sql` 23): `✖ 총괄 흉내가 되지 않았습니다(지금 역할 %) — 통째로 Run 해 주세요(아무것도 바뀌지 않음).` · `✖ <학생C id> 는 총괄이 담임인 학생입니다 — 다른 학급 학생 id 로 바꿔 주세요(아무것도 바뀌지 않음).` · `% 다른 학급 학생 교사 지정: % — 시험이라 일부러 오류로 끝냅니다(아무것도 바뀌지 않음).`

## 8. 시험(실 DB 없이 한 것)

| 무엇 | 방법 | 결과 |
|---|---|---|
| 기한 공식이 "학년도·기한" 뜻과 같은지 | SQL 공식을 JS로 옮겨, 2025~2030년 매일 × 2023년~그날 만든 날 모두를 뜻대로 직접 판정한 값과 비교 | **4,002,957건 중 다름 0** · 날짜 11개 표(3절)가 ① 12-8 기대값과 같음 |
| JS `trim()` 글자 = `privacy_btrim` 25자 | Node 24로 모든 코드 포인트 검사 | 같음 |
| `admin-clear-students` 타입 | 저장소 TypeScript 5.9.3 + supabase-js 2.116.0 타입 + Deno 흉내 선언(스크래치 tsconfig, `member-self-delete`·`admin-create-member` 포함) | **오류 0**(일부러 틀린 메서드는 잡힘 확인) |
| 학생 한 명 경로 — 담임/총괄/총괄 겸 담임 × 원래 이름/가린 이름/틀린 이름 | 함수를 TS→JS 변환해 Node에서 실행, supabase-js는 127.0.0.1 가짜 GoTrue·PostgREST·Storage만 | **21/21 통과**: 담임은 원래 이름만(가린 이름 400), 다른 반 403, 총괄은 다른 반 학생을 가린 이름으로만(원래 이름 400 — 이름 빔→아이디 `2***`, 이모지 `😀***`, 전각 공백 `하***`, 둘 다 빔 `***`, 앞뒤 공백 입력 통과), 학급 없는 학생은 원래 이름, 총괄 겸 담임은 자기 반 원래 이름·다른 반 가린 이름. 응답·로그에 이름·아이디·id 0 |
| ②·되돌리기 정의가 원본과 맞는지 | 원본(20260927010000) 마지막 정의와 공백·주석 정규화 비교 | 되돌리기: 정책 4/4·함수 2/2(`admin_set_role`·must_change) 글자 그대로. ② 새 정책 4개 = 옛 정책에서 이름·함수·대상 역할만 다름, must_change = 함수 이름만 다름 |
| 문장·`$$`·괄호·정책 이름 | 스크립트 | 6개 파일 이상 없음. ② create policy 43개(19+20+4), 되돌리기 24개, 최대 61바이트 |
| 정책 안 `profiles` 직접 읽기 | 살아 있는 정책 89개 | 0 |

`test-queries.sql` 새 블록(사용자용 읽기 전용 흉내, 결과는 참거짓·개수·"첫 글자+*** 모양"만): 0-2) id 찾기, 17) 기한 표·가린 글자 예, 18) 권한, 19) ② 뒤 정책·함수, 20) 학생 A, 21) 담임 T1, 22) 총괄(학생마다 표 줄 + 가린 줄 = 1, 관리 권한 그대로), 23) 다른 학급 학생 교사 지정 거부(오류로 끝내 되돌림), 24) 비로그인, 25) 인증 전 구글, 26) 기한 현황 흉내. 시험 도구는 스크래치 `privacy-b5/`에서만 썼고 지웠다.

## 9. 확인하지 못한 것

- 실제 Postgres 실행(문법·권한의 최종 확인). 특히 SQL 함수 안 `p_ids[1:1000]`, `jsonb_build_object` 안 `null::text`, plpgsql `do` 블록 안 `values` 자체 시험, `chr(65279)` 등 — 읽어서만 대조.
- 실 DB에서 네 표에 이 파일들이 모르는 읽기 정책이 따로 있으면 ② 6-8이 전체를 되돌린다(의도 — 메시지를 알려 달라고 안내).
- 행마다 `can_see_member_name`을 부르는 ③ 정책의 속도(학급 사이트 규모면 가볍다고 보지만 재 보지 못함).
- 실제 Deno·Edge Runtime, 실제 GoTrue·PostgREST 응답 모양(가짜 서버는 묶음 2와 같은 모양).

## 10. 묶음 6 · 메인 에이전트에게

- **묶음 6**: 키 이름은 2절 그대로. `mask_label`은 RPC로 부를 수 없다(권한 없음). 가린 이름을 화면이 스스로 만들 일이 생기면 4절 규칙(`.trim()` → 비면 아이디 `@` 앞 → `Array.from(s)[0] + "***"`, 비면 `***`)을 쓴다. 총괄 회원 명단의 가린 줄에서 '기록까지 삭제' 확인 입력은 그 줄의 `profiles.display_name`(예 `2***`) 그대로 — 함수가 같은 값으로 비교한다. `admin_set_role` 거부 문구는 서버 문구 그대로. `member_name_labels`는 인증 전 구글에게 `[]`.
- **배포 순서(메인)**: ② · ③은 이제 화면을 바꾼다 — **② 전에 묶음 6 화면이 배포돼 있어야** 총괄 회원 명단에서 다른 학급 학생 줄이 사라지지 않고, **③ 전에** 다른 학급 학생 이름이 '회원'/'익명' 대신 가린 값으로 보인다. `admin-clear-students`는 이 고친 코드로 배포(아직 배포 전). ① 실행이 먼저(새 RPC 2개가 ①에 있음).
- **메인 — 사용자에게 알릴 것**: 지금은 총괄 = 부엉이반 담임이라 부엉이반은 바뀌는 것이 없다(다른 학급이 생길 때부터 가려짐). 같은 반 친구끼리는 별명이 온전히 보이고(처리방침 안내 그대로), Supabase 대시보드에는 아이디·이름이 그대로 있다. 되돌릴 때는 ③ → ② 순(②만 되돌리고 ③을 남기면 총괄 명단에 아이디는 보이는데 이름은 빈 줄이 생김).
- `test-queries.sql` 20)~23)은 학급이 둘 이상이고 다른 반 학생이 있어야 돌릴 수 있다(시험용 학급·학생을 만들어 하거나 나중에).
