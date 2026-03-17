import { GetObjectCommand } from "@aws-sdk/client-s3";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, extname, join } from "node:path";
import { and, count, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import dbClient from "@api/db/client";
import { s3Client } from "@api/modules/storage/services/s3Client";
import { discoverAndExtractActivity, type DiscoverAndExtractResult } from "@worker/temporal/activities/ingestion/discoverAndExtract";
import {
  documentInsights,
  documentSheets,
  documents,
  documentTriangles,
  fileObjects,
  anthropicFiles,
  snapshotAnthropicFiles,
} from "@db/schema";

const { db } = dbClient;

const MAX_CLAUDE_CONTRACT_FILE_BYTES = 8 * 1024 * 1024;
const ANTHROPIC_FILES_BETA_HEADER = "files-api-2025-04-14";
const DEFAULT_CLAUDE_MODEL = "claude-sonnet-4-6";

type StartDocumentIngestionInput = {
  orgId: string;
  snapshotId: string;
  documentId: string;
};

type GetDocumentIngestionStatusInput = StartDocumentIngestionInput;

type DocumentType = "claims" | "policies" | "loss_triangles" | "workbook_tool" | "other";
type DocumentAiClassification =
  | "claims"
  | "policies"
  | "loss_triangles"
  | "workbook_tool"
  | "other"
  | "unknown";
type InsightType =
  | "segment_manifest"
  | "aggregate_stats"
  | "quality_flags"
  | "contract_terms"
  | "narrative"
  | "other";

type ClaudeJsonResponse = {
  text: string;
};

export type DocumentIngestionStatusResult = {
  documentId: string;
  profileStatus: "pending" | "completed" | "failed";
  aiStatus: "pending" | "completed" | "failed";
  documentType: DocumentType;
  aiClassification: DocumentAiClassification;
  sheetCount: number;
  triangleCount: number;
  insightCount: number;
  errorText: string | null;
};

export async function startDocumentIngestion(
  input: StartDocumentIngestionInput,
): Promise<DocumentIngestionStatusResult> {
  const target = await getTargetDocument(input);
  assertDocumentReady(target.fileStatus, target.deletedAt);

  await db
    .update(documents)
    .set({
      profileStatus: "pending",
      aiStatus: "pending",
      errorText: null,
      updatedAt: new Date(),
    })
    .where(eq(documents.id, target.documentId));

  const tempDir = await mkdtemp(join(tmpdir(), "pactolus-ingest-"));
  try {
    const localFilePath = await downloadFileToTemp({
      tempDir,
      bucket: target.bucket,
      objectKey: target.objectKey,
      fileName: target.filename,
    });

    const deterministic = await discoverAndExtractActivity({
      filePath: localFilePath,
      fileExtension: target.fileExtension ?? inferFileExtension(target.filename),
    });

    await ensureAnthropicFileRegistered({
      target,
      deterministic,
      localFilePath,
    });

    await upsertSheetsFromDeterministic({
      target,
      deterministic,
    });

    await db.delete(documentTriangles).where(eq(documentTriangles.documentId, target.documentId));
    await db.delete(documentInsights).where(eq(documentInsights.documentId, target.documentId));

    if (deterministic.route === "deterministic_claims_policies") {
      await processDeterministicBranch({
        target,
        deterministic,
      });
    } else if (
      deterministic.route === "hybrid_triangles" ||
      deterministic.document.documentType === "loss_triangles"
    ) {
      await processTriangleBranch({
        target,
        deterministic,
      });
    } else {
      await processContractBranch({
        target,
        deterministic,
        localFilePath,
      });
    }

    await db
      .update(documents)
      .set({
        profileStatus: "completed",
        aiStatus: "completed",
        errorText: null,
        updatedAt: new Date(),
      })
      .where(eq(documents.id, target.documentId));
  } catch (error) {
    await db
      .update(documents)
      .set({
        profileStatus: "failed",
        aiStatus: "failed",
        errorText: toErrorText(error),
        updatedAt: new Date(),
      })
      .where(eq(documents.id, target.documentId));
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }

  return getDocumentIngestionStatus(input);
}

export async function getDocumentIngestionStatus(
  input: GetDocumentIngestionStatusInput,
): Promise<DocumentIngestionStatusResult> {
  const [document] = await db
    .select({
      id: documents.id,
      profileStatus: documents.profileStatus,
      aiStatus: documents.aiStatus,
      documentType: documents.documentType,
      aiClassification: documents.aiClassification,
      errorText: documents.errorText,
    })
    .from(documents)
    .where(
      and(
        eq(documents.id, input.documentId),
        eq(documents.orgId, input.orgId),
        eq(documents.snapshotId, input.snapshotId),
      ),
    )
    .limit(1);

  if (!document) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Document not found",
    });
  }

  const [sheetCounts] = await db
    .select({ count: count() })
    .from(documentSheets)
    .where(eq(documentSheets.documentId, input.documentId));
  const [triangleCounts] = await db
    .select({ count: count() })
    .from(documentTriangles)
    .where(eq(documentTriangles.documentId, input.documentId));
  const [insightCounts] = await db
    .select({ count: count() })
    .from(documentInsights)
    .where(eq(documentInsights.documentId, input.documentId));

  return {
    documentId: document.id,
    profileStatus: document.profileStatus,
    aiStatus: document.aiStatus,
    documentType: document.documentType,
    aiClassification: document.aiClassification,
    sheetCount: Number(sheetCounts?.count ?? 0),
    triangleCount: Number(triangleCounts?.count ?? 0),
    insightCount: Number(insightCounts?.count ?? 0),
    errorText: document.errorText,
  };
}

