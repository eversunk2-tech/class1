# Review: 과학 앱 로그인 필수 · 진행 상황 DB 저장 · 로그아웃 시 삭제 (2026-09-22)

지침: `docs/science/progress-review-instructions.md`. 검토 대상: `git diff HEAD` + 새 파일(`supabase/migrations/20260922010000_app_progress.sql`, `src/lib/local-data.ts`, `src/lib/login-redirect.ts`), 틀(`scripts/templates/**`)과 앱 12개 사본. 코드 수정·git 조작·실 DB 쓰기는 하지 않았다.

## 요약 (심각도별 개수)

| 심각도 | 개수 |
|---|---|
| Critical | 0 |
| High | 1 |
| Medium | 4 |
| Low | 6 |
| Info | 3 |

전체 설계는 탄탄하다(동기 주인 확인, 가림막 + `inert`, 로그아웃 이중 삭제, 안전한 `next`, RLS). 다만 **진행 상황 API가 페이지의 "기록 주인"이 아니라 "지금 저장소에 있는 세션"의 사용자로 읽고 쓴다.** 그래서 로그아웃/사용자 변경 알림(storage 이벤트)을 놓친 페이지는 학생 A의 입력을 학생 B의 DB 행에 덮어쓴다(가짜 Supabase로 재현함). 반드시 고쳐야 할 것은 이것 하나다.

## 문제 표

