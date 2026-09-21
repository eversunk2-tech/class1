import { withBasePath } from "@/lib/base-path";

/**
 * 메인 화면 웹앱 카드 데이터 (spec §7).
 * 앱 파일은 public/apps/{id}/index.html 에 두고, 아래 배열에 항목을 추가하면 카드가 나타난다.
 *
 * 예)
 * {
 *   id: "todo",
 *   title: "할 일 목록",
 *   description: "localStorage에 저장되는 간단한 할 일 앱",
 *   thumbnail: "thumbnail.png", // public/apps/todo/thumbnail.png (선택)
 *   tags: ["javascript"],
 * }
 */
export type WebApp = {
  /** public/apps/{id}/ 디렉터리명과 같아야 한다. */
  id: string;
  title: string;
  description: string;
  /** public/apps/{id}/ 기준 상대 경로 또는 http(s) URL (선택) */
  thumbnail?: string;
  tags?: string[];
};

export const webApps: WebApp[] = [];

/** 앱 실행 경로. next/link 밖(iframe, a target=_blank)에서 쓰므로 basePath를 직접 붙인다. */
export function appHref(app: WebApp): string {
  return withBasePath(`/apps/${encodeURIComponent(app.id)}/`);
}

export function appThumbnailSrc(app: WebApp): string | null {
  if (!app.thumbnail) return null;
  if (/^https?:\/\//i.test(app.thumbnail)) return app.thumbnail;
  return withBasePath(`/apps/${encodeURIComponent(app.id)}/${app.thumbnail.replace(/^\/+/, "")}`);
}
