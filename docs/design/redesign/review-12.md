# Review: 디자인 개편 1·2단계 (2026-09-24)

Build와 독립적으로 검증했다. **코드는 고치지 않았다.** 검증 대상: 커밋 `a33c9cf`(1단계+보강), `5cc6cf4`(2단계). 참고 문서: `spec.md`(개정 1까지), `build-1-instructions.md`, `build-1b-instructions.md`, `build-2-instructions.md`, `build-1-report.md`(개정 1·2 포함), `build-2-report.md`.

## 요약

| 심각도 | 건수 |
|---|---|
| 심각 | 0 |
| 높음 | 0 |
| 중간 | 1 |
| 낮음 | 2 |

기능 회귀는 발견하지 못했다. 로그인/로그아웃 게이트, 글·댓글·좋아요, 게임 업로드·샌드박스 실행, 과학수업→앱 링크, 검색, 404, 관리자 진입 가드를 실제로 조작해 확인했고 모두 정상이었다. `build-2-report.md` §8이 "이번에 고치지 않음"이라 적어 둔 두 항목("삭제된 앱", "지도서 N차시")은 실제로는 같은 커밋에서 수정되어 배포된 상태를 코드·컴파일된 번들·브라우저 실행 세 단계 모두에서 확인했다(아래 상세).

## 문제 표

| 심각도 | 위치 | 현상 | 재현 | 수정 제안 |
|---|---|---|---|---|
| 중간 | `public/illustrations/3d/atom.webp` (쓰는 곳: `src/components/science/science-view.tsx:71,74,281`) | 같은 폴더의 다른 14개 3D 아이콘(예: `house.webp`, `test-tube.webp`, `magnet.webp`, `microscope.webp`)은 모두 입체감 있는 글로시 3D 렌더링인데, `atom.webp`만 무광 보라 사각 배지 안에 흰 선그림 원자 기호가 들어간 완전히 다른 스타일이다. `LICENSE-fluent-emoji.txt`가 폴더 전체를 "Microsoft Fluent Emoji, MIT"로 일괄 고지하고 있어, 이 파일이 실제로 그 저장소 원본이 맞는지 육안으로는 확신하기 어렵다(인터넷 접속 없이 원본 저장소와 직접 대조는 못 했다). `build-1b-instructions.md:6`도 이 파일을 "보라 네모 배지 모양"이라고 미리 알고 있었던 것으로 보아 Build 단계에서 새로 생긴 문제는 아니다. | `public/illustrations/3d/atom.webp`를 다른 아이콘과 나란히 열어 스타일 비교 | 실제 Fluent Emoji 저장소의 "Atom Symbol" 3D 자산과 대조해 원본이 맞는지 재확인. 원본이 맞다면 문제 없음(단순 참고 기록). 다르면 정품 자산으로 교체하거나, 자체 제작분이라면 라이선스 파일에 예외로 명시 |
| 낮음 | 홈 히어로 preload: 마스코트·소품 렌더 지점(`src/components/dashboard/home-hero.tsx`, `src/components/illustrations/icon-3d.tsx`, `src/components/illustrations/mascot.tsx`) | 새 탭에서 홈(`/class1/`)에 처음 들어가면 콘솔에 "preloaded using link preload but not used" 경고가 7건 뜬다(`owl-wave.webp` 1, 떠다니는 3D 소품 5개, Geist 폰트 파일 1개). 해당 이미지들은 실제로 히어로에 즉시 렌더링되어 눈에 보이므로 기능상 문제는 아니고, 크롬 자체의 타이밍 판정 오탐으로 보인다(`document.querySelectorAll('link[rel=preload]')`로 확인한 결과 마스코트만 `fetchpriority=high`이고 나머지 5개 소품은 `fetchpriority` 없이 `as=image` preload만 걸려 있음). | 새 탭(캐시 비움)에서 `/class1/` 접속 후 콘솔 확인 | 기능 영향 없어 방치해도 무방. 콘솔을 깨끗이 하려면 마스코트 외 5개 소품의 명시적 preload를 제거(어차피 `loading="eager"`라 렌더링 순서는 유지됨)하는 것을 고려 |
| 낮음(문서) | `docs/design/redesign/build-2-report.md:78-79` | §8에 "삭제된 앱"·"지도서 N차시" 문제를 "이번에 고치지 않음"이라고 적어 두었으나, 같은 커밋 `5cc6cf4`에 이미 수정 코드가 포함되어 배포되었다(커밋 메시지 2번째 줄에도 "Also show science app titles instead of '삭제된 앱' and drop the teacher-guide wording"라고 명시). 코드 자체는 문제없이 동작하지만, 보고서 문구만 최신 상태와 어긋나 있어 나중에 이 문서만 보는 사람이 "아직 안 고쳐졌다"고 오해할 수 있다. | `build-2-report.md` §8과 `git show 5cc6cf4 --stat` / 실제 diff 비교 | 코드 수정은 필요 없음. 기회가 되면 `build-2-report.md` §8을 "이번 커밋에 포함되어 해결됨"으로 갱신 |

