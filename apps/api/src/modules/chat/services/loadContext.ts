import { and, eq } from "drizzle-orm";
import dbClient from "@api/db/client";
import {
  documentSheets,
  documents,
  runPipelineContext,
  runOperationCaptures,
  runOperationNotes,
  runOperations,
} from "@db/schema";

const { db } = dbClient;

export type SheetRow = {
  id: string;
  filename: string;
  sheetName: string;
  sheetType: string;
  rowCountEstimate: number | null;
  headersJson: unknown;
  sheetAboutJson: unknown;
};

export type PipelineContextRow = {
  id: string;
  operationType: string;
  contextType: string;
  dataJson: unknown;
};

export type CaptureRow = {
  id: string;
  operationId: string;
  operationType: string;
  captureType: string;
  summaryText: string | null;
};

export type FocusedNode = {
  label: string | null;
  operationIndex: number;
  createdAt: Date | null;
  noteText: string | null;
  captures: Array<{ id: string; captureType: string; summaryText: string | null }>;
};

export async function loadSnapshotSheets(snapshotId: string, orgId: string): Promise<SheetRow[]> {
  return db
    .select({
      id: documentSheets.id,
      filename: documents.filename,
      sheetName: documentSheets.sheetName,
      sheetType: documentSheets.sheetType,
      rowCountEstimate: documentSheets.rowCountEstimate,
      headersJson: documentSheets.headersJson,
      sheetAboutJson: documentSheets.sheetAboutJson,
    })
    .from(documentSheets)
    .innerJoin(documents, eq(documents.id, documentSheets.documentId))
    .where(and(eq(documentSheets.snapshotId, snapshotId), eq(documentSheets.orgId, orgId)))
    .orderBy(documents.filename, documentSheets.sheetIndex);
}

export async function loadRunContext(runId: string): Promise<{
  pipelineContext: PipelineContextRow[];
  captures: CaptureRow[];
}> {
  const [pipelineRows, captureRows] = await Promise.all([
    db
      .select({
        id: runPipelineContext.id,
        operationType: runOperations.operationType,
        contextType: runPipelineContext.contextType,
        dataJson: runPipelineContext.dataJson,
      })
      .from(runPipelineContext)
      .innerJoin(runOperations, eq(runOperations.id, runPipelineContext.runStepId))
      .where(eq(runOperations.runId, runId))
      .orderBy(runOperations.operationIndex),
    db
      .select({
        id: runOperationCaptures.id,
        operationId: runOperations.id,
        operationType: runOperations.operationType,
        captureType: runOperationCaptures.captureType,
        summaryText: runOperationCaptures.summaryText,
      })
      .from(runOperationCaptures)
      .innerJoin(runOperations, eq(runOperations.id, runOperationCaptures.runOperationId))
      .where(eq(runOperations.runId, runId))
      .orderBy(runOperations.operationIndex),
  ]);

  return {
    pipelineContext: pipelineRows.filter((r) => r.contextType !== "AI_RAW_RESPONSE"),
    captures: captureRows,
  };
}

export async function loadFocusedNode(
  runId: string,
  operationId: string,
): Promise<FocusedNode | null> {
  const [op] = await db
    .select({
      parametersJson: runOperations.parametersJson,
      operationIndex: runOperations.operationIndex,
      createdAt: runOperations.createdAt,
    })
    .from(runOperations)
    .where(and(eq(runOperations.id, operationId), eq(runOperations.runId, runId)))
    .limit(1);

  if (!op) return null;

  const [note, captures] = await Promise.all([
    db
      .select({ noteText: runOperationNotes.noteText })
      .from(runOperationNotes)
      .where(eq(runOperationNotes.runOperationId, operationId))
      .limit(1)
      .then((r) => r[0] ?? null),
    db
      .select({
        id: runOperationCaptures.id,
        captureType: runOperationCaptures.captureType,
        summaryText: runOperationCaptures.summaryText,
      })
      .from(runOperationCaptures)
      .where(eq(runOperationCaptures.runOperationId, operationId)),
  ]);

  const params = op.parametersJson as Record<string, unknown> | null;
  return {
    label: (typeof params?.label === "string" ? params.label : null) ?? null,
    operationIndex: op.operationIndex,
    createdAt: op.createdAt ?? null,
    noteText: note?.noteText ?? null,
    captures,
  };
}
