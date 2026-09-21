# Build 서브에이전트 지침: 프론트엔드 디자인 개편

## 목표
`docs/design/spec.md`(§12 확정 결정 포함)를 그대로 구현한다. 단계 0 → 7 순서로 진행한다.

## 먼저 읽을 것
* `CLAUDE.md`, `AGENTS.md` — 이 Next.js(16.x)는 학습 데이터와 다를 수 있다. 코드를 쓰기 전에 `node_modules/next/dist/docs/`의 관련 문서(font, link, use-pathname, static-exports)를 확인한다.
* `docs/design/spec.md` 전체
* spec §6에 나온 기존 파일들

## 수정 범위
* spec §6.1(신규) · §6.2(수정)에 적힌 파일, 그리고 `src/components/states.tsx`(illustration prop 하위호환 확장), `src/components/site-footer.tsx`(폭 조정)만.
* `src/components/site-header.tsx`는 `src/components/layout/topbar.tsx`로 대체한다. `SITE_NAME`을 import하는 곳(`layout.tsx` 등)을 모두 찾아 고친 뒤 기존 파일을 삭제한다.
* §6.3의 파일, `supabase/`, `public/apps/`, `next.config.ts`, `package.json`(새 의존성 추가 금지)은 건드리지 않는다.
* git commit 하지 않는다.

## 확정 사항
* 사이트 이름: **우리 반 배움터**. metadata description도 초등학생 눈높이로 다듬는다.
* 제목 글꼴 Jua(`next/font/google`, `weight: "400"`). `subsets` 값은 문서/빌드로 확인해 맞춘다. 빌드에서 subset 오류가 나면 `preload: false` 등 문서에 근거한 방법으로 해결한다. `--font-heading`에 연결하고 `font-heading` 유틸로 제목/메뉴 라벨/섹션 타이틀에 적용한다.
* 홈 대시보드에 "최근 소식"(전체 최신 글 5개, 더 보기 → `/search/`) 섹션 포함.
* 사이드바 기본 펼침, 키 `sidebar:collapsed`.

## 품질 기준
* **귀엽고 깔끔하게.** 일러스트는 단순한 도형 몇 개가 아니라, 둥근 형태·웃는 표정·작은 장식(별, 기포, 구름)이 있는 완성도 있는 플랫 스타일 SVG로 그린다. 색은 CSS 변수(`var(--science-strong)` 등)와 `currentColor`를 써서 다크모드에 자동 대응한다. 흰색이 필요한 곳은 `var(--card)`를 쓴다.
* 파스텔 색은 배경/아이콘/테두리에만. 본문 텍스트는 `text-foreground`/`text-muted-foreground`.
* Tailwind 클래스는 동적 문자열 결합 금지 → `src/lib/menu-colors.ts` 고정 매핑.
* 모바일 드로어는 기존 `ui/dialog.tsx`(base-ui)를 재사용하거나 base-ui Dialog 프리미티브를 직접 써서 포커스 트랩/ESC/바깥 클릭을 확보한다. 메뉴 링크를 누르면 닫힌다.
* 사이드바 접힘 상태의 첫 페인트 깜빡임 방지(§2.3). hydration mismatch 경고가 없어야 한다. 접힘 상태에서는 메뉴 라벨을 tooltip(`ui/tooltip.tsx`) 또는 `title`로 제공한다.
* 통계 타일·목록은 섹션별로 독립 fetch, 로딩/빈/오류 상태를 모두 구현한다. Supabase 환경변수가 없거나 요청이 실패해도 화면이 깨지지 않아야 한다.
* `react-hooks` lint 규칙(effect 안 동기 setState 등)에 걸리지 않게 기존 `post-list.tsx`의 패턴을 따른다.
* 기존 코드의 주석 밀도·이름 짓기·한국어 주석 스타일을 따른다.

## 검증 (끝내기 전에 반드시)
1. `npm run lint` 통과
2. `npm run build` 성공, `out/games/index.html`, `out/science/index.html`, `out/math/index.html` 존재 확인
3. 실패하면 고치고 다시 실행한다. dev 서버는 띄우지 않는다(브라우저 검증은 Review 단계에서 한다).

## 보고
`docs/design/build-report.md`에 작성: 만든/수정한/삭제한 파일 목록, spec과 다르게 구현한 부분과 이유, lint/build 결과, Review가 특히 확인해야 할 점.
