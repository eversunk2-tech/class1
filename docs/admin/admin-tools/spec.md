# 관리자 도구 2종 설계: 회원 강제 탈퇴 · 로그인 필수 토글 (spec)

> Plan 단계 산출물. **구현하지 않음.** Build 서브에이전트가 이 문서를 기준으로 작업한다.
> 전제: `docs/admin/spec.md`(회원 관리·학습 현황 설계, 이미 구현됨), `CLAUDE.md`(정적 export 제약, SQL 적용 절차), 기존 마이그레이션 8개, `supabase/functions/admin-reset-password/**`.
> 이 문서는 두 독립 기능을 다루며 서로 의존하지 않는다. 마이그레이션·Edge Function도 따로 만든다.

---

## 0. 조사 요약 (설계 전 확인한 사실)

### 0.1 `profiles`는 `auth.users`와 PK를 공유한다

```sql
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  ...
);
```

`profiles.id`가 곧 `auth.users.id`다. 즉 **`auth.users` 행을 지우면 `profiles` 행도 함께 사라진다**(FK가 PK 위에 걸려 있어 "`profiles`는 남기고 `auth.users`만 지우기"가 불가능). "완전 삭제"를 하려면 결국 `auth.users`를 지워야 하고, 그러면 `profiles`도 없어지므로 작성자 이름을 보여줄 곳 자체가 사라진다(별도 스냅샷 컬럼을 모든 참조 테이블에 추가하지 않는 한).

### 0.2 학생이 만든 행들의 현재 FK

| 테이블 | 컬럼 | `on delete` | not null |
|---|---|---|---|
| `comments` | `user_id` | cascade | Y |
| `likes` | `user_id` | cascade | Y |
| `app_results` | `user_id` | cascade | Y |
| `post_reads` | `user_id` | cascade | Y |
| `assignment_submissions` | `user_id` | cascade | Y |
| `feedback_threads` | `student_id` | cascade | Y |
| `feedback_messages` | `sender_id` | cascade | Y |
| `feedback_read_marks` | `user_id` | cascade | Y |
| `community_posts` | `author_id` | **set null**(이미 nullable) | N |
| `community_comments` | `user_id` | cascade | Y |
| `community_likes` | `user_id` | cascade | Y |
| `community_reports` | `reporter_id` | cascade / `target_author_id` set null | Y / N |
| `member_directory` | `id` | cascade(profiles 삭제 시 행 자체가 사라짐) | Y(PK) |
| `app_progress` | `user_id` | `auth.users`를 직접 참조, cascade | Y |

대부분 `cascade` + `not null`이다. `community_posts.author_id`만 미리 `set null`로 설계돼 있다(주석에 "profiles 삭제 시 on delete set null이 막히므로"라고 적혀 있어, 원래도 삭제를 염두에 두긴 했으나 댓글·좋아요 등 나머지 테이블에는 반영되지 않은 상태다).

### 0.3 결론 — "실제 삭제 + 기록 보존"의 비용

옵션 (b)를 하려면:
1. 위 표의 `cascade` 8곳을 전부 `set null`로 바꾸고 컬럼을 nullable로 변경(마이그레이션 위험도 높음, 기존 데이터 있는 상태에서 제약 변경).
2. `profiles` 행 자체가 사라지므로 "탈퇴한 학생" 표시를 위해 `comments.user_id`가 null일 때 대신 보여줄 스냅샷(예: 탈퇴 시점 이름)을 어디에도 저장할 수 없다 — 지금 스키마는 이름을 `profiles.display_name` 하나에서 조인해 가져오는 구조라, `profiles`가 없어지면 모든 참조 테이블에 `author_name_snapshot` 같은 컬럼을 추가해야 한다.
3. 되돌릴 수 없다(요청한 확인 절차와 상충하는 방향).

옵션 (a)는 `auth.users`/`profiles` 행을 **지우지 않고** 로그인만 막으므로 위 어떤 것도 필요 없다: 조인은 그대로 살아있고, "탈퇴한 학생" 표시는 `profiles`에 플래그 하나만 추가해 화면에서 조건부로 바꿔 보여주면 된다.

**→ 추천: (a) 계정 정지(ban) + 프로필 익명 표시.** 완전 삭제(b)는 이번에 만들지 않는다(§8 Q1에서 다시 정리).

---

## 1. A. 회원 강제 탈퇴

### 1.1 설계

#### 1.1.1 스키마 변경 (새 마이그레이션, §3)

```sql
alter table public.profiles
  add column if not exists withdrawn_at timestamptz;
-- null = 정상 회원, not null = 탈퇴 처리된 시각.
-- must_change_password와 같은 이유로 grant update에 포함하지 않는다 → 학생 스스로 켜거나 끌 수 없다.

create table if not exists public.member_withdrawal_log (
  id         uuid primary key default gen_random_uuid(),
  target_id  uuid not null references public.profiles (id) on delete cascade,
  actor_id   uuid not null references public.profiles (id) on delete cascade,
  action     text not null check (action in ('withdraw', 'restore')),
  sessions_revoked integer,
  created_at timestamptz not null default now()
);

alter table public.member_withdrawal_log enable row level security;

create policy "member_withdrawal_log: 관리자만 조회"
  on public.member_withdrawal_log for select
  using (public.is_admin());

revoke all on public.member_withdrawal_log from anon, authenticated;
grant select on public.member_withdrawal_log to authenticated; -- RLS가 관리자만 걸러줌
```

