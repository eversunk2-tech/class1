# 관리자 대시보드 + 학습활동 설계 (spec)

> Plan 단계 산출물. **구현하지 않음.** Build 서브에이전트가 이 문서를 기준으로 작업한다.
> `docs/blog/spec.md`(§12까지 확정 반영된 현재 구현 기준)와 `docs/blog/review.md`/`fix-1-report.md`를 전제로 하며, 그 위에 기능을 얹는다. 전제가 바뀌면(예: OAuth 정책) 이 문서도 다시 검토해야 한다.

## 0. 전제 (근거)

| 전제 | 근거 |
|---|---|
| 정적 export, 서버 기능 없음, 동적 세그먼트 대신 쿼리스트링 | `CLAUDE.md`/`AGENTS.md`, `next.config.ts`(`output:"export"`, `basePath:"/class1"`, `trailingSlash:true`) — 이미 blog spec에서 확인됨 |
| `/admin/*` 아래 중첩 라우트(`/admin/posts/`, `/admin/members/`, `/admin/learning/`)는 폴더 기반 라우팅 + Route Group(`(dashboard)`)으로 만들 수 있음 | `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route-groups.md` — URL에 영향 없이 레이아웃만 나눌 수 있음. 정적 export 여부와 무관하게 지원 |
| 서비스 롤 키가 필요한 작업(비밀번호 초기화)은 Edge Function으로만 가능 | Postgres 함수(`security definer`)로 `auth.users`의 비밀번호 해시를 직접 만드는 방법은 Supabase가 공식 지원하지 않는 편법이라 배제. `auth.admin.updateUserById`는 서비스 롤 클라이언트에서만 호출 가능 |
| 회원 목록의 가입방식/이메일/마지막 로그인은 Edge Function 없이 **트리거로 동기화한 전용 테이블**로 처리 가능 | 이미 이 프로젝트에 있는 `handle_new_user` 트리거(`auth.users` INSERT 트리거, `security definer`)와 같은 방식. `auth.users` UPDATE 시(로그인마다 `last_sign_in_at` 갱신) 같은 방식의 트리거를 하나 더 추가하면 됨 — Supabase가 공식 문서에서 예시로 드는 패턴(`on_auth_user_created`)의 연장선이라 Edge Function보다 안전하고 간단함 |
| 웹앱은 `/public/apps/{앱}/` 폴더 안에 자체 완결, 내부 참조는 상대경로만 | `CLAUDE.md` §웹앱 규칙 — 공용 절대경로 파일 참조 금지 |
| 관리자 가드는 UX 편의일 뿐, 실제 보안은 RLS | `docs/blog/spec.md` §0, 기존 `admin-guard.tsx` 주석과 동일 원칙을 이 기능에도 적용 |

---

## 1. 요약

- `/admin/`을 사이드 내비게이션이 있는 대시보드로 재구성한다. 기존 글 목록은 `/admin/posts/`로 옮기고 `/admin/write/`는 그대로 둔다.
- 회원 전체를 조회·검색·정렬하는 `/admin/members/`와 비밀번호 초기화(임시 비밀번호 1회 표시 + 강제 변경) 흐름을 추가한다.
- 웹앱 결과·글 읽기·댓글/좋아요·과제 제출을 학습활동으로 저장·집계하는 `/admin/learning/`을 추가한다.
- 관리자-학생 양방향 피드백 대화(전체 스레드 + 특정 결과/제출 연결 스레드)를 추가한다.
- 학생용 `/me/learning/`에서 자신의 활동과 피드백을 본다.
- 새 테이블 8개, Edge Function 1개(`admin-reset-password`), RPC 6개를 추가한다. 서비스 롤 키가 필요한 작업은 이 Edge Function 하나뿐이다.

---

## 2. 화면 목록과 URL

| # | 화면 | URL | 권한 | 비고 |
|---|---|---|---|---|
| 1 | 관리자 개요 | `/admin/` | 관리자 | 통계 카드 + 최근 활동 |
| 2 | 글 관리 | `/admin/posts/` | 관리자 | 기존 `/admin/` 내용 이동 |
| 3 | 글 작성/수정 | `/admin/write/?slug=` | 관리자 | 변경 없음 |
| 4 | 회원 관리 | `/admin/members/` | 관리자 | 목록, 검색, 정렬, 비밀번호 초기화 |
| 5 | 회원 상세 | `/admin/members/?id={uuid}` | 관리자 | 학습활동 + 피드백 대화 |
| 6 | 학습 현황 | `/admin/learning/?tab={overview\|apps\|assignments\|engagement}` | 관리자 | 과제 관리 포함(§검토 참고) |
| 7 | 새 비밀번호 설정 | `/reset-password/` | 로그인 사용자 | 강제/자발적 비밀번호 변경 |
| 8 | 내 학습 활동 | `/me/learning/?tab={apps\|posts\|social\|assignments\|feedback}` | 로그인 사용자 | 학생 화면 |

**검토(과제 관리 위치)**: `/admin/learning/` 안의 탭으로 둔다(별도 `/admin/assignments/` 화면 대신). 과제 자체가 "학습 현황"의 한 축이고, 제출 검토 화면에서 그 학생의 다른 학습 데이터(웹앱 결과·읽은 글)를 함께 참고할 일이 많기 때문이다. 탭은 querystring(`?tab=`)으로 구분해 정적 export와 호환되게 한다.

---

## 3. 화면별 상세

### 3.0 공통: 관리자 레이아웃

- `src/app/admin/layout.tsx`(신규): `<AdminGuard>`만 담당(전 `/admin/*`에 적용). 로그인 안 함 → `/login/`, 로그인했지만 비관리자 → 안내(기존 `admin-guard.tsx` 그대로 재사용).
- `src/app/admin/(dashboard)/layout.tsx`(신규, Route Group — URL에 영향 없음): 대시보드 크롬(좌측 사이드 내비 + 모바일 상단 탭/드로어)을 `개요/글 관리/회원 관리/학습 현황`에만 씌운다.
- `/admin/write/`는 이 Route Group 밖에 남겨 기존처럼 넓은 폭(에디터 전용 레이아웃)을 유지한다. `AdminGuard`는 상위 `admin/layout.tsx`에서 이미 적용되므로 각 페이지에서 중복 호출하지 않는다(현재 `admin/page.tsx`처럼 페이지마다 `<AdminGuard>`로 감싸는 방식은 제거).
- 데스크톱: 세로 사이드 메뉴(아이콘+라벨, 활성 항목 강조) — 기존 `site-header`의 유저 메뉴 항목(글 관리/회원 관리/학습 현황)과 별개로, 대시보드 안에서는 이 좌측 메뉴로 이동한다.
- 모바일: 상단 가로 스크롤 탭(4개라 드로어보다 탭이 간단) — `Tabs`(shadcn, 이미 설치됨) 재사용.

### 3.1 관리자 개요 `/admin/`

- **구성**: 통계 카드 4개(전체 회원 수, 오늘 학습결과 수, 검토 대기 과제 제출 수, 안 읽은 피드백 수) · 최근 가입 회원 5명 · 최근 학습활동 5건(웹앱 결과/과제 제출 섞어서 시간순) · 바로가기 카드(회원 관리/학습 현황/과제 관리로).
- **데이터**: `supabase.rpc('admin_dashboard_stats')`(§4 RPC, 카드 4개용) + `member_directory` 최신 5개 + `app_results`/`assignment_submissions` 최신 5개(client에서 합쳐서 시간순 정렬).
- **상태**: 카드별 개별 로딩/오류(기존 `StatTile` 패턴 재사용), 목록 로딩/빈("아직 활동이 없습니다")/오류.
- **권한**: 관리자만(레이아웃의 `AdminGuard`).

