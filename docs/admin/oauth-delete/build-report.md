# Build 보고 — 구글·깃허브(OAuth) 계정 완전 삭제 (2026-09-28)

> 지침 `build-instructions.md`, 설계 `spec.md`(끝 "개정 1"이 우선). **커밋·push·SQL 실행·함수 배포는 하지 않았다.** 실 DB·실제 Supabase·Google·GitHub 요청 0, 내려받기·설치 0.
> `public/apps/`·`scripts/templates/`·`admin-delete-member`·기존 마이그레이션·`CLAUDE.md`·`docs/STATUS.md`는 건드리지 않았다.

## 1. 요약
- **OAuth 전용 계정**(가입 방식이 기록돼 있고 그중 아이디(`email`)가 없음)은 회원 목록·상세의 **'탈퇴 처리'가 '완전 삭제'(휴지통 아이콘)로 바뀐다.** 아이디 계정·아이디+구글 섞인 계정은 지금처럼 '탈퇴 처리'.
- 완전 삭제 = **총괄만**. Edge Function이 ① 게임 파일(Storage) → ② 로그인 계정(`auth.users`, 하드 삭제) → ③ DB 함수(남은 기록 한 트랜잭션) 순서로 지운다. 다시 눌러도 안전(끝난 단계는 통과).
- 교사(OAuth) 계정은 '완전 삭제' 꺼짐 + "먼저 담임 해제". 예전에 탈퇴 처리한 OAuth 계정("탈퇴함")도 '완전 삭제'로 남은 기록을 지울 수 있다(자동 일괄 없음).
- 다시 가입: 새 SQL 없음(옛 행을 모두 지우므로 부딪힐 것이 없다 — 새 id 로 새 계정).

## 2. 바꾼 것 (파일:행)
| 파일 | 내용 |
|---|---|
| `supabase/migrations/20260928000000_oauth_purge.sql`(새, 291줄) | 머리말(1~119: 무엇·누구·지우는 순서·트리거·실행 순서·확인 쿼리 4개·되돌리기), 맨 앞 점검(124~148), 함수 `admin_purge_oauth_member`(156~251), 권한(254~255: `public·anon·authenticated` 회수, `service_role`만), 맨 끝 점검(260~288), `notify pgrst`(291) |
| `supabase/functions/admin-purge-oauth-member/index.ts`(새, 338줄) | 흐름 ①~⑦(173~336), Storage 목록·삭제·재확인 `listFolderFiles`(113)·`removeGameFiles`(141). CORS·오류 판별은 `admin-delete-member`와 같은 방식 |
| `supabase/functions/admin-purge-oauth-member/README.md`(새) | 누가·순서·지워지는 것/남는 것·배포(A CLI / B 대시보드)·배포 후 실제 시험 6단계·화면 메시지 표 |
| `supabase/config.toml`(+4줄) | `[functions.admin-purge-oauth-member] verify_jwt = true`(기본값도 true지만 가장 파장이 큰 함수라 명시 — 지침 목록에는 없던 추가) |
| `src/lib/admin.ts`(+111줄) | `isOAuthOnlyMember`(265), `PurgeAccess`·`purgeAccessFrom`(271·274), `purgeBlockReason`(285 — 본인 → 교사(먼저 담임 해제) → 확인 중/확인 실패/총괄만 → 아이디 계정 → 정보 없음), `MemberGoneError`(330), `purgeOAuthMember`(425 — 404 `code:"target_not_found"`면 MemberGoneError, 배포 안 됨·연결 실패 문구) |
| `src/components/admin/member-purge-dialog.tsx`(새, 181줄) | `MemberWithdrawDialog`를 본뜸: 이름 다시 입력 → 버튼 켜짐, 진한 빨강(`dangerSolidClass`), 지침 경고 문구 그대로 + "같은 구글·깃허브 계정으로 다시 로그인하면 새 계정으로 시작합니다." + 교사였던 계정 안내(피드백 삭제·글은 쓴 사람 없이 남음). 작은 화면은 창 안 스크롤(`max-h-[calc(100dvh-2rem)]`). 성공 → `onPurged`, 경고 → `onPartial`, 이미 없음 → 닫고 목록에서 뺌 |
| `src/app/admin/(dashboard)/members/member-list.tsx`(+74/−13) | 케밥 메뉴 마지막 항목 교체(734~759), `refreshAfterPurge`(253 — 성공이면 그 행을 먼저 빼고 조용히 다시 읽음, 경고면 다시 읽기만), 대화상자(644) |
| `src/app/admin/(dashboard)/members/member-detail.tsx`(+52/−3) | '완전 삭제' 버튼/불가 사유(281~296), 예전 탈퇴 OAuth 안내 한 줄(245), 학습 기록 안내 끝 문구(327), 성공 → 회원 목록으로(`router.push`), 경고 → 그 자리에서 다시 읽기(356) |

