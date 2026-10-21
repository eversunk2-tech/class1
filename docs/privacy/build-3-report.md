# 묶음 3 보고서 — 공개 화면 (구현 담당 C, 2026-10-20)

지침: `build-common.md` → `build-3-public-ui-instructions.md`. 기준: `spec.md`(개정 1·2), 화면 글 원문 `privacy-policy.md`.
커밋·push·실 DB 읽기/쓰기 없음. 시험은 전용 headless Chrome(9481) + 가짜 Supabase(CDP Fetch)로만 했다.

## 1. 만든 것·고친 파일

| 파일 | 내용 |
|---|---|
| 신규 `src/data/privacy-policy.ts` | 원문 1~7절(1·2·3-1·3-2 창, 4절 짧은 글·4-1 확인 창, 5절 처리방침 전체, 6절 쉬운 설명, 7절 동의서 문안)과 **8-6절**(회원 탈퇴 — 공개 화면 사용자 메뉴에서 쓰므로 여기에도 둠) 상수. 원문 표기(`**굵게**`, `` `{자리}` ``, `[단추 이름]`)를 그대로 두고 화면이 그린다. import 없음(Node가 바로 읽어 대조). 7절은 화면에 그리지 않는다(쓰는 곳이 없어 빌드에서 빠짐 — 한글 파일은 메인 에이전트 몫). |
| 신규 `src/lib/privacy.ts` | `POLICY_VERSION = 1`, `POLICY_CHANGE_SUMMARY`(3-2 창 "바뀐 점" 한 줄 — 판 번호별, 지금 비어 있음), RPC 래퍼 `fetchMemberGate`(my_member_gate)·`verifyGoogleTeacher`·`acknowledgePrivacy`(결과 jsonb → 4절 문구), 별명 검사(SQL ① `privacy_nickname_error`와 같은 순서·목록), `selfDeleteMember`(Edge Function `member-self-delete`, `blocked` 처리), `localSignOut`, `fetchIsSuperAdmin`(my_admin_context의 is_super_admin), `fetchPrivacySettings`·`usePolicyEffective`·`formatEffectiveDate`, 원문 밖 화면 글 모음 `PRIVACY_EXTRA_TEXT`. RPC·열이 없으면(SQL ① 전) 창 없음·"준비 중"으로 떨어진다. |
| 신규 `src/app/privacy/page.tsx` + `privacy-view.tsx` | `/privacy/` — 쉬운 설명(`#easy`)이 맨 위, 아래 처리방침 전체. `site_settings`의 `contact_email`·`privacy_version`·`policy_effective_at`. 시행 전(값 없음·열 없음)이면 "개인정보 처리방침을 준비하고 있어요"만, 이메일이 없으면 그 자리에 "문의 이메일을 불러오지 못했어요." + [다시 불러오기], 설정을 못 읽으면 오류 + [다시 불러오기]. 시행일은 한국 날짜 "YYYY년 M월 D일". 표는 휴대폰에서 카드, 칸 5개 이상 표(제5조)는 늘 카드. `#easy`로 들어오면 글이 그려진 뒤 그 절로 옮기고 초점. |
| 신규 `src/components/privacy-gate.tsx` | `PrivacyGate`(레이아웃에 한 번) + 원문 그리기 `PolicyText`·`PolicyBlocks`·`PolicyTable`(처리방침 화면과 같이 씀). 창 4종: 1절 새 가입(need_code·new), 2절 기존 회원(need_code·existing — 인디스쿨 문장·[나중에 할게요(로그아웃)]·[가입하지 않기(계정 삭제)]), 3-1(need_ack·처음 — 별명), 3-2(need_ack·다시 — 별명 없음). Base UI Dialog(모달 — 초점 가둠, 바깥은 aria-hidden), 바깥 클릭·Esc 무시, 3-1·3-2만 [나중에]로 **이 탭에서만** 닫힘(저장 안 함 → 새로 고치면 다시). 체크·별명·코드 6자리가 모두 차야 제출 단추가 켜짐. 4-1 확인 창(AlertDialog) → `member-self-delete`(cancel) → 이 기기 로그아웃 → 홈 + 알림. `/privacy/`에서는 창을 띄우지 않음([개인정보 처리방침 전체 보기]가 새 탭으로 열리므로). 창이 떠 있던 중 세션이 끊기면 `/login/`으로. |
| 신규 `src/components/member-self-withdraw-dialog.tsx` | 8-6절 회원 탈퇴 창 + `useSelfWithdrawAvailable()`(구글 계정·role admin·SQL ① 있음·인증 전 아님·**총괄 아님이 확인될 때만**). "탈퇴합니다"를 그대로 적어야 [회원 탈퇴]가 켜짐. `blocked`면 학급 이름을 넣은 8-6 문장, 성공하면 이 기기 로그아웃 → 홈 + 알림. |
| `src/hooks/use-session.tsx` | `gate`·`refreshGate()` 추가. 로그인하면 `my_member_gate()`를 읽고(실패하면 이전 값 유지 + 잠시 뒤 다시), 창이 필요한 동안(또는 읽기 실패 중) `visibilitychange`·`focus`에서 다시 읽음(동시에 와도 한 번). 창이 풀리면 프로필도 다시 읽음. `displayNameOf`가 구글 계정의 이메일 앞부분을 쓰지 않게(아이디 계정만, 아니면 '사용자'). |
| `src/app/layout.tsx` | `<PrivacyGate />`를 `ForcePasswordChangeGate` 옆에. |
| `src/components/site-footer.tsx` | 시행 뒤에만 "개인정보 처리방침 · 친구들을 위한 쉬운 설명" 링크. 클라이언트 컴포넌트로 바뀜(연도 글자에 `suppressHydrationWarning`). |
| `src/app/login/login-form.tsx` | 시행 뒤에만: 구글 단추 아래 안내 한 줄 + 처리방침·쉬운 설명 링크. |
| `src/components/force-password-change-gate.tsx` | 허용 경로에 `/privacy/`. |
| `src/components/profile-dialog.tsx` | 구글 계정은 이메일 대신 "구글 계정으로 로그인 중이에요."(아이디 계정은 그대로 "아이디: …", 그 밖의 옛 계정은 예전처럼 이메일). |
| `src/components/user-menu.tsx` | 조건이 맞으면 맨 아래 '회원 탈퇴' 항목 + 창. |
| `src/lib/community.ts`(`authorName`), `src/components/comment-section.tsx` | 글쓴이 폴백 "익명" → **"회원"**. |

