export type Snapshot = {
  workbookName: string;
  sheetName: string;
  selectedAddress: string;
  rowCount: number;
  columnCount: number;
  headers: string[];
  sampleRows: string[][];
};

export type Suggestion = {
  value: string;
  reason: string;
  confidence: number;
};

export type LiveHintSuggestion = {
  sourceColumn: string;
  confidence: number;
  sourceContextDocumentId: string;
  matchMethod: "exact" | "substring" | "token_overlap" | "semantic_ai";
};

export type MonitoredRegion = {
  id?: string;
  snapshotId?: string;
  sheetName?: string;
  address: string;
  regionType: "input" | "output";
  confidencePercent: number;
  userConfirmed: boolean;
  status?: "active" | "archived";
  reason?: string;
  evidence?: string[];
};

export type RunSession = {
  runId: string | null;
  branchId: string | null;
  lastStepId: string | null;
  startedAtIso: string | null;
};

export type RunOption = {
  id: string;
  name: string;
  status: string;
  createdByName: string;
  createdAt: Date;
};

export type BranchOption = {
  id: string;
  name: string;
  status: string;
};

export type ClientOption = {
  id: string;
  name: string;
  status: string;
};

export type SnapshotOption = {
  id: string;
  clientId: string;
  label: string;
  status: string;
  accountingPeriod: string | null;
};

export type SourceDocument = {
  id: string;
  filename: string;
  fileExtension: string | null;
  documentType: string;
  fileSizeBytes: number;
};

export interface ExcelAction {
  type: "write_range";
  startCell: string;
  values: unknown[][];
  sheetName?: string;
  description: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  action?: ExcelAction | null;
}

export type UiPage = "auth" | "run" | "workspace";

export type StepRecord = {
  id: string;
  stepIndex: number;
  stepType: string;
  parametersJson: unknown;
  branchId: string;
  documentId: string | null;
};