### 3.2 글 관리 `/admin/posts/`

- 기존 `/admin/`(`AdminPostList`)을 그대로 옮긴다. 쿼리/기능 변경 없음. "새 글 작성" 버튼은 `/admin/write/`로 그대로 연결.

### 3.3 글 작성/수정 `/admin/write/`

- 변경 없음(경로·기능 유지).

### 3.4 회원 관리 `/admin/members/`

- **구성**: 검색창(아이디/이메일/이름) · 정렬 가능한 표(이름, 아이디/이메일, 가입 방식 배지, 가입일, 마지막 로그인, 역할 배지) · 행 클릭 시 `/admin/members/?id=`로 이동 · 각 행에 "비밀번호 초기화" 버튼(이메일 계정만 노출, OAuth 전용 계정은 비활성 + "OAuth 계정" 표시).
- **데이터**: `supabase.from('member_directory').select('*, profiles(display_name, role)').order('signed_up_at', { ascending: false })` 한 번에 전체 조회(학급 규모 가정 — §11). 검색/정렬은 클라이언트에서 처리(기존 `admin-post-list.tsx`의 fetch-all 패턴과 동일). 인원이 많아지면 서버 필터로 전환 추천(§12).
- **비밀번호 초기화 동작**:
  1. "비밀번호 초기화" 클릭 → 확인 다이얼로그("OO 학생의 비밀번호를 초기화할까요? 기존 비밀번호는 즉시 쓸 수 없게 됩니다").
  2. 확인 → `supabase.functions.invoke('admin-reset-password', { body: { userId } })`.
  3. 성공 → 결과 다이얼로그에 임시 비밀번호를 **한 번만** 보여주고 복사 버튼 제공. 닫으면 다시 볼 수 없다는 경고 문구. 이 다이얼로그를 닫기 전에는 `onOpenChange`로 실수로 닫히지 않게 확인(기존 `AlertDialogAction` 자동 미닫힘 패턴과 동일하게 별도 "확인했어요, 닫기" 버튼으로만 닫음).
  4. 실패(오류 메시지는 Edge Function이 준 한국어 문구 또는 공통 오류 토스트).
- **상태**: 로딩(스켈레톤 표) · 빈 · 오류(재시도) · 초기화 처리 중(버튼 스피너, 행별 busy 관리 — `admin-post-list.tsx`의 `busyIds` 패턴 재사용).
- **권한**: 관리자만.

### 3.5 회원 상세 `/admin/members/?id=`

- **구성**: 프로필 요약 카드(이름/아이디·이메일/가입방식/가입일/마지막 로그인/역할) · "관리자 지정/해제" 버튼(§12 Q2) · 탭(웹앱 결과 / 읽은 글 / 댓글·좋아요 / 과제 제출 / 피드백 대화).
- **데이터**:
  - 프로필: `member_directory` + `profiles` 조인(3.4와 동일 컬럼, id 필터).
  - 웹앱 결과: `app_results.select('*').eq('user_id', id).order('created_at', {ascending:false})`.
  - 읽은 글: `post_reads.select('*, posts(title, slug)').eq('user_id', id).order('last_read_at', {ascending:false})`.
  - 댓글: `comments.select('id,body,created_at,post_id,posts(title,slug)').eq('user_id', id)`. 좋아요: `likes.select('post_id,created_at,posts(title,slug)').eq('user_id', id)`.
  - 과제 제출: `assignment_submissions.select('*, assignments(title,due_at)').eq('user_id', id)`.
  - 피드백: `get_or_create_feedback_thread(id, 'general', null)`로 일반 스레드를 얻은 뒤 메시지 목록 + 답장 폼(`FeedbackThread` 컴포넌트, §3.9 참고). 특정 결과/제출 옆에 "피드백 남기기" 버튼을 두면 해당 컨텍스트로 스레드를 만든다.
- **상태**: 각 탭 독립 로딩/빈/오류. `id`가 잘못됐거나 없으면 "회원을 찾을 수 없습니다" + 목록으로 이동 버튼.
- **권한**: 관리자만. `useSearchParams` 사용 → `<Suspense>` 필요.

### 3.6 학습 현황 `/admin/learning/`

공통: 상단 탭(개요/웹앱 결과/과제 관리/참여 집계). 탭은 `?tab=`으로 전환.

- **개요(`overview`, 기본값)**: 전체 웹앱 시도 수 · 앱별 완료율/평균 점수 표(`src/data/apps.ts`의 `webApps` 각각에 대해 `app_results` 집계) · 최근 활동 피드(전체 학생, 최신순 20건).
- **웹앱 결과(`apps`)**: 앱 선택 드롭다운(웹앱 없으면 안내) → 해당 앱의 전체 학생 시도 목록(이름, 점수/만점, 완료 여부, 소요 시간, 일시) 표, 학생 이름 클릭 시 `/admin/members/?id=`로 이동.
- **과제 관리(`assignments`)**:
  - 과제 목록(제목, 마감일, 공개 여부, 제출 수/전체 회원 수) · "새 과제" 버튼 → 다이얼로그(제목, 설명 마크다운 textarea + `MarkdownViewer` 미리보기 재사용, 마감일 `datetime-local`, 공개 여부 스위치).
  - 과제 클릭(`?tab=assignments&assignment={id}`) → 제출 현황: 회원별 1행(제출 안 함 포함), 상태 배지(미제출/제출/검토완료/수정요청), 제출 내용(텍스트/링크) 펼쳐보기, 상태 변경 select, "피드백 남기기"(해당 제출에 연결된 스레드 열기).
  - 과제 수정/삭제(발행 취소 = 비공개 전환, 삭제는 확인 다이얼로그 — 삭제 시 제출물도 함께 삭제됨을 경고).
- **참여 집계(`engagement`)**: 글별 조회수/댓글수/좋아요수/읽은 인원 수 표(기존 `posts`/`views`/`comments`/`likes` 집계, 새 테이블 없이 count 쿼리로 구성 — §4 "집계 방식" 참고).
- **데이터/상태/권한**: 각 섹션 독립 로딩/빈/오류. 관리자만. `useSearchParams`(`tab`, `assignment`) → `<Suspense>`.

### 3.7 새 비밀번호 설정 `/reset-password/`

- **목적**: 관리자가 초기화한 임시 비밀번호로 로그인한 학생이 강제로 거치는 화면. 로그인한 사용자라면 누구나 자발적으로도 쓸 수 있다(비밀번호 변경 기능 겸용).
- **구성**: 새 비밀번호 입력 + 확인 입력(8자 이상 안내), "왜 이 화면이 나오나요?"(강제 진입일 때만) 안내문, 저장 버튼.
- **Supabase**: `supabase.auth.updateUser({ password })` → 성공 시 `supabase.rpc('clear_must_change_password')` → `/`로 이동(토스트).
- **상태**: 저장 중 · 비밀번호 불일치/너무 짧음(클라이언트 검증) · 오류(예: 너무 흔한 비밀번호 — Supabase 기본 정책 오류 메시지 한국어화).
- **권한**: 로그인 필요(비로그인 → `/login/`). `must_change_password`가 아니어도 접근은 허용(자발적 변경).

### 3.8 내 학습 활동 `/me/learning/`

