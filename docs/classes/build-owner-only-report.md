# Build 보고 — 과제·블로그 글은 쓴 선생님과 총괄만 고치고 지우기 (2026-09-26)

> 지침 `docs/classes/build-owner-only-instructions.md`. 사용자 결정 "과제·글 수정은 쓴 선생님과 총괄만 하게 해줘"(review.md M1).
> SQL은 **실행하지 않았다**(로컬 Postgres 없음 — 기존 마이그레이션과 한 줄씩 대조하고 구조 점검 스크립트로 확인). git commit·push 안 함.

## 0. 한 줄 요약
새 SQL 한 파일로 과제(`assignments`)·블로그 글(`posts`)의 **작성 = 교사가 자기 이름으로, 수정(공개 전환 포함)·삭제 = 쓴 교사 또는 총괄**로 좁히고, 쓴 사람 열은 아무도 못 바꾸게 했다. 관리자 과제 화면·블로그 관리 화면은 남의 것이면 버튼을 끄고 까닭을 보이며, 서버가 거부하면 한국어로 알린다. 가짜 서버 시험 98/98 통과, lint·tsc·build 통과.

## 1. 바뀐 파일
| 파일 | 내용 |
|---|---|
| `supabase/migrations/20260927030000_content_owner_only.sql` (새) | 정책 4개 → 6개, 고치기 열 권한, 맨 앞 점검·맨 끝 점검, 확인 쿼리 6개, 되돌리기 SQL(주석) |
| `src/hooks/use-admin-context.tsx` | `canModifyContent(ctx, 쓴사람)`·`contentLockReason(ctx)`·`isPermissionRejection(err)`, 문구 `OWNER_ONLY_EDIT`·`OWNER_ONLY_DELETE` |
| `src/lib/learning.ts` | `fetchProfileNames(ids)`(만든 선생님 이름, 보조 정보), 수정·삭제 함수 주석 |
| `src/app/admin/(dashboard)/learning/assignment-manager.tsx` | 남의 과제: 공개 스위치·수정·삭제 끔 + 자물쇠 아이콘과 "쓴 선생님과 총괄만 고칠 수 있어요." + 다른 선생님 과제에 "만든 선생님 ○○", 서버 거부 문구, 지우기 확인 문구 |
| `src/app/admin/(dashboard)/learning/submission-review.tsx` | 제출 현황 머리의 '과제 수정'도 같은 규칙(제출물 검토는 그대로) |
| `src/app/admin/(dashboard)/posts/admin-post-list.tsx` | `author_id`를 읽어 남의 글은 발행 스위치·수정(링크 대신 꺼진 버튼)·삭제 끔 + 까닭, 서버 거부 문구 |
| `src/app/admin/write/page.tsx`·`post-editor.tsx` | 편집기에 `AdminContextProvider`(총괄 여부). 남의 글이면 안내 줄 + 저장·삭제 끔 + Ctrl/Cmd+S도 막음, 서버 거부 문구 |

건드리지 않음: `public/`·`scripts/`·`supabase/functions/`·홈(`teacher-posts.tsx`·`page.tsx`)·`/post/` 상세.

## 2. SQL — 옛 정의와 한 줄씩 대조
대상 역할(`to …`)은 원래 그대로, 바뀐 것은 조건뿐. 이름은 뜻대로 바꿨고(옛 이름·새 이름 모두 `drop … if exists` → 재실행 안전) 가장 긴 것 46바이트.

| 옛 정책(파일:행) | 옛 조건 | 새 정책 | 새 조건 |
|---|---|---|---|
| assignments "관리자만 작성/수정/삭제" `for all to authenticated` (20260921020000:244-249) | using/with check `is_admin()` | "교사 본인 이름으로 작성" insert `to authenticated` | with check `is_admin() and created_by = auth.uid()` |
| 〃 | 〃 | "쓴 교사·총괄만 수정" update `to authenticated` | using·with check `is_admin() and (created_by = auth.uid() or is_super_admin())` |
| 〃 | 〃 | "쓴 교사·총괄만 삭제" delete `to authenticated` | using 같은 조건 |
| posts "관리자만 작성" insert, 역할 지정 없음 (20260921000000:117-119) | with check `is_admin()` | "교사 본인 이름으로 작성" insert | with check `is_admin() and author_id = auth.uid()` |
| posts "관리자만 수정" update (121-124) | using/with check `is_admin()` | "쓴 교사·총괄만 수정" update | using·with check `is_admin() and (author_id = auth.uid() or is_super_admin())` |
| posts "관리자만 삭제" delete (126-128) | using `is_admin()` | "쓴 교사·총괄만 삭제" delete | using 같은 조건 |

