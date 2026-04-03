import { useState, useEffect, useMemo } from "react";
import { ExternalLink, FileSpreadsheet, FileText, RefreshCw, User, Clock } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { MonitoredRegion, OperationRecord, SourceDocument } from "@/features/types";
import type { SaveContext, TreeNode } from "../types";
import { RunTreeCanvas } from "../tree/RunTreeCanvas";
import { allNodes, withSkeletons } from "../tree/layout";

// ── operation detail card ─────────────────────────────────────────────────────

function OperationCard(props: {
  operation: OperationRecord;
  runId: string | undefined;
  clientId: string | undefined;
  snapshotId: string | undefined;
  webUrl: string | undefined;
  onUpdate: () => void;
}) {
  const params = props.operation.parametersJson as { label?: string; narrative?: string } | null;
  const author = props.operation.authorName;
  const savedAt = props.operation.createdAt
    ? new Date(props.operation.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
    : null;

  function openOnWeb() {
    if (!props.webUrl || !props.runId) return;
    const base = props.webUrl.replace(/\/$/, "");
    const params = new URLSearchParams({
      ...(props.clientId ? { clientId: props.clientId } : {}),
      ...(props.snapshotId ? { snapshotId: props.snapshotId } : {}),
      runId: props.runId,
      nodeId: props.operation.id,
    });
    Office.context.ui.openBrowserWindow(`${base}/workspace?${params.toString()}`);
  }

  return (
    <div className="rounded-xl border border-border bg-muted/40 px-3 py-2.5 flex flex-col gap-2">
      {/* Label + index */}
      <div className="flex items-start justify-between gap-2">
        <span className="text-[11px] font-semibold text-foreground truncate">
          {params?.label ?? "Saved"}
        </span>
        <span className="text-[8px] text-muted-foreground font-mono flex-shrink-0 mt-0.5">
          #{props.operation.operationIndex}
        </span>
      </div>

      {/* Author + date */}
      <div className="flex items-center gap-2 text-[9px] text-muted-foreground">
        {author && (
          <span className="flex items-center gap-1">
            <User className="size-2.5" />
            {author}
          </span>
        )}
        {savedAt && (
          <span className="flex items-center gap-1">
            <Clock className="size-2.5" />
            {savedAt}
          </span>
        )}
      </div>

      {/* Narrative */}
      {params?.narrative && (
        <p className="text-[10px] text-muted-foreground leading-snug border-l-2 border-border pl-2">
          {params.narrative}
        </p>
      )}

      {/* Actions */}
      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={openOnWeb}
          disabled={!props.webUrl || !props.runId}
          className="flex-1 h-7 text-[10px] rounded-lg border border-border bg-background hover:bg-muted transition-colors font-medium text-foreground flex items-center justify-center gap-1.5 disabled:opacity-40"
        >
          <ExternalLink className="size-3 text-blue-500" />
          View on web
        </button>
        <button
          type="button"
          onClick={props.onUpdate}
          className="flex-1 h-7 text-[10px] rounded-lg border border-border bg-background hover:bg-muted transition-colors font-medium text-foreground flex items-center justify-center gap-1.5"
        >
          Update
        </button>
      </div>
    </div>
  );
}

// ── save form ─────────────────────────────────────────────────────────────────

function SaveForm(props: {
  contextLabel: string;
  onSave: (narrative: string) => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const [narrative, setNarrative] = useState("");
  return (
    <div className="rounded-xl border border-border bg-muted/30 px-3 py-2.5 flex flex-col gap-2">
      <p className="text-[10px] font-medium text-foreground">{props.contextLabel}</p>
      <Textarea
        autoFocus
        value={narrative}
        onChange={(e) => setNarrative(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Escape") props.onCancel(); }}
        placeholder="e.g. Excluded 2017 cat year, blended BF/CL 50/50…"
        className="text-[10px] min-h-[60px] resize-none"
      />
      <div className="flex gap-1.5">
        <Button variant="outline" size="sm" className="flex-1 h-7 text-[10px]" onClick={props.onCancel}>
          Cancel
        </Button>
        <Button
          size="sm"
          className="flex-1 h-7 text-[10px]"
          disabled={props.isSaving}
          onClick={() => props.onSave(narrative)}
        >
          {props.isSaving ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}

// ── panel ─────────────────────────────────────────────────────────────────────

export function RunsPanel(props: {
  runId: string | undefined;
  root: TreeNode;
  operations: OperationRecord[];
  sourceDocuments: SourceDocument[];
  detectedRegions: MonitoredRegion[];
  isDetectingRegions: boolean;
  onDetectRegions: () => Promise<void>;
  onSelectRegion: (sheetName: string | undefined, address: string) => Promise<void>;
  onSaveScenario: (narrative: string, context: SaveContext) => Promise<void>;
  onSelectNode: (id: string) => void;
  clientId?: string;
  snapshotId?: string;
  webUrl?: string;
}) {
  const [anchorId, setAnchorId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [saveContext, setSaveContext] = useState<SaveContext | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [regionsExpanded, setRegionsExpanded] = useState(false);

  // Reset when run changes
  useEffect(() => {
    setAnchorId(null);
    setSelectedNodeId(null);
    setSaveContext(null);
  }, [props.runId]);

  const decoratedRoot = useMemo(
    () => withSkeletons(props.root, anchorId),
    [props.root, anchorId],
  );

  async function handleDetectRegions() {
    setIsScanning(true);
    try { await props.onDetectRegions(); } finally { setIsScanning(false); }
  }

  async function handleSave(narrative: string) {
    if (!saveContext) return;
    setIsSaving(true);
    try {
      await props.onSaveScenario(narrative, saveContext);
      setSaveContext(null);
      setSelectedNodeId(null);
    } finally {
      setIsSaving(false);
    }
  }

  function handleSelectNode(id: string) {
    const node = allNodes(decoratedRoot).find((n) => n.id === id);
    if (!node) return;

    if (id === "__skeleton_seq") {
      const parentStepId = node.parent === "ingest" ? null : node.parent;
      setSaveContext({ kind: "seq", parentStepId });
      return;
    }

    if (id === "__skeleton_par") {
      const parentStepId = node.parent === "ingest" ? null : node.parent;
      setSaveContext({ kind: "par", parentStepId });
      return;
    }

    // Real node — set anchor for skeleton placement, select it for info card
    setSaveContext(null);
    setAnchorId(id);
    setSelectedNodeId((prev) => (prev === id ? null : id));
    props.onSelectNode(id);
  }

  function handleUpdateNode(stepId: string) {
    setSaveContext({ kind: "update", stepId });
  }

  const selectedOp = selectedNodeId && selectedNodeId !== "ingest"
    ? props.operations.find((o) => o.id === selectedNodeId) ?? null
    : null;

  const saveContextLabel = saveContext?.kind === "update"
    ? "Update this save — what changed?"
    : saveContext?.kind === "par"
    ? "Save in parallel — what's different in this branch?"
    : "Save in sequence — what did you do?";

  return (
    <div className="overflow-y-auto h-full px-3 py-3 flex flex-col gap-3">

      {/* ── Source documents ── */}
      {props.sourceDocuments.length > 0 && (
        <div className="flex flex-col gap-1 flex-shrink-0">
          <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">
            Source documents
          </p>
          <div className="flex flex-wrap gap-1">
            {props.sourceDocuments.map((doc) => {
              const isPdf = doc.fileExtension?.toLowerCase() === "pdf";
              const Icon = isPdf ? FileText : FileSpreadsheet;
              const label = doc.filename.replace(/\.[^.]+$/, "");

              function openDocOnWeb() {
                if (!props.webUrl || !props.clientId || !props.snapshotId) return;
                const base = props.webUrl.replace(/\/$/, "");
                const params = new URLSearchParams({
                  documentId: doc.id,
                  snapshotId: props.snapshotId,
                  clientId: props.clientId,
                });
                Office.context.ui.openBrowserWindow(`${base}/workspace?${params.toString()}`);
              }

              return (
                <button
                  key={doc.id}
                  type="button"
                  title={doc.filename}
                  onClick={openDocOnWeb}
                  disabled={!props.webUrl || !props.clientId || !props.snapshotId}
                  className="flex items-center gap-1 px-2 py-1 rounded-md border border-border bg-background hover:bg-muted transition-colors text-left max-w-[calc(25%-3px)] min-w-0 disabled:opacity-40"
                >
                  <Icon className={cn("size-2.5 shrink-0", isPdf ? "text-slate-500" : "text-emerald-600")} />
                  <span className="text-[9px] text-foreground truncate">{label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 3 cases: save form / operation card / nothing ── */}
      {saveContext ? (
        <SaveForm
          contextLabel={saveContextLabel}
          onSave={handleSave}
          onCancel={() => setSaveContext(null)}
          isSaving={isSaving}
        />
      ) : selectedOp ? (
        <OperationCard
          operation={selectedOp}
          runId={props.runId}
          clientId={props.clientId}
          snapshotId={props.snapshotId}
          webUrl={props.webUrl}
          onUpdate={() => handleUpdateNode(selectedOp.id)}
        />
      ) : null}

{/* ── Detected regions ── */}
      {(() => {
        const inputs = props.detectedRegions.filter((r) => r.regionType === "input");
        const outputs = props.detectedRegions.filter((r) => r.regionType === "output");
        return (
          <div className="flex flex-col gap-1 flex-shrink-0">
            <div className="flex items-center gap-1.5">
              <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground flex-1">
                Detected regions
              </p>
              <button
                type="button"
                onClick={handleDetectRegions}
                disabled={isScanning || props.isDetectingRegions}
                className="flex items-center gap-1 text-[9px] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              >
                <RefreshCw className={cn("size-2.5", (isScanning || props.isDetectingRegions) && "animate-spin")} />
                {isScanning || props.isDetectingRegions ? "scanning…" : "scan"}
              </button>
            </div>
            {isScanning || props.isDetectingRegions ? (
              <p className="text-[9px] text-muted-foreground text-center py-1">Scanning workbook…</p>
            ) : props.detectedRegions.length === 0 ? (
              <p className="text-[9px] text-muted-foreground text-center py-1">No regions detected</p>
            ) : (
              <div className="grid grid-cols-2 gap-1">
                <div className="flex flex-col gap-0.5">
                  <button
                    type="button"
                    onClick={() => setRegionsExpanded((e) => !e)}
                    className="flex items-center gap-1 px-1.5 py-1 rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800"
                  >
                    <span className="text-[8px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wide flex-1">IN</span>
                    <span className="text-[9px] font-medium text-blue-700 dark:text-blue-300">{inputs.length}</span>
                  </button>
                  {regionsExpanded && inputs.map((r, i) => (
                    <button key={i} type="button" title={r.reason} onClick={() => props.onSelectRegion(r.sheetName, r.address)}
                      className="px-1.5 py-0.5 rounded border border-blue-100 dark:border-blue-900 bg-blue-50/50 text-left hover:bg-blue-100 transition-colors w-full">
                      <p className="text-[9px] font-mono text-foreground truncate">{r.address}</p>
                      {r.sheetName && <p className="text-[8px] text-muted-foreground truncate">{r.sheetName}</p>}
                    </button>
                  ))}
                </div>
                <div className="flex flex-col gap-0.5">
                  <button
                    type="button"
                    onClick={() => setRegionsExpanded((e) => !e)}
                    className="flex items-center gap-1 px-1.5 py-1 rounded-md bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800"
                  >
                    <span className="text-[8px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide flex-1">OUT</span>
                    <span className="text-[9px] font-medium text-emerald-700 dark:text-emerald-300">{outputs.length}</span>
                  </button>
                  {regionsExpanded && outputs.map((r, i) => (
                    <button key={i} type="button" title={r.reason} onClick={() => props.onSelectRegion(r.sheetName, r.address)}
                      className="px-1.5 py-0.5 rounded border border-emerald-100 dark:border-emerald-900 bg-emerald-50/50 text-left hover:bg-emerald-100 transition-colors w-full">
                      <p className="text-[9px] font-mono text-foreground truncate">{r.address}</p>
                      {r.sheetName && <p className="text-[8px] text-muted-foreground truncate">{r.sheetName}</p>}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* ── Run history tree ── */}
      <div className="flex flex-col gap-2 flex-shrink-0">
        <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">
          Run history
        </p>
        <RunTreeCanvas
          root={decoratedRoot}
          initialSelectedId="ingest"
          onSelectNode={handleSelectNode}
        />
      </div>

    </div>
  );
}
