"use client";

import { useEffect, useState } from "react";
import {
  Save,
  CircleDot,
  Loader2,
  FileText,
  Table2,
  ScanSearch,
  Hash,
  Calendar,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc-client";

// ── Types ─────────────────────────────────────────────────────────────────────

type Operation = {
  id: string;
  operationIndex: number;
  operationType: string;
  parametersJson: unknown;
  parentOperationId: string | null;
  supersedesOperationId: string | null;
  documentId: string | null;
  createdAt: Date;
};

type Capture = {
  id: string;
  captureType: string;
  payloadJson: unknown;
  summaryText: string | null;
  createdAt: Date;
};

type Props = {
  runId: string;
  stepId: string;  // operationId — kept as stepId for compatibility with activeView.nodeId
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDateTime(d: Date) {
  return new Date(d).toLocaleString("en-US", {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}

function opLabel(op: Operation) {
  const p = op.parametersJson as Record<string, unknown> | null;
  if (p?.label && typeof p.label === "string") return p.label;
  return op.operationType.replace(/_/g, " ");
}

// ── Capture renderers ─────────────────────────────────────────────────────────

function NarrativeCapture({ capture }: { capture: Capture }) {
  const payload = capture.payloadJson as { text?: string } | null;
  const text = payload?.text ?? capture.summaryText ?? "";
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <FileText className="w-3.5 h-3.5" />
        Narrative
      </div>
      <p className="text-sm leading-relaxed text-foreground bg-muted/30 rounded-md px-3 py-2.5 border border-border/50">
        {text || <span className="text-muted-foreground italic">No narrative recorded</span>}
      </p>
    </div>
  );
}

function OutputValuesCapture({ capture }: { capture: Capture }) {
  type OutputEntry = { address: string; label?: string; value: unknown; sheet?: string };
  const payload = capture.payloadJson as { values?: OutputEntry[] } | null;
  const values = payload?.values ?? [];

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Table2 className="w-3.5 h-3.5" />
        Output values
        <span className="ml-auto text-[10px] bg-muted px-1.5 py-0.5 rounded">{values.length}</span>
      </div>
      {values.length === 0 ? (
        <p className="text-xs text-muted-foreground italic px-1">No output values captured</p>
      ) : (
        <div className="rounded-md border border-border overflow-hidden text-xs">
          <table className="w-full">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="text-left px-3 py-1.5 text-muted-foreground font-medium">Cell</th>
                <th className="text-left px-3 py-1.5 text-muted-foreground font-medium">Label</th>
                <th className="text-right px-3 py-1.5 text-muted-foreground font-medium">Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {values.map((v, i) => (
                <tr key={i} className="hover:bg-muted/20">
                  <td className="px-3 py-1.5 font-mono text-[11px] text-muted-foreground">
                    {v.sheet ? `${v.sheet}!` : ""}{v.address}
                  </td>
                  <td className="px-3 py-1.5 text-foreground">{v.label ?? "—"}</td>
                  <td className="px-3 py-1.5 text-right font-medium tabular-nums">
                    {v.value == null ? <span className="text-muted-foreground">—</span> : String(v.value)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function DetectedRegionsCapture({ capture }: { capture: Capture }) {
  type RegionEntry = { name?: string; address?: string; type?: string; sheet?: string };
  const payload = capture.payloadJson as { regions?: RegionEntry[] } | null;
  const regions = payload?.regions ?? [];

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <ScanSearch className="w-3.5 h-3.5" />
        Detected regions
        <span className="ml-auto text-[10px] bg-muted px-1.5 py-0.5 rounded">{regions.length}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {regions.map((r, i) => (
          <div key={i} className="flex items-center gap-1 px-2 py-1 rounded-md border border-border bg-muted/30 text-xs">
            <span className="font-medium">{r.name ?? r.type ?? "Region"}</span>
            {r.address && (
              <span className="text-muted-foreground font-mono text-[10px]">
                {r.sheet ? `${r.sheet}!` : ""}{r.address}
              </span>
            )}
          </div>
        ))}
        {regions.length === 0 && (
          <p className="text-xs text-muted-foreground italic">No regions detected</p>
        )}
      </div>
    </div>
  );
}

function GenericCapture({ capture }: { capture: Capture }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <CircleDot className="w-3.5 h-3.5" />
        {capture.captureType.replace(/_/g, " ")}
      </div>
      <pre className="text-[11px] font-mono bg-muted/30 border border-border/50 rounded-md p-3 overflow-auto max-h-40 text-muted-foreground">
        {JSON.stringify(capture.payloadJson, null, 2)}
      </pre>
    </div>
  );
}

function CaptureCard({ capture }: { capture: Capture }) {
  switch (capture.captureType) {
    case "narrative":        return <NarrativeCapture capture={capture} />;
    case "output_values":    return <OutputValuesCapture capture={capture} />;
    case "detected_regions": return <DetectedRegionsCapture capture={capture} />;
    default:                 return <GenericCapture capture={capture} />;
  }
}

// ── Main component ────────────────────────────────────────────────────────────

export function NodeDetailPanel({ runId, stepId }: Props) {
  const [op, setOp] = useState<Operation | null>(null);
  const [captures, setCaptures] = useState<Capture[] | null>(null);
  const [loading, setLoading] = useState(true);

  // Load the operation details
  useEffect(() => {
    let cancelled = false;
    trpc.operations.getRunOperations.query({ runId }).then(({ operations }) => {
      if (cancelled) return;
      const found = operations.find((o) => o.id === stepId) ?? null;
      setOp(found);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [runId, stepId]);

  // Load captures
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    trpc.operations.getOperationCaptures
      .query({ runId, operationId: stepId })
      .then(({ captures }) => { if (!cancelled) setCaptures(captures); })
      .catch(() => { if (!cancelled) setCaptures([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [runId, stepId]);

  const params = op?.parametersJson as Record<string, unknown> | null;

  return (
    <div className="h-full flex flex-col overflow-hidden bg-background">
      {/* Header */}
      <div className={cn("px-5 py-4 border-b border-border shrink-0", op ? "bg-emerald-500/5" : "")}>
        {op ? (
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-emerald-500">
              <Save className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold text-sm text-foreground leading-tight">{opLabel(op)}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Scenario saved</p>
            </div>
          </div>
        ) : (
          <div className="h-10 bg-muted/50 rounded-md animate-pulse" />
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

        {/* Metadata */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <MetaCell icon={<Hash className="w-3.5 h-3.5" />} label="Operation">
            <span className="font-medium font-mono">#{op?.operationIndex ?? "—"}</span>
          </MetaCell>
          <MetaCell icon={<Calendar className="w-3.5 h-3.5" />} label="Saved at" span={2}>
            <span className="font-medium">{op ? fmtDateTime(op.createdAt) : "—"}</span>
          </MetaCell>
        </div>

        {/* Parameters */}
        {params && Object.keys(params).length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Parameters</p>
            <div className="rounded-md border border-border/50 divide-y divide-border/50 text-xs">
              {Object.entries(params).map(([k, v]) => (
                <div key={k} className="flex items-start gap-2 px-3 py-2">
                  <span className="text-muted-foreground shrink-0 font-mono">{k}</span>
                  <span className="text-foreground text-right ml-auto truncate max-w-[60%]">
                    {typeof v === "object" ? JSON.stringify(v) : String(v ?? "—")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="border-t border-border" />

        {/* Captures */}
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Captures</p>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground py-4">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-xs">Loading captures…</span>
          </div>
        ) : !captures || captures.length === 0 ? (
          <p className="text-xs text-muted-foreground italic py-2">
            No captures for this save yet. Record output values and a narrative in the Excel add-in.
          </p>
        ) : (
          <div className="space-y-4">
            {captures.map((c) => (
              <CaptureCard key={c.id} capture={c} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Helper sub-components ─────────────────────────────────────────────────────

function MetaCell({
  icon, label, children, span,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
  span?: number;
}) {
  return (
    <div className={cn(
      "flex flex-col gap-1 bg-muted/30 rounded-md px-3 py-2 border border-border/50",
      span === 2 && "col-span-2",
    )}>
      <div className="flex items-center gap-1 text-muted-foreground">
        {icon}
        <span className="text-[10px] uppercase tracking-wide">{label}</span>
      </div>
      <div className="text-xs">{children}</div>
    </div>
  );
}
