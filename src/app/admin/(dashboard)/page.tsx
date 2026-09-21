import type { Metadata } from "next";
import { AdminOverview } from "./admin-overview";

export const metadata: Metadata = { title: "관리자" };

export default function AdminOverviewPage() {
  return <AdminOverview />;
}
