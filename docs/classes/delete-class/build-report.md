# 학급 삭제 — 구현 보고 (2026-10-22, 구현 담당)

기준: `spec.md`(사용자 승인), 화면 글 `docs/privacy/privacy-policy.md` 8-9, `build-instructions.md`. git commit/push·실제 Supabase 요청·내려받기 없음(아래 '확인하지 못한 것'의 prettier 한 줄 참고).

## 1. 만든 것

| 파일 | 내용 |
|---|---|
| `supabase/migrations/20261022000000_class_delete.sql` (새) | `admin_class_delete_preview(uuid)` → `{class_name, students, assignments, notices}` · `admin_delete_class(uuid, text)` → `{ok, assignments, notices}`. 둘 다 `security definer` · `search_path ''` · `revoke … from public, anon, authenticated` 뒤 `authenticated`만. 새 외래키·정책 없음, 기존 함수 고치지 않음. 머리말에 실행 방법·읽기 전용 확인 쿼리 4개·되돌리기, 맨 앞 점검(앞선 표·열·함수), 맨 끝 점검(함수 2개·security definer·anon 실행 불가·authenticated 실행 가능·삭제를 막는 외래키 없음). |
| `src/lib/classes.ts` | RPC 래퍼 `fetchClassDeletePreview` · `deleteClass` · `ClassDeleteMissingError`, 함수 유무 저장소 `probeClassDelete`·`subscribeClassDelete`·`classDeleteAvailable`·`markClassDeleteMissing`. |
| `src/components/admin/class-delete-dialog.tsx` (새) | 확인 창 `ClassDeleteDialog` + `useClassDeleteAvailable()`. 미리보기 → 과제·선생님 글 수, 학생이 남으면(탈퇴 처리 포함) 원문 거부 문구를 미리 보이고 단추 끔, 이름이 같아야 빨간 단추(`dangerSolidClass`), 처리 중 닫히지 않음, 끝나면 원문 알림 + `ctx.patchClasses`로 목록에서 빼고 `ctx.refresh()`, 서버 문구 그대로. |
| `src/components/admin/class-card.tsx` | [학급 정리] 옆 [학급 삭제](같은 ghost·빨간 글자). 학생이 있으면 꺼짐(`focusableWhenDisabled` → `aria-disabled`, Tab으로 초점이 가고 `aria-describedby`로 설명을 읽음) + 줄 아래 원문 설명. SQL 전이면 단추·설명 없음. 지운 뒤 초점은 '학급 개설' 단추. |
| `src/components/admin/class-cleanup-dialog.tsx` | 학생이 0명인 상태(정리를 마침 / 처음부터 없음)에 [이어서 학급 삭제] → 이 창을 닫고 학급 삭제 창을 연다(이 컴포넌트가 함께 그림, 새 prop `onDeleted`·`finalFocusRef`). |
| `src/components/admin/class-controls.tsx` | 학급 정리 기한 카드: 확인 창을 늘 같은 자리에 둔다(아래 2-⑥). |
| `src/hooks/use-admin-context.tsx` | `patchClasses`: 내 학급 목록에서 빠진 학급을 `visibleClasses`·`teacherClasses`에서도 뺀다(다시 읽기 전 회원 관리 학급 필터에 남지 않게). |
| `src/data/privacy-admin-text.ts` | `PRIVACY_ADMIN_TEXT.classDelete`(원문 8-9 글자 그대로 12개 — 대조 스크립트 12/12 일치) + 새 문장 2개(`PRIVACY_ADMIN_EXTRA_TEXT`). |

## 2. 계약·지침과 다르거나 Claude가 정한 것