## 상세 확인 내용

### 1. 기능 회귀 (최우선) — 문제 없음

- **게임 샌드박스 보안**: `git diff a33c9cf~1..HEAD -- src/components/community/game-player.tsx`로 확인한 결과 `sandbox={GAME_SANDBOX}`, `srcDoc={srcDoc}`, `allow={GAME_PERMISSIONS}`, `referrerPolicy="no-referrer"`, `key={runId}` 등 보안 관련 코드는 diff에 한 줄도 나타나지 않았다(className·아이콘만 변경). `GAME_SANDBOX = "allow-scripts"`(`src/lib/community.ts:328`)로 `allow-same-origin`은 여전히 없다. 실제로 업로드된 게임("비와 비율 테트리스 게임")을 브라우저에서 "게임 시작"까지 눌러 실행해 iframe의 `sandbox`/`allow`/`referrerpolicy`/`srcdoc` 속성이 코드와 동일하게 렌더링되는 것을 직접 확인했다.
- **과학수업 → 앱 링크(basePath)**: 6학년 1학기 › 산과 염기 › 탐구 1 상세 화면에서 "실험 시뮬레이션 시작하기" 링크가 `/class1/apps/sci-6-1-1-1/`로 정확히 생성되고, 클릭 시 해당 과학 앱이 정상 로드되는 것을 확인했다(앱 자체는 "수정 금지" 대상이라 내용은 건드리지 않고 조회만 함).
- **"삭제된 앱" 표시 수정**: `src/lib/learning.ts:43-44`에서 `appTitle()`이 `webApps`(빈 배열) → `findResponseApp(appId)?.title`(과학 차시 제목, `src/data/app-responses/index.ts:46-62`가 `science-curriculum.ts`에서 만든 목록) 순으로 찾도록 바뀐 것을 소스에서 확인했고, 컴파일된 번들(`out/_next/static/chunks/*.js`)에도 이 로직이 포함된 것을 확인했다. 다만 로그인 세션·`app_progress` 데이터를 모두 가짜로 만들어 "웹앱 결과" 탭을 실제로 렌더링해 보는 것은 이 리뷰의 도구로는(사전 하이드레이션 시점에 네트워크를 안정적으로 가로챌 방법이 없어) 재현하지 못했다 — 코드·번들 수준 검증으로 대체했다(아래 "확인 못 한 것" 참고).
- **"지도서" 문구 제거**: `science-view.tsx:471,563`(목록), `516`(상세)에서 "지도서 {lesson.period}차시" → "{lesson.period}차시"로 바뀐 것을 diff로 확인했고, 브라우저에서 산과 염기 탐구 1 상세 페이지를 직접 열어 본문 텍스트에 "지도서"가 없는 것(`get_page_text` 결과)을 확인했다. 컴파일된 블로그 번들 전체(`out/_next/`)에서 "지도서" 문자열이 0건인 것도 grep으로 확인했다(반면 `src/data/science-curriculum.ts`의 개발자 주석에는 남아 있으나 화면에 노출되지 않으므로 문제 없음).
- **글·댓글·좋아요·검색**: 실제 배포 DB의 공개 글(자유게시판 "Say! 독립운동가" 등)을 anon key로 읽어 목록·상세 화면이 정상 렌더링되는 것을 확인했다. 검색에서 "과학"으로 질의해 실제 쿼리가 나가고(현재 발행된 선생님 글이 없어 결과 없음 상태가 정상적으로 뜸) 오류가 없는 것을 확인했다. 좋아요·댓글·신고 등 쓰기 버튼은 실 DB에 쓰기를 시도하게 되므로 누르지 않았다(코드 리뷰로만 확인).
- **로그인 잠금/게이트**: 비로그인 상태로 `/admin/`, `/me/learning/` 접근 시 각각 로그인 화면·"로그인이 필요합니다" 안내로 정상 전환되고 크래시가 없는 것을 확인했다.
- **관리자 화면 영향**: 로그인 없이는 관리자 화면 내부를 확인할 수 없어(관리자 세션을 가짜로 완전히 재현하지 못함) 코드 리뷰로 대체했다. `AdminShell`·`AdminPageHeader`·관리자 전용 파일은 이번 두 커밋의 변경 목록에 없고, 공용 컴포넌트 중 관리자 화면에도 보이는 변경은 `EmptyState`/`ErrorState`의 모서리·점선 색과 다크모드 안 읽음 배지 색뿐이라고 `build-2-report.md`가 밝히고 있으며, 이는 코드상 `audience` 분기(`src/components/states.tsx`, `src/components/learning/learning-ui.tsx`)로 관리자·학생 화면을 구분하고 있어 타당해 보인다.
- **하드코딩 절대경로**: 이번 커밋에서 변경된 모든 `.tsx` 파일을 대상으로 `href="/…"`/`src="/…"` 패턴을 전수 검색한 결과, 전부 `next/link`(basePath 자동 적용) 사용이었고 `<img>`/`<a>`에서 basePath를 직접 붙여야 하는 자리(과학 앱 링크, 3D 아이콘, 마스코트)는 모두 `withBasePath()`를 통했다. 위반 사례를 찾지 못했다.
- **DB 안전성**: 두 커밋 모두 `supabase/` 디렉터리·`.sql` 파일 변경이 0건이다(`git diff --stat`으로 확인). RLS·스키마는 이번 개편과 무관하며, `markdown-viewer.tsx`(DOMPurify 처리)도 diff에 나타나지 않아(완전히 무변경) 마크다운 렌더링 보안 경로도 그대로다. `dangerouslySetInnerHTML`을 diff 전체에서 검색한 결과 신규 사용 0건.

