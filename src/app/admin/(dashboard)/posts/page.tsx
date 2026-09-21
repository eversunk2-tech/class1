import type { Metadata } from "next";
import { AdminPostList } from "./admin-post-list";

export const metadata: Metadata = { title: "글 관리" };

export default function AdminPostsPage() {
  return <AdminPostList />;
}