async function processDeterministicBranch(input: {
  target: Awaited<ReturnType<typeof getTargetDocument>>;
  deterministic: DiscoverAndExtractResult;
}) {
  const { target, deterministic } = input;
  await upsertDocumentClassification({
    documentId: target.documentId,
    deterministic,
  });

  const deterministicPayload = deterministic.deterministic;
  await insertInsights(target, [
    {
      insightType: "segment_manifest",
      title: "Segment Manifest",
      payloadJson: deterministicPayload.segmentManifest,
      confidence: "0.9500",
    },
    {
      insightType: "aggregate_stats",
      title: "Aggregate Statistics",
      payloadJson: deterministicPayload.aggregateStats,
      confidence: "0.9500",
    },
    {
      insightType: "quality_flags",
      title: "Quality Flags",
      payloadJson: deterministicPayload.qualityFlags,
      confidence: "0.9000",
    },
  ]);

  const narrative = await tryClaudeNarrative({
    mode: "deterministic_summary",
    payload: {
      document: deterministic.document,
      aggregateStats: deterministicPayload.aggregateStats,
      qualityFlags: deterministicPayload.qualityFlags,
      segmentManifestSample: deterministicPayload.segmentManifest?.slice(0, 10),
    },
  });
  if (narrative) {
    await insertInsights(target, [
      {
        insightType: "narrative",
        title: "Dataset Narrative",
        payloadJson: {
          narrative,
        },
        confidence: "0.8000",
      },
    ]);
  }
}

