# 여러 반이 함께 쓰는 사이트 — 반별 데이터 분리 설계 (spec)

> Plan 단계 산출물. **구현하지 않음.** 이 문서는 승인용이며, 사용자가 §2의 질문에 답하고 승인하면 Build 서브에이전트가 이 문서를 기준으로 작업한다.
> 조사 범위: `CLAUDE.md`/`docs/STATUS.md`, `supabase/migrations/*.sql` 13개 전부, `supabase/functions/*` 4개 전부, `src/app/admin/`, `src/lib/admin.ts`·`auth.ts`·`community.ts`·`learning.ts`·`types.ts`·`member-import.ts`, `src/hooks/use-session.tsx`, `src/components/admin-guard.tsx`·`login-gate.tsx`, `scripts/templates/class1-record.js`, `docs/admin/spec.md`·`responses-spec.md`·`admin-tools/spec.md`, `docs/community/spec.md`. 모든 서술은 실제로 읽은 코드에 근거하며, 확인하지 못한 부분은 **"확인 필요"**로 표시했다.

---

## 0. 한 쪽 요약

**배경**: 지금 사이트는 교사(=관리자, `profiles.role='admin'`) 1명이 반 1개를 운영한다고 가정하고 만들어졌다. 관리자 화면·RLS 정책이 전부 "관리자면 전체 학생 데이터를 본다"는 이분법(`is_admin()` 하나)으로만 짜여 있다. 여러 반이 함께 쓰면 **각 반 담임이 다른 반 학생의 실험 기록·과제·피드백 대화·아이디·로그인 기록까지 전부 볼 수 있게 된다**(§1). 이건 RLS로 고쳐야 하는 문제이지, 화면(클라이언트 가드)만으로는 못 막는다(`CLAUDE.md` 원칙 "보안은 RLS로").

**핵심 방향(추천)**: 지금의 `role`(admin/user) 이분법은 그대로 두고, **완전히 덧붙이는 방식**으로 "반" 개념을 추가한다.
- 새 테이블 2개: `classes`(반), `class_teachers`(교사↔반, 다대다)
- `profiles`에 컬럼 2개 추가: `class_id`(학생의 반), `is_super_admin`(총괄 관리자 표시)
- 새 함수 3개: `is_super_admin()`, `my_class_ids()`, `teaches_student(uuid)` — 기존 `is_admin()`/`can_browse()`와 똑같은 `security definer` 패턴
- 학생 개인 기록을 보여주는 **기존 RLS 정책 10여 곳**에서 `public.is_admin()`을 `public.teaches_student(user_id)`(또는 해당 학생 id)로 바꾼다 — **딱 이 치환 하나**가 전체 작업의 90%다.
- **과학 웹앱은 코드를 한 줄도 고칠 필요가 없다**(§3.8) — `app_results`/`app_progress`는 원래 `user_id` 기준이라 앱은 "누구 반인지" 자체를 몰라도 된다. RLS만 바뀌면 저절로 반별로 나뉜다.
- 블로그 글·과제·자유게시판·학습게임·칭찬 문구·로그인 잠금은 **1차로 지금처럼 전체 공유 유지**를 추천하고, 자유게시판만 예외로 반별 분리를 추천한다(§2.2 표에서 항목별로 추천안과 까닭을 정리했다).

**사용자가 정할 질문**(자세한 추천안·까닭은 §2):
1. 역할 구조 — 총괄 관리자(사용자 본인) / 반 담임 교사 / 학생, 교사는 여러 반을 맡을 수 있는가, 관리자 승격은 누가 하는가 (§2.1, §2.4)
2. 반마다 나눌 것 vs 함께 쓸 것 — 블로그 글·자유게시판·학습게임·과제·칭찬 문구·로그인 잠금·신고 처리 (§2.2)
3. 학생 아이디 규칙 — 지금은 `아이디@class1.local`이 사이트 전체에서 겹치면 안 된다. 반이 늘면 충돌 가능성이 커진다 (§2.3)
4. 새 반 만들기·교사 배정 화면을 만들지, SQL로 충분한지 (§2.4, §3.6)
5. 학생이 반을 옮기거나 새 학년이 될 때 어떻게 할지 — "지금 반 기준"과 "기록 시점 반 기준" 두 방식 중 선택 (§2.5)

**단계 개요**(자세히는 §5): 0) 이번 스펙 승인 → 1) 스키마+함수 마이그레이션(새 테이블·컬럼·함수, 기존 데이터는 그대로) → 2) RLS 정책 치환 마이그레이션 + 기존 데이터를 "1반"으로 이관 → 3) 관리자 화면(반 선택·필터) + Edge Function 3개 수정 → 4) 반별 교차 노출 여부를 실제로 확인하는 Review → 5) (선택) 2차: 자유게시판 등 반별 분리 확장.

**확인 필요**: 실제 두 번째 반(다른 교사)이 언제 어떻게 생기는지의 운영 시나리오, 학생 아이디 충돌 회피 방식(§2.3), 자유게시판을 반별로 나눌지(§2.2), 그 밖에 본문에 "확인 필요"로 표시한 항목들.

---

## 1. 지금 누가 무엇을 볼 수 있나

역할은 지금 3가지뿐이다: **비로그인**, **학생**(`profiles.role='user'`), **관리자**(`profiles.role='admin'`, 곧 "교사" — 지금은 사용자 1명). 관리자 여부는 `public.is_admin()`(`profiles.role='admin'`을 읽는 `security definer` 함수, `20260921000000_init_blog.sql`) 하나로만 판별하며, 이 함수는 아래 표의 거의 모든 "관리자 조회/관리" 칸에 그대로 쓰인다(§3.4의 근거: `is_admin()`은 6개 마이그레이션 파일에 걸쳐 정책·함수 약 20곳에서 쓰인다).

| 데이터(테이블) | 비로그인 | 학생 본인 것 | 학생 → 다른 학생 것 | 관리자(지금은 전체) | 반이 여러 개면? |
|---|---|---|---|---|---|
| 블로그 글 `posts`, 댓글 `comments`, 좋아요 `likes`, 조회수 `views` | 공개 글만(로그인 잠금 켜지면 못 봄) | 공개 글 전부 | 다른 학생과 조건 동일(개인 구분 없음) | 비공개 포함 전체 + 작성/수정/삭제 | 원래도 "전체 공개 콘텐츠"라 문제 없음(원하면 반별 옵션 가능, §3.9) |
| 자유게시판 `community_posts`(kind='board')·댓글·좋아요 | **못 봄**(2026-09-26부터 로그인 필수, `20260926000000_board_login_only.sql`) | 로그인하면 전체 글 다 보임 | **다른 반 학생 글·댓글·좋아요가 그대로 보임** | 전체 + 숨기기/삭제 | **문제**: 반끼리 서로 다른 반 게시판 글이 다 보인다 |
| 학습게임 `community_posts`(kind='game') | 로그인 잠금 스위치를 따름 | 전체 게임 플레이 가능 | **다른 반 학생 게임도 다 보임** | 전체 + 숨기기/삭제 | 경미한 문제(자랑거리 성격이라 공유가 나을 수도 있음, §2.2) |
| 신고 `community_reports` | 없음 | 본인이 한 신고만 | 못 봄 | **전체 신고를 다 보고 처리** | 문제: 다른 반 게시글 신고까지 처리 권한이 생김 |
| 과학 앱 진행 `app_progress` | 없음(앱 자체가 로그인 필수) | 본인 것만 | 못 봄 | **전체 학생의 진행 상황을 다 봄** | **가장 큰 문제**: 다른 반 학생의 실험 진행 중 입력까지 다 보임 |
| 과학 앱 결과 `app_results` | 없음 | 본인 것만 | 못 봄 | **전체 학생 결과(점수·기록·`detail.qa`)를 다 봄** | **가장 큰 문제**: 다른 반 학생 응답이 "학생 응답" 화면에 섞여 나온다 |
| 글 읽음 기록 `post_reads` | 없음 | 본인 것만 | 못 봄 | 전체 다 봄 | 문제(경미, 위와 같은 성격) |
| 과제 `assignments` | 공개된 목록만 | 공개된 목록 전부 | 다른 학생과 동일 | 비공개 포함 전체 + 작성/수정/삭제 | 문제: 과제 자체를 공유할지는 §2.2에서 결정 |
| 과제 제출 `assignment_submissions` | 없음 | 본인 제출물만 | 못 봄 | **전체 학생 제출물을 다 보고 검토·상태 변경** | **문제**: 다른 반 제출물이 검토 화면에 섞인다 |
| 피드백 대화 `feedback_threads`/`feedback_messages`/`feedback_read_marks` | 없음 | 본인 대화만 | 못 봄 | **전체 학생과의 대화를 다 보고 답장 가능** | **문제**: 다른 반 학생에게도 답장할 수 있고, 대화 목록이 뒤섞인다 |
| 회원 명단 `member_directory`(이메일=아이디·가입방식·마지막 로그인) | 없음(관리자 전용 표) | 학생은 이 표 자체를 못 봄 | 못 봄 | **전체 회원의 아이디·로그인 기록을 다 봄** | **문제**: 다른 반 학생 아이디·로그인 시각까지 다 보인다 |
| 이름·아바타·역할 `profiles`(공개 컬럼) | 항상 공개 | 항상 공개 | 항상 공개 | 항상 공개 | 문제 없음(이름은 원래도 전체 공개 — §7에서 다시 짚음) |
| 칭찬 문구 `praise_presets` | 없음 | 안 보임(관리자 전용) | - | 전체 관리자 공용 목록 | 경미(문구 자체는 학생 개인정보 아님) |
| 감사 로그 `password_reset_log`·`member_withdrawal_log`·`member_create_log` | 없음 | 없음 | - | **전체 로그를 다 봄** | 문제: 다른 반 학생 대상 조치 기록까지 다 보인다 |
| 로그인 잠금 스위치 `site_settings.login_required` | 값은 항상 읽을 수 있음(자물쇠 방지 원칙) | 〃 | - | 켜고 끄기(사이트 전체 단위) | 반 개념과 무관 — 그대로 둘지 결정 필요(§2.2) |