#### 1.1.2 처리 RPC (서비스 롤 전용 — `admin_finalize_password_reset`과 완전히 같은 패턴)

```sql
create or replace function public.admin_finalize_withdrawal(p_target uuid, p_actor uuid, p_action text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sessions integer := 0;
begin
  if p_action not in ('withdraw', 'restore') then
    raise exception 'invalid action';
  end if;
  if not exists (select 1 from public.profiles where id = p_actor and role = 'admin') then
    raise exception 'actor is not an admin';
  end if;
  if p_target = p_actor or exists (select 1 from public.profiles where id = p_target and role = 'admin') then
    raise exception 'admin accounts cannot be withdrawn';
  end if;

  update public.profiles
    set withdrawn_at = case when p_action = 'withdraw' then now() else null end
    where id = p_target;
  if not found then
    raise exception 'target profile not found';
  end if;

  if p_action = 'withdraw' then
    -- 탈퇴 시에만 기존 로그인을 끊는다(복구 시에는 다시 로그인하면 되므로 세션 정리가 필요 없음).
    begin
      delete from auth.sessions where user_id = p_target;
      get diagnostics v_sessions = row_count;
      delete from auth.refresh_tokens where user_id = p_target::text;
    exception when others then
      v_sessions := -1;
    end;
  end if;

  insert into public.member_withdrawal_log (target_id, actor_id, action, sessions_revoked)
  values (p_target, p_actor, p_action, v_sessions);

  return v_sessions;
end;
$$;

revoke all on function public.admin_finalize_withdrawal(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.admin_finalize_withdrawal(uuid, uuid, text) to service_role;
```

`profiles.display_name`/`avatar_url` 값 자체는 **지우지 않는다.** "탈퇴한 학생" 표시는 클라이언트/쿼리가 `withdrawn_at is not null`일 때 이름 대신 고정 문구를 보여주는 방식으로 처리한다(§1.3). 원본 이름을 지워버리면 관리자가 되돌리기(복구) 후에도 이름이 복구되지 않으므로, 가역성을 위해 원본 데이터는 보존하고 "표시만" 바꾼다.

#### 1.1.3 로그인 차단 방법

Supabase Auth Admin API `admin.auth.admin.updateUserById(targetId, { ban_duration: "876000h" })`(약 100년, Supabase 커뮤니티에서 "사실상 영구 정지"로 쓰는 관용값 — GoTrue에 문자 그대로의 "영구"는 없음)로 로그인 자체를 막는다. 복구 시 `{ ban_duration: "none" }`으로 해제.

**확인 필요(실 Auth API 호출 불가로 Plan 단계에서 검증 못함):** `ban_duration` 값이 현재 프로젝트의 Supabase 버전에서 그대로 동작하는지, `"none"`으로 정상 해제되는지는 Review 단계에서 테스트 계정으로 반드시 실제 호출해 확인해야 한다.

### 1.2 Edge Function 설계 — `admin-member-status`

`admin-reset-password`와 같은 구조로 새로 만든다(이름은 왕복 가능하게 지음, `admin-withdraw-member` 대신 하나로 통일해 배포 부담을 줄임).

| 항목 | 내용 |
|---|---|
| 경로 | `supabase/functions/admin-member-status/index.ts` |
| 요청 | `POST { "userId": "<uuid>", "action": "withdraw" \| "restore" }` |
| 검증 | ① 토큰으로 호출자 조회 ② `profiles.role = 'admin'` 확인(서비스 롤로) ③ `targetId === callerId` 거부 ④ 대상이 관리자면 거부(자기 자신·다른 관리자 탈퇴 금지, `admin-reset-password`와 동일 원칙) |
| 동작(`withdraw`) | `auth.admin.updateUserById(targetId, { ban_duration: "876000h" })` → `admin_finalize_withdrawal(targetId, callerId, 'withdraw')` |
| 동작(`restore`) | `auth.admin.updateUserById(targetId, { ban_duration: "none" })` → `admin_finalize_withdrawal(targetId, callerId, 'restore')` |
| 응답 | `200 { ok: true, sessionsRevoked?: number }` / `401/403/400/404/500 { error: "한국어 메시지" }` |
| CORS | `admin-reset-password`와 동일한 허용 목록·헤더 그대로 복사 |
| 순서 주의 | ban 처리 → RPC 순서(비밀번호 초기화 함수가 "① 비밀번호 변경 → ② 플래그" 순서를 지키는 것과 같은 이유: Auth API 호출이 실패하면 DB 상태를 바꾸지 않기 위해). ban 성공 후 RPC가 실패하면 "로그인은 막혔지만 목록에는 정상 표시" 같은 불일치가 생기므로, RPC 실패 시 응답에 `warning`을 담아 관리자가 재시도하게 한다(`admin-reset-password`의 warning 패턴 재사용) |

