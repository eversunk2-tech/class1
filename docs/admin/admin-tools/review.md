# Review 보고서: 회원 완전 탈퇴 · 로그인 필수 토글 (2026-09-23)

대상: `docs/admin/admin-tools/spec.md`(**개정 1** 우선) / `build-report.md`
검증 범위: `supabase/migrations/20260923000000_member_withdrawal.sql`, `supabase/migrations/20260923010000_login_required.sql`,
`supabase/functions/admin-delete-member/**`, 변경된 `src/**` 관리자 UI.

Review는 코드를 고치지 않았다. 실 DB·실 Auth Admin API는 호출하지 않았고, 브라우저 확인은 **자기 전용 포트(3219)에
`out/`을 올리고 Supabase 응답을 전부 가짜로 가로채서** 했다(끝나고 서버 종료·탭 닫음).

---

## 0. 심각도 요약

| 심각도 | 건수 | 내용 |
|---|---|---|
| **높음** | 1 | U1 — 회원 목록 케밥 메뉴가 눌리자마자 회원 상세로 이동해 **탈퇴 다이얼로그·비밀번호 초기화 다이얼로그가 사라짐**(기존 기능 회귀 포함) |
| **중** | 5 | S1 · S3 · S6 · U2 · U3 |
| **낮음** | 7 | S2 · S4 · S7 · S8 · U4 · U5 · U6 |

---

## 1. 결론 — "SQL을 사용자가 실행해도 되는가"

### 판정: **조건부 예 — 아래 2곳(S1, S3)을 고친 뒤 실행하는 것을 권한다.**

* 두 파일 모두 **아직 실행 전**이므로 CLAUDE.md 규칙상 같은 파일을 수정해도 된다. 새 파일을 만들 필요는 없다.
* 구조·문법·재실행 안전성·권한·재귀(42P17)는 모두 문제를 찾지 못했다(§2에 근거).
* **그대로 실행해도 데이터가 깨질 가능성은 낮다.** 다만
  * **S1**(`can_browse()`/`login_required()` 실행 권한을 `public`에서 회수)은 `storage.objects` 정책이
    anon/authenticated 가 아닌 역할로 평가될 때 "permission denied for function can_browse"를 낼 수 있다.
    → **학습게임 파일 내려받기가 통째로 막힐 수 있는 위험**이라 미리 넓혀 두는 편이 안전하다.
  * **S3**(`storage.objects.owner` 외래키가 `on delete cascade`인 경우 자동 수정에서 제외)은
    그 경우 **첫 탈퇴에서 업로드 게임 파일 행이 조용히 사라진다.** 지금은 5번 DO 블록이 NOTICE로 알려 줄 뿐이다.
* 실행 순서는 build-report §6 그대로 지켜야 한다(**SQL 1 → SQL 2 → Edge Function → push**).
  특히 **SQL 1을 건너뛰고 push하면 게시판·댓글·학습 화면이 "준비 중" 안내로 떨어진다**(S6).

### 실행 직후 반드시 볼 것
1. 실행 로그 **Notices**에 `⚠`가 있으면 멈추고 알려 주세요(`storage.objects`/`storage.buckets` 관련일 가능성이 큽니다).
2. `select conname, confrelid::regclass, confdeltype from pg_constraint where conrelid='public.app_progress'::regclass and contype='f';`
   → `profiles`, `c`(cascade) 한 줄.
3. 헤더 확인 쿼리 2번(= auth 스키마 밖에서 `auth.users`를 참조하는 외래키)에 `on_delete = 'c'`가 없어야 한다.
4. `select has_function_privilege('anon','public.can_browse()','execute');` → true.

---

## 2. 내가 직접 훑은 외래키 전수 조사 (build-report를 신뢰하지 않고 재확인)

`supabase/migrations/*.sql` 8개의 모든 `references` 를 전수로 확인했다(`grep -n "references\|foreign key"`).

**`auth.users` 를 직접 참조하는 것(public 스키마) — 정확히 2개, build-report와 일치.**

