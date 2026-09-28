# Build 보고 — 자유게시판을 담임교사별로 (2026-09-28)

> 지침: `build-instructions.md` · 설계: `spec.md`(우선순위: 끝 **개정 1** → Claude 검토 메모 R1~R4 → 본문).
> 커밋·push·실 DB 쓰기는 하지 않았다. SQL 은 실행할 수 없어(로컬 Postgres 없음) 줄마다 읽어 검토했다.

## 0. 요약
* **SQL** `supabase/migrations/20260928010000_teacher_boards.sql`(새 파일, 앞선 파일은 고치지 않음): `community_posts.board_owner`(→ profiles, **on delete set null**), 판별 함수 5개, 기존 글 옮기기(처음 실행 때 한 번), 신고 스냅샷 2열, **정책 12개 + 관리 함수 4개 + 신고 트리거**를 게시판 쪽만 좁힘(학습게임 쪽 조건은 글자 그대로), 맨 끝 점검 11가지.
* **되돌리기** `docs/community/teacher-boards/rollback-teacher-boards.sql`: 정책 12개·함수 5개를 옛 정의로(앞선 마이그레이션의 마지막 정의와 **글자 대조 17/17 일치**), 새 함수 5개·새 열 3개 지움.
* **화면**: 학생 = 자기 담임 게시판 하나(고르기·입력칸 없음, 글쓰기에 그 담임 id 자동), 교사 = 게시판이 둘 이상이면 교사 화면에만 고르기, 학급 없는 계정 = 안내, 총괄 = 관리 화면에서 모든 게시판(이름표·거르기). SQL 적용 전에는 예전처럼 동작.
* **확인**: lint · `tsc --noEmit` · `git diff --check` 통과, SQL 구조 검사 문제 0(두 파일), 가짜 Supabase·가짜 RLS 로 화면 시험 **133/133 통과**(콘솔 오류 0, 가짜 백엔드 밖 요청 0).

## 1. 개정 1(학생은 게시판 하나) 반영 — Build 중 바뀐 것
* 판별: 학급의 게시판 주인 = **먼저 맡은 담임**(`class_teachers.created_at` 가장 이른 **지금 교사**, 같으면 `teacher_id` 순) — `class_board_owner()`.
  * `my_board_owner_ids()`: 학생 = 그 한 명, 교사 = 자기 + 자기가 담임(보조 포함)인 학급들의 게시판 주인, 그 밖 = 빈 배열.
  * `can_use_board(주인)` = 주인 ∈ 위 목록. `can_manage_board(주인)` = 총괄 **또는** (지금 교사 **그리고** 주인 ∈ 위 목록).
  * `my_boards()` = 위 목록 + 이름(내 게시판 먼저).
* 학생 화면에는 고르기가 없다(주소에 `?board=`를 넣어도 무시). 학생이 다른 값·자기 id 를 보내면 DB 가 거부한다.
* 먼저 맡은 담임이 담임 해제되면 다음 담임이 그 학급 게시판 주인이 된다 — 학생 게시판이 바뀌고 예전 글은 예전 게시판에 남아 총괄·글쓴이만 본다(따로 옮기지 않음).

