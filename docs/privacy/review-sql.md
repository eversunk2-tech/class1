# 검토 보고 R1 — SQL·Edge Function 보안 (2026-10-20)

> 지침: `review-sql-instructions.md`. 기준: `spec.md`(개정 1~4), `privacy-policy.md`, `CLAUDE.md` SQL 절차·Supabase 절, `build-1/2/5-report.md`.
> 본 파일: SQL ①②③(`supabase/migrations/20261020000000·010000·020000_*.sql`), `docs/privacy/rollback-privacy-enforce.sql`·`rollback-profiles-members-only.sql`·`test-queries.sql`, 함수 `member-self-delete`·`admin-clear-students`·`admin-create-member`(바뀐 부분)·`supabase/config.toml`, 비교용 앞선 마이그레이션 20개·함수 4개.
> **코드는 고치지 않았다.** 실 DB·Supabase(공개 키 포함)에 접속하지 않았고 아무것도 내려받지 않았다. 로컬 Postgres가 없어 **읽어서** 대조했고, 스크래치(`…/scratchpad/privacy-r1/`)의 작은 파이썬 스크립트로 "마이그레이션을 차례로 읽어 지금 살아 있는 정의"를 뽑아 비교했다. 교사 인증 코드 값·개인 이메일은 쓰지 않았다.

## 0. 한눈에

- **높음 0 · 중간 4 · 낮음 16.** SQL 문법·권한·재귀·순서 점검은 튼튼하다. 중간 4개는 모두 **처리방침 문장과 실제 저장 상태가 어긋나거나, 확인하지 못한 가정에 기대는 곳**이고, 고치기 쉽다(②에 백필 몇 줄 + `handle_new_user` 조건 한 줄 + 대시보드 확인 하나).
- 스크립트로 직접 다시 확인한 것(빌드 보고와 따로):
  - 되돌리기 `rollback-privacy-enforce.sql` — 함수 **11/11**, 정책 **24/24**가 앞선 마이그레이션의 마지막 정의와 글자 그대로 같다(공백·주석 정규화).
  - ②의 좁힌 정책 **20/20**은 `is_full_admin()` → `is_admin()`으로 바꾸면 원래 정의와 같다. ②가 다시 정의한 함수 11개는 의도한 줄만 다르다(낱말 diff). ①이 다시 정의한 `my_admin_context`·`admin_log_member_create`도 추가만 있다.
  - 살아 있는 정책 중 `is_admin()`을 쓰는 것 = spec 4.6 표와 정확히 같다(좁힘 20 + 그대로 5: 과제 4·칭찬 문구 조회). 인증 전 계정이 쓸 수 있는 표(INSERT/UPDATE 정책이 있는 표) 전부에 제한 정책 19개가 붙는다(`post_reads`·`feedback_threads`·`views`는 직접 쓰기 정책이 없음).
  - 모든 `security definer` 함수(64개)에 `set search_path = ''` 있음, `any ((select` 0건, 정책 이름 최대 61바이트, CORS 블록은 함수 7개가 글자 그대로 같음(`check-answer`의 허용 헤더만 예전부터 다름), 새 함수의 로그·응답에 이름·아이디·id 없음(`scrub`).

## 1. 문제 표

### 중간

| # | 파일:줄 | 문제 | 근거 · 재현 | 제안 |
|---|---|---|---|---|
| M1 | `20261020010000_privacy_b_enforce.sql:654-667`(백필 2-3), `20261020000000_privacy_a_schema.sql:684-689`(`acknowledge_privacy`) | **기존 구글 관리자(총괄 포함, role admin)의 구글 실명·프로필 사진 주소가 ②·③ 뒤에도 `profiles`에 남는다.** 2-3은 `role='user' and class_id is null`만 가리고, 관리자는 확인 창(3-1)에서 별명을 정할 때만 바뀐다. 3-1은 [나중에]로 닫을 수 있어(spec 1.2-2) **무기한** 남을 수 있다. 처리방침 제2조 가 "구글 프로필 사진 주소는 이 사이트 데이터베이스에 저장하지 않습니다", 실명을 받지 않는다는 문장과 어긋나고, 선생님 이름은 로그인한 모든 회원이 읽으므로 실명이 그대로 보인다(옛 `handle_new_user`는 `full_name`이 없으면 **이메일 앞부분**을 이름으로 넣었다 — 그러면 이메일 일부가 노출). | ② 실행 뒤 읽기 쿼리로 확인 가능: `select count(*) from public.profiles p join public.member_directory d on d.id=p.id where p.role='admin' and coalesce(d.provider,'')<>'email' and not ('email'=any(d.providers)) and (p.avatar_url is not null or not exists (select 1 from public.member_verification v where v.user_id=p.id and v.ack_at is not null));` | ② 백필에 **모든 구글 계정(관리자 포함)의 `avatar_url = null`**을 더한다(사용자 입력이 필요 없음). 이름은 ① `'인증 전 회원'`처럼 중립 값으로 바꾸거나(확인 창이 별명을 받으므로 문제없음), 사용자에게 "확인 전까지 구글 이름이 보인다"를 처리방침에 적을지 묻는다. 가장 간단한 안: ②에서 구글 관리자 이름을 `'선생님'` 같은 중립 값으로 + 3-1 창은 별명 필수(지금 그대로). |
| M2 | `20261020010000_privacy_b_enforce.sql:630-667`(백필 — `member_withdrawal_log` 없음), `…:1119-1126`(새 읽기 정책), `supabase/functions/admin-delete-member/index.ts`(구글 계정 거부 없음) | **예전에 '탈퇴 처리'된 구글 계정의 `member_withdrawal_log.target_email`(구글 이메일 전체)·`target_name`(구글 실명)이 그대로 남는다.** spec 4.4는 "구글 계정은 이 로그에 들어오지 않는다"고 했지만 `admin-delete-member`에는 가입 방식 확인이 없어(구글 '완전 삭제' 메뉴가 생긴 09-28 전에는 화면에서도) 구글 계정을 탈퇴 처리할 수 있었다. 그 계정의 프로필은 남고(role user · 학급 없음) ② 뒤 `can_see_member_identity`가 총괄에게 참이라, 총괄은 API로 그 줄을 읽는다. 처리방침 제2조 가 "이메일 자체는 보관하지 않음"과 어긋난다(화면 코드는 `target_email`을 쓰지 않음 — `src/` 검색 0건). | 사용자 읽기 쿼리: `select count(*) from public.member_withdrawal_log where target_email is not null and target_email not like '%@class1.local';` — 0이면 해당 없음. ② 뒤에 새로 생기는 줄은 `member_directory.email`(가린 값)·별명/'인증 전 회원'을 복사하므로 괜찮다. | ② 백필에 한 덩어리 추가: `@class1.local`이 아닌 `target_email`을 첫 글자 + `***`로, 그 줄의 `target_name`을 `'인증 전 회원'`(또는 null)로. ②의 맨 끝 점검에 "@ 가 남은 비-아이디 이메일 0"도 더한다. (원하면 `admin-delete-member`에 구글 전용 계정 거부를 더함 — 지금은 화면만 막음, 별도 작업.) |
| M3 | `20261020010000_privacy_b_enforce.sql:201-203`(`handle_new_user`의 `v_id_login`) | **아이디 계정 판정이 "가입 순간(INSERT 트리거)에 `raw_app_meta_data.provider='email'`이 들어 있다"는 가정에 기댄다 — 확인하지 못함.** 만약 GoTrue가 관리자 생성(`auth.admin.createUser`) 때 `app_metadata`를 INSERT 뒤 UPDATE로 채운다면, ② 뒤 만드는 **모든 새 학생·교사 계정이 `member_verification('new')` + '인증 전 회원'** 이 되고, 학생은 `is_pending_google()`=참이라 과학 앱 기록·글이 서버에서 모두 거부된다(교사 계정은 코드 없는 확인 창). `sync_member_directory`는 UPDATE 트리거로 스스로 바로잡히지만 `handle_new_user`는 INSERT 때 한 번뿐이다. (지금 GoTrue 코드는 만들기 전에 provider를 넣는 것으로 알고 있어 가능성은 낮지만, 영향이 크고 시험 계획(`test-queries.sql`)에 "② 뒤 새로 만든 아이디 계정이 인증 전이 아닌지"가 없다.) | 시험 공백: test 5)·20)은 ② **전에** 만든 학생으로만 본다. | ① `v_id_login`에 방어 조건 `or lower(coalesce(new.email,'')) like '%@class1.local'`(관리자 생성 계정의 도메인)을 더한다. ② ②를 실행한 뒤 첫 학생을 만들고 `select count(*) from public.member_verification v join public.member_directory d on d.id=v.user_id where coalesce(d.provider,'')='email' or 'email'=any(d.providers);` = 0을 확인하는 줄을 `test-queries.sql`과 배포 안내에 넣는다. |
| M4 | 같은 곳 `:201-203` + `sync_member_directory :256-258` | **이메일·비밀번호 자가 가입 경로를 막는지 확인하지 못함.** 사이트에 가입 폼은 없지만 Supabase 가입 허용(CLAUDE.md "가입 허용 유지")이면 누구나 공개 키로 `/auth/v1/signup`에 실제 이메일로 가입할 수 있다. 그런 계정은 provider `email`이라 **아이디 계정으로 취급** → 인증 창·코드·제한 정책을 모두 건너뛰는 일반 회원(학습게임·블로그 댓글 쓰기, 잠금 때 읽기, 선생님 이름 읽기)이 되고, 실제 이메일이 `member_directory`에 가리지 않은 채 남는다. 결정 1("학생 임의 가입 불가")의 우회로다. "Confirm email 켬"이라 확인 메일을 받아야 로그인되는데, Supabase 기본 메일 발송이 아무 주소로나 가는지·사용자 지정 SMTP가 있는지는 확인하지 못했다(공식 문서로 확인 필요). | 서버 쪽은 읽어서만 확인. | 사용자가 대시보드(Authentication → Providers → Email / SMTP 설정)에서 "실제 이메일로 자가 가입 후 확인 메일을 받을 수 있는지"를 확인. 막혀 있지 않으면 `handle_new_user`의 아이디 판정을 **`@class1.local` 도메인일 때만**으로 좁혀 그 밖의 계정을 인증 전으로 시작하게 한다(그 계정은 [가입하지 않기]·'완전 삭제'의 "구글 전용" 조건에 걸리므로 총괄의 '탈퇴 처리'로 정리 — 안내 필요). M3의 방어 조건과 함께 정한다. |