| 파일:줄 | 표·컬럼 | 원래 | 마이그레이션 1의 조치 | 판정 |
|---|---|---|---|---|
| `20260921000000_init_blog.sql:24` | `profiles.id` | `auth.users(id) on delete cascade` | 외래키 제거(이름 탐색 후 drop) | ✅ 올바름 |
| `20260922010000_app_progress.sql:24` | `app_progress.user_id` | `auth.users(id) on delete cascade` | `public.profiles(id) on delete cascade not valid` | ✅ 올바름 |

**`public.profiles` 를 참조하는 것 — 16곳, 전부 손대지 않는 것이 맞다**(profiles 행을 지우지 않으므로 cascade여도 살아남는다):
`posts.author_id`(set null), `comments.user_id`, `likes.user_id`, `member_directory.id`, `app_results.user_id`,
`post_reads.user_id`, `assignments.created_by`(set null), `assignment_submissions.user_id`,
`feedback_threads.student_id`, `feedback_messages.sender_id`, `feedback_read_marks.user_id`,
`praise_presets.created_by`(set null), `community_posts.author_id`(set null), `community_comments.user_id`,
`community_likes.user_id`, `community_reports.reporter_id`/`target_author_id`.
`password_reset_log`는 외래키가 없다. 새 `member_withdrawal_log.target_id`도 외래키를 두지 않았다 — 기록 보존 목적으로 맞다.

**`auth.users` 트리거**: `on_auth_user_created`, `on_auth_user_created_directory`,
`on_auth_user_updated_directory`, `on_auth_user_password_changed` — 전부 insert/update용. **delete 트리거 없음** → 삭제가 번지지 않는다. ✅

**그 밖(Supabase 관리 스키마)**: `storage.objects.owner`(4번 블록이 `set null`로 고침), `storage.buckets.owner`(자동 수정 대상 아님 — 5번 NOTICE로만 보고).
`auth.identities/sessions/refresh_tokens/mfa_factors` 등은 auth 스키마 안이라 cascade로 함께 지워지는 것이 정상.

**정책·제약 이름 충돌**: 새로 만드는 이름(`app_progress_user_id_profiles_fkey`, `site_settings_singleton`,
`member_withdrawal_log_*`, 정책 `"member_withdrawal_log: 관리자만 조회"`, `"site_settings: 누구나 조회"`)은 기존 8개 파일에 없다. ✅
게이트를 다시 만드는 정책 10개는 **이름이 기존과 한 글자도 다르지 않음**을 원본과 대조해 확인했다(drop → create 짝이 맞는다). ✅
정책 본문도 원본과 한 줄씩 대조했다 — `can_browse()` 게이트를 더한 것 외에 의미 변화 없음(관리자·작성자 경로는 그대로 통과). ✅

**RLS 재귀(42P17)**: `can_browse()` → `login_required()` → `site_settings`(정책 `true`). `site_settings` 정책은 어떤 함수도 부르지 않는다. `is_admin()`은 기존과 동일. **순환 없음.** ✅
**security definer 4개**(`login_required`, `can_browse`, `admin_set_login_required`, `admin_finalize_withdrawal`) 모두 `set search_path = ''` + 완전 한정 이름. ✅
**재실행 안전성**: `add column if not exists` / `create table if not exists` / `on conflict do nothing` /
`drop policy if exists` + `create policy` / `create or replace function` / 제약은 이름으로 `drop if exists` 후 재추가, 외래키 제거는 이름을 찾아 반복 삭제. **두 번 실행해도 안전.** ✅
**`handle_new_user()` 재정의**가 `20260921010000_fixes.sql`의 개선(`left(...,50)`)을 지우지 않는지 대조 확인 — 유지된 채 `on conflict (id) do nothing`만 추가됐다. ✅

---

## 3. 발견 목록

