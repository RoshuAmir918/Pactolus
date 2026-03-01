export async function parseCsvActivity(csvText: string) {
  const rows = csvText.split("\n").filter((line) => line.trim().length > 0);
  return {
    rowCount: rows.length,
  };
}
