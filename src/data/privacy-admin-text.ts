/**
 * 관리자 화면 글 — `docs/privacy/privacy-policy.md` **8절 원문 글자 그대로**(2026-10-20 사용자 "글은 이대로" 승인,
 * 개정 3 — 보유 기한 "종업식 뒤 그 학년도의 2월 28일"·'2월 알림' 반영, 개정 4 — 8-8 가려진 학생 줄).
 *
 * 표기 약속(원문과 같음)
 * - `{이름}`·`{n}`처럼 중괄호로 적은 것은 화면이 채우는 자리다(`fillText`).
 * - `**…**`는 굵게 보일 부분이다(`RichText`가 <strong>으로 그린다). 원문의 굵은 표시를 그대로 옮겼다.
 * - 문장 안의 `[…]`는 원문처럼 "누르는 자리의 이름"을 가리킨다 — 그 단추가 그 자리에 없을 때는 대괄호째 보인다.
 *   (회원 추가 도움말의 [보호자 동의서 양식 내려받기(한글 파일)]만 그 자리에서 바로 누르는 링크라 대괄호 없이 링크로 그린다.)
 * - 원문의 `>` 메모 줄은 넣지 않았다.
 *
 * 원문에 없는 새 문장은 맨 아래 `PRIVACY_ADMIN_EXTRA_TEXT`에 따로 모았다(보고서 docs/privacy/build-4-report.md에 전부 적음).
 * 8-6(구글 선생님 회원 탈퇴)은 공개 화면(묶음 3)의 창이지만 같은 8절 글이라 여기에도 둔다.
 */

