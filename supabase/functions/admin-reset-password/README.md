# admin-reset-password (Edge Function)

관리자 화면(`/admin/members/`)의 **비밀번호 초기화** 버튼이 호출하는 함수입니다.
관리자인지 확인한 뒤 대상 회원(아이디/이메일 계정)의 비밀번호를 무작위 임시 비밀번호(14자)로 바꾸고,
다음 로그인 때 새 비밀번호를 설정하도록 `profiles.must_change_password = true`로 표시합니다.

> 먼저 `supabase/migrations/20260921020000_admin_learning.sql`과 `20260922000000_admin_learning_fixes.sql`을
> SQL Editor에서 차례로 실행해 두어야 합니다(`admin_finalize_password_reset` 함수가 없으면 함수가 경고와 함께 응답합니다).
>
> - 관리자 계정(자기 자신 포함)은 초기화할 수 없습니다. 다른 관리자를 초기화하려면 먼저 관리자 권한을 해제하세요.
> - 초기화하면 대상의 기존 로그인 세션(리프레시 토큰)이 삭제되고, `password_reset_log` 테이블에 누가·언제·누구를 초기화했는지 남습니다.
>   이미 발급된 access token은 만료(기본 1시간)까지 유효할 수 있습니다.

- 환경변수 `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`는 Supabase가 자동으로 넣어 주므로 **따로 설정할 필요가 없습니다.**
- 허용 출처(CORS): `https://eversunk2-tech.github.io`, `http://localhost:3000`. 다른 도메인을 쓰게 되면 `index.ts`의 `ALLOWED_ORIGINS`를 고친 뒤 다시 배포하세요.
- **JWT 검증(Verify JWT)은 켜 둔 상태(기본값)로 배포하세요.** 로그인하지 않은 요청은 Supabase 게이트웨이에서 먼저 막히고, 함수 안에서도 한 번 더 확인합니다.
- 임시 비밀번호는 응답에만 담기며 로그에 남지 않습니다. 관리자가 창을 닫으면 다시 볼 수 없습니다(다시 초기화하면 새로 발급).

---

## 방법 A: Supabase CLI로 배포

1. 터미널에서 이 저장소 폴더로 이동합니다.
2. 로그인합니다(브라우저가 열립니다).
   ```bash
   npx supabase login
   ```
3. 프로젝트를 연결합니다. `<project-ref>`는 대시보드 주소 `https://supabase.com/dashboard/project/<project-ref>`의 마지막 부분입니다.
   ```bash
   npx supabase link --project-ref <project-ref>
   ```
4. 배포합니다(JWT 검증은 기본으로 켜져 있습니다. `--no-verify-jwt`를 붙이지 마세요).
   ```bash
   npx supabase functions deploy admin-reset-password
   ```
5. 대시보드 → **Edge Functions** 목록에 `admin-reset-password`가 보이면 완료입니다.

## 방법 B: 대시보드 에디터로 배포 (CLI 없이)

1. Supabase 대시보드 → 프로젝트 선택 → 왼쪽 메뉴 **Edge Functions**.
2. **Deploy a new function** → **Via Editor**(또는 *Create a function*)를 누릅니다.
3. 함수 이름을 정확히 `admin-reset-password`로 입력합니다(화면 코드가 이 이름으로 호출합니다).
4. 기본으로 들어 있는 예제 코드를 모두 지우고, 이 폴더의 `index.ts` 내용을 그대로 붙여 넣습니다.
5. **Deploy function**을 누릅니다.
6. 배포 후 함수 상세 화면의 **Settings**(또는 **Details**)에서 **Enforce JWT Verification(Verify JWT)** 이 **켜져 있는지** 확인합니다.

## 배포 후 확인

1. 관리자 계정으로 사이트에 로그인합니다.
2. **회원 관리**(`/admin/members/`)에서 테스트용 학생 계정의 **비밀번호 초기화**를 누릅니다.
3. 임시 비밀번호가 표시되면 성공입니다. 그 학생 계정으로 로그인하면 **새 비밀번호 설정** 화면으로 이동해야 합니다.

문제가 생기면:

| 화면 메시지 | 원인 / 해결 |
|---|---|
| "비밀번호 초기화 기능이 아직 준비되지 않았습니다" | 함수가 배포되지 않았거나 이름이 다릅니다. 위 방법으로 `admin-reset-password`를 배포하세요. |
| "관리자만 사용할 수 있습니다" | 로그인한 계정의 `profiles.role`이 `admin`이 아닙니다. |
| "OAuth 전용 계정은…" | GitHub/Google로만 가입한 계정은 비밀번호가 없어 초기화할 수 없습니다. |
| 브라우저 콘솔에 CORS 오류 | 사이트 주소가 허용 출처에 없습니다. `ALLOWED_ORIGINS`를 고치고 다시 배포하세요. |
| 대시보드 **Edge Functions → Logs** | 서버 쪽 오류 메시지(비밀번호는 기록되지 않음)를 볼 수 있습니다. |