### 낮음

| # | 파일:줄 | 문제 | 근거 | 제안 |
|---|---|---|---|---|
| L1 | ①`:556-561` | 전체 한도(10분 30번)는 계정마다 잠그는 advisory lock 밖에서 센다 → 여러 계정이 **동시에** 부르면 30번을 조금 넘길 수 있다. | 계정 잠금만 `pg_advisory_xact_lock(…, uid)` | 받아들여도 됨. 엄격히 하려면 전체 한도 확인 전에 고정 키로 `pg_advisory_xact_lock(hashtext('verify_global'))`. |
| L2 | ①`:727` | `gen_salt('bf')` 기본 비용(6) + 6자리 코드(경우의 수 100만) → 해시가 새면 몇 초 안에 코드를 알아낸다. 실제 보호는 표 권한(서비스 롤도 회수)이다. 처리방침 "되돌릴 수 없는 값"은 기술적으로 맞지만 과장되지 않게. | — | `gen_salt('bf', 10)` 정도로 올리기(인증 1회 수십 ms) — 선택. 문구는 그대로 둬도 됨. |
| L3 | ①`:738-766` | `admin_set_contact_email(null)`로 시행 **뒤에도** 문의 이메일을 지울 수 있다 → 처리방침 제10조 연락처가 빈다(② 맨 앞 점검은 한 번만 본다). | — | `policy_effective_at`이 있으면 null 거부(또는 화면에서만 막기). |
| L4 | ①`:753` | 이메일 모양 검사가 `javascript:x//@a.b` 같은 문자열도 통과. 총괄만 넣을 수 있어 위험은 낮다. | 정규식 `^[^@]+@[^@]+\.[^@.]+$` | 화면이 `mailto:` 접두사 + 글자로만 보이는지 R2가 확인(이 보고에서 화면은 안 봄). |
| L5 | ①`:273-302` | spec 4.1은 `class_cleanup_log`를 "총괄 읽기용 RPC로만 조회"라 했지만 읽는 RPC가 없다(쓰기만). | 함수 목록 | spec 문장을 고치거나 RPC 추가 — 기능 영향 없음. |
| L6 | ①`:1036-1048`, `admin-clear-students` | **학급 없는 학생**(학급이 지워져 `class_id`가 null이 된 학생 — FK `on delete set null`)은 기한 현황에 안 세고 '학급 정리' 대상도 아니다. 총괄에게는 아이디·이름이 온전히 보인다(spec 4.11 표대로지만 처리방침 제7조 "아이디는 담임만"에는 이 예외가 없다). | `can_see_member_identity`: 총괄 + 학급 없음 = 참 | 기한 현황에 "학급 없는 학생 n명"(총괄만)을 더하거나 처리방침에 한 줄. 지금은 학급을 지우는 RPC가 없어 드묾. |
| L7 | `admin-clear-students/index.ts:514-519` | 매번 id 순 앞 20명을 고른다 → 지울 수 없는 학생(구글 전용 등)이 **20명 이상** 앞에 몰리면 같은 20명만 되풀이하고 뒤 학생은 처리되지 않는다(화면은 `deleted=0`이면 멈춤). | `.order("id").limit(BATCH)` | 구글 전용으로 확인된 학생을 고를 때 빼거나 `offset`. 실제로는 드묾. |
| L8 | `admin-clear-students/index.ts:416-437` | 총괄이 가린 줄을 지울 때 확인 입력 `2***`는 같은 첫 글자의 여러 학생과 같아 **실수 방지 효과가 거의 없다**(서버 판정은 맞음). | — | 화면에서 학급 이름·가입일을 함께 보이고 한 번 더 확인(R2 몫). |
| L9 | `admin-reset-password/index.ts:245` | 총괄이 다른 학급 학생의 비밀번호를 초기화하면 임시 비밀번호를 받는다. 학생 아이디가 번호 꼴(`2026xx`)이라 `2***`로도 짐작할 수 있으면 **그 학생으로 로그인해** 학습 기록·같은 반 친구 이름을 볼 수 있다(사이트 안 경로). 결정 ④("총괄도 계속")에서 생기는 한계 — 첫 로그인 비밀번호 변경 강제로 흔적은 남는다. | 기존 동작 | 처리방침 제7조 '한계'에 "총괄은 비밀번호 초기화 권한이 있어 기술적으로 학생 계정에 들어갈 수 있다"를 더할지 사용자에게 묻기. |
| L10 | `admin-create-member/index.ts:412` | 담임이 아무 아이디로 만들어 보면 "이미 있는 아이디"로 **다른 학급 학생 아이디가 있는지** 알 수 있다(아이디는 전체에서 하나). | 기존 동작 | 받아들임(문서에만). |
| L11 | `member-self-delete/index.ts:289-388` | 확인(②~⑤)과 계정 삭제(⑦) 사이 경쟁: 다른 탭에서 인증을 마치거나(cancel), 그사이 학생이 생기면(withdraw) 로그인 계정만 지워지고 `self_purge_member`가 예외 → warning(본인은 다시 못 부름). 교사였던 계정이면 정리에 '담임 해제'가 먼저 필요한데, 학생이 있는 학급을 혼자 맡았으면 해제도 막힌다. | 설계상 알려진 한계(보고서 2) | 드묾 — warning 문구 그대로 두되 README에 총괄의 복구 순서(학급 정리 → 담임 해제 → 완전 삭제)를 적기. |
| L12 | ①`:1263-1265` | 다른 학생 제출물이 달린 과제는 회원 탈퇴 때 지우지 않고 남긴다(쓴 사람만 비움). 처리방침 8-6 "지워지는 것: … 과제"와 드물게 어긋남. | build-1 결정 5 | 사용자 확인 대상(build-1 질문 목록)에 이미 있음 — 결정되면 8-6 문구 맞추기. |
| L13 | `20260921000000_init_blog.sql` "profiles: 본인만 수정" · ①`:395-419` | 별명 규칙(예약어 '운영자'·'총괄'·`@`·`http`)은 인증·확인 RPC에서만 검사한다. 인증 뒤 '프로필 수정'으로 선생님이 별명을 '운영자'나 **자기 이메일**로 바꿀 수 있고, 선생님 별명은 모두에게 보인다. | build-3 질문과 같음 | 서버에서도 막으려면 `profiles` BEFORE UPDATE 트리거로 `privacy_nickname_error` 검사(교사만) — 사용자 결정. |
| L14 | `20260923030000_member_create_log.sql`(`actor_name`) | ② 전에 만든 계정 기록의 `actor_name`에 구글 관리자의 구글 실명(당시 표시 이름)이 남는다(그 학생의 담임이 읽음). | 백필 없음 | M1과 함께 정리하려면 구글 관리자 `actor_id`의 `actor_name`을 새 별명으로 맞추거나 비움 — 선택. |
| L15 | `CLAUDE.md:41`·`:109` | "함수 5개"(허용 출처를 바꾸면 모두 다시 배포, 연동 점검) → 이제 7개. | — | 메인 에이전트가 문서 갱신 때(spec 7절 11번). ② 뒤 옛 마이그레이션 재실행 금지 규칙도 CLAUDE.md에 추가. |
| L16 | `admin-delete-member`·`admin-reset-password`(기존) | 로그에 GoTrue·SQL 오류 문구를 가리지 않고 남긴다(새 함수는 `scrub`). id가 섞일 수 있다. | `console.error(…, x.message)` | 범위 밖 — 다음에 같은 `scrub` 적용 권함. |

