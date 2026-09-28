# 구글·깃허브(OAuth) 계정 완전 삭제 + 같은 계정 재가입 설계 (spec)

> Plan 단계 산출물. **구현하지 않음.** 이 문서는 승인용이며, 사용자가 §7의 질문에 답하고 승인하면 Build 서브에이전트가 이 문서를 기준으로 작업한다.
> 요청 원문: "구글/깃허브 계정으로 로그인한 경우에는 관리자가 탈퇴를 시키면 완전히 삭제되어서 정보가 대시보드에 남아 있지 않도록 탈퇴되도록 변경해줘. … 원할 경우 같은 구글/깃허브 계정으로 다시 가입도 가능하게 해줘."
> 조사 범위: `CLAUDE.md`·`docs/STATUS.md`, `supabase/migrations/*.sql` 18개 전부(특히 `20260921000000`·`20260921020000`·`20260922000000_admin_learning_fixes`·`20260922020000`·`20260922040000`·`20260923000000`·`20260923030000`·`20260927000000`·`20260927010000`·`20260927020000`·`20260927030000`·`20260927040000`), `supabase/functions/admin-delete-member/index.ts`·`admin-create-member/index.ts`, `src/lib/admin.ts`·`auth.ts`·`types.ts`·`community.ts`, `src/components/admin/member-badges.tsx`·`member-withdraw-dialog.tsx`, `src/app/admin/(dashboard)/members/member-list.tsx`, `src/lib/danger-button.ts`, `docs/admin/admin-tools/spec.md`, `docs/classes/spec.md`(개정 1), `node_modules/@supabase/auth-js`의 `deleteUser` 타입 선언. 실 DB는 읽지도 쓰지도 않았다 — 모든 서술은 저장소에 있는 SQL·코드 근거다. 개인정보(이메일·학생 이름)는 이 문서 어디에도 실제 값을 적지 않았다.

---

## 0. 요약

1. **오늘 탈퇴(`admin-delete-member`)는 `auth.users` 행만 지운다.** `profiles`가 `auth.users`를 더 이상 참조하지 않아(FK 제거, `20260923000000_member_withdrawal.sql`) 계정을 지워도 `profiles`·`member_directory`와 그 아래 모든 학습·커뮤니티 기록은 100% 그대로 남고, 이름만 "탈퇴한 학생"으로 바뀐다. **구글·깃허브 계정도 이 규칙을 그대로 따른다** — 지금은 OAuth 계정과 아이디 계정을 구분하지 않는다.
2. **"같은 계정으로 다시 가입"은 사실 이미 된다(핵심 발견).** 탈퇴로 `auth.users`(및 연결된 `auth.identities`)가 하드 삭제되므로, 같은 구글·깃허브 계정으로 다시 로그인하면 Supabase Auth가 **완전히 새 uuid로 새 계정**을 만든다 — `profiles.id`엔 유일 제약(PK)만 있고 옛 행과 충돌할 id가 아니라서 가입이 막히지 않는다. 즉 이번 작업에서 "재가입"을 위해 **새 SQL은 필요 없다**(실 API로 검증은 못 했음 — §6 시험 계획).
3. **진짜 바뀌어야 할 것은 "정보가 대시보드에 남지 않게"다.** 옛(탈퇴된) `profiles`/`member_directory` 행이 영구히 남아 "탈퇴한 학생(OOO)"으로 계속 보이는 것과, 감사 로그 2곳(`member_withdrawal_log`·`member_create_log`)이 이름·이메일을 **텍스트로 스냅샷 저장**해 그대로 노출되는 것이 문제다. 이건 새 기능(완전 삭제)이 필요하다.
4. **좋은 소식: 기존 외래키 설계 덕분에 프로필 행 하나만 지우면 학생 개인 기록 11개 표가 자동으로 정리된다**(이미 `cascade`로 설계돼 있었다 — §3.1). 새로 처리할 것은 이름을 텍스트로 저장하는 감사 로그 2~3곳뿐이다.
5. **추천**: OAuth 전용 계정만 대상으로 하는 새 Edge Function(`admin-purge-oauth-member`)과 새 DB 함수(`admin_purge_oauth_member`)를 추가하고, **총괄만** 실행 가능하게 한다(담임 불가 — OAuth 가입 계정은 학급이 없어 기존 `teaches_student()`가 애초에 담임을 통과시키지 못한다). 회원 목록의 "탈퇴 처리" 메뉴는 OAuth 전용 계정에서는 "완전 삭제"로 **바뀐다**(추가가 아니라 대체 — §3.5, §7 Q6).

**끝에 "사용자 승인 전" 표시.**

---

## 1. 지금 상태 정리

### 1.1 탈퇴(`admin-delete-member`)가 지금 하는 일

`supabase/functions/admin-delete-member/index.ts`의 순서(주석 1~21행, 로직 85~270행): ① 호출자 확인 → ② 관리자·총괄 확인 → ③ 대상 확인(관리자면 거부) → ③-2 담임/총괄 권한 확인 → ④ 안전장치 확인(`withdrawal_blocking_fks()`) → **⑤ `admin.auth.admin.deleteUser(targetId)`로 `auth.users` 삭제** → ⑥ `admin_finalize_withdrawal` RPC로 `profiles.withdrawn_at` 채우고 `member_withdrawal_log`에 1행 기록.

`profiles`는 더 이상 `auth.users`를 FK로 참조하지 않는다(`20260923000000_member_withdrawal.sql` 72~91행이 그 FK를 찾아서 지움). 즉 **⑤는 `profiles`나 그 아래 표에 어떤 연쇄 효과도 일으키지 않는다** — `profiles` 행, 그리고 `profiles.id`를 참조하는 모든 표(`comments`·`likes`·`app_results`·`app_progress`·`post_reads`·`assignment_submissions`·`feedback_*`·`community_*`·`member_directory`·`class_teachers` 등)는 **하나도 지워지지 않고 그대로 남는다.** 바뀌는 것은 `profiles.withdrawn_at`(시각 채움)뿐이다.

