# 디자인 개편 1단계 Build 보고서 — 토큰·글꼴·사이드바·머리말·홈 (2026-09-24)

지침: `build-1-instructions.md` / 설계: `spec.md`(개정 1 우선). git 명령·실 DB 쓰기 없음. 브라우저는 내 전용 headless Chrome(포트 9517, 전용 프로필)과 내 서버(개발 3417, 정적 4817)만 썼고 끝나고 모두 종료·정리했다. `localStorage.clear()`는 쓰지 않았다.

## 1. 결과 요약
* 새 보라 `--primary`, 연보라 배경 그라데이션 + 흐린 보라 빛, 메뉴별 카드 그라데이션, 그림자 단계를 밝은/어두운 모드 모두 적용. 기존 토큰 이름은 그대로.
* 본문 글꼴 **Pretendard**를 npm 패키지로 자체 호스팅(400·500·600만). 한글이 실제로 `Pretendard-Regular`/`Pretendard-SemiBold`로 그려지는 것을 브라우저 계산 글꼴(CDP `getPlatformFontsForNode`)로 확인. 제목 Jua는 그대로.
* 사이드바·드로어: 3D 아이콘 칩, 활성 항목은 **줄 배경 + 떠 있는 흰 칩 + 굵기 600**(비활성 500)으로 구분.
* 머리말: 반투명 흰 바 + blur, 둥근 아이콘 버튼, 흰 알약 "로그인" 버튼(휴대폰에서는 사이트 이름이 잘리지 않게 예전 크기 유지).
* 홈: 히어로(Display 제목, "배움터" 보라 강조, 보라 알약 CTA **"오늘의 과학 탐구 시작하기" → `/science/`**, 인사하는 부엉이 `owl-wave.webp`), 기능 카드 3개(그라데이션 + 3D 아이콘 + 동그란 흰 화살표 버튼), 정보 카드 줄(3D 아이콘 칩 통계 4개), 정보 섹션 3개(흰 둥근 카드 + 3D 아이콘 칩 + "더 보기" 알약).
* 로그인 잠금 시 홈 안내 카드(`LoginNeededNotice`)를 새 모양(옅은 보라 판 + 흰 자물쇠 칩 + 흰 알약 버튼)으로. 동작은 그대로.
* `npx tsc --noEmit` 통과, `npm run build` 통과(정적 페이지 24개), 내 코드 eslint 0건. **`npm run lint`는 실패** — 원인은 이번 작업 파일이 아니라 `docs/design/redesign/mascot-src/cutout.cjs`(require 2건, §9 참고).

