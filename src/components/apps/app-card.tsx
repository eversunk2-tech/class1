"use client";

import { useState } from "react";
import { AppWindowIcon, ExternalLinkIcon } from "lucide-react";
import { TagList } from "@/components/tag-chip";
import { buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { appHref, appThumbnailSrc, type WebApp } from "@/data/apps";
import { cn } from "@/lib/utils";

/** 웹앱 카드. 클릭하면 모달에서 iframe으로 미리보고, "새 탭으로 열기"로 전체 화면 실행. */
export function AppCard({ app }: { app: WebApp }) {
  const [open, setOpen] = useState(false);
  const href = appHref(app);
  const thumb = appThumbnailSrc(app);

  return (
    <>
      <article className="group relative flex w-full flex-col overflow-hidden rounded-xl ring-1 ring-foreground/10 transition-colors hover:bg-muted/40">
        {thumb ? (
          // 정적 export 환경의 public 이미지이므로 img 사용(basePath 수동 반영)
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb} alt="" loading="lazy" className="aspect-[16/9] w-full bg-muted object-cover" />
        ) : (
          <div className="flex aspect-[16/9] w-full items-center justify-center bg-muted text-muted-foreground" aria-hidden>
            <AppWindowIcon className="size-8" />
          </div>
        )}
        <div className="flex flex-1 flex-col gap-2 p-4">
          <h3 className="font-semibold">
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="text-left after:absolute after:inset-0 focus-visible:underline focus-visible:outline-none"
            >
              {app.title}
            </button>
          </h3>
          <p className="line-clamp-2 text-sm text-muted-foreground">{app.description}</p>
          {app.tags?.length ? (
            <div className="relative z-10 mt-auto pt-1">
              <TagList tags={app.tags} linked={false} />
            </div>
          ) : null}
        </div>
      </article>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex h-[85vh] flex-col gap-3 sm:max-w-5xl">
          <DialogHeader className="pr-8">
            <DialogTitle>{app.title}</DialogTitle>
            <DialogDescription className="line-clamp-1">{app.description}</DialogDescription>
          </DialogHeader>
          {open ? (
            <iframe
              src={href}
              title={`${app.title} 미리보기`}
              loading="lazy"
              className="min-h-0 w-full flex-1 rounded-lg border bg-white"
            />
          ) : null}
          <div className="flex justify-end">
            <a href={href} target="_blank" rel="noopener noreferrer" className={cn(buttonVariants({ variant: "outline" }), "h-9 px-4")}>
              <ExternalLinkIcon />새 탭으로 열기
            </a>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
