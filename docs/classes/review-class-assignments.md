# Review — 과제도 학급별로 ⑥ (커밋 `0d9d8e1`, 2026-09-26)

> 지침 `docs/classes/review-class-assignments-instructions.md`. 코드는 고치지 않았다(이 보고서만 새로 씀). 판정은 **커밋 내용**으로 했다(`git show 0d9d8e1:…`, `git archive 0d9d8e1` 사본을 스크래치에서 빌드 — 작업 트리의 `supabase/migrations`·`src`는 커밋과 같음). SQL은 **실행하지 않았다**(로컬 Postgres 없음, 실 DB 접근 0) — Postgres 문법·형 결정·처리 순서 규칙과, 사용자가 이미 실행해 통과한 ①~④의 같은 꼴에 대조했다.

## 0. 한 줄 판정
높음 0 · 중간 0 · 낮음 4 · 참고 7. **⑤ 실행 뒤 ⑥을 Run할 때 오류가 날 문장을 찾지 못했다**(문장 17개 모두 통과 — 42883을 낸 `any ((select …))` 꼴 0, 배열 비교 2곳 모두 `= any (public.my_class_ids())`). 맨 앞 점검은 ⑤ 직후 DB에서 통과하고, 맨 끝 점검(조건 글자·제출 정책 전제 포함)은 Postgres가 다시 그린 `qual`/`with_check` 모양에서 헛실패·헛통과하지 않는다. 권한은 설계대로다(학생 = 자기 학급 공개 과제만, 비로그인 0, 교사 = 자기 학급 + 자기가 만든 과제, 총괄 = 전체, 만들기 = 자기 학급에만, 학급을 바꾸는 길·다른 반 과제에 내는 길 없음). 낮음 4건은 드문 경우의 안내 문구·주석이다.

## 1. 발견

