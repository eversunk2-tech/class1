# Build 서브에이전트 지침: 과학 앱 로그인 필수 · 진행 상황 DB 저장 · 로그아웃 시 로컬 삭제

## 배경 (사용자 요청, 2026-09-22 승인)
학생이 앱에 입력한 뒤 로그아웃해도 입력 내용이 태블릿에 그대로 남는다(localStorage `sci6…` 키). 요구:
1. **로그아웃하면 사용자가 입력한 내용이 모두 사라진다.**
2. **사용자의 활동은 DB에 저장된다.** 다시 로그인하면 **이어서 하기**(다른 기기 포함).
3. **로그인 필수**: 로그인하지 않으면 앱을 쓸 수 없고 로그인 안내를 보여준다.
`CLAUDE.md` 과학 차시 앱 규칙의 "로그인 필수 / 진행 상황 DB 저장 / 로그아웃 시 삭제" 항목이 기준이다.

## 현재 구조 (먼저 읽기)
* `CLAUDE.md`, `AGENTS.md`(Next.js 16 → `node_modules/next/dist/docs/`)
* 앱 공통 틀: `scripts/templates/science-sim/`(persist.js, lesson.js 등)과 `scripts/templates/science-guide/`(persist.js는 sim과 동일 파일 유지, lesson.js는 조사용 변형). 각 앱은 틀 사본을 `public/apps/sci-*/science-sim|science-guide/`에 두고, 저장 키 접두사는 config의 `storageKey`(모두 `sci6…`).
* `scripts/templates/class1-record.js` — 앱의 Supabase 클라이언트·세션(블로그와 같은 origin의 localStorage 세션 공유)·`app_results` 저장. 각 앱에 사본.
* 블로그: `src/lib/auth.ts`(`signOut`), `src/components/user-menu.tsx`, `src/hooks/use-session.tsx`(onAuthStateChange), `src/app/login/`(로그인 후 돌아갈 곳 처리 여부 확인), `src/app/admin/write/post-editor.tsx`(sessionStorage 초안).
* DB: `supabase/migrations/*.sql`(기존 파일 수정 금지), `app_results` 정책 참고.

## 구현
### 1. DB — 새 마이그레이션 `supabase/migrations/20260922010000_app_progress.sql`
* `public.app_progress (user_id uuid references auth.users on delete cascade default auth.uid(), app_id text check(형식 `^sci-[0-9a-z-]+$` 등 적절히), state jsonb not null, updated_at timestamptz default now(), primary key (user_id, app_id))`.
* 크기 제한 check(예: `octet_length(state::text) <= 262144`), `updated_at` 트리거.
* RLS: 본인 select/insert/update/delete, 관리자(`is_admin()`) select. anon 권한 없음. 재실행 안전.
* 파일 상단에 실행 방법·확인 쿼리 주석. **실행은 사용자가 한다.**

### 2. 앱 공통 코드
* `class1-record.js`에 진행 상황 API 추가: `loadProgress()`, `saveProgress(state)`(upsert), `clearProgress()`, 그리고 로그인 확인 `requireUser()` 수준의 헬퍼. 오류는 throw하지 말고 결과 객체로.
* 공통 틀(`lesson.js` 두 종 + 필요 시 `persist.js`)에 **진행 동기화** 추가:
  * 앱 시작 시: 세션 확인 → **비로그인이면 활동 화면 대신 로그인 안내 화면**(블로그 로그인 링크, 로그인 후 이 앱으로 돌아오기) + 이 앱의 로컬 키 삭제.
  * 로그인 상태: 로컬의 기록 주인 표시(예: `<prefix>:__owner`)가 현재 사용자와 다르거나 없으면 → 로컬 키 전부 삭제 → DB `app_progress`를 불러와 로컬에 복원 → 화면 렌더. 주인이 같으면 로컬과 DB 중 더 최근 것(updated_at/저장 시각 비교) 사용.
  * 이후 store에 쓸 때마다 디바운스(약 1초)로 전체 스냅샷을 `saveProgress`. `pagehide`/`visibilitychange(hidden)`에서 즉시 flush 시도. 저장 실패 시 작은 상태 표시(예: "저장 중… / 저장됨 / 저장 실패, 다시 시도 중")와 재시도.
  * "처음부터 다시 하기" → 로컬 삭제 + `clearProgress()`.
  * 앱 실행 중 다른 탭에서 로그아웃하면(`storage` 이벤트로 세션 키 삭제 감지 또는 supabase `onAuthStateChange` SIGNED_OUT) 로컬 삭제 후 로그인 안내로 전환.
  * **기존 앱 12개의 config/app.js를 최대한 건드리지 않고** 틀만 바꿔 적용되게 설계. 앱이 틀을 거치지 않고 직접 localStorage를 쓰는 곳이 있는지 전수 확인(`grep`)하고 있으면 틀 API로 옮긴다.
