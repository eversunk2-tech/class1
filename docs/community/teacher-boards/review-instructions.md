# 검토 지침(Review) — 자유게시판을 담임교사별로 (2026-09-28)

당신은 **Review** 담당이다. **코드를 고치지 않는다**(발견만 기록 — 저장소에는 보고서 하나만 새로 쓴다). 이 변경은 **누가 어떤 글을 보고 쓸 수 있는지(RLS)**를 바꾼다 — 다른 담임 게시판 글이 새어 보이거나, 학생이 다른 게시판에 쓰거나, 교사·총괄이 해야 할 관리를 못 하거나, 학습게임이 바뀌거나, SQL이 실행 중 실패하는 경로를 먼저 찾고, 있으면 "높음"으로 분명히.

## 먼저 읽기
* 설계 `docs/community/teacher-boards/spec.md` — 본문 + **"Claude 검토 메모"(R1~R4)** + **"개정 1 — 사용자 결정 변경"**(이것이 가장 우선: 학생 게시판은 늘 하나 = 그 학급의 먼저 맡은 담임, 학생 화면에 고르기 없음, 보조 담임은 그 게시판도 관리, 교사 화면에만 고르기, 총괄은 관리용으로 전부·쓰기는 자기가 쓸 수 있는 게시판만, 학습게임 그대로).
* 지침 `build-instructions.md`, 보고 `build-report.md`(끝 "물을 것" 3개 포함), `CLAUDE.md`(커뮤니티·학급 권한·Supabase·SQL 적용 절차).
* 바뀐 파일: `supabase/migrations/20260928010000_teacher_boards.sql`, `docs/community/teacher-boards/rollback-teacher-boards.sql`, `src/lib/community.ts`·`src/lib/boards.ts`·`src/hooks/use-board-access.ts`·`src/components/community/*`·`src/app/board/*`·`src/components/dashboard/stat-tile.tsx`·`src/app/search/search-view.tsx`·`src/app/admin/(dashboard)/community/community-moderation.tsx`. 비교: `git diff HEAD -- src supabase` + 새 파일.
* Claude가 이미 확인한 것(다시 봐도 됨): 학습게임 갈래가 옛 정의(`20260926000000`·`20260922040000`)와 뜻이 같음, 맨 끝 점검이 기대하는 옛 정책 이름·역할·열 권한이 앞선 마이그레이션과 맞음(`community_comments: 본인 수정`·`community_likes: 본인 취소` 존재, 신고 insert는 열 단위), 트리거 이름 `community_posts_updated_at` 있음, 확인 쿼리 4)~10)이 아무것도 저장하지 않음.

