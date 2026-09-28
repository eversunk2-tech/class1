# Build 지침 — 구글·깃허브(OAuth) 계정 완전 삭제 (2026-09-28, 사용자 승인)

> 설계: **`docs/admin/oauth-delete/spec.md`**(본문 + 끝 **개정 1 — 사용자 결정**이 우선). 사용자 요청: "구글/깃허브 계정으로 로그인 한 경우에는 관리자가 탈퇴를 시키면 완전히 삭제 되어서 정보가 대시보드에 남아 있지 않도록 탈퇴되도록 변경해줘 … 원할 경우 같은 구글/깃허브 계정으로 다시 가입도 가능하게 해줘." 결정: 게시판 글 모두 지우기 · 교사는 담임 해제 뒤 삭제 · 관리 기록 모두 지우기 · 메뉴를 '완전 삭제'로 교체 · 총괄만 · 소급 자동 삭제 없음.
> 보고서: `docs/admin/oauth-delete/build-report.md`. 이 작업만 한다 — 다른 담당(실험 앱 단계 E2)이 `public/apps/`·`scripts/templates/`를 동시에 고치고 있으니 **그 폴더는 건드리지 않는다**.

## 만들 것·고칠 것
1. **새 마이그레이션 `supabase/migrations/20260928000000_oauth_purge.sql`**(재실행 안전 — `create or replace`, `drop … if exists`; 파일 위에 실행 방법·확인 쿼리·"SQL Editor에서 함수를 직접 부르지 말 것(서비스 롤 전용)" 경고; **개인정보(이메일·이름) 없이**):
   * `public.admin_purge_oauth_member(p_target uuid, p_actor uuid)` — `security definer`, `set search_path = ''`, `service_role`만 실행(`revoke … from public, anon, authenticated` + `grant execute … to service_role`). 한 트랜잭션 안에서:
     - 확인: 인자, 호출자(`p_actor`)가 총괄(`profiles.role='admin' and is_super_admin`), 자기 자신 아님, 대상이 없으면 조용히 끝(재시도 멱등), 대상 `role='admin'`이면 거부(먼저 담임 해제), **대상이 OAuth 전용인지**(`member_directory.providers`에 `'email'`이 없고 `provider`도 `'email'`이 아님 — 행이 없으면 거부) — 함수와 이중 확인.
     - 지우기 순서: ① 그 계정의 글·댓글을 신고한 기록(`community_reports`에서 `target_author_id = 대상`, 그리고 대상이 쓴 글·댓글을 가리키는 행 — 스냅샷에 이름·내용이 남으므로) ② 그 계정이 쓴 자유게시판·학습게임 글(`community_posts.author_id = 대상` — 다른 사람의 댓글·좋아요는 cascade로 함께) ③ 감사 로그 3곳(`member_withdrawal_log`·`member_create_log`·`password_reset_log`에서 `target_id = 대상`) ④ `profiles` 한 줄(나머지 — 학습 기록·블로그 댓글·좋아요·커뮤니티 댓글·좋아요·자기가 한 신고·`member_directory`·`class_teachers` 등은 FK cascade, 블로그 글·과제·선생님 글·칭찬 문구·학급 `created_by`는 set null). spec §3.1 표를 **실제 마이그레이션 SQL로 다시 확인**하고, 표에 없는 사용자 참조(예: `views`, Storage 메타 등)가 있으면 처리·보고.
     - 게임 파일은 SQL로 `storage.objects`를 지우지 않는다(Edge Function이 Storage API로 먼저 지움).
   * RLS 정책 안에서 같은 표 다시 조회 금지(42P17), 배열 비교는 `x = any (public.f())`(괄호 겹치지 않기 — 42883 사고), 반별 권한 SQL 뒤라 **옛 마이그레이션을 고치거나 다시 실행하게 하지 않는다**.
   * 확인 쿼리 예: 함수가 있고 `service_role`만 실행 가능한지(`has_function_privilege`), 삭제 뒤 대상 id가 `profiles`·`member_directory`·로그 3곳·`community_*`에 0행인지.
