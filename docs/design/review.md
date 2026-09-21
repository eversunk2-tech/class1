# Review 보고서 — 프론트엔드 디자인 개편

검토일: 2026-09-21 · 기준: `docs/design/spec.md`(§12 포함), `docs/design/build-report.md` · 대상: 커밋되지 않은 변경 전체(`git status`/`git diff`)

## 1. 요약 — **조건부 통과 → 수정 후 통과**

Build 결과는 spec대로 잘 구현돼 있었다(레이아웃 셸, 사이드바 접힘/FOUC 방지, 드로어, 대시보드 섹션 독립 fetch, 일러스트, 정적 export 제약 준수). 다만 브라우저 검증에서 **회귀 1건(상)** 과 **반응형/대비 문제 2건(중)** 을 찾았고, 모두 이번 Review에서 고쳤다. 고친 뒤 `npm run lint`, `npm run build` 통과, 브라우저 재확인 완료. git commit은 하지 않았다.

메인 에이전트/사용자가 확인해 줄 것 1건: 문제 #1을 고치려고 **수정 금지 목록(§6.3)에 있는 `src/app/admin/write/post-editor.tsx`의 className 한 줄**을 바꿨다(로직 변경 없음, 아래 #1 참고).

## 2. 발견한 문제

| # | 심각도 | 위치 | 설명 | 조치 |
|---|---|---|---|---|
| 1 | **상** | `src/app/admin/write/post-editor.tsx:394`, `src/app/admin/write/page.tsx:14` | **글 작성·수정 화면이 깨짐(회귀).** 기존 에디터는 lg 이상에서 `lg:w-[min(72rem,calc(100vw-2rem))] lg:self-center`로 **뷰포트 기준** 폭을 잡아 `max-w-3xl`을 벗어나게 돼 있었다. 사이드바가 생기면서 본문 컬럼이 뷰포트보다 좁아져, 1280px에서 폼 왼쪽이 사이드바 밑으로 들어가고 오른쪽은 화면 밖으로 넘쳤다(제목·slug 입력란이 잘려 보임). spec §12 Q5의 "max-w-3xl 유지"는 기존 에디터가 이미 넓은 폭(나란히 보기)을 쓰고 있다는 점을 놓친 결정이라, "기존 모양 유지"라는 의도에 맞춰 고쳤다. | **수정함.** 에디터 className을 `flex w-full flex-col gap-6`으로 바꾸고, 폭은 `page.tsx` wrapper가 책임지게 함(`max-w-3xl lg:max-w-6xl` = 기존과 같은 72rem 상한, 본문 컬럼 안에서만 넓어짐). 1280px에서 폼이 x=272~1248로 컬럼 안에 들어오고 나란히 보기가 정상, 375px에서 가로 스크롤 없음 확인. ※ `post-editor.tsx`는 §6.3 수정 금지 목록이지만 className 한 줄(로직 무관)이며 다른 방법으로는 고칠 수 없었다. |
| 2 | 중 | `src/components/layout/page-hero.tsx:28-52`, `src/app/page.tsx:95-104` | **태블릿(768px) + 사이드바 펼침에서 히어로 제목이 잘리고 바로가기 카드 일러스트가 카드 밖으로 넘침.** `sm:`(뷰포트 640px) 기준으로 가로 배치/3열을 켰는데, 768px에서 사이드바(240px)를 빼면 본문이 약 480px뿐이라 `whitespace-nowrap` 제목("우리 반 배움터예요")이 일러스트에 눌려 잘리고, 3열 카드(칸 약 150px)에 160px 일러스트가 들어가지 못했다. | **수정함.** 뷰포트가 아니라 **컨테이너 폭** 기준으로 변경(Tailwind v4 `@container` + `@2xl:` = 672px). 히어로는 패널 폭 672px 이상일 때만 가로 배치, 바로가기 카드는 672px 이상일 때만 3열(그 미만은 1열). 768/1280/375px에서 재확인. |
| 3 | 중 | `src/components/layout/page-hero.tsx:47`, `src/components/dashboard/menu-shortcut-card.tsx:25` | **라이트 모드 대비 부족.** 파스텔 soft 배경 위 `text-muted-foreground` 작은 글자의 대비가 실측 3.92~4.04:1로 WCAG AA(4.5:1) 미달(히어로 설명문, 바로가기 카드 설명). 다크는 4.8~5.0:1로 통과. | **수정함.** soft 배경 위 설명문은 `text-foreground/75`로 변경(라이트·다크 모두 7:1 이상). 히어로 꼬리표 칩은 `bg-card/80` → `bg-card`(불투명)로 바꿔 muted 글자 대비 4.7:1 확보. |
| 4 | 하 | `src/components/dashboard/stat-tile.tsx:44-49` | 통계 타일 오류 문구 "불러오지 못했어요"가 좁은 타일(모바일 2열 · lg 4열)에서 2줄로 꺾여 타일 높이가 들쭉날쭉해짐. | **수정함.** 보이는 글자는 "앗, 오류" + 재시도 버튼, 전체 문장(`{label}을 불러오지 못했어요`)은 `sr-only`로 `role="alert"` 안에 유지. 375px에서 4개 타일 높이 동일(76px) 확인. |
| 5 | 하 | `src/components/illustrations/home-illustration.tsx:4` | 다크모드에서 홈 일러스트 구름이 `var(--card)`(거의 검정)라 해 옆에 먹구름처럼 보임. | **수정함.** 구름만 `fill-card dark:fill-foreground/25`로 변경. |
| 6 | 하 | `src/components/class/tagged-post-list.tsx:61-92` | 첫 페이지 로딩 로직이 `loadFirst`(재시도용)와 `useEffect` 안에 중복돼 있다. `popular-posts.tsx`/`stat-tile.tsx`처럼 `attempt` 카운터 하나로 합칠 수 있다. 동작에는 문제 없음(기존 `post-list.tsx`와 같은 패턴). | 미수정 — 동작 문제가 아니고 기존 코드 패턴을 따른 것이라 그대로 둠. |
| 7 | 하 | `src/components/layout/sidebar.tsx:80` | Topbar 실제 높이는 56px + 테두리 1px = 57px인데 사이드바는 `top-14`(56px)에 붙는다. 1px 겹침은 눈에 보이지 않음. | 미수정 — 시각적 영향 없음. |
| 8 | 하 | `src/components/apps/app-grid.tsx:23` | `sm:grid-cols-2 xl:grid-cols-3`도 뷰포트 기준이라, 768px + 사이드바 펼침에서는 카드 칸이 약 230px이 된다. 지금은 등록된 앱이 0개라 실제 카드 모양을 확인할 수 없었다. | 미수정 — 첫 웹앱을 Embed할 때 확인 필요(필요하면 #2처럼 `@container` 기준으로). `app-card.tsx`는 수정 범위 밖. |

## 3. 검증 결과

### 3.1 lint / build (수정 후)
* `npm run lint` — 통과(오류·경고 0)
* `npm run build` — 성공. 정적 라우트 `/`, `/_not-found`, `/admin`, `/admin/write`, `/games`, `/login`, `/math`, `/post`, `/science`, `/search`. Jua 폰트 관련 오류 없음.
* `out/index.html`, `out/games/index.html`, `out/science/index.html`, `out/math/index.html` 존재 확인. 빌드 CSS에 `@container (min-width:42rem)` 규칙 포함 확인.

### 3.2 코드 리뷰
* **정적 export 제약**: Server Actions / Route Handlers / middleware / 동적 세그먼트 / `generateStaticParams` 없음. 새 라우트 3개는 정적 페이지. Supabase 호출은 전부 `"use client"` 컴포넌트(`stat-tile`, `popular-posts`, `tagged-post-list`)에서만. basePath 하드코딩 없음(내부 이동은 모두 `next/link`). `site-header` 잔여 import 없음.
* **`use client` 경계**: `page.tsx`·`menu-shortcut-card.tsx`·`page-hero.tsx`·`topbar.tsx`는 서버 컴포넌트, 아이콘(함수)을 클라이언트로 넘기는 곳 없음(`StatTiles`가 클라이언트 안에서 조립). `ScienceIllustration`의 `useId`는 서버/클라이언트 모두 안전.
* **hydration**: `useSidebar`는 `useSyncExternalStore`(서버 스냅샷 = 펼침) + `<html data-sidebar>` CSS 방식, `<html suppressHydrationWarning>` 유지. 접힘 상태로 새로고침해도 콘솔에 hydration 경고 없음(브라우저 확인).
* **Tailwind 동적 클래스**: 색 클래스는 전부 `src/lib/menu-colors.ts` 고정 매핑. 템플릿 문자열 결합 없음. 일러스트 색은 CSS 변수 고정 매핑.
* **접근성**: `<nav aria-label="주요 메뉴">`, 토글 `aria-expanded`/`aria-controls`/`aria-label`, 활성 메뉴 `aria-current="page"`, 아이콘 버튼 라벨, 일러스트 `aria-hidden`, 로딩 `aria-busy`, 오류 `role="alert"` 확인. `prefers-reduced-motion` 규칙은 unlayered CSS라 Tailwind 유틸보다 우선 적용됨.
* **RLS**: 스키마 변경 없음. 새 쿼리는 `posts` select(항상 `.eq("published", true)` — 관리자로 봐도 초안은 대시보드에 안 나옴)와 `views` select뿐이며, 각각 기존 정책 `published or is_admin()`, `views: 누구나 조회 using (true)` 범위 안. 쓰기 쿼리 추가 없음.

### 3.3 브라우저 검증
dev 서버는 **다른 세션이 이미 3000 포트에서 `blog-dev`를 띄워 둔 상태**여서 `preview_start {name}`는 거절됐고, 같은 서버(`http://localhost:3000/class1/`)에 브라우저 탭만 열어 검증했다(내가 띄운 서버가 없으므로 중지할 것도 없음). 관리자 계정으로 로그인된 세션이었다.

build-report "Review가 확인할 점" 9개:

| # | 항목 | 결과 |
|---|---|---|
| 1 | 사이드바 접힘 | 통과. 240↔72px, `localStorage sidebar:collapsed=true`, 전체 새로고침·다른 라우트 이동 후에도 깜빡임 없이 유지, hydration 경고 없음. 아이콘 칩 가운데 정렬(칩 중심 35.5px / 폭 72px), tooltip 오른쪽 표시, 링크 텍스트(숨긴 라벨) 유지, `aria-expanded=false`·라벨 "메뉴 펼치기" |
| 2 | 모바일 드로어(375px) | 통과. 햄버거 → 왼쪽 패널(288px) 열림, `role=dialog` + 제목 연결, 첫 포커스 "메뉴 닫기", `body overflow:hidden`. Esc·바깥 클릭·메뉴 클릭 모두 닫힘, 닫힌 뒤 포커스가 "메뉴 열기"로 복귀, 메뉴 클릭 시 이동 + 스크롤 잠금 해제. (열린 채 화면 넓히기는 코드로만 확인: `matchMedia` change → `setOpen(false)`, 패널/오버레이 `md:hidden`) |
| 3 | Jua 폰트 · radius | 통과. `document.fonts`에 Jua loaded, woff2 조각 200 OK, 제목 가짜 볼드 없음. 버튼/입력/배지 모서리 과하지 않음 |
| 4 | 대시보드 섹션 독립성 | 통과. Supabase REST 요청만 실패시키면 통계 타일 3개·최근 소식·인기 글·과학·수학이 각각 오류 상태(시무룩 캐릭터 + 다시 시도), 바로가기 카드·학습게임 타일/섹션은 정상. 요청 복구 후 "다시 시도"로 전부 회복. 빈 상태(상자 캐릭터)도 과학/수학/게임에서 확인 |
| 5 | xl 2단 배치 | 통과. 1280px에서 [최근 소식 \| 인기 글], [과학 \| 수학] 2열, 768px에서 1열. 커버 이미지가 있는 글이 없어 좁은 열에서의 커버 카드 모양은 **확인 못 함** |
| 6 | 대비 | 실측함(§2 #3). strong-on-soft 아이콘: 라이트 3.41~4.35:1, 다크 6.4~6.7:1(3:1 기준 통과). soft 위 muted 글자 미달 → 수정 |
| 7 | 기존 화면 폭 | 글 상세·검색·관리자 목록 768px(max-w-3xl) 유지, 404 세로 가운데 정렬 유지, 댓글/좋아요/조회수 표시 정상. **에디터는 깨져 있었음 → #1 수정.** 로그인 화면은 로그인 상태라 홈으로 리다이렉트되어 **폼 모양은 확인 못 함**(wrapper만 추가된 변경이라 위험 낮음) |
| 8 | 일러스트 애니메이션 | 과하지 않음(3px 둥실, 반짝임). reduced-motion은 CSS 규칙으로 확인(브라우저 에뮬레이션은 못 함). `ScienceIllustration`이 한 페이지에 두 번 나올 때 clipPath 충돌 없음 — 홈(바로가기 카드) 렌더 정상 |
| 9 | 활성 메뉴 | 통과. `/`는 홈에서만, `/science/`·`/math/`는 해당 메뉴만, `/post/`·`/search/`·`/admin/`·404에서는 활성 메뉴 0개 |

spec §10 체크리스트:
* 데스크톱 1280 / 태블릿 768 / 모바일 375, 라이트·다크 모두 스크린샷으로 확인. 다크모드 accent·일러스트·링 표현 자연스러움.
* **가로 스크롤**: 375px에서 홈·수학·게임·404·에디터, 768px 홈 모두 `scrollWidth === innerWidth`.
* **콘솔**: 오류·경고 없음(일부러 연 `/nope/`의 404 한 건 제외). **네트워크**: 실패 요청 없음.
* 키보드: Tab 순서 로고 → 검색 → 테마 → 사용자 메뉴 → 사이드바 토글 → 메뉴(숨겨진 햄버거는 건너뜀).

### 3.4 디자인 품질
"깔끔하고 귀여운" 톤에 잘 맞는다. 일러스트는 웃는 표정·별·기포가 있는 완성도 있는 플랫 SVG이고, 깨지거나 어색한 곳은 다크모드 구름(#5)뿐이었다. 파스텔은 배경/아이콘/테두리에만 쓰였고 본문은 foreground 계열.

## 4. 확인하지 못한 것
* 로그인 폼 화면(로그인 상태였음), 비로그인 방문자 시점.
* 커버 이미지가 있는 `PostCard`, 글이 10개 이상일 때의 "더 보기" 페이지네이션, 웹앱 카드(데이터 없음).
* `prefers-reduced-motion` 실제 에뮬레이션, 드로어를 연 채 창 넓히기(코드로만 확인).
* 배포 환경(GitHub Pages)에서의 동작 — 로컬 dev와 `next build` 결과물만 확인.

## 5. 남은 제안(선택)
* `TaggedPostList`의 첫 페이지 로딩 중복을 `attempt` 카운터 패턴으로 합치기(#6).
* 첫 웹앱 Embed 때 `AppGrid` 열 수를 `@container` 기준으로 바꿀지 확인(#8).
* spec §12 Q5 문구를 "에디터는 기존처럼 lg 이상에서 72rem까지"로 고쳐 두면 이후 혼동이 없다.
* 468~671px 폭의 본문 컬럼(사이드바 펼친 태블릿)에서 바로가기 카드를 가로형(일러스트 왼쪽 + 글 오른쪽)으로 만들면 세로 길이를 줄일 수 있다.
