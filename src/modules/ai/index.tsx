import { useEffect, useState } from "react";
import type { LegeRokModule, LegeRokSDK } from "@/sdk/types";
import { getRegisteredTools, type AppTool } from "@/sdk/tools";
import {
  AI_PROVIDER_PRESETS,
  callAiCompletion,
  getAiConfig,
  saveAiConfig,
  type AiConfig,
  type ChatMessage,
} from "./provider";
import { getModuleStates } from "@/lib/modules";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Bot, Check, Send, Settings, ShieldAlert, X } from "lucide-react";

interface PendingConfirmation {
  tool: AppTool;
  toolCallId: string;
  args: { [key: string]: unknown };
  remainingMessages: ChatMessage[];
}

function AiAssistantView({ sdk: _sdk }: { sdk: LegeRokSDK }) {
  const [config, setConfig] = useState<AiConfig>({
    provider: "openai",
    baseUrl: "https://api.openai.com/v1",
    apiKey: "",
    model: "gpt-4o-mini",
  });
  const [showSettings, setShowSettings] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingConfirm, setPendingConfirm] =
    useState<PendingConfirmation | null>(null);

  useEffect(() => {
    void getAiConfig().then((cfg) => {
      setConfig(cfg);
      if (!cfg.apiKey && cfg.provider !== "ollama") {
        setShowSettings(true);
      }
    });
  }, []);

  async function runAgentLoop(history: ChatMessage[]) {
    const states = await getModuleStates();
    const enabledIds = states.filter((s) => s.enabled === 1).map((s) => s.id);
    const tools = getRegisteredTools(enabledIds);

    const systemMsg: ChatMessage = {
      role: "system",
      content:
        "You are LegeRok AI, a local-first assistant that controls LegeRok Core (boards, fields, records) and plugged-in modules (like LegeRok Relay) using the provided tools. Always inspect board schemas before creating records or drafting emails.",
    };

    let current = [...history];

    for (let turn = 0; turn < 6; turn++) {
      const reply = await callAiCompletion(
        config,
        [systemMsg, ...current],
        tools
      );
      current = [...current, reply];
      setMessages(current);

      if (!reply.tool_calls || reply.tool_calls.length === 0) {
        return;
      }

      for (const tc of reply.tool_calls) {
        const tool = tools.find((t) => t.name === tc.function.name);
        let parsedArgs: { [key: string]: unknown } = {};
        try {
          parsedArgs = JSON.parse(tc.function.arguments || "{}") as {
            [key: string]: unknown;
          };
        } catch {
          parsedArgs = {};
        }

        if (!tool) {
          current = [
            ...current,
            {
              role: "tool",
              tool_call_id: tc.id,
              content: JSON.stringify({ error: "Unknown tool" }),
            },
          ];
          continue;
        }

        if (tool.requiresConfirmation) {
          setPendingConfirm({
            tool,
            toolCallId: tc.id,
            args: parsedArgs,
            remainingMessages: current,
          });
          return;
        }

        try {
          const result = await tool.execute(parsedArgs);
          current = [
            ...current,
            {
              role: "tool",
              tool_call_id: tc.id,
              content: JSON.stringify(result),
            },
          ];
        } catch (err) {
          current = [
            ...current,
            {
              role: "tool",
              tool_call_id: tc.id,
              content: JSON.stringify({
                error: err instanceof Error ? err.message : String(err),
              }),
            },
          ];
        }
        setMessages(current);
      }
    }
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || running) return;
    setError(null);
    const nextHistory: ChatMessage[] = [
      ...messages,
      { role: "user", content: input.trim() },
    ];
    setMessages(nextHistory);
    setInput("");
    setRunning(true);
    try {
      await runAgentLoop(nextHistory);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  }

  async function handleConfirmTool(approved: boolean) {
    if (!pendingConfirm) return;
    const { tool, toolCallId, args, remainingMessages } = pendingConfirm;
    setPendingConfirm(null);
    setRunning(true);
    try {
      let toolResult: unknown;
      if (approved) {
        toolResult = await tool.execute(args);
      } else {
        toolResult = { cancelled: true, reason: "User declined action." };
      }
      const nextHistory: ChatMessage[] = [
        ...remainingMessages,
        {
          role: "tool",
          tool_call_id: toolCallId,
          content: JSON.stringify(toolResult),
        },
      ];
      setMessages(nextHistory);
      await runAgentLoop(nextHistory);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-6 h-full flex flex-col">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Bot className="size-6 text-primary" />
            LegeRok AI
          </h1>
          <p className="text-sm text-muted-foreground">
            BYOK local tool-calling assistant for Core &amp; Relay
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowSettings((v) => !v)}
        >
          <Settings className="size-4" />
          API Settings
        </Button>
      </div>

      {showSettings && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-[1px] p-4"
          onClick={() => setShowSettings(false)}
        >
          <Card
            className="w-full max-w-lg shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
              <div>
                <CardTitle className="text-base">BYOK Provider Settings</CardTitle>
                <CardDescription>
                  Your API key is stored locally in LegeRok&apos;s SQLite database.
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setShowSettings(false)}
              >
                <X className="size-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Provider</Label>
                  <Select
                    value={config.provider}
                    onValueChange={(p) => {
                      const preset = AI_PROVIDER_PRESETS.find((x) => x.id === p);
                      setConfig((prev) => ({
                        ...prev,
                        provider: p,
                        baseUrl:
                          preset && p !== "custom" ? preset.baseUrl : prev.baseUrl,
                        model:
                          preset && p !== "custom"
                            ? preset.defaultModel
                            : prev.model,
                      }));
                    }}
                    options={AI_PROVIDER_PRESETS.map((p) => ({
                      value: p.id,
                      label: p.label,
                    }))}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Model</Label>
                  <Input
                    value={config.model}
                    onChange={(e) =>
                      setConfig((prev) => ({ ...prev, model: e.target.value }))
                    }
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Base URL</Label>
                <Input
                  value={config.baseUrl}
                  onChange={(e) =>
                    setConfig((prev) => ({ ...prev, baseUrl: e.target.value }))
                  }
                />
              </div>

              <div className="space-y-1.5">
                <Label>API Key (optional for Ollama)</Label>
                <Input
                  type="password"
                  placeholder="sk-..."
                  value={config.apiKey}
                  onChange={(e) =>
                    setConfig((prev) => ({ ...prev, apiKey: e.target.value }))
                  }
                />
              </div>
            </CardContent>
            <CardFooter className="flex items-center justify-end gap-2 border-t pt-4">
              {savedNotice && (
                <span className="text-xs text-primary">Saved!</span>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowSettings(false)}
              >
                Close
              </Button>
              <Button
                size="sm"
                onClick={async () => {
                  await saveAiConfig(config);
                  setSavedNotice(true);
                  setTimeout(() => {
                    setSavedNotice(false);
                    setShowSettings(false);
                  }, 600);
                }}
              >
                Save Settings
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}

      {/* Chat Transcript */}
      <Card className="flex-1 flex flex-col min-h-[340px]">
        <CardContent className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-sm text-muted-foreground space-y-2 py-12">
              <Bot className="size-8 opacity-40" />
              <p className="font-medium text-foreground">
                Ask LegeRok AI to work across your boards and Relay campaigns
              </p>
              <p className="max-w-md text-xs">
                Try: &ldquo;List my boards&rdquo;, &ldquo;Add a prospect record to Cold Outreach&rdquo;, or &ldquo;Draft personalized emails for my campaign&rdquo;.
              </p>
            </div>
          ) : (
            messages
              .filter((m) => m.role === "user" || (m.role === "assistant" && m.content))
              .map((m, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-2xl text-sm whitespace-pre-wrap max-w-[85%] ${
                    m.role === "user"
                      ? "ml-auto bg-primary text-primary-foreground"
                      : "bg-muted text-foreground"
                  }`}
                >
                  {m.content}
                </div>
              ))
          )}

          {pendingConfirm && (
            <div className="p-4 rounded-2xl border border-primary/40 bg-primary/5 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <ShieldAlert className="size-4 text-primary" />
                Confirm Action: <code>{pendingConfirm.tool.name}</code>
              </div>
              <pre className="text-xs bg-background p-2.5 rounded-xl border overflow-x-auto">
                {JSON.stringify(pendingConfirm.args, null, 2)}
              </pre>
              <div className="flex gap-2">
                <Button
                  size="xs"
                  onClick={() => void handleConfirmTool(true)}
                >
                  <Check className="size-3.5" />
                  Approve
                </Button>
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() => void handleConfirmTool(false)}
                >
                  <X className="size-3.5" />
                  Decline
                </Button>
              </div>
            </div>
          )}

          {error && (
            <p className="text-xs text-destructive p-2 rounded-lg bg-destructive/10">
              {error}
            </p>
          )}
        </CardContent>

        <form onSubmit={handleSend} className="p-3 border-t flex gap-2">
          <Input
            placeholder="Ask LegeRok AI to create records, query boards, or draft Relay emails..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={running || !!pendingConfirm}
          />
          <Button type="submit" disabled={running || !input.trim() || !!pendingConfirm}>
            <Send className="size-4" />
            {running ? "Thinking..." : "Send"}
          </Button>
        </form>
      </Card>
    </div>
  );
}

export const aiModule: LegeRokModule = {
  id: "ai",
  name: "LegeRok AI",
  tagline: "BYOK Tool-Calling Assistant",
  description:
    "Bring your own API key (OpenAI, Gemini, OpenRouter, or local Ollama) to control boards, records, and Relay campaigns via local tools.",
  version: "0.1.0",
  navLabel: "AI Assistant",
  renderView: (sdk) => <AiAssistantView sdk={sdk} />,
};
