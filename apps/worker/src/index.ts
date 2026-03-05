import { createIngestionWorker } from "./temporal/workers/ingestion";
import { env } from "./env";

async function main(): Promise<void> {
  const worker = await createIngestionWorker();
  const taskQueue = env.TEMPORAL_INGESTION_TASK_QUEUE ?? env.TEMPORAL_TASK_QUEUE;
  console.log(
    `[worker] Listening on queue "${taskQueue}" in namespace "${env.TEMPORAL_NAMESPACE}"`,
  );
  await worker.run();
}

main().catch((error) => {
  console.error("[worker] Fatal startup error", error);
  process.exit(1);
});