- **진입**: 헤더 유저 메뉴에 "내 학습 활동" 항목 추가(모든 로그인 사용자). 안 읽은 피드백이 있으면 배지(점 또는 숫자).
- **구성**: 상단 탭(웹앱 결과/읽은 글/댓글·좋아요/과제/피드백).
  - 웹앱 결과: 내 `app_results` 목록(앱 이름은 `src/data/apps.ts`에서 `app_id`로 매칭, 없으면 "삭제된 앱"), 점수/완료/소요시간/일시.
  - 읽은 글: 내 `post_reads` 목록, 글로 이동 링크.
  - 댓글·좋아요: 내 댓글 목록(수정/삭제는 기존 글 상세 화면에서), 내가 좋아요한 글 목록.
  - 과제: 공개된 과제 목록 + 내 제출 상태. 미제출 과제는 "제출하기"(텍스트/링크 폼), 제출한 과제는 "수정"(마감 정책은 §12 Q1) 가능.
  - 피드백: 내 스레드 목록(일반 대화 1개 + 컨텍스트 연결 대화들), 각 스레드 열어 대화 + 답장(`FeedbackThread` 재사용).
- **상태**: 탭별 로딩/빈("아직 기록이 없어요")/오류. 비로그인 접근 시 `LoginRequiredTooltip`류 안내 대신 전체 화면 "로그인이 필요합니다" + 로그인 버튼(기존 `EmptyState` 패턴).
- **권한**: 로그인 사용자 본인 데이터만(RLS로 강제).

### 3.9 공통 컴포넌트: `FeedbackThread`

- 메시지 목록(발신자 이름/아바타, 시각, 본문 — 텍스트만, 마크다운 아님) + 답장 textarea + 전송 버튼.
- 마운트 시 `mark_thread_read` RPC 호출(뱃지 갱신).
- 관리자 쪽에서는 학생 이름이 헤더에 보이고, 학생 쪽에서는 상대가 "선생님"으로 표시.

---

## 4. DB 스키마

### 4.1 기존 스키마 변경

```sql
alter table public.profiles
  add column must_change_password boolean not null default false;
-- 주의: 기존 `grant update (display_name, avatar_url) on public.profiles to authenticated;`에
-- must_change_password를 추가하지 않는다 → 학생이 스스로 끌 수 없다.
-- 해제는 아래 clear_must_change_password() RPC(security definer)로만 가능하다.
```

### 4.2 `member_directory` — 회원 목록용 동기화 테이블 (Edge Function 없이 처리)

```sql
create table public.member_directory (
  id               uuid primary key references public.profiles (id) on delete cascade,
  email            text not null,
  provider         text,                       -- 대표 가입 방식(email/github/google)
  providers        text[] not null default '{}', -- 연결된 모든 방식
  signed_up_at     timestamptz not null,
  last_sign_in_at  timestamptz,
  updated_at       timestamptz not null default now()
);

alter table public.member_directory enable row level security;

create policy "member_directory: 관리자만 조회"
  on public.member_directory for select
  using (public.is_admin());

revoke all on public.member_directory from anon, authenticated;
grant select on public.member_directory to authenticated; -- RLS가 관리자만 걸러줌

-- auth.users 동기화 트리거 (handle_new_user와 같은 패턴)
create or replace function public.sync_member_directory()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.member_directory (id, email, provider, providers, signed_up_at, last_sign_in_at)
  values (
    new.id,
    new.email,
    new.raw_app_meta_data ->> 'provider',
    coalesce(
      (select array_agg(x) from jsonb_array_elements_text(coalesce(new.raw_app_meta_data -> 'providers', '[]'::jsonb)) as x),
      '{}'
    ),
    new.created_at,
    new.last_sign_in_at
  )
  on conflict (id) do update set
    email = excluded.email,
    provider = excluded.provider,
    providers = excluded.providers,
    last_sign_in_at = excluded.last_sign_in_at,
    updated_at = now();
  return new;
end;
$$;

create trigger on_auth_user_created_directory
  after insert on auth.users
  for each row execute function public.sync_member_directory();

create trigger on_auth_user_updated_directory
  after update on auth.users
  for each row execute function public.sync_member_directory();
```

### 4.3 `app_results` — 웹앱 학습 결과 (append-only 로그)

```sql
create table public.app_results (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  app_id           text not null check (char_length(app_id) between 1 and 100),
  score            numeric,
  max_score        numeric,
  completed        boolean not null default false,
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  details          jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now()
);

create index app_results_user_idx on public.app_results (user_id, created_at desc);
create index app_results_app_idx  on public.app_results (app_id, created_at desc);

alter table public.app_results enable row level security;

create policy "app_results: 본인 또는 관리자 조회"
  on public.app_results for select
  using (auth.uid() = user_id or public.is_admin());

create policy "app_results: 본인만 기록"
  on public.app_results for insert
  to authenticated
  with check (auth.uid() = user_id);
-- update/delete 정책 없음 = 학생은 기록을 고치거나 지울 수 없다(로그 보존). 필요하면 관리자 delete 정책을 별도로 추가.
```

### 4.4 `post_reads` — 글 읽기 기록

```sql
create table public.post_reads (
  user_id       uuid not null references public.profiles (id) on delete cascade,
  post_id       uuid not null references public.posts (id) on delete cascade,
  first_read_at timestamptz not null default now(),
  last_read_at  timestamptz not null default now(),
  read_count    integer not null default 1,
  primary key (user_id, post_id)
);

alter table public.post_reads enable row level security;

create policy "post_reads: 본인 또는 관리자 조회"
  on public.post_reads for select
  using (auth.uid() = user_id or public.is_admin());
-- insert/update 직접 grant 없음: 아래 record_post_read() RPC로만 기록한다(increment_post_view와 같은 패턴).

create or replace function public.record_post_read(p_post_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    return;
  end if;
  if not exists (select 1 from public.posts where id = p_post_id and published) then
    return;
  end if;
  insert into public.post_reads (user_id, post_id)
  values (auth.uid(), p_post_id)
  on conflict (user_id, post_id)
  do update set last_read_at = now(), read_count = public.post_reads.read_count + 1;
end;
$$;

revoke all on function public.record_post_read(uuid) from public;
grant execute on function public.record_post_read(uuid) to authenticated;
```

글 상세 페이지 마운트 시(로그인 상태에서, 세션당 1회 — 기존 `view-counter.tsx`의 `sessionStorage` 중복 방지 패턴 재사용) 호출한다.

### 4.5 `assignments` / `assignment_submissions` — 과제