## 2. 바꾼 파일
| 파일 | 내용 |
|---|---|
| `package.json`, `package-lock.json` | `pretendard@^1.3.9` 추가(허락된 설치) |
| `src/app/globals.css` | 토큰 값·신규 토큰(§3), 글꼴 스택, 페이지 배경, `bg-grad-*` 유틸리티, `*-ink` 색, 마스코트 둥실 애니메이션(움직임 줄이기에서 끔) |
| `src/app/layout.tsx` | Pretendard CSS 3개 import(400/500/600) |
| `src/app/page.tsx` | 홈 새 구성(히어로·기능 카드·정보 카드 줄·정보 섹션) |
| `src/components/layout/page-hero.tsx` | 선택 prop 추가(`variant="gradient"`, `size="display"`, `media`). **기본값은 예전 모양 그대로**라 과학·게시판·게임 히어로는 변화 없음 |
| `src/components/layout/sidebar.tsx` | 3D 칩, 굵기로 활성 구분, 반투명 판, 응원 카드 보라 톤 |
| `src/components/layout/topbar.tsx` | 반투명 바·둥근 버튼(sm 이상 36px) |
| `src/components/theme-toggle.tsx` | `className` prop만 추가 |
| `src/components/user-menu.tsx` | 로그인 버튼 알약 모양, 아바타 버튼 크기(sm 이상) — 메뉴 동작 무변경 |
| `src/components/dashboard/menu-shortcut-card.tsx` | 기능 카드 재디자인(카드 자기 폭 기준 @container 배치) |
| `src/components/dashboard/stat-tile.tsx` | 선택 prop `image`(3D 아이콘)·`className` 추가. 관리자 화면 타일은 lucide 그대로 |
| `src/components/dashboard/science-app-status.tsx` | "앱 6/6"·"실험/조사" 작은 글자를 `*-ink` 색으로(대비 AA) |
| `src/components/login-gate.tsx` | `LoginNeededNotice` 모양만 변경(가운데 정렬 포함) |
| `src/components/ui/button.tsx`, `ui/badge.tsx` | 기본 버튼/배지 hover `primary/80` → `/90`(보라 위 흰 글자 대비 유지, §5) |
| `src/data/menu.ts` | 메뉴 항목에 `image3d`(3D 아이콘 이름) 추가 |
| `src/lib/menu-colors.ts` | `gradientBg`, `softRing`, `ink` 클래스 추가 |
| **신규** `src/components/illustrations/icon-3d.tsx` | 3D 아이콘 `<img>`(withBasePath, width/height, `alt=""`+`aria-hidden`, lazy) |
| **신규** `src/components/illustrations/mascot.tsx` | 마스코트 `<img>`(priority일 때만 eager + fetchpriority=high) + 가장자리 흰 테두리 가리는 SVG 필터 |
| **신규** `public/fonts/LICENSE-pretendard-OFL.txt` | Pretendard OFL 1.1 원문(패키지 `dist/LICENSE.txt` 복사, spec §2.3 고지) |

건드리지 않음: `public/apps/**`, `scripts/templates/**`, 이미지 파일(마스코트·3D 아이콘은 준비된 것 그대로 사용, 새로 받거나 만들지 않음), 다른 화면 컴포넌트(과학수업·게시판·게임·글·로그인·내 학습·관리자).

