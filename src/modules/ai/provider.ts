import { getDb } from "@/lib/db";
import type { AppTool } from "@/sdk/tools";

export interface AiConfig {
  provider: "openai" | "gemini" | "openrouter" | "ollama" | "custom";
  baseUrl: string;
  apiKey: string;
  model: string;
}

export const AI_PROVIDER_PRESETS: {
  id: AiConfig["provider"];
  label: string;
  baseUrl: string;
  defaultModel: string;
}[] = [
  {
    id: "openai",
    label: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4o-mini",
  },
  {
    id: "gemini",
    label: "Google Gemini (OpenAI-compatible)",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    defaultModel: "gemini-2.5-flash",
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    defaultModel: "openai/gpt-4o-mini",
  },
  {
    id: "ollama",
    label: "Ollama (Local)",
    baseUrl: "http://localhost:11434/v1",
    defaultModel: "llama3.1",
  },
  {
    id: "custom",
    label: "Custom OpenAI-Compatible",
    baseUrl: "",
    defaultModel: "",
  },
];

export async function getAiConfig(): Promise<AiConfig> {
  const db = await getDb();
  const rows = await db.select<{ value: string }[]>(
    "SELECT value FROM app_settings WHERE key = 'ai_config'"
  );
  if (rows[0]) {
    try {
      return JSON.parse(rows[0].value) as AiConfig;
    } catch {
      // fall through
    }
  }
  return {
    provider: "openai",
    baseUrl: "https://api.openai.com/v1",
    apiKey: "",
    model: "gpt-4o-mini",
  };
}

export async function saveAiConfig(config: AiConfig): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();
  await db.execute(
    `INSERT INTO app_settings (key, value, updated_at)
     VALUES ('ai_config', $1, $2)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [JSON.stringify(config), now]
  );
}

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_call_id?: string;
  tool_calls?: {
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }[];
}

export async function callAiCompletion(
  config: AiConfig,
  messages: ChatMessage[],
  tools: AppTool[]
): Promise<ChatMessage> {
  const url = `${config.baseUrl.replace(/\/+$/, "")}/chat/completions`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (config.apiKey.trim()) {
    headers["Authorization"] = `Bearer ${config.apiKey.trim()}`;
  }

  const body: Record<string, unknown> = {
    model: config.model,
    messages,
  };

  if (tools.length > 0) {
    body.tools = tools.map((t) => ({
      type: "function",
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));
  }

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`AI provider error (${res.status}): ${errText}`);
  }

  const json = (await res.json()) as {
    choices?: { message: ChatMessage }[];
  };
  const msg = json.choices?.[0]?.message;
  if (!msg) throw new Error("No response message returned from AI provider.");
  return msg;
}