## 2. 바꾼 것(파일:행)
| 파일 | 내용 |
|---|---|
| `supabase/migrations/20260928010000_teacher_boards.sql` (새, 1243행) | 머리말(실행 순서·방법·실행 전 확인 A~C·실행 후 확인 0~10) 1~235 · 맨 앞 점검 238~294 · 함수 5개 297~406 · 열 추가+글 옮기기 409~490 · 제약·인덱스·열 권한 492~506 · 신고 스냅샷·트리거·채우기 509~579 · 정책 12개 581~838 · 관리 함수 4개 839~989 · 맨 끝 점검 990~1240 |
| `docs/community/teacher-boards/rollback-teacher-boards.sql` (새) | 비상 되돌리기(아래 3.7) |
| `src/lib/boards.ts` (새) | `my_boards()` 래퍼(`fetchBoardAccess` — 사용자별 30초 기억, 없으면 `legacy`), 이름표 `boardLabel`/`teacherTitle`, 주소 `boardListHref`/`boardNewHref`, 안내 문구 |
| `src/hooks/use-board-access.ts` (새) | `useBoardAccess()` · `boardOwnersOf()` |
| `src/components/community/board-list-section.tsx` (새) | `/board/` 목록 머리: 교사 고르기(2개 이상, `?board=`)·글쓰기 링크·학급 없음이면 글쓰기 숨김 |
| `src/app/board/page.tsx` · `src/app/board/new/page.tsx` | 위 칸 사용, `?board=`를 읽어 Suspense 경계 |
| `src/lib/community.ts` 20~40, 60~70, 165~222 | `board_owner` 타입, `…_WITH_BOARD` 열, 목록·개수의 게시판 거르기(`boardOwners`), 상세 `withBoard`(열 없으면 예전 열로 다시 읽음) |
| `src/components/community/community-post-list.tsx` 36~140 | 자유게시판 = 내 게시판 글만(목록은 고른 게시판, 홈은 내 게시판 합침), 학급 없음 안내 |
| `src/components/community/community-post-form.tsx` 45~95, 155~250, 270~300, 395 | 새 글: 학생 자동·교사 고르기·학급 없음 안내, `board_owner` 보냄, 거부되면 안내 + 게시판 목록 다시 읽기 |
| `src/components/community/community-post-detail.tsx` 60~70, 120~190, 300~315 | 참여하지 않는 게시판 글(총괄 관리용 · 반을 옮긴 뒤 내 예전 글)은 댓글·좋아요 대신 안내, 교사에게 게시판 이름, 관리용 보기는 "커뮤니티 관리"로 돌아감·신고 버튼 숨김 |
| `src/components/community/community-comment-section.tsx` 56~75, 209, 229 | `canWrite`(null = 아직 모름)·`readOnlyNote`·`hideReport` |
| `src/components/dashboard/stat-tile.tsx` 131~185 | "자유게시판 글" 수 = 내 게시판 글만 |
| `src/app/search/search-view.tsx` 25~110, 285~340 | 자유게시판 검색 = 내 게시판 글만, 학급 없음 안내 |
| `src/app/admin/(dashboard)/community/community-moderation.tsx` 50~210, 290~360, 440~520 | 게시판 열(적용 뒤에만) · 이름표(총괄·게시판 둘 이상인 교사) · 글 목록 게시판 거르기 |
| `docs/community/teacher-boards/build-report.md` | 이 보고서 |

건드리지 않음: `public/apps/`·`scripts/templates/`·앞선 마이그레이션·Edge Function·`CLAUDE.md`·`docs/STATUS.md`(작업 전부터 있던 STATUS 변경은 그대로).

## 3. SQL 요약
### 3.1 열·제약·권한
* `community_posts.board_owner uuid → profiles(id) on delete set null`(R1), 제약 `community_posts_board_owner_chk check (kind = 'board' or board_owner is null)`, 인덱스 `(board_owner, created_at desc)`.
* 열 권한: 새 글(insert) 목록에만 `board_owner` 추가, 고치기(update) 목록은 그대로(주인은 쓴 시점 고정). 게시판 글에 주인이 꼭 있어야 하는 것은 쓰기 정책이 지킨다.
* `community_reports.target_board_owner`(→ profiles, set null) · `target_post_kind`('board'|'game', 빈 값 = 모름) — 트리거가 채우고 클라이언트는 못 보냄. `target_kind` 뜻은 그대로(R4).

