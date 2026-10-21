# 묶음 4 보고 — 관리자 화면 (구현 담당 D, 2026-10-20)

> 지침: `build-common.md` → `build-4-admin-ui-instructions.md`. 기준: `spec.md`(개정 1~3), `privacy-policy.md` 8절(**개정 3 반영** — 보유 기한 "종업식 뒤 그 학년도의 2월 28일"과 '2월 알림'은 작업 도중 원문이 바뀌어 다시 맞췄다).
> git commit/push·실 DB 읽기/쓰기·내려받기·설치 없음. 시험은 전용 headless Chrome(포트 9482) + 가짜 Supabase 응답만.

## 1. 만든 것

| 화면 | 내용 |
|---|---|
| **개인정보 설정** `/admin/privacy/` (총괄만, 메뉴 '개인정보 설정'도 총괄에게만) | 교사 인증 코드(숫자 6칸 × 2 — 적으면 다음 칸, 지우면 앞 칸, 붙여 넣기 나눠 채움, 숫자 아닌 글자는 받지 않음 → `admin_set_teacher_code`, 정한 뒤 칸을 바로 비움), 문의 이메일(모양 검사 → `admin_set_contact_email`), 현황 4줄(`admin_privacy_overview`), 학급 정리 기한·2월 알림 카드. 총괄이 아니면 안내 한 줄만. SQL ① 전이면 "준비 전" 한 줄만 |
| **회원 목록·상세** | 배지 '인증 전'(노란 표)·'30일 넘음'(붉은 표, 가입 30일 초과)·'교사 · 내 학급 일만'·'교사'(설명은 마우스를 올리면, 상세에서는 글로), 보호자 동의 열(학생 아이디 계정만 — "동의서 확인 {날짜}"/"기록 없음"), 메뉴 [모든 권한 주기]/[내 학급 일만으로 줄이기](총괄·교사 계정·자기 자신 제외 → 확인 창 → `admin_set_teacher_scope`), [동의서 받음으로 기록](그 학생의 담임만 → `admin_set_guardian_consent`), 목록 위 학급별 [이 학급 모두 동의서 받음으로 기록](`admin_set_guardian_consent_class`), **[기록까지 삭제]**(아이디 계정 학생 — 그 학생의 담임 또는 총괄, 이름 입력 확인 → `admin-clear-students {userId, confirmName}`) |
| **회원 추가** | 학생 역할일 때만 필수 체크(한 명: "이 학생의…", 엑셀: 학생 줄이 있을 때 "이 파일에 있는 학생 모두의…"), 도움말 안의 [보호자 동의서 양식 내려받기(한글 파일)] 링크 = `withBasePath("/templates/guardian-consent.hwpx")`(개발 서버에서 200 확인), 체크하지 않고 만들기를 누르면 "보호자 동의서를 받았다는 표시가 필요해요." + 체크 칸으로 초점 + 함수 호출 없음, 체크하면 요청에 `guardianConsent: true`(교사 줄만이면 보내지 않음) |
| **학급 정리** | '내 학급' 카드의 학급마다 [학급 정리] → 미리보기(`admin_class_cleanup_preview`)로 인원 → 학급 이름 입력이 같아야 단추 켜짐 → 20명씩 `remaining = 0`까지 되풀이(진행 "n/m명", 처리 중 닫히지 않음) → 한 번에 아무도 못 지우면 멈추고 "k명을 지우지 못했어요…" → 같은 단추로 다시(지운 수는 이어서 셈). 학생 0이면 "지울 학생이 없어요."·단추 꺼짐. 함수 미배포·네트워크 오류 안내 |
| **학급 정리 기한 카드** | 개요(담임 = 자기 학급, 총괄 = 전체 — 서버가 거름)와 개인정보 설정. "학급 정리 기한"(기한 지남)·"2월 알림"(2월 한 달) 블록, 학급마다 [학급 정리 열기]. 보일 것이 없으면 개요에는 아무것도 안 그림 |
| **"자기 학급 일만" 선생님** (`my_admin_context().teacher_scope = 'class'`) | 칭찬 문구 관리 = 읽기 전용 + 안내 한 줄(보내기는 그대로), 커뮤니티 = 학습게임 글·학습게임 신고의 숨기기·삭제·처리 단추 없음 + 안내 한 줄(자기 게시판 관리는 그대로), 블로그 글 관리 = [새 글 작성] 꺼짐 + 안내 한 줄. 학급 개설·회원 추가·학급 정리 등 학급 안 일은 그대로 |

