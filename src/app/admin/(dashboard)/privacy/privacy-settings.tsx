"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ClipboardEvent,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { ActivityIcon, CheckCircle2Icon, KeyRoundIcon, LockKeyholeIcon, Loader2Icon, MailIcon } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/admin-shell";
import { adminSurfaceClass } from "@/components/admin/admin-styles";
import { ClassRetentionCard } from "@/components/admin/class-controls";
import { ErrorState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { PRIVACY_ADMIN_EXTRA_TEXT as EXTRA, PRIVACY_ADMIN_TEXT as T, fillText } from "@/data/privacy-admin-text";
import { useAdminContext } from "@/hooks/use-admin-context";
import { AdminActionError } from "@/lib/admin";
import {
  CONTACT_EMAIL_MAX,
  fetchPrivacyOverview,
  isValidContactEmail,
  PrivacyMissingError,
  setContactEmail,
  setTeacherCode,
  TEACHER_CODE_LENGTH,
  TEACHER_CODE_RE,
  type PrivacyOverview,
} from "@/lib/admin-privacy";
import { formatDate, formatCount } from "@/lib/format";
import { cn } from "@/lib/utils";

const S = T.settings;

type OverviewState =
  | { status: "loading" }
  | { status: "missing" }
  | { status: "error" }
  | { status: "ready"; data: PrivacyOverview };

/**
 * 총괄 선생님 '개인정보 설정'(/admin/privacy/ — docs/privacy/spec.md 6절, 문구 privacy-policy.md 8-7).
 * - 교사 인증 코드: 숫자 6자리를 두 번 적어 정한다. 서버에는 bcrypt 해시로만 저장되어(admin_set_teacher_code) 다시 볼 수 없다.
 *   ⚠ 코드는 이 화면의 state에만 잠깐 있고, 정한 뒤 바로 지운다(로그·주소·저장소 어디에도 남기지 않는다).
 * - 문의 이메일: 처리방침 화면에 공개로 보인다(site_settings.contact_email — admin_set_contact_email).
 * - 현황: 인증 전 계정·틀린 시도·잠긴 계정·처리방침 판 번호(admin_privacy_overview).
 * - 학급 정리 기한: 기한이 지났는데 남은 학생(총괄 = 전체 학급).
 * 총괄이 아니면 화면을 보여 주지 않는다(메뉴에도 없음). 실제 권한은 서버 RPC가 다시 확인한다.
 */
export function PrivacySettings() {
  const ctx = useAdminContext();

  if (ctx.status === "loading") {
    return (
      <div className="flex flex-col gap-6" aria-busy="true" aria-label={S.title}>
        <AdminPageHeader title={S.title} />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    );
  }
  if (ctx.status === "error") {
    return (
      <div className="flex flex-col gap-6">
        <AdminPageHeader title={S.title} />
        <ErrorState message={EXTRA.overviewError} onRetry={ctx.retry} />
      </div>
    );
  }
  if (!(ctx.status === "ready" && ctx.isSuperAdmin)) {
    return (
      <div className="flex flex-col gap-6">
        <AdminPageHeader title={S.title} />
        <p className="flex items-center gap-2 rounded-2xl border border-dashed px-4 py-3 text-sm text-muted-foreground" role="note">
          <LockKeyholeIcon className="size-4 shrink-0" aria-hidden />
          {EXTRA.superOnlyPage}
        </p>
      </div>
    );
  }
  return <SuperPrivacySettings />;
}

function SuperPrivacySettings() {
  const [state, setState] = useState<OverviewState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    fetchPrivacyOverview().then(
      (data) => {
        if (active) setState({ status: "ready", data });
      },
      (e: unknown) => {
        if (active) setState({ status: e instanceof PrivacyMissingError ? "missing" : "error" });
      },
    );
    return () => {
      active = false;
    };
  }, [attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader title={S.title} />

      {state.status === "loading" ? (
        <div className="flex flex-col gap-4" aria-busy="true" aria-label={S.title}>
          <Skeleton className="h-56 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
        </div>
      ) : state.status === "missing" ? (
        <p role="note" className="rounded-2xl border border-dashed px-4 py-3 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{EXTRA.missingPrefix}</span>
          {EXTRA.missing}
        </p>
      ) : state.status === "error" ? (
        <ErrorState message={EXTRA.overviewError} onRetry={reload} />
      ) : (
        <div className="grid gap-6 xl:grid-cols-2">
          <TeacherCodeCard overview={state.data} onSaved={reload} />
          <div className="flex min-w-0 flex-col gap-6">
            <ContactEmailCard overview={state.data} onSaved={reload} />
            <StatusCard overview={state.data} />
          </div>
        </div>
      )}

      {state.status === "ready" ? <ClassRetentionCard variant="settings" /> : null}
    </div>
  );
}

