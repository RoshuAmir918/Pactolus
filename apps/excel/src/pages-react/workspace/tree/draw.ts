import type { NodeTone, TreeNode } from "../types";
import { NW, NH, pathTo } from "./layout";

type BranchPalette = {
  edge: string;
  edgeHi: string;
  dot: string;
  stroke: string;
  fill: string;
  active: string;
  text: string;
};

export function getColors(dark: boolean) {
  return {
    bg:           dark ? "#161614" : "#f7f7f4",
    nodeBg:       dark ? "#232320" : "#ffffff",
    nodeHov:      dark ? "#2b2b28" : "#f2f2ec",
    nodeDim:      dark ? "#1b1b19" : "#f6f5f0",
    borderDim:    dark ? "#2f2f2b" : "#e5e4db",
    done:         dark ? "#22863a" : "#3B6D11",
    active:       "#2d6ec2",
    saved:        dark ? "#3a6b28" : "#4a7c23",
    savedBg:      dark ? "#1c2a18" : "#f2f7ef",
    savedBorder:  dark ? "#3a5c28" : "#b8d4a8",
    skeleton:     dark ? "#444440" : "#c0bdb4",
    skeletonBg:   dark ? "#1a1a18" : "#f7f7f4",
    text:         dark ? "#cbc8bc" : "#262622",
    textDim:      dark ? "#58564e" : "#b8b6ae",
    textSub:      dark ? "#6e6c64" : "#9c9a90",
    line:         dark ? "#2e2e28" : "#dddcd4",
    lineHi:       dark ? "#244b73" : "#b4d7ff",
  };
}

export function nodeColor(tone: NodeTone, C: ReturnType<typeof getColors>): string {
  if (tone === "done") return C.done;
  if (tone === "active") return C.active;
  if (tone === "skeleton") return C.skeleton;
  return C.saved;
}

export function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

const pastelPalette: BranchPalette[] = [
  { edge: "#7dd3fc", edgeHi: "#38bdf8", dot: "#38bdf8", stroke: "#7dd3fc", fill: "#eff6ff", active: "#0ea5e9", text: "#0369a1" },
  { edge: "#86efac", edgeHi: "#4ade80", dot: "#4ade80", stroke: "#86efac", fill: "#ecfdf3", active: "#22c55e", text: "#15803d" },
  { edge: "#f9a8d4", edgeHi: "#f472b6", dot: "#f472b6", stroke: "#f9a8d4", fill: "#fdf2f8", active: "#ec4899", text: "#be185d" },
  { edge: "#c4b5fd", edgeHi: "#a78bfa", dot: "#a78bfa", stroke: "#c4b5fd", fill: "#f5f3ff", active: "#8b5cf6", text: "#6d28d9" },
  { edge: "#fcd34d", edgeHi: "#fbbf24", dot: "#fbbf24", stroke: "#fcd34d", fill: "#fffbeb", active: "#f59e0b", text: "#b45309" },
  { edge: "#67e8f9", edgeHi: "#22d3ee", dot: "#22d3ee", stroke: "#67e8f9", fill: "#ecfeff", active: "#06b6d4", text: "#0e7490" },
];

function branchStyles(nodes: TreeNode[]): Map<string, BranchPalette> {
  const map = new Map<string, BranchPalette>();
  let idx = 0;
  for (const node of nodes) {
    const rootId = node.branchRootId;
    if (!rootId || rootId === "ingest" || map.has(rootId)) continue;
    map.set(rootId, pastelPalette[idx % pastelPalette.length]);
    idx += 1;
  }
  return map;
}

