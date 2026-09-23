# Review 보고서: 관리자 계정 생성(단일 + 엑셀 일괄) — 2026-09-23

지침: `docs/admin/create-members/build-instructions.md`
대조: `docs/admin/create-members/build-report.md`

리뷰 방식: 실 DB·Auth는 한 번도 부르지 않았다. `npx tsx`로 `src/lib/spreadsheet.ts`·`src/lib/member-import.ts`를
Node에서 직접 실행해 파서·검사 규칙을 테스트했고(진짜 Excel이 만드는 DEFLATE+sharedStrings 구조의 `.xlsx`를
zlib으로 직접 빚어 왕복 확인), 화면은 프로젝트를 스크래치 디렉터리에 통째로 복사(node_modules는 APFS
copy-on-write clone)한 뒤 `NEXT_PUBLIC_SUPABASE_URL`을 존재하지 않는 가짜 도메인으로 바꿔 `next build`(정적
export)하고, 내 전용 포트(4173)의 static 서버 + 내 전용 브라우저 탭에서 `window.fetch`를 가로채 Supabase/Edge
Function 응답을 흉내 냈다. 실제 프로젝트의 `.env.local`·포트 3000 dev 서버(다른 프로세스가 이미 사용 중)는
건드리지 않았다. git 명령·`localStorage.clear()`는 쓰지 않았다.

## 심각도 요약

| 심각도 | 건수 |
|---|---|
| Critical | 0 |
| High | 0 |
| Medium | 2 |
| Low | 3 |
| 참고(버그 아님) | 1 |

**보안 결함(스코프 1순위)은 찾지 못했다.** 관리자 확인이 함수 안에서 이뤄지고, 비밀번호가 응답·로그·미리보기·
localStorage·닫힌 뒤 DOM 어디에도 남지 않는다는 build-report의 핵심 주장은 실제로 재현해 확인했다.

## findings

