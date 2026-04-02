"use client";

import { useEffect, useState } from "react";
import { useAtomValue } from "jotai";
import {
  FileText,
  GitBranch,
  Save,
  ArrowUpRight,
} from "lucide-react";
import { activeViewAtom, activeNodeIdAtom } from "@/stores/workspace-ui";
import { demoOrgsAtom } from "@/stores/workspace";
import { trpc } from "@/lib/trpc-client";
import { NodeDetailPanel } from "./node-detail-panel";

// Mock data for demonstration
const MOCK_RUNS_DETAIL: Record<string, {
  name: string;
  stepCount: number;
  branchCount: number;
  lastSaved: string;
  outputSummary: string;
  branches: Array<{ id: string; name: string; status: "active" | "archived"; stepCount: number; narrative: string }>;
}> = {
  "run-acme-1": {
    name: "Base scenario",
    stepCount: 8,
    branchCount: 3,
    lastSaved: "Mar 17, 2026",
    outputSummary: "Loss ratio: 68.4% · Premium volume: $142M · Ceded: 31.2%",
    branches: [
      { id: "main", name: "main", status: "active", stepCount: 3, narrative: "Initial base case with standard commission rates and proportional treaty structure." },
      { id: "scenario-a", name: "Scenario A", status: "active", stepCount: 2, narrative: "Increased retention to 80% with revised loss development factors applied to cat years." },
      { id: "scenario-b", name: "Scenario B", status: "archived", stepCount: 3, narrative: "Stress test applying 1-in-250 cat load to Gulf Coast property exposure." },
    ],
  },
  "run-acme-2": {
    name: "Stress test",
    stepCount: 3,
    branchCount: 1,
    lastSaved: "Mar 20, 2026",
    outputSummary: "Loss ratio: 94.1% · Premium volume: $142M · Ceded: 45.0%",
    branches: [
      { id: "main", name: "main", status: "active", stepCount: 3, narrative: "Full stress scenario applying severe cat year 2005 analog to current portfolio." },
    ],
  },
};

const MOCK_NODE_DETAIL: Record<string, {
  stepType: string;
  label: string;
  timestamp: string;
  branchName: string;
  narrative: string | null;
  outputValues: Array<{ address: string; sheetName: string; label: string; value: string }>;
  assumptions: Array<{ key: string; value: string; confidence: number }>;
}> = {
  "step-2": {
    stepType: "scenario_snapshot",
    label: "Base save",
    timestamp: "Mar 15, 2026 at 2:34 PM",
    branchName: "main",
    narrative: "Baseline save with standard proportional treaty structure. Commission rate fixed at 22.5%, no cat XL applied.",
    outputValues: [
      { address: "D14", sheetName: "Summary", label: "Net Loss Ratio", value: "68.4%" },
      { address: "D15", sheetName: "Summary", label: "Ceded Premium", value: "$44.3M" },
      { address: "D16", sheetName: "Summary", label: "Net Premium", value: "$97.7M" },
      { address: "F22", sheetName: "Summary", label: "Combined Ratio", value: "91.2%" },
    ],
    assumptions: [
      { key: "commission_rate", value: "22.5%", confidence: 0.9 },
      { key: "retention_pct", value: "68.8%", confidence: 0.85 },
      { key: "cat_load", value: "0.0%", confidence: 1.0 },
    ],
  },
  "step-5": {
    stepType: "scenario_snapshot",
    label: "Save point",
    timestamp: "Mar 16, 2026 at 10:15 AM",
    branchName: "Scenario A",
    narrative: "Increased retention to 80% with revised LDFs. Cat load added at 2.5% of premium.",
    outputValues: [
      { address: "D14", sheetName: "Summary", label: "Net Loss Ratio", value: "71.8%" },
      { address: "D15", sheetName: "Summary", label: "Ceded Premium", value: "$28.4M" },
      { address: "D16", sheetName: "Summary", label: "Net Premium", value: "$113.6M" },
      { address: "F22", sheetName: "Summary", label: "Combined Ratio", value: "95.3%" },
    ],
    assumptions: [
      { key: "commission_rate", value: "22.5%", confidence: 0.9 },
      { key: "retention_pct", value: "80.0%", confidence: 0.8 },
      { key: "cat_load", value: "2.5%", confidence: 0.75 },
    ],
  },
};

