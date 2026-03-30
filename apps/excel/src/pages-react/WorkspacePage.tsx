import { useEffect, useRef, useCallback, useState } from "react";
import { ArrowUp, Cog, FileSpreadsheet, FileText } from "lucide-react";
import type { BranchOption, RunSession } from "@/features/types";
import { StatusBanner } from "@/components/shell/status-banner";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

// ── tree types ────────────────────────────────────────────────────────────────

type NodeTone = "done" | "active" | "branch" | "future";

interface TreeNode {
  id: string;
  label: string;
  meta: string;
  tone: NodeTone;
  parent: string | null;
  branchId?: string;
  children: TreeNode[];
  lx: number;
  ly: number;
}

// ── layout ────────────────────────────────────────────────────────────────────

const NW = 88;
const NH = 26;
const HGAP = 10;
const VGAP = 42;
const PADDING = 14;

function subtreeW(node: TreeNode): number {
  if (!node.children.length) return NW;
  return Math.max(
    NW,
    node.children.reduce((s, c) => s + subtreeW(c), 0) +
      HGAP * (node.children.length - 1)
  );
}

function assignPos(node: TreeNode, x: number, y: number): void {
  const sw = subtreeW(node);
  node.lx = x + sw / 2;
  node.ly = y;
  let cx = x;
  for (const c of node.children) {
    const csw = subtreeW(c);
    assignPos(c, cx, y + VGAP);
    cx += csw + HGAP;
  }
}

function allNodes(node: TreeNode, acc: TreeNode[] = []): TreeNode[] {
  acc.push(node);
  node.children.forEach((c) => allNodes(c, acc));
  return acc;
}

function pathTo(
  targetId: string,
  node: TreeNode,
  path: TreeNode[] = []
): TreeNode[] | null {
  if (node.id === targetId) return [...path, node];
  for (const c of node.children) {
    const r = pathTo(targetId, c, [...path, node]);
    if (r) return r;
  }
  return null;
}

function buildTree(
  runSession: RunSession,
  branches: BranchOption[],
  canCompleteBranch: boolean
): TreeNode {
  const make = (
    id: string,
    label: string,
    meta: string,
    tone: NodeTone,
    parent: string | null,
    branchId?: string
  ): TreeNode => ({ id, label, meta, tone, parent, branchId, children: [], lx: 0, ly: 0 });

  const activeBranch = branches.find((b) => b.id === runSession.branchId);
  const others = branches.filter((b) => b.id !== runSession.branchId);

  const ingest = make("ingest", "Ingest", "auto", "done", null);
  const active = make(
    "active",
    activeBranch?.name ?? "Current operation",
    `run ${runSession.runId?.slice(0, 8) ?? "—"}`,
    "active",
    "ingest"
  );

  const branchNodes: TreeNode[] = others.map((b) =>
    make(b.id, b.name, b.status ?? "branch", "branch", "active", b.id)
  );

  if (canCompleteBranch) {
    branchNodes.push(make("__next", "+ next run", "", "future", "active"));
  }

  active.children = branchNodes;
  ingest.children = [active];
  assignPos(ingest, 0, 0);
  return ingest;
}

// ── colours ───────────────────────────────────────────────────────────────────

function getColors(dark: boolean) {
  return {
    bg:        dark ? "#1c1c1a" : "#f4f3ee",
    nodeBg:    dark ? "#262624" : "#ffffff",
    nodeHov:   dark ? "#2e2e2c" : "#ebebE6",
    nodeDim:   dark ? "#1e1e1c" : "#f8f7f3",
    border:    dark ? "#38382e" : "#d4d2c5",
    borderDim: dark ? "#2a2a26" : "#e4e2d8",
    done:      dark ? "#22863a" : "#3B6D11",
    active:    "#185FA5",
    branch:    dark ? "#a0650a" : "#854F0B",
    future:    dark ? "#444440" : "#b8b6ae",
    text:      dark ? "#c2c0b6" : "#2d2d2a",
    textDim:   dark ? "#58564e" : "#b8b6ae",
    textSub:   dark ? "#6e6c64" : "#9c9a90",
    line:      dark ? "#2e2e28" : "#dddcd4",
    lineHi:    dark ? "#1a3a5c" : "#bdd7ee",
    lineFut:   dark ? "#2a2a26" : "#e0dfd6",
  };
}