### 1.3 화면 설계

#### 회원 관리 목록 `/admin/(dashboard)/members/member-list.tsx`
- 표의 "작업" 열에 기존 "비밀번호 초기화" 버튼 옆에 "탈퇴 처리" 버튼 추가(또는 `DropdownMenu`로 묶어 실수 클릭 방지 — **추천**: 파괴적 동작이 2개가 되므로 케밥 메뉴(`⋮`)로 묶고 "비밀번호 초기화" / "탈퇴 처리"를 항목으로 분리, "탈퇴 처리"는 위험 색상(`text-destructive`)로 표시).
- 관리자 자신·다른 관리자 행은 "탈퇴 처리" 항목 자체를 비활성화 + 이유 툴팁("관리자 계정은 처리할 수 없습니다" — `passwordResetBlockReason`과 같은 패턴의 `withdrawBlockReason` 헬퍼를 `src/lib/admin.ts`에 추가).
- 이미 탈퇴한 회원은 이름 옆에 회색 배지 "탈퇴함" 표시, 메뉴 항목이 "탈퇴 처리" 대신 "탈퇴 취소(복구)"로 바뀐다.

#### 확인 다이얼로그(`WithdrawDialog`, `src/components/admin/member-withdraw-dialog.tsx` 신규)
- **되돌리기 어려운 동작이므로 이름 재입력 확인**(Plan 지침 요구사항): "학생 이름 `OOO`을(를) 정확히 입력하면 탈퇴 처리됩니다" + 입력창 + 이름이 일치할 때만 "탈퇴 처리" 버튼 활성화.
- 안내 문구: "탈퇴 처리하면 이 학생은 더 이상 로그인할 수 없습니다. 작성한 글·댓글·학습 기록은 그대로 남고 작성자는 '탈퇴한 학생'으로 표시됩니다. 관리자가 다시 '탈퇴 취소'를 누르면 즉시 로그인할 수 있게 됩니다."
- 처리 중 스피너, 실패 시 Edge Function이 준 한국어 오류 메시지 표시(닫지 않고 재시도 가능).
- 성공 시 토스트 "OOO 학생을 탈퇴 처리했습니다" + 목록/상세의 배지 즉시 갱신.
- 복구(취소)는 이름 재입력 없이 단순 확인 다이얼로그로 충분(파괴적이지 않은 방향이므로 마찰을 낮춤) — "OOO 학생의 탈퇴를 취소하고 다시 로그인할 수 있게 할까요?".

#### 회원 상세 `/admin/(dashboard)/members/member-detail.tsx`
- 프로필 요약 카드에 탈퇴 상태 배지 + 탈퇴 처리 시각·처리한 관리자(하단 §1.1.1 로그 테이블에서 최근 1건 조회, `member_withdrawal_log.select('*, actor:profiles!actor_id(display_name)').eq('target_id', id).order('created_at', {ascending:false}).limit(1)`) 표시.
- 탈퇴 처리/취소 버튼을 카드 안에 둔다(목록과 같은 다이얼로그 재사용).
- 웹앱 결과/댓글/과제 제출 탭은 **변경 없음**(데이터가 그대로 남아 있으므로 기존 쿼리 그대로 동작). 작성자 이름이 필요한 곳(댓글·좋아요 탭 등)에서 표시 함수만 아래 §1.3.1 적용.

#### 1.3.1 "탈퇴한 학생" 표시 규칙 (공용 헬퍼)
- `src/lib/admin.ts`(또는 `learning.ts`)에 `displayMemberName(profile)` 헬퍼 추가: `profile.withdrawn_at`이 있으면 항상 `"탈퇴한 학생"`을 반환하고, 없으면 기존 `memberName()` 로직 그대로. 댓글 작성자, 게시글 작성자, 학습 결과의 학생 이름, 과제 제출자 이름 등 **회원 상세·게시판·커뮤니티 화면 전체에서 이 헬퍼를 통일해서 쓴다**(각 화면에서 개별적으로 `withdrawn_at`을 확인하지 않게).
- `member_directory` 조회(SELECT 컬럼 목록)와 각 화면의 `profiles(...)` 조인에 `withdrawn_at`을 항상 포함시켜야 이 헬퍼가 동작한다 → `src/lib/types.ts`의 `Profile`, `MemberRow`, 각 화면의 select 컬럼 목록에 `withdrawn_at` 추가 필요(Build 단계 체크리스트).
- 커뮤니티 게시판/학습게임 글 작성자 표시(`src/app/board/**`, `src/app/games/**`)도 같은 헬퍼를 쓰도록 범위에 포함한다(빠뜨리기 쉬운 부분이라 명시).

### 1.4 로그아웃·로컬 기기 처리

