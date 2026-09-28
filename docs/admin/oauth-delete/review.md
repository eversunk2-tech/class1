# Review — 구글·깃허브(OAuth) 계정 완전 삭제 (2026-09-28)

> 지침 `review-instructions.md`. 설계 `spec.md`(끝 **개정 1**이 우선)·`build-instructions.md`·`build-report.md`·`CLAUDE.md`를 읽고 검토했다.
> **코드는 고치지 않았다.** 실 DB·실제 Supabase·Google·GitHub 요청 0, 내려받기·설치 0, commit/push 0.
> 방법: ① SQL은 줄마다 읽기 + 구조 검사(문장 6개·`raise` 14개·괄호·`any((select` 0) + 앞선 마이그레이션 18개의 외래키·트리거 전수 대조
> ② Edge Function은 Deno가 없어 **같은 코드(타입만 벗김)를 Node에서 가짜 `fetch`(네트워크 없음)로 44가지 상황** 실행 + strict `tsc` 통과
> ③ 화면은 스크래치 사본(전 = `git archive HEAD` 101ecb0, 후 = 그 위에 이번 `src`·`supabase` 변경)을 가짜 Supabase 주소·키로 `next build` →
> 자기 정적 서버 8922 + 자기 headless Chrome 9422(`--host-resolver-rules`로 supabase.co 차단, 첫 로드부터 CDP `Fetch` 가짜 응답, 캐시 끔) — **자동 점검 129/129 통과**, 콘솔 오류 0, 가짜 백엔드 밖 요청 0.

## 1. 발견 (심각도별)

**높음 0 · 중간 0 · 낮음 8(+참고 3).** 잘못 지우는 경로(아이디 계정·교사·총괄 자신·다른 계정, 권한 없는 호출, 반쯤 지워진 채 다시 못 지움)는 찾지 못했다 — 화면·함수·SQL이 같은 규칙으로 세 번 거르고, 파괴 단계 전에 모두 거부됨을 실행으로 확인(§2-2).

### 낮음

