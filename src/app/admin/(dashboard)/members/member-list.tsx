"use client";

import { useCallback, useEffect, useMemo, useState, type MouseEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDownIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  EllipsisVerticalIcon,
  EraserIcon,
  EyeOffIcon,
  FileCheck2Icon,
  KeyRoundIcon,
  SearchIcon,
  ShieldCheckIcon,
  ShieldHalfIcon,
  ShieldOffIcon,
  ShieldPlusIcon,
  Trash2Icon,
  UserMinusIcon,
  UserPlusIcon,
  XIcon,
} from "lucide-react";
import { AdminPageHeader } from "@/components/admin/admin-shell";
import { adminSurfaceClass } from "@/components/admin/admin-styles";
import { MyClassesCard, NO_CLASS_MESSAGE } from "@/components/admin/class-card";
import { GuardianConsentDialog, type GuardianConsentTarget } from "@/components/admin/guardian-consent-dialog";
import { GuardianConsentStatus, MemberAvatar, ProviderBadges, RoleBadge } from "@/components/admin/member-badges";
import { MemberCreateDialog } from "@/components/admin/member-create-dialog";
import { MemberEraseDialog } from "@/components/admin/member-erase-dialog";
import { MemberPurgeDialog } from "@/components/admin/member-purge-dialog";
import { MemberWithdrawDialog } from "@/components/admin/member-withdraw-dialog";
import { PasswordResetDialog } from "@/components/admin/password-reset-dialog";
import { RoleChangeDialog, TeacherScopeDialog } from "@/components/admin/role-change-dialog";
import { NativeSelect } from "@/components/learning/learning-ui";
import { EmptyState, ErrorState } from "@/components/states";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { PRIVACY_ADMIN_EXTRA_TEXT, PRIVACY_ADMIN_TEXT, fillText } from "@/data/privacy-admin-text";
import { adminPermissions, useAdminContext, type AdminContextValue } from "@/hooks/use-admin-context";
import { useSession } from "@/hooks/use-session";
import {
  accountLabel,
  fetchMembers,
  isMissingSchemaError,
  isOAuthOnlyMember,
  isWithdrawnMember,
  memberName,
  memberProviders,
  MISSING_SCHEMA_MESSAGE,
  passwordResetBlockReason,
  purgeAccessFrom,
  purgeBlockReason,
  withdrawBlockReason,
  type PurgeAccess,
} from "@/lib/admin";
import {
  consentByMe,
  isConsentSubject,
  privacyMenuOf,
  useMemberPrivacyInfo,
  type GuardianConsent,
  type MemberPrivacyInfo,
  type TeacherScope,
} from "@/lib/admin-privacy";
import { formatCount, formatDateTime } from "@/lib/format";
import type { MemberRow, Role } from "@/lib/types";
import { cn } from "@/lib/utils";

type State = { status: "loading" } | { status: "error"; missing: boolean } | { status: "ready"; rows: MemberRow[] };

type SortKey = "name" | "account" | "class" | "provider" | "signed_up_at" | "last_sign_in_at" | "role";
type Sort = { key: SortKey; dir: "asc" | "desc" };

/** 학급 필터: 전체 / 학급 없음(교사·아직 배정 안 된 계정) / 학급 id */
const FILTER_ALL = "__all__";
const FILTER_NONE = "__none__";

const BASE_COLUMNS: { key: SortKey; label: string; className?: string }[] = [
  { key: "name", label: "이름" },
  { key: "account", label: "아이디/이메일" },
  // 목록 폭이 56rem(896px)보다 좁으면 가입 방식 칸을 숨긴다(회원 상세·카드 목록에는 그대로 보인다) — 표가 상자 안에 들어오게.
  { key: "provider", label: "가입 방식", className: "hidden @4xl:table-cell" },
  { key: "signed_up_at", label: "가입일" },
  { key: "last_sign_in_at", label: "마지막 로그인" },
  { key: "role", label: "역할" },
];

/** 학급 기능이 켜지면 아이디 옆에 "학급" 칸(관리자 화면에서만 — 학생 화면에는 소속 정보를 보이지 않는다). */
const CLASS_COLUMNS: { key: SortKey; label: string; className?: string }[] = [
  BASE_COLUMNS[0],
  BASE_COLUMNS[1],
  { key: "class", label: "학급" },
  ...BASE_COLUMNS.slice(2),
];

/**
 * 보호자 동의 칸이 있을 때(학급 기능 뒤) 표가 상자 안에 들어오도록 덜 급한 칸을 좁은 목록에서 숨긴다
 * (숨긴 값은 회원 상세·카드 목록에 그대로 있다): 가입 방식은 목록 폭 64rem(1024px) 이상, 가입일은 56rem(896px) 이상에서만.
 */
const PROVIDER_CELL_WITH_CONSENT = "hidden @5xl:table-cell";
const SIGNED_UP_CELL_WITH_CONSENT = "hidden @4xl:table-cell";

const collator = new Intl.Collator("ko");

/** 표 오른쪽 끝 ⋮(작업) 칸: 가로로 스크롤해도 오른쪽에 붙어 있다. 왼쪽 1px 선(inset 그림자)으로 칸을 구분한다. */
const STICKY_CELL = "sticky right-0 z-[1] shadow-[inset_1px_0_0_var(--border)]";

