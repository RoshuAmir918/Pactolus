import { asc, eq } from "drizzle-orm";
import { mappingProposalSchema } from "@db/schema/mappingSchema";
import { appendRunStep, insertRunStepArtifact } from "@db/schema/operations/runHistory";
import { rawRows, runs, snapshotInputs, snapshots } from "@db/schema";
import { db } from "../../../db/client";
import { env } from "../../../env";
import type { IngestSnapshotWorkflowInput } from "../../workflows/ingestSnapshot";
import type { ProposeMappingResult } from "./types";
import { getCanonicalPromptFields, getEntityPromptConfig } from "./canonicalMetadata";

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
  try {
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
      throw new Error("No raw rows found for snapshot input");
    }

    const samplesByColumn = collectColumnSamples(parsedRows);
    const detectedColumns = Object.keys(samplesByColumn);
    const canonicalFields = getCanonicalPromptFields(input.entityType);
    const promptConfig = getEntityPromptConfig(input.entityType);

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
            content: `${promptConfig.systemPrompt} Do not include markdown.`,
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
                  ...promptConfig.domainRules,
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

    const suggestedStep = await appendRunStep(db, {
      runId: input.runId,
      snapshotInputId: input.snapshotInputId,
      stepType: "SUGGESTED_MAPPING",
      actorType: "ai",
      parametersJson: proposal,
    });

    await insertRunStepArtifact(db, {
      runStepId: suggestedStep.id,
      artifactType: "AI_RAW_RESPONSE",
      dataJson: {
        content,
        completion,
      },
    });

    await db
      .update(snapshotInputs)
      .set({ status: "pending", updatedAt: new Date() })
      .where(eq(snapshotInputs.id, input.snapshotInputId));

    await db
      .update(runs)
      .set({ status: "awaiting_confirmation", updatedAt: new Date() })
      .where(eq(runs.id, input.runId));

    return {
      suggestedMappingStepId: suggestedStep.id,
    };
  } catch (error) {
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

    throw error;
  }
}
