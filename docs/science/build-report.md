# Build 보고: 과학수업 학기·단원·차시 메뉴

## 요구사항 변경 반영
진행 중에 "과학 탐구 차시만 둔다"는 변경을 받았다. 그래서 유형 배지와 유형별 색, 같은 period 묶기는 만들지 않았다.
- 차시 제목은 "탐구 번호. 주제"로 보여 주고, 보조 정보로 "N차시"와 교과서/실험관찰 쪽수를 붙였다.
- 단원 카드에는 "탐구 N개"를 적었다.

## 변경 파일
| 파일 | 내용 |
|---|---|
| `src/app/science/page.tsx` | `ScienceView`를 Suspense 경계로 감쌈(useSearchParams 정적 빌드 요건, `next/dist/docs/.../use-search-params.md` 확인) |
| `src/components/science/science-view.tsx` (신규) | 쿼리스트링(term/unit/lesson)으로 네 단계 화면, 브레드크럼, 찾을 수 없음 안내, 스켈레톤 |
| `src/components/layout/science-nav-tree.tsx` (신규) | 사이드바·드로어의 과학수업 하위 트리(학기 → 단원), 활성 표시, 자동 펼침 |
| `src/components/layout/sidebar.tsx` | `NavMenuList`의 과학수업 항목에 하위 트리와 펼침 버튼 추가(레일 상태에서는 렌더하지 않음) |
| `src/app/globals.css` | 레일 상태에서 `.sidebar-subtree` / `.sidebar-subtree-toggle` 숨김(첫 페인트 포함) |

`src/data/science-curriculum.ts`와 `menu.ts`는 고치지 않았다. 필요한 헬퍼(`findTerm`/`findUnit`/`findLesson`/`scienceHref`)는 데이터 파일에 이미 있었다.

## 화면 구조 (`/science/`)
- **파라미터 없음**: PageHero, "학기별 단원" 카드 2개(1학기: 단원 4개 목록 / 2학기: "준비 중"), 기존 "과학 수업 글" 목록
- **`?term=6-1`**: 브레드크럼, 학기 머리글, 단원 카드(번호 칩, 단원명, "탐구 N개")
  - 단원이 없는 학기(6-2)는 "준비 중이에요" 안내를 띄운다.
- **`&unit=2`**: 단원 머리글("2. 물체의 운동 · 탐구 6개"), 차시 카드 목록
  - 각 카드: "N. 주제", N차시, 교과서 쪽, 실험관찰 쪽
- **`&lesson=4`**: 차시 상세
  - 단원 · 탐구 n/전체, "N. 주제", 지도서 N차시, 교과서/실험관찰 쪽수 타일
  - 이전·다음 차시 링크와 "단원 차시 목록으로" 버튼이 있다.
- **잘못된 파라미터**: 브레드크럼에 "찾을 수 없음"을 표시한다. 가까운 상위 단계로 돌아가는 링크를 준다(학기 → 처음, 단원 → 학기, 차시 → 단원).
- **사이드바/드로어**: 과학수업 줄 오른쪽에 펼침 버튼(aria-expanded)이 있고, 그 아래에 학기, 다시 그 아래에 단원이 있다.
  - 과학수업 화면에 들어오면 자동으로 펼쳐지고, 현재 학기도 자동으로 펼쳐진다.
  - 현재 학기와 단원은 soft 배경과 `aria-current="page"`로 표시한다.
  - 2학기는 "준비 중" 표시를 단다. 드로어에서 링크를 누르면 드로어가 닫힌다.

## 확인한 것
- `npm run lint` 통과, `npm run build` 통과(17개 정적 페이지)
- 개발 서버 `http://localhost:3000/class1/science/`에서 확인한 것:
  - 데스크톱: 학기, 단원, 차시, 이전/다음 이동. 브레드크럼 링크. 사이드바 활성 표시와 자동 펼침.
  - 펼침 버튼: aria-expanded가 true와 false로 바뀌는 것을 확인했다.
  - 레일 상태: 새로고침한 뒤에도 하위 트리와 버튼이 숨겨진다.
  - 다크모드: 단원 목록과 차시 상세.
  - 모바일 375px: 가로 스크롤 없음(scrollWidth 375). 드로어 트리에서 단원을 누르면 이동하고 드로어가 닫힌다.
  - 잘못된 파라미터: `term=zz`, `unit=9`, `lesson=99`. 그리고 `term=6-2`는 "준비 중"으로 나온다.

## 2학기 추가 방법
`src/data/science-curriculum.ts`의 `"6-2"` 항목 `units` 배열에 1학기와 같은 형식으로 단원을 넣는다.
- 단원 형식: `{ number, title, lessons: [{ id, inquiry, period, title, science, workbook }] }`
- 화면, 사이드바 트리, 학기 카드는 이 배열을 순회하므로 코드를 더 고칠 필요가 없다.
- 단원을 넣으면 "준비 중" 표시는 자동으로 사라진다.