- 서버에서 세션(`auth.sessions`/`auth.refresh_tokens`)을 지우면, 그 학생의 기기에 남아있는 **access token은 만료(기본 1시간)까지는 계속 유효**하다(`admin-reset-password`와 동일한 한계, 이미 §5.1에서 문서화된 사실 재사용). 즉시 차단은 아니고 "최대 1시간 내 차단"이다.
- refresh token이 무효화된 뒤 supabase-js가 자동 갱신을 시도하면 실패하고, 클라이언트 라이브러리는 이 경우 `onAuthStateChange`에 `SIGNED_OUT`(또는 `TOKEN_REFRESHED` 실패 후 세션 null)을 통지하는 것으로 알려져 있다 — **다만 이 프로젝트의 실제 supabase-js 버전·설정에서 그렇게 동작하는지는 Plan 단계에서 실제 기기로 확인하지 못했다.** Review 단계에서 반드시 확인할 것: 탈퇴 처리 후 이미 로그인된 학생 기기(과학 앱 포함)에서 다음 Supabase 호출 시 `SIGNED_OUT` 이벤트가 발생해 CLAUDE.md 규칙대로 `sci6…` localStorage가 지워지는지.
- 이 이벤트가 안 온다면(확인 결과에 따라) 완화책으로 과학 앱 공용 헬퍼(`class1-record.js` 또는 세션 훅)에 "API 호출이 401/403(세션 무효)을 받으면 로그아웃과 동일하게 처리"하는 방어 코드를 Build 단계에 추가하는 것을 권장한다(이번 Plan에는 필수 요구사항으로 넣지 않고, Review 결과에 따라 결정 — §8 Q2).

### 1.5 위험

- **ban_duration의 정확한 동작이 미검증**(§1.1.3) — Review에서 실제 계정으로 검증 필수.
- **관리자 자신을 잠그는 사고**: Edge Function이 `targetId === callerId`와 "대상이 admin이면 거부"를 이중으로 막으므로, 관리자는 이 기능으로 스스로를 잠글 수 없다. 다만 "마지막 관리자를 실수로 해제"하는 문제는 이미 `docs/admin/spec.md` §12(관리자 지정/해제, `admin_set_role`)에서 다루는 별개 기능이라 이 스펙 범위 밖.
- **재발급형이 아니라 상태형**: 비밀번호 초기화(1회성 값)와 달리 탈퇴는 on/off 상태라 실수로 여러 번 눌러도 데이터가 깨지지 않는다(안전).
- **탈퇴 학생의 커뮤니티 업로드 게임 파일**: Storage 버킷(`game-uploads`)의 파일은 지우지 않는다(요청이 "학습 기록은 남긴다"이므로 일관). 다만 신고 누적 등으로 이미 숨김 처리된 콘텐츠는 기존 정책 그대로 유지된다.

---

## 2. B. "로그인해야만 이용" 토글

### 2.1 설계 개요

```sql
create table if not exists public.site_settings (
  id               boolean primary key default true check (id), -- 항상 단일 행(id = true)
  login_required   boolean not null default false,
  updated_at       timestamptz not null default now(),
  updated_by       uuid references public.profiles (id) on delete set null,
  constraint site_settings_singleton unique (id)
);

insert into public.site_settings (id, login_required)
values (true, false)
on conflict (id) do nothing;

alter table public.site_settings enable row level security;

-- ⚠ 절대 조건부로 잠그지 않는다: 이 테이블 자체는 항상 전체 공개로 읽을 수 있어야
--   클라이언트가 "지금 로그인이 필요한 상태인지"를 로그인 여부와 무관하게 먼저 확인할 수 있다.
create policy "site_settings: 누구나 조회"
  on public.site_settings for select
  using (true);

create policy "site_settings: 관리자만 수정"
  on public.site_settings for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

revoke all on public.site_settings from anon, authenticated;
grant select on public.site_settings to anon, authenticated;
grant update (login_required, updated_at, updated_by) on public.site_settings to authenticated; -- RLS가 관리자만 걸러줌

create or replace function public.login_required()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select login_required from public.site_settings limit 1), false);
$$;

revoke all on function public.login_required() from public;
grant execute on function public.login_required() to anon, authenticated;

-- 화면에서 직접 update()를 쓰지 않고 이 RPC로 통일한다(admin_set_role과 같은 이유: 실수 방지 + updated_by 자동 기록).
create or replace function public.admin_set_login_required(p_value boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception '관리자만 사용할 수 있습니다.';
  end if;
  update public.site_settings
    set login_required = p_value, updated_at = now(), updated_by = auth.uid()
    where id = true;
end;
$$;

revoke all on function public.admin_set_login_required(boolean) from public;
grant execute on function public.admin_set_login_required(boolean) to authenticated;
```

`login_required()`는 `security definer`라서 `site_settings`의 RLS와 무관하게 항상 값을 읽는다. 그래도 `site_settings` 자체 정책은 위처럼 무조건 공개로 둔다 — 이유는 클라이언트 화면(로그인 안내 페이지)도 이 값을 직접 읽어 "지금 로그인이 필요합니다" 문구를 보여줘야 하기 때문이다(그 화면 자체가 RLS로 막히면 안내조차 못 띄운다).

### 2.2 RLS 변경 표 (기존 정책에 조건 추가)

각 정책의 `using` 절 맨 앞에 게이트를 더한다: 이미 로그인 여부와 무관하게 공개였던 SELECT 정책만 대상이며, 이미 "본인 또는 관리자만"이던 정책(예: `app_results`, `assignment_submissions`, `feedback_*`)은 **손대지 않는다**(원래도 비로그인이 못 보므로).

