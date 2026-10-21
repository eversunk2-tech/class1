# 검토 지침 ① — SQL·Edge Function 보안 (검토 담당 R1, 2026-10-20)

**코드를 고치지 않는다.** 보고서 `docs/privacy/review-sql.md`만 쓴다. git commit/push·실 DB 접속(공개 키 읽기 포함)·내려받기·설치 금지. 교사 인증 코드 실제 값·개인 이메일을 어디에도 쓰지 않는다(예시 `000000`). 스크래치 `…/scratchpad/privacy-r1/`. 한 명령이 10분 넘게 조용하면 끊기니 짧게 나눠 돌린다.

## 기준
`docs/privacy/spec.md`(머리말 개정 1~4가 본문보다 우선, 4.0~4.11, 5·7·9절), `docs/privacy/privacy-policy.md`(처리방침이 약속하는 사실 — 서버가 실제로 그렇게 막는지), `CLAUDE.md` "SQL 적용 절차"·Supabase 절, 보고서 `build-1/2/5-report.md`.

## 볼 파일
- `supabase/migrations/20261020000000_privacy_a_schema.sql`(①), `…010000_privacy_b_enforce.sql`(②), `…020000_privacy_c_profiles_members_only.sql`(③)
- `docs/privacy/rollback-privacy-enforce.sql`, `rollback-profiles-members-only.sql`, `test-queries.sql`
- `supabase/functions/member-self-delete/`, `admin-clear-students/`, `admin-create-member/`(바뀐 부분), `supabase/config.toml`
- 비교용: 앞선 마이그레이션 전부(살아 있는 정의가 무엇인지), 다른 함수 4개(`admin-reset-password`·`admin-delete-member`·`admin-purge-oauth-member`·`check-answer`)

## 꼭 볼 것
1. **정보가 새는 길**: 처리방침이 약속한 것을 서버가 지키는가 — 학생 이름(같은 학급·담임만)·아이디(담임만)가 총괄·다른 학급 교사·다른 학급 학생·비로그인·인증 전 구글에게 **어떤 경로로든**(표 직접 읽기, embed, RPC, 뷰, 함수 반환값, 오류 문구, Edge Function 응답) 새지 않는지. 구글 이메일 가리기, 인증 전 구글 계정의 쓰기·읽기 막기, 교사 인증 코드 해시·시도 제한(동시 호출·계정 삭제 뒤 재가입·전체 한도), 학습 기록은 담임만.
2. **권한**: 모든 `security definer`에 `set search_path = ''`·스키마 이름, 실행 권한(revoke/grant)이 spec 4.2·4.11 표대로, 서비스 롤 전용 함수가 다른 역할에 열려 있지 않은지, PUBLIC 판별 함수로 무엇을 알아낼 수 있는지.
3. **실행 안전**: 재실행 안전, 42P17(정책 재귀)·42883(`any ((select …))`)·이름 63바이트·옛 함수와 인자 형식이 겹쳐 생기는 모호함, ①→②→③ 순서 점검(맨 앞·맨 끝 점검이 실제로 막는지), ② 뒤 옛 마이그레이션 재실행 위험 안내, 되돌리기 SQL이 정확히 ②·③ 전으로 돌아가는지(돌아가지 못하는 것 — 이메일 가리기 — 이 안내되어 있는지).
4. **기능 정확성**: 학급 정리·기록까지 삭제·자기 탈퇴(`purge_member_records` 삭제 목록이 `admin_purge_oauth_member`와 외래키 cascade·set null과 맞는지, 지운 뒤 남는 것), 보유 기한 계산(개정 3 — 2월 알림·3월부터 기한 지남·윤년 2월 29일·1월), 보호자 동의 기록, `admin_set_role` 거부, `admin-clear-students`의 확인 이름(담임 = 원래 이름, 총괄 = 가린 이름 — SQL `mask_label`과 같은 결과인지).
5. **Edge Function**: JWT 확인, 호출자 역할·담임 확인, CORS(허용 출처 규칙이 다른 함수와 같은지), 로그·응답에 이메일·이름·id·비밀값이 없는지, 실패했을 때 반쯤 지워진 상태와 다시 시도.
6. **배포 순서 위험**(spec 7절·build 보고): 함수 배포와 화면 push 사이, ②와 ③ 사이, ② 전에 새 화면이 올라간 상태에서 깨지는 것.

## 보고서 `docs/privacy/review-sql.md`
심각도별 표(높음·중간·낮음 — 파일:줄, 무엇이 문제인지, 재현 또는 근거, 제안), 처리방침 약속 ↔ 서버 규칙 대조표(약속마다 "지킴/못 지킴/확인 못 함"), 확인하지 못한 것(실 DB가 없어 읽어서만 본 것), 끝에 **"배포해도 됨 / 고친 뒤 배포"** 한 줄.