## 2. 고친 파일

- 신규: `src/data/privacy-admin-text.ts`(8절 글 상수 + 새 문장 묶음), `src/lib/admin-privacy.ts`(RPC·함수 래퍼, 표시 훅·메뉴 판단), `src/app/admin/(dashboard)/privacy/page.tsx`·`privacy-settings.tsx`, `src/components/admin/class-cleanup-dialog.tsx`
- 신규(지침 목록 밖 — 같은 기능의 확인 창이라 새 파일로 둠, 다른 묶음 파일과 겹치지 않음): `src/components/admin/guardian-consent-dialog.tsx`(8-2 확인 창 두 가지), `src/components/admin/member-erase-dialog.tsx`(8-5 확인 창)
- 수정: `src/hooks/use-admin-context.tsx`(`teacherScope`·`isFullAdmin`·`useOptionalAdminContext`), `src/lib/classes.ts`(`teacher_scope` 읽기, 없으면 `full`), `src/lib/member-import.ts`(`guardianConsent` 전송, `needsGuardianConsent`), `src/components/admin/admin-shell.tsx`(총괄 전용 메뉴), `member-badges.tsx`(배지·`RichText`·동의 표시), `role-change-dialog.tsx`(`TeacherScopeDialog` 추가), `member-create-dialog.tsx`, `class-card.tsx`, `class-controls.tsx`(`ClassRetentionCard`), `praise-preset-manager.tsx`, `src/app/admin/(dashboard)/{admin-overview.tsx, members/member-list.tsx, members/member-detail.tsx, community/community-moderation.tsx, posts/admin-post-list.tsx}`
- `src/lib/admin.ts`는 고치지 않음(필요 없었음). 묶음 3 파일(`use-session.tsx`·`privacy.ts`·`privacy-policy.ts`)은 건드리지 않음.
- 덤: `member-create-dialog.tsx`의 기존 [서식 내려받기 (.xlsx)] 단추에 `nativeButton={false}`(개발 모드 Base UI 경고가 콘솔에 나던 것 — 동작 변화 없음).

## 3. 계약(이름표)과 맞춘 것 · 다르게 한 곳

- RPC·함수 이름·인자는 spec 4.2 그대로. 묶음 1 SQL ①·묶음 2 `admin-clear-students`와 대조함: 미리보기 `students`는 탈퇴 처리된 학생 포함, `{userId, confirmName}`의 이름 = `display_name`(앞뒤 공백 뺌, 없으면 로그인 아이디) — 화면의 `memberRealName`과 같다.
- **`admin_class_retention_status` — 메인 에이전트가 개정 3 규칙으로 고친다(조정자 안내: 지난 학년도 = 3월 1일부터 기한 지남, 2월에는 이번 학년도 학생 = 정리할 학생, 기존 `due_total`·`overdue_total` 유지).** 화면은 SQL ① 모양을 그대로 읽는다:
  - 2월인지: 응답의 `today`(예 `2027-02-10`)의 달 — 없으면 기기의 한국 시간. (`february`·`in_february`·`february_notice`가 참이어도 2월로 봄.)
  - 기한 지남(학급마다): `overdue_students`가 있으면 그 값, 없으면 `past_deadline`이 참일 때 `old_students`.
  - 2월 알림(학급마다, 2월일 때만): `february_students`·`due_students`·`current_students` 중 있는 값, 없으면 `past_deadline`이 거짓일 때 `old_students`(그 학급 `overdue_students`는 뺌).
  - 합계는 학급 값의 합(학급이 있어야 [학급 정리 열기]를 붙인다). `overdue_total`이 더 크면 그 값. `due_total`은 읽지 않는다 — 학급별 값이 없으면 단추를 만들 수 없어서다.
  - **필요한 필드**: 2월에 "지난 학년도(기한 지남) 학생"과 "이번 학년도(2월 28일까지) 학생"이 **한 학급에 함께** 있으면 학급마다 둘을 나눈 값이 필요하다 — SQL이 `old_students` 하나만 주면 2월에는 모두 '2월 알림'으로 센다. 함께 있을 수 있게 하려면 학급마다 `overdue_students`(기한 지남 수)를 더해 주세요(화면은 이미 읽음). 시험: SQL ① 모양 그대로(2월·3월)와 `overdue_students`가 있는 경우 모두 통과.