**정리**: 문제가 되는 곳은 정확히 "**학생 개인 기록**을 관리자가 보는" 9개 표(진하게 표시)와, "**커뮤니티 콘텐츠**를 다른 반 학생이 보는" 자유게시판/학습게임/신고 3개다. 블로그 글·과제 자체(내용)·회원 이름·칭찬 문구·로그인 잠금은 지금 구조를 유지해도 심각한 문제가 없다.

---

## 2. 사용자가 정할 것

### 2.1 역할 구조

**질문**: 역할을 몇 단계로 나눌까?

**추천안**: `profiles.role`은 지금처럼 **admin/user 두 값만** 유지하고, 그 위에 "총괄이냐 아니냐"만 별도 플래그(`is_super_admin`)로 얹는다.
- 총괄 관리자(사용자 본인) = `role='admin'` + `is_super_admin=true` → 모든 반을 본다.
- 반 담임 교사 = `role='admin'` + `is_super_admin=false` + `class_teachers`에 자기 반이 연결됨 → 자기 반만 본다.
- 학생 = `role='user'` + `profiles.class_id`로 자기 반이 정해짐.

**까닭**: `is_admin()`은 이 코드베이스 전체에서 약 20곳(정책·함수·트리거)에 쓰인다(§1 표 아래 설명). `role`에 `'owner'` 같은 세 번째 값을 추가하면 **그 20곳 전부**를 `role in ('admin','owner')` 식으로 다시 확인해야 하고, `profiles_role_check` 제약도 바꿔야 하며, TypeScript 쪽 `role: "admin" | "user"` 타입(`src/lib/types.ts`)과 Edge Function 3개의 `callerProfile?.role !== "admin"` 검사도 전부 손봐야 한다. 반대로 **새 boolean 컬럼**(기본값 false)은 기존 `is_admin()` 호출·`role==='admin'` 비교를 **단 하나도 깨뜨리지 않고** 그 위에 새 함수(`is_super_admin()`, `teaches_student()`)만 얹을 수 있다 — 영향 범위가 훨씬 작고 안전하다. `site_settings.login_required` 같은 boolean 스위치를 이미 이 방식(기본값 false, 못 읽으면 false)으로 쓰고 있어 이 저장소의 관례와도 맞는다.

**교사는 여러 반을 맡을 수 있나?** 추천: 처음부터 다대다(`class_teachers`)로 설계한다. 한 반에 담임 1명, 한 교사가 반 1개라는 가정을 컬럼 하나(`profiles.teacher_class_id`)로 박아 두면 나중에 "교사 한 명이 두 반을 맡는다" 같은 상황이 생겼을 때 다시 스키마를 바꿔야 한다. 조인 테이블은 지금 당장 화면에서 "반 1개만 고른다"로 써도 되고, 나중에 그대로 확장된다 — 비용 차이가 거의 없다.

**관리자 승격(`admin_set_role`)은 누가 하나?** 지금은 **아무 관리자나** 다른 사용자를 admin으로 올리거나 내릴 수 있다(자기 자신 해제·마지막 관리자 해제만 막혀 있다, `20260921020000_admin_learning.sql`). 반이 여러 개가 되면 "교사 자격을 주는 일"은 사이트 운영과 직결되므로, **총괄만** `role`을 admin으로 바꿀 수 있게 좁히는 것을 추천한다(강등도 총괄만 — 담임 교사끼리 서로의 권한을 건드리지 못하게). 이건 지금과 달라지는 동작이라 확정 결정이 필요하다.

### 2.2 반마다 나눌 것 vs 함께 쓸 것

| 항목 | 반별로 나눔 | 전체 공유 | 추천 | 까닭 |
|---|---|---|---|---|
| 과학 앱 **내용**(문제·시뮬레이션) | - | ✅ | 공유 | 앱은 `/public/apps/{앱}/`에 하나뿐이고 모든 반이 같은 교육과정을 배운다. 반별로 다른 버전을 만들 이유가 없다 |
| 과학 앱 **결과·진행**(`app_results`/`app_progress`) | ✅ | - | 반별 | 이미 확정(사용자가 이 문서를 요청한 이유 그 자체). §3.4에서 RLS로만 처리, 앱 코드 변경 없음 |
| 블로그 글(`posts`) | - | ✅ | **공유 추천** | 교육 콘텐츠 성격이라 공개해도 문제가 적고, 지금처럼 한두 명이 주로 쓸 가능성이 높다. 필요해지면 나중에 `posts.class_id`(nullable, null=전체 공개) 확장 가능(§3.9) — 지금 당장 나눌 필요는 없어 보인다 |
| 자유게시판(`community_posts` kind='board') | ✅ | - | **반별 분리 추천** | 학생들이 서로 아는 사이라 "우리 반 게시판"이라는 소속감이 중요하고, 이미 2026-09-26에 "로그인해야만 보임"으로 좁힌 것과 같은 방향(더 좁히는 결정). 다른 반 학생 글이 섞이면 신고 처리 권한 문제(§1)도 함께 해결된다 |
| 학습게임(`community_posts` kind='game') | - | ✅ | **공유 추천** | 학생이 만든 게임을 "자랑"하는 공간이라 반 구분 없이 서로 보고 노는 편이 더 재밌을 수 있다. 반별로 나누면 서로 게임을 플레이해 볼 기회가 줄어든다. 확신은 낮음 — 사용자 판단 필요 |
| 과제(`assignments`) | 선택 가능 | 선택 가능 | **1차: 공유, 확장 여지만 마련** | 교사마다 다른 과제를 내고 싶을 가능성이 높지만, 처음부터 `assignments.class_id`(nullable)를 만들어 두면 "null=전체 공지형 과제, 값 있음=그 반 전용"으로 자연스럽게 확장된다(§3.9). 1차 Build에서는 컬럼만 만들고 항상 null(공유)로 시작해도 된다 |
| 피드백 대화 | (해당 없음) | (해당 없음) | - | 원래 "학생 1명 ↔ 교사"의 1:1 대화라 반 개념이 필요 없다. `teaches_student()`로 자동으로 그 학생 담임만 보이게 된다(별도 결정 불필요) |
| 칭찬 문구(`praise_presets`) | - | ✅ | **공유 추천** | 문구 자체는 학생 개인정보가 아니다. 이미 `created_by` 컬럼이 있어 나중에 "내가 만든 것만 보기" 필터로 쉽게 확장할 수 있다(스키마 변경 없이 화면만 추가) |
| 로그인 잠금 스위치(`site_settings.login_required`) | - | ✅ | **사이트 전체 유지 추천** | "방문자에게 로그인을 요구할지"는 반 단위 학습 정책이라기보다 사이트 운영 정책(예: 공개 수업 기간)에 가깝다. 반별로 나누려면 `site_settings`를 단일 행에서 반별 테이블로 바꿔야 해 비용 대비 실익이 작다 |
| 신고 처리 권한 | ✅(게시판) / 전체(게임) | - | **게시판 신고=그 반 담임+총괄, 게임 신고=모든 교사+총괄** | 게시판이 반별로 나뉘면 신고도 자연히 그 반 담임이 먼저 보는 게 맞고, 게임은 공유 공간이라 아무 교사나 처리해도 무리가 없다 |

### 2.3 학생 아이디 규칙

**지금 구조**(`src/lib/auth.ts`의 `LOGIN_EMAIL_DOMAIN = "class1.local"`, `supabase/functions/admin-create-member/index.ts`도 같은 상수): 로그인 아이디는 `{아이디}@class1.local`이라는 이메일로 Supabase Auth에 등록되고, **이메일은 Supabase 전체에서 유일해야 한다**. 지금은 연도+번호 같은 숫자(예: `202613`)를 그대로 쓴다.

**문제**: 서로 다른 반(예: 6-1반과 6-2반)이 둘 다 같은 규칙(예: `2026` + 번호)으로 아이디를 만들면 `202601@class1.local`처럼 똑같아져 두 번째 반의 계정 생성이 "이미 있는 아이디"로 거부된다(`admin-create-member`의 `isEmailExistsError` 분기 — 코드로 확인). 이건 RLS와 무관하게, 반이 2개만 되어도 **바로 부딪히는 문제**다.

**질문**: 아이디 충돌을 어떻게 피할까?

**추천안 (A, 운영 규칙으로 해결 — 코드 변경 없음)**: 교사가 계정을 만들 때 아이디 앞에 **반을 구분하는 접두사**를 직접 붙여 입력한다(예: `202601` 대신 `61-01`, `62-01` 또는 `2026-6-1-01`). 엑셀 일괄 등록 서식(`public/templates/members-template.xlsx`)에 안내 문구만 추가하면 된다.

