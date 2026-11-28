import { useState } from "react";
import { deleteBoard } from "@/lib/boards";
import type { Board } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ArrowRight, FileSpreadsheet, Plus, Trash2 } from "lucide-react";

interface BoardListProps {
  boards: Board[];
  loading: boolean;
  onOpenBoard: (boardId: string) => void;
  onBoardsChanged: () => Promise<void>;
  onOpenCreate: () => void;
  onOpenImport: () => void;
}

export function BoardList({
  boards,
  loading,
  onOpenBoard,
  onBoardsChanged,
  onOpenCreate,
  onOpenImport,
}: BoardListProps) {
  const [confirmDelete, setConfirmDelete] = useState<Board | null>(null);

  async function handleDeleteConfirmed() {
    if (!confirmDelete) return;
    try {
      await deleteBoard(confirmDelete.id);
      setConfirmDelete(null);
      await onBoardsChanged();
    } catch (err) {
      console.error("Failed to delete board:", err);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Loading boards...</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">LegeRok</h1>
          <p className="text-muted-foreground mt-1">
            Local-first data tracker — create a board or import a spreadsheet.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onOpenImport}>
            <FileSpreadsheet className="size-4" />
            Import Spreadsheet
          </Button>
          <Button onClick={onOpenCreate}>
            <Plus className="size-4" />
            New Board
          </Button>
        </div>
      </div>

      {/* Board List */}
      <div className="space-y-3">
        <h2 className="text-lg font-medium">Your boards</h2>

        {boards.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center space-y-3">
              <p className="text-muted-foreground">
                No boards yet. Create your first one or import a spreadsheet.
              </p>
              <div className="flex justify-center gap-2">
                <Button variant="outline" onClick={onOpenImport}>
                  <FileSpreadsheet className="size-4" />
                  Import Spreadsheet
                </Button>
                <Button onClick={onOpenCreate}>
                  <Plus className="size-4" />
                  New Board
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          boards.map((board) => (
            <Card
              key={board.id}
              className="hover:ring-primary/40 transition-all cursor-pointer"
              onClick={() => onOpenBoard(board.id)}
            >
              <CardContent className="flex items-center justify-between py-4">
                <div className="min-w-0">
                  <p className="font-medium truncate">{board.name}</p>
                  {board.description && (
                    <p className="text-sm text-muted-foreground truncate">
                      {board.description}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmDelete(board);
                    }}
                    title="Delete board"
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                  <ArrowRight className="size-4 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete board?"
        description={`Delete "${confirmDelete?.name}" and all of its fields and records? This cannot be undone.`}
        confirmLabel="Delete"
        destructive
        onConfirm={() => void handleDeleteConfirmed()}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
