# 사이트 디자인 전면 개편 spec — "똑똑! 수학탐험대" 느낌 반영

> Plan 단계 산출물. **구현하지 않음.** Build 서브에이전트가 이 문서를 기준으로 작업한다.
> 대상: `docs/design/redesign/plan-instructions.md`에 정의된 범위.
> 이 문서는 2026-09-21 `docs/design/spec.md`(1차 디자인 개편, 이미 구현·배포됨)로 만들어진 사이드바·대시보드·Jua 제목 폰트·메뉴 4색 체계를 **뒤엎지 않고 그 위에 톤을 한 단계 올리는** 개편이다. 기존 토큰 이름은 최대한 유지하고, 값과 쓰임만 확장한다.

## 0. 전제·범위 요약

* **참고는 "느낌"만**: 배경 그라데이션, 알약 버튼, 둥근 큰 카드, 파스텔 그라데이션, 3D 그림, 굵고 둥근 글씨, 넉넉한 여백이라는 **형태 언어**만 가져온다. `plan-instructions.md`에 이미 기록된 1440px 관찰(§"참고 사이트 관찰")을 근거로 삼았고, 이번 Plan에서 사이트를 다시 열어 보지 않았다(그림·문구를 새로 옮겨 적을 위험을 아예 없애기 위해서다). 캐릭터·로고·문구·이미지·정확한 배색 수치는 그 사이트 것을 베끼지 않고 전부 새로 정한다.
* **범위**(`plan-instructions.md` "사용자 결정 §3"): 사이트 전체 화면(홈·과학수업·자유게시판·학습게임·글 보기·검색·로그인·비밀번호 변경·내 학습 활동) + 과학 앱 23개 공통 틀의 **색·글꼴·버튼 모양만** + 관리자 화면의 **색·글꼴만**. 새 기능(배너 캐러셀, 플로팅 챗봇 등 참고 사이트에 있던 요소 추가)은 만들지 않는다 — "느낌"이 아니라 "기능"이므로 범위 밖으로 본다.
* **정적 export 제약**(CLAUDE.md, 기존 `docs/design/spec.md` §0 그대로 유효): Server Actions/Route Handler/middleware 없음, `next/image`·`<img>`·`/apps/...` 링크는 `withBasePath()`(`src/lib/base-path.ts`) 수동 적용, `images.unoptimized:true`라 이미지는 커밋 시점에 이미 알맞은 크기여야 한다(요청 시점 자동 리사이즈 없음).
* **과학 앱 제약**(CLAUDE.md 웹앱 규칙): 앱은 `/public/apps/{앱이름}/` 안에서 자체 완결, 내부 참조는 상대경로만. 공통 코드는 정본(`scripts/templates/science-sim/`, `scripts/templates/science-guide/`)을 고쳐 23개 앱 폴더로 다시 복사한다.
* **읽은 파일**(근거): `src/app/globals.css`, `layout.tsx`, `page.tsx`, `src/data/menu.ts`, `src/lib/menu-colors.ts`, `src/components/layout/{sidebar,topbar,page-hero,mobile-nav-drawer}.tsx`, `src/components/illustrations/{parts,home-illustration}.tsx`, `src/components/dashboard/{menu-shortcut-card,stat-tile}.tsx`, `src/components/science/science-view.tsx`, `src/components/community/{community-post-list,game-player}.tsx`, `src/components/admin/admin-shell.tsx`, `src/components/states.tsx`, `src/app/login/login-form.tsx`, `src/app/me/learning/my-learning-view.tsx`, `src/data/science-curriculum.ts`, `src/components/ui/{button,card,badge}.tsx`, `next.config.ts`, `package.json`, `scripts/templates/{science-sim,science-guide}/style-common.css`, `public/apps/sci-6-1-2-3/index.html`, 기존 `docs/design/{spec.md,review.md}`.

---

## 1. 디자인 토큰

### 1.1 기존 토큰과의 대응표

| 기존 토큰(`globals.css`) | 처리 | 비고 |
|---|---|---|
| `--primary` / `--primary-foreground` | **값 교체**(무채색 → 새 브랜드 보라). §1.2 | 기본 `Button`(`variant="default"`)·`Badge`(`variant="default"`) 색이 사이트 전체에서 자동으로 보라로 바뀐다(컴포넌트 수정 불필요) |
| `--ring` | **값 교체**(중립 회색 → 옅은 보라 회색) | 메뉴색이 있는 곳은 기존처럼 `focus-visible:ring-{color}-strong/50`(개별 `focusRing`)를 그대로 쓰고, `--ring`은 그 외 일반 버튼·입력창에만 영향 |
| `--home/-games/-science/-board-soft/-strong` | **유지**(라이트·다크 값 그대로) | 1차 개편 Review에서 대비 실측을 마친 값이라 다시 흔들지 않는다. 배지·칩·아이콘·테두리는 계속 이 토큰만 사용 |
| `--radius` 및 `--radius-sm…4xl` 체인 | **유지**(`1rem` 기준) | 이미 `--radius-3xl ≈ 35px`로 참고 사이트가 준 인상(모서리 약 24px)보다 넉넉하다. 새로 필요한 건 반경 숫자가 아니라 §1.3의 "알약" 사용 규칙 |
| `--font-heading` → `--font-heading-kr`(Jua) | **유지** | 이미 "두껍고 동글동글"이라 참고 사이트 인상과 맞는다(§2에서 근거) |
| `--font-sans`(Geist) | **유지**하되 실제로 로드되는 한글 본문 글꼴을 새로 추가 | §2 |
| (그림자) 기존 `shadow-lg` + `ring-foreground/10` 관례 | **유지 + 신규 변수 추가** | §1.4 |
| (신규) `--home/-games/-science/-board-grad-to` | **신규 추가**(from은 기존 `-soft` 재사용) | §1.2, 큰 카드 배경 그라데이션 전용 — 배지·칩에는 쓰지 않는다 |
| (신규) `--bg-grad-top`, 배경 장식 블롭 | **신규 추가** | §1.2 |
| (신규) `--shadow-sm/md/lg/brand` | **신규 추가** | §1.4 |

### 1.2 팔레트

**브랜드 보라(신규, 메뉴색과 별개의 "사이트 포인트색")**

| 토큰 | light | dark |
|---|---|---|
| `--primary` | `oklch(0.58 0.19 288)` | `oklch(0.75 0.15 288)` |
| `--primary-foreground` | `oklch(0.99 0 0)`(흰 글자) | `oklch(0.18 0.05 288)`(짙은 보라 글자) |
| `--ring` | `oklch(0.7 0.06 288)` | `oklch(0.55 0.08 288)` |

다크에서 배경색이 밝아지고 글자가 짙어지는 건 기존 `--primary`(무채색)가 이미 쓰던 반전 규칙을 그대로 옮긴 것이다(1차 개편에서 설계된 관례 유지). 정확한 명도·대비는 Review에서 실측(§6 참고).

**메뉴 4색 그라데이션(신규 — 큰 카드 전용, 기존 soft/strong은 그대로 둠)**

기존 `-soft`를 그라데이션 시작색으로 재사용하고, 끝색만 새로 추가한다(색상 새로 안 늘어남, 변수만 4개 추가).

| 메뉴 | 그라데이션(135deg) | `-grad-to` light | `-grad-to` dark |
|---|---|---|---|
| home(하늘) | `var(--home-soft)` → `var(--home-grad-to)` | `oklch(0.90 0.05 218)` | `oklch(0.36 0.07 218)` |
| games(분홍·복숭아) | `var(--games-soft)` → `var(--games-grad-to)` | `oklch(0.91 0.05 352)` | `oklch(0.36 0.08 352)` |
| science(민트) | `var(--science-soft)` → `var(--science-grad-to)` | `oklch(0.90 0.05 148)` | `oklch(0.36 0.07 148)` |
| board(주황·노랑) | `var(--board-soft)` → `var(--board-grad-to)` | `oklch(0.90 0.06 48)` | `oklch(0.36 0.08 48)` |

