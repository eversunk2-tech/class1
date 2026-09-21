# Build A 보고: 관리자 대시보드 기반 ~ 비밀번호 초기화 (spec §10 단계 0~4)

- `npm run lint` 통과, `npm run build` 통과. `out/admin/`, `out/admin/posts/`, `out/admin/members/`, `out/reset-password/` 생성 확인.
- 실 DB에는 쓰지 않았다(SQL 실행 안 함, Edge Function 배포 안 함). 커밋·푸시 안 함.
- 브라우저 확인: 비로그인 상태로 `/admin/members/` 접근 시 `/login/`으로 이동하는 것만 확인. 관리자 로그인 화면은 계정이 없어 눈으로 확인하지 못함 → 사용자 확인 필요(아래 체크리스트).

## 파일 목록

### 신규
| 경로 | 역할 |
|---|---|
| `supabase/migrations/20260921020000_admin_learning.sql` | spec §4 전체 스키마(단계 B용 테이블 포함) + 백필 + §14 반영. 재실행 안전 |
| `supabase/functions/admin-reset-password/index.ts` | 비밀번호 초기화 Edge Function(Deno, `npm:@supabase/supabase-js@2`) |
| `supabase/functions/admin-reset-password/README.md` | 배포 방법 A(CLI)/B(대시보드), JWT 검증, 문제 해결 |
| `src/app/admin/layout.tsx` | 전 `/admin/*`에 `AdminGuard` 적용 |
| `src/app/admin/(dashboard)/layout.tsx` | 대시보드 크롬(`AdminShell`) — 개요/글 관리/회원 관리 |
| `src/app/admin/(dashboard)/page.tsx`, `admin-overview.tsx` | 개요(통계 타일 4, 최근 가입 5명, 바로 가기) |
| `src/app/admin/(dashboard)/posts/page.tsx` | 글 관리(옮겨 온 `AdminPostList`) |
| `src/app/admin/(dashboard)/members/page.tsx`, `members-view.tsx`, `member-list.tsx`, `member-detail.tsx` | 회원 목록(검색·정렬·비밀번호 초기화) / 상세(`?id=`, 프로필·초기화·관리자 지정/해제) |
| `src/app/reset-password/page.tsx`, `reset-password-form.tsx` | 새 비밀번호 설정(강제/자발적) |
| `src/components/admin/admin-shell.tsx` | 관리자 메뉴(`adminNavItems`), `AdminShell`, `AdminPageHeader` |
| `src/components/admin/member-badges.tsx` | `MemberAvatar`, `ProviderBadges`, `RoleBadge` |
| `src/components/admin/password-reset-dialog.tsx` | 확인 → 호출 → 임시 비밀번호 1회 표시(복사, "확인했어요, 닫기"로만 닫힘) |
| `src/components/force-password-change-gate.tsx` | `must_change_password`면 `/reset-password/`로 이동(`/login/` 예외) |
| `src/lib/admin.ts` | 회원 조회, 표시 헬퍼, `resetMemberPassword`, `setMemberRole`, `isMissingSchemaError` |

### 이동/수정
| 경로 | 변경 |
|---|---|
| `src/app/admin/admin-post-list.tsx` → `src/app/admin/(dashboard)/posts/admin-post-list.tsx` | 내용 변경 없음 |
| `src/app/admin/page.tsx` | 삭제(개요로 대체) |
| `src/app/admin/write/page.tsx` | 페이지 내 `AdminGuard` 제거(레이아웃이 담당) |
| `src/app/admin/write/post-editor.tsx` | "글 관리" 링크·삭제 후 이동을 `/admin/posts/`로 |
| `src/components/user-menu.tsx` | 관리자 대시보드/글 관리(`/admin/posts/`)/새 글 작성/회원 관리, "비밀번호 변경"(비밀번호 로그인 계정만) |
| `src/app/layout.tsx` | `<ForcePasswordChangeGate />` 마운트 |
| `src/lib/types.ts` | `Profile.must_change_password?`, `MemberDirectory`, `MemberRow`, `MEMBER_ROW_COLUMNS`, `AppResult`, `PostRead`, `Assignment`, `AssignmentSubmission`, `FeedbackThread`, `FeedbackMessage`, `AdminDashboardStats` |
| `src/lib/auth.ts` | `passwordUpdateErrorMessage` 추가 |
| `tsconfig.json`, `eslint.config.mjs` | `supabase/functions` 제외(Deno 코드가 Next 타입체크·lint에 걸리지 않게) |

