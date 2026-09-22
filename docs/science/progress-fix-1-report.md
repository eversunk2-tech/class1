# Fix 1 보고: 진행 상황 동기화 review 1차 수정 (2026-09-22)

지침: `docs/science/progress-fix-1-instructions.md`. 대상: `docs/science/progress-review.md`의 High 1, Medium 4, Low 6 (Info 3은 판단만).
커밋·푸시 안 함. 실 DB에 쓰지 않음(모든 Supabase 요청은 로컬 가짜 서버로 보냄). 줄 번호는 정본 `scripts/templates/` 기준이며 12개 앱 사본도 같다.

## 항목별 처리

| # | 처리 | 위치(파일:줄) |
|---|---|---|
| **H1** 다른 학생 행 덮어쓰기 | 진행 상황 요청이 supabase-js 대신 **직접 확인한 토큰 하나**로 REST를 부르게 바꿨다. 이 토큰의 JWT `sub`(서버 RLS가 보는 사용자)가 `expectedUserId`(페이지의 기록 주인)와 다르면 요청하지 않고 `user_changed`를 돌려준다. 이 규칙은 `loadProgress`·`saveProgress`·`clearProgress`와 종료 때 keepalive 경로 모두에 적용된다(keepalive는 localStorage 세션을 동기로 읽어 확인). `Sync`는 모든 요청에 `owner`를 넘긴다. `user_changed`를 받으면 멈추고, 가림막을 씌우고, 앞 사람 로컬을 지운 뒤 새 사용자로 다시 연다. 저장 직전에 로컬 세션도 한 번 더 본다. "학습 마치기"의 `app_results` 저장도 `expectedUserId`를 확인한다 | `class1-record.js:326 authFor`, `:347 authSync`, `:499-531` load/save/clear, `:208` save; `persist.js:497 onUserChanged`, `:852-858` saveNow 전 세션 확인; `lesson.js:217`(sim)·`:227`(guide) |
| **M1** 뒤로 가기 캐시 | 떠날 때(`pagehide`·`hidden`) "로그인을 확인하고 있어요" 가림막(`inert`)을 먼저 씌운다. 돌아올 때(`pageshow` persisted·`visible`·`focus`·모든 `storage` 이벤트)는 세션을 동기로 다시 확인해서 주인이 그대로일 때만 가림막을 걷는다. 로그아웃이면 로그인 안내를 띄우고 새로고침하며, 다른 사람이면 삭제한 뒤 다시 연다. bfcache에서 되살아나도 확인 전에는 활동 화면이 보이지 않는다. 숨은 탭에서 맞추기가 끝나도 가림막은 남는다 | `persist.js:509 recheckOwner`, `:531 cover`, `:534 onReturn`, `:799 goReadyGateOnly`, `:1003-1022` 이벤트 |
| **M2** 로그아웃 시 못 올린 기록 | 앱이 `<storageKey>:__meta`에 `{appId,title,owner,syncedAt,dirty,localAt,pendingClear}`를 남긴다(앞 판 `:__sync`는 자동으로 옮김). 블로그 `signOut`은 먼저 BroadcastChannel로 열린 앱 탭에 미뤄 둔 입력을 로컬에 쓰라고 알린다. 그다음 **signOut 전에** dirty 앱 스냅샷을 지금 세션으로 올린다(**owner가 같을 때만**, 조건부 저장). 실패하거나 테이블이 없으면 "저장되지 않은 활동이 있어요 … 그래도 로그아웃할까요?"(테이블 없음은 따로 알림)를 묻고, 취소하면 로그아웃하지 않는다. 오프라인이어도 `scope:"local"`로 이 기기 세션은 반드시 지운다 | `src/lib/science-progress.ts`(신규) `:233 flushScienceProgress`, `:271` 주인 확인; `src/lib/auth.ts:67 signOut`; `src/components/user-menu.tsx:131`; `persist.js:115 readMeta`(옮김), `:1023` BroadcastChannel |
| **M3** 두 기기 충돌 | 기기 시계로 비교하지 않는다. 저장은 `baseUpdatedAt`(마지막으로 맞춘 서버 `updated_at`)이 같을 때만 PATCH하고, 행이 없을 때만 insert한다. 그 사이 서버가 바뀌었으면 `conflict`로 막는다. 맞추기 규칙: 서버 변경 없음이면 로컬, 로컬 변경 없음이면 서버, **둘 다 바뀌었으면 "📱 이 기기의 기록 / ☁️ 저장된 기록" 가운데 학생이 고르고, 각 기록의 마지막 시각을 보여 준다**(한 번 더 확인). 내용이 같으면(키 순서만 다름) 묻지 않고 맞춘 것으로 본다 | `class1-record.js:445 saveFor`; `persist.js:658 askConflict`, `:779-797` 규칙, `:888-893` 저장 중 충돌 |
| **M4** 넘겨준 태블릿 | 머리말에 "👤 **아이디** 계정으로 로그인 중 · 내가 아니면 [로그아웃]"을 넣었다(`.ss-who`). 버튼은 블로그와 같은 절차다: 미뤄 둔 입력 쓰기 → 업로드 → 충돌·실패 확인 → 로그아웃 → `sci6`·에디터 초안 삭제 → 로그인 안내. 오프라인이고 토큰이 만료됐으면 로컬을 보여 주기 전에 "○○ 학생이 맞나요?"를 묻는다. 무입력 자동 로그아웃은 넣지 않았다 | `persist.js:409 renderWho`, `:588 logout`, `:731-745` 본인 확인; `class1-record.js:586 flushLocalProgress`, `:669 signOut` |
| **L1** toLogin 뒤 DOM·메모리 | 쓰던 화면에서 로그아웃되면 로컬을 지우고 새로고침해 DOM과 메모리를 비운다(문구는 sessionStorage로 넘김). 로그인 안내 중에 다른 탭에서 로그인하면 자동으로 이어서 한다 | `persist.js:478 toLogin`, `:1003` storage |
| **L2** 오프라인 "처음부터 다시" 뒤 로그아웃 | 로그아웃할 때 `pendingClear`인 행을 DELETE한다. 실패하면 확인 창에 포함한다 | `science-progress.ts`(pendingClear 분기), `class1-record.js:612-619` |
| **L3** RLS 남용 | `app_id`를 `^sci-[0-9]{1,2}-[0-9]-[0-9]{1,2}-[0-9]{1,2}$`로 좁혔다(`not valid`로 재실행 안전). 사용자당 200행 제한 트리거를 넣었다(이미 있는 행의 upsert는 통과). 파괴적 변경은 없다 | `supabase/migrations/20260922010000_app_progress.sql:31-37, 54-76` |
| **L4** OAuth 기억값 | 비밀번호로 로그인하면 기억값을 지우고 주소의 `?next=`만 쓴다. OAuth로 돌아왔을 때만 기억값을 쓴다 | `src/app/login/login-form.tsx:39-48, 66-67` |
| **L5** 배포 직후 첫 실행 삭제 | 주인이 없는 옛 로컬 기록은 개인정보 보호를 위해 그대로 지운다(판단). 이번 판에서 표시 키를 바꾸면서(`__sync`→`__meta`) 지워지는 일이 없게 옮기기를 넣었다. 수업이 없는 시간에 배포하고 공지할 것 | `persist.js:115` |
| **L6** too_large | "기록이 너무 커서 저장하지 못했어요 · 선생님께 알려 주세요"를 보여 준다. dirty는 그대로 두고, 로그아웃 확인 창에 "너무 커서"를 포함한다 | `persist.js:906`, `science-progress.ts unsavedQuestion` |
| I1-I3 | 확인만 함. I3(`CLAUDE.md` 변경)은 수정 범위 밖이라 건드리지 않았다 | — |