| # | 심각도 | 파일:행 | 무엇 | 근거·재현 | 제안 |
|---|---|---|---|---|---|
| L1 | 낮음 | `src/app/admin/(dashboard)/learning/assignment-manager.tsx:431-438`, `supabase/migrations/20260927040000_class_assignments.sql:40·61-62` | 학급 없이 새 과제를 넣으면 **not null(23502)이 아니라 RLS 거부(42501)** 가 난다. Postgres는 INSERT에서 RLS `with check`를 NOT NULL보다 먼저 검사한다(ExecInsert: `ExecWithCheckOptions` → `ExecConstraints`). 그래서 화면의 23502 갈래("설정이 방금 적용됐어요. 화면을 새로 고친 뒤…")는 실제로는 나오지 않고, 목록을 ⑥ 전에 연 채 ⑥이 적용된 뒤 새 과제를 저장하면 "과제를 저장하지 못했습니다. **내가 담임인 학급에만 과제를 만들 수 있어요.**"(담임에게 틀린 까닭)가 나온다. 머리말의 "not null 오류"도 실제와 다르다(예전 화면에 보이는 문구 "과제를 저장하지 못했습니다."는 맞음). Build 시험은 가짜 서버가 23502를 돌려줘 헛통과했다. | 가짜 서버를 실제 순서(42501)로 바꿔 Build 시험을 다시 돌림: 126/127, 실패 1 = 이 경우(`rv-r1-flip-42501.png`). 권장 순서(⑥ → push)에서는 새 화면이 ⑥ 뒤에만 열리므로 거의 생기지 않는다. | `saveErrorMessage`에서 `!isEdit && !classMode && (code === "42501" \|\| code === "23502")`면 "새로 고친 뒤" 문구. 머리말 40·62행 "not null 오류" → "RLS 거부(42501, new row violates row-level security policy)". |
| L2 | 낮음 | `assignment-manager.tsx:210-225` | 학급별 과제의 지우기 확인 창이 "**○○반 학생 제출물 N건도**"(N = 내가 볼 수 있는 수)만 말한다. ⑥ 전에 다른 반 학생이 낸 제출물·반을 옮긴 학생의 제출물처럼 **보이지 않지만 함께 지워지는 것**은 말하지 않는다(⑤ 화면의 "다른 반 학생이 낸 것이 있으면 그것까지"를 학급별 과제에서 뺌). | 가짜 서버: 총괄이 A1(부엉이반 학생 2건 + ⑥ 전 여우반 학생 1건)을 지움 → 창 "2건", 실제 연쇄 삭제 3건(`rv-r2-delete-a1-dialog.png`). 확인 쿼리 1의 "다른_학급_학생_제출물"이 0이면 반 옮긴 학생 경우만 남는다(반 옮기기는 지금 SQL로만). | 학급별 과제 문구에도 "(반을 옮긴 학생이나 학급을 나누기 전에 다른 반 학생이 낸 것이 있으면 그것까지)" 한 구절. |
| L3 | 낮음 | `src/components/learning/activity-panels.tsx:421`, `src/app/admin/(dashboard)/learning/learning-overview.tsx:258`(이 커밋이 안 고친 파일) | ⑥ 뒤 담임은 다른 학급 과제를 읽지 못하므로, 자기 학생의 ⑥ 전 교차 제출물·반 옮기기 전 제출물이 학생 상세에서 "**삭제되었거나 비공개인 과제**", 학습 현황 최근 활동에서 "**삭제된 과제**"로 보인다(과제는 지워지지 않았음). | 가짜 서버: 여우반 담임이 최별(⑥ 전 부엉이반 A1에 제출) 상세 → "삭제되었거나 비공개인 과제", 개요 → "삭제된 과제"(`rv-r4-*.png`). | "볼 수 없는 과제(다른 학급 과제이거나 삭제됨)"처럼. 확인 쿼리 1이 0이면 급하지 않다. |
| L4 | 낮음 | `supabase/migrations/20260927030000_content_owner_only.sql:133-163`(⑤ 머리말 되돌리기) | "⑥ 적용 뒤에는 ⑥ 되돌리기를 먼저"라는 경고가 ⑥ 머리말(208-210행)에만 있고 ⑤ 되돌리기에는 없다(⑤ Review R4 "두 머리말을 맞출 것"). ⑤ 되돌리기만 보고 쓰면 옛 `for all`이 되살아나 교사의 읽기·만들기가 모든 과제·학급으로 넓어진다. | 읽어서. ⑤는 아직 실행 전이라 주석 한 줄을 더해도 된다(실행 부분 변경 없음). | ⑤ 되돌리기 첫 줄에 "⑥(20260927040000)을 적용했으면 ⑥의 되돌리기를 먼저 Run" 추가. |

참고(발견 아님)
* **R1 ⑥ 실행 → push 사이**(지금 배포 `e774b11` 화면): 담임 새 과제 저장 실패("과제를 저장하지 못했습니다." — 머리말대로), 내 과제 수정·공개 전환은 된다. 머리말에 없는 것: 총괄 과제 목록에 **다른 반 과제까지 학급 이름 없이 섞여** 보이고("여우반 실험 보고서 · 제출 0 / 3명"), 그 과제 제출 현황 명단에 총괄 반 학생이 모두 "미제출"로 나온다(`old-o2-*.png`). 학생 화면은 그대로 자기 반 과제만. push 뒤에도 HTML 캐시(최대 10분) 동안은 예전 화면이 나올 수 있다.
* **R2** 목록은 학급 범위라, 담임이 만들었지만 다른 학급으로 간 과제(채우기 (나)로 부엉이반에 간 "학급 없던 때 만든 과제" 등)는 그 담임 목록에 안 나온다(RLS로는 읽히고 ⑤대로 고칠 수 있음 — Build §5와 같음).
* **R3** 학급 없는 학생(OAuth 방문자 등)·비로그인은 이제 과제 0(개정 3-2 의도). 지금 공개 과제 0개(STATUS)라 당장 달라 보이는 곳은 없다.
* **R4 채우기 (가)의 가장자리**: 총괄이 아닌 교사가 학급 기능 전에 만든 과제를 부엉이반 학생이 냈고, 그 교사가 지금 다른 학급 담임이면 그 과제는 그 교사 학급으로 가서 부엉이반 학생 화면에서 사라진다. 확인 쿼리 1 "다른_학급_학생_제출물"로 드러나지만, 0이 아닐 때 어느 과제인지 보는 쿼리와 되돌려 옮기는 SQL(학급은 API로 못 바꿈)은 머리말에 없다 — 0이 아니면 그때 드리면 된다.
* **R5** 성공 알림(`raise notice '✔ …'`)은 SQL Editor 결과 창에 안 보일 수 있다(⑤ Review R3와 같음). 성공 판단 = 오류 없이 끝남 + 확인 쿼리 1~3.
* **R6 누르는 영역**: 새 요소(학급 고르기 칸 44px, '학급 개설' 44px, 고칠 때 학급 상자 `min-h-11`)는 맞다. '새 과제' 36px·줄의 수정/삭제 28px은 이 커밋 전과 같다(⑤ Review R2).
* **R7** `my_class_ids()`는 보관 학급도 담아 RLS로는 보관 학급에도 만들 수 있지만, 담임 연결이 남은 보관 학급은 앱에서 생기지 않고(담임 해제 = 연결 삭제 뒤 보관) 화면도 보관 학급을 고르지 않는다.

