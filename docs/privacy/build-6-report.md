# 묶음 6 보고 — 화면: 학생 아이디·별명 가리기 + 처리방침 글 다시 맞추기 (구현 담당 F, 2026-10-20)

> 지침: `build-common.md` → `build-6-ui-instructions.md`. 기준: `spec.md` 머리말 개정 4·4.11(+4.10), `privacy-policy.md`(개정 3·4 — 작업 중 메인 에이전트 알림으로 '이름(별명)' → '별명' 바뀐 문장까지 다시 읽어 맞춤).
> git commit/push·실 DB 읽기/쓰기·내려받기·설치 없음. `supabase/`·`public/`은 건드리지 않음. 시험은 전용 headless Chrome(포트 9483) + 가짜 Supabase(첫 로드부터 막음)만. 개발 서버는 메인 에이전트 것(직접 띄우지 않음).

## 1. 고친 파일

| 파일 | 한 일 |
|---|---|
| 신규 `src/lib/member-labels.ts` | `fetchMemberNameLabels(ids)` — `member_name_labels({ p_ids })` 100개씩, **로그인 세션이 있을 때만**(로그아웃은 요청 0), RPC가 없으면(`isMissingSchemaError`) 조용히·그 밖의 실패는 콘솔 오류만 남기고 빈 결과(예외를 던지지 않음). `fillMemberLabels(rows, slots)` — embed가 `null`인 작성자 자리만 `{ display_name, avatar_url(가린 이름이면 null), withdrawn_at }`로 채운 새 배열(채울 자리가 없으면 RPC 안 부름). `fillProfiles(rows, idOf)` — 흔한 `profiles` 모양용 |
| `src/lib/community.ts` | `fetchCommunityPosts`(자유게시판·학습게임 목록·홈 미리보기)·`fetchCommunityPost`(글 상세)에 채우기, 새 `withAuthorLabels`(검색도 씀)·`fetchCommunityComments`(댓글) |
| `src/components/community/community-comment-section.tsx` | 댓글 읽기를 `fetchCommunityComments`로(한 줄) |
| `src/app/search/search-view.tsx` | 검색 결과 카드(글쓴이가 보임)에 `withAuthorLabels` |
| `src/components/comment-section.tsx` | 블로그 댓글에 `fillProfiles` |
| `src/app/admin/(dashboard)/community/community-moderation.tsx` | 신고(신고한 사람·대상 글쓴이)·글 관리(글쓴이)에 채우기. select에 기존 열 `reporter_id`·`target_author_id`·`author_id`를 더함 |
| `src/lib/types.ts` | `MemberRow.masked?: boolean`, `MemberRow.masked_consent?`(가린 줄의 보호자 동의 표시 — RPC 값) |
| `src/lib/admin.ts` | `fetchMaskedMemberRows(id?)`(`admin_masked_member_rows({})` / `({ p_id })`, 없거나 실패하면 `[]`), `fetchMembers`·`fetchRecentMembers`·`fetchMember`가 표 줄 + 가린 줄을 합침(**같은 id면 표 줄**, 가입일 최근 순·id 순으로 다시 줄 세움, `fetchMember`는 표에 없을 때만 RPC). 비밀번호 변경 대기 표시(`withFlags`)는 표 줄에만 — 가린 줄은 RPC의 `must_change_password`. 가린 줄 동의 표시를 한 선생님 이름은 `profiles`에서 한 번 더 읽음(선생님 별명 — 못 읽으면 이름 없이) |
| `src/app/admin/(dashboard)/members/member-list.tsx` | 가린 줄: 메뉴 = 비밀번호 초기화·탈퇴 처리·기록까지 삭제만(담임교사 지정·권한 넓히기/줄이기·동의 기록 숨김), 동의 열은 RPC 값, 학급별 일괄 동의 줄·인원에서 제외, 가린 줄이 있으면 목록 위에 8-8 안내 한 줄(`role="note"`) |
| `src/app/admin/(dashboard)/members/member-detail.tsx` | 가린 줄을 주소로 열면: 같은 안내 한 줄, 담임교사 지정 단추·동의 기록·권한 메뉴 없음, 동의 표시 = RPC 값, 탈퇴한 가린 줄은 감사 기록(`member_withdrawal_log`)을 부르지 않음(읽을 수 없음 — 탈퇴 시각만) |
| `src/data/privacy-policy.ts` | 원문과 다시 맞춤(아래 4절): 1절 표 보관 기한, 제2조 다 세 줄, 제3조 학생 줄, 제7조 세 줄, 쉬운 설명 '누가 볼 수 있어요?'(5줄)·'얼마나 오래 보관해요?', **7절 `GUARDIAN_CONSENT_FORM`을 개정 3 최종 양식 글로 새로 씀**(옛 가정통신문판 삭제 — 화면에서 쓰는 곳 없음) |
| `src/data/privacy-admin-text.ts` | 8-8 두 문장 `PRIVACY_ADMIN_TEXT.maskedRows.notice`·`.roleRejected` |

