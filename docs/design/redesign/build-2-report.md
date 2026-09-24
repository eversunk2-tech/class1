# 디자인 개편 2단계 Build 보고서 — 나머지 사이트 화면 (2026-09-24)

지침: `build-2-instructions.md` / 설계: `spec.md` §4.4~4.8(+개정 1), 1단계 보고서(`build-1-report.md` 개정 1·2)의 토큰·컴포넌트 재사용.
git 명령·실 DB 쓰기 없음. 내 전용 headless Chrome(포트 9517, 새 프로필)과 내 서버(개발 3417, 정적 4817)만 썼고 끝나고 모두 종료·정리했다. `localStorage.clear()`를 쓰지 않았다(로그인 흉내용 키 하나만 넣고 지움). 관리자(`/admin/**`)·과학 앱(`public/apps/**`, `scripts/templates/**`) 파일은 건드리지 않았다. 이미지는 새로 받거나 만들지 않았다.

## 1. 결과 요약
* **과학수업**: 히어로에 태블릿 든 부엉이(`owl-tablet`) + 떠 있는 현미경·원자 배지·전구·자석, "실험" 형광펜 강조. 학기·단원 카드는 과학 그라데이션·큰 둥근 모서리·3D 아이콘(단원마다 다른 아이콘), 차시 목록은 흰 둥근 카드 + 번호 칩 + **"실험 앱"(시험관)·"조사 도우미"(돋보기) 배지**, 차시 상세는 그라데이션 판 + 보라 그라데이션 알약 "실험 시뮬레이션 시작하기". 1단계에서 찾은 hover 떠오름 끊김(`transition-[transform…]`)을 `translate`로 고침.
* **자유게시판·학습게임**: 히어로(큰 말풍선·게임기 3D + 떠다니는 소품), "글쓰기/게임 올리기" 보라 알약, 목록 카드(흰 둥근 카드 + 3D 칩, 카드 전체 초점 링), 글 상세(흰 판 + Jua 제목 + 알약 수정/숨기기/삭제/신고), 큰 좋아요 알약, 댓글 판(말풍선 모양), 글쓰기 폼(흰 판·둥근 입력칸·알약 버튼), 게임 파일 칸(점선 상자).
* **게임 실행 화면**: 겉모양만(둥근 게임 그라데이션 판, 3D 게임기, 보라 알약 "게임 시작", 알약 정지/다시 시작/전체 화면). **보안 구조 그대로** — 아래 §5.
* **글 보기·검색**: 흰 읽기 판, Jua 제목, 요약, 태그 보라 알약, 표지 둥근 모서리, 본문 17px·줄 간격 1.9·제목 Jua·링크 보라·인용 옅은 보라(`.markdown-reading`, 이 두 화면에만). 검색은 연보라 머리 판 + 돋보기 3D + 큰 둥근 검색창.
* **로그인·새 비밀번호**: 가운데 둥근 카드 위에 작은 부엉이(`owl-wave`) / 3D 소품(전구·별·반짝이), 둥근 입력칸, 보라 알약 버튼, OAuth 흰 알약. 흐름·문구·리다이렉트는 그대로.
* **내 학습 활동**: 연보라 머리 판, 알약 탭, **요약 카드(완료하면 응원하는 부엉이 `owl-cheer`)**, 기록은 둥근 카드 목록(학생 화면만, 관리자는 표 그대로), 피드백은 말풍선 대화 판, 과제 카드.
* **빈 화면·오류**: `EmptyState`를 둥근 점선 판으로, 옛 상자 그림 대신 **생각하는 부엉이(`owl-think`)**(학생·방문자 화면에만), `ErrorState` 톤 맞춤, 404도 부엉이 + 알약.
* **로그인 잠금**: 전체 화면 안내(`LoginGate`)를 1단계 홈 안내 카드와 같은 모양(옅은 보라 판·흰 자물쇠 칩·알약)으로 통일.
* `npm run lint` · `npx tsc --noEmit` · `npm run build`(24쪽) 통과. 30개 화면 × 4 크기 = **스크린숏 120장**, 가로 스크롤 0, 콘솔 오류 0, 실패 요청 0.

## 2. 바꾼 파일
**신규**
| 파일 | 내용 |
|---|---|
| `src/components/illustrations/prop-stage.tsx` | 히어로 무대(큰 그림 + 빛 + 떠다니는 3D 소품, 좁은 화면은 2~3개만) |
| `src/components/layout/highlight.tsx` | 핵심 낱말 강조(보라 그라데이션 글자 + 형광펜), 섹션 제목(3D 반짝이) |
| `src/components/auth-card-shell.tsx` | 로그인·새 비밀번호 가운데 카드 틀 |
| `src/lib/pill.ts` | 알약 버튼 클래스(보라 주 버튼·흰 보조·돌아가기) |

