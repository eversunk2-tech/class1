# Build 보고서: 관리자 계정 생성(단일 + 엑셀 일괄) — 2026-09-23

지침: `docs/admin/create-members/build-instructions.md`

---

## 1. 바꾼 파일

| 파일 | 내용 |
|---|---|
| `supabase/functions/admin-create-member/index.ts` | **새 Edge Function.** 관리자 확인 → 행별 계정 생성 → `profiles`에 역할·`must_change_password` 반영 |
| `supabase/functions/admin-create-member/README.md` | **새 파일.** 배포 방법·확인 절차·오류 표 |
| `src/lib/spreadsheet.ts` | **새 파일.** 브라우저용 최소 `.xlsx`/CSV 파서 |
| `src/lib/member-import.ts` | **새 파일.** 행 검사 규칙, 제목 줄 별칭, 20행씩 나눠 보내기, 함수 호출·오류 한국어화 |
| `src/components/admin/member-create-dialog.tsx` | **새 파일.** "회원 추가" 모달(탭 2개: 한 명 만들기 / 엑셀로 여러 명) |
| `src/app/admin/(dashboard)/members/member-list.tsx` | 머리말에 **회원 추가** 버튼, 빈 목록 화면에도 같은 버튼, 만든 뒤 목록 새로고침 |
| `public/templates/members-template.xlsx` | **새 파일.** 제목 줄 + 예시 2줄 서식 |

`src/lib/admin.ts`, `src/lib/auth.ts`, 기존 Edge Function 등 **다른 파일은 건드리지 않았다.**

> ⚠ 작업 중 외부에서 커밋 `924dd5e`("Note that Gemini feedback quality…")가 생기면서 위 파일들이 그 커밋에 함께 들어갔다.
> (Build 서브에이전트는 git 명령을 쓰지 않았다.) 그 뒤 CSV 서식 방식만 고쳐 지금은
> `src/components/admin/member-create-dialog.tsx` 한 개가 커밋되지 않은 상태다.

## 2. 새 SQL 없음 (근거)

계정 생성은 Auth Admin API, 역할·플래그는 **서비스 롤이 `profiles`를 직접 UPDATE**한다.

* `20260921000000_init_blog.sql`의 `revoke update on public.profiles from anon, authenticated`와
  `20260922000000_admin_learning_fixes.sql`의 `revoke select …`는 **`anon`/`authenticated`만** 대상이다.
  서비스 롤은 RLS를 우회하고 컬럼 권한 제한도 받지 않으므로 `role`, `must_change_password`를 바로 쓸 수 있다.
* `handle_new_user` 트리거가 `auth.users` INSERT와 같은 트랜잭션에서 `profiles` 행을 만들어 두므로,
  `createUser` 응답을 받은 시점에는 그 행이 반드시 있다.
* 비밀번호 변경 트리거(`on_auth_user_password_changed`)는 **UPDATE of encrypted_password**에만 걸리므로
  신규 생성(INSERT)에서는 돌지 않는다 → `must_change_password = true`가 지워지지 않는다.
* 따라서 `admin_finalize_password_reset` 같은 **새 RPC/마이그레이션이 필요 없다.**
  `profiles` UPDATE가 실패하면 그 행만 `status: "created" + warning`으로 알려 주고 나머지는 계속 만든다.

## 3. 엑셀 읽기 방식 선택 근거

**새 의존성을 넣지 않고 `scripts/import-users.mjs`의 파서를 브라우저용으로 옮겼다**(`src/lib/spreadsheet.ts`).

* zip 중앙 디렉터리 해석은 Node의 `Buffer` → `DataView`/`Uint8Array`로, `inflateRawSync`는 표준
  `DecompressionStream("deflate-raw")`로 바꿨다(Chrome 80+, Safari 16.4+, Firefox 113+).
  지원하지 않는 브라우저에는 "CSV로 저장해 올려 주세요"라고 안내한다.
* 라이브러리(SheetJS 등)를 쓰지 않은 이유: 번들 수백 KB 증가, 과거 프로토타입 오염/ReDoS 취약점 이력,
  우리가 읽어야 하는 것은 **첫 시트의 문자열 세 칸**뿐이다.