이 동작은 구글·깃허브 계정이든 아이디 계정이든 **완전히 동일**하다 — 함수 코드 어디에도 `provider`를 확인하는 분기가 없다(파일 전체 확인).

### 1.2 대시보드에 "탈퇴한 학생"이 남는 곳

`src/lib/admin.ts` 133~180행의 `profileDisplayName()`/`adminDisplayName()`/`isWithdrawnMember()` 헬퍼가 `profiles.withdrawn_at`을 보고 이름을 가린다. 이 헬퍼를 쓰는 화면 전부에서 탈퇴한 계정의 **흔적(행 자체)** 은 남는다:
- 회원 관리 목록·상세(`member-list.tsx`·`member-detail.tsx`) — "탈퇴함" 배지(`member-badges.tsx` 20~26행)와 함께 행이 계속 보인다.
- 학습 현황·학생 응답(`app_results`·`assignment_submissions`·피드백 대화) — 기록이 전부 그대로 보인다(설계 의도 그대로, `docs/admin/admin-tools/spec.md` 개정 1).
- 댓글·게시판·학습게임 작성자 표시 — "탈퇴한 학생"으로.
- **감사 로그 2곳은 이름을 텍스트로 스냅샷 저장한다**: `member_withdrawal_log.target_name`/`target_email`(`20260923000000_member_withdrawal.sql` 246~253행), `member_create_log.target_email`(`20260923030000_member_create_log.sql` 37~46행, `actor_name`도 스냅샷). `profiles`가 살아있든 지워지든 이 텍스트는 그대로 남는다 — **`profiles`를 나중에 지워도 이 두 표의 이름·이메일 텍스트는 안 지워진다.**
- `password_reset_log`는 이름 스냅샷이 없다(`target_id uuid not null`만, `20260922000000_admin_learning_fixes.sql` 102~108행). 하지만 `can_manage_member(target_id)` 정책(`20260927010000_classes_rls.sql` 307~313행)은 `is_super_admin() or teaches_student(target_id)`인데, **`is_super_admin()`은 대상 프로필 존재 여부와 무관하게 호출자 자신의 상태만 본다** — 즉 프로필을 지워도 총괄에게는 이 로그의 "행 자체"(이름 없이 uuid만)가 계속 보인다.

### 1.3 같은 구글·깃허브 계정으로 다시 로그인하면? (핵심 발견, §0.2와 동일)

**확인한 사실(코드 근거)**:
- `profiles.id`는 PK일 뿐 더는 `auth.users`를 FK로 참조하지 않는다(§1.1). `handle_new_user()`의 최신 버전(`20260923000000_member_withdrawal.sql` 222~238행)은 `insert … on conflict (id) do nothing`으로 방어돼 있지만, 이 방어는 **같은 id가 재사용될 때만** 의미가 있다.
- Supabase Auth(GoTrue)가 OAuth 로그인 때 만드는 `auth.users.id`는 매번 새로 발급되는 uuid다 — 탈퇴로 지워진 계정과 같은 구글/깃허브 계정이 다시 로그인해도, 예전 `auth.identities`(provider+provider_id 연결)가 이미 지워졌으므로 GoTrue는 "처음 보는 사용자"로 판단해 **완전히 새 `auth.users` id**를 만든다.
- `admin.auth.admin.deleteUser(targetId)`는 두 번째 인자(`shouldSoftDelete`)를 주지 않으므로 **하드 삭제**다(`node_modules/@supabase/auth-js/dist/main/GoTrueAdminApi.d.ts` 582행 "If true, then the user will be soft-deleted" — 기본값은 false, 즉 완전 삭제). 하드 삭제는 `auth.identities`도 함께 사라지게 하는 것이 Supabase Auth의 표준 동작이다(스키마가 `auth` 소유라 이 저장소에서 직접 확인은 못 함 — 아래 "확인 못한 것").
- 그러므로 **새 `auth.users` id로 `handle_new_user()`가 실행되면 `on conflict`에 걸릴 옛 행이 없어 새 `profiles` 행이 정상적으로 만들어진다.** `role`은 기본값 `'user'`, `class_id`는 비어 있음(`is_super_admin` 기본 `false`) — 완전히 새 계정, 새 학생처럼 시작한다.

**결론**: **"같은 계정으로 재가입"은 오늘도 막혀 있지 않다.** 막혀 있는(=사용자가 원하지 않는) 것은 "옛 계정의 흔적이 대시보드에 남는다"는 쪽이다. 이번 작업이 실제로 풀어야 하는 문제는 §0.3~§0.4다.

**확인 못한 것(Review에서 실 계정으로 반드시 검증)**: `deleteUser`가 실제로 `auth.identities`를 완전히 지우는지, 지워진 뒤 같은 구글/깃허브 계정으로 즉시 재로그인이 실제로 성공하는지, GoTrue가 "최근에 삭제된 이메일"을 잠깐 쿨다운시키는 정책이 있는지(문서·코드로는 그런 로직을 찾지 못했다).

### 1.4 이미 탈퇴시킨 OAuth 계정은?

지금까지 관리자가 OAuth 계정을 탈퇴 처리한 적이 있다면, 그 `profiles`/`member_directory` 행은 이번 설계를 적용해도 **자동으로는 지워지지 않는다**(새 기능은 "앞으로"의 탈퇴 처리를 완전 삭제로 바꿀 뿐, 과거 행을 소급 처리하지 않는다). 과거분을 정리하려면 총괄이 회원 목록에서 그 행을 찾아 새 "완전 삭제" 버튼을 한 번 더 눌러야 한다 — §7 Q7.

