# check-answer (Edge Function)

과학 차시 앱(`/apps/sci-…/`)에서 학생이 **예상하기·정리하기**에 적은 답을 한 번 살펴보고
**ok(통과) · rethink(한 번 되짚기) · block(다시 쓰기)** 셋 중 하나로 판정합니다.
설계: `docs/science/answer-check/spec.md`. 앱 쪽 코드: `scripts/templates/science-sim/answer-check.js`.

> **2026-09-23 변경 — 다시 배포해야 합니다.** `stage: "curiosity"`('더 탐구하고 싶은 점')를 받아들이고,
> 이 단계는 **정답 여부를 따지지 않는 느슨한 기준(ok / block만, rethink 금지)** 으로 봅니다.
> 배포하지 않으면 그 칸의 답은 `400 invalid`가 되어 **앱이 서버 판정 없이 그냥 통과**시킵니다(학생이 막히지는 않습니다).

> **이 함수가 없어도 수업은 멈추지 않습니다.** 배포하지 않았거나, 키가 없거나, 한도를 넘었거나, 응답이 늦으면
> 앱은 **절대 학생을 막지 않고** "다시 한번 생각해서 써 볼까요?" 카드만 한 번 보여 준 뒤 통과시킵니다.
> 확실한 무의미(자모만·같은 글자 반복·숫자만·질문 그대로 복사·자판 뭉개기)는 앱 안의 규칙이 서버 없이 막습니다.

- **필요한 시크릿: `GEMINI_API_KEY` 하나.** (`SUPABASE_URL` 등은 이 함수가 쓰지 않습니다. 서비스 롤 키도 쓰지 않습니다.)
- 선택 시크릿 `GEMINI_MODEL` — 기본값 `gemini-flash-lite-latest`. 모델 이름이 바뀌거나 다른 모델을 쓰고 싶을 때만 넣습니다.
- 생각(thinking) 설정(2026-09-26): 판정은 짧은 분류라 먼저 생각을 끄고(`thinkingBudget: 0`), 모델이 받지 않으면 `thinkingLevel: "low"`, 그래도 안 되면 설정 없이 보냅니다. 판정 로그 한 줄에 걸린 시간(`ms`)·실제 모델 버전(`modelVersion`)·쓴 설정(`thinking`)이 남습니다(학생 답·식별 정보 없음).
- 허용 출처(CORS): `https://eversunk2-tech.github.io`, `http://localhost:3000` + Supabase Secrets **`EXTRA_ALLOWED_ORIGINS`**(쉼표로 구분한 추가 출처, 예: Vercel 주소 `https://class1-xxxx.vercel.app` — 끝에 `/` 없이). 다른 도메인을 더 쓰게 되면 코드를 고치지 말고 이 Secret을 바꾼 뒤 함수를 다시 배포하세요.
- **JWT 검증(Verify JWT)은 켠 채로 배포합니다**(`--no-verify-jwt`를 붙이지 마세요. `supabase/config.toml`에도 `verify_jwt = true`로 적어 두었습니다).
  게이트웨이는 "이 프로젝트 키로 서명된 토큰인지"만 봅니다 — **anon key 자체도 그런 토큰이라 게이트웨이만으로는 로그인 확인이 되지 않습니다.**
  그래서 함수가 `Authorization` 토큰의 내용을 한 번 더 확인합니다: `role`이 `authenticated`이고 `sub`(user id)가 있으며 만료 전일 때만 처리하고,
  아니면 `401 { ok: false, reason: "not_logged_in" }`을 돌려줍니다(anon key·service_role key만으로는 호출할 수 없습니다).
- **체험 모드(비로그인) 호출 — 2026-09-26 사용자 결정**: 공개 키(anon key, role `anon`)로도 판정을 받을 수 있습니다(과학 앱의 체험 모드). 공개 키는 누구나 볼 수 있으므로 비로그인 호출에만 남용 방지를 겁니다: ① 허용 출처(위 CORS 목록)에서 온 요청만(아니면 403), ② 함수 인스턴스 메모리 기준 IP별 1분 60번·1시간 600번(학교는 한 반이 같은 IP로 나가므로 넉넉히), 전체 1분 300번 — 넘으면 `200 { ok:false, reason:"rate_limited" }`(학생은 막히지 않음), ③ **끄기**: `npx supabase secrets set CHECK_ANSWER_ALLOW_ANON=off` 후 함수를 다시 배포하면 비로그인 호출을 받지 않습니다(401 — 학생 화면은 로컬 규칙만으로 넘어감). 다시 켜려면 `CHECK_ANSWER_ALLOW_ANON=on`(또는 Secret 삭제) 후 재배포. 비로그인 호출의 IP는 한도 계산에만 쓰고 로그에 남기지 않습니다. 로그 한 줄에 `who: "user" | "anon"`이 붙습니다. service_role key 등 그 밖의 토큰은 여전히 받지 않습니다.
  토큰 문자열과 `sub`는 로그에 남기지 않습니다.
- 요청 본문은 8KB를 넘으면 받지 않습니다(`413`).
- **개인정보를 받지도 보내지도 않습니다.** 요청 본문은 `appId`, `stage`, 질문 문구, 학생이 적은 답, (정리하기면) 모범 답안뿐입니다.
  학생 이름·학번·이메일·user id는 보내지 않습니다. 질문·모범 답안은 이미 브라우저에 공개로 내려가는 `lesson-config.js` 내용입니다.