**대안 (B, 시스템이 자동으로 접두사를 붙임)**: `admin-create-member`가 호출자의 반(또는 화면에서 고른 반)의 코드를 받아 `{반코드}-{입력한 아이디}@class1.local`로 자동 조합한다. 학생이 외워야 하는 로그인 아이디가 화면에 입력한 값과 달라지므로, 로그인 화면·비밀번호 재설정 안내 문구도 함께 손봐야 한다.

**추천**: **A(운영 규칙)**를 1차로 추천한다 — 코드 변경이 전혀 없고, 지금처럼 교사가 본 학번을 그대로 쓰고 싶어할 수도 있어 강제로 접두사를 붙이는 B보다 유연하다. 다만 반이 아주 많아지면(예: 학교 전체) 규칙을 안 지키는 교사가 나올 수 있으므로, 화면(회원 추가 폼)에서 "다른 반에 이미 있는 아이디입니다"처럼 **미리 경고**해 주는 정도는 작은 비용으로 추가할 수 있다(Edge Function이 이미 "이미 있는 아이디" 오류를 구분해서 돌려주므로 화면 문구만 다듬으면 됨). **확인 필요**: 앞으로 반이 몇 개까지 늘어날지(같은 학교 여러 반인지, 다른 학교 교사까지 포함하는지)에 따라 A로 충분한지 B가 필요한지 갈린다.

### 2.4 계정·반 생성 권한

**질문 1**: 교사(관리자) 계정은 누가 만드나?
**추천**: **총괄만.** §2.1에서 정리한 `admin_set_role` 제한과 같은 방향 — `admin-create-member` Edge Function에서 `role: "admin"`으로 계정을 만드는 요청은 호출자가 `is_super_admin()`일 때만 허용한다(지금은 아무 관리자나 만들 수 있음, §3.5에서 구체적으로 다룸).

**질문 2**: 새 반은 누가 만드나, 화면이 필요한가?
**추천**: **1차는 화면 없이 총괄이 SQL Editor에서 직접 만든다.** 새 반이 생기는 일(새 교사가 합류)은 "첫 관리자 지정"처럼 드문 1회성 작업이라, `CLAUDE.md`의 기존 관례("첫 관리자 지정은 여전히 SQL로 1회")와 같은 성격이다. `classes`에 행을 넣고 `class_teachers`로 교사를 연결하는 SQL 두 줄이면 충분하다(§4). 반이 자주 생기는 운영으로 바뀌면(예: 학기마다 여러 반이 한꺼번에 들어옴) 그때 `/admin/classes/` 화면(반 만들기·교사 배정 UI)을 추가하는 2단계로 넘기는 것을 추천한다 — 처음부터 화면을 만들면 Build 범위가 커지는데 실제로 몇 번 안 쓸 수도 있다.

**질문 3(참고, 결정 불필요)**: 학생 계정은 누가 만드나 — 이미 담임 교사가 "회원 추가"로 만들 수 있어야 자연스럽다. §3.5에서 Edge Function이 "담임인 반에만" 배정하도록 제한하는 방법을 다룬다.

### 2.5 반 이동 · 새 학년

학생이 반을 옮기거나 학년이 바뀌면 두 가지 설계 중 하나를 골라야 한다. 이건 **가장 중요한 구조적 결정**이라 자세히 설명한다.

**방식 A — "지금 반" 기준(추천, 단순)**: `profiles.class_id` 하나로 "지금 이 학생이 속한 반"만 저장한다. 교사가 어떤 학생의 기록(예: `app_results`)을 볼 수 있는지는 **그 학생의 현재 `class_id`**로 매번 판단한다.
- 장점: 스키마가 가장 단순하다(컬럼 1개). 기존 기록 테이블(`app_results`, `assignment_submissions` 등 9개)에 손댈 컬럼이 전혀 없다.
- 단점: 학생이 반을 옮기면(또는 새 학년이 되어 새 반에 배정되면) **그 학생의 과거 기록 전부가 한꺼번에 새 담임에게 보이고, 예전 담임에게는 더 이상 보이지 않는다.** "지난 학기 기록은 지난 담임이 계속 보고 싶다"는 요구가 있으면 맞지 않는다.

**방식 B — "기록 시점 반" 기준(더 정확하지만 큰 작업)**: `app_results`, `app_progress`, `post_reads`, `assignment_submissions`, `feedback_threads` 등 **학생 기록이 쌓이는 테이블마다** 그 기록이 생길 때의 `class_id`를 함께 저장(스냅샷)한다. RLS는 학생의 현재 반이 아니라 그 행에 찍힌 반을 본다.
- 장점: 학생이 반을 옮겨도 예전 기록은 예전 담임에게, 새 기록은 새 담임에게 정확히 남는다(탈퇴 처리의 `withdrawn_at` 스냅샷 방식과 같은 철학).
- 단점: 관련된 **모든 학생 기록 테이블**에 컬럼을 추가하고 INSERT 시점에 값을 채워야 한다(과학 앱의 `class1-record.js`/`persist.js`도 영향을 받을 수 있다 — §3.8에서 "앱 코드 변경 불필요"라고 한 결론이 이 경우 깨진다). 작업량이 방식 A보다 훨씬 크다.

**추천**: **방식 A**로 시작한다. 초등학교 한 학년 안에서 학기 중 전학·반 교체는 드물고, 학년이 바뀌면 어차피 새 학년 교육과정(새 과학 앱, 새 과제)이 시작되므로 "새 담임이 새로 시작하는 학생 명단을 본다"는 게 자연스럽다. 다만 **반이 자주 바뀌거나(예: 매 학기 반 편성) 예전 담임이 지난 기록을 계속 봐야 하는 경우가 흔하다면 A로는 부족하니, 그때는 처음부터 B를 검토해야 한다** — 이건 사용자만 답할 수 있는 운영 특성이라 확인이 필요하다.

반을 옮기는 실제 동작(방식 A 기준)은 총괄이 SQL Editor에서 `update profiles set class_id = '<새 반 id>' where id = '<학생 id>';` 한 줄로 처리하는 것을 추천한다(§2.4의 "화면 없이 SQL로" 방향과 같음). 자주 쓰는 기능이 아니라면 화면·RPC를 새로 만들 필요는 없다.

### 2.6 질문 모아보기

| # | 질문 | 추천안 | 참조 |
|---|---|---|---|
| Q1 | 역할을 몇 단계로 나눌까 | `role`은 admin/user 유지 + `is_super_admin` 플래그 추가 | §2.1 |
| Q2 | 교사가 여러 반을 맡을 수 있나 | 가능하게(다대다 `class_teachers`) | §2.1 |
| Q3 | 관리자 승격/강등을 누가 하나 | 총괄만(지금은 아무 관리자나 가능 — 동작 변경) | §2.1 |
| Q4 | 자유게시판을 반별로 나눌까 | 나눔(로그인 필수에 이은 다음 단계) | §2.2 |
| Q5 | 학습게임을 반별로 나눌까 | 공유 유지(확신 낮음, 재확인 필요) | §2.2 |
| Q6 | 과제를 반별로 나눌까 | 1차는 공유, 확장 컬럼만 미리 마련 | §2.2 |
| Q7 | 로그인 잠금 스위치를 반별로 나눌까 | 사이트 전체 유지 | §2.2 |
| Q8 | 학생 아이디 충돌을 어떻게 막을까 | 운영 규칙(교사가 접두사 포함해 입력) | §2.3 |
| Q9 | 교사 계정은 누가 만드나 | 총괄만 | §2.4 |
| Q10 | 반 만들기 화면이 필요한가 | 1차는 SQL, 필요해지면 화면 추가 | §2.4 |
| Q11 | 반 이동/새 학년을 어떤 기준으로 볼지 | "지금 반" 기준(방식 A) | §2.5 |

---

## 3. 추천 설계

### 3.1 전체 방향

가장 단순하고 안전한 안: **기존 코드는 거의 건드리지 않고, RLS 정책의 "관리자면 전부 허용" 조건 하나(`is_admin()`)를 "그 학생을 담당하는 교사면 허용"(`teaches_student(...)`)으로 좁히는 치환 작업**을 중심에 둔다. 새 테이블·컬럼·함수는 전부 **덧붙이는 것**(추가 컬럼 기본값, 새 테이블, 새 함수)이라 기존 화면·기존 학생 기록에 영향이 없다. 화면 쪽은 "반 선택 UI"만 최소로 추가한다.

### 3.2 데이터 모델

```sql
-- 반
create table if not exists public.classes (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(btrim(name)) between 1 and 100), -- 예: "2026 6학년 1반"(연도 포함 추천, §2.5)
  archived_at timestamptz,               -- 삭제하지 않고 "더 이상 안 씀"만 표시(완전 탈퇴의 withdrawn_at과 같은 철학)
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);

-- 교사 ↔ 반 (다대다 — §2.1 Q2)
create table if not exists public.class_teachers (
  class_id   uuid not null references public.classes (id) on delete cascade,
  teacher_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (class_id, teacher_id)
);

-- profiles 확장 (학생의 반 / 총괄 표시)
alter table public.profiles add column if not exists class_id       uuid references public.classes (id) on delete set null;
alter table public.profiles add column if not exists is_super_admin boolean not null default false;

-- member_directory에도 class_id를 "복사"해 둔다(§3.3에서 이유 설명 — profiles.class_id를 공개 컬럼으로 열지 않기 위함)
alter table public.member_directory add column if not exists class_id uuid references public.classes (id) on delete set null;
```

