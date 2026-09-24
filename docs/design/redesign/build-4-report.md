# 디자인 개편 4단계 Build 보고서 — 관리자 화면 색·글꼴·모서리·그림자 (2026-09-24)

지침: `build-4-instructions.md` / 설계: `spec.md` §4.9(+ §10 Q7). 1~2단계에서 바뀐 사이트 토큰(보라 `--primary`, Pretendard, 그림자 단계)을 그대로 쓰고, 관리자 화면에는 **색·글꼴·모서리·그림자만** 맞췄다. 3D 아이콘·마스코트는 넣지 않았다(관리자 메뉴 아이콘은 lucide 그대로, spec §3.2).

작업 방식: git 명령 없음. 내 전용 headless Chrome(포트 9624, 전용 프로필)과 내 정적 서버(이전 빌드 4724, 이번 빌드 4725)만 썼고, 다른 탭·서버(3000번 개발 서버 등)는 건드리지 않았다. `localStorage.clear()`는 쓰지 않았다(가짜 세션 키 1개만 넣음). 과학 앱(`public/apps/**`, `scripts/templates/**`)은 건드리지 않았다(3단계 담당이 동시에 수정 중인 `scripts/templates/science-sim/style-common.css`는 내 변경이 아니다).

**실 DB 요청 0건**: 관리자 세션과 모든 Supabase 응답(읽기·쓰기·RPC·Edge Function)을 페이지 안 가짜 `fetch`가 만들었다. 안전망으로 CDP가 `*.supabase.co` 요청을 네트워크 단계에서 모두 막게 해 두었고, 전체 촬영·검사 동안 막힌 요청은 0건(= 가짜 fetch를 벗어난 요청 없음)이었다. 가짜 데이터: 회원 9명(관리자 1, 학생 8 — 비밀번호 변경 대기·GitHub·Google·탈퇴 학생 포함), 과학 앱 결과 10건(detail.qa), 과제 3·제출 5, 피드백 대화 4, 신고 3, 게시글 4, 선생님 글 4.

## 1. 결과 요약
* **관리자 영역 한정 색 톤**(`src/app/admin/admin-theme.css`): 보라 채도를 낮추고(아래 §2), 빨강을 한 단계 진하게, 고정폭 글꼴의 한글을 Pretendard로. `.admin-area`(관리자 레이아웃) 안과 **관리자 화면에서 연 대화상자·확인 창·드롭다운**(포털이라 `:root:has(.admin-area)`로 잡음)에만 걸린다. 새 전역 토큰 없음 — 기존 `--primary`·`--ring`·`--destructive` 값만 이 영역에서 덮어쓴다. CSS는 관리자 경로에서만 내려받는 별도 조각(1.6KB)으로 빌드된다.
* **글꼴**: 화면 제목 h1(대시보드·회원 관리·학습 현황·커뮤니티 관리·글 관리·글쓰기·과제 제목)을 사이트 H1과 같은 Jua로. 관리자 메뉴 이름은 Jua → **Pretendard(비활성 500·활성 600)**로 바꿔 바로 옆 전역 사이드바와 같은 글꼴·굵기 규칙을 따른다. 통계 숫자는 Jua → Geist/Pretendard 600 고정폭 숫자(숫자 판독 우선). 섹션 제목(h2)·대화상자 제목은 원래대로 Jua.
* **모서리·그림자**: 투명하던 목록·표·카드(과제 목록, 글 목록, 신고 카드, 학생 응답 카드, 피드백 대화 목록, 표 `TableWrap` 등)에 흰 판 + 옅은 윤곽 + `--shadow-sm`(다크는 윤곽만)을 깔았다(`adminSurfaceClass`). 떠 있는 카드(통계 칸·회원 상세·과제 머리)는 `--shadow-md`, 관리자 메뉴 줄은 `rounded-2xl` + 활성 칩은 떠 있는 흰 칩(전역 사이드바와 같은 방식). 입력칸(검색·글쓰기 폼·피드백 입력)은 흰 바탕으로 연보라 배경과 분리.
* **위험 동작은 분명한 빨강**: 되돌릴 수 없는 동작의 **마지막 확인 버튼**(탈퇴 처리·비밀번호 초기화·관리자 해제·글/과제/제출물/신고 대상/칭찬 문구 삭제)을 옅은 빨강 → **진한 빨강 바탕 + 흰 글자**로(`dangerSolidClass`). 확인 창을 여는 위험 버튼(회원 상세 "탈퇴 처리"·"관리자 해제", 목록의 "삭제")·위험 배지·메뉴 항목도 빨강 그대로이며, 관리자 영역 빨강을 한 단계 진하게 해 AA를 맞췄다(§4).
* **hover 떠오름 끊김 수정**(`admin-overview.tsx` 바로 가기 카드): `transition-[transform,…]` → `transition-[translate,border-color,box-shadow]`. 실측: 이전 빌드는 hover 0ms에 바로 -2px(전환 없음), 이번 빌드는 0 → -0.17 → -0.47 → -1.29 → … → -2px(약 200ms)로 부드럽게 움직이고, 움직임 줄이기에서는 움직이지 않는다.
* 기능·데이터·권한 흐름은 그대로다(바꾼 것은 className·CSS뿐, 예외는 §3 표의 "비고"). 회원 추가(한 명·엑셀 미리보기)·탈퇴(이름 입력 후 켜짐)·비밀번호 초기화(임시 비밀번호 표시)·로그인 잠금 스위치(켜기 확인창)·학생 응답·피드백·일괄 칭찬·신고 처리·글쓰기 흐름을 가짜 응답으로 끝까지 눌러 보았다.
* `npm run lint` · `npx tsc --noEmit` · `npm run build`(24쪽) 통과.