```sql
create table public.assignments (
  id             uuid primary key default gen_random_uuid(),
  title          text not null check (char_length(title) between 1 and 200),
  description_md text not null default '',
  due_at         timestamptz,
  published      boolean not null default false,
  created_by     uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create trigger assignments_updated_at
  before update on public.assignments
  for each row execute function public.set_updated_at();

alter table public.assignments enable row level security;

create policy "assignments: 공개된 것은 누구나, 관리자는 전체 조회"
  on public.assignments for select
  using (published or public.is_admin());

create policy "assignments: 관리자만 작성/수정/삭제"
  on public.assignments for all
  using (public.is_admin())
  with check (public.is_admin());

create table public.assignment_submissions (
  id            uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments (id) on delete cascade,
  user_id       uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  body_md       text not null default '',
  link_url      text,
  status        text not null default 'submitted' check (status in ('submitted', 'reviewed', 'needs_revision')),
  submitted_at  timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (assignment_id, user_id)
);

create index assignment_submissions_assignment_idx on public.assignment_submissions (assignment_id);
create index assignment_submissions_user_idx on public.assignment_submissions (user_id);

create trigger assignment_submissions_updated_at
  before update on public.assignment_submissions
  for each row execute function public.set_updated_at();

alter table public.assignment_submissions enable row level security;

create policy "assignment_submissions: 본인 또는 관리자 조회"
  on public.assignment_submissions for select
  using (auth.uid() = user_id or public.is_admin());

create policy "assignment_submissions: 본인이 공개 과제에 제출"
  on public.assignment_submissions for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.assignments a where a.id = assignment_id and a.published)
  );

create policy "assignment_submissions: 본인 또는 관리자 수정"
  on public.assignment_submissions for update
  to authenticated
  using (auth.uid() = user_id or public.is_admin())
  with check (auth.uid() = user_id or public.is_admin());

create policy "assignment_submissions: 관리자만 삭제"
  on public.assignment_submissions for delete
  using (public.is_admin());

-- 학생은 body_md/link_url만, 관리자는 status만 바꿀 수 있게 트리거로 제한한다.
-- (comments처럼 컬럼 GRANT로는 admin/일반 사용자를 구분할 수 없다 — 둘 다 authenticated 롤이기 때문)
create or replace function public.assignment_submission_guard()
returns trigger
language plpgsql
as $$
begin
  if public.is_admin() then
    if new.body_md is distinct from old.body_md or new.link_url is distinct from old.link_url
       or new.user_id is distinct from old.user_id or new.assignment_id is distinct from old.assignment_id then
      raise exception '관리자는 상태만 변경할 수 있습니다.';
    end if;
  else
    if new.status is distinct from old.status then
      raise exception '상태는 관리자만 변경할 수 있습니다.';
    end if;
  end if;
  return new;
end;
$$;

create trigger assignment_submissions_guard
  before update on public.assignment_submissions
  for each row execute function public.assignment_submission_guard();
```

### 4.6 피드백 스레드

```sql
create table public.feedback_threads (
  id           uuid primary key default gen_random_uuid(),
  student_id   uuid not null references public.profiles (id) on delete cascade,
  context_type text not null default 'general' check (context_type in ('general', 'app_result', 'assignment_submission')),
  context_id   uuid,
  context_key  text generated always as (context_type || ':' || coalesce(context_id::text, '')) stored,
  created_at   timestamptz not null default now(),
  unique (student_id, context_key)
);

alter table public.feedback_threads enable row level security;

create policy "feedback_threads: 본인 또는 관리자 조회"
  on public.feedback_threads for select
  using (auth.uid() = student_id or public.is_admin());

create policy "feedback_threads: 본인 또는 관리자 생성"
  on public.feedback_threads for insert
  to authenticated
  with check (auth.uid() = student_id or public.is_admin());

create table public.feedback_messages (
  id         uuid primary key default gen_random_uuid(),
  thread_id  uuid not null references public.feedback_threads (id) on delete cascade,
  sender_id  uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  body       text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index feedback_messages_thread_idx on public.feedback_messages (thread_id, created_at);

alter table public.feedback_messages enable row level security;

create policy "feedback_messages: 스레드 접근 가능자만 조회"
  on public.feedback_messages for select
  using (
    public.is_admin()
    or exists (select 1 from public.feedback_threads t where t.id = thread_id and t.student_id = auth.uid())
  );

create policy "feedback_messages: 본인 발신, 스레드 접근 가능해야 함"
  on public.feedback_messages for insert
  to authenticated
  with check (
    auth.uid() = sender_id
    and (
      public.is_admin()
      or exists (select 1 from public.feedback_threads t where t.id = thread_id and t.student_id = auth.uid())
    )
  );

create table public.feedback_read_marks (
  thread_id     uuid not null references public.feedback_threads (id) on delete cascade,
  user_id       uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  last_read_at  timestamptz not null default now(),
  primary key (thread_id, user_id)
);

alter table public.feedback_read_marks enable row level security;

create policy "feedback_read_marks: 본인만 조회/기록"
  on public.feedback_read_marks for all
  to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (
      public.is_admin()
      or exists (select 1 from public.feedback_threads t where t.id = thread_id and t.student_id = auth.uid())
    )
  );

-- 스레드 찾기/만들기 (경쟁 상태 없이)
create or replace function public.get_or_create_feedback_thread(p_student_id uuid, p_context_type text, p_context_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not (auth.uid() = p_student_id or public.is_admin()) then
    raise exception '권한이 없습니다.';
  end if;
  insert into public.feedback_threads (student_id, context_type, context_id)
  values (p_student_id, p_context_type, p_context_id)
  on conflict (student_id, context_key) do nothing
  returning id into v_id;
  if v_id is null then
    select id into v_id from public.feedback_threads
    where student_id = p_student_id
      and context_type = p_context_type
      and context_key = p_context_type || ':' || coalesce(p_context_id::text, '');
  end if;
  return v_id;
end;
$$;

create or replace function public.mark_thread_read(p_thread_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.feedback_threads t
    where t.id = p_thread_id and (t.student_id = auth.uid() or public.is_admin())
  ) then
    return;
  end if;
  insert into public.feedback_read_marks (thread_id, user_id, last_read_at)
  values (p_thread_id, auth.uid(), now())
  on conflict (thread_id, user_id) do update set last_read_at = now();
end;
$$;

create or replace function public.unread_feedback_count()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::int
  from public.feedback_messages m
  join public.feedback_threads t on t.id = m.thread_id
  left join public.feedback_read_marks r on r.thread_id = t.id and r.user_id = auth.uid()
  where m.sender_id <> auth.uid()
    and (public.is_admin() or t.student_id = auth.uid())
    and m.created_at > coalesce(r.last_read_at, '-infinity'::timestamptz);
$$;

revoke all on function public.get_or_create_feedback_thread(uuid, text, uuid) from public;
grant execute on function public.get_or_create_feedback_thread(uuid, text, uuid) to authenticated;
revoke all on function public.mark_thread_read(uuid) from public;
grant execute on function public.mark_thread_read(uuid) to authenticated;
revoke all on function public.unread_feedback_count() from public;
grant execute on function public.unread_feedback_count() to authenticated;
```

### 4.7 관리자 편의 RPC

```sql
-- 강제 비밀번호 변경 플래그 해제(본인만, 클라이언트가 새 비밀번호 설정 성공 후 호출)
create or replace function public.clear_must_change_password()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.profiles set must_change_password = false where id = auth.uid();
$$;

-- 관리자 지정/해제 (§12 Q2)
create or replace function public.admin_set_role(p_user uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception '관리자만 사용할 수 있습니다.';
  end if;
  if p_role not in ('admin', 'user') then
    raise exception '잘못된 역할입니다.';
  end if;
  update public.profiles set role = p_role where id = p_user;
end;
$$;

-- 개요 화면 통계(단일 호출로 4개 숫자)
create or replace function public.admin_dashboard_stats()
returns table (total_members int, results_today int, pending_submissions int, unread_feedback int)
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select count(*) from public.member_directory),
    (select count(*) from public.app_results where created_at >= date_trunc('day', now())),
    (select count(*) from public.assignment_submissions where status = 'submitted'),
    public.unread_feedback_count()
  where public.is_admin();
$$;

revoke all on function public.clear_must_change_password() from public;
grant execute on function public.clear_must_change_password() to authenticated;
revoke all on function public.admin_set_role(uuid, text) from public;
grant execute on function public.admin_set_role(uuid, text) to authenticated;
revoke all on function public.admin_dashboard_stats() from public;
grant execute on function public.admin_dashboard_stats() to authenticated;
```

### 4.8 인덱스 요약