끝색은 시작 색상(hue)에서 20° 안팎만 틀어 "파스텔 그라데이션" 느낌만 내고, 각 메뉴의 색 정체성(색상 이름)은 그대로 유지했다. 그라데이션은 **큰 카드(기능 바로가기 카드, 히어로 패널)에만** 쓰고, 작은 칩·배지·아이콘은 계속 단색 `-soft`/`-strong`을 쓴다(대비 계산이 단색일 때만 안정적이기 때문).

**배경 그라데이션 + 블롭(신규)**

```css
--bg-grad-top: oklch(0.97 0.02 288);   /* dark: oklch(0.20 0.035 288) */
```

`body` 배경에 `linear-gradient(180deg, var(--bg-grad-top) 0%, var(--background) 55%)`를 깔고, `main` 바깥에 `position:fixed; inset:0; z-index:-1; pointer-events:none; aria-hidden` 레이어를 하나 둬 `border-radius:50%`인 흐린 원 2~3개(`filter:blur(60px)`, 배경색 `color-mix(in oklch, var(--primary) 16%, transparent)`, 다크는 10%)를 떠 있게 한다. 순수 CSS이고 정적이라(움직이지 않음) `prefers-reduced-motion` 대응이 따로 필요 없다. 이미 `color-mix()`를 과학 앱 CSS에서 쓰고 있어 같은 문법을 그대로 재사용한다.

### 1.3 모서리·버튼 모양

반경 체인(`--radius-*`)은 안 바꾼다. 대신 **"알약 버튼" 사용 규칙**을 새로 정한다(참고 사이트의 "알약 모양 흰 버튼 / 보라 그라데이션 알약 버튼" 인상):

* **큰 CTA만 `rounded-full`**: 히어로의 주요 행동 버튼, 과학수업 차시 상세의 "실험 시뮬레이션 시작하기", 로그인 버튼, 글쓰기 저장 버튼 등 화면당 1~2개인 "가장 중요한 버튼"만 알약 모양 + `--shadow-brand`(§1.4).
* 그 외(폼 제출, 아이콘 버튼, 카드 안 작은 링크, 관리자 화면 버튼)는 기존 `rounded-lg`(shadcn 기본)를 유지 — 버튼이 화면에 많은 목록형 화면에서 전부 알약으로 바꾸면 오히려 산만해진다.
* `MenuShortcutCard`의 "바로 가기" 알약(`rounded-full bg-card`)은 이미 이 규칙과 같은 모양이라 그대로 둔다.

### 1.4 그림자

| 토큰 | light | dark | 쓰임 |
|---|---|---|---|
| `--shadow-sm` | `0 1px 2px oklch(0 0 0/0.05)` | 동일 | 기본 카드(현재 `ring-1 ring-foreground/10`와 병행) |
| `--shadow-md` | `0 6px 16px -4px oklch(0 0 0/0.08)` | 동일(다크는 ring 위주라 영향 작음) | hover 카드, 정보 카드 |
| `--shadow-lg` | `0 16px 32px -8px oklch(0 0 0/0.12)` | 동일 | 히어로 패널, 마스코트 |
| `--shadow-brand` | `0 10px 24px -6px color-mix(in oklch, var(--primary) 45%, transparent)` | 25%(다크는 옅게) | §1.3의 알약 CTA 버튼 전용 |

다크 모드는 기존 관례(그림자 대신 `ring-foreground/10`)를 계속 우선하고, `--shadow-brand`만 낮은 불투명도로 예외를 둔다(보라 배경 버튼 자체가 다크에서도 밝은 색이라 은은한 글로우가 자연스럽게 보임 — Review에서 실물 확인).

### 1.5 글자 크기 단계

| 단계 | 크기 | 쓰임 | 글꼴 |
|---|---|---|---|
| Display | `text-4xl`(36px) → `@2xl:text-5xl`(48px) | 홈 히어로 제목만(기존 `text-3xl→4xl`에서 한 단계 확대) | Jua |
| H1 | `text-2xl → text-3xl` | 화면 히어로/섹션 대제목(기존 유지) | Jua |
| H2 | `text-xl → text-2xl` | 카드 제목, 서브섹션 제목(기존 유지) | Jua |
| Body | `text-base`(16px), `leading-relaxed` | 본문·설명 | 본문 글꼴(§2) |
| Small/Meta | `text-sm`(14px) / `text-xs`(12px) | 배지, 메타정보, 캡션 | 본문 글꼴 |

Display만 한 단계 키운 이유: 나머지를 다 키우면 정보 밀도가 높은 화면(과학수업 차시 목록, 게시판, 관리자)이 답답해진다. "아주 굵은 큰 제목"이라는 인상은 히어로 한 곳에서만 강하게 내고, 목록형 화면은 지금의 절제된 크기를 유지한다.

### 1.6 여백

새 토큰 없이 기존 Tailwind spacing만 한 단계씩 넉넉하게 조정한다: 정보/기능 카드 패딩 `p-5`→`p-6`, 히어로 패딩 `@2xl:py-8`→`@2xl:py-9 @2xl:px-10`(대략), 기능 카드 grid gap `gap-4`→`gap-5`. 섹션 간 세로 간격(`gap-10`)은 유지.

---

## 2. 글꼴

### 2.1 제목: Jua — 유지, 교체하지 않음

1차 개편에서 이미 Jua(우아한형제들 배포, Google Fonts 등재, **SIL Open Font License 1.1**)를 제목 전용으로 적용했고, 그 spec의 자체 비교표(§1.4)에서도 "두껍고 동글동글, 임팩트 강함 ★★★★★"로 이미 참고 사이트가 주는 인상과 같은 방향이다. `next/font/google`로 이미 빌드 시점에 자체 호스팅되고 있어(요청 시점에 Google 서버를 안 탄다) 교체 시 얻는 이득보다 회귀 위험(폰트 재검증, `font-synthesis:none` 등 기존 튜닝 재확인)이 크다. **그대로 둔다.** 더 굵은 대안(Do Hyeon 등)은 §9 열린 질문에 대안으로만 남긴다.

### 2.2 본문: Pretendard 신규 도입

**문제**: 지금 한글 본문은 실제로 로드되는 웹폰트가 없다. `--font-sans`(Geist)는 라틴 전용이라 한글은 전부 OS 기본 글꼴(Mac: Apple SD Gothic Neo, Windows: 맑은 고딕, Android: Noto Sans KR)로 떨어진다 — 기기마다 인상이 달라 "다듬어진 제품" 느낌이 약하다. `globals.css`의 `"Pretendard"`는 지금은 **설치돼 있으면 쓰는 폴백 이름일 뿐 실제로 로드하고 있지 않다.**

**결정**: **Pretendard**(길형진/오리온, **SIL Open Font License 1.1**, GitHub `orioncactus/pretendard`)를 본문 글꼴로 실제 로드한다. 둥글고 현대적인 인상이 Jua와 잘 어울리고, 한글 웹폰트 중 가장 널리 검증된 선택이다.

* **불러오는 방법(블로그, 정적 export)**: `next/font/local`로 정적 서브셋 2 weight(Regular 400, SemiBold 600)만 자체 호스팅한다. 파일은 `src/app/fonts/pretendard/`에 두고(예: `Pretendard-Regular.woff2`, `Pretendard-SemiBold.woff2`), `variable:"--font-body-kr"`로 선언, `OFL.txt`도 같은 폴더에 같이 커밋한다(라이선스 고지). `globals.css`의 폴백 스택을 `var(--font-sans), var(--font-body-kr), "Apple SD Gothic Neo", ...`로 갱신 — `--font-sans`(Geist, 라틴/숫자)가 먼저, 한글이 필요한 글자는 Pretendard로 자연히 넘어간다.
  * Bold(700)은 따로 안 받는다. 굵게 강조할 자리는 제목 글꼴(Jua)이나 `font-semibold`(600)로 충분하고, 두 weight만으로도 지금 쓰는 `font-medium`/`font-semibold`/`font-bold` 대부분을 커버할 수 있다(600을 700 자리에도 매핑). 꼭 700이 필요한 자리가 나오면 Build 단계에서 weight 파일을 1개 더 추가.
  * Pretendard는 Google Fonts 카탈로그에 없어 `next/font/google`을 못 쓴다 — 파일을 직접 받아 커밋해야 한다(**다운로드는 Build 단계, 이 Plan에서는 하지 않는다**).
