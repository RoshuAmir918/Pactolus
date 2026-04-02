import type { OperationRecord } from "@/features/types";
import type { NodeTone, TreeNode } from "../types";

export const NW = 88;
export const NH = 26;
export const HGAP = 10;
export const VGAP = 42;
export const PADDING = 14;

export function subtreeW(node: TreeNode): number {
  if (!node.children.length) return NW;
  return Math.max(
    NW,
    node.children.reduce((s, c) => s + subtreeW(c), 0) + HGAP * (node.children.length - 1),
  );
}

export function assignPos(node: TreeNode, x: number, y: number): void {
  const sw = subtreeW(node);
  node.lx = x + sw / 2;
  node.ly = y;
  let cx = x;
  for (const c of node.children) {
    assignPos(c, cx, y + VGAP);
    cx += subtreeW(c) + HGAP;
  }
}

export function allNodes(node: TreeNode, acc: TreeNode[] = []): TreeNode[] {
  acc.push(node);
  node.children.forEach((c) => allNodes(c, acc));
  return acc;
}

export function pathTo(targetId: string, node: TreeNode, path: TreeNode[] = []): TreeNode[] | null {
  if (node.id === targetId) return [...path, node];
  for (const c of node.children) {
    const r = pathTo(targetId, c, [...path, node]);
    if (r) return r;
  }
  return null;
}

export function cloneTree(node: TreeNode): TreeNode {
  return { ...node, children: node.children.map(cloneTree) };
}

// ── tree building ──────────────────────────────────────────────────────────────

function make(
  id: string, label: string, meta: string, tone: NodeTone,
  parent: string | null, documentId?: string,
): TreeNode {
  return { id, label, meta, tone, parent, documentId, children: [], lx: 0, ly: 0 };
}

/**
 * Build the tree directly from parentOperationId relationships.
 * Superseded operations are hidden unless they are a parent of a visible operation.
 */
export function buildTreeFromOperations(operations: OperationRecord[]): TreeNode {
  const ingest = make("ingest", "Ingest", "source data", "done", null);
  const nodeById = new Map<string, TreeNode>();
  nodeById.set("ingest", ingest);

  // Which operations are superseded?
  const supersededIds = new Set(
    operations.map((o) => o.supersedesOperationId).filter(Boolean) as string[],
  );
  // Which superseded operations are parents of visible ones? Keep them.
  const parentIds = new Set(
    operations.map((o) => o.parentOperationId).filter(Boolean) as string[],
  );
  const mustKeep = new Set([...parentIds].filter((id) => supersededIds.has(id)));

  const visible = operations
    .filter(
      (o) =>
        o.operationType === "scenario_snapshot" &&
        (!supersededIds.has(o.id) || mustKeep.has(o.id)),
    )
    .sort((a, b) => a.operationIndex - b.operationIndex);

  for (const op of visible) {
    const params = op.parametersJson as { label?: string } | null;
    const label = params?.label ?? "Saved";
    const meta = op.createdAt
      ? new Date(op.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })
      : "";

    const parentNode =
      op.parentOperationId
        ? (nodeById.get(op.parentOperationId) ?? ingest)
        : ingest;

    const node = make(op.id, label, meta, "saved", parentNode.id, op.documentId ?? undefined);
    nodeById.set(op.id, node);
    parentNode.children.push(node);
  }

  assignPos(ingest, 0, 0);
  return ingest;
}

// ── skeleton overlay ───────────────────────────────────────────────────────────

/**
 * Adds skeleton nodes to the tree for the selected anchor:
 *   __skeleton_seq  — child of anchor (in sequence)
 *   __skeleton_par  — sibling of anchor (child of anchor's parent), only if anchor has a parent
 */
export function withSkeletons(root: TreeNode, anchorId?: string | null): TreeNode {
  const cloned = cloneTree(root);
  const flat = allNodes(cloned);

  const anchor = anchorId ? flat.find((n) => n.id === anchorId) ?? null : null;

  if (!anchor) {
    assignPos(cloned, 0, 0);
    return cloned;
  }

  // In-sequence: always a child of anchor
  anchor.children.push({
    id: "__skeleton_seq",
    label: "+ in sequence",
    meta: "",
    tone: "skeleton",
    parent: anchor.id,
    children: [],
    lx: 0,
    ly: 0,
  });

  // In-parallel: sibling of anchor (child of anchor's parent), only if anchor has a parent
  if (anchor.parent) {
    const anchorParent = flat.find((n) => n.id === anchor.parent);
    if (anchorParent) {
      anchorParent.children.push({
        id: "__skeleton_par",
        label: "+ in parallel",
        meta: "",
        tone: "skeleton",
        parent: anchor.parent,
        children: [],
        lx: 0,
        ly: 0,
      });
    }
  }

  assignPos(cloned, 0, 0);
  return cloned;
}