* 쓴 사람이 비어 있는(null) 행: `null = uid`가 참이 아니므로 **총괄만** 고치고 지운다(확인 쿼리 2가 그 수를 센다).
* 읽기(SELECT) 정책은 그대로. 옛 assignments `for all`은 읽기에도 걸렸지만 조건이 `is_admin()`이라 남는 읽기 정책(`published or is_admin()`)과 범위가 같다 → 교사는 계속 비공개 과제를 다 본다. 맨 앞 점검이 그 읽기 정책(내용 `is_admin()`)이 있는지 먼저 확인한다(과제 읽기 정책 이름은 67바이트라 저장 때 "…관리자는 전체 "로 잘려 있어 이름이 아니라 내용으로 찾는다).
* 42P17 없음: 새 정책이 부르는 `is_admin()`·`is_super_admin()`은 definer로 profiles만 읽는다. 배열 비교(`= any`)는 쓰지 않는다.
* **고치기 열 권한**(3절): `revoke update … from anon, authenticated` 뒤 화면이 실제로 보내는 열만 grant — assignments(title, description_md, due_at, published), posts(slug, title, summary, content_md, cover_url, tags, published, published_at). 시험에서 보낸 열이 목록 안인지 확인함. updated_at은 트리거가 채운다(권한 불필요). 새로 만들기·지우기·읽기 권한은 그대로. ⚠ 나중에 화면이 다른 열을 고치면 grant 목록에 더해야 한다(파일 머리말에 적음).
* 맨 앞 점검(하나라도 어긋나면 아무것도 안 바꿈): ①의 `is_super_admin()`·열 없음 / 두 표 없음 / 총괄 없음(③과 같은 잠김 방지) / 두 표에 `is_admin()` 읽기 정책 없음.
* 맨 끝 점검(어긋나면 전부 되돌림): RLS 켜짐, 새 정책 6개가 이름·명령 그대로 PERMISSIVE로 있음, **그 밖의 허용 쓰기 정책(INSERT·UPDATE·DELETE·ALL)이 하나도 없음**(옛 정책·대시보드에서 만든 것), 조건 글자(`is_admin()`·`uid()`·수정/삭제는 `is_super_admin()`), 쓴 사람 열 UPDATE 권한이 anon·authenticated에 없음(PUBLIC 포함), 화면이 고치는 12개 열은 UPDATE 가능.
* 확인 쿼리: 1) 정책 목록·조건 2) 쓴 사람 비어 있는 행 수 3) 쓴 사람별 과제·글 수 4) 열 권한 5) 총괄 흉내(지금 가능 — 고칠 수 있는 수 = 전체) 6) 다른 교사 흉내(두 번째 교사 뒤 — 남의 것 수정·삭제 0행, 내 것은 모두). 5·6은 결과와 상관없이 **언제나 오류로 끝나** 아무것도 저장되지 않는다(✔/✖ 메시지).
* 되돌리기: 머리말 주석에 옛 정책 4개를 글자 그대로 + `grant update on … to anon, authenticated`(Supabase 기본값).
* 구조 점검(스크래치 `owner-only/sqlcheck.mjs`): 문장 23개, 따옴표·`$$` 짝, 괄호, `raise`의 `%` 개수 = 인자 수, 정책 이름 바이트 — 문제 0.

## 3. "만든 사람을 바꾸는 길" 점검
| 길 | 결과 |
|---|---|
| 담임이 자기 과제의 created_by를 남·빈 값으로 UPDATE | 열 권한 없음(42501) — 열 권한을 풀어도 with check(`created_by = 나`)에서 막힘 |
| 담임이 남의 과제를 자기 것으로(created_by = 나) | using에서 0행 + 열 권한 없음 |
| 총괄이 created_by를 바꿈 | 조건은 통과하지만 **열 권한으로 막힘**(총괄 포함 아무도 — SQL Editor만) |
| 남의 이름·빈 이름으로 새로 만들기 | insert with check(`= auth.uid()`) — null도 거부 |
| upsert(POST merge) | 충돌 행이 남의 것이면 update using 위반 오류, created_by를 보내면 열 권한 오류 |
| 블로그 글 author_id | 위와 같음(열 권한·with check) |

