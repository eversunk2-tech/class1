# Build 서브에이전트 B 지침: 검색 ~ 마무리

## 목표
`docs/blog/spec.md` §9의 **단계 6~10**과 §12에서 추가된 기능을 구현한다:
* 6: `/search/` (검색어 + 태그 필터, "더 보기")
* 7: `/admin/` 글 목록 (발행/초안 전체, 발행 토글, 삭제)
* 8: `/admin/write/` 작성·수정 에디터 (마크다운 + 실시간 미리보기, slug 처리)
* 9: 웹앱 카드 — `src/data/apps.ts`, `AppCard`, `AppGrid`, 메인에 삽입. 카드 클릭 → 모달 iframe 미리보기 + "새 탭으로 열기". 앱이 아직 없으므로 빈 상태 UI가 기본
* 프로필 수정: 헤더 유저 메뉴 → 다이얼로그 (`display_name`, `avatar_url`)
* `scripts/import-users.mjs`: 사용자가 로컬에서 1회 실행하는 계정 일괄 생성 스크립트 (spec §5.1)
* 10: 마무리 — 404, 빈/오류 상태 점검, 반응형·다크모드 점검, 정적 export 검증
* Build A가 남겨둔 연결: 태그 칩 → `/search/?tag=` 링크, 글 상세의 관리자 "수정" 버튼 → `/admin/write/?slug=`, 헤더의 관리자 메뉴

## 반드시 먼저 읽을 것
* `CLAUDE.md`, `AGENTS.md`
* `docs/blog/spec.md` 전체 (**§12가 본문보다 우선**)
* `docs/blog/build-a-report.md` — A가 만든 훅/컴포넌트/헬퍼를 재사용한다. 중복 구현하지 않는다.
* Next.js 16 API는 `node_modules/next/dist/docs/`에서 확인한다.

## import-users.mjs 요구사항
* 입력: 구글시트에서 내보낸 CSV 경로 (인자). 열 이름은 `id,password` 기본, 선택 열 `name`. 헤더 이름은 옵션으로 바꿀 수 있게.
* 아이디에 `@` 없으면 `{id}@class1.local`로 변환. `email_confirm: true`로 생성, `user_metadata.full_name`에 name.
* `.env.local`에서 `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`를 읽는다. 키는 절대 출력하지 않는다.
* 이미 존재하는 계정은 건너뛰고 결과를 요약(생성/건너뜀/실패). 비밀번호는 로그에 출력하지 않는다.
* `--dry-run` 지원. 추가 npm 패키지 없이 Node 내장 기능 + `@supabase/supabase-js`만 사용 (CSV는 따옴표 처리 포함한 간단한 파서).
* 파일 상단 주석에 사용법(한국어)을 적는다. CSV 파일은 `.gitignore`에 추가할 패턴(예: `scripts/*.csv`)을 보고서에 제안만 한다.

## 수정 범위
* 수정 가능: `src/**`, `scripts/import-users.mjs`, `package.json`/`package-lock.json`(필요 시).
* 수정 금지: `next.config.ts`, `CLAUDE.md`, `AGENTS.md`, `supabase/**`, `.github/**`, `.env*`, `.gitignore`, `public/apps/**`, `docs/**`(보고 파일 제외).
* 스키마 변경이 필요하면 구현하지 말고 보고서에 제안한다.
* git commit/push 하지 않는다.

## 환경 제약
* `.env.local`은 예시값이라 실 Supabase 연결이 안 된다. A처럼 필요하면 가짜 응답으로 화면을 확인한다.
* `npm run build`, `npm run lint` **반드시 통과**. `out/`에 `search`, `admin`, `admin/write` 라우트 생성 확인.

## 완료 보고
`docs/blog/build-b-report.md`: 만든/수정한 파일, spec과 달라진 점과 이유, 알려진 한계, Review 담당자가 중점 확인할 것, 사용자가 해야 할 일(스크립트 실행법 등).
