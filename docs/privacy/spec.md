# 개인정보 처리방침 · 구글 가입 교사 인증 · 보호자 동의 설계 (spec)

> Plan 단계 산출물. **구현하지 않음.** 이 문서는 승인용이며, 사용자가 10절의 남은 질문(10.3)을 확인하고 승인하면 Build 서브에이전트가 이 문서를 기준으로 작업한다. 화면에 들어갈 글의 **원문 초안**은 같은 폴더의 `privacy-policy.md`다(문장 단위로 사용자가 확인한다).
> 조사 범위: `CLAUDE.md`·`docs/STATUS.md`, `docs/classes/spec.md`(개정 1~3), `docs/admin/oauth-delete/spec.md`(개정 1), `docs/community/teacher-boards/spec.md`(개정 1·2), `supabase/migrations/*.sql` 20개 전부(특히 `20260921000000`·`20260921020000`·`20260922040000`·`20260923000000`·`20260923010000`·`20260923030000`·`20260927000000`·`20260927010000`·`20260927030000`·`20260928000000`·`20260928010000`), `supabase/functions/*` 5개(`admin-create-member` 전체, `admin-purge-oauth-member`·`check-answer` 앞부분, `admin-reset-password` 권한 부분), `src/app/layout.tsx`·`src/hooks/use-session.tsx`·`src/lib/auth.ts`·`src/app/login/login-form.tsx`·`src/components/{login-gate,force-password-change-gate,profile-dialog,user-menu,site-footer}.tsx`·`src/components/admin/*`·`src/lib/{admin,classes,types,member-import}.ts`, `scripts/templates/class1-record.js`, 참고(읽기만) `selectio game/docs/privacy-policy.md`. **실 DB는 읽지도 쓰지도 않았다** — 모든 서술은 저장소의 SQL·코드 근거다. 확인하지 못한 것은 **"확인 필요"**로 표시했다. 개인정보(이메일·교사 인증 코드의 실제 값)는 이 문서 어디에도 적지 않았다(예시 코드는 `000000`).
> **개정 1 (2026-10-20, 사용자가 10절 질문에 답함 — 이 개정이 아래 본문과 다르면 개정이 우선하며, 본문도 같이 고쳤다)**: ① AI 되짚기(Gemini)는 **끈다**(앱 `answer-check.js`가 `check-answer`를 부르지 않는 별도 변경 + Secret `GEMINI_API_KEY` 해제) → 처리방침·동의서에서 AI 문단을 모두 뺐다 ② 프로필(이름·사진) 읽기를 **로그인한 회원에게만**(SQL ③, 4.10) — 로그아웃 화면의 작성자는 "회원" ③ 기존 구글 회원에게도 [가입하지 않기(계정 삭제)] ④ 질문 3~7·10·11은 추천대로 확정 ⑤ 질문 8·12·13은 사용자 할 일(7절).

---

## 0. 한 쪽 요약

**하려는 일**: ① 개인정보 처리방침을 만들어 공개(`/privacy/`) ② 구글로 가입하는 선생님은 **개인정보 확인 창 + 교사 인증 코드**를 거쳐야만 선생님이 되고, 그 권한은 **자기 학급 일**로 한정 ③ 학생 계정을 만들 때 **보호자 동의서**(종이)를 받았다는 표시를 필수로 ④ 학년도가 끝나면 학급을 한꺼번에 지우는 **학급 정리** ⑤ 구글 이메일·이름·사진을 사이트의 표·화면에서 가림 ⑥ **프로필(이름·사진)을 로그인한 회원에게만 보이게**(로그아웃 방문자에게 작성자는 "회원").

**핵심 설계**
1. **새 SQL 3개**(추가만 하는 ①, 켜는 ②, 프로필 읽기를 좁히고 처리방침을 시행하는 ③) + **새 Edge Function 2개**(`member-self-delete`, `admin-clear-students`) + 고칠 함수 1개(`admin-create-member`). 새 표 4개, 새 열 7개, 새 함수 약 20개(4.2 이름표).
2. **인증 전 구글 계정은 서버가 막는다**: RESTRICTIVE 정책 19개(쓰기 막기) + `can_browse()`를 "인증 전 계정은 비로그인처럼"으로 바꿈. 화면의 창은 안내일 뿐이다(API로 직접 써도 막힌다).
3. **코드는 서버에 해시(bcrypt)로만** 저장하고, 맞는지는 DB 함수 `verify_google_teacher()`가 본다. 틀린 시도는 **계정당·전체** 두 겹으로 제한한다(수치는 4.3).
4. **"자기 학급 일만"** 은 새 열 `profiles.teacher_scope`(`full`/`class`)와 새 함수 `is_full_admin()`으로 판별한다. **학급 밖 교사 권한을 주는 정책 20개·함수 4개(24곳)**(학습게임 관리·블로그·칭찬 문구·게임 파일)의 `is_admin()`을 `is_full_admin()`으로 좁힌다(4.6 표). 학급 안 일(학급 개설·학생 등록·과제·선생님 글·자기 게시판·피드백)은 이미 학급 기준이라 그대로.
5. **학생 확인 창은 만들지 않는다**(Claude 판단, 1.2): 만 14세 미만은 보호자 동의가 근거이고 학생의 클릭은 효력이 없다. 대신 처리방침에 **학생용 쉬운 설명**을 두고 로그인 화면·사이트 바닥에서 링크한다.
6. **프로필 읽기는 로그인한 회원만**(SQL ③, 4.10): `profiles`의 SELECT 정책을 `to authenticated`로 바꾸고, 열 권한은 그대로 둬 로그아웃 화면의 `profiles(...)` 붙이기가 오류 없이 `null`이 되게 한다. 로그아웃 화면의 작성자 폴백을 "익명" → "회원"으로 고친다(2곳).

**꼭 알아야 할 것**
- **AI 되짚기는 끈다**(사용자 결정, 별도 변경): 구글 Gemini 약관에 "18세 미만이 쓸 가능성이 높은 서비스에서는 쓰지 않는다"는 조항이 있어서다. 처리방침·동의서에는 AI 이야기가 없고 학생이 쓴 답은 구글로 가지 않는다(R1 해결). **이 문서의 "쓴 답은 구글로 가지 않는다"는 말은 그 별도 변경이 배포된 뒤에만 사실이다**(7절 전제).
- **프로필 이름은 로그인한 회원에게만 보인다**(사용자 결정, SQL ③): 학생 표시 이름이 처음엔 로그인 아이디(번호일 수 있음)이기 때문이다(R2 해결). 남는 한계: 로그인한 모든 회원(다른 학급 포함)은 서로의 표시 이름을 읽는다(새 질문 N1).
- **지금 등록된 학생(부엉이반)은 보호자 동의 기록이 없다** — 사용자가 동의서를 받아 일괄 기록한다(7절 사용자 할 일, 시행을 막지 않음).

---

## 1. 결정 요약과 법적 근거

### 1.1 사용자 결정 13개 (2026-10-20 — 바꾸지 않음)

| # | 결정 | 이 설계에서 |
|---|---|---|
| 1 | 구글로 가입하는 선생님은 구글 계정 선택 뒤 **개인정보 확인 창 + 교사 인증 코드(6자리)** 필요. 학생 임의 가입 불가 | 3절 흐름, 4.3 |
| 2 | 기존 구글 회원은 사이트에 들어오거나 새로 고칠 때마다(인증할 때까지) 같은 창. **"인디스쿨의 게시글을 다시 확인하거나 메시지를 주세요"** 안내. [나중에 할게요]는 로그아웃만(계정 유지). 기한을 두고 지우지 않음 | 3.3, `privacy-policy.md` 2절 |
| 3 | 확인 창·코드는 **구글 계정에만**. 관리자가 만든 아이디 계정(학생·교사)은 코드 없이 로그인. 총괄이 교사로 지정한 계정(role admin)도 코드 없이 | 3.6, 9절 위험 |
| 4 | **학생 확인 창은 만들지 않는다** | 1.2 |
| 5 | **보호자 동의**: 교사가 학생 계정을 만들 때 보호자 동의를 반드시 받는다(종이, 담임 보관). 동의서 양식(hwpx)은 교사 대시보드에서만 내려받게. 회원 추가(한 명·엑셀)에서 학생 역할이면 **필수 체크 + 누가 언제 체크했는지 `member_create_log`에 기록** | 4.8, 5절, 6절 |
| 6 | 인증한 구글 선생님은 바로 교사 권한(role admin). 단 **"자기 학급 일만"** — 학습게임 전체 관리·신고 처리·블로그 글쓰기·함께 쓰는 칭찬 문구 고치기는 못 한다(총괄과 총괄이 만든 교사만). **총괄이 나중에 넓혀 줄 수 있다**(회원 관리에서) | 4.6, 6절 |
| 7 | 인증 안 한 새 구글 계정: 창에서 **[가입하지 않기]** → 그 자리에서 계정을 완전 삭제(본인 것만, 인증 전·구글 전용·role user·학급 없음일 때만) 후 로그아웃. 창만 닫고 떠난 계정은 회원 관리에 **'인증 전'** 표시 → 총괄이 기존 '완전 삭제'로 지움. **(10-20 질문 5 답: 기존 구글 회원에게도 [가입하지 않기(계정 삭제)]를 준다 — 원래 결정의 "기존 회원 아님" 조건을 뺐다)** | 3.3, 3.4, 4.7, 5절 |
| 8 | 문의 연락처: 이메일, 총괄이 관리자 화면에서 넣음(공개 읽기), 처리방침 화면이 받아 보여 줌. 운영자 표시 이름 `PSC` | 4.1 `site_settings.contact_email` |
| 9 | 보관 기간: **학년도 끝나면 지우기**. 담임(자기 학급)·총괄 화면에 **'학급 정리'**(그 학급 학생 계정과 기록을 한꺼번에 완전 삭제, 강한 확인). 처리방침: 다음 해 3월 31일까지, 탈퇴한 학생의 기록도 이때 함께. 자동 삭제가 아니라 사람이 실행 | 4.7, 6절. 기한 표시는 4.7-3 |
| 10 | 구글 선생님 이름·사진: 인증 창에서 **별명**을 정하고, 구글 프로필 사진은 저장하지 않음(`avatar_url` 비움). 기존 구글 회원도 인증할 때 | 4.3, 4.4 |
| 11 | 구글 선생님 스스로 탈퇴: '내 정보'에서 회원 탈퇴 → 계정과 그 선생님의 글·기록 완전 삭제. **맡은 학급에 학생이 남아 있으면 막고** '학급 정리'를 먼저 하라고 안내 | 4.7-2, 5절 |
| 12 | **구글 아이디(이메일) 가리기**: `member_directory`·`profiles` 등과 모든 화면(총괄 화면 포함)에 이메일 대신 **첫 글자 + `***`**(`k***`)과 별명만. 처리방침에는 사실대로("사이트 어느 화면에서도 운영자는 구글 이메일·이름을 볼 수 없다. 다만 로그인을 처리하는 Supabase의 서버 관리 화면에는 로그인에 필요해 이메일·이름·사진 주소가 남는다") | 4.4, `privacy-policy.md` |
| 13 | 교사 인증 코드 관리: 총괄이 관리자 화면에서 넣고 바꿈(처음 값도 SQL 실행 뒤 화면에서 — SQL 파일에 값 없음). 서버에는 되돌릴 수 없는 값(bcrypt)으로만. 틀린 시도 횟수 제한(계정당). **(10-20 질문 10 답: 계정당 5회/15분·1시간·24시간 + 전체 10분에 30회, 그대로 확정)** | 4.3 |

### 1.1-2 질문에 대한 사용자 답 (2026-10-20 — 추천대로 확정, 아래 본문에 반영됨)

