import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function tagSearchHref(tag: string) {
  return `/search/?tag=${encodeURIComponent(tag)}`;
}

/**
 * 태그 칩. 기본은 /search/?tag= 링크, linked={false}면 표시만 한다.
 * 모양: 옅은 보라 알약(디자인 개편 2단계). 보라 글자 대비 라이트 5.2:1 · 다크 7:1 이상.
 */
const TAG_PILL =
  "h-auto rounded-full border-transparent bg-primary/8 px-2.5 py-0.5 text-xs font-medium text-primary ring-1 ring-primary/15 dark:bg-primary/15";

export function TagChip({ tag, linked = true }: { tag: string; linked?: boolean }) {
  if (!linked) {
    return (
      <Badge variant="secondary" className={TAG_PILL}>
        #{tag}
      </Badge>
    );
  }
  return (
    <Badge
      variant="secondary"
      className={cn(TAG_PILL, "transition-colors hover:bg-primary/15 dark:hover:bg-primary/25")}
      render={<Link href={tagSearchHref(tag)} />}
    >
      #{tag}
    </Badge>
  );
}

export function TagList({
  tags,
  linked = true,
  className,
}: {
  tags: string[] | null | undefined;
  linked?: boolean;
  className?: string;
}) {
  if (!tags?.length) return null;
  return (
    <ul className={cn("flex flex-wrap gap-1.5", className)} aria-label="태그">
      {tags.map((t) => (
        <li key={t}>
          <TagChip tag={t} linked={linked} />
        </li>
      ))}
    </ul>
  );
}