* **용량**: 정적 서브셋 woff2는 weight당 대략 250~450KB(한글 전체 음절 포함, 실제 값은 Build에서 받아 본 파일 기준으로 확인). 2 weight 합계 500KB~900KB 예상 — §7 성능 예산에 반영.
* **과학 앱(정적 HTML)에서 같은 글꼴 쓰는 방법**: 과학 앱은 Next.js 빌드가 없어 `next/font`를 못 쓴다. **같은 woff2 파일(Jua 1개 + Pretendard 2개)을 `scripts/templates/science-sim/fonts/`, `science-guide/fonts/`에 두고 `@font-face`로 상대경로(`url("./fonts/....woff2")`)로 불러온다.** `style-common.css` 맨 앞에 `@font-face` 3개를 추가하고 `--ss-font`(본문)를 Pretendard로, 새 `--ss-font-heading`(Jua)을 단계 제목류에만 적용한다. 이 방법은 앱마다 폰트 파일이 물리적으로 복제되지만(23개 × 약 0.6~1MB) 장점이 크다: 앱이 여전히 완전히 자체 완결이고(CLAUDE.md 웹앱 규칙의 "상대경로만" 원칙과 맞음), 학교 와이파이가 느리거나 외부 CDN이 막혀도 7분 활동 도중 글꼴 요청이 끊길 일이 없다. 대안(Google Fonts CDN `@import`, 외부 의존이지만 저장소 용량은 안 늘어남)은 §9 열린 질문 Q2로 남긴다.
  * Jua도 같은 방식으로 자체 호스팅한다(과학 앱 쪽만 — 블로그는 이미 `next/font/google`로 충분). Jua는 `--ss-stage-title`, `.ss-q-num`, 버튼 라벨류 등 "제목·라벨"에만 적용하고, **측정값 입력·표시(`.ss-num-input`, `.ss-numtable`, `.ss-cd-num`)에는 쓰지 않는다** — Jua는 숫자 판독성이 떨어지는 장식 글꼴이라, 소수 첫째 자리 측정값처럼 정확히 읽어야 하는 자리는 계속 Pretendard(tabular-nums)로 남긴다. 과학적 정확성·측정 규칙(CLAUDE.md)에 영향 없음을 명시.

### 2.3 라이선스 고지

Jua·Pretendard 모두 SIL OFL 1.1 — 재배포·서브셋·자체 호스팅 모두 허용(원 폰트 이름을 그대로 참칭하지 않는 한). `OFL.txt` 원문을 `src/app/fonts/pretendard/OFL.txt`(블로그)와 `scripts/templates/science-sim/fonts/OFL.txt`(과학 앱, science-guide도 동일)에 각각 둔다.

---

## 3. 3D 아이콘 목록 (Fluent Emoji 3D, MIT)

**적용 범위는 블로그(Next.js)뿐이다.** 과학 앱 23개는 §0/CLAUDE.md 결정대로 색·글꼴·버튼 모양만 바뀌므로 3D 아이콘을 추가하지 않는다(자체완결 원칙상 앱마다 이미지까지 복제하는 부담도 없다).

### 3.1 아이콘 목록

메뉴 4개 아이콘을 사이드바·카드·섹션 헤더·배지에서 **재사용**해 하나의 아이콘 언어로 통일한다(신규 파일 수를 줄이고, 참고 사이트처럼 "같은 그림이 메뉴→카드→배지로 이어지는" 일관성을 만든다).

| 이모지 이름(Fluent) | 원본 경로(추정, Build에서 실제 목록 확인 후 다운로드) | 쓰일 곳 | 대체하는 것 |
|---|---|---|---|
| House | `assets/House/3D/house_3d.png` | 사이드바 "홈", 대시보드 히어로 로고 옆(선택) | lucide `HouseIcon` |
| Video Game | `assets/Video Game/3D/video_game_3d.png` | 사이드바 "학습게임활동", 홈 기능 카드, `DashboardSection`/`AdminNav` 게임류 아이콘, 스탯 타일 "학습게임" | lucide `Gamepad2Icon` |
| Test Tube | `assets/Test Tube/3D/test_tube_3d.png` | 사이드바 "과학수업", 홈 기능 카드, 스탯 타일 "과학 차시 앱", 과학수업 차시 목록의 "실험 앱" 배지 | lucide `FlaskConicalIcon` |
| Speech Balloon | `assets/Speech Balloon/3D/speech_balloon_3d.png` | 사이드바 "자유게시판", 홈 기능 카드, 스탯 타일 "자유게시판 글" | lucide `MessageSquareIcon` |
| Newspaper | `assets/Newspaper/3D/newspaper_3d.png` | 스탯 타일 "선생님 글" | lucide `NewspaperIcon` |
| Package | `assets/Package/3D/package_3d.png` | 빈 화면(`EmptyState`) 공통 그림 1종(리본/바탕 색만 accent로 바뀜) | `EmptyBoxIllustration`(SVG, 유지 — 아래 3.2 참고) |
| Magnifying Glass Tilted Right | `assets/Magnifying Glass Tilted Right/3D/magnifying_glass_tilted_right_3d.png` | 과학수업 차시 목록의 "조사 도우미" 배지 | 없음(신규, 지금은 텍스트만) |

총 7개 PNG. 정확한 폴더·파일명은 Microsoft `fluentui-emoji` 저장소(MIT)의 실제 디렉터리 표기(대소문자·띄어쓰기)를 Build 단계에서 확인한 뒤 내려받는다 — **이 Plan에서는 다운로드하지 않는다.**

### 3.2 3D 아이콘으로 바꾸지 않는 것(의도적 제외)

* **기능/상태 아이콘**(잠금 `LockIcon`, 숨김 `EyeOffIcon`, 재시도 `RotateCwIcon`, 게임 실행기의 재생/정지/전체화면, 관리자 메뉴 아이콘 등): 명확성이 우선인 자리라 lucide-react 단색 아이콘을 유지한다. 1차 개편 spec §11 Q2가 이미 "큰 장식 자리만 그림, 작은 기능 자리는 lucide"로 정해 둔 원칙을 3D 아이콘에도 그대로 확장한 것이다.
* **오류 상태**(`ErrorFaceIllustration`): 기존 손그림 SVG를 유지한다. 작고 드물게 보이는 상태라 래스터 자산을 새로 추가할 실익이 적고, `currentColor` 기반이라 다크모드 대응이 이미 되어 있다.
* **관리자 화면**: 사용자 결정 §3대로 색·글꼴만 바꾸므로 관리자 사이드 메뉴 아이콘(`adminNavItems`)은 lucide 그대로 둔다.

### 3.3 저장 위치·최적화·basePath

