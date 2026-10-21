# 묶음 2 보고 — Edge Function (구현 담당 B, 2026-10-20)

기준: `build-common.md` → `build-2-functions-instructions.md` → `spec.md`(개정 1·2, 1.1 표, 3.4·4.2·4.7·4.8·5절) → `privacy-policy.md`(4-1·8-1·8-4~8-6).
git commit/push 안 함. 실제 Supabase·Gemini를 부르지 않음(시험은 127.0.0.1의 가짜 서버만). 아무것도 내려받거나 설치하지 않음.

## 만든 것 · 고친 파일

| 파일 | 내용 |
|---|---|
| `supabase/functions/member-self-delete/index.ts` (신규) | `{ mode: 'cancel' \| 'withdraw' }`. JWT의 본인만 → 프로필·총괄(403) → 구글 전용(명단 + 로그인 계정 이중 확인) → 모드 조건(cancel: 인증 전·role user·학급 없음 / withdraw: 인증함 또는 role admin, 맡은 학급에 학생이 있으면 `blocked`, 마지막 관리자 불가) → `self_purge_member` 존재 확인 — **여기까지 아무것도 지우지 않음** → 게임 파일 → `auth.admin.deleteUser`(이미 없으면 통과) → `self_purge_member(p_target, p_mode)` |
| `supabase/functions/member-self-delete/README.md` (신규) | 조건·순서·요청/응답 표·배포·확인 절차 |
| `supabase/functions/admin-clear-students/index.ts` (신규) | `{ classId, confirmName }` 학급 정리(20명씩, 탈퇴한 학생 포함, 멱등) / `{ userId, confirmName }` 학생 한 명 '기록까지 삭제'. 학생마다 게임 파일 → `deleteUser`(이미 없으면 통과) → `admin_purge_class_member`. 1명 이상 지운 호출마다 `admin_finish_class_cleanup(학급, 호출자, 이번에 지운 수)` |
| `supabase/functions/admin-clear-students/README.md` (신규) | 같은 형식 |
| `supabase/functions/admin-create-member/index.ts` (수정) | `guardianConsent`: 학생 줄이 하나라도 있고 `=== true`가 아니면 **계정을 하나도 만들기 전에** 400 "보호자 동의서를 받았다는 표시가 필요해요."(`code: guardian_consent_required`). 학생 계정마다 5-인자 `admin_log_member_create(…, p_guardian => true)`, 교사는 `p_guardian: null`. 나머지 동작 그대로 |
| `supabase/functions/admin-create-member/README.md` (수정) | 보호자 동의 절, 요청 예, 메시지 표 3줄 |
| `supabase/config.toml` | `[functions.member-self-delete]`·`[functions.admin-clear-students]` `verify_jwt = true` |

CORS(GitHub Pages·localhost + Secret `EXTRA_ALLOWED_ORIGINS`)·JWT 확인(`auth.getUser(jwt)`)·`{ error, code? }` 오류 모양·`console.error("<함수>: <단계> 실패", 문구)` 로그·게임 파일 지우기(`listFolderFiles`/`removeGameFiles`)·"함수 없음" 확인(null 인자 → `missing arguments`일 때만 계속)은 `admin-purge-oauth-member`·`admin-delete-member`에서 그대로 복사했다.

## 요청 · 응답 (화면 묶음 3·4가 쓸 것)

**member-self-delete**
- 성공 200 `{ ok: true, mode, alreadyDeleted, removedFiles }` → 화면은 로컬 로그아웃 + 4-1 안내.
- 기록 단계 실패 200 `{ ok: true, …, warning }` — 계정은 이미 지워져 본인이 다시 부를 수 없음. warning이 운영자에게 알리라고 안내(총괄이 '완전 삭제'로 정리 가능).
- **막힘 200 `{ ok: false, code: "blocked", blocked: ["학급 이름"…], error: "<8-6 막혔을 때 원문>" }`** — spec 5절 `{ ok, blocked? }` 모양을 따라 200으로 둠. 화면은 `data.ok === false && data.code === "blocked"`를 먼저 본다.
- 400 `code`: `not_pending`·`not_verified`·`id_login`·`unknown_login`·`last_admin` / 403 `super_admin`(8-6 원문 "총괄 선생님은 이 화면에서 탈퇴할 수 없어요.") / 404 `self_not_found` / 401 / 500(게임 파일·계정 삭제 실패 — 계정 그대로).

