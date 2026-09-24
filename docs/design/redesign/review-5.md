# 디자인 개편 5단계 + 작은 문제 3개 — Review 보고서 (2026-09-24)

지침: `docs/design/redesign/review-5-instructions.md`. 대상: `docs/design/redesign/build-5-instructions.md`/`build-5-report.md`(제목 글꼴 G마켓 산스 Bold + 그림자), `docs/science/small-fix-2-instructions.md`/`small-fix-2-report.md`(스피너·예전 파랑 7곳·`sci-6-2-1-4` 버튼 겹침).

코드는 고치지 않았다(발견만 기록). git commit/push·실 DB 쓰기·실제 Supabase·Gemini 호출 없음.

## 요약

문항·내용·저장 구조·측정 조건은 변경 없음(diff로 전부 확인). 글꼴 파일·라이선스 정상. 제목 글꼴·그림자·예전 파랑→보라 교체 모두 브라우저에서 직접 재현·확인했고 `small-fix-2-report.md`가 적은 수치와 거의 소수점까지 일치했다. `lint`·`build`·`diff -r` 통과. 배포 형태(포트 4016) 확인에서 같은 URL·캐시 재사용·글꼴 실패 시 대체까지 정상.

**중간 심각도 발견 1건**: 과학 앱(`persist.js`, 동적 `<link>`)은 글꼴 응답이 5초 걸려도 첫 화면이 막히지 않지만, **사이트 홈의 글꼴 링크(`layout.tsx`, 정적 `<link>`)는 완전히 빈 캐시 상태에서 같은 테스트를 하면 첫 글자가 보이기까지 약 5.1초 걸렸다** — 아래 "항목 7" 참고. 실제 배포는 같은 출처(GitHub Pages)라 위험이 크지 않지만, `build-5-instructions.md`가 명시한 "첫 화면이 글꼴 때문에 늦지 않음"이라는 목표와는 어긋나고, build-5 자신도 이 경우(사이트 홈 + 완전히 빈 캐시)를 테스트하지 않았다(과학 앱만 5초 지연 테스트를 했다).

## 심각도별 발견

| 심각도 | 위치 | 무엇 | 재현 | 제안 |
|---|---|---|---|---|
| 중간 | `src/app/layout.tsx`의 `<link rel="stylesheet" href=".../gmarket-sans.css">` (사이트 홈 등 전체) | 이 링크는 최초 HTML에 정적으로 박혀 있어(과학 앱의 `persist.js`처럼 나중에 JS로 붙이는 방식이 아님) 브라우저가 기본적으로 **렌더 차단 스타일시트**로 취급한다(`font-display:swap`은 글꼴 자체의 교체 시점만 조정할 뿐, 스타일시트를 받아 오는 동안 화면을 막는지는 별개다). 완전히 빈 캐시(첫 방문)에서 이 CSS 응답이 느리면 화면 전체가 그만큼 늦게 그려진다 | 자기 전용 정적 서버(4016)에서 브라우저 캐시를 완전히 비운 뒤(`Network.clearBrowserCache`) `gmarket-sans.css`·`GmarketSansBold.otf` 응답을 5초 그대로 지연시키고 홈(`/class1/`)을 열면 첫 텍스트가 보이기까지 **약 5,101ms**(그물망 로그: CSS 응답이 5,015ms에 도착 → 96ms 뒤 첫 글자 등장 → 그 직후 Pretendard 서브셋 글꼴 11개·3D 아이콘 10개 요청이 한꺼번에 시작됨 — 레이아웃·페인트가 그 시점까지 통째로 미뤄졌다는 뚜렷한 증거). 같은 서버·같은 지연을 **딜레이 없이** 열면 118ms, **과학 앱**(`sci-6-1-1-2`, `persist.js`가 붙이는 동적 링크)은 같은 5초 지연에서도 112ms로 안 막힘 | 사이트도 과학 앱과 같은 비차단 기법을 쓴다(예: `layout.tsx`에서 `<link>`를 최초 HTML이 아니라 스크립트로 붙이기, 또는 `media="print" onload="this.media='all'"`/`rel="preload" as="style"` 기법). 다만 실제 배포는 같은 출처(같은 GitHub Pages 서버)라 외부 CDN만큼 잘 끊기지는 않고, 한 번 받으면 캐시(브라우저 자동 정책)되어 재방문에는 영향이 없다 — 위험도와 개발 비용을 함께 보고 판단할 사안 |
| 낮음(코드 문제 아님, 환경) | `npm run lint` | 저장소 안 `.claude/worktrees/affectionate-mclaren-b3c87e/`(다른 세션의 격리된 워크트리로 보임, 이번 리뷰 대상이 아니고 손대지 않음)까지 eslint가 훑어 "2 errors, 1212 warnings"로 exit 1이 난다 | `npm run lint` 그대로 실행 | 실제 리뷰 대상 트리(그 폴더 제외)는 오류·경고 0건(아래 항목 8 참고). 코드를 고치지 않았으니 손대지 않았지만, `.claude/worktrees`를 eslint 대상에서 빼면 다음에 이 혼선이 없다 |
| 낮음(제 테스트 도구 결함, 이미 스스로 고침) | 제 가짜 Supabase 서버(`posts`/`community_posts` mock) | 처음에 `posts` 응답 필드를 `content`/`body`로 잘못 만들어(실제 스키마는 `content_md`) 글 보기(`/post?slug=`)·자유게시판·학습게임 글 보기에서 Chrome 자체 오류 화면("This page couldn't load")이 떴다 | — | 실제 `src/lib/types.ts`의 `Post` 타입(`content_md`/`published`/`tags` 등)에 맞게 mock을 고치고 40개 조합을 다시 돌려 전부 통과(문제 0건) 확인했다. **제 테스트 스크립트 버그였고 사이트 코드 문제가 아니다** — 확인을 위해 기록해 둔다 |