* 저장 위치: `public/illustrations/3d/{slug}.png`(원본) + `public/illustrations/3d/{slug}.webp`(최적화본, 가능하면). 라이선스 고지: `public/illustrations/3d/LICENSE-fluent-emoji.txt`에 MIT 전문 + "Icons by Microsoft Fluent Emoji" 출처 표기.
* **최적화**: 소스 PNG를 실제 표시 크기의 최대 2배(레티나 대응) 픽셀로 리사이즈한 뒤 커밋한다(예: 사이드바 칩 36px 표시 → 소스 96~120px, 카드 56px 표시 → 소스 144px). `next.config.ts`의 `images.unoptimized:true` 때문에 Next.js가 요청 시점에 리사이즈해 주지 않으므로, **커밋되는 파일 자체가 이미 알맞은 크기여야 한다.** WebP 변환은 저장소에 `sharp` 등 이미지 처리 패키지가 없으므로(package.json 확인됨) macOS 내장 `sips -s format webp`나 Homebrew `cwebp`가 Build 환경에 있는지 먼저 확인하고, 없으면 리사이즈한 PNG만 사용한다(용량은 늘지만 정확성이 우선). 7개 × 15~40KB(WebP 기준) 또는 30~70KB(PNG 기준) 목표.
* **basePath**: 블로그 코드에서는 `next/image` 또는 `<img>`의 `src`에 `withBasePath("/illustrations/3d/house.webp")`(기존 `src/lib/base-path.ts` 헬퍼 재사용)를 반드시 붙인다. 하드코딩 절대경로 금지(CLAUDE.md).
* **접근성**: 전부 장식용 `aria-hidden`, 의미는 인접 텍스트 라벨이 전달(기존 SVG 일러스트와 같은 원칙). 사이드바 칩처럼 활성/비활성 구분이 필요한 자리는 **아이콘 색(불가능 — 래스터라 tint 불가)이 아니라 칩 배경·행 전체 배경(`colors.softBg`)으로 구분**한다(현재도 이미 그렇게 구현돼 있어 회귀 없음).

---

## 4. 화면별 설계

공통 주의사항(1차 개편 Review에서 실제로 겪은 버그, §2 재발 방지): 사이드바가 있는 상태에서 본문 컬럼 폭은 **뷰포트 폭이 아니다.** 레이아웃 분기는 전부 `@container`(컨테이너 쿼리) 기준으로 하고, 화면 뷰포트 브레이크포인트(`sm:`/`md:`)는 사이드바 영향이 없는 최상위 셸(사이드바 자체의 표시 여부 등)에만 쓴다. 아래 "태블릿 가로/세로·375px" 표기는 실제 표시 폭(사이드바 펼침 시 더 좁아짐) 기준으로 이해한다.

### 4.1 사이드바 (`src/components/layout/sidebar.tsx`)

* 폭·펼침/접힘 메커니즘은 그대로. 칩 아이콘만 lucide → 3D 아이콘(House/Video Game/Test Tube/Speech Balloon, §3.1)으로 교체.
* 칩 바탕: 비활성은 `colors.chip`(soft 배경) 유지, 활성은 `bg-card` 유지 — 아이콘이 풀컬러라 배경 대비만으로 활성 표시.
* 하단 "오늘도 즐겁게!" 카드: 배경을 `--brand`를 살짝 섞은 톤(`bg-[color-mix(in_oklch,var(--muted)_85%,var(--primary)_15%)]` 등)으로 미세하게 보라 기가 돌게(선택, 과하면 원래 `bg-muted/60` 유지).
* 접힘(레일) 상태: 칩만 남고 라벨 숨김은 기존과 동일. 3D 아이콘도 36px 칩 안에서 충분히 식별 가능(Fluent 3D는 저해상도에서도 형태가 뚜렷하게 디자인됨).
* 모바일 드로어(375px): 동일 `NavMenuList` 재사용이라 자동 반영. 드로어 폭(288px)·열고 닫힘 메커니즘 변경 없음.

### 4.2 머리말(Topbar)

* 높이(56px)·sticky·blur 배경 유지. 로고(`LogoMark`, 새싹+웃는 얼굴 SVG)는 유지 — 이미 손그림 SVG라 새로 그릴 필요 없고, 마스코트와 톤이 이어지는 소재(새싹)라 §5의 마스코트 방향에도 참고.
* 검색/테마/유저메뉴 아이콘 버튼: 지금처럼 `variant="ghost" size="icon"` 유지(작은 기능 아이콘 = lucide 원칙).
* 배경: `bg-background/85 backdrop-blur` 그대로 두되, 페이지 배경에 새 그라데이션(§1.2)이 깔리므로 topbar 아래로 은은하게 비쳐 보이는 정도만 확인(Review에서 스크롤 시 겹침 확인).

### 4.3 홈 (`src/app/page.tsx`)

**첫 화면(히어로)**

```
@container 기준, 672px(@2xl) 이상: 가로 배치           672px 미만: 세로 배치(마스코트 위/아래)
┌───────────────────────────────────────────┐        ┌───────────────────────┐
│ [eyebrow 알약: 점 + "오늘도 반가워요"]         │        │      (마스코트)         │
│ 안녕하세요!                                  │        │   안녕하세요! ○○예요     │
│ 우리 반 배움터예요        (마스코트, 인사 포즈)  │        │   설명 두 줄            │
│ 설명 두 줄                                   │        │   [보라 알약 CTA]       │
│ [보라 알약 CTA: "구경하기" 또는 최근 글로]      │        └───────────────────────┘
└───────────────────────────────────────────┘
```

* 배경은 `home` 그라데이션(§1.2) + soft 테두리 유지(기존 `PageHero` 컴포넌트 확장, `color="home"` 그대로).
* 기존 `HomeIllustration`(학교 건물 SVG) 자리를 **마스코트**(§5, 인사 포�즈)로 교체한다. `HomeIllustration` 컴포넌트 자체는 지우지 않고 남겨 둔다(다른 빈 자리에 재사용 가능성, §9 열린 질문).
* 제목만 Display 크기(§1.5)로 확대. CTA 버튼 하나 추가(예: "무슨 일이 있었는지 보기" → 최근 소식이나 과학수업으로) — 참고 사이트의 "알약 버튼" 인상을 홈에도 하나는 두기 위함. 기존에 CTA가 없었으므로 신규 추가이며, 실제 문구·목적지는 Build 단계에서 사용자 확인.
* 태블릿 세로(768×1024 부근, 사이드바 펼침이면 본문 약 500px대)는 세로 배치로 자연히 전환(@container 임계값 672px 기준이라 이미 대응됨).

**기능 카드 3개(메뉴 바로가기, `MenuShortcutCard`)**

* 배경만 단색 `softBg` → **그라데이션**(`§1.2`, `linear-gradient(135deg, var(--{color}-soft), var(--{color}-grad-to))`)로 교체.
* 일러스트 자리: 기존 손그림 SVG(`GameIllustration`/`ScienceIllustration`/`BoardIllustration`) 대신 **3D 아이콘**(Video Game/Test Tube/Speech Balloon)을 카드 중앙 큰 사이즈(약 72~96px)로. 참고 사이트의 "가운데 큰 3D 물건" 인상.
* "바로 가기" 알약은 유지(이미 알약 모양).
* 카드 3개 배치: 기존 `@2xl:grid-cols-3` 로직 유지(1차 Review에서 검증된 컨테이너 기준 분기).

**정보 카드 줄(최근 과학 수업 / 최근 자유게시판 / 학습게임 미리보기)**

* `DashboardSection`의 아이콘 칩(현재 lucide)을 3D 아이콘(재사용)으로. "더 보기 +" 알약은 유지.
* 카드 자체(`PostCardSkeleton`류, 목록 항목)는 지금처럼 흰 배경 + `ring-foreground/10` 유지, 그라데이션은 안 쓴다(목록은 텍스트 밀도가 높아 그라데이션 배경이면 가독성이 떨어짐 — 참고 사이트도 정보 카드는 흰 배경이었다는 관찰과 일치).
* 참고 사이트에 있던 "떠 있는 3D 로봇 도우미 + 말풍선"(고정 플로팅 위젯)은 **만들지 않는다**(§0, 기능 확장이라 범위 밖).

**375px**: 히어로 세로 스택, 기능 카드 1열, 정보 카드 섹션 1열 — 전부 기존 반응형 그대로(1차 개편에서 이미 375px 확인됨), 그라데이션·3D 아이콘 교체는 레이아웃에 영향 없음.

### 4.4 과학수업 (`src/components/science/science-view.tsx`, 4단계: 학기→단원→차시→상세)