| # | 심각도 | 파일:줄 | 내용 | 재현 | 수정 제안 |
|---|---|---|---|---|---|
| **U1** | **높음** | `src/app/admin/(dashboard)/members/member-list.tsx:172-175`, `:277-281` | 케밥(⋮) 메뉴 항목을 누르면 다이얼로그가 열린 **직후** `<tr onClick={onRowClick}>`이 함께 발동해 회원 상세로 이동한다. React 포털은 **DOM이 아니라 React 트리**로 이벤트를 올리므로 `DropdownMenuContent`의 클릭이 `<tr>`까지 도달하고, `e.target.closest("a,button,input,label")`는 `div[role="menuitem"]`을 걸러내지 못한다. **탈퇴 처리와 비밀번호 초기화(기존 기능) 모두 목록에서 사용 불가**. 모바일 카드(`<li>`)에는 onClick이 없어 정상 동작한다. | 데스크톱 폭(1280)에서 `/admin/members/` → 홍길동 행 ⋮ → "탈퇴 처리"(또는 "비밀번호 초기화") 클릭 → 2초 뒤 URL이 `?id=...`로 바뀌고 다이얼로그가 사라짐. 클릭 직후 `document.querySelector('[role=alertdialog]')`는 잠깐 존재하다가 없어진다. | `onRowClick` 가드를 넓힌다: `closest('a,button,input,label,[role="menu"],[role="menuitem"],[role="dialog"],[role="alertdialog"],[data-slot^="dropdown-menu"]')`. 또는 `MemberActions`를 `<span onClick={(e)=>e.stopPropagation()}>`로 감싼다(React 트리에서 막히므로 포털도 함께 해결). **수정 후 두 메뉴 항목을 다시 눌러 확인할 것.** |
| **S1** | 중 | `supabase/migrations/20260923010000_login_required.sql:80-81`, `:93-94` | `revoke all on function ... from public` 뒤 `anon, authenticated`에만 grant. 그런데 **`storage.objects`의 SELECT 정책(3.10)도 `can_browse()`를 부른다.** 정책은 요청 역할로 평가되므로, 스토리지 경로가 anon/authenticated가 아닌 역할(예: `service_role`이 BYPASSRLS가 아닌 구성, 대시보드 역할)로 평가되면 `permission denied for function public.can_browse()`가 나 **게임 파일 내려받기가 통째로 막힌다.** `is_admin()`은 PUBLIC 실행이 열려 있어 지금까지 이 문제가 없었다. | 실 DB가 없어 직접 재현 못 함(정적 분석). `select has_function_privilege('service_role','public.can_browse()','execute');` → false 가 나올 것. | `site_settings`는 어차피 전체 공개 읽기이므로 **두 함수는 PUBLIC 실행을 유지**해도 정보가 새지 않는다. `revoke` 줄을 지우거나, 최소한 `grant execute on function public.can_browse(), public.login_required() to service_role;`를 추가. (`admin_set_login_required`의 revoke는 그대로 두는 것이 맞다.) |
| **S3** | 중 | `supabase/migrations/20260923000000_member_withdrawal.sql:138` | 4번 DO 블록이 `con.confdeltype not in ('n','c','d')` 조건으로 **`on delete cascade`인 `storage.objects` 외래키를 자동 수정에서 제외**한다. 그 경우 계정을 지우면 업로드 게임 파일 **행이 함께 사라지고**(S3 버킷 파일은 남아 고아가 됨) `community_posts.game_path`가 끊긴다. 5번 블록이 NOTICE로 알리기는 하지만, 사용자가 로그를 놓치면 첫 탈퇴에서 바로 데이터가 사라진다. | 실 DB 미확인(Supabase 버전에 따라 `owner` 외래키가 cascade일 수 있음). | `'c'`도 대상에 넣어 `set null`로 바꾸거나(같은 블록에서 처리), 아니면 cascade가 남아 있으면 `raise exception`으로 멈추고 안내한다. 최소한 사용자에게 "Notices를 반드시 읽어야 한다"를 더 강하게 적는다. |
| **S6** | 중 | 배포 순서 | `20260923010000`만 실행하고 `20260923000000`을 건너뛴 채 push하면, `withdrawn_at`을 넣은 embed(댓글·게시판·학습 현황 등)가 42703으로 실패한다. `isMissingSchemaError`가 42703을 잡아 크래시는 없지만 화면이 **"준비 중이에요(SQL 실행 필요)"** 로 떨어진다(안내 문구는 `20260922040000_community.sql`을 가리켜 오해를 부른다). | 가짜 응답으로 `profiles?select=...withdrawn_at`에 42703을 돌려주고 확인. `/admin/`은 `use-session`의 대비 코드 덕에 정상 진입(자물쇠 방지 ✅), 나머지 화면은 안내로 떨어짐. | 순서를 지키면 문제없다. 안내 문구에 "새 SQL 파일을 실행했는지"도 함께 적으면 더 낫다(선택). |
| **U2** | 중 | `src/lib/admin.ts:118-125`, `src/app/admin/(dashboard)/learning/responses-view.tsx:120`, `src/components/learning/learning-ui.tsx:147` | **관리자 화면에서도** 이름이 항상 "탈퇴한 학생"이라, 탈퇴 학생이 2명 이상이면 **학생 응답·학습 현황·피드백 목록에서 누가 누구인지 구분할 수 없다.** 회원 관리 목록은 아이디(kim/hong) 열이 있어 구분되지만 나머지 화면은 이름뿐이다. | 가짜 데이터로 학생 2명을 탈퇴시킨 뒤 `/admin/members/` → 두 행 모두 "탈퇴한 학생"(스크린샷 확인). 학생 응답은 같은 헬퍼를 쓰므로 동일. | 관리자 전용 화면에서는 `memberRealName` + `WithdrawnBadge`를 쓰거나 `탈퇴한 학생(김철수)` 형태로 표시한다. 학생·공개 화면만 완전 익명으로 둔다. |
| **U3** | 중 | `src/components/community/community-post-detail.tsx:168`, `src/components/community/community-comment-section.tsx:270` | 자유게시판·학습게임에서 탈퇴 학생의 **이름은 "탈퇴한 학생"으로 바뀌지만 아바타 이미지(OAuth 프로필 사진)는 그대로 노출**된다. `comment-section.tsx`, `learning-ui.tsx`, `member-badges.tsx`는 `isWithdrawnProfile`로 숨기고 있어 **일관성이 깨졌고 익명화가 반쪽**이다. | 코드 경로 확인(브라우저 미확인 — 커뮤니티 목데이터 미구성). | 세 곳과 같은 패턴으로 `profile?.avatar_url && !isWithdrawnProfile(profile)` 조건을 넣는다. |
| S2 | 낮음 | `supabase/functions/admin-delete-member/index.ts:146-185` | ⑤ 계정 삭제 → ⑥ RPC 순서라, ⑥이 계속 실패하면 "로그인은 이미 불가 + 화면에는 정상 회원"인 상태가 남는다. warning + 재시도(멱등)로 완화돼 있고, 되돌릴 수 없는 순서상 ⑤를 뒤로 미룰 수도 없다. | 가짜 응답 `fnfail=warn`으로 확인 — 12초 경고 토스트가 뜬다. | 현 설계로 충분. 경고 토스트 문구에 "목록에는 아직 정상으로 보일 수 있습니다"를 덧붙이면 더 명확. |
| S4 | 낮음 | `20260923000000_member_withdrawal.sql:114` | `not valid`로 추가한 외래키는 계속 NOT VALID로 남는다(동작에는 영향 없음). 과거에 계정만 지워진 고아 행이 없다면 `alter table ... validate constraint`로 정리할 수 있다. | — | 선택 사항. 확인 쿼리에 `convalidated`를 추가해도 좋다. |
| S7 | 낮음 | `20260921000000_init_blog.sql:222`(기존) | 잠금이 켜져 있어도 `increment_post_view()`(security definer)는 비로그인에서 동작해 조회수를 올리고 값을 돌려준다. 글 내용 유출은 아니다. | — | 그대로 둬도 무방. 신경 쓰이면 함수 안에 `if not public.can_browse() then return 0;`. |
| S8 | 낮음 | `20260923010000_login_required.sql:134-232` | `can_browse()`는 SECURITY DEFINER라 인라인되지 않아 **행마다 호출**될 수 있다. 표가 작아 실사용에는 영향이 없을 것으로 본다. | — | `public.can_browse()` → `(select public.can_browse())`로 감싸면 InitPlan으로 한 번만 평가된다(Supabase RLS 성능 관용구). |
| U4 | 낮음 | `src/lib/types.ts:102` | `AUTHOR_PROFILE_COLUMNS` 를 만들어 놓고 **아무 데서도 쓰지 않는다**(embed 컬럼 목록은 파일마다 문자열로 하드코딩). 앞으로 컬럼을 추가할 때 또 빠뜨리기 쉽다. | `grep -rn AUTHOR_PROFILE_COLUMNS src/` → 정의와 주석뿐. | community.ts·comment-section.tsx 등의 `profiles(display_name,avatar_url,withdrawn_at)`를 이 상수로 바꾸거나, 상수를 지운다. |
| U5 | 낮음 | `src/lib/admin.ts:114` | `NameProfile` 이 `display_name?`·`withdrawn_at?` 둘 다 optional이라, **`withdrawn_at`을 select에 안 넣은 embed를 넘겨도 타입 오류가 안 난다** → 조용히 실명이 노출된다. | 타입 정의 확인. | `withdrawn_at: string \| null`을 필수로 만들면 누락이 컴파일 오류가 된다(U4와 함께 처리하면 안전). |
| U6 | 낮음 | `src/app/admin/(dashboard)/members/member-detail.tsx` 학습활동 탭 | 탈퇴한 학생에게도 피드백 대화에 글을 쓸 수 있다(학생은 영원히 못 읽음). 칭찬 문구도 "탈퇴한 학생"으로 치환된다(`responses-view.tsx:135`). | 코드 확인. | 피드백 입력창에 "탈퇴한 학생은 읽을 수 없습니다" 안내를 넣거나 입력을 비활성화. |

