# build-report.md — sci-6-1-1-2 (지시약으로 여러 가지 용액을 분류해 볼까?)

작성: Build 서브에이전트 (2026-09-22). 커밋하지 않았고, Embed(차시 화면 버튼 연결)는 하지 않았다.

## 1. 파일 목록

### 공통 틀 정본 `scripts/templates/science-sim/` (새로 만듦)
| 파일 | 역할 |
|---|---|
| `persist.js` | `SciSim.createStore(prefix)` localStorage 임시 저장(모든 접근 try/catch, 저장 불가 시 메모리 대체 + `available` 플래그). DOM 도우미 `SciSim.el`, `SciSim.debounce` |
| `stage-nav.js` | `SciSim.StageNav` 단계 진행바. 앞 단계는 언제든, 뒤 단계는 `canEnter` 통과 시 이동. `data-stage` 섹션 표시 전환 |
| `predict.js` | `SciSim.Predict` 예상하기(질문 textarea + 단계별 힌트 버튼) |
| `sim3d.js` | `SciSim.Sim3D` three.js 뷰어: WebGL 확인 → `import("three")`(importmap) → 실패 시 `null`(2D 대체). OrbitControls(드래그 회전, 핀치 확대, 더블탭 초기화), 탭 선택(raycast), 트윈·색 전환·카메라 `focus/flyHome`, 저폴리곤 물체 팩토리(홈판, 병, 시험지, 스포이트, 방울, 핀셋, 글자 라벨), 화면 밖/탭 숨김 시 렌더 정지, 컨텍스트 손실 콜백 |
| `record-store.js` | `SciSim.RecordStore` 기록 배열(같은 칸 덮어쓰기, 진행률) |
| `table-chart.js` | `SciSim.TableChart.renderMatrix`(색상 매트릭스 표) / `renderBar` / `renderLine`(SVG) |
| `quiz.js` | `SciSim.Quiz` 보기 고르기(단일·복수), 정확 일치 채점, 맞음/틀림 피드백, 시도 횟수 |
| `conclude.js` | `SciSim.Conclude` 결론·발전 질문: 제출 후 모범 답안 나란히 비교, 순서대로 열림 |
| `curiosity.js` | `SciSim.Curiosity` 더 탐구하고 싶은 점 |
| `style-common.css` | 공통 레이아웃·버튼(44px 이상)·표·다크모드 토큰 |

### 앱 `public/apps/sci-6-1-1-2/`
| 파일 | 역할 |
|---|---|
| `index.html` | 화면 틀, importmap(three@0.169.0 + SRI), supabase-js@2.116.0(SRI), 스크립트 순서 |
| `style.css` | 이 차시 전용 스타일(실험 패널, 2D 홈판, 관찰 색 견본) |
| `app.js` | 차시 로직: 단계 연결, 실험 A→B 잠금, 3D/2D 장면, 관찰·기록, 분석 표, 저장 |
| `data/lesson-config.js` | 용액·지시약·**색 변화표(spec §1.3 값만)**·질문·힌트·퀴즈·모범 답안 |
| `config.js` | Supabase URL + anon key(`.env.local`의 공개 값, JWT role=anon 확인) |
| `class1-record.js` | `scripts/templates/class1-record.js` 그대로 복사 |
| `science-sim/*` | 공통 틀 복사본(정본과 diff 없음) |

