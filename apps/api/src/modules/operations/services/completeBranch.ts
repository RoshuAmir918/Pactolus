import { and, desc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import dbClient from "@api/db/client";
import { runBranches, runOperations } from "@db/schema";
import { insertRunStepArtifact } from "@db/schema/operations/runHistory";
import { appendStep } from "./appendStep";
import { assertBranchAccess } from "./assertBranchAccess";
import { assertRunAccess } from "./assertRunAccess";
import { buildAssumptionDiff, type AssumptionDiffResult } from "./buildAssumptionDiff";
import { getBranchEffectiveHistory } from "./getBranchEffectiveHistory";

const { db } = dbClient;

type AiSummary = {
  summary: string;
  notableChanges: string[];
  confidence: number | null;
};

export type CompleteBranchInput = {
  orgId: string;
  userId: string;
  runId: string;
  branchId: string;
  idempotencyKey?: string;
  generateAiSummary?: boolean;
};

export type CompleteBranchResult = {
  completionStepId: string;
  runId: string;
  branchId: string;
  branchStatus: "active" | "archived";
  assumptionDiff: AssumptionDiffResult;
  aiSummary: AiSummary | null;
};

export async function completeBranch(input: CompleteBranchInput): Promise<CompleteBranchResult> {
  await assertRunAccess({ runId: input.runId, orgId: input.orgId });
  const branch = await assertBranchAccess({
    runId: input.runId,
    branchId: input.branchId,
  });

  const effective = await getBranchEffectiveHistory({
    orgId: input.orgId,
    runId: input.runId,
    branchId: input.branchId,
  });
  const firstBranchStepIndex = effective.steps.findIndex((step) => step.branchId === input.branchId);
  const baselineSteps =
    firstBranchStepIndex === -1 ? effective.steps : effective.steps.slice(0, firstBranchStepIndex);
  const finalSteps = effective.steps;
  const assumptionDiff = buildAssumptionDiff({
    baselineSteps,
    finalSteps,
  });

  const aiSummary =
    input.generateAiSummary === false
      ? null
      : await maybeSummarizeAssumptionDiff({
          runId: input.runId,
          branchId: input.branchId,
          branchName: branch.name,
          forkedFromStepId: branch.forkedFromStepId,
          assumptionDiff,
        });

  const [lastBranchStep] = await db
    .select({ id: runOperations.id })
    .from(runOperations)
    .where(eq(runOperations.branchId, input.branchId))
    .orderBy(desc(runOperations.stepIndex))
    .limit(1);

  const completionStep = await appendStep({
    orgId: input.orgId,
    userId: input.userId,
    runId: input.runId,
    branchId: input.branchId,
    stepType: "branch_completed",
    idempotencyKey: input.idempotencyKey ?? `branch-complete:${input.branchId}`,
    parentStepId: lastBranchStep?.id,
    parametersJson: {
      branchId: input.branchId,
      branchName: branch.name,
      forkedFromStepId: branch.forkedFromStepId,
      assumptionDiff,
      aiSummary,
    },
  });

  if (aiSummary) {
    await insertRunStepArtifact(db, {
      runStepId: completionStep.stepId,
      artifactType: "AI_RAW_RESPONSE",
      dataJson: {
        type: "branch_assumption_summary",
        aiSummary,
      },
    });
  }

  const [updatedBranch] = await db
    .update(runBranches)
    .set({
      status: "archived",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(runBranches.id, input.branchId),
        eq(runBranches.runId, input.runId),
        eq(runBranches.status, "active"),
      ),
    )
    .returning({
      status: runBranches.status,
    });

  if (!updatedBranch) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Branch is already completed",
    });
  }

  return {
    completionStepId: completionStep.stepId,
    runId: input.runId,
    branchId: input.branchId,
    branchStatus: updatedBranch.status,
    assumptionDiff,
    aiSummary,
  };
}

async function maybeSummarizeAssumptionDiff(input: {
  runId: string;
  branchId: string;
  branchName: string;
  forkedFromStepId: string | null;
  assumptionDiff: AssumptionDiffResult;
}): Promise<AiSummary | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return null;
  }

  const model = process.env.CLAUDE_MODEL ?? "claude-sonnet-4-5";
  const prompt = buildAiPrompt(input);
  try {
    const raw = await callAnthropicJson({
      apiKey,
      model,
      prompt,
    });
    return normalizeAiSummary(raw);
  } catch {
    return null;
  }
}

function buildAiPrompt(input: {
  runId: string;
  branchId: string;
  branchName: string;
  forkedFromStepId: string | null;
  assumptionDiff: AssumptionDiffResult;
}): string {
  const payload = {
    task: "Summarize branch-level assumption changes since fork point.",
    runId: input.runId,
    branchId: input.branchId,
    branchName: input.branchName,
    forkedFromStepId: input.forkedFromStepId,
    assumptionDiff: {
      baselineCount: input.assumptionDiff.baselineCount,
      finalCount: input.assumptionDiff.finalCount,
      added: input.assumptionDiff.added.map((item) => ({
        assumptionKey: item.assumptionKey,
        confidence: item.after.confidence,
      })),
      removed: input.assumptionDiff.removed.map((item) => ({
        assumptionKey: item.assumptionKey,
        confidence: item.before.confidence,
      })),
      modified: input.assumptionDiff.modified.map((item) => ({
        assumptionKey: item.assumptionKey,
        changedFields: item.changedFields,
      })),
    },
    rules: [
      "Be concise and factual.",
      "Focus on changed assumptions only.",
      "Do not invent assumptions not present in diff.",
      "Return strict JSON only.",
    ],
    outputSchema: {
      summary: "string",
      notableChanges: ["string"],
      confidence: "number 0..1 or null",
    },
  };
  return JSON.stringify(payload);
}

async function callAnthropicJson(input: {
  apiKey: string;
  model: string;
  prompt: string;
}): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": input.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: input.model,
        max_tokens: 700,
        temperature: 0.1,
        messages: [
          {
            role: "user",
            content: input.prompt,
          },
        ],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Anthropic error: ${response.status}`);
    }

    const data = (await response.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const text = data.content?.find((item) => item.type === "text")?.text;
    if (!text) {
      throw new Error("Anthropic returned no text content");
    }

    return parseJsonObject(text);
  } finally {
    clearTimeout(timeout);
  }
}

function parseJsonObject(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) {
      throw new Error("Unable to parse JSON response");
    }
    return JSON.parse(trimmed.slice(start, end + 1));
  }
}

function normalizeAiSummary(raw: unknown): AiSummary | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }
  const asRecord = raw as Record<string, unknown>;
  const summary =
    typeof asRecord.summary === "string" ? asRecord.summary.trim() : "";
  if (!summary) {
    return null;
  }
  const notableChanges = Array.isArray(asRecord.notableChanges)
    ? asRecord.notableChanges
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter((value) => value.length > 0)
        .slice(0, 8)
    : [];
  const confidence =
    typeof asRecord.confidence === "number" && !Number.isNaN(asRecord.confidence)
      ? Math.max(0, Math.min(1, Math.round(asRecord.confidence * 100) / 100))
      : null;

  return {
    summary,
    notableChanges,
    confidence,
  };
}
