# Review — 반별 구분(개정 1) + 학급별 '선생님 글'(개정 2·2 보충) (2026-09-26)

> 지침 `docs/classes/review-instructions.md`. 코드는 고치지 않았다(이 보고서만 새로 씀). SQL은 실행하지 않고 기존 마이그레이션 13개와 한 줄씩 대조해 읽었다.
> D-2 1번(잠금 켜짐 → 비로그인에게 총괄 글도 안 보임)은 사용자 확정이라 발견으로 적지 않고 화면·RLS 일치만 확인했다(아래 D).

## 0. 한 줄 판정
높음 0 · 중간 1 · 낮음 11. 실행 오류가 날 SQL, 다른 반 기록 누수, 권한 올리기, 학생·교사가 갇히는 경로는 찾지 못했다. 중간 1건(과제 삭제가 다른 반 제출물까지 지움)은 교사가 총괄 1명뿐인 지금은 영향이 없고, **두 번째 담임을 지정하기 전에** 사용자 결정이 필요하다.

## 1. 발견(심각도별)

| # | 심각도 | 파일:행 | 무엇 | 근거·재현 | 제안 |
|---|---|---|---|---|---|
| M1 | 중간 | `supabase/migrations/20260921020000_admin_learning.sql:244-249, 253`(③ `20260927010000_classes_rls.sql:36`이 그대로 둠) | 과제(`assignments`) 쓰기·지우기가 여전히 **교사 누구나**(`is_admin()`)인데, `assignment_submissions.assignment_id`가 `on delete cascade`다. 여우반 담임이 과제 하나를 지우면 **부엉이반 학생 제출물까지** 사라진다(외래키 연쇄 삭제는 RLS를 거치지 않음). 과제 비공개 전환·내용 고치기도 다른 반에 바로 영향. 같은 방식으로 블로그 글 삭제 → `post_reads`(글 읽음 기록) 연쇄 삭제(`:177`). | 개정 1-5가 "교사 누구나 고칠 수 있음"을 열어 두었지만 "학습 기록은 그 반 담임만" 원칙과 부딪치는 결과(다른 반 기록 파괴)는 적혀 있지 않다. 지금은 교사가 총괄 1명뿐이라 영향 없음. | 두 번째 담임 지정 **전에** 사용자에게: 과제 UPDATE/DELETE를 `created_by = auth.uid() or is_super_admin()`로 좁히거나(새 SQL 한 파일), 과제를 학급별로. 결정 전에는 담임 지정을 미룬다고 STATUS에 적기. |
| L1 | 낮음 | `src/app/admin/(dashboard)/notices/notices-view.tsx:123-131` | 쓰던 글 보호가 `beforeunload`(탭 닫기·새로고침)뿐. 쓰는 중에 관리자 메뉴·링크(사이트 안 이동)를 누르면 **묻지 않고** 사라진다. | 시험: 제목·본문을 적은 채 메뉴 '회원 관리' 클릭 → `/admin/members/`로 이동, 확인 창 0개. | 쓰는 동안 메뉴 이동을 확인 창으로 막거나, `sessionStorage` 임시 저장. |
| L2 | 낮음 | `src/components/learning/confirm-dialog.tsx:65-74`(공용, 예전부터) | '선생님 글' 지우기·버리기 확인 창 버튼 높이 **32px**(44px 규칙 미달). 담임 지정 창은 44px. | 측정: 지우기 버튼 h=32. | 공용 창에 `h-11 px-4` 추가(다른 화면도 함께 좋아짐). |
| L3 | 낮음 | `src/app/admin/(dashboard)/admin-overview.tsx:266` | 바로 가기 설명 "**우리 반** 학생에게 보일 글 쓰기" — CLAUDE.md "'우리 반'을 새로 쓰지 않는다". | grep. | "내 학급 학생에게 보일 글 쓰기". |
| L4 | 낮음 | `notices-view.tsx:362` | 총괄 화면 목록 머리 "부엉이반 **학생에게만** 보여요" — 총괄 글은 비로그인 방문자에게도 보여 사실과 다름(쓰기 칸 안내와 어긋남). | 스크린숏 `admin-notice-new.png`. | 총괄이면 "…학생과 로그인하지 않은 방문자에게 보여요". |
| L5 | 낮음 | `src/components/dashboard/stat-tile.tsx:161-179` | 잠금 켜짐 + 비로그인에서도 통계 칸이 개수 요청(HEAD `class_notices?select=id`) 1건을 보낸다. RLS가 0을 돌려주고 칸은 "로그인 필요"로 보여 **새는 것은 없음**(학습게임 칸과 같은 방식). 잠금 여부가 늦게 오면 "0개"가 잠깐 보일 수 있다. | 시험 D2: 목록(GET) 0건, HEAD 1건 → 200. | 선택: 잠금 확인 뒤에 세기. |
| L6 | 낮음 | `supabase/migrations/20260927020000_class_notices.sql:199-229` | `is_super_admin_id(uuid)`·`my_student_class_id()`가 누구나 부를 수 있는 RPC. 전자는 "이 회원 id가 총괄인가"(공개 `profiles.role`로 교사까지는 이미 보임 — 새로 드러나는 것은 교사 중 누가 총괄인지뿐), 후자는 학생 자신의 학급 uuid(이름 아님, 화면에는 안 나옴). | 정책 평가에 PUBLIC 실행이 필요(review S1 원칙) — 설계대로. | 그대로 두어도 됨. 막으려면 API 밖 스키마로(다른 도우미들과 함께, 나중에). |
| L7 | 낮음 | `class_notices.sql:280-285` | 같은 학급의 다른 담임(보조)이 총괄 글의 제목·본문을 고칠 수 있고, 작성자가 총괄이라 **고친 내용이 비로그인 방문자에게 보인다**. | 정책 "담임만 고치기" = 학급 단위. 공동 담임은 SQL로만 생김. | 사용자 확인: 고치기·지우기를 `author_id = auth.uid()`로 좁힐지. |
| L8 | 낮음 | `20260927000000_classes_schema.sql:4-9`, `20260927010000_classes_rls.sql:4-11`, `supabase/functions/admin-*/README.md`(학급 배포 순서) | 번호가 서로 다름: ①·③ 머리말은 "④ 함수 재배포 ⑤ push", ④ 파일·STATUS는 "④ = class_notices.sql". 함수 README 순서에는 class_notices가 없다. | 읽어서. | 한 목록으로 통일: ① schema ② setup ③ rls ④ notices ⑤ 함수 3개 ⑥ push. |
| L9 | 낮음 | `docs/classes/setup-owl-class.sql:4, 26-34` | "여러 번 실행해도 안전"이지만 **나중에** 다시 돌리면 학급 없는 `role='user'` 전부(OAuth 방문자, 담임 해제된 교사)를 부엉이반에 넣고, 부엉이반 이름을 바꾼 뒤면 새 '부엉이반'을 하나 더 만든다. 이메일을 다른 관리자 계정으로 잘못 넣고 ③까지 가면, 다시 돌려도 학생은 옮겨지지 않는다(이미 학급 있음). | 읽어서. | 머리말을 "처음 설정 때 한 번"으로. 잘못 지정했을 때 되돌리는 SQL 두 줄(총괄 표시·`class_teachers` 옮기기)을 대화로 준비. |
| L10 | 낮음 | 예전 마이그레이션 머리말(`20260921020000`·`20260922000000`·`20260923010000` 등) | ③ 뒤에 예전 파일을 "재실행 안전"이라 믿고 다시 돌리면 옛 정책(`is_admin()`)·옛 함수가 되살아나 **소리 없이 다시 넓어진다**. | 옛 파일은 옛 이름 정책을 다시 만들고 함수를 옛 본문으로 덮는다. | STATUS/CLAUDE에 "③ 뒤 예전 마이그레이션 재실행 금지(필요하면 ③도 다시)" 한 줄. |
| L11 | 낮음 | `src/components/dashboard/teacher-posts.tsx:195`(예전부터) | 홈 '더 보기' 버튼 높이 40px(`h-10`). | 읽어서. | `h-11`. |

