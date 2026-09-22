# Build 보고: 과학 앱 로그인 필수 · 진행 상황 DB 저장 · 로그아웃 시 로컬 삭제 (2026-09-22)

지침: `docs/science/progress-build-instructions.md`. 커밋·푸시 안 함. 실 DB에 쓰지 않음(모든 Supabase 요청은 가짜 응답으로 검증).

## 변경 파일
- **신규** `supabase/migrations/20260922010000_app_progress.sql` — `app_progress(user_id, app_id, state jsonb, updated_at)`, PK(user_id, app_id), app_id 형식 `^sci-[0-9a-z-]+$`, state는 객체·256KB 이하, `set_updated_at` 트리거(서버 시각), RLS(본인 select/insert/update/delete, 관리자 select), anon 권한 없음, 재실행 안전, 상단에 실행 방법·확인 쿼리.
- `scripts/templates/class1-record.js` — `peekSession()`, `requireUser()`, `loadProgress()`, `saveProgress(state, {keepalive})`(upsert), `clearProgress()`, `onAuthChange(fn)` 추가(오류는 결과 객체, reason: `not_logged_in`/`offline`/`no_table`/`too_large`/`error`). `loginUrl()`이 `../../login/?next=<돌아올 경로>`를 돌려준다(블로그 화면 iframe 안이면 그 화면으로).
- `scripts/templates/science-sim/persist.js` = `science-guide/persist.js`(머리 주석 한 줄만 다름) — `SciSim.Sync` 동기화 엔진, 가림막(로그인 안내·불러오는 중·오류), 저장 상태 표시.
- `scripts/templates/science-sim/lesson.js`, `science-guide/lesson.js` — `Lesson.create`가 `SciSim.Sync.start()` 호출, "처음부터 다시 하기"가 `Sync.reset()`(로컬 + DB 삭제), 로그인 안내 문구 수정.
- 두 틀의 `README.md`에 사용법 절 추가.
- 위 틀과 `class1-record.js`를 **12개 앱 전부**에 복사(`diff -r` 일치). **app.js·config·index.html은 바꾸지 않았다.**
- 블로그: `src/lib/local-data.ts`(신규), `src/lib/login-redirect.ts`(신규), `src/lib/auth.ts`(signOut 앞뒤로 로컬 삭제), `src/hooks/use-session.tsx`(SIGNED_OUT·세션 없음일 때 `sci6…` 삭제), `src/app/login/login-form.tsx`(`?next=` 지원, OAuth는 sessionStorage에 10분 기억).