---

## 2. OAuth 계정 알아보기

### 2.1 이미 있는 판별 수단 — 새로 만들 것이 거의 없다

`sync_member_directory()`(`20260921020000_admin_learning.sql` 56~92행)가 `auth.users.raw_app_meta_data`의 `provider`/`providers`를 이미 `member_directory.provider`/`providers`(text[])에 동기화해 두고 있다. `src/lib/admin.ts`에 이미:
- `memberProviders(member)`(189~196행) — 연결된 가입 방식 목록.
- `canResetPassword(member)`(199~201행) — `providers`에 `"email"`이 있는지. **이 함수의 반대(`!canResetPassword(member)`)가 정확히 "OAuth 전용 계정"의 정의다** — 이미 있는 로직을 그대로 재사용하면 된다. 새 DB 컬럼도, 새 판별 함수도 필요 없다.
- `providerLabel()`(182~186행) — `{ email: "아이디", github: "GitHub", google: "Google" }`.

계정 생성 경로도 명확히 분리돼 있다: `admin-create-member`(`supabase/functions/admin-create-member/index.ts`)는 **이메일/비밀번호로만** 계정을 만든다(`auth.admin.createUser({ email, password, … })`, 341~346행) — OAuth 계정은 이 함수를 절대 거치지 않고, 학생이 로그인 화면에서 "Google로 로그인"을 눌렀을 때 `src/lib/auth.ts`의 `signInWithOAuth()`(39~57행)가 Supabase Auth로 직접 리다이렉트해서 생긴다. 두 경로는 코드 상 완전히 분리돼 있다.

### 2.2 섞인 계정(아이디 계정에 OAuth가 연결된 경우)

저장소 전체에서 `linkIdentity`/계정 연결 UI를 검색했으나 **찾지 못했다** — 이 사이트에는 "기존 로그인에 다른 방식 추가 연결" 기능이 없다. 이론적으로 Supabase가 이메일이 같으면 자동으로 계정을 합치는 설정이 켜져 있을 수 있지만, 아이디 계정의 이메일은 항상 `{아이디}@class1.local`(`src/lib/auth.ts` 7~13행) 형식이라 **실제 구글/깃허브 이메일과 우연히 같을 수가 없다** — 즉 실질적으로 섞인 계정은 생기지 않는다고 봐도 된다.

그래도 안전하게: **"완전 삭제" 대상 여부는 반드시 `!canResetPassword(member)`(providers에 `"email"`이 전혀 없음)로만 판단**한다. 혹시라도 `providers`에 `"email"`이 하나라도 섞여 있으면(아이디 계정이거나, 아이디 계정+OAuth 연결) 완전 삭제 메뉴 자체를 보여주지 않고 지금처럼 "탈퇴 처리"만 제공한다 — 기존 로직을 그대로 게이트로 쓰므로 새 판별 버그가 생길 여지가 없다.

### 2.3 화면에 로그인 방식 표시 — 이미 되어 있다

`ProviderBadges`(`src/components/admin/member-badges.tsx` 30~42행)가 **이미** `admin-overview.tsx`(157행)·`member-list.tsx`(494행·571행, 데스크톱/모바일 두 레이아웃)·`member-detail.tsx`(197행) 세 화면 모두에 배지로 표시 중이다. **이 부분은 손댈 것이 없다.**

---

## 3. 완전 삭제 설계

### 3.1 핵심 통찰 — 프로필 행 하나만 지우면 대부분 자동으로 정리된다

기존 마이그레이션들을 표 단위로 직접 읽어 확인한 결과, **`profiles` 행을 `delete`하면 이미 걸려 있는 외래키 설계 덕분에 아래처럼 자동으로 정리된다** — 새 삭제 로직을 표마다 따로 안 만들어도 된다.

| 자동 정리 방식 | 표 | 근거(파일:행) |
|---|---|---|
| **cascade(행이 함께 삭제됨)** | `comments`, `likes` | `20260921000000_init_blog.sql` 136행, 181행 |
| 〃 | `app_results` | `20260921020000_admin_learning.sql` 138행 |
| 〃 | `post_reads` | 같은 파일 176행 |
| 〃 | `assignment_submissions` | 같은 파일 254행 |
| 〃 | `feedback_threads`(→ 아래로 다시 cascade) | 같은 파일 364행 |
| 〃 | `feedback_messages`(`thread_id`·`sender_id` 둘 다) | 같은 파일 395행, 396행 |
| 〃 | `feedback_read_marks`(`thread_id`·`user_id` 둘 다) | 같은 파일 428행, 429행 |
| 〃 | `member_directory`(PK 자체가 `profiles(id)` 참조) | 같은 파일 36행 |
| 〃 | `app_progress` | `20260923000000_member_withdrawal.sql` 116~119행(원래 `auth.users` 참조였다가 이번에 `profiles` 참조로 옮겨졌다) |
| 〃 | `community_comments`, `community_likes` | `20260922040000_community.sql` 176행, 277행 |
| 〃 | `community_reports.reporter_id`(신고한 기록) | 같은 파일 326행 |
| 〃 | `class_teachers.teacher_id`(담임 연결) | `20260927000000_classes_schema.sql` 75행 |
| **set null(글은 남고 작성자만 비워짐)** | `posts.author_id` | `20260921000000_init_blog.sql` 100행 |
| 〃 | `assignments.created_by` | `20260921020000_admin_learning.sql` 227행(이후 마이그레이션도 이 FK는 바꾸지 않음 — 컬럼 권한만 잠금) |
| 〃 | `class_notices.author_id` | `20260927020000_class_notices.sql` 165행 |
| 〃 | `community_posts.author_id` | `20260922040000_community.sql` 41행 |
| 〃 | `community_reports.target_author_id` | 같은 파일 333행 |
| 〃 | `praise_presets.created_by` | `20260922020000_praise_presets.sql` 26행 |
| **처리 안 됨(FK 없음 — 직접 지워야 함)** | `member_withdrawal_log`(이름·이메일 텍스트 저장), `member_create_log`(이름·이메일 텍스트 저장), `password_reset_log`(uuid만) | 의도적으로 FK가 없다(탈퇴해도 감사 기록은 남으라고 설계됨) — §3.3 |

