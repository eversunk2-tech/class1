@AGENTS.md
@docs/STATUS.md

## 프로젝트 개요

* 마크다운 기반 블로그 + 미니 웹앱 포트폴리오
* 블로그 본체: Next.js 16 (App Router) + Tailwind + shadcn/ui, 정적 export
* 웹앱: HTML, CSS, JavaScript로 만든 독립 정적 앱 (`/public/apps/{앱이름}/`)
* Supabase 기반 백엔드 데이터 서버 (글, 댓글, 좋아요, 조회수, 로그인, 웹앱 데이터)
* 배포: GitHub Pages 프로젝트 사이트 (`https://eversunk2-tech.github.io/class1/`, 저장소 `eversunk2-tech/class1`, basePath `/class1`)
* 언어/디자인: 한국어 UI, 다크모드 지원. 디자인 체계는 `docs/design/redesign/spec.md`(2026-09-24 개편: 보라 주색, 본문 Pretendard·제목 Jua, Fluent 3D 아이콘, 부엉이 과학자 마스코트) — 아래 "디자인 규칙"
* 메뉴: 홈 · 학습게임활동 · 과학수업 · 자유게시판 (수학수업은 삭제됨, `/math/` 없음)
* 진행 현황·확정 결정은 `docs/STATUS.md`에 기록한다(위에서 함께 불러옴).


## 기술 결정 사항

### 정적 export 제약 (GitHub Pages)
* `next.config.ts`에 `output: 'export'`, `basePath: '/class1'`, `images: { unoptimized: true }`를 유지한다.
* 내부 링크는 `next/link`를 쓴다. `next/image` src, iframe, `/apps/...` 링크, OAuth redirectTo 등 basePath가 자동으로 붙지 않는 곳은 `process.env.NEXT_PUBLIC_BASE_PATH`를 앞에 붙인다. 절대경로를 하드코딩하지 않는다.
* 서버 기능을 쓰지 않는다: Server Actions, Route Handlers, middleware/proxy, 동적 SSR, `@supabase/ssr` 서버 쿠키 세션 금지.
* Supabase 호출은 모두 브라우저(Client Component)에서 `@supabase/supabase-js`로 한다.
* 동적 경로(예: 글 상세)는 쿼리스트링(`/post?slug=...`)이나 클라이언트 라우팅으로 처리한다. `generateStaticParams`로 DB 글을 빌드 타임에 고정하지 않는다.
* 배포는 GitHub Actions로 `next build` → `out/` 폴더를 Pages에 올린다.

### 블로그 글
* 글 원본은 Supabase `posts` 테이블에 마크다운 텍스트로 저장한다.
* 브라우저에서 불러와 marked.js(CDN)로 렌더링한다. 렌더링 결과는 DOMPurify(CDN)로 정리한 후 삽입한다.
* 글 작성/수정은 사이트 내 관리자 화면에서 한다.

### Supabase
* 환경 변수: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (`.env.local`, 커밋 금지).
* anon key만 클라이언트에 노출한다. service_role key는 절대 코드/저장소에 넣지 않는다.
* 모든 테이블에 RLS를 켜고 정책을 작성한다. 보안은 클라이언트 가드가 아니라 RLS로 보장한다.
* 블로그 공용 테이블: `profiles`(role: admin/user), `posts`, `comments`, `likes`, `views`.
* 학습 테이블: `member_directory`, `app_results`, `app_progress`, `post_reads`, `assignments`, `assignment_submissions`, `feedback_threads`, `feedback_messages`, `feedback_read_marks`, `praise_presets` (설계: `docs/admin/spec.md`, `docs/admin/responses-spec.md`).
* 관리 테이블: `site_settings`(로그인 잠금 스위치 한 줄, 읽기는 항상 공개), `password_reset_log`, `member_withdrawal_log`, `member_create_log`(감사 로그, 관리자만 조회, 쓰기는 service_role 함수로만) (설계: `docs/admin/admin-tools/spec.md`, `docs/admin/create-members/`).
* 커뮤니티 테이블: `community_posts`(kind: board|game), `community_comments`, `community_likes`, `community_reports`, Storage 버킷 `game-uploads`(비공개) (설계: `docs/community/spec.md`).
* service_role이 필요한 작업은 Supabase Edge Function(`supabase/functions/`)으로만 하고, 호출자의 관리자 여부를 함수 안에서 검증한다. 지금 함수: `admin-reset-password`, `admin-delete-member`, `admin-create-member`, `check-answer`(Gemini, 비밀 `GEMINI_API_KEY`). 함수 코드를 고치면 사용자가 `npx supabase functions deploy <이름>`으로 다시 배포해야 한다고 알린다(`--no-verify-jwt` 금지).
* 외부 AI API 키 등 비밀값은 Supabase Secrets에만 두고 코드·저장소·로그·브라우저에 절대 넣지 않는다. 외부로 보내는 학생 데이터는 답 글·질문·모범 답안뿐(이름·학번·user id·이메일 금지).
* 웹앱 전용 테이블은 `app_{앱이름}_` 접두사를 붙인다.
* 스키마 변경은 `supabase/migrations/`에 SQL 파일로 남긴다.