1. **확인 순서**: 두 함수 모두 ① 로그인 교사(`is_admin`) → ② 학급 있음(삭제는 이때 `for update` 잠금) → ③ 담임(`my_class_ids()`) 또는 총괄 → (삭제만) ④ 이름 → ⑤ 학생 수. 학급 정리 미리보기는 권한을 먼저 보지만, 다른 창에서 이미 지운 학급에 "권한 없음" 대신 "학급을 찾을 수 없습니다."가 나오게 ②를 앞에 두었다(학급 id 있음/없음이 교사에게만 드러남 — uuid라 영향 없다고 봄).
2. **교사가 아닌 사람(②의 앞)에게도 원문 권한 문구**를 쓴다(학급 정리 미리보기는 '관리자만 사용할 수 있습니다.'). 화면에서는 생기지 않는 경우.
3. **학생 수 = `profiles.class_id` = 학급이고 role 'user'**(탈퇴 처리 포함 — 학급 정리 미리보기와 같은 기준). 드물게 `class_id`가 남은 교사(role admin) 줄은 세지 않는다 — 학급을 지우면 외래키가 `null`로 만든다. (교사 줄까지 세면 학급 정리로 지울 수 없어 영영 막힌다.)
4. **이름 비교**: 서버는 `privacy_btrim`(개인정보 ① 도우미 — JS `trim()`과 같은 글자)으로 양쪽 앞뒤 공백을 빼고 비교, 빈 값은 거부. 화면도 `trim()` 비교 후 `trim()`한 값을 보낸다.
5. **동시 실행**: `for update`로 학급 줄을 잠근다. 학생 등록·과제·선생님 글을 넣을 때의 외래키 확인(`FOR KEY SHARE`)과 부딪혀 한 줄로 서므로, 지우는 동안 새로 붙는 것은 학급이 사라진 뒤 그쪽이 실패하고, 먼저 붙은 것은 잠금 뒤 학생 수 확인(READ COMMITTED — 문장마다 새 스냅숏)에서 걸린다. 같은 학급 두 번째 삭제는 '학급을 찾을 수 없습니다.'.
6. **기존 문제 고침(학급 정리 기한 카드)**: 기한 카드의 [학급 정리 열기]로 정리를 마치면 카드가 다시 읽기 뒤 `null`을 돌려 **확인 창이 바로 사라졌다**(옛 `class-controls.tsx`로 되돌려 재현: 정리 직후 창 글자 `""`). 총괄이 다른 담임 학급을 정리하고 [이어서 학급 삭제]로 가는 유일한 길이라 `<>{내용}{창}</>`으로 창을 늘 같은 자리에 두었다.
7. **카드 단추 상태 기준**: 카드의 `studentCount`(my_admin_context)는 탈퇴 처리된 학생을 세지 않는다 → 탈퇴 처리 학생만 남은 학급은 카드 단추가 켜지고, 창의 미리보기(탈퇴 포함)가 원문 "학생 계정이 {n}명 남아 있어요. …"로 막는다(새 문장 없음).
8. **SQL 전 숨기기**: 카드가 처음 그려질 때 내 학급 하나로 `admin_class_delete_preview`를 한 번 불러 본다(페이지당 1번, 결과는 버림). 함수 없음(PGRST202 등)이면 [학급 삭제]·설명·[이어서 학급 삭제]를 숨기고, 다른 오류(연결 등)면 보인 뒤 창이 오류를 알린다. 알아내는 동안은 숨김.
9. **학급 정리 창**: [이어서 학급 삭제]는 '정리했어요' 상태와 처음부터 '지울 학생이 없어요.' 상태 모두에 둔다. 후자에서는 쓸 수 없는 빨간 [학급 정리하기]를 숨긴다(SQL 전이면 예전처럼 꺼진 채 보임). 단추 모양은 기한 카드 [학급 정리 열기]와 같은 outline + 빨간 글자.
10. **카드 줄 배치**: 단추가 셋이 되자 1024 태블릿(관리자 화면 폭 약 480px)에서 학급 이름 칸이 0px로 눌려 보이지 않았다 → 이름 칸 최소 너비 8rem, 단추 묶음은 오른쪽 정렬로 다음 줄에 내려간다. **1024·390에서는 [이름 바꾸기]·[학급 정리]도 이름 아래 줄로 내려간다(전에는 한 줄)**. 1440은 한 줄 그대로.
11. **총괄이 다른 담임 학급을 지우는 길**: 카드는 '내 학급'만 보이므로(기존 설계) 총괄은 기한 카드 → 정리 → [이어서 학급 삭제]로만 지울 수 있다. 정리를 마치고 창을 닫은 다른 담임의 빈 학급은 총괄 화면에서 다시 열 곳이 없다(서버는 총괄 허용). 보관된 학급(`archived_at`)도 카드에 없어 화면에서 지울 수 없다. 필요하면 후속으로 정한다.
12. **초점**: 카드에서 지운 뒤 → '학급 개설' 단추. [이어서 학급 삭제]로 연 창을 취소하면 → 그 학급의 [학급 정리] 단추(시험으로 확인). 기한 카드 흐름에서 지운 뒤에는 Base UI 기본값.
13. 새 창을 열 때 초점은 Base UI 기본값(미리보기를 읽는 동안 첫 단추 [취소] — 학급 정리 창과 같음).

## 3. 원문(8-9)에 없는 새 문장 — 문장 그대로

