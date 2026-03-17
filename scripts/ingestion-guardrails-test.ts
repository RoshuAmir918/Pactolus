import assert from "node:assert/strict";
import { ingestionGuardrails } from "../apps/api/src/modules/ingestion/services/ingestDocument";

function run() {
  assert.equal(ingestionGuardrails.shouldAllowClaudeDocument(1024), true);
  assert.equal(ingestionGuardrails.shouldAllowClaudeDocument(8 * 1024 * 1024), true);
  assert.equal(ingestionGuardrails.shouldAllowClaudeDocument(8 * 1024 * 1024 + 1), false);
  console.log("ingestion-guardrails-test: ok");
}

run();
