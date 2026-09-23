# Build 보고서: 회원 완전 탈퇴 · 로그인 필수 토글 (2026-09-23)

지침: `docs/admin/admin-tools/build-instructions.md` / 설계: `docs/admin/admin-tools/spec.md`(**개정 1** 우선).
git 명령·실 DB 쓰기·실제 Auth Admin API 호출은 하지 않았다(규칙대로 Claude가 검증 후 커밋).

---

## 1. 만든 것 / 바꾼 것

### 새 파일
| 파일 | 내용 |
|---|---|
| `supabase/migrations/20260923000000_member_withdrawal.sql` | `profiles.withdrawn_at`, 외래키 3건 변경, `member_withdrawal_log`, `admin_finalize_withdrawal()` |
| `supabase/migrations/20260923010000_login_required.sql` | `site_settings`, `login_required()`·`can_browse()`·`admin_set_login_required()`, 기존 SELECT 정책 10개에 게이트 추가 |
| `supabase/functions/admin-delete-member/index.ts` · `README.md` | 관리자 검증 → `auth.admin.deleteUser()` → `admin_finalize_withdrawal()` |
| `src/components/admin/member-withdraw-dialog.tsx` | 이름 재입력 확인 다이얼로그(되돌릴 수 없음 경고) |
| `src/components/admin/login-required-card.tsx` | 관리자 개요의 토글 카드(스위치·상태·마지막 변경·켤 때만 확인) |
| `src/components/login-gate.tsx` | 잠금 상태일 때 비로그인 방문자에게 로그인 안내 |

### 고친 파일
`src/lib/types.ts`(Profile·MemberRow에 `withdrawn_at`, 컬럼 상수), `src/lib/admin.ts`(표시 헬퍼·차단 사유·Edge Function 호출·사이트 설정),
`src/lib/learning.ts`·`src/lib/community.ts`·`src/components/comment-section.tsx`·`src/components/learning/learning-ui.tsx`·
`src/components/feedback/feedback-thread.tsx`·`src/app/admin/(dashboard)/learning/*`·`src/app/admin/(dashboard)/community/community-moderation.tsx`
(profiles embed에 `withdrawn_at` 추가 + 이름 표시를 `profileDisplayName`으로 통일),
`src/app/admin/(dashboard)/members/member-list.tsx`(케밥 메뉴)·`member-detail.tsx`(탈퇴 배지·정보·버튼),
`src/components/admin/member-badges.tsx`(탈퇴 배지), `src/app/layout.tsx`(LoginGate), `src/hooks/use-session.tsx`(컬럼 없을 때 대비).

---

## 2. 제약(외래키) 조사 표 — **기록 보존의 핵심**

`supabase/migrations/**` 전체를 훑어 `auth.users` / `public.profiles`를 참조하는 제약을 모두 찾았다.

### 2.1 `auth.users`를 **직접** 참조하던 것 (auth 스키마 밖) — 전부 2개뿐

| 표 | 컬럼 | 원래 | 바꾼 뒤 | 왜 |
|---|---|---|---|---|
| `public.profiles` | `id` | `references auth.users(id) on delete cascade` | **외래키 제거** | 이 고리 하나 때문에 계정을 지우면 프로필이 사라지고, 프로필을 참조하는 모든 기록이 연쇄로 사라진다. PK·타입은 그대로라 기존 조인·화면은 그대로 동작한다. |
| `public.app_progress` | `user_id` | `references auth.users(id) on delete cascade` | `references public.profiles(id) on delete cascade not valid` | `auth.users`를 직접 보던 유일한 학습 표. profiles는 지우지 않으므로 profiles 참조로 옮기면 진행 기록이 보존된다. `not valid`는 기존 행 검사만 건너뛰며 on delete 동작에는 영향이 없다. |
| `storage.objects` | `owner` | Supabase 버전에 따라 `references auth.users(id)`(on delete 미지정 = 삭제 차단 가능) | `on delete set null`(자동 시도, 실패해도 마이그레이션은 계속) | 게임을 올린 학생의 계정 삭제가 거부되는 것을 막는다. 파일 행은 남고 소유자 표시만 비며, 파일 접근 권한은 `community_posts.game_path` 기준 정책이 정하므로 영향이 없다. |

마이그레이션에는 **남아 있는 위험한 외래키를 훑어 NOTICE로 알리는 DO 블록**과, 헤더에 확인 쿼리(2번)를 넣었다.

