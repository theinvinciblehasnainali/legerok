import { useEffect, useState } from "react";
import type { Field, FieldValue, RecordData, RecordItem } from "@/types";
import { parseFieldOptions } from "@/lib/fields";
import { createRecord, parseRecordData, updateRecord } from "@/lib/records";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { X } from "lucide-react";

interface RecordFormModalProps {
  open: boolean;
  boardId: string;
  fields: Field[];
  editingRecord: RecordItem | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}

export function RecordFormModal({
  open,
  boardId,
  fields,
  editingRecord,
  onClose,
  onSaved,
}: RecordFormModalProps) {
  const [formData, setFormData] = useState<RecordData>({});
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editingRecord) {
      setFormData(parseRecordData(editingRecord.data));
    } else {
      const initial: RecordData = {};
      for (const f of fields) {
        if (f.type === "checkbox") initial[f.key] = false;
        else if (f.type === "multi_select") initial[f.key] = [];
        else initial[f.key] = "";
      }
      setFormData(initial);
    }
    setErrors({});
  }, [open, editingRecord, fields]);

  if (!open) return null;

  function setValue(key: string, value: FieldValue) {
    setFormData((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  }

  function validate(): boolean {
    const nextErrors: { [key: string]: string } = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^[+\d\s().-]{5,}$/;

    for (const f of fields) {
      const val = formData[f.key];
      const isEmpty =
        val === undefined ||
        val === null ||
        (typeof val === "string" && val.trim() === "") ||
        (Array.isArray(val) && val.length === 0);

      if (f.required === 1 && isEmpty) {
        nextErrors[f.key] = `${f.name} is required`;
        continue;
      }

      if (isEmpty || typeof val !== "string") continue;
      const trimmed = val.trim();

      if (f.type === "email" && !emailRegex.test(trimmed)) {
        nextErrors[f.key] = "Enter a valid email address";
      } else if (f.type === "url") {
        try {
          const parsed = new URL(trimmed);
          if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
            nextErrors[f.key] = "URL must start with http:// or https://";
          }
        } catch {
          nextErrors[f.key] = "Enter a valid URL (e.g. https://example.com)";
        }
      } else if (f.type === "phone" && !phoneRegex.test(trimmed)) {
        nextErrors[f.key] = "Enter a valid phone number";
      }
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSave(addAnother: boolean) {
    if (!validate()) return;
    setSaving(true);
    try {
      // Normalize number fields
      const normalized: RecordData = { ...formData };
      for (const f of fields) {
        if (f.type === "number") {
          const raw = normalized[f.key];
          if (raw === "" || raw === null || raw === undefined) {
            normalized[f.key] = null;
          } else {
            const num = Number(raw);
            normalized[f.key] = Number.isNaN(num) ? null : num;
          }
        }
      }

      if (editingRecord) {
        await updateRecord(editingRecord.id, normalized);
      } else {
        await createRecord(boardId, normalized);
      }
      await onSaved();

      if (addAnother && !editingRecord) {
        const fresh: RecordData = {};
        for (const f of fields) {
          if (f.type === "checkbox") fresh[f.key] = false;
          else if (f.type === "multi_select") fresh[f.key] = [];
          else fresh[f.key] = "";
        }
        setFormData(fresh);
        setErrors({});
      } else {
        onClose();
      }
    } catch (err) {
      console.error("Failed to save record:", err);
    } finally {
      setSaving(false);
    }
  }

  function renderFieldInput(field: Field) {
    const val = formData[field.key];
    const opts = parseFieldOptions(field.options);

    switch (field.type) {
      case "long_text":
        return (
          <textarea
            id={`rec-${field.key}`}
            rows={3}
            value={typeof val === "string" ? val : ""}
            onChange={(e) => setValue(field.key, e.target.value)}
            className="w-full rounded-xl border border-input bg-input/30 px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />
        );
      case "number":
        return (
          <Input
            id={`rec-${field.key}`}
            type="number"
            step="any"
            value={val === null || val === undefined ? "" : String(val)}
            onChange={(e) => setValue(field.key, e.target.value)}
          />
        );
      case "date":
        return (
          <Input
            id={`rec-${field.key}`}
            type="date"
            value={typeof val === "string" ? val : ""}
            onChange={(e) => setValue(field.key, e.target.value)}
          />
        );
      case "datetime":
        return (
          <Input
            id={`rec-${field.key}`}
            type="datetime-local"
            value={typeof val === "string" ? val : ""}
            onChange={(e) => setValue(field.key, e.target.value)}
          />
        );
      case "checkbox":
        return (
          <label className="flex items-center gap-2 text-sm cursor-pointer select-none pt-1">
            <input
              id={`rec-${field.key}`}
              type="checkbox"
              checked={Boolean(val)}
              onChange={(e) => setValue(field.key, e.target.checked)}
              className="size-4 rounded border-input"
            />
            <span>Yes</span>
          </label>
        );
      case "single_select":
        return (
          <Select
            id={`rec-${field.key}`}
            value={typeof val === "string" ? val : ""}
            onValueChange={(next) => setValue(field.key, next)}
            placeholder="Select an option..."
            options={[
              { value: "", label: "None" },
              ...(opts.choices ?? []).map((choice) => ({
                value: choice,
                label: choice,
              })),
            ]}
          />
        );
      case "multi_select": {
        const selected = Array.isArray(val) ? val : [];
        const choices = opts.choices ?? [];
        return (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {choices.length === 0 ? (
              <span className="text-xs text-muted-foreground">
                No choices configured for this field.
              </span>
            ) : (
              choices.map((choice) => {
                const active = selected.includes(choice);
                return (
                  <button
                    key={choice}
                    type="button"
                    onClick={() => {
                      const next = active
                        ? selected.filter((c) => c !== choice)
                        : [...selected, choice];
                      setValue(field.key, next);
                    }}
                    className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                      active
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted/40 text-foreground border-border hover:bg-muted"
                    }`}
                  >
                    {choice}
                  </button>
                );
              })
            )}
          </div>
        );
      }
      case "email":
        return (
          <Input
            id={`rec-${field.key}`}
            type="email"
            value={typeof val === "string" ? val : ""}
            onChange={(e) => setValue(field.key, e.target.value)}
          />
        );
      case "url":
        return (
          <Input
            id={`rec-${field.key}`}
            type="url"
            placeholder="https://"
            value={typeof val === "string" ? val : ""}
            onChange={(e) => setValue(field.key, e.target.value)}
          />
        );
      case "phone":
        return (
          <Input
            id={`rec-${field.key}`}
            type="tel"
            value={typeof val === "string" ? val : ""}
            onChange={(e) => setValue(field.key, e.target.value)}
          />
        );
      default:
        return (
          <Input
            id={`rec-${field.key}`}
            type="text"
            value={typeof val === "string" ? val : ""}
            onChange={(e) => setValue(field.key, e.target.value)}
          />
        );
    }
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-[1px] p-4"
      onClick={onClose}
    >
      <Card
        className="w-full max-w-xl max-h-[85vh] flex flex-col shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
          <CardTitle>{editingRecord ? "Edit Record" : "Add Record"}</CardTitle>
          <Button variant="ghost" size="icon-sm" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </CardHeader>

        <CardContent className="flex-1 overflow-y-auto space-y-4 pt-4">
          {fields.map((field) => (
            <div key={field.id} className="space-y-1.5">
              <Label htmlFor={`rec-${field.key}`}>
                {field.name}
                {field.required === 1 && (
                  <span className="text-destructive">*</span>
                )}
              </Label>
              {renderFieldInput(field)}
              {errors[field.key] && (
                <p className="text-xs text-destructive">{errors[field.key]}</p>
              )}
            </div>
          ))}
        </CardContent>

        <CardFooter className="flex justify-end gap-2 border-t pt-4">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          {!editingRecord && (
            <Button
              variant="secondary"
              disabled={saving}
              onClick={() => void handleSave(true)}
            >
              Save &amp; Add Another
            </Button>
          )}
          <Button disabled={saving} onClick={() => void handleSave(false)}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
