// next.config.ts의 basePath(/class1)를 next/link 밖의 순수 경로(img src, iframe src,
// OAuth redirectTo 등)에 붙일 때 사용한다. next/link·router는 자동으로 붙이므로 쓰지 않는다.
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function withBasePath(path: string): string {
  if (/^[a-z][a-z0-9+.-]*:/i.test(path) || path.startsWith("//")) return path;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${BASE_PATH}${normalized}`;
}
