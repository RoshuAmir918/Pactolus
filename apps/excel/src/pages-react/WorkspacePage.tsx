import { useEffect, useRef, useCallback, useState } from "react";
import {
  ArrowUp, Cog, FileSpreadsheet, FileText,
  GitBranch, Files, MessageSquare,
} from "lucide-react";
import type { BranchOption, RunSession, StepRecord } from "@/features/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ── types ─────────────────────────────────────────────────────────────────────

type Tab = "chat" | "runs" | "files";
type NodeTone = "done" | "active" | "branch" | "future";
type StripState = "idle" | "pending" | "committing";

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

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
}

// ── tree layout ───────────────────────────────────────────────────────────────

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
    assignPos(c, cx, y + VGAP);
    cx += subtreeW(c) + HGAP;
  }
}

function allNodes(node: TreeNode, acc: TreeNode[] = []): TreeNode[] {
  acc.push(node);
  node.children.forEach((c) => allNodes(c, acc));
  return acc;
}

function pathTo(targetId: string, node: TreeNode, path: TreeNode[] = []): TreeNode[] | null {
  if (node.id === targetId) return [...path, node];
  for (const c of node.children) {
    const r = pathTo(targetId, c, [...path, node]);
    if (r) return r;
  }
  return null;
}

function stepLabel(step: StepRecord): string {
  if (step.stepType === "excel_tool") {
    const p = step.parametersJson as { toolName?: string } | null;
    return p?.toolName ?? "Operation";
  }
  return step.stepType;
}

function buildTreeFromSteps(
  steps: StepRecord[],
  branches: BranchOption[],
  activeBranchId: string | null,
  runId: string | null,
  canCompleteBranch: boolean,
): TreeNode {
  const make = (
    id: string, label: string, meta: string,
    tone: NodeTone, parent: string | null, branchId?: string,
  ): TreeNode => ({ id, label, meta, tone, parent, branchId, children: [], lx: 0, ly: 0 });

  const toolSteps = steps
    .filter((s) => s.stepType === "excel_tool")
    .sort((a, b) => a.stepIndex - b.stepIndex);

  const ingest = make("ingest", "Ingest", "auto", "done", null);
  let tail = ingest;

  for (const step of toolSteps) {
    const node = make(step.id, stepLabel(step), `step ${step.stepIndex}`, "done", tail.id);
    tail.children = [node];
    tail = node;
  }

  const activeBranch = branches.find((b) => b.id === activeBranchId);
  const otherBranches = branches.filter((b) => b.id !== activeBranchId && b.status === "active");

  const active = make(
    "active",
    activeBranch?.name ?? "Active",
    `run ${runId?.slice(0, 8) ?? "—"}`,
    "active",
    tail.id,
  );
  active.children = [
    ...otherBranches.map((b) => make(b.id, b.name, b.status, "branch", "active", b.id)),
    ...(canCompleteBranch ? [make("__next", "+ next run", "", "future", "active")] : []),
  ];
  tail.children = [active];

  assignPos(ingest, 0, 0);
  return ingest;
}

// ── canvas colours ────────────────────────────────────────────────────────────

