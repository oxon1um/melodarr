import { RequestsTable } from "@/components/requests-table";
import { requireCurrentAdmin } from "@/lib/auth/server";

export default async function AdminRequestsPage() {
  await requireCurrentAdmin();
  return <RequestsTable admin />;
}
