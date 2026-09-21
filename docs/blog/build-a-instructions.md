# Build 서브에이전트 A 지침: 블로그 기반 ~ 글 상세

## 목표
`docs/blog/spec.md` §9의 **단계 0~5**를 구현한다: 기반 정비, 레이아웃/테마, 인증(로그인 화면), 메인+글 목록, 마크다운 렌더러(코드 하이라이트 포함), 글 상세(조회수·좋아요·댓글).

## 반드시 먼저 읽을 것
* `CLAUDE.md`, `AGENTS.md`
* `docs/blog/spec.md` 전체. **§12 확정 결정이 본문보다 우선한다** (특히 basePath는 `/class1` 고정, 환경변수화 금지).
* 이 Next.js(16.x)는 학습 데이터와 다르다. `useSearchParams`, `next/script`, `next/link`, Client Component, metadata, `not-found` 등 쓰기 전에 `node_modules/next/dist/docs/`의 해당 문서를 확인한다.
* shadcn: `components.json`과 `src/components/ui/button.tsx`, `src/lib/utils.ts`를 확인하고 기존 방식에 맞춘다. 컴포넌트는 `npx shadcn@latest add ...`로 추가한다.

## 수정 범위
* 수정 가능: `src/**`, `package.json`/`package-lock.json`(필요한 패키지 추가 시), `public/`의 블로그용 정적 파일(`public/apps/**` 제외).
* 수정 금지: `next.config.ts`, `CLAUDE.md`, `AGENTS.md`, `supabase/**`, `.github/**`, `docs/**`(단, 아래 보고 파일은 작성), `.env*`.
* 단계 6 이후(검색, 관리자 목록, 에디터, 웹앱 카드, 프로필 수정, import 스크립트)는 **만들지 않는다**. 단, 헤더에 링크 자리 정도는 둬도 된다(없는 페이지로 가는 링크는 넣지 말 것).
* git commit/push 하지 않는다.

## 구현 요점
* 모든 Supabase 호출은 `src/lib/supabase.ts` 클라이언트로, Client Component에서만.
* 로그인 화면: 아이디/비밀번호(아이디에 `@` 없으면 `@class1.local` 부착), GitHub, Google 버튼. OAuth `redirectTo`는 `window.location.origin + withBasePath('/login/')` 형태. OAuth Provider가 설정 안 돼 있어도 화면이 깨지지 않고 오류 메시지만 표시.
* 마크다운: marked + DOMPurify + highlight.js를 CDN(jsdelivr 또는 cdnjs)에서 로드. 로딩 실패 시 원문 텍스트로 폴백. highlight.js 테마는 라이트/다크 대응.
* 조회수: `increment_post_view` RPC + sessionStorage로 세션당 1회.
* 한국어 UI, 미니멀, 다크모드(FOUC 방지), 모바일 우선 반응형.
* 기존 `src/app/page.tsx`의 create-next-app 템플릿 내용은 메인 화면으로 교체하고, 쓰지 않게 되는 `public/*.svg` 템플릿 이미지는 삭제해도 된다.

## 환경 제약
* `.env.local`은 아직 예시값이라 실제 Supabase 연결은 안 된다. 코드는 연결 실패 시 오류 상태를 보여주도록 만들고, 실데이터 테스트는 하지 않는다.
* `npm run build`와 `npm run lint`가 **반드시 통과**해야 한다. 빌드 결과 `out/`에 각 라우트의 `index.html`이 생기는지 확인한다.

## 완료 보고
`docs/blog/build-a-report.md`에 작성: 만든/수정한 파일 목록, spec과 달라진 점과 이유, 알려진 한계, 단계 6~10 담당자가 알아야 할 것(재사용할 훅/컴포넌트/헬퍼).