정보(발견 아님): ③ 끝의 스스로 점검은 글자 `is_admin()`만 찾으므로 대시보드에서 따로 만든 넓은 정책(`using (true)` 등)은 못 잡는다(저장소 기준으로는 없음). `admin_set_role`의 지정(user→admin)은 `is_super_admin`을 끄지 않는다 — 지금은 그 값이 켜진 학생이 생길 길이 없어 영향 없음. 함수의 "학급 SQL 전" 상태 코드가 탈퇴만 400, 나머지 500(문구는 같음).

## 2. A~F 판정과 수치

**A. SQL(읽어서 대조)** — 통과
* A-1 실행 오류: 찾지 못함. ①→②→③→④ 각 시점에 참조하는 표·열·함수가 모두 있음, `create or replace` 8개(③)는 인자 이름·반환형이 지금 정의와 같음, plpgsql 본문의 열·변수 이름 대조 끝, `search_path=''`에서 모든 객체가 스키마를 붙였거나 pg_catalog. 정책 이름: 13개 마이그레이션을 차례로 흉내 낸 스크립트로 확인 — ③의 `drop`이 지금 이름(63바이트로 잘린 2개 포함 — `assignment_submissions: 본인(마감 전·검토 전) 또는 `, `feedback_messages: 본인 발신, 스레드 접근 가능해야`)과 바이트까지 맞고, ③ 뒤 11개 표에 옛 정책이 하나도 남지 않음. 새 정책 이름 최대 61바이트.
* A-2 재실행: ①②③④ 각각 두 번 안전. ③ 뒤 ① 재실행은 ③이 바꾼 것을 건드리지 않음. ② 두 번 = 부엉이반 하나(L9 주의). 가드: ③은 ①·총괄 없으면 전부 거부, ④는 ① 없으면 거부(③ 없으면 알림만 — 서로 독립이라 괜찮음). ③ 끝 점검: 헛실패 없음(`is_super_admin()`·주석에 `is_admin()` 글자 없음), 헛통과는 위 '정보'.
* A-3 42P17: 정책 안 자기 표 재조회 없음. 도우미(`teaches_student`·`can_manage_member`·`is_super_admin`·`my_class_ids`·`my_student_class_id`·`is_super_admin_id`·`can_browse`)는 모두 definer로 profiles·class_teachers·site_settings만 읽음. `feedback_messages`/`read_marks` → `feedback_threads` 정책 → `teaches_student`에서 끝남.
* A-4 권한: 새 표 3개 모두 `revoke all from anon, authenticated` 뒤 필요한 것만(TRUNCATE 없음). 관리자 RPC는 모두 함수 **안에서** 호출자 확인. 정책 도우미는 PUBLIC 실행 → anon 평가 오류 없음(`class_notices` anon 정책: `can_browse`·`is_super_admin_id` 실행 가능). profiles 공개 열 7개 그대로(`class_id`·`is_super_admin`·`must_change_password` 없음), UPDATE는 이름·아바타만. **학생·교사가 자기 `class_id`·`is_super_admin`·`role`을 바꿀 길 없음**(열 권한·정책·트리거·RPC 모두 확인 — `handle_new_user`는 메타데이터에서 이름·아바타만, 역할 변경은 총괄 RPC, 학급은 서비스 롤 함수만). `member_directory`·`classes`·`class_teachers` 쓰기는 RPC·트리거·SQL뿐.
* A-5 누수 표: 아래 §3. 어긋남은 M1·L6·L7뿐. 총괄 예외 없음(`teaches_student()` = `is_admin()` + 그 학생(role user)의 학급이 내 `class_teachers`) 확인.
* A-6 트리거: 새 회원(before insert가 profiles에서 채움)·학급 변경(after update of class_id)·담임 지정(`class_id=null`) 모두 `member_directory.class_id`에 반영. `withdrawal_blocking_fks()`: 새 외래키는 모두 profiles·classes를 가리켜 ①③④ 뒤에도 `{}`. 탈퇴 학생은 profiles(role user·class_id) 그대로라 담임에게 계속 보임. `admin_set_role`: 총괄만·본인 불가·마지막 관리자 불가·"학생 있는 학급을 혼자 맡으면 거부, 빈 학급은 보관"(build-db §0) — 개정 1-2의 까닭(기록이 아무에게도 안 보이는 일 막기)에 맞음, 화면 문구도 같음.
* A-7 ②: 자리표시만(실제 이메일 없음), 없는 이메일·관리자 아닌 계정 거부, 오류 문구에 이메일 없음, 모든 `role='user'`를 부엉이반으로, 총괄·`class_teachers` 연결, 끝에 확인 쿼리.

