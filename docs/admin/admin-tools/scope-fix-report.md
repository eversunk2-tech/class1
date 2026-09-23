# Build 보고: 로그인 잠금 범위 고치기 (scope-fix)

지침: `docs/admin/admin-tools/scope-fix-instructions.md` · 설계 배경: `docs/admin/admin-tools/spec.md` §2
이미 실행된 마이그레이션 `20260923000000` · `20260923010000` 은 **고치지 않았다**. git 명령·실 DB 쓰기·실제 Auth 호출 없음.

---

## 1. 확정 동작 (구현 결과)

| 상태 | 홈·메뉴 | 블로그 글 | 자유게시판 | 학습게임 | 과학 앱 |
|---|---|---|---|---|---|
| 잠금 **꺼짐**(기본) | 다 보임 | 누구나 읽기 | 누구나 읽기 | 누구나 읽기 | **체험 모드로 실행** — 저장 안 됨 |
| 잠금 **켜짐** | 다 보임(칸만 안내로 바뀜) | 로그인 안내 | 로그인 안내 | 로그인 안내 | 로그인 안내 가림막 |

로그인·비밀번호 재설정은 늘 열려 있고, `site_settings` 읽기는 어떤 경우에도 잠그지 않는다. 관리자는 항상 로그인 상태라 모든 게이트를 통과한다.

---

## 2. SQL — 새 마이그레이션 1개 (사용자가 실행)

`supabase/migrations/20260923020000_login_required_scope.sql` (재실행 안전, `drop policy if exists` + `create policy`만 사용)

| 테이블 | 정책 | 조치 |
|---|---|---|
| `posts` | 공개 글은 누구나… | 게이트 **유지** |
| `comments` | 공개 글의 댓글… | 유지 |
| `community_posts` | 숨김 아니면 누구나… | 유지 |
| `community_comments` | 숨김 아니면 누구나 | 유지 |
| `community_likes` | 볼 수 있는 글만 조회 | 유지 |
| `storage.objects` (game-uploads) | 볼 수 있는 게임·본인·관리자 | 유지 |
| `profiles` | 누구나 조회 | **게이트 제거** → `using (true)` (20260921000000 원문과 동일) |
| `likes` | 누구나 조회 | 제거 → `using (true)` (원문 동일) |
| `views` | 누구나 조회 | 제거 → `using (true)` (원문 동일) |
| `assignments` | 공개된 것은 누구나… | 제거 → `using (published or public.is_admin())` (20260921020000 원문 동일) |

되돌린 4개는 원본 마이그레이션의 `using` 절과 **글자 그대로** 같은지 대조했다.
`site_settings` 정책·`can_browse()`·`login_required()`·`admin_set_login_required()`는 손대지 않았다.

`increment_post_view()`는 20260923010000에서 넣은 `can_browse()` 검사를 **그대로 두었다**. 잠금 중 비로그인은 글 자체를 못 읽으므로 조회수를 올릴 일이 없고, `views` 조회는 다시 공개라 화면에는 영향이 없다.

---

## 3. 과학 앱 — 체험 모드 (정본 3곳 + 23개 앱 사본)

고친 정본 파일
* `scripts/templates/class1-record.js` — `Class1Record.fetchLoginRequired()` 추가. `site_settings.login_required`를 anon 키로 직접 읽고(공개 읽기), **읽지 못하면 무조건 `false`(잠금 꺼짐)**. `init()` 전에도 부를 수 있게 `config.js` 값을 쓴다.
* `scripts/templates/science-sim/persist.js`, `scripts/templates/science-guide/persist.js` — phase에 `checking` · `trial` 추가.
* `scripts/templates/science-sim/lesson.js`, `science-guide/lesson.js` — 체험 모드면 `Class1Record.save()`를 아예 부르지 않는다.
* `scripts/templates/science-sim/answer-check.js`, `science-guide/answer-check.js` — 체험 모드면 `check-answer` Edge Function을 부르지 않고 로컬 규칙만 쓴다.

흐름(비로그인으로 앱을 열 때)
1. `createStore` → 세션 없음 → 주인이 `"__guest__"`가 아닌 sci6… 로컬 기록(앞 학생 것)을 지우고 "활동을 여는 중이에요…" 가림막.
2. `fetchLoginRequired()` → **켜짐**이면 지금까지처럼 로그인 안내(+ sci6… 전부 삭제), **꺼짐**이면 체험 모드.
3. 체험 모드: 가림막을 걷고 머리말에 `💡 체험 모드예요 — 적은 내용은 이 기기에만 남아요. [로그인하면 기록이 저장돼요]`(로그인 링크, `target=_top`) + 상태 배지 `체험 모드 · 기록이 저장되지 않아요`. 모든 단계 사용 가능, 입력은 localStorage에만.
4. 로그아웃 직후 돌아온 경우(`sciSync:loginMsg`가 있음)는 체험 모드로 흘려보내지 않고 바로 로그인 안내를 띄운다.

