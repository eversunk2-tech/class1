# Fix-1 보고: review.md 1차 수정

작성: Build(수정) 서브에이전트 (2026-09-21). commit/push 하지 않음. 실 DB에 쓰기 없음(태그 필터 문법 확인용 GET 요청만 보냄).

## 검증
- `npm run lint`: 통과 (경고 0)
- `npm run build`: 통과, 모든 라우트 생성. 빌드 결과 JS 청크에 SRI 해시가 들어 있음을 확인
- 실 PostgREST에 읽기 요청으로 `tags=cs.{"a\"b"}`, `{"a,b"}`, `{"NULL"}`, `{"수업"}` → 모두 200(문법 오류 없음)
- 브라우저 확인은 하지 않음(아래 "사용자가 확인할 것" 참고)

## 항목별 결과

| # | 결과 | 위치 |
|---|---|---|
| 1 | 손대지 않음(지시대로) | - |
| 2 | 손대지 않음(보류) | - |
| 3 | 수정. `FORBID_TAGS: style, form, input, button, textarea, select, option` + `FORBID_ATTR: ['style']`. 에디터 미리보기도 같은 `MarkdownViewer` → `renderMarkdown`을 쓰므로 자동으로 같은 설정이 적용됨 | `src/lib/markdown.ts:26-30, 80` |
| 4 | 수정. `marked@15.0.12`, `dompurify@3.4.15`, `@highlightjs/cdn-assets@11.12.0`으로 고정, `integrity`(sha384) + `crossOrigin="anonymous"`를 `next/script`에 지정 | `src/lib/markdown.ts:4-20`, `src/components/markdown-viewer.tsx:44-67` |
| 5 | 수정. 아래 설명 | `src/components/admin-guard.tsx`, `src/app/admin/write/post-editor.tsx:160-205, 231-271, 343` |
| 6 | 수정. 새 마이그레이션에서 `handle_new_user`를 `left(coalesce(...), 50)`로 재정의. 스크립트는 이름을 코드 포인트 기준 50자로 자르고 해당 행 번호를 출력 | `supabase/migrations/20260921010000_fixes.sql:9-24`, `scripts/import-users.mjs:28-30, 177-192, 203-205` |
| 7 | 수정. `.delete().eq(...).select('id')` 후 `error || !data?.length`면 실패 토스트 | `src/app/post/post-detail.tsx:151-154`, `src/components/comment-section.tsx:103-105` |
| 8 | 수정. `useRef` 진행 플래그, insert 23505는 성공 취급(롤백 안 함), delete 0건도 성공, 끝나면 count 재조회 | `src/components/like-button.tsx:20-75` |
| 9 | 수정. 태그를 `{"..."}` 배열 리터럴로 만들어 `.filter('tags','cs',…)`로 전송(`"`·`\`는 백슬래시 이스케이프). `parseTags`에서 `"\{}` 제거(쉼표는 원래 구분자) | `src/app/search/search-view.tsx:40-51`, `src/lib/slug.ts:30-37` |
| 10 | 수정. 로그인한 비관리자에게 "관리자만 접근할 수 있습니다" + "메인으로" 버튼. 비로그인일 때만 `/login/`으로 이동 | `src/components/admin-guard.tsx:95-107` |
| 11 | 수정. `busyIds: Set<string>`, 진행 중인 행은 다시 토글하지 않음 | `src/app/admin/admin-post-list.tsx:43-44, 76-86, 160` |
| 12 | 수정. 새 마이그레이션에서 `revoke update on comments` 후 `grant update (body)` | `supabase/migrations/20260921010000_fixes.sql:26-33` |
| 13 | 수정하지 않음(지시대로) | - |
| 14 | 수정하지 않음(지시대로) | - |
| 15 | 수정. 메타 줄 컨테이너의 `relative z-10` 제거, `TagList`에 `className` prop 추가해 태그 목록에만 적용 | `src/components/post-card.tsx:38, 48`, `src/components/tag-chip.tsx:25-37` |
| 16 | 수정. `loginIdToEmail` 결과에 `.toLowerCase()` | `src/lib/auth.ts:10` |

### #5 상세 (AdminGuard + 에디터 임시 저장)
- effect 의존성을 `user` 객체 대신 `user?.id`로 바꿈. 확인을 통과한 사용자 id(`allowedUserId`)를 기억해 토큰 갱신으로 세션 객체가 바뀌어도 RPC를 다시 부르지 않음
- 처음 확인에서 RPC 오류: 리다이렉트 대신 "관리자 권한을 확인하지 못했습니다" + 다시 시도 버튼
- 이미 통과한 상태에서 사용자 id가 바뀌어 다시 확인하다 RPC 오류: 화면 유지 + 토스트(쓰기 권한은 RLS가 판단)
- 이미 통과한 상태에서 세션이 사라짐(SIGNED_OUT/갱신 실패): **리다이렉트하지 않고** 화면을 그대로 두고 상단에 "로그인이 만료되었습니다…" 안내 + "새 탭에서 로그인" 버튼 표시. 새 탭에서 로그인하면 supabase-js가 탭 간에 세션을 동기화하므로 원래 탭에서 이어서 저장 가능
- 에디터: 세션이 없고 저장하지 않은 변경이 있으면 `sessionStorage`(`class1:post-draft:{글id|new}`)에 폼 전체를 저장. 같은 탭에서 다시 에디터(같은 글)를 열면 "임시 저장된 내용이 있습니다… 복원/버리기" 배너 표시. 저장 성공 시 임시본 삭제

## 제안과 다르게 한 것
1. **#5 재로그인 동선**: 로그인 화면(`login-form.tsx`)은 항상 `/`로 돌아가도록 되어 있고 #2 관련 파일이라 건드리지 않았다. 대신 안내 버튼을 새 탭으로 열어 편집 중인 탭을 유지하게 했다. 같은 탭에서 로그인하러 갔다 와도 sessionStorage 임시본으로 복원할 수 있다
2. **#3 부작용**: `input`을 금지해서 GFM 체크리스트(`- [ ] 할 일`)의 체크박스가 사라지고 텍스트만 남는다. 지시된 목록을 그대로 따랐다. 체크박스가 필요하면 `input`만 허용하고 `uponSanitizeElement` 훅으로 `type="checkbox"`만 남기는 방식을 검토할 수 있다
3. **#4 SRI 해시**: jsdelivr에서 파일을 받아 `openssl dgst -sha384`로 계산했다. 대조는 jsdelivr 데이터 API의 sha256 해시(3개 모두 일치)와, highlight.js는 cdnjs 11.12.0 파일의 sha512 SRI(일치)로 했다. 파일 머리말의 버전 문자열도 확인했다. `marked@15`의 마지막 버전(15.0.12)을 그대로 유지했다(메이저 업그레이드 안 함)
4. **#9**: 제안의 두 가지(큰따옴표 감싸기 + `parseTags` 정리)를 모두 적용했다. `parseTags`만으로는 이미 저장된 태그나 URL로 직접 넣은 `?tag=` 값을 막을 수 없기 때문이다

## 사용자가 할 일
1. **SQL 실행**: Supabase 대시보드 > SQL Editor에서 `supabase/migrations/20260921010000_fixes.sql` 내용을 붙여 넣고 실행(여러 번 실행해도 안전)
   - 확인: `select pg_get_functiondef('public.handle_new_user'::regproc);`에 `left(` 가 보이는지
   - 확인: 일반 사용자 토큰으로 `PATCH /rest/v1/comments?id=eq.<내 댓글>` body `{"post_id":"…"}` → 권한 오류(42501), `{"body":"…"}` → 성공
2. 브라우저에서 확인
   - 글 상세/에디터 미리보기에서 본문이 정상 렌더링되는지(개발자 도구 콘솔에 "integrity" 오류가 없는지), 코드 하이라이트 적용
   - `<style>`/`<form>`/`style="…"`가 든 본문이 무시되는지
   - 일반 사용자로 `/class1/admin/` → "관리자만 접근할 수 있습니다"
   - 에디터를 연 채 다른 탭에서 로그아웃 → 에디터 화면 유지 + 만료 안내, 새로고침 후 복원 배너
   - 좋아요 빠른 연타/두 탭 동시 누르기 → 개수가 DB와 일치
   - 카드의 날짜·조회수 글자 클릭 → 글로 이동, 태그 클릭 → 검색
   - 대문자 아이디로 로그인
3. CDN 라이브러리 버전을 올릴 때는 `src/lib/markdown.ts` 주석의 명령으로 해시를 다시 계산해야 한다(안 바꾸면 스크립트가 차단되어 원문 표시로 폴백됨)
