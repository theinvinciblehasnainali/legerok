import { useEffect, useState } from "react";
import type { InboxMessage, RelayMailbox } from "../types";
import { deleteMailboxMessage, fetchMailboxInbox } from "../db";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Inbox, RefreshCw, Trash2 } from "lucide-react";

interface InboxViewProps {
  mailbox: RelayMailbox;
}

export function InboxView({ mailbox }: InboxViewProps) {
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDeleteUid, setConfirmDeleteUid] = useState<number | null>(null);

  useEffect(() => {
    setMessages([]);
    setError(null);
  }, [mailbox.id]);

  async function handleSync() {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchMailboxInbox(mailbox, 25);
      setMessages(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteConfirmed() {
    if (confirmDeleteUid === null) return;
    try {
      await deleteMailboxMessage(mailbox, confirmDeleteUid);
      setMessages((prev) => prev.filter((m) => m.uid !== confirmDeleteUid));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setConfirmDeleteUid(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Recent messages in <span className="font-medium text-foreground">{mailbox.email}</span>
        </p>
        <Button
          size="sm"
          variant="outline"
          disabled={loading}
          onClick={() => void handleSync()}
        >
          <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Syncing..." : "Sync Inbox"}
        </Button>
      </div>

      {error && (
        <div className="text-sm p-3 rounded-xl border bg-destructive/10 border-destructive/30 text-destructive">
          {error}
        </div>
      )}

      {messages.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground space-y-2">
            <Inbox className="size-6 mx-auto opacity-40" />
            <p>Click &ldquo;Sync Inbox&rdquo; to fetch recent messages via IMAP.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {messages.map((msg) => (
            <Card key={msg.uid}>
              <CardContent className="py-3.5 flex items-start justify-between gap-4">
                <div className="min-w-0 space-y-1">
                  <p className="font-medium text-sm truncate">{msg.subject}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    From: {msg.from} · {msg.date}
                  </p>
                  {msg.snippet && (
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {msg.snippet}
                    </p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => setConfirmDeleteUid(msg.uid)}
                  title="Delete from server"
                >
                  <Trash2 className="size-3.5 text-destructive" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={confirmDeleteUid !== null}
        title="Delete message?"
        description="This will permanently delete the message from the mail server."
        confirmLabel="Delete"
        destructive
        onConfirm={() => void handleDeleteConfirmed()}
        onCancel={() => setConfirmDeleteUid(null)}
      />
    </div>
  );
}
