import type { NodeTone, TreeNode } from "../types";
import { NW, NH, pathTo } from "./layout";

export function getColors(dark: boolean) {
  return {
    bg:           dark ? "#1c1c1a" : "#f4f3ee",
    nodeBg:       dark ? "#262624" : "#ffffff",
    nodeHov:      dark ? "#2e2e2c" : "#ebebE6",
    nodeDim:      dark ? "#1e1e1c" : "#f8f7f3",
    borderDim:    dark ? "#2a2a26" : "#e4e2d8",
    done:         dark ? "#22863a" : "#3B6D11",
    active:       "#185FA5",
    saved:        dark ? "#3a6b28" : "#4a7c23",
    savedBg:      dark ? "#1c2a18" : "#f2f7ef",
    savedBorder:  dark ? "#3a5c28" : "#b8d4a8",
    skeleton:     dark ? "#444440" : "#c0bdb4",
    skeletonBg:   dark ? "#1c1c1a" : "#f4f3ee",
    text:         dark ? "#c2c0b6" : "#2d2d2a",
    textDim:      dark ? "#58564e" : "#b8b6ae",
    textSub:      dark ? "#6e6c64" : "#9c9a90",
    line:         dark ? "#2e2e28" : "#dddcd4",
    lineHi:       dark ? "#1a3a5c" : "#bdd7ee",
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
  dark: boolean,
) {
  const C = getColors(dark);
  ctx.clearRect(0, 0, CW, CH);
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, CW, CH);

  const onPath = new Set((pathTo(selectedId, root) ?? []).map((n) => n.id));
  ctx.save();
  ctx.translate(padX - vpX, padY - vpY);

  // edges
  for (const node of nodes) {
    for (const child of node.children) {
      const x1 = node.lx, y1 = node.ly + NH / 2;
      const x2 = child.lx, y2 = child.ly - NH / 2;
      const my = (y1 + y2) / 2;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.bezierCurveTo(x1, my, x2, my, x2, y2);
      if (onPath.has(node.id) && onPath.has(child.id)) {
        ctx.setLineDash([]); ctx.strokeStyle = C.lineHi; ctx.lineWidth = 1.5;
      } else {
        ctx.setLineDash([]); ctx.strokeStyle = C.line; ctx.lineWidth = 0.5;
      }
      ctx.stroke();
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

    // skeleton nodes: dashed ghost outline, no fill dot
    if (isSkel) {
      ctx.beginPath();
      ctx.roundRect(nx, ny, NW, NH, 5);
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
    ctx.roundRect(nx, ny, NW, NH, 5);
    ctx.fillStyle = isSaved
      ? (isHov ? C.nodeHov : C.savedBg)
      : (isHov ? C.nodeHov : isDim ? C.nodeDim : C.nodeBg);
    ctx.fill();

    // border
    ctx.setLineDash([]);
    if (isSel) {
      ctx.strokeStyle = nodeColor(node.tone, C); ctx.lineWidth = 1.5;
    } else if (isSaved) {
      ctx.strokeStyle = isDim ? C.savedBorder : C.saved; ctx.lineWidth = 1;
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
      ctx.fillStyle = isDim ? C.savedBorder : C.saved;
      ctx.fill();
      ctx.beginPath(); ctx.arc(dx, dy, 1.5, 0, Math.PI * 2);
      ctx.fillStyle = C.savedBg;
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
    ctx.font = `${isSel ? "500" : "400"} 9px system-ui,sans-serif`;
    ctx.fillStyle = isSaved ? (isDim ? C.savedBorder : C.saved) : (isDim ? C.textDim : C.text);
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
