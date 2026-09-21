# 프론트엔드 디자인 개편 spec — 초등 6학년용 사이드바 + 대시보드

> Plan 단계 산출물. **구현하지 않음.** Build 서브에이전트가 이 문서를 기준으로 작업한다.
> 대상: `docs/design/plan-instructions.md`에 정의된 범위(블로그 본체 Next.js 프론트엔드 디자인 개편).

## 0. 전제 요약 (근거 포함)

| 전제 | 근거 |
|---|---|
| 정적 export만 사용, Server Actions/동적 Route Handler/middleware 불가 | `next.config.ts`: `output:"export"`. `node_modules/next/dist/docs/01-app/02-guides/static-exports.md` "Unsupported Features" |
| 새 라우트 `/games/`, `/science/`, `/math/`는 동적 세그먼트 없이 정적 페이지로 | 같은 문서: `generateStaticParams()` 없는 동적 라우트 미지원. `next.config.ts`의 `trailingSlash:true`로 `/games/index.html` 형태로 export됨 |
| `usePathname()`은 **basePath가 제거된** 경로를 반환한다(`/class1/games/` → `/games/`) | 공식 문서(`.../03-api-reference/04-functions/use-pathname.md`)에는 명시되어 있지 않음. 이 버전 실제 동작은 소스로 확인: `node_modules/next/dist/client/components/app-router.js` 121행 `pathname: hasBasePath(url.pathname) ? removeBasePath(url.pathname) : url.pathname`. → 사이드바 활성 링크 비교 시 **basePath를 붙이지 않은 경로**(`/`, `/games/`, `/science/`, `/math/`)와 비교해야 하며, `trailingSlash:true`이므로 끝 슬래시까지 정확히 맞춰야 한다 |
| `next/image`, `<img>`, `<iframe>`, OAuth `redirectTo` 등은 basePath 자동 미적용 → `withBasePath()` 수동 사용 | `.../03-api-reference/05-config/01-next-config-js/basePath.md` "Links"/"Images". 이미 `src/lib/base-path.ts`에 구현되어 있으므로 그대로 재사용 |
| `next/font/google`로 한글 폰트 사용 시 `subsets`(preload 대상), `weight`(가변 폰트가 아니면 필수) 지정 필요 | `.../03-api-reference/02-components/font.md` "Reference"/"subsets"/"weight". Jua·Gaegu·Gowun Dodum은 가변 폰트가 아니므로(단일 weight 파일) `weight:'400'` 필수 지정 |
| `next/font/google`는 빌드 시 폰트 메타데이터를 내려받아 처리한다(로컬에 폰트 목록이 번들되어 있지 않음) | `node_modules/next/dist/compiled/@next/font/google/index.js`가 스텁(15줄, "@next/font/google failed to run..." 에러만 던짐)이라 실제 폰트 목록을 이 저장소에서 정적으로 확인할 수 없었다. **Build 단계에서 실제 `next build`(네트워크 필요)로 폰트명·subsets 값이 유효한지 1차 확인이 필요**하다(§11 Q4) |
| `useSearchParams` 사용 컴포넌트는 `<Suspense>` 필요 | 기존 `docs/blog/spec.md` §0, `src/app/search/page.tsx`·`src/app/admin/write/page.tsx`에 이미 적용된 패턴. 이번 개편에서 새로 추가하는 페이지는 `useSearchParams`를 쓰지 않으므로 해당 없음 |
| basePath는 `/class1` 고정(로컬 포함) | `docs/blog/spec.md` §12 확정 결정. 이번 개편도 동일 전제 유지 |

관리자 권한·RLS는 이번 개편에서 변경하지 않는다(`supabase/migrations/*.sql` 그대로). 스키마 변경 없이 `posts.tags`(`과학`/`수학`)와 `src/data/apps.ts`만으로 새 메뉴를 구현한다.

---

## 1. 디자인 컨셉

### 1.1 톤
깔끔 + 귀여움. 파스텔 컬러를 **배경/테두리/아이콘 포인트**로만 쓰고, 본문 글자색은 항상 기존 중립 토큰(`--foreground`/`--muted-foreground`)을 사용해 대비를 지킨다(파스텔 배경 위에 파스텔 글자를 얹지 않는다).

### 1.2 팔레트 (신규 토큰, `src/app/globals.css`에 추가)

메뉴별 accent를 `soft`(카드·레일 배경 틴트)와 `strong`(아이콘·테두리·포인트) 두 단계로 정의한다. 값은 시작안이며 Review 단계에서 실제 브라우저로 WCAG AA 대비(아이콘·라지 텍스트 3:1, 일반 텍스트는 항상 `--foreground` 사용이므로 별도 검증 불요)를 확인해 미세 조정한다.