| 질문 | 사용자 답 | 반영 |
|---|---|---|
| 1 Gemini 약관 | **끈다.** 별도 작은 변경으로 앱 공통 틀 `answer-check.js`가 `check-answer`를 부르지 않게 하고(로컬 무의미 규칙은 유지), 사용자가 Secret `GEMINI_API_KEY`를 해제 | 처리방침·동의서의 AI 문단 전부 삭제, 1.3·2·5·7·9절 |
| 2 AI 선택 동의 분리 | 해당 없음(1에서 끔) | — |
| 3 코드 없는 확인 창 | 한 번, 닫기 가능 | 3.6 |
| 4 기존 구글 실명·사진 | ② 실행 때 인증 전 계정은 즉시 가림 | 4.4 |
| 5 기존 구글 회원 [가입하지 않기] | 준다(계정 삭제) | 3.3·3.4·4.7-2, 처리방침 2절 |
| 6 새 계정 자동 정리 | 자동 삭제 없음, 30일 표시만 | 3.5 |
| 7 학생 한 명 '기록까지 삭제' | 더한다 | 4.7-3 |
| 8 부엉이반 학생의 동의 | **사용자 할 일**(동의서 배부·수합 → 일괄 기록). 시행을 막지 않음 | 7절 |
| 9 학생 표시 이름 공개 | **B**: `profiles` 읽기는 로그인한 사용자만, 로그아웃 화면의 작성자는 "회원". **이번 작업에 포함** | 4.10, 6·8·9절 |
| 10 시도 제한 수치 | 제안 그대로 | 4.3 |
| 11 학급 정리 기록 | 지운 인원수만 남김 | 4.1·4.7-3 |
| 12 학교 개인정보 보호책임자 확인 | **사용자 할 일** | 7절 |
| 13 연락처가 이메일뿐 | 총괄이 넣은 이메일이 연락처. 법 제30조 ① 제6호는 "전화번호 등 연락처"라 **전화번호 추가를 나중에 고려하는 것은 사용자 할 일** | 7절, R15 |

### 1.2 Claude 판단 (사용자가 뒤집을 수 있음 — 2·3은 10-20에 사용자가 확정)

1. **학생 확인 창을 만들지 않는다.** 근거: 개인정보 보호법 제22조의2 제1항 — 만 14세 미만 아동의 개인정보를 처리하려고 이 법에 따른 동의를 받아야 할 때는 **법정대리인의 동의**를 받고 동의 여부를 확인해야 한다. 학생이 클릭한 "동의합니다"는 이 요건을 채우지 못하고, 오히려 동의한 것처럼 보이게 할 수 있다. 제3항 — 만 14세 미만 아동에게 개인정보 처리 사항을 알릴 때는 **이해하기 쉬운 양식과 명확하고 알기 쉬운 언어**를 써야 한다 → 처리방침 맨 위에 6학년 눈높이의 쉬운 설명 절, 로그인 화면·사이트 바닥 링크.
2. **총괄이 교사로 지정한 계정·기존 구글 관리자(총괄 포함)는 코드를 받지 않는다.** 대신 **코드 칸이 없는 확인 창**(별명 + 확인 체크)을 한 번 띄운다. 닫기([나중에])를 허용해 총괄이 창 오류로 갇히지 않게 한다(서버는 이 계정을 막지 않는다). (사용자 확정 — 질문 3)
3. **보호자 요구로 학생 한 명을 지울 수 있는 메뉴**('기록까지 삭제')를 더한다. 이유: 기존 '탈퇴 처리'는 학습 기록을 "탈퇴한 학생"으로 남기므로(`admin_finalize_withdrawal`), 보호자의 삭제 요구(법 제36조)를 학년도 끝까지 기다리게 할 수밖에 없다 — 처리방침의 약속(제6조)을 지키려면 필요. (사용자 확정 — 질문 7)
4. **SQL을 2개로 나눈다**(지침은 "파일 하나"): ① 추가만(영향 없음) → 화면·함수 배포 → 총괄이 코드·이메일 입력 → ② 켜기(기존 정책·함수·트리거를 바꿈). 한 파일이면 화면이 올라가기 전에 인증 전 계정이 막혀 아무도 인증할 수 없는 순간이 생긴다.

### 1.3 법적 근거와 출처 (2026-10-20 확인)

| 사실 | 조문 | 출처 | 원문 확인 |
|---|---|---|---|
| 만 14세 미만 아동은 법정대리인 동의 + 동의 여부 확인 | 개인정보 보호법 제22조의2 ① | 국가법령정보센터(law.go.kr) 개인정보 보호법 [시행 2026. 9. 11.] [법률 제21445호, 2026. 3. 10., 일부개정] lsiSeq=283839 | **확인함**(메인 에이전트가 원문 확인) |
| 동의받기 위한 최소 정보(법정대리인 성명·연락처)는 아동에게서 직접 수집 가능 | 같은 조 ②, 시행령 제17조의2 ② | 같은 법, 시행령 [시행 2026. 9. 11.] [대통령령 제36671호, 2026. 9. 10., 일부개정] lsiSeq=289537 | 확인함 |
| 아동에게 알릴 때 쉬운 양식·쉬운 말 | 같은 조 ③ (2023. 3. 14. 신설) | 같은 법 | 확인함 |
| **종이 동의서에 서명날인 후 제출받는 것이 법정대리인 동의 확인 방법** | 시행령 제17조의2 ① 제4호 | 같은 시행령 | 확인함 |
| 서비스 계약 이행에 필요한 항목은 동의 없이 처리(선생님 회원) | 법 제15조 ① 제4호 | 같은 법 | 확인함 |
| 처리방침 필수 항목(목적·기간·제3자 제공·파기 절차·방법·위탁·권리와 행사 방법·보호책임자 연락처·자동 수집 장치 등)과 쉽게 확인할 수 있게 공개 | 법 제30조 ①②, 작성지침은 보호위원회가 정함(④) | 같은 법 | 확인함 |
| 국외 이전: 계약 이행에 필요한 처리위탁·보관은 처리방침 공개(또는 통지)로 가능 | 법 제28조의8 ① 제3호·② | IT 위키(itwiki.kr) 게시본 | **2차 자료 — law.go.kr 원문 대조 필요** |
| 보유기간이 지나면 지체 없이, 복구·재생할 수 없게 파기 | 법 제21조 ①② | IT 위키 게시본 | **2차 자료 — 원문 대조 필요** |
| 처리방침 작성지침 2026-04 개정(수탁자 기재 방식 등) | 개인정보보호위원회 | 2026-04-24 뉴시스 보도 | 위원회 원문은 열지 못함 |
| (참고 — AI 되짚기를 끄므로 지금은 해당 없음, 다시 켜기 전에 확인) 18세 미만이 쓸 가능성이 높은 서비스에서는 구글 Gemini API를 쓰지 않는다 / 무료 등급은 구글이 개선에 쓰고 사람이 읽을 수 있다 | Gemini API 추가 약관 "Age Requirements"·"Unpaid Services" | ai.google.dev/gemini-api/terms (2026-03-23 시행, 2026-04-28 갱신) | 요약 도구로 읽음 — 다시 켜기 전 원문 대조 |

### 1.4 이 설계가 하지 않는 말

"법적으로 문제없다"고 말하지 않는다. 특히 **확인하지 못한 것**: ① 2026-09-11 시행 개정(법률 제21445호)이 처리방침 필수 항목·아동 규정을 바꿨는지 ② 교사 개인이 운영하는 사이트를 학급에서 쓸 때 학교(교육청)의 개인정보 처리자 지위·승인 절차 ③ 오래 접속하지 않은 계정(휴면) 처리 의무의 적용 여부 ④ 파기 결과 기록 의무(표준지침) — 학급 정리 기록(4.7)은 이를 염두에 둔 것이지만 의무인지 확인하지 못했다. 사용자가 학교 개인정보 보호책임자와 상의하기를 권한다(사용자 할 일 — 7절).

---

## 2. 지금 상태 (코드로 확인한 사실)

| 주제 | 지금 | 근거 |
|---|---|---|
| 구글 첫 로그인 | 자동으로 일반 회원(`role='user'`, 학급 없음), 프로필에 **구글 이름(50자)·사진 주소**를 복사 | `handle_new_user`(`20260923000000` §6) |
| 회원 명단 | `member_directory`에 **구글 이메일 전체**·가입 방식·접속 시각. 로그인할 때마다(`last_sign_in_at` 변경) 다시 채움 | `sync_member_directory`(`20260921020000`) — 트리거 `after update of email, raw_app_meta_data, last_sign_in_at` |
| 프로필 공개 | 지금: `id, display_name, avatar_url, role, created_at, updated_at, withdrawn_at`를 **비로그인도** 읽음. 본인이 이름·사진 고침. **SQL ③ 뒤: 로그인한 회원만**(4.10) | `profiles: 누구나 조회`(`20260923020000` §1), 열 권한(`20260927000000` §3-1) |
| 학생 표시 이름 | 처음엔 로그인 아이디(`user_metadata.full_name = row.id`), 학생이 '프로필 수정'에서 바꿈 | `admin-create-member`, `profile-dialog.tsx` |
| 역할 | `role` user/admin + `is_super_admin`. 학급 기록은 담임만(총괄 예외 없음). `create_class`는 관리자 누구나 | `20260927000000`·`…010000` |
| 학급 밖 교사 권한 | 학습게임 숨기기·삭제·신고 처리·게임 파일, 블로그 글, 블로그 댓글 삭제, 칭찬 문구가 **`is_admin()`만** 봄 → 교사 누구나 | 4.6 표 |
| 탈퇴 | 아이디 계정: 기록 보존("탈퇴한 학생"), 기한 없음. 구글 전용: 총괄이 완전 삭제 | `admin_finalize_withdrawal`, `admin_purge_oauth_member` |
| 보호자 동의 | 기록 없음 | — |
| 학생 답 글 | 지금: `check-answer`가 질문·학생 답·모범 답안·오개념 힌트를 Gemini로(체험 모드 포함). **AI 되짚기를 끈다**(별도 변경): 앱 공통 틀 `answer-check.js`가 `check-answer`를 부르지 않고 로컬 무의미 규칙만 쓴다. 함수 코드는 남겨 둔다. 체험 모드는 쓴 내용을 서버로 보내지 않는다(이 기기 브라우저에만) | `check-answer/index.ts`, `answer-check.js`, `CLAUDE.md` |
| 학습게임 공개 범위 | 학습게임 글(제목·설명·게임 파일)은 **학급과 상관없이 모든 회원**이 읽고, 로그인 잠금이 꺼져 있으면 **로그인하지 않은 사람도** 읽는다 | `community_posts: 읽기(게시판은 담임별)`의 `kind <> 'board'` 갈래 + `can_browse()`(`20260928010000` §4-1) |
| 서버 지역 | 서울(`aws-0-ap-northeast-2`) | `supabase/.temp/pooler-url` |
| 사이트 전송 | GitHub Pages + Vercel. 글꼴은 자체 호스팅(`next/font`는 빌드 때 받음), 과학 앱·마크다운 도구는 jsDelivr | `layout.tsx`, `persist.js`, `markdown.ts` |
| 브라우저 저장 | 쿠키 없음. 로그인 세션·`sci6…`·`ssUiPref:*`·`theme`·`sidebar:collapsed` | `src/` 전체 검색 |
| 방문 분석 | 없음 | `package.json`·`src/` 검색 |

---

## 3. 흐름

### 3.1 계정 종류와 상태

| 계정 | 로그인 | 상태 | 창 | 서버가 막는 것 |
|---|---|---|---|---|
| 학생 | 아이디+비밀번호(관리자 생성) | 항상 정상 | 없음 | — (보호자 동의는 교사가 만들 때 표시) |
| 교사(관리자가 만든 아이디) | 아이디 | `teacher_scope='full'` | 없음 | — |
| 구글 · 새 가입(`origin='new'`) · 인증 전 | 구글 | **`pending`** | 1절 창(코드 필요 + [가입하지 않기]) | 쓰기·(잠금 스위치 때) 읽기·**다른 사람의 프로필 읽기**(4.10) |
| 구글 · 기존 회원(`origin='existing'`) · 인증 전 | 구글 | `pending` | 2절 창(코드 필요 + 인디스쿨 문장 + [가입하지 않기(계정 삭제)]) | 같음 |
| 구글 · 인증 완료 | 구글 | role admin + `teacher_scope='class'` | 처리방침이 바뀔 때만(3-2) | 학급 밖 권한 |
| 구글 · 총괄이 올린 관리자 / 총괄 | 구글 | role admin, `full` | 3-1 창(한 번, 닫기 가능) | — |
| 비로그인 체험 | 없음 | — | 없음 | (기존 그대로 — 쓴 내용은 이 기기에만, 서버로 보내지 않음) · 프로필 읽기는 ③ 뒤 막힘(작성자 "회원") |

**`pending`의 정의**(DB `is_pending_google()`): `member_verification` 행이 있고, `profiles.role = 'user'`이고, `verified_at`이 비어 있는 계정.

