export type EntityType = "claim" | "policy";

export type CanonicalValueType = "string" | "money" | "date";

export type CanonicalFieldSpec = {
  canonicalField: string;
  dbField: string;
  required: boolean;
  valueType: CanonicalValueType;
};

import { getTableColumns } from "drizzle-orm";
import { claimsCanonical, policiesCanonical } from "@db/schema";

const technicalDbFields = new Set([
  "id",
  "snapshotId",
  "runId",
  "runStepId",
  "rawRowId",
  "createdAt",
]);

function camelToSnake(input: string): string {
  return input.replace(/[A-Z]/g, (char) => `_${char.toLowerCase()}`);
}

function getCanonicalDbFields(entityType: EntityType): string[] {
  const tableColumns =
    entityType === "claim" ? getTableColumns(claimsCanonical) : getTableColumns(policiesCanonical);
  return Object.keys(tableColumns).filter((dbField) => !technicalDbFields.has(dbField));
}

const requiredFieldsByEntity: Record<EntityType, Set<string>> = {
  claim: new Set(["claim_number", "accident_date", "total_incurred"]),
  policy: new Set(["policy_number", "effective_date", "expiration_date"]),
};

const valueTypeByEntityField: Record<EntityType, Record<string, CanonicalValueType>> = {
  claim: {
    accident_date: "date",
    evaluation_date: "date",
    total_incurred: "money",
    paid_indemnity: "money",
    paid_medical: "money",
    paid_expense: "money",
    os_indemnity: "money",
    os_medical: "money",
    os_expense: "money",
  },
  policy: {
    effective_date: "date",
    expiration_date: "date",
    attachment_point: "money",
    gross_premium: "money",
  },
};

function buildFieldSpecs(entityType: EntityType): CanonicalFieldSpec[] {
  return getCanonicalDbFields(entityType).map((dbField) => {
    const canonicalField = camelToSnake(dbField);
    return {
      canonicalField,
      dbField,
      required: requiredFieldsByEntity[entityType].has(canonicalField),
      valueType: valueTypeByEntityField[entityType][canonicalField] ?? "string",
    };
  });
}

const claimFieldSpecs = buildFieldSpecs("claim");
const policyFieldSpecs = buildFieldSpecs("policy");

const specsByEntity: Record<EntityType, CanonicalFieldSpec[]> = {
  claim: claimFieldSpecs,
  policy: policyFieldSpecs,
};

export function getEntityPromptConfig(entityType: EntityType): {
  systemPrompt: string;
  domainRules: string[];
} {
  if (entityType === "claim") {
    return {
      systemPrompt:
        "You map reinsurance CLAIM CSV columns into canonical claim fields. Return JSON only.",
      domainRules: [
        "Prioritize claim_number, accident_date, and total_incurred mappings.",
        "Use parseMoney for incurred/paid/outstanding financial fields.",
        "Use parseDate for date fields such as accident_date and evaluation_date.",
      ],
    };
  }

  return {
    systemPrompt:
      "You map reinsurance POLICY CSV columns into canonical policy fields. Return JSON only.",
    domainRules: [
      "Prioritize policy_number, effective_date, and expiration_date mappings.",
      "Use parseMoney for premium/attachment financial fields.",
      "Use parseDate for effective/expiration date fields.",
    ],
  };
}

export function getCanonicalFieldSpecs(entityType: EntityType): CanonicalFieldSpec[] {
  return specsByEntity[entityType];
}

export function getCanonicalFieldMap(entityType: EntityType): Map<string, CanonicalFieldSpec> {
  return new Map(getCanonicalFieldSpecs(entityType).map((spec) => [spec.canonicalField, spec]));
}

export function getCanonicalPromptFields(entityType: EntityType): {
  required: string[];
  optional: string[];
} {
  const specs = getCanonicalFieldSpecs(entityType);
  return {
    required: specs.filter((spec) => spec.required).map((spec) => spec.canonicalField),
    optional: specs.filter((spec) => !spec.required).map((spec) => spec.canonicalField),
  };
}