### SQL 적용 절차
* SQL은 **사용자가 Supabase SQL Editor에서 직접 실행**한다. Claude와 서브에이전트는 실 DB에 쓰지 않는다(anon key로 읽기·거부되어야 할 요청 확인만).
* 모든 SQL은 재실행 안전하게(`if not exists`, `create or replace`, `drop ... if exists`) 쓰고, 파일 상단에 실행 방법과 확인 쿼리를 적는다.
* 사용자가 이미 실행한 마이그레이션은 고치지 말고 **새 파일**로 변경한다(아직 실행 전이면 같은 파일 수정 가능).
* 사용자에게 실행을 부탁하기 전에 Claude가 SQL을 직접 검토한다. 로컬 Postgres가 없으므로 RLS 정책 안에서 같은 테이블을 다시 조회하지 않는다(42P17 정책 재귀 오류 — 필요하면 `security definer` 함수로 분리).
* 앱·사이트 코드가 새 SQL에 의존하면 SQL 실행 → 확인 → push 순서로 배포한다(그 반대면 사이트가 깨질 수 있음).

### 로그인 (Auth)
* 관리자(나): 글 작성·수정·삭제 권한. `profiles.role = 'admin'`으로 판별한다.
* 방문자: 가입/로그인 후 댓글 작성, 웹앱 데이터 저장 가능. 읽기와 조회수는 비로그인도 가능.
* **로그인 잠금 스위치**(관리자 화면, `site_settings.login_required`, 기본 꺼짐): 켜면 블로그 글·자유게시판·학습게임 글·과학 앱이 로그인 필요(RLS 게이트 `can_browse()`), 홈·메뉴·로그인·비밀번호 재설정은 항상 열려 있다. 설정을 못 읽으면 꺼짐으로 동작한다(관리자가 갇히지 않게).
* 로그인 방식: 이메일/비밀번호(사전 생성 계정, 사이트에 가입 폼 없음), GitHub OAuth, Google OAuth.
* 가입 정책: Supabase 가입 허용 유지(OAuth 방문자는 첫 로그인 시 일반 사용자로 자동 가입), Confirm email 켬.
* 계정은 관리자 대시보드 **회원 관리 > 회원 추가**(한 명 / 엑셀 일괄: 아이디·비밀번호·역할)로 만든다. 역할은 학생=`user`, 교사=`admin`(새 역할 없음), 이메일은 `아이디@class1.local`, 첫 로그인 때 비밀번호 변경 강제. 로컬 스크립트(`scripts/import-users.mjs`)는 예비용.
* **강제 탈퇴는 완전 탈퇴**: `auth.users`를 삭제(복구 없음)하되 학습 기록은 남기고 "탈퇴한 학생"으로 표시한다. 관리자 대상은 불가. 기록을 지울 수 있는 외래키가 생기면 안 된다(`withdrawal_blocking_fks()`가 막음).
* redirect URL은 `https://eversunk2-tech.github.io/class1/**`와 `http://localhost:3000/class1/**`를 등록한다.


## 작업 사이클

