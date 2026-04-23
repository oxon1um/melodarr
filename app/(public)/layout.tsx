import { AppHeader } from "@/components/app-header";

export default function PublicLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <AppHeader user={null} />
      {children}
    </>
  );
}
