import { useState, useEffect, useMemo } from "react";
import { FileSpreadsheet, FileText, GitBranch, CheckCircle, RefreshCw, ChevronDown } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { MonitoredRegion, SourceDocument, StepRecord } from "@/features/types";
import type { TreeNode } from "../types";
import { RunTreeCanvas } from "../tree/RunTreeCanvas";
import { allNodes, withSkeletons } from "../tree/layout";

// ── step detail card ──────────────────────────────────────────────────────────

function StepDetailCard(props: {
  step: StepRecord;
  onOpenWorkbook: (documentId: string) => void;
}) {
  const params = props.step.parametersJson as { toolName?: string; note?: string } | null;
  return (
    <div className="rounded-xl border border-border bg-muted/40 px-3 py-2.5 flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="text-[11px] font-medium text-foreground truncate">
            {params?.toolName ?? "Operation"}
          </span>
          {params?.note && (
            <span className="text-[10px] text-muted-foreground leading-snug">{params.note}</span>
          )}
        </div>
        <span className="text-[8px] text-muted-foreground font-mono flex-shrink-0 mt-0.5">
          step {props.step.stepIndex}
        </span>
      </div>
      {props.step.documentId ? (
        <button
          type="button"
          onClick={() => props.onOpenWorkbook(props.step.documentId!)}
          className="w-full h-7 text-[10px] rounded-lg border border-border bg-background hover:bg-muted transition-colors font-medium text-foreground flex items-center justify-center gap-1.5"
        >
          <FileSpreadsheet className="size-3 text-emerald-600" />
          Open workbook snapshot
        </button>
      ) : (
        <p className="text-[9px] text-muted-foreground text-center py-0.5">
          No workbook snapshot for this step
        </p>
      )}
    </div>
  );
}

// ── panel ─────────────────────────────────────────────────────────────────────

