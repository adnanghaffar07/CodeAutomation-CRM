// Reads the first sheet of an Excel (.xlsx) file in the browser into the same shape as a CSV: headers + rows of text.
// Loaded only when an .xlsx file is chosen (exceljs is large).
type CellValue = unknown;

/** Turns any Excel cell value into the text a CSV would hold. */
export function cellText(v: CellValue): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (typeof v === "string") return v.trim();
  if (typeof v === "object") {
    const o = v as { text?: string; richText?: { text: string }[]; result?: unknown; hyperlink?: string };
    if (o.richText) return o.richText.map((r) => r.text).join("").trim();
    if ("result" in o) return cellText(o.result);
    if (typeof o.text === "string") return o.text.trim();
    if (typeof o.hyperlink === "string") return o.hyperlink.trim();
  }
  return String(v).trim();
}

export async function readFirstSheet(file: File): Promise<{ headers: string[]; rows: string[][] }> {
  const { default: ExcelJS } = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());
  const sheet = wb.worksheets[0];
  if (!sheet) return { headers: [], rows: [] };
  const width = sheet.actualColumnCount;
  const all: string[][] = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const line: string[] = [];
    for (let c = 1; c <= width; c++) line.push(cellText(row.getCell(c).value));
    all.push(line);
  });
  const nonEmpty = all.filter((r) => r.some((c) => c !== ""));
  const [headers = [], ...rows] = nonEmpty;
  return { headers: headers.map((h) => h.trim()), rows };
}
