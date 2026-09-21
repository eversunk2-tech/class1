# Build 보고서 — 프론트엔드 디자인 개편

기준 문서: `docs/design/spec.md`(§12 확정 결정 포함), `docs/design/build-instructions.md`. 단계 0 → 7 순서로 구현했다. git commit은 하지 않았다.

## 1. 파일 목록

### 신규
| 경로 | 내용 |
|---|---|
| `src/data/menu.ts` | 메뉴 정의 배열, `isMenuActive()`(basePath 없는 경로 · trailing slash 기준 비교), 새 메뉴 추가 방법 주석 |
| `src/lib/menu-colors.ts` | `MenuColor → Tailwind 클래스` 고정 매핑(softBg, strongText, strongBg, border, hoverBorder, chip, focusRing) |
| `src/hooks/use-sidebar.ts` | `useSidebar()`(useSyncExternalStore + `<html data-sidebar>`), `useNavDrawer()`, `SIDEBAR_INIT_SCRIPT`, 키 `sidebar:collapsed` |
| `src/components/layout/sidebar.tsx` | 데스크톱 사이드바 + 공용 `NavMenuList`(드로어와 공유) |
| `src/components/layout/mobile-nav-drawer.tsx` | 햄버거 버튼 + base-ui Dialog 기반 왼쪽 슬라이드 드로어 |
| `src/components/layout/topbar.tsx` | `site-header.tsx` 대체. `SITE_NAME = "우리 반 배움터"`, 로고 마스코트 SVG |
| `src/components/layout/page-hero.tsx` | 홈/게임/과학/수학 공용 히어로 패널 (spec 목록에 없던 파일 — §3 참고) |
| `src/components/dashboard/stat-tile.tsx` | `StatTile`(표시) + `StatTiles`(4개 조립, 글 수 독립 fetch) |
| `src/components/dashboard/menu-shortcut-card.tsx` | 메뉴 바로가기 카드 |
| `src/components/dashboard/popular-posts.tsx` | 인기 글(views → posts) (spec 목록에 없던 파일 — §3 참고) |
| `src/components/class/tagged-post-list.tsx` | 태그별/전체 글 목록(`tag` 선택값, `limit`, `moreHref`, `accent`) |
| `src/components/illustrations/parts.tsx` | 공용 조각: `Sparkle`, `Star`, `SmileFace`, 공통 svg 속성 |
| `src/components/illustrations/{home,science,math,game,empty-box,error-face}-illustration.tsx` | §5의 6종 일러스트 |
| `src/app/games/page.tsx`, `src/app/science/page.tsx`, `src/app/math/page.tsx` | 새 정적 라우트 3개 |

### 수정
| 경로 | 내용 |
|---|---|
| `src/app/globals.css` | `--radius: 1rem`, accent 8토큰(light/dark), `@theme inline` 색 매핑 8개 + `--font-heading`, `.font-heading`(가짜 볼드 방지), 사이드바 접힘 CSS, 드로어 슬라이드, 일러스트 애니메이션, `prefers-reduced-motion` 처리 |
| `src/app/layout.tsx` | Jua 폰트, `SIDEBAR_INIT_SCRIPT`, Topbar + (Sidebar + Main + Footer) 셸, metadata description |
| `src/app/page.tsx` | 대시보드로 전면 교체 |
| `src/app/post/page.tsx`, `search/page.tsx`, `login/page.tsx`, `admin/page.tsx`, `admin/write/page.tsx` | `max-w-3xl` wrapper만 추가(기능 변경 없음) |
| `src/app/post/post-detail.tsx` | `SITE_NAME` import 경로만 `@/components/layout/topbar`로 변경(1줄) |
| `src/components/apps/app-grid.tsx` | `limit?: number`, 빈 상태 문구/일러스트, `xl:grid-cols-3` |
| `src/components/states.tsx` | `EmptyState`/`ErrorState`에 선택 prop `illustration?: ReactNode` 추가(하위호환) |
| `src/components/site-footer.tsx` | `max-w-3xl` 제거, 본문 컬럼 폭에 맞춤, 문구를 사이트 이름으로 |

