# Review: 자유게시판 · 학습게임 업로드 · 신고 · 메뉴/홈 개편

검토자: 독립 Review 서브에이전트 (구현에 참여하지 않음). 기준: `spec.md` §13 우선, 그다음 §4·§5.
코드 수정, git 조작, 실제 DB/Storage 쓰기는 하지 않았다. 실제 Supabase에는 anon key로 **읽기와 거부돼야 하는 요청만** 보냈다.

## 요약

| 심각도 | 개수 |
|---|---|
| Critical | 0 |
| High | 0 |
| Medium | 1 |
| Low | 6 |
| Info | 4 |

**결론**: 업로드 게임 샌드박스의 핵심 경계는 제대로 동작한다. 경계는 `sandbox="allow-scripts"` + `srcdoc`, 불투명 출처, 그리고 렌더링 경로가 하나뿐이라는 점이다. Storage의 Content-Type은 버킷의 `allowed_mime_types`로 서버에서 강제된다. SQL/RLS는 줄 단위로 읽었고 문법·재실행 안전성·권한 모델에서 막히는 오류는 찾지 못했다.
주요 문제는 두 가지다. 하나는 **숨긴 게임 파일이 공개 버킷을 통해 누구에게나 열람·나열된다는 점(M1)**이다. 다른 하나는 방어용 CSP meta를 HTML 주석 파싱 차이로 무력화할 수 있다는 점이다(L1, 실제로 재현했고 sandbox 경계에는 영향이 없다). 배포 전에는 M1을 고치는 것을 권장한다. 나머지는 후속 작업으로 처리해도 된다.

## 보안 테스트 표

Chrome 153(headless)에서 실행했다. 하네스는 `buildSandboxDocument`와 `GAME_CSP`를 그대로 옮겨 만든 독립 페이지다. 부모 페이지의 localStorage에 `sb-x-auth-token=SECRET`, cookie에 `c=1`을 넣은 상태에서 확인했다.

| 공격 | 방법 | 결과 |
|---|---|---|
| 부모 DOM 접근 | iframe에서 `parent.document.title` | SecurityError, 차단 |
| top 이동 | `top.location.href` 읽기/쓰기 | SecurityError, 차단 |
| 세션 토큰 탈취 | `localStorage.length`, `document.cookie` | SecurityError, 차단 (`self.origin === "null"`) |
| 팝업 | `window.open('about:blank')` | `null`, 차단 |
| 중첩 iframe (URL, data:) | 정상 문서 안에서 `iframe.src='data:text/html,…'` | **CSP frame-src로 차단됨(대조군)** |
| 중첩 iframe (srcdoc) | `iframe.srcdoc='<script>…'` | **실행됨**. CSP `frame-src`는 about:srcdoc에 적용되지 않는다. 다만 sandbox를 상속하므로 불투명 출처가 유지되어 무해하다 (Info I1) |
| CSP 우회 ① | 업로드 HTML 앞에 `<!-->` + `<script>` + `--><!doctype html>` | **우회됨**. 정규식은 전체를 주석 하나로 보고 meta를 doctype 뒤(body 안)에 넣는다. 브라우저는 `<!-->`를 빈 주석으로 끝내므로 script가 먼저 실행되고, meta는 body에 들어가 무시된다. 그 결과 data: 중첩 iframe이 실행됐다 (L1) |
| CSP 우회 ② | `<!-- a --!>` + script + `<!-- --><!doctype html>` | **우회됨**. 원인은 ①과 같다 (L1) |
| 부모 쪽 postMessage 조작 | 앱 전체에서 `message` 리스너 grep | 앱 코드에 리스너가 없다. iframe이 보내는 메시지를 받는 곳이 없음 |
| 무한 루프 → 정지 | 게임에서 `while(true){}` 실행, 부모에서 50ms 타이머 측정 후 2초 뒤 iframe 제거 | Chrome 153 데스크톱: 부모 타이머 최대 간격 51ms, 제거(정지) 정상. 샌드박스 iframe이 별도 프로세스로 격리된다. **iPad Safari는 확인하지 못함** (L2) |
| 다른 렌더링 경로 | `srcDoc`, `dangerouslySetInnerHTML`, `getPublicUrl`, `createObjectURL`, `window.open`, `target=_blank` 전수 grep | 업로드 HTML은 `GamePlayer` 한 곳에서만 렌더링된다(상세 화면과 업로드 미리보기). 관리자·신고 화면에서는 `game_path`를 삭제에만 쓰고 렌더링하지 않는다. 기존 `dangerouslySetInnerHTML`은 테마 초기화 스크립트와 DOMPurify를 거친 마크다운뿐 |
| Storage Content-Type 변경 | SQL 검토: 버킷 `allowed_mime_types = text/plain 계열`, update 정책 없음(move와 upsert 불가) | 클라이언트가 `text/html`로 올리면 서버에서 거부된다. copy는 원본 MIME을 유지하고 대상 경로 정책이 적용된다. 실제 Storage 응답 헤더(anon, 없는 객체): `content-type: text/plain`, `x-content-type-options: nosniff`, `content-security-policy: default-src 'none'; sandbox`. 다만 **실제 객체 응답의 헤더는 버킷이 아직 없어 확인하지 못했다** |
| 권한 없는 RPC | anon으로 `rpc/set_community_post_hidden` 호출 | 404(함수 없음, SQL 미실행). 코드상으로는 `revoke … from public, anon`에 함수 안 `is_admin()` 검사도 있다 |
| 실제 DB 상태 | anon으로 `community_posts`/`community_reports` 읽기, 버킷 조회 | PGRST205 / Bucket not found. **마이그레이션이 아직 실행되지 않음**. 화면에는 "준비 중" 안내가 나온다 |

