"use client";

import { User, UserPlus } from "lucide-react";
import { LinkButton } from "@/components/kat";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

export type ClientOption = { id: number; full_name: string; phone: string };

/** "Who is this repair for?": search clients by name or phone and pick one, or register a new client. */
export function ClientPicker({ clients, onPick }: { clients: ClientOption[]; onPick: (c: ClientOption) => void }) {
  return (
    <div className="flex flex-col gap-3">
      <Command className="rounded-lg border" label="Find client">
        <CommandInput placeholder="Type the client's name or phone number…" autoFocus />
        <CommandList className="max-h-72">
          <CommandEmpty>No client with that name or phone. Register them first.</CommandEmpty>
          <CommandGroup>
            {clients.map((c) => (
              <CommandItem key={c.id} value={`${c.full_name} ${c.phone} ${c.phone.replace(/\s/g, "")}`} onSelect={() => onPick(c)}>
                <User />
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{c.full_name}</div>
                  <div className="text-xs text-muted-foreground">{c.phone}</div>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        Not registered yet?
        <LinkButton href="/clients/new" variant="outline" icon={<UserPlus />}>
          Register new client
        </LinkButton>
      </div>
    </div>
  );
}