async function processTriangleBranch(input: {
  target: Awaited<ReturnType<typeof getTargetDocument>>;
  deterministic: DiscoverAndExtractResult;
}) {
  const { target, deterministic } = input;
  await upsertDocumentClassification({
    documentId: target.documentId,
    deterministic,
  });
  const sheetIds = await loadSheetIdsByIndex(target.documentId);
  const aiTriangleResponse = await callClaude({
    prompt: buildTriangleExtractionPrompt({
      fileName: target.filename,
      deterministicTriangles: deterministic.triangles,
      deterministicSheets: deterministic.sheets,
    }),
    snapshotId: target.snapshotId,
    includeSnapshotFiles: true,
    maxTokens: 2200,
  });
  const parsedAiTriangles = parseJsonObject(aiTriangleResponse.text) as {
    triangles?: unknown;
    narrative?: unknown;
  };

  const aiTriangles = normalizeTrianglesFromClaude(parsedAiTriangles.triangles);
  const candidateTriangles = aiTriangles.length > 0 ? aiTriangles : deterministic.triangles;
  const triangles = candidateTriangles
    .map((triangle) => {
      const sheetIndex = asInteger((triangle as { sheetIndex?: unknown }).sheetIndex);
      if (sheetIndex === null) {
        return null;
      }
      const sheetId = sheetIds.get(sheetIndex);
      if (!sheetId) {
        return null;
      }
      return {
        documentId: target.documentId,
        sheetId,
        orgId: target.orgId,
        snapshotId: target.snapshotId,
        title: asString((triangle as { title?: unknown }).title),
        segmentLabel: asString((triangle as { segmentLabel?: unknown }).segmentLabel),
        triangleType:
          asEnum((triangle as { triangleType?: unknown }).triangleType, [
            "paid",
            "incurred",
            "reported",
            "ultimate",
            "unknown",
          ] as const) ?? "unknown",
        rowStart: asInteger((triangle as { rowStart?: unknown }).rowStart),
        rowEnd: asInteger((triangle as { rowEnd?: unknown }).rowEnd),
        colStart: asInteger((triangle as { colStart?: unknown }).colStart),
        colEnd: asInteger((triangle as { colEnd?: unknown }).colEnd),
        headerLabelsJson: (triangle as { headerLabelsJson?: unknown }).headerLabelsJson ?? null,
        normalizedTriangleJson: (triangle as { normalizedTriangleJson?: unknown }).normalizedTriangleJson ?? {},
        confidence: toConfidence((triangle as { confidence?: unknown }).confidence),
        extractionMethod: "ai" as const,
      };
    })
    .filter((value): value is NonNullable<typeof value> => value !== null);

  if (triangles.length > 0) {
    await db.insert(documentTriangles).values(triangles);
  }

  const narrative =
    asString(parsedAiTriangles.narrative) ??
    (await tryClaudeNarrative({
      mode: "triangle_analysis",
      payload: {
        triangles: triangles.map((triangle) => ({
          title: triangle.title,
          segmentLabel: triangle.segmentLabel,
          triangleType: triangle.triangleType,
          normalizedTriangleJson: triangle.normalizedTriangleJson,
        })),
      },
    }));

  if (narrative) {
    await insertInsights(target, [
      {
        insightType: "narrative",
        title: "Triangle Analysis Narrative",
        payloadJson: { narrative },
        confidence: "0.8500",
      },
    ]);
  }
}

async function processContractBranch(input: {
  target: Awaited<ReturnType<typeof getTargetDocument>>;
  deterministic: DiscoverAndExtractResult;
  localFilePath: string;
}) {
  const { target, deterministic, localFilePath } = input;
  if (!shouldAllowClaudeDocument(target.fileSizeBytes)) {
    throw new Error(
      `Contract-style files above ${MAX_CLAUDE_CONTRACT_FILE_BYTES} bytes are blocked from raw Claude submission`,
    );
  }

  const content = await buildClaudeContractContent({
    localFilePath,
    mimeType: target.mimeType,
  });
  const response = await callClaude({
    prompt: buildContractPrompt({
      fileName: target.filename,
      mimeType: target.mimeType,
      deterministicContext: {
        document: deterministic.document,
        sheets: deterministic.sheets.slice(0, 8),
        deterministic: deterministic.deterministic,
      },
      supplementalText: content.supplementalText,
    }),
    contentBlocks: content.contentBlocks,
    snapshotId: target.snapshotId,
    includeSnapshotFiles: true,
    maxTokens: 1800,
  });
  const parsed = parseJsonObject(response.text) as {
    contractTerms?: unknown;
    narrative?: unknown;
    documentType?: unknown;
    aiClassification?: unknown;
    aiConfidence?: unknown;
    searchText?: unknown;
  };

  await db
    .update(documents)
    .set({
      documentType:
        asEnum(parsed.documentType, [
          "claims",
          "policies",
          "loss_triangles",
          "workbook_tool",
          "other",
        ] as const) ??
        deterministic.document.documentType,
      aiClassification:
        asEnum(parsed.aiClassification, [
          "claims",
          "policies",
          "loss_triangles",
          "workbook_tool",
          "other",
          "unknown",
        ] as const) ?? deterministic.document.aiClassification,
      aiConfidence: toConfidence(parsed.aiConfidence) ?? toConfidence(deterministic.document.aiConfidence),
      searchText: asString(parsed.searchText) ?? deterministic.document.searchText,
      updatedAt: new Date(),
    })
    .where(eq(documents.id, target.documentId));

  await insertInsights(target, [
    {
      insightType: "contract_terms",
      title: "Contract Terms",
      payloadJson: parsed.contractTerms ?? {},
      confidence: "0.8000",
    },
    {
      insightType: "narrative",
      title: "Contract Narrative",
      payloadJson: { narrative: asString(parsed.narrative) ?? "" },
      confidence: "0.7500",
    },
  ]);
}