| # | 심각도 | 위치 | 현상 | 재현 | 수정 제안 |
|---|---|---|---|---|---|
| H1 | **High** (개인정보 교차 노출 + B의 기록 손상) | `scripts/templates/class1-record.js:295-303, 358-390, 396-401`(load/save/clear가 `requireUser()`의 현재 세션 id 사용), `:373`(keepalive가 `peek.userId` 사용); `scripts/templates/science-sim/persist.js:471-480`(`saveNow`는 로컬 meta 주인 = 페이지 `owner`만 확인), `:356-425`(`reconcileInner`도 확인 안 함). 12개 앱 사본 동일 | 페이지는 시작할 때 `owner`=A로 정한다. 그 뒤 A의 로그아웃과 B의 로그인 storage 이벤트를 이 문서가 못 받으면(bfcache 복원, 얼어붙은 백그라운드 탭, 이벤트 누락) 다음 저장이 **B의 토큰과 `user_id=B`로 A의 스냅샷을 upsert**한다. RLS는 막지 않는다(B가 B의 행에 쓰는 것이라 정당함). 그 결과 B의 DB 기록에 A의 답이 들어가 B가 A의 답을 보게 되고, B의 원래 기록은 사라진다. 이 상태에서 `reconcile`이 돌면 B의 행을 가져와 주인 A로 표시된 로컬에 복원하는데, 다음 로드 때 지워지기는 한다 | 자체 headless Chrome + CDP 가짜 Supabase(`t2.mjs`, 스크래치): A 세션으로 sci-6-1-1-2 열기 → 예상 칸에 "A-secret-answer" 입력 → A로 upsert → 같은 문서에서 세션 키를 B로 바꾸기(이벤트 누락 모의) → 입력 수정 → **upsert `Authorization=B`, `user_id=B`, `state.predict.q1="A-secret-answer (edited)"`** → 가짜 DB의 B 행이 A 내용으로 덮임 | ① `loadProgress/saveProgress/clearProgress`가 기대 사용자 id(`expectedUserId`)를 받게 하고, 현재 세션 id와 다르면 `{ok:false, reason:"user_changed"}`를 돌려준다. keepalive도 `peek.userId !== owner`면 보내지 않는다. ② `Sync`에서 `user_changed`를 받으면 `phase="stopped"` + 로컬 삭제 + 새로고침. ③ 아래 M1(`pageshow`)도 함께 고친다 |
| M1 | Medium (교차 노출 경로, 실기기 확인 못 함) | `persist.js` 전체: `pageshow` 처리가 없음 | 같은 탭에서 앱 → "← 차시로"(top 이동) → 블로그 로그아웃 → B 로그인 → **뒤로 가기**. bfcache로 복원되면 A의 화면(입력값이 든 DOM)이 그대로 보이고, 얼어 있는 동안 난 storage 이벤트는 전달되지 않는다. 그다음 입력은 H1대로 B의 행에 저장된다. 30초가 지나 `visibilitychange`로 `reconcile`이 돌 때까지 A의 내용이 보인다 | headless Chrome에서는 bfcache가 동작하지 않아(복원 대신 다시 불러옴 → 정상 동작) 재현하지 못했다. iPad Safari와 Android Chrome은 bfcache를 적극적으로 쓴다. supabase-js의 BroadcastChannel이 bfcache를 막는지는 브라우저마다 다르다 | `window.addEventListener("pageshow", e => { if (e.persisted) { const p = R().peekSession(); if (!p) toLogin(); else if (p.userId !== owner) { phase="stopped"; location.reload(); } else reconcile(); } })`. 가능하면 `pageshow`마다 주인을 다시 확인한다 |
| M2 | Medium (데이터 손실) | `src/lib/auth.ts:62-69`, `src/lib/local-data.ts:32`, `src/components/user-menu.tsx:130-132`; `persist.js:311-319`(`toLogin`) | 로그아웃은 확인 없이 `sci6…`를 모두 지운다. DB에 아직 못 올린 변경(`__sync.dirty=true`: 오프라인, 저장 실패 재시도 중, 1초 디바운스 중, **마이그레이션 전 `local-only` 단계의 모든 입력**)도 함께 사라진다. 지침상 삭제는 맞지만 경고가 없다 | 코드 경로로 확인. 앱에서 오프라인 입력(dirty) → 블로그 로그아웃 → `sci6` 삭제 → 다시 로그인하면 DB에는 이전 기록만 있음 | 로그아웃 전에 `sci6…:__sync` 중 `dirty:true`가 있으면 "아직 저장되지 않은 과학 기록이 있어요. 로그아웃하면 사라져요" 확인 창을 띄운다(삭제 규칙은 유지). 여유가 되면 로그아웃 직전에 BroadcastChannel로 앱 탭에 flush를 요청하고 짧게 기다린다 |
| M3 | Medium (데이터 손실) | `persist.js:419-424` | 충돌을 **스냅샷 전체 기준 최근 것이 이김**으로 처리하고, 비교가 서버 시각(`updated_at`)과 이 기기 시계(`localAt`) 사이다. 태블릿 시계가 늦거나 다른 기기가 나중에 저장했으면, 오프라인 동안 쓴 변경(dirty)이 `restore()`로 **아무 알림 없이** 버려진다. 두 기기를 동시에 쓰면 한쪽 입력 전체가 사라진다(보고서에도 적힘) | 코드 경로로 확인 | 비교 기준을 기기 시계가 아니라 `syncedAt`(서버 시각)으로 바꾸거나, 둘 다 바뀌었으면 버리기 전에 로컬 스냅샷을 `…:__conflict`에 보관하고 "다른 기기 기록으로 바꿨어요" 안내를 띄운다. 가능하면 키 단위로 병합한다 |
| M4 | Medium (남은 위험, 설계 한계) | `persist.js:377-383`, 공용 태블릿 운영 | 로그아웃하지 않고 넘겨주면 다음 학생이 앞 학생의 앱과 블로그를 그대로 쓴다(유휴 타임아웃 없음). 오프라인이고 토큰이 만료됐으면 `requireUser`가 `offline`을 돌려주고, "믿을 수 있는 로컬"이라 가림막을 내려 앞 학생의 기록을 보여준다 | 코드 경로로 확인 | 수업 운영 안내(끝나면 로그아웃)에 더해, 예를 들어 10~15분 입력이 없으면 "계속하려면 누르세요 (내가 ○○이 아니면 로그아웃)" 가림막을 띄우는 방안. 오프라인 + 만료 토큰이면 이름을 확인하게 한다 |
| L1 | Low | `persist.js:601-609` | 로그인 상태로 시작한 뒤 `toLogin`되면(다른 탭 로그아웃) 재로그인 감지 storage 리스너가 없어 자동으로 새로고침되지 않는다(가림막의 로그인 링크는 동작). 이미 그려진 DOM과 store의 `memory` 객체에 A의 입력이 가림막 뒤에 남는다(불투명 가림막 + `inert`라 화면에는 안 보임) | 코드 | `toLogin` 때 리스너를 붙이거나 `location.reload()`로 DOM과 메모리를 비운다(로그인 안내는 다시 뜬다) |
| L2 | Low | `persist.js:628-647` + 로그아웃 | "처음부터 다시"를 오프라인에서 하면 `pendingClear`가 meta에만 남는다. 그 상태로 로그아웃하면 meta가 지워져 다음 로그인 때 DB의 옛 기록이 되살아난다(손실이 아니라 되살아남) | 코드 | 받아들일 수 있음. 필요하면 로그아웃 확인 창(M2)에 포함 |
| L3 | Low (RLS 남용) | `supabase/migrations/20260922010000_app_progress.sql:33-42` | 로그인 사용자는 `sci-` 형식이기만 하면 아무 `app_id`로나 256KB 행을 만들 수 있다(사용자당 행 수 제한 없음). 저장 공간 남용 가능 | SQL 검토 | `app_id`를 실제 앱 목록으로 제한하거나(`^sci-[0-9]-[0-9]-[0-9]-[0-9]+$`), 사용자당 행 수 제한 트리거 |
| L4 | Low | `src/lib/login-redirect.ts:53-67`, `login-form.tsx` | OAuth를 시작하며 기억한 `next`가 10분 동안 남는다. 같은 탭에서 OAuth를 취소한 뒤 다른 사람이 비밀번호로 로그인해도 그 경로로 간다(경로만, 정보 노출 없음) | 코드 | 비밀번호 로그인 성공 시 `rememberLoginNext(null)` 뒤 `nextFromLocation()`만 쓰거나, OAuth 복귀(`code`/`access_token` 있음)일 때만 기억값을 쓴다 |
| L5 | Low (알려진 동작) | `persist.js:552-557` | 배포 직후 첫 실행 때 meta가 없어 기존 로컬 진행분이 지워진다(보고서 "사용자가 할 일" 3번) | 코드 | 공지로 충분. 수업 중이 아닐 때 배포 |
| L6 | Low | `persist.js:510-511` | `too_large`면 상태만 표시하고 재시도나 안내를 하지 않는다. 로그아웃하면 사라진다 | 코드 | 학생용 안내 문구("선생님께 알려 주세요")를 넣고 M2 확인 창 대상에 포함 |
| I1 | Info | 실 DB | anon GET과 POST 모두 `PGRST205`(테이블 없음, 404). 마이그레이션이 아직 실행되지 않았다 | `curl`(anon key, 읽기/거부 요청만) | 실행 뒤 anon GET → `[]` 또는 401, anon POST → 401/42501인지 다시 확인 |
| I2 | Info | dev 서버 | `next dev`는 `/class1/apps/sci-…/`(디렉터리)에 404를 내고 `index.html`만 준다. GitHub Pages에서는 문제 없음. `loginUrl()`의 next에 `index.html`이 붙을 수 있으나 무해 | curl | 없음 |
| I3 | Info | `CLAUDE.md` | 과학 앱 규칙 변경이 diff에 있다(지침의 기준 문서). Build 수정 범위 밖 파일이므로 사용자가 직접 바꾼 것인지 확인할 것 | git diff | — |

