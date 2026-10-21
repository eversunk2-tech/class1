"use client";

import Link from "next/link";
import { PRIVACY_EXTRA_TEXT, usePolicyEffective } from "@/lib/privacy";

/**
 * 본문 컬럼(사이드바를 뺀 영역) 전체 폭에 맞춰 렌더링된다.
 * 개인정보 처리방침·쉬운 설명 링크는 처리방침이 시행된 뒤에만(site_settings.policy_effective_at — docs/privacy/spec.md 6절).
 */
export function SiteFooter() {
  const effective = usePolicyEffective();
  return (
    <footer className="border-t">
      <div className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-4 py-6 text-xs text-muted-foreground sm:px-6 lg:px-8">
        {/* 연도는 빌드 때 정해진 값을 그대로 둔다(정적 내보내기 — 해가 바뀐 직후 하이드레이션 경고를 막는다) */}
        <span suppressHydrationWarning>© {new Date().getFullYear()} PSC. All rights reserved.</span>
        {effective ? (
          <nav aria-label={PRIVACY_EXTRA_TEXT.policyLinkLabel} className="flex flex-wrap items-center gap-x-1">
            <Link
              href="/privacy/"
              className="inline-flex min-h-11 items-center px-1 font-semibold text-foreground/80 underline-offset-4 hover:text-foreground hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-primary"
            >
              {PRIVACY_EXTRA_TEXT.policyLinkLabel}
            </Link>
            <span aria-hidden>·</span>
            <Link
              href="/privacy/#easy"
              className="inline-flex min-h-11 items-center px-1 underline-offset-4 hover:text-foreground hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-primary"
            >
              {PRIVACY_EXTRA_TEXT.easyLinkLabel}
            </Link>
          </nav>
        ) : null}
      </div>
    </footer>
  );
}
