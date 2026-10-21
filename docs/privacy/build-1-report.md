# 묶음 1 보고 — SQL (구현 담당 A, 2026-10-20)

> 지침: `build-common.md` · `build-1-sql-instructions.md` · 설계 `spec.md`(개정 1·2, 1.1 결정표 우선). **실 DB 는 읽지도 쓰지도 않았다**(공개 키 읽기 포함). 로컬 Postgres·SQL 파서가 없어(설치 안 함) 실행해 보지 못했다 — 문법·이름·권한은 눈으로, 정책·함수 대조는 스크래치의 작은 스크립트(기존 마이그레이션을 문장 단위로 읽어 "지금 살아 있는 정의"를 뽑는 것)로 했다. 교사 인증 코드 값·개인 이메일은 어느 파일에도 없다(예시 `000000`·`abcdef`만).

## 1. 만든 파일

| 파일 | 내용 |
|---|---|
| `supabase/migrations/20261020000000_privacy_a_schema.sql` | **① 추가만**: pgcrypto(extensions), 새 표 4개(RLS 켬·정책 0·anon/authenticated 권한 0), 새 열 7개, 판별 함수 2개(`is_full_admin`·`is_pending_google`, PUBLIC), 화면 RPC 12개, `my_admin_context` 다시 정의(+`teacher_scope`), 서비스 롤 전용 5개(`purge_member_records`·`admin_purge_class_member`·`self_purge_member`·`admin_finish_class_cleanup`·5-인자 `admin_log_member_create`), 내부 도우미 `privacy_nickname_error`. 맨 앞·맨 끝 점검(정책 수가 그대로인지까지 확인 — ①은 정책을 하나도 바꾸지 않는다). |
| `supabase/migrations/20261020010000_privacy_b_enforce.sql` | **② 켜기**: 함수 10개 다시 정의(`handle_new_user`·`sync_member_directory`·`can_browse`·`admin_set_role`·`record_post_read`·`get_or_create_feedback_thread`·학습게임 관리 RPC 4개), 백필 3가지(구글 이메일 가리기·`member_verification` 'existing'·인증 전 이름·사진 가리기), RESTRICTIVE 19개, 학급 밖 정책 20개 좁히기. 맨 앞 점검(①·코드·문의 이메일·총괄·③⑤⑧ 적용 상태), 맨 끝 점검 8가지(아래 4절). |
| `supabase/migrations/20261020020000_privacy_c_profiles_members_only.sql` | **③**: `profiles: 누구나 조회` → `profiles: 로그인한 회원 조회`(to authenticated, 인증 전 구글은 자기 행만), anon 열 권한 그대로, `policy_effective_at = coalesce(…, now())`. 맨 앞 점검(①·②, 다른 정책이 profiles 를 직접 읽지 않음), 맨 끝 점검(읽기 정책 정확히 하나·anon 열 권한·시행 시각). |
| `docs/privacy/rollback-privacy-enforce.sql` | ② 되돌리기: 제한 19개 삭제, 함수 10개·정책 20개를 옛 정의 **글자 그대로**(스크립트로 원본과 대조 — 4절), `member_verification` 인증 전 줄 삭제(아래 2-⑮), 맨 끝 점검. |
| `docs/privacy/rollback-profiles-members-only.sql` | ③ 되돌리기: 옛 `profiles: 누구나 조회`(using true) + `policy_effective_at = null`. |
| `docs/privacy/test-queries.sql` | 사용자가 SQL Editor 에서 돌리는 읽기 전용 확인·흉내 시험 0)~16). 읽기는 `set local` 한 번의 Run, 쓰기 시험은 do 블록 안에서 하고 끝에 일부러 오류로 끝내 전부 되돌림(= rollback). 결과는 개수·참거짓·이유 코드만. |

## 2. 계약(spec 4.1·4.2·10.2)과 다르게 한 곳 · 정한 곳 — 전부

이름(표·열·함수·RPC·파일)은 **하나도 바꾸지 않았다.** 아래는 동작·모양에서 다르게 하거나 spec 이 정하지 않아 정한 것이다.

