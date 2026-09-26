import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ForcePasswordChangeGate } from "@/components/force-password-change-gate";
import { LoginGate } from "@/components/login-gate";
import { Sidebar } from "@/components/layout/sidebar";
import { SITE_NAME, Topbar } from "@/components/layout/topbar";
import { SiteFooter } from "@/components/site-footer";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SessionProvider } from "@/hooks/use-session";
import { SIDEBAR_INIT_SCRIPT } from "@/hooks/use-sidebar";
import { THEME_INIT_SCRIPT } from "@/hooks/use-theme";
import { withBasePath } from "@/lib/base-path";
// 본문 한글 글꼴 Pretendard(SIL OFL 1.1, npm 패키지 `pretendard`로 자체 호스팅).
// 가변 글꼴(Pretendard Variable) 한 벌이 모든 굵기를 담는다(화면은 400·500·600을 쓴다).
// 한글을 92조각(unicode-range)으로 나눈 dynamic subset이라 화면에 실제로 나온 글자가 든 조각만 내려받는다.
// 정적 3굵기보다 CSS 약 1/3, 요청 수 절반, 배포 용량이 작다(docs/design/redesign/build-1-report.md 개정 1).
// 글꼴 파일은 빌드 때 _next/static/media/로 복사되고 CSS의 상대 경로(../media/)라 basePath(/class1)와 무관하게 동작한다.
// 라이선스 고지: public/fonts/LICENSE-pretendard-OFL.txt(패키지의 LICENSE.txt 원문).
import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  preload: false, // 관리자·코드 칸에서만 쓰므로 첫 화면에서 미리 받지 않는다
});

// 제목 전용 글꼴 G마켓 산스 Bold(SIL OFL 1.1, docs/design/redesign/spec.md 개정 2).
// next/font가 못 다루는 로컬 OTF라 작은 스타일시트(public/fonts/gmarket-sans/gmarket-sans.css)를 붙인다.
// HTML에 <link>를 그대로 두면 이 CSS를 받을 때까지 첫 화면이 멈추므로(review-5 중간 지적), 과학 앱 persist.js처럼
// 스크립트로 붙여 첫 화면을 막지 않는다 — 먼저 대체 글꼴(Pretendard 굵게)로 그리고 글꼴이 오면 바뀐다.
const HEADING_FONT_SCRIPT = `(function(){try{var d=document,l=d.createElement("link");l.rel="stylesheet";l.href=${JSON.stringify(
  withBasePath("/fonts/gmarket-sans/gmarket-sans.css"),
)};d.head.appendChild(l)}catch(e){}})();`;

export const metadata: Metadata = {
  title: { default: SITE_NAME, template: `%s | ${SITE_NAME}` },
  description: "친구들과 함께 배우고 탐구하는 공간이에요. 과학 수업 이야기, 자유게시판, 직접 만든 학습 게임을 만나 보세요.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* 제목 글꼴 CSS를 첫 화면을 막지 않게 붙인다(위 HEADING_FONT_SCRIPT 설명 참고) */}
        <script dangerouslySetInnerHTML={{ __html: HEADING_FONT_SCRIPT }} />
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
                <main className="flex w-full flex-1 flex-col px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
                  {/* "로그인해야만 이용"이 켜져 있으면 비로그인 방문자에게 로그인 안내를 보여 준다. */}
                  <LoginGate>{children}</LoginGate>
                </main>
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
