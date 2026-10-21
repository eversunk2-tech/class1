# 고침 1 지침 — SQL·함수 (검토 R1 결과 + 사용자 결정, 2026-10-20)

담당: 묶음 5 구현 담당(E). `build-common.md`·`build-5-sql-instructions.md`의 규칙 그대로(세 SQL은 실행 전 → 같은 파일 수정, 커밋·실 DB·내려받기 금지). 기준: `docs/privacy/review-sql.md`. 보고서: `docs/privacy/fix-1-sql-report.md`. 고칠 파일은 `supabase/migrations/2026102*.sql` 3개, `docs/privacy/rollback-*.sql`, `docs/privacy/test-queries.sql`, `supabase/functions/admin-clear-students/`만(화면 `src/`는 메인 에이전트가 따로 고친다).

## 고칠 것
1. **M1 — 기존 구글 관리자의 구글 실명·사진**: ②에서 **구글(아이디 계정이 아닌) 계정 모두의 `avatar_url`을 비운다**. 기존 구글 **관리자** 가운데 처리방침 확인에서 별명을 아직 정하지 않은 계정(확인 창의 `first_time` 조건과 같은 판단)은 `display_name`을 **`선생님`**으로 바꾼다(확인 창에서 별명을 정하면 그 별명으로). 총괄도 포함. L14(`member_create_log.actor_name` 등 감사 기록에 남은 구글 관리자 실명)도 같은 백필에서 그 계정의 바뀐 표시 이름으로 맞춘다. 끝 점검을 더한다(구글 계정 `avatar_url` 0, 별명 안 정한 구글 관리자 이름 = `선생님`).
2. **M2 — 감사 기록에 남은 구글 이메일·실명**: ②에서 `member_withdrawal_log`(그리고 같은 모양의 `member_create_log`·`password_reset_log`도 확인)의 `target_email`이 `@class1.local`로 끝나지 않는 줄은 `target_email = mask_label(@ 앞)`, `target_name = mask_label(target_name)`로 가린다. 끝 점검. spec 4.4의 "구글 계정은 이 로그에 들어오지 않는다"는 메인 에이전트가 고친다.
3. **M3·M4 — 아이디 계정 판정**: ②의 `handle_new_user`와 `sync_member_directory`에서 "아이디 계정" = **이메일이 `@class1.local`로 끝나는 계정**(대소문자 무시)으로 바꾼다(가입 순간의 `app_metadata`에 기대지 않고, 이메일·비밀번호 자가 가입(실제 이메일)은 구글처럼 '인증 전'·이메일 가림이 되게). 메인 에이전트 확인: 공개 설정 `/auth/v1/settings` = `disable_signup:false`, `mailer_autoconfirm:false`, 켜진 로그인 `email`·`google`. `test-queries.sql`에 "② 뒤 처음 만든 학생이 인증 전으로 묶이지 않았는지" 확인 쿼리를 더한다.
4. **사용자 결정 — 사진 주소 받지 않기**: ②에서 `profiles`의 수정 권한을 `revoke update on public.profiles from anon, authenticated; grant update (display_name) on public.profiles to authenticated;`로(사진 주소는 아무도 직접 못 고침 — security definer 함수가 비우는 것은 그대로), **학생(role user)의 `avatar_url`을 모두 비운다**. 끝 점검(`has_column_privilege('authenticated','public.profiles','avatar_url','UPDATE')`가 거짓). ② 되돌리기는 권한을 `(display_name, avatar_url)`로 되돌린다(지운 값은 되돌리지 않음 — 머리말에 적기). ①의 323줄 근처 권한 재선언은 그대로 둔다(① 뒤·화면 배포 전 예전 프로필 창이 깨지지 않게 — 이유를 주석에).
5. **L3** — 처리방침이 시행된 뒤(`policy_effective_at` 있음)에는 `admin_set_contact_email`이 빈 값을 거부(문구: "처리방침이 시행된 뒤에는 문의 이메일을 비울 수 없어요. 다른 주소로 바꿔 주세요."). **L7** — `admin-clear-students`가 지울 수 없는 학생(구글 전용 등)을 건너뛰고 다음 학생으로 넘어가게(같은 20명 되풀이 없음). **L5** — spec 문장만 고칠 일이면 보고서에 적기만.
6. 그 밖의 낮음(L1·L2·L4·L6·L8~L13·L15·L16)은 고치지 않는다 — 보고서에 "그대로 둠"과 한 줄 이유.

## 시험
읽어서 대조 + 지난번처럼 스크래치 스크립트로 가린 글자·날짜 자체 시험이 그대로 통과하는지, `admin-clear-students` 가짜 서버 시험(L7 경우 추가). 끝나면 짧게 요약해 답한다(새 문장은 글자 그대로).
