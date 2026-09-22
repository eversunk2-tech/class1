import type { Metadata } from "next";
import { CommunityModeration } from "./community-moderation";

export const metadata: Metadata = { title: "커뮤니티 관리" };

export default function AdminCommunityPage() {
  return <CommunityModeration />;
}