1. **`member_verification_attempts.user_id` → profiles `on delete set null`**(spec 4.1 표는 cascade). cascade 면 "가입 → 틀림 → [가입하지 않기]"를 되풀이할 때 시도 줄이 같이 지워져 **전체 한도(10분 30번)까지 초기화**된다 — spec 3.4가 막으려던 구멍. set null 이면 계정 번호만 비고 줄은 남는다(처리방침 "계정 번호·맞았는지·시각만"과 맞음).
2. **`acknowledge_privacy(p_nickname text default null, p_policy_version int default null)`** — Postgres 는 기본값 있는 인자 뒤의 인자에도 기본값을 요구한다(spec 모양 그대로는 만들 수 없음). 빈 값이면 `policy_changed`. 이름 붙여 부르면(PostgREST) 차이 없음.
3. **`verify_google_teacher` 순서**: spec 4.3 은 "role admin → not_applicable"이 "verified → already"보다 앞. 그러면 다른 탭에서 인증을 마친 계정(role admin 이 됨)이 다시 눌렀을 때 4절 "이미 확인을 마쳤어요"가 안 나온다 → **already 를 먼저** 본다. 총괄이 지정한 구글 관리자(인증 안 함)는 그대로 not_applicable.
4. **`admin_set_teacher_code` — spec 안의 모순**(4.2 "시도 기록 초기화" ↔ 4.3 "시도 기록은 그대로"): 시도 기록 표(`member_verification_attempts`)는 **그대로**(전체 한도·"최근 1시간 틀린 시도"가 계속 맞게), 계정별 `wrong_count`·`locked_until`은 **초기화**(옛 코드 때문에 잠긴 선생님이 새 코드로 바로 할 수 있게).
5. **`purge_member_records`의 과제**: spec 4.7-1 ④는 "그 교사가 쓴 과제 삭제". 과제를 지우면 그 과제의 **다른 학생 제출물이 cascade 로 사라지므로**, 제출물이 달린 과제는 지우지 않고 남긴다(쓴 사람만 비워짐 — 총괄만 고침). 같은 까닭으로 `self_purge_member`(withdraw)가 "혼자 맡은 빈 학급"을 지울 때 그 학급 과제에 제출물이 있으면 **학급을 지우지 않고 보관(archived_at)**한다. 회원 탈퇴는 그 교사의 학급에 학생이 남아 있으면 막히므로 보통은 해당 없다(반을 옮긴 학생의 옛 제출물 같은 드문 경우). 선생님 글·블로그 글은 spec 대로 지운다.
6. **RESTRICTIVE 정책 이름**: spec "`<표>: 인증 전 쓰기 제한`" — 한 표에 INSERT·UPDATE 두 개가 있으면 이름이 겹치므로 `"<표>: 인증 전 쓰기 제한(추가)"`·`"(수정)"`. Storage 는 `"game-uploads: 인증 전 업로드 제한"`(기존 storage 정책 이름 방식). 가장 긴 것 56바이트.
7. **`admin_set_teacher_scope`**: 총괄 계정을 `class`로 줄이는 것은 거부(총괄 권한 보호 — spec 에 없던 방어).
8. **`self_purge_member` 결과**: spec 은 "blocked 와 학급 이름 목록을 돌려줌". 이 함수는 로그인 계정을 지운 **뒤** 부르는 마지막 단계라, 막힘을 값으로 돌려주면 모르는 호출자가 성공으로 오해할 수 있다 → **예외**(`message = 'blocked'`, `detail` = 학급 이름들 ", "로 이음). 성공은 `{ok:true, mode, deleted_classes, archived_classes}`, 이미 지워졌으면 `{ok:true, already:true}`. **Edge Function 은 계정을 지우기 전에 같은 조건을 먼저 확인해야 한다**(spec 5절 흐름 그대로).
9. **spec 이 모양을 정하지 않아 정한 결과**(① 머리말에 전부 적음):
   - `admin_class_retention_status()` → `{today, school_year_start, cutoff, deadline, past_deadline, due_total, overdue_total, scope:'all'|'mine', classes:[{class_id, class_name, old_students, students}]}` (old_students ≥ 1 인 학급만, 탈퇴 처리된 학생 포함, 한국 시간 — spec 4.7-3 규칙).
   - `admin_class_cleanup_preview()` → `{class_name, students(탈퇴 포함 전체), withdrawn, oauth_only}` — `oauth_only`(학급 정리로 못 지우는 구글 전용 학생 수, 보통 0)는 덧붙인 칸.
   - `admin_finish_class_cleanup()` → 기록 줄 id(bigint) · `p_count ≤ 0`이면 기록 안 함(null) · **같은 학급·같은 선생님의 1시간 안 기록은 한 줄로 합침**(20명씩 여러 번 불러도 "정리 한 번 = 한 줄").
   - `admin_purge_class_member()` → void, 이미 지워졌으면 조용히 끝(멱등).
   - `verify_google_teacher` 결과 코드: `not_signed_in`·`not_applicable`·`already`·`policy_changed`(+`policy_version`)·`not_configured`·`locked`(+`locked_seconds`)·`busy`·`bad_nickname`(+`nickname_error`: empty|length|chars|reserved, +`message` = 4절 원문)·`wrong_code`(+`attempts_left`, 이번에 잠기면 0 + `locked_seconds`).
   - `my_member_gate().first_time` = 처리방침 확인을 한 번도 안 함(`ack_at` 없음) → 별명 칸을 보임(need_ack 이면 3-1 창, 아니면 3-2 창).
   - 서비스 롤 전용 5개는 인자가 비면 `'missing arguments'`로 곧바로 끝난다(⑦ Edge Function 의 "함수 있음" 확인 방식과 같음).