- `classes.name`에 유일 제약을 걸지 않는 것을 추천한다(같은 이름이 해마다 반복될 수 있음 — 이름에 연도를 포함해 구분하는 걸 운영 규칙으로).
- `class_id`는 `on delete set null`로 둔다 — 반은 지우지 않고 `archived_at`으로만 표시할 것이므로 실제로 발동할 일은 거의 없지만, 혹시 반 행을 지워도 학생 프로필이 함께 사라지지 않게 하는 안전장치다.
- **완전 탈퇴(`withdrawal_blocking_fks()`)와의 관계**: 이 함수는 `auth.users`를 참조하는 FK만 검사한다(`supabase/migrations/20260923000000_member_withdrawal.sql` §5). `classes`/`class_teachers`는 전부 `profiles`를 참조하지 `auth.users`를 참조하지 않으므로 **이 안전장치와 아무 상호작용이 없다 — 그대로 둔다(변경 불필요)**. 또한 교사(관리자) 계정은 이미 `admin_finalize_withdrawal()`에서 탈퇴 자체가 거부되므로(`role='admin'`이면 탈퇴 불가), `class_teachers.teacher_id`가 "탈퇴했는데 기록만 남는" 상황을 겪을 일도 없다. 학생이 탈퇴해도 `profiles` 행과 `class_id`는 그대로 남으므로, 담임 교사는 탈퇴한 학생의 기존 기록을 지금처럼 "탈퇴한 학생"이라는 이름으로 계속 볼 수 있다(기존 `profileDisplayName()`/`adminDisplayName()` 그대로 동작).

### 3.3 역할 판별 함수 (재귀 없음)

기존 `is_admin()`/`can_browse()`와 완전히 같은 패턴(`language sql stable security definer set search_path = ''`)으로 만든다. 재귀(42P17) 위험 점검: 아래 세 함수는 `profiles`와 `class_teachers`만 읽고, 이 두 표의 RLS 정책은 이 함수들을 다시 부르지 않는다(`profiles` SELECT 정책은 그대로 `true`, `class_teachers`는 클라이언트에 아예 노출하지 않을 것이므로 정책 자체가 필요 없다 — 아래 참고) → 순환 없음, `is_admin()`/`login_required()`와 같은 안전한 구조.

```sql
create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select p.is_super_admin from public.profiles p where p.id = auth.uid()), false);
$$;

create or replace function public.my_class_ids()
returns uuid[] language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(ct.class_id), '{}'::uuid[])
  from public.class_teachers ct where ct.teacher_id = auth.uid();
$$;

-- 이 학생(p_student)의 기록을 "지금 로그인한 사람"이 봐도 되는지. 관리자가 아니면 항상 false.
create or replace function public.teaches_student(p_student uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_admin() and (
    public.is_super_admin()
    or exists (
      select 1 from public.profiles s
      where s.id = p_student and s.class_id = any(public.my_class_ids())
    )
  );
$$;

-- 학생 본인이 자기 반 이름 정도는 알 수 있게(선택 — §3.7 참고)
create or replace function public.my_class_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select p.class_id from public.profiles p where p.id = auth.uid();
$$;

revoke all on function public.is_super_admin() from public;
revoke all on function public.my_class_ids()   from public;
revoke all on function public.teaches_student(uuid) from public;
revoke all on function public.my_class_id()    from public;
grant execute on function public.is_super_admin()      to authenticated;
grant execute on function public.my_class_ids()        to authenticated;
grant execute on function public.teaches_student(uuid) to authenticated;
grant execute on function public.my_class_id()         to authenticated;
```

**`profiles.class_id`를 공개 컬럼으로 열지 않는 이유**: `profiles`의 SELECT 정책은 `using (true)` — 모든 사람이 모든 행을 본다(이름·아바타 표시용, 지금도 그렇다). 컬럼 단위 권한(`must_change_password`와 같은 방식)으로 `class_id`를 막지 않으면, **로그인한 학생 누구나 전체 학생의 반 배정을 조회**할 수 있게 된다(`GET /profiles?select=id,class_id`) — 이건 지금 이 작업을 하는 이유("다른 반 정보가 새는 문제")와 어긋난다. 그래서:
- `profiles.class_id`는 공개 select 목록(`grant select (id, display_name, ...)`)에 **넣지 않는다**.
- 학생 자신의 반은 위 `my_class_id()`로만 읽는다(꼭 필요한 경우에만, §3.7).
- 관리자 화면이 "이 학생이 어느 반인지" 봐야 할 때는 `profiles`를 직접 읽지 않고, 이미 관리자 전용인 **`member_directory.class_id`**(§3.2에서 추가)를 읽는다. `member_directory` SELECT 정책 자체를 `teaches_student(id)`로 좁히므로(§3.4), 그 표를 읽을 수 있다는 것 자체가 이미 "이 학생을 담당한다"는 뜻이라 컬럼을 더 막을 필요가 없다.
- `member_directory.class_id`는 `profiles.class_id`가 바뀔 때 작은 트리거로 동기화한다(기존 `sync_member_directory()`가 `auth.users` 쪽 변경을 동기화하는 것과 같은 패턴, 다만 이번엔 `profiles` 쪽 변경을 감지):

```sql
create or replace function public.sync_member_directory_class()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.member_directory set class_id = new.class_id, updated_at = now() where id = new.id;
  return new;
end $$;

drop trigger if exists on_profiles_class_changed on public.profiles;
create trigger on_profiles_class_changed
  after update of class_id on public.profiles
  for each row execute function public.sync_member_directory_class();
```

> **Claude 검토 메모(실행 권한)**: 위 스케치는 새 함수의 실행 권한을 `authenticated`로만 주지만, 이 함수들은 RLS 정책 안에서 불린다. 정책은 "요청한 역할"로 평가되므로, anon 등 다른 역할의 요청이 그 표에 닿으면 `permission denied for function` 오류가 날 수 있다(`20260923010000_login_required.sql`의 review S1 — `login_required()`/`can_browse()`는 그래서 PUBLIC 실행을 유지했다). Build에서는 기존 `is_admin()`·`can_browse()`와 같은 권한(PUBLIC 실행 유지)을 기본으로 하고, 좁힐 때는 anon 요청으로 오류가 나지 않는지 확인한다.

`classes`/`class_teachers`는 학생용 화면에 노출할 이유가 없으므로 **`anon`/`authenticated`에 아무 권한도 주지 않는다**(RLS를 켜 두되 정책 없이 잠가 두거나, 아예 SELECT 정책을 총괄 전용으로만 둔다 — Build 단계에서 "반 관리 화면"을 만들지(§2.4 Q10) 여부에 따라 결정). 위 함수들은 `security definer`라 이 표들의 권한 설정과 무관하게 항상 값을 읽을 수 있다.

### 3.4 테이블별 RLS 변경 목록

**패턴은 단 하나다**: "본인 또는 관리자 조회" 정책에서 `public.is_admin()`을 `public.teaches_student(<그 행의 학생 id 컬럼>)`으로 바꾼다. 아래는 실제로 바꿀 정책 목록이다(정책 이름은 현재 파일 그대로).

