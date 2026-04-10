import { Check, ChevronRight, Plus } from "lucide-react";
import type { ClientOption, RunOption, SnapshotOption } from "@/features/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ── helpers ───────────────────────────────────────────────────────────────────

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(date));
}

function statusDot(status: string) {
  if (status === "running") return "bg-blue-500";
  if (status === "ready" || status === "locked") return "bg-emerald-500";
  if (status === "failed") return "bg-red-500";
  return "bg-muted-foreground/40";
}

// ── breadcrumb ────────────────────────────────────────────────────────────────

function Breadcrumb(props: {
  client?: string;
  snapshot?: string;
  onClientClear: () => void;
  onSnapshotClear: () => void;
}) {
  return (
    <div className="flex items-center gap-1 text-xs text-muted-foreground flex-wrap">
      {props.client ? (
        <button
          type="button"
          onClick={props.onClientClear}
          className="hover:text-foreground transition-colors font-medium"
        >
          {props.client}
        </button>
      ) : (
        <span>Select client</span>
      )}
      {props.snapshot && (
        <>
          <ChevronRight className="w-3 h-3 shrink-0" />
          <button
            type="button"
            onClick={props.onSnapshotClear}
            className="hover:text-foreground transition-colors font-medium"
          >
            {props.snapshot}
          </button>
        </>
      )}
      {props.client && !props.snapshot && (
        <>
          <ChevronRight className="w-3 h-3 shrink-0" />
          <span>Select snapshot</span>
        </>
      )}
      {props.snapshot && (
        <>
          <ChevronRight className="w-3 h-3 shrink-0" />
          <span>Select run</span>
        </>
      )}
    </div>
  );
}

// ── pick row (client / snapshot) ──────────────────────────────────────────────

function PickRow(props: { label: string; sublabel?: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border bg-card hover:bg-muted/40 text-left transition-colors group"
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground leading-tight truncate">{props.label}</p>
        {props.sublabel && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{props.sublabel}</p>
        )}
      </div>
      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50 group-hover:text-muted-foreground shrink-0 transition-colors" />
    </button>
  );
}

// ── run card ──────────────────────────────────────────────────────────────────

function RunCard(props: { run: RunOption; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={props.onSelect}
      className={cn(
        "w-full flex items-start gap-3 px-3 py-2.5 rounded-lg border text-left transition-colors",
        props.selected
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card hover:bg-muted/40",
      )}
    >
      {/* status dot */}
      <div className="pt-1.5 shrink-0">
        <div className={cn("w-2 h-2 rounded-full", props.selected ? "bg-primary-foreground/70" : statusDot(props.run.status))} />
      </div>

      <div className="flex-1 min-w-0">
        <p className={cn("text-sm font-medium leading-tight truncate", props.selected ? "text-primary-foreground" : "text-foreground")}>
          {props.run.name}
        </p>
        <p className={cn("text-xs mt-0.5", props.selected ? "text-primary-foreground/60" : "text-muted-foreground")}>
          {props.run.createdByName} · {formatDate(props.run.createdAt)} · {props.run.nodeCount} save{props.run.nodeCount !== 1 ? "s" : ""}
        </p>
      </div>

      {props.selected && <Check className="w-3.5 h-3.5 text-primary-foreground shrink-0 mt-1" />}
    </button>
  );
}

// ── new run card ──────────────────────────────────────────────────────────────

function NewRunCard(props: { active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-colors",
        props.active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-dashed border-border bg-card hover:bg-muted/40 text-muted-foreground hover:text-foreground",
      )}
    >
      <Plus className={cn("w-3.5 h-3.5 shrink-0", props.active ? "text-primary-foreground" : "")} />
      <span className={cn("text-sm font-medium", props.active ? "text-primary-foreground" : "")}>
        Start new analysis
      </span>
      {props.active && <Check className="w-3.5 h-3.5 text-primary-foreground shrink-0 ml-auto" />}
    </button>
  );
}

