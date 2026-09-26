# Build 보고 — 과제도 학급별로 (⑥, 2026-09-26)

> 지침 `docs/classes/build-class-assignments-instructions.md`. 사용자 결정 "1번으로 과제도 학급별로 나눠줘"(spec 개정 3-2).
> SQL은 **실행하지 않았다**(로컬 Postgres 없음 — 기존 정의와 한 줄씩 대조 + 구조 점검 스크립트). git commit·push 안 함. ⑤ 파일은 고치지 않았다.

## 0. 한 줄 요약
새 SQL ⑥ 하나로 과제에 학급(`class_id`, 필수)을 붙이고, **학생 = 자기 학급 공개 과제만 · 비로그인 = 없음 · 교사 = 자기 학급 + 자기가 만든 과제 · 총괄 = 전체**, **만들기 = 자기 학급에만**, 학급은 만든 뒤 못 바꾸게 했다. 제출 정책은 그대로 두고(과제 읽기를 거쳐 자기 학급 과제로 저절로 좁아짐) 끝 점검으로 그 전제를 확인한다. 관리자 과제 화면은 학급 범위 목록·학급 고르기·학급 이름, ⑥ 전에는 예전 동작 + "SQL 실행 필요". 가짜 서버 시험 **127/127**, lint·tsc·build 통과.

## 1. 바꾼 파일
| 파일 | 내용 |
|---|---|
| `supabase/migrations/20260927040000_class_assignments.sql` (새, 572행) | 열·외래키·인덱스, 지금 과제 채우기 → not null, 읽기 정책 1→2, 작성 정책 교체, 맨 앞·맨 끝 점검, 확인 쿼리 0)~9), 되돌리기(주석) |
| `src/lib/learning.ts` | `AdminAssignment`(class_id), `fetchAssignments(classIds)` → `{rows, classColumn}`(학급 범위 `class_id=in.(…)`, 열 없으면 예전 방식으로 다시 읽음), `fetchAssignment`(class_id, 없으면 예전 열), `createAssignment(input, classId)`, 안내 `ASSIGNMENT_CLASS_MISSING_MESSAGE`. 학생용 `fetchPublishedAssignments`는 그대로(학급 열을 읽지 않음) |
| `src/app/admin/(dashboard)/learning/assignment-manager.tsx` | 목록 = 학습 현황 학급 범위(학급 고르기와 같이), 학급 여럿이면 과제마다 학급 이름, "제출 N / M명"의 M = 그 과제 학급 학생 수, 학급 없음 → "먼저 학급을 개설해 주세요" + 학급 개설 버튼, 새 과제 창 학급 고르기(1개 자동·숨김 / 여럿 필수 — 학습 현황에서 고른 학급으로 시작 / 0개 안내·저장 꺼짐), 고칠 때 학급은 보여 주기만, 지우기 확인 "○○반 학생 제출물 N건", 서버 거부 문구(23502·42501·PGRST204), ⑥ 전 "SQL 실행 필요" + 예전 "내 학급 전체 기준" 안내. ⑤의 잠금·"쓴 선생님과 총괄만" 그대로 |
| `src/app/admin/(dashboard)/learning/submission-review.tsx` | 학급별 과제의 명단 = **그 과제의 학급 학생**(학급 고르기와 무관), 내 학급 과제가 아니면(총괄이 주소로 연 다른 학급 과제 등) 명단 대신 "내 학급 과제가 아니에요 · ‘여우반’ 과제의 제출 현황은 그 학급 담임 선생님만…", 머리에 학급 이름(여럿·다른 학급일 때), 반을 옮긴 학생의 옛 제출물에 이름 붙임. ⑥ 전은 예전 동작 |
| `src/components/admin/class-controls.tsx` | `ClassSelectField`에 `pickHelp`·`invalid`(선택, 하위 호환 — 회원 추가는 그대로) |
| `src/app/admin/(dashboard)/learning/learning-view.tsx` | 과제 탭의 `WholeScopeNote` 한 줄을 AssignmentManager 안(⑥ 전일 때만)으로 옮김 — 학급별 과제에서는 "내 학급 전체 기준" 안내가 틀린 말이 됨. **지침 목록 밖이지만 같은 과제 화면이라 고침**(2줄) |

