# Review — 과제·블로그 글은 쓴 선생님과 총괄만 고치고 지우기 (커밋 `b3d7ee1`, 2026-09-26)

> 지침 `docs/classes/review-owner-only-instructions.md`. 코드는 고치지 않았다(이 보고서만 새로 씀). 판정은 **커밋 내용**으로 했다(`git show b3d7ee1:…`, `git archive b3d7ee1` 사본을 스크래치에서 빌드). SQL은 **실행하지 않았다**(로컬 Postgres 없음, 실 DB 접근 0) — Postgres 문법·형 결정 규칙과, 사용자가 이미 실행해 통과한 앞 파일들의 같은 꼴(①의 `revoke`+열 `grant`+`has_column_privilege` 점검, ③의 `pg_policies.qual` 글자 찾기)에 대조해 판정했다.

## 0. 한 줄 판정
높음 0 · 중간 0 · 낮음 4 · 참고 5. **실행 오류가 날 문장을 찾지 못했다**(문장 23개 모두 통과, 42883을 일으킨 `= any`·배열 비교는 없음). 맨 앞 점검은 지금 DB에서 통과하고, 맨 끝 점검은 Postgres가 다시 그린 `qual` 모양(`public.` 유무·괄호·공백)과 상관없이 맞게 판정한다. 좁힌 열 권한은 지금 코드(새 화면·예전 화면 모두)가 보내는 모든 update 열과 맞는다(가짜 서버를 grant 목록대로 막아 시험 179건 모두 통과, 열 위반 0).

## 1. 발견

| # | 심각도 | 파일:행 | 무엇 | 근거 | 제안 |
|---|---|---|---|---|---|
| L1 | 낮음 | `supabase/migrations/20260927030000_content_owner_only.sql:116-125`(머리말 확인 쿼리 6) | 흉내 시험이 **실제 `delete`**(남의 과제·글)를 담는다. 통째로 Run하면 마지막 `raise`로 늘 되돌려지고, `set local role` 줄을 빠뜨려도 가드(`not is_admin()`)가 막는다. 그러나 SQL Editor에서 **delete 줄만 골라 실행**하면 postgres(표 소유자 — RLS 안 걸림)로 돌고 `auth.uid()`가 null이라 `created_by is distinct from auth.uid()` = 쓴 사람이 있는 모든 과제가 **실제로 지워지고 제출물이 연쇄 삭제**된다(되돌릴 수 없음). | 읽어서(부분 실행 시나리오). 머리말에 "통째로 Run" 경고는 있음. | update·delete 줄마다 `and current_user = 'authenticated'`를 붙이고(단독 실행이면 0행), 가드에도 `current_user <> 'authenticated'`면 raise. |
| L2 | 낮음 | `src/app/admin/write/post-editor.tsx:287-290` | 권한 정보가 오는 동안(`loading`) 총괄이 남의 글에서 Ctrl/Cmd+S → "저장하지 못했습니다. 쓴 선생님과 총괄만 고칠 수 있어요." — 총괄에게 맞지 않는 까닭(같은 때 안내 줄은 "권한을 확인하는 중…"으로 맞음). 잠깐뿐이고 정보가 오면 저장 켜짐. | 시험 X3(`my_admin_context` 2.5초 지연): 토스트 문구 확인 → 뒤에 안내 사라지고 저장 켜짐. | 토스트도 `contentLockReason(adminCtx)`로. |
| L3 | 낮음 | `src/app/post/post-detail.tsx:154-185`(범위 밖 — Build 보고 §8에 적힘) | 글 상세의 관리자 '수정'·'삭제'가 남의 글에도 켜져 있고, 삭제는 서버 0행 → "글을 삭제하지 못했습니다."(까닭 없음). '수정'은 편집기 안내로 막힘. | 시험 X6. | 나중에 `author_id = 나` 또는 총괄일 때만 보이기(블로그 메뉴가 빠진 화면이라 급하지 않음). |
| L4 | 낮음 | `post-editor.tsx:431-437`과 입력칸 | 남의 글 편집기에서 입력칸이 그대로 열려 있어 고쳐 쓸 수 있고(저장만 막힘), 고치면 '저장하지 않은 변경 사항'·떠날 때 확인 창이 뜬다. | 읽어서(Build가 "최소 변경"으로 둔 부분). | 원하면 `canModify`가 false일 때 입력칸 `readOnly`. |

