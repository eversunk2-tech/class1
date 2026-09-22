# Build 보고: 관리자 "학생 응답" · 개별 피드백 · 일괄 칭찬

지침: `docs/admin/responses-build-instructions.md` · 설계: `docs/admin/responses-spec.md`(§12 확정 결정 우선). 커밋·푸시 안 함, 실제 DB에는 아무것도 쓰지 않음.

## 1. 변경 파일

### 신규
| 경로 | 역할 |
|---|---|
| `supabase/migrations/20260922020000_praise_presets.sql` | 칭찬 문구 테이블(관리자만 RLS 4개, anon 권한 없음, 500자 제약, 기본 6개 시드는 테이블이 비어 있을 때만) — **사용자가 실행** |
| `src/data/app-responses/types.ts`, `helpers.ts`, `index.ts` | 응답 매핑 타입 · 작성 도우미 · 레지스트리(앱 목록은 `science-curriculum.ts` 기준) |
| `src/data/app-responses/sci-6-1-*.ts` (12개) | 앱별 응답 매핑(질문 문구는 각 앱 `lesson-config.js`에서 그대로) |
| `src/lib/app-responses.ts` | 추출(우선순위 `detail.qa` → 매핑 → 원본 JSON), `detail.qa` 정규화, 단계 묶기, 진행률 계산 |
| `src/lib/praise.ts` | `praise_presets` CRUD(테이블 없으면 코드 기본 문구), `{이름}` 치환, 일괄 보내기(5개씩 동시, 1회 최대 50명, 부분 실패 수집) |
| `src/components/learning/response-panel.tsx` | `ResponsePanel`/`AnswerView` — 단계별 질문+답, 표·분류·선택(정답/시도), 원본 JSON 접기. 학생 입력은 텍스트 노드로만 |
| `src/app/admin/(dashboard)/learning/responses-view.tsx` | 학습 현황 › **학생 응답** 탭(학생별 · 질문별 보기, 카드 안 피드백 작성, 칭찬 보내기) |
| `src/components/admin/praise-dialog.tsx` | 일괄 칭찬 다이얼로그(대상 · 문구 · 확인 · 진행 · 결과/재시도) |
| `src/components/admin/praise-preset-manager.tsx` | 칭찬 문구 추가·수정·삭제(대시보드 버튼 + 칭찬 다이얼로그 안 "문구 편집") |

### 수정
| 경로 | 변경 |
|---|---|
| `src/app/admin/(dashboard)/learning/learning-view.tsx`, `page.tsx` | `?tab=responses&app=&view=student\|question&q=` 탭 추가 |
| `src/app/admin/(dashboard)/learning/app-results-view.tsx` | 앱을 고르면 "학생 응답 보기" 링크 |
| `src/components/learning/activity-panels.tsx` | 회원 상세 › 웹앱 결과 행마다 "응답 보기"(관리자 화면에서만, 학생 화면 제외 — Q6) |
| `src/lib/learning.ts` | `fetchAllAppResults`, `fetchAppProgressRows`(테이블 없으면 빈 목록), `fetchTeacherFeedbackCounts`("이미 보냄" 판정 — 클라이언트 조합 쿼리, Q7) |
| `scripts/templates/science-sim/{predict,quiz,conclude,curiosity,sorter}.js`, `README.md` | `qa(stage)` 접근자 추가(하위 호환 — 기존 `values()`/`result()` 그대로) |
| `scripts/templates/science-guide/{predict,quiz,conclude,curiosity,worksheet,share-prep}.js`, `README.md` | 같은 `qa(stage)` 추가(앞으로 만들 조사 도우미용. guide 앱 3개는 소급하지 않음) |
| `public/apps/sci-*/science-sim|science-guide/` (12개) | 정본 재복사(12개 모두 정본과 일치 확인) |
| `public/apps/sci-6-1-2-{3,4,5}/app.js` | `buildDetail()`에 `qa` 한 필드만 추가(기록 표 항목 포함). 저장 키 버전·다른 필드 그대로 |

## 2. 앱별 매핑 요약