즉 **새로 만들 삭제 로직은 사실상 "감사 로그 3곳 정리 + `profiles` 한 줄 delete" 두 가지뿐**이다. `member_directory`·학생 개인 기록·담임 연결은 저절로 사라지고, 블로그 글·과제·학급 공지·커뮤니티 글은 "익명"으로 남는다(§3.9에서 이 부분을 지울지 남길지 결정).

### 3.2 부작용 — 알아 둘 것

- `assignments`/`posts`는 `created_by`/`author_id`가 컬럼 권한으로 **아무도(총괄 포함) 고칠 수 없게** 잠겨 있다(`20260927030000_content_owner_only.sql` 261~349행). 즉 삭제로 `created_by`가 null이 되면 **그 글·과제는 영구히 주인 없는 상태가 되고, 이후로는 총괄만**(정책의 `created_by = auth.uid() or is_super_admin()`에서 `is_super_admin()` 경로로) 고치거나 지울 수 있다. 데이터 손실은 아니지만 "주인이 없어짐"은 되돌릴 수 없다.
- `feedback_messages.sender_id`도 cascade다 — **교사(`role='admin'`) 계정을 지우면 그 교사가 그동안 보낸 모든 학생에게의 피드백·칭찬 메시지가 전부 함께 지워진다**(자기 스레드가 아니라 상대 스레드에 보낸 메시지까지). 학생 쪽에서 보면 "선생님 답장이 사라짐"이 된다 — 교사 계정 삭제가 훨씬 파장이 큰 이유다(§3.4).
- `class_teachers`가 cascade라서, 담임인 채로 profiles를 그냥 지우면 `admin_set_role()`의 "학생이 있는 학급을 혼자 맡고 있으면 해제 거부"(`20260927010000_classes_rls.sql` 607~622행) 같은 안전장치를 **거치지 않고** 그 학급이 조용히 담임 없는 상태가 될 수 있다 — §3.4에서 이 안전장치를 재사용하도록 설계한다.

### 3.3 감사 로그 3곳 처리

`member_withdrawal_log`·`member_create_log`는 이름·이메일을 텍스트로 저장하므로(§1.2) **행 자체를 지워야** 대시보드에서 이름이 사라진다. `password_reset_log`는 이름은 없지만 총괄에게 계속 "행"이 보이므로(§1.2) 같이 지우는 쪽을 추천한다 — 세 표 모두 `target_id`에 FK가 없어(의도적 설계) 서비스 롤 RPC가 명시적으로 `delete … where target_id = p_target`을 해야 한다.

이 세 표를 지우면 "그 계정에 대한 관리 이력 자체가 없어진다"는 뜻이다 — 완전 삭제의 취지("정보가 대시보드에 남아 있지 않도록")와는 맞지만, "총괄이 나중에 감사용으로 이 계정을 삭제한 사실 자체는 남기고 싶다"는 요구가 있다면 다른 설계가 필요하다(§7 Q3).

### 3.4 교사(`role='admin'`) 계정

요청에 "교사들 중 구글 계정 로그인했으나 탈퇴 원할 경우"가 명시돼 있다. 지금 `admin-delete-member`는 대상이 관리자면 무조건 거부한다(158~164행) — 이 규칙 자체는 유지해야 한다(관리자 계정을 실수로/악의적으로 지우는 사고 방지).

| 안 | 내용 | 평가 |
|---|---|---|
| **A. 선(先) 담임 해제 요구(추천)** | 완전 삭제 전에 총괄이 먼저 기존 "담임 해제" 기능(`admin_set_role(p_user,'user')`)을 눌러야 한다. 이 함수는 이미 "학생이 있는 학급을 혼자 맡고 있으면 거부"(§3.2) 안전장치를 갖고 있다. 해제되면 `role='user'`가 되어 일반 완전 삭제 대상이 된다. | 새 안전장치를 만들 필요가 없다(기존 걸 그대로 재사용). 관리자에게 "먼저 담임 해제"라는 한 단계가 더 생기지만, 현재도 "탈퇴 처리"가 관리자 대상을 거부하며 똑같은 문구로 안내하고 있어(`withdrawBlockReason()` 242~246행) 관리자에게 익숙한 패턴이다. |
| B. 완전 삭제 함수가 직접 학급 안전장치까지 검사 | 새 함수 안에 "이 교사가 유일한 담임인 학급이 있는지" 검사를 중복 구현 | 안전장치 코드가 두 곳(A의 기존 함수, 새 함수)에 생겨 한쪽만 고치면 어긋날 위험 |
| C. 제한 없이 cascade로 지움 | `class_teachers` cascade에 맡김 | §3.2에서 지적한 "학급이 조용히 담임 없는 상태가 되는" 위험을 그대로 안음 — 비추천 |

