export type MailboxProvider =
  | "hostinger"
  | "gmail"
  | "outlook"
  | "zoho"
  | "spacemail"
  | "namecheap"
  | "proton_bridge"
  | "custom";

export type SmtpSecurity = "tls" | "starttls";

export interface RelayMailbox {
  id: string;
  name: string;
  provider: MailboxProvider;
  email: string;
  smtp_host: string;
  smtp_port: number;
  smtp_security: SmtpSecurity;
  imap_host: string;
  imap_port: number;
  username: string;
  password: string;
  daily_limit: number;
  created_at: string;
  updated_at: string;
}

export type CampaignMode = "hitl" | "auto";
export type CampaignStatus = "draft" | "active" | "paused" | "completed";

export interface RelayCampaign {
  id: string;
  name: string;
  board_id: string;
  mailbox_id: string;
  mode: CampaignMode;
  status: CampaignStatus;
  email_field_key: string;
  status_field_key: string | null;
  created_at: string;
  updated_at: string;
}

export interface RelaySequenceStep {
  id: string;
  campaign_id: string;
  step_order: number;
  delay_days: number;
  subject_template: string;
  body_template: string;
  created_at: string;
  updated_at: string;
}

export type QueueStatus =
  | "draft"
  | "pending_approval"
  | "scheduled"
  | "sending"
  | "sent"
  | "failed";

export interface RelayEmailQueueItem {
  id: string;
  campaign_id: string;
  record_id: string;
  mailbox_id: string;
  step_id: string | null;
  to_email: string;
  subject: string;
  body: string;
  status: QueueStatus;
  scheduled_at: string | null;
  sent_at: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface InboxMessage {
  uid: number;
  subject: string;
  from: string;
  date: string;
  snippet: string;
}