| # | 심각도 | 위치 | 재현 | 수정 제안 |
|---|---|---|---|---|
| M1 | Medium | `supabase/functions/admin-create-member/index.ts:232-251` | 계정 생성 성공 시 `profiles`를 service_role로 직접 UPDATE만 하고, `admin-reset-password`(→`admin_finalize_password_reset`, `password_reset_log`)나 `admin-delete-member`(→`admin_finalize_withdrawal`)와 달리 **누가 언제 어떤 계정을 만들었는지 감사 로그가 전혀 남지 않는다.** build-instructions가 "새 마이그레이션 없이 가능한 방법을 먼저 찾으라"고 명시해 의도된 트레이드오프이긴 하다. | 지금 당장 막을 결함은 아니지만, 다른 두 관리자 기능과의 일관성을 위해 추후 `member_create_log`(target_id, actor_id, role, created_at) 같은 최소 감사 테이블 + `security definer` RPC를 새 마이그레이션으로 추가하는 것을 권한다. 사용자에게 "지금은 계정 생성 이력이 안 남는다"는 점을 알릴 것. |
| M2 | Medium | `src/lib/member-import.ts:224-230` (`invokeCreate`) | `FunctionsHttpError` 처리에서 응답 본문이 JSON으로 파싱되고 `body.error`가 문자열이면 **상태 코드 확인(404→"배포 필요", 401→"로그인 만료")보다 그 문자열을 무조건 우선**한다. Supabase Functions 게이트웨이(함수 미배포·프록시 오류 등 우리 함수 코드가 실행되기 전 단계)가 언젠가 `{"error": "..."}` 형태의 JSON 본문을 내려주면(예: 내 테스트에서 `{error:"not found"}`로 404를 흉내 내자 화면에 영어 "not found"가 그대로 노출되고 안내 문구 `NOT_DEPLOYED_MESSAGE`가 나오지 않음을 실제 브라우저에서 확인) 교사에게 원인을 알 수 없는 문구가 노출된다. **주의**: Supabase의 실제 "함수 없음" 응답 본문 형식(`message` 필드일 가능성이 높음)은 실 서버 호출 금지 때문에 이번 리뷰에서 확정하지 못했다 — 실제로는 `error` 키가 없어 문제가 안 될 수도 있다. | 배포 후 실제로 `admin-create-member` 함수 이름을 오타 내거나 삭제한 상태로 한 번 호출해 보고, 404 본문에 `error` 키가 있는지 확인해 주세요. 있다면 상태 코드 검사를 `body.error` 검사보다 먼저 하도록(또는 404/401일 때는 게이트웨이 메시지를 무시하도록) 순서를 바꾸는 것을 권한다. |
| L1 | Low | `src/lib/spreadsheet.ts:201-209` | 숫자 서식 셀 파싱이 `Number(value)` → `BigInt(Number(value))`를 거쳐 **2^53(약 9000조)을 넘는 값은 정밀도가 깨진다**(직접 만든 `.xlsx`로 `9007199254740993` → `9007199254740992`으로 바뀌는 것을 확인). 이미 있는 "숫자 서식이라 앞자리 0이 빠졌을 수 있다" 경고가 이 칸에도 뜨긴 하지만, 경고 문구는 "0이 빠짐"만 말하고 있어 이 경우엔 부정확하다. | 학번·비밀번호가 16자리 이상 숫자로만 이뤄질 일은 거의 없어 실질 위험은 낮다. 원한다면 경고 조건에 `Math.abs(Number(v)) > Number.MAX_SAFE_INTEGER`일 때 별도 문구("너무 큰 숫자라 일부가 바뀌었을 수 있습니다")를 추가. |
| L2 | Low | `src/lib/member-import.ts:161-175` vs `supabase/functions/admin-create-member/index.ts:197` | 화면의 파일 내 중복 검사는 **정규화된 아이디 문자열**로, 서버는 **최종 이메일**(`toEmail(id)`)로 중복을 잡는다. 한 파일에 `60101`과 `60101@class1.local`이 섞여 있으면 미리보기에는 둘 다 "만들 수 있음"으로 보이지만, 실제 전송하면 서버가 두 번째 행을 `invalid`(같은 아이디 중복)로 되돌린다(결과 자체는 안전, 안내만 늦게 뜸). | 실사용 시나리오상 발생 가능성은 매우 낮음(교사가 완전한 이메일 형식 아이디를 섞어 쓸 이유가 없음). `buildDrafts`의 `seen` 키를 `id.includes("@") ? id : `${id}@class1.local`` 식으로 서버와 맞추면 미리보기에서도 바로 잡아낼 수 있다. |
| L3 | Low | `src/components/admin/member-create-dialog.tsx:326-329` (`retryFailed`) | "실패한 N행만 다시 시도"가 `status !== "created"`인 행(즉 `failed`뿐 아니라 `exists`·`invalid`도)을 모두 다시 보낸다. `exists` 행은 재시도해도 같은 결과이므로 불필요한 함수 호출이 늘어난다(과금·GoTrue 요청 제한 관점에서 미미). | 바로 위 안내 문구("'이미 있음'은 다시 시도해도 같은 결과입니다")로 이미 사용자에게 알리고 있어 급하지 않음. 원하면 `retryFailed`가 `status === "failed"`인 행만 골라 보내도록 좁힐 수 있다. |
| 참고 | — | `/admin/*` 전 페이지 | 리뷰용 하네스(로그인 전 정적 HTML에 `localStorage`로 가짜 세션을 미리 심어 둔 상태로 hydration)에서 `/admin/members/`뿐 아니라 아무 관계 없는 `/admin/`(개요) 페이지에서도 동일하게 React 오류 #418(hydration mismatch)이 콘솔에 찍혔다. **이 기능이 만든 코드와 무관함을 두 페이지 비교로 확인**했다 — member-create-dialog 자체가 로드되기 전에 이미 발생하고, member-list.tsx의 diff도 이 부분과 무관하다. 실 로그인 상태로 배포 사이트에서 콘솔을 한 번 확인해 진짜 앱 이슈가 아닌지 확인을 권장한다(내 하네스가 원인일 가능성이 더 높다고 판단). | — | — |