화면에 보이는 것:
- `학급 정보를 불러오지 못했습니다.` — 삭제 창의 미리보기(과제·선생님 글 수)를 읽지 못했을 때(+ 기존 단추 `다시 시도`).
- `학급 삭제 기능용 DB 설정이 아직 적용되지 않았습니다. Supabase SQL Editor에서 20261022000000_class_delete.sql을 실행해 주세요.` — 단추가 보인 뒤 함수가 사라진 드문 경우(SQL 되돌림 등). 이때 단추도 숨긴다.

기존 문장을 다시 쓴 것(새로 만들지 않음): `지우지 못했습니다. 잠시 후 다시 시도해 주세요.`(삭제 실패 기본 — 학급 정리와 같은 `EXTRA.clearFailed`), `학급을 찾을 수 없습니다.`(기존 SQL 문구 — 지침대로), 단추 `다시 시도`·`닫기`(학급 정리 창과 같은 글자).

화면 낭독 전용: 단추 `aria-label` `{학급 이름} 학급 삭제`(기존 `{학급 이름} 학급 정리`와 같은 방식), 창이 읽는 중·막혔을 때 숨은 설명 `학급 삭제`(원문 단추 이름).

SQL Editor에서만 보이는 것(`20261022000000_class_delete.sql` 점검):
- `앞선 마이그레이션(학급 20260927000000·20260927020000·20260927040000, 개인정보 ① 20261020000000_privacy_a_schema.sql)이 먼저 실행돼 있어야 합니다. 이 파일은 아무것도 바꾸지 않았습니다.`
- `학급 삭제 함수 2개가 만들어지지 않았습니다. 이 파일 전체를 되돌렸습니다(아무것도 바뀌지 않음) — 이 메시지를 알려 주세요.`
- `학급 삭제 함수가 security definer 가 아닙니다. 이 파일 전체를 되돌렸습니다(아무것도 바뀌지 않음) — 이 메시지를 알려 주세요.`
- `학급 삭제 함수의 실행 권한이 설계와 다릅니다: %. 이 파일 전체를 되돌렸습니다(아무것도 바뀌지 않음) — 이 메시지를 알려 주세요.`
- `학급 삭제를 막는 외래키가 있습니다: %. 이 파일 전체를 되돌렸습니다(아무것도 바뀌지 않음) — 이 메시지를 알려 주세요.`
- 성공 알림 `✔ 학급 삭제 함수 2개(admin_class_delete_preview · admin_delete_class)를 만들었습니다 — 로그인한 선생님만, 그 학급 담임 또는 총괄. 다음: 확인 쿼리 1)·2) → 사이트 push.`

서버가 화면에 보내는 거부 문구 3개는 원문 8-9 그대로(`학생 계정이 %명 …` · `이 학급의 담임 선생님이나 총괄 선생님만 …` · `학급 이름이 맞지 않아요. …`).

## 4. 시험 (가짜 응답만 — 전용 headless Chrome 포트 9485, `--host-resolver-rules`로 `*.supabase.co` 막음 + CDP `Fetch.enable` 가짜 응답, 캐시 끔)

- `npx tsc --noEmit -p tsconfig.json` 0 · `npm run lint` 0.
- 화면 시험(스크래치 `…/scratchpad/class-delete/`, `node <파일>`) — **108/108 통과**:
  - `t1-teacher.mjs` 34/34 — 카드(학생 있음: 꺼짐·초점 가능·설명·`aria-describedby` / 없음: 켜짐), 꺼진 단추 눌러도 창 없음, 참새반 미리보기(과제 2·선생님 글 1·굵게), 이름 다르면 꺼짐·앞뒤 공백은 같음, 빨간 단추 색, RPC 인자 `{p_class_id, p_confirm_name:'참새반'}`, 알림·목록에서 빠짐·초점, 탈퇴 처리 학생만 남은 학급 막힘, Esc·초점 복귀, 서버 억지 거부 3가지(학생 남음·권한·이름) 문구 그대로·창 유지, 콘솔 오류 0.
  - `t2-continue.mjs` 17/17 — 학급 정리 끝 → [이어서 학급 삭제] → 삭제 창(과제 4·글 2), 다시 읽은 뒤에도 정리 창 유지, 취소 시 초점, 학생 0 정리 창의 [이어서 학급 삭제]·[학급 정리하기] 숨김, 회원 관리 화면에서 지운 뒤 회원 목록 다시 읽음.
  - `t3-super.mjs` 12/12 — 총괄: 다른 담임 학급(기한 카드 → 정리 → 이어서 삭제, 기한 카드가 사라져도 창 유지) 켜짐·삭제. 담임에서 빠진 교사: 미리보기 거부 문구 그대로·단추 꺼짐·삭제 RPC 0.
  - `t4-missing.mjs` 9/9 — SQL 전(PGRST202): [학급 삭제]·설명·[이어서 학급 삭제] 없음, 확인 요청 1번, 오류 화면 없음, 학급 정리 창은 예전 그대로.
  - `t5-mobile.mjs` 8/8 — 390×844 가로 넘침 0, 단추 44px, 이름 칸 보임, 창이 화면 안.
  - `t6-keyboard.mjs` 13/13 — Tab으로 꺼진 단추 초점·설명·Enter 무시, Enter로 열기, 창 안 Tab → 입력 → [학급 삭제] Enter, 지운 뒤 초점, Esc 복귀, 처리 중 Esc로 안 닫힘(취소·삭제·입력 꺼짐, 스피너).
  - `t7-contrast.mjs` 6/6 · `t10-continue-contrast.mjs` 2/2 — 밝음·어두움 카드·삭제 창·막힌 창·[이어서 학급 삭제] 창 글자 대비 ≥ 4.5(최소 5.43, 꺼진 단추는 WCAG 비활성 예외로 제외).
  - `t8-members-filter.mjs` 6/6 — 총괄 회원 관리 학급 필터를 지운 학급으로 고른 채 지워도 '전체'로 돌아감·필터에서 빠짐.
  - `t9-wide.mjs` 1/1 — 1440에서 학급 이름과 단추 한 줄.
