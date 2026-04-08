import type { ViewerCapture, ViewerNode, ViewerRegion } from "./types";

export function labelForNode(input: {
  type: string;
  parametersJson?: unknown;
  defaultLabel?: string;
}): string {
  const params = (input.parametersJson as Record<string, unknown> | null) ?? null;
  const label = typeof params?.label === "string" ? params.label : null;
  if (label && label.trim()) return label;
  if (input.defaultLabel) return input.defaultLabel;
  return input.type.replace(/_/g, " ");
}

export function typeLabel(type: string): string {
  switch (type) {
    case "scenario_snapshot":
      return "Scenario saved";
    case "branch_forked":
      return "Branch started";
    case "assumptions_extracted":
      return "Assumptions extracted";
    case "branch_completed":
      return "Branch completed";
    default:
      return type.replace(/_/g, " ");
  }
}

export function toRegions(captures: ViewerCapture[] | null): ViewerRegion[] {
  if (!captures?.length) return [];
  const regionValuesCapture = captures.find((capture) => capture.captureType === "region_values");
  const outputValuesCapture = captures.find((capture) => capture.captureType === "output_values");
  const payload =
    (regionValuesCapture?.payloadJson as { regions?: ViewerRegion[] } | null) ??
    (outputValuesCapture?.payloadJson as { regions?: ViewerRegion[] } | null);
  return payload?.regions ?? [];
}

export function toNarrative(captures: ViewerCapture[] | null): string {
  if (!captures?.length) return "";
  const narrative = captures.find((capture) => capture.captureType === "narrative");
  return ((narrative?.payloadJson as { text?: string } | null)?.text ?? narrative?.summaryText ?? "").trim();
}

export function toViewerNode(input: {
  id: string;
  index: number | null;
  type: string;
  createdAt: Date | null;
  parametersJson?: unknown;
}): ViewerNode {
  return {
    id: input.id,
    index: input.index,
    type: input.type,
    createdAt: input.createdAt,
    parametersJson: input.parametersJson,
    label: labelForNode({ type: input.type, parametersJson: input.parametersJson }),
  };
}
