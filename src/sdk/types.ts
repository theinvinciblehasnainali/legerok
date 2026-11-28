import type { ReactNode } from "react";
import type { Board, Field, RecordItem } from "@/types";

export interface LegeRokSDK {
  boards: {
    list: () => Promise<Board[]>;
    get: (id: string) => Promise<Board | null>;
  };
  fields: {
    listByBoard: (boardId: string) => Promise<Field[]>;
  };
  records: {
    listByBoard: (boardId: string) => Promise<RecordItem[]>;
  };
}

export interface LegeRokModule {
  id: string;
  name: string;
  tagline: string;
  description: string;
  version: string;
  navLabel: string;
  renderView: (sdk: LegeRokSDK) => ReactNode;
}

export interface ModuleState {
  id: string;
  enabled: number; // 0 or 1
  installed_at: string | null;
  updated_at: string;
}
