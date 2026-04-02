import { useRef, useEffect, useCallback } from "react";
import type { TreeNode } from "../types";
import { NW, NH, PADDING, allNodes } from "./layout";
import { drawScene } from "./draw";

export function RunTreeCanvas(props: {
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
    drawScene(
      ctx, nodes, props.root, st.selectedId, st.hoverId,
      st.vpX, st.vpY, st.padX, st.padY,
      st.CW / dpr, st.CH / dpr, dark,
    );
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
    const isSkeleton = id.startsWith("__skeleton_");
    if (!isSkeleton && id === st.selectedId) return;
    // Toggling a skeleton deselects it visually; selecting a real node clears skeleton selection
    st.selectedId = isSkeleton && id === st.selectedId ? "" : id;
    const node = nodes.find((n) => n.id === id);
    props.onSelectNode(id, node?.branchId);
    snapTo(id);
  }

  function nodeAt(mx: number, my: number): TreeNode | undefined {
    const st = s.current;
    const tx = st.padX - st.vpX, ty = st.padY - st.vpY;
    return nodes.find(
      (n) =>
        mx >= n.lx - NW / 2 + tx && mx <= n.lx + NW / 2 + tx &&
        my >= n.ly - NH / 2 + ty && my <= n.ly + NH / 2 + ty,
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
