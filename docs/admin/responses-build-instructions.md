# Build 서브에이전트 지침: 관리자 "학생 응답" 모아 보기 · 개별 피드백 · 일괄 칭찬

## 목표
승인된 `docs/admin/responses-spec.md`(**§12 확정 결정 우선**)의 §8 구현 단계를 모두 구현한다.

## 먼저 읽을 것
`CLAUDE.md`(특히 과학 차시 앱 규칙의 `detail.qa`·응답 매핑 항목), `AGENTS.md`(Next.js 16 → `node_modules/next/dist/docs/`), `docs/admin/responses-spec.md` 전체, 관련 기존 코드(`src/app/admin/**`, `src/lib/learning.ts`, `src/lib/admin.ts`, `src/components/feedback/**`, `supabase/migrations/*.sql`), 앱 12개의 `data/lesson-config.js`·`app.js`(buildDetail), 공통 틀.

## 핵심 요구
* 응답 매핑 12개(`src/data/app-responses/{appId}.ts`)는 **실제 저장 구조와 질문 문구를 코드에서 그대로** 옮긴다(질문 문구는 각 앱 lesson-config에서). 기존 데이터 형태가 앱 버전별로 다를 수 있으면(예: 2단원 탐구 3·4·5는 v1~v4로 구조가 바뀜) 모두 처리하거나 `detail.qa` → 원본 JSON 펼치기로 안전하게 대체.
* 표시 우선순위: `detail.qa` → 앱별 매핑 → 원본 JSON(접기). 학생 입력은 **텍스트로만** 렌더링(innerHTML·dangerouslySetInnerHTML 금지).
* 진행 중 학생: 진행률(단계)·마지막 저장 시각만(§12).
* 개별 피드백: 기존 feedback_threads(app_result 연결) 재사용, 응답 카드에서 바로 작성.
* 일괄 칭찬: 완료 학생 전체/선택, 미리 만든 문구 클릭(`praise_presets`, 대시보드에서 추가·수정·삭제) + 직접 입력, `{이름}` 전송 직전 치환, 이미 보낸 학생 표시·중복 방지, 전송 전 확인 대화상자(대상 수·미리보기), 진행 표시와 부분 실패 보고, 1회 최대 인원 제한.
* 새 SQL: `supabase/migrations/20260922020000_praise_presets.sql`(spec §5, 재실행 안전, 관리자만 RLS, 기본 6개 시드는 중복 삽입되지 않게). **실행은 사용자가 한다** — 테이블이 없을 때 화면은 "SQL 실행 필요" 안내와 코드 내 기본 문구로 계속 동작.
* 2단원 탐구 3·4·5(`sci-6-1-2-3/4/5`)에 `detail.qa` 반영(§12 Q2): 공통 틀 정본(`scripts/templates/science-sim/`)에 spec의 `qa()` 접근자를 **하위 호환**으로 추가하고 12개 앱 전부에 다시 복사(틀 사본 일치 유지). 앱 코드는 탐구 3·4·5의 `buildDetail`만 최소 수정. 저장 키 버전은 올리지 않는다(진행 기록 구조는 그대로). science-guide 틀에도 같은 접근자를 넣을지 spec 따라 판단(guide 앱 3개는 소급하지 않음).
* 관리자 전용: `AdminGuard`와 RLS(관리자는 app_results·app_progress·feedback 조회 가능) 확인. 모바일/태블릿 레이아웃.

## 수정 범위
`src/**`, `supabase/migrations/20260922020000_praise_presets.sql`(신규), `scripts/templates/science-sim/**`(및 필요 시 science-guide), `public/apps/sci-*/science-sim|science-guide/`(틀 재복사), `public/apps/sci-6-1-2-{3,4,5}/app.js`(buildDetail만). 그 외(기존 마이그레이션, `CLAUDE.md`, 다른 앱 파일, 문서) 수정 금지. git commit/push·**실 DB 쓰기 금지**.

## 검증
* `npm run lint`, `npm run build`, `tsc`, 모든 앱 JS `node --check`, 틀 사본 일치.
* 가짜 Supabase(fetch 가로채기 또는 스크래치 mock)로: 12개 앱 각각의 대표 detail 샘플(구·신 버전 포함, 앱 코드의 buildDetail로 실제 생성하거나 코드에서 정확히 재구성)을 넣어 학생 응답 화면이 질문과 함께 올바르게 표시되는지, 개별 피드백 작성, 일괄 칭찬(전체/선택/이미 보냄/부분 실패/테이블 없음), 문구 편집, XSS 입력 표시, 태블릿·375px·다크모드.
* 탐구 3·4·5 앱 전체 흐름 회귀(가짜 로그인), `detail.qa` 내용 확인.
* 브라우저는 자기 탭 또는 자기 전용 headless만, 다른 탭·프로세스 건드리지 않기, `localStorage.clear()` 금지. 임시 파일은 스크래치에만.

## 완료 보고
`docs/admin/responses-build-report.md`: 변경 파일, 앱별 매핑 요약, 확인한 것/못 한 것, 사용자가 할 일(SQL 실행).
