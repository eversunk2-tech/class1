# Review — 선생님 글 본문 주소 링크 (커밋 `be83554`, 2026-09-26)

> 지침 `docs/classes/review-links-instructions.md`. 코드는 고치지 않았다(이 보고서만 새로 씀). 판정은 **커밋 내용**으로 했다(`git show be83554:<경로>`, `git archive be83554` 사본을 스크래치에서 빌드). 작업 트리의 `teacher-posts.tsx`(쪽 나누기 작업 중)는 보지 않았다.

## 0. 한 줄 판정
높음 0 · 중간 0 · 낮음 4 · 참고 5. http·https만 링크가 되고(href = `new URL`로 정규화한 값, 새 창 + `rel="noopener noreferrer nofollow"`), HTML 해석·스킴 속임·되돌림 폭발은 없다. 사용자 예시 `https://terms.naver.com/`은 홈·관리자 목록 모두 정확히 링크가 된다. 글자는 한 글자도 바뀌지 않는다.

## 1. 발견

| # | 심각도 | 파일:행 | 무엇 | 재현 | 제안 |
|---|---|---|---|---|---|
| L1 | 낮음 | `src/components/linkified-text.tsx:61` | 스크린리더용 `<span class="sr-only"> (새 창에서 열려요)</span>`가 **복사한 글자에 섞인다**. 본문을 선택해 복사하면 `https://terms.naver.com/(새 창에서 열려요) 에서 찾아요.`, 괄호 안 주소는 `(https://example.com/a(새 창에서 열려요))` — 붙여 넣은 주소가 깨진다. 홈·관리자 목록 모두. | 본문 `<p>` 전체 선택 → `getSelection().toString()`에 링크 수(9)만큼 들어감. 관리자 목록도 같음. (iPad에서 링크를 길게 눌러 '링크 복사'는 href라 괜찮다.) | span에 `select-none` 한 단어 추가. 같은 시험에서 `user-select:none`을 넣으면 복사 글자 = 원문(0번), 접근성 이름은 그대로. |
| L2 | 낮음 | `src/app/admin/(dashboard)/notices/notices-view.tsx:411-416` | 관리자 목록의 접힌(`line-clamp-3`) 긴 본문에서 **보이지 않는 4줄째 이후 링크에도 Tab 초점이 간다**. 초점이 가면 브라우저가 접힌 `<p>`를 스크롤해 '넷째~여섯째 줄'이 보이고, 초점이 떠나도 그대로 남는다(버튼은 여전히 '본문 모두 보기'). 이 커밋 전에는 본문 안에 초점 가는 것이 없었다. 교사 화면만. | 6줄 본문(6줄째에 주소) → 그 링크에 초점 → `p.scrollTop` 0→60. 스크린숏 `scratchpad/review-links/shots/admin-light-clamp-focus.png`. | 접힌 동안(`long && !open`)은 `n.body`를 글자로만 그리고, 펼쳤거나 짧은 글만 `<LinkifiedText>`. |
| L3 | 낮음 | `linkified-text.tsx:10-11` | 알려진 한계(주석에 적힌 설계 선택). 한글이 **디코딩된 채** 든 주소는 한글 앞에서 끊긴다 — `https://ko.wikipedia.org/wiki/태양` → 링크는 `…/wiki/`까지(다른 쪽으로 감), `…search.naver?query=태양계` → 검색어 빠짐, 한글 도메인은 링크 안 됨. 전각 `）」》！？`·`~`·이모지를 주소에 **붙여** 쓰면 그 글자가 주소에 들어가 잘못된 곳으로 간다(`…/a%EF%BC%89` 등). 어느 경우도 화면 글자는 그대로. | 단위 시험 '한계' 10건(§2 항목 2). 주소창에서 복사한 주소(한글이 `%…`)는 정상. | 쓰기 칸 안내에 "주소는 주소창에서 복사해 붙이고, 주소 뒤는 한 칸 띄어 주세요" 정도. 원하면 끝 문장부호 목록과 제외 목록에 전각 `）」』》〉！？～` 추가(경로 속 한글은 조사와 구별이 안 돼 지금처럼 두는 편이 안전). |
| L4 | 낮음 | `notices-view.tsx:612` | 쓰기 칸 안내 "https://로 시작하는 주소는 누르면 열리는 링크가 돼요." — `http://`도 링크가 되고, 새 창에서 열린다는 말이 없다(CLAUDE.md 작업 트리의 규칙 줄은 "http·https 주소만 새 창 링크"). | 읽어서. | "http:// 또는 https://로 시작하는 주소는 누르면 새 창에서 열려요." |

