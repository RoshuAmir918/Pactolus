import { Alert } from "@/components/ui/alert";

export function StatusBanner({
  status,
}: {
  status: { kind: "ok" | "error"; message: string } | null;
}) {
  if (!status?.message) {
    return null;
  }
  return (
    <Alert variant={status.kind === "error" ? "destructive" : "default"}>{status.message}</Alert>
  );
}