function nodeColor(
  tone: NodeTone,
  C: ReturnType<typeof getColors>
): string {
  if (tone === "done") return C.done;
  if (tone === "active") return C.active;
  if (tone === "branch") return C.branch;
  return C.future;
}

function truncate(s: string, max: number) {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

// ── canvas draw ───────────────────────────────────────────────────────────────

function drawScene(
  ctx: CanvasRenderingContext2D,
  nodes: TreeNode[],
  root: TreeNode,
  selectedId: string,
  hoverId: string | null,
  vpX: number,
  vpY: number,
  padX: number,
  padY: number,
  CW: number,
  CH: number,
  dark: boolean
) {
  const C = getColors(dark);
  ctx.clearRect(0, 0, CW, CH);
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, CW, CH);

  const onPath = new Set((pathTo(selectedId, root) ?? []).map((n) => n.id));
  const tx = padX - vpX;
  const ty = padY - vpY;

  ctx.save();
  ctx.translate(tx, ty);

  // edges
  for (const node of nodes) {
    for (const child of node.children) {
      const x1 = node.lx, y1 = node.ly + NH / 2;
      const x2 = child.lx, y2 = child.ly - NH / 2;
      const my = (y1 + y2) / 2;
      const onThisPath = onPath.has(node.id) && onPath.has(child.id);

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.bezierCurveTo(x1, my, x2, my, x2, y2);

      if (child.tone === "future") {
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = C.lineFut;
        ctx.lineWidth = 0.5;
      } else if (onThisPath) {
        ctx.setLineDash([]);
        ctx.strokeStyle = C.lineHi;
        ctx.lineWidth = 1.5;
      } else {
        ctx.setLineDash([]);
        ctx.strokeStyle = C.line;
        ctx.lineWidth = 0.5;
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  // nodes
  for (const node of nodes) {
    const nx = node.lx - NW / 2;
    const ny = node.ly - NH / 2;
    const isSelected = node.id === selectedId;
    const isOnPath = onPath.has(node.id);
    const isHov = node.id === hoverId;
    const isDim = !isOnPath && !isSelected;

    ctx.beginPath();
    ctx.roundRect(nx, ny, NW, NH, 5);
    ctx.fillStyle = isHov ? C.nodeHov : isDim ? C.nodeDim : C.nodeBg;
    ctx.fill();

    ctx.setLineDash([]);
    if (isSelected) {
      ctx.strokeStyle = nodeColor(node.tone, C);
      ctx.lineWidth = 1.5;
    } else if (node.tone === "future") {
      ctx.setLineDash([2, 2]);
      ctx.strokeStyle = C.borderDim;
      ctx.lineWidth = 0.5;
    } else if (isDim) {
      ctx.strokeStyle = C.borderDim;
      ctx.lineWidth = 0.5;
    } else {
      ctx.strokeStyle = nodeColor(node.tone, C);
      ctx.lineWidth = 1;
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // dot
    const dr = 3;
    const dx = nx + 8;
    const dy = node.ly - 2;
    ctx.beginPath();
    ctx.arc(dx, dy, dr, 0, Math.PI * 2);

    if (node.tone === "done" || node.tone === "active") {
      ctx.fillStyle = isDim ? C.textDim : nodeColor(node.tone, C);
      ctx.fill();
      if (node.tone === "active" && !isDim) {
        ctx.beginPath();
        ctx.arc(dx, dy, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = "#fff";
        ctx.fill();
      }
    } else if (node.tone === "branch") {
      ctx.strokeStyle = isDim ? C.textDim : nodeColor(node.tone, C);
      ctx.lineWidth = 1.2;
      ctx.stroke();
    } else {
      ctx.setLineDash([2, 2]);
      ctx.strokeStyle = C.textDim;
      ctx.lineWidth = 0.8;
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // label
    ctx.font = `${isSelected ? "500" : "400"} 9px system-ui,sans-serif`;
    ctx.fillStyle = isDim ? C.textDim : C.text;
    ctx.textBaseline = "middle";
    ctx.fillText(truncate(node.label, 10), nx + 15, node.ly - 2);

    if (node.meta) {
      ctx.font = "400 7.5px system-ui,sans-serif";
      ctx.fillStyle = isDim ? C.textDim : C.textSub;
      ctx.fillText(truncate(node.meta, 12), nx + 15, node.ly + 7);
    }
  }

  ctx.restore();
}

// ── RunTreeCanvas ─────────────────────────────────────────────────────────────

function RunTreeCanvas(props: {
  root: TreeNode;
  initialSelectedId: string;
  onSelectNode: (id: string, branchId?: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({
    vpX: 0, vpY: 0,
    targetVpX: 0, targetVpY: 0,
    selectedId: props.initialSelectedId,
    hoverId: null as string | null,
    rafId: null as number | null,
    padX: 0, padY: 0,
    minX: 0, maxX: 0, minY: 0, maxY: 0,
    CW: 0, CH: 0,
    touchStartX: 0, touchStartY: 0, swept: false,
  });

  const nodes = allNodes(props.root);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const s = stateRef.current;
    const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const dpr = window.devicePixelRatio || 1;
    drawScene(ctx, nodes, props.root, s.selectedId, s.hoverId,
      s.vpX, s.vpY, s.padX, s.padY, s.CW / dpr, s.CH / dpr, dark);
  }, [nodes, props.root]);

  function clampVp(tx: number, ty: number) {
    const s = stateRef.current;
    const dpr = window.devicePixelRatio || 1;
    const CW = s.CW / dpr, CH = s.CH / dpr;
    const treeLeft   = s.padX + s.minX;
    const treeRight  = s.padX + s.maxX;
    const treeTop    = s.padY + s.minY;
    const treeBottom = s.padY + s.maxY;

    return {
      x: Math.min(Math.max(tx, treeLeft - PADDING), Math.max(0, treeRight - CW + PADDING)),
      y: Math.min(Math.max(ty, treeTop - PADDING),  Math.max(0, treeBottom - CH + PADDING)),
    };
  }

  function animateVp() {
    const s = stateRef.current;
    if (s.rafId) cancelAnimationFrame(s.rafId);
    function step() {
      const dx = s.targetVpX - s.vpX;
      const dy = s.targetVpY - s.vpY;
      if (Math.abs(dx) < 0.3 && Math.abs(dy) < 0.3) {
        s.vpX = s.targetVpX; s.vpY = s.targetVpY;
        redraw(); return;
      }
      s.vpX += dx * 0.14;
      s.vpY += dy * 0.14;
      redraw();
      s.rafId = requestAnimationFrame(step);
    }
    s.rafId = requestAnimationFrame(step);
  }

  function snapTo(id: string) {
    const node = nodes.find((n) => n.id === id);
    if (!node) return;
    const s = stateRef.current;
    const dpr = window.devicePixelRatio || 1;
    const CW = s.CW / dpr, CH = s.CH / dpr;
    const idealX = node.lx + s.padX - CW / 2;
    const idealY = node.ly + s.padY - CH * 0.42;
    const { x, y } = clampVp(idealX, idealY);
    s.targetVpX = x; s.targetVpY = y;
    animateVp();
  }

  function selectNode(id: string) {
    const s = stateRef.current;
    if (id === s.selectedId) return;
    s.selectedId = id;
    const node = nodes.find((n) => n.id === id);
    props.onSelectNode(id, node?.branchId);
    snapTo(id);
  }

  function nodeAt(mx: number, my: number): TreeNode | undefined {
    const s = stateRef.current;
    const tx = s.padX - s.vpX;
    const ty = s.padY - s.vpY;
    return nodes.find(
      (n) =>
        mx >= n.lx - NW / 2 + tx && mx <= n.lx + NW / 2 + tx &&
        my >= n.ly - NH / 2 + ty && my <= n.ly + NH / 2 + ty
    );
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const CW = 256, CH = 210;
    canvas.width = CW * dpr; canvas.height = CH * dpr;
    canvas.style.width = `${CW}px`; canvas.style.height = `${CH}px`;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.scale(dpr, dpr);

    const ns = allNodes(props.root);
    const minX = Math.min(...ns.map((n) => n.lx)) - NW / 2;
    const maxX = Math.max(...ns.map((n) => n.lx)) + NW / 2;
    const minY = Math.min(...ns.map((n) => n.ly)) - NH / 2;
    const maxY = Math.max(...ns.map((n) => n.ly)) + NH / 2;
    const treeW = maxX - minX;

    const s = stateRef.current;
    s.CW = CW * dpr; s.CH = CH * dpr;
    s.minX = minX; s.maxX = maxX; s.minY = minY; s.maxY = maxY;
    s.padX = (CW - treeW) / 2 - minX;
    s.padY = 16 - minY;

    redraw();
    snapTo(props.initialSelectedId);
  }, [props.root]);

  function onMouseMove(e: React.MouseEvent) {
    const r = canvasRef.current!.getBoundingClientRect();
    const n = nodeAt(e.clientX - r.left, e.clientY - r.top);
    const newHov = n?.id ?? null;
    const s = stateRef.current;
    if (newHov !== s.hoverId) {
      s.hoverId = newHov;
      if (canvasRef.current)
        canvasRef.current.style.cursor = newHov ? "pointer" : "default";
      redraw();
    }
  }

  function onClick(e: React.MouseEvent) {
    const r = canvasRef.current!.getBoundingClientRect();
    const n = nodeAt(e.clientX - r.left, e.clientY - r.top);
    if (n) selectNode(n.id);
  }

  function onTouchStart(e: React.TouchEvent) {
    const s = stateRef.current;
    s.touchStartX = e.touches[0].clientX;
    s.touchStartY = e.touches[0].clientY;
    s.swept = false;
  }

  function onTouchMove(e: React.TouchEvent) {
    const s = stateRef.current;
    if (Math.abs(e.touches[0].clientX - s.touchStartX) > 10) s.swept = true;
  }

  function onTouchEnd(e: React.TouchEvent) {
    const s = stateRef.current;
    const dx = e.changedTouches[0].clientX - s.touchStartX;
    const dy = Math.abs(e.changedTouches[0].clientY - s.touchStartY);
    if (s.swept && Math.abs(dx) > 30 && dy < 50) {
      const sel = nodes.find((n) => n.id === s.selectedId);
      if (!sel?.parent) return;
      const parent = nodes.find((n) => n.id === sel.parent);
      if (!parent) return;
      const sibs = parent.children;
      const idx = sibs.findIndex((n) => n.id === s.selectedId);
      const next = dx < 0 ? sibs[idx + 1] : sibs[idx - 1];
      if (next) selectNode(next.id);
    } else if (!s.swept) {
      const r = canvasRef.current!.getBoundingClientRect();
      const n = nodeAt(
        e.changedTouches[0].clientX - r.left,
        e.changedTouches[0].clientY - r.top
      );
      if (n) selectNode(n.id);
    }
  }

  return (
    <div className="rounded-lg overflow-hidden" style={{ background: "var(--color-background-secondary, #f4f3ee)" }}>
      <canvas
        ref={canvasRef}
        style={{ display: "block" }}
        onMouseMove={onMouseMove}
        onMouseLeave={() => { stateRef.current.hoverId = null; redraw(); }}
        onClick={onClick}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      />
    </div>
  );
}

// ── WorkspacePage ─────────────────────────────────────────────────────────────

export function WorkspacePage(props: {
  runSession: RunSession;
  availableBranches: BranchOption[];
  status: { kind: "ok" | "error"; message: string } | null;
  canFork: boolean;
  canCompleteBranch: boolean;
  onBackToRun: () => void;
  onSelectBranch: (branchId: string) => void;
  onDeleteBranch: (branchId: string) => Promise<void> | void;
  onForkBranch: () => Promise<void> | void;
  onCompleteBranch: () => Promise<void> | void;
}) {
  const activeBranch = props.availableBranches.find(
    (b) => b.id === props.runSession.branchId
  );

  const [viewingId, setViewingId] = useState<string>("active");

  const root = buildTree(
    props.runSession,
    props.availableBranches,
    props.canCompleteBranch
  );

  const allNodesList = allNodes(root);
  const viewingNode = allNodesList.find((n) => n.id === viewingId);

  function handleSelectNode(id: string, branchId?: string) {
    setViewingId(id);
    if (branchId) props.onSelectBranch(branchId);
  }

  return (
    <div className="min-h-screen bg-background">
      <StatusBanner status={props.status} />

      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
        <span className="text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">
          Pactolus
        </span>
        <div className="flex gap-1.5">
          <button
            type="button"
            className="rounded-md border border-border p-1.5 text-muted-foreground hover:bg-muted transition-colors"
            title="Settings"
          >
            <Cog className="size-3.5" />
          </button>
          <button
            type="button"
            className="rounded-md border border-border p-1.5 text-muted-foreground hover:bg-muted transition-colors"
            title="Upload"
          >
            <ArrowUp className="size-3.5" />
          </button>
        </div>
      </div>

      {/* Source documents */}
      <div className="px-4 pt-3 pb-3 border-b border-border">
        <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
          Source documents
        </p>
        <div className="grid grid-cols-4 gap-1.5">
          <SourceDoc label="Loss triangles" ext="xlsx" />
          <SourceDoc label="Claims" ext="xlsx" />
          <SourceDoc label="Policies" ext="xlsx" />
          <SourceDoc label="Treaty" ext="pdf" />
        </div>
      </div>

      {/* Active operation card */}
      <div className="mx-3 my-2.5 rounded-lg border-2 border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/40 overflow-hidden">
        <div className="flex items-center justify-between px-3 pt-2.5 pb-1">
          <span className="text-[9px] font-semibold uppercase tracking-widest text-blue-600 dark:text-blue-400">
            Current operation
          </span>
          <span className="flex items-center gap-1.5 text-[9px] text-blue-500">
            <span className="size-1.5 rounded-full bg-blue-500 animate-pulse" />
            active
          </span>
        </div>
        <p className="px-3 text-[14px] font-medium text-blue-800 dark:text-blue-200 leading-snug">
          {activeBranch?.name ?? "Current operation"}
        </p>
        <p className="px-3 pb-2 text-[10px] text-blue-500 dark:text-blue-400 opacity-80">
          {`run ${props.runSession.runId?.slice(0, 8) ?? "—"}`}
        </p>
        <div className="flex gap-1.5 border-t border-blue-200 dark:border-blue-800 px-3 py-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 h-6 text-[10px] border-blue-200 dark:border-blue-700"
            onClick={props.onForkBranch}
            disabled={!props.canFork}
          >
            New branch
          </Button>
          <Button
            size="sm"
            className="flex-1 h-6 text-[10px]"
            onClick={props.onCompleteBranch}
            disabled={!props.canCompleteBranch}
          >
            Sync ↑
          </Button>
        </div>
      </div>

      {/* Run history tree */}
      <div className="px-3 pb-2">
        <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
          Run history
        </p>
        <RunTreeCanvas
          root={root}
          initialSelectedId="active"
          onSelectNode={handleSelectNode}
        />
        {viewingNode && viewingNode.id !== "active" && (
          <p className="text-[9px] text-muted-foreground mt-1.5 text-center">
            viewing{" "}
            <span className="font-medium text-foreground">
              {viewingNode.label}
            </span>
          </p>
        )}
      </div>

      <Separator />

      {/* Bottom bar */}
      <div className="flex items-center justify-between px-4 py-2.5">
        <div>
          <p className="text-[9px] text-muted-foreground uppercase tracking-widest">
            Active run
          </p>
          <p className="text-[12px] font-medium text-sky-700 dark:text-sky-400">
            {activeBranch?.name ?? "No active branch"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={props.onBackToRun}>
            Run setup
          </Button>
          <Button
            size="sm"
            onClick={props.onCompleteBranch}
            disabled={!props.canCompleteBranch}
          >
            Sync <ArrowUp className="ml-1 size-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function SourceDoc(props: { label: string; ext: "xlsx" | "pdf" }) {
  const Icon = props.ext === "pdf" ? FileText : FileSpreadsheet;
  return (
    <div className="flex flex-col items-center gap-1 rounded-lg border border-border bg-muted/40 px-1 py-2 cursor-pointer hover:bg-muted transition-colors">
      <div className="relative flex size-8 items-center justify-center rounded-md border border-border bg-background">
        <Icon
          className={cn(
            "size-3.5",
            props.ext === "xlsx" ? "text-emerald-600" : "text-slate-500"
          )}
        />
        <span
          className={cn(
            "absolute -bottom-1.5 -right-1.5 rounded-sm px-1 py-px text-[7px] font-bold text-white leading-none",
            props.ext === "xlsx" ? "bg-emerald-600" : "bg-slate-600"
          )}
        >
          {props.ext}
        </span>
      </div>
      <span className="text-center text-[9px] font-medium text-muted-foreground leading-tight line-clamp-2 px-0.5">
        {props.label}
      </span>
    </div>
  );
}