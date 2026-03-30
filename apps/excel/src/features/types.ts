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

export type UiPage = "auth" | "run" | "workspace";