`src/components/login-gate.tsx`는 고치지 않음(`/privacy/`는 잠금 경로가 아님 — 잠금을 켠 가짜 설정에서도 열리는 것을 확인).

## 2. 계약(이름표)과 다르게 한 곳
- 이름은 모두 spec 4.2 그대로(`my_member_gate`·`verify_google_teacher(p_nickname, p_code, p_policy_version)`·`acknowledge_privacy(p_nickname, p_policy_version)`·`member-self-delete {mode}`·`my_admin_context`·`site_settings.contact_email/privacy_version/policy_effective_at`). 같은 작업 트리의 SQL ①(묶음 1)·`member-self-delete`(묶음 2)와 결과 모양을 대조함: `wrong_code`+`attempts_left 0`+`locked_seconds` → 잠금 문구, `acknowledge_privacy`의 `need_code`·`not_applicable` → 창 상태 다시 읽기, `bad_nickname`은 서버 `message`, 탈퇴 막힘은 200 `{ok:false, blocked:[…]}`·4xx 둘 다 처리.
- 별명 검사는 SQL ①을 따라 맞춤: 비었음 → 쓸 수 없는 글자(제어문자·`@`·`http`·`www.`, 대소문자 무시) → 2~20자 → 예약어 14개(대소문자 무시: 관리자·총괄·총괄 관리자·총괄관리자·운영자·사이트 운영자·psc·admin·administrator·인증 전 회원·탈퇴한 학생·탈퇴한 회원·회원·익명). spec 4.3-6의 "길이 → 글자" 순서와 다름(서버 순서를 따름).
- spec에 없는 것: 3-2 창의 `{바뀐 점 한 줄}`을 채울 곳이 DB에 없어 `src/lib/privacy.ts`의 `POLICY_CHANGE_SUMMARY[판 번호]`로 둠(없으면 그 줄을 숨김). 판 번호를 올릴 때 `POLICY_VERSION`과 이 한 줄을 함께 고쳐야 한다.