// ── page ──────────────────────────────────────────────────────────────────────

export function RunSetupPage(props: {
  snapshotId: string;
  selectedClientId: string;
  runMode: "create" | "select";
  runSummary: string;
  availableClients: ClientOption[];
  availableSnapshots: SnapshotOption[];
  availableRuns: RunOption[];
  selectedRunId: string;
  status: { kind: "ok" | "error"; message: string } | null;
  canContinue: boolean;
  onReloadContext: () => Promise<void> | void;
  onClientSelect: (clientId: string) => void;
  onRunModeChange: (value: "create" | "select") => void;
  onSnapshotIdChange: (value: string) => void;
  onLoadRuns: (snapshotIdOverride?: string) => Promise<void> | void;
  onRunSelect: (runId: string) => Promise<void> | void;
  onContinue: () => void;
}) {
  const hasClient = !!props.selectedClientId;
  const hasSnapshot = !!props.snapshotId;

  const selectedClient = props.availableClients.find((c) => c.id === props.selectedClientId);
  const selectedSnapshot = props.availableSnapshots.find((s) => s.id === props.snapshotId);

  return (
    <div className="min-h-screen bg-background flex flex-col px-4 py-6 gap-5">

      {/* header */}
      <div>
        <h1 className="text-base font-semibold text-foreground">Open analysis</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Choose a snapshot and run to continue, or start fresh.</p>
      </div>

      {/* breadcrumb trail */}
      <Breadcrumb
        client={selectedClient?.name}
        snapshot={selectedSnapshot?.label}
        onClientClear={() => props.onClientSelect("")}
        onSnapshotClear={() => props.onSnapshotIdChange("")}
      />

      {/* only surface errors — ok-level status is noise */}
      {props.status?.kind === "error" && (
        <div className="text-xs px-3 py-2 rounded-lg border bg-destructive/10 border-destructive/30 text-destructive">
          {props.status.message}
        </div>
      )}

      {/* ── client list ─────────────────────────────────────────────────── */}
      {!hasClient && (
        <div className="flex flex-col gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Clients</p>
          {props.availableClients.length === 0 ? (
            <div className="text-sm text-muted-foreground flex items-center gap-1.5">
              No clients found.{" "}
              <button type="button" onClick={props.onReloadContext} className="underline underline-offset-2 hover:text-foreground transition-colors">
                Refresh
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {props.availableClients.map((client) => (
                <PickRow key={client.id} label={client.name} onClick={() => props.onClientSelect(client.id)} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── snapshot list ────────────────────────────────────────────────── */}
      {hasClient && !hasSnapshot && (
        <div className="flex flex-col gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Snapshots</p>
          {props.availableSnapshots.length === 0 ? (
            <p className="text-sm text-muted-foreground">No snapshots for this client.</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {props.availableSnapshots.map((snapshot) => (
                <PickRow
                  key={snapshot.id}
                  label={snapshot.label}
                  sublabel={snapshot.accountingPeriod ?? undefined}
                  onClick={() => {
                    props.onSnapshotIdChange(snapshot.id);
                    props.onLoadRuns(snapshot.id);
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── run list ─────────────────────────────────────────────────────── */}
      {hasSnapshot && (
        <div className="flex flex-col gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Runs</p>
          <div className="flex flex-col gap-1.5">
            {props.availableRuns.map((run) => (
              <RunCard
                key={run.id}
                run={run}
                selected={props.selectedRunId === run.id}
                onSelect={() => props.onRunSelect(run.id)}
              />
            ))}
            <NewRunCard
              active={props.runMode === "create" && !props.selectedRunId}
              onClick={() => props.onRunModeChange("create")}
            />
          </div>
        </div>
      )}

      <div className="mt-auto">
        <Button onClick={props.onContinue} disabled={!props.canContinue} className="w-full">
          {props.runMode === "create" ? "Start analysis" : "Continue analysis"}
        </Button>
      </div>
    </div>
  );
}