2. **새 Edge Function `supabase/functions/admin-purge-oauth-member/`**(`index.ts` + `README.md` — 배포: `npx supabase functions deploy admin-purge-oauth-member`, `--no-verify-jwt` 금지). `admin-delete-member/index.ts`의 구조·CORS(`ALLOWED_ORIGINS` + Secret `EXTRA_ALLOWED_ORIGINS`)·오류 문구 방식을 따른다:
   * 요청 `POST { userId }`. ① 호출자 JWT 확인 → ② **총괄만**(아니면 403 한국어 안내) → ③ 대상 확인: 있음, 자기 자신 아님, `role<>'admin'`(교사면 400 "교사(관리자) 계정은 먼저 담임 해제를 해 주세요."), **OAuth 전용**(`member_directory.providers`와 `auth.admin.getUserById`의 identities/app_metadata로 이중 확인 — `email`이 하나라도 있으면 400 "아이디로 로그인하는 계정은 완전 삭제 대신 '탈퇴 처리'를 이용하세요.") → ④ 새 SQL 적용 여부 프로브(없으면 "DB 설정 필요" 안내로 거부 — 아무것도 지우지 않음) → ⑤ **Storage `game-uploads`에서 경로 첫 칸이 대상 id인 파일 모두 삭제**(목록 → remove, 실패하면 여기서 멈추고 오류 — 아직 계정·기록은 그대로) → ⑥ `auth.admin.deleteUser(userId)`(하드 삭제 — 이미 없으면 통과) → ⑦ RPC `admin_purge_oauth_member(userId, 호출자id)`. ⑦ 실패 시 `warning`과 함께 200(다시 누르면 ⑤·⑥은 통과하고 ⑦만 다시) — `admin-delete-member`의 ⑤→⑥ 멱등 패턴과 같게.
   * 비밀값·토큰·학생 정보를 로그에 쓰지 않는다(대상 id·결과 코드만).
3. **관리자 화면**(`src/lib/admin.ts`, `src/components/admin/`, `src/app/admin/(dashboard)/members/member-list.tsx`·`member-detail.tsx` 등):
   * `purgeBlockReason(member, me)`(본인·관리자(담임 해제 먼저)·총괄 아님·아이디 로그인 가능 계정·이미 없음), `purgeOAuthMember(userId)`(새 함수 호출, 오류 문구 처리).
   * **OAuth 전용 계정**(`!canResetPassword(member)`)이면 '탈퇴 처리' 메뉴를 **'완전 삭제'로 교체**(아이콘 구분 — 예: 휴지통). 아이디 계정은 지금처럼 '탈퇴 처리'. 총괄이 아니면 완전 삭제는 비활성(까닭 표시) — 담임 화면에는 대개 OAuth 계정이 안 보이지만 보이면 비활성. 교사(`role='admin'`) OAuth 계정은 비활성 + "먼저 담임 해제를 해 주세요". 예전에 탈퇴시킨 OAuth 계정("탈퇴함")에도 '완전 삭제'가 보인다.
   * 새 대화상자 `member-purge-dialog.tsx`(`member-withdraw-dialog.tsx`를 본떠): 이름 다시 입력해야 버튼이 켜짐, **진한 빨강 확인 버튼**(`src/lib/danger-button.ts`), 경고 문구(6학년이 아니라 교사가 읽음 — 정확하게): "이 계정과 함께 학습 기록, 댓글·좋아요, 자유게시판·학습게임에 쓴 글과 올린 게임 파일, 관리 기록이 모두 지워집니다. 그 글에 달린 다른 사람의 댓글도 함께 사라집니다. 되돌릴 수 없습니다." + "같은 구글·깃허브 계정으로 다시 로그인하면 새 계정으로 시작합니다." 성공하면 목록에서 그 행이 사라짐(새로 불러옴), 경고(warning)면 "일부 정리가 끝나지 않았어요. 다시 눌러 주세요." 식 안내.
   * 관리자 영역 디자인 규칙(`src/app/admin/admin-theme.css`, 위험 버튼 진한 빨강, 제목 그림자 없음) 그대로.
4. **문서**: `supabase/functions/admin-purge-oauth-member/README.md`(배포·확인), 보고서. `CLAUDE.md`·`docs/STATUS.md`는 고치지 않는다(Claude가 한다) — 보고서에 CLAUDE.md 개정 문구 제안(spec §4.4)만.