건드리지 않음: `public/`·`scripts/`·`supabase/functions/`·홈(`teacher-posts.tsx`·`page.tsx`)·⑤ SQL·학생 화면 `my-assignments.tsx`(RLS로 충분 — 코드 변경 없음)·`use-admin-context.tsx`(기존 `scopeClassIds`·`allClassIds`로 충분).

## 2. SQL ⑥ — 정책 표(옛 정의와 대조)
| 명령 | 옛(파일) | 새 | 조건 |
|---|---|---|---|
| SELECT | "공개된 것은 누구나, 관리자는 전체 조회"(67B→저장 61B, `20260923020000:74-76`) `published or is_admin()` — 지움 | "학생은 자기 학급 공개 과제 조회" (57B) `to authenticated` | `published and (select can_browse()) and class_id = (select my_student_class_id())` |
| SELECT | 〃 | "교사는 자기 학급·자기 과제 조회" (58B) `to authenticated` | `is_admin() and (class_id = any (my_class_ids()) or created_by = auth.uid() or is_super_admin())` |
| INSERT | ⑤ "교사 본인 이름으로 작성" `is_admin() and created_by = auth.uid()` — 지움 | "본인 이름으로 자기 학급에 작성" (56B) `to authenticated` | ⑤ 조건 `and class_id = any (my_class_ids())` |
| UPDATE·DELETE | ⑤ "쓴 교사·총괄만 수정/삭제" | 그대로 | 그대로 |
| 열 권한 | ⑤ `grant update (title, description_md, due_at, published)` | 그대로 → **class_id는 아무도 못 바꿈**(끝 점검) | INSERT는 표 권한 그대로(class_id 넣기 가능) |

