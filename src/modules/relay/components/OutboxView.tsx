import { useState } from "react";
import type { RelayEmailQueueItem, RelayMailbox } from "../types";
import {
  deleteQueueItem,
  sendEmailViaMailbox,
  updateQueueItem,
} from "../db";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Check, Clock, Send, Trash2 } from "lucide-react";

interface OutboxViewProps {
  mailbox: RelayMailbox;
  queue: RelayEmailQueueItem[];
  onChanged: () => Promise<void>;
}

export function OutboxView({ mailbox, queue, onChanged }: OutboxViewProps) {
  const [filter, setFilter] = useState<string>("all");
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editSubject, setEditSubject] = useState("");
  const [editBody, setEditBody] = useState("");

  const mailboxQueue = queue.filter((item) => item.mailbox_id === mailbox.id);
  const filtered = mailboxQueue.filter((item) =>
    filter === "all" ? true : item.status === filter
  );

  async function handleSendNow(item: RelayEmailQueueItem) {
    setSendingId(item.id);
    try {
      await updateQueueItem(item.id, { status: "sending", error_message: null });
      await sendEmailViaMailbox(mailbox, item.to_email, item.subject, item.body);
      await updateQueueItem(item.id, {
        status: "sent",
        sent_at: new Date().toISOString(),
      });
    } catch (err) {
      await updateQueueItem(item.id, {
        status: "failed",
        error_message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSendingId(null);
      await onChanged();
    }
  }

  async function handleApproveAll() {
    const pending = mailboxQueue.filter((q) => q.status === "pending_approval");
    for (const item of pending) {
      await handleSendNow(item);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {["all", "pending_approval", "scheduled", "sent", "failed"].map((s) => (
            <Button
              key={s}
              size="xs"
              variant={filter === s ? "default" : "outline"}
              onClick={() => setFilter(s)}
            >
              {s === "all"
                ? `All (${mailboxQueue.length})`
                : `${s.replace("_", " ")} (${
                    mailboxQueue.filter((q) => q.status === s).length
                  })`}
            </Button>
          ))}
        </div>

        {mailboxQueue.some((q) => q.status === "pending_approval") && (
          <Button size="sm" onClick={() => void handleApproveAll()}>
            <Check className="size-4" />
            Approve &amp; Send All Pending
          </Button>
        )}
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No emails in {mailbox.name}&apos;s outbox for this filter.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => {
            const isEditing = editingId === item.id;
            const isBusy = sendingId === item.id;
            return (
              <Card key={item.id}>
                <CardContent className="py-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1 flex-1">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-medium text-foreground">
                          To: {item.to_email}
                        </span>
                        <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground capitalize">
                          {item.status.replace("_", " ")}
                        </span>
                        {item.scheduled_at && item.status === "scheduled" && (
                          <span className="inline-flex items-center gap-1 text-muted-foreground">
                            <Clock className="size-3" />
                            {new Date(item.scheduled_at).toLocaleString()}
                          </span>
                        )}
                      </div>

                      {isEditing ? (
                        <div className="space-y-2 pt-2">
                          <Input
                            value={editSubject}
                            onChange={(e) => setEditSubject(e.target.value)}
                          />
                          <textarea
                            rows={4}
                            value={editBody}
                            onChange={(e) => setEditBody(e.target.value)}
                            className="w-full rounded-xl border border-input bg-input/30 px-3 py-2 text-sm outline-none"
                          />
                          <div className="flex gap-2">
                            <Button
                              size="xs"
                              onClick={async () => {
                                await updateQueueItem(item.id, {
                                  subject: editSubject,
                                  body: editBody,
                                });
                                setEditingId(null);
                                await onChanged();
                              }}
                            >
                              Save Draft
                            </Button>
                            <Button
                              size="xs"
                              variant="outline"
                              onClick={() => setEditingId(null)}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <p className="font-medium text-sm">{item.subject}</p>
                          <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                            {item.body}
                          </p>
                        </>
                      )}

                      {item.error_message && (
                        <p className="text-xs text-destructive">
                          Error: {item.error_message}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {(item.status === "pending_approval" ||
                        item.status === "scheduled" ||
                        item.status === "failed") &&
                        !isEditing && (
                          <>
                            <Button
                              size="xs"
                              variant="outline"
                              onClick={() => {
                                setEditingId(item.id);
                                setEditSubject(item.subject);
                                setEditBody(item.body);
                              }}
                            >
                              Edit
                            </Button>
                            <Button
                              size="xs"
                              disabled={isBusy}
                              onClick={() => void handleSendNow(item)}
                            >
                              <Send className="size-3" />
                              {isBusy ? "Sending..." : "Send Now"}
                            </Button>
                          </>
                        )}
                      <Button
                        size="icon-xs"
                        variant="ghost"
                        onClick={async () => {
                          await deleteQueueItem(item.id);
                          await onChanged();
                        }}
                      >
                        <Trash2 className="size-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