| 테이블 | 정책(현재 이름) | 기존 조건 | 새 조건 | 비고 |
|---|---|---|---|---|
| `member_directory` | `member_directory: 관리자만 조회` | `is_admin()` | `teaches_student(member_directory.id)` | §3.3에서 `class_id` 컬럼도 함께 추가 |
| `app_results` | `app_results: 본인 또는 관리자 조회` | `auth.uid()=user_id or is_admin()` | `auth.uid()=user_id or teaches_student(user_id)` | INSERT 정책(본인만)은 변경 없음 → 앱 코드 영향 없음(§3.8) |
| `app_results` | `app_results: 관리자만 삭제` | `is_admin()` | `is_super_admin() or teaches_student(user_id)` | 삭제는 담당 교사 또는 총괄까지 허용(추천) |
| `app_progress` | `app_progress: 관리자 조회` | `is_admin()` | `teaches_student(user_id)` | 본인 select/insert/update/delete 정책은 변경 없음 |
| `post_reads` | `post_reads: 본인 또는 관리자 조회` | `auth.uid()=user_id or is_admin()` | `auth.uid()=user_id or teaches_student(user_id)` | |
| `assignment_submissions` | `assignment_submissions: 본인 또는 관리자 조회` | `auth.uid()=user_id or is_admin()` | `auth.uid()=user_id or teaches_student(user_id)` | |
| `assignment_submissions` | `assignment_submissions: 본인 또는 관리자 수정` | `auth.uid()=user_id or is_admin()` | `auth.uid()=user_id or teaches_student(user_id)` | |
| `assignment_submissions` | `assignment_submissions: 본인(마감 전·검토 전) 또는 관리자 삭제` | `is_admin() or (...)` | `teaches_student(user_id) or (...)` | |
| `assignment_submissions` | 트리거 함수 `assignment_submission_guard()` 내부 | `public.is_admin()` 2곳 | `public.teaches_student(old.user_id)` | RLS와 앞뒤가 맞도록 트리거도 함께 바꾼다(§3.1 마지막 문단 참고) |
| `feedback_threads` | `feedback_threads: 본인 또는 관리자 조회` | `auth.uid()=student_id or is_admin()` | `auth.uid()=student_id or teaches_student(student_id)` | |
| `feedback_threads` | `feedback_threads: 관리자만 삭제` | `is_admin()` | `teaches_student(student_id)` | |
| `feedback_messages` | `feedback_messages: 스레드 접근 가능자만 조회` | `is_admin() or exists(...student_id=auth.uid())` | `teaches_student(t.student_id) or exists(...)` | |
| `feedback_messages` | `feedback_messages: 본인 발신, 스레드 접근 가능해야 함` | `is_admin() or exists(...)` | `teaches_student(t.student_id) or exists(...)` | 담당 교사만 그 학생 스레드에 답장 가능해짐(추천) |
| `get_or_create_feedback_thread(uuid,text,uuid)` | 함수 내부 | `auth.uid()=p_student_id or is_admin()` | `auth.uid()=p_student_id or teaches_student(p_student_id)` | |
| `mark_thread_read(uuid,timestamptz)` | 함수 내부 | `t.student_id=auth.uid() or is_admin()` | `t.student_id=auth.uid() or teaches_student(t.student_id)` | |
| `unread_feedback_count()` | 함수 내부 | `is_admin() or t.student_id=auth.uid()` | `teaches_student(t.student_id) or t.student_id=auth.uid()` | 총괄이 아닌 담임의 "안 읽은 피드백" 배지가 자기 반 기준으로 줄어듦(의도된 동작) |
| `feedback_thread_summaries(uuid)` | 함수 내부(RLS 의존, security invoker) | 자동으로 위 정책들을 따름 | 그대로 두되 동작이 자동으로 좁혀짐 | 코드 변경 불필요 |
| `password_reset_log` | `password_reset_log: 관리자만 조회` | `is_admin()` | `is_super_admin() or teaches_student(target_id)` | `target_id`엔 FK가 없어 탈퇴해도 남는 로그 — `profiles`가 없어도(이론상) `teaches_student`가 false를 돌려주도록 함수가 이미 `exists(...)`로 안전하게 처리됨 |
| `member_withdrawal_log` | `member_withdrawal_log: 관리자만 조회` | `is_admin()` | `is_super_admin() or teaches_student(target_id)` | 학생은 탈퇴 뒤에도 `profiles` 행이 남으므로 `class_id`를 계속 읽을 수 있어 정상 작동 |
| `member_create_log` | `member_create_log: 관리자만 조회` | `is_admin()` | `is_super_admin() or teaches_student(target_id)` | |
| `admin_dashboard_stats()` | 함수 내부 | `is_admin()`이면 전체 집계 | **총괄만 전체 집계, 담임은 자기 반 집계**로 바꿔야 함(추가 설계 필요) | 아래 "위험" 참고 — SQL을 다시 짜야 하는 유일한 집계 함수 |
| `app_result_stats()` | 함수 내부(security invoker) | RLS를 그대로 따름(`app_results` 정책 의존) | 자동으로 좁혀짐 | 코드 변경 불필요 — 단, "앱별 전체 학생 수" 같은 숫자가 담임 화면에서는 자기 반 기준으로 나오게 됨(의도된 동작) |
| `admin_set_role(uuid,text)` | 함수 내부 | `is_admin()`이면 아무나 역할 변경 가능 | `p_role='admin'`으로 바꾸는 경우 **`is_super_admin()`**만 허용(§2.1 Q3) | 사용자 승인 필요(동작 변경) |
| `admin-create-member`(Edge Function) | 관리자 확인 | `role==='admin'`이면 통과 | `role: "admin"`인 행을 만들 때는 호출자가 `is_super_admin`이어야 통과, `role:"user"`는 자기 반(또는 지정한 반)에만 | §3.5 |
| `classes`, `class_teachers` | (신규) | - | `classes` SELECT는 관리자 전체 공개 또는 총괄 전용(§2.4 Q10에 따라 결정), `class_teachers`는 클라이언트 노출 없음(SQL 전용) | §3.2·§3.3 |
| `posts`/`comments`/`likes`/`views`/`assignments`(공개 여부)/`praise_presets`/`site_settings` | - | 변경 없음(§2.2에서 공유로 결정한 항목) | 변경 없음 | 사용자가 §2.2에서 "반별 분리"로 바꾸면 그 항목만 §3.9 방식으로 추가 |
| `community_posts`/`community_comments`/`community_likes`/`community_reports` | (§2.2 Q4 "게시판 반별 분리"를 선택할 때만) | kind='board'는 지금 로그인 여부만 확인 | kind='board'는 `class_id = any(가시 범위)`도 함께 확인 | §3.9에 스케치. 이 문서에서는 "확인 필요" 폭으로만 다루고 실제 설계는 Q4 답변 뒤 세부 Plan에서 |

**"위험" — `admin_dashboard_stats()`**: 지금은 `select ... where public.is_admin();` 한 줄로 "전체 회원 수·오늘 결과 수·대기 제출물 수·안 읽은 피드백 수" 4개를 반환한다. 총괄은 전체 숫자를 원할 가능성이 높고, 담임은 자기 반 숫자만 원할 가능성이 높다 — **이 함수는 단순 치환이 아니라 새로 짜야 한다**(`is_super_admin()`이면 전체 집계, 아니면 `class_id = any(my_class_ids())`로 필터). Build 단계에서 별도로 다룰 항목으로 표시해 둔다.

### 3.5 Edge Function 변경

세 함수 모두 지금 "관리자인지"를 서비스 롤 클라이언트로 `profiles.role` 컬럼을 직접 읽어 확인한다(RPC `is_admin()`을 쓰지 않는다 — 서비스 롤에는 `auth.uid()`가 없어서 그 함수를 그대로 쓸 수 없기 때문, 실제 코드로 확인함). 새로 만드는 `is_super_admin()`/`teaches_student()`도 `auth.uid()` 기반이라 **Edge Function에서는 RPC로 부를 수 없고, 지금과 같은 방식으로 서비스 롤 select를 직접 짜야 한다.**

- **`admin-create-member`** (`supabase/functions/admin-create-member/index.ts`)
  - 요청 바디에 `classId`(학생 생성 시 배정할 반, uuid) 필드를 추가한다.
  - 호출자 확인 뒤: `role: "admin"`인 행이 하나라도 있으면 호출자의 `is_super_admin`을 조회해 아니면 그 행만 `"failed"`로 거부(§2.1 Q3, §2.4 Q1).
  - `role: "user"`인 행은 호출자가 `is_super_admin`이 아니면 `classId`가 호출자의 `class_teachers` 목록에 있는지 서비스 롤로 확인하고, 아니면 거부한다(다른 반에 학생을 몰래 등록하지 못하게).
  - 계정 생성 뒤 `profiles.update({ role, must_change_password:true, class_id: classId })`로 한 번에 반영(지금 이미 `role`·`must_change_password`를 업데이트하는 자리에 `class_id`만 추가하면 됨).
- **`admin-delete-member`**(탈퇴) / **`admin-reset-password`**: 대상 학생의 `profiles.role`을 확인하는 지금 로직 옆에, 호출자가 `is_super_admin`이 아니면 대상의 `class_id`가 호출자의 `class_teachers`에 있는지 함께 확인해 아니면 403으로 거부한다. 그 외 로직(관리자 대상 거부, 되돌릴 수 없음 경고, 안전장치 등)은 변경 없음.
- **`check-answer`**: 변경 불필요 — 이 함수는 로그인 여부(JWT claim)만 확인하고 학생 이름·id·반을 전혀 다루지 않는다(실제 코드로 확인함). 외부(Gemini)로 보내는 데이터는 지금도 질문·답·모범답안 텍스트뿐이라 `CLAUDE.md`의 "이름·학번·user id·이메일 금지" 규칙과 이번 변경은 무관하다.

### 3.6 관리자 화면 변경

RLS가 이미 걸러 주므로, 화면 코드 대부분은 **쿼리 로직을 바꿀 필요가 없다** — `fetchMembers()`/`fetchStudents()`/`fetchAllAppResults()`(`src/lib/learning.ts`, `src/lib/admin.ts`)는 지금도 "RLS가 허용하는 만큼" 가져오는 구조라, 담임 교사 계정으로 로그인하면 자동으로 자기 반만 돌아온다. **보안은 이것만으로 이미 지켜지지만**, 화면에 "지금 어느 반을 보고 있는지" 표시가 없으면 총괄 입장에서는 여러 반이 뒤섞여 보여 불편하다. 그래서 최소한으로 추가할 것:

1. **회원 추가 폼**(`src/app/admin/(dashboard)/members/`, `src/lib/member-import.ts`): 학생 행을 만들 때 "반" 선택 칸 추가. 담임 교사 계정이면 자기 반(들) 중에서만 고르게 하고(1개뿐이면 자동 선택), 총괄이면 전체 반 중에서 고른다. 엑셀 일괄 등록도 "반" 열을 추가하거나(여러 반을 한 파일로 섞어 등록), 파일 하나당 반 1개를 화면에서 고르게 한다(더 단순 — 추천).
2. **회원 목록**(`member-list.tsx`): "반" 열 추가 + 반 필터(총괄에게만 의미 있음, 담임은 항상 자기 반만 보이므로 필터가 필요 없음).
3. **학습 현황·학생 응답**(`learning-view.tsx`, `responses-view.tsx`, `app-results-view.tsx`, `engagement-table.tsx`): 학생 선택 드롭다운이 이미 `fetchStudents()` 결과로 채워지므로 **RLS만 바뀌면 자동으로 반이 좁혀진다.** 총괄 화면에는 "반 선택(전체/반별)" 필터를 얹는 것을 추천 — 값이 없으면 지금처럼 전체를 본다.
4. **관리자 개요**(`admin-overview.tsx`): `admin_dashboard_stats()` 반환값이 바뀌므로(§3.4) 그대로 받아 쓰면 된다(화면 코드 변경 없음, DB 함수만 바뀜).
5. **공용 표시**: 총괄 화면 헤더 한켠에 "지금 보고 있는 반: 전체 / 6-1반" 같은 작은 안내를 두면 착오를 줄일 수 있다(선택 사항).
6. **반 관리**: §2.4 Q10에서 "화면 없이 SQL"을 선택하면 이 항목은 1차에서 만들지 않는다.

