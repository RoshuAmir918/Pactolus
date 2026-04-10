"use client";

import { useEffect, useState, useCallback } from "react";
import { useAtomValue, useAtom, useSetAtom } from "jotai";
import { Save, Loader2, Database } from "lucide-react";
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeProps,
  BackgroundVariant,
} from "@xyflow/react";
import { cn } from "@/lib/utils";
import { activeViewAtom, activeNodeIdAtom, compareNodeIdsAtom, type ActiveView } from "@/stores/workspace-ui";
import { trpc } from "@/lib/trpc-client";
import { buildBranchStyleMap, type BranchStyle } from "@shared/workspace/run-tree/branch-styles";

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

type NodeData = {
  label: string;
  meta: string;
  branchRootId: string;
  isIngest: boolean;
  op: Operation | null;
  branchStyle: BranchStyle | null;
};


// ── Layout ────────────────────────────────────────────────────────────────────

const NW = 160;
const NH = 44;
const SIBLING = 16;
const LEVEL = 80;

type LayoutNode = {
  id: string;
  label: string;
  meta: string;
  branchRootId: string;
  isIngest: boolean;
  op: Operation | null;
  children: LayoutNode[];
  lx: number;
  ly: number;
};

function subtreeH(node: LayoutNode): number {
  if (!node.children.length) return NH;
  return Math.max(NH, node.children.reduce((s, c) => s + subtreeH(c), 0) + SIBLING * (node.children.length - 1));
}

function assignPos(node: LayoutNode, x: number, y: number) {
  const sh = subtreeH(node);
  node.lx = x;
  node.ly = y + sh / 2;
  let cy = y;
  for (const c of node.children) {
    assignPos(c, x + NW + LEVEL, cy);
    cy += subtreeH(c) + SIBLING;
  }
}

function buildLayoutTree(operations: Operation[]): LayoutNode {
  const ingest: LayoutNode = { id: "ingest", label: "Ingest", meta: "source data", branchRootId: "ingest", isIngest: true, op: null, children: [], lx: 0, ly: 0 };
  const nodeById = new Map<string, LayoutNode>();
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
    const meta = op.createdAt ? new Date(op.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "";
    const parent = op.parentOperationId ? (nodeById.get(op.parentOperationId) ?? ingest) : ingest;
    const node: LayoutNode = {
      op, id: op.id, label, meta,
      branchRootId: parent.id === "ingest" ? op.id : parent.branchRootId,
      isIngest: false, children: [], lx: 0, ly: 0,
    };
    nodeById.set(op.id, node);
    parent.children.push(node);
  }

  assignPos(ingest, 0, 0);
  return ingest;
}

function allLayoutNodes(node: LayoutNode, acc: LayoutNode[] = []): LayoutNode[] {
  acc.push(node);
  node.children.forEach((c) => allLayoutNodes(c, acc));
  return acc;
}

function toReactFlow(root: LayoutNode): { nodes: Node<NodeData>[]; edges: Edge[] } {
  const allNodes = allLayoutNodes(root);
  const branchStyleMap = buildBranchStyleMap(allNodes);
  const nodes: Node<NodeData>[] = allNodes.map((n) => ({
    id: n.id,
    type: "scenarioNode",
    position: { x: n.lx, y: n.ly - NH / 2 },
    data: {
      label: n.label,
      meta: n.meta,
      branchRootId: n.branchRootId,
      isIngest: n.isIngest,
      op: n.op,
      branchStyle: branchStyleMap.get(n.branchRootId) ?? null,
    },
    draggable: false,
    style: { width: NW, height: NH },
  }));

  const edges: Edge[] = [];
  for (const n of allNodes) {
    for (const child of n.children) {
      edges.push({
        id: `${n.id}->${child.id}`,
        source: n.id,
        target: child.id,
        type: "smoothstep",
        style: { stroke: branchStyleMap.get(child.branchRootId)?.edge ?? "hsl(var(--border))", strokeWidth: 2, strokeOpacity: 0.85 },
        animated: false,
      });
    }
  }

  return { nodes, edges };
}

// ── Custom node ───────────────────────────────────────────────────────────────