### 3.2 새 구글 가입
1. 로그인 화면 [Google로 로그인] → 구글 → `/login/`로 돌아옴(기존 `signInWithOAuth`). 안내 한 줄을 더한다: "구글로 처음 오신 선생님은 교사 인증 코드가 필요해요."
2. 가입 순간 DB 트리거 `handle_new_user`(②에서 바뀜)가 프로필을 **중립 값**으로 만든다 — `display_name = '인증 전 회원'`, `avatar_url = null` — 그리고 `member_verification(origin='new')` 행을 만든다. (구글 실명·사진을 공개 프로필에 복사하지 않는다.)
3. 세션이 생기면 `useSession`이 `my_member_gate()`를 불러 `need_code`를 받고, 전체 화면 창(`PrivacyGate`)이 뜬다. 닫기 없음(바깥 클릭·Esc 무시).
4. 별명 + 체크 + 코드 6자리 → [교사로 시작하기] → `verify_google_teacher()`.
5. 성공 → 서버가 한 번에: 별명 저장, 사진 비움, `role='admin'`, `teacher_scope='class'`, `verified_at`·`ack_at`·`policy_version` 기록. 화면은 프로필을 다시 읽어 창을 닫고 "선생님으로 시작했어요. 환영해요!"
6. 실패 → 창 안에 4절 오류 글(남은 시도 수·잠금 시간). 서버는 예외를 던지지 않고 결과를 돌려준다(예외를 던지면 틀린 횟수 기록도 함께 되돌려지기 때문).

### 3.3 기존 구글 회원
- 2절 창. 코드 필요(role user인 경우). 문장 "인디스쿨의 게시글을 다시 확인하거나 메시지를 주세요."는 `origin='existing'`일 때만 보인다.
- 버튼은 [교사로 확인하기] / [나중에 할게요(로그아웃)] / [가입하지 않기(계정 삭제)](사용자 확정 — 질문 5). [나중에 할게요]는 로그아웃만 하고 **계정·기록은 그대로**, 다음 접속 때 다시 뜬다. 기한을 두고 지우는 일은 없다.
- 기존 회원은 예전에 남긴 글·댓글·좋아요가 있을 수 있어, [가입하지 않기(계정 삭제)] 확인 창이 "이 계정이 남긴 글·댓글·좋아요도 함께 지워져요"를 한 줄 더 보인다(3.4).
- 이미 role admin인 기존 구글 계정은 코드가 필요 없다 → 3.6.
- 인증 전까지 이 계정은 글·댓글·좋아요·신고·앱 기록·게임 업로드를 서버에서 거부당한다(4.5). **읽기**는 지금과 같되, 로그인 잠금이 켜져 있으면 비로그인처럼 막힌다(3.8).

### 3.4 [가입하지 않기] (새 가입·기존 회원 모두 — 사용자 확정, 질문 5)
- 인증 전(`pending`) 구글 계정이면 누구에게나 보인다. 새 가입은 [가입하지 않기], 기존 회원은 [가입하지 않기(계정 삭제)]. 확인 창(`privacy-policy.md` 4-1) → Edge Function `member-self-delete`(`mode:'cancel'`) → 서버가 조건을 다시 확인(인증 전·구글 전용·role user·학급 없음 — `origin`은 보지 않는다) → 게임 파일 폴더 정리 → `auth.admin.deleteUser`(하드) → `self_purge_member()` → 화면은 로컬 로그아웃 + 안내.
- 같은 구글 계정으로 다시 오면 **완전히 새 계정**으로 시작한다(`oauth-delete` spec §1.3과 같은 근거 — 같은 id를 재사용하지 않음). 이 때문에 **틀린 시도 횟수가 계정당이면 "가입→시도→가입하지 않기" 반복으로 초기화**된다 → 전체 한도를 함께 둔다(4.3).
- 기존 회원의 계정 삭제는 결정 7("새 계정만")을 사용자가 넓힌 것이다(질문 5). 총괄의 '완전 삭제'와 처리방침의 문의 이메일 경로도 그대로 있다.

### 3.5 창만 닫고 떠남 · 새로 고침 · 다른 탭
- 창을 닫고 떠난 계정은 `pending`으로 남는다. 총괄 회원 관리에 **'인증 전'** 표시 + 가입 후 일수(30일 넘으면 붉은 표시). 지우는 것은 총괄이 기존 '완전 삭제'(`admin-purge-oauth-member`, role user + 구글 전용 → 그대로 맞음). **자동 삭제는 없다**(사용자 확정 — 질문 6: 30일 표시만).
- 새로 고침: 서버 상태(`my_member_gate`)로 다시 판단하므로 창이 다시 뜬다.
- 다른 탭에서 인증을 마치면 이 탭은 낡은 상태 → 탭이 다시 보일 때(`visibilitychange`)·창 초점(`focus`)에서 `my_member_gate`를 다시 읽고, 서버 응답이 `already`이면 창을 닫는다.
- 인증 도중 세션이 끊기면 창은 닫히고 로그인 화면으로(기존 `AdminGuard` 패턴).

### 3.6 코드가 필요 없는 구글 계정 (role admin)
- 총괄과, 총괄이 '담임 지정'(`admin_set_role`)한 구글 계정은 `teacher_scope='full'`(`admin_set_role`이 지정 때 `full`로 둔다). `verify_google_teacher()`는 이들에게 `not_applicable`을 돌려준다.
- 3-1 창: 별명(처음 한 번) + 확인 체크, [확인했어요]/[나중에]. `acknowledge_privacy()`가 별명·사진 비우기·`ack_at`·`policy_version`을 기록한다. [나중에]는 이 탭에서만 닫는다(서버는 막지 않음).
- **위험**(9절 R5): 총괄이 코드 때문에 갇히는 일은 없지만, 창 코드가 잘못되면 총괄 화면을 가릴 수 있다 → 닫기 허용 + `?skipgate=1` 같은 우회구는 두지 않는다(보안 구멍) — 대신 [나중에]로 충분하다.

### 3.7 처리방침이 바뀔 때
- `site_settings.privacy_version`(처음 1)을 올리면 인증을 마친 구글 선생님·구글 관리자에게 3-2 창(별명 칸 없음)이 뜬다. 학생·아이디 선생님에게는 창이 없다(처리방침 변경은 사이트에 알림 — 변경 공지 방식은 질문 외).
- 판 번호는 SQL로만 올린다(총괄 화면에는 읽기 전용으로 표시). 화면의 `POLICY_VERSION` 상수와 DB 값이 같아야 하며 Review가 대조한다.

### 3.8 로그인 잠금 스위치(`can_browse()`)와의 관계
- `can_browse()`는 `auth.uid() is not null or not login_required()`다. ②에서 `(auth.uid() is not null and not is_pending_google()) or not login_required()`로 바꾼다 → **잠금이 켜지면 인증 전 계정은 비로그인처럼** 블로그·학습게임·과학 앱·총괄 선생님 글을 못 읽는다. 잠금이 꺼져 있으면 지금과 같다(누구나 읽음).
- 자유게시판은 원래 `can_use_board(board_owner)`가 학급 없는 계정을 거부하므로 그대로 못 읽는다.
- 프로필(이름·사진) 읽기는 잠금 스위치와 상관없이 ③ 뒤 "로그인한 회원만"이다(인증 전 구글 계정은 본인 행만) — 4.10.

### 3.9 과학 앱을 바로 연 경우
- 앱(`class1-record.js` 23개 사본)은 사이트와 같은 localStorage 세션을 읽어 로그인으로 취급한다. 인증 전 계정이 앱 주소를 직접 열면 → 앱은 로그인 학생처럼 동작하다가 **저장이 서버에서 거부**된다(`app_results`/`app_progress` INSERT 정책의 RESTRICTIVE). 앱이 보여 주는 기존 "제출/저장 안 됨" 흐름으로 떨어진다.
- 선택안 A(기본, 추천): **앱 코드는 바꾸지 않는다.** 창이 사이트 모든 화면을 덮고, 앱 주소를 손으로 치고 들어가는 경우는 드물다. 서버가 막으므로 데이터는 안전하다. 사용자가 "앱 저장 안 됨" 문구를 이상하게 느낄 수 있음이 단점.
- 선택안 B(작업 묶음 5, 선택): `class1-record.js` 정본에 `my_member_gate()` 확인을 더해 `pending`이면 체험 모드로 처리(저장 호출 0, "선생님 확인 뒤 기록이 저장돼요" 안내). 정본 수정 → 23개 사본 복사 → `diff -r` → 앱 몇 개 열어 점검(공통 틀 개선 절차). 하위 호환: RPC가 없으면 기존 동작.

### 3.9-2 체험 모드(비로그인)
- AI 되짚기를 끈 뒤(7절 전제) 체험 모드는 쓴 내용을 서버로 보내지 않는다(기록 저장 호출 0 — 기존 규칙, 답 판정 호출도 0). 서버로 가는 것은 설정 읽기(로그인 잠금 값)와 정적 파일 내려받기뿐이다.

### 3.10 학생(아이디 계정)
- 창 없음. 처리방침은 사이트 바닥·로그인 화면 링크로만 접근. 강제 비밀번호 변경 중인 학생도 읽을 수 있게 `ForcePasswordChangeGate`의 허용 경로에 `/privacy/`를 더한다.
- 보호자 동의는 교사가 계정을 만들 때(회원 추가 필수 체크) 표시한다. 종이 동의서는 담임 보관.

---

## 4. DB 설계

### 4.0 SQL 파일 3개와 지침 (CLAUDE.md "SQL 적용 절차" 그대로)
- `supabase/migrations/20261020000000_privacy_a_schema.sql` **(①: 추가만)** — 새 표·열·함수·RPC. 기존 정책·함수·트리거를 하나도 바꾸지 않는다 → 실행해도 사이트 동작 변화 없음(화면이 새 RPC를 불러도 "행이 없으니 정상"으로 떨어짐).
- `supabase/migrations/20261020010000_privacy_b_enforce.sql` **(②: 켜기)** — 기존 정책·함수·트리거를 바꾸고, 기존 구글 회원을 백필하고, 이메일을 가리고, 인증 전 계정을 막는다. **맨 앞 점검**: 코드가 정해졌고(`verification_settings.code_hash is not null`) 문의 이메일이 들어 있는지(`site_settings.contact_email is not null`), ①이 실행됐는지, 총괄이 있는지 — 아니면 오류로 멈춤(관리자 잠김·빈 창 방지). **맨 끝 점검**: 학급 밖 표(4.6)에 `is_admin()`만 쓰는 허용 정책이 남았으면 전부 되돌림.
- `supabase/migrations/20261020020000_privacy_c_profiles_members_only.sql` **(③: 프로필 읽기 좁히기 + 처리방침 시행)** — `profiles`의 SELECT 정책 하나를 바꾸고(4.10) 끝에서 `site_settings.policy_effective_at`을 기록한다. 로그아웃 방문자 화면 전체에 영향이 있어(작성자 "회원") ②와 **파일을 나눠** 따로 되돌릴 수 있게 했다. 화면의 "회원" 폴백이 먼저 배포돼 있어야 하고(7절), ② 뒤 **같은 자리에서 연달아** 실행한다. **맨 앞 점검**: ①·②가 실행됐는지. **맨 끝 점검**: `profiles`의 SELECT 허용 정책이 정확히 하나(새 정책)인지.
- 세 파일 모두 재실행 안전(`if not exists`/`create or replace`/`drop … if exists`), 위에 실행 방법·확인 쿼리(4.9). **이미 실행한 옛 마이그레이션은 고치지 않는다.** ② 뒤로는 앞선 마이그레이션을 다시 실행하지 않는다(옛 정책이 살아나 권한이 넓어짐) — 되돌리기는 `docs/privacy/rollback-privacy-enforce.sql`(②), `docs/privacy/rollback-profiles-members-only.sql`(③) (Build가 작성).
- 정책 이름은 63바이트 이내(한글은 글자당 3바이트).
- 확장: `create extension if not exists pgcrypto with schema extensions;` — 함수 안에서는 `extensions.crypt(…)`, `extensions.gen_salt('bf')`처럼 **스키마를 붙인다**(`set search_path = ''`). Supabase에서 `pgcrypto`가 `extensions` 스키마에 있는지는 ① 확인 쿼리로 본다(확인 필요).

### 4.1 새 표·열

**새 표 4개** (모두 RLS 켬, **정책 없음**, `anon`/`authenticated`에 아무 권한 없음 → 함수(`security definer`)와 Edge Function(서비스 롤)으로만 읽고 씀. 프로필이 지워지면 `on delete cascade`로 함께 사라짐)