**admin-clear-students** — 두 모드 모두 200 `{ ok: true, deleted, failed, remaining, warning? }`
- 학급 정리: 화면은 `remaining = 0`까지 다시 부르고, 한 번에 `deleted = 0`이면 멈춰 8-4 "일부 실패"를 보인다. `failed`인 학생은 그대로 남아 다시 누르면 다시 시도. `warning`은 화면이 `failed`만으로 알 수 없는 것만(구글·깃허브 계정이 섞임, 학급 정리 기록 실패).
- 학생 한 명: 성공 `{deleted:1, failed:0, remaining:0}`, 기록 단계만 실패 `{deleted:0, failed:1, remaining:1, warning}`(다시 하면 기록만).
- 400 `confirm_mismatch`(이름 확인 — 앞뒤 공백 뺀 뒤 같아야 함. 학생 이름 = 화면 `memberRealName`과 같은 규칙: 표시 이름 → 없으면 로그인 아이디 → "이름 없음") / 403(담임·총괄 아님) / 404 `class_not_found`·`target_not_found` / 400 SQL ① 전.

**admin-create-member** — 요청에 `guardianConsent: true`(학생 줄이 있을 때). 400 `guardian_consent_required`. 학생 계정의 감사 로그가 실패하면 그 줄 `warning`에 보호자 동의 안내.

## spec·지침과 다르게 한 곳

1. **게임 파일 삭제 실패 때 "다음 단계로 + warning" 대신 멈추거나 그 학생을 건너뜀**(지침 "부분 실패를 견딘다"와 다름). 이유: 로그인 계정을 먼저 지우면 남은 파일을 찾아 지울 방법이 없다(본인은 다시 부를 수 없고, 고아 파일을 보여 주는 관리 도구도 없음) → 처리방침의 "올린 게임 파일도 지운다"가 조용히 깨진다. 대신 멱등을 지켰다: member-self-delete·학생 한 명 = 아무것도 안 지운 채 500(다시 누르면 됨), 학급 정리 = 그 학생만 `failed`로 남기고 나머지 계속(8-4 "다시 [학급 정리하기]"와 맞음). `admin-purge-oauth-member`도 같은 방식이다. "이미 지워진 계정은 다음 단계로"는 지침대로.
2. **학급 정리 기록을 "끝나면 한 줄" 대신 호출마다 부름** — 묶음 1의 `admin_finish_class_cleanup`이 같은 학급·같은 선생님의 1시간 안 기록에 **더하도록** 만들어져 있어(SQL 10-4) 결과는 "한 번의 정리 = 한 줄"로 같다. 화면이 누계를 보낼 필요가 없다(처음 만들 때 넣었던 선택 필드 `done`은 대조 뒤 뺐다).
3. **회원 명단으로 가입 방식을 알 수 없는 학급 학생**(명단 줄 없음 등): 묶음 1의 `admin_purge_class_member`가 이런 학생을 지우므로(학급 정리가 끝나지 않는 일을 막으려고) 함수도 로그인 계정으로 한 번 더 보고 구글·깃허브 전용이 아니면 지운다(로그인 계정이 없는 탈퇴 학생 포함). 구글·깃허브 전용이면 건너뛴다.
4. 응답에 spec보다 더 넣은 것(추가만): `code`, member-self-delete의 `mode`·`alreadyDeleted`·`removedFiles`, blocked 응답의 `error` 문구, admin-clear-students의 `warning`.
5. `admin-create-member`: 학생 줄이 있으면 계정을 만들기 전에 5-인자 감사 로그 함수가 있는지 확인(null 인자 호출 — 행이 생기지 않음). **없으면(SQL ① 전) 500으로 아무 계정도 만들지 않음** — 동의 표시를 기록할 수 없는 채 학생을 만들지 않기 위해(결정 5). 교사 줄만이면 확인하지 않음(감사 로그만 못 남기고 warning — 예전과 같음). 이 함수의 로그는 아이디 대신 **줄 번호**만 남기도록 바꿨다(공통 원칙 "로그에 id 없음"). 예전 warning의 SQL 이름을 ①로 바꿨다.
6. 모든 로그·응답에 넣는 오류 문구는 `scrub()`으로 uuid·이메일 모양을 `<id>`·`<email>`로 가린다(시험에서 SQL 오류 문구 안의 id가 가려지는 것 확인).

