import Database from "@tauri-apps/plugin-sql";

// This will hold the database connection
let db: Database | null = null;

export async function getDb() {
  if (db) return db;

  // "sqlite:legerok.db" must match what we put in the Rust migrations
  db = await Database.load("sqlite:legerok.db");
  return db;
}

// Optional: helper to close the connection later if needed
export async function closeDb() {
  if (db) {
    await db.close();
    db = null;
  }
}