**호출 0건 보장**: `start()`가 `checking`/`trial`이면 `requireUser()`·`reconcile()` 전에 반환하고, `reconcile()`·`_changed()`도 이 phase에서 곧바로 반환한다. `onAuthChange` 콜백도 무시한다.

**체험 기록을 이어받지 않는 근거**: 체험 기록의 주인 표시는 `"__guest__"`다. 로그인한 학생이 앱을 열면 기존 주인 확인 규칙(`meta.owner !== 현재 사용자 → clearAppLocal()`)에 그대로 걸려 즉시 지워진다. 체험 기록은 **누가 썼는지 서버로 확인할 길이 없어**, 이어받으면 다른 사람이 쓴 내용을 그 학생 이름으로 DB에 올리게 된다(주인 확인 규칙 ④를 깨뜨림). 그래서 "이어받지 않고 지운다"로 정했다. 체험 중 다른 탭에서 로그인하면 `recheckOwner()`가 새로고침해 평소 흐름으로 들어간다.

**바꾸지 않은 것**: 저장 키(`:vN`), `app_progress.state` 스냅샷 모양, `app_results.detail`/`detail.qa` 모양, 로그인 상태에서의 동기화·충돌 규칙 전부.

### 동기화 확인
23개 앱 사본에 정본을 다시 복사했고 `diff -r`로 확인했다 — **불일치 0건**.
```
diff -r: ALL 23 APPS IN SYNC WITH TEMPLATES
node --check (persist.js sim/guide, class1-record.js) → JS SYNTAX OK
```

---

## 4. 사이트 화면

| 파일 | 바꾼 것 |
|---|---|
| `src/hooks/use-login-lock.ts` (신규) | `useLoginLocked()` — 잠금 켜짐 + 비로그인일 때만 true. 설정을 못 읽으면 false |
| `src/components/login-gate.tsx` | 전체 가림 → **경로 접두사 목록**(`/post/`, `/board/`, `/games/`, `/search/`)만 가린다. 홈·`/science/`·로그인·재설정·관리자는 대상 아님. 홈 칸용 `LoginNeededNotice` 추가 |
| `src/components/class/tagged-post-list.tsx` | 잠김이면 "로그인하면 볼 수 있어요" 안내(홈·과학수업 글 목록) |
| `src/components/community/community-post-list.tsx` | 같은 안내(홈 미리보기·게시판·게임 목록) |
| `src/components/dashboard/stat-tile.tsx` | 잠김이면 `0개` 대신 🔒 `로그인 필요`. 과학 차시 앱 수(코드 데이터)는 그대로 |
| `src/components/admin/login-required-card.tsx` | 켜짐/꺼짐 설명과 확인 다이얼로그 문구를 새 범위로(막히는 것/안 막히는 것 명시) |

---

## 5. 검증 (가짜 Supabase — 실 DB·실 Auth 호출 없음)

내 전용 포트에서 확인했다: 8815 = `next build` 결과 정적 사이트, 8816 = 가짜 Supabase(REST·auth·RPC를 흉내 내고 `can_browse()` 규칙을 그대로 재현). 로그인은 가짜 JWT를 localStorage에 넣어 흉내 냈고, `localStorage.clear()`는 쓰지 않았다(내 키만 제거). 끝나고 두 서버를 종료하고 임시 파일을 지웠다.

| # | 잠금 | 로그인 | 홈 | 블로그 글(`/post/`) | 게시판 `/board/` | 게임 `/games/` | 과학 앱 |
|---|---|---|---|---|---|---|---|
| 1 | 꺼짐 | 아니오 | 정상(글·게시판·게임 다 보임) | 정상 | 정상 | 정상 | **체험 모드로 실행** |
| 2 | 켜짐 | 아니오 | 레이아웃 그대로 + 세 칸 "로그인하면 볼 수 있어요", 타일 "로그인 필요", 과학 차시 목록 그대로 | 로그인 안내 | 로그인 안내 | 로그인 안내 | 로그인 안내 가림막 |
| 3 | 꺼짐 | 예 | 정상 | 정상 | 정상 | 정상 | 평소대로(`app_progress` GET 확인) |
| 4 | 켜짐 | 예 | 정상(모두 보임) | 정상 | 정상 | 정상 | 평소대로 |