async function upsertSheetsFromDeterministic(input: {
  target: Awaited<ReturnType<typeof getTargetDocument>>;
  deterministic: DiscoverAndExtractResult;
}) {
  const { target, deterministic } = input;
  const sheets = deterministic.sheets;
  const toWrite = sheets.length > 0 ? sheets : [{ sheetName: "main", sheetIndex: 0, sheetType: "unknown" }];

  for (const [fallbackIndex, sheet] of toWrite.entries()) {
    const sheetName = asString((sheet as { sheetName?: unknown }).sheetName) ?? `sheet_${fallbackIndex}`;
    const sheetIndex = asInteger((sheet as { sheetIndex?: unknown }).sheetIndex) ?? fallbackIndex;
    const sheetType =
      asEnum((sheet as { sheetType?: unknown }).sheetType, [
        "claims_like",
        "policies_like",
        "triangle_like",
        "tool_sheet",
        "other",
        "unknown",
      ] as const) ?? "unknown";
    const aiClassification =
      asEnum((sheet as { aiClassification?: unknown }).aiClassification, [
        "claims_like",
        "policies_like",
        "triangle_like",
        "tool_sheet",
        "other",
        "unknown",
      ] as const) ?? "unknown";

    await db
      .insert(documentSheets)
      .values({
        documentId: target.documentId,
        orgId: target.orgId,
        snapshotId: target.snapshotId,
        sheetName,
        sheetIndex,
        sheetType,
        usedRangeJson: (sheet as { usedRangeJson?: unknown }).usedRangeJson ?? null,
        headersJson: (sheet as { headersJson?: unknown }).headersJson ?? [],
        sampleRowsJson: (sheet as { sampleRowsJson?: unknown }).sampleRowsJson ?? [],
        rowCountEstimate: asInteger((sheet as { rowCountEstimate?: unknown }).rowCountEstimate),
        detectedTablesJson: (sheet as { detectedTablesJson?: unknown }).detectedTablesJson ?? [],
        aiClassification,
        aiConfidence: toConfidence((sheet as { aiConfidence?: unknown }).aiConfidence),
        searchText: asString((sheet as { searchText?: unknown }).searchText),
        profileStatus: "completed",
        errorText: null,
      })
      .onConflictDoUpdate({
        target: [documentSheets.documentId, documentSheets.sheetIndex],
        set: {
          sheetName,
          sheetType,
          usedRangeJson: (sheet as { usedRangeJson?: unknown }).usedRangeJson ?? null,
          headersJson: (sheet as { headersJson?: unknown }).headersJson ?? [],
          sampleRowsJson: (sheet as { sampleRowsJson?: unknown }).sampleRowsJson ?? [],
          rowCountEstimate: asInteger((sheet as { rowCountEstimate?: unknown }).rowCountEstimate),
          detectedTablesJson: (sheet as { detectedTablesJson?: unknown }).detectedTablesJson ?? [],
          aiClassification,
          aiConfidence: toConfidence((sheet as { aiConfidence?: unknown }).aiConfidence),
          searchText: asString((sheet as { searchText?: unknown }).searchText),
          profileStatus: "completed",
          errorText: null,
          updatedAt: new Date(),
        },
      });
  }
}

async function upsertDocumentClassification(input: {
  documentId: string;
  deterministic: DiscoverAndExtractResult;
}) {
  await db
    .update(documents)
    .set({
      documentType:
        asEnum(input.deterministic.document.documentType, [
          "claims",
          "policies",
          "loss_triangles",
          "workbook_tool",
          "other",
        ] as const) ?? "other",
      aiClassification:
        asEnum(input.deterministic.document.aiClassification, [
          "claims",
          "policies",
          "loss_triangles",
          "workbook_tool",
          "other",
          "unknown",
        ] as const) ?? "unknown",
      aiConfidence: toConfidence(input.deterministic.document.aiConfidence),
      searchText: asString(input.deterministic.document.searchText),
      updatedAt: new Date(),
    })
    .where(eq(documents.id, input.documentId));
}