* 사용자가 웹앱 주제를 요청하면 다음 순서로 진행한다.
* Plan — 서브에이전트(sonnet 모델, 파일을 쓸 수 있는 general-purpose 형으로 — `Plan` 형은 파일을 못 쓴다)를 만들어 계획을 작성한다. 어떤 웹앱을 만들지, 파일 구조는 어떻게 할지, Supabase 테이블/RLS가 필요한지 정리한다. 작성한 계획은 `spec.md`로 저장하며, 사용자 승인을 받는다.
* Build — 서브에이전트를 만들어 구현한다. 웹앱은 `/public/apps/{앱이름}/` 폴더에 독립적으로 만든다. 블로그의 다른 파일을 건드리지 않는다.
* Review — 별도 서브에이전트를 만들어 검증한다. 브라우저에서 정상 동작하는지(모바일 뷰포트 포함), 코드에 문제가 없는지, RLS 정책이 적절한지 확인하고 `review.md`를 작성한다. 문제가 있으면 수정한다.
* Embed — 블로그 메인 페이지(`src/app/page.tsx`)에 웹앱 카드를 추가한다. 카드에는 제목, 설명, 미리보기 이미지 또는 iframe을 넣는다. 과학 차시 앱은 대신 `src/data/science-curriculum.ts`의 차시에 `app`을 연결한다. 깃 커밋한다.
* 블로그 기능 변경(관리자 대시보드, 게시판 등)도 같은 순서를 따른다: Plan(`docs/{주제}/spec.md`) → 승인 → Build → Review → 수정 → 커밋.

### 커밋·배포
* 검증(lint·build·필요한 브라우저 확인)을 마친 뒤 커밋한다. 커밋 메시지는 영어, 끝에 Co-Authored-By 줄.
* **push(배포)는 사용자가 확인·요청한 뒤에만** 한다. push 후 GitHub Actions 결과와 배포 사이트 응답을 확인해 보고한다.
* 앱의 저장 구조를 바꾸면 저장 키 버전(`:vN`)을 올리고, 학생 진행 기록이 처음부터 다시 시작된다는 점을 사용자에게 알린다.


## 서브에이전트 규칙

* 서브에이전트에게 작업을 넘길 때 전용 지침 파일(.md)을 만들어 전달한다.
* Build 서브에이전트와 Review 서브에이전트는 반드시 분리한다.
* 서브에이전트는 지침 파일에 명시된 범위만 수정한다.
* Plan 서브에이전트는 sonnet 모델을 쓴다. 여러 앱을 동시에 만들 때 공통 틀은 한 서브에이전트만 수정하고, 끝나면 Claude가 모든 앱 사본을 동기화·점검한다.
* 서브에이전트는 git commit/push와 실 DB 쓰기를 하지 않는다. 커밋은 Claude가 검증 후 한다.
* 브라우저는 공유되므로 서브에이전트는 **자기 탭(tabs_create) 또는 자기 전용 headless 브라우저(겹치지 않는 포트)**만 쓰고, 다른 탭·프로세스를 건드리지 않으며, `localStorage.clear()`를 쓰지 않는다(자기 앱 키만 삭제). 띄운 서버는 끝날 때 종료한다.
* 임시 파일은 스크래치 디렉터리에만 두고 끝나면 지운다.
* 테스트할 때 **실제 Supabase 주소는 첫 페이지 로드부터 막고**(요청 가로채기) 가짜 세션·가짜 응답만 쓴다. 실제 Gemini도 부르지 않는다.
* 사용량 한도로 서브에이전트가 멈추면 같은 에이전트에 SendMessage로 이어서 하게 한다(작업 트리의 부분 결과를 먼저 확인).


## 웹앱 규칙

* 모든 웹앱은 `/public/apps/{앱이름}/` 폴더 안에 자체 완결된다. (배포 URL: `/class1/apps/{앱이름}/`)
* 웹앱 내부의 파일 참조는 상대경로만 사용한다(`./style.css`). `/`로 시작하는 절대경로 금지.
* `spec.md`, `review.md`, 서브에이전트 지침 파일도 해당 앱 폴더에 둔다.
* 순수 HTML, CSS, JavaScript로 만든다. React/Next.js/빌드 도구를 쓰지 않는다.
* 외부 라이브러리 사용을 최소화한다. CDN은 허용한다.
* Supabase가 필요하면 CDN의 supabase-js를 쓰고, URL과 anon key는 앱 폴더 안 `config.js`에 둔다.
* 학습 결과를 기록하는 앱은 `scripts/templates/class1-record.js`를 앱 폴더로 복사해 사용한다(`app_results` 테이블). 점수는 클라이언트 기록이라 참여 확인용이다.
* 모바일에서도 사용할 수 있어야 한다.


## 과학 차시 앱 규칙

과학수업 차시(`src/data/science-curriculum.ts`)별 앱을 만들 때 위 웹앱 규칙에 더해 아래를 반드시 따른다.