### 2.2 `public.profiles`를 참조하던 것 — **바꿀 것 없음 (전부 보존)**

`profiles` 행을 **지우지 않으므로** `on delete cascade`가 걸려 있어도 행이 사라지지 않는다. 하나도 바꾸지 않았다.

| 표 · 컬럼 | on delete | 결과 |
|---|---|---|
| `posts.author_id` | set null | 남음 |
| `comments.user_id` | cascade | 남음 |
| `likes.user_id` | cascade | 남음 |
| `member_directory.id` | cascade | 남음(이름·아이디 확인용) |
| `app_results.user_id` | cascade | 남음 |
| `post_reads.user_id` | cascade | 남음 |
| `assignments.created_by` | set null | 남음 |
| `assignment_submissions.user_id` | cascade | 남음 |
| `feedback_threads.student_id` | cascade | 남음 |
| `feedback_messages.sender_id` | cascade | 남음 |
| `feedback_read_marks.user_id` | cascade | 남음 |
| `praise_presets.created_by` | set null | 남음 |
| `community_posts.author_id` | set null | 남음 |
| `community_comments.user_id` | cascade | 남음 |
| `community_likes.user_id` | cascade | 남음 |
| `community_reports.reporter_id` / `target_author_id` | cascade / set null | 남음 |

`password_reset_log`는 원래 외래키가 없다(기록 보존 목적). 새 `member_withdrawal_log`도 같은 이유로 `target_id`에 외래키를 두지 않았다.

### 2.3 그 밖에 확인한 것
* `auth.users`의 트리거는 insert·update용만 있다(`on_auth_user_created`, `on_auth_user_created_directory`, `on_auth_user_updated_directory`, `on_auth_user_password_changed`). **delete 트리거는 없다** → 계정 삭제로 추가 삭제가 번지지 않는다.
* `handle_new_user()`에 `on conflict (id) do nothing`을 더했다(프로필이 계정보다 오래 살아남게 되었으므로 방어).
* `profiles`의 컬럼 권한: `withdrawn_at`을 **select에만** 추가하고 update 목록(`display_name, avatar_url`)에는 넣지 않았다 → 학생이 스스로 끌 수 없다.

---

## 3. 설계에서 바꾼 점 (spec 대비)

| 항목 | spec 본문 | 이번 구현 | 이유 |
|---|---|---|---|
| A의 방식 | 계정 정지(ban) + 복구 | **완전 삭제 + 복구 없음** | 개정 1(사용자 결정) |
| Edge Function 이름 | `admin-member-status` | `admin-delete-member` | 복구가 없어 "상태 전환"이 아니다. 지침의 예시 이름을 따랐다. |
| RPC | `admin_finalize_withdrawal(target, actor, action)` | `admin_finalize_withdrawal(target, actor)` | `restore`가 없다. 같은 회원에 다시 불러도 안전(멱등, 로그 중복 없음). |
| 이름 스냅샷 컬럼 | 각 참조 표에 추가 검토 | **불필요** | `profiles` 행이 남으므로 기존 조인이 그대로 동작한다. 원본 `display_name`은 지우지 않고 화면에서만 "탈퇴한 학생"으로 바꾼다(관리자는 상세에서 "탈퇴 전 이름"을 볼 수 있다). |
| `site_settings` UPDATE 권한 | `grant update (...)` + update 정책 | **아무에게도 주지 않음** | 값 변경은 `admin_set_login_required()`(security definer)만 한다 → 공격 면적이 줄고 `updated_by` 기록이 빠질 수 없다. |
| 정책 게이트 표현 | 각 정책에 `(not login_required()) or auth.uid() is not null` | 같은 뜻의 `public.can_browse()` 한 함수 | 10곳의 표현이 어긋날 위험을 없앴다. `login_required()`도 그대로 만들어 두었다(클라이언트·확인 쿼리용). |

---

## 4. 시험 결과

### 4.1 코드 검증
* `npx tsc --noEmit` 통과(오류 0).
* `npm run lint` 통과(오류 0). — 처음엔 `react-hooks/set-state-in-effect` 2건이 났고, 효과 안의 동기 setState를 없애 고쳤다.
* `npm run build`(정적 export) 통과. 22개 라우트 모두 ○(Static), 새 서버 기능 없음.

