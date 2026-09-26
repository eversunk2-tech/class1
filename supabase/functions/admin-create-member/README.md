# admin-create-member (Edge Function)

관리자 화면(`/admin/members/`)의 **회원 추가** 버튼이 호출하는 함수입니다.
호출자가 관리자인지 확인한 뒤 새 계정을 만들고, **첫 로그인 때 비밀번호를 바꾸도록** 표시합니다.

- 한 명 만들기, 엑셀(.xlsx)·CSV로 여러 명 만들기 모두 이 함수를 씁니다.
- 아이디는 `{아이디}@class1.local`로 바뀝니다(로그인 화면·`scripts/import-users.mjs`와 같은 규칙).
- 역할은 **학생 → `profiles.role = 'user'`**, **교사 → `'admin'`** 두 가지뿐입니다.
- 화면은 한 번에 **20명씩 나눠** 보냅니다. 함수는 한 요청에 최대 **100행**까지 받습니다.

## 학급(반) 규칙 — 2026-09-27 (`docs/classes/spec.md` 개정 1)

- **학생**은 요청의 `classId` 학급에 등록됩니다. 그 학급은 **호출한 선생님이 담임인 학급**이어야 합니다
  (`class_teachers`). **총괄도 자기 학급에만** 학생을 등록할 수 있습니다. 만든 뒤 `profiles.class_id`가 그 학급이 되고,
  DB 트리거가 `member_directory.class_id`에도 복사합니다.
- `classId`를 보내지 않으면: 호출자의 (보관되지 않은) 학급이 **하나일 때만** 그 학급으로 넣습니다.
  학급이 없으면 "먼저 학급을 개설해 주세요", 여럿이면 "학생을 등록할 학급을 골라 주세요"(400).
- **교사 계정**(`role: "admin"`)은 **총괄**(`profiles.role = 'admin'` + `is_super_admin = true`)만 만들 수 있고, 학급이 없습니다.
  총괄이 아닌 선생님이 보낸 교사 줄은 **그 줄만** `invalid`("교사 계정은 총괄 관리자만 만들 수 있습니다…")로 돌려주고 나머지 줄은 만듭니다.
- 학급 확인은 **계정을 하나라도 만들기 전에** 끝납니다. 학급에 문제가 있으면 아무 계정도 만들지 않습니다.
- 서비스 롤에는 `auth.uid()`가 없어 DB 함수(`is_super_admin()` 등)를 부르지 않고, `profiles`·`class_teachers`·`classes`를
  서비스 롤로 직접 읽어 같은 규칙으로 판단합니다.

## 먼저 할 일: SQL 1개 (감사 로그용)

**`supabase/migrations/20260923030000_member_create_log.sql`을 Supabase SQL Editor에서 먼저 실행**하세요.
누가·언제·어떤 계정을 어떤 역할로 만들었는지 `member_create_log`에 남기기 위한 표와 서비스 롤 전용 함수입니다.

* 계정 생성·역할 지정 자체에는 이 SQL이 **필요 없습니다.** 실행하지 않아도 계정은 정상적으로 만들어지고,
  대신 "기록이 남지 않았습니다. …SQL을 실행하세요"라는 안내가 화면에 함께 뜹니다.
* **비밀번호는 로그에 어떤 형태로도 남기지 않습니다.** 실패한 행은 계정이 생기지 않았으므로 기록하지 않습니다.
* 계정 생성은 Auth Admin API로 하고, 역할·`must_change_password`는 서비스 롤이 `profiles`를 직접 UPDATE합니다
  (`20260921000000_init_blog.sql`의 `revoke`는 `anon`/`authenticated`만 대상이라 서비스 롤에는 영향이 없습니다).

순서: **① SQL 실행 → ② 이 함수 배포 → ③ 사이트 push.**

### 학급 기능(2026-09-27) 배포 순서

1. SQL Editor: `supabase/migrations/20260927000000_classes_schema.sql`
2. SQL Editor: `docs/classes/setup-owl-class.sql`(부엉이반 + 총괄 지정 — 이메일을 바꿔서)
3. SQL Editor: `supabase/migrations/20260927010000_classes_rls.sql`
4. SQL Editor: `supabase/migrations/20260927020000_class_notices.sql`(학급별 '선생님 글')
5. **이 함수와 `admin-reset-password`·`admin-delete-member`를 다시 배포**(아래 방법 A 또는 B)
6. 사이트 push

