# 학급 삭제 — 검토 지침 (검토 담당, 2026-10-22)

**코드를 고치지 않는다.** 보고서 `docs/classes/delete-class/review.md`와 대표 사진(`…/scratchpad/class-delete-review/showcase/`)만 남긴다. git commit/push·실제 Supabase 요청(공개 키 읽기 포함)·내려받기·설치(npx로 저장소에 없는 도구를 부르는 것 포함) 금지. 교사 인증 코드 값·개인 이메일을 쓰지 않는다. 한 명령이 10분 넘게 조용하면 끊기니 짧게 나눠 돌린다.

## 기준
`docs/classes/delete-class/spec.md`(사용자 승인), 원문 `docs/privacy/privacy-policy.md` 8-9(화면 글 — 글자 그대로), `docs/classes/delete-class/build-report.md`, `CLAUDE.md`(SQL 적용 절차 — 특히 새 외래키 금지·`any (public.f())`·정책 재귀·재실행 안전, 정적 export, 디자인·접근성), 기존 학급 정리(`supabase/migrations/20261020000000_privacy_a_schema.sql`의 `admin_class_cleanup_preview`, `supabase/functions/admin-clear-students/`)와 반별 권한(`20260927000000_classes_schema.sql`·`20260927010000_classes_rls.sql`), 학급 외래키(`class_teachers`·`class_notices` cascade, `profiles`·`member_directory` set null, `assignments` restrict, 제출물 cascade).

## 볼 것
- `supabase/migrations/20261022000000_class_delete.sql`: 권한(그 학급 담임 또는 총괄만 — 학생·다른 담임·인증 전 구글·비로그인 거부), 학생이 남으면 거부(탈퇴 처리된 학생 포함, 셈 기준이 맞는지), 학급 이름 비교, 잠금·순서(과제 → 학급), 지워지는 것/남는 것이 spec과 같은지(다른 학급·다른 교사의 자료가 함께 지워질 길은 없는지 — 보조 담임·과제의 class_id·선생님 글·자유게시판 `board_owner`), `security definer`·`search_path`·실행 권한, 재실행 안전, 자체 점검이 실제로 멈추는지, 되돌리기 설명, 오류 문구 = 원문.
- 화면 변경 전부(`git status`·`git diff` — `src/components/admin/class-card.tsx`·`class-delete-dialog.tsx`·`class-cleanup-dialog.tsx`·`class-controls.tsx`, `src/hooks/use-admin-context.tsx`, `src/lib/classes.ts`, `src/data/privacy-admin-text.ts`): 원문 대조, 단추 꺼짐·설명, 확인 창(이름 입력·처리 중 닫힘 막기·서버 오류 그대로), 삭제 뒤 목록·회원 목록·개요가 깨지지 않는지, SQL 전(함수 없음) 숨김, 구현 담당이 덤으로 고친 '학급 정리 창이 목록 다시 읽기 때 사라지던 문제'가 다른 곳을 깨지 않는지, 카드 배치 변경(1024·390에서 단추 줄 내림)이 다른 학급 카드 사용처를 깨지 않는지.
- 시험: 개발 서버 `http://localhost:3000/class1/`(메인 에이전트가 띄워 둠 — `next dev`·`next build` 금지), 자기 headless Chrome **포트 9486**, 실제 Supabase는 첫 로드부터 막고 가짜 응답만, `Network.setCacheDisabled`, `localStorage.clear()` 금지. 구현 담당 시험 도구(`…/scratchpad/class-delete/`)를 복사해 써도 된다(원본은 고치지 않음). 1024×768·390×844, 키보드, 밝음·어두움, `npx tsc --noEmit -p tsconfig.json`·`npm run lint`. 끝나면 Chrome을 끄고 프로필을 지운다.

## 보고서 `docs/classes/delete-class/review.md`
심각도별 표(높음·중간·낮음 — 파일:줄, 재현 또는 근거, 제안), 원문 대조 결과, 시험한 경우와 결과, 확인하지 못한 것, 대표 사진 경로, 끝 줄 **"배포해도 됨 / 고친 뒤 배포"**.