## 확인할 것
1. **SQL**(실행할 수 없다 — 줄마다 읽기): 문법(plpgsql·sql 함수·do 블록 안 `alter table … add column`·트리거 끄고 켜기), `search_path=''`에서 이름, 재실행 안전(두 번째 실행 때 이관을 건너뛰는지·정책·함수·제약·인덱스가 같은 결과), 정책 재귀(42P17) 없음(정책 안에서 같은 표 다시 조회하는 곳이 없는지 — 댓글·좋아요·신고 정책의 글 표 하위 쿼리는 다른 표), `any` 사용 형식, 권한(판별 함수 PUBLIC·`my_boards` authenticated·`class_board_owner` 내부용), 기존 글 이관 규칙(교사 글·학생 글(먼저 맡은 담임)·나머지(총괄)·못 채우면 되돌림)과 `v_super` 고르는 식, 신고 스냅샷 트리거·채우기, 맨 끝 점검이 **거짓으로 실패하거나 거짓으로 통과**할 수 있는지, 되돌리기 SQL이 옛 정의와 글자 그대로인지(앞선 마이그레이션과 대조), 완전 삭제 함수(`20260928000000`)와 함께 쓸 때(담임 해제된 옛 교사·학생) 막히지 않는지.
2. **권한 시나리오**(표로 — 각 역할이 글·댓글·좋아요·신고를 보기/쓰기/고치기/지우기/숨기기/신고 처리): 비로그인, 학급 없는 계정, 학생(담임 하나), 담임 둘인 학급 학생(먼저 맡은 담임 게시판만), 보조 담임, 담임, 담임 해제된 옛 교사, 총괄 — 특히 **학생이 `board_owner`에 자기 id·다른 담임 id를 넣는 insert**, 총괄이 다른 담임 게시판에 쓰기, 옛 교사가 옛 게시판 관리, 다른 게시판 글 id로 RPC 부르기(숨기기·신고 처리), 주인이 지워진 게시판 글(총괄·글쓴이만), 학습게임은 전과 같음. 판별 함수의 논리를 식으로 따라가 확인하고, 가능하면 가짜 RLS 모델로 화면에서도.
3. **화면**: 학생 화면에 게시판 고르기·입력칸이 없고 글쓰기가 자동으로 먼저 맡은 담임 게시판(주소 `?board=`로 다른 값을 넣어도 무시·저장은 DB가 거부), 교사(보조 담임)에게만 고르기, 학급 없는 계정 안내, 다른 게시판 글 주소 → "찾을 수 없어요", 홈 미리보기·글 수·검색 범위(Build 물을 것 2 — 총괄의 홈에 모든 게시판이 섞이지 않는지), 관리자 신고 관리(담임 = 자기 게시판만, 총괄 = 전부 + "○○ 선생님 게시판" 표시·거르기), 새 SQL 전 화면이 예전처럼 동작, 학습게임 화면 전과 같음, 휴대폰·어두움, 콘솔 오류 0.
4. **Build가 물은 것 3개**(댓글·좋아요도 참여자만 / 홈·검색도 내가 참여하는 게시판만 / 신고에 `target_post_kind` 더함)에 대한 의견.
5. **사용자가 할 일 순서**(실행 전 확인 A~C → SQL Run → 확인 0~10 → push)에서 빠진 것·위험(특히 "SQL을 실행한 뒤 push 전까지 예전 화면으로는 게시판 새 글이 저장되지 않는" 사이 시간 — 안내가 분명한지).
6. `npm run lint`, `npx tsc --noEmit`, `git diff --check`, 임시 코드 없음, 개인정보 없음.

## 시험 방법(반드시)
* 빌드는 저장소 `out/`에 하지 않는다 — `git archive HEAD`를 스크래치 `…/scratchpad/review-boards/site-before/`(전)과, 같은 것에 작업 트리 변경을 덮어쓴 `…/site-after/`(후)에 풀어 `node_modules`를 저장소 것에 링크해 **가짜 Supabase 주소·키**로 `next build`(Build 담당의 `…/scratchpad/teacher-boards/` 도구를 **자기 폴더로 복사해** 써도 된다). 자기 정적 서버 **8932**(스크래치에 `class1 → out` 링크로 `/class1/`), 자기 전용 headless Chrome **9432**(프로필 `…/scratchpad/review-boards/profile`), `--host-resolver-rules`로 Supabase 차단 + 첫 로드부터 CDP `Fetch` 가짜 응답(가짜 RLS) + 캐시 끄기.
* 실제 Supabase에 요청하지 않는다. 아무것도 내려받거나 설치하지 않는다. git commit/push·실 DB 쓰기 금지. `localStorage.clear()` 금지. 다른 작업의 포트·프로세스 건드리지 않기. **한 명령이 10분 넘게 조용하면 작업이 끊긴다** — 빌드·시험은 나눠서, 시간 제한을 두고. 끝나면 서버·Chrome 종료.
* 사용자에게 보일 대표 사진: 학생 게시판(고르기 없음)·학급 없는 계정 안내·총괄 관리 화면의 게시판 표시 — `…/scratchpad/review-boards/showcase/`.

## 보고서 `docs/community/teacher-boards/review.md`
심각도(높음·중간·낮음)별 발견 표(파일:행, 무엇, 재현, 제안), 확인할 것 1~6 판정(2는 역할 × 동작 표), Build 물음 3개 의견, 사용자 할 일 순서 점검, 확인하지 못한 것(실 DB), 대표 사진 목록 — 한국어로 간결하게. 마지막 줄에 **"배포해도 됨 / 고친 뒤 배포"**와 까닭.