| # | 파일:행 | 무엇 | 재현 | 제안 |
|---|---|---|---|---|
| L1 | `supabase/functions/admin-purge-oauth-member/index.ts:268~274` | 새 SQL 프로브가 "함수 없음"이 **아닌 모든 오류**(권한 42501, 연결 실패, 5xx)를 "함수 있음"으로 보고 파일·계정 삭제로 넘어간다(fail open). | Node 하네스: 프로브만 42501 또는 연결 오류로 → 200, 파일·계정·기록 삭제까지 진행. RPC가 실제로도 못 불리면 ⑦만 계속 실패(경고 반복). SQL 맨 끝 점검이 service_role 실행 권한을 보장해 가능성은 낮다. | 프로브 오류가 기대한 `missing arguments`(P0001)일 때만 통과, 그 밖은 "잠시 후 다시" 400/500으로 멈추기(아무것도 안 지움). |
| L2 | `index.ts:101~107`(`isUserNotFound`) | 404·`user_not_found`뿐 아니라 메시지에 `does not exist`·`not_found`만 있어도 "계정 없음"으로 본다. | Node 하네스: `getUserById`가 500 + "…does not exist" → 이중 확인(③-3)과 계정 삭제(⑥) 건너뜀 → 파일 삭제 → SQL 0-5가 막아 경고(문구 "로그인 계정…지웠지만"은 사실과 다름), 다시 눌러도 같음. 함수 주인이 `auth.users`를 못 읽는 환경이면(0-5 건너뜀) 기록만 지워지고 로그인만 남는 이중 고장. | `status === 404 \|\| code === "user_not_found"`만 "없음"으로. |
| L3 | `index.ts:66~67, 113~138, 154~156` | 하위 폴더 3단계 이상 파일은 목록에도 재확인에도 안 잡혀 남은 채 200 ok. | 하네스: `{id}/sub/deeper/deepest/x.html` 1개 남고 성공(237개 쪽 넘김·2단계 폴더·비슷한 이름 폴더 `{id}x/`·다른 회원 폴더는 모두 정상). 사이트 업로드는 정책 정규식상 `{id}/{uuid}.html`만 가능 → 대시보드로 만든 경우만 해당. | 재확인 때 `list(id)`에 항목(폴더 포함)이 하나라도 남으면 멈추기. |
| L4 | `index.ts:316~335`, `member-list.tsx:253` | ⑦ 실패(경고) 상태: 로그인·게임 파일은 지웠는데 `withdrawn_at`이 비어 있어 게시판·댓글에 **실제 이름이 그대로** 보이고, 관리자 목록에도 평범한 회원처럼 남는다(안내는 15초 알림뿐). 다시 누르면 해결. | 화면 시험 `warning` → 행이 그대로·표시 없음. | (선택) 경고 행에 "마무리 필요" 표시, 또는 경고 경로에서 이름 가리기. |
| L5 | `src/components/admin/member-purge-dialog.tsx:144~147`, `README.md:35` | "쓴 선생님 글·과제·블로그 글은…(총괄만 고칠 수 있어요)" — 과제·블로그 글은 맞지만 **선생님 글**(`class_notices`)은 쓴 사람과 상관없이 그 학급 담임이 고치고 지운다(`20260927020000` 282~295행). 총괄도 자기가 담임인 학급 것만. 담임 해제로 담임이 없어진 학급이면 아무도 못 고침. | 문구·정책 대조. | "선생님 글은 그 학급 담임이, 과제·블로그 글은 총괄이…"처럼. |
| L6 | `member-purge-dialog.tsx:170~177` | 휴대폰에서 취소·완전 삭제 버튼 높이 32px(CLAUDE.md 터치 44px). 기존 탈퇴·비밀번호 대화상자와 같은 모양(같은 화면의 담임 지정 대화상자는 `h-11`). | 390×844 측정 32px. | (선택) 두 버튼에 `h-11 px-4`. |
| L7 | `supabase/migrations/20260928000000_oauth_purge.sql:91~108` | 확인 쿼리 3)은 `'<지운 id>'`를 **19곳** 바꿔야 한다. 하나라도 빠지면 uuid 형식 오류로 멈춘다(틀린 0이 나오지는 않음). | 읽기. | `with t(id) as (select '<지운 id>'::uuid)` 한 곳만 바꾸게(파일은 아직 실행 전이라 같은 파일 수정 가능). |
| L8 | `src/lib/admin.ts:265`(`isOAuthOnlyMember`) ↔ 함수 ③-2·SQL 0-4 | 명단이 `provider='email'`·`providers=['google']`처럼 어긋나면 화면은 '완전 삭제' 켜짐, 서버는 400 거부(안전). GoTrue는 대표 방식을 목록에 넣으므로 실제로는 생기기 어렵다. | 화면 시험(어긋난 계정 행). | 참고 — 고치려면 화면도 `provider==='email'`을 함께 보기. |

**참고(설계대로, 보고서·README에 적힘)**: ① 교사였던 계정을 지우면 학생의 피드백 대화가 빈 대화로 남을 수 있다. ② 삭제 직후 이미 발급된 접근 토큰(최대 1시간)으로 게임 파일 업로드만 이론상 가능(Storage 정책이 프로필을 보지 않음). ③ ③(역할 확인)과 ⑥(계정 삭제) 사이에 같은 계정을 담임으로 지정하면 로그인만 지워지고 ⑦이 거부(총괄이 두 창에서 동시에 해야 생김).

## 2. 확인할 것 1~5 판정