| 토큰 | 의미 | light | dark |
|---|---|---|---|
| `--home-soft` / `--home-strong` | 홈(하늘) | `oklch(0.94 0.03 235)` / `oklch(0.55 0.13 235)` | `oklch(0.32 0.05 235)` / `oklch(0.78 0.12 235)` |
| `--games-soft` / `--games-strong` | 학습게임활동(분홍·보라) | `oklch(0.94 0.03 330)` / `oklch(0.55 0.15 330)` | `oklch(0.32 0.06 330)` / `oklch(0.8 0.13 330)` |
| `--science-soft` / `--science-strong` | 과학수업(민트·초록) | `oklch(0.94 0.04 165)` / `oklch(0.55 0.12 165)` | `oklch(0.32 0.05 165)` / `oklch(0.78 0.12 165)` |
| `--math-soft` / `--math-strong` | 수학수업(노랑·주황) | `oklch(0.94 0.04 80)` / `oklch(0.6 0.14 70)` | `oklch(0.32 0.05 70)` / `oklch(0.8 0.13 75)` |

`@theme inline` 블록에 `--color-home-soft: var(--home-soft)` 식으로 4×2×2=16개 매핑을 추가해 `bg-home-soft`, `text-science-strong` 같은 Tailwind 유틸을 바로 쓸 수 있게 한다. `src/data/menu.ts`의 각 메뉴 항목은 `color: "home" | "games" | "science" | "math"` 키만 갖고, 실제 클래스는 컴포넌트에서 `` `bg-${color}-soft` `` 매핑 테이블(동적 문자열 결합은 Tailwind JIT가 못 읽으므로 **고정 매핑 객체**로 구현할 것 — Build 단계 주의사항으로 §6에도 기재)로 변환한다.

### 1.3 모서리 · 그림자
- `--radius`를 `0.625rem` → `1rem`으로 상향(기존 `:root` 한 줄만 수정하면 `--radius-sm ~ --radius-4xl` 전체가 함께 커짐, 이미 `calc()`로 연쇄돼 있음).
- 카드/사이드바/모달에는 부드러운 그림자(`shadow-lg` 계열 + 기존 `ring-1 ring-foreground/10`)를 라이트 모드에 적용. 다크 모드는 그림자가 잘 안 보이므로 그림자 대신 `ring-foreground/10`(기존 패턴 유지)로 경계를 표현.
- `prefers-reduced-motion: reduce`에서는 사이드바 토글·드로어의 transition을 즉시 전환(0ms)으로 낮춘다.

### 1.4 글꼴 비교와 추천

| 후보 | 특징 | 가변 폰트 | 가독성(본문 적합도) | 귀여움 |
|---|---|---|---|---|
| **Jua** | 두껍고 동글동글, 임팩트 강함 | 아니오(단일 weight) | 낮음(긴 문장 X, 큰 제목용) | ★★★★★ |
| **Gaegu** | 손글씨풍, 3 weight(Light/Regular/Bold) | 아니오 | 낮음~중간 | ★★★★★ |
| **Gowun Dodum** | 둥글지만 차분, 단일 weight | 아니오 | 중간(짧은 제목·라벨엔 무난) | ★★★ |
| **Nunito** | 라운드 산세리프, 한글 미지원(라틴/숫자 전용) | 예 | 높음 | ★★ |

**추천**: **Jua**를 `--font-heading`(제목·히어로·사이드바 메뉴 라벨·대시보드 섹션 타이틀 전용)으로, 본문/카드 설명/댓글 등은 기존 `--font-sans`(Geist + 한글 폴백 스택, `globals.css`에 이미 존재)를 그대로 유지한다. 이렇게 하면 큰 글씨(귀여움)와 본문 가독성(WCAG AA)을 동시에 만족한다. `weight:'400'`(Jua 유일 weight), `subsets:['korean']`을 지정한다(§0 근거. 정확한 subset 값은 Build 시 `next build`로 1차 검증 필요 — §11 Q4).

- `src/app/layout.tsx`에 `Jua` 폰트를 추가하고 `variable:"--font-heading-kr"`로 선언, `globals.css`의 `@theme inline` 블록에서 `--font-heading: var(--font-heading-kr)`로 갱신(현재 `--font-heading: var(--font-sans)`로 자리만 잡혀 있음 — `src/components/ui/dialog.tsx`의 `DialogTitle`이 이미 `font-heading` 클래스를 쓰고 있어 **토큰만 바꾸면 기존 다이얼로그 제목에도 자동 반영**된다).
- Jua는 `preload:true`(기본값)가 헤더/사이드바 등 모든 라우트에서 쓰이므로 루트 레이아웃에 둬도 무방(폰트 1개 추가라 페이로드 영향 작음).

---

## 2. 레이아웃 구조

### 2.1 구성
`Topbar`(전체 폭, sticky) 아래에 `Sidebar`(데스크톱 고정 / 모바일 드로어) + `Main`(스크롤 영역) + `Footer`(Main 하단)를 둔다.