## 4. 제출물·글 읽음 기록을 지우는 다른 길(바꾸지 않은 것 포함)
| 길 | 누가 | 이번 |
|---|---|---|
| 과제 삭제 → 제출물 연쇄 삭제 | **쓴 교사·총괄**(전: 교사 누구나) | 바꿈 |
| 블로그 글 삭제 → post_reads·댓글·좋아요·조회수 연쇄 삭제 | **쓴 교사·총괄** | 바꿈 |
| assignment_submissions 직접 삭제 | 그 학생의 담임 / 학생 본인(마감 전·검토 전) — ③ | 그대로 |
| post_reads 직접 쓰기 | 없음(insert·update·delete 권한 회수, `record_post_read` RPC는 본인 행 추가·갱신만) | 그대로 |
| profiles 삭제 → 기록 연쇄 삭제 | 없음(profiles에 DELETE 정책 없음, 완전 탈퇴는 auth 계정만 지우고 profiles 외래키는 끊어져 있음 — `withdrawal_blocking_fks()`) | 그대로 |
| 제출물의 assignment_id·user_id 바꾸기 | 가드 트리거가 막음 | 그대로 |
| 함수·트리거 | 제출물·읽음 기록을 지우는 함수·트리거 없음(마이그레이션·Edge Function 전체 검색: `delete from`은 auth.sessions·refresh_tokens·class_teachers뿐) | — |
| TRUNCATE 표 권한 | Supabase 기본값으로 anon·authenticated에 남아 있음(assignments·posts·제출물·post_reads 등). **API(PostgREST·GraphQL)에 TRUNCATE가 없어 닿지 않음** | 그대로(원하면 `revoke truncate on … from anon, authenticated;` 한 줄) |
| 블로그 댓글 삭제 | 교사 누구나(`is_admin()`, 개정 1-5) | 그대로 |
| 자유게시판·학습게임 숨기기·삭제·신고, 칭찬 문구 | 교사 누구나(개정 1-5) | 그대로 |

## 5. 화면
* **과제 관리**(`/admin/learning/?tab=assignments`): 남의 과제·쓴 사람 없는 과제(총괄이 아니면) → 공개 스위치·수정·삭제 꺼짐, 자물쇠 아이콘 + 까닭 한 줄(버튼 `aria-describedby`로 연결), '제출 현황'은 그대로. 다른 선생님 과제에만 "만든 선생님 ○○"(없으면 "만든 선생님 정보 없음", 이름을 못 읽으면 "다른 선생님이 만든 과제") — 이름은 남의 과제가 있을 때만 profiles 공개 열로 한 번 읽고 실패해도 목록은 그대로(교사 한 명이면 요청 없음). 새 과제 그대로.
* 지우기 확인 창: 제출 수가 "내 학급" 수(RLS)인데 지우면 반과 상관없이 모두 지워지므로 "이 과제(“제목”)를 지우면 학생 제출물(내 학급 N건, 다른 반 학생이 낸 것이 있으면 그것까지)도 함께 삭제되며…", 총괄이 남의 과제를 지울 때 "○○ 선생님이 만든 과제예요."를 앞에. (예전 "“제목”과"의 조사 어긋남도 없앰.)
* 서버 거부: 0행·42501이면 "공개 상태를 바꾸지 못했습니다. 쓴 선생님과 총괄만 고칠 수 있어요." / "과제를 삭제하지 못했습니다. 쓴 선생님과 총괄만 지울 수 있어요." / 폼 "과제를 저장하지 못했습니다. 쓴 선생님과 총괄만 고칠 수 있어요." — 그 밖 오류는 예전 문구.
* **블로그 글 관리**(`/admin/posts/`, 메뉴에 없음): 남의 글 → 스위치·수정·삭제 꺼짐(수정은 편집 링크 대신 꺼진 버튼) + 까닭. 권한 확인 중·실패면 "권한을 확인하는 중…"·"권한을 확인하지 못해 지금은 고칠 수 없어요. 화면을 새로 고쳐 주세요."(내 글은 그대로 켜짐).
* **편집기**(`/admin/write/`): 남의 글 → 안내 "쓴 선생님과 총괄만 고칠 수 있어요. 이 글은 볼 수만 있고 저장·삭제는 할 수 없어요." + 저장·삭제 꺼짐 + Ctrl/Cmd+S도 토스트로 거부(요청 없음). 입력칸은 그대로(최소 변경). 서버 거부 문구도 같은 말로.
* 판단 규칙(`canModifyContent`): 내 것 = 항상 가능, 남의 것 = 총괄로 확인된 뒤만, 학급 SQL 전("missing") = 예전처럼 모두 가능(그때는 이 SQL도 적용할 수 없어 서버가 교사 누구나 허용).