지침과 다르게(더 좁게·안전하게) 한 것
- **OAuth 전용 판별** = `!canResetPassword` **이면서 가입 방식이 하나 이상 기록된 계정**. 가입 방식이 비어 있는 이상한 계정은 예전처럼 '탈퇴 처리'(기록 보존)로 둔다(SQL·함수도 "가입 방식 모름"은 거부).
- **학급 SQL 전(예전 방식, `my_admin_context` 없음)**에는 완전 삭제를 쓸 수 없으므로(총괄 개념 없음) OAuth 계정도 예전 '탈퇴 처리'를 그대로 보인다.

## 3. SQL 검토 (실행하지 않음 — 줄마다 읽고 구조 검사 스크립트로 확인)
**지우는 순서**(함수 안, 한 트랜잭션)
0. 확인: 인자 → 부른 사람 = 총괄(`role='admin' and is_super_admin`) → 자기 자신 아님 → 대상 `profiles` 행 **잠금**(`for update`, 없으면 조용히 끝 = 재시도 멱등) → 교사면 거부 → `member_directory`로 OAuth 전용 확인(행 없음·`email` 있음·가입 방식 모름 → 거부) → **로그인 계정이 이미 지워졌는지**(`auth.users`에 남아 있으면 거부 — 기록만 지우고 로그인이 남는 일 방지. `auth` 읽기 권한이 없으면 이 확인만 건너뜀)
1. `community_reports`: `target_author_id = 대상` 또는 대상의 글을 가리키는 **글 신고**(`comment_id` 없음 + `target_kind`≠comment) 또는 대상의 댓글을 가리키는 신고(스냅샷에 제목·내용·작성자가 남으므로)
2. `community_posts`(author = 대상) → 그 글의 다른 사람 댓글·좋아요 cascade, 남은 신고의 `post_id`·`comment_id` set null
3. 관리 기록: `member_withdrawal_log`·`member_create_log`·`password_reset_log`에서 `target_id = 대상` 삭제 + **대상이 '처리한 사람'으로 남은 흔적**(교사였던 계정): `member_create_log.actor_name` → null, `password_reset_log.actor_id` → null(행은 다른 회원의 기록이라 남김)
4. `profiles` 한 줄 → 외래키가 나머지 정리

**외래키 재확인**(18개 마이그레이션 전체 grep — spec §3.1 표 + 표에 없던 것 ★)
- cascade: `comments`·`likes`·`member_directory`·`app_results`·`post_reads`·`assignment_submissions`·`feedback_threads`(→ messages·read_marks)·`feedback_messages.sender_id`·`feedback_read_marks.user_id`·`app_progress`(not valid지만 삭제 동작은 적용)·`class_teachers`·`community_comments`·`community_likes`·`community_reports.reporter_id`
- set null: `posts.author_id`·`assignments.created_by`·`class_notices.author_id`·`praise_presets.created_by`·`community_posts.author_id`·`community_reports.target_author_id` + ★`classes.created_by`·★`site_settings.updated_by`·★`member_create_log.actor_id`·★`member_withdrawal_log.actor_id`
- 외래키 없이 사용자 id를 가진 열: 로그 3곳의 `target_id` + ★`password_reset_log.actor_id` + ★`member_create_log.actor_name`(이름 스냅샷) — 모두 3)에서 처리. `views`는 글 id만(사용자 열 없음). Storage `storage.objects.owner`는 파일을 먼저 지우므로 남는 행 없음.