## 시나리오별 확인 결과

| 시나리오 | 결과 |
|---|---|
| 비로그인으로 앱 열기 | ✅ 로그인 안내 가림막, `next=` 링크(`target=_top`), `sci6…` 삭제(headless 확인) |
| 로그인 A 입력 → 저장 | ✅ upsert 1회, `Authorization=A`, `user_id=A`, payload에 입력 글(headless) |
| 로그아웃 없이 넘겨줌 | ⚠️ 막을 방법 없음(M4) |
| 세션 만료 | ✅ 블로그: `SIGNED_OUT`이면 삭제, `getSession`이 세션 없음(오류 없음)이면 삭제. 앱: `requireUser` not_logged_in → `toLogin`. ⚠️ 오프라인 + 만료면 로컬을 보여줌(M4) |
| 다른 탭에서 로그아웃 | ✅ 코드상 storage(세션 키 삭제) + `SIGNED_OUT` → `toLogin`. 블로그는 앞뒤로 두 번 삭제해서 앱 탭이 다시 쓰는 경쟁도 막음 |
| 앱을 연 채 로그아웃 → 다른 학생 로그인 | ✅ 이벤트를 받으면 새로고침 후 주인 불일치로 삭제. ❌ **이벤트를 놓치면 A의 입력이 B의 DB 행에 저장됨(H1, 재현)** |
| 뒤로 가기(bfcache) | ⚠️ `pageshow` 처리 없음(M1). headless에서는 bfcache가 동작하지 않아 실기기 미확인 |
| 로그아웃 후 `sci6` 키가 모두 사라지는지 | ✅ `startsWith("sci6")` 전수 삭제. 앱 12개 `storageKey` 모두 `sci6…`(`sci611sim1:v1` … `sci6126guide:v1`, 하위 `:fill` 포함) |
| 틀을 거치지 않는 저장 | ✅ 앱 `app.js`/`data/*.js`/`index.html`에 `localStorage`·`sessionStorage`·`indexedDB`·`cookie` 직접 사용 없음. 틀에서도 persist.js와 class1-record.js 밖에는 없음(`record-store.js`는 주석뿐) |
| RLS | ✅ 본인 select/insert/update/delete(`with check`로 `user_id` 위조 불가, upsert도 insert check에 걸림), 관리자 select, anon `revoke all`, 재실행 안전(`if not exists`/`drop … if exists`), 기존 테이블·정책 건드리지 않음, `set_updated_at`/`is_admin` 기존 함수 재사용. ⚠️ L3 |
| 크기 제한 | ✅ DB 256KB check + 클라이언트 사전 검사, keepalive 60KB 한도 |
| 두 기기 / 오프라인 복귀 | ⚠️ 스냅샷 전체 LWW + 기기 시계 비교(M3) |
| 저장 실패 중 로그아웃 | ❌ 경고 없이 손실(M2) |
| 디바운스 중 페이지 이동 | ✅ `pagehide`/`hidden`에서 `flushAllPending` 뒤 keepalive 전송 |
| 저장 실패 표시·재시도 | ✅ 상태 표시와 3초→60초 백오프. ⚠️ too_large는 재시도 없음(L6) |
| `?next=` 오픈 리다이렉트 | ✅ `safeNextPath`를 18개 사례로 실행: `//evil`, `/\evil`, `https:`, `javascript:`, `/class1//evil`, 탭·제어문자, `/./\evil`은 거부. `%2F%2F`·`%5C`·`..`·`%2e%2e`는 같은 사이트 경로로 정규화되고 basePath 안에 머묾. 결과는 모두 `/` 하나로 시작하고 `withBasePath`나 router가 `/class1`을 붙인다 |
| OAuth 뒤 복귀 | ✅ 코드상 sessionStorage 10분 기억(L4). 실제 OAuth 왕복은 못 함 |
| 기존 기능 회귀 | ✅ `app_results` `save()` 변경 없음, 테마·사이드바 키 유지(`sci6`만 삭제), 에디터 초안은 직접 로그아웃할 때만 삭제(세션 만료 복구 유지), 로그아웃 뒤 이동 동일 |
| 빌드·lint | ✅ `npm run lint` 통과, `npm run build` 통과(정적 export), 앱과 틀 JS 전부 `node --check` 통과 |
| 틀 사본 일치 | ✅ 12개 앱 `diff -r` 일치(sim 9, guide 3), `class1-record.js` 12개 `cmp` 일치. sim/guide `persist.js`는 머리 주석 한 줄만 다름 |
| 콘솔 오류 | ✅ headless 실행 중 오류·예외 0 |