**추천: A.** 완전 삭제 대상은 **`role='user'`인 OAuth 계정만**으로 한정하고, 관리자(교사) 계정은 "총괄이 먼저 담임 해제 → 완전 삭제"의 두 단계로 안내한다. 다이얼로그의 "막힌 이유" 표시(`withdrawBlockReason` 패턴)를 그대로 재사용해 "교사(관리자) 계정은 완전 삭제할 수 없습니다. 먼저 담임 해제를 해 주세요" 같은 문구를 보여준다.

### 3.5 누가 할 수 있나 — 총괄만(코드로 뒷받침되는 결론)

`docs/classes/spec.md` 개정 1은 비밀번호 초기화·탈퇴는 "담임(자기 반) + 총괄(모든 반)"이라고 정했다(개정 1-1 표). 하지만 **OAuth 자동 가입 계정은 `class_id`가 항상 null이다** — `handle_new_user()`는 `class_id`를 설정하지 않고(§1.3), `admin-create-member`만 계정 생성 시점에 `class_id`를 채운다(OAuth는 이 함수를 거치지 않음, §2.1).

`teaches_student(p_student)`(`20260927000000_classes_schema.sql` 174~194행)는 `profiles s join class_teachers ct on ct.class_id = s.class_id`로 매칭한다 — **`s.class_id`가 null이면 SQL의 null 비교 규칙상 어떤 `ct.class_id`와도 절대 매칭되지 않는다.** 즉 **지금 코드 그대로도 담임은 OAuth 계정에 대해 `teaches_student()`가 항상 false**라, 기존 권한 체계상 OAuth 계정은 애초에 담임의 관리 대상이 될 수 없다.

**추천**: 완전 삭제는 **총괄만**(`is_super_admin() === true`) 실행 가능하게 한다. 이유: (1) 기존 권한 구조와 자연스럽게 맞아떨어진다(새 예외를 만들 필요가 없다), (2) OAuth 가입은 "실수로 가입" 같은 드문 정리 작업이라 굳이 담임까지 권한을 넓힐 실익이 적다, (3) 파장이 가장 큰 동작(학습 기록까지 실제로 지움)은 좁게 여는 편이 안전하다.

### 3.6 같은 계정 재가입 — 필요한 SQL

**결론: 새 SQL이 필요 없다**(§1.3). 완전 삭제로 `profiles` 행까지 지우면 `member_directory`도 함께 사라지므로(cascade), 재가입 시 만들어지는 새 `profiles`/`member_directory` 행과 **부딪힐 옛 행 자체가 없다.** 확인 방법은 §6 시험 계획.

### 3.7 되돌릴 수 없음 확인 절차

기존 `MemberWithdrawDialog`(`src/components/admin/member-withdraw-dialog.tsx`)의 "이름을 그대로 입력해야 버튼이 켜진다" 패턴(52~54행, 113~125행)을 그대로 재사용하되, 설명 문구를 완전 삭제에 맞게 고친다:
- 기존 문구(100~101행) "작성한 글·댓글·학습 기록은 그대로 남고 이름만 '탈퇴한 학생'으로 보입니다"는 **완전 삭제에는 거짓**이 되므로 반드시 새 문구로 바꿔야 한다(예: "이 계정이 남긴 학습 기록·댓글·좋아요가 모두 함께 삭제됩니다. 되돌릴 수 없습니다").
- 진한 빨강 확인 버튼(`dangerSolidClass`, `src/lib/danger-button.ts`)은 그대로 재사용.
- 새 컴포넌트로 분리할지, 기존 다이얼로그에 분기(`purge?: boolean`)를 추가할지는 §4.3에서 다룬다(추천: 분리).

### 3.8 Storage(업로드 게임 파일)

기존 탈퇴 설계는 "학습 기록을 남긴다"는 원칙이라 `game-uploads` 버킷 파일을 지우지 않기로 했다(`docs/admin/admin-tools/spec.md` §1.5 마지막 항목, `20260923000000_member_withdrawal.sql` §4가 `owner`만 `set null`로 바꿔 파일 행은 보존). **완전 삭제는 전제가 다르다**(기록을 안 남기는 것이 목적) — 이 학생이 올린 게임 파일이 있다면 실제로 지울지 결정이 필요하다. §3.9와 연결된 문제라 §7 Q4로 넘긴다.

### 3.9 커뮤니티 콘텐츠(자유게시판·학습게임)를 지울지 남길지

§3.1에 따르면 기본 동작은 "글은 남고 작성자만 `null`(→ 화면엔 '익명', `src/lib/community.ts` 105행)"이다. 두 가지 선택지:

| 안 | 내용 | 평가 |
|---|---|---|
| **A. 그대로 둠(추천, 기본값)** | 추가 코드 없이 §3.1의 `set null` 동작만 적용 — 글·댓글 내용은 남되 작성자 표시만 "익명" | 이미 개인정보(이름·계정)는 전혀 안 남는다(익명 표시는 이름이 아니라 "작성자 없음"과 같은 뜻). 구현 비용 0. 다만 게시글 본문에 학생이 스스로 적어 넣은 개인정보(실명 등)가 있었다면 그건 그대로 남는다 |
| B. 작성한 글·댓글·좋아요·신고까지 실제로 지움 | `profiles` 삭제 **전에** `delete from community_posts where author_id = p_target`(+ Storage 파일도 지움) 먼저 실행 | "정보가 대시보드에 남지 않는다"는 요구에 가장 충실. 다만 그 글에 달린 다른 학생의 댓글·좋아요까지 연쇄로 사라지고(게시글이 cascade 대상이면), 이미 만들어진 커뮤니티 상호작용(다른 학생의 참여 흔적)까지 지워버리는 부작용이 있다 |