**B. Edge Function 3개** — 통과. 권한 확인(관리자 → 총괄 여부 → 대상 역할 → 학급)이 `createUser`·`updateUserById`·`deleteUser` **전에** 끝남. 총괄 판정 = 서비스 롤로 `profiles.role`+`is_super_admin`, 담임 판정 = `class_teachers`. `classId`: 형식 400, 남의·없는 학급 403(구분 안 함), 보관 학급 403, 없으면 학급 1개 자동·0개/여럿 400. 교사 줄은 총괄만(그 줄만 invalid). 만든 계정 `class_id` 설정 + 1회 재시도 + 경고. 학급 SQL 전(열 없음)은 아무것도 바꾸지 않고 거부. 옛 화면(classId 없음) 동작 확인. CORS·허용 출처 코드 diff 없음, 새 로그에 비밀번호·이메일 없음. 타입 점검: 스크래치 사본(`npm:` import만 로컬 경로로) + 프로젝트 `tsc 5.9.3` strict + `@supabase/supabase-js 2.116.0` → 3개 통과(일부러 넣은 오류는 잡힘).

**C. 관리자 화면** — 통과(시험 49/49 + 선생님 글 21/21). 총괄: '관리자 · 총괄', 내 학급 카드·총괄 배지, 회원 관리 학급 열·필터(전체·부엉이반·여우반·학급 없음), ⋮ '담임교사로 지정' 확인 창(44px) → `admin_set_role(p_user,'admin')`, 다른 반 학생 상세 = 학급 표시 + 학습 기록 대신 안내(기록 요청 0건) + 초기화·탈퇴 버튼 있음, 학생 응답 명단 `class_id=in.(부엉이반)`, 교사 역할 보임, 잠금 스위치 켬. 담임 1개: 자기 반만, ⋮에 지정/해제 없음, 회원 추가 교사 역할 없음·학급 자동 → 요청 `classId=여우반`, 잠금 스위치 읽기 전용 + "총괄 선생님만 바꿀 수 있어요", 과제 탭 명단 `class_id=in.(여우반)`. 담임 2개: 학급을 골라야 '만들기' 열림, 학습 현황 명단 두 학급. 새 교사: "먼저 학급을 개설해 주세요"(회원 관리·선생님 글). SQL 전: "학급 기능 준비 전" + 예전 동작(`class_id` 열 오류 → 예전 열로 다시 읽음, 잠금 스위치 사용 가능). **선생님 글**: 제목·본문 두 칸만, 총괄 안내 문구, 새 글 = POST `{class_id,title,body}`(author_id 없음), 고치기 = PATCH `id=eq.…` `{title,body}`만, 지우기 = 확인 창(진한 빨강·흰 글자) → DELETE `id=eq.…&select=id`, 101자·5,001자 안내·요청 안 보냄, 학급 2개 고르기·쓰는 동안 잠김, 학급 없음·SQL 전 안내. 메뉴·개요·사용자 메뉴: '글 관리'·'새 글 작성' 없음, '선생님 글'(`/admin/notices/`) 있음. 블로그 `/admin/posts/`·`/admin/write/`·`/post/`는 그대로 열림(남은 진입점: 그 화면들 안의 서로 링크, `/post/` 상세의 관리자 '수정' 링크). 375·768·1280 가로 넘침 0, 어두움 확인, 콘솔 오류 0.

