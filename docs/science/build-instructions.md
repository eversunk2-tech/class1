# Build 서브에이전트 지침: 과학수업 학기·단원·차시 메뉴

## 목표
과학수업 메뉴를 **학기 → 단원 → 차시**로 나눠 탐색할 수 있게 만든다. 데이터는 이미 `src/data/science-curriculum.ts`에 있다(수정 금지, 읽기만. 필요한 헬퍼는 새 파일에).

## 사용자 요구사항
* 과학수업을 누르면 세부 메뉴 **6학년 1학기 / 6학년 2학기**로 구분된다.
* 6학년 1학기 아래에 단원 4개가 차례대로: 1. 산과 염기, 2. 물체의 운동, 3. 식물의 구조와 기능, 4. 지구의 운동 (데이터 순서 그대로).
* 각 단원은 차시별로 세분화되고, 각 차시의 **주제·유형**과 **교과서·실험관찰 쪽수**를 보여준다. (학습 목표는 표시하지 않는다)
* 6학년 2학기는 아직 단원이 없다 → "준비 중" 안내.

## 설계
* **라우팅**: 정적 export라 동적 세그먼트 금지. `/science/?term=6-1&unit=2&lesson=3` 쿼리스트링(`scienceHref()` 사용). `useSearchParams`는 Suspense 경계 필요 여부를 `node_modules/next/dist/docs/`에서 확인.
  * 파라미터 없음: 학기 선택 카드 2개(1학기: 단원 4개 요약, 2학기: 준비 중) + 기존 "과학 수업 글"(`TaggedPostList tag="과학"`) 유지
  * `term`: 그 학기의 단원 카드 목록(단원 번호, 이름, 총 차시)
  * `term`+`unit`: 단원 제목 + **차시 목록**(차시 번호 배지, 주제, 유형 배지, 교과서/실험관찰 쪽). 같은 `period`를 공유하는 과학이 톡톡·마무리하기는 같은 차시 번호 아래 묶어 보이게.
  * `term`+`unit`+`lesson`: 차시 상세(주제, 유형, 쪽수) + 이전/다음 차시 이동 + 단원으로 돌아가기
  * 잘못된 파라미터: 가까운 상위 단계로 안내("찾을 수 없어요" + 링크)
  * 브레드크럼: 과학수업 › 6학년 1학기 › 2. 물체의 운동 › 3차시
* **사이드바(데스크톱) + 모바일 드로어**: `src/components/layout/sidebar.tsx`의 `NavMenuList`(드로어와 공용). 과학수업 항목에 펼침/접힘 하위 트리: 학기 → 단원(차시는 사이드바에 넣지 않음, 화면에서 선택). 현재 URL의 term/unit을 활성 표시하고 해당 학기를 자동 펼침. 사이드바가 접힌(레일) 상태에서는 하위 트리를 숨긴다. 펼침 버튼은 키보드 접근 가능(aria-expanded). 다른 메뉴 항목은 그대로.
* **유형 배지 색**: 열려라 과학 / 과학 탐구 / 창의가 팡팡 / 과학이 톡톡 / 마무리하기를 구분(기존 science 토큰 계열 + 중립색, 라이트/다크 대비 확보).
* 기존 디자인(커밋 `1907fb6` 리디자인: PageHero, menu-colors, 카드 스타일, 폰트)을 따른다. 한국어, 모바일 375px 대응.

## 먼저 읽을 것
`CLAUDE.md`, `AGENTS.md`, `src/data/science-curriculum.ts`, `src/data/menu.ts`, `src/components/layout/*`, `src/app/science/page.tsx`, `src/lib/menu-colors.ts`, `src/app/globals.css`(science 토큰, 사이드바 규칙).

## 수정 범위
* 수정 가능: `src/app/science/**`, `src/components/layout/**`, `src/components/science/**`(신규), `src/data/menu.ts`(필요 시 하위 메뉴 타입 추가), `src/app/globals.css`(필요한 최소 스타일).
* 수정 금지: `src/data/science-curriculum.ts`, 그 외 파일, `supabase/**`, `docs/**`(보고 파일 제외). git commit/push 금지.

## 검증
* `npm run lint`, `npm run build` 통과.
* 개발 서버(`http://localhost:3000/class1/science/`) 또는 빌드 결과를 브라우저로 열어 데스크톱·모바일(375px)·다크모드에서 학기→단원→차시 이동, 사이드바 트리 활성 표시, 드로어 동작, 잘못된 파라미터를 확인.

## 완료 보고
`docs/science/build-report.md`: 변경 파일, 화면 구조, 확인한 것, 2학기 추가 방법.
