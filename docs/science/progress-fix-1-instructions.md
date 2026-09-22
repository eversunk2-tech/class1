# Build(수정) 서브에이전트 지침: 진행 상황 동기화 review 1차 수정

## 목표
`docs/science/progress-review.md`의 **높음·중간·낮음 문제를 모두** 수정한다(참고는 판단). 기준 문서: `docs/science/progress-build-instructions.md`, `docs/science/progress-build-report.md`, `CLAUDE.md` 과학 차시 앱 규칙.

## 반드시 반영할 방향
* **높음(다른 학생 기록 덮어쓰기)**: `loadProgress`/`saveProgress`/`clearProgress`와 종료 시(keepalive) 저장 경로 모두, **실제 요청에 쓰는 세션의 user id가 페이지의 기록 주인과 같을 때만** 실행한다. 다르면 거부 → 로컬 삭제 → 로그인 사용자 기준으로 다시 불러오기(또는 로그인 안내). 재현 시나리오를 테스트로 다시 돌려 막혔음을 확인.
* **뒤로 가기 캐시(bfcache)**: `pageshow`(persisted)·`visibilitychange`(visible)·`focus`에서 세션을 다시 확인하고 주인이 다르거나 로그아웃이면 화면을 즉시 가리고 로컬 삭제 후 안내. 가능하면 로그인 안내 전환 전까지 활동 화면이 보이지 않게.
* **로그아웃 시 미전송분 손실**: 앱이 로컬에 `<prefix>:__meta`(appId, owner, dirty 여부 등)를 남기고, 블로그 로그아웃 처리에서 **signOut 전에** dirty인 앱의 스냅샷을 `app_progress`에 upsert(현재 세션으로, owner 일치 확인)한 뒤 로컬을 지운다. 업로드 실패 시 학생에게 "저장되지 않은 활동이 있어요 — 그래도 로그아웃할까요?" 확인. 테이블이 없으면 그 사실을 알리고 확인.
* **두 기기 충돌**: 기기 시계에 의존하지 않는다. 서버 `updated_at`(마지막으로 맞춘 값)과 로컬 dirty 여부로 판단: 서버 변경 없음 → 로컬 우선, 로컬 변경 없음 → 서버, **둘 다 변경 → 학생에게 선택하게**(이 기기의 기록 / 저장된 기록, 각 마지막 시각 표시). 조용히 버리지 않는다.
* **로그아웃 없이 태블릿을 넘겨줌**: 앱 상단에 "○○(아이디)로 로그인 중 · 내가 아니면 로그아웃" 표시와 로그아웃 버튼(블로그 로그아웃과 같은 정리 절차). 장시간 무입력 자동 로그아웃은 하지 않는다.
* 낮음 항목도 모두 처리.

## 수정 범위
`scripts/templates/**`, `public/apps/sci-*/**`(틀 사본·`class1-record.js`; 앱 전용 파일은 꼭 필요할 때만; 문서류 제외), `src/**`(로그아웃 처리 관련), 필요하면 `supabase/migrations/20260922010000_app_progress.sql`(아직 사용자가 실행하지 않았을 수 있으나, 실행했을 수도 있으므로 **재실행 안전성 유지**, 파괴적 변경 금지). 수정 후 **틀 정본을 12개 앱 전부에 다시 복사**하고 `diff -r`로 일치 확인.
git commit/push·실 DB 쓰기 금지.

## 검증
review의 재현 시나리오 전부 + 기존 8개 시나리오를 가짜 Supabase/가짜 세션으로 다시 실행(sim 앱 2개, guide 앱 1개 이상). lint·build·`node --check` 통과, 콘솔 오류 0. 브라우저는 자기 탭 또는 자기 전용 headless만, 다른 탭·프로세스 건드리지 않기, `localStorage.clear()` 금지. 임시 파일은 스크래치에만.

## 완료 보고
`docs/science/progress-fix-1-report.md`: 항목별 처리(파일:줄), 재현 테스트 결과, 남은 위험.