10. **백필 범위**(② 2절): `member_verification`은 **탈퇴 처리되지 않은** 구글 계정만(탈퇴한 구글 계정은 로그인 계정이 없음). 다만 탈퇴한 구글 계정의 이름·사진도 가린다. **학급이 있는 구글 계정**(구글로 로그인하는 학생 — 설계에 없는 경우)은 인증 전으로 묶지 않고 그대로 두며 맨 앞 점검이 수를 알린다(묶으면 그 학생의 기록 저장이 갑자기 막힌다).
11. **`handle_new_user`**: 아이디 로그인 = provider `email` 또는 providers 에 `email`. 그 밖(구글, 방식을 모르는 경우 포함)은 인증 전으로 시작(안전한 쪽). `sync_member_directory`의 가리기도 같은 규칙.
12. **별명 규칙**(spec 4.3-6 + 덧붙임): 앞뒤 공백 뺀 2~20자, 제어 문자·`@`·`http`·**`www.`** 불가, 예약어(대소문자 무시, 정확히 같은 말): `관리자`·`총괄`·`총괄 관리자`·`총괄관리자`·`운영자`·`사이트 운영자`·`psc`·`admin`·`administrator`·`인증 전 회원`·`탈퇴한 학생`·`탈퇴한 회원`·`회원`·`익명`(spec 의 "등"을 화면 이름표와 헷갈리는 말로 채움). 검사 순서: 빈 값 → 쓸 수 없는 글자 → 길이 → 예약어.
13. **`my_admin_context` 다시 정의를 ①에** 넣었다(spec 4.6 표 #25는 ②로 읽힐 수 있음). 키 하나(`teacher_scope`)를 더할 뿐이라 ① 전후 화면 동작이 같고, 묶음 4가 ② 전에도 시험할 수 있다. `admin_log_member_create`도 ①에서 4→5-인자(spec 4.2 대로) — `p_guardian` 기본값 null 이라 **지금 배포된 Edge Function 의 4-인자 호출도 그대로 된다**.
14. **`verification_settings`는 서비스 롤 권한도 거뒀다**(코드 해시는 security definer 함수만 읽음 — Edge Function 은 필요 없음). `member_verification`은 서비스 롤 읽기만 명시(spec 5절).
15. **② 되돌리기가 `member_verification`의 인증 전 줄(verified_at 없음)을 지운다**(spec 4.9 에 없던 것). 남기면 ①의 RPC 가 계속 창을 띄우고, 코드를 넣으면 role admin 이 되는데 되돌린 뒤에는 정책이 `is_admin()`이라 **모든 교사 권한**이 된다. 지우면 인증 함수는 not_applicable, 창은 ok. 인증을 마친 선생님은 교사로 남는다(머리말에 적음).
16. ② 되돌리기는 spec 대로 `sync_member_directory`를 옛 정의로 돌린다 → 가린 이메일은 **다음 로그인 때 원래 값으로 다시 채워진다**(② 이전 동작). 되돌리기 머리말에 적었다.

## 3. spec 4.6 다시 전수 조사 (최신 마이그레이션 20개, 2026-10-20)

스크립트로 마이그레이션을 차례로 읽어(같은 이름 정책의 drop/create, 63바이트 잘림, 함수 다시 정의 반영) **지금 살아 있는** 정의 중 `is_admin()`이 들어간 것을 모두 뽑았다.

**정책 25개 = 좁힘 20 + 그대로 5** — spec 표와 정확히 일치.
- 좁힘 20(②): community_posts 3(읽기·수정·삭제) · community_comments 2(읽기·삭제) · community_likes 1(읽기) · community_reports 3(조회·신고·삭제) · storage game-uploads 2(조회·삭제) · posts 4 · comments 2(조회·삭제) · praise_presets 3(추가·수정·삭제).
- 그대로 5: `praise_presets: 관리자만 조회`(spec — 학급 선생님도 칭찬 보내기에 문구를 읽음), assignments 4개(`교사는 자기 학급·자기 과제 조회`·`본인 이름으로 자기 학급에 작성`·`쓴 교사·총괄만 수정/삭제`) — **학급 안 일**: ⑥ 뒤로 `is_admin()`은 "교사인가"만 보고 범위는 `my_class_ids()`·쓴 사람·총괄로 이미 좁혀져 있다(결정 6 "과제 쓰기"는 구글 선생님에게도 열림).

**함수 14개 = 좁힘 4 + 그대로 10.**
- 좁힘 4(②): `set_community_post_hidden`·`set_community_comment_hidden`·`set_community_report_status`·`resolve_community_reports_for` — 맨 앞 `is_admin()`(교사 확인)은 그대로 두고 학습게임 갈래에 `is_full_admin()` 검사를 더함.
- 그대로 10 — 근거: `is_admin` 자체 · `teaches_student`·`my_class_ids`(교사 여부 + 학급 기준 판별) · `can_manage_board`·`my_board_owner_ids`(자기 게시판 — 학급 안) · `create_class`·`rename_class`(결정 6 "학급 만들기" — 학급 안) · `admin_dashboard_stats`(내 학급 숫자) · `my_admin_context`(①에서 `teacher_scope`만 더함) · `community_posts_guard`(spec: 글쓴이 열은 insert 열 권한에 없어 늘 `auth.uid()` — 영향 없음).
- 표에 없던 곳: **없음.** `is_admin()`을 안 쓰지만 학급 밖 권한이 있는지도 봤다: `admin_set_login_required`·`admin_set_role`(총괄만), `member_directory`·감사 로그 3개·`admin_must_change_password_ids`(`can_manage_member`), 학생 기록 정책·함수(`teaches_student`), `class_notices`(`my_class_ids`) — 모두 이미 학급/총괄 기준이라 바꿀 것 없음.

## 4. 시험(실행하지 못한 대신 한 것) — 결과

| 무엇 | 방법 | 결과 |
|---|---|---|
| ② 좁힌 정책 20개가 원본과 `is_admin()`→`is_full_admin()` 말고 같은지 | 원본(마지막 정의)과 새 정의를 공백·주석 정규화 후 비교 | **20/20 같음** |
| ② 함수 10개의 차이가 의도한 곳뿐인지 | 낱말 단위 diff | 의도한 줄만 다름(teacher_scope 2곳, is_pending_google, game 검사 4곳, handle_new_user 분기, sync 가리기) |
| ② 되돌리기가 옛 정의와 글자 그대로인지 | 같은 방식(바꾸기 없이) | **정책 20/20 · 함수 10/10 같음** |
| 문장 분리·`$$` 짝·괄호 균형 | 스크립트 | 6개 파일 모두 이상 없음. ② = drop 39 · create policy 39(제한 19 + 좁힘 20) |
| 정책 이름 63바이트 | 바이트 수 | 가장 긴 것 61바이트(기존 이름), 새 이름 최대 56바이트 |
| `any ((select` · 이메일 · 코드 값 | grep | 0건 |
| 다른 표 정책이 profiles 를 직접 조회(③ 전제) | 살아 있는 정책 본문 검색 | 0건(profiles 자기 정책뿐) — ③ 맨 앞 점검이 실 DB 에서도 다시 본다 |
| `purge_member_records` ↔ `admin_purge_oauth_member` 목록 | 두 함수 나란히 대조 + profiles 를 가리키는 외래키 전부(①·⑦·⑧ 포함) | 같은 순서·같은 삭제(신고 → 글 → 로그 3곳 → 프로필). 더한 것: ④ 선생님 글·과제(제출물 없는 것)·블로그 글(spec 4.7-1). 새 외래키(member_verification cascade, attempts·code_set_by·actor_id·guardian_consent_by set null)는 모두 cascade/set null — ① 맨 끝 점검이 restrict/no action 0 을 다시 확인 |

## 5. 확인하지 못한 것

- **실제 실행**(문법 오류·권한 오류의 최종 확인). 특히: `raise exception using message, detail`, plpgsql 안의 jsonb `?` 연산자(search_path ''), `test-queries.sql` 9)의 do 블록 안 `set local role`.
- Supabase 에서 pgcrypto 가 `extensions` 스키마에 있는지(① 맨 끝 점검이 아니면 멈춤), 서비스 롤 기본 권한(`verification_settings`에서 거둔 뒤 알림만).
- 서비스 롤 요청에서 `auth.users`를 읽을 수 있는지 — 못 읽으면(`insufficient_privilege`) "계정이 먼저 지워졌는지" 확인만 건너뛴다(⑦과 같은 방식).
- PostgREST 가 지금 배포된 `admin-create-member`의 4-인자 이름 호출을 5-인자(기본값) 함수로 잡는지 — PostgREST 는 기본값 인자를 빼고 부르는 것을 지원한다(① 확인 쿼리 8)로 함수 모양만 확인 가능, 실제 호출은 회원 추가로 확인).
- 화면·Edge Function 이 이 결과 모양을 쓰는지(다른 묶음).

