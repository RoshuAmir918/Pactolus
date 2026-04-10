import type { MonitoredRegion } from "@/features/types";

export const WORKBOOK_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export async function getWorkbookBlob(): Promise<{ blob: Blob; sizeBytes: number }> {
  return new Promise((resolve, reject) => {
    Office.context.document.getFileAsync(
      Office.FileType.Compressed,
      { sliceSize: 4194304 },
      async (fileResult) => {
        if (fileResult.status !== Office.AsyncResultStatus.Succeeded) {
          reject(new Error(fileResult.error?.message ?? "getFileAsync failed"));
          return;
        }
        const file = fileResult.value;
        const slices: Uint8Array[] = [];
        try {
          for (let i = 0; i < file.sliceCount; i++) {
            await new Promise<void>((res, rej) => {
              file.getSliceAsync(i, (sliceResult) => {
                if (sliceResult.status !== Office.AsyncResultStatus.Succeeded) {
                  rej(new Error(sliceResult.error?.message ?? "getSliceAsync failed"));
                  return;
                }
                const raw = sliceResult.value.data;
                slices.push(
                  raw instanceof ArrayBuffer
                    ? new Uint8Array(raw)
                    : new Uint8Array(raw as number[]),
                );
                res();
              });
            });
          }
        } finally {
          file.closeAsync(() => {});
        }
        const sizeBytes = slices.reduce((sum, s) => sum + s.byteLength, 0);
        const combined = new Uint8Array(sizeBytes);
        let offset = 0;
        for (const slice of slices) {
          combined.set(slice, offset);
          offset += slice.byteLength;
        }
        resolve({ blob: new Blob([combined], { type: WORKBOOK_CONTENT_TYPE }), sizeBytes });
      },
    );
  });
}

export type RangeSlice = {
  address: string;
  sheetName: string;
  headers: string[];
  rows: string[][];
  rowCount: number;
  columnCount: number;
};

export async function getSelectedRangeSlice(): Promise<RangeSlice | null> {
  return Excel.run(async (context) => {
    const sheet = context.workbook.worksheets.getActiveWorksheet();
    const range = context.workbook.getSelectedRange();
    sheet.load("name");
    range.load(["address", "values", "rowCount", "columnCount"]);
    await context.sync();

    // Skip single-cell selections (just cursor movement)
    if (range.rowCount === 1 && range.columnCount === 1) return null;
    // Skip very large selections to avoid huge payloads
    if (range.rowCount > 500 || range.columnCount > 50) return null;

    const values = (range.values ?? []) as unknown[][];
    const normalized = values.map((row) => row.map((cell) => stringifyCell(cell)));

    return {
      address: normalizeAddress(range.address),
      sheetName: sheet.name,
      headers: normalized[0] ?? [],
      rows: normalized.slice(1),
      rowCount: range.rowCount,
      columnCount: range.columnCount,
    };
  });
}

export function formatRangeSliceForContext(slice: RangeSlice): string {
  const lines: string[] = [
    `Sheet: "${slice.sheetName}" | Range: ${slice.address} | ${slice.rowCount} row(s) × ${slice.columnCount} column(s)`,
  ];
  if (slice.headers.length > 0) lines.push(slice.headers.join("\t"));
  for (const row of slice.rows.slice(0, 100)) {
    lines.push(row.join("\t"));
  }
  return lines.join("\n");
}

export async function getActiveCell(): Promise<string | null> {
  return Excel.run(async (context) => {
    const cell = context.workbook.getActiveCell();
    cell.load("address");
    await context.sync();
    return normalizeAddress(cell.address);
  }).catch(() => null);
}

