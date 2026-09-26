# Build 보고서(관리자 화면) — 반별로 나눠 보이게 하기 (2026-09-26)

> 기준: `docs/classes/spec.md` 개정 1(1-1 권한 표 · 1-2 흐름 · 1-4 이름표), 지침 `build-ui-instructions.md`.
> 수정 범위: `src/`(관리자 영역·lib·hook·admin 컴포넌트)와 이 보고서만. `supabase/`·`public/`·`scripts/`는 건드리지 않았다. 커밋·push·실 DB 접속·설치 없음.
> **이름표(1-4)를 하나도 바꾸지 않았다.** DB 담당 결과(`build-db-report.md`, 새 마이그레이션 2개, Edge Function)와 이름·반환 모양을 읽어서 대조했다(§3).

## 1. 바꾼 파일

| 파일 | 내용 |
|---|---|
| `src/lib/classes.ts` (새) | `my_admin_context()`·`create_class`·`rename_class` 호출, `classes`·`class_teachers` 읽기, 학급 이름 검사(1~40자·제어 문자 불가 — 서버와 같은 규칙), 한국어 오류 |
| `src/hooks/use-admin-context.tsx` (새) | 대시보드 공용 Provider: 총괄 여부·내 학급(학생 수)·볼 수 있는 학급 이름·교사별 담임 학급, 학습 화면의 학급 범위(`scopeClassIds`), 권한 판단(`adminPermissions`). 상태 `loading/ready/missing(SQL 전)/error` |
| `src/components/admin/class-card.tsx` (새) | "내 학급" 카드 + 학급 개설/이름 바꾸기 대화 상자 |
| `src/components/admin/class-controls.tsx` (새) | 회원 추가의 학급 칸(하나면 자동), 학습 현황 학급 고르기(2개 이상일 때), "내 학급 전체 기준" 안내, 학급을 알기 전엔 학생 명단을 안 불러오는 문지기 |
| `src/components/admin/role-change-dialog.tsx` (새) | 담임교사 지정/해제 확인 창(`admin_set_role`), 거부 사유를 창 안에 한국어로 |
| `src/app/admin/(dashboard)/layout.tsx` | Provider 연결 |
| `src/lib/types.ts`·`src/lib/admin.ts` | 회원 행에 `class_id`(SQL 전이라 열이 없으면 예전 열로 다시 읽음 — 화면이 막히지 않게). 초기화·탈퇴 막힘 문구 "교사 계정 … 총괄이 담임 해제 뒤" |
| `src/lib/learning.ts` | `fetchStudents(classIds)` — 학생 명단을 내 학급(또는 고른 학급)으로 거름 |
| `src/lib/member-import.ts` | 요청 필드 `classId`, 교사 줄은 총괄만(`applyRolePolicy`), 403 한국어 사유 그대로 표시 |
| `members/member-list.tsx` | "학급" 열·학급으로 검색·정렬, 총괄 학급 필터(전체·각 학급·학급 없음, 보관 학급은 "(보관됨)"), ⋮ 메뉴 "담임교사로 지정/담임 해제"(총괄만), 학급 없는 담임은 회원 추가 막고 옆에 "먼저 학급을 개설해 주세요", 빈 목록 문구 |
| `members/member-detail.tsx` | "학급" 칸, 역할 "교사(관리자)/학생", 지정/해제 버튼은 총괄만(공용 확인 창), **내 학급 학생이 아니면 학습활동 탭 대신 안내**(요청도 안 함) |
| `components/admin/member-create-dialog.tsx` | 한 명: 역할 칸은 총괄에게만(교사는 학급 없이), 학생은 내 학급 중에서(하나면 자동, 여럿이면 필수 선택). 엑셀: 파일 하나 = 학급 하나, 담임에게 "교사" 줄은 오류, "학생 N명 → ‘학급’" 요약, 서식 파일은 그대로 |
| `components/admin/login-required-card.tsx` | 스위치는 총괄만. 담임은 읽기 전용 + "총괄 선생님만 바꿀 수 있어요" |
| `admin-overview.tsx`·`admin-shell.tsx`·`member-badges.tsx` | 개요 맨 위 "내 학급" 카드, 통계 "내 학급 학생", 최근 가입 회원에 학급 이름, 메뉴 머리 "관리자 · 총괄", 역할 배지 "교사" |
| `learning/*.tsx` (7개) | 학생 명단이 쓰이는 탭(웹앱 결과·학생 응답·과제·참여 집계)을 문지기로 감싸 내 학급 범위로, 학급 2개 이상이면 머리에 학급 고르기, 빈 상태 "내 학급 학생이 아직 없어요", 개요 "(내 학급 학생 기록 기준)" |