참고(발견 아님)
* **R1 남은 위험(사용자 결정, Build §8과 같음)**: 과제는 모든 학생에게 보이므로(읽기 정책 `published or is_admin()`), 쓴 선생님이 **자기** 과제를 지워도 다른 반 학생이 낸 제출물이 연쇄 삭제된다. 이번 SQL은 사용자 결정("쓴 선생님과 총괄만") 그대로이고, 지우기 확인 창이 이 사실을 알린다. 작업 트리의 `20260927040000_class_assignments.sql`(커밋 전, 이 파일을 전제로 함)이 과제를 학급별로 나누는 것으로 보인다 — 그 검토에서 확인.
* **R2 누르는 영역**: 과제 줄 '수정'·'삭제' 62×28, '제출 현황' 87×28, 스위치 32×18(라벨 포함 64×20), 글 관리 아이콘 28×28 — 이 커밋 전과 같은 크기(관리자 화면의 기존 44px 미달, classes review L2와 같은 종류). 이번 변경이 만든 것은 아니다.
* **R3 성공 알림**: 맨 끝 `raise notice '✔ …'`는 Supabase SQL Editor 결과 창에 안 보일 수 있다(확인 못 함). 성공 판단은 "Success"(오류 없음) + 확인 쿼리 1·4로 하면 된다.
* **R4 040000과의 관계**: 040000 적용 뒤 이 파일을 다시 Run하면 4-2에서 멈춘다(040000의 INSERT 정책을 "모르는 쓰기 정책"으로 봄 — 안전하게 실패, 아무것도 안 바뀜). 이 파일 머리말의 '되돌리기'는 **040000 전에만** 그대로 맞다(뒤에 쓰면 옛 `for all` 정책이 되살아나 넓어짐). 040000 검토 때 두 머리말을 맞출 것. 040000이 찾는 이 파일의 정책 이름 3개는 두 파일에서 바이트까지 같다(가운뎃점 `·` = U+00B7).
* **R5** TRUNCATE 기본 권한은 anon·authenticated에 남아 있으나 API(PostgREST·GraphQL)에 없어 닿지 않는다(Build §4와 같음).

## 2. 항목 1 — 실행 오류 사냥(문장별)

사전 점검(스크래치 `review-owner-only/sql/analyze.mjs` — 주석·문자열·`"…"`·`$$` 구분 토크나이저): 머리말 1–166행은 모두 `--` 주석, 따옴표·`$$` 짝 맞음, **문장 23개**, 주석·문자열 밖 비ASCII 0, NBSP·폭 없는 문자 0, NFC 아닌 글자 0, `raise`의 `%` 개수 = 인자 수(12곳), 끝 점검의 이름 문자열 12개 = `create policy` 이름과 바이트 같음.

| # | 행 | 문장 | 판정 | 근거 |
|---|---|---|---|---|
| S1 | 167–204 | `do $$` 맨 앞 점검 | 통과 | `to_regprocedure('public.is_admin()')`·`('public.is_super_admin()')`(① 있음), `information_schema.columns`(sql_identifier ↔ 문자열), `to_regclass`, 총괄(②에서 `is_super_admin=true, role='admin'`), `pg_policies`의 `cmd`·`permissive`(text)·`qual`(text) 형 맞음. 지금 DB의 읽기 정책 qual: 과제 `(published OR is_admin())`, 글 `((published AND ( SELECT can_browse() AS can_browse)) OR is_admin())` → 둘 다 `is_admin()` 포함 → **통과**. raise 5개 `%` 0·인자 0. |
| S2 | 211 | `drop policy if exists "assignments: 관리자만 작성/수정/삭제"` | 통과 | 46B, `20260921020000:245`와 바이트 같음(그 파일은 첫 커밋 뒤 안 바뀜) |
| S3·S5·S7 | 213·219·226 | 새 이름 drop | 통과 | 첫 실행은 NOTICE(skipping)만 |
| S4 | 214–217 | `create policy … for insert to authenticated with check (is_admin() and created_by = auth.uid())` | 통과 | insert는 with check만(문법 맞음), uuid = uuid |
| S6 | 220–224 | `… for update to authenticated using (…) with check (…)` | 통과 | 절 순서(for → to → using → with check) 맞음 |
| S8 | 227–230 | `… for delete to authenticated using (…)` | 통과 | delete는 using만 |
| S9–S11 | 238–240 | posts 옛 정책 3개 drop | 통과 | 26B씩, `20260921000000:117·121·126`과 바이트 같음 |
| S12·S14·S16 | 242·247·253 | 새 이름 drop | 통과 | — |
| S13·S15·S17 | 243–256 | posts 작성·수정·삭제(역할 지정 없음 = 원래대로) | 통과 | 위와 같은 꼴, `author_id = auth.uid()` uuid |
| S18 | 267 | `revoke update on public.assignments from anon, authenticated` | 통과 | 표 소유자(postgres)가 준 기본 권한을 소유자가 거둠 — ①이 `profiles`에 같은 방식을 써서 실제로 통과함. 표 단위 revoke는 열 권한도 거둠(문서화된 동작) |
| S19 | 268 | `grant update (title, description_md, due_at, published) on public.assignments to authenticated` | 통과 | 4열 모두 `20260921020000:221-230`. 모든 마이그레이션에 두 표의 `alter table … add/rename/drop column` 없음 |
| S20 | 270 | `revoke update on public.posts …` | 통과 | — |
| S21 | 271 | `grant update (slug, title, summary, content_md, cover_url, tags, published, published_at) on public.posts to authenticated` | 통과 | 8열 모두 `20260921000000:90-103` |
| S22 | 277–367 | `do $$` 맨 끝 점검 | 통과 | `not (select relrowsecurity …)`, `(values …) as e(t,p,c)`(text) ↔ `pg_policies.tablename/policyname`(name; name=text 연산자 있음), `string_agg(… order by …)`, `format('%s …')`(raise 밖이라 `%` 무관), `position(x in a || b)`(b_expr 허용), `has_column_privilege('anon', 'public.assignments', 'created_by', 'UPDATE')` → (name,text,text,text)로 정해짐(①·로그인 잠금 파일이 같은 꼴로 실행됨). raise: `%` 1·인자 1 ×3, 나머지 0·0. 함수는 모두 인자 0개(`is_admin()`·`is_super_admin()`·`auth.uid()`) |
| S23 | 370 | `notify pgrst, 'reload schema'` | 통과 | — |