### 2. 저작권·출처

- 코드·에셋 어디에도 "똑똑! 수학탐험대"라는 참고 사이트명이 배포 대상 경로에 없다(`docs/design/redesign/*-instructions.md` 안에만 내부 참고용으로 존재, 사이트에 배포되지 않음).
- `public/fonts/LICENSE-pretendard-OFL.txt`(SIL OFL 1.1 전문), `public/illustrations/3d/LICENSE-fluent-emoji.txt`(MIT 전문 + 출처 표기) 둘 다 존재하고 내용이 올바르다.
- 마스코트(부엉이 과학자 4종)는 참고 사이트 캐릭터와 겹치지 않는 독자 디자인으로 보인다.
- 3D 아이콘 15개 중 14개는 실제 Fluent Emoji 3D 스타일과 일관되나, `atom.webp` 1개는 스타일이 달라 위 문제 표에 별도 기록했다.

### 3. 정적 export·basePath

- 이 리뷰용으로 별도 독립 빌드를 다시 수행했다(`npm run build`, 24개 정적 페이지, 기존 `out/`을 덮어씀). `npm run lint`, `npx tsc --noEmit` 모두 통과(0건).
- `out/`을 내 전용 포트(5931)의 정적 서버에 `/class1` 경로로 심볼릭 링크해 배포와 동일한 조건으로 띄우고 확인했다. 홈 화면 기준 이미지·폰트·JS 청크 등 모든 리소스가 `/class1/...`로 요청되고 200 OK였다(네트워크 로그 실측).
- 다른 화면(과학수업 4단계, 게시판, 게임, 로그인, 검색, 내 학습, 404)도 같은 서버에서 하드 네비게이션으로 열어 전부 `/class1/` 프리픽스가 맞는 것을 확인했다.