| 테이블 | 정책(기존 이름) | 기존 `using` | 새 `using` |
|---|---|---|---|
| `profiles` | `profiles: 누구나 조회` | `true` | `(not public.login_required()) or auth.uid() is not null` |
| `posts` | `posts: 공개 글은 누구나, 관리자는 전체 조회` | `published or public.is_admin()` | `(published and ((not public.login_required()) or auth.uid() is not null)) or public.is_admin()` |
| `comments` | `comments: 공개 글의 댓글은 누구나 조회` | `exists(...게시글 공개...)` | 기존 조건 앞에 `((not public.login_required()) or auth.uid() is not null) and (...)` 추가 |
| `likes` | `likes: 누구나 조회` | `true` | `(not public.login_required()) or auth.uid() is not null` |
| `views` | `views: 누구나 조회` | `true` | `(not public.login_required()) or auth.uid() is not null` |
| `assignments` | `assignments: 공개된 것은 누구나, 관리자는 전체 조회` | `published or public.is_admin()` | `(published and ((not public.login_required()) or auth.uid() is not null)) or public.is_admin()` |
| `community_posts` | `community_posts: 숨김 아니면 누구나, 작성자·관리자는 숨김도` | `not hidden or auth.uid() = author_id or public.is_admin()` | `((not hidden) and ((not public.login_required()) or auth.uid() is not null)) or auth.uid() = author_id or public.is_admin()` |
| `community_comments` | `community_comments: 숨김 아니면 누구나` | (본문 참고, 게시글 공개 여부와 연동) | 앞에 동일 게이트 추가 |
| `community_likes` | `community_likes: 볼 수 있는 글만 조회` | `exists(...community_posts 공개...)` | 서브쿼리 조건에 동일 게이트 추가(글 쪽 정책과 별개 정책이라 각자 추가해야 함) |
| `storage.objects`(`game-uploads` 버킷) | `game-uploads: 볼 수 있는 게임·본인·관리자 조회` | `exists(...community_posts 공개...)` | 동일 게이트 추가(스토리지 정책은 테이블 정책과 독립적이라 빠뜨리기 쉬움 — 반드시 포함) |

**절대 건드리지 않는 것(자물쇠 회피 규칙, §2.3에서 다시 강조)**:
- `site_settings`의 select 정책 — 항상 `true`.
- `profiles`의 `본인만 수정`(update) 정책 — 무관.
- `member_directory`, `app_results`, `post_reads`, `assignment_submissions`, `feedback_*`, `app_progress`, `password_reset_log`, `member_withdrawal_log` — 원래 "본인 또는 관리자만"이라 이미 비로그인 접근 불가. 변경 불필요.
- `community_reports` — 이미 관리자·신고자 본인만. 변경 불필요.
- Auth 관련 어떤 것도(로그인 API, `clear_must_change_password()`, `admin_finalize_password_reset` 등)는 이 토글과 무관하게 항상 동작(테이블 RLS가 아니라 Auth 서버 자체 엔드포인트이거나, 이미 `auth.uid()` 기반 권한이라 로그인한 사람 기준으로만 판단하기 때문).

과학 앱은 CLAUDE.md 규칙상 이미 로그인 필수라서(각 앱이 자체적으로 비로그인 시 활동 화면 대신 안내를 보여줌) 이 토글과 무관하게 항상 잠겨 있다 — RLS 변경 대상 아님, 표에서 제외.

### 2.3 자물쇠 회피(lockout) 규칙 — 반드시 지킬 것

1. **`site_settings` SELECT는 절대 게이트를 걸지 않는다.** 게이트를 걸면 꺼야 할 스위치를 읽을 방법이 없어져 무한 잠금이 될 수 있다.
2. **관리자는 항상 `auth.uid() is not null`을 만족**하므로(로그인 상태로만 `/admin/`에 들어올 수 있음 — `AdminGuard`) 위 표의 모든 게이트를 그냥 통과한다. `public.is_admin()`을 게이트 조건에 별도로 넣지 않은 이유이기도 하다(넣어도 되지만 중복).
3. `/login/`, `/reset-password/` 화면은 DB 테이블 SELECT에 의존하지 않는다(Supabase Auth REST 엔드포인트 + `auth.updateUser`는 우리 RLS 영향을 받지 않음) — 토글 상태와 무관하게 항상 접근 가능.
4. **되돌리기**: 토글은 상태 하나이므로 실수로 켰어도 관리자 화면(로그인 상태)에서 그냥 다시 끄면 즉시 원복된다. 관리자 자신이 잠기는 경우는 설계상 없다(2번).
5. Build 단계에서 마이그레이션 적용 직후 **반드시** "로그아웃 상태로 글 목록에 접근이 막히는지"와 "관리자 계정으로는 토글 화면에 계속 들어가지는지"를 순서대로 확인(§3 확인 쿼리에도 명시).

### 2.4 화면 설계