* `SectionHeader`/`PageHero`의 soft 배경 → science 그라데이션.
* `TermCard`/단원 카드/차시 카드(`cardLink`)의 번호 칩(`colors.chip`)은 유지(작은 숫자 칩이라 3D 아이콘 대상 아님, 텍스트 "1", "2" 표시가 핵심 정보라 그림으로 바꾸면 오히려 안 좋음).
* `LessonMeta`의 "실험 앱"/"조사 도우미" 표시에 3D 아이콘(Test Tube/Magnifying Glass, §3.1) 추가 — 지금은 lucide `FlaskConicalIcon` + 텍스트뿐.
* 차시 상세의 CTA("실험 시뮬레이션 시작하기")는 §1.3 알약 규칙 적용(지금도 `rounded-2xl`이라 `rounded-full`로 한 단계만 조정).
* Breadcrumb·이전/다음 차시 카드는 텍스트 밀도가 높으므로 색·글꼴만(그라데이션·3D 아이콘 없음).
* 태블릿 가로(사이드바 펼침 시 본문 약 1000px+): 단원 카드 2열 유지. 태블릿 세로(본문 약 500~600px): 1열. 375px: 1열, `SectionHeader` 패딩만 축소(`px-5`) — 기존과 동일.

### 4.5 자유게시판 (`/board/`) · 학습게임 (`/games/`)

* `CommunityPostList`/`CommunityPostCard`: 색·글꼴만(카드 자체는 목록형이라 그라데이션 없음, §4.3 정보 카드와 같은 원칙). "학습게임" 카드의 `Gamepad2Icon` 칩만 3D 아이콘으로.
* 글쓰기(`/board/new/`, `/games/new/`) 폼: `Card` 컴포넌트 색·글꼴만(버튼은 "등록" 같은 주요 액션 1개만 알약 후보 — Build 재량).
* **학습게임 실행 화면(`GamePlayer`)은 손대지 않는다.** 샌드박스 iframe·CSP 래퍼·"게임 시작" 버튼의 동작은 CLAUDE.md의 절대 보안 규칙(업로드 게임 보안)과 직결되므로, 색만 살짝(예: "게임 시작" 버튼을 알약 primary로) 바꾸고 구조·sandbox 속성·버튼 로직은 그대로 둔다. Review에서 이 부분은 특히 "동작 변경 없음"을 코드 diff로 확인한다.
* 375px/태블릿: 기존 목록 반응형 그대로.

### 4.6 글 보기(`/post/`), 검색(`/search/`)

* `MarkdownViewer`(`.markdown-body`)의 본문 글꼴이 이번에 Pretendard로 실제로 바뀌는 첫 체감 지점 — 글자 간격·줄간격(`line-height:1.8`)이 Pretendard 기준으로도 괜찮은지 Review에서 실제 글 1편으로 확인.
* 검색 결과 카드·입력창: 색·글꼴만.
* 폭(`max-w-3xl`)·기능은 1차 개편에서 확정된 대로 변경 없음.

### 4.7 로그인(`/login/`) · 비밀번호 변경(`/reset-password/`)

* `Card` 컴포넌트를 그대로 쓰되(`CardTitle`이 이미 `font-heading`), 로그인 버튼(`size="lg"`, 비밀번호 로그인)만 §1.3 알약 규칙 적용. GitHub/Google OAuth 버튼(`variant="outline"`)은 아이콘이 브랜드 아이콘(실제 GitHub/Google 로고)이라 **모양만** 알약으로 맞추고 색은 그대로(로고 색은 각 서비스 고유색이라 손대지 않음 — 상표 표시 성격).
* 배경: 페이지 전역 그라데이션(§1.2)이 카드 뒤로 은은하게 비치는 정도. 카드 자체는 흰/카드색 유지(폼 입력 가독성 우선).
* 375px: `max-w-sm` 카드가 화면 폭에 맞게 자동 축소, 변경 없음.

### 4.8 내 학습 활동(`/me/learning/`)

* 탭(`Tabs`/`TabsList`/`TabsTrigger`) 색만(활성 탭 표시에 `--primary` 반영 여부는 shadcn 기본 스타일 확인 후 Build 재량).
* `UnreadCount` 배지: 기존 알림용 색(destructive 계열 추정) 유지 — 기능 배지라 브랜드색으로 안 바꿈(눈에 띄어야 하는 알림이므로).
* 탭 콘텐츠(웹앱 결과/읽은 글/댓글·좋아요/과제/피드백) 내부 컴포넌트는 색·글꼴만.

### 4.9 관리자(`/admin/**`)

* 사용자 결정대로 **색·글꼴만**. `AdminShell`의 사이드 메뉴 칩(`colors.chip`)·활성 표시는 지금 구조 그대로, lucide 아이콘 유지(§3.2). `AdminPageHeader`의 `h1`(현재 `font-semibold`, `font-heading` 아님)은 이번에 `font-heading`으로 통일할지 Build 재량(제목 폰트 일관성 vs 관리자 화면은 밀도가 높아 Jua가 안 어울릴 수 있음 — Review에서 실물 확인 후 판단, 안 어울리면 그대로 `font-semibold` 유지).
* 새 `--primary`(보라)가 관리자의 "저장"/"승인" 같은 버튼에도 그대로 반영됨 — 관리자 화면에서 너무 장난스러워 보이지 않는지 Review에서 확인(과하면 관리자 영역만 `--primary` 채도를 살짝 낮추는 것도 옵션, §9).

---

## 5. 마스코트(자리·크기·자세·형식만 — 이미지는 이 Plan에서 만들지 않음)

> **발견 사항**: 이 Plan을 쓰는 중 `public/illustrations/mascot/`(git에 아직 커밋 안 됨, untracked)에 이미 후보 이미지 4장이 놓여 있는 것을 확인했다(파일명이 자동 생성된 형태라 이 Plan 지침이나 `plan-instructions.md`에는 안내가 없었음 — Claude가 만든 파일이 아니라 사용자가 미리 준비해 둔 것으로 보인다). 내용을 확인해 보니 **보라·민트 색 실험 가운·고글 차림의 아기 부엉이 과학자 캐릭터** 한 종류로, 아래처럼 이 문서가 독자적으로 정한 4개 자세와 우연히 정확히 대응한다:
>
> | 파일 | 내용 | 대응하는 자세 |
> |---|---|---|
> | `AaDQgXYW...jpg` | 시험관을 들고 한쪽 날개를 들어 밝게 웃는 모습 | 인사(§5 ①)에 가장 가까움 |
> | `AaDQgYsY...jpg` | 턱에 날개를 대고 물음표가 떠 있는 모습 | 생각하기(§5 ③)와 정확히 일치 |
> | `AaDQgZYD...jpg` | 양 날개를 들고 눈을 감은 채 웃음, 색종이 조각 날림 | 축하하기(§5 ④)와 정확히 일치 |
> | `AaDQgYH8...jpg` | 태블릿을 양 날개로 든 모습 | 태블릿 들기(§5 ②)와 정확히 일치 |
>
> 색(보라 주조 + 민트 보조)도 이 문서가 §1.2에서 독자적으로 정한 브랜드 보라·과학 민트 계열과 잘 맞는다. 다만 지금 파일은 **흰 배경 JPG**라 이 문서가 요구하는 "투명 배경 PNG"가 아니다 — Build 단계에서 배경 제거(투명 PNG화) + `.webp` 변환 + 의미 있는 파일명(`mascot-wave.png` 등)으로 정리가 필요하다. 이미지 자체를 새로 그릴 필요가 있는지, 이 4장을 그대로 다듬어 쓸지는 **§9 Q6를 사용자가 확인**해야 한다(이 Plan은 이미지 파일을 만들거나 옮기지 않았다 — 발견만 하고 그대로 두었다).
>
> 부엉이 자체가 "과학" 정체성이 강한 캐릭터라, 아래 §5 설계(홈 히어로 전용)보다 오히려 **과학수업 영역과 더 잘 어울릴 가능성**이 있다 — 이 점도 Q6에 포함했다.