## 확인한 것 vs 못 한 것

**확인한 것**
- 모든 diff와 새 파일의 코드 검토(SQL, class1-record.js, persist.js, lesson.js 두 종, 블로그 4파일).
- 자체 headless Chrome(별도 프로필, 포트 9337, 끝나고 종료) + CDP `Fetch` 가로채기 가짜 Supabase로 sci-6-1-1-2에서 A 로그인 → 입력 → upsert payload, 로그아웃과 B 로그인 뒤 다시 불러오기(B 화면에 A 내용 없음), **H1 재현**(세션을 조용히 바꾸면 A의 내용이 B의 행으로 upsert됨).
- 실 DB: anon key로 GET과 거부되어야 하는 POST만 보냄 → 테이블 없음(PGRST205). 쓰기는 일어나지 않았다.
- `safeNextPath` 우회 사례 18개 실행, lint, build, `node --check`, 사본 `diff -r`/`cmp`, 저장소 직접 접근 전수 `grep`.

**못 한 것**
- 실제 Supabase에서 RLS 동작(마이그레이션 미실행). 실행 뒤 두 계정으로 교차 select/upsert/delete가 거부되는지, anon이 401인지 확인해야 한다.
- 실기기(iPad Safari, Android Chrome)의 bfcache 뒤로 가기(M1), 백그라운드 탭이 얼었을 때 storage 이벤트가 전달되는지.
- 실제 OAuth 왕복 뒤 `next` 복귀, 두 실기기 동시 사용, 모바일 뷰포트 시각 점검, guide 앱(sci-6-1-1-6 `:fill`)의 브라우저 흐름(코드로만 확인).