* 새 틀을 **12개 앱 전부에 복사**(science-sim 9개, science-guide 3개)하고 `class1-record.js`도 전부 갱신.

### 3. 블로그
* 로그아웃 시(`signOut` 전후, 그리고 `onAuthStateChange`의 SIGNED_OUT·세션 만료 시에도) localStorage에서 **`sci6`으로 시작하는 키 전부** 삭제, 에디터 초안 등 사용자 입력 sessionStorage 삭제. 테마·사이드바 설정 키는 유지.
* 로그인 페이지가 "로그인 후 돌아갈 곳"을 지원하지 않으면 추가: 예 `/login/?next=/apps/sci-6-1-1-2/` — **같은 사이트 경로만 허용**(오픈 리다이렉트 방지: `/`로 시작, `//`·스킴 금지, basePath 처리 정확히). OAuth 로그인 후에도 돌아오게.

## 수정 범위
`supabase/migrations/20260922010000_app_progress.sql`(신규), `scripts/templates/**`, `public/apps/sci-*/**`(틀 사본·class1-record.js·필요한 최소 app.js 수정; `spec.md`·`*-instructions.md`·`review.md`·`*-report.md` 제외), `src/**`(로그아웃·로그인 리다이렉트 관련 최소 수정). 그 외 금지. git commit/push 금지. **실 DB 쓰기 금지**(새 테이블은 아직 없음 — 테이블 없음 오류를 우아하게 처리: 로컬 사본으로 계속 쓰되 "저장 안 됨" 표시).

## 검증
* `npm run lint`, `npm run build` 통과. 모든 앱 JS `node --check`. 틀 사본이 정본과 일치(`diff -r`).
* 브라우저(자기 탭 또는 자기 전용 headless, 다른 탭·프로세스 건드리지 않기, `localStorage.clear()` 금지): 가짜 세션/가짜 Supabase 응답(스크래치의 mock 서버나 fetch 가로채기)으로 시나리오 확인 — ① 비로그인 → 로그인 안내, ② 로그인 A 입력 → 저장 호출 payload 확인, ③ 블로그 로그아웃 → `sci6` 키 삭제·테마 유지, ④ A 로그인 상태 로컬 → B 세션으로 바꿔 열기 → A 기록 삭제·B DB 기록 복원, ⑤ 다시 A 로그인 → DB 기록으로 이어서 하기, ⑥ 처음부터 다시 하기 → clearProgress 호출, ⑦ 테이블 없음 오류 시 동작, ⑧ `next` 리다이렉트가 외부 URL을 거부. 대표 앱 최소 3개(sim 2, guide 1)에서 전체 흐름.
* 임시 파일은 스크래치에만.

## 완료 보고
`docs/science/progress-build-report.md`: 변경 파일, 동기화 설계(키 구조, 충돌 규칙), 사용자가 할 일(SQL 실행), 확인한 것/못 한 것, 남은 위험.
