/**
 * Converts an ExcelJS Workbook into a Univer IWorkbookData snapshot.
 * Preserves: cell values, formulas, fonts, fills, borders, alignment,
 * number formats, merged cells, column widths, row heights.
 */

import type ExcelJS from "exceljs";

// ── Univer shape (subset we need) ────────────────────────────────────────────
// We declare only what we reference so there's no circular import on the
// heavy Univer core bundle at module evaluation time.

type IColorStyle = { rgb?: string };
type IBorderStyleData = { s: number; cl: IColorStyle };
type IBorderData = {
  t?: IBorderStyleData; r?: IBorderStyleData;
  b?: IBorderStyleData; l?: IBorderStyleData;
};
type IStyleData = {
  ff?: string; fs?: number; it?: number; bl?: number;
  ul?: { s: number }; st?: { s: number };
  bg?: IColorStyle; cl?: IColorStyle; bd?: IBorderData;
  ht?: number; vt?: number; tb?: number;
  n?: { pattern: string };
};
type ICellData = {
  v?: string | number | boolean | null;
  t?: number;
  f?: string;
  s?: string | IStyleData;
};
type IWorksheetData = {
  id: string; name: string; tabColor: string; hidden: number;
  freeze: object; rowCount: number; columnCount: number;
  zoomRatio: number; scrollTop: number; scrollLeft: number;
  defaultColumnWidth: number; defaultRowHeight: number;
  mergeData: Array<{ startRow: number; startColumn: number; endRow: number; endColumn: number }>;
  cellData: Record<number, Record<number, ICellData>>;
  rowData: Record<number, { h?: number; hd?: number }>;
  columnData: Record<number, { w?: number; hd?: number }>;
  rowHeader: { width: number }; columnHeader: { height: number };
  showGridlines: number;
};
export type IWorkbookData = {
  id: string; name: string; appVersion: string; locale: string;
  styles: Record<string, IStyleData>;
  sheetOrder: string[];
  sheets: Record<string, Partial<IWorksheetData>>;
};

// ── helpers ───────────────────────────────────────────────────────────────────

function argbToRgb(argb?: string): string | undefined {
  if (!argb || argb.length < 6) return undefined;
  // ARGB → skip alpha, take last 6 hex chars
  const hex = argb.length === 8 ? argb.slice(2) : argb.slice(-6);
  return `#${hex.toUpperCase()}`;
}

const EXCEL_BORDER_TO_UNIVER: Record<string, number> = {
  thin: 1, hair: 2, dotted: 3, dashed: 4,
  dashDot: 5, dashDotDot: 6, double: 7,
  medium: 8, mediumDashed: 9, mediumDashDot: 10,
  mediumDashDotDot: 11, slantDashDot: 12, thick: 13,
};

const H_ALIGN: Record<string, number> = {
  left: 1, center: 2, right: 3, justify: 4, distributed: 6,
};
const V_ALIGN: Record<string, number> = {
  top: 1, middle: 2, bottom: 3,
};

/** Converts ExcelJS column width (chars) → Univer px (approx 7px per char) */
function colWidthPx(w?: number): number | undefined {
  if (!w) return undefined;
  return Math.round(w * 7);
}

/** Converts ExcelJS row height (points) → Univer px */
function rowHeightPx(h?: number): number | undefined {
  if (!h) return undefined;
  return Math.round(h * 1.333);
}

/** Parse an Excel address range string like "A1:C3" into 0-based indices. */
function parseMerge(merge: string) {
  const [start, end] = merge.split(":");
  return {
    startRow: rowFromAddr(start) - 1,
    startColumn: colFromAddr(start) - 1,
    endRow: rowFromAddr(end) - 1,
    endColumn: colFromAddr(end) - 1,
  };
}

function rowFromAddr(addr: string): number {
  return parseInt(addr.replace(/[A-Z]+/gi, ""), 10);
}

