# Build 보고서 — 학급별 '선생님 글' (2026-09-26)

> 기준: `docs/classes/spec.md` **개정 2 + 개정 2 보충**(비로그인 = 총괄 선생님 글, 안내 한 줄 없음, 로그인한 다른 반 학생은 총괄 글을 보지 않음), 지침 `build-notices-instructions.md`, 대화로 받은 변경 3건(09-26).
> 반별 구분(개정 1 — SQL ①·③, `build-db-report.md`·`build-ui-report.md`) 위에 올렸다. 그 SQL은 아직 실 DB 실행 전이다.
> 수정 범위: 새 SQL 1개, `src/`, 이 보고서. `supabase/functions/`·`public/`·`scripts/`·`docs/classes/spec.md`·`src/app/page.tsx`(Claude가 바꾼 좌우 배치 그대로)·검색 화면(`search-view.tsx`·`community-post-list.tsx`)은 건드리지 않았다. SQL 실행·실 DB 접속·설치·내려받기·커밋·push 없음.

## 0. 먼저 확인할 것 — 설계에 적혀 있지 않아 Build가 정한 것 2개
1. **'로그인해야만 이용' 스위치가 켜져 있으면 비로그인 방문자에게 총괄 선생님 글도 보이지 않는다.** RLS에서 방문자 정책에 `can_browse()`를 함께 걸었고(블로그 글·자유게시판·학습게임과 같은 잠금 규칙), 홈은 잠금 중에는 지금처럼 "로그인하면 담임 선생님 글을 확인할 수 있어요" 안내를 보인다. 스위치가 꺼져 있으면(기본) 사용자 결정대로 총괄 글이 보인다.
   잠금 중에도 총괄 글을 보이게 하려면: SQL 4-2 정책에서 `(select public.can_browse()) and `를 빼고, `teacher-posts.tsx`의 `locked` 분기(로그인 안내)와 방문자 잠금 확인을 없애면 된다.
2. **오른쪽 위 사용자 메뉴**(관리자일 때)의 '글 관리'·'새 글 작성'도 '선생님 글' 하나로 바꿨다(관리자 메뉴·개요 바로가기와 같은 진입점이라 — 개정 2-2 "진입점만 뺌"). 블로그 화면(`/admin/posts/`·`/admin/write/`·`/post/`·검색)은 **지우지 않았고** 주소로 들어가면 그대로 열린다(빌드 목록에 남아 있음).

그 밖: 개정 2 보충의 예시 정책(하나로 합친 `(auth.uid() is null and is_super_admin_id(author_id)) or …`) 대신 **역할별 정책 2개**로 나눴다(`to anon` = 총괄 글, `to authenticated` = 학생·담임 자기 학급). 뜻은 같다(비로그인 요청 = anon 역할 = `auth.uid()` 없음). 위 1번의 잠금 조건만 더해졌다.

## 1. 만든·바꾼 파일
| 파일 | 내용 |
|---|---|
| `supabase/migrations/20260927020000_class_notices.sql` (새) | ④ 표 `class_notices` + 제약·인덱스·`updated_at` 트리거(기존 `set_updated_at()`), 판별 함수 2개, 열 단위 표 권한, 정책 5개, 맨 앞 점검(①이 없으면 멈춤)·맨 끝 점검(설계와 다르면 전부 되돌림), 맨 위 실행 순서·방법·확인 쿼리 0~6 |
| `src/lib/notices.ts` (새) | 글자 수(한글·이모지 = 1자, DB `char_length`와 같게)·제목/본문 정리·검사, 홈 목록·개수(표가 없으면 조용히 빈 목록·0), 관리자 목록·쓰기·고치기·지우기(RLS로 0행이면 실패로 알림), 한국어 오류 |
| `src/components/dashboard/teacher-posts.tsx` | `posts` → `class_notices`(`id,title,body`, 최신순, 5개씩 더 보기). 날짜 없음, 본문은 **글자 그대로**(`whitespace-pre-wrap` React 텍스트 — `MarkdownViewer` 안 씀). 방문자도 목록(총괄 글), 안내 한 줄 없음, 잠금 중 방문자 = 로그인 안내(잠금 여부를 먼저 확인해 목록 요청도 안 함). 로그인·로그아웃하면 이전 사람 목록을 곧바로 치움 |
| `src/components/dashboard/stat-tile.tsx` | '선생님 글' 칸 = `class_notices` 개수(HEAD count), **누구에게나**(loginOnly 뺌) — RLS가 보이는 개수를 정함. 표가 없으면 0. 블로그 글 수를 세던 도우미(`fetchPostCount`)는 이 칸에서만 쓰여 `CountTile`(source: board·game·notices)로 합침 |
| `src/app/admin/(dashboard)/notices/page.tsx`·`notices-view.tsx` (새) | 관리자 '선생님 글'(§3) |
| `src/components/admin/admin-shell.tsx` | 관리자 메뉴 '글 관리' → '선생님 글'(`/admin/notices/`) |
| `src/app/admin/(dashboard)/admin-overview.tsx` | 바로 가기에서 '글 관리'·'새 글 작성' 빼고 '선생님 글'(우리 반 학생에게 보일 글 쓰기) |
| `src/components/user-menu.tsx` | 사용자 메뉴의 '글 관리'·'새 글 작성' → '선생님 글'(§0-2) |
| `src/app/admin/(dashboard)/layout.tsx` | 주석만 |