```
데스크톱(≥768px, 펼침)                          데스크톱(≥768px, 접힘)
┌──────────────────────────────────────┐        ┌──────────────────────────┐
│ Topbar: 로고     [검색][테마][유저메뉴]  │        │ Topbar: 로고   [검색][테마][유저]│
├───────────┬────────────────────────────┤        ├────┬──────────────────────┤
│[«토글]    │                            │        │[»] │                      │
│🏠 홈       │   Main (스크롤)             │        │ 🏠 │   Main               │
│🎮 학습게임  │                            │        │ 🎮 │                      │
│🧪 과학수업  │                            │        │ 🧪 │                      │
│📐 수학수업  │                            │        │ 📐 │                      │
│           ├────────────────────────────┤        │    ├──────────────────────┤
│           │ Footer                     │        │    │ Footer               │
└───────────┴────────────────────────────┘        └────┴──────────────────────┘
  사이드바 240px(w-60)                               레일 72px(w-18)

모바일(<768px)                             (햄버거 탭 시 오버레이 드로어)
┌────────────────────────────┐            ┌───────────┐░░░░░░░░░░░░░░░
│ Topbar: [☰] 로고 [검색][테마][유저]│      │ Drawer    │░ backdrop(탭시 닫힘)░
├────────────────────────────┤            │ 🏠 홈      │░░░░░░░░░░░░░░░
│ Main (전체 폭)                │            │ 🎮 학습게임 │░░░░░░░░░░░░░░░
├────────────────────────────┤            │ 🧪 과학수업 │░░░░░░░░░░░░░░░
│ Footer                     │            │ 📐 수학수업 │░░░░░░░░░░░░░░░
└────────────────────────────┘            └───────────┘░░░░░░░░░░░░░░░
```

### 2.2 브레이크포인트별 동작
| 구간 | 동작 |
|---|---|
| `< md`(모바일) | 사이드바 기본 숨김. Topbar 왼쪽 햄버거 버튼 → 왼쪽에서 슬라이드 인하는 오버레이 드로어. 메뉴 선택 / 바깥(backdrop) 클릭 / `Esc` 로 닫힘. 열려 있는 동안 `body` 스크롤 잠금 |
| `≥ md`(데스크톱) | 사이드바 항상 보임. 펼침(아이콘+라벨, `w-60`) ↔ 접힘(아이콘만 레일, `w-18`) 토글 버튼(사이드바 상단). 상태는 `localStorage`(`sidebar:collapsed`)에 저장, 다음 방문에 복원 |
| 공통 | 현재 경로와 일치하는 메뉴 항목은 `soft` 배경 + `strong` 텍스트/아이콘으로 강조(§0 `usePathname` 근거대로 basePath 제거된 경로, trailing slash까지 정확히 비교. `/`는 정확히 `pathname === "/"`일 때만 활성화해 다른 라우트에 걸치지 않게 함) |

### 2.3 FOUC 방지
테마와 동일한 패턴을 재사용한다. `src/app/layout.tsx`의 `<head>` 인라인 스크립트(`THEME_INIT_SCRIPT` 옆에 `SIDEBAR_INIT_SCRIPT` 추가, `src/hooks/use-sidebar.ts`에서 export)가 hydration 전에 `localStorage`의 `sidebar:collapsed` 값을 읽어 `<html>`(또는 사이드바 래퍼)에 접힘 여부를 나타내는 속성(`data-sidebar=collapsed`)을 즉시 세팅해 첫 페인트 깜빡임을 없앤다. 쿠키 기반(shadcn 공식 sidebar 블록의 기본 방식)은 서버가 요청 시점에 쿠키를 읽어 SSR 클래스를 정하는 전제인데, 이 프로젝트는 정적 export(요청 시점 서버 렌더 없음)이므로 **쿠키 대신 기존 테마와 동일한 `localStorage` + 인라인 스크립트 방식**을 채택한다(일관성·구현 단순성).

---

## 3. 메뉴 데이터 구조와 추가 방법

`src/data/menu.ts` (신규, 배열 하나로 사이드바·대시보드 바로가기 카드가 모두 이 데이터를 읽는다):

```ts
import type { ComponentType, SVGProps } from "react";
import type { LucideIcon } from "lucide-react";

export type MenuColor = "home" | "games" | "science" | "math";

export type MenuItem = {
  id: string;                 // 고유 key
  label: string;               // 사이드바/카드 표시 이름
  href: string;                 // "/", "/games/", "/science/", "/math/" (next/link용, basePath 자동 적용)
  icon: LucideIcon;              // 사이드바용 작은 아이콘(lucide-react)
  illustration: ComponentType<SVGProps<SVGSVGElement>>; // 대시보드 바로가기 카드용 큰 SVG 일러스트
  color: MenuColor;              // globals.css의 {color}-soft/{color}-strong 토큰과 매칭
  description: string;           // 대시보드 카드 한 줄 설명
};

export const menuItems: MenuItem[] = [
  { id: "home", label: "홈", href: "/", icon: HomeIcon, illustration: HomeIllustration, color: "home",
    description: "우리 반 소식을 한눈에 봐요" },
  { id: "games", label: "학습게임활동", href: "/games/", icon: GamepadIcon, illustration: GameIllustration, color: "games",
    description: "직접 만든 게임을 해봐요" },
  { id: "science", label: "과학수업", href: "/science/", icon: FlaskConicalIcon, illustration: ScienceIllustration, color: "science",
    description: "과학 시간에 배운 것들" },
  { id: "math", label: "수학수업", href: "/math/", icon: RulerIcon, illustration: MathIllustration, color: "math",
    description: "수학 시간에 배운 것들" },
];
```

