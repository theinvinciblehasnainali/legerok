import { useState } from "react";
import type { Field, FieldType, RecordData } from "@/types";
import { createBoard } from "@/lib/boards";
import { createField } from "@/lib/fields";
import { bulkCreateRecords } from "@/lib/records";
import {
  coerceCellValue,
  parseSpreadsheetFile,
  type DetectedColumn,
  type ParsedSpreadsheet,
} from "@/lib/spreadsheet";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileSpreadsheet, Upload, X } from "lucide-react";

const IMPORT_TYPES: { value: FieldType; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "long_text", label: "Long Text" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "datetime", label: "Date & Time" },
  { value: "single_select", label: "Single Select" },
  { value: "multi_select", label: "Multi Select" },
  { value: "checkbox", label: "Checkbox" },
  { value: "url", label: "URL" },
];

interface ImportBoardModalProps {
  open: boolean;
  onClose: () => void;
  onImported: (boardId: string) => Promise<void>;
}

export function ImportBoardModal({
  open,
  onClose,
  onImported,
}: ImportBoardModalProps) {
  const [parsed, setParsed] = useState<ParsedSpreadsheet | null>(null);
  const [boardName, setBoardName] = useState("");
  const [columns, setColumns] = useState<DetectedColumn[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  if (!open) return null;

  function reset() {
    setParsed(null);
    setBoardName("");
    setColumns([]);
    setError(null);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    try {
      const result = await parseSpreadsheetFile(file);
      setParsed(result);
      setBoardName(result.suggestedBoardName);
      setColumns(result.columns);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to read spreadsheet.");
    }
  }

  function updateColumn(index: number, patch: Partial<DetectedColumn>) {
    setColumns((prev) =>
      prev.map((col, idx) => (idx === index ? { ...col, ...patch } : col))
    );
  }

  async function handleImport() {
    if (!parsed || !boardName.trim()) return;
    const included = columns.filter((c) => c.include && c.fieldName.trim());
    if (included.length === 0) {
      setError("Select at least one column to import.");
      return;
    }

    setImporting(true);
    setError(null);
    try {
      const board = await createBoard(boardName.trim());

      const createdFields: { col: DetectedColumn; field: Field }[] = [];
      for (const col of included) {
        let options = col.options ?? null;
        if (
          (col.fieldType === "single_select" || col.fieldType === "multi_select") &&
          !options
        ) {
          const unique = Array.from(
            new Set(
              parsed.rawRows
                .map((r) => String(r[col.index] ?? "").trim())
                .filter(Boolean)
            )
          ).slice(0, 50);
          options = { choices: unique };
        }

        const field = await createField(board.id, {
          name: col.fieldName.trim(),
          type: col.fieldType,
          options,
        });
        createdFields.push({ col, field });
      }

      const recordsToInsert: RecordData[] = parsed.rawRows.map((row) => {
        const data: RecordData = {};
        for (const { col, field } of createdFields) {
          data[field.key] = coerceCellValue(row[col.index], field.type);
        }
        return data;
      });

      await bulkCreateRecords(board.id, recordsToInsert);
      reset();
      await onImported(board.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-[1px] p-4"
      onClick={() => {
        reset();
        onClose();
      }}
    >
      <Card
        className="w-full max-w-2xl max-h-[85vh] flex flex-col shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="size-5 text-primary" />
            Import Spreadsheet
          </CardTitle>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => {
              reset();
              onClose();
            }}
          >
            <X className="size-4" />
          </Button>
        </CardHeader>

        <CardContent className="flex-1 overflow-y-auto space-y-5 pt-4">
          {!parsed ? (
            <label className="flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-10 cursor-pointer hover:bg-muted/30 transition-colors text-center space-y-2">
              <Upload className="size-8 text-muted-foreground" />
              <p className="text-sm font-medium">
                Choose an Excel (.xlsx, .xls) or CSV (.csv) file
              </p>
              <p className="text-xs text-muted-foreground">
                First row will be used as column headers.
              </p>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => void handleFileChange(e)}
                className="hidden"
              />
            </label>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="import-board-name">New Board Name</Label>
                <Input
                  id="import-board-name"
                  value={boardName}
                  onChange={(e) => setBoardName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Map Columns ({columns.filter((c) => c.include).length} selected)</span>
                  <span>{parsed.rawRows.length} rows detected</span>
                </div>
                <div className="border rounded-xl divide-y max-h-72 overflow-y-auto">
                  {columns.map((col, idx) => (
                    <div
                      key={col.index}
                      className="flex items-center gap-3 p-2.5 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={col.include}
                        onChange={(e) =>
                          updateColumn(idx, { include: e.target.checked })
                        }
                        className="size-4 rounded border-input"
                      />
                      <Input
                        value={col.fieldName}
                        disabled={!col.include}
                        onChange={(e) =>
                          updateColumn(idx, { fieldName: e.target.value })
                        }
                        className="h-8 flex-1"
                      />
                      <select
                        value={col.fieldType}
                        disabled={!col.include}
                        onChange={(e) =>
                          updateColumn(idx, {
                            fieldType: e.target.value as FieldType,
                          })
                        }
                        className="h-8 rounded-4xl border border-input bg-background px-2.5 text-xs outline-none"
                      >
                        {IMPORT_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>

        <CardFooter className="flex justify-end gap-2 border-t pt-4">
          <Button
            variant="outline"
            onClick={() => {
              reset();
              onClose();
            }}
            disabled={importing}
          >
            Cancel
          </Button>
          {parsed && (
            <Button
              onClick={() => void handleImport()}
              disabled={importing || !boardName.trim()}
            >
              {importing
                ? "Importing..."
                : `Create Board & Import ${parsed.rawRows.length} Rows`}
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
