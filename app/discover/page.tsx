import { DiscoverClient } from "@/components/discover-client";
import { requireCurrentUser } from "@/lib/auth/server";

export default async function DiscoverPage() {
  await requireCurrentUser();
  return <DiscoverClient />;
}