async function insertInsights(
  target: Awaited<ReturnType<typeof getTargetDocument>>,
  insights: Array<{
    insightType: InsightType;
    title: string;
    payloadJson: unknown;
    confidence: string | null;
  }>,
) {
  if (insights.length === 0) {
    return;
  }
  await db.insert(documentInsights).values(
    insights.map((insight) => ({
      documentId: target.documentId,
      sheetId: null,
      orgId: target.orgId,
      snapshotId: target.snapshotId,
      insightType: insight.insightType,
      title: insight.title,
      payloadJson: insight.payloadJson ?? {},
      confidence: insight.confidence,
      source: "ai",
    })),
  );
}

async function loadSheetIdsByIndex(documentId: string): Promise<Map<number, string>> {
  const rows = await db
    .select({ id: documentSheets.id, sheetIndex: documentSheets.sheetIndex })
    .from(documentSheets)
    .where(eq(documentSheets.documentId, documentId));
  return new Map(rows.map((row) => [row.sheetIndex, row.id]));
}

async function tryClaudeNarrative(input: {
  mode: "deterministic_summary" | "triangle_analysis";
  payload: unknown;
}): Promise<string | null> {
  try {
    const response = await callClaude({
      prompt: buildNarrativePrompt(input.mode, input.payload),
      maxTokens: 800,
    });
    const parsed = parseJsonObject(response.text) as { narrative?: unknown };
    return asString(parsed.narrative);
  } catch {
    return null;
  }
}

function buildNarrativePrompt(mode: "deterministic_summary" | "triangle_analysis", payload: unknown): string {
  return JSON.stringify({
    task:
      mode === "deterministic_summary"
        ? "Provide concise narrative for deterministic dataset summary."
        : "Provide concise actuarial narrative for extracted triangle payloads.",
    instructions: [
      "Return strict JSON only.",
      "Do not repeat payload verbatim.",
      "Focus on notable signals, caveats, and recommended next analysis actions.",
    ],
    payload,
    outputSchema: {
      narrative: "string",
    },
  });
}

function buildTriangleExtractionPrompt(input: {
  fileName: string;
  deterministicTriangles: Array<Record<string, unknown>>;
  deterministicSheets: Array<Record<string, unknown>>;
}): string {
  return JSON.stringify({
    task: "Extract all loss triangle blocks and segment labels from uploaded files.",
    fileName: input.fileName,
    deterministicContext: {
      triangles: input.deterministicTriangles,
      sheets: input.deterministicSheets,
    },
    instructions: [
      "Use attached Anthropic file references as primary source.",
      "Return one triangle object per detected segment/block.",
      "Prefer sheetIndex values from deterministicContext.sheets when possible.",
      "Return strict JSON only.",
    ],
    outputSchema: {
      triangles: [
        {
          sheetIndex: 0,
          title: "string|null",
          segmentLabel: "string|null",
          triangleType: "paid|incurred|reported|ultimate|unknown",
          rowStart: 1,
          rowEnd: 1,
          colStart: 1,
          colEnd: 1,
          headerLabelsJson: {},
          normalizedTriangleJson: {},
          confidence: "number 0..1",
        },
      ],
      narrative: "string",
    },
  });
}

function buildContractPrompt(input: {
  fileName: string;
  mimeType: string;
  deterministicContext: unknown;
  supplementalText: string | null;
}): string {
  return JSON.stringify({
    task: "Extract treaty/contract terms and short narrative.",
    file: {
      fileName: input.fileName,
      mimeType: input.mimeType,
    },
    deterministicContext: input.deterministicContext,
    supplementalText: input.supplementalText,
    instructions: [
      "Return strict JSON only.",
      "Extract cedant/reinsurer, treaty type, lines, limits/retentions, attachment points, cession rates, period, notable clauses if present.",
      "If supplementalText is present, use it as extra context.",
    ],
    outputSchema: {
      documentType: "claims|policies|loss_triangles|workbook_tool|other",
      aiClassification: "claims|policies|loss_triangles|workbook_tool|other|unknown",
      aiConfidence: "number 0..1",
      searchText: "string",
      contractTerms: {
        cedant: "string|null",
        reinsurer: "string|null",
        treatyType: "string|null",
        linesOfBusiness: ["string"],
        limits: {},
        retentions: {},
        attachmentPoints: {},
        cessionRates: {},
        policyPeriod: "string|null",
        notableClauses: ["string"],
      },
      narrative: "string",
    },
  });
}

