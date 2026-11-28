import { getDb } from "./db";
import type { RecordData, RecordItem } from "@/types";
import { v4 as uuidv4 } from "uuid";

export function parseRecordData(dataJson: string): RecordData {
  try {
    return JSON.parse(dataJson) as RecordData;
  } catch {
    return {};
  }
}

export async function getRecords(boardId: string): Promise<RecordItem[]> {
  const db = await getDb();
  return await db.select<RecordItem[]>(
    "SELECT * FROM records WHERE board_id = $1 ORDER BY created_at DESC",
    [boardId]
  );
}

export async function createRecord(boardId: string, data: RecordData): Promise<RecordItem> {
  const db = await getDb();
  const now = new Date().toISOString();
  const id = uuidv4();

  await db.execute(
    `INSERT INTO records (id, board_id, data, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [id, boardId, JSON.stringify(data), now, now]
  );

  const rows = await db.select<RecordItem[]>("SELECT * FROM records WHERE id = $1", [id]);
  return rows[0];
}

export async function updateRecord(id: string, data: RecordData): Promise<RecordItem> {
  const db = await getDb();
  const now = new Date().toISOString();

  await db.execute(
    `UPDATE records SET data = $1, updated_at = $2 WHERE id = $3`,
    [JSON.stringify(data), now, id]
  );

  const rows = await db.select<RecordItem[]>("SELECT * FROM records WHERE id = $1", [id]);
  return rows[0];
}

export async function deleteRecord(id: string): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM records WHERE id = $1", [id]);
}

export async function bulkCreateRecords(
  boardId: string,
  rows: RecordData[]
): Promise<number> {
  const db = await getDb();
  const now = new Date().toISOString();
  let count = 0;

  for (const data of rows) {
    const id = uuidv4();
    await db.execute(
      `INSERT INTO records (id, board_id, data, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, boardId, JSON.stringify(data), now, now]
    );
    count++;
  }

  return count;
}
