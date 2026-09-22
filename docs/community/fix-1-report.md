# Fix-1 보고: 커뮤니티 review 1차 수정

기준: `review.md`의 M1, L1~L6 전부 (I1~I4는 참고). 수정 범위는 `src/**`와 `supabase/migrations/20260922040000_community.sql`뿐이다. 커밋, 푸시, 실제 DB·Storage 쓰기는 하지 않았다. 샌드박스는 그대로 `allow-scripts`만 쓰고 same-origin은 없다.

## 항목별 처리

| # | 처리 | 위치 |
|---|---|---|
| **M1** 숨긴 게임 파일 공개 | 버킷을 **비공개(`public=false`)**로 바꿨다. SELECT 정책은 "본인 폴더 **또는** 관리자 **또는** 연결된 게임 글이 숨김이 아니거나 요청자가 작성자·관리자"일 때만 허용한다. 비로그인도 숨기지 않은 게임은 받을 수 있다(게시판 읽기 원칙과 같음). 목록 조회에도 같은 정책이 적용되므로 남의 숨긴 파일이나 연결 안 된 파일은 보이지 않는다. 정책용 `game_path` 인덱스를 추가했다. 클라이언트는 이미 인증된 `download()`를 쓰고 있어서 주석만 고쳤다. 캐시는 `cacheControl "0"`으로 바꿨다 | SQL 521-557, 63 · `src/lib/community.ts` 228, 285 부근 |
| **L1** CSP 무력화 | 업로드 HTML을 파싱하거나 수정하지 않는 구조로 바꿨다. 바깥 sandbox iframe의 srcdoc은 **고정 래퍼 문서**이고, `<head>` 맨 앞에 CSP meta가 있다. 게임 HTML은 래퍼 안에 있는 중첩 iframe(`sandbox="allow-scripts"`)의 **srcdoc 속성값**으로만 들어간다(`&`, `"` 이스케이프). about:srcdoc은 부모 CSP를 물려받기 때문에 주석 트릭도, 게임이 직접 넣은 느슨한 CSP도 통하지 않는다. 래퍼는 포커스를 게임 iframe으로 넘기는 고정 스크립트 한 줄만 가진다 | `src/lib/community.ts` 344 (`buildSandboxDocument`), `game-player.tsx` |
| **L2** iPad 무한 루프 | ① 상세와 **미리 해보기 모두** 처음엔 멈춰 있고 "게임 시작"을 눌러야 실행된다(`autoStart` 제거). ② 실행 중 부모 화면이 2.5초 넘게 멈췄다 풀리면 "정지를 눌러 주세요" 안내를 띄운다. ③ 실행 중 표시를 sessionStorage에 남겼다가 정상 종료나 `pagehide` 때 지운다. 탭이 멈춰 강제로 닫혀 표시가 남아 있으면, 다음에 열 때 "지난번에 화면이 멈췄을 수 있어요"라고 경고한다. ④ 플레이어 옆과 업로드 안내문에 "멈추면 탭을 닫았다 다시 열기"와 "while(true) 주의"를 적었다. **실제 iPad에서는 확인하지 못했다** | `game-player.tsx` 23-90, 200 · `game-upload-field.tsx` 121 |
| **L3** 숨긴 글 좋아요 노출 | likes SELECT 정책을 "볼 수 있는 글의 좋아요만"으로 바꿨다 | SQL 285-293 |
| **L4** 숨긴 댓글 신고·존재 확인·자기 신고 | SECURITY DEFINER 트리거에서 존재 검사(`comment_post_mismatch`)를 **없앴다**. INSERT 정책(호출자 RLS)이 검사한다: 볼 수 있는 글인지, 댓글이 그 글의 것이고 내가 볼 수 있는지, 내 글·댓글이 아닌지. 숨긴 댓글과 없는 id가 똑같이 403을 받으므로 존재 여부를 알아낼 수 없다. UI는 "신고할 수 없는 댓글이에요…"라고 안내한다 | SQL 368-401, 411-440 · `report-dialog.tsx` 95 |
| **L5** 삭제하면 신고도 사라짐 | `post_id`, `comment_id`를 `on delete set null`로 바꿨다(`post_id`는 nullable). 신고할 때 트리거가 `target_kind/title/body/author_id` 스냅샷을 저장한다. 중복 방지 unique는 부분 인덱스 2개로 나눴다(null이 되면서 충돌하지 않게). 관리자가 삭제할 때는 먼저 관련 신고를 처리 완료로 옮긴다(`resolve_community_reports_for(..., p_include_comments)`). 신고 목록에는 "(삭제된 게임) 제목", "(삭제된 댓글) 내용", 작성자가 표시된다. 재실행해도 안전하도록 `add column if not exists`와 FK·check drop/add를 넣었다 | SQL 322-365, 481-508 · `community-moderation.tsx` 57-71, 225-250, 460-470 |
| **L6** 쿼터·고아 파일·관리자 교체 | (a) 파일을 올리기 전에 **내 폴더에서 어느 글에도 연결되지 않은 파일(10분 넘은 것)**을 자동으로 지운다. (b) 한도는 **게임 글 30개**다(트리거 `game_limit`). Storage 파일은 교체와 정리에 쓸 여유분을 두고 35개까지 허용해서, 30개 상태에서도 파일을 바꿀 수 있다. (c) 트리거가 게임 파일 폴더 = 로그인 사용자 = **글 작성자**인지 확인하므로, 관리자는 남의 게임 파일을 자기 폴더 파일로 바꿀 수 없다. 수정 화면에서도 관리자가 남의 게임을 고칠 때는 파일 선택을 잠그고 안내한다 | SQL 84-106, 545-557 · `community.ts` 228-285 · `community-post-form.tsx` 118 · `game-upload-field.tsx` |
| I1 | 정정: CSP `frame-src`는 URL 프레임에만 적용된다. about:srcdoc 중첩 프레임은 sandbox와 CSP를 물려받아 무해하다(아래 시험에서 확인). 코드 주석에 반영했다 | `community.ts` GAME_CSP 주석 |
| I2 | SQL 머리말에 확인 쿼리 5)를 추가했다 | SQL 20-22 |
| I3, I4 | 변경 없음. I4는 저장소 루트 `.next`의 오래된 타입 탓이며, 새로 빌드한 복사본에서는 tsc가 통과한다 | — |

