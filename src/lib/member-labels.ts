import { isMissingSchemaError } from "@/lib/admin";
import { chunk } from "@/lib/paging";
import { supabase } from "@/lib/supabase";

/**
 * 학생 별명 가리기 — 글·댓글 작성자 이름 채우기(docs/privacy/spec.md 4.11, 개정 4).
 *
 * 서버(SQL ③)는 학생의 profiles 행을 본인·같은 학급 학생·그 학급 담임에게만 보인다. 그 밖의 로그인 회원(다른 학급 학생·선생님·총괄)이
 * 글·댓글을 읽으면 `profiles(...)` embed가 null로 온다 → 이 모듈이 `member_name_labels(p_ids)` RPC로 "첫 글자 + `***`" 이름을 받아
 * 그 자리에 채운다(사진 없음). 볼 수 있는 사람이면 RPC가 원래 이름을 준다(masked: false).
 *
 * - **로그인한 사람에게만** 부른다. 로그아웃 방문자는 요청도 보내지 않고 지금처럼 '회원'(4.10).
 * - RPC가 없거나(SQL 전 — isMissingSchemaError) 실패하면 빈 결과 → 이름은 지금처럼 '회원' 폴백. 화면을 절대 막지 않는다
 *   (실패는 콘솔 오류만 — 이름·id는 남기지 않는다).
 * - 이름표 모양은 계약(spec 4.11): `[{ id, display_name, avatar_url, withdrawn_at, masked }]`, 한 번에 앞 1000개까지 → 100개씩 나눠 부른다.
 * - 탈퇴한 학생이면 withdrawn_at이 있어 화면은 지금처럼 "탈퇴한 학생"(관리자 화면은 `탈퇴한 학생(2***)`)으로 보인다.
 */

export type MemberNameLabel = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  withdrawn_at: string | null;
  /** 가린 이름인가(첫 글자 + `***`) */
  masked: boolean;
};

/** 작성자 이름 표시에 쓰는 embed 모양(types.ts AUTHOR_PROFILE_COLUMNS와 같은 열) */
export type LabelProfile = { display_name: string | null; avatar_url: string | null; withdrawn_at: string | null };

/** RPC 한 번에 보낼 id 수(서버는 앞 1000개만 본다 — 주소가 아니라 본문으로 가지만 넉넉히 나눈다) */
const BATCH = 100;

function parseLabels(data: unknown): MemberNameLabel[] {
  let raw: unknown = data;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      raw = null;
    }
  }
  if (!Array.isArray(raw)) return [];
  const out: MemberNameLabel[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    if (typeof r.id !== "string") continue;
    const masked = r.masked === true;
    out.push({
      id: r.id,
      display_name: typeof r.display_name === "string" ? r.display_name : null,
      // 가린 이름에는 사진을 붙이지 않는다(서버도 null을 준다 — 한 번 더 지킨다)
      avatar_url: !masked && typeof r.avatar_url === "string" ? r.avatar_url : null,
      withdrawn_at: typeof r.withdrawn_at === "string" ? r.withdrawn_at : null,
      masked,
    });
  }
  return out;
}

/** 이 기기에 로그인 세션이 있는가(저장된 세션만 본다 — 로그아웃 방문자에게는 RPC를 부르지 않는다). */
async function hasSession(): Promise<boolean> {
  try {
    const { data } = await supabase.auth.getSession();
    return !!data.session;
  } catch {
    return false;
  }
}

/**
 * `member_name_labels(p_ids)` — 회원 id → 이름표. 로그인하지 않았거나, RPC가 없거나, 실패하면 빈 Map(또는 그때까지 받은 것).
 * 절대 예외를 던지지 않는다.
 */
export async function fetchMemberNameLabels(ids: readonly (string | null | undefined)[]): Promise<Map<string, MemberNameLabel>> {
  const map = new Map<string, MemberNameLabel>();
  const unique = [...new Set(ids.filter((v): v is string => typeof v === "string" && v.length > 0))];
  if (!unique.length || !(await hasSession())) return map;
  for (const part of chunk(unique, BATCH)) {
    try {
      const { data, error } = await supabase.rpc("member_name_labels", { p_ids: part });
      if (error) {
        // SQL 전(함수 없음)이면 조용히 — 이름은 '회원' 폴백 그대로
        if (!isMissingSchemaError(error)) console.error("[member-labels] member_name_labels 실패:", error.code ?? "", error.message ?? "");
        return map;
      }
      for (const label of parseLabels(data)) map.set(label.id, label);
    } catch (e) {
      console.error("[member-labels] member_name_labels 실패:", e instanceof Error ? e.message : "");
      return map;
    }
  }
  return map;
}

function toProfile(label: MemberNameLabel): LabelProfile {
  return { display_name: label.display_name, avatar_url: label.avatar_url, withdrawn_at: label.withdrawn_at };
}

/** 한 줄 안의 "작성자 id + embed" 자리 하나(신고처럼 한 줄에 둘 이상 있을 수 있다) */
export type LabelSlot<T> = {
  /** 작성자 id(없으면 건너뜀) */
  idOf: (row: T) => string | null | undefined;
  /** 지금 embed — null(읽을 수 없음)일 때만 채운다 */
  profileOf: (row: T) => unknown;
  /** 이름표를 넣은 새 줄을 돌려준다(원래 줄은 바꾸지 않는다) */
  apply: (row: T, profile: LabelProfile) => T;
};

/**
 * embed가 null인 작성자 자리에 이름표를 채운 새 배열을 돌려준다. 채울 자리가 없으면 RPC를 부르지 않는다.
 * 이름표가 없는 자리(로그아웃 · RPC 없음 · 지워진 계정)는 null 그대로 → 화면은 '회원'.
 */
export async function fillMemberLabels<T>(rows: readonly T[], slots: readonly LabelSlot<T>[]): Promise<T[]> {
  const need = new Set<string>();
  for (const row of rows) {
    for (const slot of slots) {
      const id = slot.idOf(row);
      if (id && slot.profileOf(row) == null) need.add(id);
    }
  }
  if (!need.size) return [...rows];
  const labels = await fetchMemberNameLabels([...need]);
  if (!labels.size) return [...rows];
  return rows.map((row) =>
    slots.reduce((acc, slot) => {
      const id = slot.idOf(acc);
      if (!id || slot.profileOf(acc) != null) return acc;
      const label = labels.get(id);
      return label ? slot.apply(acc, toProfile(label)) : acc;
    }, row),
  );
}

/** 가장 흔한 모양: 줄의 `profiles` embed(이름·사진·탈퇴)를 작성자 id로 채운다(글·댓글). */
export function fillProfiles<T extends { profiles: LabelProfile | null }>(
  rows: readonly T[],
  idOf: (row: T) => string | null | undefined,
): Promise<T[]> {
  return fillMemberLabels(rows, [{ idOf, profileOf: (r) => r.profiles, apply: (r, profiles) => ({ ...r, profiles }) }]);
}
