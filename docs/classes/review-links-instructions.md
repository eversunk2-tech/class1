# 검토 지침(Review links) — 선생님 글 본문 주소 링크 (2026-09-26, 커밋 `be83554`)

당신은 **Review** 담당이다. **코드를 고치지 않는다**(발견만 기록). 사용자가 "검토 끝나면 바로 배포"를 허락했으므로, 배포를 막아야 할 문제는 "높음"으로 분명히.

## 사용자 요청(합격 기준)
"선생님 글 게시판에 https://terms.naver.com/ 이러한 주소를 본문에 적으면 링크로 되어서 학생이 누르면 바로 이동할 수 있도록 수정해줘"

## 대상
`git show be83554` — `src/components/linkified-text.tsx`(새), `src/components/dashboard/teacher-posts.tsx`(홈 본문), `src/app/admin/(dashboard)/notices/notices-view.tsx`(관리자 목록 본문·글쓰기 안내 문구). `CLAUDE.md` 커뮤니티 규칙의 **홈 '선생님 글'** 줄도 읽는다.
(참고: 다른 Build 담당이 지금 `teacher-posts.tsx`에 쪽 나누기를 넣고 있다 — 작업 트리의 그 파일이 커밋과 다를 수 있다. **판정은 커밋 `be83554`의 내용으로**, 파일은 `git show be83554:<경로>`로 읽는다.)

## 확인할 것
1. **안전**: `http`·`https`만 링크가 되는지(`javascript:`·`data:`·`vbscript:`·대소문자 섞기·공백·줄바꿈·제어 문자·`http://javascript:…` 같은 속임), `href`는 `new URL`로 정규화한 값인지, `target="_blank"` + `rel="noopener noreferrer"`, React 텍스트라 HTML이 해석되지 않는지(`<a href=…>` 글자, `<script>`), 아주 긴 글(5000자)·주소가 많은 글에서 정규식이 느려지지 않는지(되돌림 폭발 없음 — 시간 재기).
2. **정확**: 문장 끝 마침표·쉼표·느낌표·물음표·따옴표·괄호, 짝 있는 괄호(위키 주소), 주소 바로 뒤에 붙인 한글, 한 줄에 주소 여러 개, 쿼리·조각(`?a=1&b=2#x`), 포트, 대문자 스킴, 퍼센트 인코딩 주소, 주소만 있는 글, `http://`만 있는 글 — 링크 범위와 **글자가 한 글자도 바뀌지 않는지**(조각을 이으면 원문).
3. **화면·접근성**: 링크 색 대비(밝음·어두움, 카드 바탕 위 AA), 밑줄, 초점 표시, 스크린리더용 "(새 창에서 열려요)", 긴 주소가 칸을 넘치지 않고 꺾이는지(휴대폰 375), 제목 버튼(펼치기)과 링크 누름이 섞이지 않는지.
4. **범위**: 링크가 되는 곳은 선생님 글 본문(홈·관리자 목록)뿐인지 — 다른 사용자 입력(자유게시판·댓글 등)은 그대로 글자인지.
5. `npm run lint`·`npx tsc --noEmit` 통과(작업 트리 기준 — 다른 담당 변경 때문에 실패하면 그 사실만 적는다).

## 테스트 규칙(반드시)
* 조각 나누기 시험은 Node로(`git show be83554:src/components/linkified-text.tsx`에서 함수 부분만 떼어 스크래치에서 실행 — 설치 금지).
* 화면 시험은 필요하면: 커밋 `be83554`를 `git worktree`나 `git archive be83554`로 스크래치에 풀고 **그 안에서** `node_modules`를 저장소 것에 링크해 빌드하거나, 저장소 `out/`을 쓰지 않는다(다른 담당이 빌드 중일 수 있음). 자기 정적 서버(포트 **8786**)·자기 headless Chrome(포트 **9360**, 프로필은 `/private/tmp/claude-501/-Users-sungchul-Desktop-classroom/7bf3a39e-3017-4189-b337-1b82aace66bb/scratchpad/review-links/` 안), `--host-resolver-rules`로 `*.supabase.co`와 링크 시험 주소 호스트(예: terms.naver.com, example.com)를 모두 막고, 첫 로드부터 CDP `Fetch` 가짜 응답, 캐시 끄기. 시험 도구는 `…/scratchpad/notices/`(`lib2.mjs`·`backend.mjs`·`linkcheck.mjs`)를 **자기 폴더로 복사해서** 쓴다. **링크를 실제로 눌러 외부로 나가지 않는다**(속성만 확인). 설치·내려받기 금지, git commit/push·실 DB 쓰기 금지, `localStorage.clear()` 금지, 다른 포트(8785·8788·8789·8792·8793·8796·8797·9353·9356·9358·9359) 건드리지 않기. 끝나면 서버·Chrome 종료.

## 보고서 `docs/classes/review-links.md`
심각도별 발견 표(파일:행, 무엇, 재현, 제안), 항목 1~5 판정과 수치, 확인하지 못한 것 — 한국어로 간결하게. 마지막 줄에 **"배포해도 됨 / 고친 뒤 배포"**와 까닭.
