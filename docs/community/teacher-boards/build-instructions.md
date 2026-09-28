# Build 지침 — 자유게시판을 담임교사별로 (2026-09-28, 사용자 승인 "응 구현 시작해줘")

> 설계: **`docs/community/teacher-boards/spec.md`** — 본문 + 끝 **"Claude 검토 메모"(R1~R4, 정해진 것)가 본문보다 우선**. 사용자 결정: 게시판 = 담임 한 명마다 하나(그 담임의 학급 학생들이 함께), 담임 둘인 학급은 두 게시판 모두(2개 이상이면 고르기), 총괄은 관리용으로 모든 게시판(쓰기는 자기 게시판), 학습게임(`kind='game'`)은 그대로 함께, 기존 글은 글쓴이의 담임 게시판으로, 학급 없는 계정은 게시판 없음.
> 보고서: `docs/community/teacher-boards/build-report.md`. 이 작업만 한다 — `public/apps/`·`scripts/templates/`·실험 앱은 건드리지 않는다.

## 만들 것·고칠 것
1. **새 마이그레이션 `supabase/migrations/20260928010000_teacher_boards.sql`**(재실행 안전, 앞선 파일 고치지 않음, 파일 위 실행 방법·실행 전 확인(게시판 글 수·담임 둘 이상인 학급 수)·실행 뒤 확인 쿼리·되돌리기 안내, 맨 끝 점검 — 설계와 다르면 `raise exception`으로 전부 되돌림, **개인정보 없음**):
   * `community_posts.board_owner uuid references public.profiles (id) on delete set null`(R1 — `restrict` 아님) + `check (kind = 'board' or board_owner is null)` + 게시판별 조회 인덱스. `board_owner`는 INSERT 열 권한에만(수정 불가).
   * 함수: `my_board_owner_ids()`, `can_use_board(uuid)`(교사 본인은 `is_admin()`도 확인 — spec §3.2 자기 참조 구멍), RPC `my_boards()`(교사 = 자기 게시판 하나, 학생 = 자기 학급 담임들, 그 밖 = 빈 배열; `authenticated`만). 모두 `security definer`, `set search_path = ''`.
   * 기존 글 이관(spec §2.3 ①~④ — 담임 둘 이상이면 가장 먼저 연결된 담임, 못 채우면 멈춤).
   * `community_reports.target_board_owner`(on delete set null) + 신고 스냅샷 트리거가 글 신고·댓글 신고 모두 채우게(R4 — `target_kind` 뜻은 그대로) + 기존 신고 채우기.
   * RLS·관리 함수(spec §3 + R2·R3): `community_posts` SELECT·INSERT·UPDATE·DELETE, **`is_admin()`으로 게시판 글·댓글·좋아요·신고를 보거나 고치거나 지우는 정책·함수를 마이그레이션 전체에서 모두 찾아**(`set_community_post_hidden`·`set_community_comment_hidden`·`resolve_community_reports_for`·`set_community_report_status`·댓글 UPDATE/DELETE·신고 SELECT 등) 게시판 쪽만 "그 게시판 담임(지금 교사 — `board_owner = auth.uid() and is_admin()`) 또는 총괄(`is_super_admin()`)"로 좁히고 학습게임 쪽은 글자 그대로 둔다. 쓰기는 담임 본인·그 담임의 학급 학생만(총괄도 다른 담임 게시판에는 못 씀). 주인이 지워진 게시판 글은 총괄·글쓴이만. 정책 안에서 같은 표 다시 조회 금지(필요하면 `security definer` 함수), `x = any (public.f())`(괄호 겹치지 않기).
   * 반별 권한 SQL(`20260927010000`) 뒤이므로 옛 마이그레이션을 다시 실행하게 하지 않는다. `admin_purge_oauth_member`(`20260928000000`)는 고치지 않는다 — 대신 새 SQL과 함께 써도 완전 삭제가 막히지 않는지(교사였던 계정·학생 계정 모두) 읽어서 확인하고 보고.
   * **되돌리기 SQL** `docs/community/teacher-boards/rollback-teacher-boards.sql`(이 파일이 바꾼 정책·함수를 옛 정의로, 새 열은 남겨 둬도 되는지 판단해 적음 — `docs/classes/rollback-classes-rls.sql` 방식).
   * 확인 쿼리에 **학생 흉내로 `board_owner`에 자기 id를 넣은 insert가 거부되는지**, 다른 게시판 글이 0개인지(`set local role authenticated` + `request.jwt.claims` 흉내 — 앞선 마이그레이션들이 쓰는 방식, 트랜잭션 되돌림으로 흔적 없게)를 넣는다.
