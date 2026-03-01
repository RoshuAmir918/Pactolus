import { env } from "../env.js";

export function createTemporalClient() {
  return {
    address: env.TEMPORAL_ADDRESS,
  };
}