## 보안 재시험 결과

**샌드박스 (Chrome 153 headless, `buildSandboxDocument` 원본 소스를 그대로 사용한 독립 하네스)**. 부모에는 localStorage `sb-x-auth-token=SECRET`과 cookie를 넣었다.

| 시험 | 결과 |
|---|---|
| 대조군: 래퍼 없이 넣은 같은 게임의 `data:` 중첩 iframe | **실행됨** (시험이 차이를 잡아내는지 확인하는 용도) |
| 래퍼를 쓴 일반 게임의 `data:` 중첩 iframe | 차단 |
| **L1 우회 ① `<!-->`** + script + `--><!doctype>` | **차단** (예전에는 우회됐음) |
| **L1 우회 ② `<!-- --!>`** | **차단** |
| 게임 자체 CSP `frame-src *` | 차단 (래퍼 CSP가 계속 적용됨) |
| 속성 탈출 `"></iframe><script>` | 래퍼 주입 없음. 스크립트는 게임 문서 안에서만 실행됨 |
| `&amp; &quot; <tag>` 원문 복원 | 원문 그대로 |
| localStorage, cookie, parent/top.document, top.location 읽기·이동 | 모두 SecurityError. `origin="null"` |
| `window.open` / `alert` | null / 대화상자 안 뜸 |
| 게임 안의 srcdoc 중첩 프레임 | origin null, localStorage 차단 |
| 무한 루프 → iframe 제거 | 부모 타이머 최대 간격 51ms, 2초 뒤 제거 정상 (데스크톱 Chrome) |

