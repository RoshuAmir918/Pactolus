export type Tab = "chat" | "runs";
export type NodeTone = "done" | "active" | "saved";

export interface TreeNode {
  id: string;
  label: string;
  meta: string;
  tone: NodeTone;
  parent: string | null;
  branchId?: string;
  documentId?: string;
  children: TreeNode[];
  lx: number;
  ly: number;
}

export type { ExcelAction, ChatMessage } from "@/features/types";
