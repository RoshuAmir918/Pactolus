import { readFile } from "node:fs/promises";

export async function buildClaudeContractContent(input: {
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