## 동기화 설계
- **키 구조**: 앱 로컬 키는 `<storageKey>:<키>`(예 `sci611sim2:v1:predict`). 첫 `createStore` 접두사가 뿌리이고, `뿌리:` 로 시작하는 하위 store(`sci611guide6:v1:fill`)도 함께 저장된다. 표시 키 `<뿌리>:__sync` = `{ owner, syncedAt(마지막으로 맞춘 DB updated_at), dirty, localAt, pendingClear }`.
- **DB 스냅샷**: `state = { v:1, prefix: 뿌리, keys: {키: 값}, savedAt }`. prefix가 다르면(버전 변경) 쓰지 않는다.
- **시작(동기, app.js보다 먼저)**: 세션 없음 → `sci6…` 로컬 전부 삭제 + 로그인 안내(활동 화면은 `inert`), 이후 쓰기는 메모리에만. 주인이 없거나 다르면 → 이 앱 로컬 삭제, 주인 = 현재 사용자.
- **충돌 규칙**(서버 확인 뒤): DB `updated_at == syncedAt` → 로컬 사용(dirty면 올림). DB가 바뀜 → 로컬이 dirty가 아니면 DB로 복원 후 새로고침, 둘 다 바뀌었으면 `DB updated_at` vs `localAt` 중 최근 것. DB 행 없음 + 예전에 맞춤 + dirty 아님 → 다른 기기에서 처음부터 다시 한 것으로 보고 로컬 비움. 새로고침 연쇄는 5초 안 3회 초과 시 멈춤.
- **저장**: 변경마다 1초 디바운스(최대 8초, 학습 시간 `meta`만 바뀌면 20초), `pagehide`/`hidden`에서 `fetch keepalive`로 즉시 전송, 실패 시 3초→60초 백오프 재시도, 상태 표시("☁️ 저장 중… / ✅ 저장됨 / ⚠️ 저장 실패 · 다시 시도 중 / 저장 안 됨"). 탭으로 돌아오면(30초 간격) 다른 기기 변경 확인.
- **오류**: 테이블 없음 → 로컬 사본으로 계속, "저장 안 됨(서버 준비 중)", 테이블이 생긴 뒤 열면 올리지 못한 로컬을 올림. 네트워크 오류 → 믿을 수 있는 로컬(같은 주인)이면 계속하며 재시도, 방금 지운 상태면 "불러오지 못함 · 다시 시도" 가림막(빈 기록으로 DB를 덮지 않음). 토큰 갱신이 네트워크 문제로 실패하면 로그아웃으로 보지 않는다(`offline`).
- **로그아웃**: 앱 탭은 supabase `SIGNED_OUT`과 `storage` 이벤트(세션 키 삭제)를 보고 로컬 삭제 후 로그인 안내. 다른 사용자로 바뀌면 새로고침. 블로그는 signOut 앞뒤, `SIGNED_OUT`, 시작 시 확실한 비로그인에서 `sci6…` 삭제. 에디터 임시 글(`class1:post-draft:*`)은 **직접 로그아웃할 때만** 지운다(세션 만료 복구 기능 유지). 테마·사이드바 키는 유지.
- **next**: `/`로 시작하는 같은 사이트 경로만(`//`, `/\`, 스킴, 제어문자, `/login` 순환 거부, basePath가 붙어 오면 한 번 뗌). `/apps/…`는 전체 페이지 이동, 그 밖은 라우터 이동.

## 사용자가 할 일
1. Supabase SQL Editor에서 `supabase/migrations/20260922010000_app_progress.sql` 전체 실행 → 파일 상단 확인 쿼리 실행.
2. 배포 후 학생 계정으로 한 앱에서 입력 → `select * from app_progress` 로 행 확인.
3. 알림: 배포 직후 처음 열 때는 기록 주인 표시가 없어 **기존 로컬 입력이 지워진다**(지침의 주인 규칙대로).

## 확인한 것 (자체 headless Chrome + CDP 요청 가로채기 가짜 Supabase, 84/84 통과)
- `npm run lint`, `npm run build` 통과. 앱·틀 JS 전부 `node --check` 통과. 틀 사본 12개 `diff -r` 일치.
- 대표 앱 sci-6-1-1-2(sim), sci-6-1-2-3(sim), sci-6-1-1-6(guide, 하위 store 포함)에서 전 흐름: ① 비로그인 → 로그인 안내·`next` 링크·`sci6` 키 삭제·테마 유지 ② A 입력 → upsert 1회, payload(user_id·app_id·입력 글) 확인, "저장됨" ④ A 로컬 → B 세션 → A 기록 삭제·B DB 기록 복원 ⑤ 다시 A → DB로 이어서 하기, 다른 기기에서 고친 새 DB 기록 복원 ⑥ 처음부터 다시 → DELETE 호출·DB 행 삭제·빈 화면 ⑦ 테이블 없음 → "저장 안 됨"·로컬 유지·테이블 생긴 뒤 자동 업로드, 오프라인에서 로컬 사용 ③ 다른 탭의 블로그 로그아웃 → `sci6` 삭제·테마 유지·열린 앱 탭이 로그인 안내로 전환·키를 다시 만들지 않음 ③' 블로그 세션 만료(갱신 실패) → `sci6` 삭제 ⑧ next: 앱 경로·쿼리 있는 블로그 경로·basePath 붙은 경로는 이동, `https://`, `//`, `/\`, `javascript:`는 `/`로. 콘솔 오류 0.

## 못 한 것 / 남은 위험
- 실제 Supabase(RLS·upsert 권한)와 실제 OAuth 왕복은 확인하지 못함(마이그레이션 실행 후 확인 필요). 비밀번호 폼으로 로그인한 뒤 next로 돌아가는 경로는 "이미 로그인 상태에서 /login/?next=" 경로로만 확인(같은 코드 경로).
- 두 기기에서 **동시에** 쓰면 마지막 저장이 이긴다(탭 복귀·다시 열기 때만 맞춤).
- keepalive 전송은 본문 60KB 이하일 때만, 그보다 크면 일반 요청(페이지를 닫으면 끊길 수 있으나 dirty 표시가 남아 다음에 열 때 올린다).
- 기존 로컬 입력은 배포 후 첫 실행 때 지워진다(위 3번).
- 로그인 토큰은 여전히 같은 출처 localStorage에 있다(기존 보안 경고와 같음).
