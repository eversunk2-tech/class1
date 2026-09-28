# 검토 지침(Review) — 구글·깃허브(OAuth) 계정 완전 삭제 (2026-09-28)

당신은 **Review** 담당이다. **코드를 고치지 않는다**(발견만 기록 — 저장소에는 보고서 하나만 새로 쓴다). 이 기능은 **되돌릴 수 없는 삭제**다 — 잘못 지우는 경로(아이디 계정·교사·총괄 자신·다른 계정이 지워짐, 권한 없는 사람이 부름, 반쯤 지워진 채 다시 못 지움)를 가장 먼저 찾고, 있으면 "높음"으로 분명히.

## 먼저 읽기
* 설계 `docs/admin/oauth-delete/spec.md`(끝 **개정 1 — 사용자 결정**이 우선: 게시판 글·올린 게임 모두 지우기, 교사는 담임 해제 뒤, 관리 기록 모두 지우기(삭제 사실 로그도 없음), '탈퇴 처리' 메뉴를 '완전 삭제'로 교체, 총괄만, 소급 자동 삭제 없음), 지침 `build-instructions.md`, 보고 `build-report.md`, `CLAUDE.md`(Supabase·SQL 적용 절차·로그인·탈퇴·디자인 규칙).
* 바뀐 파일: `supabase/migrations/20260928000000_oauth_purge.sql`, `supabase/functions/admin-purge-oauth-member/`(`index.ts`·`README.md`), `supabase/config.toml`, `src/lib/admin.ts`, `src/components/admin/member-purge-dialog.tsx`, `src/app/admin/(dashboard)/members/member-list.tsx`·`member-detail.tsx`. 비교: `git diff HEAD -- src supabase`. 참고 — 아이디 계정 탈퇴 `supabase/functions/admin-delete-member/index.ts`, `20260923000000_member_withdrawal.sql`.
* Claude가 이미 SQL을 읽어 확인한 것: 함수가 쓰는 열(`community_reports.target_kind`·`member_create_log.actor_name`·`password_reset_log.actor_id`)이 있고 비울 수 있음, `community_comments/likes.post_id` cascade·`community_reports.post_id` set null, `member_withdrawal_log`에는 `actor_name`이 없음(`actor_id` set null). 이것도 다시 확인해도 된다.

## 확인할 것
1. **SQL**(실행할 수 없다 — 줄마다 읽기): 문법(plpgsql), `search_path=''`에서 모든 이름 `public.`/`auth.`, 재실행 안전, 권한(`service_role`만 — 맨 끝 점검), 확인 순서(총괄·자기 자신·잠금·교사·OAuth 전용·로그인 계정 먼저 지워졌는지 — `auth.users` 읽기와 `insufficient_privilege` 처리), 지우는 순서가 FK에 걸리지 않는지, 트리거 영향, 이미 지워진 대상 재호출(멱등), 동시 두 번 호출, 앞선 마이그레이션을 고치지 않는지, 개인정보 없음. 확인 쿼리 1)~4)가 맞게 동작할지(3)의 `storage.objects`·`auth.users` 조회 권한 포함).
2. **Edge Function**: CORS(`ALLOWED_ORIGINS` + `EXTRA_ALLOWED_ORIGINS`, 다른 함수와 같게), JWT 확인(호출자 토큰으로 사용자 확인), **총괄만**(담임·학생 403), 대상 확인(자기 자신·교사·없음·**아이디 로그인이 있는 계정**을 `member_directory`와 Auth identities 두 곳으로 — 둘이 다르면?), 새 SQL 프로브(없으면 아무것도 안 지우고 거부), Storage `game-uploads/{id}/` 목록·삭제(목록 한도·하위 폴더·페이지 넘김 — 파일이 많을 때 남지 않는지, 삭제 뒤 다시 목록으로 비었는지), `deleteUser` 하드 삭제(이미 없으면 통과), RPC 실패 때 200 + warning과 다시 누르기 흐름(두 번째에는 ⑤·⑥이 통과하고 ⑦만), 오류 코드·한국어 문구, 로그에 개인정보·토큰 없음, `config.toml`의 `verify_jwt = true`, `--no-verify-jwt`를 쓰라는 안내가 없는지, README 배포 절차.
3. **화면**: OAuth 전용(`providers`에 `email` 없음) 행만 '완전 삭제'(휴지통) — 아이디 계정·가입 방식을 모르는 계정은 '탈퇴 처리' 그대로, 교사 OAuth 계정은 비활성 + "먼저 담임 해제", 총괄이 아니면 비활성, 예전에 탈퇴한 OAuth 계정에도 '완전 삭제', 대화상자(이름 다시 입력 전 버튼 꺼짐, 경고 문구가 결정과 맞는지 — 다른 사람 댓글도 사라짐·피드백 메시지·되돌릴 수 없음·다시 가입하면 새 계정, 진한 빨강 버튼, 키보드·초점·Esc), 성공 뒤 목록에서 사라짐, 404·403·400·500·warning 문구, 관리자 영역 디자인 규칙(채도 낮춘 보라, 제목 그림자 없음), 데스크톱·휴대폰 폭, 밝음·어두움, 콘솔 오류 0. 회원 상세 화면에서도 같게.
4. **요청과 맞는지**: "정보가 대시보드에 남아 있지 않도록" — 회원 명단·학습 현황·학생 응답·피드백·신고 관리·관리 기록 화면 어디에 흔적이 남을 수 있는지(표를 돌며 확인), "같은 구글/깃허브 계정으로 다시 가입" — 막을 것이 없는지(유일 제약·트리거).
5. `npm run lint`, `npx tsc --noEmit`, `git diff --check`, 임시 코드·`console.log`·`debugger` 없음.

