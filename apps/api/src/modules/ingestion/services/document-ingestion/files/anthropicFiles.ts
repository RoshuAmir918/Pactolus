import { readFile } from "node:fs/promises";
import { and, eq } from "drizzle-orm";
import dbClient from "@api/db/client";
import { anthropicFiles, snapshotAnthropicFiles } from "@db/schema";
import type { DiscoverAndExtractResult } from "../../discovery/discoverAndExtract";
import { inferFileExtension } from "../shared/helpers";
import { asString } from "../shared/parsers";
import type { TargetDocument } from "../shared/types";

const { db } = dbClient;
const ANTHROPIC_FILES_BETA_HEADER = "files-api-2025-04-14";

export async function ensureAnthropicFileRegistered(input: {
  target: TargetDocument;
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

export async function buildAnthropicTextContent(input: {
  target: TargetDocument;
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
      parts.push(`Headers: ${headers.map((header) => String(header ?? "")).join("\t")}`);
      parts.push("Rows (tab-separated):");
      for (const [rowOffset, row] of sampleRows.slice(0, 1000).entries()) {
        if (row && typeof row === "object") {
          const values = headers.map((header) =>
            String((row as Record<string, unknown>)[String(header)] ?? ""),
          );
          parts.push(`${rowOffset + 1}\t${values.join("\t")}`);
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

export async function uploadTextFileToAnthropic(input: {
  filename: string;
  text: string;
}): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }

  const maxAttempts = 4;
  let lastErrorText = "unknown error";
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
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

    if (response.ok) {
      const data = (await response.json()) as { id?: string };
      if (!data.id) {
        throw new Error("Anthropic file upload returned no file id");
      }
      return data.id;
    }

    lastErrorText = await response.text();
    const retryable = response.status >= 500 || response.status === 429;
    if (!retryable || attempt === maxAttempts) {
      throw new Error(`Anthropic file upload error ${response.status}: ${lastErrorText}`);
    }

    // Exponential backoff for transient Anthropic-side failures.
    const backoffMs = 500 * 2 ** (attempt - 1) + Math.floor(Math.random() * 200);
    await sleep(backoffMs);
  }

  throw new Error(`Anthropic file upload error after retries: ${lastErrorText}`);
}

export async function buildSnapshotAnthropicFileBlocks(
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

export async function buildDocumentAnthropicFileBlocks(
  documentId: string,
): Promise<Array<Record<string, unknown>>> {
  const rows = await db
    .select({
      anthropicFileId: anthropicFiles.anthropicFileId,
    })
    .from(snapshotAnthropicFiles)
    .innerJoin(anthropicFiles, eq(anthropicFiles.id, snapshotAnthropicFiles.anthropicFileRefId))
    .where(
      and(
        eq(snapshotAnthropicFiles.documentId, documentId),
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
