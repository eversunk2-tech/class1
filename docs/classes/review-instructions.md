# 검토 지침(Review) — 반별 구분 + 학급별 '선생님 글' (2026-09-26, spec 개정 1·2·2 보충)

당신은 **Review** 담당이다. **코드를 고치지 않는다**(발견만 기록). 이번 일은 지금까지 중 가장 보안이 중요한 변경이다 — 학생 학습 기록을 **그 반 담임만** 보게 좁힌다. 검토 뒤 Claude가 고치고, 사용자가 SQL ①②③④를 직접 실행하고 함수 3개를 다시 배포한 다음 화면을 push한다. 가장 먼저 찾을 것:
1. **다른 반 기록·명단·글이 새는 곳**(학생·담임·총괄·비로그인 누구로든), 권한 올리기(학생이 자기 `class_id`·`is_super_admin`을 바꾸기, 담임이 남의 학급에 끼어들기 등).
2. **사용자가 실행하면 오류가 나는 SQL**(없는 표·열·함수, 이름·인자가 바뀐 `create or replace`, 정책 이름 불일치·63바이트 초과), 또는 실행은 되지만 **교사·학생이 갇히는 SQL**(학생이 진행 저장·결과 제출을 못 함, 총괄이 관리자 화면을 못 씀, 비로그인 홈이 오류).
3. 학생 화면에 **소속 정보**(학급 이름·id)가 보이거나 학급 표를 부르는 곳.
4. 비밀번호 초기화·탈퇴·계정 만들기가 **권한 확인 전에** 실행되는 곳.
배포를 막아야 하면 "높음"으로 분명히.

## 먼저 읽기
`CLAUDE.md`(Supabase·SQL 적용 절차·로그인·**학급** 줄·커뮤니티의 **홈 '선생님 글'** 줄·서브에이전트 규칙), `AGENTS.md`, `docs/classes/spec.md`(본문 §3과 끝의 **개정 1·2·2 보충** — 개정이 본문보다 우선, 2 보충의 **확정** 문단이 마지막 결정), 지침 `build-db-instructions.md`·`build-ui-instructions.md`·`build-notices-instructions.md`, 보고 **`build-db-report.md`·`build-ui-report.md`·`build-notices-report.md`**.
대상 파일: 새 SQL `supabase/migrations/20260927000000_classes_schema.sql`(①)·`20260927010000_classes_rls.sql`(③)·`20260927020000_class_notices.sql`(④), `docs/classes/setup-owl-class.sql`(②), `supabase/functions/admin-{create-member,reset-password,delete-member}/`(`git diff`), `src/`의 바뀐·새 파일(`git status`·`git diff -- src/`). 기존 마이그레이션 13개(`supabase/migrations/2026092[1-6]*.sql`)는 **지금 실 DB에 적용된 상태**이므로, 새 SQL이 바꾸는 정책·함수의 지금 정의를 거기서 찾아 대조한다.
범위 밖(보지 않음): `public/apps/`·`scripts/templates/`(다른 작업 — 확대 화살표), `supabase/.temp/`.

## 확인할 것

