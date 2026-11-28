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

export interface FieldOptions {
  choices?: string[];
  min?: number;
  max?: number;
  decimals?: number;
}

export type FieldValue = string | number | boolean | string[] | null;

export type RecordData = { [fieldKey: string]: FieldValue };

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
  options: string | null; // JSON string of FieldOptions
  required: number; // 0 or 1
  position: number;
  created_at: string;
  updated_at: string;
}

export interface RecordItem {
  id: string;
  board_id: string;
  data: string; // JSON string of RecordData
  created_at: string;
  updated_at: string;
}