머리말 확인 쿼리 1)~6)·되돌리기 블록도 같은 방식으로 봄: 문법·`%` 개수(5)는 `%` 6개·인자 6개, 6)은 7개·7개)·한글 별칭(따옴표 없는 한글 식별자 허용, 앞 파일들과 같음)·`set local role`(여러 문장 한 번 Run = 암묵 트랜잭션 블록이라 동작) 모두 맞음. 되돌리기는 옛 정의(`20260921020000:244-249`, `20260921000000:117-128`)와 글자까지 같고 다시 Run해도 됨. 위험은 L1뿐.

## 3. 항목 2 — 재실행·가드·끝 점검
* **재실행**: 두 번째 Run → 가드 통과(읽기 정책은 이 파일이 안 건드림) → drop if exists + create → revoke·grant 같은 결과 → 끝 점검 통과. 되돌리기 뒤 다시 Run도 됨. 한 트랜잭션이라 중간 오류면 전부 되돌림.
* **가드 헛실패 없음**: 과제 읽기 정책 이름은 67B → 저장 61B("…관리자는 전체 ")로 잘려 있지만 이름이 아니라 내용(`is_admin()`)으로 찾는다. `pg_get_expr`는 함수가 search_path에서 보이면 `is_admin()`, 아니면 `public.is_admin()`으로 그리는데 **둘 다** `is_admin()`을 포함한다(괄호·공백 무관).
* **끝 점검 헛통과·헛실패 없음**: 4-3이 찾는 글자는 함수 이름+`()`(`is_admin()`·`uid()`·`is_super_admin()`)뿐이라 스키마 이름(`auth.`·`public.`)·괄호·공백과 무관. `is_super_admin()` 안에 `is_admin()`은 없다(헛통과 없음). ③의 `position('is_admin()' in qual)`와 같은 방식이고, 이번에는 "있어야 한다" 쪽이라 부분 문자열의 한계(AND/OR 구분 못 함)가 있지만 바로 위에서 만든 정책을 보고 4-2가 다른 허용 쓰기 정책을 모두 막으므로 실제 영향 없음. 4-4는 쓴 사람 열 UPDATE가 anon·authenticated(PUBLIC 포함)에 없고 12열은 있는지 봄 — revoke/grant 뒤 그대로 성립.

## 4. 항목 3 — 권한 결과

| 행위자 | 남이 만든 과제·글 | 내가 만든 것 | 쓴 사람 없음 | 새로 만들기 |
|---|---|---|---|---|
| 총괄 | 고치기·공개 전환·지우기 ○ | ○ | ○ | ○(자기 이름) |
| 다른 교사 T2 | 0행(오류 없음) | ○ | 0행 | ○(자기 이름만 — 남·빈 이름은 RLS 거부) |
| 학생 | 0행(열 권한은 있으나 RLS `is_admin()` 거짓) | — | 0행 | RLS 거부 |
| 비로그인 | 고치기 42501(UPDATE 권한 없음) · 지우기 0행 | — | 같음 | RLS 거부 |