## 6. 다른 묶음·메인 에이전트에게 넘길 것

- **묶음 2(Edge Function)**: `self_purge_member`의 막힘은 예외(`message 'blocked'`, `detail` 학급 이름들) — 로그인 계정을 지우기 **전에** 같은 조건(구글 전용·총괄 아님·cancel = 인증 전·role user·학급 없음 / withdraw = 인증했거나 role admin·마지막 관리자 아님·그 교사 학급에 학생 없음)을 먼저 확인해야 한다. 세 서비스 롤 함수 모두 auth 계정이 남아 있으면 `'auth account still exists'`. `admin_purge_class_member`는 구글 전용 학생에 `'oauth-only account'`. `admin_finish_class_cleanup`은 1시간 안 같은 학급·같은 선생님 기록을 합치므로 20명씩 부를 때마다 그 회차 인원수를 넘기면 된다. `admin_log_member_create(…, p_guardian => true)`는 학생 줄에만 의미가 있다(교사 줄은 null 로 저장).
- **묶음 3(공개 화면)**: 결과 코드·`first_time` 뜻(2-⑨), 별명 예약어 목록(2-⑫ — 서버가 더 많이 막으므로 화면 검사를 같게 맞추기를 권함), `bad_nickname`의 `message`는 4절 원문, `acknowledge_privacy`는 두 인자 모두 넘긴다.
- **묶음 4(관리자 화면)**: `admin_class_retention_status`·`admin_class_cleanup_preview`·`admin_privacy_overview`·`admin_member_privacy_flags` 모양(2-⑨, ① 머리말), `my_admin_context().teacher_scope`, `member_directory.guardian_consent_at/by`(8-2 "동의서 확인 {날짜} · {선생님}" — by 는 profiles id), RPC 오류 문구(아래 7절).
- **메인 에이전트**: 2절의 결정(특히 1·4·5·8·15)을 사용자에게 확인. `CLAUDE.md` SQL 목록·"② 뒤로 앞선 마이그레이션 재실행 금지" 규칙 추가(spec 7절 11번).

