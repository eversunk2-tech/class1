# Build 지침(관리자 화면) — 반별로 나눠 보이게 하기 (2026-09-26)

당신은 **Build(화면)** 담당이다. `docs/classes/spec.md`(**끝의 "개정 1"이 우선** — 특히 권한 표 1-1, 흐름 1-2, 이름표 1-4)대로 관리자 대시보드를 바꾼다. DB·Edge Function은 다른 Build 담당이 **같은 이름표(1-4)**로 동시에 만든다 — 그 이름(표·열·RPC·요청 필드 `classId`)을 그대로 쓴다.

## 먼저 읽기
`CLAUDE.md`(정적 export·서버 기능 금지·basePath·디자인 규칙·관리자 화면 규칙), `AGENTS.md`(이 Next.js 버전 주의), `docs/classes/spec.md` 개정 1, `src/app/admin/`(회원 관리·개요·학습 현황·학생 응답·로그인 잠금 카드), `src/lib/admin.ts`·`learning.ts`·`member-import.ts`·`types.ts`, `src/components/admin/*`(회원 추가 대화 상자 등), `src/components/admin-guard.tsx`.

## 할 일
1. **`src/lib`**: `my_admin_context()`(총괄 여부·내 학급 목록) 불러오기 훅/함수, `create_class`·`rename_class` 호출, 회원 목록에 학급 이름(`member_directory.class_id` → `classes(name)` 연결) 추가, 회원 추가 요청에 `classId` 추가. 타입 갱신. 실패는 기존 방식(한국어 메시지 오류).
2. **학급 카드(새)** — 관리자 개요 또는 회원 관리 화면 맨 위: "내 학급" 목록(이름·학생 수), **학급 개설**(이름 입력, 1~40자), 이름 바꾸기. 학급이 하나도 없는 교사에게는 "먼저 학급을 개설해 주세요" 안내(회원 추가 버튼 옆에도).
3. **회원 추가**(한 명·엑셀): 학생은 **내 학급 중에서** 고름(하나면 자동). 역할 '교사' 선택은 **총괄에게만** 보인다(교사 계정은 학급 없음). 엑셀 일괄은 파일 하나당 학급 하나를 화면에서 고르는 방식(서식 파일은 바꾸지 않음).
4. **회원 명단**: "학급" 열(학급 이름 — 관리자 화면에서만), 총괄에게는 학급 필터 + **"담임교사로 지정 / 담임 해제"** 동작(`admin_set_role`, 확인 대화 상자, 거부 사유 한국어로 보여 주기). 담임에게는 자기 반 학생만 보인다(RLS가 거른다 — 화면은 빈 상태 문구만 알맞게). 비밀번호 초기화·탈퇴 버튼은 지금처럼(권한은 서버가 판단).
5. **로그인 잠금 카드**: 총괄만 스위치를 켜고 끔. 담임에게는 지금 상태만 읽기 전용으로("총괄 선생님만 바꿀 수 있어요").
6. **학습 현황·학생 응답·피드백**: RLS가 자기 반만 돌려주므로 대부분 그대로. 교사가 학급을 2개 이상 가지면 학급 고르기 필터(선택). 학생이 0명일 때 문구를 "내 학급 학생이 아직 없어요"처럼.
7. 학생 화면(`/me/…` 등)·과학 앱·블로그 공개 화면은 **바꾸지 않는다**(학생에게 소속 정보를 보이지 않음 — 개정 1).
8. 디자인: 관리자 영역 규칙(보라 채도 낮춘 `admin-theme.css`, 위험 동작은 `danger-button.ts`), 접근성(44px·대비·초점), 한국어 6학년 교사 눈높이 문구.

## 검증
* `npm run lint`, `npx tsc --noEmit`, `npm run build` 통과.
* 빌드된 `out/`을 **자기 정적 서버**로(`/class1/` 경로로 서빙 — 스크래치 폴더에 `class1 → out` 링크, 포트 **8783**) + 자기 전용 headless Chrome(포트 **9354**, 프로필은 스크래치 `/private/tmp/claude-501/-Users-sungchul-Desktop-classroom/7bf3a39e-3017-4189-b337-1b82aace66bb/scratchpad/classes-ui/`) + `--host-resolver-rules`로 supabase 차단 + CDP `Fetch` 가짜 응답(가짜 관리자 세션, `my_admin_context`·`member_directory`·`classes`·RPC 가짜 응답)으로 세 경우를 확인하고 스크린숏: ① 학급 없는 새 담임(학급 개설 안내 → 개설) ② 담임(자기 학급 1개, 회원 추가에서 학급 자동·교사 역할 안 보임, 잠금 카드 읽기 전용) ③ 총괄(학급 필터·담임 지정 버튼·교사 역할 보임·잠금 스위치). 캐시 끄기(`Network.setCacheDisabled`). 실제 Supabase·Gemini 요청 금지.
* 학생 화면 회귀 없음(`/me/learning/` 등 요소 그대로).

## 규칙
* 수정 범위: `src/`(관리자 영역·lib·types·admin 컴포넌트)와 보고서. **`supabase/`·`public/`·`scripts/`는 건드리지 않는다**(다른 담당·다른 작업 중). git commit/push·실 DB·내려받기·설치 금지. `localStorage.clear()` 금지. 끝나면 서버·Chrome 종료, 임시 파일은 스크래치에만.

## 보고서 `docs/classes/build-ui-report.md`
바꾼 파일·화면, 쓰는 RPC·표 이름(이름표 1-4와 대조), 세 경우 스크린숏 경로(영어 파일 이름), 확인하지 못한 것(실 DB 연결 뒤 확인할 것), 걱정되는 점. 한국어로 간결하게.