### A. SQL(읽어서 — 로컬 Postgres가 없어 실행할 수 없다. 한 줄씩 대조)
1. **실행 오류가 날 곳 목록**: ①→②→③→④ 순서로 SQL Editor에서 한 번씩 Run할 때 참조하는 표·열·함수가 그 시점에 있는지, 인자 이름·반환형이 바뀌는 `create or replace function`(Postgres가 거부 — 기존 정의와 대조), `drop policy if exists`가 **지금 이름과 정확히** 같은지(한국어, 63바이트에서 잘린 이름 포함 — 다르면 옛 정책이 남아 권한이 그대로 넓음), 새 정책 이름 63바이트 이하(스크립트로 `Buffer.byteLength(…,'utf8')`), plpgsql 본문의 열·변수 이름(생성 때가 아니라 **부를 때** 오류가 나므로 특히 꼼꼼히), `language sql` 함수가 만들 때 참조하는 객체.
2. **재실행 안전**: 각 파일을 두 번 실행해도 되는지, ③ 뒤에 ①을 다시 실행하면 ③이 좁힌 것이 되돌아가지 않는지(①이 다시 쓰는 함수·권한이 ③과 겹치는지), ②를 두 번 실행해도 부엉이반이 하나인지. 가드: ③은 ①·총괄이 없으면, ④는 ①(·③)이 없으면 아무것도 바꾸지 않고 멈추는지. ③ 끝의 스스로 점검(학생 기록·회원 표에 `is_admin()`이 남으면 전체 되돌림)이 맞게 판정하는지(헛통과·헛실패).
3. **42P17 재귀 없음**: 정책이 자기 표를 다시 조회하지 않고 `security definer` 도우미를 쓰는지.
4. **권한(Supabase 기본 권한 주의)**: Supabase는 public 스키마의 새 표에 anon·authenticated **모든 권한**을, 새 함수에 **실행 권한**을 기본으로 준다 — 새 표(`classes`·`class_teachers`·`class_notices`)에서 필요 없는 권한을 회수했는지, 관리자 전용 RPC가 권한 회수만 믿지 않고 **안에서** 호출자를 확인하는지. 반대로 **정책이 부르는 도우미 함수는 그 정책을 평가하는 모든 역할이 실행할 수 있어야 한다** — 특히 `class_notices`는 비로그인도 읽으므로(총괄 글) anon SELECT 권한 + 정책 안 함수들(`is_super_admin_id`·`my_student_class_id`·`my_class_ids` 등)의 anon 실행 권한이 없으면 **비로그인 홈이 오류**가 난다. `profiles`의 열 권한: SELECT 공개 열에 `class_id`·`is_super_admin`·`must_change_password` 없음, UPDATE는 `(display_name, avatar_url)`만 — 학생·교사가 자기 `class_id`·`is_super_admin`·`role`을 바꿀 길이 **어디에도**(열 권한·정책·트리거·RPC) 없는지. `member_directory`·`class_teachers`·`classes`를 쓸 수 있는 길이 RPC·SQL뿐인지.
5. **누수 표(핵심)**: 행위자 {비로그인, 학생 A(부엉이반), 학생 B(여우반), 학급 없는 학생·OAuth 방문자, 담임 T2(여우반), 학급 없는 새 교사 T3, 총괄 S(부엉이반 담임), 학급 2개 담임} × 대상 {`app_results`, `app_progress`, `post_reads`, `assignments`, `assignment_submissions`, `feedback_threads`, `feedback_messages`, `feedback_read_marks`, `member_directory`, 감사 로그 3개, `classes`, `class_teachers`, `class_notices`, `profiles` 열, `site_settings`} × {읽기, 쓰기}와 RPC {`my_admin_context`, `create_class`, `rename_class`, `admin_set_role`, `admin_set_login_required`, `admin_dashboard_stats`, `app_result_stats`, `feedback_thread_summaries`, `get_or_create_feedback_thread`, `mark_thread_read`, `unread_feedback_count`, `admin_must_change_password_ids`, `my_student_class_id`, `is_super_admin_id`}를 **개정 1-1 권한 표·개정 2·2 보충의 기대값**과 SQL을 읽은 결과로 채운 표. 어긋나는 칸은 모두 발견으로.
   * 총괄에게 다른 반 학습 기록 **예외가 없는지**(`teaches_student()`), 비밀번호 초기화·탈퇴는 모든 반(함수 쪽).
   * `class_notices`: 비로그인 = 총괄이 쓴 글만, 로그인한 학생 = 자기 학급 글만(**다른 반 학생은 총괄 글도 못 봄**), 담임 = 자기 학급 글, 쓰기·고치기·지우기 = 그 학급 담임만, INSERT `author_id = auth.uid()`, **UPDATE로 `class_id`를 남의 학급으로 옮기거나 `author_id`를 총괄로 바꿔 비로그인에게 보이게 하는 길**이 막혔는지, 제목·본문 길이 제약.
   * 학생 본인 기록 쓰기(`app_progress` upsert, `app_results` insert, 과제 제출, 피드백 보내기·읽음 표시)가 ③ 뒤에도 그대로 되는지 — 정책의 `with check`와 도우미 함수 실행 권한까지.
6. **트리거·이관**: `profiles.class_id` → `member_directory.class_id` 동기화(새 회원·학급 변경·담임 지정 때 비우기), `admin_set_role`(총괄만·자기 자신·마지막 관리자·담임 해제 규칙 — 보고서 §0의 결정), `withdrawal_blocking_fks()`가 ①③④ 뒤에도 `{}`인지(새 외래키가 탈퇴 때 기록을 지우지 않는지), 탈퇴한 학생 기록이 담임에게 계속 보이는지.
7. **②(setup-owl-class.sql)**: 자리표시(`'총괄_이메일'`)만 있고 실제 이메일이 없는지, 관리자가 아닌 계정·없는 이메일이면 거부, 모든 `role='user'`를 부엉이반으로, 총괄 지정·`class_teachers` 연결, 끝 확인 쿼리.