- 학급 정리 확인 창에 spec 4.7-3의 "'되돌릴 수 없음' 체크"는 넣지 않았다 — 8-4 원문에 없고 지침이 "학급 이름 입력 확인·미리보기 인원수"로 정했다(원문의 "**되돌릴 수 없어요.**"는 빨간 줄로 보임).
- 문의 이메일: SQL은 빈 값이면 지우지만, 화면은 빈 값을 "이메일 주소 모양이 아니에요."로 막는다(② 뒤 처리방침에 문의처가 비지 않게 — 원문에 지울 때 문구가 없음).

## 4. 원문에 없던 새 문장 (전부, 글자 그대로)

`PRIVACY_ADMIN_EXTRA_TEXT`(20개):
1. `개인정보 기능 준비 전 · ` (머리, 아래 2번 앞에 붙음)
2. `개인정보 기능용 DB 설정이 아직 적용되지 않았습니다. Supabase SQL Editor에서 20261020000000_privacy_a_schema.sql을 실행해 주세요.`
3. `총괄 선생님만 쓸 수 있는 화면이에요.`
4. `개인정보 설정을 불러오지 못했습니다.`
5. `학생 수를 불러오지 못했습니다.`
6. `{이름} 학생의 계정과 기록을 지웠어요.` (기록까지 삭제 뒤 알림)
7. `기록했어요.` (동의 기록 뒤 알림)
8. `{n}명을 기록했어요.` (학급 일괄 기록 뒤 알림)
9. `{별명} 선생님에게 모든 권한을 줬어요.`
10. `{별명} 선생님의 권한을 자기 학급 일만 하도록 줄였어요.`
11. `{칸} {n}번째 자리` (코드 칸 화면 읽기 이름 — 예: "새 코드 1번째 자리")
12. `학급 정리 기능이 아직 준비되지 않았습니다. Supabase에 Edge Function(admin-clear-students)을 배포해 주세요.`
13. `학급 정리 기능에 연결하지 못했습니다. 인터넷 연결을 확인하고, Supabase에 Edge Function(admin-clear-students)이 배포되어 있는지 확인해 주세요.`
14. `지우지 못했습니다. 잠시 후 다시 시도해 주세요.` (상태 코드를 모르면 뒤에 ` (HTTP {코드})`)
15. `로그인이 만료되었습니다. 다시 로그인해 주세요.` (기존 사이트 문장 재사용)
16. `저장하지 못했습니다. 잠시 후 다시 시도해 주세요.` (기존 사이트 문장 재사용)
17. `함께 쓰는 칭찬 문구는 모든 권한이 있는 선생님만 고칠 수 있어요.`
18. `학습게임 관리와 학습게임 신고 처리는 모든 권한이 있는 선생님만 할 수 있어요.`
19. `블로그 글쓰기는 모든 권한이 있는 선생님만 할 수 있어요.`
20. `{n}명` (일괄 줄 `{학급 이름} · 기록 없음 {n}명`의 끝)

그 밖(원문 조각·기존 문장의 조합):
- 카드 목록의 이름표 `보호자 동의:`(원문 열 이름 + 쌍점), 일괄 줄 `{학급 이름} · 기록 없음 {n}명`.
- 기존 사이트 문장·단추 재사용: `서버 응답이 올바르지 않습니다. Edge Function 코드가 최신인지 확인해 주세요.`, `다시 시도`, `닫기`(학급 정리가 끝난 뒤 [취소] 자리), `이름 없는 학급`.
- 화면 읽기 이름(aria-label): `{학급 이름} — 이 학급 모두 동의서 받음으로 기록`, `{학급 이름} 학급 정리`, `{학급 이름} 학급 정리 열기`, `{이름} 동의서 받음으로 기록`·`모든 권한 주기`·`내 학급 일만으로 줄이기`·`기록까지 삭제`.
- 내려받는 파일 이름 `보호자-동의서-양식.hwpx`.
- 확인 창 제목은 원문의 단추 이름을 썼다(`동의서 받음으로 기록`, `이 학급 모두 동의서 받음으로 기록`, `모든 권한 주기`, `내 학급 일만으로 줄이기`).

