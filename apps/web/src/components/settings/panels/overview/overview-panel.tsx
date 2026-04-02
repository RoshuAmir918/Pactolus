import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function OverviewPanel() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Overview</CardTitle>
        <CardDescription>
          Organization summary, plan, and quick stats will live here.
        </CardDescription>
      </CardHeader>
    </Card>
  );
}
