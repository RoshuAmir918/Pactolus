import dbClient from "@api/db/client";
import { insertRunOperationCapture } from "@db/schema/operations/runHistory";
import { assertRunAccess } from "./assertRunAccess";

const { db } = dbClient;

export type SaveOperationCaptureInput = {
  orgId: string;
  runId: string;
  runOperationId: string;
  captureType: string;
  payloadJson: unknown;
  summaryText?: string | null;
};

export type SaveOperationCaptureResult = {
  captureId: string;
  runOperationId: string;
  captureType: string;
};

export async function saveOperationCapture(
  input: SaveOperationCaptureInput,
): Promise<SaveOperationCaptureResult> {
  await assertRunAccess({ runId: input.runId, orgId: input.orgId });

  const created = await insertRunOperationCapture(db, {
    runOperationId: input.runOperationId,
    captureType: input.captureType,
    payloadJson: input.payloadJson,
    summaryText: input.summaryText ?? null,
  });

  return {
    captureId: created.id,
    runOperationId: created.runOperationId,
    captureType: created.captureType,
  };
}