**트리거·RLS·권한**
- `profiles`에 삭제 트리거 없음. set null은 그 표의 update 트리거를 부름 → `posts`·`assignments`·`class_notices`의 `set_updated_at()`뿐(수정 시각이 바뀜, 오류 없음). `community_posts_guard`(insert/update)는 2)에서 글을 먼저 지워 불리지 않음. 제출물 가드·신고 가드는 insert/update 전용.
- 신고 중복 방지 부분 인덱스(set null 때 충돌)는 1)에서 대상 글의 글 신고를 먼저 지워 일어날 수 없음.
- 함수는 표 주인 권한(security definer, `search_path=''`, 모든 이름 `public.`/`auth.` 붙임) — RLS를 거치지 않음(`admin_finalize_withdrawal`과 같음). RLS 정책은 만들지도 고치지도 않음(42P17 무관). 배열 비교 `'email' = any (coalesce(v_providers, '{}'))`(괄호 한 겹 — 42883 무관).
- 맨 끝 점검: anon·authenticated 실행 불가 / service_role 실행 가능 / `profiles`·`community_posts`·`community_comments`를 가리키는 외래키 중 restrict·no action이 있으면 **전부 되돌림**(완전 삭제가 반쯤 멈추는 일 방지 — 지금 SQL 기준 0개).
- 재실행 안전(`create or replace`, revoke/grant). 앞선 마이그레이션은 고치지도 다시 실행하게 하지도 않음.
- 구조 검사(스크래치 `sqlcheck.mjs`): 문장 6개 괄호 균형, `raise` 자리표시 14개 일치, `any((select` 0, 함수 본문 begin/end·if/end if 균형.

**확인 쿼리**(파일 위 80~119행): 1) 함수 권한 false·false·true 2) profiles를 가리키는 외래키가 c/n뿐 3) 시험 뒤 지운 id로 남은 행 15곳 모두 0(게임 파일·`auth.users` 포함) 4) 다시 로그인 뒤 새 id·역할 user·학급 없음(이름·이메일 열은 뺌).

## 4. Edge Function 흐름·응답
① JWT → ② 총괄 확인 → ③ 대상(자기 자신·없음·교사) → ③-2 `member_directory` 가입 방식 → ③-3 `auth.admin.getUserById`의 app_metadata·identities(계정이 이미 없으면 명단 확인만) → ④ RPC 프로브(빈 인자 — "함수 없음"만 거부) — **여기까지 아무것도 지우지 않음** → ⑤ `game-uploads/{id}/` 파일 목록(쪽 나눔·하위 폴더 2단계) → 100개씩 remove → 다시 목록으로 비었는지 확인 → ⑥ `deleteUser`(하드, 이미 없으면 통과) → ⑦ RPC. 로그: 실패 단계·오류 문구만(토큰·이메일·이름 없음, 성공은 남기지 않음 — Q3).

| 응답 | 경우 | 화면 |
|---|---|---|
| 200 `{ok, alreadyDeleted, removedFiles}` | 완료 | 알림 "○○ 계정을 완전히 삭제했습니다." + 목록에서 사라짐 / 상세면 목록으로 |
| 200 `{…, warning}` | ⑦ 실패(계정·파일은 지움) | 경고 알림 "…한 번 더 실행하면 남은 기록만 다시 지웁니다." + 다시 읽기(행 남음) |
| 401 | 토큰 없음·만료 | 창 안 안내 |
| 403 | 총괄 아님 | "구글·깃허브 계정의 완전 삭제는 총괄 관리자만 할 수 있습니다." |
| 400 | userId 형식·자기 자신·교사("먼저 담임 해제")·아이디 로그인 있음·가입 방식 모름·학급 SQL 없음·**새 SQL 없음**("완전 삭제 기능용 DB 설정이 아직 적용되지 않았습니다 … 아무것도 지우지 않습니다") | 창 안 안내 + '다시 시도' |
| 404 `{code:"target_not_found"}` | 이미 없는 회원 | 창 닫고 "이미 지워진 계정입니다" + 목록에서 뺌 |
| 500 | 권한·대상·가입 방식 확인 실패, **게임 파일 삭제 실패**(계정·기록 그대로), 로그인 계정 삭제 실패(파일만 지워졌을 수 있음 — 문구에 표시) | 창 안 안내 |
| (함수 없음·연결 실패) | 게이트웨이 404·네트워크 | "완전 삭제 기능이 아직 준비되지 않았습니다 / 연결하지 못했습니다 … admin-purge-oauth-member" |

