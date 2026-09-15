export type FieldType =
  | "text"
  | "long_text"
  | "email"
  | "phone"
  | "number"
  | "date"
  | "datetime"
  | "single_select"
  | "multi_select"
  | "checkbox"
  | "url";

export interface Board {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  position: number;
}

export interface Field {
  id: string;
  board_id: string;
  name: string;
  key: string;
  type: FieldType;
  options: string | null; // JSON string
  required: number; // 0 or 1
  position: number;
  created_at: string;
  updated_at: string;
}

export interface Record {
  id: string;
  board_id: string;
  data: string; // JSON string
  created_at: string;
  updated_at: string;
}