### B. Edge Function 3개(`git diff -- supabase/functions/`)
권한 확인이 **바꾸기·지우기·만들기 전에** 끝나는지, 총괄·담임 판정(서비스 롤로 `profiles.role, is_super_admin`·`class_teachers`), `classId` 검사(형식·내 학급·보관 학급), 교사 줄은 총괄만, 만든 계정에 `class_id` 설정·실패 처리, 학급 SQL 전(열·표 없음) 동작, **옛 화면(`classId` 없이)** 호출 때 동작, 오류 코드·한국어 문구, CORS·허용 출처 코드가 바뀌지 않았는지, 로그에 비밀번호·이메일 없음. 타입 점검은 DB 담당처럼 스크래치 사본 + 프로젝트의 `tsc`로(설치 금지).

### C. 관리자 화면(`/admin/…`)
화면 담당의 시험 도구(`…/scratchpad/classes-ui/`의 `lib.mjs`·`backend.mjs`·`run.mjs`)는 **자기 스크래치 폴더로 복사해서** 고쳐 쓴다(원본은 건드리지 않음). 경우: 총괄 / 담임(학급 1개) / 담임(학급 2개) / 학급 없는 새 교사 / 학급 SQL 전(예전 동작 + "학급 기능 준비 전") — 각 화면이 개정 1-1대로 보이고 보내는 요청(RPC 이름·인자·`class_id=in.(…)` 필터·`classId`)이 맞는지. **관리자 '선생님 글'**: 내 학급 글 목록·새 글(제목·본문 두 칸)·고치기·지우기(확인 + 위험 버튼), 학급 2개면 고르기, 학급 없으면 "먼저 학급을 개설해 주세요", 총괄에게 "총괄 선생님 글은 로그인하지 않은 방문자에게도 보여요." 안내. 메뉴·개요에서 '글 관리'·'새 글 작성'이 빠지고 '선생님 글'이 들어갔는지, 블로그 주소(`/post/`, `/admin/posts/`, `/admin/write/`)와 코드는 남아 있는지. 375·768·1280 폭 가로 넘침 없음, 어두움, 새 버튼·입력칸 44px·초점·라벨.

### D. 학생·공개 화면(회귀 없음·소속 정보 없음)
* 비로그인 홈: '선생님 글' = 총괄 글 목록(**"로그인하면 … 볼 수 있어요" 같은 안내 한 줄이 없어야 함**), 누르면 본문(날짜 없음), '선생님 글' 통계 칸 = RLS가 주는 개수, 학급 표·`my_admin_context` 요청 0, 자유게시판 칸들은 여전히 로그인 안내, '최근 과학 수업'·'선생님 글' 좌우 배치(`src/app/page.tsx`) 그대로. 로그인 잠금 스위치가 켜졌을 때 비로그인 '선생님 글'이 어떻게 되는지(화면·RLS가 서로 맞는지) 적는다.
* 로그인 학생 홈: 자기 학급 글만(가짜 RLS), 본문은 **글자 그대로**(`<script>`·`<img onerror>`·마크다운이 글자로만 보임, 줄바꿈 유지, 긴 주소 줄바꿈), 날짜·조회수 없음, 5개씩 더 보기.
* `/me/learning/`·`/board/`·`/games/`·`/search/`·과학수업 페이지: 학급 이름·id가 어디에도 없고 학급 관련 요청 0, 예전과 같은 화면.

### D-2. 선생님 글 Build 담당이 정한 것(보고서 "먼저 결정할 것") — 맞는지 판정
1. 로그인 잠금 스위치가 켜지면 비로그인에게 총괄 글도 안 보임(정책에 `can_browse()`, 홈은 잠금 안내) — 다른 콘텐츠(블로그·게시판·게임) 규칙과 맞는지, 화면·RLS가 서로 맞는지.
2. 오른쪽 위 사용자 메뉴의 '글 관리'·'새 글 작성'도 '선생님 글'로 바꿈 — 빠진 진입점·남은 진입점 목록.
3. 합친 정책 대신 역할별 정책 2개(`to anon` / `to authenticated`) — 뜻이 같은지(특히 **로그인한 다른 반 학생·학급 없는 회원은 총괄 글을 못 봄**).
4. anon 열 권한이 `id, title, body, created_at, updated_at`뿐인데 anon 정책이 `author_id`를 쓴다 — **정책 식 안의 열은 열 권한 검사를 받지 않는다**는 Postgres 동작에 기댄다(담당 보고). Postgres 문서·소스 지식으로 이 동작이 맞는지 판정하고, 틀리면 비로그인 홈이 어떻게 되는지(오류 화면인지 "아직 선생님 글이 없어요"인지)와 안전한 대안(예: anon 열 권한에 `author_id` 추가 — 드러나는 정보가 무엇인지)을 적는다.
5. `is_super_admin_id(uuid)`를 누구나 부를 수 있음 — 드러나는 정보(공개 열 `profiles.role`로 이미 알 수 있는 것과 비교)와 위험 판정.
6. 관리자 '선생님 글'의 쓰기 칸: 글자 수 제한이 SQL 제약(제목 1~100자·한 줄, 본문 1~5000자)과 같은지, 떠날 때 확인, 학급 고르기 중 잠김.

