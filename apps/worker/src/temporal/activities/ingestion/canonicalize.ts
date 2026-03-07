import { and, asc, eq } from "drizzle-orm";
import { mappingProposalSchema, type MappingRule } from "@db/mappingSchema";
import { appendRunStep, insertRunStepArtifact } from "@db/runHistory";
import {
  claimsCanonical,
  ingestionErrors,
  policiesCanonical,
  rawRows,
  runSteps,
  runs,
  snapshotInputs,
  snapshots,
} from "@db/schema";
import { db } from "../../../db/client";
import type { CanonicalizeInput, CanonicalizeResult } from "./types";
import { getCanonicalFieldMap, type CanonicalFieldSpec } from "./canonicalMetadata";

function parseMoney(raw: string, field: string): number {
  const normalized = raw.replace(/[$,%\s]/g, "").replace(/,/g, "");
  const value = Number(normalized);
  if (!Number.isFinite(value)) {
    throw new Error(`Field "${field}" has non-numeric value "${raw}"`);
  }
  return value;
}

function parseDate(raw: string, field: string): string {
  const value = new Date(raw);
  if (Number.isNaN(value.getTime())) {
    throw new Error(`Field "${field}" has invalid date "${raw}"`);
  }
  return value.toISOString().slice(0, 10);
}

function getRuleValue(rule: MappingRule, row: Record<string, unknown>): string | undefined {
  if (rule.transform === "sum" || rule.transform === "parseMoney") {
    const sum = rule.sourceColumns.reduce((total, column) => {
      const raw = String(row[column] ?? "").trim();
      if (raw.length === 0) {
        return total;
      }
      return total + parseMoney(raw, rule.canonicalField);
    }, 0);
    return sum.toFixed(2);
  }

  const firstColumn = rule.sourceColumns[0];
  const raw = String(row[firstColumn] ?? "").trim();
  if (raw.length === 0) {
    return undefined;
  }

  if (rule.transform === "parseDate") {
    return parseDate(raw, rule.canonicalField);
  }

  return raw;
}

function requiredField(
  ruleByField: Map<string, MappingRule>,
  row: Record<string, unknown>,
  field: string,
): string {
  const rule = ruleByField.get(field);
  if (!rule) {
    throw new Error(`Missing mapping rule for required field "${field}"`);
  }
  const value = getRuleValue(rule, row);
  if (!value) {
    throw new Error(`Required field "${field}" resolved to empty value`);
  }
  return value;
}

function optionalField(
  ruleByField: Map<string, MappingRule>,
  row: Record<string, unknown>,
  field: string,
): string | undefined {
  const rule = ruleByField.get(field);
  if (!rule) {
    return undefined;
  }
  const value = getRuleValue(rule, row);
  return value && value.length > 0 ? value : undefined;
}

function requiredDbField(
  ruleByField: Map<string, MappingRule>,
  row: Record<string, unknown>,
  spec: CanonicalFieldSpec,
): [string, string] {
  return [spec.dbField, requiredField(ruleByField, row, spec.canonicalField)];
}

function optionalDbField(
  ruleByField: Map<string, MappingRule>,
  row: Record<string, unknown>,
  spec: CanonicalFieldSpec,
): [string, string | undefined] {
  return [spec.dbField, optionalField(ruleByField, row, spec.canonicalField)];
}