function SectionCard({
  icon: Icon,
  title,
  headingId,
  children,
}: {
  icon: typeof KeyRoundIcon;
  title: string;
  headingId: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={headingId} className={cn("flex min-w-0 flex-col gap-4 rounded-2xl p-4 sm:p-5", adminSurfaceClass)}>
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary" aria-hidden>
          <Icon className="size-5" />
        </span>
        <h2 id={headingId} className="font-heading text-lg leading-tight font-normal">
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

// ─────────────────────────────────────────────
// 교사 인증 코드
// ─────────────────────────────────────────────

const EMPTY_CODE = (): string[] => Array.from({ length: TEACHER_CODE_LENGTH }, () => "");

function TeacherCodeCard({ overview, onSaved }: { overview: PrivacyOverview; onSaved: () => void }) {
  const headingId = useId();
  const helpId = useId();
  const messageId = useId();
  const [first, setFirst] = useState<string[]>(EMPTY_CODE);
  const [second, setSecond] = useState<string[]>(EMPTY_CODE);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const working = useRef(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (working.current) return;
    const a = first.join("");
    const b = second.join("");
    if (!TEACHER_CODE_RE.test(a) || !TEACHER_CODE_RE.test(b)) {
      setMessage({ kind: "error", text: S.codeBad });
      return;
    }
    if (a !== b) {
      setMessage({ kind: "error", text: S.codeMismatch });
      return;
    }
    working.current = true;
    setBusy(true);
    setMessage(null);
    try {
      await setTeacherCode(a);
      // 정한 코드는 화면에서도 바로 지운다.
      setFirst(EMPTY_CODE());
      setSecond(EMPTY_CODE());
      setMessage({ kind: "ok", text: S.codeOk });
      onSaved();
    } catch (err) {
      setMessage({ kind: "error", text: err instanceof AdminActionError ? err.message : T.network });
    } finally {
      working.current = false;
      setBusy(false);
    }
  }

  const status = overview.codeSet
    ? fillText(S.codeSet, { 날짜: (overview.codeSetAt && formatDate(overview.codeSetAt)) || "—" })
    : S.codeUnset;

  return (
    <SectionCard icon={KeyRoundIcon} title={S.codeHeading} headingId={headingId}>
      <p className="flex items-center gap-2 text-sm">
        {overview.codeSet ? (
          <CheckCircle2Icon className="size-4 shrink-0 text-emerald-700 dark:text-emerald-400" aria-hidden />
        ) : (
          <KeyRoundIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        )}
        <span className={overview.codeSet ? "font-medium" : "text-muted-foreground"}>{status}</span>
      </p>
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <CodeBoxes
          legend={S.codeNew}
          suffix={S.codeDigits}
          value={first}
          onChange={(v) => {
            setFirst(v);
            if (message?.kind === "error") setMessage(null);
          }}
          disabled={busy}
          describedBy={`${helpId}${message ? ` ${messageId}` : ""}`}
          invalid={message?.kind === "error"}
        />
        <CodeBoxes
          legend={S.codeAgain}
          value={second}
          onChange={(v) => {
            setSecond(v);
            if (message?.kind === "error") setMessage(null);
          }}
          disabled={busy}
          describedBy={`${helpId}${message ? ` ${messageId}` : ""}`}
          invalid={message?.kind === "error"}
        />
        <p id={helpId} className="text-xs leading-5 text-muted-foreground">
          {S.codeHelp}
        </p>
        {message ? (
          <p
            id={messageId}
            role={message.kind === "error" ? "alert" : "status"}
            className={cn(
              "rounded-xl p-3 text-sm",
              message.kind === "error" ? "border border-destructive/30 bg-destructive/5" : "border border-foreground/10 bg-muted/50",
            )}
          >
            {message.text}
          </p>
        ) : null}
        <div>
          <Button type="submit" className="h-11 px-4" disabled={busy}>
            {busy ? <Loader2Icon className="animate-spin motion-reduce:animate-none" /> : <KeyRoundIcon />}
            {S.codeButton}
          </Button>
        </div>
      </form>
    </SectionCard>
  );
}

/**
 * 숫자 6칸 입력. 한 칸에 숫자 하나 — 적으면 다음 칸으로, 지우면 앞 칸으로, 붙여 넣으면 나눠 채운다.
 * 숫자가 아닌 글자는 받지 않는다. 비밀번호 칸(type=password)이 아니어서 브라우저가 "비밀번호 저장"을 묻지 않는다.
 */
function CodeBoxes({
  legend,
  suffix,
  value,
  onChange,
  disabled,
  describedBy,
  invalid,
}: {
  legend: string;
  suffix?: string;
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  describedBy?: string;
  invalid?: boolean;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  function focusAt(i: number) {
    const el = refs.current[Math.max(0, Math.min(TEACHER_CODE_LENGTH - 1, i))];
    el?.focus();
    el?.select();
  }

  function fillFrom(start: number, digits: string) {
    const next = value.slice();
    let i = start;
    for (const d of digits) {
      if (i >= TEACHER_CODE_LENGTH) break;
      next[i] = d;
      i += 1;
    }
    onChange(next);
    focusAt(Math.min(i, TEACHER_CODE_LENGTH - 1));
  }

  function onInput(i: number, raw: string) {
    const digits = raw.replace(/\D/g, "");
    if (!digits) {
      const next = value.slice();
      next[i] = "";
      onChange(next);
      return;
    }
    // 이미 숫자가 있는 칸에 하나 더 적으면 새로 적은 숫자만 남긴다.
    if (digits.length === 2 && value[i]) {
      fillFrom(i, digits.replace(value[i], "").slice(0, 1) || digits.slice(-1));
      return;
    }
    fillFrom(i, digits);
  }

  function onKeyDown(i: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !value[i] && i > 0) {
      e.preventDefault();
      const next = value.slice();
      next[i - 1] = "";
      onChange(next);
      focusAt(i - 1);
    } else if (e.key === "ArrowLeft" && i > 0) {
      e.preventDefault();
      focusAt(i - 1);
    } else if (e.key === "ArrowRight" && i < TEACHER_CODE_LENGTH - 1) {
      e.preventDefault();
      focusAt(i + 1);
    }
  }

  function onPaste(i: number, e: ClipboardEvent<HTMLInputElement>) {
    const digits = e.clipboardData.getData("text").replace(/\D/g, "");
    if (!digits) return;
    e.preventDefault();
    fillFrom(i, digits);
  }

  return (
    <fieldset className="flex flex-col gap-1.5" disabled={disabled}>
      <legend className="mb-1.5 text-sm font-medium">
        {legend}
        {suffix ? <span className="ml-1 font-normal text-muted-foreground">{suffix}</span> : null}
      </legend>
      <div className="flex flex-wrap gap-1.5 sm:gap-2">
        {value.map((d, i) => (
          <input
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            value={d}
            onChange={(e) => onInput(i, e.target.value)}
            onKeyDown={(e) => onKeyDown(i, e)}
            onPaste={(e) => onPaste(i, e)}
            onFocus={(e) => e.target.select()}
            aria-label={fillText(EXTRA.codeDigitLabel, { 칸: legend, n: i + 1 })}
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            className="size-11 rounded-lg border border-input bg-background text-center font-mono text-lg font-semibold tabular-nums outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive dark:bg-input/30"
          />
        ))}
      </div>
    </fieldset>
  );
}

// ─────────────────────────────────────────────
// 문의 이메일
// ─────────────────────────────────────────────

function ContactEmailCard({ overview, onSaved }: { overview: PrivacyOverview; onSaved: () => void }) {
  const headingId = useId();
  const fieldId = useId();
  const helpId = useId();
  const messageId = useId();
  const [email, setEmail] = useState(overview.contactEmail ?? "");
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const working = useRef(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (working.current) return;
    if (!isValidContactEmail(email)) {
      setMessage({ kind: "error", text: S.emailBad });
      return;
    }
    working.current = true;
    setBusy(true);
    setMessage(null);
    try {
      await setContactEmail(email);
      setEmail(email.trim());
      setMessage({ kind: "ok", text: S.emailOk });
      onSaved();
    } catch (err) {
      setMessage({ kind: "error", text: err instanceof AdminActionError ? err.message : T.network });
    } finally {
      working.current = false;
      setBusy(false);
    }
  }

  return (
    <SectionCard icon={MailIcon} title={S.emailHeading} headingId={headingId}>
      <form onSubmit={onSubmit} className="flex flex-col gap-2" noValidate>
        <label htmlFor={fieldId} className="sr-only">
          {S.emailHeading}
        </label>
        <div className="flex flex-wrap gap-2">
          <Input
            id={fieldId}
            type="email"
            inputMode="email"
            autoComplete="off"
            spellCheck={false}
            maxLength={CONTACT_EMAIL_MAX}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (message) setMessage(null);
            }}
            disabled={busy}
            aria-invalid={message?.kind === "error" || undefined}
            aria-describedby={`${helpId}${message ? ` ${messageId}` : ""}`}
            className="h-11 min-w-0 flex-1 basis-56"
          />
          <Button type="submit" className="h-11 px-4" disabled={busy}>
            {busy ? <Loader2Icon className="animate-spin motion-reduce:animate-none" /> : null}
            {S.emailButton}
          </Button>
        </div>
        <p id={helpId} className="text-xs leading-5 text-muted-foreground">
          {S.emailHelp}
        </p>
        {message ? (
          <p
            id={messageId}
            role={message.kind === "error" ? "alert" : "status"}
            className={cn(
              "rounded-xl p-3 text-sm",
              message.kind === "error" ? "border border-destructive/30 bg-destructive/5" : "border border-foreground/10 bg-muted/50",
            )}
          >
            {message.text}
          </p>
        ) : null}
      </form>
    </SectionCard>
  );
}

// ─────────────────────────────────────────────
// 현황
// ─────────────────────────────────────────────

function StatusCard({ overview }: { overview: PrivacyOverview }) {
  const headingId = useId();
  const items = [
    fillText(S.statusPending, { n: formatCount(overview.pendingCount), k: formatCount(overview.pendingOver30d) }),
    fillText(S.statusWrong, { n: formatCount(overview.wrongLastHour) }),
    fillText(S.statusLocked, { n: formatCount(overview.lockedAccounts) }),
    fillText(S.statusVersion, { "판 번호": overview.privacyVersion }),
  ];
  return (
    <SectionCard icon={ActivityIcon} title={S.statusHeading} headingId={headingId}>
      <ul className="flex flex-col gap-1.5 text-sm">
        {items.map((text) => (
          <li key={text} className="flex items-start gap-2">
            <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary/60" aria-hidden />
            <span>{text}</span>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}