**성능 참고**: 기존 문서들(`docs/admin/spec.md` §12·§14, `docs/admin/responses-spec.md` §7)은 전체 조회 후 클라이언트 필터 방식을 "학급 30~100명 규모"를 가정해 추천해 왔다. 반이 여러 개가 돼도 **담임 교사가 보는 범위는 여전히 자기 반(30~100명) 규모라 문제가 없다.** 다만 총괄이 "전체 보기"를 고르면 반 수만큼 커지므로(예: 5개 반=최대 500명), 총괄 화면에는 §3.6-3의 반 필터를 기본으로 "내 화면"이 아니라 "반 하나 고르기"로 시작하게 해 두면 실질적인 조회량은 항상 학급 규모에 머문다.

### 3.7 학생 화면 변경

**원칙적으로 변경 불필요.** 학생용 화면(`/me/learning/`)은 이미 전부 `auth.uid()` 기준으로 자기 것만 조회하므로(`fetchUserAppResults`, `fetchUserSubmissions`, `findFeedbackThread` 등) 반 개념이 끼어들 자리가 없다. 유일하게 고려할 것은 학생이 "내 반"이라는 표시를 보고 싶어 하는지(예: 프로필/학습 페이지 한 줄) — 원하면 `my_class_id()`(§3.3)로 반 이름을 읽어 보여줄 수 있으나, **1차 범위에서는 불필요**로 추천한다(사용자가 요청한 것은 "교사가 반별로 나눠 본다"는 관리자 쪽 문제이지 학생 화면 문제가 아니다).

### 3.8 과학 앱 영향 — 코드 변경 불필요

`scripts/templates/class1-record.js`와 `science-sim`/`science-guide`의 `persist.js`를 직접 확인한 결과, 앱이 서버와 주고받는 모든 요청은 **`user_id`(로그인한 학생 자신) + `app_id`(앱 이름)** 두 값만 쓴다 — `Class1Record.save()`는 `app_results`에 `{app_id, user_id, score, ...}`만 insert하고, `loadProgress`/`saveProgress`도 `app_progress`를 `user_id`+`app_id`로만 조회·저장한다. 반(class)이라는 개념은 애초에 앱 코드 어디에도 없다(저장소 전체에서 `class_id`/`classroom`/`teacher` 관련 문자열을 검색해도 앱 템플릿에는 한 건도 없음을 확인했다).

`app_results`/`app_progress`의 **INSERT/본인 SELECT/UPDATE/DELETE 정책은 이번 설계에서 전혀 바뀌지 않는다**(§3.4 표 — "관리자 조회" 정책만 바뀐다). 즉 학생이 앱을 쓰는 동안 서버가 보는 것은 지금과 완전히 똑같다. 달라지는 것은 오직 "**관리자가 그 결과를 조회할 때**" RLS가 "이 관리자가 이 학생의 담임인가"를 한 번 더 확인한다는 것뿐이며, 이 확인은 전적으로 DB(교사가 로그인해서 `/admin/learning/`을 열 때)에서 일어난다. **23개 과학 앱 폴더의 코드·저장 키 버전은 하나도 바꿀 필요가 없다** — `CLAUDE.md`의 "저장 구조를 바꾸면 저장 키 버전을 올린다" 규칙도 이번 변경에는 해당하지 않는다.

### 3.9 확장 여지 (2차, 지금 만들지 않음)

§2.2에서 "1차 공유"로 정리한 항목(블로그 글, 과제, 학습게임)을 나중에 반별로 나누고 싶어지면, 다음 패턴을 재사용할 수 있다 — **지금 미리 만들어 둘 필요는 없지만, 나중에 큰 재설계 없이 확장 가능하다는 근거로 남겨 둔다.**

- 해당 테이블에 `class_id uuid null references classes(id) on delete set null` 컬럼을 추가한다. **`null` = 전체 공개(지금과 같은 동작)**, 값이 있으면 그 반 전용.
- SELECT 정책에 `(class_id is null or class_id = any(공개 대상의 가시 범위)) and (...)` 조건을 더한다. 학생 쪽은 "내 class_id와 같거나 null", 관리자 쪽은 "내가 담당하는 반이거나 null이거나 총괄"로 판단한다.
- 이 방식이면 마이그레이션 파일 하나(컬럼 추가 + 정책 재작성)로 끝나고, 기존 행은 전부 `class_id is null`(공개 유지)로 시작하므로 **기존 데이터 이관이 필요 없다.**
- 자유게시판(§2.2 Q4, 이번에 나누기로 한 항목)은 이 패턴을 그대로 쓰되 `class_id`를 **not null**로 만든다(게시판 글은 항상 어느 반 소속이어야 하므로). 작성 시 `community_posts_guard()` 트리거가 `new.author_id`의 `class_id`(§3.3의 `member_directory` 또는 `profiles`+`my_class_id()`)를 자동으로 채우게 한다. `kind='game'`은 지금처럼 `class_id`를 두지 않거나 항상 null로 둔다(§2.2 Q5에서 공유로 결정했으므로).

---

## 4. 지금 데이터 옮기기

기존 학생·교사·기록을 "첫 번째 반"으로 옮기는 절차 개요다(**실행 금지 — 실제 SQL은 Build 단계에서 검토를 마친 뒤 새 마이그레이션 파일로 작성하고, 사용자가 SQL Editor에서 직접 실행한다**, `CLAUDE.md`의 SQL 적용 절차를 따름). 아래는 재실행해도 안전하게 짤 수 있다는 것을 보여주는 스케치다.

```sql
-- ① 첫 번째 반을 만든다(반 이름은 실제로 정한 이름으로 — §2.5, 연도 포함 추천)
insert into public.classes (name, created_by)
select '2026 6학년 1반', p.id
from public.profiles p
where p.role = 'admin'
order by p.created_at
limit 1
on conflict do nothing  -- classes.name에 유일 제약이 없으므로 실제로는 "이미 만든 반이 있는지"를 select로 먼저 확인하고 넣는 방식을 추천
returning id;  -- 이 id를 다음 단계에서 쓴다(SQL Editor에서 결과를 보고 손으로 옮기거나, DO 블록의 변수로 이어서 처리)

-- ② 기존 학생을 전부 그 반으로 (class_id가 아직 없는 사람만 — 재실행 안전)
update public.profiles
   set class_id = '<위에서 만든 classes.id>'
 where role = 'user' and class_id is null;

-- ③ 지금의 유일한 교사(=사용자 본인)를 그 반의 담임으로 연결 + 총괄로 표시
insert into public.class_teachers (class_id, teacher_id)
select '<classes.id>', p.id
from public.profiles p
where p.role = 'admin'
on conflict do nothing;

update public.profiles
   set is_super_admin = true
 where id = '<사용자 본인의 auth.users id>';  -- 최초 관리자 지정과 같은 방식으로 1회 수동 지정
```

**확인 쿼리(예시)**:
```sql
-- 반이 하나 생겼고, role='user'인 사람이 전부 class_id를 갖게 됐는지
select count(*) from public.classes;
select count(*) filter (where class_id is null) as 반없음, count(*) as 전체
from public.profiles where role = 'user';
-- 총괄이 정확히 지정됐는지(1명이어야 정상, 여러 명일 수도 있음)
select id, display_name from public.profiles where is_super_admin;
-- 탈퇴 안전장치가 여전히 비어 있는지(이번 변경으로 새로 위험해진 FK가 없어야 한다)
select public.withdrawal_blocking_fks();  -- 빈 배열 {}이어야 정상
```

기록(app_results 등)은 `user_id`만으로 연결되어 있어 **한 건도 옮길 필요가 없다** — 학생의 `profiles.class_id`만 채워지면 그 학생의 모든 과거 기록이 자동으로 새 RLS 기준에 맞게 보인다(§2.5 방식 A의 특성이기도 하다).

---

## 5. 단계 계획

각 단계는 CLAUDE.md의 작업 사이클(Plan → Build → Review → 사용자 확인 → 커밋, push는 사용자 확인 후)을 따른다.