문제라 할 것은 위 표가 전부다. **1~6, 8번은 전부 합격**이며 사소한 지적 없음.

## 항목별 합격/불합격과 실측값

### 1. 과학적·내용 무변경 — 합격
* `git diff`로 확인: 정본 2개(`style-common.css` ×2, `persist.js` ×2)는 글꼴·그림자·주석·(다른 작업의) 스피너 `!important` 외 변경 없음. `--ss-s1~s4`(그래프 색)·`--ss-scene-bg`·`--ss-accent`·`--ss-good/bad/warn-bg`·`--ss-radius` 등 과학적 의미가 있는 값은 모두 그대로.
* 작은 문제 3개(`small-fix-2`)의 앱 고유 `style.css` 7곳(예전 파랑→보라)도 diff로 확인: 색상 값만 바뀌었고 선택자·구조·다른 색은 그대로. `sci-6-1-2-4`의 `--tape-start`, `sci-6-2-1-4`의 `--ang`, `sci-6-2-1-5`의 `.o2-arrow`/`.o2-tag`, `sci-6-2-3-1`의 `.d2-battery`·`app.js` 3D 색(`0x2f6fd6`)은 grep으로 직접 재확인 — 지침대로 손대지 않고 남아 있음.
* `sci-6-2-1-4`의 `index.html`·`app.js`는 diff 0줄(완전히 그대로), `style.css`만 미디어 쿼리 1개 추가.
* 23개 앱 중 어느 폴더에서도 `app.js`/`index.html`/`config.js`/`data/*.js`가 바뀌지 않았음을 `git status`로 재확인(문항·측정 조건·저장 키가 있는 파일들).
* README.md 25개(정본 2 + 앱 사본 23)는 Jua→G마켓 산스로 설명만 갱신, 전부 `diff -r`로 정본과 일치 확인(아래 8번).
* 실제로 `sci-6-2-1-4`를 열어 "예상하기" 질문("무대 위에서 배우를 가장 밝게 비추려면 조명을 어떤 각도로...")과 STATUS.md가 적어 둔 "6-2-1-4: 태양 고도" 내용이 일치함을 확인(화면 캡처 `sci621-4-spinner-reduced-motion.png`).