### 3.2 함수(모두 security definer · `search_path = ''`)
| 함수 | 실행 권한 | 하는 일 |
|---|---|---|
| `class_board_owner(학급)` | 내부용(anon·authenticated 회수) | 학급의 먼저 맡은 지금 교사 |
| `my_board_owner_ids()` | PUBLIC(정책 평가용) | 내가 참여하는 게시판 주인 목록 |
| `can_use_board(주인)` | PUBLIC | 참여(읽기·글·댓글·좋아요) |
| `can_manage_board(주인)` | PUBLIC | 관리(숨긴 것 보기·숨기기·지우기·신고) — 총괄 전부, 교사는 참여 게시판만(지금 교사일 때) |
| `my_boards()` | authenticated 만 | 화면용 `[{owner_id, teacher_name, mine}]` |

재귀 없음: 함수는 `profiles`·`class_teachers`만 읽고, `community_posts` 정책은 자기 표를 다시 읽지 않는다. 배열 비교는 `x = any (public.f())`.

### 3.3 정책 전·후(학습게임 갈래는 옛 조건 글자 그대로)
| 표 · 명령 | 전 | 후(게시판 글) |
|---|---|---|
| posts 읽기 | 로그인이면 모든 게시판 글, 교사는 숨김 포함 전부 | 참여 게시판의 숨기지 않은 글 · 내 글 · `can_manage_board` |
| posts 쓰기 | 로그인이면 누구나 | `can_use_board(board_owner)`(빈 값·남의 게시판·학생 자기 id 거부 — 총괄도 다른 게시판 못 씀) |
| posts 고치기·지우기 | 글쓴이 · 교사 누구나 | 글쓴이 · `can_manage_board` |
| comments 읽기 | 부모 글 보이면, 숨긴 댓글은 교사 누구나 | 부모 글 = 참여·글쓴이·관리자, 숨긴 댓글 = 쓴 사람·`can_manage_board` |
| comments 쓰기 | 숨기지 않은 글이면 | + 게시판 글이면 `can_use_board` |
| comments 지우기 | 쓴 사람 · 교사 누구나 | 쓴 사람 · 게시판 글이면 `can_manage_board` |
| likes 읽기 / 누르기 | 글이 보이면 / 숨기지 않은 글 | 읽기 = 글 읽기와 같은 뜻, 누르기 = + `can_use_board` |
| reports 읽기 | 신고자 · 교사 누구나 | 신고자 · 게임 신고는 교사 누구나 · 게시판(과 종류 모름) 신고는 `can_manage_board(target_board_owner)`(주인 모름 = 총괄만) |
| reports 신고 | 보이는 글(교사는 숨김 포함) | 보이는 글(게시판은 참여·글쓴이·관리자) — 나머지 그대로 |
| reports 지우기 | 교사 누구나 | 게임 = 교사 누구나, 게시판·모름 = `can_manage_board`(화면은 신고를 지우지 않음) |

그대로: comments "본인 수정", likes "본인 취소", 게임 파일(storage) 정책, `community_posts_guard`.

### 3.4 좁힌 관리 경로(`is_admin()`으로 게시판을 보거나 고치거나 지우던 곳 — 마이그레이션 전체 grep, R3)
정책 9곳(posts 읽기·고치기·지우기, comments 읽기·지우기, likes 읽기, reports 읽기·신고·지우기) + 함수 4개(`set_community_post_hidden`·`set_community_comment_hidden`·`set_community_report_status`(신고 스냅샷으로)·`resolve_community_reports_for`) — 모두 게시판 쪽만 `can_manage_board`, 학습게임 쪽 `is_admin()` 그대로. 학생이 부르면 지금처럼 `admin only`.
좁히지 않은 `is_admin()`: `community_posts_guard`(새 글 작성자 확인 — 작성자 열은 클라이언트가 못 보냄, 관리 경로 아님), 게임 파일 storage 정책(게임 전용), `admin_purge_oauth_member`(서비스 롤, 고치지 않음 — 지침).

