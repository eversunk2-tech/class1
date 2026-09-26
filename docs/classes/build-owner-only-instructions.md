# Build 지침(owner-only) — 과제·블로그 글은 쓴 선생님과 총괄만 고치고 지우기 (2026-09-26, 사용자 결정 — Review M1)

당신은 **Build** 담당이다. SQL 하나와 관리자 화면을 고치고 검증해 보고서를 쓴다(검토는 다른 에이전트). **실 DB에 실행하지 않는다**(SQL은 사용자가 실행).

## 사용자 결정(그대로 — 합격 기준)
"과제·글 수정은 쓴 선생님과 총괄만 하게 해줘"
배경(`docs/classes/review.md` M1): 과제·블로그 글은 지금 교사 누구나(`is_admin()`) 고치고 지울 수 있다. 과제를 지우면 제출물이 연쇄 삭제(`on delete cascade`, RLS 밖)되어 **다른 반 담임이 과제를 지우면 부엉이반 학생 제출물까지 사라진다**. 블로그 글을 지우면 글 읽음 기록(`post_reads`)도 같은 식.

## 먼저 읽기
`CLAUDE.md`(Supabase·**SQL 적용 절차** — 특히 "배열 반환 함수와 비교할 때 `= any ((select …))` 금지", 재실행 안전, 42P17, 정책 이름 63바이트, 저장소 공개), `docs/classes/spec.md` 개정 1(1-5 "열린 것"), `docs/classes/review.md` M1, 지금 정의: `supabase/migrations/20260921020000_admin_learning.sql`(assignments 표·"assignments: 관리자만 작성/수정/삭제"), `20260921000000_init_blog.sql`(posts 표 `author_id default auth.uid()`·"posts: 관리자만 작성/수정/삭제"), `20260923010000_login_required.sql`(두 표 SELECT 정책 — 바꾸지 않음), `20260927000000_classes_schema.sql`(`is_super_admin()`), 관리자 화면 `src/app/admin/(dashboard)/learning/assignment-manager.tsx`·`src/lib/learning.ts`(과제 읽기·쓰기), 블로그 관리자 `src/app/admin/(dashboard)/posts/`·`write/`(메뉴에서 빠졌지만 주소는 남아 있음), `src/hooks/use-admin-context.tsx`(총괄 여부).

## 만들 것
1. **SQL `supabase/migrations/20260927030000_content_owner_only.sql`**(재실행 안전, 맨 위 실행 방법·확인 쿼리, 맨 앞 가드: `is_super_admin()`이 없으면 멈춤, 맨 끝 스스로 점검 — 어긋나면 전부 되돌림):
   * `assignments`: "관리자만 작성/수정/삭제"(`for all`)를 지우고 → 작성 = 교사(`is_admin()`)이며 `created_by = auth.uid()`, 수정 = `is_admin()` 그리고 (`created_by = auth.uid()` 또는 `is_super_admin()`) — using·with check 모두, 삭제 = 같은 조건. SELECT 정책은 그대로.
   * `posts`: "관리자만 작성"·"관리자만 수정"·"관리자만 삭제"를 같은 방식으로(`author_id`). SELECT 정책은 그대로.
   * `created_by`·`author_id`가 비어 있는(null) 행은 총괄만 고칠 수 있게 된다 — 확인 쿼리에 "비어 있는 행 수"를 넣는다.
   * 과제·글을 **만든 사람을 바꾸는 길**이 없는지(담임이 `created_by`를 남으로 바꾸기 등 — with check로 막히는지, 열 권한도 확인).
   * 과제 제출물·글 읽음 기록을 지우는 다른 길(다른 정책·함수·트리거)이 교사 누구나에게 열려 있지 않은지 확인해 보고서에(이번에 바꾸지 않는 것은 목록으로).
   * 정책 이름 63바이트 안, 42P17 재귀 없음, 확인 쿼리(정책 목록·조건, 비어 있는 행 수), 되돌리는 방법(파일 머리말에 옛 정책 다시 만드는 SQL을 주석으로).
2. **관리자 과제 화면**: 내가 만들지 않은 과제(총괄이 아니면)는 수정·공개 전환·삭제 버튼을 꺼 두고 까닭("쓴 선생님과 총괄만 고칠 수 있어요")을 보인다. 목록에 만든 선생님 이름을 작게 보여도 된다(교사가 여럿일 때 구분). 새 과제 만들기는 그대로. 서버가 거부하면(RLS — 0행 수정·삭제) 한국어로 알린다.
3. **블로그 관리자(`/admin/posts/`·`/admin/write/`)**: 메뉴에서 빠진 화면이지만 주소로 들어갈 수 있다 — 남의 글이면 수정·삭제 버튼을 끄거나, 적어도 서버 거부를 한국어로 알린다(최소 변경).
4. 보고서 `docs/classes/build-owner-only-report.md`.

## 규칙
* 수정 범위: 새 SQL 파일, 위 화면·lib 파일, 보고서. `public/`·`scripts/`·`supabase/functions/`·홈(`teacher-posts.tsx`·`page.tsx` — 다른 담당이 쪽 나누기 작업 중)은 건드리지 않는다.
* SQL 실행·실 DB 접근 금지(읽어서 검토 — 로컬 Postgres 없음. **정책 식을 기존 마이그레이션의 같은 모양과 한 줄씩 대조**), git commit/push 금지, 내려받기·설치 금지, `localStorage.clear()` 금지.
* 검증: `npm run lint`·`npx tsc --noEmit`·`npm run build`(다른 담당이 동시에 빌드할 수 있으니 빌드 전후 `out/`을 쓰는 다른 작업이 없는지 — 충돌하면 스크래치에 `git worktree` 대신 `git archive HEAD` + 작업 파일 복사본으로 빌드). 빌드한 사이트를 자기 정적 서버(포트 **8791**)로 + 자기 전용 headless Chrome(포트 **9362**, 프로필은 `/private/tmp/claude-501/-Users-sungchul-Desktop-classroom/7bf3a39e-3017-4189-b337-1b82aace66bb/scratchpad/owner-only/`) + Supabase 차단(`--host-resolver-rules`) + 첫 로드부터 CDP `Fetch` 가짜 응답(가짜 총괄·담임 세션, 과제 목록에 두 교사가 만든 과제, 남의 과제 수정 시 가짜 RLS 거부) + 캐시 끄기. 시험 도구는 `…/scratchpad/classes-ui/`를 **자기 폴더로 복사해서** 고쳐 쓴다. 다른 포트(8785·8786·8787·8790·8796·8797·9356·9359·9360·9361) 건드리지 않기. 끝나면 서버·Chrome 종료.
