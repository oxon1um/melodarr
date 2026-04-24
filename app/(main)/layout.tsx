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
      <main
        id="main-content"
        className="relative mx-auto w-full max-w-[min(1600px,calc(100vw-1.5rem))] px-4 py-8 sm:max-w-[min(1720px,calc(100vw-3rem))] sm:px-6"
      >
        {children}
      </main>
    </>
  );
}
