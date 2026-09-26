# Build 지침(학급별 '선생님 글') — 2026-09-26, docs/classes/spec.md 개정 2

당신은 **Build** 담당이다. 반별 구분 기능(개정 1 — `classes`·`class_teachers`·`my_class_ids()` 등, 파일 `supabase/migrations/20260927000000_classes_schema.sql`·`20260927010000_classes_rls.sql`, 관리자 화면은 `docs/classes/build-ui-report.md`)이 이미 만들어져 있다(아직 실 DB에는 실행 전). 그 위에 **개정 2 — 학급별 '선생님 글'**을 구현한다.

## 먼저 읽기
`CLAUDE.md`, `AGENTS.md`(이 Next.js 버전 주의), `docs/classes/spec.md`의 **개정 1·2**, `docs/classes/build-db-report.md`·`build-ui-report.md`, 위 두 SQL 파일(함수 이름·권한 방식), `src/components/dashboard/teacher-posts.tsx`(지금 홈 '선생님 글' — `posts`를 읽음), `src/components/dashboard/stat-tile.tsx`('선생님 글' 개수), 관리자 화면(`src/app/admin/…` — 개요 바로가기·메뉴 `src/components/admin/admin-shell.tsx`·글 관리 `posts/`·편집기 `write/`), `src/lib/*`(관리자 RPC·학급 컨텍스트 훅).

## 만들 것
1. **SQL `supabase/migrations/20260927020000_class_notices.sql`**(재실행 안전, 맨 위 실행 방법·순서(①→②→③ 다음 ④)·확인 쿼리, 가드: `classes`·`my_class_ids()`가 없으면 멈춤): 개정 2-1의 표 `class_notices` + `updated_at` 트리거 + RLS(SELECT 학생 = 자기 학급만 — `security definer` 함수 `my_student_class_id()`(이름 그대로, 학생이 아니면 null, 실행 권한은 기존 도우미 함수와 같게), 담임 = `my_class_ids()`; INSERT/UPDATE/DELETE = 그 학급 담임, INSERT는 `author_id = auth.uid()`) + 표 권한(anon 없음, authenticated는 RLS로). 정책 이름 63바이트 안. 42P17 재귀 없음.
2. **홈**(`teacher-posts.tsx`): `class_notices`(`id,title,body`, `created_at` 내림차순, 5개씩 더 보기)를 읽는다. 제목만 목록, 누르면 본문 펼침, **날짜 없음**, 본문은 **글자 그대로**(`whitespace-pre-wrap`, 마크다운·HTML 해석 안 함 — `MarkdownViewer` 쓰지 않음). 비로그인·잠금·빈 상태 문구는 지금과 같게. 표가 아직 없으면(SQL 전) 조용히 "아직 선생님 글이 없어요"로(오류 화면 대신) — 또는 준비 중 문구.
3. **홈 통계 칸** '선생님 글'(`stat-tile.tsx`): `class_notices` 개수(head count), 비로그인 "로그인 필요"(지금처럼 `loginOnly`).
4. **관리자 '선생님 글'**(새 화면, 예: `src/app/admin/(dashboard)/notices/`): 내 학급 글 목록(학급이 여럿이면 학급 고르기 — 학급 컨텍스트 훅/`my_admin_context()` 사용), **새 글: 제목·본문 두 칸만**(글자 수 안내), 고치기, 지우기(확인 대화 상자 + `danger-button.ts`), 학급 없는 담임 → "먼저 학급을 개설해 주세요". 관리자 목록에는 쓴 날짜를 작게(관리용).
5. **메뉴·개요**: 관리자 메뉴와 개요 바로가기에서 '글 관리'·'새 글 작성'을 빼고 '선생님 글'을 넣는다. 블로그 관련 코드·주소(`/post/`, `/admin/posts/`, `/admin/write/`, 검색)는 **지우지 않는다**(화면 진입점만 뺌 — 개정 2-2).
6. 문서: `docs/classes/build-notices-report.md`.

## 규칙
* SQL 실행·실 DB 접근 금지(읽어서 검토), git commit/push 금지, 내려받기·설치 금지, `localStorage.clear()` 금지.
* 수정 범위: 새 SQL 파일, `src/`(위 파일들 + 관리자 선생님 글 화면), 보고서. `supabase/functions/`·`public/`·`scripts/`는 건드리지 않는다(다른 작업 중).
* 검증: `npm run lint`·`npx tsc --noEmit`·`npm run build` 통과. 빌드된 `out/`을 자기 정적 서버(포트 **8784**, 스크래치 폴더에 `class1 → out` 링크)로 + 자기 전용 headless Chrome(포트 **9355**, 프로필은 `/private/tmp/claude-501/-Users-sungchul-Desktop-classroom/7bf3a39e-3017-4189-b337-1b82aace66bb/scratchpad/notices/`) + supabase 차단(`--host-resolver-rules`) + CDP `Fetch` 가짜 응답(가짜 학생·담임 세션, `class_notices`·`my_admin_context` 가짜 응답) + 캐시 끄기로: 비로그인 홈(안내·요청 0), 학생 홈(목록·펼침·날짜 없음·본문 글자 그대로 — `<script>` 같은 글이 글자로만 보임), 담임 관리자 화면(새 글·고치기·지우기 요청 모양), 메뉴에서 글 관리·새 글 작성이 사라짐. 스크린숏(영어 파일 이름). 실제 Supabase·Gemini 요청 금지. 끝나면 서버·Chrome 종료.
