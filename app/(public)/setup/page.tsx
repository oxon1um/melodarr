import { redirect } from "next/navigation";
import { isAppInitialized } from "@/lib/app-state";
import { getCurrentUser } from "@/lib/auth/server";
import { SetupWizardForm } from "@/components/setup-wizard-form";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const initialized = await isAppInitialized();
  const user = await getCurrentUser();

  if (initialized) {
    redirect(user ? "/discover" : "/login");
  }

  return (
    <div className="py-8">
      <SetupWizardForm />
    </div>
  );
}