## 2. 항목 1 — 실행 오류 사냥(⑤ 실행 뒤, 문장별)
사전 점검(스크래치 `review-class-assignments/sql/analyze.mjs` — 주석·문자열·`"…"`·`$$`를 구분하는 토크나이저): 머리말 1–228행은 모두 `--` 주석, 따옴표·`$$` 짝 맞음, **문장 17개**, 주석·문자열 밖 비ASCII 0, NBSP·폭 없는 문자 0, NFC 아닌 글자 0, `raise`의 `%` 개수 = 인자 수(20곳). 정책 이름: 새 3개 57·58·56B(63 안), 옛 읽기 정책 67B(저장 61B — drop도 같게 잘림). 점검 문자열 속 ⑤ 이름 3개("쓴 교사·총괄만 수정/삭제", "교사 본인 이름으로 작성")는 ⑤의 create 이름과 바이트까지 같다(가운뎃점 U+00B7).

| # | 행 | 문장 | 판정 | 근거 |
|---|---|---|---|---|
| S1 | 229–283 | `do $$` 맨 앞 점검 | 통과 | `to_regclass`·`to_regprocedure`(① `my_class_ids()`·`is_super_admin()`, 로그인 잠금 `can_browse()`, ④ `my_student_class_id()` 모두 있음), `pg_policies` 이름·명령(⑤ 3개), `has_column_privilege('authenticated','public.assignments','created_by','UPDATE')` → ⑤의 `revoke update` + 4열 grant 뒤 false, 총괄(②) 있음, `information_schema.columns.data_type`(→ text 변수) — 열 없음이라 null. raise `%` 0·0 ×5, 1·1 ×1. |
| S2 | 289–290 | `alter table … add column if not exists class_id uuid references public.classes (id) on delete restrict` | 통과 | 문법 맞음, `classes.id` = PK(①), 두 표 소유자 postgres, 기존 행은 모두 null이라 외래키 검사 통과. 표 잠금이 트랜잭션 끝까지라 S6~S7 사이에 빈 값 행이 새로 생길 수 없다. |
| S3 | 292 | `create index if not exists … (class_id, created_at desc)` | 통과 | 두 열 있음(`created_at` = `20260921020000:228`). |
| S4 | 300–318 | 채우기 (가) `update … set class_id = (select … order by ct.created_at, ct.class_id limit 1) where … exists (…)` | 통과 | `class_teachers(class_id, teacher_id, created_at)`·`classes.archived_at`(①) 있음, 바깥 별칭 `a` 참조 가능, uuid = uuid. 도는 트리거는 `assignments_updated_at`(`set_updated_at`)뿐(전체 검색). postgres = 소유자라 RLS 무관(③의 `update member_directory`와 같은 꼴). |
| S5 | 322–334 | 채우기 (나) | 통과 | 상관없는 하위 쿼리, `profiles.role` text, `is_super_admin` boolean. 결과가 없으면 null로 남아 S6가 잡는다. |
| S6 | 337–345 | `do $$` 못 채운 과제 점검 | 통과 | `count(*)`(bigint) → int 변수. 지금 DB는 총괄 = 부엉이반 담임(보관 안 함)이라 0. 남으면 한국어 문구로 멈추고 전부 되돌린다. |
| S7 | 347 | `alter column class_id set not null` | 통과 | S6 뒤라 null 0. 남았다면 S6가 먼저 알아듣는 문구로 멈추므로 23502 영어 문구가 사용자에게 가지 않는다. |
| S8 | 354 | `drop policy if exists "…관리자는 전체 조회"`(67B) | 통과 | 만들 때와 같은 방식으로 61B로 잘려 맞음 + "will be truncated" NOTICE(③이 78B 이름을 같은 방식으로 지워 실제로 통과). |
| S9·S11·S14 | 358·369·388 | 새 이름 drop | 통과 | 첫 실행은 NOTICE(skipping)만. |
| S10 | 359–366 | 학생 조회 `for select to authenticated using (published and (select can_browse()) and class_id = (select my_student_class_id()))` | 통과 | 절 순서 맞음, boolean, uuid = uuid(스칼라 하위 쿼리 — 배열 아님). |
| S12 | 370–380 | 교사 조회 `is_admin() and (class_id = any (public.my_class_ids()) or created_by = auth.uid() or is_super_admin())` | 통과 | `my_class_ids()` = `uuid[]`(①:160) → `uuid = ANY(uuid[])`. 괄호가 한 겹이라 하위 쿼리로 읽히지 않는다(④의 42883 원인 꼴이 아님, ① classes 정책·④ 고친 판과 같은 꼴). |
| S13 | 386 | ⑤ 작성 정책 drop | 통과 | 46B, ⑤:215와 바이트 같음. |
| S15 | 389–396 | 작성 `for insert to authenticated with check (is_admin() and created_by = auth.uid() and class_id = any (public.my_class_ids()))` | 통과 | S12와 같은 꼴. |
| S16 | 402–569 | `do $$` 맨 끝 점검 | 통과 | 5-1 `relrowsecurity`, 5-2 `data_type`·`is_nullable`('NO'), 5-3 `conkey = array[(select attnum …)]`(int2[] = int2[])·`confdeltype = 'r'`·`confrelid = 'public.classes'::regclass`, 5-4 `(values …) as e(p,c)`(text) ↔ `policyname`(name — name = text 연산자 있음), 5-5 `not in`, 5-6 `roles <> '{authenticated}'::name[]`·`roles::text`, 5-7 `case policyname::text when …`, 5-8·5-9 `has_column_privilege`·`has_function_privilege`(인자 모두 문자열 → (name,text,text,text)), 5-10 `coalesce(with_check, qual, '')`, 요약 `string_agg(format(…) order by …)`. raise `%` 모두 일치. |
| S17 | 572 | `notify pgrst, 'reload schema'` | 통과 | 커밋 때 전달. |

