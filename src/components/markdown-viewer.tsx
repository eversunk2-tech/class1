"use client";

import { useEffect, useMemo, useState } from "react";
import Script from "next/script";
import { Skeleton } from "@/components/ui/skeleton";
import { MARKDOWN_CDN, isMarkdownReady, renderMarkdown } from "@/lib/markdown";
import { cn } from "@/lib/utils";

type LibState = "loading" | "ready" | "failed";

/** 이 시간 안에 필수 라이브러리가 준비되지 않으면 원문으로 폴백한다. */
const LOAD_TIMEOUT_MS = 10_000;

/**
 * 마크다운 본문 렌더러. marked·DOMPurify·highlight.js를 CDN에서 로드하고,
 * 로드 실패 시 원문 텍스트를 그대로 보여준다. 에디터 미리보기에서도 재사용 가능.
 */
export function MarkdownViewer({ content, className }: { content: string; className?: string }) {
  const [markedOk, setMarkedOk] = useState(false);
  const [purifyOk, setPurifyOk] = useState(false);
  // highlight.js는 선택 사항: 로드 완료/실패 모두 "결정됨"으로 본다.
  const [hljsSettled, setHljsSettled] = useState(false);
  const [failed, setFailed] = useState(false);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setTimedOut(true), LOAD_TIMEOUT_MS);
    return () => window.clearTimeout(t);
  }, []);

  const required = markedOk && purifyOk;
  let state: LibState = "loading";
  if (failed) state = "failed";
  else if (required && (hljsSettled || timedOut)) state = "ready";
  else if (timedOut) state = required ? "ready" : "failed";

  const html = useMemo(
    () => (state === "ready" && isMarkdownReady() ? renderMarkdown(content) : null),
    [state, content],
  );

  return (
    <>
      <Script
        src={MARKDOWN_CDN.marked.src}
        integrity={MARKDOWN_CDN.marked.integrity}
        crossOrigin="anonymous"
        strategy="afterInteractive"
        onReady={() => setMarkedOk(true)}
        onError={() => setFailed(true)}
      />
      <Script
        src={MARKDOWN_CDN.dompurify.src}
        integrity={MARKDOWN_CDN.dompurify.integrity}
        crossOrigin="anonymous"
        strategy="afterInteractive"
        onReady={() => setPurifyOk(true)}
        onError={() => setFailed(true)}
      />
      <Script
        src={MARKDOWN_CDN.highlight.src}
        integrity={MARKDOWN_CDN.highlight.integrity}
        crossOrigin="anonymous"
        strategy="afterInteractive"
        onReady={() => setHljsSettled(true)}
        onError={() => setHljsSettled(true)}
      />

      {html != null ? (
        <div
          className={cn("markdown-body", className)}
          // renderMarkdown은 항상 DOMPurify로 정화된 HTML만 반환한다.
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : state === "loading" ? (
        <div className={cn("flex flex-col gap-3", className)} aria-busy="true" aria-label="본문을 불러오는 중">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-11/12" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      ) : (
        <div className={className}>
          <p className="mb-3 text-xs text-muted-foreground">
            서식 표시 도구를 불러오지 못해 원문을 표시합니다.
          </p>
          <pre className="font-sans text-[0.95rem] leading-7 break-words whitespace-pre-wrap">{content}</pre>
        </div>
      )}
    </>
  );
}