**D. 학생·공개 화면** — 통과(55/55). 비로그인(잠금 꺼짐): 총괄 글만(보조 선생님·다른 반 글 없음), **안내 한 줄 없음**, 펼치면 본문 `pre-wrap`·날짜 없음, `<script>`·`<img onerror>`·`<b>`·`**` 글자 그대로(요소 0·실행 0), 통계 = RLS 개수(6), 요청은 anon `select=id,title,body`/`select=id`뿐, 학급 표·`my_admin_context` 요청 0, 자유게시판 칸·통계 로그인 안내, 1280에서 과학 수업과 좌우 배치. 잠금 켜짐: 목록 요청 0, 홈 로그인 안내, 통계 "로그인 필요", RLS anon 정책에 `can_browse()` — **서로 맞음**(L5 참고). 부엉이반 학생: 자기 반 글 7개(보조 선생님 포함)·다른 반 없음·5개씩 더 보기(offset 5)·통계 7·학급 요청 0. 여우반 학생: 여우반 글만(총괄 글 없음). 학급 없는 회원·SQL ④ 전: "아직 선생님 글이 없어요". `/me/learning/`·`/board/`·`/games/`·`/search/`·`/science/`: 학급 이름·'학급' 글자 0, 학급·선생님 글 요청 0.

