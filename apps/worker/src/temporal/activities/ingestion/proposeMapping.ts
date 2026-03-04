import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { mappingRuns, rawRows } from "@db/schema";
import { db } from "../../../db/client";
import { env } from "../../../env";
import type { IngestSnapshotWorkflowInput } from "../../workflows/ingestSnapshot";
import type { ProposeMappingResult } from "./types";

const mappingProposalSchema = z.object({
  entityType: z.enum(["claim", "policy"]),
  mappings: z.array(
    z.object({
      canonicalField: z.string().min(1),
      sourceColumns: z.array(z.string().min(1)).min(1),
      transform: z.enum(["identity", "sum", "parseDate", "parseMoney"]),
      confidence: z.number().min(0).max(1),
    }),
  ),
});

const canonicalClaimsFields = {
  required: ["claim_number", "accident_date", "total_incurred"],
  optional: [
    "accounting_period",
    "evaluation_date",
    "policy_number",
    "paid_indemnity",
    "paid_medical",
    "paid_expense",
    "os_indemnity",
    "os_medical",
    "os_expense",
    "line_of_business",
    "cedent",
    "profit_center",
  ],
};

const canonicalPolicyFields = {
  required: ["policy_number", "effective_date", "expiration_date"],
  optional: [
    "insured_name",
    "line_of_business",
    "attachment_point",
    "gross_premium",
    "risk_state",
  ],
};

function stripCodeFence(input: string): string {
  const trimmed = input.trim();
  if (!trimmed.startsWith("```")) {
    return trimmed;
  }

  return trimmed
    .replace(/^```[a-zA-Z]*\n?/, "")
    .replace(/\n?```$/, "")
    .trim();
}

function collectColumnSamples(rows: Record<string, unknown>[]): Record<string, string[]> {
  const samples: Record<string, string[]> = {};

  for (const row of rows) {
    for (const [column, value] of Object.entries(row)) {
      const textValue = String(value ?? "").trim();
      if (textValue.length === 0) {
        continue;
      }

      if (!samples[column]) {
        samples[column] = [];
      }

      if (!samples[column].includes(textValue) && samples[column].length < 5) {
        samples[column].push(textValue);
      }
    }
  }

  return samples;
}

export async function proposeMappingActivity(
  input: IngestSnapshotWorkflowInput,
): Promise<ProposeMappingResult> {
  const rows = await db
    .select({
      rawJson: rawRows.rawJson,
    })
    .from(rawRows)
    .where(eq(rawRows.snapshotInputId, input.snapshotInputId))
    .orderBy(asc(rawRows.rowNumber))
    .limit(50);

  const parsedRows = rows
    .map((row) => row.rawJson)
    .filter((row): row is Record<string, unknown> => !!row && typeof row === "object");

  if (parsedRows.length === 0) {
    const [createdEmpty] = await db
      .insert(mappingRuns)
      .values({
        snapshotId: input.snapshotId,
        snapshotInputId: input.snapshotInputId,
        status: "failed",
        validationReportJson: {
          reason: "No raw rows found for snapshot input",
        },
      })
      .returning({ id: mappingRuns.id });

    return { mappingRunId: createdEmpty.id };
  }

  const samplesByColumn = collectColumnSamples(parsedRows);
  const detectedColumns = Object.keys(samplesByColumn);
  const canonicalFields =
    input.entityType === "claim" ? canonicalClaimsFields : canonicalPolicyFields;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: env.OPENAI_MODEL,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You map CSV columns into canonical reinsurance fields. Return JSON only. Do not include markdown.",
        },
        {
          role: "user",
          content: JSON.stringify(
            {
              task: "Propose canonical column mapping",
              rules: [
                "Map only from detectedColumns",
                "Use allowed transforms only: identity, sum, parseDate, parseMoney",
                "Map all required fields",
                "Confidence must be between 0 and 1",
              ],
              entityType: input.entityType,
              detectedColumns,
              samplesByColumn,
              canonicalFields,
              outputShape: {
                entityType: input.entityType,
                mappings: [
                  {
                    canonicalField: "string",
                    sourceColumns: ["string"],
                    transform: "identity | sum | parseDate | parseMoney",
                    confidence: 0.9,
                  },
                ],
              },
            },
            null,
            2,
          ),
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI mapping call failed: ${response.status} ${errorText}`);
  }

  const completion = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  const content = completion.choices?.[0]?.message?.content ?? null;
  if (!content) {
    throw new Error("OpenAI returned an empty mapping response");
  }

  const proposalRaw = JSON.parse(stripCodeFence(content));
  const proposal = mappingProposalSchema.parse(proposalRaw);

  const [created] = await db
    .insert(mappingRuns)
    .values({
      snapshotId: input.snapshotId,
      snapshotInputId: input.snapshotInputId,
      aiProposalJson: proposal,
      status: "pending",
    })
    .returning({ id: mappingRuns.id });

  return {
    mappingRunId: created.id,
  };
}
