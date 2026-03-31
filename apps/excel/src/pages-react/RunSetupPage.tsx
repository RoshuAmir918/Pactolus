import type { ClientOption, RunOption, SnapshotOption } from "@/features/types";
import { StepLayout } from "@/components/shell/step-layout";
import { StatusBanner } from "@/components/shell/status-banner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ── colour palette (mirrors workspace canvas) ─────────────────────────────────

const C = {
  done:    "#3B6D11",
  active:  "#185FA5",
  branch:  "#854F0B",
  future:  "#b8b6ae",
  dimText: "#9c9a90",
  line:    "#dddcd4",
  lineHi:  "#bdd7ee",
  bg:      "#f4f3ee",
};

type RunStatus = "draft" | "running" | "awaiting_confirmation" | "ready" | "failed" | "locked";

function statusColor(status: RunStatus | string): string {
  if (status === "running") return C.active;
  if (status === "ready" || status === "locked") return C.done;
  if (status === "failed") return "#b91c1c";
  if (status === "archived") return C.future;
  return C.dimText;
}

function statusLabel(status: RunStatus | string): string {
  if (status === "awaiting_confirmation") return "awaiting";
  return status;
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));
}

// ── shared tree connector ─────────────────────────────────────────────────────

function TreeConnector(props: { last?: boolean; highlight?: boolean }) {
  return (
    <div className="relative flex flex-col items-center" style={{ width: 24, minWidth: 24 }}>
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-px"
        style={{
          height: props.last ? "50%" : "100%",
          background: props.highlight ? C.lineHi : C.line,
        }}
      />
    </div>
  );
}

// ── node dot ──────────────────────────────────────────────────────────────────

function NodeDot(props: { color: string; ring?: boolean; hollow?: boolean }) {
  return (
    <div
      className="relative shrink-0 rounded-full"
      style={{
        width: 10,
        height: 10,
        background: props.hollow ? "white" : props.color,
        border: `1.5px solid ${props.color}`,
        boxShadow: props.ring ? `0 0 0 3px ${props.color}22` : undefined,
      }}
    />
  );
}

// ── client/snapshot pill ──────────────────────────────────────────────────────

function PickerRow(props: {
  dotColor: string;
  label: string;
  sublabel?: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={cn(
        "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border text-left transition-colors",
        props.selected
          ? "border-slate-700 bg-slate-800 text-white"
          : "border-slate-200 bg-white text-slate-800 hover:border-slate-400",
      )}
    >
      <NodeDot color={props.selected ? "white" : props.dotColor} ring={props.selected} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-tight truncate">{props.label}</p>
        {props.sublabel && (
          <p className={cn("text-xs leading-tight mt-0.5 truncate", props.selected ? "text-white/60" : "text-slate-400")}>
            {props.sublabel}
          </p>
        )}
      </div>
    </button>
  );
}

// ── tree section header ────────────────────────────────────────────────────────

function TreeSectionLabel(props: { label: string; locked?: boolean }) {
  return (
    <p
      className={cn(
        "text-[10px] font-semibold uppercase tracking-widest mb-1.5",
        props.locked ? "text-slate-300" : "text-slate-400",
      )}
    >
      {props.label}
    </p>
  );
}

// ── run node card ─────────────────────────────────────────────────────────────

function RunNode(props: {
  run: RunOption;
  selected: boolean;
  selectedBranchName: string | null;
  onSelect: () => void;
  isLast: boolean;
}) {
  const color = statusColor(props.run.status);

  return (
    <div className="flex gap-0">
      {/* tree line column */}
      <div className="flex flex-col items-center" style={{ width: 24, minWidth: 24 }}>
        <div className="w-px flex-1" style={{ background: C.line }} />
        {!props.isLast && <div className="w-px flex-1" style={{ background: C.line }} />}
      </div>

      {/* horizontal branch line */}
      <div className="flex items-center" style={{ height: 48 }}>
        <div className="w-3 h-px" style={{ background: C.line }} />
      </div>

      {/* node card */}
      <div className="flex-1 py-1 pr-1">
        <button
          type="button"
          onClick={props.onSelect}
          className={cn(
            "w-full flex items-start gap-2 px-3 py-2 rounded-lg border text-left transition-colors",
            props.selected
              ? "border-slate-700 bg-slate-800 text-white"
              : "border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50",
          )}
        >
          <div className="pt-1">
            <NodeDot
              color={props.selected ? "white" : color}
              hollow={props.run.status === "draft"}
              ring={props.selected}
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-sm font-medium leading-tight">{props.run.name}</span>
              <span
                className="text-[10px] px-1.5 py-0.5 rounded-full"
                style={{
                  background: props.selected ? "rgba(255,255,255,0.15)" : `${color}18`,
                  color: props.selected ? "rgba(255,255,255,0.8)" : color,
                }}
              >
                {statusLabel(props.run.status)}
              </span>
            </div>
            <div className={cn("flex items-center gap-2 mt-0.5", props.selected ? "text-white/50" : "text-slate-400")}>
              <span className="text-xs">{props.run.createdByName}</span>
              <span className="text-[10px]">·</span>
              <span className="text-xs">{formatDate(props.run.createdAt)}</span>
            </div>
            {props.selected && props.selectedBranchName && (
              <div className="mt-1 flex items-center gap-1">
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/15 text-white/70">
                  branch: {props.selectedBranchName}
                </span>
              </div>
            )}
          </div>
        </button>
      </div>
    </div>
  );
}