async function callClaude(input: {
  prompt: string;
  maxTokens: number;
  contentBlocks?: Array<Record<string, unknown>>;
  snapshotId?: string;
  includeSnapshotFiles?: boolean;
}): Promise<ClaudeJsonResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }

  const model = resolveClaudeModel(process.env.CLAUDE_MODEL);
  const snapshotFileBlocks =
    input.includeSnapshotFiles && input.snapshotId
      ? await buildSnapshotAnthropicFileBlocks(input.snapshotId)
      : [];
  const messagesContent =
    input.contentBlocks && input.contentBlocks.length > 0
      ? [{ type: "text", text: input.prompt }, ...snapshotFileBlocks, ...input.contentBlocks]
      : input.includeSnapshotFiles && snapshotFileBlocks.length > 0
        ? [{ type: "text", text: input.prompt }, ...snapshotFileBlocks]
        : input.prompt;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": ANTHROPIC_FILES_BETA_HEADER,
    },
    body: JSON.stringify({
      model,
      max_tokens: input.maxTokens,
      temperature: 0.1,
      messages: [{ role: "user", content: messagesContent }],
    }),
  });
  if (!response.ok) {
    throw new Error(`Anthropic error ${response.status}: ${await response.text()}`);
  }
  const data = (await response.json()) as { content?: Array<{ type: string; text?: string }> };
  const text = data.content?.find((item) => item.type === "text")?.text;
  if (!text) {
    throw new Error("Anthropic returned no text content");
  }
  return { text };
}

function resolveClaudeModel(configuredModel: string | undefined): string {
  const model = configuredModel?.trim();
  if (!model) {
    return DEFAULT_CLAUDE_MODEL;
  }

  // Legacy aliases like "claude-3-5-sonnet-latest" can return 404 on some accounts.
  if (model.endsWith("-latest")) {
    return DEFAULT_CLAUDE_MODEL;
  }

  return model;
}

async function ensureAnthropicFileRegistered(input: {
  target: Awaited<ReturnType<typeof getTargetDocument>>;
  deterministic: DiscoverAndExtractResult;
  localFilePath: string;
}) {
  const existing = await db
    .select({
      mappingId: snapshotAnthropicFiles.id,
      fileRefId: snapshotAnthropicFiles.anthropicFileRefId,
      anthropicFileId: anthropicFiles.anthropicFileId,
    })
    .from(snapshotAnthropicFiles)
    .innerJoin(anthropicFiles, eq(anthropicFiles.id, snapshotAnthropicFiles.anthropicFileRefId))
    .where(
      and(
        eq(snapshotAnthropicFiles.documentId, input.target.documentId),
        eq(snapshotAnthropicFiles.status, "active"),
        eq(anthropicFiles.status, "active"),
      ),
    )
    .limit(1);

  if (existing.length > 0) {
    return;
  }

  const textContent = await buildAnthropicTextContent({
    target: input.target,
    deterministic: input.deterministic,
    localFilePath: input.localFilePath,
  });
  const anthropicFileId = await uploadTextFileToAnthropic({
    filename: `${input.target.filename}.txt`,
    text: textContent,
  });

  const [fileRef] = await db
    .insert(anthropicFiles)
    .values({
      anthropicFileId,
      originalFilename: input.target.filename,
      fileType: input.target.fileExtension ?? inferFileExtension(input.target.filename) ?? "unknown",
      status: "active",
      uploadedAt: new Date(),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [anthropicFiles.anthropicFileId],
      set: {
        status: "active",
        deletedAt: null,
        updatedAt: new Date(),
      },
    })
    .returning({ id: anthropicFiles.id });

  await db
    .insert(snapshotAnthropicFiles)
    .values({
      orgId: input.target.orgId,
      snapshotId: input.target.snapshotId,
      documentId: input.target.documentId,
      anthropicFileRefId: fileRef.id,
      status: "active",
      deletedAt: null,
      uploadedAt: new Date(),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [
        snapshotAnthropicFiles.snapshotId,
        snapshotAnthropicFiles.documentId,
        snapshotAnthropicFiles.anthropicFileRefId,
      ],
      set: {
        status: "active",
        deletedAt: null,
        updatedAt: new Date(),
      },
    });
}