## 6. 검증
* `npm run lint` 0 · `npx tsc --noEmit` 0 · `npm run build` 성공(25쪽) · `git diff --check` 깨끗 · `console.log`·`localStorage.clear()`·개인정보 0.
* 브라우저: 빌드한 `out/`을 스크래치로 **복사**(다른 작업 빌드와 안 섞이게) → 자기 정적 서버 8791 + 자기 headless Chrome 9362(`--host-resolver-rules="MAP *.supabase.co 127.0.0.1:9, MAP supabase.co 127.0.0.1:9"` — 가로채기 없는 탭의 fetch는 `Failed to fetch` 확인) + 첫 로드부터 CDP `Fetch` 가짜 응답(가짜 RLS: 남의 행 PATCH/DELETE = 0행, 쓴 사람 열 전송 = 42501, 옵션으로 "늦은 화면"·42501 거부) + 캐시 끔. **98/98 통과** — 담임(남의 과제 꺼짐·까닭·요청 0, 내 과제 공개·수정·새 과제·지우기, 보낸 열 = 열 권한 목록, 제출 현황 머리), 총괄(모두 가능, 남의 과제 지우기 문구), 서버 거부(0행·42501) 한국어 문구 9곳, 학급 SQL 전 예전 동작, 글 관리·편집기(담임·총괄·권한 확인 실패), 375·768·1280 가로 넘침 0, 어두운 화면. 실제 Supabase·외부 요청 0, 콘솔 오류 0(편집기 미리보기의 CDN 스크립트는 시험에서 막음 → 원문 표시).
* 도구·결과(Review용): `…/scratchpad/owner-only/`(`serve.mjs`·`lib.mjs`·`backend.mjs`·`run.mjs`·`sqlcheck.mjs`, `report-*.json`, `all-run.log`, 스크린숏 `shots/` 13장 — `home-1-assignments-1280.png`·`super-2-delete-others-confirm.png`·`posts-1-home-1280.png`·`editor-1-others-banner.png` 등). 서버·Chrome 종료(8791·9362 비어 있음), Chrome 프로필·사이트 복사본 삭제.

## 7. 사용자 실행 순서
1. Supabase SQL Editor에서 `supabase/migrations/20260927030000_content_owner_only.sql` 전체 Run → "✔ 과제 · 블로그 글은 이제 쓴 선생님과 총괄만…" 알림 확인.
2. 머리말 확인 쿼리 1)~4) Run(1: 표마다 정책 4개, 2: 쓴 사람 없는 행 수, 4: 앞 2개 false·뒤 3개 true), 5) 총괄 흉내 → 메시지가 ✔로 시작하는지(오류 모양으로 끝나는 것이 정상).
3. 사이트 push(화면은 SQL 없이도 안전 — 순서가 바뀌어도 깨지지 않는다). Edge Function 재배포 필요 없음.
4. 두 번째 담임이 생기면 확인 쿼리 6).

## 8. 남은 위험·결정 필요 / 확인하지 못한 것
* **남은 위험(사용자 결정 필요)**: 과제는 여러 반이 함께 쓰므로, **쓴 선생님이 자기 과제를 지워도 다른 반 학생이 그 과제에 낸 제출물까지 지워진다**(외래키 연쇄 — RLS 밖). 총괄이 남의 과제를 지울 때도 같다(총괄은 다른 반 제출물을 볼 수도 없다). 이번에는 확인 창에 그 사실을 적는 데서 그쳤다. 막으려면 ① 과제를 학급별로 나누기 ② "다른 반 제출물이 있으면 지우기 거부"(definer 함수로 세어야 함) ③ 지우기 대신 비공개만 — 중 선택.
* `/post/` 상세의 관리자 '수정'·'삭제'(범위 밖이라 그대로): 남의 글이면 수정은 편집기 안내로 막히고, 삭제는 서버가 0행으로 거부해 예전 문구 "글을 삭제하지 못했습니다."가 뜬다(공개 글 0개).
* 확인하지 못한 것: 실제 SQL 실행(로컬 Postgres 없음 — 특히 끝 점검의 조건 글자 비교는 pg_policies 표시 형식에 기댄다: `is_admin()`·`uid()`·`is_super_admin()`를 스키마 이름과 상관없이 찾게 했다), 실제 계정 두 명으로 교차 확인, 실제 iPad·로그인 화면(모두 가짜 세션·headless).
