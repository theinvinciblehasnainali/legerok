import { createBoard, getBoards } from "@/lib/boards";
import { createField, getFields } from "@/lib/fields";
import {
  createRecord,
  deleteRecord,
  getRecords,
  parseRecordData,
  updateRecord,
} from "@/lib/records";
import {
  enqueueEmail,
  getCampaigns,
  getMailboxes,
  getQueueItems,
  sendEmailViaMailbox,
  updateQueueItem,
} from "@/modules/relay/db";
import type { FieldType, RecordData } from "@/types";

export interface AppTool {
  name: string;
  description: string;
  requiresConfirmation?: boolean;
  parameters: {
    type: "object";
    properties: { [key: string]: unknown };
    required?: string[];
  };
  execute: (args: { [key: string]: unknown }) => Promise<unknown>;
}

export function getRegisteredTools(
  enabledModuleIds: string[],
  onDataMutated?: () => Promise<void>
): AppTool[] {
  const tools: AppTool[] = [
    {
      name: "list_boards",
      description: "List all boards in LegeRok with their IDs and names.",
      parameters: { type: "object", properties: {} },
      execute: async () => await getBoards(),
    },
    {
      name: "create_board",
      description: "Create a new board in LegeRok.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Board name" },
          description: { type: "string", description: "Optional description" },
        },
        required: ["name"],
      },
      execute: async (args) => {
        const board = await createBoard(
          String(args.name),
          args.description ? String(args.description) : undefined
        );
        if (onDataMutated) await onDataMutated();
        return board;
      },
    },
    {
      name: "get_board_schema",
      description: "Get all fields (columns) for a specific board.",
      parameters: {
        type: "object",
        properties: {
          board_id: { type: "string", description: "The board ID" },
        },
        required: ["board_id"],
      },
      execute: async (args) => await getFields(String(args.board_id)),
    },
    {
      name: "add_field",
      description: "Add a new field (column) to a board.",
      parameters: {
        type: "object",
        properties: {
          board_id: { type: "string" },
          name: { type: "string" },
          type: {
            type: "string",
            enum: [
              "text",
              "long_text",
              "email",
              "phone",
              "number",
              "date",
              "datetime",
              "single_select",
              "multi_select",
              "checkbox",
              "url",
            ],
          },
          choices: {
            type: "array",
            items: { type: "string" },
            description: "Allowed choices for single_select or multi_select",
          },
          required: { type: "boolean" },
        },
        required: ["board_id", "name", "type"],
      },
      execute: async (args) => {
        const choices = Array.isArray(args.choices)
          ? args.choices.map(String)
          : undefined;
        const field = await createField(String(args.board_id), {
          name: String(args.name),
          type: String(args.type) as FieldType,
          options: choices ? { choices } : null,
          required: Boolean(args.required),
        });
        if (onDataMutated) await onDataMutated();
        return field;
      },
    },
    {
      name: "query_records",
      description: "List or search records in a board.",
      parameters: {
        type: "object",
        properties: {
          board_id: { type: "string" },
          search: {
            type: "string",
            description: "Optional case-insensitive text search across all fields",
          },
        },
        required: ["board_id"],
      },
      execute: async (args) => {
        const records = await getRecords(String(args.board_id));
        const q = args.search ? String(args.search).toLowerCase() : "";
        return records
          .map((r) => ({ id: r.id, ...parseRecordData(r.data) }))
          .filter((row) =>
            q ? JSON.stringify(row).toLowerCase().includes(q) : true
          );
      },
    },
    {
      name: "create_record",
      description: "Create a new record in a board using field keys.",
      parameters: {
        type: "object",
        properties: {
          board_id: { type: "string" },
          data: {
            type: "object",
            description: "Key-value map matching the board's field keys",
          },
        },
        required: ["board_id", "data"],
      },
      execute: async (args) => {
        const rec = await createRecord(
          String(args.board_id),
          (args.data ?? {}) as RecordData
        );
        if (onDataMutated) await onDataMutated();
        return rec;
      },
    },
    {
      name: "update_record",
      description: "Update an existing record's data.",
      parameters: {
        type: "object",
        properties: {
          record_id: { type: "string" },
          data: { type: "object" },
        },
        required: ["record_id", "data"],
      },
      execute: async (args) => {
        const rec = await updateRecord(
          String(args.record_id),
          (args.data ?? {}) as RecordData
        );
        if (onDataMutated) await onDataMutated();
        return rec;
      },
    },
    {
      name: "delete_record",
      description: "Permanently delete a record by ID.",
      requiresConfirmation: true,
      parameters: {
        type: "object",
        properties: {
          record_id: { type: "string" },
        },
        required: ["record_id"],
      },
      execute: async (args) => {
        await deleteRecord(String(args.record_id));
        if (onDataMutated) await onDataMutated();
        return { deleted: true, record_id: args.record_id };
      },
    },
  ];

  if (enabledModuleIds.includes("relay")) {
    tools.push(
      {
        name: "relay_list_mailboxes",
        description: "List connected email mailboxes in LegeRok Relay.",
        parameters: { type: "object", properties: {} },
        execute: async () => {
          const list = await getMailboxes();
          return list.map((m) => ({
            id: m.id,
            name: m.name,
            email: m.email,
            provider: m.provider,
          }));
        },
      },
      {
        name: "relay_list_campaigns",
        description: "List all email campaigns in LegeRok Relay.",
        parameters: { type: "object", properties: {} },
        execute: async () => await getCampaigns(),
      },
      {
        name: "relay_list_queue",
        description: "List queued/drafted/sent emails in LegeRok Relay.",
        parameters: {
          type: "object",
          properties: {
            campaign_id: { type: "string" },
          },
        },
        execute: async (args) =>
          await getQueueItems(
            args.campaign_id ? String(args.campaign_id) : undefined
          ),
      },
      {
        name: "relay_queue_draft_email",
        description:
          "Draft a personalized email and place it in Relay's Outbox with status pending_approval for human review.",
        parameters: {
          type: "object",
          properties: {
            campaign_id: { type: "string" },
            record_id: { type: "string" },
            mailbox_id: { type: "string" },
            to_email: { type: "string" },
            subject: { type: "string" },
            body: { type: "string" },
          },
          required: [
            "campaign_id",
            "record_id",
            "mailbox_id",
            "to_email",
            "subject",
            "body",
          ],
        },
        execute: async (args) =>
          await enqueueEmail({
            campaign_id: String(args.campaign_id),
            record_id: String(args.record_id),
            mailbox_id: String(args.mailbox_id),
            to_email: String(args.to_email),
            subject: String(args.subject),
            body: String(args.body),
            status: "pending_approval",
          }),
      },
      {
        name: "relay_send_queued_email",
        description: "Immediately send a queued email via SMTP.",
        requiresConfirmation: true,
        parameters: {
          type: "object",
          properties: {
            queue_id: { type: "string" },
          },
          required: ["queue_id"],
        },
        execute: async (args) => {
          const queue = await getQueueItems();
          const item = queue.find((q) => q.id === String(args.queue_id));
          if (!item) throw new Error("Queue item not found");
          const mailboxes = await getMailboxes();
          const mb = mailboxes.find((m) => m.id === item.mailbox_id);
          if (!mb) throw new Error("Mailbox not found");

          await sendEmailViaMailbox(mb, item.to_email, item.subject, item.body);
          await updateQueueItem(item.id, {
            status: "sent",
            sent_at: new Date().toISOString(),
          });
          return { sent: true, to: item.to_email };
        },
      }
    );
  }

  return tools;
}