틀 README 두 개에 사용법을 추가했다. 정본을 **12개 앱 전부에 복사**했고 `diff -r`/`cmp` 불일치 0이다(sim 9, guide 3, class1-record 12).

## 재현·회귀 테스트 (자체 headless Chrome + 로컬 가짜 Supabase, 스크래치)
가짜 Supabase는 로컬 Node 서버다(RLS 흉내: JWT sub ≠ user_id면 403, 서버 시각 `updated_at`을 `+00:00` 형식으로 줌, 중복 insert는 409, 테이블 없음은 PGRST205, 오프라인은 소켓 끊기). 앱 사본의 config는 이 서버를 가리키고, 세션 키 이름은 실제와 같다. 블로그 `auth.ts`·`science-progress.ts`·`login-redirect.ts`는 TS를 JS로 바꿔 같은 출처 페이지에서 실행했다.
- **기존 8개 시나리오 × 앱 3개**(sim sci-6-1-1-2, sim sci-6-1-2-3, guide sci-6-1-1-6): **55/55 통과**
- **review 재현 + 새 동작 × 앱 3개: 44 × 3 = 132/132 통과**
  - H1: 같은 문서에서 세션을 B로 조용히 바꾼 뒤 수정해도 **B 토큰 쓰기 요청 0건**이고 B 행은 그대로다. A 로컬은 지워지고 B 기록으로 다시 열린다. keepalive(pagehide)도 0건이다. API 5종(save keepalive/save/load/clear/app_results)은 `user_changed`를 돌려주고 요청은 0건이다.
  - M1: pagehide·hidden에 가림막이 생기고, 같은 주인이면 걷힌다. visible인데 다른 사람이면 가림막이 유지된 채 B로 바뀐다. focus 때 로그아웃돼 있으면 로그인 안내가 뜬다. 실제 뒤로 가기는 headless에서 bfcache가 동작하지 않아 다시 불러오기 경로만 확인했다(A 내용 없음). bfcache 경로는 합성 `pageshow(persisted)`로 확인했다.
  - M2: 오프라인 입력(dirty)이 블로그 로그아웃 때 **signOut보다 먼저** A 토큰으로 올라간다. 실패하면 확인을 받고(취소하면 로그아웃 안 함), 동의하면 오프라인이어도 세션과 `sci6`를 지운다. 테이블 없음은 따로 알린다. 열린 앱 탭의 250ms 디바운스 중 입력까지 올라간다(BroadcastChannel). 주인과 다른 세션(B)으로는 업로드 0건이다.
  - M3: 기기 시계가 30일 앞서도 둘 다 바뀌었으면 고르는 화면이 뜨고 두 시각을 보여 준다. 고르기 전 DB는 그대로다. "이 기기"를 고르면 조건부 PATCH, "저장된 기록"을 고르면 복원한다. 온라인 중 다른 기기가 저장하면 덮어쓰지 않고 고르는 화면을 띄운다. 내용이 같으면 묻지 않는다.
  - M4: 머리말 표시와 로그아웃 버튼으로 업로드 → 로그아웃 → 로그인 안내, 화면에 A 내용 없음. 오프라인 + 만료 토큰이면 "학생이 맞나요?"를 묻고, "네"를 누르면 오프라인으로 계속한다.
  - L1(다른 탭 로그아웃 → 새로고침, DOM 비움, 다시 로그인하면 자동으로 이어서), L2(로그아웃 때 DELETE), L6(표시와 확인 창)