* **위치**: 홈 히어로(§4.3)에 1곳만, Phase 1 범위. 기존 `HomeIllustration` 자리를 대체.
* **크기**: 데스크톱 히어로에서 폭 220~280px(기존 `HomeIllustration`이 176~240px였던 것과 비슷하거나 한 단계 큼), 세로 배치(좁은 화면)에서는 140~180px로 축소.
* **자세 4종**(전부 만들어 두되 Phase 1은 "인사"만 적용, 나머지는 자리만 예비):
  1. **인사**(손 흔들기) — 홈 히어로 기본으로 지금 적용.
  2. **태블릿 들기** — 추후 과학수업/학습게임 히어로 후보(Phase 2 이후, 이번엔 미적용).
  3. **생각하기** — 추후 빈 상태·로딩 화면 후보.
  4. **축하하기** — 추후 과학 앱 "정리하기" 완료 화면·과제 제출 완료 후보(단, 과학 앱은 §0 범위상 이번 개편에서 앱 화면 자체를 안 건드리므로 실제 적용은 없음. 자리만 예비).
* **형식**: AI 생성 이미지라 래스터만 가능 — 투명 배경 PNG 원본 보관 + WebP 변환(가능하면, §3.3과 같은 방식) 사용. 저장 위치 `public/illustrations/mascot/mascot-{pose}.png`(+`.webp`).
* **다크모드**: 캐릭터 자체에 배경이 없으므로 다크 배경 위에서 붕 떠 보이지 않게 CSS로 은은한 그림자/글로우(`--shadow-lg` 또는 `--shadow-brand`를 낮은 강도로) 하단에 추가.
* **저작권**: 참고 사이트 캐릭터(아이+로봇 조합 등)를 베끼지 않고 완전히 새로 디자인한다. 기존 로고(`LogoMark`, 새싹+웃는 얼굴)와 어울리는 방향(예: 새싹/동식물 모티프, 또는 완전히 새로운 동물·로봇 캐릭터)은 사용자 취향에 달려 있어 **후보를 4~6장 만들어 사용자가 그중 인사 포즈 1장을 고르는 방식**을 제안한다(§9 Q6).

---

## 6. 과학 앱 공통 틀 — 바꿀 범위

정본 2개(`scripts/templates/science-sim/style-common.css`, `scripts/templates/science-guide/style-common.css`)만 고치고, 23개 앱 폴더로 다시 복사한다. **JS 파일(`experiment.js`, `lesson.js`, `answer-check.js` 등)과 저장 구조는 건드리지 않는다** — 색·글꼴·버튼 모양은 전부 CSS 변수와 CSS 규칙만으로 표현 가능하기 때문이다.

| 변수 | 지금 | 바꿀 값(방향) |
|---|---|---|
| `--ss-primary` / `-primary-strong` / `-on-primary` | 파랑 계열(`#2f6fd6`) | 새 브랜드 보라 계열로(블로그 `--primary`의 라이트 값과 같은 hue 288, 정확한 hex는 Build에서 oklch→hex 변환) |
| `--ss-accent`(힌트·플래그 강조) | 주황(`#f2a93b`) | **유지**(참고 사이트도 "보라·주황"을 같이 쓰는 인상이었어서 오히려 잘 맞음 — 굳이 바꾸지 않음) |
| `--ss-good`/`-bad`/`-warn-bg` | 초록/빨강/노랑 | 유지(정답·오답·경고는 의미색이라 브랜드색과 무관하게 계속 써야 함) |
| `--ss-radius` | `16px` | `18~20px`로 소폭 확대(측정값 입력·표 칸 등 촘촘한 곳은 과하게 키우지 않는다) |
| `--ss-shadow` | 중립 그림자 | 살짝 보라 틴트(`rgba(브랜드 보라, 0.10)` 계열) |
| `--ss-font` | `system-ui...` | Pretendard(§2.2, 자체 호스팅) |
| (신규) `--ss-font-heading` | 없음(전체가 `--ss-font`) | Jua(자체 호스팅), `.ss-stage-title`/`.ss-title`/`.ss-btn` 라벨류에만 적용 |

**버튼 모양**: `.ss-btn-primary.ss-btn-big`(단계 이동 "다음", "기록" 같은 화면당 1~2개의 큰 주요 버튼)만 `border-radius:999px`(알약)로. 일반 `.ss-btn`, `.ss-choice`, `.ss-option`, `.ss-mini-cell` 등 격자로 많이 반복되는 작은 버튼은 지금의 `12px` 사각 모서리를 유지한다(참고 사이트 인상에서도 "동그란 흰 버튼 안 화살표"는 화면당 소수였고, 목록형 버튼까지 전부 알약이면 과학 실험처럼 정보 밀도가 높은 화면에서는 오히려 어수선해진다).

**건드리지 않는 것(명시)**: 측정값 입력/표시 서식(`.ss-num-input`, `font-variant-numeric:tabular-nums`), 스텝퍼(`.ss-stepper`) 로직, 3D 뷰(`.ss-exp-view`, `sim3d.js`), 답 되짚기(`answer-check.js`), 저장 흐름(`persist.js`, `class1-record.js`) — CLAUDE.md 과학 앱 규칙이 요구하는 "측정 규칙 그대로", "저장 키 불변" 원칙과 직결되므로 CSS 값 외에는 일절 수정하지 않는다.

**점검 방법**(CLAUDE.md 정본 수정 절차 그대로): 정본 2개 수정 → 23개 앱 폴더의 사본에 다시 복사 → `diff -r`로 전부 일치하는지 확인 → 최소 2~3개 앱(1학기 실험형 1개, 조사형 1개, 2학기 신규 기준 앱 1개)을 실제로 실험 단계까지 열어 레이아웃 깨짐 없는지 확인 → 태블릿 가로/세로 뷰포트로도 확인.

**"수정 금지" 앱 포함 여부**: STATUS.md에는 1단원 전체(`sci-6-1-1-1~6`)와 2단원 탐구 1·2·6(`sci-6-1-2-1/2/6`)이 "학생 사용함/수정 금지"로 표시돼 있다. 이번 리스킨은 공통 템플릿 CSS 교체만이고 각 앱의 동작·저장 구조·문항을 전혀 바꾸지 않지만, "수정 금지"라는 기존 기록과 충돌해 보일 수 있어 **§9 Q3로 명시적으로 확인을 받는다.** 사용자 결정 §3 원문이 "과학 앱 23개는"이라고 전체를 지칭하고 있어 기본값은 "23개 전부 포함"으로 계획했다.

---

## 7. 접근성

* **대비(WCAG AA)**: 새 `--primary`(보라) 위 글자, 그라데이션 카드 위 텍스트(그라데이션 배경에는 텍스트를 직접 얹지 않고 지금처럼 `bg-card` 불투명 배지/`text-foreground` 조합만 쓰는 기존 원칙 유지 — 1차 개편 Review가 "파스텔 텍스트 금지"로 이미 확립한 규칙을 그라데이션에도 그대로 적용), 3D 아이콘 칩 배경 위 여백은 지금처럼 실측 필요. 전부 Review 단계에서 브라우저 실측(1차 개편과 같은 절차).
* **색만으로 정보 전달 금지**: 사이드바 활성 표시는 배경+`aria-current`, 3D 아이콘은 색 tint가 안 되므로 더더욱 텍스트 라벨·배경이 필수 정보 전달 수단임을 재확인.
* **움직임 줄이기**: 새로 추가하는 배경 블롭은 애초에 정적(애니메이션 없음)이라 `prefers-reduced-motion` 대응이 필요 없다. 기존 `illo-float`/`illo-twinkle`(사이드바 카드, 남겨 둘 SVG 일러스트)는 지금 규칙 그대로 유지.
* **키보드 포커스**: `focus-visible:ring` 패턴을 새 알약 버튼에도 동일 적용(색만 `--ring`이 보라 기로 바뀜, 로직 변경 없음).
* **3D 아이콘 대체 텍스트**: 전부 장식(`aria-hidden`), 의미는 인접 라벨 텍스트가 전달 — 그림만으로 뜻이 통해야 하는 자리(예: 텍스트 라벨 없는 아이콘 단독 버튼)에는 3D 아이콘을 쓰지 않는다(§3 목록에 그런 자리 없음, 전부 텍스트 병기).