/**
 * "2026년 9월 23일 오전 10:00"을 칸이 좁을 때 날짜와 시각 사이에서만 줄바꿈되게 그린다(보이는 글자·읽히는 글자는 그대로).
 * 형식이 예상과 다르면 한 덩어리로 그린다.
 */
function DateTimeText({ iso }: { iso: string }) {
  const text = formatDateTime(iso);
  const m = /^(.*일)\s+(.+)$/.exec(text);
  if (!m) return <span className="whitespace-nowrap">{text}</span>;
  return (
    <>
      <span className="whitespace-nowrap">{m[1]}</span> <span className="whitespace-nowrap">{m[2]}</span>
    </>
  );
}

/** 회원 행의 학급 표시(관리자 화면 전용). 교사는 담임 학급(총괄만 알 수 있음), 학생은 소속 학급. */
function classLabelOf(row: MemberRow, ctx: AdminContextValue): { text: string; muted: boolean } {
  if (row.profiles?.role === "admin") {
    const taught = ctx.teacherClasses?.get(row.id) ?? [];
    if (!taught.length) return { text: "—", muted: true };
    return { text: `담임: ${taught.map((id) => ctx.classNameOf(id) ?? "이름 없는 학급").join(", ")}`, muted: true };
  }
  if (!row.class_id) return { text: "학급 없음", muted: true };
  return { text: ctx.classNameOf(row.class_id) ?? "다른 학급", muted: false };
}

/**
 * 보호자 동의 표시: 표에서 읽은 줄은 useMemberPrivacyInfo(member_directory), 가린 줄은 RPC가 함께 준 값
 * (가린 줄은 SQL ② 뒤 총괄이 표에서 읽지 못한다 — docs/privacy/spec.md 4.11).
 */
function consentOf(row: MemberRow, consents: ReadonlyMap<string, GuardianConsent> | null): GuardianConsent | null {
  return row.masked ? (row.masked_consent ?? null) : (consents?.get(row.id) ?? null);
}

/** 가린 줄(다른 학급 학생 — 총괄)의 메뉴는 비밀번호 초기화·탈퇴 처리·기록까지 삭제만(사용자 결정, spec 4.11). */
function menuOf(row: MemberRow, ctx: AdminContextValue, privacy: MemberPrivacyInfo, myId: string | null) {
  const menu = privacyMenuOf(row, ctx, privacy, myId);
  return row.masked ? { ...menu, consent: false, scope: null } : menu;
}

function compare(a: MemberRow, b: MemberRow, key: SortKey, ctx: AdminContextValue): number {
  switch (key) {
    case "name":
      return collator.compare(memberName(a), memberName(b));
    case "account":
      return collator.compare(accountLabel(a.email), accountLabel(b.email));
    case "class":
      return collator.compare(classLabelOf(a, ctx).text, classLabelOf(b, ctx).text);
    case "provider":
      return collator.compare(memberProviders(a).join(","), memberProviders(b).join(","));
    case "role":
      return collator.compare(a.profiles?.role ?? "user", b.profiles?.role ?? "user");
    case "signed_up_at":
      return a.signed_up_at.localeCompare(b.signed_up_at);
    case "last_sign_in_at":
      // 로그인한 적 없는 회원은 항상 가장 오래된 것으로 본다.
      return (a.last_sign_in_at ?? "").localeCompare(b.last_sign_in_at ?? "");
  }
}

function matches(row: MemberRow, q: string, classText: string | null): boolean {
  if (!q) return true;
  return [memberName(row), row.email, accountLabel(row.email), classText ?? ""].some((v) => v.toLowerCase().includes(q));
}

