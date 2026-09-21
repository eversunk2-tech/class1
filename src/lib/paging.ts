/**
 * PostgREST max-rows(Supabase 기본 1000행) 제한을 넘는 목록을 .range()로 나눠 전부 가져온다(review #4).
 * `.limit(5000)`처럼 큰 limit을 줘도 서버가 1000행에서 자르므로, 전체가 필요한 곳은 이 함수를 쓴다.
 *
 * page(from, to)는 `.range(from, to)`를 붙인 쿼리를 돌려준다. 정렬 순서가 고정돼야 페이지가 겹치거나 빠지지 않으므로
 * 호출하는 쪽에서 유일한 열(id 등)까지 포함해 order를 지정한다.
 * select에 `{ count: "exact" }`를 주면 전체 개수로 끝을 판단하고(서버 max-rows가 pageSize보다 작아도 안전),
 * 없으면 pageSize보다 적게 오면 끝으로 본다.
 */
export const PAGE_SIZE = 1000;
const MAX_PAGES = 100;

type PageResult = { data: unknown; error: unknown; count?: number | null };

export async function fetchAllPages<T>(
  page: (from: number, to: number) => PromiseLike<PageResult>,
  pageSize = PAGE_SIZE,
): Promise<T[]> {
  const all: T[] = [];
  let total: number | null = null;
  for (let i = 0; i < MAX_PAGES; i++) {
    const { data, error, count } = await page(all.length, all.length + pageSize - 1);
    if (error) throw error;
    const rows = (Array.isArray(data) ? data : []) as T[];
    if (typeof count === "number") total = count;
    all.push(...rows);
    if (!rows.length) break;
    if (total != null ? all.length >= total : rows.length < pageSize) break;
  }
  return all;
}

/** 배열을 n개씩 나눈다(`in.(...)` 필터의 URL 길이 제한 회피용, review #7). */
export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