| 단계 | 범위 | Review에서 반드시 확인할 것 |
|---|---|---|
| 0 | 이 spec.md 승인(§2 질문에 답) | - |
| 1 | 스키마 마이그레이션: `classes`/`class_teachers` 생성, `profiles`/`member_directory`에 컬럼 추가, 새 함수 4개(§3.3), 동기화 트리거(§3.3). **RLS 정책은 아직 안 바꾼다** — 이 단계만으로는 기존 동작이 전혀 안 바뀐다(모든 새 컬럼이 기본값/null이라 `teaches_student()`를 아직 아무 정책도 안 씀) | 기존 화면이 실행 전과 똑같이 동작하는지(회귀 없음), `select public.withdrawal_blocking_fks();`가 여전히 빈 배열인지 |
| 2 | §4의 데이터 이관 SQL 실행·확인 + §3.4 RLS 정책 전부 치환(마이그레이션 1개 또는 2개로 분리 — Build 단계에서 결정) + `admin_dashboard_stats()`/`admin_set_role()` 재작성 | **가짜 계정 2개(서로 다른 반의 교사 역할)를 만들어** 각자 로그인 상태로 상대 반 학생의 `app_results`/`member_directory`/`assignment_submissions`/피드백을 조회해 **빈 결과 또는 권한 오류가 나는지 직접 확인**(SQL Editor에서 `set local role authenticated; set local request.jwt.claims = '{"sub":"<대상 teacher id>","role":"authenticated"}';`로 특정 사용자를 흉내 내 조회하거나, 실제 테스트 계정 2개로 브라우저 교차 로그인). `is_super_admin=true`인 계정은 여전히 전체를 보는지도 함께 확인 |
| 3 | Edge Function 3개 수정(§3.5) + 관리자 화면 추가(§3.6: 반 선택 폼, 반 열/필터) | 담임 교사 계정으로 "회원 추가"를 했을 때 다른 반에는 절대 만들어지지 않는지, 총괄 계정으로 `role:"admin"` 생성 시도가 일반 교사 계정으로는 거부되는지, 비밀번호 초기화·탈퇴가 다른 반 학생 대상으로는 403이 나는지 |
| 4 | 전체 Review + `docs/STATUS.md`/`CLAUDE.md` 갱신(반 개념이 생겼음을 반영) | 모바일 뷰포트 포함 관리자 화면 확인, 기존(1개 반이던 시절) 학생·기록이 이관 후에도 그대로 보이는지, 성능(반 필터 없이 총괄이 "전체 보기"를 눌렀을 때 응답 시간) |
| 5(선택) | §2.2에서 "반별 분리"로 정한 항목(자유게시판 등) 확장 — §3.9 패턴 적용 | 게시판 글이 실제로 다른 반에 안 보이는지, 신고 처리 권한이 반 경계를 지키는지 |

**위험과 대비**
- **RLS 재귀(42P17)**: §3.3에서 순환 없음을 확인했다. 다만 실제 SQL 작성 때 `profiles`/`class_teachers` 쪽 정책을 나중에 손대면서 실수로 `teaches_student()` 등을 거꾸로 참조하지 않도록 Review에서 한 번 더 점검한다(Postgres에는 로컬 실행 환경이 없으므로 코드 리뷰로 대체 — `CLAUDE.md` 규칙).
- **관리자 잠김**: 총괄 지정을 잘못하면(0명) 아무도 "누가 어느 반인지" 배정할 RPC를 못 쓰게 될 수 있다 — §4처럼 SQL로 직접 지정하는 절차를 반드시 먼저 실행하고 확인한 뒤 화면 작업으로 넘어간다.
- **기존 학생 영향**: 단계 1은 정책을 안 건드리므로 무영향. 단계 2에서 `class_id`가 비어 있는 학생이 하나라도 남으면 그 학생은 어떤 담임에게도(총괄 제외) 안 보이게 된다 — §4 확인 쿼리로 "반 없음" 인원이 0인지 반드시 확인.
- **성능**: §3.6 마지막 문단 참고.

---

## 6. 대략의 작업량과 사용자가 할 일

**새로 생기는 DB 객체**: 테이블 2개(`classes`, `class_teachers`), 컬럼 3개(`profiles.class_id`, `profiles.is_super_admin`, `member_directory.class_id`), 함수 5개(`is_super_admin`, `my_class_ids`, `teaches_student`, `my_class_id`, `sync_member_directory_class` 트리거 함수), 트리거 1개. 기존 RLS 정책 약 13개 + 함수 4개(`admin_dashboard_stats`, `admin_set_role`, `assignment_submission_guard`, 그 밖 §3.4 표의 함수들)를 수정.

**Edge Function**: 3개 파일 수정(`admin-create-member`, `admin-delete-member`, `admin-reset-password`) — 각각 서비스 롤로 "호출자가 이 반을 담당하는가"를 확인하는 코드 10~20줄 추가. `check-answer`는 변경 없음.

**화면**: 회원 추가 폼(반 선택 칸), 회원 목록(반 열/필터), 학습 현황·학생 응답 화면(반 필터, 선택 사항), 관리자 개요(변경 없음, 데이터만 바뀜). §2.4에서 "화면 없이 SQL"을 고르면 반 관리 화면 자체는 안 만든다.

**과학 앱**: 변경 없음(§3.8).

**사용자가 할 일**:
1. §2의 질문(특히 §2.6 표)에 답하고 이 문서를 승인한다.
2. 단계 1·2·3마다 마이그레이션 SQL을 Supabase SQL Editor에서 실행하고 확인 쿼리 결과를 확인한다(§4, §5).
3. 단계 3의 Edge Function 3개를 `npx supabase functions deploy <이름>`으로 다시 배포한다(코드가 바뀌므로 필수).
4. §4 ①~③처럼 첫 반·총괄 지정을 SQL로 1회 실행한다(자동화하지 않음, 기존 "첫 관리자 지정"과 같은 성격).
5. 두 번째 반(다른 교사)이 실제로 생기면, 그때 §2.4 Q10 방식대로 SQL 두 줄(`classes` insert, `class_teachers` insert)을 실행하고, 그 교사 계정을 총괄이 "회원 추가"로 만들어 준다.
6. 각 단계 Review 뒤 실제로 다른 반 역할을 흉내 낸 확인(§5의 "Review에서 반드시 확인할 것")을 함께 해 준다 — 가짜 세션이 아니라 실제 로그인 계정 2개로 교차 확인하는 것이 가장 확실하다.
7. push(배포)는 각 단계 Review가 끝난 뒤 사용자가 확인·요청할 때만 진행한다(`CLAUDE.md` 규칙 그대로).

---

## 7. 개인정보·보안 주의

- **이름은 지금도 전체 공개다**: `profiles.display_name`은 `using(true)`로 누구나 볼 수 있어(블로그 댓글 작성자 표시 등에 필요) 이번 설계로도 바뀌지 않는다. 블로그 글·학습게임(§2.2에서 공유로 유지)처럼 여러 반이 함께 보는 화면에서는 **다른 반 학생의 이름이 계속 보일 수 있다** — 자유게시판을 반별로 나누면(§2.2 Q4) 그 범위 안에서는 노출이 줄어들지만, 블로그 댓글·학습게임 등 공유로 남긴 영역은 이름 노출이 그대로다. 심각한 개인정보는 아니지만(같은 학교 학생들이라 서로 이미 알 수도 있음) 사용자가 인지하고 있어야 할 부분이다.
- **`class_id` 자체는 비공개로 설계했다**(§3.3) — `profiles`의 공개 컬럼 목록에 넣지 않고, `member_directory`(관리자 전용)와 `my_class_id()`(본인 전용)로만 노출한다. 다만 자유게시판을 반별로 나누면(§3.9) 그 게시판에 글을 쓰는 행위 자체가 "이 학생이 이 반이다"를 간접적으로 드러낼 수 있다(같은 반 학생들끼리는 어차피 아는 사실이라 위험도는 낮다).
- **Gemini(외부 AI)로 보내는 데이터**: `check-answer` 함수는 지금도 질문·학생 답·모범 답안 텍스트만 보내고 이름·학번·user id·이메일·반 정보를 전혀 넣지 않는다(코드로 확인함, §3.5). 이번 변경으로 새로 넘길 값이 없으므로 **`CLAUDE.md`의 "외부로 보내는 학생 데이터" 규칙은 그대로 지켜진다** — Build 단계에서 실수로 `classId`·반 이름 등을 프롬프트에 추가하지 않도록 주의만 하면 된다.
- **감사 로그의 반 경계**(§3.4): `password_reset_log`/`member_withdrawal_log`/`member_create_log`를 `teaches_student()`로 좁히면, 담임 교사는 "총괄이 다른 반 학생에게 한 조치"까지는 못 보게 된다 — 이건 의도된 동작이지만, 총괄이 전체 감사 로그를 보고 싶을 때는 `is_super_admin` 계정으로 확인해야 한다는 점을 사용자가 알고 있어야 한다.
- **학생 아이디(§2.3)**: 아이디 자체(예: 학번)는 개인정보로 보기 애매하지만, 여러 반이 같은 사이트를 쓰면서 서로 다른 학교/학년 학생이 섞일 가능성이 있다면 아이디 형식(예: 학번)만으로 학교·학년이 추측되지 않게 하는 편이 안전하다 — **확인 필요**: 이번 확장이 "같은 학교 여러 반"인지 "다른 학교 교사도 참여"인지에 따라 민감도가 달라진다.

---

## 8. 확인 필요 · 열린 항목 모아보기

- 앞으로 반이 몇 개까지, 어떤 속도로 늘어날지(같은 학교 안인지, 다른 학교까지인지) — §2.3 아이디 규칙과 §2.4 "화면 vs SQL" 결정에 영향
- 학생이 학기 중 반을 옮기는 일이 실제로 얼마나 있는지 — §2.5 방식 A/B 선택에 직결
- 자유게시판을 반별로 나누는 것에 대한 최종 확인(§2.2 Q4) — 추천안이지만 사용자 승인 필요
- 학습게임을 공유로 유지할지(§2.2 Q5) — 확신이 낮은 추천이므로 재확인 필요
- 관리자 승격을 총괄로만 좁히는 것(§2.1 Q3, §3.4 `admin_set_role`)이 지금 쓰는 방식과 달라지는 점 — 사용자가 원래도 그렇게 쓰고 있었는지 확인
- `classes.name`에 학교/학년 정보를 어떤 형식으로 넣을지(운영 규칙일 뿐 스키마에는 영향 없음)
- §3.4의 `admin_dashboard_stats()` 재설계 세부 사항(담임 화면에 어떤 숫자를 보여줄지)은 Build 단계에서 화면 문구와 함께 구체화 필요