### 4. 접근성

- 대비: `build-1-report.md`가 제시한 수치 중 하나(다크 모드 보라 버튼 글자 대비 8.09)를 브라우저에서 실제 렌더링된 그라데이션 시작색 기준으로 독립적으로 다시 계산해 **8.09로 정확히 일치**함을 확인했다(캔버스로 `lab()`/`oklch()` 계산값을 실제 sRGB 픽셀로 변환 후 WCAG 상대휘도 공식 적용). 육안으로는 배경·글자 밝기 관계를 반대로 오인하기 쉬운 조합이었는데, 수치 계산으로 실제로는 AA를 넉넉히 만족함을 확인했다. 이 외 화면은 스크린숏 육안 검토로만 확인했고 전면 재계산은 하지 않았다.
- 색만으로 정보 전달: 사이드바 활성 항목은 배경+글자 굵기로, "실험 앱"/"조사 도우미" 배지는 아이콘+글자로 구분되는 것을 코드(`AppBadge`, `science-view.tsx:449-462`)와 화면 양쪽에서 확인했다.
- 키보드 초점: 홈 화면에서 Tab으로 사이드바 메뉴·보조 버튼까지 이동하며 스크린숏으로 초점 링이 보이는 것을 확인했다(다른 화면의 폼·다이얼로그까지는 시간상 전수 확인하지 못함).
- `prefers-reduced-motion`: 브라우저 동작 자체를 에뮬레이션하는 도구가 없어, `globals.css:396-411`에 `@media (prefers-reduced-motion: reduce)` 블록이 `mascot-float`/`prop-float`/`illo-float*`/`illo-twinkle*` 애니메이션과 사이드바 전환을 모두 무력화하는 것을 코드로 확인하는 것으로 대체했다.
- 이미지 `alt`/`aria-hidden`: 홈 화면의 `<img>` 28개 전부(3D 아이콘·마스코트) `alt=""` + `aria-hidden="true"` + `width`/`height`가 있는 것을 JS로 전수 확인했다.

### 5. 반응형·성능

- 홈 화면을 1440×900, 1024×768, 768×1024, 375×812(모바일 프리셋) 4개 크기 × 밝음/어두움에서 확인, 매번 `document.documentElement.scrollWidth > clientWidth`로 가로 스크롤 없음(false)을 확인했다. 모바일 드로어 메뉴도 열어 3D 아이콘이 정상 표시되는 것을 확인했다.
- 과학수업(학기→단원→차시→상세), 게시판, 학습게임(목록+실행), 로그인, 검색, 404, 내 학습(비로그인)도 375~1440 사이 화면에서 스크린숏을 남겨 레이아웃 깨짐이 없는 것을 확인했다.
- 첫 화면 폰트 요청: 홈 진입 시 woff2 21개(Pretendard 가변 서브셋 11개 + Geist/Jua 계열 10개) — `build-1-report.md`가 밝힌 "Pretendard 11개·288KB"와 정확히 일치했다.
- 콘솔 오류: 여러 화면을 같은 탭에서 연속으로 이동하면 "preload 사용 안 됨" 경고 등이 이전 페이지 것까지 누적되어 보이는 도구 특성을 발견했다. 이를 피하기 위해 홈·과학수업·404 등 주요 화면은 **새 탭에서 그 화면만 단독으로 열어** 콘솔을 다시 확인했고, 이 방식으로는 실제 오류(error)가 0건이었다(홈의 preload 경고 7건은 새 탭에서도 재현되어 위 문제 표에 기록).

### 6. 학생 화면 규칙