## 문제 표

| # | 심각도 | 위치 | 현상 | 재현 | 수정 제안 |
|---|---|---|---|---|---|
| M1 | Medium | `supabase/migrations/20260922040000_community.sql:428-438` | `game-uploads`는 **public 버킷**이고, SELECT 정책이 `to` 없이 `bucket_id='game-uploads'`만 검사한다. 그래서 anon을 포함한 누구나 `storage.from('game-uploads').list('<uid>')`로 모든 사용자 폴더의 파일을 나열하고 내려받을 수 있다. 공개 URL은 RLS 없이 열린다. **관리자가 숨긴 게임, 신고받아 숨긴 게임의 HTML도 그대로 열람된다.** spec §2의 "숨김은 작성자·관리자만"을 위반한다. 실행은 되지 않지만(text/plain) 부적절한 내용 자체가 노출된다 | SQL 실행 후 anon으로 `POST /storage/v1/object/list/game-uploads {prefix:"<작성자 uid>"}` → 숨긴 게임 경로 확인 → `/object/public/game-uploads/<path>` 요청 | 버킷을 **private**(`public=false`)으로 바꾼다. SELECT 정책은 `exists (select 1 from public.community_posts p where p.game_path = name and (not p.hidden or p.author_id = auth.uid() or public.is_admin()))` 또는 본인 폴더로 제한한다. 업로드 직후 글 연결 전 단계는 본인 폴더 조건으로 허용한다. 클라이언트는 이미 `download()`(인증 엔드포인트)를 쓰므로 코드 변경이 거의 없다. 이렇게 하면 "공개 URL을 직접 여는" 경로 자체도 사라진다 |
| L1 | Low | `src/lib/community.ts:279-287` (`buildSandboxDocument`) | doctype 앞 주석을 `<!--[\s\S]*?-->`로 판정한다. 그런데 HTML 파서는 `<!-->`, `<!--->`, `--!>`로도 주석을 끝낸다. 업로드 HTML이 이 차이를 이용하면 script를 우리 meta보다 먼저 실행하고, meta를 body로 밀어내 **CSP 전체를 무력화**할 수 있다. sandbox가 핵심 경계라서 세션·부모 접근에는 영향이 없다. 무력화되는 것은 심층 방어(frame-src, object-src, form-action, base-uri)뿐이다 | 보안 테스트 표의 "CSP 우회 ①·②". data: 중첩 iframe이 대조군에서는 차단되고 우회 문서에서는 실행됐다 | 부모 쪽 `DOMParser`로 파싱한다(`text/html` 파싱은 스크립트를 실행하지 않음). 그다음 `doc.head.prepend(meta)`를 하고 `'<!doctype html>' + doc.documentElement.outerHTML`로 직렬화한다. 또는 doctype 앞에 `-->`/`<` 외 내용이 있으면 meta를 맨 앞에 두는 식으로 보수적으로 처리한다 |
| L2 | Low | `src/components/community/game-player.tsx:91-96` (정지) | 정지는 부모의 메인 스레드가 살아 있어야 동작한다. Chrome 데스크톱은 샌드박스 iframe을 별도 프로세스로 돌려 정상이었다. 하지만 **iPad/iOS Safari(WebKit)는 iframe을 같은 프로세스·스레드에서 실행할 가능성이 높다.** 그러면 `while(true){}` 한 줄로 탭 전체가 멈추고 정지 버튼도 눌리지 않는다. 학급 주 기기가 태블릿이다. spec §4.3이 이미 잔여 위험으로 인정한 항목이지만 실제 기기 검증이 없다 | 실제 iPad에서 `setTimeout(()=>{while(true){}},500)` 게임을 업로드해 실행 | 실제 iPad에서 확인한다. 멈추면 안내 문구("화면이 멈추면 탭을 닫았다 다시 열어요")를 플레이어 옆에 추가한다. 관리자 숨김으로 재발을 막는다 |
| L3 | Low | `…community.sql:268-271` | `community_likes` SELECT가 `using (true)`이고 anon에게도 허용된다. 그래서 숨긴 글의 좋아요 행(post_id, user_id)이 공개되어 숨긴 글의 id와 좋아요 누른 사람이 새어 나간다 | anon으로 `GET /rest/v1/community_likes?select=*` | `using (exists (select 1 from public.community_posts p where p.id = post_id))`. community_posts의 RLS가 숨김을 걸러 준다 |
| L4 | Low | `…community.sql:314-334, 348-359` | `community_reports_guard`는 SECURITY DEFINER로 댓글 존재 여부를 확인한다. 그래서 (a) 볼 수 없는 **숨긴 댓글도 신고할 수 있다**. (b) 오류 메시지 차이(`comment_post_mismatch` 대 성공/중복)로 숨긴 댓글 id가 존재하는지 확인할 수 있다(uuid를 알아야 해서 실질 위험은 낮음). (c) DB에서는 자기 글·댓글 신고도 막지 않는다(UI만 막음) | 직접 REST insert | INSERT 정책 `with check`에 `comment_id is null or exists (select 1 from public.community_comments c where c.id = comment_id and c.post_id = post_id)`를 추가한다(invoker RLS 적용). 원하면 작성자 본인 제외 조건도 넣는다 |
| L5 | Low | `…community.sql:300-301` (`on delete cascade`) | 신고받은 사람이 **자기 글·댓글을 지우면 신고가 cascade로 함께 사라진다.** 관리자는 신고 기록을 볼 수 없다(괴롭힘 댓글을 쓰고, 신고되면 지우는 패턴) | 학생 B가 A의 댓글을 신고 → A가 댓글 삭제 → 관리자 신고 목록이 비어 있음 | `on delete set null`로 바꾸고, 신고 시점의 대상 제목·본문 스냅샷(`target_snapshot text`)을 트리거로 저장한다. 또는 관리자에게 "삭제된 대상" 표시를 한다 |
| L6 | Low | `…community.sql:448-451`, `community-post-form.tsx:132-155`, `community-post-detail.tsx:141` | 파일 수 30개 제한이 **Storage에 남은 파일 수**를 센다. (a) 정리에 실패한 고아 파일(네트워크 오류, `removeGameFile` 실패 무시)도 영구히 쿼터를 차지하고, 사용자가 지울 UI가 없다. (b) 30개 상태에서는 "새로 올리고 옛 파일 삭제" 순서라 수정도 불가능하다. (c) 관리자가 학생 게임 파일을 교체하면 새 파일이 **관리자 폴더**에 올라간다. 이후 작성자가 글을 지워도 그 파일은 지우지 못해 고아가 된다 | 코드 경로 추적 | 쿼터를 "연결된 글의 파일 수"로 센다(`community_posts`의 `game_path` 기준). 관리자 화면에 고아 파일 정리 기능을 두거나, 관리자 교체 시 원작성자 폴더 규칙을 문서화한다 |
| I1 | Info | `build-report.md` 보안 표 "중첩 iframe … 차단" | CSP `frame-src 'none'`은 about:srcdoc/about:blank 중첩 프레임에 적용되지 않는다(직접 실행해 확인). 그래서 "중첩 iframe 차단"은 URL 프레임에만 맞는 말이다. 중첩 프레임은 sandbox를 상속하므로 위험하지 않다 | 보안 테스트 표 | 보고서 문구만 정정한다 |
| I2 | Info | Supabase 대시보드(코드 밖) | `storage.objects` 정책은 OR로 합쳐진다. 대시보드에서 따로 만든 넓은 정책(예: "authenticated는 모든 버킷에 insert/update")이 있으면 경로·개수·덮어쓰기 제한이 무력화된다. anon으로는 확인할 수 없다 | — | 실행 후 `select policyname, cmd, qual, with_check from pg_policies where schemaname='storage' and tablename='objects';`로 `bucket_id` 조건이 없는 정책이 없는지 확인한다 |
| I3 | Info | `…community.sql:36,51` | `game_size`는 클라이언트가 보낸 값이고 실제 객체 크기와 대조하지 않는다(표시용이라 영향은 미미) | — | 필요하면 트리거에서 `storage.objects.metadata->>'size'`로 확인한다 |
| I4 | Info | `.next/types/validator.ts` | 저장소 루트에서 `tsc --noEmit`을 돌리면 삭제된 `src/app/math/page.js`를 참조하는 옛 dev 생성 타입 때문에 오류 1건이 난다. 코드 문제는 아니다. 다음 `next dev`/`build` 때 다시 생성된다 | `npx tsc --noEmit` | 없음 |