function ScenarioNode({ data }: NodeProps & { data: NodeData }) {
  const activeNodeId = useAtomValue(activeNodeIdAtom);
  const compareNodeIds = useAtomValue(compareNodeIdsAtom);
  const isActive = activeNodeId === data.op?.id;
  const compareIdx = data.op ? compareNodeIds.indexOf(data.op.id) : -1;
  const isInCompare = compareIdx !== -1;
  const { branchStyle, isIngest } = data;

  return (
    <>
      <Handle type="target" position={Position.Left} style={{ opacity: 0, pointerEvents: "none" }} />
      <div
        className={cn(
          "w-full h-full rounded-xl border shadow-sm text-xs font-medium flex items-center gap-2 px-3 transition-all select-none",
          isIngest
            ? "bg-muted/50 border-border text-muted-foreground cursor-default"
            : isInCompare
            ? "bg-primary/10 border-primary text-foreground ring-1 ring-primary/40 cursor-pointer"
            : isActive
            ? (branchStyle?.active ?? "bg-primary border-primary text-primary-foreground")
            : cn(
                "bg-card text-card-foreground cursor-pointer",
                branchStyle?.border ?? "border-border",
                branchStyle?.hover ?? "hover:bg-muted/40",
              ),
        )}
      >
        {isInCompare ? (
          <span className="h-4 w-4 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center shrink-0">
            {compareIdx + 1}
          </span>
        ) : !isIngest ? (
          <span className={cn("h-2.5 w-2.5 rounded-full shrink-0", branchStyle?.dot ?? "bg-primary", isActive && "bg-white/90")} />
        ) : null}
        {isIngest
          ? <Database className="w-3.5 h-3.5 shrink-0" />
          : <Save className={cn("w-3.5 h-3.5 shrink-0", !isActive && !isInCompare && (branchStyle?.text ?? "text-muted-foreground"))} />}
        <span className="truncate flex-1 text-left">{data.label}</span>
        {!isIngest && data.meta && (
          <span className={cn("text-[10px] tabular-nums shrink-0", isActive ? "text-white/90" : "text-muted-foreground")}>
            {data.meta}
          </span>
        )}
      </div>
      <Handle type="source" position={Position.Right} style={{ opacity: 0, pointerEvents: "none" }} />
    </>
  );
}

const nodeTypes = { scenarioNode: ScenarioNode };

// ── Main component ────────────────────────────────────────────────────────────

type LoadState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; nodes: Node<NodeData>[]; edges: Edge[]; count: number };

export function BottomRunTree() {
  const activeView = useAtomValue(activeViewAtom);
  const [activeNodeId, setActiveNodeId] = useAtom(activeNodeIdAtom);
  const setActiveView = useSetAtom(activeViewAtom);
  const [compareNodeIds, setCompareNodeIds] = useAtom(compareNodeIdsAtom);
  const [loadState, setLoadState] = useState<LoadState>({ status: "idle" });
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<NodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

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
        const root = buildLayoutTree(operations);
        const { nodes: rfNodes, edges: rfEdges } = toReactFlow(root);
        const count = allLayoutNodes(root).filter((n) => n.id !== "ingest").length;
        setNodes(rfNodes);
        setEdges(rfEdges);
        setLoadState({ status: "ready", nodes: rfNodes, edges: rfEdges, count });
      })
      .catch((err) => {
        if (!cancelled)
          setLoadState({ status: "error", message: err instanceof Error ? err.message : "Failed." });
      });
    return () => { cancelled = true; };
  }, [runId, setNodes, setEdges]);

  const handleNodeClick = useCallback((_: React.MouseEvent, node: Node<NodeData>) => {
    const { data } = node;
    if (data.isIngest || !data.op) return;

    const isMulti = (_ as React.MouseEvent).metaKey || (_ as React.MouseEvent).ctrlKey;
    if (isMulti) {
      setCompareNodeIds((prev) => {
        if (prev.includes(data.op!.id)) return prev.filter((id) => id !== data.op!.id);
        if (prev.length >= 3) return prev;
        return [...prev, data.op!.id];
      });
      return;
    }

    setCompareNodeIds([]);
    const toggling = activeNodeId === data.op.id;
    setActiveNodeId(toggling ? null : data.op.id);
    if (!toggling && activeView.type !== "home" && activeView.type !== "snapshot") {
      const base = activeView as Extract<ActiveView, { runId: string }>;
      setActiveView({ type: "node", clientId: base.clientId, snapshotId: base.snapshotId, runId: base.runId, nodeId: data.op.id });
    } else if (toggling && activeView.type === "node") {
      const base = activeView as Extract<ActiveView, { runId: string }>;
      setActiveView({ type: "run", clientId: base.clientId, snapshotId: base.snapshotId, runId: base.runId });
    }
  }, [activeNodeId, activeView, setActiveNodeId, setActiveView, setCompareNodeIds]);

  if (!runId || loadState.status === "idle")
    return <Placeholder text="Select a run to view its history" />;
  if (loadState.status === "loading")
    return <Placeholder loading text="Loading run history…" />;
  if (loadState.status === "error")
    return <Placeholder text={loadState.message} error />;

  const count = loadState.count;

  if (count === 0)
    return <Placeholder text="No saves recorded for this run yet" />;

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div className="flex items-center gap-2 px-4 py-1.5 border-b border-border shrink-0">
        <Save className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Run History</span>
        <span className="text-xs text-muted-foreground ml-auto">{count} save{count !== 1 ? "s" : ""}</span>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={handleNodeClick}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.3}
          maxZoom={1.5}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={16} size={1} className="opacity-30" />
          <Controls showInteractive={false} className="[&>button]:bg-background [&>button]:border-border [&>button]:text-foreground" />
        </ReactFlow>
      </div>
    </div>
  );
}

function Placeholder({ text, loading, error }: { text: string; loading?: boolean; error?: boolean }) {
  return (
    <div className="h-full flex items-center justify-center gap-2">
      {loading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
      <p className={cn("text-xs", error ? "text-destructive" : "text-muted-foreground")}>{text}</p>
    </div>
  );
}