머리말 확인 쿼리 0)~9)와 되돌리기도 같은 방식으로 봤다: 한글 별칭, `set local role`(한 번 Run = 암묵 트랜잭션이라 동작 — ③·⑤와 같은 꼴), `do` 블록(6은 결과와 상관없이 오류로 끝남, 7·8은 거부되면 NOTICE로 끝나고 저장 0, insert 줄마다 `where current_user = 'authenticated'`) 모두 맞다. 6)에서 RLS 거부(42501)는 `insufficient_privilege`로, 이미 낸 과제는 RLS를 통과한 뒤 `unique_violation`으로 잡혀 문구가 맞게 나온다. 되돌리기 블록은 옛 정의(`20260923020000:74-76`, ⑤:215-218)와 글자까지 같다.

## 3. 항목 2 — 점검 헛실패·헛통과
* **맨 앞**: ⑤ 직후 DB에서 모든 조건이 기대대로 → 통과. ⑤ 전이면 "먼저 ⑤"로 멈춘다(아무것도 안 바뀜). ⑤의 실행 부분은 ⑤ 검토 뒤(`bca38df` → `0d9d8e1`) 주석만 바뀌었다(비주석 변경 0 확인).
* **5-7 조건 글자**: 찾는 글자가 함수 이름+`()`와 `published`뿐이라 `pg_get_expr` 표시(스키마 `public.`/`auth.` 유무, `( SELECT can_browse() AS can_browse)`, `(class_id = ANY (my_class_ids()))`, `(published AND …)`)와 상관없이 맞다. `is_super_admin()` 안에는 `is_admin()` 글자가 없어 학생 정책의 "is_admin() 없음"도 헛실패하지 않는다.
* **5-10 제출 정책 전제**: 지금 제출 작성 정책은 "본인이 공개 과제에 제출" 하나(INSERT·ALL 중 — ③이 안 바꿈)이고 다시 그린 식이 `((auth.uid() = user_id) AND (EXISTS ( SELECT 1 FROM assignments a WHERE ((a.id = assignment_submissions.assignment_id) AND a.published))))` → 'assignments' 있음('assignment_submissions'에는 그 글자가 없음) → 통과. 이름 확인도 통과.
* **5-6·5-8·5-9**: ⑤의 수정·삭제 정책도 `to authenticated` → `{authenticated}`. class_id 새 열은 열 권한이 없고 ⑤가 표 단위 UPDATE를 거뒀으므로 UPDATE false, 표 단위 INSERT(기본 권한)는 남아 class_id INSERT true. `is_admin()`은 PUBLIC 기본 실행, 나머지 4개는 `grant … to public`.
* 실제 DB에 대시보드에서 따로 만든 허용 정책이 있으면 5-5가 이름을 알려 주고 전부 되돌린다(안전한 실패).