### SQL/RLS 줄 단위 검토 메모 (문제없음으로 판단한 항목)

- **재실행 안전**: `create table if not exists`, 이름 있는 제약 `drop … if exists` 후 `add`, `drop trigger/policy if exists`, `create or replace function`(시그니처 동일), `create [unique] index if not exists`, `on conflict (id) do update`. 기존 객체 중 `community_*`, `game-uploads`와 이름이 겹치는 것은 없다. 앞선 마이그레이션의 `set_updated_at()`, `is_admin()`(SECURITY DEFINER, `search_path=''`)에 의존하는 것도 맞다.
- **작성자 강제**: insert 컬럼 grant에 `author_id`, `hidden`, `user_id`, `reporter_id`, `status`가 없다. 모두 default(`auth.uid()`, `false`, `'open'`)로 채워지고 정책·트리거가 다시 확인한다.
- **hidden 변경 불가**: `revoke all` 후 `update (title, body, game_path, game_size)`와 댓글의 `update (body)`만 grant했다. 관리자도 authenticated 역할이라 PostgREST로는 `hidden`을 바꿀 수 없고, SECURITY DEFINER RPC(함수 안에서 `is_admin()` 검사, `search_path=''`, `revoke from public, anon`)로만 바꾼다. RPC가 update할 때 `community_posts_guard`는 `game_path`가 그대로이므로 통과한다.
- **kind/게임 필드**: 제약이 board면 `game_path/size`를 null로, game이면 `{uuid}/{uuid}.html`, 크기 1..2MB, 설명 1000자 이하로 강제한다. `kind`는 update grant에 없다.
- **남의 파일 연결**: 트리거가 `split_part(game_path,'/',1) = auth.uid()`를 확인한다(INSERT와 경로 변경 UPDATE). `OLD`는 UPDATE 분기에서만 참조한다. 프로필 삭제에 따른 FK `set null` update는 `game_path`가 그대로이므로 통과한다.
- **숨긴 글 노출**: posts, comments, reports의 SELECT/INSERT 정책은 모두 숨김을 반영한다. 댓글·좋아요는 숨긴 글에 새로 달 수 없다. 남은 누수는 L3(likes)와 M1(Storage)이다.
- **신고 조회**: `to authenticated using (reporter 본인 or is_admin())`이고 anon grant는 없다. 상태 변경은 RPC로만 한다(update 정책·grant 없음). 중복 신고는 `coalesce(comment_id, zero-uuid)` 표현식 unique index로 막고, 클라이언트는 23505를 처리한다.
- **속도 제한**: 글 20초, 댓글 5초, 신고 1시간 20건. 모두 BEFORE INSERT SECURITY DEFINER라 RLS로 가려진 행까지 센다. 동시에 들어오는 요청의 경쟁 조건과 다계정은 막지 못한다(spec §11에서 인정한 약한 방어).
- **Storage 경로·덮어쓰기·삭제**: insert는 본인 폴더, 소문자 uuid 형식 경로, 30개 미만일 때만 허용한다(하위 쿼리는 SELECT 정책 아래에서 본인 파일을 센다. 재귀 없음). update 정책이 없어 덮어쓰기와 move가 불가능하다. delete는 본인 폴더 또는 관리자만 할 수 있다. 크기는 `file_size_limit` 2MB로 제한된다.

