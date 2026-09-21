# Build B 보고: 학습활동 · 과제 · 피드백 · 내 학습 활동 (spec §10 단계 5~10)

- `npm run lint` 통과(경고 0), `npm run build` 통과(일반 `.env.local`로 마지막 빌드). `out/me/learning/`, `out/admin/learning/` 생성 확인.
- 실 DB에는 쓰지 않았다(SQL 실행·RPC 호출·로그인 없음). 새 마이그레이션 파일 없음. 커밋·푸시 안 함.
- 화면 확인은 스크래치 디렉터리의 **가짜 Supabase 서버**(REST/RPC/Auth 흉내 + `out/` 정적 서빙)와 임시 env 빌드로 했다: 관리자/학생 가짜 세션, 데스크톱·모바일(375px)·다크모드, "마이그레이션 전"(테이블/함수 없음) 모드. 375px에서 전 화면 가로 넘침 없음 확인.

## 파일 목록

### 신규
| 경로 | 역할 |
|---|---|
| `scripts/templates/class1-record.js` | 웹앱 결과 기록 헬퍼 정본(§6). `init/save/getUser/loginUrl/renderLoginHint`, 상단 한국어 사용법, supabase-js 2.116.0 CDN + SRI 예시 |
| `src/lib/learning.ts` | 학습·과제·피드백 쿼리/표시 헬퍼(§9.2). 스레드 요약(안 읽은 수·마지막 메시지·연결 대상 이름), 통계, 지각/삭제 가능 판정 |
| `src/hooks/use-async-data.ts` | 로딩/오류(스키마 없음 구분)/완료 상태 훅(reload·refresh·setData) |
| `src/hooks/use-unread-feedback.ts` | `unread_feedback_count` — 마운트·포커스·탭 복귀·읽음/전송 이벤트 때 재조회 |
| `src/components/feedback/feedback-thread.tsx` | `FeedbackThread`(§3.9) |
| `src/components/feedback/feedback-center.tsx` | 학생별 대화 모음(일반 + 연결 대화) · `FeedbackDialogButton` |
| `src/components/learning/learning-ui.tsx` | `AsyncView`, 상태/지각/안 읽음 배지, `NativeSelect`, `TableWrap`, `StudentLink` |
| `src/components/learning/activity-panels.tsx` | 웹앱 결과/읽은 글/댓글·좋아요/제출 목록 패널(학생 화면·회원 상세 공용) |
| `src/components/learning/confirm-dialog.tsx` | 삭제 확인 다이얼로그 |
| `src/components/post-read-recorder.tsx` | 글 상세에서 `record_post_read`(로그인·공개 글·세션당 1회, 실패 무시) |
| `src/app/me/learning/page.tsx`, `my-learning-view.tsx`, `my-assignments.tsx` | 내 학습 활동(§3.8) — 탭 `apps/posts/social/assignments/feedback` |
| `src/app/admin/(dashboard)/learning/page.tsx`, `learning-view.tsx`, `learning-overview.tsx`, `app-results-view.tsx`, `assignment-manager.tsx`, `submission-review.tsx`, `engagement-table.tsx` | 학습 현황(§3.6) — 탭 `overview/apps/assignments/engagement`, `&assignment=` 제출 현황 |
| `src/app/admin/(dashboard)/members/member-learning.tsx` | 회원 상세 학습활동 탭(§3.5) |

### 수정
| 경로 | 변경 |
|---|---|
| `src/app/admin/(dashboard)/admin-overview.tsx` | 통계 카드 4개를 `admin_dashboard_stats`로 교체, 최근 학습활동 5건, 바로 가기에 학습 현황·과제 관리 |
| `src/app/admin/(dashboard)/members/member-detail.tsx` | 자리 주석 위치에 `MemberLearning` |
| `src/app/admin/(dashboard)/layout.tsx` | 주석만 |
| `src/components/admin/admin-shell.tsx` | 메뉴에 "학습 현황" + 안 읽은 배지, 가로 스크롤 목록 `relative`(아래 한계 참고) |
| `src/components/user-menu.tsx` | "내 학습 활동"(학생은 안 읽은 배지), 관리자 그룹 "학습 현황"(배지), 아바타 빨간 점 |
| `src/app/post/post-detail.tsx` | `<PostReadRecorder>` 추가 |

## spec과 다른 점

