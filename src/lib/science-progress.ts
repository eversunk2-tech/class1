import { supabase } from "@/lib/supabase";
import { SCIENCE_LOCAL_PREFIX } from "@/lib/local-data";

/**
 * 로그아웃 직전: 과학 차시 앱(/apps/sci-*)이 이 기기에 남긴 "아직 DB에 올리지 못한" 기록을 app_progress에 올린다.
 * 앱 쪽 같은 절차: public/apps/sci-*\/class1-record.js `flushLocalProgress` (정본 scripts/templates/class1-record.js).
 *
 * - 앱은 `<storageKey>:__meta` = { appId, title, owner, syncedAt, dirty, localAt, pendingClear }를 남긴다.
 * - dirty인 앱의 스냅샷({ v:1, prefix, keys, savedAt })을 **지금 세션의 사용자 = meta.owner일 때만** 그 세션 토큰으로 올린다
 *   (다른 학생의 기록을 이 사람 행에 올리지 않는다). 주인이 다른 기록은 올리지 않는다(로그아웃 때 지워진다).
 * - 서버 updated_at이 마지막으로 맞춘 값(syncedAt)과 다르면(다른 기기에서 저장) 조용히 덮지 않고 학생에게 묻는다.
 * - pendingClear("처음부터 다시"를 서버에 못 알림)면 DB 행을 지운다.
 */

const META_SUFFIX = ":__meta";

type Meta = {
  appId?: string;
  title?: string;
  owner?: string;
  syncedAt?: string | null;
  dirty?: boolean;
  localAt?: number;
  pendingClear?: boolean;
};

type Snapshot = { v: 1; prefix: string; keys: Record<string, unknown>; savedAt: string };
type Row = { state?: { keys?: Record<string, unknown> } | null; updated_at?: string };

export type FlushReason = "no_table" | "not_logged_in" | "offline" | "too_large" | "clear_failed" | "error";
export type FlushProblem = { appId: string; title: string; reason: FlushReason };
export type FlushResult = { ok: boolean; reason: FlushReason | null; problems: FlushProblem[] };
export type ConflictInfo = { appId: string; title: string; localAt: number; serverAt: string | null };

const PROGRESS_MAX_BYTES = 262144;

function readJson(key: string): unknown {
  try {
    return JSON.parse(window.localStorage.getItem(key) ?? "null");
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 무시
  }
}

function localApps(): { root: string; metaKey: string; meta: Meta }[] {
  const out: { root: string; metaKey: string; meta: Meta }[] = [];
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (!k || !k.startsWith(SCIENCE_LOCAL_PREFIX) || !k.endsWith(META_SUFFIX)) continue;
      const m = readJson(k);
      if (m && typeof m === "object") out.push({ root: k.slice(0, -META_SUFFIX.length), metaKey: k, meta: m as Meta });
    }
  } catch {
    // 무시
  }
  return out;
}

function localSnapshot(root: string): Snapshot {
  const keys: Record<string, unknown> = {};
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (!k || !k.startsWith(`${root}:`)) continue;
      const sub = k.slice(root.length + 1);
      if (sub === "__meta" || sub === "__sync") continue;
      const raw = window.localStorage.getItem(k);
      try {
        keys[sub] = JSON.parse(raw ?? "null");
      } catch {
        keys[sub] = raw;
      }
    }
  } catch {
    // 무시
  }
  return { v: 1, prefix: root, keys, savedAt: new Date().toISOString() };
}

