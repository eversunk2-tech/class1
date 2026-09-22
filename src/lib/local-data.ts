/**
 * 로그아웃할 때 이 브라우저에 남은 "사용자가 입력한 내용"을 지운다.
 * - 과학 차시 앱(/apps/sci-*)의 로컬 사본: localStorage의 `sci6…` 키 전부(진행 상황은 DB app_progress에 있다).
 * - 글 에디터의 세션 만료 대비 임시 글: sessionStorage의 `class1:post-draft:…` (직접 로그아웃할 때만 지운다 —
 *   세션이 만료될 때는 다시 로그인해서 되살릴 수 있게 남겨 둔다).
 * 테마·사이드바 설정 등 사용자 입력이 아닌 키는 그대로 둔다.
 */

export const SCIENCE_LOCAL_PREFIX = "sci6";
const POST_DRAFT_PREFIX = "class1:post-draft:";

function removeKeys(storage: Storage, match: (key: string) => boolean) {
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i);
    if (k && match(k)) keys.push(k);
  }
  keys.forEach((k) => storage.removeItem(k));
}

/** 과학 앱 로컬 사본(`sci6…`)을 지운다. 로그아웃·세션 만료 때 호출한다. */
export function clearScienceLocalData() {
  if (typeof window === "undefined") return;
  try {
    removeKeys(window.localStorage, (k) => k.startsWith(SCIENCE_LOCAL_PREFIX));
  } catch {
    // 저장소를 쓸 수 없으면 지울 것도 없다.
  }
}

/** 사용자가 직접 로그아웃할 때: 과학 앱 로컬 사본 + 에디터 임시 글 */
export function clearLocalUserData() {
  clearScienceLocalData();
  if (typeof window === "undefined") return;
  try {
    removeKeys(window.sessionStorage, (k) => k.startsWith(POST_DRAFT_PREFIX));
  } catch {
    // 무시
  }
}
