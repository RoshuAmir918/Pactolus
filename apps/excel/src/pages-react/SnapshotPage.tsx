import { StepLayout } from "@/components/shell/step-layout";
import { StatusBanner } from "@/components/shell/status-banner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function SnapshotPage(props: {
  snapshotId: string;
  targetColumns: string;
  snapshotPreview: string;
  status: { kind: "ok" | "error"; message: string } | null;
  canContinue: boolean;
  onSnapshotIdChange: (value: string) => void;
  onTargetColumnsChange: (value: string) => void;
  onCaptureSnapshot: () => Promise<void> | void;
  onContinue: () => void;
}) {
  return (
    <StepLayout
      stepLabel="Step 2 of 4"
      title="Snapshot Context"
      subtitle="Capture your selected Excel range and define the target output columns."
    >
      <StatusBanner status={props.status} />
      <Card>
        <CardHeader>
          <CardTitle>Select snapshot context</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs text-slate-600">Snapshot ID</label>
            <Input
              value={props.snapshotId}
              onChange={(e) => props.onSnapshotIdChange(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-slate-600">Target columns (comma-separated)</label>
            <Textarea
              rows={3}
              value={props.targetColumns}
              onChange={(e) => props.onTargetColumnsChange(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={props.onCaptureSnapshot}>Capture snapshot</Button>
            <Button variant="secondary" onClick={props.onContinue} disabled={!props.canContinue}>
              Continue to run setup
            </Button>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Snapshot preview</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="code-panel">{props.snapshotPreview}</pre>
        </CardContent>
      </Card>
    </StepLayout>
  );
}
