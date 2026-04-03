export type Tab = "chat" | "runs";
export type NodeTone = "done" | "active" | "saved" | "skeleton";

export interface TreeNode {
  id: string;
  label: string;
  meta: string;
  tone: NodeTone;
  parent: string | null;
  branchRootId?: string;
  documentId?: string;
  children: TreeNode[];
  lx: number;
  ly: number;
}

/**
 * SaveContext drives every save action. The parentStepId is the committed step
 * that the new node hangs off (null = root, i.e. first step after ingest).
 */
export type SaveContext =
  | { kind: "seq";    parentStepId: string | null }  // in sequence: child of parentStepId
  | { kind: "par";    parentStepId: string | null }  // in parallel: sibling (same parent as anchor)
  | { kind: "update"; stepId: string };               // supersede an existing node in place

export type { ExcelAction, ChatMessage } from "@/features/types";