* 블로그 코드(`posts` 표·`/post/`·`/admin/posts/`·`/admin/write/`·검색·`post-editor`)는 **한 줄도 지우지 않았다**. `role-change-dialog.tsx`의 "글 관리·회원 관리 화면" 문구는 학급 SQL 전(예전 방식)에만 보이는 문장이라 그대로 두었다.

## 2. SQL·RLS 설계 (`20260927020000_class_notices.sql`)
**표** `public.class_notices(id uuid pk default gen_random_uuid(), class_id uuid not null → classes on delete cascade, author_id uuid default auth.uid() → profiles on delete set null, title text not null, body text not null, created_at, updated_at)`
* 제약(이름으로 지우고 다시 추가): 제목 `char_length(title) <= 100 and char_length(btrim(title)) >= 1 and title !~ '[[:cntrl:]]'`(한 줄), 본문 `char_length(body) <= 5000 and char_length(btrim(body, E' \t\r\n')) >= 1`. 화면이 앞뒤 공백을 빼고 보내므로 저장값 = 화면 글자 수.
* 인덱스 `(class_id, created_at desc, id desc)`, `(author_id)`. 트리거 `class_notices_updated_at` → 기존 `set_updated_at()`.
* 외래키는 `classes`·`profiles`만 가리킨다(auth.users 아님) → 완전 탈퇴 안전장치 `withdrawal_blocking_fks()`에 걸리지 않는다.

**판별 함수**(둘 다 `language sql stable security definer set search_path = ''`, 실행 권한 PUBLIC — `is_admin()`·`my_class_ids()`와 같게)
* `my_student_class_id() → uuid`: `auth.uid()`의 `class_id`. 학생(role 'user')이 아니거나 탈퇴 처리됐거나 비로그인이면 null. (`profiles.class_id`는 공개 열이 아니라 정책에서 직접 읽으면 permission denied → 이 함수로만.)
* `is_super_admin_id(p_user uuid) → boolean`: 그 회원이 `role='admin' and is_super_admin`인가(`is_super_admin()`과 같은 판단). 총괄에서 내려가면 그 사람 글은 방문자에게 더 이상 안 보인다.

**정책 5개**(이름 31~48바이트, 모두 63바이트 안)
| 정책 | 역할·명령 | 조건 |
|---|---|---|
| `class_notices: 학생·담임 조회` | authenticated SELECT | `class_id = (select my_student_class_id()) or class_id = any((select my_class_ids()))` |
| `class_notices: 방문자는 총괄 글만 조회` | anon SELECT | `(select can_browse()) and is_super_admin_id(author_id)` |
| `class_notices: 담임만 쓰기` | authenticated INSERT | with check `author_id = (select auth.uid()) and class_id = any((select my_class_ids()))` |
| `class_notices: 담임만 고치기` | authenticated UPDATE | using·with check `class_id = any((select my_class_ids()))` |
| `class_notices: 담임만 지우기` | authenticated DELETE | using `class_id = any((select my_class_ids()))` |