## 묶음 1(SQL ①)과 대조 — `20261020000000_privacy_a_schema.sql` (작업 중 생김, 읽어서 대조)

| 부르는 것 | SQL ① | 결과 |
|---|---|---|
| `self_purge_member(p_target, p_mode)` | `(uuid, text) returns jsonb`, null → `missing arguments`, 성공 `{ok:true,…}`, 거부는 예외(`blocked` + detail, `not a pending account`, `last admin` …) | 일치. 함수가 같은 조건을 **계정을 지우기 전에** 먼저 확인(SQL의 `blocked` 예외는 계정 삭제 뒤라서). 조건(cancel 4개, withdraw: 인증 또는 admin·학생 있는 학급·마지막 관리자·구글 전용·총괄 불가) 한 줄씩 대조함 |
| `admin_purge_class_member(p_target, p_actor)` | `returns void`, null → `missing arguments`, 담임·총괄 확인, 구글 전용 거부, auth 계정이 남아 있으면 거부 | 일치(위 3번 규칙 맞춤) |
| `admin_finish_class_cleanup(p_class_id, p_actor, p_count)` | 1시간 안 같은 학급·선생님이면 더함, `p_count <= 0`이면 기록 안 함 | 일치(위 2번) |
| `admin_log_member_create(…, p_guardian boolean default null)` | 옛 4-인자 drop, 학생+true면 `guardian_consent`·`guardian_consent_at/by` | 일치. 기본값 null이라 **지금 배포된 옛 함수 코드도 ① 뒤 그대로 동작**(SQL 주석) |
| 표 `member_verification(user_id, verified_at)` 읽기 | `grant select … to service_role` | 일치 |

묶음 1 쪽 참고(내 범위 밖): `purge_member_records`가 다른 학생 제출물이 달린 과제는 지우지 않음(spec 4.7-1과 다름 — 묶음 1 보고서에 있을 것).

## 원문(`privacy-policy.md`)에 없던 새 문장 — 전부

원문 그대로 쓴 것: "보호자 동의서를 받았다는 표시가 필요해요."(8-1), "총괄 선생님은 이 화면에서 탈퇴할 수 없어요."(8-6), "아직 학생이 있는 학급이 있어요: {학급 이름들}. 먼저 [학급 정리]로 학생 계정과 기록을 지운 뒤 탈퇴해 주세요."(8-6, 이름은 ", "로 이음).
기존 함수에서 그대로 복사한 것(새 문장 아님): "지원하지 않는 요청입니다." / "서버 설정 오류입니다. 관리자에게 문의하세요." / "로그인이 필요합니다." / "로그인이 만료되었습니다. 다시 로그인해 주세요." / "관리자 권한을 확인하지 못했습니다." / "관리자만 사용할 수 있습니다." / "학급 기능용 DB 설정이 아직 적용되지 않았습니다. Supabase SQL Editor에서 20260927000000_classes_schema.sql을 먼저 실행해 주세요." / "대상 계정을 찾을 수 없습니다. 이미 지워졌을 수 있습니다." / "담임 여부를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요." / "대상 계정 정보를 확인하지 못했습니다." / "자기 자신의 계정은 지울 수 없습니다."(동사만 바꿈).