1. **"오늘 학습 결과"**: RPC의 `date_trunc('day', now())`는 DB 시간대(UTC) 기준이라 한국 오전 9시 전 결과가 빠진다. 카드 숫자는 브라우저 자정 기준 head count로 다시 센다(다른 3개는 RPC 값). SQL은 고치지 않음.
2. **스레드 생성 시점**: 열어 보기만 해서는 스레드를 만들지 않고(select로 찾기), 첫 메시지 전송 때 `get_or_create_feedback_thread`. 빈 스레드가 쌓이지 않게 하려는 것. 메시지 없는 연결 스레드는 목록에서 숨김.
3. **관리자 피드백 진입점**: spec엔 관리자용 대화 목록이 없어 안 읽음 배지를 눌러도 갈 곳이 없으므로, 학습 현황 개요에 "피드백 대화"(안 읽은 것 먼저, 10건) 섹션을 추가 → 회원 상세 `?tab=feedback&thread=` 로 이동.
4. **참여 집계 탭**: 글별 표(spec) + **학생별 표**(읽은 글·댓글·좋아요·웹앱 결과·제출 수, embed count) 추가. 열 머리글 클릭 정렬.
5. **개요 카드**: A가 둔 "전체 글/발행된 글/비밀번호 변경 대기" 카드는 spec §3.1의 4개(회원/오늘 결과/검토 대기/안 읽은 피드백)로 교체.
6. **앱 이름**: 학생 화면은 spec대로 "삭제된 앱", 관리자 화면은 등록 안 된 `app_id`를 그대로 표시(`src/data/apps.ts`가 아직 비어 있어 모두 "삭제된 앱"이 되는 문제 방지).
7. **최근 활동 정렬**: 제출은 `submitted_at` 기준(`updated_at`은 관리자 상태 변경에도 바뀜). 화면 문구도 "최근 변경".
8. **class1-record.js API**: 지침의 `init/save/getUser` + `loginUrl()`, `renderLoginHint(el)`(링크 `target="_top"` — iframe 안에서도 전체 창 이동). `save`는 입력 검증 후 `{ok, reason: not_initialized|not_logged_in|invalid|error}`. SRI는 설치된 `node_modules/@supabase/supabase-js@2.116.0/dist/umd/supabase.js`로 계산(jsDelivr가 같은 파일을 서빙).
9. **이상치 표시**: 관리자 결과 표에 만점 초과·0초 만점·음수 점수 경고 아이콘(§8 완화책).

## 알려진 한계
- 목록은 학급 규모 전제로 상한이 있다: 웹앱 결과 1,000건, 앱별 집계 5,000건, 스레드 1,000·메시지 5,000건(Supabase 기본 max-rows가 1,000이면 그 이하). 초과 시 화면에 "최근 N건" 표기만.
- 안 읽음 배지는 헤더·관리자 메뉴·탭이 각각 RPC를 부른다(포커스마다 몇 건). 실시간 아님(§14 Q6).
- 상대방이 읽었는지(읽음 확인)는 표시하지 않는다 — `feedback_read_marks`는 본인 행만 조회 가능(RLS).
- 제출 "지각"은 처음 제출 시각 기준. 마감 후 수정은 "최근 변경" 시각으로만 보인다.
- 학생 삭제 버튼 비활성 판단은 브라우저 시계 기준(최종 판정은 RLS). 그사이 조건이 바뀌면 "삭제하지 못했어요" 토스트.
- 가짜 서버 확인이라 **PostgREST embed 문법(`profiles!inner`, `comments(count)` 등)과 RLS 동작은 실 DB에서 확인되지 않았다.**
- sr-only 텍스트가 `overflow-x-auto` 목록 밖으로 새어 모바일 가로 스크롤을 만드는 문제가 있어 스크롤 컨테이너에 `relative`를 붙였다(A의 회원 목록 표 등 다른 곳에도 같은 패턴이 있다면 같은 수정 필요 — 이번 범위에서 확인한 A 파일은 admin-shell뿐).

## Review 중점 확인 항목
- 실 DB에서 각 쿼리 embed 동작: `member_directory → profiles!inner` + `profiles.role` 필터(`fetchStudents`), `profiles → comments/likes/post_reads/app_results/assignment_submissions(count)`(학생별 참여), `posts → comments(count),likes(count)`.
- 학생 계정: 제출 → 수정 → (마감 전·검토 전) 삭제 → 재제출, 검토 완료/마감 후 삭제 버튼 비활성, 삭제 후 연결 대화가 "삭제된 제출물"로 남는지.
- 피드백: 관리자 → 학생 메시지 후 학생 헤더 빨간 점/배지, 학생이 열면 배지 사라짐(포커스 복귀 시 갱신), 반대 방향도.
- 글 상세를 로그인 상태로 열면 `post_reads` 1건(같은 탭 새로고침 시 증가 안 함), 비로그인·비공개 글은 기록 안 함.
- `admin_dashboard_stats` 카드 값, "오늘 학습 결과"가 한국 시간 자정 기준인지.
- `/admin/learning/?tab=assignments&assignment=` 잘못된 id → "과제를 찾을 수 없습니다".
- 모바일(375px)·다크모드에서 탭 가로 스크롤, 다이얼로그 스크롤.

## 사용자가 할 일
1. (A 보고서와 같음) `supabase/migrations/20260921020000_admin_learning.sql`을 SQL Editor에서 실행. 실행 전에는 학습 화면에 "DB 설정 필요"(관리자) / "아직 준비되지 않았어요"(학생) 안내가 나온다.
2. 관리자·학생 테스트 계정으로 위 "Review 중점 확인 항목"을 실제로 한 번씩 확인.
3. 웹앱을 만들 때 `scripts/templates/class1-record.js`를 앱 폴더로 복사하고, `src/data/apps.ts`의 `id`를 앱 폴더명과 같게 등록(학습 현황 앱별 표·학생 화면 앱 이름이 이 목록을 쓴다). CDN SRI는 처음 한 번 브라우저 콘솔 오류가 없는지 확인.