export function RunsPanel(props: {
  activeBranchName: string;
  runId: string | undefined;
  canNewScenario: boolean;
  onNewScenario: (name: string) => Promise<void>;
  onSaveScenario: (narrative: string) => Promise<void>;
  root: TreeNode;
  committedOperations: StepRecord[];
  sourceDocuments: SourceDocument[];
  detectedRegions: MonitoredRegion[];
  isDetectingRegions: boolean;
  onDetectRegions: () => Promise<void>;
  onSelectRegion: (sheetName: string | undefined, address: string) => Promise<void>;
  onSelectNode: (id: string, branchId?: string) => void;
  onOpenWorkbook: (documentId: string) => void;
  onOpenDocument: (documentId: string, fileExtension: string | null) => void;
}) {
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [regionsExpanded, setRegionsExpanded] = useState(false);
  const [isCreatingScenario, setIsCreatingScenario] = useState(false);
  const [scenarioName, setScenarioName] = useState("");
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [narrative, setNarrative] = useState("");
  const [isFinalizing, setIsFinalizing] = useState(false);

  const decoratedRoot = useMemo(() => withSkeletons(props.root), [props.root]);

  useEffect(() => {
    setIsCreatingScenario(false);
    setScenarioName("");
    setIsSaveModalOpen(false);
    setNarrative("");
    setSelectedStepId(null);
  }, [props.activeBranchName]);

  async function handleDetectRegions() {
    setIsScanning(true);
    try {
      await props.onDetectRegions();
    } finally {
      setIsScanning(false);
    }
  }

  async function handleNewScenario() {
    const name = scenarioName.trim();
    if (!name) return;
    setIsCreatingScenario(false);
    setScenarioName("");
    await props.onNewScenario(name);
  }

  async function handleSave() {
    setIsSaveModalOpen(false);
    setIsFinalizing(true);
    try {
      await props.onSaveScenario(narrative);
    } finally {
      setIsFinalizing(false);
      setNarrative("");
    }
  }
  const selectedStep = selectedStepId
    ? props.committedOperations.find((s) => s.id === selectedStepId) ?? null
    : null;

  function handleSelectNode(id: string, branchId?: string) {
    // Skeleton node clicks open the appropriate form
    if (id === "__skeleton_append") {
      setIsSaveModalOpen(true);
      return;
    }
    if (id === "__skeleton_branch") {
      setIsCreatingScenario(true);
      return;
    }

    const isStep = props.committedOperations.some((s) => s.id === id);
    if (isStep) {
      setSelectedStepId((prev) => (prev === id ? null : id));
      return;
    }
    setSelectedStepId(null);
    // If clicking a saved branch node, open its snapshot instead of switching
    const treeNode = allNodes(props.root).find((n) => n.id === id);
    if (treeNode?.tone === "saved" && treeNode.documentId) {
      props.onOpenWorkbook(treeNode.documentId);
      return;
    }
    props.onSelectNode(id, branchId);
  }

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
              return (
                <button
                  key={doc.id}
                  type="button"
                  title={doc.filename}
                  onClick={() => props.onOpenDocument(doc.id, doc.fileExtension)}
                  className="flex items-center gap-1 px-2 py-1 rounded-md border border-border bg-background hover:bg-muted transition-colors text-left max-w-[calc(25%-3px)] min-w-0"
                >
                  <Icon className={cn("size-2.5 shrink-0", isPdf ? "text-slate-500" : "text-emerald-600")} />
                  <span className="text-[9px] text-foreground truncate">{label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Active scenario card ── */}
      <div className="rounded-xl border border-border bg-muted/30 overflow-hidden flex-shrink-0">
        {/* Header row */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
          <span className="size-1.5 rounded-full bg-blue-500 animate-pulse shrink-0" />
          <span className="text-[11px] font-medium text-foreground truncate flex-1">
            {props.activeBranchName}
          </span>
          <span className="text-[9px] font-mono text-muted-foreground shrink-0">
            {props.runId?.slice(0, 8) ?? "—"}
          </span>
        </div>

        {isCreatingScenario ? (
          /* Inline scenario name form */
          <div className="flex flex-col gap-2 px-3 py-2">
            <input
              autoFocus
              value={scenarioName}
              onChange={(e) => setScenarioName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleNewScenario();
                if (e.key === "Escape") { setIsCreatingScenario(false); setScenarioName(""); }
              }}
              placeholder="Scenario name…"
              className="text-[11px] w-full rounded-lg border border-border bg-background px-2.5 py-1.5 focus:outline-none focus:border-blue-400 text-foreground placeholder:text-muted-foreground"
            />
            <div className="flex gap-1.5">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 h-7 text-[10px]"
                onClick={() => { setIsCreatingScenario(false); setScenarioName(""); }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="flex-1 h-7 text-[10px] gap-1"
                onClick={handleNewScenario}
                disabled={!scenarioName.trim()}
              >
                <GitBranch className="size-3" />
                Create
              </Button>
            </div>
          </div>
        ) : isSaveModalOpen ? (
          /* Save narrative modal */
          <div className="flex flex-col gap-2 px-3 py-2">
            <p className="text-[10px] font-medium text-foreground">What did you assume in this scenario?</p>
            <p className="text-[9px] text-muted-foreground leading-snug">Focus on what's different from the base — method choices, excluded years, judgment calls.</p>
            <Textarea
              autoFocus
              value={narrative}
              onChange={(e) => setNarrative(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") { setIsSaveModalOpen(false); setNarrative(""); }
              }}
              placeholder="e.g. Excluded 2017 cat year, blended BF/CL 50/50 for immature AYs, used industry tail…"
              className="text-[10px] min-h-[72px] resize-none"
            />
            <div className="flex gap-1.5">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 h-7 text-[10px]"
                onClick={() => { setIsSaveModalOpen(false); setNarrative(""); }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="flex-1 h-7 text-[10px] gap-1"
                onClick={handleSave}
              >
                <CheckCircle className="size-3" />
                Save
              </Button>
            </div>
          </div>
        ) : (
          /* Actions */
          <div className="flex gap-1.5 px-3 py-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 h-7 text-[10px] gap-1"
              onClick={() => setIsCreatingScenario(true)}
              disabled={!props.canNewScenario}
            >
              <GitBranch className="size-3" />
              New Scenario
            </Button>
            <Button
              size="sm"
              className="flex-1 h-7 text-[10px] gap-1"
              onClick={() => setIsSaveModalOpen(true)}
              disabled={!props.canNewScenario || isFinalizing}
            >
              <CheckCircle className="size-3" />
              {isFinalizing ? "Saving…" : "Save"}
            </Button>
          </div>
        )}
      </div>

      {/* ── Detected regions ── */}
      {(() => {
        const inputs = props.detectedRegions.filter((r) => r.regionType === "input");
        const outputs = props.detectedRegions.filter((r) => r.regionType === "output");
        return (
          <div className="flex flex-col gap-1 flex-shrink-0">
            <div className="flex items-center gap-1.5">
              <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground flex-1">Detected regions</p>
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
                {/* Inputs column */}
                <div className="flex flex-col gap-0.5">
                  <button
                    type="button"
                    onClick={() => setRegionsExpanded((e) => !e)}
                    className="flex items-center gap-1 px-1.5 py-1 rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-left"
                  >
                    <span className="text-[8px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wide flex-1">IN</span>
                    <span className="text-[9px] font-medium text-blue-700 dark:text-blue-300">{inputs.length}</span>
                    <ChevronDown className={cn("size-2.5 text-blue-400 transition-transform", regionsExpanded && "rotate-180")} />
                  </button>
                  {regionsExpanded && inputs.map((r, i) => (
                    <button key={i} type="button" title={r.reason} onClick={() => props.onSelectRegion(r.sheetName, r.address)} className="px-1.5 py-0.5 rounded border border-blue-100 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/20 text-left hover:bg-blue-100 dark:hover:bg-blue-950/40 transition-colors w-full">
                      <p className="text-[9px] font-mono text-foreground truncate">{r.address}</p>
                      {r.sheetName && <p className="text-[8px] text-muted-foreground truncate">{r.sheetName}</p>}
                    </button>
                  ))}
                </div>

                {/* Outputs column */}
                <div className="flex flex-col gap-0.5">
                  <button
                    type="button"
                    onClick={() => setRegionsExpanded((e) => !e)}
                    className="flex items-center gap-1 px-1.5 py-1 rounded-md bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-left"
                  >
                    <span className="text-[8px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide flex-1">OUT</span>
                    <span className="text-[9px] font-medium text-emerald-700 dark:text-emerald-300">{outputs.length}</span>
                    <ChevronDown className={cn("size-2.5 text-emerald-400 transition-transform", regionsExpanded && "rotate-180")} />
                  </button>
                  {regionsExpanded && outputs.map((r, i) => (
                    <button key={i} type="button" title={r.reason} onClick={() => props.onSelectRegion(r.sheetName, r.address)} className="px-1.5 py-0.5 rounded border border-emerald-100 dark:border-emerald-900 bg-emerald-50/50 dark:bg-emerald-950/20 text-left hover:bg-emerald-100 dark:hover:bg-emerald-950/40 transition-colors w-full">
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
          initialSelectedId="active"
          onSelectNode={handleSelectNode}
        />
        {selectedStep && (
          <StepDetailCard step={selectedStep} onOpenWorkbook={props.onOpenWorkbook} />
        )}
      </div>

    </div>
  );
}
