# member-self-delete (Edge Function)

**구글로 로그인한 회원이 자기 계정을 스스로 지울 때** 사이트 화면이 부르는 함수입니다(계정 + 기록 모두, 되돌릴 수 없음).
설계: `docs/privacy/spec.md` 3.4 · 4.7-2 · 5절(머리말 개정 1·2와 1.1 결정표가 본문보다 우선). 화면 글은 `docs/privacy/privacy-policy.md` 4-1 · 8-6.

| 모드 | 화면 | 누가 |
|---|---|---|
| `cancel` | 확인 창의 **[가입하지 않기]**(새 가입) / **[가입하지 않기(계정 삭제)]**(기존 회원) | 교사 인증 전 구글 계정(새 가입·기존 회원 모두 — 결정 7, 질문 5) |
| `withdraw` | **[내 정보] → [회원 탈퇴]** | 인증을 마친 구글 선생님, 총괄이 올린 구글 관리자(총괄 제외 — 결정 11) |

> **되돌릴 수 없습니다.** Supabase 무료 요금제라 백업도 없습니다(spec R19). 같은 구글 계정으로 다시 오면 **새 계정**으로 시작합니다.

## 누가 · 언제 되나 (DB 함수 `self_purge_member`도 같은 조건을 다시 확인)

- **본인만**: 대상은 언제나 로그인한 그 계정입니다. 요청 본문으로 다른 계정을 고를 수 없습니다.
- **구글(OAuth) 전용 계정만**: 회원 명단(`member_directory.provider/providers`)과 로그인 계정(identities·app_metadata)으로 두 번 확인 — 아이디 로그인이 있으면 400.
- **총괄은 불가**(403 "총괄 선생님은 이 화면에서 탈퇴할 수 없어요.").
- `cancel`: `member_verification` 행이 있고, 인증 안 함(`verified_at` 비어 있음), `role = 'user'`, 학급 없음. (`origin`은 보지 않습니다.)
- `withdraw`: 인증을 마쳤거나(`verified_at`) `role = 'admin'`. 그리고
  - **담임으로 맡은 학급(함께 맡은 학급 포함) 어디에든 학생**(`role = 'user'`, 탈퇴한 학생 포함)이 남아 있으면 **막습니다** → 200 `{ ok: false, code: "blocked", blocked: [학급 이름…] }`. 먼저 [학급 정리]를 합니다.
  - 마지막 관리자(`role = 'admin'`이 하나뿐)는 탈퇴할 수 없습니다.
  - 혼자 맡은 빈 학급은 학급째 지워지고(그 학급의 과제 포함), 함께 맡은 학급은 담임 연결만 빠집니다 — DB 함수가 합니다.

## 순서

1. 로그인 확인 → 2. 본인 프로필·총괄 확인 → 3. 구글 전용 확인 → 4. 모드 조건(withdraw: 학급 학생·마지막 관리자) →
   5. 새 SQL 확인(`self_purge_member`가 있는지) — **여기까지는 아무것도 지우지 않습니다.**
6. Storage `game-uploads`의 `{회원 id}/` 폴더(올린 게임 파일)를 지우고 비었는지 다시 확인합니다. **실패하면 여기서 멈춥니다**(계정·기록 그대로 — 잠시 뒤 다시 누르면 됩니다).
7. 로그인 계정(`auth.users`)을 **하드 삭제**합니다(이미 없으면 건너뜀).
8. DB 함수 `self_purge_member(p_target, p_mode)`(서비스 롤 전용)가 남은 기록·글·프로필을 **한 트랜잭션으로** 지웁니다.
   8이 실패하면 경고와 함께 200을 돌려줍니다. 이때는 로그인 계정이 이미 없어 **본인이 다시 부를 수 없습니다** —
   경고 문구가 "문의 이메일로 운영자에게 알려 달라"고 안내하고, 총괄이 회원 관리의 **완전 삭제**(`admin-purge-oauth-member`)로
   남은 기록을 지웁니다(교사였던 계정은 먼저 '담임 해제').

로그에는 실패한 단계와 오류 문구만 남깁니다(토큰·이메일·이름·id 없음, 오류 문구 안의 id·이메일 모양도 `<id>`·`<email>`로 가림). 성공은 남기지 않습니다.

## 요청 · 응답

```jsonc
// POST (Authorization: Bearer <로그인한 회원 access token> — supabase-js가 자동으로 붙인다)
{ "mode": "cancel" }            // 또는 "withdraw"
```