1. **SQL — 통과.** plpgsql 문법·`search_path=''`에서 모든 이름 `public.`/`auth.` 한정, `create or replace`·revoke/grant로 재실행 안전, `anon`·`authenticated`·PUBLIC 회수 + `service_role`만(맨 끝 점검이 어기면 전부 되돌림). 확인 순서 = 인자 → 총괄 → 자기 자신 → 대상 `for update` 잠금(없으면 조용히 끝 = 멱등·동시 두 번이면 뒤엣것이 기다렸다 끝) → 교사 거부 → OAuth 전용(명단 없음·`email`·방식 모름 거부) → `auth.users`에 남아 있으면 거부(권한 없음 `insufficient_privilege`만 건너뜀, 다른 오류는 전파). 지우는 순서 1) 신고 스냅샷 2) 게시판·게임 글(남의 댓글·좋아요 cascade, 남은 신고 set null — 글 신고를 먼저 지워 부분 유일 인덱스 충돌 없음) 3) 관리 기록 3곳 + 처리자 흔적 비우기 4) `profiles` — **앞선 마이그레이션 18개의 외래키 31개가 모두 cascade/set null**(restrict·no action 0), `profiles`·관련 표에 삭제 트리거 0(set null은 `set_updated_at`만 부름, 가드 트리거는 insert/update 전용이거나 2)에서 글을 먼저 지워 안 불림). `admin_finalize_withdrawal`과 같은 표 주인 권한(RLS 우회) 방식. 앞선 마이그레이션 수정 0, 개인정보 0. 확인 쿼리 1)~4)는 SQL Editor(postgres)에서 `storage.objects`·`auth.users` 조회 가능(앞선 백필 쿼리와 같은 권한) — 3)은 L7.
2. **Edge Function — 통과(L1~L3 낮음).** Node 하네스 44건 중 43 통과(1건 = L3): 토큰 없음·잘못된 토큰 401, 학생·담임 403, 학급 SQL 전 400 — **모두 파괴 동작 0**. 자기 자신·교사·아이디 학생·**명단은 구글뿐이지만 Auth identities/app_metadata에 email** → 400(이중 확인 작동)·방식 모름·명단 없음 400·없는 회원 404 `target_not_found` — 파괴 0. 새 SQL 없음 → 400, 파일·계정 그대로. 정상: 순서 **파일 삭제 → 계정 하드 삭제(`should_soft_delete:false`) → RPC(대상, 호출자)**. 목록·삭제·재확인 실패 → 500, 계정 그대로 / 계정 삭제 실패 → 500, RPC 안 부름 / RPC 실패 → 200 warning → 다시 누르면 ⑤·⑥ 통과·⑦만 → 성공 → 한 번 더 누르면 404. 예전 탈퇴 구글(Auth 없음) → 파일·기록 삭제. CORS는 다른 함수와 글자 그대로 같음(`EXTRA_ALLOWED_ORIGINS` https만, 모르는 출처 ACAO 없음), GET 405. 로그 = 실패 단계·오류 문구뿐(토큰·키·이메일·이름 없음, 성공은 안 남김). `config.toml` `verify_jwt = true`, README에 `--no-verify-jwt` 금지·배포 두 방법.
3. **화면 — 통과(L6 낮음).** 총괄: 구글·깃허브·구글+깃허브·예전 탈퇴 구글 = '완전 삭제'(휴지통, 켜짐, 메뉴 항목 수는 전과 같음 = 교체) / 교사 구글 = 꺼짐 "먼저 담임 해제"(담임 해제 메뉴는 그대로, 상세에서 해제하면 새로 고침 없이 켜짐) / 아이디·섞인·방식 모름·탈퇴한 아이디·본인·다른 담임 = '탈퇴 처리' 그대로(아이디 학생 메뉴는 전과 JSON까지 같음). 담임 = 구글 계정 안 보임, 보이면 꺼짐 "총괄만", 함수 호출 0. 권한 확인 중 꺼짐 "확인 중" → 켜짐, 학급 SQL 전 = 예전 '탈퇴 처리'. 대화상자: alertdialog + 제목·설명 연결, 경고 문구 4가지(다른 사람 댓글·피드백·되돌릴 수 없음·다시 가입하면 새 계정) 포함, 이름 일부·한 글자 더 → 꺼짐, 앞뒤 공백만 다름 → 켜짐, 예전 탈퇴 계정은 "탈퇴한 학생"으론 안 켜지고 실제 이름으로 켜짐, 진한 빨강 + 흰 글자(대비 밝음 6.64·어두움 5.43), 처음 초점 입력칸·Tab이 창 안에서만 돎·입력칸 Enter로는 실행 안 됨·Esc·취소로 닫힘 → 메뉴 버튼으로 초점 복귀, 처리 중엔 Esc·바깥 클릭·연타 막힘(호출 1번). 성공 → 알림 + 행 사라짐 + 목록·학급 정보 다시 읽기, 상세에서 성공 → 목록으로·경고 → 그 자리 다시 읽기. 오류 11종 문구(403·400×3·401×2·404 배포 안 됨·연결 실패·500×2·응답 이상) + '다시 시도' → 성공. 휴대폰 390(가로 넘침 0, 창 화면 안)·낮은 화면 390×480(창 안 스크롤, 끝에 버튼)·어두움, 관리자 영역 색(포털도 `:has(.admin-area)`), 대화상자 제목 그림자 없음.
4. **요청과 맞는지 — 통과.** 표를 모두 돌았다: 회원 명단·개요(`member_directory` cascade), 학습 현황·학생 응답(`app_results`·`app_progress`·`post_reads`·`assignment_submissions` cascade), 피드백(대화·메시지·읽음 cascade, 교사였으면 보낸 메시지도), 신고 관리(대상 관련 신고 삭제, 남는 것은 **다른 사람 댓글** 스냅샷뿐), 관리 기록(3곳 삭제 + 처리자 이름·id 비움 — 목록 화면은 없고 상세 '탈퇴 처리 · 이름'만 읽음), 게시판·학습게임 글·파일, 블로그 댓글·좋아요. 남는 것은 모두 이름 없이(교사 글·과제·선생님 글·칭찬 문구·학급·잠금 스위치 `updated_by` = 비움). 사이트 밖: Supabase Auth 감사 로그·API 로그(보관 기간) — 보고서에 적힘. **다시 가입**: `profiles`·`member_directory`는 id PK뿐, 이메일·이름 유일 제약 없음(전체 `unique` 검색), `auth.users` 삭제 트리거 없음, `handle_new_user`는 `on conflict (id) do nothing` → 새 id로 막힘 없음.
5. **lint·타입·정리 — 통과.** `npm run lint` 0, 바뀐 4파일 `eslint --max-warnings=0` 0, `npx tsc --noEmit` 0, 함수 strict `tsc` 0, `git diff --check` 깨끗(새 파일 끝 공백 0), `console.log`·`debugger`·TODO 0. 바뀐 파일은 지침 목록과 같음(앞선 마이그레이션·다른 함수·`public/apps/` 변경 0).

