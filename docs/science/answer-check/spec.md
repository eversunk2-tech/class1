# spec.md — 학생 답 되짚어 주기 (1안 규칙 + 2안 Gemini API)

> Plan 단계 산출물. **구현하지 않음.** 코드·DB·git·브라우저를 건드리지 않고 `docs/science/answer-check/plan-instructions.md`의 요구만 정리했다.
> 공통 틀(`scripts/templates/science-sim/{predict,conclude,persist}.js`, `scripts/templates/science-guide/README.md`), 앱 예시 3개(`sci-6-1-1-2`, `sci-6-1-2-3`, `sci-6-2-1-5`), 저장 헬퍼(`scripts/templates/class1-record.js`), 기존 Edge Function(`supabase/functions/admin-reset-password/`), 응답 설계(`docs/admin/responses-spec.md`), 진행 현황(`docs/STATUS.md`)를 읽고 작성했다.
>
> **개정(2026-09-23, 사용자 요구 추가 반영)**: "한 번 권유하고 그대로 넘어간다"만으로는 **무의미한 답**(자모만·반복·자판 뭉개기 등)이나 **글자 수는 채웠지만 주제와 전혀 무관한 답**("집에 가고 싶다" 등)까지 통과시키게 된다. 이런 두 경우는 **한 번 되짚은 뒤에도 계속 막아야** 한다는 요구가 추가되어, 판정을 **ok / rethink(되짚고 통과 허용) / block(막음)** 3단계로 다시 설계했다(§1·§2). 그 밖의 기존 설계(저장 구조 불변, 1안 우선·Gemini 보조, 실패 시 자동 전환 등)는 그대로 유지한다.

---

## 0. 요약(한눈에 보기)

| | 내용 |
|---|---|
| 판정 3단계 | **ok**(통과) · **rethink**(내용이 아쉬움 — 한 번 되짚고 "그대로 제출"도 허용) · **block**(무의미하거나 주제와 전혀 무관 — 다시 쓰기 전엔 못 넘어감). |
| 누가 block을 정하나 | **로컬 규칙은 "확실한 무의미"만** block으로 정한다(자모만·같은 글자 반복·자판 뭉개기·질문 복사·숫자만 — §1.1). **주제와 관련 있는지(off-topic) 판단은 전부 Gemini의 일**이다(§1.3). 로컬 규칙은 off-topic을 block으로 정하지 않는다. |
| 오답 처리 | 질문과는 관련 있지만 **틀리거나 부족한 답**은 절대 block하지 않는다 — rethink로 한 번만 되짚고, 그다음엔(또는 "그대로 제출"을 누르면) 항상 통과시킨다(예상하기 단계는 원래 오답이 있을 수 있는 활동). |
| Gemini 장애 시 | **오프라인·시간 초과·오류·한도 초과일 때는 절대 block하지 않는다.** 그 순간 block으로 이어질 뻔한 판단은 rethink 수준(1안의 중립 메시지)으로 내려가고, 한 번 보여 준 뒤엔 통과시킨다. block은 오직 로컬의 "확실한 무의미" 규칙만으로 확정된다. |
| 막혔을 때 | 쉬운 말로 "왜 다시 써야 하는지"만 알려 주고(정답은 안 줌), 입력은 지우지 않는다. 같은 질문에서 **3번째로 막히면** "🙋 선생님과 확인했어요 · 계속하기" 버튼이 나타나 학생이 갇히지 않게 한다(§5.3). |
| 오탐 점검 | Edge Function이 학생 식별 정보 없이 `{appId, stage, verdict}`만 서버 로그로 남기고(§2.3), 완료된 결과에는 `detail.qa[].blockCount`·`teacherOverride`를 저장해(§3) 나중에 규칙·프롬프트를 손볼 근거로 쓴다(§4). |
| DB 변경 | 없음(§7). |
| Edge Function | `supabase/functions/check-answer/`(신설). Verify JWT ON, service_role 불필요, 시크릿은 `GEMINI_API_KEY` 하나. |
| 대상 | 원칙은 23개 전부지만 1학기 "수정 금지"·"그대로 둠" 앱과 충돌 — §9 Q1에 추천안. |

---

## 1. 1안 — 앱 안 규칙 검사

### 1.1 로컬이 즉시 block으로 정하는 경우(확실한 무의미, 설정 없이 모든 앱에 적용)

`minLength`(이미 각 앱이 씀, 보통 5~10자)를 통과한 뒤에 검사한다. **이 표에 걸리면 Gemini를 부르지 않고 바로 block한다** — 오탐 위험이 사실상 없는(사람이 다시 봐도 명백한) 경우만 골랐기 때문에, Gemini 없이도 안전하게 막을 수 있다.

| 유형 | 판정 방법 | block 문구 예시(정답은 안 줌) |
|---|---|---|
| 자음·모음만 | `trim()` 후 전체가 `/^[ㄱ-ㅎㅏ-ㅣ\s]+$/`(완성형 글자 없이 낱자만) | "🚫 자음이나 모음만 적었어요. 완성된 문장으로 다시 써 볼까요?" |
| 같은 글자 반복 | 공백 제거 후 서로 다른 글자 종류가 **2가지 이하**이거나, `/(.)\1{4,}/`(같은 글자 5번 이상 연속)에 매치 | "🚫 같은 글자를 반복해서 적었어요. 내 생각을 문장으로 써 볼까요?" |
| 숫자만 | `/^[\d\s.,%]+$/` | "🚫 숫자만 적었어요. 그렇게 생각한 까닭을 문장으로 써 볼까요?" |
| 질문 그대로 복사 | 학생 답에서 공백·문장부호를 지운 문자열이 질문 문구(공백·문장부호 제거)의 **60% 이상을 연속으로 포함** | "🚫 질문을 그대로 옮겨 적었어요. 내 생각을 나만의 말로 써 볼까요?" |
| 자판 뭉개기 | 완성형 한글 글자가 **하나도 없고** 영문 비율이 70% 이상(예: `asdfasdf`) | "🚫 알아볼 수 있는 말로 다시 써 볼까요?" |

