# Build 서브에이전트 지침: 과학 시뮬레이션 공통 틀 + 시범 앱 sci-6-1-1-2

## 목표
1. 공통 틀 `scripts/templates/science-sim/`을 만든다(spec §6).
2. 공통 틀을 복사해 시범 앱 `public/apps/sci-6-1-1-2/`를 완성한다(spec §1~5, **확정 결정 절 우선**).
3. `scripts/templates/class1-record.js`를 앱 폴더로 복사해 로그인 학생의 결과 저장을 연결한다.
Embed(차시 화면 버튼 연결)는 이번 범위가 아니다(Review 후 별도 진행).

## 반드시 먼저 읽을 것
* `CLAUDE.md` — **웹앱 규칙**과 **과학 차시 앱 규칙** 전체. 모든 항목을 지킨다.
* `public/apps/sci-6-1-1-2/spec.md` 전체.
* `scripts/templates/class1-record.js`(사용법 주석), `src/lib/supabase.ts`(세션 storage key 일치 확인).

## 핵심 요구 (규칙 재확인)
* 단계: 예상하기 → 실험하기 → 기록·분석하기 → 정리하기 → 더 탐구하고 싶은 점. 언제든 앞 단계로 이동·실험 다시 하기. localStorage 임시 저장(모든 접근 try/catch).
* 예상하기: 답 미리 제시 금지, 직접 타이핑, 힌트 버튼(단계적, 답 누설 금지).
* 실험하기: three.js(CDN, 정확한 버전 + SRI, `crossorigin`) 3D 장면, OrbitControls 드래그/핀치(터치) 회전·확대, 조작 애니메이션, 측정마다 **기록** 버튼. 실험 A 완료 후 B 잠금 해제.
* 기록·분석하기: 기록으로 표(와 의미 있으면 그래프) 자동 생성, 보기 고르기 분석 + 피드백.
* 정리하기: 결론 직접 작성 → 제출 후 모범 답안 비교, 발전 질문 답 작성 → 제출 후 모범 답안.
* **과학적 정확성**: spec §4 체크리스트의 값만 사용(특히 붉은 양배추 + 묽은 수산화 나트륨 용액 = 노란색). pH·중성·중화 언급 금지. 단순화한 표현은 "모형" 표시.
* WebGL 불가 시 2D 대체 화면으로 끝까지 진행 가능.
* 태블릿 우선(가로·세로), 휴대폰도 사용 가능, 큰 터치 영역, 6학년 눈높이 한국어, 다크모드는 선택(시스템 설정 따르되 3D 배경 대비 확보).
* 모든 파일 참조는 상대경로. 외부 라이브러리는 three.js(+OrbitControls), supabase-js만(CDN).
* 블로그로 돌아가기 링크(`../../science/?term=6-1&unit=1&lesson=3`).
* 완료 시 로그인 학생이면 `Class1Record.save`로 결과 저장(spec §5의 detail 구조). 비로그인이어도 끝까지 사용 가능, 저장 안 됨 안내만.

## 수정 범위
* 작성 가능: `scripts/templates/science-sim/**`(신규), `public/apps/sci-6-1-1-2/**`(단, `spec.md`·`plan-instructions.md`·`build-instructions.md`는 수정 금지).
* 그 외 수정 금지(`src/**`, `CLAUDE.md`, `supabase/**` 등). git commit/push 금지. 실 DB 쓰기 금지(로그인 테스트 불가 — 저장 로직은 코드 검토와 가짜 응답으로 확인).

## 검증
* 개발 서버 `http://localhost:3000/class1/apps/sci-6-1-1-2/`(Next dev가 public을 서빙) 또는 정적 서버로 열어 브라우저에서 전체 흐름을 끝까지 진행: 태블릿(768×1024 세로, 1024×768 가로), 휴대폰 375px, 드래그 회전, 기록 → 표, 분석, 정리, 새로고침 후 복원, 앞 단계 이동, WebGL 비활성 대체 화면. 콘솔 오류 0.
* `npm run build` 통과(앱이 `out/class1/apps/...`가 아닌 `out/apps/sci-6-1-1-2/`에 복사되는지 확인).

## 완료 보고
`public/apps/sci-6-1-1-2/build-report.md`: 파일 목록, 공통 틀 사용법(새 차시 앱 만드는 절차), spec과 다른 점, 확인한 것/못 한 것.