추가 확인
* `/login/`은 네 경우 모두 열린다. `/science/`는 잠금 중에도 학기·단원·차시 목록이 그대로 보이고 "과학 수업 글" 칸만 안내로 바뀐다.
* **체험 모드 저장 호출 0건**: 실험 앱(`sci-6-1-2-3`)을 예상→실험(5.0초, 135.0/122.0 cm 기록)→분석(2문항)→정리→**학습 마치기**까지 끝냈고, 서버 기록은 `[]`(app_progress·app_results·Edge Function 모두 0건). 완료 카드에 "체험 모드라서 결과는 저장되지 않았어요. 로그인하면 기록이 남아요." 표시.
* 조사 앱(`sci-6-1-1-5`)도 체험 모드로 열리고, 입력 후 새로고침해도 이 기기 기록이 그대로 이어졌다(그 사이에도 DB 호출 0건).
* 체험 기록이 있는 상태에서 로그인하고 다시 열면 체험 기록이 지워지고 `owner = 학생 id`, phase `ready`로 들어가며 `app_progress` GET이 1건 발생했다.
* 관리자 개요의 토글 카드: 새 설명 문구와 확인 다이얼로그 문구가 그대로 뜨고, 끄기는 즉시·켜기는 다이얼로그 경유로 동작했다.
* 태블릿(1280·1100)·모바일 375px·다크 모드에서 모두 확인. **콘솔 오류 0건**(과학 앱·홈 모두).
* `npm run lint` · `npx tsc --noEmit` · `npm run build` 모두 통과.

---

## 6. 사용자가 할 일

1. Supabase SQL Editor에서 **`supabase/migrations/20260923020000_login_required_scope.sql`** 전체를 붙여넣고 실행한다(재실행 안전).
2. 파일 맨 위 확인 쿼리로 점검한다.
   * 게이트가 남은 정책이 **6개**인지: `select schemaname, tablename, policyname from pg_policies where qual like '%can_browse%' order by 1,2;`
     → `public`: posts / comments / community_posts / community_comments / community_likes, `storage`: game-uploads
   * 되돌린 4개(`profiles`·`likes`·`views`·`assignments`)의 `qual`에 `can_browse`가 없는지.
3. SQL 실행이 끝난 뒤에 사이트를 배포한다(화면이 새 정책을 전제로 하므로 SQL → 확인 → push 순서).
4. 배포 후 시크릿 창에서: 잠금 꺼짐 상태로 과학 앱이 체험 모드로 열리는지 → 관리자 화면에서 잠금을 켠 뒤 홈은 열리고 글·게시판·게임·앱만 막히는지 → 다시 끄면 원복되는지.
   * ⚠ `select public.admin_set_login_required(true);`를 SQL Editor에서 실행하지 않는다(관리자 화면 스위치로만).

---

## 7. 확인하지 못한 것

* **실 Supabase에서의 RLS 동작** — SQL은 실행하지 않았다(규칙상 사용자가 실행). 정책 문구는 원본 마이그레이션과 대조만 했다.
* **실제 iPad/태블릿 터치** — 체험 모드 안내 줄·3D 드래그는 데스크톱 브라우저에서만 확인했다.
* **실제 Auth 로그인/로그아웃 흐름** — 가짜 세션으로만 시험했다. "체험 중 블로그에서 로그인 → 앱 탭이 새로고침되어 학생 기록으로 바뀌는지"는 같은 탭 새로고침으로만 확인했고, 두 탭 동시(storage 이벤트) 경로는 실제 Auth로 확인하지 못했다.
* **Gemini 답 되짚기(check-answer)** — 체험 모드에서 부르지 않는 것만 확인했고, 실제 함수는 호출하지 않았다(로그인 상태의 기존 동작은 바뀌지 않았다).
* **잠금을 켠 순간 이미 열려 있던 과학 앱** — 그 화면은 다시 확인하지 않는다(새로고침해야 반영). 관리자 카드 문구에 이 한계를 적어 두었다.
* 마이그레이션을 실행하기 전에는 `profiles`·`likes`·`views`·`assignments`가 잠긴 상태로 남아, 잠금을 켜면 홈 일부가 지금도 빈칸으로 보일 수 있다. 1번을 먼저 실행해야 한다.