### 2. 글꼴 파일·라이선스 — 합격
* `public/fonts/gmarket-sans/GmarketSansBold.otf`: sha256 = `0773544f5de7f45b6f12ee53a08f961fb92ba16ab55270a0f018b621bc260cec`(앞 16자리 `0773544f5de7f45b`, 지침과 정확히 일치), 889,708 bytes, `file` 명령으로 "OpenType font data" 확인.
* `LICENSE-gmarket-sans-OFL.txt`: 저작권 고지("© 2019 eBay Korea Co., Ltd.", Reserved Font Name "Gmarket Sans Font") + SIL OFL 1.1 전문(73줄, Reserved Font Name 조항 포함) 확인.
* `gmarket-sans.css`: `@font-face` 1개, `font-weight:700`, `font-display:swap`, 로컬 상대경로(`./GmarketSansBold.otf`) 참조 — 변환·서브셋 흔적 없음.
* `npm run build` 뒤 `out/`의 3개 파일이 `public/`의 원본과 md5 동일(무수정 재확인).

### 3. 사이트 화면 — 합격 (52쪽·210개 조합 실측, 문제 0건 — 위 표의 제 테스트 버그 제외)
* 자기 전용 headless Chrome(포트 9343)으로 홈·과학수업(학기→단원→차시목록→차시상세)·자유게시판(목록·글쓰기·글보기)·학습게임(목록·글쓰기·글보기)·글 보기(`/post?slug=`, 가짜 글에 h1~h3 포함)·검색·로그인·비밀번호 변경·내 학습 활동·404·관리자(대시보드·회원 관리·학습 현황="학생 응답" 탭 포함)를 1280×800/1024×768/768×1024/375×812(+320×640은 홈·과학수업), 밝음·어두움으로 **총 170개 조합**을 자동 점검(가로 넘침, `document.fonts`의 Gmarket Sans 로드 여부, 제목 요소들의 글꼴·굵기·그림자 존재, 알약/칩 옆 아이콘-글자 수직 정렬)했다. 전부 문제 0건(위 표의 mock 버그로 post-view·board·games 40개 조합이 한 번 거짓 실패했다가, mock을 고친 뒤 재실행해 0건으로 확인).
* 가로 스크롤(`scrollWidth > clientWidth`): 210개 조합 전부 0건.
* 제목 글꼴: 모든 화면에서 `.font-heading`류 요소가 `"Gmarket Sans"`를 먼저 쓰고 굵기 700으로 계산됨(`document.fonts`에 status `loaded`로 등록 확인).
* 그라데이션 글자("배움터"): 직접 계산값 확인 — `text-shadow: none`, `filter: drop-shadow(...) drop-shadow(...)` 2겹(지침과 정확히 일치).
* 관리자 영역 그림자 없음: 관리자 3화면 × 4뷰포트 × 밝음/어두움 = 24개 조합에서 `.admin-area` 안 제목 12~13개씩 전부 `text-shadow: none` 확인(스크린숏 `site-admin-dashboard-*` 참고 — 상단바·사이드바는 전역 요소라 원래도 관리자 영역 밖이라 그림자가 남는 게 맞음, `admin-theme.css` 구조 그대로).
* 고대비 모드(`forced-colors: active`): 과학수업 차시 상세 제목 5개, 관리자 대시보드 제목 12개 모두 `text-shadow: none` 확인(에뮬레이션은 Chrome `Emulation.setEmulatedMedia`로 재현).
* 대비(그림자 제외, 글자색↔바탕): 단색 배경 위 제목 8곳을 canvas 기반 sRGB 변환으로 직접 측정 — **16.9~17.9:1**(모두 AA 여유 있게 통과). 대부분의 제목은 그라데이션/이미지 배경이라 이 방식으로는 못 재는데(build-5도 같은 한계를 보고함), 스크린숏으로 육안 확인한 결과 흐려 보이거나 탁한 곳은 없었다.
* 스크린숏 40장으로 줄바꿈·정렬도 확인: 일부러 아주 길게 만든 글 제목("리뷰 확인용 아주 길게 적어 본 가짜 글 제목입니다 줄바꿈 확인")이 1280px에서 2줄로 자연스럽게 접히고 한 글자 낙오 없음(`site-post-view-*.png`).

