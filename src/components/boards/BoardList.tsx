import { useEffect, useState } from "react";
import { getBoards, createBoard, deleteBoard } from "@/lib/boards";
import type { Board } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function BoardList() {
  const [boards, setBoards] = useState<Board[]>([]);
const [loading, setLoading] = useState(true);
const [newBoardName, setNewBoardName] = useState("");
const [isCreating, setIsCreating] = useState(false);
const [isRefreshing, setIsRefreshing] = useState(false); // new

  async function loadBoards(showFullLoading = false) {
  if (showFullLoading) setLoading(true);
  else setIsRefreshing(true);

  try {
    const data = await getBoards();
    setBoards(data);
  } catch (err) {
    console.error("Failed to load boards:", err);
  } finally {
    setLoading(false);
    setIsRefreshing(false);
  }
}

  useEffect(() => {
  loadBoards(true); // only the first load shows full loading
}, []);

  async function handleCreateBoard(e: React.FormEvent) {
    e.preventDefault();
    if (!newBoardName.trim()) return;

    setIsCreating(true);
    try {
      await createBoard(newBoardName.trim());
      setNewBoardName("");
      await loadBoards();
    } catch (err) {
      console.error("Failed to create board:", err);
    } finally {
      setIsCreating(false);
    }
  }

  async function handleDeleteBoard(id: string) {
    if (!confirm("Delete this board and all its data?")) return;

    try {
      await deleteBoard(id);
      await loadBoards();
    } catch (err) {
      console.error("Failed to delete board:", err);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Loading boards...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-2xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Legerok</h1>
          <p className="text-muted-foreground mt-1">
            Local-first data tracker
          </p>
        </div>

        {/* Create Board Form */}
        <Card>
          <CardHeader>
            <CardTitle>Create a new board</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateBoard} className="flex gap-3 items-end">
              <div className="flex-1 space-y-2">
                <Label htmlFor="board-name">Board name</Label>
                <Input
                  id="board-name"
                  placeholder="e.g. Cold Outreach, Station Records"
                  value={newBoardName}
                  onChange={(e) => setNewBoardName(e.target.value)}
                  disabled={isCreating}
                />
              </div>
              <Button type="submit" disabled={isCreating || !newBoardName.trim()}>
                {isCreating ? "Creating..." : "Create"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Board List */}
        <div className="space-y-3">
          <h2 className="text-lg font-medium">Your boards</h2>

          {boards.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                No boards yet. Create your first one above.
              </CardContent>
            </Card>
          ) : (
            boards.map((board) => (
              <Card key={board.id}>
                <CardContent className="flex items-center justify-between py-4">
                  <div>
                    <p className="font-medium">{board.name}</p>
                    {board.description && (
                      <p className="text-sm text-muted-foreground">
                        {board.description}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteBoard(board.id)}
                  >
                    Delete
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}