## 4. 항목 3 — 권한 결과(⑤ + ⑥ 뒤, SQL로 따짐)
| 행위자 | 읽기 | 만들기 | 고치기·지우기(⑤) | 제출 |
|---|---|---|---|---|
| 비로그인 | 모두 0행(정책이 모두 `to authenticated`) | 42501 | 고치기 42501(UPDATE 권한 없음) · 지우기 0행 | 42501 |
| 부엉이반 학생 | 부엉이반 **공개** 과제만 / 다른 반·비공개 0행 | 42501 | 0행(학급·만든 사람 열은 42501) | 부엉이반 공개만 / 다른 반·비공개 42501 |
| 다른 반(여우반) 학생 | 여우반 공개만 | 42501 | 0행 | 여우반 공개만 |
| 학급 없는 학생 | 0행 | 42501 | 0행 | 모두 42501 |
| 담임 T2(여우반) | 여우반 전부(비공개 포함) + **자기가 만든 다른 반 과제** / 부엉이반 과제 0행 | 여우반 ○ / 부엉이반·학급 없음 42501 | 자기가 만든 것만(학급 무관) / 동료·총괄 과제 0행 | (교사) |
| 학급 없는 교사 | 자기가 만든 것만 | 모두 42501(화면: "먼저 학급을 개설해 주세요") | 자기가 만든 것만 | (교사) |
| 총괄 | 모든 과제(다른 반 비공개 포함) | 부엉이반(자기 학급) ○ / 다른 반 42501 | 모두 ○ | (교사) |

* **학급을 바꾸는 길 없음**: `class_id`·`created_by` UPDATE 열 권한이 없다(총괄 포함 42501). upsert의 `on conflict do update`도 그 열 UPDATE 권한이 필요해 거부된다. 과제를 쓰는 RPC·함수·트리거·Edge Function은 0(전체 검색). 지우고 새로 만드는 것은 새 과제(제출물은 연쇄 삭제)라 옮기기가 아니다.
* **다른 반 과제에 내는 길 없음**: 제출 작성 정책의 `exists (select … from assignments …)`에 과제 읽기 정책이 걸려 다른 반 과제는 42501. 제출물의 과제 바꾸기는 가드 트리거(③:371)가 거부한다. upsert의 충돌 갈래는 이미 있는 자기 제출물만 고친다(⑥ 전 교차 제출물이 있다면 그 본문만 — 새 제출이 아님).
* **42P17 없음**: 과제 정책이 부르는 함수 5개는 security definer로 profiles·class_teachers·site_settings만 읽고, 과제 정책은 제출물 표를 읽지 않는다(제출물 → 과제 한 방향).
* **지우기 연쇄**: ⑥ 뒤 새 제출물은 그 과제 학급 학생만 만들 수 있으므로 과제를 지우면 그 반 제출물만 지워진다. 예외 = ⑥ 전 교차 제출물(확인 쿼리 1이 센다 — L2), 반을 옮긴 학생(지금은 SQL로만 옮김), 교사가 자기 이름으로 낸 제출물(정책이 역할을 안 보는 예전 그대로).
* 머리말 흉내 시험 5)~8)이 위 표의 핵심 칸을 사용자 DB에서 직접 확인한다.