(덧: `privacy_nickname_error`·`verify`는 `btrim`(일반 공백만)을 쓰고 화면은 `.trim()`이라 앞뒤 전각 공백이 있는 별명이 그대로 저장될 수 있다 — 겉모양만. ② 실행 전에 `member-self-delete`가 배포되지 않았으면 [가입하지 않기]가 실패한다 — 배포 순서가 막아 줌.)

## 2. 꼭 볼 것 1~6 결과

1. **정보가 새는 길** — 표 직접 읽기·embed·RPC·뷰(0개)·함수 반환값·오류 문구·Edge Function 응답을 훑었다.
   - 학생 이름: ③ 뒤 `profiles` 행 자체가 같은 학급·담임(+본인)에게만 보이고, 그 밖에는 embed가 `null` → `member_name_labels`가 첫 글자 + `***`만 준다(사진 null). 인증 전 구글은 `[]`. 이름을 돌려주는 다른 security definer 함수는 `my_boards`(선생님 이름)뿐. invoker 함수(`feedback_thread_summaries`·`app_result_stats`)는 이름을 돌려주지 않는다. **지킴.**
   - 학생 아이디: `member_directory`·감사 기록 3개 읽기 = `can_see_member_identity`(담임 · 총괄은 선생님/학급 없는 줄), 총괄은 `admin_masked_member_rows`(가린 값). `admin_must_change_password_ids`도 같은 범위. `admin-clear-students`의 이름 확인은 총괄에게 가린 이름으로만 비교 → 원래 이름을 알아내는 오라클 없음. 응답·로그에 이름·아이디 없음. **지킴**(예외 L6·L9·L10).
   - PUBLIC 판별 함수로 알 수 있는 것: `is_full_admin`·`is_pending_google` = 나 자신만. `can_see_member_name(uuid)` = 이미 볼 수 있는 행(선생님·같은 반)만 참, 없는 id와 다른 반 학생은 둘 다 거짓이라 구분되지 않음. `can_see_member_identity`는 학생에게 늘 거짓, 총괄에게는 "선생님/학급 없음" 구분만(가린 줄 RPC로 이미 아는 것). `member_name_labels`는 아는 id의 첫 글자·탈퇴 여부를 준다(설계대로).
   - 구글 이메일: `member_directory` 가림 **지킴**, 단 M2(옛 탈퇴 기록). 구글 사진·이름: 새 가입·인증 전 **지킴**, 단 M1(기존 구글 관리자).
   - 인증 전 구글 계정: 쓰기 = 제한 정책 19개(쓸 수 있는 표 전부), RPC 2개(`record_post_read`·`get_or_create_feedback_thread`) 막음, `mark_thread_read`·`increment_post_view`는 해가 없는 기록이라 그대로. 읽기 = 잠금 때 `can_browse()` 거짓, 프로필 자기 것만, 회원 명단 0. **지킴**(우회 가능성 M4).
   - 코드: bcrypt 해시만(`verification_settings`는 서비스 롤도 권한 회수), 계정당 advisory lock + `for update`로 동시 호출 한 줄, 가입하지 않기 → 재가입해도 시도 줄은 `on delete set null`로 남아 전체 한도에 계속 들어감, 전체 10분 30번. **지킴**(L1·L2).
   - 학습 기록은 담임만: 기존 `teaches_student` 정책 그대로(이번 SQL이 바꾸지 않음). **지킴**(L9).
2. **권한** — 새 definer 함수 모두 `search_path = ''`·`public.`/`extensions.` 접두사. 실행 권한은 spec 4.2·4.11 표와 같다(판별 4개 PUBLIC, 화면 RPC는 authenticated만, 서비스 롤 전용 5개는 public·anon·authenticated 회수, 글자·날짜 도우미 5개는 아무도). ①·②의 맨 끝 점검이 같은 표로 `has_function_privilege`를 다시 본다. `mask_label` 회수는 spec에 없던 추가(해 없음).
3. **실행 안전** — 세 파일 모두 재실행 안전(`if not exists`·`create or replace`·`drop … if exists`·이름 붙인 제약 다시 만들기·백필은 아직 안 한 줄만). 정책 안에서 같은 표를 다시 읽지 않음(③의 `profiles` 정책은 definer `can_see_member_name`만 — 소유자 postgres라 RLS를 거치지 않음, Supabase의 표준 방식). `any ((select` 0건, 이름 ≤ 61바이트, 4-인자 `admin_log_member_create` 지우고 5-인자만(① 12-5가 남았는지 확인), 그 밖에 겹치는 인자 형식 없음. 순서 점검: ①은 ⑦·⑧을, ②는 ①(가리기 함수 포함)·⑤·⑧·코드·문의 이메일·총괄을, ③은 ②(제한 정책·`can_browse` 본문)와 "다른 정책이 profiles를 직접 읽지 않음"을 먼저 본다 — 실제로 막는다. ②·③ 머리말에 "옛 마이그레이션 재실행 금지" 있음. 되돌리기는 ②·③ 전 정의로 정확히 돌아간다(1절 스크립트). 돌아가지 못하는 것(가린 이메일·'인증 전 회원' 이름·비운 사진, 다음 로그인 때 이메일이 다시 채워짐, 인증 전 줄 삭제)은 머리말에 적혀 있다.
4. **기능 정확성**
   - `purge_member_records` ↔ ⑦ `admin_purge_oauth_member`: 같은 순서(신고 → 글 → 관리 기록 3곳 → 프로필) + ④ 선생님 글·과제(제출물 없는 것)·블로그 글. `profiles`를 가리키는 외래키 전부가 cascade/set null(restrict 0 — ① 12-6이 다시 확인), `posts`·`assignments`·`feedback_threads`·`community_posts`를 가리키는 외래키도 모두 cascade/set null, `assignments.class_id`만 restrict이고 탈퇴 경로가 먼저 지운다. 지운 뒤 남는 것: 시도 기록(계정 번호 null), 학급 정리 기록(처리자 null), 제출물 달린 과제(L12), 칭찬 문구.
   - 기한 계산: 날짜 표(3월 1일·10월·12월·1월·2월 1/10/28일·윤년 2월 1/29일·3월 1일)를 손으로 다시 따라가 ① 12-8 기대값과 같음을 확인 — 2월 알림·3월부터 기한 지남·윤년 2월 29일 지남·1월에는 이번 학년도 학생을 세지 않음. **맞음**(L6만).
   - 보호자 동의: 학생 줄이 하나라도 있으면 `guardianConsent === true`가 아니면 계정 0개로 400, 5-인자 함수가 없으면 500으로 계정 0개, 학생마다 `p_guardian=true` → 로그 + 명단 표시. 한 명·학급 표시 RPC는 담임만(`teaches_student`·`my_class_ids`). **맞음.**
   - `admin_set_role`: 학급 있음 + 내가 담임 아님이면 거부(탈퇴 확인 뒤), 지정·해제 때 `teacher_scope='full'`. **맞음.**
   - `admin-clear-students` 확인 이름: 담임 = 원래 이름(표시 이름 → 아이디), 담임 아닌 총괄 + 학급 있는 학생 = `maskedStudentName` = SQL `mask_label(privacy_name_source(…))`(앞뒤 공백 25자 집합 같음, 첫 코드 포인트, 비면 `***`). **같다.**
