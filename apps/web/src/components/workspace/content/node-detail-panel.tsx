"use client";

import { useEffect, useRef, useState } from "react";
import {
  Save,
  Loader2,
  Hash,
  Calendar,
  NotebookPen,
  Check,
  ArrowDown,
  ArrowUp,
  ChevronDown,
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

// ── Region values renderer ────────────────────────────────────────────────────

type RegionEntry = {
  address: string;
  sheetName?: string;
  regionType: "input" | "output";
  description?: string;
  reason?: string;
  colHeaders?: string[];
  rowHeaders?: string[];
  values: unknown[][];
};

function formatCellVal(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "number") return v.toLocaleString("en-US");
  return String(v);
}

function maxCols(values: unknown[][]): number {
  return Math.max(...values.map((r) => r.filter((v) => v !== null && v !== undefined && v !== "").length));
}

// ── Narrow layout: 1-2 data columns → inline chip list, no toggle ─────────────

function NarrowInline({ region, accentText }: { region: RegionEntry; accentText: string }) {
  const [expanded, setExpanded] = useState(false);
  const cellRef = `${region.sheetName ? `${region.sheetName}!` : ""}${region.address}`;
  const count = region.values.flat().filter((v) => v !== null && v !== undefined && v !== "").length;
  const flat = region.values.flatMap((row, ri) =>
    row
      .filter((v) => v !== null && v !== undefined && v !== "")
      .map((v, ci) => ({
        label: region.rowHeaders?.[ri] ?? region.colHeaders?.[ci] ?? null,
        value: formatCellVal(v),
      })),
  );

  return (
    <div className="rounded-lg border border-border bg-card text-xs overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex flex-col gap-0.5 px-3 py-2.5 text-left hover:bg-muted/30 transition-colors"
      >
        <p className="font-medium text-foreground truncate leading-tight">
          {region.description ?? region.reason ?? cellRef}
        </p>
        <div className="flex items-center justify-between gap-1">
          <p className={cn("text-[10px] font-mono truncate", accentText)}>{cellRef}</p>
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-[10px] text-muted-foreground">{count} value{count !== 1 ? "s" : ""}</span>
            <ChevronDown className={cn("w-3 h-3 text-muted-foreground transition-transform", expanded && "rotate-180")} />
          </div>
        </div>
      </button>
      {expanded && (
        <div className="border-t border-border px-3 py-2 flex flex-wrap gap-1">
          {flat.map((item, i) => (
            <div key={i} className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted/50 border border-border/50">
              {item.label && (
                <span className="text-muted-foreground text-[9px] max-w-[60px] truncate">{item.label}</span>
              )}
              {item.label && <span className="text-muted-foreground/40 text-[8px]">·</span>}
              <span className="font-medium tabular-nums text-[10px]">{item.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Wide layout: 3+ data columns → expandable grid ───────────────────────────

function WideExpandable({ region, accentText }: { region: RegionEntry; accentText: string }) {
  const [expanded, setExpanded] = useState(false);
  const cellRef = `${region.sheetName ? `${region.sheetName}!` : ""}${region.address}`;

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden text-xs">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-muted/30 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <p className="font-medium text-foreground truncate">
            {region.description ?? region.reason ?? cellRef}
          </p>
          <p className={cn("text-[10px] font-mono mt-0.5", accentText)}>{cellRef}</p>
        </div>
        <ChevronDown
          className={cn(
            "w-3.5 h-3.5 text-muted-foreground shrink-0 transition-transform",
            expanded && "rotate-180",
          )}
        />
      </button>

      {expanded && (
        <div className="border-t border-border overflow-auto max-h-56">
          <table className="text-[11px] font-mono w-full">
            {region.colHeaders && region.colHeaders.some((h) => h !== "") && (
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  {region.rowHeaders && <th className="px-2 py-1 text-left text-muted-foreground font-medium border-r border-border/40" />}
                  {region.colHeaders.map((h, ci) => (
                    <th key={ci} className="px-2 py-1 text-right text-muted-foreground font-medium whitespace-nowrap border-r border-border/40 last:border-r-0">
                      {h || ""}
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {region.values.map((row, ri) => {
                let lastNonEmpty = row.length - 1;
                while (lastNonEmpty > 0 && (row[lastNonEmpty] === null || row[lastNonEmpty] === undefined || row[lastNonEmpty] === "")) {
                  lastNonEmpty--;
                }
                const trimmed = row.slice(0, lastNonEmpty + 1);
                return (
                  <tr key={ri} className={ri % 2 === 0 ? "bg-muted/20" : ""}>
                    {region.rowHeaders && (
                      <td className="px-2 py-0.5 text-left text-muted-foreground font-medium whitespace-nowrap border-r border-border/40 sticky left-0 bg-inherit">
                        {region.rowHeaders[ri] ?? ""}
                      </td>
                    )}
                    {trimmed.map((cell, ci) => (
                      <td key={ci} className="px-2 py-0.5 text-right tabular-nums whitespace-nowrap border-r border-border/40 last:border-r-0">
                        {cell === null || cell === undefined || cell === "" ? (
                          <span className="text-muted-foreground/30">·</span>
                        ) : (
                          String(cell)
                        )}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function RegionCard({ region, type }: { region: RegionEntry; type: "input" | "output" }) {
  const accentText = type === "input" ? "text-sky-600 dark:text-sky-400" : "text-emerald-600 dark:text-emerald-400";
  const cols = maxCols(region.values);

  // Single cell: stacked label + value, fits half-width well
  if (cols <= 1 && region.values.length === 1) {
    const cellRef = `${region.sheetName ? `${region.sheetName}!` : ""}${region.address}`;
    return (
      <div className="rounded-lg border border-border bg-card text-xs flex flex-col gap-1 px-3 py-2.5">
        <p className="font-medium text-foreground truncate leading-tight">{region.description ?? region.reason ?? cellRef}</p>
        <div className="flex items-end justify-between gap-1 min-w-0">
          <p className={cn("text-[10px] font-mono truncate", accentText)}>{cellRef}</p>
          <span className="font-semibold tabular-nums text-foreground text-sm shrink-0 leading-tight">
            {formatCellVal(region.values[0]?.[0])}
          </span>
        </div>
      </div>
    );
  }

  // Narrow (1-2 cols, multi-row): inline chip list
  if (cols <= 2) return <NarrowInline region={region} accentText={accentText} />;

  // Wide (3+ cols): expandable grid
  return <WideExpandable region={region} accentText={accentText} />;
}

const SHOW_DEFAULT = 3;

function regionPriority(r: RegionEntry): number {
  const cols = maxCols(r.values);
  const rows = r.values.length;
  // Single cell = 0 (highest), narrow column = 1, wide grid = 2
  if (cols <= 1 && rows === 1) return 0;
  if (cols <= 2) return 1;
  return 2;
}

function RegionSection({
  regions,
  type,
}: {
  regions: RegionEntry[];
  type: "input" | "output";
}) {
  const [showAll, setShowAll] = useState(false);
  const filtered = regions
    .filter((r) => r.regionType === type)
    .sort((a, b) => regionPriority(a) - regionPriority(b));

  if (filtered.length === 0) return null;

  const visible = showAll ? filtered : filtered.slice(0, SHOW_DEFAULT);
  const hidden = filtered.length - SHOW_DEFAULT;

  // Split into compact (single-cell / narrow) and wide (grids that need full width)
  const compact = visible.filter((r) => maxCols(r.values) <= 2 || r.values.length === 1);
  const wide = visible.filter((r) => maxCols(r.values) > 2 && r.values.length > 1);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {type === "input" ? (
          <ArrowDown className="w-3.5 h-3.5 text-sky-500" />
        ) : (
          <ArrowUp className="w-3.5 h-3.5 text-emerald-500" />
        )}
        {type === "input" ? "Inputs" : "Outputs"}
        <span className="ml-auto text-[10px] bg-muted px-1.5 py-0.5 rounded">{filtered.length}</span>
      </div>

      {/* Compact cards: 2-column grid */}
      {compact.length > 0 && (
        <div className="grid grid-cols-2 gap-1.5">
          {compact.map((r, i) => (
            <RegionCard key={i} region={r} type={type} />
          ))}
        </div>
      )}

      {/* Wide cards: full width */}
      {wide.length > 0 && (
        <div className="space-y-1.5">
          {wide.map((r, i) => (
            <RegionCard key={i} region={r} type={type} />
          ))}
        </div>
      )}

      {!showAll && hidden > 0 && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="w-full text-center text-[11px] text-muted-foreground hover:text-foreground transition-colors py-1"
        >
          + {hidden} more
        </button>
      )}
      {showAll && filtered.length > SHOW_DEFAULT && (
        <button
          type="button"
          onClick={() => setShowAll(false)}
          className="w-full text-center text-[11px] text-muted-foreground hover:text-foreground transition-colors py-1"
        >
          Show less
        </button>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function NodeDetailPanel({ runId, stepId }: Props) {
  const [op, setOp] = useState<Operation | null>(null);
  const [captures, setCaptures] = useState<Capture[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState<string>("");
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);
  const noteDirtyRef = useRef(false);

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

  // Load note — seed from saved note, fall back to narrative capture if note is empty
  useEffect(() => {
    let cancelled = false;
    setNote("");
    setNoteSaved(false);
    noteDirtyRef.current = false;

    trpc.operations.getOperationNote
      .query({ runId, operationId: stepId })
      .then(({ noteText }) => {
        if (cancelled) return;
        if (noteText) {
          setNote(noteText);
        } else {
          // No saved note yet — seed from the narrative capture written at save time
          trpc.operations.getOperationCaptures
            .query({ runId, operationId: stepId })
            .then(({ captures }) => {
              if (cancelled) return;
              const narrative = captures.find((c) => c.captureType === "narrative");
              const text = (narrative?.payloadJson as { text?: string } | null)?.text ?? "";
              setNote(text);
            })
            .catch(() => {});
        }
      })
      .catch(() => {});

    return () => { cancelled = true; };
  }, [runId, stepId]);

  async function saveNote() {
    setNoteSaving(true);
    try {
      await trpc.operations.setOperationNote.mutate({ runId, operationId: stepId, noteText: note });
      noteDirtyRef.current = false;
      setNoteSaved(true);
      setTimeout(() => setNoteSaved(false), 2000);
    } finally {
      setNoteSaving(false);
    }
  }

  const regionValues = captures
    ? (captures.find((c) => c.captureType === "region_values")?.payloadJson as
        | { regions?: RegionEntry[] }
        | null)?.regions ?? []
    : null;

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

        {/* Analyst note */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <NotebookPen className="w-3.5 h-3.5" />
            <span>Analyst Note</span>
          </div>
          <textarea
            value={note}
            onChange={(e) => { setNote(e.target.value); noteDirtyRef.current = true; setNoteSaved(false); }}
            placeholder="Add a note about this scenario…"
            rows={3}
            className={cn(
              "w-full resize-none rounded-md border border-border/50 bg-muted/20 px-3 py-2",
              "text-sm text-foreground placeholder:text-muted-foreground/60",
              "focus:outline-none focus:ring-1 focus:ring-ring focus:border-ring",
              "transition-colors",
            )}
          />
          <div className="flex items-center justify-end gap-2">
            {noteSaved && (
              <span className="flex items-center gap-1 text-[11px] text-emerald-600">
                <Check className="w-3 h-3" /> Saved
              </span>
            )}
            <button
              onClick={saveNote}
              disabled={noteSaving}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                "bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50",
              )}
            >
              {noteSaving
                ? <Loader2 className="w-3 h-3 animate-spin" />
                : <Save className="w-3 h-3" />}
              Save Note
            </button>
          </div>
        </div>

        <div className="border-t border-border" />

        {/* Region values — outputs first, then inputs */}
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground py-4">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-xs">Loading…</span>
          </div>
        ) : regionValues !== null && regionValues.length > 0 ? (
          <>
            <RegionSection regions={regionValues} type="output" />
            <RegionSection regions={regionValues} type="input" />
          </>
        ) : (
          <p className="text-xs text-muted-foreground italic py-2">
            No region data captured for this save yet.
          </p>
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