* 열: `class_id uuid references classes(id) on delete restrict` — cascade면 과제·제출물(학생 기록)까지 지워지고 set null은 not null과 부딪힘. 학급은 원래 지우지 않고 보관만 하므로(삭제하는 코드 없음 — 검색 확인) 실수 방지용. 인덱스 `(class_id, created_at desc)`.
* 채우기(학급 빈 행만 — 재실행 안전): (가) 만든 선생님의 보관 안 한 학급 중 가장 먼저 연결된 것 → (나) 나머지(만든 사람 없음·학급 없는/해제된 교사) = 총괄의 보관 안 한 첫 학급(부엉이반). 보관 학급은 학생이 없는 학급이라 고르지 않음(가면 아무도 못 봄 — 지침 "가장 먼저 연결된 것"에 이 조건만 더함). 못 채우면 멈춤 → not null. ※ 채울 때 `updated_at`이 실행 시각으로 바뀜(기존 트리거, 화면에 안 보이는 값).
* 두 읽기 정책으로 나눈 까닭: 역할별 조건이 달라 한 식이면 괄호가 깊어짐. 허용 정책은 OR라 결과 같고 두 식은 겹치지 않음(교사 `my_student_class_id()`=null, 학생 `is_admin()`=false).
* 작성 정책 이름을 바꾼 까닭: ⑥ 뒤에 ⑤를 실수로 다시 Run하면 ⑤ 끝 점검 4-2가 이 정책을 "모르는 쓰기 정책"으로 보고 ⑤ 전체를 되돌림 → 학급 조건 없는 옛 작성 정책이 소리 없이 살아나지 않음(Review owner-only R4와 같은 판단).
* **제출 정책은 안 고침**: "본인이 공개 과제에 제출"의 `exists (select 1 from assignments a … and a.published)` 하위 쿼리에도 과제 읽기 정책이 걸림 → 다른 학급 과제면 42501. 학생 본인 삭제(③)의 과제 하위 쿼리도 같음. 끝 점검 5-10이 "모든 허용 작성 정책이 assignments를 확인함"을 검사.
* 42P17 없음: 새 정책이 부르는 함수 5개는 모두 definer로 profiles·class_teachers·site_settings만 읽음. assignments 정책 → 제출물 표 참조 없음(제출물 → 과제 한 방향).
* 배열 비교는 모두 `class_id = any (public.my_class_ids())`(겹괄호 0 — 점검 스크립트로 확인).
* **맨 앞 점검**(하나라도 없으면 아무것도 안 바꿈): 두 과제 표, ①(classes·class_teachers·is_admin·is_super_admin·my_class_ids·can_browse), ④(my_student_class_id), **⑤**(수정·삭제 정책 이름 + 작성 정책(⑤ 또는 ⑥ 이름) + created_by UPDATE 권한 없음), 총괄, 기존 class_id 열이 uuid가 아니면 멈춤.
* **맨 끝 점검**(어긋나면 전부 되돌림): RLS, 열 uuid·not null, 외래키(restrict·열 번호 일치), 정책 5개 이름·명령, 그 밖의 허용 정책 0(옛 "…관리자는 전체 " 포함), 모든 과제 정책 roles = `{authenticated}`(anon 0행), 조건 글자(학생: published·can_browse()·my_student_class_id()·is_admin() 없음 / 교사: is_admin()·my_class_ids()·uid()·is_super_admin() / 작성: is_admin()·uid()·my_class_ids()), 열 권한(class_id·created_by UPDATE 없음 — anon 포함, class_id INSERT·⑤ 4열 UPDATE 있음), 함수 실행 권한, 제출 작성 정책 전제. 성공 알림에 학급별 과제 수.
* 확인 쿼리: 0) 학급별 과제·id 1) 학급 없는 과제 0·학급별 수·**⑥ 전에 다른 학급 학생이 낸 제출물 수**(보통 0) 2) 정책 5개 3) 열 권한 4) 비로그인 5) 학생 읽기 6) 학생 제출(자기 반 — 늘 오류로 끝나 저장 0) 7) 학생 → 다른 반 과제 제출 거부 8) 다른 반 담임 → 부엉이반에 과제 만들기 거부 9) 총괄 = 전체. 6)~8)의 insert는 `select … where current_user = 'authenticated'` + 흉내 확인 가드라 **그 줄만 실행해도 행이 생기지 않음**(⑤ Review L1과 같은 안전장치).
* 되돌리기(주석): 새 정책 3개 지우고 옛 SELECT(`20260923020000` 원문)·⑤ INSERT(원문) 되살림 + `class_id drop not null`(값은 남김). **⑤까지 되돌릴 때는 ⑥ 되돌리기 → ⑤ 되돌리기 순서**(머리말에 적음).
* 구조 점검(`scratchpad/class-assignments/sqlcheck2.mjs`): 문장 17개, 따옴표·`$$` 짝, 괄호, `raise`의 `%` 수 = 인자 수(20곳, 머리말 시험 블록 10곳 따로 점검), 금지 꼴 `any ((select` 0, 정책 이름 바이트(옛 67B 이름만 63 초과 — drop 때 같은 방식으로 잘림), 점검 문자열 속 정책 이름 = create 이름.

## 3. 행위자별 결과(⑤ + ⑥ 적용 뒤)
| 행위자 | 읽기 | 만들기 | 고치기·공개·지우기(⑤) | 제출 |
|---|---|---|---|---|
| 비로그인 | 0행 | 거부 | 거부 | 거부 |
| 학생(부엉이반) | 부엉이반 **공개** 과제만 | 거부 | 거부 | 부엉이반 공개 과제만(다른 반 → 42501) |
| 담임(여우반) | 여우반 과제(비공개 포함) + 자기가 만든 과제 | 여우반에만(부엉이반 → 42501) | 자기가 만든 것만 | (학생 아님) |
| 공동 담임 | 같은 학급 과제 모두 | 자기 학급에만 | 자기가 만든 것만(동료 과제는 잠김) | — |
| 총괄(부엉이반 담임) | **모든 과제**(화면 목록은 부엉이반만) | 부엉이반에만 | 모든 과제 | — |
| 누구든 | — | — | 학급(class_id)·만든 사람 변경 = 42501(열 권한) | — |
* 과제를 지우면 그 과제 제출물만 연쇄 삭제 = ⑥ 뒤에는 그 학급 학생 제출물만(⑥ 전 교차 제출물은 확인 쿼리 1로 셈).
* 학생 화면에는 학급 이름·id가 나오지 않음(학생 요청은 class_id를 읽지 않음). API로 직접 class_id를 고르면 **자기 학급 id**만 보이는데, 이는 이미 공개된 `my_student_class_id()`로도 얻는 값이고 학급 이름은 여전히 못 읽음.