학생 화면(`/me/…`, 과학 앱, 공개 화면)과 공용 학습 패널·피드백 컴포넌트는 **바꾸지 않았다**(git diff에 없음).

## 2. 화면(세 경우)
* **학급 없는 새 담임**: 개요·회원 관리 맨 위 "내 학급" 카드에 "아직 개설한 학급이 없어요 / 먼저 학급을 개설해 주세요" + [학급 개설]. 회원 관리의 [회원 추가]는 막히고 옆에 같은 안내. 개설(이름 직접, 1~40자, 20자 권장, 학생 화면엔 안 보인다는 안내) → 카드에 "새싹반 · 학생 0명", 회원 추가가 열리고 학급이 자동으로 정해짐. 잠금 스위치는 읽기 전용.
* **담임(학급 1개)**: 카드에 자기 학급·학생 수·[이름 바꾸기]. 회원 관리는 "내 학급 학생 N명", 학급 열, 학급 필터 없음, ⋮ 메뉴는 초기화·탈퇴만. 회원 추가: 역할 칸 없음, 학급 자동. 엑셀: 교사 줄은 "교사 계정은 총괄 선생님만…" 오류. 학습 현황은 자기 학급 명단 기준. 잠금 스위치 읽기 전용.
* **총괄(부엉이반 담임 겸)**: 카드에 "총괄" 배지 + "학습 기록은 내 학급 학생 것만" 안내, 메뉴 "관리자 · 총괄". 회원 관리는 모든 회원·모든 학급 이름, 교사 행 "담임: ○○반", 학급 필터, ⋮ "담임교사로 지정/담임 해제"(본인 행은 막힘), 회원 추가에 "교사(담임)" 역할. 다른 학급 학생 상세: 학급 표시·초기화·탈퇴·지정 버튼, 학습활동은 "내 학급 학생이 아니어서…" 안내. 학생 응답·참여 집계는 부엉이반 학생만. 잠금 스위치 켜고 끔.
* **학급 2개 담임**: 학습 현황 머리에 [학급: 내 학급 전체(2개)/각 학급], 회원 관리에 학급 필터, 회원 추가는 학급을 골라야 [만들기]가 열림.
* **학급 SQL 적용 전**(함수 없음): 예전 화면 그대로(역할 고르기·잠금 스위치 누구나) + "학급 기능 준비 전 · …_classes_schema.sql을 실행해 주세요" 안내 한 줄.

## 3. 쓰는 이름(이름표 1-4와 대조 — 모두 일치)
| 종류 | 화면이 쓰는 것 | DB 담당 결과 |
|---|---|---|
| RPC | `my_admin_context()` → `{is_super_admin, classes:[{id,name,student_count}]}` | 같음(보관 학급 제외, 탈퇴 학생 빼고 셈) |
| RPC | `create_class(p_name)` → uuid, `rename_class(p_class_id, p_name)` | 같음. 서버 추가 규칙(제어 문자·내 학급 같은 이름 거부)도 화면에서 미리 막음 |
| RPC | `admin_set_role(p_user, p_role)`, `admin_set_login_required(p_value)`, `admin_dashboard_stats()` | 같음(총괄만 / 반환 열 그대로, 내 학급 기준) |
| 표 | `classes`(id,name,archived_at) SELECT, `class_teachers`(class_id,teacher_id) SELECT | 정책 `id = any(my_class_ids()) or is_super_admin()` / `teacher_id = auth.uid() or is_super_admin()`, authenticated SELECT 권한 |
| 열 | `member_directory.class_id`(읽기 + `class_id=in.(…)` 필터) | 트리거로 동기화 |
| Edge Function | `admin-create-member` 본문 `classId`(학생 줄 학급, 교사만 만들 때는 보내지 않음) | 같음(400/403 한국어 `error`) |
| 쓰지 않음 | `profiles.class_id`·`profiles.is_super_admin`(공개 열 아님 — 화면은 읽지 않음) | 공개 열 권한에서 제외됨 |