## 5. 확인 결과
- `npx tsc --noEmit` exit 0 · `npm run lint` exit 0(바뀐 4파일 `--max-warnings=0`도 0) · `git diff --check` 깨끗(새 파일도 끝 공백·탭·CRLF 0) · 저장소 파일에 이메일·실명 0.
- Edge Function: Deno가 없어 스크래치 사본의 `npm:` 가져오기를 저장소 `@supabase/supabase-js`(2.116) 타입으로 바꿔 `tsc --strict --noUnusedLocals` exit 0(일부러 넣은 오류는 잡힘 확인).
- 화면: `git archive HEAD`(101ecb0) 사본(전)·그 사본 + 이번 4파일(후)을 스크래치에서 가짜 Supabase 주소·키로 `next build`(둘 다 성공 25쪽, 번들 속 Supabase 주소는 가짜 하나) → 자기 정적 서버 **8921**(쿠키로 전/후 선택) + 자기 headless Chrome **9421**(`--host-resolver-rules`로 supabase.co 차단 — 가로채기 없는 탭에서 `Failed to fetch` 확인) + 첫 로드부터 CDP `Fetch` 가짜 응답 + 캐시 끔.
- **자동 점검 95/95 통과**(콘솔 오류 0, 외부 요청 0): 총괄 목록 메뉴(구글·깃허브 = 완전 삭제 켜짐 / 교사 구글 = 꺼짐 "먼저 담임 해제"·담임 해제 메뉴는 그대로 / 예전 탈퇴 구글 = 완전 삭제 켜짐 / 아이디·섞인·가입 방식 모름 = 탈퇴 처리 / 본인 = 꺼짐), 대화상자(제목·경고 문구 글자 그대로·다시 가입 안내·이름 일부 입력 → 꺼짐·그대로 입력 → 켜짐·버튼 색이 `oklch(0.5 0.2 25)`와 같은 픽셀 + 흰 글자, 어두움 `oklch(0.55 0.22 25)`), 성공(대상 id 1번·POST·Bearer, 알림, 행 사라짐, 목록 다시 읽기), 경고(행 남음·다시 누를 수 있음), 이미 없음(404 → 목록에서 뺌), 오류 7종 문구(403·400 3종·500·404 배포 안 됨·연결 실패), 상세 4종 + 상세에서 성공(목록으로 이동)·경고(그 자리 다시 읽기), 담임(구글 안 보임 / 보이면 꺼짐 "총괄만", 요청 0), 권한 확인 중(꺼짐 "확인 중" → 확인 뒤 켜짐), 학급 SQL 전(탈퇴 처리 그대로), 휴대폰 390×844(카드 메뉴·대화상자 화면 안·가로 넘침 0) + 낮은 화면 390×480(창 안 스크롤, 끝에 버튼 보임), 어두움.
- 사진 `…/scratchpad/oauth-delete/shots/`: 전·후 나란히 `compare/01-menu-google` · `02-menu-withdrawn-google` · `03-menu-teacher-google` · `04-menu-id-student`(그대로) · `05-detail-google` · `06-detail-withdrawn-google` · `07-mobile-menu-google`, 후만 `after-07-dialog-typed` · `after-08-dialog-withdrawn` · `after-09-purged-list` · `after-10-warning-toast` · `after-11-error-missing-sql` · `after-14-detail-teacher-google` · `after-16-home-sees-google-disabled` · `after-19-mobile-dialog` · `after-20/21-mobile-dialog-short` · `after-24-dark-dialog`. 도구·결과: 같은 폴더 `lib.mjs`·`backend.mjs`·`run.mjs`·`serve.mjs`·`pair.mjs`·`report-*.json`.

## 6. 사용자가 할 일 (순서)
1. Supabase SQL Editor에서 `supabase/migrations/20260928000000_oauth_purge.sql` 전체 Run → "✔ 구글·깃허브 계정 완전 삭제 함수…" 알림.
2. 파일 위 **확인 쿼리 1)·2)** — 1) false·false·true, 2) on_delete가 c·n만.
3. Mac 터미널: `npx supabase functions deploy admin-purge-oauth-member`(`--no-verify-jwt` 금지. 다른 함수 4개는 다시 배포할 필요 없음, Secret 추가 없음).
4. (Claude) 커밋·push → 두 사이트 확인.
5. **시험용** 구글(또는 깃허브) 계정으로 가입 → 게시판 글·댓글 하나 → 총괄로 회원 관리에서 그 계정 `⋮` = '완전 삭제'인지 확인, 상세 주소의 `id=` 값을 적어 둠 → 완전 삭제(이름 입력) → 목록에서 사라짐 → **확인 쿼리 3)** 모두 0 → 로그아웃 뒤 **같은 계정으로 다시 로그인** → 새 계정으로 가입되고 예전 글이 없는지 → **확인 쿼리 4)**.