`admin-overview.tsx`·`member-badges.tsx`는 고칠 것이 없었다(최근 가입은 `fetchRecentMembers`가 합쳐 주고, 사진은 `avatar_url`이 null이라 첫 글자). 탈퇴·기록까지 삭제의 이름 확인은 `memberRealName`이 가린 값(`구***`)을 돌려주어 그대로 맞는다. `admin_set_role`의 거부 문구는 `setMemberRole`이 서버의 한국어 문구를 그대로 보인다(기존 코드).

## 2. `profiles` 붙이기·읽기 전수(`src/` — `profiles(`·`profiles!`·`from("profiles")`)

| 위치 | 누구의 이름 | 다른 학급 학생이 섞이나 | 처리 |
|---|---|---|---|
| `lib/community.ts` POST_AUTHOR — 목록·홈 미리보기·글 상세·글 고치기 | 글쓴이 | **예**(학습게임은 모든 학급, 자유게시판은 총괄의 관리용 보기·반을 옮긴 학생의 예전 글) | `withAuthorLabels` |
| `lib/community.ts` COMMENT_AUTHOR — 댓글 | 댓글쓴이 | **예** | `fetchCommunityComments` |
| `app/search/search-view.tsx` — 검색 결과(`CommunityPostCard`가 글쓴이를 보임 — spec 4.10 표의 "보여 주지 않음"과 다름) | 글쓴이 | **예** | `withAuthorLabels` |
| `components/comment-section.tsx` — 블로그 댓글 | 댓글쓴이 | **예**(로그인한 회원 누구나 댓글) | `fillProfiles` |
| `community-moderation.tsx` 신고(`profiles!…reporter_id`·`target_author:profiles!…`)·글 관리(`profiles!…author_id`) | 신고자·글쓴이 | **예**(총괄 = 모든 게시판·학습게임, 담임 = 학습게임) | `fillMemberLabels` |
| 댓글 등록·고치기 응답(`insert/update…select(COMMENT_COLUMNS)`) | 본인 | 아니요 | 없음 |
| `lib/types.ts` MEMBER_ROW_COLUMNS(`member_directory → profiles`) — 회원 명단·상세·최근 가입 | 학생·교사 | ② 뒤 총괄의 표에는 다른 학급 학생 줄이 없음 | `admin_masked_member_rows` 합치기 |
| `lib/learning.ts` app_results(`fetchAppResultsWithStudents`·`fetchRecentActivity`·`fetchAllAppResults`), 과제 제출(`fetchRecentActivity`), 피드백 메시지(`fetchFeedbackMessages`·`sendFeedbackMessage`), 피드백 스레드, `fetchStudents`(`profiles!inner`, 학급으로 거름) | 학생·보낸 사람 | 아니요 — 학습 기록 RLS가 본인·그 학급 담임(`teaches_student`)만. 보낸 사람은 교사 또는 그 학생. 담임은 `can_see_member_name`이 참 | 없음 |
| `lib/learning.ts` `fetchStudentEngagement`(`from("profiles")`) | 학생 | 화면이 명단(내 학급)으로 거르고, ③ 뒤 다른 학급 학생 행은 오지 않음 | 없음 |
| `lib/learning.ts` `fetchProfileNames`(과제 만든 사람), `lib/admin-privacy.ts` 동의 표시한 사람, `lib/admin.ts` 탈퇴 처리자·잠금 스위치 바꾼 사람·(새)가린 줄 동의 표시한 사람 | 교사 | 아니요(선생님 별명은 모든 회원에게) | 없음 |
| `community-moderation.tsx` 교사 목록(`role=eq.admin`)·게시판 주인 이름, `community-post-detail.tsx` `useBoardOwnerName` | 교사·옛 게시판 주인 | 아니요(담임 해제된 옛 주인은 학급 없는 계정 → 총괄이 봄 — 이 이름이 필요한 화면도 총괄의 관리용 보기) | 없음 |
| `hooks/use-session.tsx`·`components/profile-dialog.tsx` | 본인 | 아니요 | 없음 |

