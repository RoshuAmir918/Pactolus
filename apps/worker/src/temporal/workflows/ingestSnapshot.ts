export async function ingestSnapshotWorkflow(snapshotId: string) {
  return {
    snapshotId,
    status: "queued",
  };
}