## 4. 검증
* `npm run lint` 통과 · `npx tsc --noEmit` 통과 · `npm run build` 통과(24쪽 정적 생성).
* 자기 정적 서버(127.0.0.1:8783, 스크래치 `site/class1 → out`) + 자기 headless Chrome(9354, 스크래치 프로필) + `--host-resolver-rules "MAP *.supabase.co ~NOTFOUND"`(가로채기 없이 fetch하면 `Failed to fetch` 확인) + 첫 로드부터 CDP `Fetch`로 모든 요청 가로채기(Supabase는 가짜 응답, 그 밖 호스트는 차단) + `Network.setCacheDisabled`. 가짜 세션·가짜 RLS(담임은 자기 반, 총괄은 회원 전체·기록은 자기 반). 실제 Supabase·Gemini 요청 0건, 외부 요청 0건, 콘솔 오류 0건.
* 시나리오 9개 **109개 확인 모두 통과**: 새 담임(개설→자동 학급→`classId`=새 학급), 담임(학급 열·메뉴·자동 학급·엑셀 교사 줄 거부·bulk `classId`·명단 요청 `class_id=in.(자기 반)`·상세), 총괄(잠금 스위치 호출·학급 필터·지정 호출·해제 거부 사유 표시·본인 해제 막힘·교사 계정은 `classId` 없이·다른 반 학생 상세는 기록 요청 0건·학생 응답/참여 집계는 부엉이반만·1280/768/375 가로 넘침 없음), 학급 2개(고르기·범위 요청), 이름 바꾸기(같은 이름·41자 막힘·`rename_class`), 학급 정보 실패(오류+다시 시도, 명단 안 불러옴, 회원 추가 막힘), SQL 전(목록·예전 동작), 학생 `/me/learning/`(학급 글자·학급 요청 0건, `/admin/` 막힘).
* 스크린숏(37장) `/private/tmp/claude-501/-Users-sungchul-Desktop-classroom/7bf3a39e-3017-4189-b337-1b82aace66bb/scratchpad/classes-ui/shots/`:
  * 새 담임: `new-teacher-1-overview-no-class.png`, `new-teacher-2-members-no-class.png`, `new-teacher-3-create-class-dialog.png`, `new-teacher-4-class-created.png`, `new-teacher-5-add-member-auto-class.png`, `new-teacher-6-overview-mobile.png`
  * 담임: `homeroom-1-overview.png`, `homeroom-2-members.png`, `homeroom-3-row-menu.png`, `homeroom-4-add-member.png`, `homeroom-5-excel-preview.png`, `homeroom-6-responses.png`, `homeroom-7-member-detail.png`, `homeroom-8-members-mobile.png`
  * 총괄: `super-1-overview.png`, `super-2-login-switch-confirm.png`, `super-3-overview-dark.png`, `super-4-members.png`, `super-4b-members-1280.png`, `super-5-members-filter-fox.png`, `super-6-designate-confirm.png`, `super-7-undesignate-refused.png`, `super-8-add-teacher.png`, `super-9-other-class-student.png`, `super-10-responses-own-class.png`, `super-11-engagement.png`, `super-12-members-mobile.png`, `super-13-members-tablet.png`
  * 그 밖: `multi-1~3-*.png`, `rename-1-too-long.png`, `rename-2-done.png`, `ctxerror-1~2-*.png`, `legacy-1-members.png`, `student-me-learning.png`
