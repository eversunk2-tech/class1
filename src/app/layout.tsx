import type { Metadata } from "next";
import { Geist, Geist_Mono, Jua } from "next/font/google";
import { ForcePasswordChangeGate } from "@/components/force-password-change-gate";
import { Sidebar } from "@/components/layout/sidebar";
import { SITE_NAME, Topbar } from "@/components/layout/topbar";
import { SiteFooter } from "@/components/site-footer";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SessionProvider } from "@/hooks/use-session";
import { SIDEBAR_INIT_SCRIPT } from "@/hooks/use-sidebar";
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

// 제목 전용 글꼴. Jua는 weight 400 하나뿐이고, next/font가 아는 subset은 "latin"뿐이다
// (한글 글리프는 Google Fonts가 unicode-range 조각으로 나눠 필요할 때만 내려받는다).
const jua = Jua({
  variable: "--font-heading-kr",
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: SITE_NAME, template: `%s | ${SITE_NAME}` },
  description: "우리 반이 함께 배우고 만든 것을 모아 둔 곳이에요. 과학 수업 이야기, 자유게시판, 직접 만든 학습 게임을 만나 보세요.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} ${jua.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* 저장된 테마를 첫 페인트 전에 적용(FOUC 방지). src/hooks/use-theme.ts 참고 */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        {/* 저장된 사이드바 접힘 상태를 첫 페인트 전에 적용. src/hooks/use-sidebar.ts 참고 */}
        <script dangerouslySetInnerHTML={{ __html: SIDEBAR_INIT_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col">
        <SessionProvider>
          {/* 임시 비밀번호로 로그인한 계정을 /reset-password/로 보낸다(docs/admin/spec.md §7). */}
          <ForcePasswordChangeGate />
          <TooltipProvider>
            <Topbar />
            <div className="flex flex-1">
              <Sidebar />
              {/* 각 페이지가 자기 본문 폭(max-w-*)을 직접 정한다. */}
              <div className="flex min-w-0 flex-1 flex-col">
                <main className="flex w-full flex-1 flex-col px-4 py-8 sm:px-6 sm:py-10 lg:px-8">{children}</main>
                <SiteFooter />
              </div>
            </div>
            <Toaster position="top-center" />
          </TooltipProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
