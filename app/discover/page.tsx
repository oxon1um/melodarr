import { DiscoverClient } from "@/components/discover-client";
import { WelcomeTour } from "@/components/onboarding/welcome-tour";
import { requireCurrentUser } from "@/lib/auth/server";
import { getDiscoverHomeData } from "@/lib/discover/home";

export default async function DiscoverPage() {
  await requireCurrentUser();
  const homeData = await getDiscoverHomeData();

  return (
    <>
      <WelcomeTour />
      <DiscoverClient homeData={homeData} />
    </>
  );
}