function colFromAddr(addr: string): number {
  const letters = addr.replace(/[0-9]/g, "").toUpperCase();
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}

// ── style deduplication ───────────────────────────────────────────────────────

type StyleCache = { map: Map<string, string>; styles: Record<string, IStyleData>; counter: number };

function mkStyleCache(): StyleCache {
  return { map: new Map(), styles: {}, counter: 0 };
}

function internStyle(cache: StyleCache, style: IStyleData): string {
  const key = JSON.stringify(style);
  const existing = cache.map.get(key);
  if (existing) return existing;
  const id = `s${++cache.counter}`;
  cache.map.set(key, id);
  cache.styles[id] = style;
  return id;
}

// ── cell extraction ───────────────────────────────────────────────────────────

function extractStyle(cell: ExcelJS.Cell): IStyleData | null {
  const s: IStyleData = {};

  const f = cell.font;
  if (f) {
    if (f.name) s.ff = f.name;
    if (f.size) s.fs = f.size;
    if (f.bold) s.bl = 1;
    if (f.italic) s.it = 1;
    if (f.underline) s.ul = { s: 1 };
    if (f.strike) s.st = { s: 1 };
    const fc = (f as unknown as { color?: { argb?: string } }).color;
    const rgb = argbToRgb(fc?.argb);
    if (rgb) s.cl = { rgb };
  }

  const fill = cell.fill as unknown as {
    type?: string; pattern?: string;
    fgColor?: { argb?: string }; bgColor?: { argb?: string };
  } | undefined;
  if (fill?.type === "pattern" && fill.pattern === "solid" && fill.fgColor) {
    const rgb = argbToRgb(fill.fgColor.argb);
    if (rgb && rgb !== "#FFFFFF" && rgb !== "#ffffff") s.bg = { rgb };
  }

  const bd = cell.border as unknown as {
    top?: { style?: string; color?: { argb?: string } };
    right?: { style?: string; color?: { argb?: string } };
    bottom?: { style?: string; color?: { argb?: string } };
    left?: { style?: string; color?: { argb?: string } };
  } | undefined;
  if (bd) {
    const uniBorder: IBorderData = {};
    for (const [exSide, uniSide] of [["top","t"],["right","r"],["bottom","b"],["left","l"]] as const) {
      const side = bd[exSide as keyof typeof bd];
      if (side?.style) {
        const s_ = EXCEL_BORDER_TO_UNIVER[side.style] ?? 1;
        const cl = argbToRgb(side.color?.argb) ?? "#000000";
        (uniBorder as Record<string, IBorderStyleData>)[uniSide] = { s: s_, cl: { rgb: cl } };
      }
    }
    if (Object.keys(uniBorder).length) s.bd = uniBorder;
  }

  const al = cell.alignment as unknown as {
    horizontal?: string; vertical?: string; wrapText?: boolean;
  } | undefined;
  if (al) {
    if (al.horizontal) s.ht = H_ALIGN[al.horizontal] ?? 0;
    if (al.vertical) s.vt = V_ALIGN[al.vertical] ?? 0;
    if (al.wrapText) s.tb = 3; // WrapStrategy.WRAP
  }

  const nf = cell.numFmt;
  if (nf && nf !== "General" && nf !== "@") s.n = { pattern: nf };

  return Object.keys(s).length ? s : null;
}