* 결과: 로그인한 학생 = 자기 학급 글(그 학급의 모든 담임 글), 담임·총괄 = 자기 학급 글(총괄도 다른 반 글은 못 봄), **비로그인 = 총괄이 쓴 글만**(잠금 켜짐이면 0), 로그인한 다른 반 학생·학급 없는 회원 = 총괄 글도 안 보임(개정 2 보충 확정). 쓰기·고치기·지우기 = 그 학급 담임만(같은 학급의 다른 담임 글도 — 학급 단위 게시판).
* **표 권한(열 단위)**: 먼저 `revoke all … from anon, authenticated`(Supabase 기본 권한에는 RLS를 거치지 않는 TRUNCATE도 있음). anon = `select (id, title, body, created_at, updated_at)`만 — 작성자·학급 열은 못 읽는다. authenticated = select 전체 + `insert (class_id, title, body)` + `update (title, body)` + delete. → 작성자는 DB 기본값으로만 정해지고(클라이언트가 보낼 수도 없음), 학급 옮기기·작성자 바꾸기·시각 바꾸기 불가.
* **재귀(42P17) 없음**: 정책이 부르는 함수 4개(`my_student_class_id`·`my_class_ids`·`is_super_admin_id`·`can_browse`)는 모두 security definer로 `profiles`·`class_teachers`·`site_settings`만 읽고, 어느 것도 `class_notices`를 읽지 않는다. 정책 안 서브쿼리 없음.
* **맨 앞 점검**: `classes`·`class_teachers`·`my_class_ids()`·`is_super_admin()`·`profiles.class_id/is_super_admin`이 없으면 "먼저 ①을…" 오류(아무것도 안 바뀜). `can_browse()`·`set_updated_at()`·`profiles.withdrawn_at`이 없어도 오류. ③ 미적용·총괄 없음은 경고(notice)만.
* **맨 끝 점검**(어기면 전부 되돌림): RLS 켜짐, 정책이 정확히 이 5개(모르는 허용 정책이 붙어 있으면 거부), anon 쓰기·작성자/학급 열 읽기·TRUNCATE 없음, authenticated가 작성자·학급·시각 열을 못 씀, 방문자 정책 함수들을 anon이 실행할 수 있음. 성공하면 "✔ 선생님 글(class_notices)을 만들었습니다…".
* 확인 쿼리(파일 맨 위): 0) 흉내 낼 id·학급별/작성자별 글 수, 1) RLS·정책 5개, 2) 권한 7칸, 3) 비로그인 흉내(= 총괄 글 수, 잠금이면 0), 4) 학생 흉내(자기 학급 글 수, 다른 학급 0), 5) 학생 쓰기 거부, 6) 다른 반 담임 읽기 0·쓰기 거부. 5·6의 시험 글은 성공해도 일부러 오류를 내 되돌리므로 **어떤 경우에도 저장되지 않는다**. ③ 파일과 같은 "한 번의 Run = 한 트랜잭션" 방식.

## 3. 화면
**홈 '선생님 글'**(넓은 화면에서는 '최근 과학 수업' 옆 반 칸 — Claude의 `page.tsx` 배치 그대로 확인)
* 제목만 목록(버튼 높이 56px), 누르면 그 자리에서 본문이 펼쳐짐(`aria-expanded`/`aria-controls`), **날짜 없음**, 5개씩 '더 보기'.
* 본문은 글자 그대로: 줄바꿈·들여쓰기 유지, `<script>`·`<b>`·`**`·`<img onerror>`도 글자로만 보이고 실행되지 않음, 긴 주소는 칸 안에서 꺾임.
* 비로그인: 총괄 글 목록(안내 한 줄 없음). 글이 없으면 "아직 선생님 글이 없어요". 잠금 켜짐이면 로그인 안내.
* 로그인 학생: 자기 학급 글만. 학급 없는 학생·글 없음·**표가 아직 없음(SQL 전)** = "아직 선생님 글이 없어요"(오류 화면 대신).
* 통계 칸 '선생님 글': 누구에게나 지금 보이는 글 수(방문자 = 총괄 글 수, 학생 = 우리 반 글 수), 잠금 중 방문자 "로그인 필요", SQL 전 0개.