async function buildAnthropicTextContent(input: {
  target: Awaited<ReturnType<typeof getTargetDocument>>;
  deterministic: DiscoverAndExtractResult;
  localFilePath: string;
}): Promise<string> {
  const ext = (input.target.fileExtension ?? inferFileExtension(input.target.filename) ?? "").toLowerCase();
  if (ext === "csv") {
    const csvText = await readFile(input.localFilePath, "utf8");
    return csvText.slice(0, 1_000_000);
  }

  if (ext === "xlsx") {
    const parts: string[] = [];
    for (const sheet of input.deterministic.sheets.slice(0, 50)) {
      const sheetName = asString((sheet as { sheetName?: unknown }).sheetName) ?? "unknown";
      const headers = Array.isArray((sheet as { headersJson?: unknown }).headersJson)
        ? ((sheet as { headersJson?: unknown[] }).headersJson as unknown[])
        : [];
      const sampleRows = Array.isArray((sheet as { sampleRowsJson?: unknown }).sampleRowsJson)
        ? ((sheet as { sampleRowsJson?: unknown[] }).sampleRowsJson as unknown[])
        : [];
      parts.push(`## Sheet: ${sheetName}`);
      parts.push(headers.map((header) => String(header ?? "")).join(","));
      for (const row of sampleRows.slice(0, 200)) {
        if (row && typeof row === "object") {
          const values = headers.map((header) =>
            String((row as Record<string, unknown>)[String(header)] ?? ""),
          );
          parts.push(values.join(","));
        }
      }
      parts.push("");
    }
    return parts.join("\n").slice(0, 1_000_000);
  }

  if (input.target.mimeType.startsWith("text/")) {
    const text = await readFile(input.localFilePath, "utf8");
    return text.slice(0, 1_000_000);
  }

  return JSON.stringify(
    {
      fileName: input.target.filename,
      mimeType: input.target.mimeType,
      deterministic: input.deterministic,
    },
    null,
    2,
  ).slice(0, 1_000_000);
}

async function uploadTextFileToAnthropic(input: {
  filename: string;
  text: string;
}): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }

  const form = new FormData();
  form.append("file", new Blob([input.text], { type: "text/plain" }), input.filename);

  const response = await fetch("https://api.anthropic.com/v1/files", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": ANTHROPIC_FILES_BETA_HEADER,
    },
    body: form,
  });

  if (!response.ok) {
    throw new Error(`Anthropic file upload error ${response.status}: ${await response.text()}`);
  }

  const data = (await response.json()) as { id?: string };
  if (!data.id) {
    throw new Error("Anthropic file upload returned no file id");
  }

  return data.id;
}

async function buildSnapshotAnthropicFileBlocks(
  snapshotId: string,
): Promise<Array<Record<string, unknown>>> {
  const rows = await db
    .select({
      anthropicFileId: anthropicFiles.anthropicFileId,
    })
    .from(snapshotAnthropicFiles)
    .innerJoin(anthropicFiles, eq(anthropicFiles.id, snapshotAnthropicFiles.anthropicFileRefId))
    .where(
      and(
        eq(snapshotAnthropicFiles.snapshotId, snapshotId),
        eq(snapshotAnthropicFiles.status, "active"),
        eq(anthropicFiles.status, "active"),
      ),
    );

  return rows.map((row) => ({
    type: "document",
    source: {
      type: "file",
      file_id: row.anthropicFileId,
    },
  }));
}