### 3.5 기존 글 옮기기(열이 새로 생기는 첫 실행 때만 — 다시 실행하면 건너뜀)
① 교사 글 → 그 교사 게시판 ② 학생 글(탈퇴 포함) → 그 학생 학급의 먼저 맡은 지금 교사 게시판 ③ 나머지(글쓴이 없음·학급 없음·교사 없는 학급) → 총괄 게시판(보관 안 한 학급의 담임인 총괄 먼저) ④ 못 채우면 전부 되돌림. 한 `do` 블록 안에서 "고친 시각" 트리거를 잠시 꺼 `updated_at`을 바꾸지 않는다(안 그러면 모든 글에 "(수정됨)"). 다시 실행해도 주인이 지워진 글(얼어붙은 게시판)을 다른 게시판으로 옮기지 않는다.
신고: 대상 글이 남아 있으면 그 글에서 두 열, 글이 지워진 글·게임 신고는 종류만, 글이 지워진 옛 댓글 신고는 빈 값(총괄만 봄). 빈 값만 채워 재실행 안전.

### 3.6 맨 끝 점검(다르면 전부 되돌림) · 확인 쿼리
점검: RLS 4표 · 외래키 2개가 profiles·set null · 제약 · 정책 14개 이름/명령 · 모르는 허용 정책 없음 · 대상 역할 · 조건 글자(함수 이름) · `is_admin()` 정책은 반드시 'board'/'game'으로 나뉨 · 관리 함수 4개에 `can_manage_board` · 트리거에 두 스냅샷 · 열 권한 · 함수 권한 · **완전 삭제를 막는 외래키 없음**(⑦과 같은 조건).
확인 쿼리(머리말): 실행 전 A 옮겨 갈 게시판·글 수, B 담임 둘인 학급, C 대상 지워진 댓글 신고 수 / 실행 뒤 0 주인별 글 수 · 1 정책 · 2 신고 스냅샷 · 3 권한 · 4 비로그인 0 · 5 학생 다른_게시판_글 0 · **6 학생이 board_owner 에 자기 id → 거부(✔)** · 7 자기 게시판엔 씀(일부러 오류로 끝나 저장 안 됨) · 8 다른 담임 게시판 거부 · 9 총괄 아닌 담임: 다른 게시판 글·신고 0, 남의 글 숨기기 거부 · 10 총괄: 전체 보기, 다른 담임 게시판 쓰기 거부. (8~10은 두 번째 담임이 생긴 뒤)

### 3.7 되돌리기(`rollback-teacher-boards.sql`)
정책 12개를 옛 이름·옛 조건으로(20260926000000 3개 · 20260922040000 9개), 함수 5개(RPC 4 + 트리거)를 20260922040000 본문으로, 새 글 열 권한을 옛 목록으로, 새 함수 5개·새 열 3개를 지움(열을 남기면 ⑧을 다시 Run 할 때 "재실행"으로 보고 옮기기를 건너뛰어 되돌린 동안 쓴 글이 총괄·글쓴이에게만 보이게 됨 — 열을 지우면 다시 Run 때 지금 기준으로 다시 옮김). 새 화면은 `my_boards()`가 없으면 저절로 예전처럼 동작. 옛 정의 글자 대조 스크립트로 17/17 일치 확인.

## 4. 완전 삭제·완전 탈퇴와 함께 쓸 때(읽어서 확인)
* **옛 교사 계정 완전 삭제**(담임 해제 → role 'user' → `admin_purge_oauth_member`): 1) 신고 삭제 2) 그 계정이 쓴 글 삭제 3) 로그 4) profiles 삭제 → 그 게시판에 남은 다른 사람 글은 `board_owner` set null(주인 없는 게시판 — 총괄·글쓴이만), 신고는 `target_board_owner` set null(종류 'board' 유지 → 총괄만). set null 이 부르는 트리거는 `community_posts_guard`(수정 때는 게임 파일만 검사 — 게시판 글 해당 없음)·`updated_at` 뿐이라 오류 없음, 제약도 만족, 외래키 동작은 RLS·열 권한과 무관. restrict/no action 외래키를 더하지 않았다(맨 끝 점검 6-11이 확인) → ⑦ 파일을 다시 Run 해도 그 점검을 통과.
* **학생 완전 삭제**: 그 학생 글·신고를 지우는 흐름 그대로. 학생은 게시판 주인이 될 수 없어(쓰기 정책) set null 대상이 없다.
* **완전 탈퇴(아이디 계정)**: `auth.users`만 지움 — profiles·글 그대로, `my_student_class_id()`가 탈퇴한 학생에게 null 이라 남은 토큰으로도 게시판을 못 씀. `withdrawal_blocking_fks()`(auth.users 참조만 봄)와 무관.
* **담임 해제**(`admin_set_role`): 그 교사의 `class_teachers` 줄이 지워지고 role 'user' → 그 교사 게시판은 얼어붙음(주인 권한 R2 도 끝). 학급에 다른 담임이 있으면 그 담임이 학급 게시판 주인이 된다.