### 4.2 브라우저 (자기 전용 포트 3210에 `out/`을 올려 확인, 끝나고 종료·정리함)
* 데스크톱 홈: 정상 렌더, 콘솔 오류 0.
* 375px + 다크모드: 홈·로그인·자유게시판 정상. `/admin/`은 로그인 화면으로 보내짐(AdminGuard 그대로).
* **마이그레이션 실행 전 상태**(실 DB에 `withdrawn_at`·`site_settings` 없음)에서:
  * 프로필 조회는 `use-session`의 대비 코드가 `withdrawn_at`을 빼고 다시 읽어 **세션·관리자 진입이 막히지 않는다**(자물쇠 방지).
  * 자유게시판은 기존 `isMissingSchemaError` 경로를 타 "준비 중이에요 (SQL 실행 필요)" 안내를 보여 준다(흰 화면·크래시 없음). 다만 문구가 `20260922040000_community.sql`을 가리킨다.
  * `fetchLoginRequired()`는 표가 없으면 `false`를 돌려주므로 **잠금이 켜진 것처럼 굴지 않는다**.
  * → 그래도 **SQL 실행 → 확인 → push** 순서를 반드시 지켜야 한다(§6).

### 4.3 SQL 검토(로컬 Postgres 없음 — 눈으로만)
* 재실행 안전: `add column if not exists` / `create table if not exists` / `on conflict do nothing` / `drop policy if exists` + `create policy` / `create or replace function` / 제약은 이름을 붙여 `drop ... if exists` 후 재추가. 외래키 제거는 이름을 찍지 않고 `pg_constraint`에서 찾아 지우므로 이름이 달라도, 두 번 실행해도 안전하다.
* 제약 이름 충돌: 새로 만드는 이름은 `app_progress_user_id_profiles_fkey`, `site_settings_singleton`, `member_withdrawal_log_*` 뿐이며 기존 파일에 같은 이름이 없다.
* RLS 재귀(42P17): `can_browse()` → `login_required()` → `site_settings`만 읽는다. `site_settings`의 정책은 `true` 뿐이라 되돌아오지 않는다. `is_admin()`도 기존과 같다.
* `security definer` 함수 3개(`login_required`, `can_browse`, `admin_set_login_required`)와 `admin_finalize_withdrawal` 모두 `set search_path = ''` + 완전 한정 이름.
* 권한: `admin_finalize_withdrawal`은 `revoke all from public, anon, authenticated` 후 `service_role`에만 grant(`admin_finalize_password_reset`과 같은 패턴).

### 4.4 가짜 응답으로 확인한 흐름(코드 경로 기준, 실제 호출 없음)
| 상황 | 결과 |
|---|---|
| 관리자 아님 | Edge Function 403 "관리자만 사용할 수 있습니다." + 화면에도 케밥 메뉴 항목이 나오지 않음 |
| 자기 자신 | 화면에서 "본인 계정"으로 비활성 + 함수 400 + RPC도 거부(3중) |
| 다른 관리자 | 화면 "관리자 계정" 비활성 + 함수 403 + RPC 거부(3중) |
| 이름 확인 불일치 | "탈퇴 처리" 버튼이 비활성 → 호출 자체가 일어나지 않음 |
| 마이그레이션 미실행 | 함수가 **계정을 지우기 전에** 거부하고 "SQL을 먼저 실행하세요" 반환 |
| 계정 삭제 성공 + RPC 실패 | 200 + `warning` → 화면에 경고 토스트(12초). 다시 누르면 삭제는 "이미 없음"으로 통과하고 표시만 다시 시도(멱등) |
| 함수 미배포 | "탈퇴 기능이 아직 준비되지 않았습니다…" 안내 |
| 토글 RPC 권한 오류 | 스위치 원위치 + 한국어 오류 토스트 |
| 설정 읽기 실패 | `SITE_SETTINGS_FALLBACK`(꺼짐) — 절대 잠그지 않음 |

---

## 5. 자물쇠(lockout) 방지 점검표

1. `site_settings`의 SELECT 정책은 `using (true)` — 게이트를 걸지 않았다. `revoke all` 뒤 `grant select`로 anon·authenticated 모두 읽는다.
2. 관리자는 항상 로그인 상태라 `can_browse()`를 그냥 통과한다.
3. `/login/`·`/reset-password/`는 Auth 엔드포인트만 쓰고, `LoginGate`의 `ALWAYS_OPEN`에도 들어 있어 잠금 상태에서도 열린다.
4. 설정을 못 읽으면 화면·RLS 모두 "꺼짐"으로 동작한다.
5. `withdrawn_at` 컬럼이 없어도 프로필 조회가 실패하지 않는다(§4.2) → 관리자가 `/admin/`에 들어가 고칠 수 있다.