**새 메뉴 추가 방법(문서화용, README 대신 파일 상단 주석으로 남긴다)**:
1. `menuItems` 배열에 항목 추가(아이콘은 lucide-react에서, 일러스트는 `src/components/illustrations/`에 새로 그려서).
2. `src/app/{경로}/page.tsx`를 만든다(정적 페이지, 동적 세그먼트 금지).
3. accent 색이 새로 필요하면 `globals.css`에 `--{color}-soft`/`--{color}-strong`(light/dark) 한 쌍과 `@theme inline` 매핑, `src/lib/menu-colors.ts`(§6)의 고정 클래스 매핑 객체에 항목을 추가한다.
사이드바·대시보드 바로가기 카드 코드는 **수정할 필요가 없다** — 배열을 순회할 뿐이기 때문이다.

---

## 4. 화면별 설계

### 4.1 홈 대시보드 `/`

| 구성 | 내용 |
|---|---|
| 히어로 | `HomeIllustration` + "안녕하세요! ○○반 배움터예요" 같은 인사말(§1.4 Jua 제목 폰트) |
| 통계 타일 4개 | 전체 글 수 · 과학 글 수 · 수학 글 수 · 학습게임 수. 반응형 그리드(모바일 2열, `md` 이상 4열) |
| 메뉴 바로가기 카드 3개(홈 제외) | `menuItems`를 순회, 각 카드에 `illustration` + `label` + `description`, 클릭 시 `href`로 이동 |
| 최근 과학 수업 / 최근 수학 수업 | 각 3개, `TaggedPostList`(§4.3 공통 컴포넌트) 재사용, "더 보기 →"는 `/science/`, `/math/`로 링크 |
| 학습게임 미리보기 | `AppGrid`(§4.2, `limit={2}` 또는 `limit={3}`), "더 보기 →"는 `/games/` |
| 인기 글 | 조회수 상위 3개 |

**Supabase 쿼리**:
```ts
// 통계 타일 — count만 필요하므로 head:true로 본문 전송 없이 개수만 받는다
supabase.from('posts').select('id', { count: 'exact', head: true }).eq('published', true);
supabase.from('posts').select('id', { count: 'exact', head: true }).eq('published', true).contains('tags', ['과학']);
supabase.from('posts').select('id', { count: 'exact', head: true }).eq('published', true).contains('tags', ['수학']);
// 학습게임 수는 Supabase 쿼리가 아니라 webApps.length (src/data/apps.ts, 로컬 데이터)

// 최근 과학/수학 (§4.3 TaggedPostList가 내부에서 사용)
supabase.from('posts').select(POST_SUMMARY_COLUMNS).eq('published', true)
  .contains('tags', ['과학']).order('published_at', { ascending:false, nullsFirst:false }).range(0, 2);

// 인기 글: views 테이블을 count 내림차순으로 먼저 조회 → 글 정보 조인
const { data: top } = await supabase.from('views').select('post_id,count').order('count', { ascending:false }).limit(3);
const ids = top.map(v => v.post_id);
const { data: posts } = await supabase.from('posts').select(POST_SUMMARY_COLUMNS).in('id', ids).eq('published', true);
// posts를 top의 순서(count desc)에 맞게 재정렬해서 사용
```
`views` 테이블은 `select using (true)`로 RLS가 이미 공개 조회를 허용하므로(마이그레이션 확인) 스키마 변경 없이 가능하다. 조회수가 0인 글(=views 행이 없는 글)은 자연히 인기 글에서 제외된다(허용되는 동작으로 간주).

**상태**: 위 6개 섹션 각각 독립적으로 로딩(스켈레톤: 통계 타일은 회색 블록, 목록형은 기존 `PostCardSkeleton` 재사용)/빈("아직 ○○ 글이 없어요" + 귀여운 `EmptyBoxIllustration`)/오류(`ErrorState` 재사용, 섹션별 재시도) 상태를 갖는다. 한 섹션의 오류가 다른 섹션을 막지 않도록 섹션마다 독립적으로 `useEffect`/상태를 둔다(기존 `PostList`가 이미 이 패턴).

### 4.2 학습게임활동 `/games/`

- 게임 컨트롤러 히어로 일러스트 + 소개 문구.
- `AppGrid`(기존 컴포넌트, `src/data/apps.ts` 그대로 사용 — 스키마·데이터 구조 변경 없음)를 `limit` 없이 전체 렌더링.
- Supabase 호출 없음(순수 로컬 데이터). 앱이 없으면 기존 `AppGrid`의 빈 상태(`EmptyState`) 그대로 노출.