### 삭제
* `src/components/site-header.tsx` (→ `layout/topbar.tsx`)

## 2. 확인한 문서/소스 근거
* `node_modules/next/dist/compiled/@next/font/dist/google/font-data.json` → `Jua: { weights:["400"], subsets:["latin"] }`. **`korean` subset은 존재하지 않는다.** 그래서 `subsets: ["latin"]`으로 지정했다. 한글 글리프는 Google Fonts의 unicode-range 조각(@font-face 다수)으로 함께 내려오며 빌드 결과 CSS에 Jua @font-face가 포함된 것을 확인했다. 빌드 오류가 없어 `preload: false`는 쓰지 않았다.
* `next/link`는 `ref`를 `<a>`로 전달(`client/app-dir/link.js`) → base-ui `TooltipTrigger render={<Link/>}` 사용 가능.
* base-ui `Tooltip.Root`의 `disabled` prop, Dialog Popup의 `data-starting-style`/`data-ending-style` 확인 후 사용.

## 3. spec과 다르게 구현한 부분
| 항목 | 내용 | 이유 |
|---|---|---|
| Jua `subsets` | spec의 `['korean']` 대신 `['latin']` | 위 §2. next/font 데이터에 korean subset이 없음 |
| 접힘 상태 표현 | React 상태로 클래스를 바꾸지 않고 `<html data-sidebar="collapsed">` + `globals.css`의 `.app-sidebar` 규칙으로 폭/라벨을 제어. `useSidebar()`는 aria/tooltip에만 사용 | 첫 페인트 깜빡임과 hydration mismatch를 동시에 없애기 위해(서버 스냅샷은 항상 펼침) |
| 드로어 | `ui/dialog.tsx`의 `Dialog/Trigger/Portal/Overlay/Title/Close`는 재사용하되, 가운데 모달용 `DialogContent` 대신 base-ui `Dialog.Popup`을 직접 스타일링 | `DialogContent`의 중앙 정렬·zoom 애니메이션 클래스를 덮어쓰는 것보다 안전 |
| 추가 파일 `layout/page-hero.tsx` | 4개 화면 히어로 공용 컴포넌트 | 같은 마크업 4번 중복 방지 |
| 추가 파일 `dashboard/popular-posts.tsx` | 인기 글 섹션 | `page.tsx`를 서버 컴포넌트로 유지하려면 fetch 하는 클라이언트 컴포넌트가 별도로 필요 |
| 추가 파일 `illustrations/parts.tsx` | 별/반짝이/웃는 얼굴 공용 조각 | 6개 일러스트 간 중복 제거 |
| `StatTiles` | 통계 타일 4개를 `stat-tile.tsx` 안의 클라이언트 컴포넌트로 조립 | lucide 아이콘(함수)은 서버 → 클라이언트 props로 넘길 수 없음 |
| 대시보드 "더 보기" | 목록 아래가 아니라 **섹션 제목 오른쪽**에 항상 표시. `TaggedPostList`의 `moreHref` prop은 구현돼 있으나 대시보드에서는 쓰지 않음 | 글이 적어도 메뉴로 이동할 수 있고, 섹션 간 모양이 통일됨 |
| 인기 글 쿼리 | views 상위 `limit×4`개를 받아 발행 글만 거른 뒤 상위 3개 | 비공개/삭제된 글의 views 행이 상위에 있으면 3개가 안 채워지는 문제 방지 |
| 태그 필터 | `.contains("tags", [tag])`로 통일(신규 코드). `search-view.tsx`의 `.filter("tags","cs",…)`는 수정 범위 밖이라 그대로 둠 | §6.3 범위 준수 |
| `EmptyState`/`ErrorState` | 일러스트는 **opt-in**(prop을 넘긴 곳만). 기존 화면(관리자·검색 등)의 모양은 그대로 | 하위호환 · 범위 최소화. 전 화면 적용을 원하면 기본값만 바꾸면 됨 |
| 일러스트 색 | 주 색은 해당 메뉴 토큰이지만 별·버튼·행성 등 작은 포인트에 다른 메뉴 색도 섞음 | 단색이면 밋밋해서. 전부 CSS 변수라 다크모드 대응은 동일 |
| 사이드바 하단 | 펼침 상태에서만 보이는 작은 응원 카드 추가 | 빈 공간 보완(접힘 시 숨김) |

