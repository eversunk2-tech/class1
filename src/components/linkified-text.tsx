import type { ReactNode } from "react";

/**
 * 글자 속 인터넷 주소(http:// · https://)만 누를 수 있는 링크로 바꿔 보여 준다(2026-09-26 사용자 요청 — 선생님 글 본문).
 * 나머지는 React 텍스트 그대로라 HTML·마크다운으로 해석되지 않는다(`<script>`도 글자로만 보인다).
 * - 링크는 http·https 주소만(`javascript:` 등 다른 형식은 글자로 둔다), 새 창에서 연다(rel="noopener noreferrer").
 * - 주소 끝에 붙은 문장 부호(. , ! ? 등)와 짝 없는 닫는 괄호는 주소에서 뺀다 — "https://…/." 처럼 써도 링크가 맞게 걸린다.
 * - 주소 바로 뒤에 붙여 쓴 한글("https://…에서")은 주소가 아닌 것으로 본다(주소창에서 복사한 주소에는 한글이 %로 바뀌어 들어간다).
 */
const URL_RE = /https?:\/\/[^\s<>"'`ㄱ-ㆎ가-힣]+/gi;
const TRAILING_PUNCT = /[.,;:!?'"’”\]}>…。、]+$/;

function trimUrl(raw: string): string {
  let url = raw;
  for (;;) {
    const before = url;
    url = url.replace(TRAILING_PUNCT, "");
    // 닫는 괄호는 주소 안의 여는 괄호보다 많을 때만 뺀다(위키 주소 "…_(항성)"은 그대로 둔다)
    while (url.endsWith(")") && (url.match(/\(/g)?.length ?? 0) < (url.match(/\)/g)?.length ?? 0)) url = url.slice(0, -1);
    if (url === before) return url;
  }
}

function safeHref(text: string): string | null {
  try {
    const u = new URL(text);
    return (u.protocol === "http:" || u.protocol === "https:") && u.hostname ? u.href : null;
  } catch {
    return null;
  }
}

/** 글을 [글자, 링크, 글자, …] 조각으로 나눈다(시험·다른 화면에서도 쓰도록 내보냄). */
export function splitLinks(text: string): Array<{ text: string; href?: string }> {
  const parts: Array<{ text: string; href?: string }> = [];
  let last = 0;
  for (const m of text.matchAll(URL_RE)) {
    const start = m.index ?? 0;
    const url = trimUrl(m[0]);
    const href = safeHref(url);
    if (!href) continue;
    if (start > last) parts.push({ text: text.slice(last, start) });
    parts.push({ text: url, href });
    last = start + url.length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
}

export function LinkifiedText({ text }: { text: string }): ReactNode {
  return splitLinks(text).map((part, i) =>
    part.href ? (
      <a
        key={i}
        href={part.href}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className="font-medium text-primary underline decoration-primary/40 underline-offset-2 [overflow-wrap:anywhere] hover:decoration-primary focus-visible:rounded-sm focus-visible:ring-3 focus-visible:ring-ring/60 focus-visible:outline-none"
      >
        {part.text}
        {/* select-none: 본문을 복사할 때 이 안내가 주소에 섞이지 않게(Review links L1) */}
        <span className="sr-only select-none"> (새 창에서 열려요)</span>
      </a>
    ) : (
      part.text
    ),
  );
}
