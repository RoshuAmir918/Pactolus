import type { ClaudeToolDefinition } from "../shared/types";

export const WORKBOOK_CLASSIFICATION_TOOL: ClaudeToolDefinition = {
  name: "classify_workbook",
  description: "Classify workbook and sheets for ingestion routing.",
  input_schema: {
    type: "object",
    properties: {
      documentType: {
        type: "string",
        enum: ["claims", "policies", "loss_triangles", "workbook_tool", "other"],
      },
      aiClassification: {
        type: "string",
        enum: ["claims", "policies", "loss_triangles", "workbook_tool", "other", "unknown"],
      },
      aiConfidence: {
        type: "number",
        minimum: 0,
        maximum: 1,
      },
      sheetClassifications: {
        type: "array",
        items: {
          type: "object",
          properties: {
            sheetIndex: { type: "integer", minimum: 0 },
            sheetType: {
              type: "string",
              enum: ["claims_like", "policies_like", "triangle_like", "tool_sheet", "other", "unknown"],
            },
            aiClassification: {
              type: "string",
              enum: ["claims_like", "policies_like", "triangle_like", "tool_sheet", "other", "unknown"],
            },
            aiConfidence: { type: "number", minimum: 0, maximum: 1 },
          },
          required: ["sheetIndex", "sheetType", "aiClassification"],
        },
      },
    },
    required: ["documentType", "aiClassification", "sheetClassifications"],
  },
};

export const TRIANGLE_EXTRACTION_TOOL: ClaudeToolDefinition = {
  name: "extract_loss_triangles",
  description: "Extract loss triangle blocks with metadata and optional narrative.",
  input_schema: {
    type: "object",
    properties: {
      triangles: {
        type: "array",
        items: {
          type: "object",
          properties: {
            sheetIndex: { type: "integer", minimum: 0 },
            title: { type: ["string", "null"] },
            segmentLabel: { type: ["string", "null"] },
            triangleType: {
              type: "string",
              enum: ["paid", "incurred", "reported", "ultimate", "unknown"],
            },
            rowStart: { type: ["integer", "null"] },
            rowEnd: { type: ["integer", "null"] },
            colStart: { type: ["integer", "null"] },
            colEnd: { type: ["integer", "null"] },
            headerLabelsJson: {},
            normalizedTriangleJson: {},
            industry: { type: ["string", "null"] },
            lineOfBusiness: { type: ["string", "null"] },
            portfolioClassification: { type: ["string", "null"] },
            segmentClassification: { type: ["string", "null"] },
            metadata: { type: "object" },
            confidence: { type: ["number", "null"], minimum: 0, maximum: 1 },
          },
          required: ["sheetIndex", "triangleType"],
        },
      },
      narrative: { type: ["string", "null"] },
    },
    required: ["triangles"],
  },
};

export const CONTRACT_EXTRACTION_TOOL: ClaudeToolDefinition = {
  name: "extract_contract_terms",
  description: "Extract contract terms, search text, and narrative.",
  input_schema: {
    type: "object",
    properties: {
      searchText: { type: ["string", "null"] },
      contractTerms: { type: "object" },
      narrative: { type: ["string", "null"] },
    },
    required: ["contractTerms"],
  },
};

export const NARRATIVE_TOOL: ClaudeToolDefinition = {
  name: "summarize_narrative",
  description: "Produce concise narrative for provided dataset payload.",
  input_schema: {
    type: "object",
    properties: {
      narrative: { type: ["string", "null"] },
    },
    required: ["narrative"],
  },
};
