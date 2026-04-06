"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, GitCompare, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc-client";

// ── Types ─────────────────────────────────────────────────────────────────────

type RegionEntry = {
  address: string;
  sheetName?: string;
  regionType: "input" | "output";
  description?: string;
  reason?: string;
  values: unknown[][];
};

type NodeInfo = {
  id: string;
  label: string;
  date: string;
};

type DiffRow = {
  key: string;
  reason: string;
  type: "input" | "output";
  vals: (string | null)[];
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatVal(values: unknown[][]): string {
  const flat = values.flat().filter((v) => v !== null && v !== "" && v !== undefined);
  if (values.length === 1 && values[0].length === 1) return String(values[0][0] ?? "");
  const nums = flat.map(Number).filter((n) => !isNaN(n));
  if (nums.length > 0 && nums.length === flat.length)
    return nums.reduce((a, b) => a + b, 0).toLocaleString("en-US");
  return flat.slice(0, 3).map(String).join(", ");
}

// ── Component ─────────────────────────────────────────────────────────────────

type Props = {
  runId: string;
  operationIds: string[];
  onClear: () => void;
};

export function NodeComparePanel({ runId, operationIds, onClear }: Props) {
  const [nodes, setNodes] = useState<NodeInfo[]>([]);
  const [diffs, setDiffs] = useState<DiffRow[] | null>(null);
  const [narrative, setNarrative] = useState<string | null>(null);
  const [narrativeLoading, setNarrativeLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const idsKey = operationIds.join(",");
  const narrativeFiredRef = useRef<string | null>(null);

  useEffect(() => {
    if (operationIds.length < 2) return;
    let cancelled = false;
    setLoading(true);
    setDiffs(null);
    setNarrative(null);
    narrativeFiredRef.current = null;

    async function load() {
      const [opsResult, captureResults] = await Promise.all([
        trpc.operations.getRunOperations.query({ runId }),
        Promise.all(
          operationIds.map((id) =>
            trpc.operations.getOperationCaptures.query({ runId, operationId: id }),
          ),
        ),
      ]);
      if (cancelled) return;

      const nodeInfos: NodeInfo[] = operationIds.map((id) => {
        const op = opsResult.operations.find((o) => o.id === id);
        const p = op?.parametersJson as Record<string, unknown> | null;
        return {
          id,
          label: (typeof p?.label === "string" ? p.label : null) ?? "Saved",
          date: op
            ? new Date(op.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })
            : "",
        };
      });
      setNodes(nodeInfos);

      // Extract region_values captures per op
      const regionsByOp: RegionEntry[][] = captureResults.map((r) => {
        const capture = r.captures.find((c) => c.captureType === "region_values");
        return (capture?.payloadJson as { regions?: RegionEntry[] } | null)?.regions ?? [];
      });

      // Build diff map keyed by sheet|address
      const regionMap = new Map<
        string,
        { reason: string; type: "input" | "output"; vals: (unknown[][] | null)[] }
      >();

      regionsByOp.forEach((regions, i) => {
        for (const r of regions) {
          const key = `${r.sheetName ?? ""}|${r.address}`;
          if (!regionMap.has(key)) {
            regionMap.set(key, {
              reason: r.description ?? r.reason ?? `${r.sheetName ? `${r.sheetName}!` : ""}${r.address}`,
              type: r.regionType,
              vals: Array(operationIds.length).fill(null),
            });
          }
          regionMap.get(key)!.vals[i] = r.values;
        }
      });

      const diffRows: DiffRow[] = [];
      for (const [key, data] of regionMap) {
        if (data.vals.filter((v) => v !== null).length < 2) continue;
        const serialized = data.vals.map((v) => (v !== null ? JSON.stringify(v) : null));
        const nonNull = serialized.filter(Boolean);
        if (nonNull.every((s) => s === nonNull[0])) continue;

        diffRows.push({
          key,
          reason: data.reason,
          type: data.type,
          vals: data.vals.map((v) => (v !== null ? formatVal(v) : null)),
        });
      }

      setDiffs(diffRows);
      setLoading(false);
    }

    load().catch(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId, idsKey]);

  // Fire AI narrative once diffs are ready (only if there are actual diffs)
  useEffect(() => {
    if (!diffs || diffs.length === 0) return;
    if (narrativeFiredRef.current === idsKey) return;
    narrativeFiredRef.current = idsKey;

    let cancelled = false;
    setNarrativeLoading(true);
    setNarrative(null);
    trpc.operations.analyzeComparison
      .mutate({ runId, operationIds })
      .then(({ narrative }) => {
        if (!cancelled) setNarrative(narrative);
      })
      .catch((err) => {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : "Analysis failed.";
          setNarrative(msg);
        }
      })
      .finally(() => {
        if (!cancelled) setNarrativeLoading(false);
      });
    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diffs, idsKey]);

  const inputDiffs = diffs?.filter((d) => d.type === "input") ?? [];
  const outputDiffs = diffs?.filter((d) => d.type === "output") ?? [];

  return (
    <div className="h-full flex flex-col overflow-hidden bg-background">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border shrink-0 flex items-center gap-3">
        <div className="p-2 rounded-lg border border-border bg-muted/40 text-muted-foreground">
          <GitCompare className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-sm">
            Comparing {operationIds.length} scenario{operationIds.length !== 1 ? "s" : ""}
          </h2>
          <p className="text-xs text-muted-foreground">Cmd/Ctrl+click nodes to add or remove</p>
        </div>
        <button
          onClick={onClear}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-muted/50"
        >
          <X className="w-3.5 h-3.5" />
          Clear
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        {/* Node pills */}
        {nodes.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {nodes.map((n, i) => (
              <div
                key={n.id}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-muted/30 text-xs"
              >
                <span className="h-4 w-4 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center shrink-0">
                  {i + 1}
                </span>
                <span className="font-medium">{n.label}</span>
                {n.date && <span className="text-muted-foreground">{n.date}</span>}
              </div>
            ))}
          </div>
        )}

        {loading && (
          <div className="flex items-center gap-2 text-muted-foreground py-6 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-xs">Loading captures…</span>
          </div>
        )}

        {!loading && diffs !== null && diffs.length === 0 && (
          <p className="text-xs text-muted-foreground italic py-4 text-center">
            No differences detected between these scenarios.
          </p>
        )}

        {/* AI Narrative */}
        {!loading && diffs !== null && diffs.length > 0 && (narrativeLoading || narrative) && (
          <div className="bg-muted/20 border border-border rounded-lg px-3 py-2.5 min-h-[40px]">
            {narrativeLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span className="text-xs">Generating analysis…</span>
              </div>
            ) : (
              <p className="text-sm leading-relaxed text-foreground">{narrative}</p>
            )}
          </div>
        )}

        {/* Input diffs */}
        {inputDiffs.length > 0 && (
          <DiffTable
            title="Input changes"
            type="input"
            rows={inputDiffs}
            nodeLabels={nodes.map((n) => n.label)}
          />
        )}

        {/* Output diffs */}
        {outputDiffs.length > 0 && (
          <DiffTable
            title="Output changes"
            type="output"
            rows={outputDiffs}
            nodeLabels={nodes.map((n) => n.label)}
          />
        )}
      </div>
    </div>
  );
}