## 5. 항목 4 — 채우기 데이터
* 규칙: 학급이 빈 행만 → (가) 만든 선생님의 보관 안 한 학급 중 가장 먼저 연결된 것(같으면 id 순) → (나) 나머지(만든 사람 없음·학급 없는 교사·해제된 교사) = 총괄의 보관 안 한 학급 중 가장 먼저 연결된 것 → 못 채우면 멈춤 → not null. 총괄이 학급을 여럿 가져도 총괄 과제는 모두 가장 먼저 연결된 학급(②의 부엉이반)으로 간다 — 지금 학생이 모두 부엉이반이라 맞다.
* 지금 DB: 교사가 총괄 한 명뿐이면 모든 과제 → 부엉이반, 교차 제출물 0. 다른 교사가 학급 기능 전에 만든 과제가 있으면 R4.
* 다시 실행해도 이미 정한 학급은 안 바꾼다. 채울 때 `updated_at`이 실행 시각으로 바뀐다(화면에 안 보이는 값 — 머리말에 적힘).
* 확인 쿼리 0)(학급별 과제·만든 선생님)·1)(학급 없는 과제 0·학급별 수·교차 제출물 수)로 충분히 확인된다.

## 6. 항목 5 — 화면(커밋 사본 빌드, 가짜 서버)
* Build 시험을 **내 빌드에 그대로** 다시 돌림: 127/127. 가짜 서버를 실제 Postgres 오류 순서(학급 없는 새 과제 = 42501)로 바꾸면 126/127(실패 = L1).
* 추가 시험(`tools/review.mjs`): 새 화면 49/51(실패 2 = L1·L2) + 관찰 11, 예전 화면(`e774b11`) 10/10 + 관찰 5, 375·어두움 1.
  * 담임(학급 1): 목록 요청 `class_id=in.(여우반)`, 학급 이름 없음, "제출 1 / 2명", 새 과제 학급 칸 없음 → POST에 class_id, 수정 PATCH 4열. 담임(학급 2): 과제마다 학급 이름, 새 과제 학급 칸 필수(안 고르면 저장 안 됨·`aria-invalid`·빨간 안내), 학습 현황에서 고른 학급으로 시작, 다른 학급에 만들면 목록에 안 넣고 알림, 제출 현황 명단 = 과제의 학급(학급 고르기와 무관), 수정 창의 학급은 보여 주기만. 총괄: 목록은 부엉이반만, 남의 과제 켜짐, 다른 반 과제 주소 → "‘여우반’ 과제의 제출 현황은 그 학급 담임 선생님만 볼 수 있어요."·명단 요청 0·수정 켜짐. 학급 없는 교사: "먼저 학급을 개설해 주세요" + 학급 개설 → 새 학급 범위로 다시 읽음, 새 과제 창 저장 꺼짐. ⑤의 "쓴 선생님과 총괄만" 잠금·문구 그대로(공동 담임 과제).
  * ⑥ 전(열 없음, ⑤만): 첫 요청 42703 → 예전 방식 + "SQL 실행 필요 · …20260927040000…"(담임·총괄 모두), 새 과제는 class_id 없이 저장 성공, 예전 지우기 문구·명단. ① 전: 학급 열을 묻지 않는다.
  * 학생: 부엉이반 = 자기 반 공개 과제만, 요청·화면에 학급 정보 없음, 제출 성공. 여우반(375) = 여우반 과제만. 학급 없는 학생(375) = "아직 올라온 과제가 없어요".
  * 접근성: 학급 칸 44px·Tab으로 닿음·`:focus-visible` 3px 고리(밝음·어두움), '학급 개설' 44px. 대비(밝음/어두움): 목록 학급 이름 19.8/17.18, 학급 안 골랐을 때 빨간 안내 6.64/7.05, 고칠 때 학급 상자 19.13/16.15, "만든 뒤에는 학급을 바꿀 수 없어요." 5.49/6.94, "내 학급 과제가 아니에요" 5.49/7.66, 학급 없음 창 안내 19.8 → 모두 AA. 375 폭: 목록·새 과제 창(밝음·어두움)·다른 학급 제출 현황(밝음·어두움)·학급 없음 창·학생 화면 가로 넘침 0.
  * 모든 시험 콘솔 오류 0·예상 밖 외부 요청 0.