### 4. 과학 앱(4개, build가 열지 않은 것) — 합격
* `sci-6-1-2-3`(실험)·`sci-6-2-1-2`(실험): 예상하기 답을 입력하고 "실험하기" 단계로 이동 성공 — 태블릿 가로 1024×768·세로 768×1024·휴대폰 375×812·태블릿 가로 어두움까지 4개 조합씩, 전부 가로 넘침 0, 제목 전부 G마켓 산스·굵기 700.
* `sci-6-1-1-6`(조사): "1. 조사 준비"(예상 질문 입력 → '생각 다 적었어요' → 주제 고르기) → "2. 조사하기" 단계까지 이동 성공, 같은 4개 조합에서 넘침 0, 제목 5개 전부 정상(스크린숏 `sciapp-sci-6-1-1-6-tablet-landscape-dark.png` 등).
* `sci-6-2-1-4` 기록하기 버튼 재실측(1024×768, 실험하기 진입 직후, 스크롤 안 함):

  | 상태 | 버튼 bottom | 막대 top | 여유 |
  |---|---|---|---|
  | 체험 모드 | 668.6 | 699.0 | **30.4px** |
  | 로그인 | 672.6 | 699.0 | **26.4px** |

  `small-fix-2-report.md`가 적은 최종값(체험 30.4px, 로그인 26.4px)과 **정확히 일치**. 1180×820도 재확인(체험 82.4px, 로그인 78.4px, 역시 보고서와 일치). 768×1024·375×812·812×375는 스크롤 전 화면 밖(정상, 지침상 허용)이고 스크롤하면 여유가 충분함을 재확인.
* `sci-6-2-1-4` 어두움(1024×768): 제목 4개 전부 G마켓 산스·굵기700·그림자 있음, 넘침 없음.
* 되짚기 스피너(움직임 줄이기): 처음에 체험 모드로 테스트했다가 스피너가 전혀 안 보여서(원인: `answer-check.js`의 `isTrial()`이 체험 모드에서는 서버를 아예 안 부르고 즉시 통과시킨다 — 설계대로 정상 동작, 버그 아님) 로그인 상태로 다시 확인: `check-answer` 응답을 3.5초 붙잡아 두고 실시간 DOM에서 `.ss-ac-spin`의 `animationDuration`이 움직임 줄이기에서 **"2.4s"**임을 확인(스크린숏 `sci621-4-spinner-reduced-motion.png` — "답을 다시 확인하고 있어요…" 카드가 실제로 뜬 화면).

### 5. 예전 파랑 7곳 (최소 3곳 직접 확인) — 합격
실제 앱 페이지가 불러온 진짜 `style.css`/`style-common.css` 위에 검사용 요소를 임시로 만들어(화면 밖, 스크린숏에는 안 보임) 계산된 스타일을 그대로 읽었다(직접 만든 선택자가 아니라 실제 CSS 규칙이 계산한 값):

| 위치 | 밝음 | 어두움 | 대비 |
|---|---|---|---|
| `sci-6-1-1-2` `.p2-col.is-sel`(산과 염기 선택 표시) | 테두리 `#6c4dd6`, 바탕 `#f5f3fc` | 동일(의도적으로 테마 고정) | 글자 13.69:1 |
| `sci-6-1-2-5` 계산기 "=" | 바탕 `#6c4dd6` + 흰 글자 | 바탕 `#aa9dff` + 짙은 글자 | 5.72:1 / 8.09:1 |
| `sci-6-2-2-2` `.d2-sel`(2D 점선) | `stroke:#6c4dd6` | `stroke:#aa9dff`(테마 반응) | 보라 확인(파랑 채널이 아니라 청보라 확인) |

세 값 모두 `small-fix-2-report.md`가 적은 수치(13.7:1, 5.7:1/8.1:1)와 거의 그대로 일치했다. 예전 파랑(`#2f6fd6`) 흔적 없음, 전부 보라 계열.