## 3. 토큰 대응표(최종 값)
| 토큰 | light | dark | spec 값과 차이 |
|---|---|---|---|
| `--primary` | `oklch(0.53 0.2 288)` (#6c4dd6) | `oklch(0.75 0.15 288)` (#aa9dff) | light만 변경: spec `0.58 0.19`는 흰 글자 대비 **4.48:1**(AA 미달) → 5.59:1 |
| `--primary-foreground` | `oklch(0.99 0 0)` | `oklch(0.18 0.05 288)` | 같음 |
| `--ring` | `oklch(0.65 0.1 288)` | `oklch(0.55 0.08 288)` | light만 변경: spec `0.7 0.06`은 흰 배경 대비 2.71:1 → 3.32:1(초점 표시 3:1) |
| `--muted-foreground` | `oklch(0.52 0 0)` | `oklch(0.708 0 0)`(그대로) | **대응표 밖 변경(대비 수정)**: 새 연보라 배경 위에서 기존 0.556은 4.32:1 → 0.52로 5.02:1 |
| `--sidebar-primary(-foreground)` | `var(--primary)`(-foreground) | 같음 | spec Q5 추천안(통일) |
| `--home/games/science/board-soft·strong` | 그대로 | 그대로 | 변경 없음 |
| `--home-grad-to` | `oklch(0.9 0.05 218)` | `oklch(0.36 0.07 218)` | 같음 |
| `--games-grad-to` | `oklch(0.91 0.05 352)` | `oklch(0.36 0.08 352)` | 같음 |
| `--science-grad-to` | `oklch(0.9 0.05 148)` | `oklch(0.36 0.07 148)` | 같음 |
| `--board-grad-to` | `oklch(0.9 0.06 48)` | `oklch(0.36 0.08 48)` | 같음 |
| `--bg-grad-top` | `oklch(0.97 0.02 288)` | `oklch(0.2 0.035 288)` | 같음. 단 그라데이션 끝을 `55%` 대신 **`44rem` 고정**(긴 홈과 짧은 로그인 화면의 인상을 같게) |
| `--bg-blob` | `primary` 12% | `primary` 10% | light 16% → 12%(흐린 글자 대비). 블롭은 DOM 요소 대신 `body` 배경의 radial-gradient 2개(움직임·요소 없음, blur 필터 없음), 중심을 화면 밖 4rem에 둠 |
| `--shadow-sm/md/lg` | spec 값 그대로 | 같음 | 같음(`shadow-(--shadow-md)` 식으로 사용) |
| `--shadow-brand` | `primary` 45% | `primary` 25% | 같음 |
| `--font-body-kr` | `"Pretendard"` | 같음 | spec은 next/font 변수였으나 개정 1(npm 패키지)에 맞춰 글꼴 이름 |
| (신규) `--color-{menu}-ink` | `color-mix(strong 70%, foreground)` | 같은 식(다크에선 밝아짐) | spec 밖 추가: soft 위 **작은 글자**용 메뉴색(라이트 6.0~7.2:1, 다크 7.9~8.2:1). 칩·배지 글자에만 |
| `--radius*`, `--font-heading`(Jua) | 그대로 | 그대로 | 같음(`--font-heading` 폴백에 Pretendard만 추가) |

유틸리티: `bg-grad-home|games|science|board`(135deg, soft → grad-to, 큰 카드 전용).

## 4. 글꼴 적용 방법·용량
* 방법: `layout.tsx`에서 `pretendard/dist/web/static/Pretendard-{Regular,Medium,SemiBold}.css`를 import(Next 공식 "node_modules CSS import"). 굵기마다 한글을 92조각(unicode-range)으로 나눈 **dynamic subset**이라 화면에 나온 글자가 든 조각만 받는다. `font-display: swap`.
* 굵기: spec은 400·600 둘이었으나 **500 추가**. 코드에 `font-medium`이 93곳이라 500 파일이 없으면 전부 400으로 보여 위계가 사라진다. `font-bold`(2곳)·`<strong>`은 600 파일로 그려진다(가짜 볼드 합성 없음 확인).
* basePath: 빌드 CSS가 `url(../media/Pretendard-….woff2)` 상대 경로라 `/class1`에서 그대로 동작. 정적 export를 `/class1/`로 서빙해 404 0건 확인.
* 용량(실측, 캐시 끔): 홈 24개 파일 **약 290KB**, 게시판 글 18개 224KB, 과학 단원 21개 256KB, 로그인 12개 148KB. 한번 받은 조각은 다른 화면에서 재사용.
* CSS: Pretendard `@font-face` 276개 = **160.7KB(압축 47.3KB)**가 렌더 차단 CSS에 더해짐. 배포 폴더 `out/`은 19MB → 28MB(woff2 3.9MB + 쓰이지 않는 woff 예비 4.7MB, 최신 브라우저는 woff2만 받음).
* **대안(결정 필요 시)**: 같은 패키지의 가변 글꼴 `variable/pretendardvariable-dynamic-subset.css` 한 줄로 바꾸면 받는 양은 비슷(홈 289KB)하면서 요청 수 절반(11개), CSS 약 1/3(53KB), 배포 −5.6MB, 500·700이 정확히 그려진다. 지침의 "필요한 굵기만"을 따라 이번엔 정적 3굵기로 두었다. 바꾸려면 import 3줄 → 1줄, `--font-body-kr: "Pretendard Variable", "Pretendard"`.
* 라이선스: SIL OFL 1.1 원문을 `public/fonts/LICENSE-pretendard-OFL.txt`로 배포(빌드 CSS에는 고지가 남지 않아서).

## 5. 대비 측정값(WCAG AA)
토큰 계산(oklch→sRGB):
| 조합 | light | dark |
|---|---|---|
| 보라 버튼 글자(primary-foreground on primary) | **5.59** | **8.09** |
| 보라 버튼 hover(`/90`) | 4.59 | ≥6 |
| 보라 글자 on 흰 배경 / on 연보라 윗배경 | 5.75 / 5.24 | 8.45(on 배경) |
| 히어로 "배움터"(보라, 큰 글씨 기준 3:1) on 홈 그라데이션 | 4.32~4.85 | 4.50~5.37 |
| 그라데이션 카드 위 설명(foreground 75%) | 7.74~7.90 | 6.40~6.84 |
| 그라데이션 카드 제목(foreground) | 14.4 이상 | 10.1 이상 |
| muted 글자 on 흰색 / 연보라 윗배경 / 블롭 겹침 최악(계산) | 5.51 / 5.02 / 약 4.65 | 7.0 이상 |
| 작은 메뉴색 글자(`*-ink` on soft) | 6.0~7.2 | 7.9~8.2 |
| 초점 링 색(`--ring`) vs 배경 | 3.32 | 3.99 |

화면 픽셀 실측(글자 상자 안 최빈색 = 배경, 가장 대비 큰 픽셀 = 글자, 정적 빌드):
* 홈 1440/1024/375 밝음, 1440 어두움, 잠금 상태 밝음·어두움: **AA 미달 0건**(글자 상자 71~76개씩). 375에서 1건으로 잡힌 "오늘도 반가워요"는 측정 상자가 6px 색 점을 잡은 오검출(실제 글자 5.51:1).
* 수정 전 홈에서 잡힌 실제 미달: "앱 6/6"·"실험" 칩 3.52~3.92:1(1차 개편부터 있던 strong-on-soft 작은 글자) → `*-ink`로 고쳐 6:1 이상.
* 다른 화면(과학수업·단원·차시, 게시판·글, 학습게임, 로그인, 검색, 비밀번호 변경, 내 학습, 관리자) 밝음·어두움: **미달 0건**.

## 6. 접근성·움직임·반응형
* 가로 스크롤 0, 콘솔 오류 0, 실패 요청 0: 홈 1440×900·1024×768·768×1024·375×812 밝음/어두움 전부 + 다른 화면 14개.
* 키보드 초점: CTA는 3px 보라 실선 + 3px 간격(처음엔 Tailwind v4 `outline-none`이 스타일을 지워 안 보였던 것을 찾아 `outline-solid`로 고침), 기능 카드·사이드바는 3px 메뉴색 링. 밝음/어두움 모두 스크린숏으로 확인.
* `prefers-reduced-motion: reduce`: 마스코트 둥실·반짝이 `animation: none`, 카드 hover 이동 `transition: none` 확인. 배경 빛은 원래 정적.
* 사이드바 접힘(레일) 72px, 칩만 가운데 정렬 확인. 휴대폰 드로어(288px)에 3D 아이콘 4개 정상 로드(`/class1/illustrations/3d/…`).
* 이미지: 이번에 넣은 모든 `<img>`(3D 아이콘·마스코트)에 width/height·`alt=""`·`aria-hidden`. 마스코트만 eager + fetchpriority=high(빌드가 `<link rel=preload>`도 자동 생성), 3D 아이콘은 전부 lazy. 경로는 모두 `withBasePath()`.
* 1024 가로(사이드바 펼침)에서 기능 카드가 227px로 좁아 제목이 "학습게/임활동"처럼 끊기던 것을 찾아, 카드 자기 폭(@container) 기준으로 좁으면 그림을 위로 올리게 고침.
* 마스코트 WebP 가장자리에 흰 테두리(배경 제거 흔적)가 어두운 바탕에서 보여, 파일은 그대로 두고 `Mascot` 컴포넌트에서 SVG 필터(알파 1px erode)로 가림 — 밝음/어두움 모두 깨끗해짐.

## 7. 스크린숏(정적 빌드, 내 전용 브라우저)
필수 4장:
* `/private/tmp/claude-501/-Users-sungchul-Desktop-classroom/7bf3a39e-3017-4189-b337-1b82aace66bb/scratchpad/redesign-1/home-1440-light.png`
* `/private/tmp/claude-501/-Users-sungchul-Desktop-classroom/7bf3a39e-3017-4189-b337-1b82aace66bb/scratchpad/redesign-1/home-1440-dark.png`
* `/private/tmp/claude-501/-Users-sungchul-Desktop-classroom/7bf3a39e-3017-4189-b337-1b82aace66bb/scratchpad/redesign-1/home-768x1024-light.png`
* `/private/tmp/claude-501/-Users-sungchul-Desktop-classroom/7bf3a39e-3017-4189-b337-1b82aace66bb/scratchpad/redesign-1/home-375-light.png`

추가: 같은 폴더의 `home-375-dark.png`, `home-768x1024-dark.png`, `home-1024x768-light.png`, `home-1024x768-dark.png`(모두 전체 페이지, 375는 2배 해상도).

## 8. 확인하지 못한 것
* **실제 iPad/Safari**: 마스코트 SVG 필터(`filter:url(#…)`), 사이드바·머리말 `backdrop-blur`, `color-mix()`/oklch 배경(iPadOS 16.4 미만이면 배경 그라데이션이 빠지고 흰 배경으로 보임), 터치 hover 상태. Chrome headless로만 확인.
* **로그인한 상태**의 머리말(아바타 버튼)·관리자 화면의 새 보라 버튼 인상 — 비로그인 화면만 봄(관리자는 4단계에서 색 점검 예정).
* 로그인 잠금 화면은 실 DB를 바꾸지 않고 내 브라우저에서 `site_settings` 응답만 바꿔 흉내 냄.
* Windows(맑은 고딕 폴백)·Android 실제 글꼴 표시, 느린 학교 와이파이에서 글꼴 교체(swap) 깜빡임 정도.

## 9. 알릴 것·다음 단계 메모
1. **`npm run lint` 실패 원인**: `docs/design/redesign/mascot-src/cutout.cjs`(Claude가 준비한 배경 제거 스크립트)의 `require()` 2건(`@typescript-eslint/no-require-imports`). 지침 범위 밖이라 고치지 않음. 해결: `eslint.config.mjs`의 `globalIgnores`에 `"docs/**"` 추가, 또는 파일 첫 줄에 `/* eslint-disable @typescript-eslint/no-require-imports */`. 이 파일을 뺀 나머지 전체 eslint는 0건.
2. `--muted-foreground`(라이트)를 0.556 → 0.52로 바꾼 것은 대응표 밖이지만, 새 배경 때문에 모든 화면의 흐린 글자가 AA 아래로 떨어지는 것을 막기 위한 수정이다(모든 화면에서 약간 진해짐).
3. 2단계 참고: `science-view.tsx:256`의 작은 번호 칩(`colors.chip`, 12px 글자)도 strong-on-soft라 라이트 대비 3.4~4.4:1 — 새 `colors.ink`를 쓰면 된다. 게임 실행기 "게임 시작" 버튼은 토큰 변경만으로 보라가 됨(코드 무변경).
4. 3D 아이콘 중 `package`·`magnifying-glass`는 1단계에서 쓰지 않음(빈 화면 `EmptyState`는 모든 화면 공용이라 2단계). `newspaper`는 홈 통계 "선생님 글" 타일에 사용. `HomeIllustration`은 지우지 않음(spec Q4).
5. `Mascot` 컴포넌트(가장자리 필터 포함)는 2단계 과학수업 히어로(`owl-tablet`)에 그대로 쓸 수 있다.

## 개정 1 (2026-09-24, Claude 결정) — Pretendard 가변 글꼴로 교체, docs/ lint 제외
**이 절이 위 §1·§4·§9-1보다 우선한다.**
* **글꼴**: `layout.tsx` import 3줄(정적 400/500/600) → 1줄 `pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css`. `--font-body-kr: "Pretendard Variable", "Pretendard"`. 화면이 쓰는 굵기는 그대로 400·500·600이고 제목은 Jua 그대로.
  * 브라우저 계산 글꼴(정적 빌드): 본문 `PretendardVariable-Regular`, 사이드바 비활성 `-Medium`(500), 활성·글 제목 `-SemiBold`(600), 히어로·카드 제목 `Jua-Regular`.
  * 차이 하나: `font-bold`(700)는 이제 진짜 700으로 그려진다(예전엔 600 파일). 쓰는 곳은 글 상세·커뮤니티 글 상세 제목(`h1`)과 `<strong>`뿐이고 **홈에는 없다**.
* **lint**: `eslint.config.mjs`의 `globalIgnores`에 `"docs/**"` 추가 → `npm run lint` **통과**(0건). `npx tsc --noEmit`·`npm run build`(24쪽) 통과.
* **새 용량**(정적 빌드 실측, 캐시 끔):

| 항목 | 정적 3굵기(이전) | 가변(지금) |
|---|---|---|
| Pretendard `@font-face` CSS | 276규칙 · 160.7KB (gzip 47.3KB) | 92규칙 · 48.7KB (gzip 14.2KB) |
| 화면마다 불러오는 CSS 파일 | 3개 | 2개 |
| 글꼴 파일(배포) | 552개(woff2 3.9MB + woff 4.7MB) | 92개(woff2 3.0MB) |
| `out/` 전체 | 28MB | 23MB |
| 홈 글꼴 다운로드 | 24개 · 290KB | 11개 · 288KB |
| 게시판 글 | 18개 · 224KB | 9개 · 239KB |
| 과학 단원 | 21개 · 256KB | 8개 · 208KB |
| 로그인 | 12개 · 148KB | 7개 · 183KB |

* **홈 1440 밝음 비교**: 크기 같음(1440×1871). 바뀐 픽셀 0.69% 중 87%가 마스코트·반짝이 자리(둥실·반짝 애니메이션이 찍힌 순간 차이), 나머지는 글자 가장자리 안티앨리어싱. 글자 영역을 나란히 놓고 봐도 굵기·자리·줄바꿈이 같다. 오류 0, 실패 요청 0, 가로 스크롤 0.
* 스크린숏 8장(§7 경로 그대로)은 이 가변 글꼴 빌드로 다시 찍어 덮어썼다. 라이선스 고지 파일(`public/fonts/LICENSE-pretendard-OFL.txt`)은 같은 글꼴이라 그대로 유효.

## 개정 2(더 화려하게) (2026-09-24, 사용자 선택 · `build-1b-instructions.md`)
**이 절이 위 홈 설명보다 우선한다.** 참고 사이트의 그림·문구·캐릭터는 가져오지 않았다. 새 3D 소품은 Claude가 준비한 `public/illustrations/3d/`(같은 MIT 출처) 파일만 썼고 새로 받지 않았다.

### 바꾼 점
| 부분 | 내용 | 파일 |
|---|---|---|
| 히어로 | 새 컴포넌트 `HomeHero`. 흰색 → 연보라(다크: 짙은 남보라 `oklch(0.27 0.07 288)` → `oklch(0.21 0.05 268)`) + 보라·분홍·하늘 빛 번짐 3개(`bg-hero-home`, 이미지·blur 필터 없이 그라데이션만), 아주 옅은 테두리, 보라 색 그림자 | `src/components/dashboard/home-hero.tsx`(신규), `globals.css` |
| 부엉이 | 데스크톱 무대 27rem, 부엉이 높이 384px = **히어로 높이 449px의 85%**(1440). 발밑 보라 빛 원판 + 뒤쪽 빛. 가장자리 필터·priority(eager + fetchpriority=high) 유지 | 같음 |
| 떠다니는 소품 | 별·반짝이·행성·로켓·전구 5개, 크기·기울기·속도(4.2~6.6초)·지연이 모두 다름. `transform`만 움직임, 움직임 줄이기면 멈춤(기울기만 남음). 히어로와 함께 eager 로드(개당 5~9KB), 모두 `alt=""`·`aria-hidden`·width/height. **휴대폰·태블릿 세로는 3개**(별·반짝이·행성), 부엉이 얼굴·날개와 안 겹침 | 같음 |
| 제목 | Display: 휴대폰 40px → 태블릿 48px → 데스크톱 60px. "배움터" = 보라 그라데이션 글자(`text-grad-primary`, 고대비 모드에선 일반 글자) + 연노랑 형광펜 띠(`--highlight`), 설명의 "함께"는 보라 굵게 | 같음 |
| 버튼 2개 | 주: "오늘의 과학 탐구 시작하기" → `/science/`(보라 그라데이션 알약 `bg-grad-primary`, 색 그림자, 올리면 떠오름). 보조: 흰 알약 "자유게시판 구경하기" → `/board/`. 둘 다 3px 실선 초점 테두리 | 같음 |
| 메뉴 카드 3개 | 3D 아이콘 80~88px → **112~128px(약 1.4배)**, 아이콘 뒤 흰 반투명 원, 화살표 버튼 둘레 **점선 링**, 올리면 떠오름 + 메뉴색 그림자 진해짐 + 아이콘 커지고 기욺(움직임 줄이기면 없음). 좁은 카드(1024 가로·1280 3열)는 아이콘이 위로 | `menu-shortcut-card.tsx` |
| 통계 칸 | `StatTile`에 `tone="vivid"` 추가(홈만): 더 둥근 칸, 메뉴색 부드러운 그림자, 원형 파스텔(그라데이션) 배지 위 3D 아이콘, 숫자 30px **굵기 800 + 메뉴색**(Jua는 굵기가 하나라 본문 글꼴로). 관리자 타일은 기본값이라 그대로 | `stat-tile.tsx` |
| 정보 카드 | 모서리 32px, 메뉴색 부드러운 그림자, 3D 칩 44 → 56px(휴대폰 48px), 제목 조금 크게, "더 보기" 알약에 메뉴색(soft 바탕 + ink 글자) | `page.tsx`, `menu-colors.ts`(`glowShadow`·`hoverGlow`·`pill`) |
| 섹션 제목 | "어디로 가 볼까요?"·"우리 반 한눈에 보기"(새로 보이게 함) 앞에 3D 반짝이, 24 → 28px | `page.tsx` |
| 페이지 배경 | 스크롤 아래쪽에 아주 흐린 보라 빛 2곳 추가(9%/8%) | `globals.css` |
| 기타 | `Icon3D`에 새 이름 8개 + `loading` 선택값(기본 lazy). 새 토큰: `--primary-grad-to`, `--{메뉴}-glow`, `--hero-from/to`, `--hero-blob-1~3`, `--highlight`, `--bg-blob-soft` | `icon-3d.tsx`, `globals.css` |

### 이번에 찾아 고친 문제
* **배경 끊김선**: `<html>`이 `h-full`이라 body 배경(그라데이션)이 화면 한 장 높이로 잘려, 아래쪽 빛 번짐이 약 900px 지점에서 딱 끊겼다. `html`에 배경색을 따로 주어 body 상자(문서 전체) 기준으로 그리게 고침. 고친 뒤 오른쪽 여백의 줄 간 색 변화 최대 5/765.
* **hover 떠오름이 부드럽지 않던 문제**: Tailwind v4는 `translate`/`scale`을 별도 CSS 속성으로 쓰는데 `transition-[transform,…]`만 적혀 있어 움직임이 뚝 끊겼다 → 내 카드·버튼은 `transition-[translate,box-shadow]`로 고침. 같은 문제가 **다른 화면에도 이미 있음**: `src/components/science/science-view.tsx:40`, `src/app/admin/(dashboard)/admin-overview.tsx:161`(범위 밖이라 그대로, 2·4단계에서 고칠 것).
* 휴대폰 375에서 정보 카드 제목이 두 줄("최근 / 자유게시판")로 꺾이고 통계 라벨이 잘리던 것 → 휴대폰에서만 칩·배지·제목을 한 단계 작게. 모든 폭에서 제목 1줄·라벨 안 잘림 확인.

### 대비(WCAG AA) — 정적 빌드 화면 픽셀 실측
| 자리 | 밝음 | 어두움 | 기준 |
|---|---|---|---|
| "배움터" 그라데이션 글자(형광펜 위) | 5.17~5.35 | 4.83~4.92 | 3(큰 글씨) |
| "함께"(보라 굵게) | 5.19~5.50 | 6.80~7.16 | 4.5 |
| 히어로 설명 글자 | 8.8~9.1 | 9.0~9.5 | 4.5 |
| 주 버튼 흰 글자(그라데이션 양 끝, 계산) | 5.59~5.98 | 8.09~8.4 | 4.5 |
| 통계 숫자(메뉴색, 계산) | 4.06~5.26 | 6 이상 | 3(큰 글씨) |
| 아래쪽 빛 번짐 위 흐린 글자(계산, 최악) | 4.78 | — | 4.5 |
* 홈 1440·1024·768·375 × 밝음/어두움 + 잠금 상태: **AA 미달 0건**(글자 상자 70~83개씩). 과학수업·게시판·게시판 글·학습게임·로그인·검색·내 학습·관리자도 0건.

### 그 밖의 확인(정적 빌드, 내 전용 브라우저)
* `npm run lint`·`npx tsc --noEmit`·`npm run build` 통과. 가로 스크롤 0, 콘솔 오류 0, 실패 요청 0(8개 화면 크기 모두).
* 레이아웃 흔들림(CLS) **0**. 한글 본문은 `PretendardVariable-Regular/Medium/SemiBold`, 제목은 `Jua`, 통계 숫자는 `Geist-ExtraBold`. 홈 글꼴 다운로드 11개 288KB(개정 1과 같음).
* 초점: 주·보조 버튼 3px 실선 + 3px 간격, 메뉴 카드·"더 보기" 3px 링(밝음·어두움). 움직임 줄이기: 소품·부엉이 애니메이션 `none`, 카드·버튼 전환 `none`.
* 다른 화면: `PageHero` 기본값·관리자 `StatTile` 기본값은 그대로라 과학수업·게시판·게임·로그인·관리자 모양 변화는 배경 빛 정도. 스크린숏으로 확인.

### 스크린숏(정적 빌드)
* `/private/tmp/claude-501/-Users-sungchul-Desktop-classroom/7bf3a39e-3017-4189-b337-1b82aace66bb/scratchpad/redesign-1b/home-1440-light.png`
* `/private/tmp/claude-501/-Users-sungchul-Desktop-classroom/7bf3a39e-3017-4189-b337-1b82aace66bb/scratchpad/redesign-1b/home-1440-dark.png`
* `/private/tmp/claude-501/-Users-sungchul-Desktop-classroom/7bf3a39e-3017-4189-b337-1b82aace66bb/scratchpad/redesign-1b/home-1024x768-light.png`
* `/private/tmp/claude-501/-Users-sungchul-Desktop-classroom/7bf3a39e-3017-4189-b337-1b82aace66bb/scratchpad/redesign-1b/home-768x1024-light.png`
* `/private/tmp/claude-501/-Users-sungchul-Desktop-classroom/7bf3a39e-3017-4189-b337-1b82aace66bb/scratchpad/redesign-1b/home-375-light.png`
* 추가: 같은 폴더의 `home-1024x768-dark.png`, `home-768x1024-dark.png`, `home-375-dark.png`

### 확인하지 못한 것
* 실제 iPad/Safari에서 떠다니는 소품 5개 + 부엉이 애니메이션의 부드러움·배터리, `background-clip:text` 그라데이션 글자, SVG 가장자리 필터 표시.
* 로그인한 상태의 머리말, 실제 hover 손맛(강제 hover 상태로만 확인).