**member-self-delete (구글 회원이 보는 글 — 해요체)**
- 계정 삭제 기능용 DB 설정이 아직 적용되지 않았어요. 운영자가 Supabase SQL Editor에서 20261020000000_privacy_a_schema.sql을 먼저 실행해야 해요. (아무것도 지우지 않았어요.)
- 아이디로 로그인하는 계정은 여기서 지울 수 없어요. 담임 선생님이나 운영자에게 알려 주세요.
- 가입 방식을 확인할 수 없는 계정이라 여기서 지울 수 없어요. 운영자에게 알려 주세요.
- 이 계정은 '가입하지 않기'를 할 수 없어요. 이미 교사 인증을 마쳤다면 [내 정보]의 [회원 탈퇴]를 이용해 주세요.
- 교사 인증을 마치지 않은 계정은 [회원 탈퇴] 대신 [가입하지 않기]로 지울 수 있어요.
- 마지막 관리자 계정은 탈퇴할 수 없어요. 운영자에게 알려 주세요.
- 요청 형식이 올바르지 않아요. 화면을 새로 고친 뒤 다시 해 주세요.
- 계정 정보를 확인하지 못했어요. 잠시 뒤에 다시 해 주세요.
- 계정 정보를 찾을 수 없어요. 이미 지워졌을 수 있어요. 로그아웃한 뒤 다시 확인해 주세요.
- 가입 방식을 확인하지 못했어요. 잠시 뒤에 다시 해 주세요.
- 계정 상태를 확인하지 못했어요. 잠시 뒤에 다시 해 주세요.
- 맡은 학급을 확인하지 못했어요. 잠시 뒤에 다시 해 주세요.
- 맡은 학급의 학생 수를 확인하지 못했어요. 잠시 뒤에 다시 해 주세요.
- 이름 없는 학급 (막힌 학급의 이름을 못 읽었을 때 이름 자리)
- DB 설정을 확인하지 못해 멈췄어요. 아무것도 지우지 않았어요. 잠시 뒤에 다시 해 주세요.
- 올린 게임 파일을 지우지 못해 멈췄어요. 계정과 기록은 그대로예요. 잠시 뒤에 다시 해 주세요. (+ 일부 지웠으면 " (게임 파일 {n}개는 이미 지웠어요.)")
- 계정을 지우지 못했어요. [올린 게임 파일은 이미 지웠고, ]계정과 나머지 기록은 그대로예요. 잠시 뒤에 다시 해 주세요.
- 로그인 계정은 지웠지만 남은 기록을 아직 다 지우지 못했어요. 개인정보 처리방침의 문의 이메일로 운영자에게 알려 주시면 남은 기록을 지워 드려요.

**admin-clear-students (교사가 보는 글 — 기존 관리 함수처럼 합니다체)**
- 학급 정리 기능용 DB 설정이 아직 적용되지 않았습니다. Supabase SQL Editor에서 20261020000000_privacy_a_schema.sql을 먼저 실행해 주세요. (아무것도 지우지 않았습니다.)
- 이 학급의 담임 선생님이나 총괄 관리자만 학급 정리를 할 수 있습니다.
- 이 학생의 담임 선생님이나 총괄 관리자만 기록까지 삭제할 수 있습니다.
- 학급 이름이 맞지 않습니다. 학급 이름을 그대로 입력해 주세요.
- 이름이 맞지 않습니다. 학생 이름을 그대로 입력해 주세요.
- 교사(관리자) 계정은 이 메뉴로 지울 수 없습니다.
- 구글·깃허브로 로그인하는 계정은 '기록까지 삭제' 대신 총괄 관리자의 '완전 삭제'를 이용하세요.
- 요청 형식이 올바르지 않습니다. 화면을 새로고침한 뒤 다시 시도해 주세요.
- DB 설정을 확인하지 못해 멈췄습니다. 아무것도 지우지 않았습니다. 잠시 후 다시 시도해 주세요.
- 지울 학생 정보(userId)가 올바르지 않습니다.
- 대상 계정의 가입 방식을 확인하지 못했습니다.
- 대상 로그인 계정을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.
- 로그인 계정과 올린 게임 파일은 지웠지만 기록을 아직 지우지 못했습니다. 같은 학생에게 '기록까지 삭제'를 한 번 더 실행하면 남은 기록만 다시 지웁니다.
- 올린 게임 파일을 지우지 못해 멈췄습니다. 학생 계정과 기록은 그대로입니다. 잠시 후 다시 시도해 주세요.
- 로그인 계정을 지우지 못해 멈췄습니다. 올린 게임 파일은 지웠고, 학생 계정과 나머지 기록은 그대로입니다. 잠시 후 다시 시도해 주세요.
- 학급 정보(classId)가 올바르지 않습니다. 화면을 새로고침한 뒤 다시 시도해 주세요.
- 학급 정보를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.
- 학급을 찾을 수 없습니다.
- 학급 학생 목록을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.
- 학생들의 가입 방식을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.
- 구글·깃허브로 로그인하는 계정 {n}개는 학급 정리로 지울 수 없습니다. 총괄 관리자가 회원 관리의 '완전 삭제'로 지워 주세요.
- 학생 계정과 기록은 지웠지만 '학급 정리 기록'(지운 인원수)을 남기지 못했습니다.

