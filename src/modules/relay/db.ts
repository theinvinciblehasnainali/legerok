import { invoke } from "@tauri-apps/api/core";
import { v4 as uuidv4 } from "uuid";
import { getDb } from "@/lib/db";
import type {
  CampaignMode,
  CampaignStatus,
  InboxMessage,
  QueueStatus,
  RelayCampaign,
  RelayEmailQueueItem,
  RelayMailbox,
  RelaySequenceStep,
} from "./types";

// --- Mailboxes ---

export async function getMailboxes(): Promise<RelayMailbox[]> {
  const db = await getDb();
  return await db.select<RelayMailbox[]>(
    "SELECT * FROM relay_mailboxes ORDER BY created_at DESC"
  );
}

export async function createMailbox(
  input: Omit<RelayMailbox, "id" | "created_at" | "updated_at">
): Promise<RelayMailbox> {
  const db = await getDb();
  const id = uuidv4();
  const now = new Date().toISOString();

  await db.execute(
    `INSERT INTO relay_mailboxes
      (id, name, provider, email, smtp_host, smtp_port, smtp_security, imap_host, imap_port, username, password, daily_limit, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
    [
      id,
      input.name,
      input.provider,
      input.email,
      input.smtp_host,
      input.smtp_port,
      input.smtp_security,
      input.imap_host,
      input.imap_port,
      input.username,
      input.password,
      input.daily_limit,
      now,
      now,
    ]
  );

  const rows = await db.select<RelayMailbox[]>(
    "SELECT * FROM relay_mailboxes WHERE id = $1",
    [id]
  );
  return rows[0];
}

export async function deleteMailbox(id: string): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM relay_mailboxes WHERE id = $1", [id]);
}

function toRustConfig(m: Pick<
  RelayMailbox,
  | "email"
  | "smtp_host"
  | "smtp_port"
  | "smtp_security"
  | "imap_host"
  | "imap_port"
  | "username"
  | "password"
>) {
  return {
    email: m.email,
    smtp_host: m.smtp_host,
    smtp_port: m.smtp_port,
    smtp_security: m.smtp_security,
    imap_host: m.imap_host,
    imap_port: m.imap_port,
    username: m.username,
    password: m.password,
  };
}

export async function testMailboxConnection(
  mailbox: Pick<
    RelayMailbox,
    | "email"
    | "smtp_host"
    | "smtp_port"
    | "smtp_security"
    | "imap_host"
    | "imap_port"
    | "username"
    | "password"
  >
): Promise<string> {
  return await invoke<string>("test_mailbox_connection", {
    config: toRustConfig(mailbox),
  });
}

export async function sendEmailViaMailbox(
  mailbox: RelayMailbox,
  to: string,
  subject: string,
  body: string
): Promise<string> {
  return await invoke<string>("send_smtp_email", {
    config: toRustConfig(mailbox),
    to,
    subject,
    body,
  });
}

export async function fetchMailboxInbox(
  mailbox: RelayMailbox,
  limit = 25
): Promise<InboxMessage[]> {
  return await invoke<InboxMessage[]>("fetch_imap_inbox", {
    config: toRustConfig(mailbox),
    limit,
  });
}

export async function deleteMailboxMessage(
  mailbox: RelayMailbox,
  uid: number
): Promise<void> {
  await invoke<void>("delete_imap_message", {
    config: toRustConfig(mailbox),
    uid,
  });
}

// --- Campaigns ---

export async function getCampaigns(): Promise<RelayCampaign[]> {
  const db = await getDb();
  return await db.select<RelayCampaign[]>(
    "SELECT * FROM relay_campaigns ORDER BY created_at DESC"
  );
}

export async function createCampaign(input: {
  name: string;
  board_id: string;
  mailbox_id: string;
  mode: CampaignMode;
  email_field_key: string;
  status_field_key?: string | null;
}): Promise<RelayCampaign> {
  const db = await getDb();
  const id = uuidv4();
  const now = new Date().toISOString();

  await db.execute(
    `INSERT INTO relay_campaigns
      (id, name, board_id, mailbox_id, mode, status, email_field_key, status_field_key, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      id,
      input.name,
      input.board_id,
      input.mailbox_id,
      input.mode,
      "draft",
      input.email_field_key,
      input.status_field_key ?? null,
      now,
      now,
    ]
  );

  const rows = await db.select<RelayCampaign[]>(
    "SELECT * FROM relay_campaigns WHERE id = $1",
    [id]
  );
  return rows[0];
}

