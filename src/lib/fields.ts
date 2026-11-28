import { getDb } from "./db";
import type { Field, FieldOptions, FieldType } from "@/types";
import { v4 as uuidv4 } from "uuid";

function slugifyKey(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return base || "field";
}

export function parseFieldOptions(optionsJson: string | null): FieldOptions {
  if (!optionsJson) return {};
  try {
    return JSON.parse(optionsJson) as FieldOptions;
  } catch {
    return {};
  }
}

export async function getFields(boardId: string): Promise<Field[]> {
  const db = await getDb();
  return await db.select<Field[]>(
    "SELECT * FROM fields WHERE board_id = $1 ORDER BY position ASC, created_at ASC",
    [boardId]
  );
}

export async function createField(
  boardId: string,
  input: {
    name: string;
    type: FieldType;
    options?: FieldOptions | null;
    required?: boolean;
  }
): Promise<Field> {
  const db = await getDb();
  const existing = await getFields(boardId);

  // Ensure unique key within the board
  const usedKeys = new Set(existing.map((f) => f.key));
  const baseKey = slugifyKey(input.name);
  let key = baseKey;
  let suffix = 2;
  while (usedKeys.has(key)) {
    key = `${baseKey}_${suffix++}`;
  }

  const maxPos = existing.reduce((max, f) => Math.max(max, f.position), -1);
  const now = new Date().toISOString();
  const id = uuidv4();
  const optionsJson = input.options ? JSON.stringify(input.options) : null;

  await db.execute(
    `INSERT INTO fields (id, board_id, name, key, type, options, required, position, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      id,
      boardId,
      input.name.trim(),
      key,
      input.type,
      optionsJson,
      input.required ? 1 : 0,
      maxPos + 1,
      now,
      now,
    ]
  );

  const rows = await db.select<Field[]>("SELECT * FROM fields WHERE id = $1", [id]);
  return rows[0];
}

export async function updateField(
  id: string,
  input: {
    name?: string;
    type?: FieldType;
    options?: FieldOptions | null;
    required?: boolean;
  }
): Promise<Field> {
  const db = await getDb();
  const rows = await db.select<Field[]>("SELECT * FROM fields WHERE id = $1", [id]);
  const existing = rows[0];
  if (!existing) throw new Error(`Field ${id} not found`);

  const now = new Date().toISOString();
  const name = input.name !== undefined ? input.name.trim() : existing.name;
  const type = input.type !== undefined ? input.type : existing.type;
  const options =
    input.options !== undefined
      ? input.options
        ? JSON.stringify(input.options)
        : null
      : existing.options;
  const required =
    input.required !== undefined ? (input.required ? 1 : 0) : existing.required;

  await db.execute(
    `UPDATE fields SET name = $1, type = $2, options = $3, required = $4, updated_at = $5 WHERE id = $6`,
    [name, type, options, required, now, id]
  );

  const updated = await db.select<Field[]>("SELECT * FROM fields WHERE id = $1", [id]);
  return updated[0];
}

export async function deleteField(id: string): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM fields WHERE id = $1", [id]);
}

export async function reorderFields(boardId: string, orderedIds: string[]): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();
  for (let i = 0; i < orderedIds.length; i++) {
    await db.execute(
      `UPDATE fields SET position = $1, updated_at = $2 WHERE id = $3 AND board_id = $4`,
      [i, now, orderedIds[i], boardId]
    );
  }
}