## 3. 사용자가 할 일 순서 점검 (build-report §6)

순서(SQL 실행 → 확인 쿼리 1)·2) → 함수 배포 → push → 시험 계정)는 맞다. **어느 순서로 어긋나도 지워지지 않는다**(화면만 먼저: "완전 삭제 기능이 아직 준비되지 않았습니다/연결하지 못했습니다", 함수만 먼저: "DB 설정 필요" — 둘 다 시험으로 확인). 빠진 것·위험:
* 함수 배포 뒤 Supabase 대시보드 Edge Functions에서 `admin-purge-oauth-member`의 **Verify JWT가 켜져 있는지** 한 번 보기(README 방법 B에만 있음).
* push는 사용자 확인 뒤. 함께 **`CLAUDE.md`**(함수 목록에 `admin-purge-oauth-member`, CORS 줄 "함수 4개" → 5개, 로그인 절에 완전 삭제 규칙 — 보고서 §8 제안)·**`docs/STATUS.md`** 갱신. 커밋은 이 작업 경로만(`supabase/.temp/`·다른 작업 제외).
* 시험(5단계): **버려도 되는 시험용 계정**으로만. 완전 삭제 **전에** 상세 주소의 `id=`를 적어 두기(삭제 뒤엔 찾을 수 없음). 그 시험 글에 다른 계정으로 댓글 하나·게임 파일 하나를 올려 두면 "다른 사람 댓글도 사라짐"·Storage 삭제까지 확인된다. 확인 쿼리 3)은 L7(19곳 바꾸기). 다시 로그인해 생긴 새 시험 계정은 필요 없으면 한 번 더 완전 삭제.
* 이미 '탈퇴 처리'한 구글·깃허브 계정 정리는 하나씩(자동 없음 — 개정 1 Q7).