function getColors(dark: boolean) {
  return {
    bg:        dark ? "#1c1c1a" : "#f4f3ee",
    nodeBg:    dark ? "#262624" : "#ffffff",
    nodeHov:   dark ? "#2e2e2c" : "#ebebE6",
    nodeDim:   dark ? "#1e1e1c" : "#f8f7f3",
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

function nodeColor(tone: NodeTone, C: ReturnType<typeof getColors>): string {
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
  vpX: number, vpY: number,
  padX: number, padY: number,
  CW: number, CH: number,
  dark: boolean,
) {
  const C = getColors(dark);
  ctx.clearRect(0, 0, CW, CH);
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, CW, CH);

  const onPath = new Set((pathTo(selectedId, root) ?? []).map((n) => n.id));
  ctx.save();
  ctx.translate(padX - vpX, padY - vpY);

  for (const node of nodes) {
    for (const child of node.children) {
      const x1 = node.lx, y1 = node.ly + NH / 2;
      const x2 = child.lx, y2 = child.ly - NH / 2;
      const my = (y1 + y2) / 2;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.bezierCurveTo(x1, my, x2, my, x2, y2);
      if (child.tone === "future") {
        ctx.setLineDash([3, 3]); ctx.strokeStyle = C.lineFut; ctx.lineWidth = 0.5;
      } else if (onPath.has(node.id) && onPath.has(child.id)) {
        ctx.setLineDash([]); ctx.strokeStyle = C.lineHi; ctx.lineWidth = 1.5;
      } else {
        ctx.setLineDash([]); ctx.strokeStyle = C.line; ctx.lineWidth = 0.5;
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  for (const node of nodes) {
    const nx = node.lx - NW / 2, ny = node.ly - NH / 2;
    const isSel = node.id === selectedId;
    const isOn  = onPath.has(node.id);
    const isHov = node.id === hoverId;
    const isDim = !isOn && !isSel;

    ctx.beginPath();
    ctx.roundRect(nx, ny, NW, NH, 5);
    ctx.fillStyle = isHov ? C.nodeHov : isDim ? C.nodeDim : C.nodeBg;
    ctx.fill();

    ctx.setLineDash([]);
    if (isSel)                       { ctx.strokeStyle = nodeColor(node.tone, C); ctx.lineWidth = 1.5; }
    else if (node.tone === "future") { ctx.setLineDash([2, 2]); ctx.strokeStyle = C.borderDim; ctx.lineWidth = 0.5; }
    else if (isDim)                  { ctx.strokeStyle = C.borderDim; ctx.lineWidth = 0.5; }
    else                             { ctx.strokeStyle = nodeColor(node.tone, C); ctx.lineWidth = 1; }
    ctx.stroke();
    ctx.setLineDash([]);

    const dr = 3, dx = nx + 8, dy = node.ly - 2;
    ctx.beginPath();
    ctx.arc(dx, dy, dr, 0, Math.PI * 2);
    if (node.tone === "done" || node.tone === "active") {
      ctx.fillStyle = isDim ? C.textDim : nodeColor(node.tone, C);
      ctx.fill();
      if (node.tone === "active" && !isDim) {
        ctx.beginPath(); ctx.arc(dx, dy, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = "#fff"; ctx.fill();
      }
    } else if (node.tone === "branch") {
      ctx.strokeStyle = isDim ? C.textDim : nodeColor(node.tone, C);
      ctx.lineWidth = 1.2; ctx.stroke();
    } else {
      ctx.setLineDash([2, 2]); ctx.strokeStyle = C.textDim;
      ctx.lineWidth = 0.8; ctx.stroke(); ctx.setLineDash([]);
    }

    ctx.font = `${isSel ? "500" : "400"} 9px system-ui,sans-serif`;
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
  const s = useRef({
    vpX: 0, vpY: 0, targetVpX: 0, targetVpY: 0,
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
    const st = s.current;
    const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const dpr = window.devicePixelRatio || 1;
    drawScene(ctx, nodes, props.root, st.selectedId, st.hoverId,
      st.vpX, st.vpY, st.padX, st.padY, st.CW / dpr, st.CH / dpr, dark);
  }, [nodes, props.root]);

  function clampVp(tx: number, ty: number) {
    const st = s.current;
    const dpr = window.devicePixelRatio || 1;
    const CW = st.CW / dpr, CH = st.CH / dpr;
    return {
      x: Math.min(Math.max(tx, st.padX + st.minX - PADDING), Math.max(0, st.padX + st.maxX - CW + PADDING)),
      y: Math.min(Math.max(ty, st.padY + st.minY - PADDING), Math.max(0, st.padY + st.maxY - CH + PADDING)),
    };
  }

  function animateVp() {
    const st = s.current;
    if (st.rafId) cancelAnimationFrame(st.rafId);
    function step() {
      const dx = st.targetVpX - st.vpX, dy = st.targetVpY - st.vpY;
      if (Math.abs(dx) < 0.3 && Math.abs(dy) < 0.3) {
        st.vpX = st.targetVpX; st.vpY = st.targetVpY; redraw(); return;
      }
      st.vpX += dx * 0.14; st.vpY += dy * 0.14;
      redraw();
      st.rafId = requestAnimationFrame(step);
    }
    st.rafId = requestAnimationFrame(step);
  }

  function snapTo(id: string) {
    const node = nodes.find((n) => n.id === id);
    if (!node) return;
    const st = s.current;
    const dpr = window.devicePixelRatio || 1;
    const CW = st.CW / dpr, CH = st.CH / dpr;
    const { x, y } = clampVp(node.lx + st.padX - CW / 2, node.ly + st.padY - CH * 0.42);
    st.targetVpX = x; st.targetVpY = y;
    animateVp();
  }

  function selectNode(id: string) {
    const st = s.current;
    if (id === st.selectedId) return;
    st.selectedId = id;
    const node = nodes.find((n) => n.id === id);
    props.onSelectNode(id, node?.branchId);
    snapTo(id);
  }

  function nodeAt(mx: number, my: number): TreeNode | undefined {
    const st = s.current;
    const tx = st.padX - st.vpX, ty = st.padY - st.vpY;
    return nodes.find((n) =>
      mx >= n.lx - NW / 2 + tx && mx <= n.lx + NW / 2 + tx &&
      my >= n.ly - NH / 2 + ty && my <= n.ly + NH / 2 + ty
    );
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const CW = 256, CH = 200;
    canvas.width = CW * dpr; canvas.height = CH * dpr;
    canvas.style.width = `${CW}px`; canvas.style.height = `${CH}px`;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.scale(dpr, dpr);
    const ns = allNodes(props.root);
    const minX = Math.min(...ns.map((n) => n.lx)) - NW / 2;
    const maxX = Math.max(...ns.map((n) => n.lx)) + NW / 2;
    const minY = Math.min(...ns.map((n) => n.ly)) - NH / 2;
    const maxY = Math.max(...ns.map((n) => n.ly)) + NH / 2;
    const st = s.current;
    st.CW = CW * dpr; st.CH = CH * dpr;
    st.minX = minX; st.maxX = maxX; st.minY = minY; st.maxY = maxY;
    st.padX = (CW - (maxX - minX)) / 2 - minX;
    st.padY = 16 - minY;
    redraw();
    snapTo(props.initialSelectedId);
  }, [props.root]);

  return (
    <div className="rounded-lg overflow-hidden" style={{ background: "var(--color-background-secondary, #f4f3ee)" }}>
      <canvas
        ref={canvasRef}
        style={{ display: "block" }}
        onMouseMove={(e) => {
          const r = canvasRef.current!.getBoundingClientRect();
          const n = nodeAt(e.clientX - r.left, e.clientY - r.top);
          const newHov = n?.id ?? null;
          if (newHov !== s.current.hoverId) {
            s.current.hoverId = newHov;
            if (canvasRef.current) canvasRef.current.style.cursor = newHov ? "pointer" : "default";
            redraw();
          }
        }}
        onMouseLeave={() => { s.current.hoverId = null; redraw(); }}
        onClick={(e) => {
          const r = canvasRef.current!.getBoundingClientRect();
          const n = nodeAt(e.clientX - r.left, e.clientY - r.top);
          if (n) selectNode(n.id);
        }}
        onTouchStart={(e) => {
          s.current.touchStartX = e.touches[0].clientX;
          s.current.touchStartY = e.touches[0].clientY;
          s.current.swept = false;
        }}
        onTouchMove={(e) => {
          if (Math.abs(e.touches[0].clientX - s.current.touchStartX) > 10) s.current.swept = true;
        }}
        onTouchEnd={(e) => {
          const st = s.current;
          const dx = e.changedTouches[0].clientX - st.touchStartX;
          const dy = Math.abs(e.changedTouches[0].clientY - st.touchStartY);
          if (st.swept && Math.abs(dx) > 30 && dy < 50) {
            const sel = nodes.find((n) => n.id === st.selectedId);
            if (!sel?.parent) return;
            const parent = nodes.find((n) => n.id === sel.parent);
            if (!parent) return;
            const sibs = parent.children;
            const idx = sibs.findIndex((n) => n.id === st.selectedId);
            const next = dx < 0 ? sibs[idx + 1] : sibs[idx - 1];
            if (next) selectNode(next.id);
          } else if (!st.swept) {
            const r = canvasRef.current!.getBoundingClientRect();
            const n = nodeAt(e.changedTouches[0].clientX - r.left, e.changedTouches[0].clientY - r.top);
            if (n) selectNode(n.id);
          }
        }}
      />
    </div>
  );
}

// ── ChatPanel ─────────────────────────────────────────────────────────────────

function ChatPanel(props: {
  activeRunName: string;
  selectedRange: string | null;
  onClearRange: () => void;
  messages: ChatMessage[];
  onSend: (text: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [props.messages]);

  function submit() {
    const text = draft.trim();
    if (!text) return;
    props.onSend(text);
    setDraft("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3 min-h-0">
        {props.messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3 pb-8">
            <div className="size-10 rounded-full bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 flex items-center justify-center">
              <MessageSquare className="size-4 text-blue-500" />
            </div>
            <div className="text-center">
              <p className="text-[12px] font-medium text-foreground mb-0.5">Ask Pactolus</p>
              <p className="text-[10px] text-muted-foreground max-w-[180px] leading-relaxed">
                Ask about your data, analysis, or current run.
              </p>
            </div>
            <div className="flex flex-col gap-1.5 w-full max-w-[200px]">
              {[
                "Summarise the tail development",
                "What anomalies were flagged?",
                "Compare this branch to main",
              ].map((hint) => (
                <button
                  key={hint}
                  type="button"
                  onClick={() => props.onSend(hint)}
                  className="text-left text-[10px] text-muted-foreground px-2.5 py-1.5 rounded-lg border border-border hover:bg-muted hover:text-foreground transition-colors"
                >
                  {hint}
                </button>
              ))}
            </div>
          </div>
        )}

        {props.messages.map((msg, i) => (
          <div
            key={i}
            className={cn("flex flex-col gap-0.5", msg.role === "user" ? "items-end" : "items-start")}
          >
            <span className="text-[8px] font-medium uppercase tracking-widest text-muted-foreground px-1">
              {msg.role === "user" ? "You" : "Pactolus"}
            </span>
            <div
              className={cn(
                "text-[11px] leading-relaxed px-3 py-2 rounded-2xl max-w-[88%]",
                msg.role === "user"
                  ? "bg-blue-600 text-white rounded-br-sm"
                  : "bg-muted border border-border text-foreground rounded-bl-sm",
              )}
            >
              {msg.text}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="flex-shrink-0 border-t border-border px-3 pt-2.5 pb-3 flex flex-col gap-2">
        {props.selectedRange && (
          <div className="flex items-center gap-1">
            <span className="inline-flex items-center gap-1 text-[8px] px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              {props.selectedRange}
              <button type="button" onClick={props.onClearRange} className="ml-0.5 opacity-60 hover:opacity-100 leading-none">×</button>
            </span>
          </div>
        )}
        <div className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = Math.min(e.target.scrollHeight, 80) + "px";
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
            }}
            placeholder="Ask about this run…"
            rows={1}
            className="flex-1 text-[11px] font-sans resize-none rounded-xl border border-border bg-muted/40 px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-blue-300 dark:focus:border-blue-700 leading-relaxed min-h-[36px] max-h-[80px]"
          />
          <button
            type="button"
            onClick={submit}
            disabled={!draft.trim()}
            className="size-9 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-35 disabled:cursor-not-allowed flex items-center justify-center flex-shrink-0 transition-colors"
          >
            <ArrowUp className="size-3.5 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── RunsPanel ─────────────────────────────────────────────────────────────────

function RunsPanel(props: {
  activeBranchName: string;
  runId: string | undefined;
  canFork: boolean;
  canCompleteBranch: boolean;
  onForkBranch: () => Promise<void> | void;
  onCompleteBranch: () => Promise<void> | void;
  root: TreeNode;
  committedOperations: StepRecord[];
  onSelectNode: (id: string, branchId?: string) => void;
  onOpenWorkbook: (documentId: string) => void;
}) {
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const selectedStep = selectedStepId
    ? props.committedOperations.find((s) => s.id === selectedStepId) ?? null
    : null;

  function handleSelectNode(id: string, branchId?: string) {
    const isStep = props.committedOperations.some((s) => s.id === id);
    if (isStep) {
      setSelectedStepId((prev) => (prev === id ? null : id));
    } else {
      setSelectedStepId(null);
      props.onSelectNode(id, branchId);
    }
  }

  return (
    <div className="overflow-y-auto h-full px-3 py-3 flex flex-col gap-4">
      <div className="rounded-xl border-2 border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/40 overflow-hidden">
        <div className="flex items-center justify-between px-3 pt-3 pb-1">
          <span className="text-[9px] font-semibold uppercase tracking-widest text-blue-600 dark:text-blue-400">
            Current operation
          </span>
          <span className="flex items-center gap-1.5 text-[9px] text-blue-500">
            <span className="size-1.5 rounded-full bg-blue-500 animate-pulse" />
            active
          </span>
        </div>
        <p className="px-3 text-[14px] font-medium text-blue-800 dark:text-blue-200 leading-snug">
          {props.activeBranchName}
        </p>
        <p className="px-3 pb-2.5 text-[10px] text-blue-500 dark:text-blue-400 opacity-80">
          {`run ${props.runId?.slice(0, 8) ?? "—"}`}
        </p>
        <div className="flex gap-1.5 border-t border-blue-200 dark:border-blue-800 px-3 py-2">
          <Button
            variant="outline" size="sm"
            className="flex-1 h-7 text-[10px] border-blue-200 dark:border-blue-700"
            onClick={props.onForkBranch}
            disabled={!props.canFork}
          >
            New branch
          </Button>
          <Button
            size="sm" className="flex-1 h-7 text-[10px]"
            onClick={props.onCompleteBranch}
            disabled={!props.canCompleteBranch}
          >
            Complete branch
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">
          Run history
        </p>
        <RunTreeCanvas
          root={props.root}
          initialSelectedId="active"
          onSelectNode={handleSelectNode}
        />

        {/* Step detail card */}
        {selectedStep && (
          <div className="rounded-xl border border-border bg-muted/40 px-3 py-2.5 flex flex-col gap-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="text-[11px] font-medium text-foreground truncate">
                  {(selectedStep.parametersJson as { toolName?: string } | null)?.toolName ?? "Operation"}
                </span>
                {(() => {
                  const note = (selectedStep.parametersJson as { note?: string } | null)?.note;
                  return note ? (
                    <span className="text-[10px] text-muted-foreground leading-snug">{note}</span>
                  ) : null;
                })()}
              </div>
              <span className="text-[8px] text-muted-foreground font-mono flex-shrink-0 mt-0.5">
                step {selectedStep.stepIndex}
              </span>
            </div>
            {selectedStep.documentId ? (
              <button
                type="button"
                onClick={() => props.onOpenWorkbook(selectedStep.documentId!)}
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
        )}
      </div>
    </div>
  );
}

// ── FilesPanel ────────────────────────────────────────────────────────────────

function FilesPanel(props: { onUploadDocument: (file: File) => Promise<void> | void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setUploadError(null);
    setUploading(true);
    try {
      await props.onUploadDocument(file);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="overflow-y-auto h-full px-4 py-3 flex flex-col gap-4">
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
        className="hidden"
        onChange={handleFileChange}
      />
      <div className="flex items-center justify-between">
        <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">
          Source documents
        </p>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1 text-[9px] text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ArrowUp className="size-2.5" />
          {uploading ? "Uploading..." : "Upload"}
        </button>
      </div>
      {uploadError && (
        <p className="text-[10px] text-destructive">{uploadError}</p>
      )}
      <div className="grid grid-cols-2 gap-2">
        <SourceDoc label="Loss triangles" ext="xlsx" />
        <SourceDoc label="Claims" ext="xlsx" />
        <SourceDoc label="Policies" ext="xlsx" />
        <SourceDoc label="Treaty" ext="pdf" />
      </div>
    </div>
  );
}

// ── WorkspacePage ─────────────────────────────────────────────────────────────

export function WorkspacePage(props: {
  runSession: RunSession;
  availableBranches: BranchOption[];
  committedOperations: StepRecord[];
  status: { kind: "ok" | "error"; message: string } | null;
  canFork: boolean;
  canCompleteBranch: boolean;
  onBackToRun: () => void;
  onSelectBranch: (branchId: string) => void;
  onDeleteBranch: (branchId: string) => Promise<void> | void;
  onForkBranch: () => Promise<void> | void;
  onCompleteBranch: () => Promise<void> | void;
  onCommitOperation: (params: { name: string; note: string }) => Promise<void>;
  onOpenWorkbook: (documentId: string) => void;
  onUploadDocument: (file: File) => Promise<void>;
  onAsk?: (text: string, context: { runId: string; selectedRange: string | null }) => Promise<string>;
}) {
  const activeBranch = props.availableBranches.find((b) => b.id === props.runSession.branchId);

  const [activeTab, setActiveTab] = useState<Tab>("chat");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [selectedRange, setSelectedRange] = useState<string | null>(null);

  // Strip state machine
  const [stripState, setStripState] = useState<StripState>("idle");
  const [commitName, setCommitName] = useState("");
  const [commitNote, setCommitNote] = useState("");

  const root = buildTreeFromSteps(
    props.committedOperations,
    props.availableBranches,
    props.runSession.branchId,
    props.runSession.runId,
    props.canCompleteBranch,
  );

  async function handleCommit() {
    const name = commitName.trim();
    if (!name) return;
    setStripState("committing");
    try {
      await props.onCommitOperation({ name, note: commitNote.trim() });
      setCommitName("");
      setCommitNote("");
      setStripState("idle");
      setActiveTab("runs");
    } catch {
      setStripState("pending");
    }
  }

  async function handleSend(text: string) {
    if (!props.onAsk) {
      setMessages((m) => [...m,
        { role: "user", text },
        { role: "assistant", text: "Chat not yet connected." },
      ]);
      return;
    }
    setMessages((m) => [...m, { role: "user", text }]);
    setMessages((m) => [...m, { role: "assistant", text: "Thinking…" }]);
    try {
      const reply = await props.onAsk(text, {
        runId: props.runSession.runId ?? "",
        selectedRange,
      });
      setMessages((m) => [...m.slice(0, -1), { role: "assistant", text: reply }]);
    } catch {
      setMessages((m) => [...m.slice(0, -1), { role: "assistant", text: "Something went wrong. Please try again." }]);
    }
  }

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "chat",  label: "Chat",  icon: MessageSquare },
    { id: "runs",  label: "Runs",  icon: GitBranch },
    { id: "files", label: "Files", icon: Files },
  ];

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border flex-shrink-0">
        <span className="text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">
          Pactolus
        </span>
        <button
          type="button"
          className="rounded-md border border-border p-1.5 text-muted-foreground hover:bg-muted transition-colors"
          title="Settings"
        >
          <Cog className="size-3.5" />
        </button>
      </div>

      {/* Active run strip — state machine */}
      {stripState === "idle" && (
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border flex-shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab("runs")}
            className="flex items-center gap-2 flex-1 min-w-0 text-left"
          >
            <span className="size-1.5 rounded-full bg-blue-500 animate-pulse flex-shrink-0" />
            <span className="text-[11px] font-medium text-foreground truncate flex-1">
              {activeBranch?.name ?? "Current operation"}
            </span>
            <span className="text-[9px] text-muted-foreground font-mono flex-shrink-0">
              {props.runSession.runId?.slice(0, 8) ?? "—"}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setStripState("pending")}
            className="flex-shrink-0 text-[9px] font-medium text-blue-600 dark:text-blue-400 hover:underline px-1"
          >
            Commit →
          </button>
        </div>
      )}

      {stripState === "pending" && (
        <div className="flex flex-col gap-2 px-4 py-3 border-b border-border bg-blue-50 dark:bg-blue-950/20 flex-shrink-0">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-semibold uppercase tracking-widest text-blue-600 dark:text-blue-400">
              Commit operation
            </span>
            <button
              type="button"
              onClick={() => setStripState("idle")}
              className="text-[9px] text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>
          <input
            value={commitName}
            onChange={(e) => setCommitName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleCommit(); }}
            placeholder="Operation name…"
            autoFocus
            className="text-[11px] w-full rounded-lg border border-blue-200 dark:border-blue-700 bg-white dark:bg-blue-950/40 px-2.5 py-1.5 focus:outline-none focus:border-blue-400 text-foreground placeholder:text-muted-foreground"
          />
          <input
            value={commitNote}
            onChange={(e) => setCommitNote(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleCommit(); }}
            placeholder="Note (optional)…"
            className="text-[11px] w-full rounded-lg border border-blue-200 dark:border-blue-700 bg-white dark:bg-blue-950/40 px-2.5 py-1.5 focus:outline-none focus:border-blue-400 text-foreground placeholder:text-muted-foreground"
          />
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline" size="sm"
              className="h-7 text-[10px]"
              onClick={() => setStripState("idle")}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="h-7 text-[10px]"
              onClick={handleCommit}
              disabled={!commitName.trim()}
            >
              Commit
            </Button>
          </div>
        </div>
      )}

      {stripState === "committing" && (
        <div className="flex items-center gap-2.5 px-4 py-2.5 border-b border-border bg-blue-50/50 dark:bg-blue-950/10 flex-shrink-0">
          <span className="size-1.5 rounded-full bg-blue-500 animate-ping flex-shrink-0" />
          <span className="text-[11px] text-blue-600 dark:text-blue-400">Committing…</span>
        </div>
      )}

      {/* Tab content */}
      <main className="flex-1 overflow-hidden">
        {activeTab === "chat" && (
          <ChatPanel
            activeRunName={activeBranch?.name ?? "this run"}
            selectedRange={selectedRange}
            onClearRange={() => setSelectedRange(null)}
            messages={messages}
            onSend={handleSend}
          />
        )}
        {activeTab === "runs" && (
          <RunsPanel
            activeBranchName={activeBranch?.name ?? "Current operation"}
            runId={props.runSession.runId ?? undefined}
            canFork={props.canFork}
            canCompleteBranch={props.canCompleteBranch}
            onForkBranch={props.onForkBranch}
            onCompleteBranch={props.onCompleteBranch}
            root={root}
            committedOperations={props.committedOperations}
            onSelectNode={(_id, branchId) => {
              if (branchId) props.onSelectBranch(branchId);
            }}
            onOpenWorkbook={props.onOpenWorkbook}
          />
        )}
        {activeTab === "files" && (
          <FilesPanel onUploadDocument={props.onUploadDocument} />
        )}
      </main>

      {/* Bottom tab bar */}
      <nav className="flex-shrink-0 border-t border-border bg-background">
        <div className="flex">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={cn(
                "flex-1 flex flex-col items-center gap-1 py-2.5 transition-colors relative",
                activeTab === id
                  ? "text-blue-600 dark:text-blue-400"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-4" />
              <span className="text-[9px] font-medium">{label}</span>
              {activeTab === id && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full bg-blue-600 dark:bg-blue-400" />
              )}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}

// ── SourceDoc ─────────────────────────────────────────────────────────────────

function SourceDoc(props: { label: string; ext: "xlsx" | "pdf" }) {
  const Icon = props.ext === "pdf" ? FileText : FileSpreadsheet;
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-xl border border-border bg-muted/40 px-2 py-3 cursor-pointer hover:bg-muted transition-colors">
      <div className="relative flex size-9 items-center justify-center rounded-lg border border-border bg-background">
        <Icon className={cn("size-4", props.ext === "xlsx" ? "text-emerald-600" : "text-slate-500")} />
        <span className={cn(
          "absolute -bottom-1.5 -right-1.5 rounded px-1 py-px text-[7px] font-bold text-white leading-none",
          props.ext === "xlsx" ? "bg-emerald-600" : "bg-slate-600",
        )}>
          {props.ext}
        </span>
      </div>
      <span className="text-center text-[10px] font-medium text-muted-foreground leading-tight line-clamp-2">
        {props.label}
      </span>
    </div>
  );
}