export const PRIVACY_ADMIN_TEXT = {
  // ── 8-1. 회원 추가 — 보호자 동의 확인 (학생 역할일 때만 보임) ──
  consent: {
    singleLabel: "**(필수) 이 학생의 보호자 동의서를 받았습니다.** (동의서는 담임 선생님이 보관합니다)",
    fileLabel: "**(필수) 이 파일에 있는 학생 모두의 보호자 동의서를 받았습니다.** (동의서는 담임 선생님이 보관합니다)",
    /** 대괄호 부분은 양식 내려받기 링크로 그린다(`helpLinkLabel`). */
    help:
      "동의서 양식은 [보호자 동의서 양식 내려받기(한글 파일)]에서 받을 수 있어요. 동의서를 받지 못한 학생은 계정을 만들지 말고, 로그인 없이 '체험 모드'로 참여하게 해 주세요. 체크하면 선생님 이름과 시각이 기록돼요(학생 이름은 기록하지 않아요).",
    helpLinkLabel: "보호자 동의서 양식 내려받기(한글 파일)",
    required: "보호자 동의서를 받았다는 표시가 필요해요.",
  },

  // ── 8-2. 회원 목록 — 보호자 동의 열 (학생 행) ──
  consentColumn: {
    header: "보호자 동의",
    done: "동의서 확인 {날짜}",
    doneHint: "{선생님 이름} 선생님이 표시했어요.",
    none: "기록 없음",
    noneHint:
      "이 계정은 동의서 표시 기능이 생기기 전에 만들어졌거나 표시하지 않았어요. 동의서를 받았다면 [동의서 받음으로 기록]을 눌러 주세요.",
    recordButton: "동의서 받음으로 기록",
    recordConfirm: "{이름} 학생의 보호자 동의서를 실제로 받은 경우에만 누르세요. 누른 선생님과 시각이 기록돼요.",
    recordOk: "기록하기",
    classButton: "이 학급 모두 동의서 받음으로 기록",
    classConfirm:
      "이 학급에서 기록 없는 학생 {n}명 모두의 보호자 동의서를 실제로 받았을 때만 누르세요. 한 명이라도 못 받았다면 그 학생은 '학생 한 명씩 기록하기'를 써 주세요.",
    classOk: "모두 기록하기",
    cancel: "취소",
  },

  // ── 8-3. 회원 목록 — 구글 선생님 표시 ──
  googleTeacher: {
    pending: "인증 전",
    pendingHint: "교사 인증 코드를 아직 넣지 않은 구글 계정이에요. 이 계정은 글·댓글·기록을 남길 수 없어요.",
    /** `{새 가입 / 이전 가입} · 가입한 지 {n}일` */
    pendingMeta: "{가입 종류} · 가입한 지 {n}일",
    originNew: "새 가입",
    originExisting: "이전 가입",
    over30: "30일 넘음",
    over30Hint: "가입한 지 30일이 지났어요. 필요 없는 계정이면 [완전 삭제]로 지워 주세요.",
    classTeacher: "교사 · 내 학급 일만",
    classTeacherHint: "교사 인증 코드로 시작한 선생님이에요. 자기 학급 일만 할 수 있어요.",
    fullTeacher: "교사",
    fullTeacherHint: "모든 권한이 있는 선생님이에요.",
    widenMenu: "모든 권한 주기",
    widenConfirm:
      "{별명} 선생님에게 학습게임 관리, 신고 처리, 블로그 글쓰기, 함께 쓰는 칭찬 문구 고치기 권한을 줍니다. 계속할까요?",
    widenOk: "권한 주기",
    narrowMenu: "내 학급 일만으로 줄이기",
    narrowConfirm: "{별명} 선생님의 권한을 자기 학급 일만 하도록 줄입니다. 계속할까요?",
    narrowOk: "줄이기",
    cancel: "취소",
  },

  // ── 8-4. 학급 정리 ──
  classCleanup: {
    cardButton: "학급 정리",
    title: "학급 정리 — '{학급 이름}'",
    body: "이 학급의 학생 계정 **{n}명**(탈퇴 처리된 학생 {m}명 포함)과 그 학생들의 **모든 기록을 지웁니다.**",
    removed:
      "지워지는 것: 로그인 계정, 과학 활동 결과·진행, 과제 제출물, 선생님과 주고받은 메시지, 학생이 쓴 게시판·학습게임 글과 올린 게임 파일(그 글에 달린 다른 사람의 댓글·좋아요도 함께), 학생에 대한 관리 기록(계정 만들기·비밀번호 초기화·탈퇴 처리·동의 표시)",
    kept: "남는 것: 학급(이름), 선생님 글, 과제(내용), 선생님 계정",
    irreversible: "**되돌릴 수 없어요.** 종이 보호자 동의서도 함께 파쇄해 주세요.",
    typeName: "학급 이름을 그대로 입력해 주세요.",
    ok: "학급 정리하기",
    cancel: "취소",
    progress: "{done}/{total}명 정리했어요… 창을 닫지 말아 주세요.",
    done: "정리했어요. 학생 {n}명의 계정과 기록을 지웠어요.",
    partial: "{k}명을 지우지 못했어요. 다시 [학급 정리하기]를 눌러 주세요.",
    empty: "지울 학생이 없어요.",
  },

  // ── 8-9. 학급 삭제 (2026-10-22 사용자 승인 — docs/classes/delete-class/spec.md) ──
  // 아래 넷째 묶음(studentsLeft·noPermission·nameMismatch)은 서버(admin_delete_class — 20261022000000_class_delete.sql)가
  // 같은 글자로 거부한다. 화면은 서버 문구를 그대로 보이고, 미리보기에서 학생이 남았으면 studentsLeft를 미리 보인다.
  classDelete: {
    cardButton: "학급 삭제",
    /** 학생이 남아 있어 [학급 삭제]가 꺼졌을 때의 설명 */
    blockedHint: "학생이 남아 있어요. 먼저 [학급 정리]를 해 주세요.",
    /** 학급 정리를 마친 창의 단추 */
    continueButton: "이어서 학급 삭제",
    title: "학급 삭제 — '{학급 이름}'",
    body: "이 학급을 목록에서 완전히 지웁니다. 이 학급의 과제 {n}개와 선생님 글 {m}개도 함께 지워져요. **되돌릴 수 없어요.**",
    typeName: "학급 이름을 그대로 입력해 주세요.",
    ok: "학급 삭제",
    cancel: "취소",
    done: "'{학급 이름}' 학급을 삭제했어요.",
    studentsLeft: "학생 계정이 {n}명 남아 있어요. 먼저 [학급 정리]로 학생 계정과 기록을 지운 뒤 학급을 삭제해 주세요.",
    noPermission: "이 학급의 담임 선생님이나 총괄 선생님만 학급을 삭제할 수 있어요.",
    nameMismatch: "학급 이름이 맞지 않아요. 학급 이름을 그대로 입력해 주세요.",
  },

  // ── 8-5. 학생 한 명 '기록까지 삭제' ──
  studentErase: {
    menu: "기록까지 삭제",
    title: "기록까지 삭제 — {이름}",
    body:
      "이 학생의 로그인 계정과 **모든 기록**(과학 활동 결과·진행, 과제 제출물, 메시지, 게시판·학습게임 글과 파일, 관리 기록)을 지웁니다. '탈퇴 처리'와 달리 **\"탈퇴한 학생\"으로도 남지 않고**, 되돌릴 수 없어요. 보호자 동의서(종이)도 파쇄해 주세요.",
    typeName: "이름을 그대로 입력해 주세요.",
    ok: "기록까지 삭제",
    cancel: "취소",
  },

  // ── 8-6. 구글 선생님 회원 탈퇴 (사용자 메뉴 → [회원 탈퇴]) — 공개 화면(묶음 3)이 쓸 수 있게 함께 둔다 ──
  selfWithdraw: {
    title: "회원 탈퇴",
    body: "탈퇴하면 로그인 계정과 선생님이 남긴 기록이 **모두 지워지고 되돌릴 수 없어요.**",
    removed: "지워지는 것: 로그인 계정, 별명, 선생님이 쓴 글·과제·메시지, 게시판·학습게임 글, 혼자 맡았던 빈 학급",
    kept: "남는 것: 다른 선생님이 함께 맡은 학급(담당에서만 빠짐), 함께 쓰는 칭찬 문구",
    google: "구글 계정 자체는 지워지지 않아요(구글에서 따로 관리해요).",
    typePhrase: "\"탈퇴합니다\"를 입력해 주세요.",
    phrase: "탈퇴합니다",
    ok: "회원 탈퇴",
    cancel: "취소",
    blocked: "**아직 학생이 있는 학급이 있어요: {학급 이름들}. 먼저 [학급 정리]로 학생 계정과 기록을 지운 뒤 탈퇴해 주세요.**",
    superAdmin: "총괄 선생님은 이 화면에서 탈퇴할 수 없어요.",
  },

  // ── 8-7. 총괄 선생님 '개인정보 설정' 화면 ──
  settings: {
    title: "개인정보 설정",
    codeHeading: "교사 인증 코드",
    codeSet: "설정됨 (바꾼 날 {날짜})",
    codeUnset: "아직 정하지 않았어요",
    codeNew: "새 코드",
    codeDigits: "(숫자 6자리)",
    codeAgain: "한 번 더",
    codeButton: "코드 정하기",
    codeHelp:
      "6자리 숫자예요. 서버에는 되돌릴 수 없는 값으로만 저장되어 나중에 볼 수 없어요. 잊어버리면 새 코드를 정하세요. 코드를 바꿔도 이미 인증한 선생님은 그대로예요.",
    codeOk: "코드를 정했어요.",
    codeBad: "숫자 6자리로 적어 주세요.",
    codeMismatch: "두 번 적은 코드가 서로 달라요.",
    emailHeading: "문의 이메일",
    emailButton: "저장",
    emailHelp: "개인정보 처리방침 화면에 공개로 보여요. 개인 메일 대신 이 사이트 전용 주소를 권해요.",
    emailOk: "저장했어요.",
    emailBad: "이메일 주소 모양이 아니에요.",
    statusHeading: "현황",
    statusPending: "인증 전 계정 {n}개(30일 넘은 계정 {k}개)",
    statusWrong: "최근 1시간 동안 틀린 코드 시도 {n}번",
    statusLocked: "지금 잠긴 계정 {n}개",
    statusVersion: "처리방침 판 번호 {판 번호}",
    retentionHeading: "학급 정리 기한",
    retentionBody: "기한(종업식 뒤 그 학년도의 2월 28일)이 지났는데 정리하지 않은 학생이 {n}명 있어요.",
    retentionClass: "{학급 이름} {n}명",
    retentionOpen: "학급 정리 열기",
    /** 2월 한 달 동안, 이번 학년도 학생이 남아 있을 때(개정 3) */
    februaryHeading: "2월 알림",
    februaryBody: "이번 학년도 학생 {n}명은 종업식 뒤 2월 28일까지 '학급 정리'로 지워 주세요.",
  },

  // ── 8-8. 회원 목록 — 가려진 학생 줄 (총괄 선생님에게만, 개정 4) ──
  maskedRows: {
    /** 목록 위 안내(가려진 줄이 있을 때) */
    notice:
      "다른 학급 학생의 아이디와 별명은 첫 글자만 보여요. 그 학급 담임 선생님만 볼 수 있어요. 비밀번호 초기화·탈퇴 처리·기록까지 삭제는 그대로 할 수 있어요.",
    /** 다른 학급 학생을 교사로 지정하려 할 때(서버가 거부 — 화면은 서버 문구를 그대로 보인다) */
    roleRejected: "다른 학급 학생은 교사로 지정할 수 없어요.",
  },

  // ── 4절(창 안의 짧은 글) 중 관리자 화면에서도 쓰는 한 줄 ──
  network: "서버에 연결하지 못했어요. 잠시 뒤에 다시 해 주세요.",
} as const;

