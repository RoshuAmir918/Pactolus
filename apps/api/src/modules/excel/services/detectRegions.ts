export type DetectRegionsInput = {
  sheetSlice: {
    selectedAddress: string;
    headers: string[];
    sampleRows?: string[][];
  };
  maxRegionsPerType: number;
};

export type DetectRegionsResult = {
  source: "rules";
  candidates: Array<{
    address: string;
    regionType: "input" | "output";
    confidencePercent: number;
    userConfirmed: boolean;
    reason?: string;
    evidence?: string[];
  }>;
};

const INPUT_KEYWORDS = [
  "assumption",
  "factor",
  "selected",
  "selection",
  "trend",
  "tail",
  "rate",
  "weight",
  "loading",
  "parameter",
];

const OUTPUT_KEYWORDS = [
  "ultimate",
  "result",
  "projected",
  "indicated",
  "benchmark",
  "summary",
  "total",
  "variance",
  "diff",
];

export function detectRegions(input: DetectRegionsInput): DetectRegionsResult {
  const headers = input.sheetSlice.headers.map((header) => header.toLowerCase().trim());
  const selectedAddress = input.sheetSlice.selectedAddress;
  const numericDensity = computeNumericDensity(input.sheetSlice.sampleRows ?? []);
  const inputHeaderSignal = keywordSignal(headers, INPUT_KEYWORDS);
  const outputHeaderSignal = keywordSignal(headers, OUTPUT_KEYWORDS);

  const inputConfidence = clampPercent(
    Math.round(48 + inputHeaderSignal * 35 + (1 - numericDensity) * 17),
  );
  const outputConfidence = clampPercent(
    Math.round(45 + outputHeaderSignal * 30 + numericDensity * 25),
  );

  const candidates: DetectRegionsResult["candidates"] = [
    {
      address: selectedAddress,
      regionType: "input",
      confidencePercent: inputConfidence,
      userConfirmed: false,
      reason: "Input-like header keywords and low numeric density pattern.",
      evidence: ["header_keyword", "numeric_density", "selected_range"],
    },
    {
      address: selectedAddress,
      regionType: "output",
      confidencePercent: outputConfidence,
      userConfirmed: false,
      reason: "Output-like header keywords and numeric concentration pattern.",
      evidence: ["header_keyword", "numeric_density", "selected_range"],
    },
  ];

  return {
    source: "rules",
    candidates: candidates
      .sort((a, b) => b.confidencePercent - a.confidencePercent)
      .slice(0, Math.max(1, input.maxRegionsPerType) * 2),
  };
}

function computeNumericDensity(sampleRows: string[][]): number {
  let total = 0;
  let numeric = 0;

  for (const row of sampleRows) {
    for (const cell of row) {
      total += 1;
      if (isNumericLike(cell)) {
        numeric += 1;
      }
    }
  }

  if (total === 0) {
    return 0.5;
  }

  return numeric / total;
}

function keywordSignal(headers: string[], keywords: string[]): number {
  if (headers.length === 0) {
    return 0;
  }

  let hits = 0;
  for (const header of headers) {
    if (keywords.some((keyword) => header.includes(keyword))) {
      hits += 1;
    }
  }

  return hits / headers.length;
}

function isNumericLike(value: string): boolean {
  const cleaned = value.replace(/[$,%\s,]/g, "");
  if (!cleaned) {
    return false;
  }
  return !Number.isNaN(Number(cleaned));
}

function clampPercent(value: number): number {
  if (value < 0) {
    return 0;
  }
  if (value > 100) {
    return 100;
  }
  return value;
}