## 5. 지침·설계 밖에서 정한 것(까닭)
1. **댓글·좋아요도 그 게시판 참여자만**(쓰기 정책) — 지침 "쓰기는 담임 본인·그 담임의 학급 학생만(총괄도 다른 담임 게시판에는 못 씀)"과 spec §8-1 "아무도 새로 못 씀". 총괄은 관리용 보기에서 숨기기·삭제만(화면도 댓글 칸 대신 안내, 신고 버튼 숨김). 반을 옮긴 학생은 예전 글을 고치고 지울 수 있지만 댓글·좋아요는 못 단다(예전 글에 달린 댓글 신고는 가능 — 안전).
2. **홈 미리보기·"자유게시판 글" 수·검색도 내가 참여하는 게시판만**(화면에서 `board_owner`로 거름) — RLS 만 두면 총괄에게 관리용으로 보이는 모든 게시판 글이, 학생에게는 반을 옮기기 전 내 글이 섞인다.
3. **신고 스냅샷 `target_post_kind`를 하나 더 둠** — `target_board_owner`만으로는 "학습게임 댓글 신고"와 "주인이 지워진 게시판 댓글 신고"를 대상 글이 지워진 뒤 구별할 수 없어, 학습게임 신고 처리 범위(교사 누구나)를 그대로 지키려고.
4. 기존 글 옮기기를 처음 실행 때만 하고 "고친 시각"을 보존.
5. 교사가 게시판 둘일 때 고른 게시판을 주소 `?board=`에 남김(글쓰기·뒤로 가기에서 이어짐). 학생에게는 무시.

