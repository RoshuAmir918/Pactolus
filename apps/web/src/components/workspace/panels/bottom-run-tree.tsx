"use client";

import { useEffect, useState } from "react";
import { useAtomValue, useAtom, useSetAtom } from "jotai";
import { Save, Loader2, Database } from "lucide-react";
import { cn } from "@/lib/utils";
import { activeViewAtom, activeNodeIdAtom, type ActiveView } from "@/stores/workspace-ui";
import { trpc } from "@/lib/trpc-client";

// ── Layout constants (left-to-right) ─────────────────────────────────────────
//   lx = horizontal position (depth axis)
//   ly = vertical position   (sibling axis)

const NW      = 152;  // node width
const NH      = 44;   // node height
const SIBLING = 16;   // vertical gap between siblings
const LEVEL   = 72;   // horizontal gap between parent and child
const PADDING = 16;

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

type TreeNode = {
  op: Operation | null;
  id: string;
  label: string;
  meta: string;
  branchRootId: string;
  children: TreeNode[];
  lx: number;
  ly: number;
};

// ── Tree building ─────────────────────────────────────────────────────────────

function buildTree(operations: Operation[]): TreeNode {
  const ingest: TreeNode = {
    op: null,
    id: "ingest",
    label: "Ingest",
    meta: "source data",
    branchRootId: "ingest",
    children: [],
    lx: 0,
    ly: 0,
  };
  const nodeById = new Map<string, TreeNode>();
  nodeById.set("ingest", ingest);

  const supersededIds = new Set(operations.map((o) => o.supersedesOperationId).filter(Boolean) as string[]);
  const parentIds = new Set(operations.map((o) => o.parentOperationId).filter(Boolean) as string[]);
  const mustKeep = new Set([...parentIds].filter((id) => supersededIds.has(id)));

  const visible = operations
    .filter((o) => o.operationType === "scenario_snapshot" && (!supersededIds.has(o.id) || mustKeep.has(o.id)))
    .sort((a, b) => a.operationIndex - b.operationIndex);

  for (const op of visible) {
    const p = op.parametersJson as { label?: string } | null;
    const label = p?.label ?? "Saved";
    const meta = op.createdAt
      ? new Date(op.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })
      : "";
    const parent = op.parentOperationId ? (nodeById.get(op.parentOperationId) ?? ingest) : ingest;
    const node: TreeNode = {
      op,
      id: op.id,
      label,
      meta,
      branchRootId: parent.id === "ingest" ? op.id : parent.branchRootId,
      children: [],
      lx: 0,
      ly: 0,
    };
    nodeById.set(op.id, node);
    parent.children.push(node);
  }

  assignPos(ingest, 0, 0);
  return ingest;
}

// In LR layout, "subtreeH" is the vertical span of a subtree
function subtreeH(node: TreeNode): number {
  if (!node.children.length) return NH;
  return Math.max(NH, node.children.reduce((s, c) => s + subtreeH(c), 0) + SIBLING * (node.children.length - 1));
}

// x = depth (horizontal), y = top of this node's subtree slot
function assignPos(node: TreeNode, x: number, y: number) {
  const sh = subtreeH(node);
  node.lx = x;
  node.ly = y + sh / 2;   // center of this subtree
  let cy = y;
  for (const c of node.children) {
    assignPos(c, x + NW + LEVEL, cy);
    cy += subtreeH(c) + SIBLING;
  }
}

function allNodes(node: TreeNode, acc: TreeNode[] = []): TreeNode[] {
  acc.push(node);
  node.children.forEach((c) => allNodes(c, acc));
  return acc;
}

type BranchStyle = {
  dot: string;
  text: string;
  border: string;
  hover: string;
  active: string;
  edge: string;
};