## 2. 보라 채도 판단(spec Q7) — 낮췄다
**판단**: 관리자 화면은 한 화면에 상태 배지(공개·발행·관리자·검토 완료)·스위치·주 버튼이 여러 개씩 반복되는 표·목록 화면이다. 사이트 보라 `oklch(0.53 0.2 288)`(#6c4dd6)가 이런 반복 요소에 그대로 들어가니, 파스텔 메뉴색 칩·Jua 제목과 겹쳐 형광 보라가 곳곳에서 튀어 "장난스럽고 산만하다"고 판단했다(이전 빌드 스크린숏 `before/assignments-1440-light.png`의 "공개" 배지·스위치 줄). 사이트와 같은 보라 계열·명도는 유지하고 **채도만 약 25% 낮췄다** — 브랜드는 이어지고 작업 도구다운 차분한 남보라가 된다. 비교: `before/crop-assignments-before.png` ↔ `before/crop-assignments-after.png`.

| 토큰(관리자 영역) | 사이트(밝음/어두움) | 관리자(밝음/어두움) | 대비 |
|---|---|---|---|
| `--primary` | `oklch(0.53 0.2 288)` #6c4dd6 / `oklch(0.75 0.15 288)` | **`oklch(0.51 0.15 286)` #6154b6** / **`oklch(0.74 0.11 287)` #a6a0ed** | 흰 글자 5.59 → **5.90:1**(hover /90 4.73), 흰 바탕 위 보라 글자 6.07:1 / 다크 짙은 글자 **8.0:1** |
| `--ring` | `oklch(0.65 0.1 288)` / `oklch(0.55 0.08 288)` | `oklch(0.62 0.08 286)` / `oklch(0.56 0.06 286)` | 흰 바탕 3.71:1 / 다크 배경 4.19:1 |
| `--destructive` | `oklch(0.577 0.245 27)` #e7000b / `oklch(0.704 0.191 22)` | **`oklch(0.5 0.2 25)` #bb061e** / **`oklch(0.74 0.17 22)` #ff7d7c** | §4 |

페이지 배경(연보라 그라데이션·빛 번짐)·전역 사이드바·머리말은 사이트와 똑같이 두었다(관리자에 들어와도 같은 사이트로 느껴지게).

## 3. 바꾼 파일
| 파일 | 내용 | 비고 |
|---|---|---|
| **신규** `src/app/admin/admin-theme.css` | 관리자 영역 한정 `--primary`·`--ring`·`--destructive`(밝음·어두움), 고정폭 글꼴 한글 → Pretendard | `:has()`를 모르는 옛 브라우저는 포털 규칙만 빠지고 사이트 기본색 |
| **신규** `src/components/admin/admin-styles.ts` | `adminSurfaceClass`(흰 판+윤곽+작은 그림자), `dangerSolidClass`(진한 빨강 확인 버튼), `adminTabPanelClass`(탭 내용 초점 링) | |
| `src/app/admin/layout.tsx` | 감싸는 div에 `admin-area`, 위 CSS import | |
| `src/components/admin/admin-shell.tsx` | 메뉴: Pretendard 500/600, `rounded-2xl`, 활성 칩 흰 칩+`--shadow-md`, 칩 lg 32px, 가로 스크롤 목록 위아래 4px(초점 링·그림자 안 잘리게) / `AdminPageHeader` h1 → Jua | 구조·아이콘(lucide) 그대로 |
| `src/app/admin/(dashboard)/admin-overview.tsx` | 바로 가기 카드 hover 전환 수정 + hover 그림자, 최근 가입 회원 목록 겉면 | |
| `src/components/dashboard/stat-tile.tsx` | `tone="default"`(관리자 개요에서만 씀): `--shadow-md`, 숫자 Jua → 600 고정폭 숫자 | 홈(`vivid`)은 클래스 결과가 같아 변화 없음(§5 비교 0px) |
| `src/components/admin/login-required-card.tsx` | 겉면, **켜짐일 때 옅은 빨간 윤곽**(빨간 자물쇠 칩·문구와 함께) | |
| `src/app/admin/(dashboard)/members/member-list.tsx` | 표·카드 목록 겉면, 검색칸 흰 바탕, 표 상자 `relative` | **기존 버그 수정**: 머리글 sr-only "작업"(absolute)이 상자 밖으로 새어 1440에서 화면 전체가 28px 옆으로 밀림 → 없어짐 |
| `src/app/admin/(dashboard)/members/member-detail.tsx` | 카드 `--shadow-md`, "관리자 해제" 확인 버튼 진한 빨강 | |
| `src/components/admin/member-withdraw-dialog.tsx` · `password-reset-dialog.tsx` | 마지막 확인 버튼 진한 빨강 | |
| `src/components/admin/member-create-dialog.tsx` | 탭 내용 초점 링 | |
| `src/app/admin/(dashboard)/posts/admin-post-list.tsx` | 제목 영역을 `AdminPageHeader`로(같은 내용·구조), 목록 겉면, 삭제 확인 진한 빨강 | |
| `src/app/admin/write/post-editor.tsx` | h1 Jua, 입력칸·본문 편집기 흰 바탕, 미리보기 판 겉면, 아래 저장 막대 `rounded-2xl`+`--shadow-md`, 삭제 확인 진한 빨강 | 저장 버튼은 spec §1.3대로 알약 CTA로 바꾸지 않음(관리자 버튼 규칙) |
| `src/app/admin/(dashboard)/community/community-moderation.tsx` | 신고 카드·글 목록 겉면, 대상 삭제 확인 진한 빨강 | |
| `src/app/admin/(dashboard)/learning/learning-view.tsx` · `members/member-learning.tsx` | 탭 내용 칸 초점 링(전에는 Tab으로 들어가도 표시 없음) | |
| `src/app/admin/(dashboard)/learning/learning-overview.tsx` | 피드백 대화·최근 활동 목록 겉면, "전체 웹앱 시도" 숫자 600 고정폭, 지각 배지 진한 색 | |
| `src/app/admin/(dashboard)/learning/responses-view.tsx` | 학생 카드 겉면, 보기 방식 묶음·검색칸 흰 바탕 | |
| `src/app/admin/(dashboard)/learning/assignment-manager.tsx` · `submission-review.tsx` | 목록 겉면, 과제 머리 `--shadow-md`·제목 Jua, 삭제 확인 진한 빨강, 지각 배지 진한 색 | |
| `src/components/admin/praise-preset-manager.tsx` | 문구 삭제 확인 진한 빨강 | |
| `src/components/learning/learning-ui.tsx`(공용) | `TableWrap`(관리자에서만 렌더링) 겉면 + 초점 링 / `LateBadge`에 선택 `className` | 학생 화면은 `LateBadge`를 그대로 불러 변화 없음 |
| `src/components/learning/confirm-dialog.tsx`(공용) | 선택 prop `confirmClassName` | 주지 않으면 예전과 같은 클래스(학생 "과제 삭제"는 그대로) |
| `src/components/learning/activity-panels.tsx`(공용) | `audience="admin"` 목록 틀·관리자 전용 과제 제출 목록 겉면, 관리자 지각 배지 | 학생 분기 문자열 그대로 |
| `src/components/feedback/feedback-center.tsx` · `feedback-thread.tsx`(공용) | `audience="admin"`일 때만: 대화 목록 흰 판·고른 대화 옅은 보라(/8)+600, 입력칸 흰 바탕 | 학생 분기 그대로 |

## 4. 위험 색(빨강)·배지 대비
| 자리 | 이전 | 이번 |
|---|---|---|
| 마지막 확인 버튼(탈퇴 처리 등) | 옅은 빨강 바탕 + 빨간 글자 **3.99:1(AA 미달)** | **진한 빨강 + 흰 글자 6.48:1**(hover 5.78) / 다크 5.29(hover 6.36) |
| 옅은 빨강 배지·버튼("변경 대기", 신고 사유, "신고 N", 회원 상세 "탈퇴 처리") | 3.99:1(미달) | **5.56:1**(hover /20 4.59) / 다크 /20 위 5.06 |
| 흰 판 위 빨간 글자 버튼("삭제", "대상 삭제") | 4.76 | 6.67 / 다크 7.04 |
| 지각 배지(관리자) | 4.06(미달) | `text-board-ink` 약 6.8 |
| 확인 대화상자 안 경고 상자 | 빨간 아이콘 + 검은 글자 | 그대로(빨간 테두리·바탕) |
* 드롭다운 "탈퇴 처리" 항목, 오류 문구도 관리자 빨강을 따라 진해졌다. 켜기/지정처럼 되돌릴 수 있는 동작의 확인 버튼("켜기", "관리자로 지정", "만들기", "저장")은 보라 그대로.

## 5. 검증(정적 빌드, 내 전용 브라우저)
* **스크린숏**: 관리자 화면 28개 × 4크기(1440 밝음·1440 어두움·768×1024·375) = **112장**. 오류·가로 스크롤·콘솔 오류·실패 요청·막힌 Supabase 요청 모두 **0**.
* **대비(WCAG AA) 화면 픽셀 실측**(글자 상자 안 최빈색=배경, 대비가 가장 큰 픽셀=글자, 스크롤에 잘리거나 대화상자 뒤에 가린 글자 제외, 4크기): 글자 상자 6,457개 중 **미달 0건**. 한 글자짜리 상자 44개(아바타 머리글자 26, 기호 —·/·가운뎃점 12, 바닥글 © 4, 다크 가운뎃점 2)는 가는 한 글자라 안티앨리어싱 때문에 픽셀 측정을 믿을 수 없어 따로 모았고, 같은 색 조합의 토큰 계산으로는 모두 통과(흐린 글자 on 흰색 5.5, 아바타 머리글자 on muted 5.05, 다크 7 이상).
  * 첫 측정에서 찾아 고친 실제 미달: 지각 배지 4.06(→ ink 색), 관리자 피드백 대화 목록의 고른 항목 미리보기 글자 4.4(보라 바탕 /10 → /8, 계산 4.93).
* **키보드 초점**: 관리자 7개 화면을 Tab으로 돌며 초점 표시(outline 또는 링) 검사 — 밝음·어두움 각 **209곳, 표시 없음 0**(처음엔 학습 현황의 탭 내용 칸 2곳 — 학생 응답·과제 관리 — 이 Tab으로 들어가도 표시가 없었다 → 학습 현황·회원 상세·회원 추가 대화상자의 탭 내용 칸에 둥근 초점 링 추가). 대표 모습: `focus-*.png` 8장(메뉴·주 버튼·표 정렬·진한 빨강 확인 버튼, 밝음/어두움).
* **움직임 줄이기**: 바로 가기 카드 `transition: none`, 떠오름 없음(측정). 그 밖의 관리자 요소에는 움직임이 없다.
* **학생·방문자 화면이 바뀌지 않았는지**(이전 빌드 ↔ 이번 빌드, 같은 가짜 학생 세션, 움직임 줄이기, 전체 페이지 픽셀 비교): 홈(학생·방문자), 내 학습 활동 5개 탭(웹앱 결과·읽은 글·댓글·과제·피드백 — 공용 컴포넌트의 학생 분기), 과학수업, 자유게시판, 로그인 × 1440 밝음·어두움·375 = 30쌍 중 **29쌍 0px 차이**. 남은 1쌍(다크 1440 피드백 탭)은 머리말 오른쪽 아이콘 자리(x 1319~1420, y 13~35)의 103px뿐이고, 같은 자리 차이가 실행마다 방향을 바꿔(이전→이번, 이번→이전) 나타났다 — 이번에 건드리지 않은 머리말 아이콘의 안티앨리어싱 흔들림이다.
* **글꼴 실제 사용**(CDP `getPlatformFontsForNode`): h1 `Jua-Regular`, 메뉴 `PretendardVariable-Medium/SemiBold`, 통계 숫자 `Geist-SemiBold`, 대화상자 제목 `Jua-Regular`, 탈퇴 확인 이름·본문 편집기의 한글(고정폭) `AppleSDGothicNeo`(기기 대체 글꼴) → **`PretendardVariable`**, 라틴·숫자는 `GeistMono` 그대로.
* 포털 적용: 대화상자·드롭다운 안 버튼·배지도 관리자 톤(#6154b6, #bb061e)으로 그려지는 것을 스크린숏으로 확인(`member-withdraw-*`, `praise-*`, `member-menu-*`).

## 6. 스크린숏
폴더: `/private/tmp/claude-501/-Users-sungchul-Desktop-classroom/7bf3a39e-3017-4189-b337-1b82aace66bb/scratchpad/redesign-4/`
파일 이름: `<화면>-1440-light.png`, `<화면>-1440-dark.png`, `<화면>-768x1024.png`, `<화면>-375.png`(2배 해상도). 대화상자는 화면 크기만, 나머지는 전체 페이지(전체 페이지 촬영이라 전역 사이드바 배경이 화면 한 장 높이에서 끊겨 보이는 것은 촬영 방식 때문).

| 화면 | `<화면>` 이름 |
|---|---|
| 개요 · 로그인 잠금 켜기 확인창 · 잠금 켜짐 | `overview`, `lock-dialog`, `lock-on` |
| 회원 관리 · 회원 추가(한 명/엑셀 미리보기) · ⋮ 메뉴 · **탈퇴 대화상자**(이름 입력 후) | `members`, `member-create`, `member-create-excel`, `member-menu`, `member-withdraw` |
| 회원 상세 · 비밀번호 초기화 확인/결과 · **피드백 대화** | `member-detail`, `member-reset-confirm`, `member-reset`, `feedback` |
| 학습 현황 개요 · 웹앱 결과 · **학생 응답**(학생별/질문별) · 일괄 칭찬 | `learning`, `learning-apps`, `responses`, `responses-question`, `praise` |
| **과제** 목록 · 새 과제 · 제출 현황 · 과제 삭제 확인 · 참여 집계 | `assignments`, `assignment-new`, `submissions`, `assignment-delete`, `engagement` |
| **커뮤니티 신고** · 글·게임 · 대상 삭제 확인 | `community`, `community-posts`, `community-delete` |
| 글 관리 · **글쓰기**(새 글/수정) | `posts`, `write`, `write-edit` |
| 키보드 초점 | `focus-nav-*`, `focus-primary-button-*`, `focus-table-sort-*`, `focus-danger-button-*` |
| 이전 빌드(비교용) | `before/*.png`(개요·과제·회원·탈퇴·글쓰기·피드백), `before/crop-assignments-{before,after}.png` |

대표: `overview-1440-light.png`, `overview-1440-dark.png`, `member-withdraw-1440-light.png`, `member-withdraw-1440-dark.png`, `assignments-1440-light.png`, `responses-1440-dark.png`, `members-375.png`, `write-edit-1440-light.png`.

## 7. 알릴 것(기존 문제 — 이번 범위 밖이라 고치지 않음)
1. ~~**회원 표가 1440에서도 상자보다 넓다**~~ → **개정 1에서 고침**. 원래 내용:(968px vs 896px): 오른쪽 ⋮(비밀번호 초기화·탈퇴) 열이 표 안 가로 스크롤 뒤로 숨는다. 768 태블릿(사이드바 펼침)에서는 `md:` 화면 폭 기준이라 카드 대신 표가 나와 더 많이 잘린다. 화면 전체가 밀리던 문제만 고쳤다(`relative`). 제안: 표/카드 전환을 컨테이너 기준(`@container`)으로 바꾸거나, 가입일·마지막 로그인 칸 줄바꿈 허용 — 배치 변경이라 결정 필요.
2. ~~**제출 현황의 탈퇴 학생 이름이 두 번 감싸짐**~~ → **개정 1에서 고침**. 원래 내용:: "탈퇴한 학생(탈퇴한 학생(조은우))". `submission-review.tsx` `SubmissionRow`가 `adminDisplayName`으로 만든 이름을 `StudentLink`의 `display_name`에 다시 넣어 한 번 더 감싼다. 고치려면 `display_name: row.student.display_name`을 넘기면 된다(데이터 표시 로직이라 이번에 손대지 않음).
3. ~~**학생 화면 "지각" 배지도 4.06:1(AA 미달)**~~ → **개정 1에서 고침**. 원래 내용:: 공용 `LateBadge`의 기본색(board-strong). 학생 화면은 바꾸지 말라는 지침이라 관리자에서만 진하게 했다 — 학생 쪽은 `<LateBadge className="text-board-ink" />` 한 줄로 고칠 수 있다.
4. 다크의 옅은 빨강 버튼(회원 상세 "탈퇴 처리"·"관리자 해제")은 hover(/30) 순간 4.10:1(이전 3.83). 평소 상태는 5.06:1.
5. 개요 "최근 학습활동"의 긴 앱 이름이 1440에서 두 줄로 꺾인다(기존 배치 그대로).

## 8. 확인하지 못한 것
* **진짜 관리자 로그인과 실제 Supabase 데이터·Edge Function 응답**(모두 가짜 세션·가짜 응답으로만 확인). 실제 데이터 양(학생 수십 명, 긴 이름·긴 글)에서의 표 폭.
* **실제 iPad/Safari**: `:has()`(Safari 15.4 이상에서만 대화상자·메뉴에 관리자 톤이 걸림, 그 아래는 사이트 기본 보라·빨강으로 보임), `color-mix()`/oklch, 실제 터치.
* Windows(맑은 고딕 대체) 표시, 느린 학교 와이파이에서 Pretendard 조각 내려받기 동안의 모습.
* 3단계(과학 앱 공통 틀)와 함께 배포했을 때의 모습 — 동시 작업이라 이 빌드에는 과학 앱 사본을 넣지 않고 관리자 화면만 확인했다.

## 개정 1 (2026-09-24, 조정자 요청) — 보고한 문제 3건 수정
**이 절이 위 §3 표의 `member-list.tsx`·`learning-ui.tsx`(LateBadge) 줄과 §7-1~3보다 우선한다.** 같은 조건(git 없음, 실 DB 요청 0 — 가짜 세션·가짜 응답, 내 전용 headless Chrome 포트 9626·정적 서버 4726, `localStorage.clear()` 없음 — 내 키 `sidebar:collapsed`만 넣고 뺌, `scripts/templates/**`·`public/apps/**` 손대지 않음). 점검용 가짜 데이터에 긴 이메일 학생 1명(`namgung.minsu.science.class@example-school.kr`, Google+GitHub)과 탈퇴 학생의 제출물 1건, 학생 화면용 지각 제출 1건을 더했다.

### 1) 회원 관리 표 — ⋮(작업) 칸이 언제나 보이게 (`src/app/admin/(dashboard)/members/member-list.tsx`)
* **표/카드 전환을 목록 자리 폭(`@container`) 기준으로**: 목록 폭 46rem(736px) 이상이면 표, 좁으면 카드(기존 카드 목록 그대로, 정렬 선택 포함). 예전 `md:`(화면 폭 768) 기준은 전역 사이드바·관리자 메뉴 때문에 실제 폭이 480px뿐인 768·1024 화면에서도 표를 띄워 크게 잘렸다(spec §4 공통 규칙 "레이아웃 분기는 @container 기준"에 맞춤).
* **칸 줄이기**: 날짜 두 칸은 날짜와 시각 사이에서만 줄을 바꾼다("2026년 9월 23일 / 오후 04:00", 보이는·읽히는 글자는 그대로). 목록 폭 56rem(896px) 미만에서는 **가입 방식** 칸을 숨긴다(회원 상세·카드 목록에는 그대로). 아이디/이메일 칸 최대 폭 13 → 12rem(잘린 이메일은 마우스를 올리면 전체가 보이게 `title`).
* **⋮ 칸 붙박이(sticky right)**: 실제 데이터가 더 길어 표가 넘쳐도 ⋮는 표 오른쪽 끝에 붙어 있다. 불투명 바탕(머리글 `muted 40%`·행 hover `muted 50%`와 같은 색으로 합성) + 왼쪽 1px 구분선. 머리글 sr-only "작업"도 이 칸 안에 들어가 밖으로 새지 않는다.
* 동작은 그대로: 행 아무 곳 클릭 → 회원 상세, ⋮ 메뉴의 비밀번호 초기화·탈퇴 처리(메뉴 클릭은 행 이동을 일으키지 않음 — 기존 `stopPropagation`·선택자 이중 방어 그대로).

**배치 실측**(목록 폭 · 보기 · 표 가로 넘침 · ⋮가 화면/표 밖으로 나간 수 · 문서 가로 스크롤):
| 화면 폭 | 사이드바 펼침 | 사이드바 접힘 |
|---|---|---|
| 1920·1536 | 912 · 표 · 0 · 0 · 0 | 912 · 표 · 0 · 0 · 0 |
| **1440** | **896 · 표(가입 방식 보임) · 0 · 0 · 0** | 912 · 표 · 0 · 0 · 0 |
| 1366 | 822 · 표(가입 방식 숨김) · 0 · 0 · 0 | 912 · 표 · 0 · 0 · 0 |
| 1280 | 736 · 표 · 0 · 0 · 0 | 904 · 표 · 0 · 0 · 0 |
| 1152 | 608 · 카드 · — · 0 · 0 | 776 · 표 · 0 · 0 · 0 |
| **1024** | **480 · 카드 · — · 0 · 0** | 648 · 카드 · — · 0 · 0 |
| 900 | 612 · 카드 · — · 0 · 0 | 780 · 표 · 0 · 0 · 0 |
| **768** | **480 · 카드 · — · 0 · 0** | 648 · 카드 · — · 0 · 0 |
| 600 | 568 · 카드 · — · 0 · 0 | 568 · 카드 · — · 0 · 0 |
| **375** | **343 · 카드 · — · 0 · 0** | 343 · 카드 · — · 0 · 0 |

**동작 점검 28/28 통과**(1440·1280 표, 1024·768·375 카드): ⋮ → 비밀번호 초기화 대화상자, ⋮ → 탈퇴 대화상자(이름 입력 전 버튼 꺼짐), 메뉴를 눌러도 주소 그대로(행 이동 없음), 행(아이디 칸)·카드를 누르면 `?id=`로 회원 상세 이동. 붙박이 확인: 표 상자를 강제로 560px로 줄여 가로 스크롤을 만들고 → 스크롤 처음·끝 모두 ⋮ 10개가 상자 안에 보이고 메뉴도 열림.

### 2) 제출 현황의 탈퇴 학생 이름 (`src/app/admin/(dashboard)/learning/submission-review.tsx`)
* 원인: `adminDisplayName`으로 이미 감싼 이름을 `StudentLink`의 `display_name`에 넣어, `StudentLink`가 한 번 더 감쌌다. 이제 원래 표시 이름과 아이디 대체값(`fallback`)을 넘기고 감싸기는 `StudentLink`가 한 번만 한다.
* 결과: "탈퇴한 학생(조은우)" — 다른 관리자 화면(최근 활동·웹앱 결과·학생 응답·참여 집계)과 같은 형식. 표시 이름이 없는 학생은 예전처럼 아이디(이메일 앞부분)로 보인다. 알림 문구·피드백 창 제목·삭제 확인 문구의 이름(`name`)은 원래도 한 번만 감싸져 있어 그대로.

### 3) "지각" 배지 대비 (`src/components/learning/learning-ui.tsx`, 학생·관리자 공용)
* 글자색 board-strong → **board-ink**(board-strong 70% + 글자색 30%, 1~2단계에서 만든 기존 토큰). 문구 "지각"·알람 시계 아이콘·주황 계열 테두리·툴팁은 그대로라 뜻이 바뀌지 않는다.
* 실측(화면 픽셀): 밝음 #7b4e06 on 흰 카드 **7.16:1**(이전 4.06), 어두움 #f3c78c on 카드 **11.4:1**(이전 계산 9.43) — 학생 "내 학습 활동 > 과제", 관리자 학습 현황 개요·제출 현황 모두.
* 4단계에서 관리자 쪽에만 덧붙였던 `className` 선택값은 필요 없어져 없앴다(`LateBadge`는 다시 인자 없음, 관리자 호출부 3곳도 `<LateBadge />`로).

### 검증
* `npm run lint` · `npx tsc --noEmit` · `npm run build`(24쪽) 통과.
* 스크린숏 30장(`…/scratchpad/redesign-4/`, 같은 이름은 새 화면으로 덮어씀): `members-{1440-light,1440-dark,1024x768,768x1024,375}`, `member-menu-{같은 5크기}`, `member-withdraw-*`·`member-create-*`(1440 밝음·어두움·768·375), `submissions-*`(탈퇴 학생 이름), `submissions-late-*`(지각 배지), `me-assignments-*`(학생 화면 지각 배지). 가로 스크롤·콘솔 오류·실패 요청·막힌 Supabase 요청 모두 0.
* 대비 재측정(회원 관리·제출 현황·학습 현황·학생 과제 × 1440 밝음/어두움·1024·768·375): 글자 상자 1,611개 중 **AA 미달 0건**(한 글자짜리 19개 — 아바타 머리글자·© — 는 앞과 같은 측정 한계).
* 남은 것(요청 밖): 학생 "내 학습 활동 > 과제"의 **"수정 요청" 배지**(옅은 빨강 위 빨간 글자)가 사이트 기본 빨강이라 3.99:1 — 관리자 쪽은 4단계에서 5.56:1로 올렸지만 학생 쪽은 그대로다. 고치려면 공용 `SubmissionStatusBadge`나 학생 화면 한정 색이 필요해 결정이 필요하다.
* **추가("수정 요청" 배지, 위 '남은 것' 해결)**: 공용 `SubmissionStatusBadge`(`src/components/learning/learning-ui.tsx`)의 "수정 요청" 글자색을 관리자 영역과 같은 진한 빨강(밝음 `oklch(0.5 0.2 25)`·어두움 `oklch(0.74 0.17 22)`)으로 — 문구·옅은 빨강 바탕은 그대로, 학생 "내 학습 활동 > 과제" 밝음 3.99 → **5.55:1**·어두움 4.63 → **5.27:1**(1440·768·375 화면 픽셀 실측), 관리자 제출 현황은 원래 같은 색이라 변화 없음(5.53/5.04). 같은 빨강 토큰(`Badge variant="destructive"`)을 쓰는 다른 상태 배지("변경 대기"·신고 사유·"신고 N")는 관리자 전용이라 이미 5.56/5.06이고, 학생 화면에 남은 옅은 빨강은 상태 배지가 아닌 삭제 확인 버튼(댓글·글 삭제, 3.99:1)뿐이다. lint·tsc·build 통과, 스크린숏 `me-assignments-*`·`submissions-revision-*`(1440 밝음·어두움·768·375), 막힌 Supabase 요청 0.
* **추가(학생 삭제 확인 버튼, 위 '삭제 확인 버튼' 해결)**: 진한 빨강 확인 버튼 클래스를 공용 `src/lib/danger-button.ts`의 `dangerSolidClass`(밝음 `oklch(0.5 0.2 25)`·어두움 `oklch(0.55 0.22 25)` 바탕 + 흰 글자, 색 값 고정)로 옮기고 `admin-styles.ts`는 이를 다시 내보내 관리자 화면은 같은 색 그대로다. `ConfirmDialog`는 `destructive`이면 이 클래스를 자동으로 붙여 선택 prop `confirmClassName`을 없앴고(§3 표의 해당 칸 대체, 관리자 호출부 3곳 정리), 사이트 쪽 삭제 확인 4곳(`src/app/post/post-detail.tsx` 글 삭제·`src/components/comment-section.tsx` 댓글 삭제·`src/components/community/community-post-detail.tsx` 게시판·게임 글 삭제·`community-comment-section.tsx` 댓글 삭제)에도 붙였다 — 문구·동작·"취소" 버튼은 그대로. 실측(화면 픽셀, 학생 제출 삭제·게시판 글/댓글 삭제·선생님 글 댓글 삭제·관리자 글 삭제 5곳 × 1440 밝음·어두움·375): 밝음 3.99 → **6.64:1**(#bb071e 위 흰 글자)·어두움 **5.43:1**(#d40924), 15건 모두 글자 흰색, 막힌 Supabase 요청 0. lint·tsc·build(24쪽) 통과, 스크린숏 `danger-*-{1440-light,1440-dark,375}.png`.
