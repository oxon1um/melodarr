import { redirect } from "next/navigation";
import { isAppInitialized } from "@/lib/app-state";
import { getCurrentUser } from "@/lib/auth/server";

export default async function HomePage() {
  const initialized = await isAppInitialized();
  if (!initialized) {
    redirect("/setup");
  }

  const user = await getCurrentUser();
  redirect(user ? "/discover" : "/login");
}