5. **Edge Function** — 두 새 함수 `verify_jwt = true` + 함수 안 `auth.getUser(jwt)`, 호출자 역할·담임은 서비스 롤로 실제 값을 읽어 확인하고 SQL 함수가 한 번 더 확인. CORS는 다른 함수와 같은 규칙. 응답·로그에 이메일·이름·id·비밀값 없음(`scrub`). 실패 때: 게임 파일 단계에서 멈춤(계정 그대로·다시 누르면 됨), 계정 삭제 뒤 기록 단계 실패는 학생이면 같은 메뉴로 다시(멱등), 자기 탈퇴는 warning(L11).
6. **배포 순서 위험**
   - ① 뒤 ~ 함수 배포 전: 지금 배포된 `admin-create-member`가 4개 이름 인자로 5-인자 함수(마지막 기본값)를 부른다 — PostgREST가 기본값 인자를 빼고 부르는 것을 지원한다고 알고 있으나 **확인 못 함**. 실패해도 옛 함수는 감사 로그만 warning으로 넘기므로 계정 생성은 된다.
   - 함수 배포 ~ 화면 push: 예전 화면은 학생 계정을 만들 수 없음(의도 — 같은 날 이어서). `admin-create-member`를 세 함수 중 마지막에, push 직전에 배포하기를 권한다.
   - 화면 push ~ ②: ②의 "코드·문의 이메일이 있어야 실행" 점검이 새 화면이 올라갔다는 증거 역할을 한다(새 화면에서만 넣을 수 있음). 단 묶음 6(가린 줄 합치기·`member-labels`)이 **같은 push에 들어가야** ② 뒤 총괄 명단에서 다른 학급 학생 줄이 사라지지 않는다.
   - ② ~ ③: 프로필이 아직 공개, 기존 구글 관리자 실명(M1), 처리방침 "준비 중" — 연달아 실행(R16) 그대로.
   - ②를 `member-self-delete` 배포 전에 실행하면 [가입하지 않기]가 실패(배포 순서가 막아 줌).
   - 되돌리기는 ③ → ② 순. ①은 ②·③ 뒤에 다시 돌려도 안전(②가 바꾼 것을 건드리지 않고 `profiles` 열 권한도 같은 목록).

## 3. 처리방침 약속 ↔ 서버 규칙 대조

| 약속(처리방침·창 글) | 서버 규칙 | 판정 |
|---|---|---|
| 구글 선생님: 이메일은 첫 글자 + `***`만, 이메일 자체는 보관하지 않음(제2조 가) | ② `sync_member_directory` 가리기 + 백필 2-1 | **일부 못 지킴** — 옛 `member_withdrawal_log` 줄(M2, 확인 필요) |
| 구글 프로필 사진 주소는 DB에 저장하지 않음 · 실명을 묻지 않음 | ② `handle_new_user` 새 가입 null, 백필 2-3(role user), `verify`·`acknowledge_privacy`가 비움 | **못 지킴(기존 구글 관리자)** — 확인 창 전·[나중에] 동안(M1) |
| 인증 전 구글 계정은 글·댓글·기록을 남길 수 없다(8-3) | 제한 정책 19개 + RPC 2개 | 지킴(이메일 자가 가입 우회 M4 확인 필요) |
| 교사 인증 코드가 맞아야 선생님 권한, 권한은 자기 학급 일 | `verify_google_teacher` → `teacher_scope='class'`, 정책 20개 + 함수 4개 `is_full_admin()` | 지킴 |
| 코드는 되돌릴 수 없는 값으로만, 틀린 시도 횟수 제한 | bcrypt(`extensions.crypt`), 계정당 5/15분·10/60분·15+/24시간, 전체 10분 30번 | 지킴(L1·L2) |
| 시도 기록은 계정 번호·맞았는지·시각만, 30일 지난 것은 시도 때 지움 | `member_verification_attempts`, `verify`·`admin_privacy_overview`에서 삭제 | 지킴 |
| 학습 기록은 그 학생의 담임만(총괄도 다른 반 못 봄) | 기존 `teaches_student` 정책 그대로 | 지킴(사이트 안 우회 L9) |
| 총괄은 모든 학급 학생 명단을 보고 비밀번호 초기화·탈퇴·기록 삭제 — 다른 학급은 아이디·별명 첫 글자만, 학급·가입·접속 시각은 보임 | `admin_masked_member_rows`, `can_manage_member` 그대로, Edge 함수 | 지킴 |
| 학생 아이디는 그 학생의 담임만 | ② 읽기 정책 4개(`can_see_member_identity`), `admin_must_change_password_ids` | 지킴(학급 없는 학생 L6, 별명 기본값 = 아이디는 같은 반에 보임 — 제2조 다에 적혀 있음) |
| 학생 별명·사진은 같은 학급 학생·그 담임만, 그 밖의 회원(총괄 포함)은 첫 글자 + `***`, 비로그인은 '회원' | ③ `can_see_member_name`, `member_name_labels`, anon 정책 없음 | 지킴(화면 채우기는 R2) |
| 선생님 별명은 로그인한 모든 회원 | `can_see_member_name`: role ≠ user | 지킴 |
| 인증 전 구글 계정은 자기 프로필만 | `can_see_member_name`: 본인 외 `not is_pending_google()` | 지킴 |
| 로그인 잠금이 켜지면 인증 전 계정은 비로그인처럼 | ② `can_browse()` | 지킴 |
| 자유게시판 = 같은 학급, 총괄은 관리용으로 모든 게시판 / 학습게임 = 모든 회원(잠금 꺼짐이면 비로그인도) | ⑧ 정책 그대로(학습게임 관리만 `is_full_admin`) | 지킴 |
| 학생 계정은 보호자 동의서를 받은 뒤에만 · 누가 언제 표시했는지 기록 | `admin-create-member` 400 + `admin_log_member_create(p_guardian)` | 지킴(지금 있는 학생은 사용자 할 일) |
| 학급 정리: 학생 계정·기록·게임 파일·관리 기록, 탈퇴 학생 포함, 기록은 인원수만 | `admin-clear-students` + `admin_purge_class_member` → `purge_member_records`, `admin_finish_class_cleanup` | 지킴(구글 로그인 학생은 warning, 학급 없는 학생은 대상 아님 L6) |
| 보유: 종업식 뒤 그 학년도 2월 28일까지, 2월 알림·기한 지남 표시, 자동 삭제 없음 | `privacy_retention_window` + `admin_class_retention_status`(표시만) | 지킴 |
| 기록까지 삭제(보호자 요구) — 바로 | `admin-clear-students` userId 모드 | 지킴 |
| [가입하지 않기] — 바로 삭제, 기존 회원은 글·댓글·좋아요도 | `member-self-delete` cancel → `self_purge_member` | 지킴 |
| 구글 선생님 회원 탈퇴 — 계정·글·과제·메시지, 학생 있는 학급이면 막힘, 혼자 맡은 빈 학급 삭제 | `member-self-delete` withdraw → `self_purge_member` | 지킴(제출물 달린 과제 L12) |
| 인증 전 계정을 기한 두고 자동 삭제하지 않음, 30일 넘으면 표시 | 예약 작업 없음, `admin_privacy_overview`·`admin_member_privacy_flags` | 지킴 |
| 지운 자료는 되살릴 수 없음(무료 요금제 백업 없음) | `deleteUser` 하드 삭제 + DB 삭제 | 서버 규칙은 지킴 · 요금제·백업은 확인 못 함 |
| 이 사이트가 구글에 보내는 개인정보 없음(AI 끔) | 이번 범위 밖(앱 `answer-check.js`), `check-answer`는 남아 있음 | 확인 못 함(Secret `GEMINI_API_KEY` 해제 여부 — spec 7절 0번) |
| 문의 이메일 공개 | `site_settings.contact_email`(공개 읽기) | 지킴(시행 뒤 지울 수 있음 L3) |