구현: 새 공용 모듈 `answer-check.js`의 `Rules.block(text, question)` 함수. **이 표는 lesson-config 없이도 23개 앱 전부에 그대로 적용 가능**하다.

> **주의**: "짧지만 성의 있어 보이는 답"(예: "네", "몰라요", "좋아요")이나 **"글자 수는 충분한데 주제와 무관한 답"**(예: "집에 가고 싶다")은 이 표에 **걸리지 않는다** — 문장 자체는 멀쩡한 한글이라 로컬 규칙으로는 무의미와 구분할 수 없다. 이런 경우는 block 후보가 아니라 **전부 Gemini에게 넘긴다**(1.3절). 로컬 규칙은 절대 "주제와 무관함"을 이유로 block을 정하지 않는다(요구사항: 오탐·오차단 위험이 있는 판단은 의미를 이해하는 쪽이 맡는다).

### 1.2 차시별 "정오"는 새 데이터를 만들지 않는다

- **예상하기(predict)**: `predict.questions[i].text`(질문 문구)만 있으면 된다. 모범 답안이 없는 단계이므로(정답 금지) "얼마나 정확한지"가 아니라 **"이 질문에 대한 반응으로 말이 되는지·주제와 관련 있는지"만** Gemini가 판단한다(1.3절) — 차시별 설정이 필요 없다.
- **정리하기(conclude)**: 각 문항은 이미 `model`(모범 답안 문단)을 갖고 있다. 학생 답이 이 모범 답안의 핵심을 담고 있는지 비교하는 일을 **Gemini에게 그대로 시킨다**(질문 + model + 학생 답을 함께 보낸다). 오개념이 뚜렷한 차시는 이미 있는 `misconceptionCard.text`나 `compareTip`을 프롬프트 힌트로 얹는다.

**선택 최적화(옵션, 앱 config 무변경으로도 가능)**: conclude 단계에서 `model` 문자열의 2글자 이상 낱말 중 하나라도 학생 답에 그대로 들어 있으면, 그 즉시 로컬이 "ok"로 보고 **Gemini 호출을 건너뛴다**(§2.1). 이건 block 판정이 아니라 "명백히 괜찮아 보이니 굳이 물어볼 필요 없음"이라는 통과 지름길일 뿐이라 안전하다(잘못 걸려도 최악의 경우 Gemini를 한 번 덜 부르고 통과시키는 것뿐 — 오탐·오차단과 무관). predict는 `model`이 없어 이 지름길을 쓸 수 없다(대개 질문이 1개뿐이라 영향도 작다).

### 1.3 "Gemini에게 넘기는 경우" — off-topic·정오 판단은 전부 여기서

1.1의 block 후보가 **아니고**, 1.2의 통과 지름길에도 걸리지 않는 **모든 답**은 Gemini에게 보낸다(§2). 즉 "애매할 때만 가끔 부른다"가 아니라 **"명백히 무의미하지 않은 답은 거의 다" Gemini가 최종 판단한다** — off-topic 여부(예: "집에 가고 싶다")는 문장만 봐서는 로컬이 구분할 수 없기 때문이다. 대신:

- 질문 하나당 **rethink는 평생 1번**만 되짚고 그 뒤로는 항상 통과(§2.1).
- **block은 Gemini가 확신할 때만** 내리도록 프롬프트에서 강하게 제한한다(§2.3 프롬프트 — "명백할 때만 block, 조금이라도 관련지을 여지가 있으면 rethink").
- Gemini가 응답하지 못하면(오프라인·시간 초과·오류·한도 초과) **block으로 이어지지 않는다** — 그 판단은 rethink 수준(1안의 중립 메시지)으로 강등된다(§2.1). block은 오직 1.1의 로컬 규칙만으로 확정된다.
- 오탐(맞는데 다시 쓰라고 함)을 줄이는 방법: (a) block 후보는 애초에 사람이 봐도 명백한 것만(§1.1), (b) Gemini 프롬프트가 "조금이라도 관련 있으면 rethink, block은 명백할 때만"이라고 명시(§2.3), (c) rethink는 평생 1번만 뜨고 이후 항상 통과, (d) block이라도 같은 질문에서 3번째부터는 교사 확인 후 통과 버튼이 나타난다(§5.3), (e) Gemini 장애 시 자동으로 block이 해제된다(위).

---

## 2. 2안 — Gemini API

### 2.1 전체 흐름(3단계 판정 + 장애 시 fail-safe)

