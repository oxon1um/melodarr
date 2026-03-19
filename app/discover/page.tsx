import { DiscoverClient } from "@/components/discover-client";
import { WelcomeTour } from "@/components/onboarding/welcome-tour";
import { requireCurrentUser } from "@/lib/auth/server";

export default async function DiscoverPage() {
  await requireCurrentUser();
  return (
    <>
      <WelcomeTour />
      <DiscoverClient />
    </>
  );
}