## 4. 확인하지 못한 것 (실 DB·실제 실행이 없어 읽어서만 본 것)

- 세 SQL·되돌리기·시험 쿼리의 **실제 실행**(문법·권한 오류의 최종 확인) — 특히 ①의 자체 시험 VALUES 형 추론, `raise … using message/detail`, `p_ids[1:1000]`, `test-queries.sql` 9)의 do 블록 안 `set local role`, SQL Editor의 "한 번의 Run = 한 트랜잭션"에서 `set local`이 듣는지.
- **GoTrue가 계정을 만들 때(INSERT 순간) `app_metadata.provider`를 넣는지**(M3) · 이메일 자가 가입·확인 메일 발송 설정(M4).
- PostgREST가 4개 이름 인자 호출을 5-인자(기본값) 함수로 잡는지(배포 사이 감사 로그).
- 실 DB에 구글 이메일이 든 `member_withdrawal_log` 줄이 있는지(M2 쿼리), 기존 구글 관리자 수(M1 쿼리).
- `pgcrypto`가 `extensions` 스키마에 있는지(① 12-1이 막아 줌), 함수 소유자(postgres)가 RLS를 거치지 않는지(Supabase 표준이라 그렇다고 봄 — 아니면 ③에서 42P17).
- 지금 Supabase에서 SQL Editor(postgres)가 `storage.objects`에 정책을 만들 수 있는지(예전 마이그레이션은 됐음).
- ③ 정책이 행마다 함수를 부르는 속도(학급 사이트 규모면 가볍다고 봄).
- Edge Runtime 실제 동작(Deno·supabase-js 최신판, `deleteUser` 404 모양, 학급 정리 20명 한 번의 시간), 실제 Verify JWT 게이트웨이.
- Supabase API 기록이 RPC 본문(교사 인증 코드)을 남기는지(spec 4.3 "확인 필요" 그대로).
- 무료 요금제·백업 없음·Secret `GEMINI_API_KEY` 해제 여부(대시보드 — 사용자 확인).

## 5. 결론

중간 4개는 처리방침이 사실이 되는 데 직접 걸린다: M1(②에 구글 관리자 사진 비우기·이름 중립 값) · M2(②에 옛 탈퇴 기록 가리기 백필) · M3(`handle_new_user`에 `@class1.local` 방어 조건 + ② 뒤 새 학생 확인 쿼리) · M4(대시보드에서 이메일 자가 가입 확인 → 필요하면 M3와 함께 판정 좁히기). 셋 다 아직 실행 전인 같은 파일을 고치면 되고, 낮음은 사용자 결정 또는 다음 작업으로 미뤄도 된다.

(첫 검토 결론: 고친 뒤 배포 — 아래 재확인이 이를 대신한다)

## 6. 재확인(고침 1) — 2026-10-21

> 대상: `fix-1-sql-instructions.md`·`fix-1-sql-report.md`로 고친 부분만 다시 봤다. 범위는 SQL ①②, 되돌리기 두 파일, `test-queries.sql`, `admin-clear-students`, 그리고 사진 주소 권한 변경이 닿는 화면·함수·트리거. 같은 규칙을 지켰다(코드 수정 없음, 실 DB·Supabase 접속 없음, 내려받기 없음). 스크래치 스크립트로 되돌리기를 다시 대조했다.

### 6-1. 고친 것 — 판정

| # | 고친 곳 | 판정 |
|---|---|---|
| M1 | ② 2-4: 구글 등 계정과 학생 모두의 `avatar_url` → null. 2-5: 처리방침 확인(`ack_at`)을 아직 안 한 구글 등 관리자 이름 → `선생님`. 끝 점검 6-10 | **고쳐짐.** 판단 기준이 확인 창의 `first_time`(`ack_at` 없음)과 같다. 인증을 마친 구글 선생님은 `verify`가 `ack_at`을 남기므로 건드리지 않는다. |
| M2 | ② 2-7: `member_withdrawal_log`의 이메일·이름, `member_create_log`의 이메일을 `mask_label`로 가림(`@`가 있고 `@class1.local`이 아닌 줄). 끝 점검 6-9 | **고쳐짐.** 가린 줄에는 `@`가 없어 다시 실행해도 건너뛴다. `password_reset_log`에는 이메일·이름 칸이 없다(확인함). ② 맨 앞 점검이 ①의 `mask_label`이 있는지 본다. |
| M3·M4 | ② 1-1·1-2: 아이디 계정 판정 = `lower(email) like '%@class1.local'`. 2절 백필과 6절 점검도 같은 판정 | **가정 의존은 없어짐**(가입 순간의 `app_metadata`를 보지 않음). 실제 이메일로 스스로 가입한 계정도 '인증 전'으로 시작하고 이메일이 가려진다. 공개 설정이 `disable_signup:false`·`mailer_autoconfirm:false`라는 메인 에이전트 확인을 보면 이 방어가 필요했다. **단 새 문제 N1·N2가 생겼다**(아래). |
| 사진 권한 | ② 1-0: `grant update (display_name)`만. 끝 점검: authenticated·anon 모두 사진 주소 수정 권한 없음. ① 3-1: 다시 실행할 때 ② 상태면 별명만 준다. 되돌리기 3-19: `(display_name, avatar_url)`로 복원 | **깨지는 곳 없음.** 근거는 아래 6-2. |
| L3 | ① 7-2: 처리방침 시행(`policy_effective_at` 있음) 뒤에는 빈 값을 거부 | **고쳐짐.** `test-queries` 27)이 오류로 끝내 되돌리는 방식이라 안전하다. |
| L7 | `admin-clear-students`: 그 학급 학생을 id 순으로 최대 1000명 읽는다. 지울 수 없는 학생은 20명 묶음에 세지 않고 건너뛴다. 가입 방식은 100명씩 나눠 읽는다 | **고쳐짐.** 같은 20명을 되풀이하지 않는다. 지우다 실패한 학생은 묶음에 세지만, 나머지는 계속 처리되므로 정리가 멈추지 않는다. PostgREST 기본 최대 1000줄과 한도가 같다. |
| L14 | ② 2-6: `member_create_log.actor_name`을 그 구글 등 계정의 지금 표시 이름으로. 끝 점검 | **고쳐짐.** 처리자 계정이 지워진 줄(`actor_id` 없음)은 판단할 수 없어 그대로 남는다(보고서대로). |
| 되돌리기 | `rollback-privacy-enforce.sql` | **맞음.** 스크립트로 다시 대조했다. 함수 11/11(`handle_new_user`·`sync_member_directory` 포함)과 정책 24/24가 옛 정의와 글자 그대로 같다. 프로필 수정 권한도 옛 `(display_name, avatar_url)`로 돌아간다. 끝 점검에 권한 확인이 있다. 되돌릴 수 없는 것(비운 사진, `선생님` 이름, 가린 감사 기록)은 머리말에 적혀 있다. |
| 구조 | 세 파일 | `$$` 짝이 맞다(①64·②26·되돌리기26). `class1.local` 비교는 모두 `lower()` 쪽에서 한다. LIKE 패턴에 `_` 와일드카드가 없다. `test-queries` 19-2)·19-3)·27)은 읽기만 하거나 오류로 끝내 되돌린다. |