## 7. 확인하지 못한 것
- SQL 실제 실행(로컬 Postgres 없음) — 문법·순서·권한은 읽어서만 확인. 특히 ① 함수 안에서 `auth.users` 읽기(0-5 — 권한이 없으면 건너뛰게 해 둠), ② 표 주인 권한으로 RLS를 거치지 않는다는 전제(기존 `admin_finalize_withdrawal`과 같음).
- Edge Function 실제 실행(Deno 없음): `deleteUser`가 identities까지 지우는지, 같은 구글·깃허브 계정 즉시 재가입, Storage `list`/`remove`가 서비스 롤로 폴더를 비우는지, 실제 오류 코드(404 user_not_found 등) — 모두 5단계 사용자 시험으로.
- 한계(README에 적음): 이미 로그인해 둔 기기의 접근 토큰은 최대 1시간 유효 — 그동안 새 글·기록은 프로필이 없어 저장되지 않지만 **게임 파일 업로드(Storage)만은 이론상 가능**(주인 없는 파일). Supabase 자체 Auth 감사 로그·함수 로그(사이트 대시보드 밖)는 Supabase 보관 기간대로 남는다.
- 부작용(설계대로, 화면 경고에 적음): 교사였던 계정의 피드백·칭찬이 지워지면 학생의 그 대화가 **메시지 없는 빈 대화**로 남을 수 있다. 그 교사의 글·과제·선생님 글의 수정 시각이 삭제 시각으로 바뀐다(set null 트리거).
- 실제 iPad·휴대폰 손가락 조작, 실제 로그인 계정.

## 8. CLAUDE.md 개정 문구 제안 (spec §4.4를 최종 결정에 맞게)
- "로그인 (Auth)"의 강제 탈퇴 줄 뒤: `**단, 구글·깃허브(OAuth) 전용 계정(아이디 로그인 없음)은 '완전 삭제'**(2026-09-28 사용자 결정, docs/admin/oauth-delete/): 회원 목록·상세의 '탈퇴 처리'가 '완전 삭제'로 바뀌고, 총괄만(담임 불가) 한다. 로그인 계정·학습 기록·댓글·좋아요·자유게시판·학습게임 글(그 글의 다른 사람 댓글 포함)·올린 게임 파일·그 계정 관련 신고·관리 기록을 모두 지우고 삭제 사실 기록도 남기지 않는다. 교사 계정은 먼저 담임 해제. 같은 계정으로 다시 로그인하면 새 계정. 아이디 계정은 지금처럼 기록 보존 탈퇴.`
- "Supabase"의 함수 목록: `지금 함수: admin-reset-password, admin-delete-member, admin-create-member, admin-purge-oauth-member, check-answer(…)` + CORS 줄의 "함수 4개를 다시 배포" → "함수 5개".
- (선택) 새 외래키 규칙: "profiles·community_posts·community_comments를 가리키는 외래키는 cascade 또는 set null로(restrict면 완전 삭제가 막힌다 — `20260928000000` 맨 끝 점검)."

## 9. 물을 것
1. **대상의 글에 달린 '다른 사람 댓글'에 대한 신고**는 남겼다(그 사람에 대한 기록 — 관리자가 글을 지울 때와 같음, 스냅샷은 그 사람 댓글). 이것까지 지울까?
2. 교사였던 계정이 **처리한 사람**으로 남은 이름(`member_create_log.actor_name`)·id(`password_reset_log.actor_id`)를 비웠다(행은 다른 회원 기록이라 남김) — 괜찮은가?
3. `supabase/config.toml`에 새 함수 `verify_jwt = true`를 더했다(지침 목록 밖) — 커밋에 넣을지.
4. 회원 관리 '내 학급' 카드 설명("총괄 선생님은 모든 회원을 찾아 비밀번호 초기화·탈퇴 처리를 할 수 있지만…", `class-card.tsx`)은 그대로 두었다 — '완전 삭제'를 덧붙일지.

커밋할 경로(제안): `supabase/migrations/20260928000000_oauth_purge.sql`, `supabase/functions/admin-purge-oauth-member/`, `supabase/config.toml`, `src/lib/admin.ts`, `src/components/admin/member-purge-dialog.tsx`, `src/app/admin/(dashboard)/members/member-list.tsx`·`member-detail.tsx`, `docs/admin/oauth-delete/`. 순서는 SQL 실행 → 확인 → 함수 배포 → push(CLAUDE.md).
