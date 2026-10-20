"use client";

import { ApiForm, Panel, SubmitButton, Textarea } from "@/components/kat";
import { api } from "@/lib/api";
import { fmtDateTime } from "@/lib/format";

export type Note = { id: number; note: string; author: string | null; created_at: string };

/** Dated staff comments about a client, newest first. */
export function ClientNotes({ clientId, notes, onChange }: { clientId: number; notes: Note[]; onChange: () => Promise<void> }) {
  return (
    <Panel title="Client Notes">
      <ApiForm action={(v) => api(`/clients/${clientId}/notes`, { body: v })} reset onSuccess={onChange}>
        <Textarea name="note" placeholder="Write a dated client comment..." required aria-label="Client note" />
        <SubmitButton>Add Comment</SubmitButton>
      </ApiForm>
      {notes.length > 0 && (
        <ol className="mt-5 flex flex-col gap-3 border-l-2 border-secondary pl-4">
          {notes.map((n) => (
            <li key={n.id} className="text-sm">
              <div className="text-xs text-muted-foreground">
                {fmtDateTime(n.created_at)} · <span className="font-medium text-foreground">{n.author}</span>
              </div>
              <div className="mt-0.5 whitespace-pre-line">{n.note}</div>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}