참고(발견 아님)
* R1 속도: 끝 문장부호·괄호를 떼는 반복(`linkified-text.tsx:13-21`)이 최악의 글에서 2차로 늘어난다(한 주소가 `'.)'` 반복 5,000자 → 54ms, 길이 2배 → 약 4배). 지수적 되돌림은 없고, 교사만 쓰는 글이며 보통 글은 0.1~0.65ms라 문제 아님. 렌더마다 다시 계산(`useMemo` 없음)해도 보통 글이면 1ms 안.
* R2 초점 고리: `ring-ring/60`이 카드 바탕에 1.94:1(밝음)·2.11:1(어두움), 강제 색 모드(윈도 고대비)에서는 고리가 사라진다 — 제목 버튼 등 사이트 공통 방식과 같다(이 커밋 문제 아님).
* R3 밑줄 `decoration-primary/40`: 바탕 대비 1.84:1(밝음)·2.28:1(어두움)로 옅지만 보인다. 링크 글자 자체가 AA이고 굵기 500(본문 400)이라 색만으로 구분하는 것은 아님.
* R4 누르는 영역: 문장 속 링크는 줄 높이(약 25px) — WCAG 2.5.8의 문장 속 링크 예외. 주소를 줄마다 쓰면 줄 간격이 곧 간격.
* R5 문서: `src/lib/notices.ts:12` 주석("글자 그대로 … 텍스트로만 그린다")이 링크 뒤로 조금 낡음. CLAUDE.md '홈 선생님 글' 줄의 링크 규칙은 작업 트리에만 있고(커밋 전) 내용은 구현과 맞다.

## 2. 항목 1~5 판정과 수치

**1. 안전 — 통과.** 정규식은 `http(s)://`로 시작하는 곳만 잡고, 링크는 `new URL()`의 `protocol`이 `http:`/`https:`이고 호스트가 있을 때만(`href = u.href`). `javascript:`·`JaVaScRiPt:`·앞 공백/탭/줄바꿈·`java\nscript:`·NUL·`data:`·`vbscript:`·`http://javascript:alert(1)`·`http:/`·`http:\\` → 링크 0. `javascript:alert('http://x.com')`은 `http://x.com`만 링크(스킴은 http). `<a href="javascript:…">https://…</a>`·`<script>` 글자 → 브라우저에서 요소 0·실행 0, 페이지 전체 `javascript:`/`data:`/`vbscript:` href 0개. 모든 링크 `target="_blank"` + `noopener noreferrer nofollow`. 속도(Node 24, 5,000자 = 본문 최대): 안내 글+주소 44개 0.10ms, 주소 128개 0.13ms(최대 0.65), 짧은 주소 454개 0.19ms, 주소 하나 5,000자 0.01ms; 일부러 만든 최악 — 닫는 괄호 4,980개 22ms, `'.)'` 반복 54ms(최대 65), 마침표 4,980개+끝 글자 26ms. 2차 증가(1,014자 1.9ms → 8,014자 127ms), 지수 폭발 없음.

**2. 정확 — 통과.** 단위 시험 72건 모두 기대대로(안전 23 · 정확 39 · 한계 10), 모든 경우 조각을 이으면 원문과 같다. 문장 끝 `. , ! ? ; : … ...`, 곧은·굽은 따옴표, `( )`·`[ ]`·`< >`로 감싼 주소, 위키 짝 괄호 `…/Sun_(star)`(다시 괄호로 감싸거나 뒤에 마침표가 붙어도), 마크다운 꼴 `[자료](https://…)`, 붙여 쓴 한글·자모(`…/에서`, `…ㅋㅋ`), 한 줄에 여러 개(공백·탭·NBSP·전각 공백·줄바꿈), 쿼리·조각 `?a=1&b=2#x`, 포트(`:8443`, `localhost:3000`), 대문자·섞인 스킴(`HTTPS://EXAMPLE.COM/Path` → `https://example.com/Path`), 퍼센트 인코딩, 지식백과 실제 주소 꼴, 주소만 있는 글, `http://`만 있는 글(링크 없음). 한계는 L3.

