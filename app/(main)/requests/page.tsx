import { RequestsTable } from "@/components/requests-table";
import { requireCurrentUser } from "@/lib/auth/server";

export default async function RequestsPage() {
  await requireCurrentUser();
  return <RequestsTable />;
}