export async function updateCampaignStatus(
  id: string,
  status: CampaignStatus
): Promise<void> {
  const db = await getDb();
  await db.execute(
    "UPDATE relay_campaigns SET status = $1, updated_at = $2 WHERE id = $3",
    [status, new Date().toISOString(), id]
  );
}

export async function deleteCampaign(id: string): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM relay_campaigns WHERE id = $1", [id]);
}

// --- Sequence Steps ---

export async function getSequenceSteps(
  campaignId: string
): Promise<RelaySequenceStep[]> {
  const db = await getDb();
  return await db.select<RelaySequenceStep[]>(
    "SELECT * FROM relay_sequence_steps WHERE campaign_id = $1 ORDER BY step_order ASC",
    [campaignId]
  );
}

export async function createSequenceStep(input: {
  campaign_id: string;
  step_order: number;
  delay_days: number;
  subject_template: string;
  body_template: string;
}): Promise<RelaySequenceStep> {
  const db = await getDb();
  const id = uuidv4();
  const now = new Date().toISOString();

  await db.execute(
    `INSERT INTO relay_sequence_steps
      (id, campaign_id, step_order, delay_days, subject_template, body_template, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      id,
      input.campaign_id,
      input.step_order,
      input.delay_days,
      input.subject_template,
      input.body_template,
      now,
      now,
    ]
  );

  const rows = await db.select<RelaySequenceStep[]>(
    "SELECT * FROM relay_sequence_steps WHERE id = $1",
    [id]
  );
  return rows[0];
}

export async function deleteSequenceStep(id: string): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM relay_sequence_steps WHERE id = $1", [id]);
}

// --- Email Queue ---

export async function getQueueItems(
  campaignId?: string
): Promise<RelayEmailQueueItem[]> {
  const db = await getDb();
  if (campaignId) {
    return await db.select<RelayEmailQueueItem[]>(
      "SELECT * FROM relay_email_queue WHERE campaign_id = $1 ORDER BY created_at DESC",
      [campaignId]
    );
  }
  return await db.select<RelayEmailQueueItem[]>(
    "SELECT * FROM relay_email_queue ORDER BY created_at DESC"
  );
}

export async function enqueueEmail(input: {
  campaign_id: string;
  record_id: string;
  mailbox_id: string;
  step_id?: string | null;
  to_email: string;
  subject: string;
  body: string;
  status: QueueStatus;
  scheduled_at?: string | null;
}): Promise<RelayEmailQueueItem> {
  const db = await getDb();
  const id = uuidv4();
  const now = new Date().toISOString();

  await db.execute(
    `INSERT INTO relay_email_queue
      (id, campaign_id, record_id, mailbox_id, step_id, to_email, subject, body, status, scheduled_at, sent_at, error_message, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NULL, NULL, $11, $12)`,
    [
      id,
      input.campaign_id,
      input.record_id,
      input.mailbox_id,
      input.step_id ?? null,
      input.to_email,
      input.subject,
      input.body,
      input.status,
      input.scheduled_at ?? null,
      now,
      now,
    ]
  );

  const rows = await db.select<RelayEmailQueueItem[]>(
    "SELECT * FROM relay_email_queue WHERE id = $1",
    [id]
  );
  return rows[0];
}

export async function updateQueueItem(
  id: string,
  patch: Partial<
    Pick<
      RelayEmailQueueItem,
      "subject" | "body" | "status" | "scheduled_at" | "sent_at" | "error_message"
    >
  >
): Promise<void> {
  const db = await getDb();
  const rows = await db.select<RelayEmailQueueItem[]>(
    "SELECT * FROM relay_email_queue WHERE id = $1",
    [id]
  );
  const existing = rows[0];
  if (!existing) return;

  const now = new Date().toISOString();
  await db.execute(
    `UPDATE relay_email_queue
     SET subject = $1, body = $2, status = $3, scheduled_at = $4, sent_at = $5, error_message = $6, updated_at = $7
     WHERE id = $8`,
    [
      patch.subject ?? existing.subject,
      patch.body ?? existing.body,
      patch.status ?? existing.status,
      patch.scheduled_at !== undefined ? patch.scheduled_at : existing.scheduled_at,
      patch.sent_at !== undefined ? patch.sent_at : existing.sent_at,
      patch.error_message !== undefined
        ? patch.error_message
        : existing.error_message,
      now,
      id,
    ]
  );
}

export async function deleteQueueItem(id: string): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM relay_email_queue WHERE id = $1", [id]);
}
