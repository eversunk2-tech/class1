# 검토 지침(Review class-assignments) — 과제도 학급별로 ⑥ (2026-09-26, 커밋 `0d9d8e1`)

당신은 **Review** 담당이다. **코드를 고치지 않는다**(발견만 기록). 이 SQL은 검토 뒤 사용자가 ⑤ 다음에 직접 실행한다. 지난번 `20260927020000_class_notices.sql`은 읽어서 하는 검토를 모두 통과했지만 **실제 실행에서 42883 오류**가 났다 — **실행하면 오류가 날 곳과, 점검이 헛실패해 사용자가 막힐 곳**을 가장 먼저 찾는다.

## 사용자 결정(합격 기준)
"1번으로 과제도 학급별로 나눠줘"(`docs/classes/spec.md` 개정 3-2 — 학생 = 자기 학급 공개 과제만·비로그인 없음, 교사 = 자기 학급 과제 + 자기가 만든 과제, 총괄 = 전체, 만들기 = 자기 학급에만, 고치기·지우기 = 쓴 교사 또는 총괄(⑤), 학급은 만든 뒤 못 바꿈, 제출 = 자기 학급 공개 과제에만).

## 대상
`git show 0d9d8e1` — 새 SQL `supabase/migrations/20260927040000_class_assignments.sql`(⑥), 화면(`assignment-manager.tsx`·`submission-review.tsx`·`learning-view.tsx`·`class-controls.tsx`·`src/lib/learning.ts`), 학생 `src/app/me/learning/my-assignments.tsx`(바뀌지 않음 — 그대로 동작하는지). 지침 `build-class-assignments-instructions.md`, 보고 **`build-class-assignments-report.md`**. 바로 앞 ⑤ `20260927030000_content_owner_only.sql`(검토 끝 `docs/classes/review-owner-only.md`, 아직 실행 전)과 짝이다. 지금 실 DB 상태 = 마이그레이션 `20260921000000` ~ `20260927020000`까지 사용자가 실행함(⑤·⑥은 전).

## 확인할 것
1. **실행 오류 사냥(가장 중요)**: ⑤ 실행 뒤를 전제로 ⑥의 문장마다 — 문법, 표·열·함수·정책 이름(⑤의 정책 이름을 바이트까지), `alter table … add column … references … on delete restrict`, 채우기 `update`(서브쿼리·정렬·보관 학급 제외 조건), `alter column … set not null`(채우지 못한 행이 있으면 어떻게 되는지 — 오류 문구가 사용자에게 알아듣게 나오는지), 인덱스, `drop/create policy`, `grant`, `do $$` 블록(plpgsql·`pg_policies` 열 형·`%` 개수·`raise`), 배열 비교 모양(`= any (public.my_class_ids())` — `any ((select …))` 금지). 문장별 표로.
2. **점검 헛실패·헛통과**: 맨 앞 가드(⑤·①·④ 확인)가 ⑤ 실행 직후 DB에서 통과하는지, 맨 끝 점검(정책 조건 글자를 `position`으로 찾는 곳 — Postgres가 다시 그린 `qual`/`with_check` 모양, 예 `( SELECT my_student_class_id() AS my_student_class_id)`·`(published AND …)`)이 헛실패하지 않는지, 제출 정책 전제 점검(5-10)이 지금 제출 정책의 다시 그린 식에서 통과하는지.
3. **권한 결과 표**: 행위자 {비로그인, 부엉이반 학생, 다른 반 학생, 학급 없는 학생, 담임 T2(여우반), 학급 없는 교사, 총괄} × {자기 반 과제, 다른 반 과제, 비공개 과제, 자기가 만든 다른 반 과제} × {읽기, 만들기, 고치기, 지우기, 제출}. 학급을 바꾸는 길이 없는지, 다른 반 과제에 제출하는 길이 없는지(제출 정책이 과제 읽기 정책을 거치는지 — 42P17 재귀 없음), 과제를 지우면 그 반 제출물만 지워지는지(⑥ 전 다른 반 제출물 예외 — 보고서 설명 확인).
4. **채우기 데이터**: 지금 과제가 올바른 학급으로 가는지(만든 선생님의 보관 안 된 학급 → 없으면 총괄의 부엉이반), 만든 사람이 비어 있는 과제, 총괄이 여러 학급을 가질 때, 실행 뒤 확인 쿼리.
5. **화면**: 총괄·담임(학급 1개·2개)·학급 없는 교사로 과제 관리 — 새 과제 학급 고르기(자동·필수·없음 안내), 목록 학급 범위, 학급 이름 표시, "제출 N / M명"의 M, 제출 현황 명단(그 과제 학급 학생), 내 학급 과제가 아닐 때 안내, ⑤의 "쓴 선생님과 총괄만" 표시 유지, ⑥ 전(열 없음) 동작. 학생 '내 학습 활동' 과제가 그대로(학급 정보 없음). 44px·초점·어두움·375 폭.
6. **배포 순서**: ⑤만 / ⑤⑥(예전 화면 — 새 과제 저장이 not null로 실패하는 창) / 화면 먼저 — 각 상태, 사용자에게 안내할 순서.
7. `npm run lint`·`npx tsc --noEmit`(사본에서), 개인정보 없음, 되돌리기 주석이 맞는지(⑥ 되돌리기 → ⑤ 되돌리기 순서).

## 테스트 규칙(반드시)
* 판정·시험은 **커밋 `0d9d8e1` 사본**으로: `git archive 0d9d8e1`를 스크래치에 풀고 `node_modules`를 저장소 것에 링크해 **그 안에서** 빌드(가짜 Supabase 주소·키, 사본 설정에만 `turbopack: { root: "/" }`, 구글 글꼴은 `…/scratchpad/review-notice-pages/font-mocks.js`처럼 가짜 응답 — `docs/classes/review-links.md`·`review-notice-pages.md` 방식). 저장소 `out/`·`.next/`에 빌드하지 않는다.
* 시험 도구는 `…/scratchpad/class-assignments/`(Build 담당 것)를 **자기 폴더로 복사해서** 쓴다.
* 자기 정적 서버(포트 **8784**)·자기 headless Chrome(포트 **9355**, 프로필은 `/private/tmp/claude-501/-Users-sungchul-Desktop-classroom/7bf3a39e-3017-4189-b337-1b82aace66bb/scratchpad/review-class-assignments/` 안), `*.supabase.co` 차단, 첫 로드부터 CDP `Fetch` 가짜 응답, 캐시 끄기. 실제 Supabase·Gemini·외부 요청 금지, **SQL 실행·실 DB 접근 금지**, **아무것도 내려받거나 설치하지 않는다**.
* `localStorage.clear()` 금지, 다른 탭·프로세스·다른 포트(8788·8789·9353은 다른 작업) 건드리지 않기, git commit/push 금지. 저장소 파일은 보고서 하나만 새로 쓴다. 끝나면 서버·Chrome 종료.

## 보고서 `docs/classes/review-class-assignments.md`
심각도별 발견 표(파일:행, 무엇, 재현 또는 근거, 제안), 항목 1~7 판정(1은 문장별 표, 3은 권한 표), 확인하지 못한 것 — 한국어로 간결하게. 마지막 줄에 **"사용자에게 실행을 부탁해도 됨 / 고친 뒤"**와 까닭.