**추천: A.** OAuth로 "실수로 가입"하거나 잠깐 써 본 교사 계정이 활발한 커뮤니티 활동(자유게시판 글, 학습게임 업로드)을 남겼을 가능성은 낮고, A는 이미 있는 FK만으로 개인정보(이름·계정 연결)를 완전히 제거한다. 다만 실제로 남은 콘텐츠가 있는지, 있다면 그 내용까지 지우고 싶은지는 사용자가 정할 문제라 §7 Q4로 남긴다.

---

## 4. 바꿀 것 목록

### 4.1 새 마이그레이션 — `supabase/migrations/20260928000000_oauth_purge.sql`(제안, 재실행 안전)

```sql
-- 새 함수: OAuth 전용 계정 완전 삭제(서비스 롤 전용) — admin_finalize_withdrawal과 같은 패턴
create or replace function public.admin_purge_oauth_member(p_target uuid, p_actor uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
begin
  if p_target is null or p_actor is null then
    raise exception 'missing arguments';
  end if;
  -- 총괄만(§3.5) — is_admin()이 아니라 is_super_admin 컬럼을 직접 확인(서비스 롤 호출이라 auth.uid() 없음).
  if not exists (
    select 1 from public.profiles where id = p_actor and role = 'admin' and is_super_admin
  ) then
    raise exception 'actor is not a super admin';
  end if;
  if p_target = p_actor then
    raise exception 'cannot purge yourself';
  end if;

  select role into v_role from public.profiles where id = p_target;
  if v_role is null then
    return; -- 이미 지워짐(재시도) — 조용히 통과, 감사 로그는 이미 아래에서 지워졌을 것
  end if;
  if v_role = 'admin' then
    raise exception 'admin accounts cannot be purged directly'; -- 먼저 담임 해제(§3.4 안 A)
  end if;

  -- 이름·이메일을 텍스트로 저장하는 감사 로그부터 정리(FK가 없어 cascade되지 않는다 — §3.3).
  delete from public.member_withdrawal_log where target_id = p_target;
  delete from public.member_create_log     where target_id = p_target;
  delete from public.password_reset_log    where target_id = p_target;

  -- profiles 삭제 — §3.1 표의 cascade/set null이 나머지를 자동으로 정리한다.
  delete from public.profiles where id = p_target;
end;
$$;

revoke all on function public.admin_purge_oauth_member(uuid, uuid) from public, anon, authenticated;
grant execute on function public.admin_purge_oauth_member(uuid, uuid) to service_role;
```

Build 단계에서 실제로 작성할 때 반드시 넣을 것: 파일 상단에 실행 방법·확인 쿼리(예: `select count(*) from public.profiles where id = '<지운 id>';`가 0인지, `select public.admin_purge_oauth_member(...)`를 SQL Editor에서 직접 호출하지 말라는 경고 — `auth.uid()`가 없어 "총괄 확인"에 걸린다는 점을 다른 정본들처럼 명시), §3.9에서 B안을 선택하면 커뮤니티 삭제 블록 추가.

### 4.2 Edge Function — 넓히기 vs 새로 만들기

| 안 | 내용 | 평가 |
|---|---|---|
| A. `admin-delete-member`를 확장(`{ userId, purge?: boolean }`) | 기존 호출자 인증 코드를 재사용 | 한 함수가 "기록 보존 탈퇴"와 "완전 삭제"라는 **파장이 전혀 다른 두 동작**을 플래그 하나로 가른다 — 클라이언트 버그나 오타로 `purge:true`가 잘못 붙으면 되돌릴 수 없는 삭제가 조용히 실행될 위험이 있다 |
| **B. 새 함수 `admin-purge-oauth-member`(추천)** | 완전 삭제 전용. 호출자 인증 로직은 `admin-delete-member`와 거의 같아 복사해서 시작 | 이름 자체가 "OAuth 전용 완전 삭제"임을 드러내 실수 위험이 작다. Supabase 함수 로그도 분리돼 사고 시 추적이 쉽다. 배포 스텝이 하나 늘지만(사용자가 `npx supabase functions deploy admin-purge-oauth-member` 한 번 더 실행) 이 저장소는 이미 함수 4개를 각자 배포하는 절차에 익숙하다 |

**추천: B.** CLAUDE.md의 "지금 함수: admin-reset-password, admin-delete-member, admin-create-member, check-answer" 문구를 5번째 함수로 갱신해야 한다(§4.4).

새 함수 순서: ① 호출자 확인(JWT) → ② **총괄 확인**(service role로 `profiles.role='admin' and is_super_admin` 확인 — 담임이면 즉시 403) → ③ 대상 확인(`profiles` 존재, `role<>'admin'`, **`member_directory.providers`에 `"email"`이 없는지** 확인 — 하나라도 있으면 400 "이 계정은 아이디 로그인이 가능합니다. 완전 삭제 대신 '탈퇴 처리'를 이용하세요") → ④ 마이그레이션 확인(RPC 존재 프로브, `admin-delete-member` 188~198행과 같은 패턴) → **⑤ `auth.admin.deleteUser(targetId)`**(멱등 — 이미 없으면 `alreadyDeleted`) → **⑥ `admin_purge_oauth_member` RPC**. ⑤→⑥ 순서와 실패 시 경고(warning) 반환 패턴은 `admin-delete-member`의 ⑤→⑥과 완전히 동일하게 맞춘다(재시도해도 안전 — 이미 검증된 패턴을 그대로 재사용).

### 4.3 화면