## 7. 원문에 없던 새 문장(화면에 나올 수 있는 RPC 오류 문구 — 전부)

원문(4절·8-7절) 그대로인 것: `숫자 6자리로 적어 주세요.` · `이메일 주소 모양이 아니에요.` · `별명을 적어 주세요.` · `별명은 2자 이상 20자 이하로 적어 주세요.` · `별명에는 이메일·인터넷 주소·줄바꿈을 쓸 수 없어요.` · `이 이름은 쓸 수 없어요. 다른 별명을 적어 주세요.`
기존 SQL 과 같은 문장: `관리자만 사용할 수 있습니다.` · `대상 회원을 찾을 수 없습니다.`
**새 문장**(관리자 화면이 오류를 그대로 보일 때만 보임):
- `총괄 관리자만 사용할 수 있습니다.`
- `잘못된 권한 범위입니다.`
- `자기 자신의 권한 범위는 바꿀 수 없습니다.`
- `교사 계정만 권한 범위를 바꿀 수 있습니다.`
- `총괄 관리자의 권한은 줄일 수 없습니다.`
- `이 학급의 담임 선생님(또는 총괄)만 볼 수 있습니다.`
- `학급을 찾을 수 없습니다.`
- `대상 학생을 찾을 수 없습니다.`
- `이 학생의 담임 선생님만 기록할 수 있습니다.`
- `탈퇴 처리된 학생은 기록할 수 없습니다.`
- `회원 명단에서 이 학생을 찾을 수 없습니다.`
- `이 학급의 담임 선생님만 기록할 수 있습니다.`
서비스 롤 함수의 영어 짧은 문구(`missing arguments`, `blocked` 등)는 Edge Function 이 한국어로 바꾼다(⑦과 같은 방식). 새 프로필 이름 값 `인증 전 회원`은 spec 3.2·4.4 의 값 그대로다.

