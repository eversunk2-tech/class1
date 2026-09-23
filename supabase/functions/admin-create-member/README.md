# admin-create-member (Edge Function)

관리자 화면(`/admin/members/`)의 **회원 추가** 버튼이 호출하는 함수입니다.
호출자가 관리자인지 확인한 뒤 새 계정을 만들고, **첫 로그인 때 비밀번호를 바꾸도록** 표시합니다.

- 한 명 만들기, 엑셀(.xlsx)·CSV로 여러 명 만들기 모두 이 함수를 씁니다.
- 아이디는 `{아이디}@class1.local`로 바뀝니다(로그인 화면·`scripts/import-users.mjs`와 같은 규칙).
- 역할은 **학생 → `profiles.role = 'user'`**, **교사 → `'admin'`** 두 가지뿐입니다.
- 화면은 한 번에 **20명씩 나눠** 보냅니다. 함수는 한 요청에 최대 **100행**까지 받습니다.

## 새로 실행할 SQL은 없습니다

이 기능은 **마이그레이션이 필요 없습니다.** 계정 생성은 Auth Admin API로 하고,
역할·`must_change_password`는 서비스 롤이 `profiles`를 직접 UPDATE합니다
(`20260921000000_init_blog.sql`의 `revoke`는 `anon`/`authenticated`만 대상이라 서비스 롤에는 영향이 없습니다).

이미 실행한 마이그레이션만 있으면 됩니다(`20260921020000_admin_learning.sql`의 `must_change_password` 컬럼까지).

## 환경·설정

- 환경변수 `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`는 Supabase가 자동으로 넣어 주므로 **따로 설정할 필요가 없습니다.**
- 허용 출처(CORS): `https://eversunk2-tech.github.io`, `http://localhost:3000`. 다른 도메인을 쓰게 되면 `index.ts`의 `ALLOWED_ORIGINS`를 고친 뒤 다시 배포하세요.
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
   - 목록에 새 회원이 **"비밀번호 변경 필요"** 상태로 나타난다.
   - 그 아이디로 로그인하면 `/reset-password/`로 이동해 새 비밀번호를 설정하게 된다.
   - 역할을 **교사**로 만들면 목록의 역할이 **관리자**로 보인다.
4. **엑셀로 여러 명** 탭에서 **서식 내려받기**로 받은 파일을 그대로 다시 올려 미리보기가 나오는지 봅니다.
5. 시험용 계정은 `⋮` → **탈퇴 처리**로 지웁니다.

## 응답 형식

```jsonc
// 200
{
  "results": [
    { "index": 0, "id": "60101", "status": "created" },
    { "index": 1, "id": "60102", "status": "exists",  "message": "이미 있는 아이디입니다." },
    { "index": 2, "id": "60103", "status": "invalid", "message": "비밀번호는 6자 이상이어야 합니다." },
    { "index": 3, "id": "60104", "status": "failed",  "message": "계정을 만들지 못했습니다. (…)" }
  ]
}
```

- 부분 실패를 허용합니다. 성공한 행은 그대로 두고 실패 행만 사유와 함께 돌려줍니다.
- **비밀번호는 응답에도 로그에도 남지 않습니다.**
- `status: "created"`에 `warning`이 붙으면 계정은 만들어졌지만 역할·플래그 설정이 실패한 것입니다.

| 화면 메시지 | 원인 / 해결 |
|---|---|
| "회원 추가 기능이 아직 준비되지 않았습니다" | 함수가 배포되지 않았거나 이름이 다릅니다. `admin-create-member`로 배포하세요. |
| "관리자만 사용할 수 있습니다" | 로그인한 계정의 `profiles.role`이 `admin`이 아닙니다. |
| "이미 있는 아이디입니다" | 같은 아이디의 계정이 이미 있습니다(비밀번호는 바뀌지 않습니다). 비밀번호를 바꾸려면 **비밀번호 초기화**를 쓰세요. |
| "비밀번호가 너무 쉬워 거부되었습니다" | Supabase의 비밀번호 정책(유출 비밀번호 차단 등)에 걸렸습니다. 다른 비밀번호로 바꾸세요. |
| "요청이 너무 많습니다" | GoTrue 요청 제한입니다. 잠시 뒤 **실패한 행만 다시 시도**를 누르세요. |