export function MemberList() {
  const router = useRouter();
  const { user, profile } = useSession();
  const ctx = useAdminContext();
  const perms = adminPermissions(ctx);
  const myId = user?.id ?? null;
  const classMode = ctx.status === "ready";
  // 개인정보 표시: 구글 계정 인증 상태·교사 권한 범위(총괄만), 보호자 동의 기록(학급 기능 뒤 — 담임·총괄)
  const privacy = useMemberPrivacyInfo(perms.superAdmin, classMode);
  const showConsent = classMode && privacy.consents !== null;
  const [state, setState] = useState<State>({ status: "loading" });
  const [query, setQuery] = useState("");
  const [classFilter, setClassFilter] = useState<string>(FILTER_ALL);
  const [sort, setSort] = useState<Sort>({ key: "signed_up_at", dir: "desc" });
  const [resetTarget, setResetTarget] = useState<MemberRow | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [withdrawTarget, setWithdrawTarget] = useState<MemberRow | null>(null);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [purgeTarget, setPurgeTarget] = useState<MemberRow | null>(null);
  const [purgeOpen, setPurgeOpen] = useState(false);
  const [roleTarget, setRoleTarget] = useState<MemberRow | null>(null);
  const [roleOpen, setRoleOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [scopeTarget, setScopeTarget] = useState<{ row: MemberRow; next: TeacherScope } | null>(null);
  const [scopeOpen, setScopeOpen] = useState(false);
  const [consentTarget, setConsentTarget] = useState<GuardianConsentTarget | null>(null);
  const [consentOpen, setConsentOpen] = useState(false);
  const [eraseTarget, setEraseTarget] = useState<MemberRow | null>(null);
  const [eraseOpen, setEraseOpen] = useState(false);

  const load = useCallback(async (): Promise<State> => {
    try {
      return { status: "ready", rows: await fetchMembers() };
    } catch (e) {
      return { status: "error", missing: isMissingSchemaError(e) };
    }
  }, []);

  useEffect(() => {
    let active = true;
    load().then((next) => {
      if (active) setState(next);
    });
    return () => {
      active = false;
    };
  }, [load]);

  async function reload() {
    setState({ status: "loading" });
    setState(await load());
  }

  // 학급 고르기: 총괄(모든 학급)이나 학급이 둘 이상인 담임에게만 보인다.
  const filterOptions = useMemo(() => {
    if (!classMode) return [];
    // 보관된 학급(담임 해제로 비워진 빈 학급 — 서버가 archived_at 표시)은 이름 뒤에 표시한다.
    return perms.superAdmin
      ? ctx.visibleClasses.map((c) => ({ id: c.id, name: c.archivedAt ? `${c.name} (보관됨)` : c.name }))
      : ctx.classes;
  }, [classMode, perms.superAdmin, ctx.visibleClasses, ctx.classes]);
  const showClassFilter = classMode && (perms.superAdmin ? filterOptions.length > 0 : filterOptions.length > 1);
  const activeFilter =
    !showClassFilter || (classFilter !== FILTER_ALL && classFilter !== FILTER_NONE && !filterOptions.some((c) => c.id === classFilter))
      ? FILTER_ALL
      : classFilter;

  const rows = useMemo(() => {
    if (state.status !== "ready") return [];
    const q = query.trim().toLowerCase();
    const filtered = state.rows.filter((r) => {
      // "학급 없음": 학급 id가 없는 행(교사·아직 배정 안 된 계정)
      if (activeFilter === FILTER_NONE && r.class_id) return false;
      if (activeFilter !== FILTER_ALL && activeFilter !== FILTER_NONE && r.class_id !== activeFilter) return false;
      return matches(r, q, classMode ? classLabelOf(r, ctx).text : null);
    });
    const sign = sort.dir === "asc" ? 1 : -1;
    return filtered.sort(
      (a, b) => compare(a, b, sort.key, ctx) * sign || collator.compare(memberName(a), memberName(b)),
    );
  }, [state, query, sort, activeFilter, classMode, ctx]);

  function toggleSort(key: SortKey) {
    setSort((s) =>
      s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: key.endsWith("_at") ? "desc" : "asc" },
    );
  }

  function patchRow(userId: string, patch: (r: MemberRow) => MemberRow) {
    setState((s) => (s.status === "ready" ? { ...s, rows: s.rows.map((r) => (r.id === userId ? patch(r) : r)) } : s));
  }

  function openReset(row: MemberRow) {
    setResetTarget(row);
    setResetOpen(true);
  }

  function markReset(userId: string) {
    patchRow(userId, (r) => (r.profiles ? { ...r, profiles: { ...r.profiles, must_change_password: true } } : r));
  }

  function openWithdraw(row: MemberRow) {
    setWithdrawTarget(row);
    setWithdrawOpen(true);
  }

  function markWithdrawn(userId: string, withdrawnAt: string) {
    patchRow(userId, (r) => (r.profiles ? { ...r, profiles: { ...r.profiles, withdrawn_at: withdrawnAt } } : r));
    void ctx.refresh();
  }

  function openPurge(row: MemberRow) {
    setPurgeTarget(row);
    setPurgeOpen(true);
  }

  /** 완전 삭제 뒤: 목록을 화면에 둔 채 조용히 새로 불러온다(성공이면 그 행을 먼저 뺀다 — 깜박이는 로딩 없이). */
  function refreshAfterPurge(userId: string, removed: boolean) {
    if (removed) setState((s) => (s.status === "ready" ? { ...s, rows: s.rows.filter((r) => r.id !== userId) } : s));
    void load().then((next) => {
      if (next.status === "ready") setState(next);
    });
    void ctx.refresh();
  }

  function openRole(row: MemberRow) {
    setRoleTarget(row);
    setRoleOpen(true);
  }

  function markRole(userId: string, role: Role) {
    // 담임으로 지정하면 서버가 학생 소속(class_id)을 비운다 — 화면도 같이 비운다.
    patchRow(userId, (r) =>
      r.profiles
        ? { ...r, profiles: { ...r.profiles, role }, ...(role === "admin" && r.class_id !== undefined ? { class_id: null } : {}) }
        : r,
    );
    // 담임 지정·해제 때 서버가 권한 범위를 'full'로 둔다(spec 3.6) — 인증 전 표시·범위를 다시 읽는다.
    privacy.reload();
  }

  function openScope(row: MemberRow, next: TeacherScope) {
    setScopeTarget({ row, next });
    setScopeOpen(true);
  }

  function openConsent(row: MemberRow) {
    setConsentTarget({ kind: "student", studentId: row.id, name: memberName(row) });
    setConsentOpen(true);
  }

  function openErase(row: MemberRow) {
    setEraseTarget(row);
    setEraseOpen(true);
  }

  /** 기록까지 삭제 뒤: 그 행을 빼고 조용히 다시 읽는다. */
  function refreshAfterErase(userId: string) {
    refreshAfterPurge(userId, true);
    privacy.reload();
  }

  const detailHref = (row: MemberRow) => `/admin/members/?id=${row.id}`;

  // 행 아무 곳이나 눌러도 상세로 이동한다(버튼·링크·메뉴·다이얼로그를 누른 경우는 제외).
  // ⚠ React 포털(드롭다운 메뉴·다이얼로그)은 DOM이 아니라 React 트리로 이벤트를 올리므로
  //   메뉴 항목 클릭이 이 <tr>까지 도달한다(review U1). MemberActions를 stopPropagation으로 감싸
  //   1차로 막고, 아래 선택자로 한 번 더 막는다(둘 중 하나만 있어도 동작하도록 이중으로 둔다).
  function onRowClick(e: MouseEvent<HTMLElement>, row: MemberRow) {
    if (
      (e.target as HTMLElement).closest(
        'a,button,input,label,[role="menu"],[role="menuitem"],[role="dialog"],[role="alertdialog"],[data-slot^="dropdown-menu"]',
      )
    ) {
      return;
    }
    router.push(detailHref(row));
  }

  // 학급이 없는 담임은 학생을 등록할 수 없다(학생은 학급 필요, 교사 계정은 총괄만) → 버튼을 막고 옆에 안내.
  const noClass = classMode && !ctx.classes.length;
  const createBlocked = noClass && !perms.canCreateTeacher;
  const homeroomOnly = classMode && !perms.superAdmin;
  // 구글·깃허브 전용 계정은 '탈퇴 처리' 대신 '완전 삭제'(총괄만 — docs/admin/oauth-delete/spec.md 개정 1).
  // 학급 기능 SQL 전(예전 방식)에는 완전 삭제를 쓸 수 없어(총괄 없음) 예전 '탈퇴 처리'를 그대로 둔다.
  const purgeAccess = purgeAccessFrom(ctx);
  const purgeEnabled = !perms.legacy;
  const columns = (classMode ? CLASS_COLUMNS : BASE_COLUMNS).map((col) =>
    !showConsent
      ? col
      : col.key === "provider"
        ? { ...col, className: PROVIDER_CELL_WITH_CONSENT }
        : col.key === "signed_up_at"
          ? { ...col, className: SIGNED_UP_CELL_WITH_CONSENT }
          : col,
  );
  const filterName =
    activeFilter === FILTER_NONE ? "학급 없음" : filterOptions.find((c) => c.id === activeFilter)?.name ?? null;

  // [이 학급 모두 동의서 받음으로 기록]: 내 학급마다 기록 없는 학생 수(탈퇴한 학생·구글 계정 제외). 학급을 골랐으면 그 학급만.
  const consentMissingByClass = useMemo(() => {
    if (!showConsent || state.status !== "ready" || !privacy.consents) return [];
    const consents = privacy.consents;
    return ctx.classes
      .filter((c) => activeFilter === FILTER_ALL || activeFilter === c.id)
      .map((c) => ({
        classId: c.id,
        className: c.name,
        count: state.rows.filter(
          (r) => r.class_id === c.id && !r.masked && isConsentSubject(r) && !isWithdrawnMember(r) && !consents.has(r.id),
        ).length,
      }))
      .filter((c) => c.count > 0);
  }, [showConsent, state, privacy.consents, ctx.classes, activeFilter]);

  // 가린 줄(다른 학급 학생 — 총괄)이 있으면 목록 위에 안내 한 줄(원문 8-8)
  const hasMasked = state.status === "ready" && state.rows.some((r) => r.masked);

  const description =
    state.status !== "ready"
      ? "가입한 회원을 찾아보고 관리합니다."
      : homeroomOnly
        ? `내 학급 학생 ${formatCount(state.rows.length)}명`
        : `전체 ${formatCount(state.rows.length)}명${filterName ? ` · ${filterName} ${formatCount(rows.length)}명` : ""}`;

  const createButton = (
    <Button
      className="h-11 px-4"
      onClick={() => setCreateOpen(true)}
      disabled={createBlocked}
      aria-describedby={noClass ? "member-add-hint" : undefined}
    >
      <UserPlusIcon />
      회원 추가
    </Button>
  );

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        title="회원 관리"
        description={description}
        actions={
          <>
            {noClass ? (
              <p className="text-sm text-muted-foreground" id="member-add-hint">
                먼저 학급을 개설해 주세요
              </p>
            ) : null}
            {createButton}
          </>
        }
      />

      <MyClassesCard
        onCleaned={() => {
          void reload();
          privacy.reload();
        }}
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-sm">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={classMode ? "이름, 아이디, 학급으로 검색" : "이름, 아이디, 이메일로 검색"}
            aria-label="회원 검색"
            className="h-11 bg-card pr-10 pl-8"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="검색어 지우기"
              className="absolute top-1/2 right-1.5 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <XIcon className="size-3.5" aria-hidden />
            </button>
          ) : null}
        </div>
        {showClassFilter ? (
          <label className="flex items-center gap-2 text-sm font-medium">
            학급
            <NativeSelect
              value={activeFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="h-11 max-w-[16rem] bg-card px-3"
            >
              <option value={FILTER_ALL}>전체</option>
              {filterOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
              {perms.superAdmin ? <option value={FILTER_NONE}>학급 없음(교사·미배정)</option> : null}
            </NativeSelect>
          </label>
        ) : null}
      </div>

      {consentMissingByClass.length ? (
        <ul className="flex flex-wrap gap-2" aria-label={PRIVACY_ADMIN_TEXT.consentColumn.header}>
          {consentMissingByClass.map((c) => (
            <li
              key={c.classId}
              className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-primary/25 bg-primary/5 px-3 py-2 text-sm"
            >
              <span className="flex items-center gap-1.5">
                <FileCheck2Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="font-medium">{c.className}</span>
                <span className="text-muted-foreground">
                  · {PRIVACY_ADMIN_TEXT.consentColumn.none} {fillText(PRIVACY_ADMIN_EXTRA_TEXT.countUnit, { n: c.count })}
                </span>
              </span>
              <Button
                variant="outline"
                className="h-11 px-3"
                onClick={() => {
                  setConsentTarget({ kind: "class", classId: c.classId, className: c.className, count: c.count });
                  setConsentOpen(true);
                }}
                aria-label={`${c.className} — ${PRIVACY_ADMIN_TEXT.consentColumn.classButton}`}
              >
                {PRIVACY_ADMIN_TEXT.consentColumn.classButton}
              </Button>
            </li>
          ))}
        </ul>
      ) : null}

      {hasMasked ? (
        <p role="note" className="flex items-start gap-2 rounded-xl border border-dashed px-3 py-2.5 text-sm text-muted-foreground">
          <EyeOffIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{PRIVACY_ADMIN_TEXT.maskedRows.notice}</span>
        </p>
      ) : null}

      {state.status === "loading" ? (
        <div className="flex flex-col gap-2" aria-busy="true" aria-label="회원 목록을 불러오는 중">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-xl" />
          ))}
        </div>
      ) : state.status === "error" ? (
        <ErrorState message={state.missing ? MISSING_SCHEMA_MESSAGE : "회원 목록을 불러오지 못했습니다."} onRetry={reload} />
      ) : !state.rows.length ? (
        homeroomOnly ? (
          <EmptyState
            title="아직 내 학급 학생이 없어요"
            description={
              noClass
                ? NO_CLASS_MESSAGE
                : "‘회원 추가’로 학생을 등록하면 여기에 나타나요. 다른 학급 학생은 이 화면에 보이지 않아요."
            }
            action={noClass ? undefined : createButton}
          />
        ) : (
          <EmptyState
            title="아직 가입한 회원이 없습니다"
            description="‘회원 추가’로 계정을 만들거나, 방문자가 가입하면 여기에 나타납니다."
            action={createButton}
          />
        )
      ) : !rows.length ? (
        <EmptyState
          title={query.trim() ? "검색 결과가 없습니다" : "이 학급에 해당하는 회원이 없습니다"}
          description={
            query.trim()
              ? `“${query.trim()}”와 일치하는 회원이 없습니다${filterName ? `(학급: ${filterName})` : ""}.`
              : undefined
          }
          action={
            <Button
              variant="outline"
              className="h-11 px-4"
              onClick={() => {
                setQuery("");
                setClassFilter(FILTER_ALL);
              }}
            >
              {query.trim() ? "검색어 지우기" : "전체 보기"}
            </Button>
          }
        />
      ) : (
        <>
          <p className="sr-only" aria-live="polite">
            {formatCount(rows.length)}명 표시 중
          </p>

          {/* 표·카드 전환은 화면 폭이 아니라 이 목록 자리의 폭(@container)으로 정한다(spec §4 공통 — 전역 사이드바·관리자 메뉴가
              옆에 있어 화면 폭과 목록 폭이 크게 다르다). 목록 폭 46rem(736px, 1280 화면) 이상: 정렬 가능한 표, 그보다 좁으면 카드 목록. */}
          <div className="@container">
            {/* 표. relative: 머리글의 sr-only "작업"(position:absolute)이 이 상자 밖 문서 폭을 늘려 화면 전체가 옆으로 밀리던 문제를 막는다.
                ⋮(작업) 칸은 오른쪽에 붙박이(sticky)라, 긴 이메일 등으로 표가 상자보다 넓어져도 항상 보인다. */}
            <div className={cn("relative hidden overflow-x-auto rounded-xl @min-[46rem]:block", adminSurfaceClass)}>
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                  <tr>
                    {columns.map((col) => {
                      const active = sort.key === col.key;
                      return (
                        <th
                          key={col.key}
                          scope="col"
                          aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
                          className={cn("px-3 py-2 font-medium whitespace-nowrap", col.className)}
                        >
                          <button
                            type="button"
                            onClick={() => toggleSort(col.key)}
                            className={cn(
                              "-mx-1.5 inline-flex items-center gap-1 rounded-md px-1.5 py-1 outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
                              active && "text-foreground",
                            )}
                          >
                            {col.label}
                            {active ? (
                              sort.dir === "asc" ? (
                                <ArrowUpIcon className="size-3.5" aria-hidden />
                              ) : (
                                <ArrowDownIcon className="size-3.5" aria-hidden />
                              )
                            ) : (
                              <ArrowUpDownIcon className="size-3.5 opacity-40" aria-hidden />
                            )}
                          </button>
                        </th>
                      );
                    })}
                    {showConsent ? (
                      <th scope="col" className="px-3 py-2 font-medium whitespace-nowrap">
                        {PRIVACY_ADMIN_TEXT.consentColumn.header}
                      </th>
                    ) : null}
                    <th
                      scope="col"
                      // 머리글 줄(bg-muted/40)과 같은 색을 불투명하게 합성해 칠한다
                      className={cn("px-3 py-2 text-right font-medium", STICKY_CELL, "bg-[color-mix(in_oklab,var(--muted)_40%,var(--card))]")}
                    >
                      <span className="sr-only">작업</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map((row) => {
                    const cls = classMode ? classLabelOf(row, ctx) : null;
                    return (
                      <tr
                        key={row.id}
                        onClick={(e) => onRowClick(e, row)}
                        className="group/row cursor-pointer transition-colors hover:bg-muted/50"
                      >
                        <td className="px-3 py-2.5">
                          <Link
                            href={detailHref(row)}
                            className="flex items-center gap-2.5 rounded-md font-medium outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                          >
                            <MemberAvatar member={row} size="sm" />
                            <span className="max-w-40 truncate">{memberName(row)}</span>
                          </Link>
                        </td>
                        {/* 긴 이메일은 잘라 보이고(마우스를 올리면 전체), 1280 화면에서도 표가 상자 안에 들어오게 폭을 12rem으로 */}
                        <td className="max-w-48 truncate px-3 py-2.5 text-muted-foreground" title={row.email || undefined}>
                          {accountLabel(row.email)}
                        </td>
                        {/* 학급 칸은 좁게(7rem) 두고 띄어쓰기에서 줄을 바꾼다 — 1280 화면에서도 표가 상자 안에 들어오게 */}
                        {cls ? (
                          <td
                            className={cn(
                              "max-w-28 px-3 py-2.5 break-keep [overflow-wrap:anywhere]",
                              cls.muted && "text-muted-foreground",
                            )}
                          >
                            {cls.text}
                          </td>
                        ) : null}
                        <td className={cn("px-3 py-2.5", showConsent ? PROVIDER_CELL_WITH_CONSENT : "hidden @4xl:table-cell")}>
                          <ProviderBadges member={row} />
                        </td>
                        {/* 날짜 칸은 날짜와 시각 사이에서만 줄을 바꾼다(글자는 그대로) → 1280~1440 화면에서도 표가 상자 안에 다 들어온다 */}
                        <td className={cn("px-3 py-2.5 text-muted-foreground", showConsent && SIGNED_UP_CELL_WITH_CONSENT)}>
                          <DateTimeText iso={row.signed_up_at} />
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground">
                          {row.last_sign_in_at ? <DateTimeText iso={row.last_sign_in_at} /> : "로그인 기록 없음"}
                        </td>
                        <td className="px-3 py-2.5">
                          <RoleBadge member={row} flag={privacy.flags?.get(row.id)} />
                        </td>
                        {showConsent ? (
                          <td className="px-3 py-2.5">
                            {isConsentSubject(row) ? (
                              <GuardianConsentStatus consent={consentOf(row, privacy.consents)} canRecord={menuOf(row, ctx, privacy, myId).consent} />
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                        ) : null}
                        <td
                          className={cn(
                            "px-3 py-2.5 text-right",
                            STICKY_CELL,
                            // 붙박이 칸은 불투명해야 밑으로 지나가는 글자를 가린다 — 줄 hover 색(bg-muted/50)을 같은 색으로 맞춘다
                            "bg-card transition-colors group-hover/row:bg-[color-mix(in_oklab,var(--muted)_50%,var(--card))]",
                          )}
                        >
                          <MemberActions
                            row={row}
                            myId={myId}
                            canChangeRole={perms.canChangeRole && classMode && !row.masked}
                            purgeMode={purgeEnabled && isOAuthOnlyMember(row)}
                            purgeAccess={purgeAccess}
                            privacyMenu={menuOf(row, ctx, privacy, myId)}
                            onReset={() => openReset(row)}
                            onWithdraw={() => openWithdraw(row)}
                            onPurge={() => openPurge(row)}
                            onRole={() => openRole(row)}
                            onScope={(next) => openScope(row, next)}
                            onConsent={() => openConsent(row)}
                            onErase={() => openErase(row)}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* 목록 폭이 좁을 때(태블릿·휴대폰, 사이드바가 펼쳐진 1024 등): 카드 목록 + 정렬 선택 */}
            <div className="flex flex-col gap-3 @min-[46rem]:hidden">
              <label className="flex items-center gap-2 self-end text-sm text-muted-foreground">
                정렬
                <select
                  value={`${sort.key}:${sort.dir}`}
                  onChange={(e) => {
                    const [key, dir] = e.target.value.split(":") as [SortKey, Sort["dir"]];
                    setSort({ key, dir });
                  }}
                  className="h-11 rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                >
                  <option value="signed_up_at:desc">최근 가입순</option>
                  <option value="signed_up_at:asc">오래된 가입순</option>
                  <option value="last_sign_in_at:desc">최근 로그인순</option>
                  <option value="name:asc">이름순</option>
                  <option value="account:asc">아이디순</option>
                  {classMode ? <option value="class:asc">학급순</option> : null}
                  <option value="role:asc">역할순</option>
                </select>
              </label>
              <ul className={cn("flex flex-col divide-y rounded-xl", adminSurfaceClass)}>
                {rows.map((row) => {
                  const cls = classMode ? classLabelOf(row, ctx) : null;
                  return (
                    <li key={row.id} className="flex flex-col gap-2 p-3">
                      <Link
                        href={detailHref(row)}
                        className="flex items-center gap-3 rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                      >
                        <MemberAvatar member={row} />
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate font-medium">{memberName(row)}</span>
                          <span className="truncate text-xs text-muted-foreground">
                            {accountLabel(row.email)}
                            {cls && !cls.muted ? ` · ${cls.text}` : ""}
                          </span>
                        </span>
                        <RoleBadge member={row} flag={privacy.flags?.get(row.id)} />
                      </Link>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <ProviderBadges member={row} />
                        {cls && cls.muted ? <span>{cls.text}</span> : null}
                        <span>가입 {formatDateTime(row.signed_up_at)}</span>
                        <span>
                          최근 로그인 {row.last_sign_in_at ? formatDateTime(row.last_sign_in_at) : "없음"}
                        </span>
                        {showConsent && isConsentSubject(row) ? (
                          <span className="flex items-center gap-1">
                            <span>{PRIVACY_ADMIN_TEXT.consentColumn.header}:</span>
                            <GuardianConsentStatus consent={consentOf(row, privacy.consents)} canRecord={menuOf(row, ctx, privacy, myId).consent} compact />
                          </span>
                        ) : null}
                      </div>
                      <div className="flex justify-end">
                        <MemberActions
                          row={row}
                          myId={myId}
                          canChangeRole={perms.canChangeRole && classMode && !row.masked}
                          purgeMode={purgeEnabled && isOAuthOnlyMember(row)}
                          purgeAccess={purgeAccess}
                          privacyMenu={menuOf(row, ctx, privacy, myId)}
                          onReset={() => openReset(row)}
                          onWithdraw={() => openWithdraw(row)}
                          onPurge={() => openPurge(row)}
                          onRole={() => openRole(row)}
                          onScope={(next) => openScope(row, next)}
                          onConsent={() => openConsent(row)}
                          onErase={() => openErase(row)}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </>
      )}

      <MemberCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => {
          void reload();
          void ctx.refresh();
        }}
      />
      <PasswordResetDialog target={resetTarget} open={resetOpen} onOpenChange={setResetOpen} onReset={markReset} />
      <MemberWithdrawDialog
        target={withdrawTarget}
        open={withdrawOpen}
        onOpenChange={setWithdrawOpen}
        onWithdrawn={markWithdrawn}
      />
      <MemberPurgeDialog
        target={purgeTarget}
        open={purgeOpen}
        onOpenChange={setPurgeOpen}
        onPurged={(userId) => refreshAfterPurge(userId, true)}
        onPartial={(userId) => refreshAfterPurge(userId, false)}
      />
      <RoleChangeDialog target={roleTarget} open={roleOpen} onOpenChange={setRoleOpen} onChanged={markRole} />
      <TeacherScopeDialog
        target={scopeTarget?.row ?? null}
        next={scopeTarget?.next ?? "full"}
        open={scopeOpen}
        onOpenChange={setScopeOpen}
        onChanged={(userId, scope) => privacy.patchFlag(userId, { teacherScope: scope })}
      />
      <GuardianConsentDialog
        target={consentTarget}
        open={consentOpen}
        onOpenChange={setConsentOpen}
        onRecorded={({ studentIds, classId }) => {
          if (studentIds.length) privacy.patchConsent(studentIds, consentByMe(myId, profile?.display_name));
          if (classId) privacy.reload();
        }}
      />
      <MemberEraseDialog target={eraseTarget} open={eraseOpen} onOpenChange={setEraseOpen} onErased={refreshAfterErase} />
    </div>
  );
}

/** 담임 지정/해제를 막는 이유(가능하면 null). 서버(admin_set_role)도 같은 규칙으로 거부한다. */
function roleChangeBlockReason(row: MemberRow, myId: string | null): string | null {
  if (isWithdrawnMember(row)) return "탈퇴한 학생";
  if (row.profiles?.role === "admin" && row.id === myId) return "본인 계정";
  return null;
}

/**
 * 파괴적인 동작(비밀번호 초기화·탈퇴 처리·완전 삭제)을 케밥 메뉴로 묶어 실수 클릭을 막는다(spec §1.3 Q3).
 * 할 수 없는 항목은 지우지 않고 비활성 + 이유를 보여 준다(왜 못 하는지 알 수 있게).
 * 총괄에게는 "담임교사로 지정 / 담임 해제"도 보인다(docs/classes/spec.md 개정 1-2 — admin_set_role).
 * 구글·깃허브 전용 계정(purgeMode)은 마지막 항목이 '탈퇴 처리' 대신 '완전 삭제'다(docs/admin/oauth-delete/spec.md 개정 1 — 교체).
 */
function MemberActions({
  row,
  myId,
  canChangeRole,
  purgeMode,
  purgeAccess,
  privacyMenu,
  onReset,
  onWithdraw,
  onPurge,
  onRole,
  onScope,
  onConsent,
  onErase,
}: {
  row: MemberRow;
  myId: string | null;
  canChangeRole: boolean;
  purgeMode: boolean;
  purgeAccess: PurgeAccess;
  /** 개인정보 메뉴(할 수 없는 항목은 넣지 않는다 — privacyMenuOf) */
  privacyMenu: { consent: boolean; erase: boolean; scope: TeacherScope | null };
  onReset: () => void;
  onWithdraw: () => void;
  onPurge: () => void;
  onRole: () => void;
  onScope: (next: TeacherScope) => void;
  onConsent: () => void;
  onErase: () => void;
}) {
  const name = memberName(row);
  const resetBlock = passwordResetBlockReason(row, myId);
  const withdrawBlock = purgeMode ? null : withdrawBlockReason(row, myId);
  const purgeBlock = purgeMode ? purgeBlockReason(row, myId, purgeAccess) : null;
  const isTeacher = row.profiles?.role === "admin";
  const roleBlock = canChangeRole ? roleChangeBlockReason(row, myId) : null;
  return (
    // 메뉴는 포털로 그려지지만 이벤트는 React 트리를 타고 올라온다.
    // 여기서 막지 않으면 항목 클릭이 표의 행(onRowClick)까지 올라가 회원 상세로 이동해 버린다(review U1).
    <span onClick={(e) => e.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`${name} 관리 메뉴`} />}>
          <EllipsisVerticalIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {canChangeRole ? (
            <>
              <DropdownMenuItem
                disabled={!!roleBlock}
                onClick={onRole}
                title={roleBlock ?? undefined}
                aria-label={
                  roleBlock
                    ? `${isTeacher ? "담임 해제" : "담임교사로 지정"} 불가: ${roleBlock}`
                    : `${name} ${isTeacher ? "담임 해제" : "담임교사로 지정"}`
                }
              >
                {isTeacher ? <ShieldOffIcon /> : <ShieldCheckIcon />}
                {isTeacher ? "담임 해제" : "담임교사로 지정"}
                {roleBlock ? <span className="ml-auto text-xs text-muted-foreground">{roleBlock}</span> : null}
              </DropdownMenuItem>
              {privacyMenu.scope ? (
                <DropdownMenuItem
                  onClick={() => onScope(privacyMenu.scope === "class" ? "full" : "class")}
                  aria-label={`${name} ${privacyMenu.scope === "class" ? PRIVACY_ADMIN_TEXT.googleTeacher.widenMenu : PRIVACY_ADMIN_TEXT.googleTeacher.narrowMenu}`}
                >
                  {privacyMenu.scope === "class" ? <ShieldPlusIcon /> : <ShieldHalfIcon />}
                  {privacyMenu.scope === "class" ? PRIVACY_ADMIN_TEXT.googleTeacher.widenMenu : PRIVACY_ADMIN_TEXT.googleTeacher.narrowMenu}
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuSeparator />
            </>
          ) : null}
          {privacyMenu.consent ? (
            <>
              <DropdownMenuItem onClick={onConsent} aria-label={`${name} ${PRIVACY_ADMIN_TEXT.consentColumn.recordButton}`}>
                <FileCheck2Icon />
                {PRIVACY_ADMIN_TEXT.consentColumn.recordButton}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          ) : null}
          <DropdownMenuItem
            disabled={!!resetBlock}
            onClick={onReset}
            title={resetBlock?.long}
            aria-label={resetBlock ? `비밀번호 초기화 불가: ${resetBlock.long}` : `${name} 비밀번호 초기화`}
          >
            <KeyRoundIcon />
            비밀번호 초기화
            {resetBlock ? <span className="ml-auto text-xs text-muted-foreground">{resetBlock.short}</span> : null}
          </DropdownMenuItem>
          {purgeMode ? (
            <DropdownMenuItem
              variant="destructive"
              disabled={!!purgeBlock}
              onClick={onPurge}
              title={purgeBlock?.long}
              aria-label={purgeBlock ? `완전 삭제 불가: ${purgeBlock.long}` : `${name} 완전 삭제`}
            >
              <Trash2Icon />
              완전 삭제
              {purgeBlock ? <span className="ml-auto text-xs text-muted-foreground">{purgeBlock.short}</span> : null}
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              variant="destructive"
              disabled={!!withdrawBlock}
              onClick={onWithdraw}
              title={withdrawBlock?.long}
              aria-label={withdrawBlock ? `탈퇴 처리 불가: ${withdrawBlock.long}` : `${name} 탈퇴 처리`}
            >
              <UserMinusIcon />
              탈퇴 처리
              {withdrawBlock ? <span className="ml-auto text-xs text-muted-foreground">{withdrawBlock.short}</span> : null}
            </DropdownMenuItem>
          )}
          {/* 보호자·학생이 삭제를 요구할 때: 계정과 모든 기록(탈퇴한 학생으로도 남지 않음 — 8-5) */}
          {privacyMenu.erase ? (
            <DropdownMenuItem
              variant="destructive"
              onClick={onErase}
              aria-label={`${name} ${PRIVACY_ADMIN_TEXT.studentErase.menu}`}
            >
              <EraserIcon />
              {PRIVACY_ADMIN_TEXT.studentErase.menu}
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </span>
  );
}