### 6-2. 사진 주소 수정 권한을 별명만으로 바꾼 영향

- **화면**: `src/components/profile-dialog.tsx`는 지금 작업 트리에서 `update({ display_name })`만 보낸다. `.select("id")`는 SELECT 열 권한과 본인 행 정책으로 통과한다. `src/` 어디에도 `avatar_url`을 쓰는 update·upsert·insert가 없다(읽기만). 과학 앱 공통 틀(`scripts/templates`)은 `profiles`에 쓰지 않는다.
- **트리거**: `profiles_updated_at`(BEFORE UPDATE, invoker)이 바꾸는 `updated_at`은 열 권한 검사 대상이 아니다. Postgres는 UPDATE 문의 SET 목록 열만 검사한다.
- **security definer 함수**: `verify_google_teacher`·`acknowledge_privacy`·`handle_new_user`가 사진 주소를 비우는데, 모두 소유자 권한이라 영향이 없다. profiles를 고치는 invoker 함수는 없다.
- **Edge Function**: 서비스 롤이라 영향이 없다.
- **배포 순서**: 별명만 보내는 새 프로필 창이 ② **전에** 배포돼 있어야 한다. 그렇지 않으면 예전 창의 저장이 42501로 실패한다. ② 머리말과 보고서 7절에 적혀 있다.
- **다시 실행**: ①을 다시 실행해도 ②가 적용된 상태면 사진 주소 권한이 되살아나지 않는다. ② 되돌리기 뒤에 ①을 다시 실행하면 옛 목록이 된다. 둘 다 맞다.

### 6-3. 새 문제

| # | 파일:줄 | 문제 | 근거 | 제안 |
|---|---|---|---|---|
| **N1 (중간)** | ② `:241`(`handle_new_user`), `:295-297`(`sync`), 2-1·2-2·2-5·2-7 / `supabase/functions/admin-create-member/index.ts:104-123`, `src/lib/member-import.ts:45-50`, `scripts/import-users.mjs:265` | **관리자가 만드는 계정은 아이디 칸에 이메일 형식(예 `kim@school.kr`)도 받는다.** 화면·함수·예비 스크립트 모두 "이메일 형식"을 허용한다. 새 판정에서는 이런 계정이 아이디 계정이 아니게 되어 다음 일이 생긴다.<br>① **② 뒤 새로 만든 이메일형 학생은 `member_verification('new')` + `인증 전 회원`이 된다.** 함수가 role user·학급을 넣어도 `is_pending_google()`가 참이라 과학 앱 기록·글이 막히고, 학생 화면에 교사 인증 코드 창이 뜬다. 같은 방식으로 만든 교사 계정은 확인 창이 뜬다(결정 3 "관리자가 만든 아이디 계정은 창 없이"와 다름).<br>② **이미 있는 이메일형 계정은 회원 명단·감사 기록의 이메일이 `k***`로 가려진다.** 그 학생의 담임도 아이디를 온전히 볼 수 없게 된다(처리방침 "아이디는 담임만 온전히"와 다름). 이메일형 교사는 이름이 `선생님`으로 바뀌고 확인 창이 뜬다.<br>19-3)의 확인 쿼리는 `@class1.local` 계정만 보므로 이 경우를 잡지 못한다. | 코드 대조(`validateRow`가 `id.includes("@")`일 때 이메일 정규식만 검사, `toEmail`이 그대로 사용) | **사용자 결정 1개 + 작은 고침.** 먼저 ② 전에 읽기 쿼리로 이메일형 계정이 있는지 본다: `select p.role, count(*) from public.profiles p join public.member_directory d on d.id = p.id where (coalesce(d.provider,'')='email' or 'email'=any(d.providers)) and lower(d.email) not like '%@class1.local' group by 1;`<br>그다음 둘 중 하나를 고른다.<br>(가) 아이디를 `@` 없는 꼴(또는 `@class1.local`)만 받게 `admin-create-member`·`member-import.ts`·`import-users.mjs`를 고치고, 이미 있는 이메일형 계정은 따로 정한다. **추천**: 새 판정과 처리방침이 모두 맞는다.<br>(나) 이메일형을 계속 받을 거라면 `admin-create-member`가 계정을 만든 직후 서비스 롤로 그 계정의 `member_verification` 줄을 지우고 `display_name`을 아이디로 되돌린다. 이 경우에도 회원 명단 이메일은 가려진다.<br>어느 쪽이든 19-3)에 "② 뒤 관리자가 만든 계정(감사 기록에 생성 줄이 있는 계정)에 인증 전 줄 0"을 더한다. |
| N2 (낮음) | ① `self_purge_member`(가입 방식 판정), `member-self-delete/index.ts:267`·`:289`, `admin-purge-oauth-member`, ⑦ SQL | **"구글 등 = 이메일이 `@class1.local`이 아님"(②)과 "구글 전용 = 가입 방식에 email 없음"(삭제 함수들)이 어긋난다.** 실제 이메일로 스스로 가입했거나 N1처럼 인증 전으로 묶인 이메일·비밀번호 계정은 확인 창에 [가입하지 않기]가 보인다. 그런데 누르면 늘 "아이디로 로그인하는 계정은 여기서 지울 수 없어요…"로 실패하고, 총괄의 '완전 삭제'도 거부된다. 남은 길은 총괄의 '기록까지 삭제'(학급 없는 학생은 총괄만 — `admin_purge_class_member`가 허용)나 '탈퇴 처리'뿐이다. | 코드 대조 | 지금 `mailer_autoconfirm:false`라 스스로 가입한 계정은 확인 메일을 받아야 로그인할 수 있어 드물다. 둘 중 하나: 화면이 가입 방식에 email이 있는 계정에는 [가입하지 않기] 대신 "운영자에게 알려 주세요" 문구를 보인다. 또는 cancel 조건을 "인증 전 줄이 있고 이메일이 `@class1.local`이 아님"으로 넓힌다(SQL ①·함수 — 별도 판단). |
| N3 (낮음) | ① `privacy_nickname_error` 예약어, ② 2-5 | `선생님`이 예약어에 없다. 그래서 확인 창에서 별명을 `선생님`으로 정하는 교사와 "아직 안 정한" 교사가 구별되지 않는다. 또 확인 창을 [나중에]로 닫은 관리자가 '프로필 수정'으로 별명을 바꿔도(`ack_at`은 그대로 비어 있음) ②를 다시 실행하면 2-5가 다시 `선생님`으로 덮어쓴다. | 코드 대조 | 예약어에 `선생님`을 더한다(①, 화면 `privacy.ts`도 같게). 덮어쓰기는 ②를 다시 실행할 때만 생기므로 그대로 두어도 된다. |

### 6-4. 확인하지 못한 것(이번에 더한 것)

- 실 DB에 이메일형 아이디 계정(N1)·스스로 가입한 실제 이메일 계정(N2)이 있는지. 위 쿼리로 사용자가 본다.
- `update … from … join` 백필(2-5·2-6)과 ①의 `do` 블록 안 `grant`를 실제로 실행해 보지는 못했다(문법은 읽어서 대조).
- 스스로 가입한 실제 이메일 계정이 확인 메일을 실제로 받을 수 있는지(SMTP 설정).
- 기존 항목(4절)은 그대로 남는다. 다만 M3의 `app_metadata` 의존은 없어졌다.

### 6-5. 재확인 결론

M1~M4·L3·L7·L14와 사진 주소 권한은 바르게 고쳐졌다. 되돌리기도 정확하다. 남은 것은 새 판정이 만든 **N1** 하나다. 이메일형 아이디를 계속 받을지 사용자가 정하고, (가)든 (나)든 `admin-create-member`·아이디 검사를 맞추면 된다. 사용자가 "이메일형 아이디는 쓰지 않음"을 확인하고 화면·함수에서 막으면 배포해도 된다. N2·N3은 낮음이라 미뤄도 된다.

(재확인(고침 1) 결론: 고친 뒤 배포 — 아래 7절이 이를 대신한다)