### 6. 배포 형태 확인(포트 4016) — 합격
* `npm run build` → `out/`을 자기 전용 정적 서버(포트 4016, `/class1/` 경로)로 띄움.
* 사이트 홈과 앱(`sci-6-1-1-2`)이 **완전히 같은 URL**(`http://.../class1/fonts/gmarket-sans/gmarket-sans.css`, `.../GmarketSansBold.otf`)을 요청하고 둘 다 200.
* 캐시 재사용: 처음(빈 캐시) 요청은 `fromDiskCache:false`였지만, 이어서 홈→앱→홈 순서로 다시 열자 **세 번 다 `fromDiskCache:true`**로 확인 — 사이트에서 한 번 받으면 과학 앱이 캐시를 그대로 쓴다.
* 글꼴을 완전히 막았을 때(Fetch 도메인으로 두 파일 다 실패시킴): 제목이 즉시 Pretendard 굵게로 표시되고 `document.fonts`에 Gmarket Sans가 아예 등록 안 됨(정상 대체) — 스크린숏 `static4016-font-blocked-home-v2.png`(레이아웃 깨짐 없음).

### 7. 첫 화면 막힘 없음 — 과학 앱 합격 / 사이트 홈 중간 심각도 발견(위 표 참고)
* **과학 앱**: 완전히 빈 캐시 + `gmarket-sans.css`·`.otf` 응답 5초 지연에서도 `sci-6-1-1-2`의 첫 텍스트(제목 요소 포함)가 **112ms**에 보임 — `persist.js`의 동적 `<link>` 설계가 실제로 작동함을 재확인.
* **사이트 홈**: 같은 조건(완전히 빈 캐시, 5초 지연)에서 첫 텍스트가 **약 5,101ms**에야 보임 — 네트워크 그물망 로그로 원인을 특정: `gmarket-sans.css` 응답이 5,015ms에 도착하고, 그 직후에야 Pretendard 서브셋·3D 아이콘 등 나머지 자원 요청이 시작됨(레이아웃·페인트가 그 시점까지 미뤄졌다는 뜻). `layout.tsx`의 이 `<link>`는 최초 HTML에 정적으로 있어 브라우저 기본 동작상 렌더 차단 스타일시트로 처리되고, `font-display:swap`은 이 문제를 해결하지 않는다(별개 메커니즘). 딜레이 없이 같은 서버로 열면 118ms — "서버 자체가 느려서"가 아니라 글꼴 CSS를 기다리는 것이 원인임을 대조 확인.
* 실제 Next 개발 서버(포트 3000, CDP Fetch 도메인으로 요청을 붙잡아 지연시키는 방식)로도 같은 걸 재확인해 봤는데 이번엔 219ms로 빠르게 나왔다 — **두 측정법이 엇갈렸다.** 다만 그물망 로그의 인과관계(CSS 응답 직후에야 다른 자원이 요청됨)가 "정적 `<link>`는 렌더를 막는다"는 잘 알려진 브라우저 기본 동작과 정확히 들어맞고, Fetch 도메인으로 요청을 붙잡는 방식은 실제 네트워크 지연을 완전히 똑같이 흉내 내지 못할 수 있어(가로챈 시점이 렌더링 엔진이 "기다리는 중"으로 보는 시점과 다를 수 있음) 정적 서버 결과 쪽을 더 신뢰할 만하다고 판단했다. **확실히 결론 내리지 못한 부분**이라 위 표에 "중간" 심각도로 남겨 사용자 판단을 구한다. 실제 배포(GitHub Pages, 같은 출처 전달이라 외부 CDN보다 끊길 가능성은 낮음)에서 실제 네트워크 제한(크롬 개발자 도구 "Slow 3G" 등)으로 다시 확인해 보는 것을 권한다.

### 8. `npm run lint` / `npm run build` / `diff -r` — 합격
* `npm run build`: 통과(Turbopack, 24개 정적 경로 생성, 오류 0). `out/fonts/gmarket-sans/`에 3개 파일 확인, md5로 원본과 동일 확인.
* `diff -r`: 정본 `scripts/templates/science-sim/` ↔ 실험 앱 20개의 `science-sim/`, 정본 `scripts/templates/science-guide/` ↔ 조사 앱 3개의 `science-guide/` — **23개 전부 완전 일치**(제가 직접 명령을 실행해 재확인, `diff -rq` 출력 0줄).
* `npm run lint`: 리뷰 대상 코드(프로젝트 트리 전체, `.claude/worktrees/` 제외)는 **오류 0·경고 0**. 원시 `npm run lint` 명령 자체는 exit 1(위 표 참고, `.claude/worktrees/affectionate-mclaren-b3c87e/`라는 무관한 워크트리 때문 — 이번 변경과 무관, 손대지 않음).