**수정**: `src/app/globals.css`(`.markdown-reading`), `src/app/board/page.tsx`, `src/app/games/page.tsx`, `src/app/login/login-form.tsx`, `src/app/reset-password/reset-password-form.tsx`, `src/app/post/post-detail.tsx`, `src/app/search/search-view.tsx`, `src/app/me/learning/my-learning-view.tsx`, `src/app/me/learning/my-assignments.tsx`, `src/app/not-found.tsx`, `src/components/science/science-view.tsx`, `src/components/states.tsx`, `src/components/login-gate.tsx`, `src/components/layout/page-hero.tsx`(gradient 변형에 빛 번짐만 추가, 기본값 그대로), `src/components/post-card.tsx`, `src/components/tag-chip.tsx`, `src/components/comment-section.tsx`, `src/components/like-button.tsx`, `src/components/class/tagged-post-list.tsx`, `src/components/community/{community-post-list,community-post-detail,community-comment-section,community-like-button,community-post-form,community-setup-notice,game-player,game-upload-field,report-dialog}.tsx`, `src/components/learning/{activity-panels,learning-ui}.tsx`, `src/components/feedback/{feedback-center,feedback-thread}.tsx`.

공용 컴포넌트는 관리자 화면이 달라지지 않게 **학생 화면(`audience="student"`)일 때만** 새 모양을 쓰거나(학습 기록·피드백·빈 화면 그림), 선택 prop으로 열었다(`PageHero variant`). 관리자에도 보이는 변화는 `EmptyState`/`ErrorState`의 모서리·점선 색과 다크모드 안 읽음 배지 색뿐이다(§6).

## 3. 스크린숏 (30개 화면 × 4)
폴더: `/private/tmp/claude-501/-Users-sungchul-Desktop-classroom/7bf3a39e-3017-4189-b337-1b82aace66bb/scratchpad/redesign-2/`
파일 이름: `<화면>-1440-light.png`, `<화면>-1440-dark.png`, `<화면>-768x1024.png`, `<화면>-375.png`(2배 해상도). 1440 밝음은 개발 서버, 나머지는 정적 빌드에서 찍었다(같은 코드, 이후 바뀐 것은 초점 링·다크 배지뿐이라 다크 학습 화면 3장은 다시 찍음).

| 화면 | `<화면>` 이름 |
|---|---|
| 과학수업 첫 화면 · 학기 · 단원(차시 목록) · 차시 상세 · 없는 주소 | `science-home`, `science-term`, `science-unit`, `science-lesson`, `science-notfound` |
| 자유게시판 목록 · 글(비로그인/로그인) · 글쓰기(비로그인/로그인) | `board-list`, `board-post-out`, `board-post-in`, `board-new-out`, `board-new-in` |
| 학습게임 목록 · 글+실행기(비로그인/로그인) · 게임 올리기(로그인) | `games-list`, `games-post-out`, `games-post-in`, `games-new-in` |
| 글 보기(비로그인/로그인) · 없는 글 | `post-out`, `post-in`, `post-notfound` |
| 검색 처음 · 결과 · 결과 없음 | `search-idle`, `search-results`, `search-empty` |
| 로그인 · 새 비밀번호(일반/강제 변경) | `login`, `reset-in`, `reset-forced` |
| 내 학습 활동(비로그인 · 웹앱 결과 · 피드백 · 과제) | `me-out`, `me-apps`, `me-feedback`, `me-assignments` |
| 로그인 잠금(게시판 전체 화면 · 홈 안내 카드) · 404 | `lock-board`, `lock-home`, `notfound-404` |

대표: `science-home-1440-light.png`, `science-lesson-1440-dark.png`, `games-post-in-375.png`, `post-in-1440-light.png`, `login-1440-light.png`, `me-apps-1440-light.png`, `me-feedback-1440-light.png`, `board-list-768x1024.png`.

## 4. 로그인 상태 화면을 본 방법(실 DB 쓰기 0)
내 브라우저에서만 Supabase 요청을 가로챘다: 가짜 학생 세션(localStorage 키 1개) + 그 학생의 프로필·웹앱 결과·피드백 대화는 가짜 응답, 공개 글·게시판은 anon 키로 실제 읽기, **모든 쓰기(POST/PATCH/DELETE)와 쓰기 RPC(조회수 올리기·읽음 표시 등)는 서버로 보내지 않고 가짜 성공**. 선생님 글은 실 DB에 발행 글이 없어 가짜 글 2개로 글 보기·검색 결과를 확인했다. 로그인 잠금은 `site_settings` 응답만 바꿔 흉내 냈다.

## 5. 게임 실행기 보안 확인
`game-player.tsx`는 `className`과 장식 아이콘만 바꿨다. 코드 비교로 `sandbox={GAME_SANDBOX}` · `srcDoc={srcDoc}` · `allow={GAME_PERMISSIONS}` · `referrerPolicy="no-referrer"` · `key={runId}` · `buildSandboxDocument(html, title)` · "게임 시작"의 `onClick={start}`가 **글자 하나 다르지 않게 그대로**인 것을 확인했다. 전체 화면일 때는 예전처럼 검은 바탕(그라데이션 끔).