## spec과 다른 점 / 보완한 점

1. **백필**: `member_directory`에 기존 `auth.users` 백필(`insert ... select ... on conflict (id) do update`) 포함(§14 Q3).
2. **동기화 트리거**: update 트리거를 `after update of email, raw_app_meta_data, last_sign_in_at`으로 좁힘(토큰 갱신 등에는 반응 안 함). 함수는 profiles 행이 없으면 건너뛰어 가입을 막지 않음. `email`이 null인 계정 대비 `coalesce(email,'')`.
3. **Q8 제출 삭제**: 학생 본인 삭제 = `status <> 'reviewed'` 그리고 (`due_at is null` 또는 `now() < due_at`). 즉 `needs_revision`(수정 요청)도 삭제 후 재제출 가능. 관리자는 항상 삭제. 연결된 피드백 스레드는 **대화 보존을 위해 남김**(`context_id`는 FK 없는 다형 참조라 끊긴 참조가 됨 → 단계 B 화면에서 "삭제된 제출물"로 표시 필요). `set null`은 `unique(student_id, context_key)` 충돌 위험이 있어 쓰지 않음.
4. **Q1**: 마감 조건 없음(마감 후 제출·수정 허용).
5. **제출 가드 강화**: insert 시 비관리자는 `status='submitted'`, `submitted_at=now()`로 강제. update 시 `user_id`/`assignment_id`/`submitted_at` 변경 불가. 관리자가 남의 제출물은 status만 변경 가능.
6. **`admin_set_role`**: 자기 자신 해제 불가, 마지막 관리자 해제 불가, 대상 없음 오류, 관리자 행 `for update` 잠금(동시 해제 경쟁 방지).
7. **추가 정책**: `app_results` 관리자 삭제, `feedback_threads` 관리자 삭제. `post_reads`/`app_results`/`feedback_*`의 불필요한 update grant는 revoke. 모든 RPC는 `anon` 실행 권한도 revoke.
8. **`get_or_create_feedback_thread`**: `context_type` 검증, `general`이면 `context_id`를 null로 정규화.
9. **Edge Function**: 임시 비밀번호 **14자**(spec 초안 10자 → 지침 12자 이상), 대/소문자·숫자 각 1자 이상, 거절 샘플링으로 편향 제거. `esm.sh` 대신 `npm:` 지정자. CORS 허용 헤더를 supabase-js가 실제 보내는 목록(`x-retry-count`, `traceparent` 등)과 맞춤. 허용되지 않은 출처에는 `Access-Control-Allow-Origin`을 아예 보내지 않음. `userId` UUID 형식 검사. 플래그 설정 실패 시 임시 비밀번호와 `warning`을 함께 반환(비밀번호는 이미 바뀌었으므로).
10. **모바일 관리자 메뉴**: shadcn `Tabs` 대신 가로 스크롤 링크 목록(탭 패널이 아니라 페이지 이동이라 링크가 맞음). lg 이상은 본문 왼쪽 세로 메뉴.
11. **개요 화면**: `admin_dashboard_stats`(학습 통계)는 단계 10 범위라 이번엔 count 쿼리 타일(전체 회원/전체 글/발행된 글/비밀번호 변경 대기)만. "최근 학습활동"도 단계 B.
12. **`/reset-password/`**: 클라이언트에서 8자 미만은 막음(Q4 문구 + 3.7 "너무 짧음" 검증). OAuth 전용 계정은 강제 대상이 아니면 "비밀번호가 없는 계정" 안내. `clear_must_change_password` 실패 시 "다시 시도"(비밀번호 재입력 없이 플래그만 재시도).
13. **회원 상세의 학습활동/피드백 탭**은 만들지 않음(자리 주석만). 사용자 메뉴에 "학습 현황", "내 학습 활동" 없음(페이지 없음).
14. **마이그레이션 전 동작**: 새 테이블/함수가 없으면 회원 화면·개요 타일에 "DB 설정이 아직 적용되지 않았습니다… SQL을 실행해 주세요" 안내(`isMissingSchemaError`). Edge Function 미배포 시 "비밀번호 초기화 기능에 연결하지 못했습니다/아직 준비되지 않았습니다… 배포해 주세요".