## 6. 사용자가 할 일 (이 순서 그대로)

1. Supabase SQL Editor에서 **`supabase/migrations/20260923000000_member_withdrawal.sql`** 실행.
   - 실행 로그의 **Notices**를 확인한다(`⚠`가 있으면 알려 주세요).
   - 확인: `select id, role, withdrawn_at from public.profiles limit 5;`
   - 확인: 헤더의 2번 쿼리로 `auth.users`를 참조하는 외래키가 auth 스키마 밖에 `on_delete = 'c'`(cascade)로 남아 있지 않은지.
   - 확인: `select conname, confrelid::regclass from pg_constraint where conrelid='public.app_progress'::regclass and contype='f';` → `profiles`여야 한다.
2. Supabase SQL Editor에서 **`supabase/migrations/20260923010000_login_required.sql`** 실행.
   - 확인: `select * from public.site_settings;` → 1행, `login_required = false`.
   - 확인: 시크릿 창(로그아웃)으로 사이트를 열어 **평소처럼 보이는지**(꺼진 상태이므로 변화가 없어야 정상).
   - ⚠ `select public.admin_set_login_required(true);`는 SQL Editor에서 실행하지 않는다(관리자 화면 스위치로만 시험).
3. Edge Function 배포:
   ```bash
   npx supabase functions deploy admin-delete-member
   ```
   (CLI가 처음이면 `npx supabase login` → `npx supabase link --project-ref <project-ref>` 먼저. `--no-verify-jwt`는 붙이지 않는다. 대시보드 에디터로 붙여넣어도 된다 — `supabase/functions/admin-delete-member/README.md` 방법 B.)
4. 1~3이 끝난 뒤에 사이트 배포(push). **순서를 바꾸면 안 된다** — 새 화면 코드가 `withdrawn_at` 컬럼을 읽기 때문이다.
5. 배포 후 확인(Review와 함께):
   - 테스트용 학생 계정 1개를 탈퇴 처리 → 그 계정으로 로그인 실패, 목록에 "탈퇴함" 배지로 남음, 회원 상세의 웹앱 결과·댓글·과제·피드백이 그대로 보임, 자유게시판 글 작성자가 "탈퇴한 학생"으로 보임.
   - 관리자 개요에서 토글을 켠 뒤 시크릿 창으로 글·게시판·게임 접근이 막히는지, 관리자 계정은 계속 되는지, 다시 꺼서 원복되는지.

---

## 7. 확인하지 못한 것 (정직하게)

* **실제 계정 삭제 동작**: `auth.admin.deleteUser()`를 실제로 호출하지 않았다(규칙). 삭제가 다른 외래키에 막히지 않는지는 **실 DB에서 테스트 계정으로 한 번 해 봐야** 확신할 수 있다(특히 `storage.objects.owner` 자동 수정이 권한 때문에 실패한 경우 — Notices 확인 필요).
* **관리자 로그인 상태의 화면**: 로그인 자격이 없어 케밥 메뉴·탈퇴 다이얼로그·토글 카드를 브라우저에서 눌러 보지 못했다. 코드·타입·빌드까지만 확인했다.
* **RLS 게이트의 실제 차단**: 잠금을 켠 상태로 비로그인 조회가 실제로 막히는지 실 DB에서 확인하지 못했다(§2.2 정책 10개 전부 Review에서 체크리스트로 확인 필요, 특히 `storage.objects`와 `community_likes`).
* **탈퇴 직후 학생 기기**: 이미 로그인된 기기의 access token은 만료(기본 1시간)까지 유효할 수 있다. 그 사이 `sci6…` 로컬 정리가 언제 일어나는지는 실기기로 확인하지 못했다(spec §1.4의 미해결 항목 그대로).

## 8. 알아 둘 동작(의도한 것)

* 탈퇴한 학생도 `member_directory`에 남으므로 **"전체 회원" 통계와 과제 "미제출" 명단에 계속 잡힌다**(기록 보존의 대가). 필요하면 후속 작업으로 제외 조건을 넣을 수 있다.
* 같은 이메일로 계정을 다시 만들면 **새 uuid**라 새 프로필·새 디렉터리 행이 생긴다(옛 기록과 이어지지 않는다).
* 잠금을 켜도 **페이지 셸(메뉴·제목·정적 문구)과 이미 색인된 검색 결과는 공개로 남는다.** 막히는 것은 Supabase에서 가져오는 데이터다(spec §2.5 그대로, 카드 하단 안내에도 적었다).
* 잠금 상태에서 `/apps/...`(과학 앱)은 원래부터 로그인 필수라 변화가 없다.