### 앱 종류 결정
* 해당 차시의 교사용 지도서를 먼저 분석한다. 지도서 PDF 위치: `~/Library/CloudStorage/GoogleDrive-sunkyboy@pen.go.kr/내 드라이브/오션초2026/수업/교과서 usb자료/` (1학기 `과학 지도서 {단원}.pdf`, 2학기 `[과학]62N_지도서 N.{단원}.pdf`, 2학기 실험관찰 `실험관찰-6-2.pdf`). 차시별 지도서 쪽수는 단원 지도 계획 표를 따른다(인쇄 쪽 ↔ PDF 쪽 오프셋은 `docs/STATUS.md`).
* **실험이 있는 차시** → 실험 시뮬레이션 앱. 지도서에서 그 차시에 한 실험을 바탕으로, 학생이 태블릿으로 비슷한 실험을 시뮬레이션하게 한다.
* **실험이 없는 조사하기 차시** → 시뮬레이션을 만들지 않는다. 지도서를 바탕으로 조사 참고 자료, 조사 팁, 조사 활동 틀을 제시하는 조사 도우미 앱을 만든다.
* 어느 쪽으로 판단했는지와 근거(지도서 쪽수)를 앱 `spec.md`에 적는다.

### 실험 시뮬레이션 앱 단계
앱은 **<예상하기> → <실험하기> → <기록·분석하기> → <정리하기>** 단계로 진행한다. **시뮬레이션 실험과 결과 분석에 집중**하고, 묻는 질문의 양은 최소로 한다.
* **활동 시간: 앱 전체를 학생이 7분 안에 마칠 분량**으로 구성한다. `spec.md`에 단계별 예상 소요 시간표를 적고(합계 7분 이하), Review에서 실제로 진행해 확인한다. 단, 아래 측정 규칙(실험관찰의 조건은 모두 측정)을 줄여서 시간을 맞추지 않는다 — 읽기·질문·연출을 줄이고, 그래도 넘으면 예상 시간을 사용자에게 알린다.
* **예상하기: 탐구형 질문 1개만.** 답을 절대 미리 제시하지 않고, 학생이 직접 짧게 타이핑한다. 힌트 버튼을 둔다(힌트도 답을 알려주지 않는다).
* **실험하기**: 지도서의 핵심 실험을 3D 장면으로 보여주고 드래그로 방향을 바꿀 수 있게 한다(three.js CDN, 터치 드래그). 측정 조건은 **실험관찰(교과서)에 제시된 상황을 모두** 측정하게 한다(아래 측정 규칙). 가능하면 정해진 조건 사이의 연속 구간도 슬라이더 등으로 자유롭게 살펴볼 수 있게 한다. 실시간 연출은 짧게 하고, 기다림이 길면 "빨리 감기(모형)"로 줄인다. 측정값은 **기록** 버튼으로 저장한다.
* **기록·분석하기**: 기록으로 표·그래프를 자동으로 만들고, 결과 분석은 **보기 고르기 1~2개**로 간단히 한다(맞고 틀림에 따른 짧은 피드백). 분석은 학생 자신의 기록을 보고 답하게 한다.
* **정리하기: 탐구형 질문 1개만.** 학생이 결론을 직접 적은 뒤 모범 답안을 보여주고 비교하게 한다. 발전 질문은 두지 않는다.
* 마지막의 '더 탐구하고 싶은 점(또는 궁금한 점)'은 **필수 한 줄**이다(2026-09-23 사용자 결정). 판정은 느슨하게: 무의미·주제 무관만 막고 나머지는 모두 통과.
* **학생 답 되짚기·차단**(공통 틀 `answer-check.js` + `check-answer`): 통과 / 다시 생각(질문당 1회, 그대로 제출 가능) / 통과 불가(무의미·주제 무관만). **틀렸지만 주제에 맞는 답은 막지 않는다.** 로컬 규칙은 확실한 무의미만, 주제 무관은 Gemini만 판정. Gemini 실패·체험 모드면 로컬 규칙 외 차단 없음. 같은 질문 3번째 차단부터 "🙋 선생님과 확인했어요" 버튼(갇히지 않게). "✔ 잘 적었어요"는 검사 통과 뒤에만. Gemini 피드백은 6학년 눈높이, 두 문장 이내, 답 누설 금지. 외부 검사 안내 문구는 넣지 않는다(사용자 결정).
* **마치기 조건**: 정리하기 답이 통과 불가면 '학습 마치기'를 거부하고 까닭을 안내한다. 버튼 위에 "'학습 마치기'를 눌러야 선생님에게 제출돼요"를 항상 보인다.
* 실험은 언제든 다시 할 수 있고, 앞 단계로 돌아갈 수 있다. 진행 중 입력은 localStorage 임시 사본과 `app_progress` DB에 저장해 새로고침·다른 기기에서도 이어서 할 수 있게 한다.
* 조사 도우미 앱도 같은 원칙(7분 이내, 도입 질문 1개, 정리 질문 1개, 조사 기록은 꼭 필요한 칸만)을 따른다.
* 이 기준은 2026-09-22부터 적용한다. 이미 만든 앱 중 1학기 1단원 전체와 2단원 탐구 1·2·6은 **문항·내용**을 이전 기준 그대로 둔다(수업에서 이미 사용했거나 사용하지 않음). 단 공통 틀 개선(동작·겉모양·되짚기·마치기 조건)은 사용자 승인에 따라 23개 앱 **전부**에 적용한다 — 저장 키·저장 구조·문항은 그대로여서 학생 기록이 유지된다.