### 알려진 한계
- `profiles`는 "누구나 조회" 정책이라 `must_change_password` 값도 공개 조회된다(누가 초기화 대기인지 노출, 민감도 낮음). 막으려면 컬럼을 별도 테이블로 옮겨야 함 — 이번엔 spec대로 둠.
- 임시 비밀번호는 결과 다이얼로그를 닫아도 다음에 다시 열 때까지 컴포넌트 state(메모리)에 남는다(화면·저장소에는 남지 않음).

## 사용자가 할 일

1. **SQL 실행**: Supabase SQL Editor에서 `supabase/migrations/20260921020000_admin_learning.sql` 전체 실행. 파일 상단 주석의 확인 쿼리로 `member_directory` 수가 `auth.users` 수와 같은지 확인.
2. **Edge Function 배포**: `supabase/functions/admin-reset-password/README.md`의 방법 A(CLI) 또는 B(대시보드). **Verify JWT는 켠 상태 유지**.
3. **확인 체크리스트**(관리자 계정으로):
   - `/admin/` 개요, `/admin/posts/`, `/admin/members/` 이동·활성 메뉴 표시, 모바일 폭 가로 메뉴.
   - 회원 검색/정렬, 행 클릭 → 상세, 없는 id → "회원을 찾을 수 없습니다".
   - 테스트 학생 비밀번호 초기화 → 임시 비밀번호 복사 → 그 계정으로 로그인 → `/reset-password/` 강제 이동 → 새 비밀번호 저장 → `/`로 이동, 다시 다른 화면 이동 가능.
   - 다른 계정 관리자 지정/해제, 본인 해제 버튼 비활성, 관리자가 1명일 때 해제 시 오류 문구.
   - 글 작성/삭제 후 "글 관리"로 돌아가는 링크.

## 단계 B가 재사용할 것

- **메뉴**: `src/components/admin/admin-shell.tsx`의 `adminNavItems`에 `{ id: "learning", label: "학습 현황", href: "/admin/learning/", ... }` 추가. 새 화면은 `src/app/admin/(dashboard)/learning/`에 두면 크롬·가드가 자동 적용. 페이지 제목은 `AdminPageHeader`.
- **사용자 메뉴**: `src/components/user-menu.tsx` 관리자 그룹에 "학습 현황", 공통 그룹에 "내 학습 활동"(+안 읽은 배지) 추가.
- **회원 상세**: `member-detail.tsx`의 "학습활동 영역" 주석 자리에 탭 추가. `MemberRow`(`member`)와 `patchMember` 사용 가능.
- **타입**: `src/lib/types.ts`에 학습·과제·피드백 타입과 `AdminDashboardStats`가 이미 있음.
- **헬퍼**: `src/lib/admin.ts`의 `isMissingSchemaError`/`MISSING_SCHEMA_MESSAGE`(오류 UI), `memberName`/`accountLabel`/`MemberAvatar`(학생 이름 표시), `UUID_RE`.
- **개요**: `admin-overview.tsx`의 `CountTile`/타일 목록을 `admin_dashboard_stats` 호출로 교체하거나 추가하고, "최근 학습활동" 섹션을 추가.
- **피드백 스레드와 삭제된 제출물**: 위 "다른 점 3" 참고 — 스레드의 `context_id`로 제출물을 못 찾으면 "삭제된 제출물" 표시.
- `class1-record.js` 템플릿(`scripts/templates/`)은 이번 범위 밖이라 만들지 않음.