## 1. 보안 (1순위) — 확인한 것

* **관리자만 호출 가능**: `admin-create-member/index.ts:140-167`에서 JWT → `authClient.auth.getUser()` → service_role로 `profiles.role` 재조회 → `admin`이 아니면 403. 화면 가드(`AdminGuard`)를 신뢰하지 않고 함수 안에서 독립적으로 확인한다. 다른 두 관리자 함수(`admin-reset-password`, `admin-delete-member`)와 동일한 패턴.
* **악의적인 로그인한 비관리자가 할 수 있는 일**: 유효한 JWT로 호출해도 ②에서 즉시 403을 받고 아무 것도 생성되지 않는다(코드 흐름상 ③ 본문 파싱조차 ②를 통과해야 도달). 브라우저에서 `window.__mockMode="forbidden"`로 재현 — 오류 문구만 뜨고 폼 입력(아이디·마스킹된 비밀번호)은 그대로 남아 사용자가 다시 시도할 수 있음을 확인.
* **service_role 키·비밀번호 노출**: 함수 코드 전체를 읽었을 때 `serviceKey`는 `admin` 클라이언트 생성에만 쓰이고 응답·로그에 절대 나타나지 않는다. `console.error` 6곳 모두 아이디까지만 찍고 비밀번호 변수(`row.password`)를 로그에 넘기는 곳이 없음을 한 줄씩 확인.
* **비밀번호가 화면에 남는지**: 실제 브라우저에서 "한 명 만들기"로 성공적으로 계정을 만든 뒤 `document.documentElement.outerHTML`에 입력한 비밀번호 문자열이 있는지 검사 → 없음(`pwStillInDom: false`), 다이얼로그 DOM 자체가 완전히 사라짐, `localStorage`/`sessionStorage`에는 내가 리뷰용으로 심은 가짜 세션 키 외에 아무 것도 없음을 확인. 엑셀 미리보기 표에는 비밀번호 대신 글자 수(`9자`)만 표시됨을 화면으로 확인.
* **요청 크기·행 수 제한**: `MAX_ROWS=100`, `MAX_BODY_BYTES=128KB`가 본문 파싱 이전에 검사됨(코드 확인). 화면은 20행씩 나눠 보내 서버 한도(100)보다 항상 작게 유지한다(코드 확인, `CHUNK_SIZE=20` < `MAX_ROWS=100`).
* **CORS**: `ALLOWED_ORIGINS`가 `admin-reset-password`·`admin-delete-member`와 동일한 두 출처만 허용. 다만 CORS 헤더는 브라우저의 프리플라이트만 막을 뿐 서버 로직 실행 자체를 막는 안전장치가 아니라는 점은 기존 두 함수와 같은 구조적 특성이며, 실제 방어는 여전히 JWT+역할 확인이 담당한다(이 기능만의 새로운 약점이 아님).
* **에러 메시지 안전성**: `createErrorMessage()`가 GoTrue 원문 대신 정해진 한국어 문구로 치환하되, 매칭되지 않는 오류는 `계정을 만들지 못했습니다. (${error.message})`로 GoTrue의 원문 일부를 노출한다 — 이 원문에 비밀번호가 들어갈 가능성은 GoTrue 자체가 비밀번호를 오류 메시지에 넣지 않으므로(값 검사만 하고 값 자체를 되돌려주지 않음) 낮다고 판단(문서·코드 관례상 확인, 실 GoTrue 오류는 재현 못 함).

## 2. 정확성 (2순위)

