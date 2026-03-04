export { proposeMappingActivity } from "./ingestion/proposeMapping";
export { validateMappingActivity } from "./ingestion/validateMapping";
export { canonicalizeActivity } from "./ingestion/canonicalize";

export type {
  ProposeMappingResult,
  ValidateMappingInput,
  ValidateMappingResult,
  CanonicalizeInput,
  CanonicalizeResult,
} from "./ingestion/types";