## 8. 사용자가 할 일(순서)

1. **SQL ①** `20261020000000_privacy_a_schema.sql` 전체 Run → "✔ ①" 알림 → 파일 위 확인 쿼리 1)~8) 또는 `test-queries.sql` 1)·2).
2. Edge Function 3개 배포(묶음 2) → 사이트 push(묶음 3·4, 사용자 확인 뒤).
3. 총괄이 관리자 화면 '개인정보 설정'에서 **교사 인증 코드(숫자 6자리)와 문의 이메일** 입력(값은 채팅·저장소에 적지 않음).
4. **SQL ②** 실행 전 확인 A)~C)(읽기만) → `20261020010000_privacy_b_enforce.sql` Run → "✔ ②" → 확인 1)~6) → `test-queries.sql` 3)~12)(해당 계정이 있는 것만).
5. **곧바로 같은 자리에서 SQL ③** `20261020020000_privacy_c_profiles_members_only.sql` Run → "✔ ③"(시행 시각) → `test-queries.sql` 13)~16). ②와 ③ 사이에는 구글 로그인 시험을 하지 않는다.
6. 되돌릴 때는 **③ 되돌리기 → ② 되돌리기** 순(각 파일 머리말). ② 뒤로 앞선 마이그레이션을 다시 실행하지 않는다.
