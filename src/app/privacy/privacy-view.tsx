"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Loader2Icon, RotateCwIcon } from "lucide-react";
import { PolicyBlocks, PolicyText } from "@/components/privacy-gate";
import { Skeleton } from "@/components/ui/skeleton";
import { EASY_EXPLANATION, PRIVACY_POLICY } from "@/data/privacy-policy";
import { fetchPrivacySettings, formatEffectiveDate, PRIVACY_EXTRA_TEXT, type PrivacySettings } from "@/lib/privacy";

/*
 * /privacy/ — 쉬운 설명(#easy)이 맨 위, 그 아래 처리방침 전체(privacy-policy.md 5절 메모: "쉬운 설명이 위").
 * site_settings에서 시행일·문의 이메일·판 번호를 받아 `{자리}`를 채운다.
 * - 시행 전(policy_effective_at 없음, 열이 아직 없음 포함) → "개인정보 처리방침을 준비하고 있어요"만.
 * - 문의 이메일이 없으면 그 자리에 "문의 이메일을 불러오지 못했어요." + [다시 불러오기](9절 규칙).
 * - 설정을 아예 읽지 못하면(네트워크) "개인정보 처리방침을 불러오지 못했어요." + [다시 불러오기].
 */

type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; settings: PrivacySettings };

export function PrivacyView() {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [reloadKey, setReloadKey] = useState(0);
  const [reloading, setReloading] = useState(false);

  useEffect(() => {
    let active = true;
    fetchPrivacySettings().then(
      (settings) => {
        if (!active) return;
        setState({ status: "ready", settings });
        setReloading(false);
      },
      () => {
        if (!active) return;
        setState({ status: "error" });
        setReloading(false);
      },
    );
    return () => {
      active = false;
    };
  }, [reloadKey]);

  const reload = () => {
    setReloading(true);
    setReloadKey((n) => n + 1);
  };

  const effective = state.status === "ready" && state.settings.effectiveAt !== null;

  // 주소에 #easy가 있으면(로그인 화면·바닥 링크) 글이 나타난 뒤 그 절로 옮긴다 — 글을 받은 뒤에 그려지므로 브라우저가 스스로 못 옮긴다.
  useEffect(() => {
    if (!effective || window.location.hash !== "#easy") return;
    const el = document.getElementById("easy");
    if (!el) return;
    el.scrollIntoView({ block: "start" });
    el.focus({ preventScroll: true });
  }, [effective]);

  if (state.status === "loading") {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <Skeleton className="h-10 w-3/4 rounded-xl" />
        <Skeleton className="h-48 w-full rounded-3xl" />
        <Skeleton className="h-24 w-full rounded-3xl" />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div role="alert" className="flex flex-col items-center gap-3 rounded-3xl border border-destructive/25 bg-destructive/5 px-6 py-10 text-center">
        <p className="text-sm">{PRIVACY_EXTRA_TEXT.policyLoadFailed}</p>
        <ReloadButton onClick={reload} busy={reloading} />
      </div>
    );
  }

  const { settings } = state;
  const effectiveAt = settings.effectiveAt;
  if (!effectiveAt) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-3xl border-2 border-dashed border-primary/15 bg-card/60 px-6 py-14 text-center dark:bg-card/40">
        <h1 className="font-heading text-2xl leading-snug font-normal break-keep sm:text-3xl">{PRIVACY_EXTRA_TEXT.preparing}</h1>
      </div>
    );
  }

  const email: ReactNode = settings.contactEmail ? (
    <a
      href={`mailto:${settings.contactEmail}`}
      className="font-medium text-primary underline underline-offset-4 [overflow-wrap:anywhere] hover:text-primary/80"
    >
      {settings.contactEmail}
    </a>
  ) : (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 align-middle">
      <span className="text-destructive">{PRIVACY_EXTRA_TEXT.emailFailed}</span>
      <ReloadButton onClick={reload} busy={reloading} />
    </span>
  );
  const values: Record<string, ReactNode> = {
    "문의 이메일": email,
    시행일: formatEffectiveDate(effectiveAt),
    "판 번호": String(settings.version ?? ""),
  };

  return (
    <article className="flex flex-col gap-8 pb-6">
      <h1 className="font-heading text-3xl leading-tight font-normal break-keep sm:text-4xl">{PRIVACY_POLICY.title}</h1>

      <section
        id="easy"
        tabIndex={-1}
        aria-labelledby="easy-title"
        className="scroll-mt-24 rounded-[2rem] bg-primary/6 p-5 text-base leading-7 ring-1 ring-primary/15 outline-none sm:p-7 dark:bg-primary/10"
      >
        <h2 id="easy-title" className="font-heading text-2xl leading-snug font-normal break-keep">
          {EASY_EXPLANATION.title}
        </h2>
        <div className="mt-4 flex flex-col gap-3">
          <PolicyBlocks blocks={EASY_EXPLANATION.blocks} values={values} />
        </div>
      </section>

      <div className="flex flex-col gap-8 text-sm leading-7 sm:text-[0.95rem]">
        <p className="break-keep">
          <PolicyText text={PRIVACY_POLICY.intro} values={values} />
        </p>
        {PRIVACY_POLICY.articles.map((article, i) => (
          <section key={i} aria-labelledby={`article-${i + 1}`} className="flex flex-col gap-3">
            <h2 id={`article-${i + 1}`} className="font-heading text-xl leading-snug font-normal break-keep">
              {article.title}
            </h2>
            <PolicyBlocks blocks={article.blocks} values={values} />
          </section>
        ))}
      </div>
    </article>
  );
}

function ReloadButton({ onClick, busy }: { onClick: () => void; busy: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-card px-4 text-sm font-medium ring-1 ring-foreground/15 outline-none hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60"
    >
      {busy ? (
        <Loader2Icon className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
      ) : (
        <RotateCwIcon className="size-4" aria-hidden />
      )}
      {PRIVACY_EXTRA_TEXT.reload}
    </button>
  );
}
