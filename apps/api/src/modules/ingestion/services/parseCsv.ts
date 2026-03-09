export type CsvRow = Record<string, string>;

export type CsvRowIterator = {
  detectedColumns: string[];
  rows: IterableIterator<CsvRow>;
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

function* iterateTrimmedCsvLines(csvText: string): IterableIterator<string> {
  let lineStart = 0;
  for (let idx = 0; idx <= csvText.length; idx += 1) {
    const isEnd = idx === csvText.length;
    if (!isEnd && csvText[idx] !== "\n") {
      continue;
    }

    let line = csvText.slice(lineStart, idx);
    if (line.endsWith("\r")) {
      line = line.slice(0, -1);
    }

    const trimmed = line.trim();
    if (trimmed.length > 0) {
      yield trimmed;
    }

    lineStart = idx + 1;
  }
}

function createRow(
  detectedColumns: string[],
  line: string,
): CsvRow {
  const values = splitCsvLine(line);
  const row: CsvRow = {};
  detectedColumns.forEach((column, idx) => {
    row[column] = values[idx]?.trim() ?? "";
  });
  return row;
}

export function createCsvRowIterator(csvText: string): CsvRowIterator {
  const lines = iterateTrimmedCsvLines(csvText);
  const header = lines.next();

  if (header.done) {
    return {
      detectedColumns: [],
      rows: (function* emptyRows(): IterableIterator<CsvRow> {})(),
    };
  }

  const detectedColumns = splitCsvLine(header.value).map((column) => column.trim());

  function* rows(): IterableIterator<CsvRow> {
    for (const line of lines) {
      yield createRow(detectedColumns, line);
    }
  }

  return {
    detectedColumns,
    rows: rows(),
  };
}
