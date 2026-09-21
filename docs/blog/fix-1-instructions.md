# Build(수정) 서브에이전트 지침: review.md 1차 수정

## 목표
`docs/blog/review.md`의 문제 중 아래 항목을 수정한다. 각 항목의 "수정 제안" 열을 기본으로 따르되, 더 나은 방법이 있으면 보고서에 이유와 함께 적는다.

| # | 처리 |
|---|---|
| 1 | **처리 완료(건드리지 말 것)** |
| 2 | **보류(사용자 결정 대기). 건드리지 말 것** |
| 3 | DOMPurify에 `FORBID_TAGS`(style, form, input, button, textarea, select, option) 추가, 인라인 `style` 속성 금지. 에디터 미리보기에도 동일 적용 |
| 4 | CDN 유지. 정확한 버전으로 고정하고 `integrity` + `crossOrigin="anonymous"` 지정. SRI 해시는 실제 파일을 내려받아 `openssl dgst -sha384 -binary \| openssl base64 -A`로 계산 (jsdelivr/cdnjs 제공 해시와 대조) |
| 5 | 의존성을 `user?.id`로, 이미 허용된 상태에서 RPC 오류 시 리다이렉트 대신 토스트. 세션이 사라지면 에디터 내용을 sessionStorage에 임시 저장하고 안내 표시, 재로그인 후 복원 제안 |
| 6 | 새 마이그레이션 `supabase/migrations/20260921010000_fixes.sql`에서 `handle_new_user`를 `left(..., 50)`로 재정의. 스크립트에도 50자 처리 |
| 7 | `.select('id')` 후 0건이면 실패 처리 |
| 8 | `useRef` 진행 플래그, 23505는 성공 취급, 완료 후 count 재조회 |
| 9 | 태그 요소를 큰따옴표로 감싸 전송 + `parseTags`에서 `"\{},` 제거 |
| 10 | 로그인한 비관리자에게 "관리자만 접근할 수 있습니다" 안내 |
| 11 | `Set<string>`으로 관리 |
| 12 | 같은 새 마이그레이션에서 comments update를 `body` 컬럼만 허용 |
| 13 | 수정하지 않음 (수업용으로 허용) |
| 14 | 수정하지 않음 |
| 15 | `z-10`을 태그 목록에만 |
| 16 | `loginIdToEmail`에 `.toLowerCase()` |

## 읽을 것
`CLAUDE.md`, `AGENTS.md`, `docs/blog/spec.md`(§12 우선), `docs/blog/review.md`, `docs/blog/build-a-report.md`, `docs/blog/build-b-report.md`. Next.js API는 `node_modules/next/dist/docs/`에서 확인.

## 수정 범위
* 수정 가능: `src/**`, `scripts/import-users.mjs`, 새 파일 `supabase/migrations/20260921010000_fixes.sql`, `package.json`/`package-lock.json`(필요 시).
* 수정 금지: 기존 마이그레이션 파일, `next.config.ts`, `CLAUDE.md`, `AGENTS.md`, `.github/**`, `.env*`, `.gitignore`, `docs/**`(보고 파일 제외).
* 로그인 화면의 OAuth 버튼·가입 정책 관련(#2)은 건드리지 않는다.
* git commit/push 금지.

## 환경
`.env.local`에 실제 Supabase가 연결돼 있다. **실 DB에 쓰기(글·댓글·계정 생성 등)는 하지 말 것.** 읽기 요청은 괜찮다. 새 마이그레이션은 파일만 만들고 실행하지 않는다(사용자가 SQL Editor에서 실행).
`npm run lint`, `npm run build` 반드시 통과.

## 완료 보고
`docs/blog/fix-1-report.md`: 항목별 처리 결과(파일:줄), 제안과 다르게 한 것, 사용자가 실행할 SQL 안내.