* **이메일 규칙 일치**: `scripts/import-users.mjs`·`src/lib/auth.ts`·`supabase/functions/admin-create-member/index.ts` 세 곳의 `LOGIN_EMAIL_DOMAIN="class1.local"`과 `toEmail()`/`loginIdToEmail()` 로직(소문자화, `@` 있으면 그대로) 세 파일을 나란히 대조 — 동일함을 확인.
* **역할 매핑**: `학생→user`, `교사→admin` 코드·문서 일치. Edge Function은 `"user"|"admin"` 외 값을 거부(별칭은 화면이 `parseRole()`로 먼저 변환해서 보냄 — 별칭 사전을 Node로 직접 실행해 `학생/학생용/일반/user/student→user`, `교사/선생/선생님/관리자/admin/teacher→admin`, 그 외 `null` 확인).
* **must_change_password=true**: 코드·주석에서 트리거(`on_auth_user_password_changed`)가 UPDATE of `encrypted_password`에만 걸려 신규 INSERT엔 안 걸린다는 근거를 `20260922000000_admin_learning_fixes.sql`에서 직접 확인 — 주장이 맞다.
* **트리거 프로필 행 없음(경합) 시나리오**: `createUser()` 응답(성공)을 기다린 **뒤에** `profiles` UPDATE를 하므로, `handle_new_user` 트리거가 같은 트랜잭션에서 이미 행을 만들어 둔 상태(Postgres 트랜잭션은 트리거까지 커밋된 뒤 응답이 온다)라 경합 가능성은 낮다고 판단(코드 리뷰로 판단, 실 Supabase로 경합을 인위 재현하진 못함).
* **이미 있는 아이디**: `isEmailExistsError()`가 `email_exists`/`user_already_exists` 코드와 메시지 패턴(`already registered`, `already exists`, `duplicate key`)을 넓게 잡아 `exists` 상태로 분류 — 비밀번호가 바뀌지 않는다는 문구도 정확(코드상 `createUser` 실패 시 `updateUserById` 호출 안 함).
* **역할 업데이트 실패 시 부분 상태 보고**: `profiles` UPDATE 실패 시 `status:"created"` + `warning`으로 계정은 유지하면서 역할·플래그 실패를 알림 — 브라우저에서 `warncase` 시나리오로 재현, "5줄 warncase: 계정은 만들었지만 설정에 실패했습니다."가 정확히 뜸을 확인.
* **파일 내 중복**: `buildDrafts`가 `Map`으로 전체 파일 범위에서 중복을 잡음(청크 단위 아님) — Node 테스트로 재확인. 서버도 청크(≤20) 단위로 별도 중복 검사(L2 참고, 화면이 먼저 걸러 서버까지 잘 도달하지 않음).
* **101행/200행**: 클라이언트 `MAX_IMPORT_ROWS=200` 경계 테스트(200=통과, 201=거부)를 Node로 직접 실행해 확인. 서버 `MAX_ROWS=100` 경계는 코드 리뷰로 확인(직접 호출 시험은 안 함, 화면은 20씩 보내 도달 안 함).
* **한글 아이디·공백 섞인 값·짧은 비밀번호**: `validateLoginId`/`validatePassword`를 30여 개 케이스로 Node에서 직접 실행(빈 값, 1자, 30/31자, 한글, 공백, 이메일 형식, 72/73바이트, 한글 비밀번호의 UTF-8 바이트 계산까지) — 모두 기대대로 동작.

## 3. 스프레드시트 파싱 (3순위) — "깨뜨려 보기" 결과

