use lettre::transport::smtp::authentication::Credentials;
use lettre::{Message, SmtpTransport, Transport};
use mailparse::{parse_mail, MailHeaderMap, ParsedMail};
use native_tls::TlsConnector;
use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize, Clone)]
pub struct MailboxConfig {
    pub email: String,
    pub smtp_host: String,
    pub smtp_port: u16,
    pub smtp_security: String, // "tls" | "starttls"
    pub imap_host: String,
    pub imap_port: u16,
    pub username: String,
    pub password: String,
}

#[derive(Debug, Serialize)]
pub struct InboxMessage {
    pub uid: u32,
    pub subject: String,
    pub from: String,
    pub date: String,
    pub snippet: String,
    pub body_text: String,
    pub body_html: String,
}

fn extract_bodies(parsed: &ParsedMail, text_out: &mut String, html_out: &mut String) {
    if parsed.subparts.is_empty() {
        let mime = parsed.ctype.mimetype.to_lowercase();
        if mime == "text/plain" && text_out.is_empty() {
            if let Ok(body) = parsed.get_body() {
                *text_out = body;
            }
        } else if mime == "text/html" && html_out.is_empty() {
            if let Ok(body) = parsed.get_body() {
                *html_out = body;
            }
        }
    } else {
        for part in &parsed.subparts {
            extract_bodies(part, text_out, html_out);
        }
    }
}

fn build_smtp_transport(config: &MailboxConfig) -> Result<SmtpTransport, String> {
    let creds = Credentials::new(config.username.clone(), config.password.clone());
    let builder = if config.smtp_security == "starttls" {
        SmtpTransport::starttls_relay(&config.smtp_host)
            .map_err(|e| format!("SMTP STARTTLS error: {}", e))?
    } else {
        SmtpTransport::relay(&config.smtp_host)
            .map_err(|e| format!("SMTP TLS error: {}", e))?
    };

    Ok(builder.port(config.smtp_port).credentials(creds).build())
}

fn connect_imap(
    config: &MailboxConfig,
) -> Result<imap::Session<native_tls::TlsStream<std::net::TcpStream>>, String> {
    let tls = TlsConnector::builder()
        .build()
        .map_err(|e| format!("TLS init failed: {}", e))?;

    let client = imap::connect(
        (config.imap_host.as_str(), config.imap_port),
        &config.imap_host,
        &tls,
    )
    .map_err(|e| format!("IMAP connect failed: {}", e))?;

    let session = client
        .login(&config.username, &config.password)
        .map_err(|(e, _)| format!("IMAP login failed: {}", e))?;

    Ok(session)
}

#[tauri::command]
pub async fn test_mailbox_connection(config: MailboxConfig) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let mailer = build_smtp_transport(&config)?;
        let smtp_ok = mailer
            .test_connection()
            .map_err(|e| format!("SMTP connection test failed: {}", e))?;
        if !smtp_ok {
            return Err("SMTP server rejected connection test.".to_string());
        }

        let mut imap_session = connect_imap(&config)?;
        let _ = imap_session.logout();

        Ok("SMTP and IMAP connections verified.".to_string())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[tauri::command]
pub async fn send_smtp_email(
    config: MailboxConfig,
    to: String,
    subject: String,
    body: String,
) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let email = Message::builder()
            .from(
                config
                    .email
                    .parse()
                    .map_err(|e| format!("Invalid sender email: {}", e))?,
            )
            .to(to
                .parse()
                .map_err(|e| format!("Invalid recipient email: {}", e))?)
            .subject(subject)
            .body(body)
            .map_err(|e| format!("Failed to build email: {}", e))?;

        let mailer = build_smtp_transport(&config)?;
        mailer
            .send(&email)
            .map_err(|e| format!("Failed to send email: {}", e))?;

        Ok("Email sent.".to_string())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[tauri::command]
pub async fn fetch_imap_inbox(
    config: MailboxConfig,
    limit: usize,
    since_uid: Option<u32>,
) -> Result<Vec<InboxMessage>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let mut session = connect_imap(&config)?;
        let mailbox = session
            .select("INBOX")
            .map_err(|e| format!("Failed to select INBOX: {}", e))?;

        let total = mailbox.exists;
        if total == 0 {
            let _ = session.logout();
            return Ok(Vec::new());
        }

        let messages = if let Some(last_uid) = since_uid {
            let range = format!("{}:*", last_uid.saturating_add(1));
            session
                .uid_fetch(range, "(UID RFC822)")
                .map_err(|e| format!("Failed to fetch new messages: {}", e))?
        } else {
            let start = if total > limit as u32 {
                total - limit as u32 + 1
            } else {
                1
            };
            let range = format!("{}:{}", start, total);
            session
                .fetch(range, "(UID RFC822)")
                .map_err(|e| format!("Failed to fetch messages: {}", e))?
        };

        let mut results = Vec::new();
        for msg in messages.iter() {
            let uid = msg.uid.unwrap_or(0);
            if let Some(last_uid) = since_uid {
                if uid <= last_uid {
                    continue;
                }
            }
            if let Some(raw) = msg.body() {
                if let Ok(parsed) = parse_mail(raw) {
                    let headers = parsed.get_headers();
                    let subject = headers
                        .get_first_value("Subject")
                        .unwrap_or_else(|| "(No subject)".to_string());
                    let from = headers
                        .get_first_value("From")
                        .unwrap_or_else(|| "Unknown".to_string());
                    let date = headers
                        .get_first_value("Date")
                        .unwrap_or_else(|| "".to_string());

                    let mut body_text = String::new();
                    let mut body_html = String::new();
                    extract_bodies(&parsed, &mut body_text, &mut body_html);

                    if body_text.is_empty() && body_html.is_empty() {
                        body_text = parsed.get_body().unwrap_or_default();
                    }

                    let snippet_source = if !body_text.is_empty() {
                        body_text.clone()
                    } else {
                        body_html.replace(|c: char| c == '<' || c == '>', " ")
                    };
                    let snippet: String = snippet_source
                        .split_whitespace()
                        .collect::<Vec<_>>()
                        .join(" ")
                        .chars()
                        .take(180)
                        .collect();

                    results.push(InboxMessage {
                        uid,
                        subject,
                        from,
                        date,
                        snippet,
                        body_text,
                        body_html,
                    });
                }
            }
        }

        results.reverse();
        let _ = session.logout();
        Ok(results)
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[tauri::command]
pub async fn delete_imap_message(config: MailboxConfig, uid: u32) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let mut session = connect_imap(&config)?;
        session
            .select("INBOX")
            .map_err(|e| format!("Failed to select INBOX: {}", e))?;

        session
            .uid_store(uid.to_string(), "+FLAGS (\\Deleted)")
            .map_err(|e| format!("Failed to mark message deleted: {}", e))?;
        session
            .expunge()
            .map_err(|e| format!("Failed to expunge: {}", e))?;

        let _ = session.logout();
        Ok(())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}
