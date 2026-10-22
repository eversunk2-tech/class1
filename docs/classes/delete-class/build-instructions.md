# 학급 삭제 — 구현 지침 (구현 담당, 2026-10-22)

기준: `docs/classes/delete-class/spec.md`(사용자 승인 — 권한 = 그 학급 담임과 총괄, 과제·선생님 글은 학급과 함께 지우기, 화면 글 그대로), 화면 글 원문 `docs/privacy/privacy-policy.md` **8-9**(글자 그대로 옮긴다). `CLAUDE.md`(정적 export·SQL 적용 절차·디자인/접근성·서브에이전트 규칙)와 `AGENTS.md`(이 Next.js는 학습 데이터와 다름 — 모르는 API는 `node_modules/next/dist/docs/` 확인)를 따른다.

## 절대 원칙
- git commit/push 금지, **실제 Supabase에 아무 요청도 하지 않음**(공개 키 읽기 포함 — 메인 에이전트가 함), 내려받기·설치 금지, 개인정보·교사 인증 코드 값을 쓰지 않음.
- 이미 실행한 마이그레이션은 고치지 않는다 — **새 파일만**.
- 스크래치 `/private/tmp/claude-501/-Users-sungchul-Desktop-classroom/7bf3a39e-3017-4189-b337-1b82aace66bb/scratchpad/class-delete/`. 개발 서버 `http://localhost:3000/class1/`는 메인 에이전트가 띄워 둔다(`next dev`·`next build` 직접 실행 금지). 전용 headless Chrome 포트 **9485**, 실제 Supabase는 첫 로드부터 막고(`--host-resolver-rules` + CDP `Fetch.enable`) 가짜 세션·가짜 응답만, `Network.setCacheDisabled`, `localStorage.clear()` 금지. 시험 도구는 `…/scratchpad/privacy-b4/`·`privacy-b6/`에서 복사해 써도 된다(원본은 고치지 않음). 한 명령이 10분 넘게 조용하면 끊기니 짧게 나눠 돌린다. 끝나면 Chrome을 끄고 프로필을 지운다.

## 만들 것
1. **새 SQL** `supabase/migrations/20261022000000_class_delete.sql` — spec 1번 그대로:
   - `public.admin_class_delete_preview(p_class_id uuid) → jsonb` `{ class_name, students, assignments, notices }`
   - `public.admin_delete_class(p_class_id uuid, p_confirm_name text) → jsonb` `{ ok: true, assignments, notices }`
   - 권한: 로그인 + `is_admin()` + (그 학급 `class_teachers`에 호출자가 있음 **또는** `is_super_admin()`). 학급 정리 미리보기(`admin_class_cleanup_preview` — `20261020000000_privacy_a_schema.sql`)의 권한 확인 방식을 따른다.
   - 학생 수 = `profiles.class_id = 학급`인 줄 전부(role user, 탈퇴 처리 포함). 1명이라도 있으면 거부. 학급 이름은 앞뒤 공백을 뺀 값이 같아야 함. 같은 학급 동시 삭제는 `pg_advisory_xact_lock`이나 `for update`로 한 줄로.
   - 순서: 그 학급 `assignments` 삭제(제출물 cascade) → `classes` 삭제(`class_teachers`·`class_notices` cascade). 지운 과제·선생님 글 수를 돌려준다.
   - 오류 문구는 원문 8-9 그대로(학생이 남음 — `{n}` 채움, 권한 없음, 이름 다름). 학급이 없으면 기존 문구 "학급을 찾을 수 없습니다."
   - `security definer`·`set search_path = ''`·스키마 붙인 이름, `revoke all … from public, anon, authenticated` 뒤 `grant execute … to authenticated`. 재실행 안전, 파일 머리에 실행 방법·확인 쿼리(읽기 전용), 맨 끝 자체 점검(함수 두 개가 있고 anon 실행 권한이 없는지).
   - **새 외래키를 만들지 않는다**(CLAUDE.md — profiles embed PGRST201).
2. **화면**:
   - `src/lib/classes.ts`(또는 `src/lib/admin-privacy.ts`) — 두 RPC 래퍼. RPC가 없으면(SQL 전, `isMissingSchemaError`) 학급 삭제 기능을 숨긴다(오류 화면 없음).
   - `src/components/admin/class-card.tsx` — 학급마다 [학급 정리] 옆 [학급 삭제](위험 동작이라 학급 정리와 같은 모양·색 규칙). 학생 수(`studentCount`)가 0이 아니면 꺼지고 원문 설명이 보이게(마우스·화면 낭독·터치에서도 읽을 수 있게 — 꺼진 단추 옆 글 또는 상세 설명).
   - 새 `src/components/admin/class-delete-dialog.tsx` — 열 때 미리보기로 과제·선생님 글 수, 학급 이름 입력이 같아야 빨간 단추가 켜짐(`src/lib/danger-button.ts`), 처리 중 닫히지 않음, 끝나면 원문 알림 + 학급 목록에서 그 학급을 뺀다(`ctx.patchClasses` 등 기존 방식), 서버 오류 문구는 그대로 보인다.
   - `src/components/admin/class-cleanup-dialog.tsx` — 학급 정리가 끝나 학생이 0명이 된 상태의 창에 [이어서 학급 삭제] → 학급 삭제 창으로.
   - 학급 삭제 뒤 회원 목록·개요 등 학급 이름을 쓰는 화면이 깨지지 않게(지워진 학급 id를 가진 줄이 없어야 정상 — 학생 0명이니까).
   - 화면 글은 `src/data/privacy-admin-text.ts`에 원문 8-9 상수로(글자 그대로).
3. 보고서 `docs/classes/delete-class/build-report.md`(한국어, 간결): 만든 것, 계약과 다른 곳, 원문에 없는 새 문장(전부), 시험 결과(명령·숫자), 사진 경로, 확인하지 못한 것.

## 시험(가짜 응답)
- 담임(자기 학급 학생 0) — 단추 켜짐 → 미리보기 과제 2·선생님 글 1 → 이름 다르면 꺼짐 → 맞으면 RPC 인자 확인 → 목록에서 빠짐·알림.
- 학생이 남은 학급 — 단추 꺼짐·설명, (억지로 부른 경우) 서버 거부 문구 그대로.
- 학급 정리 창 끝 → [이어서 학급 삭제].
- 총괄(다른 담임의 빈 학급) — 켜짐. 담임이 아닌 교사 — 서버 거부 문구.
- RPC 없음(SQL 전) — 단추 없음, 나머지 화면 그대로.
- 1024×768·390×844, 키보드(Tab·Enter·Esc·초점), 밝음·어두움 대비, `npx tsc --noEmit -p tsconfig.json`·`npm run lint` 0.
- SQL은 실행해 보지 못하므로 읽어서 대조(권한·순서·잠금·문구·재실행).
- 사진(`…/class-delete/showcase/`, ASCII 이름): 학급 카드 단추(학생 있음·없음), 삭제 확인 창(1024·390), 학급 정리 끝 창의 [이어서 학급 삭제].
