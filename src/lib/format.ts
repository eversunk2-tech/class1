const dateFormatter = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** 클라이언트에서 가져온 데이터에만 사용한다(서버 프리렌더 결과와 불일치 방지). */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  return dateFormatter.format(new Date(iso));
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  return dateTimeFormatter.format(new Date(iso));
}

export function formatCount(n: number | null | undefined): string {
  return new Intl.NumberFormat("ko-KR").format(n ?? 0);
}
