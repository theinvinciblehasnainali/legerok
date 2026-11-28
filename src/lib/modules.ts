import { getDb } from "./db";
import type { ModuleState } from "@/sdk/types";

export async function getModuleStates(): Promise<ModuleState[]> {
  const db = await getDb();
  return await db.select<ModuleState[]>("SELECT * FROM module_states");
}

export async function setModuleEnabled(id: string, enabled: boolean): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();
  const enabledInt = enabled ? 1 : 0;

  await db.execute(
    `INSERT INTO module_states (id, enabled, installed_at, updated_at)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT(id) DO UPDATE SET
       enabled = excluded.enabled,
       installed_at = COALESCE(module_states.installed_at, excluded.installed_at),
       updated_at = excluded.updated_at`,
    [id, enabledInt, enabled ? now : null, now]
  );
}
