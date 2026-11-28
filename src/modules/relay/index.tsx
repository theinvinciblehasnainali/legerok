import { useEffect, useState } from "react";
import type { LegeRokModule, LegeRokSDK } from "@/sdk/types";
import type {
  RelayCampaign,
  RelayEmailQueueItem,
  RelayMailbox,
} from "./types";
import {
  getCampaigns,
  getMailboxes,
  getQueueItems,
  sendEmailViaMailbox,
  updateQueueItem,
} from "./db";
import { MailboxesView } from "./components/MailboxesView";
import { CampaignsView } from "./components/CampaignsView";
import { Button } from "@/components/ui/button";
import { Mail, Workflow } from "lucide-react";

type RelayTab = "campaigns" | "mailboxes";

function RelayDashboard({ sdk }: { sdk: LegeRokSDK }) {
  const [tab, setTab] = useState<RelayTab>("mailboxes");
  const [mailboxes, setMailboxes] = useState<RelayMailbox[]>([]);
  const [campaigns, setCampaigns] = useState<RelayCampaign[]>([]);
  const [queue, setQueue] = useState<RelayEmailQueueItem[]>([]);

  async function loadAll() {
    const [m, c, q] = await Promise.all([
      getMailboxes(),
      getCampaigns(),
      getQueueItems(),
    ]);
    setMailboxes(m);
    setCampaigns(c);
    setQueue(q);
  }

  useEffect(() => {
    void loadAll();
  }, []);

  // Lightweight background scheduler for auto-scheduled emails while app is open
  useEffect(() => {
    const timer = setInterval(async () => {
      const now = new Date();
      const due = queue.filter(
        (item) =>
          item.status === "scheduled" &&
          item.scheduled_at &&
          new Date(item.scheduled_at) <= now
      );
      if (due.length === 0) return;

      for (const item of due) {
        const mb = mailboxes.find((m) => m.id === item.mailbox_id);
        if (!mb) continue;
        try {
          await updateQueueItem(item.id, { status: "sending" });
          await sendEmailViaMailbox(mb, item.to_email, item.subject, item.body);
          await updateQueueItem(item.id, {
            status: "sent",
            sent_at: new Date().toISOString(),
          });
        } catch (err) {
          await updateQueueItem(item.id, {
            status: "failed",
            error_message: err instanceof Error ? err.message : String(err),
          });
        }
      }
      await loadAll();
    }, 30_000);

    return () => clearInterval(timer);
  }, [queue, mailboxes]);

  const pendingCount = queue.filter(
    (q) => q.status === "pending_approval"
  ).length;

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">LegeRok Relay</h1>
          <p className="text-sm text-muted-foreground">
            Email Automation &amp; Sequencing
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <Button
            size="sm"
            variant={tab === "campaigns" ? "default" : "outline"}
            onClick={() => setTab("campaigns")}
          >
            <Workflow className="size-4" />
            Campaigns
          </Button>
          <Button
            size="sm"
            variant={tab === "mailboxes" ? "default" : "outline"}
            onClick={() => setTab("mailboxes")}
          >
            <Mail className="size-4" />
            Mailboxes ({mailboxes.length})
            {pendingCount > 0 ? ` · ${pendingCount} pending` : ""}
          </Button>
        </div>
      </div>

      {tab === "campaigns" && (
        <CampaignsView
          sdk={sdk}
          mailboxes={mailboxes}
          campaigns={campaigns}
          onChanged={loadAll}
          onGoToOutbox={() => setTab("mailboxes")}
        />
      )}
      {tab === "mailboxes" && (
        <MailboxesView
          mailboxes={mailboxes}
          queue={queue}
          onChanged={loadAll}
        />
      )}
    </div>
  );
}

export const relayModule: LegeRokModule = {
  id: "relay",
  name: "LegeRok Relay",
  tagline: "Email Automation & Sequencing",
  description:
    "Connect any mailbox via SMTP/IMAP, link LegeRok boards to multi-step campaigns, and send with HITL approval or scheduled automation.",
  version: "0.1.0",
  navLabel: "Relay",
  renderView: (sdk) => <RelayDashboard sdk={sdk} />,
};
