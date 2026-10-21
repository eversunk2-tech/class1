"use client";

import { Fragment, useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { ExternalLinkIcon, Loader2Icon, ShieldCheckIcon } from "lucide-react";
import { toast } from "sonner";
import { splitLinks } from "@/components/linkified-text";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  ADMIN_ACK_WINDOW,
  CANCEL_CONFIRM,
  EXISTING_MEMBER_WINDOW,
  GATE_MESSAGES,
  NEW_SIGNUP_WINDOW,
  POLICY_CHANGED_WINDOW,
  type GateField,
  type PolicyBlock,
} from "@/data/privacy-policy";
import { useSession } from "@/hooks/use-session";
import { signOut } from "@/lib/auth";
import { withBasePath } from "@/lib/base-path";
import { dangerSolidClass } from "@/lib/danger-button";
import { outlinePillClass, primaryPillClass } from "@/lib/pill";
import {
  acknowledgePrivacy,
  CODE_LENGTH,
  isCompleteCode,
  localSignOut,
  plainText,
  POLICY_CHANGE_SUMMARY,
  POLICY_VERSION,
  PrivacyActionError,
  selfDeleteMember,
  validateNickname,
  verifyGoogleTeacher,
  type GateActionResult,
  type MemberGate,
} from "@/lib/privacy";
import { cn } from "@/lib/utils";

/*
 * 구글 계정 개인정보 확인 창(docs/privacy/spec.md 3절, 글은 privacy-policy.md 1~4절 원문 그대로).
 *
 * - 1절 새 구글 가입(need_code · new) / 2절 기존 구글 회원(need_code · existing): 별명 + 코드 6자리 + 체크. 닫기 없음
 *   (바깥 클릭·Esc 무시). [가입하지 않기]는 4-1 확인 창 → Edge Function member-self-delete(cancel) → 이 기기 로그아웃.
 * - 3-1 코드 없는 확인(need_ack · 처음) / 3-2 처리방침이 바뀌었을 때(need_ack · 다시): [나중에]로 **이 탭에서만** 닫힌다
 *   (새로 고치면 다시 뜬다 — 상태를 저장하지 않는다). 서버는 이 계정들을 막지 않는다.
 * - /privacy/에서는 띄우지 않는다: 창의 [개인정보 처리방침 전체 보기]가 새 탭으로 그 화면을 열기 때문(원문 1절 메모).
 * - 창은 안내일 뿐이고 실제 막기는 서버(RESTRICTIVE 정책·RPC)가 한다. 교사 인증 코드는 RPC 요청 본문으로만 보내고
 *   주소·저장소·로그에 남기지 않는다.
 */

// ─────────────────────────────────────────────
// 원문 표기(**굵게**, `코드`, `{자리}`, 인터넷 주소)를 화면 글로 — /privacy/ 화면도 같이 쓴다
// ─────────────────────────────────────────────

const linkClass =
  "font-medium text-primary underline underline-offset-4 [overflow-wrap:anywhere] hover:text-primary/80 focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

function linkify(text: string, keyBase: string): ReactNode[] {
  return splitLinks(text).map((part, i) =>
    part.href ? (
      <a key={`${keyBase}-${i}`} href={part.href} target="_blank" rel="noopener noreferrer" className={linkClass}>
        {part.text}
      </a>
    ) : (
      <Fragment key={`${keyBase}-${i}`}>{part.text}</Fragment>
    ),
  );
}

type Segment = { text: string; bold: boolean; code: boolean };

/**
 * 원문 표기를 조각으로: `…`(코드 — 안의 `*`는 굵게 표시가 아님, 예: `k***`)를 먼저 보고, 그 밖의 `**`로 굵게를 켜고 끈다.
 */
