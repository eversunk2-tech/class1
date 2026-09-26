# Build 지침(pan) — 확대한 3D 장면을 반투명 화살표로 옮기기 (2026-09-26, spec 개정 8)

당신은 **Build** 담당이다. 공통 틀에 이동 화살표를 구현하고, 검증해 보고서를 쓴다(검토는 다른 에이전트).

## 먼저 읽기
`CLAUDE.md`(과학 차시 앱 규칙 — 특히 "시점을 옮기거나 확대해도 방향이 뒤집히지 않게", "장면 속 글자", 서브에이전트 규칙), `docs/science/sim-redesign/spec.md` 끝의 **개정 8**(사용자 말 그대로 — 합격 기준), 정본 `scripts/templates/science-sim/sim3d.js`(카메라·`OrbitControls`(`enablePan = false`)·`computeFit`/`resetView`/`resize`/`focus`/`flyHome`/더블탭·트윈·렌더 루프), `style-common.css`(`.ss-view3d`, 토글·배지·HUD·`.ss-view-tip`·막대 자리), `experiment.js`(크게 보기 — `.ss-view3d`가 막대 위에서 끝남), README "추가 기능" 절.

## 할 일
1. **`sim3d.js`의 `create()`**: 3D 캔버스가 들어가는 `container`(`.ss-view3d`) 안에 화살표 4개(▲▼◀▶ 버튼, `type="button"`)를 붙인다.
   * **보이는 때**: 카메라가 처음 맞춤 거리보다 뚜렷이 가까울 때(예: 거리 < `fitDistance`×0.92) **또는** 과녁(`controls.target`)이 처음 중심에서 옮겨져 있을 때. 처음 시점에서는 숨김(`hidden`). 확대·축소·이동·`resetView`·`focus`·`flyHome`·`resize` 뒤에 다시 판단(컨트롤 `change` 이벤트 등).
   * **이동**: 화면 기준 이동(카메라의 오른쪽·위쪽 벡터 — OrbitControls의 screen-space pan과 같은 뜻)으로 `camera.position`과 `controls.target`을 **함께** 옮긴다(회전·좌우 방향은 그대로). 한 번 누르면 한 칸(예: 지금 보이는 높이의 약 12%), 누르고 있으면 계속(예: 초당 보이는 높이의 약 60%, `requestAnimationFrame`) — 수치는 실제로 써 보고 정한다. 손가락을 떼거나 포인터가 벗어나거나 `pointercancel`·창을 떠나면 멈춘다. 키보드(Enter/Space)로도 한 칸.
   * **한도**: 과녁이 장면 틀(`opts.frame` — width·depth와 center, 높이는 적당히) 밖으로 나가지 않게 막는다(학생이 장면을 잃지 않게). 한도에 닿은 방향 화살표는 흐리게(또는 숨김) 해도 된다.
   * `resetView()`(더블탭·"🎥 처음 방향으로")와 `flyHome()`은 이동까지 처음으로. `focus()`·`flyHome()` 트윈 중에는 화살표 이동을 무시하거나 트윈이 끝난 뒤에만 반영(겹쳐서 튀지 않게).
   * 화살표 누름이 캔버스 돌리기·물체 고르기(`onPick`)·더블탭·`v.draggable`로 새지 않게(화살표는 캔버스 형제 요소이지만 확인).
   * 접근성: `aria-label`("화면을 위로 옮기기" 등), 초점 표시, 누르는 곳 44px 이상, 대비(밝음·어두움), `prefers-reduced-motion`이어도 누르는 동안의 이동은 그대로(자동 움직임이 아님).
2. **`style-common.css`**: 반투명(장면을 가리지 않는 수준 — 흰 반투명 원 + 화살표, 어두움 모드 대응), 가장자리 가운데 자리. 토글(왼쪽 위)·"모형" 배지·HUD(오른쪽 위, 앱마다 다름)·드래그 안내 글(왼쪽 아래)·장면 안 막대(크게 보기 — `.ss-view3d`가 이미 막대 위에서 끝남)와 **겹치지 않게**. 휴대폰 크기에서도 겹침 없이(작아도 44px).
3. 앱은 원칙적으로 고치지 않는다. 앱 쪽 HUD·이름표·드래그 안내 글과 겹치는 앱이 있으면, 공통 틀에서 풀 수 있는지 먼저 보고 안 되면 그 앱 `style.css`에서만 최소로(무엇을 왜 — 보고서에). 앱이 자기 카메라 연출을 하는 곳(예: `sci-6-2-3-3` 나침반 다가가기 `api.focus`, `sci-6-2-1-5` 확대 화면, `sci-6-2-1-3` 남쪽 하늘 시점)에서도 화살표가 맞게 나타나고 움직이는지 확인.
4. 정본 → 실험 앱 20개 `public/apps/sci-*/science-sim/` 복사, `diff -r` 20/20 같음. README "추가 기능" 절에 설명(보이는 조건·이동 방식·한도·초기화).

