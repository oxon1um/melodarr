import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { isAppInitialized } from "@/lib/app-state";
import { LoginForm } from "@/components/login-form";
import { getCurrentUser } from "@/lib/auth/server";
import { isHttpsRequest } from "@/lib/http/protocol";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const initialized = await isAppInitialized();
  if (!initialized) {
    redirect("/setup");
  }

  const user = await getCurrentUser();

  if (user) {
    redirect("/discover");
  }

  const requestHeaders = await headers();
  const isHttps = await isHttpsRequest(requestHeaders);

  return (
    <div className="py-16">
      <LoginForm isHttps={isHttps} />
    </div>
  );
}
