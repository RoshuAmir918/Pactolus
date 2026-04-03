import { useRef, useEffect, useCallback } from "react";
import { Minus, Plus } from "lucide-react";
import type { TreeNode } from "../types";
import { NW, NH, PADDING, allNodes } from "./layout";
import { drawScene } from "./draw";

export function RunTreeCanvas(props: {
  root: TreeNode;
  initialSelectedId: string;
  onSelectNode: (id: string, branchId?: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const displayNodesRef = useRef<TreeNode[]>([]);
  const s = useRef({
    vpX: 0, vpY: 0, targetVpX: 0, targetVpY: 0,
    zoom: 0.78,
    selectedId: props.initialSelectedId,
    hoverId: null as string | null,
    vpRafId: null as number | null,
    layoutRafId: null as number | null,
    isDragging: false,
    didDrag: false,
    suppressClick: false,
    dragStartX: 0,
    dragStartY: 0,
    dragStartVpX: 0,
    dragStartVpY: 0,
    padX: 0, padY: 0,
    minX: 0, maxX: 0, minY: 0, maxY: 0,
    CW: 0, CH: 0,
    touchStartX: 0, touchStartY: 0, swept: false,
  });

  const nodes = allNodes(props.root);
  const MIN_W = 280;
  const MIN_H = 210;
  const MIN_ZOOM = 0.58;
  const MAX_ZOOM = 1.35;

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const st = s.current;
    const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const dpr = window.devicePixelRatio || 1;
    drawScene(
      ctx, displayNodesRef.current, props.root, st.selectedId, st.hoverId,
      st.vpX, st.vpY, st.padX, st.padY,
      st.CW / dpr, st.CH / dpr, st.zoom, dark,
    );
  }, [props.root]);

  function clampVp(tx: number, ty: number) {
    const st = s.current;
    const dpr = window.devicePixelRatio || 1;
    const CW = (st.CW / dpr) / st.zoom;
    const CH = (st.CH / dpr) / st.zoom;
    return {
      x: Math.min(Math.max(tx, st.padX + st.minX - PADDING), Math.max(0, st.padX + st.maxX - CW + PADDING)),
      y: Math.min(Math.max(ty, st.padY + st.minY - PADDING), Math.max(0, st.padY + st.maxY - CH + PADDING)),
    };
  }

  function animateVp() {
    const st = s.current;
    if (st.vpRafId) cancelAnimationFrame(st.vpRafId);
    if (st.isDragging) return;
    const fromX = st.vpX;
    const fromY = st.vpY;
    const toX = st.targetVpX;
    const toY = st.targetVpY;
    const duration = 240;
    const startedAt = performance.now();

    function step() {
      const t = Math.min(1, (performance.now() - startedAt) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      st.vpX = fromX + (toX - fromX) * eased;
      st.vpY = fromY + (toY - fromY) * eased;
      redraw();
      if (t < 1) {
        st.vpRafId = requestAnimationFrame(step);
      } else {
        st.vpX = toX;
        st.vpY = toY;
        redraw();
      }
    }
    st.vpRafId = requestAnimationFrame(step);
  }

  function snapTo(id: string) {
    const node = displayNodesRef.current.find((n) => n.id === id) ?? nodes.find((n) => n.id === id);
    if (!node) return;
    const st = s.current;
    const dpr = window.devicePixelRatio || 1;
    const CW = (st.CW / dpr) / st.zoom;
    const CH = (st.CH / dpr) / st.zoom;
    // Keep the selected node slightly above center so skeleton children stay visible.
    const { x, y } = clampVp(node.lx + st.padX - CW / 2, node.ly + st.padY - CH * 0.44);
    st.targetVpX = x; st.targetVpY = y;
    animateVp();
  }

  function selectNode(id: string) {
    const st = s.current;
    const isSkeleton = id.startsWith("__skeleton_");
    if (!isSkeleton && id === st.selectedId) return;
    // Toggling a skeleton deselects it visually; selecting a real node clears skeleton selection
    st.selectedId = isSkeleton && id === st.selectedId ? "" : id;
    const node = displayNodesRef.current.find((n) => n.id === id) ?? nodes.find((n) => n.id === id);
    props.onSelectNode(id, node?.branchId);
    snapTo(id);
  }

  function nodeAt(mx: number, my: number): TreeNode | undefined {
    const st = s.current;
    const worldX = (mx - (st.padX - st.vpX)) / st.zoom;
    const worldY = (my - (st.padY - st.vpY)) / st.zoom;
    return displayNodesRef.current.find(
      (n) =>
        worldX >= n.lx - NW / 2 && worldX <= n.lx + NW / 2 &&
        worldY >= n.ly - NH / 2 && worldY <= n.ly + NH / 2,
    );
  }

  function panBy(dx: number, dy: number) {
    const st = s.current;
    const { x, y } = clampVp(st.vpX + dx, st.vpY + dy);
    st.targetVpX = x;
    st.targetVpY = y;
    animateVp();
  }

  function setZoom(next: number) {
    const st = s.current;
    const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next));
    if (Math.abs(zoom - st.zoom) < 0.001) return;

    const dpr = window.devicePixelRatio || 1;
    const CW = st.CW / dpr;
    const CH = st.CH / dpr;
    const screenCX = CW / 2;
    const screenCY = CH / 2;
    const worldCX = (screenCX - (st.padX - st.vpX)) / st.zoom;
    const worldCY = (screenCY - (st.padY - st.vpY)) / st.zoom;

    st.zoom = zoom;
    const nextVpX = st.padX - (screenCX - worldCX * st.zoom);
    const nextVpY = st.padY - (screenCY - worldCY * st.zoom);
    const clamped = clampVp(nextVpX, nextVpY);
    st.targetVpX = clamped.x;
    st.targetVpY = clamped.y;
    animateVp();
    redraw();
  }

  const fitCanvas = useCallback((recenterToSelected: boolean) => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const dpr = window.devicePixelRatio || 1;
    const CW = Math.max(MIN_W, Math.floor(container.clientWidth));
    const CH = Math.max(MIN_H, Math.floor(container.clientHeight));
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
    st.padY = (CH - (maxY - minY)) / 2 - minY;
    const clamped = clampVp(st.vpX, st.vpY);
    st.targetVpX = clamped.x;
    st.targetVpY = clamped.y;
    if (Math.abs(st.vpX - clamped.x) > 1 || Math.abs(st.vpY - clamped.y) > 1) {
      animateVp();
    } else {
      st.vpX = clamped.x;
      st.vpY = clamped.y;
    }
    redraw();
    if (recenterToSelected) {
      const preferredId = st.selectedId || props.initialSelectedId || "ingest";
      const targetId = nodes.some((n) => n.id === preferredId) ? preferredId : "ingest";
      snapTo(targetId);
    }
  }, [nodes, props.initialSelectedId, redraw]);

  const animateLayout = useCallback((toNodes: TreeNode[]) => {
    const st = s.current;
    if (st.layoutRafId) cancelAnimationFrame(st.layoutRafId);

    const fromNodes = displayNodesRef.current;
    const fromById = new Map(fromNodes.map((n) => [n.id, n]));
    const fallbackById = new Map(toNodes.map((n) => [n.id, n]));
    const startNodes = toNodes.map((n) => {
      const exact = fromById.get(n.id);
      const parent = n.parent ? fromById.get(n.parent) : undefined;
      return {
        ...n,
        lx: exact?.lx ?? parent?.lx ?? fallbackById.get(n.parent ?? "")?.lx ?? n.lx,
        ly: exact?.ly ?? parent?.ly ?? fallbackById.get(n.parent ?? "")?.ly ?? n.ly,
      };
    });

    const duration = 220;
    const startedAt = performance.now();

    function step(now: number) {
      const t = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      displayNodesRef.current = toNodes.map((targetNode, idx) => {
        const startNode = startNodes[idx];
        return {
          ...targetNode,
          lx: startNode.lx + (targetNode.lx - startNode.lx) * eased,
          ly: startNode.ly + (targetNode.ly - startNode.ly) * eased,
        };
      });
      redraw();
      if (t < 1) {
        st.layoutRafId = requestAnimationFrame(step);
      } else {
        displayNodesRef.current = toNodes;
        redraw();
      }
    }

    st.layoutRafId = requestAnimationFrame(step);
  }, [redraw]);

  useEffect(() => {
    const st = s.current;
    const hasPrev = displayNodesRef.current.length > 0;
    if (!hasPrev) {
      displayNodesRef.current = nodes;
      fitCanvas(true);
      return;
    }

    fitCanvas(false);
    animateLayout(nodes);
    const preferredId = st.selectedId || props.initialSelectedId || "ingest";
    const targetId = nodes.some((n) => n.id === preferredId) ? preferredId : "ingest";
    snapTo(targetId);
  }, [animateLayout, fitCanvas, nodes, props.initialSelectedId]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => fitCanvas(false));
    observer.observe(container);
    return () => observer.disconnect();
  }, [fitCanvas]);

  useEffect(() => {
    return () => {
      const st = s.current;
      if (st.vpRafId) cancelAnimationFrame(st.vpRafId);
      if (st.layoutRafId) cancelAnimationFrame(st.layoutRafId);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative rounded-xl border border-border bg-card overflow-hidden w-full h-[288px]"
    >
      <canvas
        ref={canvasRef}
        style={{ display: "block" }}
        onMouseDown={(e) => {
          const st = s.current;
          st.isDragging = true;
          st.didDrag = false;
          st.dragStartX = e.clientX;
          st.dragStartY = e.clientY;
          st.dragStartVpX = st.vpX;
          st.dragStartVpY = st.vpY;
          if (canvasRef.current) canvasRef.current.style.cursor = "grabbing";
        }}
        onMouseMove={(e) => {
          const st = s.current;
          if (st.isDragging) {
            const dx = e.clientX - st.dragStartX;
            const dy = e.clientY - st.dragStartY;
            if (Math.abs(dx) > 3 || Math.abs(dy) > 3) st.didDrag = true;
            const clamped = clampVp(st.dragStartVpX - dx / st.zoom, st.dragStartVpY - dy / st.zoom);
            st.vpX = clamped.x;
            st.vpY = clamped.y;
            st.targetVpX = clamped.x;
            st.targetVpY = clamped.y;
            redraw();
            return;
          }
          const r = canvasRef.current!.getBoundingClientRect();
          const n = nodeAt(e.clientX - r.left, e.clientY - r.top);
          const newHov = n?.id ?? null;
          if (newHov !== st.hoverId) {
            st.hoverId = newHov;
            if (canvasRef.current) canvasRef.current.style.cursor = newHov ? "pointer" : "grab";
            redraw();
          }
        }}
        onMouseUp={() => {
          const st = s.current;
          st.isDragging = false;
          st.suppressClick = st.didDrag;
          if (canvasRef.current) canvasRef.current.style.cursor = st.hoverId ? "pointer" : "grab";
        }}
        onMouseLeave={() => {
          const st = s.current;
          st.hoverId = null;
          st.isDragging = false;
          if (canvasRef.current) canvasRef.current.style.cursor = "grab";
          redraw();
        }}
        onClick={(e) => {
          if (s.current.suppressClick) {
            s.current.suppressClick = false;
            return;
          }
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
      <div className="absolute top-2 right-2">
        <div className="rounded-md border border-border/60 bg-background/70 backdrop-blur-sm p-0.5 flex items-center gap-0.5 shadow-sm opacity-80 hover:opacity-100 transition-opacity">
          <button
            type="button"
            className="h-5 w-5 rounded-sm hover:bg-muted/60 transition-colors flex items-center justify-center text-muted-foreground hover:text-foreground"
            onClick={() => setZoom(s.current.zoom * 1.12)}
            title="Zoom in"
          >
            <Plus className="size-3" />
          </button>
          <button
            type="button"
            className="h-5 w-5 rounded-sm hover:bg-muted/60 transition-colors flex items-center justify-center text-muted-foreground hover:text-foreground"
            onClick={() => setZoom(s.current.zoom / 1.12)}
            title="Zoom out"
          >
            <Minus className="size-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