| 표 | 열 | 설명 |
|---|---|---|
| `public.member_verification` | `user_id uuid pk → profiles on delete cascade`, `origin text not null check in ('existing','new')`, `verified_at timestamptz`, `ack_at timestamptz`, `policy_version int`, `wrong_count int not null default 0`, `total_wrong int not null default 0`, `locked_until timestamptz`, `created_at timestamptz not null default now()` | 구글 계정만 행이 있다(아이디 계정은 행 없음). `verified_at` null = 인증 전 |
| `public.member_verification_attempts` | `id bigint identity pk`, `user_id uuid → profiles on delete cascade`, `ok boolean not null`, `created_at timestamptz not null default now()` + 인덱스 `(created_at)` | 틀린 시도 전체 한도 계산용. **계정 번호·성공 여부·시각만**(이메일·코드 없음). 30일 지난 행은 인증 시도 때(`verify_google_teacher`)와 총괄이 개인정보 설정 화면을 열 때(`admin_privacy_overview`) 함께 지움 — 시도가 전혀 없으면 남아 있을 수 있음(처리방침에 그대로 적음) |
| `public.verification_settings` | `id boolean pk default true check (id)`, `code_hash text`, `code_set_at timestamptz`, `code_set_by uuid → profiles on delete set null` | 한 줄. `code_hash`는 bcrypt 해시. `site_settings`(공개 읽기)에 두지 않는 이유: 그 표는 누구나 읽는다 |
| `public.class_cleanup_log` | `id bigint identity pk`, `class_id uuid`(외래키 없음), `class_name text`, `actor_id uuid → profiles on delete set null`, `student_count int`, `created_at timestamptz not null default now()` | 학급 정리를 했다는 기록. **지운 인원수만 — 학생 이름·아이디 없음**(사용자 확정, 질문 11). 총괄 읽기용 RPC로만 조회 |

**새 열 7개**

| 표.열 | 정의 | 공개 여부 |
|---|---|---|
| `profiles.teacher_scope` | `text not null default 'full' check (teacher_scope in ('full','class'))` | **공개 열 목록에 넣지 않음**(`class_id`·`is_super_admin`과 같은 방식 — ①에서 열 권한을 다시 적고 `has_column_privilege`로 점검) |
| `site_settings.contact_email` | `text check (contact_email is null or char_length(contact_email) <= 254)` | 공개 읽기(의도됨 — 결정 8). 쓰기는 RPC만 |
| `site_settings.privacy_version` | `int not null default 1` | 공개 |
| `site_settings.policy_effective_at` | `timestamptz` — ③을 실행한 때 = 처리방침 시행 시각 | 공개. 이 값이 있어야 `/privacy/`·바닥·로그인 화면의 처리방침 링크가 보이고 화면이 시행일로 표시한다(없으면 "준비 중") |
| `member_directory.guardian_consent_at` | `timestamptz` — 교사가 "동의서 받음"을 표시한 때 | 관리자 표(`can_manage_member`) |
| `member_directory.guardian_consent_by` | `uuid → profiles on delete set null` | 같음 |
| `member_create_log.guardian_consent` | `boolean` (null = 해당 없음/기록 이전) | 같음 |

`keep-supabase-awake` 작업은 `site_settings?select=login_required`만 읽으므로 열 추가에 영향 없음(확인함).

### 4.2 함수 · 이름표 (DB와 화면이 같은 이름을 쓴다)

**판별 함수 — PUBLIC 실행**(정책 안에서 불리므로 `is_admin()`과 같음, `security definer`, `stable`, `set search_path = ''`)
- `is_full_admin() → boolean` = role `'admin'` 이고 `teacher_scope = 'full'`.
- `is_pending_google() → boolean` = 3.1의 `pending` 정의.

**화면용 RPC — `authenticated`만 실행**
| 이름 | 하는 일 |
|---|---|
| `my_member_gate() → jsonb` | `{ state: 'ok'\|'need_code'\|'need_ack', origin: 'new'\|'existing'\|null, first_time: bool, locked_seconds: int\|null, policy_version: int }`. 행이 없으면 `ok`(아이디 계정·① 직후) |
| `verify_google_teacher(p_nickname text, p_code text, p_policy_version int) → jsonb` | 4.3 |
| `acknowledge_privacy(p_nickname text default null, p_policy_version int) → jsonb` | 구글 role admin 또는 인증 완료 계정의 확인(별명은 처음 한 번 필수) |
| `admin_set_teacher_code(p_code text) → void` | **총괄만**. 숫자 6자리만. 해시 저장. 시도 기록 초기화 |
| `admin_set_contact_email(p_email text) → void` | 총괄만. 이메일 모양 검사. null이면 지움 |
| `admin_privacy_overview() → jsonb` | 총괄만. `{ code_set, code_set_at, contact_email, privacy_version, pending_count, pending_over_30d, wrong_last_hour, locked_accounts }` |
| `admin_member_privacy_flags() → jsonb` | 총괄만. `[{ id, pending, origin, teacher_scope, verified_at, signed_up_days }]` (회원 목록 표시용) |
| `admin_set_teacher_scope(p_user uuid, p_scope text) → void` | 총괄만. 대상은 role admin 구글/아이디 교사. 자기 자신 불가 |
| `admin_class_cleanup_preview(p_class_id uuid) → jsonb` | 그 학급 담임 또는 총괄. `{ class_name, students, withdrawn }` |
| `admin_class_retention_status() → jsonb` | 담임(자기 학급)·총괄(전체). 4.7-3 |
| `admin_set_guardian_consent(p_student uuid, p_value boolean) → void` | **그 학생의 담임만**(`teaches_student` — 총괄도 다른 학급 학생은 못 함) |
| `admin_set_guardian_consent_class(p_class_id uuid) → int` | 담임. 기록 없는 학생을 모두 표시, 바뀐 수 반환 |
| `my_admin_context() → jsonb` | **다시 정의**: 기존 `{is_super_admin, classes}`에 `teacher_scope` 추가 |

**서비스 롤 전용 함수**(`revoke all … from public, anon, authenticated`, `grant execute … to service_role`)
| 이름 | 하는 일 |
|---|---|
| `purge_member_records(p_target uuid)` | 내부 공통: 4.7-1 |
| `admin_purge_class_member(p_target uuid, p_actor uuid)` | 학급 정리·학생 한 명 삭제용. 대상 role user, 호출자가 그 학생의 담임 또는 총괄, 아이디 계정(OAuth 전용이면 거부) |
| `self_purge_member(p_target uuid, p_mode text)` | `'cancel'`(가입하지 않기)/`'withdraw'`(회원 탈퇴). 조건은 4.7-2 |
| `admin_finish_class_cleanup(p_class_id uuid, p_actor uuid, p_count int)` | `class_cleanup_log`에 한 줄 |
| `admin_log_member_create(p_target, p_actor, p_role, p_source, p_guardian boolean default null)` | **옛 4-인자 함수는 drop 하고 5-인자로 대체**(둘이 있으면 호출이 모호해짐). `p_guardian = true`이면 `member_create_log.guardian_consent`와 `member_directory.guardian_consent_at/by`를 함께 채움 |

**다시 정의하는 기존 함수·트리거**(②): `handle_new_user`, `sync_member_directory`, `can_browse`, `admin_set_role`(지정 때 `teacher_scope='full'`, 해제 때도 `full`로 되돌림), `record_post_read`·`get_or_create_feedback_thread`(인증 전이면 거부), 학습게임 관리 RPC 4개(4.6).

### 4.3 인증 RPC 동작 — `verify_google_teacher()`

1. 로그인 확인(`auth.uid()`), 계정별 `pg_advisory_xact_lock`으로 같은 계정의 동시 호출을 한 줄로 세운다.
2. `member_verification` 행이 없으면 `not_applicable`. role이 이미 `admin`이면 `not_applicable`(→ 화면은 `acknowledge_privacy`). `verified_at`이 있으면 `already`.
3. `p_policy_version`이 `site_settings.privacy_version`과 다르면 `policy_changed`(화면이 새로 고침 안내).
4. 코드가 정해지지 않았으면(`code_hash` null) `not_configured`.
5. **잠금**: `locked_until > now()`이면 `locked`(+ 남은 초). **전체 한도**: 최근 10분 틀린 시도(`ok=false`)가 30번 이상이면 `busy`(맞는 코드도 거부 — 10분 뒤).
6. 별명 검사(틀려도 시도로 세지 않음): 앞뒤 공백 제거, 2~20자, 제어문자·`@`·`http` 불가, 예약어("관리자", "총괄", "총괄 관리자", "운영자" 등 정확히 같은 것) 불가 → `bad_nickname` + 문구.
7. 코드 비교: `code_hash = extensions.crypt(p_code, code_hash)`. 입력이 숫자 6자리가 아니면 비교 없이 `wrong_code`(시도로 셈).
8. **틀림**: `wrong_count+1`, `total_wrong+1`, 시도 기록(`ok=false`). `wrong_count`가 5가 되면 15분 잠금, 10이면 60분, 15 이상(5의 배수)이면 24시간 — 잠금이 걸리면 `wrong_count`는 그대로 두고 `locked_until`만 설정(해제 뒤 이어서 센다). 결과 `{ ok:false, reason:'wrong_code', attempts_left }`를 **돌려준다(예외 아님)**.
9. **맞음**: 한 트랜잭션에서 `profiles`를 `display_name=별명, avatar_url=null, role='admin', teacher_scope='class', class_id=null`로, `member_verification`을 `verified_at=ack_at=now(), policy_version=p_policy_version, wrong_count=0`으로, 시도 기록 `ok=true`. `{ ok:true }`. (`member_directory.email`은 이미 가린 값이라 이 단계에서 따로 가리지 않는다 — 4.4.)
10. 30일 지난 시도 기록을 정리한다(이 함수가 불릴 때만 — `admin_privacy_overview`도 같은 정리를 한다).

**수치 근거**(사용자 확정 — 질문 10): 6자리는 경우의 수가 100만. 계정당 한도만 있으면 3.4의 "가입→가입하지 않기" 반복으로 초기화되므로 **전체 한도**(10분에 30번)를 함께 둔다 → 무작정 맞히기에 하루 최대 약 4,300번, 평균 100일 이상 걸리고 그동안 총괄 화면에 "최근 1시간 틀린 시도"가 쌓여 보인다. 단점: 누군가 일부러 틀려서 모든 선생님의 시도를 10분씩 막는 방해가 가능(9절 R3). 수치는 함수 안의 상수 — 바꾸려면 새 SQL. 코드를 바꾸면(`admin_set_teacher_code`) 시도 기록은 그대로 둔다. **서버에 보내는 코드는 HTTPS 요청 본문에 실린다**(Supabase의 API 로그가 인자를 기록하는지는 확인 필요 — 기본 설정에서는 본문을 남기지 않는 것으로 알려져 있으나 이 프로젝트에서 확인하지 못함).

### 4.4 구글 이메일·이름·사진 가리기 (결정 10·12)

| 곳 | 지금 | 바꿈 (②) |
|---|---|---|
| `member_directory.email` | 구글 이메일 전체 | `sync_member_directory`가 **가입 방식이 아이디(`email`)가 아니면** `left(split_part(email,'@',1),1) || '***'`로 저장(로그인마다 다시 돌아도 가린 값만 들어감). 기존 행도 같은 식으로 백필 |
| `profiles.display_name` | 구글 `full_name` 복사 | 새 구글 가입: `'인증 전 회원'`. 인증하면 별명. **기존 구글 `role user`(인증 전)**: ②에서 `'인증 전 회원'`으로 즉시 바꿈(사용자 확정 — 질문 4). 기존 구글 관리자: 확인 창에서 별명을 정할 때 바꿈 |
| `profiles.avatar_url` | 구글 사진 주소 | 새 구글 가입: null. 기존 구글 `role user`: ②에서 비움. 기존 구글 관리자: 확인할 때 비움 |
| `member_withdrawal_log.target_email/name`, `member_create_log.target_email` | 이메일·이름 스냅샷 | 구글 계정은 이 로그에 들어오지 않는다(탈퇴·생성 로그는 아이디 계정용). 변경 없음 |
| `auth.users`·`auth.identities` | 구글 이메일·이름·사진 주소 | **Supabase가 관리 — 바꿀 수 없음.** 처리방침에 사실대로("서버 관리 화면에 남는다"). 로그인마다 구글 값으로 갱신되는지는 확인 필요 |
| 화면 | 총괄 화면이 `member_directory.email`·`profiles.display_name`을 그대로 표시 | DB 값이 이미 가려져 있어 화면은 자동으로 `k***`·별명만 보임. 프로필 수정 창만 고침: 구글 계정은 이메일 대신 "구글 계정으로 로그인 중이에요."(본인 세션에는 원래 이메일이 있음 — 공용 PC 화면에 보이지 않게) |