## 6. 화면 확인(스크래치 `…/scratchpad/teacher-boards/`)
방법: `git archive HEAD`(7724ae5) 사본(전)·그 사본 + 이번 파일(후)을 가짜 Supabase 주소·키로 `next build`(둘 다 25쪽 성공, 번들 속 Supabase 주소는 가짜 하나) → 자기 정적 서버 **8931**(쿠키로 전/후) + 자기 headless Chrome **9431**(`--host-resolver-rules`로 supabase.co 차단) + 첫 로드부터 CDP `Fetch` 가짜 응답(**가짜 RLS** — `backend.mjs`가 새·옛 정책을 흉내) + 캐시 끔. 계정: 총괄(부엉이반) · 담임(여우반 먼저 맡음) · 보조 담임(여우반) · 학생 A(부엉이반, 예전 여우반 글 있음) · 학생 B(여우반 — 담임 둘) · 학급 없는 구글 계정. 서버·Chrome 은 끝나고 껐다.
결과 `report-*.json` **133/133 통과**:
* 학생 A: 목록 = 부엉이반 게시판 글만(예전 반 내 글·다른 게시판 없음), 고르기 없음, 글쓰기에 총괄 id 자동(보낸 열 kind·title·body·board_owner), 다른 게시판 글 주소 → "글을 찾을 수 없어요", 내 예전 글 → 보이되 댓글·좋아요 대신 안내, 홈 미리보기·글 수 2·검색 모두 내 게시판만.
* 학생 B: 먼저 맡은 담임 게시판만, 고르기 없음, `?board=보조 담임`을 넣어도 먼저 맡은 담임 id 로 저장.
* 학급 없는 계정: 목록·글쓰기·홈·검색 모두 "아직 배정된 담임 선생님이 없어요 / 선생님께 학급 등록을 부탁해 주세요.", 글쓰기 버튼 없음, 게시판 조회 안 함.
* 담임(총괄 아님): 자기 게시판만, 신고·글 관리도 자기 게시판 + 학습게임만, 이름표 없음. 보조 담임: 고르기(내 게시판·이담임 선생님 게시판), 주소 `?board=`, 글쓰기에 미리 골라짐, 관리 화면 이름표·거르기.
* 총괄: `/board/`·홈 = 자기 게시판만, 관리 화면 = 신고 5종 모두 + 이름표(내 게시판·○○ 선생님 게시판·게시판 알 수 없음(옛 신고)·주인 없는 게시판), 글 목록 거르기(교사별 + 주인 없는 글), 다른 게시판 글 관리용 상세(이름·"관리용으로 보는 글"·댓글·좋아요·신고 없음·숨기기 됨·"커뮤니티 관리"로 돌아감).
* SQL 적용 전 + 새 화면: 예전처럼 거르지 않음, `board_owner`를 읽거나 보내지 않음, 새 글 저장 됨, 관리 화면 예전 열.
* 학습게임: 모두 함께(전과 같음), `my_boards`·`board_owner` 부르지 않음.
* 휴대폰 390px: 가로 넘침 0, 고르기 44px. 어두운 화면·키보드 초점(라벨 "게시판") 확인. 콘솔 오류 0.
* 참고: 글 상세의 마크다운 CDN(marked·DOMPurify·highlight.js)은 시험에서 일부러 막아 "원문 표시"로 보인다(이번 변경과 무관).

사진(`shots/`): 전·후 나란히 `pair-A-board` · `pair-B-board` · `pair-N-board` · `pair-A-home` · `pair-SUPER-admin-reports` · `pair-A-games`(바뀌지 않음) / 후 `after-A-new` · `after-A-other-post` · `after-A-own-old-post` · `after-T3-board-own` · `after-T3-board-t2` · `after-T3-new` · `after-T3-admin-posts` · `after-T2-admin-posts` · `after-SUPER-admin-posts-filter` · `after-SUPER-manage-detail`(+`-dark`) · `after-N-new` · 휴대폰 `*-mobile` · 어두운 `*-dark`.

## 7. 사용자가 할 일(순서)
1. (읽기만) SQL Editor 에서 마이그레이션 머리말의 **실행 전 확인 A·B·C** — 옮겨 갈 게시판별 글 수, 담임 둘인 학급, 대상이 지워진 옛 댓글 신고 수를 본다.
2. `supabase/migrations/20260928010000_teacher_boards.sql` **전체 Run** → "기존 자유게시판 글을 옮겼습니다 …"와 "✔ 자유게시판을 담임교사별로 나눴습니다 …" 알림 확인(오류면 아무것도 바뀌지 않음 — 메시지를 알려 주기).
3. **실행 후 확인 0~7**(0 주인 없는 글 0 · 4 비로그인 0 · 5 학생 다른_게시판_글 0 · **6 자기 id 거부 ✔** · 7 자기 게시판 쓰기 ✔). 8~10은 두 번째 담임이 생긴 뒤.
4. Claude 에게 **push 요청**(SQL 뒤 바로 — 그 사이 예전 화면에서는 자유게시판 새 글이 "권한이 없어요"로 저장 안 됨. 읽기·댓글은 됨). Edge Function 재배포 없음.
5. 실제 계정 확인: 학생 계정 — 자유게시판 목록·글쓰기(고르기 없음)·홈 미리보기, 총괄 — 커뮤니티 관리 이름표·거르기, 다른 게시판 글 관리용 보기. (담임이 둘인 학급이 생기면 보조 담임 계정 — 게시판 고르기)
문제가 생기면 `docs/community/teacher-boards/rollback-teacher-boards.sql` 전체 Run(머리말의 "먼저 볼 것" 먼저).