---

## 4. 자물쇠(lockout) 안전성 점검 — 지시받은 6가지

| 확인 항목 | 결과 | 근거 |
|---|---|---|
| `site_settings` SELECT는 항상 공개인가 | ✅ | 정책 `using (true)` + `grant select to anon, authenticated`(SQL 3~5줄, 54~61줄). 게이트 없음. |
| 잠금 중에도 `/login/`이 열리는가 | ✅ | `LoginGate`의 `ALWAYS_OPEN`(login-gate.tsx:13) + **브라우저 확인**: 잠금 ON·비로그인에서 `/`는 "로그인이 필요해요", `/login/`은 정상 렌더. 로그인 자체는 `signInWithId` → `supabase.auth.signInWithPassword`뿐이라 **DB 테이블을 전혀 읽지 않는다**(`src/lib/auth.ts:17-19`) → RLS와 무관. |
| 잠금 중에도 `/reset-password/`가 열리는가 | ✅ | `ALWAYS_OPEN`에 포함. 브라우저 확인 시 비로그인이라 페이지 자체 가드가 `/login/`으로 보냈다(정상). 비밀번호 변경은 `supabase.auth.updateUser`만 쓴다. |
| 관리자는 항상 통과하는가 | ✅ | 모든 게이트가 `can_browse()` = `auth.uid() is not null or not login_required()`. 관리자는 로그인 상태이므로 무조건 참. `posts`·`assignments`·`community_posts`는 `or public.is_admin()`도 남아 있다. |
| 설정을 못 읽으면 잠기지 않는가 | ✅ | SQL: `login_required()`가 `coalesce(..., false)`. 화면: `fetchLoginRequired()`가 try/catch로 false 반환(`admin.ts:376-386`), `fetchSiteSettings()`는 `SITE_SETTINGS_FALLBACK`. **브라우저 확인**: `site_settings` 테이블을 PGRST205로 없앤 상태에서 카드가 "꺼짐"으로 뜨고 사이트가 안 잠겼다. |
| 켠 뒤 다시 끌 수 있는가 | ✅ | **브라우저 확인**: 켜기는 확인 다이얼로그 경유, 끄기는 즉시 반영(비대칭 마찰 — spec §2.4 그대로). RPC 실패 시 스위치가 원위치로 돌아가고 서버의 한국어 메시지를 그대로 토스트로 보여 줬다. |
| 마이그레이션 미실행 상태에서 관리자 진입 | ✅ | `withdrawn_at` 42703을 흉내 낸 상태에서 `use-session`의 `selectProfile` 대비 코드가 컬럼을 빼고 다시 읽어 **관리자 대시보드에 정상 진입**(인사말·토글 카드 모두 정상, 콘솔 오류 0). |

