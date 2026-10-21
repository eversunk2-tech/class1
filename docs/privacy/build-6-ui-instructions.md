# 묶음 6 지침 — 화면: 학생 아이디·이름 가리기 + 처리방침 글 다시 맞추기 (구현 담당 F, 2026-10-20)

먼저 `docs/privacy/build-common.md`를 읽는다. Chrome 포트 **9483**, 스크래치 `privacy-b6/`. 개발 서버 `http://localhost:3000/class1/`는 메인 에이전트가 띄워 둔다(`next dev`·`next build`를 직접 돌리지 않는다). 묶음 4의 시험 도구(`…/scratchpad/privacy-b4/`의 `cdp.mjs`·`mock-data.mjs`·`t*.mjs`)를 복사해 써도 된다(원본은 고치지 않음).

## 기준
- `docs/privacy/spec.md` **4.11(개정 4)** — RPC 이름·인자·돌려주는 모양이 계약이다(SQL은 묶음 5가 동시에 만든다 — 실제 DB에는 아직 없으므로 가짜 응답으로 시험).
  - `member_name_labels(p_ids uuid[])` → `[{ id, display_name, avatar_url, withdrawn_at, masked }]`
  - `admin_masked_member_rows(p_id uuid default null)` → 회원 명단 표 줄과 같은 모양 + `masked: true`(총괄이 아니면 `[]`)
  - 가린 이름 = 원래 이름(`display_name`, 비었으면 아이디)의 첫 글자 + `***`.
- `docs/privacy/privacy-policy.md` — **개정 3·4가 반영된 원문**. 1~8절 문장은 글자 그대로.

## 만들·고칠 파일
- 신규 `src/lib/member-labels.ts` — `member_name_labels` 래퍼(100개씩, RPC가 없거나(`isMissingSchemaError`) 실패하면 빈 결과로 — 화면을 절대 막지 않음, 콘솔 오류만) + embed `profiles`가 `null`인 작성자에게 `{ display_name: 가린 값, avatar_url: null, withdrawn_at }`를 채우는 공용 함수. **로그인한 사람에게만** 부른다(로그아웃은 지금처럼 '회원').
- 작성자 이름이 보이는 곳에 적용: `src/lib/community.ts`(자유게시판·학습게임 목록·글·댓글·홈 미리보기를 불러오는 함수들), `src/components/comment-section.tsx`(블로그 댓글), `src/app/admin/(dashboard)/community/community-moderation.tsx`(신고 관리·게시글 관리의 글쓴이·신고한 사람). `src/` 전체에서 `profiles(`·`profiles!` embed와 `from("profiles")`를 다시 찾아, **다른 학급 학생이 섞일 수 있는 곳**은 모두 적용하고, 같은 학급만 나오는 곳(학습 현황·학생 응답·피드백 등 — 담임 RLS)은 이유와 함께 보고서 표에 적는다.
- 회원 명단: `src/lib/admin.ts`의 `fetchMembers`·`fetchRecentMembers`·`fetchMember`가 표 읽기에 `admin_masked_member_rows`를 합친다(같은 id면 **표 줄이 이김** — ② 전에는 표에 모든 줄이 있어 겹친다, RPC가 없으면 표만). `src/lib/types.ts`의 `MemberRow`에 `masked?: boolean`.
- `member-list.tsx`·`member-detail.tsx`·`admin-overview.tsx`·`member-badges.tsx`(필요한 만큼): 가린 줄은 아이디·이름이 가린 값, 사진 없음. 메뉴는 **비밀번호 초기화·탈퇴 처리·기록까지 삭제만**(사용자 결정 — 총괄도 계속 함). 교사 지정·권한 넓히기/줄이기·동의서 기록 등 나머지는 가린 줄에서 숨긴다. 탈퇴 처리·기록까지 삭제의 이름 확인 입력은 **보이는 대로**(`2***`) — `memberRealName` 등이 가린 값을 돌려주는지 확인. 학급별 일괄 동의 기록 줄·인원 수에 가린 줄이 섞이지 않게(일괄 기록은 담임만). 총괄 화면에 가린 줄이 있으면 목록 위에 원문 8-8 안내 한 줄. `admin_set_role` 오류 "다른 학급 학생은 교사로 지정할 수 없어요."는 서버 문구를 그대로 보인다. 탈퇴 정보(`fetchWithdrawalInfo`)가 가린 줄에서 비어도 화면이 깨지지 않게.
- `src/data/privacy-policy.ts` — **원문과 다시 맞춘다**: 개정 3(보유 기한 "종업식 뒤 그 학년도의 2월 28일까지" — 지금 상수에 "3월 31일"이 4곳 남음)과 개정 4(제2조 다, 제7조, 쉬운 설명 '누가 볼 수 있어요?'). 원문 1~6절 문장과 상수를 **기계적으로 대조**(양방향)해 차이가 0이 되게 하고, 결과 숫자를 보고서에.
- `src/data/privacy-admin-text.ts` — 원문 8-8 두 문장 추가(8절 대조도 다시).
- 보고서 `docs/privacy/build-6-report.md`.
- **고치지 않는 것**: SQL·Edge Function(묶음 5), `public/` 파일.

## 시험 (가짜 응답, build-common 방식 — 실제 Supabase는 첫 로드부터 막음)
- 학생 A(1반)로 로그인: 자유게시판(같은 반 B의 글 — embed에 이름 있음 → 온전), 학습게임(2반 C의 글 — embed `null` → `member_name_labels` 가짜 응답 → `C***` 꼴), 댓글, 홈 미리보기. 로그아웃: 모두 '회원'이고 `member_name_labels`를 부르지 않음.
- RPC가 없을 때(가짜 404/`PGRST202`): 화면이 그대로 뜨고 이름은 지금처럼 폴백.
- 총괄: 회원 명단(표 줄 + 가린 줄, 겹친 id는 한 번만, 안내 한 줄, 가린 줄 메뉴 3개만, 탈퇴·기록까지 삭제 확인 입력 `2***`로 단추 켜짐), 회원 상세(가린 줄을 주소로 열기), 개요 '최근 가입', 신고 관리의 가린 글쓴이. 담임: 가린 줄 없음·지금과 같음.
- 1024×768·390×844, 키보드, `npx tsc --noEmit -p tsconfig.json`·`npm run lint` 0.
- 사진(showcase): 학습게임 목록의 가린 이름(학생), 총괄 회원 명단 가린 줄과 안내, 가린 줄 메뉴, 기록까지 삭제 확인 창(가린 이름), 처리방침 화면의 바뀐 절(제7조·쉬운 설명).