### 4.3 과학수업 `/science/`, 수학수업 `/math/`

두 화면은 **태그만 다른 동일한 컴포넌트**를 쓴다.

```ts
// src/components/class/tagged-post-list.tsx (신규)
export function TaggedPostList({ tag, limit, moreHref }: { tag: string; limit?: number; moreHref?: string }) { ... }
```
- `limit` 없으면 기존 `PostList`와 동일한 offset 기반 "더 보기" 페이지네이션(`.contains('tags',[tag])` 필터만 추가), `limit` 있으면 상위 N개만 보여주고 "더 보기" 대신 `moreHref` 링크(홈 대시보드 미리보기용).
- `src/app/science/page.tsx`, `src/app/math/page.tsx`는 각각 히어로 일러스트(`ScienceIllustration`/`MathIllustration`) + `<TaggedPostList tag="과학" />` / `<TaggedPostList tag="수학" />` 한 줄 차이만 남는다.

**Supabase**: `supabase.from('posts').select(POST_SUMMARY_COLUMNS).eq('published', true).contains('tags', [tag]).order('published_at', {ascending:false, nullsFirst:false}).range(offset, offset+N-1)` (`docs/blog/spec.md`의 `PostList`/`SearchView`가 쓰던 `.contains`/`.filter('tags','cs',...)` 패턴과 동일하게 구현 — 기존 코드에 이미 두 가지 방식이 있으므로 Build 단계에서 하나로 통일해서 재사용할 것).

**상태**: 로딩(`PostCardSkeleton` 3개) · 빈("아직 과학 수업 글이 없어요" + `EmptyBoxIllustration`, science/math 색상 prop) · 오류(`ErrorState` 재사용).

**권한**: 4개 화면 모두 공개(비로그인 열람 가능), 기존 `posts` RLS(`published or is_admin()`) 그대로 적용되므로 변경 없음.

---

## 5. SVG 일러스트 목록

전부 `src/components/illustrations/*.tsx`에 React 컴포넌트(순수 SVG, 외부 이미지·폰트 아이콘 아님)로 만든다. 색상은 하드코딩 hex 대신 `currentColor` 또는 `var(--{color}-soft|strong)`를 참조해 다크모드에서 자동 대응한다. 전부 `aria-hidden="true"`(장식용, 의미는 인접 텍스트가 전달).

| 이름 | 쓰이는 곳 | 묘사 | 색상 토큰 |
|---|---|---|---|
| `HomeIllustration` | 대시보드 히어로 | 둥근 지붕의 작은 학교 건물, 웃는 창문, 위로 뜬 종이비행기 | `--home-strong`(지붕/포인트), `--home-soft`(배경 블롭), `--foreground`(윤곽선) |
| `ScienceIllustration` | 과학수업 히어로/사이드바 카드 | 기포가 올라오는 플라스크, 고리 달린 행성, 손잡이 돋보기 | `--science-strong`/`--science-soft` |
| `MathIllustration` | 수학수업 히어로/사이드바 카드 | 삼각자·계산기·숫자 1·2·3, 컴퍼스 | `--math-strong`/`--math-soft` |
| `GameIllustration` | 학습게임활동 히어로/사이드바 카드 | 둥근 게임 컨트롤러 + 주변에 반짝이는 별 | `--games-strong`/`--games-soft` |
| `EmptyBoxIllustration` | 모든 빈 상태 공통(`EmptyState` 확장) | 뚜껑 열린 상자 안을 들여다보는 동글한 캐릭터, `accent?: MenuColor` prop으로 상자 리본 색만 바뀜 | `--muted`(상자), prop으로 받은 `--{color}-strong`(리본) |
| `ErrorFaceIllustration` | 모든 오류 상태 공통(`ErrorState` 확장) | 살짝 시무룩한 표정의 동그란 캐릭터(과하지 않게) | `--destructive`를 옅게(예: `--destructive/60`) |

일러스트는 `viewBox` 고정, `width`/`height`는 `className`으로 제어(예: `className="size-32"`)해 카드·히어로 등 여러 크기에서 재사용 가능하게 만든다.

---

## 6. 파일 구조

### 6.1 신규 파일