* **실제 서식 파일 왕복**: `public/templates/members-template.xlsx`(제목 줄+예시 2줄, `inlineStr`+비압축)를 파서로 직접 읽어 3칸 2줄이 정확히 나옴을 확인.
* **진짜 Excel이 만드는 구조**: build-report는 이 부분을 "선생님 컴퓨터의 실제 엑셀 파일로 확인 권장"이라며 미확인으로 남겼다. **이번 리뷰에서 직접 메꿨다** — Node의 `zlib.deflateRawSync`로 DEFLATE 압축 + `sharedStrings.xml` + 숫자 셀을 갖춘 `.xlsx`를 zip 스펙대로 손수 조립해(진짜 Excel 출력과 동일한 구조) 파서에 통과시킴. 결과: 공유 문자열 인덱스 참조, 숫자 셀 → 문자열 변환, 앞자리 0 손실 경고까지 모두 기대대로 동작.
* **큰 정수 손실**: 위 테스트 중 `999999999999999`(15자리, 안전 정수 범위 내)는 정확히 보존됐지만 `9007199254740993`(2^53+1)은 `...992`로 깨짐을 확인 → L1.
* **CSV 인코딩**: EUC-KR(CP949, 한국어 Windows 엑셀이 "CSV(쉼표로 분리)"로 저장할 때 형식)과 UTF-8+BOM(엑셀의 "CSV UTF-8" 형식) 둘 다 `iconv-lite`로 실제 바이트를 만들어 넣고 디코딩 결과를 확인 — 한글이 정확히 복원됨.
* **CSV 구조**: 따옴표 안 쉼표, CRLF, BOM 제거, 탭 구분, 닫히지 않은 따옴표 예외, 완전히 빈 줄 무시 — Node에서 직접 실행해 모두 통과.
* **.xls(예전 형식) 거부**, **손상된 zip 거부**: 각각 정확한 한국어 안내 문구로 예외 발생 확인.
* **헤더 별칭·순서 뒤섞기**: `ROLE,학번,PW` 순서로 재배열해도 정상 인식.
* **제목 줄만 있고 데이터 없음 / 빈 파일 / 역할·아이디·비밀번호 열 없음**: 각각 정확한 한국어 오류로 거부.
* **CSV 서식 내려받기 버튼(build-report가 "코드 검토만" 했다고 밝힌 부분)**: 실제 브라우저에서 클릭 → `URL.createObjectURL`에 전달되는 `Blob`을 가로채 바이트 검사 → `EF BB BF`(BOM) 확인, 내용은 "아이디,비밀번호,역할\n60101,class1234,학생\n60102,class1234,학생\n" 그대로, 파일명 `회원추가-서식.csv`. **이번 리뷰로 이 부분의 미확인 항목을 해소했다.**

## 4. UI (4순위)

375px 폭(정확히 `resize_window(375,700)`으로 설정), 다크 모드, 실제 브라우저(내 전용 포트 4173, Chromium)에서 확인.

