import { and, asc, eq } from "drizzle-orm";
import { mappingProposalSchema } from "@db/mappingSchema";
import { insertRunStepArtifact } from "@db/runHistory";
import { rawRows, runSteps, runs, snapshotInputs, snapshots } from "@db/schema";
import { db } from "../../../db/client";
import type { ValidateMappingInput, ValidateMappingResult } from "./types";
import { getCanonicalFieldSpecs } from "./canonicalMetadata";

function parseMoney(value: string): number {
  const normalized = value.replace(/[$,%\s]/g, "").replace(/,/g, "");
  const numberValue = Number(normalized);
  if (!Number.isFinite(numberValue)) {
    throw new Error(`Invalid number value: "${value}"`);
  }
  return numberValue;
}

function parseDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date value: "${value}"`);
  }
  return date.toISOString().slice(0, 10);
}

export async function validateMappingActivity(
  input: ValidateMappingInput,
): Promise<ValidateMappingResult> {
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
    throw new Error("Accepted mapping step not found");
  }

  const parsed = mappingProposalSchema.safeParse(acceptedStep.parametersJson);
  if (!parsed.success) {
    const errors = parsed.error.issues.map((issue) => issue.message);

    await insertRunStepArtifact(db, {
      runStepId: input.acceptedMappingStepId,
      artifactType: "MAPPING_VALIDATION_REPORT",
      dataJson: {
        errors,
      },
    });

    await db
      .update(snapshotInputs)
      .set({ status: "failed", updatedAt: new Date() })
      .where(eq(snapshotInputs.id, input.snapshotInputId));

    await db
      .update(snapshots)
      .set({ status: "failed", updatedAt: new Date() })
      .where(eq(snapshots.id, input.snapshotId));

    await db
      .update(runs)
      .set({ status: "failed", updatedAt: new Date() })
      .where(eq(runs.id, input.runId));

    return {
      acceptedMappingStepId: input.acceptedMappingStepId,
      isValid: false,
    };
  }

  const mapping = parsed.data;
  const canonicalSpecs = getCanonicalFieldSpecs(mapping.entityType);
  const allowedFields = new Set(canonicalSpecs.map((spec) => spec.canonicalField));
  const requiredFields = canonicalSpecs
    .filter((spec) => spec.required)
    .map((spec) => spec.canonicalField);

  const rows = await db
    .select({ rawJson: rawRows.rawJson })
    .from(rawRows)
    .where(eq(rawRows.snapshotInputId, input.snapshotInputId))
    .orderBy(asc(rawRows.rowNumber))
    .limit(25);

  const sampleRows = rows
    .map((row) => row.rawJson)
    .filter((row): row is Record<string, unknown> => !!row && typeof row === "object");

  const detectedColumns = new Set<string>();
  sampleRows.forEach((row) => Object.keys(row).forEach((column) => detectedColumns.add(column)));

  const errors: string[] = [];
  const seenCanonicalFields = new Set<string>();
  for (const rule of mapping.mappings) {
    if (seenCanonicalFields.has(rule.canonicalField)) {
      errors.push(`Duplicate mapping for field "${rule.canonicalField}"`);
    }
    if (!allowedFields.has(rule.canonicalField)) {
      errors.push(`Unknown canonical field "${rule.canonicalField}"`);
    }
    seenCanonicalFields.add(rule.canonicalField);

    for (const sourceColumn of rule.sourceColumns) {
      if (!detectedColumns.has(sourceColumn)) {
        errors.push(
          `Source column "${sourceColumn}" for "${rule.canonicalField}" not found in input`,
        );
      }
    }
  }

  requiredFields.forEach((field) => {
    if (!seenCanonicalFields.has(field)) {
      errors.push(`Missing required field mapping "${field}"`);
    }
  });

  // Sample execution checks.
  for (const row of sampleRows) {
    for (const rule of mapping.mappings) {
      try {
        if (rule.transform === "parseDate") {
          const value = String(row[rule.sourceColumns[0]] ?? "").trim();
          if (value.length > 0) {
            parseDate(value);
          }
        }
        if (rule.transform === "parseMoney") {
          const value = String(row[rule.sourceColumns[0]] ?? "").trim();
          if (value.length > 0) {
            parseMoney(value);
          }
        }
        if (rule.transform === "sum") {
          for (const sourceColumn of rule.sourceColumns) {
            const value = String(row[sourceColumn] ?? "").trim();
            if (value.length > 0) {
              parseMoney(value);
            }
          }
        }
      } catch (error) {
        errors.push(
          `${rule.canonicalField}: ${error instanceof Error ? error.message : "Invalid value"}`,
        );
      }
    }
  }

  const isValid = errors.length === 0;

  await insertRunStepArtifact(db, {
    runStepId: input.acceptedMappingStepId,
    artifactType: "MAPPING_VALIDATION_REPORT",
    dataJson: {
      errors,
      checkedRows: sampleRows.length,
      requiredFields,
    },
  });

  await db
    .update(snapshotInputs)
    .set({
      status: isValid ? "ingesting" : "failed",
      updatedAt: new Date(),
    })
    .where(eq(snapshotInputs.id, input.snapshotInputId));

  await db
    .update(snapshots)
    .set({
      status: isValid ? "ingesting" : "failed",
      updatedAt: new Date(),
    })
    .where(eq(snapshots.id, input.snapshotId));

  await db
    .update(runs)
    .set({
      status: isValid ? "running" : "failed",
      updatedAt: new Date(),
    })
    .where(eq(runs.id, input.runId));

  return {
    acceptedMappingStepId: input.acceptedMappingStepId,
    isValid,
  };
}