**admin-create-member**
- 보호자 동의 기록용 DB 설정이 아직 적용되지 않았습니다. Supabase SQL Editor에서 20261020000000_privacy_a_schema.sql을 먼저 실행해 주세요. (계정을 만들지 않았습니다.)
- 계정은 만들었지만 보호자 동의 표시를 기록하지 못했습니다. 회원 목록에서 [동의서 받음으로 기록]을 눌러 주세요.
- (바꿈) 계정은 만들었지만 '누가 언제 만들었는지' 기록은 남지 않았습니다. Supabase SQL Editor에서 20261020000000_privacy_a_schema.sql을 실행하면 다음부터 기록됩니다. (전: …20260923030000_member_create_log.sql…)

## 시험 결과

- **Deno 검사는 못 함**(이 컴퓨터에 Deno 없음). 대신:
  - 타입 검사: 저장소 `node_modules`의 TypeScript 5.9.3 + `@supabase/supabase-js` 2.116.0 타입, Deno 흉내 선언 파일, `npm:@supabase/supabase-js@2` → 로컬 패키지로 경로 연결(스크래치 tsconfig). 새 함수 2개 + 고친 함수 + 기존 2개 → **오류 0**. 일부러 틀린 메서드 이름을 넣으면 잡히는 것도 확인.
  - 실행 시험: 같은 코드를 TypeScript로 변환해 Node 24에서 실행, supabase-js는 127.0.0.1의 **가짜 GoTrue·PostgREST·Storage 서버**로만 요청(실제 Supabase 주소 없음).
    - member-self-delete **28/28 통과**: cancel 성공·순서(목록 → 파일 삭제 → 다시 확인 → 계정 삭제 → RPC)·RPC 인자, 인증 마친 계정의 cancel 거부, withdraw 막힘(문구가 8-6 원문과 같음, 아무것도 안 지움), withdraw 성공, 총괄 403, 아이디 계정 400, SQL ① 전(함수 없음·표 없음) 400 + 아무것도 안 지움, RPC 실패 warning, 토큰 없음/가짜 401, 잘못된 mode, 게임 파일 실패 → 500 + 계정 그대로, CORS(Vercel 허용·다른 주소 거부·GET 405), 마지막 관리자, 인증 전 계정의 withdraw, 이미 지운 계정 401.
    - admin-clear-students **28/28 통과**: 25명(탈퇴 1명 포함) 20 + 5, 기록 한 줄 25명(호출 2번이 한 줄로 더해짐), 빈 학급 다시 눌러도 기록 그대로, 이름 틀림, 다른 반 담임 403, 총괄, 구글 계정 섞임(건너뜀 + warning), 학생 한 명(공백 있는 이름·표시 이름 없으면 로그인 아이디·틀린 이름·다른 반·교사·없는 학생·자기 자신·총괄), 기록 단계 실패 → 다시 하면 기록만, 두 모드 동시·없음 400, SQL ① 전 400 + 아무것도 안 지움, 한 학생 게임 파일 실패 → 그 학생만 남음, 명단 줄 없는 학생(탈퇴 → 지움 / 구글 → 건너뜀).
    - admin-create-member **12/12 통과**: 학생 줄 + 동의 없음/문자열 "true" → 400 + 계정 0, 학생+교사 섞임 → 400, 동의 있음 → 확인 호출이 먼저·감사 로그 `p_guardian: true`·학급 배정, 교사 줄만 → 동의 필요 없음·`p_guardian: null`·확인 호출 없음, 5-인자 함수 없음 → 500 + 계정 0(교사 줄만이면 만들고 ① 안내 warning), 감사 로그 실패 → 줄마다 보호자 동의 warning.
    - 세 시험 모두 **로그에 uuid·이메일·로그인 아이디가 없음**을 검사(SQL 오류 문구 안의 id는 `<id>`로 가려짐).
  - 시험 도구(가짜 서버·변환기·시험 3개·스크래치 tsconfig)는 스크래치 `privacy-b2/`에서만 썼고 끝난 뒤 지웠다(CLAUDE.md 규칙). 띄운 서버는 시험마다 닫힘. 다시 돌려야 하면 이 담당에게 부탁하면 다시 만든다.