* 스크립트와 같은 한계를 그대로 물려받는다 — 첫 번째 시트만, 숫자 서식 셀은 엑셀이 이미 앞자리 0을
  지웠을 수 있음(→ `numericRefs`로 감지해 **해당 행에 경고**를 붙이고 안내 문구를 띄운다).
* CSV도 지원한다(RFC 4180 따옴표·CRLF·BOM, 탭 구분도 허용). UTF-8로 못 읽으면 **EUC-KR(CP949)로 재시도**한다.
* 제목 줄 이름 흔들림 허용: 아이디/id/학번/loginid/계정, 비밀번호/password/초기비밀번호/비번/pw, 역할/role/구분/권한.
  **순서는 달라도 된다.**

## 4. 서식 내려받기 방식 선택 근거

* **`.xlsx`: 미리 만들어 `public/templates/members-template.xlsx`에 두고 `withBasePath()`로 링크했다.**
  이유 — 화면에서 zip을 만들려면 CRC32 + zip writer 코드를 또 넣어야 하는데, 서식은 고정된 3칸 2줄이라
  파일 하나가 더 단순하고 확실하다. 만든 파일을 **우리 파서로 다시 읽는 왕복 시험**을 마쳤다(§5).
* **CSV 서식: 파일로 두지 않고 화면에서 만든다.** `.gitignore`에 `*.csv`가 있다
  (계정 CSV에 비밀번호가 들어가므로 일부러 막아 둔 규칙). 파일을 두면 저장소·배포에 올라가지 않아
  링크가 404가 된다. 그래서 버튼을 누르면 BOM 붙인 CSV를 `Blob`으로 만들어 내려받는다.

## 5. 검증

실 DB·Auth는 **한 번도 부르지 않았다.** Edge Function은 가짜 Supabase 클라이언트로, 화면은 정적 빌드를
자체 포트(127.0.0.1:3111)에 올리고 `fetch`를 가로챈 임시 시험 페이지로 확인한 뒤 그 페이지를 지웠다.

### 5.1 Edge Function (Node + 가짜 supabase 클라이언트)

| 상황 | 결과 |
|---|---|
| 로그인 안 함 / 토큰 이상 | 401 "로그인이 필요합니다." / "로그인이 만료되었습니다." |
| 학생 계정이 호출 | 403 "관리자만 사용할 수 있습니다." |
| `profiles` 행 없는 사용자 | 403 (기본 거부) |
| GET 요청 | 405 |
| 정상 2명(학생·교사) | 200, `email_confirm: true`, `full_name = 아이디`, `profiles`에 `role` + `must_change_password: true` |
| 이미 있는 아이디 | `status: "exists"` (비밀번호는 바뀌지 않음) |
| 한 요청 안 중복 | `status: "invalid"` "같은 아이디가 두 번 들어 있습니다." |
| 빈 아이디 / 한글 아이디 / 공백 섞인 아이디 / 31자 이상 | 각각 다른 `invalid` 사유 |
| 6자 미만 / 앞뒤 공백 / 72바이트 초과 비밀번호 | 각각 다른 `invalid` 사유 |
| 역할 빠짐·이상한 값 | "역할은 학생 또는 교사여야 합니다." |
| 행이 객체가 아님 | "행 형식이 올바르지 않습니다." |
| 약한 비밀번호(GoTrue 거부) | `failed` + 한국어 사유 |
| `profiles` UPDATE 실패 | `created` + warning(계정은 유지) |
| 101행 / 빈 목록 / `rows` 없음 | 400 + 안내 |
| 허용하지 않은 Origin | `Access-Control-Allow-Origin` 없음 |
| **응답·로그 전수 검사** | 비밀번호 문자열이 **한 번도 나오지 않음**(오류 로그는 아이디까지만) |

### 5.2 파서·검사 규칙 (Node)

