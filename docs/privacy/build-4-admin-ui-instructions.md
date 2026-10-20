# 묶음 4 지침 — 관리자 화면 (구현 담당 D)

먼저 `docs/privacy/build-common.md`를 읽는다. Chrome 포트 9482, 스크래치 `privacy-b4/`.

## 만들·고칠 파일(이것만)
- 신규 `src/data/privacy-admin-text.ts` — `privacy-policy.md` 8절(관리자 화면 글) 상수, **원문 글자 그대로**.
- 신규 `src/lib/admin-privacy.ts` — 총괄·담임용 RPC 래퍼(`admin_set_teacher_code`·`admin_set_contact_email`·`admin_privacy_overview`·`admin_member_privacy_flags`·`admin_set_teacher_scope`·`admin_class_cleanup_preview`·`admin_class_retention_status`·`admin_set_guardian_consent`·`admin_set_guardian_consent_class`)와 Edge Function `admin-clear-students` 호출(20명씩 반복, 진행 표시). RPC가 없을 때(SQL ① 전) 화면이 깨지지 않고 "준비 전" 한 줄.
- 신규 `src/app/admin/(dashboard)/privacy/page.tsx` + `privacy-settings.tsx`(8-7절, **총괄 전용**), `src/components/admin/admin-shell.tsx`(메뉴).
- 회원 관리: `member-list.tsx`·`member-detail.tsx`·`member-badges.tsx`(8-2·8-3절 — '인증 전'·'30일 넘음'·'교사 · 내 학급 일만'·보호자 동의 열, [모든 권한 주기]/[내 학급 일만으로 줄이기], [동의서 받음으로 기록]·일괄, **[기록까지 삭제]** 8-5절), 권한 변경 확인 창.
- 회원 추가: `src/components/admin/member-create-dialog.tsx`, `src/lib/member-import.ts`(8-1절 필수 체크 — 학생 역할일 때만, 한 명·엑셀, `guardianConsent` 전송, [보호자 동의서 양식 내려받기(한글 파일)] = `withBasePath("/templates/guardian-consent.hwpx")` — 파일은 메인 에이전트가 만든다).
- 학급: `class-card.tsx`·`class-controls.tsx` + 신규 `class-cleanup-dialog.tsx`(8-4절, 학급 이름 입력 확인·미리보기 인원수·진행·실패 재시도·학생 0이면 비활성), 개요 화면의 학급 정리 기한 카드(spec 4.7-3, 담임은 자기 학급·총괄은 전체).
- `src/hooks/use-admin-context.tsx`(`teacherScope`/`isFullAdmin` — `my_admin_context().teacher_scope`, 없으면 `full`), `src/lib/classes.ts`·`src/lib/admin.ts`(필요한 만큼).
- "자기 학급 일만" 선생님에게 숨김/비활성: `praise-preset-manager.tsx`(편집), `community-moderation.tsx`(학습게임 관리·신고), 블로그 쓰기 진입점(서버가 어차피 거부 — 안내 한 줄).
- 보고서 `docs/privacy/build-4-report.md`.
- **고치지 않는 것**: `src/hooks/use-session.tsx`·`src/lib/privacy.ts`·`src/data/privacy-policy.ts`(묶음 3). 필요하면 읽기만(import).

## 시험(가짜 응답 — build-common 방식)
- 총괄: 개인정보 설정(코드 두 번 입력·6자리 검사·이메일 검사·현황), 회원 목록 배지·30일·보호자 동의 열, 권한 넓히기/줄이기, 회원 추가(학생 역할에서 체크 안 하면 만들기 불가 — 한 명·엑셀), 학급 정리(이름 불일치 비활성·진행·일부 실패 재시도), 기록까지 삭제, 기한 카드.
- 담임(`full`)·구글 선생님(`class`): 숨김/비활성이 맞는지, 자기 학급 일은 그대로.
- 1024×768·390×844, 키보드, 위험 버튼은 `src/lib/danger-button.ts`.
- 화면 글이 8절 원문과 같은지 기계적 대조 결과를 보고서에.
- 사진(showcase): 개인정보 설정, 회원 추가 보호자 동의 체크, 회원 목록 표시, 학급 정리 창.