- 위치: `/admin/(dashboard)/page.tsx`(관리자 개요) 상단에 카드 하나 추가(새 `/admin/settings/` 페이지를 따로 만들 만큼 항목이 많지 않음 — 이후 설정 항목이 늘면 그때 분리).
- 구성: 스위치(shadcn `Switch`) + 라벨 "로그인해야만 이용", 현재 상태 텍스트("켜짐 — 비로그인 방문자는 글·댓글·게시판·학습 앱을 볼 수 없습니다" / "꺼짐 — 누구나 글을 읽을 수 있습니다"), 아래 작은 글씨로 "마지막 변경: {일시} · {관리자 이름}"(`site_settings.updated_at`/`updated_by` → `profiles` 조인).
- **켜는 동작만** 확인 다이얼로그 경유("사이트 전체가 로그인해야 볼 수 있게 됩니다. 계속할까요?") — 끄는 동작(원복 방향)은 스위치 클릭 즉시 반영, 별도 확인 없음(마찰을 비대칭으로 둬서 "실수로 켬"은 막고 "되돌리기"는 쉽게).
- 저장: `supabase.rpc('admin_set_login_required', { p_value: next })` → 성공 시 로컬 상태 갱신 + 토스트, 실패 시 스위치 원위치 + 오류 토스트.
- 접근성: `Switch`에 `aria-describedby`로 상태 설명 연결, 키보드로 토글 가능(shadcn 기본 지원), 상태 표시는 텍스트로도 병기(색만으로 구분하지 않음 — "켜짐"/"꺼짐" 단어 자체가 상태).

### 2.5 캐시·정적 export 한계

- GitHub Pages는 정적 HTML/JS 번들을 서빙한다. **페이지 셸(내비게이션, 레이아웃, `<title>`/메타 설명 등 SEO용 텍스트)은 토글과 무관하게 항상 공개**로 남는다 — 토글이 막는 것은 클라이언트가 이후 Supabase에서 가져오는 **데이터**뿐이다.
- "검색엔진에도 안 보임"은 정확히는 "검색엔진이 실제 글 내용까지는 못 가져간다"는 뜻이지, 사이트 자체가 검색 결과에서 사라지는 건 아니다(메뉴 이름, 정적 텍스트는 여전히 색인될 수 있음). 완전히 안 보이게 하려면 `robots.txt`/메타 `noindex` 같은 별도 조치가 필요하며, 이번 스펙 범위 밖이다(§8 Q4에서 열린 질문으로 남김).
- 토글을 켠 직후에도 **브라우저가 이미 캐시해 둔 이전 응답**(같은 세션에서 로그인 전에 받아둔 글 목록 등)은 새로고침 전까지 화면에 남아있을 수 있다. 다음 Supabase 호출(좋아요, 새 글 열람 등)부터는 바로 막힌다.
- CDN/브라우저 정적 자산 캐시로 인해 배포 직후 오래된 JS 번들이 잠깐 서빙될 수 있는 것은 이 프로젝트의 기존 배포 방식 전반의 한계이며 이번 기능만의 문제는 아니다.

### 2.6 위험

- **정책 표(§2.2)를 하나라도 빠뜨리면 우회 경로가 남는다** — 특히 `storage.objects`(게임 파일)와 `community_likes`처럼 "다른 테이블의 공개 여부를 서브쿼리로 참조"하는 정책은 원본 테이블 정책과 별개로 각자 게이트를 추가해야 한다(빠뜨리기 가장 쉬운 지점, Review에서 표 전체를 체크리스트로 다시 확인할 것).
- **RLS 정책 재귀(42P17) 방지**: `login_required()`는 `site_settings`만 읽고, `site_settings`의 정책은 `login_required()`를 부르지 않는다(무조건 `true`/`is_admin()`) → 순환 없음. `is_admin()`도 기존과 동일하게 `profiles`만 읽고 `profiles`의 정책은 `is_admin()`을 쓰지 않으므로(§0.1 확인됨) 기존 패턴과 일관되게 안전하다.
- **여러 관리자가 동시에 토글**: 마지막 쓰기가 이긴다(단일 행이라 충돌해도 값이 깨지지 않음, 문제 없음으로 판단).

---

## 3. 마이그레이션 파일 (사용자가 SQL Editor에서 직접 실행 — 새 파일 2개, 재실행 안전)

| 파일 | 내용 |
|---|---|
| `supabase/migrations/20260923000000_member_withdrawal.sql` | §1.1: `profiles.withdrawn_at`, `member_withdrawal_log`, `admin_finalize_withdrawal()` |
| `supabase/migrations/20260923010000_login_required.sql` | §2.1~2.2: `site_settings`, `login_required()`, `admin_set_login_required()`, 기존 8개 정책의 `create or replace policy`(Postgres는 정책 수정이 `drop` 후 `create`라 `drop policy if exists` + `create policy`로 작성) |

두 파일 모두 `if not exists`/`on conflict do nothing`/`drop ... if exists` 패턴을 지켜 재실행 안전하게 작성한다(Build 단계 요구사항). 각 파일 상단에 실행 방법 + 아래 확인 쿼리를 주석으로 포함시킨다.

