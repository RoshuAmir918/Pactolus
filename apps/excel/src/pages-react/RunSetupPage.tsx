import type { BranchOption, ClientOption, RunOption, SnapshotOption } from "@/features/types";
import { StepLayout } from "@/components/shell/step-layout";
import { StatusBanner } from "@/components/shell/status-banner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";

export function RunSetupPage(props: {
  snapshotId: string;
  selectedClientId: string;
  runMode: "create" | "select";
  runSummary: string;
  availableClients: ClientOption[];
  availableSnapshots: SnapshotOption[];
  availableRuns: RunOption[];
  availableBranches: BranchOption[];
  selectedRunId: string;
  selectedBranchId: string;
  status: { kind: "ok" | "error"; message: string } | null;
  canContinue: boolean;
  onReloadContext: () => Promise<void> | void;
  onClientSelect: (clientId: string) => void;
  onRunModeChange: (value: "create" | "select") => void;
  onSnapshotIdChange: (value: string) => void;
  onLoadRuns: () => Promise<void> | void;
  onRunSelect: (runId: string) => Promise<void> | void;
  onBranchSelect: (branchId: string) => void;
  onContinue: () => void;
}) {
  return (
    <StepLayout
      stepLabel="Step 2 of 3"
      title="Run Setup"
      subtitle="Select snapshot first, then choose existing run+branch or create a new run."
    >
      <StatusBanner status={props.status} />
      <Card>
        <CardHeader>
          <CardTitle>Select snapshot and run</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Button variant="outline" onClick={props.onReloadContext}>
              Refresh clients/snapshots
            </Button>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-slate-600">Client</label>
            <Select
              value={props.selectedClientId}
              onChange={(e) => props.onClientSelect(e.target.value)}
            >
              <option value="">Select a client...</option>
              {props.availableClients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-slate-600">Snapshot</label>
            <Select
              value={props.snapshotId}
              onChange={(e) => props.onSnapshotIdChange(e.target.value)}
            >
              <option value="">Select a snapshot...</option>
              {props.availableSnapshots.map((snapshot) => (
                <option key={snapshot.id} value={snapshot.id}>
                  {snapshot.label} ({snapshot.status})
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-slate-600">Run mode</label>
            <Select
              value={props.runMode}
              onChange={(e) => props.onRunModeChange(e.target.value as "create" | "select")}
            >
              <option value="create">Create new run on start monitoring</option>
              <option value="select">Select existing run</option>
            </Select>
          </div>

          {props.runMode === "select" ? (
            <>
              <Button variant="outline" onClick={props.onLoadRuns}>
                Load runs for snapshot
              </Button>
              <div className="space-y-1">
                <label className="text-xs text-slate-600">Run</label>
                <Select
                  value={props.selectedRunId}
                  onChange={(e) => props.onRunSelect(e.target.value)}
                >
                  <option value="">Select a run...</option>
                  {props.availableRuns.map((run) => (
                    <option key={run.id} value={run.id}>
                      {run.name} ({run.status})
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-600">Branch</label>
                <Select
                  value={props.selectedBranchId}
                  onChange={(e) => props.onBranchSelect(e.target.value)}
                >
                  <option value="">Select a branch...</option>
                  {props.availableBranches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name} ({branch.status})
                    </option>
                  ))}
                </Select>
              </div>
            </>
          ) : null}

          <p className="text-xs text-slate-600">{props.runSummary}</p>
          <div className="flex gap-2">
            <Button onClick={props.onContinue} disabled={!props.canContinue}>
              Continue to workspace
            </Button>
          </div>
        </CardContent>
      </Card>
    </StepLayout>
  );
}
