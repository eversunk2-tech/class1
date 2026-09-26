# 검토 지침(Review owner-only) — 과제·블로그 글은 쓴 선생님과 총괄만 고치고 지우기 (2026-09-26, 커밋 `b3d7ee1`)

당신은 **Review** 담당이다. **코드를 고치지 않는다**(발견만 기록). 이 SQL은 검토 뒤 사용자가 직접 실행한다. 지난번 `20260927020000_class_notices.sql`은 읽어서 하는 검토를 모두 통과했지만 **실제 실행에서 42883 오류**(`= any ((select …))` — 괄호를 겹쳐 하위 쿼리로 읽힘)가 났다. **실행하면 오류가 날 곳을 가장 먼저, 가장 꼼꼼히** 찾는다.

## 사용자 결정(합격 기준)
"과제·글 수정은 쓴 선생님과 총괄만 하게 해줘" (배경: `docs/classes/review.md` M1 — 과제를 지우면 제출물 연쇄 삭제)

## 대상
`git show b3d7ee1` — 새 SQL `supabase/migrations/20260927030000_content_owner_only.sql`, 관리자 화면(`assignment-manager.tsx`·`submission-review.tsx`·`admin-post-list.tsx`·`write/page.tsx`·`post-editor.tsx`), `src/lib/learning.ts`, `src/hooks/use-admin-context.tsx`. 지침 `build-owner-only-instructions.md`, 보고 **`build-owner-only-report.md`**. 지금 실 DB 상태 = 마이그레이션 `20260921000000` ~ `20260927020000`(이 파일 앞까지 모두 사용자가 실행함).

## 확인할 것
1. **실행 오류 사냥(가장 중요)**: 문장마다 — `drop policy if exists` 이름이 지금 이름과 바이트까지 같은지(63바이트에서 잘린 이름 포함), `create policy`의 대상 역할·명령·식이 문법상 맞는지, `revoke`/`grant (열…)`의 열 이름이 실제 표에 있는지(표 정의를 모든 마이그레이션에서 찾아 대조 — `alter table … add column` 포함), `do $$` 블록 plpgsql 문법·변수·`pg_policies` 열 이름·형(`roles`는 name[], `qual`·`with_check`는 text), `raise` 형식 문자열의 `%` 개수, 문자열 따옴표, 세미콜론. 배열·집합 비교 모양(`any`·`in`), 함수 이름·인자(`is_admin()`, `is_super_admin()`). 가능하면 SQL을 문장 단위로 나눠 목록으로 적고 하나씩 판정.
2. **재실행 안전·가드·끝 점검**: 두 번 실행해도 되는지, 맨 앞 가드가 지금 DB에서 **통과하는지**(헛실패 — 예: 67바이트 이름을 내용으로 찾는 방식이 실제 저장된 `qual` 문자열 모양과 맞는지; `qual`은 Postgres가 다시 그린 식이라 원문과 다를 수 있다 — 예 `public.is_admin()` ↔ `is_admin()`, 괄호·공백), 맨 끝 점검이 헛통과·헛실패하지 않는지(특히 `qual`/`with_check` 글자 비교가 Postgres의 다시 그린 모양과 맞는지 — 기존 `20260927010000_classes_rls.sql` 끝 점검이 `position('is_admin()' in qual)`로 부분 문자열만 본 것과 비교).
3. **권한 결과**: 행위자 {총괄, 다른 교사 T2, 학생, 비로그인} × {남이 만든 과제·글, 내가 만든 과제·글, 만든 사람이 비어 있는 행} × {만들기·고치기·지우기·공개 전환}. 만든 사람(`created_by`·`author_id`)을 바꾸는 길이 없는지(열 권한·정책·RPC). **열 권한을 좁힌 것이 지금 화면·다른 코드(과제 제출·검토, 블로그 편집기, 공개 전환, `/post/` 상세의 관리자 삭제, RPC)가 보내는 열과 모두 맞는지** — 빠진 열이 있으면 그 화면이 "permission denied"로 막힌다(코드에서 `.update(`·`.upsert(`를 모두 찾아 대조). 과제 제출물(`assignment_submissions`)·글 읽음 기록을 지우는 다른 길.
4. **화면**: 총괄·다른 교사로 과제 관리·제출 현황·블로그 글 관리·편집기 — 남의 것은 버튼 꺼짐 + "쓴 선생님과 총괄만 고칠 수 있어요.", 내 것은 그대로, 서버 거부 한국어 안내, 지우기 확인 창 문구, "만든 선생님 ○○" 표시, 44px·초점·어두움·375 폭. SQL 전(옛 정책) 상태에서도 화면이 깨지지 않는지.
5. **배포 순서**: SQL 전에 화면 push / SQL 뒤 push — 각 상태에서 교사·학생 화면.
6. `npm run lint`·`npx tsc --noEmit`(사본에서), 저장소 공개 규칙(개인정보 없음), 되돌리기 주석 SQL이 맞는지.

## 테스트 규칙(반드시)
* 판정·시험은 **커밋 `b3d7ee1` 사본**으로: `git archive b3d7ee1`를 스크래치에 풀고 `node_modules`를 저장소 것에 링크해 **그 안에서** 빌드(가짜 Supabase 주소·키, 필요하면 사본 설정에만 `turbopack.root` — `docs/classes/review-links.md` 방식). 저장소 `out/`·`.next/`에 빌드하지 않는다.
* 시험 도구는 `…/scratchpad/owner-only/`(Build 담당 것)를 **자기 폴더로 복사해서** 쓴다.
* 자기 정적 서버(포트 **8784**)·자기 headless Chrome(포트 **9355**, 프로필은 `/private/tmp/claude-501/-Users-sungchul-Desktop-classroom/7bf3a39e-3017-4189-b337-1b82aace66bb/scratchpad/review-owner-only/` 안), `--host-resolver-rules`로 `*.supabase.co` 차단, 첫 로드부터 CDP `Fetch` 가짜 응답, 캐시 끄기. 실제 Supabase·Gemini·외부 요청 금지, **SQL 실행·실 DB 접근 금지**, **아무것도 내려받거나 설치하지 않는다**.
* `localStorage.clear()` 금지, 다른 탭·프로세스·다른 포트(8786·8788·8789·9353·9360은 다른 작업) 건드리지 않기, git commit/push 금지. 저장소 파일은 보고서 하나만 새로 쓴다. 끝나면 서버·Chrome 종료.

## 보고서 `docs/classes/review-owner-only.md`
심각도별 발견 표(파일:행, 무엇, 재현 또는 근거, 제안), 항목 1~6 판정(1은 문장별 표), 확인하지 못한 것 — 한국어로 간결하게. 마지막 줄에 **"사용자에게 실행을 부탁해도 됨 / 고친 뒤"**와 까닭.