## 8. 확인하지 못한 것
* SQL 실제 실행(로컬 Postgres 없음): 읽기 검토 + 구조 검사(문장·괄호·raise 자리표시·정책 이름 바이트·`any ((select` 금지) + 되돌리기 글자 대조만. 특히 `do` 블록 안의 열 추가·트리거 끄기/켜기, 정책 식의 실제 평가, 행마다 부르는 판별 함수의 속도(글이 적어 문제없을 것으로 예상).
* 실제 게시판 글·신고 건수, 담임 둘인 학급이 있는지.
* 실제 계정·실제 태블릿(모두 가짜 세션·headless). 되돌리기 SQL 실제 실행.

## 9. 물을 것
1. 댓글·좋아요도 "그 게시판 참여자만"(총괄은 다른 게시판에서 숨기기·삭제만, 반을 옮긴 학생은 예전 글에 댓글 못 담)으로 했다 — 이대로 괜찮은지.
2. 홈 '최근 자유게시판'·"자유게시판 글" 수·검색도 "내가 참여하는 게시판만"(총괄의 전체 보기는 관리 화면에서만) — 괜찮은지.
3. 신고 스냅샷에 `target_post_kind`를 더했다(학습게임 신고 처리 범위를 대상이 지워진 뒤에도 그대로 두려고) — 괜찮은지.
* 참고: 보조 담임이 예전에 쓴 게시판 글은 "교사 글 = 그 교사 게시판" 규칙대로 보조 담임 자기 게시판으로 옮겨져 그 학급 학생에게는 안 보인다(지금은 교사가 총괄 한 명뿐이라 해당 없을 것으로 보임 — 실행 전 확인 A 로 알 수 있음).

## 10. `CLAUDE.md` 개정 문구 제안(커뮤니티 규칙 — Claude 가 반영)
> * **자유게시판은 담임교사별로 나뉜다**(2026-09-28 사용자 결정 — `docs/community/teacher-boards/spec.md` 개정 1, SQL `20260928010000_teacher_boards.sql`): 게시판 = 담임 한 명마다 하나(`community_posts.board_owner` = 그 담임, on delete set null). 학생은 자기 학급의 **먼저 맡은 담임**(`class_teachers.created_at`가 가장 이른 지금 교사) 게시판 **하나만** 보고 쓴다 — 학생 화면에 게시판 고르기 없음, 글쓰기는 그 담임 id 자동(DB도 그 값만 받음). 교사는 자기 게시판 + 담임(보조 포함)인 학급의 게시판을 보고·쓰고·관리(둘 이상이면 교사 화면에만 고르기). 총괄은 관리용으로 모든 게시판을 보고 숨기기·삭제·신고 처리(글·댓글·좋아요는 자기가 참여하는 게시판에만). 학급 없는 계정은 게시판 없음("아직 배정된 담임 선생님이 없어요"). 홈 미리보기·글 수·검색도 내가 참여하는 게시판만. 학습게임(`kind='game'`)은 지금처럼 모두 함께.
> * 글의 게시판은 쓴 시점에 고정(반을 옮겨도 예전 글은 예전 게시판 — 내 글은 늘 보이고 고치고 지울 수 있음). 게시판 주인이 담임 해제·계정 삭제되면 그 게시판은 얼어붙는다(총괄·글쓴이만 봄, 새로 못 씀). 신고는 스냅샷 `target_post_kind`·`target_board_owner`로 게시판을 가린다(`target_kind` 뜻은 그대로, 대상이 지워진 옛 댓글 신고는 총괄만).
> * 판별은 `can_use_board(주인)`(참여)·`can_manage_board(주인)`(관리 = 지금 교사 + 참여, 총괄은 전부)·`my_boards()`(화면). 게시판 쪽 관리 조건을 `is_admin()`으로 되돌리지 않는다. 비상 되돌리기 `docs/community/teacher-boards/rollback-teacher-boards.sql`. 이 파일 뒤로 커뮤니티 옛 마이그레이션(20260922040000 · 20260923010000 · 20260926000000)을 다시 실행하지 않는다.
> * (기존 줄 바꿈) "로그인한 사용자 누구나 글·댓글·좋아요·신고, 글은 바로 공개. 관리자(교사)는 숨기기·삭제·신고 처리." → "자기 게시판에서 글·댓글·좋아요·신고, 글은 바로 공개. 교사는 자기 게시판(보조 담임은 그 학급 게시판도, 총괄은 전체)에서 숨기기·삭제·신고 처리. 학습게임은 교사 누구나."