### 사용자가 할 일 (순서대로)

1. **`20260923000000_member_withdrawal.sql` 실행** → 확인: `select withdrawn_at from public.profiles limit 1;`이 오류 없이 실행되는지(컬럼 존재 확인), `select * from public.member_withdrawal_log limit 1;`(빈 결과 정상).
2. **`20260923010000_login_required.sql` 실행** → 확인:
   - `select * from public.site_settings;` → 1행, `login_required = false`인지.
   - **로그아웃 상태**(시크릿 창)에서 사이트 접속 → 글 목록이 평소처럼 보이는지(꺼진 상태이므로 변화 없어야 정상).
   - `select public.admin_set_login_required(true);`는 SQL Editor에서 **실행하지 않는다**(관리자 화면 버튼으로만 켤 것 — SQL Editor 세션은 `auth.uid()`가 없어 "관리자만" 체크에 걸려 실패하거나, service_role로 실행 시 검증을 우회하게 되므로 화면 경로로 테스트하는 편이 안전).
3. **Edge Function 배포**: `admin-reset-password`와 같은 방법(CLI `supabase functions deploy admin-member-status` 또는 대시보드 에디터)으로 `admin-member-status` 배포.
4. **배포 후 확인(Review 단계 겸)**:
   - 관리자 화면에서 테스트용 학생 계정 1개를 "탈퇴 처리" → 그 계정으로 로그인 시도해 실패하는지, 관리자 화면에서 해당 학생의 기존 댓글/학습 기록이 "탈퇴한 학생" 이름으로 그대로 보이는지.
   - 같은 계정 "탈퇴 취소" → 다시 로그인되는지.
   - 로그인 필수 토글을 켠 뒤 로그아웃 상태로 글/게시판/게임 접근이 막히는지, 관리자 계정으로는 계속 정상 이용되는지, 토글을 다시 꺼서 원복되는지.

---

## 4. 실패·권한 오류 처리 요약

| 상황 | 처리 |
|---|---|
| Edge Function 네트워크 오류 | 다이얼로그에 "네트워크 오류로 처리하지 못했습니다. 다시 시도해 주세요." + 재시도 버튼(닫히지 않음) |
| 이미 탈퇴 처리된 회원을 다시 탈퇴 시도(레이스) | Edge Function은 멱등하게 동작(이미 ban 상태여도 성공 처리) — 목록이 오래돼 있던 경우를 대비 |
| `admin_set_login_required` RPC 권한 오류(비관리자 세션 만료 등) | 스위치 원위치 + "관리자 권한을 확인할 수 없습니다. 새로고침 후 다시 로그인해 주세요." |
| 마이그레이션 미실행 상태에서 새 화면 접근 | 기존 `isMissingSchemaError`/`MISSING_SCHEMA_MESSAGE` 패턴 재사용(§0 조사에서 확인된 기존 관례) |

---

## 5. 단계별 작업 계획 (Build 서브에이전트용)

| 단계 | 범위 | 의존 |
|---|---|---|
| 0 | 마이그레이션 SQL 2개 + Edge Function `admin-member-status` 코드 작성(README 포함, `admin-reset-password/README.md` 형식 그대로) | — |
| 1 | `src/lib/types.ts`에 `withdrawn_at`, `site_settings` 타입 추가. `src/lib/admin.ts`에 `withdrawBlockReason`, `displayMemberName` 헬퍼 추가 | 0 |
| 2 | 회원 목록/상세에 탈퇴 배지·케밥 메뉴·`WithdrawDialog` 연결(Edge Function 배포는 사용자가 한 뒤 실제 호출 테스트) | 0, 1 |
| 3 | 댓글·좋아요·게시판·학습게임 작성자 표시에 `displayMemberName` 적용(§1.3.1 범위) | 1 |
| 4 | 관리자 개요에 로그인 필수 토글 카드 추가, `admin_set_login_required` 연동 | 0 |
| 5 | 전체 QA: §3의 사용자 확인 체크리스트를 Build/Review가 먼저 브라우저로 수행, `next build` 통과 확인 | 2, 3, 4 |

Build와 Review 서브에이전트는 분리한다(CLAUDE.md 규칙). Review는 특히 §2.2 RLS 표 전체와 §1.4(로컬 기기 정리)를 중점 검증한다.

---

## 6. 서브에이전트 지침 파일에 넣을 범위(참고)

- Build 지침: 이 문서의 §1.1~1.4, §2.1~2.4, §3, §5. 수정 허용 범위 — `supabase/migrations/20260923000000_member_withdrawal.sql`(신규), `supabase/migrations/20260923010000_login_required.sql`(신규), `supabase/functions/admin-member-status/**`(신규), `src/lib/types.ts`, `src/lib/admin.ts`, `src/app/admin/(dashboard)/members/**`, `src/app/admin/(dashboard)/page.tsx`(또는 `admin-overview.tsx`), `src/app/board/**`/`src/app/games/**`의 작성자 표시 부분만, `src/components/admin/**`(신규 컴포넌트). 기존 마이그레이션 파일은 절대 수정하지 않는다.
- Review 지침: §2.2 표 전체를 체크리스트로 한 줄씩 확인(정책 SQL 재검토), §1.5·§2.6 위험 항목 검증, 브라우저로 §3-4의 배포 후 확인 절차 실행(모바일 뷰포트 포함), `review.md` 작성.

