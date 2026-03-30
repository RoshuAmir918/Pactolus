import type { MonitoredRegion, Snapshot } from "@/features/types";

export async function captureSnapshot(): Promise<Snapshot> {
  return Excel.run(async (context) => {
    const workbook = context.workbook;
    const sheet = workbook.worksheets.getActiveWorksheet();
    const range = workbook.getSelectedRange();

    workbook.load("name");
    sheet.load("name");
    range.load(["address", "values", "rowCount", "columnCount"]);
    await context.sync();

    const values = (range.values ?? []) as unknown[][];
    const normalized = values.map((row) => row.map((cell) => stringifyCell(cell)));
    const headers = normalized[0] ?? [];
    const sampleRows = normalized.slice(1, 11);

    return {
      workbookName: workbook.name,
      sheetName: sheet.name,
      selectedAddress: range.address,
      rowCount: range.rowCount,
      columnCount: range.columnCount,
      headers,
      sampleRows,
    };
  });
}

export async function applySuggestion(value: string): Promise<void> {
  return Excel.run(async (context) => {
    const target = context.workbook.getActiveCell();
    target.values = [[value]];
    await context.sync();
  });
}

export async function startWorksheetMonitoring(input: {
  sheetName: string;
  onChanged: (eventArgs: Excel.WorksheetChangedEventArgs) => Promise<void>;
  currentSubscription: OfficeExtension.EventHandlerResult<Excel.WorksheetChangedEventArgs> | null;
}): Promise<OfficeExtension.EventHandlerResult<Excel.WorksheetChangedEventArgs>> {
  if (input.currentSubscription) {
    await stopWorksheetMonitoring(input.currentSubscription);
  }

  let nextSubscription: OfficeExtension.EventHandlerResult<Excel.WorksheetChangedEventArgs>;
  await Excel.run(async (context) => {
    const sheet = context.workbook.worksheets.getItem(input.sheetName);
    nextSubscription = sheet.onChanged.add(async (eventArgs) => {
      await input.onChanged(eventArgs);
    });
    await context.sync();
  });

  return nextSubscription!;
}

export async function stopWorksheetMonitoring(
  subscription: OfficeExtension.EventHandlerResult<Excel.WorksheetChangedEventArgs> | null,
): Promise<void> {
  if (!subscription) {
    return;
  }

  await Excel.run(subscription.context, async (context) => {
    subscription.remove();
    await context.sync();
  });
}

export function normalizeAddress(address: string): string {
  const withoutSheet = address.includes("!")
    ? address.substring(address.indexOf("!") + 1)
    : address;
  const withoutAbsolute = withoutSheet.replace(/\$/g, "");
  return withoutAbsolute.split(",")[0]?.trim().toUpperCase() ?? "";
}

export function rangesIntersect(left: string, right: string): boolean {
  const a = parseRange(left);
  const b = parseRange(right);
  if (!a || !b) {
    return false;
  }

  return !(
    a.endRow < b.startRow ||
    b.endRow < a.startRow ||
    a.endCol < b.startCol ||
    b.endCol < a.startCol
  );
}

export function filterTriggeredRegions(
  monitoredRegions: MonitoredRegion[],
  sheetName: string,
  changedAddress: string,
): MonitoredRegion[] {
  return monitoredRegions.filter(
    (region) =>
      region.sheetName === sheetName &&
      region.status === "active" &&
      rangesIntersect(normalizeAddress(region.address), changedAddress),
  );
}

function parseRange(value: string):
  | { startRow: number; endRow: number; startCol: number; endCol: number }
  | null {
  if (!value) {
    return null;
  }

  const [startPart, endPart] = value.split(":");
  const start = parseCell(startPart);
  const end = parseCell(endPart ?? startPart);
  if (!start || !end) {
    return null;
  }

  return {
    startRow: Math.min(start.row, end.row),
    endRow: Math.max(start.row, end.row),
    startCol: Math.min(start.col, end.col),
    endCol: Math.max(start.col, end.col),
  };
}

function parseCell(value: string): { row: number; col: number } | null {
  const match = value.match(/^([A-Z]+)(\d+)$/);
  if (!match) {
    return null;
  }
  const col = columnToNumber(match[1]);
  const row = Number(match[2]);
  if (!col || !row) {
    return null;
  }
  return { row, col };
}

function columnToNumber(col: string): number {
  let result = 0;
  for (let i = 0; i < col.length; i += 1) {
    result = result * 26 + (col.charCodeAt(i) - 64);
  }
  return result;
}

function stringifyCell(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value);
}