* **쓴 사람 바꾸기**: 모두 막힘 — PATCH `created_by`·`author_id`는 총괄 포함 42501(열 권한), insert는 with check(`= auth.uid()`, null도 거부), upsert는 `ON CONFLICT DO UPDATE`의 SET 열(`id` 등) 권한이 없어 거부, 두 표를 쓰는 RPC·트리거·Edge Function 없음(마이그레이션·`supabase/functions` 전체 검색). `id`·`created_at`·`updated_at`도 고칠 수 없음(`updated_at`은 트리거가 채움 — 권한 불필요).
* **열 권한 ↔ 코드 대조**(`.update(`·`.upsert(`·`.insert(` 전부): 과제 = `learning.ts:465` 하나 ← `assignment-manager.tsx:114` `{published}`, `:356` 폼 4열(과제 관리·제출 현황 머리 모두) ⊆ grant 4열. 글 = `post-editor.tsx:325-338` 8열 = grant 8열, `admin-post-list.tsx:93-94` `{published, published_at}`/`{published}`. upsert 0곳, RPC 0곳, `/post/` 상세는 delete뿐. 예전 화면(9a9909d)도 같은 열.
* **제출물·읽음 기록을 지우는 다른 길**: Build §4 표 확인 — 맞음(제출물 직접 삭제 = 그 학생 담임·본인(마감 전·검토 전), `post_reads` 쓰기 권한 회수, 제출 대상 바꾸기는 가드 트리거가 막음, 함수·트리거에 없음). 남은 길은 과제·글 삭제의 연쇄뿐(R1).