/**
 * 원문에 없는 새 문장(2026-10-20 묶음 4 — 보고서에 문장 그대로 적어 사용자가 확인한다).
 * 오류·준비 전·권한 안내처럼 원문 8절이 다루지 않은 자리에만 쓴다.
 */
export const PRIVACY_ADMIN_EXTRA_TEXT = {
  missingPrefix: "개인정보 기능 준비 전 · ",
  missing:
    "개인정보 기능용 DB 설정이 아직 적용되지 않았습니다. Supabase SQL Editor에서 20261020000000_privacy_a_schema.sql을 실행해 주세요.",
  superOnlyPage: "총괄 선생님만 쓸 수 있는 화면이에요.",
  overviewError: "개인정보 설정을 불러오지 못했습니다.",
  previewError: "학생 수를 불러오지 못했습니다.",
  eraseDone: "{이름} 학생의 계정과 기록을 지웠어요.",
  consentRecorded: "기록했어요.",
  consentClassRecorded: "{n}명을 기록했어요.",
  widened: "{별명} 선생님에게 모든 권한을 줬어요.",
  narrowed: "{별명} 선생님의 권한을 자기 학급 일만 하도록 줄였어요.",
  codeDigitLabel: "{칸} {n}번째 자리",
  clearNotDeployed: "학급 정리 기능이 아직 준비되지 않았습니다. Supabase에 Edge Function(admin-clear-students)을 배포해 주세요.",
  clearNetwork:
    "학급 정리 기능에 연결하지 못했습니다. 인터넷 연결을 확인하고, Supabase에 Edge Function(admin-clear-students)이 배포되어 있는지 확인해 주세요.",
  clearFailed: "지우지 못했습니다. 잠시 후 다시 시도해 주세요.",
  sessionExpired: "로그인이 만료되었습니다. 다시 로그인해 주세요.",
  saveFailed: "저장하지 못했습니다. 잠시 후 다시 시도해 주세요.",
  praiseClassOnly: "함께 쓰는 칭찬 문구는 모든 권한이 있는 선생님만 고칠 수 있어요.",
  communityClassOnly: "학습게임 관리와 학습게임 신고 처리는 모든 권한이 있는 선생님만 할 수 있어요.",
  blogClassOnly: "블로그 글쓰기는 모든 권한이 있는 선생님만 할 수 있어요.",
  countUnit: "{n}명",
  // ── 학급 삭제(2026-10-22 — docs/classes/delete-class/build-report.md에 문장 그대로 적음) ──
  /** 확인 창의 미리보기(과제·선생님 글 수)를 읽지 못했을 때 */
  classDeletePreviewError: "학급 정보를 불러오지 못했습니다.",
  /** 단추가 보인 뒤 DB 함수가 사라진 드문 경우(SQL을 되돌림 등) — 보통은 단추가 숨어 보이지 않는다 */
  classDeleteMissing:
    "학급 삭제 기능용 DB 설정이 아직 적용되지 않았습니다. Supabase SQL Editor에서 20261022000000_class_delete.sql을 실행해 주세요.",
} as const;

/** `{이름}` 같은 자리를 채운다. 값이 없는 자리는 그대로 둔다. */
export function fillText(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{([^{}]+)\}/g, (whole, key: string) => (key in values ? String(values[key]) : whole));
}

/** `**굵게**` 표시를 조각으로 나눈다(굵은 조각은 bold: true). 화면 쪽 RichText가 쓴다. */
export function splitBold(text: string): { text: string; bold: boolean }[] {
  return text
    .split("**")
    .map((part, i) => ({ text: part, bold: i % 2 === 1 }))
    .filter((p) => p.text.length > 0);
}

/** 굵은 표시(`**`)를 뺀 글 — aria-label·title·알림처럼 꾸밈 없이 쓰는 곳용. */
export function plainText(text: string): string {
  return text.split("**").join("");
}