**D-2 담당이 정한 것**
1. 잠금 켜짐 → 비로그인 총괄 글 없음: 사용자 확정. 화면·RLS 일치(위 D).
2. 사용자 메뉴도 '선생님 글'로: 맞음(관리자 메뉴·개요와 같은 진입점). 빠진 진입점: 관리자 메뉴 '글 관리', 개요 '글 관리'·'새 글 작성', 사용자 메뉴 '글 관리'·'새 글 작성'. 남은 것: 주소 직접 입력, 블로그 화면끼리의 링크, `/post/` 상세의 관리자 수정 링크.
3. 역할별 정책 2개: 뜻이 같다(비로그인 요청 = anon 역할 = `auth.uid()` 없음). 차이는 잠금 조건(1번)뿐. 로그인한 다른 반 학생·학급 없는 회원은 authenticated 정책만 받아 총괄 글 0 — 시험으로도 확인.
4. anon 열 권한에 `author_id`가 없어도 정책이 `author_id`를 쓰는 것: **맞다**. 열 권한은 질의가 직접 쓴 열(선택·필터·정렬·RETURNING)만 검사하고, 정책 식은 다시 쓰기 단계에서 붙어 그 표 자신의 열은 검사 대상에 들어가지 않는다(검사받는 것은 정책 안의 다른 표·함수 — 문서 "must be able to access any tables or functions referenced in the expression"). ④ 확인 쿼리 3)이 실제 DB에서 바로 확인한다. 만약 틀리면 새는 것은 없고 비로그인 홈 '선생님 글'이 **오류 화면**("불러오지 못했어요"+다시 시도)·통계 칸 오류가 된다(가짜 42501로 재현). 대안 `grant select (author_id) … to anon`은 비로그인에게 보이는 글(총괄 글)의 작성자 id = 총괄의 공개 `profiles.id`만 드러내 위험 낮음.
5. `is_super_admin_id` 공개: 위험 낮음(L6).
6. 쓰기 칸: 제목 1~100자·한 줄(제어 문자 → 빈칸), 본문 1~5,000자 — SQL 제약과 같은 기준(코드 포인트 = `char_length`). 화면 쪽 공백 자르기가 조금 더 엄격(NBSP 등)해 서버 거부는 생기지 않음. 학급 고르기 잠김 확인. 떠날 때 확인은 탭 닫기·새로고침만(L1).