- "지도서" 문구: 위 1절 참고 — 소스·컴파일된 번들·실제 브라우저 렌더링 3단계 모두에서 제거를 확인했다.
- "삭제된 앱" → 차시 제목: 소스(`appTitle` 폴백 체인)와 컴파일된 번들 수준까지 확인했으나, 로그인한 학생의 실제 "웹앱 결과" 탭 렌더링까지는 이 리뷰 환경에서 재현하지 못했다(아래 참고).

## 확인한 것 vs 확인 못 한 것

**확인한 것**
- `npm run lint` / `npx tsc --noEmit` / `npm run build`(24페이지) 독립 재실행, 전부 통과
- 게임 샌드박스 구조(`sandbox`/`allow`/`referrerPolicy`/`srcdoc`) 코드 diff + 실제 게임 실행까지 브라우저에서 재현
- basePath: 정적 서버(`/class1`)에서 홈 전체 리소스 200 OK, 여러 화면 하드 네비게이션 확인, 하드코딩 절대경로 전수 검색 0건
- "지도서"·"삭제된 앱" 수정 — 소스 + 컴파일된 번들 수준 확인(브라우저 로그인 렌더링은 못 함, 아래 참고)
- 홈 화면 1440/1024×768/768×1024/375 × 밝음/어두움 가로 스크롤 0, 키보드 초점, `alt`/`aria-hidden`
- 대비 수치 1건 독립 재계산 후 build-1-report 수치와 정확히 일치 확인
- 로그인 잠금 게이트(`/admin/`, `/me/learning/`), 404, 검색 실제 동작
- 공개 게시판·학습게임 실제 데이터로 목록/상세 렌더링(anon 읽기만, 쓰기 없음)
- SQL/마이그레이션 변경 없음(RLS 무관), `markdown-viewer.tsx` 무변경 확인

**확인하지 못한 것**
- **로그인한 학생의 실제 "웹앱 결과" 탭 렌더링**: Supabase 인증은 클라이언트 JS가 초기화되는 시점에 바로 세션을 읽어들이는데, 이 리뷰 도구로는 하이드레이션 이전 시점에 안정적으로 네트워크를 가로챌 방법이 없어(Build 측은 CDP 수준 접근으로 재현한 것으로 보임) 실제 로그인 상태에서 `app_progress`/`app_results` 데이터가 화면에 어떻게 뿌려지는지는 재현하지 못했다. 코드·컴파일된 번들 수준 검증으로 대체했다.
- **실제 iPad/Safari, 실제 터치 조작**: headless Chrome으로만 확인, 실기기 확인 못 함(Build 보고서도 동일하게 밝힘).
- **`atom.webp`의 실제 출처**: 인터넷에 접속해 Microsoft Fluent Emoji 원본 저장소와 직접 대조하지 못했다(위 문제 표 참고).
- **`prefers-reduced-motion` 실제 브라우저 에뮬레이션**: 도구가 지원하지 않아 CSS 코드 확인으로 대체.
- **폼·다이얼로그(로그인 입력창, 신고/삭제 확인창 등)의 키보드 초점 전수 확인**: 홈 화면 위주로만 확인, 시간상 전 화면 반복하지 못함.
- **관리자 화면 실제 렌더링**: 로그인 없이는 진입 불가라 코드 리뷰로 대체(관리자 전용 파일은 이번 두 커밋의 변경 목록에 없음을 확인).
- 좋아요·댓글·신고 등 실제 쓰기 동작의 화면 반응(의도적으로 클릭하지 않음, 실 DB 쓰기 방지).

## 작업 환경

내 전용 headless 브라우저(별도 탭, 세션 종료 후 모두 닫음)와 내 전용 정적 서버(포트 5931, `out/`을 `/class1`로 심볼릭 링크, 작업 종료 후 프로세스 종료)만 사용했다. git은 `status`/`log`/`show`/`diff`만 실행했고 커밋·체크아웃은 하지 않았다. `localStorage.clear()`는 쓰지 않았고, 다크모드 테스트용으로 넣은 키 1개는 직접 `removeItem`으로 되돌렸다. 실 DB에는 anon key로 공개 데이터 읽기만 했고 쓰기 요청은 보내지 않았다.
