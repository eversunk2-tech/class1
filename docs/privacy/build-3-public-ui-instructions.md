# 묶음 3 지침 — 공개 화면 (구현 담당 C)

먼저 `docs/privacy/build-common.md`를 읽는다. Chrome 포트 9481, 스크래치 `privacy-b3/`.

## 만들·고칠 파일(이것만)
- 신규 `src/data/privacy-policy.ts` — `privacy-policy.md` 1~7절 글(처리방침 전체·쉬운 설명·창 문구·4절 짧은 글)의 상수. **원문 글자 그대로.** 8절(관리자 글)은 묶음 4가 따로 둔다.
- 신규 `src/lib/privacy.ts` — RPC 래퍼(`my_member_gate`·`verify_google_teacher`·`acknowledge_privacy`), `POLICY_VERSION`, 별명 검사(서버와 같은 규칙 — spec 4.3-6), 오류 문구 연결, Edge Function `member-self-delete` 호출. RPC가 없을 때(SQL ① 전) `ok`로 떨어져 지금 사이트가 그대로 동작해야 한다.
- 신규 `src/app/privacy/page.tsx`(+ 필요하면 `privacy-view.tsx`) — `/privacy/`(로그인 없이, 잠금 스위치와 상관없이). `site_settings`에서 `contact_email`·`privacy_version`·`policy_effective_at`(없으면 "개인정보 처리방침을 준비하고 있어요"만 보이고 링크도 숨김 — spec 개정 1), 쉬운 설명이 맨 위(`#easy`).
- 신규 `src/components/privacy-gate.tsx` — 전체 화면 창 3종(1절 새 가입 / 2절 기존 회원 / 3-1·3-2 코드 없는 확인), 4절 짧은 글, 4-1 확인 창. 바깥 클릭·Esc로 닫히지 않음(3-1·3-2는 [나중에]로 이 탭에서만 닫힘). 초점 가둠·라벨·44px·대비 AA·움직임 줄이기.
- `src/hooks/use-session.tsx` — `my_member_gate()`를 함께 읽어 `gate` 노출, 창이 떠 있는 동안 `visibilitychange`·`focus`에서 다시 읽기(spec 3.5).
- `src/app/layout.tsx`(`<PrivacyGate />`), `src/components/site-footer.tsx`(처리방침 링크 — 시행 전에는 숨김), `src/app/login/login-form.tsx`(구글 단추 아래 안내 한 줄 + 처리방침·쉬운 설명 링크 — 원문 문장), `src/components/force-password-change-gate.tsx`(허용 경로 `/privacy/`), `src/components/profile-dialog.tsx`(구글 계정은 이메일 대신 "구글 계정으로 로그인 중이에요."), `src/components/user-menu.tsx` + 신규 `src/components/member-self-withdraw-dialog.tsx`(8-6절 — 구글 계정, 총괄 제외).
- 프로필 읽기 제한(SQL ③) 대비: `src/lib/community.ts`의 `authorName` 폴백과 `src/components/comment-section.tsx`의 폴백 "익명" → **"회원"**, 그리고 spec 4.10 표의 로그아웃 화면들이 `profiles`가 `null`이어도 깨지지 않는지.
- 보고서 `docs/privacy/build-3-report.md`.

## 시험(가짜 응답 — build-common 방식)
- 상태별: 새 구글(`need_code`, new) / 기존 구글(existing — 인디스쿨 문장·[나중에 할게요(로그아웃)]·[가입하지 않기(계정 삭제)]) / 구글 관리자(`need_ack`) / 판 번호 오름 / 학생·아이디 교사(창 없음) / 비로그인(`/privacy/` 열림, 시행 전 "준비 중", 문의 이메일 못 받을 때 문구) / 강제 비밀번호 변경 중 `/privacy/`.
- 창: 체크·별명·6칸이 모두 차야 단추 활성, 틀린 코드(남은 횟수)·잠금·`busy`·`not_configured`·성공(창 닫힘, 프로필 다시 읽기), 다른 탭에서 인증 마침(`already`).
- 로그아웃 방문자 화면(학습게임 목록·상세·댓글, 블로그 댓글)에서 글쓴이 `profiles: null` → "회원".
- 1024×768·768×1024·390×844, 키보드만으로 창 조작, 다크 모드 대비.
- 화면 글이 원문과 같은지: `privacy-policy.md` 1~7절 문장과 `privacy-policy.ts` 상수를 기계적으로 대조하는 작은 검사(스크래치에)를 돌려 결과를 보고서에.
- 사진(showcase): 새 가입 창, 기존 회원 창, 처리방침 페이지 위쪽(쉬운 설명), 휴대폰 창, 로그인 화면 링크.
