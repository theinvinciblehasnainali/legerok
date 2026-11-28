import { useEffect, useState } from "react";
import type { Board, Field, RecordData } from "@/types";
import type { LegeRokSDK } from "@/sdk/types";
import type {
  CampaignMode,
  RelayCampaign,
  RelayMailbox,
  RelaySequenceStep,
} from "../types";
import {
  createCampaign,
  createSequenceStep,
  deleteCampaign,
  deleteSequenceStep,
  enqueueEmail,
  getSequenceSteps,
  updateCampaignStatus,
} from "../db";
import { parseRecordData } from "@/lib/records";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Play, Plus, Send, Trash2, X } from "lucide-react";

interface CampaignsViewProps {
  sdk: LegeRokSDK;
  mailboxes: RelayMailbox[];
  campaigns: RelayCampaign[];
  onChanged: () => Promise<void>;
  onGoToOutbox: () => void;
}

function interpolateTemplate(template: string, data: RecordData): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => {
    const val = data[key];
    if (val === undefined || val === null) return "";
    return Array.isArray(val) ? val.join(", ") : String(val);
  });
}

export function CampaignsView({
  sdk,
  mailboxes,
  campaigns,
  onChanged,
  onGoToOutbox,
}: CampaignsViewProps) {
  const [boards, setBoards] = useState<Board[]>([]);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [stepModalOpen, setStepModalOpen] = useState(false);

  const [name, setName] = useState("");
  const [boardId, setBoardId] = useState("");
  const [boardFields, setBoardFields] = useState<Field[]>([]);
  const [mailboxId, setMailboxId] = useState(mailboxes[0]?.id ?? "");
  const [emailFieldKey, setEmailFieldKey] = useState("");
  const [mode, setMode] = useState<CampaignMode>("hitl");
  const [creating, setCreating] = useState(false);

  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(
    campaigns[0]?.id ?? null
  );
  const [steps, setSteps] = useState<RelaySequenceStep[]>([]);
  const [selectedBoardFields, setSelectedBoardFields] = useState<Field[]>([]);

  const [stepDelayDays, setStepDelayDays] = useState(0);
  const [stepSubject, setStepSubject] = useState("");
  const [stepBody, setStepBody] = useState("");
  const [addingStep, setAddingStep] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<RelayCampaign | null>(null);

  useEffect(() => {
    void sdk.boards.list().then((list) => {
      setBoards(list);
      if (list.length > 0 && !boardId) setBoardId(list[0].id);
    });
  }, [sdk]);

  useEffect(() => {
    if (!boardId) {
      setBoardFields([]);
      return;
    }
    void sdk.fields.listByBoard(boardId).then((fields) => {
      setBoardFields(fields);
      const emailField =
        fields.find((f) => f.type === "email") ?? fields[0];
      setEmailFieldKey(emailField?.key ?? "");
    });
  }, [boardId, sdk]);

  const selectedCampaign =
    campaigns.find((c) => c.id === selectedCampaignId) ?? campaigns[0] ?? null;

  useEffect(() => {
    if (!selectedCampaign) {
      setSteps([]);
      setSelectedBoardFields([]);
      return;
    }
    void Promise.all([
      getSequenceSteps(selectedCampaign.id),
      sdk.fields.listByBoard(selectedCampaign.board_id),
    ]).then(([s, f]) => {
      setSteps(s);
      setSelectedBoardFields(f);
    });
  }, [selectedCampaign?.id, sdk]);

  async function handleCreateCampaign(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !boardId || !mailboxId || !emailFieldKey) return;
    setCreating(true);
    try {
      const created = await createCampaign({
        name: name.trim(),
        board_id: boardId,
        mailbox_id: mailboxId,
        mode,
        email_field_key: emailFieldKey,
      });
      setName("");
      setCreateModalOpen(false);
      await onChanged();
      setSelectedCampaignId(created.id);
    } finally {
      setCreating(false);
    }
  }

  async function handleAddStep(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCampaign || !stepSubject.trim() || !stepBody.trim()) return;
    setAddingStep(true);
    try {
      await createSequenceStep({
        campaign_id: selectedCampaign.id,
        step_order: steps.length,
        delay_days: Number(stepDelayDays) || 0,
        subject_template: stepSubject.trim(),
        body_template: stepBody.trim(),
      });
      setStepSubject("");
      setStepBody("");
      setStepDelayDays(steps.length === 0 ? 0 : 3);
      setStepModalOpen(false);
      const updated = await getSequenceSteps(selectedCampaign.id);
      setSteps(updated);
    } finally {
      setAddingStep(false);
    }
  }

  async function handleGenerateQueue() {
    if (!selectedCampaign || steps.length === 0) return;
    setGenerating(true);
    setNotice(null);
    try {
      const records = await sdk.records.listByBoard(selectedCampaign.board_id);
      let queuedCount = 0;

      for (const rec of records) {
        const data = parseRecordData(rec.data);
        const rawEmail = data[selectedCampaign.email_field_key];
        const toEmail = typeof rawEmail === "string" ? rawEmail.trim() : "";
        if (!toEmail || !toEmail.includes("@")) continue;

        for (const step of steps) {
          const subject = interpolateTemplate(step.subject_template, data);
          const body = interpolateTemplate(step.body_template, data);
          const scheduledDate = new Date();
          scheduledDate.setDate(scheduledDate.getDate() + step.delay_days);

          await enqueueEmail({
            campaign_id: selectedCampaign.id,
            record_id: rec.id,
            mailbox_id: selectedCampaign.mailbox_id,
            step_id: step.id,
            to_email: toEmail,
            subject,
            body,
            status:
              selectedCampaign.mode === "auto"
                ? "scheduled"
                : "pending_approval",
            scheduled_at:
              selectedCampaign.mode === "auto"
                ? scheduledDate.toISOString()
                : null,
          });
          queuedCount++;
        }
      }

      await updateCampaignStatus(selectedCampaign.id, "active");
      await onChanged();
      setNotice(
        `Queued ${queuedCount} emails (${
          selectedCampaign.mode === "auto" ? "scheduled" : "awaiting approval"
        }).`
      );
    } finally {
      setGenerating(false);
    }
  }

  if (mailboxes.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Connect a mailbox in the Mailboxes tab before creating a campaign.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium">Campaigns &amp; Sequences</h2>
          <p className="text-sm text-muted-foreground">
            Link a LegeRok board to a mailbox and define multi-step email sequences.
          </p>
        </div>
        <Button size="sm" onClick={() => setCreateModalOpen(true)}>
          <Plus className="size-4" />
          New Campaign
        </Button>
      </div>

      {campaigns.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center space-y-3">
            <p className="text-sm text-muted-foreground">
              No campaigns yet. Click &ldquo;New Campaign&rdquo; to link a board.
            </p>
            <Button size="sm" onClick={() => setCreateModalOpen(true)}>
              <Plus className="size-4" />
              New Campaign
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Campaign List */}
          <div className="space-y-2">
            {campaigns.map((camp) => (
              <Card
                key={camp.id}
                onClick={() => setSelectedCampaignId(camp.id)}
                className={`cursor-pointer transition-all ${
                  selectedCampaign?.id === camp.id
                    ? "ring-2 ring-primary"
                    : "hover:ring-primary/40"
                }`}
              >
                <CardContent className="py-3.5 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{camp.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {camp.mode === "hitl" ? "HITL Approval" : "Auto-Schedule"} ·{" "}
                      {camp.status}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmDelete(camp);
                    }}
                  >
                    <Trash2 className="size-3.5 text-destructive" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Selected Campaign Sequence Builder */}
          {selectedCampaign && (
            <div className="lg:col-span-2 space-y-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-base">
                      {selectedCampaign.name} — Sequence
                    </CardTitle>
                    <CardDescription>
                      Use{" "}
                      {selectedBoardFields
                        .slice(0, 5)
                        .map((f) => `{{${f.key}}}`)
                        .join(", ")}{" "}
                      to personalize from board records.
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setStepDelayDays(steps.length === 0 ? 0 : 3);
                        setStepModalOpen(true);
                      }}
                    >
                      <Plus className="size-3.5" />
                      Add Step
                    </Button>
                    <Button
                      size="sm"
                      disabled={generating || steps.length === 0}
                      onClick={() => void handleGenerateQueue()}
                    >
                      <Play className="size-3.5" />
                      {generating ? "Queueing..." : "Queue from Board"}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {notice && (
                    <div className="p-3 rounded-xl border bg-primary/10 border-primary/30 text-sm flex items-center justify-between">
                      <span>{notice}</span>
                      <Button size="xs" onClick={onGoToOutbox}>
                        <Send className="size-3" />
                        View Outbox
                      </Button>
                    </div>
                  )}

                  {steps.length === 0 ? (
                    <div className="py-8 text-center text-sm text-muted-foreground border rounded-xl space-y-2">
                      <p>No sequence steps yet.</p>
                      <Button
                        size="xs"
                        variant="outline"
                        onClick={() => {
                          setStepDelayDays(0);
                          setStepModalOpen(true);
                        }}
                      >
                        <Plus className="size-3.5" />
                        Add First Step
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {steps.map((step, i) => (
                        <div
                          key={step.id}
                          className="p-3 rounded-xl border bg-muted/20 flex items-start justify-between gap-3"
                        >
                          <div className="min-w-0 space-y-1">
                            <p className="text-xs font-medium text-primary">
                              Step {i + 1} · Day +{step.delay_days}
                            </p>
                            <p className="text-sm font-medium truncate">
                              {step.subject_template}
                            </p>
                            <p className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-2">
                              {step.body_template}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={async () => {
                              await deleteSequenceStep(step.id);
                              const updated = await getSequenceSteps(
                                selectedCampaign.id
                              );
                              setSteps(updated);
                            }}
                          >
                            <Trash2 className="size-3.5 text-destructive" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* Create Campaign Modal */}
      {createModalOpen && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-[1px] p-4"
          onClick={() => setCreateModalOpen(false)}
        >
          <Card
            className="w-full max-w-xl shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
              <div>
                <CardTitle>Create Campaign</CardTitle>
                <CardDescription>
                  Link a LegeRok board to a sender mailbox.
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setCreateModalOpen(false)}
              >
                <X className="size-4" />
              </Button>
            </CardHeader>

            <form id="create-campaign-form" onSubmit={handleCreateCampaign}>
              <CardContent className="space-y-4 pt-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="camp-name">Campaign Name</Label>
                    <Input
                      id="camp-name"
                      placeholder="e.g. Agency Outreach Q4"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      autoFocus
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="camp-mode">Sending Mode</Label>
                    <Select
                      id="camp-mode"
                      value={mode}
                      onValueChange={setMode}
                      options={[
                        { value: "hitl", label: "Review & Approve (HITL)" },
                        { value: "auto", label: "Auto-Send on Schedule" },
                      ]}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="camp-board">Source Board</Label>
                    <Select
                      id="camp-board"
                      value={boardId}
                      onValueChange={setBoardId}
                      placeholder="Select a board..."
                      options={boards.map((b) => ({
                        value: b.id,
                        label: b.name,
                      }))}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="camp-email-field">Email Field</Label>
                    <Select
                      id="camp-email-field"
                      value={emailFieldKey}
                      onValueChange={setEmailFieldKey}
                      placeholder="Select email field..."
                      options={boardFields.map((f) => ({
                        value: f.key,
                        label: `${f.name} (${f.key})`,
                      }))}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="camp-mailbox">Sender Mailbox</Label>
                  <Select
                    id="camp-mailbox"
                    value={mailboxId}
                    onValueChange={setMailboxId}
                    placeholder="Select mailbox..."
                    options={mailboxes.map((m) => ({
                      value: m.id,
                      label: `${m.name} (${m.email})`,
                    }))}
                  />
                </div>
              </CardContent>

              <CardFooter className="flex justify-end gap-2 border-t pt-4 mt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCreateModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={creating || !name.trim() || !emailFieldKey}
                >
                  {creating ? "Creating..." : "Create Campaign"}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </div>
      )}

      {/* Add Sequence Step Modal */}
      {stepModalOpen && selectedCampaign && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-[1px] p-4"
          onClick={() => setStepModalOpen(false)}
        >
          <Card
            className="w-full max-w-xl shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
              <div>
                <CardTitle>Add Sequence Step #{steps.length + 1}</CardTitle>
                <CardDescription>
                  Variables:{" "}
                  {selectedBoardFields.length > 0
                    ? selectedBoardFields.map((f) => `{{${f.key}}}`).join(", ")
                    : "None"}
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setStepModalOpen(false)}
              >
                <X className="size-4" />
              </Button>
            </CardHeader>

            <form id="add-step-form" onSubmit={handleAddStep}>
              <CardContent className="space-y-4 pt-4">
                <div className="space-y-1.5">
                  <Label htmlFor="step-delay">Delay (days from start)</Label>
                  <Input
                    id="step-delay"
                    type="number"
                    min={0}
                    value={stepDelayDays}
                    onChange={(e) => setStepDelayDays(Number(e.target.value))}
                    className="w-32"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="step-subject">Subject</Label>
                  <Input
                    id="step-subject"
                    placeholder="Quick question about {{company}}"
                    value={stepSubject}
                    onChange={(e) => setStepSubject(e.target.value)}
                    autoFocus
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="step-body">Email Body</Label>
                  <textarea
                    id="step-body"
                    rows={6}
                    placeholder="Hi {{name}},&#10;&#10;..."
                    value={stepBody}
                    onChange={(e) => setStepBody(e.target.value)}
                    required
                    className="w-full rounded-xl border border-input bg-input/30 px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  />
                </div>
              </CardContent>

              <CardFooter className="flex justify-end gap-2 border-t pt-4 mt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStepModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={addingStep}>
                  <Plus className="size-3.5" />
                  {addingStep ? "Adding..." : "Add Step"}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </div>
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete campaign?"
        description={`Delete "${confirmDelete?.name}" and its sequence steps and queued emails?`}
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          if (!confirmDelete) return;
          await deleteCampaign(confirmDelete.id);
          setConfirmDelete(null);
          await onChanged();
        }}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