const pastelBranchStyles: BranchStyle[] = [
  { dot: "bg-emerald-400", text: "text-emerald-700 dark:text-emerald-300", border: "border-emerald-300/80 dark:border-emerald-800/80", hover: "hover:bg-emerald-50/70 dark:hover:bg-emerald-950/35", active: "bg-emerald-500 border-emerald-500 text-white", edge: "#6ee7b7" },
  { dot: "bg-sky-400", text: "text-sky-700 dark:text-sky-300", border: "border-sky-300/80 dark:border-sky-800/80", hover: "hover:bg-sky-50/70 dark:hover:bg-sky-950/35", active: "bg-sky-500 border-sky-500 text-white", edge: "#7dd3fc" },
  { dot: "bg-violet-400", text: "text-violet-700 dark:text-violet-300", border: "border-violet-300/80 dark:border-violet-800/80", hover: "hover:bg-violet-50/70 dark:hover:bg-violet-950/35", active: "bg-violet-500 border-violet-500 text-white", edge: "#c4b5fd" },
  { dot: "bg-amber-400", text: "text-amber-700 dark:text-amber-300", border: "border-amber-300/80 dark:border-amber-800/80", hover: "hover:bg-amber-50/70 dark:hover:bg-amber-950/35", active: "bg-amber-500 border-amber-500 text-white", edge: "#fcd34d" },
  { dot: "bg-rose-400", text: "text-rose-700 dark:text-rose-300", border: "border-rose-300/80 dark:border-rose-800/80", hover: "hover:bg-rose-50/70 dark:hover:bg-rose-950/35", active: "bg-rose-500 border-rose-500 text-white", edge: "#fda4af" },
  { dot: "bg-cyan-400", text: "text-cyan-700 dark:text-cyan-300", border: "border-cyan-300/80 dark:border-cyan-800/80", hover: "hover:bg-cyan-50/70 dark:hover:bg-cyan-950/35", active: "bg-cyan-500 border-cyan-500 text-white", edge: "#67e8f9" },
  { dot: "bg-lime-400", text: "text-lime-700 dark:text-lime-300", border: "border-lime-300/80 dark:border-lime-800/80", hover: "hover:bg-lime-50/70 dark:hover:bg-lime-950/35", active: "bg-lime-500 border-lime-500 text-white", edge: "#bef264" },
  { dot: "bg-fuchsia-400", text: "text-fuchsia-700 dark:text-fuchsia-300", border: "border-fuchsia-300/80 dark:border-fuchsia-800/80", hover: "hover:bg-fuchsia-50/70 dark:hover:bg-fuchsia-950/35", active: "bg-fuchsia-500 border-fuchsia-500 text-white", edge: "#f0abfc" },
];

function buildBranchStyleMap(nodes: TreeNode): Map<string, BranchStyle>;
function buildBranchStyleMap(nodes: TreeNode[]): Map<string, BranchStyle>;
function buildBranchStyleMap(nodes: TreeNode | TreeNode[]): Map<string, BranchStyle> {
  const list = Array.isArray(nodes) ? nodes : [nodes];
  const map = new Map<string, BranchStyle>();
  let idx = 0;

  for (const node of list) {
    const branchRootId = node.branchRootId;
    if (branchRootId === "ingest" || map.has(branchRootId)) continue;
    map.set(branchRootId, pastelBranchStyles[idx % pastelBranchStyles.length]);
    idx += 1;
  }

  return map;
}

// ── Component ─────────────────────────────────────────────────────────────────

type LoadState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; root: TreeNode; count: number };