---

# 개정 1 (2026-09-23) — Review 지적 반영

`docs/admin/admin-tools/review.md`의 지적을 고쳤다. **두 SQL 파일은 아직 실행 전이라 같은 파일을 수정**했다(CLAUDE.md 규칙).

## 고친 것

| # | 심각도 | 무엇을 | 어떻게 |
|---|---|---|---|
| **U1** | **높음** | 케밥 메뉴를 누르면 회원 상세로 이동해 다이얼로그가 사라짐(비밀번호 초기화까지 회귀) | `MemberActions`를 `<span onClick={e => e.stopPropagation()}>`로 감싸 **React 트리**에서 막고(포털 이벤트가 여기서 끊긴다), `onRowClick`의 선택자에도 `[role="menu"] / [role="menuitem"] / [role="dialog"] / [role="alertdialog"] / [data-slot^="dropdown-menu"]`를 더해 이중으로 막았다. |
| **S1** | 중 | `can_browse()`·`login_required()` 실행 권한을 PUBLIC에서 회수해 스토리지 정책 평가가 실패할 수 있었음 | `revoke ... from public`을 없애고 **`grant execute ... to public`**으로 바꿨다(`is_admin()`과 같은 취급). `site_settings`는 원래 전체 공개 읽기라 새는 정보가 없다. `admin_set_login_required`의 revoke는 그대로 뒀다. |
| **S3** | 중 | `storage.objects.owner`가 `on delete cascade`면 자동 수정 대상에서 빠져 **첫 탈퇴에 파일 행이 사라질 수 있었음** | ① 자동 수정 조건을 `confdeltype <> 'n'`으로 넓혀 **cascade도 set null로 바꾸고**, 대상에 `storage.buckets`도 포함했다. ② NOTICE를 **실제 안전장치**로 바꿨다: 새 `public.withdrawal_blocking_fks()`(service_role 전용)가 위험한 외래키 목록을 돌려주고, **Edge Function이 계정을 지우기 전에** 호출해 비어 있지 않으면 거부한다(확인 실패도 거부 = fail closed). → 자동 수정이 권한 때문에 실패해도 **첫 탈퇴에서 파일 행이 사라질 수 없다.** |
| **U2** | 중 | 탈퇴 학생이 둘 이상이면 관리자 화면에서 구분 불가 | `adminDisplayName()`을 새로 만들어 **관리자 전용 화면에서만** `탈퇴한 학생(김철수)`로 보여 준다(학습 현황·학생 응답·과제 제출·피드백·커뮤니티 신고 관리·`StudentLink`). 학생·공개 화면은 `profileDisplayName()` 그대로 완전 익명이다. 회원 상세는 기존의 "탈퇴 전 이름"으로 이미 구분된다. |
| **U3** | 중 | 커뮤니티 글·댓글에서 탈퇴 학생의 아바타가 그대로 노출 | `community-post-detail.tsx`·`community-comment-section.tsx`에 `!isWithdrawnProfile(profile)` 조건을 넣어 나머지 세 곳과 맞췄다. |
| **S6** | 중 | SQL 1을 건너뛰면 게시판·댓글이 "준비 중"으로 떨어지고 안내가 엉뚱한 파일을 가리킴 | `SETUP_REQUIRED_MESSAGE`·`MISSING_SCHEMA_MESSAGE`에 **`20260923000000_member_withdrawal.sql`**을 함께 적었다. 실행 순서는 §6과 아래 "사용자가 할 일"에 그대로 유지. |
| **U4** | 낮음 | `AUTHOR_PROFILE_COLUMNS`를 만들어 놓고 안 씀 | 모든 `profiles(...)` embed를 이 상수로 바꿨다(`community.ts`, `comment-section.tsx`, `learning.ts` 8곳). 앞으로 컬럼을 추가하면 한 곳만 고치면 된다. |
| **U5** | 낮음 | `NameProfile.withdrawn_at`이 optional이라 select 누락 시 실명이 조용히 노출 | `Profile.withdrawn_at`과 `NameProfile.withdrawn_at`을 **필수(`string \| null`)**로 바꿨다 → 빠뜨리면 컴파일 오류. `use-session`의 예전 컬럼 대비 경로는 `?? null`로 맞춘다. |
| **U6** | 낮음 | 탈퇴 학생에게 피드백을 보낼 수 있고 안내가 없음 | `FeedbackThread`/`FeedbackCenter`/`FeedbackDialogButton`에 `studentWithdrawn` 프롭을 더해, 관리자 화면에서 입력창 위에 **"학생이 읽을 수 없고 기록으로만 남습니다"** 안내를 띄운다(회원 상세·학생 응답·웹앱 결과·과제 제출에서 값을 넘김). |
| **S2** | 낮음 | 계정만 지워지고 표시가 실패한 경우의 경고 문구 | "목록에는 아직 정상 회원으로 보일 수 있습니다."를 덧붙였다. |
| **S4** | 낮음 | `not valid` 외래키 확인 | 확인 쿼리 3번에 `confdeltype, convalidated`를 추가하고 "`convalidated = false`는 정상"이라고 적었다. |
| **S7** | 낮음 | 잠금 중에도 조회수가 올라감 | `increment_post_view()`를 마이그레이션 2에서 재정의해 맨 앞에 `if not public.can_browse() then return null; end if;`를 넣었다. 화면은 null을 이미 안전하게 처리한다(`view-counter.tsx`). |
| **S8** | 낮음 | `can_browse()`가 행마다 평가될 수 있음 | 정책 10곳 모두 `(select public.can_browse())`로 감쌌다(InitPlan으로 한 번만 평가 — Supabase RLS 관용구). |