## 8. 성능

* **폰트**: Jua(기존, 영향 없음) + Pretendard 2 weight 자체 호스팅, 목표 합계 900KB 이하(가능하면 700KB대), `font-display:swap`. 과학 앱은 폰트 3개(Jua+Pretendard 2종) × 23개 폴더 복제 — 저장소 용량 증가(약 14~23MB 예상)는 감수(오프라인 안정성이 더 중요, §9 Q2에 대안 명시).
* **3D 아이콘**: 개당 목표 15~40KB(WebP) 또는 30~70KB(PNG 폴백), 7개 합계 300KB 이내. 카드·빈 화면용은 `loading="lazy"`, 사이드바·머리말처럼 항상 첫 화면에 보이는 것만 즉시 로드.
* **마스코트**: 히어로 안에 있어 LCP 후보 — 지연 로딩하지 않고 우선 로드(`priority`/`fetchpriority="high"`), 목표 용량 150~300KB(WebP), 실제 표시 폭의 2배 이내 해상도로 사전 리사이즈해 커밋(요청 시점 자동 최적화가 없으므로 필수).
* **배경 그라데이션·블롭**: 순수 CSS(이미지 없음), 성능 영향 없음.
* **`next build` 정적 export 확인**: 새 라우트 없음(기존 페이지 스타일만 변경), 번들 크기 증가는 폰트·이미지 자산 위주 — JS 번들 증가는 미미할 것으로 예상.

## 9. 단계별 작업 계획

각 단계는 Build 서브에이전트(전용 지침 `.md`) → 별도 Review 서브에이전트(`review.md` 작성, 문제 시 수정) → Claude가 검증 후 커밋, 순서를 따른다(CLAUDE.md 서브에이전트 규칙). **1단계 완료 후에는 사용자에게 먼저 보여주고 승인을 받은 뒤 2단계로 넘어간다**(plan-instructions.md 명시).

| 단계 | 범위 | 주요 파일 | 확인할 화면(브라우저) |
|---|---|---|---|
| **1. 토큰·글꼴·사이드바·홈** | §1(토큰) 전부, §2(폰트, 블로그만), 사이드바(§4.1), 머리말(§4.2), 홈(§4.3), 3D 아이콘 7개 중 사이드바·홈에 쓰는 것(House/Video Game/Test Tube/Speech Balloon/Package), 마스코트 1장(인사) 자리 반영 | `globals.css`, `layout.tsx`(Pretendard 폰트 추가), `src/app/fonts/`, `public/illustrations/3d/`, `public/illustrations/mascot/`, `sidebar.tsx`, `topbar.tsx`, `page.tsx`, `menu-shortcut-card.tsx`, `stat-tile.tsx`, `page-hero.tsx` | 데스크톱 1280 / 태블릿 768 가로·세로 / 375px, 라이트·다크, 사이드바 펼침·접힘, 대비 실측 |
| **2. 나머지 화면** | 과학수업 4단계(§4.4), 게시판·게임 목록(§4.5, `GamePlayer` 내부 로직 제외), 글 보기·검색(§4.6), 로그인·비밀번호 변경(§4.7), 내 학습 활동(§4.8), 나머지 3D 아이콘(Newspaper/Magnifying Glass) | `science-view.tsx`, `community-post-list.tsx`, `game-player.tsx`(색만), `login-form.tsx`, `reset-password-form.tsx`, `my-learning-view.tsx` 등 | 위와 동일 해상도 세트, 로그인 상태/비로그인 상태 둘 다, 게임 실행기는 보안 동작(sandbox 속성) 코드 diff로 별도 확인 |
| **3. 과학 앱 공통 틀** | §6 전부 | `scripts/templates/science-sim/style-common.css`, `science-guide/style-common.css`, 각 폴더 `fonts/`, 23개 앱 폴더 사본 재동기화 | `diff -r`로 사본 일치 확인, 최소 3개 앱 실험 단계까지 실행(태블릿 가로·세로), "수정 금지" 앱 포함 여부는 §9 Q3 답 확정 후 착수 |
| **4. 관리자 색·글꼴** | §4.9 | `admin-shell.tsx`, `AdminPageHeader`, 관리자 각 화면 | 관리자 로그인 상태로 대시보드 각 탭, 회원 관리·학습 현황·커뮤니티 신고 화면 |

---

## 10. 열린 질문 (추천안 포함)

| # | 질문 | 추천안 |
|---|---|---|
| Q1 | 홈 히어로에 CTA 버튼을 새로 추가하는데(§4.3), 목적지·문구를 무엇으로 할지 | 추천: "요즘 뭐 배웠나 보기" → 최근 소식/과학수업 쪽. 확정은 Build 시작 전 짧게 확인 |
| Q2 | 과학 앱 글꼴을 앱마다 파일로 복제(자체 호스팅, §2.2)할지, Google Fonts CDN `@import`(외부 의존, 저장소 용량 절약)로 할지 | 추천: **자체 호스팅**(오프라인 안정성 + "자체 완결" 원칙에 더 맞음). 저장소 용량이 부담되면 CDN으로 전환 가능(정본만 다시 고치면 되므로 나중에 바꾸기도 쉬움) |
| Q3 | STATUS.md에 "수정 금지"로 표시된 10개 과학 앱(1단원 전체, 2단원 탐구 1·2·6)도 이번 공통 틀 리스킨(§6)에 포함할지 | 추천: **포함**(CSS 정본 교체만이고 동작·저장은 무변경, 사용자 결정 §3 원문이 "23개"로 전체를 지칭). 원치 않으면 제외할 앱 목록만 알려주면 됨 |
| Q4 | `HomeIllustration`(기존 학교 건물 SVG)을 마스코트가 대체한 뒤 폐기할지, 다른 자리(예: 404 페이지)에 재사용할지 | 추천: 당장 폐기하지 않고 남겨 둠(파일 삭제는 나중에 언제든 가능, 재사용처가 생기면 활용) |
| Q5 | 새 `--primary`(보라)를 기존에 있던 미사용 다크모드 토큰 `--sidebar-primary: oklch(0.488 0.243 264.376)`(마침 비슷한 보라-파랑 계열)와 통일할지 | 추천: 통일(일관성, 지금 이 토�큰을 실제로 쓰는 곳이 없어 위험 없음) |
| Q6 | 마스코트 컨셉 — `public/illustrations/mascot/`에 이미 놓여 있던 "부엉이 과학자" 후보 4장(§5 발견 사항)을 그대로 다듬어 쓸지, 로고(새싹+웃는 얼굴)와 이어지는 식물 캐릭터 등 새로 만들지 | 추천: **이미 있는 부엉이 과학자 후보를 그대로 다듬어 쓰기**(자세 4개가 이미 정확히 맞아떨어지고 색도 이 문서의 팔레트와 맞음 — 처음부터 새로 만드는 것보다 효율적). 다만 부엉이는 "과학" 인상이 강한 캐릭터라, ⓐ 홈 히어로 대신 **과학수업 히어로 전용 마스코트**로 배치를 바꾸거나 ⓑ 홈에는 그대로 쓰고 과학수업엔 색만 다르게 입힌 변형을 따로 두는 것도 고려할 만하다 — 사용자 확인 필요. 배경 제거(투명 PNG)·파일명 정리는 어느 쪽이든 Build에서 진행 |
| Q7 | 관리자 화면(§4.9)에 `--primary` 보라가 그대로 들어가면 너무 장난스러워 보일 가능성 | 추천: 우선 그대로 적용해 보고 Review에서 실물로 판단(과하면 관리자 영역 한정 CSS 클래스로 채도만 낮추는 것도 가능 — 새 토큰 없이 `color-mix()`로 처리 가능) |

