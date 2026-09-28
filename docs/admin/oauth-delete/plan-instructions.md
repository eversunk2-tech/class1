# Plan 지침 — 구글·깃허브(OAuth) 계정 완전 삭제 + 같은 계정 다시 가입 (2026-09-28)

## 사용자 요청(문구 그대로)
> 회원관리 관련한 수정 요청 사항이야. 구글/깃허브 계정으로 로그인 한 경우에는 관리자가 탈퇴를 시키면 완전히 삭제 되어서 정보가 대시보드에 남아 있지 않도록 탈퇴되도록 변경해줘.(학생들은 관리자 생성 계정으로만 로그인 할거라서 실수로 가입한 경우나 교사들 중 구글 계정 로그인 했으나 탈퇴 원할 경우 탈퇴진행하려고 함) 그리고 원할 경우 같은 구글/깃허브 계정으로 다시 가입도 가능하게 해줘.

당신은 **Plan** 담당이다. **계획서만 쓴다** — 코드·SQL 파일·Edge Function을 만들거나 고치지 않는다. 결과물: `docs/admin/oauth-delete/spec.md` 하나(한국어). 실 DB에 쓰지 않는다(읽기 확인도 하지 않아도 된다 — 저장소의 SQL·코드로 판단). 저장소가 **공개**라 이메일·학생 이름 등 개인정보를 문서에 쓰지 않는다.

## 먼저 읽기
* `CLAUDE.md`(특히 Supabase·SQL 적용 절차·로그인(Auth)·"강제 탈퇴는 완전 탈퇴"·학급(반별 구분) 권한), `docs/STATUS.md`의 관리자 기능·Supabase 표.
* 지금 탈퇴: `supabase/functions/admin-delete-member/index.ts`(+ README), `supabase/migrations/20260923000000_member_withdrawal.sql`(profiles ↛ auth.users 외래키 끊기, `admin_finalize_withdrawal`, `withdrawal_blocking_fks()`, `member_withdrawal_log`), 반별 권한 `20260927000000_classes_schema.sql`·`20260927010000_classes_rls.sql`(누가 탈퇴시킬 수 있나 — 총괄·담임), `docs/admin/admin-tools/spec.md`(탈퇴 설계 + 개정), `docs/classes/spec.md` 개정 1.
* 가입·프로필 생성: `20260921000000_init_blog.sql`·`20260921020000_admin_learning.sql`(`profiles`·`member_directory` 생성 트리거, 유일 제약), 계정 생성 `supabase/functions/admin-create-member/`, `20260923030000_member_create_log.sql`.
* 사용자 데이터가 들어가는 표 전부: 블로그(`posts`·`comments`·`likes`·`views`), 학습(`app_results`·`app_progress`·`post_reads`·`assignments`·`assignment_submissions`·`feedback_threads`·`feedback_messages`·`feedback_read_marks`·`praise_presets`), 학급(`classes`·`class_teachers`·`class_notices`), 커뮤니티(`community_posts`·`community_comments`·`community_likes`·`community_reports`, Storage `game-uploads`), 관리 로그(`password_reset_log`·`member_withdrawal_log`·`member_create_log`), 그 밖에 `supabase/migrations/` 전체에서 사용자 id를 가진 열.
* 관리자 화면: `src/lib/admin.ts`, 회원 관리 화면 컴포넌트(`src/components/admin/` 아래 — 탈퇴 대화상자·회원 명단), 학생 응답·학습 현황 화면이 "탈퇴한 학생"을 보여 주는 곳.