## 4. 확인하지 못한 것
* 실제 DB에서 SQL 실행(로컬 Postgres 없음): 특히 함수(표 주인 = SQL Editor의 postgres)가 `auth.users`를 읽는지(못 읽으면 0-5만 건너뜀 — L2와 겹칠 때만 위험), 표 주인 권한으로 RLS를 거치지 않는다는 전제(`admin_finalize_withdrawal`과 같음).
* 실제 Edge Function(Deno)·실제 Storage·GoTrue: `list(id)`가 폴더로 해석되는지(하네스는 그 동작을 흉내 냄), 실제 오류 모양(404 `user_not_found`), 하드 삭제가 identities까지 지우는지, 같은 구글·깃허브 계정 즉시 재가입, 게이트웨이 404·401에 CORS 헤더가 붙는지(화면 문구만 달라짐 — 둘 다 안전).
* 실제 로그인 계정·실제 iPad·휴대폰 손가락 조작.

## 5. 대표 사진 `…/scratchpad/review-oauth/showcase/`
* `compare-menu-google.png` — 전·후: 구글 계정 ⋮ '탈퇴 처리' → **'완전 삭제'**(휴지통)
* `compare-menu-id-student.png` — 전·후 같음: 아이디 학생은 '탈퇴 처리' 그대로
* `compare-menu-teacher-google.png`·`compare-detail-teacher-google.png` — 교사 구글: '완전 삭제' 꺼짐 **"먼저 담임 해제"**(목록·상세)
* `after-dialog-typed.png` — 완전 삭제 대화상자(경고 문구, 이름 입력 → 진한 빨강 버튼) / `after-dialog-empty.png`(입력 전 꺼짐)·`after-dialog-withdrawn-google.png`(예전 탈퇴 계정 문구)
* `compare-mobile-menu-google.png`·`after-mobile-dialog.png`(휴대폰), `after-dark-dialog.png`(어두움)
* `after-purged-toast.png`(성공 알림)·`after-warning-toast.png`(경고 — 행 남음)·`after-error-missing-sql.png`(SQL 전 안내)·`after-menu-home-google.png`(담임: "총괄만")
* 시험 도구·결과: 같은 폴더 위 `rv.mjs`·`backend.mjs`·`lib.mjs`·`report-*.json`, 함수 하네스 `fntest/harness.mjs`.

**배포해도 됨** — 잘못 지우는 경로·권한 우회·되돌릴 수 없는 반쯤 삭제는 찾지 못했고(규칙 세 겹, 파괴 전 거부를 실행으로 확인), 낮음 8건은 드물거나 문구·모양이다. 함수는 아직 배포 전이니 L1·L2(몇 줄, fail closed)와 L7(확인 쿼리)을 먼저 고치면 더 안전하다(막는 문제는 아님).

## Claude 후속(2026-09-28, 배포 전)
* **L1 고침**: 새 SQL 확인(④)에서 기대한 대답(`missing arguments`)일 때만 계속, 그 밖의 오류(권한·연결 등)나 뜻밖의 성공이면 "DB 설정을 확인하지 못해 완전 삭제를 멈췄습니다. 아무것도 지우지 않았습니다."(500)로 멈춘다(`index.ts` ④).
* **L2 고침**: `isUserNotFound`는 상태 404·코드 `user_not_found`만 본다(메시지 글자로 판단하지 않음).
* **L5 고침**: 대화상자의 "(총괄만 고칠 수 있어요)"를 빼고 "쓴 사람 표시 없이 남습니다"로.
* **L7 고침**: 확인 쿼리 3)을 `with t as (select '<지운 id>'::uuid as id)` 한 곳만 바꾸면 되게(주석 — 사용자가 아직 실행하기 전 파일).
* **L3은 그대로**: 게임 파일 경로는 `community_posts` 검사로 `<계정 id>/<파일>` 한 단계만 생긴다 — 3단계 이상 하위 폴더는 사이트로 만들 수 없다.
* 확인: 검토 담당의 함수 시험(가짜 fetch, 네트워크 없음)을 고친 코드로 다시 — **43/44**(남은 1개 = L3), 프로브 권한 오류·연결 오류는 이제 멈춤(파괴 0), `getUserById` 500 + "does not exist" 문구를 없는 계정으로 오인하지 않음. `npx tsc --noEmit`·`npm run lint`·`git diff --check` 통과.
* L4·L6·L8은 그대로(낮음 — L6은 기존 탈퇴 대화상자와 같은 모양).
* `CLAUDE.md`에 규칙 줄(OAuth 전용 계정 완전 삭제)·함수 목록 5개·CORS "함수 5개" 반영.