- `npm run lint`와 `npm run build`(정적 export)가 통과했고 `tsc --noEmit`도 통과했다. 틀·앱 JS 전부 `node --check`를 통과했고, 테스트 중 콘솔 오류는 0이었다.
- 브라우저는 자체 프로필 headless(포트 9341)만 썼고 끝나면 종료했다. `localStorage.clear()`는 쓰지 않았다.

## 남은 위험
- **실제 Supabase에서 확인하지 못함**: 조건부 PATCH의 `updated_at=eq.<시각>` 비교(마이크로초 문자열 일치), RLS, 새 트리거는 마이그레이션을 실행한 뒤 두 계정으로 확인해야 한다. **SQL 파일이 바뀌었으니 다시 실행해야 한다**(재실행 안전).
- 실기기 bfcache(iPad Safari·Android Chrome)는 합성 이벤트로만 확인했다.
- 로그아웃 없이 세션이 만료(갱신 실패)되거나 다른 학생이 로그인하면, 앞 학생이 **아직 올리지 못한** 기록은 올릴 방법이 없어 지워진다. 개인정보 보호를 우선한 결과다. 블로그나 앱에서 직접 로그아웃하면 올린다.
- 로그아웃할 때 묻는 창은 `window.confirm`이다(블로그·앱). 학생에게 익숙하지 않을 수 있다.
- keepalive는 본문이 60KB 이하일 때만 쓴다. 큰 기록은 페이지를 닫으면 끊길 수 있지만 dirty가 남아 다음에 열거나 로그아웃할 때 올라간다.
- 주인 표시가 없는 옛 로컬 기록은 배포 후 첫 실행 때 지워진다(L5).