## 3. 계약(이름표)과 맞춘 것·알릴 것

- RPC 이름·인자·모양은 spec 4.11 그대로: `member_name_labels({ p_ids: uuid[] })` → `[{ id, display_name, avatar_url, withdrawn_at, masked }]`, `admin_masked_member_rows({})`·`({ p_id })` → 회원 줄 + `masked: true` + `guardian_consent_at/by`. 끝날 무렵 묶음 5의 `20261020000000_privacy_a_schema.sql`(11-6·11-7)과 대조함 — 열 이름·모양 같음, 별명이 빈 계정은 서버도 `privacy_name_source`(별명, 비었으면 아이디)로 가린다.
- 화면 쪽 안전장치: 가린 줄의 별명이 비었거나 `***`면 가린 아이디(`2***`)로 보인다 — '기록까지 삭제' 이름 확인이 "원래 이름(비었으면 아이디)의 첫 글자 + ***"와 비교하기 때문. 묶음 5 SQL과 같은 결과라 지금은 겉으로 차이가 없다.
- `MemberRow`에 `masked` 말고 `masked_consent`(가린 줄의 동의 표시)도 더했다 — 가린 줄은 ② 뒤 총괄이 `member_directory`의 동의 열을 읽지 못하므로 RPC 값을 쓴다.
- `admin_masked_member_rows`가 함수 없음이 아닌 이유로 실패해도 회원 목록은 오류 화면이 아니라 **표 줄만** 보인다(콘솔 오류만) — 담임의 명단이 이 RPC 때문에 막히지 않게 고른 것. 총괄은 그때 다른 학급 학생 줄이 빠진 채 보일 수 있다.
- 신고·글 관리 select에 기존 열 `reporter_id`·`target_author_id`·`author_id`를 더했다(`20260922040000`부터 있는 열, `community_reports`는 표 전체 select 권한).
- 7절 `GUARDIAN_CONSENT_FORM` 상수 모양이 바뀌었다(새 양식: 제목·인사·안내·유의점 표·절취선·동의서 표·날짜 줄). 쓰는 곳이 없어 화면 영향 없음.

## 4. 원문 대조(기계적)

