import { useState } from "react";
import type { Field, FieldType } from "@/types";
import {
  createField,
  deleteField,
  parseFieldOptions,
  reorderFields,
  updateField,
} from "@/lib/fields";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2, X } from "lucide-react";

const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: "text", label: "Text (single line)" },
  { value: "long_text", label: "Long text / Notes" },
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

interface FieldManagerModalProps {
  open: boolean;
  boardId: string;
  fields: Field[];
  onClose: () => void;
  onChanged: () => Promise<void>;
}

export function FieldManagerModal({
  open,
  boardId,
  fields,
  onClose,
  onChanged,
}: FieldManagerModalProps) {
  const [editingField, setEditingField] = useState<Field | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState<FieldType>("text");
  const [choicesText, setChoicesText] = useState("");
  const [required, setRequired] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Field | null>(null);

  if (!open) return null;

  function resetForm() {
    setEditingField(null);
    setName("");
    setType("text");
    setChoicesText("");
    setRequired(false);
  }

  function startEdit(field: Field) {
    setEditingField(field);
    setName(field.name);
    setType(field.type);
    const opts = parseFieldOptions(field.options);
    setChoicesText((opts.choices ?? []).join("\n"));
    setRequired(field.required === 1);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    try {
      const isSelect = type === "single_select" || type === "multi_select";
      const choices = isSelect
        ? choicesText
            .split(/[\n,]+/)
            .map((c) => c.trim())
            .filter(Boolean)
        : [];
      const options = isSelect ? { choices } : null;

      if (editingField) {
        await updateField(editingField.id, {
          name: name.trim(),
          type,
          options,
          required,
        });
      } else {
        await createField(boardId, {
          name: name.trim(),
          type,
          options,
          required,
        });
      }
      resetForm();
      await onChanged();
    } catch (err) {
      console.error("Failed to save field:", err);
    } finally {
      setSaving(false);
    }
  }

  async function handleMove(index: number, direction: -1 | 1) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= fields.length) return;
    const ordered = [...fields];
    const [moved] = ordered.splice(index, 1);
    ordered.splice(targetIndex, 0, moved);
    await reorderFields(
      boardId,
      ordered.map((f) => f.id)
    );
    await onChanged();
  }

  async function handleDeleteConfirmed() {
    if (!confirmDelete) return;
    await deleteField(confirmDelete.id);
    if (editingField?.id === confirmDelete.id) resetForm();
    setConfirmDelete(null);
    await onChanged();
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-[1px] p-4"
      onClick={onClose}
    >
      <Card
        className="w-full max-w-3xl max-h-[85vh] flex flex-col shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
          <CardTitle>Manage Fields</CardTitle>
          <Button variant="ghost" size="icon-sm" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </CardHeader>

        <CardContent className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
          {/* Existing Fields List */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">
              Columns ({fields.length})
            </h3>
            {fields.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center border rounded-xl">
                No fields yet. Add your first field on the right.
              </p>
            ) : (
              <div className="space-y-2">
                {fields.map((field, idx) => (
                  <div
                    key={field.id}
                    className="flex items-center justify-between gap-2 p-2.5 rounded-xl border bg-card"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {field.name}
                        {field.required === 1 && (
                          <span className="text-destructive ml-1">*</span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {FIELD_TYPES.find((t) => t.value === field.type)?.label ??
                          field.type}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        disabled={idx === 0}
                        onClick={() => void handleMove(idx, -1)}
                        title="Move up"
                      >
                        <ArrowUp className="size-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        disabled={idx === fields.length - 1}
                        onClick={() => void handleMove(idx, 1)}
                        title="Move down"
                      >
                        <ArrowDown className="size-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => startEdit(field)}
                        title="Edit field"
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => setConfirmDelete(field)}
                        title="Delete field"
                      >
                        <Trash2 className="size-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add / Edit Field Form */}
          <form onSubmit={handleSubmit} className="space-y-4 border rounded-xl p-4 bg-muted/20 h-fit">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">
                {editingField ? `Edit "${editingField.name}"` : "Add a new field"}
              </h3>
              {editingField && (
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={resetForm}
                >
                  Cancel edit
                </Button>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="field-name">Field name</Label>
              <Input
                id="field-name"
                placeholder="e.g. Company, Status, Follow-up Date"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={saving}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="field-type">Field type</Label>
              <select
                id="field-type"
                value={type}
                onChange={(e) => setType(e.target.value as FieldType)}
                disabled={saving}
                className="h-9 w-full rounded-4xl border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                {FIELD_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            {(type === "single_select" || type === "multi_select") && (
              <div className="space-y-1.5">
                <Label htmlFor="field-choices">
                  Allowed choices (one per line or comma-separated)
                </Label>
                <textarea
                  id="field-choices"
                  rows={4}
                  placeholder={"New\nContacted\nReplied\nClosed"}
                  value={choicesText}
                  onChange={(e) => setChoicesText(e.target.value)}
                  disabled={saving}
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                />
              </div>
            )}

            <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
              <input
                type="checkbox"
                checked={required}
                onChange={(e) => setRequired(e.target.checked)}
                className="rounded border-input"
              />
              Required field
            </label>

            <Button type="submit" className="w-full" disabled={saving || !name.trim()}>
              <Plus className="size-4" />
              {saving
                ? "Saving..."
                : editingField
                  ? "Save Changes"
                  : "Add Field"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete field?"
        description={`Delete "${confirmDelete?.name}"? Existing record values for this column will no longer be shown.`}
        confirmLabel="Delete"
        destructive
        onConfirm={() => void handleDeleteConfirmed()}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