**spec §2.2 정책 표 10개 체크리스트** — SQL 10개 블록을 원본과 1:1 대조해 전부 반영됨을 확인했다:
`profiles` ✅ · `posts` ✅ · `comments` ✅ · `likes` ✅ · `views` ✅ · `assignments` ✅ ·
`community_posts` ✅ · `community_comments` ✅ · `community_likes` ✅ · `storage.objects(game-uploads)` ✅.
표 밖이지만 원래 "본인/관리자만"이라 손대지 않은 것들(`member_directory`, `app_results`, `post_reads`,
`assignment_submissions`, `feedback_*`, `app_progress`, `praise_presets`, `community_reports`,
`password_reset_log`, `member_withdrawal_log`)도 하나씩 확인했다 — **비로그인 접근 경로가 원래 없다.** ✅
우회 경로로 남는 것은 S7(조회수 RPC)뿐이며 글 내용은 새지 않는다.

---

## 5. Edge Function 권한 검증

| 항목 | 결과 | 근거 |
|---|---|---|
| 호출자 JWT 검증 | ✅ 이중 | 배포 지침이 `--no-verify-jwt`를 금지(README:33,46) → 플랫폼이 1차 검증. 코드도 `authClient.auth.getUser(jwt)`로 2차 검증(index.ts:71-81). |
| 관리자만 호출 | ✅ | 서비스 롤로 `profiles.role` 조회 후 `!== 'admin'`이면 403(index.ts:88-97). 화면 가드와 별개. |
| 자기 자신 삭제 차단 | ✅ 3중 | UI `withdrawBlockReason`(admin.ts:190-193) + 함수 400(index.ts:105-107) + RPC `cannot withdraw yourself`(SQL:263-265). |
| 다른 관리자 삭제 차단 | ✅ 3중 | UI + 함수 403(index.ts:126-132) + RPC `admin accounts cannot be withdrawn`(SQL:266-268). **삭제 전에 검사**한다. |
| 마이그레이션 미실행 시 | ✅ | ④ `withdrawn_at` 컬럼 조회(42703/PGRST204)와 RPC 존재 확인(PGRST202/42883)을 **계정을 지우기 전에** 하고 거부(index.ts:109-144). |
| service_role 키 노출 | ✅ 없음 | `Deno.env.get`으로만 읽고 응답·로그에 넣지 않는다. `grep -rn service_role src/ public/ scripts/` → 주석뿐, 키 없음. |
| CORS | ✅ | 허용 출처 2개(배포 도메인·localhost:3000), `admin-reset-password`와 동일. 인증은 Authorization 헤더라 쿠키 CSRF 경로 없음. |
| 입력 검증 | ✅ | `UUID_RE`로 형식 검사 후에만 진행. |
| 멱등성 | ✅ | 이미 삭제된 계정이면 `alreadyDeleted`로 넘어가 ⑥만 다시 실행. RPC도 `withdrawn_at`이 이미 있으면 로그를 덧붙이지 않는다. |
| 오류 메시지 | ✅ | 전부 한국어. 화면(`withdrawMember`)이 본문의 `error`를 그대로 보여 준다 — 가짜 403으로 확인함. |