* 만든 서식 `.xlsx`를 파서로 다시 읽어 3칸 2줄이 그대로 나오는 것 확인(**왕복 성공**).
* 엑셀이 실제로 만드는 모양(deflate 압축 + `sharedStrings` + 숫자 셀)으로 13줄짜리 시험 파일을 만들어
  정상·중복·한글 아이디·짧은 비밀번호·공백 비밀번호·이상한 역할·빈 역할·빈 아이디·빈 비밀번호·대문자 아이디까지
  **줄마다 기대한 사유**가 나오는 것 확인.
* 숫자 셀(A3)에 "앞자리 0" 경고가 붙는 것 확인.
* 제목 줄 없음 / 빈 파일 / 데이터 없음 / 201줄 초과 → 각각 다른 안내.
* 제목 줄 별칭·순서 뒤섞기(`ROLE, 학번, PW`) 정상 인식.
* CSV 따옴표·BOM·EUC-KR 재해석 확인.

### 5.3 화면 (자체 포트 정적 빌드 + 가짜 응답, 내 탭 하나만 사용)

| 확인 | 결과 |
|---|---|
| 한 명 만들기 | 아이디/비밀번호/역할 입력 → 요청 `1행: 60501/user/pw9` → 성공 토스트, 모달 닫힘, 목록 새로고침 콜백 1회 |
| 비밀번호 보기 토글 | 기본은 `type=password`(가려짐), 버튼으로 전환 |
| 엑셀 미리보기 | 13줄 파일 → 정상 행은 "만들 수 있음", 문제 행은 **빨간 글자 + ✕ 아이콘 + 사유**, **비밀번호는 "9자"처럼 길이만** |
| 만들기 버튼 | "**4명 만들기**"(문제 행 8개 제외) → 진행 표시 → "성공 4명" |
| CSV 업로드 | `student`/`교사` 등 별칭 인식, 4행 미리보기 |
| 부분 실패 | 성공 2 / 실패 2 표시, 실패 표(줄·아이디·결과·사유), warning 행 별도 표시 |
| 실패한 행만 다시 시도 | 실패 2행만 다시 전송(요청 로그로 확인) |
| 403 응답 | 모든 행에 "관리자만 사용할 수 있습니다." |
| 서식 왕복 | 내려받기 링크로 받은 `.xlsx`를 그대로 다시 올려 2줄 정상 인식 |
| 저장 흔적 | 모달을 닫은 뒤 `localStorage`·`sessionStorage` **둘 다 비어 있음**, 모달 DOM도 사라짐(비밀번호 state 소멸) |
| 모바일 375px + 다크 | 가로 스크롤 없음(`scrollWidth === innerWidth`), 표 줄바꿈, 버튼 세로 배치 |
| 키보드 | Esc로 닫히고 포커스가 "회원 추가" 버튼으로 돌아옴 |
| 콘솔 | 오류 0건 (유일한 오류는 일부러 막아 둔 `invalid.supabase.co` 조회 = 실 DB 미접속 증거) |

### 5.4 빌드

`npx tsc --noEmit` · `npm run lint` · `npm run build` **모두 통과**(정적 export 24쪽).

## 6. 사용자가 할 일

1. **Edge Function 배포** (새 SQL 없음)
   ```bash
   npx supabase functions deploy admin-create-member
   ```
   또는 대시보드 → Edge Functions → *Deploy a new function* → **Via Editor** →
   이름 `admin-create-member` → `supabase/functions/admin-create-member/index.ts` 내용 붙여넣기 → Deploy.
   **Verify JWT는 켠 채로** 둔다.
2. 배포가 끝나면 **사이트를 push**한다(함수가 없으면 화면이 "아직 준비되지 않았습니다"를 띄운다).
3. 배포 후 확인: 관리자로 로그인 → `/admin/members/` → **회원 추가** → 시험용 계정 1개 만들기 →
   그 아이디로 로그인해 `/reset-password/`로 넘어가는지 확인 → `⋮` → **탈퇴 처리**로 정리.

## 7. 확인하지 못한 것

