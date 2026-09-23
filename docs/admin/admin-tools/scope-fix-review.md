# Review 보고: 로그인 잠금 범위 좁히기 (scope-fix)

검토 대상: `supabase/migrations/20260923020000_login_required_scope.sql`, `scripts/templates/**`(class1-record.js · science-sim/* · science-guide/*), `public/apps/sci-*/` 23개 사본, 바뀐 `src/**`
지침: `scope-fix-instructions.md` · Build 보고: `scope-fix-report.md`
검토자: Review 서브에이전트(독립 확인). git 명령·실 DB/Storage 쓰기·실제 Auth/Gemini 호출 없음. 전용 포트(8873 앱 · 8874 가짜 Supabase · 8875 빌드 사이트)에서 내 탭만 썼고, `localStorage.clear()`는 쓰지 않았다(내 키만 제거). 끝나고 서버를 모두 종료하고 `out/`을 정상 설정으로 다시 빌드했다.

## 판정

**사용자는 SQL(`20260923020000_login_required_scope.sql`)을 실행해도 된다.** 되돌리는 4개 정책이 원본 마이그레이션과 글자 그대로 같고, 남기는 게이트 6개는 그대로이며, 재실행 안전하다. 막는 결함(심각)은 찾지 못했다.

| 심각도 | 개수 |
|---|---|
| 심각(배포 전 반드시 고칠 것) | **0** |
| 중간(고치면 좋음) | **1** |
| 낮음(메모) | **4** |

---

## 1. SQL 검토

### 되돌린 4개 — 원문과 1:1 대조 결과 **모두 일치**

| 정책 | 새 파일 | 원본 | 일치 |
|---|---|---|---|
| `profiles: 누구나 조회` | `20260923020000:49-52` `using (true)` | `20260921000000_init_blog.sql:74-76` | ✅ |
| `likes: 누구나 조회` | `:57-60` `using (true)` | `20260921000000_init_blog.sql:188-190` | ✅ |
| `views: 누구나 조회` | `:65-68` `using (true)` | `20260921000000_init_blog.sql:218-220` | ✅ |
| `assignments: 공개된 것은 누구나…` | `:73-76` `using (published or public.is_admin())` | `20260921020000_admin_learning.sql:239-242` | ✅ |

* 그 사이 마이그레이션(`20260921010000_fixes.sql`, `20260922*`)에서 이 4개를 다시 정의한 곳이 없는지 전수 확인했다 — 없다(`on public.profiles for select` 등으로 전체 검색). 즉 "원문"이 실제로 최신 정의가 맞다.
* `to` 절·`with check` 절이 원본에도 없고 새 파일에도 없다. 역할(role) 범위가 달라지지 않는다.

### 남기는 게이트 6개 — 동작 확인(정책 문구 검토)

`posts`, `comments`, `community_posts`, `community_comments`, `community_likes`, `storage.objects(game-uploads)`는 이 파일이 건드리지 않으므로 `20260923010000_login_required.sql:144-238`의 정의가 그대로 남는다.

* 주인(author)·관리자 분기는 `can_browse()` **바깥**에 있다 — `community_posts`는 `((not hidden) and can_browse()) or auth.uid() = author_id or is_admin()`, storage는 `본인 폴더 or is_admin() or (can_browse() and 볼 수 있는 게임)`. 따라서 잠금이 켜져도 **작성자는 자기 숨김 글을, 관리자는 전부** 볼 수 있다(둘 다 로그인 상태라 어차피 게이트를 통과한다).
* `comments`·`community_comments`·`community_likes`는 부모 글이 보이는지까지 다시 확인하므로 숨김 글의 댓글·좋아요가 새지 않는다.
* 게이트가 붙은 정책이 6개가 되는 것이 파일 상단 확인 쿼리와 일치한다(기존 10개 − 되돌린 4개).

### 재실행·안전성

* `drop policy if exists` + `create policy`만 쓴다 → 몇 번 실행해도 안전. 이름 충돌 없음(같은 이름을 지우고 다시 만든다).
* **42P17(정책 재귀) 없음**: 세 정책은 `true`라 아무 함수도 부르지 않고, `assignments`는 `public.is_admin()`(security definer)만 부르며 그 안에서 읽는 `profiles`의 정책이 이제 `true`라 재귀 고리가 없다.
* 새로 만드는 함수가 없어 `search_path`·`grant/revoke` 변경이 없다. `site_settings`·`can_browse()`·`login_required()`·`admin_set_login_required()`·`increment_post_view()`는 손대지 않는다 — 자물쇠(잠금을 끄지 못하게 되는 상황) 위험 없음.
* `login_required` 값을 바꾸지 않으므로, 잠금이 켜진 상태에서 실행해도 켜진 채로 남는다.

### 순서를 어겼을 때(중요)

* **SQL만 실행하고 배포하지 않으면**: 지금 배포본은 잠금이 켜지면 사이트 전체를 가리므로 겉보기 변화가 없다. 되살아난 `profiles`·`likes`·`views`·`assignments` 읽기는 화면을 깨뜨리지 않는다. **위험 없음.**
* **배포만 하고 SQL을 실행하지 않으면**: 잠금이 **꺼져 있는 동안에는** `can_browse()`가 항상 참이라 아무 차이가 없다(체험 모드도 정상 동작). 문제는 그 상태에서 잠금을 **켤 때**다 — `profiles`·`likes`·`views`가 여전히 잠겨 홈의 숫자·이름이 빈 채로 남는다(오류 화면은 아니고, 이미 "로그인 필요"로 보이는 칸이라 눈에 띄는 손상은 아니다). 그래도 보고서 순서대로 **SQL → 확인 → push**가 맞다.

---

## 2. 4가지 경우 실측 표 (가짜 Supabase, 네트워크 가로채기)

과학 앱은 `sci-6-1-2-3`(실험)·`sci-6-1-1-5`(조사) 사본을 전용 포트에 올려 `config.js`만 가짜 서버로 바꿔 확인했다. "요청"은 앱이 실제로 보낸 전부다.

| # | 잠금 | 로그인 | 과학 앱 화면 | 앱이 보낸 요청 | 사이트(홈·`/science/`) | 사이트(`/post/ /board/ /games/ /search/`) |
|---|---|---|---|---|---|---|
| 1 | 꺼짐 | ✗ | **체험 모드**로 전 단계 진행(머리말 안내 + "체험 모드 · 기록이 저장되지 않아요" 배지) | `GET /rest/v1/site_settings` **1건뿐** | 평소대로(안내 카드 없음) | 평소대로 열림 |
| 2 | 켜짐 | ✗ | 🔒 로그인 안내 가림막, `main`이 inert, `sci6…` 키 **전부 삭제 확인** | `site_settings` 1건뿐 | 레이아웃 그대로 + 3칸 "로그인하면 볼 수 있어요", 타일 "로그인 필요", 차시 목록은 그대로 | "로그인이 필요해요" 안내 |
| 3 | 꺼짐 | ✓ | 평소대로(`👤 … 계정으로 로그인 중`, 체험 안내 없음) | `GET /rest/v1/app_progress?...`만(설정 읽기조차 안 함) | 평소대로 | 평소대로 |
| 4 | 켜짐 | ✓ | 평소대로, 입력 가능 | `GET /rest/v1/app_progress` | 평소대로 | 평소대로 |

`/login/`은 네 경우 모두 열린다(확인). `/reset-password/`는 비로그인일 때 `/login/`으로 넘어간다 — 잠금과 무관한 원래 동작이다.

### 체험 모드 저장 호출 0건 — 끝까지 실제로 진행해 확인

`sci-6-1-2-3`을 예상하기(타이핑) → 실험하기(출발·측정·기록, 135.0/122.0 cm) → 분석 2문항 → 정리하기(결론 제출·모범 답안) → **🎉 학습 마치기**까지 마쳤다.

* 서버가 받은 요청은 **총 1건**(`GET /rest/v1/site_settings`). `app_progress`·`app_results`·`/functions/v1/check-answer` **0건**.
* 완료 카드에 "체험 모드라서 결과는 저장되지 않았어요. 로그인하면 기록이 남아요." 표시, `meta.savedAt = null`.
* 콘솔 오류 0건.
* 새로고침해도 이 기기 기록으로 이어서 진행됨(요청은 여전히 `site_settings` 1건).
* 설정을 못 읽는 경우: 조사 앱(`sci-6-1-1-5`)의 `config.js`를 **연결되지 않는 주소**로 바꿔 열었더니 곧바로 체험 모드로 열렸다 — fail-open(잠그지 않음)이 실제로 동작한다(`scripts/templates/class1-record.js:274-297`).

### 체험 기록이 학생 기록을 더럽히지 않는지 — 실제로 확인

1. 비로그인 체험 모드에서 예상 답을 적고(`…:predict` = 손님 글, `__meta.owner = "__guest__"`, `dirty = false`)
2. 같은 기기에 학생 세션을 넣고 앱을 다시 열었다.
3. 결과: 체험 기록이 **즉시 삭제**되고(`predict` = null) `owner`가 학생 id로 바뀌었으며, 서버로 간 요청은 `GET app_progress` **1건뿐**(체험 글을 올리는 POST/PATCH 없음).

보강 근거: 체험 기록은 `dirty`가 절대 서지 않고(`_changed`가 trial에서 즉시 반환, `persist.js:786`·`1166`), 블로그 로그아웃 때 못 올린 기록을 올리는 코드도 `src/lib/science-progress.ts:271`에서 `m.owner !== userId`면 건너뛴다. 따라서 `"__guest__"` 기록이 학생 이름으로 올라갈 경로가 없다. **"이어받지 않고 지운다"는 결정과 근거는 타당하다.**

### 호출 차단 지점(코드)

| 위치 | 막는 것 |
|---|---|
| `scripts/templates/science-sim/persist.js:1080-1084` | 비로그인 + 로그아웃 메시지 없음 → 남의 기록만 지우고 `checking` 단계로, 잠금 확인 뒤 갈 길 결정 |
| 같은 파일 `:533-570` | `checkLock()`/`decide()`/`startTrial()` — 읽기 실패 시 `false`(체험) |
| 같은 파일 `:786`, `:1166` | `reconcile()`·`start()`가 `trial`·`checking`에서 DB를 부르기 전에 반환 |
| 같은 파일 `:1130` | `onAuthChange` 콜백 무시 |
| `science-sim/lesson.js:226-232` | `Class1Record.save()`(app_results) 호출 건너뜀 |
| `science-sim/answer-check.js:162` | `check-answer` Edge Function 호출 건너뜀 |

`science-guide/`의 같은 파일들도 동일하다(두 정본의 해당 부분을 대조 확인).

---

## 3. 저장 구조·동기화 확인

* **저장 키 변경 없음** — 실측 키가 `sci612sim3:v4:*`로 이전 그대로다(`:vN` 올린 곳 없음). 학생 기록이 초기화되지 않는다.
* **`app_progress.state` 스냅샷 모양 변경 없음** — `{ v:1, prefix, keys, savedAt }` 그대로. 불러오기·충돌 판정 코드(`reconcileInner`·`applySnapshot`·`saveProgress`)는 이번 diff에서 **한 줄도 바뀌지 않았다**. 가짜 서버가 예전 형식의 행을 돌려주게 해 두고 로그인 상태로 앱을 열었더니, 스냅샷을 받아 로컬에 풀고 `__meta.syncedAt`을 서버 값으로 맞추는 기존 경로가 그대로 돌았다(내가 넣은 시험 값이 이중 인코딩이라 화면 복원까지는 눈으로 못 봤다 — 아래 "못 한 것" 참조).
* **`app_results.detail`·`detail.qa` 모양 변경 없음** — `lesson.js`의 `Class1Record.save({...})` 호출 인자는 그대로고, 앞에 체험 모드 조기 반환만 끼워 넣었다. `predict.js`·`conclude.js`·`quiz.js` 등 qa를 만드는 파일은 이번에 손대지 않았다(`git status` 기준 바뀐 정본은 4개뿐). 따라서 `src/data/app-responses/*`를 고칠 필요가 없다.
* **23개 앱 동기화 — 불일치 0건**(직접 확인). 23개 폴더 각각에 대해 `class1-record.js` 단일 비교 + `science-sim`(20개)·`science-guide`(3개) 폴더 `diff -r`. 모두 정본과 같다.
* `npm run lint`, `npx tsc --noEmit`, `npm run build` 모두 통과(직접 실행).

---

## 4. 사이트 화면

* `src/components/login-gate.tsx:19`의 `LOCKED_PREFIXES = ["/post/","/board/","/games/","/search/"]`가 실제 라우트를 빠짐없이 덮는다 — 빌드 결과의 전체 라우트(`/board/new`, `/board/post`, `/board/post/edit`, `/games/new`, `/games/post`, `/games/post/edit` 포함)를 접두사로 대조했고, 남는 공개 라우트는 `/`·`/science/`·`/login/`·`/reset-password/`·`/admin/*`·`/me/learning/`뿐이다(뒤 두 개는 원래 자체 가드가 있다).
* `useLoginLocked()`(`src/hooks/use-login-lock.ts:32`)는 설정을 못 읽으면 `false` → 잘못 잠그지 않는다. `LoginGate`·`LoginNeededNotice`·`StatTile`이 모두 이 훅 하나를 쓴다(판정이 갈라지지 않는다).
* 잠금 상태 조기 반환이 **모든 훅 뒤**에 있어 React 훅 순서가 깨지지 않는다(`tagged-post-list.tsx:118`, `community-post-list.tsx:91` 이후에 훅 호출 없음 — 확인).
* 관리자 토글 카드(`src/components/admin/login-required-card.tsx`)의 켜짐/꺼짐 설명·확인 다이얼로그 문구가 새 범위(막히는 것 / 그대로 열리는 것 / 이미 열어 둔 앱은 새로고침 필요)를 정확히 적고 있다. 관리자는 로그인 상태라 어떤 게이트도 관리자를 막지 않는다(SQL·화면 양쪽에서 확인).
* 375px·다크 모드에서 홈을 열어 가로 스크롤 없음, 안내 카드 정상, 콘솔 오류 0건. 앱 체험 안내 줄도 375px에서 정상.

---

## 5. 찾은 문제

### 중간 M1 — 체험 모드에서 좋은 답에도 "다시 한번 생각해 볼까요?" 카드가 한 번 뜬다
`scripts/templates/science-sim/answer-check.js:162`가 `ask()`를 `null`로 만들면, `:362`의 `var verdict = r ? r.verdict : "rethink";` 때문에 판정이 **rethink로 떨어진다**. 실제로 예상하기에 제대로 된 답을 적었는데 "✏️ 다시 써 볼게요 / 그대로 제출할게요" 카드가 떴다(막지는 않으며 "그대로 제출"로 통과된다). 원래 이 기본값은 "Gemini가 응답을 못 하면 한 번만 권하고 통과"라는 안전 장치인데, 체험 모드에서는 **항상** 걸린다.
* 영향: 비로그인 체험 학생이 질문마다 한 번씩 불필요한 되짚기 카드를 본다(최대 2회). 잠깐 "답을 다시 확인하고 있어요…" 스피너도 스쳐 지나간다.
* 제안: `ask()`를 건너뛰는 대신 체험 모드에서는 `⑤`(서버 문의) 단계 자체를 `pass()`로 통과시킨다. 로컬 규칙(무의미 차단)은 `①`에서 이미 돌아가므로 차단 기능은 그대로 남는다.

### 낮음 L1 — 설정 읽기가 느리면 최대 6초 "활동을 여는 중이에요…"
`class1-record.js:274-297`의 `SETTINGS_TIMEOUT_MS = 6000`. 연결이 아예 안 되면 즉시 실패해 체험 모드로 넘어가지만(확인함), 응답이 아주 느린 망에서는 가림막이 최대 6초 유지된다. 7분 활동 기준으로 보면 조금 길다 — 3초 정도로 줄이는 것을 고려.

### 낮음 L2 — 체험 중 "처음부터 다시 하기"를 누르면 `__meta`까지 지워진다
`persist.js`의 `reset()`이 체험(owner 없음)에서 `clearAppLocal()`만 하고 끝나(`:1180` 부근) `__guest__` 표시가 사라진다. 이후 새로 적은 값은 주인 표시가 없는 키로 남는다. 다음에 **학생이 로그인해서 열면** `readMeta()`가 비어 `clearAppLocal()`로 지워지므로 안전하고, 체험으로 다시 열면 다시 `__guest__`가 찍힌다 — 실질 피해는 없지만 "주인 표시 없는 키가 잠시 남는다"는 점만 알아 둘 것.

### 낮음 L3 — `LoginNeededNotice`가 조사 "을"을 고정으로 붙인다
`src/components/login-gate.tsx:66` `…친구들만 {what}을 볼 수 있어요.` 지금 들어가는 말(`○○ 수업 글`, `자유게시판`, `학습게임`)은 모두 받침이 있어 자연스럽지만, 받침 없는 이름을 넣으면 어색해진다.

### 낮음 L4 — 잠금을 켠 순간 이미 열려 있던 앱
새로고침 전까지 체험 모드가 이어진다(입력은 이 기기에만). 보고서와 관리자 카드에 이미 적혀 있고, 앱 자체가 정적 파일이라 새는 정보는 없다. 수용 가능.

---

## 6. 확인한 것 / 못 한 것

**확인한 것(내가 직접 돌려 봄)**
* SQL 4개 정책 ↔ 원본 마이그레이션 문구 1:1 대조, 중간 마이그레이션의 재정의 여부 전수 검색, 재실행 안전성·재귀·권한 검토
* 4가지 경우(잠금 × 로그인) × (실험 앱 · 조사 앱 · 홈 · `/science/` · `/post/` · `/board/` · `/games/` · `/search/` · `/login/`)
* 체험 모드 전 과정 완주 시 서버 요청 총 1건(`site_settings`), 저장·Edge Function 0건
* 설정을 못 읽을 때 체험 모드로 열림(fail-open)
* 체험 기록 → 로그인 시 삭제, 업로드 0건
* 저장 키 `:v4` 유지, 스냅샷 불러오기 경로 동작, `detail`/`detail.qa` 생성 코드 무변경
* 23개 앱 ↔ 정본 `diff -r` 불일치 0건
* lint · tsc · build 통과, 375px·다크·콘솔 오류 0건

**못 한 것(사용자 확인 필요)**
* **실 Supabase에서의 RLS 동작** — 규칙대로 SQL을 실행하지 않았다. 실행 뒤 파일 상단 확인 쿼리(게이트 6개 / 되돌린 4개)로 직접 점검할 것.
* **실제 Auth 로그인·로그아웃** — 가짜 세션(localStorage에 넣은 가짜 JWT)으로만 시험했다. OAuth 왕복, 세션 만료, 두 탭 동시 로그인(storage 이벤트) 경로는 확인하지 못했다.
* **저장된 옛 기록의 화면 복원** — 스냅샷을 받아 로컬에 푸는 경로까지는 봤지만, 내가 만든 시험 데이터가 이중 인코딩이라 "예전 답이 화면에 그대로 뜨는지"는 눈으로 확인하지 못했다. 다만 해당 코드는 이번 변경에서 전혀 바뀌지 않았다.
* **실제 Gemini(check-answer)** — 호출하지 않았다. 로그인 상태의 되짚기 동작은 코드상 이전과 같다.
* **실제 iPad/태블릿 터치** — 데스크톱 브라우저의 375px/태블릿 에뮬레이션으로만 확인했다.
* **관리자 화면 실물** — 관리자 세션을 만들지 않아 토글 카드는 코드로만 확인했다(문구는 새 범위와 일치).