function segments(text: string): Segment[] {
  const out: Segment[] = [];
  let bold = false;
  let buf = "";
  const flush = () => {
    if (buf) out.push({ text: buf, bold, code: false });
    buf = "";
  };
  for (let i = 0; i < text.length; ) {
    if (text[i] === "`") {
      const end = text.indexOf("`", i + 1);
      if (end > i) {
        flush();
        out.push({ text: text.slice(i + 1, end), bold, code: true });
        i = end + 1;
        continue;
      }
    }
    if (text.startsWith("**", i)) {
      flush();
      bold = !bold;
      i += 2;
      continue;
    }
    buf += text[i];
    i += 1;
  }
  flush();
  return out;
}

/** 원문 한 문장(또는 문단)을 그린다. `values`는 `{자리}` → 화면에 넣을 값. */
export function PolicyText({ text, values }: { text: string; values?: Readonly<Record<string, ReactNode>> }) {
  return (
    <>
      {segments(text).map((seg, i) => {
        let content: ReactNode;
        if (seg.code) {
          // `{자리}`면 값으로 채우고, 아니면(k***, sci6… 등) 글자 그대로
          const slot = /^\{(.+)\}$/.exec(seg.text);
          content = slot && values && slot[1] in values ? values[slot[1]] : seg.text;
        } else {
          content = linkify(seg.text, `s${i}`);
        }
        return seg.bold ? (
          <strong key={i} className="font-semibold text-foreground">
            {content}
          </strong>
        ) : (
          <Fragment key={i}>{content}</Fragment>
        );
      })}
    </>
  );
}

/**
 * 표: 넓은 화면은 표, 좁은 화면(휴대폰)은 줄마다 카드(머리 이름: 내용) — 페이지가 옆으로 밀리지 않게.
 * 칸이 5개 이상인 표(제5조 국외 이전)는 넓은 화면에서도 칸이 너무 좁아지므로 늘 카드로 보인다.
 */