**E. 배포 순서별 상태**는 §4.

**F. 기본 점검** — `npm run lint` 0 · `npx tsc --noEmit` 0 · `npm run build` 성공(25쪽, `/admin/notices` 포함) · `git diff --check` 깨끗(새 파일 줄끝 공백도 0) · `console.log`·`debugger`·`localStorage.clear()`·TODO 0. 공개 저장소: 바뀐·새 파일 45개에서 이메일 0건(가짜 도메인 `class1.local` 제외, `eversunk2-tech.github.io`는 예전부터 있는 허용 출처), 프로젝트 ref·키 0, 실제 이름 없음(보고서의 이름·학급은 시험용 가짜). '우리 반' 새 화면 문구 1곳(L3).

## 3. 누수 표(A-5) — SQL을 읽은 결과 = 개정 1-1·2·2 보충 기대값(어긋남만 표시)
약어: 본 = 본인 행, 자반 = 자기 학급 학생 행, 권한× = anon 표 권한 없음(요청하면 permission denied, 화면은 요청 안 함), 0 = RLS 0행.

| 대상(읽기 / 쓰기) | 비로그인 | 학생 A(부엉이) | 학생 B(여우) | 학급 없는 회원 | 담임 T2(여우) | 새 교사 T3 | 총괄 S(부엉이) | 학급 2개 담임 |
|---|---|---|---|---|---|---|---|---|
| app_results | 0 / × | 본 / 본 추가 | 본 / 본 추가 | 본 / 본 추가 | 자반+본 / 자반 삭제 | 본 / × | 자반+본 / 자반 삭제 | 두 반 / 두 반 삭제 |
| app_progress | 권한× | 본 / 본 | 본 / 본 | 본 / 본 | 자반 / 본 | 본 | 자반 / 본 | 두 반 |
| post_reads | 0 | 본 / RPC 본 | 본 | 본 | 자반 | 0 | 자반 | 두 반 |
| assignment_submissions | 0 | 본 / 본 제출·수정 | 본 | 본 | 자반 / 자반 상태·삭제 | 0 | 자반 / 자반 | 두 반 |
| assignments(내용) | 공개 / × | 공개 / × | 공개 | 공개 | 전체 / **전체**(M1) | 전체 / **전체**(M1) | 전체 / 전체 | 전체 / **전체**(M1) |
| feedback_threads·messages·read_marks | 0 | 본 / 본 스레드만 | 본 | 본 | 자반 / 자반 스레드만 | 0 | 자반 / 자반만 | 두 반 |
| member_directory | 권한× | 0 | 0 | 0 | 자반 | 0 | 전체 | 두 반 |
| 감사 로그 3개 | 권한× | 0 | 0 | 0 | 자반 대상 | 0 | 전체 | 두 반 대상 |
| classes | 권한× | 0 | 0 | 0 | 자기 학급 / RPC | 0 / 개설 | 전체 / 자기 학급만 이름 바꿈 | 2개 |
| class_teachers | 권한× | 0 | 0 | 0 | 자기 줄 | 자기 줄 | 전체 | 자기 줄 |
| class_notices | 총괄 글(잠금 켜지면 0) / × | 부엉이반 글 / × | 여우반 글(총괄 글 ×) / × | 0 | 여우반 / 여우반만 쓰기 | 0 / × | 부엉이반 / 부엉이반만 | 두 반 / 두 반 |
| profiles 열 | 공개 7열 / × | 공개 7열 / 본 이름·아바타 | 같음 | 같음 | 같음 | 같음 | 같음 | 같음 |
| site_settings | 읽기 / × | 읽기 / × | 읽기 | 읽기 | 읽기 / × | 읽기 / × | 읽기 / RPC로 켜고 끔 | 읽기 / × |