## 4. 시험(가짜 서버) — 127/127
* 방법: `git archive HEAD`(ef23318)를 스크래치에 풀고 작업 파일 5개를 덮어쓴 사본(작업 트리와 `cmp` 일치)에서 `node_modules` 링크 + 가짜 Supabase 주소·키로 `next build`(성공, 25쪽 — 번들 속 Supabase 주소는 가짜 하나, 진짜 주소는 과학 앱 `config.js`뿐·시험에서 안 엶). Geist 글꼴은 이전 리뷰의 로컬 사본을 `NEXT_FONT_GOOGLE_MOCKED_RESPONSES` + 자기 서버로 공급(인터넷 0). 자기 정적 서버 **8791** + 자기 headless Chrome **9362**(`--host-resolver-rules`로 supabase.co 차단 — 가로채기 없는 탭에서 가짜·실제 주소 모두 `Failed to fetch` 확인) + 첫 로드부터 CDP `Fetch` 가짜 응답(⑤+⑥ 가짜 RLS, ⑥ 전 42703/PGRST204, ① 전) + 캐시 끔.
* 결과(13개 화면·세계, 모두 콘솔 오류 0·예상 밖 외부 요청 0):
  * 담임(학급 1개): 목록 요청 `class_id=in.(여우반)`, 여우반 과제 2개만(RLS로 읽히는 "내가 만든 부엉이반 과제"도 빠짐), 학급 이름 없음, "제출 1 / 2명", 새 과제 학급 칸 없음 → POST `class_id=여우반`(created_by 없음), 수정 PATCH 4열(class_id 없음), 지우기 문구, 제출 현황 명단 = 여우반, 다른 학급 과제(A6) → 안내·명단 요청 없음·수정 켜짐(만든 사람), 375 넘침 0.
  * 담임(학급 2개): 학급 고르기 "내 학급 전체(2개)", 과제마다 학급 이름, 새 과제 학급 칸 44px·처음 비어 있음 → 안 고르면 저장 안 됨(alert·aria-invalid) → 곰반 POST, 곰반을 고르면 목록 요청 `in.(곰반)`·새 과제 칸이 곰반으로 시작, 다른 학급에 만들면 목록에 안 넣고 알림, 제출 현황에서 학급 고르기를 바꿔도 명단 = 과제의 학급, 수정 창 학급 보여 주기만, 375·768 넘침 0, 어두운 화면.
  * 총괄: 목록 요청 `in.(부엉이반)`(RLS는 전체라도), 이담임이 만든 부엉이반 과제 켜짐·"만든 선생님 이담임", "제출 2 / 3명"(⑥ 전 다른 반 제출물 안 보임), 지우기 문구, 새 과제 = 부엉이반, 여우반 과제 주소 → "‘여우반’ 과제의 제출 현황은…"·명단 요청 없음·수정 켜짐.
  * 학급 없는 선생님: 목록 대신 열 확인(`select=id,class_id&limit=1`) → "먼저 학급을 개설해 주세요" + 학급 개설 → 개설 뒤 새 학급 범위로 다시 읽고 새 과제 POST에 새 학급.
  * ⑥ 전: 첫 요청 42703 → 예전 방식 다시 읽기, "SQL 실행 필요 · …20260927040000…", 새 과제 class_id 없이 저장, 지우기·제출 현황 예전 문구·명단. 목록 뒤 ⑥ 적용 → 저장 23502 → "설정이 방금 적용됐어요. 화면을 새로 고친 뒤…" → 새로 고치면 학급별. ① 전: 학급 열을 묻지 않음.
  * 서버 거부: 새 과제 42501 → "내가 담임인 학급에만 과제를 만들 수 있어요." 공동 담임 과제 잠김(⑤). 반을 옮긴 학생의 옛 제출물에 이름 표시.
  * 학생: 부엉이반 = 자기 반 공개 과제만·학급 이름/id 없음·요청에 class_id 없음·제출 성공, 여우반(375) = 여우반 과제만.