1번 SQL 전에 새 코드를 배포하면 "학급 기능용 DB 설정이 아직 적용되지 않았습니다"로 거부합니다(계정을 만들지 않음).
5번과 6번 사이(예전 화면 + 새 함수)에도 학급이 하나인 선생님은 그대로 학생을 만들 수 있습니다(학급 자동 선택).

## 환경·설정

- 환경변수 `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`는 Supabase가 자동으로 넣어 주므로 **따로 설정할 필요가 없습니다.**
- 허용 출처(CORS): `https://eversunk2-tech.github.io`, `http://localhost:3000` + Supabase Secrets **`EXTRA_ALLOWED_ORIGINS`**(쉼표로 구분한 추가 출처, 예: Vercel 주소 `https://class1-xxxx.vercel.app` — 끝에 `/` 없이). 다른 도메인을 더 쓰게 되면 코드를 고치지 말고 이 Secret을 바꾼 뒤 함수를 다시 배포하세요.
- **JWT 검증(Verify JWT)은 켜 둔 상태(기본값)로 배포하세요.**
- Supabase 프로젝트의 **Authentication > Sign Ups**에서 가입이 꺼져 있어도 이 함수는 동작합니다(Admin API라 가입 설정과 무관).

---

## 방법 A: Supabase CLI로 배포

```bash
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase functions deploy admin-create-member
```

`<project-ref>`는 대시보드 주소 `https://supabase.com/dashboard/project/<project-ref>`의 마지막 부분입니다.
(`--no-verify-jwt`를 붙이지 마세요.)

## 방법 B: 대시보드 에디터로 배포 (CLI 없이)

1. Supabase 대시보드 → 프로젝트 선택 → 왼쪽 메뉴 **Edge Functions**.
2. **Deploy a new function** → **Via Editor**.
3. 함수 이름을 정확히 `admin-create-member`로 입력합니다(화면 코드가 이 이름으로 호출합니다).
4. 예제 코드를 모두 지우고 이 폴더의 `index.ts` 내용을 그대로 붙여 넣습니다.
5. **Deploy function**을 누릅니다.
6. 배포 후 **Settings**에서 **Verify JWT**가 켜져 있는지 확인합니다.

## 배포 후 확인

1. 관리자 계정으로 로그인 → **회원 관리**(`/admin/members/`) → **회원 추가**.
2. **한 명 만들기** 탭에서 시험용 아이디(예: `test0001`)·비밀번호(6자 이상)·학생을 넣고 만듭니다.
3. 확인할 것:
   - 목록에 새 회원이 **"비밀번호 변경 필요"** 상태로, **고른 학급** 이름과 함께 나타난다.
   - 그 아이디로 로그인하면 `/reset-password/`로 이동해 새 비밀번호를 설정하게 된다.
   - (총괄만) 역할을 **교사**로 만들면 목록의 역할이 **관리자**로 보이고 학급은 비어 있다.
   - (두 번째 담임이 생긴 뒤) 그 담임 계정으로는 자기 학급에만 학생이 만들어지고, 교사 역할 줄은 거부된다.
4. **엑셀로 여러 명** 탭에서 **서식 내려받기**로 받은 파일을 그대로 다시 올려 미리보기가 나오는지 봅니다.
5. 시험용 계정은 `⋮` → **탈퇴 처리**로 지웁니다.

SQL Editor에서 학급이 제대로 들어갔는지 보려면:

```sql
select d.email, c.name as 학급, p.role, p.must_change_password
from public.member_directory d
join public.profiles p on p.id = d.id
left join public.classes c on c.id = d.class_id
order by d.signed_up_at desc
limit 20;
```

## 요청 형식

```jsonc
// POST (Authorization: Bearer <로그인한 관리자 access token> — supabase-js가 자동으로 붙인다)
{
  "rows": [{ "id": "60101", "password": "…", "role": "user" }],
  "source": "single",            // 또는 "bulk"(감사 로그 구분용)
  "classId": "<학급 uuid>"       // 학생 줄을 넣을 학급(호출자가 담임인 학급). 교사 줄만 보낼 때는 없어도 된다.
}
```

## 응답 형식

