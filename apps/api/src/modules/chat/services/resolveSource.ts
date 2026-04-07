import { and, eq } from "drizzle-orm";
import dbClient from "@api/db/client";
import {
  documentSheets,
  runPipelineContext,
  runOperationCaptures,
  runOperationNotes,
} from "@db/schema";

const { db } = dbClient;

export async function resolveSource(
  sourceType: string,
  sourceId: string,
  orgId: string,
): Promise<string> {
  if (sourceType === "document_sheet") {
    const [sheet] = await db
      .select({
        sheetName: documentSheets.sheetName,
        headersJson: documentSheets.headersJson,
        sampleRowsJson: documentSheets.sampleRowsJson,
        detectedTablesJson: documentSheets.detectedTablesJson,
        rowCountEstimate: documentSheets.rowCountEstimate,
      })
      .from(documentSheets)
      .where(and(eq(documentSheets.id, sourceId), eq(documentSheets.orgId, orgId)))
      .limit(1);

    if (!sheet) return "Source not found.";
    return JSON.stringify(
      {
        sheetName: sheet.sheetName,
        headers: sheet.headersJson,
        sampleRows: sheet.sampleRowsJson,
        detectedTables: sheet.detectedTablesJson,
        totalRows: sheet.rowCountEstimate,
      },
      null,
      2,
    );
  }

  if (sourceType === "run_pipeline_context") {
    const [ctx] = await db
      .select({ contextType: runPipelineContext.contextType, dataJson: runPipelineContext.dataJson })
      .from(runPipelineContext)
      .where(eq(runPipelineContext.id, sourceId))
      .limit(1);

    if (!ctx) return "Pipeline context not found.";
    return JSON.stringify(ctx.dataJson, null, 2);
  }

  if (sourceType === "run_step_capture") {
    const [cap] = await db
      .select({ payloadJson: runOperationCaptures.payloadJson })
      .from(runOperationCaptures)
      .where(eq(runOperationCaptures.id, sourceId))
      .limit(1);

    if (!cap) return "Capture not found.";
    return JSON.stringify(cap.payloadJson, null, 2);
  }

  if (sourceType === "operation_note") {
    const [note] = await db
      .select({ noteText: runOperationNotes.noteText, updatedAt: runOperationNotes.updatedAt })
      .from(runOperationNotes)
      .where(eq(runOperationNotes.runOperationId, sourceId))
      .limit(1);

    if (!note?.noteText) return "No analyst note recorded for this operation.";
    return JSON.stringify({ noteText: note.noteText, updatedAt: note.updatedAt }, null, 2);
  }

  return "Unknown source type.";
}