## 4. 검증 결과
* `npm run lint` — 통과(경고/오류 0)
* `npm run build` — 성공. 정적 라우트: `/`, `/admin`, `/admin/write`, `/games`, `/login`, `/math`, `/post`, `/science`, `/search`, `/_not-found`
* `out/games/index.html`, `out/science/index.html`, `out/math/index.html`, `out/index.html` 존재 확인
* `out/index.html` `<head>`에 `SIDEBAR_INIT_SCRIPT`가 문자열로 들어간 것, `/science/` 프리렌더 결과에서 과학수업 링크에만 `aria-current="page"`가 붙은 것 확인
* 일러스트 7종(로고 포함)은 빌드 결과의 SVG를 추출해 headless Chrome으로 라이트/다크 렌더링을 눈으로 확인했다(이 과정에서 `color-mix(in oklch …)`가 무채색과 섞일 때 색상이 갈색으로 틀어지는 문제를 발견해 `in oklab`/`in srgb`로 고침).
* **전체 페이지의 브라우저 확인은 하지 않았다**(dev 서버 금지 지침). 레이아웃·반응형·드로어 동작은 Review에서 확인 필요.

## 5. Review가 특히 확인할 점
1. **사이드바 접힘**: 토글 → 폭 240↔72px 전환, 새로고침 후 깜빡임 없이 유지, 콘솔에 hydration 경고 없음. 접힘 상태에서 아이콘 칩이 가운데 정렬되는지, tooltip이 오른쪽에 뜨는지, 스크린리더 이름(숨긴 라벨)이 유지되는지.
2. **모바일 드로어**(<768px): 햄버거 → 왼쪽 슬라이드 인, 메뉴 클릭/바깥 클릭/Esc로 닫힘, body 스크롤 잠금, 닫힌 뒤 포커스가 햄버거로 복귀, 열린 채로 화면을 넓히면 자동으로 닫힘. 슬라이드 transition(`.nav-drawer[data-starting-style]`)이 실제로 동작하는지.
3. **Jua 폰트**: 한글 제목이 실제로 Jua로 나오는지(네트워크 탭에서 woff2 조각 로드), `font-semibold` 등이 걸린 기존 제목(DialogTitle, CardTitle)이 가짜 볼드 없이 보이는지. `--radius` 1rem 상향으로 기존 버튼/입력/배지 모서리가 과하지 않은지.
4. **대시보드 섹션 독립성**: Supabase 오프라인/환경변수 없음 상태에서 통계 타일 3개·최근 소식·인기 글·과학·수학이 각각 오류 상태(시무룩 캐릭터 + 다시 시도)로 떨어지고 나머지(바로가기 카드, 학습게임)는 정상인지. 빈 상태(상자 캐릭터) 표시.
5. **xl 2단 배치**: 1280px 이상에서 [최근 소식 | 인기 글], [과학 | 수학]이 2열. 커버 이미지가 있는 `PostCard`가 좁은 열(약 470px)에서 답답하지 않은지. 768~1279px에서는 1열.
6. **대비**: 파스텔 soft 배경 위 글자는 모두 foreground/muted-foreground. soft 위 strong 아이콘(3:1), 다크모드 accent 가독성 실측.
7. **기존 화면 폭**: 글 상세/검색/로그인/관리자/에디터가 `max-w-3xl`로 이전과 같은지, 404 화면 세로 가운데 정렬 유지되는지.
8. **일러스트 애니메이션**: 별 반짝임/둥실 효과가 과하지 않은지, `prefers-reduced-motion`에서 멈추는지. 같은 일러스트가 한 페이지에 두 번 나올 때(ScienceIllustration의 `useId` clipPath) 문제없는지.
9. 활성 메뉴: `/`는 홈에서만, `/post/`·`/search/` 등에서는 아무 메뉴도 활성화되지 않음(의도).