// ── new-run node ───────────────────────────────────────────────────────────────

function NewRunNode(props: { active: boolean; onClick: () => void }) {
  return (
    <div className="flex gap-0">
      <div className="flex flex-col items-center" style={{ width: 24, minWidth: 24 }}>
        <div className="w-px" style={{ height: "50%", background: C.line }} />
      </div>
      <div className="flex items-center" style={{ height: 40 }}>
        <div className="w-3 h-px" style={{ background: C.line }} />
      </div>
      <div className="flex-1 py-1 pr-1">
        <button
          type="button"
          onClick={props.onClick}
          className={cn(
            "w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-left text-sm transition-colors",
            props.active
              ? "border-slate-700 bg-slate-800 text-white"
              : "border-dashed border-slate-300 bg-white text-slate-500 hover:border-slate-400 hover:text-slate-700",
          )}
        >
          <div
            className="w-2.5 h-2.5 rounded-full border-2 shrink-0"
            style={{ borderColor: props.active ? "white" : C.future, borderStyle: "dashed" }}
          />
          <span className={props.active ? "text-white font-medium" : "font-normal"}>Start new analysis</span>
        </button>
      </div>
    </div>
  );
}

// ── root snapshot node ────────────────────────────────────────────────────────

function SnapshotRootNode(props: {
  label: string;
  period?: string | null;
  onChange: () => void;
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 text-white mb-0">
      <NodeDot color="white" ring />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold leading-tight truncate">{props.label}</p>
        {props.period && <p className="text-xs text-white/50 leading-tight">{props.period}</p>}
      </div>
      <button
        type="button"
        onClick={props.onChange}
        className="text-[11px] text-white/40 hover:text-white/70 shrink-0"
      >
        change
      </button>
    </div>
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
  selectedBranchName: string | null;
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
    <StepLayout stepLabel="Step 2 of 3" title="Open analysis" subtitle="Choose a snapshot to continue or start fresh.">
      <StatusBanner status={props.status} />

      <div
        className="rounded-xl border border-slate-200 overflow-hidden"
        style={{ background: C.bg }}
      >
        <div className="p-3 space-y-3">

          {/* ── Client ───────────────────────────────────────── */}
          {!hasClient && (
            <div>
              <TreeSectionLabel label="Client" />
              {props.availableClients.length === 0 ? (
                <div className="text-sm text-slate-500 flex items-center gap-1.5">
                  No clients.{" "}
                  <button
                    type="button"
                    onClick={props.onReloadContext}
                    className="underline underline-offset-2 text-slate-700"
                  >
                    Refresh
                  </button>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {props.availableClients.map((client) => (
                    <PickerRow
                      key={client.id}
                      dotColor={C.done}
                      label={client.name}
                      selected={false}
                      onClick={() => props.onClientSelect(client.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Snapshot ─────────────────────────────────────── */}
          {hasClient && !hasSnapshot && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <TreeSectionLabel label={`${selectedClient?.name ?? "Client"} · snapshots`} />
                <button
                  type="button"
                  onClick={() => props.onClientSelect("")}
                  className="text-[11px] text-slate-400 hover:text-slate-600"
                >
                  ← back
                </button>
              </div>
              {props.availableSnapshots.length === 0 ? (
                <p className="text-sm text-slate-400">No snapshots for this client.</p>
              ) : (
                <div className="space-y-1.5">
                  {props.availableSnapshots.map((snapshot) => (
                    <PickerRow
                      key={snapshot.id}
                      dotColor={C.active}
                      label={snapshot.label}
                      sublabel={snapshot.accountingPeriod ?? undefined}
                      selected={false}
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

          {/* ── Tree: snapshot root → runs → branches ────────── */}
          {hasSnapshot && (
            <div>
              <SnapshotRootNode
                label={selectedSnapshot?.label ?? props.snapshotId}
                period={selectedSnapshot?.accountingPeriod}
                onChange={() => props.onSnapshotIdChange("")}
              />

              {/* existing runs */}
              {props.availableRuns.map((run, i) => {
                const isSelected = props.selectedRunId === run.id;
                const isLast = i === props.availableRuns.length - 1;
                return (
                  <RunNode
                    key={run.id}
                    run={run}
                    selected={isSelected}
                    selectedBranchName={isSelected ? props.selectedBranchName : null}
                    onSelect={() => props.onRunSelect(run.id)}
                    isLast={isLast}
                  />
                );
              })}

              {/* new analysis node always at the bottom */}
              <NewRunNode
                active={props.runMode === "create" && !props.selectedRunId}
                onClick={() => props.onRunModeChange("create")}
              />
            </div>
          )}
        </div>
      </div>

      {props.runSummary && (
        <p className="text-xs text-slate-400 px-1">{props.runSummary}</p>
      )}

      <Button onClick={props.onContinue} disabled={!props.canContinue} className="w-full">
        {props.runMode === "create" ? "Start analysis" : "Continue analysis"}
      </Button>
    </StepLayout>
  );
}
