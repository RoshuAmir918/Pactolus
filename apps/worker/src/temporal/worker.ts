import { createTemporalClient } from "./client.js";

export function runWorker() {
  const client = createTemporalClient();
  console.log(`Worker scaffold running. Temporal target: ${client.address}`);
}