| 확인 항목 | 결과 |
|---|---|
| 회원 추가 버튼 → 모달, 탭 전환 | 정상. 헤더의 "회원 추가" 버튼은 목록 상태(로딩/오류/빈 목록)와 무관하게 항상 렌더링됨을 코드로 확인(오류 상태에서도 계정을 만들 수 있어야 하므로 적절한 설계) |
| 한 명 만들기 성공 | 토스트 "newstu01 계정을 만들었습니다…", 모달 자동 닫힘, `member_directory`·`admin_must_change_password_ids` 재조회(목록 새로고침) 네트워크 로그로 확인 |
| 비밀번호 필드 기본 마스킹, 눈 아이콘 토글 | `type="password"` 기본, 클릭 시 `type="text"`로 전환 확인 |
| 검증 실패 시 폼 유지 | 403 오류 시 아이디·마스킹된 비밀번호·역할 선택이 그대로 남아 재시도 가능 |
| Esc 닫기 + 포커스 복귀 | Esc 후 `document.activeElement`가 정확히 "회원 추가" 버튼으로 돌아옴을 확인 |
| 닫은 뒤 상태 소멸 | 성공 후 모달 DOM 완전히 사라짐, 비밀번호 문자열이 `outerHTML`에서 검색되지 않음 |
| 엑셀·CSV 미리보기 → 부분 실패 → 실패 행만 재시도 | 8행 CSV(정상 2, 이미 있음 1, 실패 1, 경고 1, 중복 1, 공백 아이디 1, 짧은 비밀번호 1, 빈 역할 1)를 `DataTransfer`로 실제 `<input type="file">`에 주입해 브라우저 파서가 직접 처리하게 함 → 미리보기 "만들 수 있는 행 4개, 고쳐야 할 행 4개" 정확 → "4명 만들기" → "성공 2명, 실패 2명" + warncase 경고 문구 + 실패 표(이미 있음/실패, 사유 포함) 정확 → "실패한 2행만 다시 시도" 클릭 시 네트워크 요청 본문이 정확히 그 2행만 포함함을 확인(성공한 2행은 재전송되지 않음) |
| 서식 내려받기(.xlsx) 링크 | `withBasePath()`로 만든 정적 링크, 정상 |
| 다크 모드 | 위 모든 플로우(한 명 만들기 오류, 엑셀 미리보기, 부분 실패 결과, CSV 서식 다운로드)를 다크 모드에서 반복 확인 — 대비·레이아웃 문제 없음 |
| 375px | 가로 스크롤 없음(`document.body.scrollWidth === window.innerWidth === 375`)을 다이얼로그가 열린 상태에서 직접 측정 |
| 콘솔 오류 | 이 기능이 만든 흐름에서는 오류 0건(참고 항목의 hydration 이슈 제외, 그건 페이지 전역·기능과 무관 — 위 표 참고) |
| 회원 관리 기존 기능 회귀 | `member-list.tsx`의 git diff를 직접 확인 — 이번 기능은 "회원 추가" 버튼과 `<MemberCreateDialog>` 마운트만 **추가**했고, 행 클릭(`onRowClick`)·드롭다운 메뉴(`MemberActions`)·비밀번호 초기화·탈퇴 다이얼로그 관련 코드는 한 글자도 바뀌지 않았다. **다만 실제 회원 행을 목록에 채운 상태에서 행 클릭·드롭다운 메뉴를 직접 눌러보는 것까지는 하지 못했다**(아래 "확인 못 한 것" 참고) — 구조적으로 영향이 없다는 점은 diff로 확실하지만, 런타임 상호작용까지 재확인하지는 못함. |

## 5. Claim 확인: "새 SQL 필요 없음" (5순위)

**build-report의 주장을 migrations 전체를 대조해 확인한 결과, 맞다.**

* `20260921000000_init_blog.sql:84`의 `revoke update on public.profiles from anon, authenticated`, `20260922000000_admin_learning_fixes.sql:66`의 `revoke select on public.profiles from anon, authenticated` — **둘 다 `anon`/`authenticated`만 대상**이고 `service_role`을 언급하지 않는다.
* 전체 마이그레이션 파일을 `revoke.*service_role`, `force row level security`, `bypassrls` 키워드로 검색 — **일치하는 줄 없음**. `service_role`이 언급된 곳은 전부 `grant execute on function ... to service_role`(RPC 실행 권한 부여)뿐, `profiles` 테이블 권한을 축소하는 내용은 없다.
* `profiles` 테이블에 걸린 UPDATE 트리거는 `profiles_updated_at`(단순 `updated_at` 갱신) 하나뿐 — `must_change_password`를 되돌리거나 막는 트리거 없음.
* `on_auth_user_password_changed` 트리거가 `UPDATE of encrypted_password`에만 걸린다는 근거도 `20260922000000_admin_learning_fixes.sql`에서 직접 재확인.

**따라서 "service_role이 RLS·컬럼 권한 제한 없이 `profiles.role`/`profiles.must_change_password`를 바로 UPDATE할 수 있다"는 결론은 마이그레이션 파일만으로 검증 가능한 범위 안에서 타당하다.** 다만 이는 Supabase가 `service_role`에 기본으로 전체 테이블 권한을 부여한다는 표준 동작을 전제하며, 이 부분은 프로젝트가 소유한 실제 Postgres 권한 카탈로그(`information_schema` 등)를 조회해야 100% 확정할 수 있는데 실 DB 접속이 금지되어 있어 **마이그레이션 SQL 검토만으로 판단했다**(build-report도 같은 한계를 "확인하지 못한 것"에 이미 적어 두었음 — 이 리뷰도 동의).