## 5. 항목 4 — 화면
* Build 시험 전부를 **내 빌드**(커밋 사본)에 다시 돌림 + 가짜 서버가 grant 목록 밖 열을 42501로 거부하게 바꿈 → **111/111**(원래 98 + 열 위반 점검 13). 담임: 남의 과제·쓴 사람 없는 과제 스위치·수정·삭제 꺼짐 + "쓴 선생님과 총괄만 고칠 수 있어요." + `aria-describedby`, "만든 선생님 박총괄"·"만든 선생님 정보 없음", 꺼진 버튼 눌러도 요청 0, 내 과제 공개 전환·수정·새 과제·지우기 성공, 제출 현황 머리. 총괄: 모두 켜짐, 남의 과제 지우기 확인 창 "이담임 선생님이 만든 과제예요. …다른 반 학생이 낸 것이 있으면 그것까지…". 서버 거부(0행·42501) 한국어 문구 9곳. 글 관리·편집기(담임·총괄·권한 확인 실패). 학급 SQL 전 예전 동작.
* 추가 시험(X, **56/56**): 대비 — 까닭 줄·"만든 선생님" 밝음 5.49:1(#696969/#FFF), 어두움 6.94:1(#A1A1A1/#171717), 편집기 안내 19.8:1·17.18:1 → 모두 AA. 초점 — Tab이 남의 과제 줄의 꺼진 스위치·수정·삭제를 건너뛰고(제목 링크·'제출 현황'만), 내 과제 줄 스위치·수정·삭제는 `:focus-visible` 고리 보임. 375 폭 — 편집기·제출 현황 머리(밝음·어두움) 가로 넘침 0(과제·글 관리 375·768은 Build 시험). 권한 확인 중(L2). 만든 선생님 이름 읽기 실패 → 목록 그대로 + "다른 선생님이 만든 과제". 글 상세(L3). 누르는 영역(R2).
* 모든 시험에서 콘솔 오류 0, 실제 Supabase·외부 요청 0(편집기 미리보기 CDN은 시험에서 막는 것이 정상).

## 6. 항목 5 — 배포 순서
* **화면 먼저 push(SQL 전 = 지금 DB, 서버는 교사 누구나)**: 새 화면이 담임에게 남의 것을 먼저 막는다(서버보다 좁음 — 안전), 내 것·총괄은 그대로 됨. 시험 통과.
* **SQL 먼저(push 전, 예전 화면 `9a9909d`를 따로 빌드)**: 내 과제 공개 전환·수정, 내 글 저장·발행 성공(예전 화면도 grant 안 열만 보냄 — 위반 0). 남의 것은 버튼이 켜져 있지만 서버 0행 → 예전 일반 문구("공개 상태를 바꾸지 못했습니다."·"과제를 삭제하지 못했습니다."·"상태를 바꾸지 못했습니다."), 남의 과제·제출물 그대로. **12/12**.
* **학생 화면**: 이 커밋은 학생 쪽 파일을 바꾸지 않았고(바뀐 코드 = 관리자 화면 5개, `learning.ts` 주석+새 함수, `use-admin-context.tsx` 새 export), SQL은 읽기·제출 정책을 바꾸지 않는다 → 두 순서 모두 같다. 새 빌드로 학생 '내 학습 활동 > 과제' 확인: 공개 과제만, 쓰기·이름 조회 요청 0.
* 머리말 순서(SQL → 확인 쿼리 → push) 그대로 권장. 어느 순서여도 깨지지 않는다.

## 7. 항목 6 — lint·tsc·공개 규칙·되돌리기
* 커밋 사본에서 `eslint`(전체) exit 0, 바뀐 7파일 `--max-warnings=0` exit 0, `tsc --noEmit` exit 0, `next build`(TypeScript 포함) 성공·25쪽. `git show --check` 깨끗. 추가 줄에 `console.log`·`localStorage.clear()`·'우리 반' 없음.
* 공개 규칙: SQL·보고서에 이메일·학생 이름 없음(확인 쿼리는 `<총괄 id>` 자리표시).
* 되돌리기: 옛 정책 4개를 글자 그대로 + `grant update … to anon, authenticated`(이 파일 전 = 기본값) — 맞음. 단 040000 전까지만(R4).

## 8. 시험 방법·차단
* `git archive b3d7ee1`(와 비교용 `9a9909d`)를 스크래치 `review-owner-only/`에 풀어 저장소 `node_modules`를 링크하고 **그 안에서** 빌드(사본에만 가짜 Supabase 주소·키, `turbopack.root="/"`, `NEXT_TELEMETRY_DISABLED=1`, Geist 글꼴은 이전 리뷰의 로컬 사본을 `NEXT_FONT_GOOGLE_MOCKED_RESPONSES`로 자기 서버에서 공급). 번들(`_next`) 속 Supabase 주소는 가짜 하나뿐(실 주소는 과학 앱 `config.js`에만 — 시험에서 안 엶). 저장소 `out/`·`.next/` 안 씀.
* 자기 정적 서버 8784, 자기 headless Chrome(CDP 9355, 프로필 `review-owner-only/chrome-profile`) `--host-resolver-rules="MAP * ~NOTFOUND, EXCLUDE 127.0.0.1"`, 탭마다 첫 이동 전 CDP `Fetch` 가짜 응답, 캐시 끔. 도구는 Build의 `scratchpad/owner-only/`를 `review-owner-only/tools/`로 복사해 포트·주소를 바꾸고 가짜 서버를 grant 목록대로 엄격하게(+ 옛 정책·학생·지연·이름 실패 모드). 결과 `report-all.json`(111)·`report-extra-all.json`(56)·`report-oldui.json`(12), 스크린숏 `shots/`.
* 설치·내려받기·SQL 실행·실 DB 접근·git commit/push·`localStorage.clear()` 0. 다른 포트·프로세스 손대지 않음. 서버·Chrome 종료(8784·9355 비어 있음), node_modules 링크 지움. 빌드 사본(약 340MB)은 이 프로젝트에서 `rm -rf`가 막혀 남겨 둠.

## 9. 확인하지 못한 것
* 실제 Postgres에서의 실행(로컬 없음) — 특히 `pg_policies.qual`의 실제 글자 모양은 Postgres 규칙과 앞 파일들의 통과 사례로 판단. 사용자 DB에 대시보드로 만든 정책이 따로 있으면 4-2가 되돌리고 이름을 알려 준다(안전하게 실패).
* Supabase SQL Editor가 NOTICE를 보여 주는지(R3), 실제 계정 두 명으로 교차 확인(확인 쿼리 6은 두 번째 담임 뒤), 실제 iPad·로그인 화면(모두 가짜 세션·headless).

**사용자에게 실행을 부탁해도 됨** — 문장 23개에서 실행 오류가 날 곳을 찾지 못했고, 맨 앞 점검은 지금 DB에서 통과하며 맨 끝 점검은 `qual` 표시 모양과 상관없이 맞게 판정한다. 좁힌 열 권한은 새 화면·예전 화면이 보내는 모든 열과 맞아 어느 배포 순서에서도 저장이 막히지 않는다. 낮음 4건은 실행을 막지 않는다(L1은 확인 쿼리 6을 쓰기 전, 두 번째 담임이 생기기 전에 고치면 된다).