- `privacy-policy.ts` ↔ 원문 1~7절 + 8-6절(스크래치 `privacy-b6/check-policy.mjs` — 묶음 3 `check-text.mjs`를 복사해 7절 표 칸의 `<br>`만 줄 단위로 나눔): 원문 화면 단위 **295개 → TS에 빠진 것 0**, TS 문자열 **304개 → 원문에 없는 것 0**(1개는 4-1절 끝 `>` 메모 줄의 알림 — 묶음 3과 같음), 〔확인 필요〕 0. 더한 **엄격 역방향**(`**`·`` ` `` 표기까지 그대로, TS → 원문): **0개**. 검사가 실제로 잡는지 확인하려고 두 곳을 일부러 바꾼 사본으로 돌려 정방향 2·역방향 2를 잡는 것을 봄. `src/`에 "3월 31일" 0곳.
- `privacy-admin-text.ts` ↔ 원문 8절(`privacy-b6/check-admin.mjs` — 묶음 4 것을 복사): 상수 **96/96**이 원문 8절(network는 4절)에 글자 그대로. 역방향(원문 8절 73줄 → 상수): 상수에 그대로 없는 조각이 있는 줄 20개 — 묶음 4와 같은 문서 표기 줄(표 머리·"(노란 표)"·"확인 창:" 등), 8-8 두 줄은 원문과 같음.
- 메인 에이전트 알림(개정 4의 '이름(별명)' → '별명')을 받은 뒤 원문을 다시 읽어 옮겼고, 마지막에 두 검사를 다시 돌려 위 숫자를 얻었다.

## 5. 원문에 없던 새 문장

**없음.** 화면에 보이는 글은 모두 원문(8-8 두 문장 포함)이다. 원문 8-8의 목록 위 안내 문장을 **회원 상세(가린 줄)에도** 같은 글로 한 줄 보인다(자리만 하나 더). 콘솔(개발자용) 글: `[member-labels] member_name_labels 실패:`, `[admin] admin_masked_member_rows 실패:`(오류 코드·문구만, 이름·id 없음).

## 6. 시험 (가짜 응답 — `*.supabase.co`는 resolver에서 막고 CDP Fetch가 답함, 캐시 끔)

- `npx tsc --noEmit -p tsconfig.json` 오류 0, `npm run lint` 오류·경고 0(저장소 전체).
- 화면 시험 **158개 모두 통과**(스크래치 `privacy-b6/t*.mjs`, `node t1-student.mjs 1024` 꼴):
  - t1 학생 A(1반) 1024·390 각 16: 학습게임 목록 2반 학생 글 = `구***`, 같은 반 = 온전(바다), 선생님 = 온전, 탈퇴한 2반 학생 = "탈퇴한 학생", `member_name_labels` 1번·embed가 null인 C·D만·id는 본문으로만, 글 상세·댓글(C=`구***`, B·A 온전, 사진 자리 '구'), 자유게시판(같은 반만 — RPC 안 부름), 홈 미리보기, 블로그 댓글, 검색, 가로 넘침 0, 콘솔 오류 0
  - t2 10: 로그아웃 — 학습게임·댓글·블로그 댓글 모두 '회원', `member_name_labels` 요청 0 / RPC 없음(PGRST202) — 목록·상세·댓글이 그대로 뜨고 가릴 이름은 '회원', 우리 코드의 콘솔 오류 0
  - t3 총괄 회원 명단 1440(표)·1024·390(카드) 각 23: 8-8 안내(`role=note`), C 가린 줄(`구***`·`2***`·참새반·동의서 확인 + "느티나무 선생님이 표시했어요."), 탈퇴한 D = "탈퇴한 학생"·`2***`, 별명 빈 E = `2***`, 같은 반 A·B 온전, 다른 학급 실명·아이디가 화면 어디에도 없음, id 겹침 없음, 사진 없음, 가린 줄 메뉴 3개(바다 줄은 그대로), 키보드(Enter로 메뉴 → 화살표 → Enter → 확인 창에 초점), 기록까지 삭제 확인: 실명 입력은 꺼짐·`구***`면 켜짐 → `{ userId: C, confirmName: "구***" }`, 탈퇴 처리 확인 `2***`로 켜짐
  - t4 24: 회원 상세(가린 줄을 주소로 — `p_id` 호출, 안내, 단추 3개만, 동의 = RPC 값, 담임만 안내), 탈퇴한 가린 줄(탈퇴 전 이름 `별***`·감사 기록 요청 없음), 개요 '최근 가입'에 가린 줄, 신고(대상 글쓴이 `구***`·신고자 `탈퇴한 학생(별***)`·같은 반 온전)·글 관리(`구***`), ② 전(표에 모든 줄 — 겹친 id는 표 줄 하나·안내 없음), RPC 없음(표 줄만·상세는 예전처럼 "찾을 수 없음"), 담임(2반: 자기 학생 온전·가린 값·안내 없음)
  - t5 1: ② 전 다른 학급 학생 '담임교사로 지정' → 서버 거부 "다른 학급 학생은 교사로 지정할 수 없어요."가 창에 그대로
  - t6 1024·390 각 10: `/privacy/` — 바뀐 문장(보유 기한·제2조 다·제7조 두 곳·쉬운 설명)이 보이고 옛 문장·"3월 31일" 없음, 가로 넘침 0
  - t7 2: 8-8 안내 글자 대비 밝음 5.49·어두움 7.66(AA)
- 사진(`…/scratchpad/privacy-b6/showcase/`): `01-games-list-student-1024/390`(학습게임 목록의 가린 이름), `02-game-detail-student-1024`, `03-super-members-masked-1440/1024/390`(총괄 명단 가린 줄과 안내), `04-masked-row-menu-1440`(메뉴 3개), `05-erase-dialog-masked-1440`(기록까지 삭제 확인 — `구***`), `06-member-detail-masked-1024`, `07-moderation-reports-1024`, `08-homeroom-members-1440`(담임 — 그대로), `09-privacy-easy-who-1024/390`(쉬운 설명 '누가 볼 수 있어요?'), `10-privacy-article7-1024/390`(제7조), `11-super-members-masked-dark-1440`. 왼쪽 아래 동그란 'N'은 개발 서버 표시(배포에 없음).
- 띄운 Chrome(9483)은 껐고 프로필 폴더를 지웠다.

## 7. 확인하지 못한 것

- 실제 SQL ①~③(묶음 5 판)·실제 RPC 응답·실제 로그인과 함께 동작하는 것 — 모두 가짜 응답(모양은 묶음 5 SQL 파일을 읽어 대조만).
- 실제 iPad Safari·화면 읽기 프로그램(`구***` 같은 가린 이름을 어떻게 읽는지 — "구 별표 별표 별표"일 수 있음), 실제 배포 빌드(`next build`는 지침대로 돌리지 않음).
- 학생 수가 많을 때(100명 넘는 학습게임 목록 등)의 RPC 나눠 부르기는 코드로만 확인(가짜 자료는 몇 명).

## 8. 메인 에이전트·사용자에게

1. 가린 줄의 보호자 동의 '기록 없음' 설명(원문 8-2: "…동의서를 받았다면 [동의서 받음으로 기록]을 눌러 주세요.")이 총괄에게도 보이지만, 가린 줄에는 그 메뉴가 없다(그 학생의 담임만 기록). 다른 학급 줄에서 예전부터 같았던 점 — 바꿀지 사용자 결정.
2. spec 4.10 표의 "검색 — 작성자 이름을 보여 주지 않음"은 사실과 달랐다(검색 카드가 글쓴이를 보임) — 이번에 가린 이름을 채웠다. spec 표를 고칠지 메인 에이전트 판단.
3. 원문 6절에 '**이름(별명)**'이 한 곳 남아 있다("여러분이 사이트에서 쓰는 **이름(별명)**…") — 원문 그대로 옮김(개정 4의 '별명' 통일 대상인지 사용자 확인).
4. 회원 관리 화면 위 학급 카드의 기존 안내("총괄 선생님은 모든 회원을 찾아 비밀번호 초기화·탈퇴 처리를 할 수 있지만…", `class-card.tsx` — 묶음 6 범위 밖)는 그대로 두었다. 가린 줄 안내와 함께 읽어도 어긋나지는 않는다.