⚠ 한계(build-report §7 그대로, Review에서도 못 깼음): **`auth.admin.deleteUser()`를 실제로 호출하지 않았다.**
다른 외래키가 삭제를 막지 않는지는 실 DB에서 테스트 계정으로 한 번 해 봐야 확신할 수 있다(S3 참고).

---

## 6. 브라우저로 실제 확인한 것 (가짜 Supabase 응답)

포트 3219, `out/`(방금 빌드한 것), 모든 Supabase 요청을 가로채 가짜 응답. 실 DB·실 Auth 호출 0건.

| 시나리오 | 결과 |
|---|---|
| 관리자 대시보드(1280px) | 토글 카드가 개요 맨 위에 정상 렌더. 콘솔 오류 0. |
| 토글 켜기 | 확인 다이얼로그 → "켜기" → `rpc admin_set_login_required {p_value:true}` 1회 → 상태 재조회 → 성공 토스트. ✅ |
| 토글 끄기 | 확인 없이 즉시 `{p_value:false}` 호출 + 원복 토스트. ✅ |
| 토글 RPC 실패 | 스위치가 꺼짐으로 되돌아가고 서버의 한국어 메시지를 토스트로 표시. ✅ |
| 회원 목록 | "탈퇴함" 배지·이름 "탈퇴한 학생" 표시. 본인 행은 두 메뉴 항목이 이유와 함께 비활성. 이미 탈퇴한 행은 "이미 탈퇴함"으로 비활성. ✅ |
| 케밥 → 탈퇴 처리(데스크톱) | **U1 재현 — 다이얼로그가 열린 직후 회원 상세로 이동해 사라짐.** ❌ |
| 케밥 → 탈퇴 처리(375px 모바일) | 정상. 다이얼로그 유지. ✅ |
| 이름 확인 | 틀린 이름("홍길") → "탈퇴 처리" 버튼 `disabled=true`. 정확한 이름 → 활성. **실수로 발동할 수 없음.** ✅ |
| 탈퇴 실행(성공) | `POST /functions/v1/admin-delete-member {userId}` 1회 → 성공 토스트 → 목록 행이 즉시 "탈퇴한 학생 + 탈퇴함"으로 갱신. ✅ |
| 탈퇴 실행(403) | 다이얼로그가 닫히지 않고 빨간 박스에 "관리자만 사용할 수 있습니다." + 버튼이 "다시 시도"로 바뀜. ✅ |
| 회원 상세(탈퇴 회원) | 배지, "탈퇴 전 이름: 김철수", 비밀번호 "없음(계정 삭제됨)", "탈퇴 처리 2026-09-23 · 성철 선생님"(감사 로그 조인), 경고 문구, 두 작업 버튼 비활성+사유, 학습활동 탭 그대로. ✅ |
| 잠금 ON + 비로그인 | `/`·`/board/`가 "로그인이 필요해요" 안내로 바뀌고 `/login/`은 정상. ✅ |
| 마이그레이션 미실행(컬럼·표 둘 다 없음) | 관리자 진입 성공, 토글 "꺼짐", 콘솔 오류 0. ✅ |
| 375px + 다크모드 | 회원 목록·배지·케밥·탈퇴 다이얼로그 모두 정상, 가로 스크롤 없음, 터치 영역 충분. ✅ |
| 키보드 | 스위치·다이얼로그 버튼 포커스 가능, 처리 중에는 Esc·바깥 클릭으로 닫히지 않음(코드 `if (!next && busy) return`). 케밥 메뉴의 화살표 이동은 매번 안정적으로 동작하지는 않았다(U1과 별개인지 확인 못 함). |

