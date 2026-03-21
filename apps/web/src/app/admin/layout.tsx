import { notFound } from "next/navigation";
import { getMeOnServer } from "@/lib/server-auth";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getMeOnServer();
  if (!user || user.role !== "admin") {
    notFound();
  }
  return <>{children}</>;
}
