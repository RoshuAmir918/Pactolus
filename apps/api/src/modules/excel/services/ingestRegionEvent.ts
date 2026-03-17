import { assertSnapshotAccess } from "@api/modules/guards/services/assertSnapshotAccess";

export type IngestRegionEventInput = {
  orgId: string;
  snapshotId: string;
  sheetName: string;
  address: string;
  eventType: "input_change" | "output_change";
  detailsJson?: unknown;
};

export type IngestRegionEventResult = {
  ok: true;
  receivedAt: Date;
};

export async function ingestRegionEvent(
  input: IngestRegionEventInput,
): Promise<IngestRegionEventResult> {
  await assertSnapshotAccess({
    snapshotId: input.snapshotId,
    orgId: input.orgId,
  });

  // V1: lightweight ingestion confirmation for workflow validation.
  // Persistence/queue fan-out can be added in the next iteration.
  return {
    ok: true,
    receivedAt: new Date(),
  };
}