// ── Diff table ────────────────────────────────────────────────────────────────

function DiffTable({
  title,
  type,
  rows,
  nodeLabels,
}: {
  title: string;
  type: "input" | "output";
  rows: DiffRow[];
  nodeLabels: string[];
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {type === "input" ? (
          <ArrowDown className="w-3.5 h-3.5 text-sky-500" />
        ) : (
          <ArrowUp className="w-3.5 h-3.5 text-emerald-500" />
        )}
        {title}
        <span className="ml-auto text-[10px] bg-muted px-1.5 py-0.5 rounded">{rows.length}</span>
      </div>
      <div className="rounded-md border border-border overflow-hidden text-xs">
        <table className="w-full">
          <thead>
            <tr className="bg-muted/50 border-b border-border">
              <th className="text-left px-3 py-1.5 text-muted-foreground font-medium">Region</th>
              {nodeLabels.map((l, i) => (
                <th key={i} className="text-right px-3 py-1.5 text-muted-foreground font-medium">
                  <span className="inline-flex items-center justify-end gap-1">
                    <span className="h-3.5 w-3.5 rounded-full bg-primary text-primary-foreground text-[8px] font-bold flex items-center justify-center">
                      {i + 1}
                    </span>
                    {l}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr key={row.key} className="hover:bg-muted/20">
                <td className="px-3 py-2 text-foreground font-medium">{row.reason}</td>
                {row.vals.map((v, i) => (
                  <td
                    key={i}
                    className={cn(
                      "px-3 py-2 text-right tabular-nums",
                      v === null ? "text-muted-foreground" : "font-medium",
                    )}
                  >
                    {v ?? "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