**관리자 '선생님 글'**(`/admin/notices/`, 관리자 메뉴 둘째 칸)
* 머리: "담임 학급 학생의 홈 화면 ‘선생님 글’에 보여요. 제목과 본문만 쓰면 바로 올라가요." + [새 글 쓰기].
* 목록 "쓴 글": "○○반 학생에게만 보여요", 줄마다 제목·본문 세 줄 미리보기(길면 '본문 모두 보기'), **쓴 날짜·고친 날짜를 작게**(관리용), [고치기]·[지우기](44px).
* 학급이 둘 이상이면 [학급] 고르기(글은 학급마다 따로). 쓰는 동안에는 잠가 다른 학급에 잘못 올리지 않게.
* 쓰기 칸(새 글·고치기 공용, 화면 위쪽): **제목·본문 두 칸만**, 글자 수 안내(제목 0/100, 본문 0/5,000 — 넘으면 빨간 안내, 잘라 내지 않음), "쓴 그대로(줄바꿈 포함) 보여요 — 굵게·링크 같은 꾸밈은 없어요", 빈 칸·초과면 요청하지 않고 그 칸으로 초점. 고치기는 바뀐 것이 없으면 저장 버튼 꺼짐.
* **총괄에게만**: 쓰기 칸에 "총괄 선생님 글은 로그인하지 않은 방문자에게도 보여요."(총괄이 다른 선생님 글을 고칠 때는 표시 안 함 — 작성자가 총괄이 아니면 방문자에게 안 보이므로).
* 지우기: 확인 대화 상자 "이 글을 지울까요? “제목” — 학생 홈 화면에서도 바로 사라지고, 되돌릴 수 없어요." + 진한 빨강·흰 글자 버튼(`danger-button.ts`, 공용 `ConfirmDialog`).
* 쓰던 글 보호: 취소 때 내용이 있으면 "쓰던 내용을 버릴까요?", 저장하지 않은 채 탭을 닫거나 새로고침하면 브라우저가 묻는다(beforeunload). 쓰던 내용은 학급 정보가 잠깐 다시 읽혀도(로그인 만료 등) 화면에 남는다.
* 학급이 없는 담임: "먼저 학급을 개설해 주세요" + [학급 개설](기존 학급 개설 대화 상자) → 개설하면 바로 그 학급 목록. 학급 SQL 전: "학급 기능 준비 전" 안내. 선생님 글 SQL 전: "…20260927020000_class_notices.sql을 실행해 주세요" + [새 글 쓰기] 꺼짐.