* 시험 스크립트(`lib.mjs`·`backend.mjs`·`run.mjs`)와 결과 `report-all.json`은 같은 스크래치 폴더에 남김(Review용). 서버·Chrome 종료, Chrome 프로필 삭제. 시험 비밀번호는 실행 중에만 만들고 어디에도 적지 않음.

## 5. 확인하지 못한 것 — 실 DB·실 기기에서 확인할 것
1. SQL ①②③ 실행 뒤 총괄 계정: "관리자 · 총괄", 부엉이반 학생 수가 맞는지, 회원 관리에 모든 회원과 학급 이름·교사 행 "담임: 부엉이반", 잠금 스위치가 켜지고 꺼지는지.
2. 담임 지정 → 그 계정으로 로그인 → 학급 개설 → 회원 추가(한 명·엑셀) → 새 학생이 **그 담임의 회원 명단에 바로 보이는지**(`member_directory.class_id` 트리거) — 함수 재배포 뒤.
3. 담임 계정에서: 다른 반 학생이 명단·학생 응답·과제·참여 집계·피드백에 안 보이는지, 잠금 스위치 읽기 전용, 교사 역할 칸 없음.
4. 총괄이 다른 반 학생 상세를 열 때 학습 기록 대신 안내가 나오고, 비밀번호 초기화·탈퇴는 되는지(함수 재배포 뒤).
5. 담임 해제: 학생이 있는 학급을 혼자 맡은 교사 → 거부 사유가 창 안에 보이는지, 빈 학급만 가진 교사 → 해제되고 필터에 "(보관됨)".
6. 개요 "내 학급 학생" 숫자 = 카드의 학생 수(탈퇴 학생 제외 — 서버 정의).
7. 실제 iPad/태블릿에서 새 대화 상자(학급 개설·회원 추가 학급 칸·지정 확인)와 표의 학급 열.

## 6. 걱정되는 점·메모
* **배포 순서가 중요**: ① schema → ② 부엉이반·총괄 → ③ rls → ④ 함수 3개 재배포 → ⑤ 화면 push. ④ 없이 ⑤를 하면 옛 함수가 `classId`를 무시해 **새 학생이 학급 없이** 만들어진다(담임 명단에 안 보이고 총괄 명단에 "학급 없음"). 반대로 ④ 뒤·⑤ 전의 옛 화면은 함수가 "학급이 하나면 자동"으로 받아 준다(DB 담당 처리).
* SQL 전에 화면이 먼저 나가도 막히지 않게 예전 방식으로 동작한다(시험함) — 단 그때는 반별 구분이 없다(RLS도 예전 그대로이므로).
* 학습 현황의 학급 고르기는 브라우저 탭 동안만 기억(새로고침하면 "내 학급 전체"). 학급을 고른 상태에서도 개요 탭·과제 목록의 숫자는 서버 집계라 "내 학급 전체 기준"(안내 문구 표시).
* 역할 표시를 "관리자" → "교사", 버튼을 "관리자로 지정/해제" → "담임교사로 지정/담임 해제"로 바꿨다(SQL 전 화면에서는 예전 문구).
* 참여 집계의 학생 목록은 공개 `profiles`를 읽은 뒤 내 학급 명단으로 거른다(이름은 원래 공개 — spec §7).
* 새 버튼·입력칸은 44px, 기존 표의 ⋮(28px)는 그대로 두었다. 학급 열은 1280 화면에서 표가 상자 안에 들어오게 좁게(띄어쓰기에서 줄바꿈).
* 담임 해제 규칙은 DB 담당 결정(학생 있는 학급을 혼자 맡으면 거부, 빈 학급은 보관 — `build-db-report.md` §0)에 맞춰 확인 창 문구를 썼다. 글자 그대로("학급이 하나라도 있으면 거부")로 바꾸면 문구도 같이 고쳐야 한다(`role-change-dialog.tsx`).