## 7. 재확인(고침 2) — 2026-10-21

> 대상: `fix-2-sql-instructions.md`·`fix-2-sql-report.md`의 고친 부분과, 메인 에이전트가 고친 화면 두 곳(`src/lib/member-import.ts`·`src/lib/privacy.ts`)만 봤다. 같은 규칙을 지켰다(코드 수정 없음, 실 DB·Supabase 접속 없음, 내려받기 없음). 스크립트 구문만 `node --check`로 확인했다.

| 볼 것 | 판정 | 근거 |
|---|---|---|
| ② 맨 앞 점검 — 이메일 모양 아이디 계정이 있으면 멈추는지 | **멈춘다.** | 점검은 첫 `do` 블록(`:212-228`) 안에 있어, 1-0(권한)이나 백필보다 먼저 `raise exception`이 나온다. 그래서 아무것도 바뀌지 않는다. 세는 대상: `auth.users` 이메일이 `@class1.local`이 아니면서, `provider`가 email이거나 `providers` 배열에 email이 있거나 `auth.identities`에 `provider='email'`이 있고, `member_verification` 줄이 없는 계정. 머리말 E)와 `test-queries.sql` 2-2)가 같은 셈을 역할별 개수만 보여 준다. |
| 다시 실행할 때 막히지 않는지 | **막히지 않는다.** | ② 뒤에 생기는 계정은 둘로 나뉜다. ① 스스로 가입한 실제 이메일 계정은 `handle_new_user`가 `member_verification('new')`를 만들어 점검에서 빠진다. ② 관리자가 만드는 계정은 함수·화면이 `@` 아이디를 받지 않아 늘 `@class1.local`이다. 다만 ② 되돌리기를 하면 인증 전 줄이 지워지므로, 그사이 스스로 가입한 계정이 있으면 다시 켤 때 멈춘다. 의도된 알림이다. |
| `auth.users`·`auth.identities` 읽기 문법 | **맞음**(실행은 못 함) | `raw_app_meta_data ->> 'provider'`, `jsonb_typeof(… -> 'providers') = 'array' and … ? 'email'`(plpgsql 안의 `?` 연산자는 문제없음), `auth.identities(user_id, provider)` 모두 맞다. 2-5의 `update … from public.member_directory d, auth.users u`도 맞다. SQL Editor(postgres)가 auth 스키마를 읽을 수 있다는 전제는 예전 `setup-owl-class.sql`과 같다. 확인 쿼리의 문자열 안 `''인증 전''`도 바르게 이스케이프돼 있다. |
| 2-5 조건 ↔ 끝 점검 6-10 | **같다.** | 6-10은 2-5의 WHERE를 그대로 옮긴 셈이다. 바꾼 뒤에는 `display_name = '선생님'`이라 0이 된다. 바꾸는 경우는 셋이다: 이름이 비었거나, `raw_user_meta_data`의 `full_name`·`name`(앞 50자, 앞뒤 공백 뺌)과 같거나, 예전 대체값인 이메일 앞부분(앞 50자)과 같을 때. [나중에]를 누른 뒤 스스로 고친 별명은 다시 실행해도 덮어쓰지 않는다(N3 해결). 남는 한계: 구글 이름이 가입 뒤 바뀌어 메타데이터와 지금 이름이 다르면 바꾸지 않는다(확인 창에서 별명을 정할 때 바뀜 — 보고서에 적혀 있음). |
| 예약어 두 목록 | **같다(15개).** | ① `privacy_nickname_error`와 `src/lib/privacy.ts`의 `RESERVED_NICKNAMES`가 같고 둘 다 `선생님`을 포함한다. 비교 방식도 같다: 서버는 `lower(v)`, 화면은 `.toLowerCase()`. |
| `admin-create-member` 아이디 규칙 | **맞음** | 이메일 갈래가 없어졌다. `@`는 `ID_RE`(`^[a-z0-9]([a-z0-9._-]*[a-z0-9])?$`)에서 기존 문구로 거부된다. 길이 검사가 먼저라 31자를 넘는 이메일은 길이 문구로 거부된다. `toEmail`은 늘 `{아이디}@class1.local`. 정규식과 길이 2~30이 화면 `member-import.ts`·스크립트와 같다. |
| `scripts/import-users.mjs` | **맞음** | `idError`가 341행에서 줄마다 불리고, `toEmail`은 늘 `@class1.local`이다. `node --check` 통과. |
| 화면 `member-import.ts` | **맞음** | `validateLoginId`에 이메일 갈래가 없다. 문구는 "영문·숫자와"로 함수의 "영문 소문자·숫자와"와 한 낱말 다르다. 화면이 먼저 거르므로 사용자에게 두 문구가 섞여 보이지는 않는다. |

**남은 것**
- N2(낮음, 그대로 둠): 이메일·비밀번호로 스스로 가입한 '인증 전' 계정은 [가입하지 않기]가 실패한다(확인 메일이 필요해 드묾).
- 맨 앞 점검이 멈추는 경우(머리말 E)·`test-queries` 2-2)가 0이 아님): **총괄이 실제 이메일 + 비밀번호로 로그인하는 계정**이면 총괄도 여기서 세어진다. ② 전에 사용자가 그 쿼리를 먼저 돌려 보게 배포 안내에 넣어 달라.
- 4절·6-4절의 확인하지 못한 것(실제 실행, SMTP 등)은 그대로다.

(재확인(고침 2) 결론: 배포해도 됨 — 아래 8절이 이를 대신한다)

## 8. 재확인(고침 3 — 이메일 로그인 총괄) — 2026-10-21

> 상황(메인 에이전트가 사용자 확인 쿼리로 확인한 사실): 총괄 계정은 다음과 같다.
> - `is_super_admin` true, `role='admin'`
> - 가입 방식·연결된 로그인 모두 `["email"]` — 실제 이메일 + 비밀번호
> - 부엉이반 담임(`class_teachers` 있음)
> - `member_verification` 줄 없음
>
> 진행 상태: ① · 화면 push · 함수 3개 · 코드·문의 이메일까지 끝났고, ②는 실행 전이다. 고침 3은 ② 맨 앞 점검(`:210-246`)에서 role admin을 세지 않고 알림만 내게 했다.
> 이 계정이 ②·③을 지나며 어떻게 되는지 끝까지 읽어서 따라갔다. 같은 규칙을 지켰다(코드 수정·실 DB·내려받기 없음).

### 8-1. 고친 점검
- **문법이 맞다.** `v_email_like`·`v_email_admin` 둘 다 `declare`에 있다. `coalesce((select p.role …), 'user') <> 'admin'` / `= 'admin'`으로 나눠 센다. 알림 문자열 안 `''선생님''`도 바르게 이스케이프돼 있다.
- **이 총괄은 이제 멈춤 대상이 아니다.** 알림 "실제 이메일로 로그인하는 교사(관리자) 계정 1개는 구글 관리자처럼 다룹니다…"만 나온다. role user(학생 등)인 이메일 모양 계정은 여전히 멈춘다.
- 머리말 E)와 `test-queries` 2-2)는 role별 줄을 그대로 보여 주고, 주석에 "admin 줄은 멈추지 않음"이라고 적혀 있다. 맞다.

### 8-2. ② 백필이 이 계정에 하는 일 — 그리고 끝 점검
| 단계 | 이 계정 | 결과 |
|---|---|---|
| 1-0 수정 권한 | 별명만 고칠 수 있다(사진 주소 불가) | 프로필 창은 이미 별명만 보낸다 |
| 2-1 회원 명단 이메일 | `@class1.local`이 아님 | **첫 글자 + `***`로 가린다**. 로그인할 때마다 `sync`도 같은 값을 쓴다 |
| 2-2 `member_verification` | 탈퇴 아님 · role admin · 아이디 계정 아님 · 가입 방식 있음 | **줄을 만든다**: `origin='existing'`, `verified_at`·`ack_at` null |
| 2-3 | role user만 대상 | 해당 없음 |
| 2-4 사진 주소 | 아이디 계정 아님 | `avatar_url` → null |
| 2-5 이름 | role admin · `ack_at` 없음 · 지금 이름이 비었거나 `raw_user_meta_data`의 `full_name`·`name` 또는 이메일 앞부분(앞 50자)과 같을 때만 | 해당하면 **`선생님`**. 스스로 고친 별명이면 그대로 둔다 |
| 2-6 감사 기록 처리자 이름 | 이 총괄이 만든 학생들의 `member_create_log.actor_name` | 지금 표시 이름(`선생님` 또는 별명)으로 맞춘다 |
| 2-7 감사 기록 이메일 | 이 총괄이 대상인 줄이 있으면 | 가린다(보통 없음) |