## XSS 점검

- 게시판 본문: `MarkdownViewer ugc`를 쓴다. marked를 거친 뒤 DOMPurify(html 프로필만 사용, svg/mathml 비활성)를 적용한다. `style`, 폼 요소, `img`, 미디어, `iframe`, `object`, `embed`, `link`, `meta`, 그리고 `style`, `srcset`, `id`, `name` 속성을 금지한다. 정화한 결과를 template으로 한 번 더 직렬화해 링크에 `target=_blank rel=noopener noreferrer nofollow ugc`를 붙인다. 재파싱 mXSS 여지는 html 전용 프로필이라 실질적으로 낮다.
- 제목, 댓글, 게임 설명, 신고 사유·상세, 작성자 이름, 목록 발췌: 모두 React 텍스트 노드로 렌더링된다(`whitespace-pre-wrap`). `document.title`도 텍스트로만 쓴다. 아바타 `img src`는 기존 profiles 패턴과 같다(스크립트 실행 경로 없음).

## 기능 점검

- 메뉴: `menu.ts`에서 수학을 제거하고 자유게시판을 추가했다(`board` 색 토큰은 math 값을 재사용). 소스에 `math-`, `/math`, `MathIllustration`, `PopularPosts`의 잔재가 없다. 사이드바와 드로어는 `menuItems`를 순회한다.
- `/math/`는 404 페이지로 간다(정적 빌드 서버로 확인).
- 홈: 통계 카드는 "과학 차시 앱 12개 · 자유게시판 글 준비 중 · 학습게임 준비 중 · 선생님 글 0개"다. 바로가기는 3개(학습게임, 과학, 자유게시판). 최근 과학 수업의 차시 앱 현황은 "1. 산과 염기 앱 6/6", "2. 물체의 운동 앱 6/6"이다.
- SQL 실행 전: `/board/`, `/games/`, 상세, 홈 통계에 "준비 중이에요 (SQL 실행 필요)" 안내가 뜬다. `/games/new/`는 비로그인 시 로그인 안내를 보여 준다.
- 375px 폭에서 `/`, `/board/`, `/games/`, `/games/new/`, 상세, `/math/` 모두 `scrollWidth = 375`이고 가로 스크롤이 없다. 콘솔 오류는 테이블 미생성 404와 `/math/` 404뿐이다(예상된 것).
- `npm run lint` 통과. `next build`는 스크래치 복사본에서 통과했다(24개 라우트, `/admin/community`, `/board/**`, `/games/**` 포함, `/math` 없음).