| 경로 | 역할 |
|---|---|
| `src/data/menu.ts` | 메뉴 정의 배열(§3) |
| `src/lib/menu-colors.ts` | `MenuColor → Tailwind 클래스` 고정 매핑 객체(동적 템플릿 문자열은 Tailwind JIT가 인식 못 하므로 `{ home: { soft: "bg-home-soft text-home-strong", ... }, ... }` 형태로 미리 나열) |
| `src/hooks/use-sidebar.ts` | 사이드바 펼침/접힘 상태(`localStorage`) + 모바일 드로어 open/close 상태, `SIDEBAR_INIT_SCRIPT`(FOUC 방지, §2.3) export |
| `src/components/layout/sidebar.tsx` | 데스크톱 고정 사이드바(레일/펼침), `menuItems` 순회 |
| `src/components/layout/mobile-nav-drawer.tsx` | 모바일 드로어. 기존 `ui/dialog.tsx`(`@base-ui/react/dialog` 기반, ESC/바깥클릭/포커스 트랩 이미 구현됨)를 재사용하되 `DialogContent`를 좌측 전체높이 슬라이드 패널로 커스텀 스타일링(중앙 모달 대신). 새 a11y 코드를 처음부터 짤 필요가 없다 |
| `src/components/layout/topbar.tsx` | 기존 `site-header.tsx`를 대체(로고, 모바일 햄버거, 검색/테마/유저메뉴는 그대로) |
| `src/components/dashboard/stat-tile.tsx` | 통계 타일 1개 + 스켈레톤 |
| `src/components/dashboard/menu-shortcut-card.tsx` | 메뉴 바로가기 카드(일러스트+설명) |
| `src/components/class/tagged-post-list.tsx` | 과학/수학 공통 목록(§4.3) |
| `src/components/illustrations/*.tsx` | §5의 6개 SVG 컴포넌트 |
| `src/app/games/page.tsx` | 학습게임활동(§4.2) |
| `src/app/science/page.tsx` | 과학수업(§4.3) |
| `src/app/math/page.tsx` | 수학수업(§4.3) |

### 6.2 수정 파일

| 경로 | 변경 내용 |
|---|---|
| `src/app/globals.css` | `--radius` 상향, accent 8토큰×2(light/dark), `@theme inline`에 색상/`--font-heading` 매핑 추가 |
| `src/app/layout.tsx` | `Jua` 폰트 추가, `SIDEBAR_INIT_SCRIPT` 삽입, 기존 `<main class="mx-auto max-w-3xl">` 제거하고 `Topbar + (Sidebar + Main) + Footer` 셸 구조로 교체(§2.1) |
| `src/app/page.tsx` | 대시보드(§4.1)로 전면 교체 |
| `src/components/site-header.tsx` | `Topbar`로 리네임/이동(`src/components/layout/topbar.tsx`) 또는 이 파일 내용을 갱신 — 로고 문구를 §7 사이트 이름으로 교체, 모바일 햄버거 버튼 추가 |
| `src/components/apps/app-grid.tsx` | `limit?: number` prop 추가(대시보드 미리보기용), 기존 사용처(변경 후 `/games/`)는 그대로 전체 렌더링 |
| `src/app/post/page.tsx`, `src/app/search/page.tsx`, `src/app/login/page.tsx`, `src/app/admin/page.tsx`, `src/app/admin/write/page.tsx` | 레이아웃이 더 이상 전역으로 `max-w-3xl`을 강제하지 않으므로, 각 페이지(또는 해당 뷰 컴포넌트) 최상단에 `<div className="mx-auto w-full max-w-3xl">`를 직접 추가해 기존 읽기 폭을 유지(§7) |

### 6.3 건드리지 않는 파일
`supabase/migrations/*.sql`, `src/lib/types.ts`, `src/lib/base-path.ts`, `src/lib/supabase.ts`, `src/lib/auth.ts`, `src/hooks/use-session.ts`, `src/hooks/use-theme.ts`, `src/components/post-card.tsx`, `src/components/tag-chip.tsx`, `src/components/states.tsx`(단, `EmptyState`/`ErrorState`가 옵션으로 illustration prop을 받도록 소폭 확장은 허용 — 시그니처 하위호환 유지), `src/components/apps/app-card.tsx`, `src/data/apps.ts`, `src/app/admin/**`(가드/에디터 로직), 인증/댓글/좋아요/조회수 관련 전 파일.

---

## 7. 기존 화면에 미치는 영향

| 화면 | 영향 | 조치 |
|---|---|---|
| 전역 레이아웃 | `<main>`이 사이드바 셸 안으로 이동, 전역 `max-w-3xl` 제거 | 아래 4개 화면이 각자 폭을 책임짐(§6.2) |
| 글 상세 `/post/` | 없음(기능) | 자체 `max-w-3xl` wrapper 추가만 |
| 검색 `/search/` | 없음(기능) | 자체 `max-w-3xl` wrapper 추가만 |
| 로그인 `/login/` | 없음(기능) | 자체 `max-w-3xl`(또는 폼이 좁으므로 `max-w-sm` 등 더 좁게 — Build 재량) wrapper 추가만 |
| 관리자 목록 `/admin/` | 없음(기능) | 자체 `max-w-3xl` wrapper 추가만 |
| 글 작성·수정 `/admin/write/` | 없음(기능). 다만 에디터(입력+미리보기)가 `max-w-3xl` 안에서 좁게 느껴질 수 있음 | 우선 `max-w-3xl` 유지, 답답하면 Build 단계에서 이 화면만 넓혀도 됨(§11 Q5) |
| 기존 `src/app/page.tsx`의 "최신 글"(전체 글, 태그 무관) 목록 | 대시보드에는 이 형태의 섹션이 없음(사용자가 확정한 대시보드 구성에 미포함) — 과학/수학 태그가 없는 일반 글은 대시보드에 노출되지 않고 `/search/`로만 찾을 수 있게 됨 | 의도된 동작으로 간주하고 진행. 문제라면 추후 "전체 글" 메뉴를 §3 방식으로 쉽게 추가 가능 |
| `src/components/post-list.tsx` | 더 이상 `/`에서 렌더링되지 않음(단, `fetchViewCounts`는 `search-view.tsx`가 계속 import) | 파일은 유지(재사용 가능성 보존), import 없는 것에 대한 lint 에러는 없음(default export 함수라 unused-export 규칙만 없으면 통과) |
| `SiteFooter` | 더 이상 `max-w-3xl` 컨테이너 안이 아님 | 컨텐츠 컬럼 폭에 맞춰 렌더(사이드바 제외 영역 전체 폭) |

