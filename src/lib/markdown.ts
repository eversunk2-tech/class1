// 마크다운 렌더링 유틸. marked / DOMPurify / highlight.js는 CDN에서 로드한다(번들 미포함).
// 로드는 MarkdownViewer의 next/script가 담당하고, 여기서는 전역 객체를 사용해 렌더링만 한다.

// 정확한 버전으로 고정하고 SRI(integrity) 해시를 지정한다. CDN 파일이 바뀌면 브라우저가 실행을 거부한다.
// 버전을 올릴 때는 파일을 내려받아 다시 계산한다:
//   curl -s <src> | openssl dgst -sha384 -binary | openssl base64 -A
export const MARKDOWN_CDN = {
  marked: {
    src: "https://cdn.jsdelivr.net/npm/marked@15.0.12/marked.min.js",
    integrity: "sha384-948ahk4ZmxYVYOc+rxN1H2gM1EJ2Duhp7uHtZ4WSLkV4Vtx5MUqnV+l7u9B+jFv+",
  },
  dompurify: {
    src: "https://cdn.jsdelivr.net/npm/dompurify@3.4.15/dist/purify.min.js",
    integrity: "sha384-uUMu9JDY09vBzRf9SPcK2VgUj+W/70J6Soc+Dded5P474ElQ63iv9j5N3DE7Kp3N",
  },
  highlight: {
    src: "https://cdn.jsdelivr.net/npm/@highlightjs/cdn-assets@11.12.0/highlight.min.js",
    integrity: "sha384-wjfDDhOPPdjtva8vWBhWeVprSpmxisEu5aYT3q1JyACqXpdKpo3PWZTMVq24MBix",
  },
} as const;

/**
 * DOMPurify 설정. 기본 HTML 프로필에서 페이지 전체에 영향을 주는 <style>,
 * 외부로 데이터를 보낼 수 있는 폼 요소, 인라인 style 속성을 추가로 막는다.
 */
const SANITIZE_CONFIG = {
  USE_PROFILES: { html: true },
  FORBID_TAGS: ["style", "form", "input", "button", "textarea", "select", "option"],
  FORBID_ATTR: ["style"],
};

type MarkedGlobal = {
  parse: (src: string, options?: { async?: false; gfm?: boolean; breaks?: boolean }) => string;
};
type DOMPurifyGlobal = {
  sanitize: (dirty: string, config?: Record<string, unknown>) => string;
};
type HljsGlobal = {
  highlightElement: (el: HTMLElement) => void;
};

declare global {
  interface Window {
    marked?: MarkedGlobal;
    DOMPurify?: DOMPurifyGlobal;
    hljs?: HljsGlobal;
  }
}

/** 필수 라이브러리(marked + DOMPurify)가 준비되었는지 */
export function isMarkdownReady(): boolean {
  return typeof window !== "undefined" && !!window.marked && !!window.DOMPurify;
}

/**
 * 마크다운 → 정화된 HTML. marked/DOMPurify가 없으면 null(호출 측이 원문 텍스트로 폴백).
 * highlight.js가 로드되어 있으면 코드 블록에 하이라이트를 적용한다.
 * 반환값은 항상 DOMPurify.sanitize를 거친 HTML이다.
 */
export function renderMarkdown(md: string): string | null {
  if (!isMarkdownReady()) return null;
  const { marked, DOMPurify, hljs } = window;
  const raw = marked!.parse(md, { async: false, gfm: true, breaks: false });

  let html = raw;
  if (hljs) {
    const tpl = document.createElement("template");
    // sanitize 이전 HTML을 비활성 template에만 넣는다(스크립트 실행·리소스 로드 없음).
    tpl.innerHTML = raw;
    tpl.content.querySelectorAll<HTMLElement>("pre code").forEach((el) => {
      try {
        hljs.highlightElement(el);
      } catch {
        // 하이라이트 실패는 무시하고 원래 코드 블록을 유지한다.
      }
    });
    html = tpl.innerHTML;
  }

  return DOMPurify!.sanitize(html, SANITIZE_CONFIG);
}