export function BottomRunTree() {
  const activeView = useAtomValue(activeViewAtom);
  const [activeNodeId, setActiveNodeId] = useAtom(activeNodeIdAtom);
  const setActiveView = useSetAtom(activeViewAtom);
  const [loadState, setLoadState] = useState<LoadState>({ status: "idle" });

  const runId =
    activeView.type === "run" || activeView.type === "node"
      ? (activeView as { runId: string }).runId
      : null;

  useEffect(() => {
    if (!runId) { setLoadState({ status: "idle" }); return; }
    let cancelled = false;
    setLoadState({ status: "loading" });
    trpc.operations.getRunOperations.query({ runId })
      .then(({ operations }) => {
        if (cancelled) return;
        const root = buildTree(operations);
        const count = allNodes(root).filter((n) => n.id !== "ingest").length;
        setLoadState({ status: "ready", root, count });
      })
      .catch((err) => {
        if (!cancelled)
          setLoadState({ status: "error", message: err instanceof Error ? err.message : "Failed." });
      });
    return () => { cancelled = true; };
  }, [runId]);

  if (!runId || loadState.status === "idle")
    return <Placeholder text="Select a run to view its history" />;
  if (loadState.status === "loading")
    return <Placeholder loading text="Loading run history…" />;
  if (loadState.status === "error")
    return <Placeholder text={loadState.message} error />;

  const { root, count } = loadState;
  const nodes = allNodes(root);
  const branchStyleByRoot = buildBranchStyleMap(nodes);

  // Canvas dimensions
  const maxX = Math.max(...nodes.map((n) => n.lx)) + NW;
  const maxY = Math.max(...nodes.map((n) => n.ly)) + NH / 2;
  const totalW = maxX + PADDING * 2;
  const totalH = maxY + PADDING;

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-1.5 border-b border-border shrink-0">
        <Save className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Run History</span>
        <span className="text-xs text-muted-foreground ml-auto">{count} save{count !== 1 ? "s" : ""}</span>
      </div>

      {count === 0 ? (
        <Placeholder text="No saves recorded for this run yet" />
      ) : (
        <div style={{ flex: 1, overflow: "auto" }}>
          <div style={{ position: "relative", width: totalW, height: Math.max(totalH, 80) }}>

            {/* SVG edges */}
            <svg
              style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
              width={totalW}
              height={Math.max(totalH, 80)}
            >
              {nodes.map((node) =>
                node.children.map((child) => {
                  // parent right-center → child left-center
                  const x1 = node.lx + PADDING + NW;
                  const y1 = node.ly + PADDING;
                  const x2 = child.lx + PADDING;
                  const y2 = child.ly + PADDING;
                  const mx = (x1 + x2) / 2;
                  return (
                    <path
                      key={child.id}
                      d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`}
                      fill="none"
                      stroke={branchStyleByRoot.get(child.branchRootId)?.edge ?? "hsl(var(--border))"}
                      strokeOpacity={0.85}
                      strokeWidth={2}
                    />
                  );
                }),
              )}
            </svg>

            {/* Nodes */}
            {nodes.map((node) => {
              const isActive = activeNodeId === node.id;
              const isIngest = node.id === "ingest";
              const branchStyle = branchStyleByRoot.get(node.branchRootId) ?? null;
              const left = node.lx + PADDING;
              const top  = node.ly + PADDING - NH / 2;

              return (
                <button
                  key={node.id}
                  disabled={isIngest}
                  onClick={() => {
                    if (isIngest || !node.op) return;
                    const toggling = isActive;
                    setActiveNodeId(toggling ? null : node.id);
                    if (!toggling && activeView.type !== "home" && activeView.type !== "snapshot") {
                      const base = activeView as Extract<ActiveView, { runId: string }>;
                      setActiveView({ type: "node", clientId: base.clientId, snapshotId: base.snapshotId, runId: base.runId, nodeId: node.id });
                    } else if (toggling && activeView.type === "node") {
                      const base = activeView as Extract<ActiveView, { runId: string }>;
                      setActiveView({ type: "run", clientId: base.clientId, snapshotId: base.snapshotId, runId: base.runId });
                    }
                  }}
                  style={{ position: "absolute", left, top, width: NW, height: NH }}
                  className={cn(
                    "rounded-xl border shadow-sm text-xs font-medium flex items-center gap-2 px-3 transition-all",
                    isIngest
                      ? "bg-muted/50 border-border text-muted-foreground cursor-default"
                      : isActive
                      ? (branchStyle?.active ?? "bg-primary border-primary text-primary-foreground")
                      : cn(
                          "bg-card text-card-foreground cursor-pointer",
                          branchStyle?.border ?? "border-border",
                          branchStyle?.hover ?? "hover:bg-muted/40",
                        ),
                  )}
                >
                  {!isIngest && (
                    <span
                      className={cn(
                        "h-2.5 w-2.5 rounded-full shrink-0",
                        branchStyle?.dot ?? "bg-primary",
                        isActive && "bg-white/90",
                      )}
                    />
                  )}
                  {isIngest
                    ? <Database className="w-3.5 h-3.5 shrink-0" />
                    : <Save className={cn("w-3.5 h-3.5 shrink-0", !isActive && (branchStyle?.text ?? "text-muted-foreground"))} />}
                  <span className="truncate flex-1 text-left">{node.label}</span>
                  {!isIngest && (
                    <span
                      className={cn(
                        "text-[10px] tabular-nums shrink-0",
                        isActive ? "text-white/90" : "text-muted-foreground",
                      )}
                    >
                      {node.meta}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Placeholder ───────────────────────────────────────────────────────────────

function Placeholder({ text, loading, error }: { text: string; loading?: boolean; error?: boolean }) {
  return (
    <div className="h-full flex items-center justify-center gap-2">
      {loading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
      <p className={cn("text-xs", error ? "text-destructive" : "text-muted-foreground")}>{text}</p>
    </div>
  );
}
