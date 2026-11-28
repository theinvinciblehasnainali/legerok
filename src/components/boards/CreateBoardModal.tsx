import { useState } from "react";
import { createBoard } from "@/lib/boards";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X } from "lucide-react";

interface CreateBoardModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (boardId: string) => Promise<void>;
}

export function CreateBoardModal({
  open,
  onClose,
  onCreated,
}: CreateBoardModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    try {
      const board = await createBoard(
        name.trim(),
        description.trim() || undefined
      );
      setName("");
      setDescription("");
      await onCreated(board.id);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-[1px] p-4"
      onClick={onClose}
    >
      <Card
        className="w-full max-w-md shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
          <div>
            <CardTitle>Create a new board</CardTitle>
            <CardDescription>
              A board holds your custom fields and records.
            </CardDescription>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </CardHeader>

        <form id="create-board-form" onSubmit={handleSubmit}>
          <CardContent className="space-y-4 pt-4">
            <div className="space-y-1.5">
              <Label htmlFor="new-board-name">Board name</Label>
              <Input
                id="new-board-name"
                placeholder="e.g. Cold Outreach, Station Records"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={creating}
                autoFocus
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="new-board-desc">Description (optional)</Label>
              <Input
                id="new-board-desc"
                placeholder="What will you track here?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={creating}
              />
            </div>
          </CardContent>

          <CardFooter className="flex justify-end gap-2 border-t pt-4 mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={creating}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={creating || !name.trim()}>
              {creating ? "Creating..." : "Create Board"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
