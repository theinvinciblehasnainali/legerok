import type { LegeRokModule } from "./types";
import { relayModule } from "@/modules/relay";
import { aiModule } from "@/modules/ai";

export const AVAILABLE_MODULES: LegeRokModule[] = [relayModule, aiModule];

export function getModuleById(id: string): LegeRokModule | undefined {
  return AVAILABLE_MODULES.find((m) => m.id === id);
}
