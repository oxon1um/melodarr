import { AppHeader } from "@/components/app-header";
import { getCurrentUser } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

export default async function MainLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getCurrentUser();

  return (
    <>
      <AppHeader user={user} />
      {children}
    </>
  );
}