| 테이블 | 인덱스 | 목적 |
|---|---|---|
| `app_results` | `(user_id, created_at desc)`, `(app_id, created_at desc)` | 회원 상세/앱별 목록 |
| `assignment_submissions` | `(assignment_id)`, `(user_id)` | 과제별/회원별 제출 조회 |
| `feedback_messages` | `(thread_id, created_at)` | 스레드별 시간순 조회 |
| `post_reads` | PK `(user_id, post_id)`만으로 충분(둘 다 소량 조합 조회) | — |
| `member_directory` | PK `(id)`만 | 조인 위주, 전체 조회라 추가 인덱스 불필요 |

### 4.9 집계 방식(참여 집계 탭, §3.6)

새 테이블/뷰를 만들지 않고 기존 `comments`/`likes`/`views`를 그대로 count 쿼리로 읽는다(`docs/blog/spec.md` §10에서 이미 "글이 많아지면 캐시 컬럼 고려"로 유보한 결정을 유지). 글 수가 적은 학급 규모에서는 문제 없고, 나중에 필요해지면 그때 캐시 컬럼/트리거를 별도 마이그레이션으로 추가하는 편이 안전하다.

---

## 5. Edge Function 설계

**결론: 1개만 필요하다(`admin-reset-password`).** 회원 목록의 가입방식/이메일/마지막 로그인은 §4.2 트리거로 해결해 Edge Function이 필요 없다.

### 5.1 `admin-reset-password`

| 항목 | 내용 |
|---|---|
| 경로 | `supabase/functions/admin-reset-password/index.ts` |
| 요청 | `POST`, body `{ "userId": "<auth.users id>" }`, header `Authorization: Bearer <호출자 access token>`(supabase-js `functions.invoke`가 자동 첨부) |
| 응답(성공) | `200 { "tempPassword": "Ab3dEfGh9k" }` |
| 응답(실패) | `401`(로그인 안 됨/토큰 무효) · `403`(관리자 아님) · `400`(userId 없음/OAuth 전용 계정) · `404`(대상 없음) · `500`(Auth API 오류), 모두 `{ "error": "한국어 메시지" }` |
| 검증 | ① 토큰으로 호출자 조회(`auth.getUser`) ② `profiles.role`이 `admin`인지 서비스 롤로 확인 ③ 대상 계정의 `app_metadata.providers`에 `"email"`이 없으면 거부 |
| 동작 | 무작위 임시 비밀번호(혼동되는 글자 제외 10자) 생성 → `auth.admin.updateUserById(userId, { password })` → `profiles.must_change_password = true`로 갱신(서비스 롤이라 RLS 무관) |
| CORS | `Access-Control-Allow-Origin`을 `https://eversunk2-tech.github.io`, `http://localhost:3000`만 허용. `OPTIONS` 프리플라이트 응답 포함 |
| 비밀번호 노출 | 응답 본문에만 담기고 로그(`console.log`)에는 남기지 않는다. 함수는 상태를 저장하지 않으므로 다시 볼 방법이 없다(관리자가 다이얼로그를 닫으면 끝 — §3.4에서 재차 경고) |

```ts
// supabase/functions/admin-reset-password/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = new Set([
  "https://eversunk2-tech.github.io",
  "http://localhost:3000",
]);

function corsHeaders(origin: string | null) {
  const allow = origin && ALLOWED_ORIGINS.has(origin) ? origin : "";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers": "authorization, content-type, apikey",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

function randomTempPassword(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789"; // 0/O, 1/l/I 제외
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

function json(data: unknown, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(data), { status, headers: { ...headers, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  const headers = corsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response(null, { headers });
  if (req.method !== "POST") return json({ error: "지원하지 않는 요청입니다." }, 405, headers);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const jwt = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!jwt) return json({ error: "로그인이 필요합니다." }, 401, headers);

  const callerClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: `Bearer ${jwt}` } } });
  const { data: callerData, error: callerErr } = await callerClient.auth.getUser();
  if (callerErr || !callerData.user) return json({ error: "유효하지 않은 로그인입니다." }, 401, headers);

  const admin = createClient(supabaseUrl, serviceKey);

  const { data: profile } = await admin.from("profiles").select("role").eq("id", callerData.user.id).single();
  if (profile?.role !== "admin") return json({ error: "관리자만 사용할 수 있습니다." }, 403, headers);

  const body = await req.json().catch(() => null);
  const targetId = body?.userId;
  if (typeof targetId !== "string" || !targetId) return json({ error: "userId가 필요합니다." }, 400, headers);

  const { data: target, error: targetErr } = await admin.auth.admin.getUserById(targetId);
  if (targetErr || !target.user) return json({ error: "대상 계정을 찾을 수 없습니다." }, 404, headers);

  const providers: string[] = target.user.app_metadata?.providers ?? [];
  if (!providers.includes("email")) return json({ error: "OAuth 전용 계정은 비밀번호를 초기화할 수 없습니다." }, 400, headers);

  const tempPassword = randomTempPassword();
  const { error: updateErr } = await admin.auth.admin.updateUserById(targetId, { password: tempPassword });
  if (updateErr) return json({ error: "비밀번호를 초기화하지 못했습니다." }, 500, headers);

  await admin.from("profiles").update({ must_change_password: true }).eq("id", targetId);

  return json({ tempPassword }, 200, headers);
});
```

### 5.2 배포 방법 (사용자가 직접 수행 — §10)

**방법 A: Supabase CLI**
```bash
npm install -g supabase          # 또는 npx supabase
supabase login
supabase link --project-ref <project-ref>
supabase functions deploy admin-reset-password
```
`SUPABASE_URL`/`SUPABASE_ANON_KEY`/`SUPABASE_SERVICE_ROLE_KEY`는 Supabase가 모든 Edge Function에 자동으로 주입하므로 `supabase secrets set`이 따로 필요 없다.

**방법 B: 대시보드 에디터**
1. Supabase 대시보드 → 프로젝트 → **Edge Functions** → **Create a function** → 이름 `admin-reset-password`.
2. 코드 에디터에 위 `index.ts` 내용을 붙여넣고 **Deploy**.
3. **Functions → admin-reset-password → Invoke URL** 확인(클라이언트는 `supabase.functions.invoke()`가 URL을 자동으로 구성하므로 직접 쓸 일은 거의 없음).

두 방법 모두 배포 후 **관리자 계정으로 로그인한 상태에서 브라우저 콘솔로 1회 호출해 CORS·권한 확인**을 권장한다(§3.4 체크리스트에 포함).

---

## 6. 웹앱 기록 헬퍼 API

### 6.1 배치 방식 트레이드오프 (플랜 지침 요구사항)

| 방식 | 설명 | 장점 | 단점 |
|---|---|---|---|
| A. 공용 파일 참조 | `/class1/lib/class1-record.js` 하나를 모든 앱이 절대경로로 로드 | 수정 한 곳만 고치면 전체 반영 | `CLAUDE.md` §웹앱 규칙("자체 완결", "상대경로만") 정면 위반. 앱을 폴더째 복사/이동하면 깨짐 |
| **B. 각 앱에 복사(추천)** | 앱을 만들 때마다 아래 스니펫을 `public/apps/{앱}/class1-record.js`로 그대로 복사 | 기존 규칙과 100% 합치, 앱이 폴더 단위로 완전히 독립·이식 가능 | 헬퍼 버그 수정 시 이미 만든 앱들에 일일이 다시 복사해야 함 |

**추천: B.** 대신 완화책으로 `scripts/templates/class1-record.js`(브라우저에 서빙되지 않는 저장소 내부 템플릿 — 이번 Plan 단계에서는 만들지 않음, Build 단계에서 추가)를 "정본"으로 두고, 새 웹앱을 만들 때마다 거기서 복사하도록 CLAUDE.md 웹앱 규칙에 한 줄 추가하는 것을 사용자에게 제안한다(§10).