표기 처리: 원문의 `**굵게**`는 굵게, `{자리}`는 채움, 문장 속 `[단추 이름]`은 그 단추가 그 자리에 없을 때 대괄호째 보인다("다시 [학급 정리하기]를 눌러 주세요."). 회원 추가 도움말의 [보호자 동의서 양식 내려받기(한글 파일)]만 그 자리의 링크라 대괄호 없이 링크로 그린다. 확인 창 문장을 감싼 원문의 따옴표·굵게는 문서 표기라 빼고 보통 글로 보인다. `{새 가입 / 이전 가입}` 자리는 상수에서 `{가입 종류}`로 이름만 바꿨다(채우는 값은 원문 두 낱말).

## 5. 시험 결과

- `npx tsc --noEmit -p tsconfig.json` 오류 0, `npm run lint` 오류·경고 0(마지막 실행 — 다른 묶음 파일 포함 전체).
- 화면 시험(가짜 세션·가짜 응답, 실제 Supabase 주소는 첫 로드부터 가로챔 — 모든 요청이 Fetch 가로채기로 응답됨, 콘솔 오류 0): **178개 확인 모두 통과**
  - 개인정보 설정(총괄) 24: 6자리 아니면 오류·RPC 없음, 두 칸 다르면 오류, 붙여 넣기, 적으면 다음 칸·지우면 앞 칸, `p_code = 000000` 전송 뒤 칸 비움, 상태 "설정됨 (바꾼 날 …)", 이메일 모양 오류·전송 값, 현황 4줄, 기한 카드(개정 3 문구), 390 가로 넘침 0
  - 회원 목록(총괄, 1440 표) 39: 배지 4종과 설명 글, 보호자 동의 열·설명("부엉이 선생님이 표시했어요."), 일괄 줄 수, 권한 넓히기 확인 문구·RPC 인자·배지 바뀜, 줄이기 메뉴, 본인·인증 전·다른 학급 학생의 메뉴 차이, 동의 기록·일괄 기록 확인 문구·RPC, 기록까지 삭제(이름 불일치 꺼짐·위험 단추 흰 글자·함수 인자·행 빠짐), 1440에서 표가 상자 안
  - 카드 목록 1024·390: 10 / 회원 추가 17(체크 안 하면 안내·호출 없음·초점, Space로 체크, `guardianConsent: true`, 교사 줄은 안 보냄, 엑셀 체크, 양식 링크·파일 200, 390 체크 줄 높이 48px) / 학급 정리 16(이름 불일치 꺼짐, 3번 부르고 멈춤·"2명을 지우지 못했어요", 다시 눌러 "학생 25명" 완료, 학생 0 꺼짐, 미배포 안내, 390) / 역할별 22(담임: 메뉴·`/admin/privacy/` 안내·flags 호출 없음·자기 학생 메뉴 / 학급 선생님: 커뮤니티·블로그·칭찬 문구 숨김과 안내, 학급 일 그대로 / 총괄: 편집 그대로) / 키보드·SQL ① 전 13(메뉴 Enter·화살표, 확인 창 초점·초점 표시·Esc, 코드 칸 이름표·legend / 준비 전 한 줄, 목록·개요 그대로, `teacher_scope` 없으면 모든 권한) / 회원 상세 13 / 다크·밝음 대비 8(배지 4.5:1 이상 — 인증 전 11.8·13.5, 30일 넘음 5.1·5.5) / 2월 알림·기한 16(SQL ① 모양 + `today` 2월 → 2월 알림만, 3월 → 기한 지남만, 2월 + `overdue_students` → 둘 다, 이름이 분명한 2월 필드 — 담임 1024·총괄 390)