**철회 불가**: 가린 이메일은 `member_directory`에서 되돌릴 수 없다(auth에는 남아 있음). 롤백 SQL은 마스킹을 되돌리지 못한다 — 사용자 결정 12.

### 4.5 인증 전 구글 계정의 쓰기 막기 (RESTRICTIVE 정책)

모든 정책은 `as restrictive … to authenticated`, 조건은 `not (select public.is_pending_google())`(초기 계획 1회 평가). 허용 정책에 AND로 붙으므로 **인증 전이 아닌 모든 사람에게는 효과가 없다.** 이름은 `"<표>: 인증 전 쓰기 제한"`(63바이트 이내).

| 표 | 막는 명령 |
|---|---|
| `profiles` | UPDATE (인증 전에는 이름·사진을 직접 못 고침. 별명은 인증 RPC로만) |
| `comments`, `likes` | INSERT(+comments UPDATE) |
| `community_posts` | INSERT, UPDATE |
| `community_comments` | INSERT, UPDATE |
| `community_likes`, `community_reports` | INSERT |
| `app_results` | INSERT |
| `app_progress` | INSERT, UPDATE |
| `assignment_submissions` | INSERT, UPDATE |
| `feedback_messages` | INSERT |
| `feedback_read_marks` | INSERT, UPDATE |
| `storage.objects` | INSERT — 조건에 `bucket_id <> 'game-uploads' or …` 를 넣어 다른 버킷에 영향 없게 |

DELETE는 막지 않는다(인증 전 기존 회원이 자기 옛 글을 지우는 것은 허용). 함수 쪽: `record_post_read`, `get_or_create_feedback_thread`는 맨 앞에서 `is_pending_google()`이면 아무 일도 하지 않거나 거부. `increment_post_view`는 비로그인도 부르는 함수라 그대로.

### 4.6 "자기 학급 일만" — 좁힐 정책·함수 전부 (최신 마이그레이션에서 찾음)

`is_full_admin()`으로 바꾸는 곳 — **"지금 조건"은 모두 `public.is_admin()`** 이고(괄호 안은 같이 쓰이는 조건), "바꿀 조건"은 그 `is_admin()`만 `is_full_admin()`으로 바꾼 것이다. 이름·번호는 지금 살아 있는 정의가 있는 파일 기준.

| # | 대상 | 파일(지금 정의) | 바꿀 곳 |
|---|---|---|---|
| 1 | 정책 `community_posts: 읽기(게시판은 담임별)` | `20260928010000` §4-1 | `kind <> 'board' and is_admin()` → full (숨긴 게임 보기) |
| 2 | 정책 `community_posts: 본인·게시판 관리자 수정` | 같은 파일 §4-3 | using·with check의 `kind <> 'board' and is_admin()` |
| 3 | 정책 `community_posts: 본인·게시판 관리자 삭제` | §4-4 | 같음 |
| 4 | 정책 `community_comments: 읽기(게시판은 담임별)` | §4-5 | 게임 갈래 두 군데(`not p.hidden or is_admin() …`, `not hidden or … or is_admin()`) |
| 5 | 정책 `community_comments: 본인·게시판 관리자 삭제` | §4-7 | `p.kind <> 'board' and is_admin()` |
| 6 | 정책 `community_likes: 읽기(게시판은 담임별)` | §4-8 | 게임 갈래 `is_admin()` |
| 7 | 정책 `community_reports: 신고자·게시판 관리자 조회` | §4-10 | `target_post_kind = 'game' and is_admin()` |
| 8 | 정책 `community_reports: 신고(볼 수 있는 글·댓글만)` | §4-11 | 게임 갈래 `is_admin()` |
| 9 | 정책 `community_reports: 게시판 관리자 삭제` | §4-12 | `target_post_kind = 'game' and is_admin()` |
| 10~13 | 함수 `set_community_post_hidden`·`set_community_comment_hidden`·`set_community_report_status`·`resolve_community_reports_for` | §5-1~5-4 | 맨 앞 `if not is_admin()`은 유지(교사 확인), **게임 종류이면 `is_full_admin()`이 아닐 때 `admin only` 거부**를 더함. 게시판 갈래(`can_manage_board`)는 그대로 |
| 14 | 정책 `game-uploads: 볼 수 있는 게임·본인·관리자 조회` (storage) | `20260923010000` §3.10 | `is_admin()` 두 군데 |
| 15 | 정책 `game-uploads: 본인 또는 관리자 삭제` (storage) | `20260922040000` | `or public.is_admin()` |
| 16 | 정책 `posts: 공개 글은 누구나, 관리자는 전체 조회` | `20260923010000` §3.2 | `or public.is_admin()` (남의 비공개 글) |
| 17 | 정책 `posts: 교사 본인 이름으로 작성` | `20260927030000` §2 | `is_admin() and author_id = auth.uid()` |
| 18 | 정책 `posts: 쓴 교사·총괄만 수정` | 같은 파일 | `is_admin() and (author_id = …)` |
| 19 | 정책 `posts: 쓴 교사·총괄만 삭제` | 같은 파일 | 같음 |
| 20 | 정책 `comments: 공개 글의 댓글은 누구나 조회` | `20260923010000` §3.3 | `public.is_admin() or (…)` |
| 21 | 정책 `comments: 본인 또는 관리자 삭제` | `20260921000000` | `auth.uid() = user_id or is_admin()` |
| 22 | 정책 `praise_presets: 관리자만 추가` | `20260922020000` | `with check (is_admin())` |
| 23 | 정책 `praise_presets: 관리자만 수정` | 같은 파일 | using·with check |
| 24 | 정책 `praise_presets: 관리자만 삭제` | 같은 파일 | using |
| (유지) | 정책 `praise_presets: 관리자만 조회` | 같은 파일 | **`is_admin()` 그대로** — 학급 선생님도 칭찬 보내기에 문구를 읽는다 |
| 25 | 함수 `my_admin_context()` | `20260927000000` §7-1 | 반환에 `teacher_scope` 추가 |
| 26 | 함수 `admin_set_role()` | `20260927010000` §5-2 | 담임 지정·해제 때 `teacher_scope = 'full'`로 둠 |

(좁히는 곳 = 정책 20개(`public` 18 + `storage.objects` 2) + 함수 4개 = **24곳**, 표의 25·26번은 이를 받치는 함수 2개. Build가 `grep`으로 다시 세어 이 표와 맞춘다.)

**이미 학급 범위라 바꾸지 않는 것**(전수 확인 — "학급 안 일"이라 구글 선생님에게도 열려야 함)
`classes`·`class_teachers` 읽기, `create_class`·`rename_class`, `app_results`·`app_progress`·`post_reads`·`assignment_submissions`·`feedback_*`·`member_directory`·감사 로그 3개(모두 `teaches_student`/`can_manage_member`), `get_or_create_feedback_thread`·`mark_thread_read`·`unread_feedback_count`·`admin_must_change_password_ids`·`admin_dashboard_stats`, `assignments` 4개(학급 + 쓴 교사), `class_notices`, 자유게시판 `community_*`의 게시판 갈래(`can_manage_board` — 자기 게시판), `admin_set_login_required`·`admin_set_role`(총괄만), Edge Function `admin-create-member`·`admin-reset-password`·`admin-delete-member`(담임 학급), `admin-purge-oauth-member`(총괄만).

**`community_posts_guard()` 트리거**의 `not public.is_admin()`은 글쓴이 id 불일치를 막는 방어인데 INSERT 정책이 이미 `auth.uid() = author_id`를 강제하므로 영향이 없어 바꾸지 않는다.

**화면(UX)**: 구글 선생님(`teacher_scope='class'`)에게는 '커뮤니티'(학습게임 신고) 메뉴의 게임 부분, 칭찬 문구 편집, 블로그 쓰기 진입점을 숨기거나 꺼 둔다(서버가 어차피 거부). `my_admin_context().teacher_scope`를 `use-admin-context`에 `isFullAdmin`으로 노출.

### 4.7 삭제 · 학급 정리 · 자기 탈퇴

**4.7-1 `purge_member_records(p_target)`** — 한 계정의 모든 기록을 지우는 공통 내부 함수. `admin_purge_oauth_member`(`20260928000000`)와 같은 순서·같은 주의를 따른다: ① 그 계정의 글·댓글을 신고한 기록(`community_reports`, 스냅샷에 이름·내용이 있음) ② 그 계정의 `community_posts`(다른 사람의 댓글·좋아요도 연쇄) ③ 관리 기록 3개(`member_withdrawal_log`·`member_create_log`·`password_reset_log`의 대상 행 삭제, 처리자로 남은 이름·id는 비움) ④ 교사였던 계정이면: 그 교사가 쓴 `class_notices`·`assignments`·`posts` 삭제 ⑤ `profiles` 삭제(나머지는 외래키 cascade/set null이 정리 — `oauth-delete` spec §3.1 표). **기존 `admin_purge_oauth_member`는 고치지 않는다**(이미 실행됨). 두 곳의 목록이 어긋나지 않도록 Review가 대조하고, 새 표가 `profiles`를 참조하게 될 때 둘 다 고친다는 주석을 남긴다. 호출 전에 Edge Function이 게임 파일(Storage)을 지우고 `auth.users`를 하드 삭제한다(`oauth-delete` spec §3.8).

**4.7-2 자기 탈퇴·가입하지 않기 — `self_purge_member(p_target, p_mode)`**
- 공통: `p_target`이 호출 Edge Function이 검증한 본인. 구글 전용(`member_directory.providers`에 `email` 없음). 총괄 불가.
- `cancel`: `verified_at is null` and role user and `class_id is null`. **새 가입·기존 회원 모두**(`origin`은 보지 않는다 — 사용자 확정, 질문 5). 기존 회원이면 그 계정의 글·댓글·좋아요도 `purge_member_records`가 지운다.
- `withdraw`: 인증을 마쳤거나 role admin인 구글 계정. **그 교사가 담임인 학급 어디에도 학생(`role='user'`, 탈퇴한 학생 기록 포함)이 남아 있으면 `blocked`** 와 학급 이름 목록을 돌려줌 → 화면은 "먼저 학급 정리" 안내(결정 11 그대로). 통과하면: 혼자 맡은 빈 학급은 학급째 지움(`assignments.class_id`가 `on delete restrict`이므로 그 학급의 과제를 먼저 지움; `class_notices`는 cascade), 함께 맡은 학급은 담임 연결만 빠짐 → `purge_member_records`.
- 마지막 관리자 불가(`role='admin'` 수 > 1).

**4.7-3 학급 정리**
- Edge Function `admin-clear-students` `{ classId, confirmName }`: 호출자가 그 학급 담임 또는 총괄 → 학급 이름 일치 확인 → `profiles where class_id = X and role = 'user'`(**탈퇴 처리된 학생 포함**)를 **한 번에 20명씩** 처리(게임 파일 → `deleteUser`(이미 없으면 통과) → `admin_purge_class_member`) → `{ deleted, failed, remaining }` 반환, 화면이 `remaining = 0`까지 반복 호출(진행 표시 "n/m명"). 멱등(다시 눌러도 안전). 끝나면 `admin_finish_class_cleanup`이 인원수 한 줄만 기록(이름·아이디 없음 — 사용자 확정, 질문 11).
- 같은 함수의 `{ userId, confirmName }` 모드 = **학생 한 명 '기록까지 삭제'**(보호자 삭제 요구, 사용자 확정 — 질문 7). 대상: role user + 아이디 계정, 호출자가 그 학생의 담임 또는 총괄.
- 지우지 않는 것: 학급 행, `class_notices`, `assignments`(내용), 선생님 계정, 칭찬 문구. 학급을 지울지는 별개(기존 '담임 해제' 규칙).
- **기한 표시**(`admin_class_retention_status`): "지난 학년도 계정" = 가장 최근 3월 1일(한국 시간)의 한 달 전(2월 1일)보다 먼저 만든 학생 계정, 기한 = 그 3월 1일 + 31일(4월 1일부터 지남). 예: 2026-10-20 현재 2026-02-01 전에 만든 학생이 남아 있으면 "기한 지남". 겨울방학에 미리 등록하는 학생(2월)은 새 학년도로 본다. 담임은 자기 학급, 총괄은 전체를 본다. 개요 화면 카드로 표시(자동 삭제 없음 — 결정 9). 규칙은 Build 때 사용자 확인(질문 외 사소한 것).
- 대량 삭제 보호: 학급 이름 입력 확인 + 미리보기 인원수 + "되돌릴 수 없음" 체크. 학생 수가 0이면 버튼 비활성.