## 시험 방법(반드시)
* 빌드는 **저장소 `out/`에 하지 않는다** — `git archive HEAD`를 스크래치 `…/scratchpad/review-oauth/site-before/`에 풀어(전), 같은 것에 작업 트리의 바뀐 파일을 덮어쓴 사본 `…/site-after/`(후)에서 각각 `node_modules`를 저장소 것에 링크해 **가짜 Supabase 주소·키**로 `next build`(Build 담당의 `…/scratchpad/oauth-delete/` 방식·도구를 **자기 폴더로 복사해** 써도 된다). 자기 정적 서버 **8922**(스크래치에 `class1 → out` 링크로 `/class1/`), 자기 전용 headless Chrome **9422**(프로필 `…/scratchpad/review-oauth/profile`), `--host-resolver-rules="MAP *.supabase.co 127.0.0.1:9, MAP supabase.co 127.0.0.1:9"` + 첫 로드부터 CDP `Fetch` 가짜 응답(총괄·담임, 아이디·구글·깃허브·교사 구글·예전 탈퇴 구글·가입 방식 없음 계정이 섞인 명단, 함수 응답 200/403/400/404/500/warning) + 캐시 끄기.
* 실제 Supabase·Google·GitHub에 요청하지 않는다. 아무것도 내려받거나 설치하지 않는다. git commit/push·실 DB 쓰기 금지. `localStorage.clear()` 금지. 다른 작업의 포트(9404·8904·8914 — 실험 앱 검토 중)·프로세스 건드리지 않기. **한 명령이 10분 넘게 조용하면 작업이 끊긴다** — 빌드·시험은 나눠서, 시간 제한을 두고. 끝나면 서버·Chrome 종료.
* 사용자에게 보일 대표 사진(전·후 또는 후만): 회원 목록 메뉴(구글 계정 '완전 삭제' / 아이디 계정 '탈퇴 처리'), 완전 삭제 대화상자, 교사 구글 계정 비활성 안내 — `…/scratchpad/review-oauth/showcase/`.

## 보고서 `docs/admin/oauth-delete/review.md`
심각도(높음·중간·낮음)별 발견 표(파일:행, 무엇, 재현, 제안), 확인할 것 1~5 판정, 사용자가 할 일 순서 점검(SQL 실행 → 확인 쿼리 → 함수 배포 → push → 시험용 계정 확인 — 빠진 것·위험), 확인하지 못한 것(실 DB·실 함수), showcase 목록 — 한국어로 간결하게. 마지막 줄에 **"배포해도 됨 / 고친 뒤 배포"**와 까닭.
