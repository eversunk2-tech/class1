import Link from "next/link";
import { SearchIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/user-menu";

export const SITE_NAME = "Class1 블로그";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-14 w-full max-w-3xl items-center gap-2 px-4">
        <Link href="/" className="mr-auto text-base font-semibold tracking-tight">
          {SITE_NAME}
        </Link>
        <nav aria-label="주요 메뉴" className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label="검색"
            title="검색"
            render={<Link href="/search/" />}
            nativeButton={false}
          >
            <SearchIcon />
          </Button>
          <ThemeToggle />
          <UserMenu />
        </nav>
      </div>
    </header>
  );
}
