import type { Metadata } from "next";
import Link from "next/link";
import { EmptyOwl } from "@/components/states";
import { primaryPillClass } from "@/lib/pill";

export const metadata: Metadata = { title: "페이지를 찾을 수 없습니다" };

export default function NotFound() {
  // 빈 화면·오류 안내 톤 맞춤(디자인 개편 2단계): 생각하는 부엉이 + 알약 버튼. 문구는 그대로.
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 py-16 text-center">
      <EmptyOwl className="w-28 sm:w-32" />
      <p className="font-heading text-6xl tracking-tight">404</p>
      <p className="text-muted-foreground">요청하신 페이지를 찾을 수 없습니다.</p>
      <Link href="/" className={primaryPillClass}>
        메인으로 이동
      </Link>
    </div>
  );
}