/** 키 순서와 상관없이 같은 값인지(jsonb는 객체 키 순서를 바꿔 저장한다) */
function canon(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canon).join(",")}]`;
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canon(o[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(v === undefined ? null : v);
}

/** access token(JWT)의 sub = 서버(RLS)가 이 요청을 누구로 볼지 */
function jwtSub(token: string): string | null {
  try {
    const part = token.split(".")[1];
    let b64 = part.replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    const bin = window.atob(b64);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    const p = JSON.parse(new TextDecoder().decode(bytes)) as { sub?: unknown };
    return typeof p.sub === "string" ? p.sub : null;
  } catch {
    return null;
  }
}

type Res<T> = { ok: true; data: T } | { ok: false; reason: FlushReason | "conflict" };

function reasonOf(status: number, body: unknown): FlushReason | "conflict" {
  const e = (body ?? {}) as { code?: string; message?: string };
  const code = e.code ?? "";
  const msg = e.message ?? "";
  if (code === "PGRST205" || code === "42P01" || status === 404 || /could not find the table|does not exist/i.test(msg))
    return "no_table";
  if (code === "42501" || code === "PGRST301" || code === "PGRST303" || status === 401 || status === 403)
    return "not_logged_in";
  if (code === "23514") return "too_large";
  if (code === "23505" || status === 409) return "conflict";
  return "error";
}

async function rest<T>(method: string, query: string, token: string, body?: unknown, prefer?: string): Promise<Res<T>> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return { ok: false, reason: "error" };
  const headers: Record<string, string> = { apikey: key, Authorization: `Bearer ${token}`, Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (prefer) headers.Prefer = prefer;
  try {
    const r = await fetch(`${url.replace(/\/$/, "")}/rest/v1/app_progress?${query}`, {
      method,
      headers,
      cache: "no-store",
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await r.text();
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    if (!r.ok) return { ok: false, reason: reasonOf(r.status, json) };
    return { ok: true, data: json as T };
  } catch {
    return { ok: false, reason: "offline" };
  }
}

const eq = (v: string) => `eq.${encodeURIComponent(v)}`;
const rowFilter = (userId: string, appId: string) => `user_id=${eq(userId)}&app_id=${eq(appId)}`;

async function loadRow(userId: string, appId: string, token: string): Promise<Res<Row | null>> {
  const r = await rest<Row[]>("GET", `select=state,updated_at&${rowFilter(userId, appId)}`, token);
  if (!r.ok) return r;
  return { ok: true, data: Array.isArray(r.data) ? (r.data[0] ?? null) : null };
}

/** 저장: syncedAt(마지막으로 맞춘 서버 시각) 뒤로 DB가 안 바뀌었을 때만. 바뀌었으면 "conflict"(+ 지금 행) */
async function saveSnapshot(
  userId: string,
  appId: string,
  token: string,
  snap: Snapshot,
  mode: { force: true } | { base: string | null },
): Promise<{ ok: true; updatedAt: string | null } | { ok: false; reason: FlushReason | "conflict"; row?: Row | null }> {
  const pick = (d: unknown) => {
    const row = Array.isArray(d) ? d[0] : d;
    return (row as Row | undefined)?.updated_at ?? null;
  };
  if ("force" in mode) {
    const r = await rest<Row[]>(
      "POST",
      "on_conflict=user_id,app_id&select=updated_at",
      token,
      { user_id: userId, app_id: appId, state: snap },
      "resolution=merge-duplicates,return=representation",
    );
    return r.ok ? { ok: true, updatedAt: pick(r.data) } : { ok: false, reason: r.reason };
  }
  if (mode.base) {
    const r = await rest<Row[]>(
      "PATCH",
      `${rowFilter(userId, appId)}&updated_at=${eq(mode.base)}&select=updated_at`,
      token,
      { state: snap },
      "return=representation",
    );
    if (!r.ok) return { ok: false, reason: r.reason };
    if (Array.isArray(r.data) && r.data.length) return { ok: true, updatedAt: pick(r.data) };
    const cur = await loadRow(userId, appId, token);
    if (!cur.ok) return { ok: false, reason: cur.reason };
    if (cur.data) return { ok: false, reason: "conflict", row: cur.data };
  }
  const ins = await rest<Row[]>(
    "POST",
    "select=updated_at",
    token,
    { user_id: userId, app_id: appId, state: snap },
    "return=representation",
  );
  return ins.ok ? { ok: true, updatedAt: pick(ins.data) } : { ok: false, reason: ins.reason };
}

/** 열려 있는 과학 앱 탭에 "미뤄 둔 입력을 로컬에 써 달라"고 알리고 잠깐 기다린다. */
async function requestAppFlush(waitMs = 400) {
  try {
    if (typeof BroadcastChannel === "undefined") return;
    const bc = new BroadcastChannel("sci6-sync");
    bc.postMessage({ type: "flush" });
    bc.close();
    await new Promise((r) => setTimeout(r, waitMs));
  } catch {
    // 무시
  }
}

export function hasPendingScienceProgress(): boolean {
  if (typeof window === "undefined") return false;
  return localApps().some((a) => a.meta.dirty || a.meta.pendingClear);
}

export async function flushScienceProgress(opts: {
  confirmConflict: (info: ConflictInfo) => boolean | Promise<boolean>;
}): Promise<FlushResult> {
  if (typeof window === "undefined") return { ok: true, reason: null, problems: [] };
  await requestAppFlush();
  const apps = localApps().filter((a) => a.meta.dirty || a.meta.pendingClear);
  if (!apps.length) return { ok: true, reason: null, problems: [] };

  const problem = (a: { root: string; meta: Meta }, reason: FlushReason): FlushProblem => ({
    appId: a.meta.appId ?? a.root,
    title: a.meta.title || a.meta.appId || a.root,
    reason,
  });

  let token: string | null = null;
  let userId: string | null = null;
  let authReason: FlushReason = "not_logged_in";
  try {
    const { data, error } = await supabase.auth.getSession();
    const s = data.session;
    if (s?.access_token && s.user) {
      const sub = jwtSub(s.access_token) ?? s.user.id;
      if (sub === s.user.id) {
        token = s.access_token;
        userId = sub;
      }
    } else if (error) authReason = "offline";
  } catch {
    authReason = "offline";
  }
  if (!token || !userId) {
    // 세션을 확인할 수 없으면 올릴 수 없다 → 남은 기록을 모두 알린다
    return { ok: false, reason: authReason, problems: apps.map((a) => problem(a, authReason)) };
  }

  const problems: FlushProblem[] = [];
  for (const a of apps) {
    const m = a.meta;
    if (m.owner !== userId) continue; // 다른 학생의 기록은 이 사람 이름으로 절대 올리지 않는다
    if (!m.appId) {
      problems.push(problem(a, "error"));
      continue;
    }
    if (!m.dirty && m.pendingClear) {
      const del = await rest<unknown>("DELETE", rowFilter(userId, m.appId), token);
      if (del.ok || del.reason === "no_table") writeJson(a.metaKey, { ...m, pendingClear: false });
      else problems.push(problem(a, "clear_failed"));
      continue;
    }
    const snap = localSnapshot(a.root);
    let size = 0;
    try {
      size = new Blob([JSON.stringify(snap)]).size;
    } catch {
      size = JSON.stringify(snap).length * 3;
    }
    if (size > PROGRESS_MAX_BYTES) {
      problems.push(problem(a, "too_large"));
      continue;
    }
    const stamp = m.localAt;
    let res = await saveSnapshot(userId, m.appId, token, snap, m.pendingClear ? { force: true } : { base: m.syncedAt ?? null });
    if (!res.ok && res.reason === "conflict") {
      let row = res.row ?? null;
      if (!row) {
        const cur = await loadRow(userId, m.appId, token);
        row = cur.ok ? cur.data : null;
      }
      if (row?.state && canon(row.state.keys ?? {}) === canon(snap.keys)) {
        res = { ok: true, updatedAt: row.updated_at ?? null };
      } else {
        const useLocal = await opts.confirmConflict({
          appId: m.appId,
          title: m.title || m.appId,
          localAt: m.localAt ?? 0,
          serverAt: row?.updated_at ?? null,
        });
        if (!useLocal) continue; // 학생이 "저장된 기록 유지"를 골랐다
        res = await saveSnapshot(userId, m.appId, token, snap, { force: true });
      }
    }
    if (res.ok) {
      const cur = (readJson(a.metaKey) as Meta | null) ?? m;
      if (cur.owner === userId) {
        writeJson(a.metaKey, {
          ...cur,
          syncedAt: res.updatedAt ?? cur.syncedAt ?? null,
          dirty: cur.localAt === stamp ? false : cur.dirty,
          pendingClear: false,
        });
      }
    } else problems.push(problem(a, res.reason === "conflict" ? "error" : res.reason));
  }
  return { ok: problems.length === 0, reason: problems[0]?.reason ?? null, problems };
}

function fmtTime(t: number | string | null): string {
  if (!t) return "알 수 없음";
  const d = new Date(typeof t === "number" ? t : Date.parse(t));
  if (Number.isNaN(d.getTime())) return "알 수 없음";
  return d.toLocaleString("ko-KR", { month: "long", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function conflictQuestion(info: ConflictInfo): string {
  return (
    `'${info.title}' 기록이 다른 기기에서 저장한 기록과 달라요.\n` +
    `· 이 기기의 기록: ${fmtTime(info.localAt)}\n· 저장된 기록: ${fmtTime(info.serverAt)}\n\n` +
    "[확인] 이 기기의 기록으로 저장하기\n[취소] 저장된 기록 그대로 두기(이 기기의 기록은 지워져요)"
  );
}

/** 올리지 못한 기록이 있을 때 로그아웃 전에 묻는 말 */
export function unsavedQuestion(r: FlushResult): string {
  const names = [...new Set(r.problems.map((p) => p.title).filter(Boolean))];
  let head: string;
  if (r.reason === "no_table")
    head = "진행 상황을 저장할 서버가 아직 준비되지 않아, 이 기기에 적은 과학 활동이 저장되지 않았어요.";
  else if (r.problems.some((p) => p.reason === "too_large"))
    head = "저장되지 않은 활동이 있어요 — 기록이 너무 커서 저장하지 못했어요(선생님께 알려 주세요).";
  else if (r.problems.some((p) => p.reason === "clear_failed"))
    head =
      "저장되지 않은 활동이 있어요 — '처음부터 다시 하기'를 서버에 알리지 못해, 다음에 로그인하면 예전 기록이 다시 나타날 수 있어요.";
  else head = "저장되지 않은 활동이 있어요(인터넷 연결을 확인해 주세요).";
  return `${head}${names.length ? `\n(${names.join(", ")})` : ""}\n\n로그아웃하면 이 기기에서 사라져요. 그래도 로그아웃할까요?`;
}