* **실제 Supabase 호출** — 계정 생성, `profiles` UPDATE 권한, GoTrue 오류 코드는 모두 가짜 응답으로만 확인했다.
  특히 "서비스 롤이 `profiles`를 바로 UPDATE할 수 있다"는 마이그레이션을 읽고 내린 판단이므로,
  **첫 계정 생성 뒤 목록에서 역할과 '비밀번호 변경 필요' 표시를 꼭 확인**해 주세요.
  (실패하면 계정은 만들어지고 warning이 뜬다 — 그때는 새 마이그레이션이 필요하다는 뜻이다.)
* **CSV 서식 내려받기 버튼의 실제 저장 동작** — 내용은 파서 왕복으로 확인했지만, 이 버튼은
  파일 방식에서 Blob 방식으로 바꾼 뒤 브라우저에서 다시 눌러 보지 못했다(코드 검토만).
* **진짜 엑셀이 만든 .xlsx** — 엑셀이 실제로 저장한 파일 대신, 엑셀과 같은 구조(deflate + sharedStrings)로
  만든 파일로 시험했다. 선생님 컴퓨터의 실제 엑셀 파일로 한 번 올려 보시는 것을 권합니다.
* **20행 초과 대량 생성** — 20명씩 나눠 보내는 경로는 코드로만 확인했고(시험은 최대 4행),
  100명 규모의 실제 소요 시간은 재 보지 못했다.
* **태블릿 실기기 터치** — 375px 에뮬레이션까지만 확인했다.

---

# 개정 1 — 리뷰 수정 (2026-09-23)

`docs/admin/create-members/review.md`의 **M1 · M2 · L1 · L2 · L3**를 모두 고쳤다.
(M1은 사용자가 "마이그레이션을 실행하겠다"고 결정해 함께 반영했다.)

## A. M1 — 계정 생성 감사 로그 추가 (새 SQL 1개)

**새 마이그레이션 `supabase/migrations/20260923030000_member_create_log.sql` — 사용자가 실행해야 한다.**
`password_reset_log`·`member_withdrawal_log`와 같은 모양으로 만들었다.

| 항목 | 내용 |
|---|---|
| 표 | `public.member_create_log(id, target_id, target_email, target_role, actor_id, actor_name, source, created_at)` |
| 기록하는 것 | 만든 계정의 id·아이디(이메일)·부여한 역할, 만든 관리자 id + **그때의 이름 스냅샷**, `single`/`bulk` 구분, 시각 |
| 기록하지 않는 것 | **비밀번호(어떤 형태로도)**, 실패한 행 |
| RLS | `enable row level security` + `select` 정책 `public.is_admin()` → **관리자만 조회** |
| 쓰기 권한 | `revoke all ... from anon, authenticated` → 두 롤에 INSERT/UPDATE/DELETE 권한 없음. `grant select`만 다시 줌 |
| 쓰기 경로 | `admin_log_member_create(uuid, uuid, text, text)` — `security definer`, **`set search_path = ''`**, 안에서 actor가 admin인지 다시 확인, `grant execute ... to service_role`만 |
| 외래키 | `actor_id → profiles(id) on delete set null`. `target_id`에는 FK를 걸지 **않는다**(그 계정을 나중에 탈퇴 처리해 지워도 기록은 남아야 하므로 — 기존 두 로그와 같은 이유) |

**행 단위 결정: 만들어진 계정 1개당 1행**(배치당 1행 + 개수가 아니라).
근거 — 감사 로그의 목적은 "이 계정을 누가 만들었나"에 답하는 것이다. 회원 상세 화면에서
`target_id`로 바로 조회할 수 있어야 하고, 한 배치 안에서도 역할(학생/교사)이 섞이므로
배치당 1행으로는 "이 교사 계정을 누가 만들었는지"를 알 수 없다. `source` 칸이 단건/일괄 구분을 대신한다.

**실패한 행은 기록하지 않는다.** 계정이 만들어지지 않았으므로 감사 대상이 아니고,
실패 사유는 그 자리에서 화면에 표시된다(이미 있음·형식 오류·생성 실패).

