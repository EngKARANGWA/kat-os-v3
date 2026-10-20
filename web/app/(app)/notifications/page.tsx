"use client";

import { Mail, Send } from "lucide-react";
import { ApiForm, Async, Button, DataTable, Field, PageHeader, Panel, SubmitButton, useFilters } from "@/components/kat";
import { Badge } from "@/components/ui/badge";
import { useFlash } from "@/components/Flash";
import { useMe } from "@/components/Session";
import { api, useApi } from "@/lib/api";
import { fmtDay } from "@/lib/format";
import { cn } from "@/lib/utils";

type Notification = { id: number; channel: string; recipient: string; message: string; status: string; created_at: string };
type Data = { notifications: Notification[]; email_ready: boolean; email_from: string };

const STATUS_STYLES: Record<string, string> = {
  Sent: "bg-emerald-100 text-emerald-800",
  Failed: "bg-rose-100 text-rose-800",
  Queued: "bg-slate-100 text-slate-700",
};

export default function NotificationsPage() {
  const me = useMe();
  const flash = useFlash();
  const { data, error, reload } = useApi<Data>("/notifications");
  const { rows, bar, filtering } = useFilters(
    data?.notifications ?? [],
    {
      placeholder: "Search recipient, phone, email, message, ticket…",
      search: (n) => [n.recipient, n.message],
      filters: [
        { kind: "select", key: "channel", label: "Channels", value: (n) => n.channel },
        { kind: "select", key: "status", label: "Statuses", value: (n) => n.status, options: ["Queued", "Sent", "Failed"] },
        { kind: "dates", key: "date", label: "Date", value: (n) => n.created_at },
      ],
    },
    "notifications",
  );

  async function send(id: number) {
    try {
      flash((await api<{ message: string }>(`/notifications/${id}/send`, { method: "POST" })).message);
    } catch (err) {
      flash(err instanceof Error ? err.message : "Sending failed.", "error");
    }
    reload();
  }

  return (
    <>
      <PageHeader title="Notifications" />
      <Async data={data} error={error}>
        {(d) => (
          <>
            <p className="mb-6 text-sm text-muted-foreground">
              {d.email_ready
                ? `Email delivery is active (sending from ${d.email_from}). Clients with an email address are emailed on every repair status change.`
                : "Email delivery is not configured yet. Set RESEND_API_KEY to send emails automatically."}{" "}
              SMS/WhatsApp messages stay queued until a provider is connected.
            </p>
            {me.is_manager && (
              <Panel title="Test Email" className="mb-6">
                <ApiForm layout="inline" action={(v) => api<{ message: string }>("/notifications/test", { body: v })} success={(r) => r.message}>
                  <Field label="Send a test email to" type="email" name="to" required placeholder="you@example.com" />
                  <SubmitButton icon={<Mail />}>Send Test Email</SubmitButton>
                </ApiForm>
              </Panel>
            )}
            <Panel>
              {bar}
              <DataTable
                rows={rows}
                rowKey={(n) => n.id}
                empty={filtering ? "No notifications match these filters." : "No notifications yet."}
                columns={[
                  { header: "Date", cell: (n) => <span className="whitespace-nowrap">{`${fmtDay(n.created_at)} ${n.created_at.slice(11, 16)}`}</span> },
                  { header: "Channel", cell: (n) => n.channel },
                  { header: "Recipient", cell: (n) => n.recipient },
                  { header: "Message", className: "min-w-64 whitespace-pre-line", cell: (n) => n.message },
                  { header: "Status", cell: (n) => <Badge className={cn("rounded-full", STATUS_STYLES[n.status])}>{n.status}</Badge> },
                  {
                    header: "",
                    cell: (n) =>
                      n.channel === "Email" &&
                      n.status !== "Sent" &&
                      d.email_ready && (
                        <Button size="default" variant="outline" onClick={() => send(n.id)}>
                          <Send />
                          Send
                        </Button>
                      ),
                  },
                ]}
              />
            </Panel>
          </>
        )}
      </Async>
    </>
  );
}
