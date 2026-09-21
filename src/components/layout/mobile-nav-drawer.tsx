"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { MenuIcon, XIcon } from "lucide-react";
import { NavMenuList } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogOverlay, DialogPortal, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useNavDrawer } from "@/hooks/use-sidebar";

/**
 * 모바일(md 미만) 메뉴 드로어 + 햄버거 버튼.
 * ui/dialog.tsx(base-ui Dialog)를 재사용해 포커스 트랩 · Esc · 바깥 클릭 닫힘 · 스크롤 잠금을 그대로 얻고,
 * 가운데 모달용 DialogContent 대신 Popup을 왼쪽 전체 높이 패널로 직접 스타일링한다.
 * 닫히면 base-ui가 포커스를 햄버거 버튼(Trigger)으로 돌려준다.
 */
export function MobileNavDrawer({ siteName }: { siteName: string }) {
  const { open, setOpen, close } = useNavDrawer();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button variant="ghost" size="icon" className="md:hidden" aria-label="메뉴 열기" title="메뉴" />}
      >
        <MenuIcon />
      </DialogTrigger>
      <DialogPortal>
        <DialogOverlay className="bg-black/30 duration-200 md:hidden" />
        <DialogPrimitive.Popup
          data-slot="nav-drawer"
          className="nav-drawer fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col gap-4 overflow-y-auto rounded-r-3xl bg-sidebar p-4 text-sidebar-foreground shadow-xl ring-1 ring-foreground/10 outline-none md:hidden dark:shadow-none"
        >
          <div className="flex items-center justify-between gap-2">
            <DialogTitle className="text-lg font-normal">{siteName}</DialogTitle>
            <DialogClose render={<Button variant="ghost" size="icon" aria-label="메뉴 닫기" title="닫기" />}>
              <XIcon />
            </DialogClose>
          </div>
          <nav aria-label="주요 메뉴">
            <NavMenuList onNavigate={close} />
          </nav>
        </DialogPrimitive.Popup>
      </DialogPortal>
    </Dialog>
  );
}