---

## 8. 접근성·성능 체크리스트

**접근성**
- [ ] 사이드바 `<nav aria-label="주요 메뉴">`, 토글 버튼 `aria-expanded`(펼침/접힘 상태 반영) + `aria-controls`
- [ ] 모바일 드로어: `Dialog` 재사용으로 포커스 트랩/`Esc`/바깥 클릭 닫힘 자동 확보(§6.1). 열릴 때 첫 메뉴 항목 또는 닫기 버튼에 포커스 이동, 닫힐 때 햄버거 버튼으로 포커스 복귀(base-ui Dialog 기본 동작 확인 필요 — 안 되면 수동 처리)
- [ ] 현재 경로 메뉴 항목에 `aria-current="page"` 부여(기존 `search-view.tsx`의 `aria-current` 패턴과 동일)
- [ ] 모든 아이콘 전용 버튼(햄버거, 사이드바 토글)에 `aria-label`
- [ ] 키보드만으로 사이드바 펼침/접힘, 드로어 열기/닫기, 메뉴 이동 가능한지 Tab 순서 확인
- [ ] 색 대비: 파스텔 `soft` 배경 위 텍스트는 항상 `--foreground`/`--muted-foreground` 사용(파스텔 텍스트 금지), `strong` 토큰 위에 흰/검 아이콘을 올릴 때만 대비 실측
- [ ] 일러스트는 `aria-hidden="true"`, 정보 전달은 인접 텍스트가 담당
- [ ] `prefers-reduced-motion: reduce`에서 사이드바/드로어 transition 최소화

**성능**
- [ ] 폰트 1개(Jua) 추가, `subsets`를 필요한 것만(한국어) 지정해 preload 용량 최소화
- [ ] SVG 일러스트는 외부 요청 없는 인라인 컴포넌트(네트워크 이미지 0개 유지 — CLAUDE.md "외부 이미지 금지"와도 일치)
- [ ] 대시보드의 6개 데이터 섹션은 각자 독립적으로 fetch(하나가 느려도 나머지 렌더 안 막힘), 총 요청 수가 과도하지 않은지 확인(현재 설계 기준 posts count×3 + tagged posts×2 + views×1 + apps는 로컬 = 최대 6개 네트워크 요청)
- [ ] 사이드바 접힘/펼침은 CSS(`width`/`transform`) 전환만 사용, JS 레이아웃 스래싱 없는지 확인
- [ ] `next build` 정적 export 결과 페이지 수 증가(games/science/math 3개) 외에 번들 크기 급증 없는지 확인(신규 아이콘/일러스트가 tree-shaking 되는지)

---

## 9. 구현 단계 분할 (Build 서브에이전트 단위)

| 단계 | 범위 | 파일(주요) | 비고 |
|---|---|---|---|
| 0. 토큰·데이터 기반 | `globals.css` accent 토큰, `--radius`, `Jua` 폰트, `src/data/menu.ts`, `src/lib/menu-colors.ts` | §1, §3, §6.1 | 이후 모든 단계의 선행 조건 |
| 1. 레이아웃 셸 | `use-sidebar.ts`, `layout/sidebar.tsx`, `layout/mobile-nav-drawer.tsx`, `layout/topbar.tsx`, `layout.tsx` 조립 | §2 | 단계 0 이후, 다른 단계와 병렬 불가(레이아웃이 먼저 서야 화면들이 올라감) |
| 2. 기존 화면 폭 보정 | `post/`, `search/`, `login/`, `admin/`, `admin/write/` 각 페이지에 `max-w-3xl` wrapper만 추가 | §6.2, §7 | 단계 1 이후, 기능 변경 없이 얕게 — 3·4·5·6과 병렬 가능 |
| 3. 일러스트 세트 | `illustrations/*.tsx` 6종 | §5 | 단계 0 이후 독립적, 2·4·5·6과 병렬 가능 |
| 4. 학습게임활동 | `app-grid.tsx`(limit prop), `src/app/games/page.tsx` | §4.2 | 단계 1·3 이후 |
| 5. 과학/수학 수업 | `class/tagged-post-list.tsx`, `src/app/science/page.tsx`, `src/app/math/page.tsx` | §4.3 | 단계 1·3 이후, 4와 병렬 가능 |
| 6. 대시보드(홈) | `dashboard/stat-tile.tsx`, `dashboard/menu-shortcut-card.tsx`, `src/app/page.tsx` | §4.1 | 단계 3·4·5 완료 후(일러스트·TaggedPostList·AppGrid limit을 모두 가져다 씀) |
| 7. 마무리 | 사이트 이름/문구 교체(§11 Q1), 접근성·성능 체크리스트(§8), `npm run lint`/`npm run build`, 반응형·다크모드 QA | §10 | 전체 완료 후 |

