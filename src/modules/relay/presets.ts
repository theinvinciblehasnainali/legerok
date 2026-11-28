import type { MailboxProvider, SmtpSecurity } from "./types";

export interface ProviderPreset {
  id: MailboxProvider;
  label: string;
  smtp_host: string;
  smtp_port: number;
  smtp_security: SmtpSecurity;
  imap_host: string;
  imap_port: number;
  note?: string;
}

export const MAILBOX_PRESETS: ProviderPreset[] = [
  {
    id: "hostinger",
    label: "Hostinger Mail",
    smtp_host: "smtp.hostinger.com",
    smtp_port: 465,
    smtp_security: "tls",
    imap_host: "imap.hostinger.com",
    imap_port: 993,
  },
  {
    id: "gmail",
    label: "Gmail (App Password)",
    smtp_host: "smtp.gmail.com",
    smtp_port: 465,
    smtp_security: "tls",
    imap_host: "imap.gmail.com",
    imap_port: 993,
    note: "Use a Google App Password (requires 2-Step Verification).",
  },
  {
    id: "outlook",
    label: "Outlook / Microsoft 365",
    smtp_host: "smtp.office365.com",
    smtp_port: 587,
    smtp_security: "starttls",
    imap_host: "outlook.office365.com",
    imap_port: 993,
  },
  {
    id: "zoho",
    label: "Zoho Mail",
    smtp_host: "smtp.zoho.com",
    smtp_port: 465,
    smtp_security: "tls",
    imap_host: "imap.zoho.com",
    imap_port: 993,
  },
  {
    id: "spacemail",
    label: "Spacemail (Spaceship)",
    smtp_host: "mail.spacemail.com",
    smtp_port: 465,
    smtp_security: "tls",
    imap_host: "mail.spacemail.com",
    imap_port: 993,
  },
  {
    id: "namecheap",
    label: "Namecheap Private Email",
    smtp_host: "mail.privateemail.com",
    smtp_port: 465,
    smtp_security: "tls",
    imap_host: "mail.privateemail.com",
    imap_port: 993,
  },
  {
    id: "proton_bridge",
    label: "Proton Mail (via Bridge)",
    smtp_host: "127.0.0.1",
    smtp_port: 1025,
    smtp_security: "starttls",
    imap_host: "127.0.0.1",
    imap_port: 1143,
    note: "Requires Proton Mail Bridge running locally.",
  },
  {
    id: "custom",
    label: "Custom SMTP / IMAP",
    smtp_host: "",
    smtp_port: 465,
    smtp_security: "tls",
    imap_host: "",
    imap_port: 993,
  },
];
