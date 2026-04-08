import { and, eq } from "drizzle-orm";
import dbClient from "@api/db/client";
import {
  documentSheets,
  documentTriangles,
  documents,
  runPipelineContext,
  runOperationCaptures,
  runOperationNotes,
  runOperations,
} from "@db/schema";

const { db } = dbClient;

export async function loadSnapshotTriangles(snapshotId: string, orgId: string) {
  return db
    .select({
      id: documentTriangles.id,
      filename: documents.filename,
      sheetName: documentSheets.sheetName,
      title: documentTriangles.title,
      segmentLabel: documentTriangles.segmentLabel,
      triangleType: documentTriangles.triangleType,
      confidence: documentTriangles.confidence,
    })
    .from(documentTriangles)
    .innerJoin(documentSheets, eq(documentSheets.id, documentTriangles.sheetId))
    .innerJoin(documents, eq(documents.id, documentTriangles.documentId))
    .where(and(eq(documentTriangles.snapshotId, snapshotId), eq(documentTriangles.orgId, orgId)))
    .orderBy(documents.filename, documentSheets.sheetIndex);
}

export async function loadSnapshotSheets(snapshotId: string, orgId: string) {
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

export async function loadRunContext(runId: string) {
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

export async function loadFocusedNode(runId: string, operationId: string) {
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

export type TriangleRow = Awaited<ReturnType<typeof loadSnapshotTriangles>>[number];
export type SheetRow = Awaited<ReturnType<typeof loadSnapshotSheets>>[number];
export type PipelineContextRow = Awaited<ReturnType<typeof loadRunContext>>["pipelineContext"][number];
export type CaptureRow = Awaited<ReturnType<typeof loadRunContext>>["captures"][number];
export type FocusedNode = NonNullable<Awaited<ReturnType<typeof loadFocusedNode>>>;