**끝 점검(6절)은 모두 통과한다.**
- 6-9의 명단 이메일 점검: 2-1 뒤 0이 된다.
- 6-9의 "인증 전 이름" 점검: role user만 보므로 이 계정과 상관없다.
- 6-10의 사진 주소: 2-4 뒤 0이 된다.
- 6-10의 이름: 2-5와 같은 조건이라 바꾼 뒤 0이 된다. 바꾸지 않은 경우는 처음부터 조건 밖이다.
- 6-10의 처리자 이름: 2-6이 2-5 뒤에 돌아 같은 값이 된다.
- 6-10의 권한 점검과 6-1~6-8은 계정과 상관없다.

### 8-3. 권한 — 이 총괄에게 막히는 것이 없다
- **인증 전 판정**: `is_pending_google()`은 `verified_at is null **and role = 'user'**`일 때만 참이다. 이 계정은 role admin이라 **거짓**이다. 그래서 다음이 모두 영향 없음이다:
  - `can_browse()` — 참
  - 제한 정책 19개
  - `record_post_read`·`get_or_create_feedback_thread`의 인증 전 거부
- **권한 범위**: `teacher_scope`는 ①이 열을 더할 때의 기본값 `'full'`이다. ②가 이를 바꾸는 곳은 `admin_set_role`(지정·해제)뿐이다. 그래서 `is_full_admin()`은 참이고, 학습게임 관리·블로그·칭찬 문구도 그대로 할 수 있다.
- **이름·명단 보기(③ 뒤 포함)**
  - `can_see_member_name`: 본인, 선생님, 부엉이반 학생(`teaches_student`), 학급 없는 계정(총괄)을 온전히 본다.
  - `can_see_member_identity`: 부엉이반 학생, 선생님(자기 자신 포함), 학급 없는 계정을 온전히 본다. 다른 반 학생은 가린 줄로 받는다(지금은 다른 반이 없음).
- **관리 권한**: `can_manage_member`·`is_super_admin()`은 바뀌지 않는다. 담임 권한(`my_class_ids`·`teaches_student`)도 `class_teachers` 기준이라 그대로다.
- **인증·탈퇴**: `verify_google_teacher`는 role admin이라 `not_applicable`이다(화면도 코드 창을 띄우지 않음). `member-self-delete`는 총괄이라 403이다(메뉴에도 '회원 탈퇴' 없음 — 총괄 제외).

### 8-4. 화면 — 창이 끝없이 다시 뜨거나 갇히지 않는다
1. `my_member_gate()`는 줄이 있고 role admin이며 `ack_at`이 없으므로 `{ state: 'need_ack', origin: 'existing', first_time: true, policy_version: 1 }`을 돌려준다.
2. `use-session`은 가입 방식과 상관없이 모든 로그인 계정의 창 상태를 읽는다. 그래서 `privacy-gate.tsx`의 `variantOf`가 `ack-first`가 되고, **3-1 창**이 뜬다(별명 칸 + 체크, 코드 칸 없음, [나중에] 있음). [나중에]는 이 탭에서만 닫히고, 새로 고치면 다시 뜬다. 막히지는 않는다(서버는 이 계정을 막지 않음).
3. [확인했어요]를 누르면 `acknowledgePrivacy(별명)`가 `acknowledge_privacy(p_nickname, 1)`을 부른다.
   - 줄이 있으므로 `not_applicable`이 아니다.
   - role admin이므로 `need_code`가 아니다.
   - 판 번호가 같다(`POLICY_VERSION = 1` = `site_settings.privacy_version` 기본 1).
   - `ack_at`이 없으므로 별명을 검사하고 저장한다. 사진 주소를 비우고 `ack_at`·`policy_version`을 기록한 뒤 `{ok:true}`를 돌려준다.
4. 화면은 `onCompleted` 뒤 `refreshGate`를 부른다. 이번에는 `ack_at`이 있고 판 번호가 같아 `ok`가 되므로 **다시 뜨지 않는다.**
5. 별명 예약어(15개)에 `관리자`·`총괄`·`총괄 관리자`·`운영자`·`psc`·`admin`·`선생님` 등이 있어 이런 이름은 쓸 수 없다. 사용자에게 미리 알려 두면 좋다(예: "부엉이반 선생님"은 정확히 같은 말이 아니라 쓸 수 있다).

### 8-5. 낮음 · 알려 둘 것
| # | 무엇 | 제안 |
|---|---|---|
| E1 | 3-1 창 글은 "구글 계정" 기준이다: "받는 것: … 구글 로그인 정보", "탈퇴는 [회원 탈퇴]에서". 이메일·비밀번호로 로그인하는 총괄에게는 사실과 조금 다르다(총괄은 탈퇴 메뉴도 없음). 처리방침 제2조도 "실제 이메일로 로그인하는 운영자 계정"을 따로 적지 않는다. | 기능에는 문제없다. 원문 글이 사용자 승인 문장이므로, 고칠지는 사용자에게 묻는다. 예: 3-1에 "(이메일로 로그인하는 선생님은 '구글' 대신 '로그인 이메일')", 제2조 나에 "운영자(총괄) 계정은 실제 이메일로 로그인할 수 있어요 — 회원 명단에는 첫 글자만". |
| E2 | ② 직후부터 총괄이 확인 창에서 별명을 정할 때까지, 이름이 `선생님`인 경우(2-5 조건에 맞을 때) 게시판 주인 이름·글쓴이가 `선생님`으로 보인다. | 배포 순서 9번("총괄이 먼저 로그인해 3-1 창")대로 ③ 직후 바로 확인하면 된다. |
| E3 | 프로필 수정 창은 이메일·비밀번호 계정이면 본인 화면에 **이메일 전체**를 보인다(`accountLabel` — 구글만 "구글 계정으로 로그인 중이에요."). 본인 정보라 새는 것은 아니지만 공용 PC 화면에는 보인다(spec 4.4가 구글에 한 것과 같은 우려). | 원하면 화면에서 "@class1.local이 아니면 첫 글자 + `***`"로. 메인 에이전트 판단. |
| E4 | `docs/classes/setup-owl-class.sql` 39행은 그때(09-26) 학급이 없던 role user 계정을 **모두** 부엉이반에 넣었다. 그때 있던 구글 회원이 있었다면 지금 "학급이 있는 구글 계정"이다. ②는 이런 계정을 인증 전으로 묶지 않고 **이름(구글 실명일 수 있음)을 그대로 둔다**(사진 주소만 비움). | ② 실행 때 "⚠ 학급이 있는 구글 등 계정 %개" 알림이 나오는지 보고, 나오면 그 수를 알려 달라고 사용자에게 부탁한다(머리말 A)로 미리 셀 수 있음). 있으면 이름을 중립 값으로 바꿀지·완전 삭제할지는 따로 정한다. |

### 8-6. 결론
이 총괄 계정은 ②를 멈추게 하지 않는다. 바뀌는 것은 넷이다: 회원 명단 이메일이 가려지고, 확인 창이 한 번 뜨고, 별명을 정하기 전 이름이 `선생님`일 수 있고, 사진 주소가 지워진다. 총괄 권한·부엉이반 담임 권한·이름과 명단 보기는 ②·③ 뒤에도 그대로다. 확인 창은 별명을 정하면 다시 뜨지 않는다. E1~E4는 글·화면 다듬기와 확인 부탁이라 배포를 막지 않는다.

**배포해도 됨**