## 2. 공통 틀 사용법 — 새 차시 앱 만드는 절차
1. `public/apps/sci-{학기}-{단원}-{탐구}/` 폴더를 만들고 `scripts/templates/science-sim/`을 `science-sim/`으로, `scripts/templates/class1-record.js`를 폴더 바로 아래로 복사한다.
2. `config.js`(SUPABASE_URL, anon key — 블로그와 같은 URL)를 둔다.
3. `index.html`은 이 앱의 것을 본떠 만든다: importmap + modulepreload(three 버전·SRI 그대로), supabase-js(SRI) → `config.js` → `class1-record.js` → `science-sim/*.js` → `data/lesson-config.js` → `app.js`. 섹션은 `<section data-stage="{id}">`.
4. `data/lesson-config.js`에 `appId`, `storageKey`(예: `sci612sim3:v1`), `stages`, `predict{questions,hints}`, `quiz[]`, `conclude[]`, `curiosity`와 차시 실험 데이터(지도서 값만)를 넣는다.
5. `app.js`에서 `SciSim.createStore` → `Predict/Quiz/Conclude/Curiosity.render` → `RecordStore` → `StageNav({canEnter,isDone})`를 연결하고, 실험 장면은 `SciSim.Sim3D.create()`가 `null`이면 2D 대체 화면을 쓰도록 만든다(이 앱의 `build3D/build2D`처럼 `highlight/run/showInstant/clear` 같은 뷰 인터페이스를 두면 두 화면을 같은 코드로 다룰 수 있다).
6. 마치기에서 `Class1Record.save({ completed, durationSec, detail })`.
7. 공통 틀을 고칠 때는 **정본을 먼저 고치고** 각 앱 폴더에 다시 복사한다. CDN 버전을 바꾸면 SRI를 다시 계산한다(`curl -s <src> | openssl dgst -sha384 -binary | openssl base64 -A`).
8. 2D 대체 화면 확인: 주소 뒤에 `?no3d=1`.

## 3. spec과 다른 점 / 판단한 것
- **관찰 결과는 학생이 고른다**: 실험 뒤 '넣기 전 → 넣은 뒤' 색 견본을 보고 보기(A: 붉은색으로 변함/푸른색으로 변함/변화 없음, B: 붉은색/푸른색/노란색) 중 골라 기록한다. 그래야 spec §3.3의 "지도서 표와 다르면 다시 실험해 볼까요?"가 의미가 있다. 색 구별이 어려운 학생을 위해 "색 이름 보기" 버튼을 두었다(색만으로 구분하지 않기, spec §5.4).
- **발전 질문 2 모범 답안**: spec은 "안토사이아닌은 포도, 비트, 가지 등에 들어 있다"였으나, 비트의 붉은 색소는 안토사이아닌이 아니라 베타레인 계열이라 과학적으로 틀린 문장이 된다. 그래서 "포도, 가지, 비트 같은 재료로도 천연 지시약을 만들 수 있어요 / 붉은 양배추의 색소 안토사이아닌은 포도, 가지 등에도 들어 있어요"로 나누어 썼다(지도서 127쪽의 재료 목록은 유지). **Review에서 확인 요망.**
- 힌트 1의 "지도서 앞 차시에서…"는 학생 화면이므로 "앞 시간에…"로 바꿨다.
- 용액(식초·레몬즙 등)은 홈 안에서 모두 같은 옅은 색 모형으로 표시한다(지도서에 없는 용액 자체 색을 만들지 않으려고). 붉은 양배추 용액 자체는 보라색 계열로 표시했다(교과서 사진 기준의 일반적 색, 결과 판정에는 쓰이지 않음).
- `durationSec`는 시작부터 끝까지의 시각 차이가 아니라 **화면을 보고 있던 시간**(초)이다. `detail.analysis`에 spec 항목 외에 `tries`(문항별 시도 횟수)를 더했다. 퀴즈 선택은 보기 id가 아니라 보기 문구로 저장한다.
- 기록 데이터의 지시약 id는 spec §3.2 목록(`리트머스파랑|리트머스빨강|페놀프탈레인|붉은양배추`)을 썼다(예시의 "붉은색리트머스"는 목록과 달라 쓰지 않음).
- "홈판 비우기"(3D·2D 홈판 초기화, 기록 유지)와 "처음부터 다시 하기"(모든 임시 저장 삭제)를 분리했다. 3D↔2D 전환 버튼을 두었고 선택은 기억한다.
- 과학 차시 앱 규칙대로 다크모드는 시스템 설정을 따른다(spec §6 표의 "다크모드 없음"보다 build-instructions 우선). 3D 배경·탁자 색도 다크모드에 맞춰 바뀐다.

