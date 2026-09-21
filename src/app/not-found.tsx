import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "페이지를 찾을 수 없습니다" };

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 py-20 text-center">
      <p className="text-5xl font-semibold tracking-tight">404</p>
      <p className="text-muted-foreground">요청하신 페이지를 찾을 수 없습니다.</p>
      <Button render={<Link href="/" />} nativeButton={false}>
        메인으로 이동
      </Button>
    </div>
  );
}