function HomeView() {
  const orgs = useAtomValue(demoOrgsAtom);
  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-xl font-semibold mb-1">Welcome to Pactolus</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Select a client snapshot from the sidebar to start analyzing runs and scenarios.
      </p>
      <div className="grid grid-cols-2 gap-3">
        {orgs.slice(0, 4).map((org) => (
          <div key={org.id} className="border border-border rounded-lg p-4 hover:bg-muted/30 transition-colors cursor-pointer">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center">
                <span className="text-xs font-bold text-primary">{org.name[0]}</span>
              </div>
              <span className="text-sm font-medium">{org.name}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {org.snapshots.length} snapshot{org.snapshots.length !== 1 ? "s" : ""}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function SnapshotView({ snapshotId, clientId }: { snapshotId: string; clientId: string }) {
  const orgs = useAtomValue(demoOrgsAtom);
  const org = orgs.find((o) => o.id === clientId);
  const snap = org?.snapshots.find((s) => s.id === snapshotId);

  const [runs, setRuns] = useState<Array<{ id: string; name: string; status: string; createdAt: Date }>>([]);
  const [runsLoading, setRunsLoading] = useState(true);

  useEffect(() => {
    setRunsLoading(true);
    trpc.operations.getRunsBySnapshot
      .query({ snapshotId, limit: 25 })
      .then((r) => setRuns(r.runs))
      .catch(() => setRuns([]))
      .finally(() => setRunsLoading(false));
  }, [snapshotId]);

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
        <span>{org?.name}</span>
        <span>/</span>
        <span className="text-foreground font-medium">{snap?.name ?? snapshotId}</span>
      </div>
      <h1 className="text-xl font-semibold mb-4">{snap?.name ?? "Snapshot"}</h1>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <StatCard label="Runs" value={runsLoading ? "…" : runs.length.toString()} icon={<GitBranch className="w-4 h-4" />} />
        <StatCard label="Source documents" value="—" icon={<FileText className="w-4 h-4" />} />
      </div>

      <h2 className="text-sm font-medium mb-2">Runs</h2>
      {runsLoading && (
        <div className="space-y-2">
          <div className="h-14 rounded-lg bg-muted/60 animate-pulse" />
          <div className="h-14 rounded-lg bg-muted/40 animate-pulse" />
        </div>
      )}
      {!runsLoading && runs.length === 0 && (
        <p className="text-sm text-muted-foreground">No runs yet. Create one in the Excel add-in.</p>
      )}
      <div className="space-y-2">
        {runs.map((run) => (
          <div key={run.id} className="border border-border rounded-lg p-3 flex items-center gap-3 hover:bg-muted/30 transition-colors cursor-pointer">
            <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center shrink-0">
              <GitBranch className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{run.name}</p>
              <p className="text-xs text-muted-foreground">
                {run.status} · created {new Date(run.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RunView({ runId }: { runId: string }) {
  const [operations, setOperations] = useState<Array<{
    id: string; operationIndex: number; operationType: string; parametersJson: unknown; createdAt: Date;
  }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    trpc.operations.getRunOperations
      .query({ runId })
      .then((r) => setOperations(r.operations))
      .catch(() => setOperations([]))
      .finally(() => setLoading(false));
  }, [runId]);

  const saves = operations.filter((o) => o.operationType === "scenario_snapshot");

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center gap-2 mb-4">
        <GitBranch className="w-5 h-5 text-muted-foreground" />
        <h1 className="text-xl font-semibold">Run</h1>
        <span className="text-xs text-muted-foreground font-mono">{runId.slice(0, 8)}…</span>
      </div>

      {loading ? (
        <div className="space-y-2">
          <div className="h-16 rounded-lg bg-muted/60 animate-pulse" />
          <div className="h-16 rounded-lg bg-muted/40 animate-pulse" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 mb-6">
            <StatCard label="Saves" value={saves.length.toString()} icon={<Save className="w-4 h-4" />} />
            <StatCard label="Operations" value={operations.length.toString()} icon={<ArrowUpRight className="w-4 h-4" />} />
          </div>

          <h2 className="text-sm font-medium mb-2">Saves</h2>
          {saves.length === 0 && (
            <p className="text-sm text-muted-foreground">No saves yet. Open this run in the Excel add-in to start.</p>
          )}
          <div className="space-y-2">
            {saves.map((op) => {
              const p = op.parametersJson as { label?: string; narrative?: string } | null;
              return (
                <div key={op.id} className="border border-border rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <Save className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span className="text-sm font-medium">{p?.label ?? "Saved"}</span>
                    <span className="text-[10px] text-muted-foreground font-mono ml-auto shrink-0">#{op.operationIndex}</span>
                  </div>
                  {p?.narrative && (
                    <p className="text-[10px] text-muted-foreground mt-1 pl-5 leading-snug">{p.narrative}</p>
                  )}
                  <p className="text-[10px] text-muted-foreground mt-0.5 pl-5">
                    {new Date(op.createdAt).toLocaleDateString()}
                  </p>
                </div>
              );
            })}
          </div>

          <p className="text-xs text-muted-foreground mt-4 text-center">
            Click a node in the run history below to see its captures
          </p>
        </>
      )}
    </div>
  );
}

function NodeView({ nodeId }: { nodeId: string }) {
  const node = MOCK_NODE_DETAIL[nodeId];
  if (!node) return (
    <div className="p-6 text-sm text-muted-foreground">
      Select a save point node in the run history below to view its details.
    </div>
  );

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
        <span>{node.branchName}</span>
        <span>/</span>
        <span className="text-foreground">{node.label}</span>
      </div>
      <div className="flex items-center gap-2 mb-4">
        <Save className="w-4 h-4 text-emerald-500" />
        <h1 className="text-xl font-semibold">{node.label}</h1>
        <span className="text-xs text-muted-foreground">{node.timestamp}</span>
      </div>

      {node.narrative && (
        <div className="bg-muted/30 border border-border rounded-lg p-3 mb-4">
          <p className="text-xs text-muted-foreground mb-1 font-medium uppercase tracking-wide">Analyst narrative</p>
          <p className="text-sm leading-relaxed">{node.narrative}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Output values */}
        <div>
          <h2 className="text-sm font-medium mb-2 flex items-center gap-1.5">
            <ArrowUpRight className="w-3.5 h-3.5 text-emerald-500" />
            Key Outputs
          </h2>
          <div className="space-y-1.5">
            {node.outputValues.map((ov) => (
              <div key={ov.address} className="flex items-center justify-between bg-muted/30 rounded-md px-3 py-1.5">
                <div>
                  <p className="text-xs font-medium">{ov.label}</p>
                  <p className="text-[10px] text-muted-foreground">{ov.sheetName}!{ov.address}</p>
                </div>
                <span className="text-sm font-semibold tabular-nums">{ov.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Assumptions */}
        <div>
          <h2 className="text-sm font-medium mb-2 flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            Assumptions
          </h2>
          <div className="space-y-1.5">
            {node.assumptions.map((a) => (
              <div key={a.key} className="flex items-center justify-between bg-muted/30 rounded-md px-3 py-1.5">
                <div>
                  <p className="text-xs font-medium">{a.key.replace(/_/g, " ")}</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <div className="h-1 w-16 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-400 rounded-full"
                        style={{ width: `${a.confidence * 100}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground">{Math.round(a.confidence * 100)}%</span>
                  </div>
                </div>
                <span className="text-sm font-semibold tabular-nums">{a.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="border border-border rounded-lg p-3 flex items-center gap-2">
        <CheckCircle className="w-4 h-4 text-muted-foreground" />
        <p className="text-xs text-muted-foreground">
          Full workbook view coming soon — will render the saved .xlsx with Fortune Sheet
        </p>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="border border-border rounded-lg p-3">
      <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <p className="text-2xl font-semibold">{value}</p>
    </div>
  );
}

export function CenterPanel() {
  const activeView = useAtomValue(activeViewAtom);
  const activeNodeId = useAtomValue(activeNodeIdAtom);

  // Node detail — clicked a step in the run tree
  if (activeView.type === "node") {
    return (
      <div className="h-full overflow-hidden">
        <NodeDetailPanel
          runId={activeView.runId}
          stepId={activeView.nodeId}
          step={null}
          branch={null}
          allBranches={[]}
        />
      </div>
    );
  }

  if (activeView.type === "home") {
    return (
      <div className="h-full overflow-y-auto">
        <HomeView />
      </div>
    );
  }

  if (activeView.type === "snapshot") {
    return (
      <div className="h-full overflow-y-auto">
        <SnapshotView snapshotId={activeView.snapshotId} clientId={activeView.clientId} />
      </div>
    );
  }

  if (activeView.type === "run") {
    return (
      <div className="h-full overflow-y-auto">
        <RunView runId={activeView.runId} />
      </div>
    );
  }

  return null;
}