## 3. 원문(`privacy-policy.md` 1~7절)에 없는 화면 글 — 문장 그대로 전부
(모두 `src/lib/privacy.ts`의 `PRIVACY_EXTRA_TEXT` 한곳에 있다. ★ = 이번에 새로 쓴 문장)
1. `구글로 처음 오신 선생님은 교사 인증 코드가 필요해요.` — 로그인 화면 구글 단추 아래(spec 3.2의 문장, md에는 없음)
2. `개인정보 처리방침` · `친구들을 위한 쉬운 설명` — 바닥·로그인 화면 링크 이름(5·6절 제목에서)
3. `개인정보 처리방침을 준비하고 있어요` — 시행 전 `/privacy/`(md 5절 메모·9절 규칙)
4. `문의 이메일을 불러오지 못했어요.` · `다시 불러오기` — 문의 이메일이 없을 때(9절 규칙)
5. ★ `개인정보 처리방침을 불러오지 못했어요.` — `/privacy/`가 설정을 아예 읽지 못했을 때(+ [다시 불러오기])
6. ★ `개인정보 처리방침이 바뀌었어요. 화면을 새로 고쳐 주세요.` — 인증·확인 RPC가 `policy_changed`일 때(3-2 제목 + 4절 문장을 이음)
7. `구글 계정으로 로그인 중이에요.` — 프로필 수정 창(spec 4.4)
8. `회원` — 로그아웃 방문자에게 보이는 글쓴이(spec 4.10)
9. ★ `탈퇴했어요. 계정을 지웠어요.` — 회원 탈퇴를 마친 뒤 알림(4-1의 "가입하지 않았어요. 계정을 지웠어요."와 같은 모양)
10. `가입하지 않았어요. 계정을 지웠어요.` — [가입하지 않기] 뒤 알림. 원문 4-1절 끝의 `>` 메모 줄("지운 뒤 알림")에서 가져옴.

그 밖에 알아 둘 것
- 4절 `코드가 맞지 않아요. 다시 확인해 주세요. (남은 시도: {n}번)`는 서버가 남은 횟수를 주지 않으면 괄호 부분을 빼고 보인다(SQL ①은 늘 줌).
- 4절 `개인정보 안내를 읽고 확인해야 시작할 수 있어요.`는 다른 칸이 다 찼는데 체크만 안 했을 때 단추 아래 도움말로 보이고, 3-1·3-2(확인만 하는 창)에서도 같은 문장을 쓴다("시작할 수"가 어색하면 사용자 결정).
- 사용자 메뉴 항목 이름 `회원 탈퇴`는 8-6 제목. 창 닫기 단추의 화면 낭독용 "Close"는 기존 공용 Dialog 컴포넌트 그대로.
- 탈퇴·[가입하지 않기]가 서버에서 거부되면 Edge Function(묶음 2)이 보낸 한국어 `error` 문장을 그대로 보인다. 서버 연결 실패·알 수 없는 결과는 4절 `서버에 연결하지 못했어요. 잠시 뒤에 다시 해 주세요.`

