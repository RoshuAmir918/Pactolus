"use client";

import { useEffect, useState } from "react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import {
  FileText,
  GitBranch,
  Save,
  ArrowUpRight,
} from "lucide-react";
import { activeViewAtom, activeNodeIdAtom, compareNodeIdsAtom, type ActiveView } from "@/stores/workspace-ui";
import { demoOrgsAtom } from "@/stores/workspace";
import { trpc } from "@/lib/trpc-client";
import { NodeDetailPanel } from "./node-detail-panel";
import { NodeComparePanel } from "./node-compare-panel";

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
  const [compareNodeIds, setCompareNodeIds] = useAtom(compareNodeIdsAtom);
  const setActiveNodeId = useSetAtom(activeNodeIdAtom);
  const setActiveView = useSetAtom(activeViewAtom);

  const runId =
    activeView.type === "run" || activeView.type === "node"
      ? (activeView as { runId: string }).runId
      : null;

  // Compare mode: 2+ nodes selected takes priority
  if (compareNodeIds.length >= 2 && runId) {
    return (
      <div className="h-full overflow-hidden">
        <NodeComparePanel
          runId={runId}
          operationIds={compareNodeIds}
          onClear={() => {
            setCompareNodeIds([]);
            setActiveNodeId(null);
            if (activeView.type === "node") {
              const base = activeView as Extract<ActiveView, { runId: string }>;
              setActiveView({ type: "run", clientId: base.clientId, snapshotId: base.snapshotId, runId: base.runId });
            }
          }}
        />
      </div>
    );
  }

  // Single node detail
  if (activeView.type === "node") {
    return (
      <div className="h-full overflow-hidden">
        <NodeDetailPanel runId={activeView.runId} stepId={activeView.nodeId} />
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
