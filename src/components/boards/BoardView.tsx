import { useEffect, useMemo, useState } from "react";
import type { Board, Field, RecordItem } from "@/types";
import { getBoard, updateBoard } from "@/lib/boards";
import { getFields } from "@/lib/fields";
import { deleteRecord, getRecords, parseRecordData } from "@/lib/records";
import { exportBoard } from "@/lib/spreadsheet";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FieldManagerModal } from "@/components/fields/FieldManagerModal";
import { RecordFormModal } from "@/components/records/RecordFormModal";
import { RecordsTable, type SortState } from "@/components/records/RecordsTable";
import {
  Check,
  Columns3,
  Download,
  Pencil,
  Plus,
  Search,
  X,
} from "lucide-react";

interface BoardViewProps {
  boardId: string;
  onBoardsChanged: () => Promise<void>;
}

export function BoardView({ boardId, onBoardsChanged }: BoardViewProps) {
  const [board, setBoard] = useState<Board | null>(null);
  const [fields, setFields] = useState<Field[]>([]);
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");

  const [search, setSearch] = useState("");
  const [filterFieldKey, setFilterFieldKey] = useState("");
  const [filterValue, setFilterValue] = useState("");
  const [sort, setSort] = useState<SortState | null>(null);

  const [fieldModalOpen, setFieldModalOpen] = useState(false);
  const [recordModalOpen, setRecordModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<RecordItem | null>(null);
  const [confirmDeleteRecord, setConfirmDeleteRecord] = useState<RecordItem | null>(
    null
  );

  async function loadAll(showLoading = false) {
    if (showLoading) setLoading(true);
    try {
      const [b, f, r] = await Promise.all([
        getBoard(boardId),
        getFields(boardId),
        getRecords(boardId),
      ]);
      setBoard(b);
      setFields(f);
      setRecords(r);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setSearch("");
    setFilterFieldKey("");
    setFilterValue("");
    setSort(null);
    setIsRenaming(false);
    void loadAll(true);
  }, [boardId]);

  const filteredAndSortedRecords = useMemo(() => {
    const q = search.trim().toLowerCase();
    const fv = filterValue.trim().toLowerCase();

    const filtered = records.filter((rec) => {
      const data = parseRecordData(rec.data);

      if (q) {
        const matchesSearch = fields.some((f) => {
          const val = data[f.key];
          if (val === undefined || val === null) return false;
          const str = Array.isArray(val) ? val.join(" ") : String(val);
          return str.toLowerCase().includes(q);
        });
        if (!matchesSearch) return false;
      }

      if (filterFieldKey && fv) {
        const val = data[filterFieldKey];
        if (val === undefined || val === null) return false;
        const str = Array.isArray(val) ? val.join(" ") : String(val);
        if (!str.toLowerCase().includes(fv)) return false;
      }

      return true;
    });

    if (!sort) return filtered;

    return [...filtered].sort((a, b) => {
      const da = parseRecordData(a.data)[sort.fieldKey];
      const db = parseRecordData(b.data)[sort.fieldKey];
      const sa = Array.isArray(da) ? da.join(", ") : String(da ?? "");
      const sb = Array.isArray(db) ? db.join(", ") : String(db ?? "");
      const cmp = sa.localeCompare(sb, undefined, { numeric: true });
      return sort.direction === "asc" ? cmp : -cmp;
    });
  }, [records, fields, search, filterFieldKey, filterValue, sort]);

  function handleToggleSort(fieldKey: string) {
    setSort((prev) => {
      if (!prev || prev.fieldKey !== fieldKey) {
        return { fieldKey, direction: "asc" };
      }
      if (prev.direction === "asc") {
        return { fieldKey, direction: "desc" };
      }
      return null;
    });
  }

  async function handleSaveRename() {
    if (!board || !renameValue.trim()) {
      setIsRenaming(false);
      return;
    }
    await updateBoard(board.id, { name: renameValue.trim() });
    setIsRenaming(false);
    await loadAll();
    await onBoardsChanged();
  }

  async function handleDeleteRecordConfirmed() {
    if (!confirmDeleteRecord) return;
    await deleteRecord(confirmDeleteRecord.id);
    setConfirmDeleteRecord(null);
    await loadAll();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Loading board...
      </div>
    );
  }

  if (!board) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Board not found.
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {isRenaming ? (
            <div className="flex items-center gap-1.5">
              <Input
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleSaveRename();
                  if (e.key === "Escape") setIsRenaming(false);
                }}
                className="h-9 w-64"
                autoFocus
              />
              <Button size="icon-sm" onClick={() => void handleSaveRename()}>
                <Check className="size-4" />
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={() => setIsRenaming(false)}
              >
                <X className="size-4" />
              </Button>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-semibold tracking-tight">
                {board.name}
              </h1>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => {
                  setRenameValue(board.name);
                  setIsRenaming(true);
                }}
                title="Rename board"
              >
                <Pencil className="size-3.5 text-muted-foreground" />
              </Button>
              <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                {records.length} {records.length === 1 ? "record" : "records"}
              </span>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setFieldModalOpen(true)}
          >
            <Columns3 className="size-4" />
            Manage Fields
          </Button>

          {fields.length > 0 && records.length > 0 && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  exportBoard(
                    board.name,
                    fields,
                    filteredAndSortedRecords,
                    "xlsx"
                  )
                }
              >
                <Download className="size-4" />
                Export Excel
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  exportBoard(
                    board.name,
                    fields,
                    filteredAndSortedRecords,
                    "csv"
                  )
                }
              >
                CSV
              </Button>
            </>
          )}

          {fields.length > 0 && (
            <Button
              size="sm"
              onClick={() => {
                setEditingRecord(null);
                setRecordModalOpen(true);
              }}
            >
              <Plus className="size-4" />
              Add Record
            </Button>
          )}
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      {fields.length > 0 && records.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Search className="size-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              placeholder="Search records..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={filterFieldKey}
              onChange={(e) => {
                setFilterFieldKey(e.target.value);
                setFilterValue("");
              }}
              className="h-9 rounded-4xl border border-input bg-background px-3 text-sm outline-none"
            >
              <option value="">Filter by field...</option>
              {fields.map((f) => (
                <option key={f.id} value={f.key}>
                  {f.name}
                </option>
              ))}
            </select>

            {filterFieldKey && (
              <Input
                placeholder="Filter value..."
                value={filterValue}
                onChange={(e) => setFilterValue(e.target.value)}
                className="w-44"
              />
            )}
          </div>
        </div>
      )}

      {/* Main Content / Empty States */}
      {fields.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center space-y-3">
            <p className="font-medium">This board has no fields yet</p>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Fields are the columns of your board (such as Name, Email, Status, or Follow-up Date). Add your first field to start entering records.
            </p>
            <Button onClick={() => setFieldModalOpen(true)}>
              <Plus className="size-4" />
              Add Fields
            </Button>
          </CardContent>
        </Card>
      ) : records.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center space-y-3">
            <p className="font-medium">No records yet</p>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Your {fields.length} {fields.length === 1 ? "field is" : "fields are"} ready. Add your first record now.
            </p>
            <Button
              onClick={() => {
                setEditingRecord(null);
                setRecordModalOpen(true);
              }}
            >
              <Plus className="size-4" />
              Add First Record
            </Button>
          </CardContent>
        </Card>
      ) : filteredAndSortedRecords.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No records match your current search or filter.
          </CardContent>
        </Card>
      ) : (
        <RecordsTable
          fields={fields}
          records={filteredAndSortedRecords}
          sort={sort}
          onToggleSort={handleToggleSort}
          onEdit={(rec) => {
            setEditingRecord(rec);
            setRecordModalOpen(true);
          }}
          onDelete={(rec) => setConfirmDeleteRecord(rec)}
        />
      )}

      <FieldManagerModal
        open={fieldModalOpen}
        boardId={board.id}
        fields={fields}
        onClose={() => setFieldModalOpen(false)}
        onChanged={async () => {
          await loadAll();
        }}
      />

      <RecordFormModal
        open={recordModalOpen}
        boardId={board.id}
        fields={fields}
        editingRecord={editingRecord}
        onClose={() => {
          setRecordModalOpen(false);
          setEditingRecord(null);
        }}
        onSaved={async () => {
          await loadAll();
        }}
      />

      <ConfirmDialog
        open={!!confirmDeleteRecord}
        title="Delete record?"
        description="This record will be permanently removed from this board."
        confirmLabel="Delete"
        destructive
        onConfirm={() => void handleDeleteRecordConfirmed()}
        onCancel={() => setConfirmDeleteRecord(null)}
      />
    </div>
  );
}