- SQL은 실행하지 못해 읽어서 대조: 권한(`revoke`/`grant`, 맨 끝 점검), 순서(과제 → 학급, 외래키 on delete: `class_teachers`·`class_notices` cascade, `profiles`·`member_directory` set null, `assignments` restrict — 먼저 지움, 제출물 cascade, 삭제 트리거 없음, FORCE RLS 없음), 잠금(위 2-5), 문구(원문 대조), 재실행(`create or replace`·`revoke/grant`·`do` 점검만), `x = any (public.my_class_ids())` 꼴(괄호 겹침 없음), 정책 안 같은 표 재조회 없음(정책을 만들지 않음).

## 5. 사진 (`/private/tmp/claude-501/-Users-sungchul-Desktop-classroom/7bf3a39e-3017-4189-b337-1b82aace66bb/scratchpad/class-delete/showcase/`)

`01-card-buttons-1024.png`(학생 있음·없음) · `16-card-buttons-1440.png` · `11-card-buttons-390.png` · `02-delete-dialog-1024.png` · `12-delete-dialog-390.png` · `04-delete-blocked-1024.png` · `05-server-permission-1024.png` · `06-cleanup-done-continue-1024.png`([이어서 학급 삭제]) · `07-cleanup-empty-continue-1024.png` · `08-super-other-class-1024.png` · `09-not-teacher-1024.png` · `10-missing-sql-card-1024.png` · `13-deleting-1024.png` · `14-card-dark-1024.png` · `15-delete-dialog-dark-1024.png` · `17-cleanup-empty-continue-dark-1024.png` · `03-after-delete-1024.png`. 왼쪽 아래 동그란 'N'은 개발 서버 표시(배포에 없음).

## 6. 확인하지 못한 것

- 실제 SQL 실행(문법·권한·잠금 동작·맨 끝 점검) — 로컬 Postgres 없음, 읽어서 대조만. 실제 DB의 외래키가 저장소 SQL과 같은지는 확인 쿼리 2)로 사용자가 본다.
- 실제 Supabase·실제 로그인·실 계정 권한(담임·총괄·`teacher_scope 'class'` 선생님), 동시에 두 창에서 지우기, 지우는 동안 학생 등록이 겹치는 경우.
- 실제 iPad Safari(마우스 클릭으로 단추에 초점이 가지 않는 Safari에서 창을 닫은 뒤 초점 위치, 터치로 꺼진 단추 누르기).
- 정리를 마친 다른 담임의 빈 학급을 총괄이 나중에 지울 화면 경로(2-11 — 지금은 없음).
- 참고: 처음에 형식 확인용으로 `npx prettier --check`를 한 번 돌렸다. 이 저장소에는 prettier가 없어 npx가 이전(10-20)에 받아 둔 캐시 사본으로 실행됐고(새 패키지 파일 없음, npx가 레지스트리를 조회했을 수는 있음), 결과는 쓰지 않았다(프로젝트 형식 검사는 eslint).
- 시험 도구는 스크래치에 남겨 두었다(검토 담당이 다시 쓸 수 있게). Chrome은 껐고 프로필은 지웠다.