async function downloadFileToTemp(input: {
  tempDir: string;
  bucket: string;
  objectKey: string;
  fileName: string;
}): Promise<string> {
  const response = await s3Client.send(
    new GetObjectCommand({
      Bucket: input.bucket,
      Key: input.objectKey,
    }),
  );
  const body = response.Body as
    | {
        transformToByteArray?: () => Promise<Uint8Array>;
        transformToString?: () => Promise<string>;
      }
    | undefined;

  if (!body) {
    throw new Error("Unable to read uploaded object body");
  }

  const safeName = basename(input.fileName || "uploaded-file");
  const targetPath = join(input.tempDir, safeName);
  if (body.transformToByteArray) {
    const bytes = await body.transformToByteArray();
    await writeFile(targetPath, Buffer.from(bytes));
    return targetPath;
  }

  if (body.transformToString) {
    await writeFile(targetPath, await body.transformToString(), "utf8");
    return targetPath;
  }

  throw new Error("Unable to transform object body");
}

async function buildClaudeContractContent(input: {
  localFilePath: string;
  mimeType: string;
}): Promise<{ contentBlocks: Array<Record<string, unknown>>; supplementalText: string | null }> {
  if (input.mimeType === "application/pdf") {
    const bytes = await readFile(input.localFilePath);
    return {
      contentBlocks: [
        {
          type: "document",
          source: {
            type: "base64",
            media_type: "application/pdf",
            data: Buffer.from(bytes).toString("base64"),
          },
        },
      ],
      supplementalText: null,
    };
  }

  if (input.mimeType.startsWith("text/")) {
    const text = await readFile(input.localFilePath, "utf8");
    return {
      contentBlocks: [],
      supplementalText: text.slice(0, 80_000),
    };
  }

  return {
    contentBlocks: [],
    supplementalText: null,
  };
}

function assertDocumentReady(fileStatus: string, deletedAt: Date | null) {
  if (fileStatus !== "ready") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Document file is not ready for ingestion",
    });
  }
  if (deletedAt) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Document file has been deleted",
    });
  }
}

function shouldAllowClaudeDocument(fileSizeBytes: number): boolean {
  return fileSizeBytes <= MAX_CLAUDE_CONTRACT_FILE_BYTES;
}

async function getTargetDocument(input: StartDocumentIngestionInput) {
  const [row] = await db
    .select({
      documentId: documents.id,
      orgId: documents.orgId,
      snapshotId: documents.snapshotId,
      filename: documents.filename,
      fileExtension: documents.fileExtension,
      fileSizeBytes: documents.fileSizeBytes,
      mimeType: documents.mimeType,
      bucket: fileObjects.bucket,
      objectKey: fileObjects.objectKey,
      deletedAt: fileObjects.deletedAt,
      fileStatus: fileObjects.status,
    })
    .from(documents)
    .innerJoin(fileObjects, eq(fileObjects.id, documents.fileObjectId))
    .where(
      and(
        eq(documents.id, input.documentId),
        eq(documents.orgId, input.orgId),
        eq(documents.snapshotId, input.snapshotId),
      ),
    )
    .limit(1);
  if (!row) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Document not found",
    });
  }
  return row;
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

function asEnum<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  return typeof value === "string" && allowed.includes(value as T) ? (value as T) : null;
}

function toConfidence(value: unknown): string | null {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }
  return Math.max(0, Math.min(1, numeric)).toFixed(4);
}

function parseJsonObject(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start === -1 || end <= start) {
      throw new Error("Unable to parse JSON response from Claude");
    }
    return JSON.parse(trimmed.slice(start, end + 1));
  }
}

function normalizeTrianglesFromClaude(raw: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .map((triangle) => {
      if (!triangle || typeof triangle !== "object") {
        return null;
      }
      const sheetIndex = asInteger((triangle as { sheetIndex?: unknown }).sheetIndex);
      if (sheetIndex === null) {
        return null;
      }
      return triangle as Record<string, unknown>;
    })
    .filter((triangle): triangle is Record<string, unknown> => triangle !== null);
}

function inferFileExtension(fileName: string): string | null {
  const ext = extname(fileName).replace(".", "").toLowerCase();
  return ext || null;
}

function toErrorText(error: unknown): string {
  if (error instanceof Error) {
    return error.message.slice(0, 4000);
  }
  return "Document ingestion failed";
}

export const ingestionGuardrails = {
  shouldAllowClaudeDocument,
};