export async function writeRangeValues(input: {
  startCell: string;
  values: unknown[][];
  sheetName?: string;
}): Promise<void> {
  return Excel.run(async (context) => {
    const sheet = input.sheetName
      ? context.workbook.worksheets.getItem(input.sheetName)
      : context.workbook.worksheets.getActiveWorksheet();

    const rows = input.values.length;
    const cols = Math.max(...input.values.map((r) => r.length));
    const range = sheet.getRange(`${input.startCell}`).getResizedRange(rows - 1, cols - 1);
    range.values = input.values as string[][];
    await context.sync();
  });
}

// Cell type classification: F=formula, N=hardcoded number, T=hardcoded text, E=empty
export type CellType = "F" | "N" | "T" | "E";

export type ClassifiedRegion = {
  address: string;       // e.g. "B13:N22"
  type: CellType;        // dominant type of this region
  fontColor: string;     // dominant non-black font color, "" if none
};

export type SheetSlice = {
  sheetName: string;
  headers: string[];
  sampleRows: string[][];
  regions: ClassifiedRegion[];  // pre-computed contiguous regions
  rowCount: number;
  columnCount: number;
};

export async function captureAllSheetSlices(maxSheets = 6, maxRows = 80): Promise<SheetSlice[]> {
  return Excel.run(async (context) => {
    const sheets = context.workbook.worksheets;
    sheets.load("items/name");
    await context.sync();

    const results: SheetSlice[] = [];

    for (const sheet of sheets.items.slice(0, maxSheets)) {
      try {
        const usedRange = sheet.getUsedRange(true);
        usedRange.load(["values", "formulas", "rowCount", "columnCount", "address"]);

        // Load per-cell fill and font colors
        let cellProps: { value: Array<Array<{ format: { fill: { color: string }; font: { color: string } } }>> } | null = null;
        try {
          cellProps = usedRange.getCellProperties({ format: { fill: { color: true }, font: { color: true } } }) as unknown as typeof cellProps;
        } catch {
          // getCellProperties not available in this environment
        }

        await context.sync();

        const values = (usedRange.values ?? []) as unknown[][];
        const formulas = (usedRange.formulas ?? []) as unknown[][];
        const propsGrid = cellProps?.value ?? null;

        const allRows = values.slice(0, maxRows + 1);
        const allFormulas = formulas.slice(0, maxRows + 1);

        const normalized = allRows.map((row) => row.map((cell) => stringifyCell(cell)));
        const headers = normalized[0] ?? [];
        const sampleRows = normalized.slice(1);

        // Classify each cell
        const cellTypes: CellType[][] = allFormulas.slice(1).map((row, ri) =>
          row.map((formulaCell, ci) => {
            const formula = stringifyCell(formulaCell);
            if (formula.startsWith("=")) return "F";
            const val = allRows[ri + 1]?.[ci];
            if (val === null || val === undefined || val === "") return "E";
            return typeof val === "number" ? "N" : "T";
          })
        );

        const NEUTRAL_FONT = new Set(["#FFFFFF", "#000000", "#333333", "white", "black", ""]);

        const fontColorGrid: string[][] = sampleRows.map((row, ri) =>
          row.map((_, ci) => {
            const color = propsGrid?.[ri + 1]?.[ci]?.format?.font?.color ?? "";
            return NEUTRAL_FONT.has(color) ? "" : color.toUpperCase();
          })
        );

        // Parse starting row/col from the range address (e.g. "Sheet1!B7:N22" → col=2, row=7)
        const rawAddress = normalizeAddress(usedRange.address); // strips sheet prefix, e.g. "B7:N22"
        const startCell = rawAddress.split(":")[0] ?? rawAddress; // "B7"
        const startColMatch = startCell.match(/^([A-Z]+)/);
        const startRowMatch = startCell.match(/(\d+)$/);
        const startCol = startColMatch ? columnToNumber(startColMatch[1]) : 1; // 1-based
        const startRow = startRowMatch ? parseInt(startRowMatch[1], 10) : 1;   // 1-based

        const regions = computeRegions(cellTypes, fontColorGrid, usedRange.rowCount - 1, usedRange.columnCount, startCol, startRow);

        results.push({
          sheetName: sheet.name,
          headers,
          sampleRows,
          regions,
          rowCount: usedRange.rowCount,
          columnCount: usedRange.columnCount,
        });
      } catch {
        // sheet may be empty or protected — skip it
      }
    }

    return results;
  });
}