## 11. Claude 후속 — 개정 2·검토 L3·L5 (2026-09-28, Review 뒤)
검토(`review.md`)의 낮음 L1에 대해 사용자가 **"개설한 학급 있을 때만"**을 골랐다(`spec.md` 끝 "개정 2").
그 결정과 L3·L5를 Claude가 반영했다. L2는 안내로, L4는 그대로 둔다(검토 권고).

* **SQL**(`20260928010000_teacher_boards.sql` — 아직 실행 전이라 같은 파일을 고침):
  * `my_board_owner_ids()`: "교사면 자기 id" 갈래를 뺐다. 교사 = 담임(보조 포함)인 학급들의 `class_board_owner`, 학생 = 자기 학급의 `class_board_owner`.
  * 기존 글 옮기기 ①: 교사 글 → 맡은 학급의 게시판(자기가 먼저 맡은 학급이 있으면 자기 게시판). 학급 없는 교사 글은 ③.
  * `v_super`: 먼저 맡은 학급이 있는 총괄을 먼저 고른다.
  * 실행 전 확인 A를 같은 규칙으로 고치고, **D(학급 없는 학생·교사 수 — L3)**를 더했다.
  * 맨 끝 점검 6-6의 그대로 둔 두 정책에 `uid()`·`user_id` 조건 확인을 더했다(L5).
  * 머리말·주석·알림 문구도 고쳤다.
* **화면**:
  * `src/lib/boards.ts`: `NO_BOARD_TEACHER_TITLE`·`NO_BOARD_TEACHER_DESCRIPTION`·`noBoardNotice(isAdmin)`을 더했다.
  * 목록·글쓰기·검색은 게시판이 없을 때 교사에게 "아직 맡은 학급이 없어요 / … '내 학급'에서 학급을 개설하면 그 학급 학생들과 함께 쓰는 게시판이 생겨요."를 보인다. 학생 문구는 그대로다.
* **지금 계정에서의 결과**: 교사는 총괄 한 명이고 부엉이반의 먼저 맡은 담임이다. 그래서 결과는 개정 1과 같다.
* **확인**:
  * `npx tsc --noEmit`·`npm run lint`·`git diff --check` 통과(Claude).
  * 바뀐 곳의 재확인은 Review 담당이 `review.md` 끝 "재확인 — 개정 2"에 적는다.
* **사용자 할 일 순서 보충**(§7):
  * 실행 전 확인에 **D**를 더한다.
  * **수업 없는 시간**에 한다.
  * push 확인 뒤 학생 태블릿은 탭을 닫았다 다시 연다.
  * 실행 후 확인 7은 ✔로 시작하는 빨간 ERROR가 정상이다.
* **재확인 N1·N2(Claude가 고침 — `review.md` "재확인 2" 통과, 새 발견 0)**:
  * N1: 총괄 관리 화면의 '게시판' 거르기에 게시판이 있는 교사만 보인다. 게시판이 있는 교사 = 학급마다 먼저 맡은 지금 교사(`classBoardOwnerIds` — SQL `class_board_owner`와 같은 규칙). `class_teachers`를 못 읽으면 예전처럼 교사 전체가 보인다.
  * N2: 목록·홈 미리보기·검색은 프로필(역할)을 읽는 동안 안내 대신 불러오는 중 뼈대를 보인다. 학급 없는 교사에게 학생용 안내가 잠깐 보이던 것을 막았다.