export async function canonicalizeActivity(
  input: CanonicalizeInput,
): Promise<CanonicalizeResult> {
  await db
    .update(snapshotInputs)
    .set({ status: "ingesting", updatedAt: new Date() })
    .where(eq(snapshotInputs.id, input.snapshotInputId));

  await db
    .update(snapshots)
    .set({ status: "ingesting", updatedAt: new Date() })
    .where(eq(snapshots.id, input.snapshotId));

  await db
    .update(runs)
    .set({ status: "running", updatedAt: new Date() })
    .where(eq(runs.id, input.runId));

  const [acceptedStep] = await db
    .select({
      id: runSteps.id,
      parametersJson: runSteps.parametersJson,
    })
    .from(runSteps)
    .where(
      and(
        eq(runSteps.id, input.acceptedMappingStepId),
        eq(runSteps.runId, input.runId),
        eq(runSteps.snapshotInputId, input.snapshotInputId),
        eq(runSteps.stepType, "ACCEPTED_MAPPING"),
      ),
    )
    .limit(1);

  if (!acceptedStep) {
    throw new Error("Accepted mapping step not found for canonicalization");
  }

  const mapping = mappingProposalSchema.parse(acceptedStep.parametersJson);
  if (mapping.entityType !== input.entityType) {
    throw new Error("Mapping entity type does not match canonicalization input");
  }

  const canonicalizationStepType =
    input.entityType === "claim" ? "CANONICALIZE_CLAIMS" : "CANONICALIZE_POLICIES";

  const [existingCanonicalizationStep] = await db
    .select({ id: runSteps.id })
    .from(runSteps)
    .where(
      and(
        eq(runSteps.runId, input.runId),
        eq(runSteps.snapshotInputId, input.snapshotInputId),
        eq(runSteps.stepType, canonicalizationStepType),
        eq(runSteps.supersedesStepId, input.acceptedMappingStepId),
      ),
    )
    .limit(1);

  const canonicalizationStep =
    existingCanonicalizationStep ??
    (await appendRunStep(db, {
      runId: input.runId,
      snapshotInputId: input.snapshotInputId,
      stepType: canonicalizationStepType,
      actorType: "system",
      supersedesStepId: input.acceptedMappingStepId,
      parametersJson: {
        acceptedMappingStepId: input.acceptedMappingStepId,
        entityType: input.entityType,
        snapshotId: input.snapshotId,
        snapshotInputId: input.snapshotInputId,
      },
    }));

  const canonicalFieldMap = getCanonicalFieldMap(input.entityType);
  const rulesByField = new Map<string, MappingRule>();
  for (const rule of mapping.mappings) {
    if (!canonicalFieldMap.has(rule.canonicalField)) {
      throw new Error(`Unknown canonical field "${rule.canonicalField}" in mapping`);
    }
    rulesByField.set(rule.canonicalField, rule);
  }

  const rows = await db
    .select({
      id: rawRows.id,
      rowNumber: rawRows.rowNumber,
      rawJson: rawRows.rawJson,
    })
    .from(rawRows)
    .where(eq(rawRows.snapshotInputId, input.snapshotInputId))
    .orderBy(asc(rawRows.rowNumber));

  const claimInserts: (typeof claimsCanonical.$inferInsert)[] = [];
  const policyInserts: (typeof policiesCanonical.$inferInsert)[] = [];
  const errorInserts: (typeof ingestionErrors.$inferInsert)[] = [];

  for (const row of rows) {
    try {
      if (!row.rawJson || typeof row.rawJson !== "object") {
        throw new Error("Row payload is not a JSON object");
      }
      const data = row.rawJson as Record<string, unknown>;

      if (input.entityType === "claim") {
        const claimNumber = requiredDbField(
          rulesByField,
          data,
          canonicalFieldMap.get("claim_number")!,
        )[1];
        const accidentDate = requiredDbField(
          rulesByField,
          data,
          canonicalFieldMap.get("accident_date")!,
        )[1];
        const totalIncurred = requiredDbField(
          rulesByField,
          data,
          canonicalFieldMap.get("total_incurred")!,
        )[1];

        const optionalPairs = [
          optionalDbField(rulesByField, data, canonicalFieldMap.get("accounting_period")!),
          optionalDbField(rulesByField, data, canonicalFieldMap.get("evaluation_date")!),
          optionalDbField(rulesByField, data, canonicalFieldMap.get("policy_number")!),
          optionalDbField(rulesByField, data, canonicalFieldMap.get("paid_indemnity")!),
          optionalDbField(rulesByField, data, canonicalFieldMap.get("paid_medical")!),
          optionalDbField(rulesByField, data, canonicalFieldMap.get("paid_expense")!),
          optionalDbField(rulesByField, data, canonicalFieldMap.get("os_indemnity")!),
          optionalDbField(rulesByField, data, canonicalFieldMap.get("os_medical")!),
          optionalDbField(rulesByField, data, canonicalFieldMap.get("os_expense")!),
          optionalDbField(rulesByField, data, canonicalFieldMap.get("line_of_business")!),
          optionalDbField(rulesByField, data, canonicalFieldMap.get("cedent")!),
          optionalDbField(rulesByField, data, canonicalFieldMap.get("profit_center")!),
        ];

        const optionalPayload = Object.fromEntries(
          optionalPairs.filter((pair) => pair[1] !== undefined),
        );

        claimInserts.push({
          snapshotId: input.snapshotId,
          runId: input.runId,
          runStepId: canonicalizationStep.id,
          rawRowId: row.id,
          claimNumber,
          accidentDate,
          totalIncurred,
          ...optionalPayload,
        });
      } else {
        const policyNumber = requiredDbField(
          rulesByField,
          data,
          canonicalFieldMap.get("policy_number")!,
        )[1];
        const effectiveDate = requiredDbField(
          rulesByField,
          data,
          canonicalFieldMap.get("effective_date")!,
        )[1];
        const expirationDate = requiredDbField(
          rulesByField,
          data,
          canonicalFieldMap.get("expiration_date")!,
        )[1];

        const optionalPairs = [
          optionalDbField(rulesByField, data, canonicalFieldMap.get("insured_name")!),
          optionalDbField(rulesByField, data, canonicalFieldMap.get("line_of_business")!),
          optionalDbField(rulesByField, data, canonicalFieldMap.get("attachment_point")!),
          optionalDbField(rulesByField, data, canonicalFieldMap.get("gross_premium")!),
          optionalDbField(rulesByField, data, canonicalFieldMap.get("risk_state")!),
        ];
        const optionalPayload = Object.fromEntries(
          optionalPairs.filter((pair) => pair[1] !== undefined),
        );

        policyInserts.push({
          snapshotId: input.snapshotId,
          runId: input.runId,
          runStepId: canonicalizationStep.id,
          rawRowId: row.id,
          policyNumber,
          effectiveDate,
          expirationDate,
          ...optionalPayload,
        });
      }
    } catch (error) {
      errorInserts.push({
        snapshotId: input.snapshotId,
        runId: input.runId,
        runStepId: canonicalizationStep.id,
        rawRowId: row.id,
        code: "VALIDATION_ERROR",
        message: error instanceof Error ? error.message : "Unknown canonicalization error",
        detailsJson: {
          rowNumber: row.rowNumber,
        },
      });
    }
  }

  await db.transaction(async (tx) => {
    await tx.delete(ingestionErrors).where(eq(ingestionErrors.runStepId, canonicalizationStep.id));
    await tx.delete(claimsCanonical).where(eq(claimsCanonical.runStepId, canonicalizationStep.id));
    await tx
      .delete(policiesCanonical)
      .where(eq(policiesCanonical.runStepId, canonicalizationStep.id));

    if (input.entityType === "claim" && claimInserts.length > 0) {
      await tx.insert(claimsCanonical).values(claimInserts);
    }
    if (input.entityType === "policy" && policyInserts.length > 0) {
      await tx.insert(policiesCanonical).values(policyInserts);
    }
    if (errorInserts.length > 0) {
      await tx.insert(ingestionErrors).values(errorInserts);
    }

    await tx
      .update(snapshotInputs)
      .set({
        status: errorInserts.length > 0 ? "failed" : "ready",
        updatedAt: new Date(),
      })
      .where(eq(snapshotInputs.id, input.snapshotInputId));

    await tx
      .update(snapshots)
      .set({
        status: errorInserts.length > 0 ? "failed" : "ready",
        updatedAt: new Date(),
      })
      .where(eq(snapshots.id, input.snapshotId));

    await tx
      .update(runs)
      .set({
        status: errorInserts.length > 0 ? "failed" : "ready",
        updatedAt: new Date(),
      })
      .where(eq(runs.id, input.runId));
  });

  await insertRunStepArtifact(db, {
    runStepId: canonicalizationStep.id,
    artifactType: "CANONICALIZATION_SUMMARY",
    dataJson: {
      canonicalRowsWritten:
        input.entityType === "claim" ? claimInserts.length : policyInserts.length,
      ingestionErrorsWritten: errorInserts.length,
    },
  });

  return {
    acceptedMappingStepId: input.acceptedMappingStepId,
    canonicalizationStepId: canonicalizationStep.id,
    canonicalRowsWritten:
      input.entityType === "claim" ? claimInserts.length : policyInserts.length,
    ingestionErrorsWritten: errorInserts.length,
  };
}