export async function getWorkbookName(): Promise<string | null> {
  try {
    return Excel.run(async (context) => {
      context.workbook.load("name");
      await context.sync();
      return context.workbook.name ?? null;
    });
  } catch {
    return null;
  }
}

export type RegionValues = {
  address: string;
  sheetName: string;
  regionType: "input" | "output";
  description?: string;   // user-facing label shown in web UI
  reason?: string;        // internal reasoning, not shown to users
  colHeaders?: string[];  // values from the row above the region (column axis labels)
  rowHeaders?: string[];  // values from the column to the left of the region (row axis labels)
  values: unknown[][];
};

/** Reads values from all detected regions, plus any header ranges the AI identified. */
export async function readAllRegionValues(regions: MonitoredRegion[]): Promise<RegionValues[]> {
  const relevant = regions.filter((r) => r.address && r.sheetName);
  if (relevant.length === 0) return [];

  return Excel.run(async (context) => {
    // How many columns to the left of the identified rowHeaderAddress we scan.
    // Reading a wider range and taking the rightmost non-empty value per row handles
    // merged cells of any width: a B:C merge stores the value in B and leaves C empty,
    // so scanning A:C and picking rightmost non-empty always lands on B.
    const MERGE_SCAN_COLS = 4;

    type Fetch = {
      region: MonitoredRegion;
      range: Excel.Range;
      colHeaderRange: Excel.Range | null;
      rowHeaderScanRange: Excel.Range | null;
    };
    const fetches: Fetch[] = [];

    for (const region of relevant) {
      const sheet = context.workbook.worksheets.getItem(region.sheetName!);
      const range = sheet.getRange(region.address);
      range.load("values");

      let colHeaderRange: Excel.Range | null = null;
      let rowHeaderScanRange: Excel.Range | null = null;

      if (region.colHeaderAddress) {
        colHeaderRange = sheet.getRange(region.colHeaderAddress);
        colHeaderRange.load("values");
      }
      if (region.rowHeaderAddress) {
        const scanAddr = buildScanRange(region.rowHeaderAddress, MERGE_SCAN_COLS);
        rowHeaderScanRange = sheet.getRange(scanAddr);
        rowHeaderScanRange.load("values");
      }

      fetches.push({ region, range, colHeaderRange, rowHeaderScanRange });
    }

    await context.sync();

    return fetches.map(({ region, range, colHeaderRange, rowHeaderScanRange }) => {
      let rowHeaders: string[] | undefined;
      if (rowHeaderScanRange) {
        // For each row, take the rightmost non-empty value.
        // In a merged B:C cell, B has the value and C is ""; rightmost non-empty = B. ✓
        rowHeaders = ((rowHeaderScanRange.values ?? []) as unknown[][]).map((row) => {
          for (let i = row.length - 1; i >= 0; i--) {
            if (row[i] !== null && row[i] !== "" && row[i] !== undefined) return String(row[i]);
          }
          return "";
        });
      }

      return {
        address: region.address,
        sheetName: region.sheetName!,
        regionType: region.regionType,
        description: region.description,
        reason: region.reason,
        colHeaders: colHeaderRange
          ? ((colHeaderRange.values?.[0] ?? []) as unknown[]).map((v) => (v === null || v === "" ? "" : String(v)))
          : undefined,
        rowHeaders,
        values: (range.values ?? []) as unknown[][],
      };
    });
  });
}

/**
 * Expands a single-column range leftward by `scanCols` columns.
 * e.g. buildScanRange("C36:C41", 4) → "A36:C41"  (clamped at column A)
 * Reading this wider range and taking the rightmost non-empty value per row
 * correctly resolves merged cells of any width without needing extra API calls.
 */