**SQL을 실행하지 않아도 계정 생성은 그대로 동작한다.** Edge Function은 로그 RPC가 없으면(`PGRST202`/`42883`)
그 사실을 한 번만 확인하고 **더 이상 호출하지 않으며**, 응답에 최상위 `warning`을 붙인다.
화면은 그 문구를 결과 화면 위에 안내 상자로 보여 준다.

**관리자 화면에 로그 보기는 만들지 않았다**(새 화면은 이번 범위 밖). 넣는다면 가장 싼 자리는
회원 상세 `/admin/members/?id=…`의 "탈퇴 기록" 옆에 `member_create_log`를 `target_id`로 1건 조회해
"만든 사람 · 만든 날짜" 한 줄을 붙이는 것이다(`fetchLatestWithdrawal`과 같은 모양). README에도 적어 두었다.

## B. M2 — 오류 메시지: 상태 코드를 본문보다 먼저

`src/lib/member-import.ts`의 `invokeCreate`에서 **404 · 401 · 403 · 413은 본문을 읽지 않고 상태 코드로 판단**하도록
순서를 바꿨다. 이 네 가지는 원인이 상태 코드만으로 분명하고, 우리 함수가 같은 상태로 내는 문구와 뜻이 같아
잃는 정보가 없다. 그 밖의 상태(400·500 등)에서만 본문 `error`(우리 함수의 한국어 사유)로 넘어간다.
본문도 비어 있으면 `HTTP n` + "Edge Function이 배포되어 있는지 확인해 주세요" 힌트를 붙인다.
404 문구에는 **함수 이름과 배포 안내 문서 경로**를 넣었다.

## C. Low 3건

* **L1**(큰 정수 정밀도): `SheetTable`에 `unsafeNumberRefs`를 추가해 `|값| > Number.MAX_SAFE_INTEGER`인 숫자 셀을 따로 표시하고,
  그 행에는 "앞자리 0" 대신 **"숫자가 너무 커서 끝자리가 바뀌었을 수 있습니다"**를 보여 준다.
* **L2**(중복 기준 불일치): `buildDrafts`의 중복 키를 `loginIdToEmail()`(= 서버와 같은 규칙)로 바꿨다.
  이제 `60101`과 `60101@class1.local`이 섞여 있으면 **미리보기에서 바로** 중복으로 잡힌다.
* **L3**(재시도 범위): "다시 시도"가 `status === "failed"`인 행만 보낸다. 버튼 문구도
  "다시 시도할 수 있는 N행만 다시 시도"로 바꾸고, 재시도할 행이 없으면 버튼을 숨긴다.
  안내 문구에 "형식 오류는 파일을 고쳐 다시 올려 주세요"를 추가했다.

## D. 개정 1 검증 (실 DB·Auth 호출 0건)

### Edge Function (Node + 가짜 supabase 클라이언트, `rpc` 포함)

| 상황 | 결과 |
|---|---|
| SQL 실행됨 · 단건 | 계정 1개 + 로그 1행 `{p_role:"admin", p_source:"single"}` |
| SQL 실행됨 · 일괄 2명 | 계정 2개 + 로그 2행 `{p_source:"bulk"}` |
| 이미 있음 · 형식 오류 | **로그 0행 증가**(실패는 기록하지 않음) |
| `profiles` UPDATE 실패 | 계정은 유지 + 행 warning, 로그의 `p_role`은 **실제 상태인 `user`**로 기록 |
| **SQL 미실행**(RPC 없음) | 계정 3개 **모두 정상 생성**, RPC는 **1번만 호출**하고 중단, 응답에 `warning`("…20260923030000_member_create_log.sql을 실행하면…") |
| 로그 RPC 기타 오류 | 계정 생성 성공 + `warning`(사유 포함) |
| RPC 인자 전수 검사 | **비밀번호가 인자·응답·로그 어디에도 없음**(가짜 클라이언트가 감지하면 예외를 던지도록 해 두고 통과) |

### 파서·검사 규칙 (Node)