**앱 e2e (가짜 Supabase + 정적 빌드 + 전용 headless Chrome, 47개 항목 모두 PASS, 콘솔 오류 0)**
- M1: 숨긴 게임 파일 내려받기는 비로그인과 다른 학생 모두 **거부**, 작성자와 관리자는 허용. 공개 URL은 거부. 비로그인 목록에는 보이는 파일 1개만 나오고 숨긴 파일과 연결 안 된 파일은 나오지 않음. 상세 화면에서 다른 학생은 "찾을 수 없어요", 작성자는 실행 가능.
- 게임 실행: download → 래퍼 srcdoc(CSP가 맨 앞) → 중첩 sandbox. rAF 동작, **"게임 시작" 뒤 방향키 3회가 게임에 전달**됨(포커스 넘김), origin null, `data:` 중첩 차단.
- L2: 자동 실행 안 함(상세, 미리 해보기), 멈춤 안내, 강제 종료 흔적 경고, 정상 새로고침 때는 경고 없음.
- L3: 숨긴 글의 좋아요 0행, 보이는 글은 정상.
- L4: 자기 글·자기 댓글 신고 403. 숨긴 댓글과 없는 id는 같은 403. UI 신고 성공.
- L5: 작성자가 댓글과 글을 지워도 신고 2건이 남고 스냅샷이 보존됨. 관리자 목록에 "(삭제된 게임) 보이는 게임", "(삭제된 댓글) 나쁜 댓글" 표시.
- L6: 관리자가 남의 파일을 자기 폴더 파일로 바꾸려 하면 `game_path_owner`로 거부되고 UI도 잠김. UI로 새 게임을 올리면 오래된 고아 파일이 지워지고 연결된 파일은 남음. 저장 MIME은 text/plain.
- 375px, 768px(태블릿), 다크 모드, 데스크톱 다크에서 가로 스크롤 없음. 관리자 태블릿 다크도 확인.
- `npm run lint` 통과. 스크래치 복사본에서 `next build`(24개 라우트)와 `tsc --noEmit` 통과.

**한계**
- 로컬 Postgres가 없어서 **SQL을 실제로 실행하지 못했다.** RLS는 가짜 서버에서 같은 규칙으로 흉내 냈을 뿐이다.
- **iPad/iOS Safari는 확인하지 못했다.** 게임이 같은 스레드에서 돌면 무한 루프가 탭을 멈추게 하고, 이 경우 정지 버튼도 동작하지 않는다. 이번 수정은 "처음엔 멈춤, 안내, 다음 방문 때 경고"로 피해를 줄이는 것까지다. WebKit이 srcdoc에 CSP를 물려주는지도 확인하지 못했다. 다만 CSP는 심층 방어이고 핵심 경계는 sandbox다.
- srcdoc 문서는 원래부터 항상 표준 모드다(doctype이 없어도 쿼크 모드가 아님). 이번 변경으로 달라진 동작이 아니다.

## 사용자가 할 일
1. Supabase SQL Editor에서 `supabase/migrations/20260922040000_community.sql` 전체를 실행한다(다시 실행해도 안전).
2. 버킷을 확인한다: `select id, public, file_size_limit, allowed_mime_types from storage.buckets where id='game-uploads';` 결과가 **public = false**, 2097152, text/plain 계열이어야 한다. 대시보드 Storage > game-uploads에 "Public" 표시가 **없어야** 한다.
3. Storage 정책을 확인한다: `select policyname, cmd, roles, qual from pg_policies where schemaname='storage' and tablename='objects';`에서 `bucket_id` 조건이 없는 넓은 정책이 없어야 한다(I2).
4. 실제 점검: 게임 하나를 올리고 관리자로 숨긴다. 그다음 로그아웃 상태(또는 다른 학생 계정)에서 그 게임 주소를 열어 "찾을 수 없어요"가 뜨는지 본다. `…/storage/v1/object/public/game-uploads/<경로>`를 새 탭에서 열면 오류가 나야 한다.
5. 실제 iPad에서 `setTimeout(()=>{while(true){}},500)` 게임으로 멈춤 증상과 안내 문구를 확인한다.