```jsonc
// 200
{
  "results": [
    { "index": 0, "id": "60101", "status": "created" },
    { "index": 1, "id": "60102", "status": "exists",  "message": "이미 있는 아이디입니다." },
    { "index": 2, "id": "60103", "status": "invalid", "message": "비밀번호는 6자 이상이어야 합니다." },
    { "index": 3, "id": "60104", "status": "failed",  "message": "계정을 만들지 못했습니다. (…)" }
  ],
  // 감사 로그를 남기지 못했을 때만 붙는다(계정 생성 자체는 성공한 상태).
  "warning": "계정은 만들었지만 '누가 언제 만들었는지' 기록은 남지 않았습니다. …"
}
```

- 부분 실패를 허용합니다. 성공한 행은 그대로 두고 실패 행만 사유와 함께 돌려줍니다.
- **비밀번호는 응답에도 로그에도 남지 않습니다.**
- `status: "created"`에 `warning`이 붙으면 계정은 만들어졌지만 역할·플래그 설정이 실패한 것입니다.

| 화면 메시지 | 원인 / 해결 |
|---|---|
| "회원 추가 기능이 아직 준비되지 않았습니다" | 함수가 배포되지 않았거나 이름이 다릅니다. `admin-create-member`로 배포하세요. |
| "관리자만 사용할 수 있습니다" | 로그인한 계정의 `profiles.role`이 `admin`이 아닙니다. |
| "학급 기능용 DB 설정이 아직 적용되지 않았습니다" (500) | `20260927000000_classes_schema.sql`을 아직 실행하지 않았습니다. 위 "학급 기능 배포 순서"대로 실행하세요. |
| "먼저 학급을 개설해 주세요…" (400) | 호출한 선생님이 담임인 학급이 없습니다. 관리자 화면에서 학급을 개설하세요. |
| "학생을 등록할 학급을 골라 주세요." (400) | 학급이 여럿인데 화면이 `classId`를 보내지 않았습니다(예전 화면). 새로고침하세요. |
| "학급 정보(classId)가 올바르지 않습니다…" (400) | `classId`가 uuid 형식이 아닙니다. |
| "선생님이 담임인 학급에만 학생을 등록할 수 있습니다." (403) | 보낸 `classId`가 호출자의 학급이 아닙니다(없는 학급도 같은 문구). 총괄도 자기 학급에만 등록합니다. |
| "보관된 학급에는 학생을 등록할 수 없습니다…" (403) | 그 학급이 보관(`archived_at`)되었습니다. |
| 줄마다 "교사 계정은 총괄 관리자만 만들 수 있습니다…" | 총괄이 아닌 선생님이 교사 역할 줄을 보냈습니다. 그 줄의 역할을 학생으로 바꾸세요. |
| "계정은 만들었지만 학급 배정과 … 설정에 실패했습니다" | 계정은 생겼지만 `profiles` 설정이 두 번 모두 실패했습니다. 그 학생이 명단에 안 보이면 총괄이 SQL로 학급을 정합니다: `update public.profiles set class_id = '<학급 id>', must_change_password = true where id = '<학생 id>';` |
| "이미 있는 아이디입니다" | 같은 아이디의 계정이 이미 있습니다(비밀번호는 바뀌지 않습니다). 비밀번호를 바꾸려면 **비밀번호 초기화**를 쓰세요. |
| "비밀번호가 너무 쉬워 거부되었습니다" | Supabase의 비밀번호 정책(유출 비밀번호 차단 등)에 걸렸습니다. 다른 비밀번호로 바꾸세요. |
| "요청이 너무 많습니다" | GoTrue 요청 제한입니다. 잠시 뒤 **실패한 행만 다시 시도**를 누르세요. |
| "계정은 만들었지만 '누가 언제 만들었는지' 기록은 남지 않았습니다" | `20260923030000_member_create_log.sql`을 아직 실행하지 않았습니다. 실행하면 그다음부터 기록됩니다(이미 만든 계정은 그대로 유지됩니다). |

## 감사 로그 확인

SQL Editor에서:

```sql
select l.created_at, l.actor_name, l.target_email, l.target_role, l.source
from public.member_create_log l
order by l.created_at desc
limit 50;
```

관리자 화면에는 아직 이 로그를 보여 주는 곳이 없습니다. 나중에 넣는다면 회원 상세
(`/admin/members/?id=…`)의 "탈퇴 기록"이 있는 자리 옆에 "만든 사람·만든 날짜" 한 줄로 넣는 것이 가장 쌉니다.