* 코드 읽기: 학생 `my-assignments.tsx`는 안 바뀌었다(학급 열을 읽지 않음). 새 외래키로 PostgREST embed가 모호해지는 곳 없음(profiles↔classes embed를 쓰는 곳 0).

## 7. 항목 6 — 배포 순서
| 상태 | 결과 |
|---|---|
| ⑤만(화면 `e774b11`) | ⑤ Review §6대로 — 남의 것은 서버가 0행, 내 것은 됨. |
| ⑤⑥ + 예전 화면(push 전) | 담임 새 과제 저장 실패("과제를 저장하지 못했습니다." — 원인은 42501, L1), 수정·공개 전환은 됨, 총괄 목록에 다른 반 과제가 섞임(R1), 학생 화면 정상. |
| 화면 먼저(⑤ 전·⑤만) | 새 화면은 예전 방식 + "SQL 실행 필요"로 깨지지 않는다(⑤ 전이면 ⑤ 화면이 서버보다 좁게 막음 — ⑤ Review). 이 순서면 ⑥을 실행할 때 관리자 화면을 열어 둔 선생님은 새로 고쳐야 새 과제가 저장된다(안 고치면 L1 문구). |
| ⑤⑥ + 새 화면 | 설계대로(위 6). |

사용자 안내 순서(머리말대로 권함): ⑤ 전체 Run → ⑤ 확인 쿼리 1·4 → ⑥ 전체 Run(오류 없이 끝나면 성공 — 알림은 안 보일 수 있음) → ⑥ 확인 쿼리 0)·1)(학급없는_과제 0, 다른_학급_학생_제출물은 0이면 정상, 아니면 알려 주기)·2)(정책 5개)·3)(false·false·true·true)·4)(0)·5)(학생 id를 넣고 다른_학급_과제 0·비공개_과제 0)·9) → **바로 push** → 두 사이트 새 코드 확인 → 관리자 화면 새로 고침(HTML 캐시 최대 10분). 6)은 학생 id·과제 id를 넣고 "✔" 확인(오류 모양으로 끝나는 것이 정상), 7)·8)은 두 번째 학급·담임이 생긴 뒤. Edge Function 재배포는 필요 없다.

## 8. 항목 7 — lint·tsc·개인정보·되돌리기
* 커밋 사본에서 `npm run lint` exit 0, 바뀐 5파일 `eslint --max-warnings=0` exit 0, `npx tsc --noEmit` exit 0, `next build` 성공(25쪽). `git show --check` 깨끗, 추가 줄에 `console.log`·`localStorage.clear()`·'우리 반' 0.
* 개인정보: SQL·문서에 이메일·학생 이름 없음(확인 쿼리는 `<학생 id>` 같은 자리표시, 이 보고서의 이름은 가짜 서버 이름).
* 되돌리기: ⑥ 되돌리기는 새 정책 3개를 지우고 옛 읽기 정책(`20260923020000` 원문)·⑤ 작성 정책(원문)을 글자 그대로 되살리며, `class_id`는 값을 남기고 필수만 푼다 — 맞다. **⑥ 되돌리기 → ⑤ 되돌리기** 순서 설명도 맞다(⑤ 되돌리기만 쓰면 옛 `for all`이 ⑥ 작성 정책과 함께 남아 넓어짐). ⑤ 쪽 머리말에는 이 경고가 없다(L4).