**코드 검증**: `npx tsc --noEmit` 오류 0 / `npm run lint` 오류 0 / `npm run build` 성공(22개 라우트 전부 Static, 서버 기능 없음). build-report §4.1과 일치.

---

## 7. 회귀(기존 기능) 점검

| 기능 | 결과 |
|---|---|
| 관리자 개요·회원 관리·회원 상세 | ✅ 정상(가짜 응답 기준). 토글 카드가 추가됐을 뿐 기존 레이아웃 유지. |
| **비밀번호 초기화(목록에서)** | ❌ **U1로 깨짐** — 케밥으로 옮기면서 회귀. 회원 상세의 버튼은 정상(별도 경로). |
| 로그인 화면·OAuth 버튼 | ✅ 정상, DB 접근 없음. |
| 학습 현황·학생 응답·과제 제출·피드백 | 코드 경로만 확인. 모든 `profiles(...)` embed에 `withdrawn_at`이 추가됐고 타입·빌드 통과. 실제 렌더는 확인 못 함(목데이터 미구성). |
| 커뮤니티(자유게시판·학습게임) | 작성자 이름은 `authorName()` 한 곳으로 모여 있어 반영됨. **아바타는 U3로 미반영.** 업로드 게임 실행(샌드박스) 로직은 손대지 않았다. |
| 과학 차시 앱(`/apps/**`) | 변경 없음(diff에 파일 없음). 원래 로그인 필수라 토글 영향 없음. `app_progress` 외래키가 `profiles`로 바뀌어도 정책(`auth.uid() = user_id`)·앱 코드는 그대로 동작한다. **실 DB 확인은 못 함.** |
| `src/app/layout.tsx` | `LoginGate`가 `<main>` 안쪽만 감싸므로 상단바·사이드바·푸터는 그대로. 잠금이 꺼져 있으면 `children`을 그대로 렌더(추가 지연 없음). ✅ |