---

## 부록 — 참고 사이트에서 가져오지 않은 것 (확인용)

* 캐릭터(아이+로봇 조합 등), 로고, 배너 그림, 문구/카피, 정확한 색상 hex 값, 정확한 폰트 파일 — 전부 이 문서 어디에도 없음. 색은 전부 이 프로젝트의 기존 hue(235/330/165/70)에서 새로 파생시켰고, 보라(288)도 새로 정한 값이다.
* 배너 캐러셀, 플로팅 로봇 도우미(챗봇형 위젯) — 기능 자체를 이번 범위에 넣지 않았다(§0).
* 폰트는 참고 사이트가 실제로 쓰는 폰트를 알아내 흉내 내지 않고, 이 프로젝트가 이미 검증해 쓰고 있던 Jua + 새로 고른 Pretendard(둘 다 OFL, 참고 사이트와 무관하게 독자적으로 선택)로만 구성했다.

---

## 개정 1 (2026-09-24, 사용자 승인 "추천대로") **이 절이 위 열린 질문보다 우선한다.**
* **마스코트**: 부엉이 과학자 확정. 파일은 Claude가 준비해 두었다 — `public/illustrations/mascot/owl-wave.webp`(홈 히어로), `owl-tablet.webp`(과학수업 히어로), `owl-think.webp`(빈 화면·오류 안내), `owl-cheer.webp`(완료·축하). 투명 배경 WebP, 약 700~1050px, 46~69KB. 원본과 배경 제거 스크립트는 `docs/design/redesign/mascot-src/`. 표시할 때는 실제 표시 크기에 맞게 `width`/`height` 속성과 `loading`을 준다(첫 화면 홈 히어로만 eager).
* **3D 아이콘 7개**: Claude가 `public/illustrations/3d/`에 WebP(192px)로 넣고 `LICENSE-fluent-emoji.txt`(MIT 전문 + 출처)를 둔다. Build는 파일을 새로 받지 않는다.
* **이미지 처리 도구**: `sharp`는 `next`의 의존성으로 `node_modules`에 이미 있다(`package.json`에 추가하지 않는다). 추가 변환이 필요하면 이것을 쓴다.
* **글꼴**: 사이트 본문은 npm 패키지 `pretendard`로 자체 호스팅(설치 허락됨). 제목 Jua는 지금 방식 유지. **과학 앱은 CDN**(jsDelivr의 Pretendard, Google Fonts의 Jua)으로 불러오고, 불러오지 못하면 기기 기본 글꼴로 대체되게 한다.
* **Q1 홈 CTA**: 문구 **"오늘의 과학 탐구 시작하기"**, 목적지 **과학수업(`/science/`)**.
* **Q3**: 과학 앱 23개 **전부** 공통 틀 CSS 리스킨에 포함(동작·저장 무변경).
* Q4·Q5·Q7은 추천안 그대로. Q6: 부엉이는 홈 히어로(인사)와 과학수업 히어로(태블릿) 모두에 쓴다.

---

## 개정 2 (2026-09-24, 사용자 결정) — 제목 글꼴·제목 그림자. **이 절이 §2.1과 개정 1의 "제목 Jua"보다 우선한다.**
* 계기: 사용자가 "주아체보다 똑똑수학탐험대 배너처럼 명시적으로 눈에 띄는 글꼴로 모두", "메뉴 타이틀 글자에 그림자 느낌의 입체감"을 요청(배너 캡처 제공 — 그림 속 글자라 글꼴 이름은 알 수 없음, 참고 사이트의 웹 글자는 Pretendard·Jua). Claude가 OFL 후보 4개(G마켓 산스 Bold·나눔스퀘어라운드 EB·Pretendard Black·검은고딕)와 그림자 3안(A 부드러운·B 스티커·C 블록)을 우리 사이트 문구로 비교 이미지를 만들어 보여 주고 **사용자가 G마켓 산스 Bold + A 부드러운 그림자**를 골랐다. 참고 사이트의 파일·그림·문구는 가져오지 않았다.
* **제목 글꼴: G마켓 산스 Bold**(Gmarket Sans, SIL OFL 1.1, © 2019 eBay Korea, Reserved Font Name "Gmarket Sans Font", 한글 11,172자).
  * 파일(Claude가 사용자 허락 받고 받아 둠): `public/fonts/gmarket-sans/GmarketSansBold.otf` — 공식 배포 원본을 **수정 없이**(약 869KB, 한 번 받으면 캐시). WOFF2 변환·서브셋은 OFL "수정본"이라 원래 이름을 쓸 수 없어 하지 않는다. 고지 `LICENSE-gmarket-sans-OFL.txt`, 불러오기 CSS `gmarket-sans.css`(@font-face 1개, `font-display: swap`, weight 700). Build는 글꼴 파일을 새로 받거나 바꾸지 않는다.
  * 사이트: `layout.tsx`의 `next/font` Jua를 빼고 head에 `withBasePath("/fonts/gmarket-sans/gmarket-sans.css")` 스타일시트를 붙인다(같은 출처의 작은 CSS). 제목 글꼴 변수는 `"Gmarket Sans"` → 대체 글꼴(Pretendard 굵게) 순서.
  * 과학 앱: `persist.js`(science-sim·science-guide)가 Jua `<link>` 대신 `../../fonts/gmarket-sans/gmarket-sans.css`(같은 사이트, 상대경로)를 **비차단**으로 붙인다 — 사이트와 같은 파일·같은 캐시. `--ss-font-heading`을 G마켓 산스로. Google Fonts 연결(preconnect 포함)은 더 쓰지 않으면 뺀다.
  * 굵기: 파일은 Bold 하나뿐이다. 제목의 굵기를 700으로 맞춰 글꼴을 못 받았을 때도 대체 글꼴이 굵게 보이게 하고, 가짜 굵게(`font-synthesis`)는 계속 막는다. 주아보다 글자 폭이 넓으므로 좁은 화면에서 제목이 넘치거나 어색하게 줄바꿈되는 곳만 크기·자간을 조금 조정한다. 알약·칩처럼 세로 가운데가 중요한 곳에서 글자가 위아래로 치우쳐 보이는지 확인한다.
* **제목 그림자: A 부드러운 그림자**(비교 이미지의 A).
  * 밝음: 글자 바로 아래 흰 윤곽(`0 0.05em 0` 흰색 90%) + 보라 부드러운 그림자(`0 0.16em 0.4em` 보라 약 28%). 어두움: 검은 그림자(`0 0.08em 0.3em` 70%) + 보라 은은한 빛(`0 0 0.5em` 약 25%). **em 단위**라 제목 크기에 비례한다. 값은 CSS 변수 하나로 두어 한 곳에서 조절한다.
  * 적용: 사이트에서 제목 글꼴을 쓰는 제목(홈 히어로, 각 메뉴 페이지 제목, 섹션 제목, 카드 제목 등). 작은 글자(약 18px 이하)는 흐림을 줄인다. **관리자 화면은 그림자 없음**(업무 화면은 담백하게 — 개정 1 Q7과 같은 이유, 글꼴은 바꿈). 과학 앱은 제목 글꼴을 쓰는 곳에 같은 그림자.
  * 그라데이션 글자(`text-grad-primary` 등 글자색 투명)는 text-shadow가 글자 안으로 비쳐 탁해지므로 `text-shadow: none` + `filter: drop-shadow(...)`로 대신한다.
  * 접근성: 대비는 그림자 없이 글자색↔바탕으로 AA 유지, 고대비 모드(`forced-colors: active`)에서는 그림자 없음.
* 과학 앱의 3D 장면·그래프·SVG 속 글자, 측정값·표·입력칸 글꼴은 바꾸지 않는다(계속 Pretendard/기존 값).