### 공통
* **반드시 과학적 사실에 맞게** 만든다. 시뮬레이션의 수치·현상·용어는 지도서와 교과서 표기를 따르고, 단순화한 부분은 화면에 "모형" 등으로 밝힌다. Review 단계에서 과학적 정확성을 별도 항목으로 검증한다.
* 태블릿 우선(가로·세로 모두), 큰 터치 영역, 초등 6학년 눈높이의 한국어.
* 앱 폴더 이름: `sci-{학기}-{단원}-{탐구번호}` (예: `/public/apps/sci-6-1-2-3/`). `science-curriculum.ts`의 해당 차시에 앱 경로를 연결해 차시 화면에서 바로 열 수 있게 한다(Embed 단계).
* **로그인과 체험 모드**(로그인 잠금 스위치 연동): 잠금 **켜짐** + 비로그인 → 활동 대신 로그인 안내(블로그 로그인 후 돌아오기). 잠금 **꺼짐** + 비로그인 → **체험 모드**(끝까지 가능, 이 기기에만 저장, `app_progress`·`app_results`·`check-answer` 호출 0, "로그인하면 기록이 저장돼요" 안내). 로그인하면 체험 기록은 이어받지 않고 지운다. 로그인한 학생은 아래 저장 규칙을 따른다.
* **진행 상황 DB 저장**: 학생이 입력·기록할 때마다 진행 상황을 `app_progress` 테이블(학생 × 앱)에 자동 저장하고, 다시 열면 이어서 하게 한다. localStorage는 같은 학생의 임시 사본일 뿐이며, 로그인한 학생과 기록 주인이 다르면 즉시 지우고 그 학생의 DB 기록을 불러온다.
* **로그아웃 시 삭제**: 블로그에서 로그아웃(또는 세션 만료)하면 과학 앱의 로컬 입력(`sci6…` 키)을 모두 지운다. 새 앱의 저장 키는 반드시 `sci6`으로 시작한다.
* 정리하기까지 마치면 `class1-record.js`로 완료 결과(`completed`, 소요 시간, `detail`에 예상·기록·분석 선택·결론·궁금한 점)를 `app_results`에 저장한다.
* 완료 결과 `detail`에는 공통 틀이 만드는 **질문-답 표준 목록 `detail.qa`**(`[{ stage, id, question, kind, answer }]`)를 반드시 함께 넣는다. 관리자 대시보드 "학생 응답"이 이 목록으로 질문과 답을 정리해 보여준다(`docs/admin/responses-spec.md`).
* 이미 만든 앱의 `detail` 모양을 바꾸면 `src/data/app-responses/{앱}.ts` 응답 매핑도 같이 고친다.
* 여러 차시 앱이 같은 틀을 쓰므로, 공통 코드는 정본(`scripts/templates/science-sim/` 실험용, `scripts/templates/science-guide/` 조사용, `scripts/templates/class1-record.js` 저장)을 두고 앱 폴더로 복사해 쓴다(앱은 자체 완결 유지).
* 정본을 고치면 **하위 호환**을 지키고, 모든 앱 사본에 다시 복사한 뒤 `diff -r`로 일치를 확인하고 앱을 실험 단계까지 열어 점검한다.
* 학생 화면에 "지도서"라는 말을 쓰지 않는다(교사용 자료, "지도서 N차시"도 "N차시"로). 출처는 "교과서·실험관찰"로 적는다.
* 과학 앱 글꼴(Pretendard·Jua)은 `persist.js`가 CDN `<link>`를 **비차단**으로 붙인다. CSS `@import`로 불러오지 않는다(학교 망이 느리면 첫 화면이 멈춘다).
* 과학 앱에서 새 기능을 넣을 때도 3D 장면·그래프 계열 색은 과학적 의미가 있으므로 디자인 개편 대상에서 뺀다.
* 측정값은 학생에게 반올림을 시키지 않고 처음부터 소수 첫째 자리로 제시한다(세는 값은 자연수, 교과서가 "○시간 ○분"처럼 쓰는 값은 그 표기를 따른다). 값은 학생이 타이핑하지 않고 화면에 보이며 **기록하기**로 저장한다.
* **측정 규칙(2026-09-22 개정)**: **같은 조건을 여러 번 반복 측정**하는 실험(예: 같은 거리를 여러 번 재어 평균)은 조건마다 **1번만** 측정한다. 반복이 아니라 **조건이 여러 가지**인 실험(시각별·월별·각도별·위치별 등)은 **실험관찰에 제시된 조건을 모두** 측정한다(임의로 줄이지 않음).