## 4. 시험 결과
- `npx tsc --noEmit -p tsconfig.json`: 오류 0. `npm run lint`(저장소 전체, 다른 묶음 파일 포함): 문제 0(경고 0).
- **원문 대조**(스크래치 `privacy-b3/check-text.mjs` — md 1~7절 + 8-6절을 화면 단위(제목·문단·목록·표 칸·단추·링크)로 쪼개고, `privacy-policy.ts`의 모든 문자열과 양방향 비교, `**`·`` ` ``·공백만 정규화): 원문 단위 **298개 → TS에 빠진 것 0**, TS 문자열 **306개 → 원문에 없는 것 0**(1개는 위 10번 메모 줄), 〔확인 필요〕 0.
- 브라우저(가짜 세션·가짜 RPC, 실제 Supabase 요청 0 — 모든 `*.supabase.co`는 resolver에서 막고 CDP가 답함):
  - 새 구글(need_code·new): 창 뜸·제목에 초점, Esc·바깥 클릭에 안 닫힘, 체크·별명·6칸 모두 차야 단추 켜짐(빠진 것이 있으면 꺼짐 3가지 확인), 키보드만으로 별명 → 코드 → 체크(Space) → 단추, Tab 14번·Shift+Tab 3번 모두 창 안(바깥은 aria-hidden). 코드 칸은 숫자만(`00a0000000` → `000000` 꼴 — 숫자 아닌 글자를 버리고 앞 6자리), 붙여 넣기 됨.
  - 결과 8종: 틀린 코드(남은 4번·코드 칸 비우고 초점), 잠금(15분), 잠기는 순간(attempts_left 0+locked_seconds → 잠금 문구), busy, not_configured, policy_changed, bad_nickname, 알 수 없는 결과 — 모두 4절 문구. 처리 중에는 단추 모두 꺼짐·회전 표시. 성공 → 알림 "선생님으로 시작했어요. 환영해요!" → 프로필·창 상태 다시 읽어 창 닫힘. `already` → 알림 + 창 닫힘.
  - 코드는 RPC 요청 본문에만 있고 요청 주소에 없음(기록 확인), 화면 주소·저장소에 남지 않음.
  - 기존 구글(existing): 인디스쿨 문장, 단추 3개, [가입하지 않기(계정 삭제)] → 확인 창에 "이 계정이 남긴 글·댓글·좋아요도 함께 지워져요." → 서버 거부 문구 표시·[돌아가기] → 성공 시 `{mode:"cancel"}` 호출·세션 지움·홈·알림. [나중에 할게요(로그아웃)] → 로그아웃·홈, 다시 열면 창 다시 뜸.
  - 다른 탭에서 인증 마침: 창이 떠 있는 동안 `focus`+`visibilitychange` → my_member_gate 1번·프로필 1번 다시 읽고 창 닫힘. 창이 떠 있던 중 다른 탭 로그아웃(SIGNED_OUT 방송) → `/login/`.
  - 3-1(구글 관리자): 코드 칸 없음, [나중에] → 이 탭에서 닫힘·사이트 안 이동해도 닫힌 채·새로 고치면 다시, [확인했어요] → `{p_nickname:"부엉이쌤", p_policy_version:1}`·알림 "확인했어요."·닫힘. 3-2: 별명 칸 없음, 체크 전 단추 꺼짐·도움말, `{p_nickname:null, …}`.
  - 학생(아이디)·아이디 교사: 창 없음·메뉴에 '회원 탈퇴' 없음. SQL ① 전(RPC 404): 창 없음·'회원 탈퇴' 없음. 인증한 구글 선생님: '회원 탈퇴' 있음, 총괄: 없음.
  - 회원 탈퇴 창: "탈퇴합니다" 전 단추 꺼짐, 막힘(200·409 둘 다) → "아직 학생이 있는 학급이 있어요: 부엉이반, 참새반. …", 서버 거부 문구, 성공 → `{mode:"withdraw"}`·세션 지움·홈·알림.
  - 프로필 수정: 구글 → "구글 계정으로 로그인 중이에요."(이메일 안 보임), 이름이 없는 구글 계정의 머리말 메뉴도 이메일 대신 '사용자', 학생 → "아이디: 202601".
  - `/privacy/`: 시행 전·열 없음(42703) → "준비 중"만·바닥/로그인 링크 없음, 읽기 실패(500) → 오류 + 다시 불러오기, 이메일 없음 → 두 자리(제10조·쉬운 설명)에 문구 + [다시 불러오기] → 다시 받으면 메일 링크, 시행일 "2026년 10월 21일"·판 번호 1, 로그인 잠금을 켠 설정에서도 열림(같은 설정에서 `/games/`는 잠금 안내), 비밀번호 강제 변경 중 학생도 머무름(`/science/`는 `/reset-password/`로), 인증 전 구글 계정도 `/privacy/`에서는 창 없음(다른 화면으로 가면 창).
  - `#easy`: 로그인 화면 링크로 이동·주소로 바로 열기 모두 쉬운 설명이 화면 위쪽(머리말 아래)에 오고 초점.
  - 로그아웃 방문자 + `profiles: null`: 학습게임 목록·글·댓글, 홈 학습게임 미리보기, 블로그 댓글 모두 글쓴이 "회원", 사진 자리 "회", "익명"·빈칸 없음, 화면 안 깨짐.
  - 화면 크기: 1024×768·768×1024·390×844에서 창·처리방침 화면 가로 넘침 0. 창의 단추·링크·입력·체크 줄 모두 높이 44px 이상(코드 칸 44~48px).
  - 대비(글자색↔실제 바탕, 반투명 합성 계산): 창 밝음 최소 4.77·어두움 6.21, 처리방침 밝음 5.26·어두움 6.87, 바닥 5.49·7.66 — AA 미달 0(로그인 화면의 기존 그라데이션 '로그인' 단추는 도구가 그라데이션을 못 읽은 오탐).
  - 움직임: 창·표에 애니메이션 없음, 회전 표시는 `motion-reduce:animate-none`.
- 사진(`…/scratchpad/privacy-b3/showcase/`, 1024·390 쌍): `01-new-signup-top`, `02-new-signup-form`, `03-existing-member-top`, `04-existing-member-bottom`, `05-existing-delete-confirm`, `06-admin-ack`, `07-privacy-top`, `08-login-links`, `09-privacy-top-dark-390`, `10-user-menu-withdraw-1024`, `11-withdraw-blocked-1024`, `12-games-logged-out-author-1024`. (개발 서버 화면이라 왼쪽 아래 'N' 표시가 있다 — 배포에는 없음.)

## 5. 확인하지 못한 것
- 실제 SQL ①~③·Edge Function·구글 로그인과 함께 동작하는 것(모두 가짜 응답). 실제 `my_member_gate` 등의 응답은 SQL ① 파일을 읽어 맞췄을 뿐 실행해 보지 못함.
- 실제 iPad Safari·휴대폰: 투명 입력을 겹친 6칸 코드 칸(숫자 자판·자동 채우기·붙여 넣기), 화면 키보드가 올라왔을 때 전체 화면 창 스크롤, 화면 낭독기(VoiceOver)로 창·확인 창 읽기.
- 실제 배포(GitHub Pages·Vercel) 빌드 — `next build`는 지침대로 돌리지 않음(개발 서버 + tsc·lint만).

## 6. 메인 에이전트·다른 묶음에게 넘길 것
1. **'[내 정보]' 이름**: 원문(2·3-1절, 제6조)은 "탈퇴는 [내 정보]에서", "[내 정보]에서 별명을 고치고"라고 하지만 사용자 메뉴에는 '내 정보' 항목이 없다(별명 = '프로필 수정', 탈퇴 = 이번에 더한 '회원 탈퇴' — 둘 다 아바타를 누르면 나오는 메뉴). 메뉴 이름을 바꿀지, 원문을 고칠지 사용자 결정이 필요하다.
2. 로그인 화면의 기존 설명 "계정은 관리자가 미리 발급합니다. 별도의 회원가입은 없습니다."가 구글 선생님 가입과 어긋나 보일 수 있다(묶음 3 범위 밖 문장이라 그대로 둠).
3. 원문의 '우리 학급 게시판'·'우리 반 친구들'·'우리 담임 선생님'은 CLAUDE.md의 "'우리 반' 새로 쓰지 않기" 규칙과 겹치지만 원문 글자 그대로 옮김(사용자 승인 원문 우선).
4. 프로필 수정 창은 구글 선생님에게도 예전처럼 이름(최대 50자, `@` 가능)·사진 주소를 자유롭게 고치게 한다 — 별명 규칙·"사진 저장 안 함"을 거기서도 지킬지는 spec에 없어 손대지 않음(필요하면 후속).
5. `POLICY_VERSION`(화면) = `site_settings.privacy_version`(DB)이어야 한다. 판을 올릴 때 `POLICY_CHANGE_SUMMARY`에 한 줄을 함께 넣는다.
6. 8-6절 글이 `src/data/privacy-policy.ts`(묶음 3)에도 있다 — 묶음 4의 `privacy-admin-text.ts`에 같은 글이 있으면 둘이 어긋나지 않게 Review가 함께 대조.
7. 창 상태를 읽지 못하면(네트워크) 창을 띄우지 않는다(서버가 어차피 막음) — 실패 동안 탭 복귀·초점에서 다시 읽는다. 총괄 여부를 읽지 못하면 '회원 탈퇴' 메뉴를 숨긴다.
8. spec 3.9 선택안 B(과학 앱 `class1-record.js`의 인증 전 → 체험 모드)는 이번 묶음에 없음(묶음 5).
9. 스크래치 시험 도구: `privacy-b3/harness.mjs`(9481 Chrome + 9491 명령 서버, 가짜 Supabase)·`run.sh`·`check-text.mjs`·`contrast.js` — Review가 다시 쓸 수 있다(며칠 뒤 지워질 수 있음). Chrome·서버는 끝에 껐다.
