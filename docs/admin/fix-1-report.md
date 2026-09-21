# Fix-1 보고: docs/admin/review.md 1차 수정

- `npm run lint` 통과(경고 0). `npm run build` 통과(Next 16.3.5, 15개 라우트).
- **실 DB에는 쓰지 않았다.** 확인은 anon 읽기뿐이다. `feedback_threads?select=id,profiles!feedback_threads_student_id_fkey(...)`는 200이고, 기존 `profiles(...)`는 여전히 300 PGRST201이다. 커밋·푸시는 하지 않았다.
- 새 SQL은 `supabase/migrations/20260922000000_admin_learning_fixes.sql`(아래 "M") 하나다. 기존 마이그레이션 파일은 고치지 않았다. 여러 번 실행해도 안전하다.
- 로컬 Postgres가 없어 **새 SQL은 실행해 보지 못했다**(정적 검토만 함). 실행 후 확인 쿼리는 파일 맨 위에 있다.

## 항목별 처리

| # | 처리 | 위치 |
|---|---|---|
| 1 | FK 힌트 `profiles!feedback_threads_student_id_fkey(...)`로 바꿨다(실 DB에서 200 확인). 다른 embed도 전부 점검했다: `app_results/assignment_submissions/feedback_messages/comments → profiles`, `assignment_submissions → assignments`, `posts → comments/likes/post_reads(count)`, `profiles → *(count)`, `member_directory → profiles!inner`. 모두 경로가 하나라 문제없다. 조인 테이블 때문에 모호해지는 곳은 threads↔profiles뿐이다. | `src/lib/learning.ts:739` |
| 2 | Edge Function이 두 경우를 거부한다: 자기 자신이면 400, 대상 `role=admin`이면 403. DB 마무리 함수도 한 번 더 막는다. UI는 버튼을 비활성화하고 이유(본인/관리자/OAuth)를 보여 준다. | `index.ts:120-138`, M:137, `src/lib/admin.ts:132`(`passwordResetBlockReason`), `member-detail.tsx:127,186`, `member-list.tsx:330` |
| 3 | 가드 트리거를 바꿨다. 학생이 `needs_revision` 제출물의 내용을 고치면 상태가 `submitted`로 돌아간다. `reviewed` 제출물은 학생이 수정할 수 없다(예외 발생). UI: 검토 완료면 수정 버튼을 비활성화하고 안내한다. 수정 요청 상태에서는 "수정하면 다시 검토 대기로 바뀌어요"를 보여 준다. | M:172, `my-assignments.tsx:98,136,322` |
| 4 | 앱별 집계는 RPC `app_result_stats`(group by, invoker라 RLS 적용)로 옮겼다. 스레드별 메시지 수·마지막 메시지·안 읽은 수는 RPC `feedback_thread_summaries`로 옮겼다. 이 RPC는 `unread_feedback_count`와 같은 기준이라 배지와 목록이 일치한다. 글별 읽은 인원은 `post_reads(count)` embed(서버 집계)로 센다. 회원·학생·글·조회수·학생별 참여·과제 제출·스레드 목록은 `.range()`로 나눠 전부 받는다(`count: exact`로 끝을 판단). 문구는 "최근 5,000건 기준"에서 "전체 기록 기준"으로 바꿨다. 메시지는 이제 **최신** 1000개를 보여 준다(예전에는 오래된 1000개). 넘으면 "최근 N개만" 안내가 나온다. | M:324-398, `src/lib/paging.ts`, `learning.ts:210,315,368,468,650,730,890`, `admin.ts:56`, `learning-overview.tsx:50,66` |
| 5 | `mark_thread_read(p_thread_id, p_until)`. 서버가 p_until을 "이 스레드에 실제로 있는 메시지 중 `least(p_until, now())` 이하의 최대 created_at"으로 맞춘 뒤 `greatest`로 기록한다. 그래서 미래 시각이나 다른 스레드 시각은 무시된다. 클라이언트는 화면에 보인 마지막 메시지의 created_at 문자열을 그대로 넘긴다(마이크로초 보존). 전송한 뒤에는 목록을 다시 불러오고, 그다음 읽음 처리한다. 1인자 버전은 삭제했다. | M:224, `learning.ts:678`, `feedback-thread.tsx:31,69,116-128` |
| 6 | `clear_must_change_password`는 **삭제**했다. 대신 `auth.users`에 `after update of encrypted_password … when (old 값 is distinct from new 값)` 트리거를 걸어 `must_change_password = false`로 만든다. Edge Function은 ① 비밀번호를 바꾸고(이때 트리거가 false로 만든다) ② **그다음** `admin_finalize_password_reset`으로 true를 켠다. 두 단계는 별도 HTTP 요청을 차례로 await하므로 순서가 보장된다. 학생이 바꾸면 같은 트랜잭션에서 false가 된다. | M:31-56, `index.ts:165` |
| 7 | 연결 대상 `in.(...)`은 100개씩 나눠 조회하고, 조회에 실패하면 throw한다. 그래서 실패가 "삭제됨"으로 잘못 표시되지 않는다. 스레드 id를 URL에 넣던 메시지·읽음 조회는 RPC로 바꿔 없앴다. | `learning.ts:796` |
| 8 | `get_or_create_feedback_thread`: 기존 스레드가 있으면 그대로 돌려준다(원본이 삭제된 대화도 유지). 새로 만들 때는 context가 그 학생의 결과·제출물인지 확인한다. 테이블 insert 정책은 삭제하고 insert 권한을 회수했다(RPC 전용). | M:264-321 |
| 9 | 사용자가 바뀌면 `allowedUserId`를 초기화한다. 확인에 실패하면 이전 통과 기록과 관계없이 오류 화면을 보여 준다. | `admin-guard.tsx:36,56` |
| 10 | 프로필 상태를 `idle/loading/ready/error`로 나눴다. 실패하면 이전 값을 유지하고 자동으로 재시도한다(2s→60s, 창 포커스 때도). `refreshProfile`이 실패해도 기존 값을 덮지 않는다. 게이트는 `mustChangePassword`가 `null`(판단 불가)이면 기다린다. | `use-session.tsx:21-170`, `force-password-change-gate.tsx:21` |
| 11 | 트리거 방식이라 "변경됐는데 플래그가 남는" 상태가 없다. 화면은 저장 후 프로필을 다시 읽어 해제됐는지만 확인하고, 실패하면 "다시 확인"(재입력 불필요)을 보여 준다. `same_password` 문구는 "지금 쓰고 있는 비밀번호와 같아요…"로 고쳤다. | `reset-password-form.tsx:40-60,143`, `src/lib/auth.ts:85` |
| 12 | 닫힘 애니메이션이 끝나면(`onOpenChangeComplete`) stage를 초기화한다. 이때 임시 비밀번호가 state에서 사라진다. 초기화 버튼 연타는 ref로 막았다. | `password-reset-dialog.tsx:61,101` |
| 13 | `useAsyncData`에 세대 번호를 넣었다. `setData` 뒤에 도착한 옛 조회 결과는 버린다. 전송 후에는 목록을 다시 불러온다(#5). | `use-async-data.ts:24-60` |
| 14 | ref 가드를 넣었다: 피드백 전송, 과제 제출/수정, `ConfirmDialog`, 비밀번호 저장, 초기화 확인. | `feedback-thread.tsx:99`, `my-assignments.tsx:256`, `confirm-dialog.tsx:39` |
| 15 | 저장 중에는 제출 다이얼로그의 `onOpenChange`를 무시한다. | `my-assignments.tsx:92,209` |
| 16 | `app_results`에 제약 3개를 `not valid`로 추가했다(기존 행은 검사하지 않음). `octet_length(details::text) <= 65536`, `score`는 ±1e9, `max_score`는 0~1e9. | M:400-417 |
| 17 | 컬럼 권한을 썼다. `profiles`의 테이블 SELECT를 회수하고 `id, display_name, avatar_url, role, created_at, updated_at`만 anon/authenticated에 다시 줬다. 본인 값은 `my_must_change_password()`, 관리자 목록은 `admin_must_change_password_ids()`(uuid[] 1개라 max-rows 무관)로 받는다. 기존 profiles 조회를 점검했다: `select("*")`는 use-session 한 곳이라 명시 컬럼으로 바꿨다. `MEMBER_ROW_COLUMNS`에서는 이 컬럼을 뺐다. 나머지(comment embed, profile-dialog의 `select("id")`, 학생별 참여 count embed, `profiles!inner` 필터)는 허용 컬럼만 쓴다. | M:59-96, `types.ts:94`, `use-session.tsx:48`, `admin.ts:41-90` |
| 18 | `PGRST200/201`은 이제 "마이그레이션 미실행"으로 보지 않는다. 일반 오류로 다루고 콘솔에 로깅한다. | `admin.ts:19` |
| 19 | 유지. 로컬 개발(`http://localhost:3000`)에 필요하고, 관리자 Bearer 토큰 없이는 호출할 수 없다. | — |
| 20 | `admin_finalize_password_reset(p_target, p_actor)`(security definer, `service_role`에만 실행 권한). 플래그를 켜고, `auth.sessions`와 `auth.refresh_tokens`에서 대상 행을 삭제하고, `password_reset_log`(관리자만 조회)에 기록한다. 이 모두가 한 트랜잭션이다. 세션을 지우다 실패하면 -1로 기록하고 Edge Function이 경고를 돌려준다. **이미 발급된 access token(JWT)은 만료(기본 1시간)까지 유효하다.** | M:99-165, `index.ts:160-190` |
| 21 | 코드 변경 없음. `class1-record.js` 상단에 보안 경고를 추가했다. 같은 출처의 모든 스크립트가 토큰을 읽을 수 있으니 신뢰할 앱만 넣고, CDN은 버전 고정 + SRI로 불러오고, 관리자 로그인 상태에서는 신뢰하지 않는 앱을 열지 않는다는 내용이다. | `scripts/templates/class1-record.js:19` |
| 22, 25 | 코드 수정 없음(리뷰 판단대로 참고 사항). | — |
| 23 | 스레드 요약에 `audience`를 넣었다. 학생 화면에서는 `appLabel`을 써서 목록에 없는 앱을 "삭제된 앱"으로 표시한다. | `learning.ts:828`, `feedback-center.tsx:97` |
| 24 | URL의 `?thread=`가 바뀌면 선택을 다시 맞춘다. 고른 스레드가 비어 있거나 아직 없어도 목록에 넣어, 조용히 "일반 대화"로 바뀌지 않게 했다. | `feedback-center.tsx:39-75,97-104` |

## 제안과 다르게 한 것

- **#6**: 스냅샷 비교 RPC나 별도 Edge Function을 쓰지 않았다. 지침대로 비밀번호 변경 트리거를 썼고, `when` 조건으로 값이 실제로 바뀔 때만 반응하게 했다. 한계가 하나 있다. GoTrue가 로그인할 때 해시를 다시 만드는 경우(예: bcrypt cost 변경)에도 플래그가 풀린다. 임시 비밀번호는 GoTrue가 현재 설정으로 해시하므로 사실상 발생하지 않는다.
- **#17**: 별도 테이블 대신 컬럼 권한과 RPC를 썼다. 데이터 이동이 없고 Edge Function 코드도 거의 그대로다. 대신 **앞으로 profiles에 공개 컬럼을 추가하면 grant 목록에도 추가해야 한다.** `select("*")`는 권한 오류가 난다. M 주석에 적어 두었다.
- **#4**: 리뷰는 RPC와 페이지 반복 중 하나를 제안했는데, 둘을 섞었다. 집계는 RPC로, 목록은 `.range()`로 받는다. 메시지 목록은 최신 1000개와 전체 개수 안내만 보여 준다(대화 한 개에 1000건은 현실적이지 않음).
- **#2**: "자기 자신이면 400, 관리자면 403"은 제안대로 했다. DB 함수에서도 같은 규칙을 한 번 더 검사한다.

## 사용자가 할 일 (순서대로)

1. **SQL 실행**: Supabase SQL Editor에서 `supabase/migrations/20260922000000_admin_learning_fixes.sql` 전체를 실행한다. 이어서 파일 맨 위의 확인 쿼리 3개를 실행한다(트리거 존재 / profiles 컬럼 권한에 `must_change_password` 없음 / `admin_finalize_password_reset`이 anon·authenticated에 false). `create trigger … on auth.users`가 권한 오류로 실패하면 알려 달라(기존 마이그레이션은 같은 방식으로 성공했다).
2. **Edge Function 재배포**: `supabase/functions/admin-reset-password/index.ts`. 방법은 같은 폴더 README의 A(CLI `npx supabase functions deploy admin-reset-password`) 또는 B(대시보드)다. **Verify JWT는 켜 둔다.** SQL보다 먼저 배포하면 초기화할 때 "'다음 로그인 시 변경' 설정에 실패" 경고가 난다.
3. **사이트 배포(push)**: 1~2 다음에 한다. 새 프런트엔드는 새 RPC(`feedback_thread_summaries`, `app_result_stats`, `mark_thread_read(uuid, timestamptz)`, `my_must_change_password`)를 쓴다. SQL이 없으면 해당 화면에 "DB 설정 필요"가 뜨고, 강제 변경은 트리거가 없어 풀리지 않는다. 반대로 SQL만 적용되고 예전 사이트가 떠 있는 동안에는 이렇게 된다: 피드백 목록은 이미 깨진 상태 그대로다(#1). 예전 비밀번호 저장 화면은 삭제된 해제 RPC를 부르다 "다시 시도"를 보여 주지만, 새로고침하면 트리거 덕분에 풀려 있다. 예전 회원 목록은 `must_change_password` 컬럼 권한 오류로 열리지 않는다. 예전 사이트는 profiles를 `select("*")`로 읽으므로 모든 사용자의 프로필(이름·아바타·관리자 메뉴)이 표시되지 않는다(관리자 화면 자체는 `is_admin` RPC로 열린다). 그러니 1→3을 짧은 간격으로 진행한다.
4. **실계정 확인**:
   - 테스트 학생을 초기화한다. 그 학생이 기존에 로그인해 있던 브라우저에서 1시간 안에(토큰이 갱신될 때) 로그아웃되는지 본다. `select * from password_reset_log order by id desc limit 5;`에서 `sessions_revoked`가 -1이 아닌지 본다.
   - 임시 비밀번호로 로그인하면 `/reset-password/`로 가야 한다. 저장 후 다른 화면으로 갈 수 있고, 이전 임시 비밀번호로는 로그인되지 않아야 한다. 학생 콘솔에서 `supabase.rpc('clear_must_change_password')`를 부르면 "함수 없음"이 나와야 한다.
   - 관리자·본인 행의 초기화 버튼이 비활성인지, 안내 문구가 보이는지 본다.
   - 피드백 세 화면(학생 탭, 회원 상세, 학습 현황 개요)이 열리는지, 배지 수와 목록의 안 읽음 합계가 같은지 본다.
   - 수정 요청 → 학생 수정 → 개요의 "검토 대기 제출"이 1 늘어야 한다. 검토 완료된 제출물은 학생 화면에서 수정·삭제가 비활성이어야 한다.
   - anon으로 `GET /rest/v1/profiles?select=must_change_password`를 보내면 401/42501(권한 없음)이어야 한다.