---

## 10. 검증 방법

1. `npm run lint` — 통과, 신규 파일 기준 규칙 위반 없음.
2. `npm run build` — 정적 export 성공, `out/` 아래 `games/index.html`, `science/index.html`, `math/index.html`, `index.html` 생성 확인. 빌드 로그에 `next/font/google`(Jua) 관련 오류(§0 근거: subsets/네트워크 문제 가능성)가 없는지 확인.
3. 브라우저 수동 확인(데스크톱 ≥1280px, 태블릿 768px 부근, 모바일 375px):
   - [ ] 데스크톱: 사이드바 펼침/접힘 토글, 새로고침 후 상태 유지(localStorage)
   - [ ] 모바일: 햄버거 → 드로어 열림, 메뉴 클릭/바깥 클릭/Esc로 닫힘, `body` 스크롤 잠김 확인
   - [ ] 4개 메뉴 모두 이동 확인, 현재 위치 강조가 정확한 라우트에서만 켜지는지(특히 `/`가 다른 라우트에서 안 켜지는지)
   - [ ] 대시보드 6개 섹션 각각 데이터 있음/없음/네트워크 끊김(개발자도구 오프라인) 상태 확인
   - [ ] 라이트/다크 모드 전환 시 accent 색·일러스트·그림자/링 표현이 자연스러운지, 대비가 읽히는지
   - [ ] 기존 화면(글 상세/검색/로그인/관리자/에디터) 본문 폭과 기능이 그대로인지
   - [ ] 키보드만으로 사이드바·드로어 조작 가능한지(§8)

---

## 11. 열린 질문 (사용자 결정 필요)

| # | 질문 | 추천안 |
|---|---|---|
| Q1 | 사이트 이름/문구를 무엇으로 할지 | 예: "○○초 6-1 배움터", "우리반 자람터" 중 하나 — 실제 학급명을 넣은 짧고 다정한 이름 추천. 확정되면 `layout.tsx`의 `SITE_NAME`, 히어로 인사말에 반영 |
| Q2 | 사이드바 메뉴 아이콘도 직접 그린 SVG로 할지, 기존처럼 lucide-react 아이콘을 쓸지 | **lucide-react 유지** 추천(§0: 이미 전역에서 쓰는 아이콘 세트라 일관성·접근성 확보가 쉬움). 대신 대시보드 카드·히어로처럼 "크게 보이는 자리"에만 직접 그린 SVG 일러스트(§5) 사용 |
| Q3 | 사이드바 기본 상태(펼침/접힘)와 `localStorage` 키 이름 | 기본 **펼침**, 키 `sidebar:collapsed`(boolean) 추천 |
| Q4 | 제목용 폰트를 Jua로 확정할지(§1.4) | Jua 추천이나 최종 느낌은 실제 렌더링을 봐야 판단하기 쉬움 — Build 1단계 완료 후 Gaegu/Gowun Dodum과 나란히 스크린샷 비교해보고 확정하는 것도 가능 |
| Q5 | 글 작성·수정 에디터(`/admin/write/`)를 다른 화면처럼 `max-w-3xl`로 유지할지, 이번 기회에 더 넓힐지 | 우선 `max-w-3xl` 유지(기능/레이아웃 변경 최소화) 추천. 좁아서 불편하면 이 화면만 별도로 넓히는 후속 작업 제안 |

---

## 12. 확정 결정
2026-09-21 사용자 승인.

| 항목 | 결정 |
|---|---|
| Q1 사이트 이름 | **우리 반 배움터** (`SITE_NAME`, 히어로 인사말, metadata에 반영) |
| Q2 사이드바 아이콘 | lucide-react 유지, 큰 자리에만 직접 그린 SVG |
| Q3 사이드바 기본 상태 | 펼침, localStorage 키 `sidebar:collapsed` |
| Q4 제목 글꼴 | **Jua** |
| Q5 에디터 폭 | `max-w-3xl` 유지 |
| 추가 | 홈 대시보드에 **"최근 소식"**(태그 무관 전체 최신 글 5개) 섹션을 넣는다. §4.1의 구성에 추가하며, §7의 "최신 글 목록 미포함" 항목은 이 결정으로 대체된다. `TaggedPostList`의 `tag`를 선택값으로 만들어(없으면 전체 글) 재사용한다. "더 보기"는 `/search/`로 연결 |