## 4. 검증
* `npm run lint` 통과 · `npx tsc --noEmit` 통과 · `npm run build` 통과(25쪽 — `/admin/notices` 추가, `/admin/posts`·`/admin/write`·`/post`·`/search` 그대로).
* 빌드한 `out/`을 스크래치 `notices/site/class1`에 복사(다른 작업의 빌드와 섞이지 않게 링크 대신 복사, `diff -rq`로 같은지 확인) → 자기 정적 서버 `127.0.0.1:8784` + 자기 headless Chrome(CDP 9355, 프로필 `…/scratchpad/notices/chrome-profile`) + `--host-resolver-rules "MAP *.supabase.co ~NOTFOUND"`(가로채기 없는 탭에서 fetch → `Failed to fetch` 확인) + 첫 로드부터 CDP `Fetch`로 모든 요청 가로채기(Supabase는 가짜 응답, 그 밖 호스트는 차단) + `Network.setCacheDisabled`. 가짜 RLS는 SQL과 같은 규칙(anon 열 권한 위반·작성자 열 전송·다른 반 쓰기는 42501로 거부)을 흉내 냈다. **실제 Supabase·Gemini 요청 0건, 외부로 나간 요청 0건, 콘솔 오류 0건.** `localStorage.clear()` 안 씀(이 사이트 세션 키만 넣고 뺌).
* 결과: **117/117 통과**(최종 빌드로 시나리오 12개 A~L 전부 다시 실행 — 방문자 30 · 학생 26 · 관리자 61)
  * 방문자(잠금 꺼짐): 총괄 글 6개만(보조 선생님 글·여우반 글 없음), 안내 한 줄 없음, 날짜 없음, 더 보기(offset 5), 통계 6개, 요청은 모두 anon 읽기 `select=id,title,body`·`select=id`(작성자·학급 열 요청 없음), `<script>` 제목·본문이 글자 그대로(스크립트 실행 흔적 0), 줄바꿈·들여쓰기 유지(`pre-wrap`), 1440에서 과학 수업 옆 반 칸, 375 가로 넘침 없음.
  * 방문자(잠금 켜짐): 로그인 안내, 통계 "로그인 필요", 목록 요청 0건.
  * 부엉이반 학생: 자기 반 7개(보조 선생님 글 포함), 여우반 글 없음, 통계 7개, 요청은 로그인 토큰으로(화면은 학급으로 거르지 않음 — RLS). 여우반 학생: 여우반 2개만(**총괄 글 안 보임**). 학급 없는 학생: "아직 선생님 글이 없어요"·0개. SQL 전: 같은 빈 안내·0개(오류 없음).
  * 담임(여우반): 메뉴·개요·사용자 메뉴에서 '글 관리'·'새 글 작성' 없음·'선생님 글' 있음, 목록 2개·쓴 날짜, 버튼 44px, 빈 칸·101자·5,001자 검사(요청 없음), 새 글 = `POST class_notices` 본문 `{class_id, title, body}`(author_id 없음, 앞뒤 공백 정리) → 목록 맨 위·알림, 고치기 = `PATCH ?id=eq.…` 본문 `{title, body}`만, 지우기 = 확인 창(진한 빨강 `lab(39.9…)`·흰 글자) → `DELETE ?id=eq.…&select=id`, 버리기 확인, 떠날 때 beforeunload, 375 넘침 없음, 다크.
  * 총괄: 부엉이반 7개, "방문자에게도 보여요" 안내(새 글·자기 글 고치기 O, 보조 선생님 글 고치기 X), 본문 모두 보기. 학급 2개 담임: 고르기(너구리반·여우반) → `class_id=eq.여우반`으로 다시 읽음, 쓰는 동안 잠김, 고른 학급으로 올라감. 학급 없는 담임: 개설 안내 → `create_class` → 새 학급 빈 목록. 표 없음·학급 SQL 전 안내.
* 스크린숏(영어 이름) `/private/tmp/claude-501/-Users-sungchul-Desktop-classroom/7bf3a39e-3017-4189-b337-1b82aace66bb/scratchpad/notices/shots/`:
  * 홈: `guest-1-home-notices.png`, `guest-2-expanded-plain-text.png`, `guest-3-home-mobile.png`, `guest-4-login-locked.png`, `student-owl-home-expanded.png`, `student-owl-home-mobile.png`, `student-owl-home-dark.png`, `student-fox-home.png`, `student-before-sql-empty.png`
  * 관리자: `admin-1-overview-shortcuts.png`, `admin-2-user-menu.png`, `admin-3-notices-list.png`, `admin-4-new-notice-editor.png`, `admin-5-after-create.png`, `admin-6-edit-notice.png`, `admin-7-delete-confirm.png`, `admin-8-notices-mobile-editor.png`, `admin-9-notices-dark.png`, `admin-10-super-editor-public-note.png`, `admin-11-super-list.png`, `admin-12-two-classes-picker.png`, `admin-13-new-teacher-no-class.png`, `admin-14-new-teacher-after-class.png`, `admin-15-before-sql.png`
* 시험 스크립트(`serve.mjs`·`lib.mjs`·`backend.mjs`·`run.mjs`·`smoke.mjs`)와 결과 `report-all.json`·`all-run.log`는 같은 스크래치 폴더에 남김(Review용 — 다시 돌리려면 `site/class1`에 `out/`을 다시 복사). 서버·Chrome은 끝나고 종료했다(포트 8784·9355 비어 있음 확인). Chrome 프로필(`notices/chrome-profile`)과 사이트 복사본(`notices/site`)은 지우려 했으나 이 세션의 권한 설정이 `rm`을 막아 스크래치 폴더에 남아 있다 — 지워도 된다.