- **API 키는 코드·응답·로그 어디에도 남지 않습니다.** Supabase Secrets에서 읽어 Google 요청 헤더로만 보냅니다.

---

## 1. Gemini API 키 만들기

1. https://aistudio.google.com/apikey 접속 → Google 계정 로그인 → **Create API key** → 무료 등급 프로젝트 선택(카드 등록 불필요).
2. (권장) https://aistudio.google.com/rate-limit 에서 `gemini-flash-lite-latest`의 실제 무료 등급 분당(RPM)·하루(RPD) 한도를 확인합니다.
   한 반 25명 기준 **2학기 앱은 약 50회, 예상하기 2문항 + 정리하기 3문항인 1학기 구 기준 앱은 최대 125회**가 일어납니다.
   하루에 여러 반이 같은 앱을 쓰면 하루 한도에 닿을 수 있지만, 닿아도 위 fail-safe로 차단이 풀릴 뿐 수업은 계속됩니다.
3. 키는 **아무 파일에도 붙여 넣지 마세요.** 아래 3번 절차로 Supabase Secrets에만 넣습니다.

## 2. 시크릿 등록 (둘 중 하나)

**CLI**
```bash
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase secrets set GEMINI_API_KEY=<발급받은 키>
```

**대시보드**: Supabase 프로젝트 → **Edge Functions** → **Manage secrets** → `GEMINI_API_KEY` 추가.

## 3. 배포

```bash
npx supabase functions deploy check-answer
```

CLI 없이 하려면: 대시보드 → **Edge Functions** → **Deploy a new function** → **Via Editor** →
이름을 정확히 `check-answer`로 하고 이 폴더의 `index.ts` 내용을 붙여 넣은 뒤 **Deploy function**.

배포 뒤 함수 상세 화면 **Settings**에서 **Enforce JWT Verification(Verify JWT)** 이 켜져 있는지 확인합니다.

## 4. 동작 확인 (학생 테스트 계정으로 로그인한 뒤)

아무 과학 앱(예: `/apps/sci-6-2-1-5/`)의 예상하기에서:

| 입력 | 기대 결과 |
|---|---|
| `ㅁㄴㅇㄹㅁㄴㅇㄹ`(자모만) | 서버를 부르지 않고 **즉시** 빨간 차단 카드 |
| `집에 가고 싶어요 배고파요` | 잠깐 "답을 다시 확인하고 있어요…" 뒤 **차단 카드**(Gemini 판정) |
| 질문과 관련은 있지만 틀린 답 | 노란 되짚기 카드 + **"그대로 제출할게요"** 버튼(항상 넘어갈 수 있어야 함) |
| 제대로 쓴 답 | 아무 카드 없이 그대로 다음 단계 |
| 차단을 3번 받으면 | 카드 아래 **"🙋 선생님과 확인했어요 · 계속하기"** 버튼 |

대시보드 **Edge Functions → Logs**에 `{"appId":"sci-…","stage":"predict","verdict":"block","priorBlocks":0}` 같은 줄이
한 호출에 하나씩 남습니다(학생 답·이름은 남지 않습니다). block이 유독 많은 차시가 보이면 프롬프트나 규칙을 손볼 근거로 씁니다.

## 문제가 생기면

| 증상 | 원인 / 해결 |
|---|---|
| 아무 답이나 다 통과함(카드가 안 뜸) | 함수가 배포되지 않았거나 `GEMINI_API_KEY`가 없습니다. Logs에서 `GEMINI_API_KEY 시크릿이 없습니다` 확인 → 2·3번 절차. |
| Logs에 `Gemini 오류 응답 404` | 모델 이름이 바뀌었습니다. AI Studio에서 쓸 수 있는 Flash-Lite 이름을 확인해 시크릿 `GEMINI_MODEL`에 넣고 다시 배포합니다. |
| Logs에 `Gemini 한도 초과(429)` | 무료 등급 분당 한도입니다. 이때는 차단하지 않고 넘어가므로 수업은 그대로 진행됩니다. |
| Logs에 `timeout`이 자주 보임 | 7초(2026-09-26 전에는 3초) 안에 응답이 오지 않았습니다. 이때도 학생은 막히지 않습니다(앱은 9초까지 기다림). 로그의 `{"gemini_model":…,"thinking":…}` 줄(함수가 켜질 때 한 번)로 모델이 실제로 무엇인지 확인하고, 계속 잦으면 생각(thinking)이 없는 가벼운 모델로 `GEMINI_MODEL`을 바꿔 보세요. |
| Logs에 `Gemini 400, 다음 설정으로` | 모델이 '생각 끄기' 설정을 받지 않아 다음 설정(가장 낮은 생각 단계 → 설정 없음)으로 다시 보낸 것입니다(2026-09-26). 판정 줄의 `thinking` 값이 실제로 쓴 설정입니다. |
| 브라우저 콘솔에 CORS 오류 | 사이트 주소가 허용 출처에 없습니다. `index.ts`의 `ALLOWED_ORIGINS`를 고치고 다시 배포하세요. |
| 로그인했는데도 카드가 전혀 안 뜸(401) | 세션이 만료됐을 수 있습니다. 다시 로그인해 보세요(이때도 학생은 막히지 않고 그냥 통과합니다). |
| 맞는 답인데 자꾸 막힌다(오차단) | 완료 결과의 `detail.qa[].blockCount`·`teacherOverride`와 Logs의 verdict 분포를 함께 보고 프롬프트(`buildPrompt`)를 조정합니다. |
