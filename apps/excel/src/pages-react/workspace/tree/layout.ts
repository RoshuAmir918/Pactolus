import type { BranchOption, StepRecord } from "@/features/types";
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
    node.children.reduce((s, c) => s + subtreeW(c), 0) +
      HGAP * (node.children.length - 1),
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

export function pathTo(
  targetId: string,
  node: TreeNode,
  path: TreeNode[] = [],
): TreeNode[] | null {
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

export function withSkeletons(root: TreeNode): TreeNode {
  const cloned = cloneTree(root);
  const flat = allNodes(cloned);

  // + save here: child of "active" (linear append below it)
  const active = flat.find((n) => n.id === "active");
  if (active) {
    active.children = [
      ...active.children,
      { id: "__skeleton_append", label: "+ save here", meta: "", tone: "skeleton" as const, parent: "active", children: [], lx: 0, ly: 0 },
    ];
  }

  // + new scenario: sibling of "active" (forks from active's parent)
  const parent = active?.parent ? flat.find((n) => n.id === active.parent) : null;
  const forkHost = parent ?? active;
  if (forkHost) {
    forkHost.children = [
      ...forkHost.children,
      { id: "__skeleton_branch", label: "+ new scenario", meta: "", tone: "skeleton" as const, parent: forkHost.id, children: [], lx: 0, ly: 0 },
    ];
  }

  assignPos(cloned, 0, 0);
  return cloned;
}

export function stepLabel(step: StepRecord): string {
  if (step.stepType === "excel_tool") {
    const p = step.parametersJson as { toolName?: string } | null;
    return p?.toolName ?? "Operation";
  }
  return step.stepType;
}

export function buildTreeFromSteps(
  steps: StepRecord[],
  branches: BranchOption[],
  activeBranchId: string | null,
  runId: string | null,
): TreeNode {
  const make = (
    id: string,
    label: string,
    meta: string,
    tone: NodeTone,
    parent: string | null,
    branchId?: string,
    documentId?: string,
  ): TreeNode => ({ id, label, meta, tone, parent, branchId, documentId, children: [], lx: 0, ly: 0 });

  // Last saved documentId per branch (any step with a document = a saved state)
  const lastDocByBranch = new Map<string, string>();
  for (const s of steps) {
    if (s.documentId) lastDocByBranch.set(s.branchId, s.documentId);
  }

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
  const otherBranches = branches.filter((b) => b.id !== activeBranchId);

  const active = make(
    "active",
    activeBranch?.name ?? "Active",
    `run ${runId?.slice(0, 8) ?? "—"}`,
    "active",
    tail.id,
  );

  // Other branches are siblings of active (both children of the last tail node)
  const savedNodes = otherBranches.map((b) =>
    make(
      b.id,
      b.name,
      lastDocByBranch.has(b.id) ? "saved" : "unsaved",
      "saved",
      tail.id,
      b.id,
      lastDocByBranch.get(b.id),
    ),
  );
  tail.children = [active, ...savedNodes];

  assignPos(ingest, 0, 0);
  return ingest;
}
