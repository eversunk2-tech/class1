/** posts.slug 제약(마이그레이션의 check)과 같은 규칙 */
export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function isValidSlug(slug: string): boolean {
  return SLUG_PATTERN.test(slug);
}

/**
 * 제목 → slug 후보. 영문/숫자만 남기고 나머지는 하이픈으로 바꾼다.
 * 한글 제목처럼 남는 글자가 없으면 빈 문자열을 반환한다(호출하는 쪽에서 fallbackSlug 사용).
 */
export function slugifyTitle(title: string): string {
  return title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}

/** 날짜 기반 slug(post-20260921-ab12). 호출할 때마다 달라지므로 한 번 만들어 보관해 쓴다. */
export function fallbackSlug(date = new Date()): string {
  const ymd = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
  const rand = Math.random().toString(36).slice(2, 6).padEnd(4, "0");
  return `post-${ymd}-${rand}`;
}

/**
 * "a, #b ,a" → ["a", "b"] (앞의 #은 제거, 공백 정리, 중복 제거).
 * PostgreSQL 배열 리터럴에서 특수 의미를 갖는 " \ { } 는 제거한다(쉼표는 구분자라 남지 않음).
 */
export function parseTags(input: string): string[] {
  const seen = new Set<string>();
  for (const raw of input.split(",")) {
    const t = raw.replace(/["\\{}]/g, "").trim().replace(/^#+/, "").replace(/\s+/g, " ").trim();
    if (t && !seen.has(t)) seen.add(t);
  }
  return [...seen];
}

/** http/https URL이면 true. 빈 문자열은 호출하는 쪽에서 따로 처리한다. */
export function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}
