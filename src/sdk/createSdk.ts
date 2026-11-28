import type { LegeRokSDK } from "./types";
import { getBoard, getBoards } from "@/lib/boards";
import { getFields } from "@/lib/fields";
import { getRecords } from "@/lib/records";

export function createLegeRokSDK(): LegeRokSDK {
  return {
    boards: {
      list: getBoards,
      get: getBoard,
    },
    fields: {
      listByBoard: getFields,
    },
    records: {
      listByBoard: getRecords,
    },
  };
}