```
학생이 "제출"/"다음" 시도 (minLength는 이미 통과)
  │
  ├─ 로컬 block 후보(§1.1: 자모만·반복·자판뭉개기·질문복사·숫자만)?
  │     → YES: Gemini 호출 안 함. 즉시 **block**. "그대로 제출" 버튼 없음. 다시 쓸 때마다 재검사(1회 제한 없음).
  │
  ├─ (conclude만) model 낱말이 답에 이미 들어 있음?
  │     → YES: Gemini 호출 안 함. 즉시 **ok**(통과).
  │
  └─ 그 밖의 모든 경우 → Gemini 호출(최대 3.5초, offline이면 아예 시도 안 함)
        ├─ 응답 "ok"      → 통과(호출한 사실도 학생에게 드러내지 않음)
        ├─ 응답 "rethink" → **되짚기(rethink) 카드**: 이 질문에서 평생 처음이면 카드 표시,
        │                    "다시 써 볼게요" / "그대로 제출할게요" 둘 다 가능. 카드를 본 순간 이 질문은
        │                    `nudged = true`로 저장 → 이후 재검사 없이 항상 통과.
        ├─ 응답 "block"   → **차단(block) 카드**: "그대로 제출" 버튼 없음, "다시 써 볼게요"만.
        │                    같은 질문에서 block이 3번째면 "🙋 선생님과 확인했어요 · 계속하기" 버튼도 함께 보임(§5.3).
        │                    `nudged`(평생 1회) 규칙은 block에는 적용하지 않는다 — 다시 제출할 때마다 다시 판정한다.
        └─ 실패·시간초과(3.5s)·오프라인·한도초과(429 등)
              → **block으로 만들지 않는다.** 1안의 중립 메시지("다시 한번 생각해서 써 볼까요?")로
                rethink처럼 처리한다(평생 1회, "그대로 제출" 가능). 학생에게 오류라고 알리지 않는다.
```

한 질문에 대해 이 흐름은 "rethink"가 뜨는 순간부터는 다시 돌지 않는다(항상 통과). **block은 그 규칙에서 예외**라서, 학생이 계속 무의미하거나 완전히 무관한 답을 내면 계속 막힌다 — 대신 3번째부터 교사 확인 버튼으로 빠져나갈 길을 열어 둔다(§5.3).

### 2.2 모델 선택(무료 등급)

