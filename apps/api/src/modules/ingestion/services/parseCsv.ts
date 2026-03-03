export type ParsedCsv = {
  detectedColumns: string[];
  rowCount: number;
  sampleRows: Record<string, string>[];
  rows: Record<string, string>[];
};

function splitCsvLine(line: string): string[] {
  // V1 parser: supports commas and quoted fields.
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let idx = 0; idx < line.length; idx += 1) {
    const char = line[idx];
    const nextChar = line[idx + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      current += '"';
      idx += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

export function parseCsv(csvText: string): ParsedCsv {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return { detectedColumns: [], rowCount: 0, sampleRows: [], rows: [] };
  }

  const detectedColumns = splitCsvLine(lines[0]).map((column) => column.trim());
  const dataLines = lines.slice(1);

  const rows = dataLines.map((line) => {
    const values = splitCsvLine(line);
    const row: Record<string, string> = {};
    detectedColumns.forEach((column, idx) => {
      row[column] = values[idx]?.trim() ?? "";
    });
    return row;
  });

  return {
    detectedColumns,
    rowCount: rows.length,
    sampleRows: rows.slice(0, 5),
    rows,
  };
}