export function PolicyTable({
  head,
  rows,
  values,
  className,
}: {
  head: readonly string[];
  rows: readonly (readonly string[])[];
  values?: Readonly<Record<string, ReactNode>>;
  className?: string;
}) {
  const alwaysCards = head.length >= 5;
  return (
    <div className={className}>
      <div className={cn("hidden overflow-hidden rounded-2xl ring-1 ring-foreground/10", !alwaysCards && "sm:block")}>
        <table className="w-full border-collapse text-left text-sm leading-6">
          <thead className="bg-muted/70">
            <tr>
              {head.map((h, i) => (
                <th key={i} scope="col" className="px-3 py-2 align-bottom font-semibold break-keep">
                  <PolicyText text={h} values={values} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, r) => (
              <tr key={r} className="border-t border-foreground/10 align-top">
                {row.map((cell, c) =>
                  c === 0 ? (
                    <th key={c} scope="row" className="px-3 py-2 font-medium break-keep">
                      <PolicyText text={cell} values={values} />
                    </th>
                  ) : (
                    <td key={c} className="px-3 py-2 break-keep">
                      <PolicyText text={cell} values={values} />
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className={cn("flex flex-col gap-2", !alwaysCards && "sm:hidden")}>
        {rows.map((row, r) => (
          <li key={r} className="rounded-2xl bg-muted/50 p-3 text-sm leading-6 ring-1 ring-foreground/5 sm:p-4">
            <p className="text-xs font-medium text-muted-foreground">
              <PolicyText text={head[0] ?? ""} values={values} />
            </p>
            <p className="font-semibold break-keep">
              <PolicyText text={row[0] ?? ""} values={values} />
            </p>
            <dl className={cn("mt-1 grid gap-x-6 gap-y-1.5", alwaysCards && "sm:mt-2 sm:grid-cols-2")}>
              {row.slice(1).map((cell, c) => (
                <div key={c}>
                  <dt className="text-xs font-medium text-muted-foreground">
                    <PolicyText text={head[c + 1] ?? ""} values={values} />
                  </dt>
                  <dd className="break-keep">
                    <PolicyText text={cell} values={values} />
                  </dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** 처리방침 글 덩어리 목록. headingLevel = 작은 제목(subheading)의 수준 */
export function PolicyBlocks({
  blocks,
  values,
  headingLevel = 3,
}: {
  blocks: readonly PolicyBlock[];
  values?: Readonly<Record<string, ReactNode>>;
  headingLevel?: 3 | 4;
}) {
  const Sub = headingLevel === 3 ? "h3" : "h4";
  return (
    <>
      {blocks.map((b, i) => {
        switch (b.type) {
          case "paragraph":
            return (
              <p key={i} className="break-keep">
                <PolicyText text={b.text} values={values} />
              </p>
            );
          case "subheading":
            return (
              <Sub key={i} className="mt-2 text-base font-semibold break-keep">
                <PolicyText text={b.text} values={values} />
              </Sub>
            );
          case "list": {
            const List = b.ordered ? "ol" : "ul";
            return (
              <List
                key={i}
                className={cn("flex flex-col gap-1.5 pl-5 marker:text-primary", b.ordered ? "list-decimal" : "list-disc")}
              >
                {b.items.map((item, j) => (
                  <li key={j} className="pl-1 break-keep">
                    <PolicyText text={item} values={values} />
                  </li>
                ))}
              </List>
            );
          }
          case "table":
            return <PolicyTable key={i} head={b.head} rows={b.rows} values={values} />;
        }
      })}
    </>
  );
}

// ─────────────────────────────────────────────
// 창
// ─────────────────────────────────────────────

type Variant = "new" | "existing" | "ack-first" | "ack-again";

function variantOf(gate: MemberGate | null): Variant | null {
  if (!gate || !gate.ready) return null;
  if (gate.state === "need_code") return gate.origin === "existing" ? "existing" : "new";
  if (gate.state === "need_ack") return gate.firstTime ? "ack-first" : "ack-again";
  return null;
}

/** 창을 띄우지 않는 경로(basePath 제외, trailingSlash 기준) — 처리방침 화면은 창 없이 읽혀야 한다 */
const NO_GATE_PATHS = ["/privacy/"];

/** 레이아웃에 한 번 둔다(ForcePasswordChangeGate 옆). 로그인한 구글 계정에만, 서버가 요구할 때만 창을 띄운다. */
export function PrivacyGate() {
  const { loading, user, gate } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  // 3-1·3-2를 [나중에]로 닫은 것 — 이 탭에서만(저장하지 않음 → 새로 고치면 다시 뜬다)
  const [dismissed, setDismissed] = useState<string | null>(null);
  // 인증·확인에 성공한 계정 — 서버 상태를 다시 읽지 못해도 창을 닫아 둔다
  const [completed, setCompleted] = useState<string | null>(null);
  // 우리가 직접 로그아웃시키는 중인가(아니면 창이 떠 있던 중의 로그아웃 = 세션 만료 → 로그인 화면)
  const leaving = useRef(false);
  const wasOpen = useRef(false);

  const userId = user?.id ?? null;
  const variant = variantOf(gate);
  const path = pathname.endsWith("/") ? pathname : `${pathname}/`;
  const key = userId && variant ? `${userId}:${variant}:${gate?.policyVersion ?? ""}` : null;
  const open =
    !loading &&
    !!key &&
    !NO_GATE_PATHS.includes(path) &&
    dismissed !== key &&
    completed !== userId;

  // 창이 떠 있던 중 세션이 끊기면(우리가 로그아웃시킨 게 아니면) 로그인 화면으로(spec 3.5, AdminGuard와 같은 흐름)
  useEffect(() => {
    if (open) {
      wasOpen.current = true;
      return;
    }
    if (wasOpen.current && !loading && !user && !leaving.current) router.replace("/login/");
    if (!user) {
      wasOpen.current = false;
      leaving.current = false;
    }
  }, [open, loading, user, router]);

  if (!open || !variant || !gate || !key || !userId) return null;

  return (
    <GateDialog
      key={key}
      variant={variant}
      gate={gate}
      onLater={() => setDismissed(key)}
      onCompleted={() => setCompleted(userId)}
      onLeaving={(v) => {
        leaving.current = v;
      }}
    />
  );
}

function GateDialog({
  variant,
  gate,
  onLater,
  onCompleted,
  onLeaving,
}: {
  variant: Variant;
  gate: MemberGate;
  onLater: () => void;
  onCompleted: () => void;
  onLeaving: (leaving: boolean) => void;
}) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const titleId = useId();
  const text =
    variant === "new"
      ? NEW_SIGNUP_WINDOW
      : variant === "existing"
        ? EXISTING_MEMBER_WINDOW
        : variant === "ack-first"
          ? ADMIN_ACK_WINDOW
          : POLICY_CHANGED_WINDOW;

  return (
    <DialogPrimitive.Root
      open
      // 바깥 클릭·Esc로 닫히지 않는다(원문 1절 메모). 닫기는 창 안의 단추로만.
      disablePointerDismissal
      onOpenChange={() => {}}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-background/85 backdrop-blur-md supports-[not(backdrop-filter:blur(0))]:bg-background/97" />
        <DialogPrimitive.Popup
          aria-labelledby={titleId}
          initialFocus={titleRef}
          finalFocus={false}
          className="fixed inset-0 z-50 overflow-y-auto overscroll-contain outline-none"
        >
          <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col justify-center px-4 py-6 sm:px-6 sm:py-10">
            <section className="flex flex-col gap-5 rounded-[2rem] bg-card p-5 text-sm leading-6 text-card-foreground shadow-(--shadow-lg) ring-1 ring-foreground/10 sm:p-8 sm:text-[0.95rem] dark:shadow-none">
              <header className="flex items-start gap-3">
                <span
                  aria-hidden
                  className="mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/12 text-primary"
                >
                  <ShieldCheckIcon className="size-6" />
                </span>
                <DialogPrimitive.Title
                  ref={titleRef}
                  id={titleId}
                  tabIndex={-1}
                  className="font-heading text-2xl leading-snug font-normal break-keep outline-none sm:text-[1.75rem]"
                >
                  {text.title}
                </DialogPrimitive.Title>
              </header>

              <div className="flex flex-col gap-3 text-foreground/90">
                {text.intro.map((p, i) => (
                  <p key={i} className="break-keep">
                    <PolicyText text={p} />
                  </p>
                ))}
                {variant === "ack-again" ? <ChangeLine /> : null}
                {variant === "existing" ? (
                  <p className="rounded-2xl bg-primary/8 px-4 py-3 break-keep ring-1 ring-primary/20">
                    <PolicyText text={EXISTING_MEMBER_WINDOW.indischool} />
                  </p>
                ) : null}
                {variant === "new" ? (
                  <PolicyTable head={NEW_SIGNUP_WINDOW.table.head} rows={NEW_SIGNUP_WINDOW.table.rows} />
                ) : null}
                {"bullets" in text ? (
                  <ul className="flex flex-col gap-1.5 pl-5 marker:text-primary list-disc">
                    {text.bullets.map((b, i) => (
                      <li key={i} className="pl-1 break-keep">
                        <PolicyText text={b} />
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>

              <GateForm
                variant={variant}
                gate={gate}
                onLater={onLater}
                onCompleted={onCompleted}
                onLeaving={onLeaving}
              />
            </section>
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/** 3-2절 "바뀐 점" 줄 — 그 판의 한 줄이 없으면 숨긴다 */
function ChangeLine() {
  const summary = POLICY_CHANGE_SUMMARY[POLICY_VERSION];
  if (!summary) return null;
  return (
    <p className="break-keep">
      <PolicyText text={POLICY_CHANGED_WINDOW.change} values={{ "바뀐 점 한 줄": summary }} />
    </p>
  );
}

function FieldLabel({ htmlFor, field }: { htmlFor: string; field: GateField }) {
  return (
    <label htmlFor={htmlFor} className="text-sm font-semibold">
      {field.label} <span className="font-normal text-muted-foreground">{field.hint}</span>
    </label>
  );
}

function GateForm({
  variant,
  gate,
  onLater,
  onCompleted,
  onLeaving,
}: {
  variant: Variant;
  gate: MemberGate;
  onLater: () => void;
  onCompleted: () => void;
  onLeaving: (leaving: boolean) => void;
}) {
  const router = useRouter();
  const { refreshProfile, refreshGate } = useSession();
  const ids = useId();
  const nickId = `${ids}-nick`;
  const nickErrId = `${ids}-nick-err`;
  const codeId = `${ids}-code`;
  const checkId = `${ids}-check`;
  const hintId = `${ids}-hint`;

  const needsCode = variant === "new" || variant === "existing";
  const needsNickname = variant !== "ack-again";
  const text =
    variant === "new"
      ? NEW_SIGNUP_WINDOW
      : variant === "existing"
        ? EXISTING_MEMBER_WINDOW
        : variant === "ack-first"
          ? ADMIN_ACK_WINDOW
          : POLICY_CHANGED_WINDOW;

  const [nickname, setNickname] = useState("");
  const [nickTouched, setNickTouched] = useState(false);
  const [code, setCode] = useState("");
  const [checked, setChecked] = useState(false);
  // 체크 칸을 한 번이라도 건드렸나 — 별명·코드 칸이 없는 3-2 창에서 체크 안내를 처음부터 보이지 않게(검토 R2 L1)
  const [checkTouched, setCheckTouched] = useState(false);
  const [busy, setBusy] = useState<null | "submit" | "later">(null);
  // 잠겨 있는 계정이면 창을 열 때부터 잠금 문구(4절)
  const [error, setError] = useState<string | null>(() =>
    needsCode && gate.lockedSeconds
      ? plainText(GATE_MESSAGES.locked, { n: Math.max(1, Math.ceil(gate.lockedSeconds / 60)) })
      : null,
  );
  const [confirmOpen, setConfirmOpen] = useState(false);
  const codeRef = useRef<HTMLInputElement>(null);
  // 틀린 코드 뒤 코드 칸으로 초점 — 칸이 다시 켜진(busy 해제) 뒤에 옮긴다
  const [focusCode, setFocusCode] = useState(0);
  useEffect(() => {
    if (focusCode && busy === null) codeRef.current?.focus();
  }, [focusCode, busy]);

  const nickProblem = needsNickname ? validateNickname(nickname) : null;
  const showNickProblem = needsNickname && !!nickProblem && (nickTouched || nickname.trim() !== "");
  const codeReady = !needsCode || isCompleteCode(code);
  const othersReady = !nickProblem && codeReady;
  const canSubmit = checked && othersReady && busy === null;
  // 체크 안내(4절): 다른 칸이 다 찼는데 체크만 안 했을 때. 다른 칸이 없는 창(3-2)은 체크를 풀었을 때만.
  const showCheckHint = !checked && othersReady && (needsNickname || needsCode || checkTouched);

  async function handleResult(result: GateActionResult) {
    if (result.kind === "ok") {
      toast.success(needsCode ? GATE_MESSAGES.welcome : GATE_MESSAGES.acknowledged);
      onCompleted();
      await Promise.all([refreshProfile(), refreshGate()]);
      return;
    }
    if (result.kind === "already") {
      toast.info(result.message);
      onCompleted();
      await Promise.all([refreshProfile(), refreshGate()]);
      return;
    }
    if (result.kind === "refresh") {
      setBusy(null);
      await refreshGate();
      return;
    }
    setError(result.message);
    if (result.clearCode) {
      setCode("");
      setFocusCode((n) => n + 1);
    }
    setBusy(null);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) {
      setNickTouched(true);
      return;
    }
    setBusy("submit");
    setError(null);
    const result = needsCode
      ? await verifyGoogleTeacher(nickname, code)
      : await acknowledgePrivacy(needsNickname ? nickname : null);
    await handleResult(result);
  }

  async function onLogoutLater() {
    setBusy("later");
    onLeaving(true);
    const { cancelled } = await signOut();
    if (cancelled) {
      onLeaving(false);
      setBusy(null);
      return;
    }
    router.replace("/");
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4 border-t border-foreground/10 pt-5">
      {needsNickname ? (
        <div className="flex flex-col gap-2">
          <FieldLabel htmlFor={nickId} field={"nickname" in text ? text.nickname : NEW_SIGNUP_WINDOW.nickname} />
          <input
            id={nickId}
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            onBlur={() => setNickTouched(true)}
            maxLength={40}
            autoComplete="nickname"
            spellCheck={false}
            disabled={busy !== null}
            aria-invalid={showNickProblem}
            aria-describedby={showNickProblem ? nickErrId : undefined}
            className="h-11 w-full max-w-sm rounded-xl border border-input bg-background px-3 text-base outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:bg-input/30"
          />
          {showNickProblem ? (
            <p id={nickErrId} className="text-sm text-destructive" aria-live="polite">
              {nickProblem}
            </p>
          ) : null}
        </div>
      ) : null}

      {needsCode ? (
        <div className="flex flex-col gap-2">
          <FieldLabel htmlFor={codeId} field={NEW_SIGNUP_WINDOW.code} />
          <CodeInput
            id={codeId}
            inputRef={codeRef}
            value={code}
            onChange={(v) => {
              setCode(v);
              if (error) setError(null);
            }}
            disabled={busy !== null}
          />
        </div>
      ) : null}

      <div className="flex flex-col gap-1">
        <label
          htmlFor={checkId}
          className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl py-2 font-semibold break-keep has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary"
        >
          <input
            id={checkId}
            type="checkbox"
            checked={checked}
            onChange={(e) => {
              setChecked(e.target.checked);
              setCheckTouched(true);
            }}
            disabled={busy !== null}
            className="mt-0.5 size-5 shrink-0 cursor-pointer accent-primary outline-none"
          />
          <span>{text.check}</span>
        </label>
        <a
          href={withBasePath("/privacy/")}
          target="_blank"
          rel="noopener"
          className={cn(linkClass, "ml-8 inline-flex min-h-11 w-fit items-center gap-1.5 py-2")}
        >
          {text.policyLink}
          <ExternalLinkIcon className="size-4" aria-hidden />
        </a>
      </div>

      {error ? (
        <p role="alert" className="rounded-xl bg-destructive/8 px-3 py-2 text-sm font-medium text-destructive break-keep">
          {error}
        </p>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <button
          type="submit"
          disabled={!canSubmit}
          aria-describedby={showCheckHint ? hintId : undefined}
          className={cn(primaryPillClass, "h-12 px-6 text-base")}
        >
          {busy === "submit" ? <Loader2Icon className="animate-spin motion-reduce:animate-none" aria-hidden /> : null}
          {text.submit}
        </button>
        {variant === "existing" ? (
          <button
            type="button"
            onClick={onLogoutLater}
            disabled={busy !== null}
            className={cn(outlinePillClass, "h-12 px-5")}
          >
            {busy === "later" ? <Loader2Icon className="animate-spin motion-reduce:animate-none" aria-hidden /> : null}
            {EXISTING_MEMBER_WINDOW.later}
          </button>
        ) : null}
        {variant === "ack-first" || variant === "ack-again" ? (
          <button type="button" onClick={onLater} disabled={busy !== null} className={cn(outlinePillClass, "h-12 px-5")}>
            {ADMIN_ACK_WINDOW.later}
          </button>
        ) : null}
        {needsCode ? (
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            disabled={busy !== null}
            className={cn(outlinePillClass, "h-12 px-5 text-destructive")}
          >
            {variant === "existing" ? EXISTING_MEMBER_WINDOW.cancel : NEW_SIGNUP_WINDOW.cancel}
          </button>
        ) : null}
      </div>
      {showCheckHint ? (
        <p id={hintId} className="text-sm text-muted-foreground break-keep">
          {GATE_MESSAGES.unchecked}
        </p>
      ) : null}

      {needsCode ? (
        <CancelConfirm
          kind={variant === "existing" ? "existing" : "new"}
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          onLeaving={onLeaving}
        />
      ) : null}
    </form>
  );
}

/**
 * 숫자 6칸 코드 칸. 실제 입력은 칸 위에 겹친 투명한 입력 하나(붙여 넣기·휴대폰 숫자 자판·자동 채우기·화면 낭독기에 좋다),
 * 6칸은 보이기만 한다. 숫자가 아닌 글자는 버린다.
 */
function CodeInput({
  id,
  inputRef,
  value,
  onChange,
  disabled,
}: {
  id: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const active = Math.min(value.length, CODE_LENGTH - 1);
  return (
    <div className="relative w-fit">
      <div className="flex gap-1.5 sm:gap-2" aria-hidden>
        {Array.from({ length: CODE_LENGTH }, (_, i) => (
          <span
            key={i}
            className={cn(
              "flex size-11 items-center justify-center rounded-xl border-2 bg-background text-xl font-semibold tabular-nums transition-colors motion-reduce:transition-none sm:size-12 dark:bg-input/30",
              focused && i === active ? "border-primary ring-3 ring-primary/30" : "border-input",
              disabled && "opacity-60",
            )}
          >
            {value[i] ?? ""}
          </span>
        ))}
      </div>
      <input
        ref={inputRef}
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, CODE_LENGTH))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
        spellCheck={false}
        autoCorrect="off"
        disabled={disabled}
        className="absolute inset-0 size-full cursor-text rounded-xl bg-transparent text-transparent caret-transparent opacity-0 outline-none selection:bg-transparent"
      />
    </div>
  );
}

/** 4-1절 [가입하지 않기] 확인 창 → member-self-delete(cancel) → 이 기기 로그아웃 → 홈 */
function CancelConfirm({
  kind,
  open,
  onOpenChange,
  onLeaving,
}: {
  kind: "new" | "existing";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLeaving: (leaving: boolean) => void;
}) {
  const router = useRouter();
  const text = CANCEL_CONFIRM[kind];
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onConfirm() {
    setBusy(true);
    setError(null);
    try {
      const result = await selfDeleteMember("cancel");
      if (!result.ok) {
        setError(GATE_MESSAGES.network);
        setBusy(false);
        return;
      }
      onLeaving(true);
      await localSignOut();
      toast.success(CANCEL_CONFIRM.done);
      router.replace("/");
    } catch (e) {
      setError(e instanceof PrivacyActionError ? e.message : GATE_MESSAGES.network);
      setBusy(false);
    }
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (busy) return;
        onOpenChange(next);
        if (!next) setError(null);
      }}
    >
      {/* 가입 창 안에 겹쳐 여는 확인 창 — 막을 그려 뒤 창의 단추·체크가 눌리지 않게(검토 R2 M1) */}
      <AlertDialogContent forceOverlay className="gap-5 rounded-3xl p-5 sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-heading text-xl font-normal">{text.title}</AlertDialogTitle>
          <AlertDialogDescription className="text-sm leading-6 text-foreground/85 break-keep">
            <PolicyText text={text.body} />
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error ? (
          <p role="alert" className="text-sm font-medium text-destructive break-keep">
            {error}
          </p>
        ) : null}
        <AlertDialogFooter className="-mx-5 -mb-5 rounded-b-3xl p-4">
          <Button
            type="button"
            variant="outline"
            className="h-11 rounded-full px-5"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            {text.back}
          </Button>
          <Button
            type="button"
            variant="destructive"
            className={cn("h-11 rounded-full px-5", dangerSolidClass)}
            disabled={busy}
            onClick={onConfirm}
          >
            {busy ? <Loader2Icon className="animate-spin motion-reduce:animate-none" aria-hidden /> : null}
            {text.confirm}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
