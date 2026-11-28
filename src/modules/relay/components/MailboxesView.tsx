import { useState } from "react";
import type {
  MailboxProvider,
  RelayEmailQueueItem,
  RelayMailbox,
  SmtpSecurity,
} from "../types";
import { MAILBOX_PRESETS } from "../presets";
import {
  createMailbox,
  deleteMailbox,
  testMailboxConnection,
} from "../db";
import { InboxView } from "./InboxView";
import { OutboxView } from "./OutboxView";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Inbox,
  Mail,
  Plus,
  Send,
  Settings,
  Trash2,
  Wifi,
  X,
} from "lucide-react";

type MailboxSubTab = "inbox" | "outbox" | "settings";

interface MailboxesViewProps {
  mailboxes: RelayMailbox[];
  queue: RelayEmailQueueItem[];
  onChanged: () => Promise<void>;
}

export function MailboxesView({
  mailboxes,
  queue,
  onChanged,
}: MailboxesViewProps) {
  const [selectedMailboxId, setSelectedMailboxId] = useState<string | null>(null);
  const [subTab, setSubTab] = useState<MailboxSubTab>("inbox");

  const [modalOpen, setModalOpen] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [provider, setProvider] = useState<MailboxProvider>("hostinger");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [smtpHost, setSmtpHost] = useState("smtp.hostinger.com");
  const [smtpPort, setSmtpPort] = useState(465);
  const [smtpSecurity, setSmtpSecurity] = useState<SmtpSecurity>("tls");
  const [imapHost, setImapHost] = useState("imap.hostinger.com");
  const [imapPort, setImapPort] = useState(993);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [dailyLimit, setDailyLimit] = useState(50);

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<RelayMailbox | null>(null);

  const selectedMailbox =
    mailboxes.find((m) => m.id === selectedMailboxId) ?? null;

  const activePreset = MAILBOX_PRESETS.find((p) => p.id === provider);

  function openAddModal() {
    setTestResult(null);
    setShowAdvanced(provider === "custom");
    setModalOpen(true);
  }

  function closeAddModal() {
    setModalOpen(false);
    setTestResult(null);
  }

  function handlePresetChange(nextProvider: MailboxProvider) {
    setProvider(nextProvider);
    setTestResult(null);
    const preset = MAILBOX_PRESETS.find((p) => p.id === nextProvider);
    if (preset && preset.id !== "custom") {
      setSmtpHost(preset.smtp_host);
      setSmtpPort(preset.smtp_port);
      setSmtpSecurity(preset.smtp_security);
      setImapHost(preset.imap_host);
      setImapPort(preset.imap_port);
      setShowAdvanced(false);
    } else {
      setShowAdvanced(true);
    }
  }

  async function handleTest(mb?: RelayMailbox) {
    setTesting(true);
    setTestResult(null);
    try {
      const target = mb ?? {
        email: email.trim(),
        smtp_host: smtpHost.trim(),
        smtp_port: Number(smtpPort),
        smtp_security: smtpSecurity,
        imap_host: imapHost.trim(),
        imap_port: Number(imapPort),
        username: (username || email).trim(),
        password,
      };
      const msg = await testMailboxConnection(target);
      setTestResult({ ok: true, msg });
    } catch (err) {
      setTestResult({
        ok: false,
        msg: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setTesting(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !smtpHost.trim() || !imapHost.trim()) return;
    setSaving(true);
    try {
      await createMailbox({
        name: name.trim() || email.trim(),
        provider,
        email: email.trim(),
        smtp_host: smtpHost.trim(),
        smtp_port: Number(smtpPort),
        smtp_security: smtpSecurity,
        imap_host: imapHost.trim(),
        imap_port: Number(imapPort),
        username: (username || email).trim(),
        password,
        daily_limit: Number(dailyLimit) || 50,
      });
      setName("");
      setEmail("");
      setUsername("");
      setPassword("");
      setTestResult(null);
      setModalOpen(false);
      await onChanged();
    } finally {
      setSaving(false);
    }
  }

  // --- Mailbox Detail View (Inbox / Outbox / Settings) ---
  if (selectedMailbox) {
    const mbQueue = queue.filter((q) => q.mailbox_id === selectedMailbox.id);
    const pendingCount = mbQueue.filter(
      (q) => q.status === "pending_approval"
    ).length;

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelectedMailboxId(null);
                setTestResult(null);
              }}
            >
              <ArrowLeft className="size-4" />
              All Mailboxes
            </Button>
            <div className="h-5 w-px bg-border" />
            <div>
              <h2 className="text-lg font-medium leading-tight">
                {selectedMailbox.name}
              </h2>
              <p className="text-xs text-muted-foreground">
                {selectedMailbox.email} · {selectedMailbox.provider}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant={subTab === "inbox" ? "default" : "outline"}
              onClick={() => setSubTab("inbox")}
            >
              <Inbox className="size-4" />
              Inbox
            </Button>
            <Button
              size="sm"
              variant={subTab === "outbox" ? "default" : "outline"}
              onClick={() => setSubTab("outbox")}
            >
              <Send className="size-4" />
              Outbox {pendingCount > 0 ? `(${pendingCount})` : ""}
            </Button>
            <Button
              size="sm"
              variant={subTab === "settings" ? "default" : "outline"}
              onClick={() => setSubTab("settings")}
            >
              <Settings className="size-4" />
              Settings
            </Button>
          </div>
        </div>

        {subTab === "inbox" && <InboxView mailbox={selectedMailbox} />}

        {subTab === "outbox" && (
          <OutboxView
            mailbox={selectedMailbox}
            queue={queue}
            onChanged={onChanged}
          />
        )}

        {subTab === "settings" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Mailbox Configuration</CardTitle>
              <CardDescription>
                Connection details and daily sending limit for {selectedMailbox.email}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">SMTP Server</p>
                  <p className="font-medium">
                    {selectedMailbox.smtp_host}:{selectedMailbox.smtp_port} (
                    {selectedMailbox.smtp_security.toUpperCase()})
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">IMAP Server</p>
                  <p className="font-medium">
                    {selectedMailbox.imap_host}:{selectedMailbox.imap_port}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Username</p>
                  <p className="font-medium">{selectedMailbox.username}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Daily Send Limit</p>
                  <p className="font-medium">{selectedMailbox.daily_limit}/day</p>
                </div>
              </div>

              {testResult && (
                <div
                  className={`text-sm p-3 rounded-xl border ${
                    testResult.ok
                      ? "bg-primary/10 border-primary/30 text-primary"
                      : "bg-destructive/10 border-destructive/30 text-destructive"
                  }`}
                >
                  {testResult.msg}
                </div>
              )}

              <div className="flex items-center justify-between pt-2 border-t">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setConfirmDelete(selectedMailbox)}
                >
                  <Trash2 className="size-4" />
                  Remove Mailbox
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={testing}
                  onClick={() => void handleTest(selectedMailbox)}
                >
                  <Wifi className="size-4" />
                  {testing ? "Testing..." : "Test Connection"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <ConfirmDialog
          open={!!confirmDelete}
          title="Remove mailbox?"
          description={`Remove "${confirmDelete?.email}"? Campaigns using this mailbox will also be removed.`}
          confirmLabel="Remove"
          destructive
          onConfirm={async () => {
            if (!confirmDelete) return;
            await deleteMailbox(confirmDelete.id);
            setConfirmDelete(null);
            setSelectedMailboxId(null);
            await onChanged();
          }}
          onCancel={() => setConfirmDelete(null)}
        />
      </div>
    );
  }

  // --- Mailbox List View ---
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium">Mailboxes</h2>
          <p className="text-sm text-muted-foreground">
            Select a mailbox to open its Inbox, Outbox, and settings.
          </p>
        </div>
        <Button size="sm" onClick={openAddModal}>
          <Plus className="size-4" />
          Add Mailbox
        </Button>
      </div>

      {mailboxes.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center space-y-3">
            <Mail className="size-7 mx-auto text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              No mailboxes connected yet. Add one to start sending and reading email.
            </p>
            <Button size="sm" onClick={openAddModal}>
              <Plus className="size-4" />
              Add Mailbox
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {mailboxes.map((mb) => {
            const pendingCount = queue.filter(
              (q) => q.mailbox_id === mb.id && q.status === "pending_approval"
            ).length;
            return (
              <Card
                key={mb.id}
                onClick={() => {
                  setSelectedMailboxId(mb.id);
                  setSubTab(pendingCount > 0 ? "outbox" : "inbox");
                  setTestResult(null);
                }}
                className="cursor-pointer hover:ring-primary/40 transition-all"
              >
                <CardContent className="py-4 flex items-center justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <p className="font-medium flex items-center gap-2 truncate">
                      <Mail className="size-4 text-primary shrink-0" />
                      {mb.name}
                      {pendingCount > 0 && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-primary/15 text-primary">
                          {pendingCount} pending
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {mb.email} · {mb.provider}
                    </p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <CheckCircle2 className="size-3 text-primary" />
                      Limit: {mb.daily_limit}/day
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmDelete(mb);
                      }}
                      title="Remove mailbox"
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                    <ArrowRight className="size-4 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add Mailbox Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-[1px] p-4"
          onClick={closeAddModal}
        >
          <Card
            className="w-full max-w-xl max-h-[88vh] flex flex-col shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
              <div>
                <CardTitle>Add Mailbox</CardTitle>
                <CardDescription>
                  Connect an email account via SMTP &amp; IMAP.
                </CardDescription>
              </div>
              <Button variant="ghost" size="icon-sm" onClick={closeAddModal}>
                <X className="size-4" />
              </Button>
            </CardHeader>

            <form
              id="add-mailbox-form"
              onSubmit={handleSave}
              className="flex-1 overflow-y-auto p-6 space-y-4"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="mb-provider">Provider</Label>
                  <Select
                    id="mb-provider"
                    value={provider}
                    onValueChange={handlePresetChange}
                    options={MAILBOX_PRESETS.map((p) => ({
                      value: p.id,
                      label: p.label,
                    }))}
                  />
                  {activePreset?.note && (
                    <p className="text-xs text-muted-foreground">
                      {activePreset.note}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="mb-name">Display Label</Label>
                  <Input
                    id="mb-name"
                    placeholder="e.g. Work Outreach"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="mb-email">Email Address</Label>
                <Input
                  id="mb-email"
                  type="email"
                  placeholder="you@yourdomain.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="mb-password">Password / App Password</Label>
                <Input
                  id="mb-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              {/* Collapsible Advanced Settings */}
              <div className="border rounded-2xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowAdvanced((v) => !v)}
                  className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <span>Advanced Settings</span>
                  {showAdvanced ? (
                    <ChevronDown className="size-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="size-4 text-muted-foreground" />
                  )}
                </button>

                {showAdvanced && (
                  <div className="p-4 space-y-4 border-t bg-card">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="mb-username">Username (if different)</Label>
                        <Input
                          id="mb-username"
                          placeholder="Defaults to email address"
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="mb-limit">Daily Send Limit</Label>
                        <Input
                          id="mb-limit"
                          type="number"
                          min={1}
                          value={dailyLimit}
                          onChange={(e) => setDailyLimit(Number(e.target.value))}
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="mb-smtp-host">SMTP Server</Label>
                      <div className="flex gap-2">
                        <Input
                          id="mb-smtp-host"
                          placeholder="smtp.example.com"
                          value={smtpHost}
                          onChange={(e) => setSmtpHost(e.target.value)}
                          required
                        />
                        <Input
                          type="number"
                          className="w-24"
                          value={smtpPort}
                          onChange={(e) => setSmtpPort(Number(e.target.value))}
                          required
                        />
                        <Select
                          className="w-32 shrink-0"
                          value={smtpSecurity}
                          onValueChange={setSmtpSecurity}
                          options={[
                            { value: "tls", label: "TLS" },
                            { value: "starttls", label: "STARTTLS" },
                          ]}
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="mb-imap-host">IMAP Server</Label>
                      <div className="flex gap-2">
                        <Input
                          id="mb-imap-host"
                          placeholder="imap.example.com"
                          value={imapHost}
                          onChange={(e) => setImapHost(e.target.value)}
                          required
                        />
                        <Input
                          type="number"
                          className="w-24"
                          value={imapPort}
                          onChange={(e) => setImapPort(Number(e.target.value))}
                          required
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {testResult && (
                <div
                  className={`text-sm p-3 rounded-xl border ${
                    testResult.ok
                      ? "bg-primary/10 border-primary/30 text-primary"
                      : "bg-destructive/10 border-destructive/30 text-destructive"
                  }`}
                >
                  {testResult.msg}
                </div>
              )}
            </form>

            <CardFooter className="flex items-center justify-end gap-2 border-t pt-4">
              <Button
                type="button"
                variant="outline"
                disabled={testing || !email.trim() || !password}
                onClick={() => void handleTest()}
              >
                <Wifi className="size-4" />
                {testing ? "Testing..." : "Test Connection"}
              </Button>
              <Button
                type="submit"
                form="add-mailbox-form"
                disabled={saving || !email.trim() || !password}
              >
                {saving ? "Saving..." : "Save Mailbox"}
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        title="Remove mailbox?"
        description={`Remove "${confirmDelete?.email}"? Campaigns using this mailbox will also be removed.`}
        confirmLabel="Remove"
        destructive
        onConfirm={async () => {
          if (!confirmDelete) return;
          await deleteMailbox(confirmDelete.id);
          setConfirmDelete(null);
          await onChanged();
        }}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