## 5. 사용자가 할 일 (순서대로 — 앞 단계 확인 쿼리가 맞은 뒤 다음으로)
1. Supabase SQL Editor: **①** `supabase/migrations/20260927000000_classes_schema.sql` → **②** `docs/classes/setup-owl-class.sql`(`'총괄_이메일'`을 대화로 받은 이메일로 바꿔서) → **③** `supabase/migrations/20260927010000_classes_rls.sql` (각 파일 맨 위 확인 쿼리, `build-db-report.md` §6).
2. **④** `supabase/migrations/20260927020000_class_notices.sql` 전체 Run → "✔ 선생님 글(class_notices)을 만들었습니다…" 알림이 보이면 성공(오류면 아무것도 안 바뀜 — 메시지를 알려 주기). 이어서 파일 맨 위 확인 쿼리 1)·2)·3)(비로그인 = 총괄 글 수)·4)(학생 = 자기 반 글 수). 글을 하나 써 본 뒤라야 3)·4)의 숫자가 의미 있다.
3. 터미널에서 함수 3개 다시 배포(`--no-verify-jwt` 붙이지 않기): `npx supabase functions deploy admin-create-member` · `admin-reset-password` · `admin-delete-member`.
4. 화면 push(Claude가 Review 뒤). ④보다 먼저 push돼도 사이트는 멈추지 않는다: 홈은 "아직 선생님 글이 없어요", 관리자 '선생님 글'은 "SQL을 실행해 주세요" 안내.
5. 실제로 확인: 총괄 계정으로 '선생님 글'에 글 하나 → 로그아웃한 브라우저 홈에 그 글이 보이는지, 부엉이반 학생 계정 홈에 보이는지. (다른 담임이 생기면) 그 담임의 글은 그 반 학생에게만 보이고 부엉이반 학생·방문자에게는 안 보이는지.

## 6. 확인하지 못한 것 · 걱정되는 점
1. **실제 SQL 실행**(로컬 Postgres 없음 — 문법·권한·열 권한 동작은 읽어서만 검토). 특히 "정책 안에서 쓰는 열(`author_id`·`class_id`)은 anon에게 SELECT 권한이 없어도 된다"는 Postgres 동작(RLS 조건은 사용자의 열 권한 검사 대상이 아님)에 기댄다. 만약 다르면 방문자 홈이 "불러오지 못했어요"로 보이고 확인 쿼리 3)이 permission denied를 낸다 — 그때는 anon 열 권한에 `author_id`를 더하면 된다(학급 id는 여전히 숨김).
2. `is_super_admin_id(uuid)`는 다른 도우미 함수처럼 누구나 RPC로 부를 수 있어, 회원 id를 넣어 "이 사람이 총괄인가"를 알아볼 수 있다(학습 기록·학급 이름은 드러나지 않음 — 위험 낮음). 막으려면 API에 노출되지 않는 스키마로 옮기는 방법이 있다(이 저장소의 다른 도우미들과 방식이 달라져 이번에는 안 함).
3. 로그인했지만 학급이 없는 회원(OAuth 방문자 등)은 방문자와 달리 총괄 글도 보지 못한다(개정 2 보충 확정대로 "총괄 글은 비로그인에게만").
4. 담임 홈에는 자기 학급 글이 모두(학급이 여럿이면 섞여서, 학급 이름 없이) 보인다 — 학생 화면에 소속 정보를 안 보이는 원칙에 맞춰 이름을 붙이지 않았다.
5. 쓰던 글은 탭 안(메모리)에만 있다. 블로그 편집기처럼 탭 저장소에 임시 저장하지 않는다 — 새로고침·탭 닫기는 브라우저가 한 번 묻는다. 관리자 화면의 "로그인 만료" 알림 문구("이 탭에 임시 저장…")는 블로그 편집기 기준 문장이다(쓰던 글은 새로고침하지 않는 한 화면에 그대로 있다).
6. 같은 학급 담임끼리는 서로의 글을 고치고 지울 수 있다(설계 "그 학급 담임만"). 보조 담임이 총괄 글을 고쳐도 작성자가 총괄이라 방문자에게 계속 보인다.
7. 기존 블로그 글(`posts`)은 이제 홈에 나오지 않는다(공개 글 0개 — 09-26 기준). 상단 검색·`/post/` 주소 정리는 개정 2-2대로 사용자에게 따로 물을 일.
8. 실제 iPad·실제 로그인·실 DB에서 확인하지 못했다(모두 가짜 세션·가짜 응답·headless).
