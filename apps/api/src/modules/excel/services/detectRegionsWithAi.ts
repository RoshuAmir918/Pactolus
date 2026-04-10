type DetectRegionsWithAiInput = {
  sheetSlice: {
    workbookName?: string;
    sheetName: string;
    selectedAddress: string;
    rowCount?: number;
    columnCount?: number;
    headers: string[];
    sampleRows?: string[][];
  };
  maxRegionsPerType: number;
};

export type DetectRegionsWithAiResult = {
  candidates: Array<{
    address: string;
    regionType: "input" | "output";
    confidencePercent: number;
    userConfirmed: boolean;
    reason?: string;
    evidence?: string[];
    rowHeaderAddress?: string;   // e.g. "A2:A7" — column of labels to the left of the values
    colHeaderAddress?: string;   // e.g. "B1:G1" — row of labels above the values
  }>;
};

type RegionCandidate = DetectRegionsWithAiResult["candidates"][number];

export async function detectRegionsWithAi(
  input: DetectRegionsWithAiInput,
): Promise<DetectRegionsWithAiResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }

  const model = process.env.CLAUDE_MODEL ?? "claude-sonnet-4-5";
  const prompt = buildPrompt(input);
  const raw = await callAnthropicJson({ apiKey, model, prompt });
  return normalizeAiResponse(raw, input.maxRegionsPerType);
}

function buildPrompt(input: DetectRegionsWithAiInput): string {
  return JSON.stringify({
    task: "Identify likely input and output regions from Excel slice.",
    instructions: [
      "Return strict JSON only.",
      "Prefer addresses in A1 notation on the provided sheet.",
      "Return up to maxRegionsPerType per region type.",
      "Use confidencePercent from 0 to 100.",
    ],
    maxRegionsPerType: input.maxRegionsPerType,
    sheetSlice: input.sheetSlice,
    outputSchema: {
      candidates: [
        {
          address: "B2:B7",
          regionType: "input|output",
          confidencePercent: 0,
          reason: "short explanation",
          evidence: ["header_keyword", "table_shape", "numeric_density"],
          rowHeaderAddress: "A2:A7",
          colHeaderAddress: "B1:G1",
        },
      ],
    },
    headerInstructions: [
      "rowHeaderAddress: if the region has a column of text labels immediately to its left (e.g. 'Loss trend', 'ULAE loading'), set this to that label column's address.",
      "colHeaderAddress: if the region has a row of text labels immediately above it (e.g. column names or dates), set this to that label row's address.",
      "Set only the one that applies. Both may be null if no labels are adjacent.",
    ],
  });
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
        max_tokens: 900,
        temperature: 0.1,
        messages: [{ role: "user", content: input.prompt }],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Anthropic error ${response.status}: ${body}`);
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
      throw new Error("Unable to parse JSON response from AI");
    }
    return JSON.parse(trimmed.slice(start, end + 1));
  }
}

function normalizeAiResponse(raw: unknown, maxRegionsPerType: number): DetectRegionsWithAiResult {
  const candidatesRaw = (raw as { candidates?: unknown })?.candidates;
  if (!Array.isArray(candidatesRaw)) {
    return { candidates: [] };
  }

  const cleaned = candidatesRaw
    .map((item) => {
      const address = String((item as { address?: unknown }).address ?? "").trim();
      const regionType = String((item as { regionType?: unknown }).regionType ?? "").trim();
      const confidencePercent = Number(
        (item as { confidencePercent?: unknown }).confidencePercent ?? 0,
      );
      if (!address || (regionType !== "input" && regionType !== "output")) {
        return null;
      }
      const reasonValue = (item as { reason?: unknown }).reason;
      const evidenceValue = (item as { evidence?: unknown }).evidence;
      const reason = typeof reasonValue === "string" ? reasonValue.trim() : undefined;
      const evidence = Array.isArray(evidenceValue)
        ? evidenceValue.filter((v): v is string => typeof v === "string")
        : undefined;

      const rowHeaderAddress = (item as { rowHeaderAddress?: unknown }).rowHeaderAddress;
      const colHeaderAddress = (item as { colHeaderAddress?: unknown }).colHeaderAddress;

      const candidate: RegionCandidate = {
        address,
        regionType: regionType as "input" | "output",
        confidencePercent: clampPercent(confidencePercent),
        userConfirmed: false,
      };
      if (reason) candidate.reason = reason;
      if (evidence && evidence.length > 0) candidate.evidence = evidence;
      if (typeof rowHeaderAddress === "string" && rowHeaderAddress.trim())
        candidate.rowHeaderAddress = rowHeaderAddress.trim();
      if (typeof colHeaderAddress === "string" && colHeaderAddress.trim())
        candidate.colHeaderAddress = colHeaderAddress.trim();
      return candidate;
    })
    .filter((candidate): candidate is RegionCandidate => candidate !== null);

  return {
    candidates: limitPerType(cleaned, maxRegionsPerType),
  };
}

function limitPerType(
  candidates: Array<{
    address: string;
    regionType: "input" | "output";
    confidencePercent: number;
    userConfirmed: boolean;
    reason?: string;
    evidence?: string[];
  }>,
  maxPerType: number,
) {
  const grouped = new Map<"input" | "output", typeof candidates>();
  grouped.set("input", []);
  grouped.set("output", []);

  for (const candidate of candidates.sort((a, b) => b.confidencePercent - a.confidencePercent)) {
    const list = grouped.get(candidate.regionType)!;
    if (list.length < maxPerType) {
      list.push(candidate);
    }
  }

  return [...(grouped.get("input") ?? []), ...(grouped.get("output") ?? [])];
}

function clampPercent(value: number): number {
  if (Number.isNaN(value)) {
    return 0;
  }
  if (value < 0) {
    return 0;
  }
  if (value > 100) {
    return 100;
  }
  return Math.round(value);
}