### 4.8 보호자 동의 기록 (결정 5)
- `admin-create-member` 요청에 `guardianConsent: true` 필드를 더한다. **학생 줄(`role:'user'`)이 하나라도 있고 `guardianConsent !== true`이면 계정을 하나도 만들기 전에 400** ("보호자 동의서를 받았다는 표시가 필요해요."). 교사 줄에는 필요 없음. 엑셀은 파일 하나에 체크 하나(모든 학생 줄에 적용).
- 만들어진 학생 계정마다 `admin_log_member_create(…, p_guardian => true)` → `member_create_log.guardian_consent = true`(누가=`actor_id`, 언제=`created_at`) + `member_directory.guardian_consent_at/by`.
- **이전 계정**(지금 있는 학생)은 기록이 없다 → 회원 목록의 '보호자 동의' 열에 "기록 없음"과 [동의서 받음으로 기록](한 명) / [이 학급 모두 …](일괄) — `admin_set_guardian_consent`·`admin_set_guardian_consent_class`(담임만). 이 기능은 "받았다고 표시"일 뿐 법적 확인을 대신하지 않는다 — 문구에 명시(`privacy-policy.md` 8-2).
- 동의서 종이는 사이트에 올리지 않는다(담임 보관, 학급 정리 때 파쇄).

### 4.9 확인 쿼리 · 점검 · 되돌리기
- **① 실행 뒤 확인**: 새 표 4개 RLS 켜짐·`anon`/`authenticated` 권한 0 · 새 열 7개 · `profiles` 공개 열이 여전히 7개(`teacher_scope` 없음) · 새 함수 실행 권한(`has_function_privilege`) · `select extname, extnamespace::regnamespace from pg_extension where extname='pgcrypto'` · `select public.withdrawal_blocking_fks();`가 `{}` · 기존 화면이 그대로인지(① 전·후 `select count(*)`가 같은 표들).
- **② 실행 전 확인(읽기만)**: 구글 계정 수(`member_directory.providers`에 `email` 없음)와 그중 role user/admin 수 · 총괄 id · 코드/문의 이메일 설정 여부.
- **② 실행 뒤 확인**: 구글 계정 `member_verification` 행 수 = 위 수 · 구글 `member_directory.email`이 모두 `?***` 모양 · 인증 전 구글 `profiles.display_name`이 '인증 전 회원' · RESTRICTIVE 정책 19개 · 학급 밖 정책 목록(4.6)에 `is_admin()`만 쓰는 허용 정책 0 · `has_function_privilege('anon', 'public.verify_google_teacher(text,text,int)', 'execute')` false.
- **③ 실행 전 확인(읽기만)**: `select policyname, cmd, roles from pg_policies where tablename='profiles'`(SELECT 정책이 `profiles: 누구나 조회` 하나) · `pg_policies`의 다른 표 정책 식에 `profiles`를 직접 조회하는 곳이 없는지(`qual`/`with_check`에 `profiles` 포함 검색 → 없어야 함).
- **③ 실행 뒤 확인**: SELECT 정책이 `profiles: 로그인한 회원 조회` 하나 · `site_settings.policy_effective_at`에 값 · 흉내(anon): `select count(*) from public.profiles` = 0이고 오류 없음 · 흉내(학생): 전체 수 · 흉내(인증 전 구글): 1 · anon 열 SELECT 권한이 그대로(`has_column_privilege('anon','public.profiles','display_name','SELECT')` true — 일부러).
- **흉내 시험(SQL Editor, `set local role authenticated` + `request.jwt.claims`)** — 8절.
- **맨 끝 점검(②)**: 4.6의 대상 표에 `is_admin()`만 쓰는 허용 정책이 남으면 전부 되돌림(classes_rls와 같은 방식).
- **되돌리기** `docs/privacy/rollback-privacy-enforce.sql`(Build가 작성): ②가 바꾼 정책·함수·트리거를 옛 정의로(RESTRICTIVE 정책 삭제, `can_browse`·`handle_new_user`·`sync_member_directory`·`admin_set_role`·게임 RPC·정책을 옛 본문으로). ③ 되돌리기 `docs/privacy/rollback-profiles-members-only.sql`: 옛 정책 `profiles: 누구나 조회`(using true)로 되돌리고 `policy_effective_at`을 비운다(화면의 "회원" 폴백은 그대로 둬도 무해). 가린 이메일과 비운 구글 이름·사진은 되돌리지 않는다.

### 4.10 프로필(이름·사진)을 로그인한 회원에게만 보이게 하기 — SQL ③ (사용자 확정, 질문 9 = B)

**왜**: 학생 표시 이름은 처음에 로그인 아이디(번호일 수 있음)이고, `profiles`의 이름·사진·역할은 지금 비로그인도 읽는다(2절). 읽기를 로그인한 회원으로 좁힌다.

**바꾸는 것은 정책 하나**
```sql
drop policy if exists "profiles: 누구나 조회" on public.profiles;
create policy "profiles: 로그인한 회원 조회" on public.profiles for select to authenticated
  using ( id = (select auth.uid()) or not (select public.is_pending_google()) );
```
(스케치 — Build가 실제 SQL을 쓴다. 정책 안에서 `profiles`를 다시 조회하지 않는다: `is_pending_google()`은 `security definer`라 재귀가 없다.)
- **anon은 정책이 없어 0행.** `anon`의 열 SELECT 권한(`grant select (id, display_name, …) on profiles to anon`)은 **일부러 그대로 둔다.** 권한까지 거두면 PostgREST가 `profiles(...)`를 붙인 요청(학습게임 목록·글·댓글, 블로그 댓글)을 통째로 `42501`로 실패시켜 로그아웃 화면이 깨진다. 권한은 두고 정책만 없애면 같은 요청이 정상으로 돌아오고 `profiles` 값만 `null`이 된다.
- **인증 전 구글 계정은 본인 행만 본다**(`is_pending_google()` 때문). 그렇지 않으면 구글 계정만 있으면 교사 코드 없이도 "로그인한 회원"이 되어 모든 학생의 표시 이름(아이디)을 읽을 수 있다.
- 끝에서 `site_settings.policy_effective_at = now()`를 기록한다 — 처리방침이 말하는 것이 모두 사실이 된 순간(= 처리방침 시행).
- 로그인 잠금 스위치와의 관계: 잠금이 켜지면 비로그인은 어차피 글을 못 읽는다. 꺼져 있을 때(지금 기본)에만 비로그인이 학습게임·블로그를 보며, 그때 작성자는 "회원"이다. 프로필 읽기는 잠금과 상관없이 늘 로그인한 회원만.

**로그아웃 방문자가 볼 수 있는 화면 중 `profiles`를 붙이는 곳 전부** (2026-10-20 `src/` 전수 검색)

| 화면(파일) | 쿼리 | ③ 뒤 | 고칠 것 |
|---|---|---|---|
| 블로그 글 상세 댓글 (`src/components/comment-section.tsx`) | `comments?select=…,profiles(display_name,avatar_url,withdrawn_at)` | `profiles: null` | 이름 폴백 `"익명"` → **`"회원"`**, 사진은 이름 첫 글자 대체(이미 있음) |
| 학습게임 목록 `/games/` · 홈 "최근 학습게임" 미리보기 (`community-post-list.tsx`, `src/lib/community.ts`의 `POST_AUTHOR`) | `community_posts?select=…,profiles!community_posts_author_id_fkey(…)` | `profiles: null` | `authorName()` 폴백 `"익명"` → **`"회원"`** (`community.ts`) |
| 학습게임 글 상세 (`community-post-detail.tsx`) | 같은 쿼리 + 작성자 사진 | 같음 | 같은 `authorName()`, 사진 폴백은 첫 글자 |
| 학습게임 댓글 (`community-comment-section.tsx`, `COMMENT_AUTHOR`) | `community_comments?select=…,profiles!community_comments_user_id_fkey(…)` | 같음 | 같은 `authorName()` |
| 자유게시판 `/board/**` 목록·글·댓글, 홈 "최근 자유게시판" | 위와 같은 함수 | **원래 로그인 전용** | 없음 |
| 검색 `/search/` | `searchCommunity` — 작성자 이름을 보여 주지 않음 | — | 없음 |
| 홈 '선생님 글' (`class_notices`) | 작성자 이름 표시 없음(제목·본문만) | — | 없음 |
| 게시판 주인 이름 (`useBoardOwnerName`) | `profiles?select=display_name&id=eq.<주인>` | 로그인 전용 화면 | 없음 |
| 로그인한 사람의 화면(헤더 메뉴 `fetchProfile`, 프로필 수정, 관리자 화면 전부, 피드백 대화, 학습 현황) | `profiles` | 로그인 상태라 그대로 | 없음 (인증 전 구글만 본인 행 외에 못 읽음) |
| 과학 앱(`class1-record.js`, `persist.js`) · Edge Function | `profiles`를 읽지 않음 / 서비스 롤(RLS 무관) | — | 없음 |

DB 쪽 점검: 다른 표의 **정책 식**이 `profiles`를 직접 조회하면 그 정책이 anon·인증 전 계정에게 0행이 된다. 지금까지 읽은 정책은 모두 `security definer` 함수를 거치므로 없다고 보지만(읽어서 확인함), Build가 `pg_policies`로 다시 확인한다(4.9 ③ 실행 전 확인).

**화면 문구**: 작성자·댓글 작성자 이름을 읽을 수 없거나 없을 때 **"회원"**(로그아웃 방문자, 지워진 계정). 로그인한 사람에게 "탈퇴한 학생" 표시는 그대로. 학생에게는 쉬운 설명에서 "별명에 진짜 이름을 쓰지 마세요 — 이 사이트에 로그인한 다른 반 친구와 선생님도 볼 수 있어요"라고 알린다(`privacy-policy.md` 6절).

**남는 한계(처리방침에 사실대로)**: 로그인한 모든 회원(다른 학급 학생·다른 학급 선생님 포함)은 서로의 `display_name`·`avatar_url`·`role`을 읽을 수 있다. 같은 학급·같은 게시판 참여자까지만 보이게 더 좁히는 일은 이번 작업이 아니다(새 질문 N1).

---

## 5. Edge Function

| 함수 | 상태 | 요청 | 하는 일 |
|---|---|---|---|
| `member-self-delete` | **신규** | `{ mode: 'cancel' \| 'withdraw' }` | 호출자 JWT 확인 → 본인 조건 검사(서비스 롤로 `member_verification`·`member_directory`·`class_teachers` 읽기) → 게임 파일 폴더 삭제 → `auth.admin.deleteUser` → `self_purge_member`. 응답 `{ ok, blocked?: [학급 이름], warning? }`. `cancel`은 인증 전 구글 계정 누구나(새 가입·기존 회원, 3.4·4.7-2), `withdraw`는 4.7-2 |
| `admin-clear-students` | **신규** | `{ classId, confirmName }` 또는 `{ userId, confirmName }` | 4.7-3. 한 번에 최대 20명. 응답 `{ ok, deleted, failed, remaining }` |
| `admin-create-member` | **수정** | `guardianConsent` 필드 추가 | 4.8. 나머지(권한·학급 확인·로그)는 그대로 |
| `admin-purge-oauth-member` | 변경 없음 | — | role user + 구글 전용 → 인증 전 계정·인증 뒤 해제된 옛 교사도 지울 수 있어 새 구조와 맞음. `member_verification`은 profile 삭제로 cascade |
| `admin-delete-member`·`admin-reset-password` | 변경 없음 | — | 학급 기준 권한이라 구글 선생님에게도 올바르게 동작(자기 학급 학생만) |
| `check-answer` | 앱이 부르지 않음 — **함수는 남겨 둠**(나중에 학생용으로 쓸 수 있는 AI를 찾으면 다시 검토) | — | 이 작업은 건드리지 않는다. 앱 쪽 호출을 끄는 별도 변경(메인 에이전트)과 Secret `GEMINI_API_KEY` 해제(사용자)가 전제(7절). 함수의 허용 출처·공개 키 경로는 그대로라 누가 직접 불러도 키가 없어 `upstream_error`로 끝난다 |

공통: `config.toml`에 `[functions.<이름>] verify_jwt = true` 두 개 추가, 폴더마다 `README.md`, CORS는 기존 방식(GitHub Pages·localhost + Secret `EXTRA_ALLOWED_ORIGINS`) 복사. 서비스 롤 키는 응답·로그에 넣지 않고, 로그에는 실패 단계와 오류 문구만(이메일·이름·id 없음).

