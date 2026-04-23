import { AdminSettingsForm } from "@/components/admin-settings-form";
import { requireCurrentAdmin } from "@/lib/auth/server";

export default async function AdminSettingsPage() {
  await requireCurrentAdmin();
  return <AdminSettingsForm />;
}
