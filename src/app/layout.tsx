import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SiteFooter } from "@/components/site-footer";
import { SITE_NAME, SiteHeader } from "@/components/site-header";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SessionProvider } from "@/hooks/use-session";
import { THEME_INIT_SCRIPT } from "@/hooks/use-theme";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: SITE_NAME, template: `%s | ${SITE_NAME}` },
  description: "Class1 수업 블로그",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* 저장된 테마를 첫 페인트 전에 적용(FOUC 방지). src/hooks/use-theme.ts 참고 */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col">
        <SessionProvider>
          <TooltipProvider>
            <SiteHeader />
            <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-8 sm:py-10">
              {children}
            </main>
            <SiteFooter />
            <Toaster position="top-center" />
          </TooltipProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