**3. 화면·접근성 — 통과(L1·L2 제외).**
* 링크 글자 대비(카드 바탕 위): 홈 밝음 5.72:1(#6C4DD6/#FFF), 어두움 7.66:1(#AA9DFF/#171717) · 관리자 밝음 6.08:1, 어두움 7.57:1 — 모두 AA. 밑줄 있음, 굵기 500.
* 초점: 제목 버튼에서 Tab → 첫 링크, `:focus-visible` 3px 고리(R2). 닫힌 글의 링크는 `hidden`(display:none)이라 초점이 가지 않는다.
* 스크린리더: 접근성 이름 "https://terms.naver.com/ (새 창에서 열려요)", 역할 link(링크 9개 모두 문구 있음).
* 휴대폰 375: 약 370자 주소가 13줄로 꺾이고 문서 가로 폭 375 = 화면, 본문 칸 `scrollWidth 263 = clientWidth`, 링크 오른쪽 끝 314 ≤ 칸 319. 스크린숏 `scratchpad/review-links/shots/home-mobile-375-long-url.png`.
* 제목 버튼과 링크: 링크는 버튼 밖(서로 포함 안 함), 링크 자리의 `elementFromPoint` = 링크, 버튼 아래 19px. 링크를 누르면(시험에서는 링크에서 이동을 취소) 본문은 열린 채, 새 탭 0. 관리자: 쓰는 중에 목록 링크를 눌러도 '떠날까요?' 창 0(새 창 링크는 가드가 건너뜀 — `notices-view.tsx:141`), 쓰던 제목 그대로.
* 어두운 화면·로그인 학생 홈(링크 9개·새 창)도 같음. 콘솔 오류 0.

**4. 범위 — 통과.** `LinkifiedText` 사용처는 홈 `teacher-posts.tsx:187`과 관리자 목록 `notices-view.tsx:415` 두 곳뿐(커밋·작업 트리 모두). 커밋이 바꾼 파일은 3개. 자유게시판 글(`community-post-detail.tsx:216`)·댓글(`community-comment-section.tsx:362`, `comment-section.tsx:166`)·피드백·학생 응답은 그대로 React 글자(블로그 글 마크다운 뷰어는 예전부터 marked+DOMPurify — 이 커밋과 무관).

**5. lint·tsc — 통과.** 작업 트리: `npm run lint` exit 0(오류·경고 0), `npx tsc --noEmit` exit 0. 커밋 사본: 바뀐 3파일 eslint exit 0, `next build`(TypeScript 검사 포함) 성공·25쪽 생성.

## 3. 시험 방법·차단
* 단위: 커밋 파일에서 함수 부분만 떼어(`unit/linkify-core.ts`, 글자 그대로 + export만) Node 24로 실행 — `unit/cases.ts`(72건), `unit/perf.ts`.
* 화면: `git archive be83554` 사본을 스크래치에서 빌드(저장소 `out/` 안 씀). 사본에만: 가짜 Supabase 주소·키(번들 속 Supabase 주소는 가짜 하나뿐 확인), `NEXT_TELEMETRY_DISABLED=1`, 구글 글꼴(Geist)은 이전 빌드 사본을 `NEXT_FONT_GOOGLE_MOCKED_RESPONSES`로 자기 서버에서 공급(인터넷에서 받지 않음), node_modules 링크 때문에 `turbopack.root="/"`.
* 자기 정적 서버 8786, 자기 headless Chrome(CDP 9360, 프로필 스크래치 `review-links/chrome-profile`) `--host-resolver-rules="MAP * ~NOTFOUND, EXCLUDE 127.0.0.1"`(supabase·terms.naver.com·example.com 모두 막힘 — 가로채지 않은 탭으로 확인), 탭마다 첫 이동 전 CDP `Fetch` 가짜 응답(도구는 `scratchpad/notices/`의 `lib2.mjs`·`backend.mjs`를 복사해 포트·주소만 바꿈), 캐시 끔. 브라우저 시험 35건 중 34 통과(실패 1 = L1), 외부 요청 0·콘솔 오류 0. 링크는 한 번도 따라가지 않음(누름 시험은 링크 자체에서 이동 취소, 새 탭 수 확인).
* 설치·내려받기·git commit/push·실 DB 쓰기·`localStorage.clear()` 0. 다른 포트·프로세스 손대지 않음. 서버·Chrome 종료. 스크래치 폴더 `…/scratchpad/review-links/`(약 176MB, 빌드 캐시 포함)는 이 프로젝트에서 `rm -rf`가 막혀 남겨 둠(node_modules 링크는 지움). 스크린숏 `review-links/shots/`.

## 4. 확인하지 못한 것
* 실제 iPad Safari·크롬북: 링크를 눌러 새 탭 열기, 길게 눌러 나오는 메뉴, 글자 선택·복사(L1 `select-none`이 Safari에서도 복사에서 빠지는지), VoiceOver 읽기.
* 실제로 terms.naver.com 등으로 이동하는 것(규칙상 누르지 않음 — 속성만 확인).
* 실제 Supabase 데이터·실제 교사가 쓴 글(모두 가짜 응답), 윈도 고대비 실기기(강제 색은 에뮬레이션으로만).

**배포해도 됨** — 높음·중간이 없다: http·https만 새 창 링크가 되고 HTML 해석·스킴 속임·되돌림 폭발이 없으며, 사용자 예시가 홈·관리자에서 정확히 동작하고 대비 AA·스크린리더 문구·375 꺾임·범위·lint·tsc가 모두 통과했다. 낮음 L1(복사에 안내 문구 섞임 — `select-none` 한 단어)·L4(안내 문구)는 쉬워 함께 고치면 좋고, L2·L3은 뒤에 해도 된다.