export function drawScene(
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
  zoom: number,
  dark: boolean,
) {
  const C = getColors(dark);
  const paletteByRoot = branchStyles(nodes);
  ctx.clearRect(0, 0, CW, CH);
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, CW, CH);

  const onPath = new Set((pathTo(selectedId, root) ?? []).map((n) => n.id));
  ctx.save();
  ctx.translate(padX - vpX, padY - vpY);
  ctx.scale(zoom, zoom);

  // edges
  for (const node of nodes) {
    for (const child of node.children) {
      const x1 = node.lx, y1 = node.ly + NH / 2;
      const x2 = child.lx, y2 = child.ly - NH / 2;
      const my = (y1 + y2) / 2;
      const childPalette = child.branchRootId ? paletteByRoot.get(child.branchRootId) : undefined;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.bezierCurveTo(x1, my, x2, my, x2, y2);
      if (onPath.has(node.id) && onPath.has(child.id)) {
        ctx.setLineDash([]);
        ctx.strokeStyle = childPalette?.edgeHi ?? C.lineHi;
        ctx.lineWidth = 2;
      } else {
        ctx.setLineDash([]);
        ctx.strokeStyle = childPalette?.edge ?? C.line;
        ctx.globalAlpha = 0.7;
        ctx.lineWidth = 1.25;
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.setLineDash([]);
    }
  }

  // nodes
  for (const node of nodes) {
    const nx = node.lx - NW / 2, ny = node.ly - NH / 2;
    const isSel = node.id === selectedId;
    const isOn  = onPath.has(node.id);
    const isHov = node.id === hoverId;
    const isDim = !isOn && !isSel;
    const isSaved   = node.tone === "saved";
    const isSkel    = node.tone === "skeleton";
    const nodePalette = node.branchRootId ? paletteByRoot.get(node.branchRootId) : undefined;

    // skeleton nodes: dashed ghost outline, no fill dot
    if (isSkel) {
      ctx.beginPath();
      ctx.roundRect(nx, ny, NW, NH, 10);
      ctx.fillStyle = isSel ? C.skeleton : C.skeletonBg;
      ctx.fill();
      ctx.setLineDash(isSel ? [] : [3, 3]);
      ctx.strokeStyle = isSel ? C.text : (isHov ? C.text : C.skeleton);
      ctx.lineWidth = isSel ? 1.5 : 1;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = `${isSel ? "500" : "400"} 9px system-ui,sans-serif`;
      ctx.fillStyle = isSel ? C.text : (isHov ? C.textSub : C.skeleton);
      ctx.textBaseline = "middle";
      ctx.fillText(truncate(node.label, 12), nx + 8, node.ly);
      continue;
    }

    // background
    ctx.beginPath();
    ctx.roundRect(nx, ny, NW, NH, 10);
    ctx.fillStyle = isSaved
      ? (isSel
          ? (nodePalette?.active ?? C.active)
          : (isHov ? C.nodeHov : (nodePalette?.fill ?? C.savedBg)))
      : (isHov ? C.nodeHov : isDim ? C.nodeDim : C.nodeBg);
    ctx.fill();

    // border
    ctx.setLineDash([]);
    if (isSel) {
      ctx.strokeStyle = nodePalette?.active ?? nodeColor(node.tone, C); ctx.lineWidth = 1.5;
    } else if (isSaved) {
      ctx.strokeStyle = isDim ? C.savedBorder : (nodePalette?.stroke ?? C.saved); ctx.lineWidth = 1.1;
    } else if (isDim) {
      ctx.strokeStyle = C.borderDim; ctx.lineWidth = 0.5;
    } else {
      ctx.strokeStyle = nodeColor(node.tone, C); ctx.lineWidth = 1;
    }
    ctx.stroke();

    // indicator dot
    const dr = 3, dx = nx + 8, dy = node.ly - 2;
    ctx.beginPath();
    ctx.arc(dx, dy, dr, 0, Math.PI * 2);
    if (isSaved) {
      ctx.fillStyle = isDim ? C.savedBorder : (nodePalette?.dot ?? C.saved);
      ctx.fill();
      ctx.beginPath(); ctx.arc(dx, dy, 1.5, 0, Math.PI * 2);
      ctx.fillStyle = isSel ? "#ffffff" : (nodePalette?.fill ?? C.savedBg);
      ctx.fill();
    } else if (node.tone === "done" || node.tone === "active") {
      ctx.fillStyle = isDim ? C.textDim : nodeColor(node.tone, C);
      ctx.fill();
      if (node.tone === "active" && !isDim) {
        ctx.beginPath(); ctx.arc(dx, dy, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = "#fff"; ctx.fill();
      }
    } else {
      ctx.strokeStyle = isDim ? C.textDim : nodeColor(node.tone, C);
      ctx.lineWidth = 1.2; ctx.stroke();
    }

    // label
    ctx.font = `${isSel ? "600" : "500"} 10px system-ui,sans-serif`;
    ctx.fillStyle = isSel
      ? "#ffffff"
      : isSaved
      ? (isDim ? C.savedBorder : (nodePalette?.text ?? C.saved))
      : (isDim ? C.textDim : C.text);
    ctx.textBaseline = "middle";
    ctx.fillText(truncate(node.label, 16), nx + 16, node.ly - 3);
    if (node.meta) {
      ctx.font = "400 8px system-ui,sans-serif";
      ctx.fillStyle = isSel ? "rgba(255,255,255,0.9)" : (isDim ? C.textDim : C.textSub);
      ctx.fillText(truncate(node.meta, 16), nx + 16, node.ly + 9);
    }
  }

  ctx.restore();
}
