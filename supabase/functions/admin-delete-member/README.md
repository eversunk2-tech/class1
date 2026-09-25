# admin-delete-member (Edge Function)

관리자 화면(`/admin/members/`)의 **탈퇴 처리** 메뉴가 호출하는 함수입니다.
호출자가 관리자인지 확인한 뒤 대상 학생의 **계정(`auth.users`)을 실제로 삭제**하고,
`profiles.withdrawn_at`을 기록해 화면에서 **"탈퇴한 학생"**으로 보이게 합니다.

> **되돌릴 수 없습니다.** 복구(탈퇴 취소) 기능은 없습니다. 다시 쓰게 하려면 계정을 새로 만들어야 합니다.

## 먼저 할 일 (순서 중요)

1. Supabase SQL Editor에서 **`supabase/migrations/20260923000000_member_withdrawal.sql`을 실행**합니다.
   - 이 SQL이 `profiles → auth.users` 외래키를 끊고 `app_progress`를 `profiles` 참조로 옮겨,
     **계정을 지워도 학습 기록이 남게** 만듭니다.
   - 실행하지 않은 상태에서는 이 함수가 계정을 **지우지 않고** "SQL을 먼저 실행하세요"라고 거부합니다.
2. 그다음 이 함수를 배포합니다(아래).
3. 마지막으로 사이트를 배포(push)합니다.

## 남는 것 / 사라지는 것

| | |
|---|---|
| **남습니다** | 웹앱 결과(`app_results`)·진행 상황(`app_progress`)·읽은 글·댓글·좋아요·과제 제출·피드백 대화·자유게시판 글·학습게임 글과 업로드 파일·신고 기록, 그리고 `profiles`·`member_directory` 행(이름·아이디 확인용) |
| **사라집니다** | `auth.users` 계정과 로그인 수단(비밀번호, GitHub/Google 연결), 세션·리프레시 토큰 |

- 관리자 계정(자기 자신 포함)은 탈퇴시킬 수 없습니다. 꼭 필요하면 먼저 관리자 권한을 해제하세요.
- 탈퇴 기록(누가·언제·누구를, 그때의 이름·아이디)은 `member_withdrawal_log`에 남습니다.
- 이미 로그인해 둔 기기의 access token은 만료(기본 1시간)까지 잠깐 유효할 수 있습니다(`admin-reset-password`와 같은 한계).

## 환경·설정

- 환경변수 `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`는 Supabase가 자동으로 넣어 주므로 **따로 설정할 필요가 없습니다.**
- 허용 출처(CORS): `https://eversunk2-tech.github.io`, `http://localhost:3000` + Supabase Secrets **`EXTRA_ALLOWED_ORIGINS`**(쉼표로 구분한 추가 출처, 예: Vercel 주소 `https://class1-xxxx.vercel.app` — 끝에 `/` 없이). 다른 도메인을 더 쓰게 되면 코드를 고치지 말고 이 Secret을 바꾼 뒤 함수를 다시 배포하세요.
- **JWT 검증(Verify JWT)은 켜 둔 상태(기본값)로 배포하세요.**

---

## 방법 A: Supabase CLI로 배포

```bash
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase functions deploy admin-delete-member
```

`<project-ref>`는 대시보드 주소 `https://supabase.com/dashboard/project/<project-ref>`의 마지막 부분입니다.
(`--no-verify-jwt`를 붙이지 마세요.)

## 방법 B: 대시보드 에디터로 배포 (CLI 없이)

1. Supabase 대시보드 → 프로젝트 선택 → 왼쪽 메뉴 **Edge Functions**.
2. **Deploy a new function** → **Via Editor**.
3. 함수 이름을 정확히 `admin-delete-member`로 입력합니다(화면 코드가 이 이름으로 호출합니다).
4. 예제 코드를 모두 지우고 이 폴더의 `index.ts` 내용을 그대로 붙여 넣습니다.
5. **Deploy function**을 누릅니다.
6. 배포 후 **Settings**에서 **Verify JWT**가 켜져 있는지 확인합니다.

## 배포 후 확인

1. 관리자 계정으로 로그인 → **회원 관리**(`/admin/members/`).
2. 테스트용 학생 계정의 `⋮` 메뉴 → **탈퇴 처리** → 이름을 정확히 입력 → 실행.
3. 확인할 것:
   - 목록에 그 학생이 **"탈퇴함"** 배지와 함께 남아 있고, 이름이 **"탈퇴한 학생"**으로 보인다.
   - 그 계정으로 로그인하면 실패한다.
   - 회원 상세의 **학습활동 탭(웹앱 결과·댓글·과제·피드백)이 그대로 보인다.** ← 기록 보존 확인
   - 자유게시판·학습게임에서 그 학생의 글이 **"탈퇴한 학생"** 이름으로 남아 있다.

| 화면 메시지 | 원인 / 해결 |
|---|---|
| "탈퇴 기능이 아직 준비되지 않았습니다" | 함수가 배포되지 않았거나 이름이 다릅니다. `admin-delete-member`로 배포하세요. |
| "탈퇴 기능용 DB 설정이 아직 적용되지 않았습니다" | `20260923000000_member_withdrawal.sql`을 먼저 실행하세요. (이 상태에서는 계정을 지우지 않습니다.) |
| "관리자 계정은 탈퇴 처리할 수 없습니다" | 먼저 관리자 권한을 해제하세요. |
| "계정은 삭제했지만 … 기록을 남기지 못했습니다" | 같은 학생에게 **탈퇴 처리**를 한 번 더 실행하세요(계정 삭제는 건너뛰고 표시만 다시 시도합니다). |
| 계정 삭제 실패가 계속됨 | `auth.users`를 참조하는 외래키가 삭제를 막는 경우입니다. 마이그레이션 헤더의 확인 쿼리 2번을 실행해 보세요. |