## 9. 시험 방법·차단
* `git archive 0d9d8e1`(비교용 지금 배포 `e774b11`)를 스크래치 `review-class-assignments/src-*`에 풀어 저장소 `node_modules`를 링크하고 **그 안에서** 빌드(사본에만 가짜 Supabase 주소·키, `turbopack.root="/"`, `NEXT_TELEMETRY_DISABLED=1`, Geist 글꼴은 Build 도구의 로컬 사본을 `NEXT_FONT_GOOGLE_MOCKED_RESPONSES`로 자기 서버에서 공급). 번들(`_next`) 속 Supabase 주소는 가짜 하나뿐(실 주소는 과학 앱 `config.js`에만 — 시험에서 열지 않음). 저장소 `out/`·`.next/`는 쓰지 않음.
* 자기 정적 서버 8784, 자기 headless Chrome(CDP 9355, 프로필은 스크래치) `--host-resolver-rules="MAP * ~NOTFOUND, EXCLUDE 127.0.0.1"`(안전망 시험: 가로채지 않은 탭에서 가짜·실제 Supabase 주소 모두 Failed to fetch), 탭마다 첫 이동 전부터 CDP `Fetch` 가짜 응답, 캐시 끔. 도구는 Build의 `scratchpad/class-assignments/`를 `review-class-assignments/tools/`로 복사해 포트·주소만 바꾸고, 실제 오류 순서 감싸개(`realistic.mjs`)와 추가 시험(`review.mjs`·`review-375dark.mjs`)을 더했다. 결과 `report-all.json`(127)·`report-realistic-all.json`(126)·`report-review-new.json`·`report-review-old.json`, 스크린숏 `shots/`(`rv-`·`old-` 접두사가 이 검토 것).
* 설치·내려받기·SQL 실행·실 DB 접근·git commit/push·`localStorage.clear()` 0. 다른 포트(8788·8789·9353)·프로세스는 손대지 않음. 서버·Chrome 종료(8784·9355 비어 있음), node_modules 링크 지움. 빌드 사본(약 350MB)은 이 프로젝트에서 `rm -rf`가 막혀 스크래치에 남겨 둠.

## 10. 확인하지 못한 것
* 실제 Postgres·SQL Editor에서의 실행(로컬 없음) — `pg_policies` 표시 모양과 L1의 "RLS가 NOT NULL보다 먼저"는 Postgres 규칙·소스의 처리 순서로 판단했다. 알림(NOTICE) 표시 여부(R5).
* 다시 Run할 때 `add column if not exists … references`가 Postgres 판에 따라 외래키를 하나 더 만드는지 — 만들어도 같은 restrict라 동작·끝 점검에 영향 없음.
* 사용자 DB의 실제 데이터(과제·교사 수, 교차 제출물 수 — 확인 쿼리 0·1로 확인), 대시보드에서 따로 만든 정책 유무(있으면 5-5가 안전하게 멈춤).
* 두 번째 학급·담임으로 실제 교차 확인(확인 쿼리 7·8), 실제 로그인·iPad 화면(모두 가짜 세션·headless).

**사용자에게 실행을 부탁해도 됨** — ⑤ 다음 ⑥의 문장 17개에서 실행 오류가 날 곳을 찾지 못했고(42883 꼴 없음), 맨 앞·맨 끝 점검은 ⑤ 직후 DB와 Postgres가 다시 그린 식에서 헛실패·헛통과하지 않으며, 권한은 설계대로다(학생 = 자기 반 공개 과제만, 만들기 = 자기 학급, 학급 변경·다른 반 제출 불가). 낮음 4건은 드문 경우의 안내 문구·주석이라 실행을 막지 않는다(L1·L2는 push 전에 고치면 좋고, L4는 ⑤ 실행 전 주석 한 줄이면 된다).
