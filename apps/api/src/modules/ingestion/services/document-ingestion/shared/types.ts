export type StartDocumentIngestionInput = {
  orgId: string;
  snapshotId: string;
  documentId: string;
};

export type GetDocumentIngestionStatusInput = StartDocumentIngestionInput;

export type DocumentType = "claims" | "policies" | "loss_triangles" | "workbook_tool" | "other";

export type DocumentAiClassification =
  | "claims"
  | "policies"
  | "loss_triangles"
  | "workbook_tool"
  | "other"
  | "unknown";

export type ClaudeToolDefinition = {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
};

export type ClaudeWorkbookRoutingResult = {
  documentType: DocumentType;
  aiClassification: DocumentAiClassification;
  aiConfidence: string | null;
  sheetClassifications: Array<{
    sheetIndex: number;
    sheetType: "claims_like" | "policies_like" | "triangle_like" | "tool_sheet" | "other" | "unknown";
    aiClassification:
      | "claims_like"
      | "policies_like"
      | "triangle_like"
      | "tool_sheet"
      | "other"
      | "unknown";
    aiConfidence: string | null;
  }>;
};

export type TargetDocument = {
  documentId: string;
  orgId: string;
  snapshotId: string;
  filename: string;
  fileExtension: string | null;
  fileSizeBytes: number;
  mimeType: string;
  bucket: string;
  objectKey: string;
  deletedAt: Date | null;
  fileStatus: string;
};

export type DocumentIngestionStatusResult = {
  documentId: string;
  profileStatus: "pending" | "completed" | "failed";
  aiStatus: "pending" | "completed" | "failed";
  documentType: DocumentType;
  aiClassification: DocumentAiClassification;
  sheetCount: number;
  triangleCount: number;
  errorText: string | null;
};
