import type { Field, FieldValue, RecordData, RecordItem } from "@/types";
import { parseRecordData } from "@/lib/records";
import { Button } from "@/components/ui/button";
import { ArrowDown, ArrowUp, ArrowUpDown, Pencil, Trash2 } from "lucide-react";

export interface SortState {
  fieldKey: string;
  direction: "asc" | "desc";
}

interface RecordsTableProps {
  fields: Field[];
  records: RecordItem[];
  sort: SortState | null;
  onToggleSort: (fieldKey: string) => void;
  onEdit: (record: RecordItem) => void;
  onDelete: (record: RecordItem) => void;
}

function isDateOverdue(value: FieldValue, type: Field["type"]): boolean {
  if (type !== "date" && type !== "datetime") return false;
  if (typeof value !== "string" || !value.trim()) return false;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (type === "date") {
    const d = new Date(value + "T00:00:00");
    return d < today;
  }
  return parsed < new Date();
}

function renderCell(field: Field, data: RecordData) {
  const val = data[field.key];
  if (val === undefined || val === null || val === "") {
    return <span className="text-muted-foreground/50">—</span>;
  }

  if (field.type === "checkbox") {
    return (
      <span
        className={`inline-flex px-2 py-0.5 rounded-full text-xs ${
          val ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
        }`}
      >
        {val ? "Yes" : "No"}
      </span>
    );
  }

  if (field.type === "single_select") {
    return (
      <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs bg-secondary text-secondary-foreground font-medium">
        {String(val)}
      </span>
    );
  }

  if (field.type === "multi_select") {
    const arr = Array.isArray(val) ? val : [String(val)];
    if (arr.length === 0) return <span className="text-muted-foreground/50">—</span>;
    return (
      <div className="flex flex-wrap gap-1">
        {arr.map((tag) => (
          <span
            key={tag}
            className="inline-flex px-2 py-0.5 rounded-full text-xs bg-secondary text-secondary-foreground"
          >
            {tag}
          </span>
        ))}
      </div>
    );
  }

  if (field.type === "date" || field.type === "datetime") {
    const overdue = isDateOverdue(val, field.type);
    return (
      <span
        className={
          overdue
            ? "inline-flex items-center gap-1.5 text-destructive font-medium"
            : ""
        }
      >
        {String(val)}
        {overdue && (
          <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-destructive/15 text-destructive">
            Overdue
          </span>
        )}
      </span>
    );
  }

  if (field.type === "email") {
    return (
      <a
        href={`mailto:${String(val)}`}
        className="text-primary underline underline-offset-2 truncate max-w-[220px] inline-block"
      >
        {String(val)}
      </a>
    );
  }

  if (field.type === "url") {
    return (
      <a
        href={String(val)}
        target="_blank"
        rel="noreferrer"
        className="text-primary underline underline-offset-2 truncate max-w-[220px] inline-block"
      >
        {String(val)}
      </a>
    );
  }

  return (
    <span className="line-clamp-2 max-w-[260px] break-words">
      {String(val)}
    </span>
  );
}

export function RecordsTable({
  fields,
  records,
  sort,
  onToggleSort,
  onEdit,
  onDelete,
}: RecordsTableProps) {
  return (
    <div className="border rounded-2xl overflow-hidden bg-card">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted/40 border-b text-xs uppercase text-muted-foreground">
            <tr>
              {fields.map((field) => {
                const isSorted = sort?.fieldKey === field.key;
                return (
                  <th key={field.id} className="px-4 py-3 font-medium whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => onToggleSort(field.key)}
                      className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors"
                    >
                      <span>{field.name}</span>
                      {isSorted ? (
                        sort.direction === "asc" ? (
                          <ArrowUp className="size-3.5 text-primary" />
                        ) : (
                          <ArrowDown className="size-3.5 text-primary" />
                        )
                      ) : (
                        <ArrowUpDown className="size-3.5 opacity-40" />
                      )}
                    </button>
                  </th>
                );
              })}
              <th className="px-4 py-3 text-right font-medium w-24">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {records.map((record) => {
              const data = parseRecordData(record.data);
              return (
                <tr key={record.id} className="hover:bg-muted/30 transition-colors">
                  {fields.map((field) => (
                    <td key={field.id} className="px-4 py-3 align-top">
                      {renderCell(field, data)}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => onEdit(record)}
                        title="Edit record"
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => onDelete(record)}
                        title="Delete record"
                      >
                        <Trash2 className="size-3.5 text-destructive" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