## 계획서에 담을 것
1. **지금 상태 정리**: 탈퇴하면 무엇이 지워지고 무엇이 남는지(표별), 대시보드 어디에 "탈퇴한 학생"으로 남는지. **같은 구글·깃허브 계정으로 다시 로그인하면 지금 무슨 일이 생기는지**(예: 남은 `member_directory`·`profiles` 행과 유일 제약이 부딪혀 가입이 실패하는지, 새 계정으로 잘 만들어지는지) — 코드·SQL 근거와 함께. 이미 탈퇴시킨 OAuth 계정의 남은 행이 있으면 어떻게 되는지.
2. **OAuth 계정 알아보기**: `auth.users`의 `raw_app_meta_data.provider(s)`·`auth.identities` 등으로 구글·깃허브 계정과 관리자가 만든 아이디 계정(`아이디@class1.local`, 이메일 로그인)을 어떻게 가르는지. 두 방식이 섞인 계정(아이디 계정에 구글을 연결 등)은 어떻게 볼지. 화면(회원 명단)에 로그인 방식을 보여 줄지.
3. **완전 삭제 설계**(OAuth 계정만 — 아이디 계정은 지금처럼 "기록 보존 탈퇴" 그대로):
   * 지울 것(표별 목록, 지우는 순서, 한 트랜잭션), Storage 파일(게임 업로드), 남길 것이 있다면 무엇과 까닭(예: 감사 로그를 개인정보 없이 한 줄 — "구글 계정 1명 완전 삭제, 처리한 관리자, 시각" 등 추천안), `withdrawal_blocking_fks()`와의 관계.
   * **교사(role `admin`) 계정**: 지금은 관리자 대상 탈퇴 불가. 요청에 "교사들 중 구글 계정 로그인 했으나 탈퇴 원할 경우"가 있다 — 담임이면 `class_teachers`·그가 쓴 선생님 글(`class_notices`)·과제(`assignments`)·블로그 글·칭찬 문구 등이 걸린다. 가능한 안(예: 총괄이 먼저 담임 해제·권한 해제 → 그다음 완전 삭제 / 교사가 쓴 글은 총괄에게 넘김 / 함께 지움)을 비교하고 추천안을 적는다. 총괄 자신은 대상 아님.
   * **누가 할 수 있나**: 총괄만 / 담임도 자기 반 OAuth 학생까지 — 추천안(OAuth 가입자는 대개 학급이 없다는 점 고려).
   * **다시 가입**: 삭제 뒤 같은 구글·깃허브 계정으로 로그인하면 새 계정(새 id, 일반 사용자, 학급 없음)으로 문제없이 만들어지게 — 필요한 SQL(유일 제약·트리거 처리)과 확인 방법.
   * 되돌릴 수 없음 — 화면 확인 절차(지금 탈퇴 대화상자처럼 이름 다시 입력 + "기록까지 모두 지워지고 되돌릴 수 없어요" 같은 경고, 위험 버튼 진한 빨강 `src/lib/danger-button.ts`).
4. **바꿀 것 목록**: 새 마이그레이션 SQL(파일 이름 제안, 재실행 안전, 반별 권한 SQL 뒤라 옛 마이그레이션 재실행 금지 규칙 지키기, RLS 정책 재귀 금지·`any(public.f())` 규칙), Edge Function(`admin-delete-member`를 넓힐지 / 새 함수를 둘지 — 추천안, service_role 안에서 호출자 권한 검증, CORS 규칙 그대로), 관리자 화면(회원 명단·탈퇴 대화상자·로그인 방식 표시·완전 삭제 버튼), 문서(`CLAUDE.md` 탈퇴 규칙 줄 개정안).
5. **배포 순서**: SQL 실행(사용자) → 확인 쿼리 → 함수 재배포(사용자, `npx supabase functions deploy <이름>`, `--no-verify-jwt` 금지) → 화면 push. 새 SQL이 없을 때 화면·함수가 안전하게 거부하는지(지금 탈퇴 함수의 "DB 설정 필요" 방식).
6. **시험 계획**: 가짜 응답으로 확인할 것(화면), 실 DB에서만 확인할 수 있는 것(사용자 확인 절차 — 예: 시험용 구글 계정으로 가입 → 완전 삭제 → 대시보드에 흔적 없음 → 같은 계정으로 다시 로그인하면 새 계정), 되돌리기 방법(SQL 되돌림 파일이 필요한지).
7. **열린 질문(추천안 포함)**: 사용자가 정할 것만 짧게 — 예: 교사 계정 처리 방식, 담임도 할 수 있게 할지, 감사 로그를 남길지(개인정보 없이), 이미 탈퇴시킨 OAuth 계정의 남은 기록도 이번에 지울지, 커뮤니티 글·댓글을 지울지 '탈퇴한 사용자'로 남길지.

## 형식
* `docs/admin/oauth-delete/spec.md` — 제목, 요약(5줄), 위 1~7 절, 끝에 "사용자 승인 전" 표시. 이 사이트의 다른 spec(`docs/admin/admin-tools/spec.md`, `docs/classes/spec.md`)과 같은 말투·깊이.
* 추측과 확인한 사실을 구분해 적는다(파일:행 근거).
* 끝나면 짧게 보고: 핵심 발견(특히 지금 같은 계정 다시 가입이 되는지), 추천 설계 한 줄, 열린 질문 목록.