## 확인하지 못한 것

- 실제 Deno·Supabase Edge Runtime에서의 실행(배포 때 받는 supabase-js 2.x 최신판의 타입·동작이 2.116.0과 조금 다를 수 있음), 실제 게이트웨이의 Verify JWT.
- 가짜 서버가 흉내 낸 실제 응답 모양: GoTrue `user_not_found`(404)·PostgREST `PGRST202`·`count=exact`의 Content-Range·Storage list/remove. 기존 함수와 같은 판별 코드를 써서 맞을 것으로 보지만 실제로 보지 못했다.
- SQL ①의 함수 본문은 **읽어서** 대조만 했다(실 DB 없음). 가짜 서버는 SQL을 흉내 내지 않는다.
- 학급 정리 20명 한 번에 걸리는 실제 시간(시간 제한 안인지).
- 실제 계정 흐름(구글 [가입하지 않기], 회원 탈퇴, 학급 정리)은 사용자 확인 몫 — 각 README "배포 후 확인".

## 다른 묶음 · 메인 에이전트에게 넘길 것

- **묶음 3(공개 화면)**: `member-self-delete`의 막힘은 **200 `{ ok:false, code:"blocked", blocked, error }`** — `data`를 먼저 본다. 다른 거부는 200이 아니고 본문 `error`(+`code`). 성공 뒤 로컬 로그아웃. 계정을 지운 뒤에는 같은 토큰으로 다시 부르면 401이다.
- **묶음 4(관리자 화면)**: `admin-clear-students`는 `remaining = 0`까지 반복, 한 번에 `deleted = 0`이면 멈추고 8-4 "일부 실패". `done` 같은 누계 필드는 **보내지 않아도 된다**. `warning`이 있으면 함께 보인다. 회원 추가는 학생 줄이 있을 때 `guardianConsent: true`, 400 `guardian_consent_required`, 줄마다 `warning`.
- **배포 사이 주의(사용자 안내에 넣을 것)**: `admin-create-member`를 배포한 뒤 새 화면을 push하기 전까지는 예전 화면이 `guardianConsent`를 보내지 않아 **학생 계정 만들기가 400으로 거부된다**(의도). 함수 배포와 화면 push를 이어서 한다.
- `CLAUDE.md`의 함수 목록 5개 → 7개(`member-self-delete`, `admin-clear-students`)는 메인 에이전트 몫(spec 5절).

## 사용자가 배포할 명령 (자기 Mac 터미널 — SQL ① 실행·확인 뒤, 화면 push 전)

```bash
npx supabase functions deploy member-self-delete
npx supabase functions deploy admin-clear-students
npx supabase functions deploy admin-create-member
```

(`--no-verify-jwt`를 붙이지 않는다. "Access token not provided"가 나오면 `npx supabase login`부터.)