| 앱 | 방식 | 버전(변형) | 비고 |
|---|---|---|---|
| sci-6-1-1-1 | 매핑 | 1 | 관찰 기록(방법 id→이름), 내 분류 기준, 분석, 분류 3라운드, 결론·발전 2, 궁금한 점. `skipped`(안전 안내)는 숨김 |
| sci-6-1-1-2 | 매핑 | 1 | 기록의 `indicator` 원본 id → 지시약 이름, 분류(산성/염기성), 분석 5 |
| sci-6-1-1-3 | 매핑 | 1 | 기록(이미 라벨), 분석 4 |
| sci-6-1-1-4 | 매핑 | 1 | 분석 id `readA/inferA/q1~q3` 그대로 |
| sci-6-1-1-5 (guide) | 매핑 | 1 | 도입 `answer/experience`, 조사 정리 표·예시와 다른 줄, 발표 대본·알게 된 점, 퀴즈 4 |
| sci-6-1-1-6 (guide) | 매핑 | 1 | 주제·고친 생각, 조사(1줄 표), 공유, 빈칸, 퀴즈(`quiz` 키), 서술형 `why`, 발전 질문 문자열 1개 |
| sci-6-1-2-1 | 매핑 | 1 | 장면 id→이름, 안전 약속 개수, 분석 `q0~q4` |
| sci-6-1-2-2 | 매핑 | 1 | 꽃 위치(정답 여부·틀린 횟수), 동적 키 `directions`/`countRetries`는 2열 표 |
| sci-6-1-2-3 | **qa** + 매핑 | 3 (v4 / v2·v3 / v1) | 새 결과는 `detail.qa`. 예전 결과는 git 이력의 모양별로 문구까지 따로 매핑. 분석 1은 "자기 기록 채점" 주석 |
| sci-6-1-2-4 | **qa** + 매핑 | 3 (v4 `times` / v3 `averages` / v1 50·100·150 cm) | 분석 1은 자기 기록 채점 주석 |
| sci-6-1-2-5 | **qa** + 매핑 | 2 (v3·v4 / v1 교통수단·순서) | 속력은 저장 전 반올림 값이라는 주석 |
| sci-6-1-2-6 (guide) | 매핑 | 1 | 안전 수칙·안전장치·설치 위치 차이 표, 발표 확인 목록, 퀴즈 3(`quiz` 키) |

- 매핑이 다루지 않은 최상위 키가 새로 생기면 "그 밖의 저장 값"으로 자동 표시되고, 모양을 모르는 앱은 원본 JSON으로 보인다(데이터가 묻히지 않음). 모든 카드에 "원본 데이터 보기"(접기)가 있다.
- 12개 모두 config의 예상·분석·정리·궁금한 점 질문 문구가 매핑에 글자 그대로 들어 있는지, 단계 id가 config와 같은지 스크립트로 확인했다.

## 3. 확인한 것

- `npm run lint`(경고 0), `tsc --noEmit`, `npm run build` 통과. 모든 앱 JS·틀 JS `node --check` 통과. 틀 사본 12개 = 정본.
- **가짜 Supabase**: 내 전용 headless Chrome(별도 프로필·포트)에서 `*.supabase.co` 요청을 전부 CDP로 가로채 메모리 mock이 응답(실제 서버로 나간 요청 0, 실시간 WebSocket 차단). 빌드한 `out/`을 로컬로 띄워 확인.
  - 12개 앱 × 학생 8명(완료/예전 버전/진행 중/다시 하는 중/시작 안 함/이미 칭찬 받음/실패 대상) — 학생별 보기 모두 렌더링, 오류 없음.
  - 2단원 탐구 3의 qa·v4·v3·v1 결과가 한 화면에서 각각 맞는 방식으로 정리됨.
  - XSS: 답의 `<img src=x onerror=alert(1)>`, 이름 `윤<b>태그</b>`, 피드백·문구의 태그가 모두 글자로만 보이고 DOM에 요소가 생기지 않음.
  - 진행 중: "실험하기 (2/4단계) · 마지막 저장 …"만 보이고 진행 중 입력 내용은 보이지 않음(§12).
  - 카드 안 피드백 작성 → `app_result` 스레드로 저장·표시, "피드백 보냄" 배지 갱신.
  - 질문별 보기: 질문 선택(URL `q=` 유지), 보기별 선택 인원·정답 수, 학생별 답 표.
  - 일괄 칭찬: 완료 학생만 대상, 이미 보낸 학생 "이미 보냄" + 기본 해제, 전체/안 보낸 학생만/모두 해제, 미리보기 이름 치환, 확인 단계(인원 수·재전송 경고), 진행 표시, 부분 실패 보고와 "실패한 학생 다시 보내기", 저장된 본문에 `{이름}` 남지 않음, 이미 칭찬 받은 학생 중복 전송 없음.
  - 테이블 없음: "SQL 실행 필요" 안내 + 코드 기본 문구로 전송 가능, 편집 버튼 숨김. 테이블 있음: 문구 추가·수정·삭제 확인.
  - 회원 상세 › 웹앱 결과 "응답 보기" 펼침.
  - 375px(라이트·다크), 태블릿 768px, 데스크톱 다크: 가로 넘침 0, 콘솔 오류 0.
