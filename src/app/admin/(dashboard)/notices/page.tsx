import type { Metadata } from "next";
import { NoticesView } from "./notices-view";

export const metadata: Metadata = { title: "선생님 글" };

// /admin/notices/ — 학급별 '선생님 글' 쓰기·고치기·지우기(docs/classes/spec.md 개정 2). 블로그 '글 관리'·'새 글 작성' 대신.
export default function AdminNoticesPage() {
  return <NoticesView />;
}