* L1: `9007199254740993`을 숫자 셀로 담은 `.xlsx`(DEFLATE) → `unsafeNumberRefs: ["A2"]`, 그 행만 "끝자리" 문구, 다른 숫자 행은 기존 "앞자리 0" 문구.
* L2: `60101` / `60101@class1.local` / `60101@CLASS1.LOCAL` 세 줄 → 2·3번째 줄이 "2줄과 아이디가 같습니다."
* 회귀: 정상 파일·역할 별칭·notice 동작 그대로.

### 화면 (자체 포트 3111 정적 빌드 + `fetch` 가로채기, 내 탭 하나)

| 상황 | 화면 문구 |
|---|---|
| **404 + 본문 `{"error":"not found"}`** (리뷰 M2 재현) | "회원 추가 기능이 아직 준비되지 않았습니다. Supabase에 Edge Function(admin-create-member)을 이름 그대로 배포했는지 확인해 주세요. (배포 방법: …README.md)" ← **영어 "not found"가 더 이상 노출되지 않음** |
| 401 + 본문 `{"error":"Invalid JWT"}` | "로그인이 만료되었습니다. 다시 로그인해 주세요." |
| 403 + 본문 `{"error":"forbidden"}` | "관리자만 사용할 수 있습니다. 관리자 계정으로 로그인해 주세요." |
| 413 + 본문 `{"error":"payload too large"}` | "한 번에 보낸 내용이 너무 큽니다. 파일을 나눠서 만들어 주세요." |
| 500 + 한국어 본문 | 본문 그대로("서버가 잠시 응답하지 못했습니다.") ← 본문 우선 경로가 살아 있음 |
| 감사 로그 SQL 미실행 | 결과 화면 위에 안내 상자로 "…기록은 남지 않았습니다. …20260923030000_member_create_log.sql을 실행하면…" |
| L3 재시도 | 3행(이미 있음 1·실패 1·성공 1) → 버튼 "**다시 시도할 수 있는 1행만 다시 시도**", 실제 요청 본문은 `[bulk] 1행: fail002` **한 줄뿐** |
| `source` 전달 | 한 명 만들기 = `[single]`, 엑셀 = `[bulk]` (요청 로그로 확인) |
| 저장 흔적 | `localStorage`·`sessionStorage` 여전히 **비어 있음** |
| 콘솔 | 이 흐름의 오류 0건(유일한 오류는 일부러 막아 둔 `invalid.supabase.co` 조회) |

`npx tsc --noEmit` · `npm run lint` · `npm run build` **모두 통과**(정적 export 24쪽). 임시 시험 페이지는 지웠다.

## E. 사용자가 할 일 (개정 1 기준, 순서 중요)

1. **Supabase SQL Editor에서 `supabase/migrations/20260923030000_member_create_log.sql` 실행**
   (파일 맨 위의 확인 쿼리 3개로 표·권한을 확인).
2. **Edge Function 배포**: `npx supabase functions deploy admin-create-member`
   (또는 대시보드 → Edge Functions → Via Editor, 이름 `admin-create-member`, **Verify JWT 켠 채로**).
3. **사이트 push.**
4. 확인: `/admin/members/` → **회원 추가**로 시험 계정 1개 생성 → 목록에 역할·"비밀번호 변경 필요" 확인 →
   SQL Editor에서 `select * from public.member_create_log order by created_at desc limit 5;`에 1행이 보이는지 →
   시험 계정은 `⋮` → **탈퇴 처리**로 정리(로그 행은 그대로 남는 것이 정상이다).

> 1번을 건너뛰고 2·3번만 해도 계정 생성은 동작한다. 대신 화면에 "기록이 남지 않았습니다" 안내가 함께 뜬다.

## F. 개정 1에서도 확인하지 못한 것

* 실제 Supabase에서 `admin_log_member_create` 실행 권한(`service_role`)과 RLS 동작 — SQL 검토와 가짜 클라이언트로만 확인했다.
* Supabase 게이트웨이가 "함수 없음"에 실제로 내려주는 본문 형식 — 이제는 **본문과 무관하게** 404면 배포 안내가 뜨므로 영향이 없다.
* 리뷰가 남긴 hydration(#418) 참고 항목 — 이 기능과 무관하다고 판단해 손대지 않았다.