| 상태 | 본문 | 뜻 |
|---|---|---|
| 200 | `{ "ok": true, "mode": "cancel", "alreadyDeleted": false, "removedFiles": 0 }` | 지움. 화면은 로컬 로그아웃 + 안내 |
| 200 | `{ "ok": true, …, "warning": "로그인 계정은 지웠지만 남은 기록을 아직 다 지우지 못했어요. …" }` | 계정은 지움, 기록 일부 남음(위 8) |
| 200 | `{ "ok": false, "code": "blocked", "blocked": ["부엉이반"], "error": "아직 학생이 있는 학급이 있어요: 부엉이반. 먼저 [학급 정리]로 학생 계정과 기록을 지운 뒤 탈퇴해 주세요." }` | withdraw 막힘 — 아무것도 지우지 않음 |
| 400 | `{ "error": "…", "code": "not_pending" \| "not_verified" \| "id_login" \| "unknown_login" \| "last_admin" }` | 조건 안 맞음(아무것도 지우지 않음) |
| 400 | `{ "error": "계정 삭제 기능용 DB 설정이 아직 적용되지 않았어요. …20261020000000_privacy_a_schema.sql…" }` | SQL ① 전 |
| 401 | `{ "error": "로그인이 필요합니다." / "로그인이 만료되었습니다. …" }` | 토큰 없음·만료·계정이 이미 없음 |
| 403 | `{ "error": "총괄 선생님은 이 화면에서 탈퇴할 수 없어요.", "code": "super_admin" }` | 총괄 |
| 404 | `{ "error": "계정 정보를 찾을 수 없어요. …", "code": "self_not_found" }` | 프로필이 없음 |
| 500 | `{ "error": "올린 게임 파일을 지우지 못해 멈췄어요. …" }` 등 | 잠시 뒤 다시(지운 것 없음 — 게임 파일 일부만 지웠으면 문구에 개수) |

화면(supabase-js `functions.invoke`)에서 200이 아닌 응답은 `FunctionsHttpError`가 되고, 본문의 `error`를 읽어 보여 줍니다(`src/lib/admin.ts`의 기존 방식).
`blocked`는 **200**으로 오므로 `data.ok === false && data.code === "blocked"`를 먼저 봅니다.

## 먼저 할 일 (순서 — spec 7절)

1. Supabase SQL Editor에서 **`supabase/migrations/20261020000000_privacy_a_schema.sql`(SQL ①)** 실행 + 파일 위 확인 쿼리.
   - 실행 전에는 이 함수가 "계정 삭제 기능용 DB 설정이 아직 적용되지 않았어요"로 거부합니다(아무것도 지우지 않음).
   - `cancel`은 SQL ②(`20261020010000_privacy_b_enforce.sql`)가 구글 계정에 `member_verification` 행을 만든 뒤부터 실제로 쓸 수 있습니다(그 전에는 "가입하지 않기를 할 수 없어요").
2. 이 함수를 배포합니다(아래). `admin-clear-students`·`admin-create-member`도 함께.
3. 사이트를 배포(push)합니다.

## 환경·설정

- 환경변수 `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`는 Supabase가 자동으로 넣어 주므로 **따로 설정할 필요가 없습니다.**
- 허용 출처(CORS): `https://eversunk2-tech.github.io`, `http://localhost:3000` + Supabase Secrets **`EXTRA_ALLOWED_ORIGINS`**(지금 Vercel 주소 — 다른 함수와 같은 Secret을 읽습니다. 새로 설정할 것 없음).
- **JWT 검증(Verify JWT)은 켜 둔 상태로 배포하세요**(`supabase/config.toml`에 `verify_jwt = true`).

## 배포 (사용자 Mac 터미널)

```bash
npx supabase functions deploy member-self-delete
```

(`--no-verify-jwt`를 붙이지 마세요. "Access token not provided"가 나오면 `npx supabase login`부터 — 브라우저 승인 → 확인 코드.)

대시보드로 배포할 때: Edge Functions → Deploy a new function → Via Editor → 이름을 정확히 `member-self-delete` → 이 폴더의 `index.ts`를 붙여 넣고 Deploy → Settings에서 **Verify JWT** 켜짐 확인.

## 배포 후 확인 (실제 시험용 구글 계정으로 — 사용자)

1. **지워도 되는 시험용** 구글 계정으로 사이트에 로그인(SQL ② 뒤) → 확인 창에서 **[가입하지 않기]** → 확인 창 → 로그아웃되고 안내가 보이는지.
2. 총괄 계정으로 회원 관리에서 그 계정이 사라졌는지. 같은 구글 계정으로 다시 로그인하면 새 계정·확인 창이 다시 뜨는지.
3. (선택) 시험용 구글 계정을 교사 코드로 인증 → 학급 개설 → 시험용 학생 한 명 등록 → [회원 탈퇴]가 **막히는지**(학급 이름) →
   그 학급을 [학급 정리] → 다시 [회원 탈퇴]가 되는지.
4. 함수 로그(대시보드 Edge Functions → member-self-delete → Logs)에 이메일·이름·id가 없는지.
