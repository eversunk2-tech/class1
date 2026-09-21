# Review: 관리자 대시보드 + 학습활동 (Build A/B 검증)

- 검토일: 2026-09-22 · 검토자: Review 서브에이전트(Build와 분리, 소스 수정 없음)
- 기준: `docs/admin/review-instructions.md`, `docs/admin/spec.md`(§14 우선), Build A/B 보고서

## 1. 요약

| 심각도 | 개수 |
|---|---|
| 치명(Critical) | 0 |
| 높음(High) | 1 |
| 중간(Medium) | 6 |
| 낮음(Low) | 11 |
| 참고(Info) | 7 |

- **실 DB 쓰기 없음.** anon 쓰기 시도는 모두 거부됐다(아래 §3.2). 성공한 쓰기는 없다.
- **High 1건: 피드백 대화 목록이 실 DB에서 동작하지 않는다.** `feedback_threads → profiles` 임베드가 모호해서 PostgREST가 `300 PGRST201`을 돌려준다(실 DB에서 확인). 학생 `/me/learning/?tab=feedback`, 회원 상세 "피드백 대화" 탭, 학습 현황 개요의 "피드백 대화" 섹션이 모두 "불러오지 못했어요" 상태가 된다. 한 줄만 고치면 된다(§2 #1).
- RLS/권한 구조는 대체로 탄탄하다. 학생이 다른 학생의 app_results/post_reads/제출물/피드백을 읽거나 쓰는 경로, `role` 상승 경로, 제출 `status` 변경 경로는 정적 분석에서 찾지 못했다. security definer 함수는 모두 `search_path = ''`이고, anon 실행 권한이 회수돼 있다(실 DB에서 확인).
- 빌드: `npm run lint` 통과(경고 0), `npm run build` 통과. 16개 라우트가 `out/`에 생성되고 basePath `/class1` 규칙을 지킨다.

## 2. 문제 표

| # | 심각도 | 위치 | 현상 | 재현 | 수정 제안 |
|---|---|---|---|---|---|
| 1 | **High** | `src/lib/learning.ts:698` (`fetchThreadSummaries`) | `feedback_threads.select(...,profiles(display_name,avatar_url))`가 모호하다. `student_id` FK 경로와, `feedback_read_marks`(PK가 두 FK로만 이뤄져 조인 테이블로 인식됨)를 거치는 many-to-many 경로가 둘 다 있다. 그래서 실 DB가 `300 PGRST201 "more than one relationship was found"`를 돌려준다. 오류 코드가 `isMissingSchemaError`에 없어서 일반 오류로 보인다. | 실 DB에 anon으로 `GET /rest/v1/feedback_threads?select=id,profiles(display_name,avatar_url)`을 보내면 300이 온다(확인함). 가짜 서버에서 이 동작을 재현하면 세 화면 모두 "피드백 대화를 불러오지 못했어요"가 뜬다(확인함). | `profiles!feedback_threads_student_id_fkey(display_name,avatar_url)`로 바꾼다. 가짜 서버에서 모호성을 끄면 대화 목록·전송·읽음 배지가 정상 동작하는 것을 확인했다. |
| 2 | Medium | `supabase/functions/admin-reset-password/index.ts:115-126` | 대상 계정 검증이 OAuth 전용 여부만 본다. 관리자 **자신**이나 **다른 관리자**도 초기화할 수 있다. 다른 관리자의 비밀번호를 초기화하면 임시 비밀번호로 그 관리자 계정에 로그인할 수 있다(관리자 간 계정 탈취). 자기 자신을 초기화하면 강제 변경 흐름에 걸린다. | 관리자 A가 `/admin/members/?id=<관리자 B>`에서 "비밀번호 초기화"를 누른다. UI도 막지 않는다. | 서비스 롤로 대상 `profiles.role`을 조회해 `admin`이면 403, `targetId === callerId`이면 400을 돌려준다. UI에서도 버튼을 비활성화한다. |
| 3 | Medium | 마이그레이션 `:288-293`, `:339-346` (`assignment_submission_guard`) | 학생은 `reviewed`·`needs_revision` 상태의 제출물도 내용만 수정할 수 있고, 상태는 그대로 남는다. 그래서 ① "수정 요청"에 맞춰 고쳐도 `needs_revision`이 유지돼 "검토 대기"(`admin_dashboard_stats`, 검토 필터)에 다시 올라오지 않는다. ② "검토 완료"된 제출물을 나중에 바꿔도 검토 완료로 보인다. | 관리자가 수정 요청 → 학생이 수정 → 관리자 개요의 "검토 대기 제출"이 늘지 않는다(정적 분석). | 가드의 비관리자 update 분기에서 `body_md`/`link_url`이 바뀌면 `new.status := 'submitted'`로 되돌린다. 화면 문구도 "수정하면 다시 검토 대기로 바뀌어요"로 바꾼다. |
| 4 | Medium | `src/lib/learning.ts:193, 324, 714`; `learning-overview.tsx:69`; `feedback-center.tsx:44` | Supabase 호스팅의 기본 `max-rows`는 1000이다. 그래서 `.limit(5000)`·`.limit(10000)`을 줘도 1000행만 온다. 앱별 집계는 "최근 5,000건 기준"이라고 표기하지만 실제로는 1000건 기준이다. 글별 읽은 학생 수는 경고 없이 적게 센다. 메시지가 1000건을 넘으면 오래된 스레드의 메시지 수가 0이 되어 목록에서 숨겨진다. 반면 `unread_feedback_count` RPC는 전체를 센다 → **열 수 없는 안 읽음 배지**가 생긴다. | 데이터가 1000건을 넘으면 발생한다(정적 분석). | 집계를 RPC나 뷰로 서버에서 한다. 또는 `.range()`로 페이지를 나눠 받는다. 표기 문구도 실제 상한에 맞춘다. |
| 5 | Medium | `src/components/feedback/feedback-thread.tsx:58-63, 107-111` | `mark_thread_read`는 서버의 `now()`로 읽음 시각을 찍는다. 메시지를 불러온 뒤와 읽음 표시 사이, 또는 스레드를 열어 둔 채 **내가 전송**할 때(전송 후 새로고침 없이 내 메시지만 붙이고 읽음 표시) 상대가 보낸 메시지는 화면에 보이지 않은 채 읽음 처리된다. 배지도 사라진다. | 관리자가 스레드를 연다 → 학생이 메시지를 보낸다 → 관리자가 창 포커스 변화 없이 답장한다. 학생 메시지가 보이지 않고 안 읽음에도 잡히지 않는다(정적 분석). | RPC에 `p_until`(화면에 보인 마지막 `created_at`)을 받아 `last_read_at = greatest(기존값, p_until)`로 기록한다. 전송 후에는 메시지를 다시 불러온다. |
| 6 | Medium | 마이그레이션 `:532-544` (`clear_must_change_password`) | 학생은 비밀번호를 바꾸지 않고도 콘솔에서 `supabase.rpc('clear_must_change_password')`를 불러 강제 변경을 해제할 수 있다. 그러면 관리자가 알고 있고 메신저 등 사이트 밖으로 전달된(spec §7.1-2) 임시 비밀번호가 계속 유효하다. 전달 경로에서 임시 비밀번호를 본 제3자도 계속 로그인할 수 있다. 위험도 평가: 권한 상승은 없고, 피해 대상은 주로 본인 계정이다. 다만 전달 경로 노출까지 고려해 Medium으로 둔다. | 임시 비밀번호로 로그인 → 콘솔에서 RPC 호출 → 새로고침하면 게이트가 풀린다(정적 분석). | Edge Function이 초기화할 때 `auth.users.encrypted_password`의 스냅샷(또는 `password_reset_at`)을 별도 테이블에 저장한다. RPC는 현재 `encrypted_password`가 스냅샷과 다를 때만 해제한다(security definer에서 `auth.users` 조회). 또는 비밀번호 변경과 해제를 한 번에 하는 Edge Function을 둔다. |
| 7 | Medium | `src/lib/learning.ts:712-715, 777-780, 784-790` | ① 스레드 id 최대 1000개를 `in.(...)`으로 GET URL 하나에 넣는다(약 37바이트×N). 스레드가 수백 개면 URL 길이 제한(414/400)에 걸릴 수 있다. ② 연결 대상(`app_results`/`assignment_submissions`) 조회가 실패하면 오류를 무시하고, 모든 연결 대화를 "삭제된 제출물/삭제된 웹앱 기록"(취소선)으로 **잘못 표시**한다. | 대량 데이터나 네트워크 오류 상황(정적 분석). | id를 100개 단위로 나눠 조회한다. 조회 실패는 throw하거나 "불러오지 못함" 상태를 따로 둔다. |
| 8 | Low | 마이그레이션 `:379-383`, `:450-479` | `feedback_threads` insert 정책과 `get_or_create_feedback_thread`가 `context_id`가 **해당 학생의** 결과·제출물인지 검사하지 않는다. 학생이 남의 제출 id로 자기 스레드를 만들 수 있다. 관리자 화면은 관리자 권한으로 연결 대상 이름을 풀기 때문에, 학생 A의 대화가 학생 B의 과제 제목으로 표시될 수 있다. 데이터 유출은 없고 표시만 틀린다. | 학생 콘솔에서 `rpc('get_or_create_feedback_thread', {p_student_id: 본인, p_context_type:'assignment_submission', p_context_id: <남의 id>})`를 호출한다. | RPC에서 context 소유(`user_id = p_student_id`)를 확인한다. 테이블 직접 insert 권한은 회수한다(RPC 전용). |
| 9 | Low | `src/components/admin-guard.tsx:49-53`(기존 코드, 이번에 전 `/admin/*`로 적용 범위 확대) | 같은 브라우저에서 사용자가 바뀌고(`userId !== allowedUserId`) 그때 `is_admin` RPC가 실패하면, `wasAllowed` 분기가 새 사용자를 확인 없이 통과시킨다. 데이터는 RLS가 막으므로 빈 관리자 UI만 보인다. | 관리자 탭을 열어 둔 채 다른 탭에서 학생으로 로그인하고, 그 순간 네트워크가 끊긴 경우. | `wasAllowed` 통과는 같은 userId일 때만 허용한다. |
| 10 | Low | `src/hooks/use-session.tsx:30-37` + `force-password-change-gate.tsx:22` | 프로필 조회가 실패하면 `profile=null` → `mustChange=false`가 되어 그 세션에서는 게이트가 동작하지 않는다. `refreshProfile`이 실패하면 멀쩡한 프로필도 null로 덮는다(관리자 메뉴가 사라짐). | 네트워크 오류(정적 분석). | 프로필 로딩 3상태를 두고, 실패 시 이전 값을 유지한다. |
| 11 | Low | `src/app/reset-password/reset-password-form.tsx:45-55` | `updateUser` 성공 뒤 해제 RPC 전에 탭을 닫으면 플래그가 남는다. 다시 들어와 같은 비밀번호를 넣으면 `same_password` → "지금 쓰는(임시) 비밀번호와 다른…"이라는, 사실과 다른 문구가 나온다. | 정적 분석. | "비밀번호 변경됨" 상태를 sessionStorage에 두고 "다시 시도"를 보여 준다. 문구도 수정한다. |
| 12 | Low | `src/components/admin/password-reset-dialog.tsx:84-87` | 다이얼로그를 닫은 뒤에도 임시 비밀번호가 컴포넌트 state에 남는다(Build A 보고서에 명시된 한계). | React DevTools. | 닫힘 애니메이션이 끝나면 stage를 초기화한다. |
| 13 | Low | `src/hooks/use-async-data.ts:29-42` + `feedback-thread.tsx:110` | 포커스로 시작된 `refresh`가 전송 직후에 도착하면, 방금 보낸 메시지가 빠진 목록으로 덮어쓴다. | 느린 네트워크에서 창 포커스 직후 전송. | `setData` 때 진행 중인 요청을 무효화(카운터 증가)하거나, 전송 후 다시 불러온다. |
| 14 | Low | `feedback-thread.tsx:95`, `my-assignments.tsx:236`, `confirm-dialog.tsx:50` | 중복 방지가 React state 기반이라 빠른 연타(Ctrl+Enter 두 번, 삭제 확인 더블클릭)에 두 번 실행된다. 메시지가 중복 전송되거나, 성공 토스트와 실패 토스트가 함께 뜬다. | 빠른 연타. | ref 가드. |
| 15 | Low | `src/app/me/learning/my-assignments.tsx:192` | 저장 중에도 제출 다이얼로그를 닫을 수 있다. 다시 열어 제출하면 23505("이미 제출한 과제예요")가 난다. | 정적 분석. | 저장 중에는 `onOpenChange`를 막는다. |
| 16 | Low | 마이그레이션 `:136-146` (`app_results`) | `details` jsonb 크기와 점수 범위에 DB 제약이 없다(16KB 제한은 클라이언트 헬퍼에만 있음). 학생이 API로 큰 행을 반복 삽입할 수 있다(저장 공간 남용). | 콘솔에서 직접 insert. | `check (pg_column_size(details) <= 16384)`, `score`/`max_score`/`duration_seconds` 범위 check를 추가한다. |
| 17 | Low | `profiles` 공개 조회 정책(init) + 새 컬럼 | anon도 `must_change_password`를 조회할 수 있다(실 DB에서 확인). 누가 초기화 대기인지 노출된다(Build A 보고서에 명시). | anon `GET /rest/v1/profiles?select=id,must_change_password`. | 플래그를 본인·관리자만 조회 가능한 별도 테이블로 옮긴다. |
| 18 | Low | `src/lib/admin.ts:19` | `isMissingSchemaError`가 `PGRST200`(관계 없음)도 "마이그레이션 미실행"으로 분류한다. 반면 #1의 `PGRST201`은 빠져 있다. 임베드 문법 오류가 "SQL을 실행해 주세요"라는 잘못된 안내로 보일 수 있다. | 정적 분석. | `PGRST200`/`PGRST201`은 일반 오류로 다루고 콘솔에 로깅한다. |
| 19 | Info | `index.ts:15` | 운영 CORS 허용 목록에 `http://localhost:3000`이 포함돼 있다. 호출에는 관리자 Bearer 토큰이 필요하므로 실질 위험은 낮다. | 실 함수: 허용 출처만 ACAO를 받는 것을 확인. | 운영 배포에서는 환경변수로 분리한다. |
| 20 | Info | `index.ts:128-145` | 초기화 후 대상의 기존 세션(리프레시 토큰)을 무효화하지 않는다. 계정 탈취 대응용으로 초기화하는 경우 공격자 세션이 남는다. 감사 로그도 없다. | — | `auth.admin.signOut`(가능하면), `auth.sessions` 정리, 초기화 이력 테이블. |
| 21 | Info | `scripts/templates/class1-record.js:13-17` | 세션 공유는 같은 출처의 localStorage(`sb-{ref}-auth-token`)에 의존한다. 그래서 `/class1/apps/*`의 모든 스크립트(CDN 포함)와, 같은 출처 `eversunk2-tech.github.io`의 다른 저장소 페이지가 **관리자 세션 토큰을 읽을 수 있다**. 템플릿에 이 위험 설명이 없다. 학생 조작 한계는 문서화돼 있다(파일 상단 11행, CLAUDE.md). SRI 해시는 jsDelivr 원본과 일치한다(확인함). | — | 템플릿·CLAUDE.md에 "앱의 모든 CDN 스크립트는 버전 고정 + SRI", "관리자 계정으로 신뢰하지 않는 앱을 열지 않기"를 추가한다. |
| 22 | Info | DOMPurify 설정(기존 `MarkdownViewer`) | 학생 `body_md`의 `<img src>`는 허용된다. 관리자가 볼 때 외부 이미지 요청(IP·열람 시각)이 새어 나갈 수 있다. `onerror`와 `javascript:` 링크는 제거된다. `link_url`의 `javascript:`는 링크로 렌더링되지 않는다(가짜 서버에서 확인). | — | 제출물 보기에서 `img`를 금지하거나 프록시를 쓴다. `link_url`에 `^https?://` check 제약을 추가한다. |
| 23 | Info | `src/lib/learning.ts:799` | 학생 화면의 스레드 제목이 `appLabelAdmin`을 써서, 등록 안 된 앱이 "삭제된 앱"이 아니라 app_id 그대로 보인다(spec §3.8과 다름). | — | 학생용 라벨 함수를 쓴다. |
| 24 | Info | `feedback-center.tsx:76,88` | `?thread=`로 연 선택 상태가 URL 변경을 따라가지 않는다. 메시지 없는 스레드 키는 조용히 "일반 대화"로 바뀐다. | — | URL 파라미터에서 선택을 파생한다. |
| 25 | Info | `record_post_read` | 본인 `read_count`를 RPC 반복 호출로 부풀릴 수 있다(본인 데이터라 영향 작음). "최근 변경"은 관리자의 상태 변경도 반영한다(Build B 보고서에 명시). | — | 필요하면 `content_updated_at` 컬럼을 둔다. |

## 3. 실제로 확인한 것 vs 확인 못 한 것

### 3.1 빌드
- 확인함: `npm run lint` 종료 코드 0, `npm run build` 종료 코드 0(Next 16.3.5).
- 확인함: `out/`에 `/`, `/admin/`, `/admin/posts/`, `/admin/members/`, `/admin/learning/`, `/admin/write/`, `/me/learning/`, `/reset-password/`, `/login/`, `/post/`, `/search/`, `/games/`, `/math/`, `/science/`, 404가 생성된다. HTML 링크와 자산은 모두 `/class1/...`이다.
- 확인함: 소스에 basePath 없는 raw 경로(`<a href="/...">`, `location.assign`)가 없다. 내부 이동은 `next/link`/`router`로 하고, `redirectTo`와 `/apps/...` 경로에는 `withBasePath`를 쓴다.
- 가짜 서버용 빌드를 한 뒤 실제 `.env.local`로 다시 빌드해 `out/`을 원래대로 돌려놨다(`out/`에 가짜 URL이 남아 있지 않은 것도 확인함). `git status`는 검토 전과 같다(새로 추가한 파일은 이 `review.md`뿐).

### 3.2 실 Supabase 프로브 (anon key, 읽기 + 거부되어야 할 쓰기만)
- anon 읽기: `member_directory` → **401 42501 permission denied**. `app_results`/`post_reads`/`assignment_submissions`/`feedback_*`/`assignments` → `[]`. `profiles`에서는 `must_change_password` 컬럼이 조회된다(#17).
- anon RPC: `record_post_read`, `get_or_create_feedback_thread`, `mark_thread_read`, `unread_feedback_count`, `clear_must_change_password`, `admin_set_role`, `admin_dashboard_stats` 모두 **42501 permission denied for function**. 함수가 배포돼 있고 anon 실행 권한이 회수된 상태다. `sync_member_directory`는 RPC로 노출되지 않는다(PGRST202).
- anon insert(8개 새 테이블): 모두 **42501**(RLS 위반 또는 권한 없음). 성공한 쓰기 없음.
- anon PATCH `profiles.must_change_password`/`role`, `app_results`, `member_directory`(존재하지 않는 id 필터): 모두 **42501**.
- anon DELETE `app_results`/`assignment_submissions`(존재하지 않는 id 필터): 204, 0행. RLS가 걸러낸다. 삭제된 데이터는 없다.
- PostgREST 임베드 문법(anon 읽기로 스키마 관계 확인): `app_results→profiles`, `post_reads→posts`, `comments/likes→posts`, `posts→comments/likes(count)`, `profiles→comments/likes/post_reads/app_results/assignment_submissions(count)`, `assignments→assignment_submissions(count)`, `assignment_submissions→assignments/profiles`, `feedback_messages→profiles`는 정상이다. **`feedback_threads→profiles`는 300 PGRST201**(#1). `member_directory→profiles!inner`는 anon 권한이 없어 확인하지 못했다(FK가 하나뿐이라 정적으로는 문제없음).
- Edge Function `admin-reset-password`: 허용 안 된 출처의 OPTIONS에는 ACAO가 붙지 않는다. `eversunk2-tech.github.io`는 ACAO가 붙는다. Authorization 없이 호출하면 게이트웨이가 401을 돌려준다(Verify JWT 켜짐). anon key를 Bearer로 보내면 함수가 401("로그인이 만료…")을 돌려준다. GET은 405. **관리자/학생 토큰으로는 호출하지 않았다.**

### 3.3 브라우저(가짜 Supabase 서버 + `out/` 서빙, 관리자·학생 가짜 세션)
- 확인함(데스크톱):
  - 관리자 개요 통계·최근 활동, 회원 목록·상세.
  - 비밀번호 초기화: 확인 → 임시 비밀번호 표시 → Escape로 닫히지 않음 → "확인했어요, 닫기".
  - 초기화된 학생의 `/me/learning/` 접근 → `/reset-password/` 강제 이동, 8자 미만·불일치 검증, 저장 후 `/`로 이동하고 게이트 해제.
  - 학생 과제 탭: 지각 배지, 마감 지남, 검토 완료 삭제 비활성(툴팁), 마감 전·검토 전 삭제 → "미제출"로 돌아감.
  - `body_md`의 `onerror`/`javascript:` 링크 제거, `link_url` `javascript:`가 링크로 렌더링되지 않음.
  - 사용자 메뉴의 "내 학습 활동" 배지, 글 상세 `record_post_read`가 세션당 1회만 호출됨.
  - 비로그인 `/me/learning/` → 로그인 안내, 비로그인 `/admin/learning/` → `/class1/login/`.
- 확인함(모바일 375px): 관리자 개요/글 관리/회원 목록/상세/학습활동 탭/학습 현황 4개 탭/제출 현황/없는 과제 id("과제를 찾을 수 없습니다")/`/me/learning/`/`/reset-password/`/잘못된 회원 id("회원을 찾을 수 없습니다"). **모두 `scrollWidth = 375`(가로 넘침 없음).** 라이트·다크 모두 화면 확인.
- 확인함: #1을 흉내 낸 모드에서는 세 피드백 화면이 오류를 표시한다. 모호성을 끈 모드에서는 대화 목록, "삭제된 제출물" 표시, 메시지 전송, 안 읽음 배지 감소가 정상이다.
- 확인 못 함: 실제 로그인 사용자로 하는 모든 흐름. 가짜 서버는 RLS를 단순하게 흉내 낸 것이라, 실 DB의 RLS·트리거·RPC 동작을 증명하지 않는다. 글 상세의 댓글 영역 오류는 가짜 서버의 한계다(기존 코드이고 이번 범위 밖).

### 3.4 정적 분석으로만 확인한 것 (실 DB 로그인 테스트 없음)
- 학생이 남의 `app_results`/`post_reads`/`assignment_submissions`/`feedback_threads`/`feedback_messages`/`feedback_read_marks`를 읽거나 쓸 경로가 없다(select/insert 정책 모두 `auth.uid()` 또는 `is_admin()`). 남의 스레드에 메시지를 쓸 수 없다.
- `role`: `profiles` 컬럼 GRANT가 `display_name, avatar_url`뿐이다. `admin_set_role`은 관리자만 쓸 수 있고, 본인 해제·마지막 관리자 해제를 막으며, `for update` 잠금이 있다.
- 제출 `status`: 가드 트리거가 비관리자의 insert를 `submitted`로 고정하고 update 때 status 변경을 거부한다. 관리자는 남의 제출물에서 status만 바꿀 수 있다. 학생 삭제는 RLS에서 `status <> 'reviewed'` 그리고 마감 전일 때만 허용된다(§14 Q8과 일치).
- 모든 security definer 함수는 `set search_path = ''`이고 스키마를 명시해 호출한다. 내부 권한 검사도 있다(`get_or_create_feedback_thread`, `mark_thread_read`, `admin_set_role`, `admin_dashboard_stats`는 `where is_admin()`).
- `member_directory`: anon·authenticated의 모든 권한을 회수하고 authenticated select만 허용하며, 정책은 `is_admin()`이다. 트리거 순서(`on_auth_user_created` < `on_auth_user_created_directory`, 이름순)와 백필(`on conflict do update`)이 맞다. update 트리거는 필요한 컬럼에만 반응한다. **백필 건수(auth.users와 같은지)는 확인하지 못했다.**
- Edge Function: `getUser(jwt)`로 토큰을 검증하고, 서비스 롤로 `role`을 확인한다. UUID를 검증한다. OAuth 전용 계정을 거부한다. 임시 비밀번호는 14자, 55자 알파벳(약 80비트), 거절 샘플링을 쓴다. 로그에 비밀번호가 남지 않고, 오류 메시지는 일반 문구다. 부족한 점은 #2, #19, #20.

### 3.5 CLAUDE.md 준수
- 준수: 정적 export·basePath·서버 기능 미사용. 브라우저 supabase-js만 사용하고, service_role은 Edge Function에만 둔다(저장소에 키 없음). 새 테이블 전부 RLS. 스키마 변경을 `supabase/migrations/`에 기록. 마크다운은 기존 `MarkdownViewer`(DOMPurify)를 재사용한다. 웹앱 템플릿은 상대경로만 쓰고, CDN은 버전 고정 + SRI다.
- CLAUDE.md 변경: 학습 테이블 목록, Edge Function 규칙, class1-record 규칙 3줄 추가(spec §14에서 승인됨).

## 4. 사용자가 실계정으로 확인할 체크리스트

1. **#1 수정 후** 학생 `/me/learning/?tab=feedback`, 회원 상세 "피드백 대화", 학습 현황 개요 "피드백 대화"가 열리는지 확인.
2. SQL Editor에서 `select (select count(*) from auth.users), (select count(*) from public.member_directory);` 두 값이 같은지 확인(백필).
3. 관리자 계정: `/admin/`, `/admin/posts/`, `/admin/members/`(검색·정렬·상세), `/admin/learning/` 4개 탭이 정상인지 확인. `admin_dashboard_stats` 숫자가 맞는지, "오늘 학습 결과"가 한국 자정 기준인지 확인.
4. 테스트 학생 비밀번호 초기화 → 임시 비밀번호로 로그인 → `/reset-password/`로 강제 이동 → 새 비밀번호 저장 → 다른 화면으로 이동 가능. 이어서 **이전 임시 비밀번호로 다시 로그인되지 않는지** 확인.
5. (#2 확인) 다른 관리자 계정이나 본인 계정에 초기화 버튼이 보이거나 동작하는지 → 막을지 결정.
6. 학생 계정 콘솔에서 아래가 **거부되는지** 확인(테스트 학생 계정으로):
   - `supabase.from('profiles').update({role:'admin'}).eq('id', <본인>)` → 권한 오류
   - `supabase.from('assignment_submissions').update({status:'reviewed'}).eq('id', <본인 제출>)` → "상태는 관리자만…"
   - `supabase.from('app_results').insert({app_id:'x', user_id:<다른 학생>})` → RLS 오류
   - `supabase.from('feedback_messages').insert({thread_id:<다른 학생 스레드>, body:'x'})` → RLS 오류
   - `supabase.from('member_directory').select()` → 빈 배열
   - `supabase.rpc('admin_set_role', {p_user:<본인>, p_role:'admin'})` → "관리자만…"
7. 학생: 과제 제출 → 수정 → (마감 전·검토 전) 삭제 → 재제출. 검토 완료 뒤·마감 뒤에는 삭제가 막히는지 확인. 수정 요청 뒤 수정하면 상태가 어떻게 보이는지 확인(#3).
8. 피드백: 관리자 → 학생 메시지 → 학생 헤더 배지 → 학생이 열면 배지가 사라짐. 반대 방향도 확인.
9. 글 상세를 로그인 상태로 열면 `post_reads`가 1건 생기고, 같은 탭에서 새로고침해도 증가하지 않는지 확인.
10. 모바일 실기기에서 `/admin/members/`, `/admin/learning/` 탭 가로 스크롤과 다이얼로그 스크롤 확인.
11. 웹앱을 처음 만들 때 `class1-record.js`의 CDN SRI 콘솔 오류가 없는지, 블로그 로그인 상태가 앱에서 인식되는지 확인.