## Supabase 차단 기록

* Chrome 실행 인자 `--host-resolver-rules="MAP *.supabase.co 127.0.0.1:9, MAP supabase.co 127.0.0.1:9"`(예비 방어선) + CDP `Fetch.enable`(패턴 `*supabase.co*`, 실제 처리)로 첫 로드부터 전부 가짜 응답 처리. `site_settings`(`login_required:false`), `profiles`(요청 시점 역할에 따라 학생 `role:"user"`/관리자 `role:"admin"`/비로그인 `null`), `rpc/is_admin`, `rpc/my_must_change_password`(`false`), `functions/v1/check-answer`(`{"ok":true,"verdict":"ok"}`, 스피너 테스트에서만 3.5초 지연), `posts`/`community_posts`(가짜 글 1건, 실제 `Post`/`community_posts` 스키마에 맞춤), 그 외 GET→`[]`(단일 응답이면 `null`)/POST·PATCH→201/OPTIONS→204로 응답했다.
* 세션 전체(약 15개 스크립트, 사이트 210개 조합 + 과학 앱 다수 실행)에서 수백 건의 supabase.co 요청을 전부 이 Fetch 인터셉터가 가로채 가짜 응답을 줬다. 첫 스모크 테스트에서 직접 집계한 예로는 홈 1회 로드당 25건. `Network.loadingFailed`(가로채지 못해 실제로 실패한 요청)는 그때 0건이었고, 이후 어떤 스크립트에서도 supabase 관련 오류(예: 관리자 화면이 "접근할 수 없습니다"로 막히거나 콘솔에 네트워크 오류가 찍히는 등)가 관찰되지 않았다 — 간접적으로도 가로채기가 세션 내내 끊김 없이 동작했다고 볼 수 있다.
* 실제 Gemini는 `check-answer` Edge Function 경유로만 호출되므로 위 차단에 포함되며, 실제로 부른 적 없다.
* 로그인 상태는 `localhost`/`127.0.0.1` 출처에서만 `Page.addScriptToEvaluateOnNewDocument`로 `sb-<ref>-auth-token`에 서명 없는 JWT(만료 1시간 뒤)를 넣는 방식을 썼다. ref 값은 이 문서에 적지 않았다.

## 스크린숏

`/private/tmp/claude-501/-Users-sungchul-Desktop-classroom/7bf3a39e-3017-4189-b337-1b82aace66bb/scratchpad/review-5/shots/`에 53장(테스트 스크립트·JSON·로그·Chrome 프로필은 정리하며 지웠고 스크린숏만 남김). 주요 파일:
* 사이트: `site-home-{1280x800,375x812,320x640}-{light,dark}.png`, `site-science-{term,lesson-detail}-*.png`, `site-board-{list,new,post}-*.png`, `site-games-{list,post}-*.png`, `site-post-view-*.png`, `site-search-*`, `site-login-*`, `site-my-learning-*`, `site-notfound-*`, `site-admin-{dashboard,members,learning}-*.png`(다크 포함, 그림자 없음 육안 확인용)
* 과학 앱: `sciapp-sci-6-1-2-3-*`, `sciapp-sci-6-2-1-2-*`, `sciapp-sci-6-1-1-6-*`(4뷰포트×필요시 다크), `sci621-4-{guest,user}-1024x768-noscroll.png`(버튼 겹침 재실측), `sci621-4-dark-1024x768.png`, `sci621-4-spinner-reduced-motion.png`(스피너 2.4초 실제 화면)
* 예전 파랑: `oldblue-sci-6-1-1-2-injected-{light,dark}.png`
* 배포 형태: `static4016-font-blocked-home-v2.png`, `static4016-fontdelay-{home,app}-early.png`
* 항목 7(첫 화면 막힘): `item7-home-during-hold.png`, `item7-app-during-hold.png`, `item7-devserver-cold-delay.png`