### 6.2 앱 폴더 구성

```
public/apps/{앱이름}/
├── index.html            # <script src="./config.js">, <script src="./class1-record.js"> 순서로 로드
├── config.js             # window.CLASS1_CONFIG = { SUPABASE_URL, SUPABASE_ANON_KEY } — 기존 CLAUDE.md 규칙 그대로
└── class1-record.js      # 아래 스니펫을 그대로 복사
```

### 6.3 `class1-record.js` (복사용 스니펫)

```js
// class1-record.js — 학습 결과 기록 헬퍼. 앱 폴더에 그대로 복사해서 쓴다.
// 블로그(같은 basePath 아래)와 로그인 세션을 공유한다는 전제(둘 다 같은 Supabase 프로젝트,
// supabase-js 기본 storageKey를 그대로 쓰면 localStorage를 함께 읽는다).
(function () {
  var SUPABASE_URL = window.CLASS1_CONFIG.SUPABASE_URL;
  var SUPABASE_ANON_KEY = window.CLASS1_CONFIG.SUPABASE_ANON_KEY;
  var APP_ID = "{여기에 폴더명을 그대로 적는다}"; // public/apps/{앱이름}/ 과 같아야 한다

  var client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  async function getUser() {
    var res = await client.auth.getUser();
    return res.data.user || null;
  }

  /**
   * 학습 결과 1건을 기록한다. 로그인하지 않았으면 아무것도 하지 않고 { error: "not-logged-in" }을 돌려준다.
   * @param {{score?: number, maxScore?: number, completed?: boolean, durationSeconds?: number, details?: object}} result
   */
  async function recordResult(result) {
    var user = await getUser();
    if (!user) return { error: "not-logged-in" };
    return client.from("app_results").insert({
      app_id: APP_ID,
      user_id: user.id,
      score: result.score ?? null,
      max_score: result.maxScore ?? null,
      completed: !!result.completed,
      duration_seconds: result.durationSeconds ?? null,
      details: result.details ?? {},
    });
  }

  window.Class1Record = { getUser: getUser, recordResult: recordResult };
})();
```