- **`src/lib/admin.ts`**: `purgeBlockReason(member, myId)` 추가(`withdrawBlockReason`과 같은 모양 — 본인/관리자/이미 없음/**아이디 로그인 가능 계정**의 4가지 이유), `purgeOAuthMember(userId)`(`withdrawMember`와 같은 모양으로 Edge Function 호출).
- **`src/components/admin/member-purge-dialog.tsx`**(신규): `MemberWithdrawDialog`를 복사해 시작하되 §3.7의 새 경고 문구로 교체.
- **`src/app/admin/(dashboard)/members/member-list.tsx`**(677~697행 케밥 메뉴), **`member-detail.tsx`**: `!canResetPassword(row)`(§2.1 — OAuth 전용)이면 "탈퇴 처리" 항목을 **"완전 삭제"로 교체**(추가가 아님 — §7 Q6), 아이콘은 `UserMinusIcon`과 구분되는 것(예: `Trash2Icon`) 추천. `role==='admin'`인 OAuth 계정은 항목이 보이되 `purgeBlockReason`으로 비활성 + "먼저 담임 해제" 안내(§3.4).
- 과거에 이미 탈퇴 처리된 OAuth 계정(§1.4)에도 "완전 삭제" 메뉴가 보이게 한다(판별 조건은 `withdrawn_at` 유무와 무관하게 `!canResetPassword`만 본다).

### 4.4 `CLAUDE.md` 개정안(문구 제안, Build 승인 후 실제 반영)

현재 줄: `**강제 탈퇴는 완전 탈퇴**: auth.users를 삭제(복구 없음)하되 학습 기록은 남기고 "탈퇴한 학생"으로 표시한다. 관리자 대상은 불가. 기록을 지울 수 있는 외래키가 생기면 안 된다(withdrawal_blocking_fks()가 막음).`

뒤에 추가할 문장(안): `**단, 구글·깃허브(OAuth) 전용 계정(아이디 로그인 없음)은 '완전 삭제'**: 계정뿐 아니라 학습 기록·댓글·감사 로그까지 실제로 지워 대시보드에 남기지 않는다(총괄만 가능, 담임 불가 — OAuth 가입 계정은 학급이 없어 담임 판별이 항상 거짓이다). 같은 계정으로 다시 가입하면 새 계정으로 시작한다. 아이디·비밀번호 계정은 지금처럼 기록 보존 탈퇴를 유지한다.` 지금 함수 목록 줄에 `admin-purge-oauth-member` 추가.

---

## 5. 배포 순서

1. 이 spec.md 승인(§7 질문에 답).
2. Build: 마이그레이션 파일(§4.1) + Edge Function(§4.2) + 화면(§4.3) 작성.
3. Review: §6 시험 계획대로 확인, `review.md` 작성.
4. **사용자**: `20260928000000_oauth_purge.sql`을 Supabase SQL Editor에서 실행 → 확인 쿼리.
5. **사용자**: `npx supabase functions deploy admin-purge-oauth-member`(`--no-verify-jwt` 금지). 기존 3개 함수는 이번 변경과 무관해 재배포 불필요.
6. Claude가 가짜 세션으로 화면 동작 재확인 → 사용자가 확인·요청하면 커밋·push.
7. 새 SQL이 아직 없을 때: Edge Function이 RPC 프로브(④)에서 "DB 설정이 아직 적용되지 않았습니다" 메시지로 안전하게 거부한다(기존 함수들과 같은 패턴) — 화면 버튼을 눌러도 계정이 지워지지 않는다.

---

## 6. 시험 계획

**가짜 응답으로 확인(화면, 서브에이전트가 headless 브라우저로)**:
- OAuth 전용 계정 행에는 "완전 삭제"만, 아이디 계정 행에는 "탈퇴 처리"만 보이는지(§4.3 교체 규칙).
- 관리자(`role='admin'`) OAuth 계정은 "완전 삭제"가 비활성 + "먼저 담임 해제" 문구.
- 이름 재입력 전에는 확인 버튼이 꺼져 있는지, 문구가 §3.7 새 경고로 바뀌었는지.
- Edge Function 404/401/400(마이그레이션 없음)을 각각 흉내 내 오류 문구가 올바른지.

**실 DB에서만 확인할 수 있는 것(사용자 확인 절차)**:
1. 테스트용 구글(또는 깃허브) 계정으로 사이트에 가입(자동으로 `role='user'`, 체험이 아니라 실제 로그인 상태) → 무언가 학습 기록(댓글 하나 등)을 남긴다.
2. 총괄 계정으로 회원 관리에서 그 계정에 "완전 삭제" 실행(이름 재입력 확인 포함).
3. **확인 1**: 회원 목록·학습 현황·감사 로그 어디에도 그 계정 흔적이 없는지(§0.3의 목표).
4. **확인 2(가장 중요 — §1.3의 미검증 부분)**: **같은 구글 계정으로 다시 로그인** → 새 계정(새 이름 입력 없이 구글 프로필 그대로)으로 정상 가입되는지, 이전 기록을 이어받지 않는지.
5. 되돌리기: 이 기능은 설계상 되돌릴 수 없다(§3.7) — SQL 되돌림 파일은 필요 없다(새로 만드는 함수 하나만 있고, 기존 정책을 바꾸지 않으므로 문제가 생기면 함수 자체를 비활성화하면 그만이다).

---

## 7. 열린 질문 (추천안 포함)

| # | 질문 | 추천안 | 참조 |
|---|---|---|---|
| Q1 | 감사 로그 3곳(§3.3)을 완전히 지울지, 아니면 이름만 지우고 "OAuth 계정 1명 완전 삭제됨" 같은 익명 행으로 남길지 | **완전히 지움(추천)** — "정보가 대시보드에 남지 않도록"이라는 요청에 가장 직접적으로 부합. 실익이 적은 부가 설계(별도 익명 로그 표)는 만들지 않음 | §3.3 |
| Q2 | 교사(관리자) OAuth 계정 처리 — 선 담임 해제 후 완전 삭제(안 A) 동의하는지 | **동의 추천** — 기존 안전장치(`admin_set_role`)를 그대로 재사용, 새 위험 없음 | §3.4 |
| Q3 | 완전 삭제를 실행한 사실 자체는 감사 로그로 남기고 싶은지(이름 없이 "OAuth 계정 완전 삭제, 처리한 관리자, 시각"만) | 기본은 **안 남김**(Q1과 같은 이유)이지만, 총괄이 "누가 언제 이 기능을 썼는지"는 알고 싶다면 이름·이메일 없이 `actor_id`·`created_at`만 남기는 별도의 짧은 로그(`oauth_purge_log`)를 추가할 수 있음(비용 작음) — **사용자가 필요 여부만 정해주면 됨** | §3.3 |
| Q4 | 커뮤니티 글·댓글·업로드 게임 파일까지 실제로 지울지(§3.9 B안), 아니면 "익명"으로 남기는 지금 설계(A안)로 충분한지 | **A안(지금 그대로) 추천** — 이미 개인정보는 전혀 안 남고, 구현·위험이 가장 작음 | §3.8, §3.9 |
| Q5 | "완전 삭제"를 총괄만 할 수 있게 좁히는 것(§3.5)에 동의하는지 | **동의 추천** — 코드 구조상 담임은 애초에 OAuth 계정에 접근 권한이 없음(`teaches_student`가 항상 false) | §3.5 |
| Q6 | 회원 목록에서 OAuth 계정의 "탈퇴 처리" 메뉴를 "완전 삭제"로 **교체**할지, 아니면 두 버튼을 모두 보여줄지 | **교체 추천** — 사용자의 요청 문구("탈퇴를 시키면 완전히 삭제되어") 자체가 OAuth 계정에 대해 "탈퇴 = 완전 삭제"를 의미하는 것으로 읽힌다. 두 버튼을 다 두면 "탈퇴 처리"를 눌렀을 때 아무 효과가 없어 보이는 혼란(기록이 그대로 남는데 이름만 가려짐)이 생김 | §3.4, §4.3 |
| Q7 | 지금까지 이미 탈퇴 처리된 OAuth 계정(§1.4)도 이번에 소급해서 완전 삭제할지 | **사용자가 원할 때만** — 새 "완전 삭제" 메뉴가 과거 탈퇴 계정에도 똑같이 보이므로(§4.3), 원하면 회원 목록에서 직접 한 번 더 실행하면 된다. 자동 일괄 삭제는 만들지 않음(실수로 지우면 안 되는 계정까지 한꺼번에 지울 위험) | §1.4 |

---

## 개정 1 — 사용자 결정·승인 (2026-09-28) **이 절이 위 본문보다 우선한다.**
* 사용자 답(질문 네 개): 게시판 글 **"모두 지우기"** · 교사 계정 **"먼저 담임 해제 뒤 삭제"** · 관리 기록 **"모두 지우기"** · 메뉴 **"완전 삭제로 바꾸기"** → 이 결정대로 Build(사용자 요청 "변경해줘" + 네 결정).
* **Q4 = B안(모두 지움)**: 완전 삭제는 그 계정이 쓴 **자유게시판·학습게임 글**(`community_posts.author_id = 대상`)을 실제로 지운다 — 그 글에 달린 다른 사람의 댓글·좋아요도 함께 사라진다(화면 경고에 적음). 그 계정의 **업로드 게임 파일**은 Storage API로 지운다(버킷 `game-uploads`, 경로 첫 칸이 계정 id — SQL로 `storage.objects`를 지우지 않는다). **신고 기록**도: 그 계정이 한 신고(cascade)뿐 아니라 **그 계정의 글·댓글을 신고한 기록**(`community_reports`는 대상 제목·내용·작성자를 스냅샷으로 저장 — 글이 지워져도 `post_id`/`comment_id`만 null로 남음, `20260922040000_community.sql` 319~343행)도 지워 관리자 '신고 관리'에 이름·내용이 남지 않게 한다(`target_author_id = 대상`인 행).
* **Q2 = A안**: 완전 삭제 대상은 `role='user'`인 OAuth 전용 계정만. 교사(관리자) OAuth 계정은 총괄이 먼저 기존 '담임 해제'(`admin_set_role` — 학생 있는 학급을 혼자 맡으면 거부)를 한 뒤 완전 삭제. 그 교사가 쓴 선생님 글·과제·블로그 글은 남고(주인 없음 → 총괄만 수정), 그 교사가 학생에게 보낸 피드백 메시지는 함께 지워진다(`feedback_messages.sender_id` cascade — 화면 경고에 적음).
* **Q1·Q3 = 모두 지움, 삭제 사실 로그도 남기지 않음**: `member_withdrawal_log`·`member_create_log`·`password_reset_log`의 대상 행을 지운다.
* **Q6 = 교체**: OAuth 전용 계정(`providers`에 `email` 없음)은 회원 목록·상세의 '탈퇴 처리'가 '완전 삭제'로 바뀐다. 아이디 계정은 지금처럼 '탈퇴 처리'(기록 보존).
* **Q5 = 총괄만**, **Q7 = 소급 자동 삭제 없음**(예전에 탈퇴시킨 OAuth 계정도 같은 '완전 삭제' 메뉴로 하나씩) — 추천대로(사용자 이의 없음).
* 다시 가입: 새 SQL 없이 됨(§1.3·§3.6 — Claude가 유일 제약이 없음을 다시 확인). 배포 뒤 사용자가 시험용 구글 계정으로 실제 확인(§6).

**이 문서는 사용자 승인됨(2026-09-28, 개정 1).**
