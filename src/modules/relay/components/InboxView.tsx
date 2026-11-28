import { useEffect, useState } from "react";
import type { RelayMailbox, StoredInboxMessage } from "../types";
import {
  deleteMailboxMessage,
  getStoredInboxMessages,
  syncMailboxInbox,
} from "../db";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  ChevronLeft,
  ChevronRight,
  Inbox,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";

const PAGE_SIZE = 20;

interface InboxViewProps {
  mailbox: RelayMailbox;
}

export function InboxView({ mailbox }: InboxViewProps) {
  const [messages, setMessages] = useState<StoredInboxMessage[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDeleteUid, setConfirmDeleteUid] = useState<number | null>(null);
  const [openMessage, setOpenMessage] = useState<StoredInboxMessage | null>(null);
  const [preferPlainText, setPreferPlainText] = useState(false);

  useEffect(() => {
    setPage(1);
    setSyncNotice(null);
    setError(null);
    setOpenMessage(null);
    void getStoredInboxMessages(mailbox.id).then(setMessages);
  }, [mailbox.id]);

  async function handleSync() {
    setLoading(true);
    setError(null);
    setSyncNotice(null);
    try {
      const { addedCount, messages: updated } = await syncMailboxInbox(
        mailbox,
        25
      );
      setMessages(updated);
      setPage(1);
      setSyncNotice(
        addedCount > 0
          ? `Synced ${addedCount} new ${addedCount === 1 ? "message" : "messages"}.`
          : "Inbox is up to date."
      );
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
      if (openMessage?.uid === confirmDeleteUid) setOpenMessage(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setConfirmDeleteUid(null);
    }
  }

  const totalPages = Math.max(1, Math.ceil(messages.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = messages.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>
            <span className="font-medium text-foreground">{mailbox.email}</span>
            {" · "}
            {messages.length} {messages.length === 1 ? "message" : "messages"} synced
          </span>
          {syncNotice && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
              {syncNotice}
            </span>
          )}
        </div>
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
            <p>Click &ldquo;Sync Inbox&rdquo; to fetch and save messages locally.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-2">
            {pageItems.map((msg) => (
              <Card
                key={msg.id}
                onClick={() => {
                  setOpenMessage(msg);
                  setPreferPlainText(false);
                }}
                className="cursor-pointer hover:ring-primary/40 transition-all"
              >
                <CardContent className="py-3.5 flex items-start justify-between gap-4">
                  <div className="min-w-0 space-y-1">
                    <p className="font-medium text-sm truncate">{msg.subject}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      From: {msg.from_addr} · {msg.date_str}
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
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmDeleteUid(msg.uid);
                    }}
                    title="Delete from server"
                  >
                    <Trash2 className="size-3.5 text-destructive" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-muted-foreground">
                Page {safePage} of {totalPages}
              </span>
              <div className="flex items-center gap-1.5">
                <Button
                  size="xs"
                  variant="outline"
                  disabled={safePage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="size-3.5" />
                  Previous
                </Button>
                <Button
                  size="xs"
                  variant="outline"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                  <ChevronRight className="size-3.5" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Email Reader Modal */}
      {openMessage && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-[1px] p-4"
          onClick={() => setOpenMessage(null)}
        >
          <Card
            className="w-full max-w-3xl h-[82vh] flex flex-col shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <CardHeader className="flex flex-row items-start justify-between gap-4 border-b pb-4">
              <div className="min-w-0 space-y-1">
                <CardTitle className="text-base break-words">
                  {openMessage.subject}
                </CardTitle>
                <CardDescription className="text-xs">
                  From: {openMessage.from_addr} · {openMessage.date_str}
                </CardDescription>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {openMessage.body_html && openMessage.body_text && (
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() => setPreferPlainText((v) => !v)}
                  >
                    {preferPlainText ? "View HTML" : "Plain Text"}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setConfirmDeleteUid(openMessage.uid)}
                  title="Delete message"
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setOpenMessage(null)}
                >
                  <X className="size-4" />
                </Button>
              </div>
            </CardHeader>

            <CardContent className="flex-1 overflow-hidden p-0">
              {openMessage.body_html && !preferPlainText ? (
                <iframe
                  title={openMessage.subject}
                  sandbox=""
                  srcDoc={openMessage.body_html}
                  className="w-full h-full bg-white border-0"
                />
              ) : (
                <div className="h-full overflow-y-auto p-6">
                  <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed">
                    {openMessage.body_text || openMessage.snippet || "(Empty message)"}
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <ConfirmDialog
        open={confirmDeleteUid !== null}
        title="Delete message?"
        description="This will permanently delete the message from both the mail server and your local inbox."
        confirmLabel="Delete"
        destructive
        onConfirm={() => void handleDeleteConfirmed()}
        onCancel={() => setConfirmDeleteUid(null)}
      />
    </div>
  );
}