## 다시 검증한 것

* `npx tsc --noEmit` 0 / `npm run lint` 0 / `npm run build` 성공(22개 라우트 전부 Static).
* **가짜 Supabase 응답**으로 자체 포트(3211)에 `out/`을 올려 확인(실 DB·실 Auth 호출 0건, 끝나고 서버 종료·탭 닫음·임시 파일 삭제):
  * **U1 회귀 확인** — 데스크톱 1280px 표에서 케밥 → **비밀번호 초기화**: 다이얼로그 유지, URL 그대로(`/admin/members/`). 케밥 → **탈퇴 처리**: 2초 뒤에도 다이얼로그 유지, URL 그대로. ✅
  * 375px 모바일 카드에서도 두 항목 모두 정상, 가로 스크롤 없음. ✅
  * 탈퇴 전체 흐름: 빈 입력·틀린 이름("홍길") → 버튼 `disabled`, 정확한 이름 → 활성 → `POST /functions/v1/admin-delete-member {userId}` 1회 → 목록 행이 즉시 "탈퇴한 학생 + 탈퇴함"으로 갱신, 다이얼로그 닫힘, 이동 없음. ✅
  * 회원 상세(탈퇴 회원): "탈퇴 전 이름: 김철수", 비밀번호 "없음(계정 삭제됨)", 탈퇴 처리 시각·처리자, 두 작업 버튼 비활성 + 사유, **관리자 지정 버튼도 비활성**(툴팁 포함). ✅
  * 피드백 대화 탭: **"탈퇴 처리된 학생이라 계정이 없습니다… 학생이 읽을 수 없고 기록으로만 남습니다"** 안내 표시(U6). ✅
  * 관리자 개요 토글: 확인 다이얼로그 → "켜기" → 상태 문구·`aria-checked`가 "켜짐"으로 바뀜. 콘솔 오류 0. ✅
* 마이그레이션 SQL은 여전히 정적 검토만(로컬 Postgres 없음). 새 `withdrawal_blocking_fks()`도 `security definer` + `set search_path = ''` + `service_role`에만 grant.

## 남은 한계 (바뀌지 않음)

* `auth.admin.deleteUser()` 실제 호출은 여전히 확인하지 못했다. 다만 이제 **위험한 외래키가 남아 있으면 함수가 계정을 지우기 전에 거부**하므로, 첫 탈퇴에서 기록이 사라지는 사고는 막힌다.
* 잠금 상태의 실제 RLS 차단(특히 `storage.objects`, `community_likes`)과 탈퇴 직후 학생 기기의 `sci6…` 정리 시점은 실 DB·실기기가 필요하다.
* U2 표시는 **관리자 화면에만** 적용했다. 학생·공개 화면은 의도대로 완전 익명("탈퇴한 학생")이다.
