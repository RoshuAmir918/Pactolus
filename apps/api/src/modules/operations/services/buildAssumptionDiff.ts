import type { runOperations } from "@db/schema";

type AssumptionStateValue = {
  valueJson: unknown;
  confidence: number | null;
  rationale: string | null;
  sourceStepId: string;
};

export type AssumptionDiffResult = {
  baselineCount: number;
  finalCount: number;
  added: Array<{
    assumptionKey: string;
    after: AssumptionStateValue;
  }>;
  removed: Array<{
    assumptionKey: string;
    before: AssumptionStateValue;
  }>;
  modified: Array<{
    assumptionKey: string;
    before: AssumptionStateValue;
    after: AssumptionStateValue;
    changedFields: Array<"value" | "confidence" | "rationale">;
  }>;
};

type RunStep = typeof runOperations.$inferSelect;

export function buildAssumptionDiff(input: {
  baselineSteps: RunStep[];
  finalSteps: RunStep[];
}): AssumptionDiffResult {
  const baseline = replayAssumptionState(input.baselineSteps);
  const finalState = replayAssumptionState(input.finalSteps);
  const keys = new Set<string>([...baseline.keys(), ...finalState.keys()]);

  const added: AssumptionDiffResult["added"] = [];
  const removed: AssumptionDiffResult["removed"] = [];
  const modified: AssumptionDiffResult["modified"] = [];

  for (const key of keys) {
    const before = baseline.get(key);
    const after = finalState.get(key);
    if (!before && after) {
      added.push({ assumptionKey: key, after });
      continue;
    }
    if (before && !after) {
      removed.push({ assumptionKey: key, before });
      continue;
    }
    if (before && after) {
      const changedFields: Array<"value" | "confidence" | "rationale"> = [];
      if (!jsonEqual(before.valueJson, after.valueJson)) {
        changedFields.push("value");
      }
      if (before.confidence !== after.confidence) {
        changedFields.push("confidence");
      }
      if (before.rationale !== after.rationale) {
        changedFields.push("rationale");
      }
      if (changedFields.length > 0) {
        modified.push({
          assumptionKey: key,
          before,
          after,
          changedFields,
        });
      }
    }
  }

  return {
    baselineCount: baseline.size,
    finalCount: finalState.size,
    added,
    removed,
    modified,
  };
}

function replayAssumptionState(steps: RunStep[]): Map<string, AssumptionStateValue> {
  const state = new Map<string, AssumptionStateValue>();

  for (const step of steps) {
    if (step.stepType !== "assumption_set" && step.stepType !== "assumption_update") {
      if (step.stepType === "assumption_unset") {
        const payload = toRecord(step.parametersJson);
        const assumptionKey = toNonEmptyString(payload.assumptionKey);
        if (assumptionKey) {
          state.delete(assumptionKey);
        }
      }
      continue;
    }

    const payload = toRecord(step.parametersJson);
    const assumptionKey = toNonEmptyString(payload.assumptionKey);
    if (!assumptionKey) {
      continue;
    }

    state.set(assumptionKey, {
      valueJson:
        payload.valueJson !== undefined
          ? payload.valueJson
          : payload.value !== undefined
            ? payload.value
            : null,
      confidence: toNullableNumber(payload.confidence),
      rationale: toNullableString(payload.rationale),
      sourceStepId: step.id,
    });
  }

  return state;
}

function jsonEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function toRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function toNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toNullableString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toNullableNumber(value: unknown): number | null {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return null;
  }
  if (value < 0) {
    return 0;
  }
  if (value > 1) {
    return 1;
  }
  return Math.round(value * 100) / 100;
}