**사용자가 배포하는 명령**(자기 Mac 터미널, `--no-verify-jwt` 금지):
```
npx supabase functions deploy member-self-delete
npx supabase functions deploy admin-clear-students
npx supabase functions deploy admin-create-member
```
함수는 ① SQL 뒤, 화면 push 전에 배포한다. 새 함수가 불리는 새 SQL(`purge_member_records` 등)이 ① 안에 있어야 한다. `CLAUDE.md`의 함수 목록은 5개 → 7개로 고친다.

---

## 6. 화면

바꿀 파일 전체 목록(Build 지침에서 확정):

**공개·모든 사용자**
| 파일 | 내용 |
|---|---|
| `src/data/privacy-policy.ts` (신규) | 처리방침·쉬운 설명·창 문구 상수 — `privacy-policy.md`의 문장 그대로 |
| `src/app/privacy/page.tsx` + `privacy-view.tsx` (신규) | `/privacy/`: 로그인 없이 읽기. `site_settings`에서 `contact_email`·`privacy_version`·`policy_effective_at` 읽기(못 읽으면 "문의 이메일을 불러오지 못했어요" + 다시 불러오기). **`policy_effective_at`이 없으면 "개인정보 처리방침을 준비하고 있어요"만 보임**(③ 전에는 사실이 아닌 문장이 공개되지 않게). 쉬운 설명이 맨 위, `#easy` 앵커 |
| `src/components/privacy-gate.tsx` (신규) | 전체 화면 창 3종(새 구글 / 기존 구글 / 코드 없는 확인·다시 확인). `Dialog`를 바깥 클릭·Esc로 닫히지 않게. 코드 칸은 숫자 6칸 |
| `src/hooks/use-session.tsx` | `fetchProfile`과 함께 `my_member_gate()`를 읽어 `gate` 노출(RPC가 없으면 `ok` — ① 전 안전). 창이 떠 있는 동안 탭 복귀·초점에서 다시 읽기 |
| `src/lib/privacy.ts` (신규) | RPC 래퍼, `POLICY_VERSION` 상수(시행일은 DB `policy_effective_at`), 별명 검사(서버와 같은 규칙), 오류 문구, `usePolicyEffective()`(기존 `use-login-lock.ts`와 같은 방식으로 `site_settings`를 읽음) |
| `src/app/layout.tsx` | `<PrivacyGate />`를 `ForcePasswordChangeGate` 옆에 |
| `src/components/site-footer.tsx` | "개인정보 처리방침" 링크(`policy_effective_at`이 있을 때만) |
| `src/app/login/login-form.tsx` | 구글 단추 아래 안내 한 줄 + "개인정보 처리방침 · 친구들을 위한 쉬운 설명" 링크(시행 뒤에만) |
| `src/components/force-password-change-gate.tsx` | 허용 경로에 `/privacy/` |
| `src/components/login-gate.tsx` | 변경 없음(`/privacy/`는 잠금 대상이 아님 — 주석·시험으로 확인) |
| `src/lib/community.ts` (`authorName`), `src/components/comment-section.tsx` | **작성자 폴백 "익명" → "회원"**(4.10 표). 사진이 없을 때 첫 글자 대체는 이미 있음 |
| `community-post-list.tsx`·`community-post-detail.tsx`·`community-comment-section.tsx` | 코드 변경은 위 `authorName()`으로 충분한지 확인(이름 `null` 처리·사진 `null` 처리). 비로그인 캡처로 확인 |
| `src/components/profile-dialog.tsx` | 구글 계정은 이메일 대신 "구글 계정으로 로그인 중이에요." |
| `src/components/user-menu.tsx` + `member-self-withdraw-dialog.tsx` (신규) | 구글 계정(총괄 제외)에 '회원 탈퇴' |

**관리자 화면**
| 파일 | 내용 |
|---|---|
| `src/app/admin/(dashboard)/privacy/page.tsx` + `privacy-settings.tsx` (신규), `admin-shell.tsx` | 총괄 전용 '개인정보 설정'(코드·문의 이메일·현황) + 메뉴 |
| `member-list.tsx`·`member-detail.tsx`·`member-badges.tsx` | '인증 전'·'30일 넘음'·'교사 · 내 학급 일만' 배지, 보호자 동의 열, 메뉴: 모든 권한 주기/줄이기, 동의서 받음 기록, **기록까지 삭제** |
| `role-change-dialog.tsx` + `admin_set_teacher_scope` 호출 | 권한 넓히기·줄이기 확인 창 |
| `member-create-dialog.tsx`, `src/lib/member-import.ts` | 보호자 동의 필수 체크(한 명/엑셀), 양식 내려받기 링크, `guardianConsent` 전송 |
| `class-card.tsx`·`class-controls.tsx` + `class-cleanup-dialog.tsx` (신규) | [학급 정리] + 진행 표시 |
| `admin-overview.tsx` | 총괄·담임: 학급 정리 기한 카드 |
| `src/hooks/use-admin-context.tsx`, `src/lib/classes.ts`, `src/lib/admin.ts` | `teacherScope`/`isFullAdmin`, 새 RPC 래퍼 |
| `praise-preset-manager.tsx`, `community-moderation.tsx`, 블로그 진입점 | 구글 선생님에게 편집·게임 관리 숨김/비활성 |
| `public/templates/guardian-consent.hwpx` (신규) | 보호자 동의서 양식(Claude가 `hwpx-school-newsletter` 스킬로 — `privacy-policy.md` 7절 문안) |

문구는 전부 `privacy-policy.md`의 원문이다. 화면 글과 원문이 같은지 Review가 대조한다.

---

## 7. 배포 순서 (사용자가 할 일을 단계별로)

0. **전제(별도 변경)**: 메인 에이전트가 과학 앱 공통 틀 `answer-check.js`(정본 + 23개 사본)가 `check-answer`를 더 부르지 않게 하는 작은 변경을 먼저 배포한다(AI 되짚기 끔, 로컬 무의미 규칙은 유지). 사용자는 Supabase Secrets에서 `GEMINI_API_KEY`를 지운다. **확인**: 23개 앱 폴더에서 `check-answer` 호출이 없음, 체험 모드에서 쓴 내용이 서버로 가지 않음. 처리방침의 "쓴 답은 구글로 가지 않는다"는 이 전제가 맞을 때만 사실이다 — 이 전제가 없으면 아래 6번 이후로 넘어가지 않는다.
1. **spec 승인** + 남은 질문(10.3) 확인.
2. Build·Review가 끝나고 Claude가 로컬 확인한 뒤 **사용자 확인**.
3. **SQL ①** — Supabase SQL Editor에서 `20261020000000_privacy_a_schema.sql` 전체 붙여넣고 Run → 파일 위 확인 쿼리(4.9). 오류가 나면 아무것도 바뀌지 않는다.
4. **Edge Function 3개 배포**(5절 명령).
5. **화면 push**(사용자 확인 후). Actions·두 사이트(GitHub Pages·Vercel) 확인. 이 시점의 사이트 동작은 지금과 같고 새 화면(개인정보 설정)만 생긴다. `/privacy/`는 "준비 중"만 보이고 처리방침 링크도 아직 안 보인다(`policy_effective_at` 없음). 로그아웃 화면의 작성자 폴백만 "회원"으로 바뀌어 있다(프로필이 아직 읽히므로 이름은 그대로 보임).
6. **총괄이 관리자 화면 '개인정보 설정'에서** 교사 인증 코드(6자리)와 문의 이메일을 입력한다(값은 채팅·저장소에 적지 않는다).
7. **SQL ②** — `20261020010000_privacy_b_enforce.sql` Run. 맨 앞 점검이 코드·이메일이 없으면 멈춘다 → 확인 쿼리(4.9 ②).
8. **SQL ③** — ② 확인 직후 **같은 자리에서 연달아** `20261020020000_privacy_c_profiles_members_only.sql` Run → 확인 쿼리(4.9 ③). 이 순간이 **처리방침 시행**이다(`/privacy/`와 링크가 나타남). ②와 ③ 사이에는 구글 로그인 시험을 하지 않는다(그사이 창의 처리방침 링크가 "준비 중"이라서).
9. **총괄이 먼저 로그인**해 3-1 창을 마친다(별명 정하기). 시험용 새 구글 계정으로 1절 창·코드·[가입하지 않기]를 확인(사용자 확인 — `oauth-delete`와 같은 방식). **로그아웃 상태**에서 학습게임 목록·글·댓글의 작성자가 "회원"으로 보이고 로그인하면 이름이 보이는지 확인.
10. 인디스쿨에 코드 공지(값은 사용자가 직접). 기존 구글 선생님이 2절 창으로 인증하거나 [가입하지 않기(계정 삭제)].
11. 문서 갱신: `CLAUDE.md`(함수 7개, SQL 목록 ①~③, 개인정보 규칙: 처리방침 문구는 사용자가 낱말까지 정함, 코드 값은 저장소 금지, `teacher_scope`, 프로필은 로그인한 회원만, AI 되짚기 끔), `docs/STATUS.md`.

**순서가 중요한 이유**: SQL ①(추가) → 함수·화면 → 코드 입력 → SQL ②(켜기) → SQL ③(프로필 좁힘 + 시행). ②를 화면보다 먼저 켜면 인증 전 계정이 창 없이 막힌다. ③을 "회원" 폴백보다 먼저 켜면 로그아웃 화면 작성자가 "익명"으로 보인다(깨지지는 않음). 되돌리기는 ③ → ② 순으로 따로 한다.

**사용자 할 일(시행을 막지 않음)**
- **부엉이반 학생의 보호자 동의서**(질문 8): 양식(`guardian-consent.hwpx`)을 내려받아 배부·수합하고, 받은 학생을 회원 목록의 "이 학급 모두 동의서 받음으로 기록"으로 표시한다. 시행 직후 수합 중에는 목록에 "기록 없음"이 보인다. 동의하지 않은 학생은 계정을 없애고(기록까지 삭제) 체험 모드로 참여하게 한다.
- **학교 개인정보 보호책임자와 확인**(질문 12): 교사 개인이 운영하는 사이트를 학급에서 쓸 때 필요한 절차가 있는지.
- **연락처**(질문 13): 총괄이 넣은 이메일이 처리방침의 문의·보호책임자 연락처다. 법 제30조 ① 제6호가 "전화번호 등 연락처"라고 하므로 나중에 전화번호를 더할지 사용자가 판단한다(더하면 `site_settings`에 열 하나 + 화면 한 줄).
- **확인 필요 모음**(`privacy-policy.md` 12절): Supabase 새 조직의 요금제·백업·로그 보관, 로그인 서비스에 남는 값, 침해 구제 기관 번호 재대조 등.
- **매년 3월**: 지난 학년도 학급을 '학급 정리'로 지운다(기한 3월 31일, 개요 카드에 표시).

---

## 8. 시험 계획

**화면(Review가 가짜 세션·가짜 응답으로 — CLAUDE.md 규칙)**: 실제 Supabase 주소는 첫 로드부터 막고(`--host-resolver-rules` + CDP `Fetch.enable`), 코드는 예시 `000000`만.

| 계정/상태 | 확인 |
|---|---|
| 새 구글(`need_code`, new) | 창이 뜨고 닫히지 않음, 체크·별명·6칸이 모두 차야 단추 활성, 틀린 코드 문구·남은 횟수, 잠금 문구, `busy`, 성공 뒤 창 닫힘·역할 반영, [가입하지 않기] 확인 창 → 함수 호출 → 로그아웃 |
| 기존 구글(`existing`) | 인디스쿨 문장이 보임, [나중에 할게요]는 로그아웃만, 새로 고침하면 다시 뜸, **[가입하지 않기(계정 삭제)]가 있고 확인 창에 "이 계정이 남긴 글·댓글·좋아요도 함께 지워져요"가 보임**, 누르면 함수 호출 → 로그아웃 |
| 구글 관리자(`need_ack`) | 코드 칸 없음, [나중에]로 닫힘(이 탭), 새로 고침하면 다시 뜸 |
| 판 번호가 오른 인증 선생님 | 별명 칸 없는 창 |
| 학생·아이디 교사 | 창 없음, `/privacy/` 열림, 비밀번호 강제 변경 중에도 열림 |
| 비로그인 | `/privacy/` 열림(잠금 스위치 켠 상태에서도), 문의 이메일 못 불러올 때 문구, `policy_effective_at`이 없으면 "준비 중"만 보이고 링크 없음 |
| **비로그인(③ 뒤, 프로필 `null` 응답)** | 학습게임 목록·상세·댓글, 홈 학습게임 미리보기, 블로그 댓글에서 작성자가 **"회원"**, 사진 자리는 첫 글자, 화면이 깨지거나 "익명"·빈칸이 아님 |
| 로그인한 학생(③ 뒤) | 같은 화면에서 작성자 이름이 보임, 자유게시판·내 학습 활동 변화 없음 |
| 총괄 | 개인정보 설정(코드 두 번 입력·6자리 검사·이메일 검사), 회원 목록 배지·30일 표시·보호자 동의 열, 권한 넓히기/줄이기, 회원 추가 체크(체크 안 하면 학생 줄 생성 불가), 학급 정리 진행·실패 재시도·이름 불일치 시 비활성 |
| 구글 선생님(`class`) | 게임 관리·칭찬 문구 편집·블로그 진입점이 꺼지거나 숨음, 회원 탈퇴가 학생 있을 때 막힘 문구 |
| 과학 앱 직접 열기(인증 전) | (선택안 A) 저장 거부 시 기존 오류 흐름, (B) 체험 모드 |

