import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function tagSearchHref(tag: string) {
  return `/search/?tag=${encodeURIComponent(tag)}`;
}

/** 태그 칩. 기본은 /search/?tag= 링크, linked={false}면 표시만 한다. */
export function TagChip({ tag, linked = true }: { tag: string; linked?: boolean }) {
  if (!linked) {
    return (
      <Badge variant="secondary" className="font-normal">
        #{tag}
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="font-normal" render={<Link href={tagSearchHref(tag)} />}>
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