## 확인한 것 대 못 한 것

**확인한 것**
- 마이그레이션 SQL 전체를 줄 단위로 검토했다(위 메모). 기존 마이그레이션과의 의존성과 이름 충돌도 확인했다.
- 샌드박스 공격 재현(Chrome 153 headless, 독립 하네스): 부모 DOM, top 이동, localStorage, cookie, 팝업, 중첩 iframe, CSP 우회, 무한 루프와 정지.
- 업로드 HTML의 렌더링 경로를 전수 grep했다(한 곳뿐).
- 실제 Supabase에 anon으로 읽기와 거부 요청: 마이그레이션 미실행 상태, Storage 응답 보안 헤더(nosniff, CSP sandbox).
- lint, 정적 빌드, 375px 가로 넘침, `/math/` 404, "준비 중" 안내, 홈 섹션과 과학 앱 개수.

**못 한 것**
- **실제 Postgres에서 SQL 실행**(로컬 Postgres 없음, 실 DB 쓰기 금지). 문법과 정책 동작은 코드로만 검증했다.
- 실제 Storage 객체의 응답 헤더와, charset이 붙은 MIME에 대한 `allowed_mime_types` 비교 방식(버킷 미생성).
- 로그인 흐름(글쓰기·댓글·좋아요·신고·관리자 숨김/삭제)을 실제 DB로 확인하는 것. 쓰기 금지라 수행하지 않았고, 이 부분은 build-report의 mock 결과에 의존한다.
- iPad/iOS Safari에서 무한 루프 시 정지 버튼 동작(L2), 실제 기기 터치와 전체 화면.
- 태블릿 폭과 다크 모드는 스크린샷으로 육안 확인하지 못했다(375px 넘침만 수치로 확인).
- 대시보드에서 따로 만든 Storage 정책 유무(I2).

## 사용자 조치 권장 순서
1. M1: 버킷을 private으로 바꾸고 SELECT 정책을 가시성과 연동한다. 그다음 SQL을 실행한다.
2. SQL을 실행한 뒤 I2 확인 쿼리를 돌리고, 게임 1개를 올려 객체 응답 헤더(`content-type: text/plain`, `nosniff`)를 확인한다.
3. 실제 iPad에서 무한 루프 게임과 정지 버튼을 확인한다(L2).
4. L1, L3~L6은 후속 패치로 처리한다.