---

## 7. 위험 종합

- Auth Admin API의 `ban_duration` 동작이 미검증(§1.1.3) — Review 최우선 확인 항목.
- 로그인 차단 후 로컬 `sci6…` 정리가 이벤트 기반으로 잘 오는지 미확인(§1.4) — Review 확인 항목, 필요 시 401 방어 코드 추가는 별도 후속 작업으로 뺄 수 있음.
- RLS 게이트 누락 시 "로그인 필수"가 반쪽짜리가 될 위험(§2.6) — 표 기반 체크리스트로 관리.
- 정적 export 특성상 완전한 "검색엔진 비노출"은 이번 범위로 보장 안 됨(§2.5) — 사용자에게 한계로 명시.

---

## 8. 열린 질문 (추천안 포함)

| # | 질문 | 추천안 |
|---|---|---|
| Q1 | "실제 삭제"(옵션 b)도 나중에 만들지 | **당장은 만들지 않음.** §0.3에서 정리한 대로 비용·위험이 크고, 지금 요구사항("기록은 남기고 계정만 삭제")은 ban 방식으로 이미 충족된다. 개인정보 완전 삭제가 법적/정책적으로 필요해지면(예: 학생/보호자가 명시적으로 요구) 그때 별도 Plan으로 옵션 b를 재설계 |
| Q2 | 401/403 방어 코드로 과학 앱의 `sci6…` 정리를 이중으로 보장할지 | Review에서 이벤트 기반 정리가 실제로 동작하는 것을 확인하면 **불필요**. 확인 결과 안 온다면 최소 변경으로 과학 앱 공용 세션 훅에 추가하는 후속 작업으로 분리 추천(이번 Build 범위에 넣지 않음 — 범위가 커짐) |
| Q3 | 탈퇴 처리 메뉴를 케밥(⋮)으로 묶을지, 버튼을 나란히 둘지 | **케밥 메뉴 추천**(§1.3) — 파괴적 동작이 2개가 되면서 실수 클릭 위험이 커짐 |
| Q4 | 완전한 검색엔진 비노출(`robots.txt`/`noindex`) | 이번 범위 밖으로 추천. 필요해지면 `robots.txt` 정적 파일 + 각 페이지 메타에 `noindex` 조건부 추가로 별도 작업 |
| Q5 | `member_directory`에도 `withdrawn_at`을 동기화해 넣을지 | **불필요 추천** — 회원 관리 화면은 이미 `member_directory`와 `profiles`를 조인해서 쓰고 있으므로(§0 조사), `profiles.withdrawn_at`만 select 목록에 추가하면 된다. 별도 트리거 동기화는 중복 |

---

## 개정 1 (2026-09-23, 사용자 결정) **이 절이 위 추천안보다 우선한다.**
* **A는 "완전 탈퇴"로 한다**: 계정 정지(ban)가 아니라 **`auth.users` 행을 실제로 삭제**해 다시 로그인할 수 없게 한다.
* **단, 학습 기록은 보존한다**(사용자 결정): 앱 결과·진행·댓글·좋아요·게시글·신고·피드백 등 그 학생이 남긴 행은 **지우지 않고** 대시보드에서 계속 볼 수 있어야 하며, 이름 표시는 "탈퇴한 학생"으로 바뀐다.
* 따라서 Build 단계에서 다음을 설계·구현한다(§0.3의 비용을 실제로 치른다).
  1. `profiles` 행이 `auth.users` 삭제 뒤에도 남도록 참조 관계를 바꾼다(예: `profiles`의 auth 외래키 제거 또는 `on delete set null` 가능한 구조로 변경). PK·조인 구조는 유지해 기존 화면이 그대로 동작해야 한다.
  2. `auth.users`를 직접 참조하는 모든 표의 `on delete cascade`를 **행이 살아남는 방식**으로 바꾼다(profiles 참조로 옮기거나 `set null` + 이름 스냅샷). 바꾸는 표·제약 이름을 전부 마이그레이션에 적고, 재실행 안전하게 쓴다.
  3. `profiles.withdrawn_at`(그리고 필요하면 이름 스냅샷 컬럼)으로 "탈퇴한 학생" 표시를 만든다. 로그인·비밀번호 관련 기능에서 탈퇴한 회원이 걸리지 않게 한다.
  4. 되돌릴 수 없으므로 화면에서 이름 입력 확인 + 명확한 경고("계정은 삭제되고 기록만 남습니다. 복구할 수 없습니다")를 둔다. 탈퇴 기록(누가·언제·누구를)은 남긴다.
  5. 관리자 자신·다른 관리자는 탈퇴 불가. Edge Function은 호출자가 관리자인지 검증한다.
* 복구(restore) 기능은 **없다**(계정을 지웠으므로). 다시 쓰게 하려면 계정을 새로 만든다.
* B(로그인 필수 토글)는 본문 설계 그대로 진행한다.
