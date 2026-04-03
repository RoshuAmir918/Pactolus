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
  currentOperationId: string | null;  // the last saved operation (determines active position in tree)
  startedAtIso: string | null;
};

export type RunOption = {
  id: string;
  name: string;
  status: string;
  createdByName: string;
  createdAt: Date;
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

export type OperationRecord = {
  id: string;
  operationIndex: number;
  operationType: string;
  parametersJson: unknown;
  parentOperationId: string | null;
  supersedesOperationId: string | null;
  documentId: string | null;
  createdAt: Date | null;
  authorName: string | null;
};