- **탐구 3·4·5 앱 전체 흐름 회귀**(가짜 학생 로그인, 예상 → 실험 → 분석 → 정리 → 마치기): 3개 모두 통과. 저장된 `details`의 기존 키는 HEAD와 똑같고 `qa`만 늘었다. `qa` 항목은 `{stage, id, label, question, kind, answer}` — 질문 문구가 config와 같고, 퀴즈는 라벨·정답 여부·시도 횟수, 기록 표는 열+값(예: 빨강 135.0 / 파랑 122.0 cm)이 들어 있다. `app_progress` 동기화는 mock으로만 갔고, 앱 콘솔 오류는 없었다.

## 4. 못 한 것 · 한계

- 실제 Supabase에서의 확인(RLS 실제 동작, 실제 학생 데이터)은 하지 않았다(실 DB 쓰기 금지). RLS는 기존 정책을 그대로 쓴다: 관리자만 `app_results`·`app_progress`·`feedback_*` 전체 조회, 칭찬 메시지는 기존 `get_or_create_feedback_thread`와 insert 정책을 쓴다.
- 1단원·2단원 1·2·6 앱의 예전 결과는 코드를 보고 재구성한 샘플로 확인했다(실제 앱을 끝까지 해 보지는 않음). 이 앱들은 git 이력 내내 `buildDetail` 모양이 같았다.
- 질문별 보기에서 버전이 다른 결과가 섞이면 같은 키(예: `analyze:q1`)는 처음 나온 질문 문구로 묶인다(탐구 3·4·5의 개정 전 결과가 실제로 있을 때만 해당).
- 실험 앱 정리하기는 '제출' 전 초안이 저장될 수 있다(공통 틀 동작). `detail.qa`는 `submitted`를 함께 저장해 화면에 "제출하기 전 입력 중이던 글"로 표시하지만, 예전 결과에는 이 정보가 없다.
- "이미 보냄"은 칭찬뿐 아니라 그 결과에 선생님이 보낸 어떤 피드백이든 포함한다(표시만 하고 막지는 않음).

## 5. 사용자가 할 일

1. Supabase 대시보드 › SQL Editor에서 `supabase/migrations/20260922020000_praise_presets.sql` 전체를 실행하고, 파일 머리의 확인 쿼리로 정책 4개와 기본 문구 6개를 확인한다. 실행 전에도 화면은 동작한다("SQL 실행 필요" 안내 + 기본 문구로 전송 가능, 편집만 불가).
2. 관리자로 로그인해 `/admin/learning/?tab=responses`에서 실제 결과를 한 번 훑어본다. 특히 이미 수업에서 쓴 1단원 앱의 실제 저장값이 질문과 맞게 보이는지 본다.
3. 칭찬 문구가 학급에 맞는지 보고 "칭찬 문구 관리"에서 고친다.
4. 확인 후 커밋·배포한다(`public/apps/sci-6-1-2-{3,4,5}/app.js`와 틀 사본 12개 변경 포함).