### E. 배포 순서별 상태
①만 / ①② / ①②③ / ①②③④(함수 재배포 전) / 함수 재배포 뒤·화면 push 전 / 화면을 SQL보다 먼저 push — 각 상태에서 학생(진행 저장·결과 제출·홈), 총괄(관리자 화면·회원 추가·초기화·탈퇴), 비로그인 홈이 어떻게 되는지 표로. 문제가 되는 상태와 되돌리는 방법(③을 되돌려야 할 때 등)을 제안으로.

### F. 기본 점검
`npm run lint`, `npx tsc --noEmit`, `npm run build`(이 검토만 빌드한다 — 끝나면 `out/`는 그대로 둔다), `git diff --check`, 임시 코드·`console.log`·`debugger`·`localStorage.clear()` 없음. **저장소 공개 규칙**: 새·바뀐 파일(SQL·문서·코드)에 이메일·학생 이름 같은 개인정보가 없는지 grep. 화면 문구에 특정 학급을 가리키는 '우리 반'을 새로 쓰지 않았는지.

## 사용자에게 보여 줄 대표 스크린숏(6장) — `…/scratchpad/review-classes/showcase/`
총괄 개요(학급 카드), 총괄 회원 관리(학급 열·필터), 담임교사 지정 확인 창, 관리자 '선생님 글' 새 글 쓰기, 홈 비로그인 '선생님 글'(펼친 상태), 홈 학생 '선생님 글'. 파일 이름은 영어·숫자만.

## 테스트 규칙(반드시)
* 빌드한 `out/`을 자기 정적 서버로: 스크래치에 `class1 → /Users/sungchul/Desktop/classroom/out` 링크를 만들고 `python3 -m http.server 8798 --bind 127.0.0.1 --directory <스크래치 폴더>` → `http://127.0.0.1:8798/class1/`. dev 서버는 쓰지 않는다. 끝나면 종료.
* 자기 전용 headless Chrome만(포트 **9357**, 프로필은 스크래치 `/private/tmp/claude-501/-Users-sungchul-Desktop-classroom/7bf3a39e-3017-4189-b337-1b82aace66bb/scratchpad/review-classes/` 안), `--headless=new --host-resolver-rules="MAP *.supabase.co 127.0.0.1:9, MAP supabase.co 127.0.0.1:9"`, Node 24 전역 WebSocket으로 CDP(설치 금지), **첫 로드 전부터** CDP `Fetch.enable`(`*supabase.co*`) 가짜 응답만(가짜 세션은 로컬 출처 localStorage `sb-<ref>-auth-token`에만 — ref 값은 문서에 적지 않음), **`Network.setCacheDisabled`로 캐시 끄기**. 실제 Supabase·Gemini 요청 금지, **아무것도 내려받거나 설치하지 않는다**.
* `localStorage.clear()` 금지, 다른 탭·프로세스·다른 Chrome·다른 포트(8784·8788·8789·8796·8797·9353·9355·9356은 다른 작업) 건드리지 않기, git commit/push·실 DB 쓰기·SQL 실행 금지. 저장소 파일은 보고서 하나만 새로 쓴다(`npm run build`의 `.next/`·`out/`은 예외). 끝나면 자기 Chrome·서버 종료, 스크린숏만 남기고 정리(지우기가 거부되면 보고).

## 보고서 `docs/classes/review.md`
심각도별 발견 표(파일:행, 무엇, 재현 또는 근거, 제안), A~F 판정과 수치, **누수 표**(A-5), 배포 순서별 상태 표(E), showcase 목록, Supabase 차단 기록, 확인하지 못한 것(실제 SQL 실행·실제 계정 두 개로 교차 확인·실제 함수 호출 등) — 한국어로 간결하게. 마지막 줄에 **"배포해도 됨 / 고친 뒤 배포"** 판단과 까닭.