**전제 확인**: 23개 앱 사본과 정본에서 `check-answer` 호출이 없음(`grep`), 체험 모드 끝까지 진행해도 서버로 가는 요청이 설정 읽기뿐(가짜 서버 요청 목록).

**DB(사용자가 SQL Editor에서 — `docs/classes/spec.md`의 흉내 방식, 읽기만; 값 아닌 개수·참거짓)**: 인증 전 계정으로 각 표 INSERT/UPDATE가 `row-level security` 오류, 인증 전 계정의 `can_browse()`가 잠금 켠 상태에서 false, 구글 선생님(`class`)이 다른 학급 자료·게임 숨기기·블로그 쓰기·칭찬 문구 수정에서 거부, 같은 계정이 `create_class`·자기 학급 학생 기록은 가능, 학생 흉내가 `verify_google_teacher`에서 `not_applicable`, anon이 새 함수 호출 시 권한 오류, 시도 한도(6번 연속 틀림 → 잠금), 전체 한도(30번), `admin_set_teacher_scope`가 비총괄에서 거부, `purge_member_records`가 authenticated에서 호출 불가. **③**: anon `select count(*) from public.profiles` = 0(오류 없음), 로그인한 학생·교사는 전체, 인증 전 구글은 본인 1행, anon의 `community_posts` + `profiles!…` 붙인 요청이 행은 돌려주고 `profiles`만 `null`. **실제 구글 계정으로 하는 확인은 사용자 몫**으로 알린다(Claude는 실제 로그인·실 DB 쓰기를 하지 않음).

**Review에서 볼 것**(별도 서브에이전트 2명): (1) SQL·Edge Function 보안 — RESTRICTIVE 문법, 재귀(42P17), 오타 없는 `extensions.` 접두사, 예외가 아니라 결과를 돌려주는지, 서비스 롤 전용 함수의 권한 회수, `self_purge_member` 조건, `purge_member_records`와 `admin_purge_oauth_member` 목록 일치, 4.6 표 전수와 `pg_policies` 일치, 롤백 SQL. (2) 화면 — **비로그인 화면 전수(4.10 표) 캡처**, 창이 떠 있는 동안 서버 상태 반영, 모바일 뷰포트, 접근성(초점 가둠, 라벨), 문구가 원문과 같은지, 코드·이메일이 어디에도 기록·로그·URL에 남지 않는지.

---

## 9. 위험

| # | 위험 | 대비 |
|---|---|---|
| R1 | ~~Gemini 약관(18세 미만 앱 금지)~~ | **해결 — "AI 되짚기 끔(별도 변경)"**: 앱 공통 틀이 `check-answer`를 부르지 않고 Secret을 해제한다. 처리방침·동의서에서 AI 문단을 모두 뺐다. 전제가 배포되지 않으면 7절 0번에서 멈춘다 |
| R2 | ~~학생 표시 이름=아이디(번호)가 비로그인에게 공개~~ | **해결 — SQL ③**(4.10). 남는 위험: 로그인한 모든 회원이 서로의 표시 이름을 읽음(N1), 로그아웃 화면에 "회원" 폴백이 빠진 곳이 있으면 이름이 빈칸으로 보임(Review가 비로그인 캡처로 확인) |
| R3 | 인증 코드 무작위 대입 / 방해 | 계정당+전체 한도(4.3), 총괄 화면에 시도 수, 의심되면 코드 교체. 방해 가능성은 인지 |
| R4 | 코드가 인디스쿨에 공개되면 학생·외부인도 구글로 선생님이 될 수 있음 | 코드 교체 + '인증 전'·권한 범위(자기 학급 일만) 제한. 선생님이 되어도 다른 학급 학습 기록·학습게임 관리는 못 함. 단 **학생 계정을 만들고 자기 학급 게시판·선생님 글을 쓸 수는 있음**(스팸 가능) — 총괄이 '완전 삭제'로 대응 |
| R5 | 총괄 자신이 창 때문에 갇힘 | 3.6: 코드 없음 + [나중에] 허용 + 서버는 총괄을 막지 않음. ② 실행 직전 점검 |
| R6 | ② 실행 중 오류·정책 누락으로 권한이 소리 없이 넓어짐 | 맨 끝 점검(허용 정책 목록 대조), 롤백 SQL, 흉내 시험 |
| R7 | 옛 마이그레이션 재실행으로 4.6 정책이 되살아남 | ② 파일 머리말·CLAUDE.md에 명시(`classes_rls` 때와 같음) |
| R8 | 운영자는 Supabase 대시보드에서 기술적으로 모든 자료를 볼 수 있음(사이트 규칙은 담임만) | 처리방침 제7조에 사실대로 적음 |
| R9 | 학급 정리가 자동이 아니라 늦어질 수 있음 | 개요 기한 카드(4.7-3). 자동 삭제는 사용자 결정 9에 따라 만들지 않음 |
| R10 | 가린 이메일/비운 사진은 되돌릴 수 없음 | 사용자 결정 12·10. auth에는 남아 있어 복구 불가능은 아님 |
| R11 | 인증 전 새 계정이 쌓임(그냥 떠난 경우) | 총괄 화면 30일 표시 + 수동 삭제. 자동화는 질문 6 |
| R12 | `purge_member_records`와 `admin_purge_oauth_member` 목록이 어긋남 | Review 대조 + 주석 |
| R13 | 학급 정리 도중 Edge Function 시간 초과 | 20명씩 끊어 반복(멱등), 실패 재시도 |
| R14 | 선택안 A에서 인증 전 계정이 앱 주소를 직접 열면 저장 오류 문구가 이상함 | 질문 외 사소 — 묶음 5로 개선 가능 |
| R15 | 전화번호 없는 연락처(이메일만)가 법 제30조 ①6호 "전화번호 등 연락처"에 맞는지 | 사용자 할 일(7절) — 나중에 전화번호 추가를 고려 |
| R16 | ② 실행과 ③ 실행 사이에 창의 처리방침 링크가 "준비 중"이고 프로필이 아직 공개 | ②·③을 같은 자리에서 연달아. 그 사이 구글 로그인 시험 금지 |
| R17 | ③ 뒤 로그아웃 방문자 화면에서 작성자가 모두 "회원"이 되어 학습게임 소개 느낌이 줄어듦 | 의도된 결과(사용자 결정). 마음에 안 들면 `rollback-profiles-members-only.sql` |
| R18 | AI 끔 변경이 늦게 배포되면 처리방침이 사실과 다름 | 7절 0번 전제 확인 후에만 시행 |

---

## 10. 사용자 결정과 남은 질문

### 10.1 질문에 대한 사용자 답 (2026-10-20)
1.1-2 표와 같다. 요약: 1 AI 끔 · 2 해당 없음 · 3 예 · 4 예 · 5 예(기존 회원도 계정 삭제) · 6 자동 삭제 없음 · 7 예 · 8 사용자 할 일 · 9 **B(프로필 로그인한 회원만, 이번 작업에 포함)** · 10 그대로 · 11 인원수만 · 12 사용자 할 일 · 13 이메일 연락처(전화번호는 나중에 고려).

### 10.2 이름표 (DB·함수·화면이 같은 이름)
4.1·4.2 표 그대로. 새 SQL 파일 `20261020000000_privacy_a_schema.sql`·`20261020010000_privacy_b_enforce.sql`·`20261020020000_privacy_c_profiles_members_only.sql`, 롤백 `docs/privacy/rollback-privacy-enforce.sql`·`docs/privacy/rollback-profiles-members-only.sql`, 함수 `member-self-delete`·`admin-clear-students`, 화면 주소 `/privacy/`·`/admin/privacy/`, 파일 `public/templates/guardian-consent.hwpx`, 새 열 `site_settings.policy_effective_at`.

### 10.3 새로 생긴 질문 (막지 않음 — 추천 먼저)
| # | 질문 | 추천 |
|---|---|---|
| N1 | 프로필 읽기 범위: (A) 로그인한 모든 회원(지금 제안) (B) 같은 학급·같은 게시판 참여자·교사까지만 | A로 시행하고 처리방침에 사실대로 적는다("다른 반 친구도 볼 수 있어요"). B는 별도 작업 — 모든 이름 표시 화면(게시판·피드백·학습게임)을 학급 기준으로 다시 짜야 한다 |
| N2 | 학생 표시 이름의 기본값이 아이디(번호)인 것: 새 계정부터 "학생" 같은 중립 값으로 시작하고 별명 입력을 안내할까 | 지금은 쉬운 설명의 안내 문구로 충분. 기본값 변경은 나중에 |
| N3 | 시행 순서: ②와 ③을 같은 자리에서 연달아 실행하고, 그 순간을 처리방침 시행일로 삼아도 되나 | 예 (7절 8번) |

---

## 11. 작업 묶음 제안 (Build를 몇 묶음으로)

CLAUDE.md의 사이클(Plan → 승인 → Build → 별도 Review → 수정 → 커밋 → 사용자 확인 후 push). 아래 이름표를 계약으로 두면 1·2와 3·4를 동시에 할 수 있다(고치는 파일이 겹치지 않음). 브라우저 시험 담당은 5명 안팎. **전제**: AI 되짚기 끔 변경은 이 묶음들과 별개로 메인 에이전트가 먼저 배포한다.

| 묶음 | 담당 | 내용 | 비고 |
|---|---|---|---|
| **1** | Build A | SQL ①·②·③ + 롤백 SQL 2개 + 흉내 시험용 확인 쿼리 모음 | 정책·함수 표(4.6)와 4.10이 핵심. 실 DB에 쓰지 않음 |
| **2** | Build B | Edge Function 3개 + `config.toml` + README | 묶음 1의 함수 이름 사용. 서비스 롤 키 비출력 |
| **3** | Build C | 공개 화면: `/privacy/`(시행 전 "준비 중"), 확인 창(`PrivacyGate`), `use-session`, 바닥·로그인 링크, 내 정보·회원 탈퇴, **로그아웃 화면 작성자 폴백 "회원"(4.10 표)** | 원문 `privacy-policy.md` 그대로 |
| **4** | Build D | 관리자 화면: 개인정보 설정, 회원 목록/상세 확장, 회원 추가 체크, 학급 정리·기록까지 삭제, 기한 카드, 권한 숨김 | 3·4가 `use-admin-context`를 함께 고치지 않게 4가 담당 |
| **5(선택)** | Build E | 과학 앱 `class1-record.js` 정본 + 23개 사본 `pending` → 체험 모드 | 3.9 선택안 B. 별도 AI 끔 변경(`answer-check.js`)과 같은 사본을 만지므로 순서·충돌을 메인 에이전트가 조정 |
| **6** | Claude(메인) | `guardian-consent.hwpx`(스킬), `CLAUDE.md`·`STATUS.md` 갱신, 비교 사진, 사용자 안내서(`docs/privacy/deploy/README.md` — SQL 실행·함수 배포·총괄 설정 순서) | 사용자 승인 필요 |
| Review | 별도 2명 | (1) 묶음 1·2 보안 (2) 묶음 3·4 화면(비로그인 화면 전수 캡처 포함) — 각각 `review-*.md` | 코드를 고치지 않고 보고만 |

규모 어림: 새 파일 약 25개, 고칠 파일 약 22개, SQL 세 파일 합쳐 1,700줄 안팎(`teacher_boards`가 1,283줄).

---

**사용자 승인 전**