## 확인하지 못한 것

* 실제 iPad/태블릿(터치 드래그, 실제 렌더링 엔진, 실제 화면 밀도) — 전부 헤드리스 Chrome 뷰포트 에뮬레이션.
* 실제 로그인 흐름(이메일/비밀번호, GitHub·Google OAuth) — 가짜 세션 토큰만 사용.
* **항목 7의 사이트 홈 결과는 두 측정법이 엇갈려 완전히 결론 내리지 못했다**(위 항목 7 설명 참고) — 실제 배포 사이트에서 크롬 개발자 도구의 네트워크 제한 기능으로 다시 확인해 보길 권한다.
* `sci-6-1-2-3`·`sci-6-2-1-2`·`sci-6-1-1-6`은 "실험하기/조사하기" 단계까지만 열었고, 기록·분석하기·정리하기까지는 (이번 리뷰에서는) 안 열어 봤다 — 다만 이 단계들의 문항·로직은 이번 변경(글꼴·그림자만)의 대상이 아니고 diff로 무변경을 이미 확인했으므로 위험은 낮다고 본다.
* 23개 앱 중 실제로 브라우저에서 열어 확인한 것은 이번 리뷰의 4개(`sci-6-1-1-6`, `sci-6-1-2-3`, `sci-6-2-1-2`, `sci-6-2-1-4`) + build-5가 연 3개(`sci-6-1-1-2`, `sci-6-2-3-2`, `sci-6-1-1-5`) + small-fix-2가 연 8개, 합쳐서 13개(겹치는 것 제외)이고, 나머지는 `diff -r` 완전 일치로만 확인했다(공통 틀 CSS 변경이라 파일이 같으면 화면도 같다고 보는 게 합리적이나, 직접 본 것은 아니다).
* Chrome 외 다른 브라우저(Safari, Firefox 등) — 특히 `<link>` 렌더 차단 관련 항목 7 발견은 브라우저마다 세부 동작이 다를 수 있다.
* 그라데이션·패턴 배경 위 제목 글자의 자동 대비 측정(도구 한계 — 스크린숏 육안 확인으로 대신함, build-5도 같은 한계를 보고함).
* 관리자 화면의 모든 하위 탭(예: "학생 응답" 안의 개별 피드백 화면, 일괄 칭찬 등)까지 전부 열어 보지는 않았다 — 최상위 3화면(대시보드·회원 관리·학습 현황)과 "학생 응답" 탭이 목록에 있는 것까지만 확인했다.

---

## Claude 조치 (2026-09-24, 검토 뒤)
* **중간 — 사이트 글꼴 CSS가 첫 화면을 막음**: `src/app/layout.tsx`의 정적 `<link rel="stylesheet">`를 과학 앱 `persist.js`와 같은 방식(작은 인라인 스크립트가 `<link>`를 붙임)으로 바꿨다. 재측정(빌드한 `out/`을 `/class1/`로 서빙, 글꼴 CSS·OTF 응답을 각각 5초 지연, 캐시 끔, 실제 Supabase는 host-resolver로 차단): 첫 화면(FCP) 홈 **156ms**, 과학수업 **52ms**, 과학 앱 `sci-6-1-1-2` **48ms** — 글꼴이 오기 전에는 대체 글꼴(Pretendard, 굵기 700)로 보이고 제목이 바로 보였다. 콘솔 오류 0(개발 서버 새 탭에서 홈·학습게임·자유게시판도 0).
* **낮음 — lint가 다른 세션의 워크트리까지 검사**: `eslint.config.mjs` 무시 목록에 `.claude/**`, `tsconfig.json` exclude에 `.claude`를 더했다. `npm run lint` 오류·경고 0, `npm run build` 통과.
* 참고: 개발 서버 기록의 `Jua is not defined`(Build 도중 layout.tsx를 고치던 순간)과 `marked(): input parameter is undefined`(검토 도구의 가짜 글 데이터 모양 오류)는 지난 기록이며 현재 코드에서는 재현되지 않았다.
