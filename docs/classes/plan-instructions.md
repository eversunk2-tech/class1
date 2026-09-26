# Plan 지침 — 여러 반이 함께 쓰는 사이트: 반별로 나눠 보이게 하기 (2026-09-26)

당신은 **Plan** 담당이다. **코드·SQL을 실행하거나 바꾸지 않는다.** 저장소를 읽고 설계 문서 **`docs/classes/spec.md`** 하나만 새로 쓴다(한국어). 사용자(초등 6학년 담임 교사, 이 사이트 관리자)가 읽고 결정·승인할 문서다.

## 배경(사용자 말)
"학습 사이트 구축이 잘 되어 가는 거 같아서, 이것을 우리 반만 이용하지 않고 다른 선생님들도 학급에서 희망할 경우 이용할 수 있도록 해 볼 생각이야." → 사이트 이름을 "모두의 배움터"로 바꿈(별도 작업). Claude가 알린 점: "지금은 교사 계정(관리자)이면 모든 학생의 학습 기록·응답을 보고 회원도 관리할 수 있다. 여러 반이 함께 쓰면 다른 반 학생의 기록이 서로 보인다." → 사용자: "반별로 나눠 보이게 하는 계획도 세워줘".

## 먼저 읽기(현재 구조 파악)
* `CLAUDE.md`(기술 결정·Supabase·SQL 적용 절차·로그인·과학 앱 저장 규칙 — 특히 "정적 export·서버 기능 금지", "보안은 RLS", "SQL은 사용자가 실행", "42P17 재귀 금지 → security definer 함수", "service_role은 Edge Function만"), `docs/STATUS.md`
* 스키마·정책: `supabase/migrations/*.sql` 전부(특히 `20260921020000_admin_learning.sql`·`20260922000000_admin_learning_fixes.sql`(학습 테이블·`member_directory`·`is_admin()`), `20260922010000_app_progress.sql`, `20260922020000_praise_presets.sql`, `20260922040000_community.sql`, `20260923000000_member_withdrawal.sql`, `20260923010000_login_required.sql`·`20260923020000_login_required_scope.sql`, `20260923030000_member_create_log.sql`, `20260926000000_board_login_only.sql`)
* Edge Function: `supabase/functions/admin-create-member`, `admin-reset-password`, `admin-delete-member`, `check-answer`
* 관리자·학생 화면: `src/app/admin/`(회원 관리·학습 현황·학생 응답·피드백·칭찬·신고·글쓰기·로그인 잠금 스위치), `src/app/me/learning/`, `src/lib/admin*.ts`·`src/lib/community.ts`, 과학 앱 저장 `scripts/templates/class1-record.js`·`science-sim/persist.js`
* 설계 문서: `docs/admin/spec.md`, `docs/admin/responses-spec.md`, `docs/admin/admin-tools/spec.md`, `docs/admin/create-members/`, `docs/community/spec.md`

## spec.md에 담을 것
1. **지금 누가 무엇을 볼 수 있나**(표): 역할(비로그인·학생·교사=admin) × 데이터(블로그 글·댓글, 자유게시판·학습게임, 과학 앱 결과·진행, 과제·제출, 피드백, 칭찬 문구, 회원 명단·감사 로그, 신고, 로그인 잠금 스위치). 여러 반이 쓰면 문제가 되는 곳을 표시.
2. **사용자가 정할 것(질문 + 추천안 + 까닭)** — 예:
   * 역할 구조: 사이트 총괄 관리자(지금 사용자) / 반 담임 교사 / 학생. 교사는 여러 반을 맡을 수 있나? 총괄은 모든 반을 보나?
   * 반마다 나눌 것 vs 함께 쓸 것: 과학 앱(내용은 공통, 결과는 반별), 블로그 글(교사 글 — 공통/반별?), 자유게시판·학습게임(반별 / 전체 공유 / 둘 다?), 과제, 피드백, 칭찬 문구, 로그인 잠금 스위치(사이트 전체 / 반별), 신고 처리(총괄 / 담임).
   * 학생 아이디 규칙(지금 `아이디@class1.local`, 학번 같은 숫자 아이디) — 반·학교가 늘면 겹칠 수 있음 → 접두사 등.
   * 교사 계정을 누가 만드나(총괄만?), 새 반을 누가 만드나.
   * 학생이 반을 옮기거나 새 학년이 될 때.
3. **추천 설계**: 데이터 모델(예: `classes`, 교사-반 연결, 학생의 반 — 가장 단순하고 안전한 안을 추천하고 대안 비교), 역할 판별 함수(security definer, 재귀 없음), **테이블별 RLS 변경 목록**(SELECT/INSERT/UPDATE/DELETE, 누가 무엇을), Edge Function 변경(교사가 자기 반 학생만 만들기·비밀번호 초기화·탈퇴), 관리자 화면 변경(반 고르기·반별 필터·회원 추가 때 반 지정), 학생 화면 변경, 과학 앱 영향(앱 코드 변경 필요 여부 — `app_results`·`app_progress`는 user 기준이라 앱 수정 없이 될 수 있는지).
4. **지금 데이터 옮기기**: 기존 학생·교사·결과를 첫 반(예: "6학년 ○반")으로 넣는 방법(SQL 개요 — 실행 금지, 재실행 안전 원칙), 기록이 사라지지 않게(완전 탈퇴 보존 규칙 `withdrawal_blocking_fks()`와 충돌 없게).
5. **단계 계획**: 단계별 범위·배포 순서(SQL 실행 → 확인 → push), 각 단계 Review에서 확인할 것(특히 다른 반 데이터가 새지 않는지 — anon·학생·다른 반 교사로 거부 확인 방법), 위험과 대비(RLS 재귀·성능·관리자 잠김·기존 학생 영향).
6. **대략의 작업량**과 사용자가 해야 할 일(SQL 실행 횟수, 함수 재배포 등).
7. 개인정보·보안 주의(다른 반 이름·기록 노출, Gemini로 보내는 데이터 규칙 유지 등).

## 규칙
* 저장소의 다른 파일을 바꾸지 않는다(이 지침과 `docs/classes/spec.md`만). git commit/push·SQL 실행·실 DB 접근·내려받기·설치 금지. 브라우저·서버를 띄울 필요 없음.
* 확실하지 않은 것은 "확인 필요"로 적는다(추측을 사실처럼 쓰지 않는다). 파일·함수·정책 이름은 실제 이름으로.
* 문서는 사용자가 읽기 쉽게: 맨 앞에 한 쪽 요약(무엇이 바뀌나, 사용자가 정할 질문 목록, 추천안), 뒤에 자세한 설계.