## 디자인 규칙 (2026-09-24 개편)

* 기준 문서: `docs/design/redesign/spec.md`(끝 "개정 1"). 참고 사이트("똑똑! 수학탐험대")는 **느낌만** 참고하고 그림·로고·문구·캐릭터는 절대 가져오지 않는다.
* 그림: 3D 아이콘은 Microsoft Fluent Emoji 3D(MIT)만 `public/illustrations/3d/`에(192px WebP, 고지 `LICENSE-fluent-emoji.txt`), 마스코트는 부엉이 과학자 `public/illustrations/mascot/`. 새 아이콘·이미지·글꼴을 **내려받거나 만들 때는 사용자 허락**(파일명·출처·크기 명시) 후 Claude가 하고, 서브에이전트는 받지 않는다. 변환은 `node_modules`의 `sharp`를 쓴다(`package.json`에 추가하지 않음).
* 이미지는 `withBasePath()`로 경로, `width`/`height`·`alt`(장식이면 `alt=""`+`aria-hidden`), 첫 화면 마스코트만 eager, 떠 있는 소품은 lazy(preload 경고 방지).
* 접근성: 글자 대비 WCAG AA(밝음·어두움), 색만으로 정보 전달 금지, 키보드 초점 표시, `prefers-reduced-motion`이면 움직임 없음, 터치 영역 44px 이상.
* 관리자 화면은 보라 채도를 낮춘 영역 한정 CSS(`src/app/admin/admin-theme.css`), 위험 동작(탈퇴·삭제·초기화) 확인 버튼은 진한 빨강에 흰 글자(`src/lib/danger-button.ts`).


## 커뮤니티(자유게시판·학습게임) 규칙

* 로그인한 사용자 누구나 글·댓글·좋아요·신고, 글은 바로 공개. 관리자(교사)는 숨기기·삭제·신고 처리. 사용자 입력은 텍스트로만 렌더링(마크다운이면 DOMPurify, 이미지 첨부 없음).
* **업로드 게임 보안(절대 원칙)**: 업로드 HTML은 사이트 출처로 절대 실행하지 않는다. 비공개 버킷에 `text/plain`으로 저장 → `download()`로 텍스트를 받아 → 고정 CSP 래퍼 안의 `sandbox="allow-scripts"` iframe(`allow-same-origin` 등 추가 금지)에서만 실행. 공개 URL·blob URL·새 탭·`dangerouslySetInnerHTML` 금지. 게임은 "게임 시작"을 눌러야 실행.
* 게임 파일: 확장자 `.html`/`.htm`이면 이름은 무엇이든 가능, UTF-8, 2MB 이하, 한 사람당 게임 글 30개.


## 규칙

* 승인 없이 구현을 시작하지 않는다.
* 막히면 사용자에게 알린다.
* 답변은 한국어로 한다. 사용자가 해야 할 일(SQL 실행, 확인 절차)은 단계별로 분명히 적는다.
* 확인하지 못한 것(실제 기기, 실 DB, 로그인 흐름 등)은 확인한 것과 구분해 솔직히 알린다.
* 사용자가 "앞으로는 ○○" 식으로 규칙을 정하면 이 파일에 반영하고, 진행 현황이 바뀌면 `docs/STATUS.md`를 갱신한다.