| RPC | 비로그인 | 학생 | 담임·새 교사·학급 2개 | 총괄 |
|---|---|---|---|---|
| my_admin_context / create_class | 권한× | 오류 | 자기 정보 / 개설(자기가 담임) | 같음(총괄 true) |
| rename_class | 권한× | 오류 | 그 학급 담임만 | 자기 학급만 |
| admin_set_role / admin_set_login_required | 권한× | 오류 | 오류 | 가능 |
| admin_dashboard_stats | 권한× | 빈 결과 | 자반 숫자 | 자반 숫자(부엉이반) |
| app_result_stats / feedback_thread_summaries | 권한× | 본 | 자반(RLS) | 자반 |
| get_or_create_feedback_thread / mark_thread_read / unread_feedback_count | 권한× | 본 | 자반 | 자반 |
| admin_must_change_password_ids | 권한× | {} | 자반 | 전체 |
| my_student_class_id | null | 자기 학급 uuid(L6) | null | null |
| is_super_admin_id | 누구든 "총괄인가" 답함(L6) | 같음 | 같음 | 같음 |

Edge Function: 비밀번호 초기화·탈퇴 = 총괄 모든 학생·담임 자반(학급 없는 회원은 총괄만), 학생 등록 = 자기 학급만(총괄 포함), 교사 계정 = 총괄만 — 개정 1-1과 같음.

## 4. 배포 순서별 상태(E)

| 상태 | 학생(진행 저장·결과 제출·홈) | 총괄(관리자 화면·회원 추가·초기화·탈퇴) | 비로그인 홈 |
|---|---|---|---|
| ①만 | 그대로 | 그대로 | 그대로 |
| ①② | 그대로 | 그대로. ⚠ 이때 옛 함수로 만든 학생은 학급 없음 | 그대로 |
| ①②③(함수 재배포 전, 옛 화면) | 그대로(본인 정책 불변, 도우미 PUBLIC 실행) | 명단 전체·기록은 부엉이반(= 지금 전원)·스위치·지정 총괄 가능. ⚠ 옛 함수: 새 학생 학급 없음(기록이 누구에게도 안 보임), 초기화·탈퇴는 관리자 누구나(교사 1명이면 무해) | 그대로(옛 화면은 posts) |
| ①②③④(함수 재배포 전) | 같음 | 같음 | 같음 |
| 함수 재배포 뒤·화면 push 전 | 같음 | 옛 화면 + 새 함수: classId 없음 → 학급 1개 자동, 교사 계정·초기화·탈퇴 총괄 가능 | 같음 |
| 모두 끝(push) | 홈 = 자기 담임 글 | 새 화면 | 총괄 글 |
| 화면을 SQL보다 먼저 push | 홈 '선생님 글' 빈 안내, 나머지 그대로 | "학급 기능 준비 전" 예전 동작, 선생님 글은 SQL 안내 | 빈 안내 |
| 화면 push, 함수 재배포 전(SQL 끝) | 그대로 | ⚠ 새 화면이 보낸 classId를 옛 함수가 무시 → 새 학생 학급 없음 | 총괄 글 |
| 함수를 ①·② 전에 재배포 | 그대로 | ⚠ ① 전: 회원 추가·초기화·탈퇴 모두 "학급 설정 필요"로 거부(아무것도 안 바뀜). ①만: 총괄이 없어 초기화·탈퇴 403·학생 등록 "먼저 학급을 개설" | 그대로 |
| ①② 뒤 ③을 잊고 push | 그대로 | 화면은 학급으로 걸러 보이지만 **RLS는 넓은 채**(API로는 전부 보임) | 총괄 글(④가 있으면) |

