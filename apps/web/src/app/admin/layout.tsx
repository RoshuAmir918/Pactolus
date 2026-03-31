import { notFound } from "next/navigation";
import { getMeOnServer } from "@/lib/server-auth";
import { AdminShell } from "@/components/admin/admin-shell";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getMeOnServer();
  if (!user || !user.isSuperUser) {
    notFound();
  }
  return <AdminShell>{children}</AdminShell>;
}
