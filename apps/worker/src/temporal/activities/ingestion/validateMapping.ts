import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { mappingRuns, rawRows, snapshotInputs, snapshots } from "@db/schema";
import { db } from "../../../db/client";
import type { ValidateMappingInput, ValidateMappingResult } from "./types";
import { getCanonicalFieldSpecs } from "./canonicalMetadata";

const mappingProposalSchema = z.object({
  entityType: z.enum(["claim", "policy"]),
  mappings: z.array(
    z.object({
      canonicalField: z.string().min(1),
      sourceColumns: z.array(z.string().min(1)).min(1),
      transform: z.enum(["identity", "sum", "parseDate", "parseMoney"]),
      confidence: z.number().min(0).max(1).optional(),
    }),
  ),
});

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

  const [run] = await db
    .select({
      id: mappingRuns.id,
      aiProposalJson: mappingRuns.aiProposalJson,
      validatedMappingJson: mappingRuns.validatedMappingJson,
      snapshotId: mappingRuns.snapshotId,
      snapshotInputId: mappingRuns.snapshotInputId,
    })
    .from(mappingRuns)
    .where(
      and(
        eq(mappingRuns.id, input.mappingRunId),
        eq(mappingRuns.snapshotId, input.snapshotId),
        eq(mappingRuns.snapshotInputId, input.snapshotInputId),
      ),
    )
    .limit(1);

  if (!run) {
    throw new Error("Mapping run not found");
  }

  const selectedMappingRaw = input.requireConfirmedMapping
    ? run.validatedMappingJson
    : run.validatedMappingJson ?? run.aiProposalJson;

  if (!selectedMappingRaw) {
    const nextStatus = input.requireConfirmedMapping ? "failed" : "pending";

    await db
      .update(mappingRuns)
      .set({
        status: "failed",
        validationReportJson: {
          errors: ["No mapping available to validate"],
          requireConfirmedMapping: Boolean(input.requireConfirmedMapping),
        },
      })
      .where(eq(mappingRuns.id, input.mappingRunId));

    await db
      .update(snapshotInputs)
      .set({ status: nextStatus, updatedAt: new Date() })
      .where(eq(snapshotInputs.id, input.snapshotInputId));

    await db
      .update(snapshots)
      .set({ status: input.requireConfirmedMapping ? "failed" : "ingesting", updatedAt: new Date() })
      .where(eq(snapshots.id, input.snapshotId));

    return {
      mappingRunId: input.mappingRunId,
      isValid: false,
    };
  }

  const parsed = mappingProposalSchema.safeParse(selectedMappingRaw);
  if (!parsed.success) {
    const nextStatus = input.requireConfirmedMapping ? "failed" : "pending";

    await db
      .update(mappingRuns)
      .set({
        status: "failed",
        validationReportJson: {
          errors: parsed.error.issues.map((issue) => issue.message),
        },
      })
      .where(eq(mappingRuns.id, input.mappingRunId));

    await db
      .update(snapshotInputs)
      .set({ status: nextStatus, updatedAt: new Date() })
      .where(eq(snapshotInputs.id, input.snapshotInputId));

    await db
      .update(snapshots)
      .set({ status: input.requireConfirmedMapping ? "failed" : "ingesting", updatedAt: new Date() })
      .where(eq(snapshots.id, input.snapshotId));

    return {
      mappingRunId: input.mappingRunId,
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

  await db
    .update(mappingRuns)
    .set({
      status: isValid ? "validated" : "failed",
      validatedMappingJson: mapping,
      validationReportJson: {
        errors,
        checkedRows: sampleRows.length,
        requiredFields,
      },
    })
    .where(eq(mappingRuns.id, input.mappingRunId));

  await db
    .update(snapshotInputs)
    .set({
      status: isValid ? "ingesting" : input.requireConfirmedMapping ? "failed" : "pending",
      updatedAt: new Date(),
    })
    .where(eq(snapshotInputs.id, input.snapshotInputId));

  await db
    .update(snapshots)
    .set({
      status: isValid ? "ingesting" : input.requireConfirmedMapping ? "failed" : "ingesting",
      updatedAt: new Date(),
    })
    .where(eq(snapshots.id, input.snapshotId));

  return {
    mappingRunId: input.mappingRunId,
    isValid,
  };
}