제안: (1) SQL ①②③④ → 확인 쿼리 → **곧바로** 함수 3개 재배포 → push(학급 없는 새 학생 창을 짧게). 그 사이 학생을 만들었다면 `select count(*) from profiles where role='user' and class_id is null`이 0인지 보고, 아니면 ②를 한 번 더(처음 설정 단계에서만 — L9) 또는 SQL 한 줄로 학급 지정. (2) 두 번째 담임 지정 전 ③ 확인 쿼리 1)(0행)로 ③ 적용을 확인. (3) **③ 되돌리기 SQL**을 미리 준비: ③이 만든 정책 16개 drop + 옛 이름·옛 조건(`is_admin()`) 정책 16개 재생성 + 함수 8개를 지금 정의(0921020000·0922000000·0923010000 본문)로 되돌림. 예전 파일 통째 재실행은 다른 것까지 덮으므로 권하지 않음. 교사 화면에서 학생이 안 보이는 문제는 대개 학급 미지정이라 되돌리기보다 학급 지정이 먼저.

## 5. 대표 스크린숏(showcase, 1280 폭)
`/private/tmp/claude-501/-Users-sungchul-Desktop-classroom/7bf3a39e-3017-4189-b337-1b82aace66bb/scratchpad/review-classes/showcase/`
`super-overview.png`(총괄 개요·학급 카드) · `super-members.png`(학급 열·필터) · `designate-confirm.png`(담임교사 지정 확인 창) · `admin-notice-new.png`(선생님 글 새 글 쓰기) · `home-guest-notices-expanded.png`(비로그인 홈, 펼침) · `home-student-notices.png`(학생 홈). 그 밖 `shots/super-members-dark.png`, `shots/admin-notices-dark-768.png`.

## 6. Supabase 차단 기록
자기 정적 서버 `python3 -m http.server 8798`(스크래치 `site/class1 → out`) + 자기 headless Chrome(CDP 9357, 스크래치 프로필) `--host-resolver-rules="MAP *.supabase.co 127.0.0.1:9, MAP supabase.co 127.0.0.1:9"`. 탭마다 첫 이동 전 CDP `Fetch.enable`(모든 요청): 우리 서버만 통과, Supabase 주소는 가짜 응답(가짜 세션은 로컬 출처 localStorage의 세션 키 하나만 넣고 뺌), 그 밖 호스트는 실패 처리. `Network.setCacheDisabled`. 전 시나리오에서 외부로 나간 요청 0건, 콘솔 오류 0건. 실제 Supabase·Gemini 호출 0, 설치·내려받기 0, SQL 실행·실 DB 쓰기 0, git commit/push 0, `localStorage.clear()` 0. 다른 포트·프로세스 손대지 않음. 끝나고 서버·Chrome 종료.

## 7. 확인하지 못한 것
* 실제 SQL 실행(로컬 Postgres 없음) — 특히 D-2 4번(정책 속 열 권한)은 ④ 확인 쿼리 3), ③의 반별 차단은 ③ 확인 쿼리 2)~5), 탈퇴 안전장치는 `select public.withdrawal_blocking_fks();`로 사용자가 실행 뒤 확인해야 한다.
* 실제 계정 두 개(다른 반 담임)로 교차 확인, 실제 Edge Function 배포·호출(403·자동 학급·교사 줄 invalid), Supabase SQL Editor가 여러 문장을 한 트랜잭션으로 돌리는지(기존 파일들과 같은 가정).
* 실제 iPad·실제 로그인 화면(모두 가짜 세션·headless).

**배포해도 됨** — 실행 오류가 날 SQL·다른 반 기록 누수·권한 올리기·갇히는 경로가 없고 화면 시험 125개가 모두 통과했다. 단 순서(①②③④ → 확인 쿼리 → 함수 3개 재배포 → push)를 지키고, 중간 M1(과제 삭제가 다른 반 제출물까지 지움)은 **두 번째 담임을 지정하기 전에** 사용자 결정·수정이 필요하다(교사가 총괄 1명뿐인 지금은 영향 없음). 낮음 11건은 배포를 막지 않는다.