* lint 0 · tsc 0 · `git diff --check` 깨끗 · `console.log`·`localStorage.clear()`·개인정보·'우리 반' 0.
* 도구·결과: `…/scratchpad/class-assignments/`(`serve.mjs`·`lib.mjs`·`backend.mjs`·`run.mjs`·`sqlcheck2.mjs`·`font-mocks.js`, `report-all.json`, `all-run.log`, 스크린숏 `shots/` 22장 — `multi-1-list-all.png`·`multi-2-new-dialog-pick-required.png`·`super-2-review-other-class.png`·`noclass-1-empty.png`·`pre6-1-list.png` 등). 서버·Chrome 종료(8791·9362 비어 있음), 빌드 사본·Chrome 프로필·node_modules 링크는 지움. 설치·내려받기·SQL 실행·실 DB 접근·git commit/push·`localStorage.clear()` 0.

## 5. 한계·결정 필요
* **목록은 학급 범위만**(지침대로): 담임을 넘긴 교사가 예전에 만든 다른 학급 과제, (나)로 부엉이반에 간 "학급 없던 교사의 과제"는 그 교사 목록에 안 나온다(RLS로는 읽혀 제출 현황 주소로 열 수 있고 ⑤대로 고칠 수 있음). 그 학급 담임·총괄 목록에는 나온다. 교사가 총괄 한 명이면 해당 없음(확인 쿼리 0)의 만든_선생님으로 확인).
* ⑥ 전에 **다른 학급 학생이 낸 제출물**(교차)은 남는다: 그 학생 담임에게 보이지만 학생 화면에선 과제가 사라지고, 과제를 지우면 함께 지워진다. 지금 학생이 모두 부엉이반이라 보통 0(확인 쿼리 1).
* ⑥ 실행 → push 사이에는 **예전 화면에서 새 과제 저장이 실패**(not null). 확인 쿼리 뒤 바로 push. (새 화면은 ⑥ 전에도 안전해 push를 먼저 해도 깨지지 않음.)
* ⑤와의 관계: ⑥의 맨 앞·끝 점검은 ⑤ 정책 이름 3개(`쓴 교사·총괄만 수정/삭제`, `교사 본인 이름으로 작성`)를 바이트 그대로 찾는다 — ⑤ 이름이 바뀌면 ⑥도 같이 바꿔야 함(지금 HEAD f0688bf의 ⑤는 실행 부분 변경 없음, 머리말 시험 줄 가드만 추가 — 확인함). ⑤ 머리말의 되돌리기는 ⑥ 전 상태 전제(R4) → ⑥ 머리말에 "⑥ 되돌리기 먼저" 적음.
* 보관 학급: `my_class_ids()`가 보관 학급을 포함해 RLS상 보관 학급에도 만들 수는 있지만 화면은 보관 안 한 학급만 고르게 함.
* 확인하지 못한 것: 실제 SQL 실행(특히 `pg_policies.qual` 글자 모양 — ⑤·③과 같은 방식으로 스키마 이름과 무관하게 찾음, SQL Editor의 NOTICE 표시), 두 번째 학급·담임으로 실제 교차 확인(확인 쿼리 7·8), 실제 iPad·로그인 화면(모두 가짜 세션·headless).

## 6. 사용자 실행 순서
1. ⑤ `supabase/migrations/20260927030000_content_owner_only.sql` 전체 Run → 성공 + ⑤ 확인 쿼리.
2. ⑥ `supabase/migrations/20260927040000_class_assignments.sql` 전체 Run(⑤가 없으면 아무것도 안 바꾸고 멈춤) → 오류 없이 끝나면 성공(알림 "✔ 과제를 학급별로 나눴습니다(과제 N개 — 부엉이반 N개)…").
3. ⑥ 확인 쿼리 0)~3)·4)·5)·9) Run(1: 학급없는_과제 0·다른_학급_학생_제출물 보통 0, 2: 정책 5개, 3: false·false·true·true, 4: 0, 5: 다른_학급_과제 0·비공개_과제 0). 6)은 학생 id·과제 id를 넣고 ✔ 확인(늘 오류 모양으로 끝나는 것이 정상).
4. 바로 사이트 push(Edge Function 재배포 필요 없음). 두 번째 학급·담임이 생기면 확인 쿼리 7)·8).