---

## 8. 확인한 것 vs 확인하지 못한 것

### 확인한 것
* 마이그레이션 2개의 문법·재실행 안전성·이름 충돌·권한·재귀·정책 10개 본문 대조(§2) — **정적 분석으로 전수**
* `auth.users`/`profiles`를 참조하는 외래키 전수 재조사(build-report를 믿지 않고 직접) — 결과 일치
* Edge Function의 권한 검사 순서와 3중 차단, 마이그레이션 미실행 시 거부, 키 미노출
* 자물쇠 방지 6가지 + 마이그레이션 미실행 상태의 관리자 진입(브라우저)
* 토글 켜기/끄기/실패, 탈퇴 다이얼로그 이름 확인·성공·403, 탈퇴 회원의 목록·상세 표시(브라우저)
* 375px·다크모드·콘솔 오류 0, tsc/lint/build

### 확인하지 못한 것 (사용자·실 DB 필요)
1. **실제 계정 삭제**(`auth.admin.deleteUser`)가 다른 외래키에 막히지 않는지 — 특히 `storage.objects.owner`/`storage.buckets.owner`. **테스트 학생 계정 1개로 반드시 먼저 해 볼 것.**
2. **RLS 게이트의 실제 차단** — 잠금을 켠 뒤 시크릿 창으로 글·게시판·게임 파일(`game-uploads` 내려받기)이 정말 막히는지. S1이 현실화되면 **잠금을 끈 상태에서도** 게임 파일이 막힐 수 있으니, 토글을 켜기 전에 게임 1개를 열어 확인할 것.
3. **탈퇴 직후 학생 기기** — access token 만료(기본 1시간)까지의 공백, 그 사이 `sci6…` 로컬 정리가 언제 일어나는지(spec §1.4의 미해결 항목 그대로).
4. **커뮤니티·학습 화면의 실제 렌더**(목데이터를 만들지 않음) — U3 외의 표시 누락이 더 있을 수 있다.
5. 같은 이메일로 계정을 다시 만들었을 때의 회원 목록 모습(옛 "탈퇴한 학생" 행 + 새 행이 함께 보인다 — build-report §8대로 의도된 동작).

---

## 9. 권고 순서

1. **U1 수정**(필수 — 기능이 목록에서 아예 안 된다) → 데스크톱에서 두 메뉴 항목 재확인.
2. **S1, S3 SQL 보완**(실행 전이므로 같은 파일 수정) → 사용자에게 실행 요청.
3. U2·U3는 사용자와 상의해 이번에 함께 고칠지 결정(관리자 식별 편의 / 아바타 익명화).
4. U4·U5·U6·S2·S4·S7·S8은 후속 작업으로 미뤄도 무방.
5. SQL 1 → 확인 → SQL 2 → 확인 → Edge Function 배포 → **그다음에** push.
