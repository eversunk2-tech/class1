"use client";

import { useCallback, useEffect, useMemo, useState, type MouseEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon, KeyRoundIcon, SearchIcon, XIcon } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/admin-shell";
import { MemberAvatar, ProviderBadges, RoleBadge } from "@/components/admin/member-badges";
import { PasswordResetDialog } from "@/components/admin/password-reset-dialog";
import { EmptyState, ErrorState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/hooks/use-session";
import {
  accountLabel,
  fetchMembers,
  isMissingSchemaError,
  memberName,
  memberProviders,
  MISSING_SCHEMA_MESSAGE,
  passwordResetBlockReason,
} from "@/lib/admin";
import { formatCount, formatDateTime } from "@/lib/format";
import type { MemberRow } from "@/lib/types";
import { cn } from "@/lib/utils";

type State = { status: "loading" } | { status: "error"; missing: boolean } | { status: "ready"; rows: MemberRow[] };

type SortKey = "name" | "account" | "provider" | "signed_up_at" | "last_sign_in_at" | "role";
type Sort = { key: SortKey; dir: "asc" | "desc" };

const COLUMNS: { key: SortKey; label: string; className?: string }[] = [
  { key: "name", label: "이름" },
  { key: "account", label: "아이디/이메일" },
  { key: "provider", label: "가입 방식" },
  { key: "signed_up_at", label: "가입일" },
  { key: "last_sign_in_at", label: "마지막 로그인" },
  { key: "role", label: "역할" },
];

const collator = new Intl.Collator("ko");

function compare(a: MemberRow, b: MemberRow, key: SortKey): number {
  switch (key) {
    case "name":
      return collator.compare(memberName(a), memberName(b));
    case "account":
      return collator.compare(accountLabel(a.email), accountLabel(b.email));
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

function matches(row: MemberRow, q: string): boolean {
  if (!q) return true;
  return [memberName(row), row.email, accountLabel(row.email)].some((v) => v.toLowerCase().includes(q));
}

export function MemberList() {
  const router = useRouter();
  const { user } = useSession();
  const myId = user?.id ?? null;
  const [state, setState] = useState<State>({ status: "loading" });
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>({ key: "signed_up_at", dir: "desc" });
  const [resetTarget, setResetTarget] = useState<MemberRow | null>(null);
  const [resetOpen, setResetOpen] = useState(false);

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

  const rows = useMemo(() => {
    if (state.status !== "ready") return [];
    const q = query.trim().toLowerCase();
    const filtered = state.rows.filter((r) => matches(r, q));
    const sign = sort.dir === "asc" ? 1 : -1;
    return filtered.sort((a, b) => compare(a, b, sort.key) * sign || collator.compare(memberName(a), memberName(b)));
  }, [state, query, sort]);

  function toggleSort(key: SortKey) {
    setSort((s) =>
      s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: key.endsWith("_at") ? "desc" : "asc" },
    );
  }

  function openReset(row: MemberRow) {
    setResetTarget(row);
    setResetOpen(true);
  }

  function markReset(userId: string) {
    setState((s) =>
      s.status === "ready"
        ? {
            ...s,
            rows: s.rows.map((r) =>
              r.id === userId && r.profiles ? { ...r, profiles: { ...r.profiles, must_change_password: true } } : r,
            ),
          }
        : s,
    );
  }

  const detailHref = (row: MemberRow) => `/admin/members/?id=${row.id}`;

  // 행 아무 곳이나 눌러도 상세로 이동한다(버튼·링크를 누른 경우는 제외).
  function onRowClick(e: MouseEvent<HTMLElement>, row: MemberRow) {
    if ((e.target as HTMLElement).closest("a,button,input,label")) return;
    router.push(detailHref(row));
  }

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        title="회원 관리"
        description={
          state.status === "ready" ? `전체 ${formatCount(state.rows.length)}명` : "가입한 회원을 찾아보고 관리합니다."
        }
      />

      <div className="relative max-w-sm">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="이름, 아이디, 이메일로 검색"
          aria-label="회원 검색"
          className="h-9 pr-8 pl-8"
        />
        {query ? (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="검색어 지우기"
            className="absolute top-1/2 right-1.5 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <XIcon className="size-3.5" aria-hidden />
          </button>
        ) : null}
      </div>

      {state.status === "loading" ? (
        <div className="flex flex-col gap-2" aria-busy="true" aria-label="회원 목록을 불러오는 중">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-xl" />
          ))}
        </div>
      ) : state.status === "error" ? (
        <ErrorState message={state.missing ? MISSING_SCHEMA_MESSAGE : "회원 목록을 불러오지 못했습니다."} onRetry={reload} />
      ) : !state.rows.length ? (
        <EmptyState title="아직 가입한 회원이 없습니다" description="회원이 가입하거나 계정을 등록하면 여기에 나타납니다." />
      ) : !rows.length ? (
        <EmptyState
          title="검색 결과가 없습니다"
          description={`“${query.trim()}”와 일치하는 회원이 없습니다.`}
          action={
            <Button variant="outline" onClick={() => setQuery("")}>
              검색어 지우기
            </Button>
          }
        />
      ) : (
        <>
          <p className="sr-only" aria-live="polite">
            {formatCount(rows.length)}명 표시 중
          </p>

          {/* md 이상: 정렬 가능한 표 */}
          <div className="hidden overflow-x-auto rounded-xl bg-card ring-1 ring-foreground/10 md:block">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                <tr>
                  {COLUMNS.map((col) => {
                    const active = sort.key === col.key;
                    return (
                      <th
                        key={col.key}
                        scope="col"
                        aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
                        className="px-3 py-2 font-medium whitespace-nowrap"
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
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    <span className="sr-only">작업</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    onClick={(e) => onRowClick(e, row)}
                    className="cursor-pointer transition-colors hover:bg-muted/50"
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
                    <td className="max-w-52 truncate px-3 py-2.5 text-muted-foreground">{accountLabel(row.email)}</td>
                    <td className="px-3 py-2.5">
                      <ProviderBadges member={row} />
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">{formatDateTime(row.signed_up_at)}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">
                      {row.last_sign_in_at ? formatDateTime(row.last_sign_in_at) : "로그인 기록 없음"}
                    </td>
                    <td className="px-3 py-2.5">
                      <RoleBadge member={row} />
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <ResetButton row={row} myId={myId} onClick={() => openReset(row)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* md 미만: 카드 목록 + 정렬 선택 */}
          <div className="flex flex-col gap-3 md:hidden">
            <label className="flex items-center gap-2 self-end text-sm text-muted-foreground">
              정렬
              <select
                value={`${sort.key}:${sort.dir}`}
                onChange={(e) => {
                  const [key, dir] = e.target.value.split(":") as [SortKey, Sort["dir"]];
                  setSort({ key, dir });
                }}
                className="h-8 rounded-lg border border-input bg-background px-2 text-sm text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
              >
                <option value="signed_up_at:desc">최근 가입순</option>
                <option value="signed_up_at:asc">오래된 가입순</option>
                <option value="last_sign_in_at:desc">최근 로그인순</option>
                <option value="name:asc">이름순</option>
                <option value="account:asc">아이디순</option>
                <option value="role:asc">역할순</option>
              </select>
            </label>
            <ul className="flex flex-col divide-y rounded-xl bg-card ring-1 ring-foreground/10">
              {rows.map((row) => (
                <li key={row.id} className="flex flex-col gap-2 p-3">
                  <Link
                    href={detailHref(row)}
                    className="flex items-center gap-3 rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <MemberAvatar member={row} />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate font-medium">{memberName(row)}</span>
                      <span className="truncate text-xs text-muted-foreground">{accountLabel(row.email)}</span>
                    </span>
                    <RoleBadge member={row} />
                  </Link>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <ProviderBadges member={row} />
                    <span>가입 {formatDateTime(row.signed_up_at)}</span>
                    <span>
                      최근 로그인 {row.last_sign_in_at ? formatDateTime(row.last_sign_in_at) : "없음"}
                    </span>
                  </div>
                  <div className="flex justify-end">
                    <ResetButton row={row} myId={myId} onClick={() => openReset(row)} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      <PasswordResetDialog target={resetTarget} open={resetOpen} onOpenChange={setResetOpen} onReset={markReset} />
    </div>
  );
}

function ResetButton({ row, myId, onClick }: { row: MemberRow; myId: string | null; onClick: () => void }) {
  const block = passwordResetBlockReason(row, myId);
  if (block) {
    return (
      <Button variant="ghost" size="sm" disabled title={block.long} aria-label={`${memberName(row)} 비밀번호 초기화 불가: ${block.long}`}>
        {block.short}
      </Button>
    );
  }
  return (
    <Button variant="outline" size="sm" onClick={onClick} aria-label={`${memberName(row)} 비밀번호 초기화`}>
      <KeyRoundIcon />
      비밀번호 초기화
    </Button>
  );
}