## 6. 대비(WCAG AA)
**화면 픽셀 실측**(글자 상자 안 최빈색 = 배경, 가장 대비 큰 픽셀 = 글자, 30개 화면 × 글자 상자 641개, 정적 빌드):
* 다크: **미달 0건**.
* 밝음: 7건으로 잡혔으나 모두 12px 가는 글자의 측정 한계다(아바타 머리글자 "이" 3.71, 앱 아이디 "(sci-…)" 4.26, 바닥글 "©" 4.43). 같은 색 조합의 토큰 계산은 5.1~5.5:1로 통과.
* 고친 실제 미달 1건: **안 읽음 배지(다크)** — 다크의 `--destructive`가 밝은 빨강이라 흰 숫자 2.84:1 → 다크에서만 진한 빨강(`oklch(0.55 0.22 25)`) 5.2~5.4:1. `learning-ui.tsx`의 공용 배지라 관리자 화면·사용자 메뉴에서도 좋아진다.

**새 색 조합(토큰 계산)**
| 조합 | 밝음 | 어두움 |
|---|---|---|
| 태그 알약(보라 글자 on 옅은 보라) | 5.14 | 5.89 |
| 보라 알약 버튼 글자(그라데이션 양 끝) | 5.59~5.98 | 8.1~8.4 |
| 형광펜 위 "실험/이야기/게임"(큰 글씨, 기준 3) | 5.2 안팎(1단계 실측 5.17~5.35) | 4.8~4.9 |
| 실험 앱·조사 도우미 배지, 단원 번호(ink on soft/white) | 6.0~7.8 | 7.9 이상 |
| 그라데이션 판 위 설명(foreground 75%) | 7.7 이상 | 6.4 이상 |
| 빈 화면 판 위 흐린 글자(연보라 배경 위 반투명 흰 판) | 5.31 | 7 이상 |
| 좋아요 누른 상태(rose-700 on rose-50) | 5.72 | 7 이상 |
| 대화 말풍선(내 말: 흰 글자 on 보라) | 5.59 | 8.09 |

## 7. 접근성·움직임·이미지
* **키보드 초점**(Tab으로 화면마다 돌며 초점 표시 없는 요소 찾기, 17개 화면 × 밝음/어두움, 요소 71개): 처음에 3곳 발견 → 고침. ① 게임 파일 칸의 숨긴 파일 입력 → 둘레 상자에 3px 링(`has-[input:focus-visible]`, 실제 링 표시 확인) ② 내 학습 활동 탭 내용 칸(shadcn 기본 `outline-none`) → 둥근 초점 링. 이제 전부 보인다.
* **움직임 줄이기**: 떠다니는 소품·부엉이 애니메이션 0개로 멈춤, 카드·버튼 떠오름 `transition: none`(8개 화면 확인).
* **이미지**: 30개 화면의 `<img>` 215개 모두 `width`/`height`/`alt` 있음. 장식 그림은 `alt=""` + `aria-hidden`, 히어로 마스코트만 `fetchpriority=high`, 히어로 소품은 eager(각 5~9KB), 나머지 lazy.
* **색만으로 구분하지 않음**: 실험 앱/조사 도우미 배지는 아이콘+글자, 완료/미완료는 아이콘+글자, 고른 탭·대화는 굵은 글자 + `aria-selected/aria-current`.

## 8. 알릴 것(기존 문제, 이번에 고치지 않음)
1. **학생 "웹앱 결과"의 앱 이름이 전부 "삭제된 앱"**: `appLabel()`이 `src/data/apps.ts`의 `webApps`(비어 있음)에서만 이름을 찾기 때문. 과학 앱 결과는 `science-curriculum.ts`에서 이름을 찾아야 맞다(데이터 로직이라 겉모양 단계 범위 밖). 스크린숏의 "삭제된 앱 (sci-6-2-3-2)"가 이 때문이다.
2. **차시 상세의 "지도서 N차시"**: CLAUDE.md는 학생 화면에 "지도서"라는 말을 쓰지 않게 한다(과학 앱 규칙). 블로그 과학수업 화면의 기존 문구라 뜻을 바꾸지 않고 그대로 뒀다 — 문구 결정 필요.
3. 같은 hover 떠오름 끊김이 관리자 `admin-overview.tsx:161`에도 있다(4단계에서).
4. `EmptyBoxIllustration`은 이제 쓰는 곳이 없다(파일은 남겨 둠).
5. 게임 업로드 안내의 "index.html" 문구는 STATUS 미결정 사항이라 그대로.

## 9. 확인하지 못한 것
* 실제 iPad/Safari(떠다니는 소품·`background-clip:text`·SVG 가장자리 필터·`has-[]` 초점 링), 실제 터치.
* **진짜 로그인**(가짜 세션으로만 확인), 실제 선생님 글·과제·읽은 글이 있는 상태(과제·읽은 글·댓글 탭은 빈 화면으로 확인).
* 관리자 화면은 공용 컴포넌트가 깨지지 않았는지만 가짜 관리자 세션으로 훑어봄(대시보드·회원·학습·커뮤니티: 오류·빈 상태 판 정상).
* 신고·삭제 확인창 등 대화상자 안쪽 모양(열어 보지 않음, 코드 변경 없음).
