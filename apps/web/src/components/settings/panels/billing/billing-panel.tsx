import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function BillingPanel() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Billing</CardTitle>
        <CardDescription>
          Payment method, plan, subscription, and invoices will be managed here.
        </CardDescription>
      </CardHeader>
    </Card>
  );
}
