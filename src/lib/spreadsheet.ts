import * as XLSX from "xlsx";
import type { Field, FieldOptions, FieldType, RecordData, RecordItem } from "@/types";
import { parseRecordData } from "./records";

export function exportBoard(
  boardName: string,
  fields: Field[],
  records: RecordItem[],
  format: "xlsx" | "csv"
): void {
  const headers = fields.map((f) => f.name);
  const rows = records.map((rec) => {
    const data = parseRecordData(rec.data);
    return fields.map((field) => {
      const val = data[field.key];
      if (val === undefined || val === null) return "";
      if (Array.isArray(val)) return val.join(", ");
      if (field.type === "checkbox") return val ? "Yes" : "No";
      if (field.type === "number" && typeof val === "number") return val;
      return val;
    });
  });

  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const workbook = XLSX.utils.book_new();
  const safeSheetName = boardName.slice(0, 31).replace(/[\\/?*[\]]/g, "_") || "Board";
  XLSX.utils.book_append_sheet(workbook, worksheet, safeSheetName);

  const safeFileName = boardName.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "board";
  XLSX.writeFile(workbook, `${safeFileName}.${format}`, {
    bookType: format,
  });
}

export interface DetectedColumn {
  index: number;
  header: string;
  include: boolean;
  fieldName: string;
  fieldType: FieldType;
  options?: FieldOptions;
}

export interface ParsedSpreadsheet {
  suggestedBoardName: string;
  columns: DetectedColumn[];
  rawRows: unknown[][];
}

function detectColumnType(values: unknown[]): {
  type: FieldType;
  options?: FieldOptions;
} {
  const nonEmpty = values
    .map((v) => (v === null || v === undefined ? "" : String(v).trim()))
    .filter((v) => v.length > 0);

  if (nonEmpty.length === 0) return { type: "text" };

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (nonEmpty.every((v) => emailRegex.test(v))) return { type: "email" };

  const urlRegex = /^https?:\/\/.+/i;
  if (nonEmpty.every((v) => urlRegex.test(v))) return { type: "url" };

  const boolWords = new Set(["true", "false", "yes", "no", "0", "1"]);
  if (nonEmpty.every((v) => boolWords.has(v.toLowerCase()))) {
    return { type: "checkbox" };
  }

  if (nonEmpty.every((v) => !Number.isNaN(Number(v)))) {
    return { type: "number" };
  }

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (nonEmpty.every((v) => dateRegex.test(v))) {
    return { type: "date" };
  }

  const unique = Array.from(new Set(nonEmpty));
  if (nonEmpty.length >= 4 && unique.length <= 8 && unique.length <= nonEmpty.length / 2) {
    return { type: "single_select", options: { choices: unique } };
  }

  if (nonEmpty.some((v) => v.length > 100)) {
    return { type: "long_text" };
  }

  return { type: "text" };
}

export async function parseSpreadsheetFile(file: File): Promise<ParsedSpreadsheet> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const firstSheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[firstSheetName];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
  });

  const nonEmptyRows = matrix.filter(
    (row) => Array.isArray(row) && row.some((cell) => String(cell ?? "").trim() !== "")
  );

  if (nonEmptyRows.length === 0) {
    throw new Error("The selected spreadsheet is empty.");
  }

  const headerRow = nonEmptyRows[0];
  const dataRows = nonEmptyRows.slice(1);

  const columns: DetectedColumn[] = headerRow.map((cell, index) => {
    const header = String(cell ?? "").trim() || `Column ${index + 1}`;
    const sampleValues = dataRows.slice(0, 50).map((r) => r[index]);
    const detected = detectColumnType(sampleValues);

    return {
      index,
      header,
      include: true,
      fieldName: header,
      fieldType: detected.type,
      options: detected.options,
    };
  });

  const baseName = file.name.replace(/\.[^.]+$/, "").trim() || "Imported Board";

  return {
    suggestedBoardName: baseName,
    columns,
    rawRows: dataRows,
  };
}

export function coerceCellValue(raw: unknown, type: FieldType): RecordData[string] {
  if (raw === null || raw === undefined) return "";
  const str = String(raw).trim();
  if (str === "") return type === "multi_select" ? [] : type === "checkbox" ? false : "";

  switch (type) {
    case "number": {
      const n = Number(str);
      return Number.isNaN(n) ? null : n;
    }
    case "checkbox":
      return ["true", "yes", "1"].includes(str.toLowerCase());
    case "multi_select":
      return str
        .split(/[;,]+/)
        .map((s) => s.trim())
        .filter(Boolean);
    default:
      return str;
  }
}
