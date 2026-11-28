import { useState } from "react";
import type { MailboxProvider, RelayMailbox, SmtpSecurity } from "../types";
import { MAILBOX_PRESETS } from "../presets";
import {
  createMailbox,
  deleteMailbox,
  testMailboxConnection,
} from "../db";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CheckCircle2, Mail, Plus, Trash2, Wifi } from "lucide-react";

interface MailboxesViewProps {
  mailboxes: RelayMailbox[];
  onChanged: () => Promise<void>;
}

export function MailboxesView({ mailboxes, onChanged }: MailboxesViewProps) {
  const [showForm, setShowForm] = useState(mailboxes.length === 0);
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

  const activePreset = MAILBOX_PRESETS.find((p) => p.id === provider);

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
    }
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const msg = await testMailboxConnection({
        email: email.trim(),
        smtp_host: smtpHost.trim(),
        smtp_port: Number(smtpPort),
        smtp_security: smtpSecurity,
        imap_host: imapHost.trim(),
        imap_port: Number(imapPort),
        username: (username || email).trim(),
        password,
      });
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
      setShowForm(false);
      await onChanged();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium">Connected Mailboxes</h2>
          <p className="text-sm text-muted-foreground">
            Connect any email provider via SMTP &amp; IMAP.
          </p>
        </div>
        <Button size="sm" onClick={() => setShowForm((v) => !v)}>
          <Plus className="size-4" />
          {showForm ? "Close Form" : "Add Mailbox"}
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Add Mailbox</CardTitle>
            <CardDescription>
              Choose a provider preset or configure custom SMTP/IMAP settings.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="mb-provider">Provider</Label>
                  <select
                    id="mb-provider"
                    value={provider}
                    onChange={(e) =>
                      handlePresetChange(e.target.value as MailboxProvider)
                    }
                    className="h-9 w-full rounded-4xl border border-input bg-background px-3 text-sm outline-none"
                  >
                    {MAILBOX_PRESETS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </select>
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
                  <Label htmlFor="mb-username">Username (if different)</Label>
                  <Input
                    id="mb-username"
                    placeholder="Defaults to email address"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
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

                <div className="space-y-1.5">
                  <Label htmlFor="mb-smtp-host">SMTP Host &amp; Port</Label>
                  <div className="flex gap-2">
                    <Input
                      id="mb-smtp-host"
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
                    <select
                      value={smtpSecurity}
                      onChange={(e) =>
                        setSmtpSecurity(e.target.value as SmtpSecurity)
                      }
                      className="h-9 rounded-4xl border border-input bg-background px-2.5 text-xs outline-none"
                    >
                      <option value="tls">TLS</option>
                      <option value="starttls">STARTTLS</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="mb-imap-host">IMAP Host &amp; Port</Label>
                  <div className="flex gap-2">
                    <Input
                      id="mb-imap-host"
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

              <div className="flex items-center justify-end gap-2">
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
                  disabled={saving || !email.trim() || !password}
                >
                  {saving ? "Saving..." : "Save Mailbox"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {mailboxes.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No mailboxes connected yet. Add one above to start sending and reading email.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {mailboxes.map((mb) => (
            <Card key={mb.id}>
              <CardContent className="py-4 flex items-center justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <p className="font-medium flex items-center gap-2 truncate">
                    <Mail className="size-4 text-primary shrink-0" />
                    {mb.name}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {mb.email} · {mb.provider}
                  </p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <CheckCircle2 className="size-3 text-primary" />
                    Limit: {mb.daily_limit}/day
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setConfirmDelete(mb)}
                  title="Remove mailbox"
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </CardContent>
            </Card>
          ))}
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