---

## 개정 1 — 사용자 결정 (2026-09-26) **이 절이 위 본문과 다르면 이 절이 우선한다.**
사용자: "전반적으로 추천대로 해주고, 몇 가지만 개별 요청을 할게."
- "학생의 응답기록 보기 등은 그 반 학생의 담임교사만 가능하게 해줘.(총괄도 보기 불가능. 다만 비밀번호 초기화와 탈퇴처리는 총괄도 가능)"
- "담임교사는 본인 반에 한정해 학생 등록, 비밀번호 초기화, 탈퇴처리, 응답기록 보기 등을 모두 가능하게 해줘"
- "총괄도 본인 반에 대해서는 담임교사가 같은 권한 부여(전체 총괄이자 담임교사 역할 동시 부여)"
- "총괄이 회원 중 1명을 담임교사로 지정하면, 담임교사는 자기 반 학급을 개설하고 회원등록을 하게 해줘"
- "담임교사가 학급을 개설할 때 학급의 이름을 스스로 정하도록 해줘. 관리자(담임교사) 대시보드에서만 학급 이름 보임.(담임교사 확인 차원)"
- "학생들 입장에서는 내가 어느반인지 소속 정보는 나오지 않고 지금과 같은 인터페이스를 그대로 유지해줘"
- "현재 학생들이 소속되는 학급은 '부엉이반'이라고 이름을 정해줘. 부엉이반의 담임교사는 총괄 계정이야."

### 1-1. 권한 표(확정)
| 할 일 | 담임(자기 반 학생) | 총괄(자기 반 = 부엉이반) | 총괄(다른 반 학생) | 학생 |
|---|---|---|---|---|
| 학습 기록 보기(과학 앱 결과·진행, 학생 응답, 과제 제출, 피드백 대화, 글 읽음, 개요 숫자) | ✅ | ✅ | **❌(볼 수 없음)** | 본인 것만(지금과 같음) |
| 피드백 보내기·칭찬, 과제 제출 검토, 결과 지우기 | ✅ | ✅ | ❌ | - |
| 학생 등록(회원 추가 — 학생) | ✅ 자기 반에만 | ✅ 자기 반에만 | ❌ | - |
| 비밀번호 초기화 · 완전 탈퇴 | ✅ | ✅ | **✅(모든 반)** | - |
| 회원 명단 보기(이름·아이디·학급 이름·로그인 기록) | 자기 반 학생만 | 모든 회원(초기화·탈퇴·담임 지정을 하려면 찾아야 하므로) | (왼쪽과 같음) | - |
| 감사 로그(비밀번호 초기화·탈퇴·계정 생성) | 자기 반 학생 대상만 | 모두 | (왼쪽과 같음) | - |
| 담임 지정·해제(역할 admin↔user), 교사 계정 만들기 | ❌ | ✅ | ✅ | - |
| 학급 개설(이름 직접 정함)·이름 바꾸기 | ✅ 자기 학급 | ✅ 자기 학급 | ❌(다른 담임의 학급 이름은 회원 명단에 보이기만) | - |
| '로그인해야만 이용' 스위치 | ❌(보기만) | ✅ | ✅ | - |
| 학급 이름 보기 | 자기 학급만(관리자 화면에서만) | 모든 학급(관리자 화면에서만) | | **❌ 학생 화면에는 소속 정보를 전혀 보이지 않음(지금과 같은 화면)** |
- 블로그 글·과제(내용)·칭찬 문구·학습게임·자유게시판은 1차에서 지금처럼 **함께 씀**(추천 그대로). 자유게시판 반별 분리는 이 일이 끝난 뒤 5단계(선택)에서.
- 총괄 = `role='admin'` + `is_super_admin=true` + 부엉이반의 담임(`class_teachers`). 담임 = `role='admin'` + 자기가 개설한 학급(`class_teachers`). **학습 기록 판단 함수 `teaches_student()`에는 총괄 예외가 없다**(총괄도 자기 반만).

### 1-2. 흐름(확정)
1. 총괄이 회원 중 한 명을 **담임교사로 지정**(회원 명단의 동작 — `admin_set_role(p_user, 'admin')`, 총괄만). 또는 총괄이 "회원 추가"에서 역할 '교사'로 교사 계정을 바로 만든다(총괄만). 담임으로 지정되면 그 계정의 학생 소속(`class_id`)은 비운다.
2. 담임은 관리자 대시보드에서 **학급 개설**(이름 입력, 1~20자 권장) → 그 학급의 담임이 된다. 여러 학급을 만들 수 있다(다대다 설계 유지).
3. 담임은 "회원 추가"(한 명·엑셀)로 **자기 학급에 학생 등록**(학급이 하나면 자동, 여럿이면 고름). 학급이 없는 담임에게는 "먼저 학급을 개설해 주세요" 안내.
4. 담임 해제(총괄만): 그 교사가 담임인 학급이 남아 있으면 거부("학급을 먼저 다른 담임에게 넘기거나 비워 주세요" — 학생 기록이 아무에게도 안 보이게 되는 일을 막음). 학급 넘기기·반 이동은 1차에서 SQL(총괄이 SQL Editor) — 드문 일.

### 1-3. 지금 데이터(확정)
- 새 학급 **"부엉이반"** 하나를 만들고, 담임 = 총괄 계정, 지금의 모든 학생(`role='user'`)을 부엉이반으로.
- 총괄 계정 지정은 **이메일로 한 번 실행하는 SQL**로(저장소는 공개이므로 이메일을 저장소 파일에 넣지 않는다 — 틀만 `docs/classes/setup-owl-class.sql`에 두고, 실제 이메일은 Claude가 사용자에게 대화로 전달).
- 순서: ① 스키마·함수 SQL(동작 변화 없음) → ② 부엉이반·총괄 설정 SQL(대화로 받은 것) → ③ 권한 좁히기 SQL(총괄이 없으면 실행을 거부해 잠김 방지) → ④ Edge Function 3개 재배포 → ⑤ 화면 push.

### 1-4. 이름표(구현 약속 — DB와 화면이 같은 이름을 쓴다)
- 표: `public.classes(id uuid pk default gen_random_uuid(), name text not null check (char_length(btrim(name)) between 1 and 40), created_by uuid references public.profiles(id) on delete set null, created_at timestamptz not null default now(), archived_at timestamptz)`, `public.class_teachers(class_id uuid references public.classes(id) on delete cascade, teacher_id uuid references public.profiles(id) on delete cascade, created_at timestamptz not null default now(), primary key(class_id, teacher_id))`.
- 열: `profiles.class_id uuid references public.classes(id) on delete set null`, `profiles.is_super_admin boolean not null default false`(둘 다 공개 열 목록에 넣지 않음), `member_directory.class_id uuid references public.classes(id) on delete set null`(profiles에서 트리거로 동기화).
- 함수(`security definer`, `set search_path = ''`, 실행 권한은 기존 `is_admin()`과 같게): `is_super_admin() → boolean`, `my_class_ids() → uuid[]`, `teaches_student(p_student uuid) → boolean`(= `is_admin()` 이고 그 학생의 `class_id`가 내 학급 — 총괄 예외 없음), `can_manage_member(p_target uuid) → boolean`(= `is_super_admin() or teaches_student(p_target)`).
- 화면용 RPC: `my_admin_context() → jsonb` = `{"is_super_admin": bool, "classes": [{"id": uuid, "name": text, "student_count": int}]}`(관리자가 아니면 오류), `create_class(p_name text) → uuid`(관리자만, 자기를 담임으로 연결), `rename_class(p_class_id uuid, p_name text) → void`(그 학급 담임만).
- 표 권한: `classes` SELECT = `id = any(my_class_ids()) or is_super_admin()`(쓰기는 RPC로만), `class_teachers` SELECT = `teacher_id = auth.uid() or is_super_admin()`(쓰기는 RPC·SQL로만). 학생·비로그인은 둘 다 못 읽음.
- 바뀌는 기존 함수: `admin_set_role`(총괄만, admin으로 올리면 `class_id` 비움, 담임 학급이 남은 교사는 내리기 거부, 자기 자신·마지막 관리자 규칙 유지), `admin_set_login_required`(총괄만), `admin_dashboard_stats()`(내 학급 학생 기준 숫자 — 총괄도 자기 반 기준).
- 기록 표 RLS: 본문 §3.4 표의 `is_admin()` → `teaches_student(학생 열)` 치환(총괄 예외 없음). `member_directory`와 감사 로그 3개의 SELECT는 `can_manage_member(…)`.
- Edge Function: `admin-create-member` — 요청에 `classId` 추가. 학생 행은 호출자(총괄 포함)가 담임인 학급만, 교사 행(`role:"admin"`)은 총괄만(학급 없음). `admin-reset-password`·`admin-delete-member` — 호출자가 총괄이거나 대상 학생의 담임일 때만.

### 1-5. 열린 것(이번 일에서 바꾸지 않음 — 나중에 사용자 확인)
- 블로그 글·과제는 지금처럼 **관리자(교사) 누구나 모든 글·과제를 고칠 수 있다**. 교사가 여럿이면 "작성자 본인 또는 총괄만 수정"이 나을 수 있음.
- 자유게시판·학습게임 숨기기·신고 처리도 지금은 교사 누구나 전체 — 5단계(게시판 반별 분리) 때 함께 정리.