function buildScanRange(address: string, scanCols: number): string {
  const match = address.match(/^([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/i);
  if (!match) return address;
  const endColNum = columnToNumber((match[3] ?? match[1]).toUpperCase());
  const endRow = match[4] ?? match[2];
  const startRow = match[2];
  const scanStartNum = Math.max(1, endColNum - scanCols);
  return `${colToLetter(scanStartNum)}${startRow}:${colToLetter(endColNum)}${endRow}`;
}

export async function selectRange(sheetName: string | undefined, address: string): Promise<void> {
  return Excel.run(async (context) => {
    const sheet = sheetName
      ? context.workbook.worksheets.getItem(sheetName)
      : context.workbook.worksheets.getActiveWorksheet();
    sheet.getRange(address).select();
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

function columnToNumber(col: string): number {
  let result = 0;
  for (let i = 0; i < col.length; i += 1) {
    result = result * 26 + (col.charCodeAt(i) - 64);
  }
  return result;
}

function computeRegions(
  cellTypes: CellType[][],
  fontColors: string[][],
  rows: number,
  cols: number,
  startCol = 1,  // 1-based column where the used range begins
  startRow = 1,  // 1-based row where the used range begins
): ClassifiedRegion[] {
  const visited = Array.from({ length: rows }, () => new Array(cols).fill(false));
  const regions: ClassifiedRegion[] = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const type = cellTypes[r]?.[c] ?? "E";
      if (visited[r][c] || type === "E") continue;

      // Expand right along first row
      let endC = c;
      while (endC + 1 < cols && (cellTypes[r]?.[endC + 1] ?? "E") === type && !visited[r][endC + 1]) {
        endC++;
      }

      // Expand down — allow trailing empty cells per row (triangular shapes).
      // A row can join if it starts at the same column with the correct type,
      // and only has empty cells after it ends (no other type intruding).
      let endR = r;
      while (endR + 1 < rows) {
        const nextRow = endR + 1;
        const nextType = cellTypes[nextRow]?.[c] ?? "E";
        if (nextType !== type) break;

        // Check that all non-empty cells in this row from c..endC are the correct type
        let rowOk = true;
        for (let cc = c; cc <= endC; cc++) {
          const t = cellTypes[nextRow]?.[cc] ?? "E";
          if (t !== type && t !== "E") { rowOk = false; break; }
        }
        if (!rowOk) break;
        endR++;
      }

      // Mark visited — mark the full bounding box including empty trailing cells
      for (let rr = r; rr <= endR; rr++)
        for (let cc = c; cc <= endC; cc++)
          visited[rr][cc] = true;

      // Skip single-cell text regions (labels)
      const cellCount = (endR - r + 1) * (endC - c + 1);
      if (type === "T" && cellCount === 1) continue;

      // Dominant font color
      const colorCounts: Record<string, number> = {};
      for (let rr = r; rr <= endR; rr++)
        for (let cc = c; cc <= endC; cc++) {
          const fc = fontColors[rr]?.[cc] ?? "";
          if (fc) colorCounts[fc] = (colorCounts[fc] ?? 0) + 1;
        }
      const fontColor = Object.entries(colorCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";

      // +1 because sampleRows skips the header row (index 0 = row 2 of used range)
      const startAddr = `${colToLetter(startCol + c)}${startRow + r + 1}`;
      const endAddr = `${colToLetter(startCol + endC)}${startRow + endR + 1}`;
      const address = startAddr === endAddr ? startAddr : `${startAddr}:${endAddr}`;

      regions.push({ address, type, fontColor });
    }
  }
  return regions;
}

function colToLetter(col: number): string {
  let result = "";
  while (col > 0) {
    const rem = (col - 1) % 26;
    result = String.fromCharCode(65 + rem) + result;
    col = Math.floor((col - 1) / 26);
  }
  return result;
}

function stringifyCell(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value);
}
