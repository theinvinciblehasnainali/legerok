import { getDb } from "./db";
import type { Board } from "@/types";
import { v4 as uuidv4 } from "uuid";

export async function getBoards(): Promise<Board[]> {
  const db = await getDb();
  return await db.select<Board[]>("SELECT * FROM boards ORDER BY position ASC, created_at ASC");
}

export async function createBoard(name: string, description?: string): Promise<Board> {
  const db = await getDb();
  const now = new Date().toISOString();
  const id = uuidv4();

  await db.execute(
    `INSERT INTO boards (id, name, description, created_at, updated_at, position)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, name, description ?? null, now, now, 0]
  );

  const boards = await db.select<Board[]>("SELECT * FROM boards WHERE id = $1", [id]);
  return boards[0];
}

export async function deleteBoard(id: string): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM boards WHERE id = $1", [id]);
}