function cellValue(cell: ExcelJS.Cell): { v?: string | number | boolean | null; t?: number; f?: string } {
  // ExcelJS ValueType: Null=0, Merge=1, Number=2, String=3, Date=4,
  // Hyperlink=5, Formula=6, SharedString=7, RichText=8, Boolean=9, Error=10
  const vt = cell.type;

  if (vt === 6) {
    // Formula cell — use the cached result value
    const result = (cell as unknown as { result?: unknown }).result;
    const f = typeof cell.formula === "string" ? `=${cell.formula}` : undefined;
    if (typeof result === "number") return { v: result, t: 2, f };
    if (typeof result === "boolean") return { v: result, t: 3, f };
    if (result instanceof Date) return { v: result.getTime(), t: 2, f };
    return { v: result != null ? String(result) : null, t: 1, f };
  }
  if (vt === 2) return { v: cell.value as number, t: 2 };
  if (vt === 9) return { v: cell.value as boolean, t: 3 };
  if (vt === 4) {
    const d = cell.value as Date;
    // Store as serial number (days since 1900-01-01, matching Excel serial)
    const serial = (d.getTime() - new Date(1899, 11, 30).getTime()) / 86400000;
    return { v: serial, t: 2 };
  }
  if (vt === 8) {
    // RichText — flatten to plain string
    const rt = cell.value as { richText: Array<{ text: string }> };
    return { v: rt.richText.map((r) => r.text).join(""), t: 1 };
  }
  if (vt === 5) {
    // Hyperlink — show display text
    const hl = cell.value as { text?: string; hyperlink?: string };
    return { v: hl.text ?? hl.hyperlink ?? "", t: 1 };
  }
  if (vt === 3 || vt === 7) return { v: cell.value as string, t: 1 };
  return {};
}

// ── main converter ────────────────────────────────────────────────────────────

export function excelWorkbookToUniverData(wb: ExcelJS.Workbook): IWorkbookData {
  const cache = mkStyleCache();
  const sheetOrder: string[] = [];
  const sheets: Record<string, Partial<IWorksheetData>> = {};

  for (const ws of wb.worksheets) {
    const sheetId = `sheet_${ws.id}`;
    sheetOrder.push(sheetId);

    const cellData: Record<number, Record<number, ICellData>> = {};
    const rowData: Record<number, { h?: number }> = {};
    const columnData: Record<number, { w?: number }> = {};

    // Column widths
    ws.columns?.forEach((col: Partial<ExcelJS.Column>, ci: number) => {
      const px = colWidthPx(col.width);
      if (px) columnData[ci] = { w: px };
    });

    // Rows + cells
    ws.eachRow({ includeEmpty: false }, (row: ExcelJS.Row, ri: number) => {
      const rowH = rowHeightPx((row as unknown as { height?: number }).height);
      if (rowH) rowData[ri - 1] = { h: rowH };

      row.eachCell({ includeEmpty: false }, (cell: ExcelJS.Cell, ci: number) => {
        // Skip merge-covered cells (type 1 = Merge)
        if (cell.type === 1) return;

        const { v, t, f } = cellValue(cell);
        if (v == null && !f) return;

        const styleObj = extractStyle(cell);
        const s = styleObj ? internStyle(cache, styleObj) : undefined;

        const entry: ICellData = {};
        if (v !== undefined) entry.v = v;
        if (t !== undefined) entry.t = t;
        if (f) entry.f = f;
        if (s) entry.s = s;

        if (!cellData[ri - 1]) cellData[ri - 1] = {};
        cellData[ri - 1][ci - 1] = entry;
      });
    });

    // Merged cells
    const mergeData = (ws.model.merges ?? []).map(parseMerge);

    sheets[sheetId] = {
      id: sheetId,
      name: ws.name,
      tabColor: "",
      hidden: ws.state === "hidden" ? 1 : 0,
      freeze: {},
      rowCount: ws.rowCount || 100,
      columnCount: ws.columnCount || 26,
      zoomRatio: 1,
      scrollTop: 0,
      scrollLeft: 0,
      defaultColumnWidth: 88,
      defaultRowHeight: 25,
      mergeData,
      cellData,
      rowData,
      columnData,
      rowHeader: { width: 46 },
      columnHeader: { height: 20 },
      showGridlines: 1,
    };
  }

  return {
    id: `wb_${Date.now()}`,
    name: "Workbook",
    appVersion: "0.1.0",
    locale: "en-US",
    styles: cache.styles,
    sheetOrder,
    sheets,
  };
}