## 4. 확인한 것
- 개발 서버 `http://localhost:3000/class1/apps/sci-6-1-1-2/index.html`에서 전체 흐름: 예상하기(미입력 시 다음 단계 막힘 안내, 힌트 3단계) → 실험하기(3D 탭 선택, 병·홈 탭 선택, 드래그 회전, 실험 A 18칸 → B 잠금 해제, B 6칸) → 기록·분석(표 자동 생성, 일부러 틀리게 기록한 칸에 "다시 실험해 볼까요?" → 해당 실험으로 이동 → 재기록 후 표시 사라짐, 퀴즈 오답·정답 피드백, 미완료 시 이동 막힘) → 정리하기(제출 후 모범 답안 비교, 발전 질문 순차 열림) → 궁금한 점 → 마치기.
- 3D 장면 색이 spec §1.3 표와 일치(페놀프탈레인: 염기성 3개만 붉은색 / 붉은 양배추: 산성 붉은색, 빨랫비누 물·석회수 푸른색, 묽은 수산화 나트륨 용액 노란색 / 리트머스: 젖은 아래쪽만 색 변화).
- 새로고침 후 단계·입력·기록·홈판 상태 복원, 앞 단계 이동, "처음부터 다시 하기" 후 완전 초기화.
- 화면: 태블릿 가로 1024×768, 세로 768×1024, 휴대폰 375×812(가로 넘침 없음, 표·홈판은 안쪽 가로 스크롤), 다크모드.
- WebGL 불가 대체: `?no3d=1`로 2D 홈판 화면에서 실험·기록 가능, 3D 전환 버튼 비활성 안내.
- 저장: 비로그인 → 저장 안 됨 안내 + 로그인 링크(`../../login/`). 로그인 상태는 가짜 세션 + `fetch` 가로채기로만 시험(실 DB 요청 0건): `POST /rest/v1/app_results`에 `app_id: "sci-6-1-1-2"`, `completed: true`, `duration_seconds`, spec §5.5 구조의 `details`가 담기는 것 확인. 가짜 세션은 시험 후 삭제.
- 앱 로드 시 콘솔 오류 없음, three.js·OrbitControls·supabase-js는 SRI 통과해 200.
- `npm run build` 통과, 앱이 `out/apps/sci-6-1-1-2/`에 복사됨. `out/`을 `/class1/`로 정적 서빙해 폴더 주소(`/class1/apps/sci-6-1-1-2/`)와 "← 차시로" 링크(`/class1/science/?term=6-1&unit=1&lesson=3`) 확인.

## 5. 못 한 것 / 알려진 제한
- 실제 로그인 계정으로 `app_results`에 쓰는 것은 하지 않았다(지침: 실 DB 쓰기 금지). RLS·테이블은 기존 것을 그대로 쓴다.
- 실제 터치 기기에서의 한 손가락 회전·두 손가락 확대는 에뮬레이션(마우스 드래그)으로만 확인했다(OrbitControls 터치 설정 + `touch-action: none`).
- 실제 WebGL이 꺼진 브라우저 대신 `?no3d=1`로 대체 화면을 확인했다(WebGL 확인·three 불러오기 실패·컨텍스트 손실 시 자동 2D 전환은 코드로 처리).
- `next dev`는 폴더 주소(`/class1/apps/sci-6-1-1-2/`)에 index.html을 자동으로 붙여 주지 않아 404가 난다. 개발 중에는 `.../index.html`로 연다(GitHub Pages·정적 서빙에서는 폴더 주소 정상).
- 휴대폰 화면에서는 3D 글자 라벨이 작다(두 손가락 확대 또는 오른쪽 버튼·2D 화면으로 보완).
- importmap `integrity`는 최신 브라우저에서만 검사된다. 오래된 브라우저는 modulepreload의 SRI에 의존한다.
- `spec.md`·지침 파일도 `public/` 아래라 배포 사이트에서 읽을 수 있다(CLAUDE.md 규칙상 앱 폴더에 두게 되어 있음).