`index.html`에 CDN supabase-js(정확한 버전 고정 + SRI 권장, `docs/blog/fix-1-report.md` #4와 같은 방식)를 먼저 로드한다:

```html
<script
  src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.58.0/dist/umd/supabase.js"
  integrity="sha384-…"
  crossorigin="anonymous"
></script>
<script src="./config.js"></script>
<script src="./class1-record.js"></script>
```

앱 코드에서:
```js
Class1Record.getUser().then(function (user) {
  document.getElementById("login-hint").hidden = !!user; // 로그인해야 저장된다는 안내
});
// 게임/퀴즈가 끝났을 때
Class1Record.recordResult({ score: 8, maxScore: 10, completed: true, durationSeconds: 132, details: { wrongAnswers: [2, 5] } });
```

### 6.4 기록 API 형태 요약

| 필드 | 타입 | 필수 | 비고 |
|---|---|---|---|
| `score` | number \| null | 아니오 | 점수 개념이 없는 앱은 생략 |
| `maxScore` | number \| null | 아니오 | |
| `completed` | boolean | 아니오(기본 false) | |
| `durationSeconds` | number \| null | 아니오 | |
| `details` | object | 아니오(기본 `{}`) | 자유 JSON(오답 목록, 단계별 기록 등) |

---

## 7. 인증·비밀번호 강제 변경 흐름

### 7.1 흐름

1. 관리자가 `/admin/members/`에서 "비밀번호 초기화" → Edge Function이 새 비밀번호 설정 + `profiles.must_change_password = true`.
2. 임시 비밀번호를 학생에게 전달(구두/메신저 등 사이트 밖에서 — 이 사이트는 전달 수단을 제공하지 않음).
3. 학생이 `/login/`에서 임시 비밀번호로 로그인.
4. 전역 가드(`ForcePasswordChangeGate`, `src/app/layout.tsx`에 마운트)가 `useSession().profile?.must_change_password === true`를 감지하면 **어느 경로에 있든** `/reset-password/`로 `router.replace`. 예외: 이미 `/reset-password/`에 있거나 `/login/`(재로그인 허용).
5. `/reset-password/`에서 새 비밀번호 저장 → `clear_must_change_password()` RPC → 플래그 해제 → `/`로 이동.

### 7.2 플래그 저장/해제

| 동작 | 방법 | 이유 |
|---|---|---|
| 켜기 | Edge Function이 서비스 롤로 `profiles.must_change_password = true` 직접 update | 서비스 롤은 RLS/GRANT를 무시하므로 가능 |
| 끄기 | 학생이 `clear_must_change_password()` RPC 호출(자기 id만) | `profiles`의 `grant update`에 이 컬럼이 없어 직접 update는 거부되므로, security definer RPC로만 열어준 통로 |
| 학생이 스스로 켜기/끄기 시도 | 불가 | RLS(`grant update (display_name, avatar_url)`)가 이 컬럼을 막음. RPC도 "끄기"만 허용 |

### 7.3 클라이언트 가드 구현 메모

- `src/components/force-password-change-gate.tsx`(신규): `useSession()`을 구독하는 클라이언트 컴포넌트. `loading`이면 아무것도 안 함. `must_change_password`가 true고 현재 `pathname`이 `/reset-password/`·`/login/`이 아니면 `router.replace('/reset-password/')`.
- `src/app/layout.tsx`의 `<SessionProvider>` 안, 다른 페이지 콘텐츠보다 먼저 마운트(리다이렉트가 화면 깜빡임 전에 걸리도록 최상위에 둔다). 완전한 깜빡임 방지는 정적 export 특성상 불가능(로그인 여부를 빌드 타임에 알 수 없음) — 짧은 스켈레톤은 허용.
- 저장하지 않은 입력이 날아갈 위험은 없음(이 가드가 걸리는 시점엔 다른 화면에 입력 중인 상태가 거의 없다고 가정 — 있다면 에디터의 `AdminGuard` "세션 만료" 패턴처럼 완화할 수 있으나 1차 범위 제외).
- `/reset-password/` URL은 로그인 페이지처럼 헤더/사이드바 없이 단독 레이아웃으로 둘지, 기존 레이아웃 안에 둘지는 구현 편의에 맡긴다(추천: 기존 레이아웃 유지 — 로그아웃 버튼에 접근할 수 있어야 하므로).

---

## 8. RLS 요약(신규 테이블)

| 테이블 | select | insert | update | delete |
|---|---|---|---|---|
| `member_directory` | 관리자만 | 트리거만(클라이언트 grant 없음) | 트리거만 | 없음(profiles cascade) |
| `app_results` | 본인 또는 관리자 | 본인만(`user_id=auth.uid()`) | 없음 | 없음 |
| `post_reads` | 본인 또는 관리자 | RPC만(`record_post_read`) | RPC만 | 없음 |
| `assignments` | 공개(`published`) 또는 관리자 | 관리자만 | 관리자만 | 관리자만 |
| `assignment_submissions` | 본인 또는 관리자 | 본인(공개 과제에 한함) | 본인(body/link) 또는 관리자(status) — 트리거로 컬럼 제한 | 관리자만 |
| `feedback_threads` | 본인 또는 관리자 | 본인 또는 관리자(RPC 경유 권장) | 없음 | 없음 |
| `feedback_messages` | 스레드 당사자 또는 관리자 | 본인 발신 + 스레드 접근 가능 | 없음 | 없음 |
| `feedback_read_marks` | 본인만 | 본인만(RPC 경유 권장) | 본인만 | 없음 |

**학생이 조작할 수 있는 한계와 완화책**: `app_results`는 클라이언트(웹앱)가 직접 insert하므로 점수·완료 여부·소요 시간을 학생이 임의로 조작해 전송할 수 있다(RLS는 "누구 이름으로 기록하는지"만 강제하고 "값이 진짜인지"는 강제할 수 없음). 이는 클라이언트 기록 방식의 근본적 한계이며, 완화책은 ① 이 데이터를 "형식적 평가"가 아니라 "학습 참여 확인" 용도로만 쓴다고 안내 ② 이상치(예: 만점, 소요시간 0초)가 관리자 화면에서 눈에 띄게 하는 정도이지 근본 차단은 아니다(§11).

---

## 9. 기존 코드 영향(파일 구조: 신규/수정/이동)

### 9.1 이동

| 기존 | 이동 후 |
|---|---|
| `src/app/admin/page.tsx` | `src/app/admin/(dashboard)/page.tsx` — 내용은 "개요"로 교체, 기존 글 목록 로직은 아래로 |
| `src/app/admin/admin-post-list.tsx` | `src/app/admin/(dashboard)/posts/admin-post-list.tsx` |
| (신규) | `src/app/admin/(dashboard)/posts/page.tsx` — 옮겨온 `AdminPostList` 렌더 |

### 9.2 신규 파일

| 경로 | 역할 |
|---|---|
| `supabase/migrations/20260921020000_admin_learning.sql` | §4 전체 SQL |
| `supabase/functions/admin-reset-password/index.ts` | §5 Edge Function |
| `src/app/admin/layout.tsx` | `AdminGuard`(전 `/admin/*`) |
| `src/app/admin/(dashboard)/layout.tsx` | 대시보드 크롬(사이드 내비/모바일 탭) |
| `src/app/admin/(dashboard)/page.tsx` | 개요(§3.1) |
| `src/app/admin/(dashboard)/members/page.tsx` + `member-list.tsx` + `member-detail.tsx` | 회원 관리(§3.4~3.5) |
| `src/app/admin/(dashboard)/learning/page.tsx` + `learning-overview.tsx`, `assignment-manager.tsx`, `submission-review.tsx`, `engagement-table.tsx` | 학습 현황(§3.6) |
| `src/app/reset-password/page.tsx` + `reset-password-form.tsx` | §3.7 |
| `src/app/me/learning/page.tsx` + `my-apps.tsx`, `my-posts.tsx`, `my-social.tsx`, `my-assignments.tsx`, `my-feedback.tsx` | §3.8 |
| `src/components/admin/admin-shell.tsx` | 대시보드 사이드 내비 + 모바일 탭 |
| `src/components/admin/password-reset-dialog.tsx` | §3.4 초기화 다이얼로그 |
| `src/components/feedback/feedback-thread.tsx` | §3.9 |
| `src/components/force-password-change-gate.tsx` | §7.3 |
| `src/hooks/use-unread-feedback.ts` | `unread_feedback_count()` 폴링(마운트 시 + 포커스 시) |
| `src/lib/learning.ts` | 새 테이블 쿼리 헬퍼 모음(각 화면 컴포넌트가 Supabase 쿼리를 직접 들고 있지 않게) |
| `scripts/templates/class1-record.js`(Build 단계에서 추가) | §6.1 정본 템플릿 |

### 9.3 수정 파일

| 경로 | 변경 |
|---|---|
| `src/lib/types.ts` | `Profile`에 `must_change_password` 추가, `MemberDirectory`/`AppResult`/`PostRead`/`Assignment`/`AssignmentSubmission`/`FeedbackThread`/`FeedbackMessage` 타입 추가 |
| `src/components/user-menu.tsx` | "글 관리" 링크 `/admin/` → `/admin/posts/`, "회원 관리"/"학습 현황" 항목 추가(관리자만), "내 학습 활동"(모든 로그인 사용자, 안 읽은 피드백 배지) 추가 |
| `src/app/layout.tsx` | `<ForcePasswordChangeGate>` 마운트 |
| `src/app/post/post-detail.tsx` | 로그인 상태로 글 열람 시 `record_post_read` 호출(조회수 증가 로직 옆) |
| `src/components/admin-guard.tsx` | 변경 없음(그대로 재사용, 호출 위치만 `admin/layout.tsx`로 통일) |

영향 없음(확인함): `site-header.tsx`/`topbar.tsx`(검색 링크만, 관리자 링크는 유저 메뉴에만 있어 그대로), `data/menu.ts`(사이드바 전역 메뉴에는 관리자 항목을 넣지 않음 — 3.0 참고), `tag-chip.tsx`, `post-card.tsx`.

---

## 10. 구현 단계 분할 (Build 서브에이전트용, 의존 순서)

| 단계 | 범위 | 의존 |
|---|---|---|
| 0 | 마이그레이션 SQL(§4) + Edge Function 코드(§5) 파일 작성. **실행/배포는 사용자가 함(§11)** | — |
| 1 | `/admin/` 레이아웃 재구성: `admin/layout.tsx`, `(dashboard)/layout.tsx`, 글 목록을 `posts/`로 이동, 관련 링크 수정(user-menu 등) | 0 |
| 2 | 강제 비밀번호 변경: `must_change_password` 반영한 `types.ts`, `ForcePasswordChangeGate`, `/reset-password/`, `clear_must_change_password` 연동 | 0 |
| 3 | 회원 관리: `/admin/members/` 목록/검색/정렬 + 상세(프로필 탭만, 학습활동 탭은 뒤 단계에서 채움) | 0, 1 |
| 4 | 비밀번호 초기화: Edge Function 배포(사용자) 후 3의 버튼과 연결, 결과 다이얼로그 | 3, (사용자의 0 배포) |
| 5 | 웹앱 기록: `class1-record.js` 템플릿 확정, `/me/learning/` 웹앱 결과 탭, 회원 상세 웹앱 결과 탭, `/admin/learning/` 개요·앱별 탭 | 0, 2 |
| 6 | 글 읽기 기록: `record_post_read` 연동, `/me/learning/` 읽은 글 탭, 회원 상세 탭 | 0, 2 |
| 7 | 참여 집계: 댓글·좋아요 조회 붙이기(`/me/learning/` 사회 탭, 회원 상세 탭, `/admin/learning/` 참여 집계 탭) | 0 |
| 8 | 과제: `assignments`/`assignment_submissions` 화면(관리자 CRUD+검토, 학생 제출) | 0, 1, 3 |
| 9 | 피드백: `FeedbackThread`, 회원 상세/학생 화면에 배치, 안 읽음 배지(`use-unread-feedback`) | 0, 3, 8(제출 연결 스레드 테스트용) |
| 10 | 개요 대시보드(`admin_dashboard_stats`) 연결 + 전체 QA(반응형/다크모드/`next build`) | 1~9 |

5·6·7·8은 서로 독립적이라 병렬화 가능. 9는 3이 끝나야 자연스럽고(학생 프로필 접근), 8이 끝나야 제출-연결 피드백을 실제로 테스트할 수 있다.

---

## 11. 사용자가 직접 할 일

1. **마이그레이션 실행**: Supabase 대시보드 SQL Editor에서 `supabase/migrations/20260921020000_admin_learning.sql` 실행(§4). 실행 후 확인: `select * from public.member_directory limit 1;`에 기존 회원이 보이는지(트리거는 신규 INSERT/UPDATE부터 동작하므로, 기존 회원은 한 번씩 `update auth.users set updated_at = now() where id = ...`로 트리거를 강제로 태우거나, 마이그레이션에 기존 `auth.users`를 한 번 훑어 `member_directory`를 채우는 `insert ... select`를 추가해야 한다 — **Build 단계에서 마이그레이션 파일에 이 백필 구문을 포함시킬 것**(Plan 단계에서는 SQL 초안에서 누락됨, 주의).
2. **Edge Function 배포**: §5.2의 방법 A(CLI) 또는 B(대시보드)로 `admin-reset-password` 배포.
3. **첫 관리자 지정**은 여전히 SQL Editor 1회 필요(`update public.profiles set role='admin' where id=...`) — `admin_set_role` RPC는 이미 관리자인 사람만 쓸 수 있어 최초 1명은 수동 지정이 불가피함.
4. **class1-record.js 정본 관리**: `scripts/templates/class1-record.js`를 Build 단계 산출물로 확인하고, 새 웹앱을 만들 때마다 그 파일을 복사해 쓰도록 `CLAUDE.md` §웹앱 규칙에 한 줄 추가할지 결정(이번 Plan은 `docs/admin/spec.md`만 수정 가능해 `CLAUDE.md`는 건드리지 않았음).
5. **배포 후 확인**: §3.4 체크리스트(관리자로 실제 회원 비밀번호 초기화 1회 시도), 학생 계정으로 로그인해 강제 리다이렉트·새 비밀번호 설정·`/me/learning/` 접근 확인.

---

## 12. 위험과 한계

- **`app_results` 신뢰도**: §8에서 설명한 대로 클라이언트가 보내는 값이라 조작 가능. 성적이 아닌 "참여 확인"용으로 안내할 것.
- **`member_directory` 트리거가 `auth.users` 내부 컬럼(`raw_app_meta_data`)에 의존**: Supabase가 이 컬럼 구조를 바꾸면(가능성은 낮음) 동기화가 깨질 수 있다. 문제가 생기면 이 한 함수(`sync_member_directory`)만 고치면 되도록 격리해 뒀다. 대안은 Edge Function으로 `listUsers`를 직접 호출하는 것(§0에서 비교한 방식) — 필요해지면 그때 전환.
- **Edge Function CORS 허용 목록이 코드에 하드코딩**: 새 도메인(예: 커스텀 도메인)을 쓰게 되면 코드 수정 후 재배포해야 한다.
- **임시 비밀번호는 정말로 1회성**: 관리자가 복사하지 않고 닫으면 다시 볼 수 없다(의도된 동작). 재발급은 다시 초기화 버튼을 누르면 된다(기존 임시 비밀번호는 즉시 무효화됨).
- **웹앱 iframe이 블로그와 같은 출처**: `docs/blog/review.md`에서 이미 지적된 한계(같은 origin이라 localStorage 세션에 접근 가능)가 `app_results` 기록으로 더 민감해진다. 신뢰할 수 있는 앱만 올려야 한다는 원칙이 이전보다 더 중요해짐.
- **회원/학습 목록은 전체 조회 후 클라이언트 필터**: 학급 30~100명 규모를 가정. 여러 반/학년으로 커지면 서버 사이드 검색(`ilike`)과 페이지네이션으로 바꿔야 한다.
- **여러 관리자 동시 답장**: `feedback_messages`에 잠금이 없어 동시에 같은 스레드에 답장하면 순서만 뒤섞일 뿐(둘 다 저장됨) 데이터 손실은 없음 — 채팅 성격상 허용 가능한 수준으로 판단.
- **과제 마감 후 정책 미확정**: §13 Q1 참고. 정책에 따라 `assignment_submissions` insert/update 정책에 `now() < due_at` 조건을 추가해야 할 수 있음(현재 SQL 초안에는 없음).

---

## 13. 열린 질문 (추천안 포함)

| # | 질문 | 추천안 |
|---|---|---|
| Q1 | 과제 마감 후 제출/수정을 막을지 | **허용하되 "지각" 표시** 추천(교실 상황상 융통성이 필요할 가능성이 높음). `submitted_at > assignments.due_at`이면 목록에 "지각" 배지만 붙이고 막지는 않음. 엄격하게 막고 싶다면 §4.5 insert/update 정책에 `now() < due_at or is_admin()` 조건 추가 |
| Q2 | 회원 상세에서 관리자 지정/해제 UI를 넣을지(`admin_set_role`) | **포함 추천** — SQL Editor 왕복 없이 운영 가능해짐. 실수 방지로 확인 다이얼로그 필수 |
| Q3 | `member_directory`를 트리거로 동기화하는 방식을 계속 쓸지, Edge Function 기반 목록 조회로 바꿀지 | 트리거 방식 유지 추천, 문제가 실제로 발생하면(§12) 그때 전환 |
| Q4 | 새 비밀번호 최소 길이(현재 Supabase 기본 6자) | 화면 안내는 8자 이상 권장 문구만 추가, 서버 정책은 Supabase 기본값 유지(대시보드에서 바꿀 수 있음을 안내만 함) |
| Q5 | `/me/learning/`의 피드백을 같은 페이지 탭으로 둘지, `/me/feedback/`으로 분리할지 | **같은 페이지 탭 통합** 추천 — 메뉴 항목을 늘리지 않고, 학습 데이터와 피드백을 함께 보는 편이 맥락 파악에 유리 |
| Q6 | 피드백 실시간 알림(Supabase Realtime) | **1차 범위 제외** 추천 — 마운트/포커스 시 재조회로 충분. 필요해지면 `feedback_messages`에 Realtime 구독 추가 |
| Q7 | 참여 집계 탭에 표 대신 차트가 필요한지 | 1차는 표로 추천(구현 단순, 학급 규모에서는 표로 충분). 데이터가 쌓이면 재검토 |
| Q8 | 학생이 과제 제출을 삭제할 수 있게 할지 | **불가 추천**(현재 SQL: delete는 관리자만) — 실수로 지우고 마감을 놓치는 상황 방지. 대신 마감 전까지 자유롭게 수정 가능 |

---

## 14. 확정 결정 (2026-09-21 사용자 승인)

이 절은 위 본문보다 우선한다.

| 항목 | 결정 |
|---|---|
| 승인 | spec 승인. 아래 외 열린 질문은 추천안 적용 |
| Q1 마감 후 | 제출·수정 허용 + "지각" 배지 |
| Q2 관리자 지정 UI | 포함 (확인 다이얼로그, 자기 자신 해제 불가, 마지막 관리자 해제 불가) |
| Q3 member_directory | 트리거 방식 유지. **마이그레이션에 기존 `auth.users` 백필 `insert ... select ... on conflict do update` 포함 필수** |
| Q4 비밀번호 길이 | 화면에 8자 이상 권장 문구, 서버 정책은 기본값 |
| Q5 피드백 위치 | `/me/learning/` 안의 탭 |
| Q6 실시간 알림 | 제외 (마운트/포커스 시 재조회) |
| Q7 차트 | 제외, 표 |
| Q8 제출 삭제 | **학생도 본인 제출물 삭제 가능 — 단 마감 전(`due_at`이 없거나 `now() < due_at`)이고 관리자 검토 완료 전일 때만.** 삭제 후 재제출 가능. 관리자는 언제나 삭제 가능. 제출에 연결된 피드백 스레드 처리(연결 해제 `on delete set null` 등)를 설계에 맞게 정한다 |
| class1-record.js | 정본은 `scripts/templates/class1-record.js`. 새 웹앱마다 앱 폴더로 복사 (CLAUDE.md 웹앱 규칙에 추가됨) |