- **원문 대조(기계적)**: `privacy-admin-text.ts`의 8절 상수 **94/94개가 `privacy-policy.md` 8절(개정 3)에 글자 그대로 있음**(`network` 한 줄은 4절). 역방향(8절 71줄 → 상수): 상수에 그대로 없는 조각이 있는 20줄은 모두 표 머리·상태 이름("동의서를 받았다고 표시함")·색 표기("(노란 표)")·"확인 창:"·" / " 같은 문서 표기 줄이며, 그 줄의 화면 문장은 모두 상수에 있음(눈으로 확인).
- 사진(`…/scratchpad/privacy-b4/showcase/`, 17장): `privacy-settings-1024/390`, `members-table-1440`, `members-cards-1024/390`, `member-create-consent-required-1024`·`-checked-1024`·`-390`, `member-create-file-consent-1024`, `member-erase-dialog-1440`, `member-detail-pending-1024`·`member-detail-student-1024`, `class-cleanup-dialog-1024/390`, `class-cleanup-partial-1024`, `overview-retention-1024`, `overview-february-1024/390`, `class-teacher-community-1024`. 왼쪽 아래 동그란 'N'은 개발 서버 표시(배포에 없음). 시험 스크립트도 같은 폴더(`t*.mjs`, `cdp.mjs`·`mock-data.mjs`).

## 6. 확인하지 못한 것

- 실제 Supabase(SQL ①~③ 실행 뒤의 RPC 응답·권한 거부 문구), 실제 `admin-clear-students`·`admin-create-member` 배포본 — 모두 가짜 응답으로만 봤다(모양은 묶음 1·2 코드와 대조).
- 개정 3으로 고친 `admin_class_retention_status`(메인 에이전트 작업 — 아직 보지 못함). 화면은 3절의 이름으로 읽는다. 지금(고치기 전) SQL과 붙이면 기한 지남은 4월부터만 보이고, 2월에는 `today`가 2월이라 `old_students`(그때는 지난 학년도 학생)가 '2월 알림'으로 보인다.
- 실제 iPad·Safari, 실제 화면 읽기 프로그램, `guardian-consent.hwpx` 파일 내용(메인 에이전트 파일 — 링크와 200만 확인).
- 1280 화면(사이드바 펼침)에서 총괄 회원 표: '교사 · 내 학급 일만' 배지가 있으면 표가 상자보다 12px 넓어 옆으로 밀린다(작업 칸은 붙박이라 보임). 보호자 동의 칸을 넣으면서 가입 방식(1024px 미만 목록)·가입일(896px 미만 목록) 칸을 표에서 숨겼다 — 카드·상세에는 그대로.

## 7. 다른 묶음·메인 에이전트에게

- **메인(SQL)**: `admin_class_retention_status`를 고칠 때 응답에 `today`·`past_deadline`·학급별 `old_students`를 그대로 두고, 2월에 두 학년도 학생이 한 학급에 함께 있을 수 있으면 학급별 `overdue_students`를 더해 주세요(3절). `past_deadline`은 "지난 학년도 학생이 기한 지남"일 때 참(3월 1일부터 다음 해 1월까지), 2월에는 거짓이면 화면이 `old_students`를 2월 알림으로 센다.
- `public/templates/guardian-consent.hwpx`는 건드리지 않았다(링크·200만 확인). 학생 아이디·이름 가리기(담임 외)는 이번에 하지 않았다(조정자 안내 — 다음 작업).
- **메인**: "자기 학급 일만" 선생님이 주소로 바로 여는 `/admin/write/`(편집기 — 대시보드 공급자 밖)와 공개 글 화면의 수정 링크(`post-card.tsx`의 `editPostHref`)는 고치지 않았다(지침 범위 밖, 저장은 서버가 거부). 필요하면 안내 한 줄을 더할 것.
- **메인**: 총괄이 남의 학급을 정리하는 길은 기한 카드의 [학급 정리 열기]뿐이다(기한이 지나거나 2월일 때). 기한 전에 다른 학급을 정리할 화면이 필요하면 회원 목록 학급 고르기 옆 등에 단추를 더할 수 있다.
- **묶음 3**: 8-6(회원 탈퇴) 글도 `PRIVACY_ADMIN_TEXT.selfWithdraw`에 원문 그대로 있다(쓰지 않아도 됨).
- 띄운 Chrome(9482)은 끄고 프로필 폴더를 지웠다. 개발 서버는 건드리지 않았다.