## 확인한 것 vs 확인하지 못한 것

**확인한 것 (이번 리뷰에서 직접 재현)**
* Edge Function의 관리자 확인·행별 검증·오류 문구·부분 실패 로직 (코드 전체 정독)
* `src/lib/member-import.ts`·`src/lib/spreadsheet.ts`의 모든 export 함수를 Node(`tsx`)에서 직접 호출한 40여 개 단위 테스트(아이디/비밀번호/역할 검증, CSV 파싱, 헤더 별칭, 중복, 행 수 한도)
* 진짜 Excel과 동일한 구조(DEFLATE+sharedStrings)의 `.xlsx`를 직접 제작해 파서 통과 확인, 큰 정수 정밀도 손실 재현
* EUC-KR/UTF-8+BOM CSV 디코딩
* 브라우저(내 전용 격리 빌드+포트 4173)에서: 로그인 마킹 → 한 명 만들기 성공/실패/네트워크 오류/함수 미배포 오류 → 엑셀 CSV 업로드·미리보기·부분 생성·실패 재시도 → CSV/xlsx 서식 다운로드 바이트 검사 → 다크 모드 → 375px → Esc/포커스 → 비밀번호 DOM/localStorage 잔존 여부
* `docs/admin/create-members/build-report.md`가 "확인 못 함"으로 남긴 두 항목(진짜 Excel 구조, CSV 서식 다운로드 버튼) 해소
* 마이그레이션 전체를 대상으로 "새 SQL 불필요" 주장의 근거(REVOKE 대상, 트리거 범위) 재검증

**확인하지 못한 것 (실 인프라·실기기 필요)**
* 실제 Supabase 프로젝트에서 `is_admin`/`profiles` UPDATE·Auth Admin API 호출 자체 (권한 카탈로그를 직접 조회하지 못함 — §5 참고)
* Supabase Edge Function 게이트웨이가 "함수 없음" 상황에서 실제로 내려주는 HTTP 본문 형식(M2의 전제)
* 실제 회원이 있는 목록에서 행 클릭·드롭다운 메뉴(비밀번호 초기화/탈퇴)가 이번 기능과 함께 있어도 정상 작동하는지의 **런타임** 재확인(코드 diff상 무관함은 확인했으나 상호작용까지는 못 함)
* 실제 iPad/태블릿 터치, 실제 엑셀(Microsoft Excel/Google Sheets)이 저장한 파일 그 자체
* 100명 규모 대량 생성의 실제 소요 시간, GoTrue 요청 제한(rate limit) 실제 반응
* `#418` hydration 오류가 이번 리뷰 하네스(가짜 세션을 hydration 전에 심음)의 산물인지, 실 로그인 환경에서도 나타나는 사이트 전역 이슈인지 — 실 로그인으로 재확인 권장(이 기능이 원인일 가능성은 낮다고 판단했지만 완전히 배제하지는 못함)

## 종합 의견

build-report의 핵심 보안·정확성 주장(관리자만 호출, 비밀번호 미노출, must_change_password 로직, "새 SQL 불필요")은 모두 **독립적으로 재현·검증되어 맞다.** 스프레드시트 파서는 실제 Excel과 동일한 바이너리 구조로 시험해도 견고했다(정밀도 손실 예외 제외, 실질 위험 낮음). 찾은 문제는 모두 Medium 이하이며 즉시 배포를 막을 사유는 없다고 판단한다. M1(감사 로그 없음)과 M2(오류 메시지 우선순위)는 배포 전 수정이 필수는 아니지만, 특히 M2는 실제 함수 배포 후 함수 이름을 한 번 틀리게 호출해 보는 식으로 저비용에 확인 가능하니 배포 확인 단계에 포함하는 것을 권한다.
