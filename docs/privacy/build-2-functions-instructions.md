# 묶음 2 지침 — Edge Function (구현 담당 B)

먼저 `docs/privacy/build-common.md`를 읽는다.

## 만들·고칠 파일(이것만)
- 신규 `supabase/functions/member-self-delete/index.ts` + `README.md` — spec 5절·3.4·4.7-2(`{ mode: 'cancel' | 'withdraw' }`: 호출자 JWT 확인 → 서비스 롤로 조건 재확인 → 게임 파일 폴더 삭제 → `auth.admin.deleteUser` → SQL `self_purge_member`).
- 신규 `supabase/functions/admin-clear-students/index.ts` + `README.md` — spec 4.7-3(`{ classId, confirmName }` 학급 정리 20명씩·멱등 / `{ userId, confirmName }` 학생 한 명 기록까지 삭제).
- 수정 `supabase/functions/admin-create-member/index.ts`(+ 그 README) — spec 4.8(`guardianConsent`: 학생 줄이 있으면 필수, 없으면 하나도 만들기 전에 400 "보호자 동의서를 받았다는 표시가 필요해요." / 학생 계정마다 5-인자 `admin_log_member_create(…, p_guardian => true)`). 나머지 동작은 그대로.
- `supabase/config.toml` — 새 함수 두 개 `verify_jwt = true`.
- 보고서 `docs/privacy/build-2-report.md`.

## 반드시
- 기존 함수(`admin-purge-oauth-member`·`admin-create-member`·`admin-delete-member`)의 **CORS(GitHub Pages·localhost + Secret `EXTRA_ALLOWED_ORIGINS`)·JWT 확인·오류 응답 모양·로그 방식**을 그대로 따른다(복사해서 맞춤). `--no-verify-jwt`를 전제하지 않는다.
- 호출할 SQL 함수 이름·인자는 spec 4.2 이름표 그대로(묶음 1이 만든다 — 같은 작업 트리의 `supabase/migrations/20261020000000_privacy_a_schema.sql`이 생기면 대조한다. 아직 없으면 spec 기준으로 쓰고 보고서에 "묶음 1과 대조 필요"로 적는다).
- 서비스 롤 키는 `Deno.env`로만, 응답·로그에 넣지 않는다. 로그에 이메일·이름·사용자 id를 남기지 않는다.
- 부분 실패를 견딘다: 게임 파일 삭제 실패·이미 지워진 계정은 다음 단계로(멱등), 응답에 `warning`.
- 이 컴퓨터에는 Deno가 없다 — 타입 검사를 돌릴 수 없으니 **기존 함수와 같은 import·API 모양**만 쓰고, 코드를 끝까지 다시 읽어 확인한다. 보고서에 "Deno 검사 못 함"을 적는다.
- 사용자가 배포할 명령(`npx supabase functions deploy <이름>` — 세 개)을 보고서 끝에 적는다.