## 바꾸지 않는 것
기본 화면·크게 보기의 배치(지금 그대로), 돌리기·두 손가락 확대·더블탭 동작, 저장 키·저장 구조·문항·기록 흐름, 3D 장면·그래프 색, `persist.js`·`answer-check.js`·`lesson.js`. 조사 앱(`science-guide`)은 대상 아님.

## 검증(직접 해서 보고서에 수치로)
1. 20개 실험 앱 × {1024×768, 768×1024, 1180×820, 1920×1080, 812×375, 375×812} × {기본 화면, 크게 보기}: 처음에는 화살표 없음 → 확대(휠 또는 `controls`로) 뒤 4개 보임 → 각 방향 한 번 누르면 화면이 그 방향으로 옮겨짐(스크린숏 비교 또는 과녁 좌표), 누르고 있으면 계속, 한도에서 멈춤, 더블탭·"🎥 처음 방향으로" → 처음 시점·화살표 숨김. 화살표 ↔ 토글·배지·HUD·안내 글·막대·앱 이름표(DOM) 겹침 0, 콘솔 오류 0, 페이지 스크롤 없음(크게 보기).
2. 이동해도 **좌우가 뒤집히지 않음**(◀를 누르면 장면의 왼쪽 부분이 보임), 돌리기·확대·물체 고르기·끌기(태양·손전등·지구본) 기존 동작 그대로.
3. 흐름 앱 5개 이상(`sci-6-2-3-3` 나침반 다가가기 뒤, `sci-6-2-1-5`, `sci-6-2-1-2`, `sci-6-1-1-1`, `sci-6-2-2-3`): 확대·이동한 채 실행 → 관찰 → 기록 정상.
4. 기본 화면·크게 보기 배치 회귀 없음(화살표를 뺀 요소 위치가 커밋 `08f2fa8`과 같음).
5. `npm run lint`, `node --check`, `git diff --check`, 임시 코드·`console.log`·`debugger`·`localStorage.clear()` 없음.

## 테스트 규칙(반드시)
* **자기 정적 서버로 저장소 `public/` 직접 서빙**: `python3 -m http.server 8788 --bind 127.0.0.1 --directory /Users/sungchul/Desktop/classroom/public`(비교용 `08f2fa8` 사본은 `git archive 08f2fa8 public`을 스크래치에 풀어 8789). dev 서버는 쓰지 않는다. 끝나면 종료.
* 자기 전용 headless Chrome만(포트 **9353**, 프로필은 스크래치 `/private/tmp/claude-501/-Users-sungchul-Desktop-classroom/7bf3a39e-3017-4189-b337-1b82aace66bb/scratchpad/pan/` 안): `--headless=new --use-angle=swiftshader --enable-unsafe-swiftshader --disable-web-security --host-resolver-rules="MAP *.supabase.co 127.0.0.1:9, MAP supabase.co 127.0.0.1:9"`, CDP는 Node 24 내장 `WebSocket`, 첫 로드 전부터 CDP `Fetch.enable`(`*supabase.co*`) 가짜 응답, **`Network.setCacheDisabled`로 캐시 끄기**(예전 파일을 캐시에서 읽는 일을 막음). 실제 Supabase·Gemini 요청 금지. **아무것도 내려받거나 설치하지 않는다.**
* `localStorage.clear()` 금지(그 앱 `sci6…`·`ssUiPref:` 키만), 다른 탭·프로세스·다른 Chrome·다른 포트 건드리지 않기. git commit/push·실 DB 쓰기 금지. 임시 파일은 스크래치에만. 범위 밖 수정이 필요하면 멈추고 보고서에 적는다.

## 보고서 `docs/science/sim-redesign/pan-report.md`
바꾼 것(파일·요지), 보이는 조건·이동량·한도 수치와 까닭, 앱별 확인(표), 겹침·회귀 결과, 알려진 한계, 사용자에게 보여 줄 스크린숏 4장(`…/scratchpad/pan/showcase/` — 확대 전/확대 뒤 화살표/한 방향 이동 뒤(전자석 6-2-3-3 권장)/세로 태블릿 한 장, 파일 이름은 영어·숫자만), Supabase 차단 기록. 한국어로 간결하게.