Google이 공개한 요금·한도 문서(https://ai.google.dev/gemini-api/docs/rate-limits)는 정확한 숫자를 문서에 박아 두지 않고 "AI Studio에서 직접 확인"하라고 안내한다(계정·시점마다 달라질 수 있음). 3rd-party 정리 글 다수([TinkerLLM](https://tinkerllm.com/blog/gemini-api-free-tier-limits-rate-quotas/), [AIPromptsHub](https://aipromptshub.co/blog/gemini-api-free-tier-rate-limits), [AIFreeAPI](https://www.aifreeapi.com/en/posts/gemini-api-free-tier-rate-limits))를 종합하면 2026-09 기준:

- **무료로 쓸 수 있는 건 Flash·Flash-Lite 계열뿐**(Pro는 2026-04부터 무료 등급 제외).
- Flash-Lite 계열이 Flash보다 분당·일일 한도가 넉넉하다(대략 RPM 15~30, RPD 500~1,500 수준 — 출처마다 다르고 실제 값은 배포 시점 AI Studio에서 다시 확인해야 한다).
- **모델 이름은 자주 바뀐다**(2.5/3/3.1/3.5 Flash·Flash-Lite가 동시에 나열됨). 특정 버전을 코드에 고정하지 않고, Google이 제공하는 **별칭 `gemini-flash-lite-latest`**(항상 최신 안정 Flash-Lite로 자동 연결)를 쓰는 것을 추천한다.

**추천: `gemini-flash-lite-latest`**. **사용자가 배포 직전 AI Studio(https://aistudio.google.com/rate-limit)에서 실제 RPM/RPD를 한 번 확인**하도록 §6에 안내한다.

### 2.3 Edge Function 설계 — `check-answer`

`supabase/functions/check-answer/index.ts`(신설). `admin-reset-password`와 달리 service_role key도, profiles 조회도 필요 없다(관리자 확인이 필요한 기능이 아니라 훨씬 가볍다). Verify JWT를 켜면 게이트웨이가 로그인하지 않은 요청을 이미 막아 주므로, 함수는 로그인 여부를 다시 확인하지 않고 바로 Gemini를 호출한다.

**요청**
```
POST /functions/v1/check-answer
Authorization: Bearer <학생 access token>   (supabase-js가 자동 첨부, 게이트웨이가 검증)
Content-Type: application/json

{
  "appId": "sci-6-2-1-5",
  "stage": "predict" | "conclude",
  "question": "지구가 태양 주위를 공전할 때 … 내 생각을 적어 봅시다.",  // 최대 300자, lesson-config.js의 공개 문구
  "answer": "학생이 쓴 답",              // 최대 500자(함수 안에서 자름)
  "model": "계절의 변화가 생기는 까닭은 …", // conclude만: 이미 있는 conclude[].model. predict는 생략.
  "hint": "거리·가까워·멀어서 오개념 주의", // 선택: misconceptionCard.text/compareTip에서 뽑은 한두 문장
  "priorBlocks": 0                        // 이 질문에서 이미 block당한 횟수(0~2, 프롬프트 톤 조절용 — 선택)
}
```

**응답 200**
```json
{ "ok": true, "verdict": "ok", "message": "" }
```
```json
{ "ok": true, "verdict": "rethink", "message": "그림자 길이가 어떻게 달라졌는지 다시 한번 떠올려 볼까요? 두 조건을 비교해서 써 보면 좋아요." }
```
```json
{ "ok": true, "verdict": "block", "message": "지금은 '그림자 길이와 자전축 기울기'에 대한 내 생각을 적는 시간이에요. 질문과 관련된 내용으로 다시 써 볼까요?" }
```

**응답 실패**(클라이언트는 항상 §2.1의 fail-safe로 조용히 전환)
```json
{ "ok": false, "reason": "invalid" | "rate_limited" | "upstream_error" | "timeout" }
```

**검증(함수 안)**: `appId`는 `app_progress_app_id_format`과 같은 정규식(`^sci-[0-9]{1,2}-[0-9]-[0-9]{1,2}-[0-9]{1,2}$`), `stage`는 enum, `question`/`answer`/`model`/`hint` 길이 상한, `priorBlocks`는 0~2 정수, 아니면 400. 이 이상의 신원 확인은 게이트웨이(Verify JWT)에 맡긴다.

**개인정보**: 요청에 이름·학번·이메일·user id를 전혀 넣지 않는다. `question`·`model`·`hint`는 이미 브라우저에 공개로 내려가는 `lesson-config.js` 내용이라 개인정보가 아니다(§9 Q2에서 이유를 더 설명).

**프롬프트 초안(한국어, 3단계 판정)**
```
당신은 초등학교 6학년 과학 수업을 돕는 채점 도우미입니다. 학생이 스스로 적은 답을 보고 세 가지 중 하나로 판정하세요.

- "ok": 답이 질문과 관련 있고 그런대로 말이 됩니다(완벽하지 않아도 괜찮음). 예) 질문 "계절의 변화가 생기는 까닭을 설명해 봅시다"에
  "지구가 기울어져서 태양 빛을 받는 정도가 달라지기 때문이다" → ok(표현이 다소 부족해도 핵심을 담았으면 ok).
- "rethink": 질문과는 관련 있지만 내용이 틀렸거나 중요한 부분이 빠졌습니다. 예) 같은 질문에 "지구가 태양과 가까워지고 멀어져서 계절이
  바뀐다" → 방향은 맞지만(계절 변화의 원인을 물음) 내용이 틀렸으므로 rethink. **정답을 알려주지 말고** 다시 생각해 볼 부분만 짧게 안내하세요.
- "block": 답이 질문과 **전혀 관련이 없거나** 무슨 뜻인지 알 수 없습니다. 예) 같은 질문에 "집에 가고 싶다", "오늘 급식 뭐예요",
  뜻을 알 수 없는 나열 → block. **block은 명백할 때만 고르세요.** 조금이라도 질문과 관련 지어 볼 여지가 있으면 rethink를 고르세요
  (관련이 있는지 애매하면 절대 block이 아니라 rethink입니다 — 학생을 부당하게 막지 않는 것이 더 중요합니다).

- message는 rethink·block일 때만 채우고 ok일 때는 빈 문자열로 둡니다.
- 두 문장 이내, 초등학교 6학년이 이해할 쉬운 한국어, 격려하는 말투로 쓰세요.
- block의 message에는 이 질문이 무엇을 묻는지에 대한 짧은 힌트만 담고(질문의 핵심 낱말 정도), 정답이나 채점 결과를 알려주지 마세요.
- 이 학생은 이 질문에서 이미 {priorBlocks}번 block 판정을 받았습니다. 그렇다고 더 쉽게 통과시키지는 말되, message 말투는 더 다정하게 하세요.

[질문] {question}
[학생 답] {answer}
[참고: 모범 답안(학생에게는 절대 그대로 보여주지 마세요)] {model 또는 "없음(예상하기 단계라 정답 없음)"}
[참고: 주의할 오개념] {hint 또는 "없음"}
```
구조화 출력(Gemini `generationConfig.responseSchema`)으로 `{ verdict: "ok"|"rethink"|"block", message: string }`를 강제해 파싱 오류를 없앤다.

**시간·재시도**: 함수 안에서 Gemini 호출에 `AbortController`로 3초 타임아웃, 클라이언트는 전체 요청에 3.5초 타임아웃(레이스, `persist.js`의 `withTimeout` 패턴 재사용). 재시도는 하지 않는다(7분 기준 유지, 실패 시 즉시 §2.1의 fail-safe로 전환).

**로깅(오탐 점검용, §4)**: 함수는 매 호출 끝에 학생 식별 정보 없이 `console.log(JSON.stringify({ appId, stage, verdict, priorBlocks }))` 한 줄만 남긴다(답 내용·user id 없음). Supabase 대시보드 **Edge Functions → Logs**에서 검색해 "block이 유독 많은 차시/질문"을 나중에 확인할 수 있다.

**호출 제한**: 정밀한 사람별·분당 제한 테이블은 v1에 두지 않는다(§7·§9 Q3). ⓐ rethink 이후엔 그 질문에서 다시 호출하지 않고 ⓑ block도 3번째부터는 교사 확인으로 더는 호출하지 않게 되며 ⓒ 로컬이 확실한 무의미는 아예 안 부르므로, 자연스러운 상한이 있다. Google 쪽 429는 §2.1의 fail-safe로 흡수된다.

**비용·한도 추정(한 반 25명 기준, 개정)**: §1.3에서 정했듯 Gemini는 "명백히 무의미하지 않은 답 거의 전부"에서 불린다(기존 "애매할 때만"보다 호출량이 늘었다 — off-topic 판단을 문장만 보고 로컬이 걸러낼 수 없기 때문). 새 기준 앱은 정리하기가 결론 1문항뿐이라(발전 질문 없음, CLAUDE.md 규칙) 학생당 predict 1~2회 + conclude 1회 ≈ **2~3회/학생**, 반 전체 **50~75회/앱**. 일일 한도(RPD 500~1,500대)에는 여유가 있다. 분당 한도(RPM 15~30)는 "다 같이 제출"하는 순간 넘을 수 있으나, 그 순간엔 §2.1의 fail-safe(절대 block하지 않음, rethink 수준으로 강등)로 흡수되어 수업이 멈추지 않는다.

---

## 3. 저장 구조 — 바꾸지 않는다

`app_progress.state`·`app_results.detail`/`detail.qa`·저장 키(`:vN`)는 그대로 둔다.

- `predict`/`conclude`의 각 질문·항목에 **선택 필드 3개만 추가**한다(둘 다 기존 값 구조를 안 바꾸는 additive 필드):
  - `nudged: boolean` — rethink 카드를 한 번이라도 보여 줬는지(§2.1 "평생 1회" 판단용).
  - `blockCount: number`(기본 0) — 이 질문에서 block당한 누적 횟수(3번째부터 교사 확인 버튼을 보여 줄 때, 그리고 §4 오탐 점검에 사용).
  - `teacherOverride: boolean`(기본 false) — "🙋 선생님과 확인했어요 · 계속하기"로 통과했는지.
- `detail.qa[]` 항목(`docs/admin/responses-spec.md` §3.3)에도 같은 세 필드를 선택으로 추가한다: `{ stage, id, label, question, kind, answer, submitted?, nudged?, blockCount?, teacherOverride? }`. 기존 소비자(관리자 응답 화면)는 모르는 필드를 무시하므로 깨지지 않는다.
- **버전을 올리지 않는다** → 학생 진행 기록이 리셋되지 않는다.

---

## 4. 관리자 쪽 영향 · 오탐 점검

되짚기·차단이 실제로 잘 작동하는지(특히 **block 오탐** — 맞는 답인데 막히는 경우)를 나중에 점검할 수 있어야 한다는 요구가 있어, 이번 설계에 최소 장치를 넣는다.

1. **완료된 학생**: `app_results.details.qa[i].blockCount`·`teacherOverride`가 그대로 저장된다(§3, DB 변경 없음). `blockCount`가 1 이상이거나 `teacherOverride`가 true인 항목이 특정 질문에서 여러 학생에게 반복되면 "이 질문의 로컬 규칙 또는 Gemini 프롬프트가 과하게 막는다"는 신호다.
2. **서버 로그**: Edge Function이 `{appId, stage, verdict, priorBlocks}`만(학생 식별 정보 없이) 남긴다(§2.3). Supabase 대시보드 **Edge Functions → Logs**에서 기간별로 verdict 분포를 눈으로 확인할 수 있다 — 별도 집계 테이블 없이 v1 범위에서 충분하다고 본다.
3. **진행 중(미완료) 학생**: `app_progress.state`에도 같은 필드가 들어가지만, `docs/admin/responses-spec.md` §11 Q3에서 이미 "진행 중 상태는 필드별 표시 없이 진행률만 보여준다"로 정해 두었으므로 이번에도 그 범위를 넘지 않는다 — block에 갇혀 있는 학생을 관리자 화면에서 실시간으로 찾는 기능은 **1차 범위 밖**(§9 Q7).
4. **관리자 대시보드 화면 자체는 이번에 건드리지 않는다**(§9 Q6, 기존 결정 유지) — 저장 필드만 만들어 두면 이후 "학생 응답" 화면에 "🔁 되짚기 N회 / 🚫 차단 N회" 배지를 다는 건 작은 후속 작업으로 남긴다.

---

## 5. 화면·흐름

### 5.1 예상하기(predict)

- 지금은 "다음" 버튼이 `predict.isDone()`(글자 수 채움)만 확인하면 바로 다음 단계로 넘어간다.
- **바뀌는 점**: `lesson.js`의 `nav()` gate가 **Promise를 반환해도 되도록** 최소 확장한다(반환값이 Promise가 아니면 지금처럼 즉시 처리 — 하위 호환). `predict.js`에 새 메서드 `checkPass()`를 추가한다:
  1. `isDone()`이 아니면 지금처럼 즉시 문자열(막는 까닭) 반환.
  2. 아직 확정되지 않은 질문(§2.1 흐름을 아직 안 돈 질문, 또는 이전에 block이었던 질문)을 검사한다.
  3. **ok** → 통과.
  4. **rethink**이고 이 질문에서 처음이면 rethink 카드(§5.3-A) 표시, 버튼 선택을 기다린 뒤 resolve. 이미 `nudged`면 검사 자체를 건너뛰고 통과.
  5. **block**이면 block 카드(§5.3-B) 표시, "다시 써 볼게요"만 누를 수 있다(3번째부터 교사 확인 버튼 추가). 학생이 고치고 다시 "다음"을 누르면 §2.1 흐름을 처음부터 다시 돈다(로컬 block 후보가 아니게 됐으면 다시 Gemini에게 감).
  6. 앱은 `gates: { experiment: () => predict.checkPass() }`처럼 기존 gate 자리에 끼워 넣기만 하면 된다. `answerCheck`를 켜지 않은 앱은 `checkPass()`가 항상 즉시 `true`(동작 그대로).

### 5.2 정리하기(conclude)

- 이미 "제출하고 모범 답안 보기" 버튼이 있어 자연스러운 훅 지점이다. 클릭 핸들러를 비동기로 바꾼다:
  1. 글자 수(`MIN`) 통과 확인은 지금과 동일.
  2. 이미 `nudged`면(rethink를 이미 봤으면) 검사를 건너뛰고 바로 모범 답안을 보여 준다.
  3. 처음이거나 지난 시도가 block이었으면 §2.1 흐름대로 판정한다.
  4. **ok** → 바로 모범 답안 공개(지금과 동일).
  5. **rethink** → rethink 카드(모범 답안은 아직 안 보여 줌). "다시 써 볼게요" → textarea로. "그대로 제출하고 모범 답안 볼게요" → `nudged=true` + 모범 답안 공개.
  6. **block** → block 카드(모범 답안 계속 안 보임), "다시 써 볼게요"만(3번째부터 교사 확인 버튼). 교사 확인으로 통과하면 그 즉시 모범 답안도 함께 공개한다(더 기다리게 하지 않음).

### 5.3 되짚기/차단 카드(공통 컴포넌트, `answer-check.js`가 렌더링)

**A. rethink 카드**(기존 설계와 동일, "그대로 제출" 있음)
```
┌─────────────────────────────────────────┐
│ 🤔 다시 한번 생각해서 써 볼까요?            │
│ (1안/Gemini 메시지 한두 문장, aria-live)    │
│                                           │
│ [✏️ 다시 써 볼게요]  [그대로 제출할게요]     │
└─────────────────────────────────────────┘
```

**B. block 카드**(새로 추가, "그대로 제출" 없음)
```
┌─────────────────────────────────────────┐
│ 🚫 아직 이 질문과 어울리는 답이 아니에요     │
│ (Gemini/1안 메시지, 두 문장 이내, 정답 아닌 주제 힌트만)│
│                                           │
│ [✏️ 다시 써 볼게요]                        │
│ ── (같은 질문에서 3번째 block부터만) ──      │
│ [🙋 선생님과 확인했어요 · 계속하기]          │
└─────────────────────────────────────────┘
```
- 입력창(textarea)의 내용은 **지우지 않는다** — 학생이 이어서 고쳐 쓸 수 있게 한다.
- "다시 써 볼게요"는 몇 번이든 다시 누를 수 있다(횟수 제한 없음).
- **교사 확인 버튼("🙋 선생님과 확인했어요 · 계속하기")은 같은 질문에서 block이 3번째일 때부터** 나타난다. 누르면 `teacherOverride=true` 저장 후 통과(§3). **이 버튼을 두는 이유**: 이 기능은 성적이 아니라 형성평가 성격의 넛지이고(CLAUDE.md: "점수는 참여 확인용"), 로컬 규칙이나 Gemini가 드물게 특이한 정답을 오탐할 가능성을 완전히 배제할 수 없다. 학생을 화면에 영구히 가둘 수는 없으므로, 교실 안(교사가 곁에 있는 태블릿 수업)이라는 전제 아래 "자기 신고형" 탈출구를 둔다(진짜로 교사가 확인했는지 서버가 검증하지는 않지만, 저장되는 `teacherOverride` 플래그로 나중에 얼마나 쓰였는지 확인할 수 있어 남용 여부를 점검할 수 있다 — §4).
- Gemini를 기다리는 동안(로컬이 즉시 block/ok로 못 정한 모든 경우, §2.1 — 즉 대부분의 제출)은 짧은 진행 표시: `🔎 답을 다시 확인하고 있어요…`(스피너, `aria-live="polite"`, 최대 3.5초). 1.1의 로컬 block은 기다림 없이 즉시 카드가 뜬다.
- 오프라인(`navigator.onLine === false`)이면 Gemini를 시도하지 않고 곧바로 §2.1의 fail-safe(rethink 수준)로 처리한다.
- 실패·시간초과 시 학생에게 "오류"라고 말하지 않는다.
- 안내 문구(§9 Q4): "적은 내용을 확인에 보낸다"는 별도 동의 문구는 화면에 넣지 않는 쪽을 추천(이미 로그인 필수 활동이고, 결과를 서버에 저장하는 `app_results`와 성격이 비슷함).

---

## 6. 사용자가 할 일 — Gemini API 키 넣는 절차

1. **키 발급**: https://aistudio.google.com/apikey 접속 → Google 계정으로 로그인 → "Create API key" → 무료 등급 프로젝트 선택(카드 등록 없이 발급 가능).
2. **한도 확인(추천)**: https://aistudio.google.com/rate-limit 에서 `gemini-flash-lite-latest`(또는 화면에 보이는 최신 Flash-Lite 이름)의 실제 무료 등급 RPM/RPD를 한 번 확인한다(§2.2).
3. **Supabase Secrets 등록**(둘 중 하나):
   - CLI:
     ```bash
     npx supabase login
     npx supabase link --project-ref <project-ref>
     npx supabase secrets set GEMINI_API_KEY=<발급받은 키>
     ```
   - 대시보드: Supabase 프로젝트 → **Edge Functions** → **Manage secrets** → `GEMINI_API_KEY` 추가.
4. **함수 배포**(Build 단계에서 코드가 준비된 뒤, `admin-reset-password/README.md`와 같은 절차):
   ```bash
   npx supabase functions deploy check-answer
   ```
   **`--no-verify-jwt`를 붙이지 않는다.**
5. **배포 후 Verify JWT 확인**: 대시보드 → Edge Functions → `check-answer` → Settings → **Enforce JWT Verification** 켜짐 확인.
6. **동작 확인**: 로그인한 테스트 학생 계정으로 새 기준 과학 앱(예: `sci-6-2-1-5`)에서 (a) 자모만 입력 → 즉시 block 카드, (b) "집에 가고 싶다" 같은 무관한 답 → Gemini가 block 카드(잠깐 스피너 후), (c) 틀렸지만 관련 있는 답 → rethink 카드에서 "그대로 제출"이 항상 되는지, (d) block을 3번 반복 → 교사 확인 버튼이 뜨는지 확인. 대시보드 Edge Functions → Logs에서 verdict 로그도 확인한다.
7. **비용 걱정**: 무료 등급 한도 안에서는 과금되지 않는다. 한도를 넘어도 §2.1의 fail-safe로 자동 전환되므로 수업이 멈추지 않는다.

---

## 7. SQL — 필요 없음

- Edge Function이 DB를 전혀 조회하지 않는다(Verify JWT 게이트웨이가 로그인만 확인).
- 되짚기·차단 이력은 기존 `app_progress.state`/`app_results.details`(jsonb) 안에 필드를 추가하는 것뿐이라 스키마 변경이 아니다(§3).
- 호출 빈도 제한·오탐 점검도 DB 없이 설계했다(§2.3, §4).

나중에 남용이 확인되면(예: `teacherOverride`가 유독 많이 쓰이는 차시) 그때 작은 로그/통계 테이블을 추가하는 안을 검토한다(§9 Q3).

---

## 8. 공통 틀 변경 범위 · 단계별 작업 계획

### 8.1 건드릴 파일

| 파일 | 변경 |
|---|---|
| `scripts/templates/science-sim/answer-check.js`(신설) | 1안 규칙(§1.1), Gemini 호출(§2.3 클라이언트 쪽, timeout race), rethink/block 카드 렌더링(§5.3), `blockCount`/`teacherOverride` 저장 로직 — `SciSim.AnswerCheck` |
| `scripts/templates/science-guide/answer-check.js`(신설) | science-sim과 완전히 같은 파일(persist.js와 같은 방식). guide의 conclude.js가 "제출된 글만" 검사하는 점만 맞춘다. |
| `scripts/templates/science-sim/predict.js` | `checkPass()` 메서드 추가(선택, `cfg.answerCheck` 있을 때만 동작). `qa()`에 `nudged`/`blockCount`/`teacherOverride` 추가. |
| `scripts/templates/science-sim/conclude.js` | 제출 버튼 핸들러를 비동기로, `answerCheck` 훅 추가(선택). `qa()`에 같은 3개 필드 추가. |
| `scripts/templates/science-guide/predict.js`·`conclude.js` | 위와 동일(README의 "같음"/"조금 다름" 표기에 맞춰 옮긴다). |
| `scripts/templates/science-sim/lesson.js` | `nav()`의 gate가 Promise를 반환해도 기다리도록 확장(하위 호환). |
| `scripts/templates/science-guide/lesson.js` | 동일. |
| `scripts/templates/science-sim/style-common.css` | rethink/block 카드·스피너·교사 확인 버튼 스타일 추가. |
| `supabase/functions/check-answer/index.ts`, `README.md`(신설) | §2.3, §6 |
| 각 앱의 `index.html` | `answer-check.js` `<script>` 태그 한 줄 추가 |
| 각 앱의 `data/lesson-config.js` | **대부분 무변경**(§1.2). 오개념 힌트를 추가하고 싶은 차시만 선택 추가. |
| 각 앱의 `app.js` | `gates`에 `predict.checkPass()` 배선 한 줄, `answerCheck: true`류 설정 전달(선택) |

기준 없는 앱(`answerCheck`를 켜지 않은 앱)은 지금과 똑같이 동작한다.

### 8.2 단계

1. **정본 수정**(Build 서브에이전트 1, science-sim 담당) → `answer-check.js`, `predict.js`, `conclude.js`, `lesson.js`, `style-common.css`. 기존 앱에 새 틀을 얹어도 `answerCheck` 미설정 시 회귀 없는지 확인.
2. **science-guide 동기화**(같은 서브에이전트 또는 별도).
3. **Edge Function**(별도 서브에이전트, Build) → `check-answer/index.ts` + README. 로컬에서 코드 리뷰만(실 배포는 사용자, §6).
4. **앱 배선**(대상 앱마다, §9 Q1 결론에 따라 범위 확정 후) → `index.html` 스크립트 태그, `app.js` gate/제출 훅 연결, (선택) `lesson-config.js`에 힌트 추가.
5. **Review**(별도 서브에이전트) → 브라우저로 ok/rethink/block 각각 실제 동작(자모만·반복·질문복사 등 로컬 block, "집에 가고 싶다" 류 Gemini block, 틀렸지만 관련 있는 rethink, 3번째 block 교사 확인 버튼, 오프라인·시간초과 흉내로 fail-safe 확인), 모바일·다크모드, 콘솔 오류 0, `npm run build`. Gemini 키가 아직 없으면(§6 전) 항상 fail-safe 경로만 확인.
6. 문제 있으면 수정 → 커밋(Claude가 검증 후, push는 사용자 확인 후).

각 단계 사용자 할 일: 1~3단계는 승인만, 4단계 전 §9 Q1 답변, 5단계 전후로 §6(키 발급·Secrets·배포), 마지막 push 승인.

---

## 9. 열린 질문(추천안 포함)

| # | 질문 | 추천안 |
|---|---|---|
| **Q1** | 대상 범위: 사용자는 "전체"라고 했지만 `docs/STATUS.md`는 1학기 9개 앱에 "수정 금지"/"그대로 둠" 딱지를 붙여 놓았다. | **새 기준 앱부터**: 2학기 11개 + 1학기 6-1-2-3·4(총 13개). 6-1-2-5는 이미 "그대로 두기로 결정"된 앱이라 제외, 구 기준 9개도 제외. |
| **Q2** | Gemini에 질문 문구·모범 답안까지 보낼지. | **보낸다.** 둘 다 브라우저에 이미 공개된 내용이라 개인정보가 아니며, 안 보내면 채점 근거(특히 이번에 추가된 off-topic 판단!)가 없어 §1.3 설계가 성립하지 않는다. |
| **Q3** | 사람별·분당 호출 제한·오탐 통계를 DB로 정밀하게 둘지. | **v1은 두지 않는다**(§2.3·§4·§7). `blockCount`/`teacherOverride`(§3, jsonb) + Edge Function 로그(§2.3)로 시작하고, 실제로 남용/오탐이 보이면 그때 작은 테이블을 추가한다. |
| **Q4** | "적은 내용을 검사에 보낸다"는 별도 안내 문구를 화면에 넣을지. | **넣지 않는 쪽을 추천**(§5.3). |
| **Q5** | (개정) Gemini를 predict·conclude 모두에 쓸지. | 이번 개정으로 **사실상 둘 다 거의 항상 쓴다**(§1.3 — off-topic 판단이 문장만 봐선 안 되기 때문). 굳이 더 줄이고 싶다면 predict는 규칙 없이 통과시키고 conclude만 검사하는 축소안도 가능하지만, "집에 가고 싶다"류가 예상하기에도 나올 수 있어 **추천하지 않는다.** |
| **Q6** | 관리자 화면에 "되짚기/차단 받음" 배지를 이번에 같이 넣을지. | **다음으로 미룬다**(§4). 저장 필드만 이번에 만들어 두면 언제든 추가할 수 있다. |
| **Q7** | block 3회째 교사 확인 버튼의 등장 기준(횟수)과, "진행 중(미완료) 학생이 block에 갇혀 있는지"를 관리자가 실시간으로 볼 수 있게 할지. | **횟수는 3회를 기본값으로 추천**(너무 이르면 무의미한 답도 쉽게 통과, 너무 늦으면 학생이 오래 막힘 — 7분 기준을 고려한 절충). 실시간 감지는 **1차 범위 밖**(§4)으로 남기고, Review 단계에서 실제 체감 대기·좌절도를 확인해 숫자를 조정하는 편을 추천한다. |

---

## 10. 참고(요금·모델 출처)

- Google 공식 요금/한도 문서(정확한 숫자는 비공개, AI Studio 참조 안내): https://ai.google.dev/gemini-api/docs/rate-limits
- Flash/Flash-Lite 무료 등급 요약(3rd-party, 2026-09 기준 대략치): https://tinkerllm.com/blog/gemini-api-free-tier-limits-rate-quotas/ , https://aipromptshub.co/blog/gemini-api-free-tier-rate-limits , https://www.aifreeapi.com/en/posts/gemini-api-free-tier-rate-limits
- 키 발급: https://aistudio.google.com/apikey · 한도 확인: https://aistudio.google.com/rate-limit

---

## 개정 1 (2026-09-23, 사용자 결정) **이 절이 위 열린 질문보다 우선한다.**
* **Q1 범위: 과학 앱 23개 전부**(1학기 12개 + 2학기 11개). 차시별 새 기준 데이터를 만들지 않아도 되므로 1학기 앱도 포함한다. 단 1학기 앱은 저장 키·저장 구조·문항 내용을 그대로 두고, 되짚기/차단 동작만 얹는다.
* **Q2 보낸다**(질문·모범 답안·학생 답만). 학생 이름·학번·user id·이메일은 절대 보내지 않는다.
* **Q4 안내 문구는 넣지 않는다**(사용자 결정: 식별 정보가 가지 않으므로 학생이 불안해할 문구를 두지 않는다). 대신 학생이 개인정보를 적지 않도록 교실에서 안내한다.
* **Q7 "선생님과 확인했어요" 버튼은 같은 질문에서 3번째 차단부터** 나타난다(추천안 그대로). Q3·Q5·Q6도 추천안 그대로.


---

## 개정 (2026-09-26) 시간 한도·되짚음 기록
* 사용자 보고: "집에 가고 싶다"가 막히지 않고 "다시 한번 생각해서 써 볼까요?"(대답 못 받음 기본 문구)만 떴다. Supabase 로그 `check-answer: Gemini 호출 실패 timeout` — Gemini가 3초 안에 대답하지 못했다(함수를 다시 배포한 직후라 켜지는 시간도 더해짐).
* **시간 한도**: 서버의 Gemini 대기 3초 → **7초**, 클라이언트 전체 대기 3.5초 → **9초**(§2.3·§165·§248의 3초/3.5초를 대체). 기다리는 동안 "답을 다시 확인하고 있어요…" 표시는 그대로.
* **대답을 못 받았을 때**: 전처럼 되짚기 카드로 한 번 권하고 막지 않지만, 이 질문을 **"되짚음"(nudged)으로 기록하지 않는다** — 전에는 한 번 늦은 대답 때문에 그 기기에서 그 질문의 검사가 계속 꺼졌다. "그대로 제출"한 글은 okFp로 기억하므로 같은 글은 다시 묻지 않고, 고쳐 쓴 글은 다시 확인한다.
* **(같은 날 2차)** 7초로 늘린 뒤에도 `timeout`(03:36). 원인 추정: `gemini-flash-lite-latest`가 대답 전에 오래 생각하는 모델을 가리키게 됨(09-23에는 3초 안에 됐다). 함수가 먼저 생각을 끄고(`thinkingBudget: 0`) → 400이면 `thinkingLevel: "low"` → 400이면 설정 없이 보내게 했고, 함수가 켜질 때 모델 정보(`version`, `thinking`)를, 판정마다 걸린 시간·실제 모델 버전을 로그에 남긴다(진단용, 학생 정보 없음). 사용자가 `check-answer`를 다시 배포해야 한다.