2. **화면**(spec §4·§5.2): `src/lib/community.ts`(목록·개수에 `boardOwner`, 글쓰기에 `board_owner`, 필요한 열·조인), `my_boards()` 래퍼, `/board/` 목록(게시판 0개 = 안내 "아직 배정된 담임 선생님이 없어요. 선생님께 학급 등록을 부탁해 주세요.", 1개 = 바로, 2개 이상 = "○○ 선생님 게시판" 고르기 — 학급 이름은 학생 화면에 쓰지 않음), 글쓰기(게시판 자동/고르기/안내), 관리자 신고 관리(총괄에게 글·신고마다 "○○ 선생님 게시판" 표시 — 필터는 선택), 홈 미리보기·글 수·검색은 RLS로 자동(코드 변경 없으면 그대로). **새 SQL이 아직 없을 때도 화면이 깨지지 않게**(RPC·열이 없으면 예전처럼 동작하거나 "준비 중" — 글쓰기가 실패하지 않게). 관리자 영역 디자인·접근성 규칙 그대로.
3. **문서**: 보고서(바꾼 정책·함수 전·후 표, 좁힌 `is_admin()` 경로 목록, 이관 규칙, 사용자가 할 일 순서), `CLAUDE.md` 개정 문구 제안(spec §5.3 + R1~R4 반영) — `CLAUDE.md`·`docs/STATUS.md`는 고치지 않는다(Claude가 한다).

## 확인(반드시)
* `npm run lint`, `npx tsc --noEmit`, `git diff --check`.
* **SQL은 실행할 수 없다(로컬 Postgres 없음)** — 줄마다 읽어 검토: 문법, 모든 이름 `public.`, 재실행 안전(두 번 실행해도 같은 결과·이관이 다시 돌아도 안전), 정책 재귀, 권한, 트리거, 이관 순서, 맨 끝 점검, 되돌리기 SQL이 실제로 옛 정의와 같은지(앞선 마이그레이션에서 글자 그대로 옮김).
* **화면**: 빌드는 저장소 `out/`에 하지 않는다 — `git archive HEAD`를 스크래치 `…/scratchpad/teacher-boards/site/`에 풀고 이 작업 파일을 덮어쓴 사본에서 `node_modules`를 저장소 것에 링크해 **가짜 Supabase 주소·키**로 `next build` → 자기 정적 서버(포트 **8931**, 스크래치에 `class1 → out` 링크로 `/class1/`) + 자기 전용 headless Chrome(포트 **9431**, 프로필 `…/scratchpad/teacher-boards/profile`) + `--host-resolver-rules`로 Supabase 차단 + 첫 로드부터 CDP `Fetch` 가짜 응답(**가짜 RLS**: 학생 A(총괄 반)·학생 B(다른 담임 반)·담임 둘인 학급 학생·학급 없는 계정·담임·총괄·비로그인 — spec §7.1 표) + 캐시 끄기. 시험 도구는 `…/scratchpad/class-assignments/`·`…/scratchpad/oauth-delete/`·`…/scratchpad/review-oauth/`의 것을 **자기 폴더로 복사해** 쓴다.
* 확인할 화면: 계정마다 `/board/` 목록·고르기·글쓰기(보내는 `board_owner`)·다른 게시판 글 주소로 들어가기(찾을 수 없음)·홈 미리보기·글 수·검색·신고 관리(담임 = 자기 게시판만, 총괄 = 전체 + 게시판 표시), 학습게임 화면은 전과 같음, 새 SQL 없을 때 화면, 데스크톱·휴대폰 폭, 밝음·어두움, 콘솔 오류 0. 전·후 사진 쌍(전 = `HEAD`) `…/scratchpad/teacher-boards/shots/`.
* 실제 Supabase에 요청하지 않는다. 아무것도 내려받거나 설치하지 않는다. git commit/push·실 DB 쓰기 금지. `localStorage.clear()` 금지. 다른 작업의 포트·프로세스 건드리지 않기. **한 명령이 10분 넘게 조용하면 작업이 끊긴다** — 빌드·시험은 나눠서, 시간 제한을 두고. 끝나면 서버·Chrome 종료. 저장소 파일에 개인정보를 쓰지 않는다.

## 보고서 `docs/community/teacher-boards/build-report.md`
바꾼 것(파일:행), SQL 요약(열·함수·정책 전·후·이관·맨 끝 점검·확인 쿼리), 좁힌 관리 경로 목록, 완전 삭제와 함께 쓸 때 확인, 화면 전·후 사진 목록, 확인 결과, **사용자가 할 일 순서**(실행 전 확인 쿼리 → SQL 실행 → 실행 뒤 확인 쿼리 → push 요청 → 실제 계정 확인), 확인하지 못한 것, 물을 것 — 한국어로 간결하게.