## 바꾸지 않는 것
* 아이디 계정의 '탈퇴 처리'(기록 보존)와 `admin-delete-member` 함수·`20260923000000_member_withdrawal.sql`, 기존 RLS 정책, 다른 Edge Function, `public/apps/`·`scripts/templates/`(다른 담당 작업 중), 저장된 학생 기록 모양.

## 확인(반드시)
* `npm run lint`, `npx tsc --noEmit`, `git diff --check`. Edge Function은 Deno가 없으면 문법·타입을 코드 읽기로 검토(가능하면 `npx tsc`로 타입만 — 설치 금지).
* **SQL은 실행할 수 없다(로컬 Postgres 없음)** — 줄마다 읽어 검토: 문법, `search_path=''`에서 모든 이름에 `public.` 붙였는지, 재실행 안전, 권한, FK 순서(지우는 순서가 제약에 걸리지 않는지 — `community_reports` 스냅샷·`post_id` set null 등), 트리거(`profiles` 삭제 때 도는 트리거가 있는지 — 있으면 영향).
* **화면**: 빌드는 **저장소 `out/`에 하지 않는다** — `git archive HEAD`를 스크래치 `…/scratchpad/oauth-delete/site/`에 풀고 이 작업의 파일을 덮어쓴 사본에서 `node_modules`를 저장소 것에 링크해 **가짜 Supabase 주소·키**로 `next build` → 그 `out/`을 자기 정적 서버(포트 **8921**, 스크래치에 `class1 → out` 링크로 `/class1/` 경로) + 자기 전용 headless Chrome(포트 **9421**, 프로필 `…/scratchpad/oauth-delete/profile`) + `--host-resolver-rules`로 Supabase 차단 + 첫 로드부터 CDP `Fetch` 가짜 응답(총괄·담임·학생, 아이디 계정·구글 계정·깃허브 계정·교사 구글 계정·예전에 탈퇴한 구글 계정이 섞인 회원 명단, 새 함수 응답 200/403/400/500/warning) + 캐시 끄기. 시험 도구는 `…/scratchpad/class-assignments/`·`…/scratchpad/notices/`의 것을 **자기 폴더로 복사해** 쓴다(`docs/classes/review-links.md` 방식).
* 확인할 화면: 총괄 — 구글 계정 행 메뉴 '완전 삭제'(교체)·아이디 계정은 '탈퇴 처리'·교사 구글 계정은 비활성+안내·예전 탈퇴 구글 계정에 '완전 삭제', 대화상자(이름 입력 전 버튼 꺼짐, 경고 문구, 진한 빨강), 성공 뒤 행 사라짐, 오류·경고 문구. 담임 — 완전 삭제 없음/비활성. 데스크톱·휴대폰 폭, 밝음·어두움, 콘솔 오류 0. 전·후 스크린숏 쌍(전 = `HEAD`) `…/scratchpad/oauth-delete/shots/`.
* 실제 Supabase·Google·GitHub에 요청하지 않는다. 아무것도 내려받거나 설치하지 않는다. git commit/push·실 DB 쓰기 금지. `localStorage.clear()` 금지. 다른 담당의 포트(9403·8903·8913)·프로세스 건드리지 않기. **한 명령이 10분 넘게 조용하면 작업이 끊긴다** — 빌드·시험은 나눠서, 시간 제한을 두고. 끝나면 서버·Chrome 종료.
* 저장소 파일(코드 주석·문서·SQL)에 이메일·이름 같은 개인정보를 쓰지 않는다.

## 보고서 `docs/admin/oauth-delete/build-report.md`
바꾼 것(파일:행), SQL 검토 결과(지우는 표·순서·확인 쿼리), 함수 흐름과 오류 코드 표, 화면 전·후 사진 목록, 확인 결과, **사용자가 할 일 순서**(SQL 실행 → 확인 쿼리 → 함수 배포 → 실제 시험용 구글 계정으로 가입·완전 삭제·다시 가입 확인), 확인하지 못한 것, CLAUDE.md 개정 문구 제안 — 한국어로 간